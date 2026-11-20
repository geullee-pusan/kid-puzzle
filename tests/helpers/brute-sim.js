// 세모 피하기를 다른 방법으로 다시 따진다. 풀이 프로그램(src/core/sim.js)을 쓰지 않는다.
// 판을 점 n개의 표(colors[a][b] = 0 없음, 1 빨강, 2 파랑, -1 없는 선)로 적고, 세모는 세 점을 모두 훑어 찾는다.

/** 점 a < b의 선 번호(풀이 프로그램과 같은 차례: (0,1), (0,2), …) */
export function linePairs(n) {
  const pairs = [];
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) pairs.push([a, b]);
  return pairs;
}

/** 판(src/core/sim.js의 꼴)을 표로 */
export function tableFrom(board) {
  const pairs = linePairs(board.n);
  const colors = Array.from({ length: board.n }, () => Array(board.n).fill(0));
  const put = (line, value) => {
    const [a, b] = pairs[line];
    colors[a][b] = value;
    colors[b][a] = value;
  };
  for (const line of board.red) put(line, 1);
  for (const line of board.blue) put(line, 2);
  for (const line of board.gone) put(line, -1);
  return colors;
}

/** 표에 그 색(1, 2)의 세모가 있는가 */
export function hasTriangle(colors, color) {
  const n = colors.length;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) {
    if (colors[a][b] === color && colors[a][c] === color && colors[b][c] === color) return true;
  }
  return false;
}

/** 한 색 세모의 수(두 색 모두) */
export function triangleCount(colors) {
  const n = colors.length;
  let count = 0;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) {
    const x = colors[a][b];
    if (x > 0 && x === colors[a][c] && x === colors[b][c]) count += 1;
  }
  return count;
}

const keyOf = (colors) => colors.map((row) => row.join('')).join('/');

/**
 * 게임: 둘 차례인 쪽(mover 1 빨강, 2 파랑)이 잘 두면 1 이긴다, 0 비긴다, -1 진다.
 * 그은 선으로 자기 세모를 만들면 그 자리에서 진다. 모든 선을 그으면 비긴다.
 * memo가 있으면 표와 차례를 글자로 적어 둔다(풀이 프로그램과 다른 이름 짓기).
 */
export function bruteValue(colors, mover, memo = null) {
  const n = colors.length;
  const key = memo ? `${keyOf(colors)}:${mover}` : null;
  if (memo && memo.has(key)) return memo.get(key);
  let best = null;
  // 이기는 수를 찾으면 더 보지 않는다(어느 수로 이기든 이긴다).
  for (let a = 0; a < n && best !== 1; a++) {
    for (let b = a + 1; b < n && best !== 1; b++) {
      if (colors[a][b] !== 0) continue;
      colors[a][b] = mover;
      colors[b][a] = mover;
      let value;
      if (hasTriangle(colors, mover)) value = -1;
      else value = -bruteValue(colors, 3 - mover, memo);
      colors[a][b] = 0;
      colors[b][a] = 0;
      if (best === null || value > best) best = value;
    }
  }
  const result = best === null ? 0 : best;
  if (memo) memo.set(key, result);
  return result;
}

/** 게임의 끝: 둘 다 잘 두면 'red' | 'blue' | 'draw'. mover는 'red' | 'blue' */
export function bruteOutcome(board, mover, memo = null) {
  const colors = tableFrom(board);
  const who = mover === 'red' ? 1 : 2;
  const value = bruteValue(colors, who, memo);
  return value === 0 ? 'draw' : (value === 1) === (mover === 'red') ? 'red' : 'blue';
}

/** 칠하기: 칠하지 않은 선을 모두 두 색으로 칠해 보아 한 색 세모가 없는 칠하기의 수를 센다(가지치기 없이) */
export function brutePaintCount(board) {
  const colors = tableFrom(board);
  const n = board.n;
  const free = linePairs(n).filter(([a, b]) => colors[a][b] === 0);
  let count = 0;
  for (let mask = 0; mask < 1 << free.length; mask++) {
    free.forEach(([a, b], index) => {
      const value = (mask >> index) & 1 ? 1 : 2;
      colors[a][b] = value;
      colors[b][a] = value;
    });
    if (!hasTriangle(colors, 1) && !hasTriangle(colors, 2)) count += 1;
  }
  return count;
}
