// 가로세로 수열 퍼즐의 사다리(단계)와 판 내기. 순수 함수만 둔다.
// (단계, 판 번호) → 판. 같은 번호는 늘 같은 판이다. 답의 모습을 시드 난수(rng.js)로 만들고, 적힌 수를 하나씩 지워 보면서
// 차례 풀이(stepSolve)가 끝까지 채우는 동안만 지운다. 그래서 사다리의 판은 모두 답이 하나뿐이고(1 이상의 어떤 수로도),
// 한 칸씩 차례로 정해진다. 안 되는 판도, 답이 여럿인 판도 없다.
//
// 고르는 잣대(단계마다)
//   three  3×3. 빈칸 둘이나 셋. 첫 판(과 작은 판)은 빈칸의 수가 가로줄에서도 세로줄에서도 크기로 가운데다
//   ends   3×3. 빈칸 셋에서 다섯. 가로줄과 세로줄 모두에서 가장 작거나 가장 큰 수인 빈칸이 둘 이상이고,
//          그 가운데 하나는 줄의 가운데 칸에 있다(칸의 자리와 크기의 차례가 다르다)
//   black  4×4에 검은 칸 둘이나 셋(가로줄도 세로줄도 겹치지 않게. 그래서 줄마다 칸이 셋이나 넷이다). 한 줄만 보고 정해지는 칸이 있다
//   cross  4×4에 검은 칸이 없거나 하나. 처음에는 한 줄만 보고 정해지는 칸이 없다. 가로줄과 세로줄을 함께 보아 정하는 칸이 셋 이상이다
//   five   5×5에 검은 칸이 셋까지. 가로줄과 세로줄을 함께 보아 정하는 칸이 셋 이상이고, 빈칸이 둘 이상 남은 줄로 정하는 칸이 있다.
//          두 줄 모두 빈칸이 둘 이상 남은 때에 정해지는 칸은 둘까지다(다른 단계에는 없다)
// 수의 크기는 3×3이 20(가장자리 판은 24)까지, 4×4가 30까지, 5×5가 40까지이고, 한 줄의 간격은 3×3 첫 단계가 6까지, 나머지가 8까지다.
import { blanksOf, cellOptions, judgeLine, lineOptions, linesAt, sameBoard, stepSolve } from './seqgrid.js';
import { createRng, randInt, seedFrom } from './rng.js';

/**
 * 사다리.
 *   tag   'basic'(기본) | 'applied'(응용) | 'challenge'(도전). 난이도를 알려 주는 표시일 뿐이다
 *   mode  'three' | 'ends' | 'black' | 'cross' | 'five' | 'make'(직접 만든다)
 *   spec  n(판의 크기), black(검은 칸 수의 아래 끝과 위 끝), top(수의 위 끝), gap(간격의 위 끝), blanks(빈칸 수의 아래 끝과 위 끝)
 */
export const LADDER = [
  { level: 1, tag: 'basic', mode: 'three', spec: { n: 3, black: [0, 0], top: 20, gap: 6, blanks: [2, 3] } },
  { level: 2, tag: 'basic', mode: 'ends', spec: { n: 3, black: [0, 0], top: 24, gap: 8, blanks: [3, 5] } },
  { level: 3, tag: 'applied', mode: 'black', spec: { n: 4, black: [2, 3], top: 30, gap: 8, blanks: [5, 7] } },
  { level: 4, tag: 'applied', mode: 'cross', spec: { n: 4, black: [0, 1], top: 30, gap: 8, blanks: [6, 7] } },
  { level: 5, tag: 'challenge', mode: 'five', spec: { n: 5, black: [0, 3], top: 40, gap: 8, blanks: [10, 11] } },
  { level: 6, tag: 'challenge', mode: 'make' },
];

/** 판을 내는 맨 위 단계(그 위는 직접 만들기) */
export const TOP_LEVEL = 5;
export const MAKE_LEVEL = 6;

/** 판 하나를 만들려고 다시 섞어 보는 횟수의 위 끝. 실제로는 넘지 않는다(테스트로 확인한다) */
const MAX_TRIES = 400;
/** 답의 모습 하나를 찾는 걸음 수의 위 끝 */
const FILL_BUDGET = 4000;

export function rungOf(level) {
  const rung = LADDER.find((item) => item.level === level);
  if (!rung) throw new Error(`없는 단계예요: ${level}`);
  return rung;
}

function shuffle(rng, list) {
  const items = list.slice();
  for (let index = items.length - 1; index > 0; index--) {
    const other = randInt(rng, 0, index);
    [items[index], items[other]] = [items[other], items[index]];
  }
  return items;
}

// ---- 답의 모습 만들기 ----

/** 검은 칸 count개: 가로줄도 세로줄도 겹치지 않게 고른다 */
export function blackSpots(rng, n, count) {
  const rows = shuffle(
    rng,
    Array.from({ length: n }, (_, index) => index),
  ).slice(0, count);
  const cols = shuffle(
    rng,
    Array.from({ length: n }, (_, index) => index),
  ).slice(0, count);
  return rows.map((row, index) => row * n + cols[index]).sort((a, b) => a - b);
}

/**
 * 약속에 맞게 다 채운 모습 하나를 아무렇게나 만든다(1부터 top까지, 다 찬 줄의 간격은 gap 이하). 못 찾으면 null.
 * 들어갈 수가 가장 적은 칸부터 섞은 차례로 넣어 보고, 막히면 되돌아간다.
 */
export function randomSolution(rng, n, black, top, gap) {
  const board = { n, black, givens: new Array(n * n).fill(null) };
  const cells = new Array(n * n).fill(null);
  const open = blanksOf(board);
  let steps = 0;
  const alive = (line) => {
    const values = line.cells.map((cell) => cells[cell]).filter((value) => value !== null);
    if (new Set(values).size !== values.length) return false;
    if (values.length === line.cells.length) {
      const judged = judgeLine(values);
      return judged.ok && (judged.gaps.length === 0 || judged.gaps[0] <= gap);
    }
    return values.length < 2 || lineOptions(values, line.cells.length, top).length > 0;
  };
  function walk() {
    if (++steps > FILL_BUDGET) return false;
    let best = null;
    let list = null;
    for (const cell of open) {
      if (cells[cell] !== null) continue;
      let options = cellOptions(board, cells, cell, top).both;
      if (!options) {
        const { row, col } = linesAt(n, black, cell);
        const used = new Set([...row.cells, ...col.cells].map((other) => cells[other]).filter((value) => value !== null));
        options = [];
        for (let value = 1; value <= top; value++) if (!used.has(value)) options.push(value);
      }
      if (options.length === 0) return false;
      if (!list || options.length < list.length) {
        best = cell;
        list = options;
      }
    }
    if (best === null) return true;
    const { row, col } = linesAt(n, black, best);
    for (const value of shuffle(rng, list)) {
      cells[best] = value;
      if (alive(row) && alive(col) && walk()) return true;
      cells[best] = null;
    }
    return false;
  }
  return walk() ? cells : null;
}

// ---- 판의 모습을 재는 것 ----

/** 다 찬 줄에서 수 하나가 크기로 몇째인가(0부터) */
const rankIn = (values, value) => values.filter((other) => other < value).length;

/**
 * 판과 답에서 재는 것들(잣대와 테스트가 쓴다).
 * @returns {{blanks: number, steps: object[], single: number, joint: number, deep: number, middle: number, edges: number, edgeInCenter: boolean, firstBy: string|null}}
 *   single 한 줄만 보고 정한 칸의 수, joint 두 줄을 함께 보아 정한 칸의 수, deep 빈칸이 둘 이상 남은 줄이 허락하는 수로 정한 칸의 수,
 *   wide 그때 가로줄과 세로줄 모두 빈칸이 둘 이상 남아 있던 칸의 수(둘 다 고를 수가 많다),
 *   middle 두 줄 모두에서 크기로 가운데인 빈칸의 수(3×3), edges 두 줄 모두에서 가장 작거나 가장 큰 빈칸의 수,
 *   edgeInCenter 줄의 가운데 칸에 있는데 그 줄에서 가장 작거나 가장 큰 빈칸이 있는가
 */
export function measure(board, solution, steps) {
  const { n, black } = board;
  const blanks = blanksOf(board);
  let middle = 0;
  let edges = 0;
  let edgeInCenter = false;
  for (const cell of blanks) {
    const { row, col } = linesAt(n, black, cell);
    const places = [row, col].map((line) => {
      const values = line.cells.map((other) => solution[other]);
      const rank = rankIn(values, solution[cell]);
      const edge = rank === 0 || rank === values.length - 1;
      const center = line.cells.length === 3 && line.cells.indexOf(cell) === 1;
      return { edge, mid: line.cells.length === 3 && rank === 1, center };
    });
    if (places.every((place) => place.mid)) middle += 1;
    if (places.every((place) => place.edge)) edges += 1;
    if (places.some((place) => place.edge && place.center)) edgeInCenter = true;
  }
  const single = steps.filter((step) => step.by !== 'both').length;
  const joint = steps.length - single;
  const deep = steps.filter((step) => (step.rowOpen >= 2 && step.row) || (step.colOpen >= 2 && step.col)).length;
  const wide = steps.filter((step) => step.rowOpen >= 2 && step.colOpen >= 2).length;
  return { blanks: blanks.length, steps, single, joint, deep, wide, middle, edges, edgeInCenter, firstBy: steps[0]?.by ?? null };
}

/** 판이 그 단계의 잣대에 맞는가(차례 풀이로 끝까지 채워지는지는 따로 본다) */
export function goodBoard(rung, board, solution, steps, { first = false } = {}) {
  const { blanks } = rung.spec;
  const m = measure(board, solution, steps);
  if (m.blanks < blanks[0] || m.blanks > blanks[1]) return false;
  // 5×5 판이 아니면 칸마다 두 줄 가운데 하나는 빈칸이 그 칸 하나뿐일 때 정해진다(고를 수가 셋 이하인 줄이 늘 있다)
  if (m.wide > wideLimit(rung)) return false;
  switch (rung.mode) {
    case 'three':
      return first ? m.middle === m.blanks : m.middle >= 1;
    case 'ends':
      return m.edges >= 2 && m.edgeInCenter;
    case 'black':
      return m.single >= 1;
    case 'cross':
      return m.firstBy === 'both' && m.joint >= 3;
    case 'five':
      return m.joint >= 3 && m.deep >= 1;
    default:
      return false;
  }
}

/** 두 줄 모두 빈칸이 둘 이상 남은 때에 정해지는 칸의 수의 위 끝(단계마다) */
const wideLimit = (rung) => (rung.mode === 'five' ? 2 : 0);

/**
 * 다 채운 모습에서 적힌 수를 섞은 차례로 지워 본다. 지워도 차례 풀이가 끝까지 채우고, 두 줄 모두 빈칸이 둘 이상인 때에 정해지는 칸이
 * wide개를 넘지 않으면 지운 채로 둔다. 빈칸이 most개가 되면 멈춘다.
 * @returns {object} 판
 */
export function digBoard(rng, n, black, solution, most, wide = Infinity) {
  const givens = solution.slice();
  let open = 0;
  for (const cell of shuffle(rng, blanksOf({ n, black, givens: new Array(n * n).fill(null) }))) {
    if (open >= most) break;
    const keep = givens[cell];
    givens[cell] = null;
    const chain = stepSolve({ n, black, givens });
    if (chain.solved && chain.steps.filter((step) => step.rowOpen >= 2 && step.colOpen >= 2).length <= wide) open += 1;
    else givens[cell] = keep;
  }
  return { n, black: black.slice(), givens };
}

/** 그 단계의 잣대로 판 하나를 만든다. 못 만들면 null */
function makeFrom(rng, rung, { first = false } = {}) {
  const { n, black, top, gap, blanks } = rung.spec;
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const dark = blackSpots(rng, n, randInt(rng, black[0], black[1]));
    const solution = randomSolution(rng, n, dark, top, gap);
    if (!solution) continue;
    const board = digBoard(rng, n, dark, solution, randInt(rng, blanks[0], blanks[1]), wideLimit(rung));
    const chain = stepSolve(board);
    if (!chain.solved) continue;
    if (goodBoard(rung, board, solution, chain.steps, { first })) return board;
  }
  return null;
}

/** 그 단계의 판 번호로 만드는 판 */
const boardMemo = new Map();
function boardAt(rung, seed, { small = false } = {}) {
  const key = `${rung.level}:${seed}:${small}`;
  if (boardMemo.has(key)) return boardMemo.get(key);
  const rng = createRng(seedFrom('seqgrid', rung.level, seed, small ? 'small' : ''));
  // 1단계의 첫 판과 작은 판(수준 맞추기)은 빈칸의 수가 두 줄 모두에서 크기로 가운데인 판이다
  const board = makeFrom(rng, rung, { first: (seed === 1 && rung.level === 1) || small });
  if (!board) throw new Error(`판을 만들지 못했어요: ${rung.level}단계 ${seed}번`);
  if (boardMemo.size > 400) boardMemo.clear();
  boardMemo.set(key, board);
  return board;
}

/**
 * 판 하나를 낸다.
 * @param {number} level 1~5
 * @param {number} seed 판 번호(1부터)
 * @param {{small?: boolean}} options small: 맨 아래 단계에서 작은 판(빈칸의 수가 크기로 가운데인 판)을 낸다(수준 맞추기에서 쓴다)
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
 * 더 작은 판들: 같은 걸음이 나오는 더 작은 판(둘까지). 같은 판에는 늘 같은 판들이 나온다.
 *   5×5 → 4×4(두 줄을 함께 보는 판), 4×4 → 3×3(가장자리 판), 빈칸이 셋 이상인 3×3 → 빈칸이 둘인 3×3(같은 잣대). 빈칸이 둘 이하인 3×3에는 없다.
 * @param {object} origin { mode, board }
 * @returns {{yes: object[], no: object[]}}
 */
export function smallBoards(origin) {
  const { board } = origin;
  const blanks = blanksOf(board).length;
  let rung;
  if (board.n >= 5) rung = { ...rungOf(4), spec: { ...rungOf(4).spec, blanks: [6, 8] } };
  else if (board.n === 4) rung = { ...rungOf(2), spec: { ...rungOf(2).spec, blanks: [3, 4] } };
  else if (blanks >= 3) {
    const base = origin.mode === 'ends' ? rungOf(2) : rungOf(1);
    rung = { ...base, mode: base.mode === 'ends' ? 'ends-two' : 'three', spec: { ...base.spec, blanks: [2, 2] } };
  } else return { yes: [], no: [] };
  const rng = createRng(seedFrom('seqgrid-small', JSON.stringify(board), origin.mode ?? ''));
  const yes = [];
  for (let attempt = 0; attempt < 40 && yes.length < 2; attempt++) {
    const made = rung.mode === 'ends-two' ? makeEdgeTwo(rng, rung) : makeFrom(rng, rung);
    if (!made || yes.some((item) => sameBoard(item, made))) continue;
    yes.push(made);
  }
  return { yes, no: [] };
}

/** 빈칸이 둘인 3×3 가장자리 판: 두 빈칸 가운데 하나 이상이 두 줄 모두에서 가장 작거나 가장 크다 */
function makeEdgeTwo(rng, rung) {
  const { n, top, gap } = rung.spec;
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const solution = randomSolution(rng, n, [], top, gap);
    if (!solution) continue;
    const board = digBoard(rng, n, [], solution, 2, 0);
    const chain = stepSolve(board);
    if (!chain.solved) continue;
    const m = measure(board, solution, chain.steps);
    if (m.blanks === 2 && m.edges >= 1) return board;
  }
  return null;
}

