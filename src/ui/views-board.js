// 세 방향에서 본 그림의 판을 그린다: 쌓기나무(입체 틀 src/ui/solid.js로 그리고 끌면 돌아간다), 쌓는 모눈(위에서 본 판에 칸마다 쌓은 수),
// 앞·옆·위에서 본 그림(정사각형 칸), 고르는 보기, 작은 그림(처음 화면, 판 고르기, 공책, 하던 판 띠는 비스듬히 본 납작한 그림).
// 글자는 받지 않는다(읽어 주는 이름과 칸의 수만 받는다). 색만으로 알리지 않는다: 쌓기나무의 면은 방향마다 밝기가 다르고 늘 테두리가 있다.
// 그림의 칸은 채운 칸이 굵은 테두리, 빈 자리는 옅은 점선이다. 짚은 줄은 굵은 점선 고리, 골라 본 보기는 빗금과 점선 테두리다.
import { drawSolidStack } from './solid.js';

const NS = 'http://www.w3.org/2000/svg';
const UNIT = 100; // 그림에서 칸 하나의 크기

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

// ---- 쌓기나무(입체) ----

/**
 * 쌓기나무를 입체 틀로 그린다.
 * view: { w, d, heights, levels, turn, live, onSpin, label, small, front(바닥 앞에 적는 글자) }
 */
export function drawStack(root, view) {
  let box = root.firstElementChild;
  if (!box || !box.classList.contains('vw-stage')) {
    box = el('div', 'vw-stage');
    root.replaceChildren(box);
  }
  box.classList.toggle('small', Boolean(view.small));
  drawSolidStack(box, {
    ...view,
    paintFloor: view.front ? (plate) => plate.append(el('span', 'vw-front-tag', view.front)) : null,
  });
}

// ---- 그림(앞, 옆, 위) ----

/**
 * 한 방향에서 본 그림 하나(svg).
 *   kind    'front' | 'side'(값은 줄마다의 높이) | 'top'(값은 칸마다 1이나 0. 앞 줄이 맨 아래)
 *   values  그림의 값
 *   w, d    위의 그림의 가로, 앞뒤 칸 수
 *   rows    앞·옆 그림의 높이 칸 수(정하지 않으면 가장 높은 것)
 *   numbers 위의 그림의 칸마다 적는 수(있으면)
 *   mark    짚을 줄: 앞·옆 그림은 { at }, 위의 그림은 { axis: 'front'(세로줄) | 'side'(가로줄), at }
 *   unknown 아직 모르는 그림(물음표 대신 빈 점선 칸만)
 */
export function viewSvg({ kind, values, w = 0, d = 0, rows = null, numbers = null, mark = null, unknown = false }) {
  const top = kind === 'top';
  const cols = top ? w : values.length;
  const tall = top ? d : Math.max(1, rows ?? Math.max(1, ...values));
  const edge = 10;
  const svg = make('svg', { viewBox: `${-edge} ${-edge} ${cols * UNIT + edge * 2} ${tall * UNIT + edge * 2}`, preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true' }, `vw-view vw-${kind}`);
  svg.style.setProperty('--cols', String(cols));
  svg.style.setProperty('--tall', String(tall));
  for (let row = 0; row < tall; row++) {
    for (let col = 0; col < cols; col++) {
      let on;
      let number = null;
      if (top) {
        // 위의 그림은 앞 줄(y가 0)이 맨 아래에 온다
        const at = (tall - 1 - row) * w + col;
        on = !unknown && values[at] > 0;
        if (numbers && numbers[at] > 0) number = numbers[at];
      } else on = !unknown && values[col] > tall - 1 - row;
      const box = make('rect', { x: col * UNIT + 4, y: row * UNIT + 4, width: UNIT - 8, height: UNIT - 8, rx: 6 }, on ? 'vw-on' : 'vw-off');
      svg.append(box);
      if (number !== null) {
        const text = make('text', { x: (col + 0.5) * UNIT, y: (row + 0.5) * UNIT, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, 'vw-number');
        text.textContent = String(number);
        svg.append(text);
      }
    }
  }
  // 앞·옆 그림의 바닥 줄
  if (!top) svg.append(make('line', { x1: -edge / 2, y1: tall * UNIT + 3, x2: cols * UNIT + edge / 2, y2: tall * UNIT + 3 }, 'vw-ground'));
  if (mark) {
    const column = !top || mark.axis === 'front';
    const box = column ? { x: mark.at * UNIT, y: 0, width: UNIT, height: tall * UNIT } : { x: 0, y: (tall - 1 - mark.at) * UNIT, width: cols * UNIT, height: UNIT };
    svg.append(make('rect', { x: box.x - 2, y: box.y - 2, width: box.width + 4, height: box.height + 4, rx: 10 }, 'vw-mark'));
  }
  return svg;
}

/** 그릴 자리 하나에 그림 하나를 그린다 */
export function drawView(root, picture) {
  root.replaceChildren(viewSvg(picture));
}

// ---- 보기(고르기) ----

/**
 * 보기 단추들. view: { pictures(보기마다 viewSvg에 건넬 값), tried(골라 본 차례들), answer(끝난 판의 맞는 차례, 아니면 null), onPick(at), labels(at) }
 * 골라 본 보기는 다시 누를 수 없다(빗금과 점선 테두리). 끝난 판에서는 맞는 보기가 굵은 테두리다.
 */
export function drawOptions(root, view) {
  const buttons = view.pictures.map((picture, at) => {
    const button = el('button', 'vw-option');
    button.type = 'button';
    const tried = view.tried.includes(at);
    button.classList.toggle('tried', tried);
    button.classList.toggle('answer', view.answer === at);
    button.disabled = !view.onPick || tried;
    button.setAttribute('aria-label', view.labels(at));
    button.append(viewSvg(picture));
    button.addEventListener('click', () => view.onPick?.(at));
    return button;
  });
  root.replaceChildren(...buttons);
}

// ---- 쌓는 모눈 ----

/**
 * 위에서 본 판(앞 줄이 맨 아래). 칸을 누르면 onCell(at). 칸마다 쌓은 수를 적는다.
 * view: { w, d, heights, onCell, cellLabel(at), label, front(판 아래에 적는 글자), mode('add' | 'remove') }
 * 칸은 단추라서 글자판의 Enter와 빈칸 글쇠로도 누른다.
 */
export function drawBuildGrid(root, view) {
  let box = root.firstElementChild;
  if (!box || !box.classList.contains('vw-grid-box') || box.dataset.size !== `${view.w}x${view.d}`) {
    box = el('div', 'vw-grid-box');
    box.dataset.size = `${view.w}x${view.d}`;
    const grid = el('div', 'vw-grid');
    grid.style.setProperty('--w', String(view.w));
    // 가로 네 칸 판은 칸을 조금 줄여 쌓기나무가 들어갈 자리를 넓힌다(그래도 48픽셀이다)
    grid.style.setProperty('--cell', view.w >= 4 ? '48px' : '56px');
    for (let row = view.d - 1; row >= 0; row--) {
      for (let x = 0; x < view.w; x++) {
        const at = row * view.w + x;
        const cell = el('button', 'vw-cell');
        cell.type = 'button';
        cell.dataset.at = String(at);
        grid.append(cell);
      }
    }
    grid.addEventListener('click', (event) => {
      const cell = event.target.closest?.('[data-at]');
      if (cell) box.view?.onCell?.(Number(cell.dataset.at));
    });
    const foot = el('p', 'vw-grid-front');
    box.append(grid, foot);
    root.replaceChildren(box);
  }
  box.view = view;
  box.classList.toggle('live', Boolean(view.onCell));
  box.classList.toggle('removing', view.mode === 'remove');
  box.lastElementChild.textContent = view.front ?? '';
  const grid = box.firstElementChild;
  if (view.label) grid.setAttribute('aria-label', view.label);
  for (const cell of grid.children) {
    const at = Number(cell.dataset.at);
    const value = view.heights[at];
    cell.textContent = value > 0 ? String(value) : '';
    cell.classList.toggle('on', value > 0);
    cell.disabled = !view.onCell;
    if (view.cellLabel) cell.setAttribute('aria-label', view.cellLabel(at));
  }
}

// ---- 작은 그림(납작하게) ----

/** 작은 그림은 그릴 자리에 바로 이름표를 단다(처음 화면, 판 고르기, 공책의 자리가 이름표로 크기를 정한다) */
function smallRoot(root) {
  root.className = 'vw-board small';
  root.replaceChildren();
  return root;
}

/** 비스듬히 본 쌓기나무(앞면은 정사각형, 앞뒤는 오른쪽 위로). 뒤에서 앞으로, 아래에서 위로, 왼쪽에서 오른쪽으로 덧그린다 */
export function stackSvg({ w, d, heights }) {
  const k = 0.45; // 앞뒤 한 칸이 오른쪽 위로 비켜 가는 몫
  const levels = Math.max(1, ...heights);
  const at = (x, y, z) => [(x + y * k) * UNIT, (levels - z + (d - y) * k) * UNIT];
  const width = (w + d * k) * UNIT;
  const tallness = (levels + d * k) * UNIT;
  const svg = make('svg', { viewBox: `-8 -8 ${width + 16} ${tallness + 16}`, preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true' }, 'vw-flat');
  svg.style.setProperty('--fw', String(w + d * k));
  svg.style.setProperty('--fh', String(levels + d * k));
  const poly = (points, className) => make('polygon', { points: points.map((point) => point.map((value) => value.toFixed(1)).join(',')).join(' ') }, className);
  // 바닥 모눈
  for (let y = 0; y < d; y++) for (let x = 0; x < w; x++) svg.append(poly([at(x, y, 0), at(x + 1, y, 0), at(x + 1, y + 1, 0), at(x, y + 1, 0)], 'vw-flat-floor'));
  const height = (x, y) => (x < 0 || y < 0 || x >= w || y >= d ? 0 : heights[y * w + x]);
  for (let y = d - 1; y >= 0; y--) {
    for (let z = 0; z < levels; z++) {
      for (let x = 0; x < w; x++) {
        if (z >= height(x, y)) continue;
        if (z + 1 >= height(x, y)) svg.append(poly([at(x, y, z + 1), at(x + 1, y, z + 1), at(x + 1, y + 1, z + 1), at(x, y + 1, z + 1)], 'vw-flat-top'));
        if (z >= height(x + 1, y)) svg.append(poly([at(x + 1, y, z), at(x + 1, y + 1, z), at(x + 1, y + 1, z + 1), at(x + 1, y, z + 1)], 'vw-flat-side'));
        if (z >= height(x, y - 1)) svg.append(poly([at(x, y, z), at(x + 1, y, z), at(x + 1, y, z + 1), at(x, y, z + 1)], 'vw-flat-front'));
      }
    }
  }
  return svg;
}

/** 쌓기나무 하나의 작은 그림 */
export function drawFlatStack(root, stack) {
  smallRoot(root).append(stackSvg(stack));
}

/** 그림 여럿의 작은 그림(앞, 옆, 위를 나란히) */
export function drawFlatViews(root, pictures) {
  const box = smallRoot(root);
  const row = el('span', 'vw-flat-views');
  for (const picture of pictures) row.append(viewSvg(picture));
  box.append(row);
}

/** 풀이와 "왜 그럴까?"의 그림 카드 하나(쌓기나무는 끌어 돌릴 수 있다). flat이면 그림(앞, 옆, 위) 카드라 좁다 */
export function viewsCard(paint, note, { big = false, flat = false } = {}) {
  const card = el('div', ['vw-card', big ? 'big' : '', flat ? 'flat' : ''].filter(Boolean).join(' '));
  const picture = el('div', 'vw-card-picture');
  const inner = el('div');
  picture.append(inner);
  card.append(picture);
  paint(inner);
  if (note) card.append(el('p', 'strip-note', note));
  return card;
}
