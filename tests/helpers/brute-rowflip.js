// 줄 뒤집기 판을 풀이 프로그램과 다른 방법으로 따진다(테스트 전용).
// 판을 줄마다의 글('#' 검은 칸, '.' 흰 칸)로 들고, 줄을 하나씩 실제로 뒤집어 본다.
//   bruteLines: 뒤집을 줄의 모든 묶음(2의 (가로 + 세로)제곱 가지)을 하나씩 해 보고, 모두 흰 칸이 되는 묶음의 수와 가장 적은 줄 수를 센다
//   bruteBfs:   판의 모습을 하나씩 넓혀 가며(너비 우선) 모두 흰 칸까지 가장 적은 뒤집기 수를 찾는다. 작은 판에만 쓴다
//   oddRects:   모든 직사각형의 네 모서리를 하나씩 세어 검은 칸이 홀수 개인 것을 모은다

/** 판(칸 번호 차례의 0과 1) → 줄마다의 글 */
export function toRows(w, h, cells) {
  const rows = [];
  for (let r = 0; r < h; r++) rows.push(cells.slice(r * w, r * w + w).map((value) => (value ? '#' : '.')).join(''));
  return rows;
}

const flipChar = (ch) => (ch === '#' ? '.' : '#');

/** 줄 하나를 뒤집은 글들. line은 ['r', 번호] 또는 ['c', 번호] */
function flipRows(rows, [kind, at]) {
  if (kind === 'r') return rows.map((row, r) => (r === at ? [...row].map(flipChar).join('') : row));
  return rows.map((row) => [...row].map((ch, c) => (c === at ? flipChar(ch) : ch)).join(''));
}

const allWhite = (rows) => rows.every((row) => !row.includes('#'));

function linesOf(w, h) {
  return [...Array.from({ length: h }, (_, r) => ['r', r]), ...Array.from({ length: w }, (_, c) => ['c', c])];
}

/** 모든 줄 묶음을 해 본다 */
export function bruteLines(w, h, cells) {
  const lines = linesOf(w, h);
  let ways = 0;
  let min = null;
  for (let mask = 0; mask < 1 << lines.length; mask++) {
    let rows = toRows(w, h, cells);
    let used = 0;
    lines.forEach((line, index) => {
      if (mask & (1 << index)) {
        rows = flipRows(rows, line);
        used += 1;
      }
    });
    if (!allWhite(rows)) continue;
    ways += 1;
    if (min === null || used < min) min = used;
  }
  return { possible: ways > 0, ways, min };
}

/** 너비 우선으로 모두 흰 칸까지의 가장 적은 뒤집기 수(안 되면 null) */
export function bruteBfs(w, h, cells) {
  const start = toRows(w, h, cells);
  const key = (rows) => rows.join('/');
  const seen = new Set([key(start)]);
  let layer = [start];
  for (let depth = 0; layer.length > 0; depth++) {
    const next = [];
    for (const rows of layer) {
      if (allWhite(rows)) return depth;
      for (const line of linesOf(w, h)) {
        const after = flipRows(rows, line);
        if (seen.has(key(after))) continue;
        seen.add(key(after));
        next.push(after);
      }
    }
    layer = next;
  }
  return null;
}

/** 검은 칸이 홀수 개인 네 모서리들 { r1, c1, r2, c2 } */
export function oddRects(w, h, cells) {
  const rows = toRows(w, h, cells);
  const found = [];
  for (let r1 = 0; r1 < h; r1++) {
    for (let r2 = r1 + 1; r2 < h; r2++) {
      for (let c1 = 0; c1 < w; c1++) {
        for (let c2 = c1 + 1; c2 < w; c2++) {
          const black = [rows[r1][c1], rows[r1][c2], rows[r2][c1], rows[r2][c2]].filter((ch) => ch === '#').length;
          if (black % 2 === 1) found.push({ r1, c1, r2, c2 });
        }
      }
    }
  }
  return found;
}

/** 모든 판(크기마다 2의 칸 수 제곱 가지)을 차례로 */
export function* allBoards(w, h) {
  for (let mask = 0; mask < 1 << (w * h); mask++) yield Array.from({ length: w * h }, (_, cell) => (mask >> cell) & 1);
}
