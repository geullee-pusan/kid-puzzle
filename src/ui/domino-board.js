// 도미노 가로세로의 판을 그린다: 네모 칸들, 구멍, 놓인 도미노, 한쪽만 놓을 수 있는 자리.
// 누를 수 있는 판과 보기만 하는 그림을 같은 모양으로 그린다.
// 색만으로 알리지 않는다. 도미노는 놓인 방향 그대로(세로는 위아래로 길게, 가로는 옆으로 길게) 그리고 가운데에 금을 긋는다.
// 세로 도미노는 파랑에 세로줄 무늬, 가로 도미노는 주황에 가로줄 무늬다. 구멍은 어둡게 메우고 빗금을 긋는다.
// 방금 놓인 도미노에는 굵은 점선 고리를 두르고, 골라 둔 칸에는 굵은 테두리를 두른다.
// 한쪽만 놓을 수 있는 자리는 그 쪽의 색으로 점선 테두리를 두르고 가운데에 그 방향의 양쪽 화살표를 긋는다. 글자는 대본에서 받는다.
// 누르는 것은 pointer 이벤트로 받는다. 빈칸에서 이웃한 빈칸으로 끌면 두 칸이 눈에 띄고, 손을 떼면 그 두 칸을 알려 준다. 한 칸만 누르면 그 칸을 알려 준다.

const NS = 'http://www.w3.org/2000/svg';
const UNIT = 100; // 칸 하나의 크기
const EDGE = 6; // 판 둘레에 두는 자리
const INSET = 9; // 도미노가 칸의 금에서 안으로 들어가는 만큼

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

/** 두 칸을 덮는 네모(왼쪽 위 칸과 오른쪽 아래 칸으로) */
function spanOf(w, cells, inset) {
  const [ax, ay] = xyOf(w, Math.min(...cells));
  const [bx, by] = xyOf(w, Math.max(...cells));
  return { x: ax * UNIT + inset, y: ay * UNIT + inset, width: (bx - ax + 1) * UNIT - 2 * inset, height: (by - ay + 1) * UNIT - 2 * inset };
}

/** 도미노 하나: 둥근 네모, 가운데 금, 방향의 줄무늬 */
function domino(w, item) {
  const group = make('g', {}, `dm-domino ${item.side}`);
  const box = spanOf(w, item.cells, INSET);
  group.append(make('rect', { ...box, rx: 16 }, 'dm-tile'));
  const midX = box.x + box.width / 2;
  const midY = box.y + box.height / 2;
  if (item.side === 'vert') {
    group.append(make('line', { x1: box.x + 10, y1: midY, x2: box.x + box.width - 10, y2: midY }, 'dm-seam'));
    for (const top of [box.y + 18, midY + 14]) group.append(make('line', { x1: midX, y1: top, x2: midX, y2: top + box.height / 2 - 32 }, 'dm-stripe'));
  } else {
    group.append(make('line', { x1: midX, y1: box.y + 10, x2: midX, y2: box.y + box.height - 10 }, 'dm-seam'));
    for (const left of [box.x + 18, midX + 14]) group.append(make('line', { x1: left, y1: midY, x2: left + box.width / 2 - 32, y2: midY }, 'dm-stripe'));
  }
  return group;
}

/** 한쪽만 놓을 수 있는 자리 하나: 그 쪽 색의 점선 테두리와 양쪽 화살표 */
function safeMark(w, side, cells) {
  const group = make('g', {}, `dm-safe ${side}`);
  const box = spanOf(w, cells, 14);
  group.append(make('rect', { ...box, rx: 14 }, 'dm-safe-box'));
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const half = (side === 'vert' ? box.height : box.width) / 2 - 22;
  const [dx, dy] = side === 'vert' ? [0, 1] : [1, 0];
  group.append(make('line', { x1: cx - dx * half, y1: cy - dy * half, x2: cx + dx * half, y2: cy + dy * half }, 'dm-safe-line'));
  for (const sign of [-1, 1]) {
    const tipX = cx + sign * dx * (half + 6);
    const tipY = cy + sign * dy * (half + 6);
    const back = 16;
    const wing = 12;
    const points = side === 'vert' ? [[tipX, tipY], [tipX - wing, tipY - sign * back], [tipX + wing, tipY - sign * back]] : [[tipX, tipY], [tipX - sign * back, tipY - wing], [tipX - sign * back, tipY + wing]];
    group.append(make('polygon', { points: points.map((point) => point.join(',')).join(' ') }, 'dm-safe-head'));
  }
  return group;
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

const isLive = (view) => Boolean(view.onPair || view.onTap || view.onCell);
const isOpen = (view, cell) => !view.holes.includes(cell) && !view.placed.some((item) => item.cells.includes(cell));
const touching = (w, a, b) => {
  const [ax, ay] = xyOf(w, a);
  const [bx, by] = xyOf(w, b);
  return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
};

/** 끄는 동안 지나온 칸(둘까지)에 테두리를 두른다 */
function drawTrace(board) {
  const { view, press, traceLayer } = board;
  const cells = press && press.kind === 'stroke' ? press.path : [];
  traceLayer.replaceChildren(...cells.map((cell) => make('rect', { x: (cell % view.w) * UNIT + 5, y: Math.floor(cell / view.w) * UNIT + 5, width: UNIT - 10, height: UNIT - 10, rx: 12 }, 'dm-pick')));
}

/** 그릴 자리에 판을 한 번 만들어 둔다. 손가락으로 끄는 동안에도 판이 바뀌지 않게, 안의 것만 바꿔 그린다. */
function boardOf(root) {
  let board = boards.get(root);
  if (board && board.svg.parentNode === root) return board;
  const svg = make('svg', { preserveAspectRatio: 'xMidYMid meet' });
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
    const cell = cellAt(svg, view, event);
    if (cell === null) return;
    event.preventDefault();
    const kind = view.onCell ? 'cell' : isOpen(view, cell) ? 'stroke' : 'none';
    board.press = { id: event.pointerId, kind, cell, path: [cell] };
    drawTrace(board);
    try {
      svg.setPointerCapture(event.pointerId);
    } catch {
      // 붙잡지 못해도 누르는 것은 그대로 된다.
    }
  });
  svg.addEventListener('pointermove', (event) => {
    const { press, view } = board;
    if (!press || !view || press.id !== event.pointerId || press.kind !== 'stroke') return;
    const cell = cellAt(svg, view, event);
    if (cell === null || cell === press.path.at(-1)) return;
    // 처음 칸으로 되돌아오면 끈 것을 무르고, 처음 칸과 맞닿은 빈칸이면 그 칸으로 바꾼다(두 칸까지만).
    if (cell === press.cell) press.path = [press.cell];
    else if (isOpen(view, cell) && touching(view.w, press.cell, cell)) press.path = [press.cell, cell];
    else return;
    drawTrace(board);
  });
  svg.addEventListener('pointerup', (event) => {
    const press = board.press;
    if (!press || press.id !== event.pointerId) return;
    const view = board.view;
    const end = view ? cellAt(svg, view, event) : null;
    letGo();
    if (!view) return;
    if (press.kind === 'cell') {
      if (end === press.cell) view.onCell(press.cell);
    } else if (press.kind === 'stroke') {
      if (press.path.length === 2) view.onPair?.(press.path.slice());
      else if (end === press.cell) view.onTap?.(press.cell);
    }
  });
  svg.addEventListener('pointercancel', letGo);
  // 글자판으로도 누를 수 있다.
  svg.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const view = board.view;
    const target = event.target.closest?.('[data-cell]');
    if (!view || !isLive(view) || !target) return;
    event.preventDefault();
    const cell = Number(target.dataset.cell);
    if (view.onCell) view.onCell(cell);
    else if (isOpen(view, cell)) view.onTap?.(cell);
  });
  root.replaceChildren(svg);
  return board;
}

/**
 * 판을 그린다.
 * @param {HTMLElement} root 그릴 자리(안의 것을 모두 바꾼다)
 * @param {object} view
 *   w, h     가로와 세로의 칸 수
 *   holes    구멍 난 칸들
 *   placed   놓인 도미노들 { cells: [a, b], side: 'vert' | 'horz' }(놓은 차례대로)
 *   fresh    방금 놓인 도미노의 차례(없으면 -1)
 *   pick     골라 둔 칸(없으면 null)
 *   safe     한쪽만 놓을 수 있는 자리 { vert: [[a, b]…], horz: [[a, b]…] }. 없으면 그리지 않는다
 *   label    (칸 번호) → 읽어 줄 이름(누를 수 있는 판에서만)
 *   onPair   (두 칸) → 빈칸에서 이웃한 빈칸으로 끌고 손을 뗐을 때
 *   onTap    (칸 번호) → 빈칸 하나를 눌렀을 때
 *   onCell   (칸 번호) → 어느 칸이든 눌렀을 때(직접 만들기). 이것이 있으면 끌기는 받지 않는다
 *   small    작은 그림으로 그린다
 */
export function drawBoard(root, view) {
  const { w, h, holes = [], placed = [], fresh = -1, pick = null, safe = null, small = false } = view;
  const live = isLive(view);
  root.className = `dm-board${small ? ' small' : ''}${live ? ' live' : ''}`;
  root.style.setProperty('--w', String(w));
  root.style.setProperty('--h', String(h));
  const board = boardOf(root);
  const { svg } = board;
  const focused = svg.contains(document.activeElement) ? document.activeElement.dataset.cell : undefined;
  svg.setAttribute('viewBox', `${-EDGE} ${-EDGE} ${w * UNIT + 2 * EDGE} ${h * UNIT + 2 * EDGE}`);
  svg.setAttribute('class', 'dm-svg');
  if (live) svg.removeAttribute('aria-hidden');
  else svg.setAttribute('aria-hidden', 'true');

  const nodes = [];
  for (let cell = 0; cell < w * h; cell++) {
    const [x, y] = xyOf(w, cell);
    const group = make('g', { 'data-cell': cell }, 'dm-cell-group');
    if (holes.includes(cell)) {
      group.append(make('rect', { x: x * UNIT + 3, y: y * UNIT + 3, width: UNIT - 6, height: UNIT - 6, rx: 8 }, 'dm-hole'));
      for (const [x1, y1, x2, y2] of [[22, 52, 52, 22], [22, 78, 78, 22], [48, 78, 78, 48]]) group.append(make('line', { x1: x * UNIT + x1, y1: y * UNIT + y1, x2: x * UNIT + x2, y2: y * UNIT + y2 }, 'dm-hatch'));
    } else {
      group.append(make('rect', { x: x * UNIT, y: y * UNIT, width: UNIT, height: UNIT }, 'dm-cell'));
    }
    if (live && view.label) {
      group.setAttribute('tabindex', '0');
      group.setAttribute('role', 'button');
      group.setAttribute('aria-label', view.label(cell));
    }
    nodes.push(group);
  }
  if (safe) for (const side of ['vert', 'horz']) for (const cells of safe[side] ?? []) nodes.push(safeMark(w, side, cells));
  placed.forEach((item) => nodes.push(domino(w, item)));
  if (fresh >= 0 && placed[fresh]) nodes.push(make('rect', { ...spanOf(w, placed[fresh].cells, 2), rx: 20 }, 'dm-fresh'));
  if (pick !== null) nodes.push(make('rect', { x: (pick % w) * UNIT + 5, y: Math.floor(pick / w) * UNIT + 5, width: UNIT - 10, height: UNIT - 10, rx: 12 }, 'dm-pick'));

  board.mainLayer.replaceChildren(...nodes);
  board.view = { ...view, w, h, holes, placed };
  board.press = null;
  drawTrace(board);
  if (focused !== undefined) svg.querySelector(`[data-cell="${focused}"]`)?.focus?.();
}

/** 한쪽만 놓을 수 있는 자리의 수를 적는 줄 하나에 붙이는 작은 그림(그 쪽의 자리 모양) */
export function safeIcon(side) {
  const svg = make('svg', { viewBox: side === 'vert' ? '0 0 100 200' : '0 0 200 100', 'aria-hidden': 'true' }, `dm-icon ${side}`);
  svg.append(safeMark(side === 'vert' ? 1 : 2, side, side === 'vert' ? [0, 1] : [0, 1]));
  return svg;
}

/**
 * 판 하나를 담은 새 조각을 만든다(다시 보기, 풀이, "왜 그럴까?"의 그림).
 * @param {object} view drawBoard에 건네는 것
 * @param {string} note 아래에 붙이는 글
 * @param {{big?: boolean}} options
 */
export function boardCard(view, note, { big = false } = {}) {
  const card = el('div', big ? 'dm-card big' : 'dm-card');
  const picture = el('div');
  card.append(picture);
  drawBoard(picture, { ...view, small: true });
  if (note) card.append(el('p', 'strip-note', note));
  return card;
}
