// 그물 끊기의 풀이 프로그램 점검: 가장 많이 끊을 수 있는 줄의 수가 다른 방법(tests/helpers/brute-net.js)과 같은지,
// 어떤 차례로 끊어도 더 끊을 줄이 없을 때의 끊은 수가 늘 같은지, 지금 모습(조각, 고리, 끝났는지)과 고리 찾기, 누른 자리의 줄을 본다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { base, drawn, grid, island, sideBySide, wheel } from '../src/core/net-ladder.js';
import { MAX_GUESS, REACH, checkBoard, cutOf, cutPerNet, loopOf, maxCut, movesOk, netsOf, piecesOf, solve, stateOf, stringAt, wayOf } from '../src/core/net.js';
import { createRng, randInt } from '../src/core/rng.js';
import { bruteMaxCut, countPieces, endCounts, hasLoop } from './helpers/brute-net.js';

/** 작은 그물들: 바탕 그림, 두 조각 그물, 나란한 두 그물 */
const SMALL = () => [
  ['네모', grid(2, 2)],
  ['집', base('house')],
  ['나비', base('bowtie')],
  ['물고기', base('fish')],
  ['깃발', base('flag')],
  ['막대 사탕', base('lolly')],
  ['모눈 3×2', grid(3, 2)],
  ['사다리 4×2', grid(4, 2)],
  ['바퀴 4', wheel(4)],
  ['바퀴 5', wheel(5)],
  ['모눈 3×3', grid(3, 3)],
  ['상자', drawn('cube')],
  ['테두리와 떨어진 섬', island(4, 3, 0)],
  ['테두리와 이어진 섬', island(4, 3, 1)],
  ['나란한 두 그물', sideBySide(base('house'), base('bowtie'))],
];

/** 모눈 w×h 위의 무작위 그물(이웃한 점끼리의 줄 가운데 몇 개). 모든 매듭에 줄이 있게 줄 없는 매듭은 뺀다 */
function randomNet(rng, w, h) {
  const all = grid(w, h);
  const strings = all.strings.filter(() => rng() < 0.7);
  const used = [...new Set(strings.flat())].sort((a, b) => a - b);
  const index = new Map(used.map((knot, at) => [knot, at]));
  return { knots: used.map((knot) => all.knots[knot]), strings: strings.map(([a, b]) => [index.get(a), index.get(b)]), family: 'made' };
}

test('판의 규격: 매듭이 떨어져 있고, 모든 매듭에 줄이 있고, 같은 줄이 둘이 아니고, 줄이 다른 매듭 위를 지나가지 않는다', () => {
  for (const [name, board] of SMALL()) assert.equal(checkBoard(board), null, name);
  const square = grid(2, 2);
  const bad = [
    null,
    { knots: [[0, 0], [1, 0]], strings: [[0, 1]] },
    { ...square, knots: [[0, 0], [0.3, 0], [0, 1], [1, 1]] },
    { ...square, strings: [...square.strings, [1, 0]] },
    { ...square, strings: [[0, 1], [1, 3], [0, 0]] },
    { ...square, strings: [[0, 1], [1, 3]] },
    { knots: [[0, 0], [1, 0], [2, 0]], strings: [[0, 2], [0, 1]] },
    { ...square, knots: [[0, 0], [1, 0], [0, 1], [13, 1]] },
    { ...square, strings: [[0, 1], [1, 4]] },
  ];
  for (const board of bad) assert.notEqual(checkBoard(board), null, JSON.stringify(board));
  assert.equal(MAX_GUESS, 20);
});

test('누른 줄의 차례: 같은 줄을 두 번 누르면 다시 이어진다. 조각과 고리와 끝났는지는 다른 방법으로 센 것과 같다', () => {
  assert.deepEqual(cutOf([3, 1, 3, 0, 1, 5]), [0, 5]);
  assert.deepEqual(cutOf([]), []);
  const house = base('house');
  assert.ok(movesOk(house, [0, 5, 5]));
  assert.ok(!movesOk(house, [6]));
  assert.ok(!movesOk(house, [1.5]));
  const rng = createRng(7);
  for (const [name, board] of SMALL()) {
    const m = board.strings.length;
    for (let trial = 0; trial < 40; trial++) {
      const cut = board.strings.map((_, index) => index).filter(() => rng() < 0.4);
      const removed = new Set(cut);
      const state = stateOf(board, cut);
      const where = `${name} ${cut}`;
      assert.equal(state.pieces, countPieces(board, removed), where);
      assert.equal(state.start, countPieces(board), where);
      assert.equal(state.cut, cut.length, where);
      assert.equal(state.left, m - cut.length, where);
      assert.equal(state.loops, hasLoop(board, removed), where);
      assert.equal(state.split, state.pieces > state.start, where);
      assert.equal(state.done, !state.split && !state.loops, where);
      // 끝난 모습에서 끊은 줄의 수는 늘 가장 많이 끊을 수 있는 수다
      if (state.done) assert.equal(cut.length, maxCut(board), where);
      // 고리 찾기: 고리가 있을 때만 하나를 찾고, 찾은 것은 남은 줄로 된 한 바퀴다
      const loop = loopOf(board, cut);
      assert.equal(loop !== null, state.loops, where);
      if (loop) {
        assert.ok(loop.strings.every((index) => !removed.has(index)), where);
        assert.equal(loop.strings.length, loop.knots.length, where);
        const degree = new Map();
        for (const index of loop.strings) for (const knot of board.strings[index]) degree.set(knot, (degree.get(knot) ?? 0) + 1);
        assert.ok([...degree.values()].every((value) => value === 2), where);
        assert.deepEqual([...degree.keys()].sort((a, b) => a - b), loop.knots.slice().sort((a, b) => a - b), where);
        // 고리의 줄만 남기면 한 조각이다(고리 둘이 아니다)
        const only = { knots: board.knots, strings: board.strings };
        const outside = new Set(board.strings.map((_, index) => index).filter((index) => !loop.strings.includes(index)));
        assert.equal(countPieces(only, outside), board.knots.length - loop.knots.length + 1, where);
      }
    }
  }
});

test('가장 많이 끊을 수 있는 줄: (줄 수) - (매듭 수) + (처음 조각 수)는 끊을 줄의 모든 묶음을 끊어 본 것과 같다(작은 그물들과 무작위 그물 60개)', () => {
  for (const [name, board] of SMALL()) assert.equal(maxCut(board), bruteMaxCut(board), name);
  const rng = createRng(2026);
  for (let trial = 0; trial < 60; trial++) {
    const board = randomNet(rng, randInt(rng, 2, 4), randInt(rng, 2, 3));
    if (board.knots.length < 3 || board.strings.length > 16) continue;
    assert.equal(maxCut(board), bruteMaxCut(board), JSON.stringify(board));
  }
});

test('어떤 차례로 끊어도, 더 끊을 줄이 없을 때 끊은 줄의 수는 늘 같다(끊는 차례를 모두 따라가 본다)', () => {
  for (const [name, board] of SMALL()) assert.deepEqual(endCounts(board), [maxCut(board)], name);
  const rng = createRng(11);
  for (let trial = 0; trial < 20; trial++) {
    const board = randomNet(rng, 3, 3);
    if (board.knots.length < 3 || board.strings.length > 12) continue;
    assert.deepEqual(endCounts(board), [maxCut(board)], JSON.stringify(board));
  }
});

test('풀이: 끊는 방법 하나나 둘(서로 다르다). 그대로 끊으면 더 끊을 줄이 없는 모습이다. 그물마다의 수는 왼쪽 그물부터', () => {
  for (const [name, board] of SMALL()) {
    const solution = solve(board);
    assert.equal(solution.possible, true);
    assert.equal(solution.max, maxCut(board), name);
    assert.equal(solution.knots, board.knots.length, name);
    assert.equal(solution.strings, board.strings.length, name);
    assert.equal(solution.pieces, countPieces(board), name);
    assert.ok(solution.ways.length === 1 || solution.ways.length === 2, name);
    if (solution.ways.length === 2) assert.notDeepEqual(solution.ways[0], solution.ways[1], name);
    for (const cut of solution.ways) {
      assert.equal(cut.length, solution.max, name);
      assert.ok(stateOf(board, cut).done, name);
    }
    assert.equal(solution.nets.length, solution.pieces, name);
    assert.equal(solution.nets.reduce((sum, net) => sum + net.max, 0), solution.max, name);
  }
  assert.equal(solve(grid(3, 3)).ways.length, 2);
  assert.deepEqual(wayOf(grid(2, 2)), [3]);
  // 나란한 두 그물: 왼쪽이 집(줄 6개), 오른쪽이 물고기(줄 7개)
  const twins = sideBySide(base('house'), base('fish'));
  assert.deepEqual(netsOf(twins).map((net) => [net.knots, net.strings, net.max]), [[5, 6, 2], [6, 7, 2]]);
  assert.deepEqual(cutPerNet(twins, [0, 4, 6, 7, 8]), [2, 3]);
  // 처음부터 두 조각인 그물: 줄 11개, 매듭 12개인데 1줄을 끊을 수 있다
  assert.equal(piecesOf(12, island(4, 3, 0).strings).count, 2);
  assert.equal(maxCut(island(4, 3, 0)), 1);
});

test('누른 자리의 줄: 가장 가까운 줄(REACH 안), 멀면 없다', () => {
  const square = grid(2, 2);
  // 줄: 0 위, 1 아래, 2 왼쪽, 3 오른쪽
  assert.deepEqual(square.strings, [[0, 1], [2, 3], [0, 2], [1, 3]]);
  assert.equal(stringAt(square, [0.5, 0.1]), 0);
  assert.equal(stringAt(square, [0.5, 0.9]), 1);
  assert.equal(stringAt(square, [0.1, 0.5]), 2);
  assert.equal(stringAt(square, [0.5, -0.3]), 0);
  assert.equal(stringAt(square, [0.5, 0.3]), 0);
  assert.equal(stringAt(square, [0.5, 0.5]), null);
  assert.equal(stringAt(square, [0.5, -REACH - 0.01]), null);
  assert.equal(stringAt(square, [3, 3]), null);
});
