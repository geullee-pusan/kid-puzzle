// 자르고 붙이기의 사다리 점검: 단계마다 판 번호 1~100(작은 판도)이 그 단계의 조건에 맞고, 다른 방법으로 다시 풀어도 같은지,
// 안 되는 판의 비율, 맨 처음 판들, "더 작은 판"(칸이 적은 도형, 조각 넷의 그림자, 빵이나 사람이 적은 나누기)을 본다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SMALLER, smallerCutpaste } from '../src/core/smaller.js';
import { FIRST_MOVE, FIRST_SHADOW, FIRST_SHARE, HOUSE, IMPOSSIBLE_RATE, LADDER, MAKE_LEVEL, SECOND_SHADOW, TOP_LEVEL, generateBoard, kindOf, nextSeed, rungOf, smallBoards, smallerPairs } from '../src/core/cutpaste-ladder.js';
import { MOVE_H, MOVE_W, PIECES, SEVEN, boxOf, checkBoard, gcdOf, hasHole, isPrime, isRect, setArea, solve } from '../src/core/cutpaste.js';
import { bruteFillCount, bruteMoveMin } from './helpers/brute-cutpaste.js';

const SEEDS = Array.from({ length: 100 }, (_, index) => index + 1);
const specOf = (level, kind) => {
  const rung = rungOf(level);
  return rung.mode === 'mixed' ? rung[kind] : rung;
};

test('사다리: 여섯 단계, 맨 위는 직접 만들기, 단계마다 기본·응용·도전 표시', () => {
  assert.deepEqual(LADDER.map((rung) => rung.level), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(LADDER.map((rung) => rung.mode), ['move', 'share', 'move', 'shadow', 'mixed', 'make']);
  assert.deepEqual(LADDER.map((rung) => rung.tag), ['basic', 'basic', 'applied', 'applied', 'challenge', 'challenge']);
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  assert.equal(IMPOSSIBLE_RATE, 1 / 3);
  assert.throws(() => generateBoard(6, 1));
  assert.throws(() => rungOf(9));
  // 5단계는 판 번호마다 나누기, 네모, 그림자가 번갈아 나온다
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((seed) => kindOf(5, seed)), ['share', 'move', 'shadow', 'share', 'move', 'shadow']);
  assert.deepEqual([1, 2, 3, 4].map((level) => kindOf(level, 7)), ['move', 'share', 'move', 'shadow']);
});

test('맨 처음 판들: 비껴 놓인 계단(한 번), 빵 2개를 3명이, 집 모양 그림자, 25칸 네모 그림자, 칸이 7개인 안 되는 도형', () => {
  assert.deepEqual(generateBoard(1, 1).board, FIRST_MOVE);
  const first = solve(FIRST_MOVE);
  assert.deepEqual([first.possible, first.min, first.size], [true, 1, [4, 2]]);
  assert.deepEqual(generateBoard(2, 1).board, FIRST_SHARE);
  assert.equal(solve(FIRST_SHARE).best, 4);
  assert.deepEqual(generateBoard(4, 1).board, FIRST_SHADOW);
  assert.equal(FIRST_SHADOW.shadow.length, 20);
  assert.equal(HOUSE.join('').split('#').length - 1, 20);
  assert.equal(solve(FIRST_SHADOW).possible, true);
  assert.deepEqual(generateBoard(4, 2).board, SECOND_SHADOW);
  assert.deepEqual([solve(SECOND_SHADOW).possible, solve(SECOND_SHADOW).shadowArea], [false, 25]);
  const easy = generateBoard(3, 2);
  assert.equal(easy.board.cells.length, 7);
  assert.deepEqual([easy.solution.possible, easy.solution.reason], [false, 'line']);
  assert.equal(bruteMoveMin(easy.board), null);
  assert.equal(generateBoard(3, 1).solution.possible, true);
});

test('잘라 옮겨 네모(1, 3, 5단계): 모든 판이 크기와 칸 수에 맞고, 가장 적게 자른 수가 다른 방법과 같다. 안 되는 판은 칸 수가 소수다', () => {
  const counts = { 1: { yes: 0, no: 0 }, 3: { yes: 0, no: 0 }, 5: { yes: 0, no: 0 } };
  for (const level of [1, 3, 5]) {
    for (const small of [false, true]) {
      for (const seed of SEEDS) {
        if (kindOf(level, seed) !== 'move') continue;
        const { board, solution } = generateBoard(level, seed, { small });
        const where = `${level}단계 ${seed}번${small ? ' 작은 판' : ''}`;
        const spec = specOf(level, 'move');
        assert.equal(checkBoard(board), null, where);
        assert.deepEqual(generateBoard(level, seed, { small }).board, board, `${where}: 같은 번호는 같은 판`);
        assert.deepEqual([board.w, board.h, board.cuts], [MOVE_W, MOVE_H, spec.cuts], where);
        const shape = small ? spec.small : spec;
        const area = board.cells.length;
        const box = boxOf(board.cells);
        if (!(level === 3 && seed === 2 && !small)) assert.ok(area >= shape.area[0] && area <= shape.area[1], `${where}: ${area}칸`);
        // 1단계 첫 판(비껴 놓인 계단)은 가로 6칸이다
        if (!(level === 1 && seed === 1 && !small)) assert.ok(box.w <= shape.box[0] && box.h <= shape.box[1], where);
        assert.ok(!isRect(board.cells) && !hasHole(board.cells), where);
        // 다른 방법으로 다시 푼다(판마다 하나씩 건너 뛰며)
        if (seed % 2 === 1 || !solution.possible) assert.equal(bruteMoveMin(board), solution.min, where);
        if (small) continue;
        if (solution.possible) {
          counts[level].yes += 1;
          // 되는 판은 꼭 그만큼 잘라야 된다(덜 잘라서는 안 된다)
          assert.equal(solution.min, board.cuts, where);
        } else {
          counts[level].no += 1;
          assert.equal(solution.reason, 'line', where);
          assert.ok(isPrime(area), where);
        }
      }
    }
  }
  assert.equal(counts[1].no, 0);
  // 안 되는 판은 셋에 하나쯤(둘째 판 포함)
  assert.ok(counts[3].no >= 20 && counts[3].no <= 45, JSON.stringify(counts[3]));
  assert.ok(counts[5].no >= 4 && counts[5].no <= 18, JSON.stringify(counts[5]));
});

test('가장 적게 잘라 나누기(2, 5단계): 단계의 빵 수와 사람 수이고, 한쪽이 다른 쪽을 나누어떨어뜨리지 않는다', () => {
  for (const level of [2, 5]) {
    for (const small of [false, true]) {
      for (const seed of SEEDS) {
        if (kindOf(level, seed) !== 'share') continue;
        const { board, solution } = generateBoard(level, seed, { small });
        const spec = specOf(level, 'share');
        const where = `${level}단계 ${seed}번`;
        assert.equal(checkBoard(board), null, where);
        assert.ok((small ? spec.small : spec.pairs).some(([m, n]) => m === board.m && n === board.n), where);
        assert.ok(board.m % board.n !== 0 && board.n % board.m !== 0, where);
        assert.equal(solution.best, board.m + board.n - gcdOf(board.m, board.n), where);
      }
    }
  }
});

test('가짜 그림자(4, 5단계): 일곱 조각(작은 판은 넷), 채울 수 있는 그림자는 다른 방법으로도 채워지고, 안 되는 그림자는 칸 수가 하나 다르다', () => {
  const counts = { 4: { yes: 0, no: 0 }, 5: { yes: 0, no: 0 } };
  for (const level of [4, 5]) {
    for (const small of [false, true]) {
      for (const seed of SEEDS) {
        if (kindOf(level, seed) !== 'shadow') continue;
        const { board, solution } = generateBoard(level, seed, { small });
        const where = `${level}단계 ${seed}번${small ? ' 작은 판' : ''}`;
        assert.equal(checkBoard(board), null, where);
        assert.deepEqual(generateBoard(level, seed, { small }).board, board, where);
        if (small) assert.equal(board.set.length, 4, where);
        else assert.deepEqual(board.set, SEVEN, where);
        assert.ok(!hasHole(board.shadow), where);
        const shapes = board.set.map((type) => PIECES[type]);
        if (solution.possible) {
          assert.equal(board.shadow.length, setArea(board.set), where);
          assert.ok(bruteFillCount(board.shadow, shapes, 1) > 0, where);
        } else {
          assert.equal(solution.reason, 'area', where);
          if (!(level === 4 && seed === 2 && !small)) assert.equal(Math.abs(board.shadow.length - setArea(board.set)), 1, where);
          assert.equal(bruteFillCount(board.shadow, shapes), 0, where);
        }
        if (!small) counts[level][solution.possible ? 'yes' : 'no'] += 1;
      }
    }
  }
  assert.ok(counts[4].no >= 20 && counts[4].no <= 45, JSON.stringify(counts[4]));
  assert.ok(counts[5].no >= 4 && counts[5].no <= 18, JSON.stringify(counts[5]));
});

test('다음 판 번호는 방금 한 판과 다른 판이 나오는 번호다', () => {
  for (const level of [1, 2, 3, 4, 5]) {
    for (const seed of [1, 2, 5]) {
      const next = nextSeed(level, seed);
      assert.ok(next > seed);
      assert.notDeepEqual(generateBoard(level, next).board, generateBoard(level, seed).board, `${level}단계 ${seed}번`);
    }
  }
});

test('"더 작은 판": 같은 종류의 작은 판. 네모는 칸이 3분의 2 이하이고 자르는 수가 같은 되는 도형, 그림자는 조각 넷, 나누기는 빵이나 사람이 적다', () => {
  assert.equal(SMALLER.cutpaste, smallerCutpaste);
  let none = 0;
  for (const level of [1, 2, 3, 4, 5]) {
    for (const seed of SEEDS.slice(0, 40)) {
      const { board, solution } = generateBoard(level, seed);
      const origin = { mode: board.kind, board };
      for (const turn of [0, 1, 2, 3]) {
        const small = smallerCutpaste(origin, turn);
        const where = `${level}단계 ${seed}번 ${turn}번째`;
        if (!small) {
          // 더 줄일 수 없는 나누기(빵 2개와 3명, 빵 3개와 2명)
          assert.equal(board.kind, 'share', where);
          assert.equal(board.m + board.n, 5, where);
          none += turn === 0 ? 1 : 0;
          continue;
        }
        const next = small.board;
        assert.equal(checkBoard(next), null, where);
        assert.equal(next.kind, board.kind, where);
        assert.deepEqual(smallerCutpaste(origin, turn), small, `${where}: 같은 판에서는 같은 작은 판`);
        const possible = solve(next).possible;
        if (board.kind === 'move') {
          assert.equal(next.cuts, board.cuts, where);
          assert.ok(next.cells.length * 3 <= board.cells.length * 2 && next.cells.length >= 4, where);
          assert.equal(possible, true, where);
        } else if (board.kind === 'shadow') {
          assert.equal(next.set.length, 4, where);
          assert.ok(next.set.every((type) => SEVEN.includes(type)), where);
          // 채울 수 있는 그림자에서는 채울 수 있는 것만, 아니면 채울 수 있는 것부터 번갈아
          assert.equal(possible, solution.possible || turn % 2 === 0, where);
        } else {
          assert.ok(next.m <= board.m && next.n <= board.n && next.m + next.n < board.m + board.n, where);
          assert.equal(possible, true, where);
        }
      }
    }
  }
  assert.ok(none > 0, '가장 작은 나누기에는 작은 판이 없다');
  assert.deepEqual(smallerPairs({ m: 3, n: 4 }), [[3, 2], [2, 3]]);
  assert.deepEqual(smallBoards({ board: { kind: 'share', m: 2, n: 3 } }), { yes: [], no: [] });
  assert.equal(smallerCutpaste({ board: null }), null);
  assert.equal(smallerCutpaste({ board: { kind: 'share', m: 9, n: 3 } }), null);
});
