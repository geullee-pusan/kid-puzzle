// 성냥개비 풀이 프로그램 점검: 정사각형 세기, 변이 아닌 성냥, 할 일에 맞는지, 모든 방법을 해 보는 풀이를 다른 방법으로 다시 센다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MAX_K,
  changedCount,
  checkBoard,
  choose,
  countSquares,
  cropEdges,
  edgeCount,
  edgeEnds,
  edgesFit,
  fullGrid,
  isDone,
  looseMatches,
  oneOutCases,
  oneOutCounts,
  sizeCounts,
  solve,
  squaresIn,
  squaresOf,
  tally,
  triedOneOut,
  waysOf,
} from '../src/core/matches.js';
import { createRng, randInt } from '../src/core/rng.js';
import { allEdges, bruteLoose, bruteSquares, comboCount, edgeName, subsetCount } from './helpers/brute-matches.js';

const SIZES = [];
for (let w = 1; w <= 4; w++) for (let h = 1; h <= 4; h++) SIZES.push([w, h]);

/** 아무렇게나 고른 성냥(시드 난수) */
function randomEdges(rng, w, h, share = 0.7) {
  return allEdges(w, h).filter(() => rng() < share);
}

test('변 번호: 모눈의 짧은 변마다 하나씩이고, 두 끝이 이웃한 점이다', () => {
  for (const [w, h] of SIZES) {
    const total = edgeCount(w, h);
    assert.equal(total, (h + 1) * w + h * (w + 1));
    const names = new Set();
    for (let edge = 0; edge < total; edge++) {
      const end = edgeEnds(w, h, edge);
      assert.equal(Math.abs(end.x2 - end.x1) + Math.abs(end.y2 - end.y1), 1);
      assert.ok(end.x1 >= 0 && end.x2 <= w && end.y1 >= 0 && end.y2 <= h);
      const name = end.horizontal ? `가로 ${end.x1},${end.y1}` : `세로 ${end.x1},${end.y1}`;
      assert.equal(name, edgeName(w, h, edge));
      names.add(name);
    }
    assert.equal(names.size, total);
  }
});

test('모두 채운 모눈의 정사각형: 크기마다 (w - s + 1) × (h - s + 1)개. 3×3은 9 + 4 + 1 = 14, 4×4는 30', () => {
  for (const [w, h] of SIZES) {
    const expected = Array.from({ length: Math.min(w, h) }, (_, index) => (w - index) * (h - index));
    assert.deepEqual(sizeCounts(w, h, fullGrid(w, h)), expected);
    assert.equal(squaresOf(w, h).length, expected.reduce((a, b) => a + b, 0));
    assert.equal(bruteSquares(w, h, fullGrid(w, h)).length, squaresOf(w, h).length);
  }
  assert.deepEqual(sizeCounts(3, 3, fullGrid(3, 3)), [9, 4, 1]);
  assert.equal(countSquares(4, 4, fullGrid(4, 4)), 30);
  assert.equal(fullGrid(3, 3).length, 24);
});

test('정사각형 세기와 변이 아닌 성냥: 아무렇게나 놓은 성냥 600가지에서 글자로 찾아보는 방법과 같다', () => {
  const rng = createRng(20261121);
  for (let trial = 0; trial < 600; trial++) {
    const [w, h] = SIZES[randInt(rng, 0, SIZES.length - 1)];
    const edges = randomEdges(rng, w, h, 0.55 + rng() * 0.45);
    const mine = squaresIn(w, h, edges).map((square) => `${square.c},${square.r},${square.size}`);
    const other = bruteSquares(w, h, edges).map((square) => `${square.x},${square.y},${square.size}`);
    assert.deepEqual(mine.sort(), other.sort());
    assert.equal(looseMatches(w, h, edges).length, bruteLoose(w, h, edges));
  }
});

test('안에 성냥이 있어도 테두리가 다 있으면 큰 정사각형으로 센다. 테두리가 하나라도 빠지면 세지 않는다', () => {
  // 2×2 모눈을 다 채우면 작은 것 넷과 큰 것 하나
  assert.equal(countSquares(2, 2, fullGrid(2, 2)), 5);
  // 안쪽 십자 넷을 빼도 큰 것 하나는 남는다
  const outer = fullGrid(2, 2).filter((edge) => {
    const end = edgeEnds(2, 2, edge);
    return end.horizontal ? end.y1 !== 1 : end.x1 !== 1;
  });
  assert.equal(outer.length, 8);
  assert.equal(countSquares(2, 2, outer), 1);
  // 바깥 테두리 하나를 빼면 작은 것 하나와 큰 것이 함께 없어진다
  assert.equal(countSquares(2, 2, fullGrid(2, 2).slice(1)), 3);
});

test('할 일에 맞는지: 빼거나 옮긴 수가 딱 k이고, 정사각형이 딱 n이고, 약속이 있으면 모든 성냥이 정사각형의 변이다', () => {
  const board = { w: 2, h: 2, matches: fullGrid(2, 2), kind: 'remove', k: 1, n: 3, tidy: false };
  assert.equal(checkBoard(board), null);
  assert.equal(isDone(board, board.matches), false);
  for (const edge of board.matches) {
    const left = board.matches.filter((item) => item !== edge);
    assert.equal(changedCount(board, left), 1);
    assert.equal(isDone(board, left), true);
    assert.equal(edgesFit(board, left), true);
  }
  // 두 개를 빼면 k를 넘어서 놓일 수 없는 모습이다
  assert.equal(edgesFit(board, board.matches.slice(2)), false);
  // 약속이 붙으면: 바깥 테두리(위 줄 왼쪽 가로 변)를 빼면 그 칸의 왼쪽 세로 변이 어느 정사각형의 변도 아니게 된다.
  // 안쪽 변(가운데 줄 왼쪽 가로 변)을 빼면 큰 정사각형과 작은 것 둘이 남고 모든 성냥이 변이다
  const tidy = { ...board, tidy: true };
  const outer = board.matches.filter((item) => item !== 0);
  assert.equal(countSquares(2, 2, outer), 3);
  assert.deepEqual(looseMatches(2, 2, outer).map((edge) => edgeName(2, 2, edge)), ['세로 0,0']);
  assert.equal(isDone(tidy, outer), false);
  const inner = board.matches.filter((item) => item !== 2);
  assert.equal(countSquares(2, 2, inner), 3);
  assert.equal(looseMatches(2, 2, inner).length, 0);
  assert.equal(isDone(tidy, inner), true);
  // 옮기기: 성냥의 수는 그대로, 처음 자리에 없는 성냥의 수를 센다(처음 자리로 돌려놓으면 줄어든다)
  const move = { w: 3, h: 1, matches: [0, 1, 3, 4, 6, 7, 8], kind: 'move', k: 1, n: 3, tidy: false };
  assert.equal(checkBoard(move), null);
  assert.equal(countSquares(3, 1, move.matches), 2);
  // 가운데 칸의 위 변(1)을 오른쪽 칸의 위 변(2)으로 옮긴다
  const moved = [0, 2, 3, 4, 6, 7, 8];
  assert.equal(changedCount(move, moved), 1);
  assert.equal(edgesFit(move, moved), true);
  assert.equal(countSquares(3, 1, moved), 1);
  // 다시 처음 자리로 옮기면 옮긴 수는 0이다
  assert.equal(changedCount(move, move.matches), 0);
  // 두 개를 옮긴 모습은 k를 넘는다
  assert.equal(edgesFit(move, [0, 2, 3, 5, 6, 7, 8]), false);
});

test('판의 값 점검: 크기, 성냥 목록, 할 일, k와 n의 범위', () => {
  const good = { w: 3, h: 3, matches: fullGrid(3, 3), kind: 'remove', k: 4, n: 5, tidy: true };
  assert.equal(checkBoard(good), null);
  assert.notEqual(checkBoard({ ...good, w: 5 }), null);
  assert.notEqual(checkBoard({ ...good, matches: [3, 2] }), null);
  assert.notEqual(checkBoard({ ...good, matches: [0, 0] }), null);
  assert.notEqual(checkBoard({ ...good, matches: [99] }), null);
  assert.notEqual(checkBoard({ ...good, kind: 'add' }), null);
  assert.notEqual(checkBoard({ ...good, k: 0 }), null);
  assert.notEqual(checkBoard({ ...good, k: MAX_K.remove + 1 }), null);
  assert.notEqual(checkBoard({ ...good, n: 15 }), null);
  assert.notEqual(checkBoard({ ...good, tidy: 1 }), null);
  // 옮기기는 빈 자리가 k개 이상 있어야 한다(모두 채운 판에서는 옮길 수 없다)
  assert.notEqual(checkBoard({ ...good, kind: 'move', k: 1 }), null);
  assert.equal(checkBoard({ ...good, kind: 'move', k: 1, matches: fullGrid(3, 3).slice(1) }), null);
});

test('해 보는 방법의 수: 빼기는 성냥에서 k개를 고르는 수, 옮기기는 거기에 빈 변에서 k개를 고르는 수를 곱한다', () => {
  assert.equal(choose(24, 4), 10626);
  assert.equal(choose(5, 0), 1);
  assert.equal(choose(3, 4), 0);
  assert.equal(waysOf(3, 3, fullGrid(3, 3), 'remove', 4), 10626);
  const some = fullGrid(3, 3).slice(0, 16);
  assert.equal(waysOf(3, 3, some, 'move', 3), choose(16, 3) * choose(8, 3));
  const counted = tally(3, 3, some, 'move', 2);
  assert.equal(counted.ways, choose(16, 2) * choose(8, 2));
  assert.equal([...counted.all.values()].reduce((a, b) => a + b, 0), counted.ways);
});

test('풀이(작은 판): 2×2와 3×2 모눈의 판 120개에서, 변의 모든 부분 집합을 만들어 보는 방법과 답의 수가 같다', () => {
  const rng = createRng(7);
  let possible = 0;
  for (let trial = 0; trial < 120; trial++) {
    const [w, h] = trial % 2 === 0 ? [2, 2] : [3, 2];
    const kind = trial % 3 === 0 ? 'move' : 'remove';
    const matches = randomEdges(rng, w, h, kind === 'move' ? 0.6 : 0.85);
    const room = kind === 'move' ? Math.min(matches.length, edgeCount(w, h) - matches.length, MAX_K.move) : Math.min(matches.length, 3);
    if (room < 1) continue;
    const k = randInt(rng, 1, room);
    const counted = tally(w, h, matches, kind, k);
    const ns = [...counted.all.keys()];
    const n = ns[randInt(rng, 0, ns.length - 1)];
    const board = { w, h, matches, kind, k, n, tidy: trial % 4 === 1 };
    assert.equal(checkBoard(board), null);
    const result = solve(board);
    assert.equal(result.count, subsetCount(board), JSON.stringify(board));
    assert.equal(result.ways, waysOf(w, h, matches, kind, k));
    assert.equal(result.count, (board.tidy ? counted.tidy : counted.all).get(n) ?? 0);
    // 적어 둔 답은 정말 할 일에 맞는다
    for (const example of result.examples) assert.equal(isDone(board, example.matches), true);
    if (result.possible) possible += 1;
  }
  assert.ok(possible > 40);
});

test('풀이(3×3): 모두 채운 판에서 빼기 k = 1~3과, 칸 몇 개로 만든 판의 옮기기를 다음 고르기로 다시 센다', () => {
  const full = fullGrid(3, 3);
  for (let k = 1; k <= 3; k++) {
    const counted = tally(3, 3, full, 'remove', k);
    for (const n of [...counted.all.keys()].slice(0, 3)) {
      for (const tidy of [false, true]) {
        const board = { w: 3, h: 3, matches: full, kind: 'remove', k, n, tidy };
        const other = comboCount(board);
        const result = solve(board);
        assert.equal(result.count, other.count, `${k} ${n} ${tidy}`);
        assert.equal(result.ways, other.ways);
      }
    }
  }
  // 칸 넷(2×2 모양)을 테두리로 만든 판: 성냥 12개, 빈 변 12개에서 둘을 옮긴다
  const figure = [0, 1, 3, 4, 6, 7, 12, 13, 14, 16, 17, 18];
  assert.equal(countSquares(3, 3, figure), 5);
  for (const n of [3, 4, 6]) {
    const board = { w: 3, h: 3, matches: figure, kind: 'move', k: 2, n, tidy: n !== 4 };
    const other = comboCount(board);
    assert.equal(solve(board).count, other.count, `${n}`);
  }
});

test('풀이가 알려 준 것: 3×3을 다 채운 판에서 4개를 빼서 모든 성냥이 변이 되게 남기는 정사각형의 수는 4, 5, 6, 7, 9뿐이다', () => {
  const counted = tally(3, 3, fullGrid(3, 3), 'remove', 4);
  assert.deepEqual([...counted.tidy.keys()].sort((a, b) => a - b), [4, 5, 6, 7, 9]);
  assert.equal(counted.tidy.get(9), 14);
  // 하나를 빼면 정사각형은 10개 또는 11개가 된다(한 성냥이 테두리인 정사각형은 셋 또는 넷)
  assert.deepEqual([...tally(3, 3, fullGrid(3, 3), 'remove', 1).all.keys()].sort((a, b) => a - b), [10, 11]);
});

test('모눈 줄이기: 성냥을 둘러싼 가장 작은 모눈으로 옮겨도 정사각형과 변이 아닌 성냥은 그대로다', () => {
  const rng = createRng(99);
  for (let trial = 0; trial < 200; trial++) {
    const [w, h] = SIZES[randInt(rng, 0, SIZES.length - 1)];
    const edges = randomEdges(rng, w, h, 0.5);
    if (edges.length === 0) continue;
    const small = cropEdges(w, h, edges);
    assert.equal(small.matches.length, edges.length);
    assert.ok(small.w <= w && small.h <= h);
    assert.equal(bruteSquares(small.w, small.h, small.matches).length, bruteSquares(w, h, edges).length);
    assert.equal(bruteLoose(small.w, small.h, small.matches), bruteLoose(w, h, edges));
  }
  // 3×3 모눈의 오른쪽 아래 칸 하나는 1×1 모눈이 된다
  assert.deepEqual(cropEdges(3, 3, [8, 11, 22, 23]), { w: 1, h: 1, matches: [0, 1, 2, 3] });
});

test('모든 경우 펼쳐 보기(성냥 하나만 빼기): 성냥마다의 남는 정사각형 수가 그 성냥을 빼고 글자로 센 수와 같고, 하나를 빼는 풀이의 답과 맞는다', () => {
  const rng = createRng(20261122);
  for (let trial = 0; trial < 300; trial++) {
    const [w, h] = SIZES[randInt(rng, 0, SIZES.length - 1)];
    const edges = randomEdges(rng, w, h, 0.6 + rng() * 0.4);
    if (edges.length === 0) continue;
    const cases = oneOutCases(w, h, edges);
    assert.deepEqual(
      cases.map((item) => item.edge),
      edges,
    );
    for (const item of cases) assert.equal(item.squares, bruteSquares(w, h, edges.filter((edge) => edge !== item.edge)).length);
    const counts = oneOutCounts(w, h, edges);
    assert.deepEqual(counts, [...new Set(cases.map((item) => item.squares))].sort((a, b) => a - b));
    // 하나를 빼서 n개를 남기는 방법의 수는 남는 수가 n인 경우의 수와 같다(n이 남는 수에 없으면 안 되는 판)
    const n = randInt(rng, 0, squaresOf(w, h).length);
    const board = { w, h, matches: edges, kind: 'remove', k: 1, n, tidy: false };
    assert.equal(solve(board).count, cases.filter((item) => item.squares === n).length);
    assert.equal(solve(board).possible, counts.includes(n));
  }
  // 2×2를 다 채운 판은 어느 성냥을 빼도 3개, 3×2를 다 채운 판은 5개나 6개다
  assert.deepEqual(oneOutCounts(2, 2, fullGrid(2, 2)), [3]);
  assert.deepEqual(oneOutCounts(3, 2, fullGrid(3, 2)), [5, 6]);
});

test('해 본 경우: 처음 성냥에서 딱 하나만 빠진 모습의 그 성냥만 센다(더 많이 뺀 모습, 같은 모습은 세지 않는다)', () => {
  const board = { w: 2, h: 2, matches: fullGrid(2, 2), kind: 'remove', k: 1, n: 4, tidy: false };
  const without = (...gone) => board.matches.filter((edge) => !gone.includes(edge));
  assert.deepEqual([...triedOneOut(board, [])], []);
  assert.deepEqual([...triedOneOut(board, [without(3), without(5), without(3), without(1, 2), board.matches])].sort((a, b) => a - b), [3, 5]);
  // 처음 판에 없던 변이 든 모습은 세지 않는다
  assert.deepEqual([...triedOneOut({ ...board, matches: without(0) }, [without(0, 4).concat([0]).sort((a, b) => a - b)])], []);
});
