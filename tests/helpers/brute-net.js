// 그물 끊기를 풀이 프로그램(src/core/net.js)과 다른 방법으로 따진다. src/core를 불러오지 않는다.
// - 조각 세기: 남은 줄을 따라 매듭에서 매듭으로 번져 가며(깊이 먼저) 칠한다.
// - 가장 많이 끊을 수 있는 줄: 끊을 줄의 모든 묶음(2의 줄 수 제곱 가지)을 하나씩 끊어 보고, 조각 수가 처음과 같은 것 가운데 가장 큰 것.
// - 끊는 차례: 지금 모습에서 끊어도 조각 수가 그대로인 줄을 하나씩 끊어 보며 갈 수 있는 끝 모습을 모두 따라간다(같은 모습은 한 번만 본다).

/** 남은 줄(removed에 없는 줄)로 이어진 조각의 수 */
export function countPieces(board, removed = new Set()) {
  const n = board.knots.length;
  const near = Array.from({ length: n }, () => []);
  board.strings.forEach(([a, b], index) => {
    if (removed.has(index)) return;
    near[a].push(b);
    near[b].push(a);
  });
  const seen = Array(n).fill(false);
  let pieces = 0;
  for (let start = 0; start < n; start++) {
    if (seen[start]) continue;
    pieces += 1;
    const stack = [start];
    seen[start] = true;
    while (stack.length > 0) {
      const knot = stack.pop();
      for (const next of near[knot]) {
        if (!seen[next]) {
          seen[next] = true;
          stack.push(next);
        }
      }
    }
  }
  return pieces;
}

/** 끊을 줄의 모든 묶음을 끊어 보고, 조각 수가 처음과 같은 것 가운데 가장 많이 끊은 수(줄이 20개를 넘으면 쓰지 않는다) */
export function bruteMaxCut(board) {
  const m = board.strings.length;
  if (m > 20) throw new Error('줄이 너무 많아요');
  const start = countPieces(board);
  let best = 0;
  for (let mask = 0; mask < 1 << m; mask++) {
    let size = 0;
    for (let bit = mask; bit > 0; bit &= bit - 1) size += 1;
    if (size <= best) continue;
    const removed = new Set();
    for (let index = 0; index < m; index++) if (mask & (1 << index)) removed.add(index);
    if (countPieces(board, removed) === start) best = size;
  }
  return best;
}

/** 어떤 차례로 끊든, 더 끊을 줄이 없을 때까지 끊으면 끊은 줄의 수가 몇이 되는가(나올 수 있는 수 모두, 작은 것부터) */
export function endCounts(board) {
  const m = board.strings.length;
  if (m > 24) throw new Error('줄이 너무 많아요');
  const start = countPieces(board);
  const seen = new Set();
  const ends = new Set();
  const visit = (mask) => {
    if (seen.has(mask)) return;
    seen.add(mask);
    const removed = new Set();
    for (let index = 0; index < m; index++) if (mask & (1 << index)) removed.add(index);
    let more = false;
    for (let index = 0; index < m; index++) {
      if (removed.has(index)) continue;
      removed.add(index);
      if (countPieces(board, removed) === start) {
        more = true;
        visit(mask | (1 << index));
      }
      removed.delete(index);
    }
    if (!more) ends.add(removed.size);
  };
  visit(0);
  return [...ends].sort((a, b) => a - b);
}

/** 남은 줄에 고리가 있는가: 줄을 하나씩 빼 보아 조각 수가 그대로인 줄이 있으면 그 줄은 고리에 들어 있다 */
export function hasLoop(board, removed = new Set()) {
  const now = countPieces(board, removed);
  return board.strings.some((_, index) => {
    if (removed.has(index)) return false;
    const more = new Set(removed);
    more.add(index);
    return countPieces(board, more) === now;
  });
}
