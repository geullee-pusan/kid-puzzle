// 구역 지도 맞히기의 사다리(단계)와 판 내기, 더 작은 판. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 지도는 시드 난수(rng.js)로 기른다.
//
// 지도 기르기: 구역마다 씨앗 칸 하나를 고르고, 칸 수가 적은 구역부터(가끔은 아무 구역이나) 맞닿은 빈칸 하나씩을 넓혀 간다.
// 맞닿은 칸만 붙이므로 구역은 늘 한 덩이로 이어져 있다. 구역마다 칸 수가 단계의 아래 끝보다 적으면 다시 기른다.
import { boardKey, checkBoard, sameBoard, sizesOf } from './regionmap.js';
import { createRng, randInt, seedFrom } from './rng.js';

/**
 * 사다리.
 *   tag   'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode  'ask'(물어서 맞히기: 한 구역이 네모) | 'shape'(구불구불한 바닷가) | 'three'(세 구역) | 'fewest'(가장 적게 묻기)
 *         | 'four'(네 구역) | 'make'(직접 만든다)
 */
export const LADDER = [
  { level: 1, tag: 'basic', mode: 'ask' },
  { level: 2, tag: 'basic', mode: 'shape' },
  { level: 3, tag: 'applied', mode: 'three' },
  { level: 4, tag: 'applied', mode: 'fewest' },
  { level: 5, tag: 'challenge', mode: 'four' },
  { level: 6, tag: 'challenge', mode: 'make' },
];

/** 판을 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;
/** 직접 만들기의 판 크기와 쓸 수 있는 구역(숲, 바다, 모래밭) */
export const MAKE_SIDE = 4;
export const MAKE_LABELS = [0, 1, 2];

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

/** 가장 적게 묻기: 판 번호가 홀수면 두 구역, 짝수면 세 구역 */
export const fewestRegions = (seed) => (seed % 2 === 1 ? 2 : 3);

// ---- 지도 기르기 ----

/** 칸들이 꽉 찬 네모 하나인가 */
export function isRect(cells, w, label) {
  const spots = cells.map((cell, at) => (cell === label ? at : -1)).filter((at) => at >= 0);
  const xs = spots.map((at) => at % w);
  const ys = spots.map((at) => Math.floor(at / w));
  const area = (Math.max(...xs) - Math.min(...xs) + 1) * (Math.max(...ys) - Math.min(...ys) + 1);
  return area === spots.length;
}

/**
 * 구역 k개의 지도를 기른다. 구역마다 칸 수가 floor 이상이 될 때까지 다시 기른다(많아야 400번).
 * @param {() => number} rng
 * @param {(board: object) => boolean} keep 이 판을 쓸지(구역의 모양을 가린다)
 */
export function grow(w, h, k, rng, floor, keep = () => true) {
  const n = w * h;
  const regions = Array.from({ length: k }, (_, at) => at);
  for (let tries = 0; tries < 400; tries++) {
    const cells = Array(n).fill(-1);
    const sizes = Array(k).fill(0);
    const seeds = [];
    while (seeds.length < k) {
      const cell = randInt(rng, 0, n - 1);
      if (!seeds.includes(cell)) seeds.push(cell);
    }
    seeds.forEach((cell, label) => {
      cells[cell] = label;
      sizes[label] = 1;
    });
    const frontier = (label) => {
      const list = [];
      for (let cell = 0; cell < n; cell++) {
        if (cells[cell] !== -1) continue;
        const x = cell % w;
        const near = [cell - w, cell + w, x > 0 ? cell - 1 : -1, x < w - 1 ? cell + 1 : -1];
        if (near.some((next) => next >= 0 && next < n && cells[next] === label)) list.push(cell);
      }
      return list;
    };
    let left = n - k;
    while (left > 0) {
      const open = regions.filter((label) => frontier(label).length > 0);
      // 칸 수가 가장 적은 구역을 자주 넓힌다(구역의 크기가 고르게)
      const smallest = open.reduce((best, label) => (sizes[label] < sizes[best] ? label : best), open[0]);
      const label = rng() < 0.6 ? smallest : open[randInt(rng, 0, open.length - 1)];
      const list = frontier(label);
      const cell = list[randInt(rng, 0, list.length - 1)];
      cells[cell] = label;
      sizes[label] += 1;
      left -= 1;
    }
    const board = { w, h, regions, cells };
    if (sizes.every((size) => size >= floor) && checkBoard(board) === null && keep(board)) return board;
  }
  throw new Error(`지도를 기르지 못했어요: ${w}×${h}, 구역 ${k}개`);
}

/** 한 구역이 네모인 두 구역 지도(물어서 맞히기). 네모의 칸 수는 3 이상이고 다른 구역도 3칸 이상이다 */
export function rectMap(w, h, rng, floor = 3) {
  const n = w * h;
  for (let tries = 0; tries < 400; tries++) {
    const x0 = randInt(rng, 0, w - 1);
    const y0 = randInt(rng, 0, h - 1);
    const x1 = randInt(rng, x0, w - 1);
    const y1 = randInt(rng, y0, h - 1);
    const area = (x1 - x0 + 1) * (y1 - y0 + 1);
    if (area < floor || n - area < floor) continue;
    const inside = randInt(rng, 0, 1);
    const cells = Array.from({ length: n }, (_, cell) => {
      const [x, y] = [cell % w, Math.floor(cell / w)];
      return x >= x0 && x <= x1 && y >= y0 && y <= y1 ? inside : 1 - inside;
    });
    const board = { w, h, regions: [0, 1], cells };
    if (checkBoard(board) === null) return board;
  }
  throw new Error(`네모 구역 지도를 만들지 못했어요: ${w}×${h}`);
}

// ---- 첫 판들 ----

/** 칸마다의 이름표를 글자로 적은 지도(한 줄에 가로 한 줄. 숫자는 이름표) */
const drawnMap = (rows) => {
  const cells = rows.join('').split('').map(Number);
  const regions = [...new Set(cells)].sort((a, b) => a - b);
  return { w: rows[0].length, h: rows.length, regions, cells };
};

/** 단계마다의 첫 판(판 번호 1) */
const FIRSTS = {
  // 3×3: 왼쪽 위 네 칸이 숲(네모)
  ask: () => drawnMap(['001', '001', '111']),
  // 4×4: 계단처럼 갈린 숲과 바다
  shape: () => drawnMap(['0001', '0011', '0111', '0011']),
  // 5×5: 숲, 바다, 모래밭
  three: () => drawnMap(['00011', '00111', '02211', '22211', '22221']),
  // 4×4: 위쪽 두 줄의 숲과 굽은 바다(네모 두 개를 물으면 하나로 정해진다)
  fewest: () => drawnMap(['0000', '0001', '1111', '1111']),
  // 6×6: 숲, 바다, 모래밭, 들판
  four: () => drawnMap(['000111', '001111', '022113', '222333', '222333', '223333']),
};

/** 단계마다 구역의 칸 수의 아래 끝 */
const FLOORS = { shape: 5, three: 5, fewest: 4, four: 6 };

/** 그 단계의 판 번호로 만드는 판 */
function boardAt(rung, seed) {
  if (seed === 1) return FIRSTS[rung.mode]();
  const rng = createRng(seedFrom('regionmap', rung.level, seed));
  if (rung.mode === 'ask') {
    // 넷에 셋은 4×4, 하나는 3×3
    const side = seed % 4 === 3 ? 3 : 4;
    return rectMap(side, side, rng);
  }
  if (rung.mode === 'shape') return grow(4, 4, 2, rng, FLOORS.shape, (board) => !board.regions.some((label) => isRect(board.cells, 4, label)));
  if (rung.mode === 'three') return grow(5, 5, 3, rng, FLOORS.three);
  if (rung.mode === 'fewest') return grow(4, 4, fewestRegions(seed), rng, FLOORS.fewest);
  return grow(6, 6, 4, rng, FLOORS.four);
}

/**
 * 판 하나를 낸다.
 * @param {number} level 1~5
 * @param {number} seed 판 번호(1부터)
 * @param {{small?: boolean}} options small: 맨 아래 단계에서 작은 판(첫 판)을 낸다(수준 맞추기에서 쓴다)
 * @returns {{level: number, seed: number, small: boolean, board: object}}
 */
export function generateBoard(level, seed, { small = false } = {}) {
  const rung = rungOf(level);
  if (rung.mode === 'make') throw new Error('직접 만들기 단계는 판을 내지 않아요');
  if (!Number.isInteger(seed) || seed < 1) throw new Error(`판 번호는 1부터예요: ${seed}`);
  const shrink = small && level === LADDER[0].level;
  const board = boardAt(rung, shrink ? 1 : seed);
  if (checkBoard(board) !== null) throw new Error(`규격에 맞지 않는 판이에요: ${checkBoard(board)}`);
  return { level, seed, small: shrink, board };
}

/** 다음 판 번호. 방금 한 판과 같은 판이 나오는 번호는 건너뛴다 */
export function nextSeed(level, seed) {
  const rung = rungOf(level);
  if (rung.mode === 'make') return seed + 1;
  const before = boardAt(rung, seed);
  let next = seed + 1;
  while (sameBoard(boardAt(rung, next), before)) next += 1;
  return next;
}

// ---- 더 작은 판 ----

/**
 * 더 작은 판들(많아야 둘). 같은 판에는 늘 같은 판들이 나온다.
 * 구역의 수는 같고, 가로와 세로가 한 칸씩 작은 판, 그다음 두 칸씩(안 되면 가로 한 칸, 세로 두 칸) 작은 판이다.
 * 구역마다 2칸 이상이다. 물어서 맞히기(두 구역, 한 구역이 네모)는 한 구역이 네모인 판, 구불구불한 바닷가는 두 구역이 모두 네모가 아닌 판(안 되면 아무 판)이다.
 * @param {object} origin { mode, board }
 * @returns {object[]}
 */
export function smallBoards(origin) {
  const { board, mode } = origin;
  if (!board || checkBoard(board) !== null) return [];
  const k = board.regions.length;
  const { w, h } = board;
  const sizes = [];
  const add = (a, b) => {
    if (a >= 2 && b >= 2 && a * b < w * h && a * b >= 2 * k && !sizes.some(([p, q]) => p === a && q === b)) sizes.push([a, b]);
  };
  add(w - 1, h - 1);
  if (w - 2 >= 2 && h - 2 >= 2 && (w - 2) * (h - 2) >= 2 * k) add(w - 2, h - 2);
  else add(w - 1, h - 2);
  const key = boardKey(board);
  return sizes.slice(0, 2).map(([a, b], at) => {
    const rng = createRng(seedFrom('regionmap-small', key, at));
    let small;
    if (mode === 'ask' && k === 2 && a * b >= 4) small = rectMap(a, b, rng, Math.min(3, Math.floor((a * b) / 2)));
    else {
      try {
        small = grow(a, b, k, rng, 2, mode === 'shape' ? (made) => !made.regions.some((label) => isRect(made.cells, a, label)) : () => true);
      } catch {
        small = grow(a, b, k, rng, 2);
      }
    }
    // 아이가 만든 판처럼 구역의 이름표가 0부터 차례가 아니면 같은 이름표로 바꾼다(숲과 모래밭으로 만든 판은 작은 판도 숲과 모래밭)
    const labels = board.regions;
    return { w: small.w, h: small.h, regions: labels.slice(), cells: small.cells.map((label) => labels[label]) };
  });
}

/** 판에 쓴 구역마다의 칸 수(regions의 차례대로) */
export const totalsOf = sizesOf;
