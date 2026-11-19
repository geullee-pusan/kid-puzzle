// 누가 이길까의 판을 그린다: 초콜릿 한 판(쪼개진 조각은 조금 벌어져 보인다)과 돌 더미.
// 누를 수 있는 판과 보기만 하는 그림을 같은 모양으로 그린다.
// 색만으로 알리지 않는다. 방금 쪼개진 조각에는 굵은 테두리를 두르고, 방금 가져간 돌의 자리는 점선 고리로 남기고,
// 골라 둔 돌은 테두리를 굵게 하고 가운데에 점을 찍는다. 지금 가져갈 수 없는 돌은 흐리게 하고 테두리를 점선으로 한다. 글자는 대본에서 받는다.
// 초콜릿은 조각 안의 금을 누르면 그 금을 알려 주고, 돌은 누른 돌이 "그 더미에서 몇 개째인지"를 알려 준다.

const NS = 'http://www.w3.org/2000/svg';
const UNIT = 100; // 칸 하나의 크기
const GAP = 18; // 쪼개진 조각 사이가 벌어지는 만큼
const EDGE = 8; // 판 둘레에 두는 자리
const INSET = 9; // 칸의 네모가 금에서 안으로 들어가는 만큼
const HIT = 24; // 금을 누를 수 있는 너비의 절반
/** 한 더미 게임에서 한 줄에 놓는 돌의 수 */
const ONE_PER_ROW = 5;

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

/** 누르거나 글자판(엔터, 띄어쓰기)으로 고를 수 있게 한다 */
function pressable(node, label, onPress) {
  node.setAttribute('tabindex', '0');
  node.setAttribute('role', 'button');
  if (label) node.setAttribute('aria-label', label);
  node.addEventListener('click', onPress);
  node.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onPress();
  });
}

/**
 * 초콜릿을 그린다. 쪼개진 금이 있는 곳마다 그 오른쪽(아래쪽)의 조각을 조금씩 밀어서 벌어져 보이게 한다.
 * 조각의 왼쪽(위쪽) 끝이 판의 끝이 아니면 거기에 쪼개진 금이 있는 것이다.
 */
function drawChoco(root, view) {
  const { board, state, fresh = null, small = false } = view;
  const live = Boolean(view.onLine);
  root.className = `duel-game duel-choco${small ? ' small' : ''}${live ? ' live' : ''}`;
  root.style.setProperty('--w', String(board.w));
  root.style.setProperty('--h', String(board.h));

  const cuts = (pick) => [...new Set(state.map(pick).filter((value) => value > 0))];
  const xCuts = cuts((piece) => piece.x);
  const yCuts = cuts((piece) => piece.y);
  // 판이 이리저리 움직이지 않게, 다 쪼갰을 때의 크기로 자리를 잡고 가운데에 놓는다.
  const leftOf = (x) => x * UNIT + GAP * xCuts.filter((cut) => cut <= x).length + (GAP * (board.w - 1 - xCuts.length)) / 2;
  const topOf = (y) => y * UNIT + GAP * yCuts.filter((cut) => cut <= y).length + (GAP * (board.h - 1 - yCuts.length)) / 2;
  const width = board.w * UNIT + GAP * (board.w - 1);
  const height = board.h * UNIT + GAP * (board.h - 1);

  const svg = make('svg', { viewBox: `${-EDGE} ${-EDGE} ${width + 2 * EDGE} ${height + 2 * EDGE}`, preserveAspectRatio: 'xMidYMid meet' }, 'duel-svg');
  if (!live) svg.setAttribute('aria-hidden', 'true');
  const lines = [];
  state.forEach((piece, index) => {
    const left = leftOf(piece.x);
    const top = topOf(piece.y);
    const isFresh = Array.isArray(fresh) && fresh.includes(index);
    svg.append(make('rect', { x: left, y: top, width: piece.w * UNIT, height: piece.h * UNIT, rx: 16 }, isFresh ? 'choco-piece fresh' : 'choco-piece'));
    for (let row = 0; row < piece.h; row++) {
      for (let col = 0; col < piece.w; col++) {
        svg.append(make('rect', { x: left + col * UNIT + INSET, y: top + row * UNIT + INSET, width: UNIT - 2 * INSET, height: UNIT - 2 * INSET, rx: 10 }, 'choco-cell'));
      }
    }
    if (!live) return;
    // 금: 조각 안의 세로 금과 가로 금. 금이 만나는 곳은 어느 금인지 가릴 수 없어서 누르는 자리에서 뺀다.
    for (let at = 1; at < piece.w; at++) {
      const group = make('g', {}, 'choco-line');
      for (let row = 0; row < piece.h; row++) {
        group.append(make('rect', { x: left + at * UNIT - HIT, y: top + row * UNIT + HIT, width: 2 * HIT, height: UNIT - 2 * HIT, rx: 8 }, 'choco-hit'));
      }
      group.append(make('line', { x1: left + at * UNIT, y1: top + INSET, x2: left + at * UNIT, y2: top + piece.h * UNIT - INSET }, 'choco-groove'));
      pressable(group, view.labels?.line?.(index, 'v', at), () => view.onLine({ piece: index, dir: 'v', at }));
      lines.push(group);
    }
    for (let at = 1; at < piece.h; at++) {
      const group = make('g', {}, 'choco-line');
      for (let col = 0; col < piece.w; col++) {
        group.append(make('rect', { x: left + col * UNIT + HIT, y: top + at * UNIT - HIT, width: UNIT - 2 * HIT, height: 2 * HIT, rx: 8 }, 'choco-hit'));
      }
      group.append(make('line', { x1: left + INSET, y1: top + at * UNIT, x2: left + piece.w * UNIT - INSET, y2: top + at * UNIT }, 'choco-groove'));
      pressable(group, view.labels?.line?.(index, 'h', at), () => view.onLine({ piece: index, dir: 'h', at }));
      lines.push(group);
    }
  });
  // 금은 조각 위에 그려야 눌린다.
  svg.append(...lines);
  root.replaceChildren(svg);
}

/**
 * 돌 더미를 그린다. 더미마다 처음 돌의 수만큼 자리를 잡아 두어서, 돌을 가져가도 남은 돌이 움직이지 않는다.
 * 돌은 아래에서부터 쌓인다. 돌 하나를 누르면 그 돌부터 맨 위의 돌까지가 "가져갈 돌"이다.
 * 두 더미에서 같은 수만큼 가져가는 수(pile이 'both')는 두 더미 모두에 자국을 남긴다.
 */
function drawStones(root, view) {
  const { board, state, fresh = null, pick = null, small = false, counts = !small } = view;
  const live = Boolean(view.onStone);
  // 한 더미로 두는 판(한 더미, 약수 빼기, 절반까지)은 돌의 수 n 하나, 여러 더미는 더미마다의 수
  const heap = !Array.isArray(board.piles);
  const starts = heap ? [board.n] : board.piles;
  const per = heap ? ONE_PER_ROW : 1;
  const rowsOf = (start) => Math.ceil(start / per);
  root.className = `duel-game duel-stones${small ? ' small' : ''}${live ? ' live' : ''}`;
  root.style.setProperty('--rows', String(Math.max(...starts.map(rowsOf))));
  root.style.setProperty('--cols', String(starts.reduce((sum, start) => sum + Math.min(per, start), 0)));
  root.style.setProperty('--piles', String(starts.length));

  const piles = starts.map((start, pile) => {
    const left = state[pile];
    const heap = el('div', 'duel-heap');
    heap.style.setProperty('--per', String(Math.min(per, start)));
    for (let index = 0; index < start; index++) {
      const take = left - index; // 이 돌을 누르면 가져가게 되는 돌의 수
      let stone;
      if (index < left) {
        const picked = pick !== null && (pick.pile === pile || pick.pile === 'both') && take <= pick.take;
        const barred = !picked && live && view.allowed !== undefined && !view.allowed(pile, take);
        stone = el(live ? 'button' : 'span', picked ? 'duel-stone picked' : barred ? 'duel-stone barred' : 'duel-stone');
        if (live) {
          stone.type = 'button';
          stone.setAttribute('aria-label', view.labels?.stone?.(pile, take) ?? '');
          stone.setAttribute('aria-pressed', String(picked));
          stone.addEventListener('click', () => view.onStone(pile, take));
        }
      } else if (fresh !== null && !Array.isArray(fresh) && (fresh.pile === pile || fresh.pile === 'both') && index < left + fresh.take) stone = el('span', 'duel-stone gone');
      else stone = el('span', 'duel-slot');
      stone.style.gridRow = String(rowsOf(start) - Math.floor(index / per));
      stone.style.gridColumn = String((index % per) + 1);
      heap.append(stone);
    }
    const column = el('div', 'duel-pile');
    column.append(heap);
    if (counts) {
      const label = el('div', 'duel-pile-label');
      const name = view.labels?.pile?.(pile) ?? '';
      if (name) label.append(el('span', '', name));
      label.append(el('strong', '', view.labels?.count?.(left) ?? String(left)));
      column.append(label);
    }
    return column;
  });
  root.replaceChildren(...piles);
}

/**
 * 판을 그린다.
 * @param {HTMLElement} root 그릴 자리(안의 것을 모두 바꾼다)
 * @param {object} view
 *   board    판({ kind: 'choco', w, h } | { kind: 'one' | 'divisor' | 'half', n, … } | { kind: 'piles' | 'both', piles })
 *   state    지금 자리(초콜릿은 조각들, 돌은 더미마다 남은 수)
 *   fresh    방금 둔 수의 자국. 초콜릿은 방금 생긴 두 조각의 번호들, 돌은 { pile, take }(방금 가져간 돌)
 *   pick     골라 둔 돌 { pile, take }(pile이 'both'면 두 더미에서 같은 수만큼)
 *   allowed  (더미 번호, 몇 개) → 그 돌을 눌러 지금 가져갈 수 있는가. 적혀 있으면 가져갈 수 없는 돌을 흐리게 그린다
 *   labels   글자를 내주는 함수들: line(조각 번호, 'v'|'h', 몇째 금), stone(더미 번호, 몇 개), pile(더미 번호), count(돌의 수)
 *   counts   더미 아래에 이름과 남은 수를 적는가(작은 그림에서는 적지 않는다)
 *   onLine   (수) → 금을 눌렀을 때(초콜릿)
 *   onStone  (더미 번호, 몇 개) → 돌을 눌렀을 때
 *   small    작은 그림으로 그린다
 */
export function drawGame(root, view) {
  if (view.board.kind === 'choco') drawChoco(root, view);
  else drawStones(root, view);
}

/**
 * 판 하나를 담은 새 조각을 만든다(풀이, "왜 그럴까?", 방금 판 다시 보기의 그림). 아래에 한 줄 글을 붙일 수 있다.
 * @param {object} view drawGame에 건네는 것
 * @param {string} note 아래에 붙이는 글
 */
export function gameCard(view, note, { big = false } = {}) {
  const card = el('div', big ? 'duel-card big' : 'duel-card');
  const picture = el('div');
  card.append(picture);
  drawGame(picture, { ...view, small: true });
  if (note) card.append(el('p', 'strip-note', note));
  return card;
}

/**
 * 수마다 칸 하나씩인 줄을 만든다("왜 그럴까?"의 표). 칸에는 수와 그 아래의 짧은 글이 들어간다.
 * 눈에 띄게 할 칸은 테두리를 굵게 한다(색만으로 가리지 않는다). 한 줄에 per칸씩 놓는다.
 * @param {{note: string, per: number, cells: {no: string, text: string, marked: boolean}[]}} view
 */
export function marksCard({ note, per, cells }) {
  const card = el('div', 'duel-marks-card');
  const row = el('div', 'duel-marks');
  row.style.setProperty('--per', String(per));
  for (const cell of cells) {
    const item = el('div', cell.marked ? 'duel-mark marked' : 'duel-mark');
    item.append(el('strong', '', cell.no), el('span', '', cell.text));
    row.append(item);
  }
  card.append(row);
  if (note) card.append(el('p', 'strip-note', note));
  return card;
}

/** 머리글과 줄들로 표를 만든다("왜 그럴까?"의 표). 눈에 띄게 할 줄은 marked로 알린다 */
export function tableCard(heads, rows) {
  const table = el('table', 'duel-table');
  const head = el('tr');
  for (const text of heads) head.append(el('th', '', text));
  const top = el('thead');
  top.append(head);
  const body = el('tbody');
  for (const row of rows) {
    const line = el('tr', row.marked ? 'marked' : '');
    for (const text of row.cells) line.append(el('td', '', text));
    body.append(line);
  }
  table.append(top, body);
  return table;
}
