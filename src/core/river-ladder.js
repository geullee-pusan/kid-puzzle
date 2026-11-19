// 강 건너기의 사다리(단계)와 판 내기. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 판마다 풀이 프로그램의 결과(되는지, 배를 가장 적게 보내는 횟수, 한 가지 방법)를 붙여 내보낸다.
//
// 이 형식의 판은 수 몇 개로 정해져서 가짓수가 적다. 그래서 무작위로 뽑지 않고, 단계마다 정해 둔 차례로 돌린다(자리 바꾸기와 같다).
// 다 돌면 다시 처음부터 돈다. 차례 안에서 이웃한 두 판은 늘 다르다(맨 끝과 맨 처음도 다르다). 그래서 "새 판"은 늘 다른 판이다.
import { solve } from './river.js';

/**
 * 사다리(기획 문서의 차례: 무거운 하나와 가벼운 둘 → 함께 두면 안 되는 셋 → 짝끼리만 있을 수 있는 세 쌍 → 네 쌍과 셋이 타는 배 → 가운데 섬).
 *   tag     'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode    'maybe'(모두 건너면 끝난다. 안 되는 판은 "불가능해요"로 답한다. 되는 판과 안 되는 판이 섞인다)
 *           | 'fewest'(배를 가장 적게 보내서 건넌다. 더 많이 보냈으면 "더 줄일 수 있을까요?"라고 묻고 판을 그대로 둔다)
 *           | 'cross'(모두 건너면 끝난다. 모두 되는 판이라 "불가능해요" 단추가 없다) | 'make'(아이가 직접 만든다)
 *   story   판의 종류이자 처음 화면의 물음 이름: 'weight' | 'pets' | 'pairs' | 'island'
 *   boards  판의 차례. 코끼리와 생쥐는 [코끼리 수, 생쥐 수], 할머니와 동물들은 [동물들, 배에 타는 수], 엄마와 아기는 [쌍의 수, 배에 타는 수]
 *
 * 1단계의 첫 판(코끼리 하나와 생쥐 둘)은 실패할 수 없다. 배는 언제든 되돌아올 수 있어서 어디로도 막히지 않는다.
 * 처음 만나는 안 되는 판은 가장 쉬운 안 되는 판이다(1단계 셋째 판, 코끼리 하나와 생쥐 하나).
 * 안 되는 판이 섞이는 단계(1, 2, 4단계)에서는 여섯 판에 둘(셋에 하나)이고, 연달아 나오지 않는다.
 * "가장 적게"는 3단계에서 건다. 5단계는 모두 되는 판이다(네 쌍과 둘이 타는 배는 섬이 없으면 안 되지만, 섬이 있으면 된다).
 */
export const LADDER = [
  { level: 1, tag: 'basic', mode: 'maybe', story: 'weight', boards: [[1, 2], [2, 2], [1, 1], [1, 3], [2, 1], [2, 3]] },
  {
    level: 2,
    tag: 'applied',
    mode: 'maybe',
    story: 'pets',
    boards: [
      [['dog', 'cat', 'fish'], 2],
      [['cat', 'chick', 'fish'], 2],
      [['dog', 'cat', 'chick'], 2],
      [['dog', 'cat', 'chick', 'fish'], 3],
      [['dog', 'chick', 'fish'], 2],
      [['dog', 'cat', 'chick', 'fish'], 2],
    ],
  },
  { level: 3, tag: 'applied', mode: 'fewest', story: 'pairs', boards: [[2, 2], [3, 2], [3, 3], [3, 2]] },
  { level: 4, tag: 'challenge', mode: 'maybe', story: 'pairs', boards: [[4, 3], [4, 2], [5, 3], [4, 4], [5, 2], [5, 4]] },
  { level: 5, tag: 'challenge', mode: 'cross', story: 'island', boards: [[3, 2], [4, 2], [5, 2]] },
  { level: 6, tag: 'challenge', mode: 'make', story: null },
];

/** 판을 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;

/** 1단계에서 "작은 판부터"일 때 내는 판(수준 맞추기에서 쓴다): 코끼리 하나와 생쥐 둘 */
export const SMALL_BOARD = [1, 2];

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

/** 단계의 판 하나(차례에 적힌 꼴) → 판 */
export function boardOf(story, entry) {
  if (story === 'weight') return { kind: 'weight', heavy: entry[0], light: entry[1] };
  if (story === 'pets') return { kind: 'pets', pets: entry[0].slice(), seats: entry[1] };
  return { kind: 'pairs', pairs: entry[0], seats: entry[1], island: story === 'island' };
}

/** 한 번 푼 판은 적어 둔다(처음 화면을 그릴 때마다 다시 풀지 않게). 같은 판은 늘 같은 결과다 */
const solved = new Map();
export function solveOnce(board) {
  const key = JSON.stringify(board);
  if (!solved.has(key)) solved.set(key, solve(board));
  return solved.get(key);
}

/**
 * 판 하나를 낸다.
 * @param {number} level 1~5
 * @param {number} seed 판 번호(1부터). 차례의 몇 번째 판인지를 정한다
 * @param {{small?: boolean}} options small: 맨 아래 단계에서 가장 작은 판을 낸다(수준 맞추기에서 쓴다)
 * @returns {{level: number, seed: number, small: boolean, board: object, solution: {possible: boolean, min: number|null, moves: object[]}}}
 */
export function generateBoard(level, seed, { small = false } = {}) {
  const rung = rungOf(level);
  if (rung.mode === 'make') throw new Error('직접 만들기 단계는 판을 내지 않아요');
  const shrink = small && level === LADDER[0].level;
  const count = rung.boards.length;
  const at = (((seed - 1) % count) + count) % count;
  const board = boardOf(rung.story, shrink ? SMALL_BOARD : rung.boards[at]);
  const { possible, min, moves } = solveOnce(board);
  return { level, seed, small, board, solution: { possible, min, moves } };
}

/** 다음 판 번호. 차례에서 이웃한 판은 늘 다르므로 그냥 다음 번호다. */
export function nextSeed(level, seed) {
  rungOf(level);
  return seed + 1;
}
