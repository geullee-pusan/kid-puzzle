// 줄 뒤집기 판을 그린다: 네모 칸들(검은 칸과 흰 칸), 세로줄 위와 가로줄 오른쪽의 뒤집기 단추, 표시한 네 칸, 방금 뒤집은 줄.
// 누를 수 있는 판과 보기만 하는 그림을 같은 모양으로 그린다. 글자는 대본에서 받는다(이 파일에는 글을 적지 않는다).
// 색만으로 알리지 않는다. 검은 칸은 짙게 메우고 가운데에 흰 동그라미를 찍는다. 흰 칸은 비워 둔다.
// 표시한 네 칸은 칸마다 굵은 금빛 점선 네모, 처음 고른 한 칸은 점선 동그라미, 방금 뒤집은 줄(그림)은 줄을 감싸는 긴 점선 띠다.
// 뒤집기 단추는 줄마다 하나씩, 단추 자리는 칸 한 줄의 폭만큼 넓게 눌린다. 방금 뒤집힌 칸은 0.3초 동안 납작해졌다 돌아온다(css. 움직임을 줄이는 설정이면 없다).

const NS = 'http://www.w3.org/2000/svg';
const UNIT = 100; // 칸 하나의 크기
const LANE = 92; // 뒤집기 단추 자리의 폭
const EDGE = 6; // 판 둘레에 두는 자리

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

/** 가로(세로) 양쪽 화살표: 단추에 그리는 모양. 가로줄 단추는 가로, 세로줄 단추는 세로 */
function arrow(cx, cy, across) {
  const a = 22;
  const b = 11;
  const d = across
    ? `M${cx - a},${cy}H${cx + a}M${cx - a + b},${cy - b}L${cx - a},${cy}L${cx - a + b},${cy + b}M${cx + a - b},${cy - b}L${cx + a},${cy}L${cx + a - b},${cy + b}`
    : `M${cx},${cy - a}V${cy + a}M${cx - b},${cy - a + b}L${cx},${cy - a}L${cx + b},${cy - a + b}M${cx - b},${cy + a - b}L${cx},${cy + a}L${cx + b},${cy + a - b}`;
  return make('path', { d }, 'rf-arrow');
}

/**
 * 판을 그린다.
 * @param {HTMLElement} root 그릴 자리(안의 것을 모두 바꾼다)
 * @param {object} view
 *   w, h       가로와 세로의 칸 수
 *   cells      칸마다 1(검은 칸) 또는 0(흰 칸)
 *   changed    방금 뒤집힌 칸들(잠깐 움직인다)
 *   marks      표시한 네 칸(칸 번호들)
 *   pick       처음 고른 한 칸(없으면 null)
 *   band       감쌀 줄 하나('r2', 'c0'). 그림에서 방금 뒤집은 줄을 보인다
 *   lineMarks  단추 자리에 점을 찍을 줄들(그림에서 뒤집을 줄을 보인다)
 *   lanes      단추 자리를 둔다(누를 수 있는 판과 lineMarks가 있는 그림)
 *   labels     { board, cell(칸 번호, 검은 칸인가), row(번호), col(번호) } 읽어 줄 이름(누를 수 있는 판에서만)
 *   onLine     (줄) → 뒤집기 단추를 눌렀을 때. 없으면 단추를 그리지 않는다
 *   onCell     (칸 번호) → 칸을 눌렀을 때(네 칸 골라 보기). 없으면 칸을 누를 수 없다
 *   small      작은 그림으로 그린다
 */
export function drawBoard(root, view) {
  const { w, h, cells, changed = [], marks = [], pick = null, band = null, lineMarks = [], small = false } = view;
  const live = Boolean(view.onLine || view.onCell);
  const lanes = Boolean(view.onLine) || lineMarks.length > 0;
  const focused = root.contains(document.activeElement) ? document.activeElement.dataset?.key : undefined;
  root.className = `rf-board${small ? ' small' : ''}${live ? ' live' : ''}`;
  const lane = lanes ? LANE : 0;
  const width = w * UNIT + lane;
  const height = h * UNIT + lane;
  root.style.setProperty('--w', String(w + (lanes ? 0.92 : 0)));
  root.style.setProperty('--h', String(h + (lanes ? 0.92 : 0)));

  const svg = make('svg', { viewBox: `${-EDGE} ${-lane - EDGE} ${width + 2 * EDGE} ${height + 2 * EDGE}`, preserveAspectRatio: 'xMidYMid meet' }, 'rf-svg');
  if (live && view.labels) {
    svg.setAttribute('role', 'group');
    svg.setAttribute('aria-label', view.labels.board);
  } else svg.setAttribute('aria-hidden', 'true');

  const turning = new Set(changed);
  const marked = new Set(marks);
  for (let cell = 0; cell < w * h; cell++) {
    const x = (cell % w) * UNIT;
    const y = Math.floor(cell / w) * UNIT;
    const black = cells[cell] === 1;
    const group = make('g', { 'data-cell': cell, 'data-key': `cell-${cell}` }, `rf-cell-group${turning.has(cell) ? ' rf-turn' : ''}`);
    group.append(make('rect', { x, y, width: UNIT, height: UNIT }, black ? 'rf-cell black' : 'rf-cell'));
    if (black) group.append(make('circle', { cx: x + UNIT / 2, cy: y + UNIT / 2, r: 13 }, 'rf-dot'));
    if (view.onCell) {
      group.setAttribute('tabindex', '0');
      group.setAttribute('role', 'button');
      group.setAttribute('aria-pressed', String(marked.has(cell) || pick === cell));
      if (view.labels) group.setAttribute('aria-label', view.labels.cell(cell, black));
    }
    svg.append(group);
  }
  // 판의 테두리
  svg.append(make('rect', { x: 0, y: 0, width: w * UNIT, height: h * UNIT }, 'rf-frame'));
  if (band) {
    const line = band[0];
    const at = Number(band.slice(1));
    const rect = line === 'r' ? { x: -4, y: at * UNIT + 6, width: w * UNIT + 8, height: UNIT - 12 } : { x: at * UNIT + 6, y: -4, width: UNIT - 12, height: h * UNIT + 8 };
    svg.append(make('rect', { ...rect, rx: 14 }, 'rf-band'));
  }
  for (const cell of marked) svg.append(make('rect', { x: (cell % w) * UNIT + 9, y: Math.floor(cell / w) * UNIT + 9, width: UNIT - 18, height: UNIT - 18, rx: 6 }, 'rf-mark'));
  if (pick !== null && !marked.has(pick)) svg.append(make('circle', { cx: (pick % w) * UNIT + UNIT / 2, cy: Math.floor(pick / w) * UNIT + UNIT / 2, r: 36 }, 'rf-pick'));

  // 뒤집기 단추: 세로줄은 판 위, 가로줄은 판 오른쪽. 그림에서는 뒤집을 줄에 점만 찍는다
  const lines = [...Array.from({ length: w }, (_, c) => `c${c}`), ...Array.from({ length: h }, (_, r) => `r${r}`)];
  for (const line of lanes ? lines : []) {
    const at = Number(line.slice(1));
    const across = line[0] === 'r';
    const cx = across ? w * UNIT + LANE / 2 : at * UNIT + UNIT / 2;
    const cy = across ? at * UNIT + UNIT / 2 : -LANE / 2;
    if (view.onLine) {
      const group = make('g', { 'data-line': line, 'data-key': line, tabindex: 0, role: 'button' }, 'rf-line');
      if (view.labels) group.setAttribute('aria-label', across ? view.labels.row(at) : view.labels.col(at));
      const hit = across ? { x: w * UNIT + 4, y: at * UNIT + 2, width: LANE - 4, height: UNIT - 4 } : { x: at * UNIT + 2, y: -LANE, width: UNIT - 4, height: LANE - 4 };
      group.append(make('rect', { ...hit, rx: 16 }, 'rf-line-hit'));
      group.append(make('circle', { cx, cy, r: 38 }, 'rf-line-btn'));
      group.append(arrow(cx, cy, across));
      svg.append(group);
    } else if (lineMarks.includes(line)) {
      svg.append(make('circle', { cx, cy, r: 22 }, 'rf-line-mark'));
    }
  }

  if (live) {
    const press = (target) => {
      if (target.dataset.line && view.onLine) view.onLine(target.dataset.line);
      else if (target.dataset.cell !== undefined && view.onCell) view.onCell(Number(target.dataset.cell));
    };
    svg.addEventListener('click', (event) => {
      const target = event.target.closest?.('[data-line], [data-cell]');
      if (target) press(target);
    });
    // 글자판으로도 누를 수 있다.
    svg.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const target = event.target.closest?.('[data-line], [data-cell]');
      if (!target) return;
      event.preventDefault();
      press(target);
    });
  }
  root.replaceChildren(svg);
  if (focused !== undefined) svg.querySelector(`[data-key="${focused}"]`)?.focus?.();
}

/**
 * 판 하나를 담은 새 조각을 만든다(풀이, "왜 그럴까?", 직접 만들기의 그림). 아래에 한 줄 글을 붙일 수 있다.
 * 크기: 보통은 판 위의 종이에 한 줄에 석 장(여섯 장까지 두 줄), mid는 두 장, big은 한 장이 들어간다.
 */
export function boardCard(view, note, { big = false, mid = false } = {}) {
  const card = el('div', big ? 'rf-card big' : mid ? 'rf-card mid' : 'rf-card');
  const picture = el('div');
  card.append(picture);
  drawBoard(picture, { ...view, small: true });
  if (note) card.append(el('p', 'strip-note', note));
  return card;
}
