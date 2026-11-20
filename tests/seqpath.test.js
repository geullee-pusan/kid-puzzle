// 수열 길 퍼즐의 규칙과 풀이 프로그램을 확인한다.
// 길 하나의 약속(수에서 시작해 수에서 끝나고, 수를 셋 이상, 같은 차로), 길들이 함께 놓이는지, 다 했는지,
// 그리고 판을 길들로 나누는 방법의 수가 다른 두 방법(tests/helpers/brute-seqpath.js)과 같은지 본다. 긋기(판 조각의 순수 함수)도 여기서 본다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createRng, randInt } from '../src/core/rng.js';
import { wholePath } from '../src/core/seqpath-ladder.js';
import { MAX_SIZE, MIN_SIZE, brokenWhy, checkBoard, countSolutions, freeCells, isDone, judgePath, neighbours, pathsKey, pathsOk } from '../src/core/seqpath.js';
import { finishedPaths, startStroke, stretchStroke } from '../src/ui/seqpath-board.js';
import { bruteCount, bruteEdges, brutePaths } from './helpers/brute-seqpath.js';

/**
 * 고치지 않고 심기만 한 판: 모든 칸을 지나는 길 하나를 3~len칸씩 잘라, 길마다 두 끝과 가운데 몇 칸에 같은 차로 수를 적는다.
 * 답이 여럿인 판이 많다(사다리는 여기서 답이 하나가 되도록 수를 더 적는다).
 */
function plainPlant(rng, w, h, len, density) {
  const whole = wholePath(rng, w, h);
  const values = new Array(w * h).fill(null);
  let at = 0;
  let next = 1;
  while (at < whole.length) {
    let length = Math.min(randInt(rng, 3, len), whole.length - at);
    if (whole.length - at - length < 3) length = whole.length - at;
    const cells = whole.slice(at, at + length);
    at += length;
    const spots = cells.filter((_, index) => index === 0 || index === length - 1 || rng() < density);
    while (spots.length < 3) spots.splice(1, 0, cells.find((cell) => !spots.includes(cell)));
    spots.sort((a, b) => cells.indexOf(a) - cells.indexOf(b));
    const step = randInt(rng, 1, 3);
    spots.forEach((cell, index) => {
      values[cell] = next + index * step;
    });
    next += spots.length * step + randInt(rng, 1, 4);
  }
  return { w, h, values: values.map((value) => (value === null ? null : value % 100)) };
}

/** 3×3 판: 구석이 빈칸이고 답이 하나뿐인 판("왜 그럴까?"의 판) */
const SMALL = { w: 3, h: 3, values: [null, 2, 3, 1, null, 7, 9, 8, 6] };

test('판의 값: 크기는 3~8칸, 수는 0~99의 정수이거나 빈칸', () => {
  assert.equal(MIN_SIZE, 3);
  assert.equal(MAX_SIZE, 8);
  assert.equal(checkBoard(SMALL), null);
  assert.notEqual(checkBoard({ w: 2, h: 3, values: new Array(6).fill(null) }), null);
  assert.notEqual(checkBoard({ w: 9, h: 3, values: new Array(27).fill(null) }), null);
  assert.notEqual(checkBoard({ w: 3, h: 3, values: new Array(8).fill(null) }), null);
  assert.notEqual(checkBoard({ w: 3, h: 3, values: [100, ...new Array(8).fill(null)] }), null);
  assert.notEqual(checkBoard({ w: 3, h: 3, values: [1.5, ...new Array(8).fill(null)] }), null);
  assert.deepEqual(neighbours(SMALL, 4), [1, 5, 7, 3]);
  assert.deepEqual(neighbours(SMALL, 0), [1, 3]);
});

test('길 하나의 약속: 수의 차례가 어긋난 것을 먼저 보고, 그다음 끝과 수의 개수를 본다', () => {
  const board = { w: 4, h: 1, values: [3, 5, 8, null] };
  // 3, 5, 8: 뛰는 크기가 2와 3
  assert.equal(judgePath({ w: 3, h: 3, values: [3, 5, 8, null, null, null, null, null, null] }, [0, 1, 2]).why, 'jumps');
  assert.deepEqual(judgePath({ w: 3, h: 3, values: [3, 5, 8, null, null, null, null, null, null] }, [0, 1, 2]).jumps, [2, 3]);
  // 끝이 빈칸이어도 수의 차례가 어긋났으면 어긋난 것이다(더 늘려도 맞을 수 없다)
  assert.equal(judgePath(board, [0, 1, 2, 3]).why, 'jumps');
  assert.equal(judgePath({ w: 4, h: 1, values: [3, 5, null, 7] }, [0, 1, 2]).why, 'end');
  assert.equal(judgePath({ w: 4, h: 1, values: [3, 5, null, 7] }, [0, 1]).why, 'few');
  assert.equal(judgePath({ w: 4, h: 1, values: [3, 5, 4, 7] }, [0, 1, 2]).why, 'turn');
  assert.equal(judgePath({ w: 4, h: 1, values: [3, 3, 4, 7] }, [0, 1, 2]).why, 'zero');
  const ok = judgePath({ w: 4, h: 1, values: [9, null, 6, 3] }, [0, 1, 2, 3]);
  assert.equal(ok.ok, true);
  assert.equal(ok.step, -3);
  assert.deepEqual(ok.numbers, [9, 6, 3]);
  // 앞뒤 없이 같다
  assert.equal(judgePath({ w: 4, h: 1, values: [9, null, 6, 3] }, [3, 2, 1, 0]).step, 3);
  assert.deepEqual(['zero', 'turn', 'jumps', 'end', 'few'].map(brokenWhy), [true, true, true, false, false]);
});

test('길들: 이웃한 칸끼리, 겹치지 않게. 모든 칸을 지나고 길마다 맞으면 다 한 것이다', () => {
  assert.equal(pathsOk(SMALL, [[3, 0, 1, 2]]), true);
  assert.equal(pathsOk(SMALL, [[3, 1]]), false); // 이웃이 아니다
  assert.equal(pathsOk(SMALL, [[3, 0, 1], [1, 2]]), false); // 겹친다
  assert.equal(pathsOk(SMALL, [[3]]), false); // 한 칸짜리
  assert.equal(pathsOk(SMALL, [[3, 0, 3]]), false); // 같은 칸을 두 번
  assert.deepEqual(freeCells(SMALL, [[3, 0, 1, 2]]), [4, 5, 6, 7, 8]);
  assert.equal(isDone(SMALL, [[2, 1, 0, 3], [6, 7, 4, 5, 8]]), true);
  assert.equal(isDone(SMALL, [[3, 4, 1, 2], [6, 7, 8, 5]]), false);
  assert.equal(pathsKey([[2, 1, 0, 3], [6, 7, 4, 5, 8]]), pathsKey([[8, 5, 4, 7, 6], [3, 0, 1, 2]]));
  // 풀이 프로그램: 답은 하나
  const solved = countSolutions(SMALL, { limit: 5 });
  assert.equal(solved.count, 1);
  assert.equal(solved.complete, true);
  assert.equal(isDone(SMALL, solved.paths), true);
  assert.equal(pathsKey(solved.paths), pathsKey([[2, 1, 0, 3], [6, 7, 4, 5, 8]]));
  assert.equal(solved.second, null);
});

test('정한 수에 닿으면 멈추고, 따져 보는 걸음의 위 끝을 넘으면 끝까지 따지지 못했다고 한다', () => {
  // 수가 셋뿐인 4×4(1, 2, 3이 맨 윗줄에): 길 하나로 모든 칸을 지나는 방법이 여덟 가지다
  const open = { w: 4, h: 4, values: [1, null, 2, 3, ...new Array(12).fill(null)] };
  const all = countSolutions(open, { limit: Infinity });
  assert.equal(all.count, 8);
  assert.equal(bruteCount(open).count, 8);
  // 같은 꼴이라도 두 끝이 같은 색(바둑판처럼 칠했을 때)인 구석이면 모든 칸을 지나는 길이 없다
  assert.equal(countSolutions({ w: 4, h: 4, values: [1, null, null, null, null, 2, ...new Array(9).fill(null), 3] }, { limit: Infinity }).count, 0);
  const capped = countSolutions(open, { limit: 3 });
  assert.equal(capped.count, 3);
  assert.equal(capped.complete, false);
  assert.notEqual(pathsKey(capped.paths), pathsKey(capped.second));
  const short = countSolutions(open, { limit: Infinity, budget: 5 });
  assert.equal(short.complete, false);
  assert.ok(short.nodes <= 6);
  // 수가 셋보다 적으면 길을 이을 수 없다
  assert.equal(countSolutions({ w: 3, h: 3, values: [1, 2, ...new Array(7).fill(null)] }, { limit: 5 }).count, 0);
});

test('작은 판 800개: 방법의 수가 다른 두 방법(선 하나씩 정하기, 조각을 이으며 정하기)과 같고, 찾은 방법은 모두 약속에 맞는다', () => {
  const rng = createRng(20261121);
  let multi = 0;
  let none = 0;
  for (let index = 0; index < 800; index++) {
    const [w, h] = [[3, 3], [3, 4], [4, 3], [4, 4]][randInt(rng, 0, 3)];
    const board = index % 2 === 0 ? plainPlant(rng, w, h, 5, rng()) : { w, h, values: Array.from({ length: w * h }, () => (rng() < 0.6 ? randInt(rng, 1, 8) : null)) };
    const ours = countSolutions(board, { limit: Infinity });
    const plain = bruteCount(board);
    assert.equal(ours.count, plain.count, JSON.stringify(board));
    assert.equal(bruteEdges(board).count, plain.count, JSON.stringify(board));
    if (ours.paths) {
      assert.equal(isDone(board, ours.paths), true);
      assert.ok(plain.solutions.some((paths) => pathsKey(paths) === pathsKey(ours.paths)));
    }
    if (ours.count > 1) multi += 1;
    if (ours.count === 0) none += 1;
  }
  // 답이 여럿인 판과 없는 판도 섞여 있다
  assert.ok(multi > 30 && none > 100, `${multi} ${none}`);
});

test('큰 판(5×4~8×8) 200개: 방법의 수가 조각을 이으며 정하는 방법과 같다(답이 여럿인 판이 많다)', () => {
  const rng = createRng(1121);
  let checked = 0;
  let multi = 0;
  for (let index = 0; index < 400 && checked < 200; index++) {
    const size = randInt(rng, 5, 8);
    const board = plainPlant(rng, size, randInt(rng, Math.max(4, size - 1), size), 9, 0.2 + 0.5 * rng());
    {
      const ours = countSolutions(board, { limit: 40, budget: 2000000 });
      if (!ours.complete && ours.count < 40) continue;
      const other = bruteEdges(board, 40);
      assert.equal(ours.count, other.count, JSON.stringify(board));
      if (ours.paths) assert.ok(brutePaths(board, ours.paths.flatMap((path) => path.slice(1).map((cell, at) => [path[at], cell]))));
      checked += 1;
      if (ours.count > 1) multi += 1;
    }
  }
  assert.ok(checked >= 200 && multi > 20, `${checked} ${multi}`);
});

test('긋기: 수 칸에서 시작해 늘이고, 바로 앞 칸으로 돌아가면 줄고, 다른 길의 끝에 닿으면 잇는다', () => {
  const view = { w: 3, h: 3, values: SMALL.values };
  // 빈칸에서는 시작하지 않는다
  assert.equal(startStroke(view, [], 0), null);
  let stroke = startStroke(view, [], 3);
  assert.deepEqual(stroke.paths, [[3]]);
  stroke = stretchStroke(view, stroke, 0);
  stroke = stretchStroke(view, stroke, 1);
  assert.deepEqual(stroke.paths, [[3, 0, 1]]);
  // 이웃이 아닌 칸, 지나온 칸은 그대로
  assert.equal(stretchStroke(view, stroke, 8), stroke);
  assert.equal(stretchStroke(view, stroke, 1), stroke);
  // 바로 앞 칸으로 되돌아가면 줄어든다
  const back = stretchStroke(view, stroke, 0);
  assert.deepEqual(back.paths, [[3, 0]]);
  assert.equal(back.moved, true);
  // 길의 첫 칸에서 시작하면 거꾸로 이어 늘인다
  const fromStart = startStroke(view, [[3, 0, 1]], 3);
  assert.deepEqual(fromStart.paths, [[1, 0, 3]]);
  assert.equal(fromStart.pressed, 0);
  // 가운데 칸에서 시작하면 그 칸까지만 남긴다
  assert.deepEqual(startStroke(view, [[3, 0, 1, 2]], 0).paths, [[3, 0]]);
  // 다른 길의 끝에 닿으면 두 길이 이어지고, 그 뒤로는 늘지 않는다
  let join = startStroke(view, [[6, 7], [3, 0, 1, 2]], 2);
  join = stretchStroke(view, join, 5);
  join = stretchStroke(view, join, 8);
  join = stretchStroke(view, join, 7);
  assert.deepEqual(finishedPaths(join), [[3, 0, 1, 2, 5, 8, 7, 6]]);
  assert.equal(join.merged, true);
  assert.equal(stretchStroke(view, join, 4), join);
  // 다른 길의 가운데 칸에는 들어가지 않는다
  const blocked = startStroke(view, [[6, 7, 8], [3, 4]], 4);
  assert.equal(stretchStroke(view, blocked, 7), blocked);
  // 한 칸짜리 길은 버린다
  assert.deepEqual(finishedPaths(startStroke(view, [], 3)), []);
});
