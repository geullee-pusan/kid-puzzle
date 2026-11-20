// 테스트에서 마법 네모와 겹친 칸의 풀이 프로그램과 견줄 때 쓰는 다른 방법.
// 되짚어 가지 않고 카드를 놓는 모든 차례(3×3이면 9! = 362880가지)를 하나씩 다 놓아 보고, 줄의 합을 칸 번호로 바로 더해 센다.
// 풀이 프로그램의 줄 목록(linesOf)도, 놓는 차례도, 가지치기도 쓰지 않는다.

/** 카드의 모든 차례를 하나씩 건넨다(Heap의 방법). 건네는 배열은 다음 차례에서 바뀐다 */
export function eachOrder(cards, visit) {
  const list = cards.slice();
  const n = list.length;
  const c = Array(n).fill(0);
  visit(list);
  let i = 0;
  while (i < n) {
    if (c[i] < i) {
      const j = i % 2 === 0 ? 0 : c[i];
      [list[j], list[i]] = [list[i], list[j]];
      visit(list);
      c[i] += 1;
      i = 0;
    } else {
      c[i] = 0;
      i += 1;
    }
  }
}

const bump = (map, key, center) => {
  if (!map.has(key)) map.set(key, { count: 0, centers: new Set() });
  const entry = map.get(key);
  entry.count += 1;
  if (center !== null) entry.centers.add(center);
};

/** Map → [{ sum, count, centers }] (작은 합부터) */
const listOf = (map) =>
  [...map]
    .map(([sum, entry]) => ({ sum, count: entry.count, centers: [...entry.centers].sort((a, b) => a - b) }))
    .sort((a, b) => a.sum - b.sum);

/**
 * 3×3 판의 아홉 장을 모든 차례로 놓아 보고, 줄 모음마다 합이 모두 같은 놓는 방법을 센다.
 * 칸 번호: 0 1 2 / 3 4 5 / 6 7 8
 * @returns {{rows, rowscols, all, center}} 줄 모음마다 [{ sum, count, centers }]
 */
export function bruteSquare(cards) {
  const found = { rows: new Map(), rowscols: new Map(), all: new Map(), center: new Map() };
  eachOrder(cards, (p) => {
    const r0 = p[0] + p[1] + p[2];
    const r1 = p[3] + p[4] + p[5];
    const r2 = p[6] + p[7] + p[8];
    if (r0 === r1 && r1 === r2) {
      bump(found.rows, r0, p[4]);
      const c0 = p[0] + p[3] + p[6];
      const c1 = p[1] + p[4] + p[7];
      const c2 = p[2] + p[5] + p[8];
      if (c0 === r0 && c1 === r0 && c2 === r0) {
        bump(found.rowscols, r0, p[4]);
        if (p[0] + p[4] + p[8] === r0 && p[2] + p[4] + p[6] === r0) bump(found.all, r0, p[4]);
      }
    }
    // 가운데 칸을 지나는 네 줄: 가운데 가로, 가운데 세로, 두 비스듬한 줄
    const m = p[3] + p[4] + p[5];
    if (p[1] + p[4] + p[7] === m && p[0] + p[4] + p[8] === m && p[2] + p[4] + p[6] === m) bump(found.center, m, p[4]);
  });
  return { rows: listOf(found.rows), rowscols: listOf(found.rowscols), all: listOf(found.all), center: listOf(found.center) };
}

/** w×h 판(가로 줄만)의 놓는 방법. 칸 번호는 y * w + x */
export function bruteRows(cards, w, h) {
  const found = new Map();
  eachOrder(cards, (p) => {
    const sums = Array.from({ length: h }, (_, y) => p.slice(y * w, y * w + w).reduce((a, b) => a + b, 0));
    if (sums.every((value) => value === sums[0])) bump(found, sums[0], null);
  });
  return listOf(found);
}

/**
 * 겹친 칸 판(가운데 칸 0, 줄 i는 칸 1 + 2i, 0, 2 + 2i)의 카드를 모든 차례로 놓아 보고, 줄의 합이 모두 같은 놓는 방법을 합마다 센다.
 * @returns {{sum, count, centers}[]}
 */
export function bruteHub(arms, cards) {
  const found = new Map();
  eachOrder(cards, (p) => {
    const first = p[1] + p[0] + p[2];
    for (let at = 1; at < arms; at++) if (p[1 + 2 * at] + p[0] + p[2 + 2 * at] !== first) return;
    bump(found, first, p[0]);
  });
  return listOf(found);
}

/** n개 가운데 k개를 고르는 모든 묶음(작은 수부터) */
export function choose(list, k) {
  if (k === 0) return [[]];
  if (list.length < k) return [];
  const [head, ...rest] = list;
  return [...choose(rest, k - 1).map((tail) => [head, ...tail]), ...choose(rest, k)];
}
