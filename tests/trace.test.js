// 한붓그리기의 풀이 프로그램. 다른 방법(모든 차례를 다 해 보는 탐색)과 견줘서 확인한다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MAX_PARALLEL,
  MAX_POINTS,
  NEAR,
  applyEdit,
  canAddEdge,
  checkFigure,
  crossesEdge,
  degreesOf,
  diagnose,
  distanceToSegment,
  edgeIndex,
  editsOf,
  fixesOf,
  isTidy,
  passesPoint,
  pieceCount,
  segmentsMeet,
  sideOf,
  solve,
  strokePlan,
  walk,
  walkStrokes,
} from '../src/core/trace.js';
import { bruteStarts } from './helpers/brute.js';

/** 점 n개를 한 줄로 늘어놓은 자리(자리는 풀이와 상관없다) */
const lineUp = (n) => Array.from({ length: n }, (_, index) => [index, 0]);

/** 점 n개 사이에 그을 수 있는 모든 선 */
function allPairs(n) {
  const pairs = [];
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) pairs.push([a, b]);
  return pairs;
}

/** 길이 규칙에 맞고 모든 선을 한 번씩 지나는가 */
function isFullTrail(figure, path) {
  const state = walk(figure, path);
  return state.ok && state.complete;
}

const square = { points: [[0, 0], [1, 0], [0, 1], [1, 1]], edges: [[0, 1], [0, 2], [1, 3], [2, 3]] };
const squareWithDiagonal = { points: square.points, edges: [...square.edges, [0, 3]] };
const spokes = { points: [[1, 1], [0, 0], [2, 0], [1, 2]], edges: [[0, 1], [0, 2], [0, 3]] };

test('그림의 규격을 확인한다', () => {
  assert.equal(checkFigure(square), null);
  assert.equal(checkFigure(null), 'no-figure');
  assert.equal(checkFigure({ points: [[0, 0]], edges: [] }), 'bad-points');
  assert.equal(checkFigure({ points: [[0, 0], [0, 0]], edges: [[0, 1]] }), 'bad-points');
  assert.equal(checkFigure({ points: [[0, 0], [1, 'x']], edges: [[0, 1]] }), 'bad-points');
  assert.equal(checkFigure({ points: lineUp(MAX_POINTS + 1), edges: [[0, 1]] }), 'bad-points');
  assert.equal(checkFigure({ points: lineUp(3), edges: [[0, 3]] }), 'bad-edges');
  assert.equal(checkFigure({ points: lineUp(3), edges: [[1, 1]] }), 'bad-edges');
  assert.equal(checkFigure({ points: lineUp(3), edges: [[0, 1], [1, 0]] }), 'bad-edges', '같은 두 점 사이에 선은 하나');
  assert.equal(checkFigure({ points: lineUp(3), edges: [[0, 1.5]] }), 'bad-edges');
  assert.equal(checkFigure({ points: lineUp(3), edges: [] }), 'no-edges');
  assert.equal(checkFigure({ points: lineUp(3), edges: [] }, { allowEmpty: true }), null);
  assert.throws(() => solve({ points: lineUp(3), edges: [] }));
});

test('손으로 확인할 수 있는 그림: 네모는 어디서든 되고, 대각선을 그으면 두 점에서만 되고, 세 갈래는 안 된다', () => {
  const ring = solve(square);
  assert.equal(ring.possible, true);
  assert.deepEqual(ring.starts, [0, 1, 2, 3]);
  assert.deepEqual(ring.odd, []);
  assert.ok(isFullTrail(square, ring.path));
  assert.equal(ring.path[0], ring.path.at(-1), '시작한 점으로 돌아온다');

  const two = solve(squareWithDiagonal);
  assert.equal(two.possible, true);
  assert.deepEqual(two.starts, [0, 3]);
  assert.deepEqual(two.odd, [0, 3]);
  assert.ok(isFullTrail(squareWithDiagonal, two.path));
  assert.deepEqual([two.path[0], two.path.at(-1)], [0, 3], '한 점에서 시작해서 다른 점에서 끝난다');

  const none = solve(spokes);
  assert.equal(none.possible, false);
  assert.deepEqual(none.starts, []);
  assert.deepEqual(none.path, []);
  assert.deepEqual(none.odd, [0, 1, 2, 3]);
  assert.deepEqual(degreesOf(spokes), [3, 1, 1, 1]);
});

test('두 덩어리로 나뉜 그림은 안 된다. 선이 없는 점은 덩어리로 세지 않는다', () => {
  const apart = { points: lineUp(4), edges: [[0, 1], [2, 3]] };
  assert.equal(pieceCount(apart), 2);
  assert.equal(solve(apart).possible, false);
  assert.deepEqual(bruteStarts(apart), []);
  const lonely = { points: lineUp(4), edges: [[0, 1], [1, 2]] };
  assert.equal(pieceCount(lonely), 1);
  assert.equal(solve(lonely).possible, true);
  assert.deepEqual(solve(lonely).starts, [0, 2]);
});

for (const n of [2, 3, 4, 5]) {
  test(`점 ${n}개로 만들 수 있는 모든 그림에서 풀이 프로그램과 다 해 보는 탐색의 결과가 같다`, () => {
    const pairs = allPairs(n);
    let count = 0;
    let possible = 0;
    for (let mask = 1; mask < 1 << pairs.length; mask++) {
      const figure = { points: lineUp(n), edges: pairs.filter((_, index) => (mask >> index) & 1) };
      const result = solve(figure);
      const brute = bruteStarts(figure);
      assert.equal(result.possible, brute.length > 0, JSON.stringify(figure.edges));
      assert.deepEqual(result.starts, brute, JSON.stringify(figure.edges));
      if (result.possible) {
        assert.ok(isFullTrail(figure, result.path), JSON.stringify(figure.edges));
        assert.equal(result.path[0], result.starts[0]);
        possible += 1;
      }
      count += 1;
    }
    assert.equal(count, (1 << pairs.length) - 1);
    assert.ok(possible > 0 && (n < 4 || possible < count));
  });
}

test('점 6개에 선이 9개까지인 모든 그림에서 풀이 프로그램과 다 해 보는 탐색의 결과가 같다', () => {
  const pairs = allPairs(6);
  let count = 0;
  for (let mask = 1; mask < 1 << pairs.length; mask++) {
    const edges = pairs.filter((_, index) => (mask >> index) & 1);
    if (edges.length > 9) continue;
    const figure = { points: lineUp(6), edges };
    const result = solve(figure);
    assert.deepEqual(result.starts, bruteStarts(figure), JSON.stringify(edges));
    if (result.possible) assert.ok(isFullTrail(figure, result.path), JSON.stringify(edges));
    count += 1;
  }
  assert.equal(count, 27823, '선이 1~9개인 그림의 수');
});

test('긋기: 이어진 선만, 같은 선은 한 번만. 막힘과 끝남을 알아본다', () => {
  const start = walk(squareWithDiagonal, []);
  assert.deepEqual(start, { ok: true, used: [], at: null, left: 5, open: [0, 1, 2, 3], stuck: false, complete: false });
  const one = walk(squareWithDiagonal, [0]);
  assert.deepEqual(one.open, [1, 2, 3]);
  assert.equal(one.at, 0);
  // 1번 점에서 시작하면: 1 → 0 → 3 → 1 에서 더 갈 선이 없는데 선이 남는다.
  const stuck = walk(squareWithDiagonal, [1, 0, 3, 1]);
  assert.equal(stuck.ok, true);
  assert.equal(stuck.stuck, true);
  assert.equal(stuck.left, 2);
  assert.deepEqual(stuck.open, []);
  const done = walk(squareWithDiagonal, [0, 1, 3, 0, 2, 3]);
  assert.equal(done.complete, true);
  assert.equal(done.stuck, false);
  assert.equal(done.left, 0);
  assert.deepEqual(done.used, [0, 2, 4, 1, 3]);
  // 규칙에 맞지 않는 길
  assert.equal(walk(squareWithDiagonal, [1, 2]).ok, false, '이어지지 않은 점');
  assert.equal(walk(squareWithDiagonal, [0, 1, 0]).ok, false, '같은 선을 두 번');
  assert.equal(walk(squareWithDiagonal, [9]).ok, false);
  assert.equal(walk(squareWithDiagonal, 'x').ok, false);
  // 선이 없는 점에서는 시작할 수 없다.
  assert.deepEqual(walk({ points: lineUp(3), edges: [[0, 1]] }, []).open, [0, 1]);
});

test('선의 자리: 엇갈리는 선과 다른 점 위를 지나는 선을 알아본다', () => {
  assert.equal(segmentsMeet([0, 0], [2, 2], [0, 2], [2, 0]), true, '가위표');
  assert.equal(segmentsMeet([0, 0], [1, 0], [0, 1], [1, 1]), false, '나란한 선');
  assert.equal(segmentsMeet([0, 0], [2, 0], [1, 0], [1, 1]), true, '한 선의 끝이 다른 선 위에 닿는다');
  assert.equal(segmentsMeet([0, 0], [1, 0], [2, 0], [3, 0]), false, '한 줄 위에 떨어져 있다');
  assert.equal(segmentsMeet([0, 0], [2, 0], [1, 0], [3, 0]), true, '한 줄 위에서 겹친다');
  assert.ok(Math.abs(distanceToSegment([1, 1], [0, 0], [2, 0]) - 1) < 1e-9);
  assert.ok(Math.abs(distanceToSegment([3, 0], [0, 0], [2, 0]) - 1) < 1e-9);
  assert.ok(NEAR > 0.45 && NEAR < 0.7, '비스듬한 선이 옆 칸의 점을 스치면(거리 0.45) 안 되고, 한 칸 떨어져 지나가면(거리 0.7) 된다');

  const points = [[0, 0], [1, 0], [2, 0], [0, 2], [2, 2]];
  assert.equal(passesPoint(points, 0, 2), true, '가운데 점 위를 지난다');
  assert.equal(passesPoint(points, 0, 1), false);
  assert.equal(passesPoint(points, 0, 4), false, '대각선은 다른 점에서 멀다');
  assert.equal(passesPoint([[0, 0], [1, 0], [2, 1]], 0, 2), true, '가로 2 세로 1인 선이 옆 칸의 점을 스친다');
  assert.equal(passesPoint([[0, 0], [2, 0], [2, 1]], 0, 2), false, '옆 칸에 점이 없으면 가로 2 세로 1인 선도 된다');
  const figure = { points, edges: [[1, 3]] };
  assert.equal(crossesEdge(figure, 0, 4), true);
  assert.equal(crossesEdge(figure, 1, 4), false, '한 끝을 같이 쓰는 선은 엇갈리지 않는다');
  assert.equal(canAddEdge(figure, 0, 0), 'same');
  assert.equal(canAddEdge(figure, 3, 1), 'exists');
  assert.equal(canAddEdge(figure, 0, 2), 'over-point');
  assert.equal(canAddEdge(figure, 0, 4), 'crossing');
  assert.equal(canAddEdge(figure, 1, 4), null);
  assert.equal(isTidy(figure), true);
  assert.equal(isTidy({ points, edges: [[1, 3], [0, 4]] }), false);
  assert.equal(isTidy({ points, edges: [[0, 2]] }), false);
});

test('그림 고치기: 선 하나를 더하거나 뺀 새 그림을 돌려주고, 원래 그림은 그대로 둔다', () => {
  const before = JSON.stringify(square);
  const added = applyEdit(square, { type: 'add', edge: [3, 0] });
  assert.deepEqual(added.edges, [[0, 1], [0, 2], [0, 3], [1, 3], [2, 3]]);
  const removed = applyEdit(square, { type: 'remove', edge: [3, 1] });
  assert.deepEqual(removed.edges, [[0, 1], [0, 2], [2, 3]]);
  assert.equal(JSON.stringify(square), before);
  assert.throws(() => applyEdit(square, { type: 'add', edge: [0, 1] }));
  assert.throws(() => applyEdit(square, { type: 'remove', edge: [0, 3] }));
  assert.throws(() => applyEdit(square, { type: 'bend', edge: [0, 3] }));
  assert.equal(edgeIndex(square, 3, 1), 2);
  assert.equal(edgeIndex(square, 0, 3), -1);
});

test('고치는 방법: 풀이 프로그램이 찾은 것이 다 해 보는 탐색으로도 맞고, 빠뜨린 것이 없다', () => {
  // 네모의 네 귀퉁이와 가운데 점. 귀퉁이마다 선이 3개씩 모여 있어서 안 된다.
  const wheel = { points: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], edges: [[0, 1], [0, 2], [0, 3], [1, 2], [1, 4], [2, 3], [2, 4], [3, 4]] };
  assert.equal(solve(wheel).possible, false);
  const fixes = fixesOf(wheel);
  const text = fixes.map((edit) => `${edit.type}:${edit.edge.join('-')}`);
  assert.deepEqual(text, ['remove:0-1', 'remove:0-3', 'remove:1-4', 'remove:3-4'], '바깥 선 하나를 빼면 된다. 더할 수 있는 선은 없다');
  for (const figure of [wheel, spokes, squareWithDiagonal, { points: lineUp(4), edges: [[0, 1], [2, 3]] }]) {
    const found = fixesOf(figure).map((edit) => `${edit.type}:${edit.edge.join('-')}`);
    const brute = editsOf(figure)
      .filter((edit) => {
        const fixed = applyEdit(figure, edit);
        return fixed.edges.length > 0 && bruteStarts(fixed).length > 0;
      })
      .map((edit) => `${edit.type}:${edit.edge.join('-')}`);
    assert.deepEqual(found, brute);
  }
  // 세 갈래: 갈래 하나를 떼면 된다. 떨어져 나온 점은 선이 없으니 덩어리로 세지 않는다.
  assert.equal(fixesOf(spokes).filter((edit) => edit.type === 'remove').length, 3);
  // 고칠 수 있는 자리만 낸다: 다른 점 위를 지나거나 엇갈리는 선은 더할 수 없다.
  for (const edit of editsOf(wheel)) if (edit.type === 'add') assert.equal(canAddEdge(wheel, edit.edge[0], edit.edge[1]), null);
});

test('오답 짐작: 되는 그림에 "불가능해요"', () => {
  const figure = squareWithDiagonal; // 0번과 3번 점에서만 된다
  assert.deepEqual(diagnose('draw', figure, { kind: 'impossible' }, { startsTried: [], strokes: 0 }), { correct: false, guess: 'impossible-no-try' });
  assert.deepEqual(diagnose('draw', figure, { kind: 'impossible' }), { correct: false, guess: 'impossible-no-try' });
  assert.deepEqual(diagnose('draw', figure, { kind: 'impossible' }, { startsTried: [1, 2], strokes: 5 }), { correct: false, guess: 'impossible-untried-start' });
  assert.deepEqual(diagnose('draw', figure, { kind: 'impossible' }, { startsTried: [1, 3], strokes: 5 }), { correct: false, guess: 'impossible-other-route' });
  assert.deepEqual(diagnose('draw', spokes, { kind: 'impossible' }, { startsTried: [0], strokes: 1 }), { correct: true, guess: null });
  assert.deepEqual(diagnose('draw', figure, { kind: 'traced' }), { correct: true, guess: null });
});

test('오답 짐작: 긋지 않고 가리기, 시작점 고르기, 고치기', () => {
  assert.deepEqual(diagnose('judge', squareWithDiagonal, { kind: 'judge', value: true }), { correct: true, guess: null });
  assert.deepEqual(diagnose('judge', squareWithDiagonal, { kind: 'judge', value: false }), { correct: false, guess: 'judge-no-on-possible' });
  assert.deepEqual(diagnose('judge', spokes, { kind: 'judge', value: true }), { correct: false, guess: 'judge-yes-on-impossible' });
  assert.deepEqual(diagnose('judge', spokes, { kind: 'judge', value: false }), { correct: true, guess: null });

  assert.deepEqual(diagnose('start', squareWithDiagonal, { kind: 'start', point: 3 }), { correct: true, guess: null });
  assert.deepEqual(diagnose('start', squareWithDiagonal, { kind: 'start', point: 1 }), { correct: false, guess: 'start-wrong' });

  const wheel = { points: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], edges: [[0, 1], [0, 2], [0, 3], [1, 2], [1, 4], [2, 3], [2, 4], [3, 4]] };
  assert.deepEqual(diagnose('fix', wheel, { kind: 'fix', edit: { type: 'remove', edge: [0, 1] } }), { correct: true, guess: null });
  assert.deepEqual(diagnose('fix', wheel, { kind: 'fix', edit: { type: 'remove', edge: [0, 2] } }), { correct: false, guess: 'fix-still-impossible' });
  // 다리 하나로 이어진 두 세모: 다리를 빼면 두 덩어리가 된다.
  const bridge = { points: [[0, 0], [0, 2], [1, 1], [2, 1], [3, 0], [3, 2]], edges: [[0, 1], [0, 2], [1, 2], [2, 3], [3, 4], [3, 5], [4, 5]] };
  assert.deepEqual(diagnose('fix', bridge, { kind: 'fix', edit: { type: 'remove', edge: [2, 3] } }), { correct: false, guess: 'fix-split' });

  assert.throws(() => diagnose('judge', spokes, { kind: 'start', point: 0 }));
  assert.throws(() => diagnose('draw', spokes, { kind: 'number', value: 3 }));
});

test('다리 판: 같은 두 점 사이의 선은 multi일 때만 MAX_PARALLEL개까지 받고, 긋기는 아직 긋지 않은 다리를 하나씩 쓴다', () => {
  const twice = { points: lineUp(3), edges: [[0, 1], [0, 1], [1, 2]] };
  assert.equal(checkFigure(twice), 'bad-edges', 'multi가 아니면 같은 두 점 사이에 선은 하나');
  const bridges = { ...twice, multi: true };
  assert.equal(checkFigure(bridges), null);
  assert.equal(checkFigure({ ...bridges, multi: 'yes' }), 'bad-edges');
  assert.equal(checkFigure({ points: lineUp(2), edges: Array.from({ length: MAX_PARALLEL + 1 }, () => [0, 1]), multi: true }), 'bad-edges');
  // 0 → 1 → 0 → 1 → 2: 0과 1 사이의 두 다리를 차례로 건넌다.
  const state = walk(bridges, [0, 1, 0]);
  assert.deepEqual(state.used, [0, 1]);
  assert.deepEqual(state.open, []);
  assert.equal(state.stuck, true);
  const done = walk(bridges, [2, 1, 0, 1]);
  assert.equal(done.complete, true);
  assert.equal(walk(bridges, [0, 1, 0, 1]).ok, false, '세 번째 다리는 없다');
  assert.deepEqual(solve(bridges).starts, bruteStarts(bridges));
  assert.deepEqual(solve(bridges).starts, [1, 2]);
});

test('여러 번에 나눠 긋기: 획마다 따라가고, 펜을 뗀 횟수와 선마다의 획을 센다', () => {
  // 세 갈래: 가운데 0번 점에서 1, 2, 3번 점으로
  assert.deepEqual(walkStrokes(spokes, []), { ok: true, used: [], strokeOf: [null, null, null], at: null, left: 3, open: [0, 1, 2, 3], stuck: false, complete: false, lifts: 0 });
  const one = walkStrokes(spokes, [[1, 0, 2]]);
  assert.equal(one.at, 2);
  assert.equal(one.stuck, true, '2번 점에서는 더 갈 선이 없다');
  assert.equal(one.lifts, 0);
  const lifted = walkStrokes(spokes, [[1, 0, 2], []]);
  assert.equal(lifted.at, null);
  assert.deepEqual(lifted.open, [0, 3], '펜을 떼면 아직 긋지 않은 선이 있는 점에만 댈 수 있다');
  assert.equal(lifted.lifts, 1);
  const done = walkStrokes(spokes, [[1, 0, 2], [3, 0]]);
  assert.equal(done.complete, true);
  assert.deepEqual(done.strokeOf, [0, 0, 1]);
  assert.equal(done.lifts, 1);
  // 규칙에 맞지 않는 것: 앞의 획이 비었거나, 이어지지 않은 점, 같은 선을 두 번
  assert.equal(walkStrokes(spokes, [[], [1, 0]]).ok, false);
  assert.equal(walkStrokes(spokes, [[1, 2]]).ok, false);
  assert.equal(walkStrokes(spokes, [[1, 0], [0, 1]]).ok, false);
  assert.equal(walkStrokes(spokes, 'x').ok, false);
  assert.deepEqual(strokePlan(spokes).strokes, 2);
});

test('닮은 두 그림: 한쪽만 떼어 내고, 두 그림을 잇는 선은 받지 않는다. 고른 쪽이 되는지로 답을 견준다', () => {
  const pair = { points: [...square.points, ...spokes.points.map(([x, y]) => [x + 3, y])], edges: [...square.edges, ...spokes.edges.map(([a, b]) => [a + 4, b + 4])], split: 4 };
  assert.equal(checkFigure(pair), null);
  assert.deepEqual(sideOf(pair, 'left'), square);
  assert.deepEqual(sideOf(pair, 'right').edges, spokes.edges);
  assert.equal(checkFigure({ ...pair, edges: [...pair.edges, [0, 4]] }), 'bad-edges');
  assert.equal(checkFigure({ ...pair, split: 1 }), 'bad-points');
  assert.deepEqual(diagnose('twin', pair, { kind: 'twin', side: 'left' }), { correct: true, guess: null });
  assert.deepEqual(diagnose('twin', pair, { kind: 'twin', side: 'right' }), { correct: false, guess: 'twin-wrong' });
});
