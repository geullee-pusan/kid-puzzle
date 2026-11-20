// 암호 놀이의 판을 그린다: 열쇠 줄, 암호와 푼 글(또는 바퀴대로 읽은 글), 풀 글자 줄, 글자 바퀴, 달아난 숫자의 세로셈.
// 글자 바퀴는 두 겹의 고리다. 바깥 고리(원래 글자)는 그대로 있고, 안쪽 고리(암호 글자나 글자표의 수)를 끌거나 ＋, − 단추로 돌린다.
// 안쪽 고리를 t칸 돌리면 바깥 글자 i와 나란한 안쪽 글자는 i + t다(끝 칸 다음은 다시 첫 칸). 가운데에 돌린 칸 수를 적는다.
// 바깥 고리의 글자를 누르면 그 글자를 고른 것이다(onPick). 글자는 대본과 src/core/cipher.js의 자모표에서 받는다(이 파일에 글을 적지 않는다).
// 색만으로 알리지 않는다: 고른 풀 글자는 굵은 테두리, 다르게 누른 바깥 글자는 점선 동그라미, 아직 못 푼 자리는 가운뎃점으로 그린다.
import { LETTERS, RING_SIZE, cellsOf, joinSyllable, symbolId, tableNumber } from '../core/cipher.js';
import { fill, ordinal } from '../core/text.js';

const NS = 'http://www.w3.org/2000/svg';
const VIEW = 300; // 바퀴 그림의 크기
const C = VIEW / 2;
const OUTER = [149, 94]; // 바깥 고리의 바깥 반지름과 안 반지름
const INNER = [92, 50]; // 안쪽 고리
const TAP = 8; // 이보다 적게 움직이면 누른 것으로 본다
const LONG = 24; // 글자(띄어쓰기 포함)가 이보다 많으면 긴 글로 그린다

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

const point = (r, degree) => {
  const rad = (degree * Math.PI) / 180;
  return [C + r * Math.sin(rad), C - r * Math.cos(rad)];
};

/** 고리의 한 칸(가운데 각도 degree, 너비 span) */
function wedge(r1, r2, degree, span) {
  const a = degree - span / 2;
  const b = degree + span / 2;
  const [x1, y1] = point(r1, a);
  const [x2, y2] = point(r1, b);
  const [x3, y3] = point(r2, b);
  const [x4, y4] = point(r2, a);
  return `M${x1} ${y1} A${r1} ${r1} 0 0 1 ${x2} ${y2} L${x3} ${y3} A${r2} ${r2} 0 0 0 ${x4} ${y4} Z`;
}

/** 바퀴의 글자 하나(안쪽 고리는 글자표의 수일 수 있다) */
export const ringLabel = (ring, index, numbers = false) => (numbers && ring !== 'd' ? String(tableNumber(ring, index)) : LETTERS[ring][index]);

/**
 * 글자 바퀴 하나.
 * @param {object} view
 *   ring     'c' | 'v' | 'd'
 *   turn     돌린 칸 수(0부터)
 *   numbers  안쪽 고리에 글자표의 수를 쓴다
 *   counts   안쪽 고리의 글자마다 적을 수(글자 세기). 없으면 null
 *   refused  점선 동그라미를 그릴 바깥 글자(없으면 null)
 *   arrow    바깥 고리의 이 칸에서 다음 칸으로 가는 화살표(왜 그럴까의 그림)
 *   words, labels  대본의 글
 *   onPick(ring, index)  바깥 글자를 눌렀다. 없으면 누를 수 없는 그림
 *   onTurn(ring, delta)  안쪽 고리를 돌렸다
 *   small    작게 그린다(처음 화면, 공책, 왜 그럴까)
 */
export function wheelNode(view) {
  const { ring, turn = 0, numbers = false, counts = null, refused = null, arrow = null, words, labels, onPick, onTurn, small = false } = view;
  const n = RING_SIZE[ring];
  const span = 360 / n;
  const live = typeof onPick === 'function' || typeof onTurn === 'function';
  const box = el('div', `cp-wheel ring-${ring}${small ? ' small' : ''}${live ? ' live' : ''}`);
  const svg = make('svg', { viewBox: `0 0 ${VIEW} ${VIEW}`, role: 'group', 'aria-label': labels.wheel[ring] }, 'cp-wheel-svg');
  box.append(svg);

  // 바깥 고리: 원래 글자. 누를 수 있다
  const outer = make('g', {}, 'cp-outer');
  for (let index = 0; index < n; index++) {
    const degree = index * span;
    const cell = make('g', live && onPick ? { role: 'button', tabindex: 0, 'aria-label': fill(labels.outer, { f: LETTERS[ring][index] }), 'data-index': index } : { 'data-index': index }, 'cp-cell');
    cell.append(make('path', { d: wedge(OUTER[0], OUTER[1], degree, span) }, 'cp-wedge'));
    const [x, y] = point((OUTER[0] + OUTER[1]) / 2, degree);
    const text = make('text', { x, y, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, 'cp-letter');
    text.textContent = LETTERS[ring][index];
    cell.append(text);
    if (refused === index) cell.append(make('circle', { cx: x, cy: y, r: 22 }, 'cp-refused'));
    outer.append(cell);
  }
  svg.append(outer);
  if (arrow !== null) {
    // 바깥 고리 안쪽 가장자리를 따라 이 칸에서 다음 칸으로 가는 화살표
    const r = OUTER[1] + 9;
    const [x1, y1] = point(r, arrow * span);
    const [x2, y2] = point(r, (arrow + 1) * span - 6);
    svg.append(make('path', { d: `M${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2}` }, 'cp-arrow'));
    const [hx, hy] = point(r, (arrow + 1) * span);
    const [ax, ay] = point(r + 9, (arrow + 1) * span - 9);
    const [bx, by] = point(r - 9, (arrow + 1) * span - 9);
    svg.append(make('polygon', { points: `${hx},${hy} ${ax},${ay} ${bx},${by}` }, 'cp-arrow-head'));
  }

  // 안쪽 고리: 암호 글자(또는 글자표의 수). 돌린 만큼 돌아가 있다
  const inner = make('g', {}, 'cp-inner');
  const innerRing = make('g', {}, 'cp-inner-ring');
  for (let index = 0; index < n; index++) {
    const degree = (index - turn) * span;
    innerRing.append(make('path', { d: wedge(INNER[0], INNER[1], degree, span) }, 'cp-wedge inner'));
    const label = ringLabel(ring, index, numbers);
    const [x, y] = point(counts ? 79 : (INNER[0] + INNER[1]) / 2, degree);
    const text = make('text', { x, y, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, `cp-letter inner${label.length > 1 ? ' wide' : ''}`);
    text.textContent = label;
    innerRing.append(text);
    if (counts) {
      const [cx, cy] = point(60, degree);
      const count = make('text', { x: cx, y: cy, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, `cp-count${counts[index] === Math.max(...counts) && counts[index] > 0 ? ' most' : ''}`);
      count.textContent = String(counts[index]);
      innerRing.append(count);
    }
  }
  inner.append(innerRing);
  svg.append(inner);

  // 가운데: 돌린 칸 수
  svg.append(make('circle', { cx: C, cy: C, r: INNER[1] - 2 }, 'cp-hub'));
  const hub = make('text', { x: C, y: C, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, 'cp-turned');
  hub.textContent = fill(words.turned, { n: turn });
  svg.append(hub);

  if (live) {
    listen(svg, innerRing, { ring, span, onPick, onTurn });
    if (onTurn) {
      // 바퀴 하나면 바퀴 양옆에, 둘이면 바퀴 아래에 놓인다(app.css)
      const fewer = el('button', 'btn cp-turn fewer', words.fewer);
      fewer.type = 'button';
      fewer.setAttribute('aria-label', fill(labels.fewer, { f: labels.wheel[ring] }));
      fewer.addEventListener('click', () => onTurn(ring, -1));
      const more = el('button', 'btn cp-turn more', words.more);
      more.type = 'button';
      more.setAttribute('aria-label', fill(labels.more, { f: labels.wheel[ring] }));
      more.addEventListener('click', () => onTurn(ring, 1));
      box.append(fewer, more);
    }
  }
  return box;
}

/** 바퀴를 끌어 돌리고, 바깥 글자를 누른다. 끄는 동안은 안쪽 고리만 돌려 보이고, 손을 떼면 가까운 칸으로 맞춘다 */
function listen(svg, innerRing, { ring, span, onPick, onTurn }) {
  let drag = null;
  const angleOf = (event) => {
    const rect = svg.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    return (Math.atan2(x, -y) * 180) / Math.PI;
  };
  svg.addEventListener('pointerdown', (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    drag = { id: event.pointerId, start: angleOf(event), x: event.clientX, y: event.clientY, moved: false, angle: 0, target: event.target.closest('.cp-cell') };
    svg.setPointerCapture?.(event.pointerId);
  });
  svg.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > TAP) drag.moved = true;
    if (!drag.moved || !onTurn) return;
    let angle = angleOf(event) - drag.start;
    if (angle > 180) angle -= 360;
    if (angle < -180) angle += 360;
    drag.angle = angle;
    svg.closest('.cp-wheel')?.classList.add('turning');
    innerRing.setAttribute('transform', `rotate(${angle} ${C} ${C})`);
  });
  const end = (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const done = drag;
    drag = null;
    svg.closest('.cp-wheel')?.classList.remove('turning');
    innerRing.removeAttribute('transform');
    if (!done.moved) {
      if (done.target && onPick) onPick(ring, Number(done.target.getAttribute('data-index')));
      return;
    }
    // 시계 방향으로 끌면 안쪽 글자가 시계 방향으로 가서 돌린 칸 수가 줄어든다
    const steps = -Math.round(done.angle / span);
    if (steps !== 0 && onTurn) onTurn(ring, steps);
  };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  svg.addEventListener('keydown', (event) => {
    const cell = event.target.closest?.('.cp-cell');
    if (!cell || !onPick || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    onPick(ring, Number(cell.getAttribute('data-index')));
  });
}

// ---- 글 ----

/**
 * 글 한 줄의 칸들. 칸마다 위에 암호(또는 글자표의 수), 아래에 푼 글(또는 바퀴대로 읽은 글).
 * @param {object} view
 *   cipher   암호문
 *   numbers  암호를 글자표의 수로 보인다
 *   plainOf(ring, index)  그 암호 글자의 푼 글자(바퀴의 칸). 아직 못 풀었으면 null
 *   selected 고른 풀 글자(이름). 암호에서 같은 글자에 밑줄을 긋는다
 *   reading  아래 줄에 쓸 글(바퀴대로 읽은 글). 있으면 plainOf 대신 이 글을 쓴다
 */
export function messageNode(view) {
  const { cipher, numbers = false, plainOf, selected = null, reading = null, words, small = false, hideBottom = false } = view;
  // 긴 글(세 문장 편지)은 작은 글씨로 촘촘히 놓아 바퀴 자리를 남긴다
  const long = !small && [...cipher].length > LONG;
  const box = el('div', `cp-message${small ? ' small' : ''}${numbers ? ' numbers' : ''}${long ? ' long' : ''}`);
  const readCells = reading === null ? null : [...reading];
  cellsOf(cipher).forEach((cell, at) => {
    if (cell.ch === ' ') {
      box.append(el('span', 'cp-space'));
      return;
    }
    const item = el('span', `cp-cell-text${cell.type === 'mark' ? ' mark' : ''}`);
    const top = el('span', 'cp-top');
    if (cell.type === 'mark') top.textContent = cell.ch;
    else if (numbers) {
      for (const part of cell.parts) {
        const id = symbolId(part.ring, part.index);
        top.append(el('span', `cp-number${id === selected ? ' chosen' : ''}`, ringLabel(part.ring, part.index, true)));
      }
    } else {
      top.textContent = cell.ch;
      if (cell.parts.some((part) => symbolId(part.ring, part.index) === selected)) top.classList.add('chosen');
    }
    item.append(top);
    if (!hideBottom) {
      let bottom = '';
      if (cell.type === 'mark') bottom = cell.ch;
      else if (readCells) bottom = readCells[at];
      else {
        const plain = cell.parts.map((part) => plainOf(part.ring, part.index));
        if (plain.every((value) => value !== null)) {
          bottom = cell.type === 'digit' ? LETTERS.d[plain[0]] : joinSyllable(plain[0], plain[1], plain.length > 2 ? plain[2] : -1);
        } else {
          bottom = cell.parts.map((part, index) => (plain[index] === null ? words.blank : LETTERS[part.ring][plain[index]])).join('');
          item.classList.add('partly');
        }
      }
      item.append(el('span', 'cp-bottom', bottom));
    }
    box.append(item);
  });
  return box;
}

/**
 * 풀 글자 줄: 암호에 나오는 글자마다 단추 하나(푼 글자는 화살표 뒤에 적는다).
 * @param {object} view symbols, found(이름 → 푼 칸), selected, numbers, onSelect(이름)
 */
export function chipsNode(view) {
  const { symbols, found, selected, numbers, words, labels, onSelect } = view;
  const row = el('div', 'cp-chips');
  for (const id of symbols) {
    const ring = id[0];
    const index = Number(id.slice(1));
    const label = ringLabel(ring, index, numbers);
    const done = found[id] !== undefined;
    const chip = el('button', `btn cp-chip${done ? ' done' : ''}`);
    chip.type = 'button';
    chip.setAttribute('aria-pressed', String(id === selected));
    chip.setAttribute('aria-label', done ? fill(labels['chip-done'], { f: label, face: LETTERS[ring][found[id]] }) : fill(labels.chip, { f: label }));
    chip.append(el('span', 'cp-chip-from', label));
    if (done) chip.append(el('span', 'cp-chip-arrow', words.arrow), el('span', 'cp-chip-to', LETTERS[ring][found[id]]));
    if (onSelect) chip.addEventListener('click', () => onSelect(id));
    else chip.disabled = true;
    row.append(chip);
  }
  return row;
}

// ---- 달아난 숫자 ----

/**
 * 세로셈. 가린 자리는 네모(누를 수 있는 단추)이고, 아이가 넣은 숫자가 들어간다.
 * @param {object} view rows, op, hidden, entries(가린 자리마다 넣은 숫자 또는 null), selected, onBox(차례), answer(풀이: 채울 숫자), small
 */
export function sumNode(view) {
  const { rows, op, hidden, entries = [], selected = null, onBox, answer = null, words, labels, small = false } = view;
  const width = Math.max(...rows.map((row) => row.length));
  const grid = el('div', `cp-sum${small ? ' small' : ''}`);
  grid.style.setProperty('--cols', String(width + 1));
  rows.forEach((row, line) => {
    const sign = el('span', 'cp-sign', line === 1 ? (op === 'add' ? words.add : words.sub) : '');
    if (line === 2) grid.append(el('span', 'cp-rule'));
    grid.append(sign);
    for (let pad = row.length; pad < width; pad++) grid.append(el('span', 'cp-digit empty'));
    [...row].forEach((ch, at) => {
      const spot = hidden.findIndex(([r, a]) => r === line && a === at);
      if (spot < 0) {
        grid.append(el('span', 'cp-digit', ch));
        return;
      }
      const value = answer ? String(answer[spot]) : entries[spot] === null || entries[spot] === undefined ? '' : String(entries[spot]);
      const box = el(onBox ? 'button' : 'span', `cp-digit box${spot === selected ? ' chosen' : ''}${answer ? ' shown' : ''}`, value);
      if (onBox) {
        box.type = 'button';
        box.setAttribute('aria-pressed', String(spot === selected));
        box.setAttribute('aria-label', fill(labels.box, { no: ordinal(line + 1), f: ordinal(at + 1) }));
        box.addEventListener('click', () => onBox(spot));
      }
      grid.append(box);
    });
  });
  return grid;
}

// ---- 판 전체 ----

/**
 * 판을 그린다.
 * @param {HTMLElement} root
 * @param {object} view
 *   keyLine  열쇠 줄의 글
 *   message  messageNode의 값(없으면 글을 그리지 않는다)
 *   chips    chipsNode의 값(없으면 그리지 않는다)
 *   wheels   wheelNode의 값들
 *   sum      sumNode의 값(달아난 숫자)
 */
export function drawCipher(root, view) {
  const board = el('div', `cp-board${view.small ? ' small' : ''}`);
  if (view.keyLine) board.append(el('p', 'cp-key-line', view.keyLine));
  if (view.message) board.append(messageNode({ ...view.message, words: view.words, small: view.small }));
  if (view.chips) board.append(chipsNode({ ...view.chips, words: view.words, labels: view.labels }));
  if (view.wheels?.length) {
    const row = el('div', `cp-wheels n${view.wheels.length}`);
    for (const wheel of view.wheels) row.append(wheelNode({ ...wheel, words: view.words, labels: view.labels, small: view.small || wheel.small }));
    board.append(row);
  }
  if (view.sum) board.append(sumNode({ ...view.sum, words: view.words, labels: view.labels, small: view.small }));
  root.replaceChildren(board);
}

/**
 * 글자 세기의 막대 그림(왜 그럴까): 자음마다 나온 수를 막대로. 가장 많은 자음은 굵은 테두리.
 * @param {number[]} counts 자음 바퀴의 칸마다 나온 수
 */
export function countBars(counts) {
  const top = Math.max(...counts);
  const box = el('div', 'cp-bars');
  counts.forEach((count, index) => {
    const bar = el('span', `cp-bar${count === top && top > 0 ? ' most' : ''}`);
    bar.style.setProperty('--h', String(top === 0 ? 0 : count / top));
    bar.append(el('span', 'cp-bar-fill'), el('span', 'cp-bar-count', String(count)), el('span', 'cp-bar-letter', LETTERS.c[index]));
    box.append(bar);
  });
  return box;
}

/** 왜 그럴까와 풀이의 그림 한 장(그림과 한 줄) */
export function cipherCard(node, note) {
  const card = el('div', 'block-card cp-card');
  card.append(node);
  if (note) card.append(el('p', 'strip-note', note));
  return card;
}
