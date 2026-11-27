// 조건 맞춰 잇기의 판을 그린다: 동그라미 위의 점(점마다 적힌 수와 지금 선의 수를 보이는 작은 동그라미들)과 점 사이의 선.
// 누를 수 있는 판과 보기만 하는 그림(처음 화면, 공책, 풀이, "왜 그럴까?", 모든 경우 펼쳐 보기, 직접 만들기)을 같은 모양으로 그린다.
// 글자(점의 이름, 읽어 주는 이름)는 형식이 대본에서 채워 건넨다.
// 색만으로 알리지 않는다.
//   점 둘레의 작은 동그라미(점의 수만큼): 선이 하나 이어질 때마다 하나씩 채워진다. 수보다 많은 선은 빈 네모로 더 붙는다.
//   수만큼 이어진 점: 바깥에 굵은 고리를 한 겹 더 두른다. 수보다 많은 점: 테두리가 굵은 점선이다.
//   고른 점: 바깥에 굵은 금빛 점선 고리. 막힌 점("왜 그럴까?"와 풀이): 바깥에 굵은 붉은 점선 고리.
//   홀수인 점("왜 그럴까?"와 풀이): 바깥에 짧은 점선의 네모 테두리. 새로 그을 선(모든 경우 펼쳐 보기): 굵은 금빛 점선.
// 누르는 것은 click으로 받는다(누른 자리에서 가장 가까운 점, 없으면 가장 가까운 선. src/core/degree.js의 hitAt).
// 점은 둘레까지 넓게 눌리고, 선은 양쪽으로 넓게 눌린다. 글자판으로는 점과 선마다 Enter와 빈칸 글쇠로 누른다.
import { DOT, LINE_HIT, RING, degreesOf, hitAt, spotsOf } from '../core/degree.js';

const NS = 'http://www.w3.org/2000/svg';
/** 그림의 반쪽 너비(동그라미, 작은 동그라미, 이름까지) */
const HALF = RING + 72;
/** 작은 그림의 점의 반지름(작은 동그라미와 이름이 없어서 점을 크게 그리고, 그림은 점들에 꼭 맞춘다) */
const SMALL_DOT = 66;
/** 작은 동그라미가 놓이는 거리와 그 사이의 각, 반지름 */
const PIP_AT = DOT + 17;
const PIP_GAP = (15 * Math.PI) / 180;
const PIP = 7;
/** 이름이 놓이는 자리: 점에서 이만큼, 바깥 방향에서 시계 방향으로 직각(작은 동그라미와 겹치지 않는다) */
const NAME_AT = DOT + 34;

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

/** 화면의 자리를 그림 안의 자리로 */
function locate(svg, event) {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  const spot = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  return [spot.x, spot.y];
}

/** 그릴 자리에 판을 한 번 만들어 둔다. 누르는 것은 판에 한 번만 잇고, 안의 것만 바꿔 그린다. */
function boardOf(root) {
  let board = boards.get(root);
  if (board && board.svg.parentNode === root) return board;
  const svg = make('svg', { viewBox: `${-HALF} ${-HALF} ${2 * HALF} ${2 * HALF}`, preserveAspectRatio: 'xMidYMid meet' }, 'dg-svg');
  board = { svg, view: null };
  boards.set(root, board);
  svg.addEventListener('click', (event) => {
    const view = board.view;
    if (!view || (!view.onPoint && !view.onLine)) return;
    const spot = locate(svg, event);
    if (!spot) return;
    const hit = hitAt(view.need.length, view.lines, spot);
    if (hit && 'point' in hit && view.onPoint) view.onPoint(hit.point);
    else if (hit && 'line' in hit && view.onLine) view.onLine(hit.line);
  });
  svg.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const view = board.view;
    const target = event.target.closest?.('[data-point], [data-line]');
    if (!view || !target) return;
    event.preventDefault();
    if (target.dataset.point !== undefined && view.onPoint) view.onPoint(Number(target.dataset.point));
    if (target.dataset.line !== undefined && view.onLine) view.onLine(Number(target.dataset.line));
  });
  root.replaceChildren(svg);
  return board;
}

/** 점 바깥쪽으로 dist만큼, 바깥 방향에서 angle만큼 돌린 자리 */
function around([x, y], dist, angle = 0) {
  const base = Math.atan2(y, x) + angle;
  return [x + dist * Math.cos(base), y + dist * Math.sin(base)];
}

/**
 * 판을 그린다.
 * @param {HTMLElement} root 그릴 자리(안의 것을 모두 바꾼다)
 * @param {object} view
 *   need     점마다의 수
 *   lines    그은 선 [a, b]
 *   fresh    새로 그을 선(모든 경우 펼쳐 보기. 금빛 점선)
 *   names    점의 이름들(없으면 이름을 쓰지 않는다)
 *   picked   고른 점(없으면 null)
 *   stuck    막힌 점(없으면 null)
 *   odd      홀수인 점에 테두리를 두른다
 *   ends     선의 끝마다 작은 점을 찍는다
 *   label    { point: (점, 수, 지금 선의 수) → 이름, line: (a, b) → 이름 }(누를 수 있는 판에서만)
 *   onPoint  (점) → 점을 눌렀을 때. 없으면 점을 누를 수 없다
 *   onLine   (선의 차례) → 선을 눌렀을 때. 없으면 선을 누를 수 없다
 *   small    작은 그림(처음 화면, 공책, 판 고르기): 작은 동그라미와 이름 없이 굵게
 */
export function drawBoard(root, view) {
  const { need, lines = [], fresh = [], names = null, picked = null, stuck = null, odd = false, ends = false, small = false } = view;
  const live = typeof view.onPoint === 'function' || typeof view.onLine === 'function';
  root.className = `dg-board${small ? ' small' : ''}${live ? ' live' : ''}`;
  const holder = boardOf(root);
  const { svg } = holder;
  const focused = svg.contains(document.activeElement) ? { point: document.activeElement.dataset.point, line: document.activeElement.dataset.line } : null;
  if (live) svg.removeAttribute('aria-hidden');
  else svg.setAttribute('aria-hidden', 'true');
  const n = need.length;
  const spots = spotsOf(n);
  if (small) {
    const pad = SMALL_DOT + 10;
    const xs = spots.map(([x]) => x);
    const ys = spots.map(([, y]) => y);
    const [left, top] = [Math.min(...xs) - pad, Math.min(...ys) - pad];
    svg.setAttribute('viewBox', `${left} ${top} ${Math.max(...xs) + pad - left} ${Math.max(...ys) + pad - top}`);
  } else svg.setAttribute('viewBox', `${-HALF} ${-HALF} ${2 * HALF} ${2 * HALF}`);
  const degrees = degreesOf(n, [...lines, ...fresh]);
  const nodes = [];
  const width = small ? 14 : 8;

  // 선
  for (const [a, b] of lines) nodes.push(make('line', { x1: spots[a][0], y1: spots[a][1], x2: spots[b][0], y2: spots[b][1], 'stroke-width': width }, 'dg-line'));
  for (const [a, b] of fresh) nodes.push(make('line', { x1: spots[a][0], y1: spots[a][1], x2: spots[b][0], y2: spots[b][1], 'stroke-width': width }, 'dg-line fresh'));
  // 선의 끝: 점 테두리 바로 밖에 작은 점
  if (ends) {
    for (const [a, b] of [...lines, ...fresh]) {
      for (const [from, to] of [
        [a, b],
        [b, a],
      ]) {
        const [x1, y1] = spots[from];
        const [x2, y2] = spots[to];
        const length = Math.hypot(x2 - x1, y2 - y1);
        const t = (DOT + 12) / length;
        nodes.push(make('circle', { cx: x1 + (x2 - x1) * t, cy: y1 + (y2 - y1) * t, r: 8 }, 'dg-end'));
      }
    }
  }

  // 점
  spots.forEach((spot, at) => {
    const [x, y] = spot;
    const has = degrees[at];
    const full = has === need[at];
    const over = has > need[at];
    if (picked === at) nodes.push(make('circle', { cx: x, cy: y, r: DOT + 13 }, 'dg-picked'));
    if (stuck === at) nodes.push(make('circle', { cx: x, cy: y, r: DOT + 13 }, 'dg-stuck'));
    if (odd && need[at] % 2 === 1) nodes.push(make('rect', { x: x - DOT - 9, y: y - DOT - 9, width: 2 * DOT + 18, height: 2 * DOT + 18, rx: 8 }, 'dg-odd'));
    if (full && !small) nodes.push(make('circle', { cx: x, cy: y, r: DOT + 6 }, 'dg-full-ring'));
    nodes.push(make('circle', { cx: x, cy: y, r: small ? SMALL_DOT : DOT }, `dg-dot${full ? ' full' : ''}${over ? ' over' : ''}`));
    const number = make('text', { x, y: y + 1, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, 'dg-num');
    number.textContent = String(need[at]);
    nodes.push(number);
    if (!small) {
      // 점의 수만큼 작은 동그라미(채워진 것이 지금 선의 수), 수보다 많은 선은 빈 네모
      const count = Math.max(need[at], has);
      for (let index = 0; index < count; index++) {
        const [px, py] = around(spot, PIP_AT, (index - (count - 1) / 2) * PIP_GAP);
        if (index < need[at]) nodes.push(make('circle', { cx: px, cy: py, r: PIP }, `dg-pip${index < has ? ' on' : ''}`));
        else nodes.push(make('rect', { x: px - PIP, y: py - PIP, width: 2 * PIP, height: 2 * PIP }, 'dg-pip extra'));
      }
      if (names) {
        const [nx, ny] = around(spot, NAME_AT, Math.PI / 2);
        const name = make('text', { x: nx, y: ny, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, 'dg-name');
        name.textContent = names[at];
        nodes.push(name);
      }
    }
  });

  // 누를 자리: 선마다 보이지 않는 넓은 선, 점마다 보이지 않는 넓은 동그라미(글자판으로 누를 수 있다)
  if (typeof view.onLine === 'function') {
    lines.forEach(([a, b], index) => {
      const hit = make('line', { x1: spots[a][0], y1: spots[a][1], x2: spots[b][0], y2: spots[b][1], 'stroke-width': 2 * LINE_HIT, tabindex: 0, role: 'button' }, 'dg-hit-line');
      hit.dataset.line = String(index);
      if (view.label) hit.setAttribute('aria-label', view.label.line(a, b));
      nodes.push(hit);
    });
  }
  if (typeof view.onPoint === 'function') {
    spots.forEach(([x, y], at) => {
      const hit = make('circle', { cx: x, cy: y, r: DOT + 14, tabindex: 0, role: 'button' }, 'dg-hit-dot');
      hit.dataset.point = String(at);
      if (view.label) hit.setAttribute('aria-label', view.label.point(at, need[at], degrees[at]));
      if (picked === at) hit.setAttribute('aria-pressed', 'true');
      nodes.push(hit);
    });
  }
  svg.replaceChildren(...nodes);
  holder.view = { ...view, need, lines };
  if (focused?.point !== undefined) svg.querySelector(`[data-point="${focused.point}"]`)?.focus?.();
  else if (focused?.line !== undefined) svg.querySelector(`[data-line="${focused.line}"]`)?.focus?.();
}

/**
 * 판 하나를 담은 새 조각을 만든다(풀이, "왜 그럴까?"의 그림, 모든 경우 펼쳐 보기, 직접 만들기의 선생님 그림).
 * @param {object} view drawBoard에 건네는 것
 * @param {string} note 아래에 붙이는 글
 * @param {{big?: boolean, mid?: boolean, mini?: boolean}} options big: 한 장을 크게, mid: 두세 장을 나란히, mini: 오른쪽 칸에 두 장씩
 */
export function boardCard(view, note, { big = false, mid = false, mini = false } = {}) {
  const card = el('div', `dg-card${big ? ' big' : mid ? ' mid' : mini ? ' mini' : ''}`);
  const picture = el('div');
  card.append(picture);
  drawBoard(picture, view);
  if (note) card.append(el('p', 'strip-note', note));
  return card;
}
