// 숫자 넷으로 수 만들기: 판 화면에서 이 형식이 맡는 부분(카드와 셈 기호, 목표 수 칸과 1부터의 띠, 답하는 칸, 끝났을 때 하는 말, 풀이와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/fourdigits.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 카드 하나를 누르면 고르고, 셈 기호를 누르고, 다른 카드를 누르면 두 카드가 셈한 값의 카드 한 장으로 합쳐진다(새 카드는 두 자리 가운데 왼쪽).
//   고른 카드를 다시 누르면 내려놓는다. 기호를 고르기 전에 다른 카드를 누르면 그 카드를 고른다. 작은 수에서 큰 수를 빼거나 0으로 나누면 합치지 않고 그 사실만 적는다.
//   카드가 한 장 남으면 숫자 카드를 모두 한 번씩 쓴 것이다. 그 값을 본다.
// 목표 수 판(1, 2, 5단계): 남은 카드가 아직 만들지 않은 목표 수이면 그 식을 목표 수 칸에 적고 카드를 처음으로 돌린다. 목표 수를 모두 만들면 끝난다.
//   다르면 그 사실만 적는다(무르기로 돌아가면 된다).
// 1부터 차례로(3, 4단계와 직접 만든 판): 남은 카드가 1 이상의 자연수이면 띠에 적고 카드를 처음으로 돌린다. 이미 적은 수, 0, 분수는 그 사실만 적는다.
//   띠에는 늘 아직 만들지 않은 가장 작은 수 둘이 점선으로 열려 있다(열린 판 둘. 하나를 만들면 다음 수가 열린다). 다른 수를 먼저 만들어도 적는다.
//   기록은 1부터 몇까지 차례로 만들었는가다. 처음 막히는 수 앞까지 이으면 끝난다(그 수는 합치는 차례를 모두 해 본 풀이 프로그램이 안다).
//   만든 수가 하나라도 있으면 "여기까지 할래요"로 끝낼 수 있다. 가장 좋은 기록은 공책에 저절로 남는다. 기록은 다른 값으로 바꾸어 보이지 않는다.
// 무르기는 지금 카드에서 한 합치기 하나를 무른다. 처음으로는 지금 카드를 숫자 카드로 돌린다. 띠와 목표 수 칸에 적은 식은 그대로다.
import T from '../content/fourdigits.json';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf } from '../core/fourdigits-ladder.js';
import { FARTHEST, MAX_DIGIT, MIN_DIGIT, OPS, STRIP_CAP, STRIP_STEP, checkBoard, combine, copyBoard, firstMissing, isWhole, needsFraction, openOf, orderCount, refusal, replaySteps, runOf, solve, startCards, stepOf, stepsOf, stripTop, wholeReach } from '../core/fourdigits.js';
import { smallerFourdigits } from '../core/smaller.js';
import { fill, ordinal } from '../core/text.js';
import { cardText, cardsFigure, drawCards, drawList, drawOps, drawStrip, drawTargets, listFigure, stripFigure } from '../ui/fourdigits-board.js';

const FORMAT = 'fourdigits';
const MODES = ['three', 'four', 'run', 'same', 'fraction', 'made'];
/** 직접 만들기의 처음 숫자 */
const FIRST_DRAFT = [1, 2, 3, 4];
/** 처음 화면과 판 고르기에 그리는 빈 판의 숫자 */
const BLANK = [1, 2, 3, 4];

const count = (value) => Number.isInteger(value) && value >= 0;
const isRun = (board) => board.kind === 'run';

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createFourdigits(frame) {
  const { $, log } = frame;
  let flash = null; // 판 아래에 잠깐 적는 한 줄. 다음에 무엇을 누르면 지운다
  let fresh = null; // 방금 생긴 카드(굵은 테두리. 한 번 그리고 지운다)
  let draft = null; // 직접 만들기에서 고르는 숫자 넷
  let made = null; // 직접 만들기에서 선생님이 따진 것(숫자를 바꾸면 지운다)

  const cardsOf = (round) => replaySteps(round.board.digits, round.steps).cards;
  /**
   * 규칙 글과 힌트의 이름. 보통은 판의 종류(mode)이고, 더 작은 판이 단계와 다른 종류일 때(네 개의 4의 작은 판은 목표 수 판이다)는 판에 맞춘다.
   */
  const ruleKey = (round) => {
    const run = ['run', 'same', 'made'].includes(round.mode);
    if (run === isRun(round.board)) return round.mode;
    if (isRun(round.board)) return 'run';
    return round.board.targets.length > 1 ? 'four' : 'three';
  };
  const madeNumbers = (round) => round.made.map((item) => item.n);
  /** 만든 식의 글: 적어 둔 합치기를 다시 해서 마지막 카드의 식을 적는다 */
  const madeText = (round, item) => cardText(replaySteps(round.board.digits, item.steps).cards[0].tree, T.faces);

  /** 값을 읽는 글: 자연수는 그대로, 분수는 "4분의 3" */
  const readValue = (value) => (isWhole(value) ? String(value[0]) : fill(T.labels.fraction, { n: value[1], k: value[0] }));
  const cardLabel = (card) => (typeof card.tree === 'number' ? fill(T.labels.card, { face: readValue(card.value) }) : fill(T.labels['card-made'], { face: readValue(card.value) }));
  const cellLabel = (no, kind) => fill(T.labels[kind ? `cell-${kind}` : 'cell'], { n: no });

  // ---- 판 ----
  function draw() {
    const { round, solution } = frame;
    const { board } = round;
    const playing = !round.done;
    const cards = cardsOf(round);
    const root = $('fourdigits-board');
    const top = document.createElement('div');
    top.className = 'nf-top-box';
    if (isRun(board)) drawRunStrip(top, round, solution);
    else {
      const texts = new Map(round.made.map((item) => [item.n, madeText(round, item)]));
      drawTargets(top, {
        targets: board.targets.map((n) => ({ n, text: texts.get(n) ?? null })),
        label: (target) => (target.text ? fill(T.labels['target-made'], { n: target.n, face: target.text }) : fill(T.labels.target, { n: target.n })),
      });
    }
    const hand = document.createElement('div');
    hand.className = 'nf-hand';
    drawCards(hand, {
      cards,
      faces: T.faces,
      picked: playing ? round.picked : null,
      fresh,
      label: cardLabel,
      onCard: playing ? tapCard : undefined,
    });
    const ops = document.createElement('div');
    drawOps(ops, { ops: OPS, faces: T.faces, names: T.labels.op, picked: playing ? round.op : null, enabled: playing && round.picked !== null && cards.length > 1, onOp: tapOp });
    root.replaceChildren(top, hand, ops);
    fresh = null;

    // 판 아래: 할 일이나 사실 한 줄, 남은 카드의 수
    $('fourdigits-status').textContent = flash ?? statusOf(round, cards);
    $('fourdigits-left').textContent = String(cards.length);
    $('undo').disabled = !playing || round.steps.length === 0;
    $('reset').disabled = !playing || round.steps.length === 0;
    drawPad(round, playing);
    frame.showWhy();
  }

  /** 1부터의 띠: 만든 수, 열린 수 둘, 끝난 판에서는 처음 막히는 수(이은 끝이 거기일 때) */
  function drawRunStrip(root, round, solution) {
    const numbers = madeNumbers(round);
    const open = openOf(numbers);
    const reached = round.done && solution && runOf(numbers) === solution.best;
    drawStrip(root, {
      top: stripTop(numbers, open),
      made: numbers,
      open: round.done ? [] : open,
      none: reached ? [solution.missing] : [],
      label: cellLabel,
    });
  }

  /** 오른쪽 칸: 목표 수, 1부터 차례로의 기록과 만든 식, "여기까지 할래요" */
  function drawPad(round, playing) {
    const { board } = round;
    $('fourdigits-target-box').hidden = isRun(board);
    $('fourdigits-run-box').hidden = !isRun(board);
    if (!isRun(board)) {
      $('fourdigits-targets').textContent = board.targets.join(', ');
      return;
    }
    const numbers = madeNumbers(round);
    const run = runOf(numbers);
    $('fourdigits-run-line').hidden = run === 0;
    $('fourdigits-run-none').hidden = run !== 0;
    $('fourdigits-run').textContent = String(run);
    const entries = round.made.map((item) => ({ n: item.n, text: madeText(round, item) })).sort((a, b) => a.n - b.n);
    $('fourdigits-list-title').hidden = entries.length === 0;
    drawList($('fourdigits-list'), entries);
    $('fourdigits-stop').hidden = !(playing && round.made.length > 0);
  }

  function statusOf(round, cards) {
    if (round.done) {
      if (!isRun(round.board)) return T.status.done;
      return round.stopped ? T.status['run-stopped'] : fill(T.status['run-done'], { k: runOf(madeNumbers(round)) });
    }
    if (cards.length === 1) return T.status['one-left'];
    if (round.picked === null) return T.status.start;
    return round.op === null ? T.status.picked : T.status.op;
  }

  // ---- 카드와 셈 기호 ----
  function tapCard(at) {
    const { round } = frame;
    if (!round || round.done) return;
    const cards = cardsOf(round);
    if (!Number.isInteger(at) || at < 0 || at >= cards.length) return;
    flash = null;
    if (cards.length === 1) {
      flash = T.status['one-left'];
      draw();
      return;
    }
    if (round.picked === null || round.op === null) {
      // 고르기: 같은 카드를 다시 누르면 내려놓는다
      round.picked = round.picked === at ? null : at;
      round.op = null;
      frame.note('pick', { at: round.picked });
      draw();
      frame.keep();
      return;
    }
    if (round.picked === at) {
      round.picked = null;
      round.op = null;
      frame.note('pick', { at: null });
      draw();
      frame.keep();
      return;
    }
    const { picked, op } = round;
    const reason = refusal(cards[picked].value, op, cards[at].value);
    if (reason) {
      // 합치지 않는다. 고른 카드와 기호는 그대로 둔다
      round.refuseCount += 1;
      frame.note('refuse', { i: picked, op, j: at, reason });
      flash = T.status[reason];
      draw();
      frame.keep();
      return;
    }
    const after = combine(cards, picked, op, at);
    round.steps = [...round.steps, stepOf(picked, op, at)];
    round.picked = null;
    round.op = null;
    round.combineCount += 1;
    fresh = Math.min(picked, at);
    frame.note('combine', { step: round.steps.at(-1), value: after[fresh].value });
    if (after.length === 1) {
      settle(after[0]);
      return;
    }
    draw();
    frame.persist();
  }

  function tapOp(op) {
    const { round } = frame;
    if (!round || round.done || round.picked === null || !OPS.includes(op)) return;
    flash = null;
    round.op = round.op === op ? null : op;
    frame.note('op', { op: round.op });
    draw();
    frame.keep();
  }

  /** 카드가 한 장 남았다: 목표 수(띠에 적을 수)이면 적고 카드를 처음으로 돌린다 */
  function settle(card) {
    const { round, solution } = frame;
    const { board } = round;
    const n = isWhole(card.value) ? card.value[0] : null;
    const numbers = madeNumbers(round);
    const text = cardText(card.tree, T.faces);
    const keep = () => {
      round.made = [...round.made, { n, steps: round.steps }];
      round.steps = [];
      round.answers.push({ t: frame.stamp(), answer: `made:${n}`, correct: true, guess: null });
      frame.note('made', { n, text });
    };
    if (!isRun(board)) {
      if (n !== null && board.targets.includes(n) && !numbers.includes(n)) {
        keep();
        if (board.targets.every((target) => madeNumbers(round).includes(target))) {
          flash = null;
          frame.finish('solved');
          return;
        }
        flash = fill(T.status.made, { n });
        fresh = null;
      } else {
        round.endCount += 1;
        flash = n !== null && numbers.includes(n) ? fill(T.status['again-target'], { n }) : T.status.other;
      }
      draw();
      frame.persist();
      return;
    }
    if (n !== null && n >= 1 && n <= STRIP_CAP && !numbers.includes(n)) {
      keep();
      if (runOf(madeNumbers(round)) === solution.best) {
        flash = null;
        frame.finish('solved');
        return;
      }
      flash = fill(T.status['strip-made'], { n });
      fresh = null;
    } else {
      round.endCount += 1;
      if (n === null) flash = T.status['strip-fraction'];
      else if (n === 0) flash = T.status['strip-zero'];
      else if (n > STRIP_CAP) flash = fill(T.status['strip-far'], { n, k: STRIP_CAP });
      else flash = fill(T.status['strip-again'], { n });
    }
    draw();
    frame.persist();
  }

  /** 지금 카드에서 한 합치기 하나를 무른다 */
  function undo() {
    const { round } = frame;
    if (round.done || round.steps.length === 0) return;
    round.steps = round.steps.slice(0, -1);
    round.picked = null;
    round.op = null;
    round.undoCount += 1;
    flash = null;
    fresh = null;
    frame.note('undo');
    draw();
    frame.persist();
    // 앞의 모습에 한 말(남은 카드가 목표 수와 다르다는 말 같은 것)은 이제 맞지 않을 수 있으니 덮는다
    frame.say(T.play.undo);
  }

  /** 지금 카드를 숫자 카드로 돌린다. 적은 식은 그대로다 */
  function reset() {
    const { round } = frame;
    if (round.done || round.steps.length === 0) return;
    round.steps = [];
    round.picked = null;
    round.op = null;
    round.resetCount += 1;
    flash = null;
    fresh = null;
    frame.note('reset');
    draw();
    frame.persist();
    frame.say(T.play.reset);
  }

  /** "여기까지 할래요": 1부터 차례로 하는 판을 지금까지 만든 것으로 끝낸다. 이것도 끝까지 한 판이다 */
  function stop() {
    const { round } = frame;
    if (!round || round.done || !isRun(round.board) || round.made.length === 0) return;
    round.stopped = true;
    // 수준 맞추기가 보는 값: 끝까지 잇지 않고 끝낸 판은 "한 번에"가 아니다
    round.wrongCount += 1;
    frame.note('stop', { run: runOf(madeNumbers(round)) });
    frame.finish('solved');
  }

  // ---- 끝났을 때 하는 말: 한 일과 사실만 말한다 ----
  function rightLine(round, solution) {
    const { board } = round;
    if (!isRun(board)) {
      if (board.targets.length > 1) return [fill(T.right.many, { k: board.targets.length })];
      const [entry] = solution.targets;
      const parts = [T.right.one, entry.ways === 1 ? fill(T.right['ways-one'], { f: solution.orders }) : fill(T.right.ways, { f: solution.orders, k: entry.ways })];
      if (entry.plain === 0) parts.push(T.right.fraction);
      return parts;
    }
    const run = runOf(madeNumbers(round));
    if (!round.stopped) return [fill(T.right.run, { k: run }), fill(T.right['run-none'], { f: solution.orders, n: solution.missing }), T.right['run-end']];
    return [run === 0 ? T.right['stopped-none'] : fill(T.right.run, { k: run }), fill(T.right['run-more'], { n: run + 1 })];
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----
  function rowOf(cards) {
    const row = document.createElement('div');
    row.className = 'figure-row';
    row.append(...cards);
    return row;
  }

  /** 합치기 차례를 한 장씩: 처음 카드와 합칠 때마다의 카드 */
  function stepFigures(digits, steps) {
    const figures = [cardsFigure(startCards(digits), T.faces, T.solution.start)];
    steps.forEach((_, index) => figures.push(cardsFigure(replaySteps(digits, steps.slice(0, index + 1)).cards, T.faces, fill(T.solution.step, { no: ordinal(index + 1) }))));
    return figures;
  }

  /** 띠의 끝(풀이와 직접 만들기의 그림): 처음 막히는 수가 들어가는 열 칸씩 */
  const pictureTop = (missing) => Math.min(STRIP_CAP, Math.max(30, Math.ceil((missing + 1) / STRIP_STEP) * STRIP_STEP));
  const noneUpTo = (digits, top) => {
    const reach = new Set(wholeReach(digits, top));
    return Array.from({ length: top }, (_, index) => index + 1).filter((n) => !reach.has(n));
  };

  /** 풀이: 목표 수가 하나인 판은 카드를 한 장씩 합치는 차례, 여럿인 판은 목표 수마다 한 가지 식, 1부터 차례로는 띠와 수마다 한 가지 식 */
  function solutionPages(round, solution) {
    const { board } = round;
    const { digits } = board;
    if (!isRun(board)) {
      if (solution.targets.length === 1) {
        // 목표 수가 하나인 판은 카드를 한 장씩 합쳐 보인다
        const [entry] = solution.targets;
        return [{ say: entry.plain === 0 ? T.solution.fraction : T.solution.target, nodes: [rowOf(stepFigures(digits, stepsOf(digits, entry.tree)))] }];
      }
      const figures = solution.targets.map((entry) => cardsFigure([{ value: [entry.n, 1], tree: entry.tree }], T.faces, T.solution.way));
      return [{ say: T.solution.target, nodes: [rowOf(figures)] }];
    }
    const top = pictureTop(solution.missing);
    const list = listFigure(
      solution.entries.map((entry) => ({ n: entry.n, text: cardText(entry.tree, T.faces) })),
      null,
    );
    const strip = stripFigure({ top, made: wholeReach(digits, top), none: noneUpTo(digits, top) }, T.solution.strip);
    return [{ say: fill(T.solution.run, { k: solution.best, n: solution.missing }), nodes: [rowOf([strip, list])] }];
  }

  /** "왜 그럴까?"의 그림 하나: 카드(숫자와 합치기의 차례) 또는 띠 */
  function figureOf(item) {
    if (item.strip) return stripFigure({ top: item.top, made: wholeReach(item.strip, item.top), none: noneUpTo(item.strip, item.top) }, item.note);
    return cardsFigure(replaySteps(item.digits, item.steps).cards, T.faces, item.note);
  }

  /**
   * "왜 그럴까?": 1, 2, 3, 4로 29에서 막혔다 → 합치는 차례를 모두 세면 3888가지 → 모두 해 보니 29는 한 번도 안 나온다(띠)
   * → 분수를 거쳐야만 나오는 24 → 이름(식, 괄호)과 곱하기·나누기를 먼저 하는 약속.
   * 1부터 차례로 하는 판(만들 수 없는 수를 다루는 판)을 한 번 끝까지 한 뒤에 열린다(틀의 기본 문).
   */
  function whyPages() {
    return T.why.map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다
      get nodes() {
        return [rowOf(slide.figures.map(figureOf))];
      },
    }));
  }

  // ---- 직접 만들기: 숫자 카드 넷을 고른다 ----
  const draftOk = (digits) => Array.isArray(digits) && digits.length === 4 && digits.every((digit) => Number.isInteger(digit) && digit >= MIN_DIGIT && digit <= MAX_DIGIT);

  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    return saved && saved.kind === 'run' && draftOk(saved.digits) ? saved.digits.slice() : FIRST_DRAFT.slice();
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    made = null;
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function drawMake() {
    draft.forEach((digit, at) => {
      $(`fourdigits-make-d${at}`).textContent = fill(T.make.digit, { n: digit });
      $(`fourdigits-make-fewer-${at}`).disabled = digit <= MIN_DIGIT;
      $(`fourdigits-make-more-${at}`).disabled = digit >= MAX_DIGIT;
    });
    drawCards($('fourdigits-make-board'), { cards: startCards(draft), faces: T.faces });
    $('fourdigits-make-result').textContent = made ? made.line : '';
    $('fourdigits-make-picture').replaceChildren(...(made?.node ? [made.node] : []));
    $('fourdigits-make-play').disabled = madeBoard() === null;
  }

  /** 카드 하나의 숫자를 바꾼다 */
  function setDigit(at, digit) {
    if (digit < MIN_DIGIT || digit > MAX_DIGIT) return;
    // 선생님이 따진 뒤에 숫자를 바꾸면, 앞의 숫자에 한 말이 남지 않게 숫자가 바뀌었다는 사실만 말한다
    const said = made !== null;
    draft = draft.map((value, index) => (index === at ? digit : value));
    made = null;
    log.saveDraft({ kind: 'run', digits: draft }, FORMAT);
    drawMake();
    if (said) frame.talkers.make.say(T.make.changed);
  }

  /** 다 만든 판(공책에 남기거나 해 볼 판). 1도 만들 수 없는 숫자이면 null */
  function madeBoard() {
    if (!draft) return null;
    const board = { kind: 'run', digits: draft.slice() };
    return checkBoard(board) === null ? board : null;
  }

  /** 선생님이 따진다: 1부터 어디까지 차례로 되는지, 그 가운데 분수를 거쳐야만 나오는 수, 만들 수 없는 수의 띠 */
  function solveDraft() {
    const digits = draft.slice();
    const missing = firstMissing(digits);
    const best = missing - 1;
    let line;
    if (best === 0) line = T.make.none;
    else {
      const fractions = Array.from({ length: best }, (_, index) => index + 1).filter((n) => needsFraction(digits, n)).length;
      line = [fill(T.make.result, { k: best, n: missing }), fractions > 0 ? fill(T.make['fraction-some'], { f: fractions }) : T.make['fraction-none']].join(' ');
      if (best === FARTHEST.best) line = `${line} ${T.make.farthest}`;
    }
    const top = pictureTop(missing);
    made = { line, node: stripFigure({ top, made: wholeReach(digits, top), none: noneUpTo(digits, top) }, T.make.picture) };
    drawMake();
    const now = new Date().toISOString();
    log.saveRecord({
      kind: 'made',
      v: 1,
      id: log.newId('m'),
      format: FORMAT,
      startedAt: now,
      endedAt: now,
      board: { kind: 'run', digits },
      solution: { possible: false, orders: orderCount(4), best, missing },
    });
    log.flush();
    frame.talkers.make.say(line);
  }

  function playDraft() {
    const board = madeBoard();
    if (!board) {
      frame.talkers.make.say(T.make['keep-not-yet']);
      return;
    }
    frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board });
  }

  // ---- 단추 잇기 ----
  $('fourdigits-stop').addEventListener('click', stop);
  for (let at = 0; at < 4; at++) {
    $(`fourdigits-make-fewer-${at}`).addEventListener('click', () => setDigit(at, draft[at] - 1));
    $(`fourdigits-make-more-${at}`).addEventListener('click', () => setDigit(at, draft[at] + 1));
  }
  $('fourdigits-make-solve').addEventListener('click', solveDraft);
  $('fourdigits-make-play').addEventListener('click', playDraft);

  /** 판의 처음 값(새 판, 공책의 그림) */
  function begin({ level, custom, board }) {
    return {
      mode: custom ? 'made' : rungOf(level).mode,
      board: copyBoard(board), // 판: 숫자들과 목표 수들, 또는 1부터 차례로(src/core/fourdigits.js)
      steps: [], // 지금 카드에서 한 합치기들('0+2'는 0번 카드 + 2번 카드)
      made: [], // 만든 수와 그때의 합치기들 [{ n, steps }](만든 차례대로)
      picked: null, // 고른 카드의 번호
      op: null, // 고른 셈 기호
      combineCount: 0, // 합친 수(무른 것까지 모두)
      refuseCount: 0, // 작은 수에서 큰 수를 빼거나 0으로 나누려 한 수
      endCount: 0, // 카드가 한 장 남았는데 적을 수가 아니었던 수
      undoCount: 0,
      resetCount: 0,
      stopped: false, // "여기까지 할래요"로 끝냈는가
      wrongCount: 0, // 수준 맞추기가 보는 값: 1부터 차례로 하는 판을 끝까지 잇지 않고 끝냈으면 1
    };
  }

  /** 적어 둔 판의 단계가 판의 종류와 맞는가 */
  function levelOk(saved) {
    const { board } = saved;
    if (saved.custom === true) return saved.level === MAKE_LEVEL && saved.mode === 'made' && isRun(board) && board.digits.length === 4;
    if (!Number.isInteger(saved.level) || saved.level < LADDER[0].level || saved.level > TOP_LEVEL) return false;
    // 더 작은 판은 단계와 다른 종류의 판일 수 있다(네 개의 4의 작은 판은 목표 수 판)
    return rungOf(saved.level).mode === saved.mode;
  }

  function validSaved(saved) {
    if (!MODES.includes(saved.mode) || checkBoard(saved.board) !== null || !levelOk(saved)) return false;
    const { digits } = saved.board;
    if (!replaySteps(digits, saved.steps).ok) return false;
    if (!Array.isArray(saved.made)) return false;
    for (const item of saved.made) {
      const replayed = replaySteps(digits, item.steps);
      if (!replayed.ok || replayed.cards.length !== 1 || !isWhole(replayed.cards[0].value) || replayed.cards[0].value[0] !== item.n) return false;
    }
    const cards = replaySteps(digits, saved.steps).cards;
    if (!(saved.picked === null || (Number.isInteger(saved.picked) && saved.picked >= 0 && saved.picked < cards.length))) return false;
    if (!(saved.op === null || OPS.includes(saved.op))) return false;
    if (typeof saved.stopped !== 'boolean') return false;
    return [saved.combineCount, saved.refuseCount, saved.endCount, saved.undoCount, saved.resetCount, saved.wrongCount].every(count);
  }

  /** 작은 그림의 띠: 1부터 다섯 칸 */
  const SAMPLE_STRIP = 5;

  /** 작은 그림: 목표 수(1부터 차례로는 1부터 다섯 칸의 띠)와 숫자 카드를 한 줄로 */
  function drawSample(root, board) {
    const box = document.createElement('div');
    box.className = 'nf-sample';
    const hand = document.createElement('div');
    drawCards(hand, { cards: startCards(board.digits), faces: T.faces, small: true });
    const goal = document.createElement('div');
    if (isRun(board)) drawStrip(goal, { top: SAMPLE_STRIP, small: true });
    else drawTargets(goal, { targets: board.targets.map((n) => ({ n, text: null })), small: true });
    box.append(goal, hand);
    root.replaceChildren(box);
  }

  /** 하던 판과 공책의 그림: 지금 카드와 만든 수 */
  function drawResume(root, saved) {
    const { board } = saved;
    const replayed = replaySteps(board.digits, saved.steps ?? []);
    if (!replayed.ok || !Array.isArray(saved.made)) {
      drawSample(root, board);
      return;
    }
    const numbers = saved.made.map((item) => item.n);
    const box = document.createElement('div');
    box.className = 'nf-sample';
    const goal = document.createElement('div');
    if (isRun(board)) {
      // 1부터 차례로 만든 끝과 그다음 칸까지(다섯 칸에서 열 칸, 한 줄)
      drawStrip(goal, { top: Math.min(STRIP_STEP, Math.max(SAMPLE_STRIP, runOf(numbers) + 1)), made: numbers, small: true });
    } else drawTargets(goal, { targets: board.targets.map((n) => ({ n, text: numbers.includes(n) ? '' : null })), small: true });
    const hand = document.createElement('div');
    drawCards(hand, { cards: replayed.cards, faces: T.faces, small: true });
    box.append(goal, hand);
    root.replaceChildren(box);
  }

  return {
    id: FORMAT,
    T,
    padId: 'fourdigits-pad',
    makeId: 'make-fourdigits',
    // 규칙 글이 네 줄이고 판(띠, 카드, 기호)이 위아래로 길다. 규칙 글은 왼쪽 칸 맨 위에 두고 판을 크게 그린다
    ruleAside: true,
    homeIds: { sample: 'home-fourdigits-sample', blank: 'home-fourdigits-blank', ask: 'home-fourdigits-ask', play: 'home-fourdigits-play', pick: 'home-fourdigits-pick', make: 'home-fourdigits-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    begin,
    solve: (round) => solve(round.board),
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      try {
        return validSaved(saved);
      } catch {
        return false;
      }
    },
    /** 판 화면에서 이 형식의 것(판, 판 아래의 글)을 보이거나 감춘다 */
    showParts(on) {
      $('fourdigits-board').hidden = !on;
      $('fourdigits-count').hidden = !on;
      if (on) {
        // 앞의 형식이 감춰 둔 무르기와 되돌리기를 여기서 다시 보이게 한다.
        $('undo').hidden = false;
        $('reset').hidden = false;
      }
    },
    enter() {
      flash = null;
      fresh = null;
    },
    draw,
    ended() {
      flash = null;
      fresh = null;
    },
    ruleLine: (round) => T.rules[ruleKey(round)],
    hints: (round) => T.hints[ruleKey(round)],
    touched: (round) => round.combineCount > 0 || round.refuseCount > 0 || round.made.length > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view(round) {
      return { steps: round.steps.slice(), cards: cardsOf(round).map((card) => `${card.value[0]}/${card.value[1]}`), made: madeNumbers(round), picked: round.picked, op: round.op };
    },
    /** 이 판보다 작은 판: 숫자 카드를 하나 뺀 판 */
    smaller: (round, turn) => smallerFourdigits({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      const numbers = madeNumbers(round);
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        solution: { possible: solution.possible, orders: solution.orders, best: solution.best ?? null, missing: solution.missing ?? null, ways: solution.targets ? solution.targets.map((entry) => entry.ways) : null },
        hintsOpened: round.hintsOpened,
        // 판을 떠날 때의 모습: 지금 카드의 합치기, 만든 수와 식, 1부터 차례로 만든 끝 수
        steps: round.steps,
        made: round.made.map((item) => ({ n: item.n, steps: item.steps, text: madeText(round, item) })),
        run: isRun(round.board) ? runOf(numbers) : null,
        reachedBest: isRun(round.board) && runOf(numbers) === solution.best,
        stopped: round.stopped,
        combineCount: round.combineCount,
        refuseCount: round.refuseCount,
        endCount: round.endCount,
        undoCount: round.undoCount,
        resetCount: round.resetCount,
        // 수준 맞추기가 보는 "틀린 답"의 수
        wrongCount: round.wrongCount,
      };
    },
    rightLine,
    whyPages,
    solutionPages,
    undo,
    reset,
    /** 글자판: 카드와 기호는 단추라서 저마다 Enter와 빈칸 글쇠로 누른다. Escape는 고른 카드를 내려놓는다 */
    onKey(event) {
      const { round } = frame;
      if (!round || $('fourdigits-pad').hidden || round.done || event.key !== 'Escape' || round.picked === null) return;
      round.picked = null;
      round.op = null;
      draw();
    },

    // ---- 처음 화면에 그리는 그림 ----
    homeAsk: (level) => T.home.ask[rungOf(level).mode],
    pickLine: () => T.home.pick,
    drawSample,
    drawBlank(root) {
      drawCards(root, { cards: startCards(BLANK), faces: T.faces, small: true });
    },
    drawResume,
    /** 판 고르기의 그림: 단계마다 그 단계의 판 하나 */
    drawLevelPicture(root, entry) {
      if (entry.picture.blank) {
        drawCards(root, { cards: startCards(BLANK), faces: T.faces, small: true });
        return;
      }
      drawSample(root, generateBoard(entry.level, entry.picture.seed).board);
    },
    showMake,
    /** 직접 만들기에서 다 만든 판(공책에 남기기가 쓴다) */
    madeBoard,
    /** 가장 좋은 기록(공책에 저절로 남는다): 1부터 차례로 하는 판에서 1부터 몇까지 차례로 만들었는가. 1을 만들지 않았으면 null */
    bestOf(round) {
      if (!isRun(round.board)) return null;
      const run = runOf(madeNumbers(round));
      return run === 0 ? null : { value: run, name: fill(T.notebook.best, { k: run }) };
    },
  };
}
