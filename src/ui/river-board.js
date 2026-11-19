// 강 건너기의 판을 그린다: 강가(와 가운데 섬), 그 사이의 물, 배와 거기에 탄 동물들.
// 누를 수 있는 판과 보기만 하는 그림(처음 화면, 공책, 풀이, "왜 그럴까?")을 같은 모양으로 그린다.
// 동물마다 자리가 정해져 있다(번호 순서로 두 줄씩). 어느 곳에 있든 그 곳의 같은 자리에 선다. 그래서 동물이 이리저리 옮겨 다니지 않는다.
// 배는 지금 있는 곳의 아래쪽 물에 대어 있고, 탄 동물은 배 위에 앉는다.
// 색만으로 알리지 않는다. 동물마다 귀와 코의 모양이 다르고, 엄마와 아기는 크기가 다르다. 코끼리는 크고 생쥐는 작다.
// 배가 못 떠나는 까닭은 그림으로 보인다: 함께 있으면 안 되는 동물에 굵은 점선 고리를 두르고, 그 일이 생기는 곳(강가, 섬, 배)에 굵은 점선 테두리를 친다.
// 글자는 형식(src/formats/river.js)이 대본에서 채워 건넨다. 이 파일에는 글을 적지 않는다.
import { boatOf, castOf, placesOf } from '../core/river.js';

const NS = 'http://www.w3.org/2000/svg';
const CELL = 100; // 동물 하나의 자리
const PAD = 12; // 땅의 안쪽 틈
const GAP = 64; // 곳과 곳 사이의 물
const TOP = 10; // 위쪽 틈
const LANE = 132; // 배가 다니는 아래쪽 물의 높이
const SEAT = 92; // 배의 자리 하나의 너비
const BOAT_SCALE = 0.82; // 배에 탄 동물은 조금 작게 그린다

/** 동물마다의 크기: 엄마, 할머니, 코끼리는 크게, 아기와 생쥐는 작게 */
const SIZE = { mother: 1, baby: 0.66, heavy: 0.96, light: 0.6, grandma: 0.98, pet: 0.8 };
const PET_SIZE = { chick: 0.64, fish: 0.78 };

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

const circle = (cx, cy, r, cls) => make('circle', { cx, cy, r }, cls);
const ellipse = (cx, cy, rx, ry, cls) => make('ellipse', { cx, cy, rx, ry }, cls);
const poly = (points, cls) => make('polygon', { points }, cls);
const path = (d, cls) => make('path', { d }, cls);
const eyes = (y = -6, apart = 13) => [circle(-apart, y, 4.5, 'rv-ink'), circle(apart, y, 4.5, 'rv-ink')];

/** 동물 그림. 가운데가 (0, 0)이고 반지름 46 안쪽에 들어간다 */
const ART = {
  bear: () => [
    circle(-26, -26, 13, 'rv-skin'),
    circle(26, -26, 13, 'rv-skin'),
    circle(-26, -26, 6, 'rv-light'),
    circle(26, -26, 6, 'rv-light'),
    circle(0, 0, 36, 'rv-skin'),
    ellipse(0, 14, 16, 12, 'rv-light'),
    ellipse(0, 8, 6.5, 5, 'rv-ink'),
    ...eyes(),
  ],
  rabbit: () => [
    ellipse(-13, -42, 9, 24, 'rv-skin'),
    ellipse(13, -42, 9, 24, 'rv-skin'),
    ellipse(-13, -42, 4, 15, 'rv-pink'),
    ellipse(13, -42, 4, 15, 'rv-pink'),
    circle(0, 2, 33, 'rv-skin'),
    ellipse(0, 10, 5, 4, 'rv-pink'),
    path('M -9 18 Q 0 24 9 18', 'rv-stroke'),
    ...eyes(-4, 12),
  ],
  duck: () => [
    path('M -6 -34 Q 0 -48 8 -36', 'rv-stroke'),
    circle(0, 0, 34, 'rv-skin'),
    ellipse(0, 14, 21, 9, 'rv-bill'),
    path('M -17 14 L 17 14', 'rv-stroke'),
    ...eyes(-8, 13),
  ],
  pig: () => [
    poly('-31,-16 -24,-44 -6,-30', 'rv-skin'),
    poly('31,-16 24,-44 6,-30', 'rv-skin'),
    circle(0, 0, 35, 'rv-skin'),
    ellipse(0, 11, 16, 11, 'rv-light'),
    ellipse(-5, 11, 2.5, 4, 'rv-ink'),
    ellipse(5, 11, 2.5, 4, 'rv-ink'),
    ...eyes(-10, 13),
  ],
  sheep: () => [
    ...[
      [-30, -10],
      [-25, -28],
      [-10, -38],
      [10, -38],
      [25, -28],
      [30, -10],
      [-28, 10],
      [28, 10],
    ].map(([x, y]) => circle(x, y, 13, 'rv-wool')),
    ellipse(0, 4, 22, 30, 'rv-skin'),
    circle(-9, -4, 4.5, 'rv-white'),
    circle(9, -4, 4.5, 'rv-white'),
    ellipse(0, 18, 6, 4, 'rv-ink'),
  ],
  elephant: () => [
    circle(-31, -4, 21, 'rv-dark'),
    circle(31, -4, 21, 'rv-dark'),
    circle(0, -2, 33, 'rv-skin'),
    path('M -9 12 Q -12 38 6 44', 'rv-trunk-line'),
    path('M -9 12 Q -12 38 6 44', 'rv-trunk'),
    ...eyes(-10, 13),
  ],
  mouse: () => [
    circle(-25, -22, 16, 'rv-skin'),
    circle(25, -22, 16, 'rv-skin'),
    circle(-25, -22, 8, 'rv-pink'),
    circle(25, -22, 8, 'rv-pink'),
    circle(0, 4, 29, 'rv-skin'),
    circle(0, 16, 5, 'rv-ink'),
    path('M -6 18 L -30 14 M -6 20 L -30 24 M 6 18 L 30 14 M 6 20 L 30 24', 'rv-stroke'),
    ...eyes(-2, 11),
  ],
  dog: () => [
    circle(0, 0, 34, 'rv-skin'),
    ellipse(-31, 4, 11, 23, 'rv-dark'),
    ellipse(31, 4, 11, 23, 'rv-dark'),
    ellipse(0, 15, 15, 11, 'rv-light'),
    ellipse(0, 9, 7, 5, 'rv-ink'),
    path('M -4 22 Q 0 26 4 22', 'rv-stroke'),
    ...eyes(-6, 13),
  ],
  cat: () => [
    poly('-31,-12 -26,-46 -6,-31', 'rv-skin'),
    poly('31,-12 26,-46 6,-31', 'rv-skin'),
    circle(0, 0, 34, 'rv-skin'),
    path('M -8 -32 L -8 -22 M 0 -34 L 0 -22 M 8 -32 L 8 -22', 'rv-stripe'),
    poly('-5,8 5,8 0,14', 'rv-pink'),
    path('M -8 14 L -32 10 M -8 17 L -32 20 M 8 14 L 32 10 M 8 17 L 32 20', 'rv-stroke'),
    ellipse(-12, -5, 4, 6.5, 'rv-ink'),
    ellipse(12, -5, 4, 6.5, 'rv-ink'),
  ],
  chick: () => [
    path('M -4 -30 Q -6 -44 4 -40 M 2 -31 Q 8 -44 14 -36', 'rv-stroke'),
    circle(0, 0, 31, 'rv-skin'),
    ellipse(-20, 10, 9, 13, 'rv-light'),
    poly('-8,4 8,4 0,16', 'rv-bill'),
    ...eyes(-8, 11),
  ],
  fish: () => [
    poly('22,0 44,-20 44,20', 'rv-skin'),
    ellipse(-4, 0, 33, 21, 'rv-skin'),
    path('M -2 -20 Q 6 -32 16 -18', 'rv-skin'),
    path('M 4 -16 Q 0 0 4 16 M 12 -14 Q 8 0 12 14', 'rv-stripe'),
    circle(-20, -4, 6, 'rv-white'),
    circle(-21, -4, 3, 'rv-ink'),
  ],
  grandma: () => [
    circle(0, -4, 37, 'rv-hair'),
    circle(0, -40, 13, 'rv-hair'),
    circle(0, 6, 29, 'rv-skin'),
    path('M -26 -6 Q 0 -26 26 -6', 'rv-hair'),
    circle(-11, 4, 8, 'rv-glass'),
    circle(11, 4, 8, 'rv-glass'),
    path('M -3 4 L 3 4', 'rv-stroke'),
    circle(-11, 4, 2.5, 'rv-ink'),
    circle(11, 4, 2.5, 'rv-ink'),
    path('M -8 20 Q 0 26 8 20', 'rv-stroke'),
  ],
};

/** 동물 하나의 크기 */
export function sizeOf(member) {
  if (member.role === 'pet') return PET_SIZE[member.kind] ?? SIZE.pet;
  return SIZE[member.role] ?? 1;
}

/** 동물 그림 하나(묶음). 가운데가 (0, 0)이다 */
export function drawMember(member) {
  const group = make('g', {}, `rv-art rv-${member.kind} rv-${member.role}`);
  group.append(...ART[member.kind]());
  return group;
}

/** 판의 크기와 곳마다의 자리 */
export function layoutOf(board) {
  const cast = castOf(board);
  const places = placesOf(board);
  const rows = Math.ceil(cast.length / 2);
  const boatW = boatOf(board).seats * SEAT + 40;
  const placeW = Math.max(2 * CELL, boatW) + 2 * PAD;
  const landH = rows * CELL + 2 * PAD;
  const width = places * placeW + (places - 1) * GAP;
  const height = TOP + landH + LANE;
  const left = (place) => place * (placeW + GAP);
  return {
    cast,
    places,
    width,
    height,
    placeW,
    landH,
    boatW,
    left,
    /** 동물 id가 place에 서는 자리의 가운데 */
    slot(id, place) {
      const row = Math.floor(id / 2);
      const col = id % 2;
      return [left(place) + placeW / 2 + (col - 0.5) * CELL, TOP + PAD + row * CELL + CELL / 2];
    },
    /** 배가 place에 대어 있을 때 배의 가운데(물 위)와 seat번째 자리 */
    boatAt(place) {
      return [left(place) + placeW / 2, TOP + landH + LANE - 34];
    },
    seatAt(place, seat, filled) {
      const [cx, cy] = [left(place) + placeW / 2, TOP + landH + LANE - 34];
      return [cx + (seat - (filled - 1) / 2) * SEAT, cy - 34];
    },
  };
}

const boards = new WeakMap();

/** 그릴 자리에 판을 한 번 만들어 둔다. 누르는 것은 그 판에서 받는다 */
function boardOf(root) {
  let board = boards.get(root);
  if (board && board.svg.parentNode === root) return board;
  const svg = make('svg', { preserveAspectRatio: 'xMidYMid meet' });
  board = { svg, view: null, pointer: false };
  boards.set(root, board);
  // 손가락으로 누른 뒤에는 다시 그린 판에서 초점을 되살리지 않는다(누른 동물에 초점 테두리가 남지 않게). 글자판으로 옮겨 다닐 때만 되살린다.
  svg.addEventListener('pointerdown', () => {
    board.pointer = true;
  });
  svg.addEventListener('click', (event) => {
    const target = event.target.closest?.('[data-who]');
    if (!target || !board.view?.onTap) return;
    board.view.onTap(Number(target.dataset.who));
  });
  // 글자판으로도 누를 수 있다.
  svg.addEventListener('keydown', (event) => {
    board.pointer = false;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target.closest?.('[data-who]');
    if (!board.view?.onTap || !target) return;
    event.preventDefault();
    board.view.onTap(Number(target.dataset.who));
  });
  root.replaceChildren(svg);
  return board;
}

/**
 * 판을 그린다.
 * @param {HTMLElement} root 그릴 자리(안의 것을 모두 바꾼다)
 * @param {object} view
 *   board    판
 *   state    { at, boat } 지금 모습
 *   aboard   배에 탄 동물들(배가 있는 곳의 동물들 가운데)
 *   mark     { who, place, boat } 판에서 보여 줄 것: who에 고리, place의 땅에 점선 테두리, boat가 true면 배에 점선 테두리. 없으면 null
 *   sailed   배가 방금 떠나온 곳(배가 미끄러져 오는 것을 보인다). 없으면 null
 *   landed   방금 내린 동물들
 *   label    (동물 번호) → 읽어 줄 이름(누를 수 있는 판에서만)
 *   onTap    (동물 번호) → 눌렀을 때. 없으면 그림으로만 그린다
 *   small    작은 그림으로 그린다
 *   bare     동물 없이 강과 배만 그린다(아직 정하지 않은 빈 판)
 */
export function drawRiver(root, view) {
  const { board, state, aboard = [], mark = null, sailed = null, landed = [], small = false, bare = false } = view;
  const live = Boolean(view.onTap);
  root.className = `river-board${small ? ' small' : ''}${live ? ' live' : ''}`;
  const lay = layoutOf(board);
  const holder = boardOf(root);
  const { svg } = holder;
  const focused = svg.contains(document.activeElement) ? document.activeElement.dataset.who : undefined;
  svg.setAttribute('viewBox', `0 0 ${lay.width} ${lay.height}`);
  svg.setAttribute('class', 'river-svg');
  root.style.setProperty('--ratio', String(lay.width / lay.height));
  if (live) svg.removeAttribute('aria-hidden');
  else svg.setAttribute('aria-hidden', 'true');

  const nodes = [];
  // 물: 판 전체에 깔고, 그 위에 땅을 놓는다. 곳 사이와 아래쪽에 물이 보인다.
  nodes.push(make('rect', { x: 0, y: TOP + 26, width: lay.width, height: lay.height - TOP - 26, rx: 18 }, 'rv-water'));
  for (let x = 30; x < lay.width - 30; x += 120) nodes.push(path(`M ${x} ${lay.height - 14} q 15 -8 30 0 q 15 8 30 0`, 'rv-wave'));
  for (let place = 0; place < lay.places; place++) {
    const island = lay.places === 3 && place === 1;
    const names = ['rv-land', island ? 'island' : 'bank'];
    if (mark && mark.place === place && !mark.boat) names.push('marked');
    nodes.push(make('rect', { x: lay.left(place), y: TOP, width: lay.placeW, height: lay.landH, rx: island ? 40 : 16 }, names.join(' ')));
  }

  const ring = (x, y, scale) => circle(x, y, 46 * scale + 8, 'rv-ring');
  const who = (id, x, y, scale, extra = '') => {
    const member = lay.cast[id];
    const group = make('g', { 'data-who': id }, `rv-who${extra}`);
    // 누르는 자리는 그림보다 넓게 둔다(자리 하나 전체).
    group.append(make('rect', { x: x - CELL / 2, y: y - CELL / 2, width: CELL, height: CELL, rx: 14 }, 'rv-hit'));
    const art = drawMember(member);
    art.setAttribute('transform', `translate(${x} ${y}) scale(${scale})`);
    group.append(art);
    if (mark?.who?.includes(id)) group.append(ring(x, y, scale));
    if (live && view.label) {
      group.setAttribute('tabindex', '0');
      group.setAttribute('role', 'button');
      group.setAttribute('aria-label', view.label(id));
    }
    return group;
  };

  // 강가와 섬에 선 동물들
  state.at.forEach((place, id) => {
    if (bare || (place === state.boat && aboard.includes(id))) return;
    const [x, y] = lay.slot(id, place);
    nodes.push(who(id, x, y, sizeOf(lay.cast[id]), landed.includes(id) ? ' landed' : ''));
  });

  // 배와 탄 동물들
  const boat = make('g', {}, 'rv-boat-move');
  const [bx, by] = lay.boatAt(state.boat);
  if (sailed !== null && sailed !== state.boat && !small) {
    boat.classList.add('sailing');
    boat.setAttribute('style', `--dx: ${lay.boatAt(sailed)[0] - bx}px`);
  }
  const hull = make('path', { d: `M ${bx - lay.boatW / 2} ${by - 16} L ${bx + lay.boatW / 2} ${by - 16} L ${bx + lay.boatW / 2 - 26} ${by + 20} L ${bx - lay.boatW / 2 + 26} ${by + 20} Z` }, `rv-hull${mark?.boat ? ' marked' : ''}`);
  boat.append(hull);
  aboard.forEach((id, seat) => {
    const [x, y] = lay.seatAt(state.boat, seat, aboard.length);
    boat.append(who(id, x, y, sizeOf(lay.cast[id]) * BOAT_SCALE));
  });
  boat.append(make('path', { d: `M ${bx - lay.boatW / 2 + 6} ${by - 10} L ${bx + lay.boatW / 2 - 6} ${by - 10}` }, 'rv-rim'));
  nodes.push(boat);

  svg.replaceChildren(...nodes);
  holder.view = view;
  if (focused !== undefined && !holder.pointer) svg.querySelector(`[data-who="${focused}"]`)?.focus?.();
}

/** 판 하나를 담은 새 조각(풀이와 "왜 그럴까?"의 그림). 아래에 한 줄 글을 붙일 수 있다. */
export function riverCard(view, note) {
  const card = el('div', 'river-card');
  const picture = el('div');
  card.append(picture);
  drawRiver(picture, { ...view, small: true });
  if (note) card.append(el('p', 'strip-note', note));
  return card;
}

/**
 * 차례대로 늘어놓은 판들(풀이). 판마다 앞에 이름을 붙인다.
 * @param {{caption: string, view: object}[]} steps
 */
export function riverSteps(steps) {
  const list = el('ol', 'river-steps');
  for (const step of steps) {
    const item = el('li', 'river-step');
    item.append(el('span', 'strip-caption', step.caption));
    const picture = el('div');
    item.append(picture);
    drawRiver(picture, { ...step.view, small: true });
    list.append(item);
  }
  return list;
}

/**
 * 할머니 없이 함께 두면 안 되는 짝들의 그림(판 옆에 둔다). 짝마다 두 동물 사이에 번개 모양을 그린다.
 * @param {HTMLElement} root
 * @param {{kind: string, role: string}[][]} pairs 두 동물의 짝들
 */
export function drawFights(root, pairs) {
  const rows = pairs.map(([a, b]) => {
    const svg = make('svg', { viewBox: '0 0 260 100', 'aria-hidden': 'true' }, 'rv-fight');
    const left = drawMember(a);
    left.setAttribute('transform', `translate(50 50) scale(${sizeOf(a)})`);
    const right = drawMember(b);
    right.setAttribute('transform', `translate(210 50) scale(${sizeOf(b)})`);
    svg.append(left, poly('122,18 146,46 128,50 140,82 112,50 130,46', 'rv-bolt'), right);
    return svg;
  });
  root.replaceChildren(...rows);
}
