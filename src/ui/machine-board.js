// 규칙 기계와 규칙이 깨지는 판을 그린다: 기계 그림(넣는 곳, 블록, 나오는 곳), 칸의 줄, 넣은 수와 나온 수의 표,
// 맞힐 칸, 원 위의 점과 선과 조각, 차림표의 표와 칸들.
// 누를 수 있는 판과 보기만 하는 그림을 같은 모양으로 그린다.
// 색만으로 알리지 않는다. 지금 채울 칸과 넣는 중인 칸은 점선 테두리, 찾은 수와 표시한 칸은 동그라미, 작아지지 않은 칸은 빗금 한 줄,
// 표시한 조각은 점 하나와 빗금 무늬, 약수가 둘뿐이 아닌 수는 두 겹 테두리로 그린다.
// 글자는 대본에서 받는다(읽어 줄 이름, 표의 머리, 칸의 번호 말).

const SVG = 'http://www.w3.org/2000/svg';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function svg(tag, attrs = {}) {
  const node = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

/** 여럿을 한 묶음으로 */
export function stack(className, ...children) {
  const box = el('div', className);
  box.append(...children.filter(Boolean));
  return box;
}

/**
 * 기계 그림: 넣는 곳(하나나 둘) → 블록들 → 나오는 곳.
 * @param {object} view
 *   inputs    넣는 곳에 적을 수들(빈 글자면 빈칸)
 *   chips     블록의 이름들(숨은 기계면 null)
 *   hidden    숨은 기계의 표시 글자
 *   values    블록마다 한 뒤의 수(기계 속을 볼 때) 또는 null
 *   output    나오는 곳에 적을 것
 *   label     넣는 곳, 나오는 곳의 이름 { in, out }
 *   caption   그림 위에 작게 적을 이름(보기 등) 또는 null
 *   onChip    (블록의 차례) → 블록을 누를 때(직접 만들기에서 블록 빼기). 없으면 누를 수 없다
 *   small     작은 그림인가
 */
export function machinePicture(view) {
  const box = el('div', `mc-machine${view.small ? ' small' : ''}`);
  if (view.caption) box.append(el('span', 'mc-caption', view.caption));
  const slot = (value, name, className) => {
    const item = el('div', `mc-slot ${className}`);
    if (name) item.append(el('span', 'mc-slot-name', name));
    item.append(el('strong', 'mc-slot-value', value === null || value === undefined || value === '' ? ' ' : String(value)));
    return item;
  };
  const ins = el('div', 'mc-ins');
  for (const value of view.inputs) ins.append(slot(value, view.inputs.length === 1 ? view.label?.in : null, 'in'));
  if (view.inputs.length > 1 && view.label?.in) ins.prepend(el('span', 'mc-slot-name', view.label.in));
  const body = el('div', 'mc-body');
  if (view.chips) {
    view.chips.forEach((chip, at) => {
      const live = typeof view.onChip === 'function';
      const item = el(live ? 'button' : 'span', 'mc-chip', chip);
      if (live) {
        item.type = 'button';
        item.addEventListener('click', () => view.onChip(at));
      }
      if (view.values) item.append(el('span', 'mc-chip-value', String(view.values[at])));
      body.append(item);
    });
  } else body.append(el('span', 'mc-chip hidden', view.hidden ?? '?'));
  box.append(ins, el('span', 'mc-arrow', '→'), body, el('span', 'mc-arrow', '→'), slot(view.output, view.label?.out, 'out'));
  return box;
}

/**
 * 칸의 줄.
 * @param {object} view
 *   cells    [{ value, no, state, label }] state: 'given' | 'done' | 'active' | 'blank' | 'fall' | 'stop' | 'marked'
 *   small    작은 그림인가
 *   numbers  칸 위에 번호를 적는가
 *   onTap    (칸의 차례) → 누를 때(없으면 누를 수 없다)
 */
export function cellRow(view) {
  const live = typeof view.onTap === 'function';
  const row = el('div', `mc-row${view.small ? ' small' : ''}${view.cells.length > 12 ? ' many' : ''}`);
  view.cells.forEach((cell, at) => {
    const box = el(live && cell.tappable !== false ? 'button' : 'span', `mc-cell ${cell.state ?? ''}`);
    if (box.tagName === 'BUTTON') {
      box.type = 'button';
      box.addEventListener('click', () => view.onTap(at));
    }
    if (cell.label) box.setAttribute('aria-label', cell.label);
    if (cell.marked) box.classList.add('marked');
    if (view.numbers) box.append(el('span', 'mc-no', String(cell.no)));
    box.append(el('span', 'mc-value', cell.value === null || cell.value === undefined || cell.value === '' ? ' ' : String(cell.value)));
    row.append(box);
  });
  return row;
}

/** 맞힐 칸: 이름과 수(아직이면 물음표나 넣는 중인 글자) */
export function targetCard({ title, value, live = false, small = false }) {
  const card = el('div', `mc-target${live ? ' live' : ''}${small ? ' small' : ''}`);
  card.append(el('span', 'mc-target-title', title), el('strong', 'mc-target-value', value === null || value === undefined || value === '' ? '?' : String(value)));
  return card;
}

/**
 * 표: 머리 줄과 줄들.
 * @param {object} view
 *   head    머리 글자들
 *   rows    [{ cells: [글자…], state, label }] state: 'shown' | 'hit' | 'ask' | 'picked' | 'right' | 'broken'
 *   onTap   (줄의 차례) → 누를 때. 누를 수 있는 줄은 tappable이 참인 줄이다
 *   small   작은 그림인가
 */
export function table(view) {
  const box = el('div', `mc-table${view.small ? ' small' : ''}`);
  const head = el('div', 'mc-tr head');
  for (const text of view.head) head.append(el('span', 'mc-td', text));
  box.append(head);
  view.rows.forEach((row, at) => {
    const live = typeof view.onTap === 'function' && row.tappable;
    const line = el(live ? 'button' : 'div', `mc-tr ${row.state ?? ''}`);
    if (live) {
      line.type = 'button';
      line.addEventListener('click', () => view.onTap(at));
    }
    if (row.label) line.setAttribute('aria-label', row.label);
    for (const text of row.cells) line.append(el('span', 'mc-td', text === null || text === undefined ? '' : String(text)));
    box.append(line);
  });
  return box;
}

/** 넣어 본 수와 나온 수의 짝들(넣은 차례대로). 나와야 할 수가 나온 짝은 동그라미 */
export function tryList({ items }) {
  const list = el('div', 'mc-tries');
  for (const item of items) {
    const chip = el('span', `mc-try${item.hit ? ' hit' : ''}`);
    chip.append(el('span', 'mc-try-in', String(item.input)), el('span', 'mc-try-arrow', '→'), el('span', 'mc-try-out', String(item.output)));
    list.append(chip);
  }
  return list;
}

/** 찾은 수들: 동그라미 친 수의 줄. 없으면 빈 줄 */
export function chips({ title, values, small = false }) {
  const box = el('div', `mc-found${small ? ' small' : ''}`);
  box.append(el('span', 'mc-found-title', title));
  const list = el('span', 'mc-found-list');
  for (const value of values) list.append(el('span', 'mc-found-n', String(value)));
  box.append(list);
  return box;
}

const fmt = (value) => Number(value.toFixed(4));

/**
 * 원 위의 점과 모든 선, 조각들.
 * @param {object} view
 *   points   점의 자리(반지름 1인 원)
 *   chords   선(점 번호의 짝)
 *   regions  조각들 [{ key, path, center }] 또는 null(조각을 그리지 않는다)
 *   marked   표시한 조각의 key들
 *   fresh    방금 누른 조각의 key
 *   strong   굵게 그릴 선의 차례(그림에서) 또는 -1
 *   dots     작은 동그라미를 그릴 자리들(그림에서)
 *   label    (조각) → 읽어 줄 이름. onTap이 있으면 누를 수 있다
 *   onTap    (key) → 누를 때
 *   small    작은 그림인가
 */
export function circleFigure(view) {
  const live = typeof view.onTap === 'function';
  const pad = 0.12;
  const root = svg('svg', { viewBox: `${-1 - pad} ${-1 - pad} ${2 + 2 * pad} ${2 + 2 * pad}`, class: `mc-circle${view.small ? ' small' : ''}${live ? ' live' : ''}` });
  root.append(svg('circle', { cx: 0, cy: 0, r: 1, class: 'mc-disk' }));
  const marked = new Set(view.marked ?? []);
  for (const region of view.regions ?? []) {
    const d = `M${region.path.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join('L')}Z`;
    const piece = svg('path', { d, class: `mc-piece${marked.has(region.key) ? ' marked' : ''}${view.fresh === region.key ? ' fresh' : ''}` });
    if (live) {
      piece.setAttribute('role', 'button');
      piece.setAttribute('tabindex', '0');
      piece.setAttribute('aria-pressed', String(marked.has(region.key)));
      piece.setAttribute('aria-label', view.label(region));
      piece.addEventListener('click', () => view.onTap(region.key));
      piece.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          view.onTap(region.key);
        }
      });
    }
    root.append(piece);
  }
  view.chords.forEach(([a, b], at) => {
    const [x1, y1] = view.points[a];
    const [x2, y2] = view.points[b];
    root.append(svg('line', { x1: fmt(x1), y1: fmt(y1), x2: fmt(x2), y2: fmt(y2), class: `mc-chord${view.strong === at ? ' strong' : ''}` }));
  });
  // 표시한 조각에는 점 하나(색만으로 알리지 않는다)
  for (const region of view.regions ?? []) {
    if (marked.has(region.key)) root.append(svg('circle', { cx: fmt(region.center[0]), cy: fmt(region.center[1]), r: view.small ? 0.05 : 0.035, class: 'mc-mark' }));
  }
  for (const [x, y] of view.dots ?? []) root.append(svg('circle', { cx: fmt(x), cy: fmt(y), r: 0.05, class: 'mc-cross' }));
  for (const [x, y] of view.points) root.append(svg('circle', { cx: fmt(x), cy: fmt(y), r: view.small ? 0.07 : 0.045, class: 'mc-point' }));
  return root;
}

/**
 * 차림표를 컴퓨터가 넣어 본 칸들: 칸마다 넣은 수와 나온 수. 약수가 둘뿐이 아닌 칸은 누르면 두 겹 테두리.
 * @param {object} view
 *   items   [{ n, value, broken, found, label }]
 *   onTap   (차례) → 누를 때
 *   small   작은 그림인가
 */
export function runGrid(view) {
  const live = typeof view.onTap === 'function';
  const grid = el('div', `mc-grid${view.small ? ' small' : ''}`);
  view.items.forEach((item, at) => {
    const cell = el(live ? 'button' : 'span', `mc-gcell${item.found ? ' found' : ''}${item.checked ? ' checked' : ''}`);
    if (live) {
      cell.type = 'button';
      cell.addEventListener('click', () => view.onTap(at));
    }
    if (item.label) cell.setAttribute('aria-label', item.label);
    cell.append(el('span', 'mc-gin', String(item.n)), el('span', 'mc-gout', String(item.value)));
    grid.append(cell);
  });
  return grid;
}

/** 이름과 큰 수 하나(점 n개의 조각 수, 지금까지 가장 긴 줄 등) */
export function countBox(label, value) {
  const box = el('div', 'mc-count');
  box.append(el('span', 'mc-count-label', label), el('strong', 'mc-count-value', String(value)));
  return box;
}

/** 풀이와 "왜 그럴까?"의 그림 한 장: 그림과 그 아래 글 */
export function figureCard(nodes, note) {
  const card = el('div', 'mc-figure');
  card.append(...nodes);
  if (note) card.append(el('p', 'strip-note', note));
  return card;
}

/** 그림 여러 장을 한 줄로 */
export function figureRow(cards) {
  const row = el('div', 'figure-row');
  row.append(...cards);
  return row;
}
