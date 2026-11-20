// 접히는 모양 가리기의 사다리 점검: 단계마다 판 번호 1~100(작은 판도)이 그 단계의 조건에 맞고 다른 방법으로 다시 풀어도 같은지,
// 안 되는 모양의 비율, 맨 처음 판들, "더 작은 판"(다섯 칸 모양, 모양 셋, 네 칸 한 줄의 맞은편, 주사위 하나 적게, 네 칸이 놓인 모눈)을 본다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SMALLER, smallerFold } from '../src/core/smaller.js';
import { CROSS, FIRST_OPPOSITE, IMPOSSIBLE_RATE, LADDER, LINE, MAKE_LEVEL, ROW_BOARD, TOP_LEVEL, generateBoard, nextSeed, rowCells, rungOf, smallBoards } from '../src/core/fold-ladder.js';
import { checkBoard, freeKey, hasRowOfFour, isCubeNet, normalize, solve } from '../src/core/fold.js';
import { dieOk, hiddenSum3d, isBox3d, isNet3d, opposite3d } from './helpers/brute-fold.js';

const SEEDS = Array.from({ length: 100 }, (_, index) => index + 1);
const sizeOf = (cells) => [Math.max(...cells.map((cell) => cell[0])) + 1, Math.max(...cells.map((cell) => cell[1])) + 1];

test('사다리: 여섯 단계, 맨 위는 직접 만들기, 단계마다 기본·응용·도전 표시', () => {
  assert.deepEqual(LADDER.map((rung) => rung.level), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(LADDER.map((rung) => rung.mode), ['fold', 'dice', 'many', 'opposite', 'all', 'make']);
  assert.deepEqual(LADDER.map((rung) => rung.tag), ['basic', 'basic', 'applied', 'applied', 'challenge', 'challenge']);
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  assert.equal(IMPOSSIBLE_RATE, 1 / 3);
  assert.throws(() => generateBoard(6, 1));
  assert.throws(() => rungOf(9));
});

test('모양 하나: 모든 판이 회전 행렬로 접어 본 것과 같은 답이다. 안 되는 모양이 셋에 하나쯤 섞이고, 작은 판은 다섯 칸이다', () => {
  for (const small of [false, true]) {
    let impossible = 0;
    const shapes = new Set();
    for (const seed of SEEDS) {
      const { board, solution } = generateBoard(1, seed, { small });
      const where = `1단계 ${seed}번${small ? ' 작은 판' : ''}`;
      assert.equal(checkBoard(board), null, where);
      assert.deepEqual(generateBoard(1, seed, { small }).board, board, `${where}: 같은 번호는 같은 판`);
      assert.equal(board.cells.length, small ? 5 : 6, where);
      assert.equal(solution.possible, small ? isBox3d(board.cells) : isNet3d(board.cells), where);
      const [w, h] = sizeOf(board.cells);
      assert.ok(w >= h, `${where}: 가로로 눕혀 놓는다`);
      assert.deepEqual(normalize(board.cells), board.cells);
      if (seed > 2 && !solution.possible) impossible += 1;
      shapes.add(freeKey(board.cells));
    }
    assert.ok(impossible >= 20 && impossible <= 45, `안 되는 판 ${impossible}개`);
    assert.ok(shapes.size >= (small ? 10 : 25), `모양 ${shapes.size}가지`);
  }
  // 첫 판은 십자 모양(된다), 둘째 판은 여섯 칸 한 줄(아주 쉬운 안 되는 판)
  assert.deepEqual(generateBoard(1, 1).board.cells, normalize(CROSS));
  assert.equal(generateBoard(1, 1).solution.possible, true);
  assert.deepEqual(generateBoard(1, 2).board.cells, normalize(LINE));
  assert.equal(generateBoard(1, 2).solution.possible, false);
});

test('주사위: 두세 개(작은 판은 한두 개)이고, 모두 맞는 주사위다. 안 보이는 면의 합은 면의 방향으로 센 것과 같다', () => {
  for (const small of [false, true]) {
    const counts = new Set();
    for (const seed of SEEDS) {
      const { board, solution } = generateBoard(2, seed, { small });
      const where = `2단계 ${seed}번${small ? ' 작은 판' : ''}`;
      assert.equal(checkBoard(board), null, where);
      const [low, high] = small ? rungOf(2).small : rungOf(2).counts;
      assert.ok(board.dice.length >= low && board.dice.length <= high, where);
      for (const die of board.dice) assert.ok(dieOk(die), where);
      assert.equal(solution.sum, hiddenSum3d(board.dice).sum, where);
      counts.add(board.dice.length);
    }
    assert.equal(counts.size, 2);
  }
});

test('여럿 고르기: 모양 여섯(작은 판은 셋)이 모두 다르고, 되는 모양이 둘에서 넷(작은 판은 하나나 둘)이다', () => {
  for (const small of [false, true]) {
    const nets = new Set();
    for (const seed of SEEDS) {
      const { board, solution } = generateBoard(3, seed, { small });
      const where = `3단계 ${seed}번${small ? ' 작은 판' : ''}`;
      assert.equal(checkBoard(board), null, where);
      assert.equal(board.shapes.length, small ? 3 : 6, where);
      assert.equal(new Set(board.shapes.map(freeKey)).size, board.shapes.length, where);
      assert.deepEqual(solution.nets, board.shapes.map(isNet3d), where);
      const [low, high] = small ? [1, 2] : [2, 4];
      assert.ok(solution.count >= low && solution.count <= high, `${where}: 되는 모양 ${solution.count}`);
      for (const cells of board.shapes) {
        const [w, h] = sizeOf(cells);
        assert.ok(w >= h, where);
      }
      nets.add(solution.count);
    }
    assert.equal(nets.size, small ? 2 : 3);
  }
});

test('접고 나면 어디로: 모든 판의 맞은편 칸이 회전 행렬로 접어 본 것과 같다. 첫 판은 십자 모양, 작은 판은 네 칸 한 줄의 칸을 표시한다', () => {
  for (const small of [false, true]) {
    for (const seed of SEEDS) {
      const { board, solution } = generateBoard(4, seed, { small });
      const where = `4단계 ${seed}번${small ? ' 작은 판' : ''}`;
      assert.equal(checkBoard(board), null, where);
      assert.equal(solution.answer, opposite3d(board.cells, board.mark), where);
      if (small) assert.ok(rowCells(board.cells).includes(board.mark), where);
    }
  }
  assert.deepEqual(generateBoard(4, 1).board, FIRST_OPPOSITE);
  // 첫 판: 표시한 칸(줄의 왼쪽 끝)의 맞은편은 하나 건너 오른쪽 칸
  const first = solve(FIRST_OPPOSITE);
  assert.deepEqual(FIRST_OPPOSITE.cells[FIRST_OPPOSITE.mark], [0, 1]);
  assert.deepEqual(FIRST_OPPOSITE.cells[first.answer], [2, 1]);
  assert.equal(FIRST_OPPOSITE.pictures[FIRST_OPPOSITE.mark], 'circle');
});

test('모두 찾기: 6×5 모눈(작은 판은 네 칸이 놓인 4×3 모눈)은 번호와 상관없이 같다', () => {
  for (const seed of [1, 2, 50]) {
    assert.deepEqual(generateBoard(5, seed).board, { kind: 'all', w: 6, h: 5, fixed: [] });
    assert.deepEqual(generateBoard(5, seed, { small: true }).board, ROW_BOARD);
  }
  assert.equal(generateBoard(5, 1).solution.total, 11);
  assert.equal(generateBoard(5, 1, { small: true }).solution.total, 6);
});

test('다음 판 번호는 방금 한 판과 다른 판을 낸다(모두 찾기는 늘 같은 모눈이라 그다음 번호다)', () => {
  for (const rung of LADDER.filter((item) => item.mode !== 'make' && item.mode !== 'all')) {
    for (const seed of [1, 2, 3, 10]) {
      const next = nextSeed(rung.level, seed);
      assert.ok(next > seed);
      assert.notDeepEqual(generateBoard(rung.level, next).board, generateBoard(rung.level, seed).board);
    }
  }
  assert.equal(nextSeed(5, 4), 5);
});

test('더 작은 판: 다섯 칸 모양, 모양 셋, 네 칸 한 줄의 맞은편, 주사위 하나 적게, 네 칸이 놓인 모눈. 안 되는 모양에서는 되는 모양부터 번갈아', () => {
  assert.equal(SMALLER.fold, smallerFold);
  for (const rung of LADDER.filter((item) => item.mode !== 'make')) {
    for (const seed of SEEDS.slice(0, 30)) {
      const { board, solution } = generateBoard(rung.level, seed);
      const origin = { mode: board.kind, board };
      const lists = smallBoards(origin);
      const where = `${rung.level}단계 ${seed}번`;
      for (const [kind, list] of Object.entries(lists)) {
        for (const small of list) {
          assert.equal(checkBoard(small), null, where);
          assert.equal(small.kind, board.kind, where);
          assert.equal(solve(small).possible, kind === 'yes', `${where} ${kind}`);
          if (board.kind === 'fold') assert.equal(small.cells.length, 5, where);
          if (board.kind === 'many') assert.equal(small.shapes.length, 3, where);
          if (board.kind === 'opposite') assert.ok(hasRowOfFour(small.cells) && rowCells(small.cells).includes(small.mark), where);
          if (board.kind === 'dice') assert.equal(small.dice.length, board.dice.length - 1, where);
          if (board.kind === 'all') assert.deepEqual(small, ROW_BOARD);
        }
      }
      if (board.kind !== 'fold') assert.equal(lists.no.length, 0, where);
      const turns = [0, 1, 2, 3].map((turn) => smallerFold(origin, turn));
      if (board.kind === 'dice' && board.dice.length === 1) continue;
      if (board.kind === 'opposite' && rowCells(board.cells).includes(board.mark)) {
        assert.equal(turns[0], null, where);
        continue;
      }
      assert.ok(turns[0], where);
      assert.equal(solve(turns[0].board).possible, true, where);
      if (board.kind === 'fold' && !solution.possible) assert.equal(solve(turns[1].board).possible, false, `${where}: 번갈아`);
      assert.deepEqual(smallerFold(origin, 2), turns[2], `${where}: 같은 판, 같은 차례에는 같은 작은 판`);
    }
  }
  // 이미 가장 작은 판에는 더 작은 판이 없다
  assert.equal(smallerFold({ mode: 'fold', board: { kind: 'fold', cells: [[0, 0], [1, 0], [2, 0], [3, 0], [1, 1]] } }), null);
  assert.equal(smallerFold({ mode: 'dice', board: { kind: 'dice', dice: [[6, 1, 5, 2, 3, 4]] } }), null);
  assert.equal(smallerFold({ mode: 'all', board: ROW_BOARD }), null);
  assert.equal(smallerFold({ mode: 'fold', board: null }), null);
  assert.ok(isCubeNet(CROSS));
});
