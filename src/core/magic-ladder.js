// 마법 네모와 겹친 칸의 사다리(단계)와 판 내기. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 앞의 판들은 정해 둔 차례로 내고, 그 뒤는 시드 난수로 판 묶음에서 고른다.
// 모든 판은 풀이 프로그램으로 확인한 뒤에 낸다.
import { checkBoard, copyBoard, smallLists, solve } from './magic.js';
import { createRng, seedFrom } from './rng.js';

const ONE_TO_NINE = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const TWO_TO_TEN = [2, 3, 4, 5, 6, 7, 8, 9, 10];
const grid = (lines, cards) => ({ shape: 'grid', w: 3, h: 3, lines, cards, target: null });
const hub = (arms, cards, target) => ({ shape: 'hub', arms, cards, target });
const upTo = (n) => Array.from({ length: n }, (_, index) => index + 1);

/**
 * 4단계(다른 수 카드로 마법 네모)의 판 묶음. 되는 묶음은 가운데를 두고 맞은편 칸끼리 합이 같은 짝이 보이는 것만 골랐다.
 * 안 되는 묶음의 까닭(src/core/magic.js의 reasonOf): 아주 큰 카드, 셋으로 나뉘지 않는 합, 가운데가 정수가 아님, 가운데 카드가 없음, 짝이 없는 카드, 모두 놓아 봐야 아는 것.
 */
export const SET_POOL = {
  yes: [
    TWO_TO_TEN,
    [1, 3, 5, 7, 9, 11, 13, 15, 17],
    [1, 2, 3, 5, 6, 7, 9, 10, 11],
    [3, 4, 5, 6, 7, 8, 9, 10, 11],
    [2, 4, 6, 8, 10, 12, 14, 16, 18],
    [1, 2, 3, 7, 8, 9, 13, 14, 15],
    [2, 3, 4, 6, 7, 8, 10, 11, 12],
  ],
  no: [
    [1, 2, 3, 4, 5, 6, 7, 8, 20],
    [1, 2, 3, 4, 5, 6, 7, 8, 10],
    [1, 2, 3, 4, 5, 6, 7, 8, 12],
    [1, 2, 3, 4, 5, 7, 8, 9, 15],
    [1, 2, 3, 5, 6, 7, 8, 9, 13],
    [1, 2, 4, 5, 6, 7, 8, 10, 11],
  ],
};

/**
 * 5단계(겹친 칸)의 판 묶음: 줄 둘, 셋, 넷이 가운데 칸 하나에서 만나는 판과 맞출 합.
 * 안 되는 판은 두 번 세기로 가운데가 정수가 아니거나 그런 카드가 없는 합, 짝이 없는 합, 너무 큰 합이다.
 */
export const HUB_POOL = {
  yes: [
    hub(2, upTo(5), 8),
    hub(2, upTo(5), 9),
    hub(2, upTo(5), 10),
    hub(3, upTo(7), 10),
    hub(3, upTo(7), 12),
    hub(3, upTo(7), 14),
    hub(4, upTo(9), 12),
    hub(4, upTo(9), 15),
    hub(4, upTo(9), 18),
    hub(2, [1, 2, 3, 4, 6], 9),
    hub(2, [1, 2, 3, 4, 6], 11),
    hub(3, [2, 3, 4, 5, 6, 7, 8], 15),
  ],
  no: [
    hub(2, upTo(5), 11),
    hub(3, upTo(7), 11),
    hub(3, upTo(7), 13),
    hub(3, upTo(7), 16),
    hub(4, upTo(9), 13),
    hub(4, upTo(9), 14),
    hub(4, upTo(9), 16),
    hub(4, upTo(9), 17),
    hub(2, [1, 2, 3, 4, 6], 10),
    hub(3, [2, 3, 4, 5, 6, 7, 8], 14),
  ],
};

/**
 * 사다리.
 *   tag    'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode   'place'(카드를 놓는다) | 'make'(직접 만들기)
 *   kind   판의 종류(규칙 글과 힌트를 고른다)
 *   first  앞에서부터 차례로 내는 판들. pool이 있으면 그 뒤는 시드 난수로 고른다(셋에 하나쯤 안 되는 판)
 *
 * 1단계: 3×3에 1~9(또는 2~10). 가로 줄 셋의 합만 같게 한다. 늘 된다(놓는 방법이 많다).
 * 2단계: 가로와 세로 여섯 줄을 같게 한다. 늘 된다.
 * 3단계: 대각선까지 여덟 줄(마법 네모). 1~9는 가운데가 5인 한 가지(돌리고 뒤집어 여덟 모습)뿐이다.
 * 4단계: 다른 수 카드로 마법 네모. 안 되는 묶음이 섞인다. 첫 안 되는 판은 아주 큰 카드가 든 판이다.
 * 5단계: 겹친 칸. 가운데 칸 하나에서 만나는 줄마다 정한 합을 맞춘다. 안 되는 합이 섞인다. 첫 안 되는 판은 너무 큰 합이다.
 * 6단계: 직접 만들기(판 모양과 카드를 고르면 선생님이 어떤 합이 되는지 알려 준다).
 */
export const LADDER = [
  { level: 1, tag: 'basic', mode: 'place', kind: 'rows', first: [grid('rows', ONE_TO_NINE), grid('rows', TWO_TO_TEN)] },
  { level: 2, tag: 'basic', mode: 'place', kind: 'rowscols', first: [grid('rowscols', ONE_TO_NINE), grid('rowscols', TWO_TO_TEN)] },
  { level: 3, tag: 'applied', mode: 'place', kind: 'all', first: [grid('all', ONE_TO_NINE)] },
  {
    level: 4,
    tag: 'applied',
    mode: 'place',
    kind: 'sets',
    first: [grid('all', TWO_TO_TEN), grid('all', SET_POOL.no[0]), grid('all', SET_POOL.yes[1])],
    pool: { yes: SET_POOL.yes.map((cards) => grid('all', cards)), no: SET_POOL.no.map((cards) => grid('all', cards)) },
  },
  {
    level: 5,
    tag: 'applied',
    mode: 'place',
    kind: 'hub',
    first: [hub(2, upTo(5), 9), hub(2, upTo(5), 13), hub(3, upTo(7), 12)],
    pool: HUB_POOL,
  },
  { level: 6, tag: 'challenge', mode: 'make' },
];

export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;
/** 판 묶음에서 고를 때 안 되는 판이 나올 몫(셋에 하나쯤) */
export const NO_SHARE = 1 / 3;

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

/** 단계의 판 하나(작은 판으로 바꾸기 전) */
function boardAt(rung, seed) {
  if (!rung.pool) return rung.first[(seed - 1) % rung.first.length];
  if (seed <= rung.first.length) return rung.first[seed - 1];
  const rng = createRng(seedFrom('magic', rung.level, seed));
  const list = rng() < NO_SHARE ? rung.pool.no : rung.pool.yes;
  return list[Math.floor(rng() * list.length)];
}

/**
 * 판 하나를 낸다.
 * @param {number} level 1~5
 * @param {number} seed 판 번호(1부터)
 * @param {{small?: boolean}} options small: 그 판의 작은 판(줄이나 카드가 적은 되는 판)을 낸다. 없으면 그 판 그대로다
 * @returns {{level, seed, small, board, solution}}
 */
export function generateBoard(level, seed, { small = false } = {}) {
  const rung = rungOf(level);
  if (rung.mode === 'make') throw new Error('직접 만들기 단계는 판을 내지 않아요');
  if (!Number.isInteger(seed) || seed < 1) throw new Error(`판 번호가 맞지 않아요: ${seed}`);
  let board = copyBoard(boardAt(rung, seed));
  if (small) board = smallLists(board).yes[0] ?? board;
  const problem = checkBoard(board);
  if (problem) throw new Error(`판을 만들지 못했어요: ${level}단계 ${seed}번(${problem})`);
  return { level, seed, small, board: copyBoard(board), solution: solve(board) };
}

const sameBoard = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** 다음 판 번호. 방금 한 판과 다른 판이 나오는 번호다(판이 하나뿐인 단계는 그다음 번호다). */
export function nextSeed(level, seed, options = {}) {
  const now = generateBoard(level, seed, options).board;
  for (let next = seed + 1; next < seed + 20; next++) {
    if (!sameBoard(generateBoard(level, next, options).board, now)) return next;
  }
  return seed + 1;
}
