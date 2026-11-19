// 눈대중의 판을 그린다: 모눈 위의 얼룩(둥근 덩어리를 합친 매끈한 모양), 센 칸의 점, 덮은 직사각형, 수직선과 찍은 곳, 어림 카드, 커진 만큼과 작아진 만큼의 막대.
// 누를 수 있는 판과 보기만 하는 그림을 같은 모양으로 그린다. 글자는 받지 않는다(수와 기호만 그린다. 말은 대본에서 받아 건넨다).
// 색만으로 알리지 않는다: 얼룩은 굵은 테두리, 덮지 않은 얼룩 칸은 큰 고리 점, 덮은 얼룩 칸은 작은 점, 얼룩이 아닌데 덮은 칸은 빗금,
// 찍은 곳은 세모, 진짜 자리는 동그라미와 기둥, 가린 만큼의 막대는 점선으로 그린다.
// 누르는 것은 pointer 이벤트로 받는다.

const NS = 'http://www.w3.org/2000/svg';
const UNIT = 100; // 칸 하나의 크기
const EDGE = 10; // 판 둘레에 두는 자리
const TAP = 18; // 이보다 적게 움직이면 누른 것으로 본다

const boards = new WeakMap();
let clipCount = 0;

function make(tag, attrs = {}, className = '') {
  const node = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  if (className) node.setAttribute('class', className);
  return node;
}

function label(x, y, text, className, anchor = 'middle') {
  const node = make('text', { x, y, 'text-anchor': anchor }, className);
  node.textContent = text;
  return node;
}

/** 화면의 자리를 판의 자리로 바꾼다 */
function spotOf(svg, event) {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  return new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
}

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

/** 그릴 자리에 판(svg) 하나를 만들어 둔다. 긋는 동안에도 판이 바뀌지 않게, 안의 것만 바꿔 그린다. */
function boardOf(root, events) {
  let board = boards.get(root);
  // 같은 자리에 얼룩 판과 수직선을 번갈아 그린다. 다른 판이 그려져 있었으면 새로 만든다
  if (board && board.svg.parentNode === root && board.events === events) return board;
  const svg = make('svg', { preserveAspectRatio: 'xMidYMid meet' });
  const mainLayer = make('g');
  const liveLayer = make('g');
  svg.append(mainLayer, liveLayer);
  board = { svg, mainLayer, liveLayer, view: null, press: null, events };
  boards.set(root, board);
  events(board);
  root.replaceChildren(svg);
  return board;
}

// ---- 얼룩 판 ----

function cellOfSpot(view, spot) {
  const x = Math.floor(spot.x / UNIT);
  const y = Math.floor(spot.y / UNIT);
  if (x < 0 || x >= view.w || y < 0 || y >= view.h) return null;
  return y * view.w + x;
}

function rectOfCells(view, a, b) {
  const [ax, ay, bx, by] = [a % view.w, Math.floor(a / view.w), b % view.w, Math.floor(b / view.w)];
  return { x: Math.min(ax, bx), y: Math.min(ay, by), w: Math.abs(ax - bx) + 1, h: Math.abs(ay - by) + 1 };
}

/** 끄는 동안 보이는 직사각형(점선) */
function drawBlobLive(board) {
  const { view, press, liveLayer } = board;
  const nodes = [];
  if (press?.end !== undefined && press.moved && view) {
    const rect = rectOfCells(view, press.start, press.end);
    nodes.push(make('rect', { x: rect.x * UNIT + 6, y: rect.y * UNIT + 6, width: rect.w * UNIT - 12, height: rect.h * UNIT - 12, rx: 10 }, 'es-preview'));
  }
  liveLayer.replaceChildren(...nodes);
}

function blobEvents(board) {
  const { svg } = board;
  const live = () => board.view && (board.view.onRect || board.view.onPoint);
  svg.addEventListener('pointerdown', (event) => {
    const view = board.view;
    if (!live()) return;
    const spot = spotOf(svg, event);
    if (!spot) return;
    event.preventDefault();
    if (view.onPoint) {
      board.press = { id: event.pointerId, spot };
      return;
    }
    const cell = cellOfSpot(view, spot);
    if (cell === null) return;
    board.press = { id: event.pointerId, start: cell, end: cell, from: spot, moved: false };
    try {
      svg.setPointerCapture(event.pointerId);
    } catch {
      // 붙잡지 못해도 누르는 것은 그대로 된다.
    }
  });
  svg.addEventListener('pointermove', (event) => {
    const press = board.press;
    const view = board.view;
    if (!press || !view || press.id !== event.pointerId || press.start === undefined) return;
    const spot = spotOf(svg, event);
    if (!spot) return;
    const cell = cellOfSpot(view, { x: clamp(spot.x, 0, view.w * UNIT - 1), y: clamp(spot.y, 0, view.h * UNIT - 1) });
    if (Math.hypot(spot.x - press.from.x, spot.y - press.from.y) > TAP) press.moved = true;
    press.end = cell;
    drawBlobLive(board);
  });
  svg.addEventListener('pointerup', (event) => {
    const press = board.press;
    const view = board.view;
    if (!press || press.id !== event.pointerId) return;
    board.press = null;
    drawBlobLive(board);
    if (!view) return;
    if (view.onPoint) {
      const spot = spotOf(svg, event) ?? press.spot;
      view.onPoint(clamp(Math.round(spot.x / UNIT), 0, view.w), clamp(Math.round(spot.y / UNIT), 0, view.h));
      return;
    }
    if (press.moved && press.end !== press.start) view.onRect(rectOfCells(view, press.start, press.end));
    else view.onTap(press.start);
  });
  svg.addEventListener('pointercancel', () => {
    board.press = null;
    drawBlobLive(board);
  });
  // 글자판: 칸에 눈길을 두고 들이기를 누르면 그 칸이 직사각형의 한 구석이 되고, 다른 칸에서 한 번 더 누르면 직사각형이 생긴다(같은 칸이면 누른 것)
  svg.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const view = board.view;
    const target = event.target.closest?.('[data-cell]');
    if (!view?.onRect || !target) return;
    event.preventDefault();
    const cell = Number(target.dataset.cell);
    if (board.anchor === undefined || board.anchor === null) {
      board.anchor = cell;
      target.classList.add('es-anchor');
      return;
    }
    const anchor = board.anchor;
    board.anchor = null;
    if (anchor === cell) view.onTap(cell);
    else view.onRect(rectOfCells(view, anchor, cell));
  });
}

/** 얼룩 테두리와 속: 테두리를 먼저 굵게 그리고 그 위에 속을 칠하면 겹친 곳의 테두리는 가려지고 바깥 둘레만 남는다 */
function blobShape(view, clipId) {
  const group = make('g', { 'clip-path': `url(#${clipId})` });
  const edge = make('g', {}, 'es-blob-edge');
  const fill = make('g', {}, 'es-blob');
  for (const [x, y, r] of view.circles) {
    edge.append(make('circle', { cx: x * UNIT, cy: y * UNIT, r: (r * UNIT) / 2 }));
    fill.append(make('circle', { cx: x * UNIT, cy: y * UNIT, r: (r * UNIT) / 2 }));
  }
  group.append(edge, fill);
  return group;
}

/** 빗금 한 칸(얼룩이 아닌데 덮은 칸) */
function hatchCell(x, y) {
  const group = make('g', {}, 'es-extra');
  for (const [x1, y1, x2, y2] of [
    [0, 40, 40, 0],
    [0, 80, 80, 0],
    [20, 100, 100, 20],
    [60, 100, 100, 60],
  ]) {
    group.append(make('line', { x1: x + x1, y1: y + y1, x2: x + x2, y2: y + y2 }));
  }
  return group;
}

/**
 * 모눈과 얼룩을 그린다.
 * @param {HTMLElement} root 그릴 자리
 * @param {object} view
 *   w, h, circles   판
 *   cells           얼룩의 칸 번호들(dots나 count를 그릴 때 쓴다)
 *   show            'none'(얼룩만) | 'count'(센 칸에 옅은 색과 점) | 'dots'(얼룩 칸마다 점. 덮기)
 *   rects           덮은 직사각형들 { x, y, w, h }
 *   covered         덮은 칸 번호들(얼룩 칸의 점 크기, 얼룩이 아닌데 덮은 칸의 빗금)
 *   centres         둥근 덩어리의 가운데를 + 표로 보인다(직접 만들기)
 *   onRect, onTap   (직사각형) / (칸) → 끌었을 때와 눌렀을 때(덮기)
 *   onPoint         (가로, 세로) → 누른 곳에서 가장 가까운 격자점(직접 만들기)
 *   cellLabel       (칸) → 읽어 줄 칸의 이름(덮기에서만)
 *   boardLabel      판 전체를 읽어 줄 이름(직접 만들기)
 *   small           작은 그림으로 그린다
 */
export function drawBlob(root, view) {
  const { w, h, circles, cells = [], show = 'none', rects = [], covered = [], centres = false, small = false } = view;
  const live = Boolean(view.onRect || view.onPoint);
  root.className = `es-board${small ? ' small' : ''}${live ? ' live' : ''}`;
  root.style.setProperty('--w', String(w));
  root.style.setProperty('--h', String(h));
  const board = boardOf(root, blobEvents);
  const { svg } = board;
  const focused = svg.contains(document.activeElement) ? document.activeElement.dataset.cell : undefined;
  svg.setAttribute('viewBox', `${-EDGE} ${-EDGE} ${w * UNIT + 2 * EDGE} ${h * UNIT + 2 * EDGE}`);
  svg.setAttribute('class', 'es-svg');
  if (live) svg.removeAttribute('aria-hidden');
  else svg.setAttribute('aria-hidden', 'true');
  if (view.boardLabel) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', view.boardLabel);
  }

  const blobSet = new Set(cells);
  const coveredSet = new Set(covered);
  const nodes = [];
  const clipId = `es-clip-${++clipCount}`;
  const defs = make('defs');
  const clip = make('clipPath', { id: clipId });
  clip.append(make('rect', { x: 0, y: 0, width: w * UNIT, height: h * UNIT }));
  defs.append(clip);
  nodes.push(defs, make('rect', { x: 0, y: 0, width: w * UNIT, height: h * UNIT }, 'es-paper'));
  nodes.push(blobShape(view, clipId));
  // 센 칸: 얼룩 위에 옅은 색을 덧칠한다
  if (show === 'count') for (const cell of cells) nodes.push(make('rect', { x: (cell % w) * UNIT, y: Math.floor(cell / w) * UNIT, width: UNIT, height: UNIT }, 'es-counted'));
  // 덮은 직사각형(속은 옅게)
  for (const rect of rects) nodes.push(make('rect', { x: rect.x * UNIT, y: rect.y * UNIT, width: rect.w * UNIT, height: rect.h * UNIT }, 'es-rect-fill'));
  // 얼룩이 아닌데 덮은 칸: 빗금
  for (const cell of covered) if (!blobSet.has(cell)) nodes.push(hatchCell((cell % w) * UNIT, Math.floor(cell / w) * UNIT));
  // 모눈
  for (let at = 1; at < w; at++) nodes.push(make('line', { x1: at * UNIT, y1: 0, x2: at * UNIT, y2: h * UNIT }, 'es-grid'));
  for (let at = 1; at < h; at++) nodes.push(make('line', { x1: 0, y1: at * UNIT, x2: w * UNIT, y2: at * UNIT }, 'es-grid'));
  nodes.push(make('rect', { x: 0, y: 0, width: w * UNIT, height: h * UNIT }, 'es-frame'));
  // 직사각형의 테두리
  for (const rect of rects) nodes.push(make('rect', { x: rect.x * UNIT + 4, y: rect.y * UNIT + 4, width: rect.w * UNIT - 8, height: rect.h * UNIT - 8, rx: 8 }, 'es-rect'));
  // 얼룩 칸의 점: 센 칸(count)은 점, 덮기(dots)는 덮었으면 작은 점, 아직이면 큰 고리 점
  if (show === 'count' || show === 'dots') {
    for (const cell of cells) {
      const cx = (cell % w) * UNIT + UNIT / 2;
      const cy = Math.floor(cell / w) * UNIT + UNIT / 2;
      if (show === 'dots' && !coveredSet.has(cell)) nodes.push(make('circle', { cx, cy, r: 17 }, 'es-dot open'));
      else nodes.push(make('circle', { cx, cy, r: 10 }, 'es-dot'));
    }
  }
  // 둥근 덩어리의 가운데(직접 만들기)
  if (centres) {
    for (const [x, y] of circles) {
      nodes.push(make('line', { x1: x * UNIT - 16, y1: y * UNIT, x2: x * UNIT + 16, y2: y * UNIT }, 'es-centre'));
      nodes.push(make('line', { x1: x * UNIT, y1: y * UNIT - 16, x2: x * UNIT, y2: y * UNIT + 16 }, 'es-centre'));
    }
  }
  // 글자판으로 고를 수 있는 칸(덮기). 손가락은 판 전체에서 받는다
  if (view.onRect) {
    for (let cell = 0; cell < w * h; cell++) {
      const node = make('rect', { x: (cell % w) * UNIT, y: Math.floor(cell / w) * UNIT, width: UNIT, height: UNIT, 'data-cell': cell, tabindex: 0, role: 'button' }, 'es-key');
      if (view.cellLabel) node.setAttribute('aria-label', view.cellLabel(cell));
      nodes.push(node);
    }
  }
  board.mainLayer.replaceChildren(...nodes);
  board.view = { ...view, w, h };
  board.press = null;
  board.anchor = null;
  drawBlobLive(board);
  if (focused !== undefined) svg.querySelector(`[data-cell="${focused}"]`)?.focus?.();
}

// ---- 수직선 ----

const LINE = { left: 60, right: 1040, y: 150, width: 1100, height: 280 };
const xOf = (view, value) => LINE.left + ((value - view.from) / (view.to - view.from)) * (LINE.right - LINE.left);

function lineEvents(board) {
  const { svg } = board;
  const fracAt = (event) => {
    const spot = spotOf(svg, event);
    return spot ? clamp((spot.x - LINE.left) / (LINE.right - LINE.left), 0, 1) : null;
  };
  svg.addEventListener('pointerdown', (event) => {
    if (!board.view?.onMark) return;
    const frac = fracAt(event);
    if (frac === null) return;
    event.preventDefault();
    board.press = { id: event.pointerId };
    try {
      svg.setPointerCapture(event.pointerId);
    } catch {
      // 붙잡지 못해도 누르는 것은 그대로 된다.
    }
    board.view.onMark(frac, { moving: true });
  });
  svg.addEventListener('pointermove', (event) => {
    if (!board.press || board.press.id !== event.pointerId || !board.view?.onMark) return;
    const frac = fracAt(event);
    if (frac !== null) board.view.onMark(frac, { moving: true });
  });
  svg.addEventListener('pointerup', (event) => {
    if (!board.press || board.press.id !== event.pointerId) return;
    board.press = null;
    const frac = fracAt(event);
    if (frac !== null && board.view?.onMark) board.view.onMark(frac, { moving: false });
  });
  svg.addEventListener('pointercancel', () => {
    board.press = null;
  });
}

/**
 * 수직선을 그린다.
 *   from, to, ticks    선의 끝 수와 열기 전에 보이는 눈금
 *   pairs              열어 본 수마다 { target, mark }: 찍은 곳(세모)과 진짜 자리(동그라미와 기둥)
 *   pending            지금 찍어 둔 곳(세모, 아직 열지 않음). null이면 없다
 *   tenths             선을 열 칸으로 나눈 눈금을 보인다(끝난 판)
 *   onMark             (0~1, { moving }) → 누르거나 끌 때
 *   lineLabel          읽어 줄 선의 이름
 */
export function drawLine(root, view) {
  const { from, to, ticks = [], pairs = [], pending = null, tenths = false, small = false } = view;
  const live = Boolean(view.onMark);
  root.className = `es-line${small ? ' small' : ''}${live ? ' live' : ''}`;
  const board = boardOf(root, lineEvents);
  const { svg } = board;
  svg.setAttribute('viewBox', `0 0 ${LINE.width} ${LINE.height}`);
  svg.setAttribute('class', 'es-svg');
  if (live) {
    svg.removeAttribute('aria-hidden');
    svg.setAttribute('role', 'img');
    if (view.lineLabel) svg.setAttribute('aria-label', view.lineLabel);
  } else svg.setAttribute('aria-hidden', 'true');
  const { y } = LINE;
  const nodes = [make('rect', { x: 0, y: 0, width: LINE.width, height: LINE.height }, 'es-line-paper')];
  if (tenths) {
    for (let index = 1; index < 10; index++) {
      const x = LINE.left + ((LINE.right - LINE.left) * index) / 10;
      nodes.push(make('line', { x1: x, y1: y - 18, x2: x, y2: y + 18 }, 'es-tenth'));
    }
  }
  nodes.push(make('line', { x1: LINE.left, y1: y, x2: LINE.right, y2: y }, 'es-axis'));
  for (const x of [LINE.left, LINE.right]) nodes.push(make('line', { x1: x, y1: y - 36, x2: x, y2: y + 36 }, 'es-end'));
  nodes.push(label(LINE.left, y + 82, String(from), 'es-line-num'), label(LINE.right, y + 82, String(to), 'es-line-num'));
  for (const value of ticks) {
    const x = xOf(view, value);
    nodes.push(make('line', { x1: x, y1: y - 26, x2: x, y2: y + 26 }, 'es-end'), label(x, y + 82, String(value), 'es-line-num'));
  }
  const pin = (x, className) => make('path', { d: `M ${x} ${y - 8} L ${x - 28} ${y - 62} L ${x + 28} ${y - 62} Z` }, className);
  pairs.forEach((pair, index) => {
    const last = index === pairs.length - 1;
    const tx = xOf(view, pair.target);
    const mx = xOf(view, pair.mark);
    const tone = last ? '' : ' old';
    // 둘 사이: 위쪽의 점선
    if (Math.abs(tx - mx) > 2) nodes.push(make('line', { x1: Math.min(tx, mx), y1: y - 78, x2: Math.max(tx, mx), y2: y - 78 }, `es-gap${tone}`));
    nodes.push(make('line', { x1: tx, y1: y - 78, x2: tx, y2: y + 30 }, `es-true-stem${tone}`));
    nodes.push(make('circle', { cx: tx, cy: y, r: 20 }, `es-true${tone}`));
    nodes.push(pin(mx, `es-pin${tone}`));
    nodes.push(label(tx, y + 122, String(pair.target), `es-true-num${tone}`));
    nodes.push(label(mx, y - 92, String(pair.mark), `es-pin-num${tone}`));
  });
  if (pending !== null) nodes.push(pin(xOf(view, pending), 'es-pin now'));
  board.mainLayer.replaceChildren(...nodes);
  board.view = view;
}

// ---- 어림 카드 ----

const OP_SIGN = { '+': '+', '-': '−', '×': '×' };
const DIGIT = 34; // 숫자 하나의 너비(그림 단위)

/**
 * 어림 카드를 그린다(svg라서 자리에 맞게 줄어든다): 윗줄에 수(가린 숫자는 □), 가운데에 화살표, 아랫줄에 어림한 수와 어림한 값.
 *   op, shown, ests, est   셈, 보일 수들, 어림한 수들, 어림한 값
 *   labels                 { real, est } 줄의 이름(대본에서). 없으면 이름 칸을 두지 않는다(작은 그림)
 */
export function drawSide(root, view) {
  const { op, shown, ests, est, labels = null, small = false } = view;
  root.className = `es-side${small ? ' small' : ''}`;
  const nameWidth = labels ? 120 : 0;
  const widths = shown.map((text, index) => Math.max(text.length, String(ests[index]).length) * DIGIT + 24);
  const opWidth = 56;
  const totalWidth = String(est).length * DIGIT + 44;
  const width = nameWidth + widths.reduce((sum, value) => sum + value, 0) + opWidth * shown.length + totalWidth + 20;
  const height = small ? 170 : 250;
  const top = 72;
  const bottom = small ? 150 : 220;
  const svg = make('svg', { viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: 'xMidYMid meet' }, 'es-side-svg');
  if (small) svg.setAttribute('aria-hidden', 'true');
  const nodes = [];
  if (labels) nodes.push(label(nameWidth - 16, top - 8, labels.real, 'es-side-name', 'end'), label(nameWidth - 16, bottom - 8, labels.est, 'es-side-name', 'end'));
  let x = nameWidth;
  shown.forEach((text, index) => {
    if (index > 0) {
      nodes.push(label(x + opWidth / 2, top, OP_SIGN[op], 'es-side-op'), label(x + opWidth / 2, bottom, OP_SIGN[op], 'es-side-op'));
      x += opWidth;
    }
    const mid = x + widths[index] / 2;
    nodes.push(label(mid, top, text, 'es-side-num'));
    if (!small) nodes.push(label(mid, (top + bottom) / 2 + 2, '↓', 'es-side-arrow'));
    nodes.push(label(mid, bottom, String(ests[index]), 'es-side-num est'));
    x += widths[index];
  });
  nodes.push(label(x + opWidth / 2, bottom, '=', 'es-side-op'));
  x += opWidth;
  nodes.push(make('rect', { x: x + 4, y: bottom - 58, width: totalWidth - 8, height: 76, rx: 12 }, 'es-side-box'));
  nodes.push(label(x + totalWidth / 2, bottom, String(est), 'es-side-num est'));
  svg.append(...nodes);
  root.replaceChildren(svg);
}

/**
 * 커진 만큼과 작아진 만큼의 막대: 두 줄에 몫을 차례로 이어 붙인다. 가린 숫자 때문에 길이를 다 모르는 몫은 아는 데까지 칠하고 나머지는 점선으로 그린다.
 *   pushes   [{ lo, hi }] (src/core/eyeball.js의 pushesOf). 0보다 크면 커진 만큼, 작으면 작아진 만큼
 *   labels   { up, down } 두 줄의 이름(대본에서)
 */
export function drawBars(root, view) {
  const { pushes, labels } = view;
  root.className = 'es-bars';
  const ups = pushes.filter((item) => item.lo > 0).map((item) => [item.lo, item.hi]);
  const downs = pushes.filter((item) => item.hi < 0).map((item) => [-item.hi, -item.lo]);
  const total = (list) => list.reduce((sum, [, hi]) => sum + hi, 0);
  const most = Math.max(1, total(ups), total(downs));
  const left = 300;
  const width = 1040;
  const scale = (width - left - 30) / most;
  const svg = make('svg', { viewBox: `0 0 ${width} 230`, preserveAspectRatio: 'xMidYMid meet', role: 'img' }, 'es-bars-svg');
  const nodes = [];
  [
    [ups, labels?.up ?? '', 30, 'up'],
    [downs, labels?.down ?? '', 130, 'down'],
  ].forEach(([list, name, y, kind]) => {
    nodes.push(label(left - 20, y + 50, name, 'es-bar-name', 'end'));
    let x = left;
    for (const [lo, hi] of list) {
      const sure = lo * scale;
      const maybe = (hi - lo) * scale;
      nodes.push(make('rect', { x, y, width: Math.max(sure, 4), height: 70, rx: 6 }, `es-bar ${kind}`));
      if (maybe > 0) nodes.push(make('rect', { x: x + sure, y: y + 4, width: maybe, height: 62, rx: 6 }, `es-bar-maybe ${kind}`));
      nodes.push(label(x + (sure + maybe) / 2, y + 47, lo === hi ? String(lo) : `${lo}~${hi}`, 'es-bar-num'));
      x += sure + maybe;
    }
  });
  svg.append(...nodes);
  const names = [labels?.up, labels?.down].filter(Boolean).join(', ');
  svg.setAttribute('aria-label', names);
  root.replaceChildren(svg);
}

/**
 * 그림 하나를 담은 새 조각(풀이, "왜 그럴까?", 직접 만들기의 그림). 아래에 한 줄 글을 붙일 수 있다.
 * @param {(root: HTMLElement) => void} paint 그 자리에 그리는 함수
 * @param {string} note 아래에 붙이는 글
 * @param {{big?: boolean}} options big: 종이에 하나만 크게 그린다
 */
export function eyeCard(paint, note, { big = false } = {}) {
  const card = document.createElement('div');
  card.className = big ? 'es-card big' : 'es-card';
  const picture = document.createElement('div');
  card.append(picture);
  paint(picture);
  if (note) {
    const line = document.createElement('p');
    line.className = 'strip-note';
    line.textContent = note;
    card.append(line);
  }
  return card;
}
