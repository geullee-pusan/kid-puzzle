// 약수 세금의 규칙과 풀이 프로그램 점검.
// 풀이 프로그램의 결과는 다른 방법 둘과 견준다: 작은 판은 가질 수 있는 모든 차례를 하나하나 해 보고(1~24),
// 큰 판은 같은 꼴을 묶지 않고 남은 카드를 그대로 적어 두며 따진다(1~30).
// 책에 실린 값은 쓰지 않는다. 아래에 적은 수는 모두 이 풀이 프로그램으로 구하고 다른 방법으로 다시 구한 것이다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MAX_CARD,
  MIN_N,
  NODE_LIMIT,
  cardsUpTo,
  checkBoard,
  countBestOrders,
  countOrders,
  greedyLargest,
  plainN,
  properDivisors,
  randomAverage,
  replay,
  solve,
  takeable,
  taxOf,
} from '../src/core/tax.js';
import { endsClosed } from '../src/core/text.js';
import { bruteLargest, bruteTax, plainMemoTax } from './helpers/brute-tax.js';

const board = (n) => ({ cards: cardsUpTo(n) });
const total = (list) => list.reduce((sum, card) => sum + card, 0);

/** 가장 큰 합(1부터 n까지). 풀이 프로그램으로 구해 적어 둔 값이고, 아래 테스트가 다른 방법 둘로 다시 구해 견준다. */
const BEST = [0, 0, 2, 3, 7, 9, 15, 17, 21, 30, 40, 44, 50, 52, 66, 81, 89, 93, 111, 113, 124, 144, 166, 170, 182, 198, 224, 251, 279, 285, 301];
/** "가장 큰 카드부터 가지기"의 합 */
const LARGEST = [0, 0, 2, 3, 4, 9, 6, 13, 14, 17, 27, 38, 22, 35, 36, 41, 57, 74, 63, 82, 68, 75, 97, 120, 105, 130, 156, 165, 172, 201, 157];

test('규칙: 카드를 가지면 판에 남은 그 수의 약수(자기 자신은 빼고)가 모두 세금으로 나간다', () => {
  assert.equal(MAX_CARD, 30);
  assert.equal(MIN_N, 2);
  assert.deepEqual(cardsUpTo(6), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(properDivisors(6), [1, 2, 3]);
  assert.deepEqual(properDivisors(1), []);
  assert.deepEqual(properDivisors(7), [1]);
  assert.deepEqual(properDivisors(30), [1, 2, 3, 5, 6, 10, 15]);
  // 처음에는 1만 못 가진다(1의 약수는 1뿐이다).
  assert.deepEqual(takeable(cardsUpTo(6)), [2, 3, 4, 5, 6]);
  assert.deepEqual(taxOf(cardsUpTo(6), 6), [1, 2, 3]);
  assert.deepEqual(taxOf(cardsUpTo(6), 5), [1]);
  assert.deepEqual(taxOf([4, 5, 6], 6), []);
  assert.deepEqual(taxOf([2, 3], 6), [], '판에 없는 카드');
  // 6을 가지면 1, 2, 3이 나가고, 남은 4와 5는 약수가 남아 있지 않아 가질 수 없다. 남은 카드는 세금으로 나간다.
  const greedy = replay(board(6), [6]);
  assert.deepEqual(greedy, { ok: true, remaining: [4, 5], held: [6], paid: [[1, 2, 3]], gone: [1, 2, 3, 4, 5], left: [4, 5], sum: 6, tax: 15, ended: true, open: [] });
  // 5, 4, 6의 차례로 가지면 세금은 1, 2, 3이다.
  const best = replay(board(6), [5, 4, 6]);
  assert.deepEqual(best.paid, [[1], [2], [3]]);
  assert.deepEqual([best.sum, best.tax, best.ended, best.left], [15, 6, true, []]);
  // 하던 가운데: 남은 카드와 지금 가질 수 있는 카드
  const middle = replay(board(6), [5]);
  assert.deepEqual([middle.remaining, middle.open, middle.ended, middle.sum, middle.tax], [[2, 3, 4, 6], [4, 6], false, 5, 1]);
  // 아무것도 가지지 않은 판
  const start = replay(board(6), []);
  assert.deepEqual([start.ok, start.held, start.gone, start.sum, start.tax, start.ended], [true, [], [], 0, 0, false]);
});

test('가진 수의 합과 세금을 더하면, 끝난 판에서는 늘 판에 놓인 수를 모두 더한 것이다', () => {
  for (let n = 1; n <= 16; n++) {
    for (const order of bruteTax(cardsUpTo(n)).bestOrders.slice(0, 5)) {
      const state = replay(board(n), order);
      assert.ok(state.ok && state.ended, `${n}: ${order}`);
      assert.equal(state.sum + state.tax, (n * (n + 1)) / 2, `${n}: ${order}`);
      assert.deepEqual([...state.held, ...state.gone].sort((a, b) => a - b), cardsUpTo(n), `${n}: ${order}`);
    }
  }
});

test('규칙에 맞지 않는 차례는 맞는 데까지만 간다', () => {
  assert.equal(replay(board(6), [1]).ok, false, '1은 가질 수 없다');
  assert.equal(replay(board(6), [6, 4]).ok, false, '약수가 남아 있지 않은 카드');
  assert.deepEqual(replay(board(6), [6, 4]).held, [6]);
  assert.equal(replay(board(6), [5, 5]).ok, false, '이미 가진 카드');
  assert.equal(replay(board(6), [7]).ok, false, '판에 없는 카드');
  assert.equal(replay(board(6), [2.5]).ok, false);
  assert.equal(replay(board(6), 'x').ok, false);
  assert.equal(replay(board(6), [5, 4, 6]).ok, true);
});

test('판 확인: 1부터 30까지의 서로 다른 수를 작은 것부터 적는다', () => {
  assert.equal(checkBoard(board(6)), null);
  assert.equal(checkBoard(board(30)), null);
  assert.equal(checkBoard({ cards: [2, 3, 6, 12] }), null);
  assert.equal(checkBoard({ cards: [7] }), null);
  assert.equal(checkBoard({ cards: [] }), 'count');
  assert.equal(checkBoard({ cards: [1, 31] }), 'card');
  assert.equal(checkBoard({ cards: [0, 1] }), 'card');
  assert.equal(checkBoard({ cards: [2, 2] }), 'order');
  assert.equal(checkBoard({ cards: [3, 2] }), 'order');
  assert.equal(checkBoard({ cards: [1.5] }), 'card');
  assert.equal(checkBoard({ cards: '123' }), 'shape');
  assert.equal(checkBoard(null), 'shape');
  assert.equal(plainN(board(12)), 12);
  assert.equal(plainN({ cards: [1, 2, 4] }), null);
  assert.equal(plainN({ cards: [2, 3] }), null);
});

test('풀이 프로그램과 다른 방법(모든 차례를 하나하나 해 보기)이 같다: 1부터 n까지, n은 1~24', (t) => {
  for (let n = 1; n <= 24; n++) {
    const brute = bruteTax(cardsUpTo(n));
    const solved = solve(board(n));
    assert.equal(solved.exact, true, `${n}`);
    assert.equal(solved.best, brute.best, `${n}: 가장 큰 합`);
    assert.equal(solved.total, (n * (n + 1)) / 2, `${n}`);
    assert.equal(countBestOrders(board(n)), brute.bestWays, `${n}: 가장 큰 합이 되는 차례의 수`);
    assert.equal(countOrders(board(n)), brute.orders, `${n}: 끝까지 가는 차례의 수`);
    assert.ok(Math.abs(randomAverage(board(n)) - brute.average) < 1e-9, `${n}: 아무렇게나 가지기의 평균`);
    // 풀이 프로그램이 내놓은 차례는 규칙에 맞고, 그 합이 가장 큰 합이고, 다른 방법이 찾은 차례 가운데 하나다.
    const played = replay(board(n), solved.order);
    assert.ok(played.ok && played.ended, `${n}`);
    assert.equal(played.sum, solved.best, `${n}`);
    assert.ok(brute.bestOrders.some((order) => order.join() === solved.order.join()), `${n}: ${solved.order}`);
    assert.deepEqual(greedyLargest(board(n)), bruteLargest(cardsUpTo(n)), `${n}: 가장 큰 카드부터 가지기`);
  }
  t.diagnostic(`모든 차례를 하나하나 해 본 판: n이 1~24(24일 때 차례 ${bruteTax(cardsUpTo(24)).orders}가지)`);
});

test('풀이 프로그램과 다른 방법(같은 꼴을 묶지 않고 따지기)이 같다: 1부터 n까지, n은 1~30', (t) => {
  let states = 0;
  for (let n = 1; n <= MAX_CARD; n++) {
    const plain = plainMemoTax(cardsUpTo(n));
    assert.equal(solve(board(n)).best, plain.best, `${n}`);
    assert.equal(plain.best, BEST[n], `${n}`);
    states = plain.states;
  }
  t.diagnostic(`n이 30일 때 따진 묶음: 풀이 프로그램 ${solve(board(30)).nodes}개, 묶지 않는 방법 ${states}개`);
});

test('카드를 골라 놓은 판에서도 풀이 프로그램과 다른 방법이 같다', () => {
  // 시드로 뽑은 묶음(같은 번호는 늘 같은 묶음이다)
  let seed = 20261118;
  const next = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let round = 0; round < 300; round++) {
    const top = 6 + Math.floor(next() * 15);
    const keep = 0.4 + 0.6 * next();
    const cards = cardsUpTo(top).filter(() => next() < keep);
    if (cards.length === 0) continue;
    const brute = bruteTax(cards);
    const solved = solve({ cards });
    assert.equal(solved.best, brute.best, cards.join());
    assert.equal(countBestOrders({ cards }), brute.bestWays, cards.join());
    assert.ok(Math.abs(randomAverage({ cards }) - brute.average) < 1e-9, cards.join());
    assert.equal(replay({ cards }, solved.order).sum, solved.best, cards.join());
  }
  // 큰 묶음은 같은 꼴을 묶지 않는 방법과 견준다.
  for (let round = 0; round < 40; round++) {
    const keep = 0.5 + 0.5 * next();
    const cards = cardsUpTo(MAX_CARD).filter(() => next() < keep);
    if (cards.length === 0) continue;
    assert.equal(solve({ cards }).best, plainMemoTax(cards).best, cards.join());
  }
  // 가질 수 있는 카드가 하나도 없는 판: 합은 0이고 차례는 비어 있다.
  for (const cards of [[1], [7], [2, 3, 5, 7], [4, 6, 9, 10], [16, 24, 27, 30]]) {
    const solved = solve({ cards });
    assert.deepEqual([solved.best, solved.order, solved.exact], [0, [], true], cards.join());
    assert.deepEqual(takeable(cards), [], cards.join());
    assert.equal(replay({ cards }, []).ended, true);
  }
  // 1이 없는 판도 풀린다.
  assert.deepEqual(solve({ cards: [2, 3, 4, 6, 12] }).best, bruteTax([2, 3, 4, 6, 12]).best);
});

test('n이 1부터 30까지일 때: 가장 큰 합, 가장 큰 카드부터 가지기의 합, 아무렇게나 가지기의 평균', (t) => {
  const lines = [];
  for (let n = 1; n <= MAX_CARD; n++) {
    const solved = solve(board(n));
    const greedy = greedyLargest(board(n));
    const average = randomAverage(board(n));
    assert.equal(solved.best, BEST[n], `${n}: 가장 큰 합`);
    assert.equal(greedy.sum, LARGEST[n], `${n}: 가장 큰 카드부터 가지기`);
    assert.ok(greedy.sum <= solved.best && average <= solved.best + 1e-9, `${n}`);
    lines.push(`${n}: ${solved.best} / ${greedy.sum} / ${average.toFixed(1)} (가장 큰 합이 되는 차례 ${countBestOrders(board(n))}가지)`);
  }
  t.diagnostic(`n: 가장 큰 합 / 큰 카드부터 / 아무렇게나의 평균\n${lines.join('\n')}`);
  // 가장 큰 합은 n이 커질 때 줄어들지 않는다.
  for (let n = 2; n <= MAX_CARD; n++) assert.ok(BEST[n] >= BEST[n - 1], `${n}`);
});

test('"가장 큰 카드부터 가지기"로 가장 큰 합이 나오는 판은 n이 2, 3, 5일 때뿐이다(1부터 30까지 가운데)', () => {
  const same = [];
  for (let n = 2; n <= MAX_CARD; n++) if (greedyLargest(board(n)).sum === solve(board(n)).best) same.push(n);
  assert.deepEqual(same, [2, 3, 5]);
  // n이 6일 때는 아무렇게나 가질 때의 평균(9)이 가장 큰 카드부터 가질 때(6)보다도 많다.
  assert.equal(greedyLargest(board(6)).sum, 6);
  assert.ok(Math.abs(randomAverage(board(6)) - 9) < 1e-9);
  assert.deepEqual(greedyLargest(board(10)).order, [10, 9, 8]);
});

test('작은 판의 가장 큰 합이 되는 차례: 6장은 한 가지, 8장은 두 가지, 10장은 두 가지', () => {
  assert.deepEqual(bruteTax(cardsUpTo(6)).bestOrders, [[5, 4, 6]]);
  assert.deepEqual(bruteTax(cardsUpTo(8)).bestOrders.map((order) => order.join()), ['7,6,8', '7,8,6']);
  assert.deepEqual(bruteTax(cardsUpTo(10)).bestOrders.map((order) => order.join()).sort(), ['7,9,6,10,8', '7,9,6,8,10']);
  assert.deepEqual([6, 8, 10, 12, 15, 20, 30].map((n) => countBestOrders(board(n))), [1, 2, 2, 8, 3, 64, 2376]);
  // 같은 합이면 큰 카드를 먼저 고른 차례를 내놓는다. 같은 판은 늘 같은 차례다.
  assert.deepEqual(solve(board(6)).order, [5, 4, 6]);
  assert.deepEqual(solve(board(10)).order, [7, 9, 6, 10, 8]);
  assert.deepEqual(solve(board(30)), solve(board(30)));
});

test('1이 놓인 판에서는 무엇을 가져도 1이 맨 처음에 세금으로 나간다', () => {
  for (let n = 2; n <= MAX_CARD; n++) {
    for (const card of takeable(cardsUpTo(n))) assert.ok(taxOf(cardsUpTo(n), card).includes(1), `${n}: ${card}`);
    assert.ok(!takeable(cardsUpTo(n)).includes(1));
  }
});

test('풀이 프로그램은 빠르다: 30장짜리 판도 0.3초 안쪽이고, 따져 보는 묶음이 위 끝에 한참 못 미친다', (t) => {
  const times = [];
  for (let run = 0; run < 5; run++) {
    const before = performance.now();
    const solved = solve(board(30));
    times.push(performance.now() - before);
    assert.equal(solved.exact, true);
    assert.ok(solved.nodes < NODE_LIMIT / 50, `따진 묶음 ${solved.nodes}`);
  }
  assert.ok(Math.min(...times) < 300, `${Math.min(...times)}ms`);
  t.diagnostic(`n이 30인 판을 푸는 데: 가장 빠른 것 ${Math.min(...times).toFixed(1)}ms, 가장 느린 것 ${Math.max(...times).toFixed(1)}ms, 따진 묶음 ${solve(board(30)).nodes}개(위 끝 ${NODE_LIMIT})`);
  // 한 장이나 두 장을 뺀 판 가운데에도 30장을 다 놓은 판보다 많이 따지는 판은 없다.
  let most = 0;
  for (let a = 1; a <= MAX_CARD; a++) {
    for (let b = a; b <= MAX_CARD; b++) {
      const cards = cardsUpTo(MAX_CARD).filter((card) => card !== a && card !== b);
      most = Math.max(most, solve({ cards }).nodes);
    }
  }
  assert.ok(most <= solve(board(30)).nodes, `${most}`);
});

test('끝까지 못 따지면 사실대로 알린다: exact가 false이고, 내놓는 차례는 규칙에 맞는 차례다', () => {
  const cut = solve(board(30), { limit: 10 });
  assert.equal(cut.exact, false);
  const played = replay(board(30), cut.order);
  assert.ok(played.ok && played.ended);
  assert.equal(played.sum, cut.best);
  assert.ok(cut.best <= BEST[30]);
  assert.equal(countBestOrders(board(30), { limit: 10 }), null);
  assert.equal(randomAverage(board(30), { limit: 10 }), null);
  assert.equal(countOrders(board(30), { limit: 10 }), null);
  // 위 끝이 넉넉하면 끝까지 따진다.
  assert.equal(solve(board(30), { limit: 2000 }).exact, true);
});

test('수 뒤에 붙는 말을 고른다: 2, 4, 5, 9로 끝나는 수는 받침 없이 읽는다', () => {
  for (const number of [2, 4, 5, 9, 12, 15, 24, 39, 44, 85, 182, 285]) assert.equal(endsClosed(number), false, `${number}`);
  for (const number of [0, 1, 3, 6, 7, 8, 10, 11, 13, 16, 17, 18, 20, 21, 30, 40, 50, 81, 100, 111, 166, 198, 301]) assert.equal(endsClosed(number), true, `${number}`);
  assert.equal(total([1, 2, 3]), 6);
});
