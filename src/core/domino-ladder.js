// 도미노 가로세로의 사다리(단계)와 판 내기. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 풀이 프로그램으로 푼 판만 내보낸다:
// 판마다 "세로가 먼저 둘 때와 가로가 먼저 둘 때, 잘 두면 어느 쪽이 이기는지"가 붙어 있다.
import { checkBoard, solve } from './domino.js';

/**
 * 사다리.
 *   tag    'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode   'game'(선생님과 두기) | 'make'(아이가 직접 정한다)
 *   role   아이가 서는 쪽: 'vert'(세로) | 'horz'(가로) | 'board'(판마다 적어 둔 쪽) | 'choose'(두기 전에 쪽과 먼저 둘지를 고른다)
 *   order  아이가 먼저 두는가: 'first' | 'choose'
 *   hint   힌트와 처음 화면의 물음을 고르는 이름
 *   boards 판의 차례([가로, 세로, 구멍들] 또는 [가로, 세로, 구멍들, 아이의 쪽]). 판 번호가 달라지면 차례로 돈다
 *   first  판 번호 1에 내는 판(없으면 차례의 첫 판)
 *   small  수준 맞추기가 "작은 판부터"라고 할 때 내는 판
 *
 * 1단계: 아이가 세로이고 먼저 둔다. 모두 세로가 먼저 두면 세로가 이기는 작은 판이다(풀이 프로그램).
 *   3×3은 첫 수 여섯 가운데 둘만 이기는 수이고, 3×2는 셋 가운데 하나(가운데 줄)다.
 *   맨 처음 판(판 번호 1)은 2×3(가로 2칸, 세로 3칸)이다. 어디에 어떻게 놓아도 세로가 이긴다(실패할 수 없는 첫 판).
 * 2단계: 나만 놓을 수 있는 자리가 있는 판. 아이가 먼저 둔다. 쪽은 판마다 정해져 있다(세로와 가로가 번갈아).
 *   모든 판에서 아이가 이기는 수가 있고, 아이만 놓을 수 있는 자리에 첫 도미노를 놓으면 진다(테스트가 확인한다).
 *   가로 판은 세로 판을 대각선으로 뒤집은 판이다.
 * 3단계: 두기 전에 세로가 될지 가로가 될지, 먼저 둘지 나중에 둘지 고른다. 3×3~4×4와 구멍 둘인 4×4.
 *   먼저 두는 쪽이 이기는 판, 나중에 두는 쪽이 이기는 판, 누가 먼저 두어도 세로나 가로가 이기는 판이 섞인다.
 * 4단계: 방이 나뉜 판. 구멍으로 판이 몇 방으로 갈라져 있다. 고르기는 3단계와 같다.
 * 5단계: 큰 판(5×5, 5×4, 4×5와 구멍이 있는 5×5). 고르기는 3단계와 같다. 5×5는 나중에 두는 쪽이 이긴다.
 * 6단계: 직접 만들기. 판의 크기와 구멍을 정하면 선생님이 누가 먼저 두든 잘 두면 누가 이기는지 알려 준다.
 */
export const LADDER = [
  {
    level: 1,
    tag: 'basic',
    mode: 'game',
    role: 'vert',
    order: 'first',
    hint: 'vert',
    first: [2, 3, []],
    small: [3, 2, []],
    boards: [[3, 3, []], [3, 2, []], [3, 3, [0]], [2, 4, []], [3, 3, [1]], [3, 4, []], [3, 3, [0, 8]], [3, 3, [7]]],
  },
  {
    level: 2,
    tag: 'basic',
    mode: 'game',
    role: 'board',
    order: 'first',
    hint: 'safe',
    small: [5, 2, [2, 4, 7, 9], 'vert'],
    boards: [
      [5, 2, [2, 4, 7, 9], 'vert'],
      [2, 5, [4, 5, 8, 9], 'horz'],
      [5, 3, [3, 8, 13, 14], 'vert'],
      [3, 5, [9, 10, 11, 14], 'horz'],
      [5, 4, [2, 4, 7, 9, 10, 11, 13, 14, 17], 'vert'],
      [4, 5, [2, 6, 8, 9, 11, 14, 16, 17, 18], 'horz'],
      [5, 4, [3, 8, 10, 11, 13, 14, 17], 'vert'],
      [4, 5, [2, 6, 11, 12, 13, 14, 18], 'horz'],
    ],
  },
  {
    level: 3,
    tag: 'applied',
    mode: 'game',
    role: 'choose',
    order: 'choose',
    hint: 'choose',
    small: [3, 3, []],
    boards: [[3, 3, []], [4, 4, [0, 15]], [3, 4, []], [4, 3, []], [4, 4, []], [4, 4, [5, 10]], [5, 2, []], [4, 4, [1, 2]], [2, 5, []], [4, 4, [3, 12]], [4, 4, [5, 9]]],
  },
  {
    level: 4,
    tag: 'applied',
    mode: 'game',
    role: 'choose',
    order: 'choose',
    hint: 'rooms',
    small: [5, 4, [2, 7, 8, 9, 10, 11, 13, 14, 15, 16, 18, 19]],
    boards: [
      [5, 4, [1, 3, 6, 8, 10, 11, 12, 13, 14, 17]],
      [5, 4, [1, 3, 4, 6, 8, 9, 10, 11, 12, 13, 14, 17]],
      [5, 4, [2, 7, 8, 9, 10, 11, 13, 14, 15, 16, 18, 19]],
      [5, 5, [2, 7, 8, 9, 10, 11, 12, 13, 14, 17, 18, 19, 22, 23, 24]],
      [4, 5, [2, 4, 5, 6, 10, 11, 12, 13, 14, 18]],
      [4, 5, [2, 3, 6, 7, 8, 9, 13, 14, 15, 17, 18, 19]],
      [5, 5, [2, 7, 10, 11, 12, 13, 14, 16, 17, 18, 19, 21, 22, 23, 24]],
      [4, 5, [2, 4, 5, 6, 10, 11, 12, 13, 14, 16, 17, 18]],
    ],
  },
  {
    level: 5,
    tag: 'challenge',
    mode: 'game',
    role: 'choose',
    order: 'choose',
    hint: 'choose',
    small: [5, 4, []],
    boards: [[5, 5, []], [5, 4, []], [5, 5, [6, 18]], [4, 5, []], [5, 5, [12]], [5, 5, [11, 13]], [5, 5, [0]], [5, 5, [7, 17]], [5, 5, [0, 24]], [5, 5, [6, 8, 16, 18]]],
  },
  { level: 6, tag: 'challenge', mode: 'make', role: 'choose', order: 'choose', hint: 'choose' },
];

/** 판을 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

/** 차례에 적은 값을 판으로 */
export const boardOf = ([w, h, holes]) => ({ w, h, holes: holes.slice() });

/** 이 단계의 이 판에서 아이가 서는 쪽. 고르는 단계면 null */
export function roleOf(rung, entry) {
  if (rung.role === 'vert' || rung.role === 'horz') return rung.role;
  if (rung.role === 'board') return entry[3];
  return null;
}

/** 판의 풀이: 누가 먼저 두든 잘 두면 어느 쪽이 이기는가 */
export function solutionOf(board) {
  const { vert, horz, kind, positions } = solve(board);
  return { possible: true, vert, horz, kind, positions };
}

function entryOf(rung, seed, small) {
  if (small) return rung.small;
  if (seed === 1 && rung.first) return rung.first;
  const count = rung.boards.length;
  // 판 번호 1에 정해 둔 판이 있으면 2부터 차례의 처음이다.
  const at = seed - (rung.first ? 2 : 1);
  return rung.boards[((at % count) + count) % count];
}

/**
 * 판 하나를 낸다.
 * @param {number} level 1~5
 * @param {number} seed 판 번호(1부터)
 * @param {{small?: boolean}} options small: 그 단계의 작은 판을 낸다(수준 맞추기에서 쓴다)
 * @returns {{level, seed, small, board, role, order, solution}} role, order: 단계가 정해 준 아이의 쪽과 차례(고르는 단계면 null)
 */
export function generateBoard(level, seed, { small = false } = {}) {
  const rung = rungOf(level);
  if (rung.mode === 'make') throw new Error('직접 만들기 단계는 판을 내지 않아요');
  const entry = entryOf(rung, seed, small);
  const board = boardOf(entry);
  if (checkBoard(board) !== null) throw new Error(`쓸 수 없는 판이에요: ${JSON.stringify(board)}`);
  const role = roleOf(rung, entry);
  const order = rung.order === 'first' ? 'first' : null;
  return { level, seed, small, board, role, order, solution: solutionOf(board) };
}

/** 이 단계의 이 판에서 단계가 정해 준 아이의 쪽(고르는 단계와 직접 만든 판은 null) */
export function givenRole(level, board) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung || rung.mode === 'make') return null;
  if (rung.role === 'vert' || rung.role === 'horz') return rung.role;
  if (rung.role !== 'board') return null;
  const same = (entry) => entry && entry[0] === board.w && entry[1] === board.h && entry[2].join('.') === board.holes.join('.');
  const entry = [rung.small, ...rung.boards].find(same);
  return entry ? entry[3] : null;
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
