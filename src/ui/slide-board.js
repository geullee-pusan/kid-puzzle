// 번호 말 제자리 찾기의 판을 그린다: 한 줄로 놓인 말(맞바꾸기)과 빈칸이 하나 있는 판(밀기), 고리 화살표, 한 줄로 읽은 수.
// 누를 수 있는 판과 보기만 하는 그림을 같은 모양으로 그린다. 글자는 대본에서 받는다(이 파일에는 글을 적지 않는다).
// 색만으로 알리지 않는다. 말은 흰 바탕에 굵은 테두리와 큰 수, 빈칸은 점선 네모다. 고른 말은 굵은 금빛 점선 테두리와 위로 들린 모습이다.
// 고리 화살표는 고리마다 선의 모양(실선, 긴 점선, 짧은 점선, 점과 선)이 다르고 색도 다르다. 오른쪽으로 가는 화살표는 말 위로, 왼쪽으로 가는 화살표는 말 아래로 굽는다.
// 제자리에 있는 말은 혼자 고리 하나라서, 고리를 볼 때 그 말 위에 작은 동그라미를 그린다.
// 한 줄로 읽은 수는 판 아래에 칸이 이어진 띠로 그린다. 방금 건너뛴 수는 굵은 테두리, 건너뛰어진 두 수는 점선 테두리다.
// 방금 민 말은 0.15초 동안 빈칸 자리에서 미끄러져 온다(css. 움직임을 줄이는 설정이면 없다).

const NS = 'http://www.w3.org/2000/svg';
const UNIT = 100; // 말 한 칸의 크기
const EDGE = 8; // 판 둘레에 두는 자리
/** 고리 화살표의 모양 가짓수(고리마다 돌려 쓴다) */
const RING_STYLES = 4;

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

/** 화살표 굽이의 높이: 멀리 가는 화살표일수록 높다 */
const arcHeight = (distance) => 30 + 18 * distance;
/** 말 n개의 줄에서 화살표 자리로 위아래에 비워 둘 높이 */
const arcRoom = (n) => arcHeight(n - 1) / 2 + 16;

/** 고리들(자리 번호의 목록들). src/core/slide.js의 cyclesOf와 같다(화면 조각이 core를 부르지 않게 따로 둔다) */
function cyclesOf(cells) {
  const seen = new Array(cells.length).fill(false);
  const cycles = [];
  for (let start = 0; start < cells.length; start++) {
    if (seen[start]) continue;
    const cycle = [];
    let at = start;
    while (!seen[at]) {
      seen[at] = true;
      cycle.push(at);
      at = cells[at] - 1;
    }
    cycles.push(cycle);
  }
  return cycles;
}

/** 말 하나(네모와 수) */
function piece(x, y, value, className) {
  const group = make('g', {}, className);
  group.append(make('rect', { x: x + 5, y: y + 5, width: UNIT - 10, height: UNIT - 10, rx: 16 }, 'sl-piece'));
  const text = make('text', { x: x + UNIT / 2, y: y + UNIT / 2 + 2, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, 'sl-num');
  text.textContent = String(value);
  group.append(text);
  return group;
}

/** 한 자리에서 다른 자리로 굽은 화살표(두 번 굽은 선과 끝의 세모) */
function arcArrow(from, to, style) {
  const distance = Math.abs(to - from);
  const right = to > from;
  const lift = arcHeight(distance);
  const y = right ? 0 : UNIT;
  const sx = from * UNIT + UNIT / 2 + (right ? 10 : -10);
  const ex = to * UNIT + UNIT / 2 + (right ? -10 : 10);
  const cy = right ? y - lift : y + lift;
  const mx = (sx + ex) / 2;
  const group = make('g', {}, `sl-ring sl-ring-${style}`);
  group.append(make('path', { d: `M${sx},${y} Q${mx},${cy} ${ex},${y}` }, 'sl-arc'));
  // 끝의 세모: 선이 끝에서 나아가는 쪽(끝점 − 굽이점)으로 향한다
  const dx = ex - mx;
  const dy = y - cy;
  const length = Math.hypot(dx, dy);
  const [ux, uy] = [dx / length, dy / length];
  const size = 20;
  const back = [ex - ux * size, y - uy * size];
  const side = [-uy * size * 0.55, ux * size * 0.55];
  group.append(make('path', { d: `M${ex},${y}L${back[0] + side[0]},${back[1] + side[1]}L${back[0] - side[0]},${back[1] - side[1]}Z` }, 'sl-head'));
  return group;
}

/**
 * 판을 그린다.
 * @param {HTMLElement} root 그릴 자리(안의 것을 모두 바꾼다)
 * @param {object} view
 *   kind, w, h, cells  판(맞바꾸기는 한 줄, 밀기는 0이 빈칸)
 *   picked    고른 말의 자리(맞바꾸기. 없으면 null)
 *   arrows    고리 화살표를 그린다(맞바꾸기)
 *   keepRoom  화살표가 없어도 그 자리를 비워 둔다(화살표를 켜고 끌 때 판 크기가 바뀌지 않게)
 *   moved     방금 움직인 말: { at(지금 자리), from(전 자리) }. 밀기는 미끄러져 오고, 맞바꾸기는 두 말이 잠깐 들린다
 *   marks     굵은 테두리로 짚을 자리들(그림에서 방금 민 말, 맞바꾼 두 말)
 *   labels    { board, piece(자리, 수), hole(자리) } 읽어 줄 이름(누를 수 있는 판에서만)
 *   onTap     (자리) → 말을 눌렀을 때. 없으면 누를 수 없다
 *   holeTap   빈칸도 누를 수 있다(직접 만들기에서 빈칸을 옮길 때)
 *   small     작은 그림으로 그린다
 */
export function drawBoard(root, view) {
  const { kind, w, h, cells, picked = null, arrows = false, keepRoom = false, moved = null, marks = [], small = false } = view;
  const live = Boolean(view.onTap);
  const focused = root.contains(document.activeElement) ? document.activeElement.dataset?.key : undefined;
  root.className = `sl-board ${kind === 'swap' ? 'row' : 'grid'}${small ? ' small' : ''}${live ? ' live' : ''}`;
  const room = kind === 'swap' && (arrows || keepRoom) ? arcRoom(w) : 0;
  const width = w * UNIT;
  const height = h * UNIT;
  root.style.setProperty('--w', String(w));
  root.style.setProperty('--h', String(h + (2 * room) / UNIT));
  const svg = make('svg', { viewBox: `${-EDGE} ${-room - EDGE} ${width + 2 * EDGE} ${height + 2 * room + 2 * EDGE}`, preserveAspectRatio: 'xMidYMid meet' }, 'sl-svg');
  if (live && view.labels) {
    svg.setAttribute('role', 'group');
    svg.setAttribute('aria-label', view.labels.board);
  } else svg.setAttribute('aria-hidden', 'true');

  const marked = new Set(marks);
  if (kind === 'slide') svg.append(make('rect', { x: -4, y: -4, width: width + 8, height: height + 8, rx: 12 }, 'sl-frame'));
  // 고리 화살표는 말 밑에 깐다(말을 가리지 않게)
  if (kind === 'swap' && arrows) {
    cyclesOf(cells).forEach((cycle, index) => {
      const style = index % RING_STYLES;
      if (cycle.length === 1) {
        const at = cycle[0];
        svg.append(make('circle', { cx: at * UNIT + UNIT / 2, cy: -20, r: 13 }, `sl-stay sl-ring-${style}`));
        return;
      }
      for (const at of cycle) svg.append(arcArrow(at, cells[at] - 1, style));
    });
  }
  const swing = moved && kind === 'swap' ? new Set([moved.at, moved.from]) : new Set();
  for (let at = 0; at < w * h; at++) {
    const x = (at % w) * UNIT;
    const y = Math.floor(at / w) * UNIT;
    const value = cells[at];
    if (value === 0) {
      const hole = make('g', { 'data-key': `cell-${at}` }, `sl-hole-group${picked === at ? ' picked' : ''}`);
      hole.append(make('rect', { x: x + 8, y: y + 8, width: UNIT - 16, height: UNIT - 16, rx: 14 }, 'sl-hole'));
      if (picked === at) hole.append(make('rect', { x: x + 1, y: y + 1, width: UNIT - 2, height: UNIT - 2, rx: 18 }, 'sl-pick'));
      // 직접 만들기에서는 빈칸도 골라 다른 말과 맞바꿀 수 있다
      if (live && view.holeTap) {
        hole.setAttribute('data-at', String(at));
        hole.setAttribute('tabindex', '0');
        hole.setAttribute('role', 'button');
        hole.setAttribute('aria-pressed', String(picked === at));
        if (view.labels) hole.setAttribute('aria-label', view.labels.hole(at));
      }
      svg.append(hole);
      continue;
    }
    const classes = ['sl-tile'];
    if (picked === at) classes.push('picked');
    if (marked.has(at)) classes.push('marked');
    if (swing.has(at)) classes.push('sl-swing');
    const group = piece(x, y, value, classes.join(' '));
    group.setAttribute('data-at', String(at));
    group.setAttribute('data-key', `cell-${at}`);
    if (moved && kind === 'slide' && moved.at === at) {
      // 방금 민 말: 전 자리에서 미끄러져 온다
      group.classList.add('sl-moved');
      group.style.setProperty('--dx', `${((moved.from % w) - (at % w)) * UNIT}px`);
      group.style.setProperty('--dy', `${(Math.floor(moved.from / w) - Math.floor(at / w)) * UNIT}px`);
    }
    if (picked === at) group.append(make('rect', { x: x + 1, y: y + 1, width: UNIT - 2, height: UNIT - 2, rx: 18 }, 'sl-pick'));
    if (marked.has(at)) group.append(make('rect', { x: x - 2, y: y - 2, width: UNIT + 4, height: UNIT + 4, rx: 20 }, 'sl-mark'));
    if (live) {
      group.setAttribute('tabindex', '0');
      group.setAttribute('role', 'button');
      if (kind === 'swap' || view.holeTap) group.setAttribute('aria-pressed', String(picked === at));
      if (view.labels) group.setAttribute('aria-label', view.labels.piece(at, value));
    }
    svg.append(group);
  }

  if (live) {
    const press = (target) => view.onTap(Number(target.dataset.at));
    svg.addEventListener('click', (event) => {
      const target = event.target.closest?.('[data-at]');
      if (target) press(target);
    });
    // 글자판으로도 누를 수 있다.
    svg.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const target = event.target.closest?.('[data-at]');
      if (!target) return;
      event.preventDefault();
      press(target);
    });
  }
  root.replaceChildren(svg);
  if (focused !== undefined) svg.querySelector(`[data-key="${focused}"]`)?.focus?.();
}

/**
 * 한 줄로 읽은 수의 띠. 칸마다 수 하나.
 * @param {HTMLElement} root
 * @param {{line: number[], jumper?: number|null, over?: number[], small?: boolean, label?: string}} view
 *   jumper 방금 다른 수를 건너뛴 수(굵은 테두리), over 건너뛰어진 수들(점선 테두리)
 */
export function drawLine(root, view) {
  const { line, jumper = null, over = [], small = false } = view;
  root.className = `sl-line${small ? ' small' : ''}`;
  if (view.label) root.setAttribute('aria-label', view.label);
  const chips = line.map((value) => {
    const chip = el('span', `sl-chip${value === jumper ? ' jumper' : ''}${over.includes(value) ? ' over' : ''}`, String(value));
    return chip;
  });
  root.replaceChildren(...chips);
}

/**
 * 판 하나를 담은 새 조각을 만든다(풀이, "왜 그럴까?", 직접 만들기의 그림). 아래에 한 줄로 읽은 띠와 한 줄 글을 붙일 수 있다.
 * 크기: 보통은 판 위의 종이에 한 줄에 석 장, mid는 두 장, big은 한 장이 들어간다.
 * @param {object} view drawBoard의 view. line이 있으면 그 띠(drawLine의 view)를 아래에 그린다
 */
export function boardCard(view, note, { big = false, mid = false } = {}) {
  const card = el('div', `sl-card${big ? ' big' : mid ? ' mid' : ''}${view.kind === 'swap' ? ' row' : ''}`);
  const picture = el('div');
  card.append(picture);
  drawBoard(picture, { ...view, small: true });
  if (view.line) {
    const strip = el('div');
    drawLine(strip, { ...view.line, small: true });
    card.append(strip);
  }
  if (note) card.append(el('p', 'strip-note', note));
  return card;
}
