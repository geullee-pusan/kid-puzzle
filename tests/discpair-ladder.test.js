// 원판 둘씩 옮기기의 사다리와 판 내기, 더 작은 판: 단계마다 칸 수와 원판 수, 되는 판과 안 되는 판의 차례, 안 되는 판의 까닭을 아이가 볼 수 있는지 본다.
// 되는지와 가장 적은 수는 원판마다 옮겨 보는 다른 방법(tests/helpers/brute-discpair.js)으로 다시 따진다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, impossibleAt, kindOf, nextSeed, oddTrap, rungOf, smallBoards } from '../src/core/discpair-ladder.js';
import { boardKey, checkBoard, isGathered, shapeCounts, solve, totalOf } from '../src/core/discpair.js';
import { smallerDiscpair } from '../src/core/smaller.js';
import { bruteTable } from './helpers/brute-discpair.js';

const SEEDS = Array.from({ length: 60 }, (_, index) => index + 1);
/** (칸 수, 원판 수)마다 다른 방법으로 구한 표(한 번만 만든다) */
const tables = new Map();
function bruteOf(board) {
  const key = `${board.n}:${totalOf(board.piles)}`;
  if (!tables.has(key)) tables.set(key, bruteTable(board.n, totalOf(board.piles)));
  return tables.get(key)(board.piles);
}

test('사다리: 여섯 단계, 표시는 기본·기본·응용·응용·도전·도전, 맨 위는 직접 만들기', () => {
  assert.deepEqual(LADDER.map((rung) => rung.level), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(LADDER.map((rung) => rung.tag), ['basic', 'basic', 'applied', 'applied', 'challenge', 'challenge']);
  assert.deepEqual(LADDER.map((rung) => rung.mode), ['gather', 'four', 'six', 'odd', 'big', 'make']);
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  assert.throws(() => generateBoard(6, 1));
  assert.throws(() => generateBoard(1, 0));
  assert.throws(() => rungOf(9));
});

test('판 번호 1~60: 같은 번호는 같은 판, 규격에 맞고, 이미 모인 판이 없다. 되는지와 가장 적은 수는 다른 방법으로 구한 것과 같고 단계의 범위 안이다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    const rung = rungOf(level);
    for (const seed of SEEDS) {
      const { board } = generateBoard(level, seed);
      const where = `${level}단계 ${seed}번 ${boardKey(board)}`;
      assert.equal(checkBoard(board), null, where);
      assert.deepEqual(generateBoard(level, seed).board, board, where);
      assert.ok(!isGathered(board.piles), where);
      const found = solve(board);
      assert.equal(found.min, bruteOf(board), where);
      assert.equal(found.possible, !impossibleAt(rung, seed), where);
      const total = totalOf(board.piles);
      if (!found.possible) {
        // 안 되는 판: 칸 수와 원판 수가 짝수이고 동그라미 칸의 원판이 홀수 개다("색 켜기"로 보인다)
        assert.ok(rung.no.cells.includes(board.n), where);
        assert.ok(rung.no.totals.includes(total), where);
        assert.equal(shapeCounts(board.piles).circle % 2, 1, where);
        continue;
      }
      // 처음 고정해 둔 판 말고는 단계의 원판 수와 가장 적은 수의 범위 안이다
      if (!(level === 1 && seed === 1)) {
        assert.ok(total >= rung.totals[0] && total <= rung.totals[1], where);
        assert.ok(found.min >= rung.min[0] && found.min <= rung.min[1], `${where}: ${found.min}번`);
      }
      if (rung.mode === 'odd') {
        // 4단계: 여섯 판에 하나는 여섯 칸 고리, 나머지는 짝수 칸 고리라면 안 되는 모습의 홀수 칸 고리
        if ((seed - 1) % 6 === 3) assert.equal(board.n, 6, where);
        else assert.ok(oddTrap(board), where);
      } else assert.ok(rung.cells.includes(board.n), where);
    }
  }
});

test('안 되는 판은 여섯 판에 둘이고 연달아 나오지 않는다. 처음 만나는 판은 되는 판이다. 1단계에는 안 되는 판이 없다', () => {
  for (const rung of LADDER.filter((item) => item.mode !== 'make')) {
    const pattern = SEEDS.map((seed) => !solve(generateBoard(rung.level, seed).board).possible);
    if (rung.mode === 'gather') {
      assert.ok(pattern.every((no) => !no));
      continue;
    }
    assert.equal(pattern[0], false);
    for (let at = 0; at < 60; at += 6) assert.equal(pattern.slice(at, at + 6).filter(Boolean).length, 2);
    for (let at = 1; at < 60; at++) assert.ok(!(pattern[at] && pattern[at - 1]), `${rung.level}단계 ${at + 1}번`);
  }
});

test('정해 둔 판: 첫 판은 한 번에 모이고, 처음 만나는 안 되는 판은 네 칸 고리의 옆 칸에 원판 하나씩, 3단계의 첫 안 되는 판은 여섯 칸에 하나씩이다', () => {
  const first = generateBoard(1, 1).board;
  assert.deepEqual(first, { n: 4, piles: [1, 0, 1, 0] });
  assert.equal(bruteOf(first), 1);
  assert.deepEqual(generateBoard(1, 9, { small: true }).board, first);
  const no = generateBoard(2, 2).board;
  assert.deepEqual(no, { n: 4, piles: [1, 1, 0, 0] });
  assert.equal(bruteOf(no), null);
  const six = generateBoard(3, 2).board;
  assert.deepEqual(six, { n: 6, piles: [1, 1, 1, 1, 1, 1] });
  assert.equal(bruteOf(six), null);
  // 원판 수가 홀수인 되는 판(동그라미 칸의 원판이 홀수 개여도 된다)도 섞여 있다
  const oddTotal = SEEDS.map((seed) => generateBoard(3, seed).board).filter((board) => totalOf(board.piles) % 2 === 1 && shapeCounts(board.piles).circle % 2 === 1);
  assert.ok(oddTotal.length > 0);
});

test('다음 판 번호는 방금 한 판과 같은 판을 건너뛴다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of SEEDS.slice(0, 30)) {
      const next = nextSeed(level, seed);
      assert.ok(next > seed);
      assert.notDeepEqual(generateBoard(level, next).board, generateBoard(level, seed).board);
    }
  }
  assert.equal(nextSeed(MAKE_LEVEL, 4), 5);
});

test('더 작은 판: 칸이 적거나 원판이 적고, 칸 수와 원판 수의 홀짝이 같다. 되는 판에서는 같은 종류의 되는 판만, 안 되는 판에서는 되는 판부터 안 되는 판과 번갈아 낸다', () => {
  let none = 0;
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of SEEDS.slice(0, 30)) {
      const { board } = generateBoard(level, seed);
      const from = solve(board);
      const where = `${level}단계 ${seed}번 ${boardKey(board)}`;
      const lists = smallBoards({ board });
      assert.deepEqual(smallBoards({ board }), lists, where);
      if (!from.possible) assert.ok(lists.yes.length > 0 || lists.no.length > 0 || board.n === 4, where);
      const turns = [0, 1, 2, 3].map((turn) => smallerDiscpair({ mode: 'x', board }, turn));
      if (turns[0] === null) {
        none += 1;
        assert.deepEqual(lists, { yes: [], no: [] }, where);
        continue;
      }
      for (const [turn, small] of turns.entries()) {
        const s = small.board;
        const at = `${where} → ${boardKey(s)}`;
        assert.equal(checkBoard(s), null, at);
        assert.ok(!isGathered(s.piles), at);
        assert.ok(s.n < board.n || totalOf(s.piles) < totalOf(board.piles), at);
        assert.ok(s.n <= board.n && totalOf(s.piles) <= totalOf(board.piles), at);
        assert.equal(s.n % 2, board.n % 2, at);
        assert.equal(totalOf(s.piles) % 2, totalOf(board.piles) % 2, at);
        const depth = bruteOf(s);
        if (from.possible) {
          assert.notEqual(depth, null, at);
          assert.ok(depth <= from.min, at);
          assert.equal(kindOf(s), kindOf(board), at);
        } else if (turn === 0 && lists.yes.length > 0) assert.notEqual(depth, null, at);
        else if (turn === 1 && lists.yes.length > 0 && lists.no.length > 0) assert.equal(depth, null, at);
      }
    }
  }
  // 더 줄일 수 없는 판(네 칸에 원판 둘이나 셋, 다섯 칸에 원판 둘이나 셋)이 있다
  assert.ok(none > 0);
  assert.equal(smallerDiscpair({ mode: 'four', board: { n: 4, piles: [1, 1, 0, 0] } }, 0), null);
  assert.equal(smallerDiscpair({ mode: 'four', board: { n: 4, piles: [1, 1, 0] } }, 0), null);
  // 여섯 칸에 하나씩인 판: 되는 판부터, 그다음은 네 칸 고리의 안 되는 판
  const six = { n: 6, piles: [1, 1, 1, 1, 1, 1] };
  assert.notEqual(bruteOf(smallerDiscpair({ mode: 'six', board: six }, 0).board), null);
  const second = smallerDiscpair({ mode: 'six', board: six }, 1).board;
  assert.equal(bruteOf(second), null);
  assert.equal(second.n, 4);
});
