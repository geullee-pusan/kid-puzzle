// 도미노 가로세로: 판 화면에서 이 형식이 맡는 부분(판, 쪽과 차례 고르기, 선생님이 두는 차례, 한쪽만 놓을 수 있는 자리 보기,
// 끝났을 때 하는 말, 다시 보기와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/domino.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 선생님과 번갈아 도미노를 놓는다. 한쪽은 세로로만, 한쪽은 가로로만 놓고, 자기 차례에 놓을 곳이 없는 쪽이 진다.
// 아이가 서는 쪽(role: 'vert' | 'horz')과 먼저 둘지(order: 'first' | 'second')는 단계가 정하거나(1, 2단계) 두기 전에 아이가 고른다(3~5단계와 직접 만든 판).
// 고르는 판에서는 쪽을 먼저 고르고, 이어서 먼저 둘지 나중에 둘지 고른다. 이 고르기가 이 판의 답이다(화면에서는 맞았는지 알리지 않는다).
// 도미노는 이어진 빈칸 두 개를 끌거나 차례로 누르면 놓인다. 아이의 방향이 아닌 두 칸이면 놓이지 않고 판 아래에 그 사실을 적는다.
// 판이 끝나면 누가 이겼는지를 사실로만 말한다. 몇 번 이기고 졌는지는 세어 보여 주지 않는다.
// 선생님은 자기 차례에 잠깐 뜸을 들이고 둔다. 이길 수 있는 자리에서는 이기는 수를 둔다(풀이 프로그램).
// 선생님의 수는 (단계, 판 번호, 아이의 쪽, 먼저 두는 쪽, 지금까지 둔 수들)로 정해진다. 그래서 나갔다가 돌아와도 같은 수를 둔다.
// 왼쪽 칸의 "한쪽만 놓을 수 있는 자리 보기"는 두 쪽의 그런 자리를 판에 그리고 그 수를 적는다(쓰라고 권하지 않는다. 힌트 하나로 센다).
import T from '../content/domino.json';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, givenRole, nextSeed, rungOf, solutionOf } from '../core/domino-ladder.js';
import {
  LIMITS,
  SIDES,
  WHY_AFTER,
  checkBoard,
  copyBoard,
  finishedCount,
  firstSideOf,
  lostStreak,
  movesOf,
  otherSide,
  playable,
  replay,
  safeOf,
  safeSpots,
  seatWins,
  slipsOf,
  solve,
  teacherMove,
  whyOpen,
  winningMoves,
} from '../core/domino.js';
import { smallerDomino } from '../core/smaller.js';
import { fill, ordinal } from '../core/text.js';
import { boardCard, drawBoard, safeIcon } from '../ui/domino-board.js';

const FORMAT = 'domino';
const ORDERS = ['first', 'second'];
/** 선생님이 두기 전에 뜸을 들이는 시간(밀리초, 임시) */
const THINK_MS = 900;
/** 처음 화면과 판 고르기에 그리는 빈 판 */
const BLANK = { w: 3, h: 3, holes: [] };
const FIRST_DRAFT = { w: 4, h: 4, holes: [] };
/** 연달아 이만큼 지면 자리를 바꿔 보기를 권한다(임시) */
const SWAP_INVITE_AFTER = 2;

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createDomino(frame) {
  const { $, log } = frame;
  let pick = null; // 하나씩 눌러 골라 둔 칸
  let flash = null; // 판 아래에 잠깐 적는 사실. 다음에 무엇을 누르면 지운다
  let timer = null; // 선생님이 뜸을 들이는 중이면 그 타이머
  let preset = null; // 자리를 바꿔서 다시 둘 때, 새 판에 미리 정해 줄 것 { role, order, rematchOf }
  let draft = null; // 직접 만들기에서 만들던 판

  const count = (value) => Number.isInteger(value) && value >= 0;
  const ready = (round) => round.role !== null && round.order !== null;
  const firstOf = (round) => (ready(round) ? firstSideOf(round.role, round.order) : 'vert');

  /** 칸을 읽어 주는 이름: 자리와 그 칸에 있는 것 */
  function labelOf(board, placed, picked) {
    return (cell) => {
      const where = fill(T.cellLabel, { no: ordinal(Math.floor(cell / board.w) + 1), n: ordinal((cell % board.w) + 1) });
      const item = placed.find((one) => one.cells.includes(cell));
      const what = board.holes.includes(cell) ? 'hole' : item ? item.side : cell === picked ? 'picked' : 'open';
      return `${where}, ${T.cellNames[what]}`;
    };
  }

  /** 판과 둔 수들로 그릴 것을 만든다. safe가 참이면 한쪽만 놓을 수 있는 자리도 그린다 */
  function viewOf(board, trail, first, { safe = false } = {}) {
    const now = replay(board, trail, first);
    return { w: board.w, h: board.h, holes: board.holes, placed: now.placed, fresh: now.placed.length - 1, safe: safe ? safeOf(board, trail, first) : null };
  }

  /** 대본의 그림 하나(why와 판 고르기): 둔 수는 [a, b]로 적혀 있다 */
  const figureView = (item) => viewOf(item.board, (item.trail ?? []).map((cells) => ({ cells })), item.first ?? 'vert', { safe: item.safe === true });

  /** 처음 화면의 보기 그림: 세로 도미노 하나와 가로 도미노 하나를 놓은 모습(세로가 먼저, 놓을 수 있는 첫 자리에) */
  function sampleTrail(board) {
    const trail = [];
    for (let turn = 0; turn < 2; turn++) {
      const moves = movesOf(board, trail, 'vert');
      if (moves.length === 0) break;
      trail.push(moves[0]);
    }
    return trail;
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
  function statusOf(round, now) {
    if (!ready(round)) return '';
    if (now.over) return T.status[`over-${now.loser}`];
    if (now.next !== round.role) return T.status['teacher-turn'];
    if (pick !== null) return T.status.picked;
    // 방금 선생님이 둔 수가 있으면 그것을 적는다.
    if (round.trail.length > 0) return T.status['teacher-placed'];
    return T.status[`kid-${round.role}`];
  }

  /** 한쪽만 놓을 수 있는 자리의 수를 왼쪽 칸에 적는다 */
  function drawSafeCounts(spots) {
    const lines = SIDES.map((side) => {
      const line = document.createElement('span');
      line.className = 'dm-safe-count';
      const text = document.createElement('strong');
      text.textContent = fill(T.safe.count, { face: T.sides[side], n: spots[side].length });
      line.append(safeIcon(side), text);
      return line;
    });
    $('domino-safe-counts').replaceChildren(...lines);
  }

  function draw() {
    const { round } = frame;
    const { board } = round;
    const first = firstOf(round);
    const trail = ready(round) ? round.trail : [];
    const now = replay(board, trail, first);
    const playing = !round.done;
    const live = ready(round) && !now.over && playing;
    const mine = live && now.next === round.role;
    if (!mine) pick = null;
    const view = viewOf(board, trail, first, { safe: round.safeOn });

    drawBoard($('domino-board'), {
      ...view,
      pick,
      label: labelOf(board, view.placed, pick),
      onPair: mine ? placePair : undefined,
      onTap: mine ? tapCell : undefined,
    });
    $('domino-status').textContent = flash ?? statusOf(round, now);
    $('domino-placed').textContent = String(now.placed.length);
    $('domino-empty').textContent = String(now.empty);

    // 왼쪽 칸: 한쪽만 놓을 수 있는 자리 보기
    $('domino-safe').textContent = T.safe.button[round.safeOn ? 'on' : 'off'];
    $('domino-safe').setAttribute('aria-pressed', String(round.safeOn));
    $('domino-safe-counts').hidden = !round.safeOn;
    if (round.safeOn) drawSafeCounts(view.safe);

    // 오른쪽 칸: 쪽 고르기 → 차례 고르기 → 차례
    $('domino-choose').hidden = !(playing && round.role === null);
    $('domino-order').hidden = !(playing && round.role !== null && round.order === null);
    $('domino-role').hidden = round.role === null;
    if (round.role !== null) $('domino-role').textContent = T.roles[round.role];
    $('domino-order-line').hidden = round.order === null;
    if (round.order !== null) $('domino-order-line').textContent = T.orders[round.order];
    $('domino-turn-box').hidden = !live;
    if (live) {
      $('domino-turn').textContent = T.turn[mine ? 'kid' : 'teacher'];
      $('domino-howto').textContent = T.howto[round.role];
    }

    // 끝난 뒤 고르기에 게임만의 것 둘을 더한다. 진 판 뒤에는 "자리를 바꿔서 다시 두기"를 맨 위에 둔다.
    // 작은 판을 끝낸 뒤에는 틀의 두 단추(원래 판으로 돌아가기, 작은 판 하나 더)만 나온다.
    const done = round.done && !round.side;
    const lost = done && round.winner === 'teacher';
    $('domino-swap').hidden = !(done && ready(round));
    $('domino-replay').hidden = !(done && round.trail.length > 0);
    $('domino-swap').classList.toggle('primary', lost);
    if (done) {
      $(lost ? 'after-same' : 'after-make').before($('domino-swap'), $('domino-replay'));
      // 어느 쪽이 이기는 판인지는 자리를 바꿔 두어 보며 알아낸다. 게임이 끝난 뒤에는 풀이 단추를 두지 않는다.
      $('after-solution').hidden = true;
    }
    frame.showWhy();
    wait();
  }

  /** 선생님 차례면 잠깐 뜸을 들인 뒤에 두게 한다. 그사이 판이 바뀌었으면 두지 않는다. */
  function wait() {
    clearTimer();
    const { round } = frame;
    if (!round || round.done || !ready(round)) return;
    const first = firstOf(round);
    const now = replay(round.board, round.trail, first);
    if (now.over || now.next === round.role) return;
    const turns = round.trail.length;
    timer = setTimeout(() => {
      timer = null;
      if (frame.round !== round || round.trail.length !== turns || round.done) return;
      // 직접 만든 판과 작은 판에는 판 번호가 없다.
      const numbered = !round.custom && !round.side;
      const move = teacherMove(round.board, round.trail, { level: numbered ? round.level : null, seed: numbered ? round.seed : null, role: round.role, first });
      if (move) play('teacher', move);
    }, THINK_MS);
  }

  /** 도미노 하나를 놓는다. 차례가 아닌 쪽의 수와 둘 수 없는 수는 두지 않는다. */
  function play(who, move) {
    const { round } = frame;
    if (!ready(round) || round.done) return;
    const first = firstOf(round);
    const before = replay(round.board, round.trail, first);
    const side = who === 'kid' ? round.role : otherSide(round.role);
    if (before.over || before.next !== side) return;
    const after = replay(round.board, [...round.trail, move], first);
    if (!after.ok) return;
    round.trail = [...round.trail, { cells: move.cells.slice() }];
    pick = null;
    flash = null;
    frame.note('move', { by: who, side, turn: round.trail.length, cells: move.cells });
    if (after.over) {
      // 놓을 곳이 없는 쪽이 생겼다. 이긴 판도 진 판도 "끝까지 둔 판"으로 끝낸다.
      round.winner = after.winner === round.role ? 'kid' : 'teacher';
      round.left = after.empty;
      // 끝날 때 이긴 쪽만 놓을 수 있는 자리(진 쪽은 놓을 곳이 없으니 이긴 쪽이 놓을 수 있는 자리는 모두 그렇다)
      round.spare = safeSpots(round.board, after.filled, after.winner).length;
      frame.note('over', { winner: round.winner, side: after.winner, empty: after.empty, spare: round.spare });
      frame.finish('solved');
      return;
    }
    draw();
    frame.persist();
    if (who === 'teacher') frame.say(T.play['teacher-placed']);
  }

  /** 아이가 고른 두 칸에 도미노를 놓는다. 아이의 방향이 아니면 놓지 않고 그 사실을 판 아래에 적는다. */
  function placePair(cells) {
    const { round } = frame;
    if (round.done || !ready(round)) return;
    const [a, b] = cells.slice().sort((x, y) => x - y);
    const w = round.board.w;
    const right = round.role === 'vert' ? b === a + w : b === a + 1 && Math.floor(a / w) === Math.floor(b / w);
    if (!right) {
      round.refuseCount += 1;
      frame.note('refuse', { cells: [a, b] });
      pick = null;
      flash = T.status[`wrong-${round.role}`];
      draw();
      frame.persist();
      return;
    }
    play('kid', { cells: [a, b] });
  }

  /** 빈칸 하나를 눌렀다: 고른 칸이 없으면 고르고, 있으면 그 칸과 이어서 놓는다. 같은 칸을 다시 누르면 고른 것을 푼다. */
  function tapCell(cell) {
    const { round } = frame;
    if (round.done || !ready(round)) return;
    if (pick === null || pick === cell) {
      pick = pick === cell ? null : cell;
      flash = null;
      draw();
      return;
    }
    const w = round.board.w;
    const [ax, ay] = [pick % w, Math.floor(pick / w)];
    const [bx, by] = [cell % w, Math.floor(cell / w)];
    if (Math.abs(ax - bx) + Math.abs(ay - by) === 1) {
      placePair([pick, cell]);
      return;
    }
    // 떨어진 칸이면 그 칸을 새로 고른다.
    pick = cell;
    flash = null;
    draw();
  }

  /** "세로가 될래요" / "가로가 될래요" */
  function chooseRole(role) {
    const { round } = frame;
    if (!round || round.done || round.role !== null) return;
    round.role = role;
    frame.note('pick-role', { role });
    draw();
    frame.persist();
    frame.say(T.play[`picked-${role}`]);
  }

  /** "먼저 둘래요" / "나중에 둘래요". 쪽과 이 고르기가 이 판의 답이다. */
  function chooseOrder(order) {
    const { round, solution } = frame;
    if (!round || round.done || round.role === null || round.order !== null) return;
    round.order = order;
    // correct: 잘 두면 이기는 자리를 골랐는가. 화면에서는 알리지 않는다(두어 보면 알게 된다).
    const correct = seatWins(solution, round.role, order);
    round.answers.push({ t: frame.stamp(), answer: `${round.role}-${order}`, correct, guess: null });
    frame.note('pick-order', { order, correct });
    draw();
    frame.persist();
    frame.say(T.play[`order-${order}`]);
  }

  /** 한쪽만 놓을 수 있는 자리를 판에 그리거나 지운다 */
  function toggleSafe() {
    const { round } = frame;
    if (!round) return;
    round.safeOn = !round.safeOn;
    if (round.safeOn) {
      round.safeShown = true;
      round.safeCount += 1;
    }
    frame.note('safe', { on: round.safeOn });
    draw();
    // 끝난 판에서도 켜 볼 수 있다(끝난 모습을 들여다본다). 끝난 판이면 기록을 고쳐 적는다.
    frame.keep();
  }

  // ---- 끝난 뒤: 자리를 바꿔서 다시 두기, 방금 판 다시 보기 ----
  function rematch() {
    const { round } = frame;
    if (!round || !round.done || !ready(round)) return;
    // 선생님이 서 있던 자리: 쪽도 차례도 바꾼다.
    const next = { role: otherSide(round.role), order: round.order === 'first' ? 'second' : 'first', rematchOf: round.id };
    const start = { level: round.level, seed: round.seed, small: round.small, custom: round.custom, board: copyBoard(round.board) };
    frame.chooseAfter('swap', () => {
      preset = next;
      frame.startRound(FORMAT, start);
      frame.say(fill(T.play[`rematch-${next.order}`], { face: T.sides[next.role] }));
    });
  }

  function rowOf(cards, more = '') {
    const row = document.createElement('div');
    row.className = more ? `figure-row ${more}` : 'figure-row';
    row.append(...cards);
    return row;
  }

  /** 방금 둔 수들을 한 수씩 넘겨 본다. 누가 무엇을 두었는지를 그림과 말로 보인다. */
  function replayPages(round) {
    const first = firstOf(round);
    const total = round.trail.length;
    return Array.from({ length: total + 1 }, (_, turns) => {
      const trail = round.trail.slice(0, turns);
      const side = turns === 0 ? null : (turns - 1) % 2 === 0 ? first : otherSide(first);
      const who = side === null ? null : side === round.role ? 'kid' : 'teacher';
      const parts = [turns === 0 ? T.replay[`start-${round.role}`] : fill(T.replay[who], { no: ordinal(turns) })];
      if (turns === total && round.winner !== null) parts.push(T.replay.last);
      const note = turns === 0 ? T.replay['note-start'] : T.replay[`note-${who}`];
      return {
        say: parts.join(' '),
        // 그림은 종이를 넘길 때 그린다.
        get nodes() {
          return [rowOf([boardCard(viewOf(round.board, trail, first), note, { big: true })])];
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

  /** 끝났을 때 하는 말: 누가 놓을 곳이 없었는지와 누가 이겼는지를 사실로 말한다. */
  function rightLine(round) {
    const winnerSide = round.winner === 'kid' ? round.role : otherSide(round.role);
    const parts = [T.right[`${winnerSide}-${round.winner}`]];
    // 작은 판을 끝냈을 때는 덧붙이지 않는다(끝난 뒤에 고를 것이 다르다).
    if (round.side) return parts;
    const records = frame.records();
    // 덧붙이는 말은 하나만 한다(한 번에 한 가지만 말한다).
    // 이 판으로 "왜 그럴까?"가 열렸으면 알려 준다.
    if (finishedCount(records) === WHY_AFTER) parts.push(T.right['why-invite']);
    // 연달아 졌으면 자리를 바꿔 볼 수 있다고 알려 준다. 몇 번 졌는지는 말하지 않는다.
    else if (round.winner === 'teacher' && lostStreak(records) >= SWAP_INVITE_AFTER) parts.push(T.right['swap-invite']);
    // 끝날 때 이긴 쪽만 놓을 수 있는 자리가 남아 있었으면 그 수를 사실로 말한다.
    else if (round.spare > 0) parts.push(fill(T.right.spare, { face: T.sides[winnerSide], n: round.spare }));
    return parts;
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----
  const nameOf = (board) => fill(T.names.board, { k: board.w, n: board.h });

  /** "왜 그럴까?": 선생님이 어떻게 알아챘는지의 이야기. 게임을 두 판 끝까지 둔 뒤에 열린다(임시). */
  function whyPages() {
    if (!whyOpen(frame.records())) return null;
    return T.why.map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다(단추를 보일지 따질 때마다 그리지 않는다).
      get nodes() {
        return [rowOf(slide.figures.map((item) => boardCard(figureView(item), item.note, { big: slide.figures.length === 1 })))];
      },
    }));
  }

  /** 풀이: 누가 먼저 두면 누가 이기는지, 먼저 두는 쪽이 이기는 처음이면 이기는 첫 도미노 하나를 그려 보여 준다. */
  function solutionPages(round, solution) {
    const { board } = round;
    const pages = [{ say: T.solution[solution.kind], nodes: [rowOf([boardCard(viewOf(board, [], 'vert'), nameOf(board), { big: true })])] }];
    for (const side of SIDES) {
      if (solution[side] !== side) continue;
      const opening = winningMoves(board, [], side)[0];
      pages.push({
        say: fill(T.solution.opening, { face: T.sides[side] }),
        get nodes() {
          return [rowOf([boardCard(viewOf(board, [opening], side), T.solution['opening-note'], { big: true })])];
        },
      });
    }
    return pages;
  }

  // ---- 직접 만들기: 가로와 세로의 칸 수를 정하고, 칸을 눌러 구멍을 뚫거나 메운다. ----
  const draftBoard = () => copyBoard(draft);

  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    const ok = saved && checkBoard({ w: saved.w, h: saved.h, holes: saved.holes }) === null;
    const from = ok ? saved : FIRST_DRAFT;
    return { w: from.w, h: from.h, holes: from.holes.slice() };
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    $('domino-make-result').textContent = '';
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function setStepper(id, value) {
    $(id).textContent = fill(T.make.cells, { n: value });
    $(`${id}-fewer`).disabled = value <= LIMITS.min;
    $(`${id}-more`).disabled = value >= LIMITS.max;
  }

  function drawMake() {
    setStepper('domino-make-w', draft.w);
    setStepper('domino-make-h', draft.h);
    $('domino-make-holes').textContent = fill(T.make.holes, { n: draft.holes.length });
    $('domino-make-clear').disabled = draft.holes.length === 0;
    const board = draftBoard();
    drawBoard($('domino-make-board'), { ...viewOf(board, [], 'vert'), label: labelOf(board, [], null), onCell: toggleHole });
    // 두 쪽 모두 처음에 놓을 곳이 있어야 두어 볼 수 있다.
    $('domino-make-play').disabled = !playable(board);
  }

  function changeDraft(next) {
    if (checkBoard(next) !== null) return;
    draft = next;
    $('domino-make-result').textContent = '';
    log.saveDraft(draft, FORMAT);
    drawMake();
  }

  /** 가로나 세로의 칸 수를 바꾼다. 구멍은 같은 자리(가로, 세로)에 남는다. 판 밖으로 나간 구멍은 없어진다 */
  function resize(w, h) {
    const holes = draft.holes
      .map((cell) => [cell % draft.w, Math.floor(cell / draft.w)])
      .filter(([x, y]) => x < w && y < h)
      .map(([x, y]) => y * w + x)
      .sort((a, b) => a - b);
    changeDraft({ w, h, holes });
  }

  function toggleHole(cell) {
    const holes = draft.holes.includes(cell) ? draft.holes.filter((item) => item !== cell) : [...draft.holes, cell].sort((a, b) => a - b);
    changeDraft({ ...draft, holes });
  }

  /** 아이가 만든 판을 풀이 프로그램으로 풀어서, 누가 먼저 두면 누가 이기는지 알려 준다. */
  function solveDraft() {
    const board = draftBoard();
    if (!playable(board)) {
      $('domino-make-result').textContent = T.make.nomove;
      frame.talkers.make.say(T.make.nomove);
      return;
    }
    const result = solve(board);
    const line = [T.make.starts[`vert-${result.vert}`], T.make.starts[`horz-${result.horz}`], T.solution[result.kind]].join(' ');
    $('domino-make-result').textContent = line;
    const now = new Date().toISOString();
    log.saveRecord({
      kind: 'made',
      v: 1,
      id: log.newId('m'),
      format: FORMAT,
      startedAt: now,
      endedAt: now,
      board,
      solution: { possible: true, vert: result.vert, horz: result.horz, kind: result.kind, positions: result.positions },
    });
    log.flush();
    frame.talkers.make.say(line);
  }

  /** 다 만든 판(공책에 남기거나 두어 볼 판). 두 쪽 모두 처음에 놓을 곳이 있어야 한다 */
  function madeBoard() {
    const board = draftBoard();
    return playable(board) ? board : null;
  }

  function playDraft() {
    const board = madeBoard();
    if (board) frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board });
  }

  // ---- 단추 잇기 ----
  $('domino-vert').addEventListener('click', () => chooseRole('vert'));
  $('domino-horz').addEventListener('click', () => chooseRole('horz'));
  $('domino-first').addEventListener('click', () => chooseOrder('first'));
  $('domino-second').addEventListener('click', () => chooseOrder('second'));
  $('domino-safe').addEventListener('click', toggleSafe);
  $('domino-swap').addEventListener('click', rematch);
  $('domino-replay').addEventListener('click', openReplay);
  $('domino-make-w-fewer').addEventListener('click', () => resize(draft.w - 1, draft.h));
  $('domino-make-w-more').addEventListener('click', () => resize(draft.w + 1, draft.h));
  $('domino-make-h-fewer').addEventListener('click', () => resize(draft.w, draft.h - 1));
  $('domino-make-h-more').addEventListener('click', () => resize(draft.w, draft.h + 1));
  $('domino-make-clear').addEventListener('click', () => changeDraft({ ...draft, holes: [] }));
  $('domino-make-solve').addEventListener('click', solveDraft);
  $('domino-make-play').addEventListener('click', playDraft);

  return {
    id: FORMAT,
    T,
    padId: 'domino-pad',
    makeId: 'make-domino',
    homeIds: { sample: 'home-domino-sample', blank: 'home-domino-blank', ask: 'home-domino-ask', play: 'home-domino-play', pick: 'home-domino-pick', make: 'home-domino-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    /** 새 판에서 이 형식이 맡는 값 */
    begin({ level, custom, board }) {
      const start = preset;
      preset = null;
      const rung = custom ? null : rungOf(level);
      // 단계가 정해 준 쪽: 1단계는 세로, 2단계는 판마다. 2단계의 작은 판은 원래 판에서 아이가 서 있던 쪽을 그대로 쓴다.
      let given = custom ? null : givenRole(level, board);
      const parent = frame.round;
      if (!custom && given === null && rung.role === 'board' && parent && parent.format === FORMAT && SIDES.includes(parent.role)) given = parent.role;
      const givenOrder = rung && rung.order === 'first' ? 'first' : null;
      return {
        mode: 'game',
        board: copyBoard(board), // 판: 크기와 구멍
        role: start !== null ? start.role : given, // 아이가 선 쪽('vert' | 'horz'). 아직 고르지 않았으면 null
        order: start !== null ? start.order : given !== null ? givenOrder : null, // 아이가 먼저 두는가('first' | 'second'). 아직 고르지 않았으면 null
        chose: start === null && given === null, // 아이가 쪽과 차례를 고르는 판인가
        assigned: start === null && given !== null, // 단계가 아이의 자리를 정해 준 판인가
        trail: [], // 둔 수들(먼저 두는 쪽부터 번갈아)
        winner: null, // 이긴 사람('kid' | 'teacher'). 끝나지 않았으면 null
        left: null, // 끝났을 때의 빈칸 수
        spare: null, // 끝났을 때 이긴 쪽만 놓을 수 있던 자리의 수
        rematch: start !== null, // 자리를 바꿔서 다시 두는 판인가
        rematchOf: start?.rematchOf ?? null, // 그렇다면 바로 앞 판의 번호
        replayCount: 0, // "방금 판 다시 보기"를 연 수
        safeOn: false, // 한쪽만 놓을 수 있는 자리를 판에 그려 두었는가
        safeShown: false, // 그것을 한 번이라도 켜 보았는가
        safeCount: 0, // 켠 수
        refuseCount: 0, // 아이의 방향이 아닌 두 칸을 고른 수
      };
    },
    solve: (round) => solutionOf(round.board),
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (saved.mode !== 'game' || checkBoard(saved.board) !== null || !playable(saved.board)) return false;
      if (saved.role !== null && !SIDES.includes(saved.role)) return false;
      if (saved.order !== null && !ORDERS.includes(saved.order)) return false;
      if (saved.role === null && saved.order !== null) return false;
      if (!Array.isArray(saved.trail)) return false;
      // 자리를 정하기 전에는 둔 수가 없다. 끝난 게임은 하던 판이 아니다.
      if (saved.role === null || saved.order === null) {
        if (saved.trail.length > 0) return false;
      } else {
        const now = replay(saved.board, saved.trail, firstSideOf(saved.role, saved.order));
        if (!now.ok || now.over) return false;
      }
      if (![saved.chose, saved.assigned, saved.rematch, saved.safeOn, saved.safeShown].every((value) => typeof value === 'boolean')) return false;
      if (![saved.replayCount, saved.safeCount, saved.refuseCount].every(count)) return false;
      return saved.winner === null;
    },
    /** 판 화면에서 이 형식의 것(판, 판 아래의 글, 왼쪽 칸의 도구, 끝난 뒤의 단추 둘)을 보이거나 감춘다. 이 형식에는 무르기와 되돌리기가 없다. */
    showParts(on) {
      $('domino-board').hidden = !on;
      $('domino-count').hidden = !on;
      $('domino-safe').hidden = !on;
      if (on) {
        $('undo').hidden = true;
        $('reset').hidden = true;
      } else {
        $('domino-safe-counts').hidden = true;
        $('domino-swap').hidden = true;
        $('domino-replay').hidden = true;
      }
    },
    enter: forget,
    draw,
    ended: forget,
    ruleLine: () => T.rules.game,
    hints: (round) => T.hints[round.custom ? 'choose' : rungOf(round.level).hint],
    touched: (round) => round.trail.length > 0 || (round.chose && round.role !== null) || round.safeShown,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view(round) {
      const now = replay(round.board, ready(round) ? round.trail : [], firstOf(round));
      return { role: round.role, order: round.order, turns: round.trail.length, placed: now.placed.length, empty: now.empty, safeOn: round.safeOn };
    },
    /** 이 판보다 작은 판: 빈칸이 더 적고, 잘 두면 이기는 꼴(먼저, 나중, 늘 세로, 늘 가로)이 같은 판 */
    smaller: (round, turn) => smallerDomino({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      const chosen = ready(round);
      const first = firstOf(round);
      const moves = round.trail.map((move, index) => {
        const side = index % 2 === 0 ? first : otherSide(first);
        return { by: side === round.role ? 'kid' : 'teacher', side, cells: move.cells };
      });
      const now = replay(round.board, chosen ? round.trail : [], first);
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        // 누가 먼저 두면 누가 이기는지(vert: 세로가 먼저 둘 때, horz: 가로가 먼저 둘 때), 판의 꼴, 풀이 프로그램이 따져 본 자리의 수
        solution: { possible: true, vert: solution.vert, horz: solution.horz, kind: solution.kind, positions: solution.positions },
        role: round.role,
        order: round.order,
        first: chosen ? first : null,
        chose: round.chose,
        assigned: round.assigned,
        // 아이가 선 자리가 잘 두면 이기는 자리였는가(아직 정하지 않았으면 null)
        choseWinner: chosen ? seatWins(solution, round.role, round.order) : null,
        // 둔 수의 차례(누가, 어느 쪽으로, 어느 칸에)
        moves,
        moveCount: moves.filter((move) => move.by === 'kid').length,
        turnCount: moves.length,
        winner: round.winner,
        left: round.left,
        empty: now.empty,
        spare: round.spare,
        // 아이가 이기는 자리에서 지는 자리로 보낸 수(몇 번째 수인지)
        slips: chosen ? slipsOf(round.board, round.trail, first, round.role) : [],
        rematch: round.rematch,
        rematchOf: round.rematchOf,
        replayCount: round.replayCount,
        // 한쪽만 놓을 수 있는 자리 보기: 켜 본 적이 있으면 힌트 하나로 센다
        safeShown: round.safeShown,
        safeCount: round.safeCount,
        refuseCount: round.refuseCount,
        hintsOpened: round.hintsOpened + (round.safeShown ? 1 : 0),
      };
    },
    rightLine,
    whyPages,
    solutionPages,
    undo() {},
    reset() {},
    onKey() {},

    // ---- 처음 화면에 그리는 그림 ----
    homeAsk: (level) => T.home.ask[rungOf(level).hint],
    pickLine: () => T.home.pick,
    drawSample(root, board) {
      drawBoard(root, { ...viewOf(board, sampleTrail(board), 'vert'), small: true });
    },
    drawBlank(root) {
      drawBoard(root, { ...viewOf(BLANK, [], 'vert'), small: true });
    },
    drawResume(root, saved) {
      const chosen = saved.role !== null && saved.order !== null;
      const first = chosen ? firstSideOf(saved.role, saved.order) : 'vert';
      drawBoard(root, { ...viewOf(saved.board, chosen ? saved.trail : [], first), small: true });
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 판 하나와 놓인 도미노 */
    drawLevelPicture(root, entry) {
      const picture = entry.picture;
      if (picture.blank) drawBoard(root, { ...viewOf(BLANK, [], 'vert'), small: true });
      else drawBoard(root, { ...figureView(picture), small: true });
    },
    showMake,
    /** 직접 만들기에서 다 만든 판. 아직 두어 볼 수 있는 판이 아니면 null(공책에 남기기가 쓴다) */
    madeBoard,
  };
}
