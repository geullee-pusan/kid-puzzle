// 번호 말 제자리 찾기의 판과 풀이 프로그램 점검. 풀이 프로그램이 낸 것(가장 적은 횟수, 안 되는 판)을 다른 방법(tests/helpers/brute-slide.js)으로 다시 따진다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  applySlide,
  applySwap,
  canSlide,
  checkBoard,
  cyclesOf,
  farthestOf,
  fewestSwaps,
  goalCells,
  isDone,
  isUpDown,
  lineOf,
  rankOf,
  replay,
  slideDistance,
  slidePath,
  solve,
  swapPath,
  swappedCount,
  swappedPairs,
  tableFor,
  unrank,
} from '../src/core/slide.js';
import { allOrders, pairCount, readLine, slideDistances, slidesFrom, swapDistances } from './helpers/brute-slide.js';

const range = (n, from = 1) => Array.from({ length: n }, (_, index) => index + from);
/** 3×3 판의 모든 차례와 다른 너비 우선 탐색의 결과는 한 번만 만든다(테스트가 가볍게) */
const ORDERS = { 6: allOrders(range(6, 0)), 9: allOrders(range(9, 0)) };
const REACH = { 2: slideDistances(3, 2), 3: slideDistances(3, 3) };

test('판의 규격: 맞바꾸기는 말 3~8개의 한 줄, 밀기는 가로 3칸에 세로 2칸이나 3칸', () => {
  assert.equal(checkBoard({ kind: 'swap', w: 4, h: 1, cells: [2, 1, 4, 3] }), null);
  assert.equal(checkBoard({ kind: 'slide', w: 3, h: 2, cells: [1, 2, 3, 4, 5, 0] }), null);
  assert.equal(checkBoard({ kind: 'slide', w: 3, h: 3, cells: [1, 2, 3, 4, 5, 6, 7, 8, 0] }), null);
  assert.equal(checkBoard({ kind: 'swap', w: 2, h: 1, cells: [2, 1] }), 'size');
  assert.equal(checkBoard({ kind: 'swap', w: 9, h: 1, cells: range(9) }), 'size');
  assert.equal(checkBoard({ kind: 'swap', w: 4, h: 1, cells: [1, 1, 2, 3] }), 'cells');
  assert.equal(checkBoard({ kind: 'slide', w: 2, h: 2, cells: [1, 2, 3, 0] }), 'size');
  assert.equal(checkBoard({ kind: 'slide', w: 3, h: 2, cells: [1, 2, 3, 4, 5, 6] }), 'cells');
  assert.equal(checkBoard({ kind: 'slide', w: 3, h: 2, cells: [1, 2, 3, 4, 5] }), 'cells');
  assert.equal(checkBoard({ kind: 'cut', w: 3, h: 2, cells: [1, 2, 3, 4, 5, 0] }), 'kind');
  assert.equal(checkBoard(null), 'no-board');
  assert.ok(isDone(goalCells('swap', 5, 1)));
  assert.ok(isDone(goalCells('slide', 3, 3)));
  assert.ok(!isDone([1, 2, 3, 4, 0, 5]));
});

test('맞바꾸기: 가장 적은 횟수는 말의 수 − 고리의 수다. 말 3~7개의 모든 줄을 너비 우선 탐색으로 다시 따진다', () => {
  for (let n = 3; n <= 7; n++) {
    const dist = swapDistances(n);
    assert.equal(dist.size, allOrders(range(n)).length);
    for (const [key, depth] of dist) {
      const cells = key.split(',').map(Number);
      assert.equal(fewestSwaps(cells), depth, key);
      assert.equal(solve({ kind: 'swap', w: n, h: 1, cells }).fewest, depth, key);
      // 왼쪽부터 데려오는 방법이 그 횟수에 끝난다
      const path = swapPath(cells);
      assert.equal(path.length, depth, key);
      assert.ok(isDone(replay({ kind: 'swap', w: n, h: 1, cells }, path).cells), key);
    }
  }
});

test('맞바꾸기: 두 말을 맞바꾸면 고리가 꼭 하나 늘거나 하나 준다(같은 고리면 갈라지고 다른 고리면 합쳐진다)', () => {
  for (let n = 3; n <= 6; n++) {
    for (const cells of allOrders(range(n))) {
      const cycles = cyclesOf(cells);
      const which = new Map(cycles.flatMap((cycle, index) => cycle.map((at) => [at, index])));
      for (let a = 0; a < n; a++) {
        for (let b = a + 1; b < n; b++) {
          const after = cyclesOf(applySwap(cells, a, b)).length;
          assert.equal(after - cycles.length, which.get(a) === which.get(b) ? 1 : -1, `${cells} ${a}↔${b}`);
        }
      }
    }
  }
  // 고리는 화살표(그 자리의 말이 가야 할 자리)를 따라간 자리들이다
  assert.deepEqual(cyclesOf([2, 1, 5, 3, 4]), [[0, 1], [2, 4, 3]]);
  assert.deepEqual(cyclesOf([1, 2, 3]), [[0], [1], [2]]);
});

test('순열 번호: 번호와 차례가 서로 되돌아간다', () => {
  for (const cells of allOrders(range(5, 0))) assert.deepEqual(unrank(rankOf(cells), 5), cells);
  assert.equal(rankOf([0, 1, 2, 3]), 0);
  assert.equal(rankOf([3, 2, 1, 0]), 23);
});

test('밀기 2×3: 표의 가장 적은 횟수가 다른 너비 우선 탐색과 모든 모습에서 같다. 닿는 모습은 720가지 가운데 360가지다', () => {
  const brute = REACH[2];
  assert.equal(brute.size, 360);
  assert.equal(tableFor(3, 2).reachable, 360);
  for (const cells of ORDERS[6]) {
    const want = brute.get(cells.join(',')) ?? null;
    assert.equal(slideDistance(3, 2, cells), want, cells.join(','));
  }
  assert.equal(farthestOf(3, 2), 21);
  assert.equal(Math.max(...brute.values()), 21);
});

test('밀기 3×3: 표의 가장 적은 횟수가 다른 너비 우선 탐색과 닿는 모든 모습에서 같다. 181,440가지이고 가장 먼 판은 31번(두 가지)이다', () => {
  const brute = REACH[3];
  assert.equal(brute.size, 181440);
  assert.equal(tableFor(3, 3).reachable, 181440);
  let far = 0;
  for (const [key, depth] of brute) {
    const cells = key.split(',').map(Number);
    assert.equal(slideDistance(3, 3, cells), depth);
    if (depth === 31) far += 1;
  }
  assert.equal(farthestOf(3, 3), 31);
  assert.equal(far, 2);
});

test('바뀌지 않는 것: 가로 3칸 판(세로 2칸, 3칸)에서는 큰 수가 앞에 선 짝의 수가 짝수인 판만 된다. 모든 모습을 따진다', () => {
  for (const [h, n] of [
    [2, 6],
    [3, 9],
  ]) {
    const reach = REACH[h];
    let even = 0;
    for (const cells of ORDERS[n]) {
      const count = pairCount(readLine(cells));
      assert.equal(swappedCount(lineOf(cells)), count);
      assert.equal(reach.has(cells.join(',')), count % 2 === 0, cells.join(','));
      assert.equal(slideDistance(3, h, cells) !== null, count % 2 === 0);
      if (count % 2 === 0) even += 1;
    }
    // 절반이 안 되는 판이다
    assert.equal(even * 2, ORDERS[n].length);
  }
});

test('옆으로 밀면 한 줄로 읽은 차례가 그대로이고, 위아래로 밀면 수 하나가 다른 수 둘을 건너뛴다. 짝의 수는 2 늘거나 2 줄거나 그대로다', () => {
  const changes = new Set();
  for (const [h, n] of [
    [2, 6],
    [3, 9],
  ]) {
    for (const [index, cells] of ORDERS[n].entries()) {
      if (h === 3 && index % 7 !== 0) continue;
      const before = readLine(cells);
      for (const [at, after, upDown] of slidesFrom(3, h, cells)) {
        assert.equal(isUpDown(3, cells, at), upDown);
        assert.ok(canSlide(3, h, cells, at));
        assert.deepEqual(applySlide(cells, at), after);
        const line = readLine(after);
        if (!upDown) {
          assert.deepEqual(line, before);
          continue;
        }
        // 민 말만 자리가 바뀌고, 그 사이에 다른 수가 꼭 둘 있다
        const value = cells[at];
        const from = before.indexOf(value);
        const to = line.indexOf(value);
        assert.equal(Math.abs(from - to), 2);
        assert.deepEqual(line.filter((item) => item !== value), before.filter((item) => item !== value));
        const change = pairCount(line) - pairCount(before);
        changes.add(change);
      }
    }
  }
  assert.deepEqual([...changes].sort((a, b) => a - b), [-2, 0, 2]);
});

test('가로 2칸 판에서는 위아래로 밀 때 한 수만 건너뛰어 짝의 수가 1 바뀐다("왜 그럴까?"의 넷째 장). 그 판은 24가지 가운데 12가지에 닿는다', () => {
  const reach = slideDistances(2, 2);
  assert.equal(reach.size, 12);
  for (const cells of allOrders(range(4, 0))) {
    for (const [, after, upDown] of slidesFrom(2, 2, cells)) {
      if (upDown) assert.equal(Math.abs(pairCount(readLine(after)) - pairCount(readLine(cells))), 1);
    }
  }
  // 짝의 수가 짝수여도 안 되는 판이 있다(한 줄 짝의 홀짝만으로는 가를 수 없다)
  assert.ok(allOrders(range(4, 0)).some((cells) => pairCount(readLine(cells)) % 2 === 0 && !reach.has(cells.join(','))));
});

test('가장 적게 미는 방법: 빈칸 옆의 말만 밀고, 가장 적은 횟수에 제자리에 닿는다', () => {
  for (const [h, n, step] of [
    [2, 6, 1],
    [3, 9, 997],
  ]) {
    for (const [index, cells] of ORDERS[n].entries()) {
      if (index % step !== 0 || pairCount(readLine(cells)) % 2 === 1) continue;
      const board = { kind: 'slide', w: 3, h, cells };
      const path = slidePath(3, h, cells);
      assert.equal(path.length, slideDistance(3, h, cells));
      const result = replay(board, path);
      assert.ok(result.ok);
      assert.ok(isDone(result.cells));
      assert.deepEqual(solve(board).path, path);
    }
  }
  assert.equal(slidePath(3, 2, [2, 1, 3, 4, 5, 0]), null);
  assert.deepEqual(solve({ kind: 'slide', w: 3, h: 2, cells: [2, 1, 3, 4, 5, 0] }), { possible: false, fewest: null, path: [], count: 1 });
});

test('한 일의 차례 다시 하기: 판에 맞지 않는 움직임이 있으면 그만둔다', () => {
  const swap = { kind: 'swap', w: 4, h: 1, cells: [1, 3, 2, 4] };
  assert.deepEqual(replay(swap, [[1, 2]]), { ok: true, cells: [1, 2, 3, 4] });
  assert.equal(replay(swap, [[2, 1]]).ok, false);
  assert.equal(replay(swap, [[0, 4]]).ok, false);
  assert.equal(replay(swap, 'x').ok, false);
  const slide = { kind: 'slide', w: 3, h: 2, cells: [1, 2, 3, 0, 4, 5] };
  assert.deepEqual(replay(slide, [4, 5]), { ok: true, cells: [1, 2, 3, 4, 5, 0] });
  // 빈칸 옆이 아닌 말, 빈칸 자체, 판 밖은 밀 수 없다
  assert.equal(replay(slide, [2]).ok, false);
  assert.equal(replay(slide, [3]).ok, false);
  assert.equal(replay(slide, [9]).ok, false);
  // 줄 끝과 다음 줄 처음은 옆이 아니다
  assert.equal(canSlide(3, 2, [1, 2, 0, 3, 4, 5], 3), false);
  assert.deepEqual(swappedPairs([2, 3, 1]), [[2, 1], [3, 1]]);
});
