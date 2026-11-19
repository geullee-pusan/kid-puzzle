// 방 한 번씩 돌기: 판 화면에서 이 형식이 맡는 부분(집, 긋기, 답하는 칸, 끝났을 때 하는 말, 풀이와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/rooms.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
// 조각 덮기의 색칠(바둑판 무늬)을 다른 판에서 다시 만난다: "색 켜기"는 조각 덮기와 같은 두 색과 모양(동그라미, 네모)을 입힌다.
//
// 판의 종류(mode)는 단계가 정한다.
//   draw     되는 집만. 모든 방을 지나 끝 방에 닿으면 판이 저절로 끝난다(1단계)
//   mix      안 되는 집이 섞인다. 안 되는 집은 "불가능해요"로 답한다(2단계, 직접 만든 집)
//   numbers  몇 방에 지나는 차례가 적혀 있다. 적힌 차례대로 모든 방을 지나면 끝난다(3단계)
//   judge    같은 꼴의 집 여럿 가운데 안 되는 집을 긋지 않고 모두 고른다(4단계)
//   big      큰 집, 정원이 있는 집. mix와 같다(5단계)
// 되는 집에 "불가능해요"를 누르면 틀렸다고 하지 않는다. 길이 있다는 사실만 말하고 판은 그대로 이어진다.
// 가려 내기에서 되는 집을 골랐거나 안 되는 집을 빠뜨리면 그 사실 하나만 말하고 다시 고르게 한다.
// 길은 손가락으로 방을 따라 긋거나 방을 하나씩 누른다. 지나온 방을 누르면 그 방까지만 남는다. 몇 번 그었는지는 화면에 적지 않는다.
// "색 켜기"는 도구다(힌트로 세지 않는다). 무엇을 알려 주는지 말하지 않는다. 켜면 남은 방의 수를 색마다 적는다.
import T from '../content/rooms.json';
import { smallerRooms } from '../core/smaller.js';
import { fill, ordinal } from '../core/text.js';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf } from '../core/rooms-ladder.js';
import { MAX_SIZE, MIN_SIZE, checkBoard, checkHouse, colorOf, copyBoard, pathDone, pathOk, pathStuck, roomsOf, solve, wrongNumbers } from '../core/rooms.js';
import { countLine, drawHouse, drawJudge, houseCard } from '../ui/rooms-board.js';

const FORMAT = 'rooms';
const MODES = ['draw', 'mix', 'numbers', 'judge', 'big'];
/** 기록에 남기는 무르기 차례와 막힌 길의 수의 위 끝 */
const MAX_MOVES = 400;
const MAX_STUCKS = 40;
const FIRST_DRAFT = { kind: 'house', w: 4, h: 4, walls: [], start: null, end: null, numbers: [] };
const TOOLS = ['start', 'end', 'garden'];

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createRooms(frame) {
  const { $, log } = frame;
  let flash = null; // 방금 누른 것이 왜 안 됐는지(판 아래의 한 줄). 다음에 무엇을 누르면 지운다
  let draft = null; // 직접 만들기에서 만들던 집
  let tool = 'start'; // 직접 만들기에서 방을 누르면 할 일: 처음 방, 끝 방, 정원

  const count = (value) => Number.isInteger(value) && value >= 0;
  const isJudge = (round) => round.board.kind === 'judge';
  const hasImpossible = (round) => round.mode === 'mix' || round.mode === 'big';
  const ruleKey = (round) => (round.custom ? 'made' : round.mode);
  const hintKey = (round) => (round.custom ? 'mix' : round.mode);
  const roomCount = (board) => roomsOf(board).length;

  /** 한 번 푼 판은 적어 둔다(판을 열 때마다, 기록을 남길 때마다 다시 풀지 않게) */
  const memo = new Map();
  function solutionOf(board) {
    const key = JSON.stringify(copyBoard(board));
    if (!memo.has(key)) memo.set(key, solve(board));
    return memo.get(key);
  }

  // ---- 이름표 ----
  function labelOf(board, path) {
    return (cell) => {
      let what = T.cells.room;
      if (board.walls.includes(cell)) what = T.cells.garden;
      else if (path.at(-1) === cell && path.length > 1) what = T.cells.head;
      else if (cell === board.start) what = T.cells.start;
      else if (cell === board.end) what = T.cells.end;
      else if (path.includes(cell)) what = T.cells.visited;
      return fill(T.cellLabel, { no: ordinal(Math.floor(cell / board.w) + 1), n: ordinal((cell % board.w) + 1), face: what });
    };
  }

  /** 색을 켰을 때 색마다 남은 방의 수 */
  function legend(board, path) {
    const left = [0, 0];
    for (const cell of roomsOf(board)) if (!path.includes(cell)) left[colorOf(board, cell)] += 1;
    const line = countLine(left.map((n) => fill(T.colors.count, { n })));
    [...line.children].forEach((item, index) => item.setAttribute('aria-label', fill(T.colors.left, { face: T.colors.names[index], n: left[index] })));
    return line;
  }

  // ---- 판 ----
  function draw() {
    const { round } = frame;
    const { board } = round;
    const playing = !round.done;
    const judge = isJudge(round);
    $('rooms-draw-box').hidden = judge;
    $('rooms-judge-box').hidden = !judge;
    $('rooms-maybe').hidden = judge || !hasImpossible(round);
    $('rooms-impossible').disabled = !playing;
    $('rooms-judged').disabled = !playing;
    $('rooms-left-line').hidden = judge;
    const looking = round.colorOn;
    if (judge) {
      drawJudge($('rooms-board'), {
        houses: board.houses,
        picked: round.picked,
        colorOn: looking,
        words: T.words,
        name: (index) => fill(T.houseName, { no: index + 1 }),
        label: (index, on) => fill(T.houseLabel[on ? 'on' : 'off'], { no: index + 1 }),
        onPick: playing ? pick : undefined,
      });
      $('rooms-status').textContent = flash ?? (playing ? T.status.judge : '');
      $('rooms-colors').hidden = true;
    } else {
      const path = round.path;
      const wrong = wrongNumbers(board, path);
      drawHouse($('rooms-board'), {
        ...board,
        path,
        colorOn: looking,
        steps: round.mode === 'numbers' || round.done,
        wrong,
        words: T.words,
        label: labelOf(board, path),
        onPath: playing ? changePath : undefined,
        onMiss: playing ? miss : undefined,
      });
      const left = roomCount(board) - path.length;
      $('rooms-left').textContent = String(left);
      let status = '';
      if (pathDone(board, path)) status = T.status.done;
      else if (wrong.length > 0) status = T.status.wrong;
      else if (path.at(-1) === board.end && left > 0) status = T.status['end-early'];
      else if (pathStuck(board, path)) status = T.status.stuck;
      $('rooms-status').textContent = flash ?? status;
      $('rooms-colors').hidden = !looking;
      if (looking) $('rooms-colors').replaceChildren(legend(board, path));
    }
    $('undo').disabled = !playing || round.moves.length === 0;
    $('reset').disabled = !playing || round.moves.length === 0;
    $('rooms-color').textContent = T.tool[looking ? 'on' : 'off'];
    $('rooms-color').setAttribute('aria-pressed', String(looking));
    frame.showWhy();
  }

  /** 길이 바뀌었다(긋거나 누르고 손을 뗐다) */
  function changePath(next) {
    const { round } = frame;
    if (!round || round.done || isJudge(round)) return;
    const { board } = round;
    flash = null;
    const before = round.path;
    if (!pathOk(board, next) || JSON.stringify(next) === JSON.stringify(before)) {
      draw();
      return;
    }
    round.moves = [...round.moves, { from: before.slice() }].slice(-MAX_MOVES);
    round.path = next.slice();
    round.strokeCount += 1;
    // 앞에서부터 같은 방의 수: 그 뒤로 지운 방이 있으면 되돌아간 것이고, 늘어난 방은 새로 지난 방이다
    let same = 0;
    while (same < Math.min(before.length, next.length) && before[same] === next[same]) same += 1;
    if (before.length > same) round.backCount += 1;
    round.stepCount += next.length - same;
    round.most = Math.max(round.most, next.length);
    frame.note('path', { length: next.length, head: next.at(-1) });
    if (pathDone(board, next)) {
      submit('done');
      return;
    }
    tell(before);
    draw();
    frame.persist();
  }

  /** 길을 바꾼 뒤에 선생님이 하는 말: 막혔을 때, 끝 방에 너무 일찍 왔을 때, 적힌 차례와 다를 때(새로 생겼을 때만) */
  function tell(before) {
    const { round } = frame;
    const { board, path } = round;
    const left = roomCount(board) - path.length;
    const wrongNow = wrongNumbers(board, path).filter((cell) => !wrongNumbers(board, before).includes(cell));
    if (wrongNow.length > 0) {
      const cell = wrongNow[0];
      const order = board.numbers.find(([at]) => at === cell)[1];
      frame.say(fill(T.play.wrong, { no: order, n: path.indexOf(cell) + 1 }));
      return;
    }
    if (left === 0) return;
    if (path.at(-1) === board.end) {
      frame.say(fill(T.play['end-early'], { n: left }));
      return;
    }
    if (!pathStuck(board, path)) return;
    const key = path.join('-');
    const same = round.stucks.includes(key);
    round.stuckCount += 1;
    round.stucks = [...round.stucks, key].slice(-MAX_STUCKS);
    frame.note('stuck', { left, same });
    frame.say(same ? T.play['stuck-same'] : fill(T.play.stuck, { n: left }));
  }

  /** 길의 끝과 이어지지 않은 방을 눌렀다: 판 아래에 한 줄로 알린다 */
  function miss() {
    const { round } = frame;
    if (!round || round.done) return;
    flash = T.status.miss;
    draw();
  }

  /** 가려 내기: 집을 눌러 고르거나 지운다 */
  function pick(index) {
    const { round } = frame;
    if (!round || round.done || !isJudge(round)) return;
    flash = null;
    const before = round.picked.slice();
    round.picked = round.picked.includes(index) ? round.picked.filter((item) => item !== index) : [...round.picked, index].sort((a, b) => a - b);
    round.moves = [...round.moves, { picked: before }].slice(-MAX_MOVES);
    round.moveCount += 1;
    frame.note('pick', { house: index, on: round.picked.includes(index) });
    draw();
    frame.persist();
  }

  /** 가려 내기의 답: 고른 집이 안 되는 집과 꼭 같으면 끝난다. 아니면 사실 하나만 말한다 */
  function judged() {
    const { round, solution } = frame;
    if (!round || round.done || !isJudge(round)) return;
    if (round.picked.length === 0) {
      frame.say(T.play['judge-none']);
      return;
    }
    const picked = round.picked.slice();
    const wrongPick = picked.find((index) => !solution.impossible.includes(index));
    const missed = solution.impossible.filter((index) => !picked.includes(index));
    const correct = wrongPick === undefined && missed.length === 0;
    const guess = correct ? null : wrongPick !== undefined ? 'possible-picked' : 'impossible-missed';
    round.judgeTries = [...round.judgeTries, picked];
    round.answers.push({ t: frame.stamp(), answer: `judge:${picked.join(',')}`, correct, guess });
    frame.note('answer', { answer: picked, correct, guess });
    if (correct) {
      frame.finish('solved');
      return;
    }
    round.wrongCount += 1;
    frame.persist();
    draw();
    frame.say(wrongPick !== undefined ? fill(T.play['judge-possible'], { no: wrongPick + 1 }) : T.play['judge-missed']);
  }

  /** 답: 다 지났다('done') 또는 "불가능해요"('impossible') */
  function submit(kind) {
    const { round, solution } = frame;
    if (round.done) return;
    const correct = kind === 'done' || solution.possible === false;
    const guess = correct ? null : 'impossible-on-possible';
    round.answers.push({ t: frame.stamp(), answer: kind, correct, guess });
    frame.note('answer', { answer: kind, correct, guess });
    if (correct) {
      frame.finish('solved');
      return;
    }
    // 되는 집이다. 틀렸다고 하지 않고 사실만 말한다. 판은 그대로 이어진다.
    round.impossibleCount += 1;
    round.wrongCount += 1;
    frame.persist();
    draw();
    frame.say(round.impossibleCount === 1 || round.most <= 1 ? T.play['possible-press'] : fill(T.play['possible-press-most'], { n: round.most }));
  }

  function undo() {
    const { round } = frame;
    if (round.done || round.moves.length === 0) return;
    const last = round.moves.at(-1);
    round.moves = round.moves.slice(0, -1);
    if (isJudge(round)) round.picked = last.picked.slice();
    else round.path = last.from.slice();
    round.undoCount += 1;
    flash = null;
    frame.note('undo');
    draw();
    frame.persist();
  }

  /** 처음으로: 길을 처음 방만 남기고 지운다(가려 내기는 고른 것을 모두 지운다). 되돌린 것도 무르기로 돌아올 수 있다 */
  function reset() {
    const { round } = frame;
    if (round.done || round.moves.length === 0) return;
    if (isJudge(round)) {
      round.moves = [...round.moves, { picked: round.picked.slice() }].slice(-MAX_MOVES);
      round.picked = [];
    } else {
      round.moves = [...round.moves, { from: round.path.slice() }].slice(-MAX_MOVES);
      round.path = [round.board.start];
    }
    round.resetCount += 1;
    flash = null;
    frame.note('reset');
    draw();
    frame.persist();
  }

  /** "색 켜기": 방에 바둑판처럼 두 색을 칠했다 지운다. 무엇을 알려 주는지는 말하지 않는다 */
  function toggleColor() {
    const { round } = frame;
    if (!round) return;
    round.colorOn = !round.colorOn;
    if (!round.done && round.colorOn) {
      round.colorShown = true;
      round.colorCount += 1;
    }
    if (!round.done) frame.note('color', { on: round.colorOn });
    draw();
    frame.keep();
  }

  // ---- 끝났을 때 하는 말: 한 일을 그대로 말한다 ----
  function rightLine(round, solution) {
    const parts = [];
    if (isJudge(round)) {
      const n = solution.impossible.length;
      parts.push(round.judgeTries.length <= 1 ? fill(T.right['judge-first'], { n }) : fill(T.right['judge-after'], { k: round.judgeTries.length, n }));
      return parts;
    }
    const last = round.answers.at(-1);
    if (last.answer === 'impossible') {
      parts.push(round.strokeCount > 0 ? fill(T.right['impossible-tried'], { n: round.strokeCount }) : T.right['impossible-untried']);
      return parts;
    }
    const n = roomCount(round.board);
    if (round.mode === 'numbers') parts.push(fill(T.right.numbers, { n }));
    else {
      const back = round.undoCount + round.resetCount + round.backCount;
      parts.push(back === 0 ? fill(T.right['done-clean'], { n }) : fill(T.right['done-back'], { k: back, n }));
    }
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

  /** 안 되는 까닭을 말로: 풀이 프로그램이 가린 까닭과 같은 말을 고른다 */
  function reasonLine(board, solution) {
    const { reason, detail } = solution;
    const n = roomCount(board);
    if (reason === 'color') {
      if (detail.detail === 'count') {
        const more = detail.counts[0] > detail.counts[1] ? 0 : 1;
        return fill(T.solution.reasons['color-count'], { face: T.colors.names[more], k: detail.counts[more], n: detail.counts[1 - more] });
      }
      if (detail.detail === 'minor') return fill(T.solution.reasons['color-minor'], { n, face: T.colors.names[detail.major] });
      return fill(T.solution.reasons['color-same'], { n });
    }
    if (reason === 'cut') {
      if (detail.role === 'start') return T.solution.reasons['cut-start'];
      if (detail.role === 'end') return T.solution.reasons['cut-end'];
      return detail.same && detail.parts === 2 ? T.solution.reasons['cut-same'] : fill(T.solution.reasons['cut-room'], { n: detail.parts });
    }
    if (reason === 'deadend' || reason === 'split' || reason === 'search') return T.solution.reasons[reason];
    return T.solution.unknown;
  }

  /** 까닭을 보여 주는 그림: 색이면 색을 켜고 색마다 방 수를, 생김새면 그 방에 두 겹 고리를 */
  function reasonView(board, solution) {
    const view = { ...board, words: T.words };
    if (solution.reason === 'color') return { view: { ...view, colorOn: true }, counts: solution.detail.counts.map((n) => fill(T.colors.count, { n })) };
    if (solution.reason === 'deadend') return { view: { ...view, rings: solution.detail.cells }, counts: null };
    if (solution.reason === 'cut') return { view: { ...view, rings: [solution.detail.cell] }, counts: null };
    return { view, counts: null };
  }

  /** "왜 그럴까?": 선생님이 맨 위 왼쪽에서 맨 아래 오른쪽까지 가 보다가 번호와 색을 붙여 본 이야기, 그리고 색이 맞아도 안 되는 집 */
  function whyPages() {
    return T.why.map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다(단추를 보일지 따질 때마다 그리지 않는다).
      get nodes() {
        return [
          rowOf(
            slide.figures.map((item) =>
              houseCard(
                { w: item.w, h: item.h, walls: item.walls, start: item.start, end: item.end, numbers: [], path: item.path ?? [], colorOn: item.colorOn ?? false, steps: item.steps ?? false, rings: item.rings ?? [], words: T.words },
                item.note,
                { counts: item.counts ? item.counts.map((n) => fill(T.colors.count, { n })) : null, big: slide.figures.length === 1 },
              ),
            ),
          ),
        ];
      },
    }));
  }

  /** 풀이: 되는 집은 길 하나, 안 되는 집은 까닭의 그림, 가려 내기는 집마다 */
  function solutionPages(round, solution) {
    const { board } = round;
    if (isJudge(round)) {
      const root = document.createElement('div');
      drawJudge(root, {
        houses: board.houses,
        picked: solution.impossible,
        colorOn: true,
        words: { ...T.words, pick: null },
        name: (index) => fill(T.houseName, { no: index + 1 }),
        paths: (index) => solution.houses[index].path ?? [],
        rings: (index) => {
          const one = solution.houses[index];
          if (one.reason === 'deadend') return one.detail.cells;
          if (one.reason === 'cut') return [one.detail.cell];
          return [];
        },
        marks: (index) => {
          const one = solution.houses[index];
          if (one.possible) return T.solution.marks.possible;
          return T.solution.marks[one.reason] ?? null;
        },
      });
      return [{ say: T.solution.judge, nodes: [root] }];
    }
    if (solution.possible === true) {
      const say = round.mode === 'numbers' ? T.solution.numbers : fill(T.solution.possible, { n: roomCount(board) });
      return [{ say, nodes: [rowOf([houseCard({ ...board, path: solution.path, steps: true, words: T.words }, '', { big: true })])] }];
    }
    if (solution.possible === null) return [{ say: T.solution.unknown, nodes: [rowOf([houseCard({ ...board, words: T.words }, '', { big: true })])] }];
    const { view, counts } = reasonView(board, solution);
    return [{ say: `${T.solution.impossible} ${reasonLine(board, solution)}`, nodes: [rowOf([houseCard(view, '', { counts, big: true })])] }];
  }

  // ---- 직접 만들기: 크기를 정하고, 방을 눌러 처음 방과 끝 방과 정원을 정한다 ----
  const draftBoard = () => ({ kind: 'house', w: draft.w, h: draft.h, walls: draft.walls.slice().sort((a, b) => a - b), start: draft.start, end: draft.end, numbers: [] });
  const draftReady = () => draft && draft.start !== null && draft.end !== null && checkHouse(draftBoard()) === null;

  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    if (saved && checkHouse({ ...saved, kind: 'house', numbers: [] }, { open: true }) === null) return { ...FIRST_DRAFT, w: saved.w, h: saved.h, walls: saved.walls.slice(), start: saved.start, end: saved.end };
    return { ...FIRST_DRAFT, walls: [] };
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    tool = draft.start === null ? 'start' : draft.end === null ? 'end' : 'garden';
    $('rooms-make-result').textContent = '';
    $('rooms-make-picture').replaceChildren();
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function drawMake() {
    for (const button of $('rooms-make-tools').querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.tool === tool));
    $('rooms-make-w').textContent = fill(T.make.size, { n: draft.w });
    $('rooms-make-h').textContent = fill(T.make.size, { n: draft.h });
    $('rooms-make-w-fewer').disabled = draft.w <= MIN_SIZE;
    $('rooms-make-w-more').disabled = draft.w >= MAX_SIZE;
    $('rooms-make-h-fewer').disabled = draft.h <= MIN_SIZE;
    $('rooms-make-h-more').disabled = draft.h >= MAX_SIZE;
    $('rooms-make-clear').disabled = draft.walls.length === 0;
    $('rooms-make-count').textContent = fill(T.make.count, { n: draft.w * draft.h - draft.walls.length });
    $('rooms-make-solve').disabled = !draftReady();
    $('rooms-make-play').disabled = !draftReady();
    drawHouse($('rooms-make-board'), { ...draftBoard(), words: T.words, label: labelOf(draftBoard(), []), onCell: tapDraft });
  }

  function changeDraft(next) {
    draft = next;
    $('rooms-make-result').textContent = '';
    $('rooms-make-picture').replaceChildren();
    log.saveDraft({ w: draft.w, h: draft.h, walls: draft.walls, start: draft.start, end: draft.end }, FORMAT);
    drawMake();
  }

  /** 방을 눌렀다: 고른 일(처음 방, 끝 방, 정원)을 한다. 정원은 다시 누르면 방으로 돌아온다 */
  function tapDraft(cell) {
    const walls = draft.walls.includes(cell) ? draft.walls.filter((item) => item !== cell) : [...draft.walls, cell];
    if (tool === 'garden') {
      if (draft.w * draft.h - walls.length < 3) {
        frame.talkers.make.say(T.make.few);
        return;
      }
      changeDraft({ ...draft, walls, start: draft.start === cell ? null : draft.start, end: draft.end === cell ? null : draft.end });
      return;
    }
    // 처음 방이나 끝 방으로 정하면 그 칸이 정원이었어도 방이 된다. 같은 방이 둘 다일 수는 없다.
    const rooms = draft.walls.filter((item) => item !== cell);
    if (tool === 'start') changeDraft({ ...draft, walls: rooms, start: cell, end: draft.end === cell ? null : draft.end });
    else changeDraft({ ...draft, walls: rooms, end: cell, start: draft.start === cell ? null : draft.start });
    // 처음 방을 정하면 다음은 끝 방을 정하게 한다
    if (tool === 'start' && draft.end === null) {
      tool = 'end';
      drawMake();
    }
  }

  /** 크기를 바꾼다. 정원과 처음 방, 끝 방은 같은 자리(가로, 세로)에 그대로 두고, 집 밖으로 나간 것은 버린다 */
  function resize(w, h) {
    if (w < MIN_SIZE || h < MIN_SIZE || w > MAX_SIZE || h > MAX_SIZE) return;
    const move = (cell) => {
      if (cell === null) return null;
      const [x, y] = [cell % draft.w, Math.floor(cell / draft.w)];
      return x < w && y < h ? y * w + x : null;
    };
    const walls = draft.walls.map(move).filter((cell) => cell !== null);
    if (w * h - walls.length < 3) return;
    changeDraft({ ...draft, w, h, walls, start: move(draft.start), end: move(draft.end) });
  }

  /** 아이가 만든 집을 풀이 프로그램으로 따져서 알려 준다. 되면 길을, 안 되면 까닭과 그 그림을 보여 준다 */
  function solveDraft() {
    if (!draftReady()) {
      frame.talkers.make.say(T.make.need);
      return;
    }
    const board = draftBoard();
    const result = solve(board);
    let line;
    let card;
    if (result.possible === true) {
      line = T.make.possible;
      card = houseCard({ ...board, path: result.path, steps: true, words: T.words }, '');
    } else if (result.possible === false) {
      line = `${T.make.impossible} ${reasonLine(board, result)}`;
      const { view, counts } = reasonView(board, result);
      card = houseCard(view, '', { counts });
    } else {
      line = T.make.unknown;
      card = null;
    }
    $('rooms-make-result').textContent = line;
    $('rooms-make-picture').replaceChildren(...(card ? [card] : []));
    const now = new Date().toISOString();
    log.saveRecord({
      kind: 'made',
      v: 1,
      id: log.newId('m'),
      format: FORMAT,
      startedAt: now,
      endedAt: now,
      board,
      solution: { possible: result.possible, reason: result.reason, detail: result.detail, path: result.path },
    });
    log.flush();
    frame.talkers.make.say(line);
  }

  /** 다 만든 집(공책에 남기거나 해 볼 판). 처음 방과 끝 방을 아직 정하지 않았으면 null */
  const madeBoard = () => (draftReady() ? draftBoard() : null);

  function playDraft() {
    const board = madeBoard();
    if (board) frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board });
    else frame.talkers.make.say(T.make['keep-not-yet']);
  }

  // ---- 단추 잇기 ----
  $('rooms-impossible').addEventListener('click', () => submit('impossible'));
  $('rooms-judged').addEventListener('click', judged);
  $('rooms-color').addEventListener('click', toggleColor);
  $('rooms-make-tools').addEventListener('click', (event) => {
    const next = event.target.closest('button')?.dataset.tool;
    if (!TOOLS.includes(next)) return;
    tool = next;
    drawMake();
  });
  $('rooms-make-w-fewer').addEventListener('click', () => resize(draft.w - 1, draft.h));
  $('rooms-make-w-more').addEventListener('click', () => resize(draft.w + 1, draft.h));
  $('rooms-make-h-fewer').addEventListener('click', () => resize(draft.w, draft.h - 1));
  $('rooms-make-h-more').addEventListener('click', () => resize(draft.w, draft.h + 1));
  $('rooms-make-clear').addEventListener('click', () => changeDraft({ ...draft, walls: [] }));
  $('rooms-make-solve').addEventListener('click', solveDraft);
  $('rooms-make-play').addEventListener('click', playDraft);

  /** 판의 처음 값(새 판, 공책의 그림) */
  function begin({ level, custom, board }) {
    const start = copyBoard(board);
    return {
      mode: custom ? 'mix' : rungOf(level).mode,
      board: start, // 판: 집(크기, 정원, 처음 방, 끝 방, 적힌 차례) 또는 가려 낼 집들
      path: start.kind === 'judge' ? [] : [start.start], // 지금까지 그은 길(처음 방부터)
      picked: [], // 가려 내기에서 고른 집의 번호
      moves: [], // 무르기에 쓰는 차례: { from: 그 전의 길 } 또는 { picked: 그 전에 고른 것 }
      strokeCount: 0, // 길을 바꾼 수(긋거나 누른 것)
      stepCount: 0, // 길을 늘린 방의 수
      backCount: 0, // 지나온 방을 누르거나 되돌아가 길을 줄인 수
      moveCount: 0, // 가려 내기에서 집을 고르거나 지운 수
      undoCount: 0,
      resetCount: 0,
      most: 1, // 지금까지 가장 많이 지난 방의 수
      stuckCount: 0, // 더 갈 방이 없었던 수
      stucks: [], // 그때의 길
      impossibleCount: 0, // 되는 집에 "불가능해요"를 누른 수
      judgeTries: [], // 가려 내기에서 "다 골랐어요"를 누를 때마다 고른 집들
      wrongCount: 0, // 사실과 다른 답의 수(되는 집의 "불가능해요", 맞지 않게 고른 가려 내기)
      colorOn: false, // 지금 색을 켰는가
      colorShown: false, // 색을 한 번이라도 켜 보았는가
      colorCount: 0, // 색을 켠 수
    };
  }

  return {
    id: FORMAT,
    T,
    padId: 'rooms-pad',
    makeId: 'make-rooms',
    // 집이 위아래로 커서 세로가 모자라다. 규칙 글은 왼쪽 칸 맨 위에 두고 집을 크게 그린다.
    ruleAside: true,
    homeIds: { sample: 'home-rooms-sample', blank: 'home-rooms-blank', ask: 'home-rooms-ask', play: 'home-rooms-play', pick: 'home-rooms-pick', make: 'home-rooms-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    begin,
    solve: (round) => solutionOf(round.board),
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (!MODES.includes(saved.mode) || checkBoard(saved.board) !== null) return false;
      const judge = saved.board.kind === 'judge';
      if (judge !== (saved.mode === 'judge')) return false;
      if (!Array.isArray(saved.picked) || !saved.picked.every((index) => judge && Number.isInteger(index) && index >= 0 && index < saved.board.houses.length)) return false;
      if (judge ? !Array.isArray(saved.path) || saved.path.length > 0 : !pathOk(saved.board, saved.path)) return false;
      if (!Array.isArray(saved.moves) || !saved.moves.every((move) => (judge ? Array.isArray(move?.picked) : pathOk(saved.board, move?.from)))) return false;
      if (![saved.stucks, saved.judgeTries].every(Array.isArray)) return false;
      if (![saved.colorOn, saved.colorShown].every((value) => typeof value === 'boolean')) return false;
      return [saved.strokeCount, saved.stepCount, saved.backCount, saved.moveCount, saved.undoCount, saved.resetCount, saved.most, saved.stuckCount, saved.impossibleCount, saved.wrongCount, saved.colorCount].every(count);
    },
    /** 판 화면에서 이 형식의 것(집, 판 아래의 글, 색 켜기 단추)을 보이거나 감춘다 */
    showParts(on) {
      $('rooms-board').hidden = !on;
      $('rooms-count').hidden = !on;
      $('rooms-color').hidden = !on;
      if (!on) $('rooms-colors').hidden = true;
      if (on) {
        // 앞의 형식(켜고 끄기와 숫자 마술 등)이 감춰 둔 무르기와 되돌리기를 여기서 다시 보이게 한다.
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
    hints: (round) => T.hints[hintKey(round)],
    touched: (round) => round.strokeCount > 0 || round.moveCount > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view(round) {
      return { path: round.path.slice(), picked: round.picked.slice(), left: isJudge(round) ? null : roomCount(round.board) - round.path.length, colorOn: round.colorOn };
    },
    /** 이 판보다 작은 판: 답의 종류가 같은(되는 집이면 되는 집, 안 되는 집이면 같은 까닭의) 더 작은 집 */
    smaller: (round, turn) => smallerRooms({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      const judge = isJudge(round);
      const answer = judge ? { possible: solution.possible, impossible: solution.impossible, reasons: solution.houses.map((one) => one.reason) } : { possible: solution.possible, reason: solution.reason, detail: solution.reason === 'color' ? solution.detail.detail : solution.reason === 'cut' ? solution.detail.role : null };
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        solution: answer,
        // "색 켜기"는 도구라서 힌트로 세지 않는다. 켜 보았는지와 켠 수만 따로 적는다.
        colorShown: round.colorShown,
        colorCount: round.colorCount,
        colorOn: round.colorOn,
        // 판을 떠날 때의 길(가려 내기는 고른 집)과 남은 방
        path: round.path,
        picked: round.picked,
        left: judge ? null : roomCount(round.board) - round.path.length,
        most: round.most,
        strokeCount: round.strokeCount,
        stepCount: round.stepCount,
        backCount: round.backCount,
        moveCount: round.moveCount,
        undoCount: round.undoCount,
        resetCount: round.resetCount,
        stuckCount: round.stuckCount,
        impossibleCount: round.impossibleCount,
        judgeTries: round.judgeTries,
        // 수준 맞추기가 보는 "틀린 답"의 수
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
      if (board.kind === 'judge') drawJudge(root, { houses: board.houses, words: T.words, small: true });
      else drawHouse(root, { ...board, words: T.words, small: true });
    },
    drawBlank(root) {
      drawHouse(root, { ...T.blank, small: true });
    },
    drawResume(root, saved) {
      const { board } = saved;
      if (board.kind === 'judge') drawJudge(root, { houses: board.houses, picked: saved.picked ?? [], words: T.words, small: true });
      else drawHouse(root, { ...board, path: saved.path ?? [], colorOn: saved.colorOn === true, words: T.words, small: true });
    },
    /** 판 고르기의 그림: 단계마다 그 단계의 집 하나(가려 내기는 집 둘) */
    drawLevelPicture(root, entry) {
      const picture = entry.picture;
      if (picture.blank) drawHouse(root, { ...T.blank, small: true });
      else if (picture.houses) drawJudge(root, { houses: picture.houses.map((item) => ({ ...item, numbers: [] })), picked: picture.picked ?? [], words: T.words, small: true });
      else drawHouse(root, { ...picture, numbers: picture.numbers ?? [], path: picture.path ?? [], words: T.words, small: true });
    },
    showMake,
    /** 직접 만들기에서 다 만든 집. 처음 방과 끝 방을 정하지 않았으면 null(공책에 남기기가 쓴다) */
    madeBoard,
  };
}
