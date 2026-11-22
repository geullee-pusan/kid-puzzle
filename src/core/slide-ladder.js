// 번호 말 제자리 찾기의 사다리(단계)와 판 내기, 더 작은 판. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 말의 차례는 시드 난수(rng.js)로 고른다.
//
// 맞바꾸기 판(1, 2단계)은 말의 차례를 섞어 만들고, 가장 적게 맞바꾸는 횟수가 단계의 범위에 드는 판만 낸다.
// 밀기의 되는 판은 제자리에서 말을 아무렇게나 밀어 만들고(그래서 늘 된다), 가장 적은 횟수(풀이 프로그램의 표)가 단계의 범위에 드는 판만 낸다.
// 밀기의 안 되는 판은 되는 판에서 말 둘의 자리를 맞바꿔 만든다. 한 줄로 읽었을 때 큰 수가 앞에 선 짝의 수가 홀수가 되어, 아이가 "한 줄로 읽기"로 그 수를 볼 수 있다.
// 안 되는 판이 섞이는 단계(3, 4단계)에서는 여섯 판에 둘(판 번호를 6으로 나눈 나머지가 2와 5)이고, 연달아 나오지 않는다.
// 처음 만나는 판은 되는 판이고, 처음 만나는 안 되는 판(3단계 2번)은 가장 쉬운 안 되는 판이다(제자리에서 1과 2만 바뀐 2×3 판).
import { createRng, randInt, seedFrom } from './rng.js';
import { MIN_PIECES, applySlide, applySwap, boardKey, copyBoard, cyclesOf, emptyAt, goalCells, isDone, neighborsOf, sameBoard, solve } from './slide.js';

/**
 * 사다리.
 *   tag     'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode    'swap'(맞바꾸기) | 'fewest'(가장 적게 맞바꾸기, 기록 깨기) | 'small'(밀기 2×3, 안 되는 판이 섞인다)
 *           | 'big'(밀기 3×3, 안 되는 판이 섞인다) | 'least'(가장 적게 밀기 3×3, 기록 깨기) | 'make'(직접 만든다)
 *   kind    'swap' | 'slide'
 *   sizes   맞바꾸기는 말의 수, 밀기는 세로 칸 수(가로는 늘 3칸)
 *   fewest  되는 판의 가장 적은 횟수의 범위
 *   impossible 안 되는 판이 섞이는가
 */
export const LADDER = [
  { level: 1, tag: 'basic', mode: 'swap', kind: 'swap', sizes: [4, 5, 6], fewest: [2, 5], impossible: false },
  { level: 2, tag: 'basic', mode: 'fewest', kind: 'swap', sizes: [5, 6, 7], fewest: [3, 5], impossible: false },
  { level: 3, tag: 'applied', mode: 'small', kind: 'slide', sizes: [2], fewest: [3, 8], impossible: true },
  { level: 4, tag: 'applied', mode: 'big', kind: 'slide', sizes: [3], fewest: [4, 12], impossible: true },
  { level: 5, tag: 'challenge', mode: 'least', kind: 'slide', sizes: [3], fewest: [6, 12], impossible: false },
  { level: 6, tag: 'challenge', mode: 'make' },
];

/** 판을 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;

/** 가장 적게 해야 끝나는 판(기록 깨기)의 종류 */
export const recordMode = (mode, kind) => mode === 'fewest' || mode === 'least' || (mode === 'made' && kind === 'swap');

/** 판 하나를 만들려고 다시 골라 보는 횟수의 위 끝. 실제로는 넘지 않는다(테스트로 확인한다) */
const MAX_TRIES = 2000;

/** 정해 둔 판들 */
const FIRST = {
  // 1단계 1번: 실패할 수 없는 판(가운데 두 말만 바뀌었다. 한 번 맞바꾸면 끝난다)
  swap: { kind: 'swap', w: 4, h: 1, cells: [1, 3, 2, 4] },
  // 2단계 1번: 다섯 말, 가장 적게 세 번(1과 2가 서로의 자리에, 3·4·5가 한 바퀴)
  fewest: { kind: 'swap', w: 5, h: 1, cells: [2, 1, 5, 3, 4] },
  // 3단계 1번: 2×3 판, 두 번 밀면 된다
  small: { kind: 'slide', w: 3, h: 2, cells: [1, 2, 3, 0, 4, 5] },
  // 3단계 2번: 처음 만나는 안 되는 판. 제자리에서 1과 2만 바뀌었다
  'small-no': { kind: 'slide', w: 3, h: 2, cells: [2, 1, 3, 4, 5, 0] },
  // 4단계 2번: 3×3 판에서 처음 만나는 안 되는 판. 제자리에서 7과 8만 바뀌었다
  'big-no': { kind: 'slide', w: 3, h: 3, cells: [1, 2, 3, 4, 5, 6, 8, 7, 0] },
};

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

/** 그 판 번호가 안 되는 판의 자리인가(안 되는 판이 섞이는 단계에서 여섯 판에 둘) */
export const impossibleAt = (rung, seed) => rung.impossible === true && [1, 4].includes((seed - 1) % 6);

/** 한 번 푼 판은 적어 둔다 */
const solved = new Map();
export function solveOnce(board) {
  const key = boardKey(board);
  if (!solved.has(key)) solved.set(key, solve(board));
  return solved.get(key);
}

// ---- 판 만들기 ----

function shuffled(rng, list) {
  const items = list.slice();
  for (let index = items.length - 1; index > 0; index--) {
    const other = randInt(rng, 0, index);
    [items[index], items[other]] = [items[other], items[index]];
  }
  return items;
}

/** 가장 적게 맞바꾸는 횟수가 [low, high]인 n개의 맞바꾸기 판 */
export function swapBoard(rng, n, [low, high]) {
  const goal = goalCells('swap', n, 1);
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const cells = shuffled(rng, goal);
    const fewest = n - cyclesOf(cells).length;
    if (fewest >= low && fewest <= high) return { kind: 'swap', w: n, h: 1, cells };
  }
  throw new Error(`맞바꾸기 판을 만들지 못했어요: ${n}개`);
}

/** 가장 적게 미는 횟수가 [low, high]인 되는 밀기 판(가로 3칸, 세로 h칸). 제자리에서 아무렇게나 밀어 만든다 */
export function slideBoard(rng, h, [low, high]) {
  const w = 3;
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    let cells = goalCells('slide', w, h);
    let before = -1;
    const steps = randInt(rng, high, high + 10);
    for (let step = 0; step < steps; step++) {
      const hole = emptyAt(cells);
      const options = neighborsOf(w, h, hole).filter((at) => at !== before);
      const at = options[randInt(rng, 0, options.length - 1)];
      cells = applySlide(cells, at);
      before = hole;
    }
    const board = { kind: 'slide', w, h, cells };
    const { fewest } = solveOnce(board);
    if (fewest >= low && fewest <= high) return board;
  }
  throw new Error(`밀기 판을 만들지 못했어요: 3×${h}`);
}

/** 안 되는 밀기 판: 되는 판에서 말 둘(빈칸이 아닌)의 자리를 맞바꾼다 */
export function noBoard(rng, h, range) {
  const base = slideBoard(rng, h, range);
  const pieces = base.cells.map((value, at) => (value === 0 ? -1 : at)).filter((at) => at >= 0);
  const a = pieces[randInt(rng, 0, pieces.length - 1)];
  const rest = pieces.filter((at) => at !== a);
  const b = rest[randInt(rng, 0, rest.length - 1)];
  return { ...base, cells: applySwap(base.cells, a, b) };
}

/** 그 단계의 판 번호로 만드는 판 */
function boardAt(rung, seed) {
  if (seed === 1 && FIRST[rung.mode]) return copyBoard(FIRST[rung.mode]);
  if (seed === 2 && FIRST[`${rung.mode}-no`]) return copyBoard(FIRST[`${rung.mode}-no`]);
  const rng = createRng(seedFrom('slide', rung.level, seed));
  const size = rung.sizes[randInt(rng, 0, rung.sizes.length - 1)];
  if (rung.kind === 'swap') return swapBoard(rng, size, [rung.fewest[0], Math.min(rung.fewest[1], size - 1)]);
  // 4단계 1번과 5단계 1번은 범위의 아래쪽(가장 적게 6번 안쪽)으로 연다
  const range = seed === 1 ? [rung.fewest[0], rung.fewest[0] + 2] : rung.fewest;
  if (impossibleAt(rung, seed)) return noBoard(rng, size, [2, rung.fewest[1]]);
  return slideBoard(rng, size, range);
}

/**
 * 판 하나를 낸다.
 * @param {number} level 1~5
 * @param {number} seed 판 번호(1부터)
 * @param {{small?: boolean}} options small: 맨 아래 단계에서 작은 판(실패할 수 없는 1번 판)을 낸다(수준 맞추기에서 쓴다)
 * @returns {{level: number, seed: number, small: boolean, board: object}}
 */
export function generateBoard(level, seed, { small = false } = {}) {
  const rung = rungOf(level);
  if (rung.mode === 'make') throw new Error('직접 만들기 단계는 판을 내지 않아요');
  if (!Number.isInteger(seed) || seed < 1) throw new Error(`판 번호는 1부터예요: ${seed}`);
  const shrink = small && level === LADDER[0].level;
  return { level, seed, small: shrink, board: boardAt(rung, shrink ? 1 : seed) };
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

// ---- 더 작은 판 ----

/** 맞바꾸기 판에서 가장 큰 말 k개를 빼고 남은 말의 차례를 그대로 둔 판 */
export function withoutLargest(board, k) {
  const n = board.w - k;
  const cells = board.cells.filter((value) => value <= n);
  return { kind: 'swap', w: n, h: 1, cells };
}

/** 밀기 판에서, 가장 적게 미는 방법을 따라 몇 번 민 판(제자리에 더 가까운 같은 판) */
export function nearerOf(board, steps) {
  const { path } = solveOnce(board);
  let cells = board.cells.slice();
  for (const at of path.slice(0, steps)) cells = applySlide(cells, at);
  return { ...copyBoard(board), cells };
}

/** 제자리에서 말 둘(한 줄로 읽었을 때 붙은 두 수)만 바뀐 2×3 판들. 가장 쉬운 안 되는 판이다 */
export function simpleNoBoards() {
  const list = [];
  for (let value = 1; value <= 4; value++) {
    const cells = goalCells('slide', 3, 2);
    list.push({ kind: 'slide', w: 3, h: 2, cells: applySwap(cells, value - 1, value) });
  }
  return list;
}

/**
 * 더 작은 판들. 같은 판에는 늘 같은 판들이 나온다.
 *   맞바꾸기: 가장 큰 말을 하나(그다음 둘) 뺀 판. 가장 적게 맞바꾸는 횟수가 2보다 적으면 그 말 수의 판을 시드 난수로 만든다. 말이 셋이면 없다
 *   밀기 3×3: 2×3 판. 되는 판에서 왔으면 되는 판(가장 적게 3~6번), 안 되는 판에서 왔으면 안 되는 판(말 둘만 바뀐 판)도
 *   밀기 2×3: 가장 적게 미는 방법을 따라 몇 번 민 판(제자리에 더 가까운 같은 판), 안 되는 판에서 왔으면 말 둘만 바뀐 판도. 가장 적게 2번 안쪽이면 없다
 * @param {object} origin { mode, board }
 * @returns {{yes: object[], no: object[]}}
 */
export function smallBoards(origin) {
  const { board } = origin;
  const rng = createRng(seedFrom('slide-small', boardKey(board)));
  if (board.kind === 'swap') {
    if (board.w <= MIN_PIECES) return { yes: [], no: [] };
    const yes = [];
    for (const k of [1, 2]) {
      if (board.w - k < MIN_PIECES) continue;
      const small = withoutLargest(board, k);
      if (solveOnce(small).fewest >= 2 && !yes.some((item) => sameBoard(item, small))) yes.push(small);
    }
    if (yes.length === 0) yes.push(swapBoard(rng, board.w - 1, [2, board.w - 2]));
    return { yes, no: [] };
  }
  const origin3 = board.h === 3;
  const from = solveOnce(board);
  const yes = [];
  if (origin3) {
    for (let index = 0; index < 2; index++) yes.push(slideBoard(rng, 2, [3, 6]));
  } else if (from.possible && from.fewest > 2) {
    const half = Math.max(1, Math.floor(from.fewest / 2));
    yes.push(nearerOf(board, half));
    if (from.fewest - (half + 1) >= 2) yes.push(nearerOf(board, half + 1));
  } else if (!from.possible) {
    yes.push(slideBoard(rng, 2, [3, 5]));
  }
  const no = from.possible ? [] : simpleNoBoards().filter((item) => !sameBoard(item, board));
  const unique = (list) => list.filter((item, index) => list.findIndex((other) => sameBoard(other, item)) === index && !isDone(item.cells));
  return { yes: unique(yes), no: from.possible ? [] : shuffled(rng, no).slice(0, 2) };
}
