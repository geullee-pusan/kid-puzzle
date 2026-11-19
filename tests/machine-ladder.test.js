// 규칙 기계와 규칙이 깨지는 판의 사다리: 단계마다 판 번호 1~100(작은 판도)의 모든 판을 다른 방법으로 다시 풀어 견주고,
// 판의 꼴(첫 판, 넣은 수가 없는 판의 비율, 되풀이가 보이는 칸, 가장 긴 줄)과 "더 작은 판"을 확인한다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { applyMachine, checkBoard, fallingBest, firstBreak, preimagesOf } from '../src/core/machine.js';
import { BACK_LIMIT, CIRCLE_BOARDS, FAR_CAP, LADDER, MACHINES, MAKE_LEVEL, PRIME_BOARDS, RECORD_LIMITS, SMALL_LIMIT, TOP_LEVEL, generateBoard, nextSeed, rungOf, smallBoards } from '../src/core/machine-ladder.js';
import { smallerMachine } from '../src/core/smaller.js';
import { bruteCycle, bruteFalling, bruteRow, bruteStep } from './helpers/brute-machine.js';

const SEEDS = Array.from({ length: 100 }, (_, at) => at + 1);
const bruteApply = (machine, n) => machine.steps.reduce((value, step) => bruteStep(step, value), n);

test('사다리: 여섯 단계, 맨 위는 직접 만들기. 단계마다 판의 종류가 정해져 있다', () => {
  assert.deepEqual(LADDER.map((rung) => rung.level), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(LADDER.map((rung) => rung.tag), ['basic', 'basic', 'applied', 'applied', 'challenge', 'challenge']);
  assert.deepEqual(LADDER.map((rung) => rung.modes), [['fill'], ['back', 'box'], ['far'], ['record'], ['circle', 'prime'], ['make']]);
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  assert.throws(() => generateBoard(6, 1));
  assert.throws(() => rungOf(7));
});

test('첫 판들: 실패할 수 없는 "자리를 뒤집고 1을 더해요" 13에서 네 칸, 57에서 75번째 칸, 99까지의 두 수, 원 넷과 다섯', () => {
  assert.deepEqual(generateBoard(1, 1).board, { kind: 'fill', machine: MACHINES.revAdd, start: [13], count: 4 });
  assert.deepEqual(generateBoard(3, 1).board, { kind: 'far', machine: MACHINES.revAdd, start: [57], target: 75, cap: FAR_CAP });
  assert.deepEqual(generateBoard(4, 1).board, { kind: 'record', machine: MACHINES.pair, limit: 99 });
  assert.deepEqual(generateBoard(4, 2).board, { kind: 'record', machine: MACHINES.product, limit: 999 });
  assert.deepEqual(generateBoard(5, 1).board, { kind: 'circle', counts: [4, 5], guess: 6 });
  assert.deepEqual(generateBoard(5, 2).board, { kind: 'prime', add: 41, upTo: 40 });
  assert.equal(generateBoard(2, 1).board.kind, 'back');
  assert.equal(generateBoard(2, 2).board.kind, 'box');
});

test('모든 판(단계마다 1~100번, 작은 판도)을 다른 방법으로 다시 풀면 같은 답이다', () => {
  const backCounts = { none: 0, some: 0 };
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of SEEDS) {
      for (const small of [false, true]) {
        const made = generateBoard(level, seed, { small });
        const { board, solution } = made;
        const where = `${level}단계 ${seed}번${small ? ' 작은 판' : ''}`;
        assert.equal(checkBoard(board), null, where);
        assert.deepEqual(generateBoard(level, seed, { small }), made, `${where}: 같은 번호는 같은 판`);
        if (board.kind === 'fill') {
          assert.deepEqual(solution.cells, bruteRow(board.machine, board.start, board.start.length + board.count), where);
          assert.ok(board.count >= (small ? 2 : 3), where);
          assert.ok(solution.cells.every((n) => n < 10000), `${where}: 수가 너무 커요`);
        }
        if (board.kind === 'back') {
          const brute = [];
          for (let n = 1; n <= board.limit; n++) if (bruteApply(board.machine, n) === board.target) brute.push(n);
          assert.deepEqual(solution.answers, brute, where);
          assert.ok(brute.length <= 4, `${where}: 넣은 수가 너무 많아요`);
          assert.equal(board.limit, small ? SMALL_LIMIT : BACK_LIMIT);
          if (!small) backCounts[brute.length === 0 ? 'none' : 'some'] += 1;
        }
        if (board.kind === 'box') {
          assert.deepEqual(solution.outputs, board.asks.map((n) => bruteApply(board.machine, n)), where);
          assert.equal(board.asks.length, small ? 1 : 3);
          // 맞힐 수는 보기와 겹치지 않는다
          for (const n of board.asks) assert.ok(!board.shown.includes(n), where);
        }
        if (board.kind === 'far') {
          const brute = bruteCycle(board.machine, board.start);
          assert.deepEqual([solution.mu, solution.lambda], [brute.mu, brute.lambda], where);
          assert.equal(solution.value, bruteRow(board.machine, board.start, board.target)[board.target - 1], where);
          // 돌려 볼 수 있는 칸 안에서 되풀이가 다시 시작되는 칸까지 보인다. 되풀이는 세 칸 이상이다
          assert.ok(brute.mu + brute.lambda + 1 <= board.cap, where);
          assert.ok(brute.lambda >= 3, where);
          assert.ok(board.target > board.cap, `${where}: 맞힐 칸은 돌려 볼 수 없는 칸이에요`);
          assert.equal(board.target, small ? 30 : [75, 50, 100][(seed - 1) % 3]);
        }
        if (board.kind === 'record') {
          const limit = board.limit;
          const best = fallingBest(board.machine, limit);
          let bruteBest = 0;
          for (let a = 1; a <= limit; a++) for (let b = 1; b <= (board.machine.kind === 'pair' ? limit : 1); b++) bruteBest = Math.max(bruteBest, bruteFalling(board.machine, board.machine.kind === 'pair' ? [a, b] : [a]));
          assert.equal(solution.best, bruteBest, where);
          assert.equal(best.best, bruteBest);
        }
        if (board.kind === 'circle') assert.equal(solution.answer, [1, 2, 4, 8, 16, 31, 57][board.guess - 1], where);
        if (board.kind === 'prime') assert.equal(solution.first, firstBreak(board.add), where);
      }
    }
  }
  // 넣은 수가 하나도 없는 판이 셋에 하나쯤(늘 있거나 늘 없으면 찍게 된다)
  const share = backCounts.none / (backCounts.none + backCounts.some);
  assert.ok(share > 0.2 && share < 0.45, `없는 판 ${backCounts.none}/${backCounts.none + backCounts.some}`);
});

test('다음 판 번호: 방금 한 판과 똑같은 판이 나오는 번호는 건너뛴다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of [1, 2, 3, 10]) {
      const next = nextSeed(level, seed);
      assert.ok(next > seed);
      if (level !== 4 && level !== 5) assert.notDeepEqual(generateBoard(level, next).board, generateBoard(level, seed).board, `${level}단계 ${seed}번`);
    }
  }
});

test('더 작은 판: 같은 종류에서 칸이 적거나, 넣을 수가 작거나, 맞힐 칸이 가깝거나, 고를 수가 작거나, 점이 적거나, 더 일찍 깨진다', () => {
  let none = 0;
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of SEEDS) {
      const { board } = generateBoard(level, seed);
      const where = `${level}단계 ${seed}번`;
      const list = smallBoards(board);
      if (list.length === 0) none += 1;
      for (const small of list) {
        assert.equal(checkBoard(small), null, where);
        assert.equal(small.kind, board.kind, where);
        if (board.kind === 'fill') {
          assert.ok(small.count < board.count, where);
          assert.deepEqual([small.machine, small.start], [board.machine, board.start]);
        }
        if (board.kind === 'back') {
          assert.equal(small.limit, SMALL_LIMIT);
          assert.deepEqual(small.machine, board.machine);
          // 넣은 수가 없는 판에서 왔으면 없는 판(그런 것이 있을 때), 있는 판에서 왔으면 있는 판
          const from = preimagesOf(board.machine, board.target, 1, board.limit).length;
          const to = preimagesOf(small.machine, small.target, 1, small.limit).length;
          if (from > 0) assert.ok(to > 0, where);
        }
        if (board.kind === 'box') {
          assert.deepEqual(small.machine, board.machine);
          assert.equal(small.asks.length, 1);
          assert.equal(applyMachine(small.machine, small.asks[0]), bruteApply(small.machine, small.asks[0]));
        }
        if (board.kind === 'far') assert.ok(small.target < board.target && small.target > small.cap, where);
        if (board.kind === 'record') assert.ok(small.limit < board.limit && RECORD_LIMITS[board.machine.kind === 'pair' ? 'pair' : 'product'].includes(small.limit), where);
        if (board.kind === 'circle') assert.ok(small.guess < board.guess, where);
        if (board.kind === 'prime') assert.ok(small.upTo < board.upTo, where);
      }
      for (const turn of [0, 1, 2, 3]) {
        const small = smallerMachine({ mode: board.kind, board }, turn);
        assert.deepEqual(small, list.length > 0 ? { board: list[turn % list.length] } : null, where);
        assert.deepEqual(smallerMachine({ mode: board.kind, board }, turn), small, `${where}: 같은 판에서는 같은 작은 판`);
      }
    }
  }
  assert.equal(none, 0, '모든 판에 더 작은 판이 있다');
  // 가장 작은 판에는 없다
  assert.deepEqual(smallBoards(CIRCLE_BOARDS.at(-1)), []);
  assert.deepEqual(smallBoards(PRIME_BOARDS.at(-1)), []);
  assert.deepEqual(smallBoards({ kind: 'record', machine: MACHINES.pair, limit: 20 }), []);
  assert.deepEqual(smallBoards({ kind: 'fill', machine: MACHINES.revAdd, start: [13], count: 1 }), []);
  assert.equal(smallerMachine({ board: null }), null);
  assert.equal(smallerMachine({ board: { kind: 'circle', counts: [9], guess: 10 } }), null);
});

test('사다리의 기계는 되풀이가 짧고, 두 수 기계의 처음 칸은 큰 수가 앞에 온다', () => {
  for (const seed of SEEDS) {
    const { board } = generateBoard(1, seed);
    if (board.machine.kind === 'pair') assert.ok(board.start[0] > board.start[1]);
  }
  // 먼 칸 맞히기에 쓰는 처음 칸은 되풀이 앞에 칸이 있다(7을 곱해 끝 두 자리만 남기는 기계는 처음부터 되풀이된다)
  for (const seed of SEEDS) {
    const { board } = generateBoard(3, seed);
    const { mu } = bruteCycle(board.machine, board.start);
    if (JSON.stringify(board.machine) !== JSON.stringify(MACHINES.seven)) assert.ok(mu >= 2, `${seed}번`);
  }
});
