// 팬케이크 뒤집기의 사다리 점검: 단계마다 판이 잣대에 맞는지, 가장 적은 횟수를 다른 방법으로 다시 구해도 같은지 본다.
// 더 작은 판도 여기서 본다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LADDER, MAKE_LEVEL, SMALL_SIZE, TOP_LEVEL, generateBoard, goodBoard, nextSeed, recordMode, rungOf, smallBoards } from '../src/core/pancake-ladder.js';
import { checkBoard, fewestOf, isDone, sameBoard } from '../src/core/pancake.js';
import { smallerPancake } from '../src/core/smaller.js';
import { bruteBiggestFirst, bruteDone, bruteFewest, bruteReplay } from './helpers/brute-pancake.js';

const SEEDS = Array.from({ length: 40 }, (_, index) => index + 1);

test('사다리: 여섯 단계, 맨 위는 직접 만들기. 기본·기본·응용·응용·도전·도전', () => {
  assert.deepEqual(
    LADDER.map((rung) => [rung.level, rung.tag, rung.mode]),
    [
      [1, 'basic', 'small'],
      [2, 'basic', 'five'],
      [3, 'applied', 'fewest'],
      [4, 'applied', 'big'],
      [5, 'challenge', 'burnt'],
      [6, 'challenge', 'make'],
    ],
  );
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  assert.throws(() => generateBoard(6, 1));
  assert.throws(() => generateBoard(1, 0));
  assert.throws(() => rungOf(9));
  // 가장 적게 뒤집는 판(기록 깨기)은 3·4단계와 직접 만든 판이다. 첫 두 단계는 "가장 적게"를 걸지 않는다
  assert.deepEqual(['small', 'five', 'fewest', 'big', 'burnt', 'made'].filter(recordMode), ['fewest', 'big', 'made']);
});

test('단계마다 판 1~40번: 장 수, 가장 적은 횟수(다른 방법으로 다시 구한다), 단계의 잣대', () => {
  const spec = {
    1: { sizes: [3, 4], burnt: false, least: 2 },
    2: { sizes: [5], burnt: false, least: 4 },
    3: { sizes: [4, 5], burnt: false, least: 3 },
    4: { sizes: [6, 7], burnt: false, least: 5 },
    5: { sizes: [3, 4], burnt: true, least: 3, most: 6 },
  };
  for (let level = 1; level <= TOP_LEVEL; level++) {
    const rung = rungOf(level);
    const want = spec[level];
    for (const seed of SEEDS) {
      const made = generateBoard(level, seed);
      const { board } = made;
      const where = `${level}단계 ${seed}번`;
      assert.equal(checkBoard(board), null, where);
      assert.ok(want.sizes.includes(board.stack.length), where);
      assert.equal(board.up !== null, want.burnt, where);
      assert.equal(isDone(board), false, where);
      const brute = bruteFewest(board.stack, board.up);
      assert.equal(made.solution.fewest, brute.fewest, where);
      assert.equal(fewestOf(board), brute.fewest, where);
      assert.ok(brute.fewest >= want.least, where);
      if (want.most) assert.ok(brute.fewest <= want.most, where);
      // 가장 적게 뒤집는 단계: 큰 것부터 보내기로는 더 많이 걸린다(더 줄일 거리가 있다)
      if (rung.record) assert.ok(bruteBiggestFirst(board.stack).length > brute.fewest, where);
      assert.ok(goodBoard(rung, board), where);
      assert.deepEqual(generateBoard(level, seed), made, `${where}: 같은 번호는 같은 판`);
    }
  }
});

test('첫 판: 1단계는 세 장, 3단계는 네 장, 4단계는 여섯 장, 5단계는 세 장이다. 1단계의 작은 판은 세 장이다', () => {
  assert.equal(generateBoard(1, 1).board.stack.length, 3);
  assert.equal(generateBoard(3, 1).board.stack.length, 4);
  assert.equal(generateBoard(4, 1).board.stack.length, 6);
  assert.equal(generateBoard(5, 1).board.stack.length, 3);
  assert.equal(SMALL_SIZE, 3);
  for (const seed of SEEDS.slice(0, 10)) {
    const small = generateBoard(1, seed, { small: true });
    assert.equal(small.small, true);
    assert.equal(small.board.stack.length, 3);
    assert.equal(isDone(small.board), false);
  }
  // 작은 판은 맨 아래 단계에서만 낸다
  assert.equal(generateBoard(2, 1, { small: true }).small, false);
});

test('다음 번호는 방금 한 판과 다른 판이다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of SEEDS.slice(0, 15)) {
      const next = nextSeed(level, seed);
      assert.ok(next > seed);
      assert.equal(sameBoard(generateBoard(level, next).board, generateBoard(level, seed).board), false, `${level}단계 ${seed}번`);
    }
  }
  assert.equal(nextSeed(MAKE_LEVEL, 3), 4);
});

test('더 작은 판: 탄 면이 있는지가 같고 장 수가 적다(다섯 장까지 한 장, 여섯 장부터 두 장). 가장 적은 횟수는 둘 이상이고 원래 판보다 많지 않다', () => {
  let none = 0;
  for (let level = 1; level <= TOP_LEVEL; level++) {
    const rung = rungOf(level);
    for (const seed of SEEDS) {
      const { board } = generateBoard(level, seed);
      const origin = { mode: rung.mode, board };
      const n = board.stack.length;
      const burnt = board.up !== null;
      const from = fewestOf(board);
      for (const turn of [0, 1, 2, 3]) {
        const small = smallerPancake(origin, turn);
        const where = `${level}단계 ${seed}번 ${turn}번째`;
        if (!burnt && n <= 3) {
          assert.equal(small, null, where);
          none += turn === 0 ? 1 : 0;
          continue;
        }
        assert.ok(small, where);
        assert.equal(checkBoard(small.board), null, where);
        assert.equal(small.board.up !== null, burnt, where);
        assert.equal(small.board.stack.length, n - (n >= 6 ? 2 : 1), where);
        const brute = bruteFewest(small.board.stack, small.board.up);
        assert.ok(brute.fewest >= 2 && brute.fewest <= Math.max(2, from), where);
        assert.deepEqual(smallerPancake(origin, turn), small, `${where}: 같은 판에서는 같은 작은 판`);
      }
      const list = smallBoards(origin).yes;
      if (list.length === 2) assert.equal(sameBoard(list[0], list[1]), false);
    }
  }
  // 작은 판이 없는 것은 1단계의 세 장 판(1번)뿐이다
  assert.equal(none, 1);
  // 탄 면 두 장 판에는 없다. 맞지 않는 판에도 없다
  assert.equal(smallerPancake({ mode: 'burnt', board: { stack: [2, 1], up: [1, 0] } }), null);
  assert.equal(smallerPancake({ mode: 'small', board: { stack: [2, 2, 1], up: null } }), null);
  assert.equal(smallerPancake({ mode: 'small', board: null }), null);
  // 직접 만든 여덟 장 판은 여섯 장으로 줄인다
  const made = smallerPancake({ mode: 'made', board: { stack: [8, 7, 6, 5, 4, 3, 2, 1], up: null } });
  assert.equal(made.board.stack.length, 6);
});

test('풀이의 방법대로 뒤집으면 다 쌓인다(사다리의 판)', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of SEEDS.slice(0, 20)) {
      const { board, solution } = generateBoard(level, seed);
      const brute = bruteFewest(board.stack, board.up);
      const after = bruteReplay(board.stack, board.up, brute.path);
      assert.ok(bruteDone(after.stack, after.up));
      assert.equal(solution.possible, true);
    }
  }
});
