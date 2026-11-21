// 탑 옮기기의 풀이를 다른 방법으로 다시 구한다(테스트 전용).
// 풀이 프로그램(src/core/tower.js)은 원판마다 기둥을 적은 모습에 번호를 붙여, 다 된 모습에서 거꾸로 너비 우선 탐색을 한 번 하여 표를 만든다.
// 여기서는 모습을 "기둥마다 아래에서 위로 쌓인 원판의 줄" 세 개로 들고, 처음 모습에서 앞으로 너비 우선 탐색을 한다.
// 옮길 수 있는지도 여기서 따로 따진다(맨 위 원판끼리 크기를 견준다). 가장 짧은 길이 몇 가닥인지도 센다.

const keyOf = (stacks) => stacks.map((stack) => stack.join(',')).join('|');

/** 원판마다 기둥(크기 1부터) → 기둥마다 아래에서 위로 쌓인 원판 */
export function stacksFrom(pos) {
  const stacks = [[], [], []];
  const order = pos.map((peg, index) => ({ peg, size: index + 1 })).sort((a, b) => b.size - a.size);
  for (const { peg, size } of order) stacks[peg].push(size);
  return stacks;
}

/** 한 모습에서 할 수 있는 옮기기와 그 뒤의 모습 */
function nextOf(stacks) {
  const list = [];
  for (let from = 0; from < 3; from++) {
    if (stacks[from].length === 0) continue;
    const disc = stacks[from].at(-1);
    for (let to = 0; to < 3; to++) {
      if (to === from) continue;
      const top = stacks[to].at(-1);
      if (top !== undefined && top < disc) continue;
      const next = stacks.map((stack) => stack.slice());
      next[from].pop();
      next[to].push(disc);
      list.push({ move: [from, to], disc, next });
    }
  }
  return list;
}

/**
 * 처음 모습에서 target 기둥에 다 쌓기까지: 가장 적은 횟수, 그런 길의 가닥 수, 한 가닥의 길과 그 길에서 옮긴 원판.
 * @param {number[]} pos 원판마다 기둥
 * @param {number} target
 */
export function bruteSolve(pos, target) {
  const n = pos.length;
  const start = stacksFrom(pos);
  const goal = keyOf([0, 1, 2].map((peg) => (peg === target ? Array.from({ length: n }, (_, index) => n - index) : [])));
  const depth = new Map([[keyOf(start), 0]]);
  const ways = new Map([[keyOf(start), 1]]);
  const back = new Map();
  let layer = [start];
  while (layer.length > 0 && !depth.has(goal)) {
    const next = [];
    for (const stacks of layer) {
      const key = keyOf(stacks);
      for (const { move, disc, next: after } of nextOf(stacks)) {
        const other = keyOf(after);
        if (!depth.has(other)) {
          depth.set(other, depth.get(key) + 1);
          ways.set(other, 0);
          back.set(other, { key, move, disc });
          next.push(after);
        }
        if (depth.get(other) === depth.get(key) + 1) ways.set(other, ways.get(other) + ways.get(key));
      }
    }
    layer = next;
  }
  const path = [];
  const discs = [];
  for (let key = goal; back.has(key); key = back.get(key).key) {
    path.unshift(back.get(key).move);
    discs.unshift(back.get(key).disc);
  }
  return { fewest: depth.get(goal), ways: ways.get(goal), path, discs };
}

/** 원판 n개의 모든 모습(원판마다 기둥) */
export function allPositions(n) {
  const list = [];
  for (let code = 0; code < 3 ** n; code++) {
    const pos = [];
    let rest = code;
    for (let index = 0; index < n; index++) {
      pos.push(rest % 3);
      rest = Math.floor(rest / 3);
    }
    list.push(pos);
  }
  return list;
}

/** 옮기기를 차례대로 해 본 모습(기둥마다의 줄). 옮길 수 없는 것이 있으면 null */
export function bruteReplay(pos, moves) {
  let stacks = stacksFrom(pos);
  for (const [from, to] of moves) {
    const found = nextOf(stacks).find((item) => item.move[0] === from && item.move[1] === to);
    if (!found) return null;
    stacks = found.next;
  }
  return stacks;
}
