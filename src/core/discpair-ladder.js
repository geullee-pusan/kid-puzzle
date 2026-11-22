// 원판 둘씩 옮기기의 사다리(단계)와 판 내기, 더 작은 판. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 원판은 시드 난수(rng.js)로 칸마다 하나씩 흩어 놓는다.
//
// 되는 판은 가장 적은 옮기기 수가 단계의 범위에 드는 판만 낸다(이미 모여 있는 판은 내지 않는다).
// 안 되는 판은 모두 칸 수와 원판 수가 짝수이고 동그라미 칸의 원판이 홀수 개인 판이다. 아이는 "색 켜기"로 그 수를 볼 수 있다.
//   2단계에서 처음 만나는 안 되는 판(2번)은 네 칸 고리의 옆 칸에 원판이 하나씩 있는 판이다. 두 원판을 함께 옮기니 둘은 늘 옆 칸에 있다(판만 보고도 보인다).
//   3단계에서 처음 만나는 안 되는 판(2번)은 여섯 칸에 하나씩 놓인 판이다(책의 판).
// 4단계의 되는 판은 칸 수가 홀수인 고리(5칸, 7칸)이고, 원판 수가 짝수인데 동그라미 칸의 원판이 홀수 개인 판이다(짝수 칸 고리라면 안 되는 판).
//   색을 칠하면 0번 칸과 맨 끝 칸이 둘 다 동그라미 칸이라, 그 사이를 지나는 원판이 있어야 모인다. 여섯 판에 하나는 여섯 칸 고리의 되는 판이다.
// 원판 수가 홀수인 되는 판도 섞는다(동그라미 칸의 원판이 홀수 개여도 된다. 모을 칸의 모양이 정해진다).
// 안 되는 판이 섞이는 단계(2~5단계)에서는 여섯 판에 둘(판 번호를 6으로 나눈 나머지가 2와 5)이고, 연달아 나오지 않는다. 1단계에는 안 되는 판이 없다.
import { boardKey, copyBoard, isGathered, sameBoard, shapeCounts, solve, totalOf } from './discpair.js';
import { createRng, randInt, seedFrom } from './rng.js';

/**
 * 사다리.
 *   tag     'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode    'gather'(모아 보기, 모두 되는 판) | 'four'(네 칸 고리) | 'six'(여섯 칸 고리) | 'odd'(칸 수가 다른 고리) | 'big'(큰 고리) | 'make'(직접 만든다)
 *   cells   되는 판의 칸 수 목록(고르는 차례대로 섞여 있다)
 *   totals  되는 판의 원판 수 범위
 *   min     되는 판의 가장 적은 옮기기 수 범위
 *   no      안 되는 판의 칸 수 목록과 원판 수 목록. null이면 안 되는 판이 없다
 */
export const LADDER = [
  { level: 1, tag: 'basic', mode: 'gather', cells: [4, 6], totals: [2, 4], min: [1, 2], no: null },
  { level: 2, tag: 'basic', mode: 'four', cells: [4], totals: [2, 5], min: [1, 3], no: { cells: [4], totals: [2, 4] } },
  { level: 3, tag: 'applied', mode: 'six', cells: [6], totals: [4, 7], min: [2, 4], no: { cells: [6], totals: [4, 6] } },
  { level: 4, tag: 'applied', mode: 'odd', cells: [5, 7], totals: [4, 6], min: [2, 4], no: { cells: [6], totals: [4, 6] } },
  { level: 5, tag: 'challenge', mode: 'big', cells: [7, 8], totals: [6, 8], min: [4, 7], no: { cells: [8], totals: [6, 8] } },
  { level: 6, tag: 'challenge', mode: 'make' },
];

/** 판을 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;

/** 판 하나를 만들려고 다시 골라 보는 횟수의 위 끝. 실제로는 넘지 않는다(테스트로 확인한다) */
const MAX_TRIES = 2000;

/** 1단계의 첫 판(실패할 수 없다. 두 원판을 가운데 칸 하나로 옮기면 끝난다), 2단계와 3단계에서 처음 만나는 안 되는 판 */
const FIRST = { n: 4, piles: [1, 0, 1, 0] };
const FIRST_NO = { n: 4, piles: [1, 1, 0, 0] };
const SIX_NO = { n: 6, piles: [1, 1, 1, 1, 1, 1] };

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

/** 그 판 번호가 안 되는 판의 자리인가(안 되는 판이 섞이는 단계에서 여섯 판에 둘) */
export const impossibleAt = (rung, seed) => rung.no !== null && [1, 4].includes((seed - 1) % 6);

/** 한 번 푼 판은 적어 둔다 */
const solved = new Map();
export function solveOnce(board) {
  const key = boardKey(board);
  if (!solved.has(key)) solved.set(key, solve(board));
  return solved.get(key);
}

// ---- 판 만들기 ----

/** 원판 total개를 n칸에 하나씩 아무 칸에나 놓은 판 */
export function scatter(rng, n, total) {
  const piles = Array(n).fill(0);
  for (let disc = 0; disc < total; disc++) piles[randInt(rng, 0, n - 1)] += 1;
  return { n, piles };
}

/** 홀수 칸 고리에서 동그라미 칸의 원판이 홀수 개이고 원판 수가 짝수인가(짝수 칸 고리라면 안 되는 판의 모습) */
export const oddTrap = (board) => board.n % 2 === 1 && totalOf(board.piles) % 2 === 0 && shapeCounts(board.piles).circle % 2 === 1;

/** 되는 판 하나: 칸 n개, 원판 수 [low, high], 가장 적은 수 [lo, hi]. fits(판)도 맞아야 한다 */
export function possibleBoard(rng, n, [low, high], [lo, hi], fits = () => true) {
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const board = scatter(rng, n, randInt(rng, low, high));
    if (isGathered(board.piles) || !fits(board)) continue;
    const { possible, min } = solveOnce(board);
    if (possible && min >= lo && min <= hi) return board;
  }
  throw new Error(`되는 판을 만들지 못했어요: ${n}칸`);
}

/** 안 되는 판 하나: 칸 n개, 원판 수는 totals 가운데 하나 */
function impossibleBoard(rng, n, totals) {
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const board = scatter(rng, n, totals[randInt(rng, 0, totals.length - 1)]);
    if (!solveOnce(board).possible) return board;
  }
  throw new Error(`안 되는 판을 만들지 못했어요: ${n}칸`);
}

/** 그 단계의 판 번호로 만드는 판 */
function boardAt(rung, seed) {
  if (rung.level === 1 && seed === 1) return copyBoard(FIRST);
  if (rung.level === 2 && seed === 2) return copyBoard(FIRST_NO);
  if (rung.level === 3 && seed === 2) return copyBoard(SIX_NO);
  const rng = createRng(seedFrom('discpair', rung.level, seed));
  if (impossibleAt(rung, seed)) return impossibleBoard(rng, rung.no.cells[randInt(rng, 0, rung.no.cells.length - 1)], rung.no.totals);
  const pick = randInt(rng, 0, rung.cells.length - 1);
  // 4단계는 여섯 판에 하나(판 번호를 6으로 나눈 나머지가 4)가 여섯 칸 고리의 되는 판이고, 나머지 되는 판은 홀수 칸 고리다.
  // 홀수 칸 고리는 짝수 칸 고리였다면 안 되는 모습만 낸다
  const odd = rung.mode === 'odd';
  const n = odd ? ((seed - 1) % 6 === 3 ? 6 : rung.cells[pick]) : rung.cells[pick];
  const fits = odd && n % 2 === 1 ? oddTrap : () => true;
  return possibleBoard(rng, n, rung.totals, rung.min, fits);
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
  return { level, seed, small: shrink, board: boardAt(rung, shrink ? 1 : seed) };
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

/** 판의 종류: 칸 수의 홀짝, 원판 수의 홀짝, 동그라미 칸 원판 수의 홀짝 */
export function kindOf(board) {
  const { circle } = shapeCounts(board.piles);
  return `${board.n % 2}${totalOf(board.piles) % 2}${circle % 2}`;
}

/** 작은 판의 크기들(칸 수, 원판 수). 칸 수는 홀짝을 그대로 두고 둘씩 줄이고(짝수는 4칸, 홀수는 5칸까지), 원판 수도 둘씩 줄인다 */
export function smallSizes(board) {
  const { n } = board;
  const total = totalOf(board.piles);
  const floor = n % 2 === 0 ? 4 : 5;
  const sizes = [[n - 2, total - 2], [n - 2, total], [n, total - 2], [n - 2, total - 4], [n, total - 4]];
  return sizes.filter(([cells, discs]) => cells >= floor && discs >= 2 && (cells < n || discs < total));
}

/**
 * 더 작은 판들. 같은 판에는 늘 같은 판들이 나온다. 칸 수가 적거나 원판이 적다.
 *   yes: 되는 판. 원래 판이 되는 판이면 종류(칸 수, 원판 수, 동그라미 칸 원판 수의 홀짝)가 같고 가장 적은 수가 원래 판보다 많지 않다.
 *        원래 판이 안 되는 판이면 칸 수와 원판 수의 홀짝이 같고 동그라미 칸의 원판이 짝수 개인 되는 판이다
 *   no:  원래 판이 안 되는 판이면 같은 종류의 안 되는 판(동그라미 칸의 원판이 홀수 개)
 * 원래 판이 되는 판이면 no는 비어 있다. 이미 모여 있는 판은 내지 않는다. 네 칸에 원판 둘인 판처럼 더 줄일 수 없으면 둘 다 비어 있다.
 * @param {object} origin { mode, board }
 * @returns {{yes: object[], no: object[]}}
 */
export function smallBoards(origin) {
  const { board } = origin;
  const from = solveOnce(board);
  const kind = kindOf(board);
  const rng = createRng(seedFrom('discpair-small', boardKey(board)));
  const yes = [];
  const no = [];
  const seen = new Set();
  for (const [cells, discs] of smallSizes(board)) {
    for (let attempt = 0; attempt < 200 && (yes.length < 2 || (!from.possible && no.length < 2)); attempt++) {
      const small = scatter(rng, cells, discs);
      const key = boardKey(small);
      if (seen.has(key) || isGathered(small.piles)) continue;
      const found = solveOnce(small);
      const same = kindOf(small) === kind;
      if (from.possible) {
        if (!same || !found.possible || found.min > from.min || yes.length >= 2) continue;
        yes.push(small);
      } else if (found.possible) {
        if (kindOf(small).slice(0, 2) !== kind.slice(0, 2) || yes.length >= 2) continue;
        yes.push(small);
      } else {
        if (!same || no.length >= 2) continue;
        no.push(small);
      }
      seen.add(key);
    }
  }
  return { yes, no };
}
