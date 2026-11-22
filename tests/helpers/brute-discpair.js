// 원판 둘씩 옮기기를 풀이 프로그램과 다른 방법으로 따진다(테스트에서만 쓴다).
// 모습을 칸마다의 원판 수가 아니라 "원판마다 선 칸"을 작은 것부터 늘어놓은 줄로 들고, 원판 두 개(줄의 두 자리)를 골라 저마다 ±1칸 옮긴다.
// 모습은 글('0,0,3')로 견준다.

/** 칸마다의 원판 수 → 원판마다 선 칸(작은 칸부터) */
export function discsOf(piles) {
  return piles.flatMap((value, cell) => Array(value).fill(cell));
}

/** 원판마다 선 칸 → 칸마다의 원판 수 */
export function pilesOf(n, discs) {
  const piles = Array(n).fill(0);
  for (const cell of discs) piles[cell] += 1;
  return piles;
}

const keyOf = (discs) => discs.slice().sort((a, b) => a - b).join(',');
const together = (discs) => discs.every((cell) => cell === discs[0]);

/** 한 번 옮기기로 갈 수 있는 모습들(원판 두 개를 골라 저마다 왼쪽이나 오른쪽으로) */
export function movesOf(n, discs) {
  const out = [];
  for (let a = 0; a < discs.length; a++) {
    for (let b = a + 1; b < discs.length; b++) {
      for (const da of [1, n - 1]) {
        for (const db of [1, n - 1]) {
          const next = discs.slice();
          next[a] = (next[a] + da) % n;
          next[b] = (next[b] + db) % n;
          out.push(next.sort((x, y) => x - y));
        }
      }
    }
  }
  return out;
}

/** 칸 n개에 원판 total개를 놓는 모든 판(칸마다의 원판 수) */
export function allBoards(n, total) {
  const out = [];
  const piles = Array(n).fill(0);
  (function place(cell, left) {
    if (cell === n - 1) {
      piles[cell] = left;
      out.push(piles.slice());
      return;
    }
    for (let k = 0; k <= left; k++) {
      piles[cell] = k;
      place(cell + 1, left - k);
    }
  })(0, total);
  return out;
}

/**
 * 판에서 앞으로 너비 우선으로 퍼져 나가 모두 한 칸에 모이는 가장 적은 수. 모일 수 없으면 null.
 * limit 모습을 이만큼 넘게 보면 그만두고 undefined를 낸다(큰 판에서 테스트가 오래 걸리지 않게)
 */
export function bruteMin(n, piles, limit = Infinity) {
  const start = discsOf(piles);
  if (together(start)) return 0;
  const seen = new Set([keyOf(start)]);
  let layer = [start];
  for (let depth = 1; layer.length > 0; depth++) {
    const next = [];
    for (const discs of layer) {
      for (const to of movesOf(n, discs)) {
        if (together(to)) return depth;
        const key = keyOf(to);
        if (seen.has(key)) continue;
        seen.add(key);
        next.push(to);
      }
    }
    if (seen.size > limit) return undefined;
    layer = next;
  }
  return null;
}

/** 칸 n개, 원판 total개인 모든 모습의 가장 적은 수(모두 한 칸에 모인 모습들에서 거꾸로 퍼져 나간다). 모일 수 없는 모습은 없다 */
export function bruteTable(n, total) {
  const dist = new Map();
  let layer = [];
  for (let cell = 0; cell < n; cell++) {
    const discs = Array(total).fill(cell);
    dist.set(keyOf(discs), 0);
    layer.push(discs);
  }
  for (let depth = 1; layer.length > 0; depth++) {
    const next = [];
    for (const discs of layer) {
      for (const to of movesOf(n, discs)) {
        const key = keyOf(to);
        if (dist.has(key)) continue;
        dist.set(key, depth);
        next.push(to);
      }
    }
    layer = next;
  }
  return (piles) => dist.get(keyOf(discsOf(piles))) ?? null;
}

/**
 * 걸음들([나간 칸, 들어간 칸])을 원판마다 따라가 본다. 원판에 이름(차례)을 붙여 두고, 한 번(걸음 둘) 안에서 같은 원판을 두 번 옮기지 않는지,
 * 옆 칸으로만 가는지 본다. 끝난 모습(칸마다의 원판 수)을 내고, 규칙을 어기면 null.
 */
export function walk(n, piles, steps) {
  // 칸마다 원판 이름들의 더미
  const stacks = Array.from({ length: n }, () => []);
  let name = 0;
  piles.forEach((value, cell) => {
    for (let k = 0; k < value; k++) stacks[cell].push(name++);
  });
  let moved = new Set();
  for (let index = 0; index < steps.length; index++) {
    const [from, to] = steps[index];
    const ring = (from - to + n) % n;
    if (ring !== 1 && ring !== n - 1) return null;
    const free = stacks[from].filter((disc) => !moved.has(disc));
    if (free.length === 0) return null;
    const disc = free[0];
    stacks[from] = stacks[from].filter((item) => item !== disc);
    stacks[to].push(disc);
    moved.add(disc);
    if (index % 2 === 1) moved = new Set();
  }
  return stacks.map((stack) => stack.length);
}
