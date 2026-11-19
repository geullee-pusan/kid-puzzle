// 조각 덮기의 사다리(단계)와 판 만들어 내기. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 풀이 프로그램으로 확인한 판만 내보낸다:
// 되는 판에는 덮는 방법이 실제로 붙어 있고, 안 되는 판은 풀이 프로그램이 안 된다고 가린 판이다.
import { createRng, randInt, seedFrom } from './rng.js';
import { FOUR_PIECES, cellOf, colorOf, deadCells, randomFillRate, solve, solveWall, xyOf } from './tile.js';

/**
 * 안 되는 판이 섞이는 단계(2·3단계)에서 안 되는 판의 비율. 임시값이다(셋에 하나쯤).
 * 늘 되거나 늘 안 되면 해 보지 않고 찍게 된다.
 */
export const IMPOSSIBLE_RATE = 1 / 3;

/**
 * 4단계(일자 세 칸)에서 되는 판의 비율. 임시값이다(셋에 하나쯤).
 * 한 칸을 뺀 정사각형 판은 되는 자리가 몇 군데뿐이라서, 자리를 고르게 뽑으면 거의 다 안 되는 판이 된다. 그래서 일부러 맞춘다.
 */
export const BAR_POSSIBLE_RATE = 1 / 3;

/**
 * 사다리.
 *   tag    'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode   'cover'(늘 되는 판. 덮기만 하면 된다) | 'either'(되는 판은 다 덮고, 안 되는 판은 "불가능해요"로 답한다)
 *          | 'pick'(되는 자리 고르기. 빠진 칸이 없는 판에서 뺄 칸 하나를 골라 누르고, 남은 칸을 다 덮는다)
 *          | 'wall'(금 없는 벽 쌓기. 도미노로 다 덮되 판의 끝에서 끝까지 곧게 가는 금이 없어야 끝난다. 안 되는 판은 "불가능해요")
 *          | 'make'(아이가 직접 만든다)
 *   piece  덮는 조각(6단계는 pieces: 판마다 네 칸 조각 가운데 하나)
 *   holes  빼는 칸의 수
 *   sizes  판의 [가로, 세로]의 후보(6·7단계는 되는 판과 안 되는 판의 후보를 따로 둔다)
 *
 * 1단계는 색이 다른 두 칸을 뺀 작은 판이다. 늘 된다(4×4부터 6×6까지의 모든 판에서 풀이 프로그램으로 확인했다).
 * 2단계의 크기에 5×5는 없다. 칸이 홀수 개라서 두 칸을 빼면 어떻게 빼도 안 되는 판이 된다.
 * 3·4·5단계의 정사각형 크기(4, 5, 7, 8)에는 6이 없다. 6×6에서 한 칸을 빼면 35칸이라 세 칸 조각으로는 어떻게 해도 안 된다.
 * 5~7단계는 2026-11-20에 직접 만들기 앞에 더했다. 직접 만들기는 5단계에서 8단계로 옮겼다(예전 번호는 OLD_MAKE_LEVEL).
 * 5단계(되는 자리 고르기): 일자 세 칸. 되는 자리는 4×4 네 구석, 5×5 한가운데, 7×7 아홉 곳, 8×8 네 곳이다(풀이 프로그램이 모든 자리를 따져 구한다).
 * 6단계(네 칸 조각 한 가지로 덮기): 빠진 칸이 없는 네모 판(가로, 세로 4~8칸에서 칸이 4의 배수인 판. 칸 수만으로 갈리는 판은 내지 않는다).
 *   풀이 프로그램이 따진 것: 네모는 두 변이 모두 짝수일 때, 일자는 한 변이 4의 배수일 때, ㅗ자는 두 변이 모두 4의 배수일 때만 된다.
 *   ㄱ자는 칸이 8의 배수일 때 되고(4×5, 6×6은 안 된다), 번개는 어느 판도 안 된다. ㅗ자는 조각 수가 4의 배수인 6×8(12개)도 안 된다.
 * 7단계(금 없는 벽 쌓기): 5×6, 6×5, 5×8, 8×5, 6×7, 7×6, 6×8, 8×6은 되고, 한 변이 4칸 이하인 판과 6×6은 안 된다.
 */
const SQUARES = [[4, 4], [5, 5], [7, 7], [8, 8]];
/** 6단계: 되는 판을 낼 조각들(번개는 되는 판이 없다)과 판의 후보. 되는지는 풀이 프로그램이 그때그때 가린다 */
export const FOUR_FITTING = ['square', 'long', 'tee', 'bend'];
const FOUR_SIZES = [[4, 4], [4, 5], [5, 4], [4, 6], [6, 4], [6, 6], [4, 8], [8, 4], [5, 8], [8, 5], [6, 8], [8, 6]];
/** 7단계: 되는 판과 안 되는 판의 크기(되는지는 풀이 프로그램이 다시 가리고 테스트가 확인한다) */
export const WALL_YES = [[5, 6], [6, 5], [5, 8], [8, 5], [6, 7], [7, 6], [6, 8], [8, 6]];
export const WALL_NO = [[4, 4], [4, 5], [5, 4], [4, 6], [6, 4], [6, 6], [4, 8], [8, 4]];
export const LADDER = [
  { level: 1, tag: 'basic', mode: 'cover', piece: 'domino', holes: 2, sizes: [[4, 4], [5, 4], [4, 5]] },
  { level: 2, tag: 'applied', mode: 'either', piece: 'domino', holes: 2, sizes: [[4, 4], [5, 4], [4, 5], [6, 4], [4, 6], [6, 5], [5, 6], [6, 6]] },
  { level: 3, tag: 'applied', mode: 'either', piece: 'ell', holes: 1, sizes: SQUARES },
  { level: 4, tag: 'challenge', mode: 'either', piece: 'bar', holes: 1, sizes: SQUARES },
  { level: 5, tag: 'applied', mode: 'pick', piece: 'bar', holes: 0, sizes: SQUARES },
  { level: 6, tag: 'applied', mode: 'either', pieces: FOUR_PIECES, holes: 0, sizes: FOUR_SIZES },
  { level: 7, tag: 'challenge', mode: 'wall', piece: 'domino', holes: 0, sizes: [...WALL_YES, ...WALL_NO] },
  { level: 8, tag: 'challenge', mode: 'make' },
];

/** 판을 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 7;
export const MAKE_LEVEL = 8;
/** 예전(2026-11-20 전)의 직접 만들기 단계. 기기에 적어 둔 하던 판과 공책의 직접 만든 판은 이 번호를 가질 수 있다 */
export const OLD_MAKE_LEVEL = 5;

/** 1단계에서 "작은 판부터"일 때 쓰는 크기(수준 맞추기에서 쓴다) */
export const SMALL_SIZES = [[4, 3], [3, 4]];

/**
 * 좋은 판 가리기(모두 임시값). 되는 도미노 판은 후보를 몇 개 뽑아 "아무렇게나 놓았을 때 끝까지 덮이는 비율"을 재고 고른다.
 *   1단계: 후보 가운데 그 비율이 가장 높은 판(실패하기 어려운 판)
 *   2단계: 후보 가운데 그 비율이 가운데인 판(너무 뻔하지도, 찍어서는 거의 안 되지도 않는 판)
 * 세 칸 조각의 판(3·4단계)은 크기와 빼는 자리 하나로 정해져서 고를 것이 없다.
 */
export const CANDIDATES = { 1: 6, 2: 5 };
const RATE_TRIALS = 120;
/** 한 판을 고르려고 다시 뽑아 보는 횟수의 위 끝. 실제로는 넘지 않는다(테스트로 확인한다). */
const MAX_TRIES = 200;

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

const rngOf = (level, seed, small) => createRng(seedFrom('tile', level, seed, small ? 'small' : 'any'));

/** 되는 판과 안 되는 판이 섞이는 판의 종류 */
const MIXED = ['either', 'wall'];

/** 이 번호의 판을 안 되는 판으로 낼 것인가. 맨 처음 판(1번)은 늘 되는 판이다(될 것 같은 일을 먼저 해 본다). */
function wantsImpossible(level, seed) {
  const rung = rungOf(level);
  if (!MIXED.includes(rung.mode) || seed === 1) return false;
  const draw = rngOf(level, seed, false)();
  return rung.piece === 'bar' ? draw >= BAR_POSSIBLE_RATE : draw < IMPOSSIBLE_RATE;
}

/** 그 단계에서 맨 처음 만나는 안 되는 판의 번호. 그 판은 가장 작은 판으로 낸다. */
export function firstImpossibleSeed(level) {
  if (!MIXED.includes(rungOf(level).mode)) return null;
  for (let seed = 2; seed < 2000; seed++) if (wantsImpossible(level, seed)) return seed;
  return null;
}

/** 정사각형 판에서 한 칸을 뺐을 때 되는 자리들. 풀이 프로그램으로 그때그때 구하고, 한 번 구한 것은 적어 둔다. */
const goodHoles = new Map();
export function possibleHoles(piece, w, h) {
  const key = `${piece}-${w}-${h}`;
  if (!goodHoles.has(key)) {
    const good = [];
    for (let hole = 0; hole < w * h; hole++) if (solve({ w, h, piece, holes: [hole] }).possible === true) good.push(hole);
    goodHoles.set(key, good);
  }
  return goodHoles.get(key).slice();
}

const pick = (rng, list) => list[randInt(rng, 0, list.length - 1)];
const checker = (board, cell) => colorOf('checker', ...xyOf(board, cell));

/** 두 칸을 고른다. same이 true면 바둑판 무늬에서 색이 같은 두 칸, 아니면 색이 다른 두 칸 */
function twoHoles(rng, w, h, same) {
  const shell = { w, h };
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const a = randInt(rng, 0, w * h - 1);
    const b = randInt(rng, 0, w * h - 1);
    if (a === b || (checker(shell, a) === checker(shell, b)) !== same) continue;
    return [Math.min(a, b), Math.max(a, b)];
  }
  throw new Error('뺄 칸을 고르지 못했어요');
}

/** 되는 도미노 판: 후보를 뽑아 아무렇게나 놓았을 때 덮이는 비율로 고른다 */
function possibleDomino(rng, level, w, h) {
  const found = [];
  for (let attempt = 0; attempt < MAX_TRIES && found.length < CANDIDATES[level]; attempt++) {
    const board = { w, h, piece: 'domino', holes: twoHoles(rng, w, h, false) };
    if (found.some((item) => item.board.holes.join() === board.holes.join())) continue;
    const solution = solve(board);
    if (solution.possible !== true) continue;
    found.push({ board, solution, rate: randomFillRate(board, { trials: RATE_TRIALS, seed: seedFrom('tile-rate', w, h, board.holes.join('-')) }) });
  }
  if (found.length === 0) throw new Error('되는 판을 만들지 못했어요');
  // 비율이 높은 것부터 줄 세운다. 같으면 뽑힌 차례대로 둔다.
  const ranked = found.map((item, index) => ({ ...item, index })).sort((a, b) => b.rate - a.rate || a.index - b.index);
  const chosen = level === 1 ? ranked[0] : ranked[Math.floor(ranked.length / 2)];
  return { board: chosen.board, solution: chosen.solution, rate: chosen.rate };
}

/** 안 되는 도미노 판: 색이 같은 두 칸을 뺀다. 처음부터 조각이 들어갈 수 없는 빈칸이 보이는 판은 내지 않는다(해 보지 않아도 알 수 있어서) */
function impossibleDomino(rng, w, h) {
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const board = { w, h, piece: 'domino', holes: twoHoles(rng, w, h, true) };
    if (deadCells(board).length > 0) continue;
    const solution = solve(board);
    if (solution.possible === false) return { board, solution, rate: null };
  }
  throw new Error('안 되는 판을 만들지 못했어요');
}

/** 한 칸을 뺀 정사각형 판(세 칸 조각) */
function oneHole(rng, piece, sizes, wantImpossible) {
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const [w, h] = pick(rng, sizes);
    const good = possibleHoles(piece, w, h);
    const all = Array.from({ length: w * h }, (_, cell) => cell);
    const pool = wantImpossible ? all.filter((cell) => !good.includes(cell)) : good;
    if (pool.length === 0) continue;
    const board = { w, h, piece, holes: [pick(rng, pool)] };
    const solution = solve(board);
    if (solution.possible === !wantImpossible) return { board, solution, rate: null };
  }
  throw new Error('판을 만들지 못했어요');
}

const area = ([w, h]) => w * h;
/** 크기들을 작은 판부터 줄 세운다(칸 수가 같으면 가로가 좁은 판부터) */
const bySize = (list) => list.slice().sort((a, b) => area(a) - area(b) || a[0] - b[0]);

/**
 * 네 칸 조각 한 가지로 덮는 판(6단계). 빠진 칸이 없는 네모 판이다.
 * 되는 판은 번개를 뺀 네 조각 가운데 하나로, 안 되는 판은 다섯 조각 가운데 하나로 고르고, 그 조각으로 되는(안 되는) 크기에서 고른다.
 * 맨 처음 판은 그 조각의 가장 작은 되는 판이고, 맨 처음 만나는 안 되는 판은 번개 4×4다(어느 네모 판도 덮지 못하는 조각).
 */
export function fourSizes(piece, possible) {
  return bySize(FOUR_SIZES.filter(([w, h]) => solve({ w, h, piece, holes: [] }).possible === possible));
}
function fourBoard(rng, wantImpossible, smallest) {
  const piece = smallest && wantImpossible ? 'zig' : pick(rng, wantImpossible ? FOUR_PIECES : FOUR_FITTING);
  const sizes = fourSizes(piece, !wantImpossible);
  const [w, h] = smallest ? sizes[0] : pick(rng, sizes);
  const board = { w, h, piece, holes: [] };
  return { board, solution: solve(board), rate: null };
}

/** 금 없는 벽의 판(7단계). 맨 처음 판은 5×6, 맨 처음 만나는 안 되는 판은 4×4다 */
function wallBoard(rng, wantImpossible, smallest) {
  const sizes = bySize(wantImpossible ? WALL_NO : WALL_YES);
  const [w, h] = smallest ? sizes[0] : pick(rng, sizes);
  const board = { w, h, piece: 'domino', holes: [] };
  return { board, solution: solveWall(board), rate: null };
}

/**
 * 되는 자리 고르기의 판(5단계): 빠진 칸이 없는 정사각형 판. 풀이는 되는 자리들과, 그 가운데 맨 앞 자리를 뺐을 때 덮는 방법이다.
 * 맨 처음 판은 4×4다.
 */
function pickBoard(rng, sizes) {
  const [w, h] = pick(rng, sizes);
  const board = { w, h, piece: 'bar', holes: [] };
  const good = possibleHoles('bar', w, h);
  const { tiling } = solve({ ...board, holes: [good[0]] });
  return { board, solution: { possible: true, tiling, reason: 'tiled', good }, rate: null };
}

/**
 * 판 하나를 만든다.
 * @param {number} level 1~7
 * @param {number} seed 판 번호(1부터)
 * @param {{small?: boolean}} options small: 맨 아래 단계에서 더 작은 판을 낸다(수준 맞추기에서 쓴다)
 * @returns {{level: number, seed: number, small: boolean, board: object, solution: {possible: boolean, tiling: number[][]|null, reason: string, good?: number[]}, rate: number|null}}
 *   solution  풀이 프로그램의 결과. 되는 판이면 덮는 방법이 들어 있다(금 없는 벽은 금이 없는 방법).
 *             되는 자리 고르기(5단계)는 늘 된다. good에 되는 자리들이 있고, 덮는 방법은 good[0]을 뺐을 때의 것이다
 *   rate      아무렇게나 놓았을 때 끝까지 덮이는 비율(되는 도미노 판에서 판을 고를 때 잰 값. 그 밖에는 null)
 */
export function generateBoard(level, seed, { small = false } = {}) {
  const rung = rungOf(level);
  if (rung.mode === 'make') throw new Error('직접 만들기 단계는 판을 만들어 내지 않아요');
  const shrink = small && level === LADDER[0].level;
  const rng = rngOf(level, seed, shrink);
  rng(); // 첫 수는 되는 판을 낼지 안 되는 판을 낼지 정하는 데 쓴다(wantsImpossible).
  const wantImpossible = wantsImpossible(level, seed);
  // 맨 처음 판과 맨 처음 만나는 안 되는 판은 가장 작은 판으로 낸다.
  const smallest = seed === 1 || (wantImpossible && seed === firstImpossibleSeed(level));
  const sizes = shrink ? SMALL_SIZES : smallest ? rung.sizes.slice(0, 1) : rung.sizes;

  let made;
  if (rung.mode === 'pick') made = pickBoard(rng, sizes);
  else if (rung.pieces) made = fourBoard(rng, wantImpossible, smallest);
  else if (rung.mode === 'wall') made = wallBoard(rng, wantImpossible, smallest);
  else if (rung.piece !== 'domino') made = oneHole(rng, rung.piece, wantImpossible && rung.piece === 'ell' && smallest ? rung.sizes : sizes, wantImpossible);
  else if (!wantImpossible) made = possibleDomino(rng, level, ...pick(rng, sizes));
  else if (smallest) {
    // 맨 처음 만나는 안 되는 도미노 판: 마주 보는 두 구석을 뺀 가장 작은 판
    const [w, h] = sizes[0];
    const board = { w, h, piece: 'domino', holes: [0, cellOf({ w, h }, w - 1, h - 1)] };
    made = { board, solution: solve(board), rate: null };
  } else made = impossibleDomino(rng, ...pick(rng, sizes));

  const { possible, tiling, reason, good } = made.solution;
  const solution = good ? { possible, tiling, reason, good } : { possible, tiling, reason };
  return { level, seed, small, board: made.board, solution, rate: made.rate };
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
