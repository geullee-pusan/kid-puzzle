// 도미노 깔기 모두 찾기의 판과 풀이: 깔기와 오르기를 모두 늘어놓는 것, 두 셈, 이름과 차례, 놓기와 무르기를 본다.
// 수는 풀이 프로그램과 다른 방법(tests/helpers/brute-tilings.js)으로 다시 따진다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MAX_STEPS,
  MAX_W,
  checkBoard,
  climbKey,
  climbs,
  compareKeys,
  countByColumns,
  countByStairs,
  coverKey,
  coverOfKey,
  coverings,
  emptyCells,
  hopsOf,
  isStuck,
  keysOf,
  landedOf,
  openCount,
  placeProblem,
  replay,
  solve,
  stairs,
  strip,
  tableStrip,
} from '../src/core/tilings.js';
import { bruteChoose, bruteClimbs, bruteCoverings, coverText } from './helpers/brute-tilings.js';

/** 판 하나를 세 방법으로 견준다: 늘어놓은 깔기(겹침 없이 같은 묶음), 열 한 줄씩의 셈, 비트 묶음의 셈 */
function checkStrip(h, w, holes = [], where = `${h}×${w} ${holes.join(',')}`) {
  const board = strip(h, w, { holes });
  const listed = coverings(board);
  const brute = bruteCoverings(h, w, holes);
  assert.equal(listed.length, brute.length, where);
  assert.equal(countByColumns(board), brute.length, where);
  assert.deepEqual(listed.map(coverText).sort(), brute.slice().sort(), where);
  // 이름: 깔기마다 다르고, 늘어놓은 차례가 이름의 차례다. 이름으로 깔기를 다시 만들 수 있다
  const keys = listed.map((placed) => coverKey(board, placed));
  assert.equal(new Set(keys).size, keys.length, where);
  assert.deepEqual(keys, keys.slice().sort(compareKeys), where);
  keys.forEach((key, index) => assert.equal(coverText(coverOfKey(board, key)), coverText(listed[index]), where));
  return brute.length;
}

test('2줄 띠 1~10칸: 늘어놓은 깔기와 두 셈이 다른 방법과 같다. 1, 2, 3, 5, 8, 13, 21, 34, 55, 89가지다', () => {
  const counts = Array.from({ length: 10 }, (_, index) => checkStrip(2, index + 1));
  assert.deepEqual(counts, [1, 2, 3, 5, 8, 13, 21, 34, 55, 89]);
  // 앞의 두 수를 더한 수다(수를 믿지 않고 위에서 하나하나 센 것으로 확인한다)
  for (let at = 2; at < counts.length; at++) assert.equal(counts[at], counts[at - 1] + counts[at - 2]);
});

test('3줄 띠 1~8칸: 칸이 홀수 개이면 0가지, 짝수 칸은 3, 11, 41, 153가지다', () => {
  const counts = Array.from({ length: 8 }, (_, index) => checkStrip(3, index + 1));
  assert.deepEqual(counts, [0, 3, 0, 11, 0, 41, 0, 153]);
  for (const w of [1, 3, 5, 7]) assert.equal(openCount(strip(3, w)) % 2, 1);
});

test('도미노 자리를 모두 골라 보는 셈과도 같다(작은 판과 칸이 빠진 판)', () => {
  for (let w = 1; w <= 5; w++) assert.equal(bruteChoose(2, w), keysOf(strip(2, w)).length, `2×${w}`);
  for (const w of [1, 2, 3, 4]) assert.equal(bruteChoose(3, w), keysOf(strip(3, w)).length, `3×${w}`);
  for (const [h, w, holes] of [[2, 4, [0, 7]], [2, 4, [0, 3]], [3, 4, [0, 11]], [3, 4, [5]], [3, 4, [0, 3]], [2, 5, [2, 7]]]) {
    assert.equal(bruteChoose(h, w, holes), keysOf(strip(h, w, { holes })).length, `${h}×${w} ${holes}`);
  }
});

test('칸이 빠진 작은 판: 2×4, 3×3, 2×5, 3×4에서 빠진 칸의 모든 묶음을 다른 방법과 견준다', () => {
  let zeroEven = 0;
  for (const [h, w] of [[2, 4], [3, 3], [2, 5], [3, 4]]) {
    const n = h * w;
    for (let mask = 0; mask < 2 ** n; mask++) {
      const holes = Array.from({ length: n }, (_, cell) => cell).filter((cell) => Math.floor(mask / 2 ** cell) % 2 === 1);
      if (n - holes.length < 2) continue;
      const board = strip(h, w, { holes });
      assert.equal(checkBoard(board), null);
      const count = checkStrip(h, w, holes);
      if (count === 0 && (n - holes.length) % 2 === 0) zeroEven += 1;
    }
  }
  // 칸이 짝수 개여도 덮을 수 없는 판이 있다(직접 만들기에서 선생님이 모든 방법을 해 봤다고 말하는 판)
  assert.ok(zeroEven > 0);
  assert.equal(keysOf(strip(2, 4, { holes: [0, 7] })).length, 0);
});

test('계단 1~10칸: 늘어놓은 오르기가 다른 방법과 같고, 2줄 띠와 같은 수다', () => {
  for (let n = 1; n <= 10; n++) {
    const list = climbs(n).map(climbKey);
    const brute = bruteClimbs(n);
    assert.deepEqual(list.slice().sort(), brute.slice().sort(), `계단 ${n}`);
    assert.deepEqual(list, list.slice().sort(compareKeys), `계단 ${n}`);
    assert.equal(countByStairs(n), brute.length, `계단 ${n}`);
    assert.equal(brute.length, bruteCoverings(2, n).length, `계단 ${n}`);
  }
  assert.deepEqual(keysOf(stairs(3)), ['111', '12', '21']);
  assert.deepEqual(landedOf([1, 2, 1]), [1, 3, 4]);
  assert.deepEqual(hopsOf(4, [1, 3, 4]), [1, 2, 1]);
  assert.equal(hopsOf(4, [3]), null);
  assert.equal(hopsOf(4, [2, 1]), null);
  assert.equal(hopsOf(4, [2, 4, 5]), null);
});

test('판의 규격: 줄 2~3, 2줄은 8칸·3줄은 6칸까지, 계단은 8칸까지, 덮을 칸은 둘 이상', () => {
  assert.deepEqual(MAX_W, { 2: 8, 3: 6 });
  assert.equal(MAX_STEPS, 8);
  assert.equal(checkBoard(strip(2, 8)), null);
  assert.equal(checkBoard(strip(3, 6)), null);
  assert.notEqual(checkBoard(strip(2, 9)), null);
  assert.notEqual(checkBoard(strip(3, 7)), null);
  assert.notEqual(checkBoard(strip(4, 2)), null);
  assert.notEqual(checkBoard(strip(2, 1, { holes: [0] })), null);
  assert.notEqual(checkBoard(strip(2, 2, { holes: [4] })), null);
  assert.equal(checkBoard(stairs(8)), null);
  assert.notEqual(checkBoard(stairs(9)), null);
  assert.equal(checkBoard(strip(2, 6, { table: true })), null);
  assert.notEqual(checkBoard(strip(3, 4, { table: true })), null);
  assert.notEqual(checkBoard({ ...strip(2, 3), guess: 'yes' }), null);
});

test('풀이: 판마다의 수, 표 만들기는 2×1부터 2×8까지의 수', () => {
  assert.equal(solve(strip(2, 5)).count, 8);
  assert.equal(solve(strip(3, 3)).cells, 9);
  assert.equal(solve(stairs(6)).count, 13);
  const table = solve(strip(2, 6, { table: true }));
  assert.deepEqual(table.counts, [1, 2, 3, 4, 5, 6, 7, 8].map((w) => bruteCoverings(2, w).length));
  assert.deepEqual(table.counts, [1, 2, 3, 5, 8, 13, 21, 34]);
  assert.deepEqual(tableStrip(3), strip(2, 3));
});

test('놓기, 들어내기, 무르기: 붙은 빈칸 둘에만 놓인다. 길을 따라가면 지금 놓인 도미노가 나온다', () => {
  const board = strip(2, 3);
  assert.equal(placeProblem(board, [], [0, 3]), null);
  assert.equal(placeProblem(board, [], [0, 1]), null);
  assert.equal(placeProblem(board, [], [0, 4]), 'apart');
  assert.equal(placeProblem(board, [], [2, 3]), 'apart');
  assert.equal(placeProblem(board, [[0, 3]], [0, 1]), 'taken');
  assert.equal(placeProblem(board, [], [0]), 'few');
  const trail = [
    { op: 'place', cells: [3, 0] },
    { op: 'place', cells: [1, 2] },
    { op: 'remove', cells: [0, 3] },
  ];
  assert.deepEqual(replay(board, trail), { ok: true, placed: [[1, 2]] });
  assert.equal(replay(board, [{ op: 'remove', cells: [0, 3] }]).ok, false);
  assert.equal(replay(board, [{ op: 'place', cells: [0, 2] }]).ok, false);
  // 다 덮은 깔기만 이름이 있다
  assert.equal(coverKey(board, [[0, 3]]), null);
  assert.equal(coverKey(board, [[0, 3], [1, 2], [4, 5]]), '011');
  // 더 놓을 자리가 없는 판: 3×3에 넷을 놓고 한 칸 남음, 2×3에 눕힌 도미노 둘을 엇갈려 놓아 떨어진 두 칸이 남음
  const odd = strip(3, 3);
  const four = [[0, 1], [2, 5], [3, 6], [7, 8]];
  assert.deepEqual(emptyCells(odd, four), [4]);
  assert.equal(isStuck(odd, four), true);
  assert.equal(isStuck(strip(2, 3), [[1, 4]]), false);
  assert.equal(isStuck(strip(2, 3), []), false);
  assert.equal(isStuck(strip(2, 3), [[0, 3], [1, 4], [2, 5]]), false);
  assert.equal(isStuck(strip(2, 3), [[0, 1], [4, 5]]), true);
});
