// 부호 넣어 수 만들기: 판 화면에서 이 형식이 맡는 부분(수의 줄과 부호 칸, 띠, 메뚜기의 수직선, 답하는 칸, 끝났을 때 하는 말, 풀이와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/signs.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 줄: n부터 1까지의 수 사이의 부호 칸을 누르면 +와 −가 바뀐다(처음에는 모두 +). 맨 앞의 수 앞에는 부호가 없다. 줄 끝에 지금 나온 수를 늘 적는다.
//   목표 수가 나오면 끝난다. 안 되는 판은 "불가능해요"로 답한다. 되는 판에 누르면 틀렸다고 하지 않고 되는 판이라는 사실만 말하고 판은 그대로 이어진다.
// 모두 찾기: 줄 아래의 띠(1부터 끝 수까지)에서 만들 수 없을 것 같은 수를 눌러 고르고 "다 골랐어요"를 누른다. 고른 것이 만들 수 없는 수와 꼭 같으면 끝난다.
//   다르면 수 하나만 짚어 사실을 말한다(고른 수 가운데 만들 수 있는 수, 없으면 고르지 않은 수 가운데 만들 수 없는 수). 줄에서 나온 수는 띠에 점이 찍힌다.
// 메뚜기: 오른쪽 칸의 단추로 1칸, 2칸, …을 차례로 왼쪽이나 오른쪽으로 뛴다. n번 다 뛰었을 때 닿을 곳에 있으면 끝난다. 무르기는 한 걸음을 무른다.
// 가장 큰 수: 줄은 마음대로 바꿔 보고, 답은 자물쇠에 넣는다. 맞으면 열리고 끝난다. 다르면 넣은 수에 대한 사실만 말하고 몇 번이든 다시 넣는다.
// 왼쪽 칸의 "모두 +일 때 보기"(메뚜기는 "모두 오른쪽일 때 보기")를 켜면 판 아래에 모두 +일 때의 수를 적고,
//   부호를 바꿀 때마다(뛸 때마다) 얼마만큼 바뀌었는지를 판 아래에 적는다. 무엇이 그대로인지는 말하지 않는다. 처음 켤 때 힌트 하나로 센다.
import T from '../content/signs.json';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf, solveOnce } from '../core/signs-ladder.js';
import { MAKE_EXTRA, MAX_N, MIN_N, checkBoard, copyBoard, hopPosition, numberAfter, numbersOf, plusSigns, replay, rowReach, rowValue, totalOf } from '../core/signs.js';
import { smallerSigns } from '../core/smaller.js';
import { fill } from '../core/text.js';
import { drawLine, drawRow, drawStrip, lineCard, rowCard, signed, stripCard } from '../ui/signs-board.js';

const FORMAT = 'signs';
const MODES = ['five', 'seven', 'all', 'hop', 'largest', 'made'];
/** 직접 만들기의 처음 판: 5부터 1까지, 목표 수 7 */
const FIRST_DRAFT = { kind: 'row', n: 5, target: 7 };
/** 자물쇠에 넣을 수 있는 자릿수 */
const TYPE_LIMIT = 2;

const count = (value) => Number.isInteger(value) && value >= 0;

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createSigns(frame) {
  const { $, log } = frame;
  let flash = null; // 판 아래에 잠깐 적는 한 줄. 다음에 무엇을 누르면 지운다
  let changed = null; // 방금 바꾼 부호 칸(굵은 밑줄)
  let pointed = null; // 선생님이 띠에서 짚은 수(점선 고리). 다음에 무엇을 누르면 지운다
  let draft = null; // 직접 만들기에서 만들던 판
  let made = null; // 직접 만들기에서 선생님이 따진 것(판을 고치면 지운다)

  const isHop = (round) => round.board.kind === 'hop';
  const hasRow = (round) => !isHop(round);
  const stateOf = (round) => replay(round.board, round.trail);
  const valueOf = (round) => rowValue(round.board.n, stateOf(round).signs);
  const hasImpossible = (round) => round.board.kind === 'row' || isHop(round);
  const isLock = (round) => round.board.kind === 'largest';

  /** 읽어 주는 이름 */
  const rowLabels = (n) => ({
    slot: (at, sign) => fill(T.labels.slot, { n: numberAfter(n, at), face: T.faces[sign === '-' ? 'minus' : 'plus'] }),
    result: (value) => fill(T.labels.result, { face: signed(value) }),
  });
  const cellLabel = (no, picked, seen) => fill(T.labels.cell, { n: no, face: [picked ? T.labels.marked : T.labels.plain, ...(seen ? [T.labels.made] : [])].join(', ') });

  // ---- 판 ----
  function draw() {
    const { round } = frame;
    const { board } = round;
    const playing = !round.done;
    const state = stateOf(round);
    const root = $('signs-board');
    root.replaceChildren();
    if (hasRow(round)) {
      const box = document.createElement('div');
      box.className = 'sg-row-box';
      drawRow(box, {
        numbers: numbersOf(board.n),
        signs: state.signs,
        result: rowValue(board.n, state.signs),
        faces: T.faces,
        label: rowLabels(board.n),
        onSlot: playing ? toggle : undefined,
        changed,
      });
      root.append(box);
    }
    if (board.kind === 'all') {
      const box = document.createElement('div');
      box.className = 'sg-strip-box';
      // 끝난 판에서는 만들 수 없는 수를 모두 고른 모습을 보인다
      drawStrip(box, { top: board.top, marked: state.marks, made: madeIn(round), pointed, label: cellLabel, onCell: playing ? mark : undefined });
      root.append(box);
    }
    if (isHop(round)) {
      const box = document.createElement('div');
      drawLine(box, { n: board.n, target: board.target, dirs: state.dirs, label: fill(T.labels.line, { face: signed(hopPosition(state.dirs)) }) });
      root.append(box);
    }
    changed = null;

    // 판 아래: 지금 나온 수(메뚜기는 지금 자리와 뛴 횟수), 도구를 켜면 모두 +일 때의 수
    $('signs-row-numbers').hidden = !hasRow(round);
    $('signs-hop-numbers').hidden = hasRow(round);
    $('signs-marked-line').hidden = board.kind !== 'all';
    if (hasRow(round)) $('signs-value').textContent = signed(valueOf(round));
    else {
      $('signs-pos').textContent = signed(hopPosition(state.dirs));
      $('signs-jumps').textContent = String(state.dirs.length);
    }
    if (board.kind === 'all') $('signs-marked').textContent = String(state.marks.length);
    const tool = playing && round.toolOn;
    $('signs-tool-line').hidden = !tool;
    $('signs-tool-name').textContent = T.tool[isHop(round) ? 'name-hop' : 'name'];
    $('signs-total').textContent = String(totalOf(board.n));
    $('signs-status').textContent = flash ?? statusOf(round, state);
    $('undo').disabled = !playing || round.trail.length === 0;
    $('reset').disabled = !playing || round.trail.length === 0;

    drawPad(round, state, playing);
    // 도구: 끝난 판에서는 꺼져 있다
    $('signs-plus').textContent = T.tool[`${tool ? 'on' : 'off'}${isHop(round) ? '-hop' : ''}`];
    $('signs-plus').setAttribute('aria-pressed', String(tool));
    $('signs-plus').disabled = round.done;
    frame.showWhy();
  }

  /** 오른쪽 칸: 목표 수(닿을 곳), 누르는 법, 띠의 "다 골랐어요", 메뚜기의 두 단추, 자물쇠, "불가능해요" */
  function drawPad(round, state, playing) {
    const { board } = round;
    const targeted = board.kind === 'row' || isHop(round);
    $('signs-target-line').hidden = !targeted;
    if (targeted) {
      $('signs-target-name').textContent = T.pad[isHop(round) ? 'spot' : 'target'];
      $('signs-target').textContent = signed(board.target);
    }
    $('signs-row-note').hidden = !hasRow(round);
    $('signs-all-box').hidden = board.kind !== 'all';
    $('signs-submit').disabled = !playing || state.marks.length === 0;
    $('signs-hop-box').hidden = !isHop(round);
    if (isHop(round)) {
      const next = state.dirs.length + 1;
      const open = playing && next <= board.n;
      $('signs-jump').textContent = String(Math.min(next, board.n));
      $('signs-jump-line').hidden = next > board.n;
      $('signs-left').disabled = !open;
      $('signs-right').disabled = !open;
    }
    $('signs-lock-box').hidden = !isLock(round);
    if (isLock(round)) {
      $('signs-lock').classList.toggle('open', round.done);
      $('signs-ask').textContent = round.done ? T.lock.opened : T.lock.ask;
      $('signs-typed').textContent = round.typed;
      for (const key of $('signs-keys').querySelectorAll('button')) {
        key.disabled = !playing || (key.dataset.n === 'erase' ? round.typed === '' : round.typed.length >= TYPE_LIMIT);
      }
      $('signs-open').disabled = !playing || round.typed === '';
    }
    $('signs-maybe').hidden = !hasImpossible(round);
    $('signs-impossible').disabled = !playing;
  }

  function statusOf(round, state) {
    const { board } = round;
    if (round.done) {
      const last = round.answers.at(-1)?.answer;
      if (last === 'impossible') return T.status['said-no'];
      if (board.kind === 'all') return T.status['all-done'];
      if (isLock(round)) return T.status['largest-done'];
      return T.status[isHop(round) ? 'hop-done' : 'done'];
    }
    if (isHop(round)) {
      if (state.dirs.length === board.n) return fill(T.status['hop-end'], { n: board.n, face: signed(hopPosition(state.dirs)) });
      if (round.toolOn && state.dirs.length === 0) return T.status['tool-hop'];
      return state.dirs.length === 0 ? T.status['hop-start'] : fill(T.status['hop-next'], { n: state.dirs.length + 1 });
    }
    if (round.toolOn) return T.status.tool;
    if (board.kind === 'all' && state.marks.length === 0) return T.status['all-start'];
    return round.trail.length === 0 ? T.status.start : '';
  }

  /** 줄에서 나온 수 가운데 띠에 있는 수(점) */
  function madeIn(round) {
    const { top } = round.board;
    return round.seen.filter((value) => value >= 1 && value <= top);
  }

  /** 줄에서 나온 수를 적어 둔다(같은 수는 한 번) */
  function see(round, value) {
    if (!round.seen.includes(value)) round.seen = [...round.seen, value];
  }

  // ---- 부호 칸 ----
  function toggle(at) {
    const { round } = frame;
    if (!round || round.done || !hasRow(round)) return;
    const { n } = round.board;
    if (!Number.isInteger(at) || at < 0 || at >= n - 1) return;
    const before = stateOf(round).signs[at];
    round.trail = [...round.trail, `s${at}`];
    round.moveCount += 1;
    changed = at;
    pointed = null;
    const value = valueOf(round);
    see(round, value);
    frame.note('sign', { at, sign: before === '+' ? '-' : '+', value });
    // 도구를 켜 두었으면 얼마만큼 바뀌었는지 적는다
    const k = 2 * numberAfter(n, at);
    flash = round.toolOn ? fill(T.status[before === '+' ? 'minus' : 'plus'], { n: numberAfter(n, at), k }) : null;
    if (round.board.kind === 'row' && value === round.board.target) {
      round.answers.push({ t: frame.stamp(), answer: 'done', correct: true, guess: null });
      frame.note('answer', { answer: 'done', correct: true });
      flash = null;
      frame.finish('solved');
      return;
    }
    draw();
    frame.persist();
  }

  // ---- 띠: 만들 수 없는 수 고르기 ----
  function mark(no) {
    const { round } = frame;
    if (!round || round.done || round.board.kind !== 'all') return;
    if (!Number.isInteger(no) || no < 1 || no > round.board.top) return;
    round.trail = [...round.trail, `m${no}`];
    round.markCount += 1;
    flash = null;
    pointed = null;
    frame.note('mark', { no, on: stateOf(round).marks.includes(no) });
    draw();
    frame.persist();
  }

  /** "다 골랐어요": 고른 수가 만들 수 없는 수와 꼭 같으면 끝난다. 다르면 수 하나만 짚어 사실을 말한다 */
  function submit() {
    const { round, solution } = frame;
    if (!round || round.done || round.board.kind !== 'all') return;
    const marks = stateOf(round).marks;
    if (marks.length === 0) return;
    const truth = new Set(solution.impossible);
    const extra = marks.filter((no) => !truth.has(no));
    const missed = solution.impossible.filter((no) => !marks.includes(no));
    const correct = extra.length === 0 && missed.length === 0;
    const guess = correct ? null : extra.length > 0 ? 'extra' : 'missed';
    round.submitCount += 1;
    round.answers.push({ t: frame.stamp(), answer: `marks:${marks.join(',')}`, correct, guess });
    frame.note('answer', { answer: marks.join(','), correct, guess });
    if (correct) {
      frame.finish('solved');
      return;
    }
    round.wrongCount += 1;
    flash = null;
    let line;
    if (extra.length > 0) {
      pointed = extra[0];
      line = fill(T.play[round.seen.includes(pointed) ? 'extra-seen' : 'extra'], { n: pointed });
    } else {
      pointed = missed[0];
      line = fill(T.play.missed, { n: pointed });
    }
    draw();
    frame.persist();
    frame.say(line);
  }

  // ---- 메뚜기 ----
  function jump(dir) {
    const { round } = frame;
    if (!round || round.done || !isHop(round)) return;
    const { board } = round;
    const before = stateOf(round).dirs;
    if (before.length >= board.n) return;
    const k = before.length + 1;
    round.trail = [...round.trail, dir > 0 ? 'r' : 'l'];
    round.moveCount += 1;
    pointed = null;
    const dirs = stateOf(round).dirs;
    const at = hopPosition(dirs);
    frame.note('jump', { k, dir, at });
    flash = round.toolOn ? (dir > 0 ? fill(T.status.right, { n: k }) : fill(T.status.left, { n: k, k: 2 * k })) : null;
    if (dirs.length === board.n && at === board.target) {
      round.answers.push({ t: frame.stamp(), answer: 'done', correct: true, guess: null });
      frame.note('answer', { answer: 'done', correct: true });
      flash = null;
      frame.finish('solved');
      return;
    }
    if (dirs.length === board.n) {
      round.landCount += 1;
      flash = null;
    }
    draw();
    frame.persist();
    if (dirs.length === board.n) frame.say(T.play['hop-end']);
  }

  function undo() {
    const { round } = frame;
    if (round.done || round.trail.length === 0) return;
    const last = round.trail.at(-1);
    round.trail = round.trail.slice(0, -1);
    round.undoCount += 1;
    changed = last.startsWith('s') ? Number(last.slice(1)) : null;
    flash = null;
    pointed = null;
    frame.note('undo');
    draw();
    frame.persist();
    // 앞의 모습에 한 말(되는 판이라는 말, 다 뛰었다는 말, 띠에서 짚은 수)은 이제 맞지 않을 수 있으니 덮는다
    frame.say(T.play.undo);
  }

  function reset() {
    const { round } = frame;
    if (round.done || round.trail.length === 0) return;
    round.trail = [];
    round.resetCount += 1;
    changed = null;
    flash = null;
    pointed = null;
    frame.note('reset');
    draw();
    frame.persist();
    frame.say(T.play.reset);
  }

  /** "불가능해요". 되는 판이면 틀렸다고 하지 않고 되는 판이라는 사실만 말한다. 판은 그대로 이어진다 */
  function sayImpossible() {
    const { round, solution } = frame;
    if (!round || round.done || !hasImpossible(round)) return;
    const correct = solution.possible === false;
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
    const untried = round.moveCount === 0;
    if (isHop(round)) frame.say(T.play[untried ? 'hop-press-untried' : 'hop-press']);
    else frame.say(T.play[untried ? 'possible-press-untried' : 'possible-press']);
  }

  // ---- 자물쇠 ----
  function press(key) {
    const { round } = frame;
    if (!round || round.done || !isLock(round)) return;
    if (key === 'erase') round.typed = round.typed.slice(0, -1);
    else if (/^\d$/.test(key) && round.typed.length < TYPE_LIMIT) round.typed = round.typed === '0' ? key : round.typed + key;
    else return;
    draw();
    frame.persist();
  }

  /** "열어 보기": 넣은 수가 만들 수 없는 가장 큰 수이면 열린다. 다르면 넣은 수에 대한 사실만 말하고 그대로 잠겨 있다 */
  function openLock() {
    const { round, solution } = frame;
    if (!round || round.done || !isLock(round) || round.typed === '') return;
    const value = Number(round.typed);
    const { total, answer } = solution;
    const correct = value === answer;
    const reach = rowReach(round.board.n);
    const guess = correct ? null : value > total ? 'over' : value === total ? 'top' : reach.has(value) ? 'can' : 'lower';
    round.typed = '';
    round.tryCount += 1;
    round.answers.push({ t: frame.stamp(), answer: `lock:${value}`, correct, guess });
    frame.note('answer', { answer: value, correct, guess });
    flash = null;
    if (correct) {
      frame.finish('solved');
      return;
    }
    round.wrongCount += 1;
    draw();
    frame.persist();
    frame.say(T.play[guess]);
  }

  // ---- 도구: 모두 +일 때 보기 ----
  function toggleTool() {
    const { round } = frame;
    if (!round || round.done) return;
    round.toolOn = !round.toolOn;
    if (round.toolOn) {
      round.toolShown = true;
      round.toolCount += 1;
    }
    flash = null;
    frame.note('plus-tool', { on: round.toolOn });
    draw();
    frame.keep();
  }

  // ---- 끝났을 때 하는 말: 한 일과 사실만 말한다 ----
  function rightLine(round, solution) {
    const { board } = round;
    const parts = [];
    const said = round.answers.at(-1)?.answer === 'impossible';
    if (said) {
      const tried = round.moveCount > 0;
      if (isHop(round)) {
        parts.push(tried ? fill(T.right['hop-impossible-tried'], { k: round.moveCount }) : T.right['hop-impossible-untried']);
        parts.push(solution.reason === 'big' ? T.right['hop-reason-big'] : fill(T.right['hop-reason-parity'], { k: solution.total }));
      } else {
        parts.push(tried ? fill(T.right['impossible-tried'], { k: round.moveCount }) : T.right['impossible-untried']);
        parts.push(solution.reason === 'big' ? T.right['reason-big'] : fill(T.right['reason-parity'], { k: solution.total }));
      }
      return parts;
    }
    if (board.kind === 'row') {
      parts.push(fill(T.right.done, { k: round.trail.length }));
      parts.push(solution.ways === 1 ? T.right['ways-one'] : fill(T.right.ways, { k: solution.ways }));
      if (round.impossibleCount > 0) parts.push(T.right['after-press']);
      return parts;
    }
    if (isHop(round)) {
      const left = stateOf(round).dirs.filter((dir) => dir < 0).length;
      parts.push(fill(T.right['hop-done'], { k: left }));
      parts.push(solution.ways === 1 ? T.right['hop-ways-one'] : fill(T.right['hop-ways'], { k: solution.ways }));
      if (round.impossibleCount > 0) parts.push(T.right['hop-after-press']);
      return parts;
    }
    if (board.kind === 'all') {
      parts.push(fill(T.right.all, { k: solution.impossible.length }));
      if (round.submitCount > 1) parts.push(fill(T.right['all-tries'], { f: round.submitCount }));
      if (board.top > solution.total) parts.push(T.right['all-big']);
      return parts;
    }
    parts.push(T.right.largest);
    if (round.tryCount > 1) parts.push(fill(T.right['largest-tries'], { f: round.tryCount }));
    return parts;
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----
  function rowOf(cards) {
    const row = document.createElement('div');
    row.className = 'figure-row';
    row.append(...cards);
    return row;
  }

  const rowView = (n, signs) => ({ numbers: numbersOf(n), signs, result: rowValue(n, signs) });

  /** 풀이: 되는 판은 한 가지 방법, 안 되는 판은 까닭, 모두 찾기는 띠, 가장 큰 수는 모두 +와 1 앞만 −인 줄 */
  function solutionPages(round, solution) {
    const { board } = round;
    const { n } = board;
    if (board.kind === 'row') {
      if (!solution.possible) return [{ say: T.solution[solution.reason === 'big' ? 'row-big' : 'row-parity'], nodes: [rowOf([rowCard(rowView(n, plusSigns(n)), T.faces, T.solution.start, { big: true })])] }];
      return [{ say: solution.ways === 1 ? T.solution['row-one'] : fill(T.solution.row, { k: solution.ways }), nodes: [rowOf([rowCard(rowView(n, solution.signs), T.faces, T.solution.way, { big: true })])] }];
    }
    if (isHop(round)) {
      if (!solution.possible) return [{ say: T.solution[solution.reason === 'big' ? 'hop-big' : 'hop-parity'], nodes: [rowOf([lineCard({ n, target: board.target, dirs: [] }, T.solution.start, { big: true })])] }];
      return [{ say: solution.ways === 1 ? T.solution['hop-one'] : fill(T.solution.hop, { k: solution.ways }), nodes: [rowOf([lineCard({ n, target: board.target, dirs: solution.dirs }, T.solution['hop-way'], { big: true })])] }];
    }
    if (board.kind === 'all') {
      return [{ say: fill(T.solution.all, { k: solution.impossible.length }), nodes: [rowOf([stripCard({ top: board.top, marked: solution.impossible, made: solution.reachable }, T.solution.strip, { big: true })])] }];
    }
    const minus = plusSigns(n).map((sign, at) => (at === n - 2 ? '-' : sign));
    return [{ say: T.solution.largest, nodes: [rowOf([rowCard(rowView(n, plusSigns(n)), T.faces, T.solution['all-plus']), rowCard(rowView(n, minus), T.faces, T.solution['one-minus'])])] }];
  }

  /** "왜 그럴까?"의 그림 하나 */
  function figureOf(item) {
    if (item.hop) return lineCard({ n: item.hop, target: 0, dirs: item.dirs }, item.note);
    const signs = [...item.signs];
    let result = item.numbers[0];
    item.numbers.slice(1).forEach((value, index) => {
      result += signs[index] === '-' ? -value : value;
    });
    return rowCard({ numbers: item.numbers, signs, result }, T.faces, item.note);
  }

  /**
   * "왜 그럴까?": 나온 수를 적어 보니 8도 10도 안 나왔다 → +를 −로 바꾸면 그 수의 두 배만큼 작아진다 → 그래서 8에는 닿지 않는다, 메뚜기도 같다
   * → 이름(홀수, 짝수, 바뀌지 않는 것) → 1, 2, 3, 4, 5 차례로 쓰면 홀짝이 맞아도 안 되는 수(13)가 있다.
   * 이 형식의 안 되는 판(모두 찾기와 가장 큰 수도)을 한 번 끝까지 만난 뒤에 열린다(틀의 기본 문).
   */
  function whyPages() {
    return T.why.map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다
      get nodes() {
        return [rowOf(slide.figures.map(figureOf))];
      },
    }));
  }

  // ---- 직접 만들기: 맨 앞의 수와 목표 수를 정한다 ----
  const makeTop = (n) => totalOf(n) + MAKE_EXTRA;

  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    return saved && saved.kind === 'row' && checkBoard(saved) === null ? copyBoard(saved) : { ...FIRST_DRAFT };
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    made = null;
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function drawMake() {
    const { n, target } = draft;
    $('signs-make-n').textContent = fill(T.make.size, { n });
    $('signs-make-n-fewer').disabled = n <= MIN_N;
    $('signs-make-n-more').disabled = n >= MAX_N;
    $('signs-make-target').textContent = fill(T.make.target, { n: target });
    $('signs-make-target-fewer').disabled = target <= 0;
    $('signs-make-target-more').disabled = target >= makeTop(n);
    drawRow($('signs-make-board'), { numbers: numbersOf(n), signs: plusSigns(n), result: totalOf(n), faces: T.faces });
    $('signs-make-goal').textContent = String(target);
    $('signs-make-result').textContent = made ? made.line : '';
    $('signs-make-picture').replaceChildren(...(made?.node ? [made.node] : []));
    $('signs-make-play').disabled = madeBoard() === null;
  }

  function changeDraft(next) {
    // 선생님이 따진 뒤에 판을 고치면, 앞의 판에 한 말이 남지 않게 판이 바뀌었다는 사실만 말한다
    const said = made !== null;
    draft = next;
    made = null;
    log.saveDraft(draft, FORMAT);
    drawMake();
    if (said) frame.talkers.make.say(T.make.changed);
  }

  /** 맨 앞의 수를 바꾼다. 목표 수는 고를 수 있는 끝을 넘지 않게 줄인다 */
  function resize(n) {
    if (n < MIN_N || n > MAX_N) return;
    changeDraft({ kind: 'row', n, target: Math.min(draft.target, makeTop(n)) });
  }

  function retarget(target) {
    if (target < 0 || target > makeTop(draft.n)) return;
    changeDraft({ kind: 'row', n: draft.n, target });
  }

  /** 다 만든 판(공책에 남기거나 해 볼 판). 모두 +인 처음 줄이 벌써 목표 수이면 null */
  function madeBoard() {
    if (!draft || checkBoard(draft) !== null || draft.target === totalOf(draft.n)) return null;
    return copyBoard(draft);
  }

  /** 선생님이 따진다: 되면 방법의 수와 한 가지 방법, 안 되면 까닭이 되는 사실 */
  function solveDraft() {
    const board = copyBoard(draft);
    const total = totalOf(board.n);
    if (board.target === total) {
      made = { line: T.make['start-is'], node: null };
      drawMake();
      frame.talkers.make.say(made.line);
      return;
    }
    const result = solveOnce(board);
    if (result.possible) made = { line: fill(T.make.possible, { k: result.ways }), node: rowCard(rowView(board.n, result.signs), T.faces, T.make.picture) };
    else made = { line: fill(T.make[result.reason === 'big' ? 'big' : 'parity'], { k: total }), node: null };
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
      solution: { possible: result.possible, total, ways: result.ways, reason: result.reason },
    });
    log.flush();
    frame.talkers.make.say(made.line);
  }

  function playDraft() {
    const board = madeBoard();
    if (!board) {
      frame.talkers.make.say(T.make['keep-not-yet']);
      return;
    }
    frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board });
  }

  // ---- 단추 잇기 ----
  $('signs-impossible').addEventListener('click', sayImpossible);
  $('signs-submit').addEventListener('click', submit);
  $('signs-left').addEventListener('click', () => jump(-1));
  $('signs-right').addEventListener('click', () => jump(1));
  $('signs-keys').addEventListener('click', (event) => {
    const key = event.target.closest('button')?.dataset.n;
    if (key) press(key);
  });
  $('signs-open').addEventListener('click', openLock);
  $('signs-plus').addEventListener('click', toggleTool);
  $('signs-make-n-fewer').addEventListener('click', () => resize(draft.n - 1));
  $('signs-make-n-more').addEventListener('click', () => resize(draft.n + 1));
  $('signs-make-target-fewer').addEventListener('click', () => retarget(draft.target - 1));
  $('signs-make-target-more').addEventListener('click', () => retarget(draft.target + 1));
  $('signs-make-solve').addEventListener('click', solveDraft);
  $('signs-make-play').addEventListener('click', playDraft);

  /** 판의 처음 값(새 판, 공책의 그림) */
  function begin({ level, custom, board }) {
    return {
      mode: custom ? 'made' : rungOf(level).mode,
      board: copyBoard(board), // 판: 줄, 모두 찾기, 메뚜기, 가장 큰 수(src/core/signs.js)
      trail: [], // 처음 모습에서 지금까지 한 일: 's3'(3번 부호 칸 바꾸기), 'm12'(띠의 12 고르기나 그만두기), 'l'·'r'(왼쪽·오른쪽으로 뛰기)
      seen: board.kind === 'hop' ? [] : [totalOf(board.n)], // 줄에서 나온 수들(나온 차례대로, 같은 수는 한 번). 처음 줄(모두 +)의 수부터
      typed: '', // 자물쇠에 넣는 중인 수
      moveCount: 0, // 부호를 바꾼(뛴) 수(무르고 되돌리기 전의 것까지 모두)
      markCount: 0, // 띠에서 고르거나 그만둔 수
      undoCount: 0,
      resetCount: 0,
      landCount: 0, // 메뚜기가 다 뛰었는데 닿을 곳이 아니었던 수
      impossibleCount: 0, // 되는 판에 "불가능해요"를 누른 수
      submitCount: 0, // "다 골랐어요"를 누른 수
      tryCount: 0, // 자물쇠에 수를 넣어 본 수
      wrongCount: 0, // 사실과 다른 답의 수(되는 판의 "불가능해요", 맞지 않게 고른 띠, 자물쇠가 열리지 않은 수)
      toolOn: false, // 지금 "모두 +일 때 보기"를 켜 두었는가
      toolShown: false, // 한 번이라도 켰는가
      toolCount: 0, // 켠 수
    };
  }

  /** 적어 둔 판의 단계가 판의 종류와 맞는가 */
  function levelOk(saved) {
    const { board } = saved;
    if (saved.custom === true) return saved.level === MAKE_LEVEL && saved.mode === 'made' && board.kind === 'row';
    if (!Number.isInteger(saved.level) || saved.level < LADDER[0].level || saved.level > TOP_LEVEL) return false;
    const mode = rungOf(saved.level).mode;
    if (mode !== saved.mode) return false;
    const kind = { five: 'row', seven: 'row', all: 'all', hop: 'hop', largest: 'largest' }[mode];
    return board.kind === kind;
  }

  function validSaved(saved) {
    if (!MODES.includes(saved.mode) || checkBoard(saved.board) !== null || !levelOk(saved)) return false;
    if (!replay(saved.board, saved.trail).ok) return false;
    if (!Array.isArray(saved.seen) || !saved.seen.every(Number.isInteger)) return false;
    if (typeof saved.typed !== 'string' || !/^\d{0,2}$/.test(saved.typed)) return false;
    if (![saved.toolOn, saved.toolShown].every((value) => typeof value === 'boolean')) return false;
    return [saved.moveCount, saved.markCount, saved.undoCount, saved.resetCount, saved.landCount, saved.impossibleCount, saved.submitCount, saved.tryCount, saved.wrongCount, saved.toolCount].every(count);
  }

  /** 작은 그림: 줄은 모두 +인 처음 줄, 메뚜기는 빈 수직선, 모두 찾기는 줄과 빈 띠 */
  function drawSample(root, board) {
    if (board.kind === 'hop') {
      const box = document.createElement('div');
      drawLine(box, { n: board.n, target: board.target, dirs: [], small: true });
      root.replaceChildren(box);
      return;
    }
    drawRow(root, { numbers: numbersOf(board.n), signs: plusSigns(board.n), result: totalOf(board.n), faces: T.faces, small: true });
  }

  /** 하던 판과 공책의 그림: 지금 모습 */
  function drawResume(root, saved) {
    const { board } = saved;
    const state = replay(board, saved.trail ?? []);
    if (!state.ok) {
      drawSample(root, board);
      return;
    }
    if (board.kind === 'hop') {
      const box = document.createElement('div');
      drawLine(box, { n: board.n, target: board.target, dirs: state.dirs, small: true });
      root.replaceChildren(box);
      return;
    }
    drawRow(root, { numbers: numbersOf(board.n), signs: state.signs, result: rowValue(board.n, state.signs), faces: T.faces, small: true });
  }

  return {
    id: FORMAT,
    T,
    padId: 'signs-pad',
    makeId: 'make-signs',
    homeIds: { sample: 'home-signs-sample', blank: 'home-signs-blank', ask: 'home-signs-ask', play: 'home-signs-play', pick: 'home-signs-pick', make: 'home-signs-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    begin,
    solve: (round) => solveOnce(round.board),
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      try {
        return validSaved(saved);
      } catch {
        return false;
      }
    },
    /** 판 화면에서 이 형식의 것(판, 판 아래의 글, 왼쪽 칸의 도구)을 보이거나 감춘다 */
    showParts(on) {
      $('signs-board').hidden = !on;
      $('signs-count').hidden = !on;
      $('signs-plus').hidden = !on;
      if (on) {
        // 앞의 형식이 감춰 둔 무르기와 되돌리기를 여기서 다시 보이게 한다.
        $('undo').hidden = false;
        $('reset').hidden = false;
      }
    },
    enter() {
      flash = null;
      changed = null;
      pointed = null;
    },
    draw,
    ended() {
      flash = null;
      pointed = null;
    },
    ruleLine(round) {
      const { board } = round;
      if (board.kind === 'hop') return `${fill(T.rules.hop, { n: board.n })} ${board.target === 0 ? T.asks['hop-zero'] : fill(T.asks.hop, { face: signed(board.target) })}`;
      const ask = board.kind === 'all' ? fill(T.asks.all, { k: board.top }) : board.kind === 'largest' ? T.asks.largest : T.asks.row;
      return `${fill(T.rules.row, { n: board.n })} ${ask}`;
    },
    hints: (round) => T.hints[round.mode],
    touched: (round) => round.moveCount > 0 || round.markCount > 0 || round.tryCount > 0 || round.toolCount > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view(round) {
      const state = stateOf(round);
      return { signs: state.signs.join(''), value: hasRow(round) ? valueOf(round) : null, marks: state.marks, dirs: state.dirs.slice(), typed: round.typed, toolOn: round.toolOn };
    },
    /** 이 판보다 작은 판: 맨 앞의 수(뛰는 횟수)가 하나, 둘 적은 같은 종류의 판 */
    smaller: (round, turn) => smallerSigns({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      const state = stateOf(round);
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        solution: { possible: solution.possible, total: solution.total, ways: solution.ways ?? null, reason: solution.reason ?? null, impossible: solution.impossible ?? null, answer: solution.answer ?? null },
        // 질문 힌트와 "모두 +일 때 보기"를 함께 센다.
        hintsOpened: round.hintsOpened + (round.toolShown ? 1 : 0),
        toolShown: round.toolShown,
        toolCount: round.toolCount,
        // 판을 떠날 때의 모습: 한 일, 부호, 나온 수, 고른 수, 뛴 방향
        trail: round.trail,
        signs: state.signs.join(''),
        value: hasRow(round) ? rowValue(round.board.n, state.signs) : null,
        marks: state.marks,
        dirs: state.dirs,
        seen: round.seen,
        moveCount: round.moveCount,
        markCount: round.markCount,
        undoCount: round.undoCount,
        resetCount: round.resetCount,
        landCount: round.landCount,
        impossibleCount: round.impossibleCount,
        submitCount: round.submitCount,
        tryCount: round.tryCount,
        // 수준 맞추기가 보는 "틀린 답"의 수
        wrongCount: round.wrongCount,
      };
    },
    rightLine,
    whyPages,
    solutionPages,
    undo,
    reset,
    /** 글자판이 있는 기기: 자물쇠의 숫자와 지우기, 들이기. 부호 칸과 띠의 칸은 단추라서 저마다 Enter와 빈칸 글쇠로 누른다 */
    onKey(event) {
      const { round } = frame;
      if (!round || $('signs-pad').hidden || round.done || !isLock(round)) return;
      if (/^\d$/.test(event.key)) press(event.key);
      else if (event.key === 'Backspace') press('erase');
      else if (event.key === 'Enter' && !event.target.closest?.('button')) openLock();
    },

    // ---- 처음 화면에 그리는 그림 ----
    homeAsk: (level) => T.home.ask[rungOf(level).mode],
    pickLine: () => T.home.pick,
    drawSample,
    drawBlank(root) {
      drawRow(root, { numbers: numbersOf(3), signs: plusSigns(3), result: null, faces: T.faces, small: true });
    },
    drawResume,
    /** 판 고르기의 그림: 단계마다 그 단계의 판 하나 */
    drawLevelPicture(root, entry) {
      if (entry.picture.blank) {
        drawRow(root, { numbers: numbersOf(3), signs: plusSigns(3), result: null, faces: T.faces, small: true });
        return;
      }
      drawSample(root, generateBoard(entry.level, entry.picture.seed).board);
    },
    showMake,
    /** 직접 만들기에서 다 만든 판(공책에 남기기가 쓴다) */
    madeBoard,
  };
}
