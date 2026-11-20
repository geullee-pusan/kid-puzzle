// 세모 피하기의 판을 그린다: 원 위의 점들, 점 사이의 선(빨간 실선, 파란 점선), 없는 선의 가위표, 한 색 세모.
// 누를 수 있는 판과 보기만 하는 그림을 같은 모양으로 그린다.
// 색만으로 알리지 않는다. 빨간 선은 굵은 실선, 파란 선은 굵은 점선이다. 처음부터 그어 둔 선에는 넓은 회색 테두리를 두르고,
// 선이 없는 두 점 사이에는 가는 회색 점선과 가운데의 가위표를 그린다. 한 색 세모는 세모 안을 옅게 칠하고 둘레에 넓은 띠를 두른다.
// 방금 그은 선에는 넓은 금빛 띠를, 골라 둔 점에는 굵은 고리를 두른다. 글자는 대본에서 받는다.
// 누르는 것은 pointer 이벤트로 받는다. 한 점에서 다른 점으로 끌고 손을 떼면 두 점을 알려 주고, 한 점만 누르면 그 점을 알려 준다.
import { tableOf } from '../core/sim.js';

const NS = 'http://www.w3.org/2000/svg';
const SIZE = 400; // 그림의 한 변
const RADIUS = 150; // 점들이 놓인 원의 반지름
const DOT = 17; // 점의 반지름
const REACH = 46; // 점을 누른 것으로 보는 거리(그림 안의 길이)
const TAP_PX = 10; // 화면에서 이보다 덜 움직였으면 끈 것이 아니라 누른 것이다

const boards = new WeakMap();

function make(tag, attrs = {}, className = '') {
  const node = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  if (className) node.setAttribute('class', className);
  return node;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** 점 i의 자리: 맨 위에서부터 시계 방향으로 고르게 */
export function spotOf(n, point) {
  const angle = -Math.PI / 2 + (2 * Math.PI * point) / n;
  return [SIZE / 2 + RADIUS * Math.cos(angle), SIZE / 2 + RADIUS * Math.sin(angle)];
}

/** 화면의 자리를 그림 안의 자리로 */
function locate(svg, event) {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  const spot = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  return [spot.x, spot.y];
}

/** 가장 가까운 점(REACH 안). 없으면 null */
function pointAt(n, spot) {
  let best = null;
  let distance = REACH;
  for (let point = 0; point < n; point++) {
    const [x, y] = spotOf(n, point);
    const far = Math.hypot(spot[0] - x, spot[1] - y);
    if (far <= distance) {
      best = point;
      distance = far;
    }
  }
  return best;
}

const isLive = (view) => Boolean(view.onPair || view.onTap);

/** 끄는 동안 손가락까지 긋는 가는 선 */
function drawTrace(board) {
  const { view, press, traceLayer } = board;
  if (!press || !press.moved || !press.at) {
    traceLayer.replaceChildren();
    return;
  }
  const [x1, y1] = spotOf(view.n, press.from);
  const [x2, y2] = press.over !== null ? spotOf(view.n, press.over) : press.at;
  traceLayer.replaceChildren(make('line', { x1, y1, x2, y2 }, 'sim-trace'));
}

/** 그릴 자리에 판을 한 번 만들어 둔다. 손가락으로 끄는 동안에도 판이 바뀌지 않게, 안의 것만 바꿔 그린다. */
function boardOf(root) {
  let board = boards.get(root);
  if (board && board.svg.parentNode === root) return board;
  const svg = make('svg', { viewBox: `0 0 ${SIZE} ${SIZE}`, preserveAspectRatio: 'xMidYMid meet' }, 'sim-svg');
  const mainLayer = make('g');
  const traceLayer = make('g');
  svg.append(mainLayer, traceLayer);
  board = { svg, mainLayer, traceLayer, view: null, press: null };
  boards.set(root, board);

  const letGo = () => {
    board.press = null;
    drawTrace(board);
  };

  svg.addEventListener('pointerdown', (event) => {
    const view = board.view;
    if (!view || !isLive(view)) return;
    const spot = locate(svg, event);
    const point = spot ? pointAt(view.n, spot) : null;
    if (point === null) return;
    event.preventDefault();
    board.press = { id: event.pointerId, from: point, over: null, at: spot, x: event.clientX, y: event.clientY, moved: false };
    try {
      svg.setPointerCapture(event.pointerId);
    } catch {
      // 붙잡지 못해도 누르는 것은 그대로 된다.
    }
  });
  svg.addEventListener('pointermove', (event) => {
    const { press, view } = board;
    if (!press || !view || press.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > TAP_PX) press.moved = true;
    if (!press.moved) return;
    const spot = locate(svg, event);
    if (!spot) return;
    const over = pointAt(view.n, spot);
    press.at = spot;
    press.over = over !== null && over !== press.from ? over : null;
    drawTrace(board);
  });
  svg.addEventListener('pointerup', (event) => {
    const press = board.press;
    if (!press || press.id !== event.pointerId) return;
    const view = board.view;
    const spot = locate(svg, event);
    const end = view && spot ? pointAt(view.n, spot) : null;
    letGo();
    if (!view) return;
    if (press.moved && end !== null && end !== press.from) view.onPair?.([press.from, end]);
    else if (!press.moved || end === press.from) view.onTap?.(press.from);
  });
  svg.addEventListener('pointercancel', letGo);
  // 글자판으로도 점을 누를 수 있다.
  svg.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const view = board.view;
    const target = event.target.closest?.('[data-point]');
    if (!view || !isLive(view) || !target) return;
    event.preventDefault();
    view.onTap?.(Number(target.dataset.point));
  });
  root.replaceChildren(svg);
  return board;
}

/** 선 하나: 빨강은 굵은 실선, 파랑은 굵은 점선. 처음부터 그어 둔 선은 넓은 회색 테두리 위에 */
function lineNodes(n, item, k) {
  const [a, b] = tableOf(n).lines[item.line];
  const [x1, y1] = spotOf(n, a);
  const [x2, y2] = spotOf(n, b);
  const nodes = [];
  if (item.given) nodes.push(make('line', { x1, y1, x2, y2, 'stroke-width': 22 * k }, 'sim-given'));
  nodes.push(make('line', { x1, y1, x2, y2, 'stroke-width': 9 * k }, `sim-line ${item.color}`));
  return nodes;
}

/** 없는 선: 가는 회색 점선과 가운데의 가위표 */
function goneNodes(n, line, k) {
  const [a, b] = tableOf(n).lines[line];
  const [x1, y1] = spotOf(n, a);
  const [x2, y2] = spotOf(n, b);
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const s = 13 * k;
  const group = make('g', {}, 'sim-gone');
  group.append(make('line', { x1, y1, x2, y2, 'stroke-width': 3 * k }, 'sim-gone-line'));
  group.append(make('line', { x1: mx - s, y1: my - s, x2: mx + s, y2: my + s, 'stroke-width': 6 * k }, 'sim-gone-cross'));
  group.append(make('line', { x1: mx - s, y1: my + s, x2: mx + s, y2: my - s, 'stroke-width': 6 * k }, 'sim-gone-cross'));
  return group;
}

/** 한 색 세모: 안을 옅게 칠하고 둘레에 넓은 띠 */
function triangleNode(n, item, k) {
  const points = item.points.map((point) => spotOf(n, point).join(',')).join(' ');
  const group = make('g', {}, `sim-tri ${item.color}`);
  group.append(make('polygon', { points }, 'sim-tri-fill'));
  group.append(make('polygon', { points, 'stroke-width': 26 * k }, 'sim-tri-band'));
  return group;
}

/**
 * 판을 그린다.
 * @param {HTMLElement} root 그릴 자리(안의 것을 모두 바꾼다)
 * @param {object} view
 *   n         점의 수
 *   lines     그어진 선 { line, color: 'red' | 'blue', given }(given: 처음부터 그어 둔 선)
 *   gone      없는 선(선 번호)
 *   triangles 눈에 띄게 할 한 색 세모 { points, color }
 *   fresh     방금 그은 선(없으면 -1)
 *   pick      골라 둔 점(없으면 null). ring 고리를 두를 점들(설명 그림)
 *   label     (점 번호) → 읽어 줄 이름(누를 수 있는 판에서만)
 *   onPair    ([a, b]) → 한 점에서 다른 점으로 끌고 손을 뗐을 때
 *   onTap     (점 번호) → 점 하나를 눌렀을 때
 *   small     작은 그림으로 그린다(선과 점을 굵게)
 */
export function drawSim(root, view) {
  const { n, lines = [], gone = [], triangles = [], fresh = -1, pick = null, ring = [], small = false } = view;
  const live = isLive(view);
  const k = small ? 1.5 : 1;
  root.className = `sim-board${small ? ' small' : ''}${live ? ' live' : ''}`;
  const board = boardOf(root);
  const { svg } = board;
  const focused = svg.contains(document.activeElement) ? document.activeElement.dataset.point : undefined;
  if (live) svg.removeAttribute('aria-hidden');
  else svg.setAttribute('aria-hidden', 'true');

  const nodes = [];
  for (const item of triangles) nodes.push(triangleNode(n, item, k));
  for (const line of gone) nodes.push(goneNodes(n, line, k));
  const freshItem = lines.find((item) => item.line === fresh);
  if (freshItem) {
    const [a, b] = tableOf(n).lines[fresh];
    const [x1, y1] = spotOf(n, a);
    const [x2, y2] = spotOf(n, b);
    nodes.push(make('line', { x1, y1, x2, y2, 'stroke-width': 24 * k }, 'sim-fresh'));
  }
  for (const item of lines) nodes.push(...lineNodes(n, item, k));
  for (let point = 0; point < n; point++) {
    const [x, y] = spotOf(n, point);
    const group = make('g', { 'data-point': point }, 'sim-point');
    group.append(make('circle', { cx: x, cy: y, r: REACH }, 'sim-hit'));
    if (ring.includes(point)) group.append(make('circle', { cx: x, cy: y, r: 31 * Math.min(k, 1.2), 'stroke-width': 6 * k }, 'sim-ring'));
    if (pick === point) group.append(make('circle', { cx: x, cy: y, r: 30, 'stroke-width': 8 }, 'sim-pick'));
    group.append(make('circle', { cx: x, cy: y, r: DOT * (small ? 1.3 : 1), 'stroke-width': 5 }, 'sim-dot'));
    if (live && view.label) {
      group.setAttribute('tabindex', '0');
      group.setAttribute('role', 'button');
      group.setAttribute('aria-label', view.label(point));
    }
    nodes.push(group);
  }
  board.mainLayer.replaceChildren(...nodes);
  board.view = { ...view, n };
  board.press = null;
  drawTrace(board);
  if (focused !== undefined) svg.querySelector(`[data-point="${focused}"]`)?.focus?.();
}

/**
 * 판 하나를 담은 새 조각을 만든다(다시 보기, 풀이, "왜 그럴까?"의 그림).
 * @param {object} view drawSim에 건네는 것
 * @param {string} note 아래에 붙이는 글
 * @param {{big?: boolean}} options
 */
export function simCard(view, note, { big = false } = {}) {
  const card = el('div', big ? 'sim-card big' : 'sim-card');
  const picture = el('div');
  card.append(picture);
  drawSim(picture, { ...view, small: !big });
  if (note) card.append(el('p', 'strip-note', note));
  return card;
}

/** 칠할 색 단추에 붙이는 작은 그림(그 색의 선 모양) */
export function penIcon(color) {
  const svg = make('svg', { viewBox: '0 0 80 20', 'aria-hidden': 'true' }, 'sim-pen-icon');
  svg.append(make('line', { x1: 6, y1: 10, x2: 74, y2: 10, 'stroke-width': 8 }, `sim-line ${color}`));
  return svg;
}
