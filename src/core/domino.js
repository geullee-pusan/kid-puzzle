// 도미노 가로세로: 판의 규칙과 풀이 프로그램. 순수 함수만 둔다.
//
// 판(board)은 { w, h, holes }다. 가로 w칸, 세로 h칸(2~5칸)의 네모 판이고, holes는 구멍 난 칸(작은 것부터, 겹치지 않게)이다.
// 칸 번호는 위 왼쪽부터 가로로 센다(가로 x, 세로 y이면 y * w + x).
//
// 게임의 규칙
//   - 두 쪽이 번갈아 도미노를 하나씩 놓는다. 세로 쪽('vert')은 위아래로 이어진 빈칸 두 개에만, 가로 쪽('horz')은 옆으로 이어진 빈칸 두 개에만 놓는다.
//   - 도미노는 구멍이나 놓인 도미노와 겹칠 수 없다.
//   - 자기 차례에 놓을 곳이 없는 쪽이 진다(상대가 이긴다).
//   - 누가 먼저 두는지는 판마다 정한다(first: 먼저 두는 쪽).
// 수(move)는 { cells: [a, b] }다(a < b. 세로면 b = a + w, 가로면 b = a + 1). 둔 수들(trail)은 처음부터의 차례이고, 먼저 두는 쪽부터 번갈아 둔다.
//
// 풀이 프로그램: 자리(놓인 칸들의 비트, 둘 차례)마다 "둘 차례인 쪽이 잘 두면 이기는가"를 끝에서부터 따진다.
// 한 번 따진 자리는 적어 둔다. 이기는 수를 하나 찾으면 그 자리는 더 따지지 않는다. 지름길 규칙은 쓰지 않는다.
// 칸이 25개 이하라 비트 하나에 다 든다. 5×5도 자리 20만 개 안쪽에서 끝난다(테스트가 잰다).
// 다른 방법(글자 판에 규칙을 따로 적고 적어 두지 않고 모두 따지는 탐색)으로 다시 구한 값과 테스트에서 견준다.
import { latestById } from './level.js';
import { createRng, randInt, seedFrom } from './rng.js';

export const SIDES = ['vert', 'horz'];

/** 판의 크기(임시). 풀이 프로그램이 모든 자리를 바로 따질 수 있는 크기만 넣는다(5×5까지) */
export const LIMITS = { min: 2, max: 5 };

/** 끝까지 둔 게임이 이만큼 쌓이면 "왜 그럴까?"가 열린다(임시) */
export const WHY_AFTER = 2;

const whole = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

/** 다른 쪽 */
export const otherSide = (side) => (side === 'vert' ? 'horz' : 'vert');

/** 아이가 선 쪽(role)과 먼저 둘지(order: 'first' | 'second')로, 먼저 두는 쪽 */
export const firstSideOf = (role, order) => (order === 'first' ? role : otherSide(role));

/** 판으로 쓸 수 있는 값인가. 쓸 수 있으면 null, 아니면 까닭 */
export function checkBoard(board) {
  if (!board || typeof board !== 'object') return 'board';
  if (!whole(board.w, LIMITS.min, LIMITS.max) || !whole(board.h, LIMITS.min, LIMITS.max)) return 'size';
  const { holes } = board;
  if (!Array.isArray(holes)) return 'holes';
  for (let index = 0; index < holes.length; index++) {
    if (!whole(holes[index], 0, board.w * board.h - 1)) return 'holes';
    if (index > 0 && holes[index] <= holes[index - 1]) return 'holes';
  }
  return null;
}

export const copyBoard = (board) => ({ w: board.w, h: board.h, holes: board.holes.slice() });

/** 판을 글자로 적는다(시드와 풀이 기록의 이름에 쓴다) */
export const boardKey = (board) => `${board.w}x${board.h}-${board.holes.join('.')}`;

/** 수를 글자로 적는다 */
export const moveKey = (move) => move.cells.join('.');

export const cellCount = (board) => board.w * board.h;

/** 판에서 그 쪽이 놓을 수 있는 자리 모두(빈 판 기준, 칸 번호 작은 것부터). 자리마다 [a, b] */
export function placementsOf(board, side) {
  const holes = new Set(board.holes);
  const found = [];
  for (let cell = 0; cell < cellCount(board); cell++) {
    if (holes.has(cell)) continue;
    const x = cell % board.w;
    const y = Math.floor(cell / board.w);
    if (side === 'vert' && y + 1 < board.h && !holes.has(cell + board.w)) found.push([cell, cell + board.w]);
    if (side === 'horz' && x + 1 < board.w && !holes.has(cell + 1)) found.push([cell, cell + 1]);
  }
  return found;
}

const bit = (cell) => 1 << cell;
const pairMask = ([a, b]) => (bit(a) | bit(b)) >>> 0;
const holeMask = (board) => board.holes.reduce((mask, cell) => (mask | bit(cell)) >>> 0, 0);

const bitsOf = (mask) => {
  const cells = [];
  for (let cell = 0; mask >>> cell !== 0 && cell < 32; cell++) if ((mask >>> cell) & 1) cells.push(cell);
  return cells;
};

/** 판마다 쪽별 자리의 비트 목록. 한 번 만든 것은 적어 둔다 */
const placeMemo = new Map();
function placesOf(board) {
  const key = boardKey(board);
  if (!placeMemo.has(key)) {
    const vert = placementsOf(board, 'vert');
    const horz = placementsOf(board, 'horz');
    placeMemo.set(key, { vert, horz, masks: { vert: vert.map(pairMask), horz: horz.map(pairMask) } });
  }
  return placeMemo.get(key);
}

/** 이 수가 그 쪽의 자리인가(칸이 판 안이고 방향이 맞는가. 비었는지는 보지 않는다) */
function shapeOk(board, side, move) {
  if (!move || !Array.isArray(move.cells) || move.cells.length !== 2) return false;
  const [a, b] = move.cells;
  if (!whole(a, 0, cellCount(board) - 1) || !whole(b, 0, cellCount(board) - 1)) return false;
  if (side === 'vert') return b === a + board.w;
  return b === a + 1 && a % board.w !== board.w - 1;
}

// ---- 두기 ----

/**
 * 둔 수들을 처음부터 다시 둔다.
 * @param {object} board
 * @param {object[]} trail 둔 수들
 * @param {'vert'|'horz'} first 먼저 두는 쪽
 * @returns {{ok: boolean, placed: {cells: number[], side: string}[], filled: number, empty: number, next: string|null, over: boolean, winner: string|null, loser: string|null}}
 *   ok      모두 둘 수 있는 수였는가(둘 수 없는 수를 만나면 그 앞까지의 모습이다)
 *   placed  놓인 도미노(놓은 차례대로, 어느 쪽이 놓았는지와 함께)
 *   filled  구멍과 도미노가 차지한 칸의 비트. empty 남은 빈칸의 수
 *   next    둘 차례인 쪽(끝났으면 null). over 끝났는가(둘 차례인 쪽이 놓을 곳이 없다)
 *   winner  끝났으면 이긴 쪽, loser 놓을 곳이 없어 진 쪽
 */
export function replay(board, trail, first) {
  const places = placesOf(board);
  let filled = holeMask(board);
  const placed = [];
  let ok = Array.isArray(trail) && SIDES.includes(first);
  let side = first;
  const canMove = (who, mask) => places.masks[who].some((item) => (item & mask) === 0);
  if (ok) {
    for (const move of trail) {
      if (!canMove(side, filled) || !shapeOk(board, side, move)) {
        ok = false;
        break;
      }
      const mask = pairMask(move.cells);
      if ((mask & filled) !== 0) {
        ok = false;
        break;
      }
      filled = (filled | mask) >>> 0;
      placed.push({ cells: move.cells.slice(), side });
      side = otherSide(side);
    }
  }
  const stuck = SIDES.includes(side) ? !canMove(side, filled) : true;
  const empty = cellCount(board) - bitsOf(filled).length;
  return { ok, placed, filled, empty, next: stuck ? null : side, over: stuck, winner: stuck ? otherSide(side) : null, loser: stuck ? side : null };
}

/** 빈 칸에서 그 쪽이 놓을 수 있는 자리(비트 filled 기준) */
function freePlaces(board, side, filled) {
  const places = placesOf(board);
  return places[side].filter((_, index) => (places.masks[side][index] & filled) === 0);
}

/** 지금 둘 차례인 쪽이 둘 수 있는 수 모두. 끝났으면 빈 목록이다 */
export function movesOf(board, trail, first) {
  const now = replay(board, trail, first);
  if (!now.ok || now.over) return [];
  return freePlaces(board, now.next, now.filled).map((cells) => ({ cells: cells.slice() }));
}

/** 처음 판에서 그 쪽이 놓을 수 있는 자리의 수 */
export const placeCount = (board, side) => placesOf(board)[side].length;

/** 두 쪽 모두 처음에 놓을 곳이 하나 이상 있는 판인가(직접 만든 판을 두어 볼 수 있는가) */
export const playable = (board) => checkBoard(board) === null && placeCount(board, 'vert') > 0 && placeCount(board, 'horz') > 0;

// ---- 한쪽만 놓을 수 있는 자리 ----

/**
 * 그 쪽만 놓을 수 있는 자리: 두 칸 모두 상대 방향으로는 덮일 수 없는(양옆이 구멍, 도미노, 판 끝인) 자리.
 * 칸은 차기만 하고 비지 않으므로 한 번 이런 자리가 되면 끝까지 상대가 빼앗을 수 없다.
 * 겹치지 않게 고른 자리들이다: 세로는 줄마다(가로는 행마다) 그런 칸이 이어진 토막을 위에서부터(왼쪽부터) 두 칸씩 묶는다.
 * 그래서 목록의 길이가 곧 그 쪽이 이 자리들에만 놓을 수 있는 가장 많은 수다.
 * @returns {number[][]} 자리마다 [a, b]
 */
export function safeSpots(board, filled, side) {
  const { w, h } = board;
  const free = (x, y) => x >= 0 && y >= 0 && x < w && y < h && ((filled >>> (y * w + x)) & 1) === 0;
  const spots = [];
  if (side === 'vert') {
    for (let x = 0; x < w; x++) {
      let run = [];
      const close = () => {
        for (let index = 0; index + 1 < run.length; index += 2) spots.push([run[index], run[index + 1]]);
        run = [];
      };
      for (let y = 0; y < h; y++) {
        if (free(x, y) && !free(x - 1, y) && !free(x + 1, y)) run.push(y * w + x);
        else close();
      }
      close();
    }
  } else {
    for (let y = 0; y < h; y++) {
      let run = [];
      const close = () => {
        for (let index = 0; index + 1 < run.length; index += 2) spots.push([run[index], run[index + 1]]);
        run = [];
      };
      for (let x = 0; x < w; x++) {
        if (free(x, y) && !free(x, y - 1) && !free(x, y + 1)) run.push(y * w + x);
        else close();
      }
      close();
    }
  }
  return spots.sort((a, b) => a[0] - b[0]);
}

/** 둔 수들의 끝 자리에서 두 쪽의 "한쪽만 놓을 수 있는 자리" */
export function safeOf(board, trail, first) {
  const now = replay(board, trail, first);
  return { vert: safeSpots(board, now.filled, 'vert'), horz: safeSpots(board, now.filled, 'horz') };
}

/** 이 자리의 두 칸이 모두 상대 방향으로는 덮일 수 없는 칸인가(그 쪽만 놓을 수 있는 자리에 놓는 수인가) */
export function isSafeMove(board, filled, side, cells) {
  const { w, h } = board;
  const free = (x, y) => x >= 0 && y >= 0 && x < w && y < h && ((filled >>> (y * w + x)) & 1) === 0;
  return cells.every((cell) => {
    const x = cell % w;
    const y = Math.floor(cell / w);
    return side === 'vert' ? !free(x - 1, y) && !free(x + 1, y) : !free(x, y - 1) && !free(x, y + 1);
  });
}

// ---- 풀이 프로그램 ----

/** 판마다의 풀이 기록 */
const solvers = new Map();

/**
 * 판 하나의 풀이 프로그램. win(filled, side)는 side가 둘 차례인 자리에서 side가 잘 두면 이기는지를 돌려준다.
 * 적어 두는 이름은 filled * 2 + (세로면 0, 가로면 1)이다(칸이 25개 이하라 겹치지 않는다).
 */
function makeSolver(board) {
  const { masks } = placesOf(board);
  const lists = [masks.vert, masks.horz];
  const memo = new Map();
  function win(filled, turn) {
    const key = filled * 2 + turn;
    const known = memo.get(key);
    if (known !== undefined) return known;
    const list = lists[turn];
    let result = false;
    for (let index = 0; index < list.length; index++) {
      const mask = list[index];
      if ((mask & filled) !== 0) continue;
      if (!win((filled | mask) >>> 0, 1 - turn)) {
        result = true;
        break;
      }
    }
    memo.set(key, result);
    return result;
  }
  return { win: (filled, side) => win(filled >>> 0, side === 'vert' ? 0 : 1), size: () => memo.size };
}

function solverOf(board) {
  const key = boardKey(board);
  if (!solvers.has(key)) solvers.set(key, makeSolver(board));
  return solvers.get(key);
}

/** 이 자리에서 둘 다 잘 두면 어느 쪽이 이기는가. 끝난 자리면 이긴 쪽이다 */
export function winnerAt(board, trail, first) {
  const now = replay(board, trail, first);
  if (now.over) return now.winner;
  return solverOf(board).win(now.filled, now.next) ? now.next : otherSide(now.next);
}

/** 둘 차례인 쪽의 이기는 수: 두고 나서도 잘 두면 그쪽이 이기는 수들. 질 자리에서는 빈 목록이다 */
export function winningMoves(board, trail, first) {
  const now = replay(board, trail, first);
  if (!now.ok || now.over) return [];
  const solver = solverOf(board);
  return freePlaces(board, now.next, now.filled)
    .filter((cells) => !solver.win((now.filled | pairMask(cells)) >>> 0, otherSide(now.next)))
    .map((cells) => ({ cells: cells.slice() }));
}

/** 자리의 수를 세는 데에만 쓰는 새 풀이 기록(앞서 따진 자리와 섞이지 않게) */
const solveMemo = new Map();

/**
 * 판을 푼다: 세로가 먼저 둘 때와 가로가 먼저 둘 때, 둘 다 잘 두면 어느 쪽이 이기는가.
 * @returns {{vert: string, horz: string, kind: 'first'|'second'|'vert'|'horz', positions: number}}
 *   vert  세로가 먼저 두면 이기는 쪽. horz 가로가 먼저 두면 이기는 쪽
 *   kind  'first'(먼저 두는 쪽이 이긴다) | 'second'(나중에 두는 쪽이 이긴다) | 'vert'(누가 먼저 두어도 세로) | 'horz'(누가 먼저 두어도 가로)
 *   positions 두 처음 자리를 따지면서 적어 둔 자리의 수(새 기록으로 따졌을 때)
 */
export function solve(board) {
  const key = boardKey(board);
  if (!solveMemo.has(key)) {
    const fresh = makeSolver(board);
    const start = holeMask(board);
    const vert = fresh.win(start, 'vert') ? 'vert' : 'horz';
    const horz = fresh.win(start, 'horz') ? 'horz' : 'vert';
    const kind = vert === 'vert' && horz === 'horz' ? 'first' : vert === 'horz' && horz === 'vert' ? 'second' : vert;
    solveMemo.set(key, { vert, horz, kind, positions: fresh.size() });
    // 이 판을 처음 푸는 것이면 따져 둔 자리를 선생님이 둘 때도 그대로 쓴다(5×5의 첫 수가 바로 나오게).
    if (!solvers.has(key)) solvers.set(key, fresh);
  }
  return { ...solveMemo.get(key) };
}

/** 아이가 role 쪽에 서서 order('first' | 'second')로 둘 때, 둘 다 잘 두면 아이가 이기는가 */
export const seatWins = (solution, role, order) => solution[firstSideOf(role, order)] === role;

/** 아이가 이기는 자리(쪽과 먼저 둘지)의 목록. 늘 둘이다(한 판에서 두 사람 가운데 한 사람만 이긴다) */
export function winningSeats(solution) {
  const seats = [];
  for (const role of SIDES) for (const order of ['first', 'second']) if (seatWins(solution, role, order)) seats.push({ role, order });
  return seats;
}

// ---- 선생님(컴퓨터)과 두기 ----

/**
 * 컴퓨터가 두는 수. 이길 수 있는 자리에서는 이기는 수 가운데서 시드 난수로 고른다.
 * 질 자리에서는 상대(아이)의 이기는 대답이 가장 적게 남는 수들 가운데서 고른다(잘 두는 상대도 한 번 더 생각해야 하게).
 * 더 둘 수 없으면 null.
 */
export function pickMove(board, trail, first, rng) {
  const winning = winningMoves(board, trail, first);
  if (winning.length > 0) return winning[randInt(rng, 0, winning.length - 1)];
  const moves = movesOf(board, trail, first);
  if (moves.length === 0) return null;
  const scores = moves.map((move) => winningMoves(board, [...trail, move], first).length);
  const least = Math.min(...scores);
  const list = moves.filter((_, index) => scores[index] === least);
  return list[randInt(rng, 0, list.length - 1)];
}

/**
 * 선생님의 다음 수. 같은 (단계, 판 번호, 아이가 선 쪽, 먼저 두는 쪽, 지금까지 둔 수들)이면 늘 같은 수를 둔다.
 * 직접 만든 판과 작은 판은 판 번호가 없으므로 판의 모습을 시드로 쓴다.
 */
export function teacherMove(board, trail, { level = null, seed = null, role = 'vert', first = 'vert' } = {}) {
  const now = replay(board, trail, first);
  if (!now.ok || now.over) return null;
  const rng = createRng(seedFrom('domino-move', level ?? 'make', seed ?? boardKey(board), role, first, trail.map(moveKey).join(',')));
  return pickMove(board, trail, first, rng);
}

/**
 * 아이가 이기는 자리에서 지는 자리로 보낸 수. 몇 번째 수인지(1부터)의 목록이다.
 * @param {'vert'|'horz'} role 아이가 선 쪽
 */
export function slipsOf(board, trail, first, role) {
  const slips = [];
  for (let index = 0; index < trail.length; index++) {
    const before = trail.slice(0, index);
    const now = replay(board, before, first);
    if (!now.ok || now.over) break;
    if (now.next !== role) continue;
    const after = [...before, trail[index]];
    if (!replay(board, after, first).ok) break;
    if (winnerAt(board, before, first) === role && winnerAt(board, after, first) !== role) slips.push(index + 1);
  }
  return slips;
}

/**
 * 아이가 둘 수 있는 수 가운데 하나를 고르게 뽑아 두기를 되풀이할 때 아이가 이기는 비율(모든 경우를 따진 값).
 * 선생님은 앱에서 두는 대로 둔다(이기는 수가 있으면 그 가운데서, 없으면 아이의 이기는 대답이 가장 적게 남는 수들 가운데서 고르게).
 */
export function randomKidWinRate(board, role, first) {
  const memo = new Map();
  const rate = (trail) => {
    const now = replay(board, trail, first);
    if (now.over) return now.winner === role ? 1 : 0;
    const key = `${now.filled}:${now.next}`;
    if (memo.has(key)) return memo.get(key);
    let list = movesOf(board, trail, first);
    if (now.next !== role) {
      const winning = winningMoves(board, trail, first);
      if (winning.length > 0) list = winning;
      else {
        const scores = list.map((move) => winningMoves(board, [...trail, move], first).length);
        const least = Math.min(...scores);
        list = list.filter((_, index) => scores[index] === least);
      }
    }
    const value = list.reduce((sum, move) => sum + rate([...trail, move]), 0) / list.length;
    memo.set(key, value);
    return value;
  };
  return rate([]);
}

// ---- 작은 판: 틀의 "더 작은 판으로"가 이 목록을 차례로 낸다(src/core/smaller.js) ----

/**
 * 원래 판에서 잘라 낸 판이 맞지 않을 때 쓰는 작은 판들(구멍이 있으면 그 자리). 네 꼴(먼저, 나중, 늘 세로, 늘 가로)이 모두 들어 있다.
 * 꼴은 여기에 적지 않고 풀이 프로그램이 따진다(테스트가 네 꼴이 모두 있는지 본다).
 */
export const SMALL_SHELF = [
  [3, 3, []],
  [3, 2, []],
  [2, 3, []],
  [3, 4, []],
  [4, 3, []],
  [2, 4, []],
  [4, 2, []],
  [4, 4, [0, 15]],
  [4, 4, [3, 12]],
  [4, 4, [5, 10]],
  [3, 3, [4]],
  [4, 4, []],
];

/** 작은 판으로 쓸 만한가: 두 쪽 모두 처음에 놓을 곳이 둘 이상 있다 */
const lively = (board) => placeCount(board, 'vert') >= 2 && placeCount(board, 'horz') >= 2;
const freeCount = (board) => cellCount(board) - board.holes.length;

/** 판의 한 부분(가로 ox부터 w칸, 세로 oy부터 h칸)을 잘라 낸 판. 원래 판의 구멍은 그대로 남는다 */
export function cropBoard(board, ox, oy, w, h) {
  const holes = [];
  for (const cell of board.holes) {
    const x = (cell % board.w) - ox;
    const y = Math.floor(cell / board.w) - oy;
    if (x >= 0 && y >= 0 && x < w && y < h) holes.push(y * w + x);
  }
  return { w, h, holes: holes.sort((a, b) => a - b) };
}

const smallMemo = new Map();

/**
 * 원래 판보다 빈칸이 적고, 잘 두었을 때 이기는 꼴(먼저 두는 쪽, 나중, 늘 세로, 늘 가로)이 같은 판들.
 * 먼저 원래 판에서 잘라 낸 판(구멍은 그대로)을 빈칸이 많은 것부터 내고, 그다음에 SMALL_SHELF의 판을 낸다.
 * 그래서 아이가 서 있던 자리(쪽과 먼저 둘지)는 작은 판에서도 이기거나 지는 것이 같다.
 */
export function smallBoards(board) {
  const key = boardKey(board);
  if (smallMemo.has(key)) return smallMemo.get(key).map(copyBoard);
  const kind = solve(board).kind;
  const free = freeCount(board);
  const seen = new Set();
  const cropped = [];
  for (let h = board.h; h >= LIMITS.min; h--) {
    for (let w = board.w; w >= LIMITS.min; w--) {
      for (let oy = 0; oy + h <= board.h; oy++) {
        for (let ox = 0; ox + w <= board.w; ox++) {
          const small = cropBoard(board, ox, oy, w, h);
          const name = boardKey(small);
          if (seen.has(name) || freeCount(small) >= free || !lively(small)) continue;
          seen.add(name);
          if (solve(small).kind === kind) cropped.push(small);
        }
      }
    }
  }
  cropped.sort((a, b) => freeCount(b) - freeCount(a) || cellCount(b) - cellCount(a));
  const shelf = SMALL_SHELF.map(([w, h, holes]) => ({ w, h, holes: holes.slice() })).filter((small) => {
    const name = boardKey(small);
    if (seen.has(name) || freeCount(small) >= free || !lively(small)) return false;
    seen.add(name);
    return solve(small).kind === kind;
  });
  const found = [...cropped, ...shelf];
  smallMemo.set(key, found);
  return found.map(copyBoard);
}

// ---- 지난 기록: "왜 그럴까?"가 열리는 때, 연달아 진 판 ----

/** 끝까지 둔 게임들(오래된 것부터). 이긴 판도 진 판도 들어간다. 작은 판(곁판)은 세지 않는다 */
function finishedGames(records) {
  if (!Array.isArray(records)) return [];
  return latestById(records).filter(
    (record) => record.kind === 'round' && record.format === 'domino' && record.side !== true && record.outcome === 'solved' && (record.winner === 'kid' || record.winner === 'teacher'),
  );
}

/** 끝까지 둔 게임의 수 */
export function finishedCount(records) {
  return finishedGames(records).length;
}

/** "왜 그럴까?"를 열어도 되는가: 게임을 WHY_AFTER판 끝까지 둔 뒤에 열린다(임시) */
export function whyOpen(records) {
  return finishedCount(records) >= WHY_AFTER;
}

/** 맨 뒤에서부터 연달아 진 게임의 수. 화면에 보여 주지 않는다. 자리를 바꿔 보기를 권할 때만 쓴다 */
export function lostStreak(records) {
  const games = finishedGames(records);
  let streak = 0;
  while (streak < games.length && games[games.length - 1 - streak].winner === 'teacher') streak += 1;
  return streak;
}

export { bitsOf };
