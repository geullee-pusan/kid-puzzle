// 약수 세금의 사다리와 판 내기 점검. 낸 판은 풀이 프로그램으로 다시 확인하고,
// "좋은 판"의 기준(가장 뻔한 요령인 가장 큰 카드부터 가지기로는 가장 큰 합이 나오지 않는가)을 판마다 잰다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf } from '../src/core/tax-ladder.js';
import { cardsUpTo, checkBoard, countBestOrders, greedyLargest, plainN, randomAverage, replay, solve } from '../src/core/tax.js';
import { bruteTax } from './helpers/brute-tax.js';

const playing = LADDER.filter((rung) => rung.mode !== 'make');

test('사다리: 다섯 단계이고 표시는 기본·응용·응용·도전·도전, 맨 위는 직접 만들기', () => {
  assert.deepEqual(LADDER.map((rung) => rung.level), [1, 2, 3, 4, 5]);
  assert.deepEqual(LADDER.map((rung) => rung.tag), ['basic', 'applied', 'applied', 'challenge', 'challenge']);
  assert.deepEqual(LADDER.map((rung) => rung.mode), ['play', 'play', 'play', 'play', 'make']);
  assert.equal(TOP_LEVEL, 4);
  assert.equal(MAKE_LEVEL, 5);
  assert.throws(() => rungOf(6));
  assert.throws(() => generateBoard(MAKE_LEVEL, 1));
});

test('단계마다 정해 둔 판: 1단계는 6·8·10장, 2단계는 12~16장, 3단계는 18~24장, 4단계는 25~30장', () => {
  assert.deepEqual(rungOf(1).boards, [6, 8, 10]);
  assert.deepEqual(rungOf(2).boards, [12, 14, 15, 16]);
  assert.deepEqual(rungOf(3).boards, [18, 20, 21, 24]);
  assert.deepEqual(rungOf(4).boards, [25, 26, 27, 28, 29, 30]);
  // 단계가 오르면 카드가 많아진다. 한 단계 안에서도 차례대로 많아진다.
  const all = playing.flatMap((rung) => rung.boards);
  assert.deepEqual(all, [...all].sort((a, b) => a - b));
  assert.equal(new Set(all).size, all.length);
  // 힌트 묶음: 1단계는 처음 만나는 판의 힌트, 그 위는 더 큰 판의 힌트
  assert.deepEqual(LADDER.map((rung) => rung.hint), ['start', 'more', 'more', 'more', 'more']);
});

test('같은 번호는 늘 같은 판이고, 판마다 풀이 프로그램의 결과가 붙어 있다', () => {
  for (const rung of playing) {
    for (let seed = 1; seed <= 20; seed++) {
      const made = generateBoard(rung.level, seed);
      const where = `${rung.level}단계 ${seed}번`;
      assert.deepEqual(made, generateBoard(rung.level, seed), where);
      assert.deepEqual([made.level, made.seed, made.small], [rung.level, seed, false], where);
      assert.equal(checkBoard(made.board), null, where);
      assert.equal(plainN(made.board), rung.boards[(seed - 1) % rung.boards.length], where);
      const solved = solve(made.board);
      assert.equal(solved.exact, true, where);
      assert.deepEqual(made.solution, { best: solved.best, order: solved.order, total: solved.total }, where);
      const played = replay(made.board, made.solution.order);
      assert.ok(played.ok && played.ended, where);
      assert.equal(played.sum, made.solution.best, where);
    }
  }
});

test('판 번호가 달라지면 그 단계의 판들을 차례로 돈다. "새 판"은 늘 다른 판이다', () => {
  for (const rung of playing) {
    const count = rung.boards.length;
    assert.ok(count >= 2);
    assert.deepEqual(rung.boards.map((_, index) => plainN(generateBoard(rung.level, index + 1).board)), rung.boards, `${rung.level}단계`);
    for (let seed = 1; seed <= 3 * count; seed++) {
      const next = nextSeed(rung.level, seed);
      assert.equal(next, seed + 1);
      assert.notDeepEqual(generateBoard(rung.level, next).board, generateBoard(rung.level, seed).board, `${rung.level}단계 ${seed}번 다음`);
      assert.deepEqual(generateBoard(rung.level, seed + count).board, generateBoard(rung.level, seed).board, `${rung.level}단계 ${seed}번`);
    }
  }
  assert.throws(() => nextSeed(9, 1));
});

test('작은 판부터: 맨 아래 단계에서만 가장 작은 판(6장)을 낸다', () => {
  for (let seed = 1; seed <= 6; seed++) assert.deepEqual(generateBoard(1, seed, { small: true }).board, { cards: cardsUpTo(6) });
  assert.equal(generateBoard(1, 2, { small: true }).small, true);
  assert.deepEqual(generateBoard(2, 2, { small: true }).board, generateBoard(2, 2).board);
});

test('형식의 첫 판은 실패할 수 없다: 1단계의 판은 어떻게 가져도 끝이 나고 합이 나온다', () => {
  assert.deepEqual(generateBoard(1, 1).board, { cards: [1, 2, 3, 4, 5, 6] });
  for (const n of rungOf(1).boards) {
    const brute = bruteTax(cardsUpTo(n));
    assert.ok(brute.orders >= 7, `${n}장`);
    assert.ok(brute.worst >= 2, `${n}장: 가장 적게 가져도 ${brute.worst}`);
    assert.ok(brute.bestWays >= 1 && brute.bestWays <= 2, `${n}장`);
  }
});

test('좋은 판: 사다리의 모든 판에서 "가장 큰 카드부터 가지기"로는 가장 큰 합이 나오지 않는다', (t) => {
  const lines = [];
  for (const rung of playing) {
    for (const n of rung.boards) {
      const board = { cards: cardsUpTo(n) };
      const best = solve(board).best;
      const greedy = greedyLargest(board).sum;
      const average = randomAverage(board);
      assert.ok(greedy < best, `${n}장: 큰 카드부터 ${greedy}, 가장 큰 합 ${best}`);
      // 아무렇게나 가져서는 가장 큰 합에 못 미친다. 가장 큰 합이 되는 차례는 끝까지 가는 차례 가운데 아주 적다.
      assert.ok(average < 0.75 * best, `${n}장: 평균 ${average}`);
      lines.push(`${rung.level}단계 ${n}장: 가장 큰 합 ${best}, 큰 카드부터 ${greedy}, 아무렇게나의 평균 ${average.toFixed(1)}, 가장 큰 합이 되는 차례 ${countBestOrders(board)}가지`);
    }
  }
  t.diagnostic(lines.join('\n'));
});
