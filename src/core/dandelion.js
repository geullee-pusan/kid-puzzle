// 민들레와 바람: 판의 규칙과 풀이 프로그램. 순수 함수만 둔다.
//
// 판(board)의 꼴은 둘이다.
//   게임      { kind: 'game', w, h, dirs }          dirs는 4(위, 오른쪽, 아래, 왼쪽) 또는 8(대각선 넷을 더한다)
//   혼자 덮기 { kind: 'cover', w, h, dirs, order }  order는 바람이 부는 차례(방향 번호들). 방향마다 한 번씩 모두 분다
// 칸 번호는 위 왼쪽부터 가로로 센다(가로 x, 세로 y이면 y * w + x).
// 방향 번호: 0 위, 1 오른쪽, 2 아래, 3 왼쪽, 4 오른쪽 위, 5 오른쪽 아래, 6 왼쪽 아래, 7 왼쪽 위.
//
// 게임의 규칙(이 앱에서 새로 정했다)
//   - 꽃 쪽과 바람 쪽이 번갈아 둔다. 꽃 쪽이 먼저다.
//   - 꽃 쪽은 빈칸(꽃도 씨앗도 없는 칸) 하나에 꽃을 심는다.
//   - 바람 쪽은 아직 불지 않은 방향 하나를 고른다. 판의 모든 꽃에서 그 방향으로 판 끝까지 씨앗이 날아가 지나는 칸을 모두 덮는다.
//     씨앗은 꽃이나 씨앗이 있는 칸도 그냥 지나간다(막히지 않는다). 씨앗은 다시 날지 않는다. 날리는 것은 꽃뿐이다.
//   - 판이 다 덮이면(빈칸이 없으면) 그 자리에서 끝나고 꽃 쪽이 이긴다. 꽃을 심어서 다 덮여도 같다.
//   - 방향을 다 쓴 뒤에 빈칸이 남아 있으면 바람 쪽이 이긴다. 그래서 꽃은 많아야 방향의 수만큼 심는다.
// 혼자 덮기의 규칙
//   - 바람이 정해진 차례(order)로 하나씩 분다. 바람이 불기 전마다 빈칸에 꽃을 하나 심을 수 있다(안 심어도 된다).
//   - 판이 다 덮이면 끝난다. 심은 꽃이 적을수록 좋다. 바람이 다 불었는데 빈칸이 남으면 덮지 못한 것이다.
//
// 수(move)는 { plant: 칸 번호 } 또는 { wind: 방향 번호 }다. 둔 수들(trail)은 처음부터의 차례다.
//
// 풀이 프로그램(게임): 자리(꽃이 있는 칸, 덮인 칸, 이미 분 방향, 둘 차례)마다 "잘 두면 어느 쪽이 이기는가"를
// 끝에서부터 따진다(한 번 따진 자리는 적어 둔다). 지름길 규칙은 쓰지 않는다. 다른 방법으로 다시 구한 값과 테스트에서 견준다.
// 풀이 프로그램(혼자 덮기): 꽃을 일찍 심을수록 바람을 더 받으므로, 꽃 k송이로 덮을 수 있으면 처음 k번의 바람 앞에 한 송이씩 심어서도 덮을 수 있다.
// 그래서 k = 1, 2, …의 차례로 처음 k번에 심는 칸을 모두 해 보고, 덮이는 가장 작은 k를 찾는다.
// (일찍 심는 쪽이 늘 낫다는 것은 테스트가 "아무 때나 심거나 건너뛰는" 다른 탐색으로 확인한다.)
import { latestById } from './level.js';
import { createRng, randInt, seedFrom } from './rng.js';

/** 방향마다 한 칸 움직이는 값 [가로, 세로] */
export const DIRS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
  [1, -1],
  [1, 1],
  [-1, 1],
  [-1, -1],
];

/** 방향의 수마다 쓰는 방향 번호 */
export const DIR_SETS = { 4: [0, 1, 2, 3], 8: [0, 1, 2, 3, 4, 5, 6, 7] };

/**
 * 판의 크기(임시). 풀이 프로그램이 모든 자리를 따질 수 있는 크기만 넣는다.
 * 네 방향은 가로, 세로 2~5칸, 여덟 방향은 2~4칸이다. 모든 첫 수를 끝까지 따져도 네 방향 5×5와 여덟 방향 4×4는 자리가 12만여 개라 바로 끝난다.
 * 여덟 방향 5×5는 자리가 170만 개가 넘어 태블릿에서 오래 걸려 넣지 않았다.
 */
export const LIMITS = { min: 2, max: 5, eightMax: 4 };

/** 끝까지 둔 게임이 이만큼 쌓이면 "왜 그럴까?"가 열린다(임시) */
export const WHY_AFTER = 2;

const SIDES = ['flower', 'wind'];
const whole = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

/** 판으로 쓸 수 있는 값인가. 쓸 수 있으면 null, 아니면 까닭 */
export function checkBoard(board) {
  if (!board || typeof board !== 'object') return 'board';
  if (board.kind !== 'game' && board.kind !== 'cover') return 'kind';
  if (board.dirs !== 4 && board.dirs !== 8) return 'dirs';
  const max = board.dirs === 8 ? LIMITS.eightMax : LIMITS.max;
  if (!whole(board.w, LIMITS.min, max) || !whole(board.h, LIMITS.min, max)) return 'size';
  if (board.kind === 'cover') {
    const order = board.order;
    if (!Array.isArray(order) || order.length !== board.dirs) return 'order';
    const sorted = order.slice().sort((a, b) => a - b);
    if (sorted.join(',') !== DIR_SETS[board.dirs].join(',')) return 'order';
  }
  return null;
}

export function copyBoard(board) {
  const copy = { kind: board.kind, w: board.w, h: board.h, dirs: board.dirs };
  if (board.kind === 'cover') copy.order = board.order.slice();
  return copy;
}

/** 판을 글자로 적는다(시드와 견주기에 쓴다) */
export function boardKey(board) {
  const base = `${board.kind}-${board.w}x${board.h}-${board.dirs}`;
  return board.kind === 'cover' ? `${base}-${board.order.join('')}` : base;
}

/** 수를 글자로 적는다 */
export const moveKey = (move) => ('plant' in move ? `p${move.plant}` : `w${move.wind}`);

/** 이 판에서 부는 방향들(혼자 덮기는 부는 차례대로) */
export const dirsOf = (board) => (board.kind === 'cover' ? board.order.slice() : DIR_SETS[board.dirs].slice());

export const cellCount = (board) => board.w * board.h;

/** 칸에서 그 방향으로 판 끝까지 지나는 칸들(그 칸은 빼고, 가까운 것부터) */
export function rayCells(board, cell, dir) {
  const [dx, dy] = DIRS[dir];
  const found = [];
  let x = (cell % board.w) + dx;
  let y = Math.floor(cell / board.w) + dy;
  while (x >= 0 && y >= 0 && x < board.w && y < board.h) {
    found.push(y * board.w + x);
    x += dx;
    y += dy;
  }
  return found;
}

// ---- 칸들을 비트로 다룬다(칸이 25개 이하라 32비트 안에 든다) ----

/** 판마다 방향과 칸에 대한 "날아가는 칸들"의 비트 표. 한 번 만든 것은 적어 둔다 */
const rayMemo = new Map();
function raysOf(board) {
  const key = `${board.w}x${board.h}`;
  if (!rayMemo.has(key)) {
    rayMemo.set(
      key,
      DIRS.map((_, dir) => Array.from({ length: cellCount(board) }, (__, cell) => rayCells(board, cell, dir).reduce((mask, at) => (mask | (1 << at)) >>> 0, 0))),
    );
  }
  return rayMemo.get(key);
}

const fullMask = (board) => (cellCount(board) === 32 ? 0xffffffff : (1 << cellCount(board)) - 1) >>> 0;

/** 꽃들(비트)에서 그 방향으로 씨앗이 날아가 덮는 칸들(비트) */
function spreadMask(rays, flowers, dir) {
  let mask = 0;
  for (let rest = flowers; rest !== 0; rest &= rest - 1) {
    const cell = 31 - Math.clz32(rest & -rest);
    mask |= rays[dir][cell];
  }
  return mask >>> 0;
}

const bitsOf = (mask) => {
  const cells = [];
  for (let cell = 0; mask >>> cell !== 0 && cell < 32; cell++) if ((mask >>> cell) & 1) cells.push(cell);
  return cells;
};
const countBits = (mask) => bitsOf(mask).length;

// ---- 두기 ----

/**
 * 둔 수들을 처음부터 다시 둔다.
 * @returns {{ok: boolean, flowers: number[], seeds: number[], empty: number, used: number[], over: boolean, winner: 'flower'|'wind'|null, next: 'flower'|'wind'|null, planted: boolean, fresh: object|null}}
 *   ok       모두 둘 수 있는 수였는가(둘 수 없는 수를 만나면 그 앞까지의 모습이다)
 *   flowers  꽃이 있는 칸(심은 차례대로), seeds 씨앗만 있는 칸(작은 것부터), empty 빈칸의 수, used 분 방향(분 차례대로)
 *   over     끝났는가. winner 끝났으면 이긴 쪽(혼자 덮기에서는 다 덮었으면 'flower', 못 덮었으면 'wind')
 *   next     게임에서 둘 차례인 쪽(끝났으면 null). 혼자 덮기에서는 늘 null
 *   planted  혼자 덮기에서 다음 바람 앞에 이미 꽃을 심었는가
 *   fresh    마지막 수의 자국: { plant: 칸 } 또는 { wind: 방향, cells: 새로 덮인 칸들 }
 */
export function replay(board, trail) {
  const rays = raysOf(board);
  const full = fullMask(board);
  const order = dirsOf(board);
  let flowers = [];
  let fmask = 0;
  let covered = 0;
  const used = [];
  let planted = false;
  let fresh = null;
  let ok = Array.isArray(trail);
  let applied = 0;
  const state = () => {
    const done = covered === full;
    const windsOut = used.length === order.length;
    const over = done || windsOut;
    const winner = done ? 'flower' : windsOut ? 'wind' : null;
    let next = null;
    if (board.kind === 'game' && !over) next = applied % 2 === 0 ? 'flower' : 'wind';
    return { ok, flowers: flowers.slice(), seeds: bitsOf((covered & ~fmask) >>> 0), empty: countBits((full & ~covered) >>> 0), used: used.slice(), over, winner, next, planted, fresh };
  };
  if (!ok) return state();
  for (let index = 0; index < trail.length; index++) {
    const move = trail[index];
    const over = covered === full || used.length === order.length;
    if (over || !move || typeof move !== 'object') {
      ok = false;
      break;
    }
    // 게임에서는 꽃과 바람이 번갈아 둔다(꽃이 먼저). 혼자 덮기에서는 바람 앞에 꽃을 하나까지 심는다.
    const wantPlant = board.kind === 'game' ? index % 2 === 0 : null;
    if ('plant' in move) {
      const cell = move.plant;
      if (wantPlant === false || (board.kind === 'cover' && planted) || !whole(cell, 0, cellCount(board) - 1) || (covered >>> cell) & 1) {
        ok = false;
        break;
      }
      flowers.push(cell);
      fmask = (fmask | (1 << cell)) >>> 0;
      covered = (covered | (1 << cell)) >>> 0;
      planted = true;
      fresh = { plant: cell };
    } else if ('wind' in move) {
      const dir = move.wind;
      const allowed = board.kind === 'cover' ? dir === order[used.length] : order.includes(dir) && !used.includes(dir);
      if (wantPlant === true || !allowed) {
        ok = false;
        break;
      }
      const reach = spreadMask(rays, fmask, dir);
      fresh = { wind: dir, cells: bitsOf((reach & ~covered) >>> 0) };
      covered = (covered | reach) >>> 0;
      used.push(dir);
      planted = false;
    } else {
      ok = false;
      break;
    }
    applied += 1;
  }
  return state();
}

/** 게임에서 지금 둘 수 있는 수 모두. 끝났으면 빈 목록이다 */
export function movesOf(board, trail) {
  const now = replay(board, trail);
  if (!now.ok || now.over) return [];
  if (board.kind === 'game' && now.next === 'wind') return dirsOf(board).filter((dir) => !now.used.includes(dir)).map((dir) => ({ wind: dir }));
  const busy = new Set([...now.flowers, ...now.seeds]);
  const plants = [];
  for (let cell = 0; cell < cellCount(board); cell++) if (!busy.has(cell)) plants.push({ plant: cell });
  if (board.kind === 'game') return plants;
  // 혼자 덮기: 바람 앞에 꽃을 하나 심거나, 심지 않고(또는 심은 뒤에) 다음 바람을 분다.
  const wind = { wind: board.order[now.used.length] };
  return now.planted ? [wind] : [...plants, wind];
}

// ---- 풀이 프로그램(게임) ----

/** 판마다의 풀이 기록. 자리마다 "꽃 쪽이 이기는가"를 적어 둔다 */
const solvers = new Map();

/**
 * 판 하나의 풀이 프로그램. 자리는 (꽃의 비트, 덮인 칸의 비트, 분 방향의 비트)다. 둘 차례에 따라 적는 곳을 나눈다.
 * flowerTurn(…)은 꽃 쪽이 심을 차례, windTurn(…)은 바람 쪽이 불 차례의 자리에서 꽃 쪽이 이기는지를 돌려준다.
 */
function makeSolver(board) {
  const rays = raysOf(board);
  const full = fullMask(board);
  const dirs = DIR_SETS[board.dirs];
  const all = dirs.reduce((mask, dir) => mask | (1 << dir), 0);
  const n = cellCount(board);
  const memo = { flower: new Map(), wind: new Map() };
  const keyOf = (flowers, covered) => flowers * 33554432 + covered;
  const look = (table, used, key) => table.get(used)?.get(key);
  const keep = (table, used, key, value) => {
    if (!table.has(used)) table.set(used, new Map());
    table.get(used).set(key, value);
  };
  let size = 0;
  function flowerTurn(flowers, covered, used) {
    if (covered === full) return true;
    if (used === all) return false;
    const key = keyOf(flowers, covered);
    const known = look(memo.flower, used, key);
    if (known !== undefined) return known;
    // 꽃을 심어서 바람 쪽이 지는 자리로 보낼 수 있으면 꽃 쪽이 이긴다.
    let win = false;
    for (let cell = 0; cell < n && !win; cell++) {
      if ((covered >>> cell) & 1) continue;
      if (windTurn((flowers | (1 << cell)) >>> 0, (covered | (1 << cell)) >>> 0, used)) win = true;
    }
    keep(memo.flower, used, key, win);
    size += 1;
    return win;
  }
  function windTurn(flowers, covered, used) {
    if (covered === full) return true;
    const key = keyOf(flowers, covered);
    const known = look(memo.wind, used, key);
    if (known !== undefined) return known;
    // 어느 방향으로 불어도 꽃 쪽이 이기는 자리로 가면 꽃 쪽이 이긴다.
    let win = true;
    for (const dir of dirs) {
      if ((used >>> dir) & 1) continue;
      if (!flowerTurn(flowers, (covered | spreadMask(rays, flowers, dir)) >>> 0, used | (1 << dir))) {
        win = false;
        break;
      }
    }
    keep(memo.wind, used, key, win);
    size += 1;
    return win;
  }
  return { flowerTurn, windTurn, size: () => size };
}

function solverOf(board) {
  const key = boardKey(board);
  if (!solvers.has(key)) solvers.set(key, makeSolver(board));
  return solvers.get(key);
}

/** 둔 수들의 끝 자리를 비트로 */
function masksOf(board, trail) {
  const now = replay(board, trail);
  const fmask = now.flowers.reduce((mask, cell) => (mask | (1 << cell)) >>> 0, 0);
  const covered = [...now.flowers, ...now.seeds].reduce((mask, cell) => (mask | (1 << cell)) >>> 0, 0);
  const used = now.used.reduce((mask, dir) => mask | (1 << dir), 0);
  return { now, fmask, covered, used };
}

/** 이 자리에서 둘 다 잘 두면 어느 쪽이 이기는가('flower' | 'wind'). 끝난 자리면 이긴 쪽이다 */
export function winnerAt(board, trail) {
  const { now, fmask, covered, used } = masksOf(board, trail);
  if (now.over) return now.winner;
  const solver = solverOf(board);
  const flowerWins = now.next === 'flower' ? solver.flowerTurn(fmask, covered, used) : solver.windTurn(fmask, covered, used);
  return flowerWins ? 'flower' : 'wind';
}

/** 둘 차례인 쪽의 이기는 수: 두고 나서도 잘 두면 그쪽이 이기는 수들. 질 자리에서는 빈 목록이다 */
export function winningMoves(board, trail) {
  const now = replay(board, trail);
  if (!now.ok || now.over) return [];
  return movesOf(board, trail).filter((move) => winnerAt(board, [...trail, move]) === now.next);
}

/** 자리의 수를 세는 데에만 쓰는 새 풀이 기록(앞서 따진 자리와 섞이지 않게) */
const countMemo = new Map();

/**
 * 판을 푼다: 둘 다 잘 두었을 때 어느 쪽이 이기는가.
 * @returns {{winner: 'flower'|'wind', positions: number}} positions: 처음 자리를 따질 때 적어 둔 자리의 수(새 기록으로 따졌을 때)
 */
export function solve(board) {
  const key = boardKey(board);
  if (!countMemo.has(key)) {
    const fresh = makeSolver(board);
    const flower = fresh.flowerTurn(0, 0, 0);
    countMemo.set(key, { winner: flower ? 'flower' : 'wind', positions: fresh.size() });
  }
  return { ...countMemo.get(key) };
}

// ---- 선생님(컴퓨터)과 두기 ----

/** 다른 쪽 */
export const otherSide = (side) => (side === 'flower' ? 'wind' : 'flower');

/** 아이가 role 쪽일 때, 그 쪽(side)을 두는 사람 */
export const whoPlays = (role, side) => (side === role ? 'kid' : 'teacher');

/**
 * 컴퓨터가 두는 수. 이길 수 있는 자리에서는 이기는 수 가운데서, 질 자리에서는 둘 수 있는 수 가운데서 시드 난수로 고른다.
 * 더 둘 수 없으면 null.
 */
export function pickMove(board, trail, rng) {
  const winning = winningMoves(board, trail);
  const list = winning.length > 0 ? winning : movesOf(board, trail);
  return list.length === 0 ? null : list[randInt(rng, 0, list.length - 1)];
}

/**
 * 선생님의 다음 수. 같은 (단계, 판 번호, 아이가 선 쪽, 지금까지 둔 수들)이면 늘 같은 수를 둔다.
 * 직접 만든 판과 작은 판은 판 번호가 없으므로 판의 모습을 시드로 쓴다.
 */
export function teacherMove(board, trail, { level = null, seed = null, role = 'flower' } = {}) {
  const now = replay(board, trail);
  if (!now.ok || now.over) return null;
  const rng = createRng(seedFrom('dandelion-move', level ?? 'make', seed ?? boardKey(board), role, trail.map(moveKey).join(',')));
  return pickMove(board, trail, rng);
}

/**
 * 아이가 이기는 자리에서 지는 자리로 보낸 수. 몇 번째 수인지(1부터)의 목록이다.
 * @param {'flower'|'wind'} role 아이가 선 쪽
 */
export function slipsOf(board, trail, role) {
  const slips = [];
  for (let index = 0; index < trail.length; index++) {
    const before = trail.slice(0, index);
    const now = replay(board, before);
    if (!now.ok || now.over) break;
    if (now.next !== role) continue;
    const after = [...before, trail[index]];
    if (!replay(board, after).ok) break;
    if (winnerAt(board, before) === role && winnerAt(board, after) !== role) slips.push(index + 1);
  }
  return slips;
}

/**
 * 아이가 둘 수 있는 수 가운데 하나를 고르게 뽑아 두기를 되풀이할 때 아이가 이기는 비율(모든 경우를 따진 값).
 * 선생님은 앱에서 두는 대로 둔다(이기는 수가 있으면 그 가운데서, 없으면 둘 수 있는 수 가운데서 고르게).
 */
export function randomKidWinRate(board, role) {
  const memo = new Map();
  const rate = (trail) => {
    const now = replay(board, trail);
    if (now.over) return now.winner === role ? 1 : 0;
    const key = [now.flowers.slice().sort((a, b) => a - b).join('.'), now.seeds.join('.'), now.used.slice().sort().join('.'), now.next].join('|');
    if (memo.has(key)) return memo.get(key);
    const moves = movesOf(board, trail);
    const winning = now.next === role ? [] : winningMoves(board, trail);
    const list = winning.length > 0 ? winning : moves;
    const value = list.reduce((sum, move) => sum + rate([...trail, move]), 0) / list.length;
    memo.set(key, value);
    return value;
  };
  return rate([]);
}

// ---- 풀이 프로그램(혼자 덮기) ----

const coverMemo = new Map();

/**
 * 혼자 덮기 판을 푼다: 꽃을 가장 적게 몇 송이 심으면 판을 다 덮는가.
 * @returns {{possible: boolean, best: number|null, plan: number[], tries: number}}
 *   best  가장 적은 꽃의 수(덮을 수 없으면 null). plan 그렇게 덮는 한 가지 방법(처음 best번의 바람 앞에 차례로 심는 칸)
 *   tries 해 본 심는 차례의 수
 */
export function solveCover(board) {
  const key = boardKey(board);
  if (coverMemo.has(key)) {
    const known = coverMemo.get(key);
    return { ...known, plan: known.plan.slice() };
  }
  const rays = raysOf(board);
  const full = fullMask(board);
  const order = board.order;
  const n = cellCount(board);
  let tries = 0;
  // 처음 k번의 바람 앞에 한 송이씩 심고, 나머지 바람은 그냥 분다.
  const finish = (flowers, covered, from) => {
    let now = covered;
    for (let index = from; index < order.length && now !== full; index++) now = (now | spreadMask(rays, flowers, order[index])) >>> 0;
    return now === full;
  };
  const search = (k, round, flowers, covered, plan) => {
    if (covered === full) return plan;
    if (round === k) return finish(flowers, covered, round) ? plan : null;
    for (let cell = 0; cell < n; cell++) {
      if ((covered >>> cell) & 1) continue;
      tries += 1;
      const nextFlowers = (flowers | (1 << cell)) >>> 0;
      let nextCovered = (covered | (1 << cell)) >>> 0;
      if (nextCovered !== full) nextCovered = (nextCovered | spreadMask(rays, nextFlowers, order[round])) >>> 0;
      const found = search(k, round + 1, nextFlowers, nextCovered, [...plan, cell]);
      if (found) return found;
    }
    return null;
  };
  let result = { possible: false, best: null, plan: [], tries: 0 };
  for (let k = 1; k <= order.length; k++) {
    const plan = search(k, 0, 0, 0, []);
    if (plan) {
      result = { possible: true, best: plan.length, plan, tries: 0 };
      break;
    }
  }
  result.tries = tries;
  coverMemo.set(key, result);
  return { ...result, plan: result.plan.slice() };
}

/** 혼자 덮기 판에서 plan의 칸들을 처음 바람들 앞에 차례로 심고 바람을 모두 부는 수들(풀이를 그릴 때 쓴다) */
export function planTrail(board, plan) {
  const trail = [];
  board.order.forEach((dir, index) => {
    if (index < plan.length) trail.push({ plant: plan[index] });
    trail.push({ wind: dir });
  });
  // 다 덮인 뒤의 수는 두지 않는다.
  const kept = [];
  for (const move of trail) {
    if (replay(board, kept).over) break;
    kept.push(move);
  }
  return kept;
}

// ---- 작은 판: 틀의 "더 작은 판으로"가 이 목록을 차례로 낸다(src/core/smaller.js) ----

/**
 * 같은 방향 수의, 가로와 세로가 원래보다 크지 않고 칸이 더 적은 판들(큰 것부터).
 * 게임은 잘 두었을 때 이기는 쪽이 원래 판과 같은 판만 낸다(아이가 선 쪽이 그대로 이기거나 지게).
 * 혼자 덮기는 같은 바람 차례로 덮을 수 있고, 꽃 한 송이로 끝나지 않는 판만 낸다.
 */
export function smallBoards(board) {
  const found = [];
  for (let h = board.h; h >= LIMITS.min; h--) {
    for (let w = board.w; w >= LIMITS.min; w--) {
      if (w * h >= board.w * board.h) continue;
      const small = { ...copyBoard(board), w, h };
      if (checkBoard(small) !== null) continue;
      if (board.kind === 'game') {
        if (solve(small).winner === solve(board).winner) found.push(small);
      } else {
        const solved = solveCover(small);
        if (solved.possible && solved.best >= 2) found.push(small);
      }
    }
  }
  return found.sort((a, b) => b.w * b.h - a.w * a.h || b.w - a.w);
}

// ---- 지난 기록: "왜 그럴까?"가 열리는 때, 연달아 진 판 ----

/** 끝까지 둔 게임들(오래된 것부터). 이긴 판도 진 판도 들어간다. 작은 판(곁판)은 세지 않는다 */
function finishedGames(records) {
  if (!Array.isArray(records)) return [];
  return latestById(records).filter(
    (record) => record.kind === 'round' && record.format === 'dandelion' && record.side !== true && record.mode === 'game' && record.outcome === 'solved' && (record.winner === 'kid' || record.winner === 'teacher'),
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

export { SIDES };
