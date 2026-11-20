// 성냥개비의 사다리 점검: 단계마다 판이 잣대에 맞는지, 할 일대로 되는 방법의 수를 다른 방법(다음 고르기, 부분 집합)으로 다시 센다.
// 더 작은 판도 여기서 본다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, goodBoard, nextSeed, rungOf, smallBoards } from '../src/core/matches-ladder.js';
import { checkBoard, countSquares, fullGrid, isDone, looseMatches, sameBoard, solve } from '../src/core/matches.js';
import { smallerMatches } from '../src/core/smaller.js';
import { bruteLoose, bruteSquares, comboCount, edgeName, subsetCount } from './helpers/brute-matches.js';

const SEEDS = Array.from({ length: 30 }, (_, index) => index + 1);
/** 다른 방법으로 센 답의 수(작은 모눈은 부분 집합, 3×3은 다음 고르기) */
const otherCount = (board) => (board.w * board.h <= 6 ? subsetCount(board) : comboCount(board).count);

test('사다리: 여섯 단계, 맨 위는 직접 만들기. 기본·기본·응용·응용·도전·도전', () => {
  assert.deepEqual(
    LADDER.map((rung) => [rung.level, rung.tag, rung.mode]),
    [
      [1, 'basic', 'little'],
      [2, 'basic', 'grid'],
      [3, 'applied', 'shift'],
      [4, 'applied', 'tidy'],
      [5, 'challenge', 'move'],
      [6, 'challenge', 'make'],
    ],
  );
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  assert.throws(() => generateBoard(6, 1));
  assert.throws(() => generateBoard(1, 0));
  assert.throws(() => rungOf(9));
});

test('1단계 1번 판(작은 판도 같다): 2×2 모눈을 다 채운 판에서 하나를 빼서 정사각형 3개. 어느 성냥을 빼도 된다', () => {
  for (const options of [{}, { small: true }]) {
    const { board } = generateBoard(1, 1, options);
    assert.deepEqual(board, { w: 2, h: 2, matches: fullGrid(2, 2), kind: 'remove', k: 1, n: 3, tidy: false });
  }
  const { board } = generateBoard(1, 1);
  assert.equal(bruteSquares(2, 2, board.matches).length, 5);
  for (const edge of board.matches) assert.equal(bruteSquares(2, 2, board.matches.filter((item) => item !== edge)).length, 3);
  assert.equal(solve(board).count, 12);
  assert.equal(generateBoard(1, 7, { small: true }).small, true);
  assert.equal(generateBoard(2, 7, { small: true }).small, false);
});

test('단계마다 판 1~30번: 모눈과 할 일이 단계와 같고, 할 일대로 되는 방법이 1~12가지이고(다른 방법으로 다시 센다), 빼기 판은 정사각형 수를 바꾸는 판이다', () => {
  const spec = {
    1: { kind: 'remove', tidy: false, sizes: ['2x2', '3x2'], ks: [1, 2] },
    2: { kind: 'remove', tidy: false, sizes: ['3x3'], ks: [2, 3, 4] },
    3: { kind: 'move', tidy: false, sizes: ['3x2', '3x3'], ks: [1, 2] },
    4: { kind: 'remove', tidy: true, sizes: ['3x3'], ks: [3, 4] },
    5: { kind: 'move', tidy: true, sizes: ['3x3'], ks: [2, 3] },
  };
  for (let level = 1; level <= TOP_LEVEL; level++) {
    const want = spec[level];
    const seen = new Set();
    for (const seed of SEEDS) {
      const { board } = generateBoard(level, seed);
      const label = `${level}단계 ${seed}번`;
      assert.equal(checkBoard(board), null, label);
      assert.equal(board.kind, want.kind, label);
      assert.equal(board.tidy, want.tidy, label);
      // 옮기기 판은 그 단계의 모눈 그대로, 빼기 판은 성냥을 둘러싼 모눈으로 줄여서 그 단계의 모눈 안에 든다
      const inside = want.sizes.some((size) => {
        const [w, h] = size.split('x').map(Number);
        return board.kind === 'move' ? board.w === w && board.h === h : board.w <= w && board.h <= h;
      });
      assert.ok(inside, label);
      if (board.kind === 'remove') {
        // 줄인 모눈의 네 가장자리에 모두 성냥이 닿는다
        const names = board.matches.map((edge) => edgeName(board.w, board.h, edge));
        assert.ok(names.some((name) => name.startsWith('가로') && name.endsWith(',0')), label);
        assert.ok(names.some((name) => name.startsWith('가로') && name.endsWith(`,${board.h}`)), label);
        assert.ok(names.some((name) => name.startsWith('세로 0,')), label);
        assert.ok(names.some((name) => name.startsWith(`세로 ${board.w},`)), label);
      }
      assert.ok(want.ks.includes(board.k), label);
      // 처음 모습은 칸들의 테두리라 모든 성냥이 어느 정사각형의 변이다
      assert.equal(bruteLoose(board.w, board.h, board.matches), 0, label);
      const now = bruteSquares(board.w, board.h, board.matches).length;
      assert.ok(board.n >= 1 && (board.kind === 'move' || board.n !== now), label);
      const result = solve(board);
      if (!(level === 1 && seed === 1)) assert.ok(result.count >= 1 && result.count <= 12, `${label}: ${result.count}`);
      if (seed <= 12 || board.kind === 'remove') assert.equal(result.count, otherCount(board), label);
      for (const example of result.examples) assert.equal(isDone(board, example.matches), true, label);
      if (seed > 1) assert.equal(goodBoard(rungOf(level).spec, board), true, label);
      seen.add(JSON.stringify(board));
    }
    // 같은 판만 되풀이하지 않는다
    assert.ok(seen.size >= 15, `${level}단계: ${seen.size}`);
  }
});

test('같은 번호는 늘 같은 판이고, 다음 판 번호는 방금 한 판과 다른 판이다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of [1, 2, 3, 9]) {
      assert.deepEqual(generateBoard(level, seed).board, generateBoard(level, seed).board);
      const next = nextSeed(level, seed);
      assert.ok(next > seed);
      assert.equal(sameBoard(generateBoard(level, next).board, generateBoard(level, seed).board), false);
    }
  }
});

test('더 작은 판: 같은 할 일(빼기·옮기기, 약속)의 더 작은 모눈이고, 빼거나 옮길 수가 원래 판보다 많지 않고, 할 일대로 되는 판이다. 2×2 판에는 없다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const { board } = generateBoard(level, seed);
      const { yes, no } = smallBoards({ mode: rungOf(level).mode, board });
      assert.deepEqual(no, []);
      if (board.w * board.h <= 4) {
        assert.equal(yes.length, 0);
        assert.equal(smallerMatches({ mode: rungOf(level).mode, board }), null);
        continue;
      }
      assert.ok(yes.length >= 1, `${level}단계 ${seed}번`);
      for (const small of yes) {
        assert.equal(checkBoard(small), null);
        assert.ok(small.w * small.h < board.w * board.h);
        assert.equal(small.kind, board.kind);
        assert.equal(small.tidy, board.tidy);
        assert.ok(small.k <= board.k);
        assert.equal(looseMatches(small.w, small.h, small.matches).length, 0);
        if (small.kind === 'remove') assert.notEqual(small.n, countSquares(small.w, small.h, small.matches));
        const count = subsetCount(small);
        assert.ok(count >= 1 && count <= 12, `${level}단계 ${seed}번: ${count}`);
      }
      const first = smallerMatches({ mode: rungOf(level).mode, board }, 0);
      assert.deepEqual(first.board, yes[0]);
    }
  }
});
