// 컵 뒤집기와 세 색 무리의 판을 그린다: 한 줄로 놓인 컵들, 또는 여러 줄로 놓인 방울이들.
// 누를 수 있는 판과 보기만 하는 그림(처음 화면, 공책, 풀이, "왜 그럴까?")을 같은 모양으로 그린다.
// 색만으로 알리지 않는다. 컵은 모양으로(바로 선 컵은 입구가 위로 보이고, 엎어진 컵은 바닥이 위에 있다),
// 방울이는 머리 모양으로(빨강은 뾰족한 귀, 파랑은 둥근 귀, 노랑은 더듬이 하나) 가른다.
// 글자는 형식(src/formats/cups.js)이 대본에서 채워 건넨다. 이 파일에는 글을 적지 않는다.

const NS = 'http://www.w3.org/2000/svg';

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

/** 컵 그림 하나. 바로 선 컵을 그리고, 엎어진 컵은 위아래를 뒤집는다 */
export function cupArt(down) {
  const svg = make('svg', { viewBox: '0 0 100 110', 'aria-hidden': 'true' }, `cup-art${down ? ' down' : ''}`);
  const body = make('g', down ? { transform: 'rotate(180 50 55)' } : {});
  body.append(
    make('path', { d: 'M 74 40 q 22 2 20 22 q -2 18 -22 16' }, 'cup-handle'),
    make('path', { d: 'M 12 20 L 88 20 L 76 98 L 24 98 Z' }, 'cup-body'),
    make('path', { d: 'M 18 58 L 82 58' }, 'cup-band'),
    // 입구: 바로 선 컵은 위에서 안쪽이 보인다
    make('ellipse', { cx: 50, cy: 20, rx: 38, ry: 9 }, 'cup-mouth'),
    make('ellipse', { cx: 50, cy: 98, rx: 26, ry: 5 }, 'cup-foot'),
  );
  svg.append(body);
  return svg;
}

const circle = (cx, cy, r, cls) => make('circle', { cx, cy, r }, cls);

/** 방울이 그림 하나. color는 0(빨강), 1(파랑), 2(노랑)이다 */
export function folkArt(color) {
  const svg = make('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true' }, `folk-art folk-${color}`);
  const parts = [];
  if (color === 0) parts.push(make('polygon', { points: '18,40 24,6 44,26' }, 'folk-body'), make('polygon', { points: '82,40 76,6 56,26' }, 'folk-body'));
  if (color === 1) parts.push(circle(24, 24, 14, 'folk-body'), circle(76, 24, 14, 'folk-body'));
  if (color === 2) parts.push(make('path', { d: 'M 50 26 L 50 8' }, 'folk-line'), circle(50, 8, 7, 'folk-body'));
  parts.push(
    circle(50, 58, 38, 'folk-body'),
    circle(37, 52, 7, 'folk-white'),
    circle(63, 52, 7, 'folk-white'),
    circle(38, 53, 3.5, 'folk-ink'),
    circle(64, 53, 3.5, 'folk-ink'),
    make('path', { d: 'M 40 72 Q 50 80 60 72' }, 'folk-line'),
  );
  svg.append(...parts);
  return svg;
}

/**
 * 컵이나 방울이들을 그린다.
 * @param {HTMLElement} root 그릴 자리(안의 것을 모두 바꾼다)
 * @param {object} view
 *   kind      'cups' | 'colors'
 *   items     컵은 1(엎어짐)과 0(바로 섬), 방울이는 색(0, 1, 2)의 배열
 *   label     (번호, 값) → 읽어 줄 이름(누를 수 있는 판에서만)
 *   onTap     (번호) → 눌렀을 때. 없으면 그림으로만 그린다
 *   selected  고른 것들의 번호
 *   changed   방금 바뀐 것들의 번호(뒤집히거나 색이 바뀌는 움직임을 보여 준다)
 *   mark      눈에 띄게 할 번호들(그림용)
 *   small     작은 그림으로 그린다
 */
export function drawItems(root, view) {
  const { kind, items, label, onTap, selected = [], changed = [], mark = [], small = false } = view;
  const n = items.length;
  // 방울이는 한 줄에 여섯까지 놓는다. 컵과 작은 그림은 한 줄이다.
  const cols = kind === 'cups' || small ? n : Math.min(n, 6);
  root.className = `cups-board ${kind}${small ? ' small' : ''}${onTap ? ' live' : ''}`;
  root.style.setProperty('--cols', String(Math.max(cols, 1)));
  const nodes = items.map((value, index) => {
    const node = el(onTap ? 'button' : 'div', kind === 'cups' ? `cup${value ? ' down' : ''}` : `folk folk-${value}`);
    node.append(kind === 'cups' ? cupArt(value === 1) : folkArt(value));
    if (selected.includes(index)) node.classList.add('selected');
    if (changed.includes(index)) node.classList.add('changed');
    if (mark.includes(index)) node.classList.add('marked');
    if (onTap) {
      node.type = 'button';
      if (label) node.setAttribute('aria-label', label(index, value));
      node.setAttribute('aria-pressed', String(selected.includes(index)));
      node.addEventListener('click', () => onTap(index));
    }
    return node;
  });
  root.replaceChildren(...nodes);
}

/**
 * 판 여러 개를 화살표로 이어서 그린다(풀이와 "왜 그럴까?"의 그림).
 * @param {{kind: string, steps: number[][], marks?: number[][], captions?: string[], note?: string}} strip
 */
export function itemsStrip(strip) {
  const box = el('div', 'strip cups-strip');
  const row = el('div', 'strip-row');
  strip.steps.forEach((items, index) => {
    if (index > 0) row.append(el('span', 'strip-arrow', '→'));
    const cell = el('div', 'strip-cell');
    const picture = el('div');
    drawItems(picture, { kind: strip.kind, items, mark: strip.marks?.[index] ?? [], small: true });
    cell.append(picture);
    if (strip.captions?.[index]) cell.append(el('span', 'strip-caption', strip.captions[index]));
    row.append(cell);
  });
  box.append(row);
  if (strip.note) box.append(el('p', 'strip-note', strip.note));
  return box;
}
