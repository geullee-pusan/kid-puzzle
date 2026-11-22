// 성냥개비의 사다리 점검: 단계마다 판이 잣대에 맞는지, 할 일대로 되는 방법의 수를 다른 방법(다음 고르기, 부분 집합)으로 다시 센다.
// 1단계에 섞이는 안 되는 판(성냥 하나만 빼는 판)은 변의 모든 부분 집합을 만들어 보아 답이 없음을, 성냥을 하나씩 빼서 글자로 센 수로 까닭을 다시 본다.
// 더 작은 판도 여기서 본다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, goodBoard, goodImpossible, impossibleAt, nextSeed, rungOf, smallBoards } from '../src/core/matches-ladder.js';
import { checkBoard, countSquares, fullGrid, isDone, looseMatches, oneOutCounts, sameBoard, solve } from '../src/core/matches.js';
import { smallerMatches } from '../src/core/smaller.js';
import { bruteLoose, bruteSquares, comboCount, edgeName, subsetCount } from './helpers/brute-matches.js';

const SEEDS = Array.from({ length: 30 }, (_, index) => index + 1);
/** 다른 방법으로 센 답의 수(작은 모눈은 부분 집합, 3×3은 다음 고르기) */
const otherCount = (board) => (board.w * board.h <= 6 ? subsetCount(board) : comboCount(board).count);

test('사다리: 여섯 단계, 맨 위는 직접 만들기. 기본·기본·응용·응용·도전·도전', () => {
  assert.deepEqual(
    LADDER.map((rung) => [rung.level, rung.tag, rung.mode]),
    [
      [1, 'basic', 'little'],
      [2, 'basic', 'grid'],
      [3, 'applied', 'shift'],
      [4, 'applied', 'tidy'],
      [5, 'challenge', 'move'],
      [6, 'challenge', 'make'],
    ],
  );
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  assert.throws(() => generateBoard(6, 1));
  assert.throws(() => generateBoard(1, 0));
  assert.throws(() => rungOf(9));
});

test('1단계 1번 판(작은 판도 같다): 2×2 모눈을 다 채운 판에서 하나를 빼서 정사각형 3개. 어느 성냥을 빼도 된다', () => {
  for (const options of [{}, { small: true }]) {
    const { board } = generateBoard(1, 1, options);
    assert.deepEqual(board, { w: 2, h: 2, matches: fullGrid(2, 2), kind: 'remove', k: 1, n: 3, tidy: false });
  }
  const { board } = generateBoard(1, 1);
  assert.equal(bruteSquares(2, 2, board.matches).length, 5);
  for (const edge of board.matches) assert.equal(bruteSquares(2, 2, board.matches.filter((item) => item !== edge)).length, 3);
  assert.equal(solve(board).count, 12);
  assert.equal(generateBoard(1, 7, { small: true }).small, true);
  assert.equal(generateBoard(2, 7, { small: true }).small, false);
});

test('단계마다 판 1~30번: 모눈과 할 일이 단계와 같고, 할 일대로 되는 방법이 1~12가지이고(다른 방법으로 다시 센다), 빼기 판은 정사각형 수를 바꾸는 판이다', () => {
  const spec = {
    1: { kind: 'remove', tidy: false, sizes: ['2x2', '3x2'], ks: [1, 2] },
    2: { kind: 'remove', tidy: false, sizes: ['3x3'], ks: [2, 3, 4] },
    3: { kind: 'move', tidy: false, sizes: ['3x2', '3x3'], ks: [1, 2] },
    4: { kind: 'remove', tidy: true, sizes: ['3x3'], ks: [3, 4] },
    5: { kind: 'move', tidy: true, sizes: ['3x3'], ks: [2, 3] },
  };
  for (let level = 1; level <= TOP_LEVEL; level++) {
    const want = spec[level];
    const seen = new Set();
    for (const seed of SEEDS) {
      // 1단계의 안 되는 판은 아래 테스트에서 본다
      if (impossibleAt(rungOf(level), seed)) continue;
      const { board } = generateBoard(level, seed);
      const label = `${level}단계 ${seed}번`;
      assert.equal(checkBoard(board), null, label);
      assert.equal(board.kind, want.kind, label);
      assert.equal(board.tidy, want.tidy, label);
      // 옮기기 판은 그 단계의 모눈 그대로, 빼기 판은 성냥을 둘러싼 모눈으로 줄여서 그 단계의 모눈 안에 든다
      const inside = want.sizes.some((size) => {
        const [w, h] = size.split('x').map(Number);
        return board.kind === 'move' ? board.w === w && board.h === h : board.w <= w && board.h <= h;
      });
      assert.ok(inside, label);
      if (board.kind === 'remove') {
        // 줄인 모눈의 네 가장자리에 모두 성냥이 닿는다
        const names = board.matches.map((edge) => edgeName(board.w, board.h, edge));
        assert.ok(names.some((name) => name.startsWith('가로') && name.endsWith(',0')), label);
        assert.ok(names.some((name) => name.startsWith('가로') && name.endsWith(`,${board.h}`)), label);
        assert.ok(names.some((name) => name.startsWith('세로 0,')), label);
        assert.ok(names.some((name) => name.startsWith(`세로 ${board.w},`)), label);
      }
      assert.ok(want.ks.includes(board.k), label);
      // 처음 모습은 칸들의 테두리라 모든 성냥이 어느 정사각형의 변이다
      assert.equal(bruteLoose(board.w, board.h, board.matches), 0, label);
      const now = bruteSquares(board.w, board.h, board.matches).length;
      assert.ok(board.n >= 1 && (board.kind === 'move' || board.n !== now), label);
      const result = solve(board);
      if (!(level === 1 && seed === 1)) assert.ok(result.count >= 1 && result.count <= 12, `${label}: ${result.count}`);
      if (seed <= 12 || board.kind === 'remove') assert.equal(result.count, otherCount(board), label);
      for (const example of result.examples) assert.equal(isDone(board, example.matches), true, label);
      if (seed > 1) assert.equal(goodBoard(rungOf(level).spec, board), true, label);
      seen.add(JSON.stringify(board));
    }
    // 같은 판만 되풀이하지 않는다
    // 1단계는 서른 판 가운데 열 판이 안 되는 판이다
    assert.ok(seen.size >= (level === 1 ? 12 : 15), `${level}단계: ${seen.size}`);
  }
});

/** 성냥을 하나씩 빼서 글자로 센 남는 정사각형 수의 가짓수(작은 것부터) */
const bruteOneOut = (board) => [...new Set(board.matches.map((edge) => bruteSquares(board.w, board.h, board.matches.filter((item) => item !== edge)).length))].sort((a, b) => a - b);

test('안 되는 판은 1단계에만 여섯 판에 둘(2번, 5번, 8번, …)이고 연달아 나오지 않는다. 2~5단계에는 없다', () => {
  assert.deepEqual(LADDER.filter((rung) => rung.impossible).map((rung) => rung.level), [1]);
  const places = Array.from({ length: 60 }, (_, index) => index + 1).filter((seed) => impossibleAt(rungOf(1), seed));
  assert.deepEqual(places.slice(0, 6), [2, 5, 8, 11, 14, 17]);
  assert.equal(places.length, 20);
  for (let index = 1; index < places.length; index++) assert.ok(places[index] - places[index - 1] >= 2);
  for (let seed = 1; seed <= 60; seed++) assert.equal(solve(generateBoard(1, seed).board).possible, !places.includes(seed), `1단계 ${seed}번`);
  for (let level = 2; level <= TOP_LEVEL; level++) for (const seed of SEEDS) assert.equal(impossibleAt(rungOf(level), seed), false);
});

test('첫 안 되는 판(1단계 2번): 2×2를 다 채운 판에서 하나를 빼서 4개. 성냥 12개 어느 것을 빼도 3개가 남는다', () => {
  const { board } = generateBoard(1, 2);
  assert.deepEqual(board, { w: 2, h: 2, matches: fullGrid(2, 2), kind: 'remove', k: 1, n: 4, tidy: false });
  assert.deepEqual(bruteOneOut(board), [3]);
  assert.equal(subsetCount(board), 0);
});

test('1단계의 안 되는 판 1~300번: 성냥 하나만 빼는 판이고, 변의 모든 부분 집합으로도 답이 없다. 하나를 빼서 남는 수는 한두 가지이고 묻는 수는 그 사이나 바로 아래다', () => {
  const seen = new Map();
  for (let seed = 1; seed <= 300; seed++) {
    if (!impossibleAt(rungOf(1), seed)) continue;
    const { board } = generateBoard(1, seed);
    const label = `1단계 ${seed}번`;
    assert.equal(checkBoard(board), null, label);
    assert.equal(goodImpossible(rungOf(1), board), true, label);
    assert.deepEqual([board.kind, board.k, board.tidy], ['remove', 1, false], label);
    assert.ok(board.w <= 3 && board.h <= 2, label);
    assert.equal(bruteLoose(board.w, board.h, board.matches), 0, label);
    // 경우는 성냥의 수만큼(12~17가지)이다
    assert.ok(board.matches.length >= 12 && board.matches.length <= 17, label);
    const counts = bruteOneOut(board);
    assert.deepEqual(oneOutCounts(board.w, board.h, board.matches), counts, label);
    assert.ok(counts.length <= 2, label);
    assert.equal(counts.includes(board.n), false, label);
    const now = bruteSquares(board.w, board.h, board.matches).length;
    assert.ok(board.n >= Math.max(1, counts[0] - 1) && board.n < now, label);
    assert.equal(subsetCount(board), 0, label);
    assert.equal(solve(board).count, 0, label);
    const key = `${board.w}x${board.h}:${board.matches.length}:${board.n}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  // 풀이 프로그램이 알려 준 것: 안 되는 판은 2×2를 다 채운 판(2개나 4개), 3×2를 다 채운 판(4개나 7개), 칸 넷의 3×2 모양(1개), 칸 다섯의 3×2 모양(2개)이다
  assert.deepEqual([...seen.keys()].sort(), ['2x2:12:2', '2x2:12:4', '3x2:13:1', '3x2:16:2', '3x2:17:4', '3x2:17:7']);
});

test('같은 번호는 늘 같은 판이고, 다음 판 번호는 방금 한 판과 다른 판이다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of [1, 2, 3, 9]) {
      assert.deepEqual(generateBoard(level, seed).board, generateBoard(level, seed).board);
      const next = nextSeed(level, seed);
      assert.ok(next > seed);
      assert.equal(sameBoard(generateBoard(level, next).board, generateBoard(level, seed).board), false);
    }
  }
});

test('더 작은 판: 같은 할 일(빼기·옮기기, 약속)의 더 작은 모눈이고, 빼거나 옮길 수가 원래 판보다 많지 않고, 할 일대로 되는 판이다. 2×2 판에는 없다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of [1, 2, 3, 4, 5, 6, 8]) {
      const { board } = generateBoard(level, seed);
      const { yes, no } = smallBoards({ mode: rungOf(level).mode, board });
      // 안 되는 판의 작은 판도 할 일대로 되는 판이다(작은 판에는 안 되는 판이 없다)
      assert.deepEqual(no, []);
      if (board.w * board.h <= 4) {
        assert.equal(yes.length, 0);
        assert.equal(smallerMatches({ mode: rungOf(level).mode, board }), null);
        continue;
      }
      assert.ok(yes.length >= 1, `${level}단계 ${seed}번`);
      for (const small of yes) {
        assert.equal(checkBoard(small), null);
        assert.ok(small.w * small.h < board.w * board.h);
        assert.equal(small.kind, board.kind);
        assert.equal(small.tidy, board.tidy);
        assert.ok(small.k <= board.k);
        assert.equal(looseMatches(small.w, small.h, small.matches).length, 0);
        if (small.kind === 'remove') assert.notEqual(small.n, countSquares(small.w, small.h, small.matches));
        const count = subsetCount(small);
        assert.ok(count >= 1 && count <= 12, `${level}단계 ${seed}번: ${count}`);
      }
      const first = smallerMatches({ mode: rungOf(level).mode, board }, 0);
      assert.deepEqual(first.board, yes[0]);
    }
  }
});
