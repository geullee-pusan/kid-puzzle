// 조각 가짓수 찾기의 판과 풀이. 순수 함수만 둔다.
// 칸은 [x, y](가로, 세로. 세로는 아래로 는다)로 적는다. 조각은 변으로 이어진 칸들이다.
//
// "같은 조각"의 약속(rule):
//   free   돌리거나 뒤집어 겹치면 같은 조각(여덟 모습 가운데 하나를 대표로 삼는다). 1, 1, 2, 5, 12, 35가지
//   turn   돌려서 겹칠 때만 같은 조각(뒤집어야 겹치면 다른 조각). 1, 1, 2, 7, 18, 60가지
//   fixed  옮기기만 해서 겹칠 때만 같은 조각(돌려도 다른 조각). 1, 2, 6, 19, 63, 216가지
//
// 판: { n, rule, row, tell }
//   n     조각의 칸 수
//   rule  같은 조각의 약속
//   row   null이면 그 크기의 조각 모두. 수면 "가장 긴 줄"(가로나 세로로 곧게 이어진 칸)이 꼭 그 칸 수인 조각만 찾는다
//   tell  참이면 규칙에서 모두 몇 가지인지 알려 준다. 거짓이면 아이가 먼저 짐작한 수를 넣는다

export const RULES = ['free', 'turn', 'fixed'];
export const MIN_SIZE = 2;
/** 약속마다 판으로 낼 수 있는 가장 큰 조각(가짓수가 35, 18, 19를 넘지 않게) */
export const MAX_SIZE = { free: 6, turn: 5, fixed: 4 };
/** 찾을 조각이 이보다 많은 판은 내지 않는다 */
export const MAX_TOTAL = 35;

export const cellKey = ([x, y]) => `${x},${y}`;
const STEPS = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

/** 칸들을 왼쪽 위로 붙이고(가장 작은 x, y가 0) 위에서 아래로, 왼쪽에서 오른쪽으로 늘어놓는다 */
export function normalize(cells) {
  const minX = Math.min(...cells.map((cell) => cell[0]));
  const minY = Math.min(...cells.map((cell) => cell[1]));
  return cells.map(([x, y]) => [x - minX, y - minY]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

export const shapeKey = (cells) => normalize(cells).map(cellKey).join(' ');

/**
 * 여덟 가지 돌리기와 뒤집기(화면 좌표, 세로는 아래로 는다).
 * 0~3은 돌리기만: 0도, 시계 방향 90도, 180도, 시계 반대 방향 90도. 돌리기 R은 (x, y) → (−y, x)다.
 * 4~7은 좌우로 뒤집은(F: (x, y) → (−x, y)) 뒤에 같은 차례로 돌린 것이다.
 */
export const TURNS = [
  ([x, y]) => [x, y],
  ([x, y]) => [-y, x],
  ([x, y]) => [-x, -y],
  ([x, y]) => [y, -x],
  ([x, y]) => [-x, y],
  ([x, y]) => [-y, -x],
  ([x, y]) => [x, -y],
  ([x, y]) => [y, x],
];
/** 화면에서 돌려 보일 때의 각도(도). 3번은 시계 반대 방향 90도다 */
export const ANGLES = [0, 90, 180, -90, 0, 90, 180, -90];
export const isFlip = (index) => index >= 4;

/** 약속마다 "같다"고 치는 움직임들 */
export const GROUPS = { free: [0, 1, 2, 3, 4, 5, 6, 7], turn: [0, 1, 2, 3], fixed: [0] };

/** 모양을 돌리거나 뒤집는다(왼쪽 위로 붙인다) */
export const transform = (cells, index) => normalize(cells.map(TURNS[index]));

/** 약속에 따른 조각의 이름: 같다고 치는 모습들 가운데 글자로 가장 앞선 것 */
export function keyOf(cells, rule = 'free') {
  return GROUPS[rule].map((index) => shapeKey(cells.map(TURNS[index]))).sort()[0];
}

/** 대표 모습: 이름과 같은 모습(왼쪽 위로 붙인 칸들) */
export function representative(cells, rule = 'free') {
  const key = keyOf(cells, rule);
  for (const index of GROUPS[rule]) {
    const shape = transform(cells, index);
    if (shapeKey(shape) === key) return shape;
  }
  return normalize(cells);
}

/** 칸들이 변으로 모두 이어져 있는가 */
export function connected(cells) {
  if (cells.length === 0) return false;
  const keys = new Set(cells.map(cellKey));
  if (keys.size !== cells.length) return false;
  const seen = new Set([cellKey(cells[0])]);
  const queue = [cells[0]];
  while (queue.length > 0) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of STEPS) {
      const next = cellKey([x + dx, y + dy]);
      if (keys.has(next) && !seen.has(next)) {
        seen.add(next);
        queue.push([x + dx, y + dy]);
      }
    }
  }
  return seen.size === keys.size;
}

/** 가장 긴 줄: 가로나 세로로 곧게 이어진 칸의 가장 큰 수 */
export function longestRow(cells) {
  const keys = new Set(cells.map(cellKey));
  let best = 0;
  for (const [x, y] of cells) {
    for (const [dx, dy] of [STEPS[0], STEPS[1]]) {
      // 줄의 첫 칸에서만 센다
      if (keys.has(cellKey([x - dx, y - dy]))) continue;
      let length = 0;
      while (keys.has(cellKey([x + dx * length, y + dy * length]))) length += 1;
      best = Math.max(best, length);
    }
  }
  return best;
}

/** 가장 긴 줄의 칸들(그런 줄이 여럿이면 위 왼쪽에서 먼저 나오는 가로줄, 그다음 세로줄) */
export function rowCells(cells) {
  const keys = new Set(cells.map(cellKey));
  const best = longestRow(cells);
  for (const [dx, dy] of [STEPS[0], STEPS[1]]) {
    for (const [x, y] of normalize(cells)) {
      if (keys.has(cellKey([x - dx, y - dy]))) continue;
      let length = 0;
      while (keys.has(cellKey([x + dx * length, y + dy * length]))) length += 1;
      if (length === best) return Array.from({ length }, (_, step) => [x + dx * step, y + dy * step]);
    }
  }
  return [];
}

/** 한 칸 붙여서 만들 수 있는 모습들(왼쪽 위로 붙인 것, 겹치는 것은 하나) */
export function grownShapes(cells) {
  const keys = new Set(cells.map(cellKey));
  const out = new Map();
  for (const [x, y] of cells) {
    for (const [dx, dy] of STEPS) {
      const add = [x + dx, y + dy];
      if (keys.has(cellKey(add))) continue;
      const grown = normalize([...cells, add]);
      out.set(shapeKey(grown), grown);
    }
  }
  return [...out.values()];
}

/** 끝의 칸 하나를 떼어도 나머지가 이어져 있는 칸들(떼어 낼 수 있는 칸) */
export const removableCells = (cells) => cells.filter((cell) => cells.length > 1 && connected(cells.filter((other) => other !== cell)));

const memo = new Map();
/**
 * n칸 조각 모두(약속에 따라 같은 것은 하나). 한 칸에서 시작해 한 칸씩 붙여 간다.
 * 대표 모습으로 이름 차례대로 늘어놓는다.
 */
export function piecesOf(n, rule = 'free') {
  const id = `${n}:${rule}`;
  if (!memo.has(id)) {
    let level = new Map([[keyOf([[0, 0]], rule), [[0, 0]]]]);
    for (let size = 1; size < n; size++) {
      const next = new Map();
      for (const cells of level.values()) {
        for (const grown of grownShapes(cells)) {
          const key = keyOf(grown, rule);
          if (!next.has(key)) next.set(key, representative(grown, rule));
        }
      }
      level = next;
    }
    memo.set(
      id,
      [...level.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([, cells]) => cells),
    );
  }
  return memo.get(id).map((cells) => cells.map((cell) => cell.slice()));
}

/** 판에서 찾을 조각들(대표 모습). 줄이 정해진 판은 가장 긴 줄이 그 칸 수인 것만. 가장 긴 줄이 긴 것부터 늘어놓는다 */
export function targetsOf(board) {
  return piecesOf(board.n, board.rule)
    .filter((cells) => board.row === null || longestRow(cells) === board.row)
    .map((cells, at) => ({ cells, at, row: longestRow(cells) }))
    .sort((a, b) => b.row - a.row || a.at - b.at)
    .map((item) => item.cells);
}

/** 가장 긴 줄의 칸 수마다 조각이 몇 가지인가: { 줄: 수 } */
export function rowCounts(n, rule = 'free') {
  const counts = {};
  for (const cells of piecesOf(n, rule)) {
    const row = longestRow(cells);
    counts[row] = (counts[row] ?? 0) + 1;
  }
  return counts;
}

/** 움직임을 고르는 차례: 그대로, 90도씩 돌리기, 180도, 그다음 뒤집기(뒤집기만, 위아래로, 뒤집고 돌리기) */
const PREFER = [0, 1, 3, 2, 4, 6, 5, 7];

/**
 * 모양 a를 b에 겹치는 움직임(TURNS의 차례). 그런 움직임이 없으면 −1.
 * @param {number[]} allowed 써도 되는 움직임들
 */
export function matchTurn(a, b, allowed = GROUPS.free) {
  if (a.length !== b.length) return -1;
  const target = shapeKey(b);
  for (const index of PREFER) if (allowed.includes(index) && shapeKey(a.map(TURNS[index])) === target) return index;
  return -1;
}

/** 움직임의 이름: 'same'(옮기기만) | 'turn'(돌리기) | 'flip'(뒤집기) */
export const howOf = (index) => (index === 0 ? 'same' : index < 4 ? 'turn' : 'flip');

/**
 * 새로 만든 조각을 찾은 조각들과 견준다.
 * @returns {{ at: number, turn: number, how: string, counted: boolean } | null}
 *   at       겹치는 찾은 조각의 차례
 *   turn     새 조각을 그 조각에 겹치는 움직임
 *   counted  참이면 이 판의 약속으로 같은 조각이다(선반에 다시 놓지 않는다).
 *            거짓이면 돌리거나 뒤집으면 겹치지만 이 판의 약속으로는 다른 조각이다(새 조각으로 선반에 놓는다)
 *   null     어느 찾은 조각과도 돌리고 뒤집어 겹치지 않는다
 */
export function compareWith(cells, shelf, rule = 'free') {
  for (const [at, other] of shelf.entries()) {
    const turn = matchTurn(cells, other, GROUPS[rule]);
    if (turn >= 0) return { at, turn, how: howOf(turn), counted: true };
  }
  if (rule === 'free') return null;
  for (const [at, other] of shelf.entries()) {
    const turn = matchTurn(cells, other, GROUPS.free);
    if (turn >= 0) return { at, turn, how: howOf(turn), counted: false };
  }
  return null;
}

// ---- 판 ----

/** 조각을 만드는 모눈의 크기: 가장 긴 조각(한 줄)이 가로로 들어가고 한 칸이 남는다 */
export const gridOf = (n) => ({ w: Math.max(n + 1, 4), h: Math.max(n, 3) });

/** 판이 규격에 맞으면 null, 아니면 까닭 */
export function checkBoard(board) {
  if (!board || typeof board !== 'object') return '판이 없어요';
  if (!RULES.includes(board.rule)) return '같은 조각의 약속이 없어요';
  if (!Number.isInteger(board.n) || board.n < MIN_SIZE || board.n > MAX_SIZE[board.rule]) return '조각의 칸 수가 맞지 않아요';
  if (!(board.row === null || (Number.isInteger(board.row) && board.row >= 2 && board.row <= board.n))) return '가장 긴 줄이 맞지 않아요';
  if (typeof board.tell !== 'boolean') return '가짓수를 알려 줄지 정해야 해요';
  const total = targetsOf(board).length;
  if (total === 0) return '찾을 조각이 없어요';
  if (total > MAX_TOTAL) return '찾을 조각이 너무 많아요';
  return null;
}

export const copyBoard = (board) => ({ n: board.n, rule: board.rule, row: board.row, tell: board.tell });

/**
 * 판을 푼다.
 *   possible  늘 참
 *   total     찾을 조각의 수
 *   keys      찾을 조각들의 이름(이 판의 약속으로)
 *   pieces    찾을 조각들(대표 모습, 가장 긴 줄이 긴 것부터)
 *   free      같은 크기(같은 줄)에서 돌리고 뒤집어 같은 것을 하나로 친 가짓수
 */
export function solve(board) {
  const problem = checkBoard(board);
  if (problem) throw new Error(problem);
  const pieces = targetsOf(board);
  const keys = pieces.map((cells) => keyOf(cells, board.rule));
  const free = targetsOf({ ...board, rule: 'free' }).length;
  return { possible: true, total: pieces.length, keys, pieces, free };
}

/**
 * 모눈에 놓은 칸들을 살핀다(올려놓기를 눌렀을 때).
 * @returns {'empty' | 'short' | 'apart' | 'row' | 'ok'}
 */
export function checkPiece(cells, board) {
  if (cells.length === 0) return 'empty';
  if (cells.length < board.n) return 'short';
  if (!connected(cells)) return 'apart';
  if (board.row !== null && longestRow(cells) !== board.row) return 'row';
  return 'ok';
}

// ---- 작은 판 ----

/**
 * 원래 판보다 작은 판들: 같은 약속(같은 줄)으로 칸이 하나, 둘 적은 조각. 찾을 것이 둘 이상인 판만, 칸이 많은 것부터.
 * 가짓수를 알려 주는지는 원래 판을 따른다.
 */
export function smallBoards(board) {
  if (checkBoard(board) !== null) return [];
  const list = [];
  for (let n = board.n - 1; n >= Math.max(MIN_SIZE, board.n - 2); n--) {
    const small = { ...copyBoard(board), n };
    if (small.row !== null && small.row > n) continue;
    if (checkBoard(small) !== null) continue;
    if (targetsOf(small).length < 2) continue;
    list.push(small);
  }
  return list;
}
