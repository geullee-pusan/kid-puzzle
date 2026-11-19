// 엉킨 그림 풀기의 풀이 프로그램을 확인한다: 겹침 가리기(정수로 똑같이), 풀 수 있는 그림인지 가리기,
// 풀 수 있는 그림에는 겹치지 않게 놓은 자리가 정말 있고, 풀 수 없는 그림에는 두 꼴 가운데 하나를 늘인 뼈대가 정말 있는지,
// 가장 적게 빼는 선의 수, 가장 긴 고리, 다리 판의 자리. 다른 방법은 tests/helpers/brute-untangle.js에 있다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createRng, randInt } from '../src/core/rng.js';
import { NAMED, STORIES, bipartite, complete } from '../src/core/untangle-ladder.js';
import {
  GRID_H,
  GRID_W,
  blocksOf,
  bridgeLayoutOf,
  canPlace,
  checkBoard,
  coreOf,
  crossesProperly,
  fewestRemovals,
  isPlanar,
  layoutOf,
  longestCycle,
  onInside,
  pointsOk,
  problemsOf,
  solveBoard,
  untangled,
} from '../src/core/untangle.js';
import { hasKuratowskiBrute, kuratowskiKind, longestCycleBrute, meetBrute, onSegmentBrute, problemsBrute } from './helpers/brute-untangle.js';

/** 점 n개의 그림을 비트로: 모든 점의 쌍 가운데 mask의 비트가 켜진 쌍을 잇는다 */
function graphOf(n, mask) {
  const pairs = complete(n).edges;
  return pairs.filter((_, index) => mask & (1 << index));
}

/** 풀 수 있다는 증거: 겹친 곳 없이 놓은 자리(다른 방법으로 센다) */
function assertLayout(n, edges, where) {
  const points = layoutOf(n, edges);
  assert.ok(points, `${where}: 놓은 자리가 없어요`);
  assert.ok(pointsOk(points, n), `${where}: 자리가 격자 밖이거나 겹쳐요`);
  assert.equal(problemsBrute(points, edges).count, 0, `${where}: ${JSON.stringify(points)}`);
  const raw = layoutOf(n, edges, { spread: false });
  assert.equal(problemsBrute(raw, edges).count, 0, `${where}: 밀어 놓기만 한 자리`);
}

/** 풀 수 없다는 증거: 원래 그림의 선으로 이루어진 뼈대가 두 꼴 가운데 하나를 늘인 것이다(다른 방법으로 따라간다) */
function assertCore(n, edges, where) {
  const core = coreOf(n, edges);
  assert.ok(core, `${where}: 뼈대가 없어요`);
  const keys = new Set(edges.map(([a, b]) => `${a}-${b}`));
  for (const [a, b] of core.edges) assert.ok(keys.has(`${a}-${b}`), `${where}: 없는 선 ${a}-${b}`);
  assert.equal(kuratowskiKind(core.edges), core.kind, `${where}: ${JSON.stringify(core.edges)}`);
  return core;
}

test('겹침 가리기: 정수 자리에서 엇갈림과 점이 선 위에 놓인 것을 분수로 푼 다른 방법과 똑같이 가린다', () => {
  const rng = createRng(11);
  const spot = () => [randInt(rng, 0, 4), randInt(rng, 0, 4)];
  let crosses = 0;
  let others = 0;
  for (let round = 0; round < 30000; round++) {
    const [p1, p2, p3, p4] = [spot(), spot(), spot(), spot()];
    if (p1.join() === p2.join() || p3.join() === p4.join()) continue;
    const brute = meetBrute(p1, p2, p3, p4);
    assert.equal(crossesProperly(p1, p2, p3, p4), brute === 'cross', JSON.stringify([p1, p2, p3, p4]));
    if (brute === 'cross') crosses += 1;
    if (brute === 'other') others += 1;
    assert.equal(onInside(p3, p1, p2), onSegmentBrute(p3, p1, p2), JSON.stringify([p3, p1, p2]));
  }
  assert.ok(crosses > 1000 && others > 1000, `${crosses} ${others}`);
  // 한 줄로 포개진 두 선, 끝이 다른 선에 닿은 것, 끝을 같이 쓰는 것
  assert.equal(crossesProperly([0, 0], [4, 0], [2, 0], [6, 0]), false);
  assert.deepEqual(problemsOf([[0, 0], [4, 0], [2, 0], [6, 0]], [[0, 1], [2, 3]]).touches.length, 2);
  assert.deepEqual(problemsOf([[0, 0], [4, 0], [2, 0]], [[0, 1], [0, 2]]).touches, [{ point: 2, edge: 0 }]);
  assert.equal(problemsOf([[0, 0], [4, 0], [2, 3], [2, -3]], [[0, 1], [2, 3]]).crossings.length, 1);
  assert.equal(problemsOf([[0, 0], [4, 0], [2, 3], [2, 0]], [[0, 1], [2, 3]]).count, 1, '선의 끝이 다른 선 위에 닿으면 겹친 곳 하나');
  assert.equal(problemsOf([[0, 0], [4, 0], [4, 4]], [[0, 1], [1, 2], [0, 2]]).count, 0, '끝을 같이 쓰는 선은 겹치지 않는다');
});

test('겹친 곳의 수: 아무렇게나 놓은 그림에서 다른 방법으로 센 수와 같다. 빼 둔 선은 세지 않는다', () => {
  const rng = createRng(5);
  for (let round = 0; round < 400; round++) {
    const n = randInt(rng, 4, 9);
    const points = [];
    while (points.length < n) {
      const at = [randInt(rng, 0, 7), randInt(rng, 0, 5)];
      if (!points.some((other) => other.join() === at.join())) points.push(at);
    }
    const edges = complete(n).edges.filter(() => rng() < 0.45);
    const off = edges.map((_, index) => index).filter(() => rng() < 0.2);
    const mine = problemsOf(points, edges, off);
    const brute = problemsBrute(points, edges, off);
    assert.deepEqual([mine.crossings.length, mine.touches.length], [brute.crossings, brute.touches]);
    assert.equal(untangled(points, edges, 0, off), brute.count === 0);
  }
});

test('판의 규격과 점을 놓을 자리', () => {
  const board = { points: [[0, 0], [2, 0], [1, 2]], edges: [[0, 1], [1, 2]], roles: null, bridges: 0 };
  assert.equal(checkBoard(board), null);
  assert.equal(checkBoard({ ...board, points: [[0, 0], [0, 0], [1, 2]] }), 'bad-points');
  assert.equal(checkBoard({ ...board, points: [[0, 0], [GRID_W + 1, 0], [1, 2]] }), 'bad-points');
  assert.equal(checkBoard({ ...board, edges: [[1, 0]] }), 'bad-edges');
  assert.equal(checkBoard({ ...board, edges: [[0, 1], [0, 1]] }), 'bad-edges');
  assert.equal(checkBoard({ ...board, edges: [] }), 'no-edges');
  assert.equal(checkBoard({ ...board, edges: [] }, { allowEmpty: true }), null);
  assert.equal(checkBoard({ ...board, roles: ['house', 'well'] }), 'bad-roles');
  assert.equal(checkBoard({ ...board, bridges: 2 }), 'bad-bridges');
  assert.equal(canPlace(board.points, 0, [2, 0]), false, '다른 점이 있는 자리');
  assert.equal(canPlace(board.points, 0, [0, 1]), true);
  assert.equal(canPlace(board.points, 0, [-1, 0]), false, '격자 밖');
  assert.equal(canPlace(board.points, 0, [GRID_W, GRID_H]), true);
});

test('풀 수 있는가: 점 다섯 이하의 모든 그림은 점 다섯을 모두 잇는 그림만 빼고 풀 수 있다', () => {
  for (let n = 1; n <= 5; n++) {
    const pairs = (n * (n - 1)) / 2;
    for (let mask = 0; mask < 1 << pairs; mask++) {
      const edges = graphOf(n, mask);
      assert.equal(isPlanar(n, edges), !(n === 5 && edges.length === 10), `${n} ${mask}`);
    }
  }
});

test('풀 수 있는가: 점 여섯의 모든 그림(32,768개)에서 두 꼴을 찾는 다른 방법과 같다. 풀 수 있는 그림은 놓은 자리로, 없는 그림은 뼈대로 확인한다', () => {
  let planar = 0;
  let not = 0;
  for (let mask = 0; mask < 1 << 15; mask++) {
    const edges = graphOf(6, mask);
    const mine = isPlanar(6, edges);
    assert.equal(mine, !hasKuratowskiBrute(6, edges), `점 여섯 ${mask}`);
    if (mine) planar += 1;
    else not += 1;
    // 증거는 몇 개 건너 하나씩만 본다(시간이 걸린다).
    if (mask % 37 === 0) {
      if (mine && edges.length > 0) assertLayout(6, edges, `점 여섯 ${mask}`);
      if (!mine) assertCore(6, edges, `점 여섯 ${mask}`);
    }
  }
  // 점 여섯의 이름 붙은 그림 32,768개 가운데 풀 수 없는 것의 수(다른 방법과 같다는 것은 위에서 보았다)
  assert.equal(planar + not, 32768);
  assert.ok(not > 0 && planar > not);
});

test('풀 수 있는가: 점 일곱과 여덟의 아무렇게나 만든 그림에서도 다른 방법과 같고, 증거가 있다', () => {
  const rng = createRng(77);
  let yes = 0;
  let no = 0;
  for (let round = 0; round < 700; round++) {
    const n = round % 3 === 0 ? 8 : 7;
    const m = randInt(rng, 9, 3 * n - 5);
    const pairs = complete(n).edges;
    const edges = pairs
      .map((edge) => ({ edge, key: rng() }))
      .sort((a, b) => a.key - b.key)
      .slice(0, m)
      .map((item) => item.edge)
      .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const mine = isPlanar(n, edges);
    if (n === 7) assert.equal(mine, !hasKuratowskiBrute(n, edges), JSON.stringify(edges));
    if (mine) {
      yes += 1;
      assertLayout(n, edges, JSON.stringify(edges));
    } else {
      no += 1;
      assertCore(n, edges, JSON.stringify(edges));
    }
  }
  assert.ok(yes > 100 && no > 100, `${yes} ${no}`);
});

test('이름 있는 그림: 점 다섯을 모두 잇는 그림, 집 셋과 우물 셋, 열 점의 그림은 풀 수 없고, 하나 모자란 그림과 빽빽한 그림은 풀린다', () => {
  for (const name of ['k5', 'k33', 'k6', 'k34', 'k44', 'petersen']) {
    const { n, edges } = NAMED[name];
    assert.equal(isPlanar(n, edges), false, name);
    assertCore(n, edges, name);
  }
  assert.equal(coreOf(5, NAMED.k5.edges).kind, 'k5');
  assert.equal(coreOf(6, NAMED.k33.edges).kind, 'k33');
  assert.deepEqual(coreOf(6, NAMED.k33.edges).sides, [
    [0, 1, 2],
    [3, 4, 5],
  ]);
  // 열 점의 그림(바깥 고리 다섯, 안쪽 다섯)은 점 다섯을 모두 잇는 그림이 아니라 집 셋과 우물 셋을 늘인 꼴이 숨어 있다.
  assert.equal(coreOf(10, NAMED.petersen.edges).kind, 'k33');
  for (const name of ['k4', 'k23', 'prism', 'cube', 'octahedron', 'wheel']) {
    const { n, edges } = NAMED[name];
    assert.equal(isPlanar(n, edges), true, name);
    assertLayout(n, edges, name);
  }
  for (let at = 0; at < 10; at++) assertLayout(5, NAMED.k5.edges.filter((_, index) => index !== at), `k5-${at}`);
  for (let at = 0; at < 9; at++) assertLayout(6, NAMED.k33.edges.filter((_, index) => index !== at), `k33-${at}`);
  // 팔면체는 선이 열둘(점 여섯에 그을 수 있는 가장 많은 수)인데도 풀린다.
  assert.equal(NAMED.octahedron.edges.length, 12);
});

test('조각(블록)으로 나누기: 점 하나로만 붙은 두 고리는 두 조각이고, 조각마다 따로 따져도 된다', () => {
  // 세모 둘이 점 2를 같이 쓴다
  const blocks = blocksOf(5, [
    [0, 1],
    [1, 2],
    [0, 2],
    [2, 3],
    [3, 4],
    [2, 4],
  ]);
  assert.equal(blocks.length, 2);
  // 점 다섯을 모두 잇는 그림 둘을 점 하나로 붙인 그림은 풀 수 없다. 하나에서 선을 빼도 다른 하나가 남는다.
  const twin = [...NAMED.k5.edges, ...NAMED.k5.edges.map(([a, b]) => [a + 4, b + 4])].filter(([a, b], index, list) => list.findIndex(([c, d]) => c === a && d === b) === index);
  assert.equal(isPlanar(9, twin), false);
  assert.equal(fewestRemovals(9, twin).best, 2);
});

test('가장 적게 빼는 선의 수: 이름 있는 그림에서 선의 수로 따진 아래 끝과 같고, 그만큼 빼면 정말 풀린다', () => {
  // 아래 끝: 풀린 그림에서 선의 수는 세모가 있으면 3n−6, 세모가 없으면(두 편) 2n−4, 가장 짧은 고리가 다섯이면 5(n−2)/3을 넘지 못한다.
  const cases = [
    ['k5', 10 - (3 * 5 - 6)],
    ['k33', 9 - (2 * 6 - 4)],
    ['k6', 15 - (3 * 6 - 6)],
    ['k34', 12 - (2 * 7 - 4)],
    ['k44', 16 - (2 * 8 - 4)],
    ['petersen', 15 - Math.floor((5 * (10 - 2)) / 3)],
  ];
  for (const [name, floor] of cases) {
    const { n, edges } = NAMED[name];
    const { best, removed } = fewestRemovals(n, edges);
    assert.equal(best, floor, name);
    assert.equal(removed.length, best);
    assertLayout(
      n,
      edges.filter((_, index) => !removed.includes(index)),
      name,
    );
  }
  assert.deepEqual(fewestRemovals(4, NAMED.k4.edges), { best: 0, removed: [] });
});

test('가장 적게 빼는 선의 수: 점 일곱의 아무렇게나 만든 그림에서, 하나 덜 빼는 모든 묶음은 다른 방법으로도 풀 수 없다', () => {
  const rng = createRng(31);
  let checked = 0;
  for (let round = 0; round < 60 && checked < 25; round++) {
    const n = 7;
    const edges = complete(n)
      .edges.filter(() => rng() < 0.62)
      .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (isPlanar(n, edges)) continue;
    const { best, removed } = fewestRemovals(n, edges);
    assertLayout(
      n,
      edges.filter((_, index) => !removed.includes(index)),
      JSON.stringify(edges),
    );
    // best − 1개를 빼는 모든 묶음
    const pick = [];
    const every = (from) => {
      if (pick.length === best - 1) {
        assert.ok(hasKuratowskiBrute(n, edges.filter((_, index) => !pick.includes(index))), JSON.stringify([edges, pick]));
        return;
      }
      for (let index = from; index < edges.length; index++) {
        pick.push(index);
        every(index + 1);
        pick.pop();
      }
    };
    every(0);
    checked += 1;
  }
  assert.ok(checked >= 20, String(checked));
});

test('가장 긴 고리: 모든 길을 걸어 본 다른 방법과 길이가 같고, 정말 이어진 고리다', () => {
  const rng = createRng(9);
  for (let round = 0; round < 300; round++) {
    const n = randInt(rng, 3, 8);
    const edges = complete(n).edges.filter(() => rng() < 0.4);
    const cycle = longestCycle(n, edges);
    assert.equal(cycle.length, longestCycleBrute(n, edges), JSON.stringify(edges));
    const keys = new Set(edges.map(([a, b]) => `${Math.min(a, b)}-${Math.max(a, b)}`));
    assert.equal(new Set(cycle).size, cycle.length);
    cycle.forEach((v, at) => {
      const w = cycle[(at + 1) % cycle.length];
      assert.ok(keys.has(`${Math.min(v, w)}-${Math.max(v, w)}`), JSON.stringify([edges, cycle]));
    });
  }
  // 집 셋과 우물 셋에는 여섯 점을 모두 지나는 고리가 있다(왜 그럴까의 고리). 열 점의 그림은 아홉 점까지다.
  assert.equal(longestCycle(6, NAMED.k33.edges).length, 6);
  assert.equal(longestCycle(10, NAMED.petersen.edges).length, 9);
  assert.equal(longestCycle(4, [[0, 1], [1, 2], [2, 3]]).length, 0);
});

test('다리 판: 다리 하나를 놓을 수 있는 이야기 판(집 셋과 우물 셋, 마을 다섯)에는 엇갈린 곳이 하나뿐인 자리가 있다', () => {
  for (const story of STORIES.filter((item) => item.bridges > 0)) {
    const { n, edges } = story.graph;
    assert.equal(isPlanar(n, edges), false);
    const points = bridgeLayoutOf(n, edges, 1);
    assert.ok(points);
    assert.ok(pointsOk(points, n));
    const brute = problemsBrute(points, edges);
    assert.deepEqual([brute.crossings, brute.touches], [1, 0]);
    const solution = solveBoard({ points: points.map((point) => [GRID_W - point[0], point[1]]), edges, roles: story.roles, bridges: 1 });
    assert.equal(solution.possible, true);
    assert.equal(solution.planar, false);
  }
  // 다리가 없으면 같은 그림도 풀 수 없다.
  assert.equal(solveBoard({ points: [[0, 0], [2, 0], [4, 0], [0, 4], [2, 4], [4, 4]], edges: bipartite(3, 3).edges, roles: null, bridges: 0 }).possible, false);
});
