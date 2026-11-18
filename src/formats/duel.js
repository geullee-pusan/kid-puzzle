// 누가 이길까: 판 화면에서 이 형식이 맡는 부분(판, 먼저 둘지 고르기, 선생님이 두는 차례, 끝났을 때 하는 말, 다시 보기와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/duel.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 선생님(컴퓨터)과 번갈아 둔다. 어느 게임이든 마지막 수를 둔 쪽이 이긴다.
// 판의 종류(mode)는 게임이다.
//   choco  초콜릿 쪼개기(1단계)   one  한 더미(2단계)   two  두 더미(3단계)   three  세 더미(4단계)
// 이 형식의 답은 "먼저 둘래요 / 나중에 둘래요"라는 고르기다. 형식의 맨 첫 판만 고르기 없이 아이가 먼저 둔다.
// 판이 끝나면 누가 마지막 수를 두었는지를 사실로만 말한다. 몇 번 이기고 졌는지는 세어 보여 주지 않는다.
// 선생님은 자기 차례에 잠깐 뜸을 들이고 둔다. 무엇을 두었는지는 판(방금 생긴 조각, 방금 가져간 돌의 자리)과 말로 보인다.
// 선생님의 수는 (단계, 판 번호, 지금까지 둔 수들)로 정해진다. 그래서 나갔다가 돌아와도 같은 수를 둔다.
// 작은 판으로 두어 보는 일은 틀의 "더 작은 판으로"가 맡는다(예전에는 이 형식만의 도구 단추였다).
//   같은 게임의 가장 작은 판을 작은 것부터 차례로 낸다. 작은 판도 판 하나라서 먼저 둘지 고르고 끝까지 둔다.
import T from '../content/duel.json';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, opensFixed, rungOf } from '../core/duel-ladder.js';
import { GAMES, LIMITS, WHY_AFTER, applyMove, checkBoard, copyBoard, finishedCount, gameOf, isOver, isWin, lostStreak, movesOf, otherOf, replay, slipsOf, solve, startState, teacherMove, turnOf, whyOpen } from '../core/duel.js';
import { smallerDuel } from '../core/smaller.js';
import { fill } from '../core/text.js';
import { drawGame, gameCard, marksCard, tableCard } from '../ui/duel-board.js';

const FORMAT = 'duel';
const SIDES = ['kid', 'teacher'];
/** 선생님이 두기 전에 뜸을 들이는 시간(밀리초, 임시) */
const THINK_MS = 900;
/** 처음 화면과 판 고르기에 그리는 빈 판 */
const BLANK = { kind: 'choco', w: 3, h: 2 };
/** 직접 만들기의 처음 값. 게임을 바꿔도 다른 게임에서 정해 둔 수는 그대로 남는다 */
const FIRST_DRAFT = { game: 'choco', w: 3, h: 3, n: 7, max: 2, count: 2, piles: [3, 3, 3] };
const DRAFT_GAMES = ['choco', 'one', 'piles'];
/** 연달아 이만큼 지면 자리를 바꿔 보기를 권한다(임시) */
const SWAP_INVITE_AFTER = 2;

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createDuel(frame) {
  const { $, log } = frame;
  let pick = null; // 골라 둔 돌 { pile, take }
  let flash = null; // 방금 누른 것이 왜 안 되는지. 다음에 무엇을 누르면 지운다
  let timer = null; // 선생님이 뜸을 들이는 중이면 그 타이머
  let preset = null; // 자리를 바꿔서 다시 둘 때, 새 판에 미리 정해 줄 것 { first, rematchOf }
  let draft = null; // 직접 만들기에서 만들던 판

  const kindOf = (board) => (board.kind === 'choco' ? 'choco' : 'stones');
  const count = (value) => Number.isInteger(value) && value >= 0;

  /** 판의 이름: "가로 3칸, 세로 2칸", "돌 7개", "3개와 5개" */
  function nameOf(board) {
    if (board.kind === 'choco') return fill(T.names.choco, { w: board.w, h: board.h });
    if (board.kind === 'one') return fill(T.names.one, { n: board.n });
    const [a, b, c] = board.piles;
    return fill(T.names[gameOf(board)], { a, b, c });
  }

  /** 수 하나를 말로: 누가(kid | teacher) 무엇을 두었는가. set은 대본의 한 묶음(status, play, replay) */
  function moveText(set, who, board, move, more = {}) {
    return fill(set[`${who}-${board.kind}`], { ...more, n: move.take ?? 0, pile: T.piles[move.pile ?? 0] });
  }

  const labelsOf = (board) => ({
    line: (index, dir, at) => fill(T.labels[`line-${dir}`], { no: index + 1, at }),
    stone: (pile, take) => (board.kind === 'one' ? fill(T.labels['stone-one'], { n: take }) : fill(T.labels['stone-piles'], { pile: T.piles[pile], n: take })),
    pile: (pile) => (board.kind === 'one' ? '' : fill(T.labels.pile, { pile: T.piles[pile] })),
    count: (n) => fill(T.labels.count, { n }),
  });

  /** 방금 둔 수의 자국: 초콜릿은 방금 생긴 두 조각, 돌은 방금 가져간 돌 */
  const freshOf = (board, move) => (!move ? null : board.kind === 'choco' ? [move.piece, move.piece + 1] : { pile: move.pile, take: move.take });

  /** 판과 둔 수들로 그릴 것을 만든다 */
  const viewOf = (board, trail) => ({ board, state: replay(board, trail).state, fresh: freshOf(board, trail.at(-1)), labels: labelsOf(board) });

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
  function statusOf(game, played) {
    if (game.first === null) return '';
    const who = turnOf(game.first, game.trail.length);
    if (played.over) return T.status[`over-${otherOf(who)}-${kindOf(game.board)}`];
    if (who === 'teacher') return T.status['teacher-turn'];
    const last = game.trail.at(-1);
    return last ? moveText(T.status, 'teacher', game.board, last) : T.status['kid-turn'];
  }

  function draw() {
    const { round } = frame;
    const game = round;
    const { board } = game;
    const played = replay(board, game.trail);
    const chosen = game.first !== null;
    const over = chosen && played.over;
    const live = chosen && !over && !round.done;
    const mine = live && turnOf(game.first, game.trail.length) === 'kid';
    const stones = board.kind !== 'choco';
    if (!mine) pick = null;

    drawGame($('duel-board'), {
      ...viewOf(board, game.trail),
      pick,
      onLine: mine && !stones ? (move) => play('kid', move) : undefined,
      onStone: mine && stones ? tapStone : undefined,
    });
    $('duel-status').textContent = flash ?? statusOf(game, played);

    // 오른쪽 칸: 고르기 → 차례
    $('duel-choose').hidden = chosen;
    $('duel-turn-box').hidden = !live;
    if (live) {
      $('duel-turn').textContent = T.turn[mine ? 'kid' : 'teacher'];
      $('duel-choco-note').hidden = stones;
      $('duel-stones-box').hidden = !stones;
      $('duel-pick-line').textContent = pick === null ? T.pick.none : fill(T.pick[board.kind], { n: pick.take, pile: T.piles[pick.pile] });
      $('duel-take').disabled = pick === null;
    }

    // 끝난 뒤 고르기에 이 형식만의 것 둘을 더한다. 진 판 뒤에는 "자리를 바꿔서 다시 두기"를 맨 위에 둔다.
    // 작은 판을 끝낸 뒤에는 틀의 두 단추(원래 판으로 돌아가기, 작은 판 하나 더)만 나온다.
    const done = round.done && !round.side;
    const lost = done && round.winner === 'teacher';
    $('duel-swap').hidden = !(done && round.first !== null);
    $('duel-replay').hidden = !(done && round.trail.length > 0);
    $('duel-swap').classList.toggle('primary', lost);
    if (done) {
      $(lost ? 'after-same' : 'after-make').before($('duel-swap'), $('duel-replay'));
      // 어느 쪽이 이기는 판인지는 자리를 바꿔 두어 보며 알아낸다. 끝난 뒤에는 풀이 단추를 두지 않는다.
      $('after-solution').hidden = true;
    }
    frame.showWhy();
    wait();
  }

  /** 선생님 차례면 잠깐 뜸을 들인 뒤에 두게 한다. 그사이 판이 바뀌었으면 두지 않는다. */
  function wait() {
    clearTimer();
    const { round } = frame;
    const game = round;
    if (!round || round.done || game.first === null) return;
    if (replay(game.board, game.trail).over || turnOf(game.first, game.trail.length) !== 'teacher') return;
    const turns = game.trail.length;
    timer = setTimeout(() => {
      timer = null;
      if (frame.round !== round || game.trail.length !== turns || round.done) return;
      // 직접 만든 판과 작은 판에는 판 번호가 없다.
      const numbered = !round.custom && !round.side;
      const move = teacherMove(game.board, game.trail, { level: numbered ? round.level : null, seed: numbered ? round.seed : null, first: game.first });
      if (move) play('teacher', move);
    }, THINK_MS);
  }

  /** 수 하나를 둔다. 차례가 아닌 쪽의 수와 둘 수 없는 수는 두지 않는다. */
  function play(who, move) {
    const { round } = frame;
    const game = round;
    if (game.first === null || round.done) return;
    if (turnOf(game.first, game.trail.length) !== who) return;
    const next = applyMove(game.board, replay(game.board, game.trail).state, move);
    if (next === null) return;
    game.trail = [...game.trail, move];
    pick = null;
    flash = null;
    const over = isOver(game.board, next);

    frame.note('move', { by: who, turn: game.trail.length, ...move });
    if (over) {
      // 더 둘 수 없다. 마지막 수를 둔 쪽이 이겼다. 이긴 판도 진 판도 "끝까지 둔 판"으로 끝낸다.
      round.winner = who;
      frame.note('over', { winner: who });
      frame.finish('solved');
      return;
    }
    draw();
    frame.persist();
    if (who === 'teacher') frame.say(moveText(T.play, 'teacher', game.board, move));
  }

  /** "먼저 둘래요" / "나중에 둘래요". 이 고르기가 이 형식의 답이다. */
  function choose(first) {
    const { round, solution } = frame;
    const game = round;
    if (!round || game.first !== null || round.done) return;
    game.first = first;
    const answer = first === 'kid' ? 'first' : 'second';
    // correct: 잘 두면 이기는 쪽을 골랐는가. 화면에서는 알리지 않는다(두어 보면 알게 된다).
    const correct = (first === 'kid') === solution.first;
    round.answers.push({ t: frame.stamp(), answer, correct, guess: null });
    frame.note('pick', { first, answer, correct });
    draw();
    frame.persist();
    frame.say(T.play[first === 'kid' ? 'picked-first' : 'picked-second']);
  }

  /** 돌을 눌렀다: 그 돌부터 맨 위의 돌까지를 골라 둔다. 같은 돌을 다시 누르면 고른 것을 푼다. */
  function tapStone(pile, take) {
    const { board } = frame.round;
    if (board.kind === 'one' && take > board.max) {
      pick = null;
      flash = fill(T.status['over-max'], { k: board.max });
    } else {
      flash = null;
      pick = pick !== null && pick.pile === pile && pick.take === take ? null : { pile, take };
    }
    draw();
  }

  function takePicked() {
    if (pick !== null) play('kid', { pile: pick.pile, take: pick.take });
  }

  // ---- 끝난 뒤: 자리를 바꿔서 다시 두기, 방금 판 다시 보기 ----
  function rematch() {
    const { round } = frame;
    if (!round || !round.done || round.first === null) return;
    const next = { first: otherOf(round.first), rematchOf: round.id };
    const start = { level: round.level, seed: round.seed, small: round.small, custom: round.custom, board: copyBoard(round.board) };
    frame.chooseAfter('swap', () => {
      preset = next;
      frame.startRound(FORMAT, start);
      frame.say(T.play[next.first === 'kid' ? 'rematch-kid' : 'rematch-teacher']);
    });
  }

  function rowOf(cards) {
    const row = document.createElement('div');
    row.className = 'figure-row';
    row.append(...cards);
    return row;
  }

  /** 방금 둔 수들을 한 수씩 넘겨 본다. 누가 무엇을 두었는지를 그림과 말로 보인다. */
  function replayPages(round) {
    const total = round.trail.length;
    return Array.from({ length: total + 1 }, (_, turns) => {
      const trail = round.trail.slice(0, turns);
      const who = turns === 0 ? null : turnOf(round.first, turns - 1);
      const parts = [turns === 0 ? T.replay[`start-${round.first}`] : moveText(T.replay, who, round.board, trail.at(-1), { no: turns })];
      if (turns === total && round.winner !== null) parts.push(T.replay.last);
      const note = turns === 0 ? T.replay['note-start'] : T.replay[`note-${who}`];
      return {
        say: parts.join(' '),
        // 그림은 종이를 넘길 때 그린다.
        get nodes() {
          return [rowOf([gameCard({ ...viewOf(round.board, trail), counts: true }, note, { big: true })])];
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

  /** 끝났을 때 하는 말: 누가 마지막 수를 두었는지를 사실로 말한다. */
  function rightLine(round) {
    const parts = [T.right[`${round.winner}-${kindOf(round.board)}`]];
    // 작은 판을 끝냈을 때는 덧붙이지 않는다(끝난 뒤에 고를 것이 다르다).
    if (round.side) return parts;
    const records = log.allRecords();
    // 덧붙이는 말은 하나만 한다(한 번에 한 가지만 말한다).
    if (!round.chose && !round.rematch) parts.push(T.right['first-board']);
    // 이 게임의 "왜 그럴까?"가 이번 판으로 열렸으면 알려 준다.
    else if (T.why[round.mode] && finishedCount(records, round.mode) === WHY_AFTER) parts.push(T.right['why-invite']);
    // 연달아 졌으면 자리를 바꿔 볼 수 있다고 알려 준다. 몇 번 졌는지는 말하지 않는다.
    else if (round.winner === 'teacher' && lostStreak(records) >= SWAP_INVITE_AFTER) parts.push(T.right['swap-invite']);
    return parts;
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----
  /** 표의 줄들: 초콜릿은 판, 칸의 수, 쪼개는 횟수, 마지막에 쪼개는 쪽. 두 더미는 판과 이기는 쪽 */
  function tableOf(game, rows) {
    return tableCard(
      T.table[game],
      rows.map((row) => {
        const side = T.sides[row.winner];
        if (game === 'choco') return { marked: row.winner === 'second', cells: [nameOf({ kind: 'choco', w: row.w, h: row.h }), fill(T.table.cells, { n: row.cells }), fill(T.table.times, { n: row.moves }), side] };
        return { marked: row.winner === 'second', cells: [nameOf({ kind: 'piles', piles: row.piles }), side] };
      }),
    );
  }

  /** 수마다 "차례가 오면 이기는 수인지 지는 수인지"를 적은 줄. 승패는 풀이 프로그램이 따진다 */
  function marksOf(marks) {
    const cells = Array.from({ length: marks.upto }, (_, index) => {
      const board = { kind: 'one', n: index + 1, max: marks.max };
      const win = isWin(board, startState(board));
      return { no: String(index + 1), text: T.marks[win ? 'win' : 'lose'], marked: !win };
    });
    // 한 줄에 (한 번에 가져갈 수 있는 수 + 1)칸씩 놓는다.
    return marksCard({ note: marks.note, per: marks.max + 1, cells });
  }

  /**
   * "왜 그럴까?"는 게임마다 따로 있다(초콜릿 쪼개기, 한 더미, 두 더미). 그 게임을 세 판 끝까지 둔 뒤에 열린다.
   * 세 더미에는 없다. 일부러 까닭을 남겨 둔 판이다.
   */
  function whyPages(round) {
    const slides = T.why[round.mode];
    if (!slides || !whyOpen(log.allRecords(), round.mode)) return null;
    return slides.map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다(단추를 보일지 따질 때마다 그리지 않는다).
      get nodes() {
        const nodes = [];
        if (slide.figures.length > 0) nodes.push(rowOf(slide.figures.map((item) => gameCard({ ...viewOf(item.board, item.trail), counts: true }, item.note))));
        if (slide.marks) nodes.push(marksOf(slide.marks));
        if (slide.table) nodes.push(tableOf(round.mode, slide.table));
        return nodes;
      },
    }));
  }

  /** 풀이: 잘 두었을 때 어느 쪽이 이기는지를 알려 준다. */
  function solutionPages(round, solution) {
    return [{ say: T.solution[solution.winner], nodes: [rowOf([gameCard({ ...viewOf(round.board, []), counts: true }, nameOf(round.board), { big: true })])] }];
  }

  // ---- 직접 만들기: 게임을 고르고 수를 정한다. ----
  const inside = (value, limit) => Number.isInteger(value) && value >= limit.min && value <= limit.max;

  function boardOf(made) {
    if (made.game === 'choco') return { kind: 'choco', w: made.w, h: made.h };
    if (made.game === 'one') return { kind: 'one', n: made.n, max: made.max };
    return { kind: 'piles', piles: made.piles.slice(0, made.count) };
  }
  const draftBoard = () => boardOf(draft);

  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    const ok =
      saved &&
      DRAFT_GAMES.includes(saved.game) &&
      inside(saved.w, LIMITS.choco) &&
      inside(saved.h, LIMITS.choco) &&
      inside(saved.n, LIMITS.one) &&
      inside(saved.max, LIMITS.take) &&
      inside(saved.count, LIMITS.piles) &&
      Array.isArray(saved.piles) &&
      saved.piles.length === LIMITS.piles.max &&
      saved.piles.every((item) => inside(item, LIMITS.pile));
    const from = ok ? saved : FIRST_DRAFT;
    return { game: from.game, w: from.w, h: from.h, n: from.n, max: from.max, count: from.count, piles: from.piles.slice() };
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    $('duel-make-result').textContent = '';
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function setStepper(id, value, limit, text) {
    $(id).textContent = text;
    $(`${id}-fewer`).disabled = value <= limit.min;
    $(`${id}-more`).disabled = value >= limit.max;
  }

  function drawMake() {
    for (const button of $('duel-make-games').querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.game === draft.game));
    for (const game of DRAFT_GAMES) $(`duel-make-${game}`).hidden = game !== draft.game;
    setStepper('duel-make-w', draft.w, LIMITS.choco, fill(T.make.cells, { n: draft.w }));
    setStepper('duel-make-h', draft.h, LIMITS.choco, fill(T.make.cells, { n: draft.h }));
    setStepper('duel-make-n', draft.n, LIMITS.one, fill(T.make.stones, { n: draft.n }));
    for (const button of $('duel-make-takes').querySelectorAll('button')) button.setAttribute('aria-pressed', String(Number(button.dataset.take) === draft.max));
    for (const button of $('duel-make-counts').querySelectorAll('button')) button.setAttribute('aria-pressed', String(Number(button.dataset.count) === draft.count));
    draft.piles.forEach((item, pile) => setStepper(`duel-make-p${pile}`, item, LIMITS.pile, fill(T.make.stones, { n: item })));
    $('duel-make-third').hidden = draft.count < LIMITS.piles.max;
    const board = draftBoard();
    drawGame($('duel-make-board'), viewOf(board, []));
    // 처음부터 둘 수가 없는 판(한 칸짜리 초콜릿)은 두어 볼 수 없다.
    $('duel-make-play').disabled = movesOf(board, startState(board)).length === 0;
  }

  function changeDraft(change) {
    const next = { ...draft, ...change };
    if (checkBoard(boardOf(next)) !== null) return;
    draft = next;
    $('duel-make-result').textContent = '';
    log.saveDraft(draft, FORMAT);
    drawMake();
  }

  const stepPile = (pile, step) => changeDraft({ piles: draft.piles.map((item, index) => (index === pile ? item + step : item)) });

  /** 아이가 만든 판을 풀이 프로그램으로 풀어서, 잘 두었을 때 어느 쪽이 이기는지 알려 준다. */
  function solveDraft() {
    const board = draftBoard();
    const result = solve(board);
    const line = movesOf(board, startState(board)).length === 0 ? T.make.nomove : T.make[result.winner];
    $('duel-make-result').textContent = line;
    const now = new Date().toISOString();
    log.saveRecord({
      kind: 'made',
      v: 1,
      id: log.newId('m'),
      format: FORMAT,
      startedAt: now,
      endedAt: now,
      board,
      solution: { winner: result.winner, positions: result.positions },
    });
    log.flush();
    frame.talkers.make.say(line);
  }

  function playDraft() {
    const board = draftBoard();
    if (movesOf(board, startState(board)).length === 0) return;
    frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board });
  }

  // ---- 단추 잇기 ----
  $('duel-first').addEventListener('click', () => choose('kid'));
  $('duel-second').addEventListener('click', () => choose('teacher'));
  $('duel-take').addEventListener('click', takePicked);
  $('duel-swap').addEventListener('click', rematch);
  $('duel-replay').addEventListener('click', openReplay);
  $('duel-make-games').addEventListener('click', (event) => {
    const game = event.target.closest('button')?.dataset.game;
    if (DRAFT_GAMES.includes(game)) changeDraft({ game });
  });
  $('duel-make-w-fewer').addEventListener('click', () => changeDraft({ w: draft.w - 1 }));
  $('duel-make-w-more').addEventListener('click', () => changeDraft({ w: draft.w + 1 }));
  $('duel-make-h-fewer').addEventListener('click', () => changeDraft({ h: draft.h - 1 }));
  $('duel-make-h-more').addEventListener('click', () => changeDraft({ h: draft.h + 1 }));
  $('duel-make-n-fewer').addEventListener('click', () => changeDraft({ n: draft.n - 1 }));
  $('duel-make-n-more').addEventListener('click', () => changeDraft({ n: draft.n + 1 }));
  $('duel-make-takes').addEventListener('click', (event) => {
    const max = Number(event.target.closest('button')?.dataset.take);
    if (inside(max, LIMITS.take)) changeDraft({ max });
  });
  $('duel-make-counts').addEventListener('click', (event) => {
    const piles = Number(event.target.closest('button')?.dataset.count);
    if (inside(piles, LIMITS.piles)) changeDraft({ count: piles });
  });
  for (let pile = 0; pile < LIMITS.piles.max; pile++) {
    $(`duel-make-p${pile}-fewer`).addEventListener('click', () => stepPile(pile, -1));
    $(`duel-make-p${pile}-more`).addEventListener('click', () => stepPile(pile, 1));
  }
  $('duel-make-solve').addEventListener('click', solveDraft);
  $('duel-make-play').addEventListener('click', playDraft);

  return {
    id: FORMAT,
    T,
    padId: 'duel-pad',
    makeId: 'make-duel',
    homeIds: { sample: 'home-duel-sample', blank: 'home-duel-blank', ask: 'home-duel-ask', play: 'home-duel-play', pick: 'home-duel-pick', make: 'home-duel-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    /** 새 판에서 이 형식이 맡는 값 */
    begin({ level, seed, custom, board }) {
      const start = preset;
      preset = null;
      // 형식의 맨 첫 판은 고르기 없이 아이가 먼저 둔다. 자리를 바꿔서 다시 두는 판은 먼저 두는 쪽이 정해져 있다.
      const fixed = !custom && opensFixed(level, seed);
      return {
        mode: gameOf(board),
        board: copyBoard(board), // 판: 초콜릿의 크기, 또는 돌의 수
        chose: start === null && !fixed, // 아이가 먼저 둘지 나중에 둘지 고르는 판인가
        first: start !== null ? start.first : fixed ? 'kid' : null, // 먼저 두는 쪽. 아직 고르지 않았으면 null
        trail: [], // 둔 수들(먼저 두는 쪽부터 번갈아)
        winner: null, // 마지막 수를 둔 쪽. 끝나지 않았으면 null
        rematch: start !== null, // 자리를 바꿔서 다시 두는 판인가
        rematchOf: start?.rematchOf ?? null, // 그렇다면 바로 앞 판의 번호
        replayCount: 0, // "방금 판 다시 보기"를 연 수
      };
    },
    solve(round) {
      const { first, winner, positions } = solve(round.board);
      return { possible: true, first, winner, positions };
    },
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (!GAMES.includes(saved.mode) || checkBoard(saved.board) !== null || gameOf(saved.board) !== saved.mode) return false;
      if (saved.first !== null && !SIDES.includes(saved.first)) return false;
      const played = replay(saved.board, saved.trail);
      // 끝난 판은 하던 판이 아니다. 먼저 두는 쪽을 정하기 전에는 둔 수가 없다.
      if (!played.ok || played.over || (saved.first === null && saved.trail.length > 0)) return false;
      if (typeof saved.chose !== 'boolean' || typeof saved.rematch !== 'boolean') return false;
      return saved.winner === null && count(saved.replayCount);
    },
    /** 판 화면에서 이 형식의 것(판, 판 아래의 글, 끝난 뒤의 단추 둘)을 보이거나 감춘다. 이 형식에는 무르기와 되돌리기가 없다. */
    showParts(on) {
      $('duel-board').hidden = !on;
      $('duel-count').hidden = !on;
      if (on) {
        // 무르기와 되돌리기는 숫자 추리의 showParts가 앞에서 보이게 해 둔다. 이 형식의 판에서는 다시 감춘다.
        $('undo').hidden = true;
        $('reset').hidden = true;
      } else {
        $('duel-swap').hidden = true;
        $('duel-replay').hidden = true;
      }
    },
    enter: forget,
    draw,
    ended: forget,
    ruleLine(round) {
      if (!round.chose && !round.rematch && !round.custom) return T.rules['choco-first'];
      if (round.board.kind === 'one') return round.board.max === 1 ? T.rules['one-1'] : fill(T.rules.one, { k: round.board.max });
      return T.rules[round.mode];
    },
    hints: (round) => T.hints[round.mode],
    touched: (round) => round.trail.length > 0 || (round.chose && round.first !== null),
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view: (round) => ({ first: round.first, turns: round.trail.length, state: replay(round.board, round.trail).state }),
    /** 이 판보다 작은 판: 같은 게임의 가장 작은 판들을 작은 것부터 차례로 */
    smaller: (round, turn) => smallerDuel({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      const chosen = round.first !== null;
      const moves = round.trail.map((move, index) => ({ by: turnOf(round.first, index), ...move }));
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        // 잘 두었을 때 이기는 쪽(first: 먼저 두는 쪽, second: 나중에 두는 쪽)과 풀이 프로그램이 따져 본 자리의 수
        solution: { possible: true, winner: solution.winner, positions: solution.positions },
        chose: round.chose,
        first: round.first,
        // 아이가 선 쪽이 잘 두면 이기는 쪽이었는가(아직 정하지 않았으면 null)
        choseWinner: chosen ? (round.first === 'kid') === solution.first : null,
        // 둔 수의 차례(누가, 무엇을)
        moves,
        moveCount: moves.filter((move) => move.by === 'kid').length,
        turnCount: moves.length,
        winner: round.winner,
        // 아이가 이기는 자리에서 지는 수를 둔 곳(몇 번째 수인지)
        slips: chosen ? slipsOf(round.board, round.trail, round.first) : [],
        rematch: round.rematch,
        rematchOf: round.rematchOf,
        replayCount: round.replayCount,
      };
    },
    rightLine,
    whyPages,
    solutionPages,
    undo() {},
    reset() {},
    onKey() {},

    // ---- 처음 화면에 그리는 그림 ----
    homeAsk: () => T.home.ask,
    pickLine: () => T.home.pick,
    drawSample(root, board) {
      drawGame(root, { ...viewOf(board, []), small: true });
    },
    drawBlank(root) {
      drawGame(root, { ...viewOf(BLANK, []), small: true });
    },
    drawResume(root, saved) {
      drawGame(root, { ...viewOf(saved.board, saved.trail), small: true });
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 게임을 작은 그림으로 보여 준다. */
    drawLevelPicture(root, entry) {
      const picture = entry.picture;
      if (picture.blank) drawGame(root, { ...viewOf(BLANK, []), small: true });
      else drawGame(root, { ...viewOf(picture.board, picture.trail), small: true });
    },
    showMake,
  };
}
