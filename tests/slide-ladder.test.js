// 번호 말 제자리 찾기의 사다리와 판 내기, 더 작은 판 점검. 판의 가장 적은 횟수와 되는지는 다른 방법(tests/helpers/brute-slide.js)으로 다시 따진다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, impossibleAt, nextSeed, recordMode, rungOf, simpleNoBoards, smallBoards, solveOnce } from '../src/core/slide-ladder.js';
import { checkBoard, isDone, sameBoard } from '../src/core/slide.js';
import { smallerSlide } from '../src/core/smaller.js';
import { pairCount, readLine, slideDistances, swapDistances } from './helpers/brute-slide.js';

const SEEDS = Array.from({ length: 120 }, (_, index) => index + 1);
const REACH = { 2: slideDistances(3, 2), 3: slideDistances(3, 3) };
const SWAPS = Object.fromEntries([4, 5, 6, 7].map((n) => [n, swapDistances(n)]));

/** 다른 방법으로 구한 가장 적은 횟수(안 되는 판이면 null) */
function bruteFewest(board) {
  const key = board.cells.join(',');
  if (board.kind === 'swap') return (SWAPS[board.w] ?? swapDistances(board.w)).get(key);
  return REACH[board.h].get(key) ?? null;
}

test('사다리: 여섯 단계, 맨 위는 직접 만들기. 기본·응용·도전 표시가 있다', () => {
  assert.deepEqual(
    LADDER.map((rung) => [rung.level, rung.tag, rung.mode]),
    [
      [1, 'basic', 'swap'],
      [2, 'basic', 'fewest'],
      [3, 'applied', 'small'],
      [4, 'applied', 'big'],
      [5, 'challenge', 'least'],
      [6, 'challenge', 'make'],
    ],
  );
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  assert.throws(() => rungOf(7));
  assert.throws(() => generateBoard(6, 1));
  assert.throws(() => generateBoard(1, 0));
  // 기록 깨기 판: 가장 적게 맞바꾸기, 가장 적게 밀기, 직접 만든 맞바꾸기 줄
  assert.deepEqual(['swap', 'fewest', 'small', 'big', 'least'].map((mode) => recordMode(mode, rungOf(LADDER.findIndex((rung) => rung.mode === mode) + 1).kind)), [false, true, false, false, true]);
  assert.equal(recordMode('made', 'swap'), true);
  assert.equal(recordMode('made', 'slide'), false);
});

test('정해 둔 첫 판들: 실패할 수 없는 첫 판, 처음 만나는 안 되는 판은 1과 2만 바뀐 2×3 판', () => {
  assert.deepEqual(generateBoard(1, 1).board, { kind: 'swap', w: 4, h: 1, cells: [1, 3, 2, 4] });
  assert.equal(bruteFewest(generateBoard(1, 1).board), 1);
  assert.deepEqual(generateBoard(1, 5, { small: true }).board, generateBoard(1, 1).board);
  assert.equal(generateBoard(1, 5, { small: true }).small, true);
  assert.equal(generateBoard(3, 5, { small: true }).small, false);
  assert.deepEqual(generateBoard(2, 1).board.cells, [2, 1, 5, 3, 4]);
  assert.equal(bruteFewest(generateBoard(2, 1).board), 3);
  assert.deepEqual(generateBoard(3, 1).board.cells, [1, 2, 3, 0, 4, 5]);
  assert.equal(bruteFewest(generateBoard(3, 1).board), 2);
  // 3단계에서 처음 만나는 안 되는 판(2번): 제자리에서 1과 2만 바뀌었다. 한 줄로 읽으면 큰 수가 앞에 선 짝이 1개
  const first = generateBoard(3, 2).board;
  assert.deepEqual(first.cells, [2, 1, 3, 4, 5, 0]);
  assert.equal(bruteFewest(first), null);
  assert.equal(pairCount(readLine(first.cells)), 1);
  // 4단계 2번: 3×3 판에서 7과 8만 바뀌었다
  assert.deepEqual(generateBoard(4, 2).board.cells, [1, 2, 3, 4, 5, 6, 8, 7, 0]);
  assert.equal(bruteFewest(generateBoard(4, 2).board), null);
  // 4, 5단계의 첫 판은 범위의 아래쪽이다
  assert.ok(bruteFewest(generateBoard(4, 1).board) <= 6);
  assert.ok(bruteFewest(generateBoard(5, 1).board) <= 8);
});

test('단계마다의 판: 규격에 맞고, 가장 적은 횟수가 범위 안이고, 안 되는 판은 판 번호로 정한 자리에만 있다(다른 방법으로 다시 따진다)', () => {
  const started = process.cpuUsage();
  for (const rung of LADDER.filter((item) => item.mode !== 'make')) {
    let no = 0;
    let before = null;
    for (const seed of SEEDS) {
      const { board } = generateBoard(rung.level, seed);
      const where = `${rung.level}단계 ${seed}번`;
      assert.equal(checkBoard(board), null, where);
      assert.equal(board.kind, rung.kind, where);
      assert.ok(rung.sizes.includes(board.kind === 'swap' ? board.w : board.h), where);
      assert.ok(!isDone(board.cells), where);
      const fewest = bruteFewest(board);
      const solved = solveOnce(board);
      assert.equal(solved.fewest, fewest, where);
      assert.equal(solved.possible, fewest !== null, where);
      // 되는지 안 되는지는 판 번호로 정한 자리와 같다(여섯 판에 둘, 연달아 나오지 않는다)
      assert.equal(fewest === null, impossibleAt(rung, seed), where);
      if (fewest === null) {
        no += 1;
        assert.equal(pairCount(readLine(board.cells)) % 2, 1, `${where}: 홀수`);
        assert.notEqual(before, null, `${where}: 연달아 안 되는 판`);
      } else if (seed > 2) {
        const [low, high] = rung.fewest;
        assert.ok(fewest >= Math.min(low, 2) && fewest <= high, `${where}: ${fewest}번`);
        if (seed > 1 && rung.kind === 'slide') assert.ok(fewest >= low, `${where}: ${fewest}번`);
      }
      before = fewest;
      // 같은 번호는 늘 같은 판이다
      assert.deepEqual(generateBoard(rung.level, seed).board, board, where);
    }
    if (rung.impossible) assert.equal(no, 40, `${rung.level}단계 안 되는 판`);
    else assert.equal(no, 0);
  }
  const used = process.cpuUsage(started);
  assert.ok((used.user + used.system) / 1000 < 4000, `${Math.round((used.user + used.system) / 1000)}ms`);
});

test('판 번호: 다음 판은 방금 한 판과 다르다', () => {
  for (const rung of LADDER.filter((item) => item.mode !== 'make')) {
    for (const seed of SEEDS.slice(0, 40)) {
      const next = nextSeed(rung.level, seed);
      assert.ok(next > seed);
      assert.ok(!sameBoard(generateBoard(rung.level, next).board, generateBoard(rung.level, seed).board));
    }
  }
  assert.equal(nextSeed(MAKE_LEVEL, 3), 4);
});

test('더 작은 판: 맞바꾸기는 말이 적은 줄, 3×3은 2×3, 2×3은 제자리에 더 가까운 판. 되는 판에서는 되는 판만, 안 되는 판에서는 되는 판부터 번갈아 낸다', () => {
  let none = 0;
  for (const rung of LADDER.filter((item) => item.mode !== 'make')) {
    for (const seed of SEEDS.slice(0, 60)) {
      const { board } = generateBoard(rung.level, seed);
      const origin = { mode: rung.mode, board };
      const from = bruteFewest(board);
      const where = `${rung.level}단계 ${seed}번`;
      for (const turn of [0, 1, 2, 3]) {
        const small = smallerSlide(origin, turn);
        if (small === null) {
          // 말이 셋인 줄과 가장 적게 2번 안쪽인 되는 2×3 판에만 없다
          assert.ok(board.kind === 'slide' && board.h === 2 && from !== null && from <= 2, where);
          none += turn === 0 ? 1 : 0;
          continue;
        }
        const next = small.board;
        assert.equal(checkBoard(next), null, where);
        assert.equal(next.kind, board.kind, where);
        assert.ok(!isDone(next.cells), where);
        const fewest = bruteFewest(next);
        if (board.kind === 'swap') {
          assert.ok(next.w < board.w, where);
          assert.ok(fewest >= 2, where);
        } else if (board.h === 3) assert.equal(next.h, 2, where);
        else if (fewest !== null && from !== null) assert.ok(fewest < from && fewest >= 1, `${where}: ${from} → ${fewest}`);
        // 되는 판에서는 되는 판만. 안 되는 판에서는 되는 판부터, 안 되는 판과 번갈아
        assert.equal(fewest !== null, from !== null || turn % 2 === 0, `${where} ${turn}번째`);
        if (fewest === null) assert.ok(simpleNoBoards().some((item) => sameBoard(item, next)), where);
        assert.deepEqual(smallerSlide(origin, turn), small, `${where}: 같은 판에서는 같은 작은 판`);
      }
    }
  }
  assert.ok(none > 0 && none < 20, `없는 판 ${none}개`);
  // 말이 셋인 줄, 규격에 맞지 않는 판에는 없다
  assert.equal(smallerSlide({ mode: 'made', board: { kind: 'swap', w: 3, h: 1, cells: [2, 3, 1] } }), null);
  assert.equal(smallerSlide({ mode: 'big', board: { kind: 'slide', w: 2, h: 2, cells: [1, 2, 3, 0] } }), null);
  assert.equal(smallerSlide({ board: null }), null);
  // 안 되는 2×3 판(1과 2만 바뀐 판)에서는 첫 작은 판이 되는 판, 둘째가 다른 안 되는 판이다
  const first = { mode: 'small', board: generateBoard(3, 2).board };
  assert.notEqual(bruteFewest(smallerSlide(first, 0).board), null);
  assert.equal(bruteFewest(smallerSlide(first, 1).board), null);
  assert.ok(!sameBoard(smallerSlide(first, 1).board, first.board));
  assert.deepEqual(smallBoards(first).no.length, 2);
});
