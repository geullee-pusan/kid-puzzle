// 주사위 미로의 판을 그린다: 세모꼴로 놓인 갈림길, 그 사이의 길, 맨 아래 출구, 출구마다 쌓이는 손님 막대.
// 누를 수 있는 판과 보기만 하는 그림을 같은 모양으로 그린다.
// 색만으로 알리지 않는다. 잠긴 칸에는 자물쇠, 열린 칸에는 수, 막힌 갈림길에는 금이 간 돌, 칠한 칸에는 빗금,
// 고른 칸과 표시한 출구에는 굵은 테두리, 그리던 길에는 굵은 선을 그린다. 손님은 사람 모양, 주사위는 눈이 찍힌 네모다.
// 글자는 대본에서 받는다(출구의 이름, 손님 수 뒤에 붙는 말, 읽어 줄 이름).
import { cellAt, cellCount, childrenOf, pathCell, rowCol } from '../core/maze.js';

const NS = 'http://www.w3.org/2000/svg';
const UX = 100; // 이웃한 칸 사이의 가로 거리
const UY = 92; // 줄 사이의 세로 거리
const NODE = 66; // 갈림길 칸의 크기
const BAR_H = 150; // 손님 막대의 가장 높은 키
const TOP = 48; // 맨 위 칸의 가운데 높이
let patterns = 0; // 빗금 무늬의 이름이 그림마다 겹치지 않게 센다

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

function text(x, y, value, className) {
  const node = make('text', { x, y, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, className);
  node.textContent = String(value);
  return node;
}

/** 주사위의 눈 자리(가운데를 0으로 한 칸 단위) */
const PIPS = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

/** 주사위 하나: 둥근 네모와 눈 */
function die(cx, cy, roll) {
  const group = make('g', {}, 'mz-die');
  group.append(make('rect', { x: cx - 22, y: cy - 22, width: 44, height: 44, rx: 9 }, 'mz-die-face'));
  for (const [dx, dy] of PIPS[roll] ?? []) group.append(make('circle', { cx: cx + dx * 11, cy: cy + dy * 11, r: 4.6 }, 'mz-pip'));
  return group;
}

/** 손님 하나: 머리와 몸 */
function guest(cx, cy) {
  const group = make('g', {}, 'mz-guest');
  group.append(make('circle', { cx, cy: cy - 14, r: 10 }, 'mz-guest-head'));
  group.append(make('path', { d: `M ${cx - 13} ${cy + 16} Q ${cx} ${cy - 10} ${cx + 13} ${cy + 16} Z` }, 'mz-guest-body'));
  return group;
}

/** 자물쇠: 고리와 몸통 */
function lock(cx, cy) {
  const group = make('g', {}, 'mz-lock');
  group.append(make('path', { d: `M ${cx - 9} ${cy - 2} v -7 a 9 9 0 0 1 18 0 v 7` }, 'mz-lock-ring'));
  group.append(make('rect', { x: cx - 14, y: cy - 3, width: 28, height: 21, rx: 4 }, 'mz-lock-body'));
  return group;
}

/** 막힌 갈림길: 금이 간 돌 */
function stone(cx, cy) {
  const group = make('g', {}, 'mz-stone');
  const r = NODE / 2 - 2;
  const points = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => {
    const angle = (Math.PI / 4) * k + Math.PI / 8;
    const reach = k % 2 === 0 ? r : r * 0.86;
    return `${cx + Math.cos(angle) * reach},${cy + Math.sin(angle) * reach}`;
  });
  group.append(make('polygon', { points: points.join(' ') }, 'mz-stone-body'));
  group.append(make('path', { d: `M ${cx - 12} ${cy - 16} L ${cx - 2} ${cy - 2} L ${cx - 8} ${cy + 8} M ${cx - 2} ${cy - 2} L ${cx + 14} ${cy + 4}` }, 'mz-stone-crack'));
  return group;
}

/**
 * 판을 그린다.
 * @param {HTMLElement} root 그릴 자리(안의 것을 모두 바꾼다)
 * @param {object} view
 *   board      판 { rows, blocked, target }
 *   exitNames  출구의 이름들(대본)
 *   shown      칸마다 보여 줄 수(없으면 null). 열린 자물쇠와 맨 위 칸
 *   locked     자물쇠를 그릴 칸들(Set)
 *   painted    칠한 칸들(Set)
 *   selected   고른 칸(굵은 테두리). 없으면 null
 *   picked     실험에서 고른 출구. 없으면 null
 *   path       그리던 길('L'과 'R'의 글자 줄). 없으면 null
 *   paths      함께 그릴 길들(풀이와 설명의 그림)
 *   mark       눈에 띄게 할 칸 하나. 그 칸과 바로 위 칸들에 굵은 테두리를 두른다
 *   guest      내려가는 손님 { cell, roll }(roll이 있으면 그 갈림길 옆에 주사위를 그린다). 없으면 null
 *   ends       칸마다 거기서 끝난 손님 수. 있으면 출구 아래에 막대를, 막힌 칸 옆에 멈춘 손님 수를 그린다
 *   guestText  (손님 수) → 막대 위에 적을 글
 *   label      (칸 번호) → 읽어 줄 이름(누를 수 있는 판에서만)
 *   onCell     (칸 번호) → 칸을 눌렀을 때. 없으면 그림으로만 그린다
 *   small      작은 그림으로 그린다
 */
export function drawMaze(root, view) {
  const { board, exitNames = [], shown = [], locked = new Set(), painted = new Set(), selected = null, picked = null, path = null, paths = [], mark = null, guest: walker = null, ends = null, small = false } = view;
  const { rows } = board;
  const live = Boolean(view.onCell);
  const focused = root.contains(document.activeElement) ? document.activeElement.dataset?.cell : undefined;
  root.className = `mz-board${small ? ' small' : ''}${live ? ' live' : ''}`;
  const bars = Array.isArray(ends);
  const width = (rows + 1) * UX;
  const x = (r, i) => UX / 2 + (i + (rows - r) / 2) * UX;
  const y = (r) => TOP + r * UY;
  const nameY = y(rows) + 62;
  const height = nameY + 26 + (bars ? BAR_H + 70 : 0);
  root.style.setProperty('--w', String(width));
  root.style.setProperty('--h', String(height));

  const svg = make('svg', { viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: 'xMidYMid meet' }, 'mz-svg');
  if (!live) svg.setAttribute('aria-hidden', 'true');
  const hatch = `mz-hatch-${(patterns += 1)}`;
  const defs = make('defs');
  const pattern = make('pattern', { id: hatch, width: 14, height: 14, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
  pattern.append(make('rect', { width: 14, height: 14 }, 'mz-paint-base'), make('line', { x1: 0, y1: 0, x2: 0, y2: 14 }, 'mz-paint-line'));
  defs.append(pattern);
  svg.append(defs);

  const blocked = new Set(board.blocked);
  // 그리던 길과 함께 그릴 길이 지나는 칸 사이(위 칸 → 아래 칸)
  const onPath = new Set();
  const pathCells = new Set();
  for (const route of [...paths, ...(path === null ? [] : [path])]) {
    let before = 0;
    pathCells.add(0);
    for (let length = 1; length <= route.length; length++) {
      const cell = pathCell(board, route.slice(0, length));
      if (cell === null) break;
      onPath.add(`${before}-${cell}`);
      pathCells.add(cell);
      before = cell;
    }
  }

  // 길: 갈림길에서 아래 두 칸으로
  const roads = make('g', {}, 'mz-roads');
  for (let cell = 0; cell < cellCount(rows); cell++) {
    const { r, i } = rowCol(cell);
    for (const child of childrenOf(rows, cell)) {
      const { r: cr, i: ci } = rowCol(child);
      const closed = blocked.has(cell) || blocked.has(child);
      const className = onPath.has(`${cell}-${child}`) ? 'mz-road on' : closed ? 'mz-road closed' : 'mz-road';
      roads.append(make('line', { x1: x(r, i), y1: y(r), x2: x(cr, ci), y2: y(cr) - (cr === rows ? 26 : 0) }, className));
    }
  }
  svg.append(roads);

  const marked = mark === null ? new Set() : new Set([mark, ...parentCells(mark)]);
  for (let cell = 0; cell < cellCount(rows); cell++) {
    const { r, i } = rowCol(cell);
    const cx = x(r, i);
    const cy = y(r);
    const exit = r === rows;
    const group = make('g', { 'data-cell': cell }, exit ? 'mz-cell-group exit' : 'mz-cell-group');
    const classes = ['mz-cell'];
    if (exit) classes.push('mz-door');
    if (painted.has(cell)) classes.push('painted');
    if (selected === cell) classes.push('selected');
    if (pathCells.has(cell)) classes.push('on-path');
    if (marked.has(cell)) classes.push('marked');
    if (exit && board.target === i) classes.push('target');
    if (exit && picked === i) classes.push('picked');
    if (blocked.has(cell)) group.append(stone(cx, cy));
    else if (exit) {
      // 출구: 위가 둥근 문
      const left = cx - 38;
      const right = cx + 38;
      const top = cy - 30;
      const bottom = cy + 40;
      group.append(make('path', { d: `M ${left} ${bottom} V ${top + 20} A 38 20 0 0 1 ${right} ${top + 20} V ${bottom} Z` }, classes.join(' ')));
    } else group.append(make('rect', { x: cx - NODE / 2, y: cy - NODE / 2, width: NODE, height: NODE, rx: 14 }, classes.join(' ')));
    if (painted.has(cell)) {
      const shape = group.lastChild.cloneNode();
      shape.setAttribute('class', 'mz-paint');
      shape.setAttribute('fill', `url(#${hatch})`);
      group.append(shape);
    }
    const value = shown[cell];
    const midY = exit ? cy + 6 : cy;
    if (value !== null && value !== undefined) group.append(text(cx, midY, value, value >= 100 ? 'mz-number long' : 'mz-number'));
    else if (locked.has(cell)) group.append(lock(cx, midY));
    if (exit && exitNames[i]) group.append(text(cx, nameY, exitNames[i], picked === i || board.target === i ? 'mz-exit-name strong' : 'mz-exit-name'));
    if (live && !blocked.has(cell)) {
      group.setAttribute('tabindex', '0');
      group.setAttribute('role', 'button');
      if (view.label) group.setAttribute('aria-label', view.label(cell));
    }
    svg.append(group);
  }

  // 손님 막대: 출구 아래에 쌓인다. 가장 많은 출구의 막대가 가장 높다
  if (bars) {
    // 가장 높은 막대 위의 글이 출구 이름에 닿지 않게 한 줄을 띄운다
    const base = nameY + 56 + BAR_H;
    const tally = Array.from({ length: rows + 1 }, (_, k) => ends[cellAt(rows, k)] ?? 0);
    const most = Math.max(1, ...tally);
    const group = make('g', {}, 'mz-bars');
    group.append(make('line', { x1: 10, y1: base, x2: width - 10, y2: base }, 'mz-base'));
    tally.forEach((count, k) => {
      const cx = x(rows, k);
      const tall = (count / most) * BAR_H;
      group.append(make('rect', { x: cx - 26, y: base - tall, width: 52, height: tall }, picked === k ? 'mz-bar picked' : 'mz-bar'));
      group.append(text(cx, base - tall - 18, view.guestText ? view.guestText(count) : count, 'mz-bar-count'));
    });
    svg.append(group);
    // 막힌 갈림길에서 멈춘 손님
    for (const cell of board.blocked) {
      if (!(ends[cell] > 0)) continue;
      const { r, i } = rowCol(cell);
      svg.append(text(x(r, i), y(r) + NODE / 2 + 16, view.guestText ? view.guestText(ends[cell]) : ends[cell], 'mz-halted'));
    }
  }

  // 내려가는 손님과 주사위
  if (walker) {
    const { r, i } = rowCol(walker.cell);
    svg.append(guest(x(r, i) - 30, y(r) - 24));
    if (walker.roll) svg.append(die(x(r, i) + 34, y(r) - 30, walker.roll));
  }

  if (live) {
    svg.addEventListener('click', (event) => {
      const target = event.target.closest?.('[data-cell]');
      if (target) view.onCell(Number(target.dataset.cell));
    });
    // 글자판으로도 누를 수 있다.
    svg.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const target = event.target.closest?.('[data-cell]');
      if (!target) return;
      event.preventDefault();
      view.onCell(Number(target.dataset.cell));
    });
  }
  root.replaceChildren(svg);
  if (focused !== undefined) svg.querySelector(`[data-cell="${focused}"]`)?.focus?.();
}

/** 칸의 바로 위 칸들 */
function parentCells(cell) {
  const { r, i } = rowCol(cell);
  if (r === 0) return [];
  const list = [];
  if (i > 0) list.push(cellAt(r - 1, i - 1));
  if (i < r) list.push(cellAt(r - 1, i));
  return list;
}

/** 판 하나를 담은 새 조각을 만든다(풀이, "왜 그럴까?"의 그림). 아래에 한 줄 글을 붙일 수 있다. */
export function mazeCard(view, note, { big = false } = {}) {
  const card = el('div', big ? 'mz-card big' : 'mz-card');
  const picture = el('div');
  card.append(picture);
  drawMaze(picture, { ...view, small: true });
  if (note) card.append(el('p', 'strip-note', note));
  return card;
}

/** 적은 길의 목록(왼쪽 칸). 길마다 화살표 줄과 끝 칸의 이름 */
export function pathList(root, items) {
  root.replaceChildren(
    ...items.map((item) => {
      const row = el('li', item.fresh ? 'mz-path-item fresh' : 'mz-path-item');
      row.append(el('span', 'mz-path-arrows', item.arrows), el('span', 'mz-path-end', item.end));
      return row;
    }),
  );
}
