// 눈금이 가장 적은 자의 판을 그린다: 자(자리마다 누르는 칸), 길이 칸(1부터 자의 길이까지), 이어지는 자의 이름표.
// 누를 수 있는 판은 자리마다, 길이마다 단추 하나다. 자가 길면 자를 여러 줄로 나눠 놓는다(한 줄에 자리 아홉까지. 1180×820 화면에서 한 자리가 44픽셀보다 넓다).
// 보기만 하는 그림(처음 화면, 공책, 판 고르기, 풀이, "왜 그럴까?", 직접 만들기의 그림)은 SVG로 그린다.
// 색만으로 알리지 않는다. 찍은 눈금은 굵은 세로줄과 세모, 처음부터 있는 눈금은 검은 세모와 빗금 칸, 짚은 두 눈금은 점선 고리다.
// 길이 칸은 잴 수 있으면 채운 칸에 굵은 테두리, 아직 못 재면 점선 테두리, 두 번 이상 재면 겹 테두리와 빗금이다.
// 글자는 형식(src/formats/ruler.js)이 대본에서 채워 건넨다. 이 파일에는 글을 적지 않는다.

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

/** 자를 몇 줄로 놓는가: 한 줄에 자리 PER_ROW개까지 */
export const PER_ROW = 9;
/** 길이 칸: 한 줄에 열 칸까지 */
export const LENGTHS_PER_ROW = 10;

/** 자리 count개를 rows줄로 고르게 나눈 줄마다의 자리 수 */
export function rowsOf(count, per = PER_ROW) {
  const rows = Math.max(1, Math.ceil(count / per));
  const each = Math.ceil(count / rows);
  const sizes = [];
  let left = count;
  for (let row = 0; row < rows; row++) {
    sizes.push(Math.min(each, left));
    left -= each;
  }
  return sizes;
}

/** 다시 그린 뒤에도 누르고 있던 단추에 머문다 */
function keepFocus(root, draw) {
  const focused = root.contains(document.activeElement) ? document.activeElement.dataset?.key : undefined;
  draw();
  if (focused !== undefined) root.querySelector(`[data-key="${focused}"]`)?.focus?.();
}

/**
 * 자를 그린다(판 화면). 자리 0부터 span까지 한 칸씩, 여러 줄이면 줄마다 이어서.
 * @param {HTMLElement} root 그릴 자리
 * @param {object} view
 *   span   자의 길이
 *   marks  찍은 눈금의 자리들
 *   fixed  처음부터 있어 뺄 수 없는 눈금의 자리들
 *   ring   점선 고리로 짚을 두 눈금 [a, b](없으면 null)
 *   onTap  (자리) → 눌렀을 때. 없으면 누를 수 없다
 *   labels { ruler, position(자리, 찍혔나, 처음부터인가) } 읽어 줄 이름
 */
export function drawRuler(root, view) {
  const { span, marks, fixed = [], ring = null, onTap, labels } = view;
  keepFocus(root, () => {
    root.className = `rl-ruler${onTap ? '' : ' still'}`;
    const sizes = rowsOf(span + 1);
    root.style.setProperty('--per', String(Math.max(...sizes)));
    root.style.setProperty('--rows', String(sizes.length));
    root.dataset.rows = String(sizes.length);
    root.setAttribute('role', 'group');
    if (labels?.ruler) root.setAttribute('aria-label', labels.ruler);
    const marked = new Set(marks);
    const pinned = new Set(fixed);
    const ringed = new Set(ring ?? []);
    const rows = [];
    let x = 0;
    for (const size of sizes) {
      const row = el('div', 'rl-row');
      for (let i = 0; i < size; i++, x++) {
        const at = x;
        const cell = el(onTap ? 'button' : 'span', 'rl-pos');
        if (marked.has(at)) cell.classList.add('marked');
        if (pinned.has(at)) cell.classList.add('fixed');
        if (ringed.has(at)) cell.classList.add('ringed');
        if (at === 0) cell.classList.add('start');
        if (at === span) cell.classList.add('end');
        cell.dataset.key = String(at);
        cell.append(el('span', 'rl-tick'), el('span', 'rl-num', String(at)));
        if (labels?.position) cell.setAttribute('aria-label', labels.position(at, marked.has(at), pinned.has(at)));
        if (onTap) {
          cell.type = 'button';
          cell.setAttribute('aria-pressed', String(marked.has(at)));
          cell.addEventListener('click', () => onTap(at));
        }
        row.append(cell);
      }
      rows.push(row);
    }
    root.replaceChildren(...rows);
  });
}

/**
 * 길이 칸: 1부터 top까지. 잴 수 있는 길이는 채운 칸이다.
 *   counts   길이마다 재는 짝의 수(Map)
 *   extra    (길이, 짝의 수) → 칸 아래에 적을 글(없으면 빈 글)
 *   twice    두 번 이상 재는 길이를 겹 테두리로 보이는가
 *   selected 짚은 길이(없으면 null)
 *   onTap    (길이) → 눌렀을 때
 *   labels   { strip, length(길이, 짝의 수) }
 */
export function drawLengths(root, view) {
  const { top, counts, extra, twice = false, selected = null, onTap, labels } = view;
  keepFocus(root, () => {
    root.className = 'rl-lengths';
    const sizes = rowsOf(top, LENGTHS_PER_ROW);
    root.style.setProperty('--per', String(Math.max(...sizes)));
    root.setAttribute('role', 'group');
    if (labels?.strip) root.setAttribute('aria-label', labels.strip);
    const rows = [];
    let d = 1;
    for (const size of sizes) {
      const row = el('div', 'rl-len-row');
      for (let i = 0; i < size; i++, d++) {
        const length = d;
        const many = counts.get(length) ?? 0;
        const cell = el(onTap ? 'button' : 'span', 'rl-len');
        if (many > 0) cell.classList.add('lit');
        if (twice && many > 1) cell.classList.add('twice');
        if (selected === length) cell.classList.add('picked');
        cell.dataset.key = `d${length}`;
        cell.append(el('span', 'rl-len-num', String(length)), el('span', 'rl-len-extra', extra ? extra(length, many) : ''));
        if (labels?.length) cell.setAttribute('aria-label', labels.length(length, many));
        if (onTap) {
          cell.type = 'button';
          cell.addEventListener('click', () => onTap(length));
        }
        row.append(cell);
      }
      rows.push(row);
    }
    root.replaceChildren(...rows);
  });
}

/**
 * 이어지는 자의 이름표: 자마다 하나. 다 만든 자(done), 열린 자(open), 아직 닫힌 자(locked). 지금 만드는 자는 굵은 테두리다.
 *   tabs   [{ state, current, title, note, label }]
 *   onTab  (차례) → 열린 자의 이름표를 눌렀을 때
 */
export function drawTabs(root, { tabs, onTab, label }) {
  keepFocus(root, () => {
    root.className = 'rl-tabs';
    root.setAttribute('role', 'group');
    if (label) root.setAttribute('aria-label', label);
    root.replaceChildren(
      ...tabs.map((tab, index) => {
        const open = tab.state === 'open' && onTab;
        const node = el(open ? 'button' : 'span', `rl-tab ${tab.state}${tab.current ? ' current' : ''}`);
        node.dataset.key = `t${index}`;
        node.append(el('strong', 'rl-tab-title', tab.title), el('span', 'rl-tab-note', tab.note));
        if (tab.label) node.setAttribute('aria-label', tab.label);
        if (open) {
          node.type = 'button';
          node.setAttribute('aria-pressed', String(Boolean(tab.current)));
          node.addEventListener('click', () => onTab(index));
        }
        return node;
      }),
    );
  });
}

// ---- 그림(SVG) ----

const UNIT = 40; // 한 칸
const SIDE = 24; // 자 양 끝의 여백
const BODY = 46; // 자 몸의 높이

/**
 * 자 그림 하나. 눈금마다 굵은 세로줄과 위의 세모, 눈금이 있는 자리의 수.
 *   span   자의 길이
 *   marks  눈금의 자리들
 *   ring   점선 고리로 짚을 두 눈금(없으면 null). 두 눈금 사이를 위에 굵은 줄로 잇는다
 *   numbers 'marks'(눈금의 자리만) | 'all'(모든 자리) | 'none'
 */
export function rulerSvg({ span, marks, ring = null, numbers = 'marks' }) {
  const width = 2 * SIDE + span * UNIT;
  const top = ring ? 34 : 18;
  const height = top + BODY + (numbers === 'none' ? 10 : 40);
  const svg = make('svg', { viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: 'xMidYMid meet' }, 'rl-svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.append(make('rect', { x: 2, y: top, width: width - 4, height: BODY, rx: 6 }, 'rl-art-body'));
  const set = new Set(marks);
  for (let at = 0; at <= span; at++) {
    const x = SIDE + at * UNIT;
    const on = set.has(at);
    svg.append(make('line', { x1: x, y1: top, x2: x, y2: top + (on ? BODY : BODY * 0.32) }, on ? 'rl-art-mark' : 'rl-art-tick'));
    if (on) svg.append(make('path', { d: `M${x - 11},${top - 1}L${x + 11},${top - 1}L${x},${top + 16}Z` }, 'rl-art-notch'));
    if (numbers === 'all' || (numbers === 'marks' && on)) {
      const text = make('text', { x, y: top + BODY + 30, 'text-anchor': 'middle', 'font-size': 26 }, on ? 'rl-art-number on' : 'rl-art-number');
      text.textContent = String(at);
      svg.append(text);
    }
  }
  if (ring) {
    const [a, b] = ring;
    for (const at of ring) svg.append(make('circle', { cx: SIDE + at * UNIT, cy: top + BODY / 2, r: 15 }, 'rl-art-ring'));
    svg.append(make('path', { d: `M${SIDE + a * UNIT},${top - 4}L${SIDE + a * UNIT},${top - 22}L${SIDE + b * UNIT},${top - 22}L${SIDE + b * UNIT},${top - 4}` }, 'rl-art-span'));
  }
  return svg;
}

/** 작은 자(처음 화면, 공책, 판 고르기, 만들기 목록, 내 기록) */
export function drawMini(root, view) {
  root.className = 'rl-board small';
  root.replaceChildren(rulerSvg({ numbers: 'none', ...view }));
}

/** 그림 하나를 담은 새 조각(풀이, "왜 그럴까?", 직접 만들기의 그림). 아래에 한 줄 글을 붙일 수 있다. big은 한 장이 넓게 들어간다 */
export function rulerCard(view, note, { big = false } = {}) {
  const card = el('div', big ? 'rl-card big' : 'rl-card');
  card.append(rulerSvg(view));
  if (note) card.append(el('p', 'strip-note', note));
  return card;
}

/**
 * 길이 칸 그림(풀이와 "왜 그럴까?"): 1부터 top까지, 잴 수 있으면 채운 칸, 두 번 이상이면 겹 테두리, 칸 아래에 짝의 수.
 *   counts Map(길이 → 짝의 수), extra (길이, 짝의 수) → 칸 아래 글
 */
export function lengthsCard({ top, counts, extra }, note) {
  const card = el('div', 'rl-card big');
  const box = el('div', 'rl-lengths still');
  const sizes = rowsOf(top, LENGTHS_PER_ROW);
  box.style.setProperty('--per', String(Math.max(...sizes)));
  let d = 1;
  for (const size of sizes) {
    const row = el('div', 'rl-len-row');
    for (let i = 0; i < size; i++, d++) {
      const many = counts.get(d) ?? 0;
      const cell = el('span', `rl-len${many > 0 ? ' lit' : ''}${many > 1 ? ' twice' : ''}`);
      cell.append(el('span', 'rl-len-num', String(d)), el('span', 'rl-len-extra', extra ? extra(d, many) : ''));
      row.append(cell);
    }
    box.append(row);
  }
  card.append(box);
  if (note) card.append(el('p', 'strip-note', note));
  return card;
}

/** 표 그림("왜 그럴까?"): 줄마다 칸 두 개(왼쪽 이름, 오른쪽 값). 머리 줄이 있다 */
export function tableCard(head, rows, note) {
  const card = el('div', 'rl-card big');
  const table = el('table', 'rl-table');
  const headRow = el('tr');
  for (const text of head) headRow.append(el('th', '', text));
  const body = el('tbody');
  for (const row of rows) {
    const line = el('tr');
    for (const text of row) line.append(el('td', '', text));
    body.append(line);
  }
  const thead = el('thead');
  thead.append(headRow);
  table.append(thead, body);
  card.append(table);
  if (note) card.append(el('p', 'strip-note', note));
  return card;
}
