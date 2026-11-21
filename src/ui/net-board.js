// 그물 끊기의 판을 그린다: 매듭(점)과 줄(선). 끊긴 줄은 가운데가 비고 양 끝만 남은 가는 점선이다.
// 누를 수 있는 판과 보기만 하는 그림(작은 그림, 풀이, "왜 그럴까?", 직접 만들기의 선생님 그림)을 같은 모양으로 그린다.
// 색만으로 알리지 않는다. 그물이 갈라지면 갈라져 나간 조각마다 색과 함께 선의 모양(실선, 긴 점선, 짧은 점선, 선과 점 …)과
// 매듭의 모양(동그라미, 네모, 마름모, 세모)이 다르다. "고리 찾기"로 찾은 고리는 줄 밑에 넓은 금빛 점선 띠, 매듭에 점선 고리를 두른다.
// 줄을 누르는 것은 click으로 받는다(누른 자리에서 가장 가까운 줄, src/core/net.js의 stringAt). 줄이 가늘어서 줄 둘레의 넓은 곳을 누르면 된다.
// 글자판으로는 줄마다 Enter와 빈칸 글쇠로 누른다. 글자(읽어 주는 이름)는 형식이 대본에서 채워 건넨다.
import { boundsOf, piecesOf, stringAt } from '../core/net.js';

const NS = 'http://www.w3.org/2000/svg';
/** 칸 하나의 길이(그림 안의 길이) */
export const UNIT = 100;
/** 그물 둘레의 여백(칸 단위) */
export const PAD = 0.5;
const KNOT = 13; // 매듭의 반지름
const LINE = 7; // 줄의 굵기
const STUB = 0.36; // 끊긴 줄에서 양 끝에 남는 몫

/** 조각의 차례마다의 모양(차례대로 쓴다) */
export const STYLES = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5'];

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

/** 그림이 차지하는 칸(칸 단위). area가 있으면 그 칸을 쓴다(직접 만들기의 모눈) */
export function frameOf(board, area = null) {
  const box = area ?? boundsOf(board);
  return { x: box.minX - PAD, y: box.minY - PAD, w: box.maxX - box.minX + 2 * PAD, h: box.maxY - box.minY + 2 * PAD };
}

/**
 * 조각의 차례: 처음 조각(그물)마다, 그 그물에서 갈라져 나간 조각에 0, 1, 2, …(그물의 앞 번호 매듭이 든 조각이 0).
 * 갈라지지 않은 그물은 모두 0이라 같은 모양으로 그린다.
 */
export function shadesOf(board, cut) {
  const off = new Set(cut);
  const n = board.knots.length;
  const start = piecesOf(n, board.strings).label;
  const now = piecesOf(n, board.strings, (index) => !off.has(index)).label;
  const seen = new Map();
  return now.map((piece, knot) => {
    const net = start[knot];
    if (!seen.has(net)) seen.set(net, []);
    const list = seen.get(net);
    if (!list.includes(piece)) list.push(piece);
    return list.indexOf(piece);
  });
}

/** 화면의 자리를 칸 단위의 자리로 */
function locate(svg, event) {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  const spot = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  return [spot.x / UNIT, spot.y / UNIT];
}

/** 그릴 자리에 판을 한 번 만들어 둔다. 누르는 것은 판에 한 번만 잇고, 안의 것만 바꿔 그린다. */
function boardOf(root) {
  let board = boards.get(root);
  if (board && board.svg.parentNode === root) return board;
  const svg = make('svg', { preserveAspectRatio: 'xMidYMid meet' }, 'net-svg');
  board = { svg, view: null };
  boards.set(root, board);
  svg.addEventListener('click', (event) => {
    const view = board.view;
    const spot = locate(svg, event);
    if (!view || !spot) return;
    if (view.onSpot) {
      view.onSpot(spot);
      return;
    }
    if (!view.onString) return;
    const index = stringAt(view.board, spot);
    if (index !== null) view.onString(index);
  });
  // 글자판으로도 줄을 누를 수 있다.
  svg.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const view = board.view;
    const target = event.target.closest?.('[data-string]');
    if (!view?.onString || !target) return;
    event.preventDefault();
    view.onString(Number(target.dataset.string));
  });
  root.replaceChildren(svg);
  return board;
}

/** 매듭 하나: 조각의 차례마다 모양이 다르다(동그라미, 네모, 마름모, 세모) */
function knotNode([x, y], shade, size) {
  const r = KNOT * size;
  const className = `net-knot ${STYLES[shade % STYLES.length]}`;
  const shape = shade % 4;
  if (shape === 0) return make('circle', { cx: x, cy: y, r }, className);
  if (shape === 1) return make('rect', { x: x - r, y: y - r, width: 2 * r, height: 2 * r }, className);
  const points = shape === 2 ? [[x, y - 1.35 * r], [x + 1.35 * r, y], [x, y + 1.35 * r], [x - 1.35 * r, y]] : [[x, y - 1.4 * r], [x + 1.3 * r, y + r], [x - 1.3 * r, y + r]];
  return make('polygon', { points: points.map((point) => point.join(',')).join(' ') }, className);
}

/**
 * 판을 그린다.
 * @param {HTMLElement} root 그릴 자리(안의 것을 모두 바꾼다)
 * @param {object} view
 *   board    판 { knots, strings }
 *   cut      끊긴 줄들(번호)
 *   loop     눈에 띄게 할 고리 { strings, knots }(없으면 null)
 *   only     이 줄들과 그 끝 매듭만 그린다(없으면 모두. "왜 그럴까?"의 기르는 그림)
 *   area     그림이 차지할 칸(칸 단위의 minX, minY, maxX, maxY. 없으면 그물에 맞춘다)
 *   dots     area 안의 모든 칸 모서리에 옅은 점을 찍는다(직접 만들기)
 *   picked   눈에 띄게 할 매듭(직접 만들기에서 고른 매듭. 없으면 null)
 *   label    (줄 번호, 끊겼는가) → 읽어 줄 이름(누를 수 있는 판에서만)
 *   onString (줄 번호) → 줄을 눌렀을 때. 없으면 보기만 하는 판이다
 *   onSpot   (칸 단위의 자리) → 판을 눌렀을 때(직접 만들기. 있으면 onString 대신 쓴다)
 *   small    작은 그림으로 그린다(선과 매듭을 굵게)
 */
export function drawNet(root, view) {
  const { board, cut = [], loop = null, only = null, area = null, dots = false, picked = null, small = false } = view;
  const live = typeof view.onString === 'function' || typeof view.onSpot === 'function';
  const size = small ? 1.7 : 1;
  root.className = `net-board${small ? ' small' : ''}${live ? ' live' : ''}`;
  const holder = boardOf(root);
  const { svg } = holder;
  const focused = svg.contains(document.activeElement) ? document.activeElement.dataset.string : undefined;
  if (typeof view.onString === 'function') svg.removeAttribute('aria-hidden');
  else svg.setAttribute('aria-hidden', 'true');
  const box = frameOf(board, area);
  svg.setAttribute('viewBox', `${box.x * UNIT} ${box.y * UNIT} ${box.w * UNIT} ${box.h * UNIT}`);

  const off = new Set(cut);
  const shown = only ? new Set(only) : null;
  const shades = shadesOf(board, cut);
  const at = (knot) => board.knots[knot].map((value) => value * UNIT);
  const nodes = [];
  if (dots && area) {
    for (let y = area.minY; y <= area.maxY; y++) for (let x = area.minX; x <= area.maxX; x++) nodes.push(make('circle', { cx: x * UNIT, cy: y * UNIT, r: 5 }, 'net-dot'));
  }
  // 고리의 띠(줄 밑에)
  if (loop) {
    for (const index of loop.strings) {
      const [p, q] = board.strings[index].map(at);
      nodes.push(make('line', { x1: p[0], y1: p[1], x2: q[0], y2: q[1] }, 'net-loop'));
    }
  }
  board.strings.forEach(([a, b], index) => {
    if (shown && !shown.has(index)) return;
    const [p, q] = [at(a), at(b)];
    if (off.has(index)) {
      // 끊긴 줄: 양 끝만 남긴다
      const group = make('g', {}, 'net-cut');
      for (const [from, to] of [
        [p, q],
        [q, p],
      ]) {
        const end = [from[0] + (to[0] - from[0]) * STUB, from[1] + (to[1] - from[1]) * STUB];
        group.append(make('line', { x1: from[0], y1: from[1], x2: end[0], y2: end[1], 'stroke-width': 4 * size }));
      }
      nodes.push(group);
      return;
    }
    nodes.push(make('line', { x1: p[0], y1: p[1], x2: q[0], y2: q[1], 'stroke-width': LINE * size }, `net-string ${STYLES[shades[a] % STYLES.length]}`));
  });
  board.knots.forEach((spot, knot) => {
    if (shown && !board.strings.some((string, index) => shown.has(index) && string.includes(knot))) return;
    const point = at(knot);
    if (loop?.knots.includes(knot)) nodes.push(make('circle', { cx: point[0], cy: point[1], r: KNOT * size + 11 }, 'net-ring'));
    if (picked === knot) nodes.push(make('circle', { cx: point[0], cy: point[1], r: KNOT * size + 14 }, 'net-picked'));
    nodes.push(knotNode(point, shades[knot], size));
  });
  // 글자판으로 누를 자리(줄마다 보이지 않는 넓은 선). 손가락으로 누른 것은 판이 가장 가까운 줄을 골라 받는다
  if (typeof view.onString === 'function') {
    board.strings.forEach(([a, b], index) => {
      const [p, q] = [at(a), at(b)];
      const hit = make('line', { x1: p[0], y1: p[1], x2: q[0], y2: q[1], tabindex: 0, role: 'button' }, 'net-hit');
      hit.dataset.string = String(index);
      if (view.label) hit.setAttribute('aria-label', view.label(index, off.has(index)));
      nodes.push(hit);
    });
  }
  svg.replaceChildren(...nodes);
  holder.view = { ...view, board };
  if (focused !== undefined) svg.querySelector(`[data-string="${focused}"]`)?.focus?.();
}

/**
 * 판 하나를 담은 새 조각을 만든다(풀이, "왜 그럴까?"의 그림, 직접 만들기의 선생님 그림).
 * @param {object} view drawNet에 건네는 것
 * @param {string} note 아래에 붙이는 글
 * @param {{big?: boolean, mid?: boolean}} options big: 한 장을 크게, mid: 두 장을 나란히
 */
export function netCard(view, note, { big = false, mid = false } = {}) {
  const card = el('div', big ? 'net-card big' : mid ? 'net-card mid' : 'net-card');
  const picture = el('div');
  card.append(picture);
  drawNet(picture, { ...view, small: !big });
  if (note) card.append(el('p', 'strip-note', note));
  return card;
}
