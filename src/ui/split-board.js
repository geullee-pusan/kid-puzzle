// 똑같이 섞이게 자르기의 판을 그린다: 회색 칸과 흰 칸, 칸 사이의 선, 자른 선, 조각마다의 회색 수와 흰 칸 수.
// 누를 수 있는 판과 보기만 하는 그림을 같은 모양으로 그린다.
// 색만으로 알리지 않는다. 회색 칸에는 빗금을 긋고, 조각의 수 옆에도 빗금 친 작은 네모(회색)와 빈 네모(흰 칸)를 둔다.
// 다르게 섞인 조각은 점선 테두리, "왜 그럴까?"에서 짚는 끝에서 끝까지의 선은 굵은 점선으로 그린다. 글자는 받지 않는다(수와 물음표만 그린다).
// 누르는 것은 pointer 이벤트로 받는다. 칸 사이의 선을 누르거나(가장 가까운 선), 선을 따라 그으면(긋는 쪽의 선) 그 선을 알려 준다.
// 직접 만들기에서는 칸을 누르거나 문질러 회색과 흰 칸을 바꾼다.

const NS = 'http://www.w3.org/2000/svg';
const UNIT = 100; // 칸 하나의 크기
const EDGE = 10; // 판 둘레에 두는 자리
const TAP = 22; // 이보다 적게 움직이면 누른 것으로 본다
const NEAR = 38; // 누른 곳에서 이만큼 안에 있는 선을 고른다
const CORNER = 16; // 두 금이 이만큼 안으로 비슷하게 가까우면 자른 선 쪽을 고른다

const boards = new WeakMap();

function make(tag, attrs = {}, className = '') {
  const node = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  if (className) node.setAttribute('class', className);
  return node;
}

/** 화면의 자리를 판의 자리(칸 하나가 100)로 바꾼다 */
function spotOf(svg, event) {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  return new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
}

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

function cellOfSpot(view, spot) {
  const x = Math.floor(spot.x / UNIT);
  const y = Math.floor(spot.y / UNIT);
  if (x < 0 || x >= view.w || y < 0 || y >= view.h) return null;
  return y * view.w + x;
}

/** 누른 자리에서 가장 가까운 칸 사이의 선(판 안쪽의 금). 너무 멀면 null */
export function nearestSeed(view, spot) {
  const { w, h } = view;
  if (spot.x < -NEAR || spot.y < -NEAR || spot.x > w * UNIT + NEAR || spot.y > h * UNIT + NEAR) return null;
  const options = [];
  const vx = Math.round(spot.x / UNIT);
  if (vx >= 1 && vx <= w - 1 && spot.y >= 0 && spot.y <= h * UNIT) options.push({ far: Math.abs(spot.x - vx * UNIT), seed: { d: 'v', at: vx, i: clamp(Math.floor(spot.y / UNIT), 0, h - 1) } });
  const hy = Math.round(spot.y / UNIT);
  if (hy >= 1 && hy <= h - 1 && spot.x >= 0 && spot.x <= w * UNIT) options.push({ far: Math.abs(spot.y - hy * UNIT), seed: { d: 'h', at: hy, i: clamp(Math.floor(spot.x / UNIT), 0, w - 1) } });
  const near = options.filter((item) => item.far <= NEAR).sort((a, b) => a.far - b.far);
  if (near.length === 0) return null;
  // 두 금이 만나는 곳 가까이를 누르면, 자른 선 위의 금을 먼저 고른다(자른 선을 지우려고 누른 것이다).
  const cut = near.find((item) => item.far <= near[0].far + CORNER && onCutLine(view.cuts ?? [], item.seed));
  return (cut ?? near[0]).seed;
}

/** 칸 사이의 금 하나가 자른 선 위에 있는가 */
function onCutLine(cuts, seed) {
  return cuts.some((cut) => {
    const vertical = cut.x1 === cut.x2;
    if ((seed.d === 'v') !== vertical) return false;
    if (vertical ? cut.x1 !== seed.at : cut.y1 !== seed.at) return false;
    const [from, to] = vertical ? [cut.y1, cut.y2] : [cut.x1, cut.x2];
    return seed.i >= from && seed.i < to;
  });
}

/** 그은 두 자리에서 고른 선: 가로로 길게 그었으면 가로 선, 세로로 길게 그었으면 세로 선. 그 선 위의 칸은 그은 곳의 가운데 */
export function dragSeed(view, from, to) {
  const { w, h } = view;
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  if (Math.abs(to.x - from.x) >= Math.abs(to.y - from.y)) {
    if (h < 2) return null;
    return { d: 'h', at: clamp(Math.round(my / UNIT), 1, h - 1), i: clamp(Math.floor(mx / UNIT), 0, w - 1) };
  }
  if (w < 2) return null;
  return { d: 'v', at: clamp(Math.round(mx / UNIT), 1, w - 1), i: clamp(Math.floor(my / UNIT), 0, h - 1) };
}

/** 두 자리 사이를 잘게 나눠 지나는 칸들(문질러 칠할 때 칸을 건너뛰지 않게) */
function cellsBetween(view, from, to) {
  const far = Math.hypot(to.x - from.x, to.y - from.y);
  const parts = Math.max(1, Math.ceil(far / (UNIT / 5)));
  const cells = [];
  for (let at = 0; at <= parts; at++) {
    const cell = cellOfSpot(view, { x: from.x + ((to.x - from.x) * at) / parts, y: from.y + ((to.y - from.y) * at) / parts });
    if (cell !== null && !cells.includes(cell)) cells.push(cell);
  }
  return cells;
}

/** 긋는 동안 보이는 것: 잘릴 선(점선) 또는 칠할 칸 */
function drawLive(board) {
  const { view, press, liveLayer } = board;
  const nodes = [];
  if (press?.preview) {
    const line = press.preview;
    nodes.push(make('line', { x1: line.x1 * UNIT, y1: line.y1 * UNIT, x2: line.x2 * UNIT, y2: line.y2 * UNIT }, 'sp-preview'));
  }
  if (press?.paint && view) {
    for (const cell of press.paint.cells) {
      const x = (cell % view.w) * UNIT;
      const y = Math.floor(cell / view.w) * UNIT;
      nodes.push(make('rect', { x: x + 8, y: y + 8, width: UNIT - 16, height: UNIT - 16, rx: 8 }, press.paint.value ? 'sp-paint grey' : 'sp-paint white'));
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

  const live = () => board.view && (board.view.onSeed || board.view.onPaint);
  const letGo = () => {
    board.press = null;
    drawLive(board);
  };

  svg.addEventListener('pointerdown', (event) => {
    const view = board.view;
    if (!live()) return;
    const spot = spotOf(svg, event);
    if (!spot) return;
    if (view.onPaint) {
      const cell = cellOfSpot(view, spot);
      if (cell === null) return;
      board.press = { id: event.pointerId, last: spot, paint: { value: !view.grey.includes(cell), cells: [cell] } };
    } else {
      board.press = { id: event.pointerId, start: spot, last: spot, preview: null };
    }
    event.preventDefault();
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
    if (press.paint) {
      for (const cell of cellsBetween(view, press.last, spot)) if (!press.paint.cells.includes(cell)) press.paint.cells.push(cell);
      press.last = spot;
      drawLive(board);
      return;
    }
    press.last = spot;
    const moved = Math.hypot(spot.x - press.start.x, spot.y - press.start.y) > TAP;
    const seed = moved ? dragSeed(view, press.start, spot) : null;
    press.preview = seed && view.preview ? view.preview(seed) : null;
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
    if (press.paint) {
      for (const cell of cellsBetween(view, press.last, spot)) if (!press.paint.cells.includes(cell)) press.paint.cells.push(cell);
      view.onPaint(press.paint.cells.slice(), press.paint.value);
      return;
    }
    const tap = Math.hypot(spot.x - press.start.x, spot.y - press.start.y) <= TAP;
    const seed = tap ? nearestSeed(view, press.start) : dragSeed(view, press.start, spot);
    if (seed) view.onSeed(seed, { tap });
    else view.onMiss?.();
  });
  svg.addEventListener('pointercancel', letGo);
  // 글자판으로도 누를 수 있다: 칸 사이의 선(또는 만들기의 칸)에 눈길을 두고 들이기나 빈칸.
  svg.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const view = board.view;
    const target = event.target.closest?.('[data-seed], [data-cell]');
    if (!live() || !target) return;
    event.preventDefault();
    if (target.dataset.cell !== undefined && view.onPaint) {
      const cell = Number(target.dataset.cell);
      view.onPaint([cell], !view.grey.includes(cell));
      return;
    }
    if (target.dataset.seed !== undefined && view.onSeed) {
      const [d, at, i] = target.dataset.seed.split(',');
      view.onSeed({ d, at: Number(at), i: Number(i) }, { tap: true });
    }
  });
  root.replaceChildren(svg);
  return board;
}

/** 빗금 친 회색 칸 하나 */
function greyCell(x, y) {
  const group = make('g');
  group.append(make('rect', { x, y, width: UNIT, height: UNIT }, 'sp-cell sp-grey'));
  for (const [x1, y1, x2, y2] of [
    [0, 34, 34, 0],
    [0, 68, 68, 0],
    [0, 100, 100, 0],
    [32, 100, 100, 32],
    [66, 100, 100, 66],
  ]) {
    group.append(make('line', { x1: x + x1, y1: y + y1, x2: x + x2, y2: y + y2 }, 'sp-hatch'));
  }
  return group;
}

/** 조각 가운데의 수: 빗금 친 작은 네모(회색)와 회색 수, 빈 네모(흰 칸)와 흰 칸 수 */
function tally(rect, counts, hidden) {
  const cx = (rect.x + rect.w / 2) * UNIT;
  const cy = (rect.y + rect.h / 2) * UNIT;
  const wide = rect.w >= 2;
  const group = make('g', {}, 'sp-tally');
  const [width, height] = wide ? [190, 58] : [96, 104];
  group.append(make('rect', { x: cx - width / 2, y: cy - height / 2, width, height, rx: 14 }, 'sp-tally-back'));
  const items = [
    ['grey', counts[0]],
    ['white', counts[1]],
  ];
  items.forEach(([kind, value], index) => {
    const ox = wide ? cx - 88 + index * 94 : cx - 42;
    const oy = wide ? cy : cy - 24 + index * 48;
    const swatch = make('rect', { x: ox, y: oy - 15, width: 30, height: 30, rx: 5 }, `sp-swatch ${kind}`);
    group.append(swatch);
    if (kind === 'grey') group.append(make('line', { x1: ox + 2, y1: oy + 13, x2: ox + 28, y2: oy - 13 }, 'sp-swatch-hatch'));
    // 수는 네모 바로 오른쪽에서 시작한다(두 자리 수도 들어가게)
    const number = make('text', { x: ox + 38, y: oy + 13, 'text-anchor': 'start' }, 'sp-num');
    number.textContent = hidden ? '?' : String(value);
    group.append(number);
  });
  return group;
}

/**
 * 판을 그린다.
 * @param {HTMLElement} root 그릴 자리(안의 것을 모두 바꾼다)
 * @param {object} view
 *   w, h, grey     판(회색 칸의 번호들)
 *   cuts           자른 선들 { x1, y1, x2, y2 }(칸 단위)
 *   pieces         조각들 { x, y, w, h }. counts가 있을 때만 쓴다
 *   counts         조각마다 [회색 수, 흰 칸 수]. 없으면 수를 적지 않는다
 *   hide           수를 물음표로 가릴 조각의 차례들
 *   uneven         점선 테두리를 두를 조각의 차례들
 *   lines          굵은 점선으로 짚을 끝에서 끝까지의 선들 { d, at }
 *   onSeed         (씨앗, { tap }) → 칸 사이의 선을 누르거나 따라 그었을 때
 *   onMiss         () → 선이 아닌 곳을 눌렀을 때
 *   preview        (씨앗) → 긋는 동안 잘릴 선({ x1, y1, x2, y2 }) 또는 null
 *   onPaint        (칸 번호들, 회색인가) → 칸을 누르거나 문질렀을 때(직접 만들기). 이것이 있으면 선은 받지 않는다
 *   edgeLabel      (씨앗) → 읽어 줄 선의 이름(누를 수 있는 판에서만)
 *   cellLabel      (칸 번호) → 읽어 줄 칸의 이름(직접 만들기에서만)
 *   pieceLabel     (차례) → 읽어 줄 조각의 이름
 *   small          작은 그림으로 그린다
 */
export function drawSplit(root, view) {
  const { w, h, grey, cuts = [], pieces = [], counts = null, hide = [], uneven = [], lines = [], small = false } = view;
  const live = Boolean(view.onSeed || view.onPaint);
  root.className = `sp-board${small ? ' small' : ''}${live ? ' live' : ''}`;
  root.style.setProperty('--w', String(w));
  root.style.setProperty('--h', String(h));
  const board = boardOf(root);
  const { svg } = board;
  const focused = svg.contains(document.activeElement) ? document.activeElement.dataset.seed ?? document.activeElement.dataset.cell : undefined;
  svg.setAttribute('viewBox', `${-EDGE} ${-EDGE} ${w * UNIT + 2 * EDGE} ${h * UNIT + 2 * EDGE}`);
  svg.setAttribute('class', 'sp-svg');
  if (live) svg.removeAttribute('aria-hidden');
  else svg.setAttribute('aria-hidden', 'true');

  const greySet = new Set(grey);
  const nodes = [];
  // 칸: 회색 칸은 빗금까지
  for (let cell = 0; cell < w * h; cell++) {
    const x = (cell % w) * UNIT;
    const y = Math.floor(cell / w) * UNIT;
    const node = greySet.has(cell) ? greyCell(x, y) : make('rect', { x, y, width: UNIT, height: UNIT }, 'sp-cell sp-white');
    if (view.onPaint) {
      node.setAttribute('data-cell', String(cell));
      node.setAttribute('tabindex', '0');
      node.setAttribute('role', 'button');
      if (view.cellLabel) node.setAttribute('aria-label', view.cellLabel(cell));
    }
    nodes.push(node);
  }
  // 칸 사이의 가는 선과 판의 테두리
  for (let at = 1; at < w; at++) nodes.push(make('line', { x1: at * UNIT, y1: 0, x2: at * UNIT, y2: h * UNIT }, 'sp-grid'));
  for (let at = 1; at < h; at++) nodes.push(make('line', { x1: 0, y1: at * UNIT, x2: w * UNIT, y2: at * UNIT }, 'sp-grid'));
  // 짚는 선(끝에서 끝까지)
  for (const line of lines) {
    const ends = line.d === 'v' ? [line.at * UNIT, 0, line.at * UNIT, h * UNIT] : [0, line.at * UNIT, w * UNIT, line.at * UNIT];
    nodes.push(make('line', { x1: ends[0], y1: ends[1], x2: ends[2], y2: ends[3] }, 'sp-line'));
  }
  // 다르게 섞인 조각: 안쪽 점선 테두리
  for (const index of uneven) {
    const rect = pieces[index];
    if (!rect) continue;
    nodes.push(make('rect', { x: rect.x * UNIT + 12, y: rect.y * UNIT + 12, width: rect.w * UNIT - 24, height: rect.h * UNIT - 24, rx: 10 }, 'sp-uneven'));
  }
  nodes.push(make('rect', { x: 0, y: 0, width: w * UNIT, height: h * UNIT }, 'sp-frame'));
  // 자른 선
  for (const cut of cuts) nodes.push(make('line', { x1: cut.x1 * UNIT, y1: cut.y1 * UNIT, x2: cut.x2 * UNIT, y2: cut.y2 * UNIT }, 'sp-cut'));
  // 조각마다의 수
  if (counts) {
    pieces.forEach((rect, index) => {
      const node = tally(rect, counts[index], hide.includes(index));
      if (view.pieceLabel) {
        node.setAttribute('role', 'img');
        node.setAttribute('aria-label', view.pieceLabel(index));
      }
      nodes.push(node);
    });
  }
  // 누를 수 있는 선(글자판으로 고를 수 있게. 손가락은 판 전체에서 받는다)
  if (view.onSeed) {
    for (let at = 1; at < w; at++) {
      for (let i = 0; i < h; i++) nodes.push(edgeNode(view, { d: 'v', at, i }, [at * UNIT, i * UNIT, at * UNIT, (i + 1) * UNIT]));
    }
    for (let at = 1; at < h; at++) {
      for (let i = 0; i < w; i++) nodes.push(edgeNode(view, { d: 'h', at, i }, [i * UNIT, at * UNIT, (i + 1) * UNIT, at * UNIT]));
    }
  }
  board.mainLayer.replaceChildren(...nodes);
  board.view = { ...view, w, h, grey };
  board.press = null;
  drawLive(board);
  if (focused !== undefined) svg.querySelector(`[data-seed="${focused}"], [data-cell="${focused}"]`)?.focus?.();
}

function edgeNode(view, seed, [x1, y1, x2, y2]) {
  const node = make('line', { x1, y1, x2, y2, 'data-seed': `${seed.d},${seed.at},${seed.i}`, tabindex: '0', role: 'button' }, 'sp-edge');
  if (view.edgeLabel) node.setAttribute('aria-label', view.edgeLabel(seed));
  return node;
}

/**
 * 판 하나를 담은 새 조각을 만든다(풀이, "왜 그럴까?", 찾은 방법, 직접 만들기의 그림). 아래에 한 줄 글을 붙일 수 있다.
 * @param {object} view drawSplit에 건네는 것
 * @param {string} note 아래에 붙이는 글
 * @param {{big?: boolean}} options big: 종이에 하나만 크게 그린다
 */
export function splitCard(view, note, { big = false } = {}) {
  const card = document.createElement('div');
  card.className = big ? 'sp-card big' : 'sp-card';
  const picture = document.createElement('div');
  card.append(picture);
  drawSplit(picture, { ...view, small: true });
  if (note) {
    const line = document.createElement('p');
    line.className = 'strip-note';
    line.textContent = note;
    card.append(line);
  }
  return card;
}
