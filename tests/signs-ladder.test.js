// 부호 넣어 수 만들기의 사다리와 판 내기, 더 작은 판 점검. 되는지 안 되는지는 다른 방법(tests/helpers/brute-signs.js)으로 다시 따진다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, impossibleAt, nextSeed, rungOf, smallBoards } from '../src/core/signs-ladder.js';
import { checkBoard, sameBoard, totalOf } from '../src/core/signs.js';
import { smallerSigns } from '../src/core/smaller.js';
import { bruteMissing, hopOf, rowOf } from './helpers/brute-signs.js';

const SEEDS = Array.from({ length: 60 }, (_, index) => index + 1);
/** 다른 방법으로 따진 "되는 판인가" */
function canBrute(board) {
  if (board.kind === 'row') return rowOf(board.n).has(board.target);
  if (board.kind === 'hop') return hopOf(board.n).has(board.target);
  return false;
}

test('사다리: 여섯 단계, 맨 위는 직접 만들기. 단계의 종류와 표시', () => {
  assert.deepEqual(LADDER.map((rung) => rung.mode), ['five', 'seven', 'all', 'hop', 'largest', 'make']);
  assert.deepEqual(LADDER.map((rung) => rung.tag), ['basic', 'basic', 'applied', 'applied', 'challenge', 'challenge']);
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  assert.throws(() => generateBoard(6, 1));
  assert.throws(() => generateBoard(1, 0));
  assert.throws(() => rungOf(7));
});

test('1단계 5부터 1까지: 대개 되는 판, 여섯 판에 하나만 안 되는 판. 첫 판과 처음 만나는 안 되는 판은 정해 둔 판이다', () => {
  assert.deepEqual(generateBoard(1, 1).board, { kind: 'row', n: 4, target: 8 });
  assert.deepEqual(generateBoard(1, 3).board, { kind: 'row', n: 3, target: 3 });
  assert.deepEqual(generateBoard(1, 7, { small: true }).board, { kind: 'row', n: 4, target: 8 });
  for (const seed of SEEDS) {
    const { board } = generateBoard(1, seed);
    assert.equal(checkBoard(board), null);
    assert.equal(board.kind, 'row');
    assert.ok(board.n >= 3 && board.n <= 5);
    const no = impossibleAt(rungOf(1), seed);
    assert.equal(no, (seed - 1) % 6 === 2);
    assert.equal(canBrute(board), !no, `${seed}번`);
    // 목표 수는 모두 +일 때보다 작다(안 되는 판도 크기가 아니라 홀짝으로 안 된다)
    assert.ok(board.target < totalOf(board.n), `${seed}번`);
    if (!no) assert.ok(rowOf(board.n).get(board.target).fewest >= 1);
  }
});

test('2단계 7부터 1까지: 여섯 판에 둘이 안 되는 판이고 연달아 나오지 않는다. 되는 판은 − 부호를 둘 이상 넣어야 닿는다', () => {
  let none = 0;
  for (const seed of SEEDS) {
    const { board } = generateBoard(2, seed);
    assert.ok([6, 7].includes(board.n));
    const no = impossibleAt(rungOf(2), seed);
    assert.equal(canBrute(board), !no, `${seed}번`);
    if (no) {
      none += 1;
      assert.ok(!impossibleAt(rungOf(2), seed + 1));
      assert.ok(board.target >= 1 && board.target < totalOf(board.n));
    } else assert.ok(rowOf(board.n).get(board.target).fewest >= 2, `${seed}번`);
  }
  assert.equal(none, 20);
});

test('3단계 모두 찾기: 4~6부터 1까지의 줄, 띠는 모두 +일 때 + 2나 3까지. 크기 때문에만 안 되는 수(모두 +일 때 + 2)가 띠에 있다', () => {
  assert.deepEqual(generateBoard(3, 1).board, { kind: 'all', n: 4, top: 12 });
  for (const seed of SEEDS) {
    const { board } = generateBoard(3, seed);
    const total = totalOf(board.n);
    assert.ok([4, 5, 6].includes(board.n));
    assert.ok([total + 2, total + 3].includes(board.top));
    assert.ok(board.top <= 24);
    const missing = bruteMissing(board.n, board.top);
    assert.ok(missing.includes(total + 2));
    // 띠의 만들 수 없는 수는 모두 크기나 홀짝으로 보인다
    for (const value of missing) assert.ok(value > total || (total - value) % 2 === 1);
  }
});

test('4단계 메뚜기: 대개 제자리(0). 여섯 판에 둘이 안 되는 판이다. 첫 판은 세 번 뛰어 제자리, 처음 안 되는 판은 두 번 뛰어 제자리', () => {
  assert.deepEqual(generateBoard(4, 1).board, { kind: 'hop', n: 3, target: 0 });
  assert.deepEqual(generateBoard(4, 2).board, { kind: 'hop', n: 2, target: 0 });
  let zero = 0;
  for (const seed of SEEDS) {
    const { board } = generateBoard(4, seed);
    assert.equal(board.kind, 'hop');
    assert.ok(board.n >= 2 && board.n <= 7);
    assert.equal(canBrute(board), !impossibleAt(rungOf(4), seed), `${seed}번`);
    assert.ok(Math.abs(board.target) < totalOf(board.n));
    zero += board.target === 0 ? 1 : 0;
  }
  assert.ok(zero > SEEDS.length / 2, `제자리 ${zero}판`);
});

test('5단계 가장 큰 수: 8, 9, 10부터 1까지의 줄', () => {
  const ns = new Set();
  for (const seed of SEEDS) {
    const { board } = generateBoard(5, seed);
    assert.equal(board.kind, 'largest');
    ns.add(board.n);
  }
  assert.deepEqual([...ns].sort((a, b) => a - b), [8, 9, 10]);
});

test('같은 번호는 늘 같은 판이고, 다음 번호는 방금 한 판과 같은 판을 건너뛴다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of SEEDS.slice(0, 20)) {
      assert.deepEqual(generateBoard(level, seed), generateBoard(level, seed));
      const next = nextSeed(level, seed);
      assert.ok(next > seed);
      assert.ok(!sameBoard(generateBoard(level, next).board, generateBoard(level, seed).board));
    }
  }
});

test('더 작은 판: 맨 앞의 수(뛰는 횟수)가 하나, 둘 적은 같은 종류의 판. 되는 판에서는 되는 판만, 안 되는 판에서는 되는 판부터 번갈아', () => {
  let none = 0;
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of SEEDS.slice(0, 30)) {
      const { board } = generateBoard(level, seed);
      const origin = { mode: rungOf(level).mode, board };
      const can = canBrute(board);
      for (const turn of [0, 1, 2, 3]) {
        const small = smallerSigns(origin, turn);
        const floor = { row: 3, all: 3, hop: 2, largest: 5 }[board.kind];
        if (board.n <= floor) {
          assert.equal(small, null, `${level}단계 ${seed}번`);
          none += 1;
          continue;
        }
        assert.ok(small, `${level}단계 ${seed}번 ${turn}`);
        assert.equal(checkBoard(small.board), null);
        assert.equal(small.board.kind, board.kind);
        assert.ok(small.board.n < board.n && small.board.n >= board.n - 2);
        assert.deepEqual(smallerSigns(origin, turn), small);
        if (board.kind === 'row' || board.kind === 'hop') {
          const lists = smallBoards(board);
          const smallCan = canBrute(small.board);
          if (can) assert.equal(smallCan, true, `${level}단계 ${seed}번 ${turn}`);
          else if (lists.no.length > 0) assert.equal(smallCan, turn % 2 === 0, `${level}단계 ${seed}번 ${turn}`);
          // 줄의 작은 판은 목표 수가 모두 +일 때보다 작다(바로 끝나는 판이 아니다)
          if (board.kind === 'row') assert.ok(small.board.target < totalOf(small.board.n));
        }
        if (board.kind === 'all') assert.equal(small.board.top, totalOf(small.board.n) + 2);
      }
    }
  }
  assert.ok(none > 0);
  // 직접 만든 판(목표 수가 모두 +일 때보다 큰 판)에서도 작은 판을 낸다
  const big = smallerSigns({ mode: 'made', board: { kind: 'row', n: 6, target: 24 } }, 0);
  assert.equal(rowOf(big.board.n).has(big.board.target), true);
  assert.equal(smallerSigns({ mode: 'made', board: null }), null);
});
