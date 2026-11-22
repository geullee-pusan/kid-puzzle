// 번호 말 제자리 찾기의 판과 풀이 프로그램. 순수 함수만 둔다.
//
// 판(board): { kind, w, h, cells }
//   kind 'swap'  맞바꾸기: 말 n개(3~8개)가 한 줄로 놓여 있다(w = n, h = 1). cells는 1부터 n까지가 한 번씩
//   kind 'slide' 밀기: 가로 3칸, 세로 2칸이나 3칸 판에 말과 빈칸 하나. cells는 0부터 w*h − 1까지가 한 번씩이고 0이 빈칸이다
//   cells는 위 줄부터 왼쪽에서 오른쪽으로 적는다.
// 제자리: 맞바꾸기는 1, 2, …, n. 밀기는 1, 2, …, 차례대로이고 빈칸이 맨 아래 오른쪽 구석이다.
// 한 번 움직이기
//   맞바꾸기: 두 말을 골라 자리를 맞바꾼다. [a, b](두 자리의 번호, a < b)
//   밀기: 빈칸과 가로나 세로로 붙은 말 하나를 빈칸으로 민다. 민 말이 있던 자리의 번호
//
// 맞바꾸기의 풀이: 말마다 "제자리(그 말의 번호 자리)로 가는 화살표"를 그으면 화살표가 고리 몇 개로 나뉜다(제자리에 있는 말은 혼자 고리 하나).
//   두 말을 맞바꾸면, 같은 고리의 두 말이면 그 고리가 둘로 갈라지고, 다른 고리의 두 말이면 두 고리가 하나로 합쳐진다. 고리는 하나씩만 늘거나 준다.
//   모두 제자리이면 고리가 n개이므로, 가장 적게 맞바꾸는 횟수는 n − (고리의 수)다. 왼쪽부터 그 자리의 말을 데려오는 방법이 그만큼에 끝난다.
//   (테스트가 모든 줄을 너비 우선 탐색으로 다시 따져 같은 수가 나오는지 본다.)
// 밀기의 풀이: 제자리 모습에서 거꾸로 너비 우선 탐색을 한 번 하여 판의 크기마다 모든 모습의 가장 적은 횟수를 적어 둔다(표). 밀기는 되돌릴 수 있으므로
//   제자리에서 그 모습까지의 횟수가 그 모습에서 제자리까지의 횟수다. 2×3은 720가지 가운데 360가지, 3×3은 362,880가지 가운데 181,440가지에 닿는다.
//   표는 그 크기의 판을 처음 풀 때 한 번만 만든다.
// 바뀌지 않는 것: 판을 위 줄부터 한 줄로 읽으면(빈칸은 건너뛴다) 큰 수가 작은 수보다 앞에 선 짝의 수(뒤바뀐 짝)가 있다.
//   옆으로 밀면 한 줄로 읽은 차례가 그대로이고, 위아래로 밀면 말 하나가 다른 말 둘(가로가 3칸이라서)을 건너뛰므로 짝의 수가 2 늘거나 2 줄거나 그대로다.
//   그래서 그 수의 홀짝은 바뀌지 않는다. 제자리는 0개(짝수)이므로 홀수인 판은 안 된다. 거꾸로 짝수인 판은 늘 된다(테스트가 표로 모든 모습을 따져 확인한다).

/** 맞바꾸기의 말 수 */
export const MIN_PIECES = 3;
export const MAX_PIECES = 8;
/** 밀기 판: 가로는 3칸, 세로는 2칸이나 3칸 */
export const SLIDE_W = 3;
export const SLIDE_HEIGHTS = [2, 3];

const isPermutation = (cells, from) => {
  const n = cells.length;
  const seen = new Set(cells);
  return seen.size === n && cells.every((value) => Number.isInteger(value) && value >= from && value < from + n);
};

/** 판이 맞는 값인가. 맞으면 null, 아니면 까닭 */
export function checkBoard(board) {
  if (!board || typeof board !== 'object') return 'no-board';
  const { kind, w, h, cells } = board;
  if (!Array.isArray(cells) || !Number.isInteger(w) || !Number.isInteger(h) || cells.length !== w * h) return 'cells';
  if (kind === 'swap') {
    if (h !== 1 || w < MIN_PIECES || w > MAX_PIECES) return 'size';
    return isPermutation(cells, 1) ? null : 'cells';
  }
  if (kind === 'slide') {
    if (w !== SLIDE_W || !SLIDE_HEIGHTS.includes(h)) return 'size';
    return isPermutation(cells, 0) ? null : 'cells';
  }
  return 'kind';
}

export const copyBoard = (board) => ({ kind: board.kind, w: board.w, h: board.h, cells: board.cells.slice() });
export const boardKey = (board) => `${board.kind}:${board.w}x${board.h}:${board.cells.join(',')}`;
export const sameBoard = (a, b) => boardKey(a) === boardKey(b);
export const isSwap = (board) => board.kind === 'swap';

/** 제자리 모습 */
export function goalCells(kind, w, h) {
  if (kind === 'swap') return Array.from({ length: w }, (_, index) => index + 1);
  return Array.from({ length: w * h }, (_, index) => (index === w * h - 1 ? 0 : index + 1));
}

/** 모두 제자리인가(맞바꾸기는 1부터 차례대로, 밀기는 차례대로이고 빈칸이 맨 끝) */
export function isDone(cells) {
  const last = cells.length - 1;
  if (cells[last] === 0) return cells.every((value, index) => (index === last ? true : value === index + 1));
  return cells.every((value, index) => value === index + 1);
}

/** 제자리 판(직접 만들기의 처음 판과 처음 화면의 빈 판) */
export const goalBoard = (kind, w, h) => ({ kind, w, h, cells: goalCells(kind, w, h) });

// ---- 맞바꾸기 ----

/** 두 자리를 맞바꾼 새 칸들 */
export function applySwap(cells, a, b) {
  const next = cells.slice();
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

/** 맞바꾸기 한 번이 판에 맞는가: 서로 다른 두 자리, 앞의 것이 작다 */
export const isSwapMove = (n, move) => Array.isArray(move) && move.length === 2 && move.every((at) => Number.isInteger(at) && at >= 0 && at < n) && move[0] < move[1];

/**
 * 고리들: 자리마다 "그 자리의 말이 가야 할 자리"로 화살표를 그을 때의 고리. 고리마다 자리 번호를 왼쪽 자리부터 화살표를 따라 적는다.
 * 제자리에 있는 말은 혼자 고리 하나다. 고리는 가장 왼쪽 자리의 차례로 놓는다.
 */
export function cyclesOf(cells) {
  const seen = new Array(cells.length).fill(false);
  const cycles = [];
  for (let start = 0; start < cells.length; start++) {
    if (seen[start]) continue;
    const cycle = [];
    let at = start;
    while (!seen[at]) {
      seen[at] = true;
      cycle.push(at);
      at = cells[at] - 1;
    }
    cycles.push(cycle);
  }
  return cycles;
}

/** 가장 적게 맞바꾸는 횟수: 말의 수 − 고리의 수 */
export const fewestSwaps = (cells) => cells.length - cyclesOf(cells).length;

/** 가장 적게 맞바꾸는 한 가지 방법: 왼쪽 자리부터, 그 자리에 와야 할 말을 데려온다 */
export function swapPath(cells) {
  let now = cells.slice();
  const path = [];
  for (let at = 0; at < now.length; at++) {
    if (now[at] === at + 1) continue;
    const from = now.indexOf(at + 1);
    path.push([at, from]);
    now = applySwap(now, at, from);
  }
  return path;
}

// ---- 밀기 ----

export const emptyAt = (cells) => cells.indexOf(0);

/** 한 자리와 가로나 세로로 붙은 자리들(위, 왼쪽, 오른쪽, 아래의 차례) */
export function neighborsOf(w, h, at) {
  const r = Math.floor(at / w);
  const c = at % w;
  const list = [];
  if (r > 0) list.push(at - w);
  if (c > 0) list.push(at - 1);
  if (c < w - 1) list.push(at + 1);
  if (r < h - 1) list.push(at + w);
  return list;
}

/** 그 자리의 말을 빈칸으로 밀 수 있는가 */
export const canSlide = (w, h, cells, at) => Number.isInteger(at) && at >= 0 && at < w * h && cells[at] !== 0 && neighborsOf(w, h, at).includes(emptyAt(cells));

/** 그 자리의 말을 빈칸으로 민 새 칸들 */
export function applySlide(cells, at) {
  const next = cells.slice();
  const hole = emptyAt(cells);
  next[hole] = next[at];
  next[at] = 0;
  return next;
}

/** 민 것이 위아래인가(옆으로 민 것이 아닌가) */
export const isUpDown = (w, cells, at) => Math.abs(emptyAt(cells) - at) === w;

/** 판을 위 줄부터 한 줄로 읽은 수들(빈칸은 건너뛴다) */
export const lineOf = (cells) => cells.filter((value) => value !== 0);

/** 큰 수가 작은 수보다 앞에 선 짝들: [앞의 수, 뒤의 수] */
export function swappedPairs(line) {
  const pairs = [];
  for (let i = 0; i < line.length; i++) for (let j = i + 1; j < line.length; j++) if (line[i] > line[j]) pairs.push([line[i], line[j]]);
  return pairs;
}

/** 큰 수가 작은 수보다 앞에 선 짝의 수 */
export function swappedCount(line) {
  let count = 0;
  for (let i = 0; i < line.length; i++) for (let j = i + 1; j < line.length; j++) if (line[i] > line[j]) count += 1;
  return count;
}

// ---- 표: 판의 크기마다 모든 모습의 가장 적은 밀기 횟수 ----

const FACTORIAL = [1];
for (let k = 1; k <= 9; k++) FACTORIAL[k] = FACTORIAL[k - 1] * k;

/** 0부터 n − 1까지의 차례(순열)의 번호(0부터 n! − 1까지) */
export function rankOf(cells) {
  const n = cells.length;
  let rank = 0;
  for (let i = 0; i < n; i++) {
    let smaller = 0;
    for (let j = i + 1; j < n; j++) if (cells[j] < cells[i]) smaller += 1;
    rank += smaller * FACTORIAL[n - 1 - i];
  }
  return rank;
}

/** 번호로 차례를 되찾는다(rankOf의 거꾸로) */
export function unrank(rank, n) {
  const left = Array.from({ length: n }, (_, index) => index);
  const cells = new Array(n);
  let rest = rank;
  for (let i = 0; i < n; i++) {
    const f = FACTORIAL[n - 1 - i];
    const at = Math.floor(rest / f);
    rest -= at * f;
    cells[i] = left[at];
    left.splice(at, 1);
  }
  return cells;
}

/** 닿지 못하는 모습의 표시 */
export const UNREACHABLE = 255;
const tables = new Map();

/**
 * 가로 w, 세로 h 밀기 판의 표: 번호(rankOf)마다 제자리까지 가장 적게 민 횟수, 닿지 못하면 UNREACHABLE.
 * 처음 부를 때 제자리에서 너비 우선 탐색으로 만들고 적어 둔다(3×3은 362,880칸).
 */
export function tableFor(w, h) {
  const key = `${w}x${h}`;
  if (tables.has(key)) return tables.get(key);
  const n = w * h;
  const size = FACTORIAL[n];
  const dist = new Uint8Array(size).fill(UNREACHABLE);
  // 줄에는 모습을 칸마다 4비트로 묶어 넣는다(앞의 여덟 칸. 마지막 칸은 남은 수다). 번호를 다시 풀지 않아도 되어 빠르다
  const queue = new Uint32Array(size / 2 + 1);
  const total = (n * (n - 1)) / 2;
  const cells = new Array(n);
  const pack = () => {
    let value = 0;
    for (let i = 0; i < n - 1; i++) value = (value * 16 + cells[i]) >>> 0;
    return value;
  };
  const read = (value) => {
    let rest = value;
    let sum = 0;
    for (let i = n - 2; i >= 0; i--) {
      cells[i] = rest & 15;
      rest >>>= 4;
      sum += cells[i];
    }
    cells[n - 1] = total - sum;
  };
  const goal = goalCells('slide', w, h);
  for (let i = 0; i < n; i++) cells[i] = goal[i];
  dist[rankOf(cells)] = 0;
  queue[0] = pack();
  let head = 0;
  let tail = 1;
  const near = Array.from({ length: n }, (_, at) => neighborsOf(w, h, at));
  while (head < tail) {
    read(queue[head++]);
    const next = dist[rankOf(cells)] + 1;
    const hole = cells.indexOf(0);
    for (const at of near[hole]) {
      cells[hole] = cells[at];
      cells[at] = 0;
      const other = rankOf(cells);
      if (dist[other] === UNREACHABLE) {
        dist[other] = next;
        queue[tail++] = pack();
      }
      cells[at] = cells[hole];
      cells[hole] = 0;
    }
  }
  const table = { w, h, dist, reachable: tail };
  tables.set(key, table);
  return table;
}

/** 그 크기의 판 가운데 가장 많이 밀어야 하는 판의 횟수(2×3은 21번, 3×3은 31번) */
export function farthestOf(w, h) {
  const table = tableFor(w, h);
  if (table.farthest === undefined) {
    let most = 0;
    for (const value of table.dist) if (value !== UNREACHABLE && value > most) most = value;
    table.farthest = most;
  }
  return table.farthest;
}

/** 밀기 판의 모습에서 제자리까지 가장 적게 민 횟수. 안 되면 null */
export function slideDistance(w, h, cells) {
  const value = tableFor(w, h).dist[rankOf(cells)];
  return value === UNREACHABLE ? null : value;
}

/** 가장 적게 미는 한 가지 방법(민 말이 있던 자리들). 표에서 한 걸음씩 횟수가 줄어드는 이웃을 고른다(위, 왼쪽, 오른쪽, 아래의 차례로 먼저 찾은 것) */
export function slidePath(w, h, cells) {
  const { dist } = tableFor(w, h);
  let now = cells.slice();
  let left = dist[rankOf(now)];
  if (left === UNREACHABLE) return null;
  const path = [];
  while (left > 0) {
    const hole = emptyAt(now);
    const at = neighborsOf(w, h, hole).find((spot) => dist[rankOf(applySlide(now, spot))] === left - 1);
    path.push(at);
    now = applySlide(now, at);
    left -= 1;
  }
  return path;
}

// ---- 판 ----

/** 처음 모습에서 움직임들을 차례로 한 모습. 판에 맞지 않는 움직임이 있으면 ok가 거짓이다 */
export function replay(board, trail) {
  if (!Array.isArray(trail)) return { ok: false, cells: board.cells.slice() };
  let cells = board.cells.slice();
  for (const move of trail) {
    if (board.kind === 'swap') {
      if (!isSwapMove(cells.length, move)) return { ok: false, cells };
      cells = applySwap(cells, move[0], move[1]);
    } else {
      if (!canSlide(board.w, board.h, cells, move)) return { ok: false, cells };
      cells = applySlide(cells, move);
    }
  }
  return { ok: true, cells };
}

/**
 * 판을 푼다.
 * @returns {{possible: boolean, fewest: number|null, path: Array, count: number}}
 *   fewest  가장 적게 맞바꾸는(미는) 횟수. 안 되는 판이면 null
 *   path    가장 적게 하는 한 가지 방법(맞바꾸기는 [a, b]들, 밀기는 민 말이 있던 자리들). 안 되는 판이면 빈 목록
 *   count   맞바꾸기는 고리의 수, 밀기는 한 줄로 읽었을 때 큰 수가 앞에 선 짝의 수
 */
export function solve(board) {
  if (board.kind === 'swap') {
    const cycles = cyclesOf(board.cells).length;
    return { possible: true, fewest: board.cells.length - cycles, path: swapPath(board.cells), count: cycles };
  }
  const count = swappedCount(lineOf(board.cells));
  const fewest = slideDistance(board.w, board.h, board.cells);
  if (fewest === null) return { possible: false, fewest: null, path: [], count };
  return { possible: true, fewest, path: slidePath(board.w, board.h, board.cells), count };
}

/** 대본의 그림 판: 줄마다 한 글('1 2 3', '_'는 빈칸) → 밀기 판, 또는 수들 → 맞바꾸기 판 */
export function boardOfRows(rows) {
  const lines = rows.map((row) => row.trim().split(/\s+/));
  const cells = lines.flat().map((mark) => (mark === '_' ? 0 : Number(mark)));
  if (!cells.includes(0)) return { kind: 'swap', w: cells.length, h: 1, cells };
  return { kind: 'slide', w: lines[0].length, h: lines.length, cells };
}
