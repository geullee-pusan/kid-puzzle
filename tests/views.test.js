// 세 방향에서 본 그림의 풀이 프로그램 점검. 그림이 같은 쌓기의 가짓수, 가장 적은 수와 가장 많은 수, 위에서 본 그림이 될 수 있는지와 그 까닭을
// 다른 방법(tests/helpers/brute-views.js: 모든 쌓기를 만들어 묶기, 포함과 배제로 세기, 높이마다 세는 셈)으로 다시 따진다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { checkBoard, countStacks, frontOf, matches, optionFact, planOf, replay, sideOf, solve, tallest, topReason, viewsOf } from '../src/core/views.js';
import { allPlans, countByExclusion, fewestByLevels, look, mostByCells, tally } from './helpers/brute-views.js';

const sum = (list) => list.reduce((total, value) => total + value, 0);
const parse = (text) => [...text].map(Number);

test('그림: 앞은 세로줄마다, 옆은 가로줄마다(앞 줄부터) 가장 높은 것, 위는 칸마다 있는지', () => {
  // 앞 줄: 2, 1, 1 / 뒤 줄: 1, 0, 0
  const heights = [2, 1, 1, 1, 0, 0];
  assert.deepEqual(viewsOf(3, 2, heights), { front: [2, 1, 1], side: [2, 1], plan: [1, 1, 1, 1, 0, 0] });
  assert.deepEqual(viewsOf(3, 2, heights), look(3, 2, heights));
  assert.deepEqual(frontOf(2, 2, [0, 3, 2, 0]), [2, 3]);
  assert.deepEqual(sideOf(2, 2, [0, 3, 2, 0]), [3, 2]);
});

test('가짓수, 가장 적은 수, 가장 많은 수: 작은 판의 모든 쌓기를 만들어 묶은 것과 같다', () => {
  for (const [w, d, high] of [
    [2, 2, 4],
    [2, 3, 3],
    [3, 2, 3],
    [3, 3, 3],
  ]) {
    // 한 칸은 그 줄의 앞 높이를 넘지 않으므로, 높이의 위 끝까지 모두 만들면 그 그림이 되는 쌓기는 빠짐없이 들어 있다
    const { pairs, triples } = tally(w, d, high);
    for (const [key, truth] of pairs) {
      const [front, side] = key.split('|').map(parse);
      const counted = countStacks(w, d, front, side);
      assert.equal(counted.count, truth.count, `${w}×${d} ${key}`);
      assert.equal(counted.fewest, truth.fewest, `${w}×${d} ${key}`);
      assert.equal(counted.most, truth.most, `${w}×${d} ${key}`);
      // 가장 적은(많은) 쌓기는 정말 그 그림이고 그 수다
      for (const [stack, cubes] of [
        [counted.fewestStack, truth.fewest],
        [counted.mostStack, truth.most],
      ]) {
        const views = look(w, d, stack);
        assert.deepEqual([views.front, views.side], [front, side]);
        assert.equal(sum(stack), cubes);
      }
      // 다른 셈과도 같다
      assert.equal(countByExclusion(w, d, front, side), truth.count);
      assert.equal(fewestByLevels(front, side), truth.fewest);
      assert.equal(mostByCells(front, side), truth.most);
      assert.equal(sum(tallest(w, d, front, side)), truth.most);
    }
    for (const [key, count] of triples) {
      const [front, side, plan] = key.split('|').map(parse);
      assert.equal(countStacks(w, d, front, side, plan).count, count, `${w}×${d} ${key}`);
      assert.equal(countByExclusion(w, d, front, side, plan), count);
    }
  }
});

test('그림이 될 수 없는 앞과 옆(가장 높은 줄이 다르다)은 0가지다', () => {
  assert.equal(countStacks(2, 2, [2, 1], [1, 1]).count, 0);
  assert.equal(countStacks(2, 2, [2, 1], [1, 1]).fewest, null);
  assert.equal(countByExclusion(2, 2, [2, 1], [1, 1]), 0);
  // 큰 판(4×4, 높이 4)도 포함과 배제의 셈과 같다
  for (const [front, side] of [
    [
      [4, 2, 3, 1],
      [3, 4, 1, 2],
    ],
    [
      [4, 4, 4, 4],
      [4, 4, 4, 4],
    ],
    [
      [1, 3, 2, 4],
      [2, 2, 4, 1],
    ],
  ]) {
    const counted = countStacks(4, 4, front, side);
    assert.equal(counted.count, countByExclusion(4, 4, front, side));
    assert.equal(counted.fewest, fewestByLevels(front, side));
    assert.equal(counted.most, mostByCells(front, side));
  }
});

test('위에서 본 그림이 될 수 있는가: 까닭이 없으면 쌓을 수 있고, 까닭이 있으면 하나도 없다. 까닭은 말한 대로 판에서 보인다', () => {
  const pairs = [
    [3, 3, [1, 2, 2], [2, 2, 1]],
    [3, 3, [3, 1, 2], [2, 3, 1]],
    [2, 3, [1, 2], [1, 1, 2]],
    [3, 2, [2, 0, 1], [2, 1]],
    [4, 3, [2, 2, 1, 3], [2, 3, 2]],
  ];
  for (const [w, d, front, side] of pairs) {
    for (const plan of allPlans(w * d)) {
      const reason = topReason(w, d, front, side, plan);
      const count = countByExclusion(w, d, front, side, plan);
      assert.equal(reason === null, count > 0, `${front}|${side}|${plan}`);
      if (reason === null) {
        // 까닭이 없으면 칸마다 두 줄 높이 가운데 낮은 쪽만큼 쌓은 것이 정말 그 세 그림이다
        const stack = tallest(w, d, front, side, plan);
        assert.deepEqual(look(w, d, stack), { front, side, plan });
        continue;
      }
      const line = (axis, at) => (axis === 'front' ? Array.from({ length: d }, (_, y) => y * w + at) : Array.from({ length: w }, (_, x) => at * w + x));
      const cells = line(reason.axis, reason.at).filter((at) => plan[at]);
      const mine = reason.axis === 'front' ? front : side;
      if (reason.kind === 'seen') {
        assert.equal(mine[reason.at], 0);
        assert.ok(cells.length > 0);
      } else if (reason.kind === 'empty') {
        assert.ok(mine[reason.at] > 0);
        assert.equal(cells.length, 0);
      } else {
        // 그 줄에 놓인 칸은 다른 방향의 그림 때문에 가장 높아도 reach층이고, 그 줄은 need층으로 보인다
        assert.equal(reason.need, mine[reason.at]);
        const other = (at) => (reason.axis === 'front' ? side[Math.floor(at / w)] : front[at % w]);
        assert.equal(Math.max(...cells.map(other)), reason.reach);
        assert.ok(reason.reach < reason.need);
      }
    }
  }
});

test('보기 판: 고른 보기가 무엇인지(뒤, 왼쪽 옆, 다른 방향, 한 줄이 다른 그림, 한 칸이 다른 그림)를 사실대로 말한다', () => {
  const heights = [2, 1, 1, 1, 0, 0];
  const board = (ask, options) => ({ kind: 'see', w: 3, d: 2, heights, ask, options });
  assert.deepEqual(optionFact(board('front', []), [2, 1, 1]), { kind: 'right' });
  assert.deepEqual(optionFact(board('front', []), [1, 1, 2]), { kind: 'back' });
  assert.deepEqual(optionFact(board('front', []), [2, 1]), { kind: 'side' });
  assert.deepEqual(optionFact(board('front', []), [2, 1, 2]), { kind: 'near', at: 2, value: 2 });
  assert.deepEqual(optionFact(board('side', []), [1, 2]), { kind: 'left' });
  assert.deepEqual(optionFact(board('side', []), [2, 1, 1]), { kind: 'front' });
  assert.deepEqual(optionFact(board('top', []), [1, 1, 1, 0, 0, 0]), { kind: 'cell', x: 0, y: 1, filled: false });
  assert.deepEqual(optionFact(board('top', []), [1, 1, 1, 1, 1, 0]), { kind: 'cell', x: 1, y: 1, filled: true });
});

test('판의 규격과 풀이: 보기는 맞는 것이 꼭 하나, 위의 그림 맞히기는 될 수 있는 보기가 꼭 하나', () => {
  const see = { kind: 'see', w: 3, d: 2, heights: [2, 1, 1, 1, 0, 0], ask: 'front', options: [[2, 1], [2, 1, 2], [2, 1, 1]] };
  assert.equal(checkBoard(see), null);
  assert.deepEqual(solve(see), { possible: true, answer: 2, truth: [2, 1, 1] });
  assert.equal(checkBoard({ ...see, options: [[2, 1], [2, 1, 2]] }), 'answer');
  assert.equal(checkBoard({ ...see, options: [[2, 1, 1], [2, 1, 1]] }), 'same-options');
  assert.equal(checkBoard({ ...see, w: 5 }), 'size');
  const top = { kind: 'top', w: 3, d: 3, front: [1, 2, 2], side: [2, 2, 1], options: [[1, 0, 1, 1, 1, 1, 0, 0, 0], [1, 0, 1, 1, 0, 1, 1, 0, 0], [1, 0, 1, 0, 1, 1, 1, 0, 0], [1, 1, 1, 0, 1, 1, 0, 0, 0]] };
  assert.equal(checkBoard(top), null);
  const solved = solve(top);
  assert.equal(solved.answer, 2);
  assert.equal(solved.count, countByExclusion(3, 3, top.front, top.side, top.options[2]));
  assert.deepEqual(solved.reasons.map((reason) => reason?.kind ?? null), ['empty', 'empty', null, 'empty']);
  assert.equal(checkBoard({ ...top, options: top.options.slice(0, 2) }), 'answer');
  // 앞과 옆의 가장 높은 줄이 다르면 쌓을 수 없는 판이다
  assert.equal(checkBoard({ kind: 'build', w: 2, d: 2, front: [2, 1], side: [1, 1] }), 'impossible');
  assert.equal(checkBoard({ kind: 'three', w: 2, d: 2, front: [2, 1], side: [2, 1], plan: [0, 1, 1, 0] }), 'impossible');
  const three = { kind: 'three', w: 2, d: 2, front: [2, 2], side: [2, 2], plan: [1, 1, 1, 1] };
  assert.equal(checkBoard(three), null);
  assert.equal(solve(three).count, 7);
});

test('한 일의 차례: 쌓기와 빼기를 다시 하고, 한 칸에 4층을 넘거나 빈칸에서 빼면 틀린 차례다. 그림과 맞는지 본다', () => {
  const board = { kind: 'build', w: 2, d: 2, front: [1, 2], side: [2, 1] };
  assert.deepEqual(replay(board, ['a0', 'a1', 'a1', 'a2']), { ok: true, heights: [1, 2, 1, 0] });
  assert.deepEqual(replay(board, ['a0', 'r0']).heights, [0, 0, 0, 0]);
  assert.equal(replay(board, ['r0']).ok, false);
  assert.equal(replay(board, ['a0', 'a0', 'a0', 'a0', 'a0']).ok, false);
  assert.equal(replay(board, ['a9']).ok, false);
  assert.equal(replay(board, ['x1']).ok, false);
  assert.equal(matches(board, [1, 2, 1, 0]), true);
  assert.equal(matches(board, [1, 2, 0, 0]), false);
  assert.equal(matches({ kind: 'three', w: 2, d: 2, front: [1, 2], side: [2, 1], plan: [1, 1, 0, 1] }, [1, 2, 1, 0]), false);
  assert.deepEqual(planOf([0, 3, 1]), [0, 1, 1]);
});
