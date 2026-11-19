// 숨은 규칙 찾기의 판을 그린다: 수 판(1부터 top까지, 한 줄에 열 칸), 세 수 판(물어본 세 수를 돼요와 안 돼요 두 줄로), 세 수를 넣는 세 칸.
// 누를 수 있는 판과 보기만 하는 그림을 같은 모양으로 그린다.
// 색만으로 알리지 않는다. 돼요는 동그라미, 안 돼요는 빗금 한 줄, 갈라 볼 수는 점선 네모와 물음표,
// 숨은 규칙이 다르게 가른 것과 그림에서 가리키는 것은 두 겹 테두리, 방금 물어본 것은 굵은 테두리로 그린다.
// 글자는 대본에서 받는다(읽어 줄 이름, 두 줄의 머리글, 세 수를 잇는 글자).

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** 한 줄의 칸 수: 10까지는 다섯, 그 위는 열 */
const columnsOf = (top) => (top <= 10 ? 5 : 10);

/**
 * 수 판.
 * @param {HTMLElement} root
 * @param {object} view
 *   top      수의 범위의 위 끝
 *   marks    Map(수 → 'yes' | 'no'): 물어본(또는 처음 받은) 수의 답
 *   checks   Map(수 → 'yes' | 'no' | null): 갈라 보는 중인 수와 아이가 고른 것
 *   strong   Set(수): 두 겹 테두리(숨은 규칙이 다르게 가른 것, 그림에서 가리키는 것)
 *   fresh    방금 물어본 수(굵은 테두리) 또는 null
 *   ruleYes  Set(수): 직접 만들기에서 내 규칙으로 돼요인 수(옅은 동그라미)
 *   order    Map(수 → 차례): 직접 만들기에서 선생님이 물어본 차례(칸 위의 작은 수)
 *   small    작은 그림인가
 *   label    (수) → 읽어 줄 이름. 있으면 누를 수 있는 판이다
 *   onTap    (수) → 누를 때
 */
export function drawNumbers(root, view) {
  const live = typeof view.onTap === 'function';
  const board = el('div', `rh-board${view.small ? ' small' : ''}${live ? ' live' : ''}`);
  board.style.setProperty('--cols', String(columnsOf(view.top)));
  board.style.setProperty('--rows', String(Math.ceil(view.top / columnsOf(view.top))));
  for (let x = 1; x <= view.top; x++) {
    const cell = el(live ? 'button' : 'span', 'rh-cell');
    if (live) {
      cell.type = 'button';
      cell.setAttribute('aria-label', view.label(x));
      cell.addEventListener('click', () => view.onTap(x));
    }
    const mark = view.marks?.get(x);
    if (mark) cell.classList.add(mark);
    if (view.checks?.has(x)) {
      cell.classList.add('check');
      const pick = view.checks.get(x);
      if (pick) cell.classList.add(`pick-${pick}`);
    }
    if (view.ruleYes?.has(x) && !mark) cell.classList.add('rule');
    if (view.strong?.has(x)) cell.classList.add('strong');
    if (view.fresh === x) cell.classList.add('fresh');
    cell.append(el('span', 'rh-n', String(x)));
    if (view.order?.has(x)) cell.append(el('span', 'rh-order', String(view.order.get(x))));
    board.append(cell);
  }
  root.replaceChildren(board);
}

/**
 * 세 수 판: 물어본 세 수를 돼요 줄과 안 돼요 줄로 나눠 적는다(물어본 차례대로).
 * @param {object} view
 *   asked   [{ item: [a, b, c], yes }]
 *   strong  Set(세 수의 글자): 두 겹 테두리
 *   fresh   방금 물어본 세 수의 글자 또는 null
 *   heads   { yes, no } 두 줄의 머리글
 *   join    세 수를 잇는 글자
 *   small   작은 그림인가
 */
export function drawTriples(root, view) {
  const board = el('div', `rh-triples${view.small ? ' small' : ''}`);
  for (const side of ['yes', 'no']) {
    const column = el('div', `rh-column ${side}`);
    const head = el('div', 'rh-head');
    head.append(el('span', `rh-key ${side}`, ''), el('span', 'rh-head-text', view.heads[side]));
    column.append(head);
    const list = el('ol', 'rh-list');
    for (const { item, yes } of view.asked) {
      if (yes !== (side === 'yes')) continue;
      const text = item.join(view.join);
      const row = el('li', `rh-item ${side}`, text);
      if (view.strong?.has(text)) row.classList.add('strong');
      if (view.fresh === text) row.classList.add('fresh');
      list.append(row);
    }
    column.append(list);
    board.append(column);
  }
  root.replaceChildren(board);
}

/** 세 수를 넣는 세 칸: 넣은 수와, 다음에 들어갈 칸 */
export function drawSlots(root, { values, label }) {
  root.replaceChildren(
    ...[0, 1, 2].map((at) => {
      const slot = el('span', 'rh-slot', values[at] === undefined ? '' : String(values[at]));
      if (at === values.length) slot.classList.add('next');
      return slot;
    }),
  );
  root.setAttribute('aria-label', label);
}

/** 풀이와 "왜 그럴까?"의 그림 한 장: 판(수 판 또는 세 수 판)과 그 아래 글 */
export function ruleCard(draw, note, { big = false } = {}) {
  const card = el('div', big ? 'rh-card big' : 'rh-card');
  const picture = el('div');
  card.append(picture);
  draw(picture);
  if (note) card.append(el('p', 'strip-note', note));
  return card;
}

/** 규칙 이름 카드(풀이 보기에서 처음 받은 것과도 맞는 다른 규칙들) */
export function nameChip(text) {
  return el('span', 'rh-name-chip', text);
}
