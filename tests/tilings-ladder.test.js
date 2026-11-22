// 도미노 깔기 모두 찾기의 사다리와 판 내기, 더 작은 판: 단계마다 판, 덮을 수 없는 판의 차례와 보이는 까닭(칸 수), 작은 판을 본다.
// 덮는 방법의 수는 풀이 프로그램과 다른 방법(tests/helpers/brute-tilings.js)으로 다시 따진다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, impossibleAt, nextSeed, rungOf, smallBoards } from '../src/core/tilings-ladder.js';
import { checkBoard, keysOf, openCount, sameBoard, solve, stairs, strip } from '../src/core/tilings.js';
import { smallerTilings } from '../src/core/smaller.js';
import { bruteClimbs, bruteCoverings } from './helpers/brute-tilings.js';

const SEEDS = Array.from({ length: 36 }, (_, index) => index + 1);
/** 다른 방법으로 센 덮는(오르는) 방법의 수 */
const bruteOf = (board) => (board.shape === 'stairs' ? bruteClimbs(board.w).length : bruteCoverings(board.h, board.w, board.holes).length);

test('사다리: 여섯 단계, 표시는 기본·기본·응용·응용·도전·도전, 맨 위는 직접 만들기', () => {
  assert.deepEqual(LADDER.map((rung) => rung.level), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(LADDER.map((rung) => rung.tag), ['basic', 'basic', 'applied', 'applied', 'challenge', 'challenge']);
  assert.deepEqual(LADDER.map((rung) => rung.mode), ['count', 'guess', 'table', 'stairs', 'three', 'make']);
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  assert.throws(() => generateBoard(6, 1));
  assert.throws(() => generateBoard(1, 0));
  assert.throws(() => rungOf(9));
});

test('판 번호 1~36: 같은 번호는 같은 판, 규격에 맞고 단계의 판이다. 덮는 방법의 수는 다른 방법으로 센 것과 같다', () => {
  const seen = new Map();
  for (let level = 1; level <= TOP_LEVEL; level++) {
    const rung = rungOf(level);
    for (const seed of SEEDS) {
      const { board } = generateBoard(level, seed);
      const where = `${level}단계 ${seed}번 ${JSON.stringify(board)}`;
      assert.equal(checkBoard(board), null, where);
      assert.deepEqual(generateBoard(level, seed).board, board, where);
      const found = solve(board);
      if (board.table) {
        assert.deepEqual(found.counts, [1, 2, 3, 4, 5, 6, 7, 8].map((w) => bruteCoverings(2, w).length), where);
      } else assert.equal(found.count, bruteOf(board), where);
      if (rung.mode === 'count') assert.ok(board.shape === 'strip' && board.h === 2 && [2, 3].includes(board.w) && !board.guess, where);
      if (rung.mode === 'guess') assert.ok(board.shape === 'strip' && board.h === 2 && [4, 5].includes(board.w) && board.guess, where);
      if (rung.mode === 'table') assert.ok(board.table && board.w === 6, where);
      if (rung.mode === 'stairs') assert.ok(board.shape === 'stairs' && board.w >= 3 && board.w <= 6, where);
      if (rung.mode === 'three') {
        assert.ok(board.shape === 'strip' && board.h === 3 && board.w <= 6, where);
        // 덮을 수 없는 판은 칸이 홀수 개인 판뿐이다(판 아래의 칸 수로 보인다)
        assert.equal(found.count === 0, openCount(board) % 2 === 1, where);
        assert.equal(found.count === 0, impossibleAt(rung, seed), where);
      } else assert.ok(found.count === null || found.count > 0, where);
      assert.equal(board.holes.length, 0, where);
      seen.set(`${level}:${JSON.stringify(board)}`, true);
    }
  }
  // 단계마다 나오는 판의 가짓수
  const kinds = (level) => [...seen.keys()].filter((key) => key.startsWith(`${level}:`)).length;
  assert.deepEqual([1, 2, 3, 4, 5].map(kinds), [2, 2, 1, 4, 6]);
});

test('세 줄 판: 덮을 수 없는 판은 여섯 판에 둘이고 연달아 나오지 않는다. 처음 만나는 덮을 수 없는 판은 칸이 3개인 3×1이다', () => {
  const rung = rungOf(5);
  const pattern = SEEDS.map((seed) => solve(generateBoard(5, seed).board).count === 0);
  assert.equal(pattern[0], false);
  for (let at = 0; at < SEEDS.length; at += 6) assert.equal(pattern.slice(at, at + 6).filter(Boolean).length, 2);
  for (let at = 1; at < SEEDS.length; at++) assert.ok(!(pattern[at] && pattern[at - 1]), `${at + 1}번`);
  assert.deepEqual(generateBoard(5, 2).board, strip(3, 1));
  assert.ok(impossibleAt(rung, 2));
  assert.deepEqual(new Set(SEEDS.map((seed) => generateBoard(5, seed).board.w)), new Set([1, 2, 3, 4, 5, 6]));
  // 다른 단계에는 덮을 수 없는 판이 없다
  for (const level of [1, 2, 3, 4]) assert.ok(!impossibleAt(rungOf(level), 2));
});

test('정해 둔 판: 첫 판은 2×2, 짐작하는 판은 2×4부터, 표 만들기는 2×6까지, 계단은 4칸부터', () => {
  assert.deepEqual(generateBoard(1, 1).board, strip(2, 2));
  assert.deepEqual(generateBoard(1, 2).board, strip(2, 3));
  assert.deepEqual(generateBoard(1, 7, { small: true }).board, strip(2, 2));
  assert.equal(generateBoard(1, 7, { small: true }).small, true);
  assert.deepEqual(generateBoard(2, 1).board, strip(2, 4, { guess: true }));
  assert.deepEqual(generateBoard(3, 5).board, strip(2, 6, { table: true }));
  assert.deepEqual(generateBoard(4, 1).board, stairs(4));
  assert.deepEqual(generateBoard(5, 1).board, strip(3, 2));
});

test('다음 판 번호는 방금 한 판과 같은 판을 건너뛴다(판이 하나뿐인 표 만들기는 그냥 다음 번호)', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of SEEDS.slice(0, 24)) {
      const next = nextSeed(level, seed);
      assert.ok(next > seed);
      if (level === 3) assert.equal(next, seed + 1);
      else assert.ok(!sameBoard(generateBoard(level, next).board, generateBoard(level, seed).board));
    }
  }
  assert.equal(nextSeed(MAKE_LEVEL, 4), 5);
});

test('더 작은 판: 같은 줄 수의 짧은 띠(덮는 방법이 더 적다), 칸이 적은 계단. 덮을 수 없는 판에서는 덮을 수 있는 판부터 번갈아 낸다', () => {
  const check = (origin, where) => {
    const base = origin.board.table ? strip(2, origin.size) : origin.board;
    const from = bruteOf(base);
    const turns = [0, 1, 2, 3].map((turn) => smallerTilings(origin, turn));
    if (turns[0] === null) return false;
    for (const [turn, small] of turns.entries()) {
      const s = small.board;
      const at = `${where} → ${JSON.stringify(s)}`;
      assert.equal(checkBoard(s), null, at);
      assert.equal(s.shape, base.shape, at);
      assert.equal(s.h, base.h, at);
      assert.ok(s.w < base.w, at);
      assert.ok(!s.guess && !s.table, at);
      const count = bruteOf(s);
      if (from > 0) assert.ok(count > 0 && count < from, at);
      else if (turn % 2 === 0) assert.ok(count > 0, at);
      else assert.equal(count, 0, at);
    }
    assert.deepEqual(smallerTilings(origin, 2), smallerTilings(origin, 2));
    return true;
  };
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of SEEDS.slice(0, 12)) {
      const { board } = generateBoard(level, seed);
      if (board.table) for (let size = 1; size <= 6; size++) assert.equal(check({ mode: 'table', board, size }, `표 ${size}`), size > 1);
      else check({ mode: rungOf(level).mode, board }, `${level}단계 ${seed}번`);
    }
  }
  // 더 줄일 수 없는 판
  for (const board of [strip(2, 1), strip(3, 1), strip(3, 2), stairs(1)]) assert.equal(smallerTilings({ mode: 'x', board }, 0), null);
  // 3×5(0가지): 3×4(11가지)부터, 그다음 3×3(0가지)
  assert.deepEqual(smallerTilings({ mode: 'three', board: strip(3, 5) }, 0).board, strip(3, 4));
  assert.deepEqual(smallerTilings({ mode: 'three', board: strip(3, 5) }, 1).board, strip(3, 3));
  // 칸이 빠진 직접 만든 판: 오른쪽 열을 떼면 그 열의 빠진 칸은 없어진다. 덮을 수 있는 판에서 짧은 띠가 모두 0가지면 없다
  assert.equal(smallerTilings({ mode: 'made', board: strip(2, 4, { holes: [0, 3] }) }, 0), null);
  const lists = smallBoards({ board: strip(2, 4, { holes: [7] }) });
  assert.deepEqual(lists, { yes: [strip(2, 3), strip(2, 2)], no: [] });
  assert.deepEqual(smallBoards({ board: strip(3, 4, { holes: [0, 11] }) }).yes, [strip(3, 3, { holes: [0] }), strip(3, 2, { holes: [0] })].filter((small) => keysOf(small).length > 0));
});
