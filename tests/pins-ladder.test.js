// 핀에 실 감기의 사다리와 판 내기, 더 작은 판: 단계마다 핀 수와 칸 수, 여러 가닥인 판과 한 가닥인 판의 차례, 작은 판이 같은 꼴인지 본다.
// 가닥 수는 두 수를 함께 나누는 가장 큰 수(tests/helpers/brute-pins.js)로 다시 따진다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, manyAt, nextSeed, rungOf, smallBoards } from '../src/core/pins-ladder.js';
import { MAX_PINS, MIN_PINS, checkBoard, choicesOf, sameBoard } from '../src/core/pins.js';
import { smallerPins } from '../src/core/smaller.js';
import { gcd, onlyOneAndItself } from './helpers/brute-pins.js';

const SEEDS = Array.from({ length: 60 }, (_, index) => index + 1);

test('사다리: 여섯 단계, 표시는 기본·기본·응용·응용·도전·도전, 맨 위는 직접 만들기', () => {
  assert.deepEqual(LADDER.map((rung) => rung.level), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(LADDER.map((rung) => rung.tag), ['basic', 'basic', 'applied', 'applied', 'challenge', 'challenge']);
  assert.deepEqual(LADDER.map((rung) => rung.mode), ['wind', 'guess', 'table', 'one', 'predict', 'make']);
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  assert.throws(() => generateBoard(6, 1));
  assert.throws(() => generateBoard(1, 0));
  assert.throws(() => rungOf(9));
});

test('첫 판: 핀 6개 2칸씩(2가닥), 핀 9개 3칸씩(3가닥), 표는 핀 12개, 한 가닥 고르기는 핀 9개, 맞히기는 핀 13개 다음 15개', () => {
  assert.deepEqual(generateBoard(1, 1).board, { n: 6, k: 2 });
  assert.deepEqual(generateBoard(2, 1).board, { n: 9, k: 3 });
  assert.deepEqual(generateBoard(3, 1).board, { n: 12, k: null });
  assert.deepEqual(generateBoard(4, 1).board, { n: 9, k: null });
  assert.deepEqual(generateBoard(5, 1).board, { n: 13, k: null });
  assert.deepEqual(generateBoard(5, 2).board, { n: 15, k: null });
  // 수준 맞추기의 작은 판은 1단계의 첫 판이다
  assert.deepEqual(generateBoard(1, 7, { small: true }), { level: 1, seed: 7, small: true, board: { n: 6, k: 2 } });
  assert.equal(generateBoard(2, 7, { small: true }).small, false);
});

test('판 번호 1~60: 같은 번호는 같은 판이고 규격에 맞다. 감아 보기와 짐작하고 감기는 여러 가닥인 판과 한 가닥인 판이 번갈아 나온다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    const rung = rungOf(level);
    const seen = new Set();
    for (const seed of SEEDS) {
      const { board } = generateBoard(level, seed);
      const where = `${level}단계 ${seed}번`;
      assert.equal(checkBoard(board), null, where);
      assert.deepEqual(generateBoard(level, seed).board, board, where);
      assert.ok(rung.pins.includes(board.n), where);
      seen.add(board.n);
      if (rung.mode === 'wind' || rung.mode === 'guess') {
        // 칸 수는 2부터 핀 수의 절반보다 작은 수까지
        assert.ok(board.k >= 2 && 2 * board.k < board.n, where);
        assert.equal(gcd(board.n, board.k) > 1, manyAt(seed), where);
        // 짐작의 단추(1~8가닥) 안에 답이 있다
        assert.ok(gcd(board.n, board.k) <= 8, where);
      } else {
        assert.equal(board.k, null, where);
      }
    }
    // 핀 수가 여러 가지로 나온다
    assert.ok(seen.size >= 3, `${level}단계: ${[...seen]}`);
  }
  // 맞히기: 어느 칸 수로도 한 가닥인 판과 그렇지 않은 판이 섞인다
  const kinds = SEEDS.map((seed) => onlyOneAndItself(generateBoard(5, seed).board.n));
  const ones = kinds.filter(Boolean).length;
  assert.ok(ones >= 20 && ones <= 40, `${ones}판`);
});

test('다음 판 번호는 방금 한 판과 같은 판을 건너뛴다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of SEEDS.slice(0, 20)) {
      const next = nextSeed(level, seed);
      assert.ok(next > seed);
      assert.ok(!sameBoard(generateBoard(level, next).board, generateBoard(level, seed).board), `${level}단계 ${seed}번`);
    }
  }
  assert.equal(nextSeed(MAKE_LEVEL, 3), 4);
});

test('더 작은 판: 핀이 더 적고 실 가닥 수가 같다(한 가닥의 핀 수는 줄고, 셋 이상이던 판은 셋 이상). 칸 수를 고르는 판은 같은 종류, 맞히기는 같은 꼴', () => {
  const check = (board, mode, where) => {
    const list = smallBoards({ mode, board });
    assert.ok(list.length <= 2, where);
    for (const small of list) {
      assert.equal(checkBoard(small), null, where);
      assert.ok(small.n < board.n && small.n >= MIN_PINS, where);
      if (board.k === null) {
        assert.equal(small.k, null, where);
        if (mode === 'predict') assert.equal(onlyOneAndItself(small.n), onlyOneAndItself(board.n), where);
        else assert.ok(small.n >= 6, where);
        continue;
      }
      const g = gcd(board.n, board.k);
      assert.equal(gcd(small.n, small.k), g, where);
      assert.ok(2 * small.k <= small.n, where);
      const per = board.n / g;
      const smallPer = small.n / g;
      assert.ok(smallPer < per && smallPer >= Math.min(3, per), where);
    }
    // 같은 판에는 같은 작은 판
    assert.deepEqual(smallBoards({ mode, board }), list, where);
    for (const turn of [0, 1, 2]) assert.deepEqual(smallerPins({ mode, board }, turn), list.length > 0 ? { board: list[turn % list.length] } : null, where);
    return list;
  };
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of SEEDS) {
      const { board } = generateBoard(level, seed);
      const list = check(board, rungOf(level).mode, `${level}단계 ${seed}번`);
      // 칸 수를 고르는 판에는 늘 작은 판이 있다(핀 6개부터, 맞히기의 핀 7개는 5개)
      if (board.k === null) assert.ok(list.length >= 1, `${level}단계 ${seed}번`);
    }
  }
  // 직접 만든 판(칸 수가 절반보다 클 수도 있다)
  for (let n = MIN_PINS; n <= MAX_PINS; n++) for (let k = 1; k < n; k++) check({ n, k }, 'made', `만든 판 ${n}, ${k}`);
  // 같은 칸 수가 먼저다: 핀 10개 4칸씩(2가닥, 핀 5개씩) → 핀 6개 2칸씩, 핀 8개 2칸씩
  assert.deepEqual(smallBoards({ mode: 'wind', board: { n: 10, k: 4 } }), [{ n: 6, k: 2 }, { n: 8, k: 2 }]);
  assert.deepEqual(smallBoards({ mode: 'wind', board: { n: 8, k: 3 } }), [{ n: 7, k: 3 }, { n: 5, k: 2 }]);
  // 첫 판(핀 6개, 2칸씩)과 한 가닥이 핀 둘을 오가는 판에는 작은 판이 없다
  assert.deepEqual(smallBoards({ mode: 'wind', board: { n: 6, k: 2 } }), []);
  assert.deepEqual(smallBoards({ mode: 'made', board: { n: 12, k: 6 } }), []);
  assert.equal(smallerPins({ mode: 'wind', board: { n: 6, k: 2 } }), null);
  assert.equal(smallerPins({ mode: 'wind', board: null }), null);
  assert.deepEqual(smallBoards({ mode: 'table', board: { n: 12, k: null } }), [{ n: 6, k: null }, { n: 8, k: null }]);
  assert.deepEqual(smallBoards({ mode: 'predict', board: { n: 13, k: null } }), [{ n: 5, k: null }, { n: 7, k: null }]);
  assert.deepEqual(choicesOf(5), [1, 2]);
});
