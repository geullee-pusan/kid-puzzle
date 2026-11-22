// 도미노 깔기 모두 찾기의 판과 풀이. 순수 함수만 둔다.
// 판은 두 가지다.
//   띠(shape 'strip'): 세로 h줄(2나 3), 가로 w칸의 네모 판. 칸 번호는 y * w + x(왼쪽 위가 0)이고, holes는 빠진 칸이다(직접 만들기만).
//     도미노 하나는 옆에 붙은 두 칸을 덮는다. 판을 빈틈없이 겹치지 않게 덮는 방법(깔기)을 모두 센다.
//     뒤집거나 돌려서 같은 모양이 되어도 놓인 자리가 다르면 다른 깔기다.
//   계단(shape 'stairs'): 계단 w칸. 땅(0칸)에서 한 번에 한 칸이나 두 칸씩 올라 맨 위(w칸)까지 가는 방법(오르기)을 모두 센다.
// 판의 다른 값: guess(먼저 짐작을 적는 판인가), table(표 만들기 판인가. 2×1부터 2×w까지 세고 2×(w+1), 2×(w+2)를 짐작한다).
//
// 깔기의 이름: 칸을 왼쪽 열부터, 한 열 안에서는 위에서부터 훑으며 아직 덮지 않은 첫 칸마다, 그 칸을 덮은 도미노가
//   세운 것(아래 칸과 함께)이면 0, 눕힌 것(오른쪽 칸과 함께)이면 1을 적는다. 이름이 같으면 같은 깔기이고, 이름의 글자 차례가 목록의 차례다.
// 오르기의 이름: 한 번에 오른 칸 수(1이나 2)를 차례로 적는다. 이것도 글자 차례가 목록의 차례다.
//
// 풀이: 깔기는 하나하나 모두 늘어놓는다(위의 훑는 차례대로, 세운 것을 먼저 놓아 본다. 그래서 늘어놓은 차례가 이름의 차례다).
//   늘어놓은 수는 열마다 "다음 열로 삐져나온 칸"만 들고 가는 셈(열 한 줄씩의 셈)과 늘 같아야 한다. 다르면 오류를 낸다.
//   오르기도 하나하나 모두 늘어놓고, 계단 하나씩 쌓아 가는 셈(앞의 두 계단까지의 수를 더한다)과 견준다.
//   테스트가 다른 방법(칸 묶음을 비트로 들고 덮는 셈, 도미노 고르기를 모두 따지는 셈)으로 다시 확인한다.

/** 판의 크기 범위 */
export const ROWS = [2, 3];
export const MIN_W = 1;
/** 줄 수마다 가로 칸 수의 위 끝(1180×820 화면에서 칸이 누를 만한 크기가 되는 데까지) */
export const MAX_W = { 2: 8, 3: 6 };
export const MAX_STEPS = 8;
/** 표 만들기 판의 가장 긴 띠(그 뒤 둘은 짐작한다) */
export const TABLE_MAX = 6;
/** 표 만들기에서 짐작하는 띠의 수 */
export const GUESS_ROWS = 2;

const isBool = (value) => typeof value === 'boolean';

/** 판을 만든다 */
export const strip = (h, w, { holes = [], guess = false, table = false } = {}) => ({ shape: 'strip', h, w, holes: holes.slice().sort((a, b) => a - b), guess, table });
export const stairs = (w) => ({ shape: 'stairs', h: 1, w, holes: [], guess: false, table: false });

export function copyBoard(board) {
  return { shape: board.shape, h: board.h, w: board.w, holes: board.holes.slice(), guess: board.guess, table: board.table };
}

/** 판이 규격에 맞는가. 맞으면 null, 아니면 까닭 */
export function checkBoard(board) {
  if (!board || typeof board !== 'object') return 'no-board';
  const { shape, h, w, holes } = board;
  if (!isBool(board.guess) || !isBool(board.table)) return 'flags';
  if (!Array.isArray(holes) || !holes.every(Number.isInteger)) return 'holes';
  if (shape === 'stairs') {
    if (h !== 1 || !Number.isInteger(w) || w < 1 || w > MAX_STEPS) return 'size';
    if (holes.length > 0 || board.guess || board.table) return 'stairs';
    return null;
  }
  if (shape !== 'strip') return 'shape';
  if (!ROWS.includes(h) || !Number.isInteger(w) || w < MIN_W || w > MAX_W[h]) return 'size';
  if (new Set(holes).size !== holes.length || holes.some((cell) => cell < 0 || cell >= w * h)) return 'holes';
  if (holes.some((cell, index) => index > 0 && cell < holes[index - 1])) return 'holes';
  if (w * h - holes.length < 2) return 'few';
  if (board.table && (h !== 2 || holes.length > 0 || w > TABLE_MAX || w < 2 || board.guess)) return 'table';
  return null;
}

/** 판을 한 줄의 글로(같은 판인지 견주고, 적어 둘 때 쓴다) */
export function boardKey(board) {
  if (board.shape === 'stairs') return `stairs:${board.w}`;
  return `strip:${board.h}x${board.w}:${board.holes.join(',')}:${board.guess ? 'g' : ''}${board.table ? 't' : ''}`;
}

export const sameBoard = (a, b) => boardKey(a) === boardKey(b);

/** 판에서 덮어야 하는 칸의 수(계단은 오를 칸의 수) */
export const openCount = (board) => (board.shape === 'stairs' ? board.w : board.w * board.h - board.holes.length);

/** 칸을 훑는 차례: 왼쪽 열부터, 한 열 안에서는 위에서부터 */
function scanOrder(board) {
  const order = [];
  for (let x = 0; x < board.w; x++) for (let y = 0; y < board.h; y++) order.push(y * board.w + x);
  return order;
}

/** 두 칸이 옆에 붙어 있는가(가로나 세로로) */
export function adjacent(board, a, b) {
  const { w } = board;
  const [ax, ay, bx, by] = [a % w, Math.floor(a / w), b % w, Math.floor(b / w)];
  return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
}

const sortPair = (cells) => cells.slice().sort((a, b) => a - b);

// ---- 띠: 깔기 ----

/** 깔기를 모두 늘어놓는다(도미노마다 [작은 칸, 큰 칸]). 이름의 차례대로 나온다 */
export function coverings(board) {
  const { w, h } = board;
  const covered = Array(w * h).fill(false);
  for (const cell of board.holes) covered[cell] = true;
  const order = scanOrder(board);
  const found = [];
  const now = [];
  const go = (from) => {
    let at = from;
    while (at < order.length && covered[order[at]]) at += 1;
    if (at === order.length) {
      found.push(now.map((pair) => pair.slice()));
      return;
    }
    const cell = order[at];
    const x = cell % w;
    const y = Math.floor(cell / w);
    // 세운 것(아래 칸과 함께)을 먼저, 그다음 눕힌 것(오른쪽 칸과 함께)
    for (const other of [y + 1 < h ? cell + w : -1, x + 1 < w ? cell + 1 : -1]) {
      if (other < 0 || covered[other]) continue;
      covered[cell] = true;
      covered[other] = true;
      now.push([cell, other]);
      go(at + 1);
      now.pop();
      covered[cell] = false;
      covered[other] = false;
    }
  };
  go(0);
  return found;
}

/** 열 한 줄씩의 셈: 열마다 다음 열로 삐져나온(눕힌 도미노의 오른쪽 칸) 칸의 모양만 들고 간다 */
export function countByColumns(board) {
  const { w, h } = board;
  const hole = new Set(board.holes);
  const isOpen = (x, y) => x < w && !hole.has(y * w + x);
  let ways = new Map([[0, 1]]);
  for (let x = 0; x < w; x++) {
    const next = new Map();
    for (const [mask, count] of ways) {
      // y줄부터 이 열을 채운다. filled: 이 열에서 이미 덮인 칸, out: 다음 열로 삐져나온 칸
      const fill = (y, filled, out) => {
        if (y === h) {
          next.set(out, (next.get(out) ?? 0) + count);
          return;
        }
        const bit = 1 << y;
        if (filled & bit || !isOpen(x, y)) {
          fill(y + 1, filled, out);
          return;
        }
        if (y + 1 < h && !(filled & (bit << 1)) && isOpen(x, y + 1)) fill(y + 2, filled | bit | (bit << 1), out);
        if (isOpen(x + 1, y)) fill(y + 1, filled | bit, out | bit);
      };
      // 빠진 칸에 삐져나온 도미노는 없다(삐져나갈 때 확인한다)
      fill(0, mask, 0);
    }
    ways = next;
  }
  return ways.get(0) ?? 0;
}

/** 깔기의 이름. 판을 빈틈없이 덮은 도미노들이 아니면 null */
export function coverKey(board, placed) {
  const { w, h } = board;
  const partner = Array(w * h).fill(-1);
  for (const cell of board.holes) partner[cell] = cell;
  for (const pair of placed) {
    const [a, b] = pair;
    if (partner[a] !== -1 || partner[b] !== -1 || !adjacent(board, a, b)) return null;
    partner[a] = b;
    partner[b] = a;
  }
  if (partner.some((value) => value === -1)) return null;
  const seen = new Set(board.holes);
  let key = '';
  for (const cell of scanOrder(board)) {
    if (seen.has(cell)) continue;
    const other = partner[cell];
    seen.add(cell);
    seen.add(other);
    if (other === cell + w) key += '0';
    else if (other === cell + 1 && cell % w < w - 1) key += '1';
    else return null;
  }
  return key;
}

/** 이름으로 깔기(도미노들)를 다시 만든다 */
export function coverOfKey(board, key) {
  const { w } = board;
  const seen = new Set(board.holes);
  const placed = [];
  let at = 0;
  for (const cell of scanOrder(board)) {
    if (seen.has(cell)) continue;
    const other = key[at] === '0' ? cell + w : cell + 1;
    at += 1;
    seen.add(cell);
    seen.add(other);
    placed.push([cell, other]);
  }
  return placed;
}

/**
 * 고른 칸들에 도미노 하나를 놓을 수 있는가. 놓을 수 있으면 null, 아니면 까닭
 *   'few'  칸이 둘이 아니다, 'apart' 두 칸이 붙어 있지 않다, 'taken' 빠진 칸이나 이미 덮인 칸이 있다
 */
export function placeProblem(board, placed, cells) {
  if (cells.length !== 2) return 'few';
  const [a, b] = cells;
  if (!adjacent(board, a, b)) return 'apart';
  const used = new Set([...board.holes, ...placed.flat()]);
  if (cells.some((cell) => cell < 0 || cell >= board.w * board.h || used.has(cell))) return 'taken';
  return null;
}

/**
 * 지나온 길(놓고 들어낸 일의 목록)을 따라가 지금 놓인 도미노들을 낸다.
 * 길: { op: 'place' | 'remove', cells: [a, b] }. 맞지 않는 일이 있으면 ok가 거짓이다
 */
export function replay(board, trail) {
  let placed = [];
  for (const item of trail) {
    if (!item || !Array.isArray(item.cells)) return { ok: false, placed };
    const cells = sortPair(item.cells);
    if (item.op === 'place') {
      if (placeProblem(board, placed, cells) !== null) return { ok: false, placed };
      placed = [...placed, cells];
    } else if (item.op === 'remove') {
      const at = placed.findIndex((pair) => pair[0] === cells[0] && pair[1] === cells[1]);
      if (at < 0) return { ok: false, placed };
      placed = placed.filter((_, index) => index !== at);
    } else return { ok: false, placed };
  }
  return { ok: true, placed };
}

/** 아직 덮지 않은 칸들 */
export function emptyCells(board, placed) {
  const used = new Set([...board.holes, ...placed.flat()]);
  return Array.from({ length: board.w * board.h }, (_, cell) => cell).filter((cell) => !used.has(cell));
}

/** 빈칸이 남았는데 도미노를 더 놓을 자리가 없는가 */
export function isStuck(board, placed) {
  const empty = emptyCells(board, placed);
  if (empty.length === 0) return false;
  const set = new Set(empty);
  return !empty.some((cell) => [cell + 1, cell + board.w].some((other) => set.has(other) && adjacent(board, cell, other)));
}

// ---- 계단: 오르기 ----

/** 오르기를 모두 늘어놓는다(한 번에 오른 칸 수의 줄). 이름의 차례대로 나온다 */
export function climbs(n) {
  const found = [];
  const go = (left, now) => {
    if (left === 0) {
      found.push(now.slice());
      return;
    }
    for (const hop of [1, 2]) {
      if (hop > left) continue;
      now.push(hop);
      go(left - hop, now);
      now.pop();
    }
  };
  go(n, []);
  return found;
}

/** 계단 하나씩 쌓아 가는 셈: 그 계단까지 가는 방법은 한 칸 아래와 두 칸 아래까지 가는 방법을 더한 것이다 */
export function countByStairs(n) {
  const ways = [1, 1];
  for (let step = 2; step <= n; step++) ways.push(ways[step - 1] + ways[step - 2]);
  return ways[n];
}

/** 밟은 계단들(땅은 빼고, 아래에서부터)로 한 번에 오른 칸 수의 줄을 낸다. 맞지 않으면 null */
export function hopsOf(n, landed) {
  const hops = [];
  let at = 0;
  for (const step of landed) {
    const hop = step - at;
    if (!Number.isInteger(step) || (hop !== 1 && hop !== 2) || step > n) return null;
    hops.push(hop);
    at = step;
  }
  return hops;
}

export const climbKey = (hops) => hops.join('');
export const landedOf = (hops) => hops.reduce((list, hop) => [...list, (list.at(-1) ?? 0) + hop], []);

// ---- 판마다의 풀이 ----

/** 판 하나를 덮는(오르는) 방법을 모두 늘어놓은 이름들. 두 셈이 다르면 오류를 낸다 */
export function keysOf(board) {
  if (board.shape === 'stairs') {
    const list = climbs(board.w).map(climbKey);
    if (list.length !== countByStairs(board.w)) throw new Error('오르기의 두 셈이 달라요');
    return list;
  }
  const list = coverings(board).map((placed) => coverKey(board, placed));
  if (list.length !== countByColumns(board)) throw new Error('깔기의 두 셈이 달라요');
  return list;
}

/** 이름으로 차례를 견준다(목록은 이 차례로 놓는다) */
export const compareKeys = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** 표 만들기에서 쓰는 띠들의 가로 칸 수(세는 것 1~w, 짐작하는 것 w+1, w+2) */
export const tableSizes = (board) => Array.from({ length: board.w }, (_, index) => index + 1);
export const guessSizes = (board) => Array.from({ length: GUESS_ROWS }, (_, index) => board.w + 1 + index);

/** 표 만들기의 한 칸: 2×size 띠 */
export const tableStrip = (size) => strip(2, size);

/**
 * 판을 푼다.
 *   count  덮는(오르는) 방법의 수. 표 만들기 판은 지금 띠마다 따로 세므로 counts를 본다
 *   cells  덮어야 하는 칸의 수(계단은 칸 수)
 *   counts 표 만들기 판: 가로 1칸부터 w + 2칸까지 2줄 띠마다의 수(셋째 칸부터는 짐작하는 띠)
 */
export function solve(board) {
  if (board.table) {
    const sizes = [...tableSizes(board), ...guessSizes(board)];
    return { possible: true, count: null, cells: null, counts: sizes.map((size) => keysOf(tableStrip(size)).length) };
  }
  const keys = keysOf(board);
  return { possible: true, count: keys.length, cells: openCount(board), counts: null };
}
