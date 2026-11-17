// 판 만들어 내기. 모든 단계에서 판 번호 수백 개를 만들어 조건을 확인한다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { RULES, applyMove, checkBoard, headCount, isMove, solve } from '../src/core/coins.js';
import { IMPOSSIBLE_RATE, LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf } from '../src/core/ladder.js';

const SEEDS = Array.from({ length: 500 }, (_, index) => index + 1);
const rungs = LADDER.filter((rung) => rung.start !== 'make');

test('사다리는 1단계부터 6단계까지이고, 맨 위는 직접 만들기다', () => {
  assert.deepEqual(LADDER.map((rung) => rung.level), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(LADDER.map((rung) => rung.tag), ['basic', 'applied', 'applied', 'challenge', 'challenge', 'challenge']);
  assert.equal(rungOf(MAKE_LEVEL).start, 'make');
  assert.equal(TOP_LEVEL, 5);
  assert.throws(() => rungOf(7));
  assert.throws(() => generateBoard(MAKE_LEVEL, 1));
  for (const rung of rungs) assert.ok(RULES[rung.rule], `${rung.level}단계의 규칙`);
});

test('기획 문서의 표와 같다: 규칙, 모양, 동전 수', () => {
  const brief = (level) => {
    const { rule, shape, start, counts } = rungOf(level);
    return { rule, shape, start, from: Math.min(...counts), to: Math.max(...counts) };
  };
  assert.deepEqual(brief(1), { rule: 'any2', shape: 'line', start: 'all-heads', from: 4, to: 6 });
  assert.deepEqual(brief(2), { rule: 'any2', shape: 'line', start: 'mixed', from: 5, to: 8 });
  assert.deepEqual(brief(3), { rule: 'any3', shape: 'line', start: 'all-heads', from: 4, to: 7 });
  assert.equal(brief(4).rule, 'adj3');
  assert.equal(brief(4).shape, 'line');
  assert.equal(brief(5).rule, 'adj3');
  assert.equal(brief(5).shape, 'ring');
});

for (const rung of rungs) {
  test(`${rung.level}단계: 같은 번호는 늘 같은 판이다`, () => {
    for (const seed of SEEDS) assert.deepEqual(generateBoard(rung.level, seed), generateBoard(rung.level, seed));
  });

  test(`${rung.level}단계: 단계의 조건에 맞고, 적어 둔 답이 풀이 프로그램의 결과와 같다`, () => {
    for (const seed of SEEDS) {
      const made = generateBoard(rung.level, seed);
      const { board, solution } = made;
      const where = `${rung.level}단계 ${seed}번 ${board.coins.join('')}`;
      assert.equal(made.level, rung.level);
      assert.equal(made.seed, seed);
      assert.equal(checkBoard(board), null, where);
      assert.equal(board.rule, rung.rule, where);
      assert.equal(board.shape, rung.shape, where);
      assert.ok(rung.counts.includes(board.n), where);
      const heads = headCount(board.coins);
      if (rung.start === 'all-heads') assert.equal(heads, board.n, where);
      else assert.ok(heads > 0 && heads < board.n, `앞뒤가 섞여 있어야 해요: ${where}`);

      // 적어 둔 답을 새로 풀어서 견준다.
      const fresh = solve(board);
      assert.deepEqual(solution, fresh, where);
      // 뻔한 판이 아니다: 이미 끝난 판, 한 번에 끝나는 판
      if (solution.possible) {
        assert.ok(solution.min >= 2, `한 번에 끝나면 안 돼요: ${where}`);
        let coins = board.coins;
        for (const move of solution.moves) {
          assert.ok(isMove(board, move), where);
          coins = applyMove(coins, move);
        }
        assert.equal(headCount(coins), 0, where);
      } else {
        assert.ok(heads >= 2, where);
      }
    }
  });
}

const impossibleShare = (level) => SEEDS.filter((seed) => !generateBoard(level, seed).solution.possible).length / SEEDS.length;

test('안 되는 판을 섞는 단계(2·4·5단계)에서는 셋에 하나쯤이 안 되는 판이다', () => {
  assert.ok(Math.abs(IMPOSSIBLE_RATE - 1 / 3) < 1e-9);
  for (const level of [2, 4, 5]) {
    assert.equal(rungOf(level).mix, true);
    const share = impossibleShare(level);
    assert.ok(share > 0.25 && share < 0.42, `${level}단계: ${share}`);
  }
});

test('1단계: 5개짜리만 안 되는 판이다(풀이 프로그램이 알려 준 대로)', () => {
  for (const seed of SEEDS) {
    const { board, solution } = generateBoard(1, seed);
    assert.equal(solution.possible, board.n !== 5);
    if (solution.possible) assert.equal(solution.min, board.n / 2);
  }
  const share = impossibleShare(1);
  assert.ok(share > 0.25 && share < 0.42, `1단계: ${share}`);
});

test('3단계: 안 되는 판이 없고, 가장 적은 횟수는 동전 수에 따라 4·3·2·3번이다', () => {
  const expected = { 4: 4, 5: 3, 6: 2, 7: 3 };
  for (const seed of SEEDS) {
    const { board, solution } = generateBoard(3, seed);
    assert.equal(solution.possible, true);
    assert.equal(solution.min, expected[board.n]);
  }
});

test('5단계: 안 되는 판은 동전이 6개나 9개인 고리에서만 나온다', () => {
  for (const seed of SEEDS) {
    const { board, solution } = generateBoard(5, seed);
    if (!solution.possible) assert.ok(board.n === 6 || board.n === 9, `${board.n}개`);
  }
});

test('단계마다 동전 수가 골고루 나온다(후보가 모두 나온다)', () => {
  for (const rung of rungs) {
    const seen = new Set(SEEDS.map((seed) => generateBoard(rung.level, seed).board.n));
    assert.deepEqual([...seen].sort(), [...rung.counts].sort(), `${rung.level}단계`);
  }
});

test('작은 판: 그 단계에서 동전 수가 가장 적은 판을 낸다', () => {
  for (const rung of rungs) {
    for (const seed of SEEDS.slice(0, 120)) {
      const made = generateBoard(rung.level, seed, { small: true });
      assert.equal(made.small, true);
      assert.equal(made.board.n, Math.min(...rung.counts), `${rung.level}단계 ${seed}번`);
      assert.deepEqual(made.solution, solve(made.board));
      assert.deepEqual(made, generateBoard(rung.level, seed, { small: true }));
    }
  }
});

test('다음 판 번호: 방금 한 판과 다른 판이 나온다', () => {
  for (const rung of rungs) {
    for (const seed of SEEDS.slice(0, 120)) {
      const next = nextSeed(rung.level, seed);
      assert.ok(next > seed);
      assert.notDeepEqual(generateBoard(rung.level, next).board, generateBoard(rung.level, seed).board, `${rung.level}단계 ${seed}번`);
    }
  }
});
