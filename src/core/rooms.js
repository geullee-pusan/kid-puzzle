// 방 한 번씩 돌기의 풀이 프로그램. 순수 함수만 둔다.
// 집은 네모 칸으로 된 방들이다. 이웃한 두 방(위·아래·왼쪽·오른쪽) 사이에는 문이 있다. 빠진 칸은 정원이라 들어갈 수 없다.
// 처음 방에서 시작해 모든 방을 한 번씩 지나 끝 방에서 끝나는 길이 있는지 따진다.
//
// 판(house): { kind: 'house', w, h, walls, start, end, numbers }
//   w, h     가로와 세로의 칸 수(3~6)
//   walls    정원 칸(들어갈 수 없는 칸)의 번호들. 칸 번호는 y * w + x
//   start    처음 방, end 끝 방
//   numbers  지나는 차례가 적힌 방: [[칸, 차례], …](차례는 1부터). 없으면 []
// 가려 내기 판(judge): { kind: 'judge', houses: [house, …] } 여러 집 가운데 안 되는 집을 고른다.
//
// 안 되는 까닭(reason)은 아이에게 설명할 수 있는 차례로 가린다.
//   split    정원 때문에 집이 나뉘어 갈 수 없는 방이 있다
//   color    색을 켜고 세면 맞지 않는다(한 칸 갈 때마다 색이 바뀐다)
//            same: 방의 수가 짝수인데 처음 방과 끝 방이 같은 색. minor: 방의 수가 홀수인데 처음 방이나 끝 방이 적은 쪽 색.
//            count: 두 색의 방 수가 둘 이상 차이 난다
//   deadend  색은 맞지만, 처음 방도 끝 방도 아닌데 문이 하나뿐인 방이 있다(들어가면 나올 수 없다)
//   cut      색은 맞지만, 한 방을 빼면 집이 나뉘어 그 방을 두 번 지나야 하는 곳이 있다
//   search   위의 어느 것도 아니지만 모든 길을 따져 보니 없다
// 길 찾기는 되돌아가며 찾기(백트래킹)에 가지치기 셋(남은 방이 이어져 있는가, 문이 모자란 방이 없는가, 적힌 차례에 닿을 수 있는가)을 한다.

export const MIN_SIZE = 3;
export const MAX_SIZE = 6;
/** 길 찾기가 들르는 자리의 위 끝. 넘으면 끝까지 따지지 못한 것으로 본다(사다리의 판과 직접 만들기의 6×6까지는 넘지 않는다) */
export const STEP_LIMIT = 4000000;

const isInt = (value) => Number.isInteger(value);

export const xyOf = (board, cell) => [cell % board.w, Math.floor(cell / board.w)];
/** 칸의 색: 바둑판처럼 번갈아 0과 1 */
export const colorOf = (board, cell) => ((cell % board.w) + Math.floor(cell / board.w)) % 2;
export const isRoom = (board, cell) => isInt(cell) && cell >= 0 && cell < board.w * board.h && !board.walls.includes(cell);
export const roomsOf = (board) => Array.from({ length: board.w * board.h }, (_, cell) => cell).filter((cell) => !board.walls.includes(cell));

/** 칸의 이웃 칸들(판 안의 칸만, 위·오른쪽·아래·왼쪽 차례) */
export function neighborsOf(board, cell) {
  const [x, y] = xyOf(board, cell);
  const list = [];
  if (y > 0) list.push(cell - board.w);
  if (x < board.w - 1) list.push(cell + 1);
  if (y < board.h - 1) list.push(cell + board.w);
  if (x > 0) list.push(cell - 1);
  return list;
}

/** 문으로 이어진 이웃 방들 */
export const doorsOf = (board, cell) => neighborsOf(board, cell).filter((other) => !board.walls.includes(other));
export const adjacent = (board, a, b) => neighborsOf(board, a).includes(b);

export const copyHouse = (board) => ({
  kind: 'house',
  w: board.w,
  h: board.h,
  walls: board.walls.slice().sort((a, b) => a - b),
  start: board.start,
  end: board.end,
  numbers: (board.numbers ?? []).map(([cell, order]) => [cell, order]).sort((a, b) => a[1] - b[1]),
});

export function copyBoard(board) {
  if (board.kind === 'judge') return { kind: 'judge', houses: board.houses.map(copyHouse) };
  return copyHouse(board);
}

/**
 * 집이 규격에 맞는지 본다. 맞으면 null, 아니면 무엇이 틀렸는지.
 * open: 처음 방과 끝 방이 아직 정해지지 않아도 된다(직접 만드는 중)
 */
export function checkHouse(board, { open = false } = {}) {
  if (!board || typeof board !== 'object') return 'board';
  const { w, h, walls } = board;
  if (!isInt(w) || !isInt(h) || w < MIN_SIZE || h < MIN_SIZE || w > MAX_SIZE || h > MAX_SIZE) return 'size';
  if (!Array.isArray(walls) || !walls.every((cell) => isInt(cell) && cell >= 0 && cell < w * h)) return 'walls';
  if (new Set(walls).size !== walls.length) return 'walls';
  const rooms = w * h - walls.length;
  if (rooms < 2) return 'walls';
  for (const key of ['start', 'end']) {
    const cell = board[key];
    if (open && cell === null) continue;
    if (!isRoom(board, cell)) return key;
  }
  if (board.start !== null && board.start === board.end) return 'end';
  const numbers = board.numbers ?? [];
  if (!Array.isArray(numbers)) return 'numbers';
  const cells = new Set();
  const orders = new Set();
  for (const item of numbers) {
    if (!Array.isArray(item) || item.length !== 2) return 'numbers';
    const [cell, order] = item;
    if (!isRoom(board, cell) || !isInt(order) || order < 1 || order > rooms) return 'numbers';
    if (cells.has(cell) || orders.has(order)) return 'numbers';
    if (cell === board.start && order !== 1) return 'numbers';
    if (cell === board.end && order !== rooms) return 'numbers';
    if (order === 1 && cell !== board.start) return 'numbers';
    if (order === rooms && cell !== board.end) return 'numbers';
    cells.add(cell);
    orders.add(order);
  }
  return null;
}

/** 판(집 하나 또는 가려 내기)이 규격에 맞는지 본다 */
export function checkBoard(board) {
  if (!board || typeof board !== 'object') return 'board';
  if (board.kind === 'judge') {
    if (!Array.isArray(board.houses) || board.houses.length < 2 || board.houses.length > 4) return 'houses';
    for (const house of board.houses) {
      if (house?.kind !== 'house' || (house.numbers ?? []).length > 0) return 'houses';
      const problem = checkHouse(house);
      if (problem) return problem;
    }
    return null;
  }
  if (board.kind !== 'house') return 'kind';
  return checkHouse(board);
}

// ---- 색 세기 ----

/**
 * 색을 켜고 센다. 한 칸 갈 때마다 색이 바뀌므로, 길의 홀수 번째 방은 처음 방의 색, 짝수 번째 방은 다른 색이다.
 * @returns {{counts: number[], n: number, startColor: number|null, endColor: number|null, major: number|null, ok: boolean, detail: string|null}}
 *   counts  색마다 방의 수, n 방의 수, major 많은 쪽 색(같으면 null)
 *   detail  맞지 않을 때 무엇이 맞지 않는지: 'same' | 'minor' | 'count'
 */
export function colorCheck(board) {
  const counts = [0, 0];
  for (const cell of roomsOf(board)) counts[colorOf(board, cell)] += 1;
  const n = counts[0] + counts[1];
  const startColor = board.start === null || board.start === undefined ? null : colorOf(board, board.start);
  const endColor = board.end === null || board.end === undefined ? null : colorOf(board, board.end);
  const major = counts[0] === counts[1] ? null : counts[0] > counts[1] ? 0 : 1;
  let detail = null;
  if (Math.abs(counts[0] - counts[1]) >= 2) detail = 'count';
  else if (major === null) {
    if (startColor === endColor) detail = 'same';
  } else if (startColor !== major || endColor !== major) detail = 'minor';
  return { counts, n, startColor, endColor, major, ok: detail === null, detail };
}

// ---- 집의 생김새 ----

/** 빼 둔 칸(gone)을 뺀 방들이 몇 덩어리로 나뉘는지. 덩어리마다 방 번호들 */
export function partsOf(board, gone = []) {
  const skip = new Set([...board.walls, ...gone]);
  const seen = new Set();
  const parts = [];
  for (const cell of roomsOf(board)) {
    if (skip.has(cell) || seen.has(cell)) continue;
    const part = [];
    const queue = [cell];
    seen.add(cell);
    while (queue.length > 0) {
      const at = queue.shift();
      part.push(at);
      for (const next of neighborsOf(board, at)) {
        if (skip.has(next) || seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }
    parts.push(part.sort((a, b) => a - b));
  }
  return parts;
}

/**
 * 생김새 때문에 안 되는 곳을 찾는다(색은 보지 않는다). 없으면 null.
 *   { reason: 'split', parts }                   집이 나뉘어 있다
 *   { reason: 'deadend', cells }                  처음 방도 끝 방도 아닌데 문이 하나뿐인 방들
 *   { reason: 'cut', cell, role, parts, same }    이 방을 빼면 집이 나뉜다. role: 'start' | 'end' | 'room'.
 *                                                 처음 방이나 끝 방이면 둘로만 나뉘어도 안 되고, 다른 방이면 셋 이상으로 나뉘거나 처음 방과 끝 방이 같은 쪽에 남을 때 안 된다
 */
export function shapeCheck(board) {
  const all = partsOf(board);
  if (all.length > 1) return { reason: 'split', parts: all.length };
  const ends = [board.start, board.end];
  const deadends = roomsOf(board).filter((cell) => !ends.includes(cell) && doorsOf(board, cell).length <= 1);
  if (deadends.length > 0) return { reason: 'deadend', cells: deadends };
  for (const cell of roomsOf(board)) {
    const parts = partsOf(board, [cell]);
    if (parts.length < 2) continue;
    if (cell === board.start || cell === board.end) return { reason: 'cut', cell, role: cell === board.start ? 'start' : 'end', parts: parts.length, same: false };
    const side = (room) => parts.findIndex((part) => part.includes(room));
    const same = side(board.start) === side(board.end);
    if (parts.length >= 3 || same) return { reason: 'cut', cell, role: 'room', parts: parts.length, same };
  }
  return null;
}

// ---- 길 찾기 ----

/**
 * 처음 방에서 모든 방을 한 번씩 지나는 길을 찾는다(되돌아가며 찾기와 가지치기).
 * @param {object} board 집. end가 null이면 끝 방을 정하지 않고 아무 방에서나 끝나도 된다
 * @param {{cap?: number, limit?: number, order?: (cells: number[]) => number[]}} options
 *   cap    이만큼 찾으면 멈춘다(길의 수를 셀 때는 크게)
 *   limit  들르는 자리의 위 끝
 *   order  (갈 방들, 그 방에서 더 갈 곳의 수를 세는 함수) → 차례. 판을 만들 때 시드 난수로 섞는다. 없으면 갈 곳이 적은 방부터
 * @returns {{count: number, path: number[]|null, steps: number, cut: boolean}} cut: 위 끝에 닿아 끝까지 따지지 못했다
 */
export function searchPaths(board, { cap = 1, limit = STEP_LIMIT, order = null } = {}) {
  const size = board.w * board.h;
  const room = new Uint8Array(size);
  for (const cell of roomsOf(board)) room[cell] = 1;
  const n = roomsOf(board).length;
  const doors = Array.from({ length: size }, (_, cell) => (room[cell] ? doorsOf(board, cell) : []));
  const end = board.end ?? -1;
  const numberAt = new Int16Array(size);
  const cellOf = new Map();
  for (const [cell, k] of board.numbers ?? []) {
    numberAt[cell] = k;
    cellOf.set(k, cell);
  }
  const pending = [...cellOf.entries()].sort((a, b) => a[0] - b[0]);
  const xs = Array.from({ length: size }, (_, cell) => cell % board.w);
  const ys = Array.from({ length: size }, (_, cell) => Math.floor(cell / board.w));
  const far = (a, b) => Math.abs(xs[a] - xs[b]) + Math.abs(ys[a] - ys[b]);

  const seen = new Uint8Array(size);
  const path = [];
  const mark = new Int32Array(size);
  let stamp = 0;
  const queue = new Int16Array(size);
  let count = 0;
  let first = null;
  let steps = 0;
  let cut = false;

  /** 지금 자리(head, 지나간 방 depth개)에서 아직 끝까지 갈 수 있을지 가볍게 따진다 */
  function feasible(head, depth) {
    const left = n - depth;
    if (left === 0) return true;
    // 적힌 차례: 아직 오지 않은 차례의 방에 그 차례에 닿을 수 있어야 한다(걸음 수와 거리, 색이 맞는지)
    for (const [k, cell] of pending) {
      if (k <= depth) continue;
      const gap = k - depth;
      const d = far(head, cell);
      if (d > gap || (gap - d) % 2 !== 0) return false;
    }
    if (end >= 0) {
      const d = far(head, end);
      if (d > left || (left - d) % 2 !== 0) return false;
    }
    // 문이 모자란 방: 끝 방이 아닌 방은 갈 수 있는 이웃(아직 안 간 방이나 지금 방)이 둘 이상이어야 한다
    let ones = 0;
    for (let cell = 0; cell < size; cell++) {
      if (!room[cell] || seen[cell]) continue;
      let free = 0;
      for (const next of doors[cell]) if (!seen[next] || next === head) free += 1;
      if (free === 0) return false;
      if (free === 1) {
        if (end >= 0 && cell !== end) return false;
        ones += 1;
        if (ones > 1) return false;
      }
    }
    // 남은 방이 지금 방에서 모두 이어져 있어야 한다
    stamp += 1;
    let top = 0;
    let reached = 0;
    queue[top++] = head;
    mark[head] = stamp;
    for (let at = 0; at < top; at++) {
      for (const next of doors[queue[at]]) {
        if (seen[next] || mark[next] === stamp) continue;
        mark[next] = stamp;
        queue[top++] = next;
        reached += 1;
      }
    }
    return reached === left;
  }

  function step(head, depth) {
    if (cut || count >= cap) return;
    steps += 1;
    if (steps > limit) {
      cut = true;
      return;
    }
    if (depth === n) {
      if (end < 0 || head === end) {
        count += 1;
        if (first === null) first = path.slice();
      }
      return;
    }
    if (head === end) return;
    let nexts = doors[head].filter((next) => !seen[next]);
    const onward = (cell) => doors[cell].filter((other) => !seen[other]).length;
    if (order) nexts = order(nexts, onward);
    else nexts.sort((a, b) => onward(a) - onward(b));
    for (const next of nexts) {
      const k = depth + 1;
      if (numberAt[next] && numberAt[next] !== k) continue;
      if (cellOf.has(k) && cellOf.get(k) !== next) continue;
      if (next === end && k !== n) continue;
      seen[next] = 1;
      path.push(next);
      if (feasible(next, k)) step(next, k);
      path.pop();
      seen[next] = 0;
      if (cut || count >= cap) return;
    }
  }

  if (room[board.start] && n >= 1) {
    if (!(numberAt[board.start] && numberAt[board.start] !== 1)) {
      seen[board.start] = 1;
      path.push(board.start);
      if (feasible(board.start, 1)) step(board.start, 1);
    }
  }
  return { count, path: first, steps, cut };
}

/** 처음 방에서 끝 방까지 모든 방을 지나는 길의 수(cap에 닿으면 cap). 끝까지 따지지 못하면 null */
export function countPaths(board, cap = 1000000, limit = STEP_LIMIT) {
  const result = searchPaths(board, { cap, limit });
  return result.cut ? null : result.count;
}

/**
 * 집 하나를 푼다: 되는지, 길 하나, 안 되면 그 까닭.
 * @returns {{possible: boolean|null, path: number[]|null, reason: string|null, detail: object|null, steps: number}}
 *   possible이 null이면 끝까지 따지지 못했다(reason 'unknown')
 */
export function solveHouse(board, { limit = STEP_LIMIT } = {}) {
  const shape = shapeCheck(board);
  if (shape?.reason === 'split') return { possible: false, path: null, reason: 'split', detail: shape, steps: 0 };
  const color = colorCheck(board);
  if (!color.ok) return { possible: false, path: null, reason: 'color', detail: color, steps: 0 };
  if (shape) return { possible: false, path: null, reason: shape.reason, detail: shape, steps: 0 };
  const found = searchPaths(board, { cap: 1, limit });
  if (found.cut) return { possible: null, path: null, reason: 'unknown', detail: null, steps: found.steps };
  if (found.count > 0) return { possible: true, path: found.path, reason: null, detail: null, steps: found.steps };
  return { possible: false, path: null, reason: 'search', detail: null, steps: found.steps };
}

/**
 * 판을 푼다. 집 하나면 solveHouse와 같다.
 * 가려 내기 판은 집마다 풀고, 안 되는 집의 번호(impossible)를 낸다. possible은 "모든 집이 되는가"다(안 되는 집이 섞여 있으면 false).
 */
export function solve(board) {
  if (board.kind === 'judge') {
    const houses = board.houses.map((house) => solveHouse(house));
    const impossible = houses.map((result, index) => (result.possible === false ? index : -1)).filter((index) => index >= 0);
    const known = houses.every((result) => result.possible !== null);
    return { possible: known ? impossible.length === 0 : null, houses, impossible, reason: null, detail: null, path: null };
  }
  return solveHouse(board);
}

// ---- 아이가 그은 길 ----

/**
 * 아이가 그은 길이 규칙에 맞는 길인가(처음 방에서 시작해 이웃한 방으로만, 같은 방을 두 번 지나지 않는다).
 * 끝까지 갔는지는 보지 않는다.
 */
export function pathOk(board, path) {
  if (!Array.isArray(path) || path.length === 0 || path[0] !== board.start) return false;
  const seen = new Set();
  for (let at = 0; at < path.length; at++) {
    const cell = path[at];
    if (!isRoom(board, cell) || seen.has(cell)) return false;
    if (at > 0 && !adjacent(board, path[at - 1], cell)) return false;
    seen.add(cell);
  }
  return true;
}

/** 적힌 차례와 들어간 차례가 다른 방들 */
export function wrongNumbers(board, path) {
  return (board.numbers ?? []).filter(([cell, order]) => path.indexOf(cell) >= 0 && path.indexOf(cell) !== order - 1).map(([cell]) => cell);
}

/** 길이 다 됐는가: 모든 방을 지나 끝 방에서 끝나고, 적힌 차례와 모두 맞는다 */
export function pathDone(board, path) {
  return pathOk(board, path) && path.length === roomsOf(board).length && path.at(-1) === board.end && wrongNumbers(board, path).length === 0;
}

/** 길의 끝(지금 있는 방)에서 더 갈 방이 없는데 아직 남은 방이 있는가 */
export function pathStuck(board, path) {
  if (!pathOk(board, path) || path.length === roomsOf(board).length) return false;
  const head = path.at(-1);
  if (head === board.end) return true;
  return doorsOf(board, head).every((cell) => path.includes(cell));
}

/** 이 길을 이어서 끝까지 갈 수 있는가(지나온 방은 그대로 두고 남은 방만으로 찾는다) */
export function canFinish(board, path, limit = STEP_LIMIT) {
  if (!pathOk(board, path)) return false;
  const rest = { ...copyHouse(board), walls: [...board.walls, ...path.slice(0, -1)], start: path.at(-1) };
  const offset = path.length - 1;
  rest.numbers = (board.numbers ?? []).filter(([cell]) => !path.slice(0, -1).includes(cell)).map(([cell, order]) => [cell, order - offset]);
  if (rest.numbers.some(([, order]) => order < 1)) return false;
  if (rest.start === rest.end) return path.length === roomsOf(board).length;
  if (wrongNumbers(board, path).length > 0) return false;
  const shape = partsOf(rest);
  if (shape.length > 1) return false;
  const found = searchPaths(rest, { cap: 1, limit });
  return found.count > 0;
}

// ---- "왜 그럴까?"의 그림과 공책: 몇 가지 센 값 ----

/** 길에서 홀수 번째 방들의 색이 모두 처음 방의 색이고, 짝수 번째는 모두 다른 색인가 */
export function alternates(board, path) {
  const first = colorOf(board, path[0]);
  return path.every((cell, at) => colorOf(board, cell) === (at % 2 === 0 ? first : 1 - first));
}
