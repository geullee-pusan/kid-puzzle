// 조각 덮기: 판 화면에서 이 형식이 맡는 부분(판, 답하는 칸, 막혔을 때와 맞혔을 때 하는 말, 풀이와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/tile.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 판의 종류(mode)는 단계가 정한다.
//   cover   늘 되는 판. 다 덮으면 끝난다(1단계)
//   either  되는 판은 다 덮어야 끝나고, 안 되는 판은 "불가능해요"로 답한다(2~4단계, 6단계 네 칸 조각, 직접 만든 판)
//   pick    되는 자리 고르기(5단계). 빠진 칸이 없는 판에서 칸 하나를 눌러 빼고(round.hole), 남은 칸을 다 덮으면 끝난다.
//           덮을 수 없는 칸을 고르면 그 사실만 말한다. 덮어 보며 확인해도 되고 "다른 칸 빼기"로 다시 골라도 된다
//   wall    금 없는 벽 쌓기(7단계). 도미노로 다 덮고 판의 끝에서 끝까지 곧게 이어진 금이 없으면 끝난다.
//           다 덮었는데 금이 있으면 그 금을 판에 긋고 사실만 말한다(판은 그대로다). 안 되는 판은 "불가능해요"로 답한다
//
// 조각은 칸을 따라 그어서 놓거나, 칸을 하나씩 눌러서 놓는다. 놓인 조각을 누르면 들어낸다.
// 지나온 길(trail)은 처음으로 되돌린 뒤부터 놓고 들어낸 일의 목록이다. "한 번 무르기"는 그 맨 뒤의 일을 없던 것으로 한다.
// 판에 무늬를 입히는 단추는 도구다. 무엇을 알려 주는지 말하지 않는다. 처음 누를 때 힌트 하나를 연 것으로 적는다.
import T from '../content/tile.json';
import { smallerTile } from '../core/smaller.js';
import { fill, ordinal } from '../core/text.js';
import { LADDER, MAKE_LEVEL, OLD_MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, possibleHoles, rungOf } from '../core/tile-ladder.js';
import { FOUR_PIECES, MAX_SIZE, MIN_SIZE, PATTERNS, PIECES, PIECE_IDS, checkBoard, colorCounts, deadCells, diagnoseImpossible, faultLines, isStuck, placeProblem, replay, solve, solveWall, whyFits, whyOpen, xyOf } from '../core/tile.js';
import { MARKS, boardCard, drawBoard, drawLegend, drawPiece } from '../ui/tile-board.js';

const FORMAT = 'tile';
const MODES = ['cover', 'either', 'pick', 'wall'];
/** 판의 종류마다 보이는 답하는 칸(금 없는 벽은 "불가능해요" 칸을 같이 쓴다) */
const PADS = { cover: 'cover', either: 'either', pick: 'pick', wall: 'either' };
/** 처음 화면과 판 고르기에 그리는 빈 판 */
const BLANK = { w: 4, h: 4, holes: [], placed: [] };
/** 기록에 남기는 막힌 모양의 수의 위 끝 */
const MAX_STUCKS = 40;
const FIRST_DRAFT = { w: 4, h: 4, piece: 'domino', holes: [] };

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createTile(frame) {
  const { $, log } = frame;
  let picks = []; // 하나씩 눌러 골라 둔 칸들
  let flash = null; // 방금 놓으려던 조각이 왜 안 놓였는지. 다음에 무엇을 누르면 지운다
  let draft = null; // 직접 만들기에서 만들던 판

  const copyBoard = (board) => ({ w: board.w, h: board.h, piece: board.piece, holes: board.holes.slice() });
  const sorted = (cells) => cells.slice().sort((a, b) => a - b);
  /** 조각을 놓는 판: 되는 자리 고르기에서는 고른 칸이 빠진 판이다 */
  const boardOf = (round) => (round.mode === 'pick' && Number.isInteger(round.hole) ? { ...round.board, holes: [round.hole] } : round.board);
  /** 금 없는 벽에서 다 덮었으면 그 벽의 금들(다 덮지 않았으면 없다) */
  const faultsOf = (round, state) => (round.mode === 'wall' && state.left === 0 ? faultLines(round.board, state.placed) : []);
  const keyOf = (placed) => placed.map((cells) => cells.join('-')).sort().join(' ');
  const labelOf = (board, placed) => (cell) => {
    const [x, y] = xyOf(board, cell);
    const what = board.holes.includes(cell) ? T.cells.hole : placed.some((cells) => cells.includes(cell)) ? T.cells.covered : T.cells.empty;
    return fill(T.cellLabel, { row: ordinal(y + 1), col: ordinal(x + 1), what });
  };
  const legendOf = (pattern, counts) => ({
    pattern,
    counts,
    text: (count) => fill(T.pattern.count, { n: count }),
    label: (index, count) => fill(T.pattern.left, { mark: T.pattern.marks[MARKS[pattern][index]], n: count }),
  });
  const touching = (board, cells, cell) => {
    const [x, y] = xyOf(board, cell);
    return cells.some((item) => {
      const [ix, iy] = xyOf(board, item);
      return Math.abs(ix - x) + Math.abs(iy - y) === 1;
    });
  };

  // ---- 판 ----
  function draw() {
    const { round } = frame;
    const board = boardOf(round);
    const state = replay(board, round.trail);
    const playing = !round.done;
    const choosing = round.mode === 'pick' && !Number.isInteger(round.hole);
    const done = state.left === 0;
    const faults = faultsOf(round, state);
    const stuck = !done && !choosing && isStuck(board, state.placed);
    drawBoard($('tile-board'), {
      w: board.w,
      h: board.h,
      holes: board.holes,
      placed: state.placed,
      pattern: round.pattern,
      picks,
      dead: stuck ? deadCells(board, state.placed) : [],
      faults,
      size: PIECES[board.piece],
      label: labelOf(board, state.placed),
      onStroke: playing ? stroke : undefined,
      onTap: playing ? tap : undefined,
      onPiece: playing ? lift : undefined,
    });
    $('tile-left').textContent = String(state.left);
    const patterned = round.pattern !== 'none';
    $('tile-colors').hidden = !patterned;
    if (patterned) drawLegend($('tile-colors'), legendOf(round.pattern, colorCounts(board, round.pattern, state.placed)));
    const waiting = picks.length > 0 ? T.status[`more-${PIECES[board.piece] - picks.length}`] : '';
    const settled = faults.length > 0 ? T.status.fault : done ? T.status.done : stuck ? T.status.stuck : choosing && playing ? T.status.pick : waiting;
    $('tile-status').textContent = flash ?? settled;
    $('undo').disabled = !playing || round.trail.length === 0;
    $('reset').disabled = !playing || round.trail.length === 0;
    $('tile-pattern').textContent = T.pattern.button[round.pattern];
    $('tile-pattern').setAttribute('aria-pressed', String(patterned));

    for (const pad of new Set(Object.values(PADS))) $(`tile-${pad}`).hidden = pad !== PADS[round.mode];
    $('tile-wall-note').hidden = round.mode !== 'wall';
    $('tile-flip-note').hidden = !FOUR_PIECES.includes(board.piece);
    $('tile-repick').disabled = round.done || choosing;
    $('tile-impossible').disabled = round.done;
    drawPiece($('tile-piece'), board.piece);
    $('tile-piece-name').textContent = T.pieces[board.piece];
    frame.showWhy();
  }

  /** 칸을 따라 그었다. 되는 자리 고르기에서 뺄 칸을 아직 고르지 않았으면 먼저 고르라고 판 아래에 적는다. */
  function stroke(cells) {
    const { round } = frame;
    if (round.done) return;
    picks = [];
    if (round.mode === 'pick' && !Number.isInteger(round.hole)) {
      flash = T.status['pick-first'];
      draw();
      return;
    }
    place(cells);
  }

  /** 빈칸 하나를 눌렀다. 조각의 칸 수만큼 차례로 누르면 놓인다. 되는 자리 고르기에서 아직 뺄 칸이 없으면 그 칸을 뺀다. */
  function tap(cell) {
    const { round } = frame;
    if (round.done) return;
    flash = null;
    if (round.mode === 'pick' && !Number.isInteger(round.hole)) {
      choose(cell);
      return;
    }
    if (picks.includes(cell)) picks = picks.filter((item) => item !== cell);
    else if (picks.length === 0 || touching(round.board, picks, cell)) picks = [...picks, cell];
    else picks = [cell];
    if (picks.length === PIECES[round.board.piece]) {
      const cells = picks;
      picks = [];
      place(cells);
      return;
    }
    draw();
  }

  /**
   * 되는 자리 고르기: 칸 하나를 뺀다. 덮을 수 없는 칸이면 그 사실만 말한다(틀렸다고 하지 않는다).
   * 같은 칸을 또 골랐으면 그 사실도 알려 준다. 판은 그대로이고, 덮어 보며 확인해도 된다.
   */
  function choose(cell) {
    const { round, solution } = frame;
    const possible = Array.isArray(solution.good) && solution.good.includes(cell);
    const again = round.picks.some((item) => item.cell === cell);
    round.hole = cell;
    round.picks = [...round.picks, { cell, possible }];
    if (!possible) round.wrongPicks += 1;
    picks = [];
    frame.note('pick', { cell, possible, again });
    draw();
    frame.persist();
    if (!possible) frame.say(T.pick[again ? 'again' : 'wrong']);
  }

  /** "다른 칸 빼기": 뺀 칸을 되돌리고 놓은 조각을 모두 뺀다. 그다음 누르는 칸이 새로 뺄 칸이다. */
  function repick() {
    const { round } = frame;
    if (round.done || round.mode !== 'pick' || !Number.isInteger(round.hole)) return;
    round.liftCount += replay(boardOf(round), round.trail).placed.length;
    round.trail = [];
    round.hole = null;
    round.repickCount += 1;
    picks = [];
    flash = null;
    frame.note('repick');
    draw();
    frame.persist();
  }

  /** 고른 칸들에 조각을 놓는다. 이 판의 조각 모양이 아니면 놓지 않고, 왜 안 되는지 판 아래에 적는다. */
  function place(picked) {
    const { round } = frame;
    const board = boardOf(round);
    const cells = sorted(picked);
    const before = replay(board, round.trail).placed;
    const problem = placeProblem(board, before, cells);
    if (problem !== null) {
      round.refuseCount += 1;
      frame.note('refuse', { cells, reason: problem });
      const few = PIECES[board.piece] === 4 ? 'few-4' : 'few';
      flash = T.status[problem === 'few' ? few : problem === 'shape' ? `shape-${board.piece}` : 'cannot'];
      draw();
      frame.persist();
      return;
    }
    flash = null;
    round.trail = [...round.trail, { op: 'place', cells }];
    round.placeCount += 1;
    frame.note('place', { cells });
    const placed = [...before, cells];
    const state = replay(board, round.trail);
    if (state.left === 0) {
      const faults = faultsOf(round, state);
      if (faults.length > 0) {
        sayFaults(state.placed, faults);
        return;
      }
      round.answers.push({ t: frame.stamp(), answer: 'covered', correct: true, guess: null });
      frame.note('answer', { answer: 'covered', correct: true, guess: null });
      frame.finish('solved');
      return;
    }
    if (isStuck(board, placed)) sayStuck(placed, state.left);
    draw();
    frame.persist();
  }

  /**
   * 금 없는 벽: 다 덮었는데 금이 있다. 판에 금을 긋고, 본 것(금이 몇 줄)과 할 수 있는 일 하나를 말한다. 판은 끝나지 않는다.
   * 다 덮은 벽도 답 하나로 적는다(맞지 않는 답). 똑같이 쌓아서 또 금이 생겼으면 그 사실을 알려 준다.
   */
  function sayFaults(placed, faults) {
    const { round } = frame;
    const key = keyOf(placed);
    const same = round.faultWalls.includes(key);
    round.faultCount += 1;
    round.faultWalls = [...round.faultWalls, key].slice(-MAX_STUCKS);
    round.answers.push({ t: frame.stamp(), answer: 'covered-fault', correct: false, guess: 'fault' });
    frame.note('answer', { answer: 'covered-fault', correct: false, guess: 'fault', faults, same });
    draw();
    frame.persist();
    frame.say(same ? T.wall['fault-same'] : fill(T.wall.fault, { n: faults.length }));
  }

  /** 막혔다: 본 것 하나와 할 수 있는 일 하나를 말한다. 판은 끝나지 않는다. 똑같이 놓고 또 막히면 그 사실을 알려 준다. */
  function sayStuck(placed, left) {
    const { round } = frame;
    const key = keyOf(placed);
    const same = round.stucks.includes(key);
    round.stuckCount += 1;
    round.stucks = [...round.stucks, key].slice(-MAX_STUCKS);
    frame.note('stuck', { left, same });
    if (!same) frame.say(fill(T.stuck.plain, { n: left }));
    else frame.say(T.stuck[placed.length > 2 ? 'same' : 'same-start']);
  }

  /** 놓인 조각을 눌렀다: 들어낸다. */
  function lift(index) {
    const { round } = frame;
    if (round.done) return;
    const cells = replay(boardOf(round), round.trail).placed[index];
    if (!cells) return;
    round.trail = [...round.trail, { op: 'remove', cells }];
    round.removeCount += 1;
    round.liftCount += 1;
    picks = [];
    flash = null;
    frame.note('remove', { cells });
    draw();
    frame.persist();
  }

  function undo() {
    const { round } = frame;
    if (round.done || round.trail.length === 0) return;
    const last = round.trail.at(-1);
    round.trail = round.trail.slice(0, -1);
    round.undoCount += 1;
    if (last.op === 'place') round.liftCount += 1;
    picks = [];
    flash = null;
    frame.note('undo');
    draw();
    frame.persist();
  }

  function reset() {
    const { round } = frame;
    if (round.done || round.trail.length === 0) return;
    round.liftCount += replay(boardOf(round), round.trail).placed.length;
    round.trail = [];
    round.resetCount += 1;
    picks = [];
    flash = null;
    frame.note('reset');
    draw();
    frame.persist();
  }

  /** "불가능해요". 되는 판이면 무엇을 놓쳤을지 짐작해서 말한다. 안 되는 판에서는 틀린 답이 없다. */
  function sayImpossible() {
    const { round, solution } = frame;
    if (round.done || (round.mode !== 'either' && round.mode !== 'wall')) return;
    const result = diagnoseImpossible(solution, { places: round.placeCount });
    round.answers.push({ t: frame.stamp(), answer: 'impossible', correct: result.correct, guess: result.guess });
    frame.note('answer', { answer: 'impossible', correct: result.correct, guess: result.guess });
    if (result.correct === true) {
      frame.finish('solved');
      return;
    }
    frame.persist();
    draw();
    // 풀이 프로그램도 끝까지 따져 보지 못한 판이면 사실대로 말한다.
    frame.say(result.correct === null ? T.play.unknown : T.guess[result.guess]);
  }

  /** 판에 무늬를 입혔다 벗긴다: 없음 → 바둑판 → 대각 줄. 무엇을 알려 주는지는 말하지 않는다. */
  function togglePattern() {
    const { round } = frame;
    if (!round) return;
    round.pattern = PATTERNS[(PATTERNS.indexOf(round.pattern) + 1) % PATTERNS.length];
    if (!round.done) {
      round.patternShown = true;
      round.patternCount += 1;
      frame.note('pattern', { pattern: round.pattern });
    }
    draw();
    frame.persist();
  }

  /** 까닭을 남겨 둔 판(ㄱ자 세 칸의 안 되는 판)을 맞힌 것이 이번이 처음인가 */
  function firstEllImpossible(round, solution) {
    if (round.side || round.custom || round.board.piece !== 'ell' || solution.reason !== 'search') return false;
    const before = frame
      .records()
      .filter((record) => record.kind === 'round' && record.format === FORMAT && !record.custom && record.id !== round.id)
      .filter((record) => record.board?.piece === 'ell' && record.solution?.possible === false && record.outcome === 'solved');
    return before.length === 0;
  }

  /** 맞혔을 때 하는 말: 무엇을 했는지 그대로 말한다. */
  function rightLine(round, solution) {
    const parts = [];
    const pieces = () => replay(boardOf(round), round.trail).placed.length;
    // 되는 자리 고르기: 몇 번 골라 보고 덮었는지
    if (round.mode === 'pick') {
      const tries = round.picks.length;
      parts.push(tries <= 1 ? fill(T.right['pick-first'], { n: pieces() }) : fill(T.right['pick-later'], { k: tries, n: pieces() }));
      if (round.stuckCount > 0) parts.push(fill(T.right['covered-stuck'], { s: round.stuckCount }));
      return parts;
    }
    // 금 없는 벽: 금이 있는 벽을 몇 번 쌓아 봤는지
    if (round.mode === 'wall') {
      const last = round.answers.at(-1).answer;
      if (last === 'impossible') {
        if (round.faultCount > 0) parts.push(fill(T.right['wall-impossible-tried'], { k: round.faultCount }));
        else parts.push(T.right[round.placeCount > 0 ? 'wall-impossible-some' : 'wall-impossible-untried']);
      } else {
        parts.push(fill(T.right['wall-clean'], { n: pieces() }));
        if (round.faultCount > 0) parts.push(fill(T.right['wall-after'], { k: round.faultCount }));
      }
      if (round.answers.some((item) => item.answer === 'impossible' && item.correct === false)) parts.push(T.right['after-retry']);
      return parts;
    }
    if (round.answers.at(-1).answer === 'impossible') {
      if (round.stuckCount > 0) parts.push(fill(T.right['impossible-tried'], { s: round.stuckCount }));
      else parts.push(T.right[round.placeCount > 0 ? 'impossible-some' : 'impossible-untried']);
      // 이 판에는 "왜 그럴까?"가 없다. 까닭을 지어내지 않고, 모든 경우를 따져서 알았다고 사실대로 한 번 말한다.
      if (firstEllImpossible(round, solution)) parts.push(T.right['ell-no-reason']);
    } else {
      const pieces = replay(round.board, round.trail).placed.length;
      if (round.liftCount === 0) parts.push(fill(T.right['covered-clean'], { n: pieces }));
      else parts.push(fill(T.right['covered-back'], { n: pieces, u: round.liftCount }));
      if (round.stuckCount > 0) parts.push(fill(T.right['covered-stuck'], { s: round.stuckCount }));
    }
    if (round.answers.length > 1) parts.push(T.right['after-retry']);
    return parts;
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----
  function rowOf(cards) {
    const row = document.createElement('div');
    row.className = 'figure-row';
    row.append(...cards);
    return row;
  }

  /**
   * "왜 그럴까?"는 조각마다 따로 있다(도미노, 일자 세 칸). 그 조각의 안 되는 판을 한 번 끝까지 만난 뒤에 열린다.
   * ㄱ자 세 칸에는 없다. 일부러 까닭을 남겨 둔 판이다.
   */
  function whyPages(round) {
    // 금 없는 벽은 도미노 판이지만 까닭이 바둑판 무늬가 아니다. 맞지 않는 까닭을 들려주지 않는다.
    // 되는 자리 고르기(일자 세 칸)는 일자 세 칸의 이야기가 그대로 그 판의 까닭이다.
    if (round.mode === 'wall') return null;
    const slides = T.why[round.board.piece];
    if (!slides || !whyOpen(frame.records(), round.board.piece)) return null;
    // 직접 만든 판 가운데는 무늬가 아닌 까닭으로 안 되는 판이 있다. 그런 판에서는 맞지 않는 까닭을 들려주지 않는다.
    if (!whyFits(round.board.piece, frame.solution)) return null;
    return slides.map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다(단추를 보일지 따질 때마다 그리지 않는다).
      get nodes() {
        return [
          rowOf(
            slide.figures.map((item) => {
              const view = { w: item.w, h: item.h, holes: item.holes, placed: item.placed ?? [], pattern: item.pattern ?? 'none', rings: item.rings ?? [], loop: item.loop ?? null };
              if (item.stuck) view.dead = deadCells(item, view.placed);
              return boardCard(view, item.note, { legend: item.counts ? legendOf(item.pattern, item.counts) : null });
            }),
          ),
        ];
      },
    }));
  }

  /** 풀이: 덮는 방법 하나를 판에 그려서 보여 준다. */
  function solutionPages(round, solution) {
    const { board } = round;
    // 되는 자리 고르기: 되는 자리를 모두 둥글게 짚고, 그 가운데 맨 앞 자리를 뺐을 때 덮는 방법 하나를 그린다.
    if (round.mode === 'pick') {
      const view = { w: board.w, h: board.h, holes: [solution.good[0]], placed: solution.tiling ?? [], rings: solution.good };
      return [{ say: fill(T.solution.pick, { k: solution.good.length }), nodes: [rowOf([boardCard(view, '', { big: true })])] }];
    }
    const view = { w: board.w, h: board.h, holes: board.holes, placed: solution.tiling ?? [] };
    let say = solution.possible === true ? fill(T.solution.possible, { k: solution.tiling.length }) : solution.possible === false ? T.solution.impossible : T.solution.unknown;
    if (round.mode === 'wall' && solution.possible !== null) say = solution.possible ? fill(T.solution['wall-possible'], { k: solution.tiling.length }) : T.solution['wall-impossible'];
    return [{ say, nodes: [rowOf([boardCard(view, '', { big: true })])] }];
  }

  // ---- 직접 만들기: 판의 크기와 조각을 고르고, 칸을 눌러 뺀다. ----
  const draftBoard = () => copyBoard(draft);

  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    return saved && checkBoard(saved) === null ? copyBoard(saved) : copyBoard(FIRST_DRAFT);
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    $('tile-make-result').textContent = '';
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function drawMake() {
    for (const button of $('tile-make-pieces').querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.piece === draft.piece));
    $('tile-make-w').textContent = fill(T.make.size, { n: draft.w });
    $('tile-make-h').textContent = fill(T.make.size, { n: draft.h });
    $('tile-make-w-fewer').disabled = draft.w <= MIN_SIZE;
    $('tile-make-w-more').disabled = draft.w >= MAX_SIZE;
    $('tile-make-h-fewer').disabled = draft.h <= MIN_SIZE;
    $('tile-make-h-more').disabled = draft.h >= MAX_SIZE;
    $('tile-make-clear').disabled = draft.holes.length === 0;
    drawBoard($('tile-make-board'), { w: draft.w, h: draft.h, holes: draft.holes, placed: [], label: labelOf(draft, []), onCell: toggleHole });
  }

  function changeDraft(next) {
    if (checkBoard(next) !== null) return;
    draft = next;
    $('tile-make-result').textContent = '';
    log.saveDraft(draft, FORMAT);
    drawMake();
  }

  /** 칸을 눌렀다: 빈칸이면 빼고, 빠진 칸이면 되돌린다. 빈칸이 하나도 남지 않게는 못 뺀다. */
  function toggleHole(cell) {
    const holes = draft.holes.includes(cell) ? draft.holes.filter((item) => item !== cell) : sorted([...draft.holes, cell]);
    changeDraft({ ...draft, holes });
  }

  /** 크기를 바꾼다. 빠진 칸은 같은 자리(가로, 세로)에 그대로 두고, 판 밖으로 나간 것은 버린다. */
  function resize(w, h) {
    const holes = draft.holes
      .map((cell) => xyOf(draft, cell))
      .filter(([x, y]) => x < w && y < h)
      .map(([x, y]) => y * w + x);
    changeDraft({ ...draft, w, h, holes: sorted(holes) });
  }

  /** 아이가 만든 판을 풀이 프로그램으로 풀어서 되는지 알려 준다. 끝까지 따져 보지 못했으면 그렇다고 사실대로 말한다. */
  function solveDraft() {
    const board = draftBoard();
    const result = solve(board);
    const line = result.possible === true ? fill(T.make.possible, { k: result.tiling.length }) : result.possible === false ? T.make.impossible : T.make.unknown;
    $('tile-make-result').textContent = line;
    const now = new Date().toISOString();
    log.saveRecord({
      kind: 'made',
      v: 1,
      id: log.newId('m'),
      format: FORMAT,
      startedAt: now,
      endedAt: now,
      board,
      solution: { possible: result.possible, reason: result.reason, pieces: result.tiling ? result.tiling.length : null, steps: result.steps },
    });
    log.flush();
    frame.talkers.make.say(line);
  }

  /** 다 만든 판(공책에 남기거나 풀어 볼 판) */
  const madeBoard = () => draftBoard();

  function playDraft() {
    frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board: madeBoard() });
  }

  // ---- 단추 잇기 ----
  $('tile-pattern').addEventListener('click', togglePattern);
  $('tile-impossible').addEventListener('click', sayImpossible);
  $('tile-repick').addEventListener('click', repick);
  $('tile-make-pieces').addEventListener('click', (event) => {
    const piece = event.target.closest('button')?.dataset.piece;
    if (PIECE_IDS.includes(piece)) changeDraft({ ...draft, piece });
  });
  $('tile-make-w-fewer').addEventListener('click', () => resize(draft.w - 1, draft.h));
  $('tile-make-w-more').addEventListener('click', () => resize(draft.w + 1, draft.h));
  $('tile-make-h-fewer').addEventListener('click', () => resize(draft.w, draft.h - 1));
  $('tile-make-h-more').addEventListener('click', () => resize(draft.w, draft.h + 1));
  $('tile-make-clear').addEventListener('click', () => changeDraft({ ...draft, holes: [] }));
  $('tile-make-solve').addEventListener('click', solveDraft);
  $('tile-make-play').addEventListener('click', playDraft);

  const count = (value) => Number.isInteger(value) && value >= 0;
  /** 하던 판의 단계가 판의 종류와 조각에 맞는가. 직접 만든 판은 지금 번호나 예전 번호(OLD_MAKE_LEVEL)의 직접 만들기여야 한다 */
  const levelOk = (saved) => {
    if (saved.custom === true) return [MAKE_LEVEL, OLD_MAKE_LEVEL].includes(saved.level) && saved.mode === 'either';
    if (!Number.isInteger(saved.level) || saved.level < LADDER[0].level || saved.level > TOP_LEVEL) return false;
    const rung = rungOf(saved.level);
    if (rung.mode !== saved.mode) return false;
    if (rung.pieces) return rung.pieces.includes(saved.board.piece) && saved.board.holes.length === 0;
    if (rung.mode === 'pick' || rung.mode === 'wall') return saved.board.piece === rung.piece && saved.board.holes.length === 0;
    return saved.board.piece === rung.piece;
  };
  /** 되는 자리 고르기의 값(뺀 칸, 고른 칸들)이 맞는가. 다른 판에서는 없어도 된다(2026-11-20 전에 적어 둔 판) */
  const pickOk = (saved) => {
    if (saved.mode !== 'pick') return true;
    const cells = saved.board.w * saved.board.h;
    const cellOk = (cell) => Number.isInteger(cell) && cell >= 0 && cell < cells;
    if (saved.hole !== null && !cellOk(saved.hole)) return false;
    return Array.isArray(saved.picks) && saved.picks.every((item) => item && cellOk(item.cell)) && count(saved.wrongPicks) && count(saved.repickCount);
  };
  /** 금 없는 벽의 값 */
  const wallOk = (saved) => saved.mode !== 'wall' || (count(saved.faultCount) && Array.isArray(saved.faultWalls));

  return {
    id: FORMAT,
    T,
    padId: 'tile-pad',
    makeId: 'make-tile',
    homeIds: { sample: 'home-tile-sample', blank: 'home-tile-blank', ask: 'home-tile-ask', play: 'home-tile-play', pick: 'home-tile-pick', make: 'home-tile-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    /** 새 판에서 이 형식이 맡는 값 */
    begin({ level, custom, board }) {
      return {
        mode: custom ? 'either' : rungOf(level).mode,
        board: copyBoard(board), // 판: 크기, 조각, 빠진 칸
        trail: [], // 처음으로 되돌린 뒤부터 놓고 들어낸 일. { op: 'place' | 'remove', cells }
        placeCount: 0, // 이 판에서 조각을 놓은 수(되돌리기 전의 것까지 모두)
        removeCount: 0, // 놓인 조각을 눌러 들어낸 수
        liftCount: 0, // 판에서 도로 나간 조각의 수(누른 것, 무른 것, 처음으로 되돌린 것 모두)
        undoCount: 0,
        resetCount: 0,
        refuseCount: 0, // 조각 모양이 아니어서 놓이지 않은 수
        stuckCount: 0,
        stucks: [], // 막혔을 때 놓여 있던 조각들
        pattern: 'none', // 지금 판에 입힌 무늬
        patternShown: false, // 무늬를 한 번이라도 입혀 보았는가
        patternCount: 0, // 무늬 단추를 누른 수
        // 되는 자리 고르기(5단계)
        hole: null, // 지금 뺀 칸(아직 고르지 않았으면 null)
        picks: [], // 고른 칸들의 차례. { cell, possible }(possible: 그 칸을 빼면 덮을 수 있는가)
        wrongPicks: 0, // 덮을 수 없는 칸을 고른 수
        repickCount: 0, // "다른 칸 빼기"를 누른 수
        // 금 없는 벽(7단계)
        faultCount: 0, // 다 덮었는데 금이 있었던 수
        faultWalls: [], // 그때 놓여 있던 조각들
      };
    },
    solve(round) {
      // 되는 자리 고르기: 늘 된다. 되는 자리들과, 맨 앞 자리를 뺐을 때 덮는 방법
      if (round.mode === 'pick') {
        const { board } = round;
        const good = possibleHoles(board.piece, board.w, board.h);
        const { tiling } = solve({ ...board, holes: [good[0]] });
        return { possible: good.length > 0, tiling, reason: 'tiled', good };
      }
      const { possible, tiling, reason } = round.mode === 'wall' ? solveWall(round.board) : solve(round.board);
      return { possible, tiling, reason };
    },
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (!MODES.includes(saved.mode) || checkBoard(saved.board) !== null) return false;
      if (!levelOk(saved) || !pickOk(saved) || !wallOk(saved)) return false;
      if (!replay(boardOf(saved), saved.trail).ok) return false;
      if (![saved.placeCount, saved.removeCount, saved.liftCount, saved.undoCount, saved.resetCount, saved.refuseCount, saved.stuckCount, saved.patternCount].every(count)) return false;
      return Array.isArray(saved.stucks) && PATTERNS.includes(saved.pattern);
    },
    /** 판 화면에서 이 형식의 것(판, 남은 빈칸의 수, 판 아래의 글, 무늬 단추)을 보이거나 감춘다 */
    showParts(on) {
      $('tile-board').hidden = !on;
      $('tile-count').hidden = !on;
      $('tile-pattern').hidden = !on;
      if (!on) $('tile-colors').hidden = true;
    },
    enter() {
      picks = [];
      flash = null;
    },
    draw,
    ended() {
      picks = [];
      flash = null;
    },
    ruleLine: (round) => T.rules[['cover', 'pick', 'wall'].includes(round.mode) ? round.mode : round.board.piece],
    /** 힌트: 되는 자리 고르기와 금 없는 벽은 그 판의 것, 네 칸 조각은 다섯 조각이 함께 쓰는 것, 그 밖에는 조각마다 */
    hints(round) {
      if (round.mode === 'pick' || round.mode === 'wall') return T.hints[round.mode];
      return T.hints[FOUR_PIECES.includes(round.board.piece) ? 'four' : round.board.piece];
    },
    touched: (round) => round.placeCount > 0 || (round.picks?.length ?? 0) > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view(round) {
      const state = replay(boardOf(round), round.trail);
      return { placed: state.placed, left: state.left, pattern: round.pattern, hole: round.hole ?? null };
    },
    /** 이 판보다 작은 판: 같은 조각, 한 단 작은 판. 뺀 칸은 원래 판과 닮은 자리다 */
    smaller: (round, turn) => smallerTile({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      const state = replay(boardOf(round), round.trail);
      const more = {};
      if (round.mode === 'pick') {
        // 되는 자리 고르기: 뺀 칸, 고른 칸들, 덮을 수 없는 칸을 고른 수(처음 고른 칸이 되는 자리여야 "한 번에"다)
        Object.assign(more, { hole: round.hole, picks: round.picks, repickCount: round.repickCount, wrongCount: round.wrongPicks });
      }
      if (round.mode === 'wall') Object.assign(more, { faultCount: round.faultCount });
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        solution: { possible: solution.possible, reason: solution.reason, pieces: solution.tiling ? solution.tiling.length : null, ...(solution.good ? { good: solution.good } : {}) },
        ...more,
        // 질문 힌트와 "판에 무늬 입히기"를 함께 센다.
        hintsOpened: round.hintsOpened + (round.patternShown ? 1 : 0),
        patternShown: round.patternShown,
        patternCount: round.patternCount,
        pattern: round.pattern,
        // 판을 떠날 때의 길, 놓여 있던 조각, 남은 빈칸
        trail: round.trail,
        placed: state.placed,
        left: state.left,
        placeCount: round.placeCount,
        removeCount: round.removeCount,
        liftCount: round.liftCount,
        undoCount: round.undoCount,
        resetCount: round.resetCount,
        refuseCount: round.refuseCount,
        stuckCount: round.stuckCount,
      };
    },
    rightLine,
    whyPages,
    solutionPages,
    undo,
    reset,
    onKey() {},

    // ---- 처음 화면에 그리는 그림 ----
    homeAsk: (level) => T.home.ask[rungOf(level).mode],
    pickLine: () => T.home.pick,
    drawSample(root, board) {
      drawBoard(root, { w: board.w, h: board.h, holes: board.holes, placed: [], small: true });
    },
    drawBlank(root) {
      drawBoard(root, { ...BLANK, small: true });
    },
    drawResume(root, saved) {
      const board = boardOf(saved);
      const state = replay(board, saved.trail);
      drawBoard(root, { w: board.w, h: board.h, holes: board.holes, placed: state.placed, faults: faultsOf(saved, state), small: true });
    },
    /** 판 고르기의 그림: 단계마다 하는 일을 작은 그림으로 보여 준다(되는 자리 고르기는 누른 칸 하나를 짚는다). */
    drawLevelPicture(root, entry) {
      const picture = entry.picture;
      if (picture.blank) drawBoard(root, { ...BLANK, small: true });
      else drawBoard(root, { w: picture.w, h: picture.h, holes: picture.holes, placed: picture.placed ?? [], picks: picture.picks ?? [], small: true });
    },
    showMake,
    /** 직접 만들기에서 다 만든 판. 아직 풀 수 있는 판이 아니면 null(공책에 남기기가 쓴다) */
    madeBoard,
  };
}
