// 눈금이 가장 적은 자의 풀이 프로그램 점검: 가장 적은 눈금 수, 그런 자의 수, 같은 길이를 두 번 재지 않는 가장 짧은 자를
// 갈래를 자르지 않고 모든 묶음을 늘어놓는 다른 방법(tests/helpers/brute-ruler.js)으로 다시 따진다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MAX_LENGTH,
  allDistinct,
  bestScore,
  checkBoard,
  coversAll,
  fixedOf,
  isDone,
  itemCount,
  marksOk,
  measuredUpTo,
  mirrorOf,
  pairBound,
  pairCount,
  pairsByLength,
  placements,
  recordOf,
  repeatedLengths,
  shapeKey,
  shortestGolomb,
  solve,
  solveLength,
  spanOf,
} from '../src/core/ruler.js';
import { bruteCounts, bruteDistinct, bruteFewest, bruteGolomb, bruteRulers } from './helpers/brute-ruler.js';

test('재기: 두 눈금 사이가 길이다. 길이마다 재는 두 눈금을 왼쪽 눈금이 작은 것부터 늘어놓는다', () => {
  const pairs = pairsByLength([0, 1, 4, 6]);
  assert.deepEqual([...pairs.keys()].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(pairs.get(3), [[1, 4]]);
  assert.deepEqual(pairsByLength([0, 1, 2, 4]).get(1), [[0, 1], [1, 2]]);
  assert.equal(coversAll([0, 1, 4, 6], 6), true);
  assert.equal(coversAll([0, 1, 2, 6], 6), false);
  assert.deepEqual(measuredUpTo([0, 1, 2, 6], 6), [1, 2, 4, 5, 6]);
  assert.deepEqual(repeatedLengths([0, 1, 2, 3]), [1, 2]);
  assert.equal(allDistinct([0, 1, 4, 9, 11]), true);
  assert.deepEqual(mirrorOf([0, 1, 4, 6], 6), [0, 2, 5, 6]);
  assert.equal(shapeKey([0, 2, 5, 6], 6), '0,1,4,6');
  // 다른 방법으로 센 것과 같다
  for (const marks of [[0, 1, 4, 6], [0, 1, 2, 3, 7], [0, 2, 7, 8, 11], [0, 3, 4, 9, 10, 15]]) {
    const counts = bruteCounts(marks);
    assert.deepEqual(new Map([...pairsByLength(marks).entries()].map(([d, list]) => [d, list.length])), counts);
    assert.equal(allDistinct(marks), bruteDistinct(marks));
  }
});

test('짝의 수: 눈금 m개면 짝은 m × (m − 1) ÷ 2개다. 짝 세기로 아는 아래 끝은 짝이 길이의 수보다 적지 않은 가장 작은 눈금 수다', () => {
  assert.deepEqual([2, 3, 4, 5, 6, 7, 8].map(pairCount), [1, 3, 6, 10, 15, 21, 28]);
  for (let m = 2; m <= 9; m++) {
    const marks = Array.from({ length: m }, (_, index) => index);
    let pairs = 0;
    for (const list of pairsByLength(marks).values()) pairs += list.length;
    assert.equal(pairs, pairCount(m));
  }
  for (let L = 1; L <= MAX_LENGTH; L++) {
    const m = pairBound(L);
    assert.ok(pairCount(m) >= L && pairCount(m - 1) < L, `${L}`);
  }
  // 눈금 m개로 길이 L인 자를 놓는 경우의 수: 0과 L 사이의 L − 1자리에서 m − 2자리를 고른다
  assert.equal(placements(10, 5), 84);
  assert.equal(placements(10, 5), bruteRulers(10, 5).length);
  assert.equal(placements(7, 4), bruteRulers(7, 4).length);
});

/** 풀이 프로그램이 알려 준 것(길이 3~20): 가장 적은 눈금 수, 그 수로 되는 자의 수(뒤집은 것을 하나로) */
const FEWEST = { 3: 3, 4: 4, 5: 4, 6: 4, 7: 5, 8: 5, 9: 5, 10: 6, 11: 6, 12: 6, 13: 6, 14: 7, 15: 7, 16: 7, 17: 7, 18: 8, 19: 8, 20: 8 };
const COUNT = { 3: 1, 4: 2, 5: 2, 6: 1, 7: 6, 8: 4, 9: 2, 10: 19, 11: 15, 12: 7, 13: 3, 14: 65, 15: 40, 16: 16, 17: 6, 18: 250, 19: 163, 20: 75 };

test('1부터 L까지 모두 재는 가장 적은 눈금(길이 3~20): 모든 묶음을 늘어놓은 것과 같다. 그런 자의 수도 같다', () => {
  for (let L = 3; L <= MAX_LENGTH; L++) {
    const mine = solveLength(L);
    const brute = bruteFewest(L);
    assert.equal(mine.fewest, brute.fewest, `길이 ${L}`);
    assert.equal(mine.fewest, FEWEST[L], `길이 ${L}`);
    assert.equal(mine.all, brute.all, `길이 ${L}`);
    assert.equal(mine.count, brute.count, `길이 ${L}`);
    assert.equal(mine.count, COUNT[L], `길이 ${L}`);
    assert.equal(mine.shapes.length, mine.count);
    // 보여 주는 자는 모두 정말로 모두 재고, 눈금이 가장 적고, 뒤집은 것끼리 겹치지 않는다
    for (const marks of mine.shapes) {
      assert.equal(marks.length, mine.fewest);
      assert.equal(coversAll(marks, L), true);
      assert.deepEqual([marks[0], marks.at(-1)], [0, L]);
    }
    assert.equal(new Set(mine.shapes.map((marks) => shapeKey(marks, L))).size, mine.count);
    // 아래 끝(짝 세기)보다 가장 적은 수가 큰 길이: 10, 14, 15, 18~20
    assert.equal(mine.bound, pairBound(L));
    assert.ok(mine.fewest >= mine.bound);
  }
  assert.deepEqual(
    Array.from({ length: 18 }, (_, index) => index + 3).filter((L) => solveLength(L).fewest > solveLength(L).bound),
    [10, 14, 15, 18, 19, 20],
  );
  // 뒤집어도 같은 가장 좋은 자는 길이 4의 0, 1, 3, 4 하나뿐이다(다른 길이는 그런 자의 수가 뒤집은 것을 하나로 센 수의 두 배)
  for (let L = 3; L <= MAX_LENGTH; L++) assert.equal(solveLength(L).all, 2 * solveLength(L).count - (L === 4 ? 1 : 0), `길이 ${L}`);
  assert.ok(solveLength(4).shapes.some((marks) => marks.join(',') === '0,1,3,4'));
  // 꼭 한 번씩 재는 자는 길이 3(0, 1, 3)과 길이 6(0, 1, 4, 6)뿐이다
  assert.deepEqual(
    Array.from({ length: 18 }, (_, index) => index + 3).filter((L) => pairCount(solveLength(L).fewest) === L),
    [3, 6],
  );
  assert.deepEqual(solveLength(6).shapes, [[0, 1, 4, 6]]);
  assert.deepEqual(solveLength(9).shapes, [[0, 1, 2, 6, 9], [0, 1, 4, 7, 9]]);
});

test('길이 10인 자는 눈금 5개면 짝이 10개인데도 안 된다: 84가지가 모두 어떤 길이를 두 번 재고 어떤 길이를 못 잰다', () => {
  const all = bruteRulers(10, 5);
  assert.equal(all.length, 84);
  for (const marks of all) {
    assert.equal(bruteDistinct(marks), false, marks.join(','));
    assert.ok(bruteCounts(marks).size < 10, marks.join(','));
  }
  // "왜 그럴까?"의 그림: 0, 1, 4, 8, 10은 4를 두 번 재고 5는 못 잰다. 길이 11이면 0, 1, 4, 9, 11이 같은 길이를 두 번 재지 않는다
  const counts = bruteCounts([0, 1, 4, 8, 10]);
  assert.equal(counts.get(4), 2);
  assert.equal(counts.has(5), false);
  assert.deepEqual([...counts.entries()].filter(([, n]) => n > 1).map(([d]) => d), [4]);
  assert.equal(bruteDistinct([0, 1, 4, 9, 11]), true);
  // 다른 방법이 센 "하나 적은 눈금으로 놓는 경우의 수"
  assert.equal(bruteFewest(10).tried, 84);
});

test('같은 길이를 두 번 재지 않는 가장 짧은 자(눈금 3~6개): 3, 6, 11, 17. 모든 묶음을 늘어놓은 것과 같다', () => {
  const expected = { 3: [3, 1], 4: [6, 1], 5: [11, 2], 6: [17, 4] };
  for (let k = 3; k <= 6; k++) {
    const mine = shortestGolomb(k);
    const brute = bruteGolomb(k);
    assert.equal(mine.shortest, brute.shortest, `눈금 ${k}개`);
    assert.equal(mine.all, brute.all, `눈금 ${k}개`);
    assert.equal(mine.shapeCount, brute.count, `눈금 ${k}개`);
    assert.deepEqual([mine.shortest, mine.shapeCount], expected[k]);
    assert.equal(mine.bound, pairCount(k));
    for (const marks of mine.shapes) {
      assert.equal(marks.length, k);
      assert.equal(bruteDistinct(marks), true);
      assert.deepEqual([marks[0], marks.at(-1)], [0, mine.shortest]);
    }
  }
  assert.deepEqual(shortestGolomb(4).shapes, [[0, 1, 4, 6]]);
  assert.deepEqual(shortestGolomb(5).shapes, [[0, 1, 4, 9, 11], [0, 2, 7, 8, 11]]);
});

test('판: 규격, 처음 눈금, 다 되었는지와 기록', () => {
  assert.equal(checkBoard({ kind: 'all', lengths: [6] }), null);
  assert.equal(checkBoard({ kind: 'all', lengths: [6, 7, 8, 9, 10] }), null);
  assert.equal(checkBoard({ kind: 'all', lengths: [6, 8] }), 'chain');
  assert.equal(checkBoard({ kind: 'all', lengths: [2] }), 'length');
  assert.equal(checkBoard({ kind: 'all', lengths: [21] }), 'length');
  assert.equal(checkBoard({ kind: 'golomb', count: 4, span: 8 }), null);
  assert.equal(checkBoard({ kind: 'golomb', count: 5, span: 10 }), 'span');
  assert.equal(checkBoard({ kind: 'golomb', count: 7, span: 20 }), 'count');
  assert.equal(checkBoard({ kind: 'x' }), 'kind');
  assert.equal(checkBoard(null), 'no-board');
  const chain = { kind: 'all', lengths: [6, 7, 8] };
  assert.equal(itemCount(chain), 3);
  assert.equal(spanOf(chain, 2), 8);
  assert.deepEqual(fixedOf(chain, 1), [0, 7]);
  const golomb = { kind: 'golomb', count: 4, span: 8 };
  assert.deepEqual(fixedOf(golomb), [0]);
  assert.equal(isDone(golomb, 0, [0, 1, 3, 7]), true);
  assert.equal(isDone(golomb, 0, [0, 1, 2, 7]), false);
  assert.equal(isDone(golomb, 0, [0, 1, 3]), false);
  assert.equal(recordOf(golomb, [0, 1, 3, 7]), 7);
  assert.equal(isDone(chain, 0, [0, 1, 4, 6]), true);
  assert.equal(recordOf(chain, [0, 1, 4, 6]), 4);
  assert.equal(bestScore(chain, 1), 5);
  assert.equal(bestScore(golomb), 6);
  assert.equal(marksOk(chain, 0, [0, 2, 6]), true);
  assert.equal(marksOk(chain, 0, [0, 2]), false);
  assert.equal(marksOk(chain, 0, [0, 2, 7]), false);
  assert.equal(marksOk(chain, 0, [0, 2, 2, 6]), false);
  assert.equal(marksOk(golomb, 0, [0, 1, 2, 3, 4]), false);
  const solution = solve(chain);
  assert.equal(solution.possible, true);
  assert.deepEqual(solution.items.map((item) => item.best), [4, 5, 5]);
  assert.deepEqual(solve(golomb).items[0].best, 6);
});
