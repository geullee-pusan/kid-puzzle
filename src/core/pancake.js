// 팬케이크 뒤집기의 판과 풀이 프로그램. 순수 함수만 둔다.
//
// 판(board): { stack, up }
//   stack  위에서부터 아래로 놓인 팬케이크의 크기(1이 가장 작다). 크기 1부터 n까지가 한 번씩 있다
//   up     탄 면 팬케이크의 판이면 자리마다 탄 면이 위를 보는가(1) 아래를 보는가(0). 탄 면이 없는 판이면 null
// 뒤집기 k: 뒤집개를 위에서 k번째 팬케이크 아래에 넣어 위의 k장을 한꺼번에 뒤집는다.
//   k장의 차례가 거꾸로 되고, 탄 면 팬케이크는 그 k장의 위아래도 바뀐다.
// 다 됐다: 위에서부터 1, 2, …, n(가장 큰 것이 맨 아래)이고, 탄 면 팬케이크는 탄 면이 모두 아래를 본다.
//
// 풀이 프로그램: 다 된 모습에서 거꾸로 너비 우선 탐색을 한 번 하여, 같은 장 수의 모든 더미에 대해 가장 적은 뒤집기 횟수를 적어 둔다.
// 뒤집기는 두 번 하면 제자리로 돌아오므로, 다 된 모습에서 어떤 더미까지의 횟수는 그 더미에서 다 된 모습까지의 횟수와 같다.
// 탄 면이 없는 판은 8장(40,320가지), 탄 면 판은 6장(46,080가지)까지 따진다.

/** 판의 크기: 장 수의 아래 끝과 위 끝 */
export const MIN_SIZE = 2;
export const MAX_SIZE = 8;
/** 탄 면 팬케이크의 판은 6장까지 */
export const MAX_BURNT = 6;

/** 판이 맞는 값인가. 맞으면 null, 아니면 까닭 */
export function checkBoard(board) {
  if (!board || typeof board !== 'object') return 'no-board';
  const { stack, up } = board;
  if (!Array.isArray(stack)) return 'no-stack';
  const n = stack.length;
  if (n < MIN_SIZE || n > MAX_SIZE) return 'size';
  const seen = new Set(stack);
  if (seen.size !== n || !stack.every((size) => Number.isInteger(size) && size >= 1 && size <= n)) return 'sizes';
  if (up === null) return null;
  if (!Array.isArray(up) || up.length !== n || !up.every((side) => side === 0 || side === 1)) return 'up';
  if (n > MAX_BURNT) return 'burnt-size';
  return null;
}

export const copyBoard = (board) => ({ stack: board.stack.slice(), up: board.up === null ? null : board.up.slice() });
export const isBurnt = (board) => board.up !== null;
export const sameBoard = (a, b) => JSON.stringify(copyBoard(a)) === JSON.stringify(copyBoard(b));

/** 뒤집개를 넣을 수 있는 자리(k)의 범위. 탄 면이 없는 판에서 맨 위 한 장만 뒤집는 것(k = 1)은 아무것도 바꾸지 않는다 */
export const lowestFlip = (board) => (isBurnt(board) ? 1 : 2);

/** 위의 k장을 뒤집은 판(새 값) */
export function flip(board, k) {
  const stack = board.stack.slice(0, k).reverse().concat(board.stack.slice(k));
  if (board.up === null) return { stack, up: null };
  const up = board.up
    .slice(0, k)
    .reverse()
    .map((side) => 1 - side)
    .concat(board.up.slice(k));
  return { stack, up };
}

/** 크기 차례대로 쌓였는가(탄 면은 보지 않는다) */
export const inOrder = (board) => board.stack.every((size, index) => size === index + 1);
/** 다 됐는가: 크기 차례대로이고, 탄 면 팬케이크는 탄 면이 모두 아래를 본다 */
export const isDone = (board) => inOrder(board) && (board.up === null || board.up.every((side) => side === 0));
/** 탄 면이 위를 보는 팬케이크의 수 */
export const upCount = (board) => (board.up === null ? 0 : board.up.reduce((sum, side) => sum + side, 0));

/** 다 된 판(n장) */
export function doneBoard(n, burnt = false) {
  return { stack: Array.from({ length: n }, (_, index) => index + 1), up: burnt ? new Array(n).fill(0) : null };
}

/** 뒤집기를 차례대로 해 본 판. 뒤집기 값이 맞지 않으면 null */
export function replay(board, flips) {
  if (!Array.isArray(flips)) return null;
  let now = copyBoard(board);
  for (const k of flips) {
    if (!Number.isInteger(k) || k < 1 || k > now.stack.length) return null;
    now = flip(now, k);
  }
  return now;
}

// ---- 더미의 번호: 순열의 차례 번호(작은 차례부터)와 탄 면의 위아래 ----

const FACT = [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880];

/** 더미의 번호(0부터). 탄 면 판은 순열의 번호 × 2^n + 탄 면의 위아래 */
export function rankOf(board) {
  const { stack } = board;
  const n = stack.length;
  let rank = 0;
  for (let i = 0; i < n; i++) {
    let smaller = 0;
    for (let j = i + 1; j < n; j++) if (stack[j] < stack[i]) smaller += 1;
    rank += smaller * FACT[n - 1 - i];
  }
  if (board.up === null) return rank;
  let mask = 0;
  for (let i = 0; i < n; i++) mask = mask * 2 + board.up[i];
  return rank * 2 ** n + mask;
}

/** 번호에서 더미로 */
export function boardOfRank(n, burnt, rank) {
  let perm = rank;
  let mask = 0;
  if (burnt) {
    mask = rank % 2 ** n;
    perm = Math.floor(rank / 2 ** n);
  }
  const left = Array.from({ length: n }, (_, index) => index + 1);
  const stack = [];
  for (let i = 0; i < n; i++) {
    const unit = FACT[n - 1 - i];
    const at = Math.floor(perm / unit);
    perm %= unit;
    stack.push(left.splice(at, 1)[0]);
  }
  if (!burnt) return { stack, up: null };
  const up = [];
  for (let i = n - 1; i >= 0; i--) {
    up[i] = mask % 2;
    mask = Math.floor(mask / 2);
  }
  return { stack, up };
}

/** 더미의 가짓수 */
export const stateCount = (n, burnt) => FACT[n] * (burnt ? 2 ** n : 1);

// ---- 풀이 프로그램: 다 된 모습에서 거꾸로 너비 우선 탐색 ----

const tables = new Map();

/**
 * n장 더미 모두의 가장 적은 뒤집기 횟수(한 번 만든 표는 적어 둔다).
 * @returns {Uint8Array} 번호 → 횟수
 */
export function fewestTable(n, burnt = false) {
  const key = `${n}:${burnt ? 1 : 0}`;
  if (tables.has(key)) return tables.get(key);
  const total = stateCount(n, burnt);
  const dist = new Uint8Array(total).fill(255);
  const queue = new Int32Array(total);
  const start = rankOf(doneBoard(n, burnt));
  dist[start] = 0;
  queue[0] = start;
  let head = 0;
  let tail = 1;
  const low = burnt ? 1 : 2;
  while (head < tail) {
    const rank = queue[head++];
    const board = boardOfRank(n, burnt, rank);
    const next = dist[rank] + 1;
    for (let k = low; k <= n; k++) {
      const other = rankOf(flip(board, k));
      if (dist[other] !== 255) continue;
      dist[other] = next;
      queue[tail++] = other;
    }
  }
  tables.set(key, dist);
  return dist;
}

/** 이 더미의 가장 적은 뒤집기 횟수 */
export const fewestOf = (board) => fewestTable(board.stack.length, isBurnt(board))[rankOf(board)];

/**
 * 풀이: 가장 적은 횟수와 그렇게 뒤집는 한 가지 방법(뒤집기 k의 차례). 늘 다 될 수 있다.
 * 같은 판에는 늘 같은 방법을 낸다(작은 k부터 본다).
 */
export function solve(board) {
  const n = board.stack.length;
  const table = fewestTable(n, isBurnt(board));
  const fewest = table[rankOf(board)];
  const path = [];
  let now = copyBoard(board);
  for (let left = fewest; left > 0; left--) {
    for (let k = lowestFlip(board); k <= n; k++) {
      const next = flip(now, k);
      if (table[rankOf(next)] === left - 1) {
        path.push(k);
        now = next;
        break;
      }
    }
  }
  return { possible: true, fewest, path };
}

/** n장 더미 가운데 가장 많이 뒤집어야 하는 횟수와, 횟수마다 더미의 수 */
export function worstOf(n, burnt = false) {
  const table = fewestTable(n, burnt);
  const counts = [];
  for (const value of table) counts[value] = (counts[value] ?? 0) + 1;
  return { worst: counts.length - 1, counts: Array.from(counts, (value) => value ?? 0) };
}

/**
 * 장 수마다 가장 많이 뒤집어야 하는 횟수("왜 그럴까?"의 표). 탄 면이 없는 더미를 모두 따진다.
 *   fewest  가장 적게 뒤집어도 이만큼은 걸리는 더미가 있다(모든 더미의 가장 적은 횟수 가운데 가장 큰 것)
 *   method  큰 것부터 보내기로 하면 많아야 이만큼 걸린다(모든 더미에서 큰 것부터 보내기로 뒤집은 횟수 가운데 가장 큰 것)
 */
export function worstTable(sizes) {
  return sizes.map((n) => {
    let method = 0;
    for (let rank = 0; rank < stateCount(n, false); rank++) method = Math.max(method, biggestFirst(boardOfRank(n, false, rank)).length);
    return { n, fewest: worstOf(n).worst, method };
  });
}

/**
 * 큰 것부터 보내기(탄 면이 없는 판): 아직 제자리가 아닌 가장 큰 팬케이크를 맨 위로 올리고(맨 위에 있으면 그대로),
 * 그 팬케이크가 들어갈 자리까지 통째로 뒤집어 보낸다. 한 장에 많아야 두 번이다.
 * @returns {number[]} 뒤집기 k의 차례
 */
export function biggestFirst(board) {
  const flips = [];
  let now = copyBoard(board);
  for (let size = now.stack.length; size >= 2; size--) {
    const at = now.stack.indexOf(size);
    if (at === size - 1) continue;
    if (at > 0) {
      flips.push(at + 1);
      now = flip(now, at + 1);
    }
    flips.push(size);
    now = flip(now, size);
  }
  return flips;
}
