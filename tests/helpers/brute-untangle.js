// 엉킨 그림 풀기를 다른 방법으로 다시 따지는 도우미(테스트에서만 쓴다). src/core/untangle.js의 함수를 쓰지 않는다.
// - 겹침: 두 선분이 만나는 자리를 분수(BigInt)로 풀어서 가린다(돌아가는 쪽의 부호로 가리는 풀이 프로그램과 다른 방법).
// - 뼈대 확인: 받은 선들이 정말 "점 다섯을 모두 잇는 그림"이나 "집 셋과 우물 셋"을 늘인 꼴인지, 갈림점에서 길을 따라가 본다.
// - 작은 그림의 풀 수 있는지: 갈림점을 고르고 서로 겹치지 않는 길을 모두 찾아 보는 탐색으로 그 두 꼴이 숨어 있는지 본다.

const big = (value) => BigInt(value);

/** 두 선분 p1p2, p3p4가 만나는 모습: 'none' | 'cross'(두 선분의 안쪽 한 점) | 'other'(끝이 닿거나 한 줄로 포개짐) */
export function meetBrute(p1, p2, p3, p4) {
  const [x1, y1, x2, y2, x3, y3, x4, y4] = [...p1, ...p2, ...p3, ...p4].map(big);
  // p1 + t(p2 − p1) = p3 + u(p4 − p3)
  const ax = x2 - x1;
  const ay = y2 - y1;
  const bx = x4 - x3;
  const by = y4 - y3;
  const denom = ax * by - ay * bx;
  const cx = x3 - x1;
  const cy = y3 - y1;
  if (denom === 0n) {
    // 나란하다: 한 줄 위에 있고 겹치는 부분이 있는가
    if (cx * ay - cy * ax !== 0n) return 'none';
    const along = (x, y) => (x - x1) * ax + (y - y1) * ay; // p1에서 잰 자리(길이의 제곱 단위)
    const length = ax * ax + ay * ay;
    const s3 = along(x3, y3);
    const s4 = along(x4, y4);
    const low = s3 < s4 ? s3 : s4;
    const high = s3 < s4 ? s4 : s3;
    return high < 0n || low > length ? 'none' : 'other';
  }
  const tNum = cx * by - cy * bx;
  const uNum = cx * ay - cy * ax;
  // t = tNum / denom, u = uNum / denom 가 [0, 1] 안인가
  const sign = denom > 0n ? 1n : -1n;
  const t = tNum * sign;
  const u = uNum * sign;
  const d = denom * sign;
  if (t < 0n || t > d || u < 0n || u > d) return 'none';
  if (t === 0n || t === d || u === 0n || u === d) return 'other';
  return 'cross';
}

/** 점 p가 선분 ab의 안쪽(끝은 빼고)에 있는가: p = a + t(b − a), 0 < t < 1 인 t가 있는가 */
export function onSegmentBrute(p, a, b) {
  const [px, py, ax, ay, bx, by] = [...p, ...a, ...b].map(big);
  const dx = bx - ax;
  const dy = by - ay;
  if ((px - ax) * dy !== (py - ay) * dx) return false;
  // 한 줄 위. t를 x나 y 가운데 0이 아닌 쪽으로 잰다
  const [num, den] = dx !== 0n ? [px - ax, dx] : [py - ay, dy];
  if (den === 0n) return false;
  const s = den > 0n ? 1n : -1n;
  return num * s > 0n && num * s < den * s;
}

/** 겹친 곳을 다시 센다: 끝을 같이 쓰지 않는 두 선이 안쪽에서 엇갈린 곳, 점이 다른 선의 안쪽에 놓인 곳 */
export function problemsBrute(points, edges, off = []) {
  let crossings = 0;
  let touches = 0;
  const live = edges.filter((_, index) => !off.includes(index));
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const [a, b] = live[i];
      const [c, d] = live[j];
      if (new Set([a, b, c, d]).size < 4) continue;
      if (meetBrute(points[a], points[b], points[c], points[d]) === 'cross') crossings += 1;
    }
  }
  points.forEach((point, v) => {
    for (const [a, b] of live) if (v !== a && v !== b && onSegmentBrute(point, points[a], points[b])) touches += 1;
  });
  return { crossings, touches, count: crossings + touches };
}

/**
 * 선들이 두 꼴 가운데 하나를 늘인 것인가. 맞으면 'k5' 또는 'k33', 아니면 null.
 * 갈림점(선이 셋 이상 모인 점) 말고는 모두 선이 둘 모인 점이어야 하고, 갈림점마다 길을 따라가면 다른 갈림점에 닿는다.
 * 같은 두 갈림점을 잇는 길이 둘이거나 제자리로 돌아오는 길이 있으면 아니다.
 */
export function kuratowskiKind(edges) {
  const near = new Map();
  for (const [a, b] of edges) {
    for (const [x, y] of [
      [a, b],
      [b, a],
    ]) {
      if (!near.has(x)) near.set(x, []);
      near.get(x).push(y);
    }
  }
  const branch = [...near.keys()].filter((v) => near.get(v).length >= 3);
  if (![...near.keys()].every((v) => near.get(v).length >= 3 || near.get(v).length === 2)) return null;
  const used = new Set();
  const pairs = new Set();
  const links = new Map(branch.map((v) => [v, []]));
  for (const start of branch) {
    for (const first of near.get(start)) {
      const key = (x, y) => (x < y ? `${x}-${y}` : `${y}-${x}`);
      if (used.has(key(start, first))) continue;
      let prev = start;
      let at = first;
      used.add(key(prev, at));
      while (!links.has(at)) {
        const next = near.get(at).find((w) => w !== prev);
        prev = at;
        at = next;
        if (used.has(key(prev, at))) return null;
        used.add(key(prev, at));
      }
      if (at === start) return null;
      const pair = key(start, at);
      if (pairs.has(pair)) return null;
      pairs.add(pair);
      links.get(start).push(at);
      links.get(at).push(start);
    }
  }
  if (used.size !== edges.length) return null;
  if (branch.length === 5 && branch.every((v) => links.get(v).length === 4)) return 'k5';
  if (branch.length === 6 && branch.every((v) => links.get(v).length === 3)) {
    // 두 편으로 갈리고, 한 편의 셋이 다른 편의 셋과 모두 이어져 있다
    const [first] = branch;
    const other = links.get(first);
    const same = branch.filter((v) => !other.includes(v));
    if (same.length !== 3) return null;
    return same.every((v) => other.every((w) => links.get(v).includes(w))) ? 'k33' : null;
  }
  return null;
}

/**
 * 작은 그림(점이 일곱 개쯤까지)에 두 꼴 가운데 하나를 늘인 것이 숨어 있는가.
 * 갈림점을 고르고, 갈림점 쌍마다 다른 갈림점과 이미 쓴 점을 지나지 않는 길을 하나씩 찾아 모두 이어지면 있다.
 */
export function hasKuratowskiBrute(n, edges) {
  const near = Array.from({ length: n }, () => new Set());
  for (const [a, b] of edges) {
    near[a].add(b);
    near[b].add(a);
  }
  const degree = near.map((set) => set.size);
  const choose = (list, k, from = 0, pick = [], out = []) => {
    if (pick.length === k) {
      out.push(pick.slice());
      return out;
    }
    for (let at = from; at < list.length; at++) {
      pick.push(list[at]);
      choose(list, k, at + 1, pick, out);
      pick.pop();
    }
    return out;
  };
  // 갈림점 쌍들을 서로 겹치지 않는 길로 모두 이을 수 있는가
  const linkAll = (branch, pairs) => {
    const busy = new Set(branch);
    const usedEdge = new Set();
    const ekey = (x, y) => (x < y ? `${x}-${y}` : `${y}-${x}`);
    const go = (index) => {
      if (index === pairs.length) return true;
      const [s, t] = pairs[index];
      const walk = (at) => {
        for (const w of near[at]) {
          if (usedEdge.has(ekey(at, w))) continue;
          if (w === t) {
            usedEdge.add(ekey(at, w));
            if (go(index + 1)) return true;
            usedEdge.delete(ekey(at, w));
            continue;
          }
          if (busy.has(w)) continue;
          busy.add(w);
          usedEdge.add(ekey(at, w));
          if (walk(w)) return true;
          usedEdge.delete(ekey(at, w));
          busy.delete(w);
        }
        return false;
      };
      return walk(s);
    };
    return go(0);
  };
  const vertices = Array.from({ length: n }, (_, v) => v);
  for (const five of choose(
    vertices.filter((v) => degree[v] >= 4),
    5,
  )) {
    if (linkAll(five, choose(five, 2))) return true;
  }
  const three = vertices.filter((v) => degree[v] >= 3);
  for (const six of choose(three, 6)) {
    for (const side of choose(six.slice(1), 2)) {
      const left = [six[0], ...side];
      const right = six.filter((v) => !left.includes(v));
      const pairs = left.flatMap((a) => right.map((b) => [a, b]));
      if (linkAll(six, pairs)) return true;
    }
  }
  return false;
}

/** 가장 긴 고리의 길이를 모든 길을 걸어 다시 구한다(작은 그림만) */
export function longestCycleBrute(n, edges) {
  const near = Array.from({ length: n }, () => []);
  for (const [a, b] of edges) {
    near[a].push(b);
    near[b].push(a);
  }
  let best = 0;
  const seen = Array(n).fill(false);
  const walk = (start, at, length) => {
    for (const w of near[at]) {
      if (w === start && length >= 3) best = Math.max(best, length);
      if (seen[w] || w < start) continue;
      seen[w] = true;
      walk(start, w, length + 1);
      seen[w] = false;
    }
  };
  for (let start = 0; start < n; start++) {
    seen[start] = true;
    walk(start, start, 1);
    seen[start] = false;
  }
  return best;
}
