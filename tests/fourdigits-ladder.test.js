// 숫자 넷으로 수 만들기의 사다리와 판 내기, 더 작은 판 점검. 목표 수가 되는지, 분수를 거쳐야만 나오는지, 처음 막히는 수는 다른 방법(tests/helpers/brute-fourdigits.js)으로 다시 따진다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FIRST_BOARDS, FRACTION_BOARDS, FRACTION_HIGH, FRACTION_LOW, FOUR_HIGH, FOUR_LOW, FOUR_TARGETS, LADDER, MAKE_LEVEL, RUN_HIGH, RUN_LOW, RUN_SETS, SAME_DIGITS, THREE_HIGH, THREE_LOW, TOP_LEVEL, generateBoard, nextSeed, rungOf, smallBoards } from '../src/core/fourdigits-ladder.js';
import { boardKey, checkBoard, firstMissing, needsFraction, sameBoard } from '../src/core/fourdigits.js';
import { smallerFourdigits } from '../src/core/smaller.js';
import { bruteMissing, bruteReach } from './helpers/brute-fourdigits.js';

const SEEDS = Array.from({ length: 40 }, (_, index) => index + 1);
const sum = (digits) => digits.reduce((total, digit) => total + digit, 0);
const product = (digits) => digits.reduce((total, digit) => total * digit, 1);
const all4 = [];
for (let a = 1; a <= 9; a++) for (let b = a; b <= 9; b++) for (let c = b; c <= 9; c++) for (let d = c; d <= 9; d++) all4.push([a, b, c, d]);
/** 다른 방법으로 따진 것은 숫자마다 한 번만 */
const bruteMemo = new Map();
const brute = (digits) => {
  const key = digits.slice().sort((a, b) => a - b).join('');
  if (!bruteMemo.has(key)) bruteMemo.set(key, bruteReach(digits, 99));
  return bruteMemo.get(key);
};

test('사다리: 여섯 단계, 맨 위는 직접 만들기. 단계의 종류와 표시', () => {
  assert.deepEqual(LADDER.map((rung) => rung.mode), ['three', 'four', 'run', 'same', 'fraction', 'make']);
  assert.deepEqual(LADDER.map((rung) => rung.tag), ['basic', 'basic', 'applied', 'applied', 'challenge', 'challenge']);
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  assert.throws(() => generateBoard(6, 1));
  assert.throws(() => generateBoard(1, 0));
  assert.throws(() => rungOf(7));
});

test('단계마다 첫 판은 정해 둔 판이다. 작은 판(맨 아래 단계)은 첫 판이다', () => {
  assert.deepEqual(generateBoard(1, 1).board, { kind: 'target', digits: [2, 3, 4], targets: [10] });
  assert.deepEqual(generateBoard(2, 1).board, { kind: 'target', digits: [1, 2, 3, 4], targets: [10, 21, 25] });
  assert.deepEqual(generateBoard(3, 1).board, { kind: 'run', digits: [1, 1, 2, 3] });
  assert.deepEqual(generateBoard(4, 1).board, { kind: 'run', digits: [4, 4, 4, 4] });
  assert.deepEqual(generateBoard(5, 1).board, { kind: 'target', digits: [1, 1, 4, 4], targets: [5] });
  assert.deepEqual(generateBoard(1, 9, { small: true }).board, generateBoard(1, 1).board);
  assert.equal(generateBoard(2, 9, { small: true }).small, false);
  // 첫 판을 고쳐도 다음에 내는 판이 바뀌지 않는다
  generateBoard(1, 1).board.targets.push(99);
  assert.deepEqual(generateBoard(1, 1).board.targets, [10]);
  assert.equal(FIRST_BOARDS.three.targets.length, 1);
});

test('1단계 숫자 셋으로: 서로 다른 숫자 셋, 목표 수 하나(5~30). 분수 없이 되고 모두 더하거나 모두 곱한 수가 아니다', () => {
  for (const seed of SEEDS) {
    const { board } = generateBoard(1, seed);
    assert.equal(checkBoard(board), null, `${seed}번`);
    assert.equal(board.digits.length, 3);
    assert.equal(new Set(board.digits).size, 3);
    assert.deepEqual(board.digits, board.digits.slice().sort((a, b) => a - b));
    assert.equal(board.targets.length, 1);
    const [target] = board.targets;
    assert.ok(target >= THREE_LOW && target <= THREE_HIGH, `${seed}번`);
    assert.ok(brute(board.digits).plain.has(target), `${seed}번: ${boardKey(board)}`);
    if (seed > 1) assert.ok(target !== sum(board.digits) && target !== product(board.digits), `${seed}번`);
  }
});

test('2단계 숫자 넷으로: 숫자 넷(같은 숫자는 둘까지), 서로 다른 목표 수 셋(10~40). 저마다 분수 없이 되고 모두 더하거나 모두 곱한 수가 아니다', () => {
  for (const seed of SEEDS) {
    const { board } = generateBoard(2, seed);
    assert.equal(checkBoard(board), null, `${seed}번`);
    assert.equal(board.digits.length, 4);
    assert.ok(new Set(board.digits).size >= 3, `${seed}번`);
    assert.equal(board.targets.length, FOUR_TARGETS);
    assert.deepEqual(board.targets, board.targets.slice().sort((a, b) => a - b));
    for (const target of board.targets) {
      assert.ok(target >= FOUR_LOW && target <= FOUR_HIGH, `${seed}번`);
      assert.ok(brute(board.digits).plain.has(target), `${seed}번: ${boardKey(board)} ${target}`);
      if (seed > 1) assert.ok(target !== sum(board.digits) && target !== product(board.digits), `${seed}번`);
    }
  }
});

test('3단계 1부터 차례로: 처음 막히는 수가 10~16인 숫자 넷을 모두 적어 두었다. 낸 판의 처음 막히는 수는 다른 방법으로도 같다', () => {
  const expected = all4.filter((digits) => {
    const missing = firstMissing(digits);
    return missing >= RUN_LOW && missing <= RUN_HIGH && new Set(digits).size >= 3;
  });
  assert.deepEqual(RUN_SETS, expected);
  const seen = new Set();
  for (const seed of SEEDS) {
    const { board } = generateBoard(3, seed);
    assert.equal(board.kind, 'run');
    assert.equal(checkBoard(board), null);
    seen.add(board.digits.join(''));
  }
  assert.ok(seen.size >= 20, `${seen.size}가지`);
  for (const key of [...seen].slice(0, 12)) {
    const digits = [...key].map(Number);
    const missing = bruteMissing(digits);
    assert.equal(firstMissing(digits), missing, key);
    assert.ok(missing >= RUN_LOW && missing <= RUN_HIGH, key);
  }
  assert.equal(bruteMissing([1, 1, 2, 3]), 11);
});

test('4단계 네 개의 같은 숫자: 2, 3, 4, 5, 6을 넷씩. 1부터 6, 10, 9, 7, 8까지 된다', () => {
  const ends = SAME_DIGITS.map((digit) => bruteMissing([digit, digit, digit, digit]) - 1);
  assert.deepEqual(ends, [6, 10, 9, 7, 8]);
  assert.deepEqual(SAME_DIGITS.map((digit) => firstMissing([digit, digit, digit, digit]) - 1), ends);
  const seen = new Set();
  for (const seed of SEEDS) {
    const { board } = generateBoard(4, seed);
    assert.equal(board.kind, 'run');
    assert.equal(new Set(board.digits).size, 1);
    assert.ok(SAME_DIGITS.includes(board.digits[0]));
    seen.add(board.digits[0]);
  }
  assert.equal(seen.size, SAME_DIGITS.length);
  // 1, 7, 8, 9를 넷씩 놓으면 1부터 4, 3, 4, 3까지뿐이라 넣지 않았다
  assert.deepEqual([1, 7, 8, 9].map((digit) => firstMissing([digit, digit, digit, digit]) - 1), [4, 3, 4, 3]);
});

test('5단계 까다로운 목표 수: 분수를 거쳐야만 나오는 목표 수(10~30)를 모두 적어 두었다. 고른 판은 다른 방법으로도 그렇다', () => {
  const expected = [];
  for (const digits of all4) for (let n = FRACTION_LOW; n <= FRACTION_HIGH; n++) if (needsFraction(digits, n)) expected.push(`${digits.join('')}>${n}`);
  assert.deepEqual(FRACTION_BOARDS.map((board) => `${board.digits.join('')}>${board.targets[0]}`), expected);
  assert.equal(FRACTION_BOARDS.length, 221);
  const boards = SEEDS.slice(0, 16).map((seed) => generateBoard(5, seed).board);
  for (const board of boards) {
    const [target] = board.targets;
    const found = brute(board.digits);
    assert.ok(found.all.has(target) && !found.plain.has(target), boardKey(board));
  }
  // 첫 판 1, 1, 4, 4로 5는 분수를 거쳐야만 나온다
  assert.ok(brute([1, 1, 4, 4]).all.has(5) && !brute([1, 1, 4, 4]).plain.has(5));
});

test('같은 번호는 늘 같은 판이고, 다음 판 번호는 방금 한 판과 같은 판을 건너뛴다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of SEEDS.slice(0, 15)) {
      assert.deepEqual(generateBoard(level, seed), generateBoard(level, seed));
      const next = nextSeed(level, seed);
      assert.ok(next > seed);
      assert.ok(!sameBoard(generateBoard(level, next).board, generateBoard(level, seed).board), `${level}단계 ${seed}번`);
    }
  }
  assert.equal(nextSeed(MAKE_LEVEL, 3), 4);
});

/** a가 b에서 하나를 뺀 숫자들인가 */
function dropsOne(small, big) {
  const rest = big.slice();
  for (const digit of small) {
    const at = rest.indexOf(digit);
    if (at < 0) return false;
    rest.splice(at, 1);
  }
  return rest.length === 1;
}

test('더 작은 판: 숫자 카드를 하나 뺀 같은 종류의 판. 목표 수는 분수 없이 되고, 1부터 차례로는 숫자 셋으로 이어진다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of SEEDS.slice(0, 20)) {
      const { board } = generateBoard(level, seed);
      const list = smallBoards(board);
      const origin = { mode: rungOf(level).mode, board };
      if (list.length === 0) {
        assert.equal(smallerFourdigits(origin, 0), null);
        continue;
      }
      for (const [turn, small] of list.entries()) {
        assert.deepEqual(smallerFourdigits(origin, turn), { board: small });
        assert.equal(checkBoard(small), null, `${level}단계 ${seed}번`);
        assert.ok(dropsOne(small.digits, board.digits), `${level}단계 ${seed}번`);
        if (small.kind === 'run') {
          assert.equal(board.kind, 'run');
          assert.ok(bruteMissing(small.digits) >= 3, boardKey(small));
        } else {
          for (const target of small.targets) assert.ok(brute(small.digits).plain.has(target), `${boardKey(small)} ${target}`);
          if (board.kind === 'target') assert.ok(small.targets.length <= board.targets.length);
        }
      }
      // 차례는 돌아간다
      assert.deepEqual(smallerFourdigits(origin, list.length), smallerFourdigits(origin, 0));
    }
  }
  // 까다로운 목표 수: 숫자 셋인 작은 판은 같은 목표 수를 분수 없이 만든다(되는 판부터)
  assert.deepEqual(smallBoards({ kind: 'target', digits: [1, 3, 4, 6], targets: [24] })[0], { kind: 'target', digits: [1, 3, 6], targets: [24] });
  // 네 개의 4는 숫자 셋으로 1을 만들 수 없어서, 세 개의 4로 만들 수 있는 가장 작은 수 셋을 목표 수로 한다
  assert.equal(bruteMissing([4, 4, 4]), 1);
  assert.deepEqual(smallBoards({ kind: 'run', digits: [4, 4, 4, 4] }), [{ kind: 'target', digits: [4, 4, 4], targets: [2, 3, 4] }]);
  // 1부터 차례로 하는 숫자 넷은 숫자 셋인 1부터 차례로가 된다
  assert.deepEqual(smallBoards({ kind: 'run', digits: [1, 2, 3, 4] }).map((small) => small.digits), [[1, 2, 3], [1, 2, 4], [1, 3, 4], [2, 3, 4]]);
  // 가장 작은 판에는 없다
  assert.deepEqual(smallBoards({ kind: 'run', digits: [1, 2, 3] }), []);
  assert.deepEqual(smallBoards({ kind: 'target', digits: [2, 3], targets: [6] }), []);
  assert.equal(smallerFourdigits({ board: { kind: 'target', digits: [2, 3], targets: [6] } }), null);
  assert.equal(smallerFourdigits({ board: null }), null);
});
