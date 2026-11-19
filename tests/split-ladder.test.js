// 똑같이 섞이게 자르기의 사다리 점검: 단계마다 판 번호 1~100(작은 판도)이 그 단계의 조건에 맞고, 다른 방법으로 다시 풀어도 같은 답인지,
// 안 되는 판이 섞이는 비율, 맨 처음 판들, "더 작은 판"(조각 수와 섞인 꼴이 같고 칸이 적은 판)을 본다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SMALLER, smallerSplit } from '../src/core/smaller.js';
import { FIRST_BOARD, IMPOSSIBLE_RATE, LADDER, MAKE_LEVEL, MIX_SECOND, SHOWN_REASONS, TOP_LEVEL, fits, generateBoard, nextSeed, rungOf, smallBoards } from '../src/core/split-ladder.js';
import { applyCuts, checkBoard, layoutKey, mixOf, solve } from '../src/core/split.js';
import { bruteSolve } from './helpers/brute-split.js';

const SEEDS = Array.from({ length: 100 }, (_, index) => index + 1);
const isStrips = (pieces, board) => pieces.every((rect) => rect.h === board.h) || pieces.every((rect) => rect.w === board.w);

test('사다리: 여섯 단계, 맨 위는 직접 만들기, 단계마다 기본·응용·도전 표시', () => {
  assert.deepEqual(LADDER.map((rung) => rung.level), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(LADDER.map((rung) => rung.mode), ['cut', 'cut', 'mix', 'count', 'four', 'make']);
  assert.deepEqual(LADDER.map((rung) => rung.tag), ['basic', 'basic', 'applied', 'applied', 'challenge', 'challenge']);
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  assert.throws(() => generateBoard(6, 1));
  assert.throws(() => rungOf(9));
  assert.equal(IMPOSSIBLE_RATE, 1 / 3);
  // 단계마다 고르는 크기 가운데 섞인 꼴이 들어가는 것이 하나는 있다
  for (const rung of LADDER.filter((item) => item.mode !== 'make')) {
    for (const ratio of rung.ratios) {
      assert.ok(rung.sizes.some((size) => fits(size, ratio, rung.parts)), `${rung.level}단계 ${ratio}`);
      assert.ok(rung.small.some((size) => fits(size, ratio, rung.parts)), `${rung.level}단계 작은 판 ${ratio}`);
    }
  }
});

test('모든 판(단계마다 1~100번, 작은 판도)이 그 단계의 조건에 맞고, 칸을 세는 다른 방법으로 풀어도 같다', () => {
  for (const rung of LADDER.filter((item) => item.mode !== 'make')) {
    for (const small of [false, true]) {
      let impossible = 0;
      for (const seed of SEEDS) {
        const made = generateBoard(rung.level, seed, { small });
        const { board, solution } = made;
        const where = `${rung.level}단계 ${seed}번${small ? ' 작은 판' : ''}`;
        assert.equal(checkBoard(board), null, where);
        assert.equal(board.parts, rung.parts, where);
        assert.ok((small ? rung.small : rung.sizes).some(([w, h]) => w === board.w && h === board.h) || (seed <= 2 && !small), where);
        assert.deepEqual(solution, solve(board), where);
        assert.deepEqual(solution.layouts.map(layoutKey).sort(), bruteSolve(board), where);
        // 같은 번호는 늘 같은 판이다
        assert.deepEqual(generateBoard(rung.level, seed, { small }).board, board, where);
        const mix = mixOf(board);
        if (solution.possible) {
          assert.ok(rung.ratios.some(([g, w]) => g === mix.unitGrey && w === mix.unitWhite) || (rung.level === 1 && seed === 1), where);
          assert.ok(solution.count >= rung.ways[0] && solution.count <= rung.ways[1], `${where}: ${solution.count}가지`);
          if (rung.strips) assert.ok(solution.layouts.some((pieces) => isStrips(pieces, board)), where);
        } else {
          impossible += 1;
          assert.ok(rung.mode === 'mix' || rung.mode === 'four', where);
          assert.ok(SHOWN_REASONS.includes(solution.reason), `${where}: ${solution.reason}`);
        }
      }
      if (rung.mode === 'mix' || rung.mode === 'four') assert.ok(impossible >= 20 && impossible <= 45, `${rung.level}단계: 안 되는 판 ${impossible}개`);
      else assert.equal(impossible, 0);
    }
  }
});

test('맨 처음 판들: 1단계 첫 판은 두 칸 너비의 세 띠로 자르면 되고, 3단계 둘째 판은 회색이 2칸뿐인 안 되는 판이다', () => {
  assert.deepEqual(generateBoard(1, 1).board, FIRST_BOARD);
  const first = solve(FIRST_BOARD);
  assert.equal(first.count, 5);
  assert.ok(first.layouts.some((pieces) => layoutKey(pieces) === layoutKey(applyCuts(FIRST_BOARD, [{ d: 'v', at: 2, i: 0 }, { d: 'v', at: 4, i: 0 }]).pieces)));
  // 풀이에서 먼저 보여 주는 것은 나란한 선으로 자른 것이다
  assert.ok(isStrips(first.layouts[0], FIRST_BOARD));
  assert.deepEqual(generateBoard(3, 2).board, MIX_SECOND);
  const second = solve(MIX_SECOND);
  assert.equal(MIX_SECOND.grey.length, 2);
  assert.equal(second.reason, 'groups');
  assert.equal(second.mix.groups, 2);
  // 3단계와 5단계의 첫 판은 되는 판이다
  assert.equal(generateBoard(3, 1).solution.possible, true);
  assert.equal(generateBoard(5, 1).solution.possible, true);
  assert.equal(generateBoard(4, 1).solution.count, 3);
});

test('다음 판 번호는 방금 한 판과 다른 판을 낸다', () => {
  for (const rung of LADDER.filter((item) => item.mode !== 'make')) {
    for (const seed of [1, 2, 3, 10]) {
      const next = nextSeed(rung.level, seed);
      assert.ok(next > seed);
      assert.notDeepEqual(generateBoard(rung.level, next).board, generateBoard(rung.level, seed).board);
    }
  }
});

test('더 작은 판: 조각 수와 섞인 꼴이 같고 칸이 4분의 3 이하인 판. 되는 판에서는 되는 판만, 안 되는 판에서는 되는 판부터 같은 까닭의 안 되는 판과 번갈아', () => {
  assert.equal(SMALLER.split, smallerSplit);
  let none = 0;
  for (const rung of LADDER.filter((item) => item.mode !== 'make')) {
    for (const seed of SEEDS.slice(0, 40)) {
      const { board, solution } = generateBoard(rung.level, seed);
      const origin = { mode: rung.mode, board };
      const lists = smallBoards(origin);
      for (const [kind, list] of Object.entries(lists)) {
        for (const small of list) {
          const where = `${rung.level}단계 ${seed}번 ${kind}`;
          assert.equal(checkBoard(small), null, where);
          assert.equal(small.parts, board.parts, where);
          assert.ok(small.w <= board.w && small.h <= board.h && small.w * small.h * 4 <= board.w * board.h * 3, where);
          const result = solve(small);
          assert.equal(result.possible, kind === 'yes', where);
          if (kind === 'yes' && rung.mode === 'count') assert.ok(result.count >= 2 && result.count <= 3, where);
          if (kind === 'no') assert.equal(result.reason, solution.reason === 'groups' ? 'groups' : 'edge', where);
        }
      }
      if (rung.mode === 'cut' || rung.mode === 'count') assert.equal(lists.no.length, 0);
      const turns = [0, 1, 2, 3].map((turn) => smallerSplit(origin, turn));
      if (turns[0] === null) {
        none += 1;
        continue;
      }
      // 첫 작은 판은 늘 되는 판이다
      assert.equal(solve(turns[0].board).possible, true);
      if (solution.possible) for (const item of turns) assert.equal(solve(item.board).possible, true);
      else if (lists.yes.length > 0 && lists.no.length > 0) assert.equal(solve(turns[1].board).possible, false);
      // 같은 판, 같은 차례에는 늘 같은 판
      assert.deepEqual(smallerSplit(origin, 2), turns[2]);
    }
  }
  assert.ok(none < 20, `작은 판이 없는 판 ${none}개`);
  // 작은 판의 작은 판은 대개 없다(틀은 작은 판에서 이 단추를 내지 않는다)
  assert.equal(smallerSplit({ mode: 'cut', board: { w: 3, h: 2, grey: [0, 1, 2], parts: 3 } }), null);
  assert.equal(smallerSplit({ mode: 'cut', board: { w: 3, h: 2, grey: [], parts: 3 } }), null);
});
