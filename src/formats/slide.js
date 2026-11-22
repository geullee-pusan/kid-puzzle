// 번호 말 제자리 찾기: 판 화면에서 이 형식이 맡는 부분(판, 맞바꾸기와 밀기, 답하는 칸, 끝났을 때 하는 말, 풀이와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/slide.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 맞바꾸기 판(1, 2단계): 말을 하나 누르면 고르고, 다른 말을 누르면 두 말의 자리가 맞바뀐다. 고른 말을 다시 누르면 그만 고른다. 1부터 차례대로 놓이면 끝난다.
// 밀기 판(3~5단계): 빈칸 옆의 말을 누르면 빈칸으로 밀린다. 1부터 차례대로이고 빈칸이 오른쪽 아래 구석이면 끝난다. 다른 말을 누르면 그 사실만 적는다.
// 판의 종류(mode)
//   swap   맞바꾸기(1단계). 몇 번 맞바꾸든 놓으면 끝난다
//   fewest 가장 적게 맞바꾸기(2단계, 기록 깨기). 가장 적은 횟수로 놓으면 끝난다. 더 많이 맞바꿔 놓으면 틀렸다고 하지 않고 횟수를 말한 뒤
//          "더 줄일 수 있을까요?"라고 묻는다. 가장 적은 횟수는 판이 끝나기 전에 말하지 않는다. "처음 판으로 다시 해 볼래요"와 "여기까지 할래요"가 있다
//   small, big  밀기 2×3, 3×3(3, 4단계). 안 되는 판이 섞인다. 안 되는 판은 "불가능해요"로 답한다. 되는 판에 누르면 틀렸다고 하지 않고 되는 판이라는
//          사실만 말하고 판은 그대로 이어진다(바뀌지 않는 값은 안 되는 판만 가려 준다. 되는 판은 실제로 밀어서 놓아야 끝난다)
//   least  가장 적게 밀기(5단계, 기록 깨기, 모두 되는 판). fewest와 같다
//   made   직접 만든 판. 맞바꾸기 판은 fewest와, 밀기 판은 small, big과 같다
// 도구(왼쪽 칸, 처음 켤 때 힌트 하나로 센다. 무엇이 그대로인지는 말하지 않는다)
//   "제자리 화살표 보기"(가장 적게 맞바꾸기와 직접 만든 맞바꾸기 판): 말마다 그 말의 제자리로 굽은 화살표를 그린다. 화살표가 고리를 이룬다는 것은 아이가 본다
//   "한 줄로 읽기"(안 되는 판이 섞이는 밀기 판): 판 아래에 판을 위 줄부터 한 줄로 읽은 수(빈칸은 건너뛴다)를 띠로 그리고,
//     큰 수가 작은 수보다 앞에 선 짝의 수를 적는다. 밀 때마다 바뀐다. 위아래로 밀었으면 건너뛴 수와 건너뛰어진 두 수를 띠에서 짚는다
// 안 되는 판을 "불가능해요"로 끝내면 한 줄로 읽은 띠와 그 짝의 수(홀수)를 보인다.
// 맞바꾼(민) 횟수는 지금 길의 길이다(무른 것은 빠진다). 판 아래에 늘 적는다.
import T from '../content/slide.json';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, recordMode, rungOf, solveOnce } from '../core/slide-ladder.js';
import { MAX_PIECES, MIN_PIECES, applySlide, applySwap, canSlide, checkBoard, copyBoard, emptyAt, goalBoard, goalCells, farthestOf, isDone, isUpDown, lineOf, replay, swappedCount } from '../core/slide.js';
import { smallerSlide } from '../core/smaller.js';
import { fill, ordinal } from '../core/text.js';
import { boardCard, drawBoard, drawLine } from '../ui/slide-board.js';

const FORMAT = 'slide';
const MODES = ['swap', 'fewest', 'small', 'big', 'least', 'made'];
/** 기록에 남기는 무르기 차례의 위 끝 */
const MAX_MOVES = 400;
/** 처음 화면과 판 고르기에 그리는 빈 판(제자리의 3×3 판) */
const BLANK = goalBoard('slide', 3, 3);
/** 직접 만들기의 판 크기: 맞바꾸기 한 줄, 밀기 2×3, 밀기 3×3 */
const MAKE_KINDS = { swap: { kind: 'swap', h: 1 }, small: { kind: 'slide', h: 2 }, big: { kind: 'slide', h: 3 } };
/** 직접 만들기의 처음 판: 말 다섯 개의 줄(1과 2가 바뀌고, 3·4·5가 한 바퀴) */
const FIRST_DRAFT = { kind: 'swap', w: 5, h: 1, cells: [2, 1, 4, 5, 3] };

const count = (value) => Number.isInteger(value) && value >= 0;
const isSwapBoard = (board) => board.kind === 'swap';

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createSlide(frame) {
  const { $, log } = frame;
  let flash = null; // 판 아래에 잠깐 적는 한 줄. 다음에 무엇을 누르면 지운다
  let moved = null; // 방금 움직인 말(판을 한 번 그릴 때 그 움직임을 보이고 지운다)
  let jump = null; // 방금 위아래로 민 말이 한 줄에서 건너뛴 것 { jumper, over }
  let draft = null; // 직접 만들기에서 만들던 판
  let picked = null; // 직접 만들기에서 고른 자리
  let made = null; // 직접 만들기에서 선생님이 따진 것(판을 고치면 지운다)

  const cellsOf = (round) => replay(round.board, round.trail).cells;
  const isRecord = (round) => recordMode(round.mode, round.board.kind);
  /** "불가능해요" 단추가 있는 판: 안 되는 판이 섞이는 밀기 판과 직접 만든 밀기 판 */
  const hasImpossible = (round) => !isSwapBoard(round.board) && !isRecord(round);
  /** 도구가 있는 판: 가장 적게 맞바꾸기와 직접 만든 맞바꾸기 판(화살표), 안 되는 판이 섞이는 밀기 판(한 줄로 읽기) */
  const hasTool = (round) => (isSwapBoard(round.board) ? round.mode !== 'swap' : hasImpossible(round));
  /** 규칙 글과 힌트의 이름 */
  const ruleKey = (round) => (round.mode === 'made' ? (isSwapBoard(round.board) ? 'made-swap' : 'made-slide') : round.mode);
  const kindWord = (board) => (isSwapBoard(board) ? 'swap' : 'slide');

  /** 읽어 주는 이름 */
  function labelsFor(board) {
    const { w } = board;
    if (isSwapBoard(board)) {
      return {
        board: fill(T.labels.row, { n: w }),
        piece: (at, value) => fill(T.labels['row-piece'], { no: ordinal(at + 1), n: value }),
        hole: () => '',
      };
    }
    const place = (at) => ({ no: ordinal(Math.floor(at / w) + 1), k: (at % w) + 1 });
    return {
      board: fill(T.labels.grid, { n: board.h }),
      piece: (at, value) => fill(T.labels['grid-piece'], { ...place(at), n: value }),
      hole: (at) => fill(T.labels['grid-hole'], place(at)),
    };
  }

  /** 한 줄로 읽은 띠를 보이는가: 하는 동안은 도구를 켰을 때, 끝난 판은 안 되는 판일 때(까닭) */
  function lineShowing(round, solution) {
    if (isSwapBoard(round.board)) return false;
    if (round.done) return solution?.possible === false;
    return round.toolOn && hasTool(round);
  }

  // ---- 판 ----
  function draw() {
    const { round, solution } = frame;
    const { board } = round;
    const playing = !round.done;
    const cells = cellsOf(round);
    const swapBoard = isSwapBoard(board);
    const record = isRecord(round);
    const arrows = swapBoard && hasTool(round) && round.toolOn && playing;
    drawBoard($('slide-grid'), {
      ...board,
      cells,
      picked: playing && swapBoard ? round.picked : null,
      arrows,
      keepRoom: swapBoard && hasTool(round),
      moved,
      labels: labelsFor(board),
      onTap: playing ? tap : undefined,
    });
    moved = null;
    const showLine = lineShowing(round, solution);
    $('slide-line-box').hidden = !showLine;
    if (showLine) drawLine($('slide-line'), { line: lineOf(cells), jumper: jump?.jumper ?? null, over: jump?.over ?? [], label: T.labels.line });
    jump = null;
    $('slide-swaps-line').hidden = !swapBoard;
    $('slide-slides-line').hidden = swapBoard;
    $('slide-swaps').textContent = String(round.trail.length);
    $('slide-slides').textContent = String(round.trail.length);
    $('slide-pairs-line').hidden = !showLine;
    $('slide-pairs').textContent = String(swappedCount(lineOf(cells)));
    $('slide-status').textContent = flash ?? statusOf(round, solution, cells);
    $('undo').disabled = !playing || round.moves.length === 0;
    $('reset').disabled = !playing || round.trail.length === 0;
    $('slide-how-swap').hidden = !swapBoard;
    $('slide-how-slide').hidden = swapBoard;
    // 밀기 판은 제자리 그림을 오른쪽 칸에 둔다(빈칸이 어디로 가야 하는지 보이게)
    $('slide-goal-box').hidden = swapBoard;
    if (!swapBoard) drawBoard($('slide-goal'), { ...goalBoard(board.kind, board.w, board.h), small: true });
    $('slide-maybe').hidden = !hasImpossible(round);
    $('slide-impossible').disabled = !playing;
    // 기록 깨기: 지금까지 가장 적게 한 횟수, 처음 판으로 다시, 여기까지
    const done = isDone(cells);
    $('slide-record-box').hidden = !record;
    $('slide-best-line').hidden = round.best === null;
    $('slide-best-none').hidden = round.best !== null;
    $('slide-best').textContent = round.best === null ? '' : String(round.best);
    $('slide-best-swap').hidden = !swapBoard;
    $('slide-best-slide').hidden = swapBoard;
    $('slide-again').hidden = !(playing && record && done);
    $('slide-stop').hidden = !(playing && record && round.best !== null);
    // 도구: 끝난 판에서는 꺼져 있다
    const looking = playing && round.toolOn;
    $('slide-tool').textContent = T.tool[`${swapBoard ? 'arrows' : 'line'}-${looking ? 'on' : 'off'}`];
    $('slide-tool').setAttribute('aria-pressed', String(looking));
    $('slide-tool').disabled = round.done;
    $('slide-tool').hidden = !hasTool(round);
    $('slide-arrow-box').hidden = !(looking && swapBoard);
    $('slide-line-note').hidden = !(looking && !swapBoard);
    frame.showWhy();
  }

  function statusOf(round, solution, cells) {
    const swapBoard = isSwapBoard(round.board);
    if (round.done) {
      if (isDone(cells)) return T.status.done;
      return solution && !solution.possible ? fill(T.status.reason, { n: swappedCount(lineOf(cells)) }) : '';
    }
    if (isDone(cells)) return T.status.done;
    if (swapBoard && round.picked !== null) return T.status.picked;
    if (round.trail.length === 0) return T.status[swapBoard ? 'begin-swap' : 'begin-slide'];
    return '';
  }

  /** 말을 눌렀다: 맞바꾸기는 고르거나 맞바꾸고, 밀기는 빈칸 옆의 말을 민다 */
  function tap(at) {
    const { round } = frame;
    if (!round || round.done) return;
    flash = null;
    const cells = cellsOf(round);
    if (isDone(cells)) {
      // 기록 깨기 판에서 다 놓은 뒤: 더 움직이지 않는다(처음 판으로 다시 하거나 여기까지 한다)
      flash = T.status.done;
      draw();
      return;
    }
    if (isSwapBoard(round.board)) {
      if (round.picked === null) round.picked = at;
      else if (round.picked === at) round.picked = null;
      else {
        const move = [Math.min(round.picked, at), Math.max(round.picked, at)];
        round.picked = null;
        moved = { at: move[0], from: move[1] };
        step(move, applySwap(cells, move[0], move[1]));
        return;
      }
      frame.note('pick', { at, picked: round.picked });
      draw();
      frame.keep();
      return;
    }
    if (!canSlide(round.board.w, round.board.h, cells, at)) {
      round.farCount += 1;
      frame.note('far', { at });
      flash = T.status.far;
      draw();
      frame.keep();
      return;
    }
    const hole = emptyAt(cells);
    if (isUpDown(round.board.w, cells, at)) {
      // 한 줄로 읽은 띠에서 민 말이 건너뛴 수들
      const before = lineOf(cells);
      const from = before.indexOf(cells[at]);
      const after = lineOf(applySlide(cells, at));
      const to = after.indexOf(cells[at]);
      jump = { jumper: cells[at], over: to > from ? after.slice(from, to) : after.slice(to + 1, from + 1) };
    }
    moved = { at: hole, from: at };
    step(at, applySlide(cells, at));
  }

  /** 한 번 움직였다(맞바꾸기 한 번이나 밀기 한 번) */
  function step(move, after) {
    const { round } = frame;
    round.moves = [...round.moves, round.trail.slice()].slice(-MAX_MOVES);
    round.trail = [...round.trail, move];
    round.moveCount += 1;
    frame.note(isSwapBoard(round.board) ? 'swap' : 'slide', { move });
    if (isDone(after)) {
      complete();
      return;
    }
    draw();
    frame.persist();
  }

  /** 모두 제자리에 놓았다. 기록 깨기 판이 아니면 끝난다. 기록 깨기 판은 가장 적은 횟수면 끝나고, 아니면 더 줄일 수 있을지 묻는다 */
  function complete() {
    const { round, solution } = frame;
    const k = round.trail.length;
    const before = round.best;
    round.completions.push(k);
    if (before === null || k < before) {
      round.best = k;
      round.bestTrail = round.trail.slice();
    }
    const fewest = !isRecord(round) || k === solution.fewest;
    const guess = fewest ? null : 'more-than-fewest';
    round.answers.push({ t: frame.stamp(), answer: `done:${k}`, correct: fewest, guess });
    frame.note('answer', { answer: `done:${k}`, correct: fewest, guess });
    if (fewest) {
      frame.finish('solved');
      return;
    }
    // 틀렸다고 하지 않는다. 횟수를 말하고 더 줄일 수 있을지 묻는다. 가장 적은 횟수는 말하지 않는다.
    round.wrongCount += 1;
    frame.persist();
    draw();
    const word = kindWord(round.board);
    if (before !== null && k === before) frame.say(fill(T.play[`same-${word}`], { k }));
    else frame.say(fill(T.play[before !== null && k < before ? `fewer-up-${word}` : `fewer-${word}`], { k }));
  }

  /** 기록 깨기 판에서 "처음 판으로 다시 해 볼래요" */
  function again() {
    const { round } = frame;
    if (round.done || round.trail.length === 0) return;
    round.moves = [...round.moves, round.trail.slice()].slice(-MAX_MOVES);
    round.trail = [];
    round.picked = null;
    round.retryCount += 1;
    flash = null;
    frame.note('again');
    draw();
    frame.persist();
    frame.say(T.play.again);
  }

  /** 기록 깨기 판에서 "여기까지 할래요": 지금까지 가장 적게 한 것으로 판을 끝낸다. 이것도 끝까지 한 판이다 */
  function stop() {
    const { round } = frame;
    if (round.done || round.best === null) return;
    round.stopped = true;
    frame.note('stop', { best: round.best });
    frame.finish('solved');
  }

  /** 한 번 무르기(처음으로 되돌린 것도 무를 수 있다) */
  function undo() {
    const { round } = frame;
    if (round.done || round.moves.length === 0) return;
    round.trail = round.moves.at(-1).slice();
    round.moves = round.moves.slice(0, -1);
    round.picked = null;
    round.undoCount += 1;
    flash = null;
    frame.note('undo');
    draw();
    frame.persist();
    // 앞의 모습에 한 말(되는 판이라는 말, 몇 번에 놓았다는 말)은 이제 맞지 않을 수 있으니 덮는다
    frame.say(T.play.undo);
  }

  /** 처음으로: 처음 모습으로 돌아간다. 무르기로 돌아올 수 있다 */
  function reset() {
    const { round } = frame;
    if (round.done || round.trail.length === 0) return;
    round.moves = [...round.moves, round.trail.slice()].slice(-MAX_MOVES);
    round.trail = [];
    round.picked = null;
    round.resetCount += 1;
    flash = null;
    frame.note('reset');
    draw();
    frame.persist();
    frame.say(T.play.reset);
  }

  /** "불가능해요". 되는 판이면 틀렸다고 하지 않고 되는 판이라는 사실만 말한다. 판은 그대로 이어진다. */
  function sayImpossible() {
    const { round, solution } = frame;
    if (!round || round.done || !hasImpossible(round)) return;
    const correct = solution.possible === false;
    const guess = correct ? null : 'impossible-on-possible';
    round.answers.push({ t: frame.stamp(), answer: 'impossible', correct, guess });
    frame.note('answer', { answer: 'impossible', correct, guess });
    if (correct) {
      frame.finish('solved');
      return;
    }
    round.impossibleCount += 1;
    round.wrongCount += 1;
    flash = null;
    frame.persist();
    draw();
    frame.say(round.moveCount === 0 ? T.play['possible-press-untried'] : T.play['possible-press']);
  }

  /** 도구를 켜고 끈다 */
  function toggleTool() {
    const { round } = frame;
    if (!round || round.done || !hasTool(round)) return;
    round.toolOn = !round.toolOn;
    if (round.toolOn) {
      round.toolShown = true;
      round.toolCount += 1;
    }
    flash = null;
    frame.note('tool', { on: round.toolOn });
    draw();
    frame.keep();
  }

  // ---- 끝났을 때 하는 말: 한 일을 그대로 말한다 ----
  function rightLine(round, solution) {
    const word = kindWord(round.board);
    if (round.answers.at(-1)?.answer === 'impossible') {
      return [round.moveCount > 0 ? fill(T.right['impossible-tried'], { k: round.moveCount }) : T.right['impossible-untried'], fill(T.right.reason, { n: swappedCount(lineOf(cellsOf(round))) })];
    }
    if (isRecord(round)) {
      if (round.stopped) return [fill(T.right[`stopped-${word}`], { k: round.best })];
      const parts = [fill(T.right[`fewest-${word}`], { k: solution.fewest })];
      if (round.completions.length > 1) parts.push(fill(T.right['fewest-after'], { n: round.completions[0] }));
      return parts;
    }
    const back = round.undoCount + round.resetCount;
    const parts = [fill(T.right[`done-${word}`], { k: round.trail.length }), back === 0 ? T.right.clean : fill(T.right.back, { n: back })];
    if (round.impossibleCount > 0) parts.push(T.right['after-press']);
    if (round.trail.length > solution.fewest) parts.push(T.right.fewer);
    return parts;
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----
  function rowOf(cards) {
    const row = document.createElement('div');
    row.className = 'figure-row';
    row.append(...cards);
    return row;
  }

  /** 띠를 붙인 판 그림의 값 */
  const withLine = (board, cells, more = {}) => ({ ...board, cells, line: { line: lineOf(cells), ...more } });

  /** 풀이: 되는 판은 가장 적게 하는 차례를 한 장씩, 안 되는 판은 한 줄로 읽은 띠와 짝의 수 */
  function solutionPages(round, solution) {
    const { board } = round;
    if (!solution.possible) {
      const n = swappedCount(lineOf(board.cells));
      return [{ say: fill(T.solution.impossible, { n }), nodes: [rowOf([boardCard(withLine(board, board.cells), fill(T.solution['reason-note'], { n }), { big: true })])] }];
    }
    let cells = board.cells.slice();
    const cards = [boardCard({ ...board, cells }, T.solution.start)];
    solution.path.forEach((move, index) => {
      const before = cells;
      cells = isSwapBoard(board) ? applySwap(cells, move[0], move[1]) : applySlide(cells, move);
      const marks = isSwapBoard(board) ? move : [emptyAt(before)];
      cards.push(boardCard({ ...board, cells, marks }, fill(T.solution.step, { no: index + 1 })));
    });
    return [{ say: fill(T.solution[kindWord(board)], { k: solution.fewest }), nodes: [rowOf(cards)] }];
  }

  /** "왜 그럴까?"의 그림 하나: 그림 판(rows)과 띠, 짚을 말 */
  function figureView(item) {
    const lines = item.rows.map((row) => row.trim().split(/\s+/));
    const cells = lines.flat().map((mark) => (mark === '_' ? 0 : Number(mark)));
    const board = { kind: cells.includes(0) ? 'slide' : 'swap', w: lines[0].length, h: lines.length, cells };
    const view = { ...board, marks: item.marks ?? [], arrows: item.arrows === true };
    if (board.kind === 'slide') view.line = { line: lineOf(cells), jumper: item.jumper ?? null, over: item.over ?? [] };
    return view;
  }

  /** "왜 그럴까?": 밀 때마다 짝을 세어 홀수가 그대로인 것을 알아챈다 → 옆으로와 위아래로 → 제자리는 0개(이름) → 가로 2칸 판에서는 통하지 않는다 → 맞바꾸기의 고리 */
  function whyPages() {
    return T.why.map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다
      get nodes() {
        return [rowOf(slide.figures.map((item) => boardCard(figureView(item), item.note, { mid: slide.figures.length <= 2 })))];
      },
    }));
  }

  // ---- 직접 만들기: 판의 종류와 크기를 정하고, 두 말(빈칸)을 차례로 눌러 자리를 바꾼다 ----
  const makeKindOf = (board) => (isSwapBoard(board) ? 'swap' : board.h === 2 ? 'small' : 'big');

  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    return saved && checkBoard(saved) === null ? copyBoard(saved) : copyBoard(FIRST_DRAFT);
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    picked = null;
    made = null;
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function drawMake() {
    const kind = makeKindOf(draft);
    for (const button of $('slide-make-kind').querySelectorAll('[data-kind]')) button.setAttribute('aria-pressed', String(button.dataset.kind === kind));
    const swapBoard = isSwapBoard(draft);
    $('slide-make-size').hidden = !swapBoard;
    $('slide-make-n').textContent = fill(T.make.size, { n: draft.w });
    $('slide-make-fewer').disabled = !swapBoard || draft.w <= MIN_PIECES;
    $('slide-make-more').disabled = !swapBoard || draft.w >= MAX_PIECES;
    $('slide-make-clear').disabled = isDone(draft.cells);
    drawBoard($('slide-make-board'), { ...draft, picked, holeTap: true, keepRoom: swapBoard, labels: labelsFor(draft), onTap: tapDraft });
    $('slide-make-result').textContent = made ? made.line : '';
    $('slide-make-picture').replaceChildren(...(made?.node ? [made.node] : []));
    $('slide-make-play').disabled = isDone(draft.cells);
  }

  function changeDraft(next) {
    if (checkBoard(next) !== null) return;
    draft = copyBoard(next);
    picked = null;
    made = null;
    log.saveDraft(draft, FORMAT);
    drawMake();
  }

  /** 말을 눌렀다: 처음 누르면 고르고, 고른 것을 다시 누르면 그만 고르고, 다른 것을 누르면 두 자리를 바꾼다(빈칸도 된다) */
  function tapDraft(at) {
    if (picked === null) picked = at;
    else if (picked === at) picked = null;
    else {
      changeDraft({ ...draft, cells: applySwap(draft.cells, picked, at) });
      return;
    }
    drawMake();
  }

  /** 판의 종류를 바꾼다. 맞바꾸기는 말 다섯 개, 밀기는 제자리 판에서 시작한다 */
  function setKind(kind) {
    const spec = MAKE_KINDS[kind];
    if (!spec || kind === makeKindOf(draft)) return;
    changeDraft(spec.kind === 'swap' ? copyBoard(FIRST_DRAFT) : goalBoard('slide', 3, spec.h));
  }

  /** 말 수를 바꾼다(맞바꾸기). 늘리면 가장 큰 새 말을 오른쪽 끝에 놓고, 줄이면 가장 큰 말을 뺀다 */
  function resize(n) {
    if (!isSwapBoard(draft) || n < MIN_PIECES || n > MAX_PIECES) return;
    let cells = draft.cells.filter((value) => value <= n);
    while (cells.length < n) cells = [...cells, cells.length + 1];
    changeDraft({ kind: 'swap', w: n, h: 1, cells });
  }

  /** 아이가 만든 판을 풀이 프로그램으로 따져서 알려 준다 */
  function solveDraft() {
    const board = copyBoard(draft);
    if (isDone(board.cells)) {
      made = { line: T.make.done, node: null };
      drawMake();
      frame.talkers.make.say(T.make.done);
      return;
    }
    const result = solveOnce(board);
    let line;
    let node;
    if (isSwapBoard(board)) {
      line = fill(T.make.swap, { k: result.fewest });
      node = boardCard({ ...board, arrows: true }, T.make['picture-swap']);
    } else {
      const n = swappedCount(lineOf(board.cells));
      if (result.possible) {
        // 그 크기의 판 가운데 가장 많이 밀어야 하는 판이면 그것도 말한다(표의 가장 큰 수)
        const farthest = result.fewest === farthestOf(board.w, board.h);
        line = farthest ? `${fill(T.make.slide, { k: result.fewest })} ${T.make.farthest}` : fill(T.make.slide, { k: result.fewest });
      } else line = fill(T.make.impossible, { n });
      node = boardCard(withLine(board, board.cells), fill(T.make['picture-line'], { n }));
    }
    made = { line, node };
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
      solution: { possible: result.possible, fewest: result.fewest, count: result.count },
    });
    log.flush();
    frame.talkers.make.say(line);
  }

  /** 다 만든 판(공책에 남기거나 해 볼 판). 이미 모두 제자리이면 null */
  const madeBoard = () => (draft && checkBoard(draft) === null && !isDone(draft.cells) ? copyBoard(draft) : null);

  function playDraft() {
    const board = madeBoard();
    if (!board) {
      frame.talkers.make.say(T.make['keep-not-yet']);
      return;
    }
    frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board });
  }

  // ---- 단추 잇기 ----
  $('slide-impossible').addEventListener('click', sayImpossible);
  $('slide-tool').addEventListener('click', toggleTool);
  $('slide-again').addEventListener('click', again);
  $('slide-stop').addEventListener('click', stop);
  $('slide-make-kind').addEventListener('click', (event) => {
    const kind = event.target.closest('button')?.dataset.kind;
    if (kind) setKind(kind);
  });
  $('slide-make-fewer').addEventListener('click', () => resize(draft.w - 1));
  $('slide-make-more').addEventListener('click', () => resize(draft.w + 1));
  $('slide-make-clear').addEventListener('click', () => changeDraft({ ...draft, cells: goalCells(draft.kind, draft.w, draft.h) }));
  $('slide-make-solve').addEventListener('click', solveDraft);
  $('slide-make-play').addEventListener('click', playDraft);

  /** 판의 처음 값(새 판, 공책의 그림) */
  function begin({ level, custom, board }) {
    return {
      mode: custom ? 'made' : rungOf(level).mode,
      board: copyBoard(board), // 판: 종류, 가로와 세로의 칸 수, 칸마다의 말(밀기 판의 0은 빈칸)
      trail: [], // 처음 모습에서 지금까지 한 움직임(맞바꾸기는 [a, b], 밀기는 민 말이 있던 자리)
      moves: [], // 무르기에 쓰는 차례: 그 전의 움직임 차례
      picked: null, // 맞바꾸기에서 고른 말의 자리
      moveCount: 0, // 이 판에서 움직인 수(무르고 되돌리기 전의 것까지 모두)
      farCount: 0, // 밀기 판에서 빈칸 옆이 아닌 말을 누른 수
      undoCount: 0,
      resetCount: 0,
      retryCount: 0, // 다 놓은 뒤에 처음 판으로 다시 해 본 수(기록 깨기 판)
      impossibleCount: 0, // 되는 판에 "불가능해요"를 누른 수
      wrongCount: 0, // 사실과 다른 답의 수(되는 판의 "불가능해요", 기록 깨기 판에서 가장 적은 횟수가 아니었던 다 놓기)
      completions: [], // 다 놓을 때마다의 횟수
      best: null, // 이 판에서 지금까지 가장 적게 한 횟수
      bestTrail: [], // 그때의 움직임
      stopped: false, // "여기까지 할래요"로 끝냈는가
      toolOn: false, // 지금 도구를 켜 두었는가
      toolShown: false, // 한 번이라도 켰는가
      toolCount: 0, // 켠 수
    };
  }

  /** 적어 둔 판의 단계가 판의 종류와 맞는가 */
  const levelOk = (saved) => {
    if (saved.custom === true) return saved.level === MAKE_LEVEL && saved.mode === 'made';
    if (!Number.isInteger(saved.level) || saved.level < LADDER[0].level || saved.level > TOP_LEVEL) return false;
    const rung = rungOf(saved.level);
    return rung.mode === saved.mode && rung.kind === saved.board.kind;
  };

  return {
    id: FORMAT,
    T,
    padId: 'slide-pad',
    makeId: 'make-slide',
    // 맞바꾸기 줄은 가로로 길고 위아래에 화살표 자리가 있다. 규칙 글은 왼쪽 칸 맨 위에 두고 판을 크게 그린다
    ruleAside: true,
    homeIds: { sample: 'home-slide-sample', blank: 'home-slide-blank', ask: 'home-slide-ask', play: 'home-slide-play', pick: 'home-slide-pick', make: 'home-slide-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    begin,
    solve: (round) => solveOnce(round.board),
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (!MODES.includes(saved.mode) || checkBoard(saved.board) !== null || !levelOk(saved)) return false;
      if (!replay(saved.board, saved.trail).ok) return false;
      if (!Array.isArray(saved.moves) || !saved.moves.every((trail) => replay(saved.board, trail).ok)) return false;
      if (![saved.completions, saved.bestTrail].every(Array.isArray)) return false;
      if (![saved.moveCount, saved.farCount, saved.undoCount, saved.resetCount, saved.retryCount, saved.impossibleCount, saved.wrongCount, saved.toolCount].every(count)) return false;
      if (![saved.stopped, saved.toolOn, saved.toolShown].every((value) => typeof value === 'boolean')) return false;
      if (!(saved.best === null || count(saved.best))) return false;
      return saved.picked === null || (Number.isInteger(saved.picked) && saved.picked >= 0 && saved.picked < saved.board.cells.length);
    },
    /** 판 화면에서 이 형식의 것(판, 판 아래의 글, 왼쪽 칸의 도구)을 보이거나 감춘다 */
    showParts(on) {
      $('slide-board').hidden = !on;
      $('slide-count').hidden = !on;
      if (!on) $('slide-tool').hidden = true;
      if (on) {
        // 앞의 형식이 감춰 둔 무르기와 되돌리기를 여기서 다시 보이게 한다.
        $('undo').hidden = false;
        $('reset').hidden = false;
      }
    },
    enter() {
      flash = null;
      moved = null;
      jump = null;
    },
    draw,
    ended() {
      flash = null;
    },
    ruleLine: (round) => T.rules[ruleKey(round)],
    hints: (round) => T.hints[ruleKey(round)],
    touched: (round) => round.moveCount > 0 || round.toolCount > 0 || round.farCount > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view(round) {
      const cells = cellsOf(round);
      return { cells: cells.join(','), count: round.trail.length, pairs: swappedCount(lineOf(cells)), best: round.best, toolOn: round.toolOn };
    },
    /** 이 판보다 작은 판: 말이 적은 줄, 2×3 판, 제자리에 더 가까운 같은 판 */
    smaller: (round, turn) => smallerSlide({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      const cells = cellsOf(round);
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        solution: { possible: solution.possible, fewest: solution.fewest, count: solution.count },
        // 질문 힌트와 도구를 함께 센다.
        hintsOpened: round.hintsOpened + (round.toolShown ? 1 : 0),
        toolShown: round.toolShown,
        toolCount: round.toolCount,
        // 판을 떠날 때의 길과 모습, 다 놓을 때마다의 횟수, 가장 적게 한 횟수
        trail: round.trail,
        cells: cells.join(','),
        count: round.trail.length,
        completions: round.completions,
        best: round.best,
        bestTrail: round.bestTrail,
        fewest: isRecord(round) && round.stopped !== true && round.best !== null && round.best === solution.fewest,
        stopped: round.stopped === true,
        moveCount: round.moveCount,
        farCount: round.farCount,
        undoCount: round.undoCount,
        resetCount: round.resetCount,
        retryCount: round.retryCount,
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
    /** 글자판: 판의 말은 저마다 Enter와 빈칸 글쇠로 누른다(판이 맡는다). Escape는 고른 말을 내려놓는다 */
    onKey(event) {
      const { round } = frame;
      if ($('slide-pad').hidden || event.key !== 'Escape' || round?.picked === null || round?.picked === undefined) return;
      round.picked = null;
      draw();
    },

    // ---- 처음 화면에 그리는 그림 ----
    homeAsk: (level) => T.home.ask[rungOf(level).mode],
    pickLine: () => T.home.pick,
    drawSample(root, board) {
      drawBoard(root, { ...board, small: true });
    },
    drawBlank(root) {
      drawBoard(root, { ...BLANK, small: true });
    },
    /** 하던 판과 공책의 그림: 지금 모습 */
    drawResume(root, saved) {
      drawBoard(root, { ...saved.board, cells: replay(saved.board, saved.trail).cells, small: true });
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 판 하나 */
    drawLevelPicture(root, entry) {
      if (entry.picture.blank) {
        drawBoard(root, { ...BLANK, small: true });
        return;
      }
      drawBoard(root, { ...generateBoard(entry.level, entry.picture.seed).board, small: true });
    },
    showMake,
    /** 직접 만들기에서 다 만든 판(공책에 남기기가 쓴다) */
    madeBoard,
    /** 가장 좋은 기록(공책에 저절로 남는다). 기록 깨기 판에서 한 번도 다 놓지 않았으면 null. 적을수록 좋은 기록이다 */
    bestOf: (round) => (!isRecord(round) || round.best === null ? null : { value: -round.best, name: fill(T.notebook[`best-${kindWord(round.board)}`], { k: round.best }) }),
  };
}
