// 낼 수 없는 금액의 사다리(단계)와 판 내기, 더 작은 판. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 동전은 정해 둔 목록에서 시드 난수(rng.js)로 고르고, 풀이 프로그램으로 확인한 판만 낸다.
//
// 끝이 없는 판(4·5단계)의 까닭은 판에서 보인다: 낼 수 있는 금액을 칠해 가면 칠해지지 않는 금액이 띠 끝까지 계속 나오고,
// "작은 동전만큼 줄 맞추기"(도구)를 켜면 끝까지 비어 있는 칸(세로줄)이 보인다. 끝이 있는 판은 띠에 낼 수 있는 금액이
// 작은 동전의 값만큼 잇달아 보인다(줄 맞추기로 놓으면 한 줄이 다 칠해지고, 그 아래 줄도 모두 칠해진다).
import { checkBoard, coinsOk, endOf, gcdOf, sameBoard, solve, topLimit } from './nopay.js';
import { createRng, randInt, seedFrom } from './rng.js';

/**
 * 사다리.
 *   tag   'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode  'first'(작은 동전 두 가지, 모두 찾기) | 'more'(더 큰 동전 두 가지, 모두 찾기) | 'from'(어느 금액부터 모두 될까) |
 *         'end'(끝이 있을까. 끝이 없는 짝이 셋에 하나) | 'three'(동전 세 가지와 큰 짝. 끝이 없는 묶음이 셋에 하나) | 'make'(직접 만든다)
 *
 * 1단계 작은 동전 두 가지: 3원과 5원(첫 판, 띠 20원까지), 2원과 5원, 3원과 4원, 2원과 7원, 2원과 9원. 낼 수 없는 금액을 모두 고른다.
 * 2단계 더 큰 동전 두 가지: 3원과 7원, 4원과 5원, 3원과 8원, 4원과 7원, 3원과 10원, 2원과 11원. 낼 수 없는 금액을 모두 고른다.
 * 3단계 어디부터 모두 될까요?: 띠는 낼 수 없는 가장 큰 금액 뒤로 작은 동전의 값보다 1~2칸 더 있다. 몇 원부터 모두 낼 수 있는지 자물쇠에 넣는다.
 * 4단계 끝이 있을까요?: 3단계와 같은 짝에 끝이 없는 짝(2원과 4원, 3원과 6원, 4원과 6원 …)이 셋에 하나(판 번호를 셋으로 나눈 나머지가 2).
 *   처음 만나는 끝이 없는 판(2번)은 2원과 4원이다.
 * 5단계 동전 세 가지: 세 가지 동전(4·6·9, 6·10·15 …)과 큰 짝(5원과 8원, 6원과 7원)에 끝이 없는 세 가지(4·6·10, 6·9·15 …)가 셋에 하나
 *   (나머지가 0, 곧 3번, 6번, …). 2번 판은 6원, 10원, 15원(어느 둘을 골라도 함께 묶이는데 셋이면 끝이 있다).
 * 6단계 직접 만들기: 동전 두세 가지(1~9원)를 정하면 선생님이 낼 수 없는 가장 큰 금액과 그 수(또는 없다, 끝이 없다)를 말한다.
 */
export const LADDER = [
  { level: 1, tag: 'basic', mode: 'first', sets: [[2, 5], [3, 4], [3, 5], [2, 7], [2, 9]], extra: [2, 5] },
  { level: 2, tag: 'basic', mode: 'more', sets: [[3, 7], [4, 5], [3, 8], [4, 7], [3, 10], [2, 11]], extra: [1, 3] },
  { level: 3, tag: 'applied', mode: 'from', sets: [[3, 7], [4, 5], [3, 8], [4, 7], [5, 6], [3, 10], [3, 11], [4, 9], [5, 7]], extra: [1, 2] },
  {
    level: 4,
    tag: 'applied',
    mode: 'end',
    sets: [[3, 5], [3, 7], [4, 5], [3, 8], [4, 7], [5, 6], [2, 9]],
    endless: [[2, 4], [2, 6], [3, 6], [4, 6], [3, 9], [4, 10], [6, 8], [6, 9]],
    extra: [1, 3],
  },
  {
    level: 5,
    tag: 'challenge',
    mode: 'three',
    sets: [[4, 6, 9], [5, 7, 9], [6, 7, 10], [4, 7, 10], [5, 8, 9], [6, 9, 10], [5, 6, 9], [4, 9, 10], [6, 10, 15], [5, 8], [6, 7]],
    endless: [[4, 6, 10], [6, 8, 10], [6, 9, 15], [6, 10, 14], [4, 10, 14]],
    extra: [1, 2],
  },
  { level: 6, tag: 'challenge', mode: 'make' },
];

/** 판을 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;

/** 판의 종류: 단계마다 */
const KIND = { first: 'all', more: 'all', from: 'from', end: 'end', three: 'end' };
export const kindOf = (mode) => KIND[mode] ?? 'end';

/** 정해 둔 판: 1단계의 첫 판, 3단계의 첫 판, 4단계의 첫 판과 처음 만나는 끝이 없는 판, 5단계의 첫 판과 2번 판 */
const FIXED = {
  '1:1': { kind: 'all', coins: [3, 5], top: 20 },
  '3:1': { kind: 'from', coins: [3, 7], top: 15 },
  '4:1': { kind: 'end', coins: [4, 5], top: 17 },
  '4:2': { kind: 'end', coins: [2, 4], top: 16 },
  '5:1': { kind: 'end', coins: [4, 6, 9], top: 16 },
  '5:2': { kind: 'end', coins: [6, 10, 15], top: 36 },
};

/** 직접 만들기의 처음 동전과 고를 수 있는 값 */
export const MAKE_FIRST = [3, 5];
export const MAKE_COINS = [1, 9];

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

/** 그 판 번호가 끝이 없는 판의 자리인가 */
export function impossibleAt(rung, seed) {
  if (rung.mode === 'end') return (seed - 1) % 3 === 1;
  if (rung.mode === 'three') return seed % 3 === 0;
  return false;
}

/** 한 번 푼 판은 적어 둔다 */
const solved = new Map();
export function solveOnce(board) {
  const key = `${board.kind}:${board.coins.join(',')}:${board.top}`;
  if (!solved.has(key)) solved.set(key, solve(board));
  return solved.get(key);
}

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

/**
 * 끝이 있는 동전의 띠 길이: 낼 수 없는 가장 큰 금액 + 작은 동전 + extra. 열두 칸보다 짧지 않고, 줄 맞추기로 놓아도 여덟 줄 안이다.
 * 끝이 없는 동전은 low부터 줄 맞추기의 위 끝까지에서 extra로 고른다.
 */
export function topFor(coins, extra) {
  const high = topLimit(coins);
  const end = endOf(coins);
  if (end.gcd !== 1) return clamp(extra, Math.min(12, high), high);
  return clamp(end.largest + coins[0] + extra, Math.min(12, high), high);
}

/** 끝이 없는 판의 띠 길이를 고르는 아래 끝 */
const endlessLow = (coins) => Math.min(topLimit(coins), Math.max(16, 4 * coins[0]));

// ---- 판 만들기 ----

/** 목록을 시드 난수로 섞는다 */
function shuffled(rng, list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randInt(rng, 0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * 목록에서 차례대로 고른다: 목록을 한 바퀴씩 시드 난수로 섞어 두고 index번째를 쓴다. 그래서 한 바퀴 안에서는 같은 동전이 다시 나오지 않는다.
 * @param {string} tag 끝이 있는 목록('yes')과 끝이 없는 목록('no')을 가른다
 */
function inTurn(rung, tag, list, index) {
  const lap = Math.floor(index / list.length);
  return shuffled(createRng(seedFrom('nopay', rung.level, tag, lap)), list)[index % list.length];
}

/** 그 판 번호 앞에(1번부터) 끝이 없는 판의 자리가 몇 개 있는가 */
function endlessBefore(rung, seed) {
  let count = 0;
  for (let at = 1; at < seed; at++) if (impossibleAt(rung, at)) count += 1;
  return count;
}

/** 그 단계의 판 번호로 만드는 판 */
function boardAt(rung, seed) {
  const fixed = FIXED[`${rung.level}:${seed}`];
  if (fixed) return { ...fixed, coins: fixed.coins.slice() };
  const rng = createRng(seedFrom('nopay', rung.level, seed));
  const kind = kindOf(rung.mode);
  const before = endlessBefore(rung, seed);
  if (impossibleAt(rung, seed)) {
    const coins = inTurn(rung, 'no', rung.endless, before).slice();
    return { kind, coins, top: topFor(coins, randInt(rng, endlessLow(coins), topLimit(coins))) };
  }
  const coins = inTurn(rung, 'yes', rung.sets, seed - 1 - before).slice();
  return { kind, coins, top: topFor(coins, randInt(rng, rung.extra[0], rung.extra[1])) };
}

/**
 * 판 하나를 낸다.
 * @param {number} level 1~5
 * @param {number} seed 판 번호(1부터)
 * @param {{small?: boolean}} options small: 맨 아래 단계에서 작은 판(실패할 수 없는 1번 판)을 낸다(수준 맞추기에서 쓴다)
 * @returns {{level: number, seed: number, small: boolean, board: object}}
 */
export function generateBoard(level, seed, { small = false } = {}) {
  const rung = rungOf(level);
  if (rung.mode === 'make') throw new Error('직접 만들기 단계는 판을 내지 않아요');
  if (!Number.isInteger(seed) || seed < 1) throw new Error(`판 번호는 1부터예요: ${seed}`);
  const shrink = small && level === LADDER[0].level;
  const board = boardAt(rung, shrink ? 1 : seed);
  if (checkBoard(board) !== null) throw new Error(`규격에 맞지 않는 판이에요: ${level}단계 ${seed}번`);
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

// ---- 직접 만든 판 ----

/** 직접 만든 동전으로 해 볼 판: 끝이 있을까와 같은 판(자물쇠와 "끝이 없어요"). 띠는 끝 뒤로 작은 동전 + 2칸(줄 맞추기의 위 끝까지) */
export function madeBoard(coins) {
  if (!coinsOk(coins, MAKE_COINS[1])) return null;
  const end = endOf(coins);
  const top = end.gcd === 1 ? topFor(coins, 2) : topLimit(coins);
  return { kind: 'end', coins: coins.slice(), top };
}

// ---- 더 작은 판 ----

/** 더 작은 판으로 쓸 끝이 있는 두 가지와 세 가지, 끝이 없는 두 가지와 세 가지 */
const SMALL_PAIRS = [[2, 3], [2, 5], [3, 4], [3, 5], [2, 7], [3, 7], [4, 5], [3, 8], [4, 7], [5, 6]];
const SMALL_TRIPLES = [[3, 4, 5], [3, 5, 7], [4, 5, 6], [4, 5, 7], [4, 6, 7], [5, 6, 7], [4, 6, 9], [5, 7, 9]];
const ENDLESS_PAIRS = [[2, 4], [2, 6], [3, 6], [4, 6], [3, 9], [4, 10]];
const ENDLESS_TRIPLES = [[2, 4, 6], [4, 6, 8], [3, 6, 9], [4, 6, 10]];

/** 원래 동전보다 작은 묶음들(가장 큰 동전이 더 작고, 가장 작은 동전이 더 크지 않다). 원래 것에 가까운 것부터 둘 */
function smallerSets(list, coins) {
  const big = coins[coins.length - 1];
  return list
    .filter((set) => set[set.length - 1] < big && set[0] <= coins[0])
    .sort((a, b) => b[b.length - 1] - a[a.length - 1] || b[0] - a[0])
    .slice(0, 2);
}

/** 작은 판 하나: 원래 판과 같은 종류. 띠는 끝 뒤로 작은 동전 + 2칸 */
const smallBoard = (kind, coins) => ({ kind, coins: coins.slice(), top: topFor(coins, gcdOf(coins) === 1 ? 2 : topLimit(coins)) });

/**
 * 더 작은 판들. 같은 판에는 늘 같은 판들이 나온다. 동전 값이 더 작은 같은 종류의 판이다.
 *   { yes, no }. yes는 끝이 있는 판, no는 끝이 없는 판이다(끝이 없는 판은 "끝이 없어요"가 있는 판에서만).
 *   세 가지 동전의 판은 더 작은 세 가지가 있으면 그것을, 없으면 두 가지를 쓴다. 2원과 3원처럼 더 줄일 수 없으면 비어 있다.
 */
export function smallBoards(board) {
  const { coins, kind } = board;
  const three = coins.length === 3;
  let yes = smallerSets(three ? SMALL_TRIPLES : SMALL_PAIRS, coins);
  if (three && yes.length === 0) yes = smallerSets(SMALL_PAIRS, coins);
  let no = [];
  if (kind === 'end') {
    no = smallerSets(three ? ENDLESS_TRIPLES : ENDLESS_PAIRS, coins);
    if (three && no.length === 0) no = smallerSets(ENDLESS_PAIRS, coins);
  }
  return { yes: yes.map((set) => smallBoard(kind, set)), no: no.map((set) => smallBoard(kind, set)) };
}

/** 더 작은 판을 고를 때의 "되는 판"(끝이 있는 판) */
export const possibleOf = (board) => gcdOf(board.coins) === 1;
