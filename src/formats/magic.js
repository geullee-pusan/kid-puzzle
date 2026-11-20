// 마법 네모와 겹친 칸: 판 화면에서 이 형식이 맡는 부분(판, 카드 놓기, 답하는 칸, 끝났을 때 하는 말, 풀이와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/magic.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 판의 종류(mode)
//   sure   늘 되는 판(1~3단계). 카드를 모두 놓아 줄의 합이 모두 같아지면 끝난다
//   mixed  안 되는 판이 섞인다(4, 5단계, 직접 만든 판). 안 되는 판은 "불가능해요"로 답한다
// 카드는 끌어다 놓거나, 눌러 고른 뒤 칸을 눌러 놓는다. 놓인 카드끼리 자리를 바꿀 수 있고, 카드 자리로 돌려놓을 수도 있다.
// 줄마다 놓인 카드의 합을 줄 끝에 그대로 적는다(셈은 판이 한다. 생각할 것은 짝과 가운데 칸이다).
// 카드를 다 놓았는데 합이 다른 줄이 있으면 그 사실(합이 같은 줄의 수)만 말한다. 같은 모습을 다시 놓으면 그렇다고 말한다.
// 되는 판에 "불가능해요"를 누르면 틀렸다고 하지 않는다. 되는 방법이 있다는 사실만 말하고 판은 그대로 이어진다.
// 왼쪽 칸의 "몇 번 세어지는지 보기"는 칸마다 그 칸을 지나는 줄의 수만큼 점을 찍는 도구다(처음 켤 때 힌트 하나로 센다).
import T from '../content/magic.json';
import { smallerMagic } from '../core/smaller.js';
import { endsClosed, fill, ordinal } from '../core/text.js';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf } from '../core/magic-ladder.js';
import { centerOf, checkBoard, copyBoard, isDone, lineSums, linesOf, placedOk, sizeOf, solve, trayOf } from '../core/magic.js';
import { boardCard, drawBoard, drawMini, drawPicker } from '../ui/magic-board.js';

const FORMAT = 'magic';
const MODES = ['sure', 'mixed'];
/** 기록에 남기는 무르기 차례와 모두 놓아 본 모습의 수의 위 끝 */
const MAX_MOVES = 300;
const MAX_TRIES = 200;
/** 직접 만들기에서 고를 수 있는 가장 큰 카드 */
const MAKE_LAST = 20;
/** 직접 만들기의 판 모양 */
const FIGURES = ['square', 'arms2', 'arms3', 'arms4'];
/** 직접 만들기에서 그려 보이는 합의 수의 위 끝 */
const MAKE_SHOWN = 4;
const ONE_TO_NINE = '1,2,3,4,5,6,7,8,9';

/** 수 뒤에 붙는 말: 받침이 있으면 -closed, 없으면 -open */
const pick = (group, key, number) => group[`${key}-${endsClosed(number) ? 'closed' : 'open'}`];

/** 판의 종류의 이름(규칙 글과 힌트를 고른다) */
function kindOf(board) {
  if (board.shape === 'hub') return 'hub';
  if (board.lines !== 'all') return board.lines;
  return board.cards.join(',') === ONE_TO_NINE ? 'all' : 'sets';
}

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createMagic(frame) {
  const { $, log } = frame;
  let choice = null; // 고른 것: { card }(놓지 않은 카드) | { cell }(놓인 칸)
  let flash = null; // 판 아래에 잠깐 적는 한 줄. 다음에 무엇을 누르면 지운다
  let draft = null; // 직접 만들기에서 정하던 것 { figure, cards }
  let made = null; // 직접 만들기에서 선생님이 따진 것(정한 것이 바뀌면 지운다)

  const count = (value) => Number.isInteger(value) && value >= 0;
  const hasImpossible = (round) => round.mode === 'mixed';
  const placedKey = (placed) => placed.join(',');

  // ---- 읽어 주는 이름 ----
  function labelsFor(board) {
    const center = centerOf(board);
    const face = (card) => (card === null ? T.labels.empty : fill(T.labels.card, { k: card }));
    return {
      board: fill(T.labels.board, { n: sizeOf(board), total: linesOf(board).length }),
      cell: (cell, card, picked) => {
        const name = cell === center ? fill(T.labels.center, { face: face(card) }) : fill(T.labels.cell, { no: ordinal(cell + 1), face: face(card) });
        return picked ? fill(T.labels.picked, { face: name }) : name;
      },
      card: (card, picked) => (picked ? fill(T.labels.picked, { face: fill(T.labels.loose, { k: card }) }) : fill(T.labels.loose, { k: card })),
      slot: T.labels.slot,
    };
  }

  // ---- 판 ----
  function draw() {
    const { round } = frame;
    const { board } = round;
    const playing = !round.done;
    drawBoard($('magic-board'), {
      board,
      placed: round.placed,
      pick: playing ? choice : null,
      dots: round.dotsOn,
      tray: true,
      labels: labelsFor(board),
      onCard: playing ? tapCard : undefined,
      onCell: playing ? tapCell : undefined,
      onTray: playing ? tapTray : undefined,
      onDrop: playing ? drop : undefined,
    });
    $('magic-status').textContent = flash ?? statusOf(round, playing);
    $('magic-target').hidden = board.target === null;
    $('magic-target').textContent = board.target === null ? '' : fill(T.labels.target, { k: board.target });
    $('magic-maybe').hidden = !hasImpossible(round);
    $('magic-impossible').disabled = !playing;
    $('magic-dots').setAttribute('aria-pressed', String(round.dotsOn));
    $('undo').disabled = !playing || round.moves.length === 0;
    $('reset').disabled = !playing || round.placed.every((card) => card === null);
    frame.showWhy();
  }

  function statusOf(round, playing) {
    if (!playing) return isDone(round.board, round.placed) ? T.status.done : '';
    if (choice?.card !== undefined) return T.status.picked;
    if (choice?.cell !== undefined) return T.status['picked-cell'];
    const left = round.placed.filter((card) => card === null).length;
    if (left === sizeOf(round.board)) return T.status.empty;
    if (left > 0) return fill(T.status.left, { n: left });
    return round.board.target === null ? T.status.unequal : fill(T.status.off, { k: round.board.target });
  }

  // ---- 카드 놓기 ----
  /** 놓인 모습을 바꾼다. 다 찼으면 견주어 본다 */
  function change(next, how) {
    const { round } = frame;
    choice = null;
    flash = null;
    if (placedKey(next) === placedKey(round.placed)) {
      draw();
      return;
    }
    round.moves = [...round.moves, round.placed.slice()].slice(-MAX_MOVES);
    round.placed = next;
    round.moveCount += 1;
    if (how === 'drag') round.dragCount += 1;
    else round.tapCount += 1;
    frame.note('place', { how, placed: next.slice() });
    if (next.every((card) => card !== null)) {
      judge();
      return;
    }
    draw();
    frame.persist();
  }

  /** 카드 한 장을 칸에 놓는다(그 칸의 카드는 카드 자리로 돌아간다). 놓인 칸에서 왔으면 두 칸의 카드를 맞바꾼다 */
  function moved(from, to) {
    const { placed } = frame.round;
    const next = placed.slice();
    if (from.card !== undefined) {
      const at = next.indexOf(from.card);
      if (at >= 0) next[at] = null;
      next[to] = from.card;
      return next;
    }
    if (to === 'tray') {
      next[from.cell] = null;
      return next;
    }
    [next[from.cell], next[to]] = [placed[to], placed[from.cell]];
    return next;
  }

  /** 놓지 않은 카드를 눌렀다: 고르거나(다시 누르면 내려놓기), 고른 칸이 있으면 그 칸의 카드와 바꾼다 */
  function tapCard(card) {
    const { round } = frame;
    if (!round || round.done) return;
    flash = null;
    if (choice?.cell !== undefined) {
      change(moved({ card }, choice.cell), 'tap');
      return;
    }
    choice = choice?.card === card ? null : { card };
    draw();
  }

  /** 칸을 눌렀다: 고른 카드를 놓거나, 고른 칸과 맞바꾸거나, 그 칸의 카드를 고른다 */
  function tapCell(cell) {
    const { round } = frame;
    if (!round || round.done) return;
    flash = null;
    if (choice?.card !== undefined) {
      change(moved(choice, cell), 'tap');
      return;
    }
    if (choice?.cell !== undefined) {
      if (choice.cell === cell) {
        choice = null;
        draw();
        return;
      }
      change(moved(choice, cell), 'tap');
      return;
    }
    if (round.placed[cell] === null) {
      flash = T.status.empty;
      draw();
      frame.say(T.play['pick-first']);
      return;
    }
    choice = { cell };
    draw();
  }

  /** 빈 카드 자리를 눌렀다: 고른 칸의 카드를 돌려놓는다 */
  function tapTray() {
    const { round } = frame;
    if (!round || round.done) return;
    if (choice?.cell !== undefined) {
      change(moved(choice, 'tray'), 'tap');
      return;
    }
    choice = null;
    draw();
  }

  /** 끌어서 떼었다 */
  function drop(from, to) {
    const { round } = frame;
    if (!round || round.done) return;
    // 제자리에 떼었거나, 놓지 않은 카드를 카드 자리에 떼었으면 바뀌는 것이 없다
    if ((from.cell !== undefined && to === from.cell) || (from.card !== undefined && to === 'tray')) {
      choice = null;
      draw();
      return;
    }
    if (from.card === undefined && from.cell === undefined) return;
    change(moved(from, to), 'drag');
  }

  /** 카드를 모두 놓았다: 줄의 합이 모두 같으면 끝, 아니면 합이 같은 줄의 수를 말한다 */
  function judge() {
    const { round } = frame;
    const { board, placed } = round;
    if (isDone(board, placed)) {
      round.answers.push({ t: frame.stamp(), answer: `place:${placedKey(placed)}`, correct: true, guess: null });
      frame.note('answer', { answer: 'done', correct: true });
      frame.finish('solved');
      return;
    }
    const key = placedKey(placed);
    const again = round.tries.includes(key);
    round.fullCount += 1;
    if (!again) round.tries = [...round.tries, key].slice(-MAX_TRIES);
    frame.note('full', { again });
    draw();
    frame.persist();
    if (again) {
      frame.say(T.play['same-again']);
      return;
    }
    const sums = lineSums(board, placed).map((line) => line.sum);
    if (board.target !== null) {
      const hit = sums.filter((value) => value === board.target).length;
      frame.say(hit === 0 ? fill(T.play['off-none'], { k: board.target }) : fill(T.play.off, { total: sums.length, k: board.target, n: hit }));
      return;
    }
    const tally = new Map();
    for (const value of sums) tally.set(value, (tally.get(value) ?? 0) + 1);
    const most = Math.max(...tally.values());
    frame.say(most < 2 ? T.play['unequal-none'] : fill(T.play.unequal, { total: sums.length, n: most }));
  }

  /** "불가능해요" */
  function pressImpossible() {
    const { round, solution } = frame;
    if (!round || round.done || !hasImpossible(round)) return;
    choice = null;
    flash = null;
    const correct = solution.possible === false;
    const guess = correct ? null : 'impossible-on-possible';
    round.answers.push({ t: frame.stamp(), answer: 'impossible', correct, guess });
    frame.note('answer', { answer: 'impossible', correct, guess });
    if (correct) {
      frame.finish('solved');
      return;
    }
    // 되는 판이다. 틀렸다고 하지 않고 사실만 말한다. 판은 그대로 이어진다.
    round.impossibleCount += 1;
    round.wrongCount += 1;
    frame.persist();
    draw();
    frame.say(round.tries.length === 0 ? T.play['possible-press'] : fill(T.play['possible-press-tried'], { n: round.tries.length }));
  }

  function undo() {
    const { round } = frame;
    if (round.done || round.moves.length === 0) return;
    round.placed = round.moves.at(-1).slice();
    round.moves = round.moves.slice(0, -1);
    round.undoCount += 1;
    choice = null;
    flash = null;
    frame.note('undo');
    draw();
    frame.persist();
  }

  /** 처음으로: 카드를 모두 카드 자리로 돌려놓는다. 무르기로 돌아올 수 있다 */
  function reset() {
    const { round } = frame;
    if (round.done || round.placed.every((card) => card === null)) return;
    round.moves = [...round.moves, round.placed.slice()].slice(-MAX_MOVES);
    round.placed = round.placed.map(() => null);
    round.resetCount += 1;
    choice = null;
    flash = null;
    frame.note('reset');
    draw();
    frame.persist();
  }

  /** 왼쪽 칸의 도구: 칸마다 지나는 줄의 수만큼 점을 찍는다. 처음 켤 때 힌트 하나로 센다 */
  function toggleDots() {
    const { round } = frame;
    if (!round) return;
    round.dotsOn = !round.dotsOn;
    if (round.dotsOn) {
      round.dotsShown = true;
      round.dotsCount += 1;
    }
    frame.note('dots', { on: round.dotsOn });
    draw();
    frame.keep();
  }

  // ---- 끝났을 때 하는 말: 한 일을 그대로 말한다 ----
  function rightLine(round, solution) {
    const parts = [];
    const last = round.answers.at(-1);
    if (last?.answer === 'impossible') {
      parts.push(round.tries.length > 0 ? fill(T.right['impossible-tried'], { n: round.tries.length }) : T.right['impossible-untried']);
      return parts;
    }
    const { board, placed } = round;
    const sums = lineSums(board, placed);
    const value = sums[0].sum;
    parts.push(fill(pick(T.right, 'lines', value), { n: sums.length, k: value }));
    const center = centerOf(board);
    if (center !== null && (board.shape === 'hub' || board.lines === 'all' || board.lines === 'center')) parts.push(fill(pick(T.right, 'center', placed[center]), { k: placed[center] }));
    parts.push(fill(T.right.ways, { total: solution.count }));
    if (round.impossibleCount > 0) parts.push(T.right['after-press']);
    return parts;
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----
  function rowOf(cards) {
    const row = document.createElement('div');
    row.className = 'figure-row';
    row.append(...cards);
    return row;
  }

  /** "왜 그럴까?" 그림의 판 */
  function figureBoard(item) {
    if (item.arms) return { shape: 'hub', arms: item.arms, cards: Array.from({ length: 1 + 2 * item.arms }, (_, index) => index + 1), target: item.target ?? null };
    return { shape: 'grid', w: 3, h: 3, lines: item.lines, cards: [1, 2, 3, 4, 5, 6, 7, 8, 9], target: null };
  }

  /** "왜 그럴까?": 네모 판은 가운데가 왜 그 수인지, 겹친 칸 판은 가운데 카드가 여러 번 세어지는 이야기 */
  function whyPages(round) {
    const story = round.board.shape === 'hub' ? T.why.hub : T.why.grid;
    return story.map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다
      get nodes() {
        return [rowOf(slide.figures.map((item) => boardCard({ board: figureBoard(item), placed: item.cells, dots: item.dots === true }, item.note, { big: slide.figures.length === 1 })))];
      },
    }));
  }

  /** 안 되는 까닭을 말로(문장 몇 개) */
  function reasonLines(board, why) {
    const R = T.reason;
    const times = (value) => T.times[String(value)];
    const lines = [];
    const need = () => lines.push(fill(pick(R, 'center-need', why.center), { k: why.center }), R['center-missing']);
    const pairs = () => lines.push(fill(pick(R, 'pairs', why.pair), { k: why.pair }), fill(R.lonely, { k: why.card }));
    if (board.shape === 'grid') {
      if (why.reason === 'big') lines.push(fill(pick(R, 'big', why.low), { k: why.card, n: why.low }), R['big-rest']);
      else if (why.reason === 'split') lines.push(fill(pick(R, 'total', why.total), { total: why.total }), fill(R.split, { n: why.rows }));
      else if (why.reason === 'center-part') lines.push(fill(pick(R, 'line', why.line), { k: why.line }), R['center-part']);
      else if (why.reason === 'center-missing') {
        lines.push(fill(pick(R, 'line', why.line), { k: why.line }));
        need();
      } else if (why.reason === 'pairs') {
        lines.push(fill(pick(R, 'center-need', why.center), { k: why.center }));
        pairs();
      } else if (why.reason === 'pairs-all') lines.push(R['pairs-all']);
      else lines.push(R.search);
      return lines;
    }
    if (why.reason === 'big') return [fill(pick(R, 'hub-big', why.high), { n: why.high })];
    if (why.reason === 'small') return [fill(pick(R, 'hub-small', why.least), { n: why.least })];
    if (why.reason === 'pairs-all') return [R['pairs-all']];
    if (why.reason === 'search') return [R.search];
    lines.push(fill(R['hub-count'], { n: board.arms, no: times(board.arms) }), fill(pick(R, 'hub-extra', why.extra), { f: times(why.times), k: why.extra }));
    if (why.reason === 'center-part') lines.push(fill(R['hub-part'], { f: times(why.times) }));
    else if (why.reason === 'center-missing') need();
    else {
      lines.push(fill(pick(R, 'center-need', why.center), { k: why.center }));
      pairs();
    }
    return lines;
  }

  /** 풀이: 되는 판은 놓는 방법 하나, 안 되는 판은 까닭(가운데 이야기면 점을 찍은 판) */
  function solutionPages(round, solution) {
    const { board } = round;
    if (solution.possible) {
      const value = solution.sums[0].sum;
      const say = fill(pick(T.solution, 'possible', value), { k: value, total: solution.count });
      return [{ say, nodes: [rowOf([boardCard({ board, placed: solution.example }, '', { big: true })])] }];
    }
    const say = [T.solution.impossible, ...reasonLines(board, solution.why)].join(' ');
    const dots = !['big', 'small', 'split', 'search'].includes(solution.why.reason);
    return [{ say, nodes: [rowOf([boardCard({ board, placed: Array(sizeOf(board)).fill(null), dots }, '', { big: true })])] }];
  }

  // ---- 직접 만들기: 판 모양과 카드를 고른다 ----
  const needOf = (figure) => (figure === 'square' ? 9 : 1 + 2 * Number(figure.slice(4)));
  const draftOk = (saved) =>
    Boolean(saved) && FIGURES.includes(saved.figure) && Array.isArray(saved.cards) && saved.cards.every((card) => Number.isInteger(card) && card >= 1 && card <= MAKE_LAST) && new Set(saved.cards).size === saved.cards.length;

  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    if (draftOk(saved)) return { figure: saved.figure, cards: saved.cards.slice().sort((a, b) => a - b) };
    return { figure: 'arms3', cards: [1, 2, 3, 4, 5, 6, 7] };
  }

  /** 정한 것으로 만든 판. 카드 수가 판의 칸 수와 맞지 않으면 null */
  function draftBoard() {
    if (!draft || draft.cards.length !== needOf(draft.figure)) return null;
    const cards = draft.cards.slice().sort((a, b) => a - b);
    const board = draft.figure === 'square' ? { shape: 'grid', w: 3, h: 3, lines: 'all', cards, target: null } : { shape: 'hub', arms: Number(draft.figure.slice(4)), cards, target: null };
    return checkBoard(board) === null ? board : null;
  }

  /** 모양만 보이는 판(카드 수가 모자라도 그린다) */
  function shapeBoard() {
    const n = needOf(draft.figure);
    const cards = Array.from({ length: n }, (_, index) => index + 1);
    return draft.figure === 'square' ? { shape: 'grid', w: 3, h: 3, lines: 'all', cards, target: null } : { shape: 'hub', arms: Number(draft.figure.slice(4)), cards, target: null };
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    made = null;
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function drawMake() {
    for (const button of $('magic-make-shapes').querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.figure === draft.figure));
    $('magic-make-count').textContent = fill(T.make.count, { k: draft.cards.length, n: needOf(draft.figure) });
    $('magic-make-clear').disabled = draft.cards.length === 0;
    drawMini($('magic-make-shape'), shapeBoard());
    drawPicker($('magic-make-board'), {
      last: MAKE_LAST,
      chosen: draft.cards,
      label: (card, on) => fill(T.labels[on ? 'pick-on' : 'pick-off'], { k: card }),
      onTap: toggleCard,
    });
    $('magic-make-result').textContent = made ? made.line : '';
    $('magic-make-picture').replaceChildren(...(made ? made.cards : []));
  }

  function changeDraft(next) {
    draft = next;
    made = null;
    log.saveDraft({ figure: draft.figure, cards: draft.cards }, FORMAT);
    drawMake();
  }

  function toggleCard(card) {
    const cards = draft.cards.includes(card) ? draft.cards.filter((item) => item !== card) : [...draft.cards, card].sort((a, b) => a - b);
    changeDraft({ ...draft, cards });
  }

  /** 선생님이 따진다: 마법 네모는 되는지와 줄의 합, 겹친 칸은 같게 할 수 있는 합마다 놓는 방법 하나 */
  function solveDraft() {
    const board = draftBoard();
    if (!board) {
      made = { line: fill(T.make.need, { n: needOf(draft.figure), k: draft.cards.length }), cards: [] };
      drawMake();
      frame.talkers.make.say(made.line);
      return;
    }
    const result = solve(board);
    let line;
    let cards = [];
    if (board.shape === 'grid') {
      if (result.possible) {
        const value = result.sums[0].sum;
        const center = result.sums[0].centers[0];
        line = [fill(T.make.square, { k: value, total: result.count }), fill(pick(T.right, 'center', center), { k: center })].join(' ');
        cards = [boardCard({ board, placed: result.example }, '')];
      } else {
        line = [T.make['square-no'], ...reasonLines(board, result.why)].join(' ');
      }
    } else if (result.possible) {
      // 되는 합마다 가운데 카드는 하나로 정해진다(두 번 세기). 합과 가운데 카드를 차례로 말한다
      const sums = result.sums.map((item) => item.sum);
      const centers = result.sums.map((item) => item.centers[0]);
      const list = (values) => values.join(', ');
      const head = sums.length === 1 ? T.make['hub-one'] : fill(T.make.hub, { n: sums.length });
      const middle = sums.length === 1 ? fill(pick(T.right, 'center', centers[0]), { k: centers[0] }) : fill(pick(T.make, 'centers', centers.at(-1)), { face: list(centers) });
      line = [head, fill(pick(T.make, 'sums', sums.at(-1)), { face: list(sums) }), middle].join(' ');
      cards = result.sums.slice(0, MAKE_SHOWN).map((item) => boardCard({ board: { ...board, target: item.sum }, placed: item.example }, fill(pick(T.make, 'line', item.sum), { k: item.sum })));
    } else {
      line = T.make['hub-no'];
    }
    made = { line, cards };
    drawMake();
    const now = new Date().toISOString();
    log.saveRecord({
      kind: 'made',
      v: 1,
      id: log.newId('m'),
      format: FORMAT,
      startedAt: now,
      endedAt: now,
      board,
      solution: { possible: result.possible, count: result.count, sums: result.sums.map((item) => ({ sum: item.sum, count: item.count, centers: item.centers })), why: result.why },
    });
    log.flush();
    frame.talkers.make.say(line);
  }

  /** 다 만든 판(공책에 남기거나 해 볼 판). 카드 수가 판의 칸 수와 맞아야 한다. 아니면 null */
  const madeBoard = () => draftBoard();

  function playDraft() {
    const board = madeBoard();
    if (board) frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board });
    else frame.talkers.make.say(T.make['keep-not-yet']);
  }

  // ---- 단추 잇기 ----
  $('magic-impossible').addEventListener('click', pressImpossible);
  $('magic-dots').addEventListener('click', toggleDots);
  $('magic-make-shapes').addEventListener('click', (event) => {
    const figure = event.target.closest('button')?.dataset.figure;
    if (FIGURES.includes(figure)) changeDraft({ ...draft, figure });
  });
  $('magic-make-run').addEventListener('click', () => changeDraft({ ...draft, cards: Array.from({ length: needOf(draft.figure) }, (_, index) => index + 1) }));
  $('magic-make-clear').addEventListener('click', () => changeDraft({ ...draft, cards: [] }));
  $('magic-make-solve').addEventListener('click', solveDraft);
  $('magic-make-play').addEventListener('click', playDraft);

  /** 아직 정하지 않은 빈 판(만들기 목록, 판 고르기의 직접 만들기): 세 줄이 만나는 판 */
  function drawBlank(root) {
    drawMini(root, { shape: 'hub', arms: T.blank.arms, cards: Array.from({ length: 1 + 2 * T.blank.arms }, (_, index) => index + 1), target: null });
  }

  /** 판의 처음 값(새 판, 공책의 그림) */
  function begin({ level, custom, board }) {
    const start = copyBoard(board);
    return {
      mode: custom || rungOf(level).pool ? 'mixed' : 'sure',
      board: start, // 판: 모양, 줄, 카드, 맞출 합
      placed: Array(sizeOf(start)).fill(null), // 칸마다 놓인 카드(빈칸은 null)
      moves: [], // 무르기에 쓰는 차례: 그 전의 놓인 모습
      tries: [], // 카드를 모두 놓아 본 모습(같은 모습은 한 번)
      dotsOn: false, // 지금 칸마다 점을 찍고 있는가
      dotsShown: false, // 점을 한 번이라도 켰는가
      dotsCount: 0, // 점을 켠 수
      moveCount: 0, // 카드를 놓거나 옮기거나 돌려놓은 수
      dragCount: 0, // 그 가운데 끌어서 한 것
      tapCount: 0, // 그 가운데 눌러서 한 것
      fullCount: 0, // 카드를 모두 놓았는데 합이 다른 줄이 있던 수
      undoCount: 0,
      resetCount: 0,
      impossibleCount: 0, // 되는 판에 "불가능해요"를 누른 수
      wrongCount: 0, // 사실과 다른 답의 수(되는 판의 "불가능해요")
    };
  }

  return {
    id: FORMAT,
    T,
    padId: 'magic-pad',
    makeId: 'make-magic',
    // 판 옆에 카드 자리가 있어 판이 넓다. 규칙 글은 왼쪽 칸 맨 위에 두고 판을 크게 그린다.
    ruleAside: true,
    homeIds: { sample: 'home-magic-sample', blank: 'home-magic-blank', ask: 'home-magic-ask', play: 'home-magic-play', pick: 'home-magic-pick', make: 'home-magic-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    begin,
    solve: (round) => solve(round.board),
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (!MODES.includes(saved.mode) || checkBoard(saved.board) !== null) return false;
      if (!placedOk(saved.board, saved.placed) || !Array.isArray(saved.moves) || !saved.moves.every((item) => placedOk(saved.board, item))) return false;
      if (!Array.isArray(saved.tries) || !saved.tries.every((item) => typeof item === 'string')) return false;
      if (typeof saved.dotsOn !== 'boolean' || typeof saved.dotsShown !== 'boolean') return false;
      return [saved.dotsCount, saved.moveCount, saved.dragCount, saved.tapCount, saved.fullCount, saved.undoCount, saved.resetCount, saved.impossibleCount, saved.wrongCount].every(count);
    },
    /** 판 화면에서 이 형식의 것(판, 판 아래의 글, 왼쪽 칸의 도구)을 보이거나 감춘다 */
    showParts(on) {
      $('magic-board').hidden = !on;
      $('magic-count').hidden = !on;
      $('magic-dots').hidden = !on;
      if (on) {
        // 앞의 형식이 감춰 둔 무르기와 되돌리기를 여기서 다시 보이게 한다.
        $('undo').hidden = false;
        $('reset').hidden = false;
      }
    },
    enter() {
      choice = null;
      flash = null;
    },
    draw,
    ended() {
      choice = null;
      flash = null;
    },
    ruleLine(round) {
      const { board } = round;
      const kind = kindOf(board);
      const key = kind === 'sets' ? 'all' : kind === 'hub' && board.target === null ? 'hub-free' : kind;
      const line = fill(T.rules[key], { n: linesOf(board).length, k: board.target ?? 0 });
      return hasImpossible(round) ? `${line} ${T.rules.maybe}` : line;
    },
    hints: (round) => T.hints[kindOf(round.board)],
    touched: (round) => round.moveCount > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view: (round) => ({ placed: round.placed.slice(), left: trayOf(round.board, round.placed).length, tries: round.tries.length, dots: round.dotsOn }),
    /** 이 판보다 작은 판: 줄이나 카드가 적은 판 */
    smaller: (round, turn) => smallerMagic({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        solution: { possible: solution.possible, count: solution.count, sums: solution.sums.map((item) => ({ sum: item.sum, count: item.count, centers: item.centers })), why: solution.why },
        // 질문 힌트와 "몇 번 세어지는지 보기"를 함께 센다.
        hintsOpened: round.hintsOpened + (round.dotsShown ? 1 : 0),
        dotsShown: round.dotsShown,
        dotsCount: round.dotsCount,
        // 판을 떠날 때 놓인 카드, 카드를 모두 놓아 본 모습들
        placed: round.placed,
        tries: round.tries,
        moveCount: round.moveCount,
        dragCount: round.dragCount,
        tapCount: round.tapCount,
        fullCount: round.fullCount,
        undoCount: round.undoCount,
        resetCount: round.resetCount,
        impossibleCount: round.impossibleCount,
        // 수준 맞추기가 보는 "틀린 답"의 수
        wrongCount: round.wrongCount,
      };
    },
    rightLine,
    whyPages,
    solutionPages,
    undo,
    reset,
    onKey() {},

    // ---- 처음 화면에 그리는 그림 ----
    homeAsk: (level) => T.home.ask[String(level)],
    pickLine: () => T.home.pick,
    /** 처음 화면의 그림: 빈 판과 옆에 놓을 카드(수 카드를 놓는 판인 것이 보이게) */
    drawSample(root, board) {
      drawMini(root, board, undefined, { tray: true });
    },
    drawBlank,
    /** 하던 판과 공책의 그림: 놓인 카드와 줄의 합, 아직 놓지 않은 카드까지 */
    drawResume(root, saved) {
      drawMini(root, saved.board, Array.isArray(saved.placed) ? saved.placed : undefined, { tray: true });
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 판 하나 */
    drawLevelPicture(root, entry) {
      if (entry.picture.blank) {
        drawBlank(root);
        return;
      }
      drawMini(root, generateBoard(entry.level, entry.picture.seed).board);
    },
    showMake,
    /** 직접 만들기에서 정한 판. 카드 수가 판의 칸 수와 맞아야 한다(공책에 남기기가 쓴다) */
    madeBoard,
  };
}
