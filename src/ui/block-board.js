// 조각 못 들어가게 막기의 판을 그린다: 네모 칸들, 판에서 빠진 칸, 막은 칸, 조각이 들어갈 수 있는 자리.
// 누를 수 있는 판과 보기만 하는 그림을 같은 모양으로 그린다.
// 색만으로 알리지 않는다. 막은 칸은 어둡게 메우고 가위표를 긋는다. 판에서 빠진 칸은 칸을 그리지 않고 가는 점선 테두리만 남긴다.
// 조각이 들어갈 수 있는 자리(도구로 보는 자리)는 그 칸들을 옅게 메우고 둘레에 굵은 점선을 두른다.
// 그림에서 짚는 자리(서로 겹치지 않는 자리들)는 자리마다 옅은 색을 번갈아 칠하고 둘레에 굵은 실선을 두른다. 글자는 대본에서 받는다.

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

let clips = 0; // 판마다 겹치지 않는 이름을 붙이려고 센다

/**
 * 칸들의 둘레를 선으로 긋는다. 칸마다 네 변 가운데 이웃 칸이 같은 묶음에 없는 변만 칸의 금을 따라 긋는다.
 * 선은 그 칸들 안쪽에만 보이게 오려 낸다. 그래서 이웃한 두 자리의 둘레가 겹치지 않고, 선 굵기의 반만큼 안으로 든 둘레가 된다.
 * @returns {SVGElement[]} 오려 낼 모양과 선
 */
function outline(w, cells, className) {
  const has = new Set(cells);
  const inside = (x, y) => x >= 0 && x < w && y >= 0 && has.has(y * w + x);
  const parts = [];
  const id = `block-clip-${(clips += 1)}`;
  const clip = make('clipPath', { id });
  for (const cell of cells) {
    const x = cell % w;
    const y = Math.floor(cell / w);
    clip.append(make('rect', { x: x * UNIT, y: y * UNIT, width: UNIT, height: UNIT }));
    const [left, right, top, bottom] = [x * UNIT, (x + 1) * UNIT, y * UNIT, (y + 1) * UNIT];
    if (!inside(x, y - 1)) parts.push(`M${left},${top}H${right}`);
    if (!inside(x, y + 1)) parts.push(`M${left},${bottom}H${right}`);
    if (!inside(x - 1, y)) parts.push(`M${left},${top}V${bottom}`);
    if (!inside(x + 1, y)) parts.push(`M${right},${top}V${bottom}`);
  }
  return [clip, make('path', { d: parts.join(''), 'clip-path': `url(#${id})` }, className)];
}

const isLive = (view) => Boolean(view.onCell);

/**
 * 판을 그린다.
 * @param {HTMLElement} root 그릴 자리(안의 것을 모두 바꾼다)
 * @param {object} view
 *   w, h      가로와 세로의 칸 수
 *   holes     판에서 빠진 칸들
 *   blocked   막은 칸들
 *   ghost     조각이 아직 들어갈 수 있는 자리 하나(칸 번호들). 없으면 null
 *   spots     그림에서 짚는 자리들(자리마다 칸 번호들)
 *   label     (칸 번호) → 읽어 줄 이름(누를 수 있는 판에서만)
 *   onCell    (칸 번호) → 칸을 눌렀을 때. 없으면 그림으로만 그린다
 *   small     작은 그림으로 그린다
 */
export function drawBoard(root, view) {
  const { w, h, holes = [], blocked = [], ghost = null, spots = [], small = false } = view;
  const live = isLive(view);
  const focused = root.contains(document.activeElement) ? document.activeElement.dataset?.cell : undefined;
  root.className = `block-board${small ? ' small' : ''}${live ? ' live' : ''}`;
  root.style.setProperty('--w', String(w));
  root.style.setProperty('--h', String(h));

  const svg = make('svg', { viewBox: `${-EDGE} ${-EDGE} ${w * UNIT + 2 * EDGE} ${h * UNIT + 2 * EDGE}`, preserveAspectRatio: 'xMidYMid meet' }, 'block-svg');
  if (!live) svg.setAttribute('aria-hidden', 'true');
  const shut = new Set(blocked);
  const gone = new Set(holes);
  for (let cell = 0; cell < w * h; cell++) {
    const x = cell % w;
    const y = Math.floor(cell / w);
    if (gone.has(cell)) {
      svg.append(make('rect', { x: x * UNIT + 12, y: y * UNIT + 12, width: UNIT - 24, height: UNIT - 24, rx: 10 }, 'block-hole'));
      continue;
    }
    const group = make('g', { 'data-cell': cell }, 'block-cell-group');
    group.append(make('rect', { x: x * UNIT, y: y * UNIT, width: UNIT, height: UNIT }, shut.has(cell) ? 'block-cell shut' : 'block-cell'));
    if (shut.has(cell)) {
      group.append(make('line', { x1: x * UNIT + 26, y1: y * UNIT + 26, x2: x * UNIT + 74, y2: y * UNIT + 74 }, 'block-cross'));
      group.append(make('line', { x1: x * UNIT + 74, y1: y * UNIT + 26, x2: x * UNIT + 26, y2: y * UNIT + 74 }, 'block-cross'));
    }
    if (live) {
      group.setAttribute('tabindex', '0');
      group.setAttribute('role', 'button');
      group.setAttribute('aria-pressed', String(shut.has(cell)));
      if (view.label) group.setAttribute('aria-label', view.label(cell));
    }
    svg.append(group);
  }
  if (ghost) {
    for (const cell of ghost) svg.append(make('rect', { x: (cell % w) * UNIT + 6, y: Math.floor(cell / w) * UNIT + 6, width: UNIT - 12, height: UNIT - 12, rx: 8 }, 'block-ghost-fill'));
    svg.append(...outline(w, ghost, 'block-ghost'));
  }
  spots.forEach((spot, index) => {
    for (const cell of spot) svg.append(make('rect', { x: (cell % w) * UNIT + 3, y: Math.floor(cell / w) * UNIT + 3, width: UNIT - 6, height: UNIT - 6 }, `block-spot-fill tint-${index % 4}`));
    svg.append(...outline(w, spot, 'block-spot'));
  });

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
 * 조각 하나의 모양을 작게 그린다(답하는 칸과 직접 만들기의 조각 고르기).
 * @param {HTMLElement} root
 * @param {number[][]} shape 조각이 차지하는 칸의 (가로, 세로)들
 * @param {string} more 더 붙일 이름표(작게 그릴 때 'mini')
 */
export function drawPiece(root, shape, more = '') {
  const w = Math.max(...shape.map((cell) => cell[0])) + 1;
  const h = Math.max(...shape.map((cell) => cell[1])) + 1;
  const cells = shape.map(([x, y]) => y * w + x);
  const svg = make('svg', { viewBox: `${-EDGE} ${-EDGE} ${w * UNIT + 2 * EDGE} ${h * UNIT + 2 * EDGE}`, 'aria-hidden': 'true' }, 'block-svg');
  for (const cell of cells) svg.append(make('rect', { x: (cell % w) * UNIT, y: Math.floor(cell / w) * UNIT, width: UNIT, height: UNIT }, 'block-piece-cell'));
  svg.append(...outline(w, cells, 'block-piece'));
  root.className = more ? `block-piece-picture ${more}` : 'block-piece-picture';
  root.style.setProperty('--w', String(w));
  root.style.setProperty('--h', String(h));
  root.replaceChildren(svg);
}

/** 판 하나를 담은 새 조각을 만든다(풀이와 "왜 그럴까?"의 그림). 아래에 한 줄 글을 붙일 수 있다. */
export function boardCard(view, note, { big = false } = {}) {
  const card = el('div', big ? 'block-card big' : 'block-card');
  const picture = el('div');
  card.append(picture);
  drawBoard(picture, { ...view, small: true });
  if (note) card.append(el('p', 'strip-note', note));
  return card;
}
