// 한붓그리기: 그림, 긋는 규칙, 풀이 프로그램, 그림 고치기, 오답 짐작.
// 순수 함수만 둔다. 화면에 손대지 않고, 무작위 수와 지금 시각을 쓰지 않는다. 같은 입력은 늘 같은 출력을 낸다.
//
// 그림(figure): { points, edges }
//   points  점의 자리. [가로, 세로]의 목록(격자 칸 단위)
//   edges   선. [점 번호, 점 번호]의 목록. 같은 두 점 사이에 선은 하나뿐이다
// 목표는 손을 떼지 않고 모든 선을 꼭 한 번씩 긋는 것이다. 같은 점은 여러 번 지나도 된다.

/** 한 그림에 놓을 수 있는 점과 선의 위 끝 */
export const MAX_POINTS = 10;
export const MAX_EDGES = 24;

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
  const seen = new Set();
  for (const edge of edges) {
    if (!Array.isArray(edge) || edge.length !== 2) return 'bad-edges';
    const [a, b] = edge;
    if (!Number.isInteger(a) || !Number.isInteger(b)) return 'bad-edges';
    if (a < 0 || b < 0 || a >= points.length || b >= points.length || a === b) return 'bad-edges';
    if (seen.has(edgeKey(a, b))) return 'bad-edges';
    seen.add(edgeKey(a, b));
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

/** 두 점을 잇는 선의 번호. 없으면 -1 */
export function edgeIndex(figure, a, b) {
  return figure.edges.findIndex(([p, q]) => (p === a && q === b) || (p === b && q === a));
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
  for (let step = 1; step < path.length; step++) {
    const edge = edgeIndex(figure, path[step - 1], path[step]);
    if (edge < 0 || used.includes(edge)) return fail;
    used.push(edge);
  }
  const at = path.at(-1);
  const open = [];
  figure.edges.forEach(([a, b], index) => {
    if (used.includes(index)) return;
    if (a === at) open.push(b);
    else if (b === at) open.push(a);
  });
  open.sort((x, y) => x - y);
  const left = total - used.length;
  return { ok: true, used, at, left, open, stuck: left > 0 && open.length === 0, complete: left === 0 && total > 0 };
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
 * @param {'draw'|'judge'|'start'|'fix'} mode 판의 종류
 * @param {object} figure 처음 그림
 * @param {object} answer 아이의 답
 *   { kind: 'traced' }                 끝까지 그었다(고친 그림이면 고친 그림을)
 *   { kind: 'impossible' }             "불가능해요"
 *   { kind: 'judge', value: boolean }  "돼요"(true) / "안 돼요"(false)
 *   { kind: 'start', point: number }   시작점
 *   { kind: 'fix', edit }              고친 것
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
  if (mode === 'fix' && answer.kind === 'fix' && answer.edit) {
    const fixed = applyEdit(figure, answer.edit);
    if (fixed.edges.length === 0) return wrong('fix-still-impossible');
    const result = solve(fixed);
    if (result.possible) return right;
    return wrong(result.pieces > 1 ? 'fix-split' : 'fix-still-impossible');
  }
  throw new Error('답의 꼴이 맞지 않아요');
}
