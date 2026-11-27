// 가로세로 수열 퍼즐의 규칙과 풀이 프로그램. 순수 함수만 둔다(화면, 시계, 저장소를 모른다).
//
// 판(board): { n, black, givens }
//   n       판의 크기(n×n). 칸 번호는 왼쪽 위가 0이고 오른쪽으로, 그다음 아래 줄로 센다
//   black   검은 칸의 번호들(작은 것부터)
//   givens  칸마다 처음부터 적힌 수. 빈칸과 검은 칸은 null
// 놓인 모습(cells): 칸마다의 수(처음부터 적힌 수도 들어 있다). 빈칸과 검은 칸은 null
//
// 약속
//   - 수는 1 이상의 자연수다(직접 만들기와 숫자판은 1부터 99까지).
//   - 가로줄과 세로줄마다 검은 칸을 빼고 남은 수를 크기순으로 놓으면 이웃한 두 수의 간격이 모두 같다.
//   - 간격은 0이 아니다. 그래서 한 줄에 같은 수가 두 번 들어가지 않는다.
//   - 검은 칸은 줄을 끊지 않는다. 줄에서 빠질 뿐이다(남은 칸이 하나면 그 줄은 아무 수나 된다. 둘이면 서로 다르기만 하면 된다).
// 칸의 자리는 크기의 차례와 상관이 없다. 가운데 칸의 수가 가장 클 수도 있다.
//
// 풀이 프로그램이 쓰는 사실: 한 줄에 수가 둘 이상 놓이면, 그 줄의 남은 칸에 들어갈 수 있는 수는 몇 개뿐이다.
//   줄의 수들의 차를 모두 나누는 간격 d마다, 놓인 수를 모두 품는 길이 L(줄의 칸 수)의 수의 줄을 늘어놓고 빠진 수를 모은다.
//   예: 칸이 셋인 줄에 3과 9가 있으면 남은 칸은 6(가운데) 아니면 15(9보다 큰 쪽)이다. −3은 1보다 작아서 안 된다.
// 차례 풀이(stepSolve): 빈칸마다 가로줄이 허락하는 수와 세로줄이 허락하는 수를 견주어, 하나만 남는 칸을 채우기를 되풀이한다.
//   수가 하나뿐인 줄은 아무것도 정하지 않는다(그 수만 빼고 모두 된다). 위 끝을 두지 않는다(그래서 다 채우면 1 이상의 어떤 수로도 답이 이것 하나뿐이다).
//   채운 차례와 그 칸을 정한 줄(가로줄 하나, 세로줄 하나, 둘을 함께)을 적어 둔다. 사다리는 이것으로 끝까지 채워지는 판만 낸다.
// 정확한 셈(countSolutions): 1부터 max까지의 수로 빈칸을 채우는 방법을 limit까지 센다(직접 만들기와 테스트가 쓴다).

export const MIN_SIZE = 3;
export const MAX_SIZE = 5;
/** 숫자판으로 넣을 수 있는 가장 큰 수(두 자리) */
export const MAX_VALUE = 99;

// ---- 판 ----

/** 판이 쓸 수 있는 값인가. 쓸 수 있으면 null, 아니면 까닭(개발자용 글) */
export function checkBoard(board) {
  if (!board || typeof board !== 'object') return 'board';
  const { n, black, givens } = board;
  if (!Number.isInteger(n) || n < MIN_SIZE || n > MAX_SIZE) return 'size';
  if (!Array.isArray(black) || !Array.isArray(givens) || givens.length !== n * n) return 'cells';
  const seen = new Set();
  for (const cell of black) {
    if (!Number.isInteger(cell) || cell < 0 || cell >= n * n || seen.has(cell)) return 'black';
    seen.add(cell);
  }
  for (let index = 1; index < black.length; index++) if (black[index] < black[index - 1]) return 'black';
  for (let cell = 0; cell < n * n; cell++) {
    const value = givens[cell];
    if (value === null) continue;
    if (seen.has(cell) || !Number.isInteger(value) || value < 1 || value > MAX_VALUE) return 'given';
  }
  return null;
}

export const copyBoard = (board) => ({ n: board.n, black: board.black.slice(), givens: board.givens.slice() });
export const sameBoard = (a, b) => JSON.stringify(copyBoard(a)) === JSON.stringify(copyBoard(b));

/** 빈칸의 번호들 */
export function blanksOf(board) {
  const dark = new Set(board.black);
  const list = [];
  for (let cell = 0; cell < board.n * board.n; cell++) if (!dark.has(cell) && board.givens[cell] === null) list.push(cell);
  return list;
}

/** 처음 놓인 모습: 적힌 수만 있다 */
export const startCells = (board) => board.givens.slice();

/** 줄들: 가로줄(위에서부터) 다음 세로줄(왼쪽부터). cells는 검은 칸을 뺀 칸 번호들 */
const lineMemo = new Map();
export function linesOf(n, black = []) {
  const key = `${n}:${black.join(',')}`;
  if (lineMemo.has(key)) return lineMemo.get(key);
  const dark = new Set(black);
  const lines = [];
  for (const kind of ['row', 'col']) {
    for (let index = 0; index < n; index++) {
      const cells = [];
      for (let step = 0; step < n; step++) {
        const cell = kind === 'row' ? index * n + step : step * n + index;
        if (!dark.has(cell)) cells.push(cell);
      }
      lines.push({ kind, index, cells });
    }
  }
  lineMemo.set(key, lines);
  return lines;
}

/** 칸이 든 가로줄과 세로줄 */
export function linesAt(n, black, cell) {
  const lines = linesOf(n, black);
  return { row: lines[Math.floor(cell / n)], col: lines[n + (cell % n)] };
}

/** 놓인 모습이 이 판에 쓸 수 있는 값인가(적힌 수는 그대로이고, 검은 칸은 비었고, 수는 1부터 99까지) */
export function cellsOk(board, cells) {
  if (!Array.isArray(cells) || cells.length !== board.n * board.n) return false;
  const dark = new Set(board.black);
  for (let cell = 0; cell < cells.length; cell++) {
    const value = cells[cell];
    if (dark.has(cell)) {
      if (value !== null) return false;
      continue;
    }
    if (board.givens[cell] !== null) {
      if (value !== board.givens[cell]) return false;
      continue;
    }
    if (value !== null && (!Number.isInteger(value) || value < 1 || value > MAX_VALUE)) return false;
  }
  return true;
}

/** 채운 빈칸의 수 */
export function filledCount(board, cells) {
  return blanksOf(board).filter((cell) => cells[cell] !== null).length;
}

// ---- 줄 하나 ----

const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));

/**
 * 다 찬 줄 하나를 따진다.
 * @param {number[]} values 줄의 수들(칸 차례)
 * @returns {{ok: boolean, sorted: number[], gaps: number[], twice: number|null}}
 *   sorted 크기순, gaps 이웃한 두 수의 간격, twice 두 번 나오는 수(가장 작은 것. 없으면 null)
 */
export function judgeLine(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  const gaps = sorted.slice(1).map((value, index) => value - sorted[index]);
  const twice = sorted.find((value, index) => index > 0 && sorted[index - 1] === value) ?? null;
  const ok = twice === null && gaps.every((gap) => gap === gaps[0]);
  return { ok, sorted, gaps, twice };
}

/**
 * 줄에 수가 둘 이상 놓였을 때, 남은 칸에 들어갈 수 있는 수(작은 것부터).
 * 놓인 수들을 모두 품고, 칸 수(length)만큼 같은 간격으로 늘어선 1 이상의 수의 줄을 모두 늘어놓고 빠진 수를 모은다.
 * @param {number[]} known 놓인 수들
 * @param {number} length 줄의 칸 수(검은 칸을 뺀 것)
 * @param {number} max 수의 위 끝(없으면 Infinity)
 * @returns {number[]|null} 놓인 수가 둘보다 적으면 null(줄 혼자서는 정하지 못한다). 놓인 수끼리 맞지 않으면 빈 목록
 */
export function lineOptions(known, length, max = Infinity) {
  if (known.length < 2) return null;
  const sorted = known.slice().sort((a, b) => a - b);
  for (let index = 1; index < sorted.length; index++) if (sorted[index] === sorted[index - 1]) return [];
  if (sorted.length >= length) return [];
  const low = sorted[0];
  const high = sorted[sorted.length - 1];
  let g = 0;
  for (const value of sorted) g = gcd(g, value - low);
  const found = new Set();
  for (let d = 1; d <= g; d++) {
    if (g % d !== 0) continue;
    const inside = (high - low) / d + 1;
    const extra = length - inside;
    if (extra < 0) continue;
    for (let below = 0; below <= extra; below++) {
      const start = low - below * d;
      const end = start + (length - 1) * d;
      if (start < 1 || end > max) continue;
      for (let term = 0; term < length; term++) {
        const value = start + term * d;
        if (!sorted.includes(value)) found.add(value);
      }
    }
  }
  return [...found].sort((a, b) => a - b);
}

/**
 * 칸 하나에 들어갈 수 있는 수: 가로줄과 세로줄이 저마다 허락하는 수의 겹침.
 * @returns {{row: number[]|null, col: number[]|null, both: number[]|null}} null은 그 줄(또는 둘 다)이 아무것도 정하지 않는다는 뜻.
 *   수가 하나뿐인 줄은 그 수만 뺀다(both에서)
 */
export function cellOptions(board, cells, cell, max = Infinity) {
  const { row, col } = linesAt(board.n, board.black, cell);
  const knownOf = (line) => line.cells.filter((other) => other !== cell && cells[other] !== null).map((other) => cells[other]);
  const rowKnown = knownOf(row);
  const colKnown = knownOf(col);
  const rowOpts = lineOptions(rowKnown, row.cells.length, max);
  const colOpts = lineOptions(colKnown, col.cells.length, max);
  let both = null;
  if (rowOpts && colOpts) both = rowOpts.filter((value) => colOpts.includes(value));
  else if (rowOpts) both = rowOpts.filter((value) => !colKnown.includes(value));
  else if (colOpts) both = colOpts.filter((value) => !rowKnown.includes(value));
  return { row: rowOpts, col: colOpts, both };
}

// ---- 다 됐는지, 줄마다의 모습 ----

/**
 * 줄마다의 모습.
 * @returns {{kind: string, index: number, cells: number[], values: (number|null)[], full: boolean, judged: object|null}[]}
 *   judged는 다 찬 줄만(judgeLine의 값)
 */
export function lineStates(board, cells) {
  return linesOf(board.n, board.black).map((line) => {
    const values = line.cells.map((cell) => cells[cell]);
    const full = values.every((value) => value !== null);
    return { kind: line.kind, index: line.index, cells: line.cells, values, full, judged: full ? judgeLine(values) : null };
  });
}

/** 다 찼는가(빈칸이 모두 찼다) */
export const isFull = (board, cells) => blanksOf(board).every((cell) => cells[cell] !== null);

/** 다 됐는가: 빈칸이 모두 찼고 줄마다 약속에 맞는다 */
export function isDone(board, cells) {
  if (!cellsOk(board, cells) || !isFull(board, cells)) return false;
  return lineStates(board, cells).every((line) => line.judged.ok);
}

// ---- 차례 풀이 ----

/**
 * 한 칸씩 정해지는 차례로 푼다. 한 줄만 보고 정해지는 칸을 먼저 채우고, 없으면 가로줄과 세로줄을 함께 보아 정해지는 칸을 채운다.
 * @returns {{solved: boolean, dead: boolean, cells: (number|null)[], steps: {cell: number, value: number, by: 'row'|'col'|'both', row: number[]|null, col: number[]|null, rowOpen: number, colOpen: number}[]}}
 *   solved 끝까지 채웠고 줄마다 약속에 맞는다, dead 들어갈 수가 없는 칸이 생겼다(답이 없다)
 */
export function stepSolve(board) {
  const cells = startCells(board);
  const steps = [];
  const blanks = blanksOf(board);
  for (;;) {
    const open = blanks.filter((cell) => cells[cell] === null);
    if (open.length === 0) break;
    let single = null;
    let joint = null;
    for (const cell of open) {
      const opts = cellOptions(board, cells, cell);
      if (opts.both && opts.both.length === 0) return { solved: false, dead: true, cells, steps };
      if (!opts.both || opts.both.length !== 1) continue;
      const by = opts.row?.length === 1 ? 'row' : opts.col?.length === 1 ? 'col' : 'both';
      // 그때 그 칸의 가로줄과 세로줄에 남은 빈칸의 수(그 칸도 센다)
      const { row, col } = linesAt(board.n, board.black, cell);
      const rowOpen = row.cells.filter((other) => cells[other] === null).length;
      const colOpen = col.cells.filter((other) => cells[other] === null).length;
      const step = { cell, value: opts.both[0], by, row: opts.row, col: opts.col, rowOpen, colOpen };
      if (by !== 'both') {
        single = step;
        break;
      }
      if (!joint) joint = step;
    }
    const step = single ?? joint;
    if (!step) return { solved: false, dead: false, cells, steps };
    cells[step.cell] = step.value;
    steps.push(step);
  }
  const solved = lineStates(board, cells).every((line) => line.judged.ok);
  return { solved, dead: !solved, cells, steps };
}

// ---- 정확한 셈 ----

/**
 * 1부터 max까지의 수로 빈칸을 채우는 방법을 센다(limit에 닿으면 멈춘다).
 * 들어갈 수가 가장 적은 빈칸부터 하나씩 넣어 보고, 다 찬 줄은 약속에 맞는지 바로 본다.
 * @param {object} board
 * @param {{limit?: number, max?: number, budget?: number}} options
 * @returns {{count: number, complete: boolean, examples: (number|null)[][], steps: number}}
 *   complete는 걸음 수가 위 끝(budget)을 넘지 않았는가(limit에서 멈춘 것은 넘지 않은 것이다)
 */
export function countSolutions(board, { limit = 2, max = MAX_VALUE, budget = 2_000_000 } = {}) {
  const { n, black } = board;
  const cells = startCells(board);
  const lines = linesOf(n, black);
  const blanks = blanksOf(board);
  const examples = [];
  let count = 0;
  let steps = 0;
  let over = false;

  // 처음부터 적힌 수끼리 맞지 않으면 답이 없다
  const lineAlive = (line) => {
    const values = line.cells.map((cell) => cells[cell]).filter((value) => value !== null);
    if (values.length === line.cells.length) return judgeLine(values).ok;
    if (new Set(values).size !== values.length) return false;
    if (values.length >= 2) return lineOptions(values, line.cells.length, max).length > 0;
    return true;
  };
  if (!lines.every(lineAlive)) return { count: 0, complete: true, examples, steps };

  function optionsAt(cell) {
    const opts = cellOptions(board, cells, cell, max);
    if (opts.both) return opts.both;
    // 두 줄 모두 수가 하나 이하: 그 수들만 빼고 1부터 max까지
    const { row, col } = linesAt(n, black, cell);
    const used = new Set([...row.cells, ...col.cells].map((other) => cells[other]).filter((value) => value !== null));
    const list = [];
    for (let value = 1; value <= max; value++) if (!used.has(value)) list.push(value);
    return list;
  }

  function walk() {
    if (count >= limit || over) return;
    let best = null;
    let bestList = null;
    for (const cell of blanks) {
      if (cells[cell] !== null) continue;
      const list = optionsAt(cell);
      if (list.length === 0) return;
      if (!bestList || list.length < bestList.length) {
        best = cell;
        bestList = list;
        if (list.length === 1) break;
      }
    }
    if (best === null) {
      if (lines.every((line) => judgeLine(line.cells.map((cell) => cells[cell])).ok)) {
        count += 1;
        if (examples.length < 2) examples.push(cells.slice());
      }
      return;
    }
    const { row, col } = linesAt(n, black, best);
    for (const value of bestList) {
      if (++steps > budget) {
        over = true;
        return;
      }
      cells[best] = value;
      if (lineAlive(row) && lineAlive(col)) walk();
      cells[best] = null;
      if (count >= limit || over) return;
    }
  }

  walk();
  return { count, complete: !over, examples, steps };
}

/** 판의 풀이: 답이 있는지, 몇 가지인지(둘까지), 답 하나, 차례 풀이의 차례 */
export function solve(board) {
  const chain = stepSolve(board);
  // 차례 풀이로 다 채웠어도 99보다 큰 수가 들어가면 숫자판으로 넣을 수 없다. 그때는 1부터 99까지로 다시 센다
  if (chain.solved && chain.cells.every((value) => value === null || value <= MAX_VALUE)) return { possible: true, count: 1, complete: true, example: chain.cells, steps: chain.steps };
  const result = countSolutions(board, { limit: 2 });
  return { possible: result.count > 0, count: result.count, complete: result.complete, example: result.examples[0] ?? null, steps: [] };
}
