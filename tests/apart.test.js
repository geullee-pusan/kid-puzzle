// 닿지 않게 놓기와 구역 긋기의 판과 풀이 프로그램 점검.
// 가장 많이 놓는 수와 그 방법의 수는 모든 칸 묶음을 골라 보는 방법(작은 판)과 가지를 치며 따지는 방법(큰 판)으로,
// 가장 적은 구역 수는 서로 다 닿는 칸 묶음을 모두 늘어놓고 덮어 보는 방법으로 다시 구해 견준다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MAX_SIZE,
  MIN_SIZE,
  boardFromRows,
  cellsOf,
  checkBoard,
  conflictsOf,
  connected,
  copyBoard,
  firstFit,
  freeCells,
  marblesOk,
  neighboursOf,
  partitionOf,
  reachRate,
  smallBoards,
  solve,
  solveCover,
  solveMost,
  touchedCells,
  touches,
  twoIn,
} from '../src/core/apart.js';
import { createRng, randInt } from '../src/core/rng.js';
import { allTouch, apart, bruteCover, bruteMost, cellsIn, near, picture, searchMost } from './helpers/brute-apart.js';

const rect = (w, h, touch = 'king') => ({ w, h, holes: [], touch, regions: null });
const withHoles = (w, h, mask, touch) => ({ w, h, holes: Array.from({ length: w * h }, (_, cell) => cell).filter((cell) => mask & (1 << cell)), touch, regions: null });

/** 풀이 프로그램의 답이 제 말에 맞는가: 한 가지 방법은 규칙에 맞고 그 수만큼이고, 나누기는 빠짐없이 서로 다 닿는 구역으로 그 수만큼이다 */
function selfCheck(board, result, where) {
  assert.equal(result.example.length, result.best, where);
  assert.ok(apart(board, result.example), where);
  assert.ok(marblesOk(board, result.example), where);
  assert.equal(result.regions.length, result.cover, where);
  const state = partitionOf(board, result.regions);
  assert.ok(state.ok && state.complete, where);
  for (const region of result.regions) assert.ok(allTouch(board, region), where);
  assert.ok(result.cover >= result.best, where);
  assert.equal(result.closes, result.cover === result.best, where);
}

test('판의 규격: 크기는 2~8칸, 닿는 약속은 변만이거나 변과 꼭짓점, 빠진 칸은 작은 것부터, 그어 둔 구역은 빠짐없이 서로 다 닿는다', () => {
  assert.deepEqual([MIN_SIZE, MAX_SIZE], [2, 8]);
  assert.equal(checkBoard(rect(3, 3)), null);
  assert.equal(checkBoard(rect(8, 8, 'side')), null);
  assert.equal(checkBoard(null), 'no-board');
  assert.equal(checkBoard(rect(1, 3)), 'bad-size');
  assert.equal(checkBoard(rect(9, 3)), 'bad-size');
  assert.equal(checkBoard({ ...rect(3, 3), touch: 'corner' }), 'bad-touch');
  assert.equal(checkBoard({ ...rect(3, 3), holes: [4, 2] }), 'bad-holes');
  assert.equal(checkBoard({ ...rect(2, 2), holes: [0, 1, 2, 3] }), 'no-cells');
  assert.equal(checkBoard({ ...rect(2, 2), regions: undefined }), 'bad-regions');
  assert.equal(checkBoard({ ...rect(2, 2), regions: [[0, 1, 2, 3]] }), null);
  // 빠짐없지 않거나, 겹치거나, 구슬 둘이 들어가는 구역은 안 된다
  assert.equal(checkBoard({ ...rect(2, 2), regions: [[0, 1, 2]] }), 'bad-regions');
  assert.equal(checkBoard({ ...rect(2, 2), regions: [[0, 1, 2, 3], [3]] }), 'bad-regions');
  assert.equal(checkBoard({ ...rect(2, 2, 'side'), regions: [[0, 1, 2, 3]] }), 'bad-regions');
  // 그림 글자로 만든 판, 베끼기
  const cross = boardFromRows(['.#.', '###', '.#.']);
  assert.deepEqual(cross, { w: 3, h: 3, holes: [0, 2, 6, 8], touch: 'king', regions: null });
  assert.deepEqual(cellsOf(cross), [1, 3, 4, 5, 7]);
  const shown = { ...rect(2, 2), regions: [[0, 1], [2, 3]] };
  const copy = copyBoard(shown);
  assert.deepEqual(copy, shown);
  copy.regions[0].push(9);
  assert.deepEqual(shown.regions[0], [0, 1]);
});

test('닿는 칸: 거리로 따진 것과 같다(변만이면 넷, 꼭짓점까지면 여덟. 판 밖과 빠진 칸은 없다)', () => {
  const boards = [rect(4, 3), rect(4, 3, 'side'), boardFromRows(['##.#', '#.##', '####']), boardFromRows(['##.#', '#.##', '####'], 'side'), rect(2, 5)];
  for (const board of boards) {
    for (const a of cellsOf(board)) {
      assert.deepEqual(neighboursOf(board, a), cellsIn(board).filter((b) => near(board, a, b)), picture(board));
      for (const b of cellsOf(board)) assert.equal(touches(board, a, b), near(board, a, b));
    }
  }
  assert.equal(neighboursOf(rect(3, 3), 4).length, 8);
  assert.equal(neighboursOf(rect(3, 3, 'side'), 4).length, 4);
  assert.deepEqual(neighboursOf(rect(3, 3), 0), [1, 3, 4]);
  assert.equal(touches(rect(3, 3), 4, 4), false);
});

test('구슬 놓기: 닿는 구슬, 더 놓을 수 있는 칸, 닿는 빈칸, 규칙에 맞는 놓임', () => {
  const board = rect(3, 3);
  assert.deepEqual(conflictsOf(board, [0, 8], 4), [0, 8]);
  assert.deepEqual(conflictsOf(board, [0], 2), []);
  assert.deepEqual(freeCells(board, [4]), []);
  assert.deepEqual(freeCells(board, [0]), [2, 5, 6, 7, 8]);
  assert.deepEqual(touchedCells(board, [0]), [1, 3, 4]);
  assert.deepEqual(touchedCells(board, [0, 2]), [1, 3, 4, 5]);
  assert.ok(marblesOk(board, [0, 2, 6, 8]));
  assert.ok(!marblesOk(board, [0, 4]));
  assert.ok(!marblesOk(board, [0, 0]));
  assert.ok(!marblesOk({ ...board, holes: [0] }, [0]));
  assert.ok(!marblesOk(board, [9]));
  // 변만이면 비스듬한 칸에 놓을 수 있다
  assert.deepEqual(conflictsOf(rect(3, 3, 'side'), [0], 4), []);
});

test('구역 살피기: 서로 닿지 않는 두 칸을 찾고, 빠진 칸과 겹침을 가린다', () => {
  const board = rect(3, 3);
  assert.equal(twoIn(board, [0, 1, 3, 4]), null);
  assert.deepEqual(twoIn(board, [0, 1, 2]), [0, 2]);
  assert.deepEqual(twoIn(rect(2, 2, 'side'), [3, 0, 1, 2]), [0, 3]);
  const partial = partitionOf(board, [[0, 1, 3, 4], [2, 5, 8]]);
  assert.deepEqual(partial, { ok: true, complete: false, bad: [1], pairs: [null, [2, 8]], missing: [6, 7] });
  const done = partitionOf(board, [[0, 1, 3, 4], [2, 5], [6, 7], [8]]);
  assert.equal(done.complete, true);
  assert.equal(partitionOf(board, [[0, 1], [1, 2]]).ok, false);
  assert.equal(partitionOf({ ...board, holes: [4] }, [[4]]).ok, false);
  assert.equal(partitionOf(board, [[]]).ok, false);
});

test('가장 많이 놓기와 가장 적은 구역: 칸이 20개 이하인 모든 네모 판에서 모든 칸 묶음을 골라 본 것과 같다', () => {
  for (const touch of ['side', 'king']) {
    for (let w = 2; w <= 5; w++) {
      for (let h = 2; h <= 5; h++) {
        if (w * h > 20) continue;
        const board = rect(w, h, touch);
        const result = solve(board);
        const brute = bruteMost(board);
        const where = picture(board);
        assert.equal(result.best, brute.best, where);
        assert.equal(result.ways, brute.ways, where);
        assert.equal(result.cover, bruteCover(board, brute.best), where);
        selfCheck(board, result, where);
      }
    }
  }
});

test('빠진 칸이 있는 판: 3×3과 4×2의 모든 빠진 칸 모습, 4×4와 5×4에서 고른 300판이 다른 방법과 같다', () => {
  const boards = [];
  for (const touch of ['side', 'king']) {
    for (const [w, h] of [
      [3, 3],
      [4, 2],
    ]) {
      for (let mask = 0; mask < (1 << (w * h)) - 1; mask++) boards.push(withHoles(w, h, mask, touch));
    }
  }
  const rng = createRng(2026);
  for (let index = 0; index < 300; index++) {
    const [w, h] = index % 2 === 0 ? [4, 4] : [5, 4];
    const mask = randInt(rng, 0, (1 << (w * h)) - 2) & randInt(rng, 0, (1 << (w * h)) - 1);
    boards.push(withHoles(w, h, mask, index % 3 === 0 ? 'side' : 'king'));
  }
  for (const board of boards) {
    if (cellsOf(board).length === 0) continue;
    const result = solve(board);
    const brute = bruteMost(board);
    const where = picture(board);
    assert.equal(result.best, brute.best, where);
    assert.equal(result.ways, brute.ways, where);
    assert.equal(result.cover, bruteCover(board, brute.best), where);
    selfCheck(board, result, where);
  }
});

test('큰 판: 8×8까지의 네모 판과 모양 판에서 가장 많이 놓는 수가 가지를 치며 따진 것과 같다', () => {
  const boards = [];
  for (const touch of ['side', 'king']) for (let w = 2; w <= 8; w++) for (let h = 2; h <= 8; h++) if (w * h > 20) boards.push(rect(w, h, touch));
  const rng = createRng(7);
  for (let index = 0; index < 60; index++) {
    const w = randInt(rng, 5, 7);
    const h = randInt(rng, 5, 7);
    const holes = new Set();
    const count = randInt(rng, 1, 10);
    while (holes.size < count) holes.add(randInt(rng, 0, w * h - 1));
    boards.push({ w, h, holes: [...holes].sort((a, b) => a - b), touch: index % 4 === 0 ? 'side' : 'king', regions: null });
  }
  for (const board of boards) {
    const result = solve(board);
    assert.equal(result.best, searchMost(board), picture(board));
    selfCheck(board, result, picture(board));
  }
});

test('네모 판은 늘 구역으로 보일 수 있다: 꼭짓점까지는 (가로 + 1) ÷ 2 × (세로 + 1) ÷ 2, 변만이면 칸 수의 절반(올림)', () => {
  for (let w = 2; w <= 8; w++) {
    for (let h = 2; h <= 8; h++) {
      const king = solve(rect(w, h));
      assert.equal(king.best, Math.ceil(w / 2) * Math.ceil(h / 2));
      assert.equal(king.cover, king.best);
      const side = solve(rect(w, h, 'side'));
      assert.equal(side.best, Math.ceil((w * h) / 2));
      assert.equal(side.cover, side.best);
      // 놓는 방법: 두 변이 모두 홀수이면 하나뿐이다(변만이든 꼭짓점까지든). 변만이면 그 밖에는 둘이다
      if (w % 2 === 1 && h % 2 === 1) {
        assert.equal(king.ways, 1);
        assert.equal(side.ways, 1);
      } else assert.equal(side.ways, 2);
    }
  }
  assert.deepEqual([4, 6, 8].map((n) => solve(rect(n, n)).ways), [79, 3600, 281571]);
});

test('구역으로 보일 수 없는 판: 4×4에서 칸을 뺀 65,535판 가운데 32판(변으로 이어진 판은 8판)이고 가장 작은 것은 7칸(변으로 이어진 판은 9칸)이다. 세 줄짜리 판에는 없다', () => {
  let gaps = 0;
  let linked = 0;
  let fewest = Infinity;
  let smallest = Infinity;
  for (let mask = 0; mask < (1 << 16) - 1; mask++) {
    const board = withHoles(4, 4, mask, 'king');
    const result = solve(board);
    if (result.cover === result.best) continue;
    gaps += 1;
    smallest = Math.min(smallest, cellsOf(board).length);
    if (connected(board)) {
      linked += 1;
      fewest = Math.min(fewest, cellsOf(board).length);
    }
  }
  assert.deepEqual([gaps, linked, fewest, smallest], [32, 8, 9, 7]);
  // 가장 작은 것: 비스듬히 이어진 일곱 칸의 고리. 칸마다 고리의 두 이웃하고만 닿아서 구역은 두 칸까지라 넷이 들고, 구슬은 셋까지다
  const ring = boardFromRows(['..#.', '.#.#', '#..#', '.##.']);
  assert.deepEqual([bruteMost(ring).best, bruteCover(ring), cellsOf(ring).length], [3, 4, 7]);
  for (const cell of cellsOf(ring)) assert.equal(cellsIn(ring).filter((other) => near(ring, cell, other)).length, 2);
  for (const [w, h] of [
    [3, 3],
    [4, 3],
    [5, 3],
  ]) {
    for (let mask = 0; mask < (1 << (w * h)) - 1; mask++) {
      const result = solve(withHoles(w, h, mask, 'king'));
      assert.equal(result.cover, result.best, `${w}×${h} ${mask}`);
    }
  }
  // 그 가운데 하나: 구슬은 셋이 가장 많지만 구역은 넷보다 적게 나눌 수 없다(다른 방법으로도)
  const odd = boardFromRows(['.#..', '###.', '#.##', '.##.']);
  assert.deepEqual([bruteMost(odd).best, bruteCover(odd)], [3, 4]);
  assert.deepEqual([solve(odd).best, solve(odd).cover, solve(odd).closes], [3, 4, false]);
  // 변만 닿지 않으면 되는 판은 늘 보일 수 있다(빠진 칸이 있어도)
  for (let mask = 0; mask < (1 << 12) - 1; mask++) {
    const result = solve(withHoles(4, 3, mask, 'side'));
    assert.equal(result.cover, result.best);
  }
});

test('풀이 프로그램은 같은 판에 늘 같은 답을 내고, 내준 값을 고쳐도 다음 답이 바뀌지 않는다. 8×8도 빠르다', () => {
  const board = rect(8, 8);
  const started = performance.now();
  const one = solve(board);
  solveMost(rect(8, 7));
  solveCover(rect(7, 8, 'side'));
  assert.ok(performance.now() - started < 2000);
  one.example.push(99);
  one.regions[0].push(99);
  const two = solve(board);
  assert.equal(two.example.length, 16);
  assert.ok(!two.regions[0].includes(99));
  assert.deepEqual(solve(board), two);
  // 그어 보이는 구역은 큰 구역부터 고른다: 짝수 판은 2×2 네모로만 나뉜다
  assert.ok(solve(rect(4, 4)).regions.every((region) => region.length === 4));
});

test('아무렇게나 놓았을 때 닿는 비율과 "위 줄 왼쪽부터 놓기"', () => {
  assert.equal(reachRate(rect(4, 4)), 1);
  assert.ok(reachRate(rect(5, 5)) < 0.05);
  assert.equal(reachRate(rect(5, 5)), reachRate(rect(5, 5)));
  const rate = reachRate(rect(3, 3));
  assert.ok(rate > 0 && rate < 1);
  assert.deepEqual(firstFit(rect(3, 3)), [0, 2, 6, 8]);
  assert.deepEqual(firstFit(rect(3, 3, 'side')), [0, 2, 4, 6, 8]);
  assert.ok(connected(boardFromRows(['#.#', '###'])));
  assert.ok(!connected(boardFromRows(['#.#', '...'])));
});

test('작은 판: 같은 약속의 네모 판이고, 칸 수가 3분의 2 이하이고, 구슬을 둘 이상 놓을 수 있다. 그어 둔 판에는 가장 적은 구역을 긋는다', () => {
  const list = smallBoards(rect(5, 5));
  assert.ok(list.length > 0);
  for (const small of list) {
    assert.equal(small.touch, 'king');
    assert.ok(small.w * small.h <= (25 * 2) / 3);
    assert.ok(small.w >= small.h);
    assert.ok(solve(small).best >= 2);
    assert.equal(small.regions, null);
  }
  assert.deepEqual(smallBoards(rect(3, 3)).map((board) => [board.w, board.h]), [[3, 2]]);
  assert.deepEqual(smallBoards(rect(3, 3, 'side')).map((board) => [board.w, board.h]), [[3, 2], [2, 2]]);
  assert.deepEqual(smallBoards(rect(3, 2)), []);
  const shown = smallBoards({ ...rect(5, 4), regions: solve(rect(5, 4)).regions });
  for (const small of shown) {
    assert.equal(checkBoard(small), null);
    assert.equal(small.regions.length, solve(small).best);
  }
  // 세로로 긴 판에서는 세로로 긴 작은 판
  assert.ok(smallBoards(rect(3, 5)).every((board) => board.h >= board.w));
});
