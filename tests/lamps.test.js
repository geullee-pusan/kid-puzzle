// 켜고 끄기와 숫자 마술의 풀이 프로그램(src/core/lamps.js)을 다른 방법(tests/helpers/brute-lamps.js)으로 다시 풀어 견준다.
// 불: 켜고 끄는 모든 묶음을 하나씩 켜 본다. 숫자 마술: 두 자리와 세 자리의 모든 수를 글자로 세로셈해 본다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  PREDICTION,
  bestNext,
  cardNumbers,
  cardsWith,
  checkBoard,
  familyOf,
  firstMissing,
  gapOf,
  isDoubling,
  litFor,
  litSum,
  magicOk,
  magicSteps,
  magicTable,
  missingOf,
  nextTop,
  readCards,
  reachOf,
  resultForGap,
  reverseOf,
  solve,
  stripTop,
  sumOf,
  waysOf,
  whyOpen,
  wrongColumn,
} from '../src/core/lamps.js';
import { allSubsets, bruteBestNext, bruteCards, bruteFirstMissing, bruteMagic, bruteReverse, bruteWays, columnAdd } from './helpers/brute-lamps.js';

/** 1~top의 수로 된 불 묶음(작은 것부터, 같은 수가 여럿이어도 된다) 가운데 불이 size개인 것 모두 */
function multisets(size, top, from = 1) {
  if (size === 0) return [[]];
  const list = [];
  for (let v = from; v <= top; v++) for (const rest of multisets(size - 1, top, v)) list.push([v, ...rest]);
  return list;
}
/** 불 하나~넷, 수 1~10의 모든 묶음(1,000가지) */
const SETS = [1, 2, 3, 4].flatMap((size) => multisets(size, 10));
const doubling = (k) => Array.from({ length: k }, (_, at) => 2 ** at);

test('수마다 만드는 방법의 수: 모든 불 묶음을 하나씩 켜 본 것과 같다', () => {
  assert.equal(SETS.length, 1000);
  for (const lamps of [...SETS, doubling(5), doubling(6), [1, 2, 4, 8, 16, 50], [50, 50, 50, 50, 50, 50]]) {
    const ways = waysOf(lamps);
    const brute = bruteWays(lamps);
    assert.equal(ways.length, sumOf(lamps) + 1);
    for (let n = 0; n < ways.length; n++) assert.equal(ways[n], brute.get(n) ?? 0, `${lamps}: ${n}`);
  }
});

test('어디까지: 빈 곳 없이 가는 끝, 처음으로 못 만드는 수, 못 만드는 수의 목록이 하나씩 켜 본 것과 같다', () => {
  for (const lamps of SETS) {
    const first = bruteFirstMissing(lamps);
    assert.equal(firstMissing(lamps), first, String(lamps));
    assert.equal(reachOf(lamps), first - 1, String(lamps));
    const brute = bruteWays(lamps);
    const top = sumOf(lamps) + 3;
    assert.deepEqual(missingOf(lamps, top), Array.from({ length: top }, (_, at) => at + 1).filter((n) => !brute.has(n)), String(lamps));
  }
  // 이 형식에 나오는 사실들
  assert.equal(firstMissing([1, 2, 4, 8]), 16);
  assert.equal(firstMissing([1, 2, 4, 9]), 8);
  assert.equal(firstMissing([1, 3, 5, 7]), 2);
  assert.deepEqual(missingOf([1, 3, 5, 7]), [2, 14]);
  assert.equal(firstMissing([1, 2, 5, 10]), 4);
  assert.equal(firstMissing([1, 2, 3, 8]), 7);
  assert.equal(reachOf([1, 2, 3, 6]), 12);
  assert.equal(reachOf([1, 2, 4, 7]), 14);
  // 불이 열 개(1, 2, 4, … 512)면 1부터 1023까지. 2를 열 번 곱한 수보다 하나 작다
  assert.equal(reachOf(doubling(10)), 1023);
  assert.equal(1023, 2 ** 10 - 1);
});

test('켜는 불 한 가지(litFor): 만들 수 있는 수면 합이 그 수인 불 묶음, 못 만드는 수면 null', () => {
  for (const lamps of SETS) {
    const brute = bruteWays(lamps);
    for (let n = 1; n <= sumOf(lamps) + 2; n++) {
      const lit = litFor(lamps, n);
      if (!brute.has(n)) {
        assert.equal(lit, null, `${lamps}: ${n}`);
        continue;
      }
      assert.ok(lit, `${lamps}: ${n}`);
      assert.equal(new Set(lit).size, lit.length);
      assert.equal(litSum(lamps, lit), n, `${lamps}: ${n}`);
    }
  }
});

test('불 하나 더 달기: 빈 곳 없는 불에는 (불의 합 + 1)짜리가 가장 멀리 가고, 끝은 (합 × 2 + 1)이다. 그런 불은 하나뿐이다', () => {
  // 빈 곳 없는 불: 불 하나~다섯, 수 1~12의 묶음 가운데 1부터 합까지 다 만드는 것
  const gapless = [1, 2, 3, 4, 5].flatMap((size) => multisets(size, 12)).filter((lamps) => reachOf(lamps) === sumOf(lamps));
  assert.ok(gapless.length > 200, String(gapless.length));
  for (const lamps of [...gapless, doubling(5), [1, 2, 3, 6], [1, 2, 4, 7]]) {
    const total = sumOf(lamps);
    const best = bestNext(lamps);
    const brute = bruteBestNext(lamps, nextTop(lamps) + 10);
    assert.deepEqual(brute.values, [total + 1], String(lamps));
    assert.equal(best.value, total + 1, String(lamps));
    assert.equal(best.reach, 2 * total + 1, String(lamps));
    assert.equal(brute.reach, best.reach);
    // v가 (합 + 1) 이하면 합 + v까지, 그보다 크면 합까지만 간다
    for (let v = 1; v <= nextTop(lamps); v++) assert.equal(best.all[v], v <= total + 1 ? total + v : total, `${lamps} + ${v}`);
  }
  assert.deepEqual([bestNext([1, 2, 4, 8]).value, bestNext([1, 2, 4, 8]).reach], [16, 31]);
  assert.deepEqual([bestNext([1, 2, 3, 6]).value, bestNext([1, 2, 3, 6]).reach], [13, 25]);
  assert.deepEqual([bestNext(doubling(5)).value, bestNext(doubling(5)).reach], [32, 63]);
});

test('두 배씩인 불(1, 2, 4, …)은 어떤 수든 만드는 방법이 한 가지뿐이다. 두 배씩이 아니면 두 가지인 수가 있다', () => {
  for (let k = 1; k <= 6; k++) {
    const lamps = doubling(k);
    assert.ok(isDoubling(lamps));
    const ways = waysOf(lamps);
    for (let n = 1; n < 2 ** k; n++) assert.equal(ways[n], 1, `${k}개: ${n}`);
  }
  assert.equal(isDoubling([1, 2, 3, 6]), false);
  assert.equal(waysOf([1, 2, 3, 6])[3], 2);
  assert.deepEqual(allSubsets([1, 2, 3, 6]).filter((item) => item.sum === 3).map((item) => item.lit), [[0, 1], [2]]);
  // 두 가지로 만드는 수가 있는 불로는 카드를 만들 수 없다
  assert.equal(bruteCards([1, 2, 3, 6]), null);
});

test('마음 읽기 카드: 1~7, 1~15, 1~31, 1~63의 모든 수에서 적힌 카드의 맨 앞 수를 더하면 그 수다', () => {
  for (let k = 3; k <= 6; k++) {
    const lamps = doubling(k);
    const brute = bruteCards(lamps);
    for (let at = 0; at < k; at++) {
      const numbers = cardNumbers(lamps, at);
      assert.deepEqual(numbers, brute[at], `${k}장: 카드 ${at}`);
      // 카드마다 수의 절반이 적혀 있고, 맨 앞의 수가 그 카드의 불이다
      assert.equal(numbers.length, 2 ** (k - 1));
      assert.equal(numbers[0], lamps[at]);
    }
    for (let n = 1; n < 2 ** k; n++) {
      const cards = cardsWith(lamps, n);
      assert.equal(readCards(lamps, cards), n, `${k}장: ${n}`);
      // 어느 카드에 있는지가 다르면 수도 다르다
      for (let m = 1; m < n; m++) assert.notDeepEqual(cardsWith(lamps, m), cards);
    }
  }
  assert.deepEqual(cardNumbers([1, 2, 4, 8], 0), [1, 3, 5, 7, 9, 11, 13, 15]);
  assert.deepEqual(cardsWith([1, 2, 4, 8], 13), [0, 2, 3]);
});

test('숫자 마술: 세 자리의 모든 수 900개와 두 자리의 모든 수 90개를 글자로 세로셈한 것과 같다', () => {
  for (let n = 10; n <= 999; n++) {
    const steps = magicSteps(n);
    const brute = bruteMagic(n);
    assert.equal(reverseOf(n), bruteReverse(n), String(n));
    assert.equal(steps.diff, brute.diff, String(n));
    assert.equal(steps.back, brute.back, String(n));
    assert.equal(steps.sum, brute.sum, String(n));
    // 같은 차(맨 앞과 맨 끝 숫자)의 수는 모두 같은 수가 나온다
    const digits = String(n).length;
    assert.equal(steps.sum, resultForGap(digits, gapOf(n)), String(n));
  }
});

test('숫자 마술: 맨 앞과 맨 끝 숫자가 둘 이상 다르면 늘 1089(두 자리는 99)이고, 하나 다르면 198(18), 같으면 0이다', () => {
  for (const digits of [2, 3]) {
    const low = 10 ** (digits - 1);
    const counts = new Map();
    for (let n = low; n < low * 10; n++) {
      const sum = bruteMagic(n).sum;
      counts.set(sum, (counts.get(sum) ?? 0) + 1);
      // 쓸 수 있는 수 ↔ 늘 나오는 수
      assert.equal(magicOk(n, digits), sum === PREDICTION[digits], String(n));
    }
    if (digits === 3) assert.deepEqual([...counts.entries()].sort((a, b) => a[0] - b[0]), [[0, 90], [198, 170], [1089, 640]]);
    else assert.deepEqual([...counts.entries()].sort((a, b) => a[0] - b[0]), [[0, 9], [18, 17], [99, 64]]);
    // 표: 차마다의 개수와 결과
    const table = magicTable(digits);
    assert.equal(table.total, 9 * low);
    for (const row of table.byGap) {
      assert.equal(row.results.length, 1, `${digits}자리, 차 ${row.gap}`);
      assert.equal(row.results[0][0], resultForGap(digits, row.gap));
      assert.equal(row.results[0][1], row.count);
    }
  }
  // 세 자리에서 빼면 가운데는 늘 9이고, 맨 앞과 맨 끝 숫자를 더하면 9다. 뒤집어 더하면 자리마다 9, 18, 9다
  for (let n = 100; n <= 999; n++) {
    if (!magicOk(n, 3)) continue;
    const { diff, back } = magicSteps(n);
    const text = String(diff);
    assert.equal(text.length, 3, String(n));
    assert.equal(text[1], '9');
    assert.equal(Number(text[0]) + Number(text[2]), 9);
    assert.deepEqual(columnAdd(diff, back).sums, [9, 18, 9]);
  }
});

test('다시 볼 자리: 계산한 답과 넣은 답이 처음으로 다른 자리(일의 자리부터)', () => {
  assert.equal(wrongColumn(495, '495'), -1);
  assert.equal(wrongColumn(495, '485'), 1);
  assert.equal(wrongColumn(495, '496'), 0);
  assert.equal(wrongColumn(1089, '989'), 2);
  assert.equal(wrongColumn(1089, '89'), 3);
  assert.equal(wrongColumn(1089, '1079'), 1);
  assert.equal(wrongColumn(99, '9'), 1);
  for (let a = 0; a < 1200; a += 7) {
    for (let b = 0; b < 1200; b += 13) {
      const at = wrongColumn(a, String(b));
      const pad = (x) => String(x).padStart(4, '0').split('').reverse();
      const first = pad(a).findIndex((d, index) => d !== pad(b)[index]);
      assert.equal(at, first, `${a} ${b}`);
    }
  }
});

test('판 검사: 쓸 수 없는 판을 가려낸다', () => {
  assert.equal(checkBoard({ kind: 'targets', lamps: [1, 2, 4], targets: [3, 5, 7] }), null);
  assert.equal(checkBoard({ kind: 'reach', lamps: [1, 3, 5, 7] }), null);
  assert.equal(checkBoard({ kind: 'next', lamps: [1, 2, 4, 8] }), null);
  assert.equal(checkBoard({ kind: 'cards', lamps: [1, 2, 4, 8], secrets: [6] }), null);
  assert.equal(checkBoard({ kind: 'magic', digits: 3 }), null);
  for (const bad of [
    null,
    { kind: 'other' },
    { kind: 'reach', lamps: [] },
    { kind: 'reach', lamps: [4, 2] },
    { kind: 'reach', lamps: [1, 2, 3, 4, 5, 6, 7] },
    { kind: 'reach', lamps: [0, 1] },
    { kind: 'targets', lamps: [1, 2], targets: [4] },
    { kind: 'targets', lamps: [2, 4], targets: [1] },
    { kind: 'targets', lamps: [1, 2, 4], targets: [3, 3] },
    { kind: 'next', lamps: [1, 3] },
    { kind: 'next', lamps: [1, 2, 4, 8, 16, 32] },
    { kind: 'cards', lamps: [1, 2, 3, 6], secrets: [5] },
    { kind: 'cards', lamps: [1, 2, 4], secrets: [8] },
    { kind: 'cards', lamps: [1, 2, 4], secrets: [] },
    { kind: 'magic', digits: 4 },
  ]) {
    assert.notEqual(checkBoard(bad), null, JSON.stringify(bad));
  }
});

test('판의 답과 줄: 어디까지 판의 줄에는 처음으로 못 만드는 수가 늘 들어 있다', () => {
  for (const lamps of SETS) {
    const board = { kind: 'reach', lamps };
    const solved = solve(board);
    assert.equal(solved.first, bruteFirstMissing(lamps));
    assert.ok(solved.first <= stripTop(board), String(lamps));
    assert.deepEqual(solved.twice, [...bruteWays(lamps)].filter(([n, ways]) => n > 0 && ways >= 2).map(([n]) => n).sort((a, b) => a - b));
  }
  assert.equal(stripTop({ kind: 'next', lamps: [1, 2, 4, 8] }), 32);
  assert.deepEqual(solve({ kind: 'next', lamps: [1, 2, 4, 8] }), { possible: true, kind: 'next', best: 16, bestReach: 31, top: 32 });
  assert.deepEqual(solve({ kind: 'magic', digits: 2 }), { possible: true, kind: 'magic', prediction: 99 });
});

test('"왜 그럴까?"는 묶음(불, 카드, 마술)마다 그 묶음의 판을 끝까지 한 뒤에 열린다', () => {
  assert.deepEqual(['targets', 'reach', 'next', 'cards', 'magic'].map(familyOf), ['lamps', 'lamps', 'lamps', 'cards', 'magic']);
  const record = (mode, outcome = 'solved') => ({ kind: 'round', format: 'lamps', mode, outcome });
  assert.equal(whyOpen([], 'lamps'), false);
  assert.equal(whyOpen([record('reach', 'left')], 'lamps'), false);
  assert.equal(whyOpen([record('reach')], 'lamps'), true);
  assert.equal(whyOpen([record('reach')], 'magic'), false);
  assert.equal(whyOpen([record('magic', 'solution')], 'magic'), true);
  assert.equal(whyOpen([{ ...record('cards'), format: 'coins' }], 'cards'), false);
});
