// 팬케이크 뒤집기의 판을 그린다: 접시 위에 쌓인 팬케이크 더미.
// 누를 수 있는 판은 줄마다 단추 하나다(줄 전체가 누르는 자리라서 작은 팬케이크도 누르기 쉽다). 팬케이크를 누르면 그 팬케이크부터 맨 위까지 뒤집는다.
// 누르기 시작하면 뒤집힐 팬케이크들에 테두리를 두르고 그 아래에 뒤집개를 그린다. 방금 뒤집힌 팬케이크들은 짧게(0.45초) 뒤집히는 움직임을 보인다.
// 보기만 하는 그림(처음 화면, 공책, 풀이, "왜 그럴까?")은 같은 모양을 SVG로 작게 그린다.
// 색만으로 알리지 않는다. 크기는 너비와 함께 판에 적힌 수로(작은 그림에서는 너비와 진하기로), 탄 면은 팬케이크의 위나 아래에 붙은 빗금 띠로 보인다.
// 글자는 형식(src/formats/pancake.js)이 대본에서 채워 건넨다. 이 파일에는 글을 적지 않는다. 시간을 재는 것이 없다(움직임은 CSS가 한다).

const NS = 'http://www.w3.org/2000/svg';
/** 작은 그림의 크기: 가로, 한 줄의 높이, 줄 사이, 뒤집개가 들어갈 왼쪽 자리 */
const WIDE = 200;
const THIN = 22;
const GAP = 3;
const LEFT = 34;

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

/** 크기에 따른 너비(가장 큰 것의 몇 %)와 밝기(작을수록 밝다) */
const share = (size, n) => (n <= 1 ? 1 : (size - 1) / (n - 1));
export const widthOf = (size, n) => 24 + 76 * share(size, n);
const lightOf = (size, n) => 84 - 32 * share(size, n);

/** 누를 수 있는 판의 팬케이크 하나 */
function cakeNode(size, n, side, numbers) {
  const cake = el('span', `cake${side === 1 ? ' burnt-up' : side === 0 ? ' burnt-down' : ''}`);
  cake.style.setProperty('--w', `${widthOf(size, n)}%`);
  cake.style.setProperty('--l', `${lightOf(size, n)}%`);
  if (side === 0 || side === 1) cake.append(el('span', 'cake-burnt'));
  if (numbers) cake.append(el('span', 'cake-size', String(size)));
  return cake;
}

/**
 * 더미를 그린다.
 * @param {HTMLElement} root 그릴 자리(안의 것을 모두 바꾼다)
 * @param {object} view
 *   stack     위에서부터 팬케이크의 크기
 *   up        자리마다 탄 면이 위인가(1) 아래인가(0). 탄 면이 없는 판이면 null
 *   onTap     (위에서부터의 번호 0…) → 눌렀을 때. 없으면 누를 수 없다(끝난 판)
 *   label     (번호) → 읽어 줄 이름
 *   picking   직접 만들기의 판인가(누르면 고른다. 뒤집개를 보이지 않는다)
 *   flipped   방금 뒤집힌 맨 위의 장 수(그만큼 뒤집히는 움직임을 보인다)
 *   selected  고른 팬케이크의 번호들(직접 만들기)
 *   mark      작은 그림에서 뒤집개를 넣을 자리(위의 mark장에 테두리를 두르고 그 아래에 뒤집개를 그린다)
 *   numbers   작은 그림에도 크기를 적는가
 *   small     작은 그림(SVG)으로 그린다
 */
export function drawStack(root, view) {
  const { stack, up = null, onTap, label, flipped = 0, selected = [], small = false, picking = false } = view;
  const n = stack.length;
  if (small) {
    root.className = 'cake-board small';
    root.replaceChildren(stackSvg(view));
    return;
  }
  root.className = `cake-board live${picking ? ' picking' : ''}`;
  root.style.setProperty('--n', String(n));
  const rows = stack.map((size, index) => {
    const row = el('button', 'cake-row');
    row.type = 'button';
    row.dataset.at = String(index);
    if (label) row.setAttribute('aria-label', label(index));
    if (picking) row.setAttribute('aria-pressed', String(selected.includes(index)));
    if (selected.includes(index)) row.classList.add('selected');
    row.append(cakeNode(size, n, up === null ? null : up[index], true));
    if (!onTap) {
      row.disabled = true;
      return row;
    }
    row.addEventListener('click', () => onTap(index));
    if (!picking) {
      // 누르기 시작하면(또는 글자판으로 고르면) 뒤집힐 팬케이크들과 뒤집개를 보인다
      const aim = (on) => {
        for (const other of root.querySelectorAll('.cake-row')) {
          const at = Number(other.dataset.at);
          other.classList.toggle('aimed', on && at <= index);
          other.classList.toggle('spatula', on && at === index);
        }
      };
      row.addEventListener('pointerdown', () => aim(true));
      row.addEventListener('pointerleave', () => aim(false));
      row.addEventListener('pointercancel', () => aim(false));
      row.addEventListener('focus', () => aim(true));
      row.addEventListener('blur', () => aim(false));
    }
    return row;
  });
  // 방금 뒤집힌 맨 위의 장들: 팬케이크마다 원래 자리에서 위아래가 뒤집히며 새 자리로 온다(줄 단추는 움직이지 않아서, 움직이는 동안 눌러도 누른 줄이 그대로다)
  const turned = Math.min(flipped, n);
  rows.slice(0, turned).forEach((row, index) => {
    row.classList.add('turning');
    row.firstChild.style.setProperty('--from', String(turned - 1 - 2 * index));
  });
  const pile = el('div', 'cake-stack');
  pile.append(...rows);
  root.replaceChildren(pile, el('div', 'cake-plate'));
}

/** 작은 그림(SVG) */
export function stackSvg(view) {
  const { stack, up = null, mark = 0, numbers = false } = view;
  const n = stack.length;
  // 수를 적는 그림(풀이, "왜 그럴까?")은 팬케이크를 두껍게, 더미를 좁게 그려 수가 잘 보이게 한다
  const WIDTH = numbers ? 150 : WIDE;
  const ROW = numbers ? 30 : THIN;
  const height = n * (ROW + GAP) + 12;
  const svg = make('svg', { viewBox: `${-LEFT} -4 ${WIDTH + LEFT + 4} ${height + 6}`, 'aria-hidden': 'true' }, 'cake-svg');
  stack.forEach((size, index) => {
    const w = (WIDTH * widthOf(size, n)) / 100;
    const x = (WIDTH - w) / 2;
    const y = index * (ROW + GAP);
    const group = make('g', {}, index < mark ? 'cake-art aimed' : 'cake-art');
    group.append(make('rect', { x, y, width: w, height: ROW, rx: ROW / 2, style: `--l: ${lightOf(size, n)}%` }, 'cake-body'));
    if (up !== null) {
      // 탄 면: 팬케이크의 위나 아래 3분의 1에 빗금 띠
      const band = ROW * 0.36;
      const top = up[index] === 1;
      group.append(make('rect', { x: x + 4, y: top ? y + 1 : y + ROW - band - 1, width: w - 8, height: band, rx: band / 2 }, 'cake-band'));
    }
    if (numbers) group.append(make('text', { x: WIDTH / 2, y: y + ROW / 2 + 1, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 22 }, 'cake-number'));
    if (numbers) group.lastChild.textContent = String(size);
    if (index < mark) group.append(make('rect', { x: x - 3, y: y - 2, width: w + 6, height: ROW + 4, rx: ROW / 2 + 2 }, 'cake-ring'));
    svg.append(group);
  });
  if (mark > 0) {
    // 뒤집개: 위의 mark장 아래로 왼쪽에서 들어간다
    const y = mark * (ROW + GAP) - GAP / 2;
    svg.append(make('path', { d: `M ${-LEFT + 2} ${y - 7} L ${-LEFT + 16} ${y} L ${WIDTH / 2} ${y}` }, 'cake-spatula'));
  }
  svg.append(make('rect', { x: -6, y: n * (ROW + GAP) + 2, width: WIDTH + 12, height: 8, rx: 4 }, 'cake-plate-art'));
  return svg;
}

/**
 * 뒤집는 차례를 화살표로 이어 그린다. 뒤집기 전의 더미마다 뒤집개를 그리고, 그 아래에 한 줄(caption(k))을 적는다.
 * @param {{stack: number[], up: number[]|null}} board 처음 더미
 * @param {number[]} flips 뒤집기 k의 차례
 * @param {(k: number) => string} caption
 * @param {(board: object, k: number) => object} flip 뒤집은 더미(src/core/pancake.js의 flip)
 * @param {string} note 그림 아래의 한 줄
 */
export function flipStrip(board, flips, caption, flip, note) {
  const box = el('div', 'strip cake-strip');
  const row = el('div', 'strip-row');
  let now = board;
  const cell = (stack, k) => {
    const item = el('div', 'strip-cell');
    const picture = el('div');
    drawStack(picture, { ...stack, mark: k, small: true, numbers: true });
    item.append(picture);
    if (k > 0) item.append(el('span', 'strip-caption', caption(k)));
    return item;
  };
  flips.forEach((k, index) => {
    if (index > 0) row.append(el('span', 'strip-arrow', '→'));
    row.append(cell(now, k));
    now = flip(now, k);
  });
  if (flips.length > 0) row.append(el('span', 'strip-arrow', '→'));
  row.append(cell(now, 0));
  box.append(row);
  if (note) box.append(el('p', 'strip-note', note));
  return box;
}

/**
 * 수의 표(머리 줄과 줄마다 이름과 수들). "왜 그럴까?"의 장 수마다 가장 많이 뒤집는 횟수
 * @param {string[]} head 머리 줄
 * @param {(string|number)[][]} rows
 */
export function numberTable(head, rows) {
  const table = el('table', 'cake-table');
  const top = el('tr');
  for (const text of head) top.append(el('th', '', String(text)));
  table.append(top);
  for (const cells of rows) {
    const line = el('tr');
    cells.forEach((text, index) => line.append(el(index === 0 ? 'th' : 'td', '', String(text))));
    table.append(line);
  }
  return table;
}
