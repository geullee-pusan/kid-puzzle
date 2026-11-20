// 마법 네모와 겹친 칸의 판을 그린다: 칸(네모 판은 네모 칸, 겹친 칸 판은 동그라미), 줄마다 그은 옅은 길과 줄 끝의 합, 아직 놓지 않은 카드의 자리.
// 누를 수 있는 판과 보기만 하는 그림(처음 화면, 판 고르기, 공책, 풀이, "왜 그럴까?")을 같은 모양의 납작한 그림(svg)으로 그린다.
// 줄의 합은 놓인 카드만 더한 수를 그대로 적는다(셈을 머리로 하지 않게). 다 찬 줄은 실선 테두리, 덜 찬 줄은 점선 테두리이고,
// 합이 같은 줄(src/core/magic.js의 sameLines)은 굵은 테두리와 옅은 칠이다. 색만으로 알리지 않는다: 고른 카드는 굵은 테두리와 바깥 점선 고리다.
// "몇 번 세어지는지 보기"를 켜면 칸마다 그 칸을 지나는 줄의 수만큼 점을 찍는다.
// 누르는 것은 pointer 이벤트로 받는다. 카드나 놓인 칸을 누르고 끌면 카드가 손가락을 따라오고, 칸이나 카드 자리에서 떼면 그리로 옮긴다.
// 끌지 않고 누르기만 하면 누른 것을 알려 준다(고르고 놓기). 글자는 받지 않는다(읽어 주는 이름만 받는다).
import { lineSums, linesOf, passCounts, sameLines, sizeOf } from '../core/magic.js';

const NS = 'http://www.w3.org/2000/svg';
const U = 100; // 칸 하나의 크기
const DRAG_PX = 10; // 이만큼 움직여야 끄는 것으로 본다
/** 겹친 칸 판에서 가운데부터 바깥 칸까지의 거리(칸 크기의 몇 배). 줄이 많을수록 바깥 칸끼리 닿지 않게 멀리 둔다 */
const REACH = { 2: 1.2, 3: 1.3, 4: 1.5 };
/** 겹친 칸 판의 줄 방향(도). 아래쪽이 +이다. 줄 끝의 합은 오른쪽과 아래쪽 끝에 적는다 */
const ANGLES = { 2: [0, 90], 3: [0, 60, 120], 4: [0, 45, 90, 135] };
const MARK = 0.62; // 네모 판에서 칸의 가장자리부터 합까지의 거리

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

/**
 * 판의 자리들(칸 크기 U의 좌표). cells: 칸마다 가운데, lines: 줄마다 { from(길의 시작), mark(합을 적는 자리) }, round: 동그라미 칸인가
 */
export function layoutOf(board) {
  if (board.shape === 'hub') {
    const reach = REACH[board.arms] * U;
    const cells = [[0, 0]];
    const lines = [];
    ANGLES[board.arms].forEach((angle) => {
      const dx = Math.cos((angle * Math.PI) / 180);
      const dy = Math.sin((angle * Math.PI) / 180);
      cells.push([-dx * reach, -dy * reach], [dx * reach, dy * reach]);
      lines.push({ from: [-dx * reach, -dy * reach], mark: [dx * (reach + 0.95 * U), dy * (reach + 0.95 * U)] });
    });
    return { cells, lines, round: true };
  }
  const { w, h } = board;
  const cells = Array.from({ length: w * h }, (_, cell) => [((cell % w) + 0.5) * U, (Math.floor(cell / w) + 0.5) * U]);
  const right = (w + MARK) * U;
  const below = (h + MARK) * U;
  const lines = linesOf(board).map((line) => {
    if (line.kind === 'row') return { from: [0.5 * U, (line.at + 0.5) * U], mark: [right, (line.at + 0.5) * U] };
    if (line.kind === 'col') return { from: [(line.at + 0.5) * U, 0.5 * U], mark: [(line.at + 0.5) * U, below] };
    if (line.kind === 'diag') return { from: [0.5 * U, 0.5 * U], mark: [right, below] };
    return { from: [0.5 * U, (h - 0.5) * U], mark: [right, -MARK * U] };
  });
  return { cells, lines, round: false };
}

/** 그림이 차지하는 네모(칸, 합) */
function boxOf(layout) {
  const points = [...layout.cells.map(([x, y]) => [x, y, 0.5 * U]), ...layout.lines.map(({ mark: [x, y] }) => [x, y, 0.44 * U])];
  return {
    x0: Math.min(...points.map(([x, , r]) => x - r)) - 6,
    y0: Math.min(...points.map(([, y, r]) => y - r)) - 6,
    x1: Math.max(...points.map(([x, , r]) => x + r)) + 6,
    y1: Math.max(...points.map(([, y, r]) => y + r)) + 6,
  };
}

/** 아직 놓지 않은 카드의 자리: 그림 오른쪽에 카드마다 자리 하나(작은 수부터). 카드가 다섯 장 이하면 두 줄, 아니면 세 줄로 늘어놓는다 */
function trayOf(box, count) {
  const cols = count <= 5 ? 2 : 3;
  const rows = Math.ceil(count / cols);
  const x0 = box.x1 + 0.4 * U;
  const y0 = (box.y0 + box.y1) / 2 - (rows * U) / 2;
  const slots = Array.from({ length: count }, (_, index) => [x0 + ((index % cols) + 0.5) * U, y0 + (Math.floor(index / cols) + 0.5) * U]);
  return { x0: x0 - 0.1 * U, y0: y0 - 0.1 * U, x1: x0 + cols * U + 0.1 * U, y1: y0 + rows * U + 0.1 * U, slots };
}

/** 카드 한 장(놓인 카드, 놓지 않은 카드, 끄는 카드) */
function cardNode([x, y], card, round, className = '') {
  const group = make('g', {}, `mg-card${className ? ` ${className}` : ''}`);
  if (round) group.append(make('circle', { cx: x, cy: y, r: 0.42 * U }));
  else group.append(make('rect', { x: x - 0.42 * U, y: y - 0.42 * U, width: 0.84 * U, height: 0.84 * U, rx: 14 }));
  const text = make('text', { x, y: y + 2, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': card >= 10 ? 42 : 48 });
  text.textContent = String(card);
  group.append(text);
  return group;
}

/** 칸 하나: 빈칸이면 옅은 자리, 카드가 있으면 카드. 점 표시를 켰으면 칸을 지나는 줄의 수만큼 점 */
function cellNode(layout, cell, card, { picked, dots, live, label }) {
  const [x, y] = layout.cells[cell];
  const group = make('g', { 'data-cell': cell }, `mg-cell${card === null ? ' empty' : ' filled'}${picked ? ' picked' : ''}`);
  if (layout.round) group.append(make('circle', { cx: x, cy: y, r: 0.46 * U }, 'mg-spot'));
  else group.append(make('rect', { x: x - 0.46 * U, y: y - 0.46 * U, width: 0.92 * U, height: 0.92 * U, rx: 12 }, 'mg-spot'));
  if (card !== null) group.append(cardNode([x, y], card, layout.round));
  if (picked) {
    if (layout.round) group.append(make('circle', { cx: x, cy: y, r: 0.5 * U }, 'mg-ring'));
    else group.append(make('rect', { x: x - 0.5 * U, y: y - 0.5 * U, width: U, height: U, rx: 16 }, 'mg-ring'));
  }
  if (dots > 0) {
    // 칸 위쪽 가장자리에 점을 가로로 늘어놓는다
    const gap = 15;
    const left = x - ((dots - 1) * gap) / 2;
    for (let at = 0; at < dots; at++) group.append(make('circle', { cx: left + at * gap, cy: y - 0.3 * U, r: 6 }, 'mg-dot'));
  }
  if (live) {
    group.setAttribute('tabindex', '0');
    group.setAttribute('role', 'button');
  }
  if (label) group.setAttribute('aria-label', label);
  return group;
}

/** 줄 끝의 합. 다 찬 줄은 실선, 덜 찬 줄은 점선 테두리, 합이 같은 줄은 굵은 테두리. 놓인 카드가 없으면 비워 둔다 */
function markNode(line, info, same) {
  const [x, y] = line.mark;
  const state = info.filled === 0 ? 'none' : info.full ? 'full' : 'part';
  const group = make('g', { 'aria-hidden': 'true' }, `mg-sum ${state}${same ? ' same' : ''}`);
  group.append(make('rect', { x: x - 0.4 * U, y: y - 0.3 * U, width: 0.8 * U, height: 0.6 * U, rx: 12 }));
  if (info.filled > 0) {
    const text = make('text', { x, y: y + 2, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': info.sum >= 100 ? 30 : 36 });
    text.textContent = String(info.sum);
    group.append(text);
  }
  return group;
}

/** 줄마다 옅은 길(칸 가운데를 지나 합까지) */
function guideNode(layout, line) {
  return make('line', { x1: line.from[0], y1: line.from[1], x2: line.mark[0], y2: line.mark[1] }, 'mg-guide');
}

/** 화면의 자리를 svg 안의 좌표로 */
function pointIn(svg, event) {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  return new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
}

/** 떼어 놓은 자리: 칸 번호, 'tray'(카드 자리), 또는 null */
function dropAt(board, spot) {
  if (!spot) return null;
  const { layout, tray } = board;
  let best = null;
  let near = 0.6 * U;
  layout.cells.forEach(([x, y], cell) => {
    const far = Math.hypot(spot.x - x, spot.y - y);
    if (far < near) {
      near = far;
      best = cell;
    }
  });
  if (best !== null) return best;
  if (tray && spot.x >= tray.x0 && spot.x <= tray.x1 && spot.y >= tray.y0 && spot.y <= tray.y1) return 'tray';
  return null;
}

/** 그릴 자리에 판을 한 번 만들어 둔다. 끄는 동안에도 판이 바뀌지 않게, 안의 것만 바꿔 그린다. */
function boardOf(root) {
  let board = boards.get(root);
  if (board && board.svg.parentNode === root) return board;
  const svg = make('svg', { preserveAspectRatio: 'xMidYMid meet' }, 'mg-svg');
  const main = make('g');
  const top = make('g', { 'pointer-events': 'none' });
  svg.append(main, top);
  board = { svg, main, top, view: null, layout: null, tray: null, press: null };
  boards.set(root, board);

  const letGo = () => {
    board.press = null;
    board.top.replaceChildren();
    board.svg.classList.remove('dragging');
  };

  svg.addEventListener('pointerdown', (event) => {
    const { view } = board;
    if (!view?.live || event.button > 0) return;
    const target = event.target.closest?.('[data-cell], [data-card], [data-tray]');
    if (!target) return;
    event.preventDefault();
    let from = null;
    if (target.dataset.card !== undefined) from = { card: Number(target.dataset.card) };
    else if (target.dataset.cell !== undefined) from = { cell: Number(target.dataset.cell) };
    else from = { tray: true };
    const card = from.card ?? (from.cell !== undefined ? view.placed[from.cell] : null);
    board.press = { id: event.pointerId, x: event.clientX, y: event.clientY, from, card, dragging: false };
    try {
      svg.setPointerCapture(event.pointerId);
    } catch {
      // 붙잡지 못해도 누르는 것은 그대로 된다.
    }
  });
  svg.addEventListener('pointermove', (event) => {
    const { press } = board;
    if (!press || press.id !== event.pointerId || press.card === null || press.card === undefined) return;
    if (!press.dragging && Math.hypot(event.clientX - press.x, event.clientY - press.y) < DRAG_PX) return;
    const spot = pointIn(svg, event);
    if (!spot) return;
    if (!press.dragging) {
      press.dragging = true;
      svg.classList.add('dragging');
    }
    const over = dropAt(board, spot);
    const marks = [];
    if (typeof over === 'number') {
      const [x, y] = board.layout.cells[over];
      marks.push(board.layout.round ? make('circle', { cx: x, cy: y, r: 0.52 * U }, 'mg-over') : make('rect', { x: x - 0.52 * U, y: y - 0.52 * U, width: 1.04 * U, height: 1.04 * U, rx: 16 }, 'mg-over'));
    }
    board.top.replaceChildren(...marks, cardNode([spot.x, spot.y], press.card, board.layout.round, 'mg-ghost'));
  });
  svg.addEventListener('pointerup', (event) => {
    const { press, view } = board;
    if (!press || press.id !== event.pointerId) return;
    const dragging = press.dragging;
    const to = dragging ? dropAt(board, pointIn(svg, event)) : null;
    letGo();
    if (!view?.live) return;
    if (dragging) {
      if (to !== null) view.onDrop?.(press.from, to);
      return;
    }
    if (press.from.card !== undefined) view.onCard?.(press.from.card);
    else if (press.from.cell !== undefined) view.onCell?.(press.from.cell);
    else view.onTray?.();
  });
  svg.addEventListener('pointercancel', letGo);
  // 글자판으로도 누를 수 있다
  svg.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const { view } = board;
    const target = event.target.closest?.('[data-cell], [data-card], [data-tray]');
    if (!view?.live || !target) return;
    event.preventDefault();
    if (target.dataset.card !== undefined) view.onCard?.(Number(target.dataset.card));
    else if (target.dataset.cell !== undefined) view.onCell?.(Number(target.dataset.cell));
    else view.onTray?.();
  });
  root.replaceChildren(svg);
  return board;
}

/**
 * 판을 그린다.
 * @param {HTMLElement} root 그릴 자리(안의 것을 모두 바꾼다)
 * @param {object} view
 *   board     판(src/core/magic.js)
 *   placed    칸마다 놓인 카드(빈칸은 null)
 *   pick      고른 것: { card }(놓지 않은 카드) | { cell }(놓인 칸) | null
 *   dots      참이면 칸마다 지나는 줄의 수만큼 점을 찍는다
 *   tray      참이면 아직 놓지 않은 카드의 자리를 그린다
 *   labels    읽어 줄 이름: { cell(칸, 카드 또는 null, 골랐는가), card(카드, 골랐는가), slot, board }
 *   onCard    (카드) 놓지 않은 카드를 눌렀을 때
 *   onCell    (칸) 칸을 눌렀을 때
 *   onTray    () 빈 카드 자리를 눌렀을 때
 *   onDrop    ({card}|{cell}, 칸 번호|'tray') 끌어서 떼었을 때
 *   small     작은 그림으로 그린다(누를 수 없다)
 */
export function drawBoard(root, view) {
  const { board, placed, pick = null, dots = false, tray = false, labels = null, small = false } = view;
  const live = Boolean(view.onCell);
  root.className = `mg-board${small ? ' small' : ''}${live ? ' live' : ''}`;
  const state = boardOf(root);
  const { svg } = state;
  const focused = svg.contains(document.activeElement) ? (document.activeElement.dataset.cell !== undefined ? `cell:${document.activeElement.dataset.cell}` : `card:${document.activeElement.dataset.card}`) : null;
  const layout = layoutOf(board);
  const box = boxOf(layout);
  const sums = lineSums(board, placed);
  const same = sameLines(board, sums);
  const counts = dots ? passCounts(board) : null;
  const nodes = [];
  layout.lines.forEach((line) => nodes.push(guideNode(layout, line)));
  layout.lines.forEach((line, index) => nodes.push(markNode(line, sums[index], same[index])));
  for (let cell = 0; cell < sizeOf(board); cell++) {
    const card = placed[cell];
    const picked = pick?.cell === cell;
    nodes.push(cellNode(layout, cell, card, { picked, dots: counts ? counts[cell] : 0, live, label: labels?.cell(cell, card, picked) }));
  }
  let trayBox = null;
  if (tray) {
    const cards = board.cards.slice().sort((a, b) => a - b);
    trayBox = trayOf(box, cards.length);
    nodes.push(make('rect', { x: trayBox.x0, y: trayBox.y0, width: trayBox.x1 - trayBox.x0, height: trayBox.y1 - trayBox.y0, rx: 16, 'data-tray': '1' }, 'mg-tray'));
    cards.forEach((card, index) => {
      const spot = trayBox.slots[index];
      if (placed.includes(card)) {
        const slot = make('rect', { x: spot[0] - 0.4 * U, y: spot[1] - 0.4 * U, width: 0.8 * U, height: 0.8 * U, rx: 12, 'data-tray': '1' }, 'mg-slot');
        if (live && pick?.cell !== undefined) {
          slot.setAttribute('tabindex', '0');
          slot.setAttribute('role', 'button');
          if (labels) slot.setAttribute('aria-label', labels.slot);
        }
        nodes.push(slot);
        return;
      }
      const picked = pick?.card === card;
      const node = cardNode(spot, card, false, `loose${picked ? ' picked' : ''}`);
      node.setAttribute('data-card', String(card));
      if (picked) node.append(make('rect', { x: spot[0] - 0.48 * U, y: spot[1] - 0.48 * U, width: 0.96 * U, height: 0.96 * U, rx: 16 }, 'mg-ring'));
      if (live) {
        node.setAttribute('tabindex', '0');
        node.setAttribute('role', 'button');
        if (labels) node.setAttribute('aria-label', labels.card(card, picked));
      }
      nodes.push(node);
    });
  }
  const x0 = box.x0;
  const y0 = Math.min(box.y0, trayBox ? trayBox.y0 - 6 : box.y0);
  const x1 = trayBox ? trayBox.x1 + 6 : box.x1;
  const y1 = Math.max(box.y1, trayBox ? trayBox.y1 + 6 : box.y1);
  svg.setAttribute('viewBox', `${x0} ${y0} ${x1 - x0} ${y1 - y0}`);
  root.style.setProperty('--w', String((x1 - x0) / U));
  root.style.setProperty('--h', String((y1 - y0) / U));
  if (live || labels?.board) {
    svg.setAttribute('role', 'group');
    if (labels?.board) svg.setAttribute('aria-label', labels.board);
    svg.removeAttribute('aria-hidden');
  } else {
    svg.removeAttribute('role');
    svg.setAttribute('aria-hidden', 'true');
  }
  state.main.replaceChildren(...nodes);
  state.view = { ...view, live };
  state.layout = layout;
  state.tray = trayBox;
  state.press = null;
  state.top.replaceChildren();
  if (focused) {
    const [kind, value] = focused.split(':');
    (svg.querySelector(`[data-${kind}="${value}"]`) ?? svg.querySelector('[data-tray][tabindex]'))?.focus?.();
  }
}

/** 작은 그림(처음 화면, 판 고르기, 하던 판 띠, 공책). 놓인 카드와 줄의 합까지 그린다. tray가 참이면 아직 놓지 않은 카드도 옆에 그린다 */
export function drawMini(root, board, placed = Array(sizeOf(board)).fill(null), { dots = false, tray = false } = {}) {
  drawBoard(root, { board, placed, dots, tray, small: true });
}

/**
 * 판 하나를 담은 새 조각을 만든다(풀이, "왜 그럴까?", 직접 만들기의 그림). 아래에 한 줄 글을 붙일 수 있다.
 * @param {{board, placed, dots?}} view
 * @param {string} note
 * @param {{big?: boolean}} options
 */
export function boardCard(view, note, { big = false } = {}) {
  const card = el('div', big ? 'mg-figure big' : 'mg-figure');
  const picture = el('div', 'mg-figure-picture');
  const inner = el('div');
  picture.append(inner);
  card.append(picture);
  drawBoard(inner, { ...view, small: true });
  if (note) card.append(el('p', 'strip-note', note));
  return card;
}

/**
 * 직접 만들기의 수 고르기: 1부터 끝 수까지의 카드. 누르면 골라지고, 다시 누르면 빠진다. 고른 카드는 굵은 테두리에 칠이 있다.
 * @param {HTMLElement} root
 * @param {{last: number, chosen: number[], label: (card: number, on: boolean) => string, onTap: (card: number) => void}} view
 */
export function drawPicker(root, view) {
  const focused = root.contains(document.activeElement) ? document.activeElement.dataset?.card : undefined;
  root.className = 'mg-picker';
  const nodes = [];
  for (let card = 1; card <= view.last; card++) {
    const on = view.chosen.includes(card);
    const node = el('button', on ? 'btn mg-pick on' : 'btn mg-pick', String(card));
    node.type = 'button';
    node.dataset.card = String(card);
    node.setAttribute('aria-pressed', String(on));
    node.setAttribute('aria-label', view.label(card, on));
    node.addEventListener('click', () => view.onTap(card));
    nodes.push(node);
  }
  root.replaceChildren(...nodes);
  if (focused !== undefined) root.querySelector(`[data-card="${focused}"]`)?.focus?.();
}
