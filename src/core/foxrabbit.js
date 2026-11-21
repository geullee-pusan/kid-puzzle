// 여우와 토끼: 판의 규칙과 풀이 프로그램. 순수 함수만 둔다.
//
// 판(board)은 { w, h, fox, rabbit, first }다. 가로 w칸, 세로 h칸(3~5칸)의 네모 판이고, fox와 rabbit은 처음에 여우와 토끼가 있는 칸,
// first는 먼저 움직이는 쪽('fox' | 'rabbit')이다. 먼저 움직일 쪽을 아이가 고르는 판은 first가 null이다.
// 칸 번호는 위 왼쪽부터 가로로 센다(가로 x, 세로 y이면 y * w + x).
//
// 게임의 규칙
//   - 여우와 토끼가 번갈아 위·아래·왼쪽·오른쪽으로 반드시 한 칸씩 움직인다. 제자리에 있을 수 없다.
//   - 토끼는 여우가 있는 칸에 들어갈 수 없다. 여우가 토끼 칸에 들어가면 여우가 이긴다.
//   - 여우가 (가로 + 세로 - 3)번 움직이는 동안 잡히지 않으면 토끼가 이긴다(여우가 그만큼 움직인 바로 그때 끝난다).
//   - 토끼가 움직일 곳이 없는 일은 없다(판이 3×3 이상이라 어느 칸에도 이웃이 둘 이상 있고, 여우는 그 가운데 하나만 막는다).
// 둔 수들(trail)은 움직인 동물이 들어간 칸의 차례이고, 먼저 움직이는 쪽부터 번갈아 적는다.
//
// 풀이 프로그램: 판의 크기마다, 모든 자리(여우의 칸, 토끼의 칸, 누구 차례)에서 "둘 다 잘 하면 여우가 몇 번 움직여 토끼를 잡는가"를
// 끝에서부터 한 겹씩 넓혀 가며 구한다(한 번에 잡는 자리 → 토끼가 어디로 가도 그런 자리로 가는 자리 → …). 끝내 못 잡는 자리는 null이다.
// 지름길 규칙(칸의 색)은 쓰지 않는다. 색 이야기가 맞는지는 테스트가 이 표로 확인한다.
// 다른 방법(남은 횟수를 하나씩 줄이며 앞으로 따지는 탐색)으로 다시 구한 값과 테스트에서 견준다.
import { latestById } from './level.js';
import { createRng, randInt, seedFrom } from './rng.js';

export const ANIMALS = ['fox', 'rabbit'];

/** 판의 크기(임시). 3×3부터 5×5까지 */
export const LIMITS = { min: 3, max: 5 };

/** 끝까지 둔 게임이 이만큼 쌓이면 "왜 그럴까?"가 열린다(임시) */
export const WHY_AFTER = 2;

const whole = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

/** 다른 동물 */
export const otherAnimal = (animal) => (animal === 'fox' ? 'rabbit' : 'fox');

/** 여우가 움직일 수 있는 횟수: 이만큼 움직이는 동안 못 잡으면 토끼가 이긴다(2026-11-21 정함) */
export const limitOf = (board) => board.w + board.h - 3;

export const cellCount = (board) => board.w * board.h;

/** 판으로 쓸 수 있는 값인가. 쓸 수 있으면 null, 아니면 까닭 */
export function checkBoard(board) {
  if (!board || typeof board !== 'object') return 'board';
  if (!whole(board.w, LIMITS.min, LIMITS.max) || !whole(board.h, LIMITS.min, LIMITS.max)) return 'size';
  const last = board.w * board.h - 1;
  if (!whole(board.fox, 0, last) || !whole(board.rabbit, 0, last) || board.fox === board.rabbit) return 'animals';
  if (board.first !== null && !ANIMALS.includes(board.first)) return 'first';
  return null;
}

export const copyBoard = (board) => ({ w: board.w, h: board.h, fox: board.fox, rabbit: board.rabbit, first: board.first ?? null });

/** 판을 글자로 적는다(시드와 풀이 기록의 이름에 쓴다) */
export const boardKey = (board) => `${board.w}x${board.h}-${board.fox}-${board.rabbit}-${board.first ?? 'choose'}`;

export const xyOf = (w, cell) => [cell % w, Math.floor(cell / w)];

/** 칸의 색: 바둑판처럼 칠했을 때 0(맨 위 왼쪽 칸과 같은 색) 또는 1 */
export const colorOf = (w, cell) => ((cell % w) + Math.floor(cell / w)) % 2;

/** 두 칸이 같은 색인가 */
export const sameColor = (w, a, b) => colorOf(w, a) === colorOf(w, b);

/** 두 칸 사이의 거리(가로로 떨어진 칸 수 + 세로로 떨어진 칸 수) */
export function gapOf(w, a, b) {
  const [ax, ay] = xyOf(w, a);
  const [bx, by] = xyOf(w, b);
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

/** 판에서 그 칸의 위·오른쪽·아래·왼쪽 이웃 칸 */
export function neighbors(w, h, cell) {
  const [x, y] = xyOf(w, cell);
  const list = [];
  if (y > 0) list.push(cell - w);
  if (x < w - 1) list.push(cell + 1);
  if (y < h - 1) list.push(cell + w);
  if (x > 0) list.push(cell - 1);
  return list;
}

// ---- 두기 ----

/**
 * 둔 수들을 처음부터 다시 둔다.
 * @param {object} board
 * @param {number[]} trail 움직인 동물이 들어간 칸들(먼저 움직이는 쪽부터 번갈아)
 * @param {'fox'|'rabbit'} first 먼저 움직이는 쪽
 * @returns {{ok: boolean, fox: number, rabbit: number, foxMoves: number, limit: number, next: string|null, over: boolean, winner: string|null, moves: object[]}}
 *   ok       모두 둘 수 있는 수였는가(둘 수 없는 수를 만나면 그 앞까지의 모습이다)
 *   fox, rabbit 지금 여우와 토끼가 있는 칸(여우가 잡았으면 둘이 같은 칸이다)
 *   foxMoves 여우가 움직인 횟수. limit 여우가 움직일 수 있는 횟수
 *   next     움직일 차례인 쪽(끝났으면 null). over 끝났는가. winner 끝났으면 이긴 쪽
 *   moves    움직인 것들 { animal, from, to }(움직인 차례대로)
 */
export function replay(board, trail, first) {
  const limit = limitOf(board);
  let fox = board.fox;
  let rabbit = board.rabbit;
  let foxMoves = 0;
  let side = first;
  let winner = null;
  const moves = [];
  let ok = Array.isArray(trail) && ANIMALS.includes(first);
  if (ok) {
    for (const cell of trail) {
      if (winner !== null) {
        ok = false;
        break;
      }
      const from = side === 'fox' ? fox : rabbit;
      const legal = neighbors(board.w, board.h, from).includes(cell) && !(side === 'rabbit' && cell === fox);
      if (!legal) {
        ok = false;
        break;
      }
      moves.push({ animal: side, from, to: cell });
      if (side === 'fox') {
        fox = cell;
        foxMoves += 1;
        if (fox === rabbit) winner = 'fox';
        else if (foxMoves >= limit) winner = 'rabbit';
      } else rabbit = cell;
      side = otherAnimal(side);
    }
  }
  const over = winner !== null;
  return { ok, fox, rabbit, foxMoves, limit, next: over || !ANIMALS.includes(side) ? null : side, over, winner, moves };
}

/**
 * 그림에 쓰는 것: 둔 수들을 규칙을 따지지 않고 그대로 따라간다(제자리에 있는 수도 그대로 둔다).
 * "왜 그럴까?"의 "토끼가 제자리에 있어도 된다면" 그림이 이것으로 그려진다. 규칙에 맞는지는 테스트가 따로 본다.
 * @returns {{fox: number, rabbit: number, last: {animal: string, from: number, to: number}|null}}
 */
export function walk(board, trail, first) {
  let fox = board.fox;
  let rabbit = board.rabbit;
  let side = first;
  let last = null;
  for (const cell of trail) {
    const from = side === 'fox' ? fox : rabbit;
    last = { animal: side, from, to: cell };
    if (side === 'fox') fox = cell;
    else rabbit = cell;
    side = otherAnimal(side);
  }
  return { fox, rabbit, last };
}

/** 지금 움직일 차례인 쪽이 들어갈 수 있는 칸 모두. 끝났으면 빈 목록이다 */
export function movesOf(board, trail, first) {
  const now = replay(board, trail, first);
  if (!now.ok || now.over) return [];
  if (now.next === 'fox') return neighbors(board.w, board.h, now.fox);
  return neighbors(board.w, board.h, now.rabbit).filter((cell) => cell !== now.fox);
}

// ---- 풀이 프로그램 ----

const tables = new Map();

/**
 * 판의 크기 하나의 표. foxTurn[f * n + r]은 여우가 f, 토끼가 r에 있고 여우 차례일 때, rabbitTurn은 토끼 차례일 때,
 * 둘 다 잘 하면 여우가 몇 번 움직여 잡는가(끝내 못 잡으면 Infinity)다.
 * 끝에서부터 한 겹씩: 여우가 k번 안에 잡는 자리를 k = 1, 2, …로 넓혀 가고, 더 넓어지지 않으면 멈춘다.
 */
function tableOf(w, h) {
  const key = `${w}x${h}`;
  if (tables.has(key)) return tables.get(key);
  const n = w * h;
  const near = Array.from({ length: n }, (_, cell) => neighbors(w, h, cell));
  const foxTurn = new Array(n * n).fill(Infinity);
  const rabbitTurn = new Array(n * n).fill(Infinity);
  // 1겹: 여우 차례에 바로 옆에 토끼가 있다.
  for (let f = 0; f < n; f++) for (const r of near[f]) foxTurn[f * n + r] = 1;
  for (let k = 1; ; k++) {
    // 토끼 차례: 토끼가 어디로 가도(여우 칸은 못 간다) 여우가 k번 안에 잡는 자리가 되면, 그 자리는 k번이다.
    let grew = false;
    for (let f = 0; f < n; f++) {
      for (let r = 0; r < n; r++) {
        if (f === r || rabbitTurn[f * n + r] !== Infinity) continue;
        const escapes = near[r].filter((cell) => cell !== f);
        if (escapes.length > 0 && escapes.every((cell) => foxTurn[f * n + cell] <= k)) {
          rabbitTurn[f * n + r] = k;
          grew = true;
        }
      }
    }
    // 여우 차례: 한 칸 움직여 그런 토끼 차례 자리로 가면 k + 1번이다.
    for (let f = 0; f < n; f++) {
      for (let r = 0; r < n; r++) {
        if (f === r || foxTurn[f * n + r] !== Infinity) continue;
        if (near[f].some((cell) => cell !== r && rabbitTurn[cell * n + r] === k)) {
          foxTurn[f * n + r] = k + 1;
          grew = true;
        }
      }
    }
    if (!grew) break;
  }
  const table = { n, near, foxTurn, rabbitTurn };
  tables.set(key, table);
  return table;
}

/**
 * 둘 다 잘 하면 여우가 몇 번 움직여 잡는가. 끝내 못 잡으면 null.
 * @param {'fox'|'rabbit'} turn 움직일 차례
 */
export function catchIn(w, h, fox, rabbit, turn) {
  const { n, foxTurn, rabbitTurn } = tableOf(w, h);
  const value = (turn === 'fox' ? foxTurn : rabbitTurn)[fox * n + rabbit];
  return Number.isFinite(value) ? value : null;
}

/** 이 자리에서 둘 다 잘 하면 어느 쪽이 이기는가(남은 횟수 안에 잡는지까지 본다). 끝난 자리면 이긴 쪽이다 */
export function winnerAt(board, trail, first) {
  const now = replay(board, trail, first);
  if (now.over) return now.winner;
  const left = now.limit - now.foxMoves;
  const steps = catchIn(board.w, board.h, now.fox, now.rabbit, now.next);
  return steps !== null && steps <= left ? 'fox' : 'rabbit';
}

/**
 * 판을 푼다: 여우가 먼저 움직일 때와 토끼가 먼저 움직일 때, 둘 다 잘 하면 어느 쪽이 이기고 여우가 몇 번 만에 잡는가.
 * @returns {{same: boolean, limit: number, foxFirst: number|null, rabbitFirst: number|null, fox: string, rabbit: string, winner: string|null}}
 *   same        처음에 둘이 같은 색 칸에 있는가
 *   foxFirst    여우가 먼저 움직일 때 여우가 잡는 횟수(못 잡으면 null). rabbitFirst 토끼가 먼저일 때
 *   fox, rabbit 그쪽이 먼저 움직일 때 이기는 쪽
 *   winner      판에 먼저 움직이는 쪽이 정해져 있으면 그때 이기는 쪽(고르는 판이면 null)
 * 잡는 횟수는 늘 limit 이하다(테스트가 모든 크기, 모든 자리에서 확인한다). 그래서 "끝내 잡는가"와 "limit 안에 잡는가"가 같다.
 */
export function solve(board) {
  const limit = limitOf(board);
  const foxFirst = catchIn(board.w, board.h, board.fox, board.rabbit, 'fox');
  const rabbitFirst = catchIn(board.w, board.h, board.fox, board.rabbit, 'rabbit');
  const winnerWhen = (first) => ((first === 'fox' ? foxFirst : rabbitFirst) !== null ? 'fox' : 'rabbit');
  const first = board.first ?? null;
  return { same: sameColor(board.w, board.fox, board.rabbit), limit, foxFirst, rabbitFirst, fox: winnerWhen('fox'), rabbit: winnerWhen('rabbit'), winner: first ? winnerWhen(first) : null };
}

/** 아이가 role이 되어 first가 먼저 움직일 때, 둘 다 잘 하면 아이가 이기는가 */
export const seatWins = (solution, role, first) => solution[first] === role;

// ---- 선생님(컴퓨터)과 두기 ----

/**
 * 컴퓨터가 두는 수(들어갈 칸). 더 둘 수 없으면 null.
 *   여우: 남은 횟수 안에 잡을 수 있으면 가장 빨리 잡는 수 가운데서 고른다. 못 잡는 자리에서도 아무렇게나 걷지 않고 쫓아간다:
 *         토끼와의 거리가 가장 짧아지는 칸, 그 가운데서도 토끼와 더 많이 떨어진 쪽(가로나 세로)으로 다가가는 칸.
 *   토끼: 남은 횟수 안에 안 잡히는 칸이 있으면 그 가운데서, 없으면 가장 오래 버티는 칸 가운데서 여우와 가장 먼 칸을 고른다.
 * 그래도 여럿이면 시드 난수로 고른다.
 */
export function pickMove(board, trail, first, rng) {
  const now = replay(board, trail, first);
  if (!now.ok || now.over) return null;
  const { w, h } = board;
  const { n, near, foxTurn, rabbitTurn } = tableOf(w, h);
  const left = now.limit - now.foxMoves;
  const choose = (list) => list[randInt(rng, 0, list.length - 1)];
  const best = (list, score) => {
    const scores = list.map(score);
    const top = Math.max(...scores);
    return list.filter((_, index) => scores[index] === top);
  };
  if (now.next === 'fox') {
    const r = now.rabbit;
    const steps = (cell) => (cell === r ? 1 : 1 + rabbitTurn[cell * n + r]);
    const fastest = best(near[now.fox], (cell) => -steps(cell));
    if (steps(fastest[0]) <= left) return choose(fastest);
    const [fx, fy] = xyOf(w, now.fox);
    const [rx, ry] = xyOf(w, r);
    const wide = Math.abs(fx - rx) >= Math.abs(fy - ry);
    const closest = best(near[now.fox], (cell) => -gapOf(w, cell, r));
    const along = best(closest, (cell) => (Math.floor(cell / w) === fy) === wide ? 1 : 0);
    return choose(along);
  }
  const escapes = near[now.rabbit].filter((cell) => cell !== now.fox);
  if (escapes.length === 0) return null;
  // 남은 횟수 안에 안 잡히는 칸은 모두 같게 본다(그 가운데서는 여우와 먼 칸).
  const longest = best(escapes, (cell) => Math.min(foxTurn[now.fox * n + cell], left + 1));
  return choose(best(longest, (cell) => gapOf(w, cell, now.fox)));
}

/**
 * 선생님의 다음 수. 같은 (단계, 판 번호, 아이가 된 동물, 먼저 움직이는 쪽, 지금까지 둔 수들)이면 늘 같은 수를 둔다.
 * 직접 만든 판과 작은 판은 판 번호가 없으므로 판의 모습을 시드로 쓴다.
 */
export function teacherMove(board, trail, { level = null, seed = null, role = 'rabbit', first = 'fox' } = {}) {
  const now = replay(board, trail, first);
  if (!now.ok || now.over) return null;
  const rng = createRng(seedFrom('foxrabbit-move', level ?? 'make', seed ?? boardKey(board), role, first, trail.join(',')));
  return pickMove(board, trail, first, rng);
}

/**
 * 아이가 이기는 자리에서 지는 자리로 보낸 수. 몇 번째 수인지(1부터)의 목록이다.
 * 토끼는 이런 수가 없다(같은 색이면 어떻게 움직여도 안 잡힌다). 여우는 가장 빨리 잡는 길에서 벗어나 남은 횟수가 모자라게 된 수다.
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

// ---- 작은 판: 틀의 "더 작은 판으로"가 이 목록을 차례로 낸다(src/core/smaller.js) ----

/** 잘라 낸 판이 없을 때 쓰는 3×3 판들: 같은 색(맞은편 구석)과 다른 색(구석과 맞은편 가장자리) */
export const SMALL_SHELF = [
  [3, 3, 0, 8],
  [3, 3, 0, 5],
  [3, 3, 2, 6],
  [3, 3, 2, 7],
];

/** 작은 판으로 쓸 만한가: 첫 수에 바로 끝나지 않는다(먼저 움직이는 쪽이 정해져 있지 않으면 어느 쪽이 먼저여도) */
function lively(board) {
  const result = solve(board);
  const firsts = board.first ? [board.first] : ANIMALS;
  return firsts.every((first) => (first === 'fox' ? result.foxFirst : result.rabbitFirst) !== 1);
}

/**
 * 원래 판보다 칸이 적고, 둘이 같은 색 칸인지와 먼저 움직이는 쪽이 같은 판들. 그래서 잘 하면 이기는 쪽도 같다.
 * 먼저 원래 판에서 여우와 토끼가 모두 들어가게 잘라 낸 판(칸이 많은 것부터)을 내고, 그다음에 SMALL_SHELF의 판을 낸다.
 * 잘라 내도 두 칸의 색이 같은지는 그대로다(둘 다 같은 만큼 옮겨지기 때문이다). 3×3 판에는 더 작은 판이 없다.
 */
export function smallBoards(board) {
  const same = sameColor(board.w, board.fox, board.rabbit);
  const first = board.first ?? null;
  const seen = new Set();
  const found = [];
  const add = (small) => {
    const name = boardKey(small);
    if (seen.has(name) || cellCount(small) >= cellCount(board) || !lively(small)) return;
    seen.add(name);
    found.push(small);
  };
  const [fx, fy] = xyOf(board.w, board.fox);
  const [rx, ry] = xyOf(board.w, board.rabbit);
  const cropped = [];
  for (let h = board.h; h >= LIMITS.min; h--) {
    for (let w = board.w; w >= LIMITS.min; w--) {
      for (let oy = 0; oy + h <= board.h; oy++) {
        for (let ox = 0; ox + w <= board.w; ox++) {
          const inside = (x, y) => x >= ox && y >= oy && x < ox + w && y < oy + h;
          if (!inside(fx, fy) || !inside(rx, ry)) continue;
          cropped.push({ w, h, fox: (fy - oy) * w + (fx - ox), rabbit: (ry - oy) * w + (rx - ox), first });
        }
      }
    }
  }
  cropped.sort((a, b) => cellCount(b) - cellCount(a));
  cropped.forEach(add);
  for (const [w, h, fox, rabbit] of SMALL_SHELF) {
    if (sameColor(w, fox, rabbit) === same) add({ w, h, fox, rabbit, first });
  }
  return found.map(copyBoard);
}

// ---- 지난 기록: "왜 그럴까?"가 열리는 때, 연달아 진 판 ----

/** 끝까지 둔 게임들(오래된 것부터). 이긴 판도 진 판도 들어간다. 작은 판(곁판)은 세지 않는다 */
function finishedGames(records) {
  if (!Array.isArray(records)) return [];
  return latestById(records).filter(
    (record) => record.kind === 'round' && record.format === 'foxrabbit' && record.side !== true && record.outcome === 'solved' && (record.winner === 'kid' || record.winner === 'teacher'),
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
