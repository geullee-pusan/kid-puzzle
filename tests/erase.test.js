// 지우고 쓰기 예언의 판과 풀이: 규칙대로 쓰는 수, 지우기 차례의 다시 하기(자리와 합), 끝에 남길 수 있는 수, 바뀌지 않는 것.
// 끝에 남는 수는 놓인 차례 그대로 모든 차례를 해 보는 다른 방법(tests/helpers/brute-erase.js)으로 다시 따진다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MAX_CHIPS, MAX_VALUE, RULES, STORY, checkBoard, combine, finalsOf, fixedFinal, leftTrail, replay, solve, sumOf, trailTo, valueOk } from '../src/core/erase.js';
import { bruteFinals, playRandom } from './helpers/brute-erase.js';

/** 0부터 top까지의 수로 만든 count개짜리 묶음(작은 것부터)을 모두 */
function multisets(count, low, top) {
  const out = [];
  const walk = (from, list) => {
    if (list.length === count) {
      out.push(list.slice());
      return;
    }
    for (let value = from; value <= top; value++) walk(value, [...list, value]);
  };
  walk(low, []);
  return out;
}

test('규칙: 같으면 0 다르면 1, 합에서 1 빼기, 두 수의 차. 칠판의 수는 규칙마다 정해진 범위다', () => {
  assert.deepEqual(RULES, ['same', 'less', 'diff']);
  assert.deepEqual([combine('same', 1, 1), combine('same', 0, 0), combine('same', 0, 1)], [0, 0, 1]);
  assert.deepEqual([combine('less', 3, 5), combine('less', 1, 1)], [7, 1]);
  assert.deepEqual([combine('diff', 3, 8), combine('diff', 8, 3), combine('diff', 4, 4)], [5, 5, 0]);
  assert.ok(valueOk('same', 1) && !valueOk('same', 2));
  // 합에서 1 빼기의 칠판에 0이 있으면 0과 0에서 음수가 나온다. 그래서 1부터다
  assert.ok(!valueOk('less', 0) && valueOk('less', MAX_VALUE) && !valueOk('less', MAX_VALUE + 1));
  assert.ok(valueOk('diff', 0) && !valueOk('diff', -1));
  assert.equal(checkBoard({ rule: 'same', nums: [1, 0, 1] }), null);
  assert.equal(checkBoard({ rule: 'same', nums: [1, 2] }), 'value');
  assert.equal(checkBoard({ rule: 'less', nums: [3] }), 'count');
  assert.equal(checkBoard({ rule: 'diff', nums: Array(MAX_CHIPS + 1).fill(1) }), 'count');
  assert.equal(checkBoard({ rule: 'sum', nums: [1, 2] }), 'rule');
  assert.equal(checkBoard(null), 'no-board');
});

test('지우기 다시 하기: 새 수는 나중에 누른 수의 자리에 쓰고, 먼저 누른 수의 자리는 빈다. 지울 때마다 합을 적는다', () => {
  const board = { rule: 'diff', nums: [4, 1, 5, 3] };
  const one = replay(board, [[0, 2]]);
  assert.equal(one.ok, true);
  assert.deepEqual(one.chips, [{ id: 1, value: 1, slot: 1 }, { id: 4, value: 1, slot: 2 }, { id: 3, value: 3, slot: 3 }]);
  assert.equal(one.fresh, 4);
  assert.deepEqual(one.sums, [13, 5]);
  const all = replay(board, [[0, 2], [1, 4], [5, 3]]);
  assert.deepEqual(all.chips, [{ id: 6, value: 3, slot: 3 }]);
  assert.deepEqual(all.sums, [13, 5, 3, 3]);
  // 없는 수, 같은 수 두 번, 이미 지운 수는 할 수 없다
  assert.equal(replay(board, [[0, 0]]).ok, false);
  assert.equal(replay(board, [[0, 9]]).ok, false);
  assert.equal(replay(board, [[0, 2], [0, 1]]).ok, false);
  assert.equal(replay(board, 'x').ok, false);
  // 앞의 두 수부터 지우는 차례
  assert.deepEqual(leftTrail(board), [[0, 1], [4, 2], [5, 3]]);
  assert.equal(replay(board, leftTrail(board)).chips.length, 1);
});

test('같으면 0 다르면 1: 0과 1뿐인 칠판(수 둘에서 일곱)을 모두 해 보면 끝에 남는 수는 늘 하나이고, 1의 개수가 홀수면 1이다', () => {
  for (let count = 2; count <= 7; count++) {
    for (let mask = 0; mask < 1 << count; mask++) {
      const nums = Array.from({ length: count }, (_, index) => (mask >> index) & 1);
      const ones = nums.filter((value) => value === 1).length;
      assert.deepEqual(bruteFinals('same', nums), [ones % 2], nums.join(''));
      assert.deepEqual(finalsOf('same', nums), [ones % 2], nums.join(''));
      assert.equal(fixedFinal({ rule: 'same', nums }), ones % 2);
    }
  }
});

test('합에서 1 빼기: 1부터 5까지의 수로 만든 칠판(수 둘에서 다섯)을 모두 해 보면 끝에 남는 수는 늘 (합) - (수의 개수 - 1)이다', () => {
  for (let count = 2; count <= 5; count++) {
    for (const nums of multisets(count, 1, 5)) {
      const final = sumOf(nums) - (count - 1);
      assert.deepEqual(bruteFinals('less', nums), [final], nums.join(','));
      assert.equal(fixedFinal({ rule: 'less', nums }), final);
    }
  }
  // 수가 일곱인 칠판도 몇 개 모두 해 본다
  for (const nums of [[9, 1, 4, 7, 2, 2, 8], [1, 1, 1, 1, 1, 1, 1], [20, 19, 3, 5, 6, 1, 2]]) assert.deepEqual(bruteFinals('less', nums), [sumOf(nums) - 6], nums.join(','));
});

test('두 수의 차: 0부터 6까지의 수로 만든 칠판(수 둘에서 다섯)을 모두 해 보면, 풀이 프로그램이 구한 남길 수 있는 수와 같다', () => {
  let evenNoZero = 0;
  for (let count = 2; count <= 5; count++) {
    for (const nums of multisets(count, 0, 6)) {
      const finals = bruteFinals('diff', nums);
      assert.deepEqual(finalsOf('diff', nums), finals, nums.join(','));
      // 바뀌지 않는 것: 남길 수 있는 수는 모두 처음 합과 홀짝이 같다. 가장 큰 수보다 커지지 않는다
      for (const value of finals) assert.equal(value % 2, sumOf(nums) % 2, nums.join(','));
      assert.ok(finals.at(-1) <= Math.max(...nums), nums.join(','));
      // 합이 홀수면 0을 남길 수 없다. 합이 짝수인데 0을 남길 수 없는 칠판도 있다
      if (sumOf(nums) % 2 === 1) assert.ok(!finals.includes(0), nums.join(','));
      else if (!finals.includes(0)) evenNoZero += 1;
    }
  }
  assert.ok(evenNoZero > 0);
  assert.deepEqual(bruteFinals('diff', [2, 4]), [2]);
  assert.deepEqual(bruteFinals('diff', [1, 1, 4]), [2, 4]);
});

test('두 수의 차: 합이 짝수인데 0을 남길 수 없는 칠판이 흔하다. 1~9로 만든 수 셋은 80가지 가운데 60가지(가장 큰 수가 다른 두 수의 합일 때만 0), 수 넷은 255가지 가운데 137가지', () => {
  const count = (size) => {
    let even = 0;
    let noZero = 0;
    for (const nums of multisets(size, 1, 9)) {
      if (sumOf(nums) % 2 === 1) continue;
      even += 1;
      const zero = bruteFinals('diff', nums).includes(0);
      if (!zero) noZero += 1;
      if (size === 3) assert.equal(zero, nums[2] === nums[0] + nums[1], nums.join(','));
    }
    return [even, noZero];
  };
  assert.deepEqual(count(3), [80, 60]);
  assert.deepEqual(count(4), [255, 137]);
});

test('두 수의 차: 수가 여섯이나 일곱인 칠판도 다른 방법과 같다. 1부터 n까지(n은 4~7)는 n 이하의 수 가운데 합과 홀짝이 같은 수를 모두 남길 수 있다', () => {
  for (const nums of [[4, 1, 5, 3, 9, 2], [8, 8, 9, 9, 4, 7], [1, 2, 3, 4, 5, 6, 7], [20, 3, 17, 6, 6, 11, 2], [9, 9, 9, 9, 9, 1]]) assert.deepEqual(finalsOf('diff', nums), bruteFinals('diff', nums), nums.join(','));
  for (let n = 4; n <= 7; n++) {
    const nums = Array.from({ length: n }, (_, index) => index + 1);
    const sum = (n * (n + 1)) / 2;
    const all = Array.from({ length: n + 1 }, (_, value) => value).filter((value) => value % 2 === sum % 2);
    assert.deepEqual(bruteFinals('diff', nums), all, `1부터 ${n}까지`);
  }
  // 풀이 프로그램으로는 8~10까지도 그렇다(1부터 3까지는 0 하나뿐)
  for (let n = 8; n <= 10; n++) {
    const sum = (n * (n + 1)) / 2;
    assert.deepEqual(finalsOf('diff', Array.from({ length: n }, (_, index) => index + 1)), Array.from({ length: n + 1 }, (_, value) => value).filter((value) => value % 2 === sum % 2), `1부터 ${n}까지`);
  }
  assert.deepEqual(finalsOf('diff', [1, 2, 3]), [0, 2]);
});

test('풀이: 끝에 남는 수, 남길 수 있는 수, 0을 남길 수 있는지, 지우는 차례 하나. 0을 남길 수 있으면 0을 남기는 차례다', () => {
  const same = solve({ rule: 'same', nums: [1, 0, 1, 1, 0] });
  assert.deepEqual([same.final, same.finals, same.parity, same.zero], [1, [1], 1, false]);
  const less = solve({ rule: 'less', nums: [3, 5, 2] });
  assert.deepEqual([less.final, less.finals, less.sum], [8, [8], 10]);
  const diff = solve({ rule: 'diff', nums: [2, 3, 5] });
  assert.deepEqual([diff.final, diff.finals, diff.zero], [null, [0, 4], true]);
  assert.deepEqual(replay({ rule: 'diff', nums: [2, 3, 5] }, diff.order).chips.map((chip) => chip.value), [0]);
  const odd = solve({ rule: 'diff', nums: [1, 2, 4] });
  assert.deepEqual([odd.finals, odd.zero, odd.parity], [[1, 3], false, 1]);
  // 큰 칠판(차를 쓰는 판, 수가 아홉 이상)은 남길 수 있는 수를 따지지 않고 홀짝만 안다
  const big = solve({ rule: 'diff', nums: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] });
  assert.deepEqual([big.finals, big.zero, big.parity], [null, null, 0]);
  assert.equal(solve({ rule: 'diff', nums: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] }).zero, false);
  assert.equal(replay({ rule: 'diff', nums: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }, big.order).chips.length, 1);
});

test('남기는 차례: 남길 수 있는 수마다 그 수를 남기는 차례를 찾고, 남길 수 없는 수는 null이다', () => {
  for (const nums of [[4, 1, 5, 3], [2, 3, 5], [8, 5, 5, 8, 1, 9], [1, 2, 3, 4, 5, 6, 7]]) {
    const board = { rule: 'diff', nums };
    const finals = bruteFinals('diff', nums);
    for (let target = 0; target <= Math.max(...nums); target++) {
      const trail = trailTo(board, target);
      if (!finals.includes(target)) {
        assert.equal(trail, null, `${nums.join(',')} → ${target}`);
        continue;
      }
      const end = replay(board, trail);
      assert.ok(end.ok, `${nums.join(',')} → ${target}`);
      assert.deepEqual(end.chips.map((chip) => chip.value), [target]);
    }
  }
});

test('긴 칠판: 같으면 0 다르면 1과 합에서 1 빼기는 아무 차례로 지워도 풀이 프로그램의 수가 남는다', () => {
  const boards = [
    { rule: 'less', nums: Array.from({ length: 20 }, (_, index) => index + 1) },
    { rule: 'less', nums: [9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9] },
    { rule: 'same', nums: [1, 0, 1, 1, 0, 1, 1, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1] },
  ];
  for (const board of boards) {
    const { final } = solve(board);
    for (let seed = 1; seed <= 30; seed++) assert.equal(playRandom(board.rule, board.nums, seed), final, `${board.rule} ${seed}`);
  }
  assert.equal(solve(boards[0]).final, 191);
  // 차를 쓰는 긴 칠판은 아무 차례로 지워도 합의 홀짝만 같다
  const diff = { rule: 'diff', nums: Array.from({ length: 20 }, (_, index) => index + 1) };
  const seen = new Set();
  for (let seed = 1; seed <= 30; seed++) {
    const value = playRandom('diff', diff.nums, seed);
    assert.equal(value % 2, 0);
    seen.add(value);
  }
  assert.ok(seen.size > 1);
  // "왜 그럴까?"에 쓰는 작은 칠판은 규칙에 맞다
  for (const [rule, board] of Object.entries(STORY)) {
    assert.equal(board.rule, rule);
    assert.equal(checkBoard(board), null);
  }
});
