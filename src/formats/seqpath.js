// 수열 길 퍼즐: 판 화면에서 이 형식이 맡는 부분(판, 긋기, 끝났을 때 하는 말, 풀이와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/seqpath.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 수 칸에서 옆 칸으로 끌어 길을 긋는다(src/ui/seqpath-board.js). 길을 누르기만 하면 지워진다.
// 손을 뗄 때마다 방금 그은 길을 본다. 수의 차례가 어긋난 길(뛰는 크기가 다르다, 커지다가 작아진다)이면 틀렸다고 하지 않고
// 그 길이 지나는 수와 뛰는 크기를 사실대로만 말한다. 판에서는 그 길을 점선으로 그린다.
// 모든 칸을 지나고 길마다 약속에 맞으면 판이 끝난다(답이 하나뿐인 판이라 그은 길이 곧 그 답이다. 직접 만든 판은 어느 답이든 된다).
// 사다리에는 길을 이을 수 없는 판이 없다. 그래서 "불가능해요" 단추가 없다.
// "한 번 무르기"는 길을 바꾸기 전으로, "처음으로 되돌리기"는 모든 길을 지운다. 둘 다 횟수를 화면에 적지 않는다.
// 판의 종류(mode): four(4×4), five(5×5), same(모든 길이 같은 간격), six(6×6), eight(8×8), made(직접 만든 판)
import T from '../content/seqpath.json';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf } from '../core/seqpath-ladder.js';
import { MAX_SIZE, MAX_VALUE, MIN_SIZE, brokenWhy, checkBoard, copyBoard, countSolutions, freeCells, isDone, judgePath, numberCount, pathsKey, pathsOk, xyOf } from '../core/seqpath.js';
import { smallerSeqpath } from '../core/smaller.js';
import { fill, ordinal } from '../core/text.js';
import { drawSeq, seqCard } from '../ui/seqpath-board.js';

const FORMAT = 'seqpath';
const MODES = ['four', 'five', 'same', 'six', 'eight', 'made'];
/** 기록에 남기는 무르기 차례와 칸이 남았던 모습의 수의 위 끝 */
const MAX_MOVES = 400;
const MAX_STUCKS = 40;
/** 직접 만들기에서 선생님이 세는 방법의 수의 위 끝, 따져 보는 걸음의 위 끝(넘으면 끝까지 세지 못했다고 말한다) */
export const MAKE_LIMIT = 10;
export const MAKE_BUDGET = 400000;
/** 직접 만들기의 처음 판: 4×4 빈 판 */
const firstDraft = () => ({ w: 4, h: 4, values: new Array(16).fill(null) });

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createSeqpath(frame) {
  const { $, log } = frame;
  let flash = null; // 판 아래에 잠깐 적는 한 줄. 다음에 무엇을 누르면 지운다
  let draft = null; // 직접 만들기에서 만들던 판
  let picked = null; // 직접 만들기에서 고른 칸
  let fresh = true; // 고른 칸에 처음 누르는 숫자인가(그렇다면 원래 수를 바꾼다)
  let made = null; // 직접 만들기에서 선생님이 따진 것(판을 고치면 지운다)

  const count = (value) => Number.isInteger(value) && value >= 0;
  const ruleKey = (round) => (round.mode === 'same' ? 'same' : 'paths');

  /** 한 번 푼 판은 적어 둔다(판을 열 때마다, 기록을 남길 때마다 다시 풀지 않게) */
  const memo = new Map();
  function solutionOf(board) {
    const key = JSON.stringify(copyBoard(board));
    if (!memo.has(key)) {
      const result = countSolutions(board, { limit: 2, budget: MAKE_BUDGET });
      memo.set(key, { possible: result.paths !== null, count: result.count, complete: result.complete, paths: result.paths });
    }
    return memo.get(key);
  }

  /** 길의 모양: 약속에 맞는 길, 수의 차례가 어긋난 길, 아직 덜 그은 길 */
  function kindOf(board, path) {
    const judged = judgePath(board, path);
    if (judged.ok) return 'ok';
    return brokenWhy(judged.why) ? 'broken' : 'open';
  }

  // ---- 이름표 ----
  function labelOf(board, paths) {
    const on = new Set(paths.flat());
    return (cell) => {
      const [x, y] = xyOf(board, cell);
      const value = board.values[cell];
      let face = value === null ? T.labels.empty : fill(T.labels.number, { n: value });
      if (on.has(cell)) face = fill(T.labels.passed, { face });
      return fill(T.labels.cell, { no: ordinal(y + 1), f: ordinal(x + 1), face });
    };
  }

  // ---- 판 ----
  function draw() {
    const { round } = frame;
    const { board } = round;
    const playing = !round.done;
    const paths = round.paths;
    drawSeq($('seqpath-board'), {
      ...board,
      paths,
      kinds: paths.map((path) => kindOf(board, path)),
      kindOf: (path) => kindOf(board, path),
      label: labelOf(board, paths),
      onDraw: playing ? changePaths : undefined,
      onErase: playing ? erase : undefined,
      onMiss: playing ? miss : undefined,
      onStill: playing ? still : undefined,
    });
    $('seqpath-paths').textContent = String(paths.length);
    $('seqpath-left').textContent = String(freeCells(board, paths).length);
    $('seqpath-status').textContent = flash ?? statusOf(round, playing);
    $('undo').disabled = !playing || round.moves.length === 0;
    $('reset').disabled = !playing || paths.length === 0;
    frame.showWhy();
  }

  function statusOf(round, playing) {
    if (!playing) return '';
    const { board, paths } = round;
    if (paths.length === 0) return T.status.begin;
    const broken = paths.some((path) => kindOf(board, path) === 'broken');
    if (freeCells(board, paths).length === 0) return broken || !isDone(board, paths) ? T.status.covered : T.status.done;
    if (broken) return T.status.broken;
    return '';
  }

  /** 길을 그었다(손을 뗐다). info.active는 방금 늘이거나 이은 길이다 */
  function changePaths(next, info) {
    const { round } = frame;
    if (!round || round.done) return;
    const { board } = round;
    flash = null;
    const before = round.paths;
    if (!pathsOk(board, next) || pathsKey(next) === pathsKey(before)) {
      draw();
      return;
    }
    round.moves = [...round.moves, { paths: before.map((path) => path.slice()) }].slice(-MAX_MOVES);
    round.paths = next.map((path) => path.slice());
    round.strokeCount += 1;
    frame.note('path', { cells: info.active.length, head: info.head, paths: next.length });
    if (isDone(board, round.paths)) {
      solved();
      return;
    }
    const said = tell(info.active);
    draw();
    frame.persist();
    if (said) frame.say(said);
  }

  /** 길을 그은 뒤에 하는 말: 방금 그은 길의 수가 어긋났을 때, 모든 칸을 지났는데 맞지 않을 때, 수는 다 썼는데 칸이 남았을 때 */
  function tell(active) {
    const { round } = frame;
    const { board, paths } = round;
    if (active.length >= 2) {
      const judged = judgePath(board, active);
      if (brokenWhy(judged.why)) {
        round.brokenCount += 1;
        round.wrongCount += 1;
        frame.note('broken', { why: judged.why, numbers: judged.numbers });
        const sizes = judged.jumps.map((jump) => Math.abs(jump));
        const other = sizes.find((size) => size !== sizes[0]) ?? sizes[0];
        return fill(T.play[judged.why], { face: judged.numbers.join(', '), n: sizes[0], k: other });
      }
      if (judged.why === 'end') flash = T.status.open;
      else if (judged.why === 'few') flash = fill(T.status.few, { n: judged.numbers.length });
    }
    const left = freeCells(board, paths).length;
    if (left === 0) {
      const wrong = paths.filter((path) => !judgePath(board, path).ok).length;
      return fill(T.play.covered, { n: wrong });
    }
    // 수는 모두 길에 들어갔고 길마다 약속에 맞는데, 길이 지나지 않은 칸이 남았다
    const used = new Set(paths.flat());
    const allNumbers = board.values.every((value, cell) => value === null || used.has(cell));
    if (allNumbers && paths.every((path) => judgePath(board, path).ok)) {
      const key = pathsKey(paths);
      const same = round.stucks.includes(key);
      round.stuckCount += 1;
      round.stucks = [...round.stucks, key].slice(-MAX_STUCKS);
      frame.note('stuck', { left, same });
      return same ? T.play['numbers-same'] : fill(T.play['numbers-used'], { n: left });
    }
    return null;
  }

  /** 다 이었다 */
  function solved() {
    const { round } = frame;
    round.answers.push({ t: frame.stamp(), answer: 'done', correct: true, guess: null });
    frame.note('answer', { answer: 'done', correct: true, guess: null });
    frame.finish('solved');
  }

  /** 길을 누르기만 하고 뗐다: 그 길을 지운다 */
  function erase(index) {
    const { round } = frame;
    if (!round || round.done || !round.paths[index]) return;
    round.moves = [...round.moves, { paths: round.paths.map((path) => path.slice()) }].slice(-MAX_MOVES);
    round.paths = round.paths.filter((_, other) => other !== index);
    round.eraseCount += 1;
    flash = T.status.erased;
    frame.note('erase', { paths: round.paths.length });
    draw();
    frame.persist();
    // 지운 길에 한 말은 이제 맞지 않으니 덮는다
    frame.say(T.play.erase);
  }

  /** 길도 수도 없는 칸에서 긋기 시작했다 */
  function miss() {
    const { round } = frame;
    if (!round || round.done) return;
    round.missCount += 1;
    flash = T.status.miss;
    draw();
  }

  /** 수 칸을 누르기만 하고 뗐다 */
  function still() {
    const { round } = frame;
    if (!round || round.done) return;
    flash = T.status.still;
    draw();
  }

  /** 한 번 무르기: 길을 바꾸기 전으로 */
  function undo() {
    const { round } = frame;
    if (round.done || round.moves.length === 0) return;
    round.paths = round.moves.at(-1).paths.map((path) => path.slice());
    round.moves = round.moves.slice(0, -1);
    round.undoCount += 1;
    flash = null;
    frame.note('undo');
    draw();
    frame.persist();
    // 앞의 길에 한 말은 이제 맞지 않으니 덮는다
    frame.say(T.play.undo);
  }

  /** 처음으로: 모든 길을 지운다. 무르기로 돌아올 수 있다 */
  function reset() {
    const { round } = frame;
    if (round.done || round.paths.length === 0) return;
    round.moves = [...round.moves, { paths: round.paths.map((path) => path.slice()) }].slice(-MAX_MOVES);
    round.paths = [];
    round.resetCount += 1;
    flash = null;
    frame.note('reset');
    draw();
    frame.persist();
    frame.say(T.play.reset);
  }

  // ---- 끝났을 때 하는 말: 한 일을 그대로 말한다 ----
  function rightLine(round, solution) {
    const parts = [fill(T.right.done, { n: round.paths.length })];
    const back = round.undoCount + round.resetCount + round.eraseCount;
    parts.push(back === 0 ? T.right.clean : fill(T.right.back, { n: back }));
    if (solution.count === 1 && solution.complete) parts.push(T.right.unique);
    else if (solution.count >= 2) parts.push(T.right.other);
    return parts;
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----
  function rowOf(cards) {
    const row = document.createElement('div');
    row.className = 'figure-row';
    row.append(...cards);
    return row;
  }

  const answerView = (board, paths) => ({ ...board, paths, kinds: paths.map(() => 'ok') });

  function solutionPages(round, solution) {
    const { board } = round;
    const paths = solution.paths ?? [];
    const say = solution.count === 1 && solution.complete ? T.solution.one : T.solution.some;
    return [{ say, nodes: [rowOf([seqCard(answerView(board, paths), '', { big: true })])] }];
  }

  /** "왜 그럴까?": 선생님이 수만 보고 잇다가 구석 빈칸이 남은 이야기 */
  function whyPages() {
    return T.why.map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다(단추를 보일지 따질 때마다 그리지 않는다).
      get nodes() {
        return [rowOf(slide.figures.map((item) => seqCard({ ...item.board, paths: item.paths, kinds: item.paths.map((path) => kindOf(item.board, path)), rings: item.rings }, item.note, { big: slide.figures.length === 1 })))];
      },
    }));
  }

  // ---- 직접 만들기: 크기를 정하고, 칸을 골라 숫자판으로 수를 적는다 ----
  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    if (saved && checkBoard(saved) === null) return copyBoard(saved);
    return firstDraft();
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    picked = null;
    fresh = true;
    made = null;
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function drawMake() {
    $('seqpath-make-w').textContent = fill(T.make.size, { n: draft.w });
    $('seqpath-make-h').textContent = fill(T.make.size, { n: draft.h });
    $('seqpath-make-w-fewer').disabled = draft.w <= MIN_SIZE;
    $('seqpath-make-w-more').disabled = draft.w >= MAX_SIZE;
    $('seqpath-make-h-fewer').disabled = draft.h <= MIN_SIZE;
    $('seqpath-make-h-more').disabled = draft.h >= MAX_SIZE;
    $('seqpath-make-clear').disabled = numberCount(draft) === 0;
    for (const button of $('seqpath-make-keys').querySelectorAll('button')) button.disabled = picked === null;
    drawSeq($('seqpath-make-board'), { ...draft, paths: [], picked, label: labelOf(draft, []), onCell: pickCell });
    $('seqpath-make-result').textContent = made ? made.line : '';
    $('seqpath-make-picture').replaceChildren(...(made?.card ? [made.card] : []));
  }

  function changeDraft(next) {
    draft = copyBoard(next);
    made = null;
    log.saveDraft(draft, FORMAT);
    drawMake();
  }

  /** 칸을 골랐다. 고른 칸에 처음 누르는 숫자는 원래 수를 바꾸고, 그다음 숫자는 뒤에 붙인다 */
  function pickCell(cell) {
    picked = cell;
    fresh = true;
    drawMake();
  }

  /** 숫자판을 눌렀다 */
  function pressKey(key) {
    if (picked === null || !draft) return;
    const values = draft.values.slice();
    if (key === 'erase') {
      values[picked] = null;
      fresh = true;
    } else {
      const digit = Number(key);
      if (!Number.isInteger(digit) || digit < 0 || digit > 9) return;
      const current = values[picked];
      let next = fresh || current === null ? digit : current * 10 + digit;
      if (next > MAX_VALUE) next = digit;
      values[picked] = next;
      fresh = false;
    }
    changeDraft({ ...draft, values });
  }

  /** 크기를 바꾼다. 적은 수는 같은 자리(가로, 세로)에 그대로 두고, 판 밖으로 나간 것은 버린다 */
  function resize(w, h) {
    if (w < MIN_SIZE || h < MIN_SIZE || w > MAX_SIZE || h > MAX_SIZE) return;
    const values = new Array(w * h).fill(null);
    draft.values.forEach((value, cell) => {
      const [x, y] = xyOf(draft, cell);
      if (x < w && y < h) values[y * w + x] = value;
    });
    if (picked !== null) {
      const [x, y] = xyOf(draft, picked);
      picked = x < w && y < h ? y * w + x : null;
    }
    changeDraft({ w, h, values });
  }

  function clearAll() {
    picked = null;
    changeDraft({ ...draft, values: new Array(draft.w * draft.h).fill(null) });
  }

  /** 아이가 만든 판을 풀이 프로그램으로 세어 알려 준다. 방법이 있으면 그 가운데 하나를 그려 보인다 */
  function solveDraft() {
    const board = copyBoard(draft);
    const result = countSolutions(board, { limit: MAKE_LIMIT + 1, budget: MAKE_BUDGET });
    const reached = result.count > MAKE_LIMIT;
    let line;
    if (!result.complete && !reached) line = result.count === 0 ? T.make['far-none'] : fill(T.make.far, { n: result.count });
    else if (result.count === 0) line = T.make.none;
    else if (result.count === 1) line = T.make.one;
    else if (reached) line = fill(T.make.many, { n: MAKE_LIMIT });
    else line = fill(T.make.some, { n: result.count });
    const card = result.paths ? seqCard(answerView(board, result.paths), '') : null;
    made = { line, card };
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
      solution: { count: result.count, complete: result.complete, reached, paths: result.paths },
    });
    log.flush();
    frame.talkers.make.say(line);
  }

  /** 다 만든 판(공책에 남기거나 해 볼 판): 수가 셋 이상 적힌 판 */
  const madeBoard = () => (draft && checkBoard(draft) === null && numberCount(draft) >= 3 ? copyBoard(draft) : null);

  function playDraft() {
    const board = madeBoard();
    if (!board) {
      frame.talkers.make.say(T.make['keep-not-yet']);
      return;
    }
    // 길을 잇는 방법을 하나라도 찾은 판만 해 본다(끝낼 수 없는 판을 열지 않는다)
    if (!solutionOf(board).possible) {
      frame.talkers.make.say(T.make['play-none']);
      return;
    }
    frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board });
  }

  // ---- 단추 잇기 ----
  $('seqpath-make-w-fewer').addEventListener('click', () => resize(draft.w - 1, draft.h));
  $('seqpath-make-w-more').addEventListener('click', () => resize(draft.w + 1, draft.h));
  $('seqpath-make-h-fewer').addEventListener('click', () => resize(draft.w, draft.h - 1));
  $('seqpath-make-h-more').addEventListener('click', () => resize(draft.w, draft.h + 1));
  $('seqpath-make-clear').addEventListener('click', clearAll);
  $('seqpath-make-keys').addEventListener('click', (event) => {
    const key = event.target.closest('button')?.dataset.n;
    if (key !== undefined) pressKey(key);
  });
  $('seqpath-make-solve').addEventListener('click', solveDraft);
  $('seqpath-make-play').addEventListener('click', playDraft);

  /** 판의 처음 값(새 판, 공책의 그림) */
  function begin({ level, custom, board }) {
    return {
      mode: custom ? 'made' : rungOf(level).mode,
      board: copyBoard(board), // 판: 크기와 칸마다의 수
      paths: [], // 그은 길들(칸 번호의 줄)
      moves: [], // 무르기에 쓰는 차례: { paths: 그 전의 길들 }
      strokeCount: 0, // 길을 바꾼 수(긋기)
      eraseCount: 0, // 길을 눌러 지운 수
      undoCount: 0,
      resetCount: 0,
      brokenCount: 0, // 수의 차례가 어긋난 길을 그은 수
      missCount: 0, // 길도 수도 없는 칸에서 긋기 시작한 수
      stuckCount: 0, // 수는 다 썼는데 칸이 남았던 수
      stucks: [], // 그때의 길들
      wrongCount: 0, // 사실과 다른 답의 수(수의 차례가 어긋난 길)
    };
  }

  return {
    id: FORMAT,
    T,
    padId: 'seqpath-pad',
    makeId: 'make-seqpath',
    // 8×8 판은 위아래로 크다. 규칙 글은 왼쪽 칸 맨 위에 두고 판을 크게 그린다(칸 하나가 44픽셀보다 작아지지 않게).
    ruleAside: true,
    homeIds: { sample: 'home-seqpath-sample', blank: 'home-seqpath-blank', ask: 'home-seqpath-ask', play: 'home-seqpath-play', pick: 'home-seqpath-pick', make: 'home-seqpath-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    begin,
    solve: (round) => solutionOf(round.board),
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (!MODES.includes(saved.mode) || checkBoard(saved.board) !== null) return false;
      if (!pathsOk(saved.board, saved.paths)) return false;
      if (!Array.isArray(saved.moves) || !saved.moves.every((move) => pathsOk(saved.board, move?.paths))) return false;
      if (!Array.isArray(saved.stucks)) return false;
      return [saved.strokeCount, saved.eraseCount, saved.undoCount, saved.resetCount, saved.brokenCount, saved.missCount, saved.stuckCount, saved.wrongCount].every(count);
    },
    /** 판 화면에서 이 형식의 것(판, 판 아래의 글)을 보이거나 감춘다 */
    showParts(on) {
      $('seqpath-board').hidden = !on;
      $('seqpath-count').hidden = !on;
      if (on) {
        // 앞의 형식이 감춰 둔 무르기와 되돌리기를 여기서 다시 보이게 한다.
        $('undo').hidden = false;
        $('reset').hidden = false;
      }
    },
    enter() {
      flash = null;
    },
    draw,
    ended() {
      flash = null;
    },
    ruleLine: (round) => T.rules[ruleKey(round)],
    hints: (round) => T.hints[ruleKey(round)],
    touched: (round) => round.strokeCount > 0 || round.eraseCount > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view(round) {
      return { paths: round.paths.map((path) => path.slice()), left: freeCells(round.board, round.paths).length };
    },
    /** 이 판보다 작은 판: 같은 종류(뛰는 크기, 같은 간격)의 더 작은 판. 모두 답이 하나뿐인 판이다 */
    smaller: (round, turn) => smallerSeqpath({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        solution: { count: solution.count, complete: solution.complete, paths: solution.paths },
        // 판을 떠날 때의 길과 남은 칸
        paths: round.paths,
        left: freeCells(round.board, round.paths).length,
        // 수준 맞추기가 보는 손댄 수와 "틀린 답"의 수
        moveCount: round.strokeCount,
        strokeCount: round.strokeCount,
        eraseCount: round.eraseCount,
        undoCount: round.undoCount,
        resetCount: round.resetCount,
        brokenCount: round.brokenCount,
        missCount: round.missCount,
        stuckCount: round.stuckCount,
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
    homeAsk: (level) => T.home.ask[rungOf(level).mode],
    pickLine: () => T.home.pick,
    drawSample(root, board) {
      drawSeq(root, { ...board, small: true });
    },
    drawBlank(root) {
      drawSeq(root, { ...firstDraft(), small: true });
    },
    /** 하던 판과 공책의 그림: 그은 길 */
    drawResume(root, saved) {
      const { board } = saved;
      const paths = pathsOk(board, saved.paths) ? saved.paths : [];
      drawSeq(root, { ...board, paths, kinds: paths.map((path) => kindOf(board, path)), small: true });
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 판 하나 */
    drawLevelPicture(root, entry) {
      const picture = entry.picture;
      if (picture.blank) {
        drawSeq(root, { ...firstDraft(), small: true });
        return;
      }
      drawSeq(root, { ...generateBoard(entry.level, picture.seed).board, small: true });
    },
    showMake,
    /** 직접 만들기에서 다 만든 판(공책에 남기기가 쓴다) */
    madeBoard,
  };
}
