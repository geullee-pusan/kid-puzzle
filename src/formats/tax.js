// 약수 세금: 판 화면에서 이 형식이 맡는 부분(판, 답하는 칸, 끝났을 때 하는 말, 풀이와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, 힌트 단추, 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/tax.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 이 형식에는 틀린 답이 없다. 더 좋은 답을 찾는 형식이다.
//   카드를 누르면 그 카드와 세금으로 나갈 카드가 눈에 띈다(미리 보기). 한 번 더 누르거나 "가질래요"를 누르면 가진다.
//   가질 수 있는 카드가 더 없으면 한 번이 끝난다. 가진 수의 합과 세금을 사실로 말한다.
//   가장 큰 합이면 판이 끝난다. 아니면 "더 많이 가질 수 있을까요?"라고 묻고, 다시 해 볼지 여기까지 할지 아이가 고른다.
//   "여기까지 할래요"로 끝낸 판도 끝까지 한 판이다(그만둔 판이 아니다).
// 가진 수의 합은 이 놀이의 내용이다. 다른 것으로 바꿔 보여 주지 않는다. 이 판에서 가장 많이 가진 합만 판 아래에 적는다.
// "카드마다 낼 세금 보기"는 도구다. 처음 누를 때 힌트 하나를 연 것으로 적는다.
import T from '../content/tax.json';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf } from '../core/tax-ladder.js';
import { MAX_CARD, MIN_N, cardsUpTo, checkBoard, plainN, replay, solve, takeable, taxOf } from '../core/tax.js';
import { endsClosed, fill } from '../core/text.js';
import { boardCard, drawBoard, drawMini, drawPicker, stepsCard } from '../ui/tax-board.js';

const FORMAT = 'tax';
const MODE = 'play';
/** 기록에 남기는 "한 번마다의 차례"의 수의 위 끝 */
const MAX_TRIES = 40;
const FIRST_DRAFT = { n: 12, off: [] };

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createTax(frame) {
  const { $, log } = frame;
  let pick = null; // 골라서 미리 보는 카드
  let flash = null; // 방금 누른 카드를 왜 못 가지는지: { text, card }. 다음에 무엇을 누르면 지운다
  let fresh = null; // 방금 가진 카드와 그때 세금으로 나간 카드들: { card, due }
  let draft = null; // 직접 만들기에서 정하던 판

  const total = (list) => list.reduce((sum, card) => sum + card, 0);
  const copyBoard = (board) => ({ cards: board.cards.slice() });
  /** 수 뒤에 붙는 말("예요" 또는 "이에요") */
  const be = (number) => T.be[endsClosed(number) ? 'closed' : 'open'];
  const sums = (state) => ({ held: fill(T.sum, { n: state.sum }), gone: fill(T.sum, { n: state.tax }) });
  const facts = (sum, tax) => ({ sum, sumBe: be(sum), tax, taxBe: be(tax) });

  // ---- 판 ----
  function draw() {
    const { round } = frame;
    const state = replay(round.board, round.taken);
    const playing = !round.done;
    const due = pick === null ? [] : taxOf(state.remaining, pick);
    const costs = round.costsOn ? Object.fromEntries(state.open.map((card) => [card, total(taxOf(state.remaining, card))])) : null;
    const whatOf = (card) => (state.left.includes(card) ? 'left' : card === pick ? 'pick' : due.includes(card) ? 'due' : state.open.includes(card) ? 'open' : 'shut');
    let status = '';
    if (flash) status = flash.text;
    else if (pick !== null) status = fill(T.status.preview, { k: pick, list: due.join(', ') });
    else if (state.ended && round.taken.length > 0) status = T.status.ended;
    else if (fresh) status = fill(T.status.took, { k: fresh.card, list: fresh.due.join(', ') });
    drawBoard($('tax-board'), {
      cards: round.board.cards,
      remaining: state.remaining,
      open: state.open,
      held: state.held,
      gone: state.gone,
      left: state.left,
      pick,
      due,
      costs,
      refused: flash?.card ?? null,
      fresh,
      status,
      names: T.names,
      sums: sums(state),
      label: (card) => {
        const what = T.cards[whatOf(card)];
        return costs && costs[card] !== undefined ? fill(T.costLabel, { k: card, what, c: costs[card] }) : fill(T.cardLabel, { k: card, what });
      },
      onTap: playing ? tap : undefined,
    });
    $('tax-best-line').hidden = round.best === null;
    $('tax-best').textContent = round.best === null ? '' : String(round.best);
    $('undo').disabled = !playing || round.taken.length === 0;
    $('reset').disabled = !playing || round.taken.length === 0;
    $('tax-take').disabled = !playing || pick === null;
    $('tax-again').hidden = !(playing && state.ended && round.taken.length > 0);
    $('tax-stop').hidden = !(playing && round.best !== null);
    $('tax-costs').textContent = T.tool[round.costsOn ? 'on' : 'off'];
    $('tax-costs').setAttribute('aria-pressed', String(round.costsOn));
    $('tax-costs').disabled = round.done;
    frame.showWhy();
  }

  /** 카드를 눌렀다: 처음 누르면 미리 보기, 고른 카드를 한 번 더 누르면 가진다. 가질 수 없는 카드는 왜 못 가지는지 판 아래에 적는다. */
  function tap(card) {
    const { round } = frame;
    if (round.done) return;
    const state = replay(round.board, round.taken);
    flash = null;
    if (!state.remaining.includes(card)) return;
    if (!state.open.includes(card)) {
      pick = null;
      round.refuseCount += 1;
      frame.note('refuse', { card });
      flash = { text: T.status.shut, card };
      draw();
      frame.persist();
      return;
    }
    if (pick === card) {
      take(card);
      return;
    }
    pick = card;
    round.peekCount += 1;
    frame.note('peek', { card });
    draw();
    frame.persist();
  }

  /** 고른 카드를 가진다. 판에 남은 그 수의 약수가 모두 세금으로 나간다. */
  function take(card) {
    const { round } = frame;
    if (round.done || card === null) return;
    const due = taxOf(replay(round.board, round.taken).remaining, card);
    if (due.length === 0) return;
    round.taken = [...round.taken, card];
    round.moveCount += 1;
    if (round.taken.length === 1 && !round.firsts.includes(card)) round.firsts.push(card);
    pick = null;
    flash = null;
    fresh = { card, due };
    frame.note('take', { card, tax: due });
    const state = replay(round.board, round.taken);
    if (state.ended) {
      complete(state);
      return;
    }
    draw();
    frame.persist();
  }

  /** 가질 수 있는 카드가 더 없다: 한 번이 끝났다. 사실을 말하고, 가장 큰 합이 아니면 더 많이 가질 수 있을지 묻는다. */
  function complete(state) {
    const { round, solution } = frame;
    const before = round.best;
    round.completions.push(state.sum);
    round.tries = [...round.tries, { order: state.held, sum: state.sum }].slice(-MAX_TRIES);
    if (before === null || state.sum > before) {
      round.best = state.sum;
      round.bestOrder = state.held.slice();
    }
    const reached = solution.exact && state.sum === solution.best;
    const guess = reached ? null : 'less-than-best';
    round.answers.push({ t: frame.stamp(), answer: `sum:${state.sum}`, correct: reached, guess });
    frame.note('answer', { answer: `sum:${state.sum}`, correct: reached, guess });
    if (reached) {
      frame.finish('solved');
      return;
    }
    // 틀렸다고 하지 않는다. 가진 수의 합과 세금을 말하고 더 많이 가질 수 있을지 묻는다. 판은 그대로 둔다.
    frame.persist();
    draw();
    const line = !solution.exact ? T.play.unknown : before !== null && state.sum > before ? T.play['more-up'] : T.play.more;
    frame.say(fill(line, facts(state.sum, state.tax)));
  }

  /** "여기까지 할래요": 지금까지 가장 많이 가진 합으로 판을 끝낸다. 이것도 끝까지 한 판이다. */
  function stop() {
    const { round } = frame;
    if (round.done || round.best === null) return;
    round.stopped = true;
    frame.note('stop', { best: round.best });
    frame.finish('solved');
  }

  function undo() {
    const { round } = frame;
    if (round.done || round.taken.length === 0) return;
    round.taken = round.taken.slice(0, -1);
    round.undoCount += 1;
    pick = null;
    flash = null;
    fresh = null;
    frame.note('undo');
    draw();
    frame.persist();
  }

  /** 처음으로 되돌린다. 한 번을 끝까지 한 뒤라면 "다시 해 보기"로 적고, 하던 가운데라면 되돌리기로 적는다. */
  function reset() {
    const { round } = frame;
    if (round.done || round.taken.length === 0) return;
    const ended = replay(round.board, round.taken).ended;
    round.taken = [];
    if (ended) {
      round.retryCount += 1;
      frame.note('again');
    } else {
      round.resetCount += 1;
      frame.note('reset');
    }
    pick = null;
    flash = null;
    fresh = null;
    draw();
    frame.persist();
  }

  /** "카드마다 낼 세금 보기": 지금 가질 수 있는 카드마다 세금으로 나갈 수의 합을 작게 적는다. */
  function toggleCosts() {
    const { round } = frame;
    if (!round || round.done) return;
    round.costsOn = !round.costsOn;
    if (round.costsOn) {
      round.costsShown = true;
      round.costsCount += 1;
    }
    frame.note('costs', { on: round.costsOn });
    draw();
    frame.persist();
  }

  /** 끝났을 때 하는 말: 한 일을 그대로 말한다(가진 수의 합, 세금, 몇 번 다시 해 봤는지). */
  function rightLine(round, solution) {
    const retries = Math.max(0, round.completions.length - 1);
    if (round.stopped) {
      const parts = [fill(T.right.stopped, facts(round.best, solution.total - round.best))];
      if (retries > 0) parts.push(fill(T.right['stopped-tries'], { r: retries }));
      return parts;
    }
    const parts = [fill(T.right.best, facts(solution.best, solution.total - solution.best))];
    parts.push(retries === 0 ? T.right['first-try'] : fill(T.right.after, { r: retries }));
    // 가장 큰 합으로 처음 끝낸 판이면 "왜 그럴까?"가 생겼다고 알려 준다.
    const reached = log.allRecords().filter((record) => record.kind === 'round' && record.format === FORMAT && record.reachedBest === true && !record.custom);
    if (!round.custom && reached.length === 1) parts.push(T.right['why-invite']);
    return parts;
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----
  function rowOf(cards) {
    const row = document.createElement('div');
    row.className = 'figure-row';
    row.append(...cards);
    return row;
  }

  /** 그림 하나: 1부터 n까지의 판에서 차례대로 가진 뒤의 모습 */
  function pictureOf(n, taken) {
    const board = { cards: cardsUpTo(n) };
    const state = replay(board, taken);
    return { cards: board.cards, remaining: state.remaining, open: state.open, held: state.held, gone: state.gone, left: state.left, names: T.names, sums: sums(state) };
  }

  /** "왜 그럴까?": 선생님이 어떻게 알아챘는지의 이야기 */
  function whyPages() {
    return T.why.map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다(단추를 보일지 따질 때마다 그리지 않는다).
      get nodes() {
        return [rowOf(slide.figures.map((item) => boardCard(pictureOf(item.n, item.taken), item.note)))];
      },
    }));
  }

  /** 풀이: 가장 많이 가지는 한 가지 차례를 걸음마다 보여 준다. */
  function solutionPages(round, solution) {
    const state = replay(round.board, solution.order);
    if (solution.order.length === 0) return [{ say: T.solution.none, nodes: [rowOf([boardCard({ cards: round.board.cards, remaining: state.remaining, left: state.left }, '')])] }];
    const steps = state.held.map((card, index) => ({ caption: fill(T.solution.stepLabel, { no: index + 1 }), card, due: state.paid[index] }));
    const end = { pay: T.solution.pay, names: T.names, sums: sums(state), held: state.held, gone: state.gone, left: state.left };
    const say = fill(solution.exact ? T.solution.say : T.solution.unknown, { k: solution.best, be: be(solution.best) });
    return [{ say, nodes: [rowOf([stepsCard(steps, end)])] }];
  }

  // ---- 직접 만들기: 카드를 몇까지 놓을지 정하고, 카드를 눌러 뺀다. ----
  const draftBoard = () => ({ cards: cardsUpTo(draft.n).filter((card) => !draft.off.includes(card)) });
  const draftOk = (value) =>
    Boolean(value) &&
    Number.isInteger(value.n) &&
    value.n >= MIN_N &&
    value.n <= MAX_CARD &&
    Array.isArray(value.off) &&
    value.off.every((card) => Number.isInteger(card) && card >= 1 && card <= value.n) &&
    new Set(value.off).size === value.off.length &&
    value.off.length < value.n;

  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    return draftOk(saved) ? { n: saved.n, off: saved.off.slice() } : { n: FIRST_DRAFT.n, off: [] };
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    $('tax-make-result').textContent = '';
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function drawMake() {
    $('tax-make-n').textContent = fill(T.make.upTo, { n: draft.n });
    $('tax-make-fewer').disabled = draft.n <= MIN_N;
    $('tax-make-more').disabled = draft.n >= MAX_CARD;
    $('tax-make-clear').disabled = draft.off.length === 0;
    drawPicker($('tax-make-board'), {
      n: draft.n,
      off: draft.off,
      label: (card) => fill(T.make[draft.off.includes(card) ? 'off' : 'on'], { k: card }),
      onTap: toggleCard,
    });
    // 가질 수 있는 카드가 하나도 없는 판은 해 볼 수 없다. 그렇다고 알려 주고 해 보는 단추를 끈다.
    const dead = takeable(draftBoard().cards).length === 0;
    $('tax-make-play').disabled = dead;
    if (dead) $('tax-make-result').textContent = T.make.none;
  }

  function changeDraft(next) {
    if (!draftOk(next)) return;
    draft = next;
    $('tax-make-result').textContent = '';
    log.saveDraft(draft, FORMAT);
    drawMake();
  }

  /** 카드를 눌렀다: 놓인 카드면 빼고, 뺀 카드면 다시 놓는다. 마지막 한 장은 빼지 못한다. */
  function toggleCard(card) {
    const off = draft.off.includes(card) ? draft.off.filter((item) => item !== card) : [...draft.off, card].sort((a, b) => a - b);
    changeDraft({ ...draft, off });
  }

  /** 몇까지 놓을지를 바꾼다. 뺀 카드는 그대로 두고, 판 밖으로 나간 것은 버린다. */
  function resize(n) {
    changeDraft({ n, off: draft.off.filter((card) => card <= n) });
  }

  /** 아이가 정한 판을 풀이 프로그램으로 풀어서, 가장 많이 가질 수 있는 합과 한 가지 차례를 알려 준다. */
  function solveDraft() {
    const board = draftBoard();
    const result = solve(board);
    let line = T.make.none;
    if (result.order.length > 0) {
      line = result.exact ? fill(T.make.best, { k: result.best, be: be(result.best), order: result.order.join(', ') }) : fill(T.make.unknown, { k: result.best, be: be(result.best) });
    }
    $('tax-make-result').textContent = line;
    const now = new Date().toISOString();
    log.saveRecord({
      kind: 'made',
      v: 1,
      id: log.newId('m'),
      format: FORMAT,
      startedAt: now,
      endedAt: now,
      board,
      n: plainN(board),
      solution: { possible: true, exact: result.exact, best: result.best, order: result.order, total: result.total },
    });
    log.flush();
    frame.talkers.make.say(line);
  }

  function playDraft() {
    const board = draftBoard();
    if (takeable(board.cards).length === 0) return;
    frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board });
  }

  // ---- 단추 잇기 ----
  $('tax-take').addEventListener('click', () => take(pick));
  $('tax-again').addEventListener('click', reset);
  $('tax-stop').addEventListener('click', stop);
  $('tax-costs').addEventListener('click', toggleCosts);
  $('tax-make-fewer').addEventListener('click', () => resize(draft.n - 1));
  $('tax-make-more').addEventListener('click', () => resize(draft.n + 1));
  $('tax-make-clear').addEventListener('click', () => changeDraft({ ...draft, off: [] }));
  $('tax-make-solve').addEventListener('click', solveDraft);
  $('tax-make-play').addEventListener('click', playDraft);

  const count = (value) => Number.isInteger(value) && value >= 0;

  return {
    id: FORMAT,
    T,
    padId: 'tax-pad',
    makeId: 'make-tax',
    homeIds: { sample: 'home-tax-sample', blank: 'home-tax-blank', ask: 'home-tax-ask', play: 'home-tax-play', pick: 'home-tax-pick', make: 'home-tax-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    /** 새 판에서 이 형식이 맡는 값 */
    begin({ board }) {
      return {
        mode: MODE,
        board: copyBoard(board), // 판: 놓인 카드들
        taken: [], // 처음 모습에서 지금까지 가진 카드의 차례
        moveCount: 0, // 이 판에서 카드를 가진 수(무르고 되돌리기 전의 것까지 모두)
        peekCount: 0, // 카드를 눌러 미리 본 수
        refuseCount: 0, // 가질 수 없는 카드를 누른 수
        undoCount: 0,
        resetCount: 0, // 하던 가운데 처음으로 되돌린 수
        retryCount: 0, // 한 번을 끝까지 한 뒤 다시 해 본 수
        firsts: [], // 맨 처음에 가져 본 카드들
        completions: [], // 끝까지 갈 때마다의 가진 수의 합
        tries: [], // 끝까지 갈 때마다의 차례와 합
        best: null, // 이 판에서 지금까지 가장 많이 가진 합
        bestOrder: [], // 그 합이 된 차례
        stopped: false, // "여기까지 할래요"로 끝냈는가
        costsOn: false, // 지금 카드마다 낼 세금을 적고 있는가
        costsShown: false, // 낼 세금을 한 번이라도 보았는가
        costsCount: 0, // 낼 세금 보기를 켠 수
      };
    },
    solve(round) {
      const { exact, best, order, total: all } = solve(round.board);
      // possible은 틀이 본다("안 되는 판"이 없는 형식이라 늘 true다).
      return { possible: true, exact, best, order, total: all };
    },
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (saved.mode !== MODE || checkBoard(saved.board) !== null) return false;
      if (!replay(saved.board, saved.taken).ok) return false;
      if (![saved.moveCount, saved.peekCount, saved.refuseCount, saved.undoCount, saved.resetCount, saved.retryCount, saved.costsCount].every(count)) return false;
      if (![saved.firsts, saved.completions, saved.tries, saved.bestOrder].every(Array.isArray)) return false;
      if (typeof saved.costsOn !== 'boolean' || typeof saved.costsShown !== 'boolean') return false;
      return saved.best === null || count(saved.best);
    },
    /** 판 화면에서 이 형식의 것(판, 가장 많이 가진 합, 도구 단추)을 보이거나 감춘다 */
    showParts(on) {
      $('tax-board').hidden = !on;
      $('tax-count').hidden = !on;
      $('tax-costs').hidden = !on;
    },
    enter() {
      pick = null;
      flash = null;
      fresh = null;
    },
    draw,
    ended() {
      pick = null;
      flash = null;
    },
    ruleLine: () => T.rules.play,
    hints: (round) => T.hints[rungOf(round.level).hint],
    hintsShown: (round) => round.hintsOpened,
    touched: (round) => round.moveCount > 0,
    record(round, solution) {
      const state = replay(round.board, round.taken);
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        n: plainN(round.board), // 1부터 n까지의 판이면 그 n, 카드를 골라 놓은 판이면 null
        solution: { possible: true, exact: solution.exact, best: solution.best, order: solution.order, total: solution.total },
        // 질문 힌트와 "카드마다 낼 세금 보기"를 함께 센다.
        hintsOpened: round.hintsOpened + (round.costsShown ? 1 : 0),
        costsShown: round.costsShown,
        costsCount: round.costsCount,
        // 판을 떠날 때: 가진 카드의 차례, 가진 수의 합, 세금, 끝까지 갔는가
        taken: round.taken,
        sum: state.sum,
        tax: state.tax,
        ended: state.ended,
        // 끝까지 갈 때마다의 차례와 합, 다시 해 본 횟수, 가장 많이 가진 합과 그 차례
        tries: round.tries,
        completions: round.completions,
        retries: Math.max(0, round.completions.length - 1),
        retryCount: round.retryCount,
        best: round.best,
        bestOrder: round.bestOrder,
        // 가장 큰 합(풀이 프로그램)에 닿았는가. 수준 맞추기와 "왜 그럴까?"가 본다
        reachedBest: solution.exact && round.best !== null && round.best === solution.best,
        stopped: round.stopped === true,
        moveCount: round.moveCount,
        peekCount: round.peekCount,
        refuseCount: round.refuseCount,
        undoCount: round.undoCount,
        resetCount: round.resetCount,
        firsts: round.firsts,
      };
    },
    rightLine,
    whyPages,
    solutionPages,
    undo,
    reset,
    onKey() {},

    // ---- 처음 화면에 그리는 그림 ----
    homeAsk: () => T.home.ask,
    pickLine: () => T.home.pick,
    drawSample(root, board) {
      drawMini(root, { cards: board.cards });
    },
    drawBlank(root) {
      drawMini(root, { blank: true });
    },
    drawResume(root, saved) {
      const { remaining } = replay(saved.board, saved.taken);
      drawMini(root, { cards: remaining.length > 0 ? remaining : saved.board.cards });
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 첫 판의 카드 몇 장 */
    drawLevelPicture(root, entry) {
      const picture = entry.picture;
      if (picture.blank) drawMini(root, { blank: true });
      else drawMini(root, { cards: cardsUpTo(picture.n) });
    },
    showMake,
  };
}
