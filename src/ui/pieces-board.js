// 조각 가짓수 찾기의 판을 그린다: 칸을 눌러 조각을 만드는 모눈, 새 조각을 찾은 조각 위에 돌리거나 뒤집어 겹쳐 보이는 그림,
// 그리고 작은 그림(찾은 조각의 줄, 처음 화면, 판 고르기, 공책, 풀이, "왜 그럴까?")은 납작한 그림(svg)으로 그린다.
// 글자는 받지 않는다(읽어 주는 이름과 차례 수만 받는다). 색만으로 알리지 않는다: 놓은 칸은 굵은 테두리,
// 겹칠 자리는 굵은 점선 테두리, 가장 긴 줄은 칸 가운데의 굵은 막대, 찾지 못한 조각은 점선 테두리, 떼거나 붙이는 칸은 빗금이다.
import { ANGLES, cellKey, isFlip, normalize, rowCells } from '../core/pieces.js';

const NS = 'http://www.w3.org/2000/svg';
const UNIT = 100; // 칸 하나의 크기
const TAP_PX = 10;
/** 겹쳐 보이는 움직임 한 단계(뒤집기, 90도 돌리기)의 시간(밀리초) */
const STEP_MS = 700;

function make(tag, attrs = {}, className = '') {
  const node = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  if (className) node.setAttribute('class', className);
  return node;
}

function holder(root, className) {
  const box = document.createElement('div');
  box.className = className;
  root.replaceChildren(box);
  return box;
}

const sizeOf = (cells) => ({ w: Math.max(...cells.map((cell) => cell[0])) + 1, h: Math.max(...cells.map((cell) => cell[1])) + 1 });

// ---- 모눈(칸을 눌러 조각을 만든다) ----

/**
 * 모눈. view: { w, h, cells(놓은 칸), onCell(x, y), cellLabel(x, y, on), label }
 * 누르고 조금 끌어도 누른 것으로 본다. 누른 칸 위에서 떼야 한다.
 */
export function drawGrid(root, view) {
  let box = root.firstElementChild;
  if (!box || !box.classList.contains('pc-grid')) {
    box = holder(root, 'pc-grid');
    const svg = make('svg', { preserveAspectRatio: 'xMidYMid meet' }, 'pc-grid-svg');
    box.append(svg);
    let press = null;
    svg.addEventListener('pointerdown', (event) => {
      const cell = event.target.closest?.('[data-x]');
      if (!cell || !box.view?.onCell) return;
      press = { id: event.pointerId, x: event.clientX, y: event.clientY, cell: [Number(cell.dataset.x), Number(cell.dataset.y)] };
    });
    svg.addEventListener('pointerup', (event) => {
      if (!press || press.id !== event.pointerId) return;
      const { cell } = press;
      const far = Math.hypot(event.clientX - press.x, event.clientY - press.y);
      press = null;
      if (far <= TAP_PX * 3) box.view?.onCell?.(cell[0], cell[1]);
    });
    svg.addEventListener('pointercancel', () => {
      press = null;
    });
    svg.addEventListener('keydown', (event) => {
      const cell = event.target.closest?.('[data-x]');
      if (!cell || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault();
      box.view?.onCell?.(Number(cell.dataset.x), Number(cell.dataset.y));
    });
  }
  box.view = view;
  box.classList.toggle('live', Boolean(view.onCell));
  const svg = box.firstElementChild;
  const edge = 8;
  svg.setAttribute('viewBox', `${-edge} ${-edge} ${view.w * UNIT + edge * 2} ${view.h * UNIT + edge * 2}`);
  svg.style.setProperty('--w', String(view.w));
  svg.style.setProperty('--h', String(view.h));
  if (view.label) svg.setAttribute('aria-label', view.label);
  const on = new Set(view.cells.map(cellKey));
  const nodes = [];
  for (let y = 0; y < view.h; y++) {
    for (let x = 0; x < view.w; x++) {
      const state = on.has(cellKey([x, y])) ? 'on' : 'off';
      const group = make('g', { 'data-x': x, 'data-y': y }, `pc-cell ${state}`);
      group.append(make('rect', { x: x * UNIT + 4, y: y * UNIT + 4, width: UNIT - 8, height: UNIT - 8, rx: 10 }));
      if (view.onCell) {
        group.setAttribute('tabindex', '0');
        group.setAttribute('role', 'button');
      }
      if (view.cellLabel) group.setAttribute('aria-label', view.cellLabel(x, y, state === 'on'));
      nodes.push(group);
    }
  }
  svg.replaceChildren(...nodes);
}

// ---- 겹쳐 보기: 새 조각을 찾은 조각의 자리에 돌리거나 뒤집어 겹친다 ----

/** 칸들을 가운데가 (0, 0)이 되게 놓은 네모들 */
function centered(cells, className) {
  const { w, h } = sizeOf(cells);
  const group = make('g', {}, className);
  for (const [x, y] of cells) group.append(make('rect', { x: (x - w / 2) * UNIT + 5, y: (y - h / 2) * UNIT + 5, width: UNIT - 10, height: UNIT - 10, rx: 8 }));
  return group;
}

/**
 * 움직임의 단계들(CSS transform). 새 조각은 찾은 조각의 왼쪽(gap만큼)에서 시작한다.
 * 뒤집을 것이면 먼저 좌우로 뒤집고, 그다음 돌리고, 마지막에 찾은 조각 위로 옮겨 겹친다.
 */
export function stepsOf(turn, gap) {
  const flip = isFlip(turn) ? -1 : 1;
  const angle = ANGLES[turn];
  const at = (x, a, f) => `translate(${x}px, 0px) rotate(${a}deg) scaleX(${f})`;
  const frames = [at(-gap, 0, 1)];
  if (flip === -1) frames.push(at(-gap, 0, -1));
  if (angle !== 0) frames.push(at(-gap, angle, flip));
  frames.push(at(0, angle, flip));
  return frames;
}

/**
 * 겹쳐 보는 그림. view: { cells(새 조각), target(찾은 조각), turn(새 조각을 찾은 조각에 겹치는 움직임), label, onTap }
 * 찾은 조각의 자리는 점선 테두리로 그리고, 새 조각이 그 자리로 돌거나 뒤집혀 겹친다. 그림을 누르면 한 번 더 움직인다.
 */
export function drawCompare(root, view) {
  const key = JSON.stringify([view.cells, view.target, view.turn]);
  const before = root.firstElementChild;
  // 같은 그림을 다시 그릴 때는 그대로 둔다(움직임이 처음부터 다시 시작하지 않게)
  if (before && before.classList.contains('pc-compare') && before.dataset.key === key) {
    before.view = view;
    return;
  }
  const box = holder(root, 'pc-compare');
  box.dataset.key = key;
  box.dataset.gap = '0';
  box.view = view;
  const cells = normalize(view.cells);
  const target = normalize(view.target);
  const a = sizeOf(cells);
  const b = sizeOf(target);
  // 찾은 조각은 가운데가 (0, 0)이고, 새 조각은 그 왼쪽 한 칸 너머에서 시작한다
  const span = (Math.max(a.w, a.h, b.w, b.h) + 0.6) * UNIT;
  const gap = span;
  const svg = make('svg', { viewBox: `${-span / 2 - gap} ${-span / 2} ${span + gap} ${span}`, preserveAspectRatio: 'xMidYMid meet', role: 'img' }, 'pc-compare-svg');
  svg.style.setProperty('--w', String((span + gap) / UNIT));
  svg.style.setProperty('--h', String(span / UNIT));
  if (view.label) svg.setAttribute('aria-label', view.label);
  const moving = centered(cells, 'pc-moving');
  moving.style.transformBox = 'view-box';
  moving.style.transformOrigin = '0px 0px';
  svg.append(centered(target, 'pc-spot'), moving, centered(target, 'pc-target'));
  box.dataset.gap = String(gap);
  box.append(svg);
  box.addEventListener('click', () => {
    box.view?.onTap?.();
    playMove(moving, view.turn, gap);
  });
  playMove(moving, view.turn, gap);
}

/** 겹쳐 보는 그림을 한 번 더 움직인다(판 아래의 "한 번 더 보기") */
export function replayCompare(root) {
  const box = root.firstElementChild;
  const moving = box?.querySelector?.('.pc-moving');
  if (!box || !moving || !box.classList.contains('pc-compare')) return;
  playMove(moving, JSON.parse(box.dataset.key)[2], Number(box.dataset.gap));
}

/** 새 조각을 움직인다. 움직임을 줄이라고 한 기기에서는 바로 겹친 모습을 보인다 */
function playMove(moving, turn, gap) {
  const frames = stepsOf(turn, gap);
  const end = frames.at(-1);
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (still || typeof moving.animate !== 'function') {
    moving.style.transform = end;
    moving.classList.add('landed');
    return;
  }
  moving.classList.remove('landed');
  moving.style.transform = frames[0];
  // 처음에 잠깐 멈추었다가(단계 하나의 0.4만큼) 한 단계씩 움직인다
  const moves = frames.length - 1;
  const whole = moves + 0.4;
  const keys = [{ transform: frames[0], offset: 0 }, ...frames.map((transform, at) => ({ transform, offset: (0.4 + at) / whole, easing: 'ease-in-out' }))];
  const animation = moving.animate(keys, { duration: STEP_MS * whole, fill: 'forwards' });
  animation.onfinish = () => {
    moving.style.transform = end;
    moving.classList.add('landed');
  };
}

// ---- 작은 그림(납작하게) ----

/** 작은 그림은 그릴 자리에 바로 이름표를 단다(처음 화면, 판 고르기, 공책의 자리가 이름표로 크기를 정한다) */
function smallRoot(root) {
  root.className = 'pc-board small';
  root.replaceChildren();
  return root;
}

/** 조각 하나의 칸들(왼쪽 위가 (ox, oy)). row가 참이면 가장 긴 줄의 칸 가운데에 막대를 긋는다 */
function pieceNodes(cells, { ox = 0, oy = 0, row = false, className = 'pc-piece', added = [] } = {}) {
  const group = make('g', { transform: `translate(${ox} ${oy})` }, className);
  const extra = new Set(added.map(cellKey));
  const line = row ? rowCells(cells) : [];
  for (const [x, y] of cells) {
    group.append(make('rect', { x: x * UNIT + 4, y: y * UNIT + 4, width: UNIT - 8, height: UNIT - 8, rx: 8 }, extra.has(cellKey([x, y])) ? 'pc-added' : ''));
  }
  if (line.length > 1) {
    const [x0, y0] = line[0];
    const [x1, y1] = line.at(-1);
    group.append(make('line', { x1: (x0 + 0.5) * UNIT, y1: (y0 + 0.5) * UNIT, x2: (x1 + 0.5) * UNIT, y2: (y1 + 0.5) * UNIT }, 'pc-row'));
  }
  return group;
}

/** 조각 하나의 작은 그림. options: { label(옆에 적는 수), row, missed(찾지 못한 조각), same(방금 겹쳐 본 조각) } */
export function drawMini(root, cells, options = {}) {
  const box = smallRoot(root);
  const shape = normalize(cells);
  const { w, h } = sizeOf(shape);
  const svg = make('svg', { viewBox: `-8 -8 ${w * UNIT + 16} ${h * UNIT + 16}`, preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true' }, 'pc-svg');
  svg.style.setProperty('--w', String(w));
  svg.style.setProperty('--h', String(h));
  svg.append(pieceNodes(shape, { row: options.row }));
  box.append(svg);
  if (options.label !== undefined) {
    const tag = document.createElement('span');
    tag.className = 'pc-shelf-no';
    tag.textContent = String(options.label);
    box.append(tag);
  }
}

/** 모눈의 작은 그림(놓은 칸과 가장 긴 줄까지). 칸이 없으면 빈 모눈이다 */
export function drawMiniGrid(root, { w, h, cells = [], row = false }) {
  const box = smallRoot(root);
  const svg = make('svg', { viewBox: `-6 -6 ${w * UNIT + 12} ${h * UNIT + 12}`, preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true' }, 'pc-svg');
  svg.style.setProperty('--w', String(w));
  svg.style.setProperty('--h', String(h));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) svg.append(make('rect', { x: x * UNIT + 4, y: y * UNIT + 4, width: UNIT - 8, height: UNIT - 8, rx: 10 }, 'pc-mini'));
  }
  if (cells.length > 0) svg.append(pieceNodes(cells, { row }));
  box.append(svg);
}

/** 조각 여럿을 한 줄로 늘어놓은 작은 그림(하던 판 띠, 공책) */
export function drawStrip(root, pieces) {
  const box = smallRoot(root);
  const shapes = pieces.map(normalize);
  const gap = UNIT * 0.6;
  let x = 0;
  const groups = [];
  let height = 1;
  for (const cells of shapes) {
    const { w, h } = sizeOf(cells);
    groups.push(pieceNodes(cells, { ox: x }));
    x += w * UNIT + gap;
    height = Math.max(height, h);
  }
  const width = Math.max(UNIT, x - gap);
  const svg = make('svg', { viewBox: `-8 -8 ${width + 16} ${height * UNIT + 16}`, preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true' }, 'pc-svg');
  svg.style.setProperty('--w', String(width / UNIT));
  svg.style.setProperty('--h', String(height));
  svg.append(...groups);
  box.append(svg);
}

/** 조각들을 모두 늘어놓은 그림(풀이, 직접 만들기). missed: 찾지 못한 조각의 차례들(점선 테두리를 두른다) */
export function drawFamily(root, pieces, { missed = [], row = false } = {}) {
  const box = holder(root, 'pc-family');
  pieces.forEach((cells, at) => {
    const item = document.createElement('div');
    item.className = missed.includes(at) ? 'pc-family-item missed' : 'pc-family-item';
    const inner = document.createElement('div');
    item.append(inner);
    drawMini(inner, cells, { row });
    box.append(item);
  });
}

/** "왜 그럴까?"의 그림 하나: 줄마다 #이 칸, +가 떼거나 붙이는 칸(빗금과 점선) */
export function drawFigure(root, rows) {
  const cells = [];
  const added = [];
  rows.forEach((line, y) =>
    [...line].forEach((mark, x) => {
      if (mark === '#' || mark === '+') cells.push([x, y]);
      if (mark === '+') added.push([x, y]);
    }),
  );
  const box = smallRoot(root);
  const w = Math.max(...rows.map((line) => line.length));
  const h = rows.length;
  const svg = make('svg', { viewBox: `-8 -8 ${w * UNIT + 16} ${h * UNIT + 16}`, preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true' }, 'pc-svg');
  svg.style.setProperty('--w', String(w));
  svg.style.setProperty('--h', String(h));
  svg.append(pieceNodes(cells, { added }));
  box.append(svg);
}

/** 풀이와 "왜 그럴까?"의 그림 카드 하나 */
export function pieceCard(paint, note, { big = false } = {}) {
  const card = document.createElement('div');
  card.className = big ? 'pc-card big' : 'pc-card';
  const picture = document.createElement('div');
  picture.className = 'pc-card-picture';
  const inner = document.createElement('div');
  picture.append(inner);
  card.append(picture);
  paint(inner);
  if (note) {
    const line = document.createElement('p');
    line.className = 'strip-note';
    line.textContent = note;
    card.append(line);
  }
  return card;
}
