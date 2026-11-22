// 손가락 더하기의 판을 그린다: 위에 선생님의 두 손(손가락이 아래로), 아래에 내 두 손(손가락이 위로), 손마다 손가락 수.
// 누를 수 있는 판과 보기만 하는 그림을 같은 모양으로 그린다(손 그림은 새로 그렸다).
// 색만으로 알리지 않는다. 내 손은 실선 테두리와 주황 소매, 선생님 손은 점선 테두리와 줄무늬 파란 소매다.
// 빠진 손은 손가락을 모두 접은 회색 주먹(점선)이고, 손가락 수 자리에 "빠짐"을 적는다(글은 대본에서 건네받는다).
// 방금 친 것은 친 손에서 맞은 손으로 가는 화살과 "+친 손가락 수"로 보인다. 맞은 손은 0.3초 동안 살짝 흔들린다(움직임을 줄이는 설정이면 없다).
// 누르는 것은 click으로 받는다(손가락으로 한 번 누르는 것). 글자판으로도 손을 골라 누를 수 있다.

const NS = 'http://www.w3.org/2000/svg';
export const WIDTH = 520;
export const HEIGHT = 600;
/** 손 하나의 그림 칸(누르는 칸도 이만큼이다) */
export const HAND_W = 150;
export const HAND_H = 190;
/** 두 손의 가운데 자리(가로) */
const COLUMNS = [140, 380];
/** 선생님 손의 위 끝과 내 손의 위 끝 */
const TEACHER_TOP = 82;
const KID_TOP = 328;

const boards = new WeakMap();

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

/** 손가락 자리(엄지가 오른쪽인 손, 손끝이 위): 새끼, 약지, 가운데, 검지의 왼쪽 끝과 위 끝 */
const FINGERS = [
  { x: 28, top: 52 },
  { x: 52, top: 30 },
  { x: 76, top: 20 },
  { x: 100, top: 30 },
];
/** 펴는 차례: 검지, 가운데, 약지, 새끼, 엄지 */
const RAISE = ['f3', 'f2', 'f1', 'f0', 'thumb'];

/** 손 하나(엄지가 오른쪽, 손끝이 위). count개의 손가락을 편다. 0이면 주먹 */
function handShape(count, side) {
  const up = new Set(RAISE.slice(0, count));
  const group = make('g', {}, `fg-hand fg-${side}${count === 0 ? ' fg-out' : ''}`);
  FINGERS.forEach((finger, index) => {
    const raised = up.has(`f${index}`);
    const top = raised ? finger.top : 84;
    group.append(make('rect', { x: finger.x, y: top, width: 20, height: 112 - top, rx: 10 }, raised ? 'fg-finger' : 'fg-finger folded'));
  });
  if (up.has('thumb')) group.append(make('rect', { x: 118, y: 92, width: 20, height: 54, rx: 10, transform: 'rotate(28 128 140)' }, 'fg-finger'));
  group.append(make('rect', { x: 24, y: 92, width: 104, height: 80, rx: 28 }, 'fg-palm'));
  if (!up.has('thumb')) group.append(make('rect', { x: 66, y: 126, width: 54, height: 20, rx: 10 }, 'fg-finger folded thumb'));
  group.append(make('rect', { x: 34, y: 170, width: 84, height: 20, rx: 4 }, 'fg-cuff'));
  if (side === 'teacher') {
    group.append(make('line', { x1: 40, y1: 175, x2: 112, y2: 175 }, 'fg-stripe'), make('line', { x1: 40, y1: 184, x2: 112, y2: 184 }, 'fg-stripe'));
  }
  return group;
}

/** 손 그림 칸의 왼쪽 위 */
function boxOf(side, index) {
  return [COLUMNS[index] - HAND_W / 2, side === 'teacher' ? TEACHER_TOP : KID_TOP];
}

/** 화살이 닿는 곳: 손끝 쪽 가운데 */
function tipOf(side, index) {
  const [x, y] = boxOf(side, index);
  return [x + HAND_W / 2, side === 'teacher' ? y + HAND_H - 6 : y + 6];
}

/** 그릴 자리에 판을 한 번 만들어 둔다. 안의 것만 바꿔 그린다(글자판으로 고른 손이 그대로 남게). */
function boardOf(root) {
  let board = boards.get(root);
  if (board && board.svg.parentNode === root) return board;
  const svg = make('svg', { viewBox: `0 0 ${WIDTH} ${HEIGHT}`, preserveAspectRatio: 'xMidYMid meet' });
  const layer = make('g');
  svg.append(layer);
  board = { svg, layer, view: null };
  boards.set(root, board);
  const press = (target) => {
    const view = board.view;
    const hand = target?.closest?.('[data-hand]');
    if (!view?.onHand || !hand) return false;
    view.onHand(hand.dataset.side, Number(hand.dataset.hand));
    return true;
  };
  svg.addEventListener('click', (event) => press(event.target));
  svg.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (press(event.target)) event.preventDefault();
  });
  root.replaceChildren(svg);
  return board;
}

/**
 * 판을 그린다.
 * @param {HTMLElement} root 그릴 자리(안의 것을 모두 바꾼다)
 * @param {object} view
 *   kid, teacher  두 손의 손가락 수([화면 왼쪽, 화면 오른쪽]. 0은 빠진 손)
 *   names         { kid, teacher, out }: 줄의 이름("나", "선생님")과 빠진 손에 적는 말. 없으면 적지 않는다
 *   last          방금 친 것 { side, from, to, power }(없으면 null)
 *   picked        내가 고른 손(0 | 1 | null)
 *   tap           누를 수 있는 손 { kid: [0, 1], teacher: [1] }처럼(점선 고리로 보인다)
 *   rings         두 겹 고리로 짚는 손들 [{ side, index }](그림)
 *   bump          방금 맞은 손을 흔든다(친 바로 그때만)
 *   label         (side, index) → 읽어 줄 이름(누를 수 있는 판에서만)
 *   onHand        (side, index) → 손을 눌렀을 때. 없으면 보기만 하는 그림이다
 *   small         작은 그림으로 그린다
 */
export function drawBoard(root, view) {
  const { kid, teacher, names = null, last = null, picked = null, tap = {}, rings = [], bump = false, small = false } = view;
  const live = typeof view.onHand === 'function';
  root.className = `fg-board${small ? ' small' : ''}${live ? ' live' : ''}`;
  const board = boardOf(root);
  const { svg } = board;
  const focused = svg.contains(document.activeElement) ? `${document.activeElement.dataset.side}${document.activeElement.dataset.hand}` : undefined;
  svg.setAttribute('class', 'fg-svg');
  if (live) svg.removeAttribute('aria-hidden');
  else svg.setAttribute('aria-hidden', 'true');

  const nodes = [];
  if (names) {
    const top = make('text', { x: WIDTH / 2, y: 26, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, 'fg-name teacher');
    top.textContent = names.teacher;
    const bottom = make('text', { x: WIDTH / 2, y: HEIGHT - 16, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, 'fg-name kid');
    bottom.textContent = names.kid;
    nodes.push(top, bottom);
  }
  const ringSet = new Set(rings.map((item) => `${item.side}${item.index}`));
  for (const [side, hands] of [['teacher', teacher], ['kid', kid]]) {
    hands.forEach((count, index) => {
      const [x, y] = boxOf(side, index);
      const group = make('g', { 'data-side': side, 'data-hand': index }, 'fg-hand-group');
      const open = (tap[side] ?? []).includes(index);
      group.append(make('rect', { x: x - 6, y: y - 6, width: HAND_W + 12, height: HAND_H + 12, rx: 22 }, `fg-spot${open ? ` open ${side}` : ''}`));
      // 엄지는 두 손의 가운데 쪽에 둔다. 선생님 손은 손끝이 아래로 오게 뒤집는다(뒤집으면 엄지의 쪽도 바뀐다)
      const thumbRight = (index === 0) === (side === 'kid');
      const flip = thumbRight ? '' : ` translate(${HAND_W} 0) scale(-1 1)`;
      const turn = side === 'teacher' ? ` rotate(180 ${HAND_W / 2} ${HAND_H / 2})` : '';
      const holder = make('g', { transform: `translate(${x} ${y})${turn}${flip}` });
      const shape = handShape(count, side);
      if (bump && last && last.to === index && last.side !== side) shape.classList.add('fg-bump');
      holder.append(shape);
      group.append(holder);
      // 손가락 수: 손목 쪽(선생님은 위, 나는 아래)
      const cy = side === 'teacher' ? TEACHER_TOP - 28 : KID_TOP + HAND_H + 26;
      const cx = x + HAND_W / 2;
      if (count > 0) {
        const chip = make('text', { x: cx, y: cy, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, `fg-count ${side}`);
        chip.textContent = String(count);
        group.append(side === 'kid' ? make('circle', { cx, cy, r: 22 }, 'fg-count-back kid') : make('rect', { x: cx - 21, y: cy - 21, width: 42, height: 42, rx: 8 }, 'fg-count-back teacher'), chip);
      } else if (names) {
        const word = make('text', { x: cx, y: cy, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, 'fg-count out');
        word.textContent = names.out;
        group.append(word);
      }
      if (picked === index && side === 'kid') group.append(make('rect', { x: x - 8, y: y - 8, width: HAND_W + 16, height: HAND_H + 16, rx: 24 }, 'fg-picked'));
      if (ringSet.has(`${side}${index}`)) group.append(make('rect', { x: x - 8, y: y - 8, width: HAND_W + 16, height: HAND_H + 16, rx: 24 }, 'fg-ring'), make('rect', { x: x + 2, y: y + 2, width: HAND_W - 4, height: HAND_H - 4, rx: 16 }, 'fg-ring inner'));
      if (live && open && view.label) {
        group.setAttribute('tabindex', '0');
        group.setAttribute('role', 'button');
        group.setAttribute('aria-label', view.label(side, index));
      }
      nodes.push(group);
    });
  }
  if (last) {
    // 방금 친 것: 친 손의 손끝에서 맞은 손의 손끝으로 가는 화살과 친 손가락 수
    const target = last.side === 'kid' ? 'teacher' : 'kid';
    const [x1, y1] = tipOf(last.side, last.from);
    const [x2, y2] = tipOf(target, last.to);
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const head = 14;
    const back = (turn) => [x2 - head * Math.cos(angle + turn), y2 - head * Math.sin(angle + turn)];
    const [ax, ay] = back(0.5);
    const [bx, by] = back(-0.5);
    nodes.push(make('line', { x1, y1, x2, y2 }, 'fg-arrow'), make('polygon', { points: `${x2},${y2} ${ax},${ay} ${bx},${by}` }, 'fg-arrow-head'));
    const mx = (x1 + x2) / 2 + (x1 === x2 ? 34 : 0);
    const my = (y1 + y2) / 2;
    const plus = make('text', { x: mx, y: my, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, 'fg-plus');
    plus.textContent = `+${last.power}`;
    nodes.push(make('rect', { x: mx - 24, y: my - 16, width: 48, height: 32, rx: 16 }, 'fg-plus-back'), plus);
  }

  board.layer.replaceChildren(...nodes);
  board.view = { ...view };
  if (focused !== undefined) svg.querySelector(`[data-side="${focused.slice(0, -1)}"][data-hand="${focused.slice(-1)}"]`)?.focus?.();
}

/**
 * 판 하나를 담은 새 조각을 만든다(다시 보기, 풀이, "왜 그럴까?"의 그림).
 * @param {object} view drawBoard에 건네는 것
 * @param {string} note 아래에 붙이는 글
 * @param {{big?: boolean}} options
 */
export function boardCard(view, note, { big = false } = {}) {
  const card = el('div', big ? 'fg-card big' : 'fg-card');
  const picture = el('div');
  card.append(picture);
  drawBoard(picture, { ...view, small: true });
  if (note) card.append(el('p', 'strip-note', note));
  return card;
}
