// 곱 단서 퍼즐의 답을 다른 방법으로 다시 센다(테스트 전용).
// 풀이 프로그램(src/core/product.js)은 가로줄마다 곱이 되는 두 수(약수 쌍)를 고르고, 이어서 세로줄의 두 수를 같은 방법으로 고른다.
// 여기서는 그것을 쓰지 않는다.
//   - 모두 놓아 보기(eachArrangement, naiveCount): 줄마다 딱 두 칸인 모든 칸 모양에 1부터 2n까지의 모든 차례를 놓아 보고 단서를 계산한다.
//     약수 쌍도, "수 x는 x의 가로줄과 x의 세로줄이 만나는 칸에 있다"는 사실도 쓰지 않는다. 3×3 판(4,320가지)과 4×4 판 몇 개에 쓴다.
//   - 짝 지어 보기(pairingCount): 1부터 2n까지를 두 수씩 짝 지어 가로줄에 늘어놓는 모든 방법과 세로줄에 늘어놓는 모든 방법을 만들어 두고,
//     곱이 보이는 단서와 같은 것만 남긴 뒤, 한 세로줄의 두 수가 같은 가로줄에 있지 않은 짝을 센다. 약수 쌍을 고르지 않고 모든 짝을 곱해 본다.
//     위의 사실을 쓰므로, 이 방법이 모두 놓아 보기와 같은지를 3×3 판 모두와 4×4 판 몇 개에서 따로 확인한다.

/** 곱이 P인 서로 다른 두 수(1부터 top까지)를 모두 곱해 보며 찾는다 */
export function bruteFactorPairs(P, top) {
  const pairs = [];
  for (let a = 1; a <= top; a++) for (let b = a + 1; b <= top; b++) if (a * b === P) pairs.push([a, b]);
  return pairs;
}

/** 줄마다 딱 두 칸인 칸 모양을 모두 찾는다(칸 n×n개 가운데 2n개를 고르는 모든 방법에서 거른다) */
export function bruteShapes(n) {
  const shapes = [];
  const total = n * n;
  const pick = [];
  (function choose(from) {
    if (pick.length === 2 * n) {
      const rows = new Array(n).fill(0);
      const cols = new Array(n).fill(0);
      for (const cell of pick) {
        rows[Math.floor(cell / n)] += 1;
        cols[cell % n] += 1;
      }
      if (rows.every((value) => value === 2) && cols.every((value) => value === 2)) shapes.push(pick.slice());
      return;
    }
    if (total - from < 2 * n - pick.length) return;
    for (let cell = from; cell < total; cell++) {
      pick.push(cell);
      choose(cell + 1);
      pick.pop();
    }
  })(0);
  return shapes;
}

/** 1부터 m까지의 모든 차례 */
function permutations(m) {
  const all = [];
  const items = Array.from({ length: m }, (_, index) => index + 1);
  const used = new Array(m).fill(false);
  const now = [];
  (function walk() {
    if (now.length === m) {
      all.push(now.slice());
      return;
    }
    for (let index = 0; index < m; index++) {
      if (used[index]) continue;
      used[index] = true;
      now.push(items[index]);
      walk();
      now.pop();
      used[index] = false;
    }
  })();
  return all;
}

/** 놓인 모습의 단서(줄마다 놓인 수의 곱) */
export function bruteClues(n, cells) {
  const rows = new Array(n).fill(1);
  const cols = new Array(n).fill(1);
  cells.forEach((value, cell) => {
    if (value === null) return;
    rows[Math.floor(cell / n)] *= value;
    cols[cell % n] *= value;
  });
  return { rows, cols };
}

/**
 * 모든 놓인 모습을 차례로 건넨다(칸 모양 × 수의 차례). 3×3은 4,320가지, 4×4는 3,628,800가지다.
 * @param {number} n
 * @param {(cells: (number|null)[]) => void} visit
 */
export function eachArrangement(n, visit) {
  const orders = permutations(2 * n);
  for (const shape of bruteShapes(n)) {
    for (const order of orders) {
      const cells = new Array(n * n).fill(null);
      shape.forEach((cell, index) => {
        cells[cell] = order[index];
      });
      visit(cells);
    }
  }
}

/** 단서가 보이는 단서와 모두 같은가(숨은 단서는 보지 않는다) */
const fits = (board, clues) => board.rows.every((clue, index) => clue === null || clue === clues.rows[index]) && board.cols.every((clue, index) => clue === null || clue === clues.cols[index]);

/** 모두 놓아 보기로 답을 센다(느리다. 3×3이나 4×4 몇 판에만 쓴다) */
export function naiveCount(board) {
  let count = 0;
  eachArrangement(board.n, (cells) => {
    if (fits(board, bruteClues(board.n, cells))) count += 1;
  });
  return count;
}

/** 1부터 2n까지를 두 수씩 짝 지어 n줄에 늘어놓는 모든 방법(줄마다 두 수, 작은 수가 앞). 크기마다 한 번만 만든다 */
const pairingMemo = new Map();
export function allPairings(n) {
  if (pairingMemo.has(n)) return pairingMemo.get(n);
  const top = 2 * n;
  const all = [];
  const used = new Array(top + 1).fill(false);
  const lines = [];
  (function line(at) {
    if (at === n) {
      all.push(lines.map((pair) => pair.slice()));
      return;
    }
    for (let a = 1; a <= top; a++) {
      if (used[a]) continue;
      for (let b = a + 1; b <= top; b++) {
        if (used[b]) continue;
        used[a] = used[b] = true;
        lines.push([a, b]);
        line(at + 1);
        lines.pop();
        used[a] = used[b] = false;
      }
    }
  })(0);
  pairingMemo.set(n, all);
  return all;
}

/** 짝 지은 것 가운데 곱이 단서와 같은 것만(숨은 단서는 아무 짝이나) */
export function matchingPairings(clues, n) {
  return allPairings(n).filter((lines) => lines.every(([a, b], index) => clues[index] === null || a * b === clues[index]));
}

/**
 * 짝 지어 보기로 답을 센다. 답 하나하나(놓인 모습)도 돌려준다.
 * @returns {{count: number, answers: (number|null)[][]}}
 */
export function pairingCount(board) {
  const { n } = board;
  const rowsList = matchingPairings(board.rows, n);
  const colsList = matchingPairings(board.cols, n);
  const answers = [];
  for (const rows of rowsList) {
    const rowOf = new Array(2 * n + 1);
    rows.forEach(([a, b], index) => {
      rowOf[a] = index;
      rowOf[b] = index;
    });
    for (const cols of colsList) {
      if (cols.some(([a, b]) => rowOf[a] === rowOf[b])) continue;
      const cells = new Array(n * n).fill(null);
      cols.forEach(([a, b], col) => {
        cells[rowOf[a] * n + col] = a;
        cells[rowOf[b] * n + col] = b;
      });
      answers.push(cells);
    }
  }
  return { count: answers.length, answers };
}
