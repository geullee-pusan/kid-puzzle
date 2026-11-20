// 곱 단서 퍼즐의 판과 풀이 프로그램. 순수 함수만 둔다.
//
// 판(board): { n, rows, cols }
//   n     판의 크기(n×n). 1부터 2n까지의 수를 한 번씩 넣는다. 가로줄과 세로줄마다 딱 두 수가 들어간다
//   rows  위에서부터 가로줄마다 판 밖에 적힌 단서(그 줄 두 수의 곱). 숨긴 단서는 null
//   cols  왼쪽부터 세로줄마다의 단서. 숨긴 단서는 null
// 놓인 모습(cells): 칸마다(위 줄부터, 왼쪽부터) 놓인 수. 빈칸은 null
//
// 풀이 프로그램이 쓰는 사실: 수 x는 x가 든 가로줄과 x가 든 세로줄이 만나는 칸에 있다.
// 그래서 답 하나는 (가로줄마다의 두 수, 세로줄마다의 두 수)의 짝과 같다. 다만 한 칸에 두 수가 들어갈 수는 없으니
// 한 세로줄의 두 수는 서로 다른 가로줄에서 와야 한다. 이것만 지키면 줄마다 딱 두 수가 들어간다.
// 풀이 프로그램은 가로줄의 두 수를 곱이 되는 두 수(약수 쌍) 가운데서 고르고, 다음에 세로줄의 두 수를 같은 방법으로 고른다.
// 답의 수를 위 끝(limit)까지 세고, 걸음 수가 위 끝(budget)을 넘으면 끝까지 따지지 못했다고 알린다.

/** 판의 크기: 3×3(1~6)부터 5×5(1~10)까지 */
export const MIN_SIZE = 3;
export const MAX_SIZE = 5;

/** 판이 맞는 값인가. 맞으면 null, 아니면 까닭 */
export function checkBoard(board) {
  if (!board || typeof board !== 'object') return 'no-board';
  const { n, rows, cols } = board;
  if (!Number.isInteger(n) || n < MIN_SIZE || n > MAX_SIZE) return 'size';
  if (!Array.isArray(rows) || !Array.isArray(cols) || rows.length !== n || cols.length !== n) return 'lines';
  const top = 2 * n * (2 * n - 1);
  for (const clue of [...rows, ...cols]) {
    if (clue === null) continue;
    if (!Number.isInteger(clue) || clue < 2 || clue > top) return 'clue';
  }
  return null;
}

export const copyBoard = (board) => ({ n: board.n, rows: board.rows.slice(), cols: board.cols.slice() });
export const sameBoard = (a, b) => JSON.stringify(copyBoard(a)) === JSON.stringify(copyBoard(b));
/** 넣을 수의 개수(1부터 2n까지) */
export const numbersOf = (n) => 2 * n;
/** 숨긴 단서의 수 */
export const hiddenCount = (board) => [...board.rows, ...board.cols].filter((clue) => clue === null).length;

/**
 * 곱이 P인 서로 다른 두 수(작은 수, 큰 수)의 목록. 두 수는 1부터 2n까지다.
 * @param {number} P
 * @param {number} n 판의 크기
 */
export function pairsOf(P, n) {
  const top = numbersOf(n);
  const pairs = [];
  for (let a = 1; a * a < P; a++) if (P % a === 0 && P / a <= top) pairs.push([a, P / a]);
  return pairs;
}

/** 한 가지로만 갈리는 단서인가 */
export const oneWay = (P, n) => P !== null && pairsOf(P, n).length === 1;
/** 판에서 한 가지로만 갈리는 단서의 수 */
export const oneWayCount = (board) => [...board.rows, ...board.cols].filter((clue) => oneWay(clue, board.n)).length;

/** 줄의 칸 번호들. kind는 'row'(가로줄) | 'col'(세로줄) */
export function lineCells(n, kind, index) {
  return Array.from({ length: n }, (_, step) => (kind === 'row' ? index * n + step : step * n + index));
}

/** 놓인 모습이 이 판에 쓸 수 있는 값인가(칸 수가 맞고, 1부터 2n까지의 수가 겹치지 않는다) */
export function cellsOk(n, cells) {
  if (!Array.isArray(cells) || cells.length !== n * n) return false;
  const seen = new Set();
  for (const value of cells) {
    if (value === null) continue;
    if (!Number.isInteger(value) || value < 1 || value > numbersOf(n) || seen.has(value)) return false;
    seen.add(value);
  }
  return true;
}

export const emptyCells = (n) => new Array(n * n).fill(null);
/** 놓인 수의 개수 */
export const placedCount = (cells) => cells.filter((value) => value !== null).length;

/**
 * 줄마다의 모습: 놓인 수, 곱(수가 딱 둘일 때), 단서, 맞는지.
 * @returns {{kind: string, index: number, numbers: number[], product: number|null, clue: number|null, state: 'open'|'ok'|'off'|'many'}[]}
 *   open 수가 둘보다 적다, ok 수가 둘이고 곱이 단서와 같다(숨긴 단서면 수가 둘이면 ok), off 곱이 단서와 다르다, many 수가 셋 이상
 */
export function lineStates(board, cells) {
  const { n } = board;
  const lines = [];
  for (const kind of ['row', 'col']) {
    for (let index = 0; index < n; index++) {
      const numbers = lineCells(n, kind, index)
        .map((cell) => cells[cell])
        .filter((value) => value !== null);
      const clue = kind === 'row' ? board.rows[index] : board.cols[index];
      const product = numbers.length === 2 ? numbers[0] * numbers[1] : null;
      let state = 'open';
      if (numbers.length > 2) state = 'many';
      else if (numbers.length === 2) state = clue === null || product === clue ? 'ok' : 'off';
      lines.push({ kind, index, numbers, product, clue, state });
    }
  }
  return lines;
}

/** 다 됐는가: 1부터 2n까지 모두 놓였고, 줄마다 딱 두 수이며, 보이는 단서가 모두 맞는다 */
export function isDone(board, cells) {
  if (!cellsOk(board.n, cells) || placedCount(cells) !== numbersOf(board.n)) return false;
  return lineStates(board, cells).every((line) => line.state === 'ok');
}

/**
 * 다 놓은 모습에서 단서를 계산한다(직접 만들기). 줄마다 딱 두 수가 아니거나 다 놓지 않았으면 null
 * @returns {{n: number, rows: number[], cols: number[]} | null}
 */
export function cluesOf(n, cells) {
  if (!cellsOk(n, cells) || placedCount(cells) !== numbersOf(n)) return null;
  const empty = { n, rows: new Array(n).fill(null), cols: new Array(n).fill(null) };
  const lines = lineStates(empty, cells);
  if (lines.some((line) => line.numbers.length !== 2)) return null;
  return {
    n,
    rows: lines.filter((line) => line.kind === 'row').map((line) => line.product),
    cols: lines.filter((line) => line.kind === 'col').map((line) => line.product),
  };
}

/** 가로줄마다의 두 수(rowOf: 수 → 가로줄)와 세로줄마다의 두 수(colOf)로 놓인 모습을 만든다 */
function cellsFrom(n, rowOf, colOf) {
  const cells = emptyCells(n);
  for (let x = 1; x <= numbersOf(n); x++) cells[rowOf[x] * n + colOf[x]] = x;
  return cells;
}

/** 줄의 단서로 고를 수 있는 두 수의 목록(숨긴 단서는 남은 수 아무 둘) */
function choicesOf(clue, n, used) {
  if (clue !== null) return pairsOf(clue, n).filter(([a, b]) => !used[a] && !used[b]);
  const free = [];
  for (let x = 1; x <= numbersOf(n); x++) if (!used[x]) free.push(x);
  const pairs = [];
  for (let i = 0; i < free.length; i++) for (let j = i + 1; j < free.length; j++) pairs.push([free[i], free[j]]);
  return pairs;
}

/** 단서가 보이는 줄부터 따진다(숨긴 줄은 남은 수에서 고르므로 뒤에 둔다) */
const orderOf = (clues) => clues.map((clue, index) => ({ clue, index })).sort((a, b) => (a.clue === null) - (b.clue === null));

/**
 * 답을 센다.
 * @param {object} board
 * @param {{limit?: number, budget?: number}} options limit: 이만큼 찾으면 멈춘다, budget: 걸음 수의 위 끝
 * @returns {{count: number, complete: boolean, example: (number|null)[]|null, examples: (number|null)[][], steps: number}}
 *   count는 찾은 답의 수(limit에서 멈추면 limit), complete는 걸음 수가 위 끝을 넘지 않았는가(limit에서 멈춘 것은 넘지 않은 것이다),
 *   example은 처음 찾은 답, examples는 처음 찾은 답 둘까지
 */
export function countSolutions(board, { limit = 2, budget = 2_000_000 } = {}) {
  const { n } = board;
  const top = numbersOf(n);
  const rowOrder = orderOf(board.rows);
  const colOrder = orderOf(board.cols);
  const rowOf = new Array(top + 1).fill(-1);
  const colOf = new Array(top + 1).fill(-1);
  const usedRow = new Array(top + 1).fill(false);
  const usedCol = new Array(top + 1).fill(false);
  let count = 0;
  let steps = 0;
  const examples = [];
  let over = false;
  const stop = () => count >= limit || over;

  function cols(at) {
    if (stop()) return;
    if (at === n) {
      count += 1;
      if (examples.length < 2) examples.push(cellsFrom(n, rowOf, colOf));
      return;
    }
    const { clue, index } = colOrder[at];
    for (const [a, b] of choicesOf(clue, n, usedCol)) {
      if (++steps > budget) {
        over = true;
        return;
      }
      // 한 칸에 두 수가 들어갈 수 없다: 세로줄의 두 수는 서로 다른 가로줄에서 온다
      if (rowOf[a] === rowOf[b]) continue;
      usedCol[a] = usedCol[b] = true;
      colOf[a] = colOf[b] = index;
      cols(at + 1);
      usedCol[a] = usedCol[b] = false;
      colOf[a] = colOf[b] = -1;
      if (stop()) return;
    }
  }

  function rows(at) {
    if (stop()) return;
    if (at === n) {
      cols(0);
      return;
    }
    const { clue, index } = rowOrder[at];
    for (const [a, b] of choicesOf(clue, n, usedRow)) {
      if (++steps > budget) {
        over = true;
        return;
      }
      usedRow[a] = usedRow[b] = true;
      rowOf[a] = rowOf[b] = index;
      rows(at + 1);
      usedRow[a] = usedRow[b] = false;
      rowOf[a] = rowOf[b] = -1;
      if (stop()) return;
    }
  }

  rows(0);
  return { count, complete: !over, example: examples[0] ?? null, examples, steps };
}

/** 답이 하나뿐인가(끝까지 따져서) */
export function isUnique(board) {
  const result = countSolutions(board, { limit: 2 });
  return result.complete && result.count === 1;
}

/** 판의 풀이: 답의 수(둘까지)와 답 하나 */
export function solve(board, options = {}) {
  const result = countSolutions(board, { limit: 2, ...options });
  return { possible: result.count > 0, count: result.count, complete: result.complete, example: result.example };
}

/**
 * 단서만 보고 한 방향(가로줄 또는 세로줄)의 수를 나누는 가짓수. 다른 방향의 단서와 "한 칸에 한 수"는 보지 않는다.
 * "왜 그럴까?"의 이야기(가로줄만 보아서는 두 가지가 남는 판)에 쓴다. 숨긴 단서는 남은 수 아무 둘이다.
 * @param {(number|null)[]} clues
 * @param {number} n
 */
export function splitCount(clues, n) {
  const used = new Array(numbersOf(n) + 1).fill(false);
  const order = orderOf(clues);
  let count = 0;
  (function pick(at) {
    if (at === n) {
      count += 1;
      return;
    }
    for (const [a, b] of choicesOf(order[at].clue, n, used)) {
      used[a] = used[b] = true;
      pick(at + 1);
      used[a] = used[b] = false;
    }
  })(0);
  return count;
}
