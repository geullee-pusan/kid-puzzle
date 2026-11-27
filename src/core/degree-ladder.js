// 조건 맞춰 잇기의 사다리(단계)와 판 내기, 더 작은 판. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 점의 수와 점마다의 수는 시드 난수(rng.js)로 고르고, 풀이 프로그램으로 확인한 판만 낸다.
import { MAX_POINTS, bigPoints, caseTree, checkBoard, oddPoints, partnersOf, plainReasons, realize, sameBoard, sumOf } from './degree.js';
import { createRng, randInt, seedFrom } from './rng.js';

/**
 * 사다리.
 *   tag   'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode  'three'(모든 점이 셋씩. 점이 홀수 개면 안 되는 판) | 'mixed'(점마다 수가 다르다. 모두 되는 판)
 *         | 'parity'(되는 판과 모두 더하면 홀수인 판) | 'big'(되는 판과 이을 수 있는 점보다 큰 수가 있는 판)
 *         | 'search'(되는 판과, 홀수도 큰 수도 아닌데 안 되는 판. "모든 경우 펼쳐 보기") | 'make'(직접 만든다)
 */
export const LADDER = [
  { level: 1, tag: 'basic', mode: 'three' },
  { level: 2, tag: 'basic', mode: 'mixed' },
  { level: 3, tag: 'applied', mode: 'parity' },
  { level: 4, tag: 'applied', mode: 'big' },
  { level: 5, tag: 'challenge', mode: 'search' },
  { level: 6, tag: 'challenge', mode: 'make' },
];

/** 판을 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;
/** 직접 만들기의 처음 판과 점의 수의 범위 */
export const MAKE_FIRST = [3, 3, 3, 3, 3];
export const MAKE_POINTS = [3, MAX_POINTS];

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

/** 안 되는 판이 섞이는 단계에서 안 되는 판의 번호: 셋에 하나. 판 번호 2가 처음 만나는 안 되는 판이다 */
export const impossibleAt = (seed) => seed % 3 === 2;

/** 단계마다의 첫 판(번호 1)과 처음 만나는 안 되는 판(번호 2) */
const FIRSTS = {
  three: [[3, 3, 3, 3], [3, 3, 3, 3, 3]],
  mixed: [[3, 2, 1, 2]],
  parity: [[2, 3, 1, 2, 2], [2, 2, 1, 2, 2]],
  big: [[3, 1, 2, 2], [4, 2, 1, 1]],
  search: [[3, 2, 3, 2], [3, 1, 3, 1]],
};

/** 모든 점이 셋씩인 판의 점의 수 */
const THREE_OK = [4, 6, 6, 8];
const THREE_NO = [5, 7];
/** 단계마다 점의 수 */
const POINTS = { mixed: [4, 5, 5, 6], parity: [5, 6, 6, 7], big: [4, 5, 5, 6], search: [4, 5, 5, 6] };

/** 한 판을 고르려고 다시 뽑아 보는 횟수의 위 끝. 실제로는 넘지 않는다(테스트로 확인한다) */
const MAX_TRIES = 4000;

function shuffled(rng, list) {
  const items = list.slice();
  for (let index = items.length - 1; index > 0; index--) {
    const other = randInt(rng, 0, index);
    [items[index], items[other]] = [items[other], items[index]];
  }
  return items;
}

const allSame = (need) => need.every((value) => value === need[0]);
const possible = (need) => realize(need) !== null;
/** 안 되는 까닭이 꼭 하나인가(판만 보고 아는 까닭) */
const onlyReason = (need, reason) => {
  const reasons = plainReasons(need);
  return reasons.length === 1 && reasons[0] === reason;
};

/** 큰 수에서 작은 수 차례로 놓인 모든 수 목록(수는 0부터 n-1까지) */
function sortedNeeds(n) {
  const out = [];
  const walk = (list, top) => {
    if (list.length === n) {
      out.push(list.slice());
      return;
    }
    for (let value = top; value >= 0; value--) {
      list.push(value);
      walk(list, value);
      list.pop();
    }
  };
  walk([], n - 1);
  return out;
}

/** 모든 경우를 해 봐야 아는 판(까닭이 search이고 0인 점은 많아야 하나)인가. 경우의 나무가 한 줄기(갈래가 없는 판)만 고른다 */
export function isSearchBoard(need) {
  if (sumOf(need) % 2 === 1 || bigPoints(need).length > 0 || possible(need)) return false;
  if (need.filter((value) => value === 0).length > 1) return false;
  return caseTree(need).leaves.length === 1;
}

/** 모든 경우 펼쳐 보기와 함께 낼 되는 판: 수가 가장 큰 점이 이을 수 있는 점과 모두 이어야 하는 판(안 되는 판과 겉모습이 닮았다) */
export function isForcedBoard(need) {
  if (sumOf(need) % 2 === 1 || !possible(need) || allSame(need)) return false;
  if (need.filter((value) => value === 0).length > 1) return false;
  const top = Math.max(...need);
  const at = need.indexOf(top);
  return top >= 3 && top === partnersOf(need, at);
}

/** 판 하나를 뽑는다(make로 만들고 ok인 것만) */
function drawNeeds(make, ok) {
  for (let tries = 0; tries < MAX_TRIES; tries++) {
    const need = make();
    if (ok(need)) return need;
  }
  throw new Error('판을 고르지 못했어요');
}

/**
 * 단계의 판 하나를 뽑는다.
 * @param {string} mode 단계의 판의 종류
 * @param {number} n 점의 수
 * @param {boolean} no 안 되는 판을 뽑는가
 */
export function needsFor(rng, mode, n, no) {
  const top = Math.min(4, n - 1);
  const some = (low, high) => Array.from({ length: n }, () => randInt(rng, low, high));
  if (mode === 'three') return new Array(n).fill(3);
  if (mode === 'mixed' || mode === 'parity' || mode === 'made') {
    if (no) return drawNeeds(() => some(1, top), (need) => onlyReason(need, 'odd'));
    // 되는 판: 수가 모두 같지 않고, 3 이상인 점이 있고, 선이 넉넉하다(모두 더하면 점의 수의 두 배에서 2를 뺀 수 이상)
    const enough = mode === 'parity' ? 2 : 0;
    const rich = (need) => Math.max(...need) >= 3 && sumOf(need) >= 2 * n - 2;
    return drawNeeds(() => some(1, top), (need) => !allSame(need) && rich(need) && possible(need) && oddPoints(need).length >= enough);
  }
  if (mode === 'big') {
    // 안 되는 판: 한 점의 수가 점의 수만큼(다른 점보다 하나 많다), 또는 0인 점이 하나 있고 한 점의 수가 n-1
    // 되는 판: 한 점의 수가 n-1(모든 점과 잇는다), 또는 0인 점이 하나 있고 한 점의 수가 n-2
    const zero = randInt(rng, 0, 1) === 1 && n >= 5;
    const make = () => {
      const need = some(1, Math.min(3, n - 1));
      need[0] = (no ? n : n - 1) - (zero ? 1 : 0);
      if (zero) need[1] = 0;
      return shuffled(rng, need);
    };
    return drawNeeds(make, (need) => (no ? onlyReason(need, 'big') : possible(need)));
  }
  // search: 차례로 놓인 목록에서 고르고 섞는다
  const list = sortedNeeds(n).filter(no ? isSearchBoard : isForcedBoard);
  return shuffled(rng, list[randInt(rng, 0, list.length - 1)]);
}

/** 그 단계의 판 번호로 만드는 판 */
function boardAt(rung, seed) {
  const firsts = FIRSTS[rung.mode];
  if (seed <= firsts.length) return { need: firsts[seed - 1].slice() };
  const rng = createRng(seedFrom('degree', rung.level, seed));
  const no = rung.mode !== 'mixed' && impossibleAt(seed);
  if (rung.mode === 'three') {
    const list = no ? THREE_NO : THREE_OK;
    return { need: needsFor(rng, 'three', list[randInt(rng, 0, list.length - 1)], no) };
  }
  const counts = POINTS[rung.mode];
  const n = counts[randInt(rng, 0, counts.length - 1)];
  const need = needsFor(rng, rung.mode, n, no);
  return { need: rung.mode === 'search' || rung.mode === 'big' ? need : shuffled(rng, need) };
}

/**
 * 판 하나를 낸다.
 * @param {number} level 1~5
 * @param {number} seed 판 번호(1부터)
 * @param {{small?: boolean}} options small: 맨 아래 단계에서 작은 판(점 넷이 모두 셋씩)을 낸다(수준 맞추기에서 쓴다)
 * @returns {{level: number, seed: number, small: boolean, board: object}}
 */
export function generateBoard(level, seed, { small = false } = {}) {
  const rung = rungOf(level);
  if (rung.mode === 'make') throw new Error('직접 만들기 단계는 판을 내지 않아요');
  if (!Number.isInteger(seed) || seed < 1) throw new Error(`판 번호는 1부터예요: ${seed}`);
  const shrink = small && level === LADDER[0].level;
  const board = shrink ? { need: [3, 3, 3, 3] } : boardAt(rung, seed);
  if (checkBoard(board) !== null) throw new Error(`규격에 맞지 않는 판이에요: ${checkBoard(board)}`);
  return { level, seed, small: shrink, board };
}

/** 다음 판 번호. 방금 한 판과 같은 판이 나오는 번호는 건너뛴다 */
export function nextSeed(level, seed) {
  const rung = rungOf(level);
  if (rung.mode === 'make') return seed + 1;
  const before = boardAt(rung, seed);
  let next = seed + 1;
  while (sameBoard(boardAt(rung, next), before)) next += 1;
  return next;
}

// ---- 더 작은 판 ----

/** 판이 되는 판인가 */
export const possibleOf = (board) => possible(board.need);

/** 판의 안 되는 까닭(되는 판은 null) */
export function reasonOf(need) {
  if (possible(need)) return null;
  return plainReasons(need)[0] ?? 'search';
}

/** 작은 판으로 쓸 점의 수의 아래 끝 */
const SMALL_FLOOR = 4;

/**
 * 더 작은 판들. 되는 판(yes)과 안 되는 판(no)으로 나눠 낸다. 같은 판에는 늘 같은 판들이 나온다.
 *   모두 셋씩: 점이 더 적은 되는 판(넷, 여섯)과 안 되는 판(다섯)
 *   다른 판: 점이 하나, 둘 적은(넷 이상) 같은 단계의 판. 안 되는 판은 까닭이 같은 판이다
 *   직접 만든 판: 되는 판이면 수가 다른 되는 판, 안 되는 판이면 까닭이 같은 판
 * @param {object} origin { mode, board }
 * @returns {{ yes: object[], no: object[] }}
 */
export function smallBoards(origin) {
  const { board, mode } = origin;
  const empty = { yes: [], no: [] };
  if (!board || checkBoard(board) !== null) return empty;
  const n = board.need.length;
  if (mode === 'three' && board.need.every((value) => value === 3)) {
    return {
      yes: [6, 4].filter((count) => count < n).map((count) => ({ need: new Array(count).fill(3) })),
      no: [5].filter((count) => count < n && n % 2 === 1).map((count) => ({ need: new Array(count).fill(3) })),
    };
  }
  const reason = reasonOf(board.need);
  const style = mode === 'made' || mode === 'three' ? (reason === null || reason === 'odd' ? 'parity' : reason) : mode;
  const counts = [n - 1, n - 2].filter((count) => count >= SMALL_FLOOR);
  const make = (no, count, at) => {
    const rng = createRng(seedFrom('degree-small', board.need.join(','), mode, no ? 'no' : 'yes', at));
    const need = needsFor(rng, style, count, no);
    return { need: style === 'search' || style === 'big' ? need : shuffled(rng, need) };
  };
  const yes = counts.map((count, at) => make(false, count, at));
  const no = reason === null || style === 'mixed' ? [] : counts.map((count, at) => make(true, count, at));
  return { yes, no };
}

