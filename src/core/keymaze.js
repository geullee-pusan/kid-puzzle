// 열쇠 미로의 판과 풀이 프로그램. 순수 함수만 둔다.
// 판: 네모 방들(가로 w, 세로 h). 이웃한 두 방 사이는 벽, 열린 문, 한쪽 문(화살표 쪽으로만 지나간다), 잠긴 문(같은 색 열쇠가 있어야 지나간다) 가운데 하나다.
// 방에는 열쇠가 놓여 있을 수 있고, 그 방에 들어가면 저절로 줍는다. 판 가장자리의 한 방에 나가는 문이 있다(나가는 문도 잠겨 있을 수 있다).
// 열쇠의 약속(keep)은 둘이다.
//   kept  주운 열쇠는 써도 그대로 가지고 있다. 그 색의 잠긴 문은 몇 번이든 지나간다
//   used  잠긴 문을 처음 열 때 그 색 열쇠 하나가 없어진다. 한 번 연 문은 그 뒤로 늘 열려 있다(양쪽으로)
// 걸음 수는 지나간 문의 수다(나가는 문도 한 걸음이다).
// 풀이 프로그램은 (지금 방, 주운 열쇠, 연 문)을 모두 따지는 너비 우선 탐색이다. 가장 적은 걸음과 그 길, 나갈 수 없는 판인지를 정확히 안다.
// 나갈 수 없는 판은 아이가 판에서 볼 수 있는 까닭부터 차례로 가린다(reasonOf).
//   arrows  잠긴 문을 모두 열 수 있다고 쳐도, 화살표를 따라서는 처음 방에서 나가는 문까지 갈 수 없다
//   nokey   열쇠를 가져올 수 있는 방을 다 돌아도, 어떤 색의 열쇠는 손에 들어오지 않는다(그 판에 없거나, 그 방에 갈 수 없다)
//   trap    나가려면 꼭 있어야 하는 색의 열쇠가 모두, 들어가면 나가는 문까지 갈 수 없는 방에 있다
//   twice   (한 번 쓰면 없어지는 열쇠) 나가려면 그 색 문을 열쇠 수보다 많이 열어야 한다(열쇠가 있는 방에 들렀다 나가는 길에서 센다)
//   search  위의 어느 것도 아니다. 모든 걸음을 다 따져 보고서야 안다(사다리에 내지 않는다)

/** 열쇠와 잠긴 문의 색 가짓수. 색마다 모양(동그라미, 세모, 네모)이 하나씩 붙는다 */
export const COLORS = 3;
/** 판의 가로와 세로 칸 수의 아래 끝과 위 끝 */
export const MIN_SIZE = 2;
export const MAX_SIZE = 5;
/** 열쇠와 잠긴 문(나가는 문 포함)의 수의 위 끝. 따질 모습의 수가 방 × 2^열쇠 × 2^문을 넘지 않게 한다 */
export const MAX_KEYS = 6;
export const MAX_LOCKS = 6;
export const KEEPS = ['kept', 'used'];
export const SIDES = ['n', 'e', 's', 'w'];
const KINDS = ['open', 'one', 'lock'];
const STEP = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };

const isInt = (value) => Number.isInteger(value);
const colorOk = (color) => isInt(color) && color >= 0 && color < COLORS;

/** 방 번호 → [가로, 세로] */
export const xyOf = (board, room) => [room % board.w, Math.floor(room / board.w)];

/** 판 밖(나가는 문을 지나서 닿는 곳)의 번호 */
export const outOf = (board) => board.w * board.h;

/** 방에서 그쪽(side)의 이웃 방. 판 밖이면 null */
export function neighbourOf(board, room, side) {
  const [x, y] = xyOf(board, room);
  const [dx, dy] = STEP[side];
  const nx = x + dx;
  const ny = y + dy;
  if (nx < 0 || ny < 0 || nx >= board.w || ny >= board.h) return null;
  return ny * board.w + nx;
}

/** 두 방이 변으로 이웃한가 */
export function adjacent(board, a, b) {
  const n = board.w * board.h;
  if (!isInt(a) || !isInt(b) || a < 0 || b < 0 || a >= n || b >= n) return false;
  const [ax, ay] = xyOf(board, a);
  const [bx, by] = xyOf(board, b);
  return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
}

/** 방이 판의 그쪽 가장자리에 있는가(나가는 문을 둘 수 있는가) */
export const onEdge = (board, room, side) => SIDES.includes(side) && neighbourOf(board, room, side) === null;

/** 판을 깊이 베낀다(문은 a, b 차례로 늘어놓는다) */
export function copyBoard(board) {
  const doors = board.doors
    .map((door) => {
      const copy = { a: door.a, b: door.b, kind: door.kind };
      if (door.kind === 'one') copy.to = door.to;
      if (door.kind === 'lock') copy.color = door.color;
      return copy;
    })
    .sort((p, q) => p.a - q.a || p.b - q.b);
  const keys = board.keys.map((key) => ({ room: key.room, color: key.color })).sort((p, q) => p.room - q.room || p.color - q.color);
  return { w: board.w, h: board.h, start: board.start, exit: { room: board.exit.room, side: board.exit.side, color: board.exit.color ?? null }, doors, keys, keep: board.keep };
}

/** 판이 쓸 수 있는 값인가. 쓸 수 있으면 null, 아니면 까닭 */
export function checkBoard(board) {
  if (!board || typeof board !== 'object') return '판이 없어요';
  const { w, h } = board;
  if (!isInt(w) || !isInt(h) || w < MIN_SIZE || h < MIN_SIZE || w > MAX_SIZE || h > MAX_SIZE) return '크기가 맞지 않아요';
  const n = w * h;
  if (!isInt(board.start) || board.start < 0 || board.start >= n) return '처음 방이 맞지 않아요';
  const exit = board.exit;
  if (!exit || !isInt(exit.room) || exit.room < 0 || exit.room >= n || !onEdge(board, exit.room, exit.side)) return '나가는 문이 맞지 않아요';
  if (exit.color !== null && !colorOk(exit.color)) return '나가는 문의 색이 맞지 않아요';
  if (!KEEPS.includes(board.keep)) return '열쇠 약속이 맞지 않아요';
  if (!Array.isArray(board.doors) || !Array.isArray(board.keys)) return '문이나 열쇠가 없어요';
  const pairs = new Set();
  let locks = exit.color === null ? 0 : 1;
  for (const door of board.doors) {
    if (!door || !adjacent(board, door.a, door.b) || door.a >= door.b) return '문 자리가 맞지 않아요';
    if (pairs.has(`${door.a}-${door.b}`)) return '같은 자리에 문이 둘이에요';
    pairs.add(`${door.a}-${door.b}`);
    if (!KINDS.includes(door.kind)) return '문의 종류가 맞지 않아요';
    if (door.kind === 'one' && door.to !== door.a && door.to !== door.b) return '한쪽 문의 방향이 맞지 않아요';
    if (door.kind === 'lock') {
      if (!colorOk(door.color)) return '잠긴 문의 색이 맞지 않아요';
      locks += 1;
    }
  }
  if (locks > MAX_LOCKS) return '잠긴 문이 너무 많아요';
  if (board.keys.length > MAX_KEYS) return '열쇠가 너무 많아요';
  const rooms = new Set();
  for (const key of board.keys) {
    if (!key || !isInt(key.room) || key.room < 0 || key.room >= n || !colorOk(key.color)) return '열쇠가 맞지 않아요';
    if (rooms.has(key.room)) return '한 방에 열쇠가 둘이에요';
    rooms.add(key.room);
  }
  return null;
}

/**
 * 풀이에 쓰는 판의 모습: 방마다 이어진 문, 잠긴 문의 번호(비트), 방마다 놓인 열쇠.
 * 나가는 문은 문 목록의 맨 뒤(doors.length)에 둔다. 판 밖의 번호는 w × h다.
 */
export function mazeOf(board) {
  const n = board.w * board.h;
  const out = n;
  const doors = board.doors.map((door) => ({ ...door }));
  doors.push({ a: board.exit.room, b: out, kind: board.exit.color === null ? 'open' : 'lock', color: board.exit.color ?? undefined, exit: true });
  const links = Array.from({ length: n + 1 }, () => []);
  const lockBit = new Map();
  const lockColors = [];
  doors.forEach((door, index) => {
    links[door.a].push({ to: door.b, door: index });
    links[door.b].push({ to: door.a, door: index });
    if (door.kind === 'lock') {
      lockBit.set(index, lockColors.length);
      lockColors.push(door.color);
    }
  });
  const keysAt = Array.from({ length: n + 1 }, () => []);
  board.keys.forEach((key, index) => keysAt[key.room].push(index));
  const keyColors = board.keys.map((key) => key.color);
  return { board, n, out, doors, links, lockBit, lockColors, keysAt, keyColors, keyBits: board.keys.length, lockBits: lockColors.length, used: board.keep === 'used' };
}

const mazes = new WeakMap();
/** 같은 판 값에는 한 번만 만든다 */
function mazeFor(board) {
  if (board && board.links && board.lockBit) return board;
  let maze = mazes.get(board);
  if (!maze) {
    maze = mazeOf(board);
    mazes.set(board, maze);
  }
  return maze;
}

/** 모습 하나: 지금 방, 주운 열쇠(비트), 연 문(비트) */
export const encode = (maze, state) => (state.room * 2 ** maze.keyBits + state.keys) * 2 ** maze.lockBits + state.open;
export function decode(maze, code) {
  const open = code % 2 ** maze.lockBits;
  const rest = (code - open) / 2 ** maze.lockBits;
  const keys = rest % 2 ** maze.keyBits;
  return { room: (rest - keys) / 2 ** maze.keyBits, keys, open };
}

const hasBit = (mask, bit) => Math.floor(mask / 2 ** bit) % 2 === 1;

/** 방에 들어갔을 때 그 방의 열쇠를 줍는다 */
function pickUp(maze, keys, room) {
  let next = keys;
  for (const index of maze.keysAt[room] ?? []) if (!hasBit(next, index)) next += 2 ** index;
  return next;
}

/** 처음 모습(처음 방의 열쇠는 이미 주운 것으로 본다) */
export function initialState(board) {
  const maze = mazeFor(board);
  const { start } = maze.board;
  return { room: start, keys: pickUp(maze, 0, start), open: 0 };
}

/** 그 색의 열쇠를 몇 개 가지고 있는가(kept: 주운 수, used: 주운 수 − 그 색 문을 연 수) */
export function heldOf(board, state, color) {
  const maze = mazeFor(board);
  let picked = 0;
  maze.keyColors.forEach((keyColor, index) => {
    if (keyColor === color && hasBit(state.keys, index)) picked += 1;
  });
  if (!maze.used) return picked;
  let opened = 0;
  maze.lockColors.forEach((lockColor, bit) => {
    if (lockColor === color && hasBit(state.open, bit)) opened += 1;
  });
  return picked - opened;
}

/** 문이 지금 열려 있는가(used: 한 번 연 문, kept: 그 색 열쇠를 가진 문). 잠긴 문이 아니면 늘 true */
export function doorOpen(board, state, index) {
  const maze = mazeFor(board);
  const door = maze.doors[index];
  if (door.kind !== 'lock') return true;
  if (maze.used) return hasBit(state.open, maze.lockBit.get(index));
  return heldOf(board, state, door.color) > 0;
}

/**
 * 지금 모습에서 방 to로 한 걸음 가 본다.
 * @returns {{ok: true, state: object, door: number, picked: number[], opened: boolean} | {ok: false, why: 'far'|'wall'|'arrow'|'lock', door?: number, color?: number}}
 *   far   이웃한 방이 아니다(나가는 문은 나가는 문이 있는 방에서만 이웃이다)
 *   wall  이웃한 방이지만 벽이다
 *   arrow 한쪽 문을 화살표 반대쪽으로 지나가려 했다
 *   lock  잠긴 문인데 그 색 열쇠가 없다
 */
export function tryStep(board, state, to) {
  const maze = mazeFor(board);
  const { room } = state;
  if (room === maze.out) return { ok: false, why: 'far' };
  const link = maze.links[room].find((item) => item.to === to);
  if (!link) {
    const near = to === maze.out ? false : adjacent(maze.board, room, to);
    return { ok: false, why: near ? 'wall' : 'far' };
  }
  const door = maze.doors[link.door];
  if (door.kind === 'one' && door.to !== to) return { ok: false, why: 'arrow', door: link.door };
  let open = state.open;
  let opened = false;
  if (door.kind === 'lock') {
    if (maze.used) {
      const bit = maze.lockBit.get(link.door);
      if (!hasBit(open, bit)) {
        if (heldOf(board, state, door.color) <= 0) return { ok: false, why: 'lock', door: link.door, color: door.color };
        open += 2 ** bit;
        opened = true;
      }
    } else if (heldOf(board, state, door.color) <= 0) return { ok: false, why: 'lock', door: link.door, color: door.color };
  }
  const keys = to === maze.out ? state.keys : pickUp(maze, state.keys, to);
  const picked = [];
  for (let index = 0; index < maze.keyBits; index++) if (hasBit(keys, index) && !hasBit(state.keys, index)) picked.push(index);
  return { ok: true, state: { room: to, keys, open }, door: link.door, picked, opened };
}

/** 지금 모습에서 갈 수 있는 걸음들 */
export function movesFrom(board, state) {
  const maze = mazeFor(board);
  if (state.room === maze.out) return [];
  const moves = [];
  for (const link of maze.links[state.room]) {
    const step = tryStep(maze, state, link.to);
    if (step.ok) moves.push(step);
  }
  return moves;
}

/** 걸어온 방들(처음 방부터)을 처음부터 다시 걸어 지금 모습을 낸다. 걸을 수 없는 길이면 null */
export function replay(board, walk) {
  if (!Array.isArray(walk) || walk.length === 0 || walk[0] !== board.start) return null;
  let state = initialState(board);
  for (const room of walk.slice(1)) {
    const step = tryStep(board, state, room);
    if (!step.ok) return null;
    state = step.state;
  }
  return state;
}

/**
 * 처음 모습에서 갈 수 있는 모든 모습을 너비 우선으로 따진다.
 * @returns {{maze, codes: number[], dist: Map<number, number>, parent: Map<number, number>, next: Map<number, number[]>, alive: Set<number>, outCode: number|null}}
 *   alive  그 모습에서 판 밖으로 나갈 수 있는 모습들(거꾸로 따져서 구한다)
 */
export function explore(board) {
  const maze = mazeFor(board);
  const startCode = encode(maze, initialState(maze));
  const dist = new Map([[startCode, 0]]);
  const parent = new Map();
  const next = new Map();
  const codes = [startCode];
  let outCode = null;
  for (let at = 0; at < codes.length; at++) {
    const code = codes[at];
    const state = decode(maze, code);
    const list = [];
    for (const step of movesFrom(maze, state)) {
      const target = encode(maze, step.state);
      list.push(target);
      if (dist.has(target)) continue;
      dist.set(target, dist.get(code) + 1);
      parent.set(target, code);
      codes.push(target);
      if (step.state.room === maze.out && outCode === null) outCode = target;
    }
    next.set(code, list);
  }
  // 거꾸로: 판 밖에 닿은 모습에서 거슬러 올라간다
  const back = new Map();
  for (const [from, list] of next) for (const to of list) back.set(to, [...(back.get(to) ?? []), from]);
  const alive = new Set();
  const queue = codes.filter((code) => decode(maze, code).room === maze.out);
  for (const code of queue) alive.add(code);
  for (let at = 0; at < queue.length; at++) {
    for (const from of back.get(queue[at]) ?? []) {
      if (alive.has(from)) continue;
      alive.add(from);
      queue.push(from);
    }
  }
  return { maze, codes, dist, parent, next, alive, outCode };
}

/**
 * 판을 푼다.
 * @returns {{possible: boolean, steps: number|null, path: number[]|null, reason: string|null, detail: object|null, states: number}}
 *   steps  가장 적은 걸음(지나간 문의 수, 나가는 문 포함). path는 그렇게 걷는 한 가지 길(처음 방부터 판 밖까지)
 *   reason 나갈 수 없는 판의 까닭(맨 위 주석), detail은 그 까닭의 자세한 것
 */
export function solve(board) {
  const { maze, codes, parent, outCode } = explore(board);
  if (outCode !== null) {
    const path = [];
    for (let code = outCode; code !== undefined; code = parent.get(code)) path.unshift(decode(maze, code).room);
    return { possible: true, steps: path.length - 1, path, reason: null, detail: null, states: codes.length };
  }
  const { reason, detail } = reasonOf(board);
  return { possible: false, steps: null, path: null, reason, detail, states: codes.length };
}

// ---- 판에서 보이는 것: 방에서 방으로 갈 수 있는가(열쇠 하나하나의 쓰임은 따지지 않는다) ----

/** 문을 지나갈 수 있다고 칠 것인가: 열린 문, 화살표 쪽의 한쪽 문, 열 수 있다고 친 색(colors)의 잠긴 문 */
const passable = (door, to, colors) => door.kind === 'open' || (door.kind === 'one' && door.to === to) || (door.kind === 'lock' && colors.has(door.color));

const allColors = () => new Set(Array.from({ length: COLORS }, (_, color) => color));

/**
 * 방 from에서 갈 수 있는 방들(판 밖은 out으로 들어간다). colors의 잠긴 문은 열 수 있다고 친다.
 * @returns {Set<number>}
 */
export function reachFrom(board, from, colors = allColors()) {
  const maze = mazeFor(board);
  const seen = new Set([from]);
  const queue = [from];
  for (let at = 0; at < queue.length; at++) {
    const room = queue[at];
    if (room === maze.out) continue;
    for (const link of maze.links[room]) {
      if (seen.has(link.to) || !passable(maze.doors[link.door], link.to, colors)) continue;
      seen.add(link.to);
      queue.push(link.to);
    }
  }
  return seen;
}

/**
 * 나가는 문까지 갈 수 있는 방들(거꾸로 따라간다). colors의 잠긴 문은 열 수 있다고 친다.
 * "나갈 수 있는 방 보기"와 "왜 그럴까?"의 표시가 이것이다.
 * @returns {number[]} 방 번호(작은 것부터. 판 밖은 넣지 않는다)
 */
export function exitRooms(board, colors = allColors()) {
  const maze = mazeFor(board);
  const seen = new Set([maze.out]);
  const queue = [maze.out];
  for (let at = 0; at < queue.length; at++) {
    const room = queue[at];
    for (const link of maze.links[room]) {
      // link.to에서 room으로 지나갈 수 있으면 link.to도 나갈 수 있는 방이다
      if (seen.has(link.to) || !passable(maze.doors[link.door], room, colors)) continue;
      seen.add(link.to);
      queue.push(link.to);
    }
  }
  seen.delete(maze.out);
  return [...seen].sort((a, b) => a - b);
}

/**
 * 가져올 수 있는 열쇠의 색: 처음 방에서 갈 수 있는 방의 열쇠를 줍고, 그 색의 문을 열 수 있다고 쳐서 더 가 본다. 더 늘지 않을 때까지.
 * 실제로 걸으면 이보다 적게 가져올 수는 있어도 많이 가져올 수는 없다.
 * @returns {{colors: Set<number>, rooms: Set<number>}}
 */
export function keyClosure(board) {
  let colors = new Set();
  for (;;) {
    const rooms = reachFrom(board, board.start, colors);
    const next = new Set(board.keys.filter((key) => rooms.has(key.room)).map((key) => key.color));
    if (next.size === colors.size) return { colors, rooms };
    colors = next;
  }
}

/**
 * 그 색(color)의 잠긴 문을 가장 적게 몇 개 열어야 나갈 수 있는가(다른 색 문은 colors에 있는 색만 열 수 있다고 친다). 갈 수 없으면 Infinity.
 * 그 색 문 가운데 몇 개만 열 수 있다고 쳐서(문의 묶음을 작은 것부터 모두 골라 본다) 나갈 수 있는지 본다.
 * 잠긴 문은 그 색 열쇠가 있는 방을 먼저 지나야 열 수 있으므로, 모습은 (방, 지금까지 지난 열쇠 방의 색들)로 따진다
 * (열쇠 하나하나가 몇 번 쓰였는지는 따지지 않는다. 실제로 걸을 수 있는 길은 모두 여기서도 걸을 수 있다).
 * 한 번 쓰면 없어지는 열쇠에서는 문 하나를 열 때마다 열쇠가 하나씩 들므로, 이 수가 그 색 열쇠의 수보다 많으면 나갈 수 없다(twice).
 */
export function doorsNeeded(board, color, colors) {
  const maze = mazeFor(board);
  const spots = maze.doors.map((_, index) => index).filter((index) => maze.doors[index].kind === 'lock' && maze.doors[index].color === color);
  const keyColorsAt = (room) => board.keys.filter((key) => key.room === room).reduce((mask, key) => mask | (1 << key.color), 0);
  let best = Infinity;
  for (let mask = 0; mask < 2 ** spots.length; mask++) {
    const chosen = new Set(spots.filter((_, index) => Math.floor(mask / 2 ** index) % 2 === 1));
    if (chosen.size >= best) continue;
    // 모습: (방, 지난 열쇠 방의 색들(비트))
    const first = keyColorsAt(board.start);
    const seen = new Set([`${board.start}:${first}`]);
    const queue = [[board.start, first]];
    for (let at = 0; at < queue.length && best > chosen.size; at++) {
      const [room, visited] = queue[at];
      if (room === maze.out) {
        best = chosen.size;
        continue;
      }
      for (const link of maze.links[room]) {
        const door = maze.doors[link.door];
        let through;
        if (door.kind !== 'lock') through = passable(door, link.to, new Set());
        else if (!(visited & (1 << door.color))) through = false;
        else through = door.color === color ? chosen.has(link.door) : colors.has(door.color);
        if (!through) continue;
        const next = link.to === maze.out ? visited : visited | keyColorsAt(link.to);
        if (seen.has(`${link.to}:${next}`)) continue;
        seen.add(`${link.to}:${next}`);
        queue.push([link.to, next]);
      }
    }
  }
  return best;
}

/**
 * 나갈 수 없는 판의 까닭을 아이가 판에서 볼 수 있는 것부터 차례로 가린다(맨 위 주석). 나갈 수 있는 판이어도 부르면 이 차례로 따지기만 한다.
 * @returns {{reason: string, detail: object}}
 */
export function reasonOf(board) {
  const maze = mazeFor(board);
  const all = allColors();
  if (!reachFrom(board, board.start, all).has(maze.out)) return { reason: 'arrows', detail: { rooms: exitRooms(board, all) } };
  const closure = keyClosure(board);
  if (!closure.rooms.has(maze.out)) {
    // 열지 못하는 색: 갈 수 있는 방에 붙어 있는 잠긴 문 가운데 그 색 열쇠를 가져올 수 없는 문의 색.
    // 그런 문이 없으면 잠긴 문을 다 열어도 나갈 수 없다는 뜻이라(arrows) 여기에는 늘 있다.
    const blocked = maze.doors.filter((door) => door.kind === 'lock' && !closure.colors.has(door.color) && (closure.rooms.has(door.a) || closure.rooms.has(door.b)));
    const color = Math.min(...blocked.map((door) => door.color));
    const none = !board.keys.some((key) => key.color === color);
    return { reason: 'nokey', detail: { color, none, rooms: [...closure.rooms].filter((room) => room !== maze.out).sort((a, b) => a - b), keyRooms: board.keys.filter((key) => key.color === color).map((key) => key.room) } };
  }
  const back = new Set(exitRooms(board, closure.colors));
  for (const color of [...closure.colors].sort((a, b) => a - b)) {
    const without = new Set([...closure.colors].filter((item) => item !== color));
    if (reachFrom(board, board.start, without).has(maze.out)) continue;
    const keyRooms = board.keys.filter((key) => key.color === color && closure.rooms.has(key.room)).map((key) => key.room);
    if (keyRooms.length > 0 && keyRooms.every((room) => !back.has(room))) return { reason: 'trap', detail: { color, keyRooms, rooms: [...back].sort((a, b) => a - b) } };
  }
  if (maze.used) {
    for (const color of [...closure.colors].sort((a, b) => a - b)) {
      const have = board.keys.filter((key) => key.color === color).length;
      const need = doorsNeeded(board, color, closure.colors);
      if (need > have) return { reason: 'twice', detail: { color, need, have } };
    }
  }
  return { reason: 'search', detail: {} };
}

// ---- 판을 고르는 잣대(사다리와 테스트가 쓴다) ----

/**
 * 판을 고르는 잣대들.
 *   rooms      처음 방에서 들어갈 수 있는 방의 수
 *   doomed     들어갈 수 있는 모습 가운데 나갈 수 없게 된 모습의 수(갇히는 곳)
 *   stuck      그 가운데 더 갈 곳이 아예 없는 모습의 수
 *   doomedRooms 갇히는 모습이 생기는 방들
 */
export function measure(board) {
  const { maze, codes, next, alive } = explore(board);
  let doomed = 0;
  let stuck = 0;
  const rooms = new Set();
  const doomedRooms = new Set();
  for (const code of codes) {
    const state = decode(maze, code);
    if (state.room === maze.out) continue;
    rooms.add(state.room);
    if (!alive.has(code)) {
      doomed += 1;
      doomedRooms.add(state.room);
    }
    if ((next.get(code) ?? []).length === 0) stuck += 1;
  }
  return { rooms: rooms.size, doomed, stuck, doomedRooms: [...doomedRooms].sort((a, b) => a - b) };
}

/**
 * 아무렇게나 걸었을 때 나가는 비율. 걸을 때마다 갈 수 있는 걸음 가운데 하나를 고르게 고르고(나가는 문도 하나의 걸음),
 * 더 갈 곳이 없거나 cap걸음이 되면 그만둔다. 무르지 않는다. rng는 시드 난수(rng.js)다.
 * @returns {{rate: number, lengths: number[]}} 나간 비율과, 나간 걸음 수들
 */
export function walkRate(board, rng, walks = 80, cap = null) {
  const maze = mazeFor(board);
  const limit = cap ?? 4 * maze.n;
  const lengths = [];
  for (let walk = 0; walk < walks; walk++) {
    let state = initialState(maze);
    for (let step = 1; step <= limit; step++) {
      const moves = movesFrom(maze, state);
      if (moves.length === 0) break;
      state = moves[Math.floor(rng() * moves.length)].state;
      if (state.room === maze.out) {
        lengths.push(step);
        break;
      }
    }
  }
  return { rate: lengths.length / walks, lengths };
}

/** 잠긴 문을 모두 벽으로 바꾼 판(열쇠가 꼭 있어야 하는 판인지 볼 때 쓴다) */
export function withoutLocks(board) {
  const copy = copyBoard(board);
  return { ...copy, doors: copy.doors.filter((door) => door.kind !== 'lock'), exit: { ...copy.exit, color: null }, keys: copy.exit.color === null ? copy.keys : [] };
}

/** 잠긴 문을 모두 열린 문으로 바꾼 판(열쇠를 가지러 돌아가는 걸음이 있는지 볼 때 쓴다) */
export function allUnlocked(board) {
  const copy = copyBoard(board);
  return { ...copy, doors: copy.doors.map((door) => (door.kind === 'lock' ? { a: door.a, b: door.b, kind: 'open' } : door)), exit: { ...copy.exit, color: null }, keys: [] };
}

/** 열쇠 약속만 바꾼 판 */
export const withKeep = (board, keep) => ({ ...copyBoard(board), keep });

/**
 * 한 번 쓰면 없어지는 열쇠 때문에 갇히는 모습이 있는가: 그 모습(방, 주운 열쇠)이 열쇠를 계속 가지는 약속에서는 나갈 수 있는 모습이다.
 * "열쇠를 쓰는 차례가 중요한 판"을 고르는 잣대다.
 */
export function orderMatters(board) {
  if (board.keep !== 'used') return false;
  const used = explore(board);
  const keptBoard = withKeep(board, 'kept');
  const kept = explore(keptBoard);
  for (const code of used.codes) {
    if (used.alive.has(code)) continue;
    const state = decode(used.maze, code);
    if (state.room === used.maze.out) continue;
    const twin = encode(kept.maze, { room: state.room, keys: state.keys, open: 0 });
    if (kept.alive.has(twin)) return true;
  }
  return false;
}

/** 판에 한쪽 문, 잠긴 문이 몇 개인가 */
export function countDoors(board) {
  const ones = board.doors.filter((door) => door.kind === 'one').length;
  const locks = board.doors.filter((door) => door.kind === 'lock').length + (board.exit.color === null ? 0 : 1);
  return { ones, locks, keys: board.keys.length };
}

/** 같은 판인가 */
export const sameBoard = (a, b) => JSON.stringify(copyBoard(a)) === JSON.stringify(copyBoard(b));
