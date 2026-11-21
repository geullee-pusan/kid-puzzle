// 구역 지도 맞히기의 판을 그린다: 네모 칸들, 칠한 구역, 물은 네모, 고르는 중인 네모.
// 누를 수 있는 판과 보기만 하는 그림(작은 그림, 풀이, "왜 그럴까?", 직접 만들기)을 같은 모양으로 그린다.
// 색만으로 알리지 않는다. 구역마다 색과 함께 칸 가운데의 무늬가 다르다(숲은 세모 나무, 바다는 물결 두 줄, 모래밭은 점 셋, 들판은 풀 세 포기).
// 물은 네모는 옅은 점선 테두리와 왼쪽 위 구석의 번호로 남는다. 눈에 띄게 한 물음(목록에서 누른 것, 맞지 않는 물음)은 굵은 테두리다.
// 고르는 중인 네모는 굵은 금빛 테두리와 옅은 금빛 바탕, 한 모서리만 고른 칸은 금빛 점선 테두리다.
// 누르는 것은 pointer 이벤트로 받는다.
//   묻는 판(pen 'ask'): 한 칸에서 다른 칸으로 끌면 그 두 칸을 모서리로 하는 네모(onPick(from, to, { tap: false })),
//                       끌지 않고 누르면 칸 하나(onPick(cell, cell, { tap: true })). 두 번 눌러 고르는 것은 형식이 맡는다.
//   칠하는 판(pen 'paint'): 누르거나 끌고 지나간 칸들(onPaint(cells, { tap })).
// 글자판으로는 칸마다 Enter와 빈칸 글쇠로 누른다(누른 것과 같다). 글자(읽어 주는 이름)는 형식이 대본에서 채워 건넨다.

const NS = 'http://www.w3.org/2000/svg';
/** 칸 하나의 크기(그림 안의 길이) */
export const UNIT = 100;
const EDGE = 10; // 판 둘레에 두는 자리
const TAP = 0.3; // 이보다 적게(칸 단위) 움직이고 같은 칸에서 떼면 누른 것으로 본다

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

/** 칸 가운데의 무늬(이름표마다 다르다). (x, y)는 칸의 왼쪽 위 */
function glyph(label, x, y) {
  const group = make('g', {}, `rm-glyph g${label}`);
  const cx = x + UNIT / 2;
  const cy = y + UNIT / 2;
  if (label === 0) {
    // 숲: 세모 나무와 줄기
    group.append(make('polygon', { points: `${cx},${cy - 26} ${cx + 20},${cy + 10} ${cx - 20},${cy + 10}` }), make('rect', { x: cx - 4, y: cy + 10, width: 8, height: 14 }));
  } else if (label === 1) {
    // 바다: 물결 두 줄
    for (const dy of [-10, 12]) group.append(make('path', { d: `M${cx - 26},${cy + dy} q 9,-12 18,0 t 18,0 t 18,0` }));
  } else if (label === 2) {
    // 모래밭: 점 셋
    for (const [dx, dy] of [[-15, 10], [0, -12], [15, 10]]) group.append(make('circle', { cx: cx + dx, cy: cy + dy, r: 6 }));
  } else {
    // 들판: 풀 세 포기
    for (const dx of [-16, 0, 16]) group.append(make('path', { d: `M${cx + dx - 7},${cy - 8} L${cx + dx},${cy + 14} L${cx + dx + 7},${cy - 8}` }));
  }
  return group;
}

/** 구역 이름표 하나의 견본(고르는 단추에 넣는 작은 그림) */
export function swatch(label) {
  const svg = make('svg', { viewBox: `0 0 ${UNIT} ${UNIT}`, 'aria-hidden': 'true' }, 'rm-swatch');
  if (label === null) {
    // 지우개: 빈 칸에 빗금 하나
    svg.append(make('rect', { x: 4, y: 4, width: UNIT - 8, height: UNIT - 8 }, 'rm-cell'), make('path', { d: 'M24,76 L76,24' }, 'rm-erase-mark'));
    return svg;
  }
  svg.append(make('rect', { x: 4, y: 4, width: UNIT - 8, height: UNIT - 8 }, `rm-fill r${label}`), glyph(label, 0, 0));
  return svg;
}

/** 화면의 자리를 칸 단위의 자리로 */
function spotOf(svg, event) {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  const spot = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  return [spot.x / UNIT, spot.y / UNIT];
}

function cellAt(view, spot) {
  if (!spot) return null;
  const x = Math.floor(spot[0]);
  const y = Math.floor(spot[1]);
  if (x < 0 || y < 0 || x >= view.w || y >= view.h) return null;
  return y * view.w + x;
}

/** 두 자리 사이를 잘게 나눠 지나는 칸들(끌 때 칸을 건너뛰지 않게) */
function cellsBetween(view, from, to) {
  const far = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const parts = Math.max(1, Math.ceil(far * 20));
  const cells = [];
  for (let at = 0; at <= parts; at++) {
    const cell = cellAt(view, [from[0] + ((to[0] - from[0]) * at) / parts, from[1] + ((to[1] - from[1]) * at) / parts]);
    if (cell !== null && !cells.includes(cell)) cells.push(cell);
  }
  return cells;
}

const rectBetween = (a, b, w) => [Math.min(a % w, b % w), Math.min(Math.floor(a / w), Math.floor(b / w)), Math.max(a % w, b % w), Math.max(Math.floor(a / w), Math.floor(b / w))];

/** 끄는 동안 보이는 것: 묻는 판은 고르는 중인 네모, 칠하는 판은 지나간 칸들 */
function drawLive(board) {
  const { view, press, liveLayer } = board;
  const nodes = [];
  if (press && view && press.moved) {
    if (view.pen === 'ask' && press.cell !== null && press.now !== null) {
      const [x0, y0, x1, y1] = rectBetween(press.cell, press.now, view.w);
      nodes.push(make('rect', { x: x0 * UNIT + 4, y: y0 * UNIT + 4, width: (x1 - x0 + 1) * UNIT - 8, height: (y1 - y0 + 1) * UNIT - 8, rx: 10 }, 'rm-pick'));
    }
    if (view.pen === 'paint') {
      for (const cell of press.cells) {
        const x = (cell % view.w) * UNIT;
        const y = Math.floor(cell / view.w) * UNIT;
        nodes.push(make('rect', { x: x + 12, y: y + 12, width: UNIT - 24, height: UNIT - 24, rx: 12 }, 'rm-live'));
      }
    }
  }
  liveLayer.replaceChildren(...nodes);
}

/** 그릴 자리에 판을 한 번 만들어 둔다. 손가락을 끄는 동안에도 판이 바뀌지 않게, 안의 것만 바꿔 그린다. */
function boardOf(root) {
  let board = boards.get(root);
  if (board && board.svg.parentNode === root) return board;
  const svg = make('svg', { preserveAspectRatio: 'xMidYMid meet' }, 'rm-svg');
  const mainLayer = make('g');
  const liveLayer = make('g');
  svg.append(mainLayer, liveLayer);
  board = { svg, mainLayer, liveLayer, view: null, press: null };
  boards.set(root, board);

  const live = () => board.view && (board.view.onPick || board.view.onPaint);
  svg.addEventListener('pointerdown', (event) => {
    const view = board.view;
    if (!live()) return;
    const spot = spotOf(svg, event);
    const cell = cellAt(view, spot);
    if (cell === null) return;
    event.preventDefault();
    board.press = { id: event.pointerId, start: spot, last: spot, cell, now: cell, moved: false, cells: [cell] };
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
    if (!press || !view || press.id !== event.pointerId) return;
    const spot = spotOf(svg, event);
    if (!spot) return;
    if (Math.hypot(spot[0] - press.start[0], spot[1] - press.start[1]) > TAP) press.moved = true;
    for (const cell of cellsBetween(view, press.last, spot)) if (!press.cells.includes(cell)) press.cells.push(cell);
    const now = cellAt(view, spot);
    if (now !== null) press.now = now;
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
    const end = cellAt(view, spot) ?? press.now;
    const tap = !press.moved || end === press.cell;
    if (view.pen === 'paint' && view.onPaint) {
      for (const cell of cellsBetween(view, press.last, spot)) if (!press.cells.includes(cell)) press.cells.push(cell);
      view.onPaint(tap && press.cells.length <= 1 ? [press.cell] : press.cells.slice(), { tap: tap && press.cells.length <= 1 });
      return;
    }
    if (view.onPick) view.onPick(press.cell, tap ? press.cell : end, { tap });
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
    if (view.pen === 'paint') view.onPaint?.([cell], { tap: true });
    else view.onPick?.(cell, cell, { tap: true });
  });
  root.replaceChildren(svg);
  return board;
}

/**
 * 판을 그린다.
 * @param {HTMLElement} root 그릴 자리(안의 것을 모두 바꾼다)
 * @param {object} view
 *   w, h       판의 크기
 *   paint      칸마다 칠한 구역의 이름표(-1은 칠하지 않은 칸)
 *   asks       물은 네모들 [{ rect, no }](no는 왼쪽 위 구석에 적는 번호. 없으면 적지 않는다)
 *   strong     눈에 띄게 할 물음의 차례들(asks 안의 자리)
 *   pick       고르는 중인 네모(없으면 null)
 *   anchor     한 모서리만 고른 칸(없으면 null)
 *   pen        'ask' | 'paint'(누를 수 있는 판에서만)
 *   onPick     (칸, 칸, { tap }) → 네모를 골랐을 때
 *   onPaint    (칸들, { tap }) → 칠했을 때
 *   label      (칸) → 읽어 줄 이름(누를 수 있는 판에서만)
 *   small      작은 그림으로 그린다
 */
export function drawRegionmap(root, view) {
  const { w, h, paint = [], asks = [], strong = [], pick = null, anchor = null, pen = null, small = false } = view;
  const live = typeof view.onPick === 'function' || typeof view.onPaint === 'function';
  root.className = `rm-board${small ? ' small' : ''}${live ? ` live pen-${pen}` : ''}`;
  root.style.setProperty('--w', String(w));
  root.style.setProperty('--h', String(h));
  const board = boardOf(root);
  const { svg } = board;
  const focused = svg.contains(document.activeElement) ? document.activeElement.dataset?.cell : undefined;
  svg.setAttribute('viewBox', `${-EDGE} ${-EDGE} ${w * UNIT + 2 * EDGE} ${h * UNIT + 2 * EDGE}`);
  if (live) svg.removeAttribute('aria-hidden');
  else svg.setAttribute('aria-hidden', 'true');

  const nodes = [];
  for (let cell = 0; cell < w * h; cell++) {
    const x = (cell % w) * UNIT;
    const y = Math.floor(cell / w) * UNIT;
    const label = paint[cell] ?? -1;
    const group = make('g', { 'data-cell': cell }, 'rm-cell-group');
    group.append(make('rect', { x, y, width: UNIT, height: UNIT }, label >= 0 ? `rm-fill r${label}` : 'rm-cell'));
    if (label >= 0) group.append(glyph(label, x, y));
    if (live) {
      group.setAttribute('tabindex', '0');
      group.setAttribute('role', 'button');
      if (view.label) group.setAttribute('aria-label', view.label(cell));
    }
    nodes.push(group);
  }
  // 칸의 금(가는 선)
  const grid = [];
  for (let x = 0; x <= w; x++) grid.push(`M${x * UNIT},0V${h * UNIT}`);
  for (let y = 0; y <= h; y++) grid.push(`M0,${y * UNIT}H${w * UNIT}`);
  nodes.push(make('path', { d: grid.join('') }, 'rm-grid'));
  // 물은 네모: 옅은 점선 테두리(눈에 띄게 한 것은 굵게)와 번호
  const marks = new Set(strong);
  asks.forEach((entry, at) => {
    const [x0, y0, x1, y1] = entry.rect;
    const inset = 6 + (at % 3) * 4;
    nodes.push(make('rect', { x: x0 * UNIT + inset, y: y0 * UNIT + inset, width: (x1 - x0 + 1) * UNIT - 2 * inset, height: (y1 - y0 + 1) * UNIT - 2 * inset, rx: 8 }, marks.has(at) ? 'rm-ask strong' : 'rm-ask'));
  });
  asks.forEach((entry, at) => {
    if (entry.no === undefined) return;
    const [x0, y0] = entry.rect;
    const inset = 6 + (at % 3) * 4;
    const tag = make('g', {}, marks.has(at) ? 'rm-no strong' : 'rm-no');
    tag.append(make('circle', { cx: x0 * UNIT + inset + 15, cy: y0 * UNIT + inset + 15, r: 15 }));
    const text = make('text', { x: x0 * UNIT + inset + 15, y: y0 * UNIT + inset + 21 });
    text.textContent = String(entry.no);
    tag.append(text);
    nodes.push(tag);
  });
  if (anchor !== null && anchor !== undefined) {
    const x = (anchor % w) * UNIT;
    const y = Math.floor(anchor / w) * UNIT;
    nodes.push(make('rect', { x: x + 4, y: y + 4, width: UNIT - 8, height: UNIT - 8, rx: 10 }, 'rm-anchor'));
  }
  if (pick) {
    const [x0, y0, x1, y1] = pick;
    nodes.push(make('rect', { x: x0 * UNIT + 4, y: y0 * UNIT + 4, width: (x1 - x0 + 1) * UNIT - 8, height: (y1 - y0 + 1) * UNIT - 8, rx: 10 }, 'rm-pick'));
  }
  board.mainLayer.replaceChildren(...nodes);
  board.view = { ...view, w, h, pen };
  if (focused !== undefined) svg.querySelector(`[data-cell="${focused}"]`)?.focus?.();
}

/**
 * 판 하나를 담은 새 조각을 만든다(풀이, "왜 그럴까?"의 그림, 직접 만들기의 그림).
 * @param {object} view drawRegionmap에 건네는 것
 * @param {string} note 아래에 붙이는 글
 * @param {{big?: boolean, mid?: boolean}} options big: 한 장을 크게, mid: 두 장을 나란히
 */
export function regionCard(view, note, { big = false, mid = false } = {}) {
  const card = el('div', big ? 'rm-card big' : mid ? 'rm-card mid' : 'rm-card');
  const picture = el('div');
  card.append(picture);
  drawRegionmap(picture, { ...view, small: !big });
  if (note) card.append(el('p', 'strip-note', note));
  return card;
}
