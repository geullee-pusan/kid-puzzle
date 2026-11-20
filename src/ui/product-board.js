// 곱 단서 퍼즐의 판을 그린다: n×n 칸과 판 밖의 단서(가로줄은 오른쪽, 세로줄은 아래쪽).
// 누를 수 있는 판은 칸마다 단추 하나다. 칸을 누르면 고르고, 숫자판(형식이 맡는다)으로 수를 넣는다.
// 단서는 "곱이 되는 두 수 보기"를 켰을 때(놀이 판)나 직접 만들기에서만 누를 수 있다.
// 보기만 하는 그림(처음 화면, 공책, 풀이, "왜 그럴까?")은 같은 모양을 SVG로 작게 그린다.
// 색만으로 알리지 않는다. 고른 칸은 굵은 테두리와 점선 고리, 그 칸의 가로줄과 세로줄은 옅은 칠이다.
// 단서의 테두리: 수가 둘보다 적은 줄은 가는 실선, 두 수의 곱이 단서와 같은 줄은 아주 굵은 실선, 다르거나 수가 셋 이상인 줄은 굵은 점선이다.
// 숨은 단서는 물음표와 점선 테두리다.
// 글자는 형식(src/formats/product.js)이 대본에서 채워 건넨다. 이 파일에는 글을 적지 않는다.

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

/** 단서 칸에 적는 글자: 숨은 단서는 물음표, 아직 없는 단서(직접 만들기에서 수가 둘이 아닌 줄)는 빈칸 */
const clueText = (clue) => (clue === null ? '?' : clue === undefined ? '' : String(clue));

/**
 * 판을 그린다.
 * @param {HTMLElement} root 그릴 자리(안의 것을 모두 바꾼다)
 * @param {object} view
 *   n        판의 크기
 *   cells    칸마다 놓인 수(빈칸은 null)
 *   rows     가로줄마다의 단서(숨은 단서는 null, 아직 없는 단서는 undefined)
 *   cols     세로줄마다의 단서
 *   states   줄마다의 모습 { row: string[], col: string[] } ('open' | 'ok' | 'off' | 'many')
 *   selected 고른 칸의 번호(없으면 null)
 *   focus    고른 단서 { kind, index }(없으면 null)
 *   veiled   직접 만들기에서 숨긴 단서 { row: boolean[], col: boolean[] }(숨겨도 판에는 물음표와 함께 옅게 보인다)
 *   onCell   (칸 번호) → 눌렀을 때. 없으면 칸을 누를 수 없다
 *   onClue   (kind, index) → 단서를 눌렀을 때. 없으면 단서를 누를 수 없다
 *   labels   { board, cell(index, value, picked), clue(kind, index) } 읽어 줄 이름
 *   keepFocus 그리기 전에 판 안의 칸에 손이 있었으면 고른 칸으로 옮긴다
 */
export function drawGrid(root, view) {
  const { n, cells, rows, cols, states, selected = null, focus = null, veiled = null, onCell, onClue, labels } = view;
  const hadFocus = root.contains(document.activeElement);
  root.className = `pd-board live${onCell ? '' : ' still'}`;
  root.style.setProperty('--n', String(n));
  const grid = el('div', 'pd-grid');
  if (labels?.board) grid.setAttribute('aria-label', labels.board);
  grid.setAttribute('role', 'group');
  const pickRow = selected === null ? -1 : Math.floor(selected / n);
  const pickCol = selected === null ? -1 : selected % n;
  const clueNode = (kind, index) => {
    const clue = kind === 'row' ? rows[index] : cols[index];
    const state = states?.[kind]?.[index] ?? 'open';
    const hidden = veiled ? veiled[kind][index] : clue === null;
    const node = onClue && clue !== undefined ? el('button', 'pd-clue') : el('span', 'pd-clue');
    node.classList.add(kind === 'row' ? 'at-row' : 'at-col', `is-${state}`);
    if (hidden) node.classList.add('hidden-clue');
    if (clue === undefined) node.classList.add('none');
    if (focus && focus.kind === kind && focus.index === index) node.classList.add('focus');
    node.append(el('span', 'pd-clue-text', hidden ? '?' : clueText(clue)));
    if (veiled && hidden && clue !== undefined) node.append(el('span', 'pd-clue-under', clueText(clue)));
    if (labels?.clue) node.setAttribute('aria-label', labels.clue(kind, index));
    if (node.tagName === 'BUTTON') {
      node.type = 'button';
      if (focus) node.setAttribute('aria-pressed', String(focus.kind === kind && focus.index === index));
      node.addEventListener('click', () => onClue(kind, index));
    }
    node.style.gridRow = String(kind === 'row' ? index + 1 : n + 1);
    node.style.gridColumn = String(kind === 'row' ? n + 1 : index + 1);
    return node;
  };
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const index = row * n + col;
      const value = cells[index];
      const cell = el(onCell ? 'button' : 'span', 'pd-cell');
      if (value !== null) cell.classList.add('filled');
      if (index === selected) cell.classList.add('picked');
      else if (row === pickRow || col === pickCol) cell.classList.add('cross');
      cell.style.gridRow = String(row + 1);
      cell.style.gridColumn = String(col + 1);
      cell.dataset.cell = String(index);
      cell.append(el('span', 'pd-number', value === null ? '' : String(value)));
      if (labels?.cell) cell.setAttribute('aria-label', labels.cell(index, value, index === selected));
      if (onCell) {
        cell.type = 'button';
        cell.addEventListener('click', () => onCell(index));
      }
      grid.append(cell);
    }
    grid.append(clueNode('row', row));
  }
  for (let col = 0; col < n; col++) grid.append(clueNode('col', col));
  root.replaceChildren(grid);
  // 수를 넣으면 판을 새로 그린다. 글자판으로 하던 손을 고른 칸에 그대로 둔다
  if (hadFocus && selected !== null) root.querySelector(`[data-cell="${selected}"]`)?.focus?.();
}

/**
 * 작은 그림(SVG): 칸과 놓인 수, 판 밖의 단서. 표시할 줄(mark)은 옅게 칠한다.
 * @param {object} view
 *   n, cells(없으면 빈 판), rows, cols(숨은 단서는 null, 없는 단서는 undefined)
 *   mark  { rows: number[], cols: number[] } 옅게 칠할 줄
 *   ring  굵은 고리를 두를 칸의 번호들
 */
export function gridSvg(view) {
  const { n, rows, cols, mark = { rows: [], cols: [] }, ring = [] } = view;
  const cells = view.cells ?? new Array(n * n).fill(null);
  const S = 40;
  const GAP = 6;
  const size = (n + 1) * S + GAP;
  const svg = make('svg', { viewBox: `-3 -3 ${size + 6} ${size + 6}`, 'aria-hidden': 'true' }, 'pd-svg');
  // 흰 바탕, 그 위에 표시할 줄의 옅은 칠, 맨 위에 칸의 테두리(칸은 속을 칠하지 않는다)
  svg.append(make('rect', { x: 0, y: 0, width: n * S, height: n * S }, 'pd-art-ground'));
  for (const row of mark.rows ?? []) svg.append(make('rect', { x: 0, y: row * S, width: n * S, height: S }, 'pd-art-mark'));
  for (const col of mark.cols ?? []) svg.append(make('rect', { x: col * S, y: 0, width: S, height: n * S }, 'pd-art-mark'));
  for (let index = 0; index < n * n; index++) {
    const x = (index % n) * S;
    const y = Math.floor(index / n) * S;
    svg.append(make('rect', { x, y, width: S, height: S }, 'pd-art-cell'));
    if (cells[index] !== null) {
      const text = make('text', { x: x + S / 2, y: y + S / 2 + 1, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 22 }, 'pd-art-number');
      text.textContent = String(cells[index]);
      svg.append(text);
    }
    if (ring.includes(index)) svg.append(make('rect', { x: x + 3, y: y + 3, width: S - 6, height: S - 6, rx: 6 }, 'pd-art-ring'));
  }
  const clue = (clueValue, x, y) => {
    const hidden = clueValue === null;
    svg.append(make('rect', { x: x + 3, y: y + 3, width: S - 6, height: S - 6, rx: 8 }, `pd-art-clue${hidden ? ' hidden-clue' : clueValue === undefined ? ' none' : ''}`));
    const text = make('text', { x: x + S / 2, y: y + S / 2 + 1, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': String(clueText(clueValue)).length > 2 ? 15 : 18 }, 'pd-art-clue-text');
    text.textContent = clueText(clueValue);
    svg.append(text);
  };
  rows.forEach((value, row) => clue(value, n * S + GAP, row * S));
  cols.forEach((value, col) => clue(value, col * S, n * S + GAP));
  return svg;
}

/** 작은 그림을 그린다(처음 화면, 공책, 판 고르기) */
export function drawMini(root, view) {
  root.className = 'pd-board small';
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
  const box = el('div', big ? 'pd-card big' : 'pd-card');
  box.append(gridSvg(view));
  if (note) box.append(el('p', 'strip-note', note));
  return box;
}

/**
 * 단서마다 곱이 되는 두 수의 표("왜 그럴까?")
 * @param {string[]} head 머리 줄
 * @param {[string, string][]} rows 단서와 두 수의 목록 글
 */
export function pairTable(head, rows) {
  const table = el('table', 'pd-table');
  const top = el('tr');
  for (const text of head) top.append(el('th', '', text));
  table.append(top);
  for (const [clue, pairs] of rows) {
    const line = el('tr');
    line.append(el('th', '', clue), el('td', '', pairs));
    table.append(line);
  }
  return table;
}
