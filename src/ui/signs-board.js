// 부호 넣어 수 만들기의 그림을 그린다: 수의 줄(부호 칸), 모두 찾기의 띠, 메뚜기의 수직선, 종이의 그림.
// 누를 수 있는 판과 보기만 하는 그림을 같은 모양으로 그린다. 글자는 대본에서 받는다(이 파일에는 글을 적지 않는다).
// 색만으로 알리지 않는다.
//   줄: 수는 둥근 네모, 부호 칸은 단추(1180×820 화면에서 가로 52픽셀, 세로 64픽셀)다. − 부호 칸은 굵은 테두리와 빗금 바탕이다.
//     부호 칸과 그 뒤의 수를 한 덩이로 묶어서, 줄이 길면 덩이째 다음 줄로 넘어간다. 맨 끝에 "= 나온 수"를 적는다.
//   띠: 칸마다 수(한 줄에 여덟 칸). 고른 수는 굵은 테두리와 빗금, 위의 줄에서 나온 수는 수 아래에 점, 선생님이 짚은 수는 점선 고리다.
//   수직선: 칸마다 눈금, 0은 굵은 눈금, 닿을 곳은 깃발이다. 뛴 걸음은 수직선 위의 굽은 선이고(오른쪽은 실선, 왼쪽은 점선), 메뚜기는 큰 동그라미다.

const NS = 'http://www.w3.org/2000/svg';
/** 수직선 한 칸의 가로: 수직선이 길면 좁게(그림 전체가 가로 900쯤이 되게) */
const unitOf = (reach) => Math.min(40, Math.max(16, Math.floor(900 / (2 * reach))));
/** 띠 한 줄의 칸 수 */
export const STRIP_COLS = 8;

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

/** 수를 적는다. 0보다 작은 수는 앞에 − 를 붙인다 */
export const signed = (value) => (value < 0 ? `−${-value}` : String(value));

/**
 * 수의 줄을 그린다.
 * @param {HTMLElement} root 그릴 자리(안의 것을 모두 바꾼다)
 * @param {object} view
 *   numbers  줄의 수들(맨 앞의 수 앞에는 부호가 없다)
 *   signs    부호들('+' 또는 '-'). numbers보다 하나 적다
 *   result   맨 끝에 적을 나온 수(null이면 적지 않는다)
 *   faces    { plus, minus } 부호의 글자
 *   label    { slot(부호 칸 번호, 부호) → 읽어 줄 이름, result(나온 수) → 읽어 줄 이름 }
 *   onSlot   (부호 칸 번호) → 부호 칸을 눌렀을 때. 없으면 누를 수 없다
 *   changed  방금 바꾼 부호 칸 번호(굵은 밑줄)
 *   small    작은 그림으로 그린다
 */
export function drawRow(root, view) {
  const { numbers, signs, result = null, faces, small = false, changed = null } = view;
  const live = Boolean(view.onSlot);
  const focused = root.contains(document.activeElement) ? document.activeElement.dataset?.at : undefined;
  const row = el('div', `sg-row${small ? ' small' : ''}${live ? ' live' : ''}`);
  // 작은 그림은 그리는 자리의 가로를 크기 기준(.sg-fit)으로 삼아 칸 크기를 정한다(src/app.css의 --u)
  row.style.setProperty('--n', String(numbers.length));
  row.append(el('span', 'sg-num', String(numbers[0])));
  for (let at = 0; at < signs.length; at++) {
    const pair = el('span', 'sg-pair');
    const minus = signs[at] === '-';
    const face = minus ? faces.minus : faces.plus;
    const slot = live ? el('button', `sg-slot${minus ? ' minus' : ''}${changed === at ? ' changed' : ''}`, face) : el('span', `sg-slot${minus ? ' minus' : ''}`, face);
    slot.dataset.at = String(at);
    if (live) {
      slot.type = 'button';
      if (view.label) slot.setAttribute('aria-label', view.label.slot(at, signs[at]));
    }
    pair.append(slot, el('span', 'sg-num', String(numbers[at + 1])));
    row.append(pair);
  }
  if (result !== null) {
    const end = el('span', 'sg-eq');
    end.append(el('span', 'sg-eq-mark', '='), el('strong', 'sg-result', signed(result)));
    if (view.label) end.setAttribute('aria-label', view.label.result(result));
    row.append(end);
  }
  if (live) {
    row.addEventListener('click', (event) => {
      const target = event.target.closest?.('button[data-at]');
      if (target) view.onSlot(Number(target.dataset.at));
    });
  }
  if (small) {
    const fit = el('div', 'sg-fit');
    fit.style.setProperty('--n', String(numbers.length));
    fit.append(row);
    root.replaceChildren(fit);
  } else root.replaceChildren(row);
  if (focused !== undefined) row.querySelector(`[data-at="${focused}"]`)?.focus?.();
}

/**
 * 모두 찾기의 띠를 그린다(1부터 top까지).
 * @param {object} view
 *   top      띠의 끝 수
 *   marked   고른 수들(굵은 테두리와 빗금)
 *   made     위의 줄에서 나온 수들(점)
 *   pointed  선생님이 짚은 수(점선 고리) 또는 null
 *   label    (수, 고른 수인가, 나온 수인가) → 읽어 줄 이름
 *   onCell   (수) → 칸을 눌렀을 때. 없으면 누를 수 없다
 *   small    작은 그림으로 그린다
 */
export function drawStrip(root, view) {
  const { top, marked = [], made = [], pointed = null, small = false } = view;
  const live = Boolean(view.onCell);
  const focused = root.contains(document.activeElement) ? document.activeElement.dataset?.no : undefined;
  const strip = el('div', `sg-strip${small ? ' small' : ''}${live ? ' live' : ''}`);
  strip.style.setProperty('--cols', String(Math.min(STRIP_COLS, top)));
  const picked = new Set(marked);
  const seen = new Set(made);
  for (let no = 1; no <= top; no++) {
    const classes = ['sg-cell', picked.has(no) ? 'marked' : '', seen.has(no) ? 'made' : '', pointed === no ? 'pointed' : ''].filter(Boolean).join(' ');
    const cell = el(live ? 'button' : 'span', classes);
    cell.dataset.no = String(no);
    cell.append(el('span', 'sg-cell-no', String(no)));
    if (seen.has(no)) cell.append(el('span', 'sg-dot'));
    if (live) {
      cell.type = 'button';
      cell.setAttribute('aria-pressed', String(picked.has(no)));
      if (view.label) cell.setAttribute('aria-label', view.label(no, picked.has(no), seen.has(no)));
    }
    strip.append(cell);
  }
  if (live) {
    strip.addEventListener('click', (event) => {
      const target = event.target.closest?.('button[data-no]');
      if (target) view.onCell(Number(target.dataset.no));
    });
  }
  root.replaceChildren(strip);
  if (focused !== undefined) strip.querySelector(`[data-no="${focused}"]`)?.focus?.();
}

/**
 * 메뚜기의 수직선을 그린다(−total부터 total까지).
 * @param {object} view
 *   n       뛰는 횟수(수직선의 끝은 1 + 2 + … + n)
 *   target  닿을 곳(깃발)
 *   dirs    지금까지 뛴 방향들(1은 오른쪽, -1은 왼쪽)
 *   label   읽어 줄 이름(메뚜기가 있는 곳)
 *   small   작은 그림으로 그린다
 */
export function drawLine(root, view) {
  const { n, target, dirs = [], small = false } = view;
  const total = (n * (n + 1)) / 2;
  const reach = Math.max(total, Math.abs(target));
  const unit = unitOf(reach);
  const x = (value) => (value + reach) * unit;
  const width = 2 * reach * unit;
  const base = 150;
  const svg = make('svg', { viewBox: `-30 0 ${width + 60} ${base + 60}`, preserveAspectRatio: 'xMidYMid meet' }, 'sg-line-svg');
  if (view.label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', view.label);
  } else svg.setAttribute('aria-hidden', 'true');
  svg.append(make('line', { x1: 0, y1: base, x2: width, y2: base }, 'sg-axis'));
  // 눈금: 칸마다. 0과 5의 배수, 닿을 곳에는 수를 적는다(수직선이 짧으면 모두)
  const every = reach <= 10 ? 1 : 5;
  for (let value = -reach; value <= reach; value++) {
    const zero = value === 0;
    svg.append(make('line', { x1: x(value), y1: base - (zero ? 16 : 8), x2: x(value), y2: base + (zero ? 16 : 8) }, zero ? 'sg-tick zero' : 'sg-tick'));
    if (value % every === 0 || value === target) {
      const text = make('text', { x: x(value), y: base + 44, 'text-anchor': 'middle' }, zero ? 'sg-tick-no zero' : 'sg-tick-no');
      text.textContent = signed(value);
      svg.append(text);
    }
  }
  // 닿을 곳: 깃발
  svg.append(make('line', { x1: x(target), y1: base, x2: x(target), y2: base - 58 }, 'sg-pole'));
  svg.append(make('path', { d: `M${x(target)},${base - 58} l30,10 l-30,10 z` }, 'sg-flag'));
  // 뛴 걸음: 굽은 선. 멀리 뛸수록 높이 굽는다(그림 안에서)
  let at = 0;
  dirs.forEach((dir, index) => {
    const to = at + dir * (index + 1);
    const lift = Math.min(130, 16 + (index + 1) * 16);
    const [x1, x2] = [x(at), x(to)];
    svg.append(make('path', { d: `M${x1},${base - 4} Q${(x1 + x2) / 2},${base - 4 - 2 * lift} ${x2},${base - 4}` }, dir > 0 ? 'sg-hop' : 'sg-hop left'));
    at = to;
  });
  // 메뚜기: 지금 있는 곳의 큰 동그라미
  svg.append(make('circle', { cx: x(at), cy: base - 20, r: 15 }, 'sg-hopper'));
  svg.append(make('circle', { cx: x(at) + 6, cy: base - 24, r: 3 }, 'sg-hopper-eye'));
  root.className = `sg-line${small ? ' small' : ''}`;
  root.replaceChildren(svg);
}

/** 판 하나를 담은 새 조각(종이의 그림). 아래에 한 줄 글을 붙인다 */
function cardOf(draw, note, big) {
  const card = el('div', big ? 'sg-card big' : 'sg-card');
  const picture = el('div', 'sg-card-picture');
  draw(picture);
  card.append(picture);
  if (note) card.append(el('p', 'strip-note', note));
  return card;
}

/** 수의 줄 그림 하나: { numbers, signs, result } */
export function rowCard(view, faces, note, { big = false } = {}) {
  return cardOf((picture) => drawRow(picture, { ...view, faces, small: !big }), note, big);
}

/** 수직선 그림 하나: { n, target, dirs } */
export function lineCard(view, note, { big = false } = {}) {
  return cardOf((picture) => drawLine(picture, { ...view, small: !big }), note, big);
}

/** 띠 그림 하나: { top, marked, made } */
export function stripCard(view, note, { big = false } = {}) {
  return cardOf((picture) => drawStrip(picture, { ...view, small: !big }), note, big);
}
