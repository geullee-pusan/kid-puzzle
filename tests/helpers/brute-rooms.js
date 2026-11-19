// 방 한 번씩 돌기를 풀이 프로그램과 다른 방법으로 다시 푼다(테스트 전용).
// 가지치기 없이, 처음 방에서 갈 수 있는 모든 길(같은 방을 두 번 지나지 않는 길)을 하나씩 걸어 본다.
// 모든 방을 지난 길이 어느 방에서 끝났는지 세어 둔다. 색이나 생김새는 따지지 않는다.

/** 칸 번호 → 문으로 이어진 이웃 방들(가로 w, 세로 h, 정원 walls) */
function doorTable(w, h, walls) {
  const wall = new Set(walls);
  const table = [];
  for (let cell = 0; cell < w * h; cell++) {
    const x = cell % w;
    const y = (cell - x) / w;
    const list = [];
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const other = ny * w + nx;
      if (!wall.has(other)) list.push(other);
    }
    table.push(wall.has(cell) ? [] : list);
  }
  return table;
}

/**
 * 처음 방 start에서 모든 방을 지나는 길을 모두 걸어 본다.
 * @returns {Map<number, number>} 끝난 방 → 그 방에서 끝나는 길의 수
 */
export function bruteEnds(w, h, walls, start) {
  const doors = doorTable(w, h, walls);
  const rooms = w * h - new Set(walls).size;
  const visited = new Array(w * h).fill(false);
  const ends = new Map();
  const walk = (at, length) => {
    if (length === rooms) {
      ends.set(at, (ends.get(at) ?? 0) + 1);
      return;
    }
    for (const next of doors[at]) {
      if (visited[next]) continue;
      visited[next] = true;
      walk(next, length + 1);
      visited[next] = false;
    }
  };
  visited[start] = true;
  walk(start, 1);
  return ends;
}

/** 처음 방에서 끝 방까지, 적힌 차례(numbers: [[칸, 차례]])를 지키며 모든 방을 지나는 길을 모두 모은다(cap개까지) */
export function brutePaths(board, cap = Infinity) {
  const { w, h, walls, start, end } = board;
  const doors = doorTable(w, h, walls);
  const rooms = w * h - new Set(walls).size;
  const want = new Map((board.numbers ?? []).map(([cell, order]) => [cell, order]));
  const visited = new Array(w * h).fill(false);
  const found = [];
  const path = [start];
  const okAt = (cell, order) => !want.has(cell) || want.get(cell) === order;
  const walk = (at) => {
    if (found.length >= cap) return;
    if (path.length === rooms) {
      if (at === end) found.push(path.slice());
      return;
    }
    for (const next of doors[at]) {
      if (visited[next] || !okAt(next, path.length + 1)) continue;
      visited[next] = true;
      path.push(next);
      walk(next);
      path.pop();
      visited[next] = false;
    }
  };
  if (okAt(start, 1)) {
    visited[start] = true;
    walk(start);
  }
  return found;
}

/** 아이가 그은 길처럼 하나하나 따져 본다: 처음 방에서 시작해 이웃한 방으로만, 모든 방을 한 번씩, 끝 방에서 끝, 적힌 차례대로 */
export function bruteValid(board, path) {
  const { w, h, walls, start, end } = board;
  const doors = doorTable(w, h, walls);
  const rooms = w * h - new Set(walls).size;
  if (path.length !== rooms || path[0] !== start || path[path.length - 1] !== end) return false;
  if (new Set(path).size !== rooms) return false;
  for (let at = 1; at < path.length; at++) if (!doors[path[at - 1]].includes(path[at])) return false;
  return (board.numbers ?? []).every(([cell, order]) => path[order - 1] === cell);
}
