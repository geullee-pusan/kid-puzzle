// 열쇠 미로의 판을 그린다: 네모 방들, 벽과 문(열린 문, 한쪽 문, 잠긴 문), 열쇠, 처음 방, 나가는 문, 걸어온 길, 지금 있는 곳.
// 누를 수 있는 판과 보기만 하는 그림을 같은 모양으로 그린다. 판의 자리 잡기는 조각 못 들어가게 막기의 판과 같은 이름표(block-board)를 쓴다.
// 색만으로 알리지 않는다. 열쇠와 잠긴 문은 색마다 모양(동그라미, 세모, 네모)이 함께 그려진다. 한쪽 문은 화살표,
// 지금 열려 있는 잠긴 문(연 문, 열쇠를 가진 문)은 속이 빈 점선 막대, 처음 방은 안쪽 실선 테두리와 이름, 나가는 문은 판 밖의 문 그림과 이름.
// "나갈 수 있는 방"(도구)은 빗금, 짚는 방은 두 겹 고리, 막힌 문이나 방은 점선 동그라미로 그린다. 글자는 대본에서 받는다.
// 누르는 것은 pointer 이벤트로 받는다. 걷는 판에서는 방을 누르거나 방을 따라 그은 차례를 받고(onWalk), 만드는 판에서는 방과 문 자리를 받는다(onEdit).

const NS = 'http://www.w3.org/2000/svg';
const UNIT = 100; // 방 하나의 크기
const EDGE = 74; // 판 둘레에 두는 자리(나가는 문 그림이 들어간다)
const GAP = 44; // 문의 너비
const TAP = 22; // 이보다 적게 움직이면 누른 것으로 본다
const NEAR = 26; // 만드는 판에서 변에서 이만큼 안쪽을 누르면 문 자리를 누른 것으로 본다
/** 색마다 그리는 모양 */
export const KEY_SHAPES = ['circle', 'triangle', 'square'];

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

const xyOf = (w, room) => [room % w, Math.floor(room / w)];
const centre = (w, room) => [(room % w) * UNIT + UNIT / 2, Math.floor(room / w) * UNIT + UNIT / 2];

/** 색의 모양 하나(가운데 cx, cy, 크기 r) */
export function shapeOf(color, cx, cy, r, className) {
  const kind = KEY_SHAPES[color];
  if (kind === 'circle') return make('circle', { cx, cy, r: r * 0.9 }, className);
  if (kind === 'triangle') return make('polygon', { points: `${cx},${cy - r} ${cx + r * 0.95},${cy + r * 0.75} ${cx - r * 0.95},${cy + r * 0.75}` }, className);
  return make('rect', { x: cx - r * 0.8, y: cy - r * 0.8, width: r * 1.6, height: r * 1.6 }, className);
}

/** 열쇠 하나(고리 가운데가 cx, cy). 고리 안에 색의 모양을 그린다 */
export function keyNode(color, cx, cy, scale = 1) {
  const group = make('g', { transform: `translate(${cx} ${cy}) scale(${scale})` }, `km-key c${color}`);
  group.append(
    make('rect', { x: 10, y: -5, width: 34, height: 10, rx: 3 }, 'km-key-body'),
    make('rect', { x: 32, y: 4, width: 7, height: 10 }, 'km-key-body'),
    make('rect', { x: 22, y: 4, width: 6, height: 8 }, 'km-key-body'),
    make('circle', { cx: 0, cy: 0, r: 17 }, 'km-key-body'),
    shapeOf(color, 0, 0, 9, 'km-key-mark'),
  );
  return group;
}

/** 작은 열쇠 그림 하나(판 아래 "가진 열쇠" 줄과 오른쪽 칸의 약속 그림) */
export function keyIcon(color, label) {
  const svg = make('svg', label ? { viewBox: '-22 -22 70 44', role: 'img', 'aria-label': label } : { viewBox: '-22 -22 70 44', 'aria-hidden': 'true' }, 'km-key-icon');
  svg.append(keyNode(color, 0, 0));
  return svg;
}

/** 두 방 사이 문의 가운데와 방향(가로로 이웃하면 문이 세로로 서 있다) */
function doorSpot(w, a, b) {
  const [ax, ay] = xyOf(w, a);
  if (b === a + 1) return { x: (ax + 1) * UNIT, y: ay * UNIT + UNIT / 2, upright: true };
  return { x: ax * UNIT + UNIT / 2, y: (ay + 1) * UNIT, upright: false };
}

/** 나가는 문의 가운데와 판 밖 그림의 자리 */
function exitSpot(w, exit) {
  const [x, y] = xyOf(w, exit.room);
  const spots = {
    n: { x: x * UNIT + UNIT / 2, y: y * UNIT, dx: 0, dy: -1, upright: false },
    s: { x: x * UNIT + UNIT / 2, y: (y + 1) * UNIT, dx: 0, dy: 1, upright: false },
    w: { x: x * UNIT, y: y * UNIT + UNIT / 2, dx: -1, dy: 0, upright: true },
    e: { x: (x + 1) * UNIT, y: y * UNIT + UNIT / 2, dx: 1, dy: 0, upright: true },
  };
  const spot = spots[exit.side];
  // 판 밖 그림의 네모(누를 수 있는 곳)
  // 나가는 문이 잠겨 있으면 문 자리에 막대가 그려지므로, 그림은 벽에서 조금 떨어뜨린다
  const depth = EDGE - 20;
  const gap = 14;
  const wide = 92;
  const box = spot.upright
    ? { x: spot.dx > 0 ? spot.x + gap : spot.x - gap - depth, y: spot.y - wide / 2, width: depth, height: wide }
    : { x: spot.x - wide / 2, y: spot.dy > 0 ? spot.y + gap : spot.y - gap - depth, width: wide, height: depth };
  return { ...spot, box };
}

/** 화면의 자리를 판의 자리(방 하나가 100)로 바꾼다 */
function spotOf(svg, event) {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  return new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
}

/** 판의 자리 → 방 번호(판 밖의 나가는 문 그림이면 w × h, 그 밖이면 null) */
function roomOfSpot(view, spot) {
  const { w, h } = view;
  const x = Math.floor(spot.x / UNIT);
  const y = Math.floor(spot.y / UNIT);
  if (x >= 0 && x < w && y >= 0 && y < h) return y * w + x;
  if (view.exit) {
    // 판 밖의 나가는 문 그림보다 조금 넓게(벽에서 둘레 끝까지, 문 양옆으로 방 하나 너비만큼) 누른 것을 받는다. 손가락이 닿기 쉽게
    const spotOut = exitSpot(w, view.exit);
    const along = spotOut.upright ? Math.abs(spot.y - spotOut.y) : Math.abs(spot.x - spotOut.x);
    const away = spotOut.upright ? (spot.x - spotOut.x) * spotOut.dx : (spot.y - spotOut.y) * spotOut.dy;
    if (along <= UNIT / 2 + 10 && away > 0 && away <= EDGE + 10) return w * h;
  }
  return null;
}

/** 두 자리 사이를 잘게 나눠 지나는 방들(손가락이 빨리 움직여 방을 건너뛰어도 빠뜨리지 않게) */
function roomsBetween(view, from, to) {
  const far = Math.hypot(to.x - from.x, to.y - from.y);
  const parts = Math.max(1, Math.ceil(far / (UNIT / 10)));
  const rooms = [];
  for (let at = 1; at <= parts; at++) {
    const room = roomOfSpot(view, { x: from.x + ((to.x - from.x) * at) / parts, y: from.y + ((to.y - from.y) * at) / parts });
    if (room !== null && rooms.at(-1) !== room) rooms.push(room);
  }
  return rooms;
}

/** 만드는 판에서 누른 자리: 방, 두 방 사이의 문 자리, 판 가장자리의 변 */
function editOfSpot(view, spot) {
  const { w, h } = view;
  const x = Math.floor(spot.x / UNIT);
  const y = Math.floor(spot.y / UNIT);
  const inside = x >= 0 && x < w && y >= 0 && y < h;
  // 판 밖을 눌렀으면 가장 가까운 가장자리 방의 변이다
  if (!inside) {
    const cx = Math.min(w - 1, Math.max(0, x));
    const cy = Math.min(h - 1, Math.max(0, y));
    let side = null;
    if (spot.y < 0) side = 'n';
    else if (spot.y >= h * UNIT) side = 's';
    else if (spot.x < 0) side = 'w';
    else side = 'e';
    return { type: 'side', room: cy * w + cx, side };
  }
  const room = y * w + x;
  const lx = spot.x - x * UNIT;
  const ly = spot.y - y * UNIT;
  const sides = [
    ['n', ly],
    ['s', UNIT - ly],
    ['w', lx],
    ['e', UNIT - lx],
  ].sort((p, q) => p[1] - q[1]);
  const [side, gap] = sides[0];
  if (gap > NEAR) return { type: 'room', room };
  const other = { n: y > 0 ? room - w : null, s: y < h - 1 ? room + w : null, w: x > 0 ? room - 1 : null, e: x < w - 1 ? room + 1 : null }[side];
  if (other === null) return { type: 'side', room, side };
  return { type: 'edge', a: Math.min(room, other), b: Math.max(room, other) };
}

function drawLive(board) {
  const { view, press, liveLayer } = board;
  const nodes = [];
  if (press?.walking && view && press.rooms.length > 0) {
    for (const room of press.rooms) {
      if (room >= view.w * view.h) continue;
      const [cx, cy] = centre(view.w, room);
      nodes.push(make('rect', { x: cx - 40, y: cy - 40, width: 80, height: 80, rx: 14 }, 'km-live'));
    }
  }
  liveLayer.replaceChildren(...nodes);
}

/** 그릴 자리에 판을 한 번 만들어 둔다. 손가락을 긋는 동안에도 판이 바뀌지 않게, 안의 것만 바꿔 그린다. */
function boardOf(root) {
  let board = boards.get(root);
  if (board && board.svg.parentNode === root) return board;
  const svg = make('svg', { preserveAspectRatio: 'xMidYMid meet' });
  const mainLayer = make('g');
  const liveLayer = make('g');
  svg.append(mainLayer, liveLayer);
  board = { svg, mainLayer, liveLayer, view: null, press: null };
  boards.set(root, board);

  const live = () => board.view && (board.view.onWalk || board.view.onEdit);
  svg.addEventListener('pointerdown', (event) => {
    const view = board.view;
    if (!live()) return;
    const spot = spotOf(svg, event);
    if (!spot) return;
    const walking = Boolean(view.onWalk);
    const room = walking ? roomOfSpot(view, spot) : null;
    board.press = { id: event.pointerId, start: spot, last: spot, walking, rooms: room === null ? [] : [room] };
    if (walking) event.preventDefault();
    drawLive(board);
    try {
      svg.setPointerCapture(event.pointerId);
    } catch {
      // 붙잡지 못해도 누르는 것은 그대로 된다.
    }
  });
  svg.addEventListener('pointermove', (event) => {
    const press = board.press;
    const view = board.view;
    if (!press || !view || press.id !== event.pointerId || !press.walking) return;
    const spot = spotOf(svg, event);
    if (!spot) return;
    for (const room of roomsBetween(view, press.last, spot)) if (press.rooms.at(-1) !== room) press.rooms.push(room);
    press.last = spot;
    drawLive(board);
  });
  svg.addEventListener('pointerup', (event) => {
    const press = board.press;
    if (!press || press.id !== event.pointerId) return;
    const view = board.view;
    board.press = null;
    drawLive(board);
    if (!view) return;
    const spot = spotOf(svg, event) ?? press.last;
    const tap = Math.hypot(spot.x - press.start.x, spot.y - press.start.y) <= TAP;
    if (view.onEdit) {
      if (tap) view.onEdit(editOfSpot(view, press.start));
      return;
    }
    for (const room of roomsBetween(view, press.last, spot)) if (press.rooms.at(-1) !== room) press.rooms.push(room);
    if (press.rooms.length === 0) return;
    view.onWalk(tap ? [press.rooms[0]] : press.rooms.slice(), { tap });
  });
  svg.addEventListener('pointercancel', () => {
    board.press = null;
    drawLive(board);
  });
  // 글자판으로도 걸을 수 있다: 방(또는 나가는 문)에 눈길을 두고 들이기나 빈칸.
  svg.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const view = board.view;
    const target = event.target.closest?.('[data-room]');
    if (!live() || !target) return;
    event.preventDefault();
    const room = Number(target.dataset.room);
    if (view.onWalk) view.onWalk([room], { tap: true });
    else view.onEdit({ type: 'room', room });
  });
  root.replaceChildren(svg);
  return board;
}

/** 문 자리의 벽(가운데를 비운 두 토막) */
function wallWithGap(x1, y1, x2, y2, className) {
  const gap = GAP / 2;
  if (x1 === x2) {
    const mid = (y1 + y2) / 2;
    return [make('line', { x1, y1, x2, y2: mid - gap }, className), make('line', { x1, y1: mid + gap, x2, y2 }, className)];
  }
  const mid = (x1 + x2) / 2;
  return [make('line', { x1, y1, x2: mid - gap, y2 }, className), make('line', { x1: mid + gap, y1, x2, y2 }, className)];
}

/** 한쪽 문의 화살표(가운데 x, y에서 dx, dy 쪽을 가리킨다) */
function arrowNode(x, y, dx, dy) {
  const tip = [x + dx * 30, y + dy * 30];
  const back = [x - dx * 24, y - dy * 24];
  const px = -dy;
  const py = dx;
  const group = make('g', {}, 'km-arrow');
  group.append(
    make('line', { x1: back[0], y1: back[1], x2: x + dx * 8, y2: y + dy * 8 }, 'km-arrow-shaft'),
    make('polygon', { points: `${tip[0]},${tip[1]} ${x + px * 17 - dx * 2},${y + py * 17 - dy * 2} ${x - px * 17 - dx * 2},${y - py * 17 - dy * 2}` }, 'km-arrow-head'),
  );
  return group;
}

/** 잠긴 문의 막대(가운데 x, y). open이면 속이 빈 점선 막대로 그린다(지금 지나갈 수 있다) */
function lockNode(x, y, upright, color, open) {
  const long = GAP + 10;
  const thick = 26;
  const rect = upright ? { x: x - thick / 2, y: y - long / 2, width: thick, height: long } : { x: x - long / 2, y: y - thick / 2, width: long, height: thick };
  const group = make('g', {}, `km-lock c${color}${open ? ' open' : ''}`);
  group.append(make('rect', { ...rect, rx: 5 }, 'km-lock-bar'), shapeOf(color, x, y, 9, 'km-lock-mark'));
  return group;
}

/**
 * 판을 그린다.
 * @param {HTMLElement} root 그릴 자리(안의 것을 모두 바꾼다)
 * @param {object} view
 *   w, h, start, exit, doors, keys   판(src/core/keymaze.js)
 *   picked     주운 열쇠의 번호들(판에서 지운다)
 *   openDoors  지금 지나갈 수 있는 잠긴 문의 번호들(나가는 문은 doors.length). 속이 빈 점선 막대로 그린다
 *   walk       걸어온 방들(처음 방부터. 판 밖이면 w × h로 끝난다)
 *   me         지금 있는 방(없으면 그리지 않는다)
 *   marks      빗금을 그을 방들("나갈 수 있는 방")
 *   rings      두 겹 고리를 두를 방들
 *   refused    막힌 자리 { room } 또는 { a, b } 또는 { exit: true }(점선 동그라미)
 *   numbers    걸음마다 지나간 문에 차례를 적는가(풀이)
 *   words      { start, exit }: 처음 방과 나가는 문에 적는 이름
 *   label      (방, 판 밖이면 w × h) → 읽어 줄 이름(누를 수 있는 판에서만)
 *   onWalk     (방들, { tap }) → 방을 눌렀거나 따라 그었을 때(나가는 문 그림은 w × h)
 *   onEdit     ({ type: 'room', room } | { type: 'edge', a, b } | { type: 'side', room, side }) → 만드는 판에서 눌렀을 때
 *   small      작은 그림으로 그린다
 */
export function drawMaze(root, view) {
  const { w, h, start = null, exit = null, doors = [], keys = [], picked = [], openDoors = [], walk = [], me = null, marks = [], rings = [], refused = null, numbers = false, words = null, small = false } = view;
  const live = Boolean(view.onWalk || view.onEdit);
  root.className = `block-board km-board${small ? ' small' : ''}${live ? ' live' : ''}${view.onWalk ? ' walking' : ''}`;
  // 둘레의 자리: 나가는 문 쪽에만 문 그림이 들어갈 자리를 둔다(만드는 판은 나가는 문을 옮기므로 네 쪽 모두)
  const pad = (side) => (view.onEdit || exit?.side === side ? EDGE : 12);
  const [left, right, top, bottom] = [pad('w'), pad('e'), pad('n'), pad('s')];
  root.style.setProperty('--w', String(w + (left + right) / UNIT));
  root.style.setProperty('--h', String(h + (top + bottom) / UNIT));
  const board = boardOf(root);
  const { svg } = board;
  const focused = svg.contains(document.activeElement) ? document.activeElement.dataset?.room : undefined;
  svg.setAttribute('viewBox', `${-left} ${-top} ${w * UNIT + left + right} ${h * UNIT + top + bottom}`);
  svg.setAttribute('class', 'block-svg km-svg');
  if (live) svg.removeAttribute('aria-hidden');
  else svg.setAttribute('aria-hidden', 'true');
  const n = w * h;
  const nodes = [];
  const marked = new Set(marks);
  // 바닥
  for (let room = 0; room < n; room++) {
    const [x, y] = xyOf(w, room);
    const group = make('g', { 'data-room': room }, 'km-room-group');
    group.append(make('rect', { x: x * UNIT, y: y * UNIT, width: UNIT, height: UNIT }, `km-room${marked.has(room) ? ' marked' : ''}`));
    if (live && view.label) {
      group.setAttribute('tabindex', '0');
      group.setAttribute('role', 'button');
      group.setAttribute('aria-label', view.label(room));
    }
    nodes.push(group);
  }
  // 나갈 수 있는 방: 빗금
  for (const room of marked) {
    const [x, y] = xyOf(w, room);
    const group = make('g', {}, 'km-mark');
    for (const [x1, y1, x2, y2] of [
      [8, 40, 40, 8],
      [8, 72, 72, 8],
      [8, 92, 92, 8],
      [28, 92, 92, 28],
      [60, 92, 92, 60],
    ]) {
      group.append(make('line', { x1: x * UNIT + x1, y1: y * UNIT + y1, x2: x * UNIT + x2, y2: y * UNIT + y2 }));
    }
    nodes.push(group);
  }
  // 처음 방: 안쪽 테두리와 이름
  if (start !== null) {
    const [x, y] = xyOf(w, start);
    nodes.push(make('rect', { x: x * UNIT + 9, y: y * UNIT + 9, width: UNIT - 18, height: UNIT - 18, rx: 10 }, 'km-start'));
    if (words?.start) {
      const text = make('text', { x: x * UNIT + UNIT / 2, y: y * UNIT + UNIT - 7, 'text-anchor': 'middle' }, 'km-word');
      text.textContent = words.start;
      nodes.push(text);
    }
  }
  // 걸어온 길
  const inside = walk.filter((room) => room < n);
  if (walk.length > 1) {
    const points = walk.map((room) => {
      if (room < n) return centre(w, room);
      const spot = exitSpot(w, exit);
      return [spot.box.x + spot.box.width / 2, spot.box.y + spot.box.height / 2];
    });
    nodes.push(make('polyline', { points: points.map((point) => point.join(',')).join(' ') }, 'km-trail'));
  }
  for (const room of new Set(inside)) {
    const [cx, cy] = centre(w, room);
    nodes.push(make('circle', { cx, cy, r: 8 }, 'km-dot'));
  }
  // 벽과 문
  const doorAt = new Map(doors.map((door, index) => [`${door.a}-${door.b}`, { door, index }]));
  const open = new Set(openDoors);
  const decorations = [];
  for (let room = 0; room < n; room++) {
    const [x, y] = xyOf(w, room);
    const [x0, y0, x1, y1] = [x * UNIT, y * UNIT, (x + 1) * UNIT, (y + 1) * UNIT];
    const sides = [
      ['n', y > 0 ? room - w : null, [x0, y0, x1, y0]],
      ['e', x < w - 1 ? room + 1 : null, [x1, y0, x1, y1]],
      ['s', y < h - 1 ? room + w : null, [x0, y1, x1, y1]],
      ['w', x > 0 ? room - 1 : null, [x0, y0, x0, y1]],
    ];
    for (const [side, other, line] of sides) {
      if (other === null) {
        if (exit && exit.room === room && exit.side === side) nodes.push(...wallWithGap(...line, 'km-wall outer'));
        else nodes.push(make('line', { x1: line[0], y1: line[1], x2: line[2], y2: line[3] }, 'km-wall outer'));
        continue;
      }
      if (other < room) continue;
      const found = doorAt.get(`${room}-${other}`);
      if (!found) {
        nodes.push(make('line', { x1: line[0], y1: line[1], x2: line[2], y2: line[3] }, 'km-wall'));
        continue;
      }
      nodes.push(...wallWithGap(...line, 'km-wall'));
      const spot = doorSpot(w, room, other);
      if (found.door.kind === 'one') {
        const [tx, ty] = xyOf(w, found.door.to);
        const [fx, fy] = xyOf(w, found.door.to === room ? other : room);
        decorations.push(arrowNode(spot.x, spot.y, tx - fx, ty - fy));
      } else if (found.door.kind === 'lock') decorations.push(lockNode(spot.x, spot.y, spot.upright, found.door.color, open.has(found.index)));
    }
  }
  nodes.push(...decorations);
  // 나가는 문: 판 밖의 문 그림과 이름(잠겨 있으면 막대도)
  if (exit) {
    const spot = exitSpot(w, exit);
    const group = make('g', { 'data-room': n }, 'km-exit');
    const { box } = spot;
    group.append(make('rect', { ...box, rx: 12 }, 'km-exit-box'));
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    group.append(make('polygon', { points: spot.upright ? `${cx + spot.dx * 6},${cy - 10} ${cx + spot.dx * 20},${cy} ${cx + spot.dx * 6},${cy + 10}` : `${cx - 10},${cy + spot.dy * 12} ${cx},${cy + spot.dy * 24} ${cx + 10},${cy + spot.dy * 12}` }, 'km-exit-arrow'));
    if (words?.exit) {
      const text = make('text', { x: cx, y: cy + (spot.upright ? -16 : spot.dy > 0 ? -2 : 8), 'text-anchor': 'middle' }, 'km-word exit');
      text.textContent = words.exit;
      group.append(text);
    }
    if (live && view.label && view.onWalk) {
      group.setAttribute('tabindex', '0');
      group.setAttribute('role', 'button');
      group.setAttribute('aria-label', view.label(n));
    }
    nodes.push(group);
    if (exit.color !== null && exit.color !== undefined) nodes.push(lockNode(spot.x, spot.y, spot.upright, exit.color, open.has(doors.length)));
  }
  // 열쇠(주운 열쇠는 지운다)
  keys.forEach((key, index) => {
    if (picked.includes(index)) return;
    const [x, y] = xyOf(w, key.room);
    nodes.push(keyNode(key.color, x * UNIT + 34, y * UNIT + 30, 0.95));
  });
  // 걸음마다 지나간 문의 차례(풀이)
  if (numbers) {
    walk.slice(1).forEach((room, index) => {
      const from = walk[index];
      let spot;
      if (room >= n || from >= n) {
        const out = exitSpot(w, exit);
        spot = { x: out.x, y: out.y };
      } else spot = doorSpot(w, Math.min(from, room), Math.max(from, room));
      const shift = index % 2 === 0 ? -14 : 14;
      const cx = spot.x + (spot.upright ? 0 : shift);
      const cy = spot.y + (spot.upright ? shift : 0);
      nodes.push(make('circle', { cx, cy, r: 17 }, 'km-step-dot'));
      const text = make('text', { x: cx, y: cy + 8, 'text-anchor': 'middle' }, 'km-step');
      text.textContent = String(index + 1);
      nodes.push(text);
    });
  }
  // 짚는 방, 막힌 자리, 지금 있는 곳
  for (const room of rings) {
    const [cx, cy] = centre(w, room);
    nodes.push(make('circle', { cx, cy, r: 40 }, 'km-ring'), make('circle', { cx, cy, r: 31 }, 'km-ring inner'));
  }
  if (refused) {
    let spot = null;
    if (refused.exit) spot = exitSpot(w, exit);
    else if (Number.isInteger(refused.a)) spot = doorSpot(w, refused.a, refused.b);
    else if (Number.isInteger(refused.room)) {
      const [cx, cy] = centre(w, refused.room);
      spot = { x: cx, y: cy };
    }
    if (spot) nodes.push(make('circle', { cx: spot.x, cy: spot.y, r: 30 }, 'km-refused'));
  }
  if (me !== null) {
    let cx;
    let cy;
    if (me >= n) {
      const { box } = exitSpot(w, exit);
      cx = box.x + box.width / 2;
      cy = box.y + box.height / 2;
    } else [cx, cy] = centre(w, me);
    const group = make('g', {}, 'km-me');
    // 처음 방의 이름(방 아래쪽)을 가리지 않게 조금 위에 그린다
    group.append(make('circle', { cx, cy: cy - 2, r: 20 }, 'km-me-body'), make('circle', { cx, cy: cy - 25, r: 12 }, 'km-me-head'));
    nodes.push(group);
  }
  board.mainLayer.replaceChildren(...nodes);
  board.view = { ...view, w, h, exit };
  board.press = null;
  drawLive(board);
  if (focused !== undefined) svg.querySelector(`[data-room="${focused}"]`)?.focus?.();
}

/**
 * 판 하나를 담은 새 조각을 만든다(풀이, "왜 그럴까?", 직접 만들기의 그림). 아래에 한 줄 글을 붙일 수 있다.
 * @param {object} view drawMaze에 건네는 것
 * @param {string} note 아래에 붙이는 글
 * @param {{big?: boolean}} options big: 종이에 하나만 크게 그린다
 */
export function mazeCard(view, note, { big = false } = {}) {
  const card = el('div', big ? 'block-card km-card big' : 'block-card km-card');
  const picture = el('div');
  card.append(picture);
  drawMaze(picture, { ...view, small: true });
  if (note) card.append(el('p', 'strip-note', note));
  return card;
}

/** 문 하나의 작은 그림(오른쪽 칸의 약속 그림): 'open' | 'one' | 'lock' */
export function doorIcon(kind) {
  const svg = make('svg', { viewBox: '0 0 120 60', 'aria-hidden': 'true' }, 'km-door-icon');
  svg.append(make('rect', { x: 0, y: 0, width: 120, height: 60 }, 'km-room'));
  svg.append(...wallWithGap(60, 0, 60, 60, 'km-wall'));
  if (kind === 'one') svg.append(arrowNode(60, 30, 1, 0));
  if (kind === 'lock') svg.append(lockNode(60, 30, true, 0, false));
  return svg;
}
