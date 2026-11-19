// 조각 못 들어가게 막기: 판, 조각이 들어갈 자리, 칸을 막고 여는 일, 풀이 프로그램. 순수 함수만 둔다.
// 화면에 손대지 않고, 무작위 수를 쓰지 않고, 지금 시각을 쓰지 않는다. 같은 입력은 늘 같은 출력을 낸다.
//
// 판(board): { w, h, piece, holes }. 조각 덮기의 판과 같은 꼴이다.
//   w, h    가로와 세로의 칸 수
//   piece   들어가지 못하게 할 조각 하나(PIECE_IDS 가운데 하나)
//   holes   판에서 빠진 칸의 번호들(작은 것부터). 직접 만들기에서만 쓴다. 빠진 칸에는 조각이 들어가지 못하고, 막은 칸으로 세지 않는다
//   칸 번호는 왼쪽 위가 0이고 오른쪽으로, 그다음 아래 줄로 센다(번호 = 세로 × w + 가로).
//
// 조각이 들어갈 자리(placement)는 조각이 차지하는 칸 번호들이다(작은 것부터). 조각은 돌려도 뒤집어도 된다.
// 아이가 칸을 누른 차례(taps)를 처음부터 따라가면 지금 막힌 칸들이 나온다. 같은 칸을 다시 누르면 다시 열린다.
// 목표는 조각이 들어갈 자리가 하나도 남지 않게 막는 것이고, 막은 칸을 되도록 적게 하는 것이다.
//
// 풀이 프로그램은 가지치기 탐색이다. 아직 막히지 않은 자리 하나를 골라 그 자리의 칸 가운데 어느 것을 막을지 하나씩 따진다.
// 앞 칸을 막지 않기로 한 갈래에서는 그 칸을 다시 막지 않는다(같은 막기를 두 번 따지지 않는다).
// 서로 겹치지 않는 남은 자리의 수만큼은 더 막아야 하므로, 지금까지 찾은 가장 적은 수에 못 미칠 갈래는 따지지 않는다.

/** 판의 가로와 세로의 아래 끝과 위 끝(직접 만들기에서 고를 수 있는 크기) */
export const MIN_SIZE = 2;
export const MAX_SIZE = 8;

/** 조각과 그 칸 수. 조각 덮기의 세 조각에 네 칸 조각 다섯을 더했다 */
export const PIECES = { domino: 2, bar: 3, ell: 3, square: 4, long: 4, tee: 4, bend: 4, zig: 4 };
export const PIECE_IDS = ['domino', 'bar', 'ell', 'square', 'long', 'tee', 'bend', 'zig'];

/** 조각의 한 가지 모양: 차지하는 칸의 (가로, 세로) */
const BASE = {
  domino: [[0, 0], [1, 0]],
  bar: [[0, 0], [1, 0], [2, 0]],
  ell: [[0, 0], [1, 0], [0, 1]],
  square: [[0, 0], [1, 0], [0, 1], [1, 1]],
  long: [[0, 0], [1, 0], [2, 0], [3, 0]],
  tee: [[0, 0], [1, 0], [2, 0], [1, 1]],
  bend: [[0, 0], [0, 1], [0, 2], [1, 2]],
  zig: [[1, 0], [2, 0], [0, 1], [1, 1]],
};

/**
 * 풀이 프로그램이 따져 보는 갈래 수의 위 끝. 넘으면 "끝까지 따져 보지 못했다"고 사실대로 말한다.
 * 사다리의 판은 이보다 한참 적게 따진다(tests/block.test.js). 직접 만든 큰 판(여덟 칸의 ㄱ자 세 칸 등)은 넘을 수 있다.
 */
export const SOLVE_LIMIT = 100000;

/** 조각을 돌리고 뒤집은 모양들(겹치는 것은 하나로). 모양마다 칸의 (가로, 세로)를 위에서 아래, 왼쪽에서 오른쪽 차례로 적는다 */
export function orientationsOf(piece) {
  const found = new Map();
  for (let turn = 0; turn < 8; turn++) {
    let cells = BASE[piece].map(([x, y]) => {
      let a = turn >= 4 ? -x : x;
      let b = y;
      for (let quarter = 0; quarter < turn % 4; quarter++) [a, b] = [-b, a];
      return [a, b];
    });
    const left = Math.min(...cells.map((cell) => cell[0]));
    const top = Math.min(...cells.map((cell) => cell[1]));
    cells = cells.map(([a, b]) => [a - left, b - top]).sort((p, q) => p[1] - q[1] || p[0] - q[0]);
    const key = cells.join(' ');
    if (!found.has(key)) found.set(key, cells);
  }
  return [...found.values()];
}

/** 판이 규격에 맞는지 본다. 맞으면 null, 아니면 무엇이 틀렸는지 알리는 열쇠 */
export function checkBoard(board) {
  if (!board || typeof board !== 'object') return 'no-board';
  for (const side of [board.w, board.h]) {
    if (!Number.isInteger(side) || side < MIN_SIZE || side > MAX_SIZE) return 'bad-size';
  }
  if (!PIECE_IDS.includes(board.piece)) return 'bad-piece';
  if (!Array.isArray(board.holes)) return 'bad-holes';
  const cells = board.w * board.h;
  let before = -1;
  for (const hole of board.holes) {
    if (!Number.isInteger(hole) || hole <= before || hole >= cells) return 'bad-holes';
    before = hole;
  }
  if (board.holes.length >= cells) return 'no-cells';
  return null;
}

export const xyOf = (board, cell) => [cell % board.w, Math.floor(cell / board.w)];

const byCells = (a, b) => {
  for (let index = 0; index < a.length; index++) if (a[index] !== b[index]) return a[index] - b[index];
  return 0;
};

/** 판에서 조각이 들어갈 수 있는 모든 자리(빠진 칸은 피한다. 막은 칸은 따지지 않는다). 칸 번호 차례로 줄 세운다 */
export function allPlacements(board) {
  const holes = new Set(board.holes);
  const found = [];
  for (const shape of orientationsOf(board.piece)) {
    const wide = Math.max(...shape.map((cell) => cell[0])) + 1;
    const tall = Math.max(...shape.map((cell) => cell[1])) + 1;
    for (let y = 0; y + tall <= board.h; y++) {
      for (let x = 0; x + wide <= board.w; x++) {
        const cells = shape.map(([a, b]) => (y + b) * board.w + x + a).sort((p, q) => p - q);
        if (cells.every((cell) => !holes.has(cell))) found.push(cells);
      }
    }
  }
  return found.sort(byCells);
}

/** 막은 칸들이 있을 때 아직 조각이 들어갈 수 있는 자리들 */
export function placementsOf(board, blocked = []) {
  const shut = new Set(blocked);
  return allPlacements(board).filter((cells) => cells.every((cell) => !shut.has(cell)));
}

/**
 * 누른 차례를 처음부터 따라가 본다.
 * @param {object} board
 * @param {number[]} taps 누른 칸의 차례. 같은 칸을 다시 누르면 다시 열린다
 * @returns {{ok: boolean, blocked: number[], count: number, left: number, shut: boolean}}
 *   ok       차례가 모두 규칙에 맞는가(판 밖이나 빠진 칸을 누르지 않았는가. 아니면 맞는 데까지만 간다)
 *   blocked  지금 막힌 칸(작은 것부터)
 *   count    막힌 칸의 수
 *   left     아직 조각이 들어갈 수 있는 자리의 수
 *   shut     조각이 들어갈 자리가 하나도 없는가
 */
export function replay(board, taps = []) {
  const holes = new Set(board.holes);
  const shut = new Set();
  let ok = Array.isArray(taps);
  for (const cell of ok ? taps : []) {
    if (!Number.isInteger(cell) || cell < 0 || cell >= board.w * board.h || holes.has(cell)) {
      ok = false;
      break;
    }
    if (shut.has(cell)) shut.delete(cell);
    else shut.add(cell);
  }
  const blocked = [...shut].sort((a, b) => a - b);
  const left = placementsOf(board, blocked).length;
  return { ok, blocked, count: blocked.length, left, shut: left === 0 };
}

/** 막은 칸 가운데, 다시 열어도 조각이 들어갈 자리가 생기지 않는 칸들(조각이 들어갈 자리가 없는 판에서 쓴다) */
export function spareCells(board, blocked) {
  return blocked.filter((cell) => placementsOf(board, blocked.filter((item) => item !== cell)).length === 0);
}

/**
 * "자리가 가장 많이 지나는 칸부터 막기": 아직 막히지 않은 자리가 가장 많이 지나는 칸을 막기를 되풀이한다.
 * 그런 칸이 여럿이면 번호가 작은 칸을 막는다. 쓸데없어진 칸을 다시 열지는 않는다.
 * @returns {number[]} 막은 칸(막은 차례대로)
 */
export function greedyBlock(board) {
  const spots = allPlacements(board);
  const cells = board.w * board.h;
  const open = spots.map(() => true);
  const order = [];
  for (;;) {
    const through = new Array(cells).fill(0);
    spots.forEach((spot, index) => {
      if (open[index]) for (const cell of spot) through[cell] += 1;
    });
    let pick = -1;
    for (let cell = 0; cell < cells; cell++) if (through[cell] > 0 && (pick < 0 || through[cell] > through[pick])) pick = cell;
    if (pick < 0) break;
    order.push(pick);
    spots.forEach((spot, index) => {
      if (spot.includes(pick)) open[index] = false;
    });
  }
  return order;
}

/**
 * 풀이 프로그램: 조각이 들어갈 자리가 하나도 없게 하는 가장 적은 막기를 찾는다.
 * @param {object} board
 * @param {{limit?: number}} options limit: 따져 보는 갈래 수의 위 끝
 * @returns {{exact: boolean, best: number, blocked: number[], spots: number, nodes: number}}
 *   exact    끝까지 따졌는가. false면 best와 blocked는 그때까지 찾은 가장 적은 막기다(더 적게 막을 수 있을지도 모른다)
 *   best     가장 적게 막는 칸 수(조각이 들어갈 자리가 처음부터 없는 판은 0)
 *   blocked  그만큼 막는 한 가지 방법(작은 것부터). 같은 판은 늘 같은 방법이다
 *   spots    처음 판에서 조각이 들어갈 수 있는 자리의 수
 *   nodes    따져 본 갈래의 수
 */
export function solve(board, { limit = SOLVE_LIMIT } = {}) {
  const spots = allPlacements(board);
  const cells = board.w * board.h;
  const size = PIECES[board.piece];
  if (spots.length === 0) return { exact: true, best: 0, blocked: [], spots: 0, nodes: 0 };

  const through = Array.from({ length: cells }, () => []);
  spots.forEach((spot, index) => {
    for (const cell of spot) through[cell].push(index);
  });
  const hit = new Int32Array(spots.length); // 자리마다 막힌 칸의 수
  const free = new Int32Array(spots.length).fill(size); // 자리마다 아직 막을 수 있는 칸의 수(막지 않기로 한 칸을 뺀다)
  const kept = new Uint8Array(cells); // 이 갈래에서 막지 않기로 한 칸
  const seen = new Int32Array(cells);
  let stamp = 0;

  // 처음 답: 자리가 가장 많이 지나는 칸부터 막고, 쓸데없는 칸을 큰 번호부터 다시 연다.
  let start = greedyBlock(board).sort((a, b) => b - a);
  for (const cell of start.slice()) {
    const rest = start.filter((item) => item !== cell);
    if (placementsOf(board, rest).length === 0) start = rest;
  }
  let best = start.length;
  let bestSet = start.slice();
  const chosen = [];
  let nodes = 0;
  let over = false;

  const search = () => {
    nodes += 1;
    if (nodes > limit) {
      over = true;
      return;
    }
    // 아직 막히지 않은 자리를, 막을 수 있는 칸이 적은 것부터 모은다.
    const buckets = Array.from({ length: size + 1 }, () => []);
    let any = false;
    for (let index = 0; index < spots.length; index++) {
      if (hit[index] > 0) continue;
      if (free[index] === 0) return; // 막을 수 있는 칸이 없는 자리가 남았다: 이 갈래로는 안 된다
      buckets[free[index]].push(index);
      any = true;
    }
    if (!any) {
      if (chosen.length < best) {
        best = chosen.length;
        bestSet = chosen.slice();
      }
      return;
    }
    // 서로 겹치지 않는 남은 자리의 수만큼은 더 막아야 한다.
    stamp += 1;
    let more = 0;
    for (const bucket of buckets) {
      for (const index of bucket) {
        const spot = spots[index];
        if (spot.some((cell) => !kept[cell] && seen[cell] === stamp)) continue;
        more += 1;
        for (const cell of spot) if (!kept[cell]) seen[cell] = stamp;
      }
    }
    if (chosen.length + more >= best) return;
    // 막을 수 있는 칸이 가장 적은 자리를 골라, 그 자리의 칸 가운데 하나를 막는다. 남은 자리가 많이 지나는 칸부터 따진다.
    const pick = buckets.find((bucket) => bucket.length > 0)[0];
    const options = spots[pick]
      .filter((cell) => !kept[cell])
      .map((cell) => [cell, through[cell].reduce((count, index) => count + (hit[index] === 0 ? 1 : 0), 0)])
      .sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    const skipped = [];
    for (const [cell] of options) {
      chosen.push(cell);
      for (const index of through[cell]) hit[index] += 1;
      search();
      for (const index of through[cell]) hit[index] -= 1;
      chosen.pop();
      if (over) break;
      // 이 칸을 막는 갈래는 다 따졌다. 나머지 갈래에서는 이 칸을 막지 않는다.
      kept[cell] = 1;
      for (const index of through[cell]) free[index] -= 1;
      skipped.push(cell);
    }
    for (const cell of skipped) {
      kept[cell] = 0;
      for (const index of through[cell]) free[index] += 1;
    }
  };
  search();
  return { exact: !over, best, blocked: bestSet.slice().sort((a, b) => a - b), spots: spots.length, nodes };
}
