// 공정한 게임일까의 풀이 프로그램 점검: 모든 경우를 센 수를 글자로 적어 하나씩 세는 다른 셈과 견준다.
// 던지는 것과 보는 것의 모든 짝에서, 다람쥐가 가져가는 값의 모든 부분 집합(규칙 2,300여 가지)을 센다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  AGREE,
  DEVICES,
  MANY,
  MEASURES,
  PLAYS,
  agrees,
  checkBoard,
  checkRule,
  countCases,
  fixesOf,
  lookOf,
  manySeed,
  manyTally,
  outcomesOf,
  pickSeeds,
  ruleKey,
  simulate,
  solve,
  sumBars,
  tallyOf,
  throwsFor,
  tidyRule,
  toggled,
  unorderedCount,
  valuesOf,
} from '../src/core/fair.js';
import { createRng, randInt } from '../src/core/rng.js';
import { bruteCount, bruteFixes, bruteUnordered, bruteValue, outcomeStrings } from './helpers/brute-fair.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');

/** 던지는 것과 보는 것마다, 다람쥐가 가져가는 값의 모든 부분 집합 */
function allRules() {
  const rules = [];
  for (const device of Object.keys(DEVICES)) {
    for (const measure of MEASURES[device]) {
      const values = valuesOf(device, measure);
      for (let mask = 0; mask < 1 << values.length; mask++) rules.push({ device, measure, a: values.filter((_, index) => (mask >> index) & 1) });
    }
  }
  return rules;
}
const RULES = allRules();

test('나올 수 있는 경우: 동전 둘 4, 셋 8, 주사위 하나 6, 둘 36가지이고 다른 셈의 글자와 하나씩 맞는다', () => {
  assert.deepEqual(
    Object.keys(DEVICES).map((device) => outcomesOf(device).length),
    [4, 8, 6, 36],
  );
  const asText = (device, faces) => faces.map((face) => (device.startsWith('coin') ? (face === 1 ? 'H' : 'T') : String(face))).join('');
  for (const device of Object.keys(DEVICES)) {
    assert.deepEqual(outcomesOf(device).map((faces) => asText(device, faces)).sort(), outcomeStrings(device).slice().sort(), device);
  }
  assert.equal(RULES.length, 4 + 8 + 4 + 16 + 64 + 2048 + 4 + 4 + 64 + 64);
});

test('모든 규칙에서 모든 경우를 센 수, 판정, 값마다의 수가 다른 셈과 같다', () => {
  for (const rule of RULES) {
    const counted = countCases(rule);
    const brute = bruteCount(rule);
    assert.deepEqual([counted.a, counted.b, counted.total, counted.verdict], [brute.a, brute.b, brute.total, brute.verdict], ruleKey(rule));
    // 값마다의 수
    const byValue = new Map();
    for (const text of outcomeStrings(rule.device)) {
      const value = bruteValue(rule.measure, text);
      byValue.set(value, (byValue.get(value) ?? 0) + 1);
    }
    for (const [value, many] of counted.byValue) assert.equal(many, byValue.get(value) ?? 0, `${ruleKey(rule)} ${value}`);
  }
  // 알려진 수: 합 7은 6가지, 합이 짝수는 18가지, 곱이 짝수는 27가지, 큰 눈이 6은 11가지, 차 0은 6가지
  assert.equal(countCases({ device: 'die2', measure: 'sum', a: [7] }).a, 6);
  assert.equal(countCases({ device: 'die2', measure: 'sumParity', a: ['even'] }).a, 18);
  assert.equal(countCases({ device: 'die2', measure: 'prodParity', a: ['even'] }).a, 27);
  assert.equal(countCases({ device: 'die2', measure: 'max', a: [6] }).a, 11);
  assert.equal(countCases({ device: 'die2', measure: 'diff', a: [0] }).a, 6);
  assert.equal(countCases({ device: 'coin2', measure: 'same', a: ['same'] }).verdict, 'fair');
});

test('순서만 바뀐 것을 한 가지로 센 판정과 한 군데만 바꿔서 공정해지는 값이 다른 셈과 같다', () => {
  for (const rule of RULES) {
    const unordered = unorderedCount(rule);
    const brute = bruteUnordered(rule);
    assert.deepEqual([unordered.a, unordered.b, unordered.verdict], [brute.a, brute.b, brute.verdict], ruleKey(rule));
    assert.deepEqual(fixesOf(rule), bruteFixes(rule, valuesOf(rule.device, rule.measure)), ruleKey(rule));
  }
  // 동전 둘의 "같은 면이면": 순서 없이 세면 앞앞, 뒤뒤, 앞뒤의 셋이라 2 대 1로 보이지만, 실제로는 2 대 2다
  assert.deepEqual(unorderedCount({ device: 'coin2', measure: 'same', a: ['same'] }), { total: 3, a: 2, b: 1, verdict: 'a' });
  // 합이 짝수: 순서 없이 세면 12 대 9
  assert.equal(unorderedCount({ device: 'die2', measure: 'sumParity', a: ['even'] }).verdict, 'a');
});

test('규칙 다루기: 정리, 옮기기, 쓸 수 없는 규칙과 판', () => {
  assert.deepEqual(tidyRule({ device: 'die2', measure: 'sum', a: [9, 7, 2] }), { device: 'die2', measure: 'sum', a: [2, 7, 9] });
  assert.deepEqual(toggled({ device: 'die2', measure: 'sum', a: [2, 3] }, 3), { device: 'die2', measure: 'sum', a: [2] });
  assert.deepEqual(toggled({ device: 'die2', measure: 'sum', a: [2, 3] }, 10), { device: 'die2', measure: 'sum', a: [2, 3, 10] });
  assert.equal(checkRule({ device: 'die2', measure: 'sum', a: [7] }), null);
  assert.equal(checkRule({ device: 'die2', measure: 'sum', a: [13] }), 'values');
  assert.equal(checkRule({ device: 'die2', measure: 'sum', a: [7, 7] }), 'values');
  assert.equal(checkRule({ device: 'die1', measure: 'sum', a: [7] }), 'measure');
  assert.equal(checkRule({ device: 'die3', measure: 'sum', a: [] }), 'device');
  const board = { mode: 'judge', rule: { device: 'coin2', measure: 'same', a: ['same'] }, name: 'coin2-same', throws: 1, many: 2 };
  assert.equal(checkBoard(board), null);
  assert.equal(checkBoard({ ...board, mode: 'guess' }), 'mode');
  assert.equal(checkBoard({ ...board, throws: 1.5 }), 'seed');
  // 고칠 판은 처음 규칙이 공정하지 않고, 한 군데만 바꿔서 공정해지는 곳이 있어야 한다
  assert.equal(checkBoard({ ...board, mode: 'fix' }), 'already-fair');
  assert.equal(checkBoard({ ...board, mode: 'fix', rule: { device: 'die2', measure: 'prodParity', a: ['even'] } }), 'no-fix');
  assert.equal(checkBoard({ ...board, mode: 'fix', rule: { device: 'die2', measure: 'sum', a: [2, 3, 4, 5, 6] } }), null);
  assert.deepEqual(solve({ ...board, mode: 'fix', rule: { device: 'die2', measure: 'sum', a: [2, 3, 4, 5, 6] } }).fixes, [10]);
});

/** 다른 셈의 던지기: 같은 시드 난수로 동전은 0~1, 주사위는 1~6을 차례로 뽑는다 */
function bruteThrows(device, seed, n) {
  const rng = createRng(seed);
  const { kind, count } = DEVICES[device];
  return Array.from({ length: n }, () => Array.from({ length: count }, () => (kind === 'coin' ? randInt(rng, 0, 1) : randInt(rng, 1, 6))));
}

test('던지기는 시드 난수만 쓰고(주사위는 주사위 미로의 것), 같은 시드는 늘 같은 결과다', () => {
  const code = read('src/core/fair.js');
  assert.match(code, /import \{ rollDie \} from '\.\/maze\.js';/);
  assert.doesNotMatch(code, /Math\.random/);
  for (const device of Object.keys(DEVICES)) {
    const board = { rule: { device, measure: MEASURES[device][0], a: [] }, throws: 12345 };
    assert.deepEqual(throwsFor(board, PLAYS), bruteThrows(device, 12345, PLAYS), device);
    // 처음 몇 번은 더 던져도 그대로다
    assert.deepEqual(throwsFor(board, 3), throwsFor(board, PLAYS).slice(0, 3));
  }
  const rule = { device: 'die2', measure: 'sum', a: [7] };
  const many = simulate(rule, MANY, 99);
  assert.deepEqual(many, simulate(rule, MANY, 99));
  const brute = bruteThrows('die2', 99, MANY).filter(([x, y]) => x + y === 7).length;
  assert.deepEqual(many, { a: brute, b: MANY - brute, total: MANY });
  assert.deepEqual(tallyOf(rule, [[3, 4], [1, 1], [6, 1]]), { a: 2, b: 1 });
  // 컴퓨터에게 여러 번 던지게 하면 더한다
  const board = { rule, many: 5 };
  const two = manyTally(board, rule, 2);
  assert.equal(two.total, 2 * MANY);
  assert.equal(manySeed(board, 0), 5);
  assert.notEqual(manySeed(board, 1), 5);
  assert.equal(two.a, simulate(rule, MANY, manySeed(board, 0)).a + simulate(rule, MANY, manySeed(board, 1)).a);
  // 합마다의 막대는 모두 n번이다
  assert.equal(sumBars(MANY, 7).reduce((sum, [, value]) => sum + value, 0), MANY);
});

test('열 번의 모습과 1,000번이 판정과 맞는지 가리기', () => {
  assert.equal(lookOf({ a: 5, b: 5 }, 'fair'), 'honest');
  assert.equal(lookOf({ a: 6, b: 4 }, 'fair'), 'honest');
  assert.equal(lookOf({ a: 7, b: 3 }, 'fair'), 'mislead');
  assert.equal(lookOf({ a: 6, b: 4 }, 'a'), 'honest');
  assert.equal(lookOf({ a: 5, b: 5 }, 'a'), 'mislead');
  assert.equal(lookOf({ a: 6, b: 4 }, 'b'), 'mislead');
  assert.equal(agrees({ a: 520, b: 480 }, 'fair'), true);
  assert.equal(agrees({ a: 521, b: 479 }, 'fair', AGREE), false);
  assert.equal(agrees({ a: 300, b: 700 }, 'b'), true);
  assert.equal(agrees({ a: 490, b: 510 }, 'b'), false);
  // 시드 고르기: 바라는 모습을 찾으면 그 모습이고, 1,000번은 판정과 맞는다
  for (const rule of [
    { device: 'coin2', measure: 'same', a: ['same'] },
    { device: 'die2', measure: 'sum', a: [8, 9, 10, 11, 12] },
  ]) {
    const { verdict } = bruteCount(rule);
    for (const look of ['honest', 'mislead']) {
      const seeds = pickSeeds(rule, `test|${look}`, look);
      assert.equal(lookOf(tallyOf(rule, bruteThrows(rule.device, seeds.throws, PLAYS)), verdict), look);
      const many = bruteThrows(rule.device, seeds.many, MANY).filter((faces) => rule.a.includes(bruteValue(rule.measure, faces.map((face) => (rule.device.startsWith('coin') ? (face === 1 ? 'H' : 'T') : String(face))).join(''))));
      assert.ok(agrees({ a: many.length, b: MANY - many.length }, verdict), `${ruleKey(rule)} ${look}`);
    }
  }
});
