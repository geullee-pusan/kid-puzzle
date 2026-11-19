// 조각 못 들어가게 막기의 사다리(단계)와 판 내기. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 판마다 풀이 프로그램의 결과(가장 적게 막는 칸 수와 한 가지 방법)를 붙여 내보낸다.
//
// 이 형식의 판은 크기와 조각으로 정해져서 가짓수가 적다. 그래서 무작위로 뽑지 않고, 단계마다 정해 둔 차례로 돌린다(약수 세금과 같다).
// 다 돌면 다시 처음부터 돈다. 차례 안에서 이웃한 두 판은 늘 다르다(맨 끝과 맨 처음도 다르다). 그래서 "새 판"은 늘 다른 판이다.
// 사다리의 판은 모두 풀이 프로그램이 끝까지 따질 수 있는 크기다(테스트가 확인한다). 그래서 가장 적게 막는 수를 늘 안다.
import { solve } from './block.js';

/**
 * 사다리.
 *   tag     'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode    'play'(칸을 막는다) | 'make'(아이가 직접 만든다)
 *   hint    그 단계에서 쓰는 힌트 묶음과 규칙 글의 이름
 *   boards  판의 차례: [조각, 가로, 세로]
 *
 * 1단계는 실패할 수 없다. 어떻게 막아도 조각이 들어갈 자리는 언젠가 없어진다(판을 다 막아도 된다). "더 적게"는 그다음에 묻는다.
 * 1단계의 첫 판(3×3 도미노)과 4단계의 모든 판은 "자리가 가장 많이 지나는 칸부터 막기"로는 가장 적게 막을 수 없는 판이다(테스트가 확인한다).
 */
export const LADDER = [
  { level: 1, tag: 'basic', mode: 'play', hint: 'start', boards: [['domino', 3, 3], ['domino', 4, 3], ['domino', 5, 3], ['domino', 4, 4]] },
  { level: 2, tag: 'applied', mode: 'play', hint: 'more', boards: [['bar', 4, 4], ['ell', 4, 3], ['bar', 5, 3], ['ell', 5, 3], ['bar', 5, 4], ['ell', 6, 3]] },
  { level: 3, tag: 'applied', mode: 'play', hint: 'more', boards: [['square', 5, 5], ['tee', 4, 4], ['zig', 5, 5], ['bend', 4, 4], ['long', 5, 5]] },
  { level: 4, tag: 'challenge', mode: 'play', hint: 'more', boards: [['bar', 5, 5], ['tee', 5, 5], ['ell', 5, 4], ['bend', 5, 5], ['zig', 6, 5], ['tee', 6, 6]] },
  { level: 5, tag: 'challenge', mode: 'make', hint: 'more' },
];

/** 판을 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 4;
export const MAKE_LEVEL = 5;

/** 1단계에서 "작은 판부터"일 때 내는 판(수준 맞추기에서 쓴다) */
export const SMALL_BOARD = ['domino', 3, 2];

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

/** [조각, 가로, 세로] → 판 */
export const boardOf = ([piece, w, h]) => ({ w, h, piece, holes: [] });

/** 한 번 푼 판은 적어 둔다(처음 화면을 그릴 때마다 다시 풀지 않게). 같은 판은 늘 같은 결과다 */
const solved = new Map();
function solveOnce(board) {
  const key = JSON.stringify(board);
  if (!solved.has(key)) solved.set(key, solve(board));
  return solved.get(key);
}

/**
 * 판 하나를 낸다.
 * @param {number} level 1~4
 * @param {number} seed 판 번호(1부터). 차례의 몇 번째 판인지를 정한다
 * @param {{small?: boolean}} options small: 맨 아래 단계에서 가장 작은 판을 낸다(수준 맞추기에서 쓴다)
 * @returns {{level: number, seed: number, small: boolean, board: object, solution: {exact: boolean, best: number, blocked: number[]}}}
 */
export function generateBoard(level, seed, { small = false } = {}) {
  const rung = rungOf(level);
  if (rung.mode === 'make') throw new Error('직접 만들기 단계는 판을 내지 않아요');
  const shrink = small && level === LADDER[0].level;
  const count = rung.boards.length;
  const at = (((seed - 1) % count) + count) % count;
  const board = boardOf(shrink ? SMALL_BOARD : rung.boards[at]);
  const { exact, best, blocked } = solveOnce(board);
  return { level, seed, small, board, solution: { exact, best, blocked } };
}

/** 다음 판 번호. 차례에서 이웃한 판은 늘 다르므로 그냥 다음 번호다. */
export function nextSeed(level, seed) {
  rungOf(level);
  return seed + 1;
}
