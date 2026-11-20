// 조각 가짓수 찾기의 사다리(단계)와 판 내기. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 단계마다 정해 둔 판들을 차례로 돈다(무작위 수를 쓰지 않는다).
// 모든 판은 풀이 프로그램으로 확인한 뒤에 낸다.
import { checkBoard, copyBoard, smallBoards, solve } from './pieces.js';

/**
 * 사다리.
 *   tag    'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode   'find'(조각을 모두 찾는다) | 'make'(직접 만들기)
 *   boards 그 단계에서 차례로 내는 판들
 *
 * 1단계: 세 칸 조각(두 가지)과 네 칸 조각(다섯 가지). 모두 몇 가지인지 규칙에서 알려 준다. 첫 판은 세 칸이다.
 * 2단계: 다섯 칸 조각. 모두 몇 가지일지 먼저 짐작해서 넣고 찾는다(열두 가지). 다 찾으면 끝나고, "여기까지 할래요"로 끝내도 된다.
 * 3단계: 같은 조각의 약속을 바꾼다. 뒤집어야 겹치는 것을 다른 조각으로 치는 네 칸 조각(일곱 가지),
 *        돌려야 겹치는 것도 다른 조각으로 치는 세 칸 조각(여섯 가지). 먼저 짐작한다.
 * 4단계: 가장 긴 줄로 나누어 찾기. 가장 긴 줄이 세 칸인 다섯 칸 조각(여덟 가지), 다섯 칸인 여섯 칸 조각(세 가지),
 *        네 칸인 여섯 칸 조각(열세 가지). 몇 가지인지 알려 준다.
 * 5단계: 여섯 칸 조각 서른다섯 가지. 몇 가지인지 알려 주고, 찾은 만큼에서 "여기까지 할래요"로 끝내도 된다(가장 많이 찾은 것이 기록).
 * 6단계: 직접 만들기(칸 수와 같은 조각의 약속을 정하면 선생님이 몇 가지인지 세어 보여 준다).
 */
export const LADDER = [
  {
    level: 1,
    tag: 'basic',
    mode: 'find',
    boards: [
      { n: 3, rule: 'free', row: null, tell: true },
      { n: 4, rule: 'free', row: null, tell: true },
    ],
  },
  { level: 2, tag: 'applied', mode: 'find', boards: [{ n: 5, rule: 'free', row: null, tell: false }] },
  {
    level: 3,
    tag: 'applied',
    mode: 'find',
    boards: [
      { n: 4, rule: 'turn', row: null, tell: false },
      { n: 3, rule: 'fixed', row: null, tell: false },
    ],
  },
  {
    level: 4,
    tag: 'applied',
    mode: 'find',
    boards: [
      { n: 5, rule: 'free', row: 3, tell: true },
      { n: 6, rule: 'free', row: 5, tell: true },
      { n: 6, rule: 'free', row: 4, tell: true },
    ],
  },
  { level: 5, tag: 'challenge', mode: 'find', boards: [{ n: 6, rule: 'free', row: null, tell: true }] },
  { level: 6, tag: 'challenge', mode: 'make' },
];

export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

/**
 * 판 하나를 낸다.
 * @param {number} level 1~5
 * @param {number} seed 판 번호(1부터). 단계의 판들을 차례로 돈다
 * @param {{small?: boolean}} options small: 그 판의 작은 판(칸이 하나 적은 조각)을 낸다. 없으면 그 판 그대로다
 * @returns {{level, seed, small, board, solution}}
 */
export function generateBoard(level, seed, { small = false } = {}) {
  const rung = rungOf(level);
  if (rung.mode === 'make') throw new Error('직접 만들기 단계는 판을 내지 않아요');
  if (!Number.isInteger(seed) || seed < 1) throw new Error(`판 번호가 맞지 않아요: ${seed}`);
  let board = copyBoard(rung.boards[(seed - 1) % rung.boards.length]);
  if (small) board = smallBoards(board)[0] ?? board;
  const problem = checkBoard(board);
  if (problem) throw new Error(`판을 만들지 못했어요: ${level}단계 ${seed}번(${problem})`);
  return { level, seed, small, board, solution: solve(board) };
}

const sameBoard = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** 다음 판 번호. 방금 한 판과 다른 판이 나오는 번호다(판이 하나뿐인 단계는 그다음 번호다). */
export function nextSeed(level, seed, options = {}) {
  const now = generateBoard(level, seed, options).board;
  for (let next = seed + 1; next < seed + 10; next++) {
    if (!sameBoard(generateBoard(level, next, options).board, now)) return next;
  }
  return seed + 1;
}
