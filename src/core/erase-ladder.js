// 지우고 쓰기 예언의 사다리(단계)와 판 내기, 더 작은 판. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 수는 시드 난수(rng.js)로 고른다.
//
// 단계마다 판의 종류(mode)가 정해져 있다.
//   same    같으면 0, 다르면 1(0과 1만 있는 판). 선생님이 끝에 남을 수를 쪽지에 미리 적어 둔다. 두 번 지워 본다
//   less    합에서 1 빼기. 선생님도 쪽지에 적고, 아이도 먼저 끝에 남을 수를 적은 뒤에 지운다
//   parity  두 수의 차. 끝에 남는 수가 홀수일지 짝수일지 먼저 고르고 두 번 지워 본다. 남길 수 있는 수가 둘 이상인 판만 낸다
//           (두 번 지우면 다른 수가 남을 수도 있다는 것을 볼 수 있다)
//   zero    두 수의 차. 0을 남기거나 "불가능해요"로 답한다. 안 되는 판은 모두 합이 홀수인 판이다(합 보기로 볼 수 있다).
//           합이 짝수인데 0을 남길 수 없는 판은 내지 않는다(모든 차례를 따져야만 알 수 있다. 직접 만들기에서만 선생님이 말한다).
//           되는 판은 차례에 따라 0이 아닌 수도 남는 판만 낸다. 여섯 판에 둘(판 번호를 6으로 나눈 나머지가 2와 5)이 안 되는 판이다
//   long    수가 많은 판(열에서 스물). 세 규칙이 번갈아 나온다. 먼저 적은 것으로 쪽지를 열어 볼 수도 있고, 끝까지 지워 볼 수도 있다
import { boardKey, finalsOf, sameBoard, solve, sumOf } from './erase.js';
import { createRng, randInt, seedFrom } from './rng.js';

/**
 * 사다리.
 *   tag    'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode   판의 종류(위의 설명)
 *   counts 칠판의 수의 개수 범위
 *   top    수의 위 끝(same은 0과 1뿐)
 */
export const LADDER = [
  { level: 1, tag: 'basic', mode: 'same', counts: [4, 7] },
  { level: 2, tag: 'basic', mode: 'less', counts: [3, 6], top: 9 },
  { level: 3, tag: 'applied', mode: 'parity', counts: [4, 6], top: 9 },
  { level: 4, tag: 'applied', mode: 'zero', counts: [3, 6], top: 9 },
  { level: 5, tag: 'challenge', mode: 'long', counts: [12, 20], top: 9 },
  { level: 6, tag: 'challenge', mode: 'make' },
];

/** 판을 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;

/** 판의 종류마다 쓰는 규칙(long은 판 번호마다 바뀐다) */
export const RULE_OF = { same: 'same', less: 'less', parity: 'diff', zero: 'diff' };
/** 긴 판의 규칙 차례(판 번호를 3으로 나눈 나머지 0, 1, 2) */
export const LONG_RULES = ['less', 'same', 'diff'];

/** 판 하나를 만들려고 다시 골라 보는 횟수의 위 끝. 실제로는 넘지 않는다(테스트로 확인한다) */
const MAX_TRIES = 2000;

/**
 * 정해 둔 판: 1단계 첫 판(1이 셋이라 1이 남는다), 2단계 첫 판(3, 5, 2는 8이 남는다), 3단계 첫 판(합 11),
 * 4단계 첫 판(2, 3, 5는 0을 남기기 쉽다), 4단계에서 처음 만나는 안 되는 판(1, 2, 4. 세 가지 차례를 모두 해 보면 늘 홀수가 남는다),
 * 5단계 첫 판(1부터 10까지, 합에서 1 빼기)
 */
const FIXED = {
  '1:1': { rule: 'same', nums: [1, 0, 1, 1, 0] },
  '2:1': { rule: 'less', nums: [3, 5, 2] },
  '3:1': { rule: 'diff', nums: [4, 1, 5, 3] },
  '4:1': { rule: 'diff', nums: [2, 3, 5] },
  '4:2': { rule: 'diff', nums: [1, 2, 4] },
  '5:1': { rule: 'less', nums: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
};

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

/** 그 판 번호가 안 되는 판의 자리인가(0을 남길 수 있을까의 여섯 판에 둘) */
export const impossibleAt = (rung, seed) => rung.mode === 'zero' && [1, 4].includes((seed - 1) % 6);

/** 한 번 푼 판은 적어 둔다 */
const solved = new Map();
export function solveOnce(board) {
  const key = boardKey(board);
  if (!solved.has(key)) solved.set(key, solve(board));
  return solved.get(key);
}

// ---- 판 만들기 ----

/** 수 count개를 low~high에서 아무렇게나 고른 판 */
export function scatter(rng, rule, count, low, high) {
  return { rule, nums: Array.from({ length: count }, () => randInt(rng, low, high)) };
}

/** 0과 1이 모두 있는 판인가(같으면 0, 다르면 1) */
const mixed01 = (board) => board.nums.includes(0) && board.nums.includes(1);
/** 두 수의 차: 남길 수 있는 수가 둘 이상인가 */
const manyFinals = (board) => finalsOf('diff', board.nums).length >= 2;
/** 0을 남길 수 있고, 차례에 따라 다른 수도 남는가 */
const zeroBoard = (board) => {
  const finals = finalsOf('diff', board.nums);
  return finals.includes(0) && finals.length >= 2;
};
/** 합이 홀수인가(0을 남길 수 없다) */
const oddSum = (board) => sumOf(board.nums) % 2 === 1;

/** 조건에 맞는 판 하나 */
function pick(rng, rule, [low, high], [lo, hi], fits) {
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const board = scatter(rng, rule, randInt(rng, low, high), lo, hi);
    if (fits(board)) return board;
  }
  throw new Error(`판을 만들지 못했어요: ${rule}`);
}

/** 판의 종류와 규칙과 크기로 판 하나(더 작은 판도 이것으로 만든다) */
export function boardOf(rng, mode, rule, counts, top, impossible = false) {
  if (rule === 'same') return pick(rng, 'same', counts, [0, 1], mixed01);
  if (rule === 'less') return pick(rng, 'less', counts, [1, top], () => true);
  if (mode === 'zero') return pick(rng, 'diff', counts, [1, top], impossible ? oddSum : zeroBoard);
  if (mode === 'parity') return pick(rng, 'diff', counts, [1, top], manyFinals);
  return pick(rng, 'diff', counts, [1, top], () => true);
}

/** 긴 판의 규칙 */
export const longRule = (seed) => LONG_RULES[(seed - 1) % 3];

/** 그 단계의 판 번호로 만드는 판 */
function boardAt(rung, seed) {
  const fixed = FIXED[`${rung.level}:${seed}`];
  if (fixed) return { rule: fixed.rule, nums: fixed.nums.slice() };
  const rng = createRng(seedFrom('erase', rung.level, seed));
  if (rung.mode === 'long') {
    const rule = longRule(seed);
    // 같으면 0, 다르면 1은 열넷에서 스물, 합에서 1 빼기는 열에서 열여섯(끝에 남는 수가 세 자리를 넘지 않게), 차는 열둘에서 스물
    const counts = rule === 'same' ? [14, 20] : rule === 'less' ? [10, 16] : rung.counts;
    return boardOf(rng, 'long', rule, counts, rung.top);
  }
  return boardOf(rng, rung.mode, RULE_OF[rung.mode], rung.counts, rung.top, impossibleAt(rung, seed));
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

/** 작은 판의 수의 개수 아래 끝(수가 둘이면 한 번에 끝난다) */
export const SMALL_FLOOR = 3;

/**
 * 더 작은 판들. 같은 판에는 늘 같은 판들이 나온다. 같은 규칙과 같은 물음이고 수가 적다.
 *   yes: 원래 판과 같은 종류의 판(0을 남길 수 있을까에서는 0을 남길 수 있는 판)
 *   no:  0을 남길 수 있을까의 안 되는 판에서만. 합이 홀수인 더 작은 판
 * 수가 SMALL_FLOOR개 이하인 판에는 더 작은 판이 없다(둘 다 비어 있다).
 * 수가 많은 판(긴 판, 직접 만든 큰 판)은 수가 다섯이나 여섯인 판을 낸다.
 * @param {object} origin { mode, board }
 * @returns {{yes: object[], no: object[]}}
 */
export function smallBoards(origin) {
  const { board, mode } = origin;
  const n = board.nums.length;
  if (n <= SMALL_FLOOR) return { yes: [], no: [] };
  const rng = createRng(seedFrom('erase-small', mode, boardKey(board)));
  const top = Math.max(...board.nums, board.rule === 'same' ? 1 : 3);
  const counts = n >= 8 ? [5, 6] : [Math.max(SMALL_FLOOR, n - 2), n - 1];
  const kind = mode === 'zero' || mode === 'parity' ? mode : 'any';
  const yes = [];
  const no = [];
  const seen = new Set([boardKey(board)]);
  const possible = mode !== 'zero' || solveOnce(board).zero === true;
  for (let attempt = 0; attempt < 40 && (yes.length < 2 || (!possible && no.length < 2)); attempt++) {
    const wantNo = !possible && yes.length >= 2;
    const small = boardOf(rng, kind, board.rule, counts, Math.min(top, 9), wantNo);
    const key = boardKey(small);
    if (seen.has(key)) continue;
    seen.add(key);
    if (wantNo) no.push(small);
    else yes.push(small);
  }
  return { yes, no };
}
