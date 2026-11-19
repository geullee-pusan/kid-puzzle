// 한붓그리기의 그림을 그린다. 누를 수 있는 그림과 보기만 하는 그림을 같은 모양으로 그린다.
// 색만으로 알리지 않는다: 그은 선은 굵게, 지금 있는 점은 크게 채우고 테두리를 두르고,
// 갈 수 있는 점에는 점선 고리를, 뺀 선은 점선으로, 더한 선에는 표시 글자를 붙인다. 글자는 대본에서 받는다.
// 여러 번에 나눠 그은 선(펜 몇 번 떼기)에는 획의 번호를 붙이고 획마다 선의 무늬를 바꾼다.
// 같은 두 점 사이의 선이 여럿이면(다리 건너기) 굽은 선으로 벌려 그려서 하나하나 따로 보이게 한다.
// 누르는 것은 pointer 이벤트로 받는다. 손가락을 댄 채 다음 점 위로 끌고 가도 그 점을 누른 것으로 본다.

const NS = 'http://www.w3.org/2000/svg';
const UNIT = 100; // 격자 한 칸
const ISLAND_UNIT = 160; // 섬과 다리의 그림에서 격자 한 칸(섬이 커서 칸을 넓혀야 다리가 보인다)
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

/** 그림의 격자 한 칸의 크기 */
const unitOf = (view) => (view.islands ? ISLAND_UNIT : UNIT);
const placeIn = (view) => (point) => [point[0] * unitOf(view), point[1] * unitOf(view)];

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
    const [x, y] = placeIn(view)(point);
    const distance = Math.hypot(spot[0] - x, spot[1] - y);
    if (distance <= bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

/** 같은 두 점 사이에 선이 여럿이면(다리) 굽은 선으로 벌려 그린다. 굽은 정도(가운데가 곧은 선에서 떨어지는 거리) */
const SPREAD = 40;

/**
 * 선마다 그릴 꼴: 곧은 선이면 control이 null, 굽은 선이면 2차 곡선의 조절점. mid는 선의 가운데(표시를 붙일 자리).
 * 같은 두 점 사이의 선이 하나면 곧게, 둘이면 양쪽으로, 셋이면 가운데 하나는 곧게 그린다.
 */
function shapesOf(spots, edges) {
  const groups = new Map();
  edges.forEach(([a, b], index) => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(index);
  });
  const shapes = [];
  for (const members of groups.values()) {
    members.forEach((index, order) => {
      const [a, b] = edges[index];
      // 방향을 작은 번호에서 큰 번호로 맞춰야 벌리는 쪽이 선마다 같다.
      const [p, q] = a < b ? [spots[a], spots[b]] : [spots[b], spots[a]];
      const bend = (order - (members.length - 1) / 2) * SPREAD;
      const length = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
      const normal = [-(q[1] - p[1]) / length, (q[0] - p[0]) / length];
      const middle = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      if (bend === 0) {
        shapes[index] = { from: spots[a], to: spots[b], control: null, mid: middle };
        return;
      }
      // 2차 곡선의 가운데는 조절점이 벌어진 거리의 절반만큼 벌어진다. 그래서 조절점은 두 배로 벌린다.
      const control = [middle[0] + normal[0] * bend * 2, middle[1] + normal[1] * bend * 2];
      shapes[index] = { from: spots[a], to: spots[b], control, mid: [middle[0] + normal[0] * bend, middle[1] + normal[1] * bend] };
    });
  }
  return shapes;
}

/** 점에서 선(곧은 선이나 굽은 선)까지의 거리. 굽은 선은 짧은 곧은 선 열여섯 개로 나눠 잰다 */
function distanceToShape(spot, shape) {
  if (!shape.control) return distanceToSegment(spot, shape.from, shape.to);
  const at = (t) => [0, 1].map((k) => (1 - t) * (1 - t) * shape.from[k] + 2 * (1 - t) * t * shape.control[k] + t * t * shape.to[k]);
  let best = Infinity;
  for (let step = 0; step < 16; step++) best = Math.min(best, distanceToSegment(spot, at(step / 16), at((step + 1) / 16)));
  return best;
}

function nearestEdge(view, spot) {
  let best = null;
  let bestDistance = EDGE_REACH;
  const shapes = shapesOf(view.points.map(placeIn(view)), view.edges);
  view.edges.forEach((_, index) => {
    const distance = distanceToShape(spot, shapes[index]);
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
 *   strokeOf 선마다 몇 번째 획(0부터)으로 그었는가(펜 몇 번 떼기). 그은 선에 획의 번호(1부터)를 붙이고 획마다 선의 무늬를 바꾼다
 *   islands  true면 점을 물 위의 섬으로, 선을 다리로 그린다(다리 건너기)
 *   divider  닮은 두 그림 사이에 세로 점선을 그을 가로 자리(격자 칸 단위)
 */
export function drawFigure(root, view) {
  const { points, edges, used = [], at = null, open = [], picked = [], marks = [], degrees = false, gone = [], added = [], signs = {}, small = false, strokeOf = null, islands = false } = view;
  // 획마다 그은 선 가운데 하나(그은 차례로 가운데 선)에 획의 번호를 붙인다(색만으로 알리지 않는다. 획마다 무늬도 다르다).
  // 선마다 붙이면 번호가 선을 가린다. 작은 그림에서는 번호 없이 무늬로만 가른다.
  let numbers = view.numbers ?? null;
  if (!numbers && strokeOf && !small) {
    numbers = edges.map(() => null);
    const byStroke = new Map();
    for (const edge of used) {
      if (strokeOf[edge] === null) continue;
      if (!byStroke.has(strokeOf[edge])) byStroke.set(strokeOf[edge], []);
      byStroke.get(strokeOf[edge]).push(edge);
    }
    for (const [stroke, list] of byStroke) numbers[list[Math.floor((list.length - 1) / 2)]] = stroke + 1;
  }
  root.className = `figure${small ? ' small' : ''}${view.onPoint || view.onEdge ? ' live' : ''}`;
  const board = boardOf(root);
  const { svg } = board;
  const focused = svg.contains(document.activeElement) ? document.activeElement.dataset : null;

  const k = small ? SMALL_SCALE : 1;
  // 섬은 점보다 커서 둘레의 고리를 그만큼 크게 그리고, 여백도 넓힌다.
  const grow = islands ? 10 : 0;
  const pad = (small ? SMALL_PAD : PAD) + grow;
  const spots = points.map(placeIn(view));
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

  // 다리 건너기: 판 전체가 물이다.
  if (islands) nodes.push(make('rect', { x: left, y: top, width, height, rx: 24 }, 'figure-water'));
  // 닮은 두 그림: 두 그림 사이에 세로 점선
  if (Number.isFinite(view.divider)) {
    const x = view.divider * unitOf(view);
    nodes.push(make('line', { x1: x, y1: top + pad / 2, x2: x, y2: top + height - pad / 2, 'stroke-width': 4 * k }, 'figure-divider'));
  }

  const sign = ([cx, cy], text, className) => {
    const group = make('g', {}, `figure-sign ${className}`);
    group.append(make('circle', { cx, cy, r: 18 * k }));
    const label = make('text', { x: cx, y: cy, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 28 * k });
    label.textContent = text;
    group.append(label);
    return group;
  };
  const middleOf = (a, b) => [(spots[a][0] + spots[b][0]) / 2, (spots[a][1] + spots[b][1]) / 2];
  const signNodes = [];

  // 뺀 선: 점선으로 자리만 남긴다.
  for (const [a, b] of gone) {
    nodes.push(make('line', { x1: spots[a][0], y1: spots[a][1], x2: spots[b][0], y2: spots[b][1], 'stroke-width': 5 * k }, 'figure-edge gone'));
    if (signs.removed) signNodes.push(sign(middleOf(a, b), signs.removed, 'removed'));
  }
  // 선: 그은 선은 굵게 그린다. 같은 두 점 사이의 선이 여럿이면 굽은 선으로 벌려 그린다.
  const shapes = shapesOf(spots, edges);
  const thin = islands ? 11 : 7;
  const thick = islands ? 17 : 15;
  edges.forEach((_, index) => {
    const names = ['figure-edge'];
    if (islands) names.push('bridge');
    if (used.includes(index)) names.push('used');
    if (added.includes(index)) names.push('added');
    // 획마다 선의 무늬를 바꾼다(네 가지를 돌려 쓴다).
    if (strokeOf && strokeOf[index] !== null) names.push(`stroke-${(strokeOf[index] % 4) + 1}`);
    const { from, to, control, mid } = shapes[index];
    const width = (used.includes(index) ? thick : thin) * k;
    const line = control
      ? make('path', { d: `M ${from[0]} ${from[1]} Q ${control[0]} ${control[1]} ${to[0]} ${to[1]}`, 'stroke-width': width }, names.join(' '))
      : make('line', { x1: from[0], y1: from[1], x2: to[0], y2: to[1], 'stroke-width': width }, names.join(' '));
    if (view.onEdge) {
      line.setAttribute('data-edge', index);
      line.setAttribute('tabindex', '0');
      line.setAttribute('role', 'button');
      if (view.edgeLabel) line.setAttribute('aria-label', view.edgeLabel(index));
    }
    nodes.push(line);
    if (added.includes(index) && signs.added) signNodes.push(sign(mid, signs.added, 'added'));
    if (numbers && numbers[index] != null) signNodes.push(sign(mid, String(numbers[index]), 'order'));
  });
  nodes.push(...signNodes);

  // 점
  spots.forEach(([x, y], index) => {
    const names = ['figure-point'];
    const group = make('g', { 'data-point': index });
    if (islands) group.append(make('circle', { cx: x, cy: y, r: 30 * (small ? 1.2 : 1), 'stroke-width': 4 * k }, 'figure-island'));
    if (marks.includes(index)) {
      group.append(make('circle', { cx: x, cy: y, r: 34 + grow }, 'figure-ring mark'));
      group.append(make('circle', { cx: x, cy: y, r: 25 + grow }, 'figure-ring mark'));
    }
    if (open.includes(index)) group.append(make('circle', { cx: x, cy: y, r: 29 + grow }, 'figure-ring open'));
    if (picked.includes(index)) group.append(make('circle', { cx: x, cy: y, r: 30 + grow }, 'figure-ring picked'));
    if (index === at) {
      names.push('now');
      group.append(make('circle', { cx: x, cy: y, r: 31 + grow }, 'figure-ring now'));
    }
    group.append(make('circle', { cx: x, cy: y, r: (index === at ? 20 : islands ? 9 : 13) * (small ? 1.3 : 1), 'stroke-width': 5 * k }, 'figure-dot'));
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
