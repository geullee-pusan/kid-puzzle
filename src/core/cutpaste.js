// 자르고 붙이기의 판과 풀이. 순수 함수만 둔다.
// 판의 종류(kind):
//   move    잘라 옮겨 네모 만들기: 칸으로 된 도형을 곧은 선으로 cuts번까지 잘라 조각을 옮기고 돌려서 빈틈없는 네모(직사각형)를 만든다
//   shadow  가짜 그림자: 일곱 조각으로 그림자를 빈틈없이 채운다. 칸 수가 조각들과 다른 그림자는 채울 수 없다("불가능해요")
//   share   가장 적게 잘라 나누기: 똑같은 막대 빵 m개를 n명이 똑같이 나눈다. 조각은 한 사람에게만 간다. 조각 수가 적을수록 좋다
//
// 칸은 [x, y](칸 단위의 정수)로 적는다. 조각은 칸들의 목록이고, 판 위의 자리(절대 자리)로 적는다.
// 자르기: 조각 하나를 칸 사이의 곧은 선(세로 x = at 또는 가로 y = at) 하나로 끝에서 끝까지 자른다. 선의 양쪽에 칸이 있어야 한다.
//   자른 뒤 이어지지 않은 칸 덩어리는 따로따로 조각이 된다(ㄷ자를 가로로 자르면 셋이 될 수 있다). 자를 때 조각은 움직이지 않는다.
// 옮기기와 돌리기: 조각을 칸 단위로 옮기고, 4분의 1 바퀴씩 돌린다. 뒤집지는 않는다(풀이 프로그램도 뒤집지 않는다).
//
// 풀이(잘라 옮겨 네모):
//   - 자르기는 조각마다 따로 하므로, 잘린 모습(조각들의 묶음)을 자른 수마다 모두 만든다(너비 우선, 같은 묶음은 하나로).
//   - 잘린 모습마다, 칸 수가 같고 판에 들어가는 모든 네모(가로 × 세로)를 조각들(돌린 모습까지)로 채워 본다.
//   - 채우기: 아직 채우지 않은 칸 가운데 맨 위 왼쪽 칸은 어느 조각의 맨 위 왼쪽 칸이어야 하므로, 쓰지 않은 조각을 돌린 모습마다 그 칸에 맞춰 놓아 본다.
//   - 가장 적게 자른 수(min)가 판의 cuts 이하이면 되는 판이다. 칸 수가 소수이면 네모는 한 줄짜리뿐이다(까닭 'line').
// 풀이(가짜 그림자): 같은 채우기로 그림자를 채워 본다. 칸 수가 다르면 채워 보지 않아도 안 된다(까닭 'area').
// 풀이(나누기): 자른 수를 0부터 늘려 가며, 막대마다 자른 자리의 묶음을 모두 골라(막대는 똑같으니 차례는 따지지 않는다)
//   조각들을 n명에게 m칸씩 꼭 맞게 나눌 수 있는지 따진다. 처음 되는 자른 수에 m을 더한 것이 가장 적은 조각 수다.
//   막대 하나는 n칸이고(한 칸은 막대의 n분의 1), 한 사람 몫은 m칸이다. 자르는 자리는 칸 사이로만 둔다.

export const KINDS = ['move', 'shadow', 'share'];

/** 잘라 옮겨 네모의 판 크기와 칸 수 */
export const MOVE_W = 12;
export const MOVE_H = 7;
export const MIN_MOVE_AREA = 4;
export const MAX_MOVE_AREA = 12;
export const MAX_CUTS = 3;

/** 가짜 그림자의 판: 왼쪽은 조각을 두는 자리(TRAY_W칸), 한 칸 띄고 오른쪽에 그림자 */
export const TRAY_W = 7;
export const SHADOW_W = 15;
export const SHADOW_H = 9;

/** 나누기: 막대 수와 사람 수 */
export const MIN_BARS = 2;
export const MAX_BARS = 5;
export const MIN_PEOPLE = 2;
export const MAX_PEOPLE = 6;

/**
 * 일곱 조각(가짜 그림자). 모두 뒤집어도 돌린 모습과 같은 조각이라 뒤집기가 필요 없다.
 *   o 네모 네 칸, t ㅗ자 네 칸, i 일자 세 칸, l ㄱ자 세 칸, d 두 칸, m 한 칸
 */
export const PIECES = {
  o: [[0, 0], [1, 0], [0, 1], [1, 1]],
  t: [[0, 0], [1, 0], [2, 0], [1, 1]],
  i: [[0, 0], [1, 0], [2, 0]],
  l: [[0, 0], [0, 1], [1, 1]],
  d: [[0, 0], [1, 0]],
  m: [[0, 0]],
};
/** 일곱 조각 한 벌(합 20칸) */
export const SEVEN = ['o', 't', 'i', 'l', 'l', 'd', 'm'];

const isInt = (value) => Number.isInteger(value);
const key = ([x, y]) => `${x},${y}`;
const byRow = (a, b) => a[1] - b[1] || a[0] - b[0];

// ---- 칸 묶음(조각) ----

/** 칸들을 맨 위 왼쪽이 (0, 0)이 되게 옮기고 줄 차례로 늘어놓는다 */
export function normalize(cells) {
  const minX = Math.min(...cells.map((cell) => cell[0]));
  const minY = Math.min(...cells.map((cell) => cell[1]));
  return cells.map(([x, y]) => [x - minX, y - minY]).sort(byRow);
}

/** 칸들을 시계 방향으로 4분의 1 바퀴 돌린다(맨 위 왼쪽이 (0, 0)) */
export function rotate(cells) {
  const height = Math.max(...cells.map((cell) => cell[1])) + 1;
  return normalize(cells.map(([x, y]) => [height - 1 - y, x]));
}

/** 칸들의 이름(차례와 상관없이 같은 칸이면 같은 이름) */
export const cellsKey = (cells) => cells.slice().sort(byRow).map(key).join(';');

/** 돌린 모습들(같은 모습은 하나로) */
export function orientations(cells) {
  const list = [];
  const seen = new Set();
  let now = normalize(cells);
  for (let turn = 0; turn < 4; turn++) {
    const name = cellsKey(now);
    if (!seen.has(name)) {
      seen.add(name);
      list.push(now);
    }
    now = rotate(now);
  }
  return list;
}

/** 모양의 이름: 돌려서 같은 모양이면 같은 이름 */
export const shapeKey = (cells) => orientations(cells).map(cellsKey).sort()[0];

/** 칸들이 옆으로(위아래 왼쪽 오른쪽) 이어진 덩어리들 */
export function components(cells) {
  const left = new Map(cells.map((cell) => [key(cell), cell]));
  const groups = [];
  for (const start of cells) {
    if (!left.has(key(start))) continue;
    const group = [];
    const stack = [start];
    left.delete(key(start));
    while (stack.length > 0) {
      const [x, y] = stack.pop();
      group.push([x, y]);
      for (const next of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (left.has(key(next))) {
          stack.push(left.get(key(next)));
          left.delete(key(next));
        }
      }
    }
    groups.push(group.sort(byRow));
  }
  return groups;
}

export const isConnected = (cells) => cells.length > 0 && components(cells).length === 1;

/** 칸들을 꼭 감싸는 네모 { x, y, w, h } */
export function boxOf(cells) {
  const xs = cells.map((cell) => cell[0]);
  const ys = cells.map((cell) => cell[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x + 1, h: Math.max(...ys) - y + 1 };
}

/** 칸들이 빈틈없는 네모인가 */
export function isRect(cells) {
  if (cells.length === 0 || new Set(cells.map(key)).size !== cells.length) return false;
  const box = boxOf(cells);
  return box.w * box.h === cells.length;
}

/** 칸들에 구멍(둘레에서 닿을 수 없는 빈칸)이 있는가 */
export function hasHole(cells) {
  const box = boxOf(cells);
  const filled = new Set(cells.map(key));
  const outside = new Set();
  const stack = [[box.x - 1, box.y - 1]];
  outside.add(key(stack[0]));
  while (stack.length > 0) {
    const [x, y] = stack.pop();
    for (const next of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      const [nx, ny] = next;
      if (nx < box.x - 1 || ny < box.y - 1 || nx > box.x + box.w || ny > box.y + box.h) continue;
      if (filled.has(key(next)) || outside.has(key(next))) continue;
      outside.add(key(next));
      stack.push(next);
    }
  }
  return (box.w + 2) * (box.h + 2) - outside.size !== cells.length;
}

const isPrime = (n) => {
  if (n < 2) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
};
export { isPrime };

// ---- 자르기 ----

/** 조각을 자를 수 있는 곧은 선들: 세로 선 { d: 'v', at }과 가로 선 { d: 'h', at }. 선의 양쪽에 칸이 있다 */
export function linesOf(cells) {
  const box = boxOf(cells);
  const lines = [];
  for (let at = box.x + 1; at < box.x + box.w; at++) lines.push({ d: 'v', at });
  for (let at = box.y + 1; at < box.y + box.h; at++) lines.push({ d: 'h', at });
  return lines;
}

const lineOk = (line) => Boolean(line) && (line.d === 'v' || line.d === 'h') && isInt(line.at);

/** 조각 하나를 선 하나로 자른 조각들. 선이 조각을 지나지 않으면 null */
export function cutCells(cells, line) {
  if (!lineOk(line)) return null;
  const axis = line.d === 'v' ? 0 : 1;
  const low = cells.filter((cell) => cell[axis] < line.at);
  const high = cells.filter((cell) => cell[axis] >= line.at);
  if (low.length === 0 || high.length === 0) return null;
  return [...components(low), ...components(high)];
}

/** 판 위의 조각들 가운데 index번째를 선으로 자른다. 자른 조각들은 그 자리에 그대로 있다. 자를 수 없으면 null */
export function cutPiece(pieces, index, line) {
  const piece = pieces[index];
  if (!piece) return null;
  const parts = cutCells(piece.cells, line);
  if (!parts) return null;
  const used = new Set(pieces.map((item) => item.color));
  let next = 0;
  const fresh = () => {
    while (used.has(next)) next += 1;
    used.add(next);
    return next;
  };
  // 첫 덩어리는 원래 조각의 색을 잇고, 나머지는 새 색을 받는다
  const made = parts.map((cells, at) => ({ cells, type: piece.type ?? null, color: at === 0 ? piece.color : fresh() }));
  return [...pieces.slice(0, index), ...made, ...pieces.slice(index + 1)];
}

// ---- 옮기기와 돌리기 ----

/** 조각을 판 안에 들게 민다 */
function keepInside(cells, w, h) {
  const box = boxOf(cells);
  const dx = box.x < 0 ? -box.x : box.x + box.w > w ? w - box.x - box.w : 0;
  const dy = box.y < 0 ? -box.y : box.y + box.h > h ? h - box.y - box.h : 0;
  return cells.map(([x, y]) => [x + dx, y + dy]);
}

/** 조각을 dx, dy칸 옮긴다(판 밖으로 나가지 않게). 옮긴 조각은 맨 위(목록의 끝)에 놓인다 */
export function movePiece(board, pieces, index, dx, dy) {
  const piece = pieces[index];
  if (!piece || !isInt(dx) || !isInt(dy)) return pieces;
  const cells = keepInside(piece.cells.map(([x, y]) => [x + dx, y + dy]), board.w, board.h).sort(byRow);
  return [...pieces.slice(0, index), ...pieces.slice(index + 1), { ...piece, cells }];
}

/** 조각을 그 자리에서 시계 방향으로 4분의 1 바퀴 돌린다(가운데를 될 수 있는 대로 그대로). 돌린 조각은 맨 위에 놓인다 */
export function turnPiece(board, pieces, index) {
  const piece = pieces[index];
  if (!piece) return pieces;
  const box = boxOf(piece.cells);
  const turned = rotate(piece.cells);
  const tbox = boxOf(turned);
  // 가운데(반 칸 단위): 2x + w − 1. 돌린 뒤에도 같은 가운데에 가장 가깝게(반 칸이 남으면 왼쪽·위로)
  const x = Math.floor((2 * box.x + box.w - tbox.w) / 2);
  const y = Math.floor((2 * box.y + box.h - tbox.h) / 2);
  const cells = keepInside(turned.map(([cx, cy]) => [cx + x, cy + y]), board.w, board.h).sort(byRow);
  return [...pieces.slice(0, index), ...pieces.slice(index + 1), { ...piece, cells }];
}

/** 조각들이 겹친 칸들 */
export function overlapOf(pieces) {
  const seen = new Set();
  const twice = new Set();
  for (const piece of pieces) {
    for (const cell of piece.cells) {
      const name = key(cell);
      if (seen.has(name)) twice.add(name);
      seen.add(name);
    }
  }
  return [...twice].map((name) => name.split(',').map(Number));
}

const allCells = (pieces) => pieces.flatMap((piece) => piece.cells);

/** 잘라 옮겨 네모: 조각들이 겹치지 않고 빈틈없는 네모가 되었는가 */
export const rectDone = (pieces) => overlapOf(pieces).length === 0 && isRect(allCells(pieces));

/** 가짜 그림자: 조각들이 겹치지 않고 그림자를 꼭 채웠는가 */
export function shadowDone(board, pieces) {
  if (overlapOf(pieces).length > 0) return false;
  const cells = allCells(pieces);
  if (cells.length !== board.shadow.length) return false;
  const shadow = new Set(board.shadow.map(key));
  return cells.every((cell) => shadow.has(key(cell)));
}

// ---- 채우기(네모, 그림자) ----

/**
 * 칸들(region)을 조각들로 빈틈없이 채운다. 조각은 모두 써야 하고, 돌려도 된다(뒤집지는 않는다).
 * @param {number[][]} region 채울 칸들
 * @param {number[][][]} shapes 조각들(칸들. 자리는 상관없다)
 * @param {{limit?: number}} options limit: 이만큼 찾으면 그만 센다(기본 1)
 * @returns {{ count: number, fill: {index: number, cells: number[][]}[] | null, nodes: number }} fill은 처음 찾은 채우기(조각마다 놓인 칸들)
 */
export function fillRegion(region, shapes, { limit = 1 } = {}) {
  const total = shapes.reduce((sum, cells) => sum + cells.length, 0);
  if (total !== region.length) return { count: 0, fill: null, nodes: 0 };
  const order = region.slice().sort(byRow);
  const at = new Map(order.map((cell, index) => [key(cell), index]));
  const filled = new Array(order.length).fill(false);
  const used = new Array(shapes.length).fill(false);
  const turns = shapes.map((cells) => orientations(cells));
  const names = shapes.map(shapeKey);
  const placed = [];
  let count = 0;
  let first = null;
  let nodes = 0;
  function go(from) {
    nodes += 1;
    let open = from;
    while (open < order.length && filled[open]) open += 1;
    if (open === order.length) {
      count += 1;
      if (!first) first = placed.map((item) => ({ index: item.index, cells: item.cells.map((cell) => cell.slice()) }));
      return;
    }
    const [tx, ty] = order[open];
    const tried = new Set();
    for (let index = 0; index < shapes.length && count < limit; index++) {
      if (used[index] || tried.has(names[index])) continue;
      tried.add(names[index]);
      for (const shape of turns[index]) {
        const [ax, ay] = shape[0];
        const cells = shape.map(([x, y]) => [x - ax + tx, y - ay + ty]);
        const spots = cells.map((cell) => at.get(key(cell)));
        if (spots.some((spot) => spot === undefined || filled[spot])) continue;
        for (const spot of spots) filled[spot] = true;
        used[index] = true;
        placed.push({ index, cells });
        go(open + 1);
        placed.pop();
        used[index] = false;
        for (const spot of spots) filled[spot] = false;
        if (count >= limit) return;
      }
    }
  }
  go(0);
  return { count, fill: first, nodes };
}

/** w × h 네모의 칸들 */
export function rectCells(w, h, x = 0, y = 0) {
  const cells = [];
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) cells.push([x + dx, y + dy]);
  return cells;
}

// ---- 잘라 옮겨 네모의 풀이 ----

/** 조각 묶음의 이름(조각의 차례와 상관없이) */
const stateKey = (pieces) => pieces.map(cellsKey).sort().join('|');

/**
 * 자른 수마다 만들 수 있는 모든 잘린 모습(조각들의 묶음). levels[j]는 꼭 j번 잘라야 나오는 모습들이다(더 적게 잘라 나오는 것은 앞에 있다).
 * @param {number[][]} cells 처음 도형
 * @param {number} cuts 자르는 수의 위 끝
 */
export function cutLevels(cells, cuts) {
  const start = [cells.slice().sort(byRow)];
  const seen = new Set([stateKey(start)]);
  const levels = [[start]];
  for (let step = 1; step <= cuts; step++) {
    const next = [];
    for (const state of levels[step - 1]) {
      state.forEach((piece, index) => {
        for (const line of linesOf(piece)) {
          const parts = cutCells(piece, line);
          const made = [...state.slice(0, index), ...parts, ...state.slice(index + 1)];
          const name = stateKey(made);
          if (seen.has(name)) continue;
          seen.add(name);
          next.push(made);
        }
      });
    }
    levels.push(next);
  }
  return levels;
}

/** 칸 수가 area인 네모 가운데 판(w × h)에 들어가는 것들 [가로, 세로]. 가로가 긴 것부터 */
export function rectSizes(area, w, h) {
  const list = [];
  for (let rw = area; rw >= 1; rw--) if (area % rw === 0 && rw <= w && area / rw <= h) list.push([rw, area / rw]);
  return list;
}

/** 조각들로 판에 들어가는 네모를 만들 수 있는가. 되면 { size: [가로, 세로], fill } */
export function rectFrom(shapes, w, h) {
  const area = shapes.reduce((sum, cells) => sum + cells.length, 0);
  for (const [rw, rh] of rectSizes(area, w, h)) {
    const result = fillRegion(rectCells(rw, rh), shapes);
    if (result.fill) return { size: [rw, rh], fill: result.fill };
  }
  return null;
}

/**
 * 잘라 옮겨 네모를 푼다.
 * @returns {{ possible: boolean, min: number|null, area: number, cuts: number, pieces: number[][][]|null, size: number[]|null, fill: object[]|null, tried: number, reason: string|null }}
 *   min: 네모를 만드는 가장 적은 자른 수(판의 cuts까지 따져서 없으면 null), pieces: 그때의 잘린 조각들(처음 자리), fill: 네모 안에 놓은 모습
 *   tried: cuts번까지 잘라 나오는 모든 잘린 모습의 수(처음 모습 포함), reason: 안 되는 판의 까닭('line' 칸 수가 소수라 한 줄 네모뿐, 'search' 모두 따져 봄)
 */
export function solveMove(board) {
  const levels = cutLevels(board.cells, board.cuts);
  const tried = levels.reduce((sum, list) => sum + list.length, 0);
  const area = board.cells.length;
  for (let step = 0; step < levels.length; step++) {
    for (const state of levels[step]) {
      const made = rectFrom(state, board.w, board.h);
      if (made) return { possible: true, min: step, area, cuts: board.cuts, pieces: state, size: made.size, fill: made.fill, tried, reason: null };
    }
  }
  return { possible: false, min: null, area, cuts: board.cuts, pieces: null, size: null, fill: null, tried, reason: isPrime(area) ? 'line' : 'search' };
}

// ---- 가짜 그림자 ----

/** 조각 종류들을 왼쪽 자리(가로 TRAY_W칸)에 줄줄이 놓는다(한 칸씩 띄어). 판의 처음 조각들 */
export function trayOf(types, width = TRAY_W) {
  const pieces = [];
  let x = 0;
  let y = 0;
  let row = 0;
  types.forEach((type, index) => {
    const cells = normalize(PIECES[type]);
    const box = boxOf(cells);
    if (x > 0 && x + box.w > width) {
      x = 0;
      y += row + 1;
      row = 0;
    }
    pieces.push({ cells: cells.map(([cx, cy]) => [cx + x, cy + y]), type, color: index });
    x += box.w + 1;
    row = Math.max(row, box.h);
  });
  return pieces;
}

/** 조각 종류들의 칸 수의 합 */
export const setArea = (types) => types.reduce((sum, type) => sum + PIECES[type].length, 0);

/**
 * 가짜 그림자를 푼다. 칸 수가 다르면 채우지 않고 안 된다고 한다(까닭 'area'). 같으면 채워 본다(안 되면 까닭 'search').
 * @returns {{ possible: boolean, area: number, shadowArea: number, fill: object[]|null, reason: string|null }} fill은 조각 종류의 차례(index)마다 놓인 칸들
 */
export function solveShadow(board) {
  const area = setArea(board.set);
  const shadowArea = board.shadow.length;
  if (area !== shadowArea) return { possible: false, area, shadowArea, fill: null, reason: 'area' };
  const result = fillRegion(board.shadow, board.set.map((type) => PIECES[type]));
  return { possible: Boolean(result.fill), area, shadowArea, fill: result.fill, reason: result.fill ? null : 'search' };
}

// ---- 나누기 ----

/** 막대마다 자른 자리로 조각들: { bar, start, end, len, key } */
export function sharePieces(board, cuts) {
  const list = [];
  cuts.forEach((spots, bar) => {
    const marks = [0, ...spots.slice().sort((a, b) => a - b), board.n];
    for (let at = 0; at + 1 < marks.length; at++) list.push({ bar, start: marks[at], end: marks[at + 1], len: marks[at + 1] - marks[at], key: `${bar}:${marks[at]}-${marks[at + 1]}` });
  });
  return list;
}

/** 빈 자르기(막대마다 자른 자리 없음) */
export const noCuts = (board) => Array.from({ length: board.m }, () => []);

/** 막대 bar의 자리 at을 자르거나(없으면) 붙인다(있으면) */
export function toggleCut(board, cuts, bar, at) {
  if (!isInt(bar) || bar < 0 || bar >= board.m || !isInt(at) || at < 1 || at >= board.n) return cuts;
  return cuts.map((spots, index) => (index !== bar ? spots.slice() : spots.includes(at) ? spots.filter((spot) => spot !== at) : [...spots, at].sort((a, b) => a - b)));
}

/** 사람마다 받은 칸 수(주인이 없는 조각은 빠진다). owners: 조각 이름 → 사람 번호 */
export function sharesOf(board, cuts, owners) {
  const sums = new Array(board.n).fill(0);
  for (const piece of sharePieces(board, cuts)) {
    const who = owners[piece.key];
    if (isInt(who) && who >= 0 && who < board.n) sums[who] += piece.len;
  }
  return sums;
}

/** 모든 조각을 나눠 주었고 모두 똑같이(m칸씩) 받았는가 */
export function shareDone(board, cuts, owners) {
  const pieces = sharePieces(board, cuts);
  if (!pieces.every((piece) => isInt(owners[piece.key]) && owners[piece.key] >= 0 && owners[piece.key] < board.n)) return false;
  return sharesOf(board, cuts, owners).every((sum) => sum === board.m);
}

/** 이름이 있는 조각에만 주인을 남긴다(자르거나 붙여서 없어진 조각의 주인은 지운다) */
export function keepOwners(board, cuts, owners) {
  const names = new Set(sharePieces(board, cuts).map((piece) => piece.key));
  return Object.fromEntries(Object.entries(owners).filter(([name, who]) => names.has(name) && isInt(who) && who >= 0 && who < board.n));
}

const popcount = (mask) => {
  let count = 0;
  for (let m = mask; m; m &= m - 1) count += 1;
  return count;
};

/** 조각 길이들을 n명에게 m칸씩 꼭 맞게 나눈다. 되면 조각마다의 사람 번호, 안 되면 null */
export function packShares(lengths, n, m) {
  if (lengths.reduce((sum, len) => sum + len, 0) !== n * m || lengths.some((len) => len > m)) return null;
  const order = lengths.map((len, index) => ({ len, index })).sort((a, b) => b.len - a.len || a.index - b.index);
  const room = new Array(n).fill(m);
  const who = new Array(lengths.length).fill(-1);
  function go(at) {
    if (at === order.length) return true;
    const { len, index } = order[at];
    const tried = new Set();
    for (let person = 0; person < n; person++) {
      if (room[person] < len || tried.has(room[person])) continue;
      tried.add(room[person]);
      room[person] -= len;
      who[index] = person;
      if (go(at + 1)) return true;
      room[person] += len;
    }
    who[index] = -1;
    return false;
  }
  return go(0) ? who : null;
}

/**
 * 가장 적게 잘라 나누기를 푼다(자른 수를 0부터 늘려 가며 모두 따진다).
 * @returns {{ possible: true, best: number, cutsNeeded: number, cuts: number[][], owners: object, nodes: number }} best: 가장 적은 조각 수, cuts·owners: 그때의 자르기와 나눠 준 것
 */
export function solveShare(board) {
  const { m, n } = board;
  // 막대 하나의 자르는 자리 묶음(비트: 자리 1~n−1), 자른 수가 적은 것부터
  const masks = Array.from({ length: 1 << (n - 1) }, (_, mask) => mask).sort((a, b) => popcount(a) - popcount(b) || a - b);
  const spotsOf = (mask) => Array.from({ length: n - 1 }, (_, at) => at + 1).filter((at) => mask & (1 << (at - 1)));
  let nodes = 0;
  for (let total = 0; total <= m * (n - 1); total++) {
    const chosen = [];
    let found = null;
    // 막대마다 묶음을 고른다(앞 막대의 차례보다 뒤의 것만: 막대는 모두 똑같으니 차례를 따지지 않는다)
    const go = (bar, from, left) => {
      if (found) return;
      if (bar === m) {
        if (left !== 0) return;
        nodes += 1;
        const cuts = chosen.map(spotsOf);
        const pieces = sharePieces(board, cuts);
        const who = packShares(pieces.map((piece) => piece.len), n, m);
        if (who) found = { cuts, owners: Object.fromEntries(pieces.map((piece, index) => [piece.key, who[index]])) };
        return;
      }
      for (let at = from; at < masks.length; at++) {
        const count = popcount(masks[at]);
        if (count > left) continue;
        // 남은 막대들이 남은 자른 수를 다 받을 수 있어야 한다
        if (left - count > (m - bar - 1) * (n - 1)) continue;
        chosen.push(masks[at]);
        go(bar + 1, at, left - count);
        chosen.pop();
        if (found) return;
      }
    };
    go(0, 0, total);
    if (found) return { possible: true, best: m + total, cutsNeeded: total, cuts: found.cuts, owners: found.owners, nodes };
  }
  throw new Error('나눌 수 없는 판이에요');
}

const gcdOf = (a, b) => (b === 0 ? a : gcdOf(b, a % b));
export { gcdOf };

/**
 * 막대를 한 줄로 이어 놓고 사람마다 m칸씩 차례로 끊어 주는 나누기(그림으로 보여 주는 방법).
 * 사람 사이의 경계가 막대 사이에 오지 않는 곳만 자른다. 조각 수는 풀이 프로그램의 가장 적은 수와 같다(테스트가 확인한다).
 */
export function lineShare(board) {
  const { m, n } = board;
  const cuts = noCuts(board);
  for (let person = 1; person < n; person++) {
    const at = person * m;
    if (at % n !== 0) cuts[Math.floor(at / n)].push(at % n);
  }
  const owners = {};
  for (const piece of sharePieces(board, cuts)) owners[piece.key] = Math.floor((piece.bar * n + piece.start) / m);
  return { cuts: cuts.map((spots) => spots.sort((a, b) => a - b)), owners };
}

// ---- 판 하나 ----

const cellOk = (cell, w, h) => Array.isArray(cell) && cell.length === 2 && cell.every(isInt) && cell[0] >= 0 && cell[1] >= 0 && cell[0] < w && cell[1] < h;

/** 판이 쓸 수 있는 값인가. 쓸 수 있으면 null, 아니면 까닭(개발용 글) */
export function checkBoard(board) {
  if (!board || typeof board !== 'object' || !KINDS.includes(board.kind)) return '판의 종류가 맞지 않아요';
  if (board.kind === 'share') {
    const { m, n } = board;
    if (!isInt(m) || !isInt(n) || m < MIN_BARS || m > MAX_BARS || n < MIN_PEOPLE || n > MAX_PEOPLE) return '막대 수나 사람 수가 맞지 않아요';
    return null;
  }
  const { w, h } = board;
  if (!isInt(w) || !isInt(h) || w < 4 || h < 4 || w > SHADOW_W || h > SHADOW_H) return '크기가 맞지 않아요';
  if (board.kind === 'move') {
    const { cells, cuts } = board;
    if (!Array.isArray(cells) || cells.length < MIN_MOVE_AREA || cells.length > MAX_MOVE_AREA) return '칸 수가 맞지 않아요';
    if (!cells.every((cell) => cellOk(cell, w, h)) || new Set(cells.map(key)).size !== cells.length) return '칸이 판 밖이거나 겹쳐요';
    if (!isConnected(cells)) return '도형이 이어져 있지 않아요';
    if (isRect(cells)) return '이미 네모예요';
    if (!isInt(cuts) || cuts < 1 || cuts > MAX_CUTS) return '자르는 수가 맞지 않아요';
    return null;
  }
  const { set, shadow } = board;
  if (!Array.isArray(set) || set.length < 2 || set.length > SEVEN.length || !set.every((type) => type in PIECES)) return '조각이 맞지 않아요';
  if (!Array.isArray(shadow) || shadow.length < 2 || !shadow.every((cell) => cellOk(cell, w, h)) || new Set(shadow.map(key)).size !== shadow.length) return '그림자가 맞지 않아요';
  if (!isConnected(shadow)) return '그림자가 이어져 있지 않아요';
  const tray = trayOf(set);
  if (!tray.every((piece) => piece.cells.every((cell) => cellOk(cell, TRAY_W, h)))) return '조각이 둘 자리에 들어가지 않아요';
  if (shadow.some(([x]) => x <= TRAY_W)) return '그림자가 조각 자리에 겹쳐요';
  return null;
}

/** 판을 베낀다(기록과 저장에 쓰는 꼴) */
export function copyBoard(board) {
  if (board.kind === 'share') return { kind: 'share', m: board.m, n: board.n };
  if (board.kind === 'move') return { kind: 'move', w: board.w, h: board.h, cells: board.cells.map((cell) => cell.slice()).sort(byRow), cuts: board.cuts };
  return { kind: 'shadow', w: board.w, h: board.h, set: board.set.slice(), shadow: board.shadow.map((cell) => cell.slice()).sort(byRow) };
}

/** 판의 처음 조각들(잘라 옮겨 네모는 도형 하나, 가짜 그림자는 왼쪽 자리의 일곱 조각) */
export function startPieces(board) {
  if (board.kind === 'move') return [{ cells: board.cells.map((cell) => cell.slice()).sort(byRow), type: null, color: 0 }];
  if (board.kind === 'shadow') return trayOf(board.set);
  return [];
}

/**
 * 판을 푼다.
 *   move    solveMove의 값
 *   shadow  solveShadow의 값
 *   share   solveShare의 값과 그림으로 보여 줄 나누기(line)
 */
export function solve(board) {
  if (board.kind === 'move') return solveMove(board);
  if (board.kind === 'shadow') return solveShadow(board);
  return { ...solveShare(board), line: lineShare(board) };
}
