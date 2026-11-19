// 한붓그리기의 그림 만들어 내기. 모든 단계에서 판 번호 1~300을 만들어 조건을 확인하고, 분포를 적는다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  IMPOSSIBLE_RATE,
  LADDER,
  MAKE_LEVEL,
  MAKE_POINTS,
  MAX_BRIDGES_AT,
  OLD_MAKE_LEVEL,
  THREE_RATE,
  TOP_LEVEL,
  TWIN_GAP,
  doubledPairs,
  famousShape,
  generateBoard,
  nextSeed,
  plainBridges,
  rungOf,
  tooPlain,
  twinAnswer,
} from '../src/core/trace-ladder.js';
import { MAX_PARALLEL, applyEdit, canAddEdge, checkFigure, degreesOf, editsOf, isTidy, pieceCount, sideOf, solve, strokePlan, walk, walkStrokes } from '../src/core/trace.js';
import { bruteStarts } from './helpers/brute.js';
import { bruteMinStrokes } from './helpers/brute-trace.js';

const SEEDS = Array.from({ length: 300 }, (_, index) => index + 1);
const rungs = LADDER.filter((rung) => rung.mode !== 'make');
const editText = (edit) => `${edit.type}:${edit.edge.join('-')}`;
/** 그림의 조각들: 닮은 두 그림은 두 그림, 나머지는 그림 하나. 오른쪽 그림은 격자 자리로 되돌린다 */
function partsOf(board, rung) {
  if (rung.mode !== 'twin') return [board];
  const right = sideOf(board, 'right');
  const shift = rung.grid[0] + TWIN_GAP;
  return [sideOf(board, 'left'), { points: right.points.map(([x, y]) => [x - shift, y]), edges: right.edges }];
}

/** 수를 세어 "값:개수" 꼴로 적는다 */
function tally(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([value, count]) => `${value}:${count}`)
    .join(' ');
}

test('사다리는 1단계부터 8단계까지이고, 맨 위는 직접 만들기다(5~7단계는 직접 만들기 앞에 더했다)', () => {
  assert.deepEqual(LADDER.map((rung) => rung.level), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(LADDER.map((rung) => rung.tag), ['basic', 'applied', 'applied', 'challenge', 'applied', 'challenge', 'applied', 'challenge']);
  assert.deepEqual(LADDER.map((rung) => rung.mode), ['draw', 'judge', 'start', 'fix', 'pen', 'bridge', 'twin', 'make']);
  // 1~4단계의 번호는 그대로이고, 직접 만들기는 5단계에서 8단계로 옮겼다(예전 번호는 OLD_MAKE_LEVEL로 받는다).
  assert.deepEqual([TOP_LEVEL, MAKE_LEVEL, OLD_MAKE_LEVEL], [7, 8, 5]);
  assert.throws(() => rungOf(9));
  assert.throws(() => generateBoard(MAKE_LEVEL, 1));
});

test('기획 문서의 표와 같다: 1단계는 점 4~6개, 2단계는 점 6~8개, 안 되는 그림은 1·2단계와 다리 건너기에만 섞는다', () => {
  assert.deepEqual(rungOf(1).counts, [4, 5, 6]);
  assert.deepEqual(rungOf(2).counts, [6, 7, 8]);
  assert.deepEqual(rungs.map((rung) => rung.mix), [true, true, false, false, false, true, false]);
  // 2단계부터는 갈림길이 더 많다(선을 둘 이상 더 긋는다). 펜 몇 번 떼기는 셋 이상 더 긋는다.
  assert.deepEqual(rungs.map((rung) => rung.extra), [[1, 3], [2, 3], [2, 3], [2, 3], [3, 5], [0, 2], [1, 3]]);
  assert.deepEqual(rungOf(6).doubles, [1, 3]);
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
      // 다리 판만 같은 두 점 사이에 선이 여럿일 수 있고, 닮은 두 그림만 두 그림을 나란히 놓는다.
      assert.equal(board.multi === true, rung.mode === 'bridge', where);
      assert.equal(board.split !== undefined, rung.mode === 'twin', where);
      for (const part of partsOf(board, rung)) {
        assert.ok(rung.counts.includes(part.points.length), where);
        // 점은 격자 위의 자리에 놓인다.
        for (const [x, y] of part.points) {
          assert.ok(Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < columns && y < rows, where);
        }
        // 한 덩어리이고, 점마다 선이 하나 이상 있다.
        assert.equal(pieceCount(part), 1, where);
        assert.ok(degreesOf(part).every((degree) => degree >= 1), where);
        // 선이 다른 점 위를 지나지 않고, 선끼리 엇갈리지 않는다(같은 두 점 사이의 다리끼리는 끝을 같이 쓴다).
        assert.ok(isTidy(part), where);
        // 뻔한 그림이 아니다: 선이 다섯 개 이상(점의 수 이상)이고 갈림길이 있다. 다리 판은 겹으로 놓인 다리가 있다.
        if (rung.mode === 'bridge') assert.equal(plainBridges(part), false, where);
        else {
          assert.equal(tooPlain(part), false, where);
          assert.ok(part.edges.length >= Math.max(5, part.points.length), where);
        }
        assert.ok(Math.max(...degreesOf(part)) >= 3, where);
      }

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

test('단계마다 점의 수가 골고루 나온다(후보가 모두 나온다. 닮은 두 그림은 한쪽 그림의 점의 수)', () => {
  for (const rung of rungs) {
    const seen = new Set(SEEDS.map((seed) => partsOf(generateBoard(rung.level, seed).board, rung)[0].points.length));
    assert.deepEqual([...seen].sort(), [...rung.counts].sort(), `${rung.level}단계`);
  }
});

test('5단계 펜 몇 번 떼기: 모두 한 번에 그을 수 없는 한 덩어리 그림이고, 가장 적게 떼는 횟수가 다 해 보는 탐색과 같다', () => {
  let three = 0;
  for (const seed of SEEDS) {
    const { board, solution, plan } = generateBoard(5, seed);
    const where = `${seed}번 ${JSON.stringify(board)}`;
    assert.equal(solution.possible, false, where);
    assert.equal(solution.pieces, 1, where);
    assert.deepEqual(bruteStarts(board), [], where);
    assert.deepEqual(plan, strokePlan(board), where);
    // 펜을 떼고 다시 대는 모든 차례를 다 해 본 가장 적은 획의 수와 같다.
    assert.equal(plan.strokes, bruteMinStrokes(board), where);
    assert.equal(plan.strokes, solution.odd.length / 2, where);
    assert.ok(plan.strokes === 2 || plan.strokes === 3, where);
    assert.equal(plan.lifts, plan.strokes - 1, where);
    // 적어 둔 방법대로 그으면 모든 선을 그 횟수만큼만 떼고 긋는다.
    const state = walkStrokes(board, plan.plan);
    assert.ok(state.ok && state.complete, where);
    assert.equal(state.lifts, plan.lifts, where);
    if (plan.strokes === 3) three += 1;
  }
  // 펜을 2번 떼야 하는 그림은 셋에 하나쯤(임시)
  assert.ok(Math.abs(THREE_RATE - 1 / 3) < 1e-9);
  assert.ok(three / SEEDS.length > 0.25 && three / SEEDS.length < 0.45, `2번 떼는 그림 ${three}개`);
});

test('6단계 다리 건너기: 겹으로 놓인 다리가 있고, 되는지가 다 해 보는 탐색과 같고, 옛 도시의 일곱 다리 꼴은 내지 않는다', () => {
  let impossible = 0;
  for (const seed of SEEDS) {
    const { board, solution } = generateBoard(6, seed);
    const where = `${seed}번 ${JSON.stringify(board)}`;
    assert.ok(doubledPairs(board) >= 1, where);
    assert.ok(Math.max(...degreesOf(board)) <= MAX_BRIDGES_AT, where);
    assert.equal(famousShape(board), false, where);
    // 같은 두 섬 사이의 다리는 많아야 셋
    const counts = new Map();
    for (const [a, b] of board.edges) counts.set(`${a}-${b}`, (counts.get(`${a}-${b}`) ?? 0) + 1);
    assert.ok(Math.max(...counts.values()) <= MAX_PARALLEL, where);
    // 다리는 한 겹으로 보면 엇갈리지 않는 그림이다.
    const single = { points: board.points, edges: [...new Set(board.edges.map((edge) => edge.join('-')))].map((text) => text.split('-').map(Number)) };
    assert.ok(isTidy(single), where);
    // 되는 판이면 적어 둔 차례대로 건너면 모든 다리를 한 번씩 건넌다.
    if (solution.possible) assert.ok(walk(board, solution.path).complete, where);
    else impossible += 1;
    // 다리 하나하나를 따로 세는 탐색으로도 펜을 떼는 가장 적은 횟수가 같다.
    assert.equal(strokePlan(board).strokes, bruteMinStrokes(board), where);
  }
  assert.ok(impossible / SEEDS.length > 0.25 && impossible / SEEDS.length < 0.42, `안 되는 판 ${impossible}개`);
  // 옛 도시의 일곱 다리(땅 넷: 강가 둘, 섬 둘)를 섬의 번호를 바꿔 적어도 알아본다. 그 그림은 한 번에 건널 수 없다.
  const old = { points: [[0, 0], [1, 0], [0, 1], [1, 1]], edges: [[0, 2], [0, 2], [0, 3], [1, 2], [1, 2], [1, 3], [2, 3]], multi: true };
  assert.equal(famousShape(old), true);
  assert.deepEqual(bruteStarts(old), []);
  assert.equal(bruteMinStrokes(old), 2);
  const relabeled = { ...old, edges: old.edges.map(([a, b]) => [3 - a, 3 - b]) };
  assert.equal(famousShape(relabeled), true);
});

test('7단계 닮은 두 그림: 두 그림은 점의 자리가 같고 선 하나만 다르며, 끝까지 그을 수 있는 쪽은 꼭 하나다(다 해 보는 탐색으로 확인)', () => {
  let left = 0;
  for (const seed of SEEDS) {
    const made = generateBoard(7, seed);
    const { board, answer } = made;
    const where = `${seed}번 ${JSON.stringify(board)}`;
    const [one, two] = partsOf(board, rungOf(7));
    assert.deepEqual(one.points, two.points, where);
    const lines = (figure) => new Set(figure.edges.map(([a, b]) => `${Math.min(a, b)}-${Math.max(a, b)}`));
    const [a, b] = [lines(one), lines(two)];
    const differ = [...a].filter((key) => !b.has(key)).length + [...b].filter((key) => !a.has(key)).length;
    assert.equal(differ, 1, where);
    // 끝까지 그을 수 있는 쪽은 꼭 하나이고, 적어 둔 답과 같다.
    const good = bruteStarts(sideOf(board, answer));
    const bad = bruteStarts(sideOf(board, answer === 'left' ? 'right' : 'left'));
    assert.ok(good.length > 0 && bad.length === 0, where);
    assert.equal(twinAnswer(board), answer, where);
    if (answer === 'left') left += 1;
  }
  assert.ok(left / SEEDS.length > 0.4 && left / SEEDS.length < 0.6, `왼쪽 ${left}개`);
});

test('펜을 떼는 가장 적은 횟수: 점 다섯 개로 만들 수 있는 모든 그림과 다리 판 몇 가지에서 다 해 보는 탐색과 같다', () => {
  const points = Array.from({ length: 5 }, (_, index) => [index, 0]);
  const pairs = [];
  for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) pairs.push([a, b]);
  let count = 0;
  for (let mask = 1; mask < 1 << pairs.length; mask++) {
    const figure = { points, edges: pairs.filter((_, index) => (mask >> index) & 1) };
    const plan = strokePlan(figure);
    assert.equal(plan.strokes, bruteMinStrokes(figure), JSON.stringify(figure.edges));
    const state = walkStrokes(figure, plan.plan);
    assert.ok(state.ok && state.complete && state.lifts === plan.lifts, JSON.stringify(figure.edges));
    count += 1;
  }
  assert.equal(count, 1023);
  // 여러 덩어리: 덩어리마다 따로 센다(선이 홀수 개 모인 점이 없는 덩어리도 한 번은 그어야 한다).
  const apart = { points: Array.from({ length: 6 }, (_, index) => [index, 0]), edges: [[0, 1], [1, 2], [0, 2], [3, 4], [4, 5]] };
  assert.equal(strokePlan(apart).strokes, 2);
  assert.equal(bruteMinStrokes(apart), 2);
  // 다리 판: 같은 두 섬 사이의 다리 셋
  const three = { points: [[0, 0], [1, 0], [2, 0]], edges: [[0, 1], [0, 1], [0, 1], [1, 2]], multi: true };
  assert.equal(checkFigure(three), null);
  assert.equal(strokePlan(three).strokes, bruteMinStrokes(three));
  assert.deepEqual(solve(three).starts, bruteStarts(three));
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
    if (rung.mode === 'pen') lines.push(`  펜을 떼는 가장 적은 횟수 ${tally(made.map((item) => item.plan.lifts))}`);
    if (rung.mode === 'bridge') lines.push(`  겹으로 놓인 곳의 수 ${tally(made.map((item) => doubledPairs(item.board)))}`);
    for (const line of lines) t.diagnostic(line);
    // 한 덩어리로 잇는 선(점의 수 - 1)에, 단계마다 정한 만큼 선을 더 긋는다. 다리 판은 겹으로 놓은 다리를 빼고 센다.
    for (const { board } of made) {
      for (const part of partsOf(board, rung)) {
        const single = new Set(part.edges.map((edge) => edge.join('-'))).size;
        const extra = single - (part.points.length - 1);
        // 닮은 두 그림의 한쪽은 선 하나를 더하거나 뺀 그림이다.
        const [low, high] = rung.mode === 'twin' ? [rung.extra[0] - 1, rung.extra[1] + 1] : rung.extra;
        assert.ok(extra >= low && extra <= high, `${rung.level}단계: 더 그은 선 ${extra}개`);
      }
    }
  }
});

test('작은 그림: 그 단계에서 점이 적은 그림(가장 적은 수와 그다음 수)을 낸다', () => {
  for (const rung of rungs) {
    const allowed = rung.counts.slice(0, 2);
    for (const seed of SEEDS.slice(0, 120)) {
      const made = generateBoard(rung.level, seed, { small: true });
      assert.equal(made.small, true);
      assert.ok(allowed.includes(partsOf(made.board, rung)[0].points.length), `${rung.level}단계 ${seed}번`);
      assert.deepEqual(made.solution, solve(made.board));
      assert.deepEqual(made, generateBoard(rung.level, seed, { small: true }));
      for (const part of partsOf(made.board, rung)) assert.ok(isTidy(part));
      if (rung.mode === 'start') assert.equal(made.solution.starts.length, 2);
      if (rung.mode === 'fix') assert.ok(!made.solution.possible && made.fixes.length >= 1);
      if (rung.mode === 'pen') assert.ok(!made.solution.possible && made.plan.strokes >= 2);
      if (rung.mode === 'twin') assert.equal(twinAnswer(made.board), made.answer);
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
