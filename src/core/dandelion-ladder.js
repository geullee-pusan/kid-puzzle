// 민들레와 바람의 사다리(단계)와 판 내기. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 풀이 프로그램으로 푼 판만 내보낸다:
// 게임 판에는 "잘 두었을 때 어느 쪽이 이기는지"가, 혼자 덮기 판에는 "가장 적게 몇 송이로 덮는지"가 붙어 있다.
import { checkBoard, solve, solveCover } from './dandelion.js';

/**
 * 사다리.
 *   tag    'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode   'game'(선생님과 두기) | 'cover'(혼자 덮기) | 'make'(아이가 직접 정한다)
 *   role   아이가 서는 쪽: 'flower'(꽃) | 'wind'(바람) | 'choose'(두기 전에 고른다)
 *   hint   힌트와 처음 화면의 물음을 고르는 이름
 *   boards 판의 차례([가로, 세로, 방향의 수] 또는 혼자 덮기는 [가로, 세로, 방향의 수, 바람의 차례]). 판 번호가 달라지면 차례로 돈다
 *   first  판 번호 1에 내는 판(없으면 차례의 첫 판)
 *   small  수준 맞추기가 "작은 판부터"라고 할 때 내는 판
 *
 * 1단계: 아이가 꽃이다. 네 방향의 작은 판은 모두 잘 두면 꽃이 이긴다(풀이 프로그램). 3×3은 아무렇게나 심으면 열에 넷쯤 진다.
 *   맨 처음 판(판 번호 1)은 2×2다. 바람이 네 번 부는 동안 꽃을 네 번 심을 수 있어서 어떻게 심어도 다 덮인다(실패할 수 없는 첫 판).
 * 2단계: 아이가 바람이다. 가로나 세로가 5칸이 되면 네 방향에서는 잘 두면 바람이 이긴다(5×3, 5×4).
 * 3단계: 두기 전에 꽃이 될지 바람이 될지 고른다. 꽃이 이기는 판(3×3, 4×3, 4×4)과 바람이 이기는 판(5×3, 5×4)이 섞인다.
 * 4단계: 여덟 방향이 섞인다. 여덟 방향에서는 4×4까지 늘 꽃이 이긴다. 네 방향의 4×4는 꽃이 이기지만 아무렇게나 심으면 거의 진다.
 * 5단계: 혼자 덮기. 바람의 차례가 정해져 있다. 꽃을 가장 적게 심어 판을 다 덮는다(가장 좋은 기록을 남기는 판).
 * 6단계: 직접 만들기. 판의 크기와 방향의 수를 정하면, 선생님이 잘 두었을 때 누가 이기는지 알려 준다.
 */
export const LADDER = [
  { level: 1, tag: 'basic', mode: 'game', role: 'flower', hint: 'flower', first: [2, 2, 4], small: [3, 2, 4], boards: [[3, 3, 4], [4, 2, 4], [3, 3, 4], [2, 3, 4], [3, 4, 4], [3, 3, 4], [4, 3, 4], [2, 4, 4]] },
  { level: 2, tag: 'applied', mode: 'game', role: 'wind', hint: 'wind', small: [5, 3, 4], boards: [[5, 3, 4], [3, 5, 4], [5, 4, 4], [4, 5, 4]] },
  { level: 3, tag: 'applied', mode: 'game', role: 'choose', hint: 'choose', small: [3, 3, 4], boards: [[4, 3, 4], [5, 3, 4], [3, 5, 4], [3, 3, 4], [4, 4, 4], [5, 4, 4], [3, 4, 4], [4, 5, 4], [5, 3, 4], [4, 4, 4]] },
  { level: 4, tag: 'challenge', mode: 'game', role: 'choose', hint: 'choose', small: [4, 4, 4], boards: [[4, 4, 8], [5, 4, 4], [4, 4, 4], [3, 3, 8], [5, 3, 4], [4, 3, 8], [4, 5, 4], [3, 4, 8]] },
  {
    level: 5,
    tag: 'applied',
    mode: 'cover',
    role: null,
    hint: 'cover',
    small: [3, 3, 4, [1, 2, 3, 0]],
    boards: [
      [3, 3, 4, [1, 2, 3, 0]],
      [4, 3, 4, [0, 1, 2, 3]],
      [4, 4, 4, [1, 2, 3, 0]],
      [5, 3, 4, [0, 1, 2, 3]],
      [4, 3, 4, [1, 3, 2, 0]],
      [4, 4, 8, [1, 5, 2, 6, 3, 7, 0, 4]],
      [5, 4, 4, [2, 1, 0, 3]],
    ],
  },
  { level: 6, tag: 'challenge', mode: 'make', role: 'choose', hint: 'choose' },
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
export function boardOf(entry, mode) {
  const [w, h, dirs, order] = entry;
  return mode === 'cover' ? { kind: 'cover', w, h, dirs, order: order.slice() } : { kind: 'game', w, h, dirs };
}

/** 판의 풀이: 게임은 이기는 쪽, 혼자 덮기는 가장 적은 꽃의 수 */
export function solutionOf(board) {
  if (board.kind === 'cover') {
    const { possible, best, plan, tries } = solveCover(board);
    return { possible, best, plan, tries };
  }
  const { winner, positions } = solve(board);
  return { possible: true, winner, positions };
}

/**
 * 판 하나를 낸다.
 * @param {number} level 1~5
 * @param {number} seed 판 번호(1부터)
 * @param {{small?: boolean}} options small: 그 단계의 작은 판을 낸다(수준 맞추기에서 쓴다)
 */
export function generateBoard(level, seed, { small = false } = {}) {
  const rung = rungOf(level);
  if (rung.mode === 'make') throw new Error('직접 만들기 단계는 판을 내지 않아요');
  let entry;
  if (small) entry = rung.small;
  else if (seed === 1 && rung.first) entry = rung.first;
  else {
    const count = rung.boards.length;
    // 판 번호 1에 정해 둔 판이 있으면 2부터 차례의 처음이다.
    const at = seed - (rung.first ? 2 : 1);
    entry = rung.boards[((at % count) + count) % count];
  }
  const board = boardOf(entry, rung.mode);
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
