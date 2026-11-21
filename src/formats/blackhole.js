// 블랙홀: 판 화면에서 이 형식이 맡는 부분(판, 먼저 둘지 고르기, 선생님이 두는 차례, 끝났을 때 하는 말, 다시 보기와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/blackhole.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 세모꼴로 놓인 동그라미 칸에 선생님과 번갈아 자기 수를 1부터 차례로 놓는다. 빈칸이 하나 남으면 블랙홀이 되어
// 맞닿은 칸의 수를 모두 빨아들이고, 남은 수의 합이 큰 쪽이 이긴다(같으면 비긴다). 내 수는 속이 찬 동그라미, 선생님 수는 점선 네모다.
// 먼저 두는 쪽은 판이 정하거나(빈 판에서 아이가 먼저, 수가 몇 개 놓인 판에서 아이 차례), 두기 전에 아이가 고른다(먼저 둘까, 나중에 둘까).
// 고르기가 이 판의 답이다(화면에서는 맞았는지 알리지 않는다. 해 보면 알게 된다).
// 판이 끝나면 블랙홀이 빨아들인 합, 남은 합, 누가 이겼는지를 사실로만 말한다. 몇 번 이기고 졌는지는 세어 보여 주지 않는다.
// 선생님은 자기 차례에 잠깐 뜸을 들이고 둔다. 두는 법은 단계가 정한다(아무 빈칸에나, 어림으로 두다가 끝의 몇 수만 모두 따져서, 모두 따져서).
// 선생님의 수는 (단계, 판 번호, 먼저 두는 쪽, 지금까지 둔 수들)로 정해진다. 그래서 나갔다가 돌아와도 같은 수를 둔다.
import T from '../content/blackhole.json';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, kindOf, nextSeed, rungOf, solutionOf, teacherOf } from '../core/blackhole-ladder.js';
import {
  EXACT_LEFT,
  LIMITS,
  SIDES,
  WHY_AFTER,
  cellCount,
  checkBoard,
  copyBoard,
  finishedCount,
  lostStreak,
  moveValues,
  otherSide,
  outcomeOf,
  replay,
  rowColOf,
  seatOutcome,
  sideToMove,
  slipsOf,
  solve,
  teacherMove,
  whyOpen,
} from '../core/blackhole.js';
import { smallerBlackhole } from '../core/smaller.js';
import { endsClosed, fill, ordinal } from '../core/text.js';
import { boardCard, drawBoard } from '../ui/blackhole-board.js';

const FORMAT = 'blackhole';
const MODES = ['game', 'made'];
const ORDERS = ['first', 'given', 'choose'];
/** 선생님이 두기 전에 뜸을 들이는 시간(밀리초, 임시) */
const THINK_MS = 800;
/** 처음 화면과 판 고르기에 그리는 빈 판 */
const BLANK = { rows: 3, rocks: [0], kid: [], teacher: [], first: 'kid' };
const FIRST_DRAFT = { rows: 3, rocks: [0], kid: [], teacher: [], first: 'kid' };
/** 연달아 이만큼 지면 자리를 바꿔 보기를 권한다(임시) */
const SWAP_INVITE_AFTER = 2;
/** 직접 만들기에서 칸을 누르면 하는 일 */
const TOOLS = ['rock', 'kid', 'teacher'];

/** 판의 종류: 먼저 둘지 고르는 판, 빈 판에서 아이가 먼저 두는 판, 수가 놓여 있거나 선생님이 먼저 두는 판 */
const orderOf = (board) => (board.first === null ? 'choose' : board.kid.length + board.teacher.length === 0 && board.first === 'kid' ? 'first' : 'given');

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createBlackhole(frame) {
  const { $, log } = frame;
  let flash = null; // 판 아래에 잠깐 적는 사실. 다음에 무엇을 누르면 지운다
  let timer = null; // 선생님이 뜸을 들이는 중이면 그 타이머
  let swallowNow = false; // 방금 끝났다: 다음 그림에서 한 번만 빨려 들어가는 움직임을 보인다
  let preset = null; // 자리를 바꿔서 다시 둘 때, 새 판에 미리 정해 줄 것 { first, rematchOf }
  let draft = null; // 직접 만들기에서 만들던 판
  let tool = 'rock'; // 직접 만들기에서 칸을 누르면 하는 일

  const count = (value) => Number.isInteger(value) && value >= 0;
  const ready = (round) => round.first !== null;
  const firstOf = (round) => round.first ?? 'kid';

  /** 칸을 읽어 주는 이름: 자리와 그 칸에 있는 것 */
  function labelOf(board, now) {
    return (cell) => {
      const [r, c] = rowColOf(cell);
      const where = fill(T.cellLabel, { no: ordinal(r + 1), n: ordinal(c + 1) });
      let what = T.cellNames.open;
      if (board.rocks.includes(cell)) what = T.cellNames.rock;
      else if (now.hole === cell) what = T.cellNames.hole;
      else if (now.kid.includes(cell)) what = fill(T.cellNames.kid, { k: now.kid.indexOf(cell) + 1 });
      else if (now.teacher.includes(cell)) what = fill(T.cellNames.teacher, { k: now.teacher.indexOf(cell) + 1 });
      return `${where}, ${what}`;
    };
  }

  /** 판과 둔 수들로 그릴 것(보기만 하는 그림) */
  function viewOf(board, trail, first, more = {}) {
    const now = replay(board, trail, first);
    return { rows: board.rows, rocks: board.rocks, kid: now.kid, teacher: now.teacher, last: now.moves.at(-1)?.cell ?? null, hole: now.hole, swallowed: now.swallowed, ...more };
  }

  /** 대본의 그림 하나(why와 판 고르기): 둔 수들을 그대로 따라간 모습 */
  const figureView = (item) => viewOf(item.board, item.trail ?? [], item.board.first ?? 'kid', { rings: item.rings ?? [] });

  function clearTimer() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  function forget() {
    flash = null;
    swallowNow = false;
    clearTimer();
  }

  // ---- 판 ----
  function statusOf(round, now) {
    if (!ready(round)) return T.status.choose;
    if (now.over) return T.status.over;
    if (now.next !== 'kid') return T.status['teacher-turn'];
    // 방금 선생님이 놓았으면 그것을 적는다.
    if (now.moves.at(-1)?.side === 'teacher') return T.status['teacher-placed'];
    return T.status['kid-turn'];
  }

  function draw() {
    const { round } = frame;
    const { board } = round;
    const first = firstOf(round);
    const trail = ready(round) ? round.trail : [];
    const now = replay(board, trail, first);
    const playing = !round.done;
    const live = ready(round) && !now.over && playing;
    const mine = live && now.next === 'kid';

    drawBoard($('blackhole-board'), {
      ...viewOf(board, trail, first),
      animate: swallowNow,
      open: mine ? now.empty : [],
      label: labelOf(board, now),
      onCell: mine ? tapCell : undefined,
    });
    swallowNow = false;
    $('blackhole-status').textContent = flash ?? statusOf(round, now);
    $('blackhole-left-line').hidden = now.over;
    $('blackhole-sums-line').hidden = !now.over;
    $('blackhole-left').textContent = String(now.empty.length);
    $('blackhole-kid-sum').textContent = String(now.sums.kid);
    $('blackhole-teacher-sum').textContent = String(now.sums.teacher);

    // 오른쪽 칸: 먼저 둘지 → 차례와 놓을 수
    $('blackhole-order').hidden = !(playing && round.first === null);
    $('blackhole-first-line').hidden = round.first === null;
    // 수가 놓인 판에서 시작하면 그렇다고, 빈 판이면 누가 먼저 두는지 적는다.
    if (round.first !== null) $('blackhole-first-line').textContent = T.firsts[board.kid.length + board.teacher.length > 0 ? 'given' : round.first];
    $('blackhole-turn-box').hidden = !live;
    if (live) {
      $('blackhole-turn').textContent = T.turn[mine ? 'kid' : 'teacher'];
      $('blackhole-kid-next').textContent = String(now.kid.length + 1);
      $('blackhole-teacher-next').textContent = String(now.teacher.length + 1);
    }

    // 끝난 뒤 고르기에 게임만의 것 둘을 더한다. 진 판 뒤에는 "자리를 바꿔서 다시 두기"를 맨 위에 둔다.
    // 작은 판을 끝낸 뒤에는 틀의 두 단추(원래 판으로 돌아가기, 작은 판 하나 더)만 나온다.
    const done = round.done && !round.side;
    const lost = done && round.winner === 'teacher';
    $('blackhole-swap').hidden = !(done && ready(round));
    $('blackhole-replay').hidden = !(done && round.trail.length > 0);
    $('blackhole-swap').classList.toggle('primary', lost);
    if (done) {
      $(lost ? 'after-same' : 'after-make').before($('blackhole-swap'), $('blackhole-replay'));
      // 어느 자리가 이기는 자리인지는 자리를 바꿔 해 보며 알아낸다. 게임이 끝난 뒤에는 풀이 단추를 두지 않는다.
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
    if (now.over || now.next !== 'teacher') return;
    const turns = round.trail.length;
    timer = setTimeout(() => {
      timer = null;
      if (frame.round !== round || round.trail.length !== turns || round.done) return;
      // 직접 만든 판과 작은 판에는 판 번호가 없다.
      const numbered = !round.custom && !round.side;
      const cell = teacherMove(round.board, round.trail, { level: numbered ? round.level : null, seed: numbered ? round.seed : null, first, teacher: teacherOf(round.level, round.custom) });
      if (cell !== null) play('teacher', cell);
    }, THINK_MS);
  }

  /** 수 하나를 놓는다. 차례가 아닌 쪽의 수와 둘 수 없는 수는 두지 않는다. */
  function play(who, cell) {
    const { round } = frame;
    if (!ready(round) || round.done) return;
    const first = firstOf(round);
    const before = replay(round.board, round.trail, first);
    if (before.over || before.next !== who) return;
    const after = replay(round.board, [...round.trail, cell], first);
    if (!after.ok) return;
    round.trail = [...round.trail, cell];
    flash = null;
    frame.note('move', { by: who, number: who === 'kid' ? after.kid.length : after.teacher.length, turn: round.trail.length, cell });
    if (after.over) {
      // 빈칸이 하나 남아 블랙홀이 되었다. 이긴 판도 진 판도 비긴 판도 "끝까지 둔 판"으로 끝낸다.
      round.winner = after.winner;
      round.hole = after.hole;
      round.sums = { ...after.sums };
      round.lost = { ...after.lost };
      swallowNow = true;
      frame.note('over', { winner: round.winner, hole: after.hole, sums: after.sums, lost: after.lost });
      frame.finish('solved');
      return;
    }
    // 선생님이 놓은 것은 판 아래에만 적는다(말로 하면 판을 시작할 때의 규칙 말을 덮고, 판마다 여러 번 되풀이된다).
    draw();
    frame.persist();
  }

  /** 아이가 칸을 눌렀다: 빈칸이면 내 다음 수를 놓고, 아니면 그 까닭을 판 아래에 적는다(놓지 않는다). */
  function tapCell(cell) {
    const { round } = frame;
    if (round.done || !ready(round)) return;
    const now = replay(round.board, round.trail, firstOf(round));
    if (now.over || now.next !== 'kid') return;
    if (now.empty.includes(cell)) {
      play('kid', cell);
      return;
    }
    const why = round.board.rocks.includes(cell) ? 'rock' : 'filled';
    round.refuseCount += 1;
    frame.note('refuse', { cell, why });
    flash = T.status[why];
    draw();
    frame.persist();
  }

  /** "먼저 둘래요" / "나중에 둘래요". 이 고르기가 이 판의 답이다. */
  function chooseOrder(order) {
    const { round, solution } = frame;
    if (!round || round.done || round.first !== null) return;
    round.first = order === 'first' ? 'kid' : 'teacher';
    // correct: 잘 두면 지지 않는 자리를 골랐는가(모르는 판은 null). 화면에서는 알리지 않는다(해 보면 알게 된다).
    const seat = seatOutcome(solution, round.first);
    const correct = seat === null ? null : seat !== 'lose';
    round.answers.push({ t: frame.stamp(), answer: order, correct });
    frame.note('pick-order', { order, correct });
    draw();
    frame.persist();
    frame.say(T.play[`order-${order}`]);
  }

  // ---- 끝난 뒤: 자리를 바꿔서 다시 두기, 방금 판 다시 보기 ----

  /** 자리를 바꾼 판: 내 수와 선생님 수를 바꾸고, 먼저 두는 쪽도 바꾼다 */
  const swapped = (board, first) => ({ rows: board.rows, rocks: [...board.rocks], kid: [...board.teacher], teacher: [...board.kid], first: board.first === null ? null : otherSide(first) });

  function rematch() {
    const { round } = frame;
    if (!round || !round.done || !ready(round)) return;
    // 선생님이 서 있던 자리에 선다: 미리 놓인 수의 주인과 먼저 두는 쪽을 바꾼다.
    const next = { first: otherSide(round.first), rematchOf: round.id };
    const start = { level: round.level, seed: round.seed, small: round.small, custom: round.custom, board: swapped(round.board, round.first) };
    frame.chooseAfter('swap', () => {
      preset = next;
      frame.startRound(FORMAT, start);
      frame.say(T.play.rematch);
    });
  }

  function rowOf(cards) {
    const row = document.createElement('div');
    row.className = 'figure-row';
    row.append(...cards);
    return row;
  }

  /** 방금 둔 수들을 한 수씩 넘겨 본다. 누가 어디에 무엇을 놓았는지를 그림과 말로 보인다. */
  function replayPages(round) {
    const first = firstOf(round);
    const total = round.trail.length;
    const moves = replay(round.board, round.trail, first).moves;
    return Array.from({ length: total + 1 }, (_, turns) => {
      const trail = round.trail.slice(0, turns);
      const move = turns === 0 ? null : moves[turns - 1];
      const parts = [turns === 0 ? T.replay.start : fill(T.replay[move.side], { no: ordinal(turns), k: move.number })];
      if (turns === total && round.winner !== null) parts.push(T.replay.last);
      const note = turns === 0 ? T.replay['note-start'] : T.replay[`note-${move.side}`];
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

  /** 끝났을 때 하는 말: 블랙홀이 빨아들인 합, 남은 합, 누가 이겼는지를 사실로 말한다. */
  function rightLine(round, solution) {
    // 수 뒤의 말은 그 수를 읽은 소리에 맞춘다("3이에요", "2예요").
    const tail = (value) => (endsClosed(value) ? 'closed' : 'open');
    const parts = [
      fill(T.right.lost[tail(round.lost.teacher)], { k: round.lost.kid, n: round.lost.teacher }),
      fill(T.right.left[tail(round.sums.teacher)], { k: round.sums.kid, n: round.sums.teacher }),
      T.right[round.winner],
    ];
    // 작은 판을 끝냈을 때는 덧붙이지 않는다(끝난 뒤에 고를 것이 다르다).
    if (round.side) return parts;
    const records = frame.records();
    const seat = seatOutcome(solution, round.first);
    const could = seat !== null && ((seat === 'win' && round.winner !== 'kid') || (seat === 'draw' && round.winner === 'teacher'));
    // 덧붙이는 말은 하나만 한다(한 번에 한 가지만 말한다).
    // 이 판으로 "왜 그럴까?"가 열렸으면 알려 준다.
    if (finishedCount(records) === WHY_AFTER) parts.push(T.right['why-invite']);
    // 아이의 자리가 끝까지 잘 두면 이기는(또는 지지 않는) 자리였으면 그 사실을 말한다(풀이 프로그램이 처음 자리를 끝까지 따진 판만).
    else if (could) parts.push(T.right[`could-${seat}`]);
    // 연달아 졌으면 자리를 바꿔 볼 수 있다고 알려 준다. 몇 번 졌는지는 말하지 않는다.
    else if (round.winner === 'teacher' && lostStreak(records) >= SWAP_INVITE_AFTER) parts.push(T.right['swap-invite']);
    return parts;
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----

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

  /** 둘 차례인 쪽부터 둘 다 잘 두면 어떻게 끝나는지의 말(한쪽에서 본 끝과 합의 차) */
  function endLine(next, value) {
    const outcome = outcomeOf(value);
    const parts = [T.solution[`${next}-${outcome}`]];
    if (outcome !== 'draw') parts.push(fill(T.solution.margin, { k: Math.abs(value) }));
    return parts.join(' ');
  }

  /** 가장 좋은 칸들: 둘 차례인 쪽이 놓으면 둘 다 잘 둘 때 가장 좋게 끝나는 칸 */
  function bestCells(board, first) {
    const values = moveValues({ ...board, first }, [], first) ?? [];
    if (values.length === 0) return [];
    const next = sideToMove(board, first);
    const mine = (value) => (next === 'kid' ? value : -value);
    const top = Math.max(...values.map((item) => mine(item.value)));
    return values.filter((item) => mine(item.value) === top).map((item) => item.cell);
  }

  /** 풀이: 먼저 두는 쪽마다 둘 다 잘 두면 어떻게 끝나는지와 가장 좋은 첫 칸. 끝까지 따질 수 없는 판은 그렇다고만 말한다 */
  function solutionPages(round, solution) {
    const { board } = round;
    if (!solution.exact) {
      return [{ say: fill(T.solution.big, { n: EXACT_LEFT }), nodes: [rowOf([boardCard(viewOf(board, [], firstOf(round)), T.solution['note-start'], { big: true })])] }];
    }
    const firsts = board.kid.length !== board.teacher.length ? [board.first] : round.first ? [round.first, otherSide(round.first)] : SIDES;
    return firsts
      .filter((first) => solution[first] !== null)
      .map((first) => {
        const next = sideToMove(board, first);
        return {
          say: endLine(next, solution[first]),
          get nodes() {
            return [rowOf([boardCard(viewOf(board, [], first, { rings: bestCells(board, first) }), T.solution[`note-${next}`], { big: true })])];
          },
        };
      });
  }

  // ---- 직접 만들기: 줄 수를 정하고, 칸을 눌러 돌과 미리 놓을 수를 놓고, 먼저 둘 쪽을 고른다. ----
  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    const ok = saved && Number.isInteger(saved.rows) && saved.rows >= LIMITS.min && saved.rows <= LIMITS.max && ['rocks', 'kid', 'teacher'].every((key) => Array.isArray(saved[key])) && SIDES.includes(saved.first);
    return copyBoard(ok ? saved : FIRST_DRAFT);
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    tool = 'rock';
    $('blackhole-make-result').textContent = '';
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  /** 만드는 판의 모습: 쓸 수 있는 판이면 null, 아니면 고칠 것 하나 */
  function draftProblem(board) {
    const why = checkBoard(board);
    if (why === null) return null;
    return T.make.check[why] ?? T.make.check.odd;
  }

  /** 미리 놓인 수가 한쪽에 더 많으면 먼저 둘 쪽은 정해져 있다 */
  function settleFirst(board) {
    if (board.kid.length > board.teacher.length) return { ...board, first: 'kid' };
    if (board.teacher.length > board.kid.length) return { ...board, first: 'teacher' };
    return board;
  }

  function drawMake() {
    $('blackhole-make-rows').textContent = fill(T.make.rows, { n: draft.rows });
    $('blackhole-make-rows-fewer').disabled = draft.rows <= LIMITS.min;
    $('blackhole-make-rows-more').disabled = draft.rows >= LIMITS.max;
    for (const name of TOOLS) $(`blackhole-make-tool-${name}`).setAttribute('aria-pressed', String(tool === name));
    const fixed = draft.kid.length !== draft.teacher.length;
    for (const side of SIDES) {
      $(`blackhole-make-first-${side}`).setAttribute('aria-pressed', String(draft.first === side));
      $(`blackhole-make-first-${side}`).disabled = fixed;
    }
    const problem = draftProblem(draft);
    $('blackhole-make-placing').textContent = problem ?? T.make.placing[tool];
    const now = { kid: draft.kid, teacher: draft.teacher, hole: null };
    drawBoard($('blackhole-make-board'), { rows: draft.rows, rocks: draft.rocks, kid: draft.kid, teacher: draft.teacher, label: labelOf(draft, now), onCell: placeAt });
  }

  function changeDraft(next) {
    draft = settleFirst(next);
    // 선생님이 앞의 판에 한 대답이 남아 있으면, 판이 바뀌었다는 짧은 말로 덮는다(바뀐 판의 대답이 아니다).
    if ($('blackhole-make-result').textContent !== '') frame.talkers.make.say(T.make.changed);
    $('blackhole-make-result').textContent = '';
    log.saveDraft(draft, FORMAT);
    drawMake();
  }

  /** 칸을 눌렀다: 고른 것(돌, 내 수, 선생님 수)을 그 칸에 놓거나 치운다 */
  function placeAt(cell) {
    const next = copyBoard(draft);
    const taken = draft.kid.includes(cell) || draft.teacher.includes(cell);
    if (tool === 'rock') {
      if (taken) {
        $('blackhole-make-placing').textContent = T.make.refuse.taken;
        return;
      }
      next.rocks = draft.rocks.includes(cell) ? draft.rocks.filter((item) => item !== cell) : [...draft.rocks, cell].sort((a, b) => a - b);
      changeDraft(next);
      return;
    }
    const mine = next[tool];
    if (mine.at(-1) === cell) mine.pop();
    else if (mine.includes(cell)) {
      $('blackhole-make-placing').textContent = T.make.refuse.biggest;
      return;
    } else if (taken || draft.rocks.includes(cell)) {
      $('blackhole-make-placing').textContent = T.make.refuse.taken;
      return;
    } else mine.push(cell);
    changeDraft(next);
  }

  /** 줄 수를 바꾼다. 판 밖으로 나간 돌은 빠지고, 판 밖으로 나간 수가 있으면 그 수부터 뒤의 수가 빠진다 */
  function resize(rows) {
    const total = cellCount(rows);
    const keep = (list) => {
      const out = list.findIndex((cell) => cell >= total);
      return out < 0 ? [...list] : list.slice(0, out);
    };
    changeDraft({ rows, rocks: draft.rocks.filter((cell) => cell < total), kid: keep(draft.kid), teacher: keep(draft.teacher), first: draft.first });
  }

  function chooseTool(name) {
    tool = name;
    drawMake();
  }

  /** 아이가 만든 판을 풀이 프로그램으로 풀어서, 둘 다 잘 두면 어떻게 끝나는지 알려 준다(빈칸이 많으면 그렇다고 말한다). */
  function solveDraft() {
    const problem = draftProblem(draft);
    if (problem !== null) {
      $('blackhole-make-result').textContent = problem;
      frame.talkers.make.say(problem);
      return;
    }
    const board = copyBoard(draft);
    const result = solve(board);
    const line = result.exact ? endLine(sideToMove(board), result.value) : fill(T.make.big, { n: EXACT_LEFT });
    $('blackhole-make-result').textContent = line;
    const now = new Date().toISOString();
    log.saveRecord({
      kind: 'made',
      v: 1,
      id: log.newId('m'),
      format: FORMAT,
      startedAt: now,
      endedAt: now,
      board,
      solution: { possible: true, exact: result.exact, kid: result.kid, teacher: result.teacher, value: result.value },
    });
    log.flush();
    frame.talkers.make.say(line);
  }

  /** 다 만든 판(공책에 남기거나 해 볼 판). 쓸 수 없는 판이면 null */
  function madeBoard() {
    return draft && checkBoard(draft) === null ? copyBoard(draft) : null;
  }

  function playDraft() {
    const board = madeBoard();
    if (!board) {
      const problem = draftProblem(draft);
      $('blackhole-make-result').textContent = problem;
      frame.talkers.make.say(problem);
      return;
    }
    frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board });
  }

  // ---- 단추 잇기 ----
  $('blackhole-first').addEventListener('click', () => chooseOrder('first'));
  $('blackhole-second').addEventListener('click', () => chooseOrder('second'));
  $('blackhole-swap').addEventListener('click', rematch);
  $('blackhole-replay').addEventListener('click', openReplay);
  $('blackhole-make-rows-fewer').addEventListener('click', () => resize(draft.rows - 1));
  $('blackhole-make-rows-more').addEventListener('click', () => resize(draft.rows + 1));
  for (const name of TOOLS) $(`blackhole-make-tool-${name}`).addEventListener('click', () => chooseTool(name));
  for (const side of SIDES) $(`blackhole-make-first-${side}`).addEventListener('click', () => changeDraft({ ...draft, first: side }));
  $('blackhole-make-solve').addEventListener('click', solveDraft);
  $('blackhole-make-play').addEventListener('click', playDraft);

  return {
    id: FORMAT,
    T,
    padId: 'blackhole-pad',
    makeId: 'make-blackhole',
    homeIds: { sample: 'home-blackhole-sample', blank: 'home-blackhole-blank', ask: 'home-blackhole-ask', play: 'home-blackhole-play', pick: 'home-blackhole-pick', make: 'home-blackhole-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },
    // 판이 세모꼴이라 위아래가 넉넉해야 칸이 커진다. 규칙 글은 왼쪽 칸 맨 위에 둔다.
    ruleAside: true,

    /** 새 판에서 이 형식이 맡는 값 */
    begin({ custom, board }) {
      const start = preset;
      preset = null;
      const order = orderOf(board);
      const first = start !== null ? start.first : board.first;
      return {
        mode: custom ? 'made' : 'game',
        order, // 'first'(빈 판에서 아이가 먼저) | 'given'(판이 정한 차례) | 'choose'(먼저 둘지 고른다)
        board: copyBoard(board), // 판: 줄 수, 돌, 미리 놓인 수, 판이 정한 먼저 두는 쪽
        first, // 먼저 두는 쪽('kid' | 'teacher'). 아직 고르지 않았으면 null
        chose: start === null && first === null, // 아이가 먼저 둘지 고르는 판인가
        assigned: start === null && first !== null, // 판이 아이의 차례를 정해 준 판인가
        trail: [], // 둔 수들(놓은 칸. 미리 놓인 수 다음에 둘 차례인 쪽부터 번갈아)
        winner: null, // 'kid' | 'teacher' | 'draw'. 끝나지 않았으면 null
        hole: null, // 끝났을 때 블랙홀이 된 칸
        sums: null, // 끝났을 때 남은 합 { kid, teacher }
        lost: null, // 끝났을 때 빨려 들어간 합 { kid, teacher }
        rematch: start !== null, // 자리를 바꿔서 다시 두는 판인가
        rematchOf: start?.rematchOf ?? null, // 그렇다면 바로 앞 판의 번호
        replayCount: 0, // "방금 판 다시 보기"를 연 수
        refuseCount: 0, // 놓을 수 없는 칸을 누른 수
      };
    },
    solve: (round) => solutionOf(round.board),
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (!MODES.includes(saved.mode) || !ORDERS.includes(saved.order) || checkBoard(saved.board) !== null) return false;
      if (!(saved.first === null || SIDES.includes(saved.first))) return false;
      if (!Array.isArray(saved.trail)) return false;
      // 차례를 정하기 전에는 둔 수가 없다. 끝난 게임은 하던 판이 아니다.
      if (saved.first === null) {
        if (saved.trail.length > 0) return false;
      } else {
        const now = replay(saved.board, saved.trail, saved.first);
        if (!now.ok || now.over) return false;
      }
      if (![saved.chose, saved.assigned, saved.rematch].every((value) => typeof value === 'boolean')) return false;
      if (![saved.replayCount, saved.refuseCount].every(count)) return false;
      return saved.winner === null;
    },
    /** 판 화면에서 이 형식의 것(판, 판 아래의 글, 끝난 뒤의 단추 둘)을 보이거나 감춘다. 이 형식에는 무르기와 되돌리기가 없다. */
    showParts(on) {
      $('blackhole-board').hidden = !on;
      $('blackhole-count').hidden = !on;
      if (on) {
        $('undo').hidden = true;
        $('reset').hidden = true;
      } else {
        $('blackhole-swap').hidden = true;
        $('blackhole-replay').hidden = true;
      }
    },
    enter: forget,
    draw,
    ended() {
      // 끝난 바로 그 그림에서 빨려 들어가는 움직임을 한 번 보인다. 그 밖의 것은 잊는다.
      flash = null;
      clearTimer();
    },
    ruleLine: () => T.rules.game,
    hints: (round) => T.hints[round.custom ? 'made' : rungOf(round.level).hint],
    touched: (round) => round.trail.length > 0 || round.answers.length > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view(round) {
      const now = replay(round.board, ready(round) ? round.trail : [], firstOf(round));
      return { first: round.first, turns: round.trail.length, left: now.empty.length, kid: now.kid, teacher: now.teacher };
    },
    /** 이 판보다 작은 판: 종류(먼저 둘지 고르는 판, 아이가 먼저, 수가 놓인 판)가 같고 칸이 더 적은 판, 없으면 수가 두 개 더 놓인 판 */
    smaller: (round, turn) => smallerBlackhole({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      const chosen = ready(round);
      const first = firstOf(round);
      const now = replay(round.board, chosen ? round.trail : [], first);
      const moves = now.moves.map((move) => ({ by: move.side, number: move.number, cell: move.cell }));
      const seat = chosen ? seatOutcome(solution, first) : null;
      return {
        mode: round.mode,
        order: round.order,
        // 판의 종류(먼저 둘지 고르는 판, 빈 판에서 아이가 먼저, 수가 놓인 판에서 누구 차례인지). 기록의 kind와 섞이지 않게 이름을 따로 둔다
        boardKind: kindOf(round.board),
        board: copyBoard(round.board),
        // 아이가 먼저 둘 때와 선생님이 먼저 둘 때 둘 다 잘 두면 끝에 (내 합 - 선생님 합)이 얼마인가(끝까지 따질 수 없는 판은 null)
        solution: { possible: true, exact: solution.exact, kid: solution.kid, teacher: solution.teacher },
        first: round.first,
        chose: round.chose,
        assigned: round.assigned,
        teacher: teacherOf(round.level, round.custom),
        // 아이의 자리가 잘 두면 어떻게 끝나는 자리였는가('win' | 'draw' | 'lose', 모르면 null), 지지 않는 자리였는가
        seat,
        choseWinner: seat === null ? null : seat !== 'lose',
        // 둔 수의 차례(누가, 몇을, 어느 칸에)
        moves,
        moveCount: moves.filter((move) => move.by === 'kid').length,
        turnCount: moves.length,
        winner: round.winner,
        hole: round.hole,
        sums: round.sums,
        lost: round.lost,
        // 아이가 잘 두면 갈 수 있던 끝보다 나쁜 자리로 보낸 수(몇 번째 수인지. 끝까지 따질 수 있는 자리에서 둔 수만)
        slips: chosen ? slipsOf(round.board, round.trail, first) : [],
        rematch: round.rematch,
        rematchOf: round.rematchOf,
        replayCount: round.replayCount,
        refuseCount: round.refuseCount,
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
      drawBoard(root, { rows: board.rows, rocks: board.rocks, kid: board.kid, teacher: board.teacher, small: true });
    },
    drawBlank(root) {
      drawBoard(root, { ...BLANK, small: true });
    },
    drawResume(root, saved) {
      const chosen = saved.first !== null;
      drawBoard(root, { ...viewOf(saved.board, chosen ? saved.trail : [], saved.first ?? 'kid'), small: true });
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 판 하나 */
    drawLevelPicture(root, entry) {
      const picture = entry.picture;
      if (picture.blank) drawBoard(root, { ...BLANK, small: true });
      else drawBoard(root, { ...figureView(picture), small: true });
    },
    showMake,
    /** 직접 만들기에서 다 만든 판(공책에 남기기가 쓴다). 쓸 수 없는 판이면 null */
    madeBoard,
  };
}

