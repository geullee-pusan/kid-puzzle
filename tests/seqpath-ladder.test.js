// 수열 길 퍼즐의 사다리와 판 내기를 확인한다.
// 같은 번호는 늘 같은 판이고, 사다리의 모든 판은 길을 잇는 방법이 꼭 하나다(풀이 프로그램과 다른 방법인 tests/helpers/brute-seqpath.js로 다시 센다).
// 단계마다의 잣대(크기, 뛰는 크기, 빈칸의 몫, 가까이 있지만 다른 길의 수)와 더 작은 판도 여기서 본다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LADDER, MAKE_LEVEL, SMALL_SIZE, TOP_LEVEL, emptyShare, generateBoard, nearPairs, nextSeed, rungOf, smallBoards } from '../src/core/seqpath-ladder.js';
import { checkBoard, countSolutions, isDone, judgePath, pathsKey } from '../src/core/seqpath.js';
import { SMALLER, smallerSeqpath } from '../src/core/smaller.js';
import { bruteEdges } from './helpers/brute-seqpath.js';

const SEEDS = Array.from({ length: 40 }, (_, index) => index + 1);
/** 길마다 뛰는 크기(앞뒤 없이) */
const stepsOf = (board, paths) => paths.map((path) => Math.abs(judgePath(board, path).step));

test('사다리: 여섯 단계, 맨 위는 직접 만들기. 기본·응용·도전 표시. 4×4 → 5×5 → 같은 간격 → 6×6 → 8×8', () => {
  assert.deepEqual(
    LADDER.map((rung) => [rung.level, rung.mode, rung.tag, rung.spec?.size ?? null]),
    [
      [1, 'four', 'basic', [4, 4]],
      [2, 'five', 'basic', [5, 5]],
      [3, 'same', 'applied', [5, 5]],
      [4, 'six', 'applied', [6, 6]],
      [5, 'eight', 'challenge', [8, 8]],
      [6, 'make', 'challenge', null],
    ],
  );
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  assert.throws(() => rungOf(7));
  assert.throws(() => generateBoard(6, 1));
  assert.throws(() => generateBoard(1, 0));
  assert.deepEqual(SMALL_SIZE, [3, 3]);
});

test('같은 번호는 늘 같은 판이고, 판은 쓸 수 있는 값이다. 다음 번호는 방금 한 판과 다른 판이다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of [1, 2, 7]) {
      const a = generateBoard(level, seed);
      const b = generateBoard(level, seed);
      assert.deepEqual(a, b);
      assert.equal(checkBoard(a.board), null);
      // 돌려준 판을 고쳐도 다음에 내는 판은 그대로다
      b.board.values[0] = 98;
      assert.deepEqual(generateBoard(level, seed), a);
      const next = nextSeed(level, seed);
      assert.ok(next > seed);
      assert.notEqual(generateBoard(level, next).board.values.join(), a.board.values.join());
    }
  }
  assert.equal(nextSeed(MAKE_LEVEL, 4), 5);
});

test('단계마다 판 1~40번: 길을 잇는 방법이 꼭 하나다(다른 방법으로 다시 센다). 단계의 잣대에 맞는다', () => {
  const facts = {};
  for (let level = 1; level <= TOP_LEVEL; level++) {
    const { spec } = rungOf(level);
    const shares = [];
    const pathCounts = [];
    for (const seed of SEEDS) {
      const { board, solution } = generateBoard(level, seed);
      const where = `${level}단계 ${seed}번`;
      const other = bruteEdges(board, 2);
      assert.equal(other.count, 1, where);
      assert.equal(solution.count, 1, where);
      assert.equal(pathsKey(other.solutions[0]), pathsKey(solution.paths), where);
      assert.equal(isDone(board, solution.paths), true, where);
      // 첫 판(1단계 1번)은 1씩 뛰는 짧은 길만 있는 4×4다
      const first = level === 1 && seed === 1;
      assert.deepEqual([board.w, board.h], spec.size, where);
      const steps = stepsOf(board, solution.paths);
      if (first) assert.deepEqual([...new Set(steps)], [1], where);
      else for (const step of steps) assert.ok(spec.steps.includes(step), where);
      if (spec.sameStep) assert.equal(new Set(steps).size, 1, where);
      // 수는 1부터 단계의 위 끝까지이고, 판에 같은 수가 두 번 나오지 않는다
      const numbers = board.values.filter((value) => value !== null);
      assert.equal(new Set(numbers).size, numbers.length, where);
      assert.ok(numbers.every((value) => value >= 1 && value <= spec.maxValue), where);
      const share = emptyShare(board);
      if (!first) {
        assert.ok(share >= spec.empty[0] && share <= spec.empty[1], `${where}: ${share}`);
        assert.ok(nearPairs(board, solution.paths) >= spec.near, where);
      }
      // 길마다 칸 수와 수의 개수
      for (const path of solution.paths) {
        assert.ok(path.length >= 3 && path.length <= (first ? 5 : spec.lens[1]), where);
        assert.ok(judgePath(board, path).numbers.length >= 3, where);
      }
      shares.push(share);
      pathCounts.push(solution.paths.length);
    }
    facts[level] = { empty: Math.round((100 * shares.reduce((a, b) => a + b, 0)) / shares.length), paths: Math.round((10 * pathCounts.reduce((a, b) => a + b, 0)) / pathCounts.length) / 10 };
  }
  // 빈칸의 몫(평균, %)과 길의 수(평균)는 단계가 오를수록 대체로 는다
  assert.ok(facts[5].empty > facts[1].empty, JSON.stringify(facts));
  assert.ok(facts[5].paths > facts[4].paths && facts[4].paths > facts[1].paths, JSON.stringify(facts));
});

test('1단계의 작은 판(수준 맞추기의 "작은 판부터"): 3×3, 1씩 뛰는 길, 답은 하나', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const { board, solution, small } = generateBoard(1, seed, { small: true });
    assert.equal(small, true);
    assert.deepEqual([board.w, board.h], SMALL_SIZE);
    assert.equal(bruteEdges(board, 2).count, 1);
    assert.deepEqual([...new Set(stepsOf(board, solution.paths))], [1]);
  }
  // 1단계가 아니면 작은 판을 내지 않는다
  assert.equal(generateBoard(2, 1, { small: true }).small, false);
});

test('8×8 판도 풀이 프로그램이 곧바로 센다(판 하나에 따져 보는 걸음이 2만 번 안쪽)', () => {
  let most = 0;
  for (const seed of SEEDS) most = Math.max(most, countSolutions(generateBoard(5, seed).board, { limit: 2 }).nodes);
  assert.ok(most < 20000, String(most));
});

test('더 작은 판: 같은 종류, 칸 수는 3분의 2 이하, 답은 하나. 3×3 판에는 없다', () => {
  assert.equal(SMALLER.seqpath, smallerSeqpath);
  for (let level = 1; level <= TOP_LEVEL; level++) {
    const { spec, mode } = rungOf(level);
    for (const seed of [1, 2, 3]) {
      const { board } = generateBoard(level, seed);
      const origin = { mode, board };
      const lists = smallBoards(origin);
      assert.equal(lists.no.length, 0);
      assert.equal(lists.yes.length, 2, `${level}단계 ${seed}번`);
      for (const small of lists.yes) {
        assert.ok(small.w * small.h * 3 <= board.w * board.h * 2);
        assert.ok(small.w >= 3 && small.h >= 3);
        const other = bruteEdges(small, 2);
        assert.equal(other.count, 1);
        const steps = stepsOf(small, other.solutions[0]);
        for (const step of steps) assert.ok(spec.steps.includes(step), `${level}단계 ${seed}번`);
        if (spec.sameStep) assert.equal(new Set(steps).size, 1);
      }
      // 같은 판, 같은 차례에는 늘 같은 판
      assert.deepEqual(smallerSeqpath(origin, 1), smallerSeqpath(origin, 1));
      assert.deepEqual(smallerSeqpath(origin, 0).board, lists.yes[0]);
    }
  }
  // 3×3 판(1단계의 작은 판)은 더 줄일 수 없다
  assert.equal(smallerSeqpath({ mode: 'four', board: generateBoard(1, 1, { small: true }).board }, 0), null);
  // 직접 만든 판: 그 판의 수 사이의 차에서 뛰는 크기를 고른다
  const madeBoard = { w: 5, h: 5, values: [10, null, 20, null, 30, ...new Array(20).fill(null)] };
  const made = smallBoards({ mode: 'made', board: madeBoard });
  assert.equal(made.yes.length, 2);
  // 차가 9보다 큰 수뿐이면 1~3에서 고른다
  for (const small of made.yes) for (const step of stepsOf(small, bruteEdges(small, 2).solutions[0])) assert.ok([1, 2, 3].includes(step));
  const madeSmall = smallerSeqpath({ mode: 'made', board: { w: 5, h: 5, values: [1, 3, 5, null, null, ...new Array(20).fill(null)] } }, 0);
  assert.equal(bruteEdges(madeSmall.board, 2).count, 1);
  assert.equal(smallerSeqpath({ mode: 'made', board: { w: 2, h: 2, values: [1, 2, 3, 4] } }, 0), null);
});
