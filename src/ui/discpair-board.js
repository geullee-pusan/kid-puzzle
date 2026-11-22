// 원판 둘씩 옮기기의 판을 그린다: 둥글게 놓인 칸들과 칸을 잇는 고리, 칸마다 쌓인 원판과 원판의 수.
// 누를 수 있는 판과 보기만 하는 그림을 같은 모양으로 그린다. 글자는 대본에서 받는다(이 파일에는 글을 적지 않는다).
// 0번 칸이 맨 위이고 시계 방향으로 센다. 칸 전체가 누르는 자리다.
// 색만으로 알리지 않는다.
//   "색 켜기": 짝수 번째 칸은 노란 칸에 동그라미, 홀수 번째 칸은 파란 칸에 네모를 칸 왼쪽 위 구석에 그린다(방 한 번씩 돌기의 두 색).
//   들어 올린 원판은 쌓인 원판 위로 떠 있고 금빛 점선 테두리, 그 칸은 굵은 금빛 테두리, 갈 수 있는 옆 칸은 금빛 점선 테두리다.
//   한 번의 첫째 걸음으로 막 옮긴 원판은 점선 테두리를 두른다(이번에는 다시 옮길 수 없다). 그림의 옮기기는 화살표로 그린다.

const NS = 'http://www.w3.org/2000/svg';
const SIZE = 1000; // 그림 한 변
const RADIUS = 345; // 고리의 반지름(칸의 가운데가 놓이는 곳)
const CELL = 250; // 칸 한 변
const DISC_W = 72; // 원판의 가로 반지름
const DISC_H = 17; // 원판의 세로 반지름

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

/** 칸의 가운데 */
export function placeOf(n, cell) {
  const angle = -Math.PI / 2 + (2 * Math.PI * cell) / n;
  return { x: SIZE / 2 + RADIUS * Math.cos(angle), y: SIZE / 2 + RADIUS * Math.sin(angle) };
}

/** 칸 한 변(칸이 많아도 옆 칸과 겹치지 않게) */
export function cellSize(n) {
  return Math.min(CELL, 2 * RADIUS * Math.sin(Math.PI / n) - 26);
}

/** 원판 하나(위에서 본 납작한 원기둥) */
function disc(x, y, className) {
  const group = make('g', {}, className);
  group.append(make('rect', { x: x - DISC_W, y: y - DISC_H, width: 2 * DISC_W, height: DISC_H + 6 }, 'dp-disc-side'));
  group.append(make('ellipse', { cx: x, cy: y + 6, rx: DISC_W, ry: DISC_H }, 'dp-disc-side'));
  group.append(make('ellipse', { cx: x, cy: y - DISC_H, rx: DISC_W, ry: DISC_H }, 'dp-disc-top'));
  return group;
}

/** 한 칸에서 다른 칸으로 가는 화살표(그림의 옮기기) */
function arrow(n, from, to, size) {
  const a = placeOf(n, from);
  const b = placeOf(n, to);
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const ux = (b.x - a.x) / length;
  const uy = (b.y - a.y) / length;
  const cut = size / 2 - 10;
  const sx = a.x + ux * cut;
  const sy = a.y + uy * cut;
  const ex = b.x - ux * cut;
  const ey = b.y - uy * cut;
  const head = 34;
  const wing = 20;
  const d = `M${sx},${sy}L${ex},${ey}M${ex - ux * head - uy * wing},${ey - uy * head + ux * wing}L${ex},${ey}L${ex - ux * head + uy * wing},${ey - uy * head - ux * wing}`;
  return make('path', { d }, 'dp-arrow');
}

/**
 * 판을 그린다.
 * @param {HTMLElement} root 그릴 자리(안의 것을 모두 바꾼다)
 * @param {object} view
 *   n, piles   칸 수와 칸마다의 원판 수
 *   colorOn    칸에 두 색(동그라미 칸과 네모 칸)을 칠한다
 *   lifted     원판을 들어 올린 칸(없으면 null)
 *   targets    갈 수 있는 칸들(원판을 들어 올렸을 때의 옆 칸)
 *   fresh      한 번의 첫째 걸음으로 막 옮긴 원판이 들어간 칸(없으면 null)
 *   arrows     그림에 그릴 옮기기들([나간 칸, 들어간 칸])
 *   ring       굵은 고리로 짚을 칸(그림에서 모일 칸을 보인다. 없으면 null)
 *   labels     { board, cell(칸 번호, 원판 수) } 읽어 줄 이름(누를 수 있는 판에서만)
 *   onCell     (칸 번호) → 칸을 눌렀을 때. 없으면 누를 수 없다
 *   small      작은 그림으로 그린다
 */
export function drawRing(root, view) {
  const { n, piles, colorOn = false, lifted = null, targets = [], fresh = null, arrows = [], ring = null, small = false } = view;
  const live = Boolean(view.onCell);
  const focused = root.contains(document.activeElement) ? document.activeElement.dataset?.key : undefined;
  root.className = `dp-board${small ? ' small' : ''}${live ? ' live' : ''}`;
  const size = cellSize(n);
  const svg = make('svg', { viewBox: `0 0 ${SIZE} ${SIZE}`, preserveAspectRatio: 'xMidYMid meet' }, 'dp-svg');
  if (live && view.labels) {
    svg.setAttribute('role', 'group');
    svg.setAttribute('aria-label', view.labels.board);
  } else svg.setAttribute('aria-hidden', 'true');

  // 칸을 잇는 고리: 원판은 이 고리를 따라 옆 칸으로만 간다
  svg.append(make('circle', { cx: SIZE / 2, cy: SIZE / 2, r: RADIUS }, 'dp-track'));
  const going = new Set(targets);
  for (let cell = 0; cell < n; cell++) {
    const { x, y } = placeOf(n, cell);
    const left = x - size / 2;
    const top = y - size / 2;
    const shape = cell % 2 === 0 ? 'circle' : 'square';
    const group = make('g', { 'data-cell': cell, 'data-key': `cell-${cell}` }, 'dp-cell-group');
    group.append(make('rect', { x: left, y: top, width: size, height: size, rx: 26 }, `dp-cell${colorOn ? ` dp-${shape}` : ''}`));
    if (colorOn) {
      const mark = shape === 'circle' ? make('circle', { cx: left + 32, cy: top + 32, r: 16 }) : make('rect', { x: left + 17, y: top + 17, width: 30, height: 30 });
      mark.setAttribute('class', 'dp-mark');
      group.append(mark);
    }
    // 원판 쌓기: 아래에서 위로. 많으면 촘촘히 쌓는다. 들어 올린 원판은 쌓인 것에서 빼고 위에 띄운다
    const count = piles[cell];
    const stacked = lifted === cell ? count - 1 : count;
    const step = Math.min(26, (size - 120) / Math.max(count, 1));
    const bottom = top + size - 84;
    for (let at = 0; at < stacked; at++) {
      const isFresh = fresh === cell && at === stacked - 1;
      group.append(disc(x, bottom - at * step, isFresh ? 'dp-disc fresh' : 'dp-disc'));
    }
    if (lifted === cell) group.append(disc(x, top + 24, 'dp-disc lifted'));
    const number = make('text', { x, y: top + size - 18, 'text-anchor': 'middle' }, 'dp-count');
    number.textContent = String(count);
    group.append(number);
    if (live) {
      group.setAttribute('tabindex', '0');
      group.setAttribute('role', 'button');
      if (view.labels) group.setAttribute('aria-label', view.labels.cell(cell, count));
    }
    svg.append(group);
    if (lifted === cell) svg.append(make('rect', { x: left - 8, y: top - 8, width: size + 16, height: size + 16, rx: 32 }, 'dp-from'));
    if (going.has(cell)) svg.append(make('rect', { x: left - 8, y: top - 8, width: size + 16, height: size + 16, rx: 32 }, 'dp-target'));
    if (ring === cell) svg.append(make('rect', { x: left - 10, y: top - 10, width: size + 20, height: size + 20, rx: 34 }, 'dp-ring'));
  }
  for (const [from, to] of arrows) svg.append(arrow(n, from, to, size));

  if (live) {
    const press = (target) => view.onCell(Number(target.dataset.cell));
    svg.addEventListener('click', (event) => {
      const target = event.target.closest?.('[data-cell]');
      if (target) press(target);
    });
    // 글자판으로도 누를 수 있다.
    svg.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const target = event.target.closest?.('[data-cell]');
      if (!target) return;
      event.preventDefault();
      press(target);
    });
  }
  root.replaceChildren(svg);
  if (focused !== undefined) svg.querySelector(`[data-key="${focused}"]`)?.focus?.();
}

/**
 * 판 하나를 담은 새 조각을 만든다(풀이, "왜 그럴까?", 직접 만들기의 그림). 아래에 한 줄 글을 붙일 수 있다.
 * 크기: 보통은 판 위의 종이에 한 줄에 석 장, mid는 두 장, big은 한 장이 들어간다.
 */
export function ringCard(view, note, { big = false, mid = false } = {}) {
  const card = el('div', big ? 'dp-card big' : mid ? 'dp-card mid' : 'dp-card');
  const picture = el('div');
  card.append(picture);
  drawRing(picture, { ...view, small: true });
  if (note) card.append(el('p', 'strip-note', note));
  return card;
}
