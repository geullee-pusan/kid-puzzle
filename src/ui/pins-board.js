// 핀에 실 감기의 판을 그린다: 원 위에 고르게 박힌 핀들과, 핀 사이에 감긴 실.
// 누를 수 있는 판과 보기만 하는 그림(작은 그림, 풀이, "왜 그럴까?")을 같은 모양으로 그린다.
// 색만으로 알리지 않는다. 가닥마다 색과 함께 선의 모양(실선, 긴 점선, 짧은 점선, 점과 선 …)이 다르고,
// 실이 지나간 핀의 동그라미 안에는 그 가닥의 차례 수(1, 2, …)를 적는다. 실이 걸려 있는 핀에는 굵은 점선 고리를 두른다.
// "핀마다 칸 수 적기"를 켜면 핀 바깥에 맨 위 핀에서 몇 칸인지(0부터)를 작게 적는다. 글자는 대본에서 받는다.
// 핀을 누르는 것은 click으로 받는다(누른 자리에서 가장 가까운 핀). 글자판으로는 핀마다 Enter와 빈칸 글쇠로 누른다.

const NS = 'http://www.w3.org/2000/svg';
const SIZE = 400; // 그림의 한 변
const RADIUS = 148; // 핀들이 놓인 원의 반지름
const PIN = 15; // 핀의 반지름
const REACH = 34; // 핀을 누른 것으로 보는 거리(그림 안의 길이). 핀 16개에서도 이웃 핀과 겹치지 않는다
const LABEL = 180; // 칸 수를 적는 자리의 반지름

/** 가닥마다의 모양: 차례대로 쓴다(여덟 가닥까지 모두 다르다) */
export const STYLES = ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7'];

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

/** 핀 i의 자리: 맨 위에서부터 시계 방향으로 고르게 */
export function spotOf(n, pin, radius = RADIUS) {
  const angle = -Math.PI / 2 + (2 * Math.PI * pin) / n;
  return [SIZE / 2 + radius * Math.cos(angle), SIZE / 2 + radius * Math.sin(angle)];
}

/** 화면의 자리를 그림 안의 자리로 */
function locate(svg, event) {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  const spot = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  return [spot.x, spot.y];
}

/** 가장 가까운 핀(REACH 안). 없으면 null */
function pinAt(n, spot) {
  let best = null;
  let distance = REACH;
  for (let pin = 0; pin < n; pin++) {
    const [x, y] = spotOf(n, pin);
    const far = Math.hypot(spot[0] - x, spot[1] - y);
    if (far <= distance) {
      best = pin;
      distance = far;
    }
  }
  return best;
}

/** 그릴 자리에 판을 한 번 만들어 둔다. 누르는 것은 판에 한 번만 잇고, 안의 것만 바꿔 그린다. */
function boardOf(root) {
  let board = boards.get(root);
  if (board && board.svg.parentNode === root) return board;
  const svg = make('svg', { viewBox: `0 0 ${SIZE} ${SIZE}`, preserveAspectRatio: 'xMidYMid meet' }, 'pins-svg');
  board = { svg, view: null };
  boards.set(root, board);
  svg.addEventListener('click', (event) => {
    const view = board.view;
    if (!view?.onPin) return;
    const spot = locate(svg, event);
    const pin = spot ? pinAt(view.n, spot) : null;
    if (pin !== null) view.onPin(pin);
  });
  // 글자판으로도 핀을 누를 수 있다.
  svg.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const view = board.view;
    const target = event.target.closest?.('[data-pin]');
    if (!view?.onPin || !target) return;
    event.preventDefault();
    view.onPin(Number(target.dataset.pin));
  });
  root.replaceChildren(svg);
  return board;
}

/** 가닥 하나: 핀을 차례로 잇는 선. 끝난 가닥은 마지막 핀에서 처음 핀까지 잇는다 */
function threadNode(n, thread, index, { fresh, k }) {
  const points = thread.pins.map((pin) => spotOf(n, pin));
  if (thread.closed && thread.pins.length > 2) points.push(points[0]);
  const group = make('g', {}, `pins-thread ${STYLES[index % STYLES.length]}`);
  if (points.length < 2) return group;
  // 방금 감은 마디는 따로 그려서 잠깐 떠오르게 한다(움직임을 줄이는 설정이면 css가 멈춘다)
  const body = fresh && points.length > 2 ? points.slice(0, -1) : fresh ? [] : points;
  if (body.length >= 2) group.append(make('polyline', { points: body.map((spot) => spot.join(',')).join(' '), 'stroke-width': 7 * k }, 'pins-line'));
  if (fresh) {
    const [a, b] = points.slice(-2);
    group.append(make('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], 'stroke-width': 7 * k }, 'pins-line pins-fresh'));
  }
  return group;
}

/**
 * 판을 그린다.
 * @param {HTMLElement} root 그릴 자리(안의 것을 모두 바꾼다)
 * @param {object} view
 *   n        핀 수
 *   threads  감긴 가닥들 { pins, closed }(차례대로 1번째, 2번째 가닥)
 *   last     실이 걸려 있는 핀(감는 중인 가닥의 마지막 핀. 없으면 null)
 *   fresh    true면 마지막 가닥의 마지막 마디를 방금 감은 것으로 그린다
 *   numbers  true면 핀 바깥에 맨 위 핀에서 몇 칸인지 적는다
 *   label    (핀, 그 핀의 가닥 차례(없으면 null)) → 읽어 줄 이름(누를 수 있는 판에서만)
 *   onPin    (핀) → 핀을 눌렀을 때. 없으면 보기만 하는 판이다
 *   small    작은 그림으로 그린다(선과 핀을 굵게)
 */
export function drawPins(root, view) {
  const { n, threads = [], last = null, fresh = false, numbers = false, small = false } = view;
  const live = typeof view.onPin === 'function';
  const k = small ? 1.6 : 1;
  root.className = `pins-board${small ? ' small' : ''}${live ? ' live' : ''}`;
  const board = boardOf(root);
  const { svg } = board;
  const focused = svg.contains(document.activeElement) ? document.activeElement.dataset.pin : undefined;
  if (live) svg.removeAttribute('aria-hidden');
  else svg.setAttribute('aria-hidden', 'true');

  const owner = new Map();
  threads.forEach((thread, index) => {
    for (const pin of thread.pins) owner.set(pin, index);
  });
  const nodes = [make('circle', { cx: SIZE / 2, cy: SIZE / 2, r: RADIUS, 'stroke-width': 3 * k }, 'pins-ring')];
  threads.forEach((thread, index) => nodes.push(threadNode(n, thread, index, { fresh: fresh && index === threads.length - 1, k })));
  for (let pin = 0; pin < n; pin++) {
    const [x, y] = spotOf(n, pin);
    const index = owner.has(pin) ? owner.get(pin) : null;
    const group = make('g', { 'data-pin': pin }, `pins-pin${index !== null ? ` used ${STYLES[index % STYLES.length]}` : ''}`);
    group.append(make('circle', { cx: x, cy: y, r: REACH }, 'pins-hit'));
    if (last === pin) group.append(make('circle', { cx: x, cy: y, r: PIN + 10, 'stroke-width': 6 }, 'pins-last'));
    group.append(make('circle', { cx: x, cy: y, r: PIN * (small ? (n <= 8 ? 1.5 : 1.1) : 1), 'stroke-width': 4 * Math.min(k, 1.3) }, 'pins-dot'));
    // 가닥의 차례 수는 큰 판에만 적는다(작은 그림에서는 글자가 너무 작다. 선의 모양으로 가닥이 갈린다)
    if (index !== null && !small) {
      const mark = make('text', { x, y: y + 1 }, 'pins-mark');
      mark.textContent = String(index + 1);
      group.append(mark);
    }
    if (numbers && !small) {
      const [lx, ly] = spotOf(n, pin, LABEL);
      const text = make('text', { x: lx, y: ly + 1 }, 'pins-number');
      text.textContent = String(pin);
      group.append(text);
    }
    if (live && view.label) {
      group.setAttribute('tabindex', '0');
      group.setAttribute('role', 'button');
      group.setAttribute('aria-label', view.label(pin, index));
    }
    nodes.push(group);
  }
  svg.replaceChildren(...nodes);
  board.view = { ...view, n };
  if (focused !== undefined) svg.querySelector(`[data-pin="${focused}"]`)?.focus?.();
}

/**
 * 판 하나를 담은 새 조각을 만든다(풀이, "왜 그럴까?"의 그림).
 * @param {object} view drawPins에 건네는 것
 * @param {string} note 아래에 붙이는 글
 * @param {{big?: boolean, mid?: boolean}} options big: 한 장을 크게, mid: 두 장을 나란히
 */
export function pinsCard(view, note, { big = false, mid = false } = {}) {
  const card = el('div', big ? 'pins-card big' : mid ? 'pins-card mid' : 'pins-card');
  const picture = el('div');
  card.append(picture);
  drawPins(picture, { ...view, small: !big });
  if (note) card.append(el('p', 'strip-note', note));
  return card;
}
