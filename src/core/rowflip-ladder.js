// 줄 뒤집기 판의 사다리(단계)와 판 내기. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 칸은 시드 난수(rng.js)로 고른다.
//
// 되는 판은 모두 흰 판에서 가로줄과 세로줄 몇 개를 뒤집어 만든다(그래서 늘 된다). 가장 적은 횟수가 단계의 범위에 드는 판만 낸다.
// 안 되는 판은 되는 판에서 칸 몇 개만 바꿔 만든다. 단계마다 아이가 볼 수 있는 까닭이 정해져 있다.
//   1단계 2×2 판: 검은 칸이 홀수 개(한 줄을 뒤집으면 두 칸이 바뀐다)
//   3, 4단계: 판 전체의 네 모서리에 검은 칸이 홀수 개(모서리 한 칸만 바꾼다)
//   5단계: 판 전체의 네 모서리는 짝수인데 어느 2×2 덩이가 홀수(모서리가 아닌 칸 한두 개만 바꾼다). "네 모서리가 짝수라고 되는 것은 아니다"
// 안 되는 판이 섞이는 단계(1, 3, 4, 5단계)에서는 여섯 판에 둘(판 번호를 6으로 나눈 나머지가 2와 5)이고, 연달아 나오지 않는다.
// 처음 만나는 판은 되는 판이고, 처음 만나는 안 되는 판(1단계 2번)은 가장 쉬운 안 되는 판이다(2×2 판에 검은 칸 하나). 3단계 2번은 3×3 판에 모서리 한 칸만 검은 판이다.
import { boardCorners, boardKey, cellsFrom, cornerBlack, copyBoard, isWhite, oddBlocks, sameBoard, solve } from './rowflip.js';
import { createRng, randInt, seedFrom } from './rng.js';

/**
 * 사다리.
 *   tag    'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode   'small'(작은 판) | 'grid'(3×3 판, 모두 되는 판) | 'corner'(3×3 판, 모서리) | 'corners'(4×4 판, 네 모서리)
 *          | 'block'(큰 판, 2×2 한 덩이) | 'make'(직접 만든다)
 *   sizes  판의 크기 [가로, 세로] 목록
 *   min    되는 판의 가장 적은 횟수 범위
 *   reason 안 되는 판의 까닭: 'count'(2×2 판의 검은 칸 수) | 'corners'(판의 네 모서리) | 'block'(2×2 한 덩이) | null(안 되는 판이 없다)
 */
export const LADDER = [
  { level: 1, tag: 'basic', mode: 'small', sizes: [[2, 2], [3, 2], [2, 3]], min: [1, 2], reason: 'count' },
  { level: 2, tag: 'basic', mode: 'grid', sizes: [[3, 3]], min: [2, 3], reason: null },
  { level: 3, tag: 'applied', mode: 'corner', sizes: [[3, 3]], min: [2, 3], reason: 'corners' },
  { level: 4, tag: 'applied', mode: 'corners', sizes: [[4, 4]], min: [3, 4], reason: 'corners' },
  { level: 5, tag: 'challenge', mode: 'block', sizes: [[5, 4], [4, 5], [5, 5]], min: [3, 5], reason: 'block' },
  { level: 6, tag: 'challenge', mode: 'make' },
];

/** 판을 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;

/** 판 하나를 만들려고 다시 골라 보는 횟수의 위 끝. 실제로는 넘지 않는다(테스트로 확인한다) */
const MAX_TRIES = 500;

/** 1단계의 첫 판(실패할 수 없다. 윗줄 하나를 뒤집으면 끝난다)과 처음 만나는 안 되는 판(검은 칸 하나) */
const FIRST = { w: 2, h: 2, cells: [1, 1, 0, 0] };
const FIRST_NO = { w: 2, h: 2, cells: [1, 0, 0, 0] };

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

/** 그 판 번호가 안 되는 판의 자리인가(안 되는 판이 섞이는 단계에서 여섯 판에 둘) */
export const impossibleAt = (rung, seed) => rung.reason !== null && [1, 4].includes((seed - 1) % 6);

/** 한 번 푼 판은 적어 둔다 */
const solved = new Map();
export function solveOnce(board) {
  const key = boardKey(board);
  if (!solved.has(key)) solved.set(key, solve(board));
  return solved.get(key);
}

// ---- 판 만들기 ----

/** 가장 적은 횟수가 [low, high]인 되는 판 하나 */
export function possibleBoard(rng, w, h, [low, high]) {
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const rows = Array.from({ length: h }, () => randInt(rng, 0, 1));
    const cols = Array.from({ length: w }, () => randInt(rng, 0, 1));
    const board = { w, h, cells: cellsFrom(rows, cols) };
    if (isWhite(board.cells)) continue;
    const { min } = solveOnce(board);
    if (min >= low && min <= high) return board;
  }
  throw new Error(`되는 판을 만들지 못했어요: ${w}×${h}`);
}

const isCorner = (board, cell) => {
  const r = Math.floor(cell / board.w);
  const c = cell % board.w;
  return (r === 0 || r === board.h - 1) && (c === 0 || c === board.w - 1);
};

/** 칸 몇 개를 바꾼 판 */
function toggled(board, cells) {
  const next = copyBoard(board);
  for (const cell of cells) next.cells[cell] = 1 - next.cells[cell];
  return next;
}

/** 안 되는 판이 그 까닭을 아이가 볼 수 있게 지니고 있는가 */
export function reasonFits(board, reason) {
  if (solveOnce(board).possible) return false;
  const corners = cornerBlack(board.w, board.cells, boardCorners(board)) % 2 === 1;
  if (reason === 'count') return board.w === 2 && board.h === 2;
  if (reason === 'corners') return corners;
  if (reason === 'block') return !corners && oddBlocks(board).length > 0;
  return false;
}

/** 단계의 까닭에 맞는 안 되는 판 하나 */
function impossibleBoard(rng, rung, w, h) {
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    if (rung.reason === 'count') {
      // 2×2 판에 검은 칸 하나나 셋
      const black = randInt(rng, 0, 1) === 0 ? 1 : 3;
      const at = randInt(rng, 0, 3);
      const cells = [0, 1, 2, 3].map((cell) => (black === 1 ? Number(cell === at) : Number(cell !== at)));
      return { w: 2, h: 2, cells };
    }
    const base = possibleBoard(rng, w, h, [Math.min(2, rung.min[0]), rung.min[1]]);
    const all = Array.from({ length: w * h }, (_, cell) => cell);
    let board;
    if (rung.reason === 'corners') {
      const corners = all.filter((cell) => isCorner(base, cell));
      board = toggled(base, [corners[randInt(rng, 0, corners.length - 1)]]);
    } else {
      const inner = all.filter((cell) => !isCorner(base, cell));
      const first = inner[randInt(rng, 0, inner.length - 1)];
      const picks = [first];
      if (randInt(rng, 0, 1) === 1) {
        const rest = inner.filter((cell) => cell !== first);
        picks.push(rest[randInt(rng, 0, rest.length - 1)]);
      }
      board = toggled(base, picks);
    }
    if (!isWhite(board.cells) && reasonFits(board, rung.reason)) return board;
  }
  throw new Error(`안 되는 판을 만들지 못했어요: ${rung.level}단계`);
}

/** 그 단계의 판 번호로 만드는 판 */
function boardAt(rung, seed) {
  if (rung.level === 1 && seed === 1) return copyBoard(FIRST);
  if (rung.level === 1 && seed === 2) return copyBoard(FIRST_NO);
  const rng = createRng(seedFrom('rowflip', rung.level, seed));
  const [w, h] = rung.sizes[randInt(rng, 0, rung.sizes.length - 1)];
  if (!impossibleAt(rung, seed)) return possibleBoard(rng, w, h, w * h === 4 ? [1, 2] : [Math.max(2, rung.min[0]), rung.min[1]]);
  // 3단계에서 처음 만나는 안 되는 판: 3×3 판에 모서리 한 칸만 검다
  if (rung.level === 3 && seed === 2) {
    const corner = [0, 2, 6, 8][randInt(rng, 0, 3)];
    return { w: 3, h: 3, cells: Array.from({ length: 9 }, (_, cell) => Number(cell === corner)) };
  }
  return impossibleBoard(rng, rung, w, h);
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

/** 판의 한 구석을 잘라 낸 판(가로 cw칸, 세로 ch칸, 왼쪽 위 칸이 (r0, c0)) */
export function cropOf(board, r0, c0, cw, ch) {
  const cells = [];
  for (let r = r0; r < r0 + ch; r++) for (let c = c0; c < c0 + cw; c++) cells.push(board.cells[r * board.w + c]);
  return { w: cw, h: ch, cells };
}

/** 작은 판의 크기: 가로와 세로를 한 칸씩 줄인다(2칸인 쪽은 그대로 둔다). 2×2 판에는 없다 */
function smallSize(board) {
  if (board.w === 2 && board.h === 2) return null;
  const cw = board.w > 2 ? board.w - 1 : 2;
  const ch = board.h > 2 ? board.h - 1 : 2;
  return [cw, ch];
}

/**
 * 더 작은 판들. 같은 판에는 늘 같은 판들이 나온다.
 *   yes: 원래 판의 네 구석을 잘라 낸 되는 판(모두 흰 판은 빼고, 가장 적은 횟수가 많은 것부터). 없으면 그 크기의 되는 판을 시드 난수로 만든다
 *   no:  원래 판이 안 되는 판이면, 그 판에서 검은 칸이 홀수 개인 2×2 덩이를 잘라 낸 판(2×2 판에 검은 칸이 홀수 개라 아이가 볼 수 있다)
 * 원래 판이 되는 판이면 no는 비어 있다. 큰 판의 한 구석이 작은 판과 같다는 것을 그대로 보여 준다.
 * @param {object} origin { mode, board }
 * @returns {{yes: object[], no: object[]}}
 */
export function smallBoards(origin) {
  const { board } = origin;
  const size = smallSize(board);
  if (!size) return { yes: [], no: [] };
  const [cw, ch] = size;
  const yes = [];
  const seen = new Set();
  const crops = [];
  for (const r0 of [0, board.h - ch]) for (const c0 of [0, board.w - cw]) crops.push(cropOf(board, r0, c0, cw, ch));
  for (const crop of crops) {
    const key = boardKey(crop);
    if (seen.has(key) || isWhite(crop.cells) || !solveOnce(crop).possible) continue;
    seen.add(key);
    yes.push(crop);
  }
  yes.sort((a, b) => solveOnce(b).min - solveOnce(a).min);
  if (yes.length === 0) {
    const rng = createRng(seedFrom('rowflip-small', boardKey(board)));
    yes.push(possibleBoard(rng, cw, ch, cw * ch === 4 ? [1, 2] : [2, Math.floor((cw + ch) / 2)]));
  }
  const no = [];
  if (!solveOnce(board).possible) {
    for (const rect of oddBlocks(board)) {
      const crop = cropOf(board, rect.r1, rect.c1, 2, 2);
      const key = boardKey(crop);
      if (seen.has(key)) continue;
      seen.add(key);
      no.push(crop);
      if (no.length === 2) break;
    }
  }
  return { yes: yes.slice(0, 2), no };
}
