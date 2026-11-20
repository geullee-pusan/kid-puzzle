// 열쇠 미로: 판 화면에서 이 형식이 맡는 부분(판, 답하는 칸, 끝났을 때 하는 말, 풀이와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/keymaze.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 이웃한 방을 누르거나 방을 따라 그으면 한 칸씩 걷는다. 지나갈 수 없는 문이면 걷지 않고 왜 못 지나가는지 사실만 말한다(벽, 화살표, 열쇠).
// 열쇠는 그 방에 들어가면 저절로 줍는다. 열쇠의 약속은 판마다 정해져 있다(계속 가진다 / 한 번 쓰면 없어진다).
// 한쪽 문을 지나면 돌아올 수 없는 곳이 생긴다. 더 갈 곳이 아예 없는 방에 들어가면 그 사실만 말한다(나갈 수 없게 된 것을 미리 알리지 않는다).
// "한 번 무르기"는 한 걸음을 무르고, "처음으로 되돌리기"는 처음 방으로 돌아간다. 둘 다 횟수를 화면에 적지 않는다.
// 판의 종류(mode)
//   oneway  한쪽 문만 있는 판(1단계). 나가면 끝난다
//   keys    열쇠를 계속 가지는 판(2단계). 나가면 끝난다
//   mixed   나갈 수 없는 판이 섞인다(3단계, 직접 만든 판). 나갈 수 없는 판은 "불가능해요"로 답한다
//   used    열쇠를 한 번 쓰면 없어지는 판(4단계). 나갈 수 없는 판이 섞인다
//   fewest  가장 적은 걸음으로 나간다(5단계). 더 많은 걸음으로 나오면 틀렸다고 하지 않고 걸음 수를 말한 뒤 "더 적은 걸음으로 나갈 수 있을까요?"라고 묻는다.
//           가장 적은 걸음의 수는 판이 끝나기 전에 말하지 않는다. 판 아래에 이 판에서 가장 적은 걸음을 적는다
// 나갈 수 있는 판에 "불가능해요"를 누르면 틀렸다고 하지 않는다. 나가는 길이 있다는 사실만 말하고 판은 그대로 이어진다.
// "나갈 수 있는 방 보기"는 도구다. 나가는 문에서 거꾸로 따라가 나갈 수 있는 방에 빗금을 긋는다(잠긴 문은 열 수 있다고 친다). 처음 켤 때 힌트 하나로 센다.
import T from '../content/keymaze.json';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf } from '../core/keymaze-ladder.js';
import { COLORS, MAX_SIZE, MIN_SIZE, adjacent, checkBoard, copyBoard, doorOpen, exitRooms, heldOf, initialState, movesFrom, neighbourOf, onEdge, outOf, replay, solve, tryStep, xyOf } from '../core/keymaze.js';
import { smallerKeymaze } from '../core/smaller.js';
import { fill, ordinal } from '../core/text.js';
import { doorIcon, drawMaze, keyIcon, mazeCard } from '../ui/keymaze-board.js';

const FORMAT = 'keymaze';
const MODES = ['oneway', 'keys', 'mixed', 'used', 'fewest', 'made'];
const TOOLS = ['door', 'one', 'lock', 'key', 'start', 'exit'];
/** 기록에 남기는 무르기 차례와 더 갈 곳이 없던 모습의 수의 위 끝 */
const MAX_MOVES = 400;
const MAX_STUCKS = 40;
/** 직접 만들기의 처음 판: 3×3, 문이 모두 열려 있고, 왼쪽 위에서 오른쪽 아래로 나간다 */
function firstDraft() {
  const doors = [];
  for (let room = 0; room < 9; room++) {
    if (room % 3 < 2) doors.push({ a: room, b: room + 1, kind: 'open' });
    if (room + 3 < 9) doors.push({ a: room, b: room + 3, kind: 'open' });
  }
  return copyBoard({ w: 3, h: 3, start: 0, exit: { room: 8, side: 'e', color: null }, doors, keys: [], keep: 'kept' });
}

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createKeymaze(frame) {
  const { $, log } = frame;
  let flash = null; // 판 아래에 잠깐 적는 한 줄과 판의 표시({ line, refused }). 다음에 무엇을 누르면 지운다
  let draft = null; // 직접 만들기에서 만들던 판
  let tool = 'door'; // 직접 만들기에서 누르면 할 일
  let color = 0; // 직접 만들기에서 고른 색(잠긴 문과 열쇠)
  let made = null; // 직접 만들기에서 선생님이 따진 것(판을 고치면 지운다)

  const count = (value) => Number.isInteger(value) && value >= 0;
  const hasImpossible = (round) => round.mode === 'mixed' || round.mode === 'used' || round.mode === 'made';
  /** 규칙 글과 힌트의 이름: 직접 만든 판은 열쇠 약속을 따른다 */
  const ruleKey = (round) => (round.mode === 'made' ? (round.board.keep === 'used' ? 'used' : 'mixed') : round.mode);
  const faceOf = (value) => T.faces[value];

  /** 한 번 푼 판은 적어 둔다(판을 열 때마다, 기록을 남길 때마다 다시 풀지 않게) */
  const memo = new Map();
  function solutionOf(board) {
    const key = JSON.stringify(copyBoard(board));
    if (!memo.has(key)) memo.set(key, solve(board));
    return memo.get(key);
  }

  /** 걸어온 길에서 지금 모습 */
  const stateOf = (round) => replay(round.board, round.walk) ?? initialState(round.board);
  const isOut = (round, state = stateOf(round)) => state.room === outOf(round.board);

  /** 주운 열쇠의 번호들, 지금 지나갈 수 있는 잠긴 문의 번호들(나가는 문은 doors.length) */
  function pickedOf(board, state) {
    return board.keys.map((_, index) => index).filter((index) => Math.floor(state.keys / 2 ** index) % 2 === 1);
  }
  function openOf(board, state) {
    const list = [];
    board.doors.forEach((door, index) => {
      if (door.kind === 'lock' && doorOpen(board, state, index)) list.push(index);
    });
    if (board.exit.color !== null && doorOpen(board, state, board.doors.length)) list.push(board.doors.length);
    return list;
  }

  // ---- 이름표 ----
  function labelOf(board, state) {
    const out = outOf(board);
    const picked = pickedOf(board, state);
    return (room) => {
      if (room === out) return T.labels.exit;
      const [x, y] = xyOf(board, room);
      let face = T.labels.room;
      const keyIndex = board.keys.findIndex((key) => key.room === room);
      if (room === state.room) face = T.labels.here;
      else if (keyIndex >= 0 && !picked.includes(keyIndex)) face = fill(T.labels.key, { face: faceOf(board.keys[keyIndex].color) });
      else if (room === board.start) face = T.labels.start;
      return fill(T.labels.cell, { no: ordinal(y + 1), f: ordinal(x + 1), face });
    };
  }

  /** 판 아래 "가진 열쇠": 색마다 가진 만큼 열쇠 그림 */
  function heldNodes(board, state) {
    const nodes = [];
    for (let value = 0; value < COLORS; value++) {
      const held = heldOf(board, state, value);
      for (let index = 0; index < held; index++) nodes.push(keyIcon(value, fill(T.labels.held, { face: faceOf(value) })));
    }
    if (nodes.length === 0) {
      const none = document.createElement('span');
      none.textContent = T.held.none;
      nodes.push(none);
    }
    return nodes;
  }

  // ---- 판 ----
  function draw() {
    const { round } = frame;
    const { board } = round;
    const playing = !round.done;
    const state = stateOf(round);
    const out = isOut(round, state);
    drawMaze($('keymaze-board'), {
      ...board,
      picked: pickedOf(board, state),
      openDoors: openOf(board, state),
      walk: round.walk,
      me: state.room,
      marks: playing && round.marksOn ? exitRooms(board) : [],
      refused: playing ? (flash?.refused ?? null) : null,
      words: T.words,
      label: labelOf(board, state),
      onWalk: playing ? walkTo : undefined,
    });
    $('keymaze-steps').textContent = String(round.walk.length - 1);
    const record = round.mode === 'fewest';
    $('keymaze-best-line').hidden = !(record && round.best !== null);
    $('keymaze-best').textContent = round.best === null ? '' : String(round.best);
    $('keymaze-held').replaceChildren(...heldNodes(board, state));
    $('keymaze-status').textContent = flash?.line ?? statusOf(round, state, playing);
    $('undo').disabled = !playing || round.moves.length === 0;
    $('reset').disabled = !playing || round.walk.length <= 1;
    $('keymaze-keep-note').textContent = T.keepNote[board.keep];
    $('keymaze-impossible').hidden = !hasImpossible(round);
    $('keymaze-impossible').disabled = !playing;
    $('keymaze-again').hidden = !(playing && record && out);
    $('keymaze-stop').hidden = !(playing && record && round.best !== null);
    // 끝난 판에서는 도구가 꺼져 있다(단추도 누를 수 없다).
    const looking = playing && round.marksOn;
    $('keymaze-marks').textContent = T.tool[looking ? 'on' : 'off'];
    $('keymaze-marks').setAttribute('aria-pressed', String(looking));
    $('keymaze-marks').disabled = round.done;
    frame.showWhy();
  }

  function statusOf(round, state, playing) {
    if (!playing) return '';
    if (state.room === outOf(round.board)) return T.status.out;
    if (round.walk.length === 1) return T.status.begin;
    if (movesFrom(round.board, state).length === 0) return T.status.stuck;
    return '';
  }

  /** 막힌 까닭의 한 줄(판 아래)과 선생님의 말 */
  function refusal(round, state, step, target) {
    const { board } = round;
    if (step.why === 'far') return { line: T.status.far, say: T.play.far, refused: target === outOf(board) ? { exit: true } : { room: target } };
    if (step.why === 'wall') return { line: T.status.wall, say: T.play.wall, refused: { a: Math.min(state.room, target), b: Math.max(state.room, target) } };
    const spot = target === outOf(board) ? { exit: true } : { a: Math.min(state.room, target), b: Math.max(state.room, target) };
    if (step.why === 'arrow') return { line: T.status.arrow, say: T.play.arrow, refused: spot };
    // 잠긴 문: 그 색 열쇠를 아까 다른 문에 썼으면 그 사실을 말한다(한 번 쓰면 없어지는 약속)
    const face = faceOf(step.color);
    const pickedSame = pickedOf(board, state).some((index) => board.keys[index].color === step.color);
    const usedUp = board.keep === 'used' && pickedSame;
    return { line: fill(T.status.lock, { face }), say: fill(T.play[usedUp ? 'used-up' : 'lock'], { face }), refused: spot };
  }

  /** 방을 눌렀거나 따라 그었다: 차례대로 한 걸음씩 가 본다. 지나갈 수 없는 문을 만나면 거기서 멈추고 사실만 말한다 */
  function walkTo(rooms) {
    const { round } = frame;
    if (!round || round.done) return;
    flash = null;
    let state = stateOf(round);
    if (isOut(round, state)) {
      flash = { line: T.status.out };
      draw();
      return;
    }
    let said = null;
    let moved = false;
    for (const target of rooms) {
      if (target === state.room) continue;
      const step = tryStep(round.board, state, target);
      if (!step.ok) {
        const told = refusal(round, state, step, target);
        round.refusedCount += 1;
        frame.note('refused', { room: target, why: step.why });
        flash = { line: told.line, refused: told.refused };
        said = told.say;
        break;
      }
      round.moves = [...round.moves, round.walk.slice()].slice(-MAX_MOVES);
      round.walk = [...round.walk, target];
      round.stepCount += 1;
      moved = true;
      frame.note('step', { room: target });
      if (step.opened) said = fill(T.play.opened, { face: faceOf(round.board.doors[step.door]?.color ?? round.board.exit.color) });
      else if (step.picked.length > 0) said = fill(T.play.picked, { face: faceOf(round.board.keys[step.picked[0]].color) });
      else said = null;
      state = step.state;
      if (state.room === outOf(round.board)) {
        complete();
        return;
      }
    }
    if (moved && movesFrom(round.board, state).length === 0) {
      // 더 갈 곳이 없는 방이다. 사실 하나와 할 수 있는 일 하나를 말한다(같은 모습이 되풀이되면 그렇다고 말한다)
      const key = round.walk.join('-');
      const code = `${state.room}:${state.keys}:${state.open}`;
      const same = round.stucks.includes(code);
      round.stuckCount += 1;
      round.stucks = [...round.stucks, code].slice(-MAX_STUCKS);
      frame.note('stuck', { walk: key, same });
      said = same ? T.play['stuck-same'] : T.play.stuck;
    }
    draw();
    frame.persist();
    if (said) frame.say(said);
  }

  /** 나가는 문으로 나왔다. 가장 적은 걸음의 판이 아니면 끝난다. 가장 적은 걸음의 판은 가장 적은 걸음이면 끝나고, 아니면 더 적게 나갈 수 있을지 묻는다 */
  function complete() {
    const { round, solution } = frame;
    const k = round.walk.length - 1;
    const before = round.best;
    round.completions.push(k);
    if (before === null || k < before) {
      round.best = k;
      round.bestWalk = round.walk.slice();
    }
    const fewest = round.mode !== 'fewest' || k === solution.steps;
    const guess = fewest ? null : 'more-than-fewest';
    round.answers.push({ t: frame.stamp(), answer: `out:${k}`, correct: fewest, guess });
    frame.note('answer', { answer: `out:${k}`, correct: fewest, guess });
    if (fewest) {
      frame.finish('solved');
      return;
    }
    // 틀렸다고 하지 않는다. 걸음 수를 말하고 더 적은 걸음으로 나갈 수 있을지 묻는다. 가장 적은 걸음의 수는 말하지 않는다.
    round.wrongCount += 1;
    frame.persist();
    draw();
    if (before !== null && k === before) frame.say(fill(T.play.same, { k }));
    else frame.say(fill(before !== null && k < before ? T.play['fewer-up'] : T.play.fewer, { k }));
  }

  /** "불가능해요" */
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
    // 나갈 수 있는 판이다. 틀렸다고 하지 않고 사실만 말한다. 판은 그대로 이어진다.
    round.impossibleCount += 1;
    round.wrongCount += 1;
    flash = null;
    frame.persist();
    draw();
    frame.say(T.play['possible-press']);
  }

  /** 가장 적은 걸음의 판에서 "처음부터 다시 걸어 볼래요" */
  function again() {
    const { round } = frame;
    if (round.done || round.walk.length <= 1) return;
    round.moves = [...round.moves, round.walk.slice()].slice(-MAX_MOVES);
    round.walk = [round.board.start];
    round.retryCount += 1;
    flash = null;
    frame.note('again');
    draw();
    frame.persist();
  }

  /** 가장 적은 걸음의 판에서 "여기까지 할래요": 지금까지 가장 적은 걸음으로 판을 끝낸다. 이것도 끝까지 한 판이다 */
  function stop() {
    const { round } = frame;
    if (round.done || round.best === null) return;
    round.stopped = true;
    frame.note('stop', { best: round.best });
    frame.finish('solved');
  }

  /** 한 걸음 무르기(처음으로 되돌린 것도 무를 수 있다) */
  function undo() {
    const { round } = frame;
    if (round.done || round.moves.length === 0) return;
    round.walk = round.moves.at(-1).slice();
    round.moves = round.moves.slice(0, -1);
    round.undoCount += 1;
    flash = null;
    frame.note('undo');
    draw();
    frame.persist();
  }

  /** 처음으로: 처음 방으로 돌아간다. 무르기로 돌아올 수 있다 */
  function reset() {
    const { round } = frame;
    if (round.done || round.walk.length <= 1) return;
    round.moves = [...round.moves, round.walk.slice()].slice(-MAX_MOVES);
    round.walk = [round.board.start];
    round.resetCount += 1;
    flash = null;
    frame.note('reset');
    draw();
    frame.persist();
  }

  /** "나갈 수 있는 방 보기": 나가는 문에서 거꾸로 따라가 나갈 수 있는 방에 빗금을 긋는다 */
  function toggleMarks() {
    const { round } = frame;
    if (!round || round.done) return;
    round.marksOn = !round.marksOn;
    if (round.marksOn) {
      round.marksShown = true;
      round.marksCount += 1;
    }
    frame.note('marks', { on: round.marksOn });
    draw();
    frame.keep();
  }

  // ---- 끝났을 때 하는 말: 한 일을 그대로 말한다 ----
  function rightLine(round, solution) {
    const parts = [];
    const last = round.answers.at(-1);
    if (last?.answer === 'impossible') {
      parts.push(round.stepCount > 0 ? fill(T.right['impossible-tried'], { n: round.stepCount }) : T.right['impossible-untried']);
      return parts;
    }
    if (round.mode === 'fewest') {
      if (round.stopped) return [fill(T.right.stopped, { k: round.best })];
      parts.push(fill(T.right.fewest, { k: solution.steps }));
      if (round.completions.length > 1) parts.push(fill(T.right['fewest-after'], { n: round.completions[0] }));
      return parts;
    }
    parts.push(fill(T.right.out, { k: round.walk.length - 1 }));
    const back = round.undoCount + round.resetCount;
    parts.push(back === 0 ? T.right.clean : fill(T.right.back, { n: back }));
    if (round.impossibleCount > 0) parts.push(T.right['after-press']);
    return parts;
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----
  function rowOf(cards) {
    const row = document.createElement('div');
    row.className = 'figure-row';
    row.append(...cards);
    return row;
  }

  /** 나갈 수 없는 까닭을 말로: 풀이 프로그램이 가린 까닭과 같은 말을 고른다 */
  function reasonLine(solution) {
    const { reason, detail } = solution;
    const lines = T.solution.reasons;
    if (reason === 'arrows') return lines.arrows;
    if (reason === 'nokey') return fill(lines[detail.none ? 'nokey-none' : 'nokey-far'], { face: faceOf(detail.color) });
    if (reason === 'trap') return fill(lines.trap, { face: faceOf(detail.color) });
    if (reason === 'twice') return fill(lines.twice, { face: faceOf(detail.color), n: detail.need, k: detail.have });
    return lines.search;
  }

  /** 까닭을 보여 주는 그림: 나갈 수 있는 방의 빗금, 짚는 방의 고리 */
  function reasonView(board, solution) {
    const view = { ...board, words: T.words };
    const { reason, detail } = solution;
    if (reason === 'arrows') return { ...view, marks: detail.rooms, rings: [board.start] };
    if (reason === 'nokey') return { ...view, rings: detail.keyRooms };
    if (reason === 'trap') return { ...view, marks: detail.rooms, rings: detail.keyRooms };
    return view;
  }

  /** 길 하나를 그린 그림 */
  const routeView = (board, path) => ({ ...board, walk: path, numbers: true, words: T.words });

  function solutionPages(round, solution) {
    const { board } = round;
    if (solution.possible) {
      return [{ say: fill(T.solution.possible, { k: solution.steps }), nodes: [rowOf([mazeCard(routeView(board, solution.path), '', { big: true })])] }];
    }
    return [{ say: `${T.solution.impossible} ${reasonLine(solution)}`, nodes: [rowOf([mazeCard(reasonView(board, solution), '', { big: true })])] }];
  }

  /** "왜 그럴까?": 선생님이 갇히다가 나가는 문에서 거꾸로 따라가 본 이야기 */
  function whyPages() {
    return T.why.map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다(단추를 보일지 따질 때마다 그리지 않는다).
      get nodes() {
        return [
          rowOf(
            slide.figures.map((item) => {
              const state = item.walk ? replay(item.board, item.walk) : null;
              const walked = state ? { walk: item.walk, me: state.room, picked: pickedOf(item.board, state), openDoors: openOf(item.board, state) } : {};
              return mazeCard({ ...item.board, ...walked, marks: item.marks ?? [], rings: item.rings ?? [], words: T.words }, item.note, { big: slide.figures.length === 1 });
            }),
          ),
        ];
      },
    }));
  }

  // ---- 직접 만들기: 크기와 열쇠 약속을 정하고, 고른 것(문, 한쪽 문, 잠긴 문, 열쇠, 처음 방, 나가는 문)을 판에 놓는다 ----
  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    if (saved && checkBoard(saved) === null) return copyBoard(saved);
    return firstDraft();
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    made = null;
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function drawMake() {
    for (const button of $('keymaze-make-keep').querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.keep === draft.keep));
    for (const button of $('keymaze-make-tools').querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.tool === tool));
    for (const button of $('keymaze-make-colors').querySelectorAll('button')) button.setAttribute('aria-pressed', String(Number(button.dataset.color) === color));
    $('keymaze-make-w').textContent = fill(T.make.size, { n: draft.w });
    $('keymaze-make-h').textContent = fill(T.make.size, { n: draft.h });
    $('keymaze-make-w-fewer').disabled = draft.w <= MIN_SIZE;
    $('keymaze-make-w-more').disabled = draft.w >= MAX_SIZE;
    $('keymaze-make-h-fewer').disabled = draft.h <= MIN_SIZE;
    $('keymaze-make-h-more').disabled = draft.h >= MAX_SIZE;
    const state = initialState(draft);
    drawMaze($('keymaze-make-board'), { ...draft, words: T.words, label: labelOf(draft, { ...state, room: -1 }), onEdit: edit });
    $('keymaze-make-result').textContent = made ? made.line : '';
    $('keymaze-make-picture').replaceChildren(...(made ? [made.card] : []));
  }

  function changeDraft(next) {
    if (checkBoard(next) !== null) {
      frame.talkers.make.say(T.make.many);
      return;
    }
    draft = copyBoard(next);
    made = null;
    log.saveDraft(draft, FORMAT);
    drawMake();
  }

  /** 만드는 판을 눌렀다: 고른 일을 한다 */
  function edit(spot) {
    const doors = draft.doors.map((door) => ({ ...door }));
    const at = spot.type === 'edge' ? doors.findIndex((door) => door.a === spot.a && door.b === spot.b) : -1;
    const door = at >= 0 ? doors[at] : null;
    if (spot.type === 'edge') {
      let next = null; // 바뀐 문(null이면 벽)
      if (tool === 'door') next = door ? null : { a: spot.a, b: spot.b, kind: 'open' };
      else if (tool === 'one') {
        // 열린 문(벽) → 아래나 오른쪽으로 → 위나 왼쪽으로 → 열린 문
        if (!door || door.kind !== 'one') next = { a: spot.a, b: spot.b, kind: 'one', to: spot.b };
        else if (door.to === spot.b) next = { a: spot.a, b: spot.b, kind: 'one', to: spot.a };
        else next = { a: spot.a, b: spot.b, kind: 'open' };
      } else if (tool === 'lock') next = door && door.kind === 'lock' && door.color === color ? { a: spot.a, b: spot.b, kind: 'open' } : { a: spot.a, b: spot.b, kind: 'lock', color };
      else if (tool === 'exit' || tool === 'key' || tool === 'start') return;
      const rest = doors.filter((_, index) => index !== at);
      changeDraft({ ...draft, doors: next ? [...rest, next] : rest });
      return;
    }
    if (spot.type === 'side') {
      if (tool === 'exit') changeDraft({ ...draft, exit: { room: spot.room, side: spot.side, color: draft.exit.color } });
      else if (tool === 'lock' && draft.exit.room === spot.room && draft.exit.side === spot.side) {
        changeDraft({ ...draft, exit: { ...draft.exit, color: draft.exit.color === color ? null : color } });
      }
      return;
    }
    // 방을 눌렀다
    const { room } = spot;
    if (tool === 'start') changeDraft({ ...draft, start: room });
    else if (tool === 'key') {
      const same = draft.keys.find((key) => key.room === room);
      const keys = draft.keys.filter((key) => key.room !== room);
      changeDraft({ ...draft, keys: same && same.color === color ? keys : [...keys, { room, color }] });
    } else if (tool === 'exit') {
      const side = ['n', 'e', 's', 'w'].find((item) => onEdge(draft, room, item));
      if (side) changeDraft({ ...draft, exit: { room, side, color: draft.exit.color } });
    }
  }

  /** 크기를 바꾼다. 문과 열쇠, 처음 방은 같은 자리(가로, 세로)에 그대로 두고, 판 밖으로 나간 것은 버린다 */
  function resize(w, h) {
    if (w < MIN_SIZE || h < MIN_SIZE || w > MAX_SIZE || h > MAX_SIZE) return;
    const move = (room) => {
      const [x, y] = xyOf(draft, room);
      return x < w && y < h ? y * w + x : null;
    };
    const sized = { w, h };
    const doors = draft.doors
      .map((door) => ({ ...door, a: move(door.a), b: move(door.b), to: door.kind === 'one' ? move(door.to) : undefined }))
      .filter((door) => door.a !== null && door.b !== null && adjacent(sized, door.a, door.b))
      .map((door) => (door.kind === 'one' ? door : { a: door.a, b: door.b, kind: door.kind, ...(door.kind === 'lock' ? { color: door.color } : {}) }));
    const keys = draft.keys.map((key) => ({ room: move(key.room), color: key.color })).filter((key) => key.room !== null);
    let exit = { ...draft.exit, room: move(draft.exit.room) };
    if (exit.room === null || neighbourOf(sized, exit.room, exit.side) !== null) exit = { room: w * h - 1, side: 'e', color: draft.exit.color };
    changeDraft({ ...draft, w, h, start: move(draft.start) ?? 0, exit, doors, keys });
  }

  /** "모든 문 열기": 이웃한 방 사이를 모두 열린 문으로 하고 열쇠를 치운다 */
  function openAll() {
    const doors = [];
    for (let room = 0; room < draft.w * draft.h; room++) {
      if (room % draft.w < draft.w - 1) doors.push({ a: room, b: room + 1, kind: 'open' });
      if (room + draft.w < draft.w * draft.h) doors.push({ a: room, b: room + draft.w, kind: 'open' });
    }
    changeDraft({ ...draft, doors, keys: [], exit: { ...draft.exit, color: null } });
  }

  /** 아이가 만든 판을 풀이 프로그램으로 따져서 알려 준다. 나갈 수 있으면 가장 적은 걸음과 길을, 없으면 까닭과 그 그림을 보여 준다 */
  function solveDraft() {
    const board = copyBoard(draft);
    const result = solve(board);
    const line = result.possible ? fill(T.make.possible, { k: result.steps }) : `${T.make.impossible} ${reasonLine(result)}`;
    const card = mazeCard(result.possible ? routeView(board, result.path) : reasonView(board, result), '');
    made = { line, card };
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
      solution: { possible: result.possible, steps: result.steps, path: result.path, reason: result.reason },
    });
    log.flush();
    frame.talkers.make.say(line);
  }

  /** 다 만든 판(공책에 남기거나 해 볼 판) */
  const madeBoard = () => (draft && checkBoard(draft) === null ? copyBoard(draft) : null);

  function playDraft() {
    const board = madeBoard();
    if (board) frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board });
  }

  // ---- 단추 잇기 ----
  $('keymaze-impossible').addEventListener('click', sayImpossible);
  $('keymaze-again').addEventListener('click', again);
  $('keymaze-stop').addEventListener('click', stop);
  $('keymaze-marks').addEventListener('click', toggleMarks);
  $('keymaze-make-keep').addEventListener('click', (event) => {
    const keep = event.target.closest('button')?.dataset.keep;
    if (keep === 'kept' || keep === 'used') changeDraft({ ...draft, keep });
  });
  $('keymaze-make-tools').addEventListener('click', (event) => {
    const next = event.target.closest('button')?.dataset.tool;
    if (!TOOLS.includes(next)) return;
    tool = next;
    drawMake();
  });
  $('keymaze-make-colors').addEventListener('click', (event) => {
    const next = Number(event.target.closest('button')?.dataset.color);
    if (!Number.isInteger(next) || next < 0 || next >= COLORS) return;
    color = next;
    drawMake();
  });
  $('keymaze-make-w-fewer').addEventListener('click', () => resize(draft.w - 1, draft.h));
  $('keymaze-make-w-more').addEventListener('click', () => resize(draft.w + 1, draft.h));
  $('keymaze-make-h-fewer').addEventListener('click', () => resize(draft.w, draft.h - 1));
  $('keymaze-make-h-more').addEventListener('click', () => resize(draft.w, draft.h + 1));
  $('keymaze-make-clear').addEventListener('click', openAll);
  $('keymaze-make-solve').addEventListener('click', solveDraft);
  $('keymaze-make-play').addEventListener('click', playDraft);
  // 오른쪽 칸의 문 그림과 직접 만들기의 색 단추 그림(글은 index.html에 있다)
  $('keymaze-legend-open').replaceChildren(doorIcon('open'));
  $('keymaze-legend-one').replaceChildren(doorIcon('one'));
  $('keymaze-legend-lock').replaceChildren(doorIcon('lock'));
  for (const button of $('keymaze-make-colors').querySelectorAll('button')) button.prepend(keyIcon(Number(button.dataset.color), ''));

  /** 판의 처음 값(새 판, 공책의 그림) */
  function begin({ level, custom, board }) {
    const start = copyBoard(board);
    return {
      mode: custom ? 'made' : rungOf(level).mode,
      board: start, // 판: 크기, 처음 방, 나가는 문, 문들, 열쇠들, 열쇠 약속
      walk: [start.start], // 걸어온 방들(처음 방부터. 나가면 판 밖의 번호로 끝난다)
      moves: [], // 무르기에 쓰는 차례: 그 전의 걸어온 방들
      stepCount: 0, // 걸은 걸음의 수(무른 것도 센다)
      refusedCount: 0, // 지나갈 수 없는 문으로 가려 한 수
      undoCount: 0,
      resetCount: 0, // 걷다가 처음으로 되돌린 수
      retryCount: 0, // 나간 뒤에 처음부터 다시 걸어 본 수(가장 적은 걸음의 판)
      stuckCount: 0, // 더 갈 곳이 없는 방에 들어간 수
      stucks: [], // 그때의 모습
      impossibleCount: 0, // 나갈 수 있는 판에 "불가능해요"를 누른 수
      wrongCount: 0, // 사실과 다른 답의 수(나갈 수 있는 판의 "불가능해요", 가장 적은 걸음이 아니었던 나가기)
      completions: [], // 나갈 때마다의 걸음 수
      best: null, // 이 판에서 지금까지 가장 적은 걸음
      bestWalk: [], // 그때의 길
      stopped: false, // "여기까지 할래요"로 끝냈는가
      marksOn: false, // 지금 나갈 수 있는 방을 보고 있는가
      marksShown: false, // 한 번이라도 보았는가
      marksCount: 0, // 켠 수
    };
  }

  return {
    id: FORMAT,
    T,
    padId: 'keymaze-pad',
    makeId: 'make-keymaze',
    // 판 밖에 나가는 문 그림이 붙어서 판이 위아래로 크다. 규칙 글은 왼쪽 칸 맨 위에 두고 판을 크게 그린다(방 하나가 44픽셀보다 작아지지 않게).
    ruleAside: true,
    homeIds: { sample: 'home-keymaze-sample', blank: 'home-keymaze-blank', ask: 'home-keymaze-ask', play: 'home-keymaze-play', pick: 'home-keymaze-pick', make: 'home-keymaze-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    begin,
    solve: (round) => solutionOf(round.board),
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (!MODES.includes(saved.mode) || checkBoard(saved.board) !== null) return false;
      if (replay(saved.board, saved.walk) === null) return false;
      if (!Array.isArray(saved.moves) || !saved.moves.every((walk) => replay(saved.board, walk) !== null)) return false;
      if (![saved.stucks, saved.completions, saved.bestWalk].every(Array.isArray)) return false;
      if (![saved.stopped, saved.marksOn, saved.marksShown].every((value) => typeof value === 'boolean')) return false;
      if (![saved.stepCount, saved.refusedCount, saved.undoCount, saved.resetCount, saved.retryCount, saved.stuckCount, saved.impossibleCount, saved.wrongCount, saved.marksCount].every(count)) return false;
      return saved.best === null || count(saved.best);
    },
    /** 판 화면에서 이 형식의 것(판, 판 아래의 글, 왼쪽 칸의 도구)을 보이거나 감춘다 */
    showParts(on) {
      $('keymaze-board').hidden = !on;
      $('keymaze-count').hidden = !on;
      $('keymaze-marks').hidden = !on;
      if (on) {
        // 앞의 형식이 감춰 둔 무르기와 되돌리기를 여기서 다시 보이게 한다.
        $('undo').hidden = false;
        $('reset').hidden = false;
      }
    },
    enter() {
      flash = null;
    },
    draw,
    ended() {
      flash = null;
    },
    ruleLine: (round) => T.rules[ruleKey(round)],
    hints: (round) => T.hints[ruleKey(round)],
    touched: (round) => round.stepCount > 0 || round.refusedCount > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view(round) {
      const state = stateOf(round);
      return { walk: round.walk.slice(), room: state.room, moves: movesFrom(round.board, state).length, best: round.best };
    },
    /** 이 판보다 작은 판: 열쇠 약속과 문 종류가 같고, 나갈 수 없는 판이면 까닭이 같은 더 작은 판 */
    smaller: (round, turn) => smallerKeymaze({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        solution: { possible: solution.possible, steps: solution.steps, path: solution.path, reason: solution.reason },
        // 질문 힌트와 "나갈 수 있는 방 보기"를 함께 센다.
        hintsOpened: round.hintsOpened + (round.marksShown ? 1 : 0),
        marksShown: round.marksShown,
        marksCount: round.marksCount,
        // 판을 떠날 때의 길, 나갈 때마다의 걸음 수, 가장 적은 걸음과 그 길
        walk: round.walk,
        completions: round.completions,
        best: round.best,
        bestWalk: round.bestWalk,
        fewest: round.mode === 'fewest' && round.stopped !== true && round.best !== null && round.best === solution.steps,
        stopped: round.stopped === true,
        // 수준 맞추기가 보는 손댄 수와 "틀린 답"의 수
        moveCount: round.stepCount,
        stepCount: round.stepCount,
        refusedCount: round.refusedCount,
        undoCount: round.undoCount,
        resetCount: round.resetCount,
        retryCount: round.retryCount,
        stuckCount: round.stuckCount,
        impossibleCount: round.impossibleCount,
        wrongCount: round.wrongCount,
      };
    },
    rightLine,
    whyPages,
    solutionPages,
    undo,
    reset,
    onKey() {},

    // ---- 처음 화면에 그리는 그림 ----
    homeAsk: (level) => T.home.ask[rungOf(level).mode],
    pickLine: () => T.home.pick,
    drawSample(root, board) {
      drawMaze(root, { ...board, words: T.words, small: true });
    },
    drawBlank(root) {
      drawMaze(root, { ...firstDraft(), words: T.words, small: true });
    },
    /** 하던 판과 공책의 그림: 걸어온 길과 지금 있는 곳, 주운 열쇠 */
    drawResume(root, saved) {
      const { board } = saved;
      const state = Array.isArray(saved.walk) ? replay(board, saved.walk) : null;
      if (!state) {
        drawMaze(root, { ...board, words: T.words, small: true });
        return;
      }
      drawMaze(root, { ...board, walk: saved.walk, me: state.room, picked: pickedOf(board, state), openDoors: openOf(board, state), words: T.words, small: true });
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 판 하나 */
    drawLevelPicture(root, entry) {
      const picture = entry.picture;
      if (picture.blank) {
        drawMaze(root, { ...firstDraft(), words: T.words, small: true });
        return;
      }
      drawMaze(root, { ...generateBoard(entry.level, picture.seed).board, words: T.words, small: true });
    },
    showMake,
    /** 직접 만들기에서 다 만든 판(공책에 남기기가 쓴다) */
    madeBoard,
    /** 가장 좋은 기록(공책에 저절로 남는다). 가장 적은 걸음의 판에서 한 번도 나가지 않았으면 null. 적을수록 좋은 기록이다 */
    bestOf: (round) => (round.mode !== 'fewest' || round.best === null ? null : { value: -round.best, name: fill(T.notebook.best, { k: round.best }) }),
  };
}
