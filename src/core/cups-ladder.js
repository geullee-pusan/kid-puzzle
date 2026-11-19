// 컵 뒤집기와 세 색 무리의 사다리(단계)와 판 내기. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 판마다 풀이 프로그램의 결과(되는지, 가장 적은 횟수, 한 가지 방법)를 붙여 내보낸다.
//
// 단계마다 판의 차례(컵 수, 한 번에 뒤집는 수, 엎어진 컵 수 / 세 색의 마릿수)를 정해 두고, 판 번호로 차례를 돈다(강 건너기와 같다).
// 컵 판은 어느 컵이 엎어져 있는지를 판 번호로 정한 시드 난수로 고른다. 그래서 차례를 한 바퀴 돌아도 놓인 모습은 달라질 수 있다.
// 차례 안에서 이웃한 두 판은 늘 다르다(맨 끝과 맨 처음도 다르다). 그래서 "새 판"은 늘 다른 판이다.
import { copyBoard, solve } from './cups.js';
import { createRng, seedFrom } from './rng.js';

/**
 * 사다리. 컵(익숙한 홀짝) → 컵, 가장 적게 → 세 색 무리(3으로 나눈 나머지, 홀짝이 아닌 첫 열쇠) → 세 색 무리, 더 많이 → 섞어서 → 직접 만들기.
 *   tag     'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode    'maybe'(끝내면 끝난다. 안 되는 판은 "불가능해요"로 답한다. 되는 판과 안 되는 판이 섞인다)
 *           | 'fewest'(되도록 적게 뒤집어서 끝낸다. 더 많이 뒤집었으면 "더 줄일 수 있을까요?"라고 묻고 판을 그대로 둔다. 모두 되는 판이다)
 *           | 'make'(아이가 직접 만든다)
 *   ask     처음 화면의 물음 이름: 'cups' | 'fewest' | 'colors' | 'mixed'
 *   boards  판의 차례. 컵은 ['cups', 컵 수, 한 번에 뒤집는 수, 엎어진 컵 수], 방울이는 ['colors', 빨강, 파랑, 노랑]
 *
 * 1단계의 첫 판(컵 넷이 모두 엎어진 판, 두 개씩)은 실패할 수 없다. 엎어진 컵이 짝수 개인 동안은 어떻게 뒤집어도 늘 끝낼 수 있다.
 * 처음 만나는 안 되는 판은 가장 쉬운 안 되는 판이다(1단계 셋째 판, 컵 셋 가운데 하나가 엎어진 판). 세 색 무리의 첫 안 되는 판도 가장 작은 판이다(빨강 하나, 파랑 둘).
 * 안 되는 판이 섞이는 단계(1, 3, 4, 5단계)에서는 여섯 판에 둘(셋에 하나)이고, 연달아 나오지 않는다. 처음 만나는 판은 되는 판이다.
 * "가장 적게"는 2단계에서 건다(세 개씩 뒤집기. 한 번에 홀수 개를 뒤집으면 컵 수가 그보다 많은 판은 늘 된다).
 */
export const LADDER = [
  {
    level: 1,
    tag: 'basic',
    mode: 'maybe',
    ask: 'cups',
    boards: [
      ['cups', 4, 2, 4],
      ['cups', 6, 2, 4],
      ['cups', 3, 2, 1],
      ['cups', 5, 2, 4],
      ['cups', 5, 2, 5],
      ['cups', 6, 2, 6],
    ],
  },
  {
    level: 2,
    tag: 'applied',
    mode: 'fewest',
    ask: 'fewest',
    boards: [
      ['cups', 5, 3, 1],
      ['cups', 4, 3, 4],
      ['cups', 6, 3, 2],
      ['cups', 7, 3, 5],
    ],
  },
  {
    level: 3,
    tag: 'applied',
    mode: 'maybe',
    ask: 'colors',
    boards: [
      ['colors', 2, 2, 0],
      ['colors', 3, 3, 0],
      ['colors', 1, 2, 0],
      ['colors', 2, 0, 3],
      ['colors', 3, 1, 2],
      ['colors', 2, 2, 3],
    ],
  },
  {
    level: 4,
    tag: 'challenge',
    mode: 'maybe',
    ask: 'colors',
    boards: [
      ['colors', 4, 2, 1],
      ['colors', 2, 5, 1],
      ['colors', 3, 4, 2],
      ['colors', 5, 2, 0],
      ['colors', 6, 2, 1],
      ['colors', 4, 4, 1],
    ],
  },
  {
    level: 5,
    tag: 'challenge',
    mode: 'maybe',
    ask: 'mixed',
    boards: [
      ['cups', 6, 4, 6],
      ['colors', 3, 3, 3],
      ['cups', 7, 4, 5],
      ['colors', 4, 1, 4],
      ['cups', 6, 4, 2],
      ['colors', 5, 3, 1],
    ],
  },
  { level: 6, tag: 'challenge', mode: 'make', ask: null },
];

/** 판을 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

/** 한 번 푼 판은 적어 둔다(처음 화면을 그릴 때마다 다시 풀지 않게). 같은 판은 늘 같은 결과다 */
const solved = new Map();
export function solveOnce(board) {
  const key = JSON.stringify(copyBoard(board));
  if (!solved.has(key)) solved.set(key, solve(board));
  return solved.get(key);
}

/** 컵 n개 가운데 down개가 엎어진 줄. 어느 컵인지는 시드 난수로 고른다 */
export function placeDown(n, down, rng) {
  const order = Array.from({ length: n }, (_, index) => index);
  for (let index = n - 1; index > 0; index--) {
    const other = Math.floor(rng() * (index + 1));
    [order[index], order[other]] = [order[other], order[index]];
  }
  const chosen = new Set(order.slice(0, down));
  return Array.from({ length: n }, (_, index) => (chosen.has(index) ? 1 : 0));
}

/** 단계의 판 하나(차례에 적힌 꼴) → 판. 컵 판은 rng로 엎어진 컵의 자리를 고른다 */
export function boardOf(entry, rng) {
  if (entry[0] === 'cups') {
    const [, n, k, down] = entry;
    return { kind: 'cups', n, k, cups: placeDown(n, down, rng) };
  }
  return { kind: 'colors', counts: entry.slice(1) };
}

/**
 * 판 하나를 낸다.
 * @param {number} level 1~5
 * @param {number} seed 판 번호(1부터). 차례의 몇 번째 판인지와 컵이 엎어진 자리를 정한다
 * @param {{small?: boolean}} options small: 맨 아래 단계에서 첫 판(가장 작은 판)을 낸다(수준 맞추기에서 쓴다)
 * @returns {{level: number, seed: number, small: boolean, board: object, solution: {possible: boolean, min: number|null, moves: number[][]}}}
 */
export function generateBoard(level, seed, { small = false } = {}) {
  const rung = rungOf(level);
  if (rung.mode === 'make') throw new Error('직접 만들기 단계는 판을 내지 않아요');
  const shrink = small && level === LADDER[0].level;
  const count = rung.boards.length;
  const at = shrink ? 0 : (((seed - 1) % count) + count) % count;
  const rng = createRng(seedFrom('cups', level, seed, shrink ? 'small' : 'any'));
  const board = boardOf(rung.boards[at], rng);
  const { possible, min, moves } = solveOnce(board);
  return { level, seed, small, board, solution: { possible, min, moves } };
}

/** 다음 판 번호. 차례에서 이웃한 판은 늘 다르므로 그냥 다음 번호다. */
export function nextSeed(level, seed) {
  rungOf(level);
  return seed + 1;
}
