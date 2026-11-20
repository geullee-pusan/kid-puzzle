// 줄 뒤집기 판: 판 화면에서 이 형식이 맡는 부분(판, 줄 뒤집기, 답하는 칸, 끝났을 때 하는 말, 풀이와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/rowflip.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 세로줄 위와 가로줄 오른쪽의 화살표 단추를 누르면 그 줄이 통째로 뒤집힌다(검은 칸 ↔ 흰 칸). 모두 흰 칸이 되면 끝난다.
// 안 되는 판은 "불가능해요"로 답한다. 되는 판에 누르면 틀렸다고 하지 않고 되는 판이라는 사실만 말하고 판은 그대로 이어진다
// (바뀌지 않는 값은 안 되는 판만 가려 준다. 되는 판은 실제로 모두 흰 칸으로 만들어야 끝난다). 2단계(모두 되는 판)에는 그 단추가 없다.
// 안 되는 판을 "불가능해요"로 끝내면 판에 까닭이 되는 네 칸(판의 네 모서리나 2×2 덩이)의 테두리를 그리고 그 네 칸의 검은 칸 수를 적는다.
// 뒤집은 횟수는 지금 길의 길이다(무른 것은 빠진다). 판 아래에는 뒤집은 횟수와 지금 검은 칸의 수를 늘 적는다.
// 왼쪽 칸의 "네 칸 골라 보기"를 켜면 칸 두 개를 눌러 그 두 칸을 마주 보는 모서리로 하는 네 칸을 표시하고, 그 네 칸의 검은 칸 수를 판 아래에 적는다.
// 줄을 뒤집어도 표시는 그대로라서 수가 어떻게 바뀌는지 볼 수 있다. 무엇이 그대로인지는 말하지 않는다. 처음 켤 때 힌트 하나로 센다.
import T from '../content/rowflip.json';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf, solveOnce } from '../core/rowflip-ladder.js';
import { MAX_SIDE, MIN_SIDE, applyMove, blackCount, boardOfRows, checkBoard, copyBoard, cornerBlack, cornersOf, isWhite, lineCells, rectFrom, replay } from '../core/rowflip.js';
import { smallerRowflip } from '../core/smaller.js';
import { fill, ordinal } from '../core/text.js';
import { boardCard, drawBoard } from '../ui/rowflip-board.js';

const FORMAT = 'rowflip';
const MODES = ['small', 'grid', 'corner', 'corners', 'block', 'made'];
/** 처음 화면과 판 고르기에 그리는 빈 판(모두 흰 3×3 판) */
const BLANK = { w: 3, h: 3, cells: Array(9).fill(0) };
/** 직접 만들기의 처음 판: 3×3 판(가운데 가로줄과 양쪽 세로줄을 뒤집은 모습. 세 번에 된다) */
const FIRST_DRAFT = { w: 3, h: 3, cells: [1, 0, 1, 0, 1, 0, 1, 0, 1] };

const count = (value) => Number.isInteger(value) && value >= 0;

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createRowflip(frame) {
  const { $, log } = frame;
  let changed = []; // 방금 뒤집힌 칸들(한 번 그릴 때만 움직인다)
  let flash = null; // 판 아래에 잠깐 적는 한 줄. 다음에 무엇을 누르면 지운다
  let draft = null; // 직접 만들기에서 만들던 판
  let made = null; // 직접 만들기에서 선생님이 따진 것(판을 고치면 지운다)

  const cellsOf = (round) => replay(round.board, round.trail).cells;
  const hasImpossible = (round) => round.mode !== 'grid';

  /** 읽어 주는 이름 */
  const labelsFor = (w, h) => ({
    board: fill(T.labels.board, { n: w, k: h }),
    cell: (cell, black) => fill(T.labels.cell, { no: ordinal(Math.floor(cell / w) + 1), k: (cell % w) + 1, face: T.faces[black ? 'black' : 'white'] }),
    row: (r) => fill(T.labels.row, { no: ordinal(r + 1) }),
    col: (c) => fill(T.labels.col, { no: ordinal(c + 1) }),
  });

  /** 지금 표시한 네 칸: 끝난 안 되는 판은 까닭이 되는 네 칸, 아니면 아이가 고른 두 칸으로 정한 네 칸 */
  function rectNow(round, solution) {
    if (round.done && solution && !solution.possible) return solution.witness;
    if (!round.pickOn || round.picks.length !== 2) return null;
    return rectFrom(round.board.w, round.picks[0], round.picks[1]);
  }

  // ---- 판 ----
  function draw() {
    const { round, solution } = frame;
    const { board } = round;
    const playing = !round.done;
    const cells = cellsOf(round);
    const rect = rectNow(round, solution);
    drawBoard($('rowflip-board'), {
      w: board.w,
      h: board.h,
      cells,
      changed,
      marks: rect ? cornersOf(board.w, rect) : [],
      pick: playing && round.pickOn && round.picks.length === 1 ? round.picks[0] : null,
      labels: labelsFor(board.w, board.h),
      onLine: playing ? flip : undefined,
      onCell: playing && round.pickOn ? tapCell : undefined,
    });
    changed = [];
    $('rowflip-flips').textContent = String(round.trail.length);
    $('rowflip-black').textContent = String(blackCount(cells));
    $('rowflip-marked-line').hidden = !rect;
    $('rowflip-marked').textContent = rect ? String(cornerBlack(board.w, cells, rect)) : '';
    $('rowflip-status').textContent = flash ?? statusOf(round, solution, cells, rect);
    $('undo').disabled = !playing || round.trail.length === 0;
    $('reset').disabled = !playing || round.trail.length === 0;
    $('rowflip-maybe').hidden = !hasImpossible(round);
    $('rowflip-impossible').disabled = !playing;
    // 도구: 칸 두 개로 네 칸을 표시한다. 끝난 판에서는 꺼져 있다.
    const looking = playing && round.pickOn;
    $('rowflip-pick').textContent = T.tool[looking ? 'on' : 'off'];
    $('rowflip-pick').setAttribute('aria-pressed', String(looking));
    $('rowflip-pick').disabled = round.done;
    $('rowflip-tool-box').hidden = !looking;
    frame.showWhy();
  }

  function statusOf(round, solution, cells, rect) {
    if (round.done) {
      if (isWhite(cells)) return T.status.done;
      return rect && solution && !solution.possible ? fill(T.status.reason, { n: cornerBlack(round.board.w, cells, rect) }) : '';
    }
    if (!round.pickOn) return '';
    if (round.picks.length === 0) return T.status.tool;
    return round.picks.length === 1 ? T.status['pick-one'] : '';
  }

  // ---- 줄 뒤집기 ----
  function flip(move) {
    const { round } = frame;
    if (!round || round.done) return;
    const { board } = round;
    flash = null;
    const after = applyMove(board.w, board.h, cellsOf(round), move);
    round.trail = [...round.trail, move];
    round.moveCount += 1;
    if (!round.lines.includes(move)) round.lines = [...round.lines, move];
    changed = lineCells(board.w, board.h, move);
    frame.note('flip', { line: move });
    if (isWhite(after)) {
      round.answers.push({ t: frame.stamp(), answer: 'done', correct: true, guess: null });
      frame.note('answer', { answer: 'done', correct: true });
      frame.finish('solved');
      return;
    }
    // 지나온 모습으로 되돌아왔으면 그 사실을 알려 준다. 말은 한 판에 한 번만 한다.
    const again = seenBefore(round, after);
    if (again) {
      round.loopCount += 1;
      frame.note('loop');
    }
    draw();
    frame.persist();
    if (again && !round.loopSaid) {
      round.loopSaid = true;
      frame.say(T.play.loop);
    }
  }

  /** 이 모습이 지금 길에서 앞서 있었던 모습인가 */
  function seenBefore(round, cells) {
    const key = cells.join('');
    const { board } = round;
    let now = board.cells.slice();
    if (now.join('') === key) return true;
    for (const move of round.trail.slice(0, -1)) {
      now = applyMove(board.w, board.h, now, move);
      if (now.join('') === key) return true;
    }
    return false;
  }

  function undo() {
    const { round } = frame;
    if (round.done || round.trail.length === 0) return;
    changed = lineCells(round.board.w, round.board.h, round.trail.at(-1));
    round.trail = round.trail.slice(0, -1);
    round.undoCount += 1;
    flash = null;
    frame.note('undo');
    draw();
    frame.persist();
    // 앞의 모습에 한 말(아까도 있던 모습, 되는 판이라는 말)은 이제 맞지 않을 수 있으니 덮는다
    frame.say(T.play.undo);
  }

  function reset() {
    const { round } = frame;
    if (round.done || round.trail.length === 0) return;
    round.trail = [];
    round.resetCount += 1;
    changed = [];
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

  // ---- 네 칸 골라 보기 ----
  function togglePick() {
    const { round } = frame;
    if (!round || round.done) return;
    round.pickOn = !round.pickOn;
    round.picks = [];
    if (round.pickOn) {
      round.pickShown = true;
      round.pickCount += 1;
    }
    flash = null;
    frame.note('pick-tool', { on: round.pickOn });
    draw();
    frame.keep();
  }

  /** 칸을 눌렀다: 첫 칸을 고르고, 둘째 칸으로 네 칸을 정한다. 셋째로 누르면 새로 고른다 */
  function tapCell(cell) {
    const { round } = frame;
    if (!round || round.done || !round.pickOn) return;
    flash = null;
    const [first] = round.picks;
    if (round.picks.length !== 1) round.picks = [cell];
    else if (first === cell) round.picks = [];
    else if (rectFrom(round.board.w, first, cell) === null) {
      // 같은 가로줄이나 같은 세로줄의 칸으로는 네 칸이 정해지지 않는다. 새로 누른 칸을 첫 칸으로 삼는다
      round.picks = [cell];
      flash = T.status['pick-same'];
    } else round.picks = [first, cell];
    frame.note('pick', { cell, picks: round.picks.slice() });
    draw();
    frame.keep();
  }

  // ---- 끝났을 때 하는 말: 한 일을 그대로 말한다 ----
  function rightLine(round, solution) {
    const parts = [];
    if (round.answers.at(-1)?.answer === 'impossible') {
      parts.push(round.moveCount > 0 ? fill(T.right['impossible-tried'], { k: round.moveCount }) : T.right['impossible-untried']);
      parts.push(fill(T.right.reason, { n: cornerBlack(round.board.w, cellsOf(round), solution.witness) }));
      return parts;
    }
    const back = round.undoCount + round.resetCount;
    parts.push(fill(T.right[back === 0 ? 'done-clean' : 'done-back'], { k: round.trail.length, n: back }));
    if (round.impossibleCount > 0) parts.push(T.right['after-press']);
    if (round.trail.length > solution.min) parts.push(T.right.fewer);
    return parts;
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----
  function rowOf(cards) {
    const row = document.createElement('div');
    row.className = 'figure-row';
    row.append(...cards);
    return row;
  }

  /** 풀이: 되는 판은 가장 적게 뒤집는 차례를 한 장씩, 안 되는 판은 까닭이 되는 네 칸 */
  function solutionPages(round, solution) {
    const { board } = round;
    if (!solution.possible) {
      const n = cornerBlack(board.w, board.cells, solution.witness);
      const view = { w: board.w, h: board.h, cells: board.cells, marks: cornersOf(board.w, solution.witness) };
      return [{ say: fill(T.solution.impossible, { n }), nodes: [rowOf([boardCard(view, fill(T.solution['reason-note'], { n }), { big: true })])] }];
    }
    let cells = board.cells.slice();
    const cards = [boardCard({ w: board.w, h: board.h, cells }, T.solution.start)];
    solution.moves.forEach((move, index) => {
      cells = applyMove(board.w, board.h, cells, move);
      cards.push(boardCard({ w: board.w, h: board.h, cells, band: move }, fill(T.solution.step, { no: index + 1 })));
    });
    return [{ say: fill(T.solution.possible, { k: solution.min }), nodes: [rowOf(cards)] }];
  }

  /** "왜 그럴까?"의 그림 하나 */
  function figureView(item) {
    const board = boardOfRows(item.rows);
    const marks = item.rect ? cornersOf(board.w, { r1: item.rect[0], c1: item.rect[1], r2: item.rect[2], c2: item.rect[3] }) : [];
    return { ...board, marks, band: item.band ?? null };
  }

  /** "왜 그럴까?": 검은 칸 수를 적어 가다 홀수가 그대로인 것을 알아챈다 → 한 줄에 두 칸(이름) → 큰 판의 2×2 네 칸 → 네 모서리가 짝수인데도 안 되는 판 */
  function whyPages() {
    return T.why.map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다
      get nodes() {
        // 그림이 둘뿐인 장은 크게 그린다
        return [rowOf(slide.figures.map((item) => boardCard(figureView(item), item.note, { mid: slide.figures.length <= 2 })))];
      },
    }));
  }

  // ---- 직접 만들기: 판의 크기를 정하고 칸을 눌러 칠한다 ----
  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    return saved && checkBoard(saved) === null ? copyBoard(saved) : copyBoard(FIRST_DRAFT);
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    made = null;
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function drawMake() {
    const { w, h, cells } = draft;
    const white = isWhite(cells);
    $('rowflip-make-w').textContent = fill(T.make.size, { n: w });
    $('rowflip-make-h').textContent = fill(T.make.size, { n: h });
    $('rowflip-make-w-fewer').disabled = w <= MIN_SIDE;
    $('rowflip-make-w-more').disabled = w >= MAX_SIDE;
    $('rowflip-make-h-fewer').disabled = h <= MIN_SIDE;
    $('rowflip-make-h-more').disabled = h >= MAX_SIDE;
    $('rowflip-make-clear').disabled = white;
    drawBoard($('rowflip-make-board'), { w, h, cells, marks: made?.marks ?? [], labels: labelsFor(w, h), onCell: tapDraft });
    $('rowflip-make-result').textContent = made ? made.line : white ? T.make.done : '';
    $('rowflip-make-picture').replaceChildren(...(made?.node ? [made.node] : []));
    $('rowflip-make-play').disabled = white;
  }

  function changeDraft(next) {
    draft = next;
    made = null;
    log.saveDraft(draft, FORMAT);
    drawMake();
  }

  function tapDraft(cell) {
    changeDraft({ ...draft, cells: draft.cells.map((value, at) => (at === cell ? 1 - value : value)) });
  }

  /** 크기를 바꾼다. 겹치는 칸은 그대로 두고 새 칸은 흰 칸이다 */
  function resize(w, h) {
    if (w < MIN_SIDE || w > MAX_SIDE || h < MIN_SIDE || h > MAX_SIDE) return;
    const cells = [];
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) cells.push(r < draft.h && c < draft.w ? draft.cells[r * draft.w + c] : 0);
    changeDraft({ w, h, cells });
  }

  /** 아이가 만든 판을 풀이 프로그램으로 풀어서 알려 준다. 되면 가장 적게 뒤집을 줄에 점을, 안 되면 까닭이 되는 네 칸에 테두리를 그린다 */
  function solveDraft() {
    const board = copyBoard(draft);
    if (isWhite(board.cells)) {
      made = { line: T.make.done, node: null, marks: [] };
      drawMake();
      frame.talkers.make.say(T.make.done);
      return;
    }
    const result = solveOnce(board);
    if (result.possible) {
      const line = fill(T.make.possible, { k: result.min });
      made = { line, node: boardCard({ ...board, lineMarks: result.moves }, T.make['picture-possible']), marks: [] };
    } else {
      const n = cornerBlack(board.w, board.cells, result.witness);
      const marks = cornersOf(board.w, result.witness);
      made = { line: fill(T.make.impossible, { n }), node: boardCard({ ...board, marks }, fill(T.make['picture-impossible'], { n })), marks };
    }
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
      solution: { possible: result.possible, min: result.min, witness: result.witness },
    });
    log.flush();
    frame.talkers.make.say(made.line);
  }

  /** 다 만든 판(공책에 남기거나 풀어 볼 판). 이미 모두 흰 칸이면 null */
  function madeBoard() {
    if (!draft || isWhite(draft.cells)) return null;
    return copyBoard(draft);
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
  $('rowflip-impossible').addEventListener('click', sayImpossible);
  $('rowflip-pick').addEventListener('click', togglePick);
  $('rowflip-make-w-fewer').addEventListener('click', () => resize(draft.w - 1, draft.h));
  $('rowflip-make-w-more').addEventListener('click', () => resize(draft.w + 1, draft.h));
  $('rowflip-make-h-fewer').addEventListener('click', () => resize(draft.w, draft.h - 1));
  $('rowflip-make-h-more').addEventListener('click', () => resize(draft.w, draft.h + 1));
  $('rowflip-make-clear').addEventListener('click', () => changeDraft({ ...draft, cells: draft.cells.map(() => 0) }));
  $('rowflip-make-solve').addEventListener('click', solveDraft);
  $('rowflip-make-play').addEventListener('click', playDraft);

  /** 판의 처음 값(새 판, 공책의 그림) */
  function begin({ level, custom, board }) {
    return {
      mode: custom ? 'made' : rungOf(level).mode,
      board: copyBoard(board), // 판: 가로와 세로의 칸 수, 칸마다 검은 칸인지
      trail: [], // 처음 모습에서 지금까지 뒤집은 줄('r0'은 맨 윗 가로줄, 'c0'은 맨 왼쪽 세로줄)
      lines: [], // 한 번이라도 뒤집어 본 줄
      moveCount: 0, // 이 판에서 뒤집은 수(무르고 되돌리기 전의 것까지 모두)
      undoCount: 0,
      resetCount: 0,
      loopCount: 0, // 지나온 모습으로 돌아온 수
      loopSaid: false,
      impossibleCount: 0, // 되는 판에 "불가능해요"를 누른 수
      wrongCount: 0, // 사실과 다른 답의 수(되는 판의 "불가능해요")
      pickOn: false, // 지금 "네 칸 골라 보기"를 켜 두었는가
      pickShown: false, // 한 번이라도 켰는가
      pickCount: 0, // 켠 수
      picks: [], // 고른 칸(둘까지)
    };
  }

  /** 적어 둔 판의 단계가 판의 종류와 맞는가 */
  const levelOk = (saved) => {
    if (saved.custom === true) return saved.level === MAKE_LEVEL && saved.mode === 'made';
    if (!Number.isInteger(saved.level) || saved.level < LADDER[0].level || saved.level > TOP_LEVEL) return false;
    return rungOf(saved.level).mode === saved.mode;
  };

  return {
    id: FORMAT,
    T,
    padId: 'rowflip-pad',
    makeId: 'make-rowflip',
    // 판이 정사각형에 가깝고 위와 오른쪽에 단추 자리가 있다. 규칙 글은 왼쪽 칸 맨 위에 두고 판을 크게 그린다
    ruleAside: true,
    homeIds: { sample: 'home-rowflip-sample', blank: 'home-rowflip-blank', ask: 'home-rowflip-ask', play: 'home-rowflip-play', pick: 'home-rowflip-pick', make: 'home-rowflip-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    begin,
    solve: (round) => solveOnce(round.board),
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (!MODES.includes(saved.mode) || checkBoard(saved.board) !== null || !levelOk(saved)) return false;
      if (!replay(saved.board, saved.trail).ok || !Array.isArray(saved.lines)) return false;
      if (![saved.moveCount, saved.undoCount, saved.resetCount, saved.loopCount, saved.impossibleCount, saved.wrongCount, saved.pickCount].every(count)) return false;
      if (![saved.loopSaid, saved.pickOn, saved.pickShown].every((value) => typeof value === 'boolean')) return false;
      const size = saved.board.w * saved.board.h;
      return Array.isArray(saved.picks) && saved.picks.length <= 2 && saved.picks.every((cell) => Number.isInteger(cell) && cell >= 0 && cell < size);
    },
    /** 판 화면에서 이 형식의 것(판, 판 아래의 글, 왼쪽 칸의 도구)을 보이거나 감춘다 */
    showParts(on) {
      $('rowflip-board').hidden = !on;
      $('rowflip-count').hidden = !on;
      $('rowflip-pick').hidden = !on;
      if (on) {
        // 앞의 형식이 감춰 둔 무르기와 되돌리기를 여기서 다시 보이게 한다.
        $('undo').hidden = false;
        $('reset').hidden = false;
      }
    },
    enter() {
      changed = [];
      flash = null;
    },
    draw,
    ended() {
      flash = null;
    },
    ruleLine: (round) => `${T.rules.flip} ${T.asks[hasImpossible(round) ? 'maybe' : 'grid']}`,
    hints: (round) => T.hints[round.mode],
    touched: (round) => round.moveCount > 0 || round.pickCount > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view(round) {
      const cells = cellsOf(round);
      return { cells: cells.join(''), flips: round.trail.length, black: blackCount(cells), picks: round.picks.slice() };
    },
    /** 이 판보다 작은 판: 판의 한 구석을 잘라 낸 판(안 되는 판에서는 검은 칸이 홀수 개인 2×2 덩이도) */
    smaller: (round, turn) => smallerRowflip({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        solution: { possible: solution.possible, min: solution.min, witness: solution.witness },
        // 질문 힌트와 "네 칸 골라 보기"를 함께 센다.
        hintsOpened: round.hintsOpened + (round.pickShown ? 1 : 0),
        pickShown: round.pickShown,
        pickCount: round.pickCount,
        // 판을 떠날 때의 길과 모습
        trail: round.trail,
        lines: round.lines,
        cells: cellsOf(round).join(''),
        count: round.trail.length,
        moveCount: round.moveCount,
        undoCount: round.undoCount,
        resetCount: round.resetCount,
        loopCount: round.loopCount,
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
    /** 글자판: 판의 단추와 칸은 저마다 Enter와 빈칸 글쇠로 누른다(판이 맡는다). Escape는 고른 칸을 지운다 */
    onKey(event) {
      const { round } = frame;
      if ($('rowflip-pad').hidden || event.key !== 'Escape' || !round?.pickOn || round.picks.length === 0) return;
      round.picks = [];
      draw();
    },

    // ---- 처음 화면에 그리는 그림 ----
    homeAsk: (level) => T.home.ask[rungOf(level).mode],
    pickLine: () => T.home.pick,
    drawSample(root, board) {
      drawBoard(root, { w: board.w, h: board.h, cells: board.cells, small: true });
    },
    drawBlank(root) {
      drawBoard(root, { ...BLANK, small: true });
    },
    /** 하던 판과 공책의 그림: 지금 모습 */
    drawResume(root, saved) {
      drawBoard(root, { w: saved.board.w, h: saved.board.h, cells: replay(saved.board, saved.trail).cells, small: true });
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 판 하나 */
    drawLevelPicture(root, entry) {
      if (entry.picture.blank) {
        drawBoard(root, { ...BLANK, small: true });
        return;
      }
      const { board } = generateBoard(entry.level, entry.picture.seed);
      drawBoard(root, { w: board.w, h: board.h, cells: board.cells, small: true });
    },
    showMake,
    /** 직접 만들기에서 다 만든 판(공책에 남기기가 쓴다) */
    madeBoard,
  };
}
