// 여우와 토끼: 판 화면에서 이 형식이 맡는 부분(판, 먼저 갈지와 누가 이길지 고르기, 선생님이 움직이는 차례, 색 켜기,
// 끝났을 때 하는 말, 다시 보기와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/foxrabbit.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 선생님과 번갈아 여우와 토끼를 한 칸씩 움직인다. 반드시 한 칸 움직이고, 토끼는 여우 칸에 못 들어간다.
// 여우가 토끼 칸에 들어가면 여우가, 여우가 (가로 + 세로 - 3)번 움직이는 동안 안 잡히면 토끼가 이긴다. 판 아래에 여우가 움직인 횟수가 보인다(시계가 아니다).
// 아이가 되는 동물(role: 'fox' | 'rabbit')과 먼저 움직이는 쪽(first)은 단계가 정하거나, 두기 전에 아이가 고른다:
//   토끼가 되어 놀기(1단계)는 둘 다 판이 정한다. 먼저 갈까 나중에 갈까(2, 3단계)는 토끼인 아이가 먼저 갈지 고른다.
//   여우가 되어 놀기(4단계)는 둘 다 판이 정한다(컴퓨터 토끼가 고르면 늘 맞는 쪽을 골라 버린다).
//   누가 이길지 맞히기(5단계)는 먼저 "여우가 이겨요" 또는 "토끼가 이겨요"를 고르고, 고른 쪽이 되어 해 본다. 직접 만든 판은 될 동물을 고른다.
// 고르기가 이 판의 답이다(화면에서는 맞았는지 알리지 않는다. 해 보면 알게 된다).
// 판이 끝나면 누가 이겼는지를 사실로만 말한다. 몇 번 이기고 졌는지는 세어 보여 주지 않는다.
// 선생님은 자기 차례에 잠깐 뜸을 들이고 둔다. 이길 수 있으면 이기게 두고, 질 판에서도 여우는 쫓아가고 토끼는 가장 오래 버틴다(풀이 프로그램).
// 선생님의 수는 (단계, 판 번호, 아이가 된 동물, 먼저 움직이는 쪽, 지금까지 둔 수들)로 정해진다. 그래서 나갔다가 돌아와도 같은 수를 둔다.
// 왼쪽 칸의 "색 켜기"는 판을 바둑판처럼 두 색으로 칠한다(방 한 번씩 돌기와 같은 도구)(쓰라고 권하지 않는다. 처음 켜면 힌트 하나로 센다).
import T from '../content/foxrabbit.json';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf, solutionOf } from '../core/foxrabbit-ladder.js';
import {
  ANIMALS,
  LIMITS,
  WHY_AFTER,
  checkBoard,
  copyBoard,
  finishedCount,
  limitOf,
  lostStreak,
  movesOf,
  neighbors,
  otherAnimal,
  replay,
  seatWins,
  slipsOf,
  solve,
  teacherMove,
  walk,
  whyOpen,
} from '../core/foxrabbit.js';
import { smallerFoxrabbit } from '../core/smaller.js';
import { fill, ordinal } from '../core/text.js';
import { boardCard, drawBoard } from '../ui/foxrabbit-board.js';

const FORMAT = 'foxrabbit';
const MODES = ['rabbit', 'choose', 'fox', 'predict', 'made'];
/** 선생님이 두기 전에 뜸을 들이는 시간(밀리초, 임시) */
const THINK_MS = 800;
/** 처음 화면과 판 고르기에 그리는 빈 판 */
const BLANK = { w: 3, h: 3, fox: 0, rabbit: 8, first: 'fox' };
const FIRST_DRAFT = { w: 4, h: 4, fox: 0, rabbit: 15, first: 'fox' };
/** 연달아 이만큼 지면 자리를 바꿔 보기를 권한다(임시) */
const SWAP_INVITE_AFTER = 2;
/** 글자판의 화살표: 가로와 세로로 움직이는 만큼 */
const ARROWS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createFoxrabbit(frame) {
  const { $, log } = frame;
  let flash = null; // 판 아래에 잠깐 적는 사실. 다음에 무엇을 누르면 지운다
  let timer = null; // 선생님이 뜸을 들이는 중이면 그 타이머
  let preset = null; // 자리를 바꿔서 다시 둘 때, 새 판에 미리 정해 줄 것 { role, first, rematchOf }
  let draft = null; // 직접 만들기에서 만들던 판
  let placing = 'fox'; // 직접 만들기에서 칸을 누르면 놓을 동물

  const count = (value) => Number.isInteger(value) && value >= 0;
  const ready = (round) => round.role !== null && round.first !== null;
  const firstOf = (round) => round.first ?? 'fox';
  const isAnimal = (value) => ANIMALS.includes(value);

  /** 칸을 읽어 주는 이름: 자리와 그 칸에 있는 것 */
  function labelOf(board, now, targets) {
    return (cell) => {
      const where = fill(T.cellLabel, { no: ordinal(Math.floor(cell / board.w) + 1), n: ordinal((cell % board.w) + 1) });
      const what = now.fox === cell && now.rabbit === cell ? 'caught' : now.fox === cell ? 'fox' : now.rabbit === cell ? 'rabbit' : targets.includes(cell) ? 'target' : 'open';
      return `${where}, ${T.cellNames[what]}`;
    };
  }

  /** 대본의 그림 하나(why와 판 고르기): 둔 수들을 그대로 따라간 모습 */
  function figureView(item) {
    const { board } = item;
    const now = walk(board, item.trail ?? [], board.first ?? 'fox');
    return { w: board.w, h: board.h, fox: now.fox, rabbit: now.rabbit, last: now.last, colorOn: item.colorOn === true };
  }

  /** 판과 둔 수들로 그릴 것(보기만 하는 그림) */
  function viewOf(board, trail, first, more = {}) {
    const now = replay(board, trail, first);
    return { w: board.w, h: board.h, fox: now.fox, rabbit: now.rabbit, last: now.moves.at(-1) ?? null, ...more };
  }

  function clearTimer() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  function forget() {
    flash = null;
    clearTimer();
  }

  // ---- 판 ----
  function statusOf(round, now) {
    if (!ready(round)) {
      if (round.mode === 'predict' && round.role === null) return T.status.predict;
      if (round.role === null) return T.status.role;
      return T.status.choose;
    }
    if (now.over) return T.status[`over-${now.winner}`];
    if (now.next !== round.role) return T.status['teacher-turn'];
    // 방금 선생님이 움직였으면 그것을 적는다.
    const last = now.moves.at(-1);
    if (last && last.animal !== round.role) return T.status[`teacher-${last.animal}`];
    return T.status[`kid-${round.role}`];
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
    const targets = mine ? movesOf(board, trail, first) : [];

    drawBoard($('foxrabbit-board'), {
      w: board.w,
      h: board.h,
      fox: now.fox,
      rabbit: now.rabbit,
      colorOn: round.colorOn,
      targets,
      last: now.moves.at(-1) ?? null,
      label: labelOf(board, now, targets),
      onCell: mine ? tapCell : undefined,
    });
    $('foxrabbit-status').textContent = flash ?? statusOf(round, now);
    $('foxrabbit-moves').textContent = String(now.foxMoves);
    $('foxrabbit-limit').textContent = String(now.limit);

    // 왼쪽 칸: 색 켜기
    $('foxrabbit-color').textContent = T.tool[round.colorOn ? 'on' : 'off'];
    $('foxrabbit-color').setAttribute('aria-pressed', String(round.colorOn));

    // 오른쪽 칸: 누가 이길지 → 될 동물 → 먼저 갈지 → 차례
    $('foxrabbit-predict').hidden = !(playing && round.mode === 'predict' && round.role === null);
    $('foxrabbit-pick-role').hidden = !(playing && round.mode !== 'predict' && round.role === null);
    $('foxrabbit-order').hidden = !(playing && round.role !== null && round.first === null);
    $('foxrabbit-guess-line').hidden = round.guess === null;
    if (round.guess !== null) $('foxrabbit-guess-line').textContent = T.guesses[round.guess];
    $('foxrabbit-role').hidden = round.role === null;
    if (round.role !== null) $('foxrabbit-role').textContent = T.roles[round.role];
    $('foxrabbit-first-line').hidden = round.first === null;
    if (round.first !== null) $('foxrabbit-first-line').textContent = T.firsts[round.first];
    $('foxrabbit-turn-box').hidden = !live;
    if (live) {
      $('foxrabbit-turn').textContent = T.turn[mine ? 'kid' : 'teacher'];
      $('foxrabbit-howto').textContent = T.howto[round.role];
    }

    // 끝난 뒤 고르기에 게임만의 것 둘을 더한다. 진 판 뒤에는 "자리를 바꿔서 다시 두기"를 맨 위에 둔다.
    // 작은 판을 끝낸 뒤에는 틀의 두 단추(원래 판으로 돌아가기, 작은 판 하나 더)만 나온다.
    const done = round.done && !round.side;
    const lost = done && round.winner === 'teacher';
    $('foxrabbit-swap').hidden = !(done && ready(round));
    $('foxrabbit-replay').hidden = !(done && round.trail.length > 0);
    $('foxrabbit-swap').classList.toggle('primary', lost);
    if (done) {
      $(lost ? 'after-same' : 'after-make').before($('foxrabbit-swap'), $('foxrabbit-replay'));
      // 어느 쪽이 이기는 판인지는 자리를 바꿔 해 보며 알아낸다. 게임이 끝난 뒤에는 풀이 단추를 두지 않는다.
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
      const cell = teacherMove(round.board, round.trail, { level: numbered ? round.level : null, seed: numbered ? round.seed : null, role: round.role, first });
      if (cell !== null) play('teacher', cell);
    }, THINK_MS);
  }

  /** 한 칸 움직인다. 차례가 아닌 쪽의 수와 둘 수 없는 수는 두지 않는다. */
  function play(who, cell) {
    const { round } = frame;
    if (!ready(round) || round.done) return;
    const first = firstOf(round);
    const before = replay(round.board, round.trail, first);
    const animal = who === 'kid' ? round.role : otherAnimal(round.role);
    if (before.over || before.next !== animal) return;
    const after = replay(round.board, [...round.trail, cell], first);
    if (!after.ok) return;
    round.trail = [...round.trail, cell];
    flash = null;
    frame.note('move', { by: who, animal, turn: round.trail.length, cell });
    if (after.over) {
      // 여우가 잡았거나, 여우가 움직일 수 있는 만큼 다 움직였다. 이긴 판도 진 판도 "끝까지 둔 판"으로 끝낸다.
      round.winner = after.winner === round.role ? 'kid' : 'teacher';
      round.foxMoves = after.foxMoves;
      frame.note('over', { winner: round.winner, animal: after.winner, foxMoves: after.foxMoves });
      frame.finish('solved');
      return;
    }
    // 선생님이 옮긴 것은 판 아래에만 적는다(말로 하면 판을 시작할 때의 규칙 말을 덮고, 판마다 여러 번 되풀이된다).
    draw();
    frame.persist();
  }

  /** 아이가 칸을 눌렀다: 갈 수 있는 칸이면 옮기고, 아니면 그 까닭을 판 아래에 적는다(옮기지 않는다). */
  function tapCell(cell) {
    const { round } = frame;
    if (round.done || !ready(round)) return;
    const first = firstOf(round);
    const now = replay(round.board, round.trail, first);
    if (now.over || now.next !== round.role) return;
    if (movesOf(round.board, round.trail, first).includes(cell)) {
      play('kid', cell);
      return;
    }
    const here = round.role === 'fox' ? now.fox : now.rabbit;
    const next = neighbors(round.board.w, round.board.h, here).includes(cell);
    const why = cell === here ? 'stay' : next ? 'onto-fox' : 'far';
    round.refuseCount += 1;
    frame.note('refuse', { cell, why });
    flash = T.status[why];
    draw();
    frame.persist();
  }

  /** "먼저 갈래요" / "나중에 갈래요". 아이가 된 동물과 이 고르기가 이 판의 답이다. */
  function chooseOrder(order) {
    const { round, solution } = frame;
    if (!round || round.done || round.role === null || round.first !== null) return;
    round.first = order === 'first' ? round.role : otherAnimal(round.role);
    // correct: 잘 하면 이기는 쪽을 골랐는가. 화면에서는 알리지 않는다(해 보면 알게 된다).
    const correct = seatWins(solution, round.role, round.first);
    round.answers.push({ t: frame.stamp(), answer: order, correct, guess: null });
    frame.note('pick-order', { order, correct });
    draw();
    frame.persist();
    frame.say(T.play[`order-${order}`]);
  }

  /** "여우가 이겨요" / "토끼가 이겨요": 짐작한 쪽이 되어 해 본다 */
  function chooseGuess(animal) {
    const { round, solution } = frame;
    if (!round || round.done || round.mode !== 'predict' || round.role !== null) return;
    round.guess = animal;
    round.role = animal;
    const correct = solution.winner === animal;
    round.answers.push({ t: frame.stamp(), answer: animal, correct, guess: animal });
    frame.note('pick-guess', { guess: animal, correct });
    draw();
    frame.persist();
    frame.say(T.play[`guess-${animal}`]);
  }

  /** 직접 만든 판: "여우가 될래요" / "토끼가 될래요" */
  function chooseRole(animal) {
    const { round, solution } = frame;
    if (!round || round.done || round.mode === 'predict' || round.role !== null) return;
    round.role = animal;
    const correct = round.first !== null ? seatWins(solution, animal, round.first) : null;
    round.answers.push({ t: frame.stamp(), answer: animal, correct, guess: null });
    frame.note('pick-role', { role: animal, correct });
    draw();
    frame.persist();
    frame.say(T.play[`role-${animal}`]);
  }

  /** 판을 바둑판처럼 두 색으로 칠하거나 지운다 */
  function toggleColor() {
    const { round } = frame;
    if (!round) return;
    round.colorOn = !round.colorOn;
    if (round.colorOn) {
      round.colorShown = true;
      round.colorCount += 1;
    }
    frame.note('color', { on: round.colorOn });
    draw();
    // 끝난 판에서도 켜 볼 수 있다(끝난 모습을 들여다본다). 끝난 판이면 기록을 고쳐 적는다.
    frame.keep();
  }

  /** 글자판의 화살표로 아이의 동물을 옮긴다 */
  function onKey(event) {
    const step = ARROWS[event.key];
    const { round } = frame;
    if (!step || !round || round.done || !ready(round)) return;
    const now = replay(round.board, round.trail, firstOf(round));
    if (now.over || now.next !== round.role) return;
    const { w, h } = round.board;
    const here = round.role === 'fox' ? now.fox : now.rabbit;
    const x = (here % w) + step[0];
    const y = Math.floor(here / w) + step[1];
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    event.preventDefault();
    tapCell(y * w + x);
  }

  // ---- 끝난 뒤: 자리를 바꿔서 다시 두기, 방금 판 다시 보기 ----
  function rematch() {
    const { round } = frame;
    if (!round || !round.done || !ready(round)) return;
    // 선생님이 서 있던 자리: 동물을 바꾸고, 먼저 움직이는 쪽과 처음 자리는 그대로 둔다.
    const next = { role: otherAnimal(round.role), first: round.first, rematchOf: round.id };
    const start = { level: round.level, seed: round.seed, small: round.small, custom: round.custom, board: copyBoard(round.board) };
    frame.chooseAfter('swap', () => {
      preset = next;
      frame.startRound(FORMAT, start);
      frame.say(fill(T.play.rematch, { face: T.animals[next.role] }));
    });
  }

  function rowOf(cards) {
    const row = document.createElement('div');
    row.className = 'figure-row';
    row.append(...cards);
    return row;
  }

  /** 방금 둔 수들을 한 수씩 넘겨 본다. 누가 무엇을 옮겼는지를 그림과 말로 보인다. */
  function replayPages(round) {
    const first = firstOf(round);
    const total = round.trail.length;
    const moves = replay(round.board, round.trail, first).moves;
    return Array.from({ length: total + 1 }, (_, turns) => {
      const trail = round.trail.slice(0, turns);
      const animal = turns === 0 ? null : moves[turns - 1].animal;
      const who = animal === null ? null : animal === round.role ? 'kid' : 'teacher';
      const parts = [turns === 0 ? T.replay[`start-${round.role}`] : fill(T.replay[who], { no: ordinal(turns), face: T.animals[animal] })];
      if (turns === total && round.winner !== null) parts.push(T.replay.last);
      const note = turns === 0 ? T.replay['note-start'] : T.replay[`note-${who}`];
      return {
        say: parts.join(' '),
        // 그림은 종이를 넘길 때 그린다.
        get nodes() {
          return [rowOf([boardCard(viewOf(round.board, trail, first, { colorOn: round.colorOn }), note, { big: true })])];
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

  /** 처음 자리에서 둘 다 잘 하면 여우가 몇 번 만에 잡는가(못 잡으면 null) */
  const stepsOf = (solution, first) => (first === 'fox' ? solution.foxFirst : solution.rabbitFirst);

  /** 끝났을 때 하는 말: 여우가 잡았는지, 토끼가 끝까지 안 잡혔는지와 누가 이겼는지를 사실로 말한다. */
  function rightLine(round, solution) {
    const winnerAnimal = round.winner === 'kid' ? round.role : otherAnimal(round.role);
    const limit = limitOf(round.board);
    const parts = [fill(T.right[`${winnerAnimal}-${round.winner}`], { k: round.foxMoves, n: limit })];
    // 작은 판을 끝냈을 때는 덧붙이지 않는다(끝난 뒤에 고를 것이 다르다).
    if (round.side) return parts;
    const records = frame.records();
    const could = round.role === 'fox' && round.winner === 'teacher' && seatWins(solution, 'fox', round.first);
    // 덧붙이는 말은 하나만 한다(한 번에 한 가지만 말한다).
    // 이 판으로 "왜 그럴까?"가 열렸으면 알려 준다.
    if (finishedCount(records) === WHY_AFTER) parts.push(T.right['why-invite']);
    // 누가 이길지 짐작한 판이면 처음 짐작을 사실로 다시 말한다(맞았는지는 말하지 않는다).
    else if (round.guess !== null) parts.push(T.right[`guess-${round.guess}`]);
    // 여우인 아이가 잡을 수 있는 판에서 못 잡았으면, 가장 빨리 다가가면 몇 번 만에 잡는 판인지 말한다.
    else if (could) parts.push(fill(T.right['fox-could'], { k: stepsOf(solution, round.first) }));
    // 연달아 졌으면 자리를 바꿔 볼 수 있다고 알려 준다. 몇 번 졌는지는 말하지 않는다.
    else if (round.winner === 'teacher' && lostStreak(records) >= SWAP_INVITE_AFTER) parts.push(T.right['swap-invite']);
    // 토끼가 이겼으면 여우가 움직일 수 있는 횟수가 왜 그만큼인지 사실로 말한다.
    else if (winnerAnimal === 'rabbit') parts.push(fill(T.right.limit, { n: limit }));
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

  /** 풀이: 먼저 움직이는 쪽마다 둘 다 잘 하면 누가 이기는지와 여우가 몇 번 만에 잡는지 */
  function solutionPages(round, solution) {
    const { board } = round;
    const firsts = board.first ? [board.first] : round.first ? [round.first, otherAnimal(round.first)] : ANIMALS;
    return firsts.map((first) => {
      const winner = solution[first];
      return {
        say: fill(T.solution[winner], { face: T.animals[first], k: stepsOf(solution, first) }),
        get nodes() {
          return [rowOf([boardCard(viewOf(board, [], first, { colorOn: true }), T.solution[`note-${winner}`], { big: true })])];
        },
      };
    });
  }

  // ---- 직접 만들기: 가로와 세로의 칸 수를 정하고, 칸을 눌러 여우와 토끼를 놓고, 먼저 움직일 쪽을 고른다. ----
  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    const ok = saved && checkBoard(saved) === null && isAnimal(saved.first);
    return copyBoard(ok ? saved : FIRST_DRAFT);
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    placing = 'fox';
    $('foxrabbit-make-result').textContent = '';
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function setStepper(id, value) {
    $(id).textContent = fill(T.make.cells, { n: value });
    $(`${id}-fewer`).disabled = value <= LIMITS.min;
    $(`${id}-more`).disabled = value >= LIMITS.max;
  }

  function drawMake() {
    setStepper('foxrabbit-make-w', draft.w);
    setStepper('foxrabbit-make-h', draft.h);
    for (const animal of ANIMALS) {
      $(`foxrabbit-make-place-${animal}`).setAttribute('aria-pressed', String(placing === animal));
      $(`foxrabbit-make-first-${animal}`).setAttribute('aria-pressed', String(draft.first === animal));
    }
    $('foxrabbit-make-placing').textContent = fill(T.make.placing, { face: T.animals[placing] });
    const now = { fox: draft.fox, rabbit: draft.rabbit };
    drawBoard($('foxrabbit-make-board'), { w: draft.w, h: draft.h, fox: draft.fox, rabbit: draft.rabbit, label: labelOf(draft, now, []), onCell: placeAt });
  }

  function changeDraft(next) {
    if (checkBoard(next) !== null || !isAnimal(next.first)) return;
    draft = next;
    // 선생님이 앞의 판에 한 대답이 남아 있으면, 판이 바뀌었다는 짧은 말로 덮는다(바뀐 판의 대답이 아니다).
    if ($('foxrabbit-make-result').textContent !== '') frame.talkers.make.say(T.make.changed);
    $('foxrabbit-make-result').textContent = '';
    log.saveDraft(draft, FORMAT);
    drawMake();
  }

  /** 칸을 눌렀다: 고른 동물을 그 칸에 놓는다. 다른 동물이 있는 칸이면 둘의 자리를 바꾼다 */
  function placeAt(cell) {
    const other = otherAnimal(placing);
    const next = copyBoard(draft);
    if (draft[other] === cell) next[other] = draft[placing];
    next[placing] = cell;
    changeDraft(next);
  }

  /** 가로나 세로의 칸 수를 바꾼다. 동물은 같은 자리(가로, 세로)에 남고, 판 밖으로 나가면 판 끝으로 들어온다 */
  function resize(w, h) {
    const move = (cell) => {
      const x = Math.min(cell % draft.w, w - 1);
      const y = Math.min(Math.floor(cell / draft.w), h - 1);
      return y * w + x;
    };
    const fox = move(draft.fox);
    let rabbit = move(draft.rabbit);
    // 둘이 같은 칸에 오면 토끼를 판의 맨 끝 칸부터 빈 곳에 놓는다.
    if (rabbit === fox) rabbit = fox === w * h - 1 ? 0 : w * h - 1;
    changeDraft({ w, h, fox, rabbit, first: draft.first });
  }

  function choosePlacing(animal) {
    placing = animal;
    drawMake();
  }

  /** 아이가 만든 판을 풀이 프로그램으로 풀어서, 둘 다 잘 하면 누가 이기고 여우가 몇 번 만에 잡는지 알려 준다. */
  function solveDraft() {
    const board = copyBoard(draft);
    const result = solve(board);
    const line = fill(T.make[result.winner], { k: stepsOf(result, board.first) });
    $('foxrabbit-make-result').textContent = line;
    const now = new Date().toISOString();
    log.saveRecord({
      kind: 'made',
      v: 1,
      id: log.newId('m'),
      format: FORMAT,
      startedAt: now,
      endedAt: now,
      board,
      solution: { possible: true, same: result.same, limit: result.limit, foxFirst: result.foxFirst, rabbitFirst: result.rabbitFirst, winner: result.winner },
    });
    log.flush();
    frame.talkers.make.say(line);
  }

  /** 다 만든 판(공책에 남기거나 해 볼 판). 여우와 토끼가 늘 놓여 있어서 언제나 해 볼 수 있다 */
  function madeBoard() {
    return draft ? copyBoard(draft) : null;
  }

  function playDraft() {
    const board = madeBoard();
    if (board) frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board });
  }

  // ---- 단추 잇기 ----
  $('foxrabbit-guess-fox').addEventListener('click', () => chooseGuess('fox'));
  $('foxrabbit-guess-rabbit').addEventListener('click', () => chooseGuess('rabbit'));
  $('foxrabbit-be-fox').addEventListener('click', () => chooseRole('fox'));
  $('foxrabbit-be-rabbit').addEventListener('click', () => chooseRole('rabbit'));
  $('foxrabbit-first').addEventListener('click', () => chooseOrder('first'));
  $('foxrabbit-second').addEventListener('click', () => chooseOrder('second'));
  $('foxrabbit-color').addEventListener('click', toggleColor);
  $('foxrabbit-swap').addEventListener('click', rematch);
  $('foxrabbit-replay').addEventListener('click', openReplay);
  $('foxrabbit-make-w-fewer').addEventListener('click', () => resize(draft.w - 1, draft.h));
  $('foxrabbit-make-w-more').addEventListener('click', () => resize(draft.w + 1, draft.h));
  $('foxrabbit-make-h-fewer').addEventListener('click', () => resize(draft.w, draft.h - 1));
  $('foxrabbit-make-h-more').addEventListener('click', () => resize(draft.w, draft.h + 1));
  for (const animal of ANIMALS) {
    $(`foxrabbit-make-place-${animal}`).addEventListener('click', () => choosePlacing(animal));
    $(`foxrabbit-make-first-${animal}`).addEventListener('click', () => changeDraft({ ...draft, first: animal }));
  }
  $('foxrabbit-make-solve').addEventListener('click', solveDraft);
  $('foxrabbit-make-play').addEventListener('click', playDraft);

  return {
    id: FORMAT,
    T,
    padId: 'foxrabbit-pad',
    makeId: 'make-foxrabbit',
    homeIds: { sample: 'home-foxrabbit-sample', blank: 'home-foxrabbit-blank', ask: 'home-foxrabbit-ask', play: 'home-foxrabbit-play', pick: 'home-foxrabbit-pick', make: 'home-foxrabbit-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },
    // 판이 정사각형에 가까워서 규칙 글은 왼쪽 칸 맨 위에 둔다.
    ruleAside: true,

    /** 새 판에서 이 형식이 맡는 값 */
    begin({ level, custom, board }) {
      const start = preset;
      preset = null;
      const mode = custom ? 'made' : rungOf(level).mode;
      // 단계가 정해 준 동물: 1~3단계는 토끼, 4단계는 여우. 직접 만든 판의 작은 판은 원래 판에서 아이가 된 동물을 그대로 쓴다.
      let given = mode === 'rabbit' || mode === 'choose' ? 'rabbit' : mode === 'fox' ? 'fox' : null;
      const parent = frame.round;
      if (mode === 'made' && parent && parent.format === FORMAT && parent.mode === 'made' && isAnimal(parent.role)) given = parent.role;
      const role = start !== null ? start.role : given;
      const first = start !== null ? start.first : (board.first ?? null);
      const chose = start === null && (role === null || first === null);
      return {
        mode,
        board: copyBoard(board), // 판: 크기, 처음 자리, 판이 정한 먼저 움직이는 쪽
        role, // 아이가 된 동물('fox' | 'rabbit'). 아직 고르지 않았으면 null
        first, // 먼저 움직이는 쪽('fox' | 'rabbit'). 아직 고르지 않았으면 null
        guess: null, // 누가 이길지 맞히기에서 고른 짐작('fox' | 'rabbit'). 아직이거나 짐작하지 않는 판이면 null
        chose, // 아이가 먼저 갈지(또는 누가 이길지, 될 동물) 고르는 판인가
        assigned: start === null && !chose, // 단계가 아이의 자리를 정해 준 판인가
        trail: [], // 둔 수들(움직인 동물이 들어간 칸. 먼저 움직이는 쪽부터 번갈아)
        winner: null, // 이긴 사람('kid' | 'teacher'). 끝나지 않았으면 null
        foxMoves: null, // 끝났을 때 여우가 움직인 횟수
        rematch: start !== null, // 자리를 바꿔서 다시 두는 판인가
        rematchOf: start?.rematchOf ?? null, // 그렇다면 바로 앞 판의 번호
        replayCount: 0, // "방금 판 다시 보기"를 연 수
        colorOn: false, // 판에 두 색을 칠해 두었는가
        colorShown: false, // 그것을 한 번이라도 켜 보았는가
        colorCount: 0, // 켠 수
        refuseCount: 0, // 갈 수 없는 칸을 누른 수
      };
    },
    solve: (round) => solutionOf(round.board),
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (!MODES.includes(saved.mode) || checkBoard(saved.board) !== null) return false;
      if (![saved.role, saved.first, saved.guess].every((value) => value === null || isAnimal(value))) return false;
      if (!Array.isArray(saved.trail)) return false;
      // 자리를 정하기 전에는 둔 수가 없다. 끝난 게임은 하던 판이 아니다.
      if (saved.role === null || saved.first === null) {
        if (saved.trail.length > 0) return false;
      } else {
        const now = replay(saved.board, saved.trail, saved.first);
        if (!now.ok || now.over) return false;
      }
      if (![saved.chose, saved.assigned, saved.rematch, saved.colorOn, saved.colorShown].every((value) => typeof value === 'boolean')) return false;
      if (![saved.replayCount, saved.colorCount, saved.refuseCount].every(count)) return false;
      return saved.winner === null;
    },
    /** 판 화면에서 이 형식의 것(판, 판 아래의 글, 왼쪽 칸의 도구, 끝난 뒤의 단추 둘)을 보이거나 감춘다. 이 형식에는 무르기와 되돌리기가 없다. */
    showParts(on) {
      $('foxrabbit-board').hidden = !on;
      $('foxrabbit-count').hidden = !on;
      $('foxrabbit-color').hidden = !on;
      if (on) {
        $('undo').hidden = true;
        $('reset').hidden = true;
      } else {
        $('foxrabbit-swap').hidden = true;
        $('foxrabbit-replay').hidden = true;
      }
    },
    enter: forget,
    draw,
    ended: forget,
    ruleLine: (round) => fill(T.rules.game, { n: limitOf(round.board) }),
    hints: (round) => T.hints[round.custom ? 'made' : rungOf(round.level).hint],
    touched: (round) => round.trail.length > 0 || round.answers.length > 0 || round.colorShown,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view(round) {
      const now = replay(round.board, ready(round) ? round.trail : [], firstOf(round));
      return { role: round.role, first: round.first, guess: round.guess, turns: round.trail.length, foxMoves: now.foxMoves, colorOn: round.colorOn };
    },
    /** 이 판보다 작은 판: 칸이 더 적고, 둘이 같은 색 칸인지와 먼저 움직이는 쪽이 같은 판 */
    smaller: (round, turn) => smallerFoxrabbit({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      const chosen = ready(round);
      const first = firstOf(round);
      const now = replay(round.board, chosen ? round.trail : [], first);
      const moves = now.moves.map((move) => ({ by: move.animal === round.role ? 'kid' : 'teacher', animal: move.animal, cell: move.to }));
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        // 여우가 먼저일 때와 토끼가 먼저일 때 둘 다 잘 하면 이기는 쪽, 여우가 잡는 횟수, 처음에 같은 색인지, 여우가 움직일 수 있는 횟수
        solution: { possible: true, same: solution.same, limit: solution.limit, foxFirst: solution.foxFirst, rabbitFirst: solution.rabbitFirst, fox: solution.fox, rabbit: solution.rabbit },
        role: round.role,
        first: round.first,
        guess: round.guess,
        chose: round.chose,
        assigned: round.assigned,
        // 아이가 선 자리가 잘 하면 이기는 자리였는가(아직 정하지 않았으면 null)
        choseWinner: chosen ? seatWins(solution, round.role, first) : null,
        // 둔 수의 차례(누가, 어느 동물을, 어느 칸으로)
        moves,
        moveCount: moves.filter((move) => move.by === 'kid').length,
        turnCount: moves.length,
        foxMoves: now.foxMoves,
        winner: round.winner,
        // 아이가 이기는 자리에서 지는 자리로 보낸 수(몇 번째 수인지)
        slips: chosen ? slipsOf(round.board, round.trail, first, round.role) : [],
        rematch: round.rematch,
        rematchOf: round.rematchOf,
        replayCount: round.replayCount,
        // 색 켜기: 켜 본 적이 있으면 힌트 하나로 센다
        colorShown: round.colorShown,
        colorCount: round.colorCount,
        refuseCount: round.refuseCount,
        hintsOpened: round.hintsOpened + (round.colorShown ? 1 : 0),
      };
    },
    rightLine,
    whyPages,
    solutionPages,
    undo() {},
    reset() {},
    onKey,

    // ---- 처음 화면에 그리는 그림 ----
    homeAsk: (level) => T.home.ask[rungOf(level).hint],
    pickLine: () => T.home.pick,
    drawSample(root, board) {
      drawBoard(root, { w: board.w, h: board.h, fox: board.fox, rabbit: board.rabbit, small: true });
    },
    drawBlank(root) {
      drawBoard(root, { ...BLANK, small: true });
    },
    drawResume(root, saved) {
      const chosen = saved.role !== null && saved.first !== null;
      drawBoard(root, { ...viewOf(saved.board, chosen ? saved.trail : [], saved.first ?? 'fox'), small: true });
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 판 하나 */
    drawLevelPicture(root, entry) {
      const picture = entry.picture;
      if (picture.blank) drawBoard(root, { ...BLANK, small: true });
      else drawBoard(root, { ...figureView(picture), small: true });
    },
    showMake,
    /** 직접 만들기에서 다 만든 판(공책에 남기기가 쓴다) */
    madeBoard,
  };
}
