// 조각 못 들어가게 막기의 사다리와 판 내기 점검. 낸 판은 풀이 프로그램과 다른 방법으로 다시 확인하고,
// "좋은 판"의 기준(가장 뻔한 요령인 "자리가 가장 많이 지나는 칸부터 막기"로는 가장 적게 막을 수 없는가)을 판마다 잰다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LADDER, MAKE_LEVEL, SMALL_BOARD, TOP_LEVEL, boardOf, generateBoard, nextSeed, rungOf } from '../src/core/block-ladder.js';
import { SOLVE_LIMIT, allPlacements, checkBoard, greedyBlock, placementsOf, solve } from '../src/core/block.js';
import { bruteBlock, rowBlock } from './helpers/brute-block.js';

const playing = LADDER.filter((rung) => rung.mode !== 'make');
const name = ([piece, w, h]) => `${piece} ${w}×${h}`;

/** 사다리의 판마다 가장 적게 막는 칸 수. 풀이 프로그램으로 구해 적어 둔 값이고, 아래 테스트가 다른 방법으로 다시 구해 견준다. */
const BEST = {
  1: [4, 6, 7, 8],
  2: [5, 4, 5, 5, 6, 6],
  3: [4, 4, 4, 5, 6],
  4: [8, 7, 8, 8, 6, 10],
};

test('사다리: 다섯 단계이고 표시는 기본·응용·응용·도전·도전, 맨 위는 직접 만들기', () => {
  assert.deepEqual(LADDER.map((rung) => rung.level), [1, 2, 3, 4, 5]);
  assert.deepEqual(LADDER.map((rung) => rung.tag), ['basic', 'applied', 'applied', 'challenge', 'challenge']);
  assert.deepEqual(LADDER.map((rung) => rung.mode), ['play', 'play', 'play', 'play', 'make']);
  assert.deepEqual(LADDER.map((rung) => rung.hint), ['start', 'more', 'more', 'more', 'more']);
  assert.equal(TOP_LEVEL, 4);
  assert.equal(MAKE_LEVEL, 5);
  assert.throws(() => rungOf(6));
  assert.throws(() => generateBoard(MAKE_LEVEL, 1));
});

test('단계마다 정해 둔 판: 1단계는 도미노, 2단계는 세 칸 조각, 3단계는 네 칸 조각, 4단계는 더 큰 판', () => {
  assert.ok(rungOf(1).boards.every(([piece]) => piece === 'domino'));
  assert.ok(rungOf(2).boards.every(([piece]) => ['bar', 'ell'].includes(piece)));
  assert.ok(rungOf(3).boards.every(([piece]) => ['square', 'long', 'tee', 'bend', 'zig'].includes(piece)));
  assert.deepEqual(new Set(rungOf(3).boards.map(([piece]) => piece)).size, 5, '3단계에는 네 칸 조각 다섯이 모두 나온다');
  // 판은 가로가 세로보다 짧지 않다(태블릿을 눕혀 쓴다). 4단계의 판은 3단계의 판보다 칸이 적지 않다.
  for (const rung of playing) for (const [, w, h] of rung.boards) assert.ok(w >= h, `${rung.level}단계 ${w}×${h}`);
  const cells = (rung) => rung.boards.map(([, w, h]) => w * h);
  assert.ok(Math.min(...cells(rungOf(4))) >= Math.min(...cells(rungOf(3))));
  assert.ok(Math.max(...cells(rungOf(4))) > Math.max(...cells(rungOf(3))));
});

test('사다리의 판마다 가장 적게 막는 칸 수는 다른 방법으로 센 것과 같다', (t) => {
  const lines = [];
  for (const rung of playing) {
    const found = rung.boards.map((item) => {
      const board = boardOf(item);
      const solved = solve(board);
      assert.equal(solved.exact, true, name(item));
      assert.ok(solved.nodes < SOLVE_LIMIT / 50, `${name(item)}: ${solved.nodes}갈래`);
      const other = board.w * board.h <= 20 ? bruteBlock(board).best : rowBlock(board);
      assert.equal(solved.best, other, name(item));
      lines.push(`${rung.level}단계 ${name(item)}: ${solved.best}칸(자리가 많이 지나는 칸부터 막으면 ${greedyBlock(board).length}칸, 조각이 들어갈 자리 ${solved.spots}군데)`);
      return solved.best;
    });
    assert.deepEqual(found, BEST[rung.level], `${rung.level}단계`);
  }
  // 작은 판부터일 때의 판(3×2 도미노)
  assert.equal(solve(boardOf(SMALL_BOARD)).best, bruteBlock(boardOf(SMALL_BOARD)).best);
  t.diagnostic(lines.join('\n'));
});

test('같은 번호는 늘 같은 판이고, 판마다 풀이 프로그램의 결과가 붙어 있다', () => {
  for (const rung of playing) {
    for (let seed = 1; seed <= 20; seed++) {
      const made = generateBoard(rung.level, seed);
      const where = `${rung.level}단계 ${seed}번`;
      assert.deepEqual(made, generateBoard(rung.level, seed), where);
      assert.deepEqual([made.level, made.seed, made.small], [rung.level, seed, false], where);
      assert.equal(checkBoard(made.board), null, where);
      assert.deepEqual(made.board, boardOf(rung.boards[(seed - 1) % rung.boards.length]), where);
      const solved = solve(made.board);
      assert.deepEqual(made.solution, { exact: true, best: solved.best, blocked: solved.blocked }, where);
      assert.equal(placementsOf(made.board, made.solution.blocked).length, 0, where);
      assert.equal(made.solution.blocked.length, made.solution.best, where);
    }
  }
});

test('판 번호가 달라지면 그 단계의 판들을 차례로 돈다. "새 판"은 늘 다른 판이다', () => {
  for (const rung of playing) {
    const count = rung.boards.length;
    assert.ok(count >= 4);
    for (let seed = 1; seed <= 3 * count; seed++) {
      const next = nextSeed(rung.level, seed);
      assert.equal(next, seed + 1);
      assert.notDeepEqual(generateBoard(rung.level, next).board, generateBoard(rung.level, seed).board, `${rung.level}단계 ${seed}번 다음`);
      assert.deepEqual(generateBoard(rung.level, seed + count).board, generateBoard(rung.level, seed).board, `${rung.level}단계 ${seed}번`);
    }
    // 이웃한 두 판은 조각이 다르거나 크기가 다르다. 2~4단계에서는 이웃한 두 판의 조각이 늘 다르다.
    if (rung.level >= 2) for (let index = 0; index < count; index++) assert.notEqual(rung.boards[index][0], rung.boards[(index + 1) % count][0], `${rung.level}단계 ${index}`);
  }
  assert.throws(() => nextSeed(9, 1));
});

test('작은 판부터: 맨 아래 단계에서만 가장 작은 판(3×2 도미노)을 낸다', () => {
  assert.deepEqual(SMALL_BOARD, ['domino', 3, 2]);
  for (let seed = 1; seed <= 6; seed++) assert.deepEqual(generateBoard(1, seed, { small: true }).board, { w: 3, h: 2, piece: 'domino', holes: [] });
  assert.equal(generateBoard(1, 2, { small: true }).small, true);
  assert.deepEqual(generateBoard(2, 2, { small: true }).board, generateBoard(2, 2).board);
  const smallest = Math.min(...rungOf(1).boards.map(([, w, h]) => w * h));
  assert.ok(3 * 2 < smallest);
});

test('형식의 첫 판은 실패할 수 없다: 어떻게 막아도 조각이 들어갈 자리는 언젠가 없어진다', () => {
  assert.deepEqual(generateBoard(1, 1).board, { w: 3, h: 3, piece: 'domino', holes: [] });
  for (const item of rungOf(1).boards) {
    const board = boardOf(item);
    // 모든 칸을 막으면 조각이 들어갈 자리가 없다. 막을수록 자리는 늘지 않는다.
    const all = Array.from({ length: board.w * board.h }, (_, cell) => cell);
    assert.equal(placementsOf(board, all).length, 0, name(item));
    let left = allPlacements(board).length;
    for (const cell of all) {
      const now = placementsOf(board, all.slice(0, cell + 1)).length;
      assert.ok(now <= left, name(item));
      left = now;
    }
  }
});

test('좋은 판: 첫 판과 4단계의 모든 판은 "자리가 가장 많이 지나는 칸부터 막기"로는 가장 적게 막을 수 없다', () => {
  const first = boardOf(rungOf(1).boards[0]);
  assert.ok(greedyBlock(first).length > solve(first).best);
  for (const item of rungOf(4).boards) {
    const board = boardOf(item);
    assert.ok(greedyBlock(board).length > solve(board).best, name(item));
  }
  // 2~3단계에서도 절반 이상은 그렇다.
  for (const level of [2, 3]) {
    const worse = rungOf(level).boards.filter((item) => greedyBlock(boardOf(item)).length > solve(boardOf(item)).best);
    assert.ok(worse.length * 2 >= rungOf(level).boards.length - 1, `${level}단계: ${worse.length}판`);
  }
});
