// 조각 덮기: 판, 조각을 놓는 규칙, 풀이 프로그램(되짚기 탐색), 판에 입히는 무늬, 막힘, 오답 짐작.
// 순수 함수만 둔다. 화면에 손대지 않고, 무작위 수는 시드 난수만 쓰고, 지금 시각을 쓰지 않는다. 같은 입력은 늘 같은 출력을 낸다.
//
// 판(board): { w, h, piece, holes }
//   w, h    가로와 세로의 칸 수
//   piece   덮는 조각. 'domino'(두 칸) | 'bar'(일자 세 칸) | 'ell'(ㄱ자 세 칸). 한 판에는 한 가지 조각만 쓴다
//   holes   빠진 칸의 번호들(작은 것부터). 칸 번호는 왼쪽 위가 0이고 오른쪽으로, 그다음 아래 줄로 센다(번호 = 세로 × w + 가로)
//
// 놓은 조각 하나는 그 조각이 덮는 칸 번호들이다(작은 것부터). 조각은 돌려 놓아도 된다.
// 지나온 길(trail)은 한 일의 목록이다: { op: 'place' | 'remove', cells }. 처음부터 따라가면 지금 놓인 조각들이 나온다.
import { createRng } from './rng.js';

/** 판의 가로와 세로의 아래 끝과 위 끝(직접 만들기에서 고를 수 있는 크기) */
export const MIN_SIZE = 3;
export const MAX_SIZE = 8;

/** 조각과 그 칸 수 */
export const PIECES = { domino: 2, bar: 3, ell: 3 };
export const PIECE_IDS = ['domino', 'bar', 'ell'];

/**
 * 판에 입히는 무늬.
 *   'checker'  바둑판 무늬(두 색): (가로 + 세로)를 2로 나눈 나머지
 *   'stripe'   대각 줄무늬(세 색): (가로 + 세로)를 3으로 나눈 나머지
 *   'back'     반대쪽 대각 줄무늬(세 색): (가로 + 2 × 세로)를 3으로 나눈 나머지. 화면의 단추에는 없고 "왜 그럴까?"와 풀이 프로그램이 쓴다
 */
export const PATTERNS = ['none', 'checker', 'stripe'];
export const PATTERN_COLORS = { none: 1, checker: 2, stripe: 3, back: 3 };

/**
 * 풀이 프로그램이 따져 보는 걸음 수의 위 끝. 넘으면 "끝까지 따져 보지 못했다"고 사실대로 말한다.
 * 8×8까지의 판에서 재 본 가장 큰 걸음 수는 이보다 훨씬 적다(tests/tile.test.js).
 */
export const SOLVE_LIMIT = 400000;

/** 판이 규격에 맞는지 본다. 맞으면 null, 아니면 무엇이 틀렸는지 알리는 열쇠 */
export function checkBoard(board) {
  if (!board || typeof board !== 'object') return 'no-board';
  for (const side of [board.w, board.h]) {
    if (!Number.isInteger(side) || side < MIN_SIZE || side > MAX_SIZE) return 'bad-size';
  }
  if (!PIECE_IDS.includes(board.piece)) return 'bad-piece';
  if (!Array.isArray(board.holes)) return 'bad-holes';
  const cells = board.w * board.h;
  let before = -1;
  for (const hole of board.holes) {
    if (!Number.isInteger(hole) || hole <= before || hole >= cells) return 'bad-holes';
    before = hole;
  }
  if (board.holes.length >= cells) return 'no-cells';
  return null;
}

export const cellOf = (board, x, y) => y * board.w + x;
export const xyOf = (board, cell) => [cell % board.w, Math.floor(cell / board.w)];

/** 무늬에서 그 칸의 색(0부터) */
export function colorOf(pattern, x, y) {
  if (pattern === 'checker') return (x + y) % 2;
  if (pattern === 'stripe') return (x + y) % 3;
  if (pattern === 'back') return (x + 2 * y) % 3;
  return 0;
}

/** 빠진 칸과 덮인 칸에 1을 적은 배열 */
function takenOf(board, placed = []) {
  const taken = new Uint8Array(board.w * board.h);
  for (const hole of board.holes) taken[hole] = 1;
  for (const cells of placed) for (const cell of cells) taken[cell] = 1;
  return taken;
}

/** 남은 빈칸들(빠지지도 덮이지도 않은 칸) */
export function emptyCells(board, placed = []) {
  const taken = takenOf(board, placed);
  const cells = [];
  for (let cell = 0; cell < taken.length; cell++) if (!taken[cell]) cells.push(cell);
  return cells;
}

/** 무늬의 색마다 남은 빈칸의 수 */
export function colorCounts(board, pattern, placed = []) {
  const counts = Array(PATTERN_COLORS[pattern]).fill(0);
  for (const cell of emptyCells(board, placed)) counts[colorOf(pattern, ...xyOf(board, cell))] += 1;
  return counts;
}

/**
 * 칸들이 어느 조각의 모양인지 본다. 어느 조각도 아니면 null.
 * 두 칸이 이웃하면 도미노, 세 칸이 한 줄로 나란하면 일자, 세 칸이 두 칸짜리 네모 안에 있으면 ㄱ자다.
 */
export function shapeOf(board, cells) {
  if (!Array.isArray(cells) || new Set(cells).size !== cells.length) return null;
  if (cells.some((cell) => !Number.isInteger(cell) || cell < 0 || cell >= board.w * board.h)) return null;
  const spots = cells.map((cell) => xyOf(board, cell));
  const xs = spots.map((spot) => spot[0]);
  const ys = spots.map((spot) => spot[1]);
  const wide = Math.max(...xs) - Math.min(...xs) + 1;
  const tall = Math.max(...ys) - Math.min(...ys) + 1;
  if (cells.length === 2) return (wide === 2 && tall === 1) || (wide === 1 && tall === 2) ? 'domino' : null;
  if (cells.length !== 3) return null;
  if ((wide === 3 && tall === 1) || (wide === 1 && tall === 3)) return 'bar';
  if (wide === 2 && tall === 2) return 'ell';
  return null;
}

const sorted = (cells) => cells.slice().sort((a, b) => a - b);

/**
 * 이 칸들에 조각을 놓을 수 있는지 본다. 놓을 수 있으면 null, 아니면 까닭의 열쇠.
 *   'off'      판 밖이거나 같은 칸을 두 번 골랐다
 *   'hole'     빠진 칸이 들어 있다
 *   'covered'  이미 덮인 칸이 들어 있다
 *   'few'      칸이 모자란다
 *   'many'     칸이 너무 많다
 *   'shape'    칸 수는 맞지만 이 판의 조각 모양이 아니다
 */
export function placeProblem(board, placed, cells) {
  if (!Array.isArray(cells) || cells.length === 0 || new Set(cells).size !== cells.length) return 'off';
  if (cells.some((cell) => !Number.isInteger(cell) || cell < 0 || cell >= board.w * board.h)) return 'off';
  if (cells.some((cell) => board.holes.includes(cell))) return 'hole';
  const taken = takenOf(board, placed);
  if (cells.some((cell) => taken[cell])) return 'covered';
  const size = PIECES[board.piece];
  if (cells.length < size) return 'few';
  if (cells.length > size) return 'many';
  return shapeOf(board, cells) === board.piece ? null : 'shape';
}

/** 조각의 모양들: 맨 처음 칸(가장 작은 번호의 칸)에서 본 나머지 칸의 자리(가로, 세로) */
const SHAPES = {
  domino: [
    [[1, 0]],
    [[0, 1]],
  ],
  bar: [
    [[1, 0], [2, 0]],
    [[0, 1], [0, 2]],
  ],
  ell: [
    [[1, 0], [0, 1]],
    [[1, 0], [1, 1]],
    [[0, 1], [1, 1]],
    [[-1, 1], [0, 1]],
  ],
};

/** 그 칸을 맨 처음 칸으로 하는 조각 자리들(판 안에 들어가는 것만). 빠진 칸과 덮인 칸은 따지지 않는다 */
function shapesFrom(board, cell) {
  const [x, y] = xyOf(board, cell);
  const found = [];
  for (const shape of SHAPES[board.piece]) {
    const cells = [cell];
    for (const [dx, dy] of shape) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= board.w || ny >= board.h) break;
      cells.push(cellOf(board, nx, ny));
    }
    if (cells.length === shape.length + 1) found.push(cells);
  }
  return found;
}

/** 지금 놓을 수 있는 조각 자리 모두(놓인 조각과 겹치지 않고 빠진 칸을 덮지 않는 것) */
export function placementsOf(board, placed = []) {
  const taken = takenOf(board, placed);
  const found = [];
  for (let cell = 0; cell < taken.length; cell++) {
    if (taken[cell]) continue;
    for (const cells of shapesFrom(board, cell)) if (cells.every((item) => !taken[item])) found.push(cells);
  }
  return found;
}

const sameCells = (a, b) => a.length === b.length && a.every((cell, index) => cell === b[index]);

/**
 * 지나온 길을 처음부터 따라가 본다.
 * @param {object} board
 * @param {{op: string, cells: number[]}[]} trail 한 일의 목록. 'place'는 조각을 놓고 'remove'는 그 칸들의 조각을 들어낸다
 * @returns {{ok: boolean, placed: number[][], left: number}}
 *   ok      길의 모든 일이 규칙에 맞는가
 *   placed  지금 놓여 있는 조각들(놓은 차례대로)
 *   left    남은 빈칸의 수
 */
export function replay(board, trail) {
  let placed = [];
  const result = (ok) => ({ ok, placed, left: board.w * board.h - board.holes.length - placed.length * PIECES[board.piece] });
  if (!Array.isArray(trail)) return result(false);
  for (const step of trail) {
    if (!step || !Array.isArray(step.cells)) return result(false);
    const cells = sorted(step.cells);
    if (step.op === 'place') {
      if (placeProblem(board, placed, cells) !== null) return result(false);
      placed = [...placed, cells];
    } else if (step.op === 'remove') {
      const at = placed.findIndex((item) => sameCells(item, cells));
      if (at < 0) return result(false);
      placed = placed.filter((_, index) => index !== at);
    } else return result(false);
  }
  return result(true);
}

/** 다 덮었는가 */
export function isDone(board, placed) {
  return emptyCells(board, placed).length === 0;
}

/** 막혔는가: 빈칸이 남았는데 조각을 놓을 자리가 없다 */
export function isStuck(board, placed) {
  return !isDone(board, placed) && placementsOf(board, placed).length === 0;
}

/** 조각이 들어갈 수 없는 빈칸들: 지금 놓을 수 있는 어느 조각 자리에도 들어 있지 않은 빈칸 */
export function deadCells(board, placed = []) {
  const alive = new Set(placementsOf(board, placed).flat());
  return emptyCells(board, placed).filter((cell) => !alive.has(cell));
}

/** 빈칸들이 이루는 덩어리(변으로 이어진 것끼리)의 크기들 */
function islandSizes(board, taken) {
  const seen = taken.slice();
  const sizes = [];
  for (let start = 0; start < seen.length; start++) {
    if (seen[start]) continue;
    let size = 0;
    const stack = [start];
    seen[start] = 1;
    while (stack.length > 0) {
      const cell = stack.pop();
      size += 1;
      const [x, y] = xyOf(board, cell);
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nx < 0 || nx >= board.w || ny < 0 || ny >= board.h) continue;
        const next = cellOf(board, nx, ny);
        if (seen[next]) continue;
        seen[next] = 1;
        stack.push(next);
      }
    }
    sizes.push(size);
  }
  return sizes;
}

/**
 * 빠른 걸러내기: 따져 보지 않아도 안 되는 것이 분명한 판을 가린다. 걸리면 그 까닭의 열쇠, 아니면 null.
 * 셋 다 "걸리면 반드시 안 되는" 까닭이다(걸리지 않았다고 되는 것은 아니다).
 *   'count'   빈칸의 수가 조각의 칸 수로 나누어떨어지지 않는다
 *   'color'   무늬의 색마다 빈칸의 수가 다르다. 도미노는 바둑판 무늬의 두 색을 하나씩 덮고,
 *             일자 세 칸은 대각 줄무늬(양쪽 대각 모두)의 세 색을 하나씩 덮는다. ㄱ자에는 이런 무늬가 없다
 *   'island'  빈칸의 덩어리 가운데 칸 수가 조각의 칸 수로 나누어떨어지지 않는 것이 있다(조각은 한 덩어리 안에만 놓인다)
 */
export function quickReject(board) {
  const size = PIECES[board.piece];
  const taken = takenOf(board);
  const free = taken.length - board.holes.length;
  if (free % size !== 0) return 'count';
  const patterns = board.piece === 'domino' ? ['checker'] : board.piece === 'bar' ? ['stripe', 'back'] : [];
  for (const pattern of patterns) {
    const counts = colorCounts(board, pattern);
    if (counts.some((count) => count !== counts[0])) return 'color';
  }
  if (islandSizes(board, taken).some((count) => count % size !== 0)) return 'island';
  return null;
}

/**
 * 풀이 프로그램. 덮는 방법 하나를 찾거나, 없다는 것을 가린다.
 * 되짚기 탐색: 맨 처음 빈칸(번호가 가장 작은 빈칸)을 덮는 방법을 하나씩 따진다. 그 칸은 어느 풀이에서나 덮여야 하므로 빠뜨리는 것이 없다.
 * 같은 모습을 두 번 따지지 않는다. 맨 처음 빈칸의 앞은 모두 찼고, 조각은 두 줄 아래까지만 닿으므로
 * (맨 처음 빈칸, 그 뒤 두 줄의 모습)이 같으면 남은 판이 같다.
 *
 * @param {object} board
 * @param {{limit?: number, filters?: boolean}} options
 *   limit    따져 보는 걸음 수의 위 끝
 *   filters  false면 빠른 걸러내기를 쓰지 않고 끝까지 따진다(테스트에서 걸러내기가 맞는지 견줄 때 쓴다)
 * @returns {{possible: boolean|null, tiling: number[][]|null, reason: string, steps: number}}
 *   possible  true면 덮는 방법이 있다(tiling에 실제로 들어 있다). false면 없다. null이면 끝까지 따져 보지 못했다
 *   tiling    덮는 방법 하나(조각들)
 *   reason    'tiled'(덮었다) | 'count' | 'color' | 'island'(빠른 걸러내기) | 'search'(모든 경우를 따졌다) | 'limit'(걸음 수를 넘었다)
 *   steps     따져 본 걸음 수
 */
export function solve(board, { limit = SOLVE_LIMIT, filters = true } = {}) {
  if (filters) {
    const reject = quickReject(board);
    if (reject) return { possible: false, tiling: null, reason: reject, steps: 0 };
  }
  const taken = takenOf(board);
  const total = taken.length;
  const reach = 2 * board.w;
  const failed = new Set();
  const tiling = [];
  let steps = 0;
  let over = false;

  const search = (from) => {
    let first = from;
    while (first < total && taken[first]) first += 1;
    if (first === total) return true;
    steps += 1;
    if (steps > limit) {
      over = true;
      return false;
    }
    let key = first;
    for (let offset = 1; offset <= reach; offset++) {
      const cell = first + offset;
      key = key * 2 + (cell >= total || taken[cell] ? 1 : 0);
    }
    if (failed.has(key)) return false;
    for (const cells of shapesFrom(board, first)) {
      if (cells.some((cell) => taken[cell])) continue;
      for (const cell of cells) taken[cell] = 1;
      tiling.push(cells);
      if (search(first + 1)) return true;
      tiling.pop();
      for (const cell of cells) taken[cell] = 0;
      if (over) return false;
    }
    failed.add(key);
    return false;
  };

  if (search(0)) return { possible: true, tiling: tiling.map(sorted), reason: 'tiled', steps };
  if (over) return { possible: null, tiling: null, reason: 'limit', steps };
  return { possible: false, tiling: null, reason: 'search', steps };
}

/**
 * 아무렇게나 놓았을 때(놓을 수 있는 자리 가운데 하나를 고르게 뽑아 놓기를 되풀이할 때) 끝까지 덮이는 비율.
 * 판이 얼마나 뻔한지를 재는 값이다(좋은 판 가리기에 쓴다). 큰 판은 모든 갈림을 따질 수 없어서 시드 난수로 여러 번 해 보고 센다.
 * 같은 판, 같은 시드는 늘 같은 값을 낸다.
 * @param {object} board
 * @param {{trials?: number, seed?: number}} options trials: 해 보는 횟수
 * @returns {number} 0 이상 1 이하
 */
export function randomFillRate(board, { trials = 200, seed = 1 } = {}) {
  const rng = createRng(seed);
  const all = placementsOf(board);
  const size = PIECES[board.piece];
  const free = board.w * board.h - board.holes.length;
  if (free % size !== 0) return 0;
  let done = 0;
  const taken = new Uint8Array(board.w * board.h);
  for (let trial = 0; trial < trials; trial++) {
    taken.fill(0);
    let open = all;
    let left = free;
    while (open.length > 0) {
      const pick = open[Math.floor(rng() * open.length)];
      for (const cell of pick) taken[cell] = 1;
      left -= size;
      open = open.filter((cells) => cells.every((cell) => !taken[cell]));
    }
    if (left === 0) done += 1;
  }
  return done / trials;
}

/**
 * "불가능해요"라고 답했을 때의 판정과 짐작.
 * @param {{possible: boolean|null}} solution 풀이 프로그램의 결과
 * @param {{places?: number}} tried 해 본 것: 조각을 놓은 횟수
 * @returns {{correct: boolean|null, guess: string|null}}
 *   correct  null이면 풀이 프로그램도 끝까지 따져 보지 못한 판이다(맞는지 알려 줄 수 없다)
 *   guess    'impossible-no-try'       조각을 놓아 보지 않고 답했다
 *            'impossible-other-start'  놓아 보기는 했다. 다른 자리부터 놓는 방법이 남아 있다
 *            'unknown'                 풀이 프로그램도 모른다
 */
export function diagnoseImpossible(solution, tried = {}) {
  if (solution.possible === false) return { correct: true, guess: null };
  if (solution.possible === null) return { correct: null, guess: 'unknown' };
  if ((tried.places ?? 0) === 0) return { correct: false, guess: 'impossible-no-try' };
  return { correct: false, guess: 'impossible-other-start' };
}

/**
 * "왜 그럴까?"의 이야기가 이 판에 맞는가. 이야기는 무늬의 색마다 칸을 세는 까닭을 들려준다.
 * 안 되는 판인데 그 까닭이 무늬가 아니면(칸 수가 안 맞거나, 외딴 덩어리가 있거나, 모든 경우를 따져서 알았으면) 맞지 않는 까닭을 들려주게 되므로 열지 않는다.
 * 풀이 프로그램도 끝까지 따져 보지 못한 판에서도 열지 않는다. 되는 판에서는 이야기로 다시 볼 수 있다.
 */
export function whyFits(piece, solution) {
  if (piece === 'ell' || !solution) return false;
  return solution.possible === true || (solution.possible === false && solution.reason === 'color');
}

/**
 * 그 조각의 "왜 그럴까?"를 열어도 되는가. 그 조각으로 덮는 안 되는 판(만들어 낸 판)을 한 번 끝까지 만난 뒤에 열린다.
 * ㄱ자 세 칸에는 "왜 그럴까?"가 없다(일부러 까닭을 남겨 둔 판).
 */
export function whyOpen(records, piece) {
  if (piece === 'ell' || !Array.isArray(records)) return false;
  return records.some(
    (record) =>
      record &&
      record.kind === 'round' &&
      record.format === 'tile' &&
      record.custom !== true &&
      record.board?.piece === piece &&
      record.solution?.possible === false &&
      (record.outcome === 'solved' || record.outcome === 'solution'),
  );
}
