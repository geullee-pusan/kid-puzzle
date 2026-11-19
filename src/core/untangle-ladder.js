// 엉킨 그림 풀기의 사다리(단계)와 판 내기, "더 작은 판"의 재료. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 엉킨 처음 자리는 시드 난수로 놓되, 겹친 곳이 정해 둔 수 이상인 자리만 쓴다.
import { createRng, randInt, seedFrom } from './rng.js';
import { GRID_H, GRID_W, coreOf, crossesProperly, fewestRemovals, isPlanar, onInside, piecesOf, problemsOf, solveBoard, sortEdges, degreesOf } from './untangle.js';

/**
 * 안 되는 그림이 섞이는 단계에서 안 되는 그림의 비율. 임시값이다(셋에 하나쯤).
 * 늘 되거나 늘 안 되면 해 보지 않고 찍게 된다.
 */
export const IMPOSSIBLE_RATE = 1 / 3;

/**
 * 사다리.
 *   tag    'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode   'untangle'(풀기만) | 'mix'(풀 수 없는 그림이 섞인다. "불가능해요"가 있다) | 'story'(집과 우물, 마을과 길)
 *          | 'record'(가장 적게 선을 빼고 풀기) | 'make'(직접 만들기)
 *   counts 점의 수의 후보(small: 수준 맞추기가 "작은 판부터"라고 할 때)
 *
 * 1단계: 점 5~7개의 풀 수 있는 그림. 첫 판은 별 모양으로 엉킨 고리(점 다섯).
 * 2단계: 점 8~12개의 풀 수 있는 그림.
 * 3단계: 풀 수 없는 그림이 셋에 하나쯤 섞인다(점 다섯을 모두 잇는 그림, 집 셋과 우물 셋 꼴과 그것을 늘인 그림, 하나 모자란 닮은 그림). 첫 판은 점 다섯을 모두 잇는 그림.
 * 4단계: 이야기 옷. 집과 우물을 잇는 길, 마을과 마을을 잇는 길. 다리를 하나 놓을 수 있는 판도 있다.
 * 5단계: 풀 수 없는 그림에서 선을 가장 적게 빼고 풀기(기록 깨기). 첫 판은 점 다섯을 모두 잇는 그림.
 * 6단계: 직접 만들기.
 */
export const LADDER = [
  { level: 1, tag: 'basic', mode: 'untangle', counts: [5, 6, 7], small: [5], extra: [1, 3], cross: 2 },
  { level: 2, tag: 'basic', mode: 'untangle', counts: [8, 9, 10, 11, 12], small: [7, 8], extra: [3, 7], cross: 4 },
  { level: 3, tag: 'applied', mode: 'mix', cross: 3 },
  { level: 4, tag: 'applied', mode: 'story', cross: 2 },
  { level: 5, tag: 'challenge', mode: 'record', cross: 3 },
  { level: 6, tag: 'challenge', mode: 'make' },
];

/** 판을 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;

/** 엉킨 자리를 고르려고 다시 놓아 보는 횟수의 위 끝. 실제로는 넘지 않는다(테스트로 확인한다). */
const MAX_TRIES = 600;
/** 엉킨 자리에서 두 점 사이의 거리의 제곱의 아래 끝(점이 붙어 보이지 않게) */
const MIN_GAP2 = 8;

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

function shuffle(rng, list) {
  const items = list.slice();
  for (let index = items.length - 1; index > 0; index--) {
    const other = randInt(rng, 0, index);
    [items[index], items[other]] = [items[other], items[index]];
  }
  return items;
}

// ---- 이름 있는 그림들 ----

/** 점 n개를 모두 서로 잇는 그림 */
export function complete(n) {
  const edges = [];
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) edges.push([a, b]);
  return { n, edges };
}

/** 한쪽 a개(앞 번호)와 다른 쪽 b개(뒤 번호)를 모두 잇는 그림(집과 우물) */
export function bipartite(a, b) {
  const edges = [];
  for (let i = 0; i < a; i++) for (let j = 0; j < b; j++) edges.push([i, a + j]);
  return { n: a + b, edges };
}

/** 선 하나(번호 at)를 뺀 그림 */
const minusEdge = (graph, at = 0) => ({ n: graph.n, edges: graph.edges.filter((_, index) => index !== at) });

/** 선 하나(번호 at)의 가운데에 점을 하나 더 놓아 길을 늘인 그림 */
function subdivide(graph, at = 0) {
  const [a, b] = graph.edges[at];
  const mid = graph.n;
  return { n: graph.n + 1, edges: sortEdges([...graph.edges.filter((_, index) => index !== at), [a, mid], [mid, b]]) };
}

export const NAMED = {
  k4: complete(4),
  k5: complete(5),
  k6: complete(6),
  k23: bipartite(2, 3),
  k33: bipartite(3, 3),
  k34: bipartite(3, 4),
  k44: bipartite(4, 4),
  /** 점 열 개, 선 열다섯 개: 바깥 다섯 고리와 안쪽 별, 그 사이의 선 다섯 */
  petersen: { n: 10, edges: sortEdges([[0, 1], [1, 2], [2, 3], [3, 4], [0, 4], [0, 5], [1, 6], [2, 7], [3, 8], [4, 9], [5, 7], [7, 9], [6, 9], [6, 8], [5, 8]]) },
  /** 세모 기둥: 세모 둘을 선 셋으로 잇는다 */
  prism: { n: 6, edges: sortEdges([[0, 1], [1, 2], [0, 2], [3, 4], [4, 5], [3, 5], [0, 3], [1, 4], [2, 5]]) },
  /** 정육면체의 모서리 */
  cube: { n: 8, edges: sortEdges([[0, 1], [1, 2], [2, 3], [0, 3], [4, 5], [5, 6], [6, 7], [4, 7], [0, 4], [1, 5], [2, 6], [3, 7]]) },
  /** 팔면체: 점 여섯이 마주 보는 점만 빼고 모두 이어진다(선이 열둘이라 빽빽해 보이지만 풀린다) */
  octahedron: { n: 6, edges: complete(6).edges.filter(([a, b]) => !(a % 2 === 0 && b === a + 1)) },
  /** 바퀴: 고리 여섯과 가운데 점 */
  wheel: { n: 7, edges: sortEdges([[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [0, 5], [0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6]]) },
};

// ---- 엉킨 자리 ----

/** 두 점이 너무 가깝지 않은가 */
const apart = (points, at) => points.every((other) => (other[0] - at[0]) ** 2 + (other[1] - at[1]) ** 2 >= MIN_GAP2);

/** 격자 안쪽(가장자리 한 칸은 비운다)에 점 n개를 시드 난수로 놓는다 */
function randomPoints(rng, n) {
  const points = [];
  for (let guard = 0; points.length < n && guard < 5000; guard++) {
    const at = [randInt(rng, 1, GRID_W - 1), randInt(rng, 1, GRID_H - 1)];
    if (apart(points, at)) points.push(at);
  }
  return points.length === n ? points : null;
}

/**
 * 그림을 엉키게 놓는다: 엇갈린 곳이 cross개 이상이고 점이 선 위에 놓인 곳은 없는 자리.
 * 그런 자리를 못 찾으면(엇갈릴 수 없는 그림) 가장 많이 엇갈린 자리를, 그것도 없으면 null을 낸다.
 */
export function scramble(rng, n, edges, cross) {
  let best = null;
  let bestCount = -1;
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const points = randomPoints(rng, n);
    if (!points) continue;
    const { crossings, touches } = problemsOf(points, edges);
    if (touches.length > 0) continue;
    if (crossings.length >= cross) return points;
    if (crossings.length > bestCount) {
      best = points;
      bestCount = crossings.length;
    }
  }
  return bestCount > 0 ? best : null;
}

/** 점의 번호를 섞는다(같은 그림이 늘 같은 번호로 나오지 않게). roles도 따라 섞인다 */
function relabel(rng, graph, roles = null) {
  const order = shuffle(
    rng,
    Array.from({ length: graph.n }, (_, v) => v),
  );
  const edges = sortEdges(graph.edges.map(([a, b]) => [order[a], order[b]]));
  let newRoles = null;
  if (roles) {
    newRoles = Array(graph.n);
    roles.forEach((role, v) => {
      newRoles[order[v]] = role;
    });
  }
  return { n: graph.n, edges, roles: newRoles };
}

/** 그림을 판으로 만든다: 번호를 섞고 엉키게 놓는다 */
function tangled(rng, graph, cross, { roles = null, bridges = 0 } = {}) {
  const shuffled = relabel(rng, graph, roles);
  const points = scramble(rng, shuffled.n, shuffled.edges, cross);
  if (!points) return null;
  return { points, edges: shuffled.edges, roles: shuffled.roles, bridges };
}

/**
 * 풀 수 있는 그림을 하나 만든다: 점을 흩어 놓고, 겹치지 않는 선만 그어 한 덩어리로 이은 뒤 몇 개 더 긋는다.
 * 선이 하나뿐인 점(끝점)이 없는 그림만 낸다(끝점은 아무 데나 두면 되어 너무 쉽다).
 */
export function randomPlanar(rng, n, [fewest, most]) {
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const points = randomPoints(rng, n);
    if (!points) continue;
    const pairs = [];
    for (let a = 0; a < n; a++) {
      for (let b = a + 1; b < n; b++) {
        if (points.some((point, index) => index !== a && index !== b && onInside(point, points[a], points[b]))) continue;
        pairs.push([a, b]);
      }
    }
    // 짧은 선이 먼저 나오게 길이로 무게를 둔다(먼 점끼리 잇는 선이 늘어서지 않게)
    const weighed = pairs.map((pair) => ({ pair, key: length2(points, pair) * (0.5 + rng()) }));
    const order = weighed.sort((x, y) => x.key - y.key).map((item) => item.pair);
    const edges = [];
    const fits = (a, b) => edges.every(([c, d]) => a === c || a === d || b === c || b === d || !crossesProperly(points[a], points[b], points[c], points[d]));
    const group = Array.from({ length: n }, (_, v) => v);
    const find = (v) => (group[v] === v ? v : (group[v] = find(group[v])));
    const rest = [];
    for (const [a, b] of order) {
      if (find(a) !== find(b) && fits(a, b)) {
        group[find(a)] = find(b);
        edges.push([a, b]);
      } else rest.push([a, b]);
    }
    if (edges.length !== n - 1) continue;
    let extra = randInt(rng, fewest, most);
    for (const [a, b] of rest) {
      if (extra === 0) break;
      if (!fits(a, b)) continue;
      edges.push([a, b]);
      extra -= 1;
    }
    if (extra > 0) continue;
    if (Math.min(...degreesOf(n, edges)) < 2) continue;
    return { n, edges: sortEdges(edges) };
  }
  throw new Error('풀 수 있는 그림을 만들지 못했어요');
}

const length2 = (points, [a, b]) => (points[a][0] - points[b][0]) ** 2 + (points[a][1] - points[b][1]) ** 2;

/** 맨 첫 판: 별 모양으로 엉킨 다섯 점의 고리(엇갈린 곳 다섯). 오각형으로 펴면 풀린다 */
export const FIRST_BOARD = {
  points: [
    [12, 2],
    [19, 7],
    [16, 14],
    [8, 14],
    [5, 7],
  ],
  edges: [
    [0, 2],
    [0, 3],
    [1, 3],
    [1, 4],
    [2, 4],
  ],
  roles: null,
  bridges: 0,
};

// ---- 3단계: 섞인 판 ----

/** 풀 수 없는 그림의 재료(점 다섯을 모두 잇는 그림, 집 셋과 우물 셋 꼴과 그것을 늘이거나 선을 더한 것) */
function impossibleGraph(rng, small) {
  const pool = small ? ['k5', 'k33', 'k5sub'] : ['k5', 'k33', 'k5sub', 'k33sub', 'k33plus', 'k5plus', 'petersen'];
  const kind = pool[randInt(rng, 0, pool.length - 1)];
  if (kind === 'k5' || kind === 'k33' || kind === 'petersen') return NAMED[kind];
  if (kind === 'k5sub') return subdivide(NAMED.k5, randInt(rng, 0, 9));
  if (kind === 'k33sub') return subdivide(NAMED.k33, randInt(rng, 0, 8));
  // 선을 하나 더한 것: 같은 편의 두 점을 잇거나(집 셋과 우물 셋), 바깥에 점 하나를 더해 둘과 잇는다(점 다섯)
  if (kind === 'k33plus') {
    const side = randInt(rng, 0, 1) * 3;
    const a = side + randInt(rng, 0, 2);
    const b = side + ((a - side + randInt(rng, 1, 2)) % 3);
    return { n: 6, edges: sortEdges([...NAMED.k33.edges, [Math.min(a, b), Math.max(a, b)]]) };
  }
  const a = randInt(rng, 0, 4);
  const b = (a + randInt(rng, 1, 4)) % 5;
  return { n: 6, edges: sortEdges([...NAMED.k5.edges, [Math.min(a, 5), 5], [Math.min(b, 5), 5]]) };
}

/** 풀 수 있지만 빽빽하거나 풀 수 없는 그림과 닮은 그림 */
function possibleGraph(rng, small) {
  const pool = small ? ['k5e', 'k33e', 'octahedron', 'prism', 'random'] : ['k5e', 'k33e', 'octahedron', 'prism', 'cube', 'wheel', 'random', 'random'];
  const kind = pool[randInt(rng, 0, pool.length - 1)];
  if (kind === 'k5e') return minusEdge(NAMED.k5, randInt(rng, 0, 9));
  if (kind === 'k33e') return minusEdge(NAMED.k33, randInt(rng, 0, 8));
  if (kind === 'random') {
    const n = small ? randInt(rng, 5, 6) : randInt(rng, 6, 8);
    return randomPlanar(rng, n, [n - 1, 2 * n - 6]);
  }
  return NAMED[kind];
}

// ---- 4단계: 이야기 옷 ----

const houses = (a, b) => ({ graph: bipartite(a, b), roles: [...Array(a).fill('house'), ...Array(b).fill('well')] });
const towns = (graph) => ({ graph, roles: Array(graph.n).fill('town') });

/**
 * 이야기 판. 판 번호가 달라지면 차례로 돈다. 풀 수 없는 판은 여덟에 둘이다.
 *   집 둘과 우물 셋 → 집 셋과 우물 셋 → 한 집이 한 우물에는 안 가도 될 때 → 다리 하나를 놓을 수 있을 때
 *   → 마을 넷 → 마을 다섯 → 마을 다섯에서 길 하나가 없을 때 → 마을 다섯에 다리 하나
 */
export const STORIES = [
  { ...houses(2, 3), bridges: 0 },
  { ...houses(3, 3), bridges: 0 },
  { graph: minusEdge(bipartite(3, 3), 8), roles: [...Array(3).fill('house'), ...Array(3).fill('well')], bridges: 0 },
  { ...houses(3, 3), bridges: 1 },
  { ...towns(NAMED.k4), bridges: 0 },
  { ...towns(NAMED.k5), bridges: 0 },
  { ...towns(minusEdge(NAMED.k5, 9)), bridges: 0 },
  { ...towns(NAMED.k5), bridges: 1 },
];

// ---- 5단계: 가장 적게 빼기 ----

/** 선을 가장 적게 빼고 풀 그림의 재료. 첫 판은 점 다섯을 모두 잇는 그림이다 */
function recordGraph(rng, seed, small) {
  if (seed === 1) return NAMED.k5;
  const pool = small ? ['k33', 'k6', 'k5'] : ['k34', 'petersen', 'k6', 'random', 'k44', 'random'];
  const kind = pool[(seed - 2) % pool.length];
  if (kind !== 'random') return NAMED[kind];
  // 세모로 꽉 찬 그림보다 선이 한두 개 많은 그림(점 일곱이나 여덟)
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const n = randInt(rng, 7, 8);
    const want = 3 * n - 6 + randInt(rng, 1, 2);
    const all = shuffle(rng, complete(n).edges).slice(0, want);
    const graph = { n, edges: sortEdges(all) };
    if (piecesOf(n, graph.edges).length !== 1 || Math.min(...degreesOf(n, graph.edges)) < 3) continue;
    const { best } = fewestRemovals(n, graph.edges);
    if (best >= 2 && best <= 3) return graph;
  }
  return NAMED.k34;
}

/**
 * 판 하나를 낸다.
 * @param {number} level 1~5
 * @param {number} seed 판 번호(1부터)
 * @param {{small?: boolean}} options small: 그 단계에서 점이 적은 판을 낸다(수준 맞추기에서 쓴다)
 * @returns {{level, seed, small, board, solution}}
 */
export function generateBoard(level, seed, { small = false } = {}) {
  const rung = rungOf(level);
  if (rung.mode === 'make') throw new Error('직접 만들기 단계는 판을 내지 않아요');
  const rng = createRng(seedFrom('untangle', level, seed, small ? 'small' : ''));
  const done = (board) => ({ level, seed, small, board, solution: solveBoard(board) });
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    let board = null;
    if (rung.mode === 'untangle') {
      if (level === 1 && seed === 1 && !small) return done(FIRST_BOARD);
      const counts = small ? rung.small : rung.counts;
      const n = counts[randInt(rng, 0, counts.length - 1)];
      const graph = randomPlanar(rng, n, rung.extra);
      board = tangled(rng, graph, Math.max(rung.cross, Math.floor(graph.edges.length / 3)));
    } else if (rung.mode === 'mix') {
      const impossible = seed === 1 || rng() < IMPOSSIBLE_RATE;
      const graph = seed === 1 ? NAMED.k5 : impossible ? impossibleGraph(rng, small) : possibleGraph(rng, small);
      board = tangled(rng, graph, rung.cross);
    } else if (rung.mode === 'story') {
      const list = small ? STORIES.filter((story) => story.graph.n <= 5) : STORIES;
      const story = list[(seed - 1) % list.length];
      board = tangled(rng, story.graph, rung.cross, { roles: story.roles, bridges: story.bridges });
    } else if (rung.mode === 'record') {
      const graph = recordGraph(rng, seed, small);
      board = tangled(rng, graph, rung.cross);
    }
    if (board) return done(board);
  }
  throw new Error(`판을 만들지 못했어요: ${level}단계 ${seed}번`);
}

const sameBoard = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** 다음 판 번호. 방금 한 판과 똑같은 판이 나오는 번호는 건너뛴다. */
export function nextSeed(level, seed, options = {}) {
  const now = generateBoard(level, seed, options).board;
  for (let next = seed + 1; next < seed + 40; next++) {
    if (!sameBoard(generateBoard(level, next, options).board, now)) return next;
  }
  return seed + 1;
}

/**
 * 직접 만든 그림을 엉키게 놓은 판(내가 해 볼래요, 공책에 남기기). 같은 그림은 늘 같은 자리로 엉킨다.
 * 엇갈릴 수 없는 그림(선이 모두 한 점에 모이는 그림 등)이면 null.
 */
export function tangleMade(points, edges) {
  const rng = createRng(seedFrom('untangle-made', JSON.stringify(points), JSON.stringify(edges)));
  const placed = scramble(rng, points.length, edges, Math.max(1, Math.min(4, Math.floor(edges.length / 3))));
  return placed ? { points: placed, edges: sortEdges(edges), roles: null, bridges: 0 } : null;
}

// ---- "더 작은 판"의 재료 ----

/** 뼈대를 늘이지 않은 꼴(점 다섯을 모두 잇는 그림, 집 셋과 우물 셋) */
const pureOf = (kind) => (kind === 'k5' ? NAMED.k5 : NAMED.k33);
const sameShape = (graph, pure) => graph.n === pure.n && graph.edges.length === pure.edges.length;

/**
 * 원래 판보다 작은 판들. 되는 판(yes)과 안 되는 판(no)으로 나누어 낸다(차례는 src/core/smaller.js가 고른다).
 *   풀 수 있는 그림   점이 하나에서 셋 적은, 같은 종류의 풀 수 있는 그림
 *   풀 수 없는 그림   뼈대(점 다섯을 모두 잇는 그림이나 집 셋과 우물 셋)에서 선 하나를 뺀 그림(되는 판)과 뼈대(안 되는 판).
 *                     원래 판이 이미 뼈대 그대로면 하나 작은 꼴(점 넷을 모두 잇는 그림, 집 둘과 우물 셋)
 *   이야기 판          같은 옷의 더 작은 판(집 둘과 우물 둘, 마을 넷 …)
 *   가장 적게 빼기     둘 이상 빼야 하는 그림이면 그 뼈대(하나만 빼면 되는 그림)
 * 엇갈릴 수 없는 그림(점 셋의 세모 등)은 내지 않는다.
 * @param {{mode: string, board: object}} origin
 */
export function smallBoards(origin) {
  const { mode, board } = origin;
  const n = board.points.length;
  const rng = createRng(seedFrom('untangle-smaller', mode, n, JSON.stringify(board.edges), JSON.stringify(board.roles)));
  const lists = { yes: [], no: [] };
  const put = (side, graph, extra = {}) => {
    const made = tangled(rng, graph, 2, extra) ?? tangled(rng, graph, 1, extra);
    if (made) lists[side].push(made);
  };
  const planar = isPlanar(n, board.edges);
  if (mode === 'record') {
    if (fewestRemovals(n, board.edges).best >= 2) put('yes', pureOf(coreOf(n, board.edges).kind));
    return lists;
  }
  if (board.roles) {
    const isHouses = board.roles.includes('house');
    if (isHouses) {
      for (const [a, b] of [[2, 3], [2, 2]]) {
        if (a + b < n || (a + b === n && board.edges.length > a * b)) put('yes', bipartite(a, b), { roles: [...Array(a).fill('house'), ...Array(b).fill('well')] });
      }
    } else if (n > 4 || board.edges.length > 6) put('yes', NAMED.k4, { roles: Array(4).fill('town') });
    return lists;
  }
  if (planar) {
    if (n <= 4) return lists;
    for (let k = 0; k < 3; k++) {
      const smaller = randInt(rng, Math.max(4, n - 3), n - 1);
      const most = Math.max(1, Math.min(board.edges.length - n, 2 * smaller - 6));
      put('yes', randomPlanar(rng, smaller, [Math.min(1, most), most]));
    }
    return lists;
  }
  const core = coreOf(n, board.edges);
  const pure = pureOf(core.kind);
  if (sameShape({ n, edges: board.edges }, pure)) {
    put('yes', core.kind === 'k5' ? NAMED.k4 : NAMED.k23);
    return lists;
  }
  put('yes', minusEdge(pure, randInt(rng, 0, pure.edges.length - 1)));
  put('no', pure);
  return lists;
}
