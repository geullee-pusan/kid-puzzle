// 질문으로 맞히기의 사다리: 단계마다 판의 꼴, 첫 판, 안 되는 판의 비율, 다음 판 번호, 더 작은 판.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AHEAD_BOARDS, FREE_NS, LADDER, LIMIT_NS, MAKE_LEVEL, PICK_NS, TOP_LEVEL, generateBoard, maybeImpossible, nextSeed, possibleOf, rungOf, smallBoards } from '../src/core/yesno-ladder.js';
import { canPin, canPrepare, checkBoard, fewestFor, solve } from '../src/core/yesno.js';
import { smallerYesno } from '../src/core/smaller.js';
import { bruteWin, twoTimes } from './helpers/brute-yesno.js';

const SEEDS = Array.from({ length: 150 }, (_, at) => at + 1);

test('사다리: 다섯 단계와 직접 만들기, 기본·응용·도전', () => {
  assert.deepEqual(LADDER.map((rung) => [rung.level, rung.tag, rung.mode]), [
    [1, 'basic', 'free'],
    [2, 'basic', 'limit'],
    [3, 'applied', 'pick'],
    [4, 'applied', 'maybe'],
    [5, 'challenge', 'ahead'],
    [6, 'challenge', 'make'],
  ]);
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  assert.throws(() => rungOf(7));
  assert.throws(() => generateBoard(6, 1));
  assert.throws(() => generateBoard(1, 0));
});

test('첫 판: 1부터 8까지(정하지 않음), 1부터 8까지 질문 3번, 1부터 6까지(질문 수를 정한다), 1부터 3까지 질문 1번(아주 쉬운 안 되는 판), 미리 정하는 1부터 8까지 질문 3개', () => {
  const first = (level) => {
    const { board } = generateBoard(level, 1);
    return [board.kind, board.n, board.q];
  };
  assert.deepEqual([1, 2, 3, 4, 5].map(first), [
    ['ask', 8, null],
    ['ask', 8, 3],
    ['ask', 6, null],
    ['ask', 3, 1],
    ['ahead', 8, 3],
  ]);
  // 1부터 3까지는 질문 1번으로 맞힐 수 없다(모든 묶음을 해 보는 다른 방법으로)
  assert.equal(bruteWin(3, 1), false);
  // 작은 판(수준 맞추기): 1단계에서만 1부터 4까지
  assert.deepEqual(generateBoard(1, 9, { small: true }).board.n, 4);
  assert.equal(generateBoard(1, 9, { small: true }).small, true);
  assert.equal(generateBoard(2, 9, { small: true }).small, false);
});

test('판 번호 1~150: 단계마다 판의 꼴이 맞고, 같은 번호는 늘 같은 판이다', () => {
  const counts = { possible: 0, impossible: 0 };
  for (const level of [1, 2, 3, 4, 5]) {
    const { mode } = rungOf(level);
    for (const seed of SEEDS) {
      const { board } = generateBoard(level, seed);
      const where = `${level}단계 ${seed}번`;
      assert.equal(checkBoard(board), null, where);
      assert.deepEqual(generateBoard(level, seed).board, board, where);
      if (mode === 'free') {
        assert.equal(board.q, null, where);
        assert.ok(seed === 1 || FREE_NS.includes(board.n), where);
      }
      if (mode === 'limit') {
        // 질문 수는 가장 적은 질문 수와 같다: 늘 되는 판이고 여유가 없다
        assert.equal(board.q, fewestFor(board.n), where);
        assert.ok(seed === 1 || LIMIT_NS.includes(board.n), where);
        assert.equal(canPin(board.n, board.q) && !canPin(board.n, board.q - 1), true, where);
      }
      if (mode === 'pick') {
        assert.equal(board.q, null, where);
        assert.ok(seed === 1 || PICK_NS.includes(board.n), where);
      }
      if (mode === 'maybe') {
        const possible = solve(board).possible;
        assert.equal(possible, !maybeImpossible(seed), where);
        assert.equal(possible, board.n <= twoTimes(board.q), where);
        // 안 되는 판은 질문이 하나만 더 있으면 되는 판이고, 되는 판은 질문이 하나 적으면 안 되는 판이다(아슬아슬한 판)
        if (possible) assert.equal(canPin(board.n, board.q - 1), false, where);
        else assert.equal(canPin(board.n, board.q + 1), true, where);
        counts[possible ? 'possible' : 'impossible'] += 1;
      }
      if (mode === 'ahead') {
        assert.equal(board.kind, 'ahead', where);
        assert.ok(seed === 1 || AHEAD_BOARDS.some(([n, q]) => n === board.n && q === board.q), where);
        assert.equal(canPrepare(board.n, board.q), true, where);
      } else assert.equal(board.kind, 'ask', where);
    }
  }
  // 언제나 맞힐 수 있을까: 셋에 하나가 안 되는 판
  assert.equal(counts.impossible, 50);
  assert.equal(counts.possible, 100);
});

test('다음 판 번호: 방금 한 판과 같은 판(끝과 질문 수가 같은 판)은 건너뛴다', () => {
  for (const level of [1, 2, 3, 4, 5]) {
    for (const seed of SEEDS.slice(0, 60)) {
      const next = nextSeed(level, seed);
      assert.ok(next > seed);
      const a = generateBoard(level, seed).board;
      const b = generateBoard(level, next).board;
      assert.ok(a.n !== b.n || a.q !== b.q || a.kind !== b.kind, `${level}단계 ${seed}번`);
    }
  }
  assert.equal(nextSeed(6, 3), 4);
});

test('더 작은 판: 끝이 더 작고 같은 종류의 판. 되는 판에서는 되는 판만, 안 되는 판에서는 되는 판부터 번갈아 낸다', () => {
  let none = 0;
  for (const level of [1, 2, 3, 4, 5]) {
    const { mode } = rungOf(level);
    for (const seed of SEEDS.slice(0, 80)) {
      const { board } = generateBoard(level, seed);
      const origin = { mode, board };
      const from = possibleOf(board);
      for (const turn of [0, 1, 2, 3]) {
        const small = smallerYesno(origin, turn);
        const where = `${level}단계 ${seed}번 ${turn}번째`;
        if (small === null) {
          none += 1;
          continue;
        }
        assert.equal(checkBoard(small.board), null, where);
        assert.equal(small.board.kind, board.kind, where);
        assert.ok(small.board.n < board.n && small.board.n >= 2, where);
        assert.equal(small.board.q === null, board.q === null, where);
        if (board.q !== null) assert.ok(small.board.q <= board.q, where);
        const possible = possibleOf(small.board);
        assert.equal(possible, solve(small.board).possible, where);
        if (from || turn % 2 === 0) assert.equal(possible, true, where);
        if (mode === 'limit') assert.equal(small.board.q, fewestFor(small.board.n), where);
        assert.deepEqual(smallerYesno(origin, turn), small, where);
      }
    }
  }
  // 가장 작은 판(1부터 2까지)에는 더 작은 판이 없다
  assert.equal(smallerYesno({ mode: 'maybe', board: { kind: 'ask', n: 2, q: 1, tie: 0 } }), null);
  assert.equal(smallerYesno({ mode: 'free', board: { kind: 'ask', n: 2, q: null, tie: 0 } }), null);
  assert.equal(smallerYesno({ mode: 'free', board: null }), null);
  assert.ok(none < 40, `없는 판 ${none}개`);
  // 안 되는 판(1부터 9까지 질문 3번)의 작은 판: 1부터 4까지 질문 2번(되는 판), 1부터 5까지 질문 2번(안 되는 판), …
  const lists = smallBoards({ mode: 'maybe', board: { kind: 'ask', n: 9, q: 3, tie: 0 } });
  assert.deepEqual(lists.yes.map((item) => [item.n, item.q]), [[4, 2], [3, 2]]);
  assert.deepEqual(lists.no.map((item) => [item.n, item.q]), [[5, 2], [6, 2]]);
  assert.equal(solve(smallerYesno({ mode: 'maybe', board: { kind: 'ask', n: 9, q: 3, tie: 0 } }, 1).board).possible, false);
});
