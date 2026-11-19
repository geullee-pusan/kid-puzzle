// 똑같이 섞이게 자르기를 풀이 프로그램(src/core/split.js)과 다른 방법으로 다시 푼다(테스트 전용).
// 자르는 차례를 따라가지 않고, 판을 네모 조각 k개로 나누는 모든 방법을 칸 채우기로 센다:
// 아직 조각에 들지 않은 칸 가운데 맨 위 왼쪽 칸은 어떤 조각의 맨 위 왼쪽 칸이어야 하므로, 그 칸에서 시작하는 네모(빈칸만 덮는 것)를 하나씩 놓아 본다.
// 섞인 꼴은 칸을 하나씩 세어 엇갈려 곱해 견준다.

/** 판을 네모 조각 k개로 나누는 모든 방법(조각마다 "x,y,w,h", 정렬해서 ;로 이은 이름) */
export function brutePartitions(w, h, k) {
  const used = Array.from({ length: h }, () => new Array(w).fill(false));
  const pieces = [];
  const found = [];
  function firstFree() {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!used[y][x]) return [x, y];
    return null;
  }
  function go() {
    const free = firstFree();
    if (!free) {
      if (pieces.length === k) found.push(pieces.map((rect) => rect.join(',')).sort().join(';'));
      return;
    }
    if (pieces.length >= k) return;
    const [x0, y0] = free;
    for (let pw = 1; x0 + pw <= w && !used[y0][x0 + pw - 1]; pw++) {
      for (let ph = 1; y0 + ph <= h; ph++) {
        let clear = true;
        for (let x = x0; x < x0 + pw; x++) if (used[y0 + ph - 1][x]) clear = false;
        if (!clear) break;
        for (let y = y0; y < y0 + ph; y++) for (let x = x0; x < x0 + pw; x++) used[y][x] = true;
        pieces.push([x0, y0, pw, ph]);
        go();
        pieces.pop();
        for (let y = y0; y < y0 + ph; y++) for (let x = x0; x < x0 + pw; x++) used[y][x] = false;
      }
    }
  }
  go();
  return found;
}

/** 칸을 하나씩 세어 [회색 수, 흰 칸 수] */
export function bruteCount(board, [x0, y0, pw, ph]) {
  const grey = new Set(board.grey);
  let g = 0;
  let white = 0;
  for (let y = y0; y < y0 + ph; y++) {
    for (let x = x0; x < x0 + pw; x++) {
      if (grey.has(y * board.w + x)) g += 1;
      else white += 1;
    }
  }
  return [g, white];
}

/** 되는 자르기들의 이름(정렬). 조각마다 (조각의 회색) × (판의 흰 칸) = (조각의 흰 칸) × (판의 회색) */
export function bruteSolve(board) {
  const [G, W] = bruteCount(board, [0, 0, board.w, board.h]);
  return brutePartitions(board.w, board.h, board.parts)
    .filter((name) =>
      name.split(';').every((item) => {
        const [g, white] = bruteCount(board, item.split(',').map(Number));
        return g * W === white * G;
      }),
    )
    .sort();
}
