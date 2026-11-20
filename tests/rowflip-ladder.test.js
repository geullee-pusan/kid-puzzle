// 줄 뒤집기 판의 사다리와 판 내기, 더 작은 판: 단계마다 판의 크기, 되는 판과 안 되는 판의 차례, 안 되는 판의 까닭을 아이가 볼 수 있는지 본다.
// 되는지와 가장 적은 횟수는 모든 줄 묶음을 해 보는 다른 방법(tests/helpers/brute-rowflip.js)으로 다시 따진다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LADDER, MAKE_LEVEL, TOP_LEVEL, cropOf, generateBoard, impossibleAt, nextSeed, rungOf, smallBoards } from '../src/core/rowflip-ladder.js';
import { boardCorners, boardKey, checkBoard, cornerBlack, isWhite, oddBlocks, solve } from '../src/core/rowflip.js';
import { smallerRowflip } from '../src/core/smaller.js';
import { bruteLines, oddRects } from './helpers/brute-rowflip.js';

const SEEDS = Array.from({ length: 60 }, (_, index) => index + 1);
const brute = (board) => bruteLines(board.w, board.h, board.cells);
const cornersOdd = (board) => cornerBlack(board.w, board.cells, boardCorners(board)) % 2 === 1;

test('사다리: 여섯 단계, 표시는 기본·기본·응용·응용·도전·도전, 맨 위는 직접 만들기', () => {
  assert.deepEqual(LADDER.map((rung) => rung.level), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(LADDER.map((rung) => rung.tag), ['basic', 'basic', 'applied', 'applied', 'challenge', 'challenge']);
  assert.deepEqual(LADDER.map((rung) => rung.mode), ['small', 'grid', 'corner', 'corners', 'block', 'make']);
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  assert.throws(() => generateBoard(6, 1));
  assert.throws(() => generateBoard(1, 0));
  assert.throws(() => rungOf(9));
});

test('판 번호 1~60: 같은 번호는 같은 판, 규격에 맞고, 이미 다 흰 판이 없다. 되는지와 가장 적은 횟수는 모든 줄 묶음을 해 본 것과 같다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    const rung = rungOf(level);
    for (const seed of SEEDS) {
      const { board } = generateBoard(level, seed);
      const where = `${level}단계 ${seed}번`;
      assert.equal(checkBoard(board), null, where);
      assert.deepEqual(generateBoard(level, seed).board, board, where);
      assert.ok(!isWhite(board.cells), where);
      assert.ok(rung.sizes.some(([w, h]) => w === board.w && h === board.h), where);
      const found = solve(board);
      const tried = brute(board);
      assert.equal(found.possible, tried.possible, where);
      assert.equal(found.possible, !impossibleAt(rung, seed), where);
      if (!found.possible) continue;
      assert.equal(found.min, tried.min, where);
      // 2×2 판은 한두 번, 나머지는 단계의 범위(2×3 판은 두 번)
      const [low, high] = board.w * board.h === 4 ? [1, 2] : [Math.max(2, rung.min[0]), rung.min[1]];
      assert.ok(found.min >= low && found.min <= high, `${where}: ${found.min}번`);
    }
  }
});

test('안 되는 판은 여섯 판에 둘이고 연달아 나오지 않는다. 처음 만나는 판은 되는 판이다. 2단계에는 안 되는 판이 없다', () => {
  for (const rung of LADDER.filter((item) => item.mode !== 'make')) {
    const pattern = SEEDS.map((seed) => !solve(generateBoard(rung.level, seed).board).possible);
    if (rung.mode === 'grid') {
      assert.ok(pattern.every((no) => !no));
      continue;
    }
    assert.equal(pattern[0], false);
    for (let at = 0; at < 60; at += 6) assert.equal(pattern.slice(at, at + 6).filter(Boolean).length, 2);
    for (let at = 1; at < 60; at++) assert.ok(!(pattern[at] && pattern[at - 1]), `${rung.level}단계 ${at + 1}번`);
  }
});

test('안 되는 판의 까닭은 아이가 볼 수 있다: 1단계는 2×2 판의 검은 칸 수, 3·4단계는 판의 네 모서리, 5단계는 네 모서리가 짝수이고 2×2 한 덩이가 홀수', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of SEEDS) {
      const { board } = generateBoard(level, seed);
      if (solve(board).possible) continue;
      const where = `${level}단계 ${seed}번`;
      const odd = oddRects(board.w, board.h, board.cells);
      assert.ok(odd.length > 0, where);
      if (level === 1) {
        assert.deepEqual([board.w, board.h], [2, 2], where);
        assert.equal(board.cells.filter(Boolean).length % 2, 1, where);
      }
      if (level === 3 || level === 4) {
        assert.ok(cornersOdd(board), where);
        assert.equal(solve(board).witness.kind, 'corners', where);
      }
      if (level === 5) {
        assert.ok(!cornersOdd(board), where);
        assert.ok(oddBlocks(board).length > 0, where);
        assert.equal(solve(board).witness.kind, 'block', where);
      }
    }
  }
});

test('첫 판들: 1단계 1번은 윗줄 하나를 뒤집으면 끝나는 2×2 판, 2번은 검은 칸 하나인 2×2 판, 3단계 2번은 모서리 한 칸만 검은 3×3 판. 작은 판도 1번 판이다', () => {
  assert.deepEqual(generateBoard(1, 1).board, { w: 2, h: 2, cells: [1, 1, 0, 0] });
  assert.equal(solve(generateBoard(1, 1).board).min, 1);
  assert.deepEqual(generateBoard(1, 2).board, { w: 2, h: 2, cells: [1, 0, 0, 0] });
  const corner = generateBoard(3, 2).board;
  assert.deepEqual([corner.w, corner.h], [3, 3]);
  assert.equal(corner.cells.filter(Boolean).length, 1);
  assert.ok([0, 2, 6, 8].includes(corner.cells.indexOf(1)));
  assert.deepEqual(generateBoard(1, 9, { small: true }), { level: 1, seed: 9, small: true, board: { w: 2, h: 2, cells: [1, 1, 0, 0] } });
  assert.equal(generateBoard(2, 9, { small: true }).small, false);
});

test('다음 판 번호는 방금 한 판과 다른 판이 나오는 번호다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of SEEDS.slice(0, 30)) {
      const next = nextSeed(level, seed);
      assert.ok(next > seed);
      assert.notEqual(boardKey(generateBoard(level, next).board), boardKey(generateBoard(level, seed).board), `${level}단계 ${seed}번`);
    }
  }
  assert.equal(nextSeed(MAKE_LEVEL, 4), 5);
});

test('"더 작은 판으로": 원래 판의 한 구석을 잘라 낸 판. 되는 판에서는 되는 판만, 안 되는 판에서는 되는 판부터 홀수인 2×2 덩이를 잘라 낸 판과 번갈아 낸다', () => {
  let crops = 0;
  let made = 0;
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of SEEDS.slice(0, 30)) {
      const { board } = generateBoard(level, seed);
      const where = `${level}단계 ${seed}번`;
      const origin = { mode: rungOf(level).mode, board };
      const possible = solve(board).possible;
      if (board.w === 2 && board.h === 2) {
        assert.equal(smallerRowflip(origin, 0), null, where);
        continue;
      }
      const lists = smallBoards(origin);
      for (const small of lists.yes) {
        assert.equal(checkBoard(small), null, where);
        assert.ok(small.w * small.h < board.w * board.h, where);
        assert.ok(!isWhite(small.cells), where);
        assert.ok(brute(small).possible, where);
        // 원래 판의 네 구석 가운데 하나를 잘라 낸 판이면 센다
        const corners = [0, board.h - small.h].flatMap((r) => [0, board.w - small.w].map((c) => boardKey(cropOf(board, r, c, small.w, small.h))));
        if (corners.includes(boardKey(small))) crops += 1;
        else made += 1;
      }
      for (const small of lists.no) {
        assert.deepEqual([small.w, small.h], [2, 2], where);
        assert.equal(small.cells.filter(Boolean).length % 2, 1, where);
        assert.ok(!brute(small).possible, where);
      }
      if (possible) assert.equal(lists.no.length, 0, where);
      else assert.ok(lists.no.length > 0, where);
      for (const turn of [0, 1, 2, 3]) {
        const small = smallerRowflip(origin, turn);
        assert.ok(small, where);
        assert.deepEqual(smallerRowflip(origin, turn), small, `${where}: 같은 판에서는 같은 작은 판`);
        assert.equal(solve(small.board).possible, possible || turn % 2 === 0, `${where} ${turn}번째`);
      }
    }
  }
  // 거의 모두 원래 판의 한 구석이다
  assert.ok(crops > made * 4, `${crops} ${made}`);
  assert.equal(smallerRowflip({ board: null }), null);
  assert.equal(smallerRowflip({ board: { w: 2, h: 2, cells: [1, 0, 0, 0] } }), null);
});
