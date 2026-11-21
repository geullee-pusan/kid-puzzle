// 여우와 토끼의 사다리 테스트: 단계마다 판이 정한 대로 나오는지, 아이가 볼 수 있는 까닭(칸의 색)으로 이기는 쪽이 정해지는지 본다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LADDER, MAKE_LEVEL, TOP_LEVEL, boardOf, generateBoard, nextSeed, rungOf } from '../src/core/foxrabbit-ladder.js';
import { checkBoard, limitOf, sameColor, smallBoards, solve } from '../src/core/foxrabbit.js';
import { makeBrute, pairOf } from './helpers/brute-foxrabbit.js';

/** 다른 방법으로 이기는 쪽을 구한다(색을 보지 않고 따져 본다) */
function bruteWinner(board, first) {
  const brute = makeBrute(board.w, board.h);
  const steps = brute.steps(pairOf(board.w, board.fox), pairOf(board.w, board.rabbit), first, limitOf(board));
  return { winner: steps === null ? 'rabbit' : 'fox', steps };
}

/** 색으로 보는 이기는 쪽: 여우 차례에 다른 색이면 여우 */
const colorWinner = (board, first) => (sameColor(board.w, board.fox, board.rabbit) === (first === 'rabbit') ? 'fox' : 'rabbit');

test('사다리: 여섯 단계, 맨 위는 직접 만들기. 기본·응용·도전 표시', () => {
  assert.deepEqual(LADDER.map((rung) => rung.level), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(LADDER.map((rung) => rung.mode), ['rabbit', 'choose', 'choose', 'fox', 'predict', 'make']);
  assert.deepEqual(LADDER.map((rung) => rung.tag), ['basic', 'basic', 'applied', 'applied', 'challenge', 'challenge']);
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  assert.throws(() => generateBoard(6, 1));
  assert.throws(() => rungOf(7));
});

test('모든 판이 쓸 수 있는 판이고, 이기는 쪽이 칸의 색으로 정해진다(다른 방법으로 따져 본 것과 같다)', () => {
  for (const rung of LADDER.filter((item) => item.mode !== 'make')) {
    for (const entry of [...rung.boards, rung.small]) {
      const board = boardOf(entry);
      assert.equal(checkBoard(board), null, JSON.stringify(entry));
      const result = solve(board);
      for (const first of ['fox', 'rabbit']) {
        const brute = bruteWinner(board, first);
        assert.equal(result[first], brute.winner, `${rung.level}단계 ${JSON.stringify(entry)} ${first}`);
        assert.equal(result[first], colorWinner(board, first));
        assert.equal(first === 'fox' ? result.foxFirst : result.rabbitFirst, brute.steps);
      }
    }
  }
});

test('1단계(토끼, 4×4): 처음 두 판은 안 잡히는 판이다. 3, 5, 7번은 잘 쫓는 여우에게 잡히는 판이고 연달아 나오지 않는다', () => {
  const winners = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => generateBoard(1, seed));
  for (const made of winners) {
    assert.deepEqual([made.board.w, made.board.h], [4, 4]);
    assert.ok(['fox', 'rabbit'].includes(made.board.first));
  }
  assert.deepEqual(
    winners.map((made) => made.solution.winner),
    ['rabbit', 'rabbit', 'fox', 'rabbit', 'fox', 'rabbit', 'fox', 'rabbit'],
  );
  // 안 잡히는 판에는 여우가 먼저인 판과 토끼가 먼저인 판이 모두 있다
  const safe = winners.filter((made) => made.solution.winner === 'rabbit');
  assert.deepEqual([...new Set(safe.map((made) => made.board.first))].sort(), ['fox', 'rabbit']);
  // 같은 번호는 늘 같은 판이고, 판 번호 9는 1번과 같다(차례로 돈다)
  assert.deepEqual(generateBoard(1, 9).board, generateBoard(1, 1).board);
  assert.deepEqual(generateBoard(1, 1), generateBoard(1, 1));
  // 작은 판은 3×3의 안 잡히는 판
  const small = generateBoard(1, 1, { small: true });
  assert.deepEqual([small.board.w, small.board.h, small.solution.winner], [3, 3, 'rabbit']);
});

test('2, 3단계(토끼, 먼저 갈지 고른다): 어느 판이든 한쪽 고르기는 안 잡히고 다른 쪽은 잡힌다. 맞는 고르기가 판마다 섞인다', () => {
  for (const level of [2, 3]) {
    const made = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => generateBoard(level, seed));
    const safeFirst = made.map(({ board, solution }) => {
      assert.equal(board.first, null);
      assert.equal(solution.winner, null);
      assert.notEqual(solution.fox, solution.rabbit, JSON.stringify(board));
      // 토끼가 안 잡히려면: 같은 색이면 여우가 먼저(나중에 가기), 다른 색이면 토끼가 먼저(먼저 가기)
      return solution.rabbit === 'rabbit' ? 'first' : 'second';
    });
    assert.ok(safeFirst.includes('first') && safeFirst.includes('second'), `${level}단계`);
    // 같은 고르기가 셋 넘게 이어지지 않는다
    assert.doesNotMatch(safeFirst.join(','), /(first,){3}first|(second,){3}second/);
  }
  // 2단계는 4×4, 3단계는 4×5·5×4·5×5
  for (let seed = 1; seed <= 8; seed++) assert.deepEqual([generateBoard(2, seed).board.w, generateBoard(2, seed).board.h], [4, 4]);
  const sizes = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => `${generateBoard(3, seed).board.w}x${generateBoard(3, seed).board.h}`));
  assert.deepEqual([...sizes].sort(), ['4x5', '5x4', '5x5']);
});

test('4단계(여우): 모두 잘 쫓으면 잡는 판이다. 1번 판은 4×4에서 3번이면 잡고(5번까지 움직일 수 있다), 뒤의 판일수록 꼭 맞게 쫓아야 한다', () => {
  const made = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => generateBoard(4, seed));
  for (const { board, solution } of made) {
    assert.ok(['fox', 'rabbit'].includes(board.first));
    assert.equal(solution.winner, 'fox', JSON.stringify(board));
  }
  const steps = made.map(({ board, solution }) => (board.first === 'fox' ? solution.foxFirst : solution.rabbitFirst));
  const slack = made.map(({ board }, index) => limitOf(board) - steps[index]);
  assert.deepEqual(steps.slice(0, 2), [3, 4]);
  assert.equal(slack[0], 2);
  assert.equal(slack.at(-1), 0);
  // 토끼가 먼저 움직이는 판도 있다
  assert.ok(made.some(({ board }) => board.first === 'rabbit'));
});

test('5단계(누가 이길지 맞히기): 여우가 이기는 판과 토끼가 이기는 판이 넷씩이고, 먼저 움직이는 쪽도 섞여 있다', () => {
  const made = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => generateBoard(5, seed));
  const winners = made.map(({ solution }) => solution.winner);
  assert.equal(winners.filter((winner) => winner === 'fox').length, 4);
  assert.equal(winners.filter((winner) => winner === 'rabbit').length, 4);
  for (const winner of ['fox', 'rabbit']) {
    const firsts = new Set(made.filter(({ solution }) => solution.winner === winner).map(({ board }) => board.first));
    assert.deepEqual([...firsts].sort(), ['fox', 'rabbit'], winner);
  }
});

test('다음 판 번호는 방금 한 판과 같은 판을 건너뛴다. 사다리의 판에는 모두 더 작은 판이 있다(3×3 판 빼고)', () => {
  for (const rung of LADDER.filter((item) => item.mode !== 'make')) {
    assert.equal(nextSeed(rung.level, 1), 2);
    for (const entry of rung.boards) {
      const board = boardOf(entry);
      assert.ok(smallBoards(board).length > 0, JSON.stringify(entry));
    }
  }
});
