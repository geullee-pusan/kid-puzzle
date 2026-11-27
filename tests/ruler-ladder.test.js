// 눈금이 가장 적은 자의 사다리 점검: 단계마다 판의 꼴, 정해 둔 첫 판, 같은 번호는 같은 판, 다음 판 번호, 더 작은 판,
// 그리고 가장 긴 자와 가장 긴 길이 칸에서도 누르는 칸이 44픽셀보다 작아지지 않는지 본다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CHAIN_SIZE, GOLOMB_SPAN, LADDER, MAKE_LEVEL, MAKE_MAX, MAKE_MIN, TOP_LEVEL, generateBoard, golombRoomy, nextSeed, recordMode, rungOf, smallBoards } from '../src/core/ruler-ladder.js';
import { MAX_LENGTH, checkBoard, sameBoard, shortestGolomb, solveLength, spanOf } from '../src/core/ruler.js';
import { smallerRuler } from '../src/core/smaller.js';
import { LENGTHS_PER_ROW, PER_ROW, rowsOf } from '../src/ui/ruler-board.js';
import { bruteFewest } from './helpers/brute-ruler.js';

const SEEDS = Array.from({ length: 60 }, (_, index) => index + 1);

test('사다리: 여섯 단계이고 맨 위는 직접 만들기다. 1단계만 기록 깨기가 아니다', () => {
  assert.deepEqual(
    LADDER.map((rung) => [rung.level, rung.tag, rung.mode]),
    [
      [1, 'basic', 'first'],
      [2, 'basic', 'fewest'],
      [3, 'applied', 'long'],
      [4, 'applied', 'chain'],
      [5, 'challenge', 'golomb'],
      [6, 'challenge', 'make'],
    ],
  );
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  assert.deepEqual(['first', 'fewest', 'long', 'chain', 'golomb', 'made'].map(recordMode), [false, true, true, true, true, true]);
  assert.throws(() => generateBoard(6, 1));
  assert.throws(() => generateBoard(1, 0));
  assert.throws(() => rungOf(9));
});

test('정해 둔 첫 판: 길이 4, 길이 6(눈금 4개로 꼭 한 번씩), 길이 11, 길이 6~10(9까지는 눈금 5개, 10은 6개), 눈금 4개', () => {
  assert.deepEqual(generateBoard(1, 1).board, { kind: 'all', lengths: [4] });
  assert.deepEqual(generateBoard(2, 1).board, { kind: 'all', lengths: [6] });
  assert.deepEqual(generateBoard(3, 1).board, { kind: 'all', lengths: [11] });
  assert.deepEqual(generateBoard(4, 1).board, { kind: 'all', lengths: [6, 7, 8, 9, 10] });
  assert.deepEqual(generateBoard(5, 1).board, { kind: 'golomb', count: 4, span: 8 });
  // 4단계 첫 판의 가장 적은 눈금(다른 방법으로)
  assert.deepEqual([6, 7, 8, 9, 10].map((L) => bruteFewest(L).fewest), [4, 5, 5, 5, 6]);
  // 수준 맞추기의 작은 판은 1단계 첫 판이다
  assert.deepEqual(generateBoard(1, 7, { small: true }), { level: 1, seed: 7, small: true, board: { kind: 'all', lengths: [4] } });
  assert.equal(generateBoard(2, 7, { small: true }).small, false);
});

test('단계마다 판의 꼴과 크기: 같은 번호는 늘 같은 판이고, 다음 번호는 방금 한 판과 다르다', () => {
  for (const rung of LADDER.filter((item) => item.mode !== 'make')) {
    const lengths = new Set();
    for (const seed of SEEDS) {
      const { board } = generateBoard(rung.level, seed);
      const where = `${rung.level}단계 ${seed}번`;
      assert.equal(checkBoard(board), null, where);
      assert.deepEqual(generateBoard(rung.level, seed).board, board, where);
      if (rung.mode === 'golomb') {
        assert.equal(board.span, GOLOMB_SPAN[board.count], where);
        assert.ok([4, 5, 6].includes(board.count), where);
        assert.equal(golombRoomy(board), true, where);
        lengths.add(board.count);
      } else if (rung.mode === 'chain') {
        assert.equal(board.lengths.length, CHAIN_SIZE, where);
        assert.ok(board.lengths[0] >= 5 && board.lengths[0] <= 9, where);
        lengths.add(board.lengths[0]);
      } else {
        assert.equal(board.lengths.length, 1, where);
        const [L] = board.lengths;
        assert.ok(L >= rung.lengths[0] && L <= rung.lengths[1], where);
        lengths.add(L);
      }
      const next = nextSeed(rung.level, seed);
      assert.ok(next > seed);
      assert.equal(sameBoard(generateBoard(rung.level, next).board, board), false, where);
    }
    // 범위 안의 크기가 고루 나온다
    const want = rung.mode === 'golomb' ? 3 : rung.lengths[1] - rung.lengths[0] + 1;
    assert.equal(lengths.size, want, `${rung.level}단계`);
  }
});

test('더 작은 판: 같은 종류이고 더 작다. 같은 판, 같은 차례에는 같은 판이 나온다. 가장 작은 판에는 없다', () => {
  for (const rung of LADDER.filter((item) => item.mode !== 'make')) {
    for (const seed of SEEDS.slice(0, 30)) {
      const { board } = generateBoard(rung.level, seed);
      const origin = { mode: rung.mode, board };
      const where = `${rung.level}단계 ${seed}번`;
      for (const turn of [0, 1, 2, 3]) {
        const small = smallerRuler(origin, turn);
        if (board.kind === 'all' && board.lengths.length === 1 && board.lengths[0] === 3) {
          assert.equal(small, null, where);
          continue;
        }
        assert.ok(small, where);
        assert.equal(checkBoard(small.board), null, where);
        assert.equal(small.board.kind, board.kind, where);
        if (board.kind === 'golomb') assert.equal(small.board.count, board.count - 1, where);
        else if (board.lengths.length > 1) {
          assert.equal(small.board.lengths.length, 3, where);
          assert.ok(small.board.lengths[0] < board.lengths[0], where);
        } else {
          assert.equal(small.board.lengths.length, 1, where);
          assert.ok(small.board.lengths[0] < board.lengths[0] && small.board.lengths[0] >= 3, where);
          if (board.lengths[0] >= 11) assert.ok(small.board.lengths[0] <= 9, where);
        }
        assert.deepEqual(smallerRuler(origin, turn), small, where);
      }
    }
  }
  assert.equal(smallerRuler({ mode: 'golomb', board: { kind: 'golomb', count: 3, span: 5 } }), null);
  assert.equal(smallerRuler({ mode: 'chain', board: { kind: 'all', lengths: [3, 4, 5] } }), null);
  assert.equal(smallerRuler({ mode: 'fewest', board: null }), null);
  assert.deepEqual(smallBoards({ mode: 'long', board: { kind: 'all', lengths: [17] } }).yes.map((item) => item.lengths[0]), [9, 8, 7]);
  assert.deepEqual(smallBoards({ mode: 'chain', board: { kind: 'all', lengths: [6, 7, 8, 9, 10] } }).yes.map((item) => item.lengths), [
    [3, 4, 5],
    [4, 5, 6],
    [5, 6, 7],
  ]);
});

test('누르는 칸: 가장 긴 자(길이 20, 직접 만들기와 눈금 6개)도 한 줄에 자리 아홉까지라 한 자리가 44픽셀보다 넓다. 길이 칸도 44픽셀이다', () => {
  // 1180×820 화면의 판 칸은 가로 476픽셀쯤이다(규칙 글이 왼쪽 칸에 있다)
  const WIDTH = 476;
  assert.equal(PER_ROW, 9);
  assert.equal(LENGTHS_PER_ROW, 10);
  assert.ok((WIDTH - 24) / PER_ROW >= 44);
  assert.ok(LENGTHS_PER_ROW * 44 + (LENGTHS_PER_ROW - 1) * 4 <= WIDTH);
  assert.deepEqual(rowsOf(5), [5]);
  assert.deepEqual(rowsOf(9), [9]);
  assert.deepEqual(rowsOf(12), [6, 6]);
  assert.deepEqual(rowsOf(18), [9, 9]);
  assert.deepEqual(rowsOf(21), [7, 7, 7]);
  assert.deepEqual(rowsOf(20, 10), [10, 10]);
  assert.equal(MAKE_MAX, MAX_LENGTH);
  assert.equal(MAKE_MIN, 3);
  // 사다리와 직접 만들기의 가장 긴 자는 20이라 자는 세 줄까지다
  let longest = MAKE_MAX;
  for (const rung of LADDER.filter((item) => item.mode !== 'make')) {
    for (const seed of SEEDS) {
      const { board } = generateBoard(rung.level, seed);
      for (let at = 0; at < (board.kind === 'all' ? board.lengths.length : 1); at++) longest = Math.max(longest, spanOf(board, at));
    }
  }
  assert.equal(longest, 20);
  assert.ok(rowsOf(longest + 1).length <= 3);
  assert.ok(Math.max(...rowsOf(longest + 1)) <= PER_ROW);
  // 같은 길이를 두 번 재지 않는 자는 가장 짧은 자보다 길게 그린다(더 긴 자도 찾아볼 수 있게)
  for (const count of [3, 4, 5, 6]) assert.ok(GOLOMB_SPAN[count] > shortestGolomb(count).shortest, `${count}`);
  // 직접 만들기의 모든 길이에서 풀이 프로그램이 바로 답한다
  for (let L = MAKE_MIN; L <= MAKE_MAX; L++) assert.ok(solveLength(L).fewest >= 3);
});
