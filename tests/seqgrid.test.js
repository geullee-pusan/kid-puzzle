// 가로세로 수열 퍼즐의 규칙과 풀이 프로그램을 다른 방법(tests/helpers/brute-seqgrid.js)으로 다시 따져 본다.
// 줄 하나의 판정, 줄에 들어갈 수 있는 수, 정확한 셈(작은 판을 모두 넣어 보기), 차례 풀이가 "답이 하나뿐"이라고 한 판.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { blanksOf, cellOptions, cellsOk, checkBoard, countSolutions, isDone, isFull, judgeLine, lineOptions, linesOf, solve, stepSolve } from '../src/core/seqgrid.js';
import { createRng, randInt } from '../src/core/rng.js';
import { randomSolution } from '../src/core/seqgrid-ladder.js';
import { bruteAll, bruteLineOk, bruteOptions, bruteSearch } from './helpers/brute-seqgrid.js';

test('줄 하나: 크기순으로 놓아 간격이 모두 같고 0이 아니면 맞는다. 자리의 차례는 상관없다', () => {
  assert.deepEqual(judgeLine([9, 3, 6]), { ok: true, sorted: [3, 6, 9], gaps: [3, 3], twice: null });
  assert.deepEqual(judgeLine([10, 7, 17]), { ok: false, sorted: [7, 10, 17], gaps: [3, 7], twice: null });
  assert.deepEqual(judgeLine([5, 2, 5]), { ok: false, sorted: [2, 5, 5], gaps: [3, 0], twice: 5 });
  assert.equal(judgeLine([4, 4]).ok, false);
  assert.equal(judgeLine([4, 9]).ok, true);
  assert.equal(judgeLine([7]).ok, true);
  // 다른 방법과 같다(1부터 9까지의 수 셋, 넷을 모두)
  for (let a = 1; a <= 9; a++) {
    for (let b = 1; b <= 9; b++) {
      for (let c = 1; c <= 9; c++) {
        assert.equal(judgeLine([a, b, c]).ok, bruteLineOk([a, b, c]), `${a},${b},${c}`);
        for (const d of [1, 5, 9]) assert.equal(judgeLine([a, b, c, d]).ok, bruteLineOk([a, b, c, d]));
      }
    }
  }
});

test('줄에 들어갈 수 있는 수: 수가 둘 이상이면 몇 개뿐이다. 1부터 50까지로 모두 늘어놓은 것과 같다', () => {
  // 칸이 셋인 줄의 두 수: 작은 쪽, 가운데, 큰 쪽(1보다 작거나 자연수가 아니면 없다)
  assert.deepEqual(lineOptions([3, 9], 3), [6, 15]);
  assert.deepEqual(lineOptions([13, 14], 3), [12, 15]);
  assert.deepEqual(lineOptions([2, 7], 3), [12]);
  assert.deepEqual(lineOptions([3, 9], 4), [5, 6, 7, 12, 15, 21]);
  assert.deepEqual(lineOptions([2, 5, 11], 4), [8]);
  assert.deepEqual(lineOptions([4, 4], 3), []);
  assert.deepEqual(lineOptions([1, 2, 4], 3), []);
  assert.equal(lineOptions([5], 3), null);
  assert.equal(lineOptions([], 4), null);
  const rng = createRng(17);
  for (let trial = 0; trial < 300; trial++) {
    const length = randInt(rng, 3, 5);
    const size = randInt(rng, 2, length - 1);
    const known = [];
    while (known.length < size) {
      const value = randInt(rng, 1, 20);
      if (trial % 3 === 0 || !known.includes(value)) known.push(value);
    }
    assert.deepEqual(lineOptions(known, length, 50), bruteOptions(known, length, 50), `${known} / ${length}`);
    // 위 끝이 없을 때의 수는 가장 큰 수 + (칸 수) × (가장 큰 차)를 넘지 않는다. 그만큼 넉넉한 위 끝과 같다
    assert.deepEqual(lineOptions(known, length), lineOptions(known, length, 20 + length * 20));
  }
});

/** 아무렇게나 만든 작은 판(3×3, 검은 칸이 있을 수 있다) */
function randomBoard(rng, max) {
  const n = 3;
  const black = [];
  if (randInt(rng, 0, 2) === 0) black.push(randInt(rng, 0, 8));
  const givens = new Array(9).fill(null);
  for (let cell = 0; cell < 9; cell++) if (!black.includes(cell) && randInt(rng, 0, 9) < 5) givens[cell] = randInt(rng, 1, max);
  // 빈칸은 넷까지(모두 넣어 보기가 빨리 끝나게)
  let blanks = givens.filter((value, cell) => value === null && !black.includes(cell)).length;
  for (let cell = 0; cell < 9 && blanks > 4; cell++) {
    if (!black.includes(cell) && givens[cell] === null) {
      givens[cell] = randInt(rng, 1, max);
      blanks -= 1;
    }
  }
  return { n, black, givens };
}

test('정확한 셈: 작은 판에서 빈칸마다 모두 넣어 본 답의 수와 같다(1부터 max까지)', () => {
  const rng = createRng(5);
  const seen = { none: 0, one: 0, many: 0 };
  for (let trial = 0; trial < 120; trial++) {
    const max = randInt(rng, 6, 10);
    const board = randomBoard(rng, max);
    assert.equal(checkBoard(board), null);
    const brute = bruteAll(board, max);
    const result = countSolutions(board, { limit: Infinity, max });
    assert.equal(result.complete, true);
    assert.equal(result.count, brute.count, JSON.stringify(board));
    for (const example of result.examples) assert.ok(isDone(board, example), JSON.stringify(example));
    const two = countSolutions(board, { limit: 2, max });
    assert.equal(two.count, Math.min(2, brute.count));
    seen[brute.count === 0 ? 'none' : brute.count === 1 ? 'one' : 'many'] += 1;
  }
  // 세 가지가 모두 나온다(답이 없는 판, 하나뿐인 판, 여럿인 판)
  assert.ok(seen.none > 0 && seen.one > 0 && seen.many > 0, JSON.stringify(seen));
  // 빈 3×3 판을 1부터 4까지로 채우는 방법
  const empty = { n: 3, black: [], givens: new Array(9).fill(null) };
  assert.equal(countSolutions(empty, { limit: Infinity, max: 4 }).count, bruteAll(empty, 4).count);
});

test('차례 풀이: 끝까지 채운 판은 1부터 60까지(답에 더 큰 수가 있으면 그 수까지)로 모두 따져도 답이 그것 하나뿐이다. 들어갈 수가 없는 칸이 생긴 판은 답이 없다', () => {
  const rng = createRng(9);
  let solved = 0;
  let dead = 0;
  for (let trial = 0; trial < 160; trial++) {
    // 반은 다 채운 답에서 빈칸을 몇 개 뚫은 판(차례 풀이가 끝까지 채우는 판이 많다), 반은 아무렇게나 적은 판
    let board = randomBoard(rng, 12);
    if (trial % 2 === 0) {
      const dark = randInt(rng, 0, 1) ? [randInt(rng, 0, 8)] : [];
      const full = randomSolution(rng, 3, dark, 20, 9);
      const givens = full.slice();
      for (let cell = 0; cell < 9; cell++) if (givens[cell] !== null && randInt(rng, 0, 2) === 0) givens[cell] = null;
      board = { n: 3, black: dark, givens };
    }
    const chain = stepSolve(board);
    if (chain.solved) {
      solved += 1;
      const brute = bruteSearch(board, Math.max(60, ...chain.cells.filter((value) => value !== null)), 2);
      assert.equal(brute.count, 1, JSON.stringify(board));
      assert.deepEqual(brute.answers[0], chain.cells);
      // 차례마다 그 칸이 가로줄과 세로줄이 허락하는 수의 겹침에서 하나만 남았다
      const cells = board.givens.slice();
      for (const step of chain.steps) {
        const opts = cellOptions(board, cells, step.cell);
        assert.deepEqual(opts.both, [step.value]);
        if (step.by === 'row') assert.deepEqual(opts.row, [step.value]);
        if (step.by === 'col') assert.deepEqual(opts.col, [step.value]);
        cells[step.cell] = step.value;
      }
    } else if (chain.dead) {
      dead += 1;
      assert.equal(bruteSearch(board, 60, 1).count, 0, JSON.stringify(board));
    }
  }
  assert.ok(solved > 10 && dead > 10, `${solved} / ${dead}`);
});

test('판의 풀이: 차례 풀이로 채운 수가 99를 넘으면 숫자판으로 넣을 수 없어서 1부터 99까지로 다시 센다', () => {
  // 1과 50 사이의 가운데는 자연수가 아니고 작은 쪽은 1보다 작아서 99뿐이다. 그 아래는 100, 101
  const over = { n: 3, black: [], givens: [1, 50, null, 2, 51, null, 3, 52, null] };
  const chain = stepSolve(over);
  assert.equal(chain.solved, true);
  assert.deepEqual([chain.cells[2], chain.cells[5], chain.cells[8]], [99, 100, 101]);
  assert.deepEqual(solve(over), { possible: false, count: 0, complete: true, example: null, steps: [] });
  assert.equal(bruteSearch(over, 99, 1).count, 0);
  const fine = solve({ n: 3, black: [], givens: [3, null, 9, 7, 13, null, 11, 14, 8] });
  assert.equal(fine.possible, true);
  assert.equal(fine.count, 1);
  assert.deepEqual(fine.example, [3, 15, 9, 7, 13, 10, 11, 14, 8]);
  assert.equal(fine.steps.length, 2);
  // 오른쪽 세로줄이 모두 빈칸이면 줄마다 두 가지(3이나 9, 4나 10, 5나 11)라 3, 4, 5와 9, 10, 11의 두 답이 있다
  const two = solve({ n: 3, black: [], givens: [1, 5, null, 2, 6, null, 3, 7, null] });
  assert.deepEqual([two.possible, two.count, two.steps.length], [true, 2, 0]);
  assert.equal(bruteAll({ n: 3, black: [], givens: [1, 5, null, 2, 6, null, 3, 7, null] }, 20).count, 2);
});

test('판과 놓인 모습의 값: 검은 칸은 줄에서 빠지고, 적힌 수는 바꿀 수 없고, 수는 1부터 99까지다', () => {
  const board = { n: 4, black: [0, 5], givens: [null, 3, null, 9, null, null, 4, null, 1, null, null, null, null, null, null, 2] };
  assert.equal(checkBoard(board), null);
  assert.deepEqual(
    linesOf(4, [0, 5]).map((line) => line.cells.length),
    [3, 3, 4, 4, 3, 3, 4, 4],
  );
  assert.equal(blanksOf(board).length, 9);
  assert.equal(cellsOk(board, board.givens), true);
  const moved = board.givens.slice();
  moved[1] = 4;
  assert.equal(cellsOk(board, moved), false);
  const onBlack = board.givens.slice();
  onBlack[0] = 1;
  assert.equal(cellsOk(board, onBlack), false);
  const big = board.givens.slice();
  big[2] = 100;
  assert.equal(cellsOk(board, big), false);
  assert.equal(isFull(board, board.givens), false);
  for (const bad of [null, { n: 2, black: [], givens: [] }, { n: 3, black: [9], givens: new Array(9).fill(null) }, { n: 3, black: [2, 1], givens: new Array(9).fill(null) }, { n: 3, black: [0], givens: [5, ...new Array(8).fill(null)] }, { n: 3, black: [], givens: [0, ...new Array(8).fill(null)] }]) {
    assert.notEqual(checkBoard(bad), null, JSON.stringify(bad));
  }
});
