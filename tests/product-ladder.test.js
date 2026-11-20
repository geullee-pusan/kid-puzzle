// 곱 단서 퍼즐의 사다리 점검: 단계마다 판이 잣대에 맞는지, 답이 하나뿐인지를 다른 방법(짝 지어 보기)으로 다시 센다.
// 더 작은 판도 여기서 본다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, goodBoard, nextSeed, rungOf, smallBoards } from '../src/core/product-ladder.js';
import { checkBoard, isDone, sameBoard } from '../src/core/product.js';
import { smallerProduct } from '../src/core/smaller.js';
import { bruteFactorPairs, pairingCount } from './helpers/brute-product.js';

const SEEDS = Array.from({ length: 40 }, (_, index) => index + 1);
/** 한 가지로만 갈리는 보이는 단서의 수(모두 곱해 보며 센다) */
const oneWays = (board) => [...board.rows, ...board.cols].filter((clue) => clue !== null && bruteFactorPairs(clue, 2 * board.n).length === 1).length;
const hiddenRows = (board) => board.rows.filter((clue) => clue === null).length;
const hiddenCols = (board) => board.cols.filter((clue) => clue === null).length;

test('사다리: 여섯 단계, 맨 위는 직접 만들기. 기본·기본·응용·응용·도전·도전', () => {
  assert.deepEqual(
    LADDER.map((rung) => [rung.level, rung.tag, rung.mode]),
    [
      [1, 'basic', 'small'],
      [2, 'basic', 'four'],
      [3, 'applied', 'few'],
      [4, 'applied', 'hidden'],
      [5, 'challenge', 'five'],
      [6, 'challenge', 'make'],
    ],
  );
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  assert.throws(() => generateBoard(6, 1));
  assert.throws(() => generateBoard(1, 0));
  assert.throws(() => rungOf(9));
});

test('단계마다 판 1~40번: 크기, 숨은 단서, 한 가지로만 갈리는 단서의 수, 답이 하나뿐인지(다른 방법으로 다시 센다)', () => {
  const spec = {
    1: { n: 3, hide: false, least: 3 },
    2: { n: 4, hide: false, least: 6 },
    3: { n: 4, hide: false, most: 4 },
    4: { n: 4, hide: true, most: 5 },
    5: { n: 5, hide: false, most: 6 },
  };
  for (let level = 1; level <= TOP_LEVEL; level++) {
    const rung = rungOf(level);
    const want = spec[level];
    for (const seed of SEEDS) {
      const made = generateBoard(level, seed);
      const { board } = made;
      const where = `${level}단계 ${seed}번`;
      assert.equal(checkBoard(board), null, where);
      assert.equal(board.n, want.n, where);
      // 숨은 단서 단계는 가로줄 하나와 세로줄 하나만 숨긴다(같은 쪽 둘을 숨기면 답이 늘 둘 이상이다)
      assert.equal(hiddenRows(board), want.hide ? 1 : 0, where);
      assert.equal(hiddenCols(board), want.hide ? 1 : 0, where);
      const ways = oneWays(board);
      if (want.least !== undefined) assert.ok(ways >= want.least, where);
      if (want.most !== undefined) assert.ok(ways <= want.most, where);
      const brute = pairingCount(board);
      assert.equal(brute.count, 1, `${where}: 답이 하나뿐`);
      assert.ok(isDone(board, brute.answers[0]), where);
      assert.deepEqual(made.solution, { possible: true, count: 1 }, where);
      assert.ok(goodBoard(rung, board, { first: seed === 1 }), where);
      assert.deepEqual(generateBoard(level, seed), made, `${where}: 같은 번호는 같은 판`);
    }
  }
});

test('첫 판: 1단계는 단서가 모두 한 가지로만 갈리는 3×3 판, 2단계는 일곱 이상이 한 가지로만 갈리는 4×4 판이다. 1단계의 작은 판도 모두 한 가지로만 갈린다', () => {
  assert.equal(oneWays(generateBoard(1, 1).board), 6);
  assert.ok(oneWays(generateBoard(2, 1).board) >= 7);
  for (const seed of SEEDS.slice(0, 10)) {
    const small = generateBoard(1, seed, { small: true });
    assert.equal(small.small, true);
    assert.equal(small.board.n, 3);
    assert.equal(oneWays(small.board), 6);
    assert.equal(pairingCount(small.board).count, 1);
  }
  // 작은 판은 맨 아래 단계에서만 낸다
  assert.equal(generateBoard(2, 1, { small: true }).small, false);
});

test('다음 판 번호는 방금 한 판과 다른 판을 낸다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of SEEDS.slice(0, 10)) {
      const next = nextSeed(level, seed);
      assert.ok(next > seed);
      assert.equal(sameBoard(generateBoard(level, next).board, generateBoard(level, seed).board), false);
    }
  }
  assert.equal(nextSeed(MAKE_LEVEL, 3), 4);
});

test('더 작은 판: 한 줄이 적고 답이 하나뿐인 판. 숨은 단서가 있는 판에서는 작은 판도 가로줄 하나와 세로줄 하나를 숨긴다. 3×3 판에는 없다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    const rung = rungOf(level);
    for (const seed of SEEDS.slice(0, 15)) {
      const { board } = generateBoard(level, seed);
      const where = `${level}단계 ${seed}번`;
      const origin = { mode: rung.mode, board };
      if (board.n === 3) {
        assert.equal(smallerProduct(origin, 0), null, where);
        continue;
      }
      const lists = smallBoards(origin);
      assert.equal(lists.yes.length, 2, where);
      assert.deepEqual(lists.no, []);
      for (const turn of [0, 1, 2, 3]) {
        const small = smallerProduct(origin, turn);
        assert.ok(small, where);
        assert.equal(checkBoard(small.board), null, where);
        assert.equal(small.board.n, board.n - 1, where);
        assert.equal(hiddenRows(small.board), hiddenRows(board), where);
        assert.equal(hiddenCols(small.board), hiddenCols(board), where);
        assert.equal(pairingCount(small.board).count, 1, `${where}: 작은 판의 답이 하나뿐`);
        assert.deepEqual(smallerProduct(origin, turn), small, `${where}: 같은 판에서는 같은 작은 판`);
      }
      assert.equal(sameBoard(smallerProduct(origin, 0).board, smallerProduct(origin, 1).board), false, where);
    }
  }
  assert.equal(smallerProduct({ board: null }), null);
  assert.equal(smallerProduct({ board: { n: 2, rows: [2, 12], cols: [3, 8] } }), null);
});
