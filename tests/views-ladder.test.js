// 세 방향에서 본 그림의 사다리와 판 내기, 더 작은 판 점검. 가짓수와 될 수 있는지는 다른 방법(tests/helpers/brute-views.js)으로 다시 따진다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LADDER, MAKE_LEVEL, RANGE_MOST, THREE_MOST, TOP_LEVEL, askAt, generateBoard, madeFrom, manyAt, nextSeed, rungOf, smallBoards } from '../src/core/views-ladder.js';
import { checkBoard, optionFact, sameBoard, sameList, solve, viewFrom } from '../src/core/views.js';
import { smallerViews } from '../src/core/smaller.js';
import { countByExclusion, fewestByLevels, look, mostByCells } from './helpers/brute-views.js';

const SEEDS = Array.from({ length: 40 }, (_, index) => index + 1);
const sum = (list) => list.reduce((total, value) => total + value, 0);
/** 줄마다 쌓기나무가 있는 그림인가(사다리의 판은 앞과 옆의 그림에 빈 줄이 없다) */
const full = (board) => board.front.every((value) => value > 0) && board.side.every((value) => value > 0);

test('사다리: 여섯 단계, 맨 위는 직접 만들기. 단계의 종류와 표시', () => {
  assert.deepEqual(LADDER.map((rung) => rung.mode), ['see', 'build', 'top', 'range', 'three', 'make']);
  assert.deepEqual(LADDER.map((rung) => rung.tag), ['basic', 'basic', 'applied', 'applied', 'challenge', 'challenge']);
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  assert.throws(() => generateBoard(6, 1));
  assert.throws(() => generateBoard(1, 0));
  assert.throws(() => rungOf(7));
});

test('1단계 보이는 그림 고르기: 보기 셋 가운데 맞는 그림이 꼭 하나다. 다른 보기는 모두 무엇인지 말할 수 있는 그림이다. 첫 판은 정해 둔 판이다', () => {
  const first = generateBoard(1, 1).board;
  assert.deepEqual([first.w, first.d, first.heights, first.ask], [3, 2, [2, 1, 1, 1, 0, 0], 'front']);
  assert.deepEqual(generateBoard(1, 7, { small: true }).board, first);
  for (const seed of SEEDS) {
    const { board } = generateBoard(1, seed);
    assert.equal(checkBoard(board), null, `${seed}번`);
    assert.equal(board.ask, seed === 1 ? 'front' : askAt(seed));
    assert.equal(board.options.length, 3);
    const truth = viewFrom(board.w, board.d, board.heights, board.ask);
    const own = board.ask === 'top' ? look(board.w, board.d, board.heights).plan : look(board.w, board.d, board.heights)[board.ask];
    assert.deepEqual(truth, own);
    assert.equal(board.options.filter((option) => sameList(option, truth)).length, 1);
    for (const option of board.options) assert.notEqual(optionFact(board, option).kind, 'other', `${seed}번 ${option}`);
  }
});

test('2, 4, 5단계: 그림대로 쌓을 수 있고, 가짓수·가장 적은 수·가장 많은 수가 다른 셈과 같다', () => {
  assert.deepEqual(generateBoard(2, 1).board, { kind: 'build', w: 2, d: 2, front: [1, 2], side: [2, 1] });
  assert.deepEqual(generateBoard(4, 1).board, { kind: 'range', w: 2, d: 2, front: [2, 1], side: [2, 1] });
  let many = 0;
  for (const level of [2, 4, 5]) {
    for (const seed of SEEDS) {
      const { board } = generateBoard(level, seed);
      assert.equal(checkBoard(board), null, `${level}단계 ${seed}번`);
      assert.ok(full(board), `${level}단계 ${seed}번`);
      const solved = solve(board);
      const plan = board.kind === 'three' ? board.plan : null;
      assert.equal(solved.count, countByExclusion(board.w, board.d, board.front, board.side, plan), `${level}단계 ${seed}번`);
      assert.ok(solved.count >= 1);
      // 가장 많이 쌓은 쌓기는 정말 그 그림이다
      const views = look(board.w, board.d, solved.example);
      assert.deepEqual([views.front, views.side], [board.front, board.side]);
      if (plan) assert.deepEqual(views.plan, plan);
      if (board.kind === 'range') {
        assert.equal(solved.fewest, fewestByLevels(board.front, board.side));
        assert.equal(solved.most, mostByCells(board.front, board.side));
        assert.ok(solved.most - solved.fewest >= 2 && solved.most <= RANGE_MOST, `${seed}번`);
      }
      if (board.kind === 'three') {
        // 판 번호가 홀수이면 세 그림이 되는 쌓기가 둘 이상, 짝수이면 하나뿐이다
        assert.equal(solved.count > 1, manyAt(seed), `${seed}번`);
        many += solved.count > 1 ? 1 : 0;
        assert.ok(sum(solved.example) <= THREE_MOST);
      }
    }
  }
  assert.equal(many, SEEDS.length / 2);
});

test('3단계 위에서 본 그림 맞히기: 될 수 있는 보기가 꼭 하나다. 안 되는 보기는 줄이 비었거나(empty) 높이가 모자라고(short), 첫 판은 빈 줄만이다', () => {
  let short = 0;
  for (const seed of SEEDS) {
    const { board } = generateBoard(3, seed);
    assert.equal(checkBoard(board), null, `${seed}번`);
    assert.ok(full(board));
    assert.equal(board.options.length, 4);
    const possible = board.options.map((plan) => countByExclusion(board.w, board.d, board.front, board.side, plan) > 0);
    assert.equal(possible.filter(Boolean).length, 1, `${seed}번`);
    const solved = solve(board);
    assert.equal(possible.indexOf(true), solved.answer);
    const kinds = solved.reasons.filter(Boolean).map((reason) => reason.kind);
    assert.ok(kinds.every((kind) => kind === 'empty' || kind === 'short'), `${seed}번 ${kinds}`);
    if (seed === 1) assert.deepEqual(kinds, ['empty', 'empty', 'empty']);
    else assert.ok(kinds.includes('short'), `${seed}번`);
    short += kinds.filter((kind) => kind === 'short').length;
    // 보기의 칸 수는 될 수 있는 보기와 하나 넘게 다르지 않다(칸 수만 보고 고를 수 없게)
    const cells = sum(board.options[solved.answer]);
    for (const option of board.options) assert.ok(Math.abs(sum(option) - cells) <= 1);
  }
  assert.ok(short > SEEDS.length);
});

test('같은 번호는 늘 같은 판이고, 다음 번호는 방금 한 판과 같은 판을 건너뛴다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of SEEDS.slice(0, 12)) {
      assert.deepEqual(generateBoard(level, seed), generateBoard(level, seed));
      const next = nextSeed(level, seed);
      assert.ok(next > seed);
      assert.ok(!sameBoard(generateBoard(level, next).board, generateBoard(level, seed).board));
    }
  }
});

test('더 작은 판: 가장자리의 세로줄이나 가로줄을 덜어 낸 같은 종류의 판. 규격에 맞고 같은 판에서는 늘 같다', () => {
  let none = 0;
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of SEEDS.slice(0, 20)) {
      const { board } = generateBoard(level, seed);
      const origin = { mode: rungOf(level).mode, board };
      const list = smallBoards(board);
      for (const turn of [0, 1, 2]) {
        const small = smallerViews(origin, turn);
        if (list.length === 0) {
          assert.equal(small, null);
          none += turn === 0 ? 1 : 0;
          continue;
        }
        assert.ok(small, `${level}단계 ${seed}번`);
        const made = small.board;
        assert.equal(checkBoard(made), null);
        assert.equal(made.kind, board.kind);
        assert.ok(made.w <= board.w && made.d <= board.d && made.w * made.d < board.w * board.d);
        assert.deepEqual(smallerViews(origin, turn), small);
        if (made.kind === 'see') assert.equal(made.ask, board.ask);
        if (made.kind === 'range') {
          const solved = solve(made);
          assert.ok(solved.most > solved.fewest);
        }
        if (made.kind !== 'see') assert.ok(full(made));
      }
    }
  }
  // 2×2 판은 더 줄일 수 없다
  assert.ok(none > 0);
  assert.equal(smallerViews({ mode: 'range', board: generateBoard(4, 1).board }, 0), null);
  assert.equal(smallerViews({ mode: 'made', board: null }), null);
});

test('직접 만들기: 쌓기를 세 방향에서 본 그림의 판이 된다. 빈 쌓기는 판이 아니다', () => {
  const board = madeFrom(3, 2, [2, 0, 1, 0, 0, 1]);
  assert.deepEqual(board, { kind: 'three', w: 3, d: 2, front: [2, 0, 1], side: [2, 1], plan: [1, 0, 1, 0, 0, 1] });
  assert.equal(checkBoard(board), null);
  assert.equal(solve(board).count, countByExclusion(3, 2, board.front, board.side, board.plan));
  assert.equal(madeFrom(2, 2, [0, 0, 0, 0]), null);
  // 빈 줄이 있는 직접 만든 판에서도 작은 판을 낸다
  assert.ok(smallerViews({ mode: 'made', board: madeFrom(3, 3, [1, 0, 2, 0, 0, 0, 3, 0, 1]) }, 0));
});
