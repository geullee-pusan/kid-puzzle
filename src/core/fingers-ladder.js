// 손가락 더하기의 사다리(단계)와 판 내기, 더 작은 판. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 풀이 프로그램으로 푼 판만 내보낸다:
// 판마다 "아이가 먼저 칠 때와 나중에 칠 때, 둘 다 잘 치면 어떻게 끝나는가"가 붙어 있다(자리가 수백 개라 모두 따진다).
import { BASE_LIMIT, LIMITS, START, checkBoard, copyBoard, isStart, moveValues, pickMove, replay, solve } from './fingers.js';
import { createRng, seedFrom } from './rng.js';

/**
 * 사다리.
 *   tag     'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode    'game'(선생님과 번갈아 치기) | 'make'(직접 만들기)
 *   teacher 선생님이 치는 법(src/core/fingers.js의 pickMove)
 *   hint    힌트와 처음 화면의 물음을 고르는 이름
 *   boards  판의 차례([빠지는 수, 다시 도는 규칙인가, 내 두 손, 선생님 두 손, 먼저 치는 쪽]). 판 번호가 달라지면 차례로 돈다
 *   small   수준 맞추기가 "작은 판부터"라고 할 때 내는 판
 *
 * 1단계 손가락 더하기: 다섯이 되면 빠지는 보통 판, 선생님이 먼저 친다. 선생님은 아무렇게나 친다(내 두 손을 한 번에 다 뺄 수 있을 때만 뺀다).
 *   둘 다 잘 치면 먼저 치는 쪽이 진다. 그래서 아이가 잘 치면 이기는 자리다(풀이 프로그램과 테스트가 확인한다).
 *   판 번호가 달라도 판은 같고, 선생님이 치는 수가 달라진다.
 * 2단계 선생님이 잘 치는 판: 같은 판이다. 선생님은 이길 수 있는 자리가 되면 끝까지 잘 치고, 아니면 바로 지지 않는 수만 친다.
 * 3단계 몇 번만 남은 판: 손가락이 많이 펴진 판에서 아이 차례로 시작한다. 선생님은 잘 친다.
 *   판마다 아이가 잘 치면 이기는데, 이기는 수는 한 가지뿐이다(한 번에 손을 뺄 수 있는 수가 둘이고 그 가운데 하나만 이긴다).
 * 4단계 다섯에서 다시 도는 판: 꼭 다섯이 되면 빠지고 넘으면 넘은 만큼만 남는다. 아이가 먼저 친다. 선생님은 2단계와 같다.
 *   둘 다 잘 치면 끝나지 않는다(같은 모습이 다시 나와 비긴다). 선생님이 지는 자리로 가면 아이가 이길 수 있다.
 * 5단계 먼저 칠까, 나중에 칠까?: 빠지는 수(넷, 다섯, 여섯)와 처음 손가락이 판마다 다르다. 치기 전에 고른다. 선생님은 잘 친다.
 *   먼저 쳐야 이기는 판이 넷, 나중에 쳐야 이기는 판이 넷이다.
 * 6단계 직접 만들기: 빠지는 수, 규칙, 네 손의 손가락, 먼저 칠 사람을 정하면 둘 다 잘 치면 어떻게 끝나는지 알려 준다.
 */
export const LADDER = [
  {
    level: 1,
    tag: 'basic',
    mode: 'game',
    teacher: 'easy',
    hint: 'first',
    small: [4, false, [1, 1], [1, 1], 'kid'],
    boards: [[5, false, [1, 1], [1, 1], 'teacher']],
  },
  {
    level: 2,
    tag: 'basic',
    mode: 'game',
    teacher: 'fair',
    hint: 'fair',
    small: [4, false, [1, 1], [1, 1], 'kid'],
    boards: [[5, false, [1, 1], [1, 1], 'teacher']],
  },
  {
    level: 3,
    tag: 'applied',
    mode: 'game',
    teacher: 'best',
    hint: 'left',
    small: [5, false, [4, 2], [1, 4], 'kid'],
    boards: [
      [5, false, [4, 3], [1, 3], 'kid'],
      [5, false, [1, 4], [1, 3], 'kid'],
      [5, false, [3, 2], [3, 2], 'kid'],
      [5, false, [4, 1], [3, 2], 'kid'],
      [5, false, [2, 4], [1, 4], 'kid'],
      [5, false, [1, 4], [3, 1], 'kid'],
      [5, false, [2, 3], [2, 3], 'kid'],
      [5, false, [4, 1], [2, 3], 'kid'],
    ],
  },
  {
    level: 4,
    tag: 'applied',
    mode: 'game',
    teacher: 'fair',
    hint: 'wrap',
    small: [4, true, [1, 1], [1, 1], 'kid'],
    boards: [[5, true, [1, 1], [1, 1], 'kid']],
  },
  {
    level: 5,
    tag: 'challenge',
    mode: 'game',
    teacher: 'best',
    hint: 'choose',
    small: [4, false, [1, 1], [1, 1], null],
    boards: [
      [5, false, [1, 1], [1, 1], null],
      [4, false, [1, 1], [1, 1], null],
      [5, false, [1, 2], [1, 2], null],
      [6, false, [1, 1], [1, 1], null],
      [5, false, [2, 2], [2, 2], null],
      [6, false, [1, 2], [1, 1], null],
      [5, false, [1, 3], [1, 3], null],
      [6, false, [2, 2], [1, 2], null],
    ],
  },
  { level: 6, tag: 'challenge', mode: 'make', teacher: 'best', hint: 'made' },
];

/** 판을 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

/** 이 단계에서 선생님이 치는 법. 직접 만든 판은 잘 친다 */
export const teacherOf = (level, custom) => (custom ? 'best' : (LADDER.find((item) => item.level === level)?.teacher ?? 'best'));

/** 차례에 적은 값을 판으로 */
export const boardOf = ([limit, wrap, kid, teacher, first]) => ({ limit, wrap, kid: [...kid], teacher: [...teacher], first });

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

/**
 * 다음 판 번호. 판이 한 가지뿐인 단계(1, 2, 4단계)는 번호만 하나 늘린다(선생님이 치는 수가 달라진다).
 * 판이 여럿인 단계는 방금 한 판과 똑같은 판이 나오는 번호를 건너뛴다.
 */
export function nextSeed(level, seed, options = {}) {
  const rung = rungOf(level);
  if (rung.mode === 'make' || rung.boards.length === 1 || options.small) return seed + 1;
  const now = JSON.stringify(generateBoard(level, seed, options).board);
  for (let next = seed + 1; next < seed + 40; next++) {
    if (JSON.stringify(generateBoard(level, next, options).board) !== now) return next;
  }
  return seed + 1;
}

// ---- 더 작은 판: 틀의 "더 작은 판으로"가 이 목록을 차례로 낸다(src/core/smaller.js) ----

/**
 * 판의 종류: 'choose'(먼저 칠지 고르는 판) | 'start-kid' | 'start-teacher'(손가락 하나씩에서 그쪽이 먼저)
 *   | 'given-kid' | 'given-teacher'(손가락이 펴진 판에서 그쪽 차례)
 */
export function kindOf(board) {
  if (board.first === null) return 'choose';
  return `${isStart(board) ? 'start' : 'given'}-${board.first}`;
}

/** 몇 번만 남은 판의 작은 판 선반: 아이 차례이고 아이가 잘 치면 이기는 판. 끝까지 남은 칠 수가 많은 것부터 */
export const SMALL_SHELF = [
  [5, false, [4, 3], [1, 3], 'kid'],
  [5, false, [3, 2], [3, 2], 'kid'],
  [5, false, [1, 4], [0, 2], 'kid'],
  [5, false, [1, 3], [0, 2], 'kid'],
];

/** 아이 자리에서 본 끝(아이가 먼저 치면 kid, 나중에 치면 teacher) */
const seatOf = (board) => solve(board)[board.first];

/** 끝까지 남은 칠 수(비기는 판은 끝이 없다) */
const tapsOf = (board) => solve(board).taps[board.first];

/**
 * 같은 규칙으로 빠지는 수가 하나 적은 판(손가락 하나씩에서 시작). 먼저 칠 쪽은 아이 자리에서 본 끝이 원래 판과 같게 고르고,
 * 같은 끝이 없으면 아이가 이기는 쪽으로 고른다. 고르는 판은 고르는 판으로 남는다.
 */
function fewerLimit(board, limit) {
  const base = { limit, wrap: board.wrap, kid: [...START], teacher: [...START], first: null };
  if (board.first === null) return base;
  const want = seatOf(board);
  const seats = ['kid', 'teacher'];
  const same = seats.find((first) => seatOf({ ...base, first }) === want);
  const win = seats.find((first) => seatOf({ ...base, first }) === 'win');
  return { ...base, first: same ?? win };
}

/** 같은 판에서 두 번 더 친 판(한쪽에 하나씩): 칠 차례인 쪽과 판의 종류가 그대로이고 끝에 두 번 더 가깝다. 수는 잘 치는 선생님처럼 고른다 */
function advanced(board) {
  if (board.first === null) return null;
  const rng = createRng(seedFrom('fingers-small', JSON.stringify(board)));
  const trail = [];
  for (let step = 0; step < 2; step++) {
    const move = pickMove(board, trail, board.first, rng, 'best');
    if (!move) return null;
    trail.push(move);
  }
  const now = replay(board, trail, board.first);
  if (!now.ok || now.over) return null;
  const next = { limit: board.limit, wrap: board.wrap, kid: now.kid, teacher: now.teacher, first: board.first };
  // 한 번에 끝나는 판은 내지 않는다
  return moveValues(next, [], next.first).some((item) => item.ends) ? null : next;
}

/**
 * 원래 판보다 작은 판들.
 *   손가락 하나씩에서 시작하는 판과 고르는 판: 같은 규칙으로 빠지는 수가 하나, 둘 적은 판(셋까지)
 *   손가락이 펴진 판에서 아이 차례이고 아이가 이기는 판: 선반에서 끝까지 남은 칠 수가 더 적은 판
 *   그런 판이 없으면 두 번 더 친 판. 그것도 없으면 빈 목록이다.
 */
export function smallBoards(board) {
  const kind = kindOf(board);
  if (kind === 'given-kid' && seatOf(board) === 'win') {
    const taps = tapsOf(board);
    const found = SMALL_SHELF.map(boardOf).filter((small) => small.limit === board.limit && small.wrap === board.wrap && tapsOf(small) < taps);
    if (found.length > 0) return found.map(copyBoard);
  }
  if (kind.startsWith('start') || kind === 'choose') {
    const list = [];
    for (let limit = board.limit - 1; limit >= LIMITS.min; limit--) list.push(fewerLimit(board, limit));
    if (list.length > 0) return list;
  }
  const next = advanced(board);
  return next && checkBoard(next) === null ? [next] : [];
}

/** 보통 판(다섯이 되면 빠진다)인가 */
export const isBase = (board) => board.limit === BASE_LIMIT && !board.wrap;
