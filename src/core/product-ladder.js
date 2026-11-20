// 곱 단서 퍼즐의 사다리(단계)와 판 내기. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 답의 모습을 시드 난수(rng.js)로 만들고 단서를 계산한 뒤,
// 풀이 프로그램이 답이 하나뿐이라고 끝까지 따져 확인한 판만 낸다. 그래서 사다리와 작은 판에는 안 되는 판도, 답이 여럿인 판도 없다.
//
// 고르는 잣대
//   - 한 가지로만 갈리는 단서(곱이 되는 두 수가 한 가지뿐인 단서)의 수. 많을수록 시작할 곳이 많다
//   - 숨은 단서 단계: 가로줄 하나와 세로줄 하나의 단서를 숨긴다. 같은 방향의 줄 두 개의 단서를 숨기면
//     그 두 줄을 통째로 바꿔도 단서가 맞아서 답이 늘 둘 이상이 된다(풀이 프로그램과 테스트로 확인한다). 그래서 방향마다 하나씩만 숨긴다
import { countSolutions, cluesOf, oneWayCount, sameBoard } from './product.js';
import { createRng, randInt, seedFrom } from './rng.js';

/**
 * 사다리.
 *   tag   'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode  'small'(3×3) | 'four'(4×4) | 'few'(한 가지로 갈리는 단서가 적은 4×4) | 'hidden'(숨은 단서) | 'five'(5×5) | 'make'(직접 만든다)
 *   spec  n(판의 크기), hide(숨기는 단서가 있는가)
 *   rule  고르는 잣대: least·most(한 가지로만 갈리는 단서 수의 아래 끝과 위 끝, 보이는 단서만 센다), first(1번 판에만 쓰는 잣대)
 */
export const LADDER = [
  { level: 1, tag: 'basic', mode: 'small', spec: { n: 3, hide: false }, rule: { least: 3, first: { least: 6 } } },
  { level: 2, tag: 'basic', mode: 'four', spec: { n: 4, hide: false }, rule: { least: 6, first: { least: 7 } } },
  { level: 3, tag: 'applied', mode: 'few', spec: { n: 4, hide: false }, rule: { most: 4 } },
  { level: 4, tag: 'applied', mode: 'hidden', spec: { n: 4, hide: true }, rule: { most: 5 } },
  { level: 5, tag: 'challenge', mode: 'five', spec: { n: 5, hide: false }, rule: { most: 6 } },
  { level: 6, tag: 'challenge', mode: 'make' },
];

/** 판을 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;

/** 판 하나를 만들려고 다시 섞어 보는 횟수의 위 끝. 실제로는 넘지 않는다(테스트로 확인한다) */
const MAX_TRIES = 4000;

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

// ---- 답의 모습 만들기 ----

/** 줄마다 딱 두 칸을 고른 모습(가로줄마다 고른 두 세로줄)을 모두 늘어놓는다. 3×3은 6가지, 4×4는 90가지, 5×5는 2,040가지 */
const shapeMemo = new Map();
export function shapesOf(n) {
  if (shapeMemo.has(n)) return shapeMemo.get(n);
  const pairs = [];
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) pairs.push([a, b]);
  const shapes = [];
  const used = new Array(n).fill(0);
  const rows = [];
  (function place(row) {
    if (row === n) {
      shapes.push(rows.map((pair) => pair.slice()));
      return;
    }
    for (const [a, b] of pairs) {
      if (used[a] === 2 || used[b] === 2) continue;
      used[a] += 1;
      used[b] += 1;
      rows.push([a, b]);
      place(row + 1);
      rows.pop();
      used[a] -= 1;
      used[b] -= 1;
    }
  })(0);
  // 마지막 줄까지 놓으면 세로줄마다 딱 둘이 된다(가로줄마다 둘이라 모두 2n칸이고, 어느 세로줄도 둘을 넘지 않았다)
  shapeMemo.set(n, shapes);
  return shapes;
}

function shuffle(rng, list) {
  const items = list.slice();
  for (let index = items.length - 1; index > 0; index--) {
    const other = randInt(rng, 0, index);
    [items[index], items[other]] = [items[other], items[index]];
  }
  return items;
}

/** 답의 모습 하나를 아무렇게나 만든다 */
export function randomCells(rng, n) {
  const shapes = shapesOf(n);
  const shape = shapes[randInt(rng, 0, shapes.length - 1)];
  const numbers = shuffle(
    rng,
    Array.from({ length: 2 * n }, (_, index) => index + 1),
  );
  const cells = new Array(n * n).fill(null);
  let next = 0;
  shape.forEach((pair, row) => {
    for (const col of pair) cells[row * n + col] = numbers[next++];
  });
  return cells;
}

/** 가로줄 하나와 세로줄 하나의 단서를 숨긴 판 */
export function hideOne(rng, board) {
  const rows = board.rows.slice();
  const cols = board.cols.slice();
  rows[randInt(rng, 0, board.n - 1)] = null;
  cols[randInt(rng, 0, board.n - 1)] = null;
  return { n: board.n, rows, cols };
}

/** 답이 하나뿐인가(끝까지 따져서) */
const unique = (board) => {
  const result = countSolutions(board, { limit: 2 });
  return result.complete && result.count === 1;
};

/** 판이 그 단계의 잣대에 맞는가(답이 하나뿐인지는 따로 본다) */
export function goodBoard(rung, board, { first = false } = {}) {
  const rule = first && rung.rule.first ? { ...rung.rule, ...rung.rule.first } : rung.rule;
  const ways = oneWayCount(board);
  if (rule.least !== undefined && ways < rule.least) return false;
  if (rule.most !== undefined && ways > rule.most) return false;
  return true;
}

/** 그 단계의 판 번호로 만드는 판 */
function boardAt(rung, seed, { small = false } = {}) {
  const rng = createRng(seedFrom('product', rung.level, seed, small ? 'small' : ''));
  const { n, hide } = rung.spec;
  // 1단계의 작은 판(수준 맞추기)은 단서가 모두 한 가지로만 갈리는 3×3 판이다
  const first = seed === 1 || small;
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const full = cluesOf(n, randomCells(rng, n));
    const board = hide ? hideOne(rng, full) : full;
    if (!goodBoard(rung, board, { first })) continue;
    if (unique(board)) return board;
  }
  throw new Error(`판을 만들지 못했어요: ${rung.level}단계 ${seed}번`);
}

/**
 * 판 하나를 낸다.
 * @param {number} level 1~5
 * @param {number} seed 판 번호(1부터)
 * @param {{small?: boolean}} options small: 맨 아래 단계에서 작은 판(단서가 모두 한 가지로만 갈리는 판)을 낸다(수준 맞추기에서 쓴다)
 * @returns {{level: number, seed: number, small: boolean, board: object, solution: object}}
 */
export function generateBoard(level, seed, { small = false } = {}) {
  const rung = rungOf(level);
  if (rung.mode === 'make') throw new Error('직접 만들기 단계는 판을 내지 않아요');
  if (!Number.isInteger(seed) || seed < 1) throw new Error(`판 번호는 1부터예요: ${seed}`);
  const shrink = small && level === LADDER[0].level;
  const board = boardAt(rung, seed, { small: shrink });
  return { level, seed, small: shrink, board, solution: { possible: true, count: 1 } };
}

/** 다음 판 번호. 방금 한 판과 같은 판이 나오는 번호는 건너뛴다 */
export function nextSeed(level, seed) {
  const rung = rungOf(level);
  if (rung.mode === 'make') return seed + 1;
  const before = boardAt(rung, seed);
  let next = seed + 1;
  while (sameBoard(boardAt(rung, next), before)) next += 1;
  return next;
}

/**
 * 더 작은 판들: 한 줄이 적은 판(4×4 → 3×3, 5×5 → 4×4). 답이 하나뿐인 판만 둘까지 만든다. 같은 판에는 늘 같은 판들이 나온다.
 * 원래 판에 숨은 단서가 있으면 작은 판도 가로줄 하나와 세로줄 하나의 단서를 숨긴다. 3×3 판에는 더 작은 판이 없다.
 * @param {object} origin { mode, board }
 * @returns {{yes: object[], no: object[]}}
 */
export function smallBoards(origin) {
  const { board } = origin;
  const size = board.n - 1;
  if (size < 3) return { yes: [], no: [] };
  const hide = board.rows.includes(null) || board.cols.includes(null);
  const rng = createRng(seedFrom('product-small', JSON.stringify(board), origin.mode));
  const yes = [];
  for (let attempt = 0; attempt < MAX_TRIES && yes.length < 2; attempt++) {
    const full = cluesOf(size, randomCells(rng, size));
    const small = hide ? hideOne(rng, full) : full;
    if (!unique(small)) continue;
    if (yes.some((item) => sameBoard(item, small))) continue;
    yes.push(small);
  }
  return { yes, no: [] };
}
