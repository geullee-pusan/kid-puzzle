// 엉킨 그림 풀기의 그림을 그린다. 점은 손가락으로 끌어 옮기고, 놓으면 숨은 고운 격자의 가장 가까운 자리에 붙는다.
// 색만으로 알리지 않는다: 겹친 곳에는 굵은 고리를, 점이 선 위에 놓인 곳에는 그 점에 큰 고리를 두르고,
// 빼 둔 선은 점선으로, "고리 하나 보기"의 고리와 뼈대의 선은 굵게, 뼈대의 갈림점은 두 겹 고리로, 다리는 난간 두 줄로 그린다.
// 집, 우물, 마을은 모양(지붕이 있는 집, 가운데가 빈 동그라미, 네모)으로 가른다. 글자는 대본에서 받는다.
// 그림 그리는 일만 한다. 점을 옮겨도 되는지(다른 점이 있는 자리)는 여기서 막고, 옮긴 뒤의 일은 형식이 한다.
import { GRID_H, GRID_W, canPlace, problemsOf } from '../core/untangle.js';

const NS = 'http://www.w3.org/2000/svg';
const UNIT = 40; // 격자 한 칸
const PAD = 34; // 그림 둘레의 여백
const DOT = 15; // 점의 반지름
const SMALL_SCALE = 1.6; // 작은 그림에서는 선과 점을 이만큼 굵게 그린다
const REACH_PX = 34; // 점이나 선을 누른 것으로 보는 화면 거리(손가락)
const TAP_PX = 8; // 이보다 덜 움직였으면 끈 것이 아니라 누른 것이다

const boards = new WeakMap();

function make(tag, attrs = {}, className = '') {
  const node = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  if (className) node.setAttribute('class', className);
  return node;
}

const place = (point) => [point[0] * UNIT, point[1] * UNIT];

function distanceToSegment(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** 화면의 자리를 그림 안의 자리로 바꾼다 */
function locate(svg, event) {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  const spot = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  return [spot.x, spot.y];
}

/** 화면 1픽셀이 그림 안에서 몇인가 */
function perPixel(svg) {
  const matrix = svg.getScreenCTM();
  return matrix && matrix.a > 0 ? 1 / matrix.a : 1;
}

/** 그림 안의 자리 → 가장 가까운 격자 자리(격자 밖이면 가장자리로) */
const snap = (spot) => [Math.max(0, Math.min(GRID_W, Math.round(spot[0] / UNIT))), Math.max(0, Math.min(GRID_H, Math.round(spot[1] / UNIT)))];

function nearestPoint(points, spot, reach) {
  let best = null;
  let bestDistance = reach;
  points.forEach((point, index) => {
    const [x, y] = place(point);
    const distance = Math.hypot(spot[0] - x, spot[1] - y);
    if (distance <= bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

function nearestEdge(points, edges, spot, reach) {
  let best = null;
  let bestDistance = reach;
  edges.forEach(([a, b], index) => {
    const distance = distanceToSegment(spot, place(points[a]), place(points[b]));
    if (distance <= bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

// ---- 굽은 선(설명 그림에만 쓴다): 겹친 곳은 잘게 나눈 꺾은선으로 찾는다 ----

function curvePoints(a, b, control, pieces = 32) {
  const out = [];
  for (let step = 0; step <= pieces; step++) {
    const t = step / pieces;
    out.push([(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * control[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * control[1] + t * t * b[1]]);
  }
  return out;
}

function segmentHit(p1, p2, p3, p4) {
  const r = [p2[0] - p1[0], p2[1] - p1[1]];
  const s = [p4[0] - p3[0], p4[1] - p3[1]];
  const denom = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(denom) < 1e-12) return null;
  const t = ((p3[0] - p1[0]) * s[1] - (p3[1] - p1[1]) * s[0]) / denom;
  const u = ((p3[0] - p1[0]) * r[1] - (p3[1] - p1[1]) * r[0]) / denom;
  if (t <= 1e-9 || t >= 1 - 1e-9 || u <= 1e-9 || u >= 1 - 1e-9) return null;
  return [p1[0] + t * r[0], p1[1] + t * r[1]];
}

/** 굽은 선이 있는 그림에서 끝을 같이 쓰지 않는 두 선이 엇갈린 곳들 */
export function bentCrossings(points, edges, bends = {}, off = []) {
  const lines = edges.map(([a, b], index) => (bends[index] ? curvePoints(points[a], points[b], bends[index]) : [points[a], points[b]]));
  const found = [];
  for (let i = 0; i < edges.length; i++) {
    if (off.includes(i)) continue;
    for (let j = i + 1; j < edges.length; j++) {
      if (off.includes(j)) continue;
      const [a, b] = edges[i];
      const [c, d] = edges[j];
      if (a === c || a === d || b === c || b === d) continue;
      for (let s = 1; s < lines[i].length; s++) {
        for (let t = 1; t < lines[j].length; t++) {
          const hit = segmentHit(lines[i][s - 1], lines[i][s], lines[j][t - 1], lines[j][t]);
          if (hit && !found.some((other) => Math.hypot(other.at[0] - hit[0], other.at[1] - hit[1]) < 0.05)) found.push({ edges: [i, j], at: hit });
        }
      }
    }
  }
  return found;
}

// ---- 그림판 ----

/** 그릴 자리에 그림판을 한 번 만들어 둔다. 손가락을 끄는 동안에도 판이 바뀌지 않게, 안의 것만 바꿔 그린다. */
function boardOf(root) {
  let board = boards.get(root);
  if (board && board.svg.parentNode === root) return board;
  const svg = make('svg', { preserveAspectRatio: 'xMidYMid meet' });
  board = { svg, view: null, drag: null };
  boards.set(root, board);

  svg.addEventListener('pointerdown', (event) => {
    const view = board.view;
    if (!view || !view.live || board.drag) return;
    const spot = locate(svg, event);
    if (!spot) return;
    const reach = REACH_PX * perPixel(svg);
    const point = nearestPoint(view.points, spot, Math.max(reach, DOT * 1.6));
    if (point !== null) {
      event.preventDefault();
      board.drag = { id: event.pointerId, dot: point, from: view.points[point], at: view.points[point], x: event.clientX, y: event.clientY, moved: false };
      try {
        svg.setPointerCapture(event.pointerId);
      } catch {
        // 붙잡지 못해도 끄는 것은 그대로 된다.
      }
      render(board, view);
      return;
    }
    const edge = view.onEdge ? nearestEdge(view.points, view.edges, spot, reach * 0.8) : null;
    if (edge !== null) {
      event.preventDefault();
      view.onEdge(edge);
      return;
    }
    if (view.onEmpty) {
      const at = snap(spot);
      if (canPlace(view.points, -1, at)) {
        event.preventDefault();
        view.onEmpty(at);
      }
    }
  });
  svg.addEventListener('pointermove', (event) => {
    const drag = board.drag;
    if (!drag || drag.id !== event.pointerId || !board.view) return;
    if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > TAP_PX) drag.moved = true;
    if (!drag.moved || board.view.fixed) return;
    const spot = locate(svg, event);
    if (!spot) return;
    const at = snap(spot);
    if (at[0] === drag.at[0] && at[1] === drag.at[1]) return;
    if (!canPlace(board.view.points, drag.dot, at)) return;
    drag.at = at;
    render(board, board.view);
  });
  const release = (event, cancel) => {
    const drag = board.drag;
    if (!drag || drag.id !== event.pointerId) return;
    board.drag = null;
    const view = board.view;
    if (!view) return;
    const changed = drag.at[0] !== drag.from[0] || drag.at[1] !== drag.from[1];
    if (!cancel && changed && view.onMove) view.onMove(drag.dot, drag.at);
    else {
      if (!cancel && !drag.moved && view.onPoint) view.onPoint(drag.dot);
      render(board, view);
    }
  };
  svg.addEventListener('pointerup', (event) => release(event, false));
  svg.addEventListener('pointercancel', (event) => release(event, true));
  // 글자판: 점에서 화살표로 한 칸씩 옮기고, 들이기나 빈칸으로 누른다. 선에서는 누른다.
  svg.addEventListener('keydown', (event) => {
    const view = board.view;
    const target = event.target.closest?.('[data-point], [data-edge]');
    if (!view || !view.live || !target) return;
    if (target.dataset.edge !== undefined) {
      if ((event.key === 'Enter' || event.key === ' ') && view.onEdge) {
        event.preventDefault();
        view.onEdge(Number(target.dataset.edge));
      }
      return;
    }
    const dot = Number(target.dataset.point);
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (step && view.onMove && !view.fixed) {
      event.preventDefault();
      const from = view.points[dot];
      const to = [from[0] + step[0], from[1] + step[1]];
      if (canPlace(view.points, dot, to)) view.onMove(dot, to);
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && view.onPoint) {
      event.preventDefault();
      view.onPoint(dot);
    }
  });
  root.replaceChildren(svg);
  return board;
}

/** 이야기 옷의 모양: 집(지붕이 있는 네모), 우물(가운데가 빈 동그라미), 마을(네모 안의 문) */
function roleShape(role, x, y, k) {
  const group = make('g', {}, `tangle-role ${role}`);
  const s = 17 * k;
  if (role === 'house') {
    group.append(make('polygon', { points: [[x - s, y + s], [x + s, y + s], [x + s, y - s * 0.15], [x, y - s * 1.15], [x - s, y - s * 0.15]].map((p) => p.join(',')).join(' '), 'stroke-width': 4 * k }));
  } else if (role === 'well') {
    group.append(make('circle', { cx: x, cy: y, r: s, 'stroke-width': 4 * k }));
    group.append(make('circle', { cx: x, cy: y, r: s * 0.45, 'stroke-width': 4 * k }, 'inner'));
  } else {
    group.append(make('rect', { x: x - s, y: y - s, width: 2 * s, height: 2 * s, rx: 3 * k, 'stroke-width': 4 * k }));
    group.append(make('rect', { x: x - s * 0.35, y: y + s * 0.1, width: s * 0.7, height: s * 0.9, 'stroke-width': 3 * k }, 'inner'));
  }
  return group;
}

/** 다리: 위로 지나가는 선 조각과 그 양옆의 난간 두 줄 */
function bridgeShape(a, b, at, k) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const half = 26 * k;
  const side = 11 * k;
  const group = make('g', {}, 'tangle-bridge');
  const from = [at[0] - ux * half, at[1] - uy * half];
  const to = [at[0] + ux * half, at[1] + uy * half];
  group.append(make('line', { x1: from[0], y1: from[1], x2: to[0], y2: to[1], 'stroke-width': 24 * k }, 'deck'));
  group.append(make('line', { x1: from[0], y1: from[1], x2: to[0], y2: to[1], 'stroke-width': 7 * k }, 'road'));
  for (const sign of [-1, 1]) {
    const ox = -uy * side * sign;
    const oy = ux * side * sign;
    group.append(make('line', { x1: from[0] + ox, y1: from[1] + oy, x2: to[0] + ox, y2: to[1] + oy, 'stroke-width': 4 * k }, 'rail'));
  }
  return group;
}

/** 그림판 안을 다시 그린다. 끄는 중이면 끄는 점을 끄는 자리에 그린다. */
function render(board, view) {
  const { svg } = board;
  const { edges, roles = null, off = [], loop = [], core = null, picked = [], bends = {}, small = false, bridges = 0 } = view;
  const drag = board.drag;
  const points = drag ? view.points.map((point, index) => (index === drag.dot ? drag.at : point)) : view.points;
  const k = small ? SMALL_SCALE : 1;
  const focused = svg.contains(document.activeElement) ? document.activeElement.dataset : null;

  // 그림의 테두리: 놀이 판은 격자 전체(끄는 동안 판이 흔들리지 않게), 보기만 하는 그림은 점들에 맞춘다.
  let box;
  if (view.fit && points.length > 0) {
    const spots = points.map(place);
    const xs = spots.map((spot) => spot[0]);
    const ys = spots.map((spot) => spot[1]);
    // 굽은 선이 그림 밖으로 나가지 않게 굽은 선 위의 자리도 넣는다
    for (const [index, control] of Object.entries(bends)) {
      const [a, b] = edges[Number(index)];
      for (const spot of curvePoints(points[a], points[b], control, 8).map(place)) {
        xs.push(spot[0]);
        ys.push(spot[1]);
      }
    }
    const pad = PAD * k + 10;
    box = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) - Math.min(...xs) + 2 * pad, Math.max(...ys) - Math.min(...ys) + 2 * pad];
  } else box = [-PAD, -PAD, GRID_W * UNIT + 2 * PAD, GRID_H * UNIT + 2 * PAD];
  svg.setAttribute('viewBox', box.join(' '));
  svg.setAttribute('class', 'tangle-svg');
  if (view.live) svg.removeAttribute('aria-hidden');
  else svg.setAttribute('aria-hidden', 'true');

  const spots = points.map(place);
  const nodes = [];
  const loopSet = new Set(loop);
  const coreEdges = new Set(core?.edges ?? []);
  const corePoints = new Set(core?.points ?? []);

  // 선: 빼 둔 선은 점선, 고리와 뼈대의 선은 굵게
  const offNodes = [];
  edges.forEach(([a, b], index) => {
    const names = ['tangle-edge'];
    if (off.includes(index)) names.push('off');
    if (loopSet.has(index)) names.push('loop');
    if (coreEdges.has(index)) names.push('core');
    const width = (loopSet.has(index) || coreEdges.has(index) ? 11 : 6) * k;
    let line;
    if (bends[index]) {
      const control = place(bends[index]);
      line = make('path', { d: `M ${spots[a][0]} ${spots[a][1]} Q ${control[0]} ${control[1]} ${spots[b][0]} ${spots[b][1]}`, 'stroke-width': width }, names.join(' '));
    } else line = make('line', { x1: spots[a][0], y1: spots[a][1], x2: spots[b][0], y2: spots[b][1], 'stroke-width': width }, names.join(' '));
    if (view.live && view.onEdge) {
      line.setAttribute('data-edge', index);
      line.setAttribute('tabindex', '0');
      line.setAttribute('role', 'button');
      if (view.edgeLabel) line.setAttribute('aria-label', view.edgeLabel(index, off.includes(index)));
    }
    // 빼 둔 선은 다른 선과 포개져도 보이게 맨 위에 그린다
    if (off.includes(index)) offNodes.push(line);
    else nodes.push(line);
  });
  nodes.push(...offNodes);

  // 겹친 곳
  const problems = view.marks === false ? { crossings: [], touches: [] } : Object.keys(bends).length > 0 ? { crossings: bentCrossings(points, edges, bends, off), touches: [] } : problemsOf(points, edges, off);
  const asBridge = bridges > 0 && problems.touches.length === 0 && problems.crossings.length <= bridges;
  for (const cross of problems.crossings) {
    const at = place(cross.at);
    if (asBridge) {
      const [a, b] = edges[cross.edges[0]];
      nodes.push(bridgeShape(spots[a], spots[b], at, k));
    } else nodes.push(make('circle', { cx: at[0], cy: at[1], r: 15 * k, 'stroke-width': 5 * k }, 'tangle-cross'));
  }
  for (const touch of problems.touches) {
    const [x, y] = spots[touch.point];
    nodes.push(make('circle', { cx: x, cy: y, r: 27 * k, 'stroke-width': 5 * k }, 'tangle-cross touch'));
  }

  // 점
  spots.forEach(([x, y], index) => {
    const names = ['tangle-point'];
    if (drag && drag.dot === index) names.push('dragging');
    const group = make('g', { 'data-point': index });
    if (corePoints.has(index)) {
      group.append(make('circle', { cx: x, cy: y, r: 34 * k, 'stroke-width': 4 * k }, 'tangle-ring core'));
      group.append(make('circle', { cx: x, cy: y, r: 26 * k, 'stroke-width': 4 * k }, 'tangle-ring core'));
    }
    if (picked.includes(index)) group.append(make('circle', { cx: x, cy: y, r: 28 * k, 'stroke-width': 7 * k }, 'tangle-ring picked'));
    if (drag && drag.dot === index) group.append(make('circle', { cx: x, cy: y, r: 30 * k, 'stroke-width': 4 * k }, 'tangle-ring held'));
    if (roles) group.append(roleShape(roles[index], x, y, k));
    else group.append(make('circle', { cx: x, cy: y, r: DOT * (small ? 1.25 : 1), 'stroke-width': 5 * k }, 'tangle-dot'));
    group.setAttribute('class', names.join(' '));
    if (view.live) {
      group.setAttribute('tabindex', '0');
      group.setAttribute('role', 'button');
      if (view.label) group.setAttribute('aria-label', view.label(index));
    }
    nodes.push(group);
  });

  svg.replaceChildren(...nodes);
  if (focused) {
    const again = focused.point !== undefined ? svg.querySelector(`[data-point="${focused.point}"]`) : focused.edge !== undefined ? svg.querySelector(`[data-edge="${focused.edge}"]`) : null;
    again?.focus?.();
  }
}

/**
 * 그림을 그린다.
 * @param {HTMLElement} root 그릴 자리(안의 것을 모두 바꾼다)
 * @param {object} view
 *   points   점의 자리(격자 칸)
 *   edges    선(점 번호 둘)
 *   roles    점마다의 옷('house' | 'well' | 'town'). 없으면 그냥 점
 *   off      빼 둔 선의 번호(점선. 겹친 곳에 넣지 않는다)
 *   loop     굵게 그릴 고리의 선 번호
 *   core     { edges, points } 굵게 그릴 뼈대의 선과 두 겹 고리를 두를 갈림점
 *   picked   골라 둔 점들(굵은 고리)
 *   bridges  다리의 수. 엇갈린 곳이 이 수 이하면 엇갈린 곳을 다리로 그린다
 *   bends    { 선 번호: [가로, 세로] } 굽혀 그릴 선과 굽는 자리(설명 그림)
 *   marks    false면 겹친 곳을 그리지 않는다
 *   live     누르고 끌 수 있는 그림
 *   fixed    true면 끌어도 점이 움직이지 않는다(누르기만 받는다)
 *   fit      true면 점들에 맞춰 그림의 테두리를 잡는다(보기만 하는 그림)
 *   small    작은 그림으로 그린다(선과 점을 굵게)
 *   label    (점 번호) → 읽어 줄 이름,  edgeLabel (선 번호, 빠졌는가) → 읽어 줄 이름
 *   onMove   (점 번호, 새 자리) → 점을 끌어 다른 자리에 놓았을 때
 *   onPoint  (점 번호) → 점을 누르기만 했을 때
 *   onEdge   (선 번호) → 선을 눌렀을 때
 *   onEmpty  (격자 자리) → 빈 곳을 눌렀을 때
 */
export function drawTangle(root, view) {
  root.className = `tangle${view.small ? ' small' : ''}${view.live ? ' live' : ''}`;
  const board = boardOf(root);
  board.view = view;
  render(board, view);
}

/** 그림 하나를 담은 새 조각을 만든다(풀이와 "왜 그럴까?"의 그림). 아래에 한 줄 글을 붙일 수 있다. big이면 크게 그린다. */
export function tangleCard(view, note, big = false) {
  const card = document.createElement('div');
  card.className = big ? 'figure-card tangle-card big' : 'figure-card tangle-card';
  const picture = document.createElement('div');
  card.append(picture);
  drawTangle(picture, { fit: true, ...view });
  if (note) {
    const line = document.createElement('p');
    line.className = 'strip-note';
    line.textContent = note;
    card.append(line);
  }
  return card;
}
