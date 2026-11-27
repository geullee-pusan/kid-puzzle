// 낼 수 없는 금액 풀이 프로그램 점검: 낼 수 있는지, 낼 수 없는 가장 큰 금액과 그 수, 끝이 없는 동전을 동전마다 몇 개를 쓸지 모두 늘어놓는
// 다른 방법(tests/helpers/brute-nopay.js)과 견준다. 한 일을 되풀이하는 것(담기, 빼기, 칠하기, 고르기, 다시 담기)과 판의 규격도 본다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MAX_SUM, canPay, checkBoard, copyBoard, endOf, gcdOf, nextUnpayable, replay, solve, sumOf, topLimit, unpayableIn, wayOf } from '../src/core/nopay.js';
import { bruteCanPay, bruteGcd, bruteUnpayable } from './helpers/brute-nopay.js';

/** a < b(< c)인 동전 묶음들 */
function pairs(low, high) {
  const list = [];
  for (let a = low; a <= high; a++) for (let b = a + 1; b <= high; b++) list.push([a, b]);
  return list;
}
function triples(low, high) {
  const list = [];
  for (let a = low; a <= high; a++) for (let b = a + 1; b <= high; b++) for (let c = b + 1; c <= high; c++) list.push([a, b, c]);
  return list;
}

test('낼 수 있는가: 동전마다 몇 개를 쓸지 모두 늘어놓는 방법과 같다. 가장 적은 동전으로 내는 법은 합이 그 금액이다', () => {
  for (const coins of [...pairs(1, 9), ...triples(2, 8)]) {
    for (let amount = 0; amount <= 40; amount++) {
      assert.equal(canPay(coins, amount), bruteCanPay(coins, amount), `${coins} ${amount}`);
      const way = wayOf(coins, amount);
      if (way) assert.equal(sumOf(coins, way), amount);
      else assert.equal(bruteCanPay(coins, amount), false);
    }
  }
  // 가장 적은 동전: 3원과 5원으로 15원은 5원 셋, 9원은 3원 셋
  assert.deepEqual(wayOf([3, 5], 15), [0, 3]);
  assert.deepEqual(wayOf([3, 5], 9), [3, 0]);
  assert.equal(canPay([3, 5], -1), false);
});

test('끝: 함께 나누는 수가 1이면 낼 수 없는 금액이 다른 방법으로 넉넉한 끝까지 센 것과 꼭 같고, 1보다 크면 끝이 없다', () => {
  for (const coins of [...pairs(2, 15), ...triples(2, 11)]) {
    const end = endOf(coins);
    const g = bruteGcd(coins);
    assert.equal(end.gcd, g, `${coins}`);
    assert.equal(gcdOf(coins), g);
    // 넉넉한 끝: 두 작은 동전의 곱과 큰 동전을 더한 데까지(두 동전만으로도 그 앞에서 끝난다)
    const limit = coins[0] * coins[1] + coins.at(-1);
    const missing = bruteUnpayable(coins, limit);
    if (g > 1) {
      assert.deepEqual([end.largest, end.from, end.count, end.unpayable], [null, null, null, null]);
      // g로 나누어떨어지지 않는 금액은 끝까지 낼 수 없다
      for (let amount = 1; amount <= limit; amount++) if (amount % g !== 0) assert.ok(missing.includes(amount));
      continue;
    }
    assert.deepEqual(end.unpayable, missing, `${coins}`);
    assert.equal(end.largest, missing.at(-1) ?? 0);
    assert.equal(end.from, end.largest + 1);
    assert.equal(end.count, missing.length);
  }
});

test('두 가지 동전의 식(왜 그럴까의 끝 장): 함께 나누는 수가 1이면 가장 큰 금액은 큰 × 작은 − 큰 − 작은, 그 수는 (큰−1)×(작은−1)÷2', () => {
  let checked = 0;
  for (const [a, b] of pairs(2, 30)) {
    if (bruteGcd([a, b]) !== 1) continue;
    const end = endOf([a, b]);
    assert.equal(end.largest, b * a - b - a, `${a}, ${b}`);
    assert.equal(end.count, ((b - 1) * (a - 1)) / 2, `${a}, ${b}`);
    checked += 1;
  }
  assert.equal(checked, 248);
  // 다른 방법으로도(작은 짝)
  for (const [a, b] of pairs(2, 12)) {
    if (bruteGcd([a, b]) !== 1) continue;
    const missing = bruteUnpayable([a, b], a * b);
    assert.equal(missing.at(-1), a * b - a - b);
    assert.equal(missing.length, ((a - 1) * (b - 1)) / 2);
  }
  // 세 가지 동전에는 그런 식이 없다: 6, 9, 20원은 43원, 6, 10, 15원은 29원(다른 방법으로)
  assert.equal(endOf([6, 9, 20]).largest, 43);
  assert.equal(bruteUnpayable([6, 9, 20], 70).at(-1), 43);
  assert.equal(endOf([6, 9, 20]).count, bruteUnpayable([6, 9, 20], 70).length);
  assert.equal(endOf([6, 10, 15]).largest, 29);
  assert.equal(bruteUnpayable([6, 10, 15], 60).at(-1), 29);
  // 1원짜리가 있으면 낼 수 없는 금액이 없다
  assert.deepEqual([endOf([1, 5]).largest, endOf([1, 5]).count, endOf([1, 5]).from], [0, 0, 1]);
});

test('그보다 큰 낼 수 없는 금액(자물쇠의 말): 다른 방법으로 찾은 것과 같다', () => {
  for (const coins of [[3, 5], [4, 6], [2, 4], [6, 10, 15], [4, 6, 9], [3, 6]]) {
    for (let amount = 1; amount <= 40; amount++) {
      const next = nextUnpayable(coins, amount);
      const end = endOf(coins);
      if (end.gcd === 1 && amount >= end.largest) {
        assert.equal(next, null);
        continue;
      }
      let expected = amount + 1;
      while (bruteCanPay(coins, expected)) expected += 1;
      assert.equal(next, expected, `${coins} ${amount}`);
    }
  }
});

test('판의 규격: 종류, 동전(두세 가지, 작은 것부터, 서로 다름), 띠 끝(줄로 나눠 놓아도 여덟 줄 안). 모두 찾기와 어디부터는 끝이 보이는 띠', () => {
  assert.equal(checkBoard({ kind: 'all', coins: [3, 5], top: 20 }), null);
  assert.equal(checkBoard({ kind: 'end', coins: [2, 4], top: 16 }), null);
  assert.equal(checkBoard({ kind: 'end', coins: [1, 5], top: 8 }), null);
  assert.equal(checkBoard({ kind: 'end', coins: [2, 4], top: 17 }), 'top');
  assert.equal(checkBoard({ kind: 'end', coins: [5, 3], top: 20 }), 'coins');
  assert.equal(checkBoard({ kind: 'end', coins: [3, 3], top: 20 }), 'coins');
  assert.equal(checkBoard({ kind: 'end', coins: [3], top: 20 }), 'coins');
  assert.equal(checkBoard({ kind: 'end', coins: [2, 3, 4, 5], top: 16 }), 'coins');
  assert.equal(checkBoard({ kind: 'what', coins: [3, 5], top: 20 }), 'kind');
  // 모두 찾기는 낼 수 없는 가장 큰 금액 뒤로 작은 동전의 값만큼이 띠에 있어야 한다
  assert.equal(checkBoard({ kind: 'all', coins: [3, 5], top: 9 }), 'top');
  assert.equal(checkBoard({ kind: 'all', coins: [3, 5], top: 10 }), null);
  assert.equal(checkBoard({ kind: 'from', coins: [4, 6], top: 20 }), 'end');
  assert.equal(topLimit([3, 5]), 24);
  assert.equal(topLimit([6, 10, 15]), 40);
  assert.deepEqual(copyBoard({ kind: 'all', coins: [3, 5], top: 20, extra: 1 }), { kind: 'all', coins: [3, 5], top: 20 });
});

test('한 일 되풀이: 담기, 빼기, 칠하기(못 낸다고 고른 것은 풀린다), 고르기(칠한 금액은 못 고른다), 칠한 금액의 동전 다시 담기', () => {
  const board = { kind: 'all', coins: [3, 5], top: 20 };
  let state = replay(board, ['c0', 'c0', 'c1']);
  assert.deepEqual([state.ok, state.tray, state.sum], [true, [2, 1], 11]);
  state = replay(board, ['m11', 'm4', 'c0', 'c0', 'c1', 'p']);
  assert.deepEqual(state.paid, [[11, [2, 1]]]);
  assert.deepEqual(state.marks, [4]);
  // 칠한 금액은 고를 수 없다. 칠한 금액을 누르면 그때의 동전이 다시 담긴다
  assert.equal(replay(board, ['c1', 'p', 'm5']).ok, false);
  state = replay(board, ['c1', 'p', 'c0', 'c0', 'w5']);
  assert.deepEqual(state.tray, [0, 1]);
  assert.equal(replay(board, ['w5']).ok, false);
  // 같은 금액을 다시 칠해도 처음 낸 법이 남는다
  state = replay(board, ['c0', 'c0', 'c0', 'c0', 'c0', 'p', 'x0', 'x0', 'x0', 'x0', 'x0', 'c1', 'c1', 'c1', 'p']);
  assert.deepEqual(state.paid, [[15, [5, 0]]]);
  // 고르기를 다시 누르면 그만둔다
  assert.deepEqual(replay(board, ['m7', 'm7']).marks, []);
  // 판에 없는 일
  assert.equal(replay(board, ['p']).ok, false); // 담은 것이 없다
  assert.equal(replay(board, ['x0']).ok, false);
  assert.equal(replay(board, ['c2']).ok, false);
  assert.equal(replay(board, ['m21']).ok, false);
  assert.equal(replay(board, ['m0']).ok, false);
  assert.equal(replay(board, ['e']).ok, false);
  assert.equal(replay(board, 'c0').ok, false);
  assert.equal(replay(board, ['c1', 'c1', 'c1', 'c1', 'c1', 'p']).ok, false); // 25원은 띠 밖이다
  // 담은 동전의 합은 99원을 넘지 않는다
  const many = Array(19).fill('c1');
  assert.equal(replay(board, many).sum, 95);
  assert.equal(replay(board, [...many, 'c1']).ok, false);
  assert.equal(MAX_SUM, 99);
});

test('풀이: 끝이 있는 판과 끝이 없는 판. 띠 안의 낼 수 없는 금액', () => {
  const first = solve({ kind: 'all', coins: [3, 5], top: 20 });
  assert.deepEqual([first.possible, first.gcd, first.largest, first.from, first.count], [true, 1, 7, 8, 4]);
  assert.deepEqual(first.unpayable, [1, 2, 4, 7]);
  assert.equal(first.payable.length, 16);
  const endless = solve({ kind: 'end', coins: [4, 6], top: 24 });
  assert.deepEqual([endless.possible, endless.gcd, endless.largest, endless.from], [false, 2, null, null]);
  assert.deepEqual(endless.unpayable, bruteUnpayable([4, 6], 24));
  assert.deepEqual(unpayableIn([2, 5], 12), [1, 3]);
});
