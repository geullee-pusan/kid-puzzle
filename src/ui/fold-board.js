// 접히는 모양 가리기의 판을 그린다: 펼친 모양(입체 틀로 접는다), 여러 모양의 카드, 쌓은 주사위, 칸을 눌러 모양을 만드는 모눈,
// 그리고 작은 그림(처음 화면, 판 고르기, 공책, 찾은 모양의 줄)은 납작한 그림(svg)으로 그린다.
// 글자는 받지 않는다(읽어 주는 이름과 칸의 차례 수만 받는다). 색만으로 알리지 않는다: 겹치는 칸은 빗금, 표시한 칸은 굵은 점선 테두리,
// 고른 칸은 굵은 실선 테두리, 안 보이던 주사위 면은 굵은 고리, 고른 카드는 굵은 테두리와 둥근 표시.
import { FRONT, TOP, cellKey, foldNet } from '../core/fold.js';
import { drawSolidDice, drawSolidNet } from './solid.js';

const NS = 'http://www.w3.org/2000/svg';
const UNIT = 100; // 납작한 그림에서 칸 하나의 크기
const TAP_PX = 10;

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

// ---- 그림과 주사위 눈 ----

/** 그림 하나(가운데가 (0, 0)이고 지름이 70쯤인 모양) */
function shapeOf(name) {
  if (name === 'circle') return make('circle', { cx: 0, cy: 0, r: 32 });
  if (name === 'triangle') return make('polygon', { points: '0,-34 34,28 -34,28' });
  if (name === 'square') return make('rect', { x: -29, y: -29, width: 58, height: 58, rx: 4 });
  if (name === 'diamond') return make('polygon', { points: '0,-36 30,0 0,36 -30,0' });
  if (name === 'heart') return make('path', { d: 'M0,30 C-40,2 -34,-30 -12,-30 C-4,-30 0,-22 0,-16 C0,-22 4,-30 12,-30 C34,-30 40,2 0,30 Z' });
  return make('path', { d: 'M8,-32 A32,32 0 1,0 8,32 A24,32 0 1,1 8,-32 Z' });
}

/** 면 위에 그림 하나를 그린다(입체 틀의 면에 넣는 작은 svg) */
export function paintPicture(skin, name) {
  const svg = make('svg', { viewBox: '-50 -50 100 100', 'aria-hidden': 'true' }, 'fd-pic');
  svg.append(shapeOf(name));
  svg.firstChild.setAttribute('class', `fd-shape pic-${name}`);
  skin.append(svg);
}

/** 주사위 눈의 자리(3×3 가운데 몇째 칸에 점을 찍는가) */
const PIPS = { 1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

function pipNodes(value, size = UNIT) {
  return PIPS[value].map((spot) => make('circle', { cx: ((spot % 3) + 0.5) * (size / 3), cy: (Math.floor(spot / 3) + 0.5) * (size / 3), r: size * 0.09 }, 'fd-pip'));
}

/** 주사위 면에 눈을 그린다 */
export function paintPips(skin, value) {
  const svg = make('svg', { viewBox: `0 0 ${UNIT} ${UNIT}`, 'aria-hidden': 'true' }, 'fd-pic');
  svg.append(...pipNodes(value));
  skin.append(svg);
}

// ---- 펼친 모양(입체) ----

/**
 * 판의 펼친 모양을 입체 틀로 그린다.
 * view: { cells, folded, pictures(칸마다의 그림 이름, 없으면 민 칸), classes(at), labels(at), onFace, onSpin, live, small, label, animate }
 */
export function drawNet(root, view) {
  let box = root.firstElementChild;
  if (!box || !box.classList.contains('fd-net')) box = holder(root, 'fd-net');
  box.classList.toggle('small', Boolean(view.small));
  const tree = foldNet(view.cells);
  const pictures = view.pictures ?? null;
  drawSolidNet(box, {
    ...view,
    tree,
    paintKey: pictures ? pictures.join() : '',
    paint: pictures ? (skin, at) => paintPicture(skin, pictures[at]) : null,
  });
}

/** 쌓은 주사위. view: { dice, apart, hidden([주사위, 자리]들), live, onSpin, small, label } */
export function drawDice(root, view) {
  let box = root.firstElementChild;
  if (!box || !box.classList.contains('fd-dice')) box = holder(root, 'fd-dice');
  box.classList.toggle('small', Boolean(view.small));
  const hidden = new Set((view.hidden ?? []).map(([at, face]) => `${at}:${face}`));
  drawSolidDice(box, {
    ...view,
    paint: paintPips,
    classes: (at, face) => (view.apart && hidden.has(`${at}:${face}`) ? 'fd-hidden' : ''),
  });
}

/** 여러 모양의 카드. view: { shapes, marks(고른 차례들), folded, nets(접은 뒤 모양마다 되는가), clashes(모양마다 겹치는 칸들), onCard, cardLabel(at), notes(at) } */
export function drawCards(root, view) {
  let box = root.firstElementChild;
  const key = JSON.stringify(view.shapes);
  if (!box || !box.classList.contains('fd-cards') || box.dataset.key !== key) {
    box = holder(root, 'fd-cards');
    box.dataset.key = key;
    view.shapes.forEach((cells, at) => {
      const card = document.createElement('div');
      card.className = 'fd-card-pick';
      card.dataset.card = String(at);
      card.append(document.createElement('div'));
      box.append(card);
      card.addEventListener('click', () => box.onCard?.(at));
      card.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        box.onCard?.(at);
      });
    });
  }
  box.onCard = view.folded ? null : view.onCard;
  box.style.setProperty('--n', String(view.shapes.length));
  [...box.children].forEach((card, at) => {
    const picked = view.marks.includes(at);
    card.classList.toggle('picked', picked);
    card.classList.toggle('done', Boolean(view.folded));
    card.classList.toggle('yes', Boolean(view.folded && view.nets?.[at]));
    card.classList.toggle('no', Boolean(view.folded && !view.nets?.[at]));
    card.setAttribute('role', 'button');
    card.setAttribute('aria-pressed', String(picked));
    card.tabIndex = view.folded ? -1 : 0;
    if (view.cardLabel) card.setAttribute('aria-label', view.cardLabel(at));
    const clash = new Set((view.clashes?.[at] ?? []).flat());
    drawNet(card.firstElementChild, {
      cells: view.shapes[at],
      folded: view.folded,
      live: Boolean(view.folded),
      small: true,
      classes: (cell) => (view.folded && clash.has(cell) ? 'fd-clash' : 'fd-plain'),
      tilt: [-26, 36],
      onSpin: view.onSpin,
    });
    let note = card.querySelector('.fd-card-note');
    const text = view.notes ? view.notes(at) : '';
    if (text && !note) {
      note = document.createElement('p');
      note.className = 'fd-card-note';
      card.append(note);
    }
    if (note) note.textContent = text;
  });
}

// ---- 모눈(칸을 눌러 모양을 만든다) ----

/**
 * 모눈. view: { w, h, cells(놓은 칸), fixed(미리 놓인 칸), onCell(x, y), cellLabel(x, y, on, fixed), label, small }
 * 누르고 조금 끌어도 누른 것으로 본다. 누른 칸 위에서 떼야 한다.
 */
export function drawGrid(root, view) {
  let box = root.firstElementChild;
  if (!box || !box.classList.contains('fd-grid')) {
    box = holder(root, 'fd-grid');
    const svg = make('svg', { preserveAspectRatio: 'xMidYMid meet' }, 'fd-grid-svg');
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
  box.classList.toggle('small', Boolean(view.small));
  box.classList.toggle('live', Boolean(view.onCell));
  const svg = box.firstElementChild;
  const edge = 8;
  svg.setAttribute('viewBox', `${-edge} ${-edge} ${view.w * UNIT + edge * 2} ${view.h * UNIT + edge * 2}`);
  svg.style.setProperty('--w', String(view.w));
  svg.style.setProperty('--h', String(view.h));
  if (view.label) svg.setAttribute('aria-label', view.label);
  const on = new Set(view.cells.map(cellKey));
  const fixed = new Set((view.fixed ?? []).map(cellKey));
  const nodes = [];
  for (let y = 0; y < view.h; y++) {
    for (let x = 0; x < view.w; x++) {
      const key = cellKey([x, y]);
      const state = fixed.has(key) ? 'fixed' : on.has(key) ? 'on' : 'off';
      const group = make('g', { 'data-x': x, 'data-y': y }, `fd-cell ${state}`);
      group.append(make('rect', { x: x * UNIT + 4, y: y * UNIT + 4, width: UNIT - 8, height: UNIT - 8, rx: 10 }));
      if (state === 'fixed') group.append(make('circle', { cx: (x + 0.5) * UNIT, cy: (y + 0.5) * UNIT, r: 9 }, 'fd-lock'));
      if (view.onCell && state !== 'fixed') {
        group.setAttribute('tabindex', '0');
        group.setAttribute('role', 'button');
      }
      if (view.cellLabel) group.setAttribute('aria-label', view.cellLabel(x, y, state === 'on', state === 'fixed'));
      nodes.push(group);
    }
  }
  svg.replaceChildren(...nodes);
}

// ---- 작은 그림(납작하게) ----

/** 작은 그림은 그릴 자리에 바로 이름표를 단다(처음 화면, 판 고르기, 공책의 자리가 이름표로 크기를 정한다) */
function smallRoot(root) {
  root.className = 'fd-board small';
  root.replaceChildren();
  return root;
}

/** 납작한 펼친 모양 하나를 svg 안에 그린다(왼쪽 위가 (ox, oy)) */
function flatCells(cells, { pictures = null, mark = null, picked = null, ox = 0, oy = 0, size = UNIT } = {}) {
  const xs = cells.map((cell) => cell[0]);
  const ys = cells.map((cell) => cell[1]);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  return cells.map(([x, y], at) => {
    const group = make('g', { transform: `translate(${ox + (x - x0) * size} ${oy + (y - y0) * size}) scale(${size / UNIT})` }, `fd-flat${pictures ? ' pics' : ''}${at === mark ? ' mark' : ''}${at === picked ? ' picked' : ''}`);
    group.append(make('rect', { x: 3, y: 3, width: UNIT - 6, height: UNIT - 6, rx: 6 }));
    if (pictures) {
      const shape = shapeOf(pictures[at]);
      shape.setAttribute('class', `fd-shape pic-${pictures[at]}`);
      const holderGroup = make('g', { transform: `translate(${UNIT / 2} ${UNIT / 2}) scale(0.8)` });
      holderGroup.append(shape);
      group.append(holderGroup);
    }
    if (at === mark) group.append(make('rect', { x: 12, y: 12, width: UNIT - 24, height: UNIT - 24, rx: 8 }, 'fd-ring'));
    return group;
  });
}

const sizeOf = (cells) => ({ w: Math.max(...cells.map((cell) => cell[0])) - Math.min(...cells.map((cell) => cell[0])) + 1, h: Math.max(...cells.map((cell) => cell[1])) - Math.min(...cells.map((cell) => cell[1])) + 1 });

/** 펼친 모양 하나의 작은 그림. options: { pictures, mark, picked, label(칸 옆에 적는 수) } */
export function drawFlat(root, cells, options = {}) {
  const box = smallRoot(root);
  const { w, h } = sizeOf(cells);
  const svg = make('svg', { viewBox: `-6 -6 ${w * UNIT + 12} ${h * UNIT + 12}`, preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true' }, 'fd-svg');
  svg.style.setProperty('--w', String(w));
  svg.style.setProperty('--h', String(h));
  svg.append(...flatCells(cells, options));
  box.append(svg);
  if (options.label !== undefined) {
    const tag = document.createElement('span');
    tag.className = 'fd-shelf-no';
    tag.textContent = String(options.label);
    box.append(tag);
  }
}

/** 모양 여럿의 작은 그림(셋씩 두 줄) */
export function drawFlatMany(root, shapes, { marks = [] } = {}) {
  const box = smallRoot(root);
  const per = 3;
  const cell = 4.4 * UNIT;
  const rows = Math.ceil(shapes.length / per);
  const svg = make('svg', { viewBox: `0 0 ${per * cell} ${rows * cell * 0.8}`, preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true' }, 'fd-svg');
  shapes.forEach((cells, at) => {
    const { w, h } = sizeOf(cells);
    const size = Math.min((cell * 0.86) / w, (cell * 0.7) / h);
    const ox = (at % per) * cell + (cell - w * size) / 2;
    const oy = Math.floor(at / per) * cell * 0.8 + (cell * 0.8 - h * size) / 2;
    const group = make('g', {}, marks.includes(at) ? 'fd-flat-one picked' : 'fd-flat-one');
    group.append(...flatCells(cells, { ox, oy, size }));
    svg.append(group);
  });
  box.append(svg);
}

/** 쌓은 주사위의 작은 그림: 앞 면들과 맨 위 면(비스듬히), 오른쪽 옆은 그늘 */
export function drawFlatDice(root, dice) {
  const box = smallRoot(root);
  const d = 34;
  const count = dice.length;
  const svg = make('svg', { viewBox: `-6 ${-d - 6} ${UNIT + d + 12} ${count * UNIT + d + 12}`, preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true' }, 'fd-svg');
  svg.style.setProperty('--w', '1.5');
  svg.style.setProperty('--h', String(count + 0.4));
  dice.forEach((die, at) => {
    const y = (count - 1 - at) * UNIT;
    svg.append(make('polygon', { points: `${UNIT},${y} ${UNIT + d},${y - d} ${UNIT + d},${y + UNIT - d} ${UNIT},${y + UNIT}` }, 'fd-die-side'));
    const front = make('g', { transform: `translate(0 ${y})` }, 'fd-die-front');
    front.append(make('rect', { x: 0, y: 0, width: UNIT, height: UNIT, rx: 10 }), ...pipNodes(die[FRONT]));
    svg.append(front);
    if (at === count - 1) {
      const top = make('g', { transform: `matrix(1 0 ${-d / UNIT} ${d / UNIT} ${d} ${y - d})` }, 'fd-die-top');
      top.append(make('rect', { x: 0, y: 0, width: UNIT, height: UNIT, rx: 10 }), ...pipNodes(die[TOP]));
      svg.append(top);
    }
  });
  box.append(svg);
}

/** 빈 모눈의 작은 그림(놓인 칸과 놓은 칸까지) */
export function drawFlatGrid(root, { w, h, cells = [], fixed = [] }) {
  const box = smallRoot(root);
  const svg = make('svg', { viewBox: `-6 -6 ${w * UNIT + 12} ${h * UNIT + 12}`, preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true' }, 'fd-svg');
  svg.style.setProperty('--w', String(w));
  svg.style.setProperty('--h', String(h));
  const on = new Set(cells.map(cellKey));
  const lock = new Set(fixed.map(cellKey));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const state = lock.has(cellKey([x, y])) ? 'fixed' : on.has(cellKey([x, y])) ? 'on' : 'off';
      svg.append(make('rect', { x: x * UNIT + 4, y: y * UNIT + 4, width: UNIT - 8, height: UNIT - 8, rx: 10 }, `fd-mini ${state}`));
    }
  }
  box.append(svg);
}

/** 풀이와 "왜 그럴까?"의 그림 카드 하나(입체는 끌어 돌릴 수 있다) */
export function foldCard(paint, note, { big = false } = {}) {
  const card = document.createElement('div');
  card.className = big ? 'fd-card big' : 'fd-card';
  const picture = document.createElement('div');
  picture.className = 'fd-card-picture';
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
