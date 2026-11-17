// 동전 뒤집기의 사다리(단계)와 판 만들어 내기. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 풀이 프로그램으로 확인한 판만 내보낸다.
import { headCount, solve } from './coins.js';
import { createRng, randInt, seedFrom } from './rng.js';

/**
 * 안 되는 판이 섞이는 단계에서 안 되는 판의 비율. 임시값이다(셋에 하나쯤).
 * 늘 되거나 늘 안 되면 해 보지 않고 찍게 된다.
 */
export const IMPOSSIBLE_RATE = 1 / 3;

/**
 * 사다리. 기획 문서의 표를 그대로 옮겼다.
 *   tag    'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   counts 동전 수의 후보
 *   start  'all-heads'(모두 앞면) | 'mixed'(앞뒤가 섞임) | 'make'(아이가 직접 만든다)
 *   mix    true면 안 되는 판을 IMPOSSIBLE_RATE만큼 일부러 섞는다
 *
 * 1단계와 3단계는 표에 "모두 앞면"이라고만 되어 있어 비율을 손대지 않는다.
 * 되는지 안 되는지는 풀이 프로그램이 알려 주는 대로 둔다(1단계의 5개짜리는 안 되는 판으로 나온다).
 * 4단계와 5단계의 동전 수(5~8, 5~9)와, 거기에 안 되는 판을 섞는 것은 임시로 정한 것이다.
 */
export const LADDER = [
  { level: 1, tag: 'basic', rule: 'any2', shape: 'line', counts: [4, 5, 6], start: 'all-heads', mix: false },
  { level: 2, tag: 'applied', rule: 'any2', shape: 'line', counts: [5, 6, 7, 8], start: 'mixed', mix: true },
  { level: 3, tag: 'applied', rule: 'any3', shape: 'line', counts: [4, 5, 6, 7], start: 'all-heads', mix: false },
  { level: 4, tag: 'challenge', rule: 'adj3', shape: 'line', counts: [5, 6, 7, 8], start: 'mixed', mix: true },
  { level: 5, tag: 'challenge', rule: 'adj3', shape: 'ring', counts: [5, 6, 7, 8, 9], start: 'mixed', mix: true },
  { level: 6, tag: 'challenge', start: 'make' },
];

/** 판을 만들어 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;

/** 한 판을 고르려고 다시 뽑아 보는 횟수의 위 끝. 넘으면 조건을 푼다(실제로는 넘지 않는다. 테스트로 확인한다). */
const MAX_TRIES = 300;

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

/** 너무 뻔한 판을 거른다: 이미 다 뒷면이거나, 한 번에 끝나거나, 앞면이 하나뿐인 안 되는 판 */
function tooPlain(coins, solution) {
  const heads = headCount(coins);
  if (heads === 0) return true;
  if (solution.possible) return solution.min < 2;
  return heads < 2;
}

/**
 * 판 하나를 만든다.
 * @param {number} level 1~5
 * @param {number} seed 판 번호
 * @param {{small?: boolean}} options small: 그 단계에서 동전 수가 가장 적은 판을 낸다(수준 맞추기에서 쓴다)
 * @returns {{level: number, seed: number, small: boolean, board: object, solution: {possible: boolean, min: number|null, moves: number[][]}}}
 */
export function generateBoard(level, seed, { small = false } = {}) {
  const rung = rungOf(level);
  if (rung.start === 'make') throw new Error('직접 만들기 단계는 판을 만들어 내지 않아요');
  const rng = createRng(seedFrom('coins', level, seed, small ? 'small' : 'any'));
  const pickCount = () => (small ? Math.min(...rung.counts) : rung.counts[randInt(rng, 0, rung.counts.length - 1)]);
  const make = (n, coins) => {
    const board = { n, shape: rung.shape, rule: rung.rule, coins };
    return { board, solution: solve(board) };
  };

  if (rung.start === 'all-heads') {
    const n = pickCount();
    const { board, solution } = make(n, Array(n).fill(1));
    return { level, seed, small, board, solution };
  }

  // 앞뒤가 섞인 판: 되는 판을 낼지 안 되는 판을 낼지 먼저 정하고, 풀이 프로그램이 그렇다고 할 때까지 다시 뽑는다.
  const wantImpossible = rung.mix && rng() < IMPOSSIBLE_RATE;
  let fallback = null;
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const n = pickCount();
    const coins = Array.from({ length: n }, () => (rng() < 0.5 ? 1 : 0));
    if (headCount(coins) === n) continue; // 섞인 판이어야 한다
    const { board, solution } = make(n, coins);
    if (tooPlain(coins, solution)) continue;
    if (!fallback) fallback = { board, solution };
    if (solution.possible === !wantImpossible) return { level, seed, small, board, solution };
  }
  // 원하는 쪽이 한 번도 안 나왔다(예: 작은 고리에는 안 되는 판이 없다). 뻔하지 않은 첫 판을 낸다.
  if (!fallback) throw new Error(`판을 만들지 못했어요: ${level}단계 ${seed}번`);
  return { level, seed, small, ...fallback };
}

function sameBoard(a, b) {
  return a.n === b.n && a.shape === b.shape && a.rule === b.rule && a.coins.every((coin, index) => coin === b.coins[index]);
}

/**
 * 다음 판 번호. 방금 한 판과 똑같은 판이 나오는 번호는 건너뛴다
 * (모두 앞면인 단계는 서로 다른 판이 서너 개뿐이다).
 */
export function nextSeed(level, seed, options = {}) {
  const now = generateBoard(level, seed, options).board;
  for (let next = seed + 1; next < seed + 40; next++) {
    if (!sameBoard(generateBoard(level, next, options).board, now)) return next;
  }
  return seed + 1;
}
