// 조건 맞춰 잇기의 규칙과 풀이 프로그램 점검. 되는지 안 되는지, 안 되는 까닭, 모든 경우의 나무를 다른 방법(모든 선 묶음을 해 보기, 에르되시-갈라이 조건)으로 따져 견준다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DOT, DOT_HIT, LINE_HIT, bigPoints, caseTree, casesNow, checkBoard, choose, degreesOf, hitAt, isDone, lineIndex, lineOf, linesOk, oddPoints, partnersOf, plainReasons, realize, solve, spotsOf, stateOf, sumOf } from '../src/core/degree.js';
import { allLists, bruteOk, erdosGallai, realizable, sortedLists } from './helpers/brute-degree.js';

/** 선들이 그 판의 답인가: 규칙에 맞고 모든 점이 수만큼 */
const answers = (need, lines) => linesOk(need.length, lines) && degreesOf(need.length, lines).every((value, at) => value === need[at]);

test('판의 규격: 점 3~8개, 점마다 0~9, 모두 0인 판은 아니다', () => {
  assert.equal(checkBoard({ need: [3, 3, 3, 3] }), null);
  assert.equal(checkBoard({ need: [1, 1, 0] }), null);
  assert.notEqual(checkBoard({ need: [1, 1] }), null);
  assert.notEqual(checkBoard({ need: new Array(9).fill(1) }), null);
  assert.notEqual(checkBoard({ need: [3, 3, 10, 3] }), null);
  assert.notEqual(checkBoard({ need: [3, 3, -1, 3] }), null);
  assert.notEqual(checkBoard({ need: [0, 0, 0] }), null);
  assert.notEqual(checkBoard({ need: [1.5, 1, 1] }), null);
  assert.notEqual(checkBoard(null), null);
});

test('선: 두 점이 다르고, 같은 선이 두 번 없다. 점마다 선의 수와 판의 모습', () => {
  assert.deepEqual(lineOf(3, 1), [1, 3]);
  assert.equal(linesOk(4, [[0, 1], [2, 3]]), true);
  assert.equal(linesOk(4, [[1, 1]]), false);
  assert.equal(linesOk(4, [[1, 0]]), false);
  assert.equal(linesOk(4, [[0, 1], [0, 1]]), false);
  assert.equal(linesOk(4, [[0, 4]]), false);
  assert.equal(lineIndex([[0, 1], [1, 2]], 2, 1), 1);
  assert.equal(lineIndex([[0, 1]], 2, 1), -1);
  assert.deepEqual(degreesOf(4, [[0, 1], [0, 2]]), [2, 1, 1, 0]);
  const board = { need: [1, 2, 1] };
  assert.equal(isDone(board, [[0, 1], [1, 2]]), true);
  assert.equal(isDone(board, [[0, 1]]), false);
  const state = stateOf(board, [[0, 1], [0, 2]]);
  assert.deepEqual(state.full, [2]);
  assert.deepEqual(state.over, [0]);
  assert.equal(state.ends, 4);
  assert.equal(state.done, false);
});

test('되는지는 모든 선 묶음을 해 보는 방법, 에르되시-갈라이 조건, 경우의 나무와 같다(점 3~6개, 수 0~n). 되면 실제로 이은 선이 답이다', () => {
  for (const n of [3, 4, 5, 6]) {
    const found = realizable(n);
    for (const need of allLists(n, n)) {
      const ok = found.has(need.join(','));
      const lines = realize(need);
      assert.equal(lines !== null, ok, need.join(','));
      assert.equal(erdosGallai(need), ok, need.join(','));
      if (lines) assert.ok(answers(need, lines), need.join(','));
    }
    // 경우의 나무는 차례가 없는 목록마다(차례를 바꿔도 같은 판이다) 모든 잎을 본다
    for (const need of sortedLists(n, n)) {
      const tree = caseTree(need);
      assert.equal(tree.cut, false);
      assert.equal(tree.possible, bruteOk(need), need.join(','));
      for (const leaf of tree.leaves) {
        assert.ok(linesOk(n, leaf.lines));
        if (leaf.stuck === null) assert.ok(answers(need, leaf.lines), need.join(','));
        else {
          // 막힌 점: 남은 수가 이을 수 있는 점보다 많다
          assert.ok(leaf.stuck.left > leaf.stuck.open);
          assert.deepEqual(leaf.steps.flatMap((step) => step.lines), leaf.lines);
        }
      }
    }
  }
});

test('점 7개는 모든 선 묶음(2백만 가지 남짓)을 해 보는 방법, 점 8개는 에르되시-갈라이 조건과 같다', () => {
  const found = realizable(7);
  for (const need of sortedLists(7, 7)) {
    const lines = realize(need);
    assert.equal(lines !== null, found.has(need.join(',')), need.join(','));
    if (lines) assert.ok(answers(need, lines));
  }
  for (const need of sortedLists(8, 8)) {
    const lines = realize(need);
    assert.equal(lines !== null, erdosGallai(need), need.join(','));
    if (lines) assert.ok(answers(need, lines));
  }
});

test('홀수인 점은 늘 짝수 개다: 나올 수 있는 모든 모습(점 3~7개)에서', () => {
  for (const n of [3, 4, 5, 6, 7]) {
    for (const key of realizable(n)) {
      const need = key.split(',').map(Number);
      assert.equal(oddPoints(need).length % 2, 0, key);
      assert.equal(sumOf(need) % 2, 0, key);
    }
  }
});

test('안 되는 까닭: 모두 더하면 홀수(odd), 이을 수 있는 점보다 큰 수(big), 둘 다 아닌데 안 됨(search). 판만 보고 아는 까닭이 있으면 늘 안 된다', () => {
  assert.deepEqual(plainReasons([3, 3, 3, 3, 3]), ['odd']);
  assert.deepEqual(plainReasons([4, 2, 1, 1]), ['big']);
  assert.deepEqual(plainReasons([3, 2, 1, 0]), ['big']);
  assert.deepEqual(plainReasons([4, 2, 1, 2]), ['odd', 'big']);
  assert.deepEqual(plainReasons([3, 1, 3, 1]), []);
  assert.equal(partnersOf([3, 2, 1, 0], 0), 2);
  assert.deepEqual(bigPoints([3, 2, 1, 0]), [0]);
  for (const n of [3, 4, 5, 6]) {
    for (const need of sortedLists(n, n)) {
      const result = solve({ need });
      const ok = bruteOk(need);
      assert.equal(result.possible, ok);
      if (plainReasons(need).length > 0) assert.equal(ok, false, need.join(','));
      if (ok) assert.equal(result.reason, null);
      else {
        assert.equal(result.reason, plainReasons(need)[0] ?? 'search');
        if (result.reason === 'search') assert.ok(Number.isInteger(result.leaves) && result.leaves >= 1);
      }
    }
  }
});

test('풀이 프로그램이 알려 준 것: 홀수도 큰 수도 아닌데 안 되는 판은 점 넷에 두 가지(3, 3, 1, 1과 3, 3, 3, 1)뿐이고, 점 다섯까지는 모든 경우가 한 줄기다', () => {
  const searchKinds = (n) => sortedLists(n, n - 1).filter((need) => checkBoard({ need }) === null && plainReasons(need).length === 0 && !bruteOk(need));
  assert.deepEqual(searchKinds(4), [[3, 3, 3, 1], [3, 3, 1, 1]]);
  assert.equal(searchKinds(5).length, 10);
  assert.equal(searchKinds(6).length, 49);
  for (const n of [4, 5]) for (const need of searchKinds(n)) assert.equal(caseTree(need).leaves.length, 1, need.join(','));
  // 점 여섯이면 갈래가 생기는 판이 있다(4, 4, 4, 4, 1, 1은 다섯 갈래)
  assert.equal(caseTree([4, 4, 4, 4, 1, 1]).leaves.length, 5);
  assert.equal(searchKinds(6).filter((need) => caseTree(need).leaves.length > 1).length, 4);
  // 3, 1, 3, 1: 가 점이 나머지 셋과 모두 이으면 다 점이 선 2개가 모자란다
  const [leaf] = caseTree([3, 1, 3, 1]).leaves;
  assert.deepEqual(leaf.lines, [[0, 1], [0, 2], [0, 3]]);
  assert.deepEqual(leaf.stuck, { point: 2, left: 2, open: 0 });
});

test('모든 경우 펼쳐 보기: 더 이어야 할 선이 가장 많은 점이 그 선들을 마저 잇는 방법은 모든 묶음을 해 본 것과 같다', () => {
  // 모든 묶음 해 보기: 그 점에서 새 선을 몇 개 긋든, 그 점이 꼭 맞게 되고 다른 점이 넘치지 않는 묶음
  const bruteWays = (need, lines, point) => {
    const n = need.length;
    const degrees = degreesOf(n, lines);
    const others = Array.from({ length: n }, (_, at) => at).filter((at) => at !== point && lineIndex(lines, point, at) < 0);
    let count = 0;
    for (let mask = 0; mask < 2 ** others.length; mask++) {
      const group = others.filter((_, at) => (mask >> at) & 1);
      if (degrees[point] + group.length !== need[point]) continue;
      if (group.every((at) => degrees[at] + 1 <= need[at])) count += 1;
    }
    return count;
  };
  for (const need of [[3, 3, 3, 3], [3, 1, 3, 1], [4, 4, 2, 2, 2], [2, 3, 1, 2, 2], [3, 3, 3, 3, 3, 3]]) {
    for (const lines of [[], [[0, 1]], [[0, 1], [1, 2]], [[1, 2], [2, 3], [0, 3]]]) {
      if (!linesOk(need.length, lines)) continue;
      const cases = casesNow(need, lines);
      if (cases.point < 0) continue;
      assert.equal(cases.ways.length, bruteWays(need, lines, cases.point), `${need} ${JSON.stringify(lines)}`);
      for (const way of cases.ways) assert.equal(way.length, cases.left);
    }
  }
  // 3, 1, 3, 1: 처음에는 한 가지, 그대로 그으면 다 점은 이을 점이 없다
  assert.equal(casesNow([3, 1, 3, 1], []).ways.length, 1);
  assert.deepEqual(casesNow([3, 1, 3, 1], [[0, 1], [0, 2], [0, 3]]), { point: 2, left: 2, open: 0, ways: [] });
  // 다 이었으면 점이 없다
  assert.equal(casesNow([1, 1, 0], [[0, 1]]).point, -1);
  assert.equal(choose([1, 2, 3, 4], 2).length, 6);
});

test('누른 자리: 점이 먼저(넓게), 아니면 가까운 선(넓게). 점은 동그라미 위에 고르게 놓인다', () => {
  const spots = spotsOf(4);
  assert.equal(spots.length, 4);
  // 맨 위의 두 점은 높이가 같다(위의 변이 반듯하다)
  assert.ok(Math.abs(spots[0][1] - spots[1][1]) < 1e-6);
  assert.deepEqual(hitAt(4, [], spots[2]), { point: 2 });
  assert.deepEqual(hitAt(4, [], [spots[2][0] + DOT_HIT - 1, spots[2][1]]), { point: 2 });
  const lines = [[0, 2], [1, 3]];
  // 두 선이 만나는 가운데는 선이다(먼저 나온 선)
  assert.ok('line' in hitAt(4, lines, [0, 0]));
  const mid = [(spots[0][0] + spots[2][0]) / 2 + 10, (spots[0][1] + spots[2][1]) / 2 + 10];
  assert.equal(hitAt(4, [[0, 2]], mid)?.line, 0);
  assert.equal(hitAt(4, [], [0, 0]), null);
  assert.ok(LINE_HIT >= 30 && DOT_HIT >= DOT + 20);
});
