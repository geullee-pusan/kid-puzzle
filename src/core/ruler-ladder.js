// 눈금이 가장 적은 자의 사다리(단계)와 판 내기, 더 작은 판. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 길이와 눈금 수는 시드 난수(rng.js)로 고른다.
//
// 단계마다 판의 종류(mode)가 정해져 있다.
//   first   모든 길이 재기(길이 3~6). 1부터 길이까지 모두 잴 수 있으면 끝난다. 눈금 수는 묻지 않는다(첫 판은 실패할 수 없다)
//   fewest  가장 적은 눈금(길이 6~10). 기록 깨기: 모두 잴 수 있어도 가장 적은 눈금 수가 아니면 "더 적은 눈금으로도 될까요?"
//   long    긴 자(길이 11~17). fewest와 같다
//   chain   이어지는 자(길이 다섯 개가 하나씩 길어진다). 늘 아직 풀지 않은 자 둘이 열려 있고, 하나를 가장 적은 눈금으로 만들면 다음 자가 열린다
//   golomb  같은 길이를 두 번 재지 않는 자(눈금 4~6개). 가장 짧은 자를 찾는다
// 모든 판에 답이 있다. 가장 좋은 기록은 풀이 프로그램이 모든 경우를 따져 안다.
import { MAX_LENGTH, boardKey, copyBoard, sameBoard, shortestGolomb } from './ruler.js';
import { createRng, randInt, seedFrom } from './rng.js';

/**
 * 사다리.
 *   tag     'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode    판의 종류(위의 설명)
 *   lengths 자의 길이 범위(chain은 첫 자의 길이 범위)
 *   counts  같은 길이를 두 번 재지 않는 자의 눈금 수들(판 번호마다 차례로)
 */
export const LADDER = [
  { level: 1, tag: 'basic', mode: 'first', lengths: [3, 6] },
  { level: 2, tag: 'basic', mode: 'fewest', lengths: [6, 10] },
  { level: 3, tag: 'applied', mode: 'long', lengths: [11, 17] },
  { level: 4, tag: 'applied', mode: 'chain', lengths: [5, 9] },
  { level: 5, tag: 'challenge', mode: 'golomb', counts: [4, 5, 6] },
  { level: 6, tag: 'challenge', mode: 'make' },
];

/** 판을 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;

/** 이어지는 자의 수 */
export const CHAIN_SIZE = 5;
/** 같은 길이를 두 번 재지 않는 자: 눈금 수마다 그리는 자의 길이(가장 짧은 자보다 길게. 더 긴 자도 찾아볼 수 있게) */
export const GOLOMB_SPAN = { 3: 5, 4: 8, 5: 14, 6: 20 };
/** 직접 만들기에서 고를 수 있는 길이 */
export const MAKE_MIN = 3;
export const MAKE_MAX = MAX_LENGTH;
/** 직접 만들기의 처음 길이 */
export const FIRST_MAKE = 8;

/** 기록 깨기 판인가(모두 재도 가장 좋은 기록이 아니면 끝나지 않는다). 직접 만든 판도 그렇다 */
export const recordMode = (mode) => mode !== 'first';

/**
 * 정해 둔 판: 1단계 첫 판(길이 4), 2단계 첫 판(길이 6. 눈금 4개로 1부터 6까지 꼭 한 번씩 잰다), 3단계 첫 판(길이 11),
 * 4단계 첫 판(길이 6부터 10까지. 9까지는 눈금 5개면 되는데 10은 6개가 있어야 한다), 5단계 첫 판(눈금 4개)
 */
const FIXED = {
  '1:1': { kind: 'all', lengths: [4] },
  '2:1': { kind: 'all', lengths: [6] },
  '3:1': { kind: 'all', lengths: [11] },
  '4:1': { kind: 'all', lengths: [6, 7, 8, 9, 10] },
};

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

/** 이어지는 자: 길이 start부터 size개 */
export const chainOf = (start, size = CHAIN_SIZE) => ({ kind: 'all', lengths: Array.from({ length: size }, (_, index) => start + index) });
/** 같은 길이를 두 번 재지 않는 자의 판 */
export const golombOf = (count) => ({ kind: 'golomb', count, span: GOLOMB_SPAN[count] });

/** 그 단계의 판 번호로 만드는 판 */
function boardAt(rung, seed) {
  const fixed = FIXED[`${rung.level}:${seed}`];
  if (fixed) return copyBoard(fixed);
  if (rung.mode === 'golomb') return golombOf(rung.counts[(seed - 1) % rung.counts.length]);
  const rng = createRng(seedFrom('ruler', rung.level, seed));
  const [low, high] = rung.lengths;
  if (rung.mode === 'chain') return chainOf(randInt(rng, low, high));
  return { kind: 'all', lengths: [randInt(rng, low, high)] };
}

/**
 * 판 하나를 낸다.
 * @param {number} level 1~5
 * @param {number} seed 판 번호(1부터)
 * @param {{small?: boolean}} options small: 맨 아래 단계에서 작은 판(1번 판)을 낸다(수준 맞추기에서 쓴다)
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

/** 작은 판의 길이 아래 끝(길이 3이면 눈금 하나만 더 찍으면 된다) */
export const SMALL_FLOOR = 3;
/** 긴 자(길이 11 이상)의 작은 판: 길이 9, 8, 7 */
const LONG_SMALL = [9, 8, 7];

/**
 * 더 작은 판들. 같은 판에는 늘 같은 판들이 나온다. 모두 답이 있는 판이라 yes만 있다.
 *   자 하나: 길이가 하나에서 셋 짧은 자(길이 11 이상이면 9, 8, 7)
 *   이어지는 자: 첫 자가 더 짧은 이어지는 자 셋
 *   같은 길이를 두 번 재지 않는 자: 눈금이 하나 적은 자
 * 길이 3인 자, 눈금 3개인 자, 첫 자가 길이 3인 이어지는 자에는 더 작은 판이 없다.
 * @param {object} origin { mode, board }
 * @returns {{yes: object[], no: object[]}}
 */
export function smallBoards(origin) {
  const { board } = origin;
  const yes = [];
  if (board.kind === 'golomb') {
    if (board.count - 1 >= 3) yes.push(golombOf(board.count - 1));
    return { yes, no: [] };
  }
  if (board.lengths.length > 1) {
    const start = board.lengths[0];
    for (let first = Math.max(SMALL_FLOOR, start - 3); first < start; first++) yes.push(chainOf(first, 3));
    return { yes, no: [] };
  }
  const [L] = board.lengths;
  const lengths = L >= 11 ? LONG_SMALL : [L - 1, L - 2, L - 3].filter((value) => value >= SMALL_FLOOR);
  for (const value of lengths) yes.push({ kind: 'all', lengths: [value] });
  return { yes, no: [] };
}

/** 판 고르기와 처음 화면에 그릴 판의 이름(같은 판인지 가릴 때) */
export const keyOf = boardKey;

/** 같은 길이를 두 번 재지 않는 자의 판이 사다리의 잣대에 맞는가(그리는 자가 가장 짧은 자보다 길다) */
export const golombRoomy = (board) => board.span > shortestGolomb(board.count).shortest;
