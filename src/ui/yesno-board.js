// 질문으로 맞히기의 그림을 그린다: 수 칸들(후보, 고른 수, 빠진 수, 미리 정한 질문의 표시 줄), 반씩 나눠 보기의 띠, 두 배씩 느는 표.
// 누를 수 있는 판과 보기만 하는 그림(처음 화면, 공책, 풀이, "왜 그럴까?", 직접 만들기)을 같은 모양으로 그린다. 글자는 대본에서 받는다.
// 색만으로 알리지 않는다.
//   후보인 수: 흰 바탕에 굵은 수. 빠진 수: 회색 바탕에 빗금과 옅은 수(누를 수 없다).
//   고른 수: 굵은 금빛 점선 테두리와 들린 모습. 알아낸 수: 굵은 실선 테두리와 바탕.
//   미리 정한 질문의 표시: 수 아래에 질문마다 칸 하나(질문마다 모양이 다르다: 동그라미, 네모, 세모, 마름모, 긴 네모, 고리).
//     그 질문에 넣은 수는 칸이 채워지고, 넣지 않은 수는 빈 테두리다. 고르고 있는 질문의 칸은 아래에 밑줄이 있다.
// 누르는 것은 pointer 이벤트로 받는다. 수 칸 하나를 누르면 그 수 하나, 누른 채 끌면 지나간 수들을 한꺼번에 고르거나 뺀다
//   (처음 누른 수가 골라져 있지 않았으면 고르고, 골라져 있었으면 뺀다). 글자판으로는 칸마다 Enter와 빈칸 글쇠로 누른다.

/** 질문마다 표시 칸의 모양 */
export const SHAPES = ['dot', 'square', 'tri', 'diamond', 'bar', 'ring'];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** 한 줄의 칸 수: 8 이하는 한 줄, 9~10은 다섯, 11~12는 여섯, 그보다 많으면 여덟 */
export const colsOf = (n) => (n <= 8 ? n : n <= 10 ? 5 : n <= 12 ? 6 : 8);

const grids = new WeakMap();

/** 그릴 자리마다 누르기를 한 번만 잇는다. 끄는 동안 지나간 수를 모은다 */
function gridOf(root) {
  let grid = grids.get(root);
  if (grid) return grid;
  grid = { view: null, press: null };
  grids.set(root, grid);
  const tileAt = (event) => {
    const hit = document.elementFromPoint(event.clientX, event.clientY);
    const tile = hit?.closest?.('[data-x]');
    return tile && root.contains(tile) && !tile.classList.contains('out') ? tile : null;
  };
  const mark = () => {
    for (const tile of root.querySelectorAll('[data-x]')) {
      const touched = grid.press?.xs.includes(Number(tile.dataset.x));
      tile.classList.toggle('live-on', Boolean(touched && grid.press.add));
      tile.classList.toggle('live-off', Boolean(touched && !grid.press.add));
    }
  };
  root.addEventListener('pointerdown', (event) => {
    const view = grid.view;
    if (!view?.onPick) return;
    const tile = event.target.closest?.('[data-x]');
    if (!tile || !root.contains(tile) || tile.classList.contains('out')) return;
    event.preventDefault();
    const x = Number(tile.dataset.x);
    grid.press = { id: event.pointerId, xs: [x], add: !view.on(x) };
    mark();
    try {
      root.setPointerCapture(event.pointerId);
    } catch {
      // 붙잡지 못해도 누르는 것은 그대로 된다.
    }
  });
  root.addEventListener('pointermove', (event) => {
    const press = grid.press;
    if (!press || press.id !== event.pointerId) return;
    const tile = tileAt(event);
    if (!tile) return;
    const x = Number(tile.dataset.x);
    if (!press.xs.includes(x)) {
      press.xs.push(x);
      mark();
    }
  });
  const finish = (event, cancel) => {
    const press = grid.press;
    if (!press || press.id !== event.pointerId) return;
    grid.press = null;
    mark();
    if (!cancel && grid.view?.onPick) grid.view.onPick(press.xs.slice().sort((a, b) => a - b), press.add);
  };
  root.addEventListener('pointerup', (event) => finish(event, false));
  root.addEventListener('pointercancel', (event) => finish(event, true));
  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const tile = event.target.closest?.('[data-x]');
    const view = grid.view;
    if (!tile || !view?.onPick || tile.classList.contains('out')) return;
    event.preventDefault();
    const x = Number(tile.dataset.x);
    view.onPick([x], !view.on(x));
  });
  return grid;
}

/**
 * 수 칸들을 그린다.
 * @param {HTMLElement} root 그릴 자리(안의 것을 모두 바꾼다)
 * @param {object} view
 *   n        1부터 n까지
 *   alive    후보인 수들(없으면 모두 후보)
 *   picked   고른 수들
 *   found    알아낸 수(없으면 null)
 *   sets     미리 정한 질문들(수 아래에 표시 칸을 그린다. 없으면 그리지 않는다)
 *   active   고르고 있는 질문의 차례(표시 칸에 밑줄)
 *   bits     참이면 표시 줄 아래에 예를 1, 아니요를 0으로 마지막 질문부터 적는다("왜 그럴까?"의 마지막 장)
 *   on       (수) → 지금 골라져 있는가(누를 수 있는 판. 끌 때 고를지 뺄지를 정한다)
 *   onPick   (수들, 고르는가) → 눌렀을 때. 없으면 누를 수 없다
 *   label    (수) → 읽어 줄 이름
 *   small    작은 그림(처음 화면, 공책), mid 중간 그림(종이의 그림)
 */
export function drawTiles(root, view) {
  const { n, alive = null, picked = [], found = null, sets = null, active = null, bits = false, small = false, mid = false } = view;
  const live = Boolean(view.onPick);
  const grid = gridOf(root);
  grid.view = live ? view : null;
  const focused = root.contains(document.activeElement) ? document.activeElement.dataset?.x : undefined;
  const box = el('div', `yn-tiles${small ? ' small' : mid ? ' mid' : ''}${sets ? ' marked' : ''}`);
  box.style.setProperty('--cols', String(colsOf(n)));
  for (let x = 1; x <= n; x++) {
    const out = alive !== null && !alive.includes(x);
    const classes = ['yn-tile', out ? 'out' : '', picked.includes(x) ? 'picked' : '', found === x ? 'found' : ''].filter(Boolean).join(' ');
    const tile = el(live ? 'button' : 'span', classes);
    tile.dataset.x = String(x);
    tile.append(el('span', 'yn-num', String(x)));
    if (sets) {
      const marks = el('span', 'yn-marks');
      sets.forEach((set, at) => {
        const slot = el('span', `yn-slot ${SHAPES[at % SHAPES.length]}${set.includes(x) ? ' on' : ''}${active === at ? ' active' : ''}`);
        marks.append(slot);
      });
      tile.append(marks);
      if (bits) tile.append(el('span', 'yn-bits', sets.map((set) => (set.includes(x) ? '1' : '0')).reverse().join('')));
    }
    if (live) {
      tile.type = 'button';
      tile.disabled = out;
      tile.setAttribute('aria-pressed', String(view.on(x)));
      if (view.label) tile.setAttribute('aria-label', view.label(x));
    } else if (view.label) {
      tile.setAttribute('aria-label', view.label(x));
      tile.setAttribute('role', 'img');
    }
    box.append(tile);
  }
  root.replaceChildren(box);
  if (focused !== undefined) root.querySelector(`[data-x="${focused}"]`)?.focus();
}

/** 질문 고르기 단추에 넣는 표시 칸 하나 */
export function shapeOf(at) {
  return el('span', `yn-slot on ${SHAPES[at % SHAPES.length]}`);
}

/**
 * 반씩 나눠 보기의 띠: 지금 후보 수와, 질문마다 가장 고르게 갈라도 남을 수 있는 많은 쪽의 수.
 * @param {object} view chain(수들), labels(수마다 아래에 적는 글), name(띠 위의 글, 없어도 된다)
 */
export function drawChain(root, view) {
  const box = el('div', 'yn-chain');
  if (view.name) box.append(el('p', 'yn-chain-name', view.name));
  const row = el('div', 'yn-chain-row');
  view.chain.forEach((value, at) => {
    if (at > 0) row.append(el('span', 'yn-arrow', '›'));
    const link = el('span', `yn-link${at === view.chain.length - 1 ? ' last' : ''}${value === 1 ? ' one' : ''}`);
    link.append(el('strong', 'yn-link-n', String(value)), el('span', 'yn-link-label', view.labels[at]));
    row.append(link);
  });
  box.append(row);
  root.replaceChildren(box);
}

/** 두 배씩 느는 표: 줄마다 [질문 수, 언제나 맞히는 가장 많은 후보] */
export function drawDoubling(root, { rows, head }) {
  const table = el('table', 'yn-double');
  const tr = (cells, tag) => {
    const line = el('tr');
    for (const cell of cells) line.append(el(tag, '', String(cell)));
    return line;
  };
  table.append(tr([head[0], ...rows.map((row) => row[0])], 'th'), tr([head[1], ...rows.map((row) => row[1])], 'td'));
  root.replaceChildren(table);
}

/** 종이의 그림 하나: 그림과 아래의 글 */
export function figureCard(draw, note, { wide = false } = {}) {
  const card = el('div', `yn-figure${wide ? ' wide' : ''}`);
  const inner = el('div');
  draw(inner);
  card.append(inner, el('p', 'strip-note', note));
  return card;
}
