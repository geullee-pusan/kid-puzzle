// 테스트에서 조각 덮기의 풀이 프로그램과 견줄 때 쓰는 다른 방법들.
// 풀이 프로그램은 "맨 처음 빈칸을 덮는 방법"을 차례로 따진다. 여기서는 조각 자리를 따로 만들어 내고(모양을 좌표로 직접 가려서),
//   가. 조각 자리의 목록을 앞에서부터 하나씩 "쓴다 / 안 쓴다"로 갈라 모든 부분집합을 따지거나(bruteSubsets),
//   나. 덮는 방법이 가장 적은 빈칸부터 따지며 덮는 방법의 수를 센다(bruteCount).
// 칸의 모습은 수 하나(비트)로 적는다. 그래서 칸이 30개 이하인 판에서만 쓴다.
// 큰 판(64칸까지)은 큰 정수(BigInt)로 칸의 모습을 적는 빠짐없는 덮기 찾기(bruteCover)로 따지고, 금 없는 벽의 금은 bruteHasFault로 따로 센다.
// 네 칸 조각의 놓임새는 그림으로 손수 적어 두었다(풀이 프로그램의 모양 표를 쓰지 않는다).

const SIZE = { domino: 2, bar: 3, ell: 3 };

/**
 * 네 칸 조각의 모든 놓임새(돌리고 뒤집은 것)를 손으로 적어 둔 것. 풀이 프로그램(src/core/block.js의 orientationsOf)을 쓰지 않는다.
 * 그림으로 적었다: 한 줄이 판의 한 줄이고, #이 조각의 칸이다.
 */
const FOUR_DRAWN = {
  square: ['##/##'],
  long: ['####', '#/#/#/#'],
  tee: ['###/.#.', '.#./###', '#./##/#.', '.#/##/.#'],
  bend: ['#./#./##', '.#/.#/##', '##/#./#.', '##/.#/.#', '###/#..', '###/..#', '#../###', '..#/###'],
  zig: ['.##/##.', '##./.##', '#./##/.#', '.#/##/#.'],
};
const FOUR_COORDS = Object.fromEntries(
  Object.entries(FOUR_DRAWN).map(([piece, drawings]) => [
    piece,
    drawings.map((drawing) => drawing.split('/').flatMap((row, y) => [...row].flatMap((mark, x) => (mark === '#' ? [[x, y]] : [])))),
  ]),
);
export const FOUR_ORIENTATIONS = Object.fromEntries(Object.entries(FOUR_COORDS).map(([piece, list]) => [piece, list.length]));

/** 판의 모든 조각 자리. 풀이 프로그램의 모양 표를 쓰지 않고, 칸의 묶음을 좌표로 직접 가린다. */
export function allSpots(board) {
  const { w, h, piece } = board;
  const holes = new Set(board.holes);
  const cell = (x, y) => y * w + x;
  const groups = [];
  if (FOUR_COORDS[piece]) {
    // 네 칸 조각: 손으로 적은 놓임새마다 판 안의 모든 자리
    for (const shape of FOUR_COORDS[piece]) {
      const wide = Math.max(...shape.map(([x]) => x)) + 1;
      const tall = Math.max(...shape.map(([, y]) => y)) + 1;
      for (let y = 0; y + tall <= h; y++) for (let x = 0; x + wide <= w; x++) groups.push(shape.map(([dx, dy]) => cell(x + dx, y + dy)).sort((a, b) => a - b));
    }
  } else if (piece === 'domino' || piece === 'bar') {
    const n = SIZE[piece];
    // 누운 것 먼저, 선 것은 그다음에 넣는다(맨 처음 빈칸의 차례와 다르게).
    for (let y = 0; y < h; y++) for (let x = 0; x + n <= w; x++) groups.push(Array.from({ length: n }, (_, i) => cell(x + i, y)));
    for (let x = 0; x < w; x++) for (let y = 0; y + n <= h; y++) groups.push(Array.from({ length: n }, (_, i) => cell(x, y + i)));
  } else {
    // ㄱ자: 두 칸짜리 네모마다 한 칸을 뺀 네 가지
    for (let skip = 0; skip < 4; skip++) {
      for (let y = 0; y + 1 < h; y++) {
        for (let x = 0; x + 1 < w; x++) {
          const four = [cell(x, y), cell(x + 1, y), cell(x, y + 1), cell(x + 1, y + 1)];
          groups.push(four.filter((_, index) => index !== skip));
        }
      }
    }
  }
  return groups.filter((cells) => cells.every((item) => !holes.has(item)));
}

const maskOf = (cells) => cells.reduce((mask, cell) => mask | (1 << cell), 0);

function fullMask(board) {
  let mask = 0;
  for (let cell = 0; cell < board.w * board.h; cell++) if (!board.holes.includes(cell)) mask |= 1 << cell;
  return mask;
}

/**
 * 조각 자리의 모든 부분집합을 따진다: 목록의 앞에서부터 자리 하나마다 "쓴다 / 안 쓴다"로 가른다.
 * 남은 자리로는 덮을 수 없는 빈칸이 생기면 거기서 그만둔다. 같은 (몇 번째 자리, 덮인 모습)은 한 번만 따진다.
 * @returns {boolean} 덮는 방법이 있는가
 */
export function bruteSubsets(board) {
  if (board.w * board.h > 30) throw new Error('칸이 너무 많아요');
  const spots = allSpots(board).map(maskOf);
  const full = fullMask(board);
  // 칸마다, 그 칸을 덮는 자리 가운데 맨 뒤의 것이 몇 번째인가
  const last = Array(board.w * board.h).fill(-1);
  spots.forEach((mask, index) => {
    for (let cell = 0; cell < last.length; cell++) if (mask & (1 << cell)) last[cell] = index;
  });
  const seen = new Set();
  const visit = (index, covered) => {
    if (covered === full) return true;
    for (let cell = 0; cell < last.length; cell++) {
      if (full & (1 << cell) && !(covered & (1 << cell)) && last[cell] < index) return false;
    }
    const key = index * 2 ** 30 + covered;
    if (seen.has(key)) return false;
    seen.add(key);
    if ((spots[index] & covered) === 0 && visit(index + 1, covered | spots[index])) return true;
    return visit(index + 1, covered);
  };
  return visit(0, 0);
}

/**
 * 덮는 방법의 수를 센다. 덮는 방법이 가장 적은 빈칸을 골라, 그 칸을 덮는 자리마다 나머지를 센다.
 * @returns {number} 덮는 방법의 수(0이면 안 되는 판)
 */
export function bruteCount(board) {
  if (board.w * board.h > 30) throw new Error('칸이 너무 많아요');
  const spots = allSpots(board).map(maskOf);
  const full = fullMask(board);
  const memo = new Map();
  const count = (covered) => {
    if (covered === full) return 1;
    if (memo.has(covered)) return memo.get(covered);
    let best = null;
    for (let cell = 0; cell < board.w * board.h; cell++) {
      const bit = 1 << cell;
      if (!(full & bit) || covered & bit) continue;
      const options = spots.filter((mask) => mask & bit && (mask & covered) === 0);
      if (best === null || options.length < best.length) best = options;
      if (options.length === 0) break;
    }
    let ways = 0;
    for (const mask of best) ways += count(covered | mask);
    memo.set(covered, ways);
    return ways;
  };
  return count(0);
}

/**
 * 아무렇게나 놓았을 때(놓을 수 있는 자리 가운데 하나를 고르게 뽑아 놓기를 되풀이할 때) 끝까지 덮이는 비율.
 * 뽑아 보지 않고 모든 갈림을 따져서 셈한다. 작은 판에서만 쓴다.
 */
export function bruteFillRate(board) {
  if (board.w * board.h > 30) throw new Error('칸이 너무 많아요');
  const spots = allSpots(board).map(maskOf);
  const full = fullMask(board);
  const memo = new Map();
  const rate = (covered) => {
    if (covered === full) return 1;
    if (memo.has(covered)) return memo.get(covered);
    const open = spots.filter((mask) => (mask & covered) === 0);
    let sum = 0;
    for (const mask of open) sum += rate(covered | mask);
    const value = open.length === 0 ? 0 : sum / open.length;
    memo.set(covered, value);
    return value;
  };
  return rate(0);
}

/**
 * 큰 판(64칸까지)에서 쓰는 빠짐없는 덮기 찾기(exact cover). 풀이 프로그램과 다르게 따진다:
 * 덮인 칸을 큰 정수(BigInt) 하나로 적고, 덮는 방법이 가장 적은 빈칸을 골라 그 칸을 덮는 자리를 하나씩 해 본다.
 * 다 덮을 때마다 accept(덮는 방법)를 묻고, true면 그 방법을 내놓고 멈춘다. accept가 없으면 처음 찾은 방법을 내놓는다.
 * accept가 없을 때만, 끝까지 못 간 덮인 모습을 적어 두고 다시 따지지 않는다(다른 조건을 붙이면 모습만으로는 같은 갈래가 아니다).
 * @returns {{tiling: number[][]|null, covers: number}} tiling: 찾은 덮는 방법(없으면 null), covers: 그동안 다 덮은 방법의 수
 */
export function bruteCover(board, accept = null) {
  const cells = board.w * board.h;
  const spots = allSpots(board);
  const masks = spots.map((list) => list.reduce((mask, item) => mask | (1n << BigInt(item)), 0n));
  const byCell = Array.from({ length: cells }, () => []);
  spots.forEach((list, index) => {
    for (const item of list) byCell[item].push(index);
  });
  let full = 0n;
  for (let item = 0; item < cells; item++) if (!board.holes.includes(item)) full |= 1n << BigInt(item);
  const dead = new Set();
  const chosen = [];
  let covers = 0;
  const visit = (covered) => {
    if (covered === full) {
      covers += 1;
      return accept === null || accept(chosen.map((index) => spots[index]));
    }
    if (accept === null && dead.has(covered)) return false;
    let best = null;
    for (let item = 0; item < cells; item++) {
      const bit = 1n << BigInt(item);
      if (!(full & bit) || covered & bit) continue;
      const options = byCell[item].filter((index) => (masks[index] & covered) === 0n);
      if (best === null || options.length < best.length) best = options;
      if (options.length === 0) break;
    }
    for (const index of best) {
      chosen.push(index);
      if (visit(covered | masks[index])) return true;
      chosen.pop();
    }
    if (accept === null) dead.add(covered);
    return false;
  };
  const found = visit(0n);
  return { tiling: found ? chosen.map((index) => spots[index]) : null, covers };
}

/**
 * 다 덮은 판에 금이 있는가: 판의 끝에서 끝까지 곧게 가는 칸 사이의 선 가운데, 양쪽 칸이 한 조각에 들어 있는 곳이 하나도 없는 선.
 * 풀이 프로그램(faultLines)을 쓰지 않고 칸 번호로 따로 센다.
 */
export function bruteHasFault(board, tiling) {
  const owner = new Map();
  tiling.forEach((list, index) => {
    for (const item of list) owner.set(item, index);
  });
  for (let x = 1; x < board.w; x++) {
    let crossed = false;
    for (let y = 0; y < board.h; y++) if (owner.get(y * board.w + x - 1) === owner.get(y * board.w + x)) crossed = true;
    if (!crossed) return true;
  }
  for (let y = 1; y < board.h; y++) {
    let crossed = false;
    for (let x = 0; x < board.w; x++) if (owner.get((y - 1) * board.w + x) === owner.get(y * board.w + x)) crossed = true;
    if (!crossed) return true;
  }
  return false;
}

/**
 * 판의 모든 칸을 꼭 한 번씩 지나 처음으로 돌아오는 한 줄 길. 칸이 짝수 개인 네모 판에만 있다.
 * 맨 윗줄을 오른쪽 끝까지 가고, 아래 줄들을 왼쪽 한 줄만 남기고 구불구불 내려온 뒤, 남긴 왼쪽 줄로 올라온다.
 * @returns {number[]} 지나는 칸의 차례
 */
export function loopOf(w, h) {
  if ((w * h) % 2 !== 0 || w < 2 || h < 2) throw new Error('한 바퀴 도는 길이 없는 판이에요');
  if (h % 2 !== 0) {
    // 세로가 홀수면 가로와 세로를 바꿔 만든 길을 돌려 놓는다.
    return loopOf(h, w).map((cell) => {
      const x = cell % h;
      const y = Math.floor(cell / h);
      return x * w + y;
    });
  }
  const path = [];
  for (let x = 0; x < w; x++) path.push(x);
  for (let y = 1; y < h; y++) {
    const xs = Array.from({ length: w - 1 }, (_, index) => index + 1);
    if (y % 2 === 1) xs.reverse();
    for (const x of xs) path.push(y * w + x);
  }
  for (let y = h - 1; y >= 1; y--) path.push(y * w);
  return path;
}
