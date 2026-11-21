// 여우와 토끼의 사다리(단계)와 판 내기. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 풀이 프로그램으로 푼 판만 내보낸다:
// 판마다 "여우가 먼저일 때와 토끼가 먼저일 때, 둘 다 잘 하면 어느 쪽이 이기고 여우가 몇 번 만에 잡는지"가 붙어 있다.
import { checkBoard, solve } from './foxrabbit.js';

/**
 * 사다리.
 *   tag    'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode   'rabbit'(아이가 토끼, 먼저 움직일 쪽은 판이 정한다) | 'choose'(아이가 토끼, 먼저 갈지 나중에 갈지 고른다)
 *          | 'fox'(아이가 여우, 먼저 움직일 쪽은 판이 정한다) | 'predict'(누가 이길지 먼저 짐작하고, 짐작한 쪽이 되어 해 본다) | 'make'(직접 만들기)
 *   hint   힌트와 처음 화면의 물음을 고르는 이름
 *   boards 판의 차례([가로, 세로, [여우 x, y], [토끼 x, y], 먼저 움직이는 쪽]). 판 번호가 달라지면 차례로 돈다
 *   small  수준 맞추기가 "작은 판부터"라고 할 때 내는 판
 *
 * 1단계(4×4, 토끼): 처음 두 판은 토끼가 어떻게 움직여도 안 잡히는 판이다(여우 차례에 둘이 같은 색 칸). 판 번호 3, 5, 7은 여우가 잘 쫓으면 잡히는 판이다.
 *   안 잡히는 판: 여우가 먼저이고 같은 색이거나, 토끼가 먼저이고 다른 색. 잡히는 판은 그 반대(풀이 프로그램과 테스트가 확인한다).
 * 2단계(4×4, 토끼): 먼저 갈지 나중에 갈지 고른다. 같은 색 칸이면 나중에(여우가 먼저), 다른 색 칸이면 먼저 가야 안 잡힌다.
 *   어느 판이든 한쪽은 안 잡히고 다른 쪽은 잘 쫓는 여우에게 잡힌다. 맞는 고르기가 판마다 섞인다.
 * 3단계(4×5, 5×4, 5×5, 토끼): 고르기는 2단계와 같다. 칸 수가 홀수인 5×5도 색 이야기는 그대로다.
 * 4단계(여우): 모두 여우가 잘 쫓으면 잡는 판이다. 1번 판은 4×4에서 3번이면 잡는 판(5번까지 움직일 수 있다), 뒤로 갈수록 꼭 맞게 쫓아야 하는 판이다.
 *   컴퓨터 토끼가 먼저 움직일지 고르면 늘 맞는 쪽을 고르므로, 먼저 움직이는 쪽은 판이 정한다.
 * 5단계(도전): 판을 보고 누가 이길지 짐작한 뒤 짐작한 쪽이 되어 해 본다. 여우가 이기는 판과 토끼가 이기는 판이 넷씩 섞인다.
 * 6단계: 직접 만들기. 판의 크기, 여우와 토끼의 자리, 먼저 움직일 쪽을 정하면 선생님이 둘 다 잘 하면 누가 이기는지, 여우가 몇 번 만에 잡는지 알려 준다.
 */
export const LADDER = [
  {
    level: 1,
    tag: 'basic',
    mode: 'rabbit',
    hint: 'rabbit',
    small: [3, 3, [0, 0], [2, 2], 'fox'],
    boards: [
      [4, 4, [0, 0], [3, 3], 'fox'],
      [4, 4, [0, 3], [2, 0], 'rabbit'],
      [4, 4, [0, 0], [2, 1], 'fox'],
      [4, 4, [3, 0], [0, 2], 'rabbit'],
      [4, 4, [3, 3], [1, 1], 'rabbit'],
      [4, 4, [1, 1], [2, 2], 'fox'],
      [4, 4, [0, 3], [3, 1], 'fox'],
      [4, 4, [2, 3], [1, 0], 'fox'],
    ],
  },
  {
    level: 2,
    tag: 'basic',
    mode: 'choose',
    hint: 'choose',
    small: [3, 3, [0, 0], [2, 2], null],
    boards: [
      [4, 4, [0, 0], [3, 3], null],
      [4, 4, [0, 0], [3, 2], null],
      [4, 4, [3, 0], [0, 2], null],
      [4, 4, [1, 1], [3, 3], null],
      [4, 4, [0, 3], [2, 0], null],
      [4, 4, [1, 0], [2, 3], null],
      [4, 4, [3, 3], [0, 0], null],
      [4, 4, [2, 1], [0, 2], null],
    ],
  },
  {
    level: 3,
    tag: 'applied',
    mode: 'choose',
    hint: 'big',
    small: [4, 4, [0, 0], [3, 3], null],
    boards: [
      [4, 5, [0, 0], [3, 4], null],
      [5, 4, [0, 0], [4, 2], null],
      [5, 5, [0, 0], [4, 4], null],
      [4, 5, [3, 0], [0, 2], null],
      [5, 5, [0, 0], [4, 3], null],
      [5, 4, [4, 3], [1, 0], null],
      [5, 5, [2, 2], [4, 0], null],
      [5, 5, [0, 4], [3, 0], null],
    ],
  },
  {
    level: 4,
    tag: 'applied',
    mode: 'fox',
    hint: 'fox',
    small: [3, 3, [0, 0], [2, 1], 'fox'],
    boards: [
      [4, 4, [1, 1], [3, 2], 'fox'],
      [4, 4, [1, 0], [2, 2], 'fox'],
      [4, 4, [3, 3], [1, 1], 'rabbit'],
      [4, 5, [0, 0], [3, 2], 'fox'],
      [4, 4, [0, 0], [2, 3], 'fox'],
      [5, 4, [0, 0], [4, 1], 'fox'],
      [5, 5, [0, 0], [3, 4], 'fox'],
      [5, 5, [4, 4], [1, 1], 'rabbit'],
    ],
  },
  {
    level: 5,
    tag: 'challenge',
    mode: 'predict',
    hint: 'predict',
    small: [4, 4, [0, 0], [2, 2], 'fox'],
    boards: [
      [4, 4, [0, 0], [2, 2], 'fox'],
      [4, 4, [0, 1], [3, 3], 'fox'],
      [4, 5, [0, 0], [2, 3], 'rabbit'],
      [5, 5, [1, 1], [3, 3], 'rabbit'],
      [4, 4, [3, 0], [0, 1], 'rabbit'],
      [5, 4, [0, 3], [4, 0], 'rabbit'],
      [5, 5, [2, 0], [2, 4], 'fox'],
      [4, 5, [3, 4], [0, 1], 'rabbit'],
    ],
  },
  { level: 6, tag: 'challenge', mode: 'make', hint: 'made' },
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
export const boardOf = ([w, h, [fx, fy], [rx, ry], first]) => ({ w, h, fox: fy * w + fx, rabbit: ry * w + rx, first });

/** 판의 풀이: 여우가 먼저일 때와 토끼가 먼저일 때 누가 이기고, 여우가 몇 번 만에 잡는가 */
export function solutionOf(board) {
  const { same, limit, foxFirst, rabbitFirst, fox, rabbit, winner } = solve(board);
  return { possible: true, same, limit, foxFirst, rabbitFirst, fox, rabbit, winner };
}

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
