// 테스트에서 조각 못 들어가게 막기의 풀이 프로그램과 견줄 때 쓰는 다른 방법들.
// 조각의 모양은 여기서 따로, 손으로 그려 적는다(풀이 프로그램이 돌리고 뒤집어 만든 모양과 견주려고).
// 방법 둘: 작은 판은 막을 칸의 묶음을 적은 것부터 하나하나 다 해 보고, 그보다 큰 판은 위 줄부터 한 줄씩 막을 칸을 정해 가며 센다.

/** 조각마다 돌리고 뒤집은 모양을 모두 그림으로 적었다. '#'이 조각의 칸이고 '/'는 줄바꿈이다 */
export const DRAWN = {
  domino: ['##', '#/#'],
  bar: ['###', '#/#/#'],
  ell: ['##/#.', '##/.#', '#./##', '.#/##'],
  square: ['##/##'],
  long: ['####', '#/#/#/#'],
  tee: ['###/.#.', '.#./###', '#./##/#.', '.#/##/.#'],
  bend: ['#./#./##', '.#/.#/##', '##/#./#.', '##/.#/.#', '###/#..', '###/..#', '#../###', '..#/###'],
  zig: ['.##/##.', '##./.##', '#./##/.#', '.#/##/#.'],
};

/** 그림 하나를 (가로, 세로) 칸들과 크기로 바꾼다 */
function parse(picture) {
  const rows = picture.split('/');
  const cells = [];
  rows.forEach((row, y) => [...row].forEach((mark, x) => mark === '#' && cells.push([x, y])));
  return { cells, w: rows[0].length, h: rows.length };
}

/** 판에서 조각이 들어갈 수 있는 모든 자리(빠진 칸은 피한다). 자리마다 칸 번호들 */
export function bruteSpots(board) {
  const holes = new Set(board.holes);
  const spots = [];
  for (const picture of DRAWN[board.piece]) {
    const shape = parse(picture);
    for (let y = 0; y + shape.h <= board.h; y++) {
      for (let x = 0; x + shape.w <= board.w; x++) {
        const cells = shape.cells.map(([a, b]) => (y + b) * board.w + x + a);
        if (cells.every((cell) => !holes.has(cell))) spots.push(cells.sort((p, q) => p - q));
      }
    }
  }
  return spots;
}

/**
 * 막을 칸의 묶음을 적은 것부터 하나하나 다 해 본다. 칸이 30개 이하인 판에서만 쓴다.
 * @returns {{best: number, ways: number}} 가장 적게 막는 칸 수와, 그만큼 막는 방법의 수
 */
export function bruteBlock(board) {
  const cells = board.w * board.h;
  if (cells > 30) throw new Error('칸이 너무 많아요');
  const masks = bruteSpots(board).map((spot) => spot.reduce((mask, cell) => mask | (1 << cell), 0));
  const open = Array.from({ length: cells }, (_, cell) => cell).filter((cell) => !board.holes.includes(cell));
  const blocksAll = (mask) => masks.every((spot) => (spot & mask) !== 0);
  for (let size = 0; size <= open.length; size++) {
    let ways = 0;
    const pick = (from, left, mask) => {
      if (left === 0) {
        if (blocksAll(mask)) ways += 1;
        return;
      }
      for (let index = from; index <= open.length - left; index++) pick(index + 1, left - 1, mask | (1 << open[index]));
    };
    pick(0, size, 0);
    if (ways > 0) return { best: size, ways };
  }
  throw new Error('막을 수 없는 판이에요');
}

/**
 * 위 줄부터 한 줄씩 막을 칸을 정해 가며 가장 적은 수를 센다. 기억하는 것은 바로 위의 몇 줄(조각의 키 - 1줄)에서 닫힌 칸(막았거나 빠진 칸)이다.
 * 줄을 하나 정할 때마다, 그 줄을 맨 아래 줄로 하는 자리가 모두 닫힌 칸을 지나는지 본다.
 * @returns {number} 가장 적게 막는 칸 수
 */
export function rowBlock(board) {
  const { w, h } = board;
  const shapes = DRAWN[board.piece].map(parse);
  const tall = Math.max(...shapes.map((shape) => shape.h));
  const keep = tall - 1;
  const full = (1 << w) - 1;
  const holeRow = Array.from({ length: h }, (_, y) => board.holes.filter((cell) => Math.floor(cell / w) === y).reduce((mask, cell) => mask | (1 << (cell % w)), 0));
  // 모양마다, 줄마다 칸의 무늬(맨 아래 줄이 마지막)
  const patterns = shapes.map((shape) => ({ w: shape.w, rows: Array.from({ length: shape.h }, (_, y) => shape.cells.filter((cell) => cell[1] === y).reduce((mask, [x]) => mask | (1 << x), 0)) }));
  const bits = (mask) => {
    let count = 0;
    for (let rest = mask; rest; rest &= rest - 1) count += 1;
    return count;
  };
  // 닫힌 줄들(위에서 아래로)의 맨 아래 줄까지 와서 들어가는 자리가 있는가
  const fits = (closed) => {
    for (const pattern of patterns) {
      if (pattern.rows.length > closed.length) continue;
      const rows = closed.slice(closed.length - pattern.rows.length);
      for (let x = 0; x + pattern.w <= w; x++) {
        if (pattern.rows.every((row, index) => ((row << x) & rows[index]) === 0)) return true;
      }
    }
    return false;
  };
  // 상태: 바로 위 keep줄의 닫힌 칸을 한 수로 이어 적는다(위 줄이 높은 자리). 판 위쪽 바깥은 모두 닫힌 것으로 본다.
  const stateCount = 2 ** (keep * w);
  const unpack = (key) => Array.from({ length: keep }, (_, index) => Math.floor(key / 2 ** ((keep - 1 - index) * w)) % 2 ** w);
  const pack = (rows) => rows.reduce((key, row) => key * 2 ** w + row, 0);
  const NONE = 1e9;
  let costs = new Float64Array(stateCount).fill(NONE);
  costs[pack(Array(keep).fill(full))] = 0;
  for (let y = 0; y < h; y++) {
    const next = new Float64Array(stateCount).fill(NONE);
    for (let key = 0; key < stateCount; key++) {
      const cost = costs[key];
      if (cost === NONE) continue;
      const above = unpack(key);
      for (let shut = 0; shut <= full; shut++) {
        if (shut & holeRow[y]) continue;
        const closed = [...above, shut | holeRow[y]];
        if (fits(closed)) continue;
        const nextKey = pack(closed.slice(closed.length - keep));
        const total = cost + bits(shut);
        if (total < next[nextKey]) next[nextKey] = total;
      }
    }
    costs = next;
  }
  let best = NONE;
  for (const cost of costs) if (cost < best) best = cost;
  return best;
}

/** 서로 겹치지 않게 놓을 수 있는 자리의 가장 많은 수(모든 묶음을 따진다). 칸이 30개 이하인 판에서만 쓴다 */
export function brutePacking(board) {
  if (board.w * board.h > 30) throw new Error('칸이 너무 많아요');
  const masks = bruteSpots(board).map((spot) => spot.reduce((mask, cell) => mask | (1 << cell), 0));
  let best = 0;
  const go = (from, used, count) => {
    best = Math.max(best, count);
    for (let index = from; index < masks.length; index++) if ((masks[index] & used) === 0) go(index + 1, used | masks[index], count + 1);
  };
  go(0, 0, 0);
  return best;
}

/**
 * 서로 겹치지 않는 자리를 count개 찾는다(찾으면 바로 멈춘다). 어느 크기의 판에서나 쓴다.
 * 찾은 자리마다 적어도 한 칸은 막아야 하므로, 찾았다면 count칸보다 적게는 막을 수 없다는 증거가 된다.
 * @returns {number[][]|null} 찾은 자리들. 못 찾으면 null
 */
export function disjointSpots(board, count) {
  const spots = bruteSpots(board);
  const used = new Set();
  const chosen = [];
  const go = (from) => {
    if (chosen.length === count) return true;
    for (let index = from; index < spots.length; index++) {
      if (spots[index].some((cell) => used.has(cell))) continue;
      for (const cell of spots[index]) used.add(cell);
      chosen.push(spots[index]);
      if (go(index + 1)) return true;
      chosen.pop();
      for (const cell of spots[index]) used.delete(cell);
    }
    return false;
  };
  return go(0) ? chosen.map((spot) => spot.slice()) : null;
}
