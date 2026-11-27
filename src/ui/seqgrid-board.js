// 가로세로 수열 퍼즐의 판을 그린다: n×n 칸(적힌 수, 빈칸, 검은 칸).
// 누를 수 있는 판은 빈칸마다 단추 하나다. 빈칸을 누르면 고르고, 숫자판(형식이 맡는다)으로 수를 넣는다.
// 직접 만들기에서는 모든 칸을 누를 수 있다(수를 적거나 검은 칸으로 바꾼다).
// 보기만 하는 그림(처음 화면, 공책, 풀이, "왜 그럴까?")은 같은 모양을 SVG로 작게 그린다.
// 색만으로 알리지 않는다. 적힌 수는 회색 바탕에 굵은 글자와 왼쪽 위의 작은 점, 검은 칸은 빗금, 고른 칸은 아주 굵은 테두리와 안쪽 점선 고리,
// 그 칸의 가로줄과 세로줄은 옅은 칠이다. 숫자판으로 넣고 있는 수는 칸 아래쪽에 점선 밑줄과 함께 보인다.
// 글자는 형식(src/formats/seqgrid.js)이 대본에서 채워 건넨다. 이 파일에는 글을 적지 않는다.

const NS = 'http://www.w3.org/2000/svg';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function make(tag, attrs = {}, className = '') {
  const node = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  if (className) node.setAttribute('class', className);
  return node;
}

/**
 * 판을 그린다.
 * @param {HTMLElement} root 그릴 자리(안의 것을 모두 바꾼다)
 * @param {object} view
 *   n        판의 크기
 *   black    검은 칸의 번호들
 *   givens   칸마다 적힌 수(없으면 null)
 *   cells    칸마다 놓인 수(적힌 수도 들어 있다. 빈칸은 null)
 *   selected 고른 칸의 번호(없으면 null)
 *   typing   고른 칸에 넣으려고 누르고 있는 숫자들(글자. 없으면 '')
 *   onCell   (칸 번호) → 눌렀을 때. 없으면 칸을 누를 수 없다
 *   all      true면 적힌 칸과 검은 칸도 누를 수 있다(직접 만들기)
 *   labels   { board, cell(index) } 읽어 줄 이름
 */
export function drawGrid(root, view) {
  const { n, black, givens, cells, selected = null, typing = '', onCell, all = false, labels } = view;
  const hadFocus = root.contains(document.activeElement);
  root.className = `sg-board live${onCell ? '' : ' still'}`;
  root.style.setProperty('--n', String(n));
  const grid = el('div', 'sg-grid');
  if (labels?.board) grid.setAttribute('aria-label', labels.board);
  grid.setAttribute('role', 'group');
  const dark = new Set(black);
  const pickRow = selected === null ? -1 : Math.floor(selected / n);
  const pickCol = selected === null ? -1 : selected % n;
  for (let index = 0; index < n * n; index++) {
    const row = Math.floor(index / n);
    const col = index % n;
    const isBlack = dark.has(index);
    const isGiven = !isBlack && givens[index] !== null;
    const tappable = onCell && (all || (!isBlack && !isGiven));
    const cell = el(tappable ? 'button' : 'span', 'sg-cell');
    if (isBlack) cell.classList.add('black');
    else if (isGiven) cell.classList.add('given');
    else if (cells[index] !== null) cell.classList.add('filled');
    if (index === selected) cell.classList.add('picked');
    else if (!isBlack && (row === pickRow || col === pickCol)) cell.classList.add('cross');
    cell.style.gridRow = String(row + 1);
    cell.style.gridColumn = String(col + 1);
    cell.dataset.cell = String(index);
    if (!isBlack) cell.append(el('span', 'sg-number', cells[index] === null ? '' : String(cells[index])));
    if (index === selected && typing) cell.append(el('span', 'sg-typing', typing));
    if (labels?.cell) cell.setAttribute('aria-label', labels.cell(index));
    if (tappable) {
      cell.type = 'button';
      cell.addEventListener('click', () => onCell(index));
    }
    grid.append(cell);
  }
  root.replaceChildren(grid);
  // 수를 넣으면 판을 새로 그린다. 글자판으로 하던 손을 고른 칸에 그대로 둔다
  if (hadFocus && selected !== null) root.querySelector(`[data-cell="${selected}"]`)?.focus?.();
}

/**
 * 작은 그림(SVG): 칸과 수. 표시할 줄(mark)은 옅게 칠한다.
 * @param {object} view
 *   n, black, givens, cells(없으면 적힌 수만)
 *   mark   { rows: number[], cols: number[] } 옅게 칠할 줄
 *   ring   굵은 점선 고리를 두를 칸의 번호들
 *   order  { 칸 번호: 차례 } 칸 왼쪽 위에 작게 적는 차례(풀이)
 */
export function gridSvg(view) {
  const { n, black = [], givens, mark = { rows: [], cols: [] }, ring = [], order = {} } = view;
  const cells = view.cells ?? givens;
  const S = 40;
  const size = n * S;
  const svg = make('svg', { viewBox: `-3 -3 ${size + 6} ${size + 6}`, 'aria-hidden': 'true' }, 'sg-svg');
  const dark = new Set(black);
  // 흰 바탕, 적힌 칸의 회색, 그 위에 표시할 줄의 옅은 칠(비치게), 검은 칸과 빗금, 맨 위에 칸의 테두리와 수
  svg.append(make('rect', { x: 0, y: 0, width: size, height: size }, 'sg-art-ground'));
  const xy = (index) => [(index % n) * S, Math.floor(index / n) * S];
  for (let index = 0; index < n * n; index++) {
    const [x, y] = xy(index);
    if (!dark.has(index) && givens[index] !== null) svg.append(make('rect', { x, y, width: S, height: S }, 'sg-art-given'));
  }
  for (const row of mark.rows ?? []) svg.append(make('rect', { x: 0, y: row * S, width: size, height: S }, 'sg-art-mark'));
  for (const col of mark.cols ?? []) svg.append(make('rect', { x: col * S, y: 0, width: S, height: size }, 'sg-art-mark'));
  for (let index = 0; index < n * n; index++) {
    const [x, y] = xy(index);
    if (dark.has(index)) {
      svg.append(make('rect', { x, y, width: S, height: S }, 'sg-art-black'));
      // 빗금: 색만으로 알리지 않는다
      for (const shift of [10, 20, 30]) svg.append(make('line', { x1: x + shift, y1: y, x2: x, y2: y + shift }, 'sg-art-hatch'));
      for (const shift of [10, 20, 30]) svg.append(make('line', { x1: x + S, y1: y + shift, x2: x + shift, y2: y + S }, 'sg-art-hatch'));
    }
    svg.append(make('rect', { x, y, width: S, height: S }, 'sg-art-cell'));
    if (!dark.has(index) && cells[index] !== null) {
      const given = givens[index] !== null;
      const text = make('text', { x: x + S / 2, y: y + S / 2 + 1, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': cells[index] >= 10 ? 19 : 22 }, given ? 'sg-art-number given' : 'sg-art-number');
      text.textContent = String(cells[index]);
      svg.append(text);
    }
    if (order[index] !== undefined) {
      const step = make('text', { x: x + 4, y: y + 11, 'font-size': 10 }, 'sg-art-order');
      step.textContent = String(order[index]);
      svg.append(step);
    }
    if (ring.includes(index)) svg.append(make('rect', { x: x + 3, y: y + 3, width: S - 6, height: S - 6, rx: 6 }, 'sg-art-ring'));
  }
  return svg;
}

/** 작은 그림을 그린다(처음 화면, 공책, 판 고르기) */
export function drawMini(root, view) {
  root.className = 'sg-board small';
  root.style.removeProperty('--n');
  root.replaceChildren(gridSvg(view));
}

/**
 * 그림 카드: 작은 판 하나와 그 아래 한 줄
 * @param {object} view gridSvg의 값
 * @param {string} note
 * @param {{big?: boolean}} options big: 종이에 그림이 하나뿐일 때(풀이) 크게 그린다
 */
export function gridCard(view, note = '', { big = false } = {}) {
  const box = el('div', big ? 'sg-card big' : 'sg-card');
  box.append(gridSvg(view));
  if (note) box.append(el('p', 'strip-note', note));
  return box;
}

/**
 * 표("왜 그럴까?"): 머리 줄과 줄마다의 칸들
 * @param {string[]} head
 * @param {string[][]} rows
 */
export function optionTable(head, rows) {
  const table = el('table', 'sg-table');
  const top = el('tr');
  for (const text of head) top.append(el('th', '', text));
  table.append(top);
  for (const [first, ...rest] of rows) {
    const line = el('tr');
    line.append(el('th', '', first));
    for (const text of rest) line.append(el('td', '', text));
    table.append(line);
  }
  return table;
}
