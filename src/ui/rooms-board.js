// 방 한 번씩 돌기의 판을 그린다: 집(네모 방들), 방 사이의 문, 정원, 처음 방과 끝 방, 그은 길, 적힌 차례, 색.
// 누를 수 있는 판과 보기만 하는 그림을 같은 모양으로 그린다.
// 색만으로 알리지 않는다. 처음 방은 안쪽에 굵은 실선 테두리와 이름, 끝 방은 굵은 점선 테두리와 이름, 정원은 풀 무늬,
// 색을 켜면 색마다 방 구석에 작은 모양(동그라미, 네모)도 함께 그린다(조각 덮기의 바둑판 무늬와 같은 색과 모양이다).
// 적힌 차례와 들어간 차례가 다른 방은 점선 고리, 그림에서 짚는 방은 두 겹 고리로 그린다. 글자는 대본에서 받는다.
// 누르는 것은 pointer 이벤트로 받는다. 방을 따라 그으면 길이 늘고, 바로 앞 방으로 되돌아가면 한 방 줄고, 손을 떼면 길을 알려 준다.

const NS = 'http://www.w3.org/2000/svg';
const UNIT = 100; // 방 하나의 크기
const EDGE = 8; // 집 둘레에 두는 자리
const DOOR = 36; // 문의 너비

/** 색마다 그리는 모양(조각 덮기의 바둑판 무늬와 같다) */
export const ROOM_MARKS = ['circle', 'square'];

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

const colorAt = (w, cell) => ((cell % w) + Math.floor(cell / w)) % 2;
const middle = (w, cell) => [(cell % w) * UNIT + UNIT / 2, Math.floor(cell / w) * UNIT + UNIT / 2];

/** 작은 모양 하나(가운데가 cx, cy) */
export function markShape(kind, cx, cy, r) {
  if (kind === 'circle') return make('circle', { cx, cy, r }, 'rm-mark');
  return make('rect', { x: cx - r, y: cy - r, width: 2 * r, height: 2 * r }, 'rm-mark');
}

/** 화면의 자리를 집의 칸 번호로 바꾼다. 집 밖이면 null */
function cellAt(svg, view, event) {
  const spot = spotOf(svg, event);
  return spot ? cellOfSpot(view, spot) : null;
}

/** 화면의 자리를 판의 자리(방 하나가 100)로 바꾼다 */
function spotOf(svg, event) {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  return new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
}

function cellOfSpot(view, spot) {
  const x = Math.floor(spot.x / UNIT);
  const y = Math.floor(spot.y / UNIT);
  if (x < 0 || x >= view.w || y < 0 || y >= view.h) return null;
  return y * view.w + x;
}

/** 두 자리 사이를 잘게 나눠 지나는 칸들을 차례로 낸다(손가락이 빨리 움직여 칸을 건너뛰어도 지난 방을 빠뜨리지 않게) */
function cellsBetween(view, from, to) {
  const far = Math.hypot(to.x - from.x, to.y - from.y);
  const parts = Math.max(1, Math.ceil(far / (UNIT / 5)));
  const cells = [];
  for (let at = 1; at <= parts; at++) {
    const cell = cellOfSpot(view, { x: from.x + ((to.x - from.x) * at) / parts, y: from.y + ((to.y - from.y) * at) / parts });
    if (cell !== null && cells.at(-1) !== cell) cells.push(cell);
  }
  return cells;
}

const isRoomIn = (view, cell) => cell !== null && !view.walls.includes(cell);
const nextTo = (view, a, b) => {
  const [ax, ay] = [a % view.w, Math.floor(a / view.w)];
  const [bx, by] = [b % view.w, Math.floor(b / view.w)];
  return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
};

/**
 * 누른 방으로 길을 바꾼다(누르기 하나).
 *   지금 있는 방(길의 끝)이면 그대로, 지나온 방이면 거기까지 남기고, 길의 끝과 이웃한 새 방이면 한 방 늘린다. 그 밖이면 null
 *   끝 방에 들어가면 거기서 더 가지 않는다(끝 방은 맨 마지막 방이다)
 */
export function pressPath(view, path, cell) {
  if (!isRoomIn(view, cell)) return null;
  const at = path.indexOf(cell);
  if (at >= 0) return path.slice(0, at + 1);
  if (path.length > 0 && path.at(-1) !== view.end && nextTo(view, path.at(-1), cell)) return [...path, cell];
  return null;
}

/** 긋는 동안: 길의 끝과 이웃한 새 방이면 늘리고, 바로 앞 방으로 되돌아가면 줄인다. 그 밖이면 그대로 */
export function stretchPath(view, path, cell) {
  if (!isRoomIn(view, cell) || cell === path.at(-1)) return path;
  if (path.length >= 2 && cell === path.at(-2)) return path.slice(0, -1);
  if (!path.includes(cell) && path.at(-1) !== view.end && nextTo(view, path.at(-1), cell)) return [...path, cell];
  return path;
}

/** 길과 들어간 차례를 그린다 */
function pathNodes(view, path) {
  const { w } = view;
  const nodes = [];
  if (path.length > 1) {
    nodes.push(make('polyline', { points: path.map((cell) => middle(w, cell).join(',')).join(' ') }, 'rm-path'));
  }
  path.forEach((cell, at) => {
    const [cx, cy] = middle(w, cell);
    if (at === path.length - 1) {
      nodes.push(make('circle', { cx, cy, r: 17 }, 'rm-head'));
    } else nodes.push(make('circle', { cx, cy, r: 9 }, 'rm-dot'));
  });
  if (view.steps) {
    const given = new Set((view.numbers ?? []).map(([cell]) => cell));
    path.forEach((cell, at) => {
      if (given.has(cell)) return;
      const x = (cell % w) * UNIT;
      const y = Math.floor(cell / w) * UNIT;
      const text = make('text', { x: x + UNIT - 12, y: y + 32, 'text-anchor': 'end' }, 'rm-step');
      text.textContent = String(at + 1);
      nodes.push(text);
    });
  }
  return nodes;
}

function drawLive(board) {
  const { view, press, liveLayer } = board;
  const path = press && press.path ? press.path : view.path ?? [];
  liveLayer.replaceChildren(...pathNodes(view, path));
}

/** 그릴 자리에 판을 한 번 만들어 둔다. 손가락을 긋는 동안에도 판이 바뀌지 않게, 안의 것만 바꿔 그린다. */
function boardOf(root) {
  let board = boards.get(root);
  if (board && board.svg.parentNode === root) return board;
  const svg = make('svg', { preserveAspectRatio: 'xMidYMid meet' });
  const mainLayer = make('g');
  const liveLayer = make('g');
  const topLayer = make('g');
  svg.append(mainLayer, liveLayer, topLayer);
  board = { svg, mainLayer, liveLayer, topLayer, view: null, press: null };
  boards.set(root, board);

  const letGo = () => {
    board.press = null;
    drawLive(board);
  };

  svg.addEventListener('pointerdown', (event) => {
    const view = board.view;
    if (!view || !(view.onPath || view.onCell)) return;
    const cell = cellAt(svg, view, event);
    if (cell === null) return;
    event.preventDefault();
    if (view.onCell) {
      board.press = { id: event.pointerId, cell, path: null };
    } else {
      const path = pressPath(view, view.path ?? [], cell);
      board.press = { id: event.pointerId, cell, path, miss: path === null, spot: spotOf(svg, event) };
      drawLive(board);
    }
    try {
      svg.setPointerCapture(event.pointerId);
    } catch {
      // 붙잡지 못해도 누르는 것은 그대로 된다.
    }
  });
  svg.addEventListener('pointermove', (event) => {
    const press = board.press;
    const view = board.view;
    if (!press || !view || press.id !== event.pointerId || !press.path) return;
    const spot = spotOf(svg, event);
    if (!spot) return;
    let next = press.path;
    for (const cell of cellsBetween(view, press.spot ?? spot, spot)) next = stretchPath(view, next, cell);
    press.spot = spot;
    if (next === press.path) return;
    press.path = next;
    drawLive(board);
  });
  svg.addEventListener('pointerup', (event) => {
    const press = board.press;
    if (!press || press.id !== event.pointerId) return;
    const view = board.view;
    const end = view ? cellAt(svg, view, event) : null;
    board.press = null;
    if (!view) return;
    if (view.onCell) {
      if (end === press.cell) view.onCell(press.cell);
      return;
    }
    // 마지막으로 움직인 자리에서 손을 뗀 자리까지 지난 방도 넣는다
    const spot = spotOf(svg, event);
    let path = press.path;
    if (path && spot && press.spot) for (const cell of cellsBetween(view, press.spot, spot)) path = stretchPath(view, path, cell);
    drawLive(board);
    if (press.miss) view.onMiss?.(press.cell);
    else view.onPath(path.slice());
  });
  svg.addEventListener('pointercancel', letGo);
  // 글자판으로도 누를 수 있다.
  svg.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const view = board.view;
    const target = event.target.closest?.('[data-cell]');
    if (!view || !target || !(view.onPath || view.onCell)) return;
    event.preventDefault();
    const cell = Number(target.dataset.cell);
    if (view.onCell) {
      view.onCell(cell);
      return;
    }
    const path = pressPath(view, view.path ?? [], cell);
    if (path === null) view.onMiss?.(cell);
    else view.onPath(path);
  });
  root.replaceChildren(svg);
  return board;
}

/** 칸 하나의 네 변: [이웃 칸 또는 null, 변의 두 끝] */
function sidesOf(w, h, cell) {
  const x = cell % w;
  const y = Math.floor(cell / w);
  const [x0, y0, x1, y1] = [x * UNIT, y * UNIT, (x + 1) * UNIT, (y + 1) * UNIT];
  return [
    [y > 0 ? cell - w : null, [x0, y0, x1, y0]],
    [x < w - 1 ? cell + 1 : null, [x1, y0, x1, y1]],
    [y < h - 1 ? cell + w : null, [x0, y1, x1, y1]],
    [x > 0 ? cell - 1 : null, [x0, y0, x0, y1]],
  ];
}

/**
 * 집을 그린다.
 * @param {HTMLElement} root 그릴 자리(안의 것을 모두 바꾼다)
 * @param {object} view
 *   w, h, walls, start, end, numbers   집(start나 end가 null이면 그 방을 그리지 않는다)
 *   path      그은 길(칸 번호들)
 *   colorOn   색을 켰는가
 *   steps     길에서 들어간 차례를 방 구석에 적는가
 *   wrong     적힌 차례와 들어간 차례가 다른 방들(점선 고리)
 *   rings     그림에서 짚는 방들(두 겹 고리)
 *   words     { start, end }: 처음 방과 끝 방에 적는 이름
 *   label     (칸 번호) → 읽어 줄 이름(누를 수 있는 판에서만)
 *   onPath    (길) → 누르거나 긋고 손을 뗐을 때 바뀐 길
 *   onMiss    (칸 번호) → 갈 수 없는 방을 눌렀을 때
 *   onCell    (칸 번호) → 어느 칸이든 눌렀을 때(직접 만들기). 이것이 있으면 긋기는 받지 않는다
 *   small     작은 그림으로 그린다
 */
export function drawHouse(root, view) {
  const { w, h, walls, start = null, end = null, numbers = [], path = [], colorOn = false, wrong = [], rings = [], words = null, small = false } = view;
  const live = Boolean(view.onPath || view.onCell);
  root.className = `rm-board${small ? ' small' : ''}${live ? ' live' : ''}`;
  root.style.setProperty('--w', String(w));
  root.style.setProperty('--h', String(h));
  const board = boardOf(root);
  const { svg } = board;
  const focused = svg.contains(document.activeElement) ? document.activeElement.dataset.cell : undefined;
  svg.setAttribute('viewBox', `${-EDGE} ${-EDGE} ${w * UNIT + 2 * EDGE} ${h * UNIT + 2 * EDGE}`);
  svg.setAttribute('class', 'rm-svg');
  if (live) svg.removeAttribute('aria-hidden');
  else svg.setAttribute('aria-hidden', 'true');

  const garden = new Set(walls);
  const nodes = [];
  // 바닥: 방, 정원
  for (let cell = 0; cell < w * h; cell++) {
    const x = (cell % w) * UNIT;
    const y = Math.floor(cell / w) * UNIT;
    const group = make('g', { 'data-cell': cell }, 'rm-cell');
    if (garden.has(cell)) {
      group.append(make('rect', { x, y, width: UNIT, height: UNIT }, 'rm-garden'));
      for (const [gx, gy] of [[26, 34], [62, 28], [40, 68], [74, 70]]) {
        group.append(make('polyline', { points: `${x + gx - 9},${y + gy} ${x + gx - 3},${y + gy + 12} ${x + gx + 3},${y + gy - 2} ${x + gx + 9},${y + gy + 12}` }, 'rm-grass'));
      }
    } else {
      const names = ['rm-floor'];
      if (colorOn) names.push(`rm-color-${colorAt(w, cell)}`);
      group.append(make('rect', { x, y, width: UNIT, height: UNIT }, names.join(' ')));
    }
    if (live && view.label) {
      group.setAttribute('tabindex', '0');
      group.setAttribute('role', 'button');
      group.setAttribute('aria-label', view.label(cell));
    }
    nodes.push(group);
  }
  // 색을 켜면 방 구석에 색의 모양
  if (colorOn) {
    for (let cell = 0; cell < w * h; cell++) {
      if (garden.has(cell)) continue;
      const x = (cell % w) * UNIT;
      const y = Math.floor(cell / w) * UNIT;
      nodes.push(markShape(ROOM_MARKS[colorAt(w, cell)], x + 19, y + 19, 8));
    }
  }
  // 처음 방과 끝 방: 안쪽 테두리와 이름
  for (const [cell, kind] of [[start, 'start'], [end, 'end']]) {
    if (cell === null || garden.has(cell)) continue;
    const x = (cell % w) * UNIT;
    const y = Math.floor(cell / w) * UNIT;
    nodes.push(make('rect', { x: x + 9, y: y + 9, width: UNIT - 18, height: UNIT - 18, rx: 10 }, `rm-${kind}`));
    if (words?.[kind]) {
      const text = make('text', { x: x + UNIT / 2, y: y + UNIT - 14, 'text-anchor': 'middle' }, `rm-word rm-word-${kind}`);
      text.textContent = words[kind];
      nodes.push(text);
    }
  }
  // 벽과 문: 이웃한 두 방 사이에는 문이 난 벽, 방과 정원(또는 집 밖) 사이에는 막힌 벽
  for (let cell = 0; cell < w * h; cell++) {
    if (garden.has(cell)) continue;
    for (const [other, [x1, y1, x2, y2]] of sidesOf(w, h, cell)) {
      const room = other !== null && !garden.has(other);
      if (room && other < cell) continue;
      if (!room) {
        nodes.push(make('line', { x1, y1, x2, y2 }, 'rm-wall outer'));
        continue;
      }
      // 문: 변의 가운데를 비운다
      const gap = DOOR / 2;
      if (x1 === x2) {
        const mid = (y1 + y2) / 2;
        nodes.push(make('line', { x1, y1, x2, y2: mid - gap }, 'rm-wall'), make('line', { x1, y1: mid + gap, x2, y2 }, 'rm-wall'));
      } else {
        const mid = (x1 + x2) / 2;
        nodes.push(make('line', { x1, y1, x2: mid - gap, y2 }, 'rm-wall'), make('line', { x1: mid + gap, y1, x2, y2 }, 'rm-wall'));
      }
    }
  }
  board.mainLayer.replaceChildren(...nodes);

  // 위에 얹는 것: 적힌 차례, 다른 방, 짚는 방
  const top = [];
  for (const [cell, order] of numbers) {
    const [cx, cy] = middle(w, cell);
    const text = make('text', { x: cx, y: cy + 15, 'text-anchor': 'middle' }, 'rm-number');
    text.textContent = String(order);
    top.push(text);
  }
  for (const cell of wrong) {
    const [cx, cy] = middle(w, cell);
    top.push(make('circle', { cx, cy, r: 40 }, 'rm-wrong'));
  }
  for (const cell of rings) {
    const [cx, cy] = middle(w, cell);
    top.push(make('circle', { cx, cy, r: 42 }, 'rm-ring'), make('circle', { cx, cy, r: 32 }, 'rm-ring inner'));
  }
  board.topLayer.replaceChildren(...top);

  board.view = { ...view, w, h, walls, numbers, path };
  board.press = null;
  drawLive(board);
  if (focused !== undefined) svg.querySelector(`[data-cell="${focused}"]`)?.focus?.();
}

/**
 * 가려 내기 판: 같은 꼴의 집 여럿을 나란히 그린다. 집을 누르면 고르고, 다시 누르면 지운다.
 * @param {HTMLElement} root
 * @param {object} view
 *   houses   집들
 *   picked   고른 집의 번호들(굵은 점선 테두리와 꼬리표)
 *   colorOn  색을 켰는가
 *   words    { start, end, pick }: 처음 방과 끝 방의 이름, 고른 집의 꼬리표
 *   name     (번호) → 집의 이름(집 위에 적는다)
 *   label    (번호, 골랐는가) → 읽어 줄 이름(누를 수 있는 판에서만)
 *   onPick   (번호) → 집을 눌렀을 때
 *   marks    (번호) → 집 아래에 붙이는 글(풀이). 없으면 붙이지 않는다
 *   paths    (번호) → 집에 그릴 길(풀이). 없으면 그리지 않는다
 *   small    작은 그림으로 그린다
 */
export function drawJudge(root, view) {
  const picked = new Set(view.picked ?? []);
  const live = typeof view.onPick === 'function';
  root.className = `rm-judge${view.small ? ' small' : ''}${view.houses.length === 4 ? ' four' : ''}`;
  root.replaceChildren(
    ...view.houses.map((house, index) => {
      const card = el(live ? 'button' : 'div', `rm-judge-card${picked.has(index) ? ' picked' : ''}`);
      if (live) {
        card.type = 'button';
        card.setAttribute('aria-pressed', String(picked.has(index)));
        card.setAttribute('aria-label', view.label(index, picked.has(index)));
        card.addEventListener('click', () => view.onPick(index));
      }
      if (view.name) card.append(el('span', 'rm-judge-name', view.name(index)));
      const picture = el('div');
      drawHouse(picture, { ...house, path: view.paths?.(index) ?? [], colorOn: view.colorOn, words: view.words, rings: view.rings?.(index) ?? [], small: true });
      card.append(picture);
      if (picked.has(index) && view.words?.pick) card.append(el('span', 'rm-judge-tag', view.words.pick));
      const note = view.marks?.(index);
      if (note) card.append(el('p', 'strip-note', note));
      return card;
    }),
  );
}

/**
 * 집 하나를 담은 새 조각을 만든다(풀이와 "왜 그럴까?"의 그림). 아래에 색마다의 방 수와 한 줄 글을 붙일 수 있다.
 * @param {object} view drawHouse에 건네는 것
 * @param {string} note 아래에 붙이는 글
 * @param {{counts?: string[], big?: boolean}} options counts: 색마다 적을 글(동그라미 방의 글, 네모 방의 글)
 */
export function houseCard(view, note, { counts = null, big = false } = {}) {
  const card = el('div', big ? 'rm-card big' : 'rm-card');
  const picture = el('div');
  card.append(picture);
  drawHouse(picture, { ...view, small: true });
  if (counts) card.append(countLine(counts));
  if (note) card.append(el('p', 'strip-note', note));
  return card;
}

/** 색마다의 방 수: 색과 그 색의 모양, 글 */
export function countLine(texts) {
  const line = el('div', 'tile-legend rm-legend');
  texts.forEach((text, index) => {
    const item = el('span', 'tile-legend-item');
    const svg = make('svg', { viewBox: '0 0 40 40', 'aria-hidden': 'true' }, 'tile-legend-mark');
    svg.append(make('rect', { x: 1, y: 1, width: 38, height: 38, rx: 6 }, `rm-floor rm-color-${index}`));
    svg.append(markShape(ROOM_MARKS[index], 20, 20, 8));
    item.append(svg, el('strong', '', text));
    line.append(item);
  });
  return line;
}
