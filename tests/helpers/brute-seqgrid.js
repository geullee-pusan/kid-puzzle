// 가로세로 수열 퍼즐을 풀이 프로그램과 다른 방법으로 다시 따진다(테스트에서만 쓴다).
// - 줄 하나가 약속에 맞는지: 가장 작은 수와 간격으로 줄을 다시 만들어 견준다
// - 줄에 들어갈 수 있는 수: 시작하는 수와 간격을 1부터 max까지 모두 늘어놓는다
// - 답 세기: 빈칸마다 1부터 max까지 모두 넣어 보기(작은 판), 또는 줄마다 늘어놓은 수의 줄로 고를 수를 줄이며 넣어 보기(큰 판)

/** 수들이 약속에 맞는가: 크기순으로 놓으면 가장 작은 수부터 같은 간격(0이 아닌)으로 늘어선다 */
export function bruteLineOk(values) {
  if (values.length <= 1) return true;
  const low = Math.min(...values);
  const sorted = values.slice().sort((a, b) => a - b);
  const step = sorted[1] - sorted[0];
  if (step <= 0) return false;
  const want = values.map((_, index) => low + index * step);
  return want.every((value, index) => value === sorted[index]);
}

/** 판의 줄들(검은 칸을 뺀 칸 번호들). 가로줄 다음 세로줄 */
export function bruteLines(board) {
  const { n } = board;
  const dark = new Set(board.black);
  const lines = [];
  for (let row = 0; row < n; row++) lines.push(Array.from({ length: n }, (_, col) => row * n + col).filter((cell) => !dark.has(cell)));
  for (let col = 0; col < n; col++) lines.push(Array.from({ length: n }, (_, row) => row * n + col).filter((cell) => !dark.has(cell)));
  return lines;
}

/** 다 채운 모습이 약속에 맞는가 */
export function bruteFilledOk(board, cells) {
  return bruteLines(board).every((line) => bruteLineOk(line.map((cell) => cells[cell])));
}

/**
 * 칸이 length개인 줄에 known이 있을 때, 남은 칸에 들어갈 수 있는 수(1부터 max까지의 수의 줄만 본다)
 * 시작하는 수와 간격을 모두 늘어놓는다.
 */
export function bruteOptions(known, length, max) {
  const found = new Set();
  if (new Set(known).size !== known.length || known.length >= length) return [];
  for (let start = 1; start <= max; start++) {
    for (let step = 1; start + (length - 1) * step <= max; step++) {
      const terms = Array.from({ length }, (_, index) => start + index * step);
      if (!known.every((value) => terms.includes(value))) continue;
      for (const value of terms) if (!known.includes(value)) found.add(value);
    }
  }
  return [...found].sort((a, b) => a - b);
}

/** 빈칸의 번호들 */
const blanksOf = (board) => {
  const dark = new Set(board.black);
  return Array.from({ length: board.n * board.n }, (_, cell) => cell).filter((cell) => !dark.has(cell) && board.givens[cell] === null);
};

/** 작은 판: 빈칸마다 1부터 max까지 모두 넣어 본다. 답의 수와 답들(limit개까지) */
export function bruteAll(board, max, limit = Infinity) {
  const blanks = blanksOf(board);
  const cells = board.givens.slice();
  const answers = [];
  let count = 0;
  (function put(at) {
    if (count >= limit) return;
    if (at === blanks.length) {
      if (bruteFilledOk(board, cells)) {
        count += 1;
        if (answers.length < 3) answers.push(cells.slice());
      }
      return;
    }
    for (let value = 1; value <= max; value++) {
      cells[blanks[at]] = value;
      put(at + 1);
    }
    cells[blanks[at]] = null;
  })(0);
  return { count, answers };
}

/**
 * 큰 판: 빈칸마다 지금 그 칸의 가로줄과 세로줄이 허락하는 수(bruteOptions, 수가 하나 이하인 줄은 1부터 max까지에서 그 수를 뺀 것)를 구해
 * 가장 적은 칸부터 넣어 본다. 다 채우면 줄마다 다시 본다. 답의 수(limit개까지)와 답들
 */
export function bruteSearch(board, max, limit = 2) {
  const lines = bruteLines(board);
  const lineOf = new Map();
  for (const line of lines) for (const cell of line) lineOf.set(cell, [...(lineOf.get(cell) ?? []), line]);
  const blanks = blanksOf(board);
  const cells = board.givens.slice();
  const answers = [];
  let count = 0;
  const optionsAt = (cell) => {
    let list = null;
    for (const line of lineOf.get(cell)) {
      const known = line.filter((other) => other !== cell && cells[other] !== null).map((other) => cells[other]);
      let here;
      if (known.length >= 2) here = bruteOptions(known, line.length, max);
      else here = Array.from({ length: max }, (_, index) => index + 1).filter((value) => !known.includes(value));
      list = list === null ? here : list.filter((value) => here.includes(value));
    }
    return list;
  };
  (function walk() {
    if (count >= limit) return;
    let best = null;
    let bestList = null;
    for (const cell of blanks) {
      if (cells[cell] !== null) continue;
      const list = optionsAt(cell);
      if (list.length === 0) return;
      if (!bestList || list.length < bestList.length) {
        best = cell;
        bestList = list;
      }
    }
    if (best === null) {
      if (bruteFilledOk(board, cells)) {
        count += 1;
        if (answers.length < 3) answers.push(cells.slice());
      }
      return;
    }
    for (const value of bestList) {
      cells[best] = value;
      walk();
      if (count >= limit) break;
    }
    cells[best] = null;
  })();
  return { count, answers };
}
