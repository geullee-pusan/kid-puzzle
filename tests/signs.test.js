// 부호 넣어 수 만들기의 판과 풀이 프로그램 점검. 나오는 수, 방법의 수, 안 되는 까닭을 다른 방법(tests/helpers/brute-signs.js)으로 다시 따져 견준다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MAX_N,
  MIN_N,
  checkBoard,
  evaluate,
  hopPosition,
  hopReach,
  numberAfter,
  numbersOf,
  plusSigns,
  reasonOf,
  replay,
  rowReach,
  rowValue,
  signsAfter,
  solve,
  totalOf,
} from '../src/core/signs.js';
import { bruteMissing, hopOf, rowOf } from './helpers/brute-signs.js';

const minusCount = (signs) => signs.filter((sign) => sign === '-').length;

test('줄과 수: n부터 1까지, 모두 +일 때의 수, 부호를 넣은 값', () => {
  assert.deepEqual(numbersOf(5), [5, 4, 3, 2, 1]);
  assert.equal(totalOf(10), 55);
  assert.equal(rowValue(5, plusSigns(5)), 15);
  assert.equal(rowValue(5, ['+', '-', '+', '-']), 5 + 4 - 3 + 2 - 1);
  assert.equal(evaluate([1, 2, 3, 4, 5], ['-', '+', '+', '+']), 11);
  // 부호 칸 0번은 둘째 수(n−1) 앞이고, 마지막 칸은 1 앞이다
  assert.equal(numberAfter(5, 0), 4);
  assert.equal(numberAfter(5, 3), 1);
  assert.deepEqual(signsAfter(4, [2, 0, 2]), ['-', '+', '+']);
  assert.equal(hopPosition([1, 1, -1]), 0);
});

test('줄로 나오는 수와 방법의 수가 다른 방법으로 따진 것과 같다(n = 2~10). 적어 둔 방법은 그 수가 나오고 − 부호가 가장 적다', () => {
  for (let n = MIN_N; n <= MAX_N; n++) {
    const brute = rowOf(n);
    const reach = rowReach(n);
    assert.deepEqual([...reach.keys()].sort((a, b) => a - b), [...brute.keys()].sort((a, b) => a - b), `n=${n}`);
    for (const [value, { signs, ways }] of reach) {
      assert.equal(rowValue(n, signs), value);
      assert.equal(ways, brute.get(value).ways, `n=${n} ${value}`);
      assert.equal(minusCount(signs), brute.get(value).fewest, `n=${n} ${value}`);
    }
  }
});

test('메뚜기가 닿는 곳과 뛰는 법의 수가 다른 방법으로 따진 것과 같다(n = 2~10)', () => {
  for (let n = MIN_N; n <= MAX_N; n++) {
    const brute = hopOf(n);
    const reach = hopReach(n);
    assert.deepEqual([...reach.keys()].sort((a, b) => a - b), [...brute.keys()].sort((a, b) => a - b), `n=${n}`);
    for (const [at, { dirs, ways }] of reach) {
      assert.equal(hopPosition(dirs), at);
      assert.equal(dirs.length, n);
      assert.equal(ways, brute.get(at).ways, `n=${n} ${at}`);
      assert.equal(dirs.filter((dir) => dir < 0).length, brute.get(at).fewest);
    }
  }
});

test('안 되는 까닭: 목표 수 0부터 (모두 +일 때 + 5)까지, 안 되는 수는 모두 모두 +일 때보다 크거나 홀짝이 다르다', () => {
  for (let n = MIN_N; n <= MAX_N; n++) {
    const total = totalOf(n);
    const brute = rowOf(n);
    for (let target = 0; target <= total + 5; target++) {
      const reason = reasonOf(n, target);
      const can = brute.has(target);
      // n이 2일 때 0과 2 같은 수는 홀짝으로 안 되고, 그 밖에 크기와 홀짝이 맞는데 안 되는 수는 없다
      assert.equal(reason === null, can, `n=${n} ${target}`);
      if (!can) assert.equal(reason, target > total ? 'big' : 'parity', `n=${n} ${target}`);
      const solved = solve({ kind: 'row', n, target });
      assert.equal(solved.possible, can);
      assert.equal(solved.reason, reason);
      assert.equal(solved.ways, can ? brute.get(target).ways : 0);
    }
    // 나오는 수는 모두 모두 +일 때와 홀짝이 같다(왜 그럴까의 까닭)
    for (const value of brute.keys()) assert.equal((total - value) % 2, 0);
  }
  // 메뚜기도 같다. 0으로 돌아오는 것은 모두 오른쪽일 때가 짝수인 판뿐이다
  for (let n = MIN_N; n <= MAX_N; n++) {
    assert.equal(hopOf(n).has(0), totalOf(n) % 2 === 0, `n=${n}`);
    assert.equal(solve({ kind: 'hop', n, target: 0 }).possible, totalOf(n) % 2 === 0);
  }
});

test('모두 찾기와 가장 큰 수: 다른 방법으로 따진 것과 같다. 가장 큰 수는 늘 모두 +일 때보다 1 작다', () => {
  for (let n = 3; n <= MAX_N; n++) {
    const total = totalOf(n);
    const all = solve({ kind: 'all', n, top: Math.min(30, total + 3) });
    assert.deepEqual(all.impossible, bruteMissing(n, Math.min(30, total + 3)));
    assert.equal(all.possible, false);
    const largest = solve({ kind: 'largest', n });
    const missing = bruteMissing(n, total - 1);
    assert.equal(largest.answer, Math.max(...missing));
    assert.equal(largest.answer, total - 1);
  }
});

test('판의 규격과 한 일의 차례', () => {
  assert.equal(checkBoard({ kind: 'row', n: 5, target: 7 }), null);
  assert.equal(checkBoard({ kind: 'row', n: 5, target: 21 }), 'target');
  assert.equal(checkBoard({ kind: 'row', n: 1, target: 1 }), 'n');
  assert.equal(checkBoard({ kind: 'row', n: 11, target: 1 }), 'n');
  assert.equal(checkBoard({ kind: 'all', n: 4, top: 12 }), null);
  assert.equal(checkBoard({ kind: 'all', n: 4, top: 31 }), 'top');
  assert.equal(checkBoard({ kind: 'hop', n: 3, target: -6 }), null);
  assert.equal(checkBoard({ kind: 'hop', n: 3, target: 7 }), 'target');
  assert.equal(checkBoard({ kind: 'largest', n: 2 }), 'n');
  assert.equal(checkBoard({ kind: 'what', n: 3 }), 'kind');
  const all = { kind: 'all', n: 4, top: 12 };
  assert.deepEqual(replay(all, ['s2', 'm3', 'm12', 'm3', 's0']), { ok: true, signs: ['-', '+', '-'], marks: [12], dirs: [] });
  assert.equal(replay(all, ['m13']).ok, false);
  assert.equal(replay(all, ['s3']).ok, false);
  assert.equal(replay(all, ['l']).ok, false);
  assert.equal(replay({ kind: 'row', n: 4, target: 2 }, ['m2']).ok, false);
  const hop = { kind: 'hop', n: 2, target: 1 };
  assert.deepEqual(replay(hop, ['r', 'l']).dirs, [1, -1]);
  assert.equal(replay(hop, ['r', 'l', 'r']).ok, false);
  assert.equal(replay(hop, ['s0']).ok, false);
  assert.equal(replay(hop, 'r').ok, false);
});
