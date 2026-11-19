// 엉킨 그림 풀기: 그림(점과 선), 겹친 곳 찾기, 겹치지 않게 풀 수 있는 그림인지 가리기, 겹치지 않게 놓은 모습 만들기.
// 순수 함수만 둔다. 화면에 손대지 않고, 무작위 수와 지금 시각을 쓰지 않는다. 같은 입력은 늘 같은 출력을 낸다.
//
// 판(board): { points, edges, roles, bridges }
//   points   점의 처음 자리. [가로, 세로]의 목록(숨은 고운 격자의 칸 단위, 정수)
//   edges    선. [작은 점 번호, 큰 점 번호]의 목록. 같은 두 점 사이에 선은 하나뿐이다
//   roles    이야기 옷: 점마다 'house'(집) | 'well'(우물) | 'town'(마을). 그냥 점이면 null
//   bridges  겹쳐도 되는 곳(다리)의 수. 0이나 1
// 자리가 모두 정수라서 겹치는지는 곱셈과 덧셈만으로 똑같이 가린다(어림하지 않는다).
//
// 풀 수 있는 그림인지(평면 그래프인지)는 두 가지로 따진다.
//   - 가리기: 덩어리를 둘로 끊기지 않는 조각(블록)으로 나누고, 조각마다 고리 하나에서 시작해 면을 나눠 가며
//     남은 조각을 끼워 넣는다(Demoucron–Malgrange–Pertuiset). 끼울 면이 없는 조각이 나오면 풀 수 없는 그림이다.
//   - 보이기: 풀 수 있는 그림은 실제로 겹치지 않게 놓은 자리를 만든다(선을 더 그어 세모로 꽉 채운 뒤
//     de Fraysseix–Pach–Pollack의 밀어 놓기로 격자에 놓는다). 풀 수 없는 그림은 선을 하나씩 빼 보며
//     빼도 여전히 풀 수 없으면 빼서, 남은 뼈대(점 다섯을 모두 잇는 그림이나 집 셋과 우물 셋을 잇는 그림을 늘인 것)를 찾는다.
// 테스트가 두 결과를 다른 방법(놓은 자리의 겹친 곳을 따로 세기, 뼈대가 정말 그 꼴인지 따로 따지기, 작은 그림의 모든 경우)으로 확인한다.

/** 숨은 격자의 크기(칸). 점은 0~GRID_W, 0~GRID_H의 정수 자리에만 놓인다 */
export const GRID_W = 20;
export const GRID_H = 17;
/** 한 그림에 놓을 수 있는 점과 선의 위 끝 */
export const MAX_POINTS = 12;
export const MAX_EDGES = 36;
export const ROLES = ['house', 'well', 'town'];

export const edgeKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
const sortEdge = ([a, b]) => (a < b ? [a, b] : [b, a]);
export const sortEdges = (edges) => edges.map(sortEdge).sort((x, y) => x[0] - y[0] || x[1] - y[1]);
const samePoint = (p, q) => p[0] === q[0] && p[1] === q[1];

/** 판을 통째로 베낀다 */
export function copyBoard(board) {
  return {
    points: board.points.map((point) => point.slice()),
    edges: board.edges.map((edge) => edge.slice()),
    roles: board.roles ? board.roles.slice() : null,
    bridges: board.bridges ?? 0,
  };
}

/** 자리 하나가 격자 안의 정수 자리인가 */
export const onGrid = (point) => Array.isArray(point) && point.length === 2 && Number.isInteger(point[0]) && Number.isInteger(point[1]) && point[0] >= 0 && point[0] <= GRID_W && point[1] >= 0 && point[1] <= GRID_H;

/** 점들의 자리가 쓸 수 있는 값인가(격자 안, 서로 다른 자리) */
export function pointsOk(points, n = points?.length) {
  if (!Array.isArray(points) || points.length !== n) return false;
  if (!points.every(onGrid)) return false;
  return new Set(points.map((point) => point.join(','))).size === points.length;
}

/**
 * 판이 규격에 맞는지 본다. 맞으면 null, 아니면 무엇이 틀렸는지 알리는 열쇠.
 * allowEmpty: 선이 하나도 없는 판도 받아들인다(직접 만들기에서 만들던 그림).
 */
export function checkBoard(board, { allowEmpty = false } = {}) {
  if (!board || typeof board !== 'object') return 'no-board';
  const { points, edges } = board;
  if (!Array.isArray(points) || points.length < 1 || points.length > MAX_POINTS) return 'bad-points';
  if (!pointsOk(points)) return 'bad-points';
  if (!Array.isArray(edges) || edges.length > MAX_EDGES) return 'bad-edges';
  const seen = new Set();
  for (const edge of edges) {
    if (!Array.isArray(edge) || edge.length !== 2) return 'bad-edges';
    const [a, b] = edge;
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a >= points.length || b >= points.length || a >= b) return 'bad-edges';
    if (seen.has(edgeKey(a, b))) return 'bad-edges';
    seen.add(edgeKey(a, b));
  }
  if (edges.length === 0 && !allowEmpty) return 'no-edges';
  const roles = board.roles ?? null;
  if (roles !== null && (!Array.isArray(roles) || roles.length !== points.length || !roles.every((role) => ROLES.includes(role)))) return 'bad-roles';
  if (![0, 1].includes(board.bridges ?? 0)) return 'bad-bridges';
  return null;
}

// ---- 자리와 겹침: 정수 자리라서 똑같이 가린다 ----

/** o에서 a, b를 볼 때 돌아가는 쪽(0이면 한 줄) */
export const turn = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

/** 점 p가 선분 ab의 안쪽(두 끝은 빼고)에 놓였는가 */
export function onInside(p, a, b) {
  if (turn(a, b, p) !== 0) return false;
  const along = (p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1]);
  const length = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
  return along > 0 && along < length;
}

/** 두 선분이 끝이 아닌 한 점에서 엇갈리는가(서로 반대쪽에 끝이 하나씩 있다) */
export function crossesProperly(p1, p2, p3, p4) {
  const d1 = Math.sign(turn(p3, p4, p1));
  const d2 = Math.sign(turn(p3, p4, p2));
  const d3 = Math.sign(turn(p1, p2, p3));
  const d4 = Math.sign(turn(p1, p2, p4));
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** 엇갈리는 두 선분이 만나는 자리(그림에 표시를 그릴 때만 쓴다. 소수) */
export function crossPoint(p1, p2, p3, p4) {
  const r = [p2[0] - p1[0], p2[1] - p1[1]];
  const s = [p4[0] - p3[0], p4[1] - p3[1]];
  const denom = r[0] * s[1] - r[1] * s[0];
  const t = ((p3[0] - p1[0]) * s[1] - (p3[1] - p1[1]) * s[0]) / denom;
  return [p1[0] + t * r[0], p1[1] + t * r[1]];
}

/**
 * 그림에서 겹친 곳을 모두 찾는다.
 *   crossings  끝을 같이 쓰지 않는 두 선이 엇갈린 곳 { edges: [선 번호, 선 번호], at: [가로, 세로] }
 *   touches    점이 다른 선 위에 놓인 곳 { point, edge }. 한 줄로 포개진 두 선도 여기서 잡힌다(한 선의 끝이 다른 선 위에 놓인다)
 *   count      둘을 더한 수(화면에 "겹친 곳"으로 보여 준다)
 * @param {number[][]} points
 * @param {number[][]} edges
 * @param {number[]} off 빼 둔 선의 번호(없는 것으로 본다)
 */
export function problemsOf(points, edges, off = []) {
  const crossings = [];
  const touches = [];
  const live = edges.map((_, index) => !off.includes(index));
  for (let i = 0; i < edges.length; i++) {
    if (!live[i]) continue;
    const [a, b] = edges[i];
    for (let j = i + 1; j < edges.length; j++) {
      if (!live[j]) continue;
      const [c, d] = edges[j];
      if (a === c || a === d || b === c || b === d) continue;
      if (crossesProperly(points[a], points[b], points[c], points[d])) crossings.push({ edges: [i, j], at: crossPoint(points[a], points[b], points[c], points[d]) });
    }
  }
  points.forEach((point, index) => {
    edges.forEach(([a, b], edge) => {
      if (!live[edge] || a === index || b === index) return;
      if (onInside(point, points[a], points[b])) touches.push({ point: index, edge });
    });
  });
  return { crossings, touches, count: crossings.length + touches.length };
}

/** 다 풀었는가: 점이 선 위에 놓인 곳이 없고, 엇갈린 곳이 다리의 수보다 많지 않다 */
export function untangled(points, edges, bridges = 0, off = []) {
  const { crossings, touches } = problemsOf(points, edges, off);
  return touches.length === 0 && crossings.length <= bridges;
}

/** 점 하나를 옮길 수 있는 자리인가(격자 안, 다른 점이 없는 자리) */
export function canPlace(points, index, to) {
  return onGrid(to) && points.every((point, other) => other === index || !samePoint(point, to));
}

// ---- 그래프 ----

/** 점마다 이어진 점들 */
export function neighborsOf(n, edges) {
  const list = Array.from({ length: n }, () => []);
  for (const [a, b] of edges) {
    list[a].push(b);
    list[b].push(a);
  }
  return list;
}

/** 점마다 모인 선의 수 */
export function degreesOf(n, edges) {
  return neighborsOf(n, edges).map((list) => list.length);
}

/** 선으로 이어진 덩어리들(점 번호의 목록). 선이 없는 점도 덩어리 하나로 센다 */
export function piecesOf(n, edges) {
  const near = neighborsOf(n, edges);
  const seen = Array(n).fill(false);
  const pieces = [];
  for (let start = 0; start < n; start++) {
    if (seen[start]) continue;
    const piece = [start];
    seen[start] = true;
    for (let at = 0; at < piece.length; at++) {
      for (const next of near[piece[at]]) {
        if (seen[next]) continue;
        seen[next] = true;
        piece.push(next);
      }
    }
    pieces.push(piece);
  }
  return pieces;
}

/**
 * 둘로 끊기지 않는 조각(블록)마다 선 번호의 목록. 점 하나를 빼서 갈라지는 곳에서 그림을 나눈다(Tarjan).
 * 풀 수 있는지는 조각마다 따로 따져도 된다(조각들은 점 하나로만 붙어 있어서 따로 풀어 붙일 수 있다).
 */
export function blocksOf(n, edges) {
  const near = Array.from({ length: n }, () => []);
  edges.forEach(([a, b], index) => {
    near[a].push([b, index]);
    near[b].push([a, index]);
  });
  const disc = Array(n).fill(-1);
  const low = Array(n).fill(0);
  const stack = [];
  const blocks = [];
  let time = 0;
  const visit = (u, parentEdge) => {
    disc[u] = time;
    low[u] = time;
    time += 1;
    for (const [v, edge] of near[u]) {
      if (edge === parentEdge) continue;
      if (disc[v] === -1) {
        stack.push(edge);
        visit(v, edge);
        low[u] = Math.min(low[u], low[v]);
        if (low[v] >= disc[u]) {
          const block = [];
          for (;;) {
            const top = stack.pop();
            block.push(top);
            if (top === edge) break;
          }
          blocks.push(block.sort((x, y) => x - y));
        }
      } else if (disc[v] < disc[u]) {
        stack.push(edge);
        low[u] = Math.min(low[u], disc[v]);
      }
    }
  };
  for (let start = 0; start < n; start++) if (disc[start] === -1) visit(start, -1);
  return blocks;
}

/** 조각 안에서 고리 하나(점 번호의 차례). 둘로 끊기지 않는 조각이라 선이 셋 이상이면 늘 있다 */
function findCycle(near, start) {
  const path = [];
  const onPath = new Set();
  const seen = new Set([start]);
  const go = (u, from) => {
    path.push(u);
    onPath.add(u);
    for (const w of near.get(u)) {
      if (w === from) continue;
      if (onPath.has(w)) return path.slice(path.indexOf(w));
      if (seen.has(w)) continue;
      seen.add(w);
      const found = go(w, u);
      if (found) return found;
    }
    path.pop();
    onPath.delete(u);
    return null;
  };
  return go(start, -1);
}

/**
 * 둘로 끊기지 않는 조각 하나를 평면에 그릴 수 있는가. 되면 면들(점 번호의 고리, 모든 면이 같은 쪽으로 돈다), 안 되면 null.
 * 고리 하나를 두 면(안과 밖)으로 시작해서, 아직 그리지 않은 조각(그린 점 둘을 잇는 선, 또는 그리지 않은 점들의 덩어리)마다
 * 그 조각이 붙는 점을 모두 가진 면을 찾는다. 들어갈 면이 없는 조각이 있으면 그릴 수 없다.
 * 들어갈 면이 하나뿐인 조각부터(없으면 아무 조각이나) 그 조각 안의 길 하나를 면에 그어 면을 둘로 나눈다.
 */
export function embedBlock(blockEdges) {
  const near = new Map();
  const add = (a, b) => {
    if (!near.has(a)) near.set(a, []);
    near.get(a).push(b);
  };
  for (const [a, b] of blockEdges) {
    add(a, b);
    add(b, a);
  }
  const vertices = [...near.keys()].sort((x, y) => x - y);
  if (blockEdges.length < 3) return [];
  if (blockEdges.length > 3 * vertices.length - 6) return null;
  const cycle = findCycle(near, vertices[0]);
  const inH = new Set(cycle);
  const drawn = new Set(cycle.map((v, at) => edgeKey(v, cycle[(at + 1) % cycle.length])));
  let faces = [cycle.slice(), cycle.slice().reverse()];

  while (drawn.size < blockEdges.length) {
    // 아직 그리지 않은 조각들
    const fragments = [];
    for (const [a, b] of blockEdges) {
      if (!drawn.has(edgeKey(a, b)) && inH.has(a) && inH.has(b)) fragments.push({ attach: [a, b], path: [a, b] });
    }
    const seen = new Set();
    for (const v of vertices) {
      if (inH.has(v) || seen.has(v)) continue;
      const comp = [v];
      seen.add(v);
      const attach = new Set();
      for (let at = 0; at < comp.length; at++) {
        for (const w of near.get(comp[at])) {
          if (inH.has(w)) attach.add(w);
          else if (!seen.has(w)) {
            seen.add(w);
            comp.push(w);
          }
        }
      }
      fragments.push({ attach: [...attach].sort((x, y) => x - y), comp: new Set(comp) });
    }
    let pick = null;
    let room = null;
    for (const fragment of fragments) {
      const fits = faces.filter((face) => fragment.attach.every((v) => face.includes(v)));
      if (fits.length === 0) return null;
      if (pick === null || fits.length < room.length) {
        pick = fragment;
        room = fits;
      }
      if (fits.length === 1) break;
    }
    const path = pick.path ?? pathThrough(near, pick);
    for (const v of path) inH.add(v);
    for (let at = 1; at < path.length; at++) drawn.add(edgeKey(path[at - 1], path[at]));
    const face = room[0];
    faces = [...faces.filter((other) => other !== face), ...splitFace(face, path)];
  }
  return faces;
}

/** 덩어리 조각 안을 지나 그 조각이 붙는 서로 다른 두 점을 잇는 길 하나 */
function pathThrough(near, fragment) {
  const [u] = fragment.attach;
  const prev = new Map();
  const queue = [];
  for (const w of near.get(u)) {
    if (fragment.comp.has(w) && !prev.has(w)) {
      prev.set(w, u);
      queue.push(w);
    }
  }
  for (let at = 0; at < queue.length; at++) {
    const x = queue[at];
    for (const w of near.get(x)) {
      if (fragment.comp.has(w)) {
        if (!prev.has(w)) {
          prev.set(w, x);
          queue.push(w);
        }
      } else if (w !== u) {
        const path = [w];
        for (let step = x; step !== u; step = prev.get(step)) path.push(step);
        path.push(u);
        return path.reverse();
      }
    }
  }
  throw new Error('조각을 지나는 길이 없어요');
}

/** 면(고리)을 u에서 v로 가는 길로 둘로 나눈다. 두 면은 원래 면과 같은 쪽으로 돈다 */
function splitFace(face, path) {
  const u = path[0];
  const v = path[path.length - 1];
  const i = face.indexOf(u);
  const j = face.indexOf(v);
  const arc = (from, to) => {
    const out = [];
    for (let k = from; ; k = (k + 1) % face.length) {
      out.push(face[k]);
      if (k === to) break;
    }
    return out;
  };
  const inner = path.slice(1, -1);
  return [
    [...arc(i, j), ...inner.slice().reverse()],
    [...arc(j, i), ...inner],
  ];
}

/** 겹치지 않게 풀 수 있는 그림인가(평면 그래프인가). 자리와 상관없이 점과 선만으로 정해진다 */
export function isPlanar(n, edges) {
  if (edges.length < 9) return true;
  if (n >= 3 && edges.length > 3 * n - 6) return false;
  return blocksOf(n, edges).every((block) => embedBlock(block.map((index) => edges[index])) !== null);
}

// ---- 풀 수 없는 그림의 뼈대 ----

/**
 * 풀 수 없는 그림에서 선을 하나씩 빼 보고, 빼도 여전히 풀 수 없으면 뺀다. 남은 선들이 뼈대다.
 * 더 뺄 수 없는 풀 수 없는 그림은 늘 두 꼴 가운데 하나를 늘인 것이다(Kuratowski): 점 다섯을 모두 잇는 그림, 집 셋과 우물 셋을 모두 잇는 그림.
 * @returns {{kind: 'k5'|'k33', edges: number[][], branch: number[], sides: number[][]|null}|null} 풀 수 있는 그림이면 null
 *   edges   뼈대의 선(원래 그림의 선)
 *   branch  뼈대의 갈림점(선이 셋이나 넷 모인 점). 나머지 뼈대의 점은 선을 늘인 길 위의 점이다
 *   sides   집 셋과 우물 셋 꼴이면 두 편([집 쪽 갈림점들], [우물 쪽 갈림점들])
 */
export function coreOf(n, edges) {
  if (isPlanar(n, edges)) return null;
  let kept = sortEdges(edges);
  for (const edge of sortEdges(edges)) {
    const without = kept.filter((other) => other[0] !== edge[0] || other[1] !== edge[1]);
    if (!isPlanar(n, without)) kept = without;
  }
  const degrees = degreesOf(n, kept);
  const branch = degrees.map((degree, index) => (degree >= 3 ? index : -1)).filter((index) => index >= 0);
  const kind = branch.length === 5 ? 'k5' : 'k33';
  let sides = null;
  if (kind === 'k33') {
    // 갈림점끼리 이어진 길을 따라가서 두 편으로 가른다.
    const ends = branchLinks(n, kept, branch);
    const color = new Map([[branch[0], 0]]);
    const queue = [branch[0]];
    for (let at = 0; at < queue.length; at++) {
      for (const other of ends.get(queue[at])) {
        if (!color.has(other)) {
          color.set(other, 1 - color.get(queue[at]));
          queue.push(other);
        }
      }
    }
    sides = [branch.filter((v) => color.get(v) === 0), branch.filter((v) => color.get(v) === 1)];
  }
  return { kind, edges: kept, branch, sides };
}

/** 뼈대에서 갈림점마다, 선을 따라가 닿는 다른 갈림점들 */
export function branchLinks(n, edges, branch) {
  const near = neighborsOf(n, edges);
  const isBranch = new Set(branch);
  const links = new Map(branch.map((v) => [v, []]));
  for (const start of branch) {
    for (const first of near[start]) {
      let prev = start;
      let at = first;
      while (!isBranch.has(at)) {
        const next = near[at].find((w) => w !== prev);
        prev = at;
        at = next;
      }
      links.get(start).push(at);
    }
  }
  return links;
}

/**
 * 가장 적게 몇 개의 선을 빼면 풀 수 있는 그림이 되는가. 빼는 선의 수를 0개부터 늘려 가며 모든 묶음을 따져 본다.
 * @returns {{best: number, removed: number[]}} removed는 그 가운데 하나(선 번호, 차례가 빠른 묶음)
 */
export function fewestRemovals(n, edges) {
  const m = edges.length;
  const pick = [];
  const tryCount = (k, from) => {
    if (pick.length === k) return isPlanar(n, edges.filter((_, index) => !pick.includes(index)));
    for (let index = from; index <= m - (k - pick.length); index++) {
      pick.push(index);
      if (tryCount(k, index + 1)) return true;
      pick.pop();
    }
    return false;
  };
  // 선이 3n−6개보다 많으면 적어도 그만큼은 빼야 한다.
  const floor = n >= 3 ? Math.max(0, m - (3 * n - 6)) : 0;
  for (let k = floor; k <= m; k++) {
    pick.length = 0;
    if (tryCount(k, 0)) return { best: k, removed: pick.slice() };
  }
  return { best: m, removed: edges.map((_, index) => index) };
}

/**
 * 가장 긴 고리 하나(도구 "고리 하나 보기"). 점 번호의 차례. 고리가 없으면 빈 목록.
 * 점이 열둘 이하라서 지나온 점의 묶음마다 따져서 모두 본다.
 */
export function longestCycle(n, edges) {
  const near = neighborsOf(n, edges).map((list) => new Set(list));
  let best = [];
  for (let s = 0; s < n; s++) {
    // from: (mask, v) → s에서 출발해 mask의 점을 모두 지나 v에 닿는 길에서 v 바로 앞의 점(s 자신은 -2)
    const from = new Map();
    const startMask = 1 << s;
    from.set(startMask * 16 + s, -2);
    const masks = [startMask];
    const seenMask = new Set(masks);
    for (let at = 0; at < masks.length; at++) {
      const mask = masks[at];
      for (let v = s; v < n; v++) {
        if (!from.has(mask * 16 + v)) continue;
        for (const w of near[v]) {
          if (w <= s || mask & (1 << w)) continue;
          const next = mask | (1 << w);
          if (!from.has(next * 16 + w)) from.set(next * 16 + w, v);
          if (!seenMask.has(next)) {
            seenMask.add(next);
            masks.push(next);
          }
        }
      }
    }
    for (const mask of masks) {
      let count = 0;
      for (let bits = mask; bits; bits &= bits - 1) count += 1;
      if (count < 3 || count <= best.length) continue;
      for (let v = s + 1; v < n; v++) {
        if (!from.has(mask * 16 + v) || !near[v].has(s)) continue;
        const cycle = [];
        let at = v;
        let bits = mask;
        while (at !== -2) {
          cycle.push(at);
          const prev = from.get(bits * 16 + at);
          bits &= ~(1 << at);
          at = prev;
        }
        best = cycle.reverse();
        break;
      }
    }
  }
  return best;
}

// ---- 겹치지 않게 놓은 모습 만들기 ----

/** 선을 더 그어 세모로 꽉 채운 그림(더 그을 수 없을 때까지, 풀 수 있는 채로). 점이 셋 이상이면 선은 3n−6개가 된다 */
export function triangulate(n, edges) {
  const list = sortEdges(edges);
  const have = new Set(list.map(([a, b]) => edgeKey(a, b)));
  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      if (have.has(edgeKey(a, b))) continue;
      const next = [...list, [a, b]];
      if (isPlanar(n, next)) {
        list.push([a, b]);
        have.add(edgeKey(a, b));
      }
    }
  }
  return sortEdges(list);
}

/** 면들(같은 쪽으로 도는 세모)에서 점마다 이웃을 도는 차례 */
function rotationsOf(n, faces) {
  const next = Array.from({ length: n }, () => new Map());
  for (const face of faces) {
    face.forEach((v, at) => {
      const prev = face[(at - 1 + face.length) % face.length];
      const after = face[(at + 1) % face.length];
      next[v].set(after, prev);
    });
  }
  return next.map((map) => {
    if (map.size === 0) return [];
    const [first] = map.keys();
    const order = [first];
    for (let at = map.get(first); at !== first; at = map.get(at)) order.push(at);
    return order;
  });
}

/**
 * 세모로 꽉 찬 그림을 격자에 놓는다(de Fraysseix–Pach–Pollack). 가로 2n−4칸, 세로 n−2칸 안에 겹치지 않게 놓인다.
 * 바깥 세모(v1, v2, vn)를 정하고, 바깥 둘레에서 지름선이 없는 점을 하나씩 떼어 내는 차례를 거꾸로 하면
 * 차례대로 붙이는 차례(canonical ordering)가 된다. 붙일 때마다 둘레의 오른쪽 점들을 밀어 자리를 낸다.
 */
function shiftLayout(n, triEdges) {
  if (n === 1) return [[0, 0]];
  if (n === 2) return [[0, 0], [2, 0]];
  const [block] = blocksOf(n, triEdges);
  const faces = embedBlock(block.map((index) => triEdges[index]));
  const rotation = rotationsOf(n, faces);
  const adjacent = neighborsOf(n, triEdges).map((list) => new Set(list));
  const [v1, v2, vn] = faces[0];
  // 거꾸로 떼어 내기
  const alive = new Set(Array.from({ length: n }, (_, v) => v));
  let contour = [v1, vn, v2];
  const removed = [];
  while (alive.size > 3) {
    const at = contour.findIndex((v, index) => {
      if (index === 0 || index === contour.length - 1) return false;
      // 둘레의 다른 점과 이어진 지름선이 없는 점
      return contour.every((w, other) => Math.abs(other - index) <= 1 || !adjacent[v].has(w));
    });
    const v = contour[at];
    const p = contour[at - 1];
    const s = contour[at + 1];
    alive.delete(v);
    removed.push(v);
    const rot = rotation[v];
    const ip = rot.indexOf(p);
    const is = rot.indexOf(s);
    const between = (from, to) => {
      const out = [];
      for (let k = (from + 1) % rot.length; k !== to; k = (k + 1) % rot.length) out.push(rot[k]);
      return out;
    };
    const arcA = between(ip, is);
    const arcB = between(is, ip);
    const inside = (arc) => arc.every((w) => alive.has(w));
    let inner;
    if (inside(arcA) && (arcA.length > 0 || !inside(arcB))) inner = arcA;
    else inner = arcB.slice().reverse();
    contour = [...contour.slice(0, at), ...inner, ...contour.slice(at + 1)];
  }
  const v3 = contour[1];
  const order = [v1, v2, v3, ...removed.reverse()];
  // 밀어 놓기
  const x = Array(n).fill(0);
  const y = Array(n).fill(0);
  const group = Array.from({ length: n }, (_, v) => [v]);
  x[v1] = 0;
  x[v2] = 2;
  x[v3] = 1;
  y[v3] = 1;
  let line = [v1, v3, v2];
  for (let k = 3; k < n; k++) {
    const v = order[k];
    const touching = line.map((w, index) => (adjacent[v].has(w) ? index : -1)).filter((index) => index >= 0);
    const p = Math.min(...touching);
    const q = Math.max(...touching);
    for (let index = p + 1; index < q; index++) for (const u of group[line[index]]) x[u] += 1;
    for (let index = q; index < line.length; index++) for (const u of group[line[index]]) x[u] += 2;
    const wp = line[p];
    const wq = line[q];
    x[v] = (x[wp] - y[wp] + x[wq] + y[wq]) / 2;
    y[v] = (-x[wp] + y[wp] + x[wq] + y[wq]) / 2;
    group[v] = [v, ...line.slice(p + 1, q).flatMap((w) => group[w])];
    line = [...line.slice(0, p + 1), v, ...line.slice(q)];
  }
  const top = Math.max(...y);
  return x.map((value, v) => [value, top - y[v]]);
}

/** 자리 v를 to로 옮겨도 겹친 곳이 생기지 않는가 */
function clearAt(points, near, edges, v, to) {
  const moved = points.map((point, index) => (index === v ? to : point));
  for (const u of near[v]) {
    for (const [c, d] of edges) {
      if (c === v || d === v || c === u || d === u) continue;
      if (crossesProperly(moved[v], moved[u], moved[c], moved[d])) return false;
    }
    for (let w = 0; w < moved.length; w++) {
      if (w !== v && w !== u && onInside(moved[w], moved[v], moved[u])) return false;
    }
  }
  for (const [c, d] of edges) {
    if (c === v || d === v) continue;
    if (onInside(to, moved[c], moved[d])) return false;
  }
  return true;
}

function segmentDistance(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** 놓은 모습이 보기 좋은 정도(클수록 좋다): 점끼리 떨어지고, 선 곁에 다른 점이 붙지 않고, 선이 너무 길지 않게 */
function looks(points, near, edges, v, at) {
  let value = 0;
  points.forEach((point, u) => {
    if (u === v) return;
    const d2 = (point[0] - at[0]) ** 2 + (point[1] - at[1]) ** 2;
    value -= 30 / d2;
  });
  for (const u of near[v]) value -= 0.04 * ((points[u][0] - at[0]) ** 2 + (points[u][1] - at[1]) ** 2);
  for (const [c, d] of edges) {
    if (c === v || d === v) continue;
    const gap = segmentDistance(at, points[c], points[d]);
    value -= 6 / (gap * gap + 0.05);
  }
  for (const u of near[v]) {
    points.forEach((point, w) => {
      if (w === v || w === u) return;
      const gap = segmentDistance(point, at, points[u]);
      value -= 6 / (gap * gap + 0.05);
    });
  }
  // 가장자리에 붙지 않게
  const margin = Math.min(at[0], GRID_W - at[0], at[1], GRID_H - at[1]);
  if (margin < 1) value -= 40;
  return value;
}

/**
 * 겹친 곳이 없는 놓은 모습을 보기 좋게 편다. 겹친 곳이 생기는 자리로는 옮기지 않는다(그래서 늘 겹친 곳이 없다).
 * 점마다 가까운 격자 자리를 모두 견주어 가장 보기 좋은 곳으로 옮기기를 몇 번 되풀이한다.
 */
export function spreadLayout(points, edges, { rounds = 4, reach = 6 } = {}) {
  const n = points.length;
  const near = neighborsOf(n, edges);
  const placed = points.map((point) => point.slice());
  for (let round = 0; round < rounds; round++) {
    let moved = false;
    for (let v = 0; v < n; v++) {
      let best = placed[v];
      let bestValue = looks(placed, near, edges, v, placed[v]);
      for (let x = Math.max(0, placed[v][0] - reach); x <= Math.min(GRID_W, placed[v][0] + reach); x++) {
        for (let y = Math.max(0, placed[v][1] - reach); y <= Math.min(GRID_H, placed[v][1] + reach); y++) {
          const to = [x, y];
          if (!canPlace(placed, v, to)) continue;
          const value = looks(placed, near, edges, v, to);
          if (value <= bestValue + 1e-9) continue;
          if (!clearAt(placed, near, edges, v, to)) continue;
          best = to;
          bestValue = value;
        }
      }
      if (!samePoint(best, placed[v])) {
        placed[v] = best;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return placed;
}

/**
 * 풀 수 있는 그림을 겹친 곳 없이 격자에 놓은 자리. 풀 수 없는 그림이면 null.
 * 세모로 꽉 채워 밀어 놓기로 놓고(늘 겹치지 않는다), 격자 가운데로 옮긴 뒤 보기 좋게 편다.
 * spread가 false면 펴지 않는다(테스트가 밀어 놓기만의 결과도 본다).
 */
export function layoutOf(n, edges, { spread = true } = {}) {
  if (!isPlanar(n, edges)) return null;
  let raw;
  if (n <= 2) raw = n === 1 ? [[0, 0]] : [[0, 0], [2, 0]];
  else raw = shiftLayout(n, triangulate(n, edges));
  const width = Math.max(...raw.map((point) => point[0]));
  const height = Math.max(...raw.map((point) => point[1]));
  // 밀어 놓기의 그림은 가로로 납작하다. 세로를 두 배로 늘려도 겹치지 않는다(늘이기는 겹침을 바꾸지 않는다)
  const stretch = height * 2 <= GRID_H - 2 ? 2 : 1;
  const dx = Math.floor((GRID_W - width) / 2);
  const dy = Math.floor((GRID_H - height * stretch) / 2);
  const placed = raw.map(([x, y]) => [x + dx, y * stretch + dy]);
  return spread ? spreadLayout(placed, edges) : placed;
}

// ---- 판의 풀이 ----

/**
 * 판의 풀이.
 * @param {object} board
 * @returns {{possible: boolean, planar: boolean, layout: number[][]|null, core: object|null, bridgeLayout: number[][]|null}}
 *   possible      다 풀 수 있는가(다리가 있는 판은 다리 수만큼 엇갈려도 된다)
 *   planar        겹친 곳 없이 풀 수 있는가
 *   layout        겹친 곳 없이 놓은 자리(planar일 때)
 *   core          풀 수 없는 그림의 뼈대(planar가 아닐 때)
 *   bridgeLayout  다리가 있고 planar가 아닌 판에서, 엇갈린 곳이 다리 수 이하인 자리(찾은 것. 못 찾으면 null)
 */
export function solveBoard(board) {
  const n = board.points.length;
  const planar = isPlanar(n, board.edges);
  const layout = planar ? layoutOf(n, board.edges) : null;
  const core = planar ? null : coreOf(n, board.edges);
  let bridgeLayout = null;
  if (!planar && (board.bridges ?? 0) > 0) bridgeLayout = bridgeLayoutOf(n, board.edges, board.bridges);
  return { possible: planar || bridgeLayout !== null, planar, layout, core, bridgeLayout };
}

/**
 * 엇갈린 곳이 bridges개 이하인 자리를 찾는다. 원 위에 고르게 놓은 여러 차례에서 시작해 점을 하나씩 옮겨 엇갈린 곳을 줄인다.
 * 찾으면 그 자리, 못 찾으면 null(테스트가 사다리의 다리 판마다 찾는다는 것을 확인한다).
 */
export function bridgeLayoutOf(n, edges, bridges) {
  const cost = (points) => {
    const { crossings, touches } = problemsOf(points, edges);
    return touches.length * 100 + crossings.length;
  };
  const ring = (order) =>
    order.map((_, at) => {
      const angle = (2 * Math.PI * at) / n - Math.PI / 2;
      return [Math.round(GRID_W / 2 + 7 * Math.cos(angle)), Math.round(GRID_H / 2 + 6 * Math.sin(angle))];
    });
  const orders = permutationsFrom(n, 400);
  for (const order of orders) {
    const spots = ring(order);
    let points = Array(n);
    order.forEach((v, at) => {
      points[v] = spots[at];
    });
    if (!pointsOk(points)) continue;
    let value = cost(points);
    for (let pass = 0; pass < 6 && value > bridges; pass++) {
      for (let v = 0; v < n && value > bridges; v++) {
        for (let x = 1; x < GRID_W; x++) {
          for (let y = 1; y < GRID_H; y++) {
            if (!canPlace(points, v, [x, y])) continue;
            const next = points.map((point, index) => (index === v ? [x, y] : point));
            const nextValue = cost(next);
            if (nextValue < value) {
              points = next;
              value = nextValue;
            }
          }
        }
      }
    }
    if (value <= bridges) return spreadBridge(points, edges, bridges);
  }
  return null;
}

/** 다리 판의 자리를 보기 좋게 편다(엇갈린 곳 수가 늘지 않고 점이 선 위에 놓이지 않는 자리로만 옮긴다) */
function spreadBridge(points, edges, bridges) {
  const n = points.length;
  const near = neighborsOf(n, edges);
  const placed = points.map((point) => point.slice());
  for (let round = 0; round < 3; round++) {
    for (let v = 0; v < n; v++) {
      let best = placed[v];
      let bestValue = looks(placed, near, edges, v, placed[v]);
      for (let x = 1; x < GRID_W; x++) {
        for (let y = 1; y < GRID_H; y++) {
          if (!canPlace(placed, v, [x, y])) continue;
          const value = looks(placed, near, edges, v, [x, y]);
          if (value <= bestValue + 1e-9) continue;
          const next = placed.map((point, index) => (index === v ? [x, y] : point));
          if (!untangled(next, edges, bridges)) continue;
          best = [x, y];
          bestValue = value;
        }
      }
      placed[v] = best;
    }
  }
  return placed;
}

/** 0..n−1의 차례 몇 가지(처음은 그대로, 그다음은 정해진 규칙으로 섞은 것) */
function permutationsFrom(n, count) {
  const list = [];
  let state = 12345;
  const next = () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
  for (let k = 0; k < count; k++) {
    const order = Array.from({ length: n }, (_, v) => v);
    if (k > 0) {
      for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
    }
    list.push(order);
  }
  return list;
}
