// 도미노 깔기 모두 찾기의 그림을 그린다: 띠(조각 덮기의 판을 그대로 쓴다), 계단과 오르기, 적어 둔 것의 작은 그림, 종이의 그림.
// 누를 수 있는 판과 보기만 하는 그림을 같은 모양으로 그린다. 글자는 대본에서 받는다(이 파일에는 글을 적지 않는다).
// 색만으로 알리지 않는다.
//   계단: 칸마다 번호를 적는다. 지금 선 계단에는 큰 동그라미(오르는 사람), 밟은 계단에는 작은 점, 오른 걸음은 계단 위의 굽은 선이다.
//     지금 오를 수 있는 계단(한 칸 위와 두 칸 위)은 점선 테두리다. 계단 하나의 기둥 전체가 누르는 자리다.
//   적어 둔 것: 작은 그림 위에 목록의 차례(수)를 적는다. 방금 적은 것은 굵은 실선 테두리, 같다고 짚은 것은 굵은 점선 테두리다.
//   전부 보여 줘: 아이가 적어 둔 것은 실선 테두리, 적지 않은 것은 점선 테두리다.
import { drawBoard } from './tile-board.js';

const NS = 'http://www.w3.org/2000/svg';
const STEP_W = 100; // 계단 한 칸의 가로
const RISE = 44; // 계단 한 칸의 높이
const TOP = 90; // 계단 위에 걸음을 그릴 자리

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

/** 띠를 그린다(조각 덮기의 판. view는 drawBoard에 그대로 건넨다) */
export function drawStrip(root, view) {
  drawBoard(root, { ...view, size: 2 });
  root.classList.add('tl-strip');
}

/** 계단 그림의 크기 */
const stairSize = (n) => ({ width: (n + 1) * STEP_W, height: TOP + n * RISE + 24 });
/** 계단 k칸(0은 땅)의 윗면 높이 */
const topOf = (n, k) => TOP + (n - k) * RISE;
const middleOf = (k) => k * STEP_W + STEP_W / 2;

/**
 * 계단을 그린다.
 * @param {HTMLElement} root 그릴 자리(안의 것을 모두 바꾼다)
 * @param {object} view
 *   n        계단 칸 수
 *   landed   밟은 계단들(땅은 빼고 아래에서부터). 마지막이 지금 선 계단이다
 *   targets  지금 오를 수 있는 계단들(점선 테두리)
 *   label    (계단 번호) → 읽어 줄 이름(누를 수 있는 판에서만)
 *   onStep   (계단 번호) → 계단을 눌렀을 때. 없으면 누를 수 없다
 *   small    작은 그림으로 그린다
 */
export function drawStairs(root, view) {
  const { n, landed = [], targets = [], small = false } = view;
  const live = Boolean(view.onStep);
  const focused = root.contains(document.activeElement) ? document.activeElement.dataset?.step : undefined;
  root.className = `tl-stairs${small ? ' small' : ''}${live ? ' live' : ''}`;
  root.style.setProperty('--n', String(n + 1));
  const { width, height } = stairSize(n);
  const svg = make('svg', { viewBox: `-6 -6 ${width + 12} ${height + 12}`, preserveAspectRatio: 'xMidYMid meet' }, 'tl-stairs-svg');
  if (!live) svg.setAttribute('aria-hidden', 'true');
  const bottom = height;
  // 땅
  svg.append(make('rect', { x: 0, y: topOf(n, 0), width: STEP_W, height: bottom - topOf(n, 0) }, 'tl-ground'));
  const going = new Set(targets);
  for (let k = 1; k <= n; k++) {
    const group = make('g', { 'data-step': k }, 'tl-step-group');
    // 누르는 자리는 그 계단의 기둥 전체(그림 맨 위에서 맨 아래까지)다
    if (live) group.append(make('rect', { x: k * STEP_W, y: -6, width: STEP_W, height: height + 12 }, 'tl-hit'));
    group.append(make('rect', { x: k * STEP_W, y: topOf(n, k), width: STEP_W, height: bottom - topOf(n, k) }, 'tl-step'));
    const number = make('text', { x: middleOf(k), y: Math.min(topOf(n, k) + 40, bottom - 10), 'text-anchor': 'middle' }, 'tl-step-no');
    number.textContent = String(k);
    group.append(number);
    if (going.has(k)) group.append(make('rect', { x: k * STEP_W + 6, y: topOf(n, k) - 70, width: STEP_W - 12, height: 64, rx: 14 }, 'tl-target'));
    if (live) {
      group.setAttribute('tabindex', '0');
      group.setAttribute('role', 'button');
      if (view.label) group.setAttribute('aria-label', view.label(k));
    }
    svg.append(group);
  }
  // 오른 걸음: 계단 위의 굽은 선. 두 칸 오른 걸음은 더 높이 굽는다
  let from = 0;
  for (const step of landed) {
    const [x1, y1, x2, y2] = [middleOf(from), topOf(n, from) - 16, middleOf(step), topOf(n, step) - 16];
    const lift = (step - from) * 34;
    svg.append(make('path', { d: `M${x1},${y1} Q${(x1 + x2) / 2},${Math.min(y1, y2) - lift} ${x2},${y2}` }, 'tl-hop'));
    from = step;
  }
  for (const step of landed.slice(0, -1)) svg.append(make('circle', { cx: middleOf(step), cy: topOf(n, step) - 16, r: 11 }, 'tl-mark'));
  // 오르는 사람: 지금 선 계단(아직 안 올랐으면 땅)의 큰 동그라미
  const now = landed.at(-1) ?? 0;
  svg.append(make('circle', { cx: middleOf(now), cy: topOf(n, now) - 28, r: 24 }, 'tl-climber'));

  if (live) {
    const press = (target) => view.onStep(Number(target.dataset.step));
    svg.addEventListener('click', (event) => {
      const target = event.target.closest?.('[data-step]');
      if (target) press(target);
    });
    // 글자판으로도 누를 수 있다.
    svg.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const target = event.target.closest?.('[data-step]');
      if (!target) return;
      event.preventDefault();
      press(target);
    });
  }
  root.replaceChildren(svg);
  if (focused !== undefined) svg.querySelector(`[data-step="${focused}"]`)?.focus?.();
}

/**
 * 작은 그림 하나(띠의 깔기나 계단의 오르기).
 * @param {object} view { shape: 'strip', w, h, holes, placed } 또는 { shape: 'stairs', n, landed }
 */
function drawSmall(root, view) {
  if (view.shape === 'stairs') drawStairs(root, { n: view.n, landed: view.landed, small: true });
  else drawStrip(root, { w: view.w, h: view.h, holes: view.holes, placed: view.placed, small: true });
}

/**
 * 적어 둔 것의 작은 그림 하나. 위에 목록의 차례를 적는다.
 * @param {object} view drawSmall에 건네는 것
 * @param {number} no 목록의 차례(1부터)
 * @param {{mark?: 'fresh' | 'same' | 'missed' | null, label?: string}} options
 */
export function itemCard(view, no, { mark = null, label = '' } = {}) {
  const box = el('div', `tl-item${mark ? ` ${mark}` : ''}`);
  box.style.setProperty('--w', String(view.shape === 'stairs' ? view.n + 1 : view.w));
  box.style.setProperty('--h', String(view.shape === 'stairs' ? Math.max(2, Math.ceil((view.n * RISE + TOP + 24) / STEP_W)) : view.h));
  if (label) {
    box.setAttribute('role', 'img');
    box.setAttribute('aria-label', label);
  }
  box.append(el('span', 'tl-item-no', String(no)));
  // 그리는 함수가 자리의 이름(class)을 바꾸므로 크기를 정하는 틀 안에 따로 그린다
  const frame = el('div', 'tl-item-picture');
  const picture = el('div');
  frame.append(picture);
  box.append(frame);
  drawSmall(picture, view);
  return box;
}

/** 작은 그림들을 늘어놓은 묶음(목록과 "전부 보여 줘") */
export function itemGrid(cards) {
  const grid = el('div', 'tl-grid');
  grid.append(...cards);
  return grid;
}

/** 판 하나를 담은 새 조각(종이의 그림). 아래에 한 줄 글을 붙인다 */
export function figureCard(view, note, { big = false } = {}) {
  const card = el('div', big ? 'tl-card big' : 'tl-card');
  const frame = el('div', 'tl-card-picture');
  const picture = el('div');
  frame.append(picture);
  card.append(frame);
  if (view.shape === 'stairs') drawStairs(picture, { n: view.n, landed: view.landed ?? [], small: true });
  else drawStrip(picture, { w: view.w, h: view.h, holes: view.holes ?? [], placed: view.placed ?? [], rings: view.rings ?? [], small: true });
  if (note) card.append(el('p', 'strip-note', note));
  return card;
}

/** 수의 줄(종이의 그림): 칸마다 위에 이름, 아래에 수 */
export function numberRow(items, note) {
  const box = el('div', 'tl-numbers');
  const row = el('div', 'tl-number-row');
  for (const { name, value } of items) {
    const cell = el('div', 'tl-number');
    cell.append(el('span', 'tl-number-name', name), el('strong', '', String(value)));
    row.append(cell);
  }
  box.append(row);
  if (note) box.append(el('p', 'strip-note', note));
  return box;
}

/** 자물쇠 그림: 잠긴 것과 열린 것(고리의 모양이 다르다) */
export function drawLock(root, open) {
  const svg = make('svg', { viewBox: '0 0 60 72', 'aria-hidden': 'true' }, `tl-lock-svg${open ? ' open' : ''}`);
  svg.append(make('path', { d: open ? 'M16,34 V14 a14,14 0 0 1 28,0 V20' :'M16,34 V22 a14,14 0 0 1 28,0 V34' }, 'tl-shackle'));
  svg.append(make('rect', { x: 6, y: 32, width: 48, height: 36, rx: 8 }, 'tl-lock-body'));
  svg.append(make('circle', { cx: 30, cy: 48, r: 5 }, 'tl-keyhole'));
  root.replaceChildren(svg);
}
