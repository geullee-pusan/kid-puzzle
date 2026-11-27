// 조건 맞춰 잇기의 사다리 점검: 단계마다 판의 종류, 안 되는 판의 비율과 까닭, 처음 판, 다음 판 번호, 더 작은 판.
// 판마다 되는지는 모든 선 묶음을 해 보는 방법(점 7개까지)이나 에르되시-갈라이 조건(점 8개)으로도 따진다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, impossibleAt, isForcedBoard, isSearchBoard, nextSeed, rungOf, smallBoards } from '../src/core/degree-ladder.js';
import { caseTree, casesNow, checkBoard, partnersOf, plainReasons, solve } from '../src/core/degree.js';
import { smallerDegree } from '../src/core/smaller.js';
import { bruteOk, erdosGallai } from './helpers/brute-degree.js';

const SEEDS = Array.from({ length: 120 }, (_, at) => at + 1);
/** 다른 방법으로 되는지 */
const otherOk = (need) => (need.length <= 7 ? bruteOk(need) : erdosGallai(need));

test('사다리: 여섯 단계, 맨 위는 직접 만들기. 단계마다 기본·응용·도전', () => {
  assert.deepEqual(
    LADDER.map((rung) => [rung.level, rung.tag, rung.mode]),
    [
      [1, 'basic', 'three'],
      [2, 'basic', 'mixed'],
      [3, 'applied', 'parity'],
      [4, 'applied', 'big'],
      [5, 'challenge', 'search'],
      [6, 'challenge', 'make'],
    ],
  );
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  assert.throws(() => rungOf(7));
  assert.throws(() => generateBoard(6, 1));
  assert.throws(() => generateBoard(1, 0));
});

test('처음 판: 1단계 첫 판은 점 넷이 모두 셋씩(되는 판), 판 번호 2는 아주 쉬운 안 되는 판이다', () => {
  assert.deepEqual(generateBoard(1, 1).board.need, [3, 3, 3, 3]);
  assert.deepEqual(generateBoard(1, 2).board.need, [3, 3, 3, 3, 3]);
  assert.deepEqual(generateBoard(1, 1, { small: true }).board.need, [3, 3, 3, 3]);
  assert.equal(generateBoard(1, 9, { small: true }).small, true);
  assert.equal(generateBoard(2, 9, { small: true }).small, false);
  assert.deepEqual(generateBoard(3, 2).board.need, [2, 2, 1, 2, 2]);
  assert.deepEqual(generateBoard(4, 2).board.need, [4, 2, 1, 1]);
  assert.deepEqual(generateBoard(5, 2).board.need, [3, 1, 3, 1]);
  for (const level of [1, 2, 3, 4, 5]) assert.equal(solve(generateBoard(level, 1).board).possible, true, `${level}`);
  for (const level of [1, 3, 4, 5]) assert.equal(solve(generateBoard(level, 2).board).possible, false, `${level}`);
});

test('단계마다의 판: 안 되는 판은 셋에 하나이고 까닭이 단계의 것 하나뿐이다. 다른 방법으로 따져도 같다', () => {
  const expected = { three: 'odd', parity: 'odd', big: 'big', search: 'search' };
  for (const rung of LADDER.filter((item) => item.mode !== 'make')) {
    let impossible = 0;
    for (const seed of SEEDS) {
      const { board } = generateBoard(rung.level, seed);
      const { need } = board;
      assert.equal(checkBoard(board), null);
      const result = solve(board);
      assert.equal(result.possible, otherOk(need), `${rung.mode} ${seed}: ${need}`);
      const no = rung.mode !== 'mixed' && impossibleAt(seed);
      assert.equal(result.possible, !no, `${rung.mode} ${seed}: ${need}`);
      if (no) {
        impossible += 1;
        assert.equal(result.reason, expected[rung.mode], `${rung.mode} ${seed}: ${need}`);
        assert.ok(plainReasons(need).length <= 1);
      }
      // 단계마다 점의 수와 수의 범위
      if (rung.mode === 'three') {
        assert.ok(need.every((value) => value === 3));
        assert.ok(need.length >= 4 && need.length <= 8);
      } else {
        assert.ok(need.length >= 4 && need.length <= (rung.mode === 'parity' ? 7 : 6), `${need}`);
        assert.ok(new Set(need).size > 1, `${need}`);
      }
      if (rung.mode === 'mixed' || rung.mode === 'parity') assert.ok(need.every((value) => value >= 1 && value <= 4));
      if (rung.mode === 'search') {
        // 모든 경우 펼쳐 보기와 함께 내는 판: 안 되는 판은 모든 경우가 한 줄기, 되는 판은 가장 큰 수의 점이 이을 점과 모두 이어야 한다
        assert.equal(casesNow(need, []).ways.length, 1, `${need}`);
        if (no) assert.equal(caseTree(need).leaves.length, 1);
        else {
          const top = Math.max(...need);
          assert.equal(top, partnersOf(need, need.indexOf(top)));
          assert.ok(top >= 3);
        }
        assert.ok(need.filter((value) => value === 0).length <= 1);
      }
      if (rung.mode === 'big' && no) assert.deepEqual(plainReasons(need), ['big']);
    }
    if (rung.mode !== 'mixed') assert.equal(impossible, SEEDS.filter(impossibleAt).length);
  }
  assert.equal(isSearchBoard([3, 1, 3, 1]), true);
  assert.equal(isSearchBoard([3, 3, 3, 3, 3]), false);
  assert.equal(isForcedBoard([3, 2, 3, 2]), true);
  assert.equal(isForcedBoard([2, 2, 2, 2]), false);
});

test('같은 번호는 늘 같은 판이다. 다음 판 번호는 방금 한 판과 같은 판을 건너뛴다', () => {
  for (const rung of LADDER.filter((item) => item.mode !== 'make')) {
    for (const seed of SEEDS.slice(0, 40)) {
      assert.deepEqual(generateBoard(rung.level, seed), generateBoard(rung.level, seed));
      const next = nextSeed(rung.level, seed);
      assert.ok(next > seed);
      assert.notDeepEqual(generateBoard(rung.level, next).board.need, generateBoard(rung.level, seed).board.need);
    }
  }
  assert.equal(nextSeed(6, 3), 4);
});

test('더 작은 판: 점이 더 적은 같은 종류의 판. 되는 판에서는 되는 판만, 안 되는 판에서는 되는 판부터 까닭이 같은 판과 번갈아', () => {
  for (const rung of LADDER.filter((item) => item.mode !== 'make')) {
    for (const seed of SEEDS.slice(0, 30)) {
      const { board } = generateBoard(rung.level, seed);
      const origin = { mode: rung.mode, board };
      const lists = smallBoards(origin);
      const reason = solve(board).reason;
      for (const small of lists.yes) {
        assert.ok(small.need.length < board.need.length);
        assert.equal(solve(small).possible, true);
        assert.equal(bruteOk(small.need), true);
      }
      for (const small of lists.no) {
        assert.ok(small.need.length < board.need.length);
        assert.equal(solve(small).reason, reason, `${board.need} → ${small.need}`);
      }
      if (reason === null) assert.equal(lists.no.length, 0);
      const first = smallerDegree(origin, 0);
      if (first) assert.equal(solve(first.board).possible, true);
      if (board.need.length <= 4) assert.equal(first, null);
    }
  }
  // 모두 셋씩: 점 일곱(안 되는 판)에서는 점 여섯, 다섯, 넷
  assert.deepEqual(smallerDegree({ mode: 'three', board: { need: [3, 3, 3, 3, 3, 3, 3] } }, 0).board.need, [3, 3, 3, 3, 3, 3]);
  assert.deepEqual(smallerDegree({ mode: 'three', board: { need: [3, 3, 3, 3, 3, 3, 3] } }, 1).board.need, [3, 3, 3, 3, 3]);
  // 직접 만든 판: 까닭이 같은 판
  const made = { mode: 'made', board: { need: [4, 1, 4, 1, 1, 1] } };
  assert.equal(solve(made.board).reason, 'search');
  assert.ok(smallBoards(made).no.every((small) => solve(small).reason === 'search'));
  assert.equal(smallerDegree({ mode: 'made', board: { need: [0, 0, 0] } }), null);
});
