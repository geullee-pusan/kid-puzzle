// 민들레와 바람: 판 화면에서 이 형식이 맡는 부분(판, 꽃이 될지 바람이 될지 고르기, 선생님이 두는 차례, 혼자 덮기, 끝났을 때 하는 말, 다시 보기와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/dandelion.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 판의 종류(mode)는 둘이다.
//   game   선생님과 번갈아 둔다(1~4단계, 직접 만든 판). 꽃 쪽이 먼저 빈칸에 꽃을 심고, 바람 쪽이 아직 안 분 방향으로 분다.
//          아이가 서는 쪽(role)은 단계가 정하거나(1단계 꽃, 2단계 바람) 두기 전에 아이가 고른다(3, 4단계와 직접 만든 판).
//          판이 끝나면 누가 이겼는지를 사실로만 말한다. 몇 번 이기고 졌는지는 세어 보여 주지 않는다.
//          선생님은 자기 차례에 잠깐 뜸을 들이고 둔다. 이길 수 있는 자리에서는 이기는 수를 둔다(풀이 프로그램).
//          선생님의 수는 (단계, 판 번호, 아이가 선 쪽, 지금까지 둔 수들)로 정해진다. 그래서 나갔다가 돌아와도 같은 수를 둔다.
//          끝난 뒤에 "자리를 바꿔서 다시 두기"와 "방금 판 다시 보기"를 고를 수 있다(누가 이길까와 같다).
//   cover  혼자 덮기(5단계). 바람이 정해진 차례로 분다. 바람 앞마다 꽃을 하나까지 심고 "바람 불기"를 누른다.
//          판이 다 덮이면 심은 꽃의 수를 사실로 말한다. 가장 적은 수면 판이 끝나고, 아니면 "더 적게 심을 수 있을까요?"라고 묻는다.
//          판은 그대로 두므로 무르거나 처음부터 다시 해도 되고, "여기까지 할래요"로 끝내도 된다(조각 못 들어가게 막기와 같은 틀).
import T from '../content/dandelion.json';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf, solutionOf } from '../core/dandelion-ladder.js';
import { DIR_SETS, LIMITS, checkBoard, copyBoard, finishedCount, lostStreak, otherSide, planTrail, replay, slipsOf, solve, teacherMove, whoPlays, whyOpen, WHY_AFTER } from '../core/dandelion.js';
import { smallerDandelion } from '../core/smaller.js';
import { fill, ordinal } from '../core/text.js';
import { drawField, drawOrder, fieldCard, fieldTable } from '../ui/dandelion-board.js';

const FORMAT = 'dandelion';
const MODES = ['game', 'cover'];
const ROLES = ['flower', 'wind'];
/** 선생님이 두기 전에 뜸을 들이는 시간(밀리초, 임시) */
const THINK_MS = 900;
/** 처음 화면과 판 고르기에 그리는 빈 판 */
const BLANK = { kind: 'game', w: 3, h: 3, dirs: 4 };
const FIRST_DRAFT = { w: 4, h: 4, dirs: 4 };
/** 연달아 이만큼 지면 자리를 바꿔 보기를 권한다(임시) */
const SWAP_INVITE_AFTER = 2;
/** 기록에 남기는 "다 덮을 때마다의 꽃 수"의 수의 위 끝 */
const MAX_TRIES = 40;

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createDandelion(frame) {
  const { $, log } = frame;
  let flash = null; // 판 아래에 잠깐 적는 사실. 다음에 무엇을 누르면 지운다
  let timer = null; // 선생님이 뜸을 들이는 중이면 그 타이머
  let preset = null; // 자리를 바꿔서 다시 둘 때, 새 판에 미리 정해 줄 것 { role, rematchOf }
  let draft = null; // 직접 만들기에서 만들던 판

  const count = (value) => Number.isInteger(value) && value >= 0;
  const labelOf = (board) => (cell) => fill(T.cellLabel, { no: ordinal(Math.floor(cell / board.w) + 1), n: ordinal((cell % board.w) + 1) });

  /** 판과 둔 수들로 그릴 것을 만든다 */
  function viewOf(board, trail) {
    const now = replay(board, trail);
    return { board, flowers: now.flowers, seeds: now.seeds, fresh: now.fresh };
  }

  /** 처음 화면과 판 고르기의 보기 그림: 가운데 칸에 꽃 하나, 첫 바람(게임은 오른쪽)이 분 모습 */
  function sampleTrail(board) {
    const cell = Math.floor(board.h / 2) * board.w + Math.floor(board.w / 2);
    return [{ plant: cell }, { wind: board.kind === 'cover' ? board.order[0] : 1 }];
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
    if (round.mode === 'cover') {
      if (now.over) return now.winner === 'flower' ? T.status['cover-done'] : fill(T.status['cover-short'], { n: now.empty });
      return now.planted ? T.status['cover-planted'] : T.status['cover-plant'];
    }
    if (round.role === null) return '';
    if (now.over) return now.winner === 'flower' ? T.status['over-flower'] : fill(T.status['over-wind'], { n: now.empty });
    if (whoPlays(round.role, now.next) === 'teacher') return T.status['teacher-turn'];
    const last = round.trail.at(-1);
    // 방금 선생님이 둔 수가 있으면 그것을 적는다.
    if (last && whoPlays(round.role, otherSide(now.next)) === 'teacher') return 'plant' in last ? T.status['teacher-plant'] : fill(T.status['teacher-wind'], { face: T.ways[last.wind] });
    return T.status[now.next === 'flower' ? 'kid-plant' : 'kid-wind'];
  }

  function draw() {
    const { round } = frame;
    const { board } = round;
    const now = replay(board, round.trail);
    const playing = !round.done;
    const game = round.mode === 'game';
    const chosen = game && round.role !== null;
    const live = game && chosen && !now.over && playing;
    const mine = live && whoPlays(round.role, now.next) === 'kid';
    const canPlant = (mine && now.next === 'flower') || (!game && playing && !now.over);

    drawField($('dandelion-board'), { ...viewOf(board, round.trail), label: labelOf(board), onCell: canPlant ? tapCell : undefined });
    $('dandelion-status').textContent = flash ?? statusOf(round, now);
    $('dandelion-flowers').textContent = String(now.flowers.length);
    $('dandelion-empty').textContent = String(now.empty);

    // 오른쪽 칸: 게임은 고르기 → 차례와 바람 단추, 혼자 덮기는 바람의 차례와 "바람 불기"
    $('dandelion-choose').hidden = !(game && !chosen && playing);
    $('dandelion-role').hidden = !chosen;
    if (chosen) $('dandelion-role').textContent = T.roles[round.role];
    $('dandelion-turn-box').hidden = !game || !chosen;
    if (game) {
      $('dandelion-turn').hidden = !live;
      $('dandelion-turn').textContent = live ? T.turn[mine ? 'kid' : 'teacher'] : '';
      $('dandelion-plant-note').hidden = !(mine && now.next === 'flower');
      $('dandelion-wind-note').hidden = !(mine && now.next === 'wind');
      const dirs = DIR_SETS[board.dirs];
      for (const button of $('dandelion-winds').querySelectorAll('button')) {
        const dir = Number(button.dataset.dir);
        button.hidden = !dirs.includes(dir);
        const used = now.used.includes(dir);
        button.classList.toggle('used', used);
        button.disabled = !(mine && now.next === 'wind') || used;
      }
    }
    $('dandelion-cover').hidden = game;
    if (!game) {
      drawOrder($('dandelion-order'), { order: board.order, used: now.used.length, arrows: T.arrows, label: (dir, state) => fill(T.orderLabel[state], { face: T.ways[dir] }) });
      $('dandelion-blow').disabled = !playing || now.over;
      $('dandelion-best-line').hidden = round.best === null;
      $('dandelion-best').textContent = round.best === null ? '' : String(round.best);
      $('dandelion-again').hidden = !(playing && now.over && round.trail.length > 0);
      $('dandelion-stop').hidden = !(playing && round.best !== null);
      $('undo').disabled = !playing || round.trail.length === 0;
      $('reset').disabled = !playing || round.trail.length === 0;
    }

    // 끝난 뒤 고르기에 게임만의 것 둘을 더한다. 진 판 뒤에는 "자리를 바꿔서 다시 두기"를 맨 위에 둔다.
    // 작은 판을 끝낸 뒤에는 틀의 두 단추(원래 판으로 돌아가기, 작은 판 하나 더)만 나온다.
    const done = round.done && !round.side && game;
    const lost = done && round.winner === 'teacher';
    $('dandelion-swap').hidden = !(done && round.role !== null);
    $('dandelion-replay').hidden = !(done && round.trail.length > 0);
    $('dandelion-swap').classList.toggle('primary', lost);
    if (done) {
      $(lost ? 'after-same' : 'after-make').before($('dandelion-swap'), $('dandelion-replay'));
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
    if (!round || round.done || round.mode !== 'game' || round.role === null) return;
    const now = replay(round.board, round.trail);
    if (now.over || whoPlays(round.role, now.next) !== 'teacher') return;
    const turns = round.trail.length;
    timer = setTimeout(() => {
      timer = null;
      if (frame.round !== round || round.trail.length !== turns || round.done) return;
      // 직접 만든 판과 작은 판에는 판 번호가 없다.
      const numbered = !round.custom && !round.side;
      const move = teacherMove(round.board, round.trail, { level: numbered ? round.level : null, seed: numbered ? round.seed : null, role: round.role });
      if (move) play('teacher', move);
    }, THINK_MS);
  }

  /** 게임에서 수 하나를 둔다. 차례가 아닌 쪽의 수와 둘 수 없는 수는 두지 않는다. */
  function play(who, move) {
    const { round } = frame;
    if (round.mode !== 'game' || round.role === null || round.done) return;
    const before = replay(round.board, round.trail);
    if (before.over || whoPlays(round.role, before.next) !== who) return;
    const after = replay(round.board, [...round.trail, move]);
    if (!after.ok) return;
    round.trail = [...round.trail, move];
    flash = null;
    frame.note('move', { by: who, turn: round.trail.length, ...move });
    if (after.over) {
      // 판이 다 덮였거나 방향을 다 썼다. 이긴 판도 진 판도 "끝까지 둔 판"으로 끝낸다.
      round.winner = whoPlays(round.role, after.winner);
      round.left = after.empty;
      frame.note('over', { winner: round.winner, side: after.winner, empty: after.empty });
      frame.finish('solved');
      return;
    }
    draw();
    frame.persist();
    if (who === 'teacher') frame.say('plant' in move ? T.play['teacher-plant'] : fill(T.play['teacher-wind'], { face: T.ways[move.wind] }));
  }

  /** "꽃이 될래요" / "바람이 될래요". 이 고르기가 게임 판의 답이다. */
  function choose(role) {
    const { round, solution } = frame;
    if (!round || round.mode !== 'game' || round.role !== null || round.done) return;
    round.role = role;
    // correct: 잘 두면 이기는 쪽을 골랐는가. 화면에서는 알리지 않는다(두어 보면 알게 된다).
    const correct = role === solution.winner;
    round.answers.push({ t: frame.stamp(), answer: role, correct, guess: null });
    frame.note('pick', { role, correct });
    draw();
    frame.persist();
    frame.say(T.play[`picked-${role}`]);
  }

  /** 빈칸을 눌렀다: 게임에서는 꽃을 심고, 혼자 덮기에서는 바람 앞에 꽃을 하나 심는다. */
  function tapCell(cell) {
    const { round } = frame;
    if (round.done) return;
    if (round.mode === 'game') {
      play('kid', { plant: cell });
      return;
    }
    const now = replay(round.board, round.trail);
    if (now.over) return;
    if (now.planted) {
      // 바람 앞에 꽃은 하나만 심는다. 판 아래에 적고, 선생님은 판마다 한 번만 말한다.
      round.twiceCount += 1;
      frame.note('twice', { cell });
      flash = T.status['one-only'];
      draw();
      if (!round.twiceSaid) {
        round.twiceSaid = true;
        frame.say(T.play['one-only']);
      }
      frame.persist();
      return;
    }
    coverMove({ plant: cell });
  }

  /** 혼자 덮기: "바람 불기" */
  function blow() {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'cover') return;
    const now = replay(round.board, round.trail);
    if (now.over) return;
    coverMove({ wind: round.board.order[now.used.length] });
  }

  /** 혼자 덮기의 수 하나. 다 덮였으면 꽃의 수를 견주고, 바람이 다 불었는데 빈칸이 남았으면 그 사실을 말한다. */
  function coverMove(move) {
    const { round } = frame;
    const after = replay(round.board, [...round.trail, move]);
    if (!after.ok) return;
    round.trail = [...round.trail, move];
    round.moveCount += 1;
    flash = null;
    frame.note('plant' in move ? 'plant' : 'wind', move);
    if (after.over && after.winner === 'flower') {
      complete(after);
      return;
    }
    draw();
    frame.persist();
    if (after.over) {
      round.shortCount += 1;
      frame.note('short', { empty: after.empty });
      frame.say(fill(T.play['cover-short'], { n: after.empty }));
    }
  }

  /** 판이 다 덮였다: 꽃의 수를 말하고, 가장 적은 수가 아니면 더 적게 심을 수 있을지 묻는다. */
  function complete(after) {
    const { round, solution } = frame;
    const used = after.flowers.length;
    const before = round.best;
    round.completions.push(used);
    round.tries = [...round.tries, { flowers: after.flowers, count: used }].slice(-MAX_TRIES);
    if (before === null || used < before) {
      round.best = used;
      round.bestFlowers = after.flowers.slice();
    }
    const reached = used === solution.best;
    const guess = reached ? null : 'more-than-best';
    round.answers.push({ t: frame.stamp(), answer: `flowers:${used}`, correct: reached, guess });
    frame.note('answer', { answer: `flowers:${used}`, correct: reached, guess });
    if (reached) {
      frame.finish('solved');
      return;
    }
    // 틀렸다고 하지 않는다. 심은 꽃의 수를 말하고 더 적게 심을 수 있을지 묻는다. 판은 그대로 둔다.
    frame.persist();
    draw();
    frame.say(fill(T.play[before !== null && used < before ? 'cover-fewer' : 'cover-more'], { k: used }));
  }

  /** 혼자 덮기의 "여기까지 할래요": 지금까지 가장 적게 심은 것으로 판을 끝낸다. 이것도 끝까지 한 판이다. */
  function stop() {
    const { round } = frame;
    if (round.done || round.mode !== 'cover' || round.best === null) return;
    round.stopped = true;
    frame.note('stop', { best: round.best });
    frame.finish('solved');
  }

  function undo() {
    const { round } = frame;
    if (round.done || round.mode !== 'cover' || round.trail.length === 0) return;
    round.trail = round.trail.slice(0, -1);
    round.undoCount += 1;
    flash = null;
    frame.note('undo');
    draw();
    frame.persist();
  }

  /** 처음으로 되돌린다. 다 덮은 뒤나 바람이 다 분 뒤였다면 "다시 해 보기"로 적고, 하던 가운데라면 되돌리기로 적는다. */
  function reset() {
    const { round } = frame;
    if (round.done || round.mode !== 'cover' || round.trail.length === 0) return;
    const over = replay(round.board, round.trail).over;
    round.trail = [];
    flash = null;
    if (over) {
      round.retryCount += 1;
      frame.note('again');
    } else {
      round.resetCount += 1;
      frame.note('reset');
    }
    draw();
    frame.persist();
  }

  // ---- 끝난 뒤: 자리를 바꿔서 다시 두기, 방금 판 다시 보기 ----
  function rematch() {
    const { round } = frame;
    if (!round || !round.done || round.mode !== 'game' || round.role === null) return;
    const next = { role: otherSide(round.role), rematchOf: round.id };
    const start = { level: round.level, seed: round.seed, small: round.small, custom: round.custom, board: copyBoard(round.board) };
    frame.chooseAfter('swap', () => {
      preset = next;
      frame.startRound(FORMAT, start);
      frame.say(T.play[`rematch-${next.role}`]);
    });
  }

  function rowOf(cards, more = '') {
    const row = document.createElement('div');
    row.className = more ? `figure-row ${more}` : 'figure-row';
    row.append(...cards);
    return row;
  }

  /** 수 하나를 말로: 누가(kid | teacher) 무엇을 두었는가 */
  function moveText(who, move, no) {
    return 'plant' in move ? fill(T.replay[`${who}-plant`], { no }) : fill(T.replay[`${who}-wind`], { no, face: T.ways[move.wind] });
  }

  /** 방금 둔 수들을 한 수씩 넘겨 본다. 누가 무엇을 두었는지를 그림과 말로 보인다. */
  function replayPages(round) {
    const total = round.trail.length;
    return Array.from({ length: total + 1 }, (_, turns) => {
      const trail = round.trail.slice(0, turns);
      const side = turns === 0 ? null : turns % 2 === 1 ? 'flower' : 'wind';
      const who = side === null ? null : whoPlays(round.role, side);
      const parts = [turns === 0 ? T.replay[`start-${round.role}`] : moveText(who, trail.at(-1), ordinal(turns))];
      if (turns === total && round.winner !== null) parts.push(T.replay.last);
      const note = turns === 0 ? T.replay['note-start'] : T.replay[`note-${who}`];
      return {
        say: parts.join(' '),
        // 그림은 종이를 넘길 때 그린다.
        get nodes() {
          return [rowOf([fieldCard(viewOf(round.board, trail), note, { big: true })])];
        },
      };
    });
  }

  function openReplay() {
    const { round } = frame;
    if (!round || !round.done || round.mode !== 'game' || round.trail.length === 0) return;
    round.replayCount += 1;
    frame.note('replay');
    frame.keep();
    frame.openSheet({ title: T.replay.title, pages: replayPages(round) });
  }

  /** 끝났을 때 하는 말: 게임은 누가 이겼는지, 혼자 덮기는 심은 꽃의 수를 사실로 말한다. */
  function rightLine(round, solution) {
    if (round.mode === 'cover') {
      const retries = Math.max(0, round.completions.length - 1);
      if (round.stopped) return [fill(T.right['cover-stopped'], { k: round.best })];
      return [fill(T.right['cover-best'], { k: solution.best }), retries === 0 ? T.right['cover-first-try'] : fill(T.right['cover-after'], { n: retries })];
    }
    const side = replay(round.board, round.trail).winner;
    const parts = [fill(T.right[`${side}-${round.winner}`], { n: round.left ?? 0 })];
    // 작은 판을 끝냈을 때는 덧붙이지 않는다(끝난 뒤에 고를 것이 다르다).
    if (round.side) return parts;
    const records = frame.records();
    // 덧붙이는 말은 하나만 한다(한 번에 한 가지만 말한다).
    // 이 판으로 "왜 그럴까?"가 열렸으면 알려 준다.
    if (finishedCount(records) === WHY_AFTER) parts.push(T.right['why-invite']);
    // 연달아 졌으면 자리를 바꿔 볼 수 있다고 알려 준다. 몇 번 졌는지는 말하지 않는다.
    else if (round.winner === 'teacher' && lostStreak(records) >= SWAP_INVITE_AFTER) parts.push(T.right['swap-invite']);
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
        const nodes = [];
        if (slide.figures.length > 0) nodes.push(rowOf(slide.figures.map((item) => fieldCard(viewOf(item.board, item.trail), item.note))));
        if (slide.table) {
          const rows = slide.table.map((row) => ({ marked: row.winner === 'wind', cells: [nameOf(row), T.names.dirs[row.dirs], T.sides[row.winner]] }));
          nodes.push(rowOf([fieldTable(T.table.heads, rows)]));
        }
        return nodes;
      },
    }));
  }

  /** 풀이: 게임은 잘 두었을 때 어느 쪽이 이기는지, 혼자 덮기는 가장 적게 심는 한 가지 방법을 그려 보여 준다. */
  function solutionPages(round, solution) {
    const { board } = round;
    if (round.mode === 'game') return [{ say: T.solution[solution.winner], nodes: [rowOf([fieldCard(viewOf(board, []), nameOf(board), { big: true })])] }];
    const trail = planTrail(board, solution.plan);
    const cards = [fieldCard(viewOf(board, []), T.solution.start)];
    trail.forEach((move, index) => {
      // 바람이 분 뒤의 모습만 그린다(심은 꽃은 다음 그림에 함께 보인다). 마지막 수는 늘 그린다.
      if ('wind' in move || index === trail.length - 1) cards.push(fieldCard(viewOf(board, trail.slice(0, index + 1)), fill(T.solution.step, { no: ordinal(index + 1) })));
    });
    // 그림이 여럿이라 작게 그려 한 화면에 들어가게 한다.
    return [{ say: fill(T.solution.cover, { k: solution.best }), nodes: [rowOf(cards, 'dl-strip')] }];
  }

  // ---- 직접 만들기: 가로와 세로의 칸 수, 방향의 수를 정한다. ----
  const draftBoard = () => ({ kind: 'game', w: draft.w, h: draft.h, dirs: draft.dirs });
  const maxOf = (dirs) => (dirs === 8 ? LIMITS.eightMax : LIMITS.max);

  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    const ok = saved && checkBoard({ kind: 'game', w: saved.w, h: saved.h, dirs: saved.dirs }) === null;
    const from = ok ? saved : FIRST_DRAFT;
    return { w: from.w, h: from.h, dirs: from.dirs };
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    $('dandelion-make-result').textContent = '';
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function setStepper(id, value, max) {
    $(id).textContent = fill(T.make.cells, { n: value });
    $(`${id}-fewer`).disabled = value <= LIMITS.min;
    $(`${id}-more`).disabled = value >= max;
  }

  function drawMake() {
    for (const button of $('dandelion-make-dirs').querySelectorAll('button')) button.setAttribute('aria-pressed', String(Number(button.dataset.dirs) === draft.dirs));
    setStepper('dandelion-make-w', draft.w, maxOf(draft.dirs));
    setStepper('dandelion-make-h', draft.h, maxOf(draft.dirs));
    // 여덟 방향은 4칸까지라서, 판이 더 크면 여덟 방향 단추를 끈다.
    $('dandelion-make-eight').disabled = draft.w > LIMITS.eightMax || draft.h > LIMITS.eightMax;
    $('dandelion-make-eight-note').hidden = !$('dandelion-make-eight').disabled;
    const board = draftBoard();
    drawField($('dandelion-make-board'), viewOf(board, sampleTrail(board)));
  }

  function changeDraft(change) {
    const next = { ...draft, ...change };
    if (checkBoard({ kind: 'game', ...next }) !== null) return;
    draft = next;
    $('dandelion-make-result').textContent = '';
    log.saveDraft(draft, FORMAT);
    drawMake();
  }

  /** 아이가 만든 판을 풀이 프로그램으로 풀어서, 잘 두었을 때 어느 쪽이 이기는지 알려 준다. */
  function solveDraft() {
    const board = draftBoard();
    const result = solve(board);
    const line = T.make[result.winner];
    $('dandelion-make-result').textContent = line;
    const now = new Date().toISOString();
    log.saveRecord({
      kind: 'made',
      v: 1,
      id: log.newId('m'),
      format: FORMAT,
      startedAt: now,
      endedAt: now,
      board,
      solution: { possible: true, winner: result.winner, positions: result.positions },
    });
    log.flush();
    frame.talkers.make.say(line);
  }

  /** 다 만든 판(공책에 남기거나 두어 볼 판). 이 형식에서는 정할 수 있는 판이 모두 둘 수 있는 판이다 */
  function madeBoard() {
    const board = draftBoard();
    return checkBoard(board) === null ? board : null;
  }

  function playDraft() {
    const board = madeBoard();
    if (board) frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board });
  }

  // ---- 단추 잇기 ----
  $('dandelion-flower').addEventListener('click', () => choose('flower'));
  $('dandelion-wind').addEventListener('click', () => choose('wind'));
  $('dandelion-winds').addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    play('kid', { wind: Number(button.dataset.dir) });
  });
  $('dandelion-blow').addEventListener('click', blow);
  $('dandelion-again').addEventListener('click', reset);
  $('dandelion-stop').addEventListener('click', stop);
  $('dandelion-swap').addEventListener('click', rematch);
  $('dandelion-replay').addEventListener('click', openReplay);
  $('dandelion-make-dirs').addEventListener('click', (event) => {
    const dirs = Number(event.target.closest('button')?.dataset.dirs);
    if (dirs === 4 || dirs === 8) changeDraft({ dirs });
  });
  $('dandelion-make-w-fewer').addEventListener('click', () => changeDraft({ w: draft.w - 1 }));
  $('dandelion-make-w-more').addEventListener('click', () => changeDraft({ w: draft.w + 1 }));
  $('dandelion-make-h-fewer').addEventListener('click', () => changeDraft({ h: draft.h - 1 }));
  $('dandelion-make-h-more').addEventListener('click', () => changeDraft({ h: draft.h + 1 }));
  $('dandelion-make-solve').addEventListener('click', solveDraft);
  $('dandelion-make-play').addEventListener('click', playDraft);

  return {
    id: FORMAT,
    T,
    padId: 'dandelion-pad',
    makeId: 'make-dandelion',
    homeIds: { sample: 'home-dandelion-sample', blank: 'home-dandelion-blank', ask: 'home-dandelion-ask', play: 'home-dandelion-play', pick: 'home-dandelion-pick', make: 'home-dandelion-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    /** 새 판에서 이 형식이 맡는 값 */
    begin({ level, custom, board }) {
      const start = preset;
      preset = null;
      const rung = custom ? null : rungOf(level);
      const mode = board.kind === 'cover' ? 'cover' : 'game';
      // 아이가 서는 쪽: 자리를 바꿔서 다시 두는 판은 정해져 있고, 1, 2단계는 단계가 정한다. 나머지는 두기 전에 고른다.
      const given = mode === 'game' && rung && ROLES.includes(rung.role) ? rung.role : null;
      const role = mode !== 'game' ? null : start !== null ? start.role : given;
      return {
        mode,
        board: copyBoard(board), // 판: 크기와 방향의 수(혼자 덮기는 바람의 차례도)
        role, // 아이가 선 쪽('flower' | 'wind'). 아직 고르지 않았거나 혼자 덮기면 null
        chose: mode === 'game' && start === null && given === null, // 아이가 쪽을 고르는 판인가
        assigned: mode === 'game' && start === null && given !== null, // 단계가 아이의 쪽을 정해 준 판인가
        trail: [], // 둔 수들. 게임은 꽃과 바람이 번갈아, 혼자 덮기는 심은 꽃과 분 바람의 차례
        winner: null, // 게임에서 이긴 사람('kid' | 'teacher'). 끝나지 않았으면 null
        left: null, // 게임이 끝났을 때의 빈칸 수
        rematch: start !== null, // 자리를 바꿔서 다시 두는 판인가
        rematchOf: start?.rematchOf ?? null, // 그렇다면 바로 앞 판의 번호
        replayCount: 0, // "방금 판 다시 보기"를 연 수
        moveCount: 0, // 혼자 덮기에서 둔 수(무르고 되돌리기 전의 것까지 모두)
        undoCount: 0,
        resetCount: 0, // 하던 가운데 처음으로 되돌린 수
        retryCount: 0, // 다 덮은 뒤나 바람이 다 분 뒤에 처음부터 다시 해 본 수
        shortCount: 0, // 바람이 다 불었는데 빈칸이 남은 수
        twiceCount: 0, // 한 바람 앞에 꽃을 또 심으려 한 수
        twiceSaid: false, // 그 사실을 선생님이 말했는가(한 판에 한 번만 말한다)
        completions: [], // 다 덮을 때마다의 꽃 수
        tries: [], // 다 덮을 때마다의 꽃의 자리와 그 수
        best: null, // 이 판에서 지금까지 가장 적게 심은 꽃 수
        bestFlowers: [], // 그때 꽃의 자리
        stopped: false, // "여기까지 할래요"로 끝냈는가
      };
    },
    solve: (round) => solutionOf(round.board),
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (!MODES.includes(saved.mode) || checkBoard(saved.board) !== null) return false;
      if ((saved.mode === 'cover') !== (saved.board.kind === 'cover')) return false;
      if (saved.role !== null && !ROLES.includes(saved.role)) return false;
      const now = replay(saved.board, saved.trail);
      if (!now.ok) return false;
      // 끝난 게임은 하던 판이 아니다. 쪽을 정하기 전에는 둔 수가 없다.
      if (saved.mode === 'game' && (now.over || (saved.role === null && saved.trail.length > 0))) return false;
      if (![saved.chose, saved.assigned, saved.rematch, saved.twiceSaid, saved.stopped].every((value) => typeof value === 'boolean')) return false;
      if (![saved.replayCount, saved.moveCount, saved.undoCount, saved.resetCount, saved.retryCount, saved.shortCount, saved.twiceCount].every(count)) return false;
      if (![saved.completions, saved.tries, saved.bestFlowers].every(Array.isArray)) return false;
      return saved.winner === null && (saved.best === null || count(saved.best));
    },
    /** 판 화면에서 이 형식의 것(판, 판 아래의 글, 끝난 뒤의 단추 둘)을 보이거나 감춘다. 무르기와 되돌리기는 혼자 덮기에만 있다. */
    showParts(on) {
      $('dandelion-board').hidden = !on;
      $('dandelion-count').hidden = !on;
      if (on) {
        // 앞의 형식이 정해 둔 무르기와 되돌리기를 여기서 다시 정한다(뒤의 주사위 미로는 꺼질 때 이 둘에 손대지 않는다).
        const game = frame.round?.mode !== 'cover';
        $('undo').hidden = game;
        $('reset').hidden = game;
      } else {
        $('dandelion-swap').hidden = true;
        $('dandelion-replay').hidden = true;
      }
    },
    enter: forget,
    draw,
    ended: forget,
    ruleLine: (round) => T.rules[round.mode],
    hints: (round) => T.hints[round.mode === 'cover' ? 'cover' : round.custom ? 'choose' : rungOf(round.level).hint],
    touched: (round) => round.trail.length > 0 || round.moveCount > 0 || (round.chose && round.role !== null),
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view(round) {
      const now = replay(round.board, round.trail);
      return { role: round.role, turns: round.trail.length, flowers: now.flowers, empty: now.empty, used: now.used };
    },
    /** 이 판보다 작은 판: 같은 방향 수의, 칸이 더 적은 판(게임은 이기는 쪽이 같은 판, 혼자 덮기는 덮을 수 있는 판) */
    smaller: (round, turn) => smallerDandelion({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      const now = replay(round.board, round.trail);
      const base = { mode: round.mode, board: copyBoard(round.board), trail: round.trail, flowers: now.flowers, empty: now.empty, used: now.used };
      if (round.mode === 'cover') {
        return {
          ...base,
          // 가장 적은 꽃의 수와 한 가지 방법(처음 바람들 앞에 차례로 심는 칸)
          solution: { possible: true, best: solution.best, plan: solution.plan },
          moveCount: round.moveCount,
          undoCount: round.undoCount,
          resetCount: round.resetCount,
          retryCount: round.retryCount,
          shortCount: round.shortCount,
          twiceCount: round.twiceCount,
          // 다 덮을 때마다의 꽃 수와 자리, 다시 해 본 횟수, 가장 적게 심은 수와 그 자리
          completions: round.completions,
          tries: round.tries,
          retries: Math.max(0, round.completions.length - 1),
          best: round.best,
          bestFlowers: round.bestFlowers,
          // 가장 적은 꽃의 수(풀이 프로그램)에 닿았는가. 수준 맞추기가 본다
          reachedBest: round.best !== null && round.best === solution.best,
          stopped: round.stopped === true,
        };
      }
      const chosen = round.role !== null;
      const moves = round.trail.map((move, index) => ({ by: whoPlays(round.role, index % 2 === 0 ? 'flower' : 'wind'), ...move }));
      return {
        ...base,
        // 잘 두었을 때 이기는 쪽(flower | wind)과 풀이 프로그램이 따져 본 자리의 수
        solution: { possible: true, winner: solution.winner, positions: solution.positions },
        role: round.role,
        chose: round.chose,
        assigned: round.assigned,
        // 아이가 선 쪽이 잘 두면 이기는 쪽이었는가(아직 정하지 않았으면 null)
        choseWinner: chosen ? round.role === solution.winner : null,
        // 둔 수의 차례(누가, 무엇을)
        moves,
        moveCount: moves.filter((move) => move.by === 'kid').length,
        turnCount: moves.length,
        winner: round.winner,
        left: round.left,
        // 아이가 이기는 자리에서 지는 자리로 보낸 수(몇 번째 수인지)
        slips: chosen ? slipsOf(round.board, round.trail, round.role) : [],
        rematch: round.rematch,
        rematchOf: round.rematchOf,
        replayCount: round.replayCount,
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
      drawField(root, { ...viewOf(board, sampleTrail(board)), small: true });
    },
    drawBlank(root) {
      drawField(root, { ...viewOf(BLANK, []), small: true });
    },
    drawResume(root, saved) {
      drawField(root, { ...viewOf(saved.board, saved.trail), small: true });
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 판 하나와 꽃 하나, 바람 한 번 */
    drawLevelPicture(root, entry) {
      const picture = entry.picture;
      if (picture.blank) drawField(root, { ...viewOf(BLANK, []), small: true });
      else drawField(root, { ...viewOf(picture.board, picture.trail), small: true });
    },
    showMake,
    /** 직접 만들기에서 다 만든 판. 아직 풀 수 있는 판이 아니면 null(공책에 남기기가 쓴다) */
    madeBoard,
    /**
     * 가장 좋은 기록(공책에 저절로 남는다). 혼자 덮기에서 한 번도 다 덮지 않았으면 null. 게임에는 없다.
     * 공책은 값이 클수록 좋은 기록으로 보므로, 적게 심을수록 커지게 꽃 수에 마이너스를 붙여 건넨다.
     */
    bestOf: (round) => (round.mode !== 'cover' || round.best === null ? null : { value: -round.best, name: fill(T.notebook.best, { k: round.best }) }),
  };
}
