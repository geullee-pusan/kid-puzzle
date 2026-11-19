// 자리 바꾸기의 규칙과 풀이 프로그램 점검.
// 풀이 프로그램이 알려 주는 사실(가장 적은 횟수, 뛰어넘기 규칙 둘의 견줌, 짝 짓기에서 되는 개수, 아무렇게나 움직였을 때의 비율)을
// 다른 방법(tests/helpers/brute-swap.js)으로 다시 구해 견준다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  JUMP_RULE,
  JUMP_RULES,
  MAX_CARRY,
  MAX_FROGS,
  MAX_PILE_STONES,
  MIN_CARRY,
  MAX_STONES,
  MIN_STONES,
  SKIPS,
  allWays,
  applyMove,
  blockOf,
  checkBoard,
  deadEnds,
  diagnoseImpossible,
  goalCells,
  isDone,
  isStuck,
  movesFrom,
  movesOf,
  randomFinishRate,
  replay,
  solve,
  startCells,
  stuckKind,
} from '../src/core/swap.js';
import { bruteCarry, bruteFrogs, brutePairs, brutePiles } from './helpers/brute-swap.js';

const frogs = (left, right) => ({ kind: 'frogs', left, right });
const pairs = (n, skip = 2) => ({ kind: 'pairs', n, skip });
const allFrogs = [];
for (let left = 1; left <= MAX_FROGS; left++) for (let right = 1; right <= MAX_FROGS; right++) allFrogs.push([left, right]);
const near = (a, b) => Math.abs(a - b) < 1e-12;

test('판의 규격: 개구리는 한쪽에 1~5마리, 짝 짓기는 돌 2~12개에 건너뛰는 수 1~3', () => {
  assert.equal(checkBoard(frogs(1, 1)), null);
  assert.equal(checkBoard(frogs(5, 5)), null);
  assert.equal(checkBoard(frogs(0, 2)), 'bad-count');
  assert.equal(checkBoard(frogs(6, 2)), 'bad-count');
  assert.equal(checkBoard(frogs(2, 1.5)), 'bad-count');
  assert.equal(checkBoard(pairs(2, 1)), null);
  assert.equal(checkBoard(pairs(12, 3)), null);
  assert.equal(checkBoard(pairs(13, 2)), 'bad-count');
  assert.equal(checkBoard(pairs(1, 2)), 'bad-count');
  assert.equal(checkBoard(pairs(8, 4)), 'bad-skip');
  assert.equal(checkBoard({ kind: 'coins' }), 'bad-kind');
  assert.equal(checkBoard(null), 'no-board');
  assert.deepEqual([MAX_FROGS, MIN_STONES, MAX_STONES, SKIPS], [5, 2, 12, [1, 2, 3]]);
});

test('처음 모습과 끝 모습: 두 무리 사이에 빈칸 하나, 끝은 통째로 맞바꾼 모습', () => {
  assert.equal(startCells(frogs(2, 3)), 'RR_LLL');
  assert.equal(goalCells(frogs(2, 3)), 'LLL_RR');
  assert.equal(startCells(pairs(6)), '111111');
  assert.equal(isDone(frogs(1, 1), 'L_R'), true);
  assert.equal(isDone(frogs(1, 1), 'R_L'), false);
  assert.equal(isDone(pairs(4), '0202'), true);
  assert.equal(isDone(pairs(4), '0211'), false);
});

test('개구리의 움직임: 보는 쪽으로만 간다. 앞이 빈칸이면 한 칸, 다른 무리 하나는 뛰어넘는다', () => {
  const board = frogs(2, 2);
  assert.deepEqual(movesOf(board, 'RR_LL'), [
    { from: 1, to: 2, jump: false },
    { from: 3, to: 2, jump: false },
  ]);
  // 뛰어넘기: 다른 무리 하나를 넘어 그 뒤의 빈칸으로
  assert.deepEqual(movesFrom(board, 'R_RLL', 3), [{ from: 3, to: 1, jump: true }]);
  assert.deepEqual(movesFrom(board, 'RL_RL', 0), [{ from: 0, to: 2, jump: true }]);
  // 뒤로는 못 간다. 둘을 한꺼번에 넘지 못한다. 줄 밖으로 나가지 못한다.
  assert.deepEqual(movesFrom(board, 'R_RLL', 2), []);
  assert.deepEqual(movesFrom(board, '_RRLL', 1), []);
  assert.deepEqual(movesFrom(board, 'LL_RR', 4), []);
  assert.deepEqual(movesFrom(board, 'LL_RR', 0), []);
  // 같은 무리는 뛰어넘지 못한다(앱이 쓰는 규칙). 다른 규칙('any')에서는 넘는다.
  assert.equal(JUMP_RULE, 'other');
  assert.deepEqual(JUMP_RULES, ['other', 'any']);
  assert.deepEqual(movesFrom(board, 'RR_LL', 0), []);
  assert.deepEqual(movesFrom(board, 'RR_LL', 0, 'any'), [{ from: 0, to: 2, jump: true }]);
  // 말 하나가 할 수 있는 움직임은 많아야 하나다(그래서 누르면 간다).
  for (const [left, right] of allFrogs) {
    const cells = startCells(frogs(left, right));
    for (let at = 0; at < cells.length; at++) assert.ok(movesFrom(frogs(left, right), cells, at).length <= 1);
  }
  assert.equal(applyMove(board, 'RR_LL', { from: 1, to: 2 }), 'R_RLL');
});

test('가장 적은 횟수는 1~5마리의 모든 짝에서 (왼쪽 수 × 오른쪽 수) + (왼쪽 수 + 오른쪽 수)다', () => {
  for (const [left, right] of allFrogs) {
    const board = frogs(left, right);
    const solved = solve(board);
    const where = `${left}마리와 ${right}마리`;
    assert.equal(solved.possible, true, where);
    assert.equal(solved.min, left * right + left + right, where);
    // 다른 방법으로 구한 값과 같다.
    assert.equal(bruteFrogs(left, right).shortest, solved.min, where);
    // 풀이 프로그램이 내놓은 차례를 그대로 따라가면 끝난다.
    const played = replay(board, solved.moves);
    assert.equal(played.ok, true, where);
    assert.equal(played.cells, goalCells(board), where);
    assert.equal(solved.moves.length, solved.min, where);
    assert.equal(played.jumps, left * right, where);
    assert.equal(played.steps, left + right, where);
  }
  // 한쪽이 n마리씩이면 n × (n + 2)번
  assert.deepEqual([1, 2, 3, 4, 5].map((n) => solve(frogs(n, n)).min), [3, 8, 15, 24, 35]);
});

test('뛰어넘기 규칙 둘을 견준다: 가장 적은 횟수가 같고, 같은 무리를 뛰어넘은 길은 끝까지 가지 못한다', () => {
  for (const [left, right] of allFrogs) {
    const board = frogs(left, right);
    const where = `${left}마리와 ${right}마리`;
    assert.equal(solve(board, 'any').min, solve(board, 'other').min, where);
    assert.equal(bruteFrogs(left, right, true).shortest, bruteFrogs(left, right, false).shortest, where);
    // 끝까지 가는 길의 수와 길이는 두 규칙에서 같다. 'any'가 더하는 것은 막히는 길뿐이다.
    const other = allWays(board, 'other');
    const any = allWays(board, 'any');
    assert.deepEqual(any, other, where);
    assert.ok(randomFinishRate(board, 'any') <= randomFinishRate(board, 'other') + 1e-12, where);
  }
  // 같은 무리를 뛰어넘으면 막힌다: 두 마리와 한 마리에서 맨 뒤 개구리가 앞 개구리를 넘은 모습
  assert.equal(isStuck(frogs(2, 1), '_RRL', 'any'), true);
});

test('끝까지 간 길은 어느 것이나 횟수가 같다: 뛰어넘기는 곱만큼, 한 칸 가기는 합만큼', () => {
  for (const [left, right] of allFrogs) {
    const where = `${left}마리와 ${right}마리`;
    const ways = allWays(frogs(left, right));
    assert.deepEqual(ways.lengths, [left * right + left + right], where);
    assert.deepEqual(ways.jumps, [left * right], where);
    const brute = bruteFrogs(left, right);
    assert.equal(brute.ways, ways.ways, where);
    assert.equal(brute.longest, brute.shortest, where);
    // 양쪽이 두 마리 이상이면 끝까지 가는 길은 둘뿐이다(어느 무리가 먼저 움직이느냐).
    if (left >= 2 && right >= 2) assert.equal(ways.ways, 2, where);
  }
  assert.equal(allWays(frogs(1, 1)).ways, 2);
  assert.equal(allWays(frogs(2, 1)).ways, 3);
});

test('막힌 모습: 끝나지 않았는데 갈 수 있는 말이 없다. 어느 것이나 같은 무리 둘이 붙어 있다', () => {
  assert.deepEqual(deadEnds(frogs(1, 1)), []);
  assert.deepEqual(deadEnds(frogs(2, 1)), ['_RRL']);
  assert.deepEqual(deadEnds(frogs(2, 2)), ['L_RRL', 'RLL_R', 'RRLL_', '_RRLL']);
  for (const [left, right] of allFrogs) {
    const board = frogs(left, right);
    const stuck = deadEnds(board);
    assert.equal(stuck.length, bruteFrogs(left, right).stuck, `${left}마리와 ${right}마리`);
    for (const cells of stuck) {
      assert.equal(isStuck(board, cells), true);
      assert.equal(stuckKind(cells), 'pair', cells);
    }
    assert.equal(isStuck(board, startCells(board)), false);
    assert.equal(isStuck(board, goalCells(board)), false, '끝난 모습은 막힌 것이 아니다');
  }
  assert.equal(stuckKind('R_LRL'), 'plain');
});

test('못 가는 말을 누르면 무엇이 막았는지 알려 준다', () => {
  const board = frogs(2, 2);
  assert.equal(blockOf(board, 'RR_LL', 1), null);
  // 바로 앞이 같은 무리다
  assert.deepEqual(blockOf(board, 'RR_LL', 0), { reason: 'blocked', cells: [1] });
  // 바로 앞에 다른 무리가 있고 그 뒤도 차 있다
  assert.deepEqual(blockOf(board, '_RRLL', 2), { reason: 'blocked', cells: [3, 4] });
  // 바로 앞에 말이 있고 그 뒤는 줄의 끝이다
  assert.deepEqual(blockOf(board, '_RRLL', 3), { reason: 'blocked', cells: [2, 1] });
  assert.deepEqual(blockOf(board, 'RRLL_', 2), { reason: 'blocked', cells: [1, 0] });
  assert.deepEqual(blockOf(frogs(1, 1), 'RL_', 1), { reason: 'blocked', cells: [0] });
  assert.equal(blockOf(board, 'LRL_R', 1), null, '뛰어넘을 수 있는 말');
  assert.deepEqual(blockOf(board, 'LL_RR', 4), { reason: 'edge', cells: [] });
  assert.deepEqual(blockOf(board, 'LL_RR', 0), { reason: 'edge', cells: [] });
  assert.deepEqual(blockOf(board, 'LL_RR', 2), { reason: 'empty', cells: [] });
  // 짝 짓기
  assert.equal(blockOf(pairs(8), '11111111', 0), null);
  assert.deepEqual(blockOf(pairs(4), '0112', 1), { reason: 'no-landing', cells: [] });
  assert.deepEqual(blockOf(pairs(4), '0112', 3), { reason: 'paired', cells: [] });
  assert.deepEqual(blockOf(pairs(4), '0112', 0), { reason: 'empty', cells: [] });
});

test('짝 짓기의 움직임: 꼭 정한 수만큼 건너뛰어 혼자 있는 돌 위에 얹는다. 짝은 두 개로 세고 빈자리는 세지 않는다', () => {
  const board = pairs(8);
  assert.deepEqual(movesFrom(board, '11111111', 0), [{ from: 0, to: 3, jump: true }]);
  assert.deepEqual(movesFrom(board, '11111111', 3), [
    { from: 3, to: 0, jump: true },
    { from: 3, to: 6, jump: true },
  ]);
  assert.equal(applyMove(board, '11111111', { from: 3, to: 6 }), '11101121');
  // 짝이 된 돌 하나를 넘으면 두 개를 건너뛴 것이다. 빈자리는 세지 않는다.
  assert.deepEqual(movesFrom(board, '11101121', 5), [{ from: 5, to: 7, jump: true }, { from: 5, to: 1, jump: true }].sort((a, b) => a.to - b.to));
  // 혼자 있는 돌 하나와 짝 하나를 넘으면 세 개라서 안 된다(오른쪽). 왼쪽으로는 빈자리를 세지 않고 돌 둘을 넘는다.
  assert.deepEqual(movesFrom(board, '11101121', 4), [{ from: 4, to: 0, jump: true }]);
  // 짝이 된 돌은 움직이지 못하고, 짝 위에는 얹지 못한다.
  assert.deepEqual(movesFrom(board, '11101121', 6), []);
  assert.deepEqual(movesFrom(pairs(4), '0112', 1), []);
  // 건너뛰는 수가 다르면 닿는 자리가 다르다.
  assert.deepEqual(movesFrom(pairs(8, 1), '11111111', 0), [{ from: 0, to: 2, jump: true }]);
  assert.deepEqual(movesFrom(pairs(8, 3), '11111111', 0), [{ from: 0, to: 4, jump: true }]);
});

test('짝 짓기: 건너뛰는 수가 2일 때 8개, 10개, 12개는 되고 2개, 4개, 6개와 홀수 개는 안 된다', () => {
  const possible = [];
  for (let n = MIN_STONES; n <= MAX_STONES; n++) {
    const solved = solve(pairs(n));
    assert.equal(solved.possible, brutePairs(n, 2).possible, `${n}개`);
    if (solved.possible) {
      possible.push(n);
      // 한 번에 두 개가 짝이 되므로 얹는 횟수는 늘 돌의 수의 절반이다.
      assert.equal(solved.min, n / 2);
      const played = replay(pairs(n), solved.moves);
      assert.equal(played.ok, true);
      assert.equal(isDone(pairs(n), played.cells), true);
      assert.deepEqual(allWays(pairs(n)).lengths, [n / 2]);
    } else {
      assert.equal(solved.min, null);
      assert.deepEqual(solved.moves, []);
      assert.equal(allWays(pairs(n)).ways, 0);
    }
  }
  assert.deepEqual(possible, [8, 10, 12]);
});

test('짝 짓기: 건너뛰는 수가 1이나 3이면 2~12개 가운데 되는 판이 없다', () => {
  for (const skip of [1, 3]) {
    for (let n = MIN_STONES; n <= MAX_STONES; n++) {
      assert.equal(solve(pairs(n, skip)).possible, false, `${skip}개씩 ${n}개`);
      assert.equal(brutePairs(n, skip).possible, false, `${skip}개씩 ${n}개`);
    }
  }
});

test('아무렇게나 움직였을 때 끝까지 가는 비율: 다른 방법으로 구한 값과 같다', () => {
  for (const [left, right] of allFrogs) {
    assert.ok(near(randomFinishRate(frogs(left, right)), bruteFrogs(left, right).rate), `${left}마리와 ${right}마리`);
  }
  for (let n = MIN_STONES; n <= MAX_STONES; n++) assert.ok(near(randomFinishRate(pairs(n)), brutePairs(n, 2).rate), `${n}개`);
  // 세어 본 값
  assert.equal(randomFinishRate(frogs(1, 1)), 1);
  assert.equal(randomFinishRate(frogs(2, 1)), 0.75);
  assert.equal(randomFinishRate(frogs(2, 2)), 0.125);
  assert.equal(randomFinishRate(frogs(3, 2)), 0.03125);
  assert.equal(randomFinishRate(frogs(3, 3)), 0.00390625);
  assert.ok(near(randomFinishRate(pairs(8)), 1 / 30));
  assert.ok(near(randomFinishRate(pairs(10)), 1 / 140));
  assert.equal(randomFinishRate(pairs(6)), 0);
});

test('지나온 길 따라가기: 규칙에 맞지 않는 움직임이 있으면 알려 준다', () => {
  const board = frogs(2, 2);
  assert.deepEqual(replay(board, []), { ok: true, cells: 'RR_LL', jumps: 0, steps: 0 });
  assert.deepEqual(replay(board, [[1, 2], [3, 1]]), { ok: true, cells: 'RLR_L', jumps: 1, steps: 1 });
  assert.equal(replay(board, [[0, 2]]).ok, false, '같은 무리를 뛰어넘는 움직임');
  assert.equal(replay(board, [[2, 1]]).ok, false, '빈칸을 움직이는 것');
  assert.equal(replay(board, [[1, 2], [2, 1]]).ok, false, '뒤로 가는 움직임');
  assert.equal(replay(board, 'x').ok, false);
  assert.equal(replay(board, [null]).ok, false);
  assert.deepEqual(replay(pairs(8), [[3, 6], [5, 1]]).cells, '12101021');
  assert.equal(replay(pairs(8), [[0, 2]]).ok, false);
});

test('오답 짐작: 되는 판에 "불가능해요"', () => {
  const can = solve(pairs(8));
  const cannot = solve(pairs(6));
  assert.deepEqual(diagnoseImpossible(cannot, { moves: 0, firsts: [] }), { correct: true, guess: null });
  assert.deepEqual(diagnoseImpossible(can, { moves: 0, firsts: [] }), { correct: false, guess: 'impossible-no-try' });
  assert.deepEqual(diagnoseImpossible(can), { correct: false, guess: 'impossible-no-try' });
  assert.deepEqual(diagnoseImpossible(can, { moves: 5, firsts: ['0-3'] }), { correct: false, guess: 'impossible-same-first' });
  assert.deepEqual(diagnoseImpossible(can, { moves: 9, firsts: ['0-3', '3-6'] }), { correct: false, guess: 'impossible-other-way' });
});

// ---- 둘씩 묶어 옮기기와 셋씩 쌓기(2026-11-20에 더한 판) ----
const carry = (n) => ({ kind: 'carry', n });
const piles = (n, skip = 3) => ({ kind: 'pairs', n, skip, group: 3 });

test('묶어 옮기기의 규격과 움직임: 돌 4~14개(짝수), 이웃한 돌 둘을 차례 그대로 빈칸 둘로', () => {
  assert.deepEqual([MIN_CARRY, MAX_CARRY, MAX_PILE_STONES], [4, 14, 15]);
  assert.equal(checkBoard(carry(8)), null);
  assert.equal(checkBoard(carry(14)), null);
  assert.equal(checkBoard(carry(7)), 'bad-count');
  assert.equal(checkBoard(carry(16)), 'bad-count');
  assert.equal(checkBoard(carry(2)), 'bad-count');
  assert.equal(startCells(carry(6)), 'BWBWBW__');
  // 빈칸 둘은 오른쪽 끝에 있고, 이웃한 돌 둘이면 어느 것이나 옮길 수 있다.
  assert.deepEqual(
    movesOf(carry(6), 'BWBWBW__').map((move) => move.from),
    [0, 1, 2, 3, 4],
  );
  assert.equal(applyMove(carry(6), 'BWBWBW__', { from: 1, to: 6 }), 'B__WBWWB');
  assert.deepEqual(movesOf(carry(6), 'B__WBWWB').map((move) => [move.from, move.to]), [[3, 1], [4, 1], [5, 1], [6, 1]]);
  // 끝: 돌 사이에 빈칸이 없고 같은 색끼리 모여 있다. 어느 색이 왼쪽이어도, 빈칸이 어느 끝에 있어도 된다.
  assert.equal(isDone(carry(6), 'BBBWWW__'), true);
  assert.equal(isDone(carry(6), '__WWWBBB'), true);
  assert.equal(isDone(carry(6), 'BBB__WWW'), false, '돌 사이에 빈칸');
  assert.equal(isDone(carry(6), 'BBWBWW__'), false);
  assert.equal(isStuck(carry(6), 'BWBWBW__'), false);
  assert.equal(replay(carry(6), [[1, 6], [4, 1]]).cells, 'BBWW__WB');
  assert.equal(replay(carry(6), [[0, 1]]).ok, false, '빈칸이 아닌 곳으로 옮기기');
});

test('묶어 옮기기의 가장 적은 횟수: 돌 6개는 4번, 8개부터는 둘씩의 짝 수만큼(4~7번), 4개는 안 된다. 다른 방법으로 구해도 같다', () => {
  const table = [];
  for (let n = MIN_CARRY; n <= MAX_CARRY; n += 2) {
    const solved = solve(carry(n));
    const brute = bruteCarry(n);
    assert.deepEqual([solved.possible, solved.min], [brute.possible, brute.min], `${n}개`);
    // 따져 본 모습의 수도 같다(빈칸이 늘 붙어 있으니 두 방법이 같은 모습들을 지난다). 안 되는 판에서는 모든 모습이다.
    if (!solved.possible) assert.equal(solved.states, brute.states, `${n}개`);
    if (solved.possible) {
      const played = replay(carry(n), solved.moves);
      assert.equal(played.ok && isDone(carry(n), played.cells), true, `${n}개`);
    }
    table.push(solved.min);
  }
  assert.deepEqual(table, [null, 4, 4, 5, 6, 7]);
});

test('셋씩 쌓기: 셋을 건너뛰면 12개와 15개가 되고 3, 6, 9개는 안 된다. 하나나 둘을 건너뛰면 15개까지 되는 판이 없다', () => {
  assert.equal(checkBoard(piles(15)), null);
  assert.equal(checkBoard(piles(16)), 'bad-count');
  assert.equal(checkBoard({ kind: 'pairs', n: 9, skip: 3, group: 4 }), 'bad-group');
  for (const skip of SKIPS) {
    for (let n = 3; n <= MAX_PILE_STONES; n += 3) {
      const solved = solve(piles(n, skip));
      assert.equal(solved.possible, brutePiles(n, skip, 3).possible, `${skip}개씩 ${n}개`);
      assert.equal(solved.possible, skip === 3 && n >= 12, `${skip}개씩 ${n}개`);
      // 한 번에 돌 하나가 얹히므로 얹는 횟수는 늘 돌의 수의 3분의 2다.
      if (solved.possible) {
        assert.equal(solved.min, (2 * n) / 3);
        const played = replay(piles(n, skip), solved.moves);
        assert.equal(played.ok && isDone(piles(n, skip), played.cells), true);
      }
    }
  }
  // 셋이 쌓인 더미 위에는 얹지 못하고, 둘이 쌓인 더미 위에는 얹는다. 쌓인 돌은 움직이지 못한다.
  assert.deepEqual(movesFrom(piles(6), '111111', 0), [{ from: 0, to: 4, jump: true }]);
  assert.equal(applyMove(piles(6), '111121', { from: 0, to: 4 }), '011131');
  assert.deepEqual(movesFrom(piles(6), '111121', 0), [{ from: 0, to: 4, jump: true }]);
  assert.deepEqual(movesFrom(piles(6), '011211', 1), [{ from: 1, to: 4, jump: true }]);
  assert.deepEqual(movesFrom(piles(6), '111130', 0), []);
  assert.deepEqual(blockOf(piles(6), '111121', 4), { reason: 'piled', cells: [] });
  assert.deepEqual(blockOf(pairs(6), '111121', 4), { reason: 'paired', cells: [] });
  assert.equal(isDone(piles(6), '033000'), true);
  assert.equal(isDone(piles(6), '032100'), false);
});

test('짝 짓기: 넷을 건너뛰면 12개부터 된다(직접 만들기에는 없는 건너뛰는 수. 다른 방법으로만 따진다)', () => {
  const works = [];
  for (let n = 2; n <= 14; n++) if (brutePairs(n, 4).possible) works.push(n);
  assert.deepEqual(works, [12, 14]);
});
