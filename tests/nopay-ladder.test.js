// 낼 수 없는 금액의 사다리와 판 내기, 더 작은 판 점검. 낼 수 없는 금액과 끝이 있는지는 다른 방법(tests/helpers/brute-nopay.js)으로 다시 따진다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LADDER, MAKE_COINS, MAKE_FIRST, MAKE_LEVEL, TOP_LEVEL, generateBoard, impossibleAt, kindOf, madeBoard, nextSeed, possibleOf, rungOf, smallBoards } from '../src/core/nopay-ladder.js';
import { checkBoard, endOf, sameBoard, solve } from '../src/core/nopay.js';
import { smallerNopay } from '../src/core/smaller.js';
import { bruteGcd, bruteUnpayable } from './helpers/brute-nopay.js';

const SEEDS = Array.from({ length: 60 }, (_, index) => index + 1);

/** 다른 방법으로 따진 띠의 사실: 끝이 있는가, 띠 안의 낼 수 없는 금액, 줄로 나눠 놓았을 때 칠할 칸이 하나도 없는 가로줄 */
function factsOf(board) {
  const { coins, top } = board;
  const missing = bruteUnpayable(coins, top);
  const small = coins[0];
  const emptyRows = Array.from({ length: small }, (_, row) => row + 1).filter((first) => {
    for (let amount = first; amount <= top; amount += small) if (!missing.includes(amount)) return false;
    return true;
  });
  return { end: bruteGcd(coins) === 1, missing, emptyRows };
}

test('사다리: 여섯 단계, 맨 위는 직접 만들기. 단계의 종류와 표시', () => {
  assert.deepEqual(LADDER.map((rung) => rung.mode), ['first', 'more', 'from', 'end', 'three', 'make']);
  assert.deepEqual(LADDER.map((rung) => rung.tag), ['basic', 'basic', 'applied', 'applied', 'challenge', 'challenge']);
  assert.deepEqual(['first', 'more', 'from', 'end', 'three'].map(kindOf), ['all', 'all', 'from', 'end', 'end']);
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  assert.throws(() => generateBoard(6, 1));
  assert.throws(() => generateBoard(1, 0));
  assert.throws(() => rungOf(7));
});

test('모든 판: 규격에 맞고, 띠의 칸은 40칸 안이며 줄로 나눠 놓아도 여덟 줄 안이다. 끝이 있는 판은 띠에 작은 동전의 값만큼 잇달아 낼 수 있는 금액이 보인다', () => {
  for (const rung of LADDER.filter((item) => item.mode !== 'make')) {
    for (const seed of SEEDS) {
      const { board } = generateBoard(rung.level, seed);
      const where = `${rung.level}단계 ${seed}번`;
      assert.equal(checkBoard(board), null, where);
      assert.equal(board.kind, kindOf(rung.mode), where);
      assert.ok(board.top <= 40 && Math.ceil(board.top / board.coins[0]) <= 8, where);
      const facts = factsOf(board);
      const solution = solve(board);
      assert.equal(solution.possible, facts.end, where);
      assert.deepEqual(solution.unpayable, facts.missing, where);
      if (facts.end) {
        // 띠 끝 앞에 작은 동전의 값만큼 잇달아 낼 수 있는 금액이 있고, 그 앞이 낼 수 없는 가장 큰 금액이다
        const largest = facts.missing.at(-1) ?? 0;
        assert.equal(solution.largest, largest, where);
        assert.ok(board.top >= largest + board.coins[0], where);
        // 줄로 나눠 놓으면 모든 가로줄에 칠할 칸이 있다
        assert.deepEqual(facts.emptyRows, [], where);
      } else {
        // 끝이 없는 판의 까닭이 보인다: 줄로 나눠 놓으면 끝까지 칠할 칸이 없는 가로줄이 있다
        assert.ok(facts.emptyRows.length > 0, where);
      }
      // 다음 판 번호는 같은 판을 건너뛴다
      assert.ok(!sameBoard(generateBoard(rung.level, nextSeed(rung.level, seed)).board, board), where);
    }
  }
});

test('1·2단계(모두 찾기): 첫 판은 3원과 5원, 띠 20원까지(1, 2, 4, 7원). 1단계는 낼 수 없는 금액이 2~4개, 2단계는 5개 이상', () => {
  assert.deepEqual(generateBoard(1, 1).board, { kind: 'all', coins: [3, 5], top: 20 });
  assert.deepEqual(generateBoard(1, 9, { small: true }).board, { kind: 'all', coins: [3, 5], top: 20 });
  assert.deepEqual(solve(generateBoard(1, 1).board).unpayable, [1, 2, 4, 7]);
  for (const seed of SEEDS) {
    const one = solve(generateBoard(1, seed).board).unpayable.length;
    assert.ok(one >= 2 && one <= 4, `${seed}번 ${one}`);
    const two = solve(generateBoard(2, seed).board).unpayable.length;
    assert.ok(two >= 5 && two <= 9, `${seed}번 ${two}`);
    assert.ok(!impossibleAt(rungOf(1), seed) && !impossibleAt(rungOf(2), seed) && !impossibleAt(rungOf(3), seed));
  }
});

test('3단계(어디부터): 띠는 낼 수 없는 가장 큰 금액 뒤로 작은 동전 + 1~2칸만 있다', () => {
  assert.deepEqual(generateBoard(3, 1).board, { kind: 'from', coins: [3, 7], top: 15 });
  for (const seed of SEEDS) {
    const { board } = generateBoard(3, seed);
    const { largest } = solve(board);
    assert.ok(board.top - largest - board.coins[0] >= 1 && board.top - largest - board.coins[0] <= 2, `${seed}번`);
  }
});

test('4·5단계(끝이 있을까): 끝이 없는 판이 셋에 하나이고 연달아 나오지 않는다. 처음 만나는 끝이 없는 판은 2원과 4원이다. 5단계 2번 판은 6, 10, 15원', () => {
  assert.deepEqual(generateBoard(4, 1).board, { kind: 'end', coins: [4, 5], top: 17 });
  assert.deepEqual(generateBoard(4, 2).board, { kind: 'end', coins: [2, 4], top: 16 });
  assert.deepEqual(generateBoard(5, 1).board, { kind: 'end', coins: [4, 6, 9], top: 16 });
  assert.deepEqual(generateBoard(5, 2).board, { kind: 'end', coins: [6, 10, 15], top: 36 });
  for (const level of [4, 5]) {
    let endless = 0;
    for (const seed of SEEDS) {
      const { board } = generateBoard(level, seed);
      const no = impossibleAt(rungOf(level), seed);
      assert.equal(possibleOf(board), !no, `${level}단계 ${seed}번`);
      if (no) {
        endless += 1;
        assert.ok(!impossibleAt(rungOf(level), seed + 1));
      }
    }
    assert.equal(endless, 20);
  }
  // 5단계는 세 가지 동전이 대부분이다(큰 짝도 섞인다)
  const three = SEEDS.filter((seed) => generateBoard(5, seed).board.coins.length === 3).length;
  assert.ok(three >= 40, String(three));
});

test('직접 만든 판: 동전 1~9원, 끝이 있을까와 같은 판. 띠는 끝 뒤로 작은 동전 + 2칸(줄로 나눠 놓아도 여덟 줄 안)', () => {
  assert.deepEqual(MAKE_FIRST, [3, 5]);
  assert.deepEqual(MAKE_COINS, [1, 9]);
  for (let a = 1; a <= 9; a++) {
    for (let b = a + 1; b <= 9; b++) {
      const board = madeBoard([a, b]);
      assert.equal(checkBoard(board), null, `${a}, ${b}`);
      assert.equal(board.kind, 'end');
      const end = endOf([a, b]);
      if (end.gcd === 1) assert.equal(board.top, Math.max(Math.min(12, Math.min(40, 8 * a)), Math.min(end.largest + a + 2, Math.min(40, 8 * a))));
    }
  }
  assert.equal(madeBoard([3, 3]), null);
  assert.equal(madeBoard([3, 10]), null);
  assert.deepEqual(madeBoard([1, 5]), { kind: 'end', coins: [1, 5], top: 8 });
});

test('더 작은 판: 동전 값이 더 작은 같은 종류의 판. 끝이 없는 판은 끝이 있는 판부터 끝이 없는 판과 번갈아 낸다. 2원과 3원은 더 줄이지 않는다', () => {
  for (const rung of LADDER.filter((item) => item.mode !== 'make')) {
    for (const seed of SEEDS.slice(0, 30)) {
      const { board } = generateBoard(rung.level, seed);
      const lists = smallBoards(board);
      for (const small of [...lists.yes, ...lists.no]) {
        assert.equal(checkBoard(small), null);
        assert.equal(small.kind, board.kind);
        assert.ok(small.coins.at(-1) < board.coins.at(-1));
      }
      for (const small of lists.yes) assert.equal(bruteGcd(small.coins), 1);
      for (const small of lists.no) assert.ok(bruteGcd(small.coins) > 1);
      if (board.kind !== 'end') assert.deepEqual(lists.no, []);
      const first = smallerNopay({ board }, 0);
      if (first) assert.ok(possibleOf(first.board), `${rung.level}단계 ${seed}번: 첫 작은 판은 끝이 있는 판`);
      // 끝이 있는 판에서는 끝이 있는 판만 낸다
      if (possibleOf(board)) for (const turn of [0, 1, 2, 3]) assert.ok(!smallerNopay({ board }, turn) || possibleOf(smallerNopay({ board }, turn).board));
    }
  }
  assert.equal(smallerNopay({ board: { kind: 'all', coins: [2, 3], top: 12 } }, 0), null);
  assert.deepEqual(smallerNopay({ board: { kind: 'all', coins: [3, 5], top: 20 } }, 0).board, { kind: 'all', coins: [3, 4], top: 12 });
  assert.deepEqual(smallerNopay({ board: { kind: 'all', coins: [3, 5], top: 20 } }, 1).board, { kind: 'all', coins: [2, 3], top: 12 });
  // 4원과 6원: 끝이 있는 판(4원과 5원), 끝이 없는 판(2원과 4원)
  const endless = { kind: 'end', coins: [4, 6], top: 24 };
  assert.deepEqual([0, 1].map((turn) => smallerNopay({ board: endless }, turn).board.coins), [[4, 5], [2, 4]]);
});
