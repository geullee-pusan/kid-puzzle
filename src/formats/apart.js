// 닿지 않게 놓기와 구역 긋기: 판 화면에서 이 형식이 맡는 부분(판, 답하는 칸, 끝났을 때 하는 말, 풀이와 설명)과 직접 만들기.
// 판을 시작하고 끝내는 일, 시계, "막혔어요"와 힌트, "더 작은 판으로", 나가기, 끝난 뒤 고르기는 틀(src/main.js)이 맡는다.
// 화면에 나오는 글은 대본(src/content/apart.json)과 index.html에 있다. 이 파일에는 글을 적지 않는다.
//
// 이 형식에는 틀린 답이 없다. 더 많이 놓는 답을 찾는 형식이다(조각 못 들어가게 막기와 같은 틀).
//   칸을 누르면 구슬이 놓이고, 놓인 구슬을 누르면 빠진다. 놓인 구슬과 닿는 칸에는 놓이지 않는다(닿는 구슬을 표시하고 사실만 말한다).
//   더 놓을 자리가 없어지면 한 번이 끝난다. 그때 놓은 수를 사실로 말한다.
// 판의 종류(mode)
//   place  구슬만 놓는다(1~3단계, 직접 만든 판). 가장 많이 놓는 수에 닿으면 끝난다. 아니면 "더 많이 놓을 수 있을까요?"라고 묻는다
//   shown  선생님이 그어 둔 구역이 있다(4단계). 구역은 가장 적은 구역이라 구역 수가 가장 많이 놓는 수다. 구역마다 하나씩 놓으면 끝난다
//   prove  아이가 구역을 긋는다(5단계). 판을 서로 다 닿는 칸 묶음으로 빠짐없이 나누고, 구역마다 구슬이 하나씩 있으면 끝난다
//          (구역 수 = 구슬 수이면 둘 다 더 나아질 수 없다). 구슬이 둘 들어가는 구역은 그 두 칸을 보여 준다
// 판은 그대로 두므로 구슬을 빼고 다시 놓아도 되고, 처음부터 다시 해도 되고, "여기까지 할래요"로 끝내도 된다.
// 놓은 구슬의 수는 이 놀이의 내용이다. 이 판에서 가장 많이 놓은 수만 판 아래에 적는다.
// "닿는 칸 보기"는 도구다. 구슬과 닿는 빈칸에 빗금을 긋고, 더 놓을 수 있는 칸의 수를 적는다. 처음 누를 때 힌트 하나를 연 것으로 적는다.
import T from '../content/apart.json';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf } from '../core/apart-ladder.js';
import { MIN_SIZE, checkBoard, conflictsOf, copyBoard, freeCells, marblesOk, neighboursOf, partitionOf, solve, touchedCells, xyOf } from '../core/apart.js';
import { smallerApart } from '../core/smaller.js';
import { fill, ordinal } from '../core/text.js';
import { boardCard, drawBoard } from '../ui/apart-board.js';

const FORMAT = 'apart';
const MODES = ['place', 'shown', 'prove'];
const PENS = ['marble', 'region'];
/** 기록에 남기는 무르기 차례와 끝난 모습의 수의 위 끝 */
const MAX_MOVES = 300;
const MAX_TRIES = 60;
const FIRST_DRAFT = { w: 5, h: 5, holes: [], touch: 'king' };
/** 직접 만들기에서 고를 수 있는 가장 큰 가로와 세로. 판 화면(1180×820)에서 칸 하나가 44픽셀보다 작아지지 않게 7칸까지다(풀이 프로그램은 8칸까지 따진다) */
const MAKE_MAX = 7;

const sorted = (cells) => cells.slice().sort((a, b) => a - b);
const keyOf = (marbles) => sorted(marbles).join(',');

/**
 * @param {object} frame 틀이 건네주는 것. 지금 하는 판(frame.round)과 풀이(frame.solution), 기록하고 말하는 함수들
 */
export function createApart(frame) {
  const { $, log } = frame;
  let flash = null; // 판 아래에 잠깐 적는 한 줄과 판의 표시({ line, refused, hit }). 다음에 무엇을 누르면 지운다
  let draft = null; // 직접 만들기에서 만들던 판
  let made = null; // 직접 만들기에서 선생님이 따진 것(판을 고치면 지운다)

  const count = (value) => Number.isInteger(value) && value >= 0;
  /** 지금 판에 그어진 구역: 선생님이 그어 둔 구역(shown)이나 아이가 그은 구역(prove) */
  const regionsOf = (round) => (round.mode === 'shown' ? round.board.regions : round.regions);
  const ruleKey = (round) => (round.mode === 'place' ? round.board.touch : round.mode);

  function labelOf(board, marbles, regions) {
    const owner = new Map();
    regions.forEach((region, index) => region.forEach((cell) => owner.set(cell, index + 1)));
    return (cell) => {
      const [x, y] = xyOf(board, cell);
      const what = marbles.includes(cell) ? T.labels.marble : T.labels.empty;
      const face = owner.has(cell) ? fill(T.labels.region, { face: what, k: owner.get(cell) }) : what;
      return fill(T.labels.cell, { no: ordinal(y + 1), f: ordinal(x + 1), face });
    };
  }

  // ---- 판 ----
  function draw() {
    const { round } = frame;
    const { board } = round;
    const playing = !round.done;
    const regions = regionsOf(round);
    const state = partitionOf(board, regions);
    const pen = round.mode === 'prove' && playing ? round.pen : 'marble';
    drawBoard($('apart-board'), {
      w: board.w,
      h: board.h,
      holes: board.holes,
      marbles: round.marbles,
      regions,
      pairs: state.pairs,
      near: playing && round.nearOn ? touchedCells(board, round.marbles) : [],
      refused: playing ? (flash?.refused ?? null) : null,
      hit: playing ? (flash?.hit ?? []) : [],
      pen,
      label: labelOf(board, round.marbles, regions),
      onCell: playing ? tap : undefined,
      onRegion: playing && round.mode === 'prove' ? drawRegion : undefined,
    });
    $('apart-now').textContent = String(round.marbles.length);
    $('apart-best-line').hidden = round.best === null;
    $('apart-best').textContent = round.best === null ? '' : String(round.best);
    $('apart-regions-line').hidden = round.mode === 'place';
    $('apart-regions').textContent = String(regions.length);
    $('apart-status').textContent = flash?.line ?? statusOf(round, state, playing);
    $('undo').disabled = !playing || round.moves.length === 0;
    $('reset').disabled = !playing || (round.marbles.length === 0 && round.regions.length === 0);
    const full = freeCells(board, round.marbles).length === 0;
    $('apart-again').hidden = !(playing && full && round.completions.length > 0);
    $('apart-stop').hidden = !(playing && round.best !== null);
    // 구역 긋기는 prove 판에만 있다
    $('apart-pens').hidden = round.mode !== 'prove';
    $('apart-pen-note').hidden = round.mode !== 'prove';
    for (const button of $('apart-pens').querySelectorAll('button')) {
      button.setAttribute('aria-pressed', String(button.dataset.pen === round.pen));
      button.disabled = !playing;
    }
    $('apart-pen-note').textContent = round.pen === 'region' ? T.play['pen-region'] : T.play['pen-marble'];
    // 끝난 판에서는 도구가 꺼져 있다(단추도 누를 수 없다).
    const looking = playing && round.nearOn;
    $('apart-near').textContent = T.tool[looking ? 'on' : 'off'];
    $('apart-near').setAttribute('aria-pressed', String(looking));
    $('apart-near').disabled = round.done;
    // 오른쪽 칸: 닿는 칸의 그림(가운데 구슬과 닿는 칸에 빗금)
    const sample = { w: 3, h: 3, holes: [], touch: board.touch, regions: null };
    drawBoard($('apart-touch-picture'), { w: 3, h: 3, marbles: [4], near: neighboursOf(sample, 4), small: true });
    $('apart-touch-note').textContent = T.touchNote[board.touch];
    frame.showWhy();
  }

  function statusOf(round, state, playing) {
    if (!playing) return '';
    if (round.mode === 'prove' && round.pen === 'region') {
      if (state.bad.length > 0) return T.status.two;
      if (state.missing.length === 0) return fill(T.status.covered, { n: round.regions.length });
      if (round.regions.length === 0) return T.status.draw;
      return fill(T.status.missing, { n: state.missing.length });
    }
    if (round.marbles.length === 0) return T.status.empty;
    const free = freeCells(round.board, round.marbles).length;
    if (free === 0) return T.status.full;
    return round.nearOn ? fill(T.status.free, { n: free }) : '';
  }

  /** 지금 모습을 무르기 차례에 넣는다 */
  function remember(round) {
    round.moves = [...round.moves, { marbles: round.marbles.slice(), regions: round.regions.map((region) => region.slice()) }].slice(-MAX_MOVES);
  }

  /** 칸을 눌렀다: 빈칸이면 구슬을 놓고(닿으면 놓지 않는다), 구슬이 있으면 뺀다. 더 놓을 자리가 없어졌으면 한 번이 끝난다. */
  function tap(cell) {
    const { round } = frame;
    if (!round || round.done || round.board.holes.includes(cell)) return;
    flash = null;
    if (round.marbles.includes(cell)) {
      remember(round);
      round.marbles = round.marbles.filter((item) => item !== cell);
      round.moveCount += 1;
      round.removeCount += 1;
      frame.note('marble', { cell, on: false });
      draw();
      frame.persist();
      return;
    }
    const hit = conflictsOf(round.board, round.marbles, cell);
    if (hit.length > 0) {
      // 놓지 않는다. 닿는 구슬을 표시하고 사실만 말한다.
      round.refusedCount += 1;
      frame.note('refused', { cell, hit });
      flash = { line: T.status.touch, refused: cell, hit };
      draw();
      frame.persist();
      frame.say(T.play.touch);
      return;
    }
    remember(round);
    round.marbles = sorted([...round.marbles, cell]);
    round.moveCount += 1;
    round.placeCount += 1;
    frame.note('marble', { cell, on: true });
    if (closes(round, true)) return;
    if (freeCells(round.board, round.marbles).length === 0) {
      complete();
      return;
    }
    draw();
    frame.persist();
  }

  /** 더 놓을 자리가 없어졌다: 한 번이 끝났다. 놓은 수를 말하고, 가장 많이 놓은 것이 아니면 더 많이 놓을 수 있을지 묻는다. */
  function complete() {
    const { round, solution } = frame;
    const k = round.marbles.length;
    const before = round.best;
    const key = keyOf(round.marbles);
    const again = round.tries.includes(key);
    round.completions.push(k);
    if (!again) round.tries = [...round.tries, key].slice(-MAX_TRIES);
    if (before === null || k > before) {
      round.best = k;
      round.bestMarbles = round.marbles.slice();
    }
    const reached = k === solution.best;
    const guess = reached ? null : 'fewer-than-best';
    round.answers.push({ t: frame.stamp(), answer: `marbles:${k}`, correct: reached, guess });
    frame.note('answer', { answer: `marbles:${k}`, correct: reached, guess, again });
    if (reached && round.mode !== 'prove') {
      frame.finish('solved');
      return;
    }
    // 틀렸다고 하지 않는다. 놓은 수를 말하고 더 많이 놓을 수 있을지 묻는다. 판은 그대로 둔다.
    frame.persist();
    draw();
    if (reached) {
      frame.say(fill(T.play['prove-best'], { k }));
      return;
    }
    if (again) {
      frame.say(fill(T.play.same, { k }));
      return;
    }
    if (round.mode === 'shown') {
      const filled = round.board.regions.filter((region) => region.some((cell) => round.marbles.includes(cell))).length;
      frame.say(fill(T.play['shown-left'], { k, n: round.board.regions.length - filled }));
      return;
    }
    frame.say(fill(before !== null && k > before ? T.play['more-up'] : T.play.more, { k }));
  }

  /**
   * prove 판: 구역이 판을 빠짐없이 나누고, 모든 구역에 구슬이 하나만 들어가고, 구역 수와 구슬 수가 같으면 끝난다.
   * 끝났으면 true(판을 끝냈다)를 돌려준다. placed: 방금 구슬을 놓아서 끝났는가(그러면 한 번이 끝난 것으로도 적는다)
   */
  function closes(round, placed) {
    if (round.mode !== 'prove') return false;
    const state = partitionOf(round.board, round.regions);
    if (!state.complete || round.regions.length !== round.marbles.length) return false;
    // 구슬 수가 구역 수와 같으면 더 놓을 자리가 없다(가장 많이 놓은 것이다). 방금 놓아서 그렇게 되었으면 한 번이 끝난 것으로도 적는다.
    const k = round.marbles.length;
    round.closed = true;
    if (placed) round.completions.push(k);
    if (round.best === null || k > round.best) {
      round.best = k;
      round.bestMarbles = round.marbles.slice();
    }
    round.answers.push({ t: frame.stamp(), answer: `closed:${k}`, correct: true, guess: null });
    frame.note('answer', { answer: `closed:${k}`, correct: true });
    frame.finish('solved');
    return true;
  }

  /** 구역 긋기: 그은 칸들을 한 구역으로 만든다(다른 구역에 있던 칸은 그 구역에서 빠진다). 칸 하나를 누르면 그 칸의 구역을 지우거나 한 칸 구역을 만든다. */
  function drawRegion(cells, { tap: tapped }) {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'prove') return;
    flash = null;
    const picked = sorted([...new Set(cells.filter((cell) => !round.board.holes.includes(cell)))]);
    if (picked.length === 0) return;
    remember(round);
    const inside = round.regions.findIndex((region) => region.includes(picked[0]));
    if (tapped && picked.length === 1 && inside >= 0) {
      round.regions = round.regions.filter((_, index) => index !== inside);
      frame.note('region', { cells: picked, on: false });
    } else {
      const rest = round.regions.map((region) => region.filter((cell) => !picked.includes(cell))).filter((region) => region.length > 0);
      round.regions = [...rest, picked].sort((a, b) => a[0] - b[0]);
      frame.note('region', { cells: picked, on: true });
    }
    round.regionCount += 1;
    round.moveCount += 1;
    if (closes(round, false)) return;
    draw();
    frame.persist();
    const state = partitionOf(round.board, round.regions);
    const mine = round.regions.findIndex((region) => region.includes(picked[0]));
    if (mine >= 0 && state.pairs[mine]) {
      frame.say(T.play.two);
      return;
    }
    if (state.complete) frame.say(fill(T.play.covered, { n: round.regions.length, k: round.marbles.length }));
  }

  /** 구슬 놓기와 구역 긋기를 바꾼다 */
  function setPen(pen) {
    const { round } = frame;
    if (!round || round.done || round.mode !== 'prove' || !PENS.includes(pen) || round.pen === pen) return;
    round.pen = pen;
    round.penCount += 1;
    flash = null;
    frame.note('pen', { pen });
    draw();
    frame.persist();
  }

  /** "여기까지 할래요": 지금까지 가장 많이 놓은 것으로 판을 끝낸다. 이것도 끝까지 한 판이다. */
  function stop() {
    const { round } = frame;
    if (round.done || round.best === null) return;
    round.stopped = true;
    frame.note('stop', { best: round.best });
    frame.finish('solved');
  }

  function undo() {
    const { round } = frame;
    if (round.done || round.moves.length === 0) return;
    const last = round.moves.at(-1);
    round.marbles = last.marbles.slice();
    round.regions = last.regions.map((region) => region.slice());
    round.moves = round.moves.slice(0, -1);
    round.undoCount += 1;
    flash = null;
    frame.note('undo');
    if (closes(round, false)) return;
    draw();
    frame.persist();
  }

  /** 처음으로: 구슬과 그은 구역을 모두 지운다. 더 놓을 자리가 없는 모습에서였다면 "다시 해 보기"로 적는다. 무르기로 돌아올 수 있다 */
  function reset() {
    const { round } = frame;
    if (round.done || (round.marbles.length === 0 && round.regions.length === 0)) return;
    const full = round.marbles.length > 0 && freeCells(round.board, round.marbles).length === 0;
    remember(round);
    round.marbles = [];
    round.regions = [];
    if (full) {
      round.retryCount += 1;
      frame.note('again');
    } else {
      round.resetCount += 1;
      frame.note('reset');
    }
    flash = null;
    draw();
    frame.persist();
  }

  /** "처음부터 다시 해 볼래요": 구슬만 모두 뺀다(그은 구역은 그대로 둔다) */
  function again() {
    const { round } = frame;
    if (round.done || round.marbles.length === 0) return;
    remember(round);
    round.marbles = [];
    round.retryCount += 1;
    flash = null;
    frame.note('again');
    draw();
    frame.persist();
  }

  /** "닿는 칸 보기": 구슬과 닿는 빈칸에 빗금을 긋고, 더 놓을 수 있는 칸의 수를 판 아래에 적는다. */
  function toggleNear() {
    const { round } = frame;
    if (!round || round.done) return;
    round.nearOn = !round.nearOn;
    if (round.nearOn) {
      round.nearShown = true;
      round.nearCount += 1;
    }
    frame.note('near', { on: round.nearOn });
    draw();
    frame.keep();
  }

  /** 끝났을 때 하는 말: 한 일을 그대로 말한다(놓은 수, 몇 번 다시 해 봤는지). */
  function rightLine(round, solution) {
    const retries = Math.max(0, round.completions.length - 1);
    if (round.stopped) {
      const parts = [];
      if (retries > 0) parts.push(fill(T.right['stopped-tries'], { n: retries }));
      parts.push(fill(T.right.stopped, { k: round.best }));
      return parts;
    }
    const key = round.mode === 'prove' ? 'proved' : round.mode === 'shown' ? 'shown' : 'best';
    const parts = [fill(T.right[key], { k: solution.best })];
    parts.push(retries === 0 ? T.right['first-try'] : fill(T.right.after, { n: retries }));
    // 가장 많이 놓아 처음 끝낸 판이면 "왜 그럴까?"가 생겼다고 알려 준다.
    const reached = frame.records().filter((record) => record.kind === 'round' && record.format === FORMAT && record.reachedBest === true && !record.custom);
    if (!round.custom && !round.side && reached.length === 1) parts.push(T.right['why-invite']);
    return parts;
  }

  // ---- 판 위에 겹쳐 보여 주는 것: 풀이, "왜 그럴까?" ----
  function rowOf(cards) {
    const row = document.createElement('div');
    row.className = 'figure-row';
    row.append(...cards);
    return row;
  }

  /** 그림 하나의 판(구슬이 둘 들어가는 구역은 점선으로) */
  function figureView(item) {
    const board = { w: item.w, h: item.h, holes: item.holes ?? [], touch: item.touch, regions: null };
    const regions = item.regions ?? [];
    return {
      w: board.w,
      h: board.h,
      holes: board.holes,
      marbles: item.marbles ?? [],
      regions,
      pairs: partitionOf(board, regions).pairs,
      near: item.near ? touchedCells(board, item.marbles ?? []) : [],
    };
  }

  /** "왜 그럴까?": 선생님이 어떻게 알아챘는지의 이야기 */
  function whyPages() {
    return T.why.map((slide) => ({
      say: slide.say,
      // 그림은 종이를 펼칠 때 그린다(단추를 보일지 따질 때마다 그리지 않는다).
      get nodes() {
        return [rowOf(slide.figures.map((item) => boardCard(figureView(item), item.note)))];
      },
    }));
  }

  /** 판과 풀이로 그림 둘: 가장 많이 놓은 한 가지와, 가장 적은 구역으로 나눈 판 */
  function solvedCards(board, result) {
    const base = { w: board.w, h: board.h, holes: board.holes };
    const cards = [boardCard({ ...base, marbles: result.example }, fill(T.solution.placed, { k: result.best }))];
    if (result.closes) cards.push(boardCard({ ...base, marbles: result.example, regions: result.regions }, fill(T.solution.regions, { n: result.cover })));
    return cards;
  }

  /** 풀이: 가장 많이 놓는 한 가지 방법과, 구역으로 보일 수 있으면 그 구역 */
  function solutionPages(round, solution) {
    const say = fill(solution.closes ? T.solution.say : T.solution.gap, { k: solution.best, n: solution.cover });
    return [{ say, nodes: [rowOf(solvedCards(round.board, solution))] }];
  }

  // ---- 직접 만들기: 판의 크기와 닿는 약속을 고르고, 칸을 눌러 판에서 뺀다. ----
  const draftBoard = () => ({ w: draft.w, h: draft.h, holes: draft.holes.slice(), touch: draft.touch, regions: null });

  function readDraft() {
    const saved = log.loadDraft(FORMAT);
    const board = saved ? { w: saved.w, h: saved.h, holes: saved.holes, touch: saved.touch, regions: null } : null;
    return board && checkBoard(board) === null && board.w <= MAKE_MAX && board.h <= MAKE_MAX ? { w: board.w, h: board.h, holes: board.holes.slice(), touch: board.touch } : { ...FIRST_DRAFT, holes: [] };
  }

  function showMake() {
    frame.openMake(FORMAT);
    draft = readDraft();
    made = null;
    drawMake();
    frame.talkers.make.say(T.make.intro);
  }

  function drawMake() {
    for (const button of $('apart-make-touch').querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.touch === draft.touch));
    $('apart-make-w').textContent = fill(T.make.size, { n: draft.w });
    $('apart-make-h').textContent = fill(T.make.size, { n: draft.h });
    $('apart-make-w-fewer').disabled = draft.w <= MIN_SIZE;
    $('apart-make-w-more').disabled = draft.w >= MAKE_MAX;
    $('apart-make-h-fewer').disabled = draft.h <= MIN_SIZE;
    $('apart-make-h-more').disabled = draft.h >= MAKE_MAX;
    $('apart-make-clear').disabled = draft.holes.length === 0;
    // 만드는 판에는 판만 그린다. 선생님이 푼 것(가장 많이 놓은 한 가지와 구역)은 오른쪽 칸에 따로 그린다
    const board = draftBoard();
    drawBoard($('apart-make-board'), { w: board.w, h: board.h, holes: board.holes, label: labelOf(board, [], []), onCell: toggleHole });
    $('apart-make-result').textContent = made ? made.line : '';
    $('apart-make-picture').replaceChildren(...(made ? made.cards : []));
  }

  function changeDraft(next) {
    if (checkBoard({ ...next, regions: null }) !== null || next.w > MAKE_MAX || next.h > MAKE_MAX) return;
    draft = next;
    made = null;
    log.saveDraft({ w: draft.w, h: draft.h, holes: draft.holes, touch: draft.touch }, FORMAT);
    drawMake();
  }

  /** 칸을 눌렀다: 판에 있는 칸이면 빼고, 빠진 칸이면 되돌린다. 칸이 하나도 남지 않게는 못 뺀다. */
  function toggleHole(cell) {
    const holes = draft.holes.includes(cell) ? draft.holes.filter((item) => item !== cell) : sorted([...draft.holes, cell]);
    changeDraft({ ...draft, holes });
  }

  /** 크기를 바꾼다. 빠진 칸은 같은 자리(가로, 세로)에 그대로 두고, 판 밖으로 나간 것은 버린다. */
  function resize(w, h) {
    const holes = draft.holes
      .map((cell) => [cell % draft.w, Math.floor(cell / draft.w)])
      .filter(([x, y]) => x < w && y < h)
      .map(([x, y]) => y * w + x);
    changeDraft({ ...draft, w, h, holes: sorted(holes) });
  }

  /** 아이가 만든 판을 풀이 프로그램으로 풀어서, 가장 많이 놓는 수와 한 가지 방법, 구역으로 보일 수 있는지 알려 준다. */
  function solveDraft() {
    const board = draftBoard();
    const result = solve(board);
    const line = fill(result.closes ? T.make.best : T.make.gap, { k: result.best, n: result.cover, total: result.ways });
    made = { line, result, cards: solvedCards(board, result) };
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
      solution: { best: result.best, ways: result.ways, example: result.example, cover: result.cover, closes: result.closes, regions: result.regions },
    });
    log.flush();
    frame.talkers.make.say(line);
  }

  /** 다 만든 판(공책에 남기거나 해 볼 판). 칸이 하나라도 있으면 된다 */
  function madeBoard() {
    const board = draftBoard();
    return checkBoard(board) === null ? board : null;
  }

  function playDraft() {
    const board = madeBoard();
    if (board) frame.startRound(FORMAT, { level: MAKE_LEVEL, seed: null, small: false, custom: true, board });
  }

  // ---- 단추 잇기 ----
  $('apart-again').addEventListener('click', again);
  $('apart-stop').addEventListener('click', stop);
  $('apart-near').addEventListener('click', toggleNear);
  $('apart-pens').addEventListener('click', (event) => setPen(event.target.closest('button')?.dataset.pen));
  $('apart-make-touch').addEventListener('click', (event) => {
    const touch = event.target.closest('button')?.dataset.touch;
    if (touch === 'side' || touch === 'king') changeDraft({ ...draft, touch });
  });
  $('apart-make-w-fewer').addEventListener('click', () => resize(draft.w - 1, draft.h));
  $('apart-make-w-more').addEventListener('click', () => resize(draft.w + 1, draft.h));
  $('apart-make-h-fewer').addEventListener('click', () => resize(draft.w, draft.h - 1));
  $('apart-make-h-more').addEventListener('click', () => resize(draft.w, draft.h + 1));
  $('apart-make-clear').addEventListener('click', () => changeDraft({ ...draft, holes: [] }));
  $('apart-make-solve').addEventListener('click', solveDraft);
  $('apart-make-play').addEventListener('click', playDraft);

  /** 작은 그림: 판(구역이 있으면 구역)과 구슬 */
  function drawMini(root, board, marbles = [], regions = board.regions ?? []) {
    const state = partitionOf(board, regions);
    drawBoard(root, { w: board.w, h: board.h, holes: board.holes, marbles, regions, pairs: state.ok ? state.pairs : [], small: true });
  }

  /** 판의 처음 값(새 판, 공책의 그림) */
  function begin({ level, custom, board }) {
    const start = copyBoard(board);
    return {
      mode: custom ? 'place' : rungOf(level).mode,
      board: start, // 판: 크기, 빠진 칸, 닿는 약속, 선생님이 그어 둔 구역
      marbles: [], // 놓인 구슬의 칸(작은 것부터)
      regions: [], // 아이가 그은 구역(prove 판)
      pen: 'marble', // prove 판에서 지금 하는 일: 'marble'(구슬 놓기) | 'region'(구역 긋기)
      moves: [], // 무르기에 쓰는 차례: 그 전의 구슬과 구역
      moveCount: 0, // 구슬을 놓거나 빼거나 구역을 고친 수
      placeCount: 0, // 그 가운데 구슬을 놓은 수
      removeCount: 0, // 구슬을 뺀 수
      refusedCount: 0, // 닿는 칸에 놓으려 한 수
      regionCount: 0, // 구역을 긋거나 지운 수
      penCount: 0, // 구슬 놓기와 구역 긋기를 바꾼 수
      undoCount: 0,
      resetCount: 0, // 하던 가운데 처음으로 되돌린 수
      retryCount: 0, // 더 놓을 자리가 없어진 뒤 처음부터 다시 해 본 수
      completions: [], // 한 번이 끝날 때마다의 구슬 수
      tries: [], // 한 번이 끝난 모습(같은 모습은 한 번)
      best: null, // 이 판에서 지금까지 가장 많이 놓은 수
      bestMarbles: [], // 그때 놓은 칸
      closed: false, // 구역을 그어 끝냈는가(prove 판)
      stopped: false, // "여기까지 할래요"로 끝냈는가
      nearOn: false, // 지금 닿는 칸을 보고 있는가
      nearShown: false, // 닿는 칸을 한 번이라도 보았는가
      nearCount: 0, // 닿는 칸 보기를 켠 수
    };
  }

  /** 적어 둔 구역들이 쓸 수 있는 값인가(칸이 판에 있고 겹치지 않는다) */
  const regionsOk = (board, regions) => Array.isArray(regions) && partitionOf(board, regions).ok;

  return {
    id: FORMAT,
    T,
    padId: 'apart-pad',
    makeId: 'make-apart',
    homeIds: { sample: 'home-apart-sample', blank: 'home-apart-blank', ask: 'home-apart-ask', play: 'home-apart-play', pick: 'home-apart-pick', make: 'home-apart-make' },
    ladder: { LADDER, TOP_LEVEL, MAKE_LEVEL, rungOf, generateBoard, nextSeed },

    begin,
    solve(round) {
      const { best, ways, example, cover, regions, closes } = solve(round.board);
      // possible은 틀이 본다("안 되는 판"이 없는 형식이라 늘 true다).
      return { possible: true, best, ways, example, cover, regions, closes };
    },
    /** 기기에 적어 둔 하던 판이 이 형식의 판으로 쓸 수 있는 값인가 */
    valid(saved) {
      if (!MODES.includes(saved.mode) || checkBoard(saved.board) !== null) return false;
      if ((saved.mode === 'shown') !== Array.isArray(saved.board.regions)) return false;
      if (!marblesOk(saved.board, saved.marbles) || !regionsOk(saved.board, saved.regions) || !PENS.includes(saved.pen)) return false;
      if (!Array.isArray(saved.moves) || !saved.moves.every((item) => item && marblesOk(saved.board, item.marbles) && regionsOk(saved.board, item.regions))) return false;
      if (![saved.moveCount, saved.placeCount, saved.removeCount, saved.refusedCount, saved.regionCount, saved.penCount, saved.undoCount, saved.resetCount, saved.retryCount, saved.nearCount].every(count)) return false;
      if (![saved.completions, saved.tries, saved.bestMarbles].every(Array.isArray)) return false;
      if (![saved.nearOn, saved.nearShown, saved.closed, saved.stopped].every((value) => typeof value === 'boolean')) return false;
      return saved.best === null || count(saved.best);
    },
    /** 판 화면에서 이 형식의 것(판, 판 아래의 글, 왼쪽 칸의 도구)을 보이거나 감춘다 */
    showParts(on) {
      $('apart-board').hidden = !on;
      $('apart-count').hidden = !on;
      $('apart-near').hidden = !on;
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
    touched: (round) => round.moveCount > 0 || round.refusedCount > 0,
    /** 지금 판의 모습("막혔어요"를 골랐을 때 기록에 남긴다) */
    view(round) {
      return { marbles: round.marbles.slice(), free: freeCells(round.board, round.marbles).length, regions: round.regions.length, best: round.best, tries: round.completions.length };
    },
    /** 이 판보다 작은 판: 같은 약속의 작은 네모 판(구역을 그어 둔 판이면 작은 판에도 구역을 긋는다) */
    smaller: (round, turn) => smallerApart({ mode: round.mode, board: round.board }, turn),
    record(round, solution) {
      return {
        mode: round.mode,
        board: copyBoard(round.board),
        solution: { possible: true, best: solution.best, ways: solution.ways, example: solution.example, cover: solution.cover, closes: solution.closes, regions: solution.regions },
        // 질문 힌트와 "닿는 칸 보기"를 함께 센다.
        hintsOpened: round.hintsOpened + (round.nearShown ? 1 : 0),
        nearShown: round.nearShown,
        nearCount: round.nearCount,
        // 판을 떠날 때의 구슬과 그은 구역
        marbles: round.marbles,
        regions: round.regions,
        // 한 번이 끝날 때마다의 구슬 수, 끝난 모습, 다시 해 본 횟수, 가장 많이 놓은 수와 그 칸
        completions: round.completions,
        tries: round.tries,
        retries: Math.max(0, round.completions.length - 1),
        retryCount: round.retryCount,
        best: round.best,
        bestMarbles: round.bestMarbles,
        // 가장 많이 놓는 수(풀이 프로그램)에 닿아 끝냈는가(prove 판은 구역을 그어 끝냈는가). 수준 맞추기와 "왜 그럴까?"가 본다
        reachedBest: round.stopped !== true && (round.mode === 'prove' ? round.closed === true : round.best !== null && round.best === solution.best),
        closed: round.closed === true,
        stopped: round.stopped === true,
        moveCount: round.moveCount,
        placeCount: round.placeCount,
        removeCount: round.removeCount,
        refusedCount: round.refusedCount,
        regionCount: round.regionCount,
        penCount: round.penCount,
        undoCount: round.undoCount,
        resetCount: round.resetCount,
      };
    },
    rightLine,
    whyPages,
    solutionPages,
    undo,
    reset,
    onKey() {},

    // ---- 처음 화면에 그리는 그림 ----
    homeAsk: () => T.home.ask,
    pickLine: () => T.home.pick,
    /** 판(구역이 그어져 있으면 구역까지) */
    drawSample(root, board) {
      drawMini(root, board);
    },
    drawBlank(root) {
      drawMini(root, { w: T.blank.w, h: T.blank.h, holes: [], touch: 'king', regions: null });
    },
    /** 하던 판과 공책의 그림: 놓인 구슬과 구역 */
    drawResume(root, saved) {
      const board = saved.board;
      const regions = saved.mode === 'shown' ? board.regions : Array.isArray(saved.regions) ? saved.regions : [];
      drawMini(root, board, Array.isArray(saved.marbles) ? saved.marbles : [], regions ?? []);
    },
    /**
     * 판 고르기의 그림: 단계마다 그 단계의 판 하나. 구슬 하나를 놓아 그 구슬과 닿는 칸에 빗금을 긋거나(닿는 약속이 보이게),
     * 구역 하나를 그어 둔다(구역을 긋는 단계)
     */
    drawLevelPicture(root, entry) {
      const picture = entry.picture;
      if (picture.blank) {
        drawMini(root, { w: T.blank.w, h: T.blank.h, holes: [], touch: 'king', regions: null });
        return;
      }
      const board = generateBoard(entry.level, picture.seed).board;
      if (Number.isInteger(picture.marble)) {
        drawBoard(root, { w: board.w, h: board.h, holes: board.holes, marbles: [picture.marble], near: neighboursOf(board, picture.marble), regions: board.regions ?? [], small: true });
        return;
      }
      drawMini(root, board, [], board.regions ?? picture.regions ?? []);
    },
    showMake,
    /** 직접 만들기에서 다 만든 판(공책에 남기기가 쓴다) */
    madeBoard,
    /** 가장 좋은 기록(공책에 저절로 남는다). 이 판에서 한 번도 끝까지 가지 않았으면 null. 많이 놓을수록 좋은 기록이다 */
    bestOf: (round) => (round.best === null ? null : { value: round.best, name: fill(T.notebook.best, { k: round.best }) }),
  };
}
