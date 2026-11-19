// 조각 못 들어가게 막기: 판 화면에서 이 형식이 맡는 부분(판, 답하는 칸, 끝났을 때 하는 말, 풀이와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/block.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 이 형식에는 틀린 답이 없다. 더 좋은 답을 찾는 형식이다(약수 세금과 같은 틀).
//   칸을 누르면 막히고, 막은 칸을 다시 누르면 열린다. 조각이 판 어디에도 들어가지 못하게 되면 한 번이 끝난다.
//   그때 막은 칸의 수를 사실로 말한다. 가장 적게 막은 것이면 판이 끝난다. 아니면 "더 적게 막을 수 있을까요?"라고 묻는다.
//   판은 그대로 두므로 칸을 다시 열어 고쳐 막아도 되고, 처음부터 다시 해도 되고, "여기까지 할래요"로 끝내도 된다.
//   이미 끝난 모습에서 쓸데없는 칸을 열어 더 적게 막아도 한 번이 끝난 것으로 센다. 칸을 더 막는 것은 세지 않는다.
// 막은 칸의 수는 이 놀이의 내용이다. 이 판에서 가장 적게 막은 수만 판 아래에 적는다.
// "들어갈 자리 보기"는 도구다. 조각이 아직 들어갈 수 있는 자리 하나를 판에 그리고, 남은 자리의 수를 적는다. 처음 누를 때 힌트 하나를 연 것으로 적는다.
import T from '../content/block.json';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf } from '../core/block-ladder.js';
import { MAX_SIZE, MIN_SIZE, PIECE_IDS, allPlacements, checkBoard, orientationsOf, placementsOf, replay, solve, xyOf } from '../core/block.js';
import { smallerBlock } from '../core/smaller.js';
import { fill, ordinal } from '../core/text.js';
import { boardCard, drawBoard, drawPiece } from '../ui/block-board.js';

const FORMAT = 'block';
const MODE = 'play';
/** 기록에 남기는 "한 번마다의 막은 칸"의 수의 위 끝 */
const MAX_TRIES = 40;
/** 처음 화면과 판 고르기에 그리는 빈 판 */
const BLANK = { w: 4, h: 4, holes: [] };
const FIRST_DRAFT = { w: 4, h: 4, piece: 'domino', holes: [] };

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createBlock(frame) {
  const { $, log } = frame;
  let draft = null; // 직접 만들기에서 만들던 판
  let shown = null; // 직접 만들기에서 선생님이 풀어 판에 막아 둔 칸(판을 고치면 지운다)

  const copyBoard = (board) => ({ w: board.w, h: board.h, piece: board.piece, holes: board.holes.slice() });
  const sorted = (cells) => cells.slice().sort((a, b) => a - b);
  /** 한 번 푼 판은 적어 둔다(판을 열 때마다, 기록을 남길 때마다 다시 풀지 않게) */
  const solvedMemo = new Map();
  const solveOnce = (board) => {
    const key = JSON.stringify(copyBoard(board));
    if (!solvedMemo.has(key)) solvedMemo.set(key, solve(board));
    return solvedMemo.get(key);
  };
  const labelOf = (board, blocked) => (cell) => {
    const [x, y] = xyOf(board, cell);
    const what = board.holes.includes(cell) ? T.cells.hole : blocked.includes(cell) ? T.cells.shut : T.cells.open;
    return fill(T.cellLabel, { row: ordinal(y + 1), col: ordinal(x + 1), what });
  };
  /** 조각이 아직 들어갈 수 있는 자리 하나(맨 위 왼쪽에 가까운 것). 없으면 null */
  const firstSpot = (board, blocked = []) => placementsOf(board, blocked)[0] ?? null;

  // ---- 판 ----
  function draw() {
    const { round } = frame;
    const { board } = round;
    const state = replay(board, round.taps);
    const playing = !round.done;
    drawBoard($('block-board'), {
      w: board.w,
      h: board.h,
      holes: board.holes,
      blocked: state.blocked,
      ghost: playing && round.spotsOn ? firstSpot(board, state.blocked) : null,
      label: labelOf(board, state.blocked),
      onCell: playing ? tap : undefined,
    });
    $('block-now').textContent = String(state.count);
    $('block-status').textContent = state.shut ? T.status.shut : playing && round.spotsOn ? fill(T.status.left, { n: state.left }) : '';
    $('block-best-line').hidden = round.best === null;
    $('block-best').textContent = round.best === null ? '' : String(round.best);
    $('undo').disabled = !playing || round.taps.length === 0;
    $('reset').disabled = !playing || round.taps.length === 0;
    $('block-again').hidden = !(playing && state.shut && round.taps.length > 0);
    $('block-stop').hidden = !(playing && round.best !== null);
    // 끝난 판에서는 도구가 꺼져 있다(단추도 누를 수 없다).
    const looking = playing && round.spotsOn;
    $('block-spots').textContent = T.tool[looking ? 'on' : 'off'];
    $('block-spots').setAttribute('aria-pressed', String(looking));
    $('block-spots').disabled = round.done;
    drawPiece($('block-piece'), orientationsOf(board.piece)[0]);
    $('block-piece-name').textContent = T.pieces[board.piece];
    frame.showWhy();
  }

  /** 칸을 눌렀다: 열린 칸이면 막고, 막은 칸이면 연다. 조각이 들어갈 자리가 없어졌거나 그 모습에서 더 적게 막았으면 한 번이 끝난다. */
  function tap(cell) {
    const { round } = frame;
    if (round.done || round.board.holes.includes(cell)) return;
    round.taps = [...round.taps, cell];
    round.moveCount += 1;
    const state = replay(round.board, round.taps);
    frame.note('tap', { cell, on: state.blocked.includes(cell) });
    if (state.shut && (round.lastShut === null || state.count < round.lastShut)) {
      complete(state);
      return;
    }
    if (!state.shut) round.lastShut = null;
    draw();
    frame.persist();
  }

  /** 조각이 들어갈 자리가 없어졌다: 한 번이 끝났다. 막은 칸의 수를 말하고, 가장 적게 막은 것이 아니면 더 적게 막을 수 있을지 묻는다. */
  function complete(state) {
    const { round, solution } = frame;
    const before = round.best;
    round.lastShut = state.count;
    round.completions.push(state.count);
    round.tries = [...round.tries, { blocked: state.blocked, count: state.count }].slice(-MAX_TRIES);
    if (before === null || state.count < before) {
      round.best = state.count;
      round.bestBlocked = state.blocked.slice();
    }
    const reached = solution.exact && state.count === solution.best;
    const guess = reached ? null : 'more-than-best';
    round.answers.push({ t: frame.stamp(), answer: `blocked:${state.count}`, correct: reached, guess });
    frame.note('answer', { answer: `blocked:${state.count}`, correct: reached, guess });
    if (reached) {
      frame.finish('solved');
      return;
    }
    // 틀렸다고 하지 않는다. 막은 칸의 수를 말하고 더 적게 막을 수 있을지 묻는다. 판은 그대로 둔다.
    frame.persist();
    draw();
    const line = !solution.exact ? T.play.unknown : before !== null && state.count < before ? T.play['fewer-down'] : T.play.fewer;
    frame.say(fill(line, { k: state.count }));
  }

  /** "여기까지 할래요": 지금까지 가장 적게 막은 것으로 판을 끝낸다. 이것도 끝까지 한 판이다. */
  function stop() {
    const { round } = frame;
    if (round.done || round.best === null) return;
    round.stopped = true;
    frame.note('stop', { best: round.best });
    frame.finish('solved');
  }

  /** 무르거나 되돌린 뒤: 지금 모습이 조각이 들어갈 자리가 없는 모습이면, 거기서 더 적게 막을 때 다시 센다. */
  function settle() {
    const { round } = frame;
    const state = replay(round.board, round.taps);
    round.lastShut = state.shut ? Math.min(round.lastShut ?? state.count, state.count) : null;
  }

  function undo() {
    const { round } = frame;
    if (round.done || round.taps.length === 0) return;
    round.taps = round.taps.slice(0, -1);
    round.undoCount += 1;
    settle();
    frame.note('undo');
    draw();
    frame.persist();
  }

  /** 처음으로 되돌린다. 조각이 들어갈 자리가 없는 모습에서였다면 "다시 해 보기"로 적고, 하던 가운데라면 되돌리기로 적는다. */
  function reset() {
    const { round } = frame;
    if (round.done || round.taps.length === 0) return;
    const shut = replay(round.board, round.taps).shut;
    round.taps = [];
    if (shut) {
      round.retryCount += 1;
      frame.note('again');
    } else {
      round.resetCount += 1;
      frame.note('reset');
    }
    settle();
    draw();
    frame.persist();
  }

  /** "들어갈 자리 보기": 조각이 아직 들어갈 수 있는 자리 하나를 판에 그리고, 남은 자리의 수를 판 아래에 적는다. */
  function toggleSpots() {
    const { round } = frame;
    if (!round || round.done) return;
    round.spotsOn = !round.spotsOn;
    if (round.spotsOn) {
      round.spotsShown = true;
      round.spotsCount += 1;
    }
    frame.note('spots', { on: round.spotsOn });
    draw();
    frame.persist();
  }

  /** 끝났을 때 하는 말: 한 일을 그대로 말한다(막은 칸의 수, 몇 번 다시 해 봤는지). */
  function rightLine(round, solution) {
    const retries = Math.max(0, round.completions.length - 1);
    if (round.stopped) {
      // 한 일의 차례대로: 몇 번 다시 해 봤는지 먼저, 가장 적게 막은 수와 "여기까지 했어요"는 맨 끝에.
      const parts = [];
      if (retries > 0) parts.push(fill(T.right['stopped-tries'], { r: retries }));
      parts.push(fill(T.right.stopped, { k: round.best }));
      return parts;
    }
    const parts = [fill(T.right.best, { k: solution.best })];
    parts.push(retries === 0 ? T.right['first-try'] : fill(T.right.after, { r: retries }));
    // 가장 적게 막아 처음 끝낸 판이면 "왜 그럴까?"가 생겼다고 알려 준다.
    const reached = frame.records().filter((record) => record.kind === 'round' && record.format === FORMAT && record.reachedBest === true && !record.custom);
    if (!round.custom && !round.side && reached.length === 1) parts.push(T.right['why-invite']);
    return parts;
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----
  function rowOf(cards) {
    const row = document.createElement('div');
    row.className = 'figure-row';
    row.append(...cards);
    return row;
  }

  /** "왜 그럴까?": 선생님이 어떻게 알아챘는지의 이야기 */
  function whyPages() {
    return T.why.map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다(단추를 보일지 따질 때마다 그리지 않는다).
      get nodes() {
        return [rowOf(slide.figures.map((item) => boardCard({ w: item.w, h: item.h, holes: [], blocked: item.blocked ?? [], spots: item.spots ?? [] }, item.note)))];
      },
    }));
  }

  /** 풀이: 가장 적게 막는 한 가지 방법을 판에 그려서 보여 준다. */
  function solutionPages(round, solution) {
    const { board } = round;
    const view = { w: board.w, h: board.h, holes: board.holes, blocked: solution.blocked };
    const say = solution.best === 0 ? T.solution.none : fill(solution.exact ? T.solution.say : T.solution.unknown, { k: solution.best });
    return [{ say, nodes: [rowOf([boardCard(view, '', { big: true })])] }];
  }

  // ---- 직접 만들기: 판의 크기와 조각을 고르고, 칸을 눌러 판에서 뺀다. ----
  const draftBoard = () => copyBoard(draft);

  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    return saved && checkBoard(saved) === null ? copyBoard(saved) : copyBoard(FIRST_DRAFT);
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    shown = null;
    $('block-make-result').textContent = '';
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function drawMake() {
    for (const button of $('block-make-pieces').querySelectorAll('button')) {
      button.setAttribute('aria-pressed', String(button.dataset.piece === draft.piece));
      const picture = button.querySelector('.block-make-picture');
      if (picture && picture.childElementCount === 0) drawPiece(picture, orientationsOf(button.dataset.piece)[0], 'mini block-make-picture');
    }
    $('block-make-w').textContent = fill(T.make.size, { n: draft.w });
    $('block-make-h').textContent = fill(T.make.size, { n: draft.h });
    $('block-make-w-fewer').disabled = draft.w <= MIN_SIZE;
    $('block-make-w-more').disabled = draft.w >= MAX_SIZE;
    $('block-make-h-fewer').disabled = draft.h <= MIN_SIZE;
    $('block-make-h-more').disabled = draft.h >= MAX_SIZE;
    $('block-make-clear').disabled = draft.holes.length === 0;
    const blocked = shown ?? [];
    drawBoard($('block-make-board'), { w: draft.w, h: draft.h, holes: draft.holes, blocked, label: labelOf(draft, blocked), onCell: toggleHole });
    // 조각이 들어갈 자리가 처음부터 없는 판은 해 볼 수 없다. 그렇다고 알려 주고 해 보는 단추를 끈다.
    const dead = allPlacements(draft).length === 0;
    $('block-make-play').disabled = dead;
    if (dead) $('block-make-result').textContent = T.make.none;
  }

  function changeDraft(next) {
    if (checkBoard(next) !== null) return;
    draft = next;
    shown = null;
    $('block-make-result').textContent = '';
    log.saveDraft(draft, FORMAT);
    drawMake();
  }

  /** 칸을 눌렀다: 판에 있는 칸이면 빼고, 빠진 칸이면 되돌린다. 칸이 하나도 남지 않게는 못 뺀다. */
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

  /** 아이가 만든 판을 풀이 프로그램으로 풀어서, 가장 적게 막는 칸 수를 알려 주고 그 칸들을 판에 막아 보여 준다. */
  function solveDraft() {
    const board = draftBoard();
    const result = solveOnce(board);
    let line = T.make.none;
    if (result.spots > 0) line = fill(result.exact ? T.make.best : T.make.unknown, { k: result.best });
    shown = result.spots > 0 ? result.blocked.slice() : null;
    drawMake();
    $('block-make-result').textContent = line;
    const now = new Date().toISOString();
    log.saveRecord({
      kind: 'made',
      v: 1,
      id: log.newId('m'),
      format: FORMAT,
      startedAt: now,
      endedAt: now,
      board,
      solution: { possible: true, exact: result.exact, best: result.best, blocked: result.blocked, spots: result.spots, nodes: result.nodes },
    });
    log.flush();
    frame.talkers.make.say(line);
  }

  /** 다 만든 판(공책에 남기거나 풀어 볼 판). 조각이 들어갈 자리가 처음부터 없으면 null */
  function madeBoard() {
    const board = draftBoard();
    return allPlacements(board).length === 0 ? null : board;
  }

  function playDraft() {
    const board = madeBoard();
    if (board) frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board });
  }

  // ---- 단추 잇기 ----
  $('block-again').addEventListener('click', reset);
  $('block-stop').addEventListener('click', stop);
  $('block-spots').addEventListener('click', toggleSpots);
  $('block-make-pieces').addEventListener('click', (event) => {
    const piece = event.target.closest('button')?.dataset.piece;
    if (PIECE_IDS.includes(piece)) changeDraft({ ...draft, piece });
  });
  $('block-make-w-fewer').addEventListener('click', () => resize(draft.w - 1, draft.h));
  $('block-make-w-more').addEventListener('click', () => resize(draft.w + 1, draft.h));
  $('block-make-h-fewer').addEventListener('click', () => resize(draft.w, draft.h - 1));
  $('block-make-h-more').addEventListener('click', () => resize(draft.w, draft.h + 1));
  $('block-make-clear').addEventListener('click', () => changeDraft({ ...draft, holes: [] }));
  $('block-make-solve').addEventListener('click', solveDraft);
  $('block-make-play').addEventListener('click', playDraft);

  const count = (value) => Number.isInteger(value) && value >= 0;

  return {
    id: FORMAT,
    T,
    padId: 'block-pad',
    makeId: 'make-block',
    homeIds: { sample: 'home-block-sample', blank: 'home-block-blank', ask: 'home-block-ask', play: 'home-block-play', pick: 'home-block-pick', make: 'home-block-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    /** 새 판에서 이 형식이 맡는 값 */
    begin({ board }) {
      return {
        mode: MODE,
        board: copyBoard(board), // 판: 크기, 조각, 빠진 칸
        taps: [], // 처음 모습에서 지금까지 누른 칸의 차례(같은 칸을 다시 누르면 다시 열린다)
        moveCount: 0, // 이 판에서 칸을 누른 수(무르고 되돌리기 전의 것까지 모두)
        undoCount: 0,
        resetCount: 0, // 하던 가운데 처음으로 되돌린 수
        retryCount: 0, // 조각이 들어갈 자리를 다 없앤 뒤 처음부터 다시 해 본 수
        completions: [], // 한 번이 끝날 때마다의 막은 칸 수
        tries: [], // 한 번이 끝날 때마다의 막은 칸과 그 수
        best: null, // 이 판에서 지금까지 가장 적게 막은 수
        bestBlocked: [], // 그때 막은 칸
        lastShut: null, // 조각이 들어갈 자리가 없는 모습이 이어지는 동안, 마지막으로 센 막은 칸 수
        stopped: false, // "여기까지 할래요"로 끝냈는가
        spotsOn: false, // 지금 들어갈 자리를 보고 있는가
        spotsShown: false, // 들어갈 자리를 한 번이라도 보았는가
        spotsCount: 0, // 들어갈 자리 보기를 켠 수
      };
    },
    solve(round) {
      const { exact, best, blocked, spots } = solveOnce(round.board);
      // possible은 틀이 본다("안 되는 판"이 없는 형식이라 늘 true다).
      return { possible: true, exact, best, blocked, spots };
    },
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (saved.mode !== MODE || checkBoard(saved.board) !== null) return false;
      if (!replay(saved.board, saved.taps).ok) return false;
      if (![saved.moveCount, saved.undoCount, saved.resetCount, saved.retryCount, saved.spotsCount].every(count)) return false;
      if (![saved.completions, saved.tries, saved.bestBlocked].every(Array.isArray)) return false;
      if (typeof saved.spotsOn !== 'boolean' || typeof saved.spotsShown !== 'boolean') return false;
      return (saved.best === null || count(saved.best)) && (saved.lastShut === null || count(saved.lastShut));
    },
    /** 판 화면에서 이 형식의 것(판, 막은 칸의 수, 도구 단추)을 보이거나 감춘다 */
    showParts(on) {
      $('block-board').hidden = !on;
      $('block-count').hidden = !on;
      $('block-spots').hidden = !on;
    },
    enter() {},
    draw,
    ended() {},
    ruleLine: (round) => T.rules[rungOf(round.level).hint],
    hints: (round) => T.hints[rungOf(round.level).hint],
    touched: (round) => round.moveCount > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view(round) {
      const state = replay(round.board, round.taps);
      return { blocked: state.blocked, left: state.left, tries: round.completions.length };
    },
    /** 이 판보다 작은 판: 같은 조각, 칸 수가 절반 이하인 네모 판 */
    smaller: (round, turn) => smallerBlock({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      const state = replay(round.board, round.taps);
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        solution: { possible: true, exact: solution.exact, best: solution.best, blocked: solution.blocked, spots: solution.spots },
        // 질문 힌트와 "들어갈 자리 보기"를 함께 센다.
        hintsOpened: round.hintsOpened + (round.spotsShown ? 1 : 0),
        spotsShown: round.spotsShown,
        spotsCount: round.spotsCount,
        // 판을 떠날 때: 누른 차례, 막은 칸, 그 수, 조각이 들어갈 자리가 남았는지
        taps: round.taps,
        blocked: state.blocked,
        count: state.count,
        left: state.left,
        // 한 번이 끝날 때마다의 막은 칸과 수, 다시 해 본 횟수, 가장 적게 막은 수와 그 칸
        tries: round.tries,
        completions: round.completions,
        retries: Math.max(0, round.completions.length - 1),
        retryCount: round.retryCount,
        best: round.best,
        bestBlocked: round.bestBlocked,
        // 가장 적게 막는 수(풀이 프로그램)에 닿았는가. 수준 맞추기와 "왜 그럴까?"가 본다
        reachedBest: solution.exact && round.best !== null && round.best === solution.best,
        stopped: round.stopped === true,
        moveCount: round.moveCount,
        undoCount: round.undoCount,
        resetCount: round.resetCount,
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
    /** 판과, 조각이 들어갈 수 있는 자리 하나 */
    drawSample(root, board) {
      drawBoard(root, { w: board.w, h: board.h, holes: board.holes, ghost: firstSpot(board), small: true });
    },
    drawBlank(root) {
      drawBoard(root, { ...BLANK, small: true });
    },
    /** 하던 판: 막은 칸. 아직 하나도 막지 않았으면 조각이 들어갈 수 있는 자리 하나를 그린다 */
    drawResume(root, saved) {
      const { board } = saved;
      const { blocked } = replay(board, saved.taps);
      drawBoard(root, { w: board.w, h: board.h, holes: board.holes, blocked, ghost: blocked.length === 0 ? firstSpot(board) : null, small: true });
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 판 하나와 조각이 들어갈 수 있는 자리 하나 */
    drawLevelPicture(root, entry) {
      const picture = entry.picture;
      if (picture.blank) drawBoard(root, { ...BLANK, small: true });
      else {
        const board = { w: picture.w, h: picture.h, piece: picture.piece, holes: [] };
        drawBoard(root, { w: board.w, h: board.h, ghost: firstSpot(board), small: true });
      }
    },
    showMake,
    /** 직접 만들기에서 다 만든 판. 아직 풀 수 있는 판이 아니면 null(공책에 남기기가 쓴다) */
    madeBoard,
    /**
     * 가장 좋은 기록(공책에 저절로 남는다). 이 판에서 한 번도 끝까지 가지 않았으면 null.
     * 공책은 값이 클수록 좋은 기록으로 보므로, 적게 막을수록 커지게 막은 수에 마이너스를 붙여 건넨다.
     */
    bestOf: (round) => (round.best === null ? null : { value: -round.best, name: fill(T.notebook.best, { k: round.best }) }),
  };
}
