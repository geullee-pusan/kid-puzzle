// 탑 옮기기의 사다리와 판 내기, 더 작은 판: 단계마다 판의 꼴, 정해 둔 첫 판, 흩어진 탑의 가장 적은 횟수, 몇 번째 판의 답을
// 다른 방법(tests/helpers/brute-tower.js)으로 다시 따진다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, guessSizes, nextSeed, recordMode, rungOf, smallBoards, tableSizes } from '../src/core/tower-ladder.js';
import { checkBoard, isTower, sameBoard, solve, standardBoard } from '../src/core/tower.js';
import { smallerTower } from '../src/core/smaller.js';
import { bruteSolve } from './helpers/brute-tower.js';

const SEEDS = Array.from({ length: 60 }, (_, index) => index + 1);

test('사다리: 여섯 단계, 표시는 기본·기본·응용·응용·도전·도전, 맨 위는 직접 만들기', () => {
  assert.deepEqual(LADDER.map((rung) => rung.level), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(LADDER.map((rung) => rung.tag), ['basic', 'basic', 'applied', 'applied', 'challenge', 'challenge']);
  assert.deepEqual(LADDER.map((rung) => rung.mode), ['move', 'fewest', 'table', 'which', 'spread', 'make']);
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  assert.throws(() => generateBoard(6, 1));
  assert.throws(() => generateBoard(1, 0));
  assert.throws(() => rungOf(9));
  assert.deepEqual(['move', 'fewest', 'table', 'which', 'spread', 'made'].map(recordMode), [false, true, false, false, true, true]);
});

test('정해 둔 첫 판: 원판 1개·2개·3개 탑, 가장 적게는 3개부터, 표는 원판 4개까지, 몇 번째는 원판 5개의 16번째부터, 흩어진 탑은 5번과 11번', () => {
  assert.deepEqual([1, 2, 3].map((seed) => generateBoard(1, seed).board), [standardBoard(1, 2), standardBoard(2, 2), standardBoard(3, 2)]);
  assert.deepEqual([1, 2, 3].map((seed) => generateBoard(2, seed).board), [standardBoard(3, 2), standardBoard(3, 1), standardBoard(4, 2)]);
  assert.deepEqual(generateBoard(3, 1).board, standardBoard(4, 2));
  assert.deepEqual(tableSizes(generateBoard(3, 1).board), [1, 2, 3, 4]);
  assert.deepEqual(guessSizes(generateBoard(3, 1).board), [5, 6]);
  assert.deepEqual([1, 2, 3].map((seed) => generateBoard(4, seed).board.ask), [16, 12, 40]);
  assert.deepEqual([1, 2].map((seed) => generateBoard(5, seed).solution.fewest), [5, 11]);
  // 첫 흩어진 탑은 가장 큰 원판이 이미 깃발 기둥에 있고, 둘째는 다른 기둥에 있다
  assert.equal(generateBoard(5, 1).board.start[3], 2);
  assert.notEqual(generateBoard(5, 2).board.start[3], 2);
  // 수준 맞추기의 작은 판은 1단계의 원판 2개 탑이다
  assert.deepEqual(generateBoard(1, 9, { small: true }).board, standardBoard(2, 2));
  assert.equal(generateBoard(2, 9, { small: true }).small, false);
});

test('판 번호 1~60: 같은 번호는 같은 판이고 단계의 꼴에 맞다. 가장 적은 횟수와 몇 번째의 답은 다른 방법과 같다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    const { mode } = rungOf(level);
    for (const seed of SEEDS) {
      const { board, solution } = generateBoard(level, seed);
      assert.deepEqual(generateBoard(level, seed).board, board);
      assert.equal(checkBoard(board), null, `${level}-${seed}`);
      assert.notEqual(board.target, 0);
      if (mode === 'move') assert.ok(isTower(board) && board.n <= 3);
      if (mode === 'fewest') assert.ok(isTower(board) && [3, 4].includes(board.n));
      if (mode === 'table') assert.ok(isTower(board) && board.n === 4);
      if (mode === 'which') {
        assert.ok(isTower(board) && [5, 6].includes(board.n) && board.ask >= 8 && board.ask <= 2 ** board.n - 2, `${seed}`);
        // 묻는 차례의 원판(다른 방법의 길에서 그 차례에 움직인 원판)
        if (seed <= 12) assert.equal(solve(board).answer, bruteSolve(board.start, board.target).discs[board.ask - 1], `${seed}`);
      }
      if (mode === 'spread') {
        assert.ok(!board.start.every((peg) => peg === board.start[0]), `${seed}: 흩어져 있다`);
        assert.ok([4, 5].includes(board.n));
        assert.ok(solution.fewest >= 5 && solution.fewest <= 2 ** board.n - 2, `${seed}: ${solution.fewest}`);
        if (seed <= 20) assert.equal(bruteSolve(board.start, board.target).fewest, solution.fewest, `${seed}`);
      }
    }
  }
});

test('몇 번째 판: 열에 여덟쯤은 원판 1이 아닌 원판이 움직이는 차례를 묻는다(늘 같은 원판이 답이 아니다)', () => {
  const answers = SEEDS.map((seed) => {
    const { board } = generateBoard(4, seed);
    return bruteSolve(board.start, board.target).discs[board.ask - 1];
  });
  const ones = answers.filter((disc) => disc === 1).length;
  assert.ok(ones >= 3 && ones <= 25, `원판 1이 답인 판 ${ones}개`);
  assert.ok(new Set(answers).size >= 4);
});

test('다음 판 번호는 방금 한 판과 같은 판을 건너뛴다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of SEEDS.slice(0, 20)) {
      const next = nextSeed(level, seed);
      assert.ok(next > seed);
      assert.equal(sameBoard(generateBoard(level, next).board, generateBoard(level, seed).board), false, `${level}: ${seed}→${next}`);
    }
  }
  assert.equal(nextSeed(MAKE_LEVEL, 4), 5);
});

test('더 작은 판: 종류가 같고 원판이 하나 적다. 몇 번째 판은 답이 같은 차례로 옮기고, 흩어진 탑은 2번 이상 걸리는 판만 낸다', () => {
  // 탑: 원판 2개 탑까지
  assert.deepEqual(smallBoards({ mode: 'fewest', board: standardBoard(4, 1) }), [standardBoard(3, 1)]);
  assert.deepEqual(smallBoards({ mode: 'move', board: standardBoard(2, 2) }), []);
  assert.deepEqual(smallBoards({ mode: 'made', board: { n: 3, start: [1, 1, 1], target: 0 } }), [{ n: 2, start: [1, 1], target: 0 }]);
  // 표 만들기: 원판 3개 표까지
  assert.deepEqual(smallBoards({ mode: 'table', board: standardBoard(4, 2) }), [standardBoard(3, 2)]);
  assert.deepEqual(smallBoards({ mode: 'table', board: standardBoard(3, 2) }), []);
  // 몇 번째 판: 묻는 차례가 한가운데가 아니면 작은 탑에서도 같은 원판이 움직인다
  for (const seed of SEEDS.slice(0, 30)) {
    const { board } = generateBoard(4, seed);
    const [small] = smallBoards({ mode: 'which', board });
    assert.equal(small.n, board.n - 1);
    assert.ok(small.ask >= 1 && small.ask <= 2 ** small.n - 1);
    const answer = bruteSolve(board.start, board.target).discs[board.ask - 1];
    const smallAnswer = bruteSolve(small.start, small.target).discs[small.ask - 1];
    if (board.ask !== 2 ** (board.n - 1)) assert.equal(smallAnswer, answer, `${seed}`);
  }
  assert.deepEqual(smallBoards({ mode: 'which', board: { ...standardBoard(3, 2), ask: 4 } }), []);
  // 흩어진 탑: 가장 큰 원판이나 가장 작은 원판을 뺀 판
  for (const seed of SEEDS.slice(0, 30)) {
    const { board } = generateBoard(5, seed);
    const list = smallBoards({ mode: 'spread', board });
    for (const small of list) {
      assert.equal(small.n, board.n - 1);
      assert.ok(bruteSolve(small.start, small.target).fewest >= 2);
    }
    // 틀이 쓰는 함수: 차례마다 같은 판
    const first = smallerTower({ mode: 'spread', board }, 0);
    assert.deepEqual(first, smallerTower({ mode: 'spread', board }, 0));
  }
  assert.equal(smallerTower({ mode: 'move', board: standardBoard(1, 2) }, 0), null);
});
