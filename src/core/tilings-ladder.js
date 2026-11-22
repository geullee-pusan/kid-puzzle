// 도미노 깔기 모두 찾기의 사다리(단계)와 판 내기, 더 작은 판. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 단계마다 판이 몇 가지뿐이라 정해 둔 차례대로 돌아가며 낸다(난수를 쓰지 않는다).
//
// 1단계 모두 세어 보기: 2×2, 2×3 띠. 2단계 짐작하고 세기: 2×4, 2×5 띠(먼저 짐작을 적는다).
// 3단계 표 만들기: 2×1부터 2×6까지 세어 표를 채우고 2×7, 2×8을 짐작한다. 4단계 계단 오르기: 계단 4, 5, 3, 6칸.
// 5단계 세 줄 판: 3×2, 3×1, 3×4, 3×6, 3×3(또는 3×5), 3×4. 여섯 판에 둘(판 번호를 6으로 나눈 나머지가 2와 5)은 칸이 홀수 개라
//   덮을 수 없는 판이다(0가지). 칸 수는 판 아래에 늘 적혀 있다. 처음 만나는 덮을 수 없는 판은 칸이 3개뿐인 3×1이다.
// 안 되는 판(0가지)은 5단계에만 있고 연달아 나오지 않는다.
import { checkBoard, keysOf, openCount, sameBoard, solve, stairs, strip } from './tilings.js';

/**
 * 사다리.
 *   tag   'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode  'count'(모두 세어 보기) | 'guess'(짐작하고 세기) | 'table'(표 만들기) | 'stairs'(계단 오르기) | 'three'(세 줄 판) | 'make'(직접 만든다)
 */
export const LADDER = [
  { level: 1, tag: 'basic', mode: 'count' },
  { level: 2, tag: 'basic', mode: 'guess' },
  { level: 3, tag: 'applied', mode: 'table' },
  { level: 4, tag: 'applied', mode: 'stairs' },
  { level: 5, tag: 'challenge', mode: 'three' },
  { level: 6, tag: 'challenge', mode: 'make' },
];

/** 판을 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

/** 한 번 푼 판은 적어 둔다 */
const solved = new Map();
export function solveOnce(board) {
  const key = JSON.stringify(board);
  if (!solved.has(key)) solved.set(key, solve(board));
  return solved.get(key);
}

/** 그 단계의 판 번호로 만드는 판 */
function boardAt(rung, seed) {
  const at = (seed - 1) % 6;
  const block = Math.floor((seed - 1) / 6);
  switch (rung.mode) {
    case 'count':
      return strip(2, seed % 2 === 1 ? 2 : 3);
    case 'guess':
      return strip(2, seed % 2 === 1 ? 4 : 5, { guess: true });
    case 'table':
      return strip(2, 6, { table: true });
    case 'stairs':
      return stairs([4, 5, 3, 6][(seed - 1) % 4]);
    case 'three':
      return strip(3, [2, 1, 4, 6, block % 2 === 0 ? 3 : 5, 4][at]);
    default:
      throw new Error(`판을 내지 않는 단계예요: ${rung.level}`);
  }
}

/** 그 판 번호가 덮을 수 없는 판의 자리인가(세 줄 판에서 여섯 판에 둘) */
export const impossibleAt = (rung, seed) => rung.mode === 'three' && [1, 4].includes((seed - 1) % 6);

/**
 * 판 하나를 낸다.
 * @param {number} level 1~5
 * @param {number} seed 판 번호(1부터)
 * @param {{small?: boolean}} options small: 맨 아래 단계에서 작은 판(2×2 띠, 1번 판)을 낸다(수준 맞추기에서 쓴다)
 * @returns {{level: number, seed: number, small: boolean, board: object}}
 */
export function generateBoard(level, seed, { small = false } = {}) {
  const rung = rungOf(level);
  if (rung.mode === 'make') throw new Error('직접 만들기 단계는 판을 내지 않아요');
  if (!Number.isInteger(seed) || seed < 1) throw new Error(`판 번호는 1부터예요: ${seed}`);
  const shrink = small && level === LADDER[0].level;
  return { level, seed, small: shrink, board: boardAt(rung, shrink ? 1 : seed) };
}

/** 다음 판 번호. 방금 한 판과 같은 판이 나오는 번호는 건너뛴다(판이 한 가지뿐인 표 만들기는 그냥 다음 번호) */
export function nextSeed(level, seed) {
  const rung = rungOf(level);
  if (rung.mode === 'make' || rung.mode === 'table') return seed + 1;
  const before = boardAt(rung, seed);
  let next = seed + 1;
  while (sameBoard(boardAt(rung, next), before)) next += 1;
  return next;
}

// ---- 더 작은 판 ----

/** 빠진 칸을 그대로 두고 오른쪽 열을 뗀 띠(뗀 열에 있던 빠진 칸은 없어진다) */
function trimmed(board, w) {
  const holes = board.holes.filter((cell) => cell % board.w < w).map((cell) => Math.floor(cell / board.w) * w + (cell % board.w));
  return strip(board.h, w, { holes });
}

/**
 * 더 작은 판들. 같은 판에는 늘 같은 판들이 나온다. 모두 먼저 짐작하지 않는 판이다.
 *   yes: 덮을 수 있는(오를 수 있는) 판. 방법의 수가 원래 판보다 적다
 *   no:  원래 판이 덮을 수 없는 판이면, 덮을 수 없는 더 작은 판
 * 표 만들기 판은 지금 세는 띠(size)보다 짧은 띠다. 계단은 칸이 적은 계단이다. 더 줄일 수 없으면 둘 다 비어 있다.
 * @param {{board: object, size?: number}} origin
 * @returns {{yes: object[], no: object[]}}
 */
export function smallBoards(origin) {
  const { board } = origin;
  if (checkBoard(board) !== null) return { yes: [], no: [] };
  if (board.shape === 'stairs') return { yes: [board.w - 1, board.w - 2].filter((w) => w >= 1).map(stairs), no: [] };
  const base = board.table ? strip(2, origin.size ?? 1) : board;
  const from = keysOf(base).length;
  const yes = [];
  const no = [];
  for (const w of [base.w - 1, base.w - 2]) {
    if (w < 1) continue;
    const small = trimmed(base, w);
    if (checkBoard(small) !== null) continue;
    const count = keysOf(small).length;
    if (count > 0 && (from === 0 || count < from)) yes.push(small);
    else if (count === 0 && from === 0 && openCount(small) < openCount(base)) no.push(small);
  }
  return { yes, no };
}

