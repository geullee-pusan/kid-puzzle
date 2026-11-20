// 조각 가짓수 찾기의 사다리 점검: 단계마다 판 번호 1~100(작은 판도)이 그 단계의 조건에 맞고 다른 방법으로 다시 세어도 같은지,
// 맨 처음 판, 다음 판 번호, "더 작은 판"(같은 약속으로 칸이 하나, 둘 적은 조각)을 본다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SMALLER, smallerPieces } from '../src/core/smaller.js';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf } from '../src/core/pieces-ladder.js';
import { checkBoard, solve } from '../src/core/pieces.js';
import { bruteShapes, longestRun } from './helpers/brute-pieces.js';

const SEEDS = Array.from({ length: 100 }, (_, index) => index + 1);

/** 다른 방법으로 센 판의 가짓수 */
const bruteTotal = (board) => [...bruteShapes(board.n, board.rule).values()].filter((cells) => board.row === null || longestRun(cells) === board.row).length;

test('사다리: 여섯 단계, 맨 위는 직접 만들기, 단계마다 기본·응용·도전 표시', () => {
  assert.deepEqual(LADDER.map((rung) => rung.level), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(LADDER.map((rung) => rung.mode), ['find', 'find', 'find', 'find', 'find', 'make']);
  assert.deepEqual(LADDER.map((rung) => rung.tag), ['basic', 'applied', 'applied', 'applied', 'challenge', 'challenge']);
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  assert.throws(() => generateBoard(6, 1));
  assert.throws(() => generateBoard(1, 0));
  assert.throws(() => rungOf(9));
});

test('단계마다의 판: 가짓수가 다른 방법으로 센 것과 같다. 알려 주는 판과 짐작하는 판이 단계마다 정해져 있다', () => {
  const totals = {};
  for (const rung of LADDER.filter((item) => item.mode === 'find')) {
    for (const seed of SEEDS) {
      const { board, solution } = generateBoard(rung.level, seed);
      const where = `${rung.level}단계 ${seed}번`;
      assert.equal(checkBoard(board), null, where);
      assert.deepEqual(generateBoard(rung.level, seed).board, board, `${where}: 같은 번호는 같은 판`);
      assert.equal(solution.total, bruteTotal(board), where);
      totals[rung.level] = [...new Set([...(totals[rung.level] ?? []), solution.total])];
    }
  }
  assert.deepEqual(totals, { 1: [2, 5], 2: [12], 3: [7, 6], 4: [8, 3, 13], 5: [35] });
  // 1단계 첫 판은 세 칸(두 가지), 그다음은 네 칸(다섯 가지). 몇 가지인지 알려 준다
  assert.deepEqual(generateBoard(1, 1).board, { n: 3, rule: 'free', row: null, tell: true });
  assert.deepEqual(generateBoard(1, 2).board, { n: 4, rule: 'free', row: null, tell: true });
  // 2단계와 3단계는 먼저 짐작한다. 3단계는 약속을 바꾼다(뒤집으면 다른 조각, 돌려도 다른 조각)
  assert.equal(generateBoard(2, 1).board.tell, false);
  assert.deepEqual(rungOf(3).boards.map((board) => [board.n, board.rule, board.tell]), [
    [4, 'turn', false],
    [3, 'fixed', false],
  ]);
  // 약속을 바꾼 판은 돌리고 뒤집어 같은 것을 하나로 친 것보다 많다(일곱과 다섯, 여섯과 둘)
  assert.deepEqual(rungOf(3).boards.map((board) => [solve(board).total, solve(board).free]), [
    [7, 5],
    [6, 2],
  ]);
  // 4단계는 가장 긴 줄을 정한다. 5단계는 여섯 칸 서른다섯 가지
  assert.deepEqual(rungOf(4).boards.map((board) => [board.n, board.row]), [
    [5, 3],
    [6, 5],
    [6, 4],
  ]);
  assert.deepEqual(generateBoard(5, 7).board, { n: 6, rule: 'free', row: null, tell: true });
});

test('작은 판부터일 때: 같은 약속으로 칸이 하나 적은 조각이다(더 작은 판이 없으면 그 판 그대로)', () => {
  for (const rung of LADDER.filter((item) => item.mode === 'find')) {
    for (const seed of SEEDS.slice(0, 12)) {
      const big = generateBoard(rung.level, seed).board;
      const { board, solution } = generateBoard(rung.level, seed, { small: true });
      const where = `${rung.level}단계 ${seed}번 작은 판`;
      assert.equal(checkBoard(board), null, where);
      assert.equal(board.rule, big.rule, where);
      assert.equal(board.row, big.row, where);
      assert.equal(board.tell, big.tell, where);
      assert.ok(board.n === big.n - 1 || (board.n === big.n && smallerPieces({ board: big }) === null), where);
      assert.equal(solution.total, bruteTotal(board), where);
    }
  }
  assert.equal(generateBoard(1, 1, { small: true }).board.n, 3);
  assert.equal(generateBoard(5, 1, { small: true }).board.n, 5);
});

test('다음 판 번호는 방금 한 판과 다른 판을 낸다(판이 하나뿐인 단계는 그다음 번호다)', () => {
  for (const level of [1, 3, 4]) {
    for (const seed of [1, 2, 3, 10]) {
      const next = nextSeed(level, seed);
      assert.ok(next > seed);
      assert.notDeepEqual(generateBoard(level, next).board, generateBoard(level, seed).board, `${level}단계 ${seed}번`);
    }
  }
  assert.equal(nextSeed(2, 4), 5);
  assert.equal(nextSeed(5, 1), 2);
});

test('더 작은 판: 같은 약속과 줄로 칸이 하나, 둘 적은 조각을 차례로 낸다. 찾을 조각이 둘 이상이고, 없으면 null이다', () => {
  assert.equal(SMALLER.pieces, smallerPieces);
  for (const rung of LADDER.filter((item) => item.mode === 'find')) {
    for (const seed of SEEDS.slice(0, 6)) {
      const { board } = generateBoard(rung.level, seed);
      const origin = { mode: 'find', board };
      const turns = [0, 1, 2, 3].map((turn) => smallerPieces(origin, turn));
      if (turns[0] === null) {
        assert.ok(turns.every((item) => item === null));
        continue;
      }
      for (const small of turns) {
        assert.equal(checkBoard(small.board), null);
        assert.ok(small.board.n < board.n && small.board.n >= board.n - 2);
        assert.deepEqual([small.board.rule, small.board.row, small.board.tell], [board.rule, board.row, board.tell]);
        assert.ok(solve(small.board).total >= 2);
      }
      assert.equal(turns[0].board.n, board.n - 1);
      assert.deepEqual(smallerPieces(origin, 2), turns[2], '같은 판, 같은 차례에는 같은 작은 판');
    }
  }
  // 세 칸 조각(두 가지)과 가장 긴 줄이 다섯 칸인 여섯 칸 조각(세 가지)에는 더 작은 판이 없다
  assert.equal(smallerPieces({ mode: 'find', board: { n: 3, rule: 'free', row: null, tell: true } }), null);
  assert.equal(smallerPieces({ mode: 'find', board: { n: 6, rule: 'free', row: 5, tell: true } }), null);
  assert.equal(smallerPieces({ mode: 'find', board: null }), null);
  // 여섯 칸에서는 다섯 칸, 그다음 네 칸
  const six = { mode: 'find', board: { n: 6, rule: 'free', row: null, tell: true } };
  assert.deepEqual([0, 1, 2].map((turn) => smallerPieces(six, turn).board.n), [5, 4, 5]);
});
