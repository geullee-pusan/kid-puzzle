// 숫자 넷으로 수 만들기의 판과 풀이 점검. 만들 수 있는 수, 분수를 거쳐야만 나오는 수, 합치는 차례의 수는 다른 방법(tests/helpers/brute-fourdigits.js)으로 다시 따진다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FARTHEST, OPS, PLAIN_FACES, STRIP_CAP, apply, canMake, checkBoard, combine, copyBoard, entryOf, explore, exprText, firstMissing, isWhole, needsFraction, openOf, orderCount, ratio, readStep, refusal, replaySteps, runOf, sameBoard, solve, startCards, stepsOf, stripTop, valueKey, valueOf, wholeReach } from '../src/core/fourdigits.js';
import { generateBoard } from '../src/core/fourdigits-ladder.js';
import { bruteMissing, bruteOrderCount, bruteReach, bruteWays, evaluate } from './helpers/brute-fourdigits.js';

const FACES = { '+': '+', '-': '−', '*': '×', '/': '÷' };
/** 다른 방법과 견주는 숫자들: 사다리의 첫 판들, 이야기("왜 그럴까?")의 숫자, 분수가 숨은 판, 같은 숫자, 1이 안 되는 숫자, 숫자 셋과 둘 */
const SAMPLES = [
  [1, 2, 3, 4],
  [1, 1, 2, 3],
  [4, 4, 4, 4],
  [3, 3, 3, 3],
  [1, 3, 4, 6],
  [1, 1, 4, 4],
  [1, 5, 5, 5],
  [3, 3, 8, 8],
  [4, 4, 7, 7],
  [1, 2, 5, 8],
  [3, 3, 4, 7],
  [1, 1, 2, 7],
  [6, 7, 8, 9],
  [2, 3, 4],
  [4, 4, 4],
  [5, 7, 9],
  [2, 3],
  [7, 7],
];
const all4 = [];
for (let a = 1; a <= 9; a++) for (let b = a; b <= 9; b++) for (let c = b; c <= 9; c++) for (let d = c; d <= 9; d++) all4.push([a, b, c, d]);
const sorted = (set) => [...set].sort((x, y) => x - y);

test('분수: 약분하고 분모는 늘 1 이상이다. 빼기는 0보다 작아지지 않고, 0으로는 나누지 않는다', () => {
  assert.deepEqual(ratio(6, -4), [-3, 2]);
  assert.deepEqual(ratio(0, 5), [0, 1]);
  assert.deepEqual(apply(ratio(3), '/', ratio(4)), [3, 4]);
  assert.deepEqual(apply(ratio(1), '-', ratio(3, 4)), [1, 4]);
  assert.deepEqual(apply(ratio(6), '/', ratio(1, 4)), [24, 1]);
  assert.deepEqual(apply(ratio(3), '-', ratio(3)), [0, 1]);
  assert.equal(apply(ratio(2), '-', ratio(3)), null);
  assert.equal(apply(ratio(2), '/', ratio(0)), null);
  assert.equal(refusal(ratio(2), '-', ratio(3)), 'minus');
  assert.equal(refusal(ratio(2), '/', ratio(0)), 'zero');
  assert.equal(refusal(ratio(0), '/', ratio(2)), null);
  assert.equal(refusal(ratio(3), '-', ratio(3)), null);
  assert.equal(isWhole([24, 1]), true);
  assert.equal(valueKey([3, 4]), '3/4');
  assert.deepEqual(OPS, ['+', '-', '*', '/']);
});

test('식의 글: 화면은 먼저 합친 두 카드마다 괄호로 묶고, 약속을 따르면 꼭 필요한 괄호만 남는다', () => {
  const tree = { op: '/', a: 6, b: { op: '-', a: 1, b: { op: '/', a: 3, b: 4 } } };
  assert.equal(exprText(tree, FACES, { full: true }), '6÷(1−(3÷4))');
  assert.equal(exprText(tree, FACES), '6÷(1−3÷4)');
  assert.equal(exprText({ op: '+', a: { op: '*', a: 2, b: 3 }, b: 4 }, FACES), '2×3+4');
  assert.equal(exprText({ op: '+', a: { op: '*', a: 2, b: 3 }, b: 4 }, FACES, { full: true }), '(2×3)+4');
  assert.equal(exprText({ op: '-', a: 4, b: { op: '-', a: 2, b: 1 } }), '4-(2-1)');
  assert.equal(exprText({ op: '/', a: 8, b: { op: '*', a: 2, b: 2 } }), '8/(2*2)');
  assert.equal(exprText({ op: '*', a: { op: '+', a: 1, b: 4 }, b: { op: '*', a: 2, b: 3 } }), '(1+4)*2*3');
  // 글로 적은 식을 다른 계산기로 셈하면 같은 값이다(괄호를 모두 쳐서 읽는다)
  for (const digits of [[1, 3, 4, 6], [4, 4, 4, 4], [1, 2, 3, 4]]) {
    for (const entry of explore(digits).values.values()) {
      const full = exprText(entry.tree, PLAIN_FACES, { full: true });
      const value = typeof entry.tree === 'number' ? { n: BigInt(entry.tree), d: 1n } : evaluate(`(${full})`);
      assert.equal(`${value.n}/${value.d}`, valueKey(entry.value), full);
      assert.deepEqual(valueOf(entry.tree), entry.value, full);
    }
  }
});

test('카드 합치기: 새 카드는 두 자리 가운데 왼쪽에 놓이고 다른 카드는 빠진다. 맞지 않는 합치기는 되지 않는다', () => {
  const cards = startCards([1, 3, 4, 6]);
  const after = combine(cards, 2, '/', 1);
  assert.deepEqual(after.map((card) => card.value), [[1, 1], [4, 3], [6, 1]]);
  assert.deepEqual(after[1].tree, { op: '/', a: 4, b: 3 });
  assert.equal(combine(cards, 1, '-', 2), null);
  assert.equal(combine(cards, 1, '+', 1), null);
  assert.equal(combine(cards, 0, '+', 4), null);
  assert.equal(combine(cards, 0, '%', 1), null);
  assert.deepEqual(readStep('1/2'), { i: 1, op: '/', j: 2 });
  assert.equal(readStep('1x2'), null);
  const replayed = replaySteps([1, 3, 4, 6], ['1/2', '0-1', '1/0']);
  assert.equal(replayed.ok, true);
  assert.deepEqual(replayed.cards.map((card) => card.value), [[24, 1]]);
  assert.equal(replaySteps([1, 3, 4, 6], ['1-2']).ok, false);
  assert.equal(replaySteps([1, 3, 4, 6], ['0+1', '0+1', '0+1']).ok, true);
  assert.equal(replaySteps([1, 3, 4, 6], ['0+1', '0+1', '0+1', '0+1']).ok, false);
});

test('합치는 차례의 수: 카드 넷은 6×6 × 3×6 × 1×6 = 3888가지, 셋은 108가지, 둘은 6가지다(늘어놓아 다시 센다)', () => {
  assert.equal(orderCount(4), 3888);
  assert.equal(orderCount(3), 108);
  assert.equal(orderCount(2), 6);
  for (const n of [2, 3, 4]) assert.equal(bruteOrderCount(n), orderCount(n), `${n}장`);
  // 풀이 프로그램이 해 본 차례의 수(버린 차례까지)도 같다
  assert.equal(explore([1, 2, 3, 4]).orders, 3888);
  // 차례마다의 값을 다 더하면, 버리지 않은 차례의 수다(0보다 작아지거나 0으로 나누는 차례만 빠진다)
  const ways = [...explore([1, 2, 3, 4]).values.values()].reduce((sum, entry) => sum + entry.ways, 0);
  assert.ok(ways < 3888 && ways > 1944, `${ways}`);
});

test('만들 수 있는 수와 분수를 거쳐야만 나오는 수가 식을 모두 글로 적어 셈한 것과 같다', () => {
  for (const digits of SAMPLES) {
    const brute = bruteReach(digits, 99);
    assert.deepEqual(wholeReach(digits, 99), sorted(brute.all), digits.join(','));
    for (let n = 1; n <= 99; n++) {
      assert.equal(canMake(digits, n), brute.all.has(n), `${digits.join(',')}: ${n}`);
      assert.equal(needsFraction(digits, n), brute.all.has(n) && !brute.plain.has(n), `${digits.join(',')}: ${n} 분수`);
    }
    assert.equal(firstMissing(digits), bruteMissing(digits), digits.join(','));
  }
  // 이야기와 사다리가 쓰는 사실
  assert.equal(firstMissing([1, 2, 3, 4]), 29);
  assert.equal(firstMissing([4, 4, 4, 4]), 10);
  assert.equal(firstMissing([1, 1, 2, 3]), 11);
  assert.equal(firstMissing([1, 1, 2, 7]), 1);
  for (const [digits, n] of [[[1, 3, 4, 6], 24], [[1, 1, 4, 4], 5], [[1, 5, 5, 5], 24], [[3, 3, 8, 8], 24], [[4, 4, 7, 7], 24]]) assert.equal(needsFraction(digits, n), true, `${digits}: ${n}`);
  // 1, 3, 4, 6의 24는 3888가지 가운데 한 차례에서만 나온다
  assert.equal(entryOf([1, 3, 4, 6], 24).ways, 1);
  assert.equal(exprText(entryOf([1, 3, 4, 6], 24).tree, FACES, { full: true }), '6÷(1−(3÷4))');
});

test('0보다 작은 수를 거쳐도 만들 수 있는 수는 늘지 않는다(고른 숫자 넷에서 식을 모두 적어 확인)', () => {
  for (const digits of SAMPLES.filter((item) => item.length === 4)) {
    const plainRule = bruteReach(digits, 99).all;
    const withNegative = bruteReach(digits, 99, { negative: true }).all;
    assert.deepEqual(sorted(withNegative), sorted(plainRule), digits.join(','));
  }
});

test('숫자 셋으로는 분수를 거쳐야만 나오는 수가 없다(모든 숫자 셋, 1~200)', () => {
  for (let a = 1; a <= 9; a++) {
    for (let b = a; b <= 9; b++) {
      for (let c = b; c <= 9; c++) {
        for (const n of wholeReach([a, b, c], 200)) assert.equal(needsFraction([a, b, c], n), false, `${a}${b}${c}: ${n}`);
      }
    }
  }
});

test('숫자 넷 495가지 가운데 1부터 가장 멀리 가는 것은 1, 2, 5, 8 하나뿐이고 51까지다', () => {
  assert.equal(all4.length, 495);
  const best = Math.max(...all4.map((digits) => firstMissing(digits) - 1));
  assert.equal(best, FARTHEST.best);
  assert.deepEqual(all4.filter((digits) => firstMissing(digits) - 1 === best), [FARTHEST.digits]);
  assert.equal(bruteMissing(FARTHEST.digits), 52);
  // 띠의 위 끝(60)은 어떤 숫자 넷의 열린 수 둘보다도 크다
  assert.ok(FARTHEST.best + 2 < STRIP_CAP);
});

test('식을 합치는 차례로 바꾸면 그대로 다시 할 수 있다', () => {
  for (const digits of [[1, 2, 3, 4], [1, 3, 4, 6], [4, 4, 4, 4], [1, 1, 4, 4], [2, 3, 4]]) {
    for (const [key, entry] of explore(digits).values) {
      const steps = stepsOf(digits, entry.tree);
      const replayed = replaySteps(digits, steps);
      assert.ok(replayed.ok, `${digits}: ${key}`);
      assert.equal(replayed.cards.length, 1);
      assert.equal(valueKey(replayed.cards[0].value), key);
    }
  }
  assert.equal(stepsOf([1, 2], { op: '+', a: 1, b: 3 }), null);
});

test('판의 규격: 숫자는 1~9, 목표 수는 1~3개이고 모두 만들 수 있다. 1부터 차례로는 1을 만들 수 있어야 한다', () => {
  assert.equal(checkBoard({ kind: 'target', digits: [1, 3, 4, 6], targets: [24] }), null);
  assert.equal(checkBoard({ kind: 'target', digits: [2, 3], targets: [6] }), null);
  assert.equal(checkBoard({ kind: 'run', digits: [1, 2, 3, 4] }), null);
  assert.equal(checkBoard({ kind: 'run', digits: [1, 2, 3] }), null);
  assert.equal(checkBoard({ kind: 'target', digits: [1, 2, 3, 4], targets: [29] }), 'unreachable');
  assert.equal(checkBoard({ kind: 'target', digits: [1, 2, 3, 4], targets: [10, 10] }), 'targets');
  assert.equal(checkBoard({ kind: 'target', digits: [1, 2, 3, 4], targets: [] }), 'targets');
  assert.equal(checkBoard({ kind: 'target', digits: [1, 2, 3, 0], targets: [6] }), 'digits');
  assert.equal(checkBoard({ kind: 'run', digits: [1, 2] }), 'digits');
  assert.equal(checkBoard({ kind: 'run', digits: [1, 1, 2, 7] }), 'run');
  assert.equal(checkBoard({ kind: 'all' }), 'kind');
  assert.equal(checkBoard(null), 'kind');
  const board = { kind: 'target', digits: [1, 2, 3, 4], targets: [10, 21, 25] };
  assert.deepEqual(copyBoard(board), board);
  assert.notEqual(copyBoard(board).targets, board.targets);
  assert.ok(sameBoard(board, copyBoard(board)));
  assert.ok(!sameBoard(board, { kind: 'run', digits: [1, 2, 3, 4] }));
});

test('풀이: 목표 수마다 나오는 차례의 수와 한 가지 식, 1부터 차례로는 끝 수와 처음 막히는 수', () => {
  const target = solve({ kind: 'target', digits: [1, 3, 4, 6], targets: [24] });
  assert.equal(target.possible, true);
  assert.equal(target.orders, 3888);
  assert.deepEqual(target.targets.map((entry) => [entry.n, entry.ways, entry.plain]), [[24, 1, 0]]);
  const run = solve({ kind: 'run', digits: [1, 2, 3, 4] });
  assert.equal(run.possible, false);
  assert.equal(run.best, 28);
  assert.equal(run.missing, 29);
  assert.deepEqual(run.entries.map((entry) => entry.n), Array.from({ length: 28 }, (_, index) => index + 1));
  for (const entry of run.entries) assert.deepEqual(valueOf(entry.tree), [entry.n, 1]);
  // 한 가지 식은 분수를 거치지 않는 것부터 고른다
  for (const entry of solve({ kind: 'run', digits: [4, 4, 4, 4] }).entries) assert.equal(needsFraction([4, 4, 4, 4], entry.n), false);
});

test('1부터 차례로의 기록과 열린 수 둘, 띠의 끝', () => {
  assert.equal(runOf([]), 0);
  assert.equal(runOf([2, 3]), 0);
  assert.equal(runOf([1, 2, 3, 5]), 3);
  assert.deepEqual(openOf([]), [1, 2]);
  assert.deepEqual(openOf([1, 2, 3, 5]), [4, 6]);
  assert.deepEqual(openOf([2, 3, 4]), [1, 5]);
  assert.equal(stripTop([]), 10);
  assert.equal(stripTop([1, 2, 3, 4, 5, 6, 7]), 10);
  assert.equal(stripTop([1, 2, 3, 4, 5, 6, 7, 8]), 20);
  assert.equal(stripTop([1, 36]), 40);
  assert.equal(stripTop(Array.from({ length: 51 }, (_, index) => index + 1)), STRIP_CAP);
});

test('목표 수가 나오는 차례의 수(선생님이 끝에 말하는 수)는 합치는 차례를 따로 늘어놓아 센 것과 같다', () => {
  const pairs = [[[2, 3, 4], 10], [[1, 3, 4, 6], 24], [[1, 2, 3, 4], 27], [[1, 2, 3, 4], 28], [[1, 2, 3, 4], 10], [[4, 4, 4, 4], 7], [[1, 1, 4, 4], 5], [[1, 5, 5, 5], 24], [[3, 3, 8, 8], 24]];
  for (let seed = 1; seed <= 6; seed++) {
    for (const level of [1, 5]) {
      const { board } = generateBoard(level, seed);
      pairs.push([board.digits, board.targets[0]]);
    }
  }
  for (const [digits, n] of pairs) assert.equal(entryOf(digits, n).ways, bruteWays(digits, n), `${digits.join(',')}: ${n}`);
});
