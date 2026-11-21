// 블랙홀의 판을 그린다: 세모꼴로 놓인 동그라미 칸들, 돌, 내 수와 선생님 수, 방금 놓은 수, 끝에 생긴 블랙홀과 빨려 들어간 수.
// 누를 수 있는 판과 보기만 하는 그림을 같은 모양으로 그린다(그림은 새로 그렸다).
// 색만으로 알리지 않는다. 내 수는 속이 찬 동그라미, 선생님 수는 점선 네모, 돌은 점이 박힌 회색 동그라미다.
// 블랙홀은 검은 동그라미와 소용돌이 고리, 빨려 들어간 수는 옅어지고 점선 고리가 둘린다(0.5초 동안 블랙홀 쪽으로 조금 끌려간다.
// 움직임을 줄이는 설정이면 움직이지 않고 끝 모습만 보인다).
// 누르는 것은 click으로 받는다(손가락으로 한 번 누르는 것). 글자판으로도 칸을 골라 누를 수 있다.

const NS = 'http://www.w3.org/2000/svg';
const UNIT = 100; // 칸 하나의 너비(동그라미 지름에 틈을 더한 것)
const RISE = UNIT * 0.866; // 줄 사이의 높이(맞닿은 동그라미)
const RADIUS = 46; // 동그라미의 반지름
const EDGE = 6; // 판 둘레에 두는 자리

const boards = new WeakMap();

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

/** 칸 번호 → [줄, 줄 안의 자리] */
function rowColOf(cell) {
  let r = 0;
  while (((r + 1) * (r + 2)) / 2 <= cell) r += 1;
  return [r, cell - (r * (r + 1)) / 2];
}

/** 칸의 가운데 자리 */
export function centerOf(rows, cell) {
  const [r, c] = rowColOf(cell);
  return [UNIT / 2 + (c + (rows - 1 - r) / 2) * UNIT, UNIT / 2 + r * RISE];
}

const sizeOf = (rows) => [rows * UNIT, UNIT + (rows - 1) * RISE];

/** 돌: 회색 동그라미에 어두운 점 셋 */
function rockShape(cx, cy) {
  const group = make('g', {}, 'bh-rock-group');
  group.append(
    make('circle', { cx, cy, r: RADIUS - 4 }, 'bh-rock'),
    make('circle', { cx: cx - 14, cy: cy - 10, r: 5 }, 'bh-rock-dot'),
    make('circle', { cx: cx + 12, cy: cy - 4, r: 4 }, 'bh-rock-dot'),
    make('circle', { cx: cx - 2, cy: cy + 15, r: 6 }, 'bh-rock-dot'),
  );
  return group;
}

/** 내 수: 속이 찬 동그라미와 흰 수 */
function kidShape(cx, cy, number) {
  const group = make('g', {}, 'bh-piece bh-kid-piece');
  const text = make('text', { x: cx, y: cy, 'dominant-baseline': 'central', 'text-anchor': 'middle' }, 'bh-number bh-kid-number');
  text.textContent = String(number);
  group.append(make('circle', { cx, cy, r: RADIUS - 6 }, 'bh-kid'), text);
  return group;
}

/** 선생님 수: 점선 네모와 파란 수 */
function teacherShape(cx, cy, number) {
  const group = make('g', {}, 'bh-piece bh-teacher-piece');
  const side = 2 * (RADIUS - 12);
  const text = make('text', { x: cx, y: cy, 'dominant-baseline': 'central', 'text-anchor': 'middle' }, 'bh-number bh-teacher-number');
  text.textContent = String(number);
  group.append(make('rect', { x: cx - side / 2, y: cy - side / 2, width: side, height: side, rx: 8 }, 'bh-teacher'), text);
  return group;
}

/** 블랙홀: 검은 동그라미와 소용돌이 고리 둘 */
function holeShape(cx, cy) {
  const group = make('g', {}, 'bh-hole-group');
  group.append(
    make('circle', { cx, cy, r: RADIUS - 2 }, 'bh-hole'),
    make('path', { d: `M ${cx - 26} ${cy} A 26 26 0 0 1 ${cx} ${cy - 26} A 20 20 0 0 1 ${cx + 18} ${cy - 4}` }, 'bh-swirl'),
    make('path', { d: `M ${cx + 26} ${cy} A 26 26 0 0 1 ${cx} ${cy + 26} A 20 20 0 0 1 ${cx - 18} ${cy + 4}` }, 'bh-swirl'),
    make('circle', { cx, cy, r: 6 }, 'bh-hole-core'),
  );
  return group;
}

/** 화면의 자리를 판의 칸 번호로 바꾼다. 어느 동그라미에도 들지 않으면 null */
function cellAt(svg, view, event) {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  const spot = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  const total = (view.rows * (view.rows + 1)) / 2;
  let best = null;
  let bestGap = Infinity;
  for (let cell = 0; cell < total; cell++) {
    const [cx, cy] = centerOf(view.rows, cell);
    const gap = Math.hypot(spot.x - cx, spot.y - cy);
    if (gap < bestGap) {
      best = cell;
      bestGap = gap;
    }
  }
  return bestGap <= UNIT / 2 ? best : null;
}

/** 그릴 자리에 판을 한 번 만들어 둔다. 안의 것만 바꿔 그린다(글자판으로 고른 칸이 그대로 남게). */
function boardOf(root) {
  let board = boards.get(root);
  if (board && board.svg.parentNode === root) return board;
  const svg = make('svg', { preserveAspectRatio: 'xMidYMid meet' });
  const layer = make('g');
  svg.append(layer);
  board = { svg, layer, view: null };
  boards.set(root, board);
  svg.addEventListener('click', (event) => {
    const view = board.view;
    if (!view?.onCell) return;
    const cell = cellAt(svg, view, event);
    if (cell !== null) view.onCell(cell);
  });
  svg.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const view = board.view;
    const target = event.target.closest?.('[data-cell]');
    if (!view?.onCell || !target) return;
    event.preventDefault();
    view.onCell(Number(target.dataset.cell));
  });
  root.replaceChildren(svg);
  return board;
}

/**
 * 판을 그린다.
 * @param {HTMLElement} root 그릴 자리(안의 것을 모두 바꾼다)
 * @param {object} view
 *   rows       줄 수
 *   rocks      돌이 놓인 칸들
 *   kid        내 수가 놓인 칸들(kid[0]에 1, kid[1]에 2, …). teacher 선생님 수가 놓인 칸들(같은 꼴)
 *   last       방금 놓은 칸(없으면 null)
 *   hole       블랙홀이 된 칸(끝나지 않았으면 null). swallowed 빨려 들어간 칸들
 *   animate    빨려 들어가는 움직임을 보인다(끝난 바로 그때만)
 *   rings      두 겹 고리로 짚는 칸들(그림)
 *   open       누를 수 있는 빈칸들(점선 고리로 보인다. 아이 차례일 때)
 *   label      (칸 번호) → 읽어 줄 이름(누를 수 있는 판에서만)
 *   onCell     (칸 번호) → 칸을 눌렀을 때. 없으면 보기만 하는 그림이다
 *   small      작은 그림으로 그린다
 */
export function drawBoard(root, view) {
  const { rows, rocks = [], kid = [], teacher = [], last = null, hole = null, swallowed = [], animate = false, rings = [], open = [], small = false } = view;
  const live = typeof view.onCell === 'function';
  root.className = `bh-board${small ? ' small' : ''}${live ? ' live' : ''}`;
  root.style.setProperty('--rows', String(rows));
  const board = boardOf(root);
  const { svg } = board;
  const focused = svg.contains(document.activeElement) ? document.activeElement.dataset.cell : undefined;
  const [width, height] = sizeOf(rows);
  svg.setAttribute('viewBox', `${-EDGE} ${-EDGE} ${width + 2 * EDGE} ${height + 2 * EDGE}`);
  svg.setAttribute('class', 'bh-svg');
  if (live) svg.removeAttribute('aria-hidden');
  else svg.setAttribute('aria-hidden', 'true');

  const rockSet = new Set(rocks);
  const gone = new Set(swallowed);
  const numberAt = new Map();
  kid.forEach((cell, index) => numberAt.set(cell, ['kid', index + 1]));
  teacher.forEach((cell, index) => numberAt.set(cell, ['teacher', index + 1]));
  const openSet = new Set(open);
  const [hx, hy] = hole === null ? [0, 0] : centerOf(rows, hole);

  const nodes = [];
  const total = (rows * (rows + 1)) / 2;
  for (let cell = 0; cell < total; cell++) {
    const [cx, cy] = centerOf(rows, cell);
    const group = make('g', { 'data-cell': cell }, 'bh-cell-group');
    group.append(make('circle', { cx, cy, r: RADIUS }, openSet.has(cell) ? 'bh-cell open' : 'bh-cell'));
    if (rockSet.has(cell)) group.append(rockShape(cx, cy));
    else if (cell === hole) group.append(holeShape(cx, cy));
    else if (numberAt.has(cell)) {
      const [side, number] = numberAt.get(cell);
      const piece = side === 'kid' ? kidShape(cx, cy, number) : teacherShape(cx, cy, number);
      if (gone.has(cell)) {
        // 빨려 들어간 수: 옅어지고 블랙홀 쪽으로 조금 끌려간 자리에 남는다
        piece.classList.add('bh-gone');
        if (animate) piece.classList.add('bh-swallow');
        piece.style.setProperty('--dx', `${(hx - cx) * 0.22}px`);
        piece.style.setProperty('--dy', `${(hy - cy) * 0.22}px`);
        group.append(piece, make('circle', { cx, cy, r: RADIUS - 2 }, 'bh-gone-ring'));
      } else group.append(piece);
    }
    if (live && view.label) {
      group.setAttribute('tabindex', '0');
      group.setAttribute('role', 'button');
      group.setAttribute('aria-label', view.label(cell));
    }
    nodes.push(group);
  }
  if (last !== null && last !== undefined) {
    const [cx, cy] = centerOf(rows, last);
    nodes.push(make('circle', { cx, cy, r: RADIUS + 2 }, 'bh-last'));
  }
  for (const cell of rings) {
    const [cx, cy] = centerOf(rows, cell);
    nodes.push(make('circle', { cx, cy, r: RADIUS + 3 }, 'bh-ring'), make('circle', { cx, cy, r: RADIUS - 8 }, 'bh-ring inner'));
  }

  board.layer.replaceChildren(...nodes);
  board.view = { ...view, rows };
  if (focused !== undefined) svg.querySelector(`[data-cell="${focused}"]`)?.focus?.();
}

/**
 * 판 하나를 담은 새 조각을 만든다(다시 보기, 풀이, "왜 그럴까?"의 그림).
 * @param {object} view drawBoard에 건네는 것
 * @param {string} note 아래에 붙이는 글
 * @param {{big?: boolean}} options
 */
export function boardCard(view, note, { big = false } = {}) {
  const card = el('div', big ? 'bh-card big' : 'bh-card');
  const picture = el('div');
  card.append(picture);
  drawBoard(picture, { ...view, small: true });
  if (note) card.append(el('p', 'strip-note', note));
  return card;
}
