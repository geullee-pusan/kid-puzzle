// 곱 단서 퍼즐의 판과 풀이 프로그램 점검. 답의 수를 다른 방법(tests/helpers/brute-product.js)으로 다시 세어 견준다.
// 3×3 판은 놓을 수 있는 모든 모습(4,320가지)을, 4×4와 5×5 판은 시드 난수로 만든 판을 따진다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MAX_SIZE, MIN_SIZE, cellsOk, checkBoard, cluesOf, countSolutions, isDone, isUnique, lineCells, lineStates, oneWay, oneWayCount, pairsOf, solve, splitCount } from '../src/core/product.js';
import { randomCells, shapesOf } from '../src/core/product-ladder.js';
import { createRng, randInt } from '../src/core/rng.js';
import { bruteClues, bruteFactorPairs, bruteShapes, eachArrangement, matchingPairings, naiveCount, pairingCount } from './helpers/brute-product.js';

const keyOf = (clues) => `${clues.rows.join(',')}|${clues.cols.join(',')}`;

/** 3×3 판에 놓을 수 있는 모든 모습과 그 단서 */
const ALL3 = [];
eachArrangement(3, (cells) => ALL3.push({ cells, clues: bruteClues(3, cells) }));

/** 보이는 단서에 맞는 3×3 모습의 수(모두 놓아 보기) */
const naive3 = (board) => ALL3.filter(({ clues }) => board.rows.every((clue, index) => clue === null || clue === clues.rows[index]) && board.cols.every((clue, index) => clue === null || clue === clues.cols[index])).length;

/** 단서를 가린 판. hide는 가릴 줄의 번호(0…n-1은 가로줄, n…2n-1은 세로줄) */
function veiled(board, hide) {
  const rows = board.rows.slice();
  const cols = board.cols.slice();
  for (const line of hide) {
    if (line < board.n) rows[line] = null;
    else cols[line - board.n] = null;
  }
  return { n: board.n, rows, cols };
}

/** 줄 2n개 가운데 둘을 고르는 모든 방법 */
function twoLines(n) {
  const out = [];
  for (let a = 0; a < 2 * n; a++) for (let b = a + 1; b < 2 * n; b++) out.push([a, b]);
  return out;
}

test('판의 값: 크기 3~5, 줄마다 단서 하나(숨은 단서는 null), 단서는 2 이상', () => {
  assert.equal(MIN_SIZE, 3);
  assert.equal(MAX_SIZE, 5);
  assert.equal(checkBoard({ n: 3, rows: [18, 4, 10], cols: [3, 30, 8] }), null);
  assert.equal(checkBoard({ n: 3, rows: [18, null, 10], cols: [3, 30, null] }), null);
  assert.notEqual(checkBoard({ n: 2, rows: [2, 12], cols: [3, 8] }), null);
  assert.notEqual(checkBoard({ n: 6, rows: [], cols: [] }), null);
  assert.notEqual(checkBoard({ n: 3, rows: [18, 4], cols: [3, 30, 8] }), null);
  assert.notEqual(checkBoard({ n: 3, rows: [18, 4, 1], cols: [3, 30, 8] }), null);
  assert.notEqual(checkBoard({ n: 3, rows: [18, 4, 31], cols: [3, 30, 8] }), null);
  assert.notEqual(checkBoard({ n: 3, rows: [18, 4, 2.5], cols: [3, 30, 8] }), null);
  assert.notEqual(checkBoard(null), null);
});

test('곱이 되는 두 수: 모든 단서 값에서 모두 곱해 본 것과 같다. 한 가지로만 갈리는 단서를 센다', () => {
  for (let n = MIN_SIZE; n <= MAX_SIZE; n++) {
    const top = 2 * n;
    for (let P = 1; P <= top * top; P++) {
      assert.deepEqual(pairsOf(P, n), bruteFactorPairs(P, top), `${n}×${n}: ${P}`);
      assert.equal(oneWay(P, n), bruteFactorPairs(P, top).length === 1, `${n}×${n}: ${P}`);
    }
  }
  // 1부터 8까지에서 두 가지로 갈리는 곱은 6, 8, 12, 24뿐이다
  const two = [];
  for (let P = 2; P <= 56; P++) if (pairsOf(P, 4).length === 2) two.push(P);
  assert.deepEqual(two, [6, 8, 12, 24]);
  assert.equal(oneWay(null, 4), false);
  assert.equal(oneWayCount({ n: 4, rows: [7, 12, 15, 32], cols: [14, 5, 12, 48] }), 6);
});

test('칸 모양: 줄마다 딱 두 칸인 모양은 3×3 6가지, 4×4 90가지, 5×5 2,040가지(다른 방법으로 센 것과 같다)', () => {
  assert.equal(shapesOf(3).length, 6);
  assert.equal(shapesOf(4).length, 90);
  assert.equal(shapesOf(5).length, 2040);
  assert.equal(bruteShapes(3).length, 6);
  assert.equal(bruteShapes(4).length, 90);
  for (const n of [3, 4, 5]) {
    for (const shape of shapesOf(n)) {
      const cols = new Array(n).fill(0);
      for (const pair of shape) for (const col of pair) cols[col] += 1;
      assert.ok(cols.every((value) => value === 2));
    }
  }
});

test('줄의 모습과 다 됐는지: 수가 둘이고 곱이 단서와 같으면 맞고, 다르면 다르고, 셋 이상이면 많다', () => {
  const board = { n: 3, rows: [18, 4, 10], cols: [3, 30, 8] };
  // 답: 3 6 _ / 1 _ 4 / _ 5 2
  const answer = [3, 6, null, 1, null, 4, null, 5, 2];
  assert.equal(isDone(board, answer), true);
  assert.deepEqual(cluesOf(3, answer), { n: 3, rows: [18, 4, 10], cols: [3, 30, 8] });
  assert.deepEqual(lineCells(3, 'row', 1), [3, 4, 5]);
  assert.deepEqual(lineCells(3, 'col', 1), [1, 4, 7]);
  const half = [3, 6, null, null, null, null, null, null, null];
  const states = lineStates(board, half);
  assert.deepEqual(
    states.map((line) => line.state),
    ['ok', 'open', 'open', 'open', 'open', 'open'],
  );
  assert.equal(isDone(board, half), false);
  const off = [3, 5, null, null, null, null, null, null, null];
  assert.equal(lineStates(board, off)[0].state, 'off');
  assert.equal(lineStates(board, off)[0].product, 15);
  const many = [3, 6, 1, null, null, null, null, null, null];
  assert.equal(lineStates(board, many)[0].state, 'many');
  // 다 놓았어도 줄마다 두 수가 아니면 단서가 없다
  assert.equal(cluesOf(3, [3, 6, 1, null, null, 4, null, 5, 2]), null);
  // 숨은 단서의 줄은 수가 둘이면 맞는다
  assert.equal(isDone({ n: 3, rows: [null, 4, 10], cols: [3, 30, null] }, answer), true);
  // 놓인 모습의 값: 칸 수, 1부터 2n까지, 겹치지 않는다
  assert.equal(cellsOk(3, answer), true);
  assert.equal(cellsOk(3, [3, 3, null, null, null, null, null, null, null]), false);
  assert.equal(cellsOk(3, [7, null, null, null, null, null, null, null, null]), false);
  assert.equal(cellsOk(3, [1, 2]), false);
});

test('3×3: 모든 모습(4,320가지)의 단서마다 답의 수가 모두 놓아 보기로 센 것과 같다. 답이 하나뿐인 모습은 3,240가지(75%)다', () => {
  assert.equal(ALL3.length, 4320);
  const groups = new Map();
  for (const { clues } of ALL3) groups.set(keyOf(clues), (groups.get(keyOf(clues)) ?? 0) + 1);
  assert.equal(groups.size, 3762);
  let unique = 0;
  for (const [key, count] of groups) {
    const [rows, cols] = key.split('|').map((part) => part.split(',').map(Number));
    const board = { n: 3, rows, cols };
    const result = countSolutions(board, { limit: 1000 });
    assert.equal(result.complete, true, key);
    assert.equal(result.count, count, key);
    assert.equal(isDone(board, result.example), true, key);
    assert.equal(pairingCount(board).count, count, `${key}: 짝 지어 보기`);
    if (count === 1) unique += 1;
  }
  assert.equal(unique, 3240);
});

test('3×3: 단서를 하나나 둘 숨긴 판도 답의 수가 모두 놓아 보기와 같다', () => {
  const keys = [...new Set(ALL3.map(({ clues }) => keyOf(clues)))];
  const hides = [...Array.from({ length: 6 }, (_, line) => [line]), ...twoLines(3)];
  for (const key of keys.filter((_, index) => index % 40 === 0)) {
    const [rows, cols] = key.split('|').map((part) => part.split(',').map(Number));
    for (const hide of hides) {
      const board = veiled({ n: 3, rows, cols }, hide);
      const want = naive3(board);
      assert.equal(countSolutions(board, { limit: 5000 }).count, want, `${key} 숨김 ${hide}`);
      assert.equal(pairingCount(board).count, want, `${key} 숨김 ${hide}: 짝 지어 보기`);
    }
  }
});

test('4×4: 모두 놓아 보기로 판 둘을 다시 센다(답이 하나인 판과 단서 둘을 숨긴 판)', () => {
  const board = { n: 4, rows: [7, 12, 15, 32], cols: [14, 5, 12, 48] };
  assert.equal(naiveCount(board), 1);
  assert.equal(countSolutions(board).count, 1);
  const two = veiled(board, [1, 2]);
  const want = naiveCount(two);
  assert.equal(countSolutions(two, { limit: 1000 }).count, want);
  assert.equal(pairingCount(two).count, want);
  assert.ok(want >= 2);
});

test('4×4와 5×5: 시드 난수로 만든 판에서 답의 수가 짝 지어 보기로 센 것과 같고, 찾은 답이 정말 맞는다', () => {
  const rng = createRng(20261121);
  for (const [n, rounds] of [
    [4, 300],
    [5, 40],
  ]) {
    for (let round = 0; round < rounds; round++) {
      const full = cluesOf(n, randomCells(rng, n));
      // 숨기지 않은 판, 가로줄 하나와 세로줄 하나를 숨긴 판, 같은 쪽 둘을 숨긴 판
      const boards = [full, veiled(full, [randInt(rng, 0, n - 1), n + randInt(rng, 0, n - 1)]), veiled(full, [0, 1])];
      for (const board of boards) {
        const brute = pairingCount(board);
        const result = countSolutions(board, { limit: 100000 });
        assert.equal(result.complete, true);
        assert.equal(result.count, brute.count, JSON.stringify(board));
        assert.ok(isDone(board, result.example), JSON.stringify(board));
        assert.ok(brute.answers.some((cells) => cells.join() === result.example.join()));
        assert.equal(isUnique(board), brute.count === 1);
        assert.equal(solve(board).count, Math.min(2, brute.count));
      }
    }
  }
});

test('사실: 가로줄 하나와 세로줄 하나의 단서를 숨겨도 답의 수는 그대로다. 같은 쪽 단서 둘을 숨기거나 같은 쪽에 같은 단서가 둘이면 답이 둘 이상이다', () => {
  // 3×3은 모든 모습에서(가린 줄마다, 가린 단서를 뺀 단서가 같은 모습의 수를 한 번에 세어 둔다)
  const tally = (hide) => {
    const counts = new Map();
    for (const { clues } of ALL3) {
      const key = keyOf(veiled({ n: 3, ...clues }, hide));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return (board) => counts.get(keyOf(veiled(board, hide)));
  };
  const plain = tally([]);
  const crossed = [];
  for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) crossed.push(tally([row, 3 + col]));
  const twoRows = tally([0, 1]);
  const twoCols = tally([3, 5]);
  for (const { clues } of ALL3) {
    const board = { n: 3, rows: clues.rows, cols: clues.cols };
    const count = plain(board);
    for (const look of crossed) assert.equal(look(board), count, keyOf(clues));
    assert.ok(twoRows(board) >= 2, keyOf(clues));
    assert.ok(twoCols(board) >= 2, keyOf(clues));
    if (new Set(clues.rows).size < 3 || new Set(clues.cols).size < 3) assert.ok(count >= 2, keyOf(clues));
  }
  // 4×4는 시드 난수로 만든 판에서(짝 지어 보기로 센다)
  const rng = createRng(7);
  for (let round = 0; round < 200; round++) {
    const board = cluesOf(4, randomCells(rng, 4));
    const count = pairingCount(board).count;
    assert.equal(pairingCount(veiled(board, [randInt(rng, 0, 3), 4 + randInt(rng, 0, 3)])).count, count);
    assert.ok(pairingCount(veiled(board, [randInt(rng, 0, 1), randInt(rng, 2, 3)])).count >= 2);
    if (new Set(board.rows).size < 4 || new Set(board.cols).size < 4) assert.ok(count >= 2);
  }
});

test('한 쪽 단서만으로 나누는 가짓수는 짝 지어 보기로 센 것과 같다', () => {
  const rng = createRng(3);
  for (const n of [3, 4, 5]) {
    for (let round = 0; round < 30; round++) {
      const board = cluesOf(n, randomCells(rng, n));
      assert.equal(splitCount(board.rows, n), matchingPairings(board.rows, n).length);
      assert.equal(splitCount(board.cols, n), matchingPairings(board.cols, n).length);
      const hidden = board.rows.slice();
      hidden[0] = null;
      assert.equal(splitCount(hidden, n), matchingPairings(hidden, n).length);
    }
  }
});

test('세는 걸음의 위 끝: 넘으면 끝까지 따지지 못했다고 알린다. 찾은 답 둘을 돌려준다', () => {
  const board = { n: 5, rows: [null, null, null, null, null], cols: [null, null, null, null, null] };
  const short = countSolutions(board, { limit: 1000, budget: 50 });
  assert.equal(short.complete, false);
  const many = countSolutions(board, { limit: 21, budget: 3_000_000 });
  assert.equal(many.complete, true);
  assert.equal(many.count, 21);
  assert.equal(many.examples.length, 2);
  assert.notDeepEqual(many.examples[0], many.examples[1]);
  // 직접 만들기의 판에서 답을 세는 데 걸리는 걸음: 단서를 모두 숨긴 5×5 판도 위 끝 안에서 끝난다
  assert.ok(many.steps < 3_000_000);
});
