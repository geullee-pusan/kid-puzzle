// 접히는 모양 가리기를 다른 방법으로 다시 푼다(테스트 전용).
// - 접기: 칸마다 회전 행렬을 곱해 가며(깊이 우선) 접은 면이 바깥으로 보는 방향(법선)을 구한다. 정육면체를 굴리는 대신 3차원 벡터로 따진다
// - 펼치기: 정육면체의 면 여섯과 맞닿는 관계에서 펼침 나무(면 다섯 쌍을 고르는 모든 방법)를 모두 만들고, 나무마다 평면에 펼친다
// - 모양 세기: 정해진 모눈 안에서 칸을 하나씩 붙여 가며 이어진 칸 묶음을 모두 만든다(옮긴 것, 돌린 것, 뒤집은 것은 따로 이름을 매겨 하나로)
// - 주사위: 면마다 3차원 방향을 두고, 다른 주사위나 바닥 쪽을 보는 면을 안 보이는 면으로 센다

const key = ([x, y]) => `${x},${y}`;

// ---- 벡터와 행렬 ----
const mul = (a, b) => a.map((row) => [0, 1, 2].map((col) => row[0] * b[0][col] + row[1] * b[1][col] + row[2] * b[2][col]));
const apply = (m, v) => m.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);
const I3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];
// 화면 좌표(x 오른쪽, y 아래, z 앞)에서 y축과 x축으로 90도, −90도 돌리기
const rotY = (s) => [
  [0, 0, s],
  [0, 1, 0],
  [-s, 0, 0],
];
const rotX = (s) => [
  [1, 0, 0],
  [0, 0, -s],
  [0, s, 0],
];
/** 이웃한 칸으로 넘어갈 때 경첩이 접히는 회전(칸이 화면 안쪽으로 접힌다) */
const HINGE = { '1,0': rotY(1), '-1,0': rotY(-1), '0,-1': rotX(1), '0,1': rotX(-1) };

/**
 * 칸들을 접어 칸마다 바깥 법선을 구한다(첫 칸에서 깊이 우선. 이어지지 않았으면 null).
 * 같은 법선을 갖는 칸들이 접으면 겹치는 칸이다.
 */
export function normals3d(cells) {
  const at = new Map(cells.map((cell, index) => [key(cell), index]));
  const frames = Array(cells.length).fill(null);
  frames[0] = I3;
  const stack = [0];
  while (stack.length > 0) {
    const index = stack.pop();
    const [x, y] = cells[index];
    for (const step of Object.keys(HINGE)) {
      const [dx, dy] = step.split(',').map(Number);
      const next = at.get(key([x + dx, y + dy]));
      if (next === undefined || frames[next]) continue;
      frames[next] = mul(frames[index], HINGE[step]);
      stack.push(next);
    }
  }
  if (frames.some((frame) => frame === null)) return null;
  return frames.map((frame) => apply(frame, [0, 0, 1]).join(','));
}

/** 접으면 겹치는 칸 묶음(둘 이상, 차례대로 늘어놓음) */
export function clashGroups3d(cells) {
  const normals = normals3d(cells);
  const groups = new Map();
  normals.forEach((normal, index) => groups.set(normal, [...(groups.get(normal) ?? []), index]));
  return [...groups.values()].filter((group) => group.length > 1).sort((a, b) => a[0] - b[0]);
}

export const isNet3d = (cells) => cells.length === 6 && new Set(normals3d(cells)).size === 6;
export const isBox3d = (cells) => cells.length === 5 && new Set(normals3d(cells)).size === 5;
/** 칸 index의 맞은편 칸(법선이 거꾸로인 칸) */
export function opposite3d(cells, index) {
  const normals = normals3d(cells).map((text) => text.split(',').map(Number));
  const want = normals[index].map((value) => -value).join(',');
  return normals.findIndex((normal) => normal.join(',') === want);
}

// ---- 이름(돌리고 뒤집어 같은 모양은 같은 이름) ----
function shift(cells) {
  const minX = Math.min(...cells.map((cell) => cell[0]));
  const minY = Math.min(...cells.map((cell) => cell[1]));
  return cells
    .map(([x, y]) => `${x - minX}:${y - minY}`)
    .sort()
    .join('|');
}
/** 여덟 모습(돌리기 넷과 뒤집어 돌리기 넷)의 이름 가운데 가장 앞선 것 */
export function freeName(cells) {
  const names = [];
  let shape = cells.map(([x, y]) => [x, y]);
  for (let turn = 0; turn < 4; turn++) {
    names.push(shift(shape), shift(shape.map(([x, y]) => [-x, y])));
    shape = shape.map(([x, y]) => [y, -x]);
  }
  return names.sort()[0];
}

// ---- 모양 세기 ----
/** w×h 모눈 안에서 이어진 n칸 묶음을 모두 만든다(칸을 하나씩 붙여 간다). 묶음마다 칸 목록 */
export function gridShapes(w, h, n, fixed = []) {
  let level = new Map();
  const seeds = fixed.length > 0 ? [fixed.map((cell) => cell.slice())] : Array.from({ length: w * h }, (_, index) => [[index % w, Math.floor(index / w)]]);
  for (const cells of seeds) level.set(cells.map(key).sort().join('|'), cells);
  for (let size = level.values().next().value.length; size < n; size++) {
    const next = new Map();
    for (const cells of level.values()) {
      const have = new Set(cells.map(key));
      for (const [x, y] of cells) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const cell = [x + dx, y + dy];
          if (cell[0] < 0 || cell[1] < 0 || cell[0] >= w || cell[1] >= h || have.has(key(cell))) continue;
          const grown = [...cells, cell];
          const name = grown.map(key).sort().join('|');
          if (!next.has(name)) next.set(name, grown);
        }
      }
    }
    level = next;
  }
  return [...level.values()];
}

/** n칸 모양의 이름 모두(돌리고 뒤집어 같은 것은 하나): n×n 모눈 안의 모든 묶음에서 */
export function freeShapes(n) {
  const names = new Map();
  for (const cells of gridShapes(n, n, n)) {
    const name = freeName(cells);
    if (!names.has(name)) names.set(name, cells);
  }
  return names;
}

// ---- 펼치기 ----
const FACES = ['0,0,1', '0,0,-1', '1,0,0', '-1,0,0', '0,1,0', '0,-1,0'].map((text) => text.split(',').map(Number));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const neg = (v) => v.map((value) => -value);
const same = (a, b) => a.every((value, index) => value === b[index]);

/** 정육면체의 맞닿는 면 쌍(열둘) 가운데 다섯을 골라 나무가 되는 것마다 평면에 펼친다. 펼친 모양의 이름들 */
export function unfoldedNames() {
  const edges = [];
  for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) if (dot(FACES[a], FACES[b]) === 0) edges.push([a, b]);
  const names = new Set();
  let trees = 0;
  let overlaps = 0;
  for (let mask = 0; mask < 1 << edges.length; mask++) {
    const chosen = edges.filter((_, index) => mask & (1 << index));
    if (chosen.length !== 5) continue;
    // 나무인가: 면 0에서 모두 닿는다
    const seen = new Set([0]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const [a, b] of chosen) {
        if (seen.has(a) !== seen.has(b)) {
          seen.add(a);
          seen.add(b);
          grew = true;
        }
      }
    }
    if (seen.size !== 6) continue;
    trees += 1;
    // 면 0을 (0, 0)에 두고, 오른쪽(+x)과 아래쪽(+y)이 3차원에서 어느 방향인지 들고 다닌다
    const place = new Map([[0, { cell: [0, 0], right: [1, 0, 0], down: [0, 1, 0], normal: FACES[0] }]]);
    const queue = [0];
    while (queue.length > 0) {
      const face = queue.shift();
      const here = place.get(face);
      for (const [a, b] of chosen) {
        const other = a === face ? b : b === face ? a : -1;
        if (other < 0 || place.has(other)) continue;
        const m = FACES[other];
        let next;
        if (same(m, here.right)) next = { cell: [here.cell[0] + 1, here.cell[1]], right: neg(here.normal), down: here.down };
        else if (same(m, neg(here.right))) next = { cell: [here.cell[0] - 1, here.cell[1]], right: here.normal, down: here.down };
        else if (same(m, here.down)) next = { cell: [here.cell[0], here.cell[1] + 1], right: here.right, down: neg(here.normal) };
        else next = { cell: [here.cell[0], here.cell[1] - 1], right: here.right, down: here.normal };
        next.normal = m;
        place.set(other, next);
        queue.push(other);
      }
    }
    const cells = [...place.values()].map((item) => item.cell);
    if (new Set(cells.map(key)).size !== 6) {
      overlaps += 1;
      continue;
    }
    names.add(freeName(cells));
  }
  return { names, trees, overlaps };
}

// ---- 주사위 ----
/** 주사위 한 개: 자리(바닥, 위, 뒤, 앞, 오른쪽, 왼쪽)마다의 3차원 방향 */
const DIE_DIRS = [
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, -1],
  [0, 0, 1],
  [1, 0, 0],
  [-1, 0, 0],
];

/** 쌓은 주사위(아래부터)에서 안 보이는 면의 눈의 합: 아래쪽을 보는 면(바닥이나 아래 주사위), 위에 주사위가 있는데 위쪽을 보는 면 */
export function hiddenSum3d(dice) {
  let sum = 0;
  let count = 0;
  dice.forEach((die, level) => {
    die.forEach((value, face) => {
      const [, dy] = DIE_DIRS[face];
      const touching = dy === 1 || (dy === -1 && level < dice.length - 1);
      if (touching) {
        sum += value;
        count += 1;
      }
    });
  });
  return { sum, count };
}

/** 주사위가 맞는가: 1부터 6이 한 번씩, 마주 보는 두 면의 합이 7, 1·2·3이 처음 모습과 같은 돌림 방향으로 놓였다 */
export function dieOk(die) {
  if ([...die].sort().join() !== '1,2,3,4,5,6') return false;
  for (const [a, b] of [[0, 1], [2, 3], [4, 5]]) if (die[a] + die[b] !== 7) return false;
  const dir = (value) => DIE_DIRS[die.indexOf(value)];
  const [a, b, c] = [dir(1), dir(2), dir(3)];
  const cross = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  return dot(cross, c);
}
