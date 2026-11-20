// 수열 길 퍼즐의 판을 그린다: 네모 칸, 칸에 적힌 수, 그은 길들.
// 누를 수 있는 판과 보기만 하는 그림을 같은 모양으로 그린다. 판의 자리 잡기는 조각 못 들어가게 막기의 판과 같은 이름표(block-board)를 쓴다.
// 색만으로 알리지 않는다. 약속에 맞는 길은 굵은 실선, 아직 덜 그은 길(끝이 빈칸이거나 수가 셋보다 적다)은 가는 실선과 속이 빈 끝 동그라미,
// 약속에 맞지 않는 길은 굵은 점선으로 그린다. 길마다 색을 돌려 쓰지만 색은 길을 가려 보기 쉽게 할 뿐이다.
// 짚는 칸은 두 겹 고리, 직접 만들기에서 고른 칸은 굵은 테두리로 그린다. 글자는 대본에서 받는다(이 파일에는 글을 적지 않는다).
// 누르는 것은 pointer 이벤트로 받는다.
//   - 수 칸이나 길의 끝에서 칸을 따라 그으면 길이 늘고, 바로 앞 칸으로 되돌아가면 한 칸 줄어든다. 다른 길의 끝에 닿으면 두 길이 이어진다.
//   - 길의 가운데 칸에서 그으면 그 칸까지만 남기고 거기서부터 다시 긋는다.
//   - 길을 누르기만 하고(움직이지 않고) 떼면 그 길이 지워진다.
//   - 글자판: 칸에서 Enter를 누르면 긋기를 시작하고, 이웃 칸에서 Enter를 누르면 늘린다. 끝 칸에서 다시 Enter를 누르면 놓고, Escape는 그만둔다.

const NS = 'http://www.w3.org/2000/svg';
const UNIT = 100; // 칸 하나의 크기
const EDGE = 8; // 판 둘레에 두는 자리
/** 길의 색은 이만큼을 돌려 쓴다 */
export const PATH_COLORS = 6;

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

const centre = (w, cell) => [(cell % w) * UNIT + UNIT / 2, Math.floor(cell / w) * UNIT + UNIT / 2];
const nextTo = (w, a, b) => Math.abs((a % w) - (b % w)) + Math.abs(Math.floor(a / w) - Math.floor(b / w)) === 1;

/**
 * 긋기를 시작한다.
 * @param {{w: number, values: (number|null)[]}} view 판
 * @param {number[][]} paths 지금 놓인 길들
 * @param {number} cell 누른 칸
 * @returns {{paths: number[][], active: number, pressed: number, moved: boolean, merged: boolean}|null}
 *   paths: 긋는 동안의 길들(늘이는 길은 active번째, 그 길의 마지막 칸이 머리), pressed: 누른 칸이 들어 있던 길의 번호(없으면 -1).
 *   수가 없는 빈칸이고 길도 지나지 않으면 null
 */
export function startStroke(view, paths, cell) {
  const at = paths.findIndex((path) => path.includes(cell));
  if (at >= 0) {
    const path = paths[at];
    const index = path.indexOf(cell);
    let next;
    if (index === path.length - 1) next = path.slice();
    else if (index === 0) next = path.slice().reverse();
    else next = path.slice(0, index + 1);
    return { paths: paths.map((item, other) => (other === at ? next : item.slice())), active: at, pressed: at, moved: false, merged: false };
  }
  if (view.values[cell] === null) return null;
  return { paths: [...paths.map((item) => item.slice()), [cell]], active: paths.length, pressed: -1, moved: false, merged: false };
}

/**
 * 긋는 동안 칸 하나에 닿았다. 늘이거나 줄이거나 다른 길과 잇는다. 바뀌면 새 값을, 그대로면 같은 값을 돌려준다.
 * 다른 길과 이은 뒤에는 더 늘이지 않는다(손을 뗄 때까지).
 */
export function stretchStroke(view, stroke, cell) {
  if (stroke.merged) return stroke;
  const active = stroke.paths[stroke.active];
  const head = active.at(-1);
  if (cell === head) return stroke;
  const paths = stroke.paths.map((item) => item.slice());
  if (active.length >= 2 && cell === active.at(-2)) {
    paths[stroke.active] = active.slice(0, -1);
    return { ...stroke, paths, moved: true };
  }
  if (!nextTo(view.w, head, cell)) return stroke;
  const owner = paths.findIndex((path, index) => index !== stroke.active && path.includes(cell));
  if (owner < 0) {
    if (active.includes(cell)) return stroke;
    paths[stroke.active] = [...active, cell];
    return { ...stroke, paths, moved: true };
  }
  // 다른 길의 끝이면 두 길을 잇는다
  const other = paths[owner];
  let joined;
  if (other[0] === cell) joined = [...active, ...other];
  else if (other.at(-1) === cell) joined = [...active, ...other.slice().reverse()];
  else return stroke;
  paths[stroke.active] = joined;
  paths.splice(owner, 1);
  return { ...stroke, paths, active: owner < stroke.active ? stroke.active - 1 : stroke.active, moved: true, merged: true };
}

/** 다 그은 길들: 한 칸짜리 길은 버린다 */
export const finishedPaths = (stroke) => stroke.paths.filter((path) => path.length >= 2);

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
  return y * view.w + x;
}

/** 두 자리 사이를 잘게 나눠 지나는 칸들을 차례로 낸다(손가락이 빨리 움직여 칸을 건너뛰어도 지난 칸을 빠뜨리지 않게) */
function cellsBetween(view, from, to) {
  const far = Math.hypot(to.x - from.x, to.y - from.y);
  const parts = Math.max(1, Math.ceil(far / (UNIT / 5)));
  const cells = [];
  for (let at = 1; at <= parts; at++) {
    const cell = cellOfSpot(view, { x: from.x + ((to.x - from.x) * at) / parts, y: from.y + ((to.y - from.y) * at) / parts });
    if (cell !== null && cells.at(-1) !== cell) cells.push(cell);
  }
  return cells;
}

/** 길 하나의 그림: 선, 두 끝의 동그라미 */
function pathNodes(view, path, kind, color) {
  const { w } = view;
  const nodes = [];
  const names = `sp-path ${kind} c${color % PATH_COLORS}`;
  if (path.length > 1) nodes.push(make('polyline', { points: path.map((cell) => centre(w, cell).join(',')).join(' ') }, names));
  for (const cell of [path[0], path.at(-1)]) {
    const [cx, cy] = centre(w, cell);
    nodes.push(make('circle', { cx, cy, r: kind === 'open' ? 13 : 11 }, `sp-end ${kind} c${color % PATH_COLORS}`));
  }
  return nodes;
}

function drawLive(board) {
  const { view, press, liveLayer } = board;
  const paths = press ? press.stroke.paths : view.paths ?? [];
  const kinds = press ? null : view.kinds;
  const nodes = [];
  paths.forEach((path, index) => {
    const kind = kinds?.[index] ?? (press && index === press.stroke.active ? 'live' : view.kindOf ? view.kindOf(path) : 'ok');
    nodes.push(...pathNodes(view, path, kind, view.colors?.[index] ?? index));
  });
  liveLayer.replaceChildren(...nodes);
}

/** 그릴 자리에 판을 한 번 만들어 둔다. 손가락을 긋는 동안에도 판이 바뀌지 않게, 안의 것만 바꿔 그린다. */
function boardOf(root) {
  let board = boards.get(root);
  if (board && board.svg.parentNode === root) return board;
  const svg = make('svg', { preserveAspectRatio: 'xMidYMid meet' });
  const mainLayer = make('g');
  const liveLayer = make('g');
  const topLayer = make('g');
  svg.append(mainLayer, liveLayer, topLayer);
  board = { svg, mainLayer, liveLayer, topLayer, view: null, press: null, keys: null };
  boards.set(root, board);

  svg.addEventListener('pointerdown', (event) => {
    const view = board.view;
    if (!view || !(view.onDraw || view.onCell)) return;
    const spot = spotOf(svg, event);
    const cell = spot ? cellOfSpot(view, spot) : null;
    if (cell === null) return;
    event.preventDefault();
    board.keys = null;
    if (view.onCell) {
      board.press = { id: event.pointerId, cell, stroke: null };
      return;
    }
    const stroke = startStroke(view, view.paths ?? [], cell);
    if (!stroke) {
      view.onMiss?.(cell);
      return;
    }
    board.press = { id: event.pointerId, cell, stroke, spot };
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
    if (!press || !view || press.id !== event.pointerId || !press.stroke) return;
    const spot = spotOf(svg, event);
    if (!spot) return;
    let stroke = press.stroke;
    for (const cell of cellsBetween(view, press.spot ?? spot, spot)) stroke = stretchStroke(view, stroke, cell);
    press.spot = spot;
    if (stroke === press.stroke) return;
    press.stroke = stroke;
    drawLive(board);
  });
  svg.addEventListener('pointerup', (event) => {
    const press = board.press;
    if (!press || press.id !== event.pointerId) return;
    const view = board.view;
    board.press = null;
    if (!view) return;
    if (view.onCell) {
      const spot = spotOf(svg, event);
      if (spot && cellOfSpot(view, spot) === press.cell) view.onCell(press.cell);
      return;
    }
    let stroke = press.stroke;
    const spot = spotOf(svg, event);
    if (spot && press.spot) for (const cell of cellsBetween(view, press.spot, spot)) stroke = stretchStroke(view, stroke, cell);
    drawLive(board);
    if (stroke.moved) view.onDraw(finishedPaths(stroke), { head: stroke.paths[stroke.active].at(-1), active: stroke.paths[stroke.active] });
    else if (stroke.pressed >= 0) view.onErase?.(stroke.pressed);
    else view.onStill?.(press.cell);
  });
  svg.addEventListener('pointercancel', () => {
    board.press = null;
    drawLive(board);
  });
  // 글자판으로도 긋는다
  svg.addEventListener('keydown', (event) => {
    const view = board.view;
    const target = event.target.closest?.('[data-cell]');
    if (!view || !target || !(view.onDraw || view.onCell)) return;
    if (event.key === 'Escape' && board.keys) {
      board.keys = null;
      board.press = null;
      drawLive(board);
      return;
    }
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    const cell = Number(target.dataset.cell);
    if (view.onCell) {
      view.onCell(cell);
      return;
    }
    if (!board.keys) {
      const stroke = startStroke(view, view.paths ?? [], cell);
      if (!stroke) {
        view.onMiss?.(cell);
        return;
      }
      board.keys = stroke;
      board.press = { id: null, cell, stroke };
      drawLive(board);
      return;
    }
    const stroke = board.keys;
    if (cell === stroke.paths[stroke.active].at(-1)) {
      board.keys = null;
      board.press = null;
      drawLive(board);
      if (stroke.moved) view.onDraw(finishedPaths(stroke), { head: cell, active: stroke.paths[stroke.active] });
      else if (stroke.pressed >= 0) view.onErase?.(stroke.pressed);
      return;
    }
    const next = stretchStroke(view, stroke, cell);
    board.keys = next;
    board.press = { id: null, cell, stroke: next };
    drawLive(board);
  });
  root.replaceChildren(svg);
  return board;
}

/**
 * 판을 그린다.
 * @param {HTMLElement} root 그릴 자리(안의 것을 모두 바꾼다)
 * @param {object} view
 *   w, h, values   판(src/core/seqpath.js)
 *   paths      그은 길들(칸 번호의 줄)
 *   kinds      길마다의 모양: 'ok'(약속에 맞는 길) | 'open'(덜 그은 길) | 'broken'(약속에 맞지 않는 길). 없으면 kindOf로 정한다
 *   kindOf     (길) → 모양(긋는 동안의 다른 길에도 쓴다)
 *   colors     길마다의 색 번호(없으면 차례대로)
 *   rings      두 겹 고리를 두를 칸들
 *   picked     굵은 테두리를 두를 칸(직접 만들기에서 고른 칸, 없으면 null)
 *   label      (칸) → 읽어 줄 이름(누를 수 있는 판에서만)
 *   onDraw     (길들, { head, active }) → 그어서 길이 바뀌었을 때
 *   onErase    (길 번호) → 길을 누르기만 하고 뗐을 때
 *   onMiss     (칸) → 길도 수도 없는 칸에서 긋기 시작했을 때
 *   onStill    (칸) → 수 칸을 누르기만 하고 뗐을 때
 *   onCell     (칸) → 어느 칸이든 눌렀을 때(직접 만들기). 이것이 있으면 긋기는 받지 않는다
 *   small      작은 그림으로 그린다
 */
export function drawSeq(root, view) {
  const { w, h, values, rings = [], picked = null, small = false } = view;
  const live = Boolean(view.onDraw || view.onCell);
  root.className = `block-board sp-board${small ? ' small' : ''}${live ? ' live' : ''}${view.onDraw ? ' drawing' : ''}`;
  root.style.setProperty('--w', String(w + (2 * EDGE) / UNIT));
  root.style.setProperty('--h', String(h + (2 * EDGE) / UNIT));
  const board = boardOf(root);
  const { svg } = board;
  const focused = svg.contains(document.activeElement) ? document.activeElement.dataset?.cell : undefined;
  svg.setAttribute('viewBox', `${-EDGE} ${-EDGE} ${w * UNIT + 2 * EDGE} ${h * UNIT + 2 * EDGE}`);
  svg.setAttribute('class', 'block-svg sp-svg');
  if (live) svg.removeAttribute('aria-hidden');
  else svg.setAttribute('aria-hidden', 'true');
  const nodes = [];
  for (let cell = 0; cell < w * h; cell++) {
    const x = (cell % w) * UNIT;
    const y = Math.floor(cell / w) * UNIT;
    const group = make('g', { 'data-cell': cell }, 'sp-cell-group');
    group.append(make('rect', { x, y, width: UNIT, height: UNIT }, `sp-cell${values[cell] === null ? ' empty' : ''}`));
    if (live && view.label) {
      group.setAttribute('tabindex', '0');
      group.setAttribute('role', 'button');
      group.setAttribute('aria-label', view.label(cell));
    }
    nodes.push(group);
  }
  nodes.push(make('rect', { x: 0, y: 0, width: w * UNIT, height: h * UNIT }, 'sp-frame'));
  board.mainLayer.replaceChildren(...nodes);

  // 위에 얹는 것: 수, 고른 칸, 짚는 칸(길보다 위에 그려 수가 가리지 않게 한다)
  const top = [];
  values.forEach((value, cell) => {
    if (value === null) return;
    const [cx, cy] = centre(w, cell);
    const text = make('text', { x: cx, y: cy + 16, 'text-anchor': 'middle' }, `sp-number${value >= 10 ? ' two' : ''}`);
    text.textContent = String(value);
    top.push(text);
  });
  if (picked !== null) {
    const x = (picked % w) * UNIT;
    const y = Math.floor(picked / w) * UNIT;
    top.push(make('rect', { x: x + 6, y: y + 6, width: UNIT - 12, height: UNIT - 12, rx: 10 }, 'sp-picked'));
  }
  for (const cell of rings) {
    const [cx, cy] = centre(w, cell);
    top.push(make('circle', { cx, cy, r: 44 }, 'sp-ring'), make('circle', { cx, cy, r: 35 }, 'sp-ring inner'));
  }
  board.topLayer.replaceChildren(...top);

  board.view = { ...view, w, h, values, paths: view.paths ?? [] };
  board.press = null;
  board.keys = null;
  drawLive(board);
  if (focused !== undefined) svg.querySelector(`[data-cell="${focused}"]`)?.focus?.();
}

/**
 * 판 하나를 담은 새 조각을 만든다(풀이, "왜 그럴까?", 직접 만들기의 그림). 아래에 한 줄 글을 붙일 수 있다.
 * @param {object} view drawSeq에 건네는 것
 * @param {string} note 아래에 붙이는 글
 * @param {{big?: boolean}} options big: 종이에 하나만 크게 그린다
 */
export function seqCard(view, note, { big = false } = {}) {
  const card = el('div', big ? 'block-card sp-card big' : 'block-card sp-card');
  const picture = el('div');
  card.append(picture);
  drawSeq(picture, { ...view, small: true });
  if (note) card.append(el('p', 'strip-note', note));
  return card;
}
