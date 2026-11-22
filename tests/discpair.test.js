// 원판 둘씩 옮기기의 판과 풀이: 풀이 프로그램이 하는 말(되는지, 가장 적은 횟수, 안 되는 까닭인 동그라미 칸의 원판 수)을 다른 방법으로 다시 따진다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MAX_CELLS, MAX_TOTAL, MIN_CELLS, MIN_TOTAL, canStep, checkBoard, freeIn, isGathered, isSide, minMoves, nextOf, oddCircle, replay, shapeCounts, sidesOf, solve, tableOf } from '../src/core/discpair.js';
import { allBoards, bruteMin, bruteTable, walk } from './helpers/brute-discpair.js';

/** 테스트에서 쓰는 시드 난수(풀이 프로그램과 따로 둔다) */
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const pick = (rand, k) => Math.floor(rand() * k);
function randomBoard(rand, n, total) {
  const piles = Array(n).fill(0);
  for (let disc = 0; disc < total; disc++) piles[pick(rand, n)] += 1;
  return { n, piles };
}
/** 칸 수의 홀짝으로만 보는 짐작: 칸 수와 원판 수가 짝수이고 짝수 번째 칸들의 원판이 홀수 개면 안 된다 */
function guessImpossible(n, piles) {
  const even = piles.filter((_, cell) => cell % 2 === 0).reduce((sum, value) => sum + value, 0);
  const total = piles.reduce((sum, value) => sum + value, 0);
  return n % 2 === 0 && total % 2 === 0 && even % 2 === 1;
}

test('판의 규격: 칸 4~8개, 원판은 모두 2~10개', () => {
  assert.deepEqual([MIN_CELLS, MAX_CELLS, MIN_TOTAL, MAX_TOTAL], [4, 8, 2, 10]);
  assert.equal(checkBoard({ n: 4, piles: [1, 1, 0, 0] }), null);
  assert.equal(checkBoard({ n: 8, piles: [10, 0, 0, 0, 0, 0, 0, 0] }), null);
  assert.notEqual(checkBoard({ n: 3, piles: [1, 1, 0] }), null);
  assert.notEqual(checkBoard({ n: 9, piles: Array(9).fill(1) }), null);
  assert.notEqual(checkBoard({ n: 4, piles: [1, 0, 0, 0] }), null);
  assert.notEqual(checkBoard({ n: 4, piles: [6, 5, 0, 0] }), null);
  assert.notEqual(checkBoard({ n: 4, piles: [1, 1, 0] }), null);
  assert.notEqual(checkBoard({ n: 4, piles: [1, -1, 2, 0] }), null);
  assert.notEqual(checkBoard(null), null);
});

test('옆 칸과 걸음: 0번 칸과 맨 끝 칸도 옆 칸이다. 같은 칸의 두 원판을 옮겨도 되지만, 막 옮긴 원판은 그 번에 다시 옮길 수 없다', () => {
  assert.deepEqual(sidesOf(6, 0), [5, 1]);
  assert.deepEqual(sidesOf(5, 4), [3, 0]);
  assert.equal(isSide(4, 0, 3), true);
  assert.equal(isSide(4, 0, 2), false);
  assert.equal(isSide(4, 1, 1), false);
  const board = { n: 4, piles: [2, 0, 0, 0] };
  // 같은 칸의 두 원판을 저마다 다른 쪽으로
  assert.deepEqual(replay(board, [[0, 1], [0, 3]]), { ok: true, piles: [0, 1, 0, 1], pending: null, moves: 1 });
  // 첫째 걸음만 했다
  assert.deepEqual(replay(board, [[0, 1]]), { ok: true, piles: [1, 1, 0, 0], pending: [0, 1], moves: 0 });
  // 막 옮긴 원판을 다시 옮기려 한다(1번 칸에는 막 들어간 원판뿐이다)
  assert.equal(replay(board, [[0, 1], [1, 2]]).ok, false);
  assert.equal(freeIn([1, 1, 0, 0], [0, 1], 1), 0);
  assert.equal(canStep(4, [1, 1, 0, 0], [0, 1], 0), true);
  // 1번 칸에 원판이 있던 판이면 다른 원판을 옮길 수 있다. 한 번이 끝나면 다시 옮길 수 있다
  assert.equal(replay({ n: 4, piles: [1, 1, 0, 0] }, [[0, 1], [1, 2]]).ok, true);
  assert.equal(replay(board, [[0, 1], [0, 3], [1, 2], [3, 2]]).ok, true);
  // 옆 칸이 아니거나 원판이 없는 칸에서는 옮길 수 없다
  assert.equal(replay(board, [[0, 2]]).ok, false);
  assert.equal(replay(board, [[1, 2]]).ok, false);
  assert.equal(replay(board, [[0, 1, 2]]).ok, false);
  assert.equal(replay(board, 'x').ok, false);
  assert.equal(isGathered([0, 3, 0, 0]), true);
  assert.equal(isGathered([1, 2, 0, 0]), false);
  assert.deepEqual(shapeCounts([1, 2, 3, 4, 5]), { circle: 9, square: 6 });
});

test('한 번 옮기기로 가는 모습은 원판마다 따라가 본 것과 같다', () => {
  const rand = lcg(7);
  for (let trial = 0; trial < 200; trial++) {
    const n = MIN_CELLS + pick(rand, MAX_CELLS - MIN_CELLS + 1);
    const board = randomBoard(rand, n, 2 + pick(rand, 7));
    for (const item of nextOf(n, board.piles)) {
      assert.deepEqual(walk(n, board.piles, item.steps), item.piles);
      assert.deepEqual(replay(board, item.steps).piles, item.piles);
    }
  }
});

test('되는지와 가장 적은 수: 칸 4~8개에 원판 6개까지(칸 4~6개는 8개까지)의 모든 판에서 원판마다 옮겨 본 너비 우선 탐색과 같다', () => {
  for (let n = MIN_CELLS; n <= MAX_CELLS; n++) {
    const top = n <= 6 ? 8 : 6;
    for (let total = MIN_TOTAL; total <= top; total++) {
      const brute = bruteTable(n, total);
      for (const piles of allBoards(n, total)) {
        const where = `${n}칸 ${piles.join(',')}`;
        const found = solve({ n, piles });
        const depth = brute(piles);
        assert.equal(found.possible, depth !== null, where);
        assert.equal(found.min, depth, where);
        // 안 되는 판은 바로 칸 수, 원판 수, 동그라미 칸의 원판 수가 짝수, 짝수, 홀수인 판이다
        assert.equal(!found.possible, guessImpossible(n, piles), where);
        assert.equal(oddCircle({ n, piles }), guessImpossible(n, piles), where);
      }
    }
  }
});

test('원판 10개까지 모든 판: 모일 수 있는 모습의 수가 "짝수, 짝수, 홀수"가 아닌 모습의 수와 같다(그 밖의 판은 늘 된다)', () => {
  for (let n = MIN_CELLS; n <= MAX_CELLS; n++) {
    for (let total = MIN_TOTAL; total <= MAX_TOTAL; total++) {
      const boards = allBoards(n, total);
      const table = tableOf(n, total);
      const fine = boards.filter((piles) => !guessImpossible(n, piles));
      assert.equal(table.size, fine.length, `${n}칸 ${total}개`);
      for (const piles of fine) assert.notEqual(minMoves({ n, piles }), null, `${n}칸 ${piles.join(',')}`);
    }
  }
});

test('큰 판(칸 7, 8개에 원판 7, 8개)의 아무렇게나 만든 판: 앞으로 퍼져 나가는 탐색과 가장 적은 수가 같다', () => {
  const rand = lcg(2026);
  let checked = 0;
  for (let trial = 0; trial < 16; trial++) {
    const n = 7 + pick(rand, 2);
    const board = randomBoard(rand, n, 7 + pick(rand, 2));
    const found = solve(board);
    if (!found.possible) {
      assert.ok(guessImpossible(board.n, board.piles));
      continue;
    }
    const depth = bruteMin(board.n, board.piles, 3000);
    if (depth === undefined) continue;
    assert.equal(found.min, depth, `${board.n}칸 ${board.piles.join(',')}`);
    checked += 1;
  }
  assert.ok(checked >= 6, `${checked}판`);
});

test('풀이의 길: 원판마다 따라가 보면 규칙대로이고, 가장 적은 수만큼 옮겨 모두 한 칸에 모인다', () => {
  const rand = lcg(11);
  for (let trial = 0; trial < 150; trial++) {
    const n = MIN_CELLS + pick(rand, MAX_CELLS - MIN_CELLS + 1);
    const board = randomBoard(rand, n, 2 + pick(rand, 9));
    const found = solve(board);
    const where = `${n}칸 ${board.piles.join(',')}`;
    if (!found.possible) {
      assert.deepEqual(found.steps, [], where);
      continue;
    }
    assert.equal(found.steps.length, 2 * found.min, where);
    const end = walk(n, board.piles, found.steps);
    assert.ok(end && isGathered(end), where);
    assert.deepEqual(replay(board, found.steps).piles, end, where);
    assert.deepEqual([found.circle, found.square], [shapeCounts(board.piles).circle, shapeCounts(board.piles).square]);
  }
});

test('바뀌지 않는 것: 칸 수가 짝수인 고리에서는 아무렇게나 옮겨도 동그라미 칸 원판 수의 홀짝이 그대로다. 홀수인 고리에서는 바뀌기도 한다', () => {
  const rand = lcg(3);
  let oddChanged = 0;
  for (let trial = 0; trial < 300; trial++) {
    const n = MIN_CELLS + pick(rand, MAX_CELLS - MIN_CELLS + 1);
    let piles = randomBoard(rand, n, 2 + pick(rand, 9)).piles;
    const start = shapeCounts(piles).circle % 2;
    for (let move = 0; move < 12; move++) {
      const options = nextOf(n, piles);
      piles = options[pick(rand, options.length)].piles;
      if (n % 2 === 0) assert.equal(shapeCounts(piles).circle % 2, start);
      else if (shapeCounts(piles).circle % 2 !== start) oddChanged += 1;
    }
  }
  assert.ok(oddChanged > 0);
});
