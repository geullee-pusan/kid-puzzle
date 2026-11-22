// 손가락 더하기: 판 화면에서 이 형식이 맡는 부분(판, 먼저 칠지 고르기, 선생님이 치는 차례, 끝났을 때 하는 말, 다시 보기와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/fingers.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 두 사람이 두 손에 손가락을 펴고 마주 앉는다(선생님 손은 위, 내 손은 아래). 내 차례에는 내 손 하나를 누르고, 칠 선생님 손을 누른다.
// 맞은 손에 친 손의 손가락 수만큼 손가락이 늘어나고, 빠지는 수가 되면(기본 규칙은 넘어도) 그 손은 주먹이 되어 빠진다.
// 두 손이 다 빠진 쪽이 지고, 같은 모습이 다시 나오면 비긴다(다시 도는 규칙에서만 생긴다).
// 먼저 치는 쪽은 판이 정하거나, 치기 전에 아이가 고른다(먼저 칠까, 나중에 칠까). 고르기가 이 판의 답이다(화면에서는 맞았는지 알리지 않는다).
// 판이 끝나면 누구의 두 손이 다 빠졌는지, 누가 이겼는지를 사실로만 말한다. 몇 번 이기고 졌는지는 세어 보여 주지 않는다.
// 선생님은 자기 차례에 잠깐 뜸을 들이고 친다. 치는 법은 단계가 정한다(아무렇게나, 이길 수 있을 때만 잘, 늘 잘).
// 선생님의 수는 (단계, 판 번호, 먼저 치는 쪽, 지금까지 친 수들)로 정해진다. 그래서 나갔다가 돌아와도 같은 수를 친다.
import T from '../content/fingers.json';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, kindOf, nextSeed, rungOf, solutionOf, teacherOf } from '../core/fingers-ladder.js';
import {
  LIMITS,
  SIDES,
  WHY_AFTER,
  checkBoard,
  copyBoard,
  finishedCount,
  isStart,
  lostStreak,
  moveValues,
  otherSide,
  replay,
  seatOutcome,
  slipsOf,
  solve,
  teacherMove,
  whyOpen,
  wrapPlayed,
} from '../core/fingers.js';
import { smallerFingers } from '../core/smaller.js';
import { fill, ordinal } from '../core/text.js';
import { boardCard, drawBoard } from '../ui/fingers-board.js';

const FORMAT = 'fingers';
const MODES = ['game', 'made'];
const ORDERS = ['start', 'given', 'choose'];
/** 선생님이 치기 전에 뜸을 들이는 시간(밀리초, 임시) */
const THINK_MS = 900;
/** 처음 화면과 판 고르기에 그리는 빈 판 */
const BLANK = { limit: 5, wrap: false, kid: [1, 1], teacher: [1, 1], first: 'kid' };
const FIRST_DRAFT = { limit: 5, wrap: false, kid: [1, 1], teacher: [1, 1], first: 'kid' };
/** 연달아 이만큼 지면 자리를 바꿔 보기를 권한다(임시) */
const SWAP_INVITE_AFTER = 2;
const HANDS = [0, 1];

/** 판의 종류: 먼저 칠지 고르는 판, 손가락 하나씩에서 시작하는 판, 손가락이 펴져 있는 판 */
const orderOf = (board) => (board.first === null ? 'choose' : isStart(board) ? 'start' : 'given');

/** 빠지지 않은 손들 */
const liveOf = (hands) => HANDS.filter((index) => hands[index] > 0);

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createFingers(frame) {
  const { $, log } = frame;
  let flash = null; // 판 아래에 잠깐 적는 사실. 다음에 무엇을 누르면 지운다
  let timer = null; // 선생님이 뜸을 들이는 중이면 그 타이머
  let bumpNow = false; // 방금 쳤다: 다음 그림에서 한 번만 맞은 손을 흔든다
  let picked = null; // 내가 칠 손으로 고른 손(0 | 1 | null)
  let preset = null; // 자리를 바꿔서 다시 칠 때, 새 판에 미리 정해 줄 것 { first, rematchOf }
  let draft = null; // 직접 만들기에서 만들던 판

  const count = (value) => Number.isInteger(value) && value >= 0;
  const ready = (round) => round.first !== null;
  const firstOf = (round) => round.first ?? 'kid';
  const ruleOf = (board) => (board.wrap ? 'wrap' : 'basic');

  /** 손을 읽어 주는 이름: 누구의 어느 손이고 손가락이 몇 개인지 */
  const labelOf = (now) => (side, index) => fill(T.handLabel[side][index], { k: now[side][index] });

  /** 판과 친 수들로 그릴 것(보기만 하는 그림) */
  function viewOf(board, trail, first, more = {}) {
    const now = replay(board, trail, first);
    return { kid: now.kid, teacher: now.teacher, last: now.moves.at(-1) ?? null, names: T.names, ...more };
  }

  /** 대본의 그림 하나(why와 판 고르기): 친 수들을 그대로 따라간 모습 */
  const figureView = (item) => viewOf(item.board, item.trail ?? [], item.board.first ?? 'kid', { rings: item.rings ?? [] });

  function clearTimer() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  function forget() {
    flash = null;
    bumpNow = false;
    picked = null;
    clearTimer();
  }

  /** 방금 친 것을 말로: 누가 어느 손으로 어느 손을 쳤는지와, 맞은 손이 어떻게 되었는지 */
  function hitLine(move) {
    const after = move.after === 0 ? T.hit.out : fill(T.hit.now, { k: move.after });
    return `${T.hit[move.side][`${move.from}${move.to}`]} ${after}`;
  }

  // ---- 판 ----
  function statusOf(round, now) {
    if (!ready(round)) return T.status.choose;
    if (now.over) return T.status[now.winner === 'kid' ? 'kid-won' : now.winner === 'teacher' ? 'teacher-won' : 'repeat'];
    // 방금 친 것을 적는다(판 아래는 좁아서, 맞은 손이 어떻게 되었는지는 판의 그림으로 본다).
    const last = now.moves.at(-1);
    const hit = last ? T.hit[last.side][`${last.from}${last.to}`] : null;
    if (now.next !== 'kid') return hit ?? T.status['teacher-turn'];
    if (picked !== null) return T.status['pick-theirs'];
    if (last?.side === 'teacher') return hit;
    return T.status[liveOf(now.kid).length === 1 ? 'pick-theirs' : 'pick-mine'];
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
    if (!mine) picked = null;
    const aiming = mine && (picked !== null || liveOf(now.kid).length === 1);

    drawBoard($('fingers-board'), {
      ...viewOf(board, trail, first),
      picked,
      bump: bumpNow,
      tap: mine ? { kid: liveOf(now.kid), teacher: aiming ? liveOf(now.teacher) : [] } : {},
      label: labelOf(now),
      onHand: mine ? tapHand : undefined,
    });
    bumpNow = false;
    $('fingers-status').textContent = flash ?? statusOf(round, now);
    $('fingers-taps').textContent = String(now.moves.length);

    // 오른쪽 칸: 빠지는 수와 규칙 → 먼저 칠지 → 차례
    $('fingers-limit-line').textContent = fill(T.limitLine[ruleOf(board)], { n: board.limit });
    $('fingers-order').hidden = !(playing && round.first === null);
    $('fingers-first-line').hidden = round.first === null;
    if (round.first !== null) $('fingers-first-line').textContent = T.firsts[round.order === 'given' ? 'given' : round.first];
    $('fingers-turn-box').hidden = !live;
    if (live) $('fingers-turn').textContent = T.turn[mine ? 'kid' : 'teacher'];

    // 끝난 뒤 고르기에 게임만의 것 둘을 더한다. 진 판 뒤에는 "자리를 바꿔서 다시 치기"를 맨 위에 둔다.
    // 작은 판을 끝낸 뒤에는 틀의 두 단추(원래 판으로 돌아가기, 작은 판 하나 더)만 나온다.
    const done = round.done && !round.side;
    const lost = done && round.winner === 'teacher';
    $('fingers-swap').hidden = !(done && ready(round));
    $('fingers-replay').hidden = !(done && round.trail.length > 0);
    $('fingers-swap').classList.toggle('primary', lost);
    if (done) {
      $(lost ? 'after-same' : 'after-make').before($('fingers-swap'), $('fingers-replay'));
      // 어느 자리가 이기는 자리인지는 자리를 바꿔 해 보며 알아낸다. 게임이 끝난 뒤에는 풀이 단추를 두지 않는다.
      $('after-solution').hidden = true;
    }
    frame.showWhy();
    wait();
  }

  /** 선생님 차례면 잠깐 뜸을 들인 뒤에 치게 한다. 그사이 판이 바뀌었으면 치지 않는다. */
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
      const move = teacherMove(round.board, round.trail, { level: numbered ? round.level : null, seed: numbered ? round.seed : null, first, teacher: teacherOf(round.level, round.custom) });
      if (move !== null) play('teacher', move);
    }, THINK_MS);
  }

  /** 한 번 친다. 차례가 아닌 쪽의 수와 칠 수 없는 수는 치지 않는다. */
  function play(who, move) {
    const { round } = frame;
    if (!ready(round) || round.done) return;
    const first = firstOf(round);
    const before = replay(round.board, round.trail, first);
    if (before.over || before.next !== who) return;
    const after = replay(round.board, [...round.trail, move], first);
    if (!after.ok) return;
    round.trail = [...round.trail, move];
    flash = null;
    picked = null;
    bumpNow = true;
    const hit = after.moves.at(-1);
    frame.note('move', { by: who, from: move[0], to: move[1], power: hit.power, after: hit.after, turn: round.trail.length });
    if (after.over) {
      // 두 손이 다 빠졌거나 같은 모습이 다시 나왔다. 이긴 판도 진 판도 비긴 판도 "끝까지 둔 판"으로 끝낸다.
      round.winner = after.winner;
      round.repeat = after.repeat;
      frame.note('over', { winner: round.winner, repeat: after.repeat, kid: after.kid, teacher: after.teacher });
      frame.finish('solved');
      return;
    }
    // 선생님이 친 것은 판 아래에만 적는다(말로 하면 판을 시작할 때의 규칙 말을 덮고, 판마다 여러 번 되풀이된다).
    draw();
    frame.persist();
  }

  /** 칠 수 없는 손을 눌렀다: 까닭을 판 아래에 적는다(치지 않는다) */
  function refuse(why, side, index) {
    const { round } = frame;
    round.refuseCount += 1;
    frame.note('refuse', { side, hand: index, why });
    flash = T.status[why];
    draw();
    frame.persist();
  }

  /** 아이가 손을 눌렀다: 내 손이면 칠 손으로 고르고(다시 누르면 놓는다), 선생님 손이면 고른 손으로 친다. */
  function tapHand(side, index) {
    const { round } = frame;
    if (round.done || !ready(round)) return;
    const now = replay(round.board, round.trail, firstOf(round));
    if (now.over || now.next !== 'kid') return;
    if (side === 'kid') {
      if (now.kid[index] === 0) {
        refuse('mine-out', side, index);
        return;
      }
      picked = picked === index ? null : index;
      flash = null;
      draw();
      return;
    }
    if (now.teacher[index] === 0) {
      refuse('theirs-out', side, index);
      return;
    }
    let from = picked;
    if (from === null) {
      const lives = liveOf(now.kid);
      // 내 손이 하나만 남았으면 고르지 않아도 그 손으로 친다.
      if (lives.length !== 1) {
        flash = T.status['mine-first'];
        draw();
        return;
      }
      from = lives[0];
    }
    play('kid', [from, index]);
  }

  /** "먼저 칠래요" / "나중에 칠래요". 이 고르기가 이 판의 답이다. */
  function chooseOrder(order) {
    const { round, solution } = frame;
    if (!round || round.done || round.first !== null) return;
    round.first = order === 'first' ? 'kid' : 'teacher';
    // correct: 잘 치면 지지 않는 자리를 골랐는가. 화면에서는 알리지 않는다(해 보면 알게 된다).
    const seat = seatOutcome(solution, round.first);
    const correct = seat === null ? null : seat !== 'lose';
    round.answers.push({ t: frame.stamp(), answer: order, correct });
    frame.note('pick-order', { order, correct });
    draw();
    frame.persist();
    frame.say(T.play[`order-${order}`]);
  }

  // ---- 끝난 뒤: 자리를 바꿔서 다시 치기, 방금 판 다시 보기 ----

  /** 자리를 바꾼 판: 내 손과 선생님 손을 바꾸고, 먼저 치는 쪽도 바꾼다 */
  const swapped = (board, first) => ({ limit: board.limit, wrap: board.wrap, kid: [...board.teacher], teacher: [...board.kid], first: board.first === null ? null : otherSide(first) });

  function rematch() {
    const { round } = frame;
    if (!round || !round.done || !ready(round)) return;
    // 선생님이 서 있던 자리에 선다: 두 사람의 손과 먼저 치는 쪽을 바꾼다.
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

  /** 방금 친 수들을 한 번씩 넘겨 본다. 누가 어느 손으로 어느 손을 쳤는지를 그림과 말로 보인다. */
  function replayPages(round) {
    const first = firstOf(round);
    const total = round.trail.length;
    const moves = replay(round.board, round.trail, first).moves;
    return Array.from({ length: total + 1 }, (_, turns) => {
      const trail = round.trail.slice(0, turns);
      const move = turns === 0 ? null : moves[turns - 1];
      const parts = [turns === 0 ? T.replay.start : `${fill(T.replay.turn, { no: ordinal(turns) })} ${hitLine(move)}`];
      if (turns === total && round.winner !== null) {
        if (round.winner === 'draw') parts.push(round.repeat === 0 ? T.replay['repeat-start'] : fill(T.replay.repeat, { no: ordinal(round.repeat) }));
        else parts.push(T.replay.last);
      }
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

  /** 끝났을 때 하는 말: 누구의 두 손이 다 빠졌는지(같은 모습이 다시 나왔는지)와 누가 이겼는지를 사실로 말한다. */
  function rightLine(round, solution) {
    const parts = [T.right[round.winner]];
    // 작은 판을 끝냈을 때는 덧붙이지 않는다(끝난 뒤에 고를 것이 다르다).
    if (round.side) return parts;
    const records = frame.records();
    const seat = seatOutcome(solution, round.first);
    const could = seat !== null && ((seat === 'win' && round.winner !== 'kid') || (seat === 'draw' && round.winner === 'teacher'));
    // 덧붙이는 말은 하나만 한다(한 번에 한 가지만 말한다).
    // 이 판으로 "왜 그럴까?"가 열렸으면 알려 준다.
    if (finishedCount(records) === WHY_AFTER) parts.push(T.right['why-invite']);
    // 아이의 자리가 끝까지 잘 치면 이기는(또는 지지 않는) 자리였으면 그 사실을 말한다.
    else if (could) parts.push(T.right[`could-${seat}`]);
    // 연달아 졌으면 자리를 바꿔 볼 수 있다고 알려 준다. 몇 번 졌는지는 말하지 않는다.
    else if (round.winner === 'teacher' && lostStreak(records) >= SWAP_INVITE_AFTER) parts.push(T.right['swap-invite']);
    return parts;
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----

  /**
   * "왜 그럴까?": 선생님이 어떻게 알아챘는지의 이야기. 게임을 두 판 끝까지 둔 뒤에 열린다(임시).
   * 다시 도는 판의 두 장(마지막 장에서 "5로 나눈 나머지"라는 이름을 붙인다)은 다시 도는 판을 끝까지 둔 뒤에만 나온다.
   */
  function whyPages() {
    const records = frame.records();
    if (!whyOpen(records)) return null;
    const wrap = wrapPlayed(records);
    return T.why
      .filter((slide) => !slide.wrap || wrap)
      .map((slide) => ({
        say: slide.say,
        // 그림은 종이를 펼칠 때 그린다(단추를 보일지 따질 때마다 그리지 않는다).
        get nodes() {
          return [rowOf(slide.figures.map((item) => boardCard(figureView(item), item.note, { big: slide.figures.length === 1 })))];
        },
      }));
  }

  /** 먼저 치는 쪽부터 둘 다 잘 치면 어떻게 끝나는지의 말(아이 쪽에서 본 끝과 치는 횟수) */
  function endLine(first, outcome, taps) {
    const parts = [T.solution[`${first}-${outcome}`]];
    if (Number.isInteger(taps)) parts.push(fill(T.solution.taps, { k: taps }));
    return parts.join(' ');
  }

  /** 가장 좋은 첫 수: 먼저 치는 쪽이 칠 손과 맞을 손에 고리를 두른다 */
  function bestRings(board, first) {
    const values = moveValues({ ...board, first }, [], first) ?? [];
    const worth = { win: 2, draw: 1, lose: 0 };
    const top = Math.max(...values.map((item) => worth[item.outcome]));
    const best = values.filter((item) => worth[item.outcome] === top);
    const pick = top === 2 ? best.sort((a, b) => a.plies - b.plies)[0] : top === 0 ? best.sort((a, b) => b.plies - a.plies)[0] : best[0];
    if (!pick) return [];
    return [
      { side: first, index: pick.move[0] },
      { side: otherSide(first), index: pick.move[1] },
    ];
  }

  /** 풀이: 먼저 치는 쪽마다 둘 다 잘 치면 어떻게 끝나는지와 가장 좋은 첫 수 */
  function solutionPages(round, solution) {
    const { board } = round;
    const firsts = round.order === 'given' ? [board.first] : round.first ? [round.first, otherSide(round.first)] : SIDES;
    return firsts.map((first) => {
      const outcome = solution[first];
      return {
        say: endLine(first, outcome, solution.taps[first]),
        get nodes() {
          const note = outcome === 'draw' ? T.solution['note-draw'] : T.solution[`note-${first}`];
          return [rowOf([boardCard(viewOf(board, [], first, { rings: outcome === 'draw' ? [] : bestRings(board, first) }), note, { big: true })])];
        },
      };
    });
  }

  // ---- 직접 만들기: 빠지는 수와 규칙을 정하고, 손을 눌러 손가락을 펴고, 먼저 칠 쪽을 고른다. ----
  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    // 빠진 손만 있는 판도 만들던 판으로는 그대로 읽는다(다 만들기 전일 수 있다)
    const ok = saved && Number.isInteger(saved.limit) && saved.limit >= LIMITS.min && saved.limit <= LIMITS.max && typeof saved.wrap === 'boolean' && SIDES.includes(saved.first) && SIDES.every((side) => Array.isArray(saved[side]) && saved[side].length === 2 && saved[side].every((value) => Number.isInteger(value) && value >= 0 && value < saved.limit));
    return copyBoard(ok ? saved : FIRST_DRAFT);
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    $('fingers-make-result').textContent = '';
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  /** 만드는 판의 모습: 쓸 수 있는 판이면 null, 아니면 고칠 것 하나 */
  function draftProblem(board) {
    return checkBoard(board) === null ? null : T.make.check.out;
  }

  function drawMake() {
    $('fingers-make-limit').textContent = fill(T.make.limit, { n: draft.limit });
    $('fingers-make-limit-fewer').disabled = draft.limit <= LIMITS.min;
    $('fingers-make-limit-more').disabled = draft.limit >= LIMITS.max;
    for (const rule of ['basic', 'wrap']) $(`fingers-make-rule-${rule}`).setAttribute('aria-pressed', String(ruleOf(draft) === rule));
    for (const side of SIDES) $(`fingers-make-first-${side}`).setAttribute('aria-pressed', String(draft.first === side));
    $('fingers-make-placing').textContent = draftProblem(draft) ?? T.make.placing;
    drawBoard($('fingers-make-board'), { kid: draft.kid, teacher: draft.teacher, names: T.names, tap: { kid: HANDS, teacher: HANDS }, label: labelOf(draft), onHand: placeAt });
  }

  function changeDraft(next) {
    draft = next;
    // 선생님이 앞의 판에 한 대답이 남아 있으면, 판이 바뀌었다는 짧은 말로 덮는다(바뀐 판의 대답이 아니다).
    if ($('fingers-make-result').textContent !== '') frame.talkers.make.say(T.make.changed);
    $('fingers-make-result').textContent = '';
    log.saveDraft(draft, FORMAT);
    drawMake();
  }

  /** 손을 눌렀다: 손가락을 하나 더 편다. 다 펴면 다시 주먹(빠진 손)이 된다 */
  function placeAt(side, index) {
    const next = copyBoard(draft);
    next[side][index] = (draft[side][index] + 1) % draft.limit;
    changeDraft(next);
  }

  /** 빠지는 수를 바꾼다. 펼 수 있는 것보다 많이 편 손은 펼 수 있는 만큼만 남긴다 */
  function changeLimit(limit) {
    const clip = (hands) => hands.map((value) => Math.min(value, limit - 1));
    changeDraft({ ...copyBoard(draft), limit, kid: clip(draft.kid), teacher: clip(draft.teacher) });
  }

  /** 아이가 만든 판을 풀이 프로그램으로 풀어서, 둘 다 잘 치면 어떻게 끝나는지 알려 준다. */
  function solveDraft() {
    const problem = draftProblem(draft);
    if (problem !== null) {
      $('fingers-make-result').textContent = problem;
      frame.talkers.make.say(problem);
      return;
    }
    const board = copyBoard(draft);
    const result = solve(board);
    const line = endLine(board.first, result.value, result.taps[board.first]);
    $('fingers-make-result').textContent = line;
    const now = new Date().toISOString();
    log.saveRecord({
      kind: 'made',
      v: 1,
      id: log.newId('m'),
      format: FORMAT,
      startedAt: now,
      endedAt: now,
      board,
      solution: { possible: true, kid: result.kid, teacher: result.teacher, taps: result.taps, value: result.value },
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
      $('fingers-make-result').textContent = problem;
      frame.talkers.make.say(problem);
      return;
    }
    frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board });
  }

  // ---- 단추 잇기 ----
  $('fingers-first').addEventListener('click', () => chooseOrder('first'));
  $('fingers-second').addEventListener('click', () => chooseOrder('second'));
  $('fingers-swap').addEventListener('click', rematch);
  $('fingers-replay').addEventListener('click', openReplay);
  $('fingers-make-limit-fewer').addEventListener('click', () => changeLimit(draft.limit - 1));
  $('fingers-make-limit-more').addEventListener('click', () => changeLimit(draft.limit + 1));
  for (const rule of ['basic', 'wrap']) $(`fingers-make-rule-${rule}`).addEventListener('click', () => changeDraft({ ...copyBoard(draft), wrap: rule === 'wrap' }));
  for (const side of SIDES) $(`fingers-make-first-${side}`).addEventListener('click', () => changeDraft({ ...copyBoard(draft), first: side }));
  $('fingers-make-solve').addEventListener('click', solveDraft);
  $('fingers-make-play').addEventListener('click', playDraft);

  return {
    id: FORMAT,
    T,
    padId: 'fingers-pad',
    makeId: 'make-fingers',
    homeIds: { sample: 'home-fingers-sample', blank: 'home-fingers-blank', ask: 'home-fingers-ask', play: 'home-fingers-play', pick: 'home-fingers-pick', make: 'home-fingers-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },
    // 판이 위아래로 길어서(선생님 손 위, 내 손 아래) 규칙 글은 왼쪽 칸 맨 위에 둔다.
    ruleAside: true,

    /** 새 판에서 이 형식이 맡는 값 */
    begin({ custom, board }) {
      const start = preset;
      preset = null;
      const first = start !== null ? start.first : board.first;
      return {
        mode: custom ? 'made' : 'game',
        order: orderOf(board), // 'start'(손가락 하나씩에서) | 'given'(손가락이 펴진 판) | 'choose'(먼저 칠지 고른다)
        board: copyBoard(board), // 판: 빠지는 수, 규칙, 두 사람의 손, 판이 정한 먼저 치는 쪽
        first, // 먼저 치는 쪽('kid' | 'teacher'). 아직 고르지 않았으면 null
        chose: start === null && first === null, // 아이가 먼저 칠지 고르는 판인가
        assigned: start === null && first !== null, // 판이 아이의 차례를 정해 준 판인가
        trail: [], // 친 수들([친 손, 맞은 손]. 먼저 치는 쪽부터 번갈아)
        winner: null, // 'kid' | 'teacher' | 'draw'. 끝나지 않았으면 null
        repeat: null, // 같은 모습이 다시 나와 비겼으면 그 모습이 처음 나온 때(친 횟수)
        rematch: start !== null, // 자리를 바꿔서 다시 치는 판인가
        rematchOf: start?.rematchOf ?? null, // 그렇다면 바로 앞 판의 번호
        replayCount: 0, // "방금 판 다시 보기"를 연 수
        refuseCount: 0, // 칠 수 없는 손을 누른 수
      };
    },
    solve: (round) => solutionOf(round.board),
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (!MODES.includes(saved.mode) || !ORDERS.includes(saved.order) || checkBoard(saved.board) !== null) return false;
      if (!(saved.first === null || SIDES.includes(saved.first))) return false;
      if (!Array.isArray(saved.trail)) return false;
      // 차례를 정하기 전에는 친 수가 없다. 끝난 게임은 하던 판이 아니다.
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
      $('fingers-board').hidden = !on;
      $('fingers-count').hidden = !on;
      if (on) {
        $('undo').hidden = true;
        $('reset').hidden = true;
      } else {
        $('fingers-swap').hidden = true;
        $('fingers-replay').hidden = true;
      }
    },
    enter: forget,
    draw,
    ended() {
      // 끝난 바로 그 그림에서 맞은 손을 한 번 흔든다. 그 밖의 것은 잊는다.
      flash = null;
      picked = null;
      clearTimer();
    },
    ruleLine: (round) => fill(T.rules[ruleOf(round.board)], { n: round.board.limit }),
    hints: (round) => T.hints[round.custom ? 'made' : rungOf(round.level).hint],
    touched: (round) => round.trail.length > 0 || round.answers.length > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view(round) {
      const now = replay(round.board, ready(round) ? round.trail : [], firstOf(round));
      return { first: round.first, turns: round.trail.length, kid: now.kid, teacher: now.teacher, picked };
    },
    /** 이 판보다 작은 판: 손가락 하나씩에서 시작하는 판은 빠지는 수가 적은 판, 몇 번만 남은 판은 더 적게 남은 판 */
    smaller: (round, turn) => smallerFingers({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      const chosen = ready(round);
      const first = firstOf(round);
      const now = replay(round.board, chosen ? round.trail : [], first);
      const moves = now.moves.map((move) => ({ by: move.side, from: move.from, to: move.to, power: move.power, after: move.after }));
      const seat = chosen ? seatOutcome(solution, first) : null;
      return {
        mode: round.mode,
        order: round.order,
        // 판의 종류(고르는 판, 손가락 하나씩에서 누가 먼저, 펴진 판에서 누구 차례). 기록의 kind와 섞이지 않게 이름을 따로 둔다
        boardKind: kindOf(round.board),
        board: copyBoard(round.board),
        // 아이가 먼저 칠 때와 선생님이 먼저 칠 때 둘 다 잘 치면 아이는 어떻게 되는가와 그때 치는 횟수
        solution: { possible: true, kid: solution.kid, teacher: solution.teacher, taps: solution.taps },
        first: round.first,
        chose: round.chose,
        assigned: round.assigned,
        teacher: teacherOf(round.level, round.custom),
        // 아이의 자리가 잘 치면 어떻게 끝나는 자리였는가('win' | 'draw' | 'lose'), 지지 않는 자리였는가
        seat,
        choseWinner: seat === null ? null : seat !== 'lose',
        // 친 수의 차례(누가, 어느 손으로, 어느 손을, 몇 개로 쳐서 맞은 손이 몇이 되었는지)
        moves,
        moveCount: moves.filter((move) => move.by === 'kid').length,
        turnCount: moves.length,
        winner: round.winner,
        repeat: round.repeat,
        // 아이가 잘 치면 갈 수 있던 끝보다 나쁜 자리로 보낸 수(몇 번째 수인지)
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
      drawBoard(root, { kid: board.kid, teacher: board.teacher, small: true });
    },
    drawBlank(root) {
      drawBoard(root, { kid: BLANK.kid, teacher: BLANK.teacher, small: true });
    },
    drawResume(root, saved) {
      const chosen = saved.first !== null;
      drawBoard(root, { ...viewOf(saved.board, chosen ? saved.trail : [], saved.first ?? 'kid'), names: null, small: true });
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 판 하나 */
    drawLevelPicture(root, entry) {
      const picture = entry.picture;
      if (picture.blank) drawBoard(root, { kid: BLANK.kid, teacher: BLANK.teacher, small: true });
      else drawBoard(root, { ...figureView(picture), names: null, small: true });
    },
    showMake,
    /** 직접 만들기에서 다 만든 판(공책에 남기기가 쓴다). 쓸 수 없는 판이면 null */
    madeBoard,
  };
}
