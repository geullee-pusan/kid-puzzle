// 닿지 않게 놓기와 구역 긋기의 사다리 점검: 단계마다 판 번호 1~300이 그 단계의 조건에 맞고 풀이가 붙어 있는지,
// 3단계에서 시드 난수로 만든 판, 구역을 그어 둔 판과 긋는 판(구역으로 보일 수 있는 판만), 다음 판 번호, "더 작은 판"을 본다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LADDER, MAKE_LEVEL, POOL, SHAPES, SMALL_BOARD, TOP_LEVEL, generateBoard, nextSeed, poolBoard, rungOf } from '../src/core/apart-ladder.js';
import { boardFromRows, cellsOf, checkBoard, connected, freeCells, partitionOf, reachRate, solve } from '../src/core/apart.js';
import { SMALLER, smallerApart } from '../src/core/smaller.js';
import { allTouch, bruteCover, bruteMost, picture, searchMost } from './helpers/brute-apart.js';

const SEEDS = Array.from({ length: 300 }, (_, index) => index + 1);

test('사다리: 여섯 단계, 맨 위는 직접 만들기, 표시는 기본·기본·응용·응용·도전·도전', () => {
  assert.deepEqual(LADDER.map((rung) => rung.level), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(LADDER.map((rung) => rung.mode), ['place', 'place', 'place', 'shown', 'prove', 'make']);
  assert.deepEqual(LADDER.map((rung) => rung.tag), ['basic', 'basic', 'applied', 'applied', 'challenge', 'challenge']);
  assert.deepEqual(LADDER.map((rung) => rung.hint), ['side', 'king', 'king', 'shown', 'prove', 'king']);
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  assert.throws(() => generateBoard(6, 1));
  assert.throws(() => generateBoard(1, 0));
  assert.throws(() => rungOf(9));
  // 1단계는 변만, 그 위는 꼭짓점까지
  for (const rung of LADDER.filter((item) => item.boards)) for (const board of rung.boards) assert.equal(board.touch, rung.level === 1 ? 'side' : 'king');
  // 모양 판의 그림 글자는 가로 길이가 같다
  for (const rows of Object.values(SHAPES)) assert.ok(rows.every((row) => row.length === rows[0].length));
});

test('단계마다의 판: 규격에 맞고, 같은 번호는 같은 판이고, 붙어 있는 풀이가 다른 방법으로 구한 것과 같다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    const seen = new Map();
    for (const seed of SEEDS) {
      const { board, solution } = generateBoard(level, seed);
      const where = `${level}단계 ${seed}번 ${picture(board)}`;
      assert.equal(checkBoard(board), null, where);
      assert.deepEqual(generateBoard(level, seed).board, board, where);
      assert.deepEqual(solution, { best: solve(board).best, cover: solve(board).cover }, where);
      assert.ok(connected(board), where);
      const key = picture(board);
      if (!seen.has(key)) seen.set(key, board);
    }
    for (const board of seen.values()) {
      const where = `${level}단계 ${picture(board)}`;
      const best = cellsOf(board).length <= 22 ? bruteMost(board).best : searchMost(board);
      assert.equal(solve(board).best, best, where);
      if (level >= 4) assert.equal(bruteCover(board, best), best, `${where}: 구역으로 보일 수 있다`);
    }
  }
  // 정해 둔 판들
  assert.deepEqual(generateBoard(1, 1).board, { w: 3, h: 3, holes: [], touch: 'side', regions: null });
  assert.deepEqual(generateBoard(2, 1).board, { w: 3, h: 3, holes: [], touch: 'king', regions: null });
  assert.deepEqual(generateBoard(5, 1).board, { w: 3, h: 3, holes: [], touch: 'king', regions: null });
  assert.deepEqual(generateBoard(3, 2).board, boardFromRows(SHAPES.cross));
  assert.deepEqual([1, 2, 3, 4, 5].map((level) => generateBoard(level, 1).solution.best), [5, 4, 9, 6, 4]);
});

test('형식의 첫 판은 실패할 수 없다: 3×3에서 어디에 놓아도 더 놓을 자리는 언젠가 없어지고, 그때 한 번이 끝난다', () => {
  const { board } = generateBoard(1, 1);
  // 칸을 놓는 모든 차례를 따라가도(같은 칸은 한 번) 놓을 수 있는 칸에만 놓다 보면 끝이 난다
  const ends = new Set();
  const walk = (placed) => {
    const free = freeCells(board, placed);
    if (free.length === 0) {
      ends.add(placed.length);
      return;
    }
    for (const cell of free) walk([...placed, cell]);
  };
  walk([]);
  assert.deepEqual([...ends].sort(), [3, 4, 5]);
});

test('3단계: 정해 둔 판을 돈 뒤에는 시드 난수로 칸을 2~5개 뺀 판이다. 이어져 있고, 아무렇게나 놓으면 잘 안 닿는 판이다', () => {
  const rung = rungOf(3);
  assert.equal(rung.pool, true);
  for (const seed of SEEDS) {
    const { board } = generateBoard(3, seed);
    if (seed <= rung.boards.length) continue;
    const where = `3단계 ${seed}번 ${picture(board)}`;
    assert.deepEqual(board, poolBoard(3, seed), where);
    assert.ok(POOL.sizes.some(([w, h]) => w === board.w && h === board.h), where);
    assert.ok(board.holes.length >= POOL.holes[0] && board.holes.length <= POOL.holes[1], where);
    assert.ok(connected(board), where);
    assert.ok(solve(board).best >= POOL.least, where);
    assert.ok(reachRate(board) <= POOL.rate, where);
  }
  // 정해 둔 판도 모두 아무렇게나 놓으면 잘 안 닿는다(4×4처럼 어떻게 놓아도 되는 판은 쓰지 않았다)
  for (const board of rung.boards) assert.ok(reachRate(board) <= 0.15, picture(board));
});

test('4단계: 선생님이 그어 둔 구역은 판을 빠짐없이 나누고, 구역마다 칸이 서로 다 닿고, 구역 수가 가장 많이 놓는 수와 같다', () => {
  for (const seed of SEEDS.slice(0, 12)) {
    const { board } = generateBoard(4, seed);
    const where = `4단계 ${seed}번 ${picture(board)}`;
    const state = partitionOf(board, board.regions);
    assert.ok(state.complete, where);
    for (const region of board.regions) assert.ok(allTouch(board, region), where);
    assert.equal(board.regions.length, cellsOf(board).length <= 22 ? bruteMost(board).best : searchMost(board), where);
  }
  // 다른 단계의 판에는 그어 둔 구역이 없다
  for (const level of [1, 2, 3, 5]) for (const seed of SEEDS.slice(0, 8)) assert.equal(generateBoard(level, seed).board.regions, null);
});

test('5단계: 구역을 긋는 판은 모두 구역으로 보일 수 있는 판이다(가장 적은 구역 수 = 가장 많이 놓는 수)', () => {
  for (const board of rungOf(5).boards) {
    const result = solve(board);
    assert.ok(result.closes, picture(board));
    assert.equal(bruteCover(board, result.best), result.best, picture(board));
  }
});

test('작은 판부터일 때: 맨 아래 단계에서만 가장 작은 판(3×2, 변만)을 낸다', () => {
  assert.deepEqual(generateBoard(1, 4, { small: true }).board, { ...SMALL_BOARD, holes: [] });
  assert.equal(generateBoard(1, 4, { small: true }).solution.best, 3);
  assert.deepEqual(generateBoard(2, 1, { small: true }).board, generateBoard(2, 1).board);
});

test('다음 판 번호는 방금 한 판과 다른 판을 낸다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of [1, 2, 3, 5, 6, 7, 10, 40]) {
      const next = nextSeed(level, seed);
      assert.ok(next > seed);
      assert.notDeepEqual(generateBoard(level, next).board, generateBoard(level, seed).board, `${level}단계 ${seed}번`);
    }
  }
  assert.equal(nextSeed(1, 4), 5);
});

test('더 작은 판: 같은 약속의 작은 네모 판을 차례로 낸다. 그어 둔 판이면 작은 판에도 구역이 있다. 없으면 null이다', () => {
  assert.equal(SMALLER.apart, smallerApart);
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of SEEDS.slice(0, 8)) {
      const { board } = generateBoard(level, seed);
      const origin = { mode: rungOf(level).mode, board };
      const turns = [0, 1, 2, 3].map((turn) => smallerApart(origin, turn));
      if (turns[0] === null) {
        assert.ok(turns.every((item) => item === null));
        continue;
      }
      for (const small of turns) {
        const where = `${level}단계 ${seed}번 → ${picture(small.board)}`;
        assert.equal(checkBoard(small.board), null, where);
        assert.equal(small.board.touch, board.touch, where);
        assert.ok(cellsOf(small.board).length < cellsOf(board).length, where);
        assert.ok(solve(small.board).best >= 2, where);
        assert.equal(Array.isArray(small.board.regions), level === 4, where);
        if (level === 4) assert.equal(small.board.regions.length, bruteMost(small.board).best, where);
      }
      assert.deepEqual(smallerApart(origin, 2), turns[2], '같은 판, 같은 차례에는 같은 작은 판');
    }
  }
  // 3×3 꼭짓점 판에서는 3×2 하나, 그보다 작은 판(3×2, 2×2)에는 없다
  const three = { mode: 'place', board: generateBoard(2, 1).board };
  assert.deepEqual([0, 1].map((turn) => [smallerApart(three, turn).board.w, smallerApart(three, turn).board.h]), [
    [3, 2],
    [3, 2],
  ]);
  assert.equal(smallerApart({ mode: 'place', board: { w: 3, h: 2, holes: [], touch: 'king', regions: null } }), null);
  assert.equal(smallerApart({ mode: 'place', board: null }), null);
});
