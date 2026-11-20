// 수열 길 퍼즐의 사다리(단계)와 판 내기. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 판은 시드 난수(rng.js)로 만들고, 풀이 프로그램이 길을 잇는 방법이 꼭 하나라고 확인한 판만 낸다.
//
// 판 만들기(심어 두고 확인하기):
//   1. 판의 모든 칸을 한 번씩 지나는 긴 길 하나를 아무렇게나 만든다(지그재그 길에서 끝을 이웃 칸에 붙였다 떼는 걸음을 많이 한다).
//   2. 그 길을 세 칸 이상씩 잘라 길 여러 개로 나눈다.
//   3. 길마다 두 끝과 가운데 몇 칸에 수를 적는다. 적힌 수는 지나는 차례대로 같은 크기로 커진다(어느 쪽에서 읽을지는 아무렇게나).
//      판에 같은 수가 두 번 나오지 않게 한다.
//   4. 풀이 프로그램으로 센다. 방법이 둘 이상이면 심어 둔 길과 다른 방법이 갈리는 빈칸 하나에 수를 더 적고(그 길의 수를 다시 매긴다) 다시 센다.
//   5. 방법이 꼭 하나이고, 빈칸의 몫과 "옆에 있지만 다른 길의 수"(가까이 붙어 있어 이어 보고 싶어지는 수)가 단계의 잣대에 맞으면 낸다.
// 사다리에는 길을 이을 수 없는 판이 없다(직접 만들기에서만 만날 수 있다).
import { countSolutions, neighbours } from './seqpath.js';
import { createRng, randInt, seedFrom } from './rng.js';

/**
 * 사다리.
 *   tag     'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode    'four'(4×4) | 'five'(5×5) | 'same'(모든 길이 같은 간격) | 'six'(6×6) | 'eight'(8×8) | 'make'(직접 만든다)
 *   spec    판을 만드는 값
 *     size     [가로, 세로]
 *     lens     자른 길 하나의 칸 수(아래 끝, 위 끝)
 *     steps    뛰는 크기의 후보(길마다 하나를 고른다. sameStep이면 판에 하나)
 *     sameStep 판의 모든 길이 같은 크기로 뛴다
 *     maxValue 적는 수의 위 끝(1부터)
 *     density  처음에 길 가운데 칸에 수를 적는 몫
 *     empty    빈칸의 몫(아래 끝, 위 끝)
 *     near     옆에 있지만 다른 길의 수인 짝이 적어도 몇 개
 */
export const LADDER = [
  {
    level: 1,
    tag: 'basic',
    mode: 'four',
    spec: { size: [4, 4], lens: [3, 6], steps: [1, 2], maxValue: 20, density: 0.35, empty: [0.15, 0.4], near: 0 },
  },
  {
    level: 2,
    tag: 'basic',
    mode: 'five',
    spec: { size: [5, 5], lens: [3, 7], steps: [1, 2, 3], maxValue: 40, density: 0.3, empty: [0.2, 0.45], near: 1 },
  },
  {
    level: 3,
    tag: 'applied',
    mode: 'same',
    spec: { size: [5, 5], lens: [3, 7], steps: [2, 3, 5], sameStep: true, maxValue: 60, density: 0.3, empty: [0.2, 0.45], near: 0 },
  },
  {
    level: 4,
    tag: 'applied',
    mode: 'six',
    spec: { size: [6, 6], lens: [4, 8], steps: [1, 2, 3, 4, 5], maxValue: 60, density: 0.3, empty: [0.25, 0.5], near: 1 },
  },
  {
    level: 5,
    tag: 'challenge',
    mode: 'eight',
    spec: { size: [8, 8], lens: [4, 10], steps: [1, 2, 3, 4, 5, 6, 7], maxValue: 99, density: 0.3, empty: [0.3, 0.5], near: 1 },
  },
  { level: 6, tag: 'challenge', mode: 'make' },
];

/** 판을 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;

/** 1단계의 첫 판(1번)과 "작은 판부터"일 때: 1씩 뛰는 짧은 길만 있는 4×4 */
const FIRST = { size: [4, 4], lens: [3, 5], steps: [1], maxValue: 16, density: 0.4, empty: [0.1, 0.4], near: 0 };
/** 1단계에서 "작은 판부터"일 때의 크기(수준 맞추기에서 쓴다) */
export const SMALL_SIZE = [3, 3];

/** 판 하나를 만들려고 다시 뽑아 보는 횟수의 위 끝. 실제로는 넘지 않는다(테스트로 확인한다) */
const MAX_TRIES = 3000;
/** 한 판에서 수를 더 적어 고쳐 보는 횟수의 위 끝 */
const MAX_FIXES = 30;

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

/** 판의 모든 칸을 한 번씩 지나는 길 하나(지그재그에서 시작해 끝을 옮기는 걸음을 많이 한다) */
export function wholePath(rng, w, h) {
  const board = { w, h };
  let path = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) path.push(y * w + (y % 2 === 1 ? w - 1 - x : x));
  const moves = 8 * w * h * Math.max(w, h);
  for (let move = 0; move < moves; move++) {
    if (rng() < 0.5) path.reverse();
    const end = path.at(-1);
    const near = neighbours(board, end);
    const other = near[randInt(rng, 0, near.length - 1)];
    const at = path.indexOf(other);
    if (at === path.length - 2) continue;
    // 끝을 이웃 칸(at)에 붙이고, at 다음부터 끝까지를 뒤집는다
    path = [...path.slice(0, at + 1), ...path.slice(at + 1).reverse()];
  }
  return path;
}

/** 칸 n개를 [아래 끝, 위 끝] 길이의 조각들로 자른다. 자를 수 없으면 null */
function cutLengths(rng, n, [low, high]) {
  const lengths = [];
  let left = n;
  while (left > 0) {
    if (left <= high && (left === n || rng() < 0.35 || left < 2 * low)) {
      if (left < low) return null;
      lengths.push(left);
      break;
    }
    let length = randInt(rng, low, Math.min(high, left - low));
    if (left - length < low) length = left - low;
    if (length < low) return null;
    lengths.push(length);
    left -= length;
  }
  return lengths;
}

/**
 * 한 길의 수 매기기: 수를 적을 자리(길 안의 차례)마다 값을 정한다. 같은 수가 판에 두 번 나오지 않게 한다.
 * @returns {number[]|null} 자리마다의 값(지나는 차례대로). 정하지 못하면 null
 */
function numberSegment(rng, count, step, maxValue, taken, keepStart = null) {
  const span = step * (count - 1);
  if (span + 1 > maxValue) return null;
  const starts = [];
  if (keepStart !== null && keepStart + span <= maxValue) starts.push(keepStart);
  for (let tries = 0; tries < 20; tries++) starts.push(randInt(rng, 1, maxValue - span));
  for (const start of starts) {
    const values = Array.from({ length: count }, (_, index) => start + index * step);
    if (values.every((value) => !taken.has(value))) return values;
  }
  return null;
}

/** 심어 둔 길들(segments)과 수를 적을 자리(spots: 길마다 길 안의 차례들)로 판의 수를 매긴다 */
function writeValues(rng, w, h, plan, spec) {
  const values = new Array(w * h).fill(null);
  const taken = new Set();
  for (const segment of plan) {
    const numbers = numberSegment(rng, segment.spots.length, segment.step, spec.maxValue, taken, segment.start);
    if (!numbers) return null;
    segment.start = numbers[0];
    numbers.forEach((value) => taken.add(value));
    const ordered = segment.up ? numbers : numbers.slice().reverse();
    segment.spots.forEach((spot, index) => {
      values[segment.cells[spot]] = ordered[index];
    });
  }
  return values;
}

/** 길마다 이웃한 두 칸의 짝(앞뒤 없이)을 모은다 */
function linksOf(paths) {
  const links = new Map();
  for (const path of paths) {
    path.forEach((cell, index) => {
      const list = [];
      if (index > 0) list.push(path[index - 1]);
      if (index < path.length - 1) list.push(path[index + 1]);
      links.set(cell, list.sort((a, b) => a - b).join(','));
    });
  }
  return links;
}

/**
 * 가까이 있지만 다른 길의 수인 짝의 수: 두 걸음 안(가로와 세로로 센 거리가 1이나 2)에 있는 두 수 칸이 다른 길에 있고,
 * 두 수의 차가 둘 중 한 길의 뛰는 크기와 같다(이어 보고 싶어지지만 이으면 안 되는 수다).
 */
export function nearPairs(board, paths) {
  const pathOf = new Map();
  const stepOf = new Map();
  paths.forEach((path, index) => {
    path.forEach((cell) => pathOf.set(cell, index));
    const numbers = path.map((cell) => board.values[cell]).filter((value) => value !== null);
    stepOf.set(index, Math.abs(numbers[1] - numbers[0]));
  });
  const { w, h } = board;
  let count = 0;
  for (let cell = 0; cell < w * h; cell++) {
    if (board.values[cell] === null) continue;
    for (let other = cell + 1; other < w * h; other++) {
      if (board.values[other] === null || pathOf.get(other) === pathOf.get(cell)) continue;
      const far = Math.abs((cell % w) - (other % w)) + Math.abs(Math.floor(cell / w) - Math.floor(other / w));
      if (far > 2) continue;
      const gap = Math.abs(board.values[other] - board.values[cell]);
      if (gap === stepOf.get(pathOf.get(cell)) || gap === stepOf.get(pathOf.get(other))) count += 1;
    }
  }
  return count;
}

/** 빈칸의 몫 */
export const emptyShare = (board) => board.values.filter((value) => value === null).length / board.values.length;

/**
 * 판 하나를 심어 보고 고친다. 잣대에 맞으면 { board, paths }, 아니면 null.
 * @param {() => number} rng
 * @param {object} spec 사다리의 spec(size, lens, steps, sameStep, maxValue, density, empty, near)
 * @param {object|null} stats 주면 버린 까닭마다 수를 센다(cut, values, empty, near, zero, many, renumber). 잣대를 고를 때 쓴다
 */
export function plantBoard(rng, spec, stats = null) {
  const miss = (why) => {
    if (stats) stats[why] = (stats[why] ?? 0) + 1;
    return null;
  };
  const [w, h] = spec.size;
  const whole = wholePath(rng, w, h);
  const lengths = cutLengths(rng, w * h, spec.lens);
  if (!lengths) return miss('cut');
  const sharedStep = spec.steps[randInt(rng, 0, spec.steps.length - 1)];
  let at = 0;
  const plan = lengths.map((length) => {
    const cells = whole.slice(at, at + length);
    at += length;
    const spots = [0];
    for (let index = 1; index < length - 1; index++) if (rng() < spec.density) spots.push(index);
    spots.push(length - 1);
    while (spots.length < 3) {
      const index = randInt(rng, 1, length - 2);
      if (!spots.includes(index)) spots.push(index);
      spots.sort((a, b) => a - b);
    }
    const step = spec.sameStep ? sharedStep : spec.steps[randInt(rng, 0, spec.steps.length - 1)];
    return { cells, spots, step, up: rng() < 0.5, start: null };
  });
  let values = writeValues(rng, w, h, plan, spec);
  if (!values) return miss('values');
  const planted = plan.map((segment) => segment.cells);
  const plantedLinks = linksOf(planted);
  for (let fix = 0; fix <= MAX_FIXES; fix++) {
    const board = { w, h, values };
    const result = countSolutions(board, { limit: 2 });
    if (result.count === 1) {
      const share = emptyShare(board);
      if (share < spec.empty[0] || share > spec.empty[1]) return miss('empty');
      if (nearPairs(board, result.paths) < spec.near) return miss('near');
      return { board, paths: result.paths };
    }
    if (result.count === 0 || fix === MAX_FIXES) return miss(result.count === 0 ? 'zero' : 'many');
    // 심어 둔 길과 다른 방법에서 이웃이 다른 빈칸 하나에 수를 더 적는다
    const other = [result.paths, result.second].find((paths) => {
      const links = linksOf(paths);
      return planted.flat().some((cell) => links.get(cell) !== plantedLinks.get(cell));
    });
    const links = linksOf(other);
    const moved = planted.flat().filter((cell) => links.get(cell) !== plantedLinks.get(cell));
    const differ = moved.filter((cell) => values[cell] === null);
    if (differ.length > 0) {
      const cell = differ[randInt(rng, 0, differ.length - 1)];
      const segment = plan.find((item) => item.cells.includes(cell));
      segment.spots = [...segment.spots, segment.cells.indexOf(cell)].sort((a, b) => a - b);
    } else {
      // 수 칸끼리만 갈린다(두 길을 하나로 이어도 되는 것처럼): 갈리는 길 하나의 수를 새로 매긴다
      const cell = moved[randInt(rng, 0, moved.length - 1)];
      const segment = plan.find((item) => item.cells.includes(cell));
      segment.start = null;
      segment.up = rng() < 0.5;
    }
    values = writeValues(rng, w, h, plan, spec);
    if (!values) return miss('renumber');
  }
  return null;
}

/** 만든 판을 적어 둔다(같은 판 번호로 여러 번 부르면 다시 만들지 않는다. 판은 늘 같으므로 결과도 같다) */
const made = new Map();

/** 그 단계의 판 번호로 만드는 판 */
function boardAt(rung, seed, { small = false } = {}) {
  const key = `${rung.level}:${seed}:${small ? 'small' : ''}`;
  if (made.has(key)) return made.get(key);
  const rng = createRng(seedFrom('seqpath', rung.level, seed, small ? 'small' : ''));
  const first = rung.level === 1 && seed === 1;
  const spec = small ? { ...FIRST, size: SMALL_SIZE, lens: [3, 5] } : first ? FIRST : rung.spec;
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const found = plantBoard(rng, spec);
    if (found) {
      made.set(key, found);
      return found;
    }
  }
  throw new Error(`판을 만들지 못했어요: ${rung.level}단계 ${seed}번`);
}

/**
 * 판 하나를 낸다.
 * @param {number} level 1~5
 * @param {number} seed 판 번호(1부터)
 * @param {{small?: boolean}} options small: 맨 아래 단계에서 작은 판(3×3)을 낸다(수준 맞추기에서 쓴다)
 * @returns {{level: number, seed: number, small: boolean, board: object, solution: {count: number, paths: number[][]}}}
 */
export function generateBoard(level, seed, { small = false } = {}) {
  const rung = rungOf(level);
  if (rung.mode === 'make') throw new Error('직접 만들기 단계는 판을 내지 않아요');
  if (!Number.isInteger(seed) || seed < 1) throw new Error(`판 번호는 1부터예요: ${seed}`);
  const shrink = small && level === LADDER[0].level;
  const found = boardAt(rung, seed, { small: shrink });
  return { level, seed, small: shrink, board: { w: found.board.w, h: found.board.h, values: found.board.values.slice() }, solution: { count: 1, paths: found.paths.map((path) => path.slice()) } };
}

/** 다음 판 번호. 방금 한 판과 같은 판이 나오는 번호는 건너뛴다 */
export function nextSeed(level, seed) {
  const rung = rungOf(level);
  if (rung.mode === 'make') return seed + 1;
  const before = boardAt(rung, seed).board;
  let next = seed + 1;
  while (boardAt(rung, next).board.values.join() === before.values.join() && boardAt(rung, next).board.w === before.w) next += 1;
  return next;
}

/**
 * 더 작은 판들: 원래 판과 같은 종류(뛰는 크기의 후보, 같은 간격인지)로, 칸이 원래 판의 3분의 2 이하인 판. 모두 방법이 꼭 하나인 판이다.
 * 같은 판에는 늘 같은 판들이 나온다. 3×3보다 작게는 만들지 않는다(그런 판은 없다).
 * @param {object} origin { mode, board }
 * @returns {{yes: object[], no: object[]}}
 */
export function smallBoards(origin) {
  const { board, mode } = origin;
  const cells = board.w * board.h;
  const sizes = [];
  for (let w = 3; w <= 6; w++) for (let h = 3; h <= 6; h++) if (w * h * 3 <= cells * 2 && Math.abs(w - h) <= 1) sizes.push([w, h]);
  if (sizes.length === 0) return { yes: [], no: [] };
  const rung = LADDER.find((item) => item.mode === mode && item.spec) ?? LADDER[1];
  // 직접 만든 판은 그 판의 수들 사이의 차에서 뛰는 크기를 고른다(없으면 1~3)
  const spec = { ...rung.spec };
  if (mode === 'made') {
    const values = board.values.filter((value) => value !== null);
    const gaps = new Set();
    for (const a of values) for (const b of values) if (a < b && b - a <= 9) gaps.add(b - a);
    spec.steps = gaps.size > 0 ? [...gaps].sort((a, b) => a - b).slice(0, 4) : [1, 2, 3];
    spec.sameStep = false;
  }
  const rng = createRng(seedFrom('seqpath-small', JSON.stringify(board), mode));
  const yes = [];
  for (let attempt = 0; attempt < MAX_TRIES && yes.length < 2; attempt++) {
    const size = sizes[(yes.length + attempt) % sizes.length];
    const small = { ...spec, size, lens: [3, Math.min(spec.lens[1], 6)], maxValue: Math.max(spec.maxValue, 20), empty: [0.05, 0.5], near: Math.min(spec.near, 1) };
    const found = plantBoard(rng, small);
    if (!found) continue;
    if (yes.some((item) => item.values.join() === found.board.values.join() && item.w === found.board.w)) continue;
    yes.push(found.board);
  }
  return { yes, no: [] };
}
