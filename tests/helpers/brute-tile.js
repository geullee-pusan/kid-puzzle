// 테스트에서 조각 덮기의 풀이 프로그램과 견줄 때 쓰는 다른 방법들.
// 풀이 프로그램은 "맨 처음 빈칸을 덮는 방법"을 차례로 따진다. 여기서는 조각 자리를 따로 만들어 내고(모양을 좌표로 직접 가려서),
//   가. 조각 자리의 목록을 앞에서부터 하나씩 "쓴다 / 안 쓴다"로 갈라 모든 부분집합을 따지거나(bruteSubsets),
//   나. 덮는 방법이 가장 적은 빈칸부터 따지며 덮는 방법의 수를 센다(bruteCount).
// 칸의 모습은 수 하나(비트)로 적는다. 그래서 칸이 30개 이하인 판에서만 쓴다.

const SIZE = { domino: 2, bar: 3, ell: 3 };

/** 판의 모든 조각 자리. 풀이 프로그램의 모양 표를 쓰지 않고, 칸의 묶음을 좌표로 직접 가린다. */
export function allSpots(board) {
  const { w, h, piece } = board;
  const holes = new Set(board.holes);
  const cell = (x, y) => y * w + x;
  const groups = [];
  if (piece === 'domino' || piece === 'bar') {
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
