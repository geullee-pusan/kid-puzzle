// 여우와 토끼의 판을 그린다: 네모 칸들, 여우와 토끼, 갈 수 있는 칸, 방금 움직인 자국, 바둑판처럼 칠한 두 색.
// 누를 수 있는 판과 보기만 하는 그림을 같은 모양으로 그린다.
// 색만으로 알리지 않는다. 여우는 뾰족한 두 귀와 세모 얼굴, 토끼는 긴 두 귀와 둥근 얼굴이다(그림은 새로 그렸다).
// 갈 수 있는 칸에는 점선 동그라미를, 방금 움직인 동물이 지나온 길에는 점선과 처음 칸의 작은 점을 그린다.
// 두 색을 칠하면 칸마다 구석에 모양을 그린다(동그라미 칸, 네모 칸. 방 한 번씩 돌기와 같은 색과 모양).
// 누르는 것은 click으로 받는다(손가락으로 한 번 누르는 것). 글자판으로도 칸을 골라 누를 수 있다.

const NS = 'http://www.w3.org/2000/svg';
const UNIT = 100; // 칸 하나의 크기
const EDGE = 6; // 판 둘레에 두는 자리

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

const xyOf = (w, cell) => [cell % w, Math.floor(cell / w)];
const centerOf = (w, cell) => {
  const [x, y] = xyOf(w, cell);
  return [x * UNIT + UNIT / 2, y * UNIT + UNIT / 2];
};
const colorAt = (w, cell) => ((cell % w) + Math.floor(cell / w)) % 2;
const points = (list) => list.map((point) => point.join(',')).join(' ');

/** 여우 하나(가운데가 0, 0이고 너비가 80쯤인 그림): 뾰족한 두 귀, 세모 얼굴, 흰 주둥이 */
export function foxShape(cx, cy, scale = 1) {
  const group = make('g', { transform: `translate(${cx} ${cy}) scale(${scale})` }, 'fxr-animal fxr-fox');
  group.append(
    make('polygon', { points: points([[-34, -12], [-28, -42], [-8, -18]]) }, 'fxr-fox-ear'),
    make('polygon', { points: points([[34, -12], [28, -42], [8, -18]]) }, 'fxr-fox-ear'),
    make('polygon', { points: points([[-24, -32], [-19, -24], [-27, -18]]) }, 'fxr-fox-inner'),
    make('polygon', { points: points([[24, -32], [19, -24], [27, -18]]) }, 'fxr-fox-inner'),
    make('polygon', { points: points([[-38, -16], [38, -16], [0, 36]]) }, 'fxr-fox-face'),
    make('polygon', { points: points([[-15, 8], [15, 8], [0, 36]]) }, 'fxr-fox-muzzle'),
    make('circle', { cx: -13, cy: -2, r: 4.5 }, 'fxr-eye'),
    make('circle', { cx: 13, cy: -2, r: 4.5 }, 'fxr-eye'),
    make('circle', { cx: 0, cy: 32, r: 5 }, 'fxr-eye'),
  );
  return group;
}

/** 토끼 하나(가운데가 0, 0이고 너비가 60쯤인 그림): 긴 두 귀, 둥근 얼굴 */
export function rabbitShape(cx, cy, scale = 1) {
  const group = make('g', { transform: `translate(${cx} ${cy}) scale(${scale})` }, 'fxr-animal fxr-rabbit');
  group.append(
    make('ellipse', { cx: -11, cy: -22, rx: 8, ry: 22 }, 'fxr-rabbit-ear'),
    make('ellipse', { cx: 11, cy: -22, rx: 8, ry: 22 }, 'fxr-rabbit-ear'),
    make('ellipse', { cx: -11, cy: -22, rx: 3.5, ry: 14 }, 'fxr-rabbit-inner'),
    make('ellipse', { cx: 11, cy: -22, rx: 3.5, ry: 14 }, 'fxr-rabbit-inner'),
    make('circle', { cx: 0, cy: 14, r: 25 }, 'fxr-rabbit-face'),
    make('circle', { cx: -9, cy: 9, r: 4 }, 'fxr-eye'),
    make('circle', { cx: 9, cy: 9, r: 4 }, 'fxr-eye'),
    make('ellipse', { cx: 0, cy: 20, rx: 4.5, ry: 3.5 }, 'fxr-rabbit-nose'),
    make('line', { x1: 4, y1: 24, x2: 20, y2: 21 }, 'fxr-whisker'),
    make('line', { x1: -4, y1: 24, x2: -20, y2: 21 }, 'fxr-whisker'),
  );
  return group;
}

/** 두 색 칸의 구석 모양: 동그라미(맨 위 왼쪽 칸과 같은 색) 또는 네모. 작은 그림에서는 크게 그린다(줄여도 모양이 보이게) */
function colorMark(w, cell, small) {
  const [x, y] = xyOf(w, cell);
  const size = small ? 12 : 8;
  const cx = x * UNIT + 7 + size;
  const cy = y * UNIT + 7 + size;
  if (colorAt(w, cell) === 0) return make('circle', { cx, cy, r: size }, 'fxr-color-mark');
  return make('rect', { x: cx - size, y: cy - size, width: 2 * size, height: 2 * size }, 'fxr-color-mark');
}

/** 화면의 자리를 판의 칸 번호로 바꾼다. 판 밖이면 null */
function cellAt(svg, view, event) {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  const spot = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  const x = Math.floor(spot.x / UNIT);
  const y = Math.floor(spot.y / UNIT);
  if (x < 0 || x >= view.w || y < 0 || y >= view.h) return null;
  return y * view.w + x;
}

/** 그릴 자리에 판을 한 번 만들어 둔다. 안의 것만 바꿔 그린다(글자판으로 고른 칸이 그대로 남게). */
function boardOf(root) {
  let board = boards.get(root);
  if (board && board.svg.parentNode === root) return board;
  const svg = make('svg', { preserveAspectRatio: 'xMidYMid meet' });
  const layer = make('g');
  svg.append(layer);
  board = { svg, layer, view: null };
  boards.set(root, board);
  svg.addEventListener('click', (event) => {
    const view = board.view;
    if (!view?.onCell) return;
    const cell = cellAt(svg, view, event);
    if (cell !== null) view.onCell(cell);
  });
  svg.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const view = board.view;
    const target = event.target.closest?.('[data-cell]');
    if (!view?.onCell || !target) return;
    event.preventDefault();
    view.onCell(Number(target.dataset.cell));
  });
  root.replaceChildren(svg);
  return board;
}

/**
 * 판을 그린다.
 * @param {HTMLElement} root 그릴 자리(안의 것을 모두 바꾼다)
 * @param {object} view
 *   w, h       가로와 세로의 칸 수
 *   fox, rabbit 여우와 토끼가 있는 칸(같은 칸이면 여우가 토끼를 잡은 모습)
 *   colorOn    두 색을 칠하는가
 *   targets    갈 수 있는 칸들(점선 동그라미)
 *   last       방금 움직인 것 { animal, from, to }(없으면 null)
 *   rings      두 겹 고리로 짚는 칸들(그림)
 *   pick       직접 만들기에서 놓을 동물을 고른 칸(없으면 null)
 *   label      (칸 번호) → 읽어 줄 이름(누를 수 있는 판에서만)
 *   onCell     (칸 번호) → 칸을 눌렀을 때. 없으면 보기만 하는 그림이다
 *   small      작은 그림으로 그린다
 */
export function drawBoard(root, view) {
  const { w, h, fox, rabbit, colorOn = false, targets = [], last = null, rings = [], small = false } = view;
  const live = typeof view.onCell === 'function';
  root.className = `fxr-board${small ? ' small' : ''}${live ? ' live' : ''}`;
  root.style.setProperty('--w', String(w));
  root.style.setProperty('--h', String(h));
  const board = boardOf(root);
  const { svg } = board;
  const focused = svg.contains(document.activeElement) ? document.activeElement.dataset.cell : undefined;
  svg.setAttribute('viewBox', `${-EDGE} ${-EDGE} ${w * UNIT + 2 * EDGE} ${h * UNIT + 2 * EDGE}`);
  svg.setAttribute('class', 'fxr-svg');
  if (live) svg.removeAttribute('aria-hidden');
  else svg.setAttribute('aria-hidden', 'true');

  const nodes = [];
  for (let cell = 0; cell < w * h; cell++) {
    const [x, y] = xyOf(w, cell);
    const group = make('g', { 'data-cell': cell }, 'fxr-cell-group');
    group.append(make('rect', { x: x * UNIT, y: y * UNIT, width: UNIT, height: UNIT }, colorOn ? `fxr-cell fxr-color-${colorAt(w, cell)}` : 'fxr-cell'));
    if (colorOn) group.append(colorMark(w, cell, small));
    if (live && view.label) {
      group.setAttribute('tabindex', '0');
      group.setAttribute('role', 'button');
      group.setAttribute('aria-label', view.label(cell));
    }
    nodes.push(group);
  }
  for (const cell of targets) {
    const [cx, cy] = centerOf(w, cell);
    nodes.push(make('circle', { cx, cy, r: 40 }, 'fxr-target'));
  }
  if (last) {
    const [ax, ay] = centerOf(w, last.from);
    const [bx, by] = centerOf(w, last.to);
    nodes.push(make('line', { x1: ax, y1: ay, x2: bx, y2: by }, `fxr-step ${last.animal}`), make('circle', { cx: ax, cy: ay, r: 9 }, `fxr-step-dot ${last.animal}`));
  }
  for (const cell of rings) {
    const [cx, cy] = centerOf(w, cell);
    nodes.push(make('circle', { cx, cy, r: 46 }, 'fxr-ring'), make('circle', { cx, cy, r: 36 }, 'fxr-ring inner'));
  }
  if (view.pick !== null && view.pick !== undefined) {
    const [x, y] = xyOf(w, view.pick);
    nodes.push(make('rect', { x: x * UNIT + 5, y: y * UNIT + 5, width: UNIT - 10, height: UNIT - 10, rx: 12 }, 'fxr-pick'));
  }
  if (fox === rabbit) {
    // 여우가 토끼 칸에 들어갔다: 토끼를 작게 아래 왼쪽에, 여우를 위 오른쪽에 그리고 칸에 굵은 고리를 두른다.
    const [cx, cy] = centerOf(w, fox);
    nodes.push(rabbitShape(cx - 20, cy + 16, 0.6), foxShape(cx + 12, cy - 6, 0.8), make('rect', { x: cx - 46, y: cy - 46, width: 92, height: 92, rx: 14 }, 'fxr-caught'));
  } else {
    const [rx, ry] = centerOf(w, rabbit);
    const [fx, fy] = centerOf(w, fox);
    // 칸 구석의 모양이 가려지지 않게 조금 작게, 조금 아래에 그린다.
    nodes.push(rabbitShape(rx + 4, ry + 6, 0.84), foxShape(fx + 4, fy + 8, 0.84));
  }

  board.layer.replaceChildren(...nodes);
  board.view = { ...view, w, h };
  if (focused !== undefined) svg.querySelector(`[data-cell="${focused}"]`)?.focus?.();
}

/**
 * 판 하나를 담은 새 조각을 만든다(다시 보기, 풀이, "왜 그럴까?"의 그림).
 * @param {object} view drawBoard에 건네는 것
 * @param {string} note 아래에 붙이는 글
 * @param {{big?: boolean}} options
 */
export function boardCard(view, note, { big = false } = {}) {
  const card = el('div', big ? 'fxr-card big' : 'fxr-card');
  const picture = el('div');
  card.append(picture);
  drawBoard(picture, { ...view, small: true });
  if (note) card.append(el('p', 'strip-note', note));
  return card;
}

/** 판 아래와 오른쪽 칸에 붙이는 작은 동물 그림 */
export function animalIcon(animal) {
  const svg = make('svg', { viewBox: '-50 -50 100 100', 'aria-hidden': 'true' }, 'fxr-icon');
  svg.append(animal === 'fox' ? foxShape(0, 0, 1) : rabbitShape(0, 2, 1));
  return svg;
}
