// 팬케이크 뒤집기의 판과 풀이 프로그램 점검. 선생님이 말하는 "가장 적은 횟수"는 모두 다른 방법으로 다시 구해 견준다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MAX_BURNT,
  MAX_SIZE,
  MIN_SIZE,
  biggestFirst,
  boardOfRank,
  checkBoard,
  copyBoard,
  doneBoard,
  fewestOf,
  fewestTable,
  flip,
  inOrder,
  isDone,
  rankOf,
  replay,
  solve,
  stateCount,
  upCount,
  worstOf,
  worstTable,
} from '../src/core/pancake.js';
import { bruteBiggestFirst, bruteDone, bruteFewest, bruteReplay, permutations, sides } from './helpers/brute-pancake.js';

test('뒤집기: 위의 k장의 차례가 거꾸로 되고, 탄 면 팬케이크는 그 k장의 위아래도 바뀐다', () => {
  assert.deepEqual(flip({ stack: [2, 4, 1, 3], up: null }, 2), { stack: [4, 2, 1, 3], up: null });
  assert.deepEqual(flip({ stack: [2, 4, 1, 3], up: null }, 4), { stack: [3, 1, 4, 2], up: null });
  assert.deepEqual(flip({ stack: [2, 1, 3], up: [0, 1, 1] }, 2), { stack: [1, 2, 3], up: [0, 1, 1] });
  assert.deepEqual(flip({ stack: [2, 1, 3], up: [0, 1, 1] }, 1), { stack: [2, 1, 3], up: [1, 1, 1] });
  // 탄 면이 없는 판에서 맨 위 한 장만 뒤집는 것은 아무것도 바꾸지 않는다
  assert.deepEqual(flip({ stack: [3, 1, 2], up: null }, 1), { stack: [3, 1, 2], up: null });
  // 같은 자리를 두 번 뒤집으면 제자리다
  for (const stack of permutations(4)) for (const up of sides(4)) for (let k = 1; k <= 4; k++) assert.deepEqual(flip(flip({ stack, up }, k), k), { stack, up });
  // 처음 판은 바뀌지 않는다
  const board = { stack: [2, 1], up: [1, 0] };
  flip(board, 2);
  assert.deepEqual(board, { stack: [2, 1], up: [1, 0] });
});

test('다 됐다: 크기 차례대로(가장 큰 것이 맨 아래)이고, 탄 면 팬케이크는 탄 면이 모두 아래다', () => {
  assert.equal(isDone(doneBoard(5)), true);
  assert.equal(isDone(doneBoard(4, true)), true);
  assert.equal(isDone({ stack: [1, 2, 3], up: [0, 1, 0] }), false);
  assert.equal(inOrder({ stack: [1, 2, 3], up: [0, 1, 0] }), true);
  assert.equal(upCount({ stack: [1, 2, 3], up: [0, 1, 1] }), 2);
  assert.equal(isDone({ stack: [2, 1, 3], up: null }), false);
  assert.deepEqual(replay({ stack: [2, 1, 3], up: null }, [2]), { stack: [1, 2, 3], up: null });
  assert.equal(replay({ stack: [2, 1, 3], up: null }, [4]), null);
  assert.equal(replay({ stack: [2, 1, 3], up: null }, [0]), null);
  assert.equal(replay({ stack: [2, 1, 3], up: null }, 'x'), null);
});

test('판의 값: 크기는 1부터 n까지 한 번씩(2~8장), 탄 면 판은 6장까지', () => {
  assert.equal(MIN_SIZE, 2);
  assert.equal(MAX_SIZE, 8);
  assert.equal(MAX_BURNT, 6);
  assert.equal(checkBoard({ stack: [2, 1, 3], up: null }), null);
  assert.equal(checkBoard({ stack: [2, 1, 3], up: [0, 1, 0] }), null);
  assert.notEqual(checkBoard({ stack: [1], up: null }), null);
  assert.notEqual(checkBoard({ stack: [1, 2, 3, 4, 5, 6, 7, 8, 9], up: null }), null);
  assert.notEqual(checkBoard({ stack: [1, 1, 3], up: null }), null);
  assert.notEqual(checkBoard({ stack: [1, 2, 4], up: null }), null);
  assert.notEqual(checkBoard({ stack: [1, 2, 3], up: [0, 2, 0] }), null);
  assert.notEqual(checkBoard({ stack: [1, 2, 3], up: [0, 1] }), null);
  assert.notEqual(checkBoard({ stack: [1, 2, 3, 4, 5, 6, 7], up: [0, 0, 0, 0, 0, 0, 0] }), null);
  assert.notEqual(checkBoard({ stack: [1, 2, 3] }), null);
  assert.notEqual(checkBoard(null), null);
  const board = { stack: [2, 1], up: [1, 0] };
  const copy = copyBoard(board);
  copy.stack[0] = 9;
  assert.deepEqual(board, { stack: [2, 1], up: [1, 0] });
});

test('더미의 번호: 번호와 더미는 하나씩 짝지어진다(탄 면이 없는 2~8장, 탄 면 2~5장)', () => {
  for (const [n, burnt] of [[2, false], [3, false], [4, false], [5, false], [6, false], [7, false], [8, false], [2, true], [3, true], [4, true], [5, true]]) {
    const total = stateCount(n, burnt);
    for (let rank = 0; rank < total; rank++) {
      const board = boardOfRank(n, burnt, rank);
      assert.equal(checkBoard(board), null);
      assert.equal(rankOf(board), rank, `${n}장 ${burnt} ${rank}`);
    }
  }
  assert.equal(stateCount(8, false), 40320);
  assert.equal(stateCount(6, true), 46080);
});

test('가장 적은 횟수: 탄 면이 없는 2~7장의 모든 더미에서 앞으로 찾아 가는 다른 방법과 같다', () => {
  for (let n = 2; n <= 7; n++) {
    let most = 0;
    for (const stack of permutations(n)) {
      const board = { stack, up: null };
      const brute = bruteFewest(stack);
      most = Math.max(most, brute.fewest);
      assert.equal(fewestOf(board), brute.fewest, stack.join(''));
      const solution = solve(board);
      assert.equal(solution.possible, true);
      assert.equal(solution.fewest, brute.fewest);
      assert.equal(solution.path.length, brute.fewest);
      assert.ok(bruteDone(bruteReplay(stack, null, solution.path).stack), stack.join(''));
      assert.ok(solution.path.every((k) => k >= 2 && k <= n));
    }
    // 장 수마다 가장 많이 뒤집어야 하는 횟수도 다른 방법으로 구한 것과 같다
    assert.equal(worstOf(n).worst, most, `${n}장`);
  }
});

test('가장 적은 횟수: 탄 면 2~4장의 모든 더미와 5장 더미 다섯에 하나에서 다른 방법과 같다', () => {
  let seen = 0;
  for (let n = 2; n <= 5; n++) {
    for (const stack of permutations(n)) {
      for (const up of sides(n)) {
        // 5장(3,840가지)은 다섯에 하나만 앞으로 찾는다(모두는 아래의 표 검사가 본다). 다른 테스트와 함께 돌 때 오래 걸리지 않게 한다
        seen += 1;
        if (n === 5 && seen % 5 !== 0) continue;
        const board = { stack, up };
        const brute = bruteFewest(stack, up);
        assert.equal(fewestOf(board), brute.fewest, `${stack.join('')} ${up.join('')}`);
        const solution = solve(board);
        assert.equal(solution.path.length, brute.fewest);
        const after = bruteReplay(stack, up, solution.path);
        assert.ok(bruteDone(after.stack, after.up));
      }
    }
  }
});

/**
 * 큰 더미는 앞으로 찾기가 오래 걸린다. 대신 표가 가장 짧은 거리의 성질을 모두 가졌는지 본다:
 * 다 된 더미는 0이고, 다른 더미는 한 번 뒤집어 갈 수 있는 더미들의 가장 작은 값보다 꼭 1이 크다.
 * 이어진 판에서 이 성질을 가진 값은 가장 짧은 거리 하나뿐이다. 뒤집기는 테스트가 따로 만든 것으로 한다.
 */
function checkTable(n, burnt) {
  const table = fewestTable(n, burnt);
  const total = stateCount(n, burnt);
  const goal = rankOf(doneBoard(n, burnt));
  for (let rank = 0; rank < total; rank++) {
    const board = boardOfRank(n, burnt, rank);
    if (rank === goal) {
      assert.equal(table[rank], 0);
      continue;
    }
    let best = Infinity;
    for (let k = burnt ? 1 : 2; k <= n; k++) {
      const next = bruteReplay(board.stack, board.up, [k]);
      best = Math.min(best, table[rankOf(next)]);
    }
    assert.equal(table[rank], best + 1, `${n}장 ${board.stack.join('')}`);
  }
}

test('큰 더미의 표(탄 면이 없는 8장, 탄 면 5·6장. 6장 이상은 직접 만들기에서만 쓴다): 가장 짧은 거리의 성질을 모두 가졌다', () => {
  checkTable(8, false);
  checkTable(6, true);
  checkTable(5, true);
  // 앞으로 모두 찾아 본 크기에서도 같은 성질이 맞는지 본다(검사기를 검사한다)
  checkTable(5, false);
  checkTable(4, true);
});

test('장 수마다 가장 많이 뒤집어야 하는 횟수(풀이 프로그램이 알려 준 것): 3, 4, 5, 7, 8, 9번. 탄 면은 4, 6, 8, 10, 12번', () => {
  // 2~7장은 위의 테스트가 다른 방법으로 모든 더미를 따져 같은 값을 얻는다
  assert.deepEqual([3, 4, 5, 6, 7, 8].map((n) => worstOf(n).worst), [3, 4, 5, 7, 8, 9]);
  assert.deepEqual([2, 3, 4, 5, 6].map((n) => worstOf(n, true).worst), [4, 6, 8, 10, 12]);
  // 가장 많이 뒤집어야 하는 더미의 수
  assert.deepEqual(worstOf(6).counts.at(-1), 2);
  assert.deepEqual(worstOf(7).counts.at(-1), 35);
  assert.equal(worstOf(4).counts.reduce((sum, value) => sum + value, 0), 24);
});

test('큰 것부터 보내기: 늘 다 쌓이고, 한 장에 많아야 두 번(n장이면 많아야 2n - 3번). 장 수마다 가장 많이 걸리는 횟수는 2n - 3번이다', () => {
  for (let n = 2; n <= 7; n++) {
    let most = 0;
    for (const stack of permutations(n)) {
      const flips = biggestFirst({ stack, up: null });
      assert.deepEqual(flips, bruteBiggestFirst(stack), stack.join(''));
      assert.ok(bruteDone(bruteReplay(stack, null, flips).stack), stack.join(''));
      assert.ok(flips.length <= 2 * n - 3, stack.join(''));
      // 가장 적은 횟수보다 적을 수는 없다
      assert.ok(flips.length >= fewestOf({ stack, up: null }));
      most = Math.max(most, flips.length);
    }
    assert.equal(most, 2 * n - 3, `${n}장`);
  }
  const rows = worstTable([3, 4, 5, 6, 7]);
  assert.deepEqual(rows, [
    { n: 3, fewest: 3, method: 3 },
    { n: 4, fewest: 4, method: 5 },
    { n: 5, fewest: 5, method: 7 },
    { n: 6, fewest: 7, method: 9 },
    { n: 7, fewest: 8, method: 11 },
  ]);
});

test('풀이는 같은 판에 늘 같은 방법을 내고, 탄 면 5·6장의 방법도 다 쌓는다', () => {
  assert.deepEqual(solve({ stack: [3, 2, 4, 1], up: null }), { possible: true, fewest: 3, path: [2, 3, 4] });
  assert.deepEqual(solve({ stack: [3, 2, 4, 1], up: null }), solve({ stack: [3, 2, 4, 1], up: null }));
  assert.deepEqual(solve(doneBoard(5)), { possible: true, fewest: 0, path: [] });
  for (const board of [
    { stack: [5, 3, 1, 4, 2], up: [1, 0, 1, 1, 0] },
    { stack: [1, 2, 3, 4, 5, 6], up: [1, 1, 1, 1, 1, 1] },
    { stack: [6, 5, 4, 3, 2, 1], up: [0, 0, 0, 0, 0, 0] },
    { stack: [8, 7, 6, 5, 4, 3, 2, 1], up: null },
  ]) {
    const solution = solve(board);
    const after = bruteReplay(board.stack, board.up, solution.path);
    assert.ok(bruteDone(after.stack, after.up));
    assert.equal(solution.path.length, fewestOf(board));
  }
});
