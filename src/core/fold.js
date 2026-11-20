// 접히는 모양 가리기의 판과 풀이. 순수 함수만 둔다.
// 칸은 [x, y](가로, 세로. 세로는 아래로 는다)로 적는다.
//
// 접기: 정육면체 하나를 칸 위에 올려 두고, 이웃한 칸으로 굴려 가며(뿌리 칸에서 너비 우선) 칸마다 바닥에 닿는 면을 적는다.
// 칸에 닿은 면이 곧 그 칸이 접혀 붙는 면이다. 여섯 칸이 여섯 면에 따로 닿으면 정육면체가 되고,
// 두 칸이 같은 면에 닿으면 접었을 때 두 칸이 겹친다(그만큼 빈 면이 생긴다). 다섯 칸이 다섯 면에 따로 닿으면 뚜껑 없는 상자다.
//
// 판의 종류(kind):
//   fold      모양 하나: { kind, cells }. 다섯 칸이나 여섯 칸. 정육면체(다섯 칸이면 뚜껑 없는 상자)가 되는지 고른다
//   many      모양 여럿: { kind, shapes }. 정육면체가 되는 모양을 모두 고른다
//   opposite  그림이 있는 펼친 모양: { kind, cells, pictures, mark }. 표시한 칸의 맞은편에 오는 칸을 고른다
//   dice      쌓은 주사위: { kind, dice }. 주사위마다 [바닥, 위, 뒤, 앞, 오른쪽, 왼쪽]의 눈(아래 주사위부터). 안 보이는 면의 눈을 모두 더한다
//   all       열한 가지 모두 찾기: { kind, w, h, fixed }. w×h 모눈에 여섯 칸을 놓아 정육면체가 되는 모양을 모두 찾는다(fixed는 미리 놓인 칸)

export const KINDS = ['fold', 'many', 'opposite', 'dice', 'all'];

/** 정육면체의 면 자리: 바닥, 위, 뒤(북), 앞(남), 오른쪽(동), 왼쪽(서). 마주 보는 두 자리는 짝이다(0과 1, 2와 3, 4와 5) */
export const BOTTOM = 0;
export const TOP = 1;
export const BACK = 2;
export const FRONT = 3;
export const RIGHT = 4;
export const LEFT = 5;
export const oppositeFace = (face) => face ^ 1;

/** 굴리는 쪽과 칸의 움직임. 세로는 아래로 는다(북은 위) */
export const STEPS = { E: [1, 0], S: [0, 1], W: [-1, 0], N: [0, -1] };
const ORDER = ['E', 'S', 'W', 'N'];

/** 정육면체를 한 칸 굴린다. o는 자리마다(바닥, 위, 뒤, 앞, 오른쪽, 왼쪽) 그 자리에 있는 면의 이름이다 */
export const ROLL = {
  // 오른쪽으로: 오른쪽 면이 바닥에, 바닥이 왼쪽에, 왼쪽이 위에, 위가 오른쪽에 간다
  E: (o) => [o[RIGHT], o[LEFT], o[BACK], o[FRONT], o[TOP], o[BOTTOM]],
  W: (o) => [o[LEFT], o[RIGHT], o[BACK], o[FRONT], o[BOTTOM], o[TOP]],
  // 위(북)로: 뒤 면이 바닥에, 바닥이 앞에, 앞이 위에, 위가 뒤에 간다
  N: (o) => [o[BACK], o[FRONT], o[TOP], o[BOTTOM], o[RIGHT], o[LEFT]],
  S: (o) => [o[FRONT], o[BACK], o[BOTTOM], o[TOP], o[RIGHT], o[LEFT]],
};

export const cellKey = ([x, y]) => `${x},${y}`;
const IDENTITY = [0, 1, 2, 3, 4, 5];

// ---- 모양 ----

/** 칸들을 왼쪽 위로 붙이고(가장 작은 x, y가 0) 차례대로 늘어놓는다 */
export function normalize(cells) {
  const minX = Math.min(...cells.map((cell) => cell[0]));
  const minY = Math.min(...cells.map((cell) => cell[1]));
  return cells.map(([x, y]) => [x - minX, y - minY]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

/** 여덟 가지 돌리기와 뒤집기. 앞의 넷은 돌리기만(0, 90, 180, 270도), 뒤의 넷은 뒤집은 뒤 돌리기 */
export const SYMMETRIES = [
  ([x, y]) => [x, y],
  ([x, y]) => [-y, x],
  ([x, y]) => [-x, -y],
  ([x, y]) => [y, -x],
  ([x, y]) => [-x, y],
  ([x, y]) => [-y, -x],
  ([x, y]) => [x, -y],
  ([x, y]) => [y, x],
];

export const shapeKey = (cells) => JSON.stringify(normalize(cells));

/** 돌리거나 뒤집어 같은 모양은 같은 이름을 갖는다(여덟 모습 가운데 글자로 가장 앞선 것) */
export function freeKey(cells) {
  return SYMMETRIES.map((turn) => shapeKey(cells.map(turn))).sort()[0];
}

/** 모양을 돌리거나 뒤집는다(왼쪽 위로 붙인다) */
export const transform = (cells, index) => normalize(cells.map(SYMMETRIES[index]));

/**
 * 두 모양이 같은가: 'same'(옮기기만 하면 겹친다) | 'turn'(돌리면 겹친다) | 'flip'(뒤집어야 겹친다) | null(다른 모양)
 */
export function sameShape(a, b) {
  if (a.length !== b.length) return null;
  const target = shapeKey(b);
  if (shapeKey(a) === target) return 'same';
  for (let index = 1; index < 4; index++) if (shapeKey(a.map(SYMMETRIES[index])) === target) return 'turn';
  for (let index = 4; index < 8; index++) if (shapeKey(a.map(SYMMETRIES[index])) === target) return 'flip';
  return null;
}

/** 칸들이 변으로 모두 이어져 있는가 */
export function connected(cells) {
  if (cells.length === 0) return false;
  const keys = new Set(cells.map(cellKey));
  const seen = new Set([cellKey(cells[0])]);
  const queue = [cells[0]];
  while (queue.length > 0) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of Object.values(STEPS)) {
      const next = cellKey([x + dx, y + dy]);
      if (keys.has(next) && !seen.has(next)) {
        seen.add(next);
        queue.push([x + dx, y + dy]);
      }
    }
  }
  return seen.size === keys.size;
}

/** n칸짜리 모양(돌리고 뒤집어 같은 것은 하나)을 모두 만든다. 칸을 하나씩 붙여 간다 */
export function polyominoes(n) {
  let level = new Map([[freeKey([[0, 0]]), [[0, 0]]]]);
  for (let size = 1; size < n; size++) {
    const next = new Map();
    for (const cells of level.values()) {
      const keys = new Set(cells.map(cellKey));
      for (const [x, y] of cells) {
        for (const [dx, dy] of Object.values(STEPS)) {
          const add = [x + dx, y + dy];
          if (keys.has(cellKey(add))) continue;
          const grown = normalize([...cells, add]);
          const key = freeKey(grown);
          if (!next.has(key)) next.set(key, grown);
        }
      }
    }
    level = next;
  }
  return [...level.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([, cells]) => cells);
}

// ---- 접기 ----

/** 뿌리 칸: 꼭 감싸는 네모의 한가운데에 가장 가까운 칸(같으면 앞의 칸). 펼친 모양이 접힐 때 이 칸은 그대로 있다 */
export function rootOf(cells) {
  const xs = cells.map((cell) => cell[0]);
  const ys = cells.map((cell) => cell[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  let best = 0;
  cells.forEach(([x, y], index) => {
    const far = (x - cx) ** 2 + (y - cy) ** 2;
    const bestFar = (cells[best][0] - cx) ** 2 + (cells[best][1] - cy) ** 2;
    if (far < bestFar) best = index;
  });
  return best;
}

/**
 * 모양을 접는다(정육면체를 굴린다).
 * @param {number[][]} cells 이어진 칸들
 * @param {number} root 뿌리 칸의 차례(정하지 않으면 rootOf)
 * @returns {{ faces: number[], parent: number[], dir: (string|null)[], order: number[], root: number }}
 *   faces   칸마다 닿은 면(뿌리 칸이 닿은 면이 바닥 0이다)
 *   parent  칸마다 접히는 이음매의 건너편 칸(뿌리는 −1), dir은 그 칸에서 이 칸으로 가는 쪽(E, S, W, N)
 *   order   접는 차례(뿌리부터 너비 우선)
 */
export function foldNet(cells, root = rootOf(cells)) {
  const index = new Map(cells.map((cell, at) => [cellKey(cell), at]));
  const faces = Array(cells.length).fill(-1);
  const parent = Array(cells.length).fill(-1);
  const dir = Array(cells.length).fill(null);
  const orient = [];
  faces[root] = BOTTOM;
  orient[root] = IDENTITY;
  const order = [root];
  for (let at = 0; at < order.length; at++) {
    const from = order[at];
    for (const step of ORDER) {
      const [dx, dy] = STEPS[step];
      const to = index.get(cellKey([cells[from][0] + dx, cells[from][1] + dy]));
      if (to === undefined || faces[to] !== -1) continue;
      orient[to] = ROLL[step](orient[from]);
      faces[to] = orient[to][BOTTOM];
      parent[to] = from;
      dir[to] = step;
      order.push(to);
    }
  }
  return { faces, parent, dir, order, root };
}

/** 같은 면에 닿는 칸들의 묶음(둘 이상인 것만). 접으면 겹치는 칸들이다 */
export function clashesOf(faces) {
  const groups = new Map();
  faces.forEach((face, at) => groups.set(face, [...(groups.get(face) ?? []), at]));
  return [...groups.values()].filter((group) => group.length > 1);
}

/** 접은 모습: 칸마다의 면, 겹치는 칸 묶음, 비는 면의 수, 정육면체(다섯 칸이면 뚜껑 없는 상자)가 되는가 */
export function foldResult(cells, root) {
  const folded = foldNet(cells, root);
  const clashes = clashesOf(folded.faces);
  const used = new Set(folded.faces).size;
  return { ...folded, clashes, empty: 6 - used, ok: clashes.length === 0 };
}

/** 여섯 칸이 정육면체가 되는가 */
export const isCubeNet = (cells) => cells.length === 6 && connected(cells) && foldResult(cells).ok;

/** 정육면체가 되는 여섯 칸 모양 모두(돌리고 뒤집어 같은 것은 하나) */
export function cubeNets() {
  return polyominoes(6).filter(isCubeNet);
}

/** 펼친 모양에서 칸 at의 맞은편에 오는 칸(정육면체가 되는 모양만) */
export function oppositeOf(cells, at) {
  const { faces } = foldNet(cells);
  return faces.indexOf(oppositeFace(faces[at]));
}

/** 네 칸이 한 줄로 이어진 곳이 있는가(가로나 세로) */
export function hasRowOfFour(cells) {
  const keys = new Set(cells.map(cellKey));
  return cells.some(([x, y]) => [0, 1, 2, 3].every((step) => keys.has(cellKey([x + step, y]))) || [0, 1, 2, 3].every((step) => keys.has(cellKey([x, y + step]))));
}

// ---- 주사위 ----

/** 주사위 하나의 처음 모습: 바닥 6, 위 1, 뒤 5, 앞 2, 오른쪽 3, 왼쪽 4. 마주 보는 두 면의 눈을 더하면 7이다 */
export const DIE = [6, 1, 5, 2, 3, 4];

/** 주사위를 굴려서 놓을 수 있는 모습 스물넷(처음 모습부터 너비 우선) */
export function dieTurns() {
  const seen = new Map([[DIE.join(), DIE]]);
  const queue = [DIE];
  while (queue.length > 0) {
    const die = queue.shift();
    for (const step of ORDER) {
      const next = ROLL[step](die);
      if (!seen.has(next.join())) {
        seen.set(next.join(), next);
        queue.push(next);
      }
    }
  }
  return [...seen.values()];
}
const TURNS = dieTurns();
const TURN_KEYS = new Set(TURNS.map((die) => die.join()));
export const isDie = (die) => Array.isArray(die) && die.length === 6 && TURN_KEYS.has(die.join());

/** 쌓은 주사위에서 안 보이는 면: 주사위마다 바닥, 맨 위 주사위가 아니면 위도. [주사위 차례, 자리]의 목록 */
export function hiddenFaces(dice) {
  const list = [];
  dice.forEach((die, at) => {
    list.push([at, BOTTOM]);
    if (at < dice.length - 1) list.push([at, TOP]);
  });
  return list;
}

// ---- 열한 가지 모두 찾기 ----

/** 모양이 w×h 모눈 안에, 미리 놓인 칸을 모두 덮게 놓이는가(돌리고 뒤집어도 된다) */
export function fitsWith(cells, { w, h, fixed = [] }) {
  const need = fixed.map(cellKey);
  for (let index = 0; index < 8; index++) {
    const shape = transform(cells, index);
    const sw = Math.max(...shape.map((cell) => cell[0])) + 1;
    const sh = Math.max(...shape.map((cell) => cell[1])) + 1;
    for (let x = 0; x + sw <= w; x++) {
      for (let y = 0; y + sh <= h; y++) {
        const keys = new Set(shape.map(([cx, cy]) => cellKey([cx + x, cy + y])));
        if (need.every((key) => keys.has(key))) return true;
      }
    }
  }
  return false;
}

/** 이 판에서 찾을 수 있는 정육면체 모양들의 이름(freeKey) */
export const targetsOf = (board) => cubeNets().filter((cells) => fitsWith(cells, board)).map(freeKey).sort();

// ---- 판 ----

export const MAX_W = 7;
export const MAX_H = 6;
/** 그림의 이름(대본의 pictures에 같은 이름의 글이 있다) */
export const PICTURES = ['circle', 'triangle', 'square', 'diamond', 'heart', 'moon'];
export const MAX_SHAPES = 6;
export const MAX_DICE = 4;

const cellsOk = (cells, size) => Array.isArray(cells) && cells.length === size && cells.every((cell) => Array.isArray(cell) && cell.length === 2 && cell.every(Number.isInteger) && cell[0] >= 0 && cell[1] >= 0 && cell[0] < MAX_W * 2 && cell[1] < MAX_H * 2) && new Set(cells.map(cellKey)).size === size && connected(cells);

/** 판이 규격에 맞으면 null, 아니면 까닭 */
export function checkBoard(board) {
  if (!board || typeof board !== 'object' || !KINDS.includes(board.kind)) return '판의 종류가 없어요';
  if (board.kind === 'fold') {
    if (!(cellsOk(board.cells, 6) || cellsOk(board.cells, 5))) return '칸이 다섯이나 여섯이고 이어져 있어야 해요';
    return null;
  }
  if (board.kind === 'many') {
    if (!Array.isArray(board.shapes) || board.shapes.length < 2 || board.shapes.length > MAX_SHAPES) return '모양은 둘에서 여섯이에요';
    if (!board.shapes.every((cells) => cellsOk(cells, 6))) return '모양마다 여섯 칸이 이어져 있어야 해요';
    if (new Set(board.shapes.map(freeKey)).size !== board.shapes.length) return '같은 모양이 둘 있어요';
    return null;
  }
  if (board.kind === 'opposite') {
    if (!cellsOk(board.cells, 6) || !isCubeNet(board.cells)) return '정육면체가 되는 여섯 칸이어야 해요';
    if (!Array.isArray(board.pictures) || board.pictures.length !== 6 || new Set(board.pictures).size !== 6 || !board.pictures.every((name) => PICTURES.includes(name))) return '칸마다 다른 그림이 있어야 해요';
    if (!Number.isInteger(board.mark) || board.mark < 0 || board.mark >= 6) return '표시한 칸이 없어요';
    return null;
  }
  if (board.kind === 'dice') {
    if (!Array.isArray(board.dice) || board.dice.length < 1 || board.dice.length > MAX_DICE || !board.dice.every(isDie)) return '주사위가 맞지 않아요';
    return null;
  }
  if (!Number.isInteger(board.w) || !Number.isInteger(board.h) || board.w < 3 || board.h < 2 || board.w > MAX_W || board.h > MAX_H) return '모눈의 크기가 맞지 않아요';
  if (!Array.isArray(board.fixed) || board.fixed.length > 5) return '놓인 칸이 맞지 않아요';
  if (!board.fixed.every((cell) => Array.isArray(cell) && cell.length === 2 && cell.every(Number.isInteger) && cell[0] >= 0 && cell[1] >= 0 && cell[0] < board.w && cell[1] < board.h)) return '놓인 칸이 모눈 밖이에요';
  if (board.fixed.length > 0 && !connected(board.fixed)) return '놓인 칸이 이어져 있어야 해요';
  if (targetsOf(board).length === 0) return '찾을 모양이 없어요';
  return null;
}

export function copyBoard(board) {
  return JSON.parse(JSON.stringify(board));
}

/**
 * 판을 푼다.
 *   fold      possible(정육면체나 뚜껑 없는 상자가 되는가), faces, clashes(겹치는 칸 묶음), empty(비는 면의 수), box(다섯 칸인가)
 *   many      possible(늘 참), nets(모양마다 되는가), count(되는 모양의 수)
 *   opposite  possible(늘 참), answer(맞은편 칸), faces, touching(표시한 칸과 변이 맞닿는 칸들)
 *   dice      possible(늘 참), hidden(안 보이는 면 [주사위, 자리]), values(그 눈들), sum, count(안 보이는 면의 수), top(맨 위의 눈)
 *   all       possible(늘 참), targets(찾을 모양의 이름들), total
 */
export function solve(board) {
  const problem = checkBoard(board);
  if (problem) throw new Error(problem);
  if (board.kind === 'fold') {
    const result = foldResult(board.cells);
    return { possible: result.ok, faces: result.faces, clashes: result.clashes, empty: result.empty, box: board.cells.length === 5 };
  }
  if (board.kind === 'many') {
    const nets = board.shapes.map(isCubeNet);
    return { possible: true, nets, count: nets.filter(Boolean).length };
  }
  if (board.kind === 'opposite') {
    const { faces } = foldNet(board.cells);
    const answer = faces.indexOf(oppositeFace(faces[board.mark]));
    const touching = faces.map((face, at) => at).filter((at) => at !== board.mark && at !== answer);
    return { possible: true, answer, faces, touching };
  }
  if (board.kind === 'dice') {
    const hidden = hiddenFaces(board.dice);
    const values = hidden.map(([at, face]) => board.dice[at][face]);
    return { possible: true, hidden, values, sum: values.reduce((total, value) => total + value, 0), count: hidden.length, top: board.dice.at(-1)[TOP] };
  }
  const targets = targetsOf(board);
  return { possible: true, targets, total: targets.length };
}

/** 모눈 위에 놓은 칸들이 접어 볼 만한가: 여섯 칸이고 이어져 있다 */
export const readyToFold = (cells) => cells.length === 6 && connected(cells);
