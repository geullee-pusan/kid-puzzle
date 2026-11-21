// 그물 끊기: 판 화면에서 이 형식이 맡는 부분(판, 줄 끊기와 잇기, 짐작하는 칸, 끝났을 때 하는 말, 풀이와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/net.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 매듭과 줄로 된 그물에서 줄을 하나씩 눌러 끊는다(끊은 줄을 다시 누르면 이어진다). 그물이 갈라지는 줄도 끊을 수 있다.
// 그러면 갈라진 조각이 다른 색과 선의 모양으로 그려지고 판 아래에 사실을 적는다. 갈라진 동안에는 판이 끝나지 않는다.
// 조각 수가 처음과 같고 남은 줄에 고리가 없으면 더 끊을 줄이 없는 것이다. 그때 판이 끝나고, 끊은 줄의 수를 사실로 말한다.
// 그 수는 어떤 차례로 끊어도 늘 같다. 끝난 뒤 "같은 그물 다르게 끊기"로 같은 판을 다시 해 보면 지난번과 견주어 말한다.
// 판 아래에는 끊은 줄, 남은 줄, 조각의 수를 늘 적는다. 선생님은 판정하지 않는다.
// 판의 종류: 끊어 보기, 짐작하고 끊기(먼저 몇 줄일지 짐작한다), 두 그물 견주기(어느 그물에서 더 끊을지 먼저 고른다),
// 큰 그물 세어 보기(먼저 몇 줄일지 짐작한다), 두 조각 그물(먼저 몇 줄일지 짐작한다). 짐작은 맞다 틀리다 하지 않고 기록에만 남긴다.
// 왼쪽 칸의 "고리 찾기"를 켜면 남은 고리 하나(가장 짧은 것)를 판에 눈에 띄게 그린다. 처음 켤 때 힌트 하나로 센다.
import T from '../content/net.json';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, base, generateBoard, island, nextSeed, rungOf } from '../core/net-ladder.js';
import { MAX_GUESS, MAX_MOVES, MIN_KNOTS, checkBoard, copyBoard, cutOf, cutPerNet, loopOf, maxCut, movesOk, netsOf, piecesOf, solve, stateOf } from '../core/net.js';
import { smallerNet } from '../core/smaller.js';
import { fill, ordinal } from '../core/text.js';
import { drawNet, netCard } from '../ui/net-board.js';

const FORMAT = 'net';
const MODES = ['cut', 'guess', 'twins', 'predict', 'pieces', 'made'];
/** 몇 줄일지 수로 짐작하는 판 */
const NUMBER_GUESS = ['guess', 'predict', 'pieces'];
const TWIN_GUESSES = ['left', 'same', 'right'];
/** 직접 만들기의 모눈: 가로 6개, 세로 4개의 점 */
const MAKE_AREA = { minX: 0, minY: 0, maxX: 5, maxY: 3 };
/** 직접 만들기의 처음 그물: 네모 하나 */
const FIRST_DRAFT = { knots: [[1, 1], [2, 1], [2, 2], [1, 2]], strings: [[0, 1], [1, 2], [2, 3], [3, 0]], family: 'made' };
/** 처음 화면과 판 고르기에 그리는 빈 판(매듭 9개의 고기 그물) */
const BLANK = () => base('grid3x3');
/** "왜 그럴까?"의 그림에 쓰는 그물 */
const FIGURES = { grid3x3: () => base('grid3x3'), island44: () => island(4, 4, 0) };

const count = (value) => Number.isInteger(value) && value >= 0;
const sameSet = (a, b) => a.length === b.length && a.every((item, index) => item === b[index]);

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createNet(frame) {
  const { $, log } = frame;
  let flash = null; // 판 아래에 잠깐 적는 한 줄. 다음에 무엇을 누르면 지운다
  let pending = 1; // 짐작 칸에 지금 보이는 수(아직 고르지 않은 짐작)
  let preset = null; // "같은 그물 다르게 끊기"로 여는 판에 넘길 것 { before, againOf }
  let draft = null; // 직접 만들기에서 만들던 그물
  let picked = null; // 직접 만들기에서 고른 매듭
  let made = null; // 직접 만들기에서 선생님이 끊어 본 것(그물을 고치면 지운다)

  const needGuess = (round) => !round.again && round.guess === null && (NUMBER_GUESS.includes(round.mode) || round.mode === 'twins');
  const cutNow = (round) => cutOf(round.moves);
  const startPieces = (board) => piecesOf(board.knots.length, board.strings).count;

  /** 읽어 주는 이름: 줄의 차례와 끊겼는지 */
  const labelOf = (index, off) => fill(T.labels[off ? 'off' : 'on'], { no: ordinal(index + 1) });

  // ---- 판 ----
  function draw() {
    const { round } = frame;
    const { board } = round;
    const cut = cutNow(round);
    const state = stateOf(board, cut);
    const playing = !round.done;
    const asking = needGuess(round);
    const live = playing && !asking;
    drawNet($('net-board'), {
      board,
      cut,
      loop: round.loopOn ? loopOf(board, cut) : null,
      label: labelOf,
      onString: live ? tapString : undefined,
    });
    $('net-cut').textContent = String(state.cut);
    $('net-left').textContent = String(state.left);
    $('net-pieces').textContent = String(state.pieces);
    $('net-status').textContent = flash ?? statusOf(round, state);
    $('undo').disabled = !playing || round.moves.length === 0;
    $('reset').disabled = !playing || round.moves.length === 0;

    // 오른쪽 칸: 짐작(수 또는 두 그물), 적어 둔 짐작, 누르는 법
    $('net-guess-box').hidden = !(playing && asking && NUMBER_GUESS.includes(round.mode));
    $('net-twins-box').hidden = !(playing && asking && round.mode === 'twins');
    $('net-guess-now').textContent = fill(T.lines, { n: pending });
    $('net-guess-fewer').disabled = pending <= 0;
    $('net-guess-more').disabled = pending >= MAX_GUESS;
    const guessed = round.guess !== null;
    $('net-guess-line').hidden = !guessed;
    if (guessed) $('net-guess-line').textContent = round.mode === 'twins' ? T.twinsLine[round.guess] : fill(T.guessLine, { n: round.guess });
    $('net-howto').hidden = asking;

    // 왼쪽 칸: 고리 찾기
    $('net-loop').textContent = T.tool[round.loopOn ? 'on' : 'off'];
    $('net-loop').setAttribute('aria-pressed', String(round.loopOn));

    // 끝난 뒤 고르기에 "같은 그물 다르게 끊기"를 더한다(작은 판을 끝낸 뒤에는 틀의 두 단추만 나온다)
    const again = round.done && round.outcome === 'solved' && !round.side;
    $('net-again').hidden = !again;
    if (again) $('after-same').before($('net-again'));
    frame.showWhy();
  }

  function statusOf(round, state) {
    if (round.done) return fill(T.status.done, { k: state.cut });
    if (needGuess(round)) return T.status[round.mode === 'twins' ? 'twins' : 'guess'];
    if (state.split) return fill(T.status.split, { n: state.pieces });
    if (round.moves.length === 0) return T.status.start;
    return state.start === 1 ? T.status['kept-one'] : T.status.kept;
  }

  // ---- 끊기와 잇기 ----
  /** 아이가 줄을 눌렀다: 이어진 줄은 끊고, 끊긴 줄은 다시 잇는다 */
  function tapString(index) {
    const { round } = frame;
    if (!round || round.done || needGuess(round)) return;
    const before = cutNow(round);
    const restoring = before.includes(index);
    round.moves = [...round.moves, index];
    // 기록이 너무 길어지면 지금 끊긴 줄만 남긴다(모습은 같다)
    if (round.moves.length > MAX_MOVES) round.moves = cutOf(round.moves);
    round.moveCount += 1;
    const cut = cutNow(round);
    const state = stateOf(round.board, cut);
    if (restoring) round.restoreCount += 1;
    else if (state.pieces > stateOf(round.board, before).pieces) round.splitCount += 1;
    frame.note(restoring ? 'tie' : 'cut', { string: index, pieces: state.pieces });
    flash = restoring && !state.split ? T.status.restored : null;
    if (state.done) {
      round.answers.push({ t: frame.stamp(), answer: String(state.cut), correct: true, guess: null });
      frame.finish('solved');
      return;
    }
    draw();
    frame.persist();
  }

  function undo() {
    const { round } = frame;
    if (round.done || round.moves.length === 0) return;
    round.moves = round.moves.slice(0, -1);
    round.undoCount += 1;
    flash = null;
    frame.note('undo');
    draw();
    frame.persist();
    // 앞의 모습에 한 말은 이제 맞지 않을 수 있으니 덮는다
    frame.say(T.play.undo);
  }

  function reset() {
    const { round } = frame;
    if (round.done || round.moves.length === 0) return;
    round.moves = [];
    round.resetCount += 1;
    flash = null;
    frame.note('reset');
    draw();
    frame.persist();
    frame.say(T.play.reset);
  }

  // ---- 짐작: 기록에만 남기고 맞다 틀리다 하지 않는다 ----
  function guess(value) {
    const { round } = frame;
    if (!round || round.done || !needGuess(round)) return;
    round.guess = value;
    round.guessAt = frame.stamp();
    frame.note('guess', { guess: value });
    draw();
    frame.persist();
    frame.say(T.play.guessed);
  }

  function nudge(step) {
    const { round } = frame;
    if (!round || round.done || !needGuess(round) || !NUMBER_GUESS.includes(round.mode)) return;
    pending = Math.max(0, Math.min(MAX_GUESS, pending + step));
    draw();
  }

  // ---- 고리 찾기 ----
  function toggleLoop() {
    const { round } = frame;
    if (!round) return;
    round.loopOn = !round.loopOn;
    flash = null;
    if (round.loopOn) {
      round.loopShown = true;
      round.loopCount += 1;
      if (!round.done && loopOf(round.board, cutNow(round)) === null) flash = T.status['no-loop'];
    }
    frame.note('loop', { on: round.loopOn });
    draw();
    frame.keep();
  }

  // ---- 끝난 뒤: 같은 그물 다르게 끊기 ----
  function again() {
    const { round } = frame;
    if (!round || !round.done || round.side) return;
    const next = { before: { cut: cutNow(round) }, againOf: round.id };
    const start = { level: round.level, seed: round.seed, small: round.small, custom: round.custom, board: copyBoard(round.board) };
    frame.chooseAfter('again', () => {
      preset = next;
      frame.startRound(FORMAT, start);
      frame.say(T.play.again);
    });
  }

  // ---- 끝났을 때 하는 말: 한 일과 사실만 말한다 ----
  function rightLine(round) {
    const { board } = round;
    const cut = cutNow(round);
    const parts = [fill(T.right.done, { k: cut.length })];
    if (round.mode === 'twins') {
      const [left, right] = cutPerNet(board, cut);
      const nets = netsOf(board);
      parts.push(fill(T.right.twins, { k: left, n: right }));
      parts.push(nets[0].strings === nets[1].strings ? fill(T.right['twins-same'], { n: nets[0].knots, k: nets[0].strings }) : T.right['twins-differ']);
    }
    if (round.mode === 'predict') parts.push(fill(T.right.count, { n: board.knots.length, k: board.strings.length - cut.length }));
    if (round.mode === 'pieces') {
      const pieces = startPieces(board);
      parts.push(pieces > 1 ? fill(T.right['pieces-many'], { n: pieces }) : T.right['pieces-one']);
    }
    if (round.before) parts.push(sameSet(round.before.cut, cut) ? T.right['again-same'] : T.right['again-other']);
    else if (round.guess === null) parts.push(fill(T.right['cut-next'], { k: cut.length }));
    if (round.guess !== null) parts.push(round.mode === 'twins' ? T.right[`twins-guess-${round.guess}`] : fill(T.right['guess-was'], { n: round.guess }));
    // 이 형식의 판을 처음 끝까지 했으면 "왜 그럴까?"가 열렸다는 것을 알려 준다
    const finished = new Set(frame.records().filter((record) => record.kind === 'round' && record.format === FORMAT && record.outcome === 'solved').map((record) => record.id));
    if (!round.side && finished.size === 1 && finished.has(round.id)) parts.push(T.right['why-open']);
    return parts;
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----
  function rowOf(cards) {
    const row = document.createElement('div');
    row.className = 'figure-row';
    row.append(...cards);
    return row;
  }

  /** 풀이: 더 끊을 줄이 없게 끊은 모습(방법이 둘이면 둘 다) */
  function solutionPages(round, solution) {
    const { board } = round;
    const left = board.strings.length - solution.max;
    const two = solution.ways.length > 1;
    const cards = solution.ways.map((cut) => netCard({ board, cut }, fill(T.solution.note, { n: left }), { big: !two, mid: two }));
    return [{ say: fill(T.solution[two ? 'two' : 'one'], { k: solution.max }), nodes: [rowOf(cards)] }];
  }

  /** "왜 그럴까?"의 그림 하나 */
  function figureView(item) {
    const board = FIGURES[item.board]();
    const cut = item.cut ?? [];
    return { board, cut, only: item.keep ?? null, loop: item.loop ? loopOf(board, cut) : null };
  }

  /** "왜 그럴까?": 두 번 끊어도 같은 수 → 끝에는 고리가 없다 → 나무 모양 기르기(이름) → 줄 수에서 빼기 → 두 조각 그물은 하나 더 */
  function whyPages() {
    return T.why.map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다. 한 장뿐인 그림은 크게, 두 장은 조금 크게 그린다
      get nodes() {
        return [rowOf(slide.figures.map((item) => netCard(figureView(item), item.note, { big: slide.figures.length === 1, mid: slide.figures.length === 2 })))];
      },
    }));
  }

  // ---- 직접 만들기: 모눈의 점에 매듭을 놓고, 이웃한 두 매듭을 차례로 눌러 줄을 잇는다 ----
  const onGrid = (board) => board.knots.every(([x, y]) => Number.isInteger(x) && Number.isInteger(y) && x >= MAKE_AREA.minX && x <= MAKE_AREA.maxX && y >= MAKE_AREA.minY && y <= MAKE_AREA.maxY);

  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    const ok = saved && Array.isArray(saved.knots) && Array.isArray(saved.strings) && saved.knots.length <= 24 && onGrid(saved);
    return ok ? copyBoard(saved) : copyBoard(FIRST_DRAFT);
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
    const cut = made ? made.cut : [];
    drawNet($('net-make-board'), { board: draft, cut, area: MAKE_AREA, dots: true, picked, onSpot: tapSpot });
    $('net-make-drop').disabled = picked === null;
    $('net-make-clear').disabled = draft.knots.length === 0;
    $('net-make-result').textContent = made ? made.line : '';
  }

  function changeDraft(next) {
    const said = made !== null;
    draft = next;
    made = null;
    log.saveDraft(draft, FORMAT);
    drawMake();
    // 앞의 대답은 바뀐 그물에 맞지 않는다
    if (said) frame.talkers.make.say(T.make.changed);
  }

  const knotAt = (x, y) => draft.knots.findIndex((knot) => knot[0] === x && knot[1] === y);
  const neighbors = (a, b) => Math.abs(draft.knots[a][0] - draft.knots[b][0]) + Math.abs(draft.knots[a][1] - draft.knots[b][1]) === 1;

  /** 모눈을 눌렀다: 빈 점이면 매듭을 놓고, 매듭이면 고른다. 고른 매듭의 이웃을 누르면 두 매듭 사이의 줄을 잇거나 푼다 */
  function tapSpot([sx, sy]) {
    const x = Math.round(sx);
    const y = Math.round(sy);
    if (x < MAKE_AREA.minX || x > MAKE_AREA.maxX || y < MAKE_AREA.minY || y > MAKE_AREA.maxY) return;
    if (Math.hypot(sx - x, sy - y) > 0.45) return;
    const existing = knotAt(x, y);
    const next = copyBoard(draft);
    let knot = existing;
    if (knot < 0) {
      next.knots.push([x, y]);
      knot = next.knots.length - 1;
    }
    if (picked !== null && picked !== knot && Math.abs(next.knots[picked][0] - x) + Math.abs(next.knots[picked][1] - y) === 1) {
      const at = next.strings.findIndex(([a, b]) => (a === picked && b === knot) || (a === knot && b === picked));
      if (at >= 0) next.strings.splice(at, 1);
      else next.strings.push([picked, knot]);
    }
    // 고른 매듭을 다시 누르면 고르기를 그만둔다. 아니면 누른 매듭이 고른 매듭이 된다(이어서 그릴 수 있다)
    picked = existing >= 0 && picked === existing ? null : knot;
    changeDraft(next);
  }

  /** 고른 매듭과 그 매듭의 줄을 뺀다 */
  function dropPicked() {
    if (picked === null) return;
    const gone = picked;
    const next = {
      knots: draft.knots.filter((_, index) => index !== gone),
      strings: draft.strings.filter((string) => !string.includes(gone)).map((string) => string.map((knot) => (knot > gone ? knot - 1 : knot))),
      family: 'made',
    };
    picked = null;
    changeDraft(next);
  }

  function clearDraft() {
    picked = null;
    changeDraft({ knots: [], strings: [], family: 'made' });
  }

  /** 다 만든 그물(공책에 남기거나 끊어 볼 판). 매듭이 셋 이상이고, 모든 매듭에 줄이 있어야 한다 */
  function madeBoard() {
    if (!draft || draft.knots.length < MIN_KNOTS || checkBoard(draft) !== null) return null;
    return copyBoard(draft);
  }

  /** 아이가 만든 그물을 선생님이 끊어 보고, 몇 줄까지 끊을 수 있는지 말하고 끊은 모습을 그린다 */
  function solveDraft() {
    const board = madeBoard();
    if (!board) {
      frame.talkers.make.say(T.make['keep-not-yet']);
      return;
    }
    const result = solve(board);
    const left = board.strings.length - result.max;
    const line = result.max === 0 ? T.make.none : result.pieces > 1 ? fill(T.make.many, { n: result.pieces, k: result.max }) : fill(T.make.one, { k: result.max, n: left });
    made = { line, cut: result.ways[0] };
    picked = null;
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
      solution: { possible: true, max: result.max, knots: result.knots, strings: result.strings, pieces: result.pieces },
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
    if (maxCut(board) === 0) {
      frame.talkers.make.say(T.make['play-none']);
      return;
    }
    frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board });
  }

  // ---- 단추 잇기 ----
  $('net-loop').addEventListener('click', toggleLoop);
  $('net-guess-fewer').addEventListener('click', () => nudge(-1));
  $('net-guess-more').addEventListener('click', () => nudge(1));
  $('net-guess-go').addEventListener('click', () => guess(pending));
  $('net-twins-box').addEventListener('click', (event) => {
    const value = event.target.closest('button')?.dataset.twin;
    if (TWIN_GUESSES.includes(value)) guess(value);
  });
  $('net-again').addEventListener('click', again);
  $('net-make-drop').addEventListener('click', dropPicked);
  $('net-make-clear').addEventListener('click', clearDraft);
  $('net-make-solve').addEventListener('click', solveDraft);
  $('net-make-play').addEventListener('click', playDraft);

  /** 판의 처음 값(새 판, 공책의 그림) */
  function begin({ level, custom, board }) {
    const more = preset ?? { before: null, againOf: null };
    preset = null;
    pending = 1;
    return {
      mode: custom ? 'made' : rungOf(level).mode,
      board: copyBoard(board), // 판: 매듭과 줄
      moves: [], // 누른 줄의 차례(같은 줄을 두 번 누르면 다시 이어진다)
      guess: null, // 짐작: 몇 줄일지(수) 또는 어느 그물에서 더 끊을지('left'·'same'·'right'). 맞다 틀리다 하지 않는다
      guessAt: null, // 짐작을 고른 때(초)
      again: more.before !== null, // "같은 그물 다르게 끊기"로 연 판인가(다시 짐작하지 않는다)
      before: more.before, // 그렇다면 지난번에 끊은 줄들 { cut }
      againOf: more.againOf, // 지난번 판의 번호
      moveCount: 0, // 줄을 누른 수(끊기와 잇기)
      splitCount: 0, // 끊어서 그물이 갈라진 수
      restoreCount: 0, // 끊은 줄을 다시 이은 수
      undoCount: 0,
      resetCount: 0,
      wrongCount: 0, // 사실과 다른 답의 수(이 형식에는 답을 내는 단추가 없어서 늘 0)
      loopOn: false, // 지금 "고리 찾기"를 켜 두었는가
      loopShown: false, // 한 번이라도 켰는가
      loopCount: 0, // 켠 수
    };
  }

  /** 적어 둔 판의 단계가 판의 종류와 맞는가 */
  const levelOk = (saved) => {
    if (saved.custom === true) return saved.level === MAKE_LEVEL && saved.mode === 'made';
    if (!Number.isInteger(saved.level) || saved.level < LADDER[0].level || saved.level > TOP_LEVEL) return false;
    return rungOf(saved.level).mode === saved.mode;
  };

  /** 적어 둔 짐작이 판의 종류에 맞는가 */
  const guessOk = (saved) => {
    if (saved.guess === null) return true;
    if (saved.mode === 'twins') return TWIN_GUESSES.includes(saved.guess);
    return NUMBER_GUESS.includes(saved.mode) && Number.isInteger(saved.guess) && saved.guess >= 0 && saved.guess <= MAX_GUESS;
  };

  return {
    id: FORMAT,
    T,
    padId: 'net-pad',
    makeId: 'make-net',
    // 그물이 옆으로 넓다. 규칙 글은 왼쪽 칸 맨 위에 두고 판을 크게 그린다
    ruleAside: true,
    homeIds: { sample: 'home-net-sample', blank: 'home-net-blank', ask: 'home-net-ask', play: 'home-net-play', pick: 'home-net-pick', make: 'home-net-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    begin,
    solve: (round) => solve(round.board),
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (!MODES.includes(saved.mode) || checkBoard(saved.board) !== null || !levelOk(saved)) return false;
      if (!movesOk(saved.board, saved.moves) || !guessOk(saved)) return false;
      if (saved.before !== null && !(saved.before && movesOk(saved.board, saved.before.cut))) return false;
      if (stateOf(saved.board, cutOf(saved.moves)).done) return false;
      if (![saved.moveCount, saved.splitCount, saved.restoreCount, saved.undoCount, saved.resetCount, saved.wrongCount, saved.loopCount].every(count)) return false;
      return [saved.again, saved.loopOn, saved.loopShown].every((value) => typeof value === 'boolean');
    },
    /** 판 화면에서 이 형식의 것(판, 판 아래의 글, 왼쪽 칸의 도구, 끝난 뒤의 단추)을 보이거나 감춘다 */
    showParts(on) {
      $('net-board').hidden = !on;
      $('net-count').hidden = !on;
      $('net-loop').hidden = !on;
      if (on) {
        // 앞의 형식이 감춰 둔 무르기와 되돌리기를 여기서 다시 보이게 한다.
        $('undo').hidden = false;
        $('reset').hidden = false;
      } else {
        $('net-again').hidden = true;
      }
    },
    enter() {
      flash = null;
    },
    draw,
    ended() {
      flash = null;
    },
    ruleLine: (round) => `${T.rules[startPieces(round.board) > 1 ? 'many' : 'one']} ${T.asks[round.mode]}`,
    hints: (round) => T.hints[round.mode],
    touched: (round) => round.moveCount > 0 || round.guess !== null || round.loopCount > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view(round) {
      const cut = cutNow(round);
      const state = stateOf(round.board, cut);
      return { cut, left: state.left, pieces: state.pieces, loops: state.loops, guess: round.guess };
    },
    /** 이 판보다 작은 판: 매듭이 더 적은 같은 종류의 그물(두 그물 견주기는 작은 두 그물, 두 조각 그물은 조각 수가 같은 판) */
    smaller: (round, turn) => smallerNet({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      const cut = cutNow(round);
      const nets = solution.nets;
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        solution: { possible: true, max: solution.max, knots: solution.knots, strings: solution.strings, pieces: solution.pieces },
        // 질문 힌트와 "고리 찾기"를 함께 센다.
        hintsOpened: round.hintsOpened + (round.loopShown ? 1 : 0),
        loopShown: round.loopShown,
        loopCount: round.loopCount,
        // 판을 떠날 때의 모습
        moves: round.moves,
        cut,
        guess: round.guess,
        guessAt: round.guessAt,
        // 짐작이 실제와 같았는가(기록에만 남긴다. 화면에는 알리지 않는다)
        guessMatched:
          round.guess === null
            ? null
            : round.mode === 'twins'
              ? round.guess === (nets[0].max > nets[1].max ? 'left' : nets[0].max < nets[1].max ? 'right' : 'same')
              : round.guess === solution.max,
        again: round.again,
        againOf: round.againOf,
        sameAsBefore: round.before ? sameSet(round.before.cut, cut) : null,
        moveCount: round.moveCount,
        splitCount: round.splitCount,
        restoreCount: round.restoreCount,
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
    /** 글자판: 줄은 저마다 Enter와 빈칸 글쇠로 누른다(판이 맡는다). 짐작하는 동안에는 +와 -로 수를 바꾼다 */
    onKey(event) {
      const { round } = frame;
      if ($('net-pad').hidden || !round || !needGuess(round)) return;
      if (event.key === '+') nudge(1);
      if (event.key === '-') nudge(-1);
    },

    // ---- 처음 화면에 그리는 그림 ----
    homeAsk: (level) => T.home.ask[rungOf(level).mode],
    pickLine: () => T.home.pick,
    drawSample(root, board) {
      drawNet(root, { board, small: true });
    },
    drawBlank(root) {
      drawNet(root, { board: BLANK(), small: true });
    },
    /** 하던 판과 공책의 그림: 지금 끊긴 모습 */
    drawResume(root, saved) {
      drawNet(root, { board: saved.board, cut: cutOf(saved.moves ?? []), small: true });
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 판 하나 */
    drawLevelPicture(root, entry) {
      const board = entry.picture.blank ? BLANK() : generateBoard(entry.level, entry.picture.seed).board;
      drawNet(root, { board, small: true });
    },
    showMake,
    /** 직접 만들기에서 다 만든 판(공책에 남기기가 쓴다) */
    madeBoard,
  };
}
