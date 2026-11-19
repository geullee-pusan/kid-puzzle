// 눈대중의 사다리(단계)와 판 내기, "더 작은 판"의 재료. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 모든 판은 풀이 프로그램으로 확인한 뒤에 낸다.
// 얼룩은 시드 난수로 고른 둥근 덩어리 몇 개를 합쳐 만든다(덩어리마다 앞의 덩어리와 겹치게 놓아 한 덩어리가 된다).
import { createRng, randInt, seedFrom } from './rng.js';
import { bestCover, blobCells, checkBoard, estOf, solve, verdict } from './eyeball.js';

/**
 * 어림 판에서 "알 수 없어요"가 답인 판의 비율. 임시값이다(셋에 하나쯤).
 * 늘 정해지거나 늘 알 수 없으면 해 보지 않고 찍게 된다.
 */
export const UNKNOWN_RATE = 1 / 3;

/** 수직선의 틀: 처음 수, 끝 수, 찍는 자리의 간격(step), 열기 전에 보이는 눈금(ticks) */
export const LINES = [
  { from: 0, to: 100, step: 1, ticks: [] },
  { from: 0, to: 1000, step: 10, ticks: [] },
  { from: 300, to: 700, step: 10, ticks: [] },
  { from: 0, to: 500, step: 5, ticks: [] },
  { from: 100, to: 200, step: 1, ticks: [] },
];
/** 짧은 선: 가운데 눈금이 보이고 찍을 수가 하나다(작은 판) */
export const SHORT_LINES = [
  { from: 0, to: 10, step: 1, ticks: [5] },
  { from: 0, to: 20, step: 1, ticks: [10] },
  { from: 0, to: 100, step: 5, ticks: [50] },
];
/** 도전의 선: 끝 수가 크거나 0에서 시작하지 않는다. 찍을 수가 셋이다 */
export const HARD_LINES = [
  { from: 0, to: 10000, step: 100, ticks: [] },
  { from: 2000, to: 3000, step: 10, ticks: [] },
  { from: 150, to: 350, step: 1, ticks: [] },
  { from: 0, to: 60, step: 1, ticks: [] },
  { from: 1000, to: 5000, step: 50, ticks: [] },
];

/**
 * 사다리.
 *   tag     'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode    'area'(얼룩 넓이 어림) | 'cover'(직사각형으로 덮기) | 'line'(수직선에 찍기) | 'side'(어림이 클까 작을까. 기획의 어느 쪽으로 틀렸을까)
 *           | 'mixed'(덮기, 선, 어림이 번갈아 나온다) | 'make'(직접 만들기)
 *   sizes   얼룩 판의 크기 [가로, 세로], small: 수준 맞추기가 "작은 판부터"라고 할 때
 *   area    얼룩 칸 수의 [아래 끝, 위 끝], circles: 둥근 덩어리 수의 [아래 끝, 위 끝]
 *   k       덮을 직사각형 수
 *
 * 1단계: 얼룩 넓이 어림(8×6, 9×6, 9×7. 얼룩 16~32칸). 수를 넣고 세어 보면 끝난다.
 * 2단계: 직사각형 두 개로 덮기(7×6, 8×6). 직사각형 하나로 덮을 때보다 셋 이상 가깝게 덮을 수 있고, 꼭 맞게는 덮을 수 없는 얼룩.
 * 3단계: 수직선에 수 두 개 찍기. 끝 수만 보인다.
 * 4단계: 더하기의 어림(세 자리 수 두세 개를 가까운 몇백으로). 알 수 없는 판이 셋에 하나쯤 섞인다. 첫 판은 모두 올린 판, 둘째 판은 아주 쉬운 알 수 없는 판.
 * 5단계: 직사각형 세 개로 덮기(9×7, 10×7), 큰 수나 0에서 시작하지 않는 선에 수 세 개, 곱하기·빼기·가린 수가 많은 어림이 번갈아 나온다.
 * 6단계: 직접 만들기.
 */
export const LADDER = [
  { level: 1, tag: 'basic', mode: 'area', sizes: [[8, 6], [9, 6], [9, 7]], small: [[6, 5], [7, 4]], area: [16, 32], smallArea: [8, 15], circles: [2, 4] },
  { level: 2, tag: 'basic', mode: 'cover', k: 2, sizes: [[7, 6], [8, 6]], small: [[6, 5], [6, 4]], area: [12, 24], smallArea: [8, 14], circles: [2, 3] },
  { level: 3, tag: 'applied', mode: 'line', lines: LINES, count: 2, small: SHORT_LINES },
  { level: 4, tag: 'applied', mode: 'side', ops: ['+'], counts: [2, 3], small: [2, 2] },
  {
    level: 5,
    tag: 'challenge',
    mode: 'mixed',
    kinds: ['cover', 'line', 'side'],
    cover: { k: 3, sizes: [[9, 7], [10, 7]], small: [[7, 5], [8, 5]], area: [20, 38], smallArea: [10, 18], circles: [3, 5] },
    line: { lines: HARD_LINES, count: 3, small: SHORT_LINES },
    side: { ops: ['×', '-', '+'], counts: [2, 3], small: [2, 2] },
  },
  { level: 6, tag: 'challenge', mode: 'make' },
];

/** 판을 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;

/** 판 하나를 고르려고 다시 뽑아 보는 횟수의 위 끝. 실제로는 넘지 않는다(테스트로 확인한다) */
const MAX_TRIES = 600;

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

const pick = (rng, list) => list[randInt(rng, 0, list.length - 1)];

/** 5단계는 판 번호마다 덮기, 선, 어림이 번갈아 나온다 */
export function kindOf(level, seed) {
  const rung = rungOf(level);
  if (rung.mode !== 'mixed') return rung.mode;
  return rung.kinds[(Math.max(1, seed) - 1) % rung.kinds.length];
}

// ---- 얼룩 ----

/** 원 하나가 판 안에 들어가는가(둘레가 판 끝에서 반 칸 넘게 떨어진다) */
const fitsIn = (w, h, [x, y, r]) => 2 * x - r >= 1 && 2 * x + r <= 2 * w - 1 && 2 * y - r >= 1 && 2 * y + r <= 2 * h - 1;

/**
 * 얼룩 하나: 둥근 덩어리를 차례로 놓는다. 둘째부터는 앞의 덩어리 하나와 겹치는 자리에 놓는다. 얼룩 칸 수가 area 안이어야 낸다. 못 만들면 null.
 */
export function makeBlob(rng, { w, h, area, circles: [low, high], tries = 400 }) {
  for (let attempt = 0; attempt < tries; attempt++) {
    const count = randInt(rng, low, high);
    const list = [];
    let ok = true;
    for (let index = 0; index < count && ok; index++) {
      let placed = null;
      for (let again = 0; again < 40 && !placed; again++) {
        const r = randInt(rng, 3, 7);
        let x;
        let y;
        if (list.length === 0) {
          x = randInt(rng, 1, w - 1);
          y = randInt(rng, 1, h - 1);
        } else {
          const [px, py, pr] = pick(rng, list);
          const reach = Math.max(1, Math.floor(pr / 2));
          x = px + randInt(rng, -reach, reach);
          y = py + randInt(rng, -reach, reach);
          // 가운데가 겹치면 같은 덩어리다. 겹치지만 가운데는 다른 곳에 놓는다
          if (x === px && y === py) continue;
          const far = (2 * (x - px)) ** 2 + (2 * (y - py)) ** 2;
          if (far >= (pr + r - 2) ** 2) continue;
        }
        const circle = [x, y, r];
        if (fitsIn(w, h, circle)) placed = circle;
      }
      if (placed) list.push(placed);
      else ok = false;
    }
    if (!ok) continue;
    const board = { w, h, circles: list };
    const cells = blobCells(board).length;
    if (cells >= area[0] && cells <= area[1]) return board;
  }
  return null;
}

/** 덮기 판으로 낼 만한가: 꼭 맞게 덮을 수 없고, 직사각형을 하나 더 쓰면 셋 이상(세 개는 둘 이상) 가까워진다 */
function goodCover(board, k) {
  const cells = blobCells(board);
  const best = bestCover(board, k, cells).extra;
  if (best < 1) return false;
  if (bestCover(board, 1, cells).extra - best < 3) return false;
  return k < 3 || bestCover(board, 2, cells).extra - best >= 2;
}

function makeBlobBoard(rng, kind, spec, small) {
  const sizes = small ? spec.small : spec.sizes;
  const area = small ? spec.smallArea : spec.area;
  for (let attempt = 0; attempt < 40; attempt++) {
    const [w, h] = pick(rng, sizes);
    const blob = makeBlob(rng, { w, h, area, circles: spec.circles });
    if (!blob) continue;
    if (kind === 'area') return { kind, ...blob };
    const board = { kind, ...blob, k: spec.k };
    if (small ? bestCover(board, spec.k).extra >= 0 : goodCover(board, spec.k)) return board;
  }
  return null;
}

// ---- 수직선 ----

/** 찍을 수의 후보: 양 끝에서 선의 6% 넘게 떨어지고, 반이나 4분의 1 자리가 아닌 수(도전은 10분의 1 자리도 아닌 수) */
export function targetChoices(line, { hard = false } = {}) {
  const range = line.to - line.from;
  const list = [];
  for (let value = line.from + line.step; value < line.to; value += line.step) {
    const at = value - line.from;
    if (at * 100 < range * 6 || (range - at) * 100 < range * 6) continue;
    if ((at * 4) % range === 0) continue;
    if (hard && (at * 10) % range === 0) continue;
    if (line.ticks.includes(value)) continue;
    list.push(value);
  }
  return list;
}

/** 수직선 판 하나: 틀 하나를 고르고 서로 선의 15% 넘게 떨어진 수 count개를 고른다 */
export function makeLine(rng, lines, count, options = {}) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const line = pick(rng, lines);
    const choices = targetChoices(line, options);
    const range = line.to - line.from;
    const targets = [];
    for (let again = 0; again < 60 && targets.length < count; again++) {
      const value = pick(rng, choices);
      if (targets.every((other) => Math.abs(other - value) * 100 > range * 15)) targets.push(value);
    }
    if (targets.length === count) return { kind: 'line', from: line.from, to: line.to, step: line.step, ticks: line.ticks.slice(), targets };
  }
  return null;
}

// ---- 어림 ----

/** 어림하는 자리에서 올리거나(up) 내리는(down) 수 하나. 가린 수(hide)는 세 자리 수의 일의 자리를 가린다 */
function makeItem(rng, { dir, hide, digits }) {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (digits === 1) return { n: randInt(rng, 3, 9), unit: 1, hide: false };
    const unit = digits === 3 ? 100 : 10;
    const n = hide ? randInt(rng, 11, 94) * 10 : digits === 3 ? randInt(rng, 101, 949) : randInt(rng, 12, 94);
    if (n % unit === 0 || (hide && n % 100 === 0)) continue;
    const item = { n, unit, hide };
    const est = estOf(item);
    const top = hide ? n + 9 : n;
    if (est <= 0) continue;
    if (dir === 'up' && est > top) return item;
    if (dir === 'down' && est < n) return item;
  }
  return null;
}

/**
 * 어림 판 하나. want는 'up'(모두 올림) | 'down'(모두 내림) | 'sizes'(쪽이 섞였지만 정해진다) | 'hidden'(가린 수가 있고 정해진다)
 * | 'unknown'(가린 숫자에 따라 다르다). 못 만들면 null.
 */
export function makeSide(rng, { op, count, want, digits = op === '×' ? 2 : 3 }) {
  for (let attempt = 0; attempt < 400; attempt++) {
    const n = op === '+' ? count : 2;
    const hidden = want === 'hidden' || want === 'unknown';
    const items = [];
    for (let index = 0; index < n; index++) {
      const dir = want === 'up' ? 'up' : want === 'down' ? 'down' : pick(rng, ['up', 'down']);
      const hide = hidden && op !== '×' && digits === 3 && (index === 0 || rng() < 0.7);
      // 한 자리 수와 두 자리 수의 곱하기(작은 판)는 앞의 수가 한 자리다(어림하지 않는다)
      const item = makeItem(rng, { dir, hide, digits: digits === 1 ? (index === 0 ? 1 : 2) : digits });
      if (!item) break;
      items.push(item);
    }
    if (items.length !== n) continue;
    if (op === '-' && items[0].n <= items[1].n + 20) continue;
    const board = { kind: 'side', op, items };
    if (checkBoard(board) !== null) continue;
    const result = verdict(board);
    if (result.answer === 'same' || result.touch) continue;
    if (want === 'unknown' ? result.answer !== 'unknown' : result.answer === 'unknown') continue;
    if (want === 'sizes' && (result.by !== 'sizes' || items.some((item) => item.hide))) continue;
    if (want === 'hidden' && !items.some((item) => item.hide)) continue;
    if ((want === 'up' || want === 'down') && result.by !== 'directions') continue;
    // 정해지는 판은 어림한 값과 실제 값이 2 넘게 다르다(하나 차이는 가리기 어렵다)
    if (result.answer !== 'unknown' && Math.min(Math.abs(result.est - result.low), Math.abs(result.est - result.high)) < 2) continue;
    return board;
  }
  return null;
}

const SIDE_WANTS = ['up', 'down', 'sizes', 'hidden'];

function makeSideFor(rng, spec, seed, small) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const op = pick(rng, spec.ops);
    const count = randInt(rng, ...(small ? spec.small : spec.counts));
    const canHide = op !== '×';
    const want = canHide && seed > 1 && rng() < UNKNOWN_RATE ? 'unknown' : pick(rng, canHide ? SIDE_WANTS : ['up', 'down', 'sizes']);
    const board = makeSide(rng, { op, count, want });
    if (board) return board;
  }
  return null;
}

// ---- 맨 처음 판들 ----

const item = (n, unit, hide = false) => ({ n, unit, hide });
/** 3단계 첫 판: 0부터 100까지의 선에 40과 85 */
export const FIRST_LINE = { kind: 'line', from: 0, to: 100, step: 1, ticks: [], targets: [40, 85] };
/** 4단계 첫 판: 198 + 397을 200 + 400으로. 둘 다 올렸다 */
export const FIRST_SIDE = { kind: 'side', op: '+', items: [item(198, 100), item(397, 100)] };
/** 4단계 둘째 판: 13□ + 26□를 100 + 300으로. 앞의 수는 30~39만큼 내리고 뒤의 수는 31~40만큼 올려서 알 수 없다 */
export const SECOND_SIDE = { kind: 'side', op: '+', items: [item(130, 100, true), item(260, 100, true)] };

/**
 * 판 하나를 낸다.
 * @param {number} level 1~5
 * @param {number} seed 판 번호(1부터)
 * @param {{small?: boolean}} options small: 그 단계에서 작은 판을 낸다(수준 맞추기에서 쓴다)
 * @returns {{level, seed, small, board, solution}}
 */
export function generateBoard(level, seed, { small = false } = {}) {
  const rung = rungOf(level);
  if (rung.mode === 'make') throw new Error('직접 만들기 단계는 판을 내지 않아요');
  const rng = createRng(seedFrom('eyeball', level, seed, small ? 'small' : ''));
  const done = (board) => ({ level, seed, small, board, solution: solve(board) });
  if (!small && level === 3 && seed === 1) return done(FIRST_LINE);
  if (!small && level === 4 && seed === 1) return done(FIRST_SIDE);
  if (!small && level === 4 && seed === 2) return done(SECOND_SIDE);
  const kind = kindOf(level, seed);
  const spec = rung.mode === 'mixed' ? rung[kind] : rung;
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    let board = null;
    if (kind === 'area' || kind === 'cover') board = makeBlobBoard(rng, kind, spec, small);
    else if (kind === 'line') board = small ? makeLine(rng, spec.small, 1) : makeLine(rng, spec.lines, spec.count, { hard: rung.mode === 'mixed' });
    else board = makeSideFor(rng, spec, seed, small);
    if (board && checkBoard(board) === null) return done(board);
  }
  throw new Error(`판을 만들지 못했어요: ${level}단계 ${seed}번`);
}

const sameBoard = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** 다음 판 번호. 방금 한 판과 똑같은 판이 나오는 번호는 건너뛴다. */
export function nextSeed(level, seed, options = {}) {
  const now = generateBoard(level, seed, options).board;
  for (let next = seed + 1; next < seed + 40; next++) {
    if (!sameBoard(generateBoard(level, next, options).board, now)) return next;
  }
  return seed + 1;
}

// ---- "더 작은 판"의 재료 ----

/** 얼룩 판보다 작은 크기들: 가로와 세로가 원래 판을 넘지 않고, 칸 수가 원래의 4분의 3 이하인 크기. 큰 것부터 */
export function smallerSizes(board) {
  const list = [];
  for (let w = 5; w <= board.w; w++) {
    for (let h = 4; h <= board.h; h++) if (w * h * 4 <= board.w * board.h * 3) list.push([w, h]);
  }
  return list.sort((a, b) => b[0] * b[1] - a[0] * a[1] || b[0] - a[0]).slice(0, 3);
}

/**
 * 원래 판보다 작은 판들(차례는 src/core/smaller.js가 고른다).
 *   얼룩    칸이 4분의 3 이하인 판(덮기는 직사각형 수가 같다)
 *   선      찍을 수가 하나뿐이고 가운데 눈금이 보이는 짧은 선(원래 판이 이미 그런 판이면 없다)
 *   어림    수가 둘인 더하기(원래 판의 수가 셋이면 같은 크기의 수, 둘이면 두 자리 수), 두 자리 수의 빼기, 한 자리 수와 두 자리 수의 곱하기
 *   yes는 정해지는 판, no는 알 수 없는 판이다(어림 판만 no가 있다). 더 작게 만들 수 없으면 두 목록이 모두 빈다.
 * @param {{mode: string, board: object}} origin
 */
export function smallBoards(origin) {
  const { board } = origin;
  const rng = createRng(seedFrom('eyeball-smaller', JSON.stringify(board)));
  const lists = { yes: [], no: [] };
  const keys = new Set();
  const add = (list, item) => {
    if (!item || checkBoard(item) !== null) return;
    const key = JSON.stringify(item);
    if (keys.has(key)) return;
    keys.add(key);
    list.push(item);
  };
  if (board.kind === 'area' || board.kind === 'cover') {
    const sizes = smallerSizes(board);
    if (sizes.length === 0) return lists;
    const area = [Math.max(5, Math.floor(blobCells(board).length / 3)), Math.max(8, Math.floor((blobCells(board).length * 2) / 3))];
    for (let attempt = 0; attempt < 12 && lists.yes.length < 3; attempt++) {
      const [w, h] = sizes[attempt % sizes.length];
      const made = makeBlob(rng, { w, h, area, circles: [2, 3] });
      if (!made) continue;
      add(lists.yes, board.kind === 'area' ? { kind: 'area', ...made } : { kind: 'cover', ...made, k: board.k });
    }
    return lists;
  }
  if (board.kind === 'line') {
    if (board.targets.length === 1 && board.to - board.from <= 20) return lists;
    for (let attempt = 0; attempt < 12 && lists.yes.length < 3; attempt++) add(lists.yes, makeLine(rng, SHORT_LINES, 1));
    return lists;
  }
  const count = board.items.length;
  const op = board.op;
  const decided = ['up', 'down', 'sizes'];
  for (let attempt = 0; attempt < 30 && (lists.yes.length < 3 || lists.no.length < 2); attempt++) {
    if (op === '+' && count === 3) {
      if (lists.yes.length < 3) add(lists.yes, makeSide(rng, { op, count: 2, want: pick(rng, SIDE_WANTS) }));
      if (lists.no.length < 2) add(lists.no, makeSide(rng, { op, count: 2, want: 'unknown' }));
    } else if (op === '×') {
      if (lists.yes.length < 3) add(lists.yes, makeSide(rng, { op, count: 2, want: pick(rng, ['up', 'down']), digits: 1 }));
    } else if (lists.yes.length < 3) add(lists.yes, makeSide(rng, { op, count: 2, want: pick(rng, decided), digits: 2 }));
  }
  return lists;
}
