// 성냥개비의 사다리(단계)와 판 내기. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 처음 모습(칸 몇 개의 테두리를 합친 성냥)과 빼거나 옮길 수 k를 시드 난수(rng.js)로 고르고,
// 풀이 프로그램이 모든 방법을 해 보아 끝난 모습의 정사각형 수마다 방법의 수를 센 뒤, 답의 수가 알맞은 n을 고른다.
// 그래서 사다리와 작은 판에는 안 되는 판이 없다(안 되는 판은 직접 만들기에서만 나온다. 선생님은 모든 방법을 해 보고 말한다).
//
// 고르는 잣대
//   - 답(할 일에 맞는 방법)의 수가 1 이상 most 이하
//   - 답의 몫(답의 수 ÷ 해 보는 방법의 수)이 share 이하: 아무렇게나 해도 맞는 판을 뺀다
//   - n이 1 이상이다. 빼기 판은 n이 지금 정사각형의 수와 다르다(칸들의 테두리로 만든 처음 모습에서 성냥을 빼면 정사각형이 늘 줄어든다).
//     옮기기 판은 같은 수도 묻는다(딱 k개를 옮겨야 하니 손대지 않은 모습은 답이 아니다. "옮겨도 그대로 3개" 같은 판이 된다)
import { boardKey, countSquares, cropEdges, fullGrid, looseMatches, outlineOf, sameBoard, squaresOf, tally } from './matches.js';
import { createRng, randInt, seedFrom } from './rng.js';

/**
 * 사다리.
 *   tag   'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode  'little'(작은 판에서 빼기) | 'grid'(3×3 판에서 빼기) | 'shift'(옮겨서 맞추기) | 'tidy'(모두 변이 되게 빼기)
 *         | 'move'(모두 변이 되게 옮기기) | 'make'(직접 만든다)
 *   spec  sizes(모눈의 크기 [w, h] 목록), cells(처음 모습의 칸 수 범위), kind, ks(k의 후보), tidy, most, share
 *   first 1번 판에만 쓰는 판(실패할 수 없는 판)
 */
export const LADDER = [
  {
    level: 1,
    tag: 'basic',
    mode: 'little',
    spec: { sizes: [[2, 2], [3, 2]], cells: [3, 6], kind: 'remove', ks: [1, 2], tidy: false, most: 12, share: 0.4 },
    first: { w: 2, h: 2, matches: fullGrid(2, 2), kind: 'remove', k: 1, n: 3, tidy: false },
  },
  { level: 2, tag: 'basic', mode: 'grid', spec: { sizes: [[3, 3]], cells: [6, 9], kind: 'remove', ks: [2, 3, 4], tidy: false, most: 12, share: 0.08 } },
  { level: 3, tag: 'applied', mode: 'shift', spec: { sizes: [[3, 2], [3, 3]], cells: [2, 6], kind: 'move', ks: [1, 2], tidy: false, most: 12, share: 0.1 } },
  { level: 4, tag: 'applied', mode: 'tidy', spec: { sizes: [[3, 3]], cells: [7, 9], kind: 'remove', ks: [3, 4], tidy: true, most: 12, share: 0.02 } },
  { level: 5, tag: 'challenge', mode: 'move', spec: { sizes: [[3, 3]], cells: [4, 8], kind: 'move', ks: [2, 3], tidy: true, most: 12, share: 0.005 } },
  { level: 6, tag: 'challenge', mode: 'make' },
];

/** 판을 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;

/** 판 하나를 만들려고 다시 골라 보는 횟수의 위 끝. 실제로는 넘지 않는다(테스트로 확인한다) */
const MAX_TRIES = 3000;

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

// ---- 처음 모습 만들기: 이어진 칸 몇 개의 테두리를 합친다 ----

/** 칸 번호(위에서부터 줄마다 왼쪽부터) 몇 개를 이어지게 고른다 */
function connectedCells(rng, w, h, size) {
  const total = w * h;
  const chosen = new Set([randInt(rng, 0, total - 1)]);
  while (chosen.size < size) {
    const edge = [];
    for (const cell of chosen) {
      const r = Math.floor(cell / w);
      const c = cell % w;
      for (const [dr, dc] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= h || nc < 0 || nc >= w) continue;
        const next = nr * w + nc;
        if (!chosen.has(next) && !edge.includes(next)) edge.push(next);
      }
    }
    chosen.add(edge[randInt(rng, 0, edge.length - 1)]);
  }
  return [...chosen].sort((a, b) => a - b);
}

/** 칸들의 테두리를 합친 성냥 */
export function figureOf(w, h, cells) {
  const units = squaresOf(w, h).filter((square) => square.size === 1);
  return outlineOf(
    w,
    h,
    cells.map((cell) => units.find((square) => square.r === Math.floor(cell / w) && square.c === cell % w)),
  );
}

// ---- 판 고르기 ----

/** 처음 모습과 k에 대해, 잣대에 맞는 n들(작은 것부터) */
export function goodTargets(spec, w, h, matches, k) {
  const counted = tally(w, h, matches, spec.kind, k);
  const answers = spec.tidy ? counted.tidy : counted.all;
  const now = countSquares(w, h, matches);
  return [...answers]
    .filter(([n, count]) => n >= 1 && (spec.kind === 'move' || n !== now) && count >= 1 && count <= spec.most && count / counted.ways <= spec.share)
    .map(([n]) => n)
    .sort((a, b) => a - b);
}

/** 판이 그 잣대에 맞는가(테스트가 쓴다) */
export function goodBoard(spec, board) {
  if (board.kind !== spec.kind || board.tidy !== spec.tidy || !spec.ks.includes(board.k)) return false;
  // 빼기 판은 성냥을 둘러싼 모눈으로 줄여 두었으니 그 단계의 모눈 안에 들면 된다
  const fits = ([w, h]) => (board.kind === 'remove' ? board.w <= w && board.h <= h : board.w === w && board.h === h);
  if (!spec.sizes.some(fits)) return false;
  if (spec.tidy && looseMatches(board.w, board.h, board.matches).length > 0) return false;
  return goodTargets(spec, board.w, board.h, board.matches, board.k).includes(board.n);
}

/** 잣대에 맞는 판 하나를 시드 난수로 고른다. 없으면 null */
function pick(rng, spec) {
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const [across, down] = spec.sizes[randInt(rng, 0, spec.sizes.length - 1)];
    const most = Math.min(spec.cells[1], across * down);
    const size = randInt(rng, Math.min(spec.cells[0], most), most);
    const figure = figureOf(across, down, connectedCells(rng, across, down, size));
    // 빼기 판은 빈 변을 쓰지 않으니 성냥을 둘러싼 모눈으로 줄인다. 옮기기 판은 빈 자리가 있는 모눈 그대로 둔다
    const { w, h, matches } = spec.kind === 'remove' ? cropEdges(across, down, figure) : { w: across, h: down, matches: figure };
    const k = spec.ks[randInt(rng, 0, spec.ks.length - 1)];
    if (k > matches.length) continue;
    const targets = goodTargets(spec, w, h, matches, k);
    if (targets.length === 0) continue;
    const n = targets[randInt(rng, 0, targets.length - 1)];
    return { w, h, matches, kind: spec.kind, k, n, tidy: spec.tidy };
  }
  return null;
}

/** 그 단계의 판 번호로 만드는 판 */
function boardAt(rung, seed) {
  if (seed === 1 && rung.first) return { ...rung.first, matches: rung.first.matches.slice() };
  const board = pick(createRng(seedFrom('matches', rung.level, seed)), rung.spec);
  if (!board) throw new Error(`판을 만들지 못했어요: ${rung.level}단계 ${seed}번`);
  return board;
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

/** 작은 판의 모눈: 칸 수가 원래 판보다 적은 것 가운데 3×2, 2×2 */
const SMALL_SIZES = [
  [3, 2],
  [2, 2],
];

/**
 * 더 작은 판들: 같은 할 일(빼기 또는 옮기기, 약속)의 더 작은 모눈의 판. 둘까지 만든다. 같은 판에는 늘 같은 판들이 나온다.
 * 2×2 판(칸이 넷 이하인 판)에는 더 작은 판이 없다.
 * @param {object} origin { mode, board }
 * @returns {{yes: object[], no: object[]}}
 */
export function smallBoards(origin) {
  const { board } = origin;
  const sizes = SMALL_SIZES.filter(([w, h]) => w * h < board.w * board.h);
  if (sizes.length === 0) return { yes: [], no: [] };
  // 작은 판은 쉬워야 한다: 빼거나 옮길 수는 원래 판보다 많지 않게(둘까지), 답의 몫은 넉넉하게 둔다
  const ks = board.k >= 2 ? [1, 2] : [1];
  const spec = { sizes, cells: [2, 6], kind: board.kind, ks, tidy: board.tidy, most: 12, share: 0.4 };
  const rng = createRng(seedFrom('matches-small', boardKey(board), origin.mode));
  const yes = [];
  for (let attempt = 0; attempt < 40 && yes.length < 2; attempt++) {
    const small = pick(rng, spec);
    if (!small) break;
    if (spec.tidy && looseMatches(small.w, small.h, small.matches).length > 0) continue;
    if (yes.some((item) => sameBoard(item, small))) continue;
    yes.push(small);
  }
  return { yes, no: [] };
}
