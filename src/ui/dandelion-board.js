// 민들레와 바람의 판을 그린다: 네모 칸들, 꽃(민들레), 씨앗, 방금 분 바람의 화살표.
// 누를 수 있는 판과 보기만 하는 그림을 같은 모양으로 그린다.
// 색만으로 알리지 않는다. 꽃은 꽃잎이 둘린 동그라미, 씨앗은 솜털이 달린 작은 점이다.
// 방금 심은 꽃에는 굵은 고리를 두르고, 방금 덮인 칸에는 굵은 점선 테두리를 두른다. 방금 분 바람은 판 위에 큰 화살표로 그린다.
// 글자는 대본에서 받는다(칸의 이름, 바람의 화살표 글자).

const NS = 'http://www.w3.org/2000/svg';
const UNIT = 100; // 칸 하나의 크기
const EDGE = 6; // 판 둘레에 두는 자리

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

/** 방향마다 한 칸 움직이는 값(src/core/dandelion.js의 DIRS와 같은 차례) */
const STEPS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
  [1, -1],
  [1, 1],
  [-1, 1],
  [-1, -1],
];

/** 민들레 한 송이: 꽃잎 열둘과 가운데 */
function flower(cx, cy) {
  const group = make('g', {}, 'dl-flower');
  for (let index = 0; index < 12; index++) {
    const angle = (index * Math.PI) / 6;
    group.append(make('ellipse', { cx: cx + Math.cos(angle) * 21, cy: cy + Math.sin(angle) * 21, rx: 11, ry: 6, transform: `rotate(${index * 30} ${cx + Math.cos(angle) * 21} ${cy + Math.sin(angle) * 21})` }, 'dl-petal'));
  }
  group.append(make('circle', { cx, cy, r: 14 }, 'dl-heart'));
  return group;
}

/** 씨앗 하나: 작은 점과 위로 퍼진 솜털 */
function seed(cx, cy) {
  const group = make('g', {}, 'dl-seed');
  group.append(make('line', { x1: cx, y1: cy + 18, x2: cx, y2: cy - 4 }, 'dl-stalk'));
  for (const angle of [-150, -120, -90, -60, -30]) {
    const rad = (angle * Math.PI) / 180;
    group.append(make('line', { x1: cx, y1: cy - 4, x2: cx + Math.cos(rad) * 20, y2: cy - 4 + Math.sin(rad) * 20 }, 'dl-fluff'));
  }
  group.append(make('circle', { cx, cy: cy + 20, r: 5 }, 'dl-grain'));
  return group;
}

/**
 * 판을 그린다.
 * @param {HTMLElement} root 그릴 자리(안의 것을 모두 바꾼다)
 * @param {object} view
 *   board     판 { w, h }
 *   flowers   꽃이 있는 칸들, seeds 씨앗만 있는 칸들
 *   fresh     마지막 수의 자국: { plant: 칸 } 또는 { wind: 방향, cells: 새로 덮인 칸들 }. 없으면 null
 *   label     (칸 번호) → 읽어 줄 이름(누를 수 있는 판에서만)
 *   onCell    (칸 번호) → 빈칸을 눌렀을 때. 없으면 그림으로만 그린다
 *   small     작은 그림으로 그린다
 */
export function drawField(root, view) {
  const { board, flowers = [], seeds = [], fresh = null, small = false } = view;
  const { w, h } = board;
  const live = Boolean(view.onCell);
  const focused = root.contains(document.activeElement) ? document.activeElement.dataset?.cell : undefined;
  root.className = `dl-board${small ? ' small' : ''}${live ? ' live' : ''}`;
  root.style.setProperty('--w', String(w));
  root.style.setProperty('--h', String(h));

  const svg = make('svg', { viewBox: `${-EDGE} ${-EDGE} ${w * UNIT + 2 * EDGE} ${h * UNIT + 2 * EDGE}`, preserveAspectRatio: 'xMidYMid meet' }, 'dl-svg');
  if (!live) svg.setAttribute('aria-hidden', 'true');
  const bloom = new Set(flowers);
  const fluff = new Set(seeds);
  const newCells = new Set(fresh && 'wind' in fresh ? fresh.cells : []);
  for (let cell = 0; cell < w * h; cell++) {
    const x = (cell % w) * UNIT;
    const y = Math.floor(cell / w) * UNIT;
    const empty = !bloom.has(cell) && !fluff.has(cell);
    const group = make('g', { 'data-cell': cell }, empty ? 'dl-cell-group open' : 'dl-cell-group');
    group.append(make('rect', { x, y, width: UNIT, height: UNIT }, empty ? 'dl-cell' : 'dl-cell covered'));
    if (bloom.has(cell)) group.append(flower(x + UNIT / 2, y + UNIT / 2));
    else if (fluff.has(cell)) group.append(seed(x + UNIT / 2, y + UNIT / 2));
    if (newCells.has(cell)) group.append(make('rect', { x: x + 8, y: y + 8, width: UNIT - 16, height: UNIT - 16, rx: 10 }, 'dl-fresh-seed'));
    if (fresh && fresh.plant === cell) group.append(make('circle', { cx: x + UNIT / 2, cy: y + UNIT / 2, r: 42 }, 'dl-fresh-flower'));
    if (live && empty) {
      group.setAttribute('tabindex', '0');
      group.setAttribute('role', 'button');
      if (view.label) group.setAttribute('aria-label', view.label(cell));
    }
    svg.append(group);
  }
  // 방금 분 바람: 판 가운데를 지나는 큰 화살표
  if (fresh && 'wind' in fresh) {
    const [dx, dy] = STEPS[fresh.wind];
    const cx = (w * UNIT) / 2;
    const cy = (h * UNIT) / 2;
    const reach = Math.min(w, h) * UNIT * 0.36;
    const length = Math.hypot(dx, dy);
    const [ux, uy] = [dx / length, dy / length];
    const [x1, y1, x2, y2] = [cx - ux * reach, cy - uy * reach, cx + ux * reach, cy + uy * reach];
    const head = 34;
    const [px, py] = [-uy, ux];
    svg.append(make('line', { x1, y1, x2: x2 - ux * head * 0.6, y2: y2 - uy * head * 0.6 }, 'dl-arrow'));
    svg.append(make('polygon', { points: `${x2},${y2} ${x2 - ux * head + px * head * 0.6},${y2 - uy * head + py * head * 0.6} ${x2 - ux * head - px * head * 0.6},${y2 - uy * head - py * head * 0.6}` }, 'dl-arrow-head'));
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

/**
 * 바람의 차례를 한 줄로 그린다(혼자 덮기). 분 바람은 흐리게, 다음 바람은 굵은 테두리로.
 * @param {HTMLElement} root
 * @param {{order: number[], used: number, arrows: string[], label: (dir: number, state: string) => string}} view
 *   used 이미 분 바람의 수, arrows 방향마다의 화살표 글자(대본), label 읽어 줄 이름
 */
export function drawOrder(root, { order, used, arrows, label }) {
  root.className = 'dl-order';
  root.replaceChildren(
    ...order.map((dir, index) => {
      const state = index < used ? 'done' : index === used ? 'next' : 'later';
      const item = el('span', `dl-order-item ${state}`, arrows[dir]);
      item.setAttribute('role', 'img');
      item.setAttribute('aria-label', label(dir, state));
      return item;
    }),
  );
}

/** 판 하나를 담은 새 조각을 만든다(다시 보기, 풀이, "왜 그럴까?"의 그림). 아래에 한 줄 글을 붙일 수 있다. */
export function fieldCard(view, note, { big = false } = {}) {
  const card = el('div', big ? 'dl-card big' : 'dl-card');
  const picture = el('div');
  card.append(picture);
  drawField(picture, { ...view, small: true });
  if (note) card.append(el('p', 'strip-note', note));
  return card;
}

/** 표 하나(판, 이기는 쪽). 첫 줄은 머리글이다. 표시할 줄(marked)은 굵게 */
export function fieldTable(heads, rows) {
  const table = el('table', 'swap-table dl-table');
  const head = el('thead');
  const headRow = el('tr');
  for (const text of heads) headRow.append(el('th', '', text));
  head.append(headRow);
  const body = el('tbody');
  for (const row of rows) {
    const line = el('tr', row.marked ? 'marked' : '');
    for (const text of row.cells) line.append(el('td', '', text));
    body.append(line);
  }
  table.append(head, body);
  return table;
}
