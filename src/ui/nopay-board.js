// 낼 수 없는 금액의 그림을 그린다: 동전(누르면 담긴다), 담은 동전, 금액 띠, 종이의 그림(띠와 표).
// 누를 수 있는 판과 보기만 하는 그림을 같은 모양으로 그린다. 글자는 대본에서 받는다(이 파일에는 글을 적지 않는다).
// 색만으로 알리지 않는다.
//   동전: 테두리가 두 겹인 동그라미에 값과 '원'(대본의 글자)을 적는다. 누르는 동전은 1180×820 화면에서 지름 72픽셀이다.
//   담은 동전: 동전 가지마다 작은 동전과 '×개수'를 적은 단추(높이 52픽셀). 누르면 그 동전이 하나 빠진다.
//   띠: 칸마다 금액. 칠한 금액(낼 수 있다)은 금빛 바탕에 동전 고리, 못 낸다고 고른 금액은 굵은 테두리와 빗금,
//     선생님이 짚은 금액과 종이의 잇달아 낸 금액은 점선 고리다. 보통은 한 줄에 여덟 칸이고, 줄로 나눠 놓으면 가로줄이 가장 작은 동전의 값만큼이다
//     (1, 2, 3이 첫 세로줄, 4, 5, 6이 둘째 세로줄. 가로줄마다 작은 동전만큼씩 커진다).

const NS = 'http://www.w3.org/2000/svg';
/** 띠 한 줄의 칸 수(줄 맞추기를 켜지 않았을 때) */
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

/** 동전 그림 하나(값과 '원') */
export function coinPicture(value, won) {
  const svg = make('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true' }, 'np-coin-svg');
  svg.append(make('circle', { cx: 50, cy: 50, r: 46 }, 'np-coin-rim'));
  svg.append(make('circle', { cx: 50, cy: 50, r: 36 }, 'np-coin-face'));
  const number = make('text', { x: 50, y: won ? 56 : 62, 'text-anchor': 'middle' }, 'np-coin-value');
  number.textContent = String(value);
  svg.append(number);
  if (won) {
    const unit = make('text', { x: 50, y: 78, 'text-anchor': 'middle' }, 'np-coin-unit');
    unit.textContent = won;
    svg.append(unit);
  }
  return svg;
}

/**
 * 동전들을 그린다.
 * @param {object} view
 *   coins     동전 값들(작은 것부터)
 *   won       '원'(대본의 글자)
 *   label     (동전 값) → 읽어 줄 이름
 *   onCoin    (동전 번호) → 동전을 눌렀을 때. 없으면 누를 수 없다
 *   disabled  (동전 번호) → 지금 누를 수 없는가
 *   small     작은 그림으로 그린다
 */
export function drawCoins(root, view) {
  const { coins, won, small = false } = view;
  const live = Boolean(view.onCoin);
  const row = el('div', `np-coins${small ? ' small' : ''}`);
  coins.forEach((value, at) => {
    const coin = el(live ? 'button' : 'span', 'np-coin');
    coin.append(coinPicture(value, won));
    if (live) {
      coin.type = 'button';
      coin.dataset.at = String(at);
      coin.disabled = view.disabled?.(at) ?? false;
      if (view.label) coin.setAttribute('aria-label', view.label(value));
    }
    row.append(coin);
  });
  if (live) {
    row.addEventListener('click', (event) => {
      const target = event.target.closest?.('button[data-at]');
      if (target && !target.disabled) view.onCoin(Number(target.dataset.at));
    });
  }
  root.replaceChildren(row);
}

/**
 * 담은 동전을 그린다: 동전 가지마다 작은 동전과 '×개수'.
 * @param {object} view
 *   coins   동전 값들
 *   tray    동전마다 담은 수
 *   won     '원'
 *   label   (동전 값, 수) → 읽어 줄 이름
 *   onTake  (동전 번호) → 눌렀을 때(하나 뺀다). 없으면 누를 수 없다
 */
export function drawTray(root, view) {
  const { coins, tray } = view;
  const live = Boolean(view.onTake);
  const focused = root.contains(document.activeElement) ? document.activeElement.dataset?.at : undefined;
  const chips = [];
  coins.forEach((value, at) => {
    if (tray[at] === 0) return;
    const chip = el(live ? 'button' : 'span', 'np-chip');
    chip.append(coinPicture(value, ''), el('span', 'np-chip-count', `×${tray[at]}`));
    if (live) {
      chip.type = 'button';
      chip.dataset.at = String(at);
      if (view.label) chip.setAttribute('aria-label', view.label(value, tray[at]));
      chip.addEventListener('click', () => view.onTake(at));
    }
    chips.push(chip);
  });
  root.replaceChildren(...chips);
  if (focused !== undefined) root.querySelector(`[data-at="${focused}"]`)?.focus?.();
}

/**
 * 금액 띠를 그린다(1원부터 top원까지).
 * @param {object} view
 *   top      띠의 끝 금액
 *   rows     줄로 나눠 놓을 때 가로줄의 수(가장 작은 동전의 값). 없으면 한 줄에 여덟 칸
 *   paid     칠한 금액들(금빛 바탕과 동전 고리)
 *   marked   못 낸다고 고른 금액들(굵은 테두리와 빗금)
 *   pointed  선생님이 짚은 금액(점선 고리) 또는 null
 *   run      점선 고리를 두를 금액들(종이의 그림)
 *   label    (금액, 칠했는가, 골랐는가) → 읽어 줄 이름(줄로 나눠 놓아도 읽는 차례는 1원부터다)
 *   stripLabel  띠 전체의 이름
 *   onCell   (금액) → 칸을 눌렀을 때. 없으면 누를 수 없다
 *   small    작은 그림으로 그린다
 */
export function drawStrip(root, view) {
  const { top, rows = null, paid = [], marked = [], pointed = null, run = [], small = false } = view;
  const live = Boolean(view.onCell);
  const focused = root.contains(document.activeElement) ? document.activeElement.dataset?.no : undefined;
  const strip = el('div', `np-strip${rows ? ' by-rows' : ''}${small ? ' small' : ''}${live ? ' live' : ''}`);
  strip.style.setProperty('--cols', String(rows ? Math.ceil(top / rows) : Math.min(STRIP_COLS, top)));
  if (rows) strip.style.setProperty('--rows', String(Math.min(rows, top)));
  if (view.stripLabel) {
    strip.setAttribute('role', 'group');
    strip.setAttribute('aria-label', view.stripLabel);
  }
  const coloured = new Set(paid);
  const picked = new Set(marked);
  const ringed = new Set(run);
  for (let no = 1; no <= top; no++) {
    const classes = ['np-cell', coloured.has(no) ? 'paid' : '', picked.has(no) ? 'marked' : '', pointed === no || ringed.has(no) ? 'pointed' : ''].filter(Boolean).join(' ');
    const cell = el(live ? 'button' : 'span', classes);
    cell.dataset.no = String(no);
    cell.append(el('span', 'np-cell-no', String(no)));
    if (live) {
      cell.type = 'button';
      cell.setAttribute('aria-pressed', String(picked.has(no)));
      if (view.label) cell.setAttribute('aria-label', view.label(no, coloured.has(no), picked.has(no)));
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

/** 처음 화면과 공책의 작은 그림: 동전과 띠 */
export function drawSample(root, view) {
  const box = el('div', 'np-sample');
  const coins = el('div');
  drawCoins(coins, { coins: view.coins, won: '', small: true });
  const strip = el('div');
  drawStrip(strip, { top: view.top, paid: view.paid, marked: view.marked, small: true });
  box.append(coins, strip);
  root.replaceChildren(box);
}

/** 종이 한 장의 그림 하나. 아래에 한 줄 글을 붙인다 */
function cardOf(draw, note, big) {
  const card = el('div', big ? 'np-card big' : 'np-card');
  const picture = el('div', 'np-card-picture');
  draw(picture);
  card.append(picture);
  if (note) card.append(el('p', 'strip-note', note));
  return card;
}

/** 띠 그림 하나: { coins, won, top, rows, paid, marked, run } */
export function stripCard(view, note, { big = false } = {}) {
  return cardOf(
    (picture) => {
      const coins = el('div');
      drawCoins(coins, { coins: view.coins, won: view.won, small: true });
      const strip = el('div');
      drawStrip(strip, { ...view, small: !big });
      picture.append(coins, strip);
    },
    note,
    big,
  );
}

/** 표 그림 하나: heads는 머리 칸의 글, rows는 줄마다 칸의 글 */
export function tableCard(heads, rows, note) {
  return cardOf(
    (picture) => {
      const table = el('table', 'np-table');
      const head = el('tr');
      for (const text of heads) head.append(el('th', '', text));
      table.append(head);
      for (const row of rows) {
        const line = el('tr');
        for (const text of row) line.append(el('td', '', text));
        table.append(line);
      }
      picture.append(table);
    },
    note,
    true,
  );
}
