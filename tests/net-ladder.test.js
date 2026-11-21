// 그물 끊기의 사다리와 판 내기, 더 작은 판: 단계마다 매듭 수와 끊을 수 있는 줄의 수, 두 그물과 두 조각의 차례, 작은 판이 같은 꼴인지 본다.
// 끊을 수 있는 줄의 수는 다른 방법(tests/helpers/brute-net.js의 조각 세기)으로 다시 따진다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf, sameAt, smallBoards, twoAt, untangled } from '../src/core/net-ladder.js';
import { checkBoard, maxCut, netsOf, sameBoard } from '../src/core/net.js';
import { smallerNet } from '../src/core/smaller.js';
import { countPieces } from './helpers/brute-net.js';

const SEEDS = Array.from({ length: 60 }, (_, index) => index + 1);
/** 끊을 수 있는 줄의 수를 조각 세기로: (줄 수) - (매듭 수) + (조각 수) */
const cuttable = (board) => board.strings.length - board.knots.length + countPieces(board);

test('사다리: 여섯 단계, 표시는 기본·기본·응용·응용·도전·도전, 맨 위는 직접 만들기', () => {
  assert.deepEqual(LADDER.map((rung) => rung.level), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(LADDER.map((rung) => rung.tag), ['basic', 'basic', 'applied', 'applied', 'challenge', 'challenge']);
  assert.deepEqual(LADDER.map((rung) => rung.mode), ['cut', 'guess', 'twins', 'predict', 'pieces', 'make']);
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  assert.throws(() => generateBoard(6, 1));
  assert.throws(() => generateBoard(1, 0));
  assert.throws(() => rungOf(9));
});

test('첫 판: 집(2줄), 3×2 모눈(2줄), 물고기와 3×2 모눈(2줄씩), 4×4 고기 그물(9줄), 테두리와 떨어진 섬(2줄)', () => {
  const firsts = [1, 2, 3, 4, 5].map((level) => generateBoard(level, 1).board);
  assert.deepEqual(firsts.map((board) => board.family), ['house', 'grid', 'twins', 'grid', 'island']);
  assert.deepEqual(firsts.map((board) => [board.knots.length, board.strings.length, cuttable(board)]), [[5, 6, 2], [6, 7, 2], [12, 14, 4], [16, 24, 9], [16, 16, 2]]);
  assert.deepEqual(netsOf(firsts[2]).map((net) => net.max), [2, 2]);
  assert.equal(countPieces(firsts[4]), 2);
  // 수준 맞추기의 작은 판은 1단계의 첫 판이다
  assert.deepEqual(generateBoard(1, 7, { small: true }).board, firsts[0]);
  assert.equal(generateBoard(1, 7, { small: true }).small, true);
  assert.equal(generateBoard(2, 7, { small: true }).small, false);
});

test('판 번호 1~60: 같은 번호는 같은 판이고 규격에 맞다. 엇갈리는 줄이 없고 끊을 줄이 있다. 단계마다 매듭 수와 끊을 수 있는 줄의 수', () => {
  const RANGE = { cut: [5, 8, 1, 6], guess: [6, 9, 2, 7], twins: [10, 16, 2, 10], predict: [8, 16, 3, 9], pieces: [16, 25, 2, 6] };
  for (let level = 1; level <= TOP_LEVEL; level++) {
    const { mode } = rungOf(level);
    const [fewest, most, low, high] = RANGE[mode];
    const families = new Set();
    for (const seed of SEEDS) {
      const { board } = generateBoard(level, seed);
      const where = `${level}단계 ${seed}번`;
      assert.equal(checkBoard(board), null, where);
      assert.deepEqual(generateBoard(level, seed).board, board, where);
      assert.ok(untangled(board), where);
      assert.ok(board.knots.length >= fewest && board.knots.length <= most, `${where}: 매듭 ${board.knots.length}개`);
      assert.equal(maxCut(board), cuttable(board), where);
      assert.ok(cuttable(board) >= low && cuttable(board) <= high, `${where}: ${cuttable(board)}줄`);
      families.add(board.family);
      if (mode === 'twins') {
        // 두 그물은 매듭 수가 같다. 판 번호가 3의 배수면 줄 수가 다르고, 아니면 같다. 그물마다 끊을 줄이 있다
        const nets = netsOf(board);
        assert.equal(nets.length, 2, where);
        assert.equal(nets[0].knots, nets[1].knots, where);
        assert.equal(nets[0].strings === nets[1].strings, sameAt(seed), where);
        assert.ok(nets.every((net) => net.max >= 1), where);
      } else if (mode === 'pieces') {
        assert.equal(countPieces(board), twoAt(seed) ? 2 : 1, where);
      } else {
        assert.equal(countPieces(board), 1, where);
      }
    }
    // 그물의 종류가 여러 가지로 나온다(두 그물과 두 조각 그물은 한 종류의 이름이다)
    if (mode !== 'twins' && mode !== 'pieces') assert.ok(families.size >= 3, `${level}단계: ${[...families]}`);
  }
});

test('다음 판 번호는 방금 한 판과 같은 판을 건너뛴다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of SEEDS.slice(0, 20)) {
      const next = nextSeed(level, seed);
      assert.ok(next > seed);
      assert.ok(!sameBoard(generateBoard(level, next).board, generateBoard(level, seed).board), `${level}단계 ${seed}번`);
    }
  }
  assert.equal(nextSeed(MAKE_LEVEL, 3), 4);
});

test('더 작은 판: 매듭이 더 적고 끊을 줄이 있다. 두 그물은 매듭과 줄이 같은 작은 두 그물, 두 조각 그물은 조각 수가 같은 판', () => {
  const check = (board, mode, where) => {
    const list = smallBoards({ mode, board });
    assert.ok(list.length <= 2, where);
    for (const small of list) {
      assert.equal(checkBoard(small), null, where);
      assert.ok(untangled(small), where);
      assert.ok(small.knots.length < board.knots.length, where);
      assert.ok(cuttable(small) >= 1, where);
      if (mode === 'twins') {
        const nets = netsOf(small);
        assert.equal(nets.length, 2, where);
        assert.deepEqual([nets[0].knots, nets[0].strings], [nets[1].knots, nets[1].strings], where);
        assert.ok(nets[0].knots < Math.min(...netsOf(board).map((net) => net.knots)), where);
      } else {
        assert.equal(countPieces(small), countPieces(board), where);
      }
    }
    // 같은 판에는 같은 작은 판
    assert.deepEqual(smallBoards({ mode, board }), list, where);
    for (const turn of [0, 1, 2]) assert.deepEqual(smallerNet({ mode, board }, turn), list.length > 0 ? { board: list[turn % list.length] } : null, where);
    return list;
  };
  for (let level = 1; level <= TOP_LEVEL; level++) {
    const { mode } = rungOf(level);
    for (const seed of SEEDS) {
      const { board } = generateBoard(level, seed);
      const list = check(board, mode, `${level}단계 ${seed}번`);
      // 매듭이 다섯보다 많은 그물에는 늘 작은 판이 있다(두 그물은 그물마다 매듭이 다섯보다 많을 때)
      const per = mode === 'twins' ? Math.min(...netsOf(board).map((net) => net.knots)) : board.knots.length;
      if (per > 5) assert.ok(list.length >= 1, `${level}단계 ${seed}번`);
    }
  }
  // 같은 종류의 그림이 먼저다: 4×4 고기 그물 → 4×3, 3×3 모눈. 바퀴 8 → 바퀴 7, 6
  assert.deepEqual(smallBoards({ mode: 'predict', board: generateBoard(4, 1).board }).map((board) => [board.family, board.knots.length]), [['grid', 12], ['grid', 9]]);
  // 첫 판(집)의 작은 판은 네모 하나뿐이다
  assert.deepEqual(smallBoards({ mode: 'cut', board: generateBoard(1, 1).board }).map((board) => board.knots.length), [4]);
  // 직접 만든 두 조각 그물에는 두 조각인 작은 판
  assert.equal(countPieces(smallBoards({ mode: 'made', board: generateBoard(5, 1).board })[0]), 2);
  assert.equal(smallerNet({ mode: 'cut', board: null }), null);
});
