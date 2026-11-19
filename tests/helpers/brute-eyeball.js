// 눈대중을 풀이 프로그램(src/core/eyeball.js)과 다른 방법으로 다시 푼다(테스트 전용).
// - 얼룩의 칸: 칸 단위의 실수로 칸의 한가운데와 원의 가운데 사이의 거리를 재어 반지름과 견준다(0.5 단위라 실수 셈이 정확하다).
// - 덮기: 판 위의 모든 직사각형(꼭 감싸는 것만이 아니다)을 k개까지 모두 골라 보고, 얼룩 칸을 다 덮는 것 가운데 덮은 칸이 가장 적은 것을 찾는다.
//   큰 판에서는 직사각형 둘을 모두 골라 보고 셋째는 남은 얼룩 칸을 꼭 감싸는 직사각형으로 둔다(이 방법이 맞는지는 작은 판에서 셋을 모두 골라 보아 확인한다).
// - 어림: 가린 숫자에 0~9를 모두 넣어 보고 실제 값을 셈한다. 어림한 값은 수마다 가장 가까운 몇십·몇백을 하나씩 견주어 고른다.

/** 얼룩의 칸 */
export function bruteCells(board) {
  const cells = [];
  for (let cell = 0; cell < board.w * board.h; cell++) {
    const cx = (cell % board.w) + 0.5;
    const cy = Math.floor(cell / board.w) + 0.5;
    if (board.circles.some(([x, y, r]) => Math.hypot(cx - x, cy - y) < r / 2)) cells.push(cell);
  }
  return cells;
}

/** 판 위의 모든 직사각형(줄마다의 비트로) */
export function allRects(w, h) {
  const list = [];
  for (let y0 = 0; y0 < h; y0++) {
    for (let y1 = y0; y1 < h; y1++) {
      for (let x0 = 0; x0 < w; x0++) {
        for (let x1 = x0; x1 < w; x1++) {
          const rows = new Array(h).fill(0);
          for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) rows[y] |= 1 << x;
          list.push({ rect: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }, rows });
        }
      }
    }
  }
  return list;
}

const bits = (value) => {
  let count = 0;
  for (let m = value; m; m &= m - 1) count += 1;
  return count;
};

function blobRows(board, cells) {
  const rows = new Array(board.h).fill(0);
  for (const cell of cells) rows[Math.floor(cell / board.w)] |= 1 << cell % board.w;
  return rows;
}

/** 직사각형 k개(1~3)까지로 얼룩 칸을 다 덮을 때 덮은 칸 수의 가장 작은 값. 모든 직사각형의 모든 묶음을 따진다 */
export function bruteCoverAll(board, k, cells = bruteCells(board)) {
  const rects = allRects(board.w, board.h);
  const blob = blobRows(board, cells);
  let best = Infinity;
  const check = (rows) => {
    let size = 0;
    for (let y = 0; y < board.h; y++) {
      if (blob[y] & ~rows[y]) return;
      size += bits(rows[y]);
    }
    if (size < best) best = size;
  };
  const or = (a, b) => a.map((value, y) => value | b[y]);
  for (let i = 0; i < rects.length; i++) {
    check(rects[i].rows);
    if (k < 2) continue;
    for (let j = i + 1; j < rects.length; j++) {
      const two = or(rects[i].rows, rects[j].rows);
      check(two);
      if (k < 3) continue;
      for (let l = j + 1; l < rects.length; l++) check(or(two, rects[l].rows));
    }
  }
  return best - cells.length;
}

/** 큰 판: 직사각형 k − 1개를 모두 골라 보고, 마지막 하나는 남은 얼룩 칸을 꼭 감싸는 직사각형으로 둔다 */
export function bruteCoverLast(board, k, cells = bruteCells(board)) {
  const rects = allRects(board.w, board.h);
  const blob = blobRows(board, cells);
  let best = Infinity;
  const finish = (rows) => {
    // 남은 얼룩 칸을 꼭 감싸는 직사각형을 더한다
    let x0 = Infinity;
    let x1 = -1;
    let y0 = Infinity;
    let y1 = -1;
    for (let y = 0; y < board.h; y++) {
      const rest = blob[y] & ~rows[y];
      if (!rest) continue;
      y0 = Math.min(y0, y);
      y1 = y;
      for (let x = 0; x < board.w; x++) {
        if (rest & (1 << x)) {
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
        }
      }
    }
    let size = 0;
    for (let y = 0; y < board.h; y++) {
      let row = rows[y];
      if (y >= y0 && y <= y1) for (let x = x0; x <= x1; x++) row |= 1 << x;
      size += bits(row);
    }
    if (size < best) best = size;
  };
  const empty = new Array(board.h).fill(0);
  if (k === 1) finish(empty);
  for (let i = 0; i < rects.length; i++) {
    if (k === 2) finish(rects[i].rows);
    if (k < 3) continue;
    for (let j = i; j < rects.length; j++) finish(rects[i].rows.map((value, y) => value | rects[j].rows[y]));
  }
  return best - cells.length;
}

/** 가장 가까운 몇십·몇백(반이면 큰 쪽) */
function nearest(value, unit) {
  const down = value - (value % unit);
  const up = down + unit;
  return value - down < up - value ? down : up;
}

const apply = (op, values) => (op === '+' ? values.reduce((sum, value) => sum + value, 0) : op === '-' ? values[0] - values[1] : values[0] * values[1]);

/**
 * 어림 판을 가린 숫자를 모두 넣어 보고 푼다.
 * @returns {{ est, values: number[], answer: 'bigger'|'smaller'|'unknown'|'same', directions: boolean, consistent: boolean }}
 *   directions: 수마다 어림이 어림한 값을 미는 쪽(빼기의 뒤의 수는 거꾸로)이 모두 같다(움직이지 않은 수는 빼고)
 *   consistent: 가린 숫자에 무엇을 넣어도 수마다 같은 수로 어림된다
 */
export function bruteSide(board) {
  const choices = board.items.map((item) => (item.hide ? Array.from({ length: 10 }, (_, digit) => item.n + digit) : [item.n]));
  const ests = board.items.map((item, index) => nearest(choices[index][0], item.unit));
  let consistent = true;
  board.items.forEach((item, index) => {
    for (const value of choices[index]) if (nearest(value, item.unit) !== ests[index]) consistent = false;
  });
  const est = apply(board.op, ests);
  const values = [];
  const walk = (index, picked) => {
    if (index === choices.length) {
      values.push(apply(board.op, picked));
      return;
    }
    for (const value of choices[index]) walk(index + 1, [...picked, value]);
  };
  walk(0, []);
  let answer;
  if (values.every((value) => est > value)) answer = 'bigger';
  else if (values.every((value) => est < value)) answer = 'smaller';
  else if (values.every((value) => est === value)) answer = 'same';
  else answer = 'unknown';
  // 수마다 미는 쪽: 어림한 수가 될 수 있는 모든 값보다 크면 +1, 모두보다 작으면 −1, 같으면 0. 빼기의 뒤의 수는 거꾸로
  const signs = board.items.map((item, index) => {
    const all = choices[index];
    let sign = 0;
    if (all.every((value) => ests[index] > value)) sign = 1;
    else if (all.every((value) => ests[index] < value)) sign = -1;
    else if (all.some((value) => ests[index] !== value)) sign = NaN;
    return board.op === '-' && index === 1 ? -sign : sign;
  });
  const moved = signs.filter((sign) => sign !== 0);
  const directions = moved.length > 0 && moved.every((sign) => sign === moved[0]) && !Number.isNaN(moved[0]);
  return { est, values, answer, directions, consistent };
}
