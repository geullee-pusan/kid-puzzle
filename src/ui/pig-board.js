// 돼지 주사위의 판을 그린다: 겨루기(두 항아리, 큰 주사위와 바구니, 이번 차례와 선생님의 지난 차례에 굴린 눈),
// 실험의 막대(멈추는 수마다 모은 도토리, 두 규칙이 먼저 모은 판, 한 번 더 굴려 얻은 수와 잃은 수), 주사위 눈 펼쳐 보기,
// 작은 그림(처음 화면, 판 고르기, 하던 판, 공책, 만들기 목록), 종이의 그림 카드와 표.
// 색만으로 알리지 않는다.
//   주사위의 1은 점 하나 대신 분홍 돼지 코(콧구멍 둘)다. 1이 나와 돼지가 먹은 차례는 바구니 자리에 빗금과 점선 테두리가 있다
//   내 항아리는 주황 막대, 선생님 항아리는 빗금 친 파랑 막대이고, 막대 앞에 이름이 적혀 있다
//   짐작으로 고른 막대는 굵은 점선 테두리와 "내 짐작" 글이 붙는다
//   더하는 눈은 초록 바탕에 +, 돼지가 먹는 눈은 분홍 빗금 바탕에 −가 적힌다
// 굴릴 때 방금 나온 주사위만 0.35초 흔들린다. 다음 일을 막지 않고, 움직임을 줄이는 설정이면 흔들리지 않는다(app.css).
// 글자는 형식(src/formats/pig.js)이 대본에서 채워 건넨다. 이 파일에는 글을 적지 않는다.

const NS = 'http://www.w3.org/2000/svg';
/** 주사위 눈마다 점의 자리(0~2 칸의 가로, 세로). 1은 돼지 코로 그린다 */
const PIPS = {
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

/** 주사위 면의 안쪽 그림(몸통, 점이나 돼지 코)을 g에 담는다. 100×100 칸 */
function dieParts(face) {
  const parts = [svgOf('rect', { x: 5, y: 5, width: 90, height: 90, rx: 18 }, `pg-die-body${face === 1 ? ' pig' : ''}`)];
  if (face === 1) {
    parts.push(svgOf('ellipse', { cx: 50, cy: 50, rx: 26, ry: 19 }, 'pg-snout'));
    parts.push(svgOf('ellipse', { cx: 41, cy: 50, rx: 5, ry: 8 }, 'pg-nostril'));
    parts.push(svgOf('ellipse', { cx: 59, cy: 50, rx: 5, ry: 8 }, 'pg-nostril'));
  } else {
    for (const [col, row] of PIPS[face] ?? []) parts.push(svgOf('circle', { cx: 27 + col * 23, cy: 27 + row * 23, r: 9 }, 'pg-pip'));
  }
  return parts;
}

/**
 * 주사위 하나. label이 있으면 읽어 주는 그림이다.
 * @param {number|null} face 1~6. null이면 아직 굴리지 않은 빈 자리
 */
export function dieNode(face, { label = '', rolling = false, size = '' } = {}) {
  const svg = svgOf('svg', { viewBox: '0 0 100 100' }, `pg-die${size ? ` ${size}` : ''}${rolling ? ' rolling' : ''}${face === null ? ' blank' : ''}`);
  if (face === null) svg.append(svgOf('rect', { x: 5, y: 5, width: 90, height: 90, rx: 18 }, 'pg-die-slot'));
  else svg.append(...dieParts(face));
  if (label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
  } else svg.setAttribute('aria-hidden', 'true');
  return svg;
}

/** 도토리 그림 하나(글 옆에 붙인다) */
export function acornNode() {
  const svg = svgOf('svg', { viewBox: '0 0 40 48', 'aria-hidden': 'true' }, 'pg-acorn');
  svg.append(svgOf('path', { d: 'M6,20 Q6,46 20,46 Q34,46 34,20 Z' }, 'pg-acorn-nut'));
  svg.append(svgOf('path', { d: 'M3,21 Q3,8 20,8 Q37,8 37,21 Z' }, 'pg-acorn-cap'));
  svg.append(svgOf('path', { d: 'M20,8 Q21,3 25,1' }, 'pg-acorn-stem'));
  return svg;
}

/** 굴린 눈의 줄. 끝난 차례면 끝(옮김, 돼지, 다 모음)을 줄 끝에 적는다 */
function rollRow(row, rolling) {
  const box = el('div', 'pg-row');
  box.append(el('span', 'pg-row-title', row.title));
  const dice = el('span', 'pg-row-dice');
  row.faces.forEach((face, index) => dice.append(dieNode(face, { label: row.labels[index], rolling: rolling && index === row.faces.length - 1, size: 'small' })));
  if (row.faces.length === 0) dice.append(dieNode(null, { size: 'small' }));
  box.append(dice);
  if (row.end) box.append(el('span', `pg-row-end end-${row.endKind}`, row.end));
  return box;
}

/** 항아리 막대 하나: 이름, 모은 만큼 채운 막대(끝이 목표), 모은 수 */
function jarNode(jar, goal, goalLabel) {
  const line = el('div', `pg-jar who-${jar.who}`);
  line.append(el('span', 'pg-jar-name', jar.name));
  const track = el('span', 'pg-track');
  const fill = el('span', 'pg-track-fill');
  fill.style.width = `${Math.min(100, (100 * jar.count) / goal)}%`;
  track.append(fill);
  if (jar.basket > 0) {
    // 바구니에 담긴 만큼은 옅게 이어 그린다(멈추면 옮겨질 만큼)
    const ghost = el('span', 'pg-track-ghost');
    ghost.style.left = `${Math.min(100, (100 * jar.count) / goal)}%`;
    ghost.style.width = `${Math.max(0, Math.min(100 - (100 * jar.count) / goal, (100 * jar.basket) / goal))}%`;
    track.append(ghost);
  }
  track.append(el('span', 'pg-track-goal', goalLabel));
  line.append(track, el('strong', 'pg-jar-count', jar.countLabel));
  return line;
}

/**
 * 겨루기 판.
 * @param {object} view jars [{who, name, count, countLabel, basket}], goal, goalLabel, teacherRule, die {face, label} | null,
 *   basketLabel, basketPig(방금 돼지가 먹었는가), rows [{title, faces, labels, end, endKind}], rolling
 */
export function drawPlay(root, view) {
  root.className = `pg-board play${view.small ? ' small-view' : ''}`;
  root.setAttribute('aria-label', view.label);
  const jars = el('div', 'pg-jars');
  for (const jar of view.jars) jars.append(jarNode(jar, view.goal, view.goalLabel));
  const rule = el('p', 'pg-teacher-rule', view.teacherRule);
  const stage = el('div', `pg-stage${view.rolling ? ' rolling' : ''}`);
  stage.append(dieNode(view.die ? view.die.face : null, { label: view.die?.label ?? '', rolling: view.rolling, size: 'big' }));
  const basket = el('div', `pg-basket${view.basketPig ? ' eaten' : ''}`);
  basket.append(acornNode(), el('strong', 'pg-basket-n', view.basketLabel));
  stage.append(basket);
  const rows = el('div', 'pg-rows');
  view.rows.forEach((row, index) => rows.append(rollRow(row, view.rolling && index === 0)));
  root.replaceChildren(jars, rule, stage, rows);
}

/**
 * 막대들(실험의 결과): 줄마다 이름, 막대, 수, 그 아래 작은 글. 가장 긴 막대에 맞춘다.
 * @param {object} view rows [{label, value, valueLabel, sub, mine, mineLabel, kind}], caption, note, wait(아직 해 보지 않았으면 그 글), wide(이름 칸을 넓게)
 */
export function barsNode(view) {
  const box = el('div', view.wide ? 'pg-bars wide' : 'pg-bars');
  if (view.caption) box.append(el('p', 'pg-caption', view.caption));
  const most = Math.max(1, ...view.rows.map((row) => row.value ?? 0));
  for (const row of view.rows) {
    const line = el('div', `pg-bar-line${row.mine ? ' mine' : ''}`);
    const name = el('span', 'pg-bar-name', row.label);
    const bar = el('span', 'pg-bar');
    const fill = el('span', `pg-bar-fill kind-${row.kind ?? 'plain'}`);
    fill.style.width = row.value === null ? '0%' : `${(100 * row.value) / most}%`;
    bar.append(fill);
    line.append(name, bar, el('strong', 'pg-bar-n', row.valueLabel));
    // 아래 줄: 짐작으로 고른 표시와 작은 글(돼지가 먹은 차례)
    if (row.sub || row.mine) {
      const sub = el('span', 'pg-bar-sub');
      if (row.mine) sub.append(el('span', 'pg-mine', row.mineLabel));
      if (row.sub) sub.append(el('span', '', row.sub));
      line.append(sub);
    }
    box.append(line);
  }
  if (view.wait) box.append(el('p', 'pg-caption', view.wait));
  if (view.note) box.append(el('p', 'pg-caption', view.note));
  return box;
}

/**
 * 주사위 눈 모두 펼쳐 보기. 주사위 하나는 눈 여섯 가지, 둘은 왼쪽(가로줄)과 오른쪽(세로줄)의 표와 줄마다 더하는 수의 합.
 * @param {object} view dice, list [{faces, pig, add}], addText(n), loseText, caption, dieLabel(n), cellLabel(faces, text), rowSum(n), tableLabel
 */
export function facesNode(view) {
  const box = el('div', 'pg-faces-box');
  if (view.caption) box.append(el('p', 'pg-caption', view.caption));
  if (view.dice === 1) {
    const row = el('div', 'pg-faces one');
    for (const item of view.list) {
      const cell = el('span', `pg-face-cell ${item.pig ? 'lose' : 'add'}`);
      const text = item.pig ? view.loseText : view.addText(item.add);
      cell.setAttribute('role', 'img');
      cell.setAttribute('aria-label', `${view.dieLabel(item.faces[0])}, ${text}`);
      cell.append(dieNode(item.faces[0], { size: 'mid' }), el('strong', 'pg-face-n', text));
      row.append(cell);
    }
    box.append(row);
    return box;
  }
  const grid = el('div', 'pg-faces two');
  grid.setAttribute('role', 'table');
  grid.setAttribute('aria-label', view.tableLabel);
  grid.append(el('span', 'pg-face-corner'));
  for (let right = 1; right <= 6; right++) {
    const head = el('span', 'pg-face-head right');
    head.append(dieNode(right, { size: 'tiny' }));
    grid.append(head);
  }
  grid.append(el('span', 'pg-face-corner'));
  for (let left = 1; left <= 6; left++) {
    const head = el('span', 'pg-face-head left');
    head.append(dieNode(left, { size: 'tiny' }));
    grid.append(head);
    let sum = 0;
    for (let right = 1; right <= 6; right++) {
      const item = view.list.find((entry) => entry.faces[0] === left && entry.faces[1] === right);
      sum += item.add;
      const text = item.pig ? view.loseText : view.addText(item.add);
      const cell = el('span', `pg-face-cell small ${item.pig ? 'lose' : 'add'}`, text);
      cell.setAttribute('aria-label', view.cellLabel(item.faces, text));
      grid.append(cell);
    }
    grid.append(el('span', 'pg-row-sum', view.rowSum(sum)));
  }
  box.append(grid);
  return box;
}

/**
 * 한 번 더 굴릴까의 판: 바구니, 컴퓨터가 해 본 막대(얻은 수와 잃은 수) 또는 주사위 눈 펼쳐 보기.
 * @param {object} view basketLabel, dice, faces(펼쳐 보기의 값) | null, bars(막대의 값) | null, line(1이 나온 번)
 */
export function drawEdge(root, view) {
  root.className = 'pg-board edge';
  root.setAttribute('aria-label', view.label);
  const top = el('div', 'pg-edge-top');
  const basket = el('div', 'pg-basket');
  basket.append(acornNode(), el('strong', 'pg-basket-n', view.basketLabel));
  const dice = el('span', 'pg-edge-dice');
  for (let die = 0; die < view.dice; die++) dice.append(dieNode(null, { size: 'mid' }));
  top.append(basket, dice);
  const parts = [top];
  if (view.faces) parts.push(facesNode(view.faces));
  else if (view.bars) {
    parts.push(barsNode(view.bars));
    if (view.line) parts.push(el('p', 'pg-caption strong', view.line));
  }
  root.replaceChildren(...parts);
}

/** 실험 판(몇 개에서 멈출까, 누가 먼저 모을까): 막대들 */
export function drawBars(root, view) {
  root.className = `pg-board bars ${view.kind}`;
  root.setAttribute('aria-label', view.label);
  root.replaceChildren(barsNode(view.bars));
}

/**
 * 작은 그림(처음 화면, 판 고르기, 하던 판, 공책, 만들기 목록). 글은 없다.
 * @param {object} view kind('play' | 'stop' | 'match' | 'edge' | 'blank'), jars([내 몫, 선생님 몫]의 0~1), bars(0~1의 줄), dice(주사위 수), face
 */
export function drawMini(root, view) {
  root.className = 'pg-board small';
  const svg = svgOf('svg', { viewBox: '0 0 200 130', 'aria-hidden': 'true' }, 'pg-mini');
  const dieAt = (face, x, y, size) => {
    const g = svgOf('g', { transform: `translate(${x}, ${y}) scale(${size / 100})` }, face === null ? 'pg-die blank' : 'pg-die');
    if (face === null) g.append(svgOf('rect', { x: 5, y: 5, width: 90, height: 90, rx: 18 }, 'pg-die-slot'));
    else g.append(...dieParts(face));
    svg.append(g);
  };
  if (view.kind === 'blank') {
    dieAt(null, 60, 20, 80);
  } else if (view.kind === 'play' || view.kind === 'match') {
    dieAt(view.face ?? 5, 8, 34, 62);
    (view.jars ?? [0, 0]).forEach((part, index) => {
      const y = 30 + index * 44;
      svg.append(svgOf('rect', { x: 80, y, width: 112, height: 26, rx: 6 }, 'pg-mini-track'));
      svg.append(svgOf('rect', { x: 80, y, width: Math.max(0, Math.min(1, part)) * 112, height: 26, rx: 6 }, `pg-mini-fill who-${index === 0 ? 'kid' : 'teacher'}`));
    });
  } else if (view.kind === 'stop') {
    const bars = view.bars ?? [];
    const width = 180 / Math.max(bars.length, 1);
    bars.forEach((part, index) => {
      const height = 20 + part * 90;
      svg.append(svgOf('rect', { x: 10 + index * width + 3, y: 122 - height, width: width - 6, height, rx: 4 }, 'pg-mini-bar'));
    });
  } else {
    // 한 번 더 굴릴까: 바구니 위의 도토리 몇 알과 주사위
    svg.append(svgOf('path', { d: 'M14,70 L96,70 L86,118 L24,118 Z' }, 'pg-mini-basket'));
    for (const [cx, cy] of [
      [36, 60],
      [56, 56],
      [76, 60],
      [46, 46],
      [66, 44],
    ]) {
      svg.append(svgOf('ellipse', { cx, cy, rx: 9, ry: 11 }, 'pg-mini-acorn'));
    }
    for (let die = 0; die < (view.dice ?? 1); die++) dieAt(die === 0 ? 1 : 4, 112 + die * 40, view.dice === 2 ? 50 : 34, view.dice === 2 ? 40 : 62);
  }
  root.replaceChildren(svg);
}

/** 그림 카드: 그림 하나와 그 아래 한 줄(풀이, "왜 그럴까?") */
export function card(node, note = '', { big = false } = {}) {
  const box = el('div', big ? 'pg-card big' : 'pg-card');
  box.append(node);
  if (note) box.append(el('p', 'strip-note', note));
  return box;
}

/** 표("왜 그럴까?"의 끝 장) */
export function tableCard(heads, rows, note) {
  const table = el('table', 'pg-table');
  const head = el('tr');
  for (const text of heads) head.append(el('th', '', text));
  table.append(head);
  for (const row of rows) {
    const line = el('tr');
    for (const text of row) line.append(el('td', '', text));
    table.append(line);
  }
  return card(table, note, { big: true });
}

/** 판 하나를 떼어 낸 칸에 그린다(풀이 종이, 만들기의 그림) */
export function detached(draw, view) {
  const root = el('div');
  draw(root, view);
  return root;
}
