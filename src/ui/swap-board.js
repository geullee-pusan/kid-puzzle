// 자리 바꾸기의 판을 그린다: 한 줄로 이어진 칸과 그 위의 말(개구리와 두꺼비), 한 줄로 놓인 돌.
// 누를 수 있는 판과 보기만 하는 그림을 같은 모양으로 그린다.
// 색만으로 알리지 않는다. 개구리는 둥글고 두꺼비는 네모나고 등에 점이 있다. 둘 다 눈과 뾰족한 코가 보는 쪽에 있다.
// 짝이 된 돌은 두 개를, 셋이 쌓인 돌은 세 개를 포개어 그리고, 돌이 떠난 자리는 작은 점선 고리로 남긴다.
// 묶어 옮기기의 돌은 검은 돌과 흰 돌이다. 흰 돌에는 안쪽에 고리가 하나 더 있어서 밝기만으로 가르지 않는다.
// 못 가는 말을 누르면 그 앞에 굵은 막대를 세우고 길을 막은 칸에 테두리를 두른다. 글자는 대본에서 받는다.
// 누르는 것은 pointer 이벤트로 받는다. 말을 끌어다 놓아도 된다.

const NS = 'http://www.w3.org/2000/svg';
const UNIT = 100; // 칸 하나의 너비
const HEIGHT = 140; // 판의 높이
const MIDDLE = 74; // 말의 가운데 높이
const ARROW_ROOM = 34; // 방금 한 움직임을 화살표로 보일 때 위에 더 두는 자리
const DRAG_START = 12; // 이만큼 움직이면 누른 것이 아니라 끄는 것으로 본다

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

const centerOf = (index) => index * UNIT + UNIT / 2;

/** 화면의 자리를 그림 안의 자리로 바꾼다 */
function locate(svg, event) {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  const spot = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  return [spot.x, spot.y];
}

function cellAt(view, spot) {
  const index = Math.floor(spot[0] / UNIT);
  return index >= 0 && index < view.cells.length ? index : null;
}

/** 개구리: 둥근 몸. 오른쪽을 보게 그린다(왼쪽을 보는 말은 뒤집어 놓는다). */
function frogShape() {
  const group = make('g', {}, 'swap-frog');
  group.append(make('polygon', { points: '28,-11 47,0 28,11' }, 'swap-body'));
  group.append(make('circle', { cx: 0, cy: 0, r: 34 }, 'swap-body'));
  group.append(make('circle', { cx: 13, cy: -14, r: 10 }, 'swap-eye'));
  group.append(make('circle', { cx: 17, cy: -14, r: 4.5 }, 'swap-pupil'));
  group.append(make('path', { d: 'M 6 13 Q 18 20 29 9' }, 'swap-mouth'));
  return group;
}

/** 두꺼비: 네모난 몸, 등에 점 셋. 오른쪽을 보게 그린다(왼쪽을 보는 말은 뒤집어 놓는다). */
function toadShape() {
  const group = make('g', {}, 'swap-toad');
  group.append(make('polygon', { points: '28,-11 47,0 28,11' }, 'swap-body'));
  group.append(make('rect', { x: -33, y: -31, width: 66, height: 62, rx: 13 }, 'swap-body'));
  group.append(make('circle', { cx: 13, cy: -14, r: 10 }, 'swap-eye'));
  group.append(make('circle', { cx: 17, cy: -14, r: 4.5 }, 'swap-pupil'));
  group.append(make('path', { d: 'M 6 13 Q 18 20 29 9' }, 'swap-mouth'));
  for (const [cx, cy] of [[-19, -13], [-11, 4], [-21, 18]]) group.append(make('circle', { cx, cy, r: 4.5 }, 'swap-spot'));
  return group;
}

/** 돌: 혼자 있는 돌은 하나, 짝이 된 돌은 둘을, 셋이 쌓인 돌은 셋을 포개어 그린다. */
function stoneShape(pile) {
  const group = make('g', {}, pile === 2 ? 'swap-stone pair' : pile === 3 ? 'swap-stone pile' : 'swap-stone');
  if (pile === 3) {
    for (const cy of [24, 0, -24]) group.append(make('circle', { cx: 0, cy, r: 26 }, 'swap-disc'));
    group.append(make('path', { d: 'M -15 -32 Q -7 -41 5 -43' }, 'swap-shine'));
  } else if (pile === 2) {
    group.append(make('circle', { cx: 0, cy: 12, r: 30 }, 'swap-disc'));
    group.append(make('circle', { cx: 0, cy: -12, r: 30 }, 'swap-disc'));
    group.append(make('path', { d: 'M -17 -22 Q -8 -32 6 -34' }, 'swap-shine'));
  } else {
    group.append(make('circle', { cx: 0, cy: 0, r: 30 }, 'swap-disc'));
    group.append(make('path', { d: 'M -17 -10 Q -8 -20 6 -22' }, 'swap-shine'));
  }
  return group;
}

/** 묶어 옮기기의 돌: 검은 돌과 흰 돌(흰 돌은 안쪽 고리가 있다) */
function colorStone(cell) {
  const white = cell === 'W';
  const group = make('g', {}, `swap-stone ${white ? 'white' : 'black'}`);
  group.append(make('circle', { cx: 0, cy: 0, r: 32 }, 'swap-disc'));
  if (white) group.append(make('circle', { cx: 0, cy: 0, r: 17 }, 'swap-inner'));
  group.append(make('path', { d: 'M -18 -11 Q -9 -21 6 -23' }, 'swap-shine'));
  return group;
}

/** 그릴 자리에 판을 한 번 만들어 둔다. 손가락을 끄는 동안에도 판이 바뀌지 않게, 안의 것만 바꿔 그린다. */
function boardOf(root) {
  let board = boards.get(root);
  if (board && board.svg.parentNode === root) return board;
  const svg = make('svg', { preserveAspectRatio: 'xMidYMid meet' });
  board = { svg, view: null, press: null };
  boards.set(root, board);

  const letGo = () => {
    const press = board.press;
    if (press?.node) {
      press.node.setAttribute('transform', press.base);
      press.node.classList.remove('dragging');
    }
    // 끄는 동안 맨 위로 올렸던 칸 묶음을 제자리로 돌려놓는다(글자판으로 옮겨 다니는 차례가 바뀌지 않게).
    if (press?.raised) {
      const { group, next } = press.raised;
      if (next && next.parentNode === svg) svg.insertBefore(group, next);
      else svg.append(group);
    }
    board.press = null;
  };

  svg.addEventListener('pointerdown', (event) => {
    const view = board.view;
    if (!view || !view.onTap) return;
    const spot = locate(svg, event);
    const index = spot ? cellAt(view, spot) : null;
    if (index === null) return;
    event.preventDefault();
    letGo();
    const node = svg.querySelector(`[data-cell="${index}"] .swap-piece`);
    board.press = { id: event.pointerId, index, start: spot, node, moved: false, base: node?.getAttribute('transform') ?? '' };
    try {
      svg.setPointerCapture(event.pointerId);
    } catch {
      // 붙잡지 못해도 누르는 것은 그대로 된다.
    }
  });
  svg.addEventListener('pointermove', (event) => {
    const press = board.press;
    if (!press || press.id !== event.pointerId) return;
    const spot = locate(svg, event);
    if (!spot) return;
    const dx = spot[0] - press.start[0];
    const dy = spot[1] - press.start[1];
    if (!press.moved && Math.hypot(dx, dy) < DRAG_START) return;
    press.moved = true;
    // 말만 끌린다. 빈칸을 누른 채 움직인 것은 아무 일도 아니다.
    if (press.node && board.view?.onDrop) {
      // 그림은 나중에 그린 것이 위에 온다. 칸마다 네모와 말을 한 묶음으로 왼쪽부터 그리므로,
      // 끄는 말이 오른쪽 칸의 네모 밑으로 들어가 보이지 않게 된다. 끄는 동안 그 칸 묶음을 맨 위로 올린다.
      const group = press.node.closest('[data-cell]');
      if (group && !press.raised) {
        press.raised = { group, next: group.nextSibling };
        svg.append(group);
      }
      press.node.classList.add('dragging');
      press.node.setAttribute('transform', `translate(${dx} ${Math.max(-40, Math.min(10, dy)) - 8}) ${press.base}`);
    }
  });
  svg.addEventListener('pointerup', (event) => {
    const press = board.press;
    if (!press || press.id !== event.pointerId) return;
    const view = board.view;
    const spot = locate(svg, event);
    const dragged = press.moved;
    const hadPiece = Boolean(press.node);
    letGo();
    if (!view) return;
    if (!dragged) {
      view.onTap?.(press.index);
      return;
    }
    const to = spot ? cellAt(view, spot) : null;
    if (hadPiece && to !== null && to !== press.index) view.onDrop?.(press.index, to);
  });
  svg.addEventListener('pointercancel', letGo);
  // 글자판으로도 누를 수 있다.
  svg.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target.closest?.('[data-cell]');
    if (!board.view?.onTap || !target) return;
    event.preventDefault();
    board.view.onTap(Number(target.dataset.cell));
  });
  root.replaceChildren(svg);
  return board;
}

/**
 * 판을 그린다.
 * @param {HTMLElement} root 그릴 자리(안의 것을 모두 바꾼다)
 * @param {object} view
 *   kind     'frogs' | 'pairs' | 'carry'
 *   cells    칸의 모습. 개구리 판은 'R'(오른쪽을 보는 말), 'L'(왼쪽을 보는 말), '_'(빈칸).
 *            짝 짓기 판은 '1'(혼자 있는 돌), '2'(짝이 된 돌), '3'(셋이 쌓인 돌), '0'(빈자리)
 *            묶어 옮기기 판은 'B'(검은 돌), 'W'(흰 돌), '_'(빈칸)
 *   label    (칸 번호) → 읽어 줄 이름(누를 수 있는 판에서만)
 *   onTap    (칸 번호) → 눌렀을 때. 없으면 그림으로만 그린다
 *   onDrop   (떠난 칸, 놓은 칸) → 말을 끌어다 놓았을 때
 *   picked   집어 든 돌의 칸(없으면 null). 묶어 옮기기는 고른 돌들의 칸 목록
 *   targets  얹을 수 있는 칸들, 옮겨 갈 수 있는 빈칸들(점선 고리)
 *   block    { at, cells } 못 가는 말의 칸과 길을 막은 칸들(막대와 테두리로 보인다). 없으면 null
 *   last     { from, to } 방금 한 움직임. arrow가 true면 화살표로 보인다(묶어 옮기기는 돌 둘의 가운데에서 빈칸 둘의 가운데로)
 *   arrow    방금 한 움직임을 화살표로 그린다(그림용). 화살표가 없는 그림도 위에 같은 자리를 둔다
 *   small    작은 그림으로 그린다
 */
export function drawRow(root, view) {
  const { kind, cells, picked = null, targets = [], block = null, last = null, arrow = false, small = false } = view;
  const pickedCells = picked === null ? [] : [].concat(picked);
  // 묶어 옮기기는 움직임 하나가 두 칸이다(떠난 두 칸, 닿은 두 칸).
  const span = kind === 'carry' ? 1 : 0;
  const live = Boolean(view.onTap);
  root.className = `swap-row ${kind}${small ? ' small' : ''}${live ? ' live' : ''}`;
  root.style.setProperty('--n', String(cells.length));
  const board = boardOf(root);
  const { svg } = board;
  const focused = svg.contains(document.activeElement) ? document.activeElement.dataset.cell : undefined;

  const top = arrow ? -ARROW_ROOM : 0;
  svg.setAttribute('viewBox', `0 ${top} ${cells.length * UNIT} ${HEIGHT - top}`);
  svg.setAttribute('class', 'swap-svg');
  if (live) svg.removeAttribute('aria-hidden');
  else svg.setAttribute('aria-hidden', 'true');

  const nodes = [];
  if (kind === 'pairs') nodes.push(make('line', { x1: 8, y1: MIDDLE + 46, x2: cells.length * UNIT - 8, y2: MIDDLE + 46 }, 'swap-shelf'));

  [...cells].forEach((cell, index) => {
    const x = centerOf(index);
    const group = make('g', { 'data-cell': index }, 'swap-cell-group');
    if (kind === 'carry') {
      group.append(make('rect', { x: index * UNIT + 6, y: MIDDLE - 52, width: UNIT - 12, height: 104, rx: 18 }, 'swap-cell'));
      if (cell !== '_') {
        const lifted = pickedCells.includes(index);
        const piece = make('g', { transform: `translate(${x} ${MIDDLE - (lifted ? 14 : 0)})` }, 'swap-piece');
        if (last && !arrow && (index === last.to || index === last.to + 1)) piece.classList.add('moved');
        piece.append(colorStone(cell));
        group.append(piece);
        if (lifted) group.append(make('circle', { cx: x, cy: MIDDLE - 14, r: 42 }, 'swap-ring picked'));
      }
      if (targets.includes(index)) group.append(make('circle', { cx: x, cy: MIDDLE, r: 40 }, 'swap-ring target'));
    } else if (kind === 'frogs') {
      const names = ['swap-cell'];
      if (block?.cells.includes(index)) names.push('blocking');
      group.append(make('rect', { x: index * UNIT + 6, y: MIDDLE - 52, width: UNIT - 12, height: 104, rx: 18 }, names.join(' ')));
      if (cell !== '_') {
        const piece = make('g', { transform: `translate(${x} ${MIDDLE})${cell === 'L' ? ' scale(-1 1)' : ''}` }, 'swap-piece');
        if (last && last.to === index && !arrow) piece.classList.add('moved');
        piece.append(cell === 'R' ? frogShape() : toadShape());
        group.append(piece);
      }
    } else if (cell === '0') {
      group.append(make('circle', { cx: x, cy: MIDDLE + 20, r: 11 }, 'swap-gone'));
    } else {
      const lifted = pickedCells.includes(index);
      const lift = { 1: 14, 2: 4, 3: -2 }[cell] ?? 14;
      const piece = make('g', { transform: `translate(${x} ${MIDDLE + lift - (lifted ? 22 : 0)})` }, 'swap-piece');
      if (last && last.to === index && !arrow) piece.classList.add('moved');
      piece.append(stoneShape(Number(cell)));
      group.append(piece);
      if (lifted) group.append(make('circle', { cx: x, cy: MIDDLE - 8, r: 40 }, 'swap-ring picked'));
      if (targets.includes(index)) group.append(make('circle', { cx: x, cy: MIDDLE + 14, r: 40 }, 'swap-ring target'));
      if (block?.at === index) group.append(make('circle', { cx: x, cy: MIDDLE + 14, r: 40 }, 'swap-ring refused'));
    }
    if (live && view.label) {
      group.setAttribute('tabindex', '0');
      group.setAttribute('role', 'button');
      group.setAttribute('aria-label', view.label(index));
    }
    nodes.push(group);
  });

  // 못 가는 말 앞에 세우는 막대
  if (kind === 'frogs' && block && cells[block.at] !== '_' && cells[block.at] !== undefined) {
    const edge = cells[block.at] === 'R' ? (block.at + 1) * UNIT : block.at * UNIT;
    const x = Math.max(6, Math.min(cells.length * UNIT - 6, edge));
    nodes.push(make('rect', { x: x - 6, y: MIDDLE - 44, width: 12, height: 88, rx: 5 }, 'swap-wall'));
  }

  // 방금 한 움직임을 위쪽 화살표로 보인다(그림용).
  if (arrow && last) {
    const x1 = centerOf(last.from) + (span * UNIT) / 2;
    const x2 = centerOf(last.to) + (span * UNIT) / 2;
    const tip = x2 > x1 ? -1 : 1;
    nodes.push(make('path', { d: `M ${x1} ${MIDDLE - 56} Q ${(x1 + x2) / 2} ${MIDDLE - 118} ${x2} ${MIDDLE - 58}` }, 'swap-arrow'));
    nodes.push(make('polygon', { points: `${x2},${MIDDLE - 50} ${x2 + tip * 20},${MIDDLE - 60} ${x2 + tip * 4},${MIDDLE - 74}` }, 'swap-arrow-tip'));
  }

  svg.replaceChildren(...nodes);
  board.view = view;
  board.press = null;
  if (focused !== undefined) svg.querySelector(`[data-cell="${focused}"]`)?.focus?.();
}

/** 판 하나를 담은 새 조각을 만든다(풀이와 "왜 그럴까?"의 그림). 아래에 한 줄 글을 붙일 수 있다. */
export function rowCard(view, note) {
  const card = el('div', 'swap-card');
  const picture = el('div');
  card.append(picture);
  drawRow(picture, { ...view, small: true });
  if (note) card.append(el('p', 'strip-note', note));
  return card;
}

/**
 * 차례대로 늘어놓은 판들(풀이). 판마다 앞에 이름을 붙인다.
 * @param {{caption: string, view: object}[]} steps
 */
export function stepsCard(steps) {
  const list = el('ol', 'swap-steps');
  for (const step of steps) {
    const item = el('li', 'swap-step');
    item.append(el('span', 'strip-caption', step.caption));
    const picture = el('div');
    item.append(picture);
    drawRow(picture, { ...step.view, small: true });
    list.append(item);
  }
  return list;
}

/**
 * 수를 적은 표("왜 그럴까?"의 그림).
 * @param {string[]} heads 머리글
 * @param {string[][]} rows 줄마다 칸에 적을 글. 첫 칸은 줄의 이름이다
 */
export function countTable(heads, rows) {
  const table = el('table', 'swap-table');
  const head = el('tr');
  for (const text of heads) {
    const cell = el('th', '', text);
    cell.scope = 'col';
    head.append(cell);
  }
  const top = el('thead');
  top.append(head);
  const body = el('tbody');
  for (const row of rows) {
    const line = el('tr');
    row.forEach((text, index) => {
      const cell = el(index === 0 ? 'th' : 'td', '', text);
      if (index === 0) cell.scope = 'row';
      line.append(cell);
    });
    body.append(line);
  }
  table.append(top, body);
  return table;
}
