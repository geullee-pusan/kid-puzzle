// 한붓그리기의 그림을 그린다. 누를 수 있는 그림과 보기만 하는 그림을 같은 모양으로 그린다.
// 색만으로 알리지 않는다: 그은 선은 굵게, 지금 있는 점은 크게 채우고 테두리를 두르고,
// 갈 수 있는 점에는 점선 고리를, 뺀 선은 점선으로, 더한 선에는 표시 글자를 붙인다. 글자는 대본에서 받는다.
// 누르는 것은 pointer 이벤트로 받는다. 손가락을 댄 채 다음 점 위로 끌고 가도 그 점을 누른 것으로 본다.

const NS = 'http://www.w3.org/2000/svg';
const UNIT = 100; // 격자 한 칸
const PAD = 76; // 그림 둘레의 여백(고리와 숫자가 잘리지 않게)
const SMALL_PAD = 42;
const SMALL_SCALE = 1.5; // 작은 그림에서는 선과 점을 이만큼 굵게 그린다(줄여도 보이게)
const TAP_REACH = 46; // 점을 누른 것으로 보는 거리
const DRAG_REACH = 38; // 끌고 가다가 점에 닿은 것으로 보는 거리
const EDGE_REACH = 26; // 선을 누른 것으로 보는 거리

const boards = new WeakMap();

function make(tag, attrs = {}, className = '') {
  const node = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  if (className) node.setAttribute('class', className);
  return node;
}

const place = (point) => [point[0] * UNIT, point[1] * UNIT];

function distanceToSegment(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** 화면의 자리를 그림 안의 자리로 바꾼다 */
function locate(svg, event) {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  const spot = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  return [spot.x, spot.y];
}

function nearestPoint(view, spot, reach) {
  let best = null;
  let bestDistance = reach;
  view.points.forEach((point, index) => {
    const [x, y] = place(point);
    const distance = Math.hypot(spot[0] - x, spot[1] - y);
    if (distance <= bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

function nearestEdge(view, spot) {
  let best = null;
  let bestDistance = EDGE_REACH;
  view.edges.forEach(([a, b], index) => {
    const distance = distanceToSegment(spot, place(view.points[a]), place(view.points[b]));
    if (distance <= bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

/** 그릴 자리에 그림판을 한 번 만들어 둔다. 손가락을 끄는 동안에도 판이 바뀌지 않게, 안의 것만 바꿔 그린다. */
function boardOf(root) {
  let board = boards.get(root);
  if (board && board.svg.parentNode === root) return board;
  const svg = make('svg', { preserveAspectRatio: 'xMidYMid meet' });
  board = { svg, view: null, dragging: null, last: null };
  boards.set(root, board);

  svg.addEventListener('pointerdown', (event) => {
    const view = board.view;
    if (!view || (!view.onPoint && !view.onEdge)) return;
    const spot = locate(svg, event);
    if (!spot) return;
    const point = view.onPoint ? nearestPoint(view, spot, TAP_REACH) : null;
    if (point !== null) {
      event.preventDefault();
      if (view.drag) {
        board.dragging = event.pointerId;
        board.last = point;
        try {
          svg.setPointerCapture(event.pointerId);
        } catch {
          // 붙잡지 못해도 누르는 것은 그대로 된다.
        }
      }
      view.onPoint(point, false);
      return;
    }
    const edge = view.onEdge ? nearestEdge(view, spot) : null;
    if (edge !== null) {
      event.preventDefault();
      view.onEdge(edge);
    }
  });
  svg.addEventListener('pointermove', (event) => {
    if (board.dragging !== event.pointerId) return;
    const view = board.view;
    const spot = locate(svg, event);
    if (!view || !view.onPoint || !spot) return;
    const point = nearestPoint(view, spot, DRAG_REACH);
    if (point === null || point === board.last) return;
    board.last = point;
    view.onPoint(point, true);
  });
  const release = (event) => {
    if (board.dragging === event.pointerId) board.dragging = null;
  };
  svg.addEventListener('pointerup', release);
  svg.addEventListener('pointercancel', release);
  // 글자판으로도 누를 수 있다.
  svg.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const view = board.view;
    const target = event.target.closest?.('[data-point], [data-edge]');
    if (!view || !target) return;
    event.preventDefault();
    if (target.dataset.point !== undefined && view.onPoint) view.onPoint(Number(target.dataset.point), false);
    else if (target.dataset.edge !== undefined && view.onEdge) view.onEdge(Number(target.dataset.edge));
  });
  root.replaceChildren(svg);
  return board;
}

/**
 * 점에 붙이는 숫자(모인 선의 수)를 놓을 방향. 여덟 방향 가운데 그 점의 선들과 가장 멀리 떨어진 쪽을 고르고,
 * 비슷하면 그림의 바깥쪽을 고른다(숫자가 선을 가리지 않게).
 */
function freeSide(index, spots, edges, center) {
  const [x, y] = spots[index];
  const lines = [];
  for (const [a, b] of edges) {
    if (a !== index && b !== index) continue;
    const other = spots[a === index ? b : a];
    lines.push(Math.atan2(other[1] - y, other[0] - x));
  }
  const away = Math.atan2(y - center[1], x - center[0]);
  const gap = (one, two) => Math.abs(Math.atan2(Math.sin(one - two), Math.cos(one - two)));
  let best = -Math.PI / 4;
  let bestValue = -Infinity;
  for (let step = 0; step < 8; step++) {
    const angle = (step * Math.PI) / 4;
    const clear = lines.length === 0 ? Math.PI : Math.min(...lines.map((line) => gap(line, angle)));
    const value = clear - gap(away, angle) * 0.05;
    if (value > bestValue + 1e-9) {
      best = angle;
      bestValue = value;
    }
  }
  return [Math.cos(best), Math.sin(best)];
}

/**
 * 그림을 그린다.
 * @param {HTMLElement} root 그릴 자리(안의 것을 모두 바꾼다)
 * @param {object} view
 *   points   점의 자리
 *   edges    선(점 번호 둘)
 *   used     그은 선의 번호들
 *   at       지금 있는 점(없으면 null)
 *   open     갈 수 있는 점들(점선 고리)
 *   picked   골라 둔 점들(굵은 고리)
 *   marks    눈에 띄게 할 점들(겹 고리. 풀이와 설명의 시작점 등)
 *   degrees  true면 점마다 모인 선의 수를 숫자로 보여 준다
 *   numbers  선마다 붙일 차례(선 번호 순서대로. 없는 선은 null)
 *   gone     뺀 선들([점, 점]의 목록. 점선으로 그린다)
 *   added    더한 선의 번호들
 *   signs    { added, removed } 더한 선과 뺀 선에 붙일 표시 글자
 *   label    (점 번호) → 읽어 줄 이름
 *   edgeLabel (선 번호) → 읽어 줄 이름
 *   onPoint  (점 번호, 끌다가 닿았는가) → 점을 눌렀을 때
 *   onEdge   (선 번호) → 선을 눌렀을 때
 *   drag     true면 손가락을 댄 채 끌고 가도 점을 누른 것으로 본다
 *   small    작은 그림으로 그린다
 */
export function drawFigure(root, view) {
  const { points, edges, used = [], at = null, open = [], picked = [], marks = [], degrees = false, numbers = null, gone = [], added = [], signs = {}, small = false } = view;
  root.className = `figure${small ? ' small' : ''}${view.onPoint || view.onEdge ? ' live' : ''}`;
  const board = boardOf(root);
  const { svg } = board;
  const focused = svg.contains(document.activeElement) ? document.activeElement.dataset : null;

  const k = small ? SMALL_SCALE : 1;
  const pad = small ? SMALL_PAD : PAD;
  const spots = points.map(place);
  const xs = spots.map((spot) => spot[0]);
  const ys = spots.map((spot) => spot[1]);
  const left = Math.min(...xs) - pad;
  const top = Math.min(...ys) - pad;
  const width = Math.max(...xs) - Math.min(...xs) + 2 * pad;
  const height = Math.max(...ys) - Math.min(...ys) + 2 * pad;
  svg.setAttribute('viewBox', `${left} ${top} ${width} ${height}`);
  svg.setAttribute('class', 'figure-svg');
  if (view.onPoint || view.onEdge) svg.removeAttribute('aria-hidden');
  else svg.setAttribute('aria-hidden', 'true');
  const center = [left + width / 2, top + height / 2];
  const nodes = [];

  const sign = (a, b, text, className) => {
    const [x1, y1] = spots[a];
    const [x2, y2] = spots[b];
    const group = make('g', {}, `figure-sign ${className}`);
    group.append(make('circle', { cx: (x1 + x2) / 2, cy: (y1 + y2) / 2, r: 18 * k }));
    const label = make('text', { x: (x1 + x2) / 2, y: (y1 + y2) / 2, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 28 * k });
    label.textContent = text;
    group.append(label);
    return group;
  };
  const signNodes = [];

  // 뺀 선: 점선으로 자리만 남긴다.
  for (const [a, b] of gone) {
    nodes.push(make('line', { x1: spots[a][0], y1: spots[a][1], x2: spots[b][0], y2: spots[b][1], 'stroke-width': 5 * k }, 'figure-edge gone'));
    if (signs.removed) signNodes.push(sign(a, b, signs.removed, 'removed'));
  }
  // 선: 그은 선은 굵게 그린다.
  edges.forEach(([a, b], index) => {
    const names = ['figure-edge'];
    if (used.includes(index)) names.push('used');
    if (added.includes(index)) names.push('added');
    const line = make('line', { x1: spots[a][0], y1: spots[a][1], x2: spots[b][0], y2: spots[b][1], 'stroke-width': (used.includes(index) ? 15 : 7) * k }, names.join(' '));
    if (view.onEdge) {
      line.setAttribute('data-edge', index);
      line.setAttribute('tabindex', '0');
      line.setAttribute('role', 'button');
      if (view.edgeLabel) line.setAttribute('aria-label', view.edgeLabel(index));
    }
    nodes.push(line);
    if (added.includes(index) && signs.added) signNodes.push(sign(a, b, signs.added, 'added'));
    if (numbers && numbers[index] != null) signNodes.push(sign(a, b, String(numbers[index]), 'order'));
  });
  nodes.push(...signNodes);

  // 점
  spots.forEach(([x, y], index) => {
    const names = ['figure-point'];
    const group = make('g', { 'data-point': index });
    if (marks.includes(index)) {
      group.append(make('circle', { cx: x, cy: y, r: 34 }, 'figure-ring mark'));
      group.append(make('circle', { cx: x, cy: y, r: 25 }, 'figure-ring mark'));
    }
    if (open.includes(index)) group.append(make('circle', { cx: x, cy: y, r: 29 }, 'figure-ring open'));
    if (picked.includes(index)) group.append(make('circle', { cx: x, cy: y, r: 30 }, 'figure-ring picked'));
    if (index === at) {
      names.push('now');
      group.append(make('circle', { cx: x, cy: y, r: 31 }, 'figure-ring now'));
    }
    group.append(make('circle', { cx: x, cy: y, r: (index === at ? 20 : 13) * (small ? 1.3 : 1), 'stroke-width': 5 * k }, 'figure-dot'));
    group.setAttribute('class', names.join(' '));
    if (view.onPoint) {
      group.setAttribute('tabindex', '0');
      group.setAttribute('role', 'button');
      if (view.label) group.setAttribute('aria-label', view.label(index));
    }
    nodes.push(group);
  });

  // 점마다 모인 선의 수
  if (degrees) {
    const counts = points.map(() => 0);
    for (const [a, b] of edges) {
      counts[a] += 1;
      counts[b] += 1;
    }
    const lines = [...edges, ...gone];
    spots.forEach(([x, y], index) => {
      const [dx, dy] = freeSide(index, spots, lines, center);
      const cx = x + dx * 52;
      const cy = y + dy * 52;
      const group = make('g', {}, 'figure-degree');
      group.append(make('rect', { x: cx - 17, y: cy - 19, width: 34, height: 38, rx: 9 }));
      const label = make('text', { x: cx, y: cy, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 30 });
      label.textContent = String(counts[index]);
      group.append(label);
      nodes.push(group);
    });
  }

  svg.replaceChildren(...nodes);
  board.view = view;
  if (focused) {
    const again = focused.point !== undefined ? svg.querySelector(`[data-point="${focused.point}"]`) : focused.edge !== undefined ? svg.querySelector(`[data-edge="${focused.edge}"]`) : null;
    again?.focus?.();
  }
}

/** 그림 하나를 담은 새 조각을 만든다(풀이와 "왜 그럴까?"의 그림). 아래에 한 줄 글을 붙일 수 있다. big이면 크게 그린다. */
export function figureCard(view, note, big = false) {
  const card = document.createElement('div');
  card.className = big ? 'figure-card big' : 'figure-card';
  const picture = document.createElement('div');
  card.append(picture);
  drawFigure(picture, view);
  if (note) {
    const line = document.createElement('p');
    line.className = 'strip-note';
    line.textContent = note;
    card.append(line);
  }
  return card;
}
