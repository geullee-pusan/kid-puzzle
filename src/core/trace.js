// 한붓그리기: 그림, 긋는 규칙, 풀이 프로그램, 그림 고치기, 오답 짐작.
// 순수 함수만 둔다. 화면에 손대지 않고, 무작위 수와 지금 시각을 쓰지 않는다. 같은 입력은 늘 같은 출력을 낸다.
//
// 그림(figure): { points, edges, multi?, split? }
//   points  점의 자리. [가로, 세로]의 목록(격자 칸 단위)
//   edges   선. [점 번호, 점 번호]의 목록. 같은 두 점 사이에 선은 하나뿐이다(multi가 아니면)
//   multi   true면 같은 두 점 사이에 선(다리)이 여럿일 수 있다(MAX_PARALLEL개까지. 6단계 다리 건너기)
//   split   닮은 두 그림(7단계): 앞의 split개 점이 왼쪽 그림, 나머지가 오른쪽 그림이다. 두 그림을 잇는 선은 없다
// 목표는 손을 떼지 않고 모든 선을 꼭 한 번씩 긋는 것이다. 같은 점은 여러 번 지나도 된다.
// 같은 두 점 사이의 선은 서로 바꿔 써도 같다(끝이 같다). 그래서 길은 지나는 점의 차례로만 적고,
// 두 점 사이를 지날 때마다 아직 긋지 않은 선 가운데 번호가 가장 작은 것을 긋는다.

/** 한 그림에 놓을 수 있는 점과 선의 위 끝(점 11~12개는 닮은 두 그림을 나란히 놓을 때만 쓴다) */
export const MAX_POINTS = 12;
export const MAX_EDGES = 24;
/** 같은 두 점 사이에 놓을 수 있는 다리의 위 끝(multi인 그림) */
export const MAX_PARALLEL = 3;

/**
 * 선이 다른 점에 이만큼(격자 칸)보다 가까이 지나가면 그 점 위를 지나는 것으로 본다.
 * 0.5는 임시값이다. 비스듬히 가는 선(가로 2, 세로 1)이 바로 옆 칸의 점을 스치듯 지나가면(거리 0.45) 안 된다.
 * 어느 선이 어느 점에 닿는지 헷갈리지 않게 하려는 것이다.
 */
export const NEAR = 0.5;

export const edgeKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

/**
 * 그림이 규격에 맞는지 본다. 맞으면 null, 아니면 무엇이 틀렸는지 알리는 열쇠.
 * allowEmpty: 선이 하나도 없는 그림도 받아들인다(직접 만들기에서 만들던 그림).
 */
export function checkFigure(figure, { allowEmpty = false } = {}) {
  if (!figure || typeof figure !== 'object') return 'no-figure';
  const { points, edges } = figure;
  if (!Array.isArray(points) || points.length < 2 || points.length > MAX_POINTS) return 'bad-points';
  for (const point of points) {
    if (!Array.isArray(point) || point.length !== 2 || !point.every((value) => Number.isFinite(value))) return 'bad-points';
  }
  if (new Set(points.map((point) => point.join(','))).size !== points.length) return 'bad-points';
  if (!Array.isArray(edges) || edges.length > MAX_EDGES) return 'bad-edges';
  if (figure.multi !== undefined && figure.multi !== true) return 'bad-edges';
  const split = figure.split;
  if (split !== undefined && (!Number.isInteger(split) || split < 2 || split > points.length - 2)) return 'bad-points';
  const seen = new Map();
  for (const edge of edges) {
    if (!Array.isArray(edge) || edge.length !== 2) return 'bad-edges';
    const [a, b] = edge;
    if (!Number.isInteger(a) || !Number.isInteger(b)) return 'bad-edges';
    if (a < 0 || b < 0 || a >= points.length || b >= points.length || a === b) return 'bad-edges';
    const times = (seen.get(edgeKey(a, b)) ?? 0) + 1;
    if (times > (figure.multi ? MAX_PARALLEL : 1)) return 'bad-edges';
    seen.set(edgeKey(a, b), times);
    // 닮은 두 그림: 두 그림을 잇는 선은 없다.
    if (split !== undefined && a < split !== b < split) return 'bad-edges';
  }
  if (edges.length === 0 && !allowEmpty) return 'no-edges';
  return null;
}

/** 점마다 모인 선의 수 */
export function degreesOf(figure) {
  const degrees = Array(figure.points.length).fill(0);
  for (const [a, b] of figure.edges) {
    degrees[a] += 1;
    degrees[b] += 1;
  }
  return degrees;
}

/** 두 점을 잇는 선의 번호. 없으면 -1. skip에 든 번호는 건너뛴다(같은 두 점 사이의 다른 다리를 찾을 때) */
export function edgeIndex(figure, a, b, skip = null) {
  return figure.edges.findIndex(([p, q], index) => ((p === a && q === b) || (p === b && q === a)) && !(skip && skip.has(index)));
}

/** 닮은 두 그림 가운데 한쪽('left' | 'right')만 떼어 낸 그림. 점 번호는 0부터 다시 붙인다 */
export function sideOf(figure, side) {
  const { split } = figure;
  const left = side === 'left';
  const from = left ? 0 : split;
  const points = left ? figure.points.slice(0, split) : figure.points.slice(split);
  const edges = figure.edges.filter(([a]) => a < split === left).map(([a, b]) => [a - from, b - from]);
  return { points, edges };
}

/** 점마다 이어진 것들: [이웃 점, 선 번호]의 목록 */
function neighbors(figure) {
  const list = figure.points.map(() => []);
  figure.edges.forEach(([a, b], index) => {
    list[a].push([b, index]);
    list[b].push([a, index]);
  });
  return list;
}

/** 선으로 이어진 덩어리의 수. 선이 하나도 없는 점은 세지 않는다. */
export function pieceCount(figure) {
  const near = neighbors(figure);
  const seen = Array(figure.points.length).fill(false);
  let pieces = 0;
  for (let start = 0; start < figure.points.length; start++) {
    if (seen[start] || near[start].length === 0) continue;
    pieces += 1;
    const stack = [start];
    seen[start] = true;
    while (stack.length > 0) {
      const at = stack.pop();
      for (const [next] of near[at]) {
        if (seen[next]) continue;
        seen[next] = true;
        stack.push(next);
      }
    }
  }
  return pieces;
}

/** start에서 시작해 모든 선을 한 번씩 지나는 차례 하나(점 번호의 목록). 되는 그림에서만 부른다. */
function trailFrom(figure, start) {
  const near = neighbors(figure);
  const used = Array(figure.edges.length).fill(false);
  const cursor = Array(figure.points.length).fill(0);
  const stack = [start];
  const path = [];
  while (stack.length > 0) {
    const at = stack.at(-1);
    while (cursor[at] < near[at].length && used[near[at][cursor[at]][1]]) cursor[at] += 1;
    if (cursor[at] === near[at].length) {
      path.push(stack.pop());
      continue;
    }
    const [next, edge] = near[at][cursor[at]];
    used[edge] = true;
    stack.push(next);
  }
  return path.reverse();
}

/**
 * 풀이 프로그램. 덩어리의 수와, 선이 홀수 개 모인 점의 수로 가린다.
 * (모든 차례를 다 해 보는 탐색과 결과가 같다는 것을 테스트에서 확인한다.)
 * @returns {{possible: boolean, starts: number[], path: number[], odd: number[], pieces: number}}
 *   possible 손을 떼지 않고 모든 선을 한 번씩 그을 수 있는가
 *   starts   시작할 수 있는 점의 목록(안 되면 빈 목록)
 *   path     한 가지 그리는 차례. 지나는 점의 번호를 차례로 적은 것(안 되면 빈 목록)
 *   odd      선이 홀수 개 모인 점의 목록
 *   pieces   덩어리의 수
 */
export function solve(figure) {
  const problem = checkFigure(figure);
  if (problem) throw new Error(`그림이 규격에 맞지 않아요: ${problem}`);
  const degrees = degreesOf(figure);
  const odd = [];
  const touched = [];
  degrees.forEach((degree, index) => {
    if (degree % 2 === 1) odd.push(index);
    if (degree > 0) touched.push(index);
  });
  const pieces = pieceCount(figure);
  const possible = pieces === 1 && (odd.length === 0 || odd.length === 2);
  if (!possible) return { possible: false, starts: [], path: [], odd, pieces };
  const starts = odd.length === 2 ? odd : touched;
  return { possible: true, starts, path: trailFrom(figure, starts[0]), odd, pieces };
}

/**
 * 지금까지 그은 길(지나온 점의 목록)을 따라가 본다.
 * @returns {{ok: boolean, used: number[], at: number|null, left: number, open: number[], stuck: boolean, complete: boolean}}
 *   ok       길이 규칙에 맞는가(이어진 선만, 같은 선은 한 번만)
 *   used     그은 선의 번호(그은 차례대로)
 *   at       지금 있는 점(아직 시작하지 않았으면 null)
 *   left     아직 긋지 않은 선의 수
 *   open     다음에 갈 수 있는 점(시작하기 전에는 선이 있는 모든 점)
 *   stuck    더 갈 선이 없는데 선이 남아 있다
 *   complete 모든 선을 그었다
 */
export function walk(figure, path) {
  const fail = { ok: false, used: [], at: null, left: figure.edges.length, open: [], stuck: false, complete: false };
  if (!Array.isArray(path)) return fail;
  const total = figure.edges.length;
  if (path.length === 0) {
    const open = degreesOf(figure)
      .map((degree, index) => (degree > 0 ? index : -1))
      .filter((index) => index >= 0);
    return { ok: true, used: [], at: null, left: total, open, stuck: false, complete: false };
  }
  if (path.some((point) => !Number.isInteger(point) || point < 0 || point >= figure.points.length)) return fail;
  const used = [];
  const taken = new Set();
  for (let step = 1; step < path.length; step++) {
    const edge = edgeIndex(figure, path[step - 1], path[step], taken);
    if (edge < 0) return fail;
    used.push(edge);
    taken.add(edge);
  }
  const at = path.at(-1);
  const open = openFrom(figure, taken, at);
  const left = total - used.length;
  return { ok: true, used, at, left, open, stuck: left > 0 && open.length === 0, complete: left === 0 && total > 0 };
}

/** at에서 아직 긋지 않은 선으로 갈 수 있는 점들(같은 점은 한 번만, 작은 번호부터) */
function openFrom(figure, taken, at) {
  const open = new Set();
  figure.edges.forEach(([a, b], index) => {
    if (taken.has(index)) return;
    if (a === at) open.add(b);
    else if (b === at) open.add(a);
  });
  return [...open].sort((x, y) => x - y);
}

// ---- 5단계 "펜 몇 번 떼기": 펜을 떼고 여러 번에 나눠 긋는다 ----

/**
 * 모든 선을 한 번씩 지나는 차례(Hierholzer). 점의 수와 선 목록을 받아 start에서 시작한다.
 * 한 덩어리이고 선이 홀수 개 모인 점이 없는 선 목록에서만 부른다(그러면 start로 돌아온다).
 * @returns {{points: number[], edges: number[]}} 지나는 점의 차례와, 그 사이의 선 번호의 차례
 */
function tourOf(count, edges, start) {
  const near = Array.from({ length: count }, () => []);
  edges.forEach(([a, b], index) => {
    near[a].push([b, index]);
    near[b].push([a, index]);
  });
  const used = Array(edges.length).fill(false);
  const cursor = Array(count).fill(0);
  const stack = [[start, -1]];
  const out = [];
  while (stack.length > 0) {
    const [at] = stack.at(-1);
    while (cursor[at] < near[at].length && used[near[at][cursor[at]][1]]) cursor[at] += 1;
    if (cursor[at] === near[at].length) {
      out.push(stack.pop());
      continue;
    }
    const [next, edge] = near[at][cursor[at]];
    used[edge] = true;
    stack.push([next, edge]);
  }
  out.reverse();
  return { points: out.map(([point]) => point), edges: out.slice(1).map(([, edge]) => edge) };
}

/** 선이 있는 덩어리마다 점 번호의 목록 */
function piecesOf(figure) {
  const near = neighbors(figure);
  const seen = Array(figure.points.length).fill(false);
  const pieces = [];
  for (let start = 0; start < figure.points.length; start++) {
    if (seen[start] || near[start].length === 0) continue;
    const piece = [];
    const stack = [start];
    seen[start] = true;
    while (stack.length > 0) {
      const at = stack.pop();
      piece.push(at);
      for (const [next] of near[at]) {
        if (seen[next]) continue;
        seen[next] = true;
        stack.push(next);
      }
    }
    pieces.push(piece.sort((x, y) => x - y));
  }
  return pieces;
}

/**
 * 가장 적게 몇 번에 나눠 그을 수 있나, 그리고 그렇게 긋는 한 가지 방법.
 * 덩어리마다 선이 홀수 개 모인 점의 수의 절반(그런 점이 없으면 1번)을 더한다.
 * 방법: 홀수 점을 둘씩 묶어 없는 선(가짜 선)으로 잇고, 모든 선을 한 바퀴에 도는 차례를 찾은 뒤 가짜 선에서 끊는다.
 * (펜을 떼고 다시 대는 모든 차례를 다 해 보는 탐색과 결과가 같다는 것을 테스트에서 확인한다.)
 * @returns {{strokes: number, lifts: number, plan: number[][]}} plan은 획마다 지나는 점의 차례. lifts는 펜을 떼는 횟수(획의 수 - 1)
 */
export function strokePlan(figure) {
  const problem = checkFigure(figure);
  if (problem) throw new Error(`그림이 규격에 맞지 않아요: ${problem}`);
  const degrees = degreesOf(figure);
  const plan = [];
  for (const piece of piecesOf(figure)) {
    const odd = piece.filter((point) => degrees[point] % 2 === 1);
    const fake = [];
    for (let at = 0; at < odd.length; at += 2) fake.push([odd[at], odd[at + 1]]);
    const real = figure.edges.length;
    const tour = tourOf(figure.points.length, [...figure.edges, ...fake], odd[0] ?? piece[0]);
    if (fake.length === 0) {
      plan.push(tour.points);
      continue;
    }
    // 가짜 선 하나 바로 뒤에서 시작하도록 돌려 놓고(한 바퀴 도는 차례라 돌려도 된다), 가짜 선마다 끊는다.
    const steps = tour.edges.length;
    const turnAt = tour.edges.findIndex((edge) => edge >= real);
    let stroke = [tour.points[turnAt + 1]];
    for (let k = 1; k < steps; k++) {
      const at = (turnAt + k) % steps;
      const next = tour.points[at + 1];
      if (tour.edges[at] >= real) {
        plan.push(stroke);
        stroke = [next];
      } else stroke.push(next);
    }
    plan.push(stroke);
  }
  // 긴 획부터 적는다(풀이에서 큰 덩어리를 먼저 긋는 것이 보기 쉽다). 길이가 같으면 찾은 차례대로.
  plan.sort((x, y) => y.length - x.length);
  return { strokes: plan.length, lifts: Math.max(0, plan.length - 1), plan };
}

/**
 * 여러 번에 나눠 그은 것(획의 목록)을 따라가 본다. 획마다 지나는 점의 차례를 적는다.
 * 맨 뒤의 획만 비어 있거나 점 하나뿐일 수 있다(펜을 뗐거나, 막 댔다). 앞의 획은 선이 하나 이상 있다.
 * @returns {{ok, used: number[], strokeOf: (number|null)[], at: number|null, left, open: number[], stuck, complete, lifts: number}}
 *   strokeOf 선마다 몇 번째 획(0부터)으로 그었는가(긋지 않았으면 null)
 *   at       펜이 있는 점(펜을 뗐으면 null)
 *   open     펜이 있으면 이어서 갈 수 있는 점, 뗐으면 아직 긋지 않은 선이 있는 점
 *   stuck    펜이 있는 점에서 더 갈 선이 없는데 선이 남아 있다(펜을 떼야 한다)
 *   lifts    펜을 뗀 횟수(획의 수 - 1)
 */
export function walkStrokes(figure, strokes) {
  const total = figure.edges.length;
  const fail = { ok: false, used: [], strokeOf: figure.edges.map(() => null), at: null, left: total, open: [], stuck: false, complete: false, lifts: 0 };
  if (!Array.isArray(strokes) || !strokes.every(Array.isArray)) return fail;
  const used = [];
  const taken = new Set();
  const strokeOf = figure.edges.map(() => null);
  for (let index = 0; index < strokes.length; index++) {
    const stroke = strokes[index];
    if (stroke.length < 2 && index < strokes.length - 1) return fail;
    if (stroke.some((point) => !Number.isInteger(point) || point < 0 || point >= figure.points.length)) return fail;
    for (let step = 1; step < stroke.length; step++) {
      const edge = edgeIndex(figure, stroke[step - 1], stroke[step], taken);
      if (edge < 0) return fail;
      used.push(edge);
      taken.add(edge);
      strokeOf[edge] = index;
    }
  }
  const last = strokes.at(-1);
  const at = last && last.length > 0 ? last.at(-1) : null;
  const left = total - used.length;
  let open;
  if (at === null) {
    const free = new Set();
    figure.edges.forEach(([a, b], index) => {
      if (taken.has(index)) return;
      free.add(a);
      free.add(b);
    });
    open = [...free].sort((x, y) => x - y);
  } else open = openFrom(figure, taken, at);
  return {
    ok: true,
    used,
    strokeOf,
    at,
    left,
    open,
    stuck: at !== null && left > 0 && open.length === 0,
    complete: left === 0 && total > 0,
    lifts: Math.max(0, strokes.length - 1),
  };
}

// ---- 선의 자리: 선이 다른 점 위를 지나거나 선끼리 엇갈리면 그곳이 점처럼 보인다 ----

const turn = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
const between = (a, b, p) => Math.min(a[0], b[0]) <= p[0] && p[0] <= Math.max(a[0], b[0]) && Math.min(a[1], b[1]) <= p[1] && p[1] <= Math.max(a[1], b[1]);

/** 두 선분이 만나는가(끝이 닿는 것도 만나는 것으로 본다) */
export function segmentsMeet(p1, p2, p3, p4) {
  const d1 = turn(p3, p4, p1);
  const d2 = turn(p3, p4, p2);
  const d3 = turn(p1, p2, p3);
  const d4 = turn(p1, p2, p4);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  if (d1 === 0 && between(p3, p4, p1)) return true;
  if (d2 === 0 && between(p3, p4, p2)) return true;
  if (d3 === 0 && between(p1, p2, p3)) return true;
  if (d4 === 0 && between(p1, p2, p4)) return true;
  return false;
}

/** 점 p에서 선분 ab까지의 거리 */
export function distanceToSegment(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** 두 점을 잇는 선이 다른 점 위를(또는 바짝 붙어) 지나는가 */
export function passesPoint(points, a, b) {
  return points.some((point, index) => index !== a && index !== b && distanceToSegment(point, points[a], points[b]) < NEAR);
}

/** 두 점을 잇는 선이 이미 있는 선과 엇갈리는가(한 끝을 같이 쓰는 선은 엇갈리지 않는다) */
export function crossesEdge(figure, a, b) {
  const { points } = figure;
  return figure.edges.some(([p, q]) => {
    if (p === a || p === b || q === a || q === b) return false;
    return segmentsMeet(points[a], points[b], points[p], points[q]);
  });
}

/**
 * 두 점 사이에 선을 새로 그을 수 있는가. 되면 null, 안 되면 까닭의 열쇠:
 * 'same'(같은 점) | 'exists'(벌써 이어져 있다) | 'over-point'(다른 점 위를 지난다) | 'crossing'(다른 선과 엇갈린다)
 */
export function canAddEdge(figure, a, b) {
  if (a === b) return 'same';
  if (edgeIndex(figure, a, b) >= 0) return 'exists';
  if (passesPoint(figure.points, a, b)) return 'over-point';
  if (crossesEdge(figure, a, b)) return 'crossing';
  return null;
}

/** 그림의 모든 선이 자리 규칙에 맞는가(다른 점 위를 지나지 않고, 선끼리 엇갈리지 않는다) */
export function isTidy(figure) {
  return figure.edges.every(([a, b], index) => {
    if (passesPoint(figure.points, a, b)) return false;
    const others = { points: figure.points, edges: figure.edges.filter((_, at) => at !== index) };
    return !crossesEdge(others, a, b);
  });
}

const sortEdges = (edges) => edges.map(([a, b]) => (a < b ? [a, b] : [b, a])).sort((x, y) => x[0] - y[0] || x[1] - y[1]);

/**
 * 그림을 한 군데 고친 새 그림을 돌려준다(원래 그림은 그대로 둔다).
 * @param {{type: 'add'|'remove', edge: [number, number]}} edit
 */
export function applyEdit(figure, edit) {
  const [a, b] = edit.edge;
  if (edit.type === 'add') {
    if (edgeIndex(figure, a, b) >= 0) throw new Error('벌써 있는 선이에요');
    return { points: figure.points, edges: sortEdges([...figure.edges, [a, b]]) };
  }
  if (edit.type === 'remove') {
    const at = edgeIndex(figure, a, b);
    if (at < 0) throw new Error('없는 선이에요');
    return { points: figure.points, edges: figure.edges.filter((_, index) => index !== at) };
  }
  throw new Error('고치는 방법이 맞지 않아요');
}

/** 그림을 한 군데 고치는 방법을 모두 낸다: 선 하나 빼기, 그을 수 있는 자리에 선 하나 더하기 */
export function editsOf(figure) {
  const edits = figure.edges.map(([a, b]) => ({ type: 'remove', edge: [Math.min(a, b), Math.max(a, b)] }));
  for (let a = 0; a < figure.points.length; a++) {
    for (let b = a + 1; b < figure.points.length; b++) {
      if (canAddEdge(figure, a, b) === null) edits.push({ type: 'add', edge: [a, b] });
    }
  }
  return edits;
}

/** 한 군데 고쳐서 되는 그림으로 만드는 방법을 모두 낸다. 고친 그림을 하나하나 풀이 프로그램으로 확인한다. */
export function fixesOf(figure) {
  return editsOf(figure).filter((edit) => {
    const fixed = applyEdit(figure, edit);
    return fixed.edges.length > 0 && solve(fixed).possible;
  });
}

/**
 * 답을 견주고, 틀렸으면 무엇을 놓쳤을지 짐작한 열쇠를 돌려준다.
 * @param {'draw'|'judge'|'start'|'fix'|'bridge'|'twin'} mode 판의 종류(다리 건너기는 긋기와 같다)
 * @param {object} figure 처음 그림
 * @param {object} answer 아이의 답
 *   { kind: 'traced' }                 끝까지 그었다(고친 그림이면 고친 그림을)
 *   { kind: 'impossible' }             "불가능해요"
 *   { kind: 'judge', value: boolean }  "돼요"(true) / "안 돼요"(false)
 *   { kind: 'start', point: number }   시작점
 *   { kind: 'fix', edit }              고친 것
 *   { kind: 'twin', side }             닮은 두 그림에서 고른 쪽('left' | 'right')
 * @param {{startsTried?: number[], strokes?: number}} tried 지금까지 해 본 것
 * @returns {{correct: boolean, guess: string|null}}
 *   guess: 'impossible-no-try'        되는 그림에 "불가능해요". 한 번도 긋지 않았다
 *          'impossible-untried-start' 되는 그림에 "불가능해요". 될 시작점에서는 아직 시작해 보지 않았다
 *          'impossible-other-route'   되는 그림에 "불가능해요". 될 시작점에서 시작은 해 봤다
 *          'judge-no-on-possible'     되는 그림을 안 된다고 골랐다
 *          'judge-yes-on-impossible'  안 되는 그림을 된다고 골랐다
 *          'start-wrong'              끝까지 갈 수 없는 시작점을 골랐다
 *          'fix-split'                고친 그림이 두 덩어리로 나뉘었다
 *          'fix-still-impossible'     고친 그림이 아직 안 된다
 *          'twin-wrong'               닮은 두 그림에서 끝까지 그을 수 없는 쪽을 골랐다
 */
export function diagnose(mode, figure, answer, tried = {}) {
  const right = { correct: true, guess: null };
  const wrong = (guess) => ({ correct: false, guess });
  if (answer.kind === 'traced') return right;
  const solution = solve(figure);
  if (answer.kind === 'impossible') {
    if (!solution.possible) return right;
    const starts = tried.startsTried ?? [];
    if ((tried.strokes ?? 0) === 0 && starts.length === 0) return wrong('impossible-no-try');
    if (starts.some((point) => solution.starts.includes(point))) return wrong('impossible-other-route');
    return wrong('impossible-untried-start');
  }
  if (mode === 'judge' && answer.kind === 'judge' && typeof answer.value === 'boolean') {
    if (answer.value === solution.possible) return right;
    return wrong(solution.possible ? 'judge-no-on-possible' : 'judge-yes-on-impossible');
  }
  if (mode === 'start' && answer.kind === 'start' && Number.isInteger(answer.point)) {
    return solution.starts.includes(answer.point) ? right : wrong('start-wrong');
  }
  if (mode === 'twin' && answer.kind === 'twin' && (answer.side === 'left' || answer.side === 'right')) {
    return solve(sideOf(figure, answer.side)).possible ? right : wrong('twin-wrong');
  }
  if (mode === 'fix' && answer.kind === 'fix' && answer.edit) {
    const fixed = applyEdit(figure, answer.edit);
    if (fixed.edges.length === 0) return wrong('fix-still-impossible');
    const result = solve(fixed);
    if (result.possible) return right;
    return wrong(result.pieces > 1 ? 'fix-split' : 'fix-still-impossible');
  }
  throw new Error('답의 꼴이 맞지 않아요');
}
