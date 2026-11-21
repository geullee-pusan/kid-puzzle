// 블랙홀 사다리 점검: 단계마다 판의 종류와 크기, 풀이 프로그램으로 확인한 승패, 판 번호, 더 작은 판.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LADDER, MAKE_LEVEL, SMALL_SHELF, TOP_LEVEL, boardOf, generateBoard, kindOf, nextSeed, rungOf, smallBoards, teacherOf } from '../src/core/blackhole-ladder.js';
import { checkBoard, moveValues, openCells, outcomeOf, replay, solve } from '../src/core/blackhole.js';
import { smallerBlackhole } from '../src/core/smaller.js';
import { bruteValue } from './helpers/brute-blackhole.js';

const openOf = (board) => openCells(board).length;
const emptyOf = (board) => openOf(board) - board.kid.length - board.teacher.length;
const entries = (level) => rungOf(level).boards.map(boardOf);

test('사다리: 1~5단계는 판을 내고 6단계는 직접 만들기다. 판은 모두 쓸 수 있는 판이고 같은 번호는 같은 판이다', () => {
  assert.deepEqual(LADDER.map((rung) => rung.level), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual([TOP_LEVEL, MAKE_LEVEL], [5, 6]);
  assert.deepEqual(LADDER.map((rung) => rung.tag), ['basic', 'basic', 'applied', 'challenge', 'challenge', 'challenge']);
  assert.deepEqual(LADDER.map((rung) => rung.teacher), ['easy', 'fair', 'best', 'best', 'best', 'best']);
  assert.equal(teacherOf(2, false), 'fair');
  assert.equal(teacherOf(1, true), 'best');
  for (let level = 1; level <= TOP_LEVEL; level++) {
    const rung = rungOf(level);
    for (const board of [...entries(level), boardOf(rung.small)]) assert.equal(checkBoard(board), null, `${level}단계 ${JSON.stringify(board)}`);
    for (let seed = 1; seed <= 20; seed++) {
      assert.deepEqual(generateBoard(level, seed), generateBoard(level, seed));
      const next = nextSeed(level, seed);
      assert.notDeepEqual(generateBoard(level, next).board, generateBoard(level, seed).board);
    }
  }
  assert.throws(() => generateBoard(MAKE_LEVEL, 1));
});

test('1단계 작은 판에서 두기: 칸이 5개와 7개인 빈 판, 아이가 먼저 둔다. 둘 다 잘 두면 5칸은 비기고 7칸은 비기거나 먼저 두는 쪽이 이긴다', () => {
  const boards = entries(1);
  assert.equal(openOf(boards[0]), 5, '첫 판은 5칸');
  for (const board of boards) {
    assert.ok([5, 7].includes(openOf(board)));
    assert.deepEqual([board.kid, board.teacher, board.first], [[], [], 'kid']);
    const value = bruteValue(board);
    assert.equal(solve(board).value, value);
    if (openOf(board) === 5) assert.equal(value, 0);
    else assert.ok(value >= 0);
  }
  assert.ok(boards.some((board) => openOf(board) === 7 && solve(board).value > 0));
});

test('2단계 칸이 9개인 판: 세모 열 칸에 돌 하나, 아이가 먼저. 돌이 구석이나 가운데면 비기고 변이면 아이가 1만큼 이기는 자리다', () => {
  const boards = entries(2);
  const rocks = boards.map((board) => board.rocks[0]).sort((a, b) => a - b);
  assert.deepEqual(rocks, [0, 1, 4, 5, 6, 7, 8, 9]);
  for (const board of boards) {
    assert.equal(openOf(board), 9);
    assert.equal(board.first, 'kid');
    assert.equal(solve(board).value, [0, 4, 6, 9].includes(board.rocks[0]) ? 0 : 1);
  }
  assert.equal(bruteValue(boards[0]), solve(boards[0]).value);
});

test('3단계 몇 수만 남은 판: 아이 차례로 시작하고, 아이가 잘 두면 이기는데 이기는 칸은 하나뿐이다(다른 칸은 비기거나 진다)', () => {
  const boards = entries(3);
  assert.ok(boards.some((board) => board.rows === 4) && boards.some((board) => board.rows === 5));
  for (const board of boards) {
    const now = replay(board, [], board.first);
    assert.equal(now.next, 'kid', JSON.stringify(board));
    assert.ok(now.empty.length >= 4 && now.empty.length <= 7);
    const values = moveValues(board, [], board.first);
    const wins = values.filter((item) => item.value > 0);
    assert.equal(wins.length, 1, JSON.stringify(board));
    assert.ok(values.some((item) => item.value < 0));
    // 다른 방법으로: 이기는 칸에 놓은 뒤의 값과 판의 값
    assert.equal(bruteValue(board), Math.max(...values.map((item) => item.value)));
    assert.equal(solve(board).value, wins[0].value);
  }
  // 작은 판도 같다(칸 5개, 아이가 이길 수 있는 칸은 하나)
  const small = boardOf(rungOf(3).small);
  assert.equal(moveValues(small, [], small.first).filter((item) => item.value > 0).length, 1);
});

test('4단계 먼저 둘까 나중에 둘까: 9칸 판, 두기 전에 고른다. 먼저 두어야 이기는 판, 나중에 두어야 이기는 판, 어느 쪽이든 비기는 판이 섞인다', () => {
  const kinds = entries(4).map((board) => {
    assert.equal(board.first, null);
    assert.equal(openOf(board), 9);
    assert.equal(board.kid.length, board.teacher.length);
    const result = solve(board);
    assert.equal(result.kid, bruteValue({ ...board, first: 'kid' }), JSON.stringify(board));
    assert.equal(result.teacher, bruteValue({ ...board, first: 'teacher' }), JSON.stringify(board));
    const first = outcomeOf(result.kid);
    const later = outcomeOf(result.teacher);
    if (first === 'win') return 'first';
    if (later === 'win') return 'later';
    assert.deepEqual([first, later], ['draw', 'draw']);
    return 'draw';
  });
  assert.deepEqual(kinds, ['first', 'later', 'draw', 'later', 'first', 'first', 'later', 'later']);
});

test('5단계 칸이 15개인 큰 판: 두기 전에 고르고, 처음 자리는 끝까지 따지지 않는다(그래서 이기는 자리를 적지 않는다)', () => {
  for (const board of entries(5)) {
    assert.equal(board.rows, 5);
    assert.ok([13, 15].includes(openOf(board)));
    assert.equal(board.first, null);
    assert.equal(solve(board).exact, false);
  }
  assert.equal(solve(boardOf(rungOf(5).small)).exact, true);
});

test('더 작은 판: 종류가 같고 칸이 더 적은 판(가장 작은 판이면 수가 두 개 더 놓인 판). 수가 놓인 판에서 아이 차례면 작은 판도 아이가 이길 수 있다', () => {
  for (const entry of SMALL_SHELF) assert.equal(checkBoard(boardOf(entry)), null);
  for (const entry of SMALL_SHELF.map(boardOf).filter((board) => kindOf(board) === 'given-kid')) assert.ok(solve(entry).value > 0, JSON.stringify(entry));
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const board of [...entries(level), boardOf(rungOf(level).small)]) {
      const list = smallBoards(board);
      for (const small of list) {
        assert.equal(checkBoard(small), null);
        if (openOf(small) < openOf(board)) assert.equal(kindOf(small), kindOf(board), JSON.stringify([board, small]));
        else {
          // 같은 판에 수를 두 개 더 놓은 판: 돌과 미리 놓인 수는 그대로이고, 둘 차례인 쪽(고르는 판이면 고르기)도 그대로다
          assert.equal(emptyOf(small), emptyOf(board) - 2);
          assert.deepEqual([small.rows, small.rocks, small.first], [board.rows, board.rocks, board.first]);
          assert.ok(board.kid.every((cell, index) => small.kid[index] === cell) && board.teacher.every((cell, index) => small.teacher[index] === cell));
          if (board.first !== null) assert.equal(replay(small, [], small.first).next, replay(board, [], board.first).next);
        }
        assert.ok(emptyOf(small) >= 3, '한 번에 끝나지 않는다');
        assert.deepEqual(smallerBlackhole({ board }, 0)?.board, list[0]);
      }
      if (openOf(board) > 5) assert.ok(list.length > 0, JSON.stringify(board));
    }
  }
  // 5칸 빈 판의 작은 판은 1이 하나씩 놓인 5칸 판이다. 그보다 작은 판은 없다
  const five = smallBoards(boardOf([3, [0], [], [], 'kid']));
  assert.equal(five.length, 1);
  assert.deepEqual([five[0].kid.length, five[0].teacher.length, emptyOf(five[0])], [1, 1, 3]);
  assert.deepEqual(smallBoards(five[0]), []);
  assert.equal(smallerBlackhole({ board: { rows: 9 } }, 0), null);
});
