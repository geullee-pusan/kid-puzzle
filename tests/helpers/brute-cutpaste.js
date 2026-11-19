// 자르고 붙이기를 풀이 프로그램(src/core/cutpaste.js)과 다른 방법으로 다시 푼다(테스트 전용).
// - 채우기: 칸마다 번호를 매기고, 조각마다 돌린 모습 넷(x, y → −y, x를 네 번)을 모든 자리에 놓아 본 비트 묶음을 먼저 다 만든다.
//   그다음 가장 작은 번호의 빈칸을 덮는 놓기를 하나씩 골라 간다. 같은 모양의 조각을 바꿔 놓은 것은 놓인 칸의 묶음으로 하나로 센다.
// - 자르기: 판을 칸마다 조각 번호를 적은 표로 두고, 조각 하나와 선 하나를 골라 번호를 새로 매긴다(이어진 덩어리는 칸을 하나씩 퍼뜨려 찾는다).
// - 나누기: 막대마다 자르는 자리의 모든 묶음(2의 m(n−1)제곱 가지)을 하나씩 만들고, 조각을 사람에게 주는 모든 방법을 차례로 따진다.

const keyOf = (x, y) => `${x},${y}`;

/** 모양(칸들)을 돌린 모습 넷(같은 것도 그대로 넷) */
function turnsOf(cells) {
  const list = [];
  let now = cells.map(([x, y]) => [x, y]);
  for (let turn = 0; turn < 4; turn++) {
    const minX = Math.min(...now.map((cell) => cell[0]));
    const minY = Math.min(...now.map((cell) => cell[1]));
    list.push(now.map(([x, y]) => [x - minX, y - minY]));
    now = now.map(([x, y]) => [-y, x]);
  }
  return list;
}

/**
 * 칸들(region)을 모양들(shapes)로 빈틈없이 채우는 방법의 수(놓인 칸의 묶음이 같으면 하나). limit만큼 찾으면 그만 센다.
 * @returns {number}
 */
export function bruteFillCount(region, shapes, limit = Infinity) {
  const total = shapes.reduce((sum, cells) => sum + cells.length, 0);
  if (total !== region.length) return 0;
  const index = new Map(region.map(([x, y], at) => [keyOf(x, y), at]));
  const full = (1n << BigInt(region.length)) - 1n;
  // 조각마다 놓을 수 있는 모든 자리(비트 묶음)
  const placements = shapes.map((shape) => {
    const masks = new Set();
    for (const turned of turnsOf(shape)) {
      for (const [rx, ry] of region) {
        const [ax, ay] = turned[0];
        let mask = 0n;
        let ok = true;
        for (const [x, y] of turned) {
          const at = index.get(keyOf(x - ax + rx, y - ay + ry));
          if (at === undefined) {
            ok = false;
            break;
          }
          mask |= 1n << BigInt(at);
        }
        if (ok) masks.add(mask);
      }
    }
    return [...masks];
  });
  const found = new Set();
  const used = new Array(shapes.length).fill(false);
  const chosen = [];
  function go(filled) {
    if (found.size >= limit) return;
    if (filled === full) {
      found.add(chosen.slice().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).join('|'));
      return;
    }
    let low = 0n;
    while ((filled >> low) & 1n) low += 1n;
    const bit = 1n << low;
    for (let piece = 0; piece < shapes.length; piece++) {
      if (used[piece]) continue;
      for (const mask of placements[piece]) {
        if (!(mask & bit) || mask & filled) continue;
        used[piece] = true;
        chosen.push(mask);
        go(filled | mask);
        chosen.pop();
        used[piece] = false;
      }
    }
  }
  go(0n);
  return found.size;
}

/** 칸 번호 표로 조각들(칸들의 목록)을 꺼낸다 */
function piecesOf(labels) {
  const groups = new Map();
  for (const [name, label] of labels) {
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(name.split(',').map(Number));
  }
  return [...groups.values()];
}

/** 표에서 label 조각을 선으로 자르고 번호를 새로 매긴다. 선이 조각을 지나지 않으면 null */
function cutLabels(labels, label, d, at) {
  const cells = [...labels].filter(([, value]) => value === label).map(([name]) => name);
  const side = (name) => {
    const [x, y] = name.split(',').map(Number);
    return (d === 'v' ? x : y) < at;
  };
  if (cells.every(side) || !cells.some(side)) return null;
  const next = new Map(labels);
  let fresh = Math.max(...labels.values()) + 1;
  const left = new Set(cells);
  for (const start of cells) {
    if (!left.has(start)) continue;
    const mark = fresh++;
    const stack = [start];
    left.delete(start);
    while (stack.length > 0) {
      const now = stack.pop();
      next.set(now, mark);
      const [x, y] = now.split(',').map(Number);
      for (const other of [keyOf(x + 1, y), keyOf(x - 1, y), keyOf(x, y + 1), keyOf(x, y - 1)]) {
        if (left.has(other) && side(other) === side(now)) {
          left.delete(other);
          stack.push(other);
        }
      }
    }
  }
  // 번호를 0부터 다시 매긴다(같은 자르기를 하나로 보려고)
  const order = new Map();
  for (const name of [...next.keys()].sort()) if (!order.has(next.get(name))) order.set(next.get(name), order.size);
  return new Map([...next].map(([name, value]) => [name, order.get(value)]));
}

/**
 * 잘라 옮겨 네모를 다른 방법으로 푼다: 가장 적게 자른 수(cuts번까지 따져서 없으면 null)
 */
export function bruteMoveMin(board) {
  let level = [new Map(board.cells.map(([x, y]) => [keyOf(x, y), 0]))];
  const seen = new Set([JSON.stringify([...level[0]].sort())]);
  const area = board.cells.length;
  const sizes = [];
  for (let rw = 1; rw <= board.w; rw++) if (area % rw === 0 && area / rw <= board.h) sizes.push([rw, area / rw]);
  const makes = (labels) =>
    sizes.some(([rw, rh]) => {
      const rect = [];
      for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) rect.push([x, y]);
      return bruteFillCount(rect, piecesOf(labels), 1) > 0;
    });
  for (let step = 0; step <= board.cuts; step++) {
    if (level.some(makes)) return step;
    const next = [];
    for (const labels of level) {
      for (const label of new Set(labels.values())) {
        for (let at = 1; at < Math.max(board.w, board.h); at++) {
          for (const d of ['v', 'h']) {
            const made = cutLabels(labels, label, d, at);
            if (!made) continue;
            const name = JSON.stringify([...made].sort());
            if (seen.has(name)) continue;
            seen.add(name);
            next.push(made);
          }
        }
      }
    }
    level = next;
  }
  return null;
}

/** 나누기를 다른 방법으로 푼다: 가장 적은 조각 수(자르는 자리의 모든 묶음, 주는 모든 방법) */
export function bruteShareBest(m, n) {
  const spots = m * (n - 1);
  let best = Infinity;
  for (let mask = 0; mask < 1 << spots; mask++) {
    const lengths = [];
    for (let bar = 0; bar < m; bar++) {
      let last = 0;
      for (let at = 1; at < n; at++) {
        if (mask & (1 << (bar * (n - 1) + at - 1))) {
          lengths.push(at - last);
          last = at;
        }
      }
      lengths.push(n - last);
    }
    if (lengths.length >= best) continue;
    const sums = new Array(n).fill(0);
    const give = (at) => {
      if (at === lengths.length) return sums.every((sum) => sum === m);
      for (let who = 0; who < n; who++) {
        if (sums[who] + lengths[at] > m) continue;
        sums[who] += lengths[at];
        const ok = give(at + 1);
        sums[who] -= lengths[at];
        if (ok) return true;
      }
      return false;
    };
    if (give(0)) best = lengths.length;
  }
  return best;
}
