// 세모 피하기: 판 화면에서 이 형식이 맡는 부분(판, 먼저 그을지 고르기, 선생님이 긋는 차례, 칠할 색 고르기, "세모 없이는 안 돼요",
// 끝났을 때 하는 말, 다시 보기와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/sim.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 판의 종류(mode)는 둘이다.
//   game   선생님과 번갈아 두 점을 이어 선을 긋는다. 아이는 늘 빨간 실선, 선생님은 늘 파란 점선이다.
//          자기 색 선 세 개로 세모(점 세 개를 모두 자기 색으로 이은 것)를 만든 쪽이 진다. 세모 없이 모든 선을 그으면 비긴다.
//          먼저 그을지(order: 'first' | 'second')는 단계가 정하거나(1단계) 두기 전에 아이가 고른다(3, 4단계와 직접 만든 판).
//          판이 끝나면 어떤 세모가 생겼는지와 누가 이겼는지를 사실로만 말한다. 몇 번 이기고 졌는지는 세어 보여 주지 않는다.
//          선생님의 수는 (단계, 판 번호, 먼저 긋는 쪽, 선생님이 두는 법, 지금까지 둔 수들)로 정해진다. 나갔다가 돌아와도 같은 수를 둔다.
//   paint  혼자 모든 선을 빨강이나 파랑으로 칠한다(2, 5단계). 한 색 세모 없이 다 칠하면 끝난다.
//          어떻게 칠해도 한 색 세모가 생기는 판이면 "세모 없이는 안 돼요"가 답이다. 칠한 선을 같은 색으로 한 번 더 칠하면 지워진다.
//          처음부터 칠해 둔 선은 바꿀 수 없다. 한 색 세모가 생기면 그 사실만 말한다(틀렸다고 하지 않는다).
// 선은 두 점을 차례로 누르거나 한 점에서 다른 점으로 끌면 그어진다(칠해진다).
import T from '../content/sim.json';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf, solutionOf, teacherOf } from '../core/sim-ladder.js';
import {
  COLORS,
  LIMITS,
  checkBoard,
  colorsOf,
  copyBoard,
  emptyBoard,
  endsOf,
  lineCount,
  lineOf,
  lostStreak,
  marksOk,
  paintState,
  replay,
  seatOutcome,
  slipsOf,
  solveGame,
  teacherMove,
  trianglesIn,
  whyOpen,
} from '../core/sim.js';
import { smallerSim } from '../core/smaller.js';
import { fill, ordinal } from '../core/text.js';
import { drawSim, penIcon, simCard } from '../ui/sim-board.js';

const FORMAT = 'sim';
const ORDERS = ['first', 'second'];
/** 선생님이 긋기 전에 뜸을 들이는 시간(밀리초, 임시) */
const THINK_MS = 900;
/** 연달아 이만큼 지면 자리를 바꿔 보기를 권한다(임시) */
const SWAP_INVITE_AFTER = 2;
/** 무르기로 돌아갈 수 있는 칠하기의 수 */
const MAX_HISTORY = 80;
/** 처음 화면과 판 고르기에 그리는 빈 판, 직접 만들기의 처음 판 */
const BLANK = emptyBoard('game', 5);
const FIRST_DRAFT = emptyBoard('game', 5);

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createSim(frame) {
  const { $, log } = frame;
  let pick = null; // 하나씩 눌러 골라 둔 점
  let flash = null; // 판 아래에 잠깐 적는 사실. 다음에 무엇을 누르면 지운다
  let timer = null; // 선생님이 뜸을 들이는 중이면 그 타이머
  let preset = null; // 자리를 바꿔서 다시 둘 때, 새 판에 미리 정해 줄 것 { order, rematchOf }
  let draft = null; // 직접 만들기에서 만들던 판
  let draftPick = null; // 직접 만들기에서 골라 둔 점

  const count = (value) => Number.isInteger(value) && value >= 0;
  const ready = (round) => round.mode === 'game' && round.order !== null;
  const firstOf = (round) => (round.order === 'second' ? 'blue' : 'red');
  const isPaint = (round) => round.mode === 'paint';
  const pointLabel = (point) => fill(T.pointLabel, { no: ordinal(point + 1) });

  /** 처음부터 그어 둔 선(given)과 둔 수들로 그릴 선 목록을 만든다 */
  function linesOf(board, placed = []) {
    return [
      ...board.red.map((line) => ({ line, color: 'red', given: true })),
      ...board.blue.map((line) => ({ line, color: 'blue', given: true })),
      ...placed.map((item) => ({ line: item.line, color: item.color, given: false })),
    ];
  }

  /** 게임 판의 그림: 처음 선과 둔 수들, 끝났으면 진 쪽의 세모 */
  function gameView(board, trail, first) {
    const now = replay(board, trail, first);
    const triangles = now.triangle ? [{ points: now.triangle, color: now.loser }] : [];
    return { n: board.n, lines: linesOf(board, now.placed), triangles, fresh: now.placed.length > 0 ? now.placed.at(-1).line : -1 };
  }

  /** 칠하기 판의 그림: 처음부터 칠해 둔 선, 아이가 칠한 선, 없는 선, 한 색 세모 모두 */
  function paintView(board, marks) {
    const state = paintState(board, marks);
    const kid = [];
    state.colors.forEach((color, line) => {
      if (color === 0 || board.red.includes(line) || board.blue.includes(line)) return;
      kid.push({ line, color: color === 1 ? 'red' : 'blue' });
    });
    return { n: board.n, lines: linesOf(board, kid), gone: board.gone, triangles: state.triangles };
  }

  /** 대본의 그림 하나(why와 판 고르기): 선은 두 점씩 적혀 있다. 한 색 세모는 선에서 찾아 칠한다 */
  function figureView(item) {
    const n = item.n;
    const toLines = (pairs = []) => pairs.map(([a, b]) => lineOf(n, a, b)).sort((x, y) => x - y);
    const board = { kind: item.kind ?? 'paint', n, gone: toLines(item.gone), red: toLines(item.red), blue: toLines(item.blue) };
    const red = board.red.reduce((mask, line) => mask | (1 << line), 0);
    const blue = board.blue.reduce((mask, line) => mask | (1 << line), 0);
    const triangles = [...trianglesIn(n, red).map((points) => ({ points, color: 'red' })), ...trianglesIn(n, blue).map((points) => ({ points, color: 'blue' }))];
    return { n, lines: [...board.red.map((line) => ({ line, color: 'red' })), ...board.blue.map((line) => ({ line, color: 'blue' }))], gone: board.gone, triangles, ring: item.ring ?? [] };
  }

  function clearTimer() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  function forget() {
    pick = null;
    flash = null;
    clearTimer();
  }

  // ---- 판 ----
  function gameStatus(round, now) {
    if (!ready(round)) return T.status.choose;
    if (now.over) return now.draw ? T.status['over-draw'] : T.status[`over-${now.loser}`];
    if (now.next !== 'red') return T.status['teacher-turn'];
    if (pick !== null) return T.status.picked;
    // 방금 선생님이 그은 선이 있으면 그것을 적는다.
    if (round.trail.length > 0) return T.status['teacher-drew'];
    return T.status['kid-turn'];
  }

  function paintStatus(round, state) {
    // 끝난 판: 다 칠했는지, 안 되는 판이었는지를 적는다(칠할 색은 적지 않는다).
    if (round.done) return state.done ? T.status.done : frame.solution?.possible === false ? T.status.closed : '';
    if (pick !== null) return T.status.picked;
    if (state.left === 0 && state.triangles.length > 0) return T.status.full;
    if (state.triangles.length > 0) return fill(T.status.triangles, { n: state.triangles.length });
    return fill(T.status.pen, { face: T.pens[round.pen] });
  }

  function drawGame(round) {
    const { board } = round;
    const first = firstOf(round);
    const trail = ready(round) ? round.trail : [];
    const now = replay(board, trail, first);
    const playing = !round.done;
    const live = ready(round) && !now.over && playing;
    const mine = live && now.next === 'red';
    if (!mine) pick = null;
    drawSim($('sim-board'), { ...gameView(board, trail, first), pick, label: pointLabel, onPair: mine ? tryPair : undefined, onTap: mine ? tapPoint : undefined });
    $('sim-status').textContent = flash ?? gameStatus(round, now);
    $('sim-drawn').textContent = String(lineCount(board.n) - now.left);
    $('sim-left').textContent = String(now.left);

    $('sim-game-box').hidden = false;
    $('sim-paint-box').hidden = true;
    $('sim-order').hidden = !(playing && round.order === null);
    $('sim-order-line').hidden = round.order === null;
    if (round.order !== null) $('sim-order-line').textContent = T.orders[round.order];
    $('sim-turn-box').hidden = !live;
    if (live) $('sim-turn').textContent = T.turn[mine ? 'kid' : 'teacher'];

    // 끝난 뒤 고르기에 게임만의 것 둘을 더한다. 진 판 뒤에는 "자리를 바꿔서 다시 두기"를 맨 위에 둔다.
    // 작은 판을 끝낸 뒤에는 틀의 두 단추(원래 판으로 돌아가기, 작은 판 하나 더)만 나온다.
    const done = round.done && !round.side;
    const lost = done && round.winner === 'teacher';
    $('sim-swap').hidden = !(done && ready(round));
    $('sim-replay').hidden = !(done && round.trail.length > 0);
    $('sim-swap').classList.toggle('primary', lost);
    if (done) {
      $(lost ? 'after-same' : 'after-make').before($('sim-swap'), $('sim-replay'));
      // 어느 쪽이 이기는지는 자리를 바꿔 두어 보며 알아낸다. 게임이 끝난 뒤에는 풀이 단추를 두지 않는다.
      $('after-solution').hidden = true;
    }
  }

  function drawPaint(round) {
    const { board } = round;
    const state = paintState(board, round.marks);
    const playing = !round.done;
    if (!playing) pick = null;
    drawSim($('sim-board'), { ...paintView(board, round.marks), pick, label: pointLabel, onPair: playing ? paintPair : undefined, onTap: playing ? tapPoint : undefined });
    $('sim-status').textContent = flash ?? paintStatus(round, state);
    $('sim-drawn').textContent = String(lineCount(board.n) - board.gone.length - state.left);
    $('sim-left').textContent = String(state.left);
    $('sim-game-box').hidden = true;
    $('sim-paint-box').hidden = false;
    for (const color of COLORS) {
      $(`sim-pen-${color}`).setAttribute('aria-pressed', String(round.pen === color));
      $(`sim-pen-${color}`).disabled = !playing;
    }
    $('sim-impossible').disabled = !playing;
    $('undo').disabled = !playing || round.history.length === 0;
    $('reset').disabled = !playing || state.painted === 0;
    $('sim-swap').hidden = true;
    $('sim-replay').hidden = true;
  }

  function draw() {
    const { round } = frame;
    $('undo').hidden = !isPaint(round);
    $('reset').hidden = !isPaint(round);
    if (isPaint(round)) drawPaint(round);
    else drawGame(round);
    frame.showWhy();
    wait();
  }

  /** 선생님 차례면 잠깐 뜸을 들인 뒤에 긋게 한다. 그사이 판이 바뀌었으면 긋지 않는다. */
  function wait() {
    clearTimer();
    const { round } = frame;
    if (!round || round.done || !ready(round)) return;
    const first = firstOf(round);
    const now = replay(round.board, round.trail, first);
    if (now.over || now.next === 'red') return;
    const turns = round.trail.length;
    timer = setTimeout(() => {
      timer = null;
      if (frame.round !== round || round.trail.length !== turns || round.done) return;
      // 직접 만든 판과 작은 판에는 판 번호가 없다.
      const numbered = !round.custom && !round.side;
      const line = teacherMove(round.board, round.trail, { level: numbered ? round.level : null, seed: numbered ? round.seed : null, first, teacher: teacherOf(round.level, round.custom) });
      if (line !== null) play('teacher', line);
    }, THINK_MS);
  }

  /** 선 하나를 긋는다. 차례가 아닌 쪽의 수와 그을 수 없는 수는 두지 않는다. */
  function play(who, line) {
    const { round } = frame;
    if (!ready(round) || round.done) return;
    const first = firstOf(round);
    const before = replay(round.board, round.trail, first);
    const color = who === 'kid' ? 'red' : 'blue';
    if (before.over || before.next !== color) return;
    const after = replay(round.board, [...round.trail, line], first);
    if (!after.ok) return;
    round.trail = [...round.trail, line];
    pick = null;
    flash = null;
    frame.note('move', { by: who, color, turn: round.trail.length, line, ends: endsOf(round.board.n, line) });
    if (after.over) {
      // 세모가 생겼거나 모든 선을 그었다. 이긴 판도 진 판도 비긴 판도 "끝까지 둔 판"으로 끝낸다.
      round.winner = after.draw ? 'draw' : after.winner === 'red' ? 'kid' : 'teacher';
      round.triangle = after.triangle;
      frame.note('over', { winner: round.winner, triangle: after.triangle });
      frame.finish('solved');
      return;
    }
    draw();
    frame.persist();
    if (who === 'teacher') frame.say(T.play['teacher-drew']);
  }

  /** 아이가 고른 두 점을 잇는다. 벌써 이어진 두 점이면 긋지 않고 그 사실을 판 아래에 적는다. */
  function tryPair([a, b]) {
    const { round } = frame;
    if (round.done || !ready(round)) return;
    const line = lineOf(round.board.n, a, b);
    if (line < 0) return;
    const now = replay(round.board, round.trail, firstOf(round));
    if (((now.red | now.blue) >> line) & 1) {
      round.refuseCount += 1;
      frame.note('refuse', { line });
      pick = null;
      flash = T.status.taken;
      draw();
      frame.persist();
      return;
    }
    play('kid', line);
  }

  /** 점 하나를 눌렀다: 고른 점이 없으면 고르고, 있으면 두 점을 잇는다. 같은 점을 다시 누르면 고른 것을 푼다. */
  function tapPoint(point) {
    const { round } = frame;
    if (round.done) return;
    if (pick === null || pick === point) {
      pick = pick === point ? null : point;
      flash = null;
      draw();
      return;
    }
    const from = pick;
    pick = null;
    if (isPaint(round)) paintPair([from, point]);
    else tryPair([from, point]);
  }

  /** "먼저 그을래요" / "나중에 그을래요". 이 고르기가 이 판의 답이다(화면에서는 맞았는지 알리지 않는다). */
  function chooseOrder(order) {
    const { round, solution } = frame;
    if (!round || round.done || round.mode !== 'game' || round.order !== null) return;
    round.order = order;
    // correct: 잘 두면 지지 않는 자리를 골랐는가. 화면에서는 알리지 않는다(두어 보면 알게 된다).
    const correct = seatOutcome(solution, order) !== 'lose';
    round.answers.push({ t: frame.stamp(), answer: order, correct, guess: null });
    frame.note('pick-order', { order, correct });
    draw();
    frame.persist();
    frame.say(T.play[`order-${order}`]);
  }

  // ---- 칠하기 ----
  /** 두 점 사이의 선을 고른 색으로 칠한다. 같은 색이면 지운다. 없는 선과 처음부터 칠해 둔 선은 바꾸지 않고 그 사실을 적는다. */
  function paintPair([a, b]) {
    const { round } = frame;
    if (round.done || !isPaint(round)) return;
    const { board } = round;
    const line = lineOf(board.n, a, b);
    if (line < 0) return;
    pick = null;
    if (board.gone.includes(line) || board.red.includes(line) || board.blue.includes(line)) {
      round.refuseCount += 1;
      frame.note('refuse', { line });
      flash = board.gone.includes(line) ? T.status.gone : T.status.given;
      draw();
      frame.persist();
      return;
    }
    flash = null;
    const before = paintState(board, round.marks);
    const value = round.pen === 'red' ? 1 : 2;
    round.history = [...round.history, round.marks.slice()].slice(-MAX_HISTORY);
    const marks = round.marks.slice();
    const erase = marks[line] === value;
    marks[line] = erase ? 0 : value;
    round.marks = marks;
    if (erase) round.eraseCount += 1;
    else round.paintCount += 1;
    frame.note('paint', { line, ends: endsOf(board.n, line), color: erase ? null : round.pen });
    const after = paintState(board, marks);
    if (after.done) {
      round.answers.push({ t: frame.stamp(), answer: 'painted', correct: true, guess: null });
      frame.note('answer', { answer: 'painted', correct: true });
      frame.finish('solved');
      return;
    }
    const key = (item) => `${item.color}:${item.points.join('.')}`;
    const old = new Set(before.triangles.map(key));
    const fresh = after.triangles.filter((item) => !old.has(key(item)));
    if (fresh.length > 0) round.triangleCount += 1;
    if (after.left === 0 && before.left > 0) round.fullCount += 1;
    draw();
    frame.persist();
    // 한 번에 한 가지만 말한다: 새 세모, 다 칠했는데 세모가 있음, 세모가 모두 없어짐.
    if (fresh.length > 0) frame.say(T.play[`tri-${fresh[0].color}`]);
    else if (after.left === 0) frame.say(T.play.full);
    else if (before.triangles.length > 0 && after.triangles.length === 0) frame.say(T.play['tri-gone']);
  }

  function setPen(color) {
    const { round } = frame;
    if (!round || round.done || !isPaint(round) || round.pen === color) return;
    round.pen = color;
    flash = null;
    frame.note('pen', { color });
    draw();
    frame.persist();
    frame.say(T.play[`pen-${color}`]);
  }

  /** "세모 없이는 안 돼요" */
  function sayImpossible() {
    const { round, solution } = frame;
    if (!round || round.done || !isPaint(round)) return;
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
    flash = null;
    frame.persist();
    draw();
    frame.say(T.play['possible-press']);
  }

  /** 한 번 무르기(처음으로 되돌린 것도 무를 수 있다) */
  function undo() {
    const { round } = frame;
    if (!round || round.done || !isPaint(round) || round.history.length === 0) return;
    round.marks = round.history.at(-1).slice();
    round.history = round.history.slice(0, -1);
    round.undoCount += 1;
    pick = null;
    flash = null;
    frame.note('undo');
    draw();
    frame.persist();
    // 앞의 칠하기에 한 말(세모가 생겼어요)은 이제 맞지 않을 수 있으니 덮는다.
    frame.say(T.play.undo);
  }

  /** 처음으로: 아이가 칠한 선을 모두 지운다. 무르기로 돌아올 수 있다 */
  function reset() {
    const { round } = frame;
    if (!round || round.done || !isPaint(round) || paintState(round.board, round.marks).painted === 0) return;
    round.history = [...round.history, round.marks.slice()].slice(-MAX_HISTORY);
    round.marks = Array(lineCount(round.board.n)).fill(0);
    round.resetCount += 1;
    pick = null;
    flash = null;
    frame.note('reset');
    draw();
    frame.persist();
    frame.say(T.play.reset);
  }

  // ---- 끝난 뒤: 자리를 바꿔서 다시 두기, 방금 판 다시 보기 ----
  function rematch() {
    const { round } = frame;
    if (!round || !round.done || !ready(round)) return;
    const next = { order: round.order === 'first' ? 'second' : 'first', rematchOf: round.id };
    const start = { level: round.level, seed: round.seed, small: round.small, custom: round.custom, board: copyBoard(round.board) };
    frame.chooseAfter('swap', () => {
      preset = next;
      frame.startRound(FORMAT, start);
      frame.say(T.play[`rematch-${next.order}`]);
    });
  }

  function rowOf(cards) {
    const row = document.createElement('div');
    row.className = 'figure-row';
    row.append(...cards);
    return row;
  }

  /** 방금 둔 수들을 한 수씩 넘겨 본다. 누가 무엇을 그었는지를 그림과 말로 보인다. */
  function replayPages(round) {
    const first = firstOf(round);
    const total = round.trail.length;
    return Array.from({ length: total + 1 }, (_, turns) => {
      const trail = round.trail.slice(0, turns);
      const color = turns === 0 ? null : replay(round.board, trail, first).placed.at(-1).color;
      const who = color === null ? null : color === 'red' ? 'kid' : 'teacher';
      const parts = [turns === 0 ? T.replay.start : fill(T.replay[who], { no: ordinal(turns) })];
      if (turns === total && round.winner !== null) parts.push(T.replay.last);
      const note = turns === 0 ? T.replay['note-start'] : T.replay[`note-${who}`];
      return {
        say: parts.join(' '),
        // 그림은 종이를 넘길 때 그린다.
        get nodes() {
          return [rowOf([simCard(gameView(round.board, trail, first), note, { big: true })])];
        },
      };
    });
  }

  function openReplay() {
    const { round } = frame;
    if (!round || !round.done || round.trail.length === 0) return;
    round.replayCount += 1;
    frame.note('replay');
    frame.keep();
    frame.openSheet({ title: T.replay.title, pages: replayPages(round) });
  }

  /** 끝났을 때 하는 말: 어떤 세모가 생겼는지(또는 비겼는지)와 누가 이겼는지를 사실로 말한다. 덧붙이는 말은 하나만 한다. */
  /** 이 판으로 "왜 그럴까?"가 열렸는가: 점이 여섯인 판을 처음으로 끝까지 했다(이 판의 기록은 틀이 먼저 적어 둔다) */
  function justOpened(round, records) {
    if (round.side || round.board.n !== 6 || !whyOpen(records)) return false;
    const six = records.filter((record) => record.kind === 'round' && record.format === FORMAT && record.side !== true && record.board?.n === 6 && (record.outcome === 'solved' || record.outcome === 'solution'));
    return new Set(six.map((record) => record.id)).size === 1;
  }

  function rightLine(round, solution) {
    if (isPaint(round)) {
      const last = round.answers.at(-1);
      // 안 되는 판의 "왜 그럴까?" 권하기는 틀이 붙인다.
      if (last?.answer === 'impossible') return [round.paintCount > 0 ? fill(T.right['impossible-tried'], { n: round.paintCount }) : T.right['impossible-untried']];
      const parts = [fill(T.right.painted, { n: lineCount(round.board.n) - round.board.gone.length })];
      if (round.impossibleCount > 0) parts.push(T.right['after-press']);
      else if (solution.possible && justOpened(round, frame.records())) parts.push(T.right['why-invite']);
      // "그러면 이건?": 다섯 점을 스스로 다 칠했으면 여섯 점을 묻는다(작은 판에서는 묻지 않는다).
      else if (!round.side && round.board.n === 5) parts.push(T.right['six-paint']);
      return parts;
    }
    const parts = [T.right[round.winner]];
    // 작은 판을 끝냈을 때는 덧붙이지 않는다(끝난 뒤에 고를 것이 다르다).
    if (round.side) return parts;
    const records = frame.records();
    // 이 판으로 "왜 그럴까?"가 열렸으면 알려 준다(점이 여섯인 판을 처음 끝까지 했다).
    if (justOpened(round, records)) parts.push(T.right['why-invite']);
    // 연달아 졌으면 자리를 바꿔 볼 수 있다고 알려 준다. 몇 번 졌는지는 말하지 않는다.
    else if (round.winner === 'teacher' && lostStreak(records) >= SWAP_INVITE_AFTER) parts.push(T.right['swap-invite']);
    // "그러면 이건?": 다섯 점에서 비겼으면 여섯 점을 묻는다.
    else if (round.winner === 'draw' && round.board.n === 5) parts.push(T.right['six-game']);
    return parts;
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----
  const nameOf = (board) => fill(T.names.board, { n: board.n });

  /** "왜 그럴까?": 선생님이 어떻게 알아챘는지의 이야기. 점이 여섯인 판을 한 번 끝까지 한 뒤에 열린다(임시). */
  function whyPages() {
    if (!whyOpen(frame.records())) return null;
    return T.why.map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다(단추를 보일지 따질 때마다 그리지 않는다).
      get nodes() {
        return [rowOf(slide.figures.map((item) => simCard(figureView(item), item.note, { big: slide.figures.length === 1 })))];
      },
    }));
  }

  /** 게임 판의 꼴: 빨강이 먼저일 때와 파랑이 먼저일 때 */
  function gameKind(solution) {
    if (solution.red === 'draw' && solution.blue === 'draw') return 'draw';
    if (solution.red === 'red' && solution.blue === 'blue') return 'first';
    if (solution.red === 'blue' && solution.blue === 'red') return 'second';
    return null;
  }

  /** 풀이: 게임은 둘 다 잘 두면 어떻게 끝나는지, 칠하기는 세모 없이 칠한 한 가지나 안 되는 까닭 */
  function solutionPages(round, solution) {
    const { board } = round;
    if (!isPaint(round)) {
      const kind = gameKind(solution);
      const say = kind ? T.solution[kind] : `${T.make.starts[`red-${solution.red}`]} ${T.make.starts[`blue-${solution.blue}`]}`;
      return [{ say, nodes: [rowOf([simCard(gameView(board, [], 'red'), nameOf(board), { big: true })])] }];
    }
    if (solution.possible) {
      const marks = solution.example.map((color, line) => (board.red.includes(line) || board.blue.includes(line) || board.gone.includes(line) ? 0 : color));
      return [{ say: fill(T.solution.painted, { n: solution.count }), nodes: [rowOf([simCard(paintView(board, marks), T.solution['note-example'], { big: true })])] }];
    }
    const reason = solution.reason;
    const view = { ...paintView(board, []), ring: reason ? [reason.point] : [] };
    return [{ say: reason ? T.solution[reason.kind] : T.right['impossible-untried'], nodes: [rowOf([simCard(view, T.solution['note-reason'], { big: true })])] }];
  }

  // ---- 직접 만들기: 점의 수를 정하고, 두 점을 차례로 누르면 선이 빨강, 파랑, 없음으로 바뀐다. ----
  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    const ok = saved && Number.isInteger(saved.n) && saved.n >= LIMITS.min && saved.n <= LIMITS.max && Array.isArray(saved.red) && Array.isArray(saved.blue);
    const from = ok ? { kind: 'game', n: saved.n, gone: [], red: saved.red.slice(), blue: saved.blue.slice() } : FIRST_DRAFT;
    // 깨진 값은 처음 판으로 바꾼다(세모가 있는 판은 만드는 중일 수 있어서 받는다).
    const count = lineCount(from.n);
    const lines = [...from.red, ...from.blue];
    const fine = lines.every((line) => Number.isInteger(line) && line >= 0 && line < count) && new Set(lines).size === lines.length;
    return fine ? copyBoard(from) : copyBoard(FIRST_DRAFT);
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    draftPick = null;
    $('sim-make-result').textContent = '';
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  /** 만드는 판의 그림 */
  function draftView() {
    const red = draft.red.reduce((mask, line) => mask | (1 << line), 0);
    const blue = draft.blue.reduce((mask, line) => mask | (1 << line), 0);
    const triangles = [...trianglesIn(draft.n, red).map((points) => ({ points, color: 'red' })), ...trianglesIn(draft.n, blue).map((points) => ({ points, color: 'blue' }))];
    return { n: draft.n, lines: [...draft.red.map((line) => ({ line, color: 'red' })), ...draft.blue.map((line) => ({ line, color: 'blue' }))], triangles };
  }

  function drawMake() {
    $('sim-make-n').textContent = fill(T.make.points, { n: draft.n });
    $('sim-make-fewer').disabled = draft.n <= LIMITS.min;
    $('sim-make-more').disabled = draft.n >= LIMITS.max;
    $('sim-make-lines').textContent = fill(T.make.lines, { n: draft.red.length + draft.blue.length });
    $('sim-make-clear').disabled = draft.red.length + draft.blue.length === 0;
    drawSim($('sim-make-board'), { ...draftView(), pick: draftPick, label: pointLabel, onPair: cycleLine, onTap: tapDraft });
    // 한 색 세모가 없고 그을 선이 남아 있어야 두어 볼 수 있다.
    $('sim-make-play').disabled = checkBoard(draft) !== null;
  }

  function changeDraft(next) {
    draft = next;
    $('sim-make-result').textContent = '';
    log.saveDraft({ n: draft.n, red: draft.red, blue: draft.blue }, FORMAT);
    drawMake();
  }

  /** 점의 수를 바꾼다. 남는 점 사이의 선은 그대로 둔다 */
  function resize(n) {
    if (n < LIMITS.min || n > LIMITS.max) return;
    const move = (list) =>
      list
        .map((line) => endsOf(draft.n, line))
        .filter(([a, b]) => a < n && b < n)
        .map(([a, b]) => lineOf(n, a, b))
        .sort((x, y) => x - y);
    draftPick = null;
    changeDraft({ kind: 'game', n, gone: [], red: move(draft.red), blue: move(draft.blue) });
  }

  /** 두 점 사이의 선: 없음 → 빨강 → 파랑 → 없음 */
  function cycleLine([a, b]) {
    const line = lineOf(draft.n, a, b);
    if (line < 0) return;
    draftPick = null;
    const red = draft.red.filter((item) => item !== line);
    const blue = draft.blue.filter((item) => item !== line);
    if (draft.red.includes(line)) blue.push(line);
    else if (!draft.blue.includes(line)) red.push(line);
    changeDraft({ ...draft, red: red.sort((x, y) => x - y), blue: blue.sort((x, y) => x - y) });
  }

  function tapDraft(point) {
    if (draftPick === null || draftPick === point) {
      draftPick = draftPick === point ? null : point;
      drawMake();
      return;
    }
    const from = draftPick;
    draftPick = null;
    cycleLine([from, point]);
  }

  /** 아이가 만든 판을 풀이 프로그램으로 풀어서, 빨강이 먼저일 때와 파랑이 먼저일 때 어떻게 끝나는지 알려 준다. */
  function solveDraft() {
    const why = checkBoard(draft);
    if (why !== null) {
      const line = why === 'triangle' ? T.make.triangle : T.make.full;
      $('sim-make-result').textContent = line;
      frame.talkers.make.say(line);
      return;
    }
    const board = copyBoard(draft);
    const result = solveGame(board);
    const line = [T.make.lead, T.make.starts[`red-${result.red}`], T.make.starts[`blue-${result.blue}`]].join(' ');
    $('sim-make-result').textContent = line;
    const now = new Date().toISOString();
    log.saveRecord({
      kind: 'made',
      v: 1,
      id: log.newId('m'),
      format: FORMAT,
      startedAt: now,
      endedAt: now,
      board,
      solution: { possible: true, red: result.red, blue: result.blue, positions: result.positions },
    });
    log.flush();
    frame.talkers.make.say(line);
  }

  /** 다 만든 판(공책에 남기거나 두어 볼 판). 한 색 세모가 없고 그을 선이 남아 있어야 한다 */
  function madeBoard() {
    return checkBoard(draft) === null ? copyBoard(draft) : null;
  }

  function playDraft() {
    const board = madeBoard();
    if (board) frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board });
  }

  // ---- 단추 잇기 ----
  $('sim-first').addEventListener('click', () => chooseOrder('first'));
  $('sim-second').addEventListener('click', () => chooseOrder('second'));
  for (const color of COLORS) {
    $(`sim-pen-${color}`).prepend(penIcon(color));
    $(`sim-pen-${color}`).addEventListener('click', () => setPen(color));
  }
  $('sim-impossible').addEventListener('click', sayImpossible);
  $('sim-swap').addEventListener('click', rematch);
  $('sim-replay').addEventListener('click', openReplay);
  $('sim-make-fewer').addEventListener('click', () => resize(draft.n - 1));
  $('sim-make-more').addEventListener('click', () => resize(draft.n + 1));
  $('sim-make-clear').addEventListener('click', () => {
    draftPick = null;
    changeDraft({ ...draft, red: [], blue: [] });
  });
  $('sim-make-solve').addEventListener('click', solveDraft);
  $('sim-make-play').addEventListener('click', playDraft);

  return {
    id: FORMAT,
    T,
    padId: 'sim-pad',
    // 판이 정사각형이라 규칙 글은 왼쪽 칸 맨 위에 두어 판을 크게 그린다
    ruleAside: true,
    makeId: 'make-sim',
    homeIds: { sample: 'home-sim-sample', blank: 'home-sim-blank', ask: 'home-sim-ask', play: 'home-sim-play', pick: 'home-sim-pick', make: 'home-sim-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    /** 새 판에서 이 형식이 맡는 값 */
    begin({ level, custom, board }) {
      const start = preset;
      preset = null;
      if (board.kind === 'paint') {
        return {
          mode: 'paint',
          board: copyBoard(board), // 판: 점의 수, 없는 선, 처음부터 칠해 둔 선
          marks: Array(lineCount(board.n)).fill(0), // 아이가 칠한 선(선마다 0 없음, 1 빨강, 2 파랑)
          history: [], // 무르기로 돌아갈 칠한 모습들
          pen: 'red', // 칠할 색
          paintCount: 0, // 칠한 수(지운 것은 빼고)
          eraseCount: 0, // 같은 색으로 다시 칠해 지운 수
          undoCount: 0,
          resetCount: 0,
          triangleCount: 0, // 칠해서 새 한 색 세모가 생긴 수
          fullCount: 0, // 모든 선을 칠했는데 한 색 세모가 있던 수
          impossibleCount: 0, // 되는 판에 "세모 없이는 안 돼요"를 누른 수
          wrongCount: 0, // 사실과 다른 답의 수(되는 판의 "세모 없이는 안 돼요")
          refuseCount: 0, // 없는 선이나 처음부터 칠해 둔 선을 고른 수
        };
      }
      const rung = custom ? null : rungOf(level);
      const givenOrder = rung && rung.order === 'first' ? 'first' : null;
      return {
        mode: 'game',
        board: copyBoard(board), // 판: 점의 수와 처음부터 그어 둔 선
        order: start !== null ? start.order : givenOrder, // 아이가 먼저 긋는가('first' | 'second'). 아직 고르지 않았으면 null
        chose: start === null && givenOrder === null, // 아이가 먼저 그을지 고르는 판인가
        assigned: start === null && givenOrder !== null, // 단계가 아이의 차례를 정해 준 판인가
        trail: [], // 둔 수들(먼저 긋는 쪽부터 번갈아, 선 번호)
        winner: null, // 'kid' | 'teacher' | 'draw'. 끝나지 않았으면 null
        triangle: null, // 끝났을 때 생긴 세모의 점 셋
        rematch: start !== null, // 자리를 바꿔서 다시 두는 판인가
        rematchOf: start?.rematchOf ?? null, // 그렇다면 바로 앞 판의 번호
        replayCount: 0, // "방금 판 다시 보기"를 연 수
        refuseCount: 0, // 벌써 이어진 두 점을 고른 수
      };
    },
    solve: (round) => solutionOf(round.board),
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (!['game', 'paint'].includes(saved.mode) || checkBoard(saved.board) !== null || saved.board.kind !== saved.mode) return false;
      if (saved.mode === 'paint') {
        if (!marksOk(saved.board, saved.marks) || !Array.isArray(saved.history) || !saved.history.every((marks) => marksOk(saved.board, marks))) return false;
        if (!COLORS.includes(saved.pen)) return false;
        return [saved.paintCount, saved.eraseCount, saved.undoCount, saved.resetCount, saved.triangleCount, saved.fullCount, saved.impossibleCount, saved.wrongCount, saved.refuseCount].every(count);
      }
      if (saved.order !== null && !ORDERS.includes(saved.order)) return false;
      if (!Array.isArray(saved.trail)) return false;
      // 차례를 정하기 전에는 둔 수가 없다. 끝난 게임은 하던 판이 아니다.
      if (saved.order === null) {
        if (saved.trail.length > 0) return false;
      } else {
        const now = replay(saved.board, saved.trail, saved.order === 'second' ? 'blue' : 'red');
        if (!now.ok || now.over) return false;
      }
      if (![saved.chose, saved.assigned, saved.rematch].every((value) => typeof value === 'boolean')) return false;
      if (![saved.replayCount, saved.refuseCount].every(count)) return false;
      return saved.winner === null;
    },
    /** 판 화면에서 이 형식의 것(판, 판 아래의 글, 끝난 뒤의 단추 둘)을 보이거나 감춘다. 무르기와 되돌리기는 칠하기 판에만 있다. */
    showParts(on) {
      $('sim-board').hidden = !on;
      $('sim-count').hidden = !on;
      if (on) {
        const paint = frame.round?.mode === 'paint';
        $('undo').hidden = !paint;
        $('reset').hidden = !paint;
      } else {
        $('sim-swap').hidden = true;
        $('sim-replay').hidden = true;
      }
    },
    enter: forget,
    draw,
    ended: forget,
    ruleLine: (round) => T.rules[round.mode === 'game' ? 'game' : round.board.gone.length > 0 ? 'paint-gone' : 'paint'],
    hints: (round) => T.hints[round.custom ? 'choose' : rungOf(round.level).hint],
    touched: (round) => (isPaint(round) ? round.paintCount + round.eraseCount > 0 : round.trail.length > 0 || (round.chose && round.order !== null)),
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view(round) {
      if (isPaint(round)) {
        const state = paintState(round.board, round.marks);
        return { mode: 'paint', painted: state.painted, left: state.left, triangles: state.triangles.length, pen: round.pen };
      }
      const now = replay(round.board, ready(round) ? round.trail : [], firstOf(round));
      return { mode: 'game', order: round.order, turns: round.trail.length, left: now.left };
    },
    /** 이 판보다 작은 판: 점이 하나(또는 둘) 적은 판. 칠하기 판은 되는 판이면 되는 판만 낸다 */
    smaller: (round, turn) => smallerSim({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      if (isPaint(round)) {
        const state = paintState(round.board, round.marks);
        return {
          mode: round.mode,
          board: copyBoard(round.board),
          // 세모 없이 다 칠할 수 있는가, 그런 칠하기의 가짓수, 안 되는 판이면 아이가 볼 수 있는 까닭의 종류
          solution: { possible: solution.possible, count: solution.count, reason: solution.reason?.kind ?? null },
          // 판을 떠날 때 칠한 모습(선마다 0 없음, 1 빨강, 2 파랑. 처음부터 칠해 둔 선도 들어간다)
          colors: colorsOf(round.board, round.marks),
          painted: state.painted,
          left: state.left,
          triangles: state.triangles.length,
          paintCount: round.paintCount,
          placeCount: round.paintCount + round.eraseCount,
          eraseCount: round.eraseCount,
          undoCount: round.undoCount,
          resetCount: round.resetCount,
          triangleCount: round.triangleCount,
          fullCount: round.fullCount,
          impossibleCount: round.impossibleCount,
          wrongCount: round.wrongCount,
          refuseCount: round.refuseCount,
        };
      }
      const chosen = ready(round);
      const first = firstOf(round);
      const now = replay(round.board, chosen ? round.trail : [], first);
      const moves = now.placed.map((item) => ({ by: item.color === 'red' ? 'kid' : 'teacher', color: item.color, line: item.line, ends: endsOf(round.board.n, item.line) }));
      const seat = chosen ? seatOutcome(solution, round.order) : null;
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        // 빨강이 먼저일 때와 파랑이 먼저일 때 둘 다 잘 두면 어떻게 끝나는가, 풀이 프로그램이 따져 본 자리의 수
        solution: { possible: true, red: solution.red, blue: solution.blue, positions: solution.positions },
        order: round.order,
        first: chosen ? first : null,
        chose: round.chose,
        assigned: round.assigned,
        teacher: teacherOf(round.level, round.custom),
        // 아이의 자리가 잘 두면 어떻게 끝나는 자리였는가('win' | 'draw' | 'lose'), 지지 않는 자리였는가
        seat,
        choseWinner: chosen ? seat !== 'lose' : null,
        // 둔 수의 차례(누가, 어느 색으로, 어느 선을)
        moves,
        moveCount: moves.filter((move) => move.by === 'kid').length,
        turnCount: moves.length,
        winner: round.winner,
        triangle: round.triangle,
        left: now.left,
        // 아이가 잘 두면 갈 수 있던 끝보다 나쁜 자리로 보낸 수(몇 번째 수인지)
        slips: chosen ? slipsOf(round.board, round.trail, first, 'red') : [],
        rematch: round.rematch,
        rematchOf: round.rematchOf,
        replayCount: round.replayCount,
        refuseCount: round.refuseCount,
      };
    },
    rightLine,
    whyPages,
    solutionPages,
    undo,
    reset,
    onKey() {},

    // ---- 처음 화면에 그리는 그림 ----
    homeAsk: (level) => T.home.ask[rungOf(level).hint],
    pickLine: () => T.home.pick,
    drawSample(root, board) {
      // 게임 판은 빨간 선 하나와 파란 선 하나를 그은 모습으로 그린다.
      if (board.kind === 'paint') drawSim(root, { ...paintView(board, []), small: true });
      else drawSim(root, { n: board.n, lines: [{ line: lineOf(board.n, 0, 2), color: 'red' }, { line: lineOf(board.n, 1, 3), color: 'blue' }], small: true });
    },
    drawBlank(root) {
      drawSim(root, { n: BLANK.n, small: true });
    },
    drawResume(root, saved) {
      if (saved.mode === 'paint') drawSim(root, { ...paintView(saved.board, saved.marks), small: true });
      else drawSim(root, { ...gameView(saved.board, saved.order === null ? [] : saved.trail, saved.order === 'second' ? 'blue' : 'red'), fresh: -1, small: true });
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 판 하나와 그어진 선 */
    drawLevelPicture(root, entry) {
      const picture = entry.picture;
      if (picture.blank) drawSim(root, { n: BLANK.n, small: true });
      else drawSim(root, { ...figureView(picture), small: true });
    },
    showMake,
    /** 직접 만들기에서 다 만든 판. 아직 두어 볼 수 있는 판이 아니면 null(공책에 남기기가 쓴다) */
    madeBoard,
  };
}
