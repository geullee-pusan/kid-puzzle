// 닿지 않게 놓기와 구역 긋기의 판을 그린다: 네모 칸들, 판에서 빠진 칸, 구슬, 구역, 닿는 칸.
// 누를 수 있는 판과 보기만 하는 그림을 같은 모양으로 그린다. 판의 자리 잡기는 조각 못 들어가게 막기의 판과 같은 이름표(block-board)를 쓴다.
// 색만으로 알리지 않는다.
//   구슬은 짙은 동그라미에 밝은 점 하나. 판에서 빠진 칸은 칸을 그리지 않고 가는 점선 테두리만 남긴다.
//   구역은 옅은 색을 번갈아 칠하고 둘레에 굵은 실선을 두른다. 구슬이 둘 들어가는 구역은 둘레를 점선으로 긋고, 들어가는 두 칸에 점선 동그라미를 그린다.
//   닿는 칸(도구)은 빗금을 긋는다. 놓으려다 닿은 칸에는 점선 동그라미를, 닿은 구슬에는 굵은 고리를 두른다.
// 누르는 것은 pointer 이벤트로 받는다. 구슬 놓기에서는 칸을 누른 것만 받고, 구역 긋기에서는 칸을 따라 그은 칸들을 받는다.

const NS = 'http://www.w3.org/2000/svg';
const UNIT = 100; // 칸 하나의 크기
const EDGE = 8; // 판 둘레에 두는 자리
const TAP = 22; // 이보다 적게 움직이면 누른 것으로 본다
const TINTS = 4; // 구역에 번갈아 칠하는 색의 수

const boards = new WeakMap();
let clips = 0; // 판마다 겹치지 않는 이름을 붙이려고 센다

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

/** 화면의 자리를 판의 자리(칸 하나가 100)로 바꾼다 */
function spotOf(svg, event) {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  return new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
}

function cellOfSpot(view, spot) {
  const x = Math.floor(spot.x / UNIT);
  const y = Math.floor(spot.y / UNIT);
  if (x < 0 || x >= view.w || y < 0 || y >= view.h) return null;
  const cell = y * view.w + x;
  return view.holes.includes(cell) ? null : cell;
}

/** 두 자리 사이를 잘게 나눠 지나는 칸들(그을 때 칸을 건너뛰지 않게) */
function cellsBetween(view, from, to) {
  const far = Math.hypot(to.x - from.x, to.y - from.y);
  // 칸의 구석을 비스듬히 스치고 지나가도 빠뜨리지 않게 잘게(칸의 25분의 1씩) 나눈다
  const parts = Math.max(1, Math.ceil(far / (UNIT / 25)));
  const cells = [];
  for (let at = 0; at <= parts; at++) {
    const cell = cellOfSpot(view, { x: from.x + ((to.x - from.x) * at) / parts, y: from.y + ((to.y - from.y) * at) / parts });
    if (cell !== null && !cells.includes(cell)) cells.push(cell);
  }
  return cells;
}

/**
 * 칸들의 둘레를 선으로 긋는다. 칸마다 네 변 가운데 이웃 칸이 같은 묶음에 없는 변만 긋고, 선은 그 칸들 안쪽에만 보이게 오려 낸다.
 * 그래서 이웃한 두 구역의 둘레가 겹치지 않는다.
 */
function outline(w, cells, className) {
  const has = new Set(cells);
  const inside = (x, y) => x >= 0 && x < w && y >= 0 && has.has(y * w + x);
  const parts = [];
  const id = `apart-clip-${(clips += 1)}`;
  const clip = make('clipPath', { id });
  for (const cell of cells) {
    const x = cell % w;
    const y = Math.floor(cell / w);
    clip.append(make('rect', { x: x * UNIT, y: y * UNIT, width: UNIT, height: UNIT }));
    const [left, right, top, bottom] = [x * UNIT, (x + 1) * UNIT, y * UNIT, (y + 1) * UNIT];
    if (!inside(x, y - 1)) parts.push(`M${left},${top}H${right}`);
    if (!inside(x, y + 1)) parts.push(`M${left},${bottom}H${right}`);
    if (!inside(x - 1, y)) parts.push(`M${left},${top}V${bottom}`);
    if (!inside(x + 1, y)) parts.push(`M${right},${top}V${bottom}`);
  }
  return [clip, make('path', { d: parts.join(''), 'clip-path': `url(#${id})` }, className)];
}

/** 구역마다 칠할 색: 변이 맞닿은 구역끼리는 되도록 다른 색 */
function tintsOf(w, regions) {
  const owner = new Map();
  regions.forEach((region, index) => region.forEach((cell) => owner.set(cell, index)));
  const tints = [];
  regions.forEach((region, index) => {
    const used = new Set();
    for (const cell of region) {
      const x = cell % w;
      for (const other of [cell - w, cell + w, x > 0 ? cell - 1 : -1, x < w - 1 ? cell + 1 : -1]) {
        const near = owner.get(other);
        if (near !== undefined && near < index) used.add(tints[near]);
      }
    }
    let tint = 0;
    while (used.has(tint) && tint < TINTS - 1) tint += 1;
    tints.push(tint);
  });
  return tints;
}

const centre = (w, cell) => [(cell % w) * UNIT + UNIT / 2, Math.floor(cell / w) * UNIT + UNIT / 2];

/** 구슬 하나 */
function marble(w, cell, className = 'ap-marble') {
  const [cx, cy] = centre(w, cell);
  const group = make('g', {}, className);
  group.append(make('circle', { cx, cy, r: 31 }, 'ap-marble-body'), make('circle', { cx: cx - 11, cy: cy - 11, r: 8 }, 'ap-marble-shine'));
  return group;
}

/** 그을 때 보이는 것: 지나간 칸들 */
function drawLive(board) {
  const { view, press, liveLayer } = board;
  const nodes = [];
  if (press?.drawing && view) {
    for (const cell of press.cells) {
      const x = (cell % view.w) * UNIT;
      const y = Math.floor(cell / view.w) * UNIT;
      nodes.push(make('rect', { x: x + 10, y: y + 10, width: UNIT - 20, height: UNIT - 20, rx: 12 }, 'ap-live'));
    }
  }
  liveLayer.replaceChildren(...nodes);
}

/** 그릴 자리에 판을 한 번 만들어 둔다. 손가락을 긋는 동안에도 판이 바뀌지 않게, 안의 것만 바꿔 그린다. */
function boardOf(root) {
  let board = boards.get(root);
  if (board && board.svg.parentNode === root) return board;
  const svg = make('svg', { preserveAspectRatio: 'xMidYMid meet' });
  const mainLayer = make('g');
  const liveLayer = make('g');
  svg.append(mainLayer, liveLayer);
  board = { svg, mainLayer, liveLayer, view: null, press: null };
  boards.set(root, board);

  const live = () => board.view && (board.view.onCell || board.view.onRegion);
  svg.addEventListener('pointerdown', (event) => {
    const view = board.view;
    if (!live()) return;
    const spot = spotOf(svg, event);
    if (!spot) return;
    const cell = cellOfSpot(view, spot);
    const drawing = view.pen === 'region' && Boolean(view.onRegion);
    board.press = { id: event.pointerId, start: spot, last: spot, cell, drawing, cells: drawing && cell !== null ? [cell] : [] };
    if (drawing) event.preventDefault();
    drawLive(board);
    try {
      svg.setPointerCapture(event.pointerId);
    } catch {
      // 붙잡지 못해도 누르는 것은 그대로 된다.
    }
  });
  svg.addEventListener('pointermove', (event) => {
    const press = board.press;
    const view = board.view;
    if (!press || !view || press.id !== event.pointerId || !press.drawing) return;
    const spot = spotOf(svg, event);
    if (!spot) return;
    for (const cell of cellsBetween(view, press.last, spot)) if (!press.cells.includes(cell)) press.cells.push(cell);
    press.last = spot;
    drawLive(board);
  });
  svg.addEventListener('pointerup', (event) => {
    const press = board.press;
    if (!press || press.id !== event.pointerId) return;
    const view = board.view;
    board.press = null;
    drawLive(board);
    if (!view) return;
    const spot = spotOf(svg, event) ?? press.last;
    const tap = Math.hypot(spot.x - press.start.x, spot.y - press.start.y) <= TAP;
    if (press.drawing) {
      for (const cell of cellsBetween(view, press.last, spot)) if (!press.cells.includes(cell)) press.cells.push(cell);
      if (press.cells.length === 0) return;
      view.onRegion(tap ? [press.cells[0]] : press.cells.slice(), { tap: tap || press.cells.length === 1 });
      return;
    }
    if (tap && press.cell !== null && view.onCell) view.onCell(press.cell);
  });
  svg.addEventListener('pointercancel', () => {
    board.press = null;
    drawLive(board);
  });
  // 글자판으로도 누를 수 있다: 칸에 눈길을 두고 들이기나 빈칸.
  svg.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const view = board.view;
    const target = event.target.closest?.('[data-cell]');
    if (!live() || !target) return;
    event.preventDefault();
    const cell = Number(target.dataset.cell);
    if (view.pen === 'region' && view.onRegion) view.onRegion([cell], { tap: true });
    else view.onCell?.(cell);
  });
  root.replaceChildren(svg);
  return board;
}

/**
 * 판을 그린다.
 * @param {HTMLElement} root 그릴 자리(안의 것을 모두 바꾼다)
 * @param {object} view
 *   w, h, holes, touch   판
 *   marbles      놓인 구슬의 칸들
 *   regions      구역들(구역마다 칸 번호들)
 *   pairs        구역마다 구슬이 둘 들어가는 두 칸(없으면 null). 있으면 그 구역은 점선 둘레다
 *   near         빗금을 그을 칸들(구슬과 닿는 칸)
 *   refused      놓으려다 닿은 칸(없으면 null)
 *   hit          그때 닿은 구슬들
 *   pen          'marble'(칸을 누르면 onCell) | 'region'(칸을 따라 그으면 onRegion)
 *   onCell       (칸) → 칸을 눌렀을 때
 *   onRegion     (칸들, { tap }) → 칸을 따라 그었거나(tap이 false) 칸 하나를 눌렀을 때
 *   label        (칸) → 읽어 줄 이름(누를 수 있는 판에서만)
 *   small        작은 그림으로 그린다
 */
export function drawBoard(root, view) {
  const { w, h, holes = [], marbles = [], regions = [], pairs = [], near = [], refused = null, hit = [], pen = 'marble', small = false } = view;
  const live = Boolean(view.onCell || view.onRegion);
  root.className = `block-board ap-board${small ? ' small' : ''}${live ? ' live' : ''}${live && pen === 'region' ? ' drawing' : ''}`;
  root.style.setProperty('--w', String(w));
  root.style.setProperty('--h', String(h));
  const board = boardOf(root);
  const { svg } = board;
  const focused = svg.contains(document.activeElement) ? document.activeElement.dataset?.cell : undefined;
  svg.setAttribute('viewBox', `${-EDGE} ${-EDGE} ${w * UNIT + 2 * EDGE} ${h * UNIT + 2 * EDGE}`);
  svg.setAttribute('class', 'block-svg ap-svg');
  if (live) svg.removeAttribute('aria-hidden');
  else svg.setAttribute('aria-hidden', 'true');

  const gone = new Set(holes);
  const nodes = [];
  // 칸
  for (let cell = 0; cell < w * h; cell++) {
    const x = (cell % w) * UNIT;
    const y = Math.floor(cell / w) * UNIT;
    if (gone.has(cell)) {
      nodes.push(make('rect', { x: x + 12, y: y + 12, width: UNIT - 24, height: UNIT - 24, rx: 10 }, 'block-hole'));
      continue;
    }
    const group = make('g', { 'data-cell': cell }, 'ap-cell-group');
    group.append(make('rect', { x, y, width: UNIT, height: UNIT }, 'ap-cell'));
    if (live) {
      group.setAttribute('tabindex', '0');
      group.setAttribute('role', 'button');
      if (view.label) group.setAttribute('aria-label', view.label(cell));
    }
    nodes.push(group);
  }
  // 구역: 옅은 색과 둘레
  const tints = tintsOf(w, regions);
  regions.forEach((region, index) => {
    for (const cell of region) {
      const [cx, cy] = centre(w, cell);
      nodes.push(make('rect', { x: cx - UNIT / 2 + 4, y: cy - UNIT / 2 + 4, width: UNIT - 8, height: UNIT - 8 }, `ap-region-fill tint-${tints[index]}`));
    }
  });
  regions.forEach((region, index) => nodes.push(...outline(w, region, pairs[index] ? 'ap-region bad' : 'ap-region')));
  // 닿는 칸: 빗금
  for (const cell of near) {
    const x = (cell % w) * UNIT;
    const y = Math.floor(cell / w) * UNIT;
    const group = make('g', {}, 'ap-near');
    for (const [x1, y1, x2, y2] of [
      [18, 50, 50, 18],
      [18, 82, 82, 18],
      [50, 82, 82, 50],
    ]) {
      group.append(make('line', { x1: x + x1, y1: y + y1, x2: x + x2, y2: y + y2 }));
    }
    nodes.push(group);
  }
  // 구슬, 닿은 구슬의 고리
  for (const cell of marbles) nodes.push(marble(w, cell));
  for (const cell of hit) {
    const [cx, cy] = centre(w, cell);
    nodes.push(make('circle', { cx, cy, r: 42 }, 'ap-hit'));
  }
  // 구슬이 둘 들어가는 구역의 두 칸, 놓으려다 닿은 칸: 점선 동그라미
  // 구슬이 이미 놓인 칸은 구슬을 가리지 않게 구슬 둘레에 점선 고리를 두른다
  const placed = new Set(marbles);
  pairs.forEach((pair) => {
    if (!pair) return;
    for (const cell of pair) {
      const [cx, cy] = centre(w, cell);
      nodes.push(placed.has(cell) ? make('circle', { cx, cy, r: 42 }, 'ap-ghost ring') : make('circle', { cx, cy, r: 30 }, 'ap-ghost'));
    }
  });
  if (refused !== null) {
    const [cx, cy] = centre(w, refused);
    nodes.push(make('circle', { cx, cy, r: 30 }, 'ap-ghost refused'));
  }
  nodes.push(make('rect', { x: 0, y: 0, width: w * UNIT, height: h * UNIT }, 'ap-frame'));
  board.mainLayer.replaceChildren(...nodes);
  board.view = { ...view, w, h, holes, pen };
  board.press = null;
  drawLive(board);
  if (focused !== undefined) svg.querySelector(`[data-cell="${focused}"]`)?.focus?.();
}

/**
 * 판 하나를 담은 새 조각을 만든다(풀이, "왜 그럴까?", 직접 만들기의 그림). 아래에 한 줄 글을 붙일 수 있다.
 * @param {object} view drawBoard에 건네는 것
 * @param {string} note 아래에 붙이는 글
 * @param {{big?: boolean}} options big: 종이에 하나만 크게 그린다
 */
export function boardCard(view, note, { big = false } = {}) {
  const card = el('div', big ? 'block-card ap-card big' : 'block-card ap-card');
  const picture = el('div');
  card.append(picture);
  drawBoard(picture, { ...view, small: true });
  if (note) card.append(el('p', 'strip-note', note));
  return card;
}
