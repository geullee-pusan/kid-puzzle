// 탑 옮기기의 사다리(단계)와 판 내기, 더 작은 판. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 판 번호 1(과 몇 단계의 2, 3)은 정해 둔 판이고, 그 뒤는 시드 난수(rng.js)로 고른다.
// 모든 판은 다 쌓을 수 있다(어느 모습에서든 탑을 깃발 기둥에 모을 수 있다). 그래서 안 되는 판이 없고 "불가능해요"도 없다.
// 흩어진 탑은 풀이 프로그램(src/core/tower.js)이 따진 가장 적은 횟수가 단계의 범위 안인 판만 낸다.
import { checkBoard, copyBoard, fewestFrom, isTower, sameBoard, solve, standardBoard } from './tower.js';
import { createRng, randInt, seedFrom } from './rng.js';

/**
 * 사다리.
 *   tag   'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode  'move'(탑 옮겨 보기) | 'fewest'(가장 적게 옮기기) | 'table'(표 만들기) | 'which'(몇 번째에 어느 원판?)
 *         | 'spread'(흩어진 탑) | 'make'(직접 만든다)
 */
export const LADDER = [
  { level: 1, tag: 'basic', mode: 'move' },
  { level: 2, tag: 'basic', mode: 'fewest' },
  { level: 3, tag: 'applied', mode: 'table' },
  { level: 4, tag: 'applied', mode: 'which' },
  { level: 5, tag: 'challenge', mode: 'spread' },
  { level: 6, tag: 'challenge', mode: 'make' },
];

/** 판을 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;

/** 가장 적게 옮기는 판인가(다 쌓아도 가장 적은 횟수가 아니면 더 적게 해 볼지 묻는다). 직접 만든 판도 그렇다 */
export const recordMode = (mode) => mode === 'fewest' || mode === 'spread' || mode === 'made';

/** 표 만들기에서 해 보는 원판 수(1개부터 board.n개까지)와 짐작하는 원판 수(board.n + 1, board.n + 2) */
export const tableSizes = (board) => Array.from({ length: board.n }, (_, index) => index + 1);
export const guessSizes = (board) => [board.n + 1, board.n + 2];

/** 정해 둔 판 */
const FIRST = {
  1: [standardBoard(1, 2), standardBoard(2, 2), standardBoard(3, 2)],
  2: [standardBoard(3, 2), standardBoard(3, 1), standardBoard(4, 2)],
  3: [standardBoard(4, 2)],
  4: [{ ...standardBoard(5, 2), ask: 16 }, { ...standardBoard(5, 2), ask: 12 }, { ...standardBoard(6, 2), ask: 40 }],
  // 가장 큰 원판이 이미 깃발 기둥에 있는 판(원판 4개인데 15번보다 훨씬 적다), 가장 큰 원판이 다른 기둥에 있는 판
  5: [
    { n: 4, start: [0, 1, 0, 2], target: 2 },
    { n: 4, start: [2, 2, 1, 0], target: 2 },
  ],
};

/** 1단계에서 "작은 판부터"일 때의 판(수준 맞추기에서 쓴다): 원판 2개 */
const SMALL_BOARD = standardBoard(2, 2);

/** 흩어진 탑의 잣대: 원판 수, 가장 적은 횟수의 범위 */
const SPREAD = { sizes: [4, 4, 5], least: 5, most: { 4: 14, 5: 26 } };

/** 판 하나를 만들려고 다시 고르는 횟수의 위 끝. 실제로는 넘지 않는다(테스트로 확인한다) */
const MAX_TRIES = 2000;

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

/** 흩어진 탑이 잣대에 맞는가: 한 기둥에 다 모여 있지 않고, 가장 적은 횟수가 범위 안이다 */
export function goodSpread(board) {
  if (board.start.every((peg) => peg === board.start[0])) return false;
  const fewest = fewestFrom(board.start, board.target);
  return fewest >= SPREAD.least && fewest <= (SPREAD.most[board.n] ?? 2 ** board.n - 2);
}

/** 그 단계의 판 번호로 만드는 판 */
function boardAt(rung, seed) {
  const fixed = FIRST[rung.level];
  if (fixed && seed <= fixed.length) return copyBoard(fixed[seed - 1]);
  const rng = createRng(seedFrom('tower', rung.level, seed));
  const pick = (list) => list[randInt(rng, 0, list.length - 1)];
  const target = pick([1, 2]);
  if (rung.mode === 'move') return standardBoard(pick([2, 3, 3]), target);
  if (rung.mode === 'fewest') return standardBoard(pick([3, 4]), target);
  if (rung.mode === 'table') return standardBoard(4, target);
  if (rung.mode === 'which') {
    // 열에 여덟은 짝수 번째(원판 1이 아닌 원판이 움직이는 차례)를 묻는다
    const n = pick([5, 6]);
    const even = rng() < 0.8;
    const asks = [];
    for (let k = 8; k <= 2 ** n - 2; k++) if ((k % 2 === 0) === even) asks.push(k);
    return { ...standardBoard(n, 2), ask: pick(asks) };
  }
  // 흩어진 탑: 원판마다 기둥을 아무렇게나 고르고, 잣대에 맞을 때까지 다시 고른다
  const n = pick(SPREAD.sizes);
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const board = { n, start: Array.from({ length: n }, () => randInt(rng, 0, 2)), target };
    if (goodSpread(board)) return board;
  }
  throw new Error(`판을 만들지 못했어요: ${rung.level}단계 ${seed}번`);
}

/**
 * 판 하나를 낸다.
 * @param {number} level 1~5
 * @param {number} seed 판 번호(1부터)
 * @param {{small?: boolean}} options small: 맨 아래 단계에서 작은 판(원판 2개)을 낸다(수준 맞추기에서 쓴다)
 * @returns {{level: number, seed: number, small: boolean, board: object, solution: object}}
 */
export function generateBoard(level, seed, { small = false } = {}) {
  const rung = rungOf(level);
  if (rung.mode === 'make') throw new Error('직접 만들기 단계는 판을 내지 않아요');
  if (!Number.isInteger(seed) || seed < 1) throw new Error(`판 번호는 1부터예요: ${seed}`);
  const shrink = small && level === LADDER[0].level;
  const board = shrink ? copyBoard(SMALL_BOARD) : boardAt(rung, seed);
  const { fewest } = solve(board);
  return { level, seed, small: shrink, board, solution: { possible: true, fewest } };
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

/**
 * 더 작은 판들: 원래 판과 같은 종류로 원판이 하나 적은 판.
 *   탑(가장 적게 옮기기, 탑 옮겨 보기, 직접 만든 탑)  원판이 하나 적은 같은 탑. 원판 2개 탑보다 작게는 만들지 않는다(한 번에 끝난다)
 *   표 만들기  원판 3개까지 해 보고 4개와 5개를 짐작하는 표. 그보다 작게는 만들지 않는다
 *   몇 번째에 어느 원판?  원판이 하나 적은 탑에서 묻는 차례를 그 탑 안으로 옮긴다(가운데 차례보다 뒤면 가운데 차례만큼 앞으로).
 *     원판 3개 탑보다 작게는 만들지 않는다
 *   흩어진 탑(직접 만든 흩어진 판도)  가장 큰 원판을 뺀 판, 가장 작은 원판을 뺀 판. 가장 적은 횟수가 2번 이상인 판만 낸다
 * 같은 판에는 늘 같은 판들이 나온다.
 * @param {object} origin { mode, board }
 * @returns {object[]}
 */
export function smallBoards(origin) {
  const { mode, board } = origin;
  if (!board || checkBoard(board) !== null) return [];
  const { n } = board;
  if (mode === 'table') return n - 1 >= 3 ? [standardBoard(n - 1, board.target)] : [];
  if (mode === 'which') {
    if (n - 1 < 3 || board.ask === undefined) return [];
    const half = 2 ** (n - 1);
    const ask = board.ask < half ? board.ask : board.ask === half ? half / 2 : board.ask - half;
    return [{ n: n - 1, start: board.start.slice(0, n - 1), target: board.target, ask }];
  }
  if (isTower(board)) return n - 1 >= 2 ? [{ n: n - 1, start: board.start.slice(0, n - 1), target: board.target }] : [];
  if (n - 1 < 2) return [];
  const list = [];
  for (const start of [board.start.slice(0, n - 1), board.start.slice(1)]) {
    const small = { n: n - 1, start, target: board.target };
    if (fewestFrom(small.start, small.target) < 2) continue;
    if (list.some((item) => sameBoard(item, small))) continue;
    list.push(small);
  }
  return list;
}
