// 눈대중: 판 화면에서 이 형식이 맡는 부분(판, 답하는 칸, 끝났을 때 하는 말, 풀이와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/eyeball.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 판의 종류(mode)는 판이 정한다(5단계는 판 번호마다 바뀐다).
//   area   얼룩 넓이 어림: 수를 넣고 "세어 보기"를 누르면 센 칸에 점이 찍히고 판이 끝난다(눈의 실험이라 틀린 답이 없다)
//   cover  직사각형으로 덮기: 점이 찍힌 칸을 모두 덮을 때마다 얼룩이 아닌 칸을 몇 칸 덮었는지 말한다.
//          가장 적게 덮으면 저절로 끝나고, 아니면 더 적게 덮을 수 있을지 묻는다. "여기까지 할래요"로 끝내도 된다
//   line   수직선에 찍기: 선을 눌러 찍고 "여기예요"를 누르면 진짜 자리가 보인다. 찍을 수를 모두 열면 끝난다
//   side   어림이 클까 작을까(기획의 어느 쪽으로 틀렸을까): 커요, 작아요, 알 수 없어요 가운데 맞는 것을 고르면 끝난다. 다른 것을 고르면 사실만 말하고 판에 막대를 그린다
// 가깝고 먼 것을 점수나 비율로 말하지 않는다. 넣은 수와 센 수, 찍은 곳과 진짜 자리, 더 덮은 칸 수만 말한다.
import T from '../content/eyeball.json';
import { smallerEyeball } from '../core/smaller.js';
import { endsClosed, fill, ordinal } from '../core/text.js';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf } from '../core/eyeball-ladder.js';
import { MAX_CIRCLES, MAX_H, MAX_W, MIN_H, MIN_W, KINDS, bestCover, blobCells, checkBoard, copyBoard, coverKey, coverOf, estOf, fracOf, pushesOf, rectHas, rectOk, shownOf, snapValue, solve } from '../core/eyeball.js';
import { drawBars, drawBlob, drawLine, drawSide, eyeCard } from '../ui/eyeball-board.js';

const FORMAT = 'eyeball';
/** 기록에 남기는 무르기 차례와 덮어 본 덮기의 수의 위 끝 */
const MAX_MOVES = 300;
const MAX_TRIES = 200;
/** 넣을 수 있는 수의 자릿수 */
const TYPE_LIMIT = 3;
const ANSWERS = ['bigger', 'smaller', 'unknown'];
const FIRST_DRAFT = { w: 8, h: 6, circles: [], r: 5, k: 2 };
const SIZES = [3, 5, 7];

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createEyeball(frame) {
  const { $, log } = frame;
  let flash = null; // 방금 누른 것에 대한 한 줄(판 아래). 다음에 무엇을 누르면 지운다
  let draft = null; // 직접 만들기에서 만들던 얼룩
  let made = null; // 직접 만들기에서 선생님이 센 결과(판이 바뀌면 지운다)

  const count = (value) => Number.isInteger(value) && value >= 0;
  const isBlob = (round) => round.mode === 'area' || round.mode === 'cover';

  /** 한 번 푼 판은 적어 둔다 */
  const memo = new Map();
  function solutionOf(board) {
    const key = JSON.stringify(copyBoard(board));
    if (!memo.has(key)) memo.set(key, solve(board));
    return memo.get(key);
  }

  const cellName = (board, cell, face) => fill(T.cellLabel, { no: ordinal(Math.floor(cell / board.w) + 1), n: ordinal((cell % board.w) + 1), face });
  const hasHidden = (board) => board.items.some((item) => item.hide);
  const unitWord = (board) => T.units[String(Math.max(...board.items.map((item) => item.unit)))];
  const sideView = (board, more = {}) => ({ op: board.op, shown: board.items.map(shownOf), ests: board.items.map(estOf), est: solutionOf(board).est, labels: T.side, ...more });

  // ---- 판 ----
  function draw() {
    const { round } = frame;
    const playing = !round.done;
    for (const kind of KINDS) $(`eyeball-${kind}-box`).hidden = round.mode !== kind;
    $('eyeball-numbers').hidden = round.mode !== 'cover';
    let status = '';
    if (round.mode === 'area') status = drawArea(round, playing);
    else if (round.mode === 'cover') status = drawCover(round, playing);
    else if (round.mode === 'line') status = drawLineBoard(round, playing);
    else status = drawSideBoard(round, playing);
    $('eyeball-status').textContent = flash ?? status;
    $('undo').disabled = !playing || round.moves.length === 0;
    $('reset').disabled = !playing || round.rects.length === 0;
    frame.showWhy();
  }

  function drawArea(round, playing) {
    const { board } = round;
    const solution = solutionOf(board);
    const shown = round.done;
    drawBlob($('eyeball-board'), { w: board.w, h: board.h, circles: board.circles, cells: solution.cells, show: shown ? 'count' : 'none' });
    $('eyeball-typed').textContent = round.typed;
    for (const key of $('eyeball-keys').querySelectorAll('button')) {
      key.disabled = !playing || (key.dataset.n === 'erase' ? round.typed === '' : round.typed.length >= TYPE_LIMIT);
    }
    $('eyeball-reveal').disabled = !playing || round.typed === '';
    return shown ? T.status.counted : T.status.type;
  }

  function drawCover(round, playing) {
    const { board } = round;
    const solution = solutionOf(board);
    const cover = coverOf(board, round.rects, solution.cells);
    const coveredSet = new Set(cover.covered);
    const blobSet = new Set(solution.cells);
    drawBlob($('eyeball-board'), {
      w: board.w,
      h: board.h,
      circles: board.circles,
      cells: solution.cells,
      show: 'dots',
      rects: round.rects,
      covered: cover.covered,
      onRect: playing ? addRect : undefined,
      onTap: playing ? tapCell : undefined,
      cellLabel: (cell) => cellName(board, cell, T.cells[`${blobSet.has(cell) ? 'blob' : 'plain'}${coveredSet.has(cell) ? '-covered' : ''}`]),
    });
    $('eyeball-blob').textContent = String(solution.count);
    $('eyeball-covered').textContent = String(cover.size);
    $('eyeball-best-line').hidden = round.best === null;
    $('eyeball-best').textContent = round.best === null ? '' : String(round.best);
    $('eyeball-stop').hidden = !(playing && round.best !== null);
    if (!playing) return '';
    if (round.rects.length === 0) return T.status['cover-start'];
    return cover.missing > 0 ? fill(T.status['cover-open'], { n: cover.missing }) : T.status['cover-all'];
  }

  function drawLineBoard(round, playing) {
    const { board } = round;
    const pairs = round.marks.slice(0, round.step).map((mark, index) => ({ target: board.targets[index], mark }));
    drawLine($('eyeball-board'), {
      from: board.from,
      to: board.to,
      ticks: board.ticks,
      pairs,
      pending: playing ? round.pending : null,
      tenths: round.done,
      onMark: playing ? markLine : undefined,
      lineLabel: fill(T.lineLabel, { n: board.from, total: board.to }),
    });
    const target = board.targets[Math.min(round.step, board.targets.length - 1)];
    $('eyeball-target').textContent = playing ? String(target) : '';
    $('eyeball-here').disabled = !playing || round.pending === null;
    if (!playing) return T.status['line-done'];
    return round.pending === null ? T.status['line-tap'] : T.status['line-marked'];
  }

  function drawSideBoard(round, playing) {
    const { board } = round;
    const root = $('eyeball-board');
    root.className = 'es-side-board';
    const card = document.createElement('div');
    drawSide(card, sideView(board));
    const nodes = [card];
    if (round.barsShown || round.done) {
      const bars = document.createElement('div');
      drawBars(bars, { pushes: pushesOf(board), labels: T.bars });
      nodes.push(bars);
    }
    root.replaceChildren(...nodes);
    // 고른 것을 단추에 표시하지 않는다(틀린 고르기가 눈에 남지 않게). 같은 것을 다시 고르면 선생님이 그렇다고만 말한다
    for (const answer of ANSWERS) $(`eyeball-${answer}`).disabled = !playing;
    if (!playing) return '';
    return round.barsShown ? T.status['side-bars'] : T.status['side-pick'];
  }

  // ---- 얼룩 넓이: 수 넣기 ----
  function press(key) {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'area') return;
    if (key === 'erase') round.typed = round.typed.slice(0, -1);
    else if (/^\d$/.test(key) && round.typed.length < TYPE_LIMIT && !(key === '0' && round.typed === '')) round.typed += key;
    round.moveCount += 1;
    flash = null;
    draw();
    frame.persist();
  }

  /** "세어 보기": 넣은 수를 적고 센 칸을 보인다. 눈의 실험이라 판이 끝난다 */
  function reveal() {
    const { round, solution } = frame;
    if (!round || round.done || round.mode !== 'area' || round.typed === '') return;
    round.guess = Number(round.typed);
    round.answers.push({ t: frame.stamp(), answer: `guess:${round.guess}`, correct: true, guess: null });
    frame.note('answer', { answer: round.guess, count: solution.count });
    frame.finish('solved');
  }

  // ---- 덮기 ----
  function changeRects(next, kind) {
    const { round } = frame;
    round.moves = [...round.moves, { rects: round.rects.map((rect) => ({ ...rect })) }].slice(-MAX_MOVES);
    round.rects = next;
    round.moveCount += 1;
    flash = null;
    frame.note(kind, { rects: next.length });
    const cover = coverOf(round.board, next, frame.solution.cells);
    if (cover.missing === 0) {
      complete(cover);
      return;
    }
    draw();
    frame.persist();
  }

  /** 칸에서 칸으로 끌었다: 직사각형을 하나 더 그린다 */
  function addRect(rect) {
    const { round } = frame;
    if (!round || round.done || !rectOk(round.board, rect)) return;
    if (round.rects.length >= round.board.k) {
      flash = fill(T.status['cover-full'], { n: round.board.k });
      draw();
      frame.say(fill(T.play['cover-full'], { n: round.board.k }));
      return;
    }
    changeRects([...round.rects, rect], 'rect');
  }

  /** 칸을 눌렀다: 직사각형 위면 맨 나중에 그린 것을 지우고, 아니면 그 칸 하나짜리 직사각형을 그린다 */
  function tapCell(cell) {
    const { round } = frame;
    if (!round || round.done) return;
    const at = round.rects.findLastIndex((rect) => rectHas(round.board, rect, cell));
    if (at >= 0) {
      round.eraseCount += 1;
      changeRects(round.rects.filter((_, index) => index !== at), 'erase');
      return;
    }
    addRect({ x: cell % round.board.w, y: Math.floor(cell / round.board.w), w: 1, h: 1 });
  }

  /** 점이 찍힌 칸을 모두 덮었다: 얼룩이 아닌 칸을 몇 칸 덮었는지 말하고, 가장 적게 덮은 것이 아니면 더 적게 덮을 수 있을지 묻는다 */
  function complete(cover) {
    const { round, solution } = frame;
    const key = coverKey(round.rects);
    const fresh = !round.tries.includes(key);
    const before = round.best;
    if (fresh) {
      round.tries = [...round.tries, key].slice(-MAX_TRIES);
      round.completions.push(cover.extra);
    }
    if (before === null || cover.extra < before) round.best = cover.extra;
    const reached = cover.extra === solution.best;
    if (fresh) {
      const guess = reached ? null : 'more-than-best';
      round.answers.push({ t: frame.stamp(), answer: `cover:${cover.extra}`, correct: reached, guess });
      frame.note('answer', { answer: cover.extra, correct: reached, guess });
      if (!reached) round.wrongCount += 1;
    }
    if (reached) {
      frame.finish('solved');
      return;
    }
    draw();
    frame.persist();
    if (!fresh) {
      frame.say(T.play['cover-again']);
      return;
    }
    frame.say(fill(before !== null && cover.extra < before ? T.play['cover-down'] : T.play['cover-all'], { k: cover.extra }));
  }

  /** "여기까지 할래요": 지금까지 가장 적게 덮은 것으로 판을 끝낸다. 이것도 끝까지 한 판이다 */
  function stop() {
    const { round } = frame;
    if (!round || round.done || round.best === null) return;
    round.stopped = true;
    frame.note('stop', { best: round.best });
    frame.finish('solved');
  }

  function undo() {
    const { round } = frame;
    if (round.done || round.moves.length === 0) return;
    round.rects = round.moves.at(-1).rects;
    round.moves = round.moves.slice(0, -1);
    round.undoCount += 1;
    flash = null;
    frame.note('undo');
    draw();
    frame.persist();
  }

  /** 처음으로: 직사각형을 모두 지운다. 지운 것도 무르기로 돌아올 수 있다 */
  function reset() {
    const { round } = frame;
    if (round.done || round.rects.length === 0) return;
    round.moves = [...round.moves, { rects: round.rects }].slice(-MAX_MOVES);
    round.rects = [];
    round.resetCount += 1;
    flash = null;
    frame.note('reset');
    draw();
    frame.persist();
  }

  // ---- 수직선 ----
  /** 선을 누르거나 끌었다: 찍어 둔 곳을 옮긴다(아직 열지 않았다) */
  function markLine(frac, { moving }) {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'line') return;
    const value = snapValue(round.board, frac);
    if (value === round.pending && moving) return;
    round.pending = value;
    flash = null;
    if (!moving) {
      round.moveCount += 1;
      frame.note('mark', { value });
      frame.persist();
    }
    draw();
  }

  /** "여기예요": 찍어 둔 곳과 진짜 자리를 나란히 보인다. 마지막 수면 판이 끝난다 */
  function here() {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'line' || round.pending === null) return;
    const { board } = round;
    const target = board.targets[round.step];
    const mark = round.pending;
    round.marks = [...round.marks, mark];
    round.step += 1;
    round.pending = null;
    round.answers.push({ t: frame.stamp(), answer: `mark:${target}:${mark}`, correct: true, guess: null });
    frame.note('answer', { target, mark });
    if (round.step >= board.targets.length) {
      frame.finish('solved');
      return;
    }
    flash = null;
    draw();
    frame.persist();
    frame.say(`${revealLine(target, mark)} ${T.play['line-next']}`);
  }

  const revealLine = (target, mark) => (target === mark ? fill(T.play['line-same'], { n: mark, k: target }) : fill(T.play['line-reveal'], { n: mark, k: target, f: Math.abs(target - mark) }));

  // ---- 어림: 셋 가운데 고르기 ----
  function choose(answer) {
    const { round, solution } = frame;
    if (!round || round.done || round.mode !== 'side' || !ANSWERS.includes(answer)) return;
    flash = null;
    const correct = answer === solution.answer;
    const same = round.picks.includes(answer);
    round.picks = [...round.picks, answer];
    round.answers.push({ t: frame.stamp(), answer, correct, guess: correct ? null : `${answer}-on-${solution.answer}` });
    frame.note('answer', { answer, correct });
    if (correct) {
      frame.finish('solved');
      return;
    }
    // 틀렸다고 하지 않는다. 그 고르기가 깨지는 사실 하나를 말하고, 판에 막대를 그린다.
    if (!same) round.wrongCount += 1;
    round.barsShown = true;
    draw();
    frame.persist();
    if (same) frame.say(T.play['side-same']);
    else frame.say(wrongLine(round.board, solution, answer));
  }

  function wrongLine(board, solution, answer) {
    const range = { n: solution.low, total: solution.high };
    if (solution.answer === 'unknown') return fill(T.play['side-unknown'], range);
    if (answer === 'unknown') return hasHidden(board) ? fill(T.play['side-decided'], range) : T.play['side-exact'];
    return T.play['side-bars'];
  }

  // ---- 끝났을 때 하는 말: 한 일을 그대로 말한다 ----
  function rightLine(round, solution) {
    const { board } = round;
    if (round.mode === 'area') return [fill(T.right.area, { n: round.guess, k: solution.count })];
    if (round.mode === 'line') {
      const last = board.targets.length - 1;
      return [revealLine(board.targets[last], round.marks[last]), fill(T.right['line-done'], { n: board.targets.length })];
    }
    if (round.mode === 'cover') {
      const tries = round.completions.length;
      if (round.stopped) return [fill(T.right['cover-stopped'], { k: round.best })];
      const parts = [solution.best === 0 ? fill(T.right['cover-zero'], { n: board.k }) : fill(T.right['cover-best'], { k: solution.best, n: board.k })];
      parts.push(tries <= 1 ? T.right['cover-first'] : fill(T.right['cover-tries'], { f: tries }));
      return parts;
    }
    const parts = [T.right[`side-${solution.answer}`]];
    if (solution.low === solution.high) parts.push(fill(T.right[endsClosed(solution.low) ? 'side-fact-closed' : 'side-fact-open'], { k: solution.est, n: solution.low }));
    else parts.push(fill(T.right['side-range'], { n: solution.low, total: solution.high }));
    if (round.wrongCount > 0) parts.push(T.right['after-wrong']);
    return parts;
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----
  function rowOf(cards) {
    const row = document.createElement('div');
    row.className = 'figure-row';
    row.append(...cards);
    return row;
  }

  /** 그림의 어림 판([수, 어림하는 자리, 가렸는가])을 판으로 */
  const figureBoard = (item) => ({ kind: 'side', op: item.op, items: item.items.map(([n, unit, hide = false]) => ({ n, unit, hide })) });

  /** "왜 그럴까?": 어림 판의 막대 이야기. 다른 판에는 없다 */
  function whyPages(round) {
    if (round.mode !== 'side') return null;
    return T.why.map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다(단추를 보일지 따질 때마다 그리지 않는다).
      get nodes() {
        return [
          rowOf(
            slide.figures.map((item) => {
              const board = figureBoard(item);
              return eyeCard((root) => (item.bars ? drawBars(root, { pushes: pushesOf(board), labels: T.bars }) : drawSide(root, sideView(board))), item.note, { big: true });
            }),
          ),
        ];
      },
    }));
  }

  /** 풀이: 얼룩은 센 칸, 덮기는 가장 적게 덮은 덮기, 선은 모든 진짜 자리, 어림은 막대와 까닭 */
  function solutionPages(round, solution) {
    const { board } = round;
    if (round.mode === 'area') {
      return [{ say: fill(T.solution.area, { k: solution.count }), nodes: [rowOf([eyeCard((root) => drawBlob(root, { ...board, cells: solution.cells, show: 'count', small: true }), '', { big: true })])] }];
    }
    if (round.mode === 'cover') {
      const cover = coverOf(board, solution.rects, solution.cells);
      const say = solution.best === 0 ? fill(T.solution['cover-zero'], { n: board.k }) : fill(T.solution.cover, { n: board.k, k: solution.best });
      return [{ say, nodes: [rowOf([eyeCard((root) => drawBlob(root, { ...board, cells: solution.cells, show: 'dots', rects: solution.rects, covered: cover.covered, small: true }), '', { big: true })])] }];
    }
    if (round.mode === 'line') {
      const pairs = board.targets.map((target, index) => ({ target, mark: round.marks[index] ?? target }));
      return [{ say: T.solution.line, nodes: [rowOf([eyeCard((root) => drawLine(root, { ...board, pairs, tenths: true, small: true }), '', { big: true })])] }];
    }
    return [
      {
        say: T.solution[`side-${solution.answer}`],
        nodes: [rowOf([eyeCard((root) => drawSide(root, sideView(board)), ''), eyeCard((root) => drawBars(root, { pushes: pushesOf(board), labels: T.bars }), '', { big: true })])],
      },
    ];
  }

  // ---- 직접 만들기: 크기를 정하고 모눈을 눌러 둥근 덩어리를 놓는다 ----
  const draftBoard = () => ({ kind: 'cover', w: draft.w, h: draft.h, circles: draft.circles.map((circle) => circle.slice()), k: draft.k });
  const draftReady = () => draft && draft.circles.length > 0 && checkBoard(draftBoard()) === null && blobCells(draftBoard()).length >= 2;

  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    if (saved && checkBoard({ ...saved, kind: 'cover' }, { open: true }) === null && SIZES.includes(saved.r)) {
      return { w: saved.w, h: saved.h, circles: saved.circles.map((circle) => circle.slice()), r: saved.r, k: saved.k };
    }
    return { ...FIRST_DRAFT, circles: [] };
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    made = null;
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function drawMake() {
    const board = draftBoard();
    $('eyeball-make-w').textContent = fill(T.make.size, { n: draft.w });
    $('eyeball-make-h').textContent = fill(T.make.size, { n: draft.h });
    $('eyeball-make-w-fewer').disabled = draft.w <= MIN_W;
    $('eyeball-make-w-more').disabled = draft.w >= MAX_W;
    $('eyeball-make-h-fewer').disabled = draft.h <= MIN_H;
    $('eyeball-make-h-more').disabled = draft.h >= MAX_H;
    for (const button of $('eyeball-make-size').querySelectorAll('button')) button.setAttribute('aria-pressed', String(Number(button.dataset.r) === draft.r));
    for (const button of $('eyeball-make-k').querySelectorAll('button')) button.setAttribute('aria-pressed', String(Number(button.dataset.k) === draft.k));
    $('eyeball-make-clear').disabled = draft.circles.length === 0;
    $('eyeball-make-count').textContent = fill(T.make.count, { k: draft.circles.length });
    $('eyeball-make-solve').disabled = !draftReady();
    $('eyeball-make-play').disabled = !draftReady();
    drawBlob($('eyeball-make-board'), {
      w: board.w,
      h: board.h,
      circles: board.circles,
      cells: made ? made.cells : [],
      show: made ? 'count' : 'none',
      centres: true,
      onPoint: placeCircle,
      boardLabel: fill(T.pointLabel, { n: board.w, no: board.h }),
    });
    $('eyeball-make-result').textContent = made ? made.line : '';
    $('eyeball-make-picture').replaceChildren(...(made ? made.cards : []));
  }

  function changeDraft(next) {
    draft = next;
    made = null;
    log.saveDraft({ w: draft.w, h: draft.h, circles: draft.circles, r: draft.r, k: draft.k }, FORMAT);
    drawMake();
  }

  /** 모눈을 눌렀다: 그 격자점에 덩어리의 가운데가 있으면 지우고, 없으면 고른 크기의 덩어리를 놓는다 */
  function placeCircle(x, y) {
    const at = draft.circles.findIndex(([cx, cy]) => cx === x && cy === y);
    if (at >= 0) {
      changeDraft({ ...draft, circles: draft.circles.filter((_, index) => index !== at) });
      return;
    }
    if (draft.circles.length >= MAX_CIRCLES) {
      frame.talkers.make.say(fill(T.make.full, { n: MAX_CIRCLES }));
      return;
    }
    changeDraft({ ...draft, circles: [...draft.circles, [x, y, draft.r]] });
  }

  /** 크기를 바꾼다. 판 밖으로 나간 덩어리는 버린다 */
  function resize(w, h) {
    if (w < MIN_W || h < MIN_H || w > MAX_W || h > MAX_H) return;
    changeDraft({ ...draft, w, h, circles: draft.circles.filter(([x, y]) => x <= w && y <= h) });
  }

  /** 아이가 만든 얼룩을 선생님이 센다: 얼룩 칸 수와 직사각형 하나, 둘, 셋으로 가장 적게 덮을 때 얼룩이 아닌 칸의 수 */
  function solveDraft() {
    if (!draftReady()) {
      frame.talkers.make.say(T.make.need);
      return;
    }
    const board = draftBoard();
    const cells = blobCells(board);
    const covers = [1, 2, 3].map((k) => bestCover(board, k, cells));
    const shown = covers[draft.k - 1];
    const line = `${fill(T.make.result, { k: cells.length, n: covers[0].extra, f: covers[1].extra, total: covers[2].extra })} ${fill(T.make.shown, { n: draft.k })}`;
    const cover = coverOf(board, shown.rects, cells);
    made = { cells, line, cards: [eyeCard((root) => drawBlob(root, { ...board, cells, show: 'dots', rects: shown.rects, covered: cover.covered, small: true }), '')] };
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
      solution: { count: cells.length, best: covers.map((item) => item.extra) },
    });
    log.flush();
    frame.talkers.make.say(line);
  }

  /** 다 만든 판(공책에 남기거나 해 볼 판). 얼룩의 칸이 두 칸 넘게 있어야 한다. 아니면 null */
  const madeBoard = () => (draftReady() ? draftBoard() : null);

  function playDraft() {
    const board = madeBoard();
    if (board) frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board });
    else frame.talkers.make.say(T.make['keep-not-yet']);
  }

  // ---- 단추 잇기 ----
  $('eyeball-keys').addEventListener('click', (event) => {
    const key = event.target.closest('button')?.dataset.n;
    if (key) press(key);
  });
  $('eyeball-reveal').addEventListener('click', reveal);
  $('eyeball-stop').addEventListener('click', stop);
  $('eyeball-here').addEventListener('click', here);
  for (const answer of ANSWERS) $(`eyeball-${answer}`).addEventListener('click', () => choose(answer));
  $('eyeball-make-w-fewer').addEventListener('click', () => resize(draft.w - 1, draft.h));
  $('eyeball-make-w-more').addEventListener('click', () => resize(draft.w + 1, draft.h));
  $('eyeball-make-h-fewer').addEventListener('click', () => resize(draft.w, draft.h - 1));
  $('eyeball-make-h-more').addEventListener('click', () => resize(draft.w, draft.h + 1));
  $('eyeball-make-size').addEventListener('click', (event) => {
    const r = Number(event.target.closest('button')?.dataset.r);
    if (SIZES.includes(r)) changeDraft({ ...draft, r });
  });
  $('eyeball-make-k').addEventListener('click', (event) => {
    const k = Number(event.target.closest('button')?.dataset.k);
    if (k === 2 || k === 3) changeDraft({ ...draft, k });
  });
  $('eyeball-make-clear').addEventListener('click', () => changeDraft({ ...draft, circles: [] }));
  $('eyeball-make-solve').addEventListener('click', solveDraft);
  $('eyeball-make-play').addEventListener('click', playDraft);

  /** 판의 처음 값(새 판, 공책의 그림) */
  function begin({ board }) {
    return {
      mode: board.kind, // 판의 종류: area | cover | line | side
      board: copyBoard(board),
      typed: '', // 얼룩 넓이: 숫자판으로 넣는 중인 수
      guess: null, // 얼룩 넓이: "세어 보기"를 누를 때 넣은 수
      rects: [], // 덮기: 지금 그린 직사각형들
      moves: [], // 덮기: 무르기에 쓰는 차례 { rects: 그 전의 직사각형들 }
      tries: [], // 덮기: 다 덮었던 덮기들(같은 덮기는 한 번)
      completions: [], // 덮기: 다 덮을 때마다 얼룩이 아닌 칸을 덮은 수
      best: null, // 덮기: 이 판에서 지금까지 얼룩이 아닌 칸을 가장 적게 덮은 수
      stopped: false, // 덮기: "여기까지 할래요"로 끝냈는가
      eraseCount: 0, // 덮기: 직사각형을 눌러 지운 수
      pending: null, // 선: 찍어 둔 곳(아직 열지 않음)
      marks: [], // 선: 열어 본 수마다 찍은 곳
      step: 0, // 선: 지금 찍을 수의 차례
      picks: [], // 어림: 고른 것들의 차례
      barsShown: false, // 어림: 판에 막대를 그렸는가
      moveCount: 0, // 판에 손댄 수(숫자, 직사각형, 찍기)
      undoCount: 0,
      resetCount: 0,
      wrongCount: 0, // 사실과 다른 답의 수(가장 적게 덮지 않은 처음 해 본 덮기, 맞지 않는 고르기)
    };
  }

  const keyOk = (key) => typeof key === 'string' && /^(\d+,\d+,\d+,\d+)?(;\d+,\d+,\d+,\d+)*$/.test(key);

  return {
    id: FORMAT,
    T,
    padId: 'eyeball-pad',
    makeId: 'make-eyeball',
    homeIds: { sample: 'home-eyeball-sample', blank: 'home-eyeball-blank', ask: 'home-eyeball-ask', play: 'home-eyeball-play', pick: 'home-eyeball-pick', make: 'home-eyeball-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    begin,
    solve: (round) => solutionOf(round.board),
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (!KINDS.includes(saved.mode) || checkBoard(saved.board) !== null || saved.board.kind !== saved.mode) return false;
      const rectsOk = (list) => Array.isArray(list) && list.every((rect) => rectOk(saved.board, rect));
      if (!rectsOk(saved.rects) || !Array.isArray(saved.moves) || !saved.moves.every((move) => rectsOk(move?.rects))) return false;
      if (saved.mode === 'cover' && saved.rects.length > saved.board.k) return false;
      if (!Array.isArray(saved.tries) || !saved.tries.every(keyOk) || !Array.isArray(saved.completions) || !saved.completions.every(count)) return false;
      if (typeof saved.typed !== 'string' || !/^\d{0,3}$/.test(saved.typed) || !(saved.best === null || count(saved.best))) return false;
      if (!Array.isArray(saved.marks) || !saved.marks.every(Number.isInteger) || !count(saved.step)) return false;
      if (saved.mode === 'line' && (saved.marks.length !== saved.step || saved.step >= saved.board.targets.length)) return false;
      if (!(saved.pending === null || Number.isInteger(saved.pending)) || !Array.isArray(saved.picks) || !saved.picks.every((answer) => ANSWERS.includes(answer))) return false;
      return [saved.moveCount, saved.undoCount, saved.resetCount, saved.wrongCount, saved.eraseCount].every(count);
    },
    /** 판 화면에서 이 형식의 것(판, 판 아래의 글)을 보이거나 감춘다. 무르기와 되돌리기는 덮기에만 있다 */
    showParts(on) {
      $('eyeball-board').hidden = !on;
      $('eyeball-count').hidden = !on;
      if (on) {
        // 앞의 형식이 정해 둔 무르기와 되돌리기를 여기서 다시 정한다.
        const other = frame.round?.mode !== 'cover';
        $('undo').hidden = other;
        $('reset').hidden = other;
      }
    },
    enter() {
      flash = null;
    },
    draw,
    ended() {
      flash = null;
    },
    ruleLine(round) {
      const { board } = round;
      if (round.mode === 'area') return T.rules.area;
      if (round.mode === 'cover') return fill(T.rules[round.custom ? 'made' : 'cover'], { n: board.k });
      if (round.mode === 'line') return fill(T.rules.line, { n: board.targets.length });
      return fill(T.rules[hasHidden(board) ? 'side-hidden' : 'side'], { face: unitWord(board) });
    },
    hints: (round) => T.hints[round.mode],
    touched: (round) => round.moveCount > 0 || round.picks.length > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view(round) {
      return { mode: round.mode, typed: round.typed, rects: round.rects.length, best: round.best, step: round.step, pending: round.pending, picks: round.picks.slice() };
    },
    /** 이 판보다 작은 판: 칸이 적은 얼룩, 짧은 선과 수 하나, 수가 둘이거나 작은 어림 */
    smaller: (round, turn) => smallerEyeball({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      const { board } = round;
      const summary = { possible: solution.possible };
      if (isBlob(round)) summary.count = solution.count;
      if (round.mode === 'cover') summary.best = solution.best;
      if (round.mode === 'side') Object.assign(summary, { answer: solution.answer, by: solution.by, est: solution.est, low: solution.low, high: solution.high });
      return {
        mode: round.mode,
        board: copyBoard(board),
        solution: summary,
        // 얼룩 넓이: 넣은 수(센 수와의 차는 기록에만 남기고 화면에는 점수로 말하지 않는다)
        guess: round.guess,
        // 덮기: 판을 떠날 때의 직사각형, 다 덮을 때마다 얼룩이 아닌 칸을 덮은 수, 가장 적게 덮은 수
        rects: round.rects,
        completions: round.completions,
        best: round.best,
        reachedBest: round.mode === 'cover' && round.best !== null && round.best === solution.best,
        stopped: round.stopped === true,
        // 선: 찍은 곳들(차례대로 찍을 수와 짝)
        marks: round.marks,
        // 어림: 고른 것들의 차례
        picks: round.picks,
        moveCount: round.moveCount,
        eraseCount: round.eraseCount,
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
    /** 글자판이 있는 기기: 얼룩 넓이에서 숫자와 지우기, 들이기. 선에서 왼쪽·오른쪽 화살표로 찍은 곳을 옮기고 들이기 */
    onKey(event) {
      const { round } = frame;
      if (!round || $('eyeball-pad').hidden) return;
      if (round.mode === 'area') {
        if (/^\d$/.test(event.key)) press(event.key);
        else if (event.key === 'Backspace') press('erase');
        else if (event.key === 'Enter' && !event.target.closest?.('button')) reveal();
      } else if (round.mode === 'line') {
        const { board } = round;
        const move = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
        if (move) {
          const now = round.pending ?? Math.round((board.from + board.to) / 2 / board.step) * board.step;
          markLine(fracOf(board, now + move * Math.max(board.step, (board.to - board.from) / 50)), { moving: false });
        } else if (event.key === 'Enter' && !event.target.closest?.('button')) here();
      }
    },

    // ---- 처음 화면에 그리는 그림 ----
    homeAsk: (level) => T.home.ask[rungOf(level).mode],
    pickLine: () => T.home.pick,
    drawSample(root, board) {
      drawPicture(root, board, {});
    },
    drawBlank(root) {
      drawBlob(root, { ...T.blank, circles: [], small: true });
    },
    drawResume(root, saved) {
      drawPicture(root, saved.board, saved);
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 첫 판(덮기는 가장 적게 덮은 덮기, 선은 진짜 자리) */
    drawLevelPicture(root, entry) {
      if (entry.picture.blank) {
        drawBlob(root, { ...T.blank, circles: [], small: true });
        return;
      }
      const { board, solution } = generateBoard(entry.level, entry.picture.seed);
      if (board.kind === 'cover') drawPicture(root, board, { rects: solution.rects });
      else if (board.kind === 'line') drawPicture(root, board, { marks: board.targets.slice(0, 1), step: 1 });
      else drawPicture(root, board, {});
    },
    showMake,
    /** 직접 만들기에서 다 만든 얼룩. 얼룩의 칸이 두 칸 넘게 있어야 한다(공책에 남기기가 쓴다) */
    madeBoard,
    /** 가장 좋은 기록(덮기): 얼룩이 아닌 칸을 가장 적게 덮은 수. 적을수록 좋으므로 값은 그 수에 마이너스를 붙인다 */
    bestOf: (round) => (round.mode !== 'cover' || round.best === null ? null : { value: -round.best, name: fill(T.notebook.best, { k: round.best }) }),
  };

  /** 작은 그림 하나: 판의 종류마다(하던 판이면 그때의 모습까지) */
  function drawPicture(root, board, state) {
    if (board.kind === 'area' || board.kind === 'cover') {
      const cells = blobCells(board);
      const rects = state.rects ?? [];
      const cover = board.kind === 'cover' ? coverOf(board, rects, cells) : null;
      drawBlob(root, { w: board.w, h: board.h, circles: board.circles, cells, show: board.kind === 'cover' ? 'dots' : 'none', rects, covered: cover ? cover.covered : [], small: true });
      return;
    }
    if (board.kind === 'line') {
      const marks = state.marks ?? [];
      drawLine(root, { from: board.from, to: board.to, ticks: board.ticks, pairs: marks.map((mark, index) => ({ target: board.targets[index], mark })), pending: state.pending ?? null, small: true });
      return;
    }
    drawSide(root, { op: board.op, shown: board.items.map(shownOf), ests: board.items.map(estOf), est: solve(board).est, labels: null, small: true });
  }
}

