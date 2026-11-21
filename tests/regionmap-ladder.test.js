// 구역 지도 맞히기의 사다리와 판 내기, 더 작은 판: 단계마다 판 크기와 구역 수, 구역의 칸 수, 구역의 모양(네모인지), 작은 판이 같은 꼴인지 본다.
// 구역이 이어졌는지와 모든 칸이 칠해졌는지는 다른 방법(tests/helpers/brute-regionmap.js의 번져 가며 칠하기)으로 다시 본다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LADDER, MAKE_LEVEL, TOP_LEVEL, fewestRegions, generateBoard, isRect, nextSeed, rungOf, smallBoards } from '../src/core/regionmap-ladder.js';
import { checkBoard, minQuestions, sameBoard, sizesOf } from '../src/core/regionmap.js';
import { smallerRegionmap } from '../src/core/smaller.js';
import { joined } from './helpers/brute-regionmap.js';

const SEEDS = Array.from({ length: 30 }, (_, index) => index + 1);
const ok = (board) => board.regions.every((label) => joined(board.cells, board.w, board.h, label)) && board.cells.every((label) => board.regions.includes(label));

test('사다리: 여섯 단계, 표시는 기본·기본·응용·응용·도전·도전, 맨 위는 직접 만들기', () => {
  assert.deepEqual(LADDER.map((rung) => rung.level), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(LADDER.map((rung) => rung.tag), ['basic', 'basic', 'applied', 'applied', 'challenge', 'challenge']);
  assert.deepEqual(LADDER.map((rung) => rung.mode), ['ask', 'shape', 'three', 'fewest', 'four', 'make']);
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  assert.throws(() => generateBoard(6, 1));
  assert.throws(() => generateBoard(1, 0));
  assert.throws(() => rungOf(9));
});

test('첫 판: 3×3에 네모 숲, 4×4 계단, 5×5 세 구역, 4×4 위쪽 숲(네모 2개면 정해진다), 6×6 네 구역', () => {
  const firsts = [1, 2, 3, 4, 5].map((level) => generateBoard(level, 1).board);
  assert.deepEqual(firsts.map((board) => [board.w, board.h, board.regions.length]), [[3, 3, 2], [4, 4, 2], [5, 5, 3], [4, 4, 2], [6, 6, 4]]);
  assert.deepEqual(firsts.map(sizesOf), [[4, 5], [8, 8], [6, 10, 9], [7, 9], [6, 9, 10, 11]]);
  assert.ok(isRect(firsts[0].cells, 3, 0));
  assert.ok(!firsts[1].regions.some((label) => isRect(firsts[1].cells, 4, label)));
  assert.equal(minQuestions(firsts[0]).size, 1);
  assert.equal(minQuestions(firsts[3]).size, 2);
  for (const board of firsts) assert.ok(ok(board));
  // 수준 맞추기의 작은 판은 1단계의 첫 판이다
  assert.deepEqual(generateBoard(1, 7, { small: true }).board, firsts[0]);
  assert.equal(generateBoard(1, 7, { small: true }).small, true);
  assert.equal(generateBoard(2, 7, { small: true }).small, false);
});

test('판 번호 1~30: 같은 번호는 같은 판이고 규격에 맞다. 단계마다 판 크기, 구역 수, 구역의 칸 수의 아래 끝과 모양', () => {
  const SHAPE = { ask: [[3, 4], 2, 3], shape: [[4], 2, 5], three: [[5], 3, 5], fewest: [[4], null, 4], four: [[6], 4, 6] };
  for (let level = 1; level <= TOP_LEVEL; level++) {
    const { mode } = rungOf(level);
    const [sides, regions, floor] = SHAPE[mode];
    const seen = new Set();
    for (const seed of SEEDS) {
      const { board } = generateBoard(level, seed);
      const where = `${level}단계 ${seed}번`;
      assert.equal(checkBoard(board), null, where);
      assert.ok(ok(board), where);
      assert.deepEqual(generateBoard(level, seed).board, board, where);
      assert.equal(board.w, board.h, where);
      assert.ok(sides.includes(board.w), `${where}: ${board.w}`);
      assert.equal(board.regions.length, regions ?? fewestRegions(seed), where);
      assert.deepEqual(board.regions, board.regions.map((_, at) => at), where);
      if (seed > 1) assert.ok(Math.min(...sizesOf(board)) >= floor, `${where}: ${sizesOf(board)}`);
      if (mode === 'ask') assert.ok(board.regions.some((label) => isRect(board.cells, board.w, label)), where);
      if (mode === 'shape') assert.ok(!board.regions.some((label) => isRect(board.cells, board.w, label)), where);
      seen.add(board.cells.join(''));
    }
    // 판이 여러 가지로 나온다
    assert.ok(seen.size >= 20, `${level}단계: ${seen.size}가지`);
  }
  // 가장 적게 묻기의 판은 모두 가장 적은 네모 수를 구할 수 있다
  for (const seed of SEEDS.slice(0, 12)) assert.ok(minQuestions(generateBoard(4, seed).board), `4단계 ${seed}번`);
});

test('다음 판 번호는 방금 한 판과 같은 판을 건너뛴다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of SEEDS.slice(0, 10)) {
      const next = nextSeed(level, seed);
      assert.ok(next > seed);
      assert.ok(!sameBoard(generateBoard(level, next).board, generateBoard(level, seed).board), `${level}단계 ${seed}번`);
    }
  }
  assert.equal(nextSeed(MAKE_LEVEL, 3), 4);
});

test('더 작은 판: 칸이 더 적고 구역의 수와 이름이 같다. 구역마다 2칸 이상이고, 물어서 맞히기는 한 구역이 네모다', () => {
  const check = (board, mode, where) => {
    const list = smallBoards({ mode, board });
    assert.ok(list.length >= 1 && list.length <= 2, where);
    for (const small of list) {
      assert.equal(checkBoard(small), null, where);
      assert.ok(ok(small), where);
      assert.ok(small.w * small.h < board.w * board.h, where);
      assert.deepEqual(small.regions, board.regions, where);
      assert.ok(Math.min(...sizesOf(small)) >= 2, where);
      if (mode === 'ask') assert.ok(small.regions.some((label) => isRect(small.cells, small.w, label)), where);
    }
    assert.deepEqual(smallBoards({ mode, board }), list, where);
    for (const turn of [0, 1, 2]) assert.deepEqual(smallerRegionmap({ mode, board }, turn), { board: list[turn % list.length] }, where);
    return list;
  };
  for (let level = 1; level <= TOP_LEVEL; level++) {
    const { mode } = rungOf(level);
    for (const seed of SEEDS.slice(0, 15)) check(generateBoard(level, seed).board, mode, `${level}단계 ${seed}번`);
  }
  // 첫 판들의 작은 판: 3×3 → 2×2, 4×4 → 3×3과 2×2, 6×6 → 5×5와 4×4
  assert.deepEqual(smallBoards({ mode: 'ask', board: generateBoard(1, 1).board }).map((board) => [board.w, board.h]), [[2, 2]]);
  assert.deepEqual(smallBoards({ mode: 'shape', board: generateBoard(2, 1).board }).map((board) => [board.w, board.h]), [[3, 3], [2, 2]]);
  assert.deepEqual(smallBoards({ mode: 'four', board: generateBoard(5, 1).board }).map((board) => [board.w, board.h]), [[5, 5], [4, 4]]);
  // 직접 만든 판(숲과 모래밭)의 작은 판도 숲과 모래밭이다
  const made = { w: 4, h: 4, regions: [0, 2], cells: [0, 0, 2, 2, 0, 0, 2, 2, 0, 0, 2, 2, 0, 0, 2, 2] };
  for (const small of check(made, 'made', '만든 판')) assert.deepEqual(small.regions, [0, 2]);
  assert.equal(smallerRegionmap({ mode: 'ask', board: null }), null);
});
