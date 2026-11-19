// 누가 이길까의 사다리(단계)와 판 내기. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 풀이 프로그램으로 푼 판만 내보낸다:
// 판마다 "잘 두었을 때 어느 쪽이 이기는지"가 붙어 있고, 그것은 끝에서부터 따진 결과다.
import { copyBoard, solve } from './duel.js';
import { createRng, randInt, seedFrom } from './rng.js';

/**
 * 2~7단계에서 나중에 두는 쪽이 이기는 판의 비율. 임시값이다(반반쯤).
 * 늘 먼저 두는 쪽이 이기면 고르기가 뜻이 없어진다. 돌의 수를 고르게 뽑으면 나중에 두는 쪽이 이기는 판이 드물어서 일부러 맞춘다.
 * 단계에 second가 적혀 있으면 그 값을 쓴다(나중에 두는 쪽이 이기는 판이 몇 가지뿐인 단계. 같은 판이 너무 자주 나오지 않게).
 */
export const SECOND_RATE = 1 / 2;

/**
 * 사다리.
 *   tag     'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   game    'choco'(초콜릿 쪼개기) | 'one'(한 더미) | 'two'(두 더미) | 'three'(세 더미)
 *           | 'divisor'(약수 빼기) | 'half'(절반까지 가져가기) | 'both'(두 더미에서 같은 수도) | 'make'(아이가 직접 정한다)
 *   boards  1단계의 판의 차례([가로, 세로]). 가짓수가 적어서 뽑지 않고 정해 둔 차례로 돌린다
 *   stones  돌의 수의 아래 끝과 위 끝(한 더미는 더미 하나, 여러 더미는 더미마다)
 *   takes   한 더미에서 한 번에 가져갈 수 있는 수의 위 끝의 후보
 *   second  나중에 두는 쪽이 이기는 판을 내는 비율(적혀 있지 않으면 SECOND_RATE)
 *
 * 1단계는 작은 판 다섯 가지(2×2, 2×3, 3×3, 2×4, 3×4)다. 어느 쪽이 이기는지는 칸의 수의 홀짝에 달렸다.
 * 3×3만 나중에 두는 쪽이 이긴다. 가로와 세로를 바꾼 판은 차례의 뒤쪽에 섞었고, 3×3은 세 번 나온다(열에 셋).
 * 차례에서 이웃한 두 판은 늘 다르다(맨 끝과 맨 처음도 다르다).
 * 맨 처음 판(판 번호 1)은 2×2이고 아이가 먼저 둔다. 어떻게 두어도 아이가 마지막 조각을 쪼갠다(실패할 수 없는 첫 판).
 *
 * 5~7단계는 2026-11-20에 직접 만들기 앞에 더했다(묶음 "수 게임"과 두 더미에서 같은 수 가져가기). 1~4단계의 번호는 그대로이고,
 * 직접 만들기는 5단계에서 8단계가 되었다.
 *   5단계 약수 빼기: 돌 6~20개. 홀수 개에서 차례가 오면 진다(풀이 프로그램이 낸 사실. 화면에서는 말하지 않는다)
 *   6단계 절반까지: 돌 5~24개. 차례가 오면 지는 돌의 수는 7개와 15개뿐이라 나중이 이기는 판은 셋에 하나로 둔다(임시)
 *   7단계 두 더미에서 같은 수도: 더미마다 1~9개. 지는 판은 1개와 2개, 3개와 5개, 4개와 7개(차례를 바꾼 것까지 여섯 가지)라 셋에 하나로 둔다(임시)
 */
export const LADDER = [
  { level: 1, tag: 'basic', game: 'choco', boards: [[2, 2], [3, 2], [3, 3], [4, 2], [4, 3], [2, 3], [3, 3], [2, 4], [3, 4], [3, 3]] },
  { level: 2, tag: 'applied', game: 'one', stones: [5, 20], takes: [2, 3] },
  { level: 3, tag: 'applied', game: 'two', stones: [2, 8] },
  { level: 4, tag: 'challenge', game: 'three', stones: [1, 7] },
  { level: 5, tag: 'applied', game: 'divisor', stones: [6, 20] },
  { level: 6, tag: 'applied', game: 'half', stones: [5, 24], second: 1 / 3 },
  { level: 7, tag: 'challenge', game: 'both', stones: [1, 9], second: 1 / 3 },
  { level: 8, tag: 'challenge', game: 'make' },
];

/** 판을 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 7;
export const MAKE_LEVEL = 8;
/** 5~7단계를 더하기 전의 직접 만들기 단계. 그때 적어 둔 하던 판과 공책의 만든 판은 이 번호를 갖고 있다(그대로 받는다). */
export const OLD_MAKE_LEVEL = 5;

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

/** 고르기 없이 아이가 먼저 두는 판인가. 형식의 맨 첫 판(1단계의 판 번호 1)만 그렇다. */
export function opensFixed(level, seed) {
  return level === LADDER[0].level && seed === 1;
}

const rngOf = (level, seed) => createRng(seedFrom('duel', level, seed));
const pick = (rng, list) => list[randInt(rng, 0, list.length - 1)];

/** 이 번호의 판을 나중에 두는 쪽이 이기는 판으로 낼 것인가(2~7단계) */
function wantsSecond(level, seed) {
  return rngOf(level, seed)() < (rungOf(level).second ?? SECOND_RATE);
}

/** 그 단계에서 낼 수 있는 판 모두. 한 번 구한 것은 적어 둔다. 판마다 풀이 프로그램으로 푼 결과가 붙어 있다 */
const pools = new Map();
function poolOf(level) {
  if (pools.has(level)) return pools.get(level);
  const rung = rungOf(level);
  const [low, high] = rung.stones;
  const boards = [];
  if (rung.game === 'one') {
    for (const max of rung.takes) for (let n = low; n <= high; n++) boards.push({ kind: 'one', n, max });
  } else if (rung.game === 'divisor' || rung.game === 'half') {
    for (let n = low; n <= high; n++) boards.push({ kind: rung.game, n });
  } else {
    const kind = rung.game === 'both' ? 'both' : 'piles';
    const build = (piles) => {
      if (piles.length === (rung.game === 'three' ? 3 : 2)) boards.push({ kind, piles });
      else for (let count = low; count <= high; count++) build([...piles, count]);
    };
    build([]);
  }
  const solved = boards.map((board) => ({ board, solution: solve(board) }));
  const pool = { first: solved.filter((item) => item.solution.first), second: solved.filter((item) => !item.solution.first) };
  pools.set(level, pool);
  return pool;
}

/**
 * 판 하나를 낸다.
 * @param {number} level 1~7
 * @param {number} seed 판 번호(1부터)
 * @param {{small?: boolean}} options small: 맨 아래 단계에서 가장 작은 판을 낸다(수준 맞추기에서 쓴다)
 * @returns {{level: number, seed: number, small: boolean, board: object, solution: {first: boolean, winner: string, moves: object[], positions: number}}}
 *   solution.first  잘 두었을 때 먼저 두는 쪽이 이기는가(풀이 프로그램이 끝에서부터 따진 결과)
 */
export function generateBoard(level, seed, { small = false } = {}) {
  const rung = rungOf(level);
  if (rung.game === 'make') throw new Error('직접 만들기 단계는 판을 내지 않아요');
  let board;
  if (rung.game === 'choco') {
    const shrink = small && level === LADDER[0].level;
    const count = rung.boards.length;
    const [w, h] = rung.boards[shrink ? 0 : (((seed - 1) % count) + count) % count];
    board = { kind: 'choco', w, h };
  } else {
    const rng = rngOf(level, seed);
    rng(); // 첫 수는 어느 쪽이 이기는 판을 낼지 정하는 데 쓴다(wantsSecond).
    const pool = poolOf(level);
    board = copyBoard(pick(rng, wantsSecond(level, seed) ? pool.second : pool.first).board);
  }
  return { level, seed, small, board, solution: solve(board) };
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
