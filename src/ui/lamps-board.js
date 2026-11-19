// 켜고 끄기와 숫자 마술의 판을 그린다: 불의 줄, 켠 불의 합, 1부터 놓인 수의 줄, 적힌 수, 마음 읽기 카드, 숫자 마술의 세로셈과 쪽지.
// 누를 수 있는 판과 보기만 하는 그림을 같은 모양으로 그린다.
// 색만으로 알리지 않는다. 켠 불은 빛살이 둘린 채운 동그라미, 꺼진 불은 빈 동그라미, 만든 수는 동그라미, 만들 수 없는 수는 빗금 한 줄,
// 고른 수와 누른 카드는 굵은 테두리, 선생님의 수가 있는 카드는 두 겹 테두리, 다시 볼 자리는 점선 네모로 그린다.
// 글자는 대본에서 받는다(읽어 줄 이름, 합의 이름, 쪽지의 이름).

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * 불의 줄.
 * @param {object} view
 *   lamps   불마다의 수
 *   lit     켠 불의 번호들(배열이나 Set)
 *   fresh   새로 단 불의 번호(-1이면 없다)
 *   slot    맨 뒤에 아직 달지 않은 불 자리를 그리는가
 *   small   작은 그림인가
 *   label   (번호) → 읽어 줄 이름. onTap이 있으면 누를 수 있다
 *   onTap   (번호) → 누를 때
 */
export function lampRow(view) {
  const lit = new Set(view.lit ?? []);
  const live = typeof view.onTap === 'function';
  const row = el('div', `lp-lamps${view.small ? ' small' : ''}${view.lamps.length > 6 ? ' many' : ''}`);
  view.lamps.forEach((value, at) => {
    const lamp = el(live ? 'button' : 'span', 'lp-lamp');
    if (live) {
      lamp.type = 'button';
      lamp.setAttribute('aria-pressed', String(lit.has(at)));
      lamp.setAttribute('aria-label', view.label(at));
      lamp.addEventListener('click', () => view.onTap(at));
    }
    if (lit.has(at)) lamp.classList.add('on');
    if (view.fresh === at) lamp.classList.add('fresh');
    lamp.append(el('span', 'lp-bulb'), el('span', 'lp-value', String(value)));
    row.append(lamp);
  });
  if (view.slot) {
    const slot = el('span', 'lp-lamp slot');
    if (view.slotLabel) slot.setAttribute('aria-label', view.slotLabel);
    slot.append(el('span', 'lp-bulb'), el('span', 'lp-value', '?'));
    row.append(slot);
  }
  return row;
}

/** 켠 불의 합: 이름과 큰 수 */
export function sumBox(label, value, { small = false } = {}) {
  const box = el('div', `lp-sum${small ? ' small' : ''}`);
  box.append(el('span', 'lp-sum-label', label), el('strong', 'lp-sum-value', String(value)));
  box.setAttribute('aria-live', 'polite');
  return box;
}

/** 줄의 한 줄 칸 수 */
const columnsOf = (top) => (top <= 10 ? top : top <= 40 ? 10 : top <= 64 ? 12 : 15);

/**
 * 1부터 top까지 놓인 수의 줄.
 * @param {object} view
 *   top      끝 수
 *   made     Set(수): 동그라미(만든 수, 만들 수 있는 수)
 *   cannot   Set(수): 빗금(만들 수 없는 수)
 *   gap      처음으로 만들 수 없는 수(두 겹 테두리) 또는 null
 *   picked   고른 수(굵은 테두리) 또는 null
 *   fresh    방금 만든 수(굵은 테두리) 또는 null
 *   ways     Map(수 → 방법의 수): 둘 이상이면 칸 위에 작은 수
 *   allWays  하나뿐인 것까지 방법의 수를 모두 적는가(그림에서)
 *   small    작은 그림인가
 *   label    (수) → 읽어 줄 이름. onTap이 있으면 누를 수 있다
 *   onTap    (수) → 누를 때
 */
export function numberStrip(view) {
  const live = typeof view.onTap === 'function';
  const strip = el('div', `lp-strip${view.small ? ' small' : ''}${live ? ' live' : ''}`);
  const columns = columnsOf(view.top);
  strip.style.setProperty('--cols', String(columns));
  strip.style.setProperty('--rows', String(Math.ceil(view.top / columns)));
  for (let n = 1; n <= view.top; n++) {
    const cell = el(live ? 'button' : 'span', 'lp-cell');
    if (live) {
      cell.type = 'button';
      cell.setAttribute('aria-label', view.label(n));
      cell.addEventListener('click', () => view.onTap(n));
    }
    if (view.made?.has(n)) cell.classList.add('made');
    if (view.cannot?.has(n)) cell.classList.add('cannot');
    if (view.gap === n) cell.classList.add('gap');
    if (view.picked === n) cell.classList.add('picked');
    if (view.fresh === n) cell.classList.add('fresh');
    cell.append(el('span', 'lp-n', String(n)));
    const ways = view.ways?.get(n) ?? 0;
    if (ways >= 2 || (view.allWays && ways >= 1)) cell.append(el('span', 'lp-ways', String(ways)));
    strip.append(cell);
  }
  return strip;
}

/** 적힌 수들: 만든 것은 동그라미, 방금 만든 것은 굵은 테두리 */
export function targetRow({ targets, made, fresh = null, label = null, small = false }) {
  const row = el('div', `lp-targets${small ? ' small' : ''}`);
  for (const n of targets) {
    const chip = el('span', 'lp-target');
    if (made.has(n)) chip.classList.add('made');
    if (fresh === n) chip.classList.add('fresh');
    if (label) chip.setAttribute('aria-label', label(n));
    chip.append(el('span', 'lp-n', String(n)));
    row.append(chip);
  }
  return row;
}

/**
 * 마음 읽기 카드들.
 * @param {object} view
 *   cards    [{ title, numbers, picked, marked }]: 카드의 이름, 적힌 수, 눌렀는가, 선생님의 수가 있는가
 *   mark     카드 위에서 동그라미를 칠 수(그림에서) 또는 null
 *   small    작은 그림인가
 *   label    (번호) → 읽어 줄 이름. onTap이 있으면 누를 수 있다
 *   onTap    (번호) → 누를 때
 */
export function cardGrid(view) {
  const live = typeof view.onTap === 'function';
  const grid = el('div', `lp-cards${view.small ? ' small' : ''}${view.cards.length > 4 ? ' five' : ''}`);
  view.cards.forEach((card, at) => {
    const box = el(live ? 'button' : 'div', 'lp-card');
    if (live) {
      box.type = 'button';
      box.setAttribute('aria-pressed', String(card.picked));
      box.setAttribute('aria-label', view.label(at));
      box.addEventListener('click', () => view.onTap(at));
    }
    if (card.picked) box.classList.add('picked');
    if (card.marked) box.classList.add('marked');
    box.append(el('span', 'lp-card-title', card.title));
    const list = el('span', 'lp-card-numbers');
    for (const n of card.numbers) {
      const item = el('span', 'lp-card-n', String(n));
      if (view.mark === n) item.classList.add('mark');
      list.append(item);
    }
    box.append(list);
    grid.append(box);
  });
  return grid;
}

/** 수 → 자리마다의 숫자(일의 자리가 맨 끝). width 칸에 맞춰 앞을 비운다 */
const cellsOf = (value, width) => {
  const text = value === null || value === undefined ? '' : String(value);
  return [...Array(Math.max(0, width - text.length)).fill(''), ...text.split('')];
};

/**
 * 세로셈 하나: 윗수, 기호와 아랫수, 줄, 답(넣는 중인 글자나 수).
 * @param {object} view
 *   top, bottom   두 수
 *   op            '-' 또는 '+'
 *   answer        답 칸에 적을 것(글자나 수, 없으면 빈칸)
 *   look          다시 볼 자리(일의 자리부터 0, 1, 2, 3) 또는 -1
 *   sums          자리마다 더한 값(그림에서, 일의 자리가 맨 끝) 또는 null
 *   live          넣는 중인 답 칸인가(점선 테두리)
 *   small         작은 그림인가
 */
export function columnSum(view) {
  const width = 4;
  const box = el('div', `lp-column${view.small ? ' small' : ''}`);
  const line = (sign, cells, className) => {
    const row = el('div', `lp-column-row ${className}`);
    row.append(el('span', 'lp-sign', sign));
    cells.forEach((digit, at) => {
      const cell = el('span', 'lp-digit', digit);
      if (view.look >= 0 && width - 1 - at === view.look) cell.classList.add('look');
      row.append(cell);
    });
    return row;
  };
  // 줄의 이름은 lp-row-로 시작한다(틀의 .top, .answer와 겹치지 않게)
  box.append(line('', cellsOf(view.top, width), 'lp-row-top'));
  box.append(line(view.op === '-' ? '−' : '+', cellsOf(view.bottom, width), 'lp-row-bottom'));
  box.append(el('div', 'lp-column-bar'));
  const answer = line('', cellsOf(view.answer, width), `lp-row-answer${view.live ? ' live' : ''}`);
  box.append(answer);
  if (view.sums) {
    const sums = el('div', 'lp-column-row lp-row-sums');
    sums.append(el('span', 'lp-sign', ''));
    const cells = [...Array(width - view.sums.length).fill(''), ...view.sums.map(String)];
    for (const text of cells) sums.append(el('span', 'lp-digit sum', text));
    box.append(sums);
  }
  return box;
}

/** 선생님의 쪽지: 펴기 전에는 접힌 종이와 글, 편 뒤에는 적힌 수 */
export function noteCard({ title, sealedText, value, open, small = false }) {
  const card = el('div', `lp-note${open ? ' open' : ''}${small ? ' small' : ''}`);
  card.append(el('span', 'lp-note-title', title));
  card.append(el('strong', 'lp-note-value', open ? String(value) : '?'));
  if (!open && sealedText) card.append(el('span', 'lp-note-sealed', sealedText));
  return card;
}

/** 고른 수 칸: 이름과 수(아직 없으면 넣는 중인 글자) */
export function pickedBox({ label, value, live = false }) {
  const box = el('div', `lp-picked${live ? ' live' : ''}`);
  box.append(el('span', 'lp-picked-label', label), el('strong', 'lp-picked-value', value === null || value === '' ? ' ' : String(value)));
  return box;
}

/** 여럿을 한 묶음으로(판의 위아래 칸) */
export function stack(className, ...children) {
  const box = el('div', className);
  box.append(...children.filter(Boolean));
  return box;
}

/** 풀이와 "왜 그럴까?"의 그림 한 장: 그림과 그 아래 글 */
export function figureCard(nodes, note) {
  const card = el('div', 'lp-figure');
  card.append(...nodes);
  if (note) card.append(el('p', 'strip-note', note));
  return card;
}

/** 그림 여러 장을 한 줄로 */
export function figureRow(cards) {
  const row = el('div', 'figure-row');
  row.append(...cards);
  return row;
}
