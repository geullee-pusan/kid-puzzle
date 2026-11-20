// 열쇠 미로의 사다리와 판 내기를 확인한다.
// 같은 번호는 늘 같은 판, 나갈 수 없는 판은 셋에 하나(2, 5, 8, …번)이고 그 까닭은 아이에게 보이는 것(모두 따져 봐야 아는 판은 없다),
// 나갈 수 있는 판은 단계의 잣대(가장 적은 걸음, 갇히는 곳, 아무렇게나 걸어 나가는 비율, 열쇠를 가지러 돌아가는 길, 쓰는 차례)에 맞고,
// 가장 적은 걸음은 다른 방법(tests/helpers/brute-keymaze.js)으로 다시 구해도 같다. 더 작은 판도 여기서 본다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LADDER, MAKE_LEVEL, SMALL_SIZE, TOP_LEVEL, generateBoard, impossibleSeed, nextSeed, rungOf, smallBoards } from '../src/core/keymaze-ladder.js';
import { allUnlocked, checkBoard, countDoors, measure, orderMatters, sameBoard, solve, walkRate, withoutLocks } from '../src/core/keymaze.js';
import { createRng, seedFrom } from '../src/core/rng.js';
import { SMALLER, smallerKeymaze } from '../src/core/smaller.js';
import { bruteBack, bruteSolve } from './helpers/brute-keymaze.js';

const SEEDS = Array.from({ length: 60 }, (_, index) => index + 1);

test('사다리: 여섯 단계, 맨 위는 직접 만들기. 기본·응용·도전 표시', () => {
  assert.deepEqual(
    LADDER.map((rung) => [rung.level, rung.mode, rung.tag]),
    [
      [1, 'oneway', 'basic'],
      [2, 'keys', 'basic'],
      [3, 'mixed', 'applied'],
      [4, 'used', 'applied'],
      [5, 'fewest', 'challenge'],
      [6, 'make', 'challenge'],
    ],
  );
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  assert.throws(() => rungOf(7));
  assert.throws(() => generateBoard(6, 1));
  assert.throws(() => generateBoard(1, 0));
  // 열쇠 약속: 4단계만 한 번 쓰면 없어진다. 1단계에는 잠긴 문과 열쇠가 없다
  assert.deepEqual(LADDER.slice(0, 5).map((rung) => rung.spec.keep), ['kept', 'kept', 'kept', 'used', 'kept']);
  assert.deepEqual(LADDER[0].spec.locks, [0, 0]);
});

test('같은 번호는 늘 같은 판이고, 판은 쓸 수 있는 값이다. 다음 번호는 방금 한 판과 다른 판이다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of [1, 2, 3, 7, 20]) {
      const a = generateBoard(level, seed);
      const b = generateBoard(level, seed);
      assert.deepEqual(a, b);
      assert.equal(checkBoard(a.board), null);
      const next = nextSeed(level, seed);
      assert.ok(next > seed);
      assert.equal(sameBoard(generateBoard(level, next).board, a.board), false);
    }
  }
  assert.equal(nextSeed(MAKE_LEVEL, 4), 5);
});

test('단계마다 판 1~60번: 나갈 수 없는 판은 셋에 하나, 까닭은 단계의 목록 안(모두 따져 봐야 아는 판은 없다). 가장 적은 걸음이 다른 방법과 같다', () => {
  const stats = {};
  for (let level = 1; level <= TOP_LEVEL; level++) {
    const rung = rungOf(level);
    const reasons = {};
    for (const seed of SEEDS) {
      const { board, solution } = generateBoard(level, seed);
      const other = bruteSolve(board);
      assert.equal(solution.possible, other.possible, `${level}단계 ${seed}번`);
      assert.equal(solution.steps, other.steps, `${level}단계 ${seed}번`);
      assert.equal(board.keep, rung.spec.keep);
      assert.equal(solution.possible, !impossibleSeed(rung, seed), `${level}단계 ${seed}번`);
      if (!solution.possible) {
        assert.ok(rung.reasons.includes(solution.reason), `${level}단계 ${seed}번: ${solution.reason}`);
        reasons[solution.reason] = (reasons[solution.reason] ?? 0) + 1;
        // 처음 방에서 판의 절반 넘게 걸어 볼 수 있고, 잠긴 문이 있다
        assert.ok(measure(board).rooms * 2 > board.w * board.h, `${level}단계 ${seed}번`);
        assert.ok(countDoors(board).locks > 0);
        // 갇히는 판(trap)은 열쇠가 "나갈 수 있는 방"(잠긴 문을 열 수 있다고 칠 때) 밖에 있다
        if (solution.reason === 'trap') {
          const back = new Set(bruteBack(board));
          for (const room of solution.detail.keyRooms) assert.equal(back.has(room), false, `${level}단계 ${seed}번`);
        }
      }
    }
    stats[level] = reasons;
  }
  // 나갈 수 없는 판이 섞이는 단계는 3, 4단계다. 까닭은 차례로 돌아가며 나온다
  assert.deepEqual(Object.keys(stats[1]), []);
  assert.deepEqual(Object.keys(stats[2]), []);
  assert.deepEqual(Object.keys(stats[5]), []);
  assert.deepEqual(Object.keys(stats[3]).sort(), ['nokey', 'trap']);
  assert.deepEqual(Object.keys(stats[4]).sort(), ['nokey', 'trap', 'twice']);
  for (const level of [3, 4]) assert.equal(Object.values(stats[level]).reduce((sum, n) => sum + n, 0), 20);
});

test('맨 처음 판들: 1단계 1번은 갇히는 곳이 없고, 3단계 2번(맨 처음의 나갈 수 없는 판)은 3×3에서 열쇠를 가져올 수 없는 판이다', () => {
  const first = generateBoard(1, 1);
  assert.equal(measure(first.board).doomed, 0);
  assert.ok(first.solution.possible);
  const none = generateBoard(3, 2);
  assert.deepEqual([none.board.w, none.board.h], [3, 3]);
  assert.equal(none.solution.reason, 'nokey');
  // 수준 맞추기가 "작은 판부터"라고 하면 1단계에서 3×2 판을 낸다(그것도 갇히는 곳이 없다)
  const small = generateBoard(1, 4, { small: true });
  assert.deepEqual([small.board.w, small.board.h], SMALL_SIZE);
  assert.equal(small.small, true);
  assert.equal(measure(small.board).doomed, 0);
  assert.equal(generateBoard(2, 4, { small: true }).small, false);
});

test('나갈 수 있는 판은 단계의 잣대에 맞는다(전략 9.1절: 아무렇게나 해서는 잘 안 되는 판)', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    const rung = rungOf(level);
    for (const seed of SEEDS.slice(0, 30)) {
      if (impossibleSeed(rung, seed)) continue;
      const { board, solution } = generateBoard(level, seed);
      const where = `${level}단계 ${seed}번`;
      assert.ok(solution.steps >= rung.rule.steps, where);
      const shape = measure(board);
      if (level === 1 && seed === 1) continue;
      assert.ok(shape.doomed > 0, `${where}: 갇히는 곳`);
      const walks = walkRate(board, createRng(seedFrom('keymaze-walk', level, seed)));
      assert.ok(walks.rate <= rung.rule.rate, `${where}: ${walks.rate}`);
      if (rung.mode !== 'oneway') {
        // 잠긴 문 없이는 나갈 수 없고, 열쇠를 가지러 돌아가야 한다
        assert.equal(solve(withoutLocks(board)).possible, false, where);
        assert.ok(solution.steps >= solve(allUnlocked(board)).steps + 2, where);
      } else assert.equal(countDoors(board).locks + countDoors(board).keys, 0, where);
      if (rung.mode === 'used') assert.equal(orderMatters(board), true, where);
      if (rung.mode === 'fewest') {
        const fewest = walks.lengths.filter((length) => length === solution.steps).length;
        assert.ok(walks.lengths.length >= 4 && fewest / walks.lengths.length <= rung.rule.fewest, where);
        assert.ok(board.w * board.h >= 20, where);
      }
    }
  }
});

test('판을 만드는 시간: 단계마다 판 1~30번을 만드는 데 한 판에 0.2초가 걸리지 않는다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of SEEDS.slice(0, 30)) {
      // 다른 테스트와 함께 돌 때는 한 번 잰 값이 튈 수 있어서, 세 번까지 재어 가장 빠른 값으로 본다(기준은 그대로)
      let ms = Infinity;
      for (let tries = 0; tries < 3 && ms >= 200; tries++) {
        const at = process.hrtime.bigint();
        generateBoard(level, seed);
        ms = Math.min(ms, Number(process.hrtime.bigint() - at) / 1e6);
      }
      assert.ok(ms < 200, `${level}단계 ${seed}번: ${ms}ms`);
    }
  }
});

test('더 작은 판: 열쇠 약속과 문 종류가 같고 방이 3분의 2 이하. 나갈 수 없는 판에서는 나갈 수 있는 판부터 까닭이 같은 판과 번갈아 낸다', () => {
  assert.equal(SMALLER.keymaze, smallerKeymaze);
  for (let level = 1; level <= TOP_LEVEL; level++) {
    const rung = rungOf(level);
    for (const seed of SEEDS.slice(0, 15)) {
      const { board, solution } = generateBoard(level, seed);
      const origin = { mode: rung.mode, board };
      const turns = [0, 1, 2, 3].map((turn) => smallerKeymaze(origin, turn));
      const where = `${level}단계 ${seed}번`;
      turns.forEach((small, turn) => {
        assert.ok(small, `${where} ${turn}번째`);
        const { board: little } = small;
        assert.equal(checkBoard(little), null);
        assert.equal(little.keep, board.keep);
        assert.ok(little.w * little.h * 3 <= board.w * board.h * 2, where);
        const result = solve(little);
        assert.equal(result.possible, bruteSolve(little).possible);
        if (solution.possible || turn % 2 === 0) assert.equal(result.possible, true, `${where} ${turn}번째`);
        else {
          assert.equal(result.possible, false, `${where} ${turn}번째`);
          assert.equal(result.reason, solution.reason, `${where} ${turn}번째`);
        }
        // 열쇠가 있는 판에서는 작은 판에도 열쇠가 있다. 한쪽 문만 있는 판에서는 작은 판에도 잠긴 문이 없다
        if (board.keys.length > 0) assert.ok(little.keys.length > 0, where);
        if (countDoors(board).locks === 0) assert.equal(countDoors(little).locks, 0, where);
      });
      assert.deepEqual(smallerKeymaze(origin, 2), turns[2], '같은 판, 같은 차례에는 같은 작은 판');
      assert.equal(sameBoard(turns[0].board, turns[1].board) && solution.possible, false, `${where}: 이어서 여는 두 판은 다르다`);
    }
  }
  // 2×2보다 작은 판은 없고, 규격에 맞지 않는 판에도 없다
  const tiny = { w: 2, h: 2, start: 0, exit: { room: 3, side: 'e', color: null }, doors: [{ a: 0, b: 1, kind: 'open' }, { a: 1, b: 3, kind: 'open' }], keys: [], keep: 'kept' };
  assert.equal(smallerKeymaze({ mode: 'oneway', board: tiny }), null);
  assert.deepEqual(smallBoards({ board: tiny }), { yes: [], no: [] });
  assert.equal(smallerKeymaze({ mode: 'oneway', board: null }), null);
});
