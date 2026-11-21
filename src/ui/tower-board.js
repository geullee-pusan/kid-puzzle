// 탑 옮기기의 판을 그린다: 받침 위의 기둥 셋과 원판들.
// 누를 수 있는 판은 기둥마다 큰 단추 하나다(기둥 전체가 누르는 자리라서 원판이 일곱 개로 얇아져도 누르기 쉽다).
// 기둥을 누르면 그 기둥의 맨 위 원판을 들어 올리고(기둥 위쪽에 떠 있게 그린다), 다른 기둥을 누르면 내려놓는다.
// 한 기둥에서 누른 채 다른 기둥까지 끌어서 놓아도 옮겨진다. 방금 내려놓은 원판은 짧게(0.3초) 내려앉는 움직임을 보인다.
// 보기만 하는 그림(처음 화면, 공책, 판 고르기, 풀이, "왜 그럴까?")은 같은 모양을 SVG로 작게 그린다.
// 색만으로 알리지 않는다. 원판의 크기는 너비와 원판에 적힌 수로, 깃발 기둥은 기둥 꼭대기의 깃발과 기둥 아래의 이름으로 보인다.
// 글자는 형식(src/formats/tower.js)이 대본에서 채워 건넨다. 이 파일에는 글을 적지 않는다. 시간을 재는 것이 없다(움직임은 CSS가 한다).

const NS = 'http://www.w3.org/2000/svg';
/** 끌어서 옮긴 뒤 바로 따라오는 누르기(같은 손가락을 뗀 것)를 한 번 더 받지 않는 시간(밀리초, 사건의 시각으로 잰다) */
const AFTER_DRAG = 500;

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

/** 크기에 따른 너비(기둥 칸의 몇 %)와 밝기(작을수록 밝다) */
const share = (size, n) => (n <= 1 ? 1 : (size - 1) / (n - 1));
export const widthOf = (size, n) => 30 + 66 * share(size, n);
const lightOf = (size, n) => 82 - 30 * share(size, n);

/** 기둥마다 꽂힌 원판(아래에서 위로) */
function stacksOf(pos) {
  const stacks = [[], [], []];
  for (let disc = pos.length; disc >= 1; disc--) stacks[pos[disc - 1]].push(disc);
  return stacks;
}

function discNode(size, n) {
  const disc = el('span', 'tw-disc');
  disc.style.setProperty('--w', `${widthOf(size, n)}%`);
  disc.style.setProperty('--l', `${lightOf(size, n)}%`);
  disc.append(el('span', 'tw-size', String(size)));
  return disc;
}

/** 깃발(기둥 꼭대기에 붙는 작은 그림) */
function flagNode() {
  const svg = make('svg', { viewBox: '0 0 40 34', 'aria-hidden': 'true' }, 'tw-flag');
  svg.append(make('path', { d: 'M 6 2 L 6 32' }, 'tw-flag-pole'), make('path', { d: 'M 7 3 L 36 10 L 7 18 Z' }, 'tw-flag-cloth'));
  return svg;
}

/**
 * 판을 그린다.
 * @param {HTMLElement} root 그릴 자리(안의 것을 모두 바꾼다)
 * @param {object} view
 *   pos       원판마다 꽂힌 기둥(크기 1부터)
 *   target    깃발 기둥
 *   held      들어 올린 원판이 있는 기둥(없으면 null)
 *   landed    방금 내려놓은 원판(0이면 없다)
 *   names     기둥마다 아래에 적을 이름
 *   label     (기둥) → 읽어 줄 이름
 *   onPeg     (기둥) → 기둥을 눌렀을 때. 없으면 누를 수 없다(끝난 판)
 *   onDrag    (from, to) → 한 기둥에서 다른 기둥까지 끌었을 때
 *   extra     판 아래에 붙일 것(표 만들기의 표)
 *   small     작은 그림(SVG)으로 그린다
 */
export function drawTower(root, view) {
  const { pos, target, held = null, landed = 0, names = ['', '', ''], label, onPeg, onDrag, extra = null, small = false } = view;
  if (small) {
    root.className = 'tower-board small';
    root.replaceChildren(towerSvg(view));
    return;
  }
  const n = pos.length;
  root.className = `tower-board live${extra ? ' with-extra' : ''}`;
  root.style.setProperty('--n', String(Math.max(n, 3)));
  const stacks = stacksOf(pos);
  let dragFrom = null;
  let draggedAt = -Infinity;
  const pegs = stacks.map((stack, peg) => {
    const button = el('button', `tw-peg${peg === target ? ' target' : ''}${peg === held ? ' holding' : ''}`);
    button.type = 'button';
    button.dataset.peg = String(peg);
    if (label) button.setAttribute('aria-label', label(peg));
    const lift = el('span', 'tw-lift');
    const pile = el('span', 'tw-pile');
    stack.forEach((size, index) => {
      const disc = discNode(size, n);
      const top = index === stack.length - 1;
      if (top && peg === held) {
        disc.classList.add('held');
        lift.append(disc);
        return;
      }
      if (size === landed) disc.classList.add('landing');
      pile.append(disc);
    });
    const rod = el('span', 'tw-rod');
    // 깃발은 기둥 꼭대기에 붙는다
    if (peg === target) rod.append(flagNode());
    const column = el('span', 'tw-column');
    column.append(rod, pile, lift);
    button.append(column, el('span', 'tw-name', names[peg]));
    if (!onPeg) {
      button.disabled = true;
      return button;
    }
    button.addEventListener('click', (event) => {
      if (event.timeStamp - draggedAt < AFTER_DRAG) return;
      onPeg(peg);
    });
    if (onDrag) {
      button.addEventListener('pointerdown', (event) => {
        if (stack.length === 0 || event.button > 0) return;
        dragFrom = peg;
        button.classList.add('pressed');
        // 손가락(마우스)을 뗀 곳이 다른 기둥이어도 뗀 것을 이 기둥이 받는다
        button.setPointerCapture?.(event.pointerId);
      });
      const end = (event) => {
        button.classList.remove('pressed');
        if (dragFrom !== peg) return;
        dragFrom = null;
        const under = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('.tw-peg');
        const to = under && root.contains(under) ? Number(under.dataset.peg) : peg;
        if (to === peg) return;
        draggedAt = event.timeStamp;
        onDrag(peg, to);
      };
      button.addEventListener('pointerup', end);
      button.addEventListener('pointercancel', () => {
        dragFrom = null;
        button.classList.remove('pressed');
      });
    }
    return button;
  });
  const row = el('div', 'tw-pegs');
  row.append(...pegs);
  const parts = [row, el('div', 'tw-base')];
  if (extra) parts.push(extra);
  root.replaceChildren(...parts);
}

/** 작은 그림의 크기: 기둥 칸 하나의 가로, 원판 한 줄의 높이 */
const CELL = 100;
const ROW = 14;

/**
 * 작은 그림(SVG).
 *   pos, target  모습과 깃발 기둥
 *   numbers      원판에 크기를 적는가(풀이, "왜 그럴까?")
 *   moved        방금 옮긴 원판(점선 고리를 두른다)
 */
export function towerSvg(view) {
  const { pos, target, numbers = false, moved = 0 } = view;
  const n = pos.length;
  const row = numbers ? 24 : ROW;
  const rows = Math.max(n, 3);
  const height = rows * row + 30;
  const svg = make('svg', { viewBox: `0 0 ${CELL * 3} ${height + 8}`, 'aria-hidden': 'true' }, 'tower-svg');
  const floor = height;
  stacksOf(pos).forEach((stack, peg) => {
    const middle = CELL * peg + CELL / 2;
    svg.append(make('rect', { x: middle - 3, y: floor - rows * row - 18, width: 6, height: rows * row + 18, rx: 3 }, 'tw-rod-art'));
    if (peg === target) {
      const top = floor - rows * row - 18;
      svg.append(make('path', { d: `M ${middle + 3} ${top} L ${middle + 26} ${top + 7} L ${middle + 3} ${top + 14} Z` }, 'tw-flag-art'));
    }
    stack.forEach((size, index) => {
      const w = ((CELL - 8) * widthOf(size, n)) / 100;
      const y = floor - (index + 1) * row;
      svg.append(make('rect', { x: middle - w / 2, y: y + 1, width: w, height: row - 2, rx: (row - 2) / 2, style: `--l: ${lightOf(size, n)}%` }, 'tw-disc-art'));
      if (numbers) {
        const text = make('text', { x: middle, y: y + row / 2 + 1, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 18 }, 'tw-number');
        text.textContent = String(size);
        svg.append(text);
      }
      if (size === moved) svg.append(make('rect', { x: middle - w / 2 - 3, y: y - 1, width: w + 6, height: row + 2, rx: row / 2 + 1 }, 'tw-ring'));
    });
  });
  svg.append(make('rect', { x: 4, y: floor, width: CELL * 3 - 8, height: 7, rx: 3 }, 'tw-base-art'));
  return svg;
}

/**
 * 옮기는 차례를 화살표로 이어 그린다. 처음 모습, 그리고 옮길 때마다의 모습(옮긴 원판에 고리)과 그 아래의 한 줄(caption(차례, 원판)).
 * @param {number[]} start 처음 모습
 * @param {number} target 깃발 기둥
 * @param {number[][]} moves 옮기기의 차례
 * @param {{caption: (step: number, disc: number) => string, first?: number, note?: string, showStart?: boolean}} options
 *   first  첫 옮기기가 몇 번째 옮기기인가(풀이를 여러 장에 나눠 그릴 때)
 */
export function moveStrip(start, target, moves, { caption, first = 1, note = '', showStart = true, startCaption = '' }) {
  const box = el('div', 'strip tw-strip');
  const row = el('div', 'strip-row');
  let pos = start.slice();
  const cell = (now, moved, text) => {
    const item = el('div', 'strip-cell');
    const picture = el('div');
    drawTower(picture, { pos: now, target, small: true, numbers: true, moved });
    item.append(picture);
    if (text) item.append(el('span', 'strip-caption', text));
    return item;
  };
  if (showStart) row.append(cell(pos, 0, startCaption));
  moves.forEach(([from, to], index) => {
    let disc = 0;
    for (let size = 1; size <= pos.length; size++) {
      if (pos[size - 1] === from) {
        disc = size;
        break;
      }
    }
    pos = pos.slice();
    pos[disc - 1] = to;
    if (showStart || index > 0) row.append(el('span', 'strip-arrow', '→'));
    row.append(cell(pos, disc, caption(first + index, disc)));
  });
  box.append(row);
  if (note) box.append(el('p', 'strip-note', note));
  return box;
}

/**
 * 몇 단계로 나눈 모습들을 화살표로 이어 그린다. 화살표 위에 그 단계에 옮긴 횟수(steps의 글)를 적는다.
 * @param {number[][]} stages 모습들
 * @param {number} target 깃발 기둥
 * @param {string[]} steps 단계 사이마다의 글(stages보다 하나 적다)
 * @param {string} note 그림 아래의 한 줄
 */
export function stageStrip(stages, target, steps, note = '') {
  const box = el('div', 'strip tw-strip');
  const row = el('div', 'strip-row');
  stages.forEach((pos, index) => {
    if (index > 0) {
      const arrow = el('span', 'strip-arrow tw-stage-arrow');
      arrow.append(el('span', 'tw-stage-count', steps[index - 1] ?? ''), el('span', '', '→'));
      row.append(arrow);
    }
    const item = el('div', 'strip-cell');
    const picture = el('div');
    drawTower(picture, { pos, target, small: true, numbers: true });
    item.append(picture);
    row.append(item);
  });
  box.append(row);
  if (note) box.append(el('p', 'strip-note', note));
  return box;
}

/**
 * 옮긴 원판의 차례: 한 줄에 width개씩, 칸마다 몇 번째인지(작게)와 움직인 원판(크게).
 * @param {number[]} discs 옮기기마다 움직인 원판
 * @param {{width?: number, label?: (step: number, disc: number) => string, mark?: number}} options mark: 고리를 두를 차례(묻는 차례)
 */
export function recordGrid(discs, { width = 8, label, mark = 0 } = {}) {
  const grid = el('ol', 'tw-record');
  grid.style.setProperty('--per', String(width));
  discs.forEach((disc, index) => {
    const step = index + 1;
    const item = el('li', `tw-chip${step === mark ? ' marked' : ''}`);
    if (label) item.setAttribute('aria-label', label(step, disc));
    item.append(el('span', 'tw-step', String(step)), el('strong', 'tw-moved', String(disc)));
    grid.append(item);
  });
  return grid;
}

/**
 * 수의 표(머리 줄과 줄마다 이름과 칸들). 칸은 글이나 { text, open }(open이면 점선 칸: 더 줄여 볼 수 있는 기록)
 * @param {string[]} head
 * @param {Array<Array<string|{text: string, open?: boolean, now?: boolean}>>} rows
 * @param {number} now 굵게 보일 줄(지금 해 보는 원판 수), 없으면 -1
 */
export function towerTable(head, rows, now = -1) {
  const table = el('table', 'tw-table');
  const top = el('tr');
  for (const text of head) {
    const cell = el('th', '', String(text));
    cell.scope = 'col';
    top.append(cell);
  }
  table.append(top);
  rows.forEach((cells, index) => {
    const line = el('tr');
    if (index === now) {
      line.className = 'now';
      line.setAttribute('aria-current', 'true');
    }
    cells.forEach((value, column) => {
      const item = typeof value === 'object' && value !== null ? value : { text: String(value) };
      const cell = el(column === 0 ? 'th' : 'td', item.open ? 'open' : '', item.text);
      if (column === 0) cell.scope = 'row';
      line.append(cell);
    });
    table.append(line);
  });
  return table;
}
