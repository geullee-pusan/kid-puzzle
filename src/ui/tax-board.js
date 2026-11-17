// 약수 세금의 판을 그린다: 수 카드들, 그 아래의 한 줄 글, 가진 카드와 세금으로 나간 카드의 두 자리.
// 누를 수 있는 판과 보기만 하는 그림을 같은 모양으로 그린다.
// 색만으로 알리지 않는다. 고른 카드는 굵은 테두리에 귀퉁이의 동그란 표시, 세금으로 나갈 카드는 굵은 점선 테두리에 귀퉁이의 세모 표시,
// 가질 수 없는 카드는 흐리고 가는 점선 테두리, 카드가 나간 자리는 빈 점선 칸이다.
// 가진 카드는 실선 테두리의 작은 카드로, 세금으로 나간 카드는 점선 테두리의 작은 카드로 차례대로 쌓고, 자리마다 이름과 합을 적는다.
// 글자는 대본에서 받는다.

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** 한 줄에 놓는 카드의 수: 여섯 장까지는 한 줄, 스무 장까지는 두 줄, 그보다 많으면 세 줄로 고르게 나눈다(한 줄에 열 장까지) */
export function columnsFor(count) {
  const rows = count <= 6 ? 1 : count <= 20 ? 2 : 3;
  return Math.min(10, Math.ceil(count / rows));
}

/** 작은 카드 하나(가진 카드, 세금으로 나간 카드) */
function chip(card, kind, fresh = false) {
  return el('span', `tax-chip ${kind}${fresh ? ' fresh' : ''}`, String(card));
}

/** 자리 하나: 이름, 합, 차례대로 쌓인 작은 카드들 */
function tray(kind, name, sumText, chips) {
  const box = el('div', `tax-tray ${kind}`);
  const label = el('span', 'tax-tray-label');
  label.append(el('span', '', name), el('strong', '', sumText));
  box.append(label, ...chips);
  return box;
}

/**
 * 판을 그린다.
 * @param {HTMLElement} root 그릴 자리(안의 것을 모두 바꾼다)
 * @param {object} view
 *   cards      처음 판에 놓인 카드(칸의 차례)
 *   remaining  판에 남은 카드
 *   open       지금 가질 수 있는 카드
 *   held       가진 카드(차례대로)
 *   gone       세금으로 나간 카드(차례대로. 끝난 판에서는 남은 카드까지)
 *   left       끝난 판에서 남아서 세금으로 나간 카드(판에도 그대로 그린다)
 *   pick       골라서 미리 보는 카드(없으면 null)
 *   due        고른 카드를 가지면 세금으로 나갈 카드들
 *   costs      카드마다 낼 세금의 합({ 카드: 합 }). 없으면 적지 않는다
 *   refused    방금 눌렀지만 가질 수 없는 카드(없으면 null)
 *   fresh      방금 가진 카드와 그때 세금으로 나간 카드들({ card, due }). 자리에서 눈에 띄게 한다
 *   status     판 아래에 적는 한 줄 글
 *   names      { held, gone } 두 자리의 이름
 *   sums       { held, gone } 두 자리에 적는 합의 글
 *   label      (카드) → 읽어 줄 이름(누를 수 있는 판에서만)
 *   onTap      (카드) → 눌렀을 때. 없으면 그림으로만 그린다
 *   small      작은 그림으로 그린다(풀이와 "왜 그럴까?")
 */
export function drawBoard(root, view) {
  const { cards, remaining, open = [], held = [], gone = [], left = [], pick = null, due = [], costs = null, refused = null, fresh = null, small = false } = view;
  const live = Boolean(view.onTap);
  const focused = root.contains(document.activeElement) ? document.activeElement.dataset?.card : undefined;
  root.className = `tax-board${small ? ' small' : ''}${live ? ' live' : ''}`;

  const grid = el('div', 'tax-grid');
  grid.style.setProperty('--cols', String(columnsFor(cards.length)));
  for (const card of cards) {
    if (!remaining.includes(card)) {
      grid.append(el('span', 'tax-slot'));
      continue;
    }
    const names = ['tax-card'];
    if (left.includes(card)) names.push('left');
    else if (card === pick) names.push('pick');
    else if (due.includes(card)) names.push('due');
    else if (open.includes(card)) names.push('open');
    else names.push('shut');
    if (card === refused) names.push('refused');
    const node = el(live ? 'button' : 'span', names.join(' '));
    node.append(el('span', 'tax-num', String(card)));
    if (costs && costs[card] !== undefined) node.append(el('span', 'tax-cost', String(costs[card])));
    if (live) {
      node.type = 'button';
      node.dataset.card = String(card);
      if (view.label) node.setAttribute('aria-label', view.label(card));
      node.addEventListener('click', () => view.onTap(card));
    }
    grid.append(node);
  }

  const nodes = [grid];
  if (view.status !== undefined) {
    const status = el('p', 'tax-status', view.status);
    nodes.push(status);
  }
  if (view.names) {
    const paid = gone.length - left.length;
    nodes.push(
      tray('held', view.names.held, view.sums.held, held.map((card) => chip(card, 'held', fresh?.card === card))),
      tray('gone', view.names.gone, view.sums.gone, gone.map((card, index) => chip(card, index >= paid ? 'gone left' : 'gone', index < paid && Boolean(fresh?.due.includes(card))))),
    );
  }
  root.replaceChildren(...nodes);
  if (focused !== undefined) root.querySelector(`[data-card="${focused}"]`)?.focus?.();
}

/**
 * 직접 만들기의 판: 1부터 n까지의 카드. 누르면 빠지고, 다시 누르면 돌아온다. 뺀 카드는 흐린 점선 카드로 남는다.
 * @param {HTMLElement} root
 * @param {{n: number, off: number[], label: (card: number) => string, onTap: (card: number) => void}} view
 */
export function drawPicker(root, view) {
  const focused = root.contains(document.activeElement) ? document.activeElement.dataset?.card : undefined;
  root.className = 'tax-board live';
  const grid = el('div', 'tax-grid');
  grid.style.setProperty('--cols', String(columnsFor(view.n)));
  for (let card = 1; card <= view.n; card++) {
    const off = view.off.includes(card);
    const node = el('button', off ? 'tax-card off' : 'tax-card open');
    node.type = 'button';
    node.dataset.card = String(card);
    node.setAttribute('aria-pressed', String(!off));
    node.setAttribute('aria-label', view.label(card));
    node.append(el('span', 'tax-num', String(card)));
    node.addEventListener('click', () => view.onTap(card));
    grid.append(node);
  }
  root.replaceChildren(grid);
  if (focused !== undefined) root.querySelector(`[data-card="${focused}"]`)?.focus?.();
}

/**
 * 작은 그림(처음 화면, 하던 판, 판 고르기): 수 카드 몇 장. 카드가 많으면 앞의 석 장과 맨 뒤의 한 장만 그리고 사이에 점을 찍는다.
 * @param {HTMLElement} root
 * @param {{cards?: number[], blank?: boolean}} view blank: 아직 정하지 않은 빈 카드 석 장
 */
export function drawMini(root, view) {
  root.className = 'tax-mini';
  if (view.blank) {
    root.replaceChildren(el('span', 'tax-chip mini blank'), el('span', 'tax-chip mini blank'), el('span', 'tax-chip mini blank'));
    return;
  }
  const { cards } = view;
  const few = cards.length <= 6;
  const shown = few ? cards : cards.slice(0, 3);
  const nodes = shown.map((card) => chip(card, 'mini'));
  if (!few) {
    const dots = el('span', 'tax-dots');
    dots.append(el('span'), el('span'), el('span'));
    nodes.push(dots, chip(cards.at(-1), 'mini'));
  }
  root.replaceChildren(...nodes);
}

/** 판 하나를 담은 새 조각을 만든다("왜 그럴까?"의 그림). 아래에 한 줄 글을 붙일 수 있다. */
export function boardCard(view, note) {
  const card = el('div', 'tax-figure');
  const picture = el('div');
  card.append(picture);
  drawBoard(picture, { ...view, small: true });
  if (note) card.append(el('p', 'strip-note', note));
  return card;
}

/**
 * 차례대로 늘어놓은 걸음들(풀이): 걸음마다 가진 카드 하나와 그때 세금으로 나간 카드들. 맨 아래에 두 자리의 합을 적는다.
 * @param {{caption: string, card: number, due: number[]}[]} steps
 * @param {{pay: string, names: {held: string, gone: string}, sums: {held: string, gone: string}, held: number[], gone: number[], left: number[]}} end
 */
export function stepsCard(steps, end) {
  const card = el('div', 'tax-figure wide');
  const list = el('ol', 'tax-steps');
  for (const step of steps) {
    const item = el('li', 'tax-step');
    item.append(el('span', 'strip-caption', step.caption), chip(step.card, 'held'), el('span', 'tax-step-pay', end.pay), ...step.due.map((due) => chip(due, 'gone')));
    list.append(item);
  }
  const paid = end.gone.length - end.left.length;
  card.append(
    list,
    tray('held', end.names.held, end.sums.held, end.held.map((held) => chip(held, 'held'))),
    tray('gone', end.names.gone, end.sums.gone, end.gone.map((gone, index) => chip(gone, index >= paid ? 'gone left' : 'gone'))),
  );
  return card;
}
