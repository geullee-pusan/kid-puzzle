// 원판 둘씩 옮기기의 판과 풀이. 순수 함수만 둔다.
// 판: { n: 칸 수(4~8), piles: 칸마다 원판의 수 } 칸은 둥글게 놓여 있고, 0번 칸(맨 위)에서 시계 방향으로 센다.
//   칸 i의 옆 칸은 i - 1과 i + 1이다(0번 칸과 n - 1번 칸도 옆 칸이다).
// 한 번 옮기기: 원판 두 개를 골라 저마다 옆 칸 하나로 옮긴다. 두 원판은 같은 칸에서 골라도 되고, 저마다 어느 쪽으로 가도 된다.
//   한 원판을 두 번 옮길 수는 없다. 그래서 둘째 원판은 첫째 원판이 막 들어간 원판이 아닌 것이어야 한다.
// 물음: 원판을 모두 한 칸에 모을 수 있을까.
//
// 화면에서는 원판을 하나씩 옮긴다(한 걸음). 걸음 두 개가 한 번이다. 걸음은 [나간 칸, 들어간 칸]으로 적는다.
//
// 풀이: 칸 수와 원판 수가 같은 모든 모습을 차례로 따지는 너비 우선 탐색. 옮기기는 거꾸로 해도 옮기기라서(두 원판을 저마다 왔던 칸으로)
//   모두 한 칸에 모인 모습들에서 거꾸로 퍼져 나가면, 모습마다 가장 적게 몇 번 옮기면 모이는지가 한 번에 나온다.
//   (칸 수, 원판 수)마다 한 번만 따지고 적어 둔다. 원판은 모두 10개까지라서 가장 많아도 모습이 2만 가지쯤이다.
// 바뀌지 않는 것: 칸에 0번부터 번갈아 동그라미와 네모를 그린다(짝수 번째 칸이 동그라미 칸). 원판 하나가 옆 칸으로 가면
//   칸 수가 짝수인 고리에서는 늘 다른 모양의 칸으로 간다. 그래서 두 원판을 옮기면 동그라미 칸의 원판은 2개 늘거나 줄거나 그대로이고,
//   그 수의 홀짝은 바뀌지 않는다. 원판이 짝수 개면 한 칸에 모은 모습은 동그라미 칸에 모두 있거나 하나도 없어서 짝수다.
//   그래서 칸 수와 원판 수가 짝수인데 동그라미 칸의 원판이 홀수 개인 판은 안 된다. 그 밖의 판은 늘 된다
//   (칸 4~8개, 원판 10개까지 모두. 테스트가 다른 방법으로 모두 따져 확인한다).
//   칸 수가 홀수인 고리는 n - 1번 칸과 0번 칸이 둘 다 동그라미 칸이라서, 그 사이를 지나면 동그라미 칸의 원판이 1개만 바뀐다.

/** 칸 수, 원판 수의 범위 */
export const MIN_CELLS = 4;
export const MAX_CELLS = 8;
export const MIN_TOTAL = 2;
export const MAX_TOTAL = 10;

const count = (value) => Number.isInteger(value) && value >= 0;

export const totalOf = (piles) => piles.reduce((sum, value) => sum + value, 0);

/** 판이 규격에 맞는가. 맞으면 null, 아니면 까닭 */
export function checkBoard(board) {
  if (!board || typeof board !== 'object') return 'no-board';
  const { n, piles } = board;
  if (!Number.isInteger(n) || n < MIN_CELLS || n > MAX_CELLS) return 'size';
  if (!Array.isArray(piles) || piles.length !== n || !piles.every(count)) return 'piles';
  const total = totalOf(piles);
  if (total < MIN_TOTAL || total > MAX_TOTAL) return 'total';
  return null;
}

export function copyBoard(board) {
  return { n: board.n, piles: board.piles.slice() };
}

/** 판을 한 줄의 글로(같은 판인지 견주고, 적어 둘 때 쓴다) */
export function boardKey(board) {
  return `${board.n}:${board.piles.join(',')}`;
}

export const sameBoard = (a, b) => boardKey(a) === boardKey(b);

/** 칸의 옆 칸 둘(시계 반대 방향, 시계 방향) */
export const sidesOf = (n, cell) => [(cell + n - 1) % n, (cell + 1) % n];
export const isSide = (n, a, b) => a !== b && sidesOf(n, a).includes(b);

/** 원판이 모두 한 칸에 있는가(원판이 있는 칸이 하나뿐) */
export const isGathered = (piles) => piles.filter((value) => value > 0).length <= 1;

/** 동그라미 칸(0번부터 짝수 번째 칸)인가 */
export const isCircle = (cell) => cell % 2 === 0;

/** 동그라미 칸과 네모 칸의 원판 수 */
export function shapeCounts(piles) {
  let circle = 0;
  let square = 0;
  piles.forEach((value, cell) => {
    if (isCircle(cell)) circle += value;
    else square += value;
  });
  return { circle, square };
}

// ---- 걸음과 옮기기 ----

/** 걸음 하나가 판의 걸음 모양인가 */
const stepShape = (n, step) => Array.isArray(step) && step.length === 2 && step.every((cell) => Number.isInteger(cell) && cell >= 0 && cell < n);

/**
 * 처음 모습에서 걸음들을 차례로 한 모습.
 * @returns {{ok: boolean, piles: number[], pending: number[]|null, moves: number}}
 *   pending: 한 번의 첫째 걸음만 한 때 그 걸음(둘째 원판을 아직 안 옮겼다). moves: 끝난 옮기기의 수
 *   ok가 거짓이면 옮길 수 없는 걸음이 있었다(piles는 그 앞까지의 모습)
 */
export function replay(board, trail) {
  const piles = board.piles.slice();
  if (!Array.isArray(trail)) return { ok: false, piles, pending: null, moves: 0 };
  let pending = null;
  let moves = 0;
  for (const step of trail) {
    if (!stepShape(board.n, step) || !canStep(board.n, piles, pending, step[0]) || !isSide(board.n, step[0], step[1])) return { ok: false, piles, pending, moves };
    piles[step[0]] -= 1;
    piles[step[1]] += 1;
    if (pending) {
      pending = null;
      moves += 1;
    } else pending = step.slice();
  }
  return { ok: true, piles, pending, moves };
}

/** 그 칸에 이번에 옮길 수 있는 원판의 수(첫째 걸음으로 막 들어간 원판은 다시 옮길 수 없다) */
export function freeIn(piles, pending, cell) {
  return piles[cell] - (pending && pending[1] === cell ? 1 : 0);
}

/** 그 칸에서 원판 하나를 옮길 수 있는가 */
export const canStep = (n, piles, pending, cell) => cell >= 0 && cell < n && freeIn(piles, pending, cell) > 0;

// ---- 모습을 수 하나로 ----

const BASE = MAX_TOTAL + 1;

function encode(piles) {
  let code = 0;
  for (let cell = piles.length - 1; cell >= 0; cell--) code = code * BASE + piles[cell];
  return code;
}

function decode(code, n) {
  const piles = [];
  let rest = code;
  for (let cell = 0; cell < n; cell++) {
    piles.push(rest % BASE);
    rest = Math.floor(rest / BASE);
  }
  return piles;
}

/**
 * 한 번 옮기기로 갈 수 있는 모습마다 그 옮기기(걸음 둘)를 낸다.
 * 두 원판은 칸 i ≤ j에서 고른다(i = j면 원판이 둘 있어야 한다). 같은 모습이 여러 번 나올 수 있다.
 */
export function nextOf(n, piles) {
  const out = [];
  for (let i = 0; i < n; i++) {
    if (piles[i] === 0) continue;
    for (let j = i; j < n; j++) {
      if (piles[j] === 0 || (i === j && piles[i] < 2)) continue;
      for (const a of sidesOf(n, i)) {
        for (const b of sidesOf(n, j)) {
          const next = piles.slice();
          next[i] -= 1;
          next[a] += 1;
          next[j] -= 1;
          next[b] += 1;
          out.push({ piles: next, steps: [[i, a], [j, b]] });
        }
      }
    }
  }
  return out;
}

/** (칸 수, 원판 수)마다 모습 → 모일 때까지 가장 적은 옮기기 수. 모일 수 없는 모습은 없다 */
const tables = new Map();

export function tableOf(n, total) {
  const key = `${n}:${total}`;
  if (tables.has(key)) return tables.get(key);
  const dist = new Map();
  let layer = [];
  for (let cell = 0; cell < n; cell++) {
    const piles = Array(n).fill(0);
    piles[cell] = total;
    const code = encode(piles);
    dist.set(code, 0);
    layer.push(code);
  }
  for (let depth = 1; layer.length > 0; depth++) {
    const next = [];
    for (const code of layer) {
      for (const item of nextOf(n, decode(code, n))) {
        const to = encode(item.piles);
        if (dist.has(to)) continue;
        dist.set(to, depth);
        next.push(to);
      }
    }
    layer = next;
  }
  tables.set(key, dist);
  return dist;
}

/** 가장 적게 옮겨 모이는 수. 모일 수 없으면 null */
export function minMoves(board) {
  const value = tableOf(board.n, totalOf(board.piles)).get(encode(board.piles));
  return value === undefined ? null : value;
}

/**
 * 판을 푼다.
 * @returns {{possible: boolean, min: number|null, steps: number[][], circle: number, square: number, total: number}}
 *   steps 가장 적게 옮기는 한 가지 방법(걸음 둘이 한 번). 안 되는 판이면 빈 목록
 *   circle, square 처음 모습의 동그라미 칸과 네모 칸의 원판 수(안 되는 판의 까닭으로 보인다)
 */
export function solve(board) {
  const { n } = board;
  const total = totalOf(board.piles);
  const table = tableOf(n, total);
  const { circle, square } = shapeCounts(board.piles);
  const min = minMoves(board);
  if (min === null) return { possible: false, min: null, steps: [], circle, square, total };
  const steps = [];
  let piles = board.piles.slice();
  for (let left = min; left > 0; left--) {
    // 하나 더 가까운 모습 가운데 처음 나오는 것으로 간다(늘 같은 길이 나온다)
    const item = nextOf(n, piles).find((next) => table.get(encode(next.piles)) === left - 1);
    steps.push(...item.steps);
    piles = item.piles;
  }
  return { possible: true, min, steps, circle, square, total };
}

/** 칸 수와 원판 수가 짝수이고 동그라미 칸의 원판이 홀수 개인가(바뀌지 않는 것으로 보이는 안 되는 판) */
export function oddCircle(board) {
  return board.n % 2 === 0 && totalOf(board.piles) % 2 === 0 && shapeCounts(board.piles).circle % 2 === 1;
}
