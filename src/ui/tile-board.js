// 조각 덮기의 판을 그린다: 네모 칸들, 빠진 칸, 놓인 조각, 판에 입힌 무늬.
// 누를 수 있는 판과 보기만 하는 그림을 같은 모양으로 그린다.
// 색만으로 알리지 않는다. 조각은 굵은 테두리로 하나씩 가르고, 빠진 칸은 어둡게 메우고 빗금을 긋는다.
// 무늬를 입히면 색마다 칸 가운데에 작은 모양(동그라미, 세모, 네모)도 함께 그린다.
// 조각이 들어갈 수 없는 빈칸에는 굵은 점선 테두리를 두른다. 글자는 대본에서 받는다.
// 누르는 것은 pointer 이벤트로 받는다. 칸을 따라 그으면 지나는 칸이 눈에 띄고, 손을 떼면 그 칸들을 알려 준다.

const NS = 'http://www.w3.org/2000/svg';
const UNIT = 100; // 칸 하나의 크기
const EDGE = 4; // 판 둘레에 두는 자리
const INSET = 8; // 조각의 테두리가 칸의 금에서 안으로 들어가는 만큼

/** 무늬의 색마다 그리는 모양 */
export const MARKS = { checker: ['circle', 'square'], stripe: ['circle', 'triangle', 'square'], back: ['circle', 'triangle', 'square'] };

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

const colorAt = (pattern, x, y) => (pattern === 'checker' ? (x + y) % 2 : pattern === 'stripe' ? (x + y) % 3 : pattern === 'back' ? (x + 2 * y) % 3 : 0);

/** 작은 모양 하나(가운데가 cx, cy) */
function markShape(kind, cx, cy, r) {
  if (kind === 'circle') return make('circle', { cx, cy, r }, 'tile-mark');
  if (kind === 'square') return make('rect', { x: cx - r, y: cy - r, width: 2 * r, height: 2 * r }, 'tile-mark');
  return make('polygon', { points: `${cx},${cy - r * 1.15} ${cx + r * 1.1},${cy + r * 0.85} ${cx - r * 1.1},${cy + r * 0.85}` }, 'tile-mark');
}

/** 조각 하나의 테두리(꼭짓점들). 한 줄로 나란한 칸은 네모, ㄱ자는 여섯 꼭짓점이다 */
function outlineOf(w, cells) {
  const spots = cells.map((cell) => [cell % w, Math.floor(cell / w)]);
  const xs = spots.map((spot) => spot[0]);
  const ys = spots.map((spot) => spot[1]);
  const left = Math.min(...xs) * UNIT + INSET;
  const right = (Math.max(...xs) + 1) * UNIT - INSET;
  const top = Math.min(...ys) * UNIT + INSET;
  const bottom = (Math.max(...ys) + 1) * UNIT - INSET;
  const box = (Math.max(...xs) - Math.min(...xs) + 1) * (Math.max(...ys) - Math.min(...ys) + 1);
  if (box === cells.length) return [[left, top], [right, top], [right, bottom], [left, bottom]];
  // ㄱ자: 두 칸짜리 네모에서 한 칸이 빈다. 빈 칸 쪽의 꼭짓점을 안으로 꺾는다.
  const midX = (Math.min(...xs) + 1) * UNIT;
  const midY = (Math.min(...ys) + 1) * UNIT;
  const has = (x, y) => spots.some((spot) => spot[0] === x && spot[1] === y);
  const [x0, y0] = [Math.min(...xs), Math.min(...ys)];
  if (!has(x0 + 1, y0)) return [[left, top], [midX - INSET, top], [midX - INSET, midY + INSET], [right, midY + INSET], [right, bottom], [left, bottom]];
  if (!has(x0, y0)) return [[midX + INSET, top], [right, top], [right, bottom], [left, bottom], [left, midY + INSET], [midX + INSET, midY + INSET]];
  if (!has(x0 + 1, y0 + 1)) return [[left, top], [right, top], [right, midY - INSET], [midX - INSET, midY - INSET], [midX - INSET, bottom], [left, bottom]];
  return [[left, top], [right, top], [right, bottom], [midX + INSET, bottom], [midX + INSET, midY - INSET], [left, midY - INSET]];
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

const isLive = (view) => Boolean(view.onTap || view.onCell);
const pieceAt = (view, cell) => view.placed.findIndex((cells) => cells.includes(cell));
const isOpen = (view, cell) => !view.holes.includes(cell) && pieceAt(view, cell) < 0;

function touches(view, path, cell) {
  const [x, y] = [cell % view.w, Math.floor(cell / view.w)];
  return path.some((item) => Math.abs((item % view.w) - x) + Math.abs(Math.floor(item / view.w) - y) === 1);
}

/** 긋는 동안 지나온 칸에 테두리를 두른다 */
function drawTrace(board) {
  const { view, press, traceLayer } = board;
  const cells = press && press.kind === 'stroke' ? press.path : [];
  traceLayer.replaceChildren(
    ...cells.map((cell) => make('rect', { x: (cell % view.w) * UNIT + 5, y: Math.floor(cell / view.w) * UNIT + 5, width: UNIT - 10, height: UNIT - 10, rx: 12 }, 'tile-pick')),
  );
}

/** 그릴 자리에 판을 한 번 만들어 둔다. 손가락을 긋는 동안에도 판이 바뀌지 않게, 안의 것만 바꿔 그린다. */
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
    const piece = pieceAt(view, cell);
    let kind = 'none';
    if (view.onCell) kind = 'cell';
    else if (piece >= 0) kind = 'piece';
    else if (isOpen(view, cell)) kind = 'stroke';
    board.press = { id: event.pointerId, kind, cell, piece, path: [cell] };
    drawTrace(board);
    try {
      svg.setPointerCapture(event.pointerId);
    } catch {
      // 붙잡지 못해도 누르는 것은 그대로 된다.
    }
  });
  svg.addEventListener('pointermove', (event) => {
    const press = board.press;
    const view = board.view;
    if (!press || !view || press.id !== event.pointerId || press.kind !== 'stroke') return;
    const cell = cellAt(svg, view, event);
    if (cell === null || cell === press.path.at(-1)) return;
    // 바로 앞의 칸으로 되돌아가면 그은 것을 한 칸 무른다.
    if (press.path.length >= 2 && cell === press.path.at(-2)) press.path.pop();
    else if (!press.path.includes(cell) && isOpen(view, cell) && press.path.length < view.size && touches(view, press.path, cell)) press.path.push(cell);
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
    } else if (press.kind === 'piece') {
      if (end !== null && pieceAt(view, end) === press.piece) view.onPiece?.(press.piece);
    } else if (press.kind === 'stroke') {
      if (press.path.length === 1) view.onTap?.(press.cell);
      else view.onStroke?.(press.path.slice());
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
    const piece = pieceAt(view, cell);
    if (view.onCell) view.onCell(cell);
    else if (piece >= 0) view.onPiece?.(piece);
    else if (isOpen(view, cell)) view.onTap?.(cell);
  });
  root.replaceChildren(svg);
  return board;
}

/**
 * 판을 그린다.
 * @param {HTMLElement} root 그릴 자리(안의 것을 모두 바꾼다)
 * @param {object} view
 *   w, h      가로와 세로의 칸 수
 *   holes     빠진 칸들
 *   placed    놓인 조각들(조각마다 덮는 칸 번호들)
 *   pattern   판에 입힌 무늬. 'none' | 'checker' | 'stripe' | 'back'
 *   picks     하나씩 눌러 골라 둔 칸들
 *   dead      조각이 들어갈 수 없는 빈칸들(굵은 점선 테두리)
 *   rings     고리로 짚는 칸들(그림용)
 *   loop      칸들을 차례로 잇는 길(그림용). 맨 끝은 맨 처음으로 이어지고, 빠진 칸에서는 끊긴다
 *   size      조각의 칸 수(긋는 칸의 수는 이것을 넘지 않는다)
 *   label     (칸 번호) → 읽어 줄 이름(누를 수 있는 판에서만)
 *   onStroke  (칸들) → 칸을 따라 긋고 손을 뗐을 때
 *   onTap     (칸 번호) → 빈칸 하나를 눌렀을 때
 *   onPiece   (조각 번호) → 놓인 조각을 눌렀을 때
 *   onCell    (칸 번호) → 어느 칸이든 눌렀을 때(직접 만들기). 이것이 있으면 긋기와 조각 누르기는 받지 않는다
 *   small     작은 그림으로 그린다
 */
export function drawBoard(root, view) {
  const { w, h, holes, placed = [], pattern = 'none', picks = [], dead = [], rings = [], loop = null, small = false } = view;
  const live = isLive(view);
  root.className = `tile-board${small ? ' small' : ''}${live ? ' live' : ''}`;
  root.style.setProperty('--w', String(w));
  root.style.setProperty('--h', String(h));
  const board = boardOf(root);
  const { svg } = board;
  const focused = svg.contains(document.activeElement) ? document.activeElement.dataset.cell : undefined;

  svg.setAttribute('viewBox', `${-EDGE} ${-EDGE} ${w * UNIT + 2 * EDGE} ${h * UNIT + 2 * EDGE}`);
  svg.setAttribute('class', 'tile-svg');
  if (live) svg.removeAttribute('aria-hidden');
  else svg.setAttribute('aria-hidden', 'true');

  const nodes = [];
  const marks = MARKS[pattern] ?? null;
  for (let cell = 0; cell < w * h; cell++) {
    const x = cell % w;
    const y = Math.floor(cell / w);
    const group = make('g', { 'data-cell': cell }, 'tile-cell-group');
    if (holes.includes(cell)) {
      group.append(make('rect', { x: x * UNIT + 3, y: y * UNIT + 3, width: UNIT - 6, height: UNIT - 6, rx: 8 }, 'tile-hole'));
      for (const [x1, y1, x2, y2] of [[22, 52, 52, 22], [22, 78, 78, 22], [48, 78, 78, 48]]) {
        group.append(make('line', { x1: x * UNIT + x1, y1: y * UNIT + y1, x2: x * UNIT + x2, y2: y * UNIT + y2 }, 'tile-hatch'));
      }
    } else {
      const names = ['tile-cell'];
      if (marks) names.push(`tile-color-${colorAt(pattern, x, y)}`);
      group.append(make('rect', { x: x * UNIT, y: y * UNIT, width: UNIT, height: UNIT }, names.join(' ')));
    }
    if (live && view.label) {
      group.setAttribute('tabindex', '0');
      group.setAttribute('role', 'button');
      group.setAttribute('aria-label', view.label(cell));
    }
    nodes.push(group);
  }

  // 놓인 조각: 조각마다 굵은 테두리를 두른다.
  for (const cells of placed) {
    nodes.push(make('polygon', { points: outlineOf(w, cells).map((point) => point.join(',')).join(' ') }, 'tile-piece'));
  }

  // 무늬의 모양은 조각 위에도 보이게 맨 나중에 그린다.
  if (marks) {
    for (let cell = 0; cell < w * h; cell++) {
      if (holes.includes(cell)) continue;
      const x = cell % w;
      const y = Math.floor(cell / w);
      const mark = markShape(marks[colorAt(pattern, x, y)], x * UNIT + UNIT / 2, y * UNIT + UNIT / 2, 12);
      nodes.push(mark);
    }
  }

  for (const cell of dead) {
    nodes.push(make('rect', { x: (cell % w) * UNIT + 9, y: Math.floor(cell / w) * UNIT + 9, width: UNIT - 18, height: UNIT - 18, rx: 10 }, 'tile-dead'));
  }
  for (const cell of picks) {
    nodes.push(make('rect', { x: (cell % w) * UNIT + 5, y: Math.floor(cell / w) * UNIT + 5, width: UNIT - 10, height: UNIT - 10, rx: 12 }, 'tile-pick'));
  }
  for (const cell of rings) {
    nodes.push(make('circle', { cx: (cell % w) * UNIT + UNIT / 2, cy: Math.floor(cell / w) * UNIT + UNIT / 2, r: 36 }, 'tile-ring'));
  }
  if (loop && loop.length > 1) {
    // 길은 빠진 칸에서 끊긴다: 이웃한 두 칸이 모두 남아 있는 곳만 잇는다.
    const middle = (cell) => [(cell % w) * UNIT + UNIT / 2, Math.floor(cell / w) * UNIT + UNIT / 2];
    loop.forEach((cell, index) => {
      const next = loop[(index + 1) % loop.length];
      if (holes.includes(cell) || holes.includes(next)) return;
      const [x1, y1] = middle(cell);
      const [x2, y2] = middle(next);
      nodes.push(make('line', { x1, y1, x2, y2 }, 'tile-loop'));
    });
  }

  board.mainLayer.replaceChildren(...nodes);
  board.view = { ...view, w, h, holes, placed };
  board.press = null;
  drawTrace(board);
  if (focused !== undefined) svg.querySelector(`[data-cell="${focused}"]`)?.focus?.();
}

/**
 * 무늬의 색마다 남은 빈칸의 수를 적는다. 색과 함께 그 색의 모양도 그린다.
 * @param {HTMLElement} root
 * @param {{pattern: string, counts: number[], text: (count: number) => string, label: (index: number, count: number) => string}} view
 */
export function drawLegend(root, view) {
  const marks = MARKS[view.pattern] ?? [];
  root.className = 'tile-legend';
  root.replaceChildren(
    ...marks.map((kind, index) => {
      const item = el('span', 'tile-legend-item');
      const svg = make('svg', { viewBox: '0 0 40 40', 'aria-hidden': 'true' }, 'tile-legend-mark');
      svg.append(make('rect', { x: 1, y: 1, width: 38, height: 38, rx: 6 }, `tile-cell tile-color-${index}`));
      svg.append(markShape(kind, 20, 20, 8));
      item.append(svg, el('strong', '', view.text(view.counts[index])));
      if (view.label) item.setAttribute('aria-label', view.label(index, view.counts[index]));
      return item;
    }),
  );
}

/** 조각 하나의 모양을 작게 그린다(답하는 칸에서 이 판의 조각을 보여 준다) */
export function drawPiece(root, piece) {
  const shape = { domino: { w: 2, h: 1, cells: [0, 1] }, bar: { w: 3, h: 1, cells: [0, 1, 2] }, ell: { w: 2, h: 2, cells: [0, 2, 3] } }[piece];
  const svg = make('svg', { viewBox: `${-EDGE} ${-EDGE} ${shape.w * UNIT + 2 * EDGE} ${shape.h * UNIT + 2 * EDGE}`, 'aria-hidden': 'true' }, 'tile-svg');
  for (const cell of shape.cells) svg.append(make('rect', { x: (cell % shape.w) * UNIT, y: Math.floor(cell / shape.w) * UNIT, width: UNIT, height: UNIT }, 'tile-cell'));
  svg.append(make('polygon', { points: outlineOf(shape.w, shape.cells).map((point) => point.join(',')).join(' ') }, 'tile-piece'));
  root.className = `tile-piece-picture ${piece}`;
  root.style.setProperty('--w', String(shape.w));
  root.style.setProperty('--h', String(shape.h));
  root.replaceChildren(svg);
}

/**
 * 판 하나를 담은 새 조각을 만든다(풀이와 "왜 그럴까?"의 그림). 아래에 색마다의 칸 수와 한 줄 글을 붙일 수 있다.
 * @param {object} view drawBoard에 건네는 것
 * @param {string} note 아래에 붙이는 글
 * @param {{legend?: object, big?: boolean}} options legend: drawLegend에 건네는 것
 */
export function boardCard(view, note, { legend = null, big = false } = {}) {
  const card = el('div', big ? 'tile-card big' : 'tile-card');
  const picture = el('div');
  card.append(picture);
  drawBoard(picture, { ...view, small: true });
  if (legend) {
    const line = el('div');
    card.append(line);
    drawLegend(line, legend);
  }
  if (note) card.append(el('p', 'strip-note', note));
  return card;
}
