// 엉킨 그림 풀기의 사다리와 판 내기를 확인한다: 단계마다의 판, 같은 번호는 같은 판, 엉킨 처음 자리에는 정말 겹친 곳이 있다,
// 섞이는 단계의 풀 수 없는 그림의 비율, 이야기 판, 가장 적게 빼기 판, 그리고 "더 작은 판".
// 판마다 풀 수 있는지를 증거로 확인한다: 풀 수 있는 판은 겹친 곳 없이 놓은 자리, 없는 판은 두 꼴 가운데 하나를 늘인 뼈대.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { smallerUntangle } from '../src/core/smaller.js';
import { FIRST_BOARD, IMPOSSIBLE_RATE, LADDER, MAKE_LEVEL, NAMED, STORIES, TOP_LEVEL, generateBoard, nextSeed, rungOf, smallBoards, tangleMade } from '../src/core/untangle-ladder.js';
import { checkBoard, coreOf, fewestRemovals, isPlanar, layoutOf, pointsOk } from '../src/core/untangle.js';
import { kuratowskiKind, problemsBrute } from './helpers/brute-untangle.js';

const SEEDS = Array.from({ length: 60 }, (_, index) => index + 1);
const sameGraph = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** 판 하나를 증거로 확인하고, 풀 수 있는지를 돌려준다 */
function proven(board, where) {
  const n = board.points.length;
  if (isPlanar(n, board.edges)) {
    const points = layoutOf(n, board.edges);
    assert.equal(problemsBrute(points, board.edges).count, 0, where);
    return true;
  }
  const core = coreOf(n, board.edges);
  assert.ok(kuratowskiKind(core.edges), where);
  return false;
}

test('사다리: 여섯 단계, 표시는 기본·기본·응용·응용·도전·도전, 맨 위는 직접 만들기', () => {
  assert.deepEqual(
    LADDER.map((rung) => [rung.level, rung.tag, rung.mode]),
    [
      [1, 'basic', 'untangle'],
      [2, 'basic', 'untangle'],
      [3, 'applied', 'mix'],
      [4, 'applied', 'story'],
      [5, 'challenge', 'record'],
      [6, 'challenge', 'make'],
    ],
  );
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  assert.throws(() => rungOf(9));
  assert.throws(() => generateBoard(MAKE_LEVEL, 1));
  assert.equal(IMPOSSIBLE_RATE, 1 / 3);
});

test('같은 번호는 늘 같은 판이고, 낸 판은 규격에 맞고, 엉킨 처음 자리에는 겹친 곳이 있다(점이 선 위에 놓인 곳은 없다)', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const small of [false, true]) {
      let plenty = 0;
      for (const seed of SEEDS) {
        const made = generateBoard(level, seed, { small });
        assert.deepEqual(generateBoard(level, seed, { small }).board, made.board);
        const { board } = made;
        const where = `${level}단계 ${seed}번 ${small}`;
        assert.equal(checkBoard(board), null, where);
        const brute = problemsBrute(board.points, board.edges);
        assert.equal(brute.touches, 0, where);
        assert.ok(brute.crossings >= 1, where);
        // 점 넷(마을 넷)은 어떻게 놓아도 엇갈린 곳이 하나까지라서 세지 않는다
        if (brute.crossings >= rungOf(level).cross || board.points.length <= 4) plenty += 1;
        // 점끼리 너무 붙어 있지 않다
        for (let a = 0; a < board.points.length; a++) {
          for (let b = a + 1; b < board.points.length; b++) assert.ok((board.points[a][0] - board.points[b][0]) ** 2 + (board.points[a][1] - board.points[b][1]) ** 2 >= 8, where);
        }
        // 풀이 프로그램의 답과 증거가 같다
        assert.equal(proven(board, where), made.solution.planar, where);
      }
      // 엇갈린 곳이 단계마다 정한 수보다 적은 판은 엇갈릴 자리가 모자란 작은 그림뿐이다
      assert.ok(plenty >= SEEDS.length * 0.85, `${level}단계 ${small}: ${plenty}`);
    }
  }
});

test('1, 2단계: 모두 풀 수 있는 그림이고, 끝점(선이 하나뿐인 점)이 없다. 첫 판은 엉킨 다섯 점의 고리다', () => {
  assert.deepEqual(generateBoard(1, 1).board, FIRST_BOARD);
  assert.equal(problemsBrute(FIRST_BOARD.points, FIRST_BOARD.edges).crossings, 5);
  for (const level of [1, 2]) {
    const counts = new Set();
    for (const seed of SEEDS) {
      const { board, solution } = generateBoard(level, seed);
      assert.equal(solution.possible, true);
      assert.equal(solution.planar, true);
      assert.equal(problemsBrute(solution.layout, board.edges).count, 0);
      counts.add(board.points.length);
      const degree = board.points.map((_, v) => board.edges.filter((edge) => edge.includes(v)).length);
      assert.ok(Math.min(...degree) >= 2, `${level} ${seed}`);
    }
    assert.deepEqual([...counts].sort((a, b) => a - b), level === 1 ? [5, 6, 7] : [8, 9, 10, 11, 12]);
  }
});

test('3단계: 풀 수 없는 그림이 셋에 하나쯤 섞인다. 첫 판은 점 다섯을 모두 잇는 그림이다', () => {
  const first = generateBoard(3, 1).board;
  assert.equal(first.points.length, 5);
  assert.equal(first.edges.length, 10);
  assert.equal(generateBoard(3, 1).solution.possible, false);
  let impossible = 0;
  const kinds = new Set();
  for (const seed of SEEDS) {
    const { board, solution } = generateBoard(3, seed);
    if (!solution.possible) {
      impossible += 1;
      kinds.add(solution.core.kind);
    }
    assert.ok(board.points.length <= 10);
  }
  const rate = impossible / SEEDS.length;
  assert.ok(rate > 0.2 && rate < 0.5, String(rate));
  assert.deepEqual([...kinds].sort(), ['k33', 'k5']);
});

test('4단계: 이야기 판이 차례로 돈다. 집과 우물은 두 편으로만 이어지고, 다리 판은 엇갈린 곳 하나로 풀린다', () => {
  assert.equal(STORIES.length, 8);
  assert.deepEqual(
    STORIES.map((story) => [story.graph.n, story.graph.edges.length, story.bridges]),
    [
      [5, 6, 0],
      [6, 9, 0],
      [6, 8, 0],
      [6, 9, 1],
      [4, 6, 0],
      [5, 10, 0],
      [5, 9, 0],
      [5, 10, 1],
    ],
  );
  // 풀 수 없는 판은 여덟에 둘(집 셋과 우물 셋, 마을 다섯)
  assert.deepEqual(
    STORIES.map((story) => isPlanar(story.graph.n, story.graph.edges) || story.bridges > 0),
    [true, false, true, true, true, false, true, true],
  );
  for (const seed of SEEDS.slice(0, 16)) {
    const { board, solution } = generateBoard(4, seed);
    const story = STORIES[(seed - 1) % STORIES.length];
    assert.equal(board.bridges, story.bridges);
    assert.equal(board.roles.length, board.points.length);
    // 옷이 같은 점끼리는 잇지 않는다(집과 집, 우물과 우물). 마을은 모두 마을이다.
    if (board.roles.includes('house')) for (const [a, b] of board.edges) assert.notEqual(board.roles[a], board.roles[b]);
    else assert.ok(board.roles.every((role) => role === 'town'));
    if (board.bridges > 0) {
      assert.equal(solution.possible, true);
      const brute = problemsBrute(solution.bridgeLayout, board.edges);
      assert.deepEqual([brute.crossings, brute.touches], [1, 0]);
    }
  }
  assert.deepEqual(generateBoard(4, 1).board.roles.filter((role) => role === 'house').length, 2);
});

test('5단계: 모두 풀 수 없는 그림이고, 가장 적게 빼는 수는 1~4다. 첫 판은 점 다섯을 모두 잇는 그림(하나만 빼면 된다)', () => {
  assert.equal(generateBoard(5, 1).board.edges.length, 10);
  const bests = new Set();
  for (const seed of SEEDS.slice(0, 24)) {
    const { board } = generateBoard(5, seed);
    const n = board.points.length;
    assert.equal(isPlanar(n, board.edges), false);
    const { best, removed } = fewestRemovals(n, board.edges);
    bests.add(best);
    assert.ok(best >= 1 && best <= 4, `${seed}: ${best}`);
    const rest = board.edges.filter((_, index) => !removed.includes(index));
    assert.equal(problemsBrute(layoutOf(n, rest), rest).count, 0);
  }
  assert.deepEqual([...bests].sort(), [1, 2, 3, 4]);
});

test('다음 판 번호는 방금 한 판과 다른 판이 나오는 번호다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of SEEDS.slice(0, 12)) {
      const next = nextSeed(level, seed);
      assert.ok(next > seed);
      assert.notDeepEqual(generateBoard(level, next).board, generateBoard(level, seed).board);
    }
  }
});

test('직접 만든 그림을 엉키게 놓기: 같은 그림은 같은 자리, 겹친 곳이 있다. 엇갈릴 수 없는 그림(모두 한 점에 모인 선)은 놓지 않는다', () => {
  const points = [
    [1, 1],
    [6, 1],
    [6, 6],
    [1, 6],
  ];
  const cycle = [
    [0, 1],
    [1, 2],
    [2, 3],
    [0, 3],
  ];
  const made = tangleMade(points, cycle);
  assert.deepEqual(tangleMade(points, cycle), made);
  assert.ok(problemsBrute(made.points, made.edges).crossings >= 1);
  assert.ok(pointsOk(made.points, 4));
  assert.equal(
    tangleMade(points, [
      [0, 1],
      [0, 2],
      [0, 3],
    ]),
    null,
  );
  assert.equal(tangleMade(points.slice(0, 3), [[0, 1], [1, 2], [0, 2]]), null, '세모는 엇갈릴 수 없다');
});

test('"더 작은 판으로": 풀 수 있는 판은 점이 더 적은 풀 수 있는 판, 풀 수 없는 판은 뼈대에서 선 하나를 뺀 판부터 뼈대와 번갈아 낸다', () => {
  let some = 0;
  for (let level = 1; level <= TOP_LEVEL; level++) {
    const mode = rungOf(level).mode;
    for (const seed of SEEDS.slice(0, 20)) {
      const { board, solution } = generateBoard(level, seed);
      const origin = { mode, board };
      const turns = [0, 1, 2, 3].map((turn) => smallerUntangle(origin, turn));
      assert.deepEqual(smallerUntangle(origin, 0), turns[0], '같은 판, 같은 차례에는 같은 작은 판');
      if (!turns[0]) continue;
      some += 1;
      const n = board.points.length;
      turns.forEach((small, turn) => {
        const where = `${level}단계 ${seed}번 ${turn}`;
        assert.equal(checkBoard(small.board), null, where);
        const m = small.board.points.length;
        assert.ok(m < n || small.board.edges.length < board.edges.length, where);
        assert.ok(problemsBrute(small.board.points, small.board.edges).crossings >= 1, where);
        const planar = proven(small.board, where);
        if (mode === 'record') {
          assert.equal(fewestRemovals(m, small.board.edges).best, 1, where);
          assert.ok(fewestRemovals(n, board.edges).best >= 2, where);
        } else if (solution.possible) assert.ok(planar || small.board.bridges > 0, where);
        else assert.equal(planar, turn % 2 === 0 || smallBoards(origin).no.length === 0, where);
        if (board.roles) assert.equal(small.board.roles.includes('house'), board.roles.includes('house'), where);
      });
    }
  }
  assert.ok(some >= 60, String(some));
  // 점 다섯을 모두 잇는 그림 그대로면 점 넷을 모두 잇는 그림, 열 점의 그림이면 집 셋과 우물 셋에서 선 하나 뺀 것과 집 셋과 우물 셋
  const k5 = smallerUntangle({ mode: 'mix', board: generateBoard(3, 1).board }, 0).board;
  assert.deepEqual([k5.points.length, k5.edges.length], [4, 6]);
  const petersen = { mode: 'mix', board: { points: Array.from({ length: 10 }, (_, v) => [2 * v + 1, v % 2 === 0 ? 2 : 9]), edges: NAMED.petersen.edges, roles: null, bridges: 0 } };
  assert.deepEqual([0, 1].map((turn) => [smallerUntangle(petersen, turn).board.points.length, smallerUntangle(petersen, turn).board.edges.length]), [
    [6, 8],
    [6, 9],
  ]);
  // 점이 넷인 풀 수 있는 그림과 마을 넷은 더 줄이지 않는다
  assert.equal(smallerUntangle({ mode: 'untangle', board: { points: [[1, 1], [6, 1], [6, 6], [1, 6]], edges: [[0, 1], [0, 2], [1, 3], [2, 3]], roles: null, bridges: 0 } }, 0), null);
  assert.equal(smallerUntangle({ mode: 'story', board: generateBoard(4, 5).board }, 0), null);
  assert.equal(smallerUntangle({ mode: 'record', board: generateBoard(5, 1).board }, 0), null, '하나만 빼면 되는 그림은 더 줄이지 않는다');
  assert.ok(sameGraph(generateBoard(4, 5).board.roles, ['town', 'town', 'town', 'town']));
});
