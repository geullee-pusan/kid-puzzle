// 한붓그리기의 그림 만들어 내기. 모든 단계에서 판 번호 1~300을 만들어 조건을 확인하고, 분포를 적는다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { IMPOSSIBLE_RATE, LADDER, MAKE_LEVEL, MAKE_POINTS, TOP_LEVEL, generateBoard, nextSeed, rungOf, tooPlain } from '../src/core/trace-ladder.js';
import { applyEdit, canAddEdge, checkFigure, degreesOf, editsOf, isTidy, pieceCount, solve, walk } from '../src/core/trace.js';
import { bruteStarts } from './helpers/brute.js';

const SEEDS = Array.from({ length: 300 }, (_, index) => index + 1);
const rungs = LADDER.filter((rung) => rung.mode !== 'make');
const editText = (edit) => `${edit.type}:${edit.edge.join('-')}`;

/** 수를 세어 "값:개수" 꼴로 적는다 */
function tally(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([value, count]) => `${value}:${count}`)
    .join(' ');
}

test('사다리는 1단계부터 5단계까지이고, 맨 위는 직접 만들기다', () => {
  assert.deepEqual(LADDER.map((rung) => rung.level), [1, 2, 3, 4, 5]);
  assert.deepEqual(LADDER.map((rung) => rung.tag), ['basic', 'applied', 'applied', 'challenge', 'challenge']);
  assert.deepEqual(LADDER.map((rung) => rung.mode), ['draw', 'judge', 'start', 'fix', 'make']);
  assert.equal(TOP_LEVEL, 4);
  assert.equal(MAKE_LEVEL, 5);
  assert.throws(() => rungOf(6));
  assert.throws(() => generateBoard(MAKE_LEVEL, 1));
});

test('기획 문서의 표와 같다: 1단계는 점 4~6개, 2단계는 점 6~8개, 안 되는 그림은 1·2단계에만 섞는다', () => {
  assert.deepEqual(rungOf(1).counts, [4, 5, 6]);
  assert.deepEqual(rungOf(2).counts, [6, 7, 8]);
  assert.deepEqual(rungs.map((rung) => rung.mix), [true, true, false, false]);
  // 2단계부터는 갈림길이 더 많다(선을 둘 이상 더 긋는다).
  assert.deepEqual(rungs.map((rung) => rung.extra), [[1, 3], [2, 3], [2, 3], [2, 3]]);
  assert.ok(Math.abs(IMPOSSIBLE_RATE - 1 / 3) < 1e-9);
});

for (const rung of rungs) {
  test(`${rung.level}단계: 같은 번호는 늘 같은 그림이다`, () => {
    for (const seed of SEEDS) assert.deepEqual(generateBoard(rung.level, seed), generateBoard(rung.level, seed));
  });

  test(`${rung.level}단계: 그림의 조건에 맞고, 적어 둔 답이 풀이 프로그램과도, 다 해 보는 탐색과도 같다`, () => {
    const [columns, rows] = rung.grid;
    for (const seed of SEEDS) {
      const made = generateBoard(rung.level, seed);
      const { board, solution } = made;
      const where = `${rung.level}단계 ${seed}번 ${JSON.stringify(board)}`;
      assert.equal(made.level, rung.level);
      assert.equal(made.seed, seed);
      assert.equal(checkFigure(board), null, where);
      assert.ok(rung.counts.includes(board.points.length), where);
      // 점은 격자 위의 자리에 놓인다.
      for (const [x, y] of board.points) {
        assert.ok(Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < columns && y < rows, where);
      }
      // 한 덩어리이고, 점마다 선이 하나 이상 있다.
      assert.equal(pieceCount(board), 1, where);
      assert.ok(degreesOf(board).every((degree) => degree >= 1), where);
      // 선이 다른 점 위를 지나지 않고, 선끼리 엇갈리지 않는다.
      assert.ok(isTidy(board), where);
      // 뻔한 그림이 아니다: 선이 다섯 개 이상(점의 수 이상)이고 갈림길이 있다.
      assert.equal(tooPlain(board), false, where);
      assert.ok(board.edges.length >= Math.max(5, board.points.length), where);
      assert.ok(Math.max(...degreesOf(board)) >= 3, where);

      // 적어 둔 답을 새로 풀어서 견주고, 다 해 보는 탐색과도 견준다.
      assert.deepEqual(solution, solve(board), where);
      const brute = bruteStarts(board);
      assert.equal(solution.possible, brute.length > 0, where);
      assert.deepEqual(solution.starts, brute, where);
      if (solution.possible) {
        const state = walk(board, solution.path);
        assert.ok(state.ok && state.complete, where);
        assert.ok(solution.starts.includes(solution.path[0]), where);
      }
    }
  });
}

const share = (level) => SEEDS.filter((seed) => !generateBoard(level, seed).solution.possible).length / SEEDS.length;

test('1단계와 2단계: 셋에 하나쯤이 안 되는 그림이다', () => {
  for (const level of [1, 2]) {
    const rate = share(level);
    assert.ok(rate > 0.25 && rate < 0.42, `${level}단계: ${rate}`);
  }
});

test('3단계: 모두 되는 그림이고, 시작할 수 있는 점이 꼭 둘이다', () => {
  for (const seed of SEEDS) {
    const { board, solution } = generateBoard(3, seed);
    assert.equal(solution.possible, true);
    assert.equal(solution.starts.length, 2, `${seed}번`);
    assert.deepEqual(bruteStarts(board), solution.starts);
    assert.ok(solution.starts.length < board.points.length);
  }
});

test('4단계: 모두 안 되는 그림이고, 선 하나를 더하거나 빼서 고칠 방법이 하나 이상 있다(다 해 보는 탐색으로 확인)', () => {
  for (const seed of SEEDS) {
    const { board, solution, fixes } = generateBoard(4, seed);
    const where = `${seed}번 ${JSON.stringify(board)}`;
    assert.equal(solution.possible, false, where);
    assert.equal(solution.pieces, 1, where);
    assert.ok(fixes.length >= 1, where);
    // 풀이 프로그램이 찾은 고치는 방법과, 고칠 수 있는 자리를 모두 다 해 본 결과가 같다.
    const brute = editsOf(board).filter((edit) => bruteStarts(applyEdit(board, edit)).length > 0);
    assert.deepEqual(fixes.map(editText), brute.map(editText), where);
    for (const edit of fixes) {
      if (edit.type === 'add') assert.equal(canAddEdge(board, edit.edge[0], edit.edge[1]), null, where);
      const fixed = applyEdit(board, edit);
      assert.equal(pieceCount(fixed), 1, `고친 그림은 한 덩어리다: ${where}`);
      assert.ok(isTidy(fixed), where);
    }
  }
});

test('단계마다 점의 수가 골고루 나온다(후보가 모두 나온다)', () => {
  for (const rung of rungs) {
    const seen = new Set(SEEDS.map((seed) => generateBoard(rung.level, seed).board.points.length));
    assert.deepEqual([...seen].sort(), [...rung.counts].sort(), `${rung.level}단계`);
  }
});

test('같은 그림이 되풀이해서 나오지 않는다(300개 가운데 270개 이상이 서로 다른 그림)', () => {
  for (const rung of rungs) {
    const seen = new Set(SEEDS.map((seed) => JSON.stringify(generateBoard(rung.level, seed).board)));
    assert.ok(seen.size >= 270, `${rung.level}단계: ${seen.size}`);
  }
});

test('판 번호 1~300의 분포(보고용으로 적어 둔다)', (t) => {
  for (const rung of rungs) {
    const made = SEEDS.map((seed) => generateBoard(rung.level, seed));
    const possible = made.filter((item) => item.solution.possible).length;
    const lines = [
      `${rung.level}단계(${rung.mode}): 되는 그림 ${possible}, 안 되는 그림 ${made.length - possible}`,
      `  점의 수 ${tally(made.map((item) => item.board.points.length))}`,
      `  선의 수 ${tally(made.map((item) => item.board.edges.length))}`,
      `  선이 홀수 개 모인 점의 수 ${tally(made.map((item) => item.solution.odd.length))}`,
    ];
    if (rung.mode === 'fix') lines.push(`  고치는 방법의 수 ${tally(made.map((item) => item.fixes.length))}`);
    for (const line of lines) t.diagnostic(line);
    // 한 덩어리로 잇는 선(점의 수 - 1)에, 단계마다 정한 만큼 선을 더 긋는다.
    for (const { board } of made) {
      const extra = board.edges.length - (board.points.length - 1);
      assert.ok(extra >= rung.extra[0] && extra <= rung.extra[1], `${rung.level}단계: 더 그은 선 ${extra}개`);
    }
  }
});

test('작은 그림: 그 단계에서 점이 적은 그림(가장 적은 수와 그다음 수)을 낸다', () => {
  for (const rung of rungs) {
    const allowed = rung.counts.slice(0, 2);
    for (const seed of SEEDS.slice(0, 120)) {
      const made = generateBoard(rung.level, seed, { small: true });
      assert.equal(made.small, true);
      assert.ok(allowed.includes(made.board.points.length), `${rung.level}단계 ${seed}번`);
      assert.deepEqual(made.solution, solve(made.board));
      assert.deepEqual(made, generateBoard(rung.level, seed, { small: true }));
      assert.ok(isTidy(made.board));
      if (rung.mode === 'start') assert.equal(made.solution.starts.length, 2);
      if (rung.mode === 'fix') assert.ok(!made.solution.possible && made.fixes.length >= 1);
    }
  }
});

test('다음 판 번호: 방금 한 그림과 다른 그림이 나온다', () => {
  for (const rung of rungs) {
    for (const seed of SEEDS.slice(0, 120)) {
      const next = nextSeed(rung.level, seed);
      assert.ok(next > seed);
      assert.notDeepEqual(generateBoard(rung.level, next).board, generateBoard(rung.level, seed).board, `${rung.level}단계 ${seed}번`);
    }
  }
});

test('직접 만들기의 점 여섯 개: 어느 두 점이든 선으로 이을 수 있다(다른 점 위를 지나지 않는다)', () => {
  assert.equal(MAKE_POINTS.length, 6);
  const empty = { points: MAKE_POINTS, edges: [] };
  assert.equal(checkFigure(empty, { allowEmpty: true }), null);
  for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) assert.equal(canAddEdge(empty, a, b), null, `${a}-${b}`);
  // 여섯 점으로 안 되는 그림도, 되는 그림도 만들 수 있다.
  const ring = { points: MAKE_POINTS, edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [0, 5]] };
  assert.equal(solve(ring).possible, true);
  const fan = { points: MAKE_POINTS, edges: [...ring.edges, [0, 2], [0, 3], [0, 4]] };
  assert.ok(isTidy(fan));
  assert.equal(solve(fan).possible, false);
  assert.deepEqual(bruteStarts(fan), []);
});
