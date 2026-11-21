// 블랙홀의 사다리(단계)와 판 내기, 더 작은 판. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 풀이 프로그램으로 푼 판만 내보낸다:
// 빈칸이 EXACT_LEFT개 이하인 판에는 "아이가 먼저 둘 때와 나중에 둘 때, 둘 다 잘 두면 끝에 합의 차가 얼마인가"가 붙어 있다.
// 칸이 15개인 큰 판은 처음부터 끝까지 다 따질 수 없어서 그 값이 없다(exact가 false. 선생님은 그 판에 대해 아무 말도 하지 않는다).
import { checkBoard, copyBoard, openCells, pickMove, replay, sideToMove, solve } from './blackhole.js';
import { createRng, seedFrom } from './rng.js';

/**
 * 사다리.
 *   tag     'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode    'game'(선생님과 번갈아 두기) | 'make'(직접 만들기)
 *   order   'first'(아이가 먼저 둔다) | 'given'(수가 몇 개 놓인 판에서 아이 차례로 시작한다) | 'choose'(먼저 둘지 나중에 둘지 두기 전에 고른다)
 *   teacher 선생님이 두는 법(src/core/blackhole.js의 pickMove)
 *   hint    힌트와 처음 화면의 물음을 고르는 이름
 *   boards  판의 차례([줄 수, 돌, 내 수의 칸, 선생님 수의 칸, 먼저 둔 쪽]). 판 번호가 달라지면 차례로 돈다
 *   small   수준 맞추기가 "작은 판부터"라고 할 때 내는 판
 *
 * 1단계 작은 판에서 두기(칸 5개와 7개): 아이가 먼저 두고, 선생님은 아무 빈칸에나 놓는다. 둘 다 잘 두면 5칸 판은 비기고,
 *   7칸 판은 판에 따라 비기거나 먼저 두는 쪽이 이긴다(풀이 프로그램과 테스트가 확인한다).
 * 2단계 칸이 9개인 판(세모 열 칸에 돌 하나): 아이가 먼저 두고, 선생님은 어림으로 두다가 끝의 세 수만 모두 따져서 둔다.
 *   둘 다 잘 두면 돌이 구석이나 가운데에 있으면 비기고, 변에 있으면 먼저 두는 쪽이 이긴다.
 * 3단계 몇 수만 남은 판: 수가 몇 개 놓인 판에서 아이 차례로 시작한다. 선생님은 모두 따져서 둔다.
 *   판마다 아이가 잘 두면 이기는데, 이기는 칸은 하나뿐이다(다른 칸에 놓으면 잘 두는 선생님에게 진다).
 * 4단계 먼저 둘까, 나중에 둘까?(칸 9개): 두기 전에 고른다. 선생님은 모두 따져서 둔다.
 *   빈 판은 먼저 두는 쪽이 이기거나 비긴다. 1을 하나씩 놓아 둔 판 가운데는 나중에 두는 쪽만 이기는 판도 있다.
 * 5단계 칸이 15개인 큰 판: 두기 전에 고른다. 선생님은 어림으로 두다가 빈칸이 9개 남으면 끝까지 모두 따져서 둔다.
 *   이 판의 처음 자리는 끝까지 다 따지지 못했다. 그래서 어느 쪽이 이기는 자리인지 기록에 적지 않는다.
 * 6단계 직접 만들기: 줄 수, 돌, 미리 놓을 수, 먼저 둘 쪽을 정하면 둘 다 잘 두면 어떻게 끝나는지 알려 준다(빈칸이 9개 이하일 때).
 */
export const LADDER = [
  {
    level: 1,
    tag: 'basic',
    mode: 'game',
    order: 'first',
    teacher: 'easy',
    hint: 'small',
    small: [3, [0], [], [], 'kid'],
    boards: [
      [3, [0], [], [], 'kid'],
      [3, [4], [], [], 'kid'],
      [4, [0, 6, 9], [], [], 'kid'],
      [3, [1], [], [], 'kid'],
      [4, [1, 6, 9], [], [], 'kid'],
      [3, [3], [], [], 'kid'],
      [4, [3, 5, 7], [], [], 'kid'],
      [4, [0, 7, 8], [], [], 'kid'],
    ],
  },
  {
    level: 2,
    tag: 'basic',
    mode: 'game',
    order: 'first',
    teacher: 'fair',
    hint: 'nine',
    small: [3, [0], [], [], 'kid'],
    boards: [
      [4, [0], [], [], 'kid'],
      [4, [7], [], [], 'kid'],
      [4, [4], [], [], 'kid'],
      [4, [1], [], [], 'kid'],
      [4, [9], [], [], 'kid'],
      [4, [5], [], [], 'kid'],
      [4, [6], [], [], 'kid'],
      [4, [8], [], [], 'kid'],
    ],
  },
  {
    level: 3,
    tag: 'applied',
    mode: 'game',
    order: 'given',
    teacher: 'best',
    hint: 'left',
    small: [3, [0], [2], [4], 'kid'],
    boards: [
      [4, [0], [1, 7], [2, 8, 9], 'teacher'],
      [4, [0], [4, 2], [6, 7], 'kid'],
      [5, [], [2, 7, 4, 1, 3], [14, 0, 5, 10, 11], 'kid'],
      [4, [7], [5, 2], [6, 9], 'kid'],
      [5, [], [10, 0, 11, 1], [14, 3, 6, 13, 9], 'teacher'],
      [4, [4], [6, 8], [9, 5], 'kid'],
      [5, [], [0, 10, 6, 3, 5], [14, 11, 9, 13, 2], 'kid'],
      [5, [], [10, 14, 5, 9], [0, 1, 3, 6], 'kid'],
    ],
  },
  {
    level: 4,
    tag: 'challenge',
    mode: 'game',
    order: 'choose',
    teacher: 'best',
    hint: 'choose',
    small: [3, [0], [], [], null],
    boards: [
      [4, [7], [], [], null],
      [4, [7], [6], [1], null],
      [4, [0], [], [], null],
      [4, [1], [0], [5], null],
      [4, [0], [1], [6], null],
      [4, [1], [], [], null],
      [4, [7], [9], [5], null],
      [4, [1], [6], [7], null],
    ],
  },
  {
    level: 5,
    tag: 'challenge',
    mode: 'game',
    order: 'choose',
    teacher: 'best',
    hint: 'big',
    small: [4, [7], [], [], null],
    boards: [
      [5, [], [], [], null],
      [5, [10, 14], [], [], null],
      [5, [0, 12], [], [], null],
      [5, [6, 8], [], [], null],
    ],
  },
  { level: 6, tag: 'challenge', mode: 'make', order: 'given', teacher: 'best', hint: 'made' },
];

/** 판을 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

/** 이 단계에서 선생님이 두는 법. 직접 만든 판은 잘 둔다 */
export const teacherOf = (level, custom) => (custom ? 'best' : (LADDER.find((item) => item.level === level)?.teacher ?? 'best'));

/** 차례에 적은 값을 판으로 */
export const boardOf = ([rows, rocks, kid, teacher, first]) => ({ rows, rocks: [...rocks], kid: [...kid], teacher: [...teacher], first });

/** 판의 풀이 */
export const solutionOf = (board) => solve(board);

function entryOf(rung, seed, small) {
  if (small) return rung.small;
  const count = rung.boards.length;
  const at = seed - 1;
  return rung.boards[((at % count) + count) % count];
}

/**
 * 판 하나를 낸다.
 * @param {number} level 1~5
 * @param {number} seed 판 번호(1부터)
 * @param {{small?: boolean}} options small: 그 단계의 작은 판을 낸다(수준 맞추기에서 쓴다)
 * @returns {{level, seed, small, board, solution}}
 */
export function generateBoard(level, seed, { small = false } = {}) {
  const rung = rungOf(level);
  if (rung.mode === 'make') throw new Error('직접 만들기 단계는 판을 내지 않아요');
  const board = boardOf(entryOf(rung, seed, small));
  if (checkBoard(board) !== null) throw new Error(`쓸 수 없는 판이에요: ${JSON.stringify(board)}`);
  return { level, seed, small, board, solution: solutionOf(board) };
}

const sameBoard = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** 다음 판 번호. 방금 한 판과 똑같은 판이 나오는 번호는 건너뛴다. */
export function nextSeed(level, seed, options = {}) {
  const now = generateBoard(level, seed, options).board;
  for (let next = seed + 1; next < seed + 40; next++) {
    if (!sameBoard(generateBoard(level, next, options).board, now)) return next;
  }
  return seed + 1;
}

// ---- 더 작은 판: 틀의 "더 작은 판으로"가 이 목록을 차례로 낸다(src/core/smaller.js) ----

/**
 * 판의 종류: 'choose'(먼저 둘지 고르는 판) | 'kid'(빈 판에서 아이가 먼저) | 'teacher'(빈 판에서 선생님이 먼저)
 *   | 'given-kid'(수가 놓인 판에서 아이 차례) | 'given-teacher'(수가 놓인 판에서 선생님 차례)
 */
export function kindOf(board) {
  if (board.first === null) return 'choose';
  if (board.kid.length + board.teacher.length === 0) return board.first;
  return `given-${sideToMove(board)}`;
}

/** 작은 판 선반: 칸이 5개, 7개, 9개인 판. 종류마다 칸이 많은 것부터 */
export const SMALL_SHELF = [
  [4, [7], [], [], null],
  [4, [0, 6, 9], [], [], null],
  [3, [0], [], [], null],
  [4, [0, 6, 9], [], [], 'kid'],
  [3, [0], [], [], 'kid'],
  [4, [0, 6, 9], [], [], 'teacher'],
  [3, [0], [], [], 'teacher'],
  [4, [0], [4, 2], [6, 7], 'kid'],
  [4, [0, 6, 9], [4, 3], [7, 2], 'kid'],
  [3, [0], [2], [4], 'kid'],
  [4, [0, 6, 9], [3], [], 'kid'],
  [3, [0], [1], [], 'kid'],
];

const openOf = (board) => openCells(board).length;
const emptyOf = (board) => openOf(board) - board.kid.length - board.teacher.length;

/** 두 수(한쪽에 하나씩)를 더 놓은 판: 둘 차례인 쪽과 판의 종류가 그대로이고 빈칸이 둘 적다. 수는 잘 두는 선생님처럼 고른다 */
function advanced(board) {
  if (emptyOf(board) - 2 < 3) return null;
  const first = board.first ?? 'kid';
  const rng = createRng(seedFrom('blackhole-small', JSON.stringify(board)));
  const trail = [];
  for (let step = 0; step < 2; step++) trail.push(pickMove({ ...board, first }, trail, first, rng, 'best'));
  const now = replay({ ...board, first }, trail, first);
  // 먼저 둘지 고르는 판은 같은 수만큼 놓인 판으로 남는다(그래서 여전히 고를 수 있다)
  return { rows: board.rows, rocks: [...board.rocks], kid: now.kid, teacher: now.teacher, first: board.first };
}

/**
 * 원래 판보다 작은 판들. 먼저 선반에서 같은 종류이고 열린 칸이 더 적은 판을(칸이 많은 것부터) 내고,
 * 그런 판이 없으면(가장 작은 판이면) 같은 판에 수를 두 개 더 놓은 판을 낸다. 둘 다 없으면 빈 목록이다.
 * 수가 놓인 판에서 아이 차례인 판의 작은 판은 아이가 잘 두면 이기는 판이다(테스트가 확인한다).
 */
export function smallBoards(board) {
  const kind = kindOf(board);
  const found = SMALL_SHELF.map(boardOf).filter((small) => kindOf(small) === kind && openOf(small) < openOf(board));
  if (found.length > 0) return found.map(copyBoard);
  const next = advanced(board);
  return next && checkBoard(next) === null ? [next] : [];
}
