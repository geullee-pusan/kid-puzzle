// 숫자 넷으로 수 만들기의 그림을 그린다: 카드, 셈 기호 단추, 목표 수 칸, 1부터의 띠, 만든 식의 목록, 종이의 그림.
// 누를 수 있는 판과 보기만 하는 그림을 같은 모양으로 그린다. 글자는 대본에서 받는다(이 파일에는 글을 적지 않는다).
// 색만으로 알리지 않는다.
//   카드: 둥근 네모(1180×820 화면에서 가로 96픽셀 이상, 세로 104픽셀). 값을 크게 적고, 합친 카드는 그 아래에 식을 적는다.
//     분수 카드는 분자와 분모를 가로줄 위아래에 적는다. 고른 카드는 굵은 금빛 점선 테두리와 들린 모습이다. 방금 생긴 카드는 굵은 테두리다.
//   셈 기호: 단추 넷(64×64픽셀). 고른 기호는 굵은 테두리와 빗금 바탕이다.
//   목표 수 칸: 수와, 만들었으면 그 식. 만든 칸은 굵은 실선 테두리와 바탕, 아직인 칸은 점선 테두리다.
//   띠: 한 줄에 열 칸. 만든 수는 가는 초록 테두리와 바탕, 아래의 점, 열린 수는 굵은 점선 테두리, 만들 수 없는 수(끝난 판, 풀이, 직접 만들기)는 굵은 테두리와 빗금이다.
import { exprText, isWhole } from '../core/fourdigits.js';

/** 띠 한 줄의 칸 수 */
export const STRIP_COLS = 10;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** 카드 위에 적는 식(먼저 합친 두 카드마다 괄호로 묶는다) */
export const cardText = (tree, faces) => exprText(tree, faces, { full: true });

/** 값을 그린다: 자연수는 그대로, 분수는 분자와 분모를 가로줄 위아래에 */
export function valueNode(value) {
  if (isWhole(value)) return el('span', 'nf-num', String(value[0]));
  const frac = el('span', 'nf-frac');
  frac.append(el('span', 'nf-top', String(value[0])), el('span', 'nf-bar'), el('span', 'nf-bottom', String(value[1])));
  return frac;
}

/**
 * 카드들을 그린다.
 * @param {HTMLElement} root 그릴 자리(안의 것을 모두 바꾼다)
 * @param {object} view
 *   cards   카드들 [{ value, tree }]
 *   faces   셈 기호의 글자
 *   picked  고른 카드 번호 또는 null
 *   fresh   방금 생긴 카드 번호 또는 null(굵은 테두리)
 *   label   (카드) → 읽어 줄 이름
 *   onCard  (카드 번호) → 카드를 눌렀을 때. 없으면 누를 수 없다
 *   small   작은 그림으로 그린다(처음 화면, 공책)
 *   mid     중간 그림으로 그린다(풀이와 "왜 그럴까?"의 종이)
 */
export function drawCards(root, view) {
  const { cards, faces, picked = null, fresh = null, small = false, mid = false } = view;
  const live = Boolean(view.onCard);
  const focused = root.contains(document.activeElement) ? document.activeElement.dataset?.at : undefined;
  const row = el('div', `nf-cards${small ? ' small' : mid ? ' mid' : ''}`);
  cards.forEach((card, at) => {
    const classes = ['nf-card', picked === at ? 'picked' : '', fresh === at ? 'fresh' : '', typeof card.tree === 'number' ? '' : 'joined'].filter(Boolean).join(' ');
    const node = el(live ? 'button' : 'span', classes);
    node.dataset.at = String(at);
    node.append(valueNode(card.value));
    // 합친 카드는 식을 적는다. 숫자 카드도 같은 높이가 되게 빈 줄을 둔다
    node.append(el('span', 'nf-expr', typeof card.tree === 'number' ? '' : cardText(card.tree, faces)));
    if (live) {
      node.type = 'button';
      node.setAttribute('aria-pressed', String(picked === at));
      if (view.label) node.setAttribute('aria-label', view.label(card));
    }
    row.append(node);
  });
  if (live) {
    row.addEventListener('click', (event) => {
      const target = event.target.closest?.('button[data-at]');
      if (target) view.onCard(Number(target.dataset.at));
    });
  }
  root.replaceChildren(row);
  if (focused !== undefined) row.querySelector(`[data-at="${focused}"]`)?.focus?.();
}

/**
 * 셈 기호 단추 넷을 그린다.
 * @param {object} view
 *   ops      셈 기호들('+', '-', '*', '/')
 *   faces    기호의 글자
 *   names    기호마다 읽어 줄 이름
 *   picked   고른 기호 또는 null
 *   enabled  누를 수 있는가(카드를 골랐을 때)
 *   onOp     (기호) → 눌렀을 때
 */
export function drawOps(root, view) {
  const { ops, faces, names, picked = null, enabled = false } = view;
  const focused = root.contains(document.activeElement) ? document.activeElement.dataset?.op : undefined;
  const row = el('div', 'nf-ops');
  for (const op of ops) {
    const button = el('button', `nf-op${picked === op ? ' picked' : ''}`, faces[op]);
    button.type = 'button';
    button.dataset.op = op;
    button.disabled = !enabled;
    button.setAttribute('aria-pressed', String(picked === op));
    button.setAttribute('aria-label', names[op]);
    row.append(button);
  }
  row.addEventListener('click', (event) => {
    const target = event.target.closest?.('button[data-op]');
    if (target && !target.disabled) view.onOp(target.dataset.op);
  });
  root.replaceChildren(row);
  if (focused !== undefined) row.querySelector(`[data-op="${CSS.escape(focused)}"]`)?.focus?.();
}

/**
 * 목표 수 칸을 그린다.
 * @param {object} view
 *   targets  [{ n, text(만든 식의 글. 아직이면 null. 작은 그림에서는 만들었으면 빈 글) }]
 *   label    (칸) → 읽어 줄 이름
 *   small    작은 그림으로 그린다
 */
export function drawTargets(root, view) {
  const { targets, small = false } = view;
  const row = el('div', `nf-targets${small ? ' small' : ''}`);
  for (const target of targets) {
    const done = target.text !== null && target.text !== undefined;
    const cell = el('span', `nf-target${done ? ' made' : ''}`);
    cell.append(el('span', 'nf-target-no', String(target.n)));
    if (!small) cell.append(el('span', 'nf-target-expr', target.text ?? ''));
    if (view.label) {
      cell.setAttribute('role', 'img');
      cell.setAttribute('aria-label', view.label(target));
    }
    row.append(cell);
  }
  root.replaceChildren(row);
}

/**
 * 1부터 top까지의 띠를 그린다.
 * @param {object} view
 *   top    띠의 끝 수
 *   made   만든 수들(가는 초록 테두리와 바탕, 점)
 *   open   열린 수들(굵은 점선 테두리)
 *   none   만들 수 없는 수들(굵은 테두리와 빗금)
 *   label  (수, 칸의 종류 'made' | 'open' | 'none' | '') → 읽어 줄 이름
 *   small  작은 그림으로 그린다
 */
export function drawStrip(root, view) {
  const { top, made = [], open = [], none = [], small = false } = view;
  const strip = el('div', `nf-strip${small ? ' small' : ''}`);
  strip.style.setProperty('--cols', String(Math.min(STRIP_COLS, top)));
  const sets = { made: new Set(made), open: new Set(open), none: new Set(none) };
  for (let no = 1; no <= top; no++) {
    const kind = ['made', 'open', 'none'].find((name) => sets[name].has(no)) ?? '';
    const cell = el('span', `nf-cell${kind ? ` ${kind}` : ''}`);
    cell.append(el('span', 'nf-cell-no', String(no)));
    if (kind === 'made') cell.append(el('span', 'nf-dot'));
    if (view.label) {
      cell.setAttribute('role', 'img');
      cell.setAttribute('aria-label', view.label(no, kind));
    }
    strip.append(cell);
  }
  root.replaceChildren(strip);
}

/**
 * 만든 식의 목록: 수마다 "수 = 식"(작은 수부터).
 * @param {HTMLElement} root 목록(ol)
 * @param {{n: number, text: string}[]} entries
 */
export function drawList(root, entries) {
  root.replaceChildren(
    ...entries.map(({ n, text }) => {
      const item = el('li', 'nf-item');
      item.append(el('strong', 'nf-item-no', String(n)), el('span', 'nf-item-eq', '='), el('span', 'nf-item-expr', text));
      return item;
    }),
  );
}

/** 판 하나를 담은 새 조각(종이의 그림). 아래에 한 줄 글을 붙인다 */
function cardOf(draw, note, wide) {
  const card = el('div', wide ? 'nf-card-figure wide' : 'nf-card-figure');
  const picture = el('div', 'nf-card-picture');
  draw(picture);
  card.append(picture);
  if (note) card.append(el('p', 'strip-note', note));
  return card;
}

/** 카드들의 그림 하나 */
export const cardsFigure = (cards, faces, note) => cardOf((picture) => drawCards(picture, { cards, faces, mid: true }), note, false);

/** 띠의 그림 하나: { top, made, none } */
export const stripFigure = (view, note) => cardOf((picture) => drawStrip(picture, { ...view, small: true }), note, true);

/** 식 목록의 그림 하나(풀이): [{ n, text }] */
export function listFigure(entries, note) {
  return cardOf(
    (picture) => {
      const list = el('ol', 'nf-list nf-list-figure');
      drawList(list, entries);
      picture.append(list);
    },
    note,
    true,
  );
}
