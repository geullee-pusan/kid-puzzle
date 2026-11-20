// 공정한 게임일까의 판을 그린다: 규칙의 칸(값마다 누가 가져가는지), 방금 던진 동전이나 주사위, 아이가 던진 열 번의 자리,
// 컴퓨터가 많이 던진 수의 막대, 모든 경우의 표. 누를 수 있는 판과 보기만 하는 그림(처음 화면, 공책, 판 고르기, 풀이, "왜 그럴까?")을 같은 모양으로 그린다.
// 색만으로 알리지 않는다.
//   다람쥐   주황 동그라미(칸과 표의 바탕은 옅은 주황)
//   고슴도치 파란 세모(칸과 표의 바탕은 옅은 파랑, 빗금)
//   왼쪽 주사위는 노란 바탕, 오른쪽 주사위는 하늘색 바탕이고 표에서는 왼쪽이 가로줄, 오른쪽이 세로줄이다(대본의 표 설명)
//   바꾼 칸   굵은 금빛 점선 테두리
// 던질 때 동전과 주사위가 짧게(0.4초) 흔들린다. 움직임을 줄이는 설정이면 흔들리지 않는다(app.css).
// 글자(동물 이름, 값, 읽어 주는 이름)는 형식(src/formats/fair.js)이 대본에서 채워 건넨다. 이 파일에는 글을 적지 않는다.
import { DEVICES, outcomesOf, ownerOf, measureOf } from '../core/fair.js';

const NS = 'http://www.w3.org/2000/svg';
/** 주사위 눈마다 점의 자리(0~2 칸의 가로, 세로) */
const PIPS = {
  1: [[1, 1]],
  2: [
    [0, 0],
    [2, 2],
  ],
  3: [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  4: [
    [0, 0],
    [2, 0],
    [0, 2],
    [2, 2],
  ],
  5: [
    [0, 0],
    [2, 0],
    [1, 1],
    [0, 2],
    [2, 2],
  ],
  6: [
    [0, 0],
    [2, 0],
    [0, 1],
    [2, 1],
    [0, 2],
    [2, 2],
  ],
};

function svgOf(tag, attrs = {}, className = '') {
  const node = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  if (className) node.setAttribute('class', className);
  return node;
}

function el(tag, className = '', text = null) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== null) node.textContent = text;
  return node;
}

/** 누가 가져가는지의 표: 다람쥐는 동그라미, 고슴도치는 세모 */
export function token(owner, className = '') {
  const svg = svgOf('svg', { viewBox: '0 0 20 20', 'aria-hidden': 'true' }, `fr-token own-${owner}${className ? ` ${className}` : ''}`);
  if (owner === 'a') svg.append(svgOf('circle', { cx: 10, cy: 10, r: 7.5 }));
  else svg.append(svgOf('polygon', { points: '10,2 18.5,17.5 1.5,17.5' }));
  return svg;
}

/** 주사위 하나(눈은 점으로). side: 'left' | 'right' | ''(색) */
function dieFace(n, side = '') {
  const svg = svgOf('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true' }, `fr-die${side ? ` ${side}` : ''}`);
  svg.append(svgOf('rect', { x: 5, y: 5, width: 90, height: 90, rx: 16 }, 'fr-die-body'));
  for (const [col, row] of PIPS[n] ?? []) svg.append(svgOf('circle', { cx: 27 + col * 23, cy: 27 + row * 23, r: 9 }, 'fr-pip'));
  return svg;
}

/** 동전 하나(면의 글자는 대본에서). 앞면은 두 겹 테두리 */
function coinFace(face, text, side = '') {
  const svg = svgOf('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true' }, `fr-coin face-${face}${side ? ` ${side}` : ''}`);
  svg.append(svgOf('circle', { cx: 50, cy: 50, r: 44 }, 'fr-coin-body'));
  if (face === 1) svg.append(svgOf('circle', { cx: 50, cy: 50, r: 34 }, 'fr-coin-ring'));
  const label = svgOf('text', { x: 50, y: 52 }, 'fr-coin-text');
  label.textContent = text;
  svg.append(label);
  return svg;
}

/** 두 개를 던지는 것은 왼쪽과 오른쪽을 가른다(셋은 차례만) */
const sideAt = (device, index) => (DEVICES[device].count === 2 ? (index === 0 ? 'left' : 'right') : '');

function facesNode(device, faces, faceText, className = 'fr-faces') {
  const box = el('span', className);
  const { kind } = DEVICES[device];
  faces.forEach((face, index) => box.append(kind === 'die' ? dieFace(face, sideAt(device, index)) : coinFace(face, faceText[face], sideAt(device, index))));
  return box;
}

/** 아직 던지지 않은 자리 */
function blankFaces(device) {
  const box = el('span', 'fr-faces blank');
  for (let index = 0; index < DEVICES[device].count; index++) box.append(el('span', `fr-face-slot ${DEVICES[device].kind}`));
  return box;
}

/**
 * 규칙의 칸: 값마다 누가 가져가는지. onChip이 있으면 단추다(규칙 고치기, 직접 만들기).
 * @param {object} view chips [{value, text, owner, label, changed}], head(칸 위의 이름), onChip
 */
function chipsNode(view) {
  const box = el('div', 'fr-chips');
  box.append(el('span', 'fr-chip-head', view.head));
  const row = el('div', `fr-chip-row${view.chips.length > 6 ? ' many' : ''}`);
  for (const chip of view.chips) {
    const node = el(view.onChip ? 'button' : 'span', `fr-chip own-${chip.owner}${chip.changed ? ' changed' : ''}`);
    if (view.onChip) {
      node.type = 'button';
      node.addEventListener('click', () => view.onChip(chip.value));
    }
    node.setAttribute('aria-label', chip.label);
    node.append(el('span', 'fr-chip-text', chip.text), token(chip.owner));
    row.append(node);
  }
  box.append(row);
  return box;
}

/** 열 번의 자리: 던진 번은 가져간 쪽의 표, 남은 번은 빈 동그라미 */
function playsNode(view) {
  const row = el('div', 'fr-plays');
  row.setAttribute('role', 'img');
  row.setAttribute('aria-label', view.playsLabel);
  for (let at = 0; at < view.playsMax; at++) {
    const slot = el('span', 'fr-play');
    const owner = view.plays[at];
    if (owner) slot.append(token(owner));
    else slot.classList.add('empty');
    row.append(slot);
  }
  return row;
}

/** 컴퓨터가 던진 수의 막대(두 줄)와 모두 몇 번인지 */
function manyNode(view) {
  const box = el('div', 'fr-many');
  const { many } = view;
  for (const owner of ['a', 'b']) {
    const line = el('div', `fr-bar-line own-${owner}`);
    const bar = el('span', 'fr-bar');
    const fill = el('span', `fr-bar-fill own-${owner}`);
    fill.style.width = `${many.total === 0 ? 0 : (100 * many[owner]) / many.total}%`;
    bar.append(fill);
    line.append(token(owner), el('span', 'fr-bar-name', view.names[owner]), bar, el('strong', 'fr-bar-n', String(many[owner]).replace(/\B(?=(\d{3})+(?!\d))/g, ',')));
    box.append(line);
  }
  box.append(el('p', 'fr-many-total', view.manyLine));
  return box;
}

/**
 * 모든 경우의 표.
 * @param {object} view rule, valueText(value), faceText, names, labels { cell(faces글, 누구), side(left|right, 글) }, caption, count, changed(바꾼 값)
 */
export function tableNode(view) {
  const { rule } = view;
  const { kind, count } = DEVICES[rule.device];
  const box = el('div', `fr-table-box ${rule.device}`);
  if (view.caption) box.append(el('p', 'fr-caption', view.caption));
  const cellOf = (faces) => {
    const owner = ownerOf(rule, faces);
    const value = measureOf(rule.measure, faces);
    const cell = el('span', `fr-cell own-${owner}${view.changed !== undefined && view.changed !== null && value === view.changed ? ' changed' : ''}`);
    cell.setAttribute('role', 'img');
    cell.setAttribute('aria-label', view.labels.cell(faces, value, owner));
    return { cell, owner, value };
  };
  if (count === 2) {
    // 왼쪽(가로줄의 머리)과 오른쪽(세로줄의 머리)
    const sides = kind === 'coin' ? [1, 0] : [1, 2, 3, 4, 5, 6];
    const grid = el('div', `fr-table grid-${sides.length + 1}`);
    grid.setAttribute('role', 'img');
    grid.setAttribute('aria-label', view.labels.table);
    grid.append(el('span', 'fr-corner'));
    for (const right of sides) grid.append(headOf(kind, right, 'right', view.faceText));
    for (const left of sides) {
      grid.append(headOf(kind, left, 'left', view.faceText));
      for (const right of sides) {
        const { cell, value, owner } = cellOf([left, right]);
        // 동전은 칸 안에 두 면을 그린다(앞뒤와 뒤앞이 다른 칸이다). 주사위는 보는 값을 적는다
        cell.append(kind === 'coin' ? facesNode(rule.device, [left, right], view.faceText, 'fr-cell-faces') : el('span', 'fr-cell-value', view.valueText(value)), token(owner));
        grid.append(cell);
      }
    }
    box.append(grid);
  } else {
    const list = el('div', `fr-table list ${rule.device}`);
    list.setAttribute('role', 'img');
    list.setAttribute('aria-label', view.labels.table);
    for (const faces of outcomesOf(rule.device)) {
      const { cell, owner } = cellOf(faces);
      cell.append(facesNode(rule.device, faces, view.faceText, 'fr-cell-faces'), token(owner));
      list.append(cell);
    }
    box.append(list);
  }
  if (view.count) box.append(el('p', 'fr-count-line', view.count));
  return box;
}

function headOf(kind, face, side, faceText) {
  const head = el('span', `fr-head ${side}`);
  head.append(kind === 'die' ? dieFace(face, side) : coinFace(face, faceText[face], side));
  return head;
}

/**
 * 판(누를 수 있는 판과 직접 만들기의 판).
 * @param {object} view
 *   rule, chipsView(chipsNode의 값), page('game' | 'table'), label(판의 읽어 주는 이름)
 *   game: last(방금 던진 것. 없으면 null), lastOwner, lastLabel, rolling(방금 던졌는가), plays, playsMax, playsLabel, many(없으면 null), manyLine, names, faceText
 *   table: tableNode의 값
 */
export function drawBoard(root, view) {
  // 누르는 칸이 많으면(합 2~12) 칸이 두 줄이 되니 표를 조금 작게 그린다
  root.className = `fr-board${view.chipsView.onChip && view.chipsView.chips.length > 8 ? ' tight' : ''}`;
  root.setAttribute('aria-label', view.label);
  const parts = [chipsNode(view.chipsView)];
  if (view.page === 'table') parts.push(tableNode(view.table));
  else if (view.game && view.game.playsMax > 0) {
    const { game } = view;
    const stage = el('div', `fr-stage${game.rolling ? ' rolling' : ''}`);
    const faces = game.last ? facesNode(view.rule.device, game.last, game.faceText) : blankFaces(view.rule.device);
    if (game.last) {
      faces.setAttribute('role', 'img');
      faces.setAttribute('aria-label', game.lastLabel);
    }
    stage.append(faces);
    if (game.last) {
      // 오른쪽에 위아래로: 주사위 둘은 보는 값(합, 차, 큰 눈…), 그 아래에 가져간 쪽
      const result = el('span', 'fr-result');
      if (game.lastValue) result.append(el('span', 'fr-who-value', game.lastValue));
      const who = el('span', `fr-who own-${game.lastOwner}`);
      who.append(token(game.lastOwner), el('span', 'fr-who-name', game.names[game.lastOwner]));
      result.append(who);
      stage.append(result);
    }
    parts.push(stage);
    parts.push(playsNode(game));
    if (game.many) parts.push(manyNode(game));
  } else if (view.game?.many) parts.push(manyNode(view.game));
  root.replaceChildren(...parts);
}

/**
 * 작은 그림(처음 화면, 공책, 하던 판, 판 고르기, 만들기 목록): 던지는 것과 규칙의 칸, 던진 번이 있으면 그 자리.
 * @param {object} view device, owners(값마다 누가 가져가는지. 빈 그림이면 null), faces(그려 둘 면이나 눈), faceText, plays(없으면 [])
 */
export function drawMini(root, view) {
  root.className = 'fr-board small';
  const svg = svgOf('svg', { viewBox: '0 0 200 130', 'aria-hidden': 'true' }, 'fr-mini');
  const { kind, count } = DEVICES[view.device];
  const size = count === 3 ? 44 : 50;
  const start = 100 - (count * size + (count - 1) * 8) / 2;
  view.faces.forEach((face, index) => {
    const g = svgOf('g', { transform: `translate(${start + index * (size + 8)}, 8) scale(${size / 100})` });
    const face0 = kind === 'die' ? dieFace(face, sideAt(view.device, index)) : coinFace(face, view.faceText[face], sideAt(view.device, index));
    // 안쪽 그림만 옮겨 담는다
    g.append(...face0.childNodes);
    g.setAttribute('class', face0.getAttribute('class'));
    svg.append(g);
  });
  const owners = view.owners ?? [];
  const n = Math.max(owners.length, 1);
  const width = Math.min(44, 184 / n);
  const left = 100 - (n * width) / 2;
  owners.forEach((owner, index) => {
    const x = left + index * width;
    svg.append(svgOf('rect', { x: x + 1, y: 70, width: width - 2, height: 24, rx: 4 }, `fr-mini-chip own-${owner}`));
    const cx = x + width / 2;
    if (owner === 'a') svg.append(svgOf('circle', { cx, cy: 82, r: Math.min(7, width / 3) }, `fr-mini-token own-a`));
    else {
      const r = Math.min(7, width / 3);
      svg.append(svgOf('polygon', { points: `${cx},${82 - r} ${cx + r},${82 + r * 0.8} ${cx - r},${82 + r * 0.8}` }, `fr-mini-token own-b`));
    }
  });
  if (owners.length === 0) svg.append(svgOf('rect', { x: 20, y: 70, width: 160, height: 24, rx: 4 }, 'fr-mini-chip empty'));
  const plays = view.plays ?? [];
  if (plays.length > 0) {
    plays.forEach((owner, index) => {
      const cx = 19 + index * 18;
      if (owner === 'a') svg.append(svgOf('circle', { cx, cy: 114, r: 6 }, 'fr-mini-token own-a'));
      else svg.append(svgOf('polygon', { points: `${cx},108 ${cx + 6},119 ${cx - 6},119` }, 'fr-mini-token own-b'));
    });
  }
  root.replaceChildren(svg);
}

/** 합마다 나온 수의 막대("왜 그럴까?") */
export function sumBarsNode(bars) {
  const most = Math.max(...bars.map(([, value]) => value), 1);
  const box = el('div', 'fr-sum-bars');
  box.setAttribute('role', 'img');
  box.setAttribute('aria-label', bars.map(([sum, value]) => `${sum}: ${value}`).join(', '));
  for (const [sum, value] of bars) {
    const column = el('span', 'fr-sum-col');
    const bar = el('span', 'fr-sum-bar');
    bar.style.height = `${(100 * value) / most}%`;
    column.append(el('span', 'fr-sum-n', String(value)), bar, el('span', 'fr-sum-at', String(sum)));
    box.append(column);
  }
  return box;
}

/**
 * 그림 카드: 그림 하나와 그 아래 한 줄(풀이, "왜 그럴까?", 직접 만들기)
 * @param {Node} node 표나 막대
 */
export function card(node, note = '', { big = false } = {}) {
  const box = el('div', big ? 'fr-card big' : 'fr-card');
  box.append(node);
  if (note) box.append(el('p', 'strip-note', note));
  return box;
}
