// 핀에 실 감기의 풀이 프로그램 점검: 실을 따라가며 센 가닥 수와 한 가닥의 핀 수가 다른 방법(tests/helpers/brute-pins.js)과 같은지,
// 아이가 누른 핀의 차례를 바르게 따라가는지(k칸 앞이 아닌 핀, 실이 지나간 핀에서 새 실을 매기는 받지 않는다) 본다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MAX_PINS, MAX_THREADS, MIN_PINS, aheadOf, allOne, checkBoard, choicesOf, countOf, firstMany, fullSteps, halfOf, nextPin, offsetOf, oneThreadKs, solve, threadsOf, windState } from '../src/core/pins.js';
import { gcd, groupsOf, onlyOneAndItself, returnAfter } from './helpers/brute-pins.js';

test('판의 규격: 핀 4~16개, 칸 수는 1부터 핀 수보다 하나 적은 수까지(칸 수를 고르는 판은 칸 수가 없다)', () => {
  assert.deepEqual([MIN_PINS, MAX_PINS, MAX_THREADS], [4, 16, 8]);
  assert.equal(checkBoard({ n: 12, k: 5 }), null);
  assert.equal(checkBoard({ n: 12, k: null }), null);
  assert.equal(checkBoard({ n: 16, k: 15 }), null);
  for (const bad of [null, { n: 3, k: 1 }, { n: 17, k: 2 }, { n: 12, k: 0 }, { n: 12, k: 12 }, { n: 12, k: 2.5 }, { n: 12 }]) assert.notEqual(checkBoard(bad), null, JSON.stringify(bad));
  assert.equal(aheadOf(12, 5, 10), 3);
  assert.equal(offsetOf(12, 10, 3), 5);
  assert.equal(offsetOf(12, 3, 3), 0);
  assert.deepEqual(choicesOf(13), [1, 2, 3, 4, 5, 6]);
  assert.equal(halfOf(15), 7);
});

test('모든 판(핀 4~40개, 모든 칸 수): 실 가닥 수는 이어진 묶음의 수, 두 수를 함께 나누는 가장 큰 수와 같고, 한 가닥의 핀 수는 처음 n의 배수가 되는 횟수다', () => {
  // 화면의 판은 16개까지지만, 이야기가 큰 판에서도 맞는지 더 크게 따져 본다.
  for (let n = MIN_PINS; n <= 40; n++) {
    for (let k = 1; k < n; k++) {
      const where = `핀 ${n}개, ${k}칸씩`;
      const threads = threadsOf(n, k);
      const { count, per, same } = countOf(n, k);
      const groups = groupsOf(n, k);
      assert.equal(count, threads.length, where);
      assert.equal(count, groups.length, where);
      assert.equal(count, gcd(n, k), where);
      assert.ok(same, where);
      assert.ok(groups.every((size) => size === per), where);
      assert.equal(per, returnAfter(n, k), where);
      assert.equal(per * count, n, where);
      // 모든 핀이 꼭 한 가닥에만 들어 있다
      assert.deepEqual(threads.flat().sort((a, b) => a - b), Array.from({ length: n }, (_, pin) => pin), where);
      // 거꾸로 도는 칸 수(n - k)도 가닥 수가 같다
      assert.equal(countOf(n, n - k).count, count, where);
    }
  }
});

test('핀 12개와 13개: 12개는 칸 수에 따라 1, 2, 3, 4, 1, 6가닥이고, 13개는 어느 칸 수로도 한 가닥이다', () => {
  assert.deepEqual(choicesOf(12).map((k) => countOf(12, k).count), [1, 2, 3, 4, 1, 6]);
  assert.deepEqual(choicesOf(13).map((k) => countOf(13, k).count), [1, 1, 1, 1, 1, 1]);
  assert.deepEqual(threadsOf(12, 4), [[0, 4, 8], [1, 5, 9], [2, 6, 10], [3, 7, 11]]);
  // 어느 칸 수로도 한 가닥인 핀 수는 1과 자기 자신으로만 똑같이 나누어지는 수뿐이다(하나씩 나누어 본 것과 같다)
  for (let n = 5; n <= MAX_PINS; n++) assert.equal(allOne(n), onlyOneAndItself(n), `핀 ${n}개`);
  for (let n = MIN_PINS; n <= MAX_PINS; n++) {
    assert.deepEqual(oneThreadKs(n), choicesOf(n).filter((k) => gcd(n, k) === 1), `핀 ${n}개`);
    assert.equal(firstMany(n), choicesOf(n).find((k) => gcd(n, k) > 1) ?? null, `핀 ${n}개`);
  }
  assert.deepEqual(solve({ n: 12, k: 4 }), { possible: true, count: 4, per: 3 });
  const table = solve({ n: 15, k: null });
  assert.deepEqual(table.ones, [1, 2, 4, 7]);
  assert.equal(table.allOne, false);
  assert.equal(table.firstMany, 3);
  assert.deepEqual(table.table.map((row) => row.count), [1, 1, 3, 1, 5, 3, 1]);
});

test('감기 따라가기: 실이 없을 때는 실이 없는 핀에서 매고, 감는 중에는 k칸 앞의 핀만 받는다. 처음 핀으로 돌아오면 그 가닥이 끝난다', () => {
  assert.deepEqual(windState(12, 4, []), { ok: true, threads: [], used: 0, open: false, last: null, next: null, complete: false });
  const one = windState(12, 4, [3, 7, 11]);
  assert.equal(one.ok, true);
  assert.deepEqual([one.open, one.last, one.next, one.used], [true, 11, 3, 3]);
  const closed = windState(12, 4, [3, 7, 11, 3]);
  assert.deepEqual(closed.threads, [{ pins: [3, 7, 11], closed: true }]);
  assert.equal(closed.open, false);
  // k칸 앞이 아닌 핀, 실이 지나간 핀에서 새 실 매기, 판 밖의 핀은 받지 않는다
  assert.equal(windState(12, 4, [3, 8]).ok, false);
  assert.equal(windState(12, 4, [3, 7, 11, 3, 7]).ok, false);
  assert.equal(windState(12, 4, [12]).ok, false);
  assert.equal(windState(12, 4, 'x').ok, false);
  // 어디서 시작하든 끝까지 감으면 가닥 수가 같다
  for (let n = MIN_PINS; n <= MAX_PINS; n++) {
    for (let k = 1; k < n; k++) {
      const steps = fullSteps(n, k);
      const state = windState(n, k, steps);
      assert.equal(state.complete, true, `${n}, ${k}`);
      assert.equal(state.threads.length, gcd(n, k), `${n}, ${k}`);
      assert.equal(steps.length, n + gcd(n, k), `${n}, ${k}`);
      assert.equal(nextPin(n, k, steps), null);
      // 감기 단추로 처음부터 끝까지 감으면 fullSteps와 같다
      const auto = [];
      for (let pin = nextPin(n, k, auto); pin !== null; pin = nextPin(n, k, auto)) auto.push(pin);
      assert.deepEqual(auto, steps, `${n}, ${k}`);
    }
  }
  // 다른 곳에서 시작해도 된다: 핀 12개, 5칸씩, 7번 핀에서 시작해 끝까지
  const start = [7];
  for (let pin = nextPin(12, 5, start); pin !== null && start.length < 20; pin = nextPin(12, 5, start)) start.push(pin);
  assert.equal(windState(12, 5, start).complete, true);
  assert.equal(start.at(-1), 7);
});
