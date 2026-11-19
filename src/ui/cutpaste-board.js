// 자르고 붙이기의 판을 그린다: 칸으로 된 조각들과 그림자(잘라 옮겨 네모, 가짜 그림자), 막대 빵과 사람마다의 접시(나누기).
// 누를 수 있는 판과 보기만 하는 그림을 같은 모양으로 그린다. 글자는 받지 않는다(수와, 대본에서 받은 사람의 이름만 그린다).
// 색만으로 알리지 않는다: 조각마다 굵은 테두리, 겹친 칸은 빗금, 그림자는 짙은 회색 바탕에 점선 테두리,
// 나눠 준 조각에는 받은 사람의 이름을 적고, 접시에는 한 사람 몫만큼 점선 네모를 그린다.
// 누르는 것은 pointer 이벤트로 받는다. 조각: 가위일 때 누른 곳에서 가장 가까운 칸 사이의 선을 고르고(누르는 동안 점선으로 보인다),
// 손일 때 끌면 옮기고 누르기만 하면 4분의 1 바퀴 돌린다. 막대: 위의 세모 줄을 누르면 그 자리를 자르거나 붙이고, 조각을 누르면 나눠 준다.

const NS = 'http://www.w3.org/2000/svg';
const UNIT = 100; // 칸 하나의 크기
const EDGE = 14; // 판 둘레에 두는 자리
const TAP = 18; // 이보다 적게 움직이면 누른 것으로 본다
const NEAR = 46; // 누른 곳에서 이만큼 안에 있는 선을 고른다
const ROW = 130; // 나누기: 막대(또는 접시) 한 줄의 높이
const STRIP = 34; // 나누기: 막대 위 세모 줄의 높이
const BODY = 80; // 나누기: 막대의 높이
const GAP = 70; // 나누기: 막대들과 접시들 사이
const LABEL = 96; // 나누기: 접시 앞의 이름 자리

const boards = new WeakMap();

function make(tag, attrs = {}, className = '') {
  const node = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  if (className) node.setAttribute('class', className);
  return node;
}

function text(x, y, value, className) {
  const node = make('text', { x, y, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, className);
  node.textContent = value;
  return node;
}

/** 화면의 자리를 판의 자리로 바꾼다 */
function spotOf(svg, event) {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  return new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
}

const cellKey = ([x, y]) => `${x},${y}`;

/** 그릴 자리에 판(svg) 하나를 만들어 둔다. 끄는 동안에도 판이 바뀌지 않게, 안의 것만 바꿔 그린다. */
function boardOf(root, events) {
  let board = boards.get(root);
  // 같은 자리에 조각 판과 막대 판을 번갈아 그린다. 다른 판이 그려져 있었으면 새로 만든다
  if (board && board.svg.parentNode === root && board.events === events) return board;
  const svg = make('svg', { preserveAspectRatio: 'xMidYMid meet' });
  const mainLayer = make('g');
  const liveLayer = make('g');
  svg.append(mainLayer, liveLayer);
  board = { svg, mainLayer, liveLayer, view: null, press: null, events, groups: [] };
  boards.set(root, board);
  events(board);
  root.replaceChildren(svg);
  return board;
}

function capture(svg, event) {
  try {
    svg.setPointerCapture(event.pointerId);
  } catch {
    // 붙잡지 못해도 누르는 것은 그대로 된다.
  }
}

// ---- 조각 판(잘라 옮겨 네모, 가짜 그림자) ----

const boxOf = (cells) => {
  const xs = cells.map((cell) => cell[0]);
  const ys = cells.map((cell) => cell[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x + 1, h: Math.max(...ys) - y + 1 };
};

/** 누른 곳(spot)에서 맨 위에 있는 조각의 차례. 없으면 −1 */
function pieceAt(view, spot) {
  const cell = cellKey([Math.floor(spot.x / UNIT), Math.floor(spot.y / UNIT)]);
  for (let index = view.pieces.length - 1; index >= 0; index--) if (view.pieces[index].cells.some((item) => cellKey(item) === cell)) return index;
  return -1;
}

/** 조각 위에서 누른 곳에 가장 가까운 칸 사이의 곧은 선. 조각을 지나는 선만, 너무 멀면 null */
export function lineAt(cells, spot) {
  const box = boxOf(cells);
  const options = [];
  const vx = Math.round(spot.x / UNIT);
  if (vx > box.x && vx < box.x + box.w) options.push({ far: Math.abs(spot.x - vx * UNIT), line: { d: 'v', at: vx } });
  const hy = Math.round(spot.y / UNIT);
  if (hy > box.y && hy < box.y + box.h) options.push({ far: Math.abs(spot.y - hy * UNIT), line: { d: 'h', at: hy } });
  const near = options.filter((item) => item.far <= NEAR).sort((a, b) => a.far - b.far);
  return near.length > 0 ? near[0].line : null;
}

/** 선이 조각을 가르는 금들(선 양쪽의 칸이 모두 조각에 든 곳) [x1, y1, x2, y2](칸 단위) */
export function cutEdges(cells, line) {
  const set = new Set(cells.map(cellKey));
  const edges = [];
  for (const [x, y] of cells) {
    if (line.d === 'v' && x === line.at && set.has(cellKey([x - 1, y]))) edges.push([x, y, x, y + 1]);
    if (line.d === 'h' && y === line.at && set.has(cellKey([x, y - 1]))) edges.push([x, y, x + 1, y]);
  }
  return edges;
}

/** 칸들의 테두리(바깥 금)를 path 글로 */
function outlineOf(cells) {
  const set = new Set(cells.map(cellKey));
  const parts = [];
  for (const [x, y] of cells) {
    const [l, t, r, b] = [x * UNIT, y * UNIT, (x + 1) * UNIT, (y + 1) * UNIT];
    if (!set.has(cellKey([x, y - 1]))) parts.push(`M${l} ${t}H${r}`);
    if (!set.has(cellKey([x, y + 1]))) parts.push(`M${l} ${b}H${r}`);
    if (!set.has(cellKey([x - 1, y]))) parts.push(`M${l} ${t}V${b}`);
    if (!set.has(cellKey([x + 1, y]))) parts.push(`M${r} ${t}V${b}`);
  }
  return parts.join('');
}

/** 칸들의 안쪽 금(이웃 칸이 같은 묶음인 곳)을 path 글로 */
function innerOf(cells) {
  const set = new Set(cells.map(cellKey));
  const parts = [];
  for (const [x, y] of cells) {
    if (set.has(cellKey([x + 1, y]))) parts.push(`M${(x + 1) * UNIT} ${y * UNIT}V${(y + 1) * UNIT}`);
    if (set.has(cellKey([x, y + 1]))) parts.push(`M${x * UNIT} ${(y + 1) * UNIT}H${(x + 1) * UNIT}`);
  }
  return parts.join('');
}

/** 조각 가운데에 가장 가까운 칸(수를 적을 자리) */
function middleCell(cells) {
  const cx = cells.reduce((sum, cell) => sum + cell[0], 0) / cells.length;
  const cy = cells.reduce((sum, cell) => sum + cell[1], 0) / cells.length;
  return cells.slice().sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy))[0];
}

function pieceGroup(view, piece, index) {
  const group = make('g', {}, `cp-piece cp-c${piece.color % 8}`);
  for (const [x, y] of piece.cells) group.append(make('rect', { x: x * UNIT, y: y * UNIT, width: UNIT, height: UNIT }, 'cp-cell'));
  group.append(make('path', { d: innerOf(piece.cells) }, view.mode === 'cut' ? 'cp-inner cut' : 'cp-inner'));
  group.append(make('path', { d: outlineOf(piece.cells) }, 'cp-outline'));
  if (view.numbers) {
    const [x, y] = middleCell(piece.cells);
    group.append(make('circle', { cx: (x + 0.5) * UNIT, cy: (y + 0.5) * UNIT, r: 30 }, 'cp-num-back'));
    group.append(text((x + 0.5) * UNIT, (y + 0.5) * UNIT, String(piece.cells.length), 'cp-num'));
  }
  if (view.live) {
    group.setAttribute('tabindex', '0');
    group.setAttribute('role', 'button');
    group.setAttribute('data-piece', String(index));
    if (view.pieceLabel) group.setAttribute('aria-label', view.pieceLabel(index));
  }
  return group;
}

/** 누르는 동안 보이는 것: 자를 선(점선) */
function drawPieceLive(board) {
  const { press, liveLayer } = board;
  const nodes = [];
  if (press?.line) {
    for (const [x1, y1, x2, y2] of cutEdges(board.view.pieces[press.index].cells, press.line)) nodes.push(make('line', { x1: x1 * UNIT, y1: y1 * UNIT, x2: x2 * UNIT, y2: y2 * UNIT }, 'cp-preview'));
  }
  liveLayer.replaceChildren(...nodes);
}

function pieceEvents(board) {
  const { svg } = board;
  svg.addEventListener('pointerdown', (event) => {
    const view = board.view;
    if (!view?.live) return;
    const spot = spotOf(svg, event);
    if (!spot) return;
    const index = pieceAt(view, spot);
    event.preventDefault();
    if (index < 0) {
      board.press = { id: event.pointerId, index: -1, start: spot };
      return;
    }
    board.press = { id: event.pointerId, index, start: spot, moved: false, line: view.mode === 'cut' ? lineAt(view.pieces[index].cells, spot) : null };
    if (view.mode === 'move') {
      // 끄는 조각을 맨 위로 올린다
      const group = board.groups[index];
      group.parentNode.append(group);
      group.classList.add('lifted');
    }
    drawPieceLive(board);
    capture(svg, event);
  });
  svg.addEventListener('pointermove', (event) => {
    const press = board.press;
    const view = board.view;
    if (!press || press.id !== event.pointerId || !view || press.index < 0) return;
    const spot = spotOf(svg, event);
    if (!spot) return;
    if (view.mode === 'cut') {
      press.line = lineAt(view.pieces[press.index].cells, spot);
      drawPieceLive(board);
      return;
    }
    const dx = spot.x - press.start.x;
    const dy = spot.y - press.start.y;
    if (Math.hypot(dx, dy) > TAP) press.moved = true;
    if (press.moved) board.groups[press.index].setAttribute('transform', `translate(${dx} ${dy})`);
  });
  const release = (event, cancel) => {
    const press = board.press;
    if (!press || press.id !== event.pointerId) return;
    const view = board.view;
    board.press = null;
    board.liveLayer.replaceChildren();
    if (!view) return;
    if (press.index < 0) {
      if (!cancel) view.onMiss?.();
      return;
    }
    const group = board.groups[press.index];
    group?.classList.remove('lifted');
    if (cancel) {
      group?.removeAttribute('transform');
      return;
    }
    if (view.mode === 'cut') {
      if (press.line) view.onCut(press.index, press.line);
      else view.onMiss?.();
      return;
    }
    const spot = spotOf(svg, event) ?? press.start;
    if (!press.moved) {
      view.onTurn(press.index);
      return;
    }
    const dx = Math.round((spot.x - press.start.x) / UNIT);
    const dy = Math.round((spot.y - press.start.y) / UNIT);
    view.onMove(press.index, dx, dy);
  };
  svg.addEventListener('pointerup', (event) => release(event, false));
  svg.addEventListener('pointercancel', (event) => release(event, true));
  // 글자판: 조각에 눈길을 두고 화살표로 옮기고, 들이기나 빈칸으로 돌린다(손일 때)
  svg.addEventListener('keydown', (event) => {
    const view = board.view;
    const target = event.target.closest?.('[data-piece]');
    if (!view?.live || !target || view.mode !== 'move') return;
    const index = Number(target.dataset.piece);
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (step) {
      event.preventDefault();
      board.refocus = view.pieces.length - 1;
      view.onMove(index, ...step);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      board.refocus = view.pieces.length - 1;
      view.onTurn(index);
    }
  });
}

/**
 * 조각 판을 그린다.
 * @param {HTMLElement} root 그릴 자리(안의 것을 모두 바꾼다)
 * @param {object} view
 *   w, h        판의 크기(칸)
 *   shadow      그림자의 칸들(없으면 null)
 *   pieces      조각들 { cells, color }. 뒤의 것이 위에 놓인다
 *   mode        'cut'(가위) | 'move'(손) | 없으면 보기만 하는 그림
 *   numbers     조각마다(그림자도) 칸 수를 적는다
 *   frame       점선으로 그릴 네모 { x, y, w, h }(칸 단위)
 *   onCut       (조각의 차례, 선) → 가위로 눌렀을 때
 *   onMove      (조각의 차례, dx, dy) → 끌어 옮겼을 때(칸 단위)
 *   onTurn      (조각의 차례) → 손으로 눌렀을 때
 *   onMiss      () → 조각이 아닌 곳이나 선에서 먼 곳을 눌렀을 때
 *   pieceLabel  (차례) → 읽어 줄 조각의 이름
 *   boardLabel  읽어 줄 판의 이름
 *   small       작은 그림으로 그린다
 */
export function drawPieces(root, view) {
  const { w, h, shadow = null, pieces = [], numbers = false, frame = null, small = false } = view;
  const live = Boolean(view.mode && view.onMove);
  root.className = `cp-board${small ? ' small' : ''}${live ? ' live' : ''}${view.mode === 'cut' ? ' cutting' : ''}`;
  root.style.setProperty('--w', String(w));
  root.style.setProperty('--h', String(h));
  const board = boardOf(root, pieceEvents);
  const { svg } = board;
  svg.setAttribute('viewBox', `${-EDGE} ${-EDGE} ${w * UNIT + 2 * EDGE} ${h * UNIT + 2 * EDGE}`);
  svg.setAttribute('class', 'cp-svg');
  if (live) {
    svg.setAttribute('role', 'group');
    if (view.boardLabel) svg.setAttribute('aria-label', view.boardLabel);
    svg.removeAttribute('aria-hidden');
  } else svg.setAttribute('aria-hidden', 'true');

  const nodes = [make('rect', { x: 0, y: 0, width: w * UNIT, height: h * UNIT }, 'cp-ground')];
  // 판의 점(격자점): 칸 수를 세기 쉽게
  if (!small) for (let y = 1; y < h; y++) for (let x = 1; x < w; x++) nodes.push(make('circle', { cx: x * UNIT, cy: y * UNIT, r: 5 }, 'cp-dot'));
  if (shadow) {
    for (const [x, y] of shadow) nodes.push(make('rect', { x: x * UNIT, y: y * UNIT, width: UNIT, height: UNIT }, 'cp-shadow'));
    nodes.push(make('path', { d: outlineOf(shadow) }, 'cp-shadow-edge'));
    if (numbers) {
      const [x, y] = middleCell(shadow);
      nodes.push(make('circle', { cx: (x + 0.5) * UNIT, cy: (y + 0.5) * UNIT, r: 38 }, 'cp-num-back shadow'));
      nodes.push(text((x + 0.5) * UNIT, (y + 0.5) * UNIT, String(shadow.length), 'cp-num'));
    }
  }
  if (frame) nodes.push(make('rect', { x: frame.x * UNIT, y: frame.y * UNIT, width: frame.w * UNIT, height: frame.h * UNIT }, 'cp-frame'));
  const piecesLayer = make('g');
  board.groups = pieces.map((piece, index) => pieceGroup({ ...view, live }, piece, index));
  piecesLayer.append(...board.groups);
  nodes.push(piecesLayer);
  // 겹친 칸: 빗금
  const seen = new Set();
  const twice = new Set();
  for (const piece of pieces) {
    for (const cell of piece.cells) {
      if (seen.has(cellKey(cell))) twice.add(cellKey(cell));
      seen.add(cellKey(cell));
    }
  }
  for (const name of twice) {
    const [x, y] = name.split(',').map(Number);
    const group = make('g', {}, 'cp-overlap');
    group.append(make('rect', { x: x * UNIT + 6, y: y * UNIT + 6, width: UNIT - 12, height: UNIT - 12 }, 'cp-overlap-box'));
    for (const [x1, y1, x2, y2] of [
      [8, 44, 44, 8],
      [8, 92, 92, 8],
      [56, 92, 92, 56],
    ]) {
      group.append(make('line', { x1: x * UNIT + x1, y1: y * UNIT + y1, x2: x * UNIT + x2, y2: y * UNIT + y2 }, 'cp-overlap-line'));
    }
    nodes.push(group);
  }
  board.mainLayer.replaceChildren(...nodes);
  board.view = { ...view, live, pieces };
  board.press = null;
  board.liveLayer.replaceChildren();
  if (board.refocus !== undefined) {
    board.groups[board.refocus]?.focus?.();
    board.refocus = undefined;
  }
}

// ---- 나누기(막대 빵과 접시) ----

/** 막대 줄과 접시 줄의 자리 */
function shareLayout(view) {
  const { m, n } = view;
  const plateX = n * UNIT + GAP + LABEL;
  const totals = new Array(n).fill(0);
  for (const piece of view.pieces) if (piece.who >= 0) totals[piece.who] += piece.len;
  const width = plateX + Math.max(m, ...totals) * UNIT;
  return { plateX, width, height: Math.max(m, n) * ROW - (ROW - STRIP - BODY) };
}

function shareEvents(board) {
  const { svg } = board;
  svg.addEventListener('pointerdown', (event) => {
    const view = board.view;
    if (!view?.live) return;
    const spot = spotOf(svg, event);
    if (!spot) return;
    event.preventDefault();
    board.press = { id: event.pointerId, start: spot };
    capture(svg, event);
  });
  svg.addEventListener('pointerup', (event) => {
    const press = board.press;
    const view = board.view;
    if (!press || press.id !== event.pointerId || !view) return;
    board.press = null;
    const spot = press.start;
    const { plateX } = shareLayout(view);
    const row = Math.floor(spot.y / ROW);
    const inRow = spot.y - row * ROW;
    if (spot.x >= -EDGE && spot.x <= view.n * UNIT + EDGE && row >= 0 && row < view.m) {
      if (inRow < STRIP + 8) {
        const at = Math.round(spot.x / UNIT);
        if (at >= 1 && at < view.n) {
          view.onTick(row, at);
          return;
        }
      } else if (inRow <= STRIP + BODY + 8 && spot.x >= 0 && spot.x < view.n * UNIT) {
        view.onPiece(row, Math.floor(spot.x / UNIT));
        return;
      }
    }
    if (spot.x >= plateX && row >= 0 && row < view.n && inRow >= STRIP) {
      const piece = view.pieces.find((item) => item.who === row && spot.x >= plateX + item.plateAt * UNIT && spot.x < plateX + (item.plateAt + item.len) * UNIT);
      if (piece) {
        view.onPlate(row, piece.key);
        return;
      }
    }
    view.onMiss?.();
  });
  svg.addEventListener('pointercancel', () => {
    board.press = null;
  });
  svg.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const view = board.view;
    const target = event.target.closest?.('[data-tick], [data-piece]');
    if (!view?.live || !target) return;
    event.preventDefault();
    if (target.dataset.tick) {
      const [bar, at] = target.dataset.tick.split(',').map(Number);
      board.refocus = `[data-tick="${bar},${at}"]`;
      view.onTick(bar, at);
    } else {
      const [bar, start] = target.dataset.piece.split(',').map(Number);
      board.refocus = `[data-piece="${bar},${start}"]`;
      view.onPiece(bar, start);
    }
  });
}

/**
 * 나누기 판을 그린다: 왼쪽에 막대 빵(위에 자르는 자리의 세모), 오른쪽에 사람마다의 접시.
 * @param {HTMLElement} root
 * @param {object} view
 *   m, n        막대 수, 사람 수(막대 하나는 n칸, 한 사람 몫은 m칸)
 *   pieces      조각들 { bar, start, end, len, key, who }(who는 받은 사람, 없으면 −1)
 *   cuts        막대마다 자른 자리들
 *   names       사람마다의 이름(대본에서 받는다)
 *   selected    지금 고른 사람(접시에 굵은 테두리)
 *   onTick      (막대, 자리) → 세모를 눌렀을 때
 *   onPiece     (막대, 칸) → 막대의 조각을 눌렀을 때
 *   onPlate     (사람, 조각 이름) → 접시의 조각을 눌렀을 때
 *   tickLabel, pieceLabel  읽어 줄 이름
 *   small       작은 그림
 */
export function drawShare(root, view) {
  const { m, n, pieces, cuts, names = [], selected = -1, small = false } = view;
  const live = Boolean(view.onTick);
  root.className = `cp-board cp-share${small ? ' small' : ''}${live ? ' live' : ''}`;
  // 접시마다 받은 조각을 차례로 놓을 자리
  const filled = new Array(n).fill(0);
  const placed = pieces.map((piece) => {
    if (piece.who < 0) return { ...piece, plateAt: -1 };
    const plateAt = filled[piece.who];
    filled[piece.who] += piece.len;
    return { ...piece, plateAt };
  });
  const layout = shareLayout({ ...view, pieces: placed });
  root.style.setProperty('--w', String(layout.width / UNIT));
  root.style.setProperty('--h', String(layout.height / UNIT));
  const board = boardOf(root, shareEvents);
  const { svg } = board;
  svg.setAttribute('viewBox', `${-EDGE} ${-EDGE} ${layout.width + 2 * EDGE} ${layout.height + 2 * EDGE}`);
  svg.setAttribute('class', 'cp-svg');
  if (live) svg.removeAttribute('aria-hidden');
  else svg.setAttribute('aria-hidden', 'true');
  const nodes = [];
  const tone = (who) => (who >= 0 ? ` cp-p${who % 6}` : '');
  // 막대 빵
  for (let bar = 0; bar < m; bar++) {
    const top = bar * ROW;
    const body = top + STRIP;
    // 자르는 자리의 세모(자른 곳은 짙게)
    for (let at = 1; at < n; at++) {
      const cut = cuts[bar].includes(at);
      const tick = make('path', { d: `M${at * UNIT - 20} ${top + 4}L${at * UNIT + 20} ${top + 4}L${at * UNIT} ${top + STRIP - 2}Z` }, cut ? 'cp-tick on' : 'cp-tick');
      if (live) {
        tick.setAttribute('tabindex', '0');
        tick.setAttribute('role', 'button');
        tick.setAttribute('data-tick', `${bar},${at}`);
        if (view.tickLabel) tick.setAttribute('aria-label', view.tickLabel(bar, at, cut));
      }
      nodes.push(tick);
    }
    for (const piece of placed.filter((item) => item.bar === bar)) {
      const group = make('g', {}, `cp-loaf${tone(piece.who)}`);
      group.append(make('rect', { x: piece.start * UNIT + 4, y: body, width: piece.len * UNIT - 8, height: BODY, rx: 22 }, 'cp-loaf-body'));
      for (let unit = piece.start + 1; unit < piece.end; unit++) group.append(make('line', { x1: unit * UNIT, y1: body + 14, x2: unit * UNIT, y2: body + BODY - 14 }, 'cp-loaf-unit'));
      if (piece.who >= 0 && names[piece.who]) group.append(text((piece.start + piece.len / 2) * UNIT, body + BODY / 2, names[piece.who], 'cp-loaf-name'));
      if (live) {
        group.setAttribute('tabindex', '0');
        group.setAttribute('role', 'button');
        group.setAttribute('data-piece', `${bar},${piece.start}`);
        if (view.pieceLabel) group.setAttribute('aria-label', view.pieceLabel(piece));
      }
      nodes.push(group);
    }
    for (const at of cuts[bar]) nodes.push(make('line', { x1: at * UNIT, y1: body - 6, x2: at * UNIT, y2: body + BODY + 6 }, 'cp-knife'));
  }
  // 접시
  for (let who = 0; who < n; who++) {
    const top = who * ROW + STRIP;
    const x0 = layout.plateX;
    nodes.push(make('circle', { cx: x0 - LABEL / 2, cy: top + BODY / 2, r: 36 }, `cp-person${tone(who)}${who === selected ? ' chosen' : ''}`));
    if (names[who]) nodes.push(text(x0 - LABEL / 2, top + BODY / 2, names[who], 'cp-person-name'));
    nodes.push(make('rect', { x: x0, y: top - 6, width: m * UNIT, height: BODY + 12, rx: 18 }, `cp-plate${who === selected ? ' chosen' : ''}`));
    for (const piece of placed.filter((item) => item.who === who)) {
      const group = make('g', {}, `cp-loaf${tone(who)}`);
      group.append(make('rect', { x: x0 + piece.plateAt * UNIT + 4, y: top, width: piece.len * UNIT - 8, height: BODY, rx: 22 }, 'cp-loaf-body'));
      for (let unit = 1; unit < piece.len; unit++) group.append(make('line', { x1: x0 + (piece.plateAt + unit) * UNIT, y1: top + 14, x2: x0 + (piece.plateAt + unit) * UNIT, y2: top + BODY - 14 }, 'cp-loaf-unit'));
      nodes.push(group);
    }
  }
  board.mainLayer.replaceChildren(...nodes);
  board.view = { ...view, live, pieces: placed };
  board.press = null;
  if (board.refocus) {
    svg.querySelector(board.refocus)?.focus?.();
    board.refocus = undefined;
  }
}

/**
 * 그림 하나를 담은 새 조각을 만든다(풀이, "왜 그럴까?", 직접 만들기의 그림). 아래에 한 줄 글을 붙일 수 있다.
 * @param {(root: HTMLElement) => void} paint 그림을 그리는 함수
 * @param {string} note 아래에 붙이는 글
 * @param {{big?: boolean}} options big: 종이에 하나만 크게 그린다
 */
export function cutCard(paint, note, { big = false } = {}) {
  const card = document.createElement('div');
  card.className = big ? 'cp-card big' : 'cp-card';
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
