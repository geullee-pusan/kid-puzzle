// 지우고 쓰기 예언: 판 화면에서 이 형식이 맡는 부분(쪽지와 칠판, 지우기, 내 쪽지에 적기, 답하는 칸, 끝났을 때 하는 말, 풀이와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/erase.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 칠판의 수 두 개를 차례로 누르면 둘 다 지워지고 규칙대로 새 수 하나가 나중에 누른 수의 자리에 적힌다. 수가 하나 남으면 한 번 다 지운 것이다.
// 묻는 것(ask)은 판의 종류(mode)가 정한다.
//   watch   같으면 0, 다르면 1(same). 선생님 쪽지가 접힌 채 칠판 위에 있다. 다 지우면 쪽지를 연다. "다른 차례로 한 번 더"로 두 번 다 지우면 끝난다
//   number  합에서 1 빼기(less), 긴 칠판과 직접 만든 칠판(같으면 0 다르면 1, 합에서 1 빼기). 먼저 내 쪽지에 수를 적어야 지울 수 있다.
//           다 지우면 두 쪽지를 열고 끝난다. 내 쪽지가 선생님 쪽지와 달라도 틀렸다고 하지 않고 두 쪽지에 적힌 것만 말한다(기록에 남긴다)
//   parity  두 수의 차(parity, 긴 칠판과 직접 만든 칠판의 차). 먼저 홀수인지 짝수인지 고른다. parity는 두 번 다 지우면 끝난다
//   zero    두 수의 차(zero). 끝에 0이 남으면 끝난다. 0이 아닌 수가 남으면 그 수만 말하고 무르거나 처음으로 돌아갈 수 있다.
//           0을 남길 수 없는 칠판은 "불가능해요"로 답한다. 남길 수 있는 칠판에 누르면 그 사실만 말하고 판은 이어진다
// 수가 열 개 이상인 긴 칠판(긴 칠판, 직접 만든 칠판)은 내 쪽지에 적은 뒤 다 지우지 않고 "선생님 쪽지 열기"로 끝낼 수도 있다.
// 왼쪽 칸의 "합 보기"를 켜면 판 아래에 처음부터 지금까지의 합을 차례로 적는다. 무엇이 그대로인지는 말하지 않는다. 처음 켤 때 힌트 하나로 센다.
import T from '../content/erase.json';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf, solveOnce } from '../core/erase-ladder.js';
import { LONG_CHIPS, MAX_VALUE, RULES, SEARCH_CHIPS, STORY, STORY_MAX, checkBoard, copyBoard, leftTrail, replay } from '../core/erase.js';
import { smallerErase } from '../core/smaller.js';
import { endsClosed, fill, ordinal } from '../core/text.js';
import { chalkCard, drawChalk, drawMini } from '../ui/erase-board.js';

const FORMAT = 'erase';
const MODES = ['same', 'less', 'parity', 'zero', 'long', 'made'];
/** 내 쪽지에 적는 수의 자리 수, 직접 만들기에서 적는 수의 자리 수 */
const GUESS_DIGITS = 3;
const MAKE_DIGITS = 2;
/** 직접 만들기: 칠판에 적을 수 있는 수의 개수(차를 쓰는 칠판은 SEARCH_CHIPS개까지) */
export const MAKE_MAX = 12;
/** 처음 화면과 만들기 목록에 그리는 빈 칠판, 직접 만들기의 처음 칠판 */
const BLANK = [1, 0, 1, 1];
const FIRST_DRAFT = { rule: 'same', nums: [1, 0, 1, 1] };
/** 풀이에서 지운 차례를 한 장씩 모두 보이는 칠판의 크기(더 크면 처음과 끝만) */
const STEP_CARDS = 6;

/** 수 뒤에 붙는 말: 받침이 있으면 c, 없으면 o */
const end = (number) => (endsClosed(number) ? 'c' : 'o');
const byEnd = (group, key, number) => group[`${key}-${end(number)}`];
const faceOf = (parity) => T.parity[parity === 1 ? 'odd' : 'even'];
const count = (value) => Number.isInteger(value) && value >= 0;

/** 판의 종류가 묻는 것 */
export function askOf(round) {
  if (round.mode === 'same') return 'watch';
  if (round.mode === 'zero') return 'zero';
  if (round.mode === 'parity') return 'parity';
  if (round.mode === 'less') return 'number';
  return round.board.rule === 'diff' ? 'parity' : 'number';
}
/** 끝나려면 몇 번 다 지워야 하는가(같으면 0 다르면 1과 홀수일까 짝수일까는 두 번) */
export const playsNeeded = (round) => (round.mode === 'same' || round.mode === 'parity' ? 2 : 1);
/** 다 지우지 않고 쪽지를 열어 볼 수 있는 칠판인가 */
export const earlyOk = (round) => (round.mode === 'long' || round.mode === 'made') && round.board.nums.length >= LONG_CHIPS && askOf(round) !== 'zero';

/** 직접 만들기에서 만들던 칠판으로 쓸 수 있는 값인가(수가 둘보다 적거나 규칙에 맞지 않는 수가 있어도 된다) */
function draftOk(draft) {
  if (!draft || !RULES.includes(draft.rule) || !Array.isArray(draft.nums) || draft.nums.length > MAKE_MAX) return false;
  return draft.nums.every((value) => Number.isInteger(value) && value >= 0 && value <= MAX_VALUE);
}

/** 두 번 지운 차례가 같은가(두 수를 누른 차례는 보지 않는다) */
const sameOrder = (a, b) => a.length === b.length && a.every((step, index) => Math.min(...step) === Math.min(...b[index]) && Math.max(...step) === Math.max(...b[index]));

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createErase(frame) {
  const { $, log } = frame;
  let picked = null; // 먼저 누른 수의 이름
  let typing = ''; // 내 쪽지에 적으려고 누르고 있는 숫자들
  let flash = null; // 판 아래에 잠깐 적는 한 줄. 다음에 무엇을 누르면 지운다
  let draft = null; // 직접 만들기에서 만들던 칠판
  let typingMade = ''; // 직접 만들기에서 누르고 있는 숫자들
  let made = null; // 직접 만들기에서 선생님이 따진 것(칠판을 고치면 지운다)

  const now = (round) => replay(round.board, round.trail);
  const ended = (round) => now(round).chips.length === 1;
  /** 한 번 다 지운 뒤 "다른 차례로 한 번 더"를 기다리는가 */
  const waiting = (round) => !round.done && askOf(round) !== 'zero' && ended(round) && round.ends.length < playsNeeded(round);
  const needsGuess = (round) => ['number', 'parity'].includes(askOf(round));
  const locked = (round) => needsGuess(round) && round.guess === null;

  /** 내 쪽지에 적은 것이 선생님 쪽지와 같은가 */
  function guessRight(round, solution) {
    if (askOf(round) === 'number') return round.guess === solution.final;
    return round.guess === (solution.parity === 1 ? 'odd' : 'even');
  }

  /** 선생님 쪽지에 적힌 것(글) */
  const noteText = (round, solution) => (askOf(round) === 'parity' ? faceOf(solution.parity) : String(solution.final));
  const kidText = (round) => (round.guess === null ? null : askOf(round) === 'parity' ? T.parity[round.guess] : String(round.guess));

  function noteLine(round, solution) {
    if (askOf(round) === 'parity') return fill(T.play['note-face'], { face: faceOf(solution.parity) });
    return fill(byEnd(T.play, 'note', solution.final), { k: solution.final });
  }

  function kidLine(round) {
    if (askOf(round) === 'parity') return fill(T.play['kid-face'], { face: T.parity[round.guess] });
    return fill(byEnd(T.play, 'kid', round.guess), { k: round.guess });
  }

  // ---- 판 ----
  function notesOf(round, solution) {
    const ask = askOf(round);
    if (ask === 'zero') return [];
    const open = round.opened || round.done;
    const value = noteText(round, solution);
    const notes = [
      {
        who: 'teacher',
        title: T.note.teacher,
        shut: !open,
        text: open ? value : T.note.shut,
        label: open ? fill(T.labels['teacher-open'], { face: value }) : T.labels['teacher-shut'],
      },
    ];
    if (needsGuess(round)) {
      const mine = kidText(round);
      notes.push({
        who: 'kid',
        title: T.note.kid,
        empty: mine === null,
        text: mine ?? (typing || T.note.empty),
        label: mine === null ? T.labels['kid-empty'] : fill(T.labels.kid, { face: mine }),
      });
    }
    return notes;
  }

  function chipLabel(state) {
    return (chip, index) => {
      const face = fill(T.labels.chip, { no: ordinal(index + 1), k: chip.value });
      if (chip.id === picked) return fill(T.labels.picked, { face });
      if (chip.id === state.fresh) return fill(T.labels.fresh, { face });
      return face;
    };
  }

  function draw() {
    const { round, solution } = frame;
    const playing = !round.done;
    const state = now(round);
    const ask = askOf(round);
    if (!playing) picked = null;
    const tappable = playing && !locked(round) && state.chips.length > 1;
    drawChalk($('erase-board'), {
      chips: state.chips,
      notes: notesOf(round, solution),
      selected: picked,
      fresh: state.fresh,
      onChip: tappable ? tapChip : undefined,
      slots: round.board.nums.length,
      labels: { board: fill(T.labels.board, { n: state.chips.length }), chip: chipLabel(state) },
    });
    $('erase-left').textContent = String(state.chips.length);
    $('erase-moves').textContent = String(round.trail.length);
    $('erase-sum-line').classList.toggle('er-off', !(round.sumOn && playing));
    $('erase-sums').textContent = state.sums.join(' → ');
    $('erase-status').textContent = flash ?? statusOf(round, state);
    // 답하는 칸: 내 쪽지에 적기(수), 고르기(홀수, 짝수), 불가능해요, 쪽지 열기, 한 번 더
    $('erase-how').hidden = playing && locked(round);
    $('erase-write').hidden = !(playing && ask === 'number' && round.guess === null);
    $('erase-pick').hidden = !(playing && ask === 'parity' && round.guess === null);
    $('erase-odd').textContent = T.parity.odd;
    $('erase-even').textContent = T.parity.even;
    $('erase-maybe').hidden = ask !== 'zero';
    $('erase-impossible').disabled = !playing;
    $('erase-open').hidden = !(playing && earlyOk(round) && round.guess !== null && !round.opened);
    $('erase-again').hidden = !waiting(round);
    $('erase-shown').textContent = typing;
    $('erase-shown').setAttribute('aria-label', typing ? fill(T.labels.shown, { k: typing }) : T.labels['shown-empty']);
    const fixed = ask !== 'zero' && ended(round);
    $('undo').disabled = !playing || round.trail.length === 0 || fixed;
    $('reset').disabled = !playing || round.trail.length === 0 || fixed;
    // 도구: 합을 차례로 적는다. 끝난 판에서는 누를 수 없다
    $('erase-sum').textContent = T.tool[round.sumOn && playing ? 'on' : 'off'];
    $('erase-sum').setAttribute('aria-pressed', String(round.sumOn && playing));
    $('erase-sum').disabled = round.done;
    frame.showWhy();
  }

  function statusOf(round, state) {
    const ask = askOf(round);
    if (round.done) return ask === 'zero' && state.chips.length === 1 && state.chips[0].value === 0 ? T.status.zero : ended(round) ? T.status.one : '';
    if (locked(round)) {
      if (ask === 'parity') return T.status.choose;
      return typing ? fill(byEnd(T.status, 'typing', Number(typing)), { k: typing }) : T.status.write;
    }
    if (waiting(round)) return T.status.again;
    if (state.chips.length === 1) return T.status.one;
    if (picked !== null) return T.status.picked;
    return round.trail.length === 0 ? T.status.start : '';
  }

  // ---- 지우기 ----
  function tapChip(id) {
    const { round } = frame;
    if (!round || round.done) return;
    flash = null;
    if (locked(round)) {
      flash = T.status[askOf(round) === 'parity' ? 'choose' : 'write'];
      draw();
      return;
    }
    const state = now(round);
    if (state.chips.length <= 1 || !state.chips.some((chip) => chip.id === id)) return;
    if (picked === null || !state.chips.some((chip) => chip.id === picked)) picked = id;
    else if (picked === id) picked = null;
    else {
      eraseTwo(picked, id);
      return;
    }
    draw();
  }

  /** 두 수를 지우고 새 수를 나중에 누른 수의 자리에 쓴다 */
  function eraseTwo(a, b) {
    const { round } = frame;
    round.trail = [...round.trail, [a, b]];
    round.moveCount += 1;
    picked = null;
    frame.note('erase', { a, b });
    const state = now(round);
    if (state.chips.length > 1) {
      draw();
      frame.persist();
      return;
    }
    playEnded(state.chips[0].value);
  }

  /** 수가 하나 남았다 */
  function playEnded(final) {
    const { round } = frame;
    const ask = askOf(round);
    frame.note('end', { final });
    if (ask === 'zero') {
      if (final === 0) {
        round.answers.push({ t: frame.stamp(), answer: 'zero', correct: true, guess: null });
        frame.note('answer', { answer: 'zero', correct: true });
        frame.finish('solved');
        return;
      }
      round.endCount += 1;
      draw();
      frame.persist();
      frame.say(`${fill(byEnd(T.play, 'end', final), { k: final })} ${T.play['try-more']}`);
      return;
    }
    round.ends = [...round.ends, { trail: round.trail.slice(), final }];
    const lines = [fill(byEnd(T.play, 'end', final), { k: final })];
    if (!round.opened) lines.push(...openNote(round));
    if (round.ends.length >= playsNeeded(round)) {
      frame.finish('solved');
      return;
    }
    draw();
    frame.persist();
    lines.push(T.play.again);
    frame.say(lines.join(' '));
  }

  /** 선생님 쪽지를 연다. 내 쪽지가 있으면 견주어 기록에 남긴다. 하는 말을 돌려준다 */
  function openNote(round) {
    const { solution } = frame;
    round.opened = true;
    const lines = [T.play.open, noteLine(round, solution)];
    if (needsGuess(round)) {
      const correct = guessRight(round, solution);
      const answer = `guess:${round.guess}`;
      round.answers.push({ t: frame.stamp(), answer, correct, guess: correct ? null : 'other' });
      frame.note('answer', { answer, correct });
      if (!correct) round.wrongCount += 1;
      lines.push(kidLine(round));
    } else {
      round.answers.push({ t: frame.stamp(), answer: `end:${round.ends.at(-1).final}`, correct: true, guess: null });
    }
    return lines;
  }

  /** "선생님 쪽지 열기": 다 지우지 않고 쪽지를 연다(긴 칠판). 판이 끝난다 */
  function openEarly() {
    const { round } = frame;
    if (!round || round.done || !earlyOk(round) || round.guess === null || round.opened) return;
    picked = null;
    round.early = true;
    openNote(round);
    frame.finish('solved');
  }

  /** "다른 차례로 한 번 더 지우기": 처음 칠판으로 돌아간다(다 지운 것은 기록에 남아 있다) */
  function again() {
    const { round } = frame;
    if (!round || !waiting(round)) return;
    round.trail = [];
    round.againCount += 1;
    picked = null;
    flash = null;
    frame.note('again');
    draw();
    frame.persist();
    frame.say(T.play.restart);
  }

  /** 무르기: 마지막 지우기 하나를 무른다. 다 지워서 쪽지를 연 것은 무를 수 없다 */
  function undo() {
    const { round } = frame;
    if (round.done || round.trail.length === 0 || (askOf(round) !== 'zero' && ended(round))) return;
    round.trail = round.trail.slice(0, -1);
    round.undoCount += 1;
    picked = null;
    flash = null;
    frame.note('undo');
    draw();
    frame.persist();
    // 앞의 모습에 한 말(끝에 남은 수, 남길 수 있는 칠판이라는 말)은 이제 맞지 않을 수 있으니 덮는다
    frame.say(T.play.undo);
  }

  function reset() {
    const { round } = frame;
    if (round.done || round.trail.length === 0 || (askOf(round) !== 'zero' && ended(round))) return;
    round.trail = [];
    round.resetCount += 1;
    picked = null;
    flash = null;
    frame.note('reset');
    draw();
    frame.persist();
    frame.say(T.play.reset);
  }

  // ---- 내 쪽지 ----
  function pressKey(key) {
    const { round } = frame;
    if (!round || round.done || askOf(round) !== 'number' || round.guess !== null) return;
    flash = null;
    if (key === 'erase') typing = typing.slice(0, -1);
    else if (key === 'enter') {
      if (typing === '') {
        flash = T.status.write;
        draw();
        return;
      }
      const value = Number(typing);
      round.guess = value;
      typing = '';
      frame.note('guess', { value });
      draw();
      frame.persist();
      frame.say(fill(byEnd(T.play, 'written', value), { k: value }));
      return;
    } else if (/^[0-9]$/.test(key)) {
      if (typing.length >= GUESS_DIGITS) return;
      typing = typing === '0' ? key : typing + key;
    }
    draw();
  }

  function choose(face) {
    const { round } = frame;
    if (!round || round.done || askOf(round) !== 'parity' || round.guess !== null) return;
    flash = null;
    round.guess = face;
    frame.note('guess', { value: face });
    draw();
    frame.persist();
    frame.say(fill(T.play.chosen, { face: T.parity[face] }));
  }

  /** "불가능해요". 남길 수 있는 칠판이면 틀렸다고 하지 않고 그 사실만 말한다. 판은 그대로 이어진다. */
  function sayImpossible() {
    const { round, solution } = frame;
    if (!round || round.done || askOf(round) !== 'zero') return;
    picked = null;
    const correct = solution.zero === false;
    const guess = correct ? null : 'impossible-on-possible';
    round.answers.push({ t: frame.stamp(), answer: 'impossible', correct, guess });
    frame.note('answer', { answer: 'impossible', correct, guess });
    if (correct) {
      frame.finish('solved');
      return;
    }
    round.impossibleCount += 1;
    round.wrongCount += 1;
    flash = null;
    frame.persist();
    draw();
    frame.say(round.moveCount === 0 ? T.play['possible-press-untried'] : T.play['possible-press']);
  }

  // ---- 합 보기 ----
  function toggleSum() {
    const { round } = frame;
    if (!round || round.done) return;
    round.sumOn = !round.sumOn;
    if (round.sumOn) {
      round.sumShown = true;
      round.sumCount += 1;
    }
    flash = null;
    frame.note('sum-tool', { on: round.sumOn });
    draw();
    frame.keep();
  }

  // ---- 끝났을 때 하는 말: 한 일을 그대로 말한다 ----
  function rightLine(round, solution) {
    const ask = askOf(round);
    const parts = [];
    if (ask === 'zero') {
      if (round.answers.at(-1)?.answer === 'impossible') {
        parts.push(round.moveCount > 0 ? fill(T.right['impossible-tried'], { k: round.moveCount }) : T.right['impossible-untried']);
        parts.push(fill(byEnd(T.right, 'reason', solution.sum), { n: solution.sum }));
        return parts;
      }
      const back = round.undoCount + round.resetCount;
      parts.push(fill(T.right[back === 0 ? 'zero-clean' : 'zero-back'], { k: round.trail.length, n: back }));
      if (round.impossibleCount > 0) parts.push(T.right['after-press']);
      return parts;
    }
    if (round.early) {
      parts.push(T.right.early, noteLine(round, solution), kidLine(round));
      if (guessRight(round, solution)) parts.push(T.right['kid-match']);
      return parts;
    }
    const finals = round.ends.map((item) => item.final);
    if (ask === 'watch') {
      parts.push(fill(byEnd(T.right, 'twice', finals[0]), { k: finals[0] }), T.right['note-match']);
      parts.push(sameOrder(round.ends[0].trail, round.ends[1].trail) ? T.right['same-order'] : T.right['other-order']);
      return parts;
    }
    if (finals.length >= 2) {
      const [first, second] = finals;
      parts.push(fill(byEnd(T.right, 'two', second), { k: first, n: second }), fill(T.right['both-face'], { face: faceOf(second % 2) }));
      if (first === second) parts.push(T.right['same-final']);
      return parts;
    }
    parts.push(fill(byEnd(T.play, 'end', finals[0]), { k: finals[0] }), noteLine(round, solution), kidLine(round));
    if (guessRight(round, solution)) parts.push(T.right['kid-match']);
    return parts;
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----
  function rowOf(cards) {
    const row = document.createElement('div');
    row.className = 'figure-row';
    row.append(...cards);
    return row;
  }

  /** 지우는 차례의 그림들: 장마다 칠판과 다음에 지울 두 수. 칠판이 크면 처음과 끝만 */
  function stepCards(board, trail, labels) {
    const cards = [];
    for (let at = 0; at <= trail.length; at++) {
      if (board.nums.length > STEP_CARDS && at > 0 && at < trail.length) continue;
      const { chips, sums } = replay(board, trail.slice(0, at));
      const step = trail[at];
      const marks = step ? step.map((id) => chips.findIndex((chip) => chip.id === id)) : [];
      cards.push(chalkCard({ nums: chips.map((chip) => chip.value), places: chips.map((chip) => chip.slot), slots: board.nums.length, marks }, labels(at, sums.at(-1))));
    }
    return cards;
  }

  const stepNote = (at, sum) => `${at === 0 ? T.solution.start : fill(T.solution.step, { no: at })}, ${fill(T.solution.sum, { n: sum })}`;

  /** 풀이: 끝에 남는 수(또는 남길 수 있는 수)와 지우는 차례 하나. 0을 남길 수 없는 칠판은 처음 합 */
  function solutionPages(round, solution) {
    const { board } = round;
    const ask = askOf(round);
    if (ask === 'zero' && !solution.zero) {
      return [{ say: fill(T.solution.impossible, { n: solution.sum }), nodes: [rowOf([chalkCard({ nums: board.nums }, fill(T.solution.sum, { n: solution.sum }), { big: true })])] }];
    }
    let say;
    if (ask === 'zero') say = T.solution.zero;
    else if (solution.final !== null) say = fill(byEnd(T.solution, 'fixed', solution.final), { k: solution.final });
    else if (solution.finals) say = fill(byEnd(T.solution, 'finals', solution.finals.at(-1)), { k: solution.finals.join(', '), face: faceOf(solution.parity) });
    else say = fill(T.solution['face-only'], { face: faceOf(solution.parity) });
    return [{ say, nodes: [rowOf(stepCards(board, solution.order, stepNote))] }];
  }

  /** "왜 그럴까?"에 쓰는 칠판과 지운 차례: 수가 STORY_MAX개까지면 이 칠판(아이가 다 지운 차례), 더 크면 정해 둔 작은 칠판 */
  function storyOf(round) {
    const { board } = round;
    if (board.nums.length > STORY_MAX) return { board: copyBoard(STORY[board.rule]), trail: leftTrail(STORY[board.rule]) };
    const trail = round.ends[0]?.trail ?? (ended(round) ? round.trail : (frame.solution?.order ?? leftTrail(board)));
    return { board, trail };
  }

  const sumNote = (sum) => fill(byEnd(T.why, 'sum', sum), { n: sum });
  const leftNote = (value) => fill(byEnd(T.why, 'left', value), { k: value });

  /** "왜 그럴까?": 지울 때마다 합을 적다 알아챈다 → 한 번 지울 때 합이 어떻게 바뀌는지 → 끝에 남는 수 → 통하지 않는 칠판과 이름 */
  function whyPages(round) {
    const { rule } = round.board;
    const story = storyOf(round);
    const { sums, chips } = replay(story.board, story.trail);
    const final = chips[0].value;
    const start = sums[0];
    const parity = start % 2;
    const first = story.trail[0];
    const firstChips = startChipsOf(story.board);
    const firstPair = first.map((id) => firstChips.find((chip) => chip.id === id).value);
    const pages = [
      {
        say: `${fill(T.why.sums, { k: sums.join(', ') })} ${rule === 'less' ? T.why['seen-less'] : fill(T.why['seen-face'], { face: faceOf(parity) })}`,
        cards: () => stepCards(story.board, story.trail, (at, sum) => `${at === 0 ? T.why.start : fill(T.why.step, { no: at })}, ${sumNote(sum)}`),
      },
      {
        say: T.why[`${rule}-step`],
        cards: () => {
          if (rule === 'same') {
            return [
              chalkCard({ nums: [1, 1], marks: [0, 1] }, T.why['case-two']),
              chalkCard({ nums: [0, 0], marks: [0, 1] }, T.why['case-zero']),
              chalkCard({ nums: [0, 1], marks: [0, 1] }, T.why['case-one']),
            ];
          }
          const [a, b] = firstPair;
          const next = replay(story.board, story.trail.slice(0, 1));
          const note = rule === 'less' ? T.why['case-less'] : fill(T.why['case-diff'], { n: 2 * Math.min(a, b) });
          return [chalkCard({ nums: story.board.nums, marks: first.map((id) => firstChips.findIndex((chip) => chip.id === id)) }, sumNote(start)), chalkCard({ nums: next.chips.map((chip) => chip.value), places: next.chips.map((chip) => chip.slot), slots: story.board.nums.length, ring: next.chips.findIndex((chip) => chip.id === next.fresh) }, note)];
        },
      },
      {
        say: endSay(rule, story.board, start, final),
        cards: () => [chalkCard({ nums: story.board.nums }, sumNote(start)), chalkCard({ nums: [final] }, leftNote(final))],
      },
      {
        say: T.why[`${rule}-name`],
        cards: () => {
          if (rule === 'less') return [chalkCard({ nums: [1, 2, 3], marks: [0, 1] }, leftNote(2)), chalkCard({ nums: [1, 2, 3], marks: [0, 2] }, leftNote(0))];
          if (rule === 'same') return [chalkCard({ nums: [2, 4], marks: [0, 1] }, sumNote(6)), chalkCard({ nums: [1] }, sumNote(1))];
          return [chalkCard({ nums: [2, 4], marks: [0, 1] }, sumNote(6)), chalkCard({ nums: [2] }, leftNote(2))];
        },
      },
    ];
    return pages.map((page) => ({
      say: page.say,
      // 그림은 종이를 펼칠 때 그린다
      get nodes() {
        return [rowOf(page.cards())];
      },
    }));
  }

  function endSay(rule, board, start, final) {
    if (rule === 'same') return fill(byEnd(T.why, 'same-end', final), { face: faceOf(start % 2), k: final });
    if (rule === 'less') return fill(byEnd(T.why, 'less-end', final), { n: board.nums.length, f: board.nums.length - 1, total: start, k: final });
    return T.why[start % 2 === 1 ? 'diff-end-odd' : 'diff-end-even'];
  }

  const startChipsOf = (board) => board.nums.map((value, id) => ({ id, value }));

  // ---- 직접 만들기: 규칙을 고르고 숫자판으로 수를 적는다. 칠판의 수를 누르면 빠진다 ----
  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    return draftOk(saved) ? copyBoard(saved) : copyBoard(FIRST_DRAFT);
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    typingMade = '';
    made = null;
    for (const button of $('erase-make-rule').querySelectorAll('[data-rule]')) button.textContent = T.ruleNames[button.dataset.rule];
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function drawMake() {
    for (const button of $('erase-make-rule').querySelectorAll('[data-rule]')) button.setAttribute('aria-pressed', String(button.dataset.rule === draft.rule));
    $('erase-make-shown').textContent = typingMade;
    $('erase-make-shown').setAttribute('aria-label', typingMade ? fill(T.labels.shown, { k: typingMade }) : T.labels['shown-empty']);
    $('erase-make-clear').disabled = draft.nums.length === 0;
    const chips = draft.nums.map((value, id) => ({ id, value }));
    drawChalk($('erase-make-board'), {
      chips,
      onChip: removeChip,
      labels: { board: fill(T.labels.board, { n: chips.length }), chip: (chip, index) => fill(T.labels.chip, { no: ordinal(index + 1), k: chip.value }) },
    });
    $('erase-make-result').textContent = made ? made.line : '';
    $('erase-make-picture').replaceChildren(...(made?.node ? [made.node] : []));
    $('erase-make-play').disabled = madeBoard() === null;
  }

  function changeDraft(next) {
    // 선생님이 맞혀 본 뒤에 칠판을 고치면, 앞의 칠판에 한 말이 남지 않게 칠판이 바뀌었다는 사실만 말한다
    const said = made !== null;
    draft = next;
    made = null;
    log.saveDraft(draft, FORMAT);
    drawMake();
    if (said) frame.talkers.make.say(T.make.changed);
  }

  /** 칠판에 적을 수 없는 까닭(없으면 null) */
  function addProblem(value) {
    if (value > MAX_VALUE) return fill(T.make['too-big'], { n: MAX_VALUE });
    if (draft.rule === 'same' && value > 1) return T.make.only01;
    if (draft.rule === 'less' && value === 0) return T.make['no-zero'];
    if (draft.rule === 'diff' && draft.nums.length >= SEARCH_CHIPS) return fill(T.make['diff-many'], { n: SEARCH_CHIPS });
    if (draft.nums.length >= MAKE_MAX) return fill(T.make.full, { n: MAKE_MAX });
    return null;
  }

  function pressMakeKey(key) {
    if (key === 'erase') typingMade = typingMade.slice(0, -1);
    else if (key === 'enter') {
      if (typingMade === '') {
        frame.talkers.make.say(T.make.nothing);
        return;
      }
      const value = Number(typingMade);
      const problem = addProblem(value);
      typingMade = '';
      if (problem) {
        drawMake();
        frame.talkers.make.say(problem);
        return;
      }
      changeDraft({ rule: draft.rule, nums: [...draft.nums, value] });
      return;
    } else if (/^[0-9]$/.test(key)) {
      if (typingMade.length >= MAKE_DIGITS) return;
      typingMade = typingMade === '0' ? key : typingMade + key;
    }
    drawMake();
  }

  function removeChip(id) {
    changeDraft({ rule: draft.rule, nums: draft.nums.filter((_, index) => index !== id) });
  }

  function pickRule(rule) {
    if (rule === draft.rule) return;
    changeDraft({ rule, nums: draft.nums.slice() });
  }

  /** 다 만든 칠판이 아닌 까닭(없으면 null): 수가 모자람, 규칙에 맞지 않는 수, 차를 쓰는 칠판의 수가 너무 많음 */
  function draftProblem(board) {
    if (board.nums.length < 2) return T.make.few;
    if (board.rule === 'same' && board.nums.some((value) => value > 1)) return T.make.only01;
    if (board.rule === 'less' && board.nums.includes(0)) return T.make['no-zero'];
    if (board.rule === 'diff' && board.nums.length > SEARCH_CHIPS) return fill(T.make['diff-many'], { n: SEARCH_CHIPS });
    return null;
  }

  /** 아이가 만든 칠판을 선생님이 맞혀 본다: 끝에 남는 수, 또는 남길 수 있는 수와 0을 남길 수 있는지 */
  function solveDraft() {
    const board = copyBoard(draft);
    const problem = draftProblem(board);
    if (problem) {
      made = { line: problem, node: null };
      drawMake();
      frame.talkers.make.say(problem);
      return;
    }
    const result = solveOnce(board);
    const { finals } = result;
    const lines = [];
    if (finals.length === 1) lines.push(fill(byEnd(T.make, 'fixed', finals[0]), { k: finals[0] }));
    else {
      lines.push(fill(byEnd(T.make, 'finals', finals.at(-1)), { k: finals.join(', '), face: faceOf(result.parity) }));
      lines.push(result.zero ? T.make['zero-yes'] : result.parity === 1 ? T.make['zero-odd'] : T.make['zero-tried']);
    }
    const line = lines.join(' ');
    made = { line, node: chalkCard({ nums: finals }, T.make[finals.length > 1 ? 'picture-many' : 'picture']) };
    drawMake();
    const stamp = new Date().toISOString();
    log.saveRecord({
      kind: 'made',
      v: 1,
      id: log.newId('m'),
      format: FORMAT,
      startedAt: stamp,
      endedAt: stamp,
      board,
      solution: { final: result.final, finals, parity: result.parity, zero: result.zero, sum: result.sum },
    });
    log.flush();
    frame.talkers.make.say(line);
  }

  /** 다 만든 칠판(공책에 남기거나 해 볼 칠판). 아직 지울 수 없거나 규칙에 맞지 않는 수가 있으면 null */
  function madeBoard() {
    if (!draft || checkBoard(draft) !== null || draftProblem(draft) !== null) return null;
    return copyBoard(draft);
  }

  function playDraft() {
    const board = madeBoard();
    if (!board) {
      frame.talkers.make.say(draftProblem(draft) ?? T.make['keep-not-yet']);
      return;
    }
    frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board });
  }

  // ---- 단추 잇기 ----
  for (const key of $('erase-keys').querySelectorAll('[data-key]')) key.addEventListener('click', () => pressKey(key.dataset.key));
  $('erase-odd').addEventListener('click', () => choose('odd'));
  $('erase-even').addEventListener('click', () => choose('even'));
  $('erase-impossible').addEventListener('click', sayImpossible);
  $('erase-open').addEventListener('click', openEarly);
  $('erase-again').addEventListener('click', again);
  $('erase-sum').addEventListener('click', toggleSum);
  for (const button of $('erase-make-rule').querySelectorAll('[data-rule]')) button.addEventListener('click', () => pickRule(button.dataset.rule));
  for (const key of $('erase-make-keys').querySelectorAll('[data-key]')) key.addEventListener('click', () => pressMakeKey(key.dataset.key));
  $('erase-make-clear').addEventListener('click', () => changeDraft({ rule: draft.rule, nums: [] }));
  $('erase-make-solve').addEventListener('click', solveDraft);
  $('erase-make-play').addEventListener('click', playDraft);

  /** 판의 처음 값(새 판, 공책의 그림) */
  function begin({ level, custom, board }) {
    return {
      mode: custom ? 'made' : rungOf(level).mode,
      board: copyBoard(board), // 판: 규칙, 칠판의 수들
      trail: [], // 지금 지우고 있는 차례([먼저 누른 수의 이름, 나중에 누른 수의 이름])
      ends: [], // 다 지운 것들 { trail, final }
      guess: null, // 내 쪽지에 적은 것(수, 또는 'odd'와 'even')
      opened: false, // 선생님 쪽지를 열었는가
      early: false, // 다 지우지 않고 쪽지를 열었는가
      moveCount: 0, // 지운 수(무르고 되돌리기 전의 것까지 모두)
      undoCount: 0,
      resetCount: 0,
      againCount: 0, // "다른 차례로 한 번 더"를 누른 수
      endCount: 0, // 0을 남길 수 있을까에서 0이 아닌 수가 남은 수
      impossibleCount: 0, // 0을 남길 수 있는 칠판에 "불가능해요"를 누른 수
      wrongCount: 0, // 사실과 다른 답의 수(선생님 쪽지와 다른 내 쪽지, 남길 수 있는 칠판의 "불가능해요")
      sumOn: false, // 지금 "합 보기"를 켜 두었는가
      sumShown: false, // 한 번이라도 켰는가
      sumCount: 0, // 켠 수
    };
  }

  /** 적어 둔 판의 단계가 판의 종류와 맞는가 */
  const levelOk = (saved) => {
    if (saved.custom === true) return saved.level === MAKE_LEVEL && saved.mode === 'made';
    if (!Number.isInteger(saved.level) || saved.level < LADDER[0].level || saved.level > TOP_LEVEL) return false;
    return rungOf(saved.level).mode === saved.mode;
  };

  const guessOk = (guess) => guess === null || guess === 'odd' || guess === 'even' || count(guess);

  return {
    id: FORMAT,
    T,
    padId: 'erase-pad',
    makeId: 'make-erase',
    // 쪽지와 칠판이 위아래로 놓인다. 규칙 글은 왼쪽 칸 맨 위에 두고 칠판을 크게 그린다(수가 스무 개여도 카드가 44픽셀보다 작아지지 않게)
    ruleAside: true,
    homeIds: { sample: 'home-erase-sample', blank: 'home-erase-blank', ask: 'home-erase-ask', play: 'home-erase-play', pick: 'home-erase-pick', make: 'home-erase-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    begin,
    solve: (round) => {
      const result = solveOnce(round.board);
      // 0을 남길 수 있을까에서만 안 되는 칠판이 있다. 다른 물음은 늘 끝까지 지울 수 있다
      return { ...result, possible: round.mode === 'zero' ? result.zero === true : true };
    },
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (!MODES.includes(saved.mode) || checkBoard(saved.board) !== null || !levelOk(saved)) return false;
      if (!replay(saved.board, saved.trail).ok) return false;
      if (!Array.isArray(saved.ends) || !saved.ends.every((item) => item && replay(saved.board, item.trail).chips.length === 1 && Number.isInteger(item.final))) return false;
      if (!guessOk(saved.guess)) return false;
      if (![saved.moveCount, saved.undoCount, saved.resetCount, saved.againCount, saved.endCount, saved.impossibleCount, saved.wrongCount, saved.sumCount].every(count)) return false;
      return [saved.opened, saved.early, saved.sumOn, saved.sumShown].every((value) => typeof value === 'boolean');
    },
    /** 판 화면에서 이 형식의 것(판, 판 아래의 글, 왼쪽 칸의 도구)을 보이거나 감춘다 */
    showParts(on) {
      $('erase-board').hidden = !on;
      $('erase-count').hidden = !on;
      $('erase-sum').hidden = !on;
      if (on) {
        // 앞의 형식이 감춰 둔 무르기와 되돌리기를 여기서 다시 보이게 한다.
        $('undo').hidden = false;
        $('reset').hidden = false;
      }
    },
    enter() {
      picked = null;
      typing = '';
      flash = null;
    },
    draw,
    ended() {
      picked = null;
      typing = '';
      flash = null;
    },
    ruleLine: (round) => `${T.rules[round.board.rule]} ${T.asks[askOf(round)]}`,
    hints: (round) => T.hints[round.mode],
    touched: (round) => round.trail.length > 0 || round.moveCount > 0 || round.guess !== null || round.sumCount > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view(round) {
      const state = now(round);
      return { chips: state.chips.map((chip) => chip.value).join(','), erased: round.trail.length, ends: round.ends.map((item) => item.final), guess: round.guess, picked, sumOn: round.sumOn };
    },
    /** 이 판보다 작은 판: 같은 규칙과 같은 물음의 수가 적은 칠판(0을 남길 수 없는 칠판에서는 남길 수 없는 작은 칠판도) */
    smaller: (round, turn) => smallerErase({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      const state = now(round);
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        solution: { possible: solution.possible, final: solution.final, finals: solution.finals, parity: solution.parity, zero: solution.zero, sum: solution.sum },
        // 질문 힌트와 "합 보기"를 함께 센다.
        hintsOpened: round.hintsOpened + (round.sumShown ? 1 : 0),
        sumShown: round.sumShown,
        sumCount: round.sumCount,
        // 판을 떠날 때의 차례와 칠판, 다 지운 것들, 내 쪽지
        trail: round.trail,
        chips: state.chips.map((chip) => chip.value).join(','),
        ends: round.ends,
        guess: round.guess,
        opened: round.opened,
        early: round.early,
        moveCount: round.moveCount,
        undoCount: round.undoCount,
        resetCount: round.resetCount,
        againCount: round.againCount,
        endCount: round.endCount,
        impossibleCount: round.impossibleCount,
        // 수준 맞추기가 보는 "틀린 답"의 수
        wrongCount: round.wrongCount,
      };
    },
    rightLine,
    whyPages,
    solutionPages,
    undo,
    reset,
    /** 글자판: 내 쪽지에 적는 동안 숫자, Enter(적기), 지우기 글쇠. Escape는 고른 수를 놓는다 */
    onKey(event) {
      if ($('erase-pad').hidden) return;
      const { round } = frame;
      if (event.key === 'Escape' && picked !== null) {
        picked = null;
        draw();
        return;
      }
      if (!round || askOf(round) !== 'number' || round.guess !== null) return;
      if (/^[0-9]$/.test(event.key)) pressKey(event.key);
      else if (event.key === 'Enter') {
        event.preventDefault?.();
        pressKey('enter');
      } else if (event.key === 'Backspace' || event.key === 'Delete') pressKey('erase');
    },

    // ---- 처음 화면에 그리는 그림 ----
    homeAsk: (level) => T.home.ask[rungOf(level).mode],
    pickLine: () => T.home.pick,
    drawSample(root, board) {
      drawMini(root, { nums: board.nums });
    },
    drawBlank(root) {
      drawMini(root, { nums: BLANK });
    },
    /** 하던 판과 공책의 그림: 지금 칠판 */
    drawResume(root, saved) {
      const state = replay(saved.board, saved.trail);
      drawMini(root, { nums: (state.ok ? state.chips : replay(saved.board, []).chips).map((chip) => chip.value) });
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 판 하나 */
    drawLevelPicture(root, entry) {
      if (entry.picture.blank) {
        drawMini(root, { nums: BLANK });
        return;
      }
      drawMini(root, { nums: generateBoard(entry.level, entry.picture.seed).board.nums });
    },
    showMake,
    /** 직접 만들기에서 다 만든 칠판(공책에 남기기가 쓴다) */
    madeBoard,
  };
}
