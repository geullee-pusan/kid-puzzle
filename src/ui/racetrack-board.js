// 모눈 자동차 경주의 판을 그린다: 길 칸과 벽, 칸마다의 점, 결승선(체크 무늬 굵은 선)과 결승선 너머, 깃발 칸, 지나온 길, 차.
// 누를 수 있는 판에서는 다음에 갈 수 있는 아홉 점(동그라미)을 그린다. 가운데 동그라미가 지난번과 똑같이 움직인 자리이고,
// 지금 점에서 그 자리까지 옅은 화살표(지난 움직임)를 긋는다. 동그라미마다 칸 하나만 한 누르는 자리가 있다.
// 직접 만들기의 판은 칸을 누르는 모눈이다(길 칸과 벽 칸을 바꾸고, 출발 칸·결승선·깃발 칸을 정한다).
// 색만으로 알리지 않는다. 벽은 빗금, 결승선은 체크 무늬 선, 깃발 칸은 깃발 그림과 점선 테두리(들른 뒤에는 실선), 출발 칸은 네모 테두리,
// 벽에 닿아 갈 수 없었던 선은 점선으로 그린다. 글자는 형식(src/formats/racetrack.js)이 대본에서 채워 건넨다. 이 파일에는 글을 적지 않는다.
import { ACCELS, finishCells, heightOf, isFlag, isOpen, targetOf, widthOf } from '../core/racetrack.js';

const NS = 'http://www.w3.org/2000/svg';
const U = 100; // 칸 하나의 크기
const EDGE = 12; // 둘레에 두는 자리
let patterns = 0; // 빗금 무늬의 이름이 그림마다 달라야 한다

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

const mid = (value) => value * U + U / 2;

/** 판 전체(결승선 너머는 빼고)의 둘레 */
export const boardExtent = (board) => ({ x0: 0, x1: widthOf(board) - 1, y0: 0, y1: heightOf(board) - 1 });

/** 점 (x, y)가 결승선 너머(판 밖, 결승선 쪽)에 있는가 */
function beyond(board, x, y) {
  const { side } = board.finish;
  if (side === 'top') return y < 0;
  if (side === 'bottom') return y >= heightOf(board);
  if (side === 'left') return x < 0;
  return x >= widthOf(board);
}

/** 길 칸의 변 가운데 벽인 것(결승선은 빼고): [x1, y1, x2, y2] */
function wallEdges(board) {
  const edges = [];
  const finish = new Set(finishCells(board).map(String));
  const { side } = board.finish;
  for (let r = 0; r < heightOf(board); r++) {
    for (let c = 0; c < widthOf(board); c++) {
      if (!isOpen(board, c, r)) continue;
      const atFinish = finish.has(`${c},${r}`);
      const sides = [
        ['top', c, r - 1, [c, r, c + 1, r]],
        ['bottom', c, r + 1, [c, r + 1, c + 1, r + 1]],
        ['left', c - 1, r, [c, r, c, r + 1]],
        ['right', c + 1, r, [c + 1, r, c + 1, r + 1]],
      ];
      for (const [name, nc, nr, line] of sides) {
        if (isOpen(board, nc, nr)) continue;
        if (atFinish && name === side) continue;
        edges.push(line);
      }
    }
  }
  return edges;
}

/** 결승선: [x1, y1, x2, y2](칸의 모서리 자리) */
function finishLine(board) {
  const { side, from, to } = board.finish;
  const w = widthOf(board);
  const h = heightOf(board);
  if (side === 'top') return [from, 0, to + 1, 0];
  if (side === 'bottom') return [from, h, to + 1, h];
  if (side === 'left') return [0, from, 0, to + 1];
  return [w, from, w, to + 1];
}

/** 깃발 그림(칸의 가운데보다 조금 왼쪽 위에 깃대와 세모 깃발) */
function flagArt(c, r) {
  const x = c * U + U * 0.34;
  const y = r * U + U * 0.18;
  const group = make('g', {}, 'rt-flag-art');
  group.append(make('line', { x1: x, y1: y, x2: x, y2: y + U * 0.64 }, 'rt-flag-pole'));
  group.append(make('path', { d: `M ${x} ${y} L ${x + U * 0.36} ${y + U * 0.13} L ${x} ${y + U * 0.27} Z` }, 'rt-flag-cloth'));
  return group;
}

/** 판 그림(SVG). 누를 수 있는 판과 보기만 하는 그림이 같이 쓴다 */
function trackSvg(view) {
  const { board, extent = boardExtent(board), points = [], flagged = false, numbers = false } = view;
  const id = `rt-hatch-${(patterns += 1)}`;
  const x0 = extent.x0 * U - EDGE;
  const y0 = extent.y0 * U - EDGE;
  const width = (extent.x1 - extent.x0 + 1) * U + 2 * EDGE;
  const height = (extent.y1 - extent.y0 + 1) * U + 2 * EDGE;
  const svg = make('svg', { viewBox: `${x0} ${y0} ${width} ${height}` }, 'rt-svg');
  // 벽의 빗금 무늬
  const defs = make('defs');
  const hatch = make('pattern', { id, width: 24, height: 24, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
  hatch.append(make('rect', { width: 24, height: 24 }, 'rt-wall-fill'), make('line', { x1: 0, y1: 0, x2: 0, y2: 24 }, 'rt-wall-hatch'));
  defs.append(hatch);
  svg.append(defs);
  svg.append(make('rect', { x: x0, y: y0, width, height, fill: `url(#${id})` }, 'rt-outside'));
  // 결승선 너머(판 밖에서 결승선 쪽)
  const w = widthOf(board);
  const h = heightOf(board);
  const far = { top: [x0, y0, width, -y0], bottom: [x0, h * U, width, y0 + height - h * U], left: [x0, y0, -x0, height], right: [w * U, y0, x0 + width - w * U, height] }[board.finish.side];
  if (far[2] > 0 && far[3] > 0) svg.append(make('rect', { x: far[0], y: far[1], width: far[2], height: far[3] }, 'rt-beyond'));
  // 길 칸, 깃발 칸, 출발 칸
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (!isOpen(board, c, r)) continue;
      svg.append(make('rect', { x: c * U, y: r * U, width: U, height: U }, 'rt-road'));
    }
  }
  for (const [c, r] of board.flags) {
    svg.append(make('rect', { x: c * U + 6, y: r * U + 6, width: U - 12, height: U - 12, rx: 8 }, flagged ? 'rt-flag done' : 'rt-flag'));
    svg.append(flagArt(c, r));
  }
  svg.append(make('rect', { x: board.start[0] * U + 14, y: board.start[1] * U + 14, width: U - 28, height: U - 28, rx: 6 }, 'rt-start'));
  // 점: 길 칸의 가운데와 결승선 너머의 점
  const dots = make('g', {}, 'rt-dots');
  for (let y = extent.y0; y <= extent.y1; y++) {
    for (let x = extent.x0; x <= extent.x1; x++) {
      if (isOpen(board, x, y)) dots.append(make('circle', { cx: mid(x), cy: mid(y), r: 6 }, 'rt-dot'));
      else if (beyond(board, x, y)) dots.append(make('circle', { cx: mid(x), cy: mid(y), r: 5 }, 'rt-dot far'));
    }
  }
  svg.append(dots);
  // 벽과 결승선
  for (const [ax, ay, bx, by] of wallEdges(board)) svg.append(make('line', { x1: ax * U, y1: ay * U, x2: bx * U, y2: by * U }, 'rt-wall'));
  const [fx1, fy1, fx2, fy2] = finishLine(board);
  svg.append(make('line', { x1: fx1 * U, y1: fy1 * U, x2: fx2 * U, y2: fy2 * U }, 'rt-finish-base'));
  svg.append(make('line', { x1: fx1 * U, y1: fy1 * U, x2: fx2 * U, y2: fy2 * U }, 'rt-finish'));
  // 지나온 길
  if (points.length > 1) {
    svg.append(make('polyline', { points: points.map(([x, y]) => `${mid(x)},${mid(y)}`).join(' ') }, 'rt-path'));
    points.slice(1, -1).forEach(([x, y]) => svg.append(make('circle', { cx: mid(x), cy: mid(y), r: 11 }, 'rt-step')));
  }
  if (numbers) {
    // 몇 번째 움직임에 닿은 점인지(같은 점에 잇달아 머물면 번호를 이어 적는다)
    const labels = [];
    points.slice(1).forEach(([x, y], index) => {
      const last = labels.at(-1);
      if (last && last.x === x && last.y === y) last.text += `,${index + 1}`;
      else labels.push({ x, y, text: String(index + 1) });
    });
    for (const { x, y, text } of labels) {
      // 그림의 오른쪽 끝이나 맨 위의 점은 번호를 안쪽에 적는다(잘리지 않게)
      const right = x < extent.x1;
      const attrs = { x: right ? mid(x) + 16 : mid(x) - 16, y: y > extent.y0 ? mid(y) - 18 : mid(y) + 48, 'font-size': 42, 'text-anchor': right ? 'start' : 'end' };
      const label = make('text', attrs, 'rt-step-no');
      label.textContent = text;
      svg.append(label);
    }
  }
  return svg;
}

/**
 * 판을 그린다.
 * @param {HTMLElement} root 그릴 자리(안의 것을 모두 바꾼다)
 * @param {object} view
 *   board     판
 *   extent    그릴 둘레(칸). 결승선 너머의 점까지 담는다
 *   points    지나온 점들(처음 점부터 지금 점까지)
 *   state     지금 차(없으면 차를 그리지 않는다)
 *   flagged   깃발 칸에 닿았는가(깃발 칸의 테두리가 실선이 된다)
 *   onPick    (ax, ay) → 아홉 점 가운데 하나를 눌렀을 때. 없으면 누를 수 없다
 *   label     (ax, ay) → 읽어 줄 이름
 *   blocked   벽에 닿아 갈 수 없었던 선 [[x0, y0], [x1, y1]](점선으로 그린다)
 *   small     작은 그림(처음 화면, 공책, 풀이)
 */
export function drawTrack(root, view) {
  const { board, state = null, onPick, label, blocked = null, small = false } = view;
  root.className = `rt-board${small ? ' small' : ' live'}`;
  const svg = trackSvg(view);
  const extent = view.extent ?? boardExtent(board);
  const within = (x, y) => x >= extent.x0 && x <= extent.x1 && y >= extent.y0 && y <= extent.y1;
  if (blocked) {
    const [[ax, ay], [bx, by]] = blocked;
    svg.append(make('line', { x1: mid(ax), y1: mid(ay), x2: mid(bx), y2: mid(by) }, 'rt-blocked'));
    svg.append(make('circle', { cx: mid(bx), cy: mid(by), r: 16 }, 'rt-blocked-end'));
  }
  if (state) {
    const [cx, cy] = targetOf(state, 0, 0);
    if (state.vx !== 0 || state.vy !== 0) {
      // 지난 움직임: 지금 점에서 똑같이 움직인 자리까지의 옅은 화살표
      const angle = Math.atan2(cy - state.y, cx - state.x);
      const tipX = mid(cx) - Math.cos(angle) * 30;
      const tipY = mid(cy) - Math.sin(angle) * 30;
      svg.append(make('line', { x1: mid(state.x), y1: mid(state.y), x2: tipX, y2: tipY }, 'rt-speed'));
      const side = (turn) => `${tipX - Math.cos(angle + turn) * 22},${tipY - Math.sin(angle + turn) * 22}`;
      svg.append(make('polyline', { points: `${side(0.5)} ${tipX},${tipY} ${side(-0.5)}` }, 'rt-speed-head'));
    }
    if (onPick) {
      for (const [ax, ay] of ACCELS) {
        const [x, y] = targetOf(state, ax, ay);
        if (!within(x, y)) continue;
        const pick = make('g', { role: 'button', tabindex: 0, 'data-ax': ax, 'data-ay': ay }, ax === 0 && ay === 0 ? 'rt-pick coast' : 'rt-pick');
        if (label) pick.setAttribute('aria-label', label(ax, ay));
        pick.append(make('rect', { x: x * U, y: y * U, width: U, height: U }, 'rt-pick-area'));
        pick.append(make('circle', { cx: mid(x), cy: mid(y), r: 30 }, 'rt-pick-ring'));
        if (ax === 0 && ay === 0) pick.append(make('circle', { cx: mid(x), cy: mid(y), r: 14 }, 'rt-pick-core'));
        const go = (event) => {
          event.preventDefault();
          onPick(ax, ay);
        };
        pick.addEventListener('click', go);
        pick.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') go(event);
        });
        svg.append(pick);
      }
    }
    svg.append(make('circle', { cx: mid(state.x), cy: mid(state.y), r: 24 }, 'rt-car'));
    svg.append(make('circle', { cx: mid(state.x), cy: mid(state.y), r: 8 }, 'rt-car-eye'));
  }
  if (!small) {
    // 판 칸에 맞춰 그린다(가로세로 가운데 작은 쪽에 맞는다)
    svg.style.aspectRatio = `${extent.x1 - extent.x0 + 1} / ${extent.y1 - extent.y0 + 1}`;
  }
  root.replaceChildren(svg);
}

/**
 * 지나온 길 하나를 그림 카드로 그린다(풀이, "왜 그럴까?", 직접 만들기).
 * @param {object} board
 * @param {{points: number[][], extent?: object, flagged?: boolean, state?: object}} path
 * @param {string} note 그림 아래의 한 줄
 * @param {boolean} big 종이에 그림이 하나뿐이면 크게 그린다
 */
export function trackFigure(board, path, note = '', big = false) {
  const card = el('div', `figure-card rt-card${big ? ' big' : ''}`);
  const picture = el('div');
  drawTrack(picture, { board, extent: path.extent, points: path.points, flagged: path.flagged ?? false, state: path.state ?? null, small: true, numbers: true });
  card.append(picture);
  if (note) card.append(el('p', 'strip-note', note));
  return card;
}

/**
 * 직접 만들기의 모눈: 칸마다 단추. 길 칸과 벽 칸, 출발 칸, 결승선 칸, 깃발 칸을 그린다.
 * @param {HTMLElement} root
 * @param {{rows: string[], start: number[]|null, finish: object|null, flags: number[][], onCell: (c: number, r: number) => void, label: (c: number, r: number) => string, points?: number[][]}} view
 *   finish  { side, from, to } 또는 null. points: 선생님이 그린 길(있으면 모눈 위에 겹쳐 그린다)
 */
export function drawMakeGrid(root, view) {
  const { rows, start, finish, flags, onCell, label, points = [] } = view;
  const w = rows[0].length;
  const h = rows.length;
  root.className = 'rt-make';
  root.style.setProperty('--w', String(w));
  root.style.setProperty('--h', String(h));
  const grid = el('div', 'rt-make-grid');
  const board = { rows, start: start ?? [-1, -1], finish: finish ?? { side: 'top', from: -1, to: -2 }, flags };
  const finishSet = new Set(finish ? finishCells(board).map(String) : []);
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const cell = el('button', 'rt-make-cell');
      cell.type = 'button';
      const open = rows[r][c] === '.';
      cell.classList.add(open ? 'road' : 'wall');
      if (start && start[0] === c && start[1] === r) cell.classList.add('start');
      if (isFlag(board, c, r)) cell.classList.add('flag');
      if (finishSet.has(`${c},${r}`)) cell.classList.add(`finish-${finish.side}`);
      cell.setAttribute('aria-label', label(c, r));
      cell.addEventListener('click', () => onCell(c, r));
      grid.append(cell);
    }
  }
  root.replaceChildren(grid);
  if (points.length > 1) {
    // 선생님이 그린 길: 모눈 위에 겹친 그림(누름은 받지 않는다)
    const svg = make('svg', { viewBox: `0 0 ${w * U} ${h * U}`, 'aria-hidden': 'true' }, 'rt-make-path');
    svg.append(make('polyline', { points: points.map(([x, y]) => `${mid(x)},${mid(y)}`).join(' ') }, 'rt-path'));
    points.slice(1, -1).forEach(([x, y]) => svg.append(make('circle', { cx: mid(x), cy: mid(y), r: 11 }, 'rt-step')));
    root.append(svg);
  }
}
