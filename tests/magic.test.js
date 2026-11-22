// 마법 네모와 겹친 칸의 판과 풀이 프로그램 점검.
// 놓는 방법의 수, 줄의 합, 가운데 카드, 되는지 안 되는지를 모든 차례를 다 놓아 보는 다른 방법(tests/helpers/brute-magic.js)으로 다시 구해 견준다.
// 겹친 칸 판에서는 "두 번 세기로 정한 가운데 카드가 있고 남은 카드가 짝으로 나뉘면 된다"가 1~9에서 고른 모든 카드 묶음과 모든 합에서 맞는지 본다.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRng } from '../src/core/rng.js';

import { HUB_POOL, SET_POOL } from '../src/core/magic-ladder.js';
import { SQUARE_LINES, centerOf, checkBoard, copyBoard, hubSums, isDone, lineSums, linesOf, passCounts, placedOk, reasonOf, sameLines, sizeOf, smallLists, solve, trayOf, triplesOf } from '../src/core/magic.js';
import { bruteHub, bruteRows, bruteSquare, choose } from './helpers/brute-magic.js';

const ONE_TO_NINE = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const grid = (lines, cards, w = 3, h = 3) => ({ shape: 'grid', w, h, lines, cards, target: null });
const hub = (arms, cards, target = null) => ({ shape: 'hub', arms, cards, target });
const upTo = (n) => Array.from({ length: n }, (_, index) => index + 1);
const strip = (list) => list.map(({ sum, count, centers }) => ({ sum, count, centers }));

test('판의 규격: 모양, 크기, 줄 모음, 카드, 맞출 합을 살핀다. 베끼면 카드가 작은 수부터 놓인다', () => {
  assert.equal(checkBoard(grid('all', ONE_TO_NINE)), null);
  assert.equal(checkBoard(grid('rows', upTo(6), 2, 3)), null);
  assert.equal(checkBoard(hub(3, upTo(7), 12)), null);
  assert.equal(checkBoard(hub(4, upTo(9))), null);
  assert.equal(checkBoard(null), 'bad-board');
  assert.equal(checkBoard({ shape: 'ring', cards: [] }), 'bad-shape');
  assert.equal(checkBoard(grid('rows', upTo(12), 4, 3)), 'bad-size');
  assert.equal(checkBoard(grid('all', upTo(6), 2, 3)), 'bad-lines');
  assert.equal(checkBoard(grid('cols', ONE_TO_NINE)), 'bad-lines');
  assert.equal(checkBoard({ ...grid('all', ONE_TO_NINE), target: 15 }), 'bad-target');
  assert.equal(checkBoard(grid('all', [1, 1, 2, 3, 4, 5, 6, 7, 8])), 'bad-cards');
  assert.equal(checkBoard(grid('all', upTo(8))), 'bad-cards');
  assert.equal(checkBoard(grid('all', [0, 1, 2, 3, 4, 5, 6, 7, 8])), 'bad-cards');
  assert.equal(checkBoard(hub(5, upTo(11))), 'bad-size');
  assert.equal(checkBoard(hub(3, upTo(7), 1.5)), 'bad-target');
  assert.deepEqual(copyBoard(grid('all', [9, 8, 7, 6, 5, 4, 3, 2, 1])).cards, ONE_TO_NINE);
  assert.deepEqual(copyBoard(hub(2, [5, 1, 4, 2, 3], 9)), { shape: 'hub', arms: 2, cards: [1, 2, 3, 4, 5], target: 9 });
});

test('줄과 칸: 마법 네모는 여덟 줄, 가운데 네 줄은 가운데 칸을 네 번, 겹친 칸은 가운데를 줄 수만큼 센다', () => {
  assert.equal(linesOf(grid('rows', ONE_TO_NINE)).length, 3);
  assert.equal(linesOf(grid('rowscols', ONE_TO_NINE)).length, 6);
  assert.equal(linesOf(grid('all', ONE_TO_NINE)).length, 8);
  assert.deepEqual(passCounts(grid('all', ONE_TO_NINE)), [3, 2, 3, 2, 4, 2, 3, 2, 3]);
  assert.deepEqual(passCounts(grid('center', ONE_TO_NINE)), [1, 1, 1, 1, 4, 1, 1, 1, 1]);
  assert.deepEqual(passCounts(grid('rows', ONE_TO_NINE)), [1, 1, 1, 1, 1, 1, 1, 1, 1]);
  for (const arms of [2, 3, 4]) assert.deepEqual(passCounts(hub(arms, upTo(1 + 2 * arms))), [arms, ...Array(2 * arms).fill(1)]);
  assert.equal(centerOf(grid('all', ONE_TO_NINE)), 4);
  assert.equal(centerOf(grid('rows', upTo(6), 2, 3)), null);
  assert.equal(centerOf(hub(3, upTo(7))), 0);
  assert.equal(sizeOf(hub(4, upTo(9))), 9);
});

test('놓인 모습: 줄마다의 합, 합이 같은 줄 표시, 다 되었는지', () => {
  const board = grid('all', ONE_TO_NINE);
  const lo = [2, 7, 6, 9, 5, 1, 4, 3, 8];
  assert.ok(isDone(board, lo));
  assert.ok(lineSums(board, lo).every((line) => line.full && line.sum === 15));
  assert.ok(sameLines(board, lineSums(board, lo)).every(Boolean));
  // 가로 줄만 같은 모습: 가로 셋과 그 밖의 15인 줄이 같은 합으로 표시된다
  const rowsOnly = [8, 3, 4, 5, 1, 9, 2, 7, 6];
  assert.equal(isDone(board, rowsOnly), false);
  assert.ok(isDone(grid('rows', ONE_TO_NINE), rowsOnly));
  const sums = lineSums(board, rowsOnly);
  assert.deepEqual(sums.map((line) => line.sum), [15, 15, 15, 15, 11, 19, 15, 7]);
  assert.deepEqual(sameLines(board, sums), [true, true, true, true, false, false, true, false]);
  // 덜 찬 줄은 놓인 카드만 더한다
  const part = [8, null, null, null, 5, null, null, null, null];
  assert.deepEqual(
    lineSums(board, part).map((line) => [line.sum, line.filled, line.full]),
    [[8, 1, false], [5, 1, false], [0, 0, false], [8, 1, false], [5, 1, false], [0, 0, false], [13, 2, false], [5, 1, false]],
  );
  assert.deepEqual(sameLines(board, lineSums(board, part)), Array(8).fill(false));
  assert.deepEqual(trayOf(board, part), [1, 2, 3, 4, 6, 7, 9]);
  assert.ok(placedOk(board, part));
  assert.equal(placedOk(board, [8, 8, null, null, null, null, null, null, null]), false);
  assert.equal(placedOk(board, [10, null, null, null, null, null, null, null, null]), false);
  // 합을 정한 판은 그 합인 다 찬 줄만 표시한다
  const target = hub(3, upTo(7), 11);
  const tried = [3, 1, 7, 2, 6, 4, 5];
  assert.deepEqual(lineSums(target, tried).map((line) => line.sum), [11, 11, 12]);
  assert.deepEqual(sameLines(target, lineSums(target, tried)), [true, true, false]);
  assert.equal(isDone(target, tried), false);
  // 같은 합이 둘 이상인 줄이 없으면 아무것도 표시하지 않는다
  assert.deepEqual(sameLines(hub(2, upTo(5)), lineSums(hub(2, upTo(5)), [3, 1, 4, 2, 5])), [false, false]);
  assert.deepEqual(sameLines(hub(2, upTo(5)), lineSums(hub(2, upTo(5)), [3, 1, 5, 2, 4])), [true, true]);
  // 가장 많은 합이 둘로 갈리면(13이 둘, 17이 둘) 아무것도 표시하지 않는다
  const tie = grid('center', ONE_TO_NINE);
  const tied = [3, 2, 4, 1, 5, 7, 8, 6, 9];
  assert.deepEqual(lineSums(tie, tied).map((line) => line.sum), [13, 13, 17, 17]);
  assert.deepEqual(sameLines(tie, lineSums(tie, tied)), [false, false, false, false]);
  assert.deepEqual(sameLines(grid('rows', upTo(4), 2, 2), lineSums(grid('rows', upTo(4), 2, 2), [1, 2, 3, 4])), [false, false]);
});

/** 견줄 3×3 카드 묶음: 1~9, 사다리의 묶음, 그리고 1~15에서 고른 묶음 몇 개 */
const SQUARE_SETS = [ONE_TO_NINE, ...SET_POOL.yes, ...SET_POOL.no, [1, 2, 4, 5, 6, 7, 8, 10, 11], [1, 2, 3, 4, 6, 7, 8, 9, 10], [2, 3, 5, 6, 7, 8, 9, 11, 12], [1, 4, 5, 6, 7, 8, 9, 10, 13], [1, 2, 3, 4, 5, 6, 7, 8, 18]];

test('3×3 판: 가로 줄만, 가로와 세로, 마법 네모, 가운데 네 줄의 놓는 방법이 모든 차례를 다 놓아 본 것과 같다', () => {
  for (const cards of SQUARE_SETS) {
    const brute = bruteSquare(cards);
    for (const lines of ['rows', 'rowscols', 'all', 'center']) {
      const solved = solve(grid(lines, cards));
      const where = `${lines} ${cards.join(',')}`;
      assert.deepEqual(strip(solved.sums), brute[lines], where);
      assert.equal(solved.count, brute[lines].reduce((total, item) => total + item.count, 0), where);
      assert.equal(solved.possible, solved.count > 0, where);
      if (solved.possible) {
        assert.ok(isDone(grid(lines, cards), solved.example), where);
        for (const item of solved.sums) assert.ok(isDone(grid(lines, cards), item.example) && lineSums(grid(lines, cards), item.example)[0].sum === item.sum, where);
        assert.equal(solved.why, null);
      } else {
        assert.equal(solved.example, null);
        assert.ok(solved.why, where);
      }
    }
  }
});

test('1~9: 가로 줄만 2592가지, 가로와 세로 72가지, 마법 네모는 가운데가 5인 8가지, 가운데 네 줄은 12·15·18이 384가지씩', () => {
  assert.equal(solve(grid('rows', ONE_TO_NINE)).count, 2592);
  assert.equal(solve(grid('rowscols', ONE_TO_NINE)).count, 72);
  const magic = solve(grid('all', ONE_TO_NINE));
  assert.deepEqual(strip(magic.sums), [{ sum: 15, count: 8, centers: [5] }]);
  assert.deepEqual(strip(solve(grid('center', ONE_TO_NINE)).sums), [
    { sum: 12, count: 384, centers: [1] },
    { sum: 15, count: 384, centers: [5] },
    { sum: 18, count: 384, centers: [9] },
  ]);
  // 가로 줄만 맞추면 가운데에 어느 카드든 올 수 있다
  assert.deepEqual(solve(grid('rows', ONE_TO_NINE)).sums[0].centers, ONE_TO_NINE);
  // 되는 다른 묶음의 마법 네모도 여덟 모습이고, 가운데는 카드의 합 ÷ 9다
  for (const cards of SET_POOL.yes) {
    const solved = solve(grid('all', cards));
    const total = cards.reduce((a, b) => a + b, 0);
    assert.deepEqual(strip(solved.sums), [{ sum: total / 3, count: 8, centers: [total / 9] }], cards.join(','));
  }
});

test('작은 네모 판(가로 줄만): 2×3과 2×2가 모든 차례를 다 놓아 본 것과 같다', () => {
  for (const cards of [upTo(6), [2, 3, 4, 5, 6, 7], [1, 2, 3, 4, 5, 7], [1, 2, 3, 5, 7, 8]]) {
    assert.deepEqual(strip(solve(grid('rows', cards, 2, 3)).sums).map(({ sum, count }) => ({ sum, count, centers: [] })), bruteRows(cards, 2, 3), cards.join(','));
  }
  for (const cards of [upTo(4), [1, 2, 3, 5], [2, 3, 4, 5]]) {
    assert.deepEqual(strip(solve(grid('rows', cards, 2, 2)).sums).map(({ sum, count }) => ({ sum, count, centers: [] })), bruteRows(cards, 2, 2), cards.join(','));
  }
  assert.equal(solve(grid('rows', upTo(6), 2, 3)).count, 48);
  assert.equal(solve(grid('rows', upTo(4), 2, 2)).count, 8);
  assert.equal(solve(grid('rows', [1, 2, 3, 4, 5, 7], 2, 3)).possible, false);
});

test('겹친 칸: 합을 정하지 않은 판과 합마다의 판이 모든 차례를 다 놓아 본 것과 같다. 놓는 방법은 줄 수! × 2^줄 수', () => {
  const sets = [
    [2, upTo(5)],
    [2, [1, 2, 3, 4, 6]],
    [3, upTo(7)],
    [3, [2, 3, 4, 5, 6, 7, 8]],
    [3, [1, 2, 3, 4, 5, 6, 8]],
    [4, ONE_TO_NINE],
    [4, [1, 2, 3, 4, 5, 6, 7, 8, 10]],
  ];
  const ways = { 2: 8, 3: 48, 4: 384 };
  for (const [arms, cards] of sets) {
    const brute = bruteHub(arms, cards);
    const where = `${arms}줄 ${cards.join(',')}`;
    assert.deepEqual(strip(solve(hub(arms, cards)).sums), brute, where);
    for (const item of brute) assert.equal(item.count, ways[arms] * item.centers.length, where);
    const sorted = cards.slice().sort((a, b) => a - b);
    const low = sorted[0] + sorted[1] + sorted[2];
    const high = sorted.at(-1) + sorted.at(-2) + sorted.at(-3);
    for (let target = low - 2; target <= high + 2; target++) {
      const solved = solve(hub(arms, cards, target));
      const expect = brute.find((item) => item.sum === target);
      assert.equal(solved.count, expect ? expect.count : 0, `${where} 합 ${target}`);
      assert.equal(solved.possible, Boolean(expect), `${where} 합 ${target}`);
      if (expect) assert.ok(isDone(hub(arms, cards, target), solved.example));
    }
  }
});

test('겹친 칸: 두 번 세기로 정한 가운데 카드가 있고 남은 카드가 짝으로 나뉘면 꼭 된다(1~9에서 고른 모든 묶음, 모든 합)', () => {
  let boards = 0;
  for (const arms of [2, 3]) {
    for (const cards of choose(ONE_TO_NINE, 1 + 2 * arms)) {
      const brute = bruteHub(arms, cards);
      const fast = hubSums(arms, cards);
      for (const item of fast) {
        boards += 1;
        const expect = brute.find((entry) => entry.sum === item.line);
        assert.equal(item.possible, Boolean(expect), `${arms}줄 ${cards.join(',')} 합 ${item.line}`);
        if (expect) assert.deepEqual(expect.centers, [item.center]);
        // 안 되는 합의 까닭은 놓아 보지 않고 알 수 있는 것뿐이다("모두 놓아 봐야 아는 것"이 없다)
        if (!expect) assert.notEqual(reasonOf(hub(arms, cards, item.line)).reason, 'search');
      }
      // 만들 수 있는 줄의 합 밖은 늘 안 된다
      assert.ok(brute.every((entry) => fast.some((item) => item.line === entry.sum)));
    }
  }
  assert.ok(boards > 1500, `${boards}판`);
});

test('안 되는 판의 까닭: 사다리의 안 되는 묶음마다 까닭이 맞고, 까닭이 말하는 수가 맞다', () => {
  const expected = ['big', 'split', 'center-part', 'center-missing', 'pairs', 'lines', 'lines'];
  assert.deepEqual(
    SET_POOL.no.map((cards) => solve(grid('all', cards)).why.reason),
    expected,
  );
  for (const cards of SET_POOL.no) {
    const why = solve(grid('all', cards)).why;
    const sorted = cards.slice().sort((a, b) => a - b);
    const total = sorted.reduce((a, b) => a + b, 0);
    if (why.reason === 'big') {
      // 가장 큰 카드가 든 가로 줄의 가장 작은 합이 줄 하나의 고른 몫보다 크다
      assert.equal(why.low, sorted.at(-1) + sorted[0] + sorted[1]);
      assert.ok(3 * why.low > total);
    }
    if (why.reason === 'split') assert.notEqual(total % 3, 0);
    if (why.reason === 'center-part') assert.notEqual((total / 3) % 3, 0);
    if (why.reason === 'center-missing') assert.ok(!cards.includes(total / 9));
    if (why.reason === 'pairs') assert.ok(!cards.includes(why.pair - why.card));
    if (why.reason === 'lines') {
      // 가운데와 짝은 다 맞는데, 합이 줄의 합인 세 장 묶음이 줄 수보다 적다(비트로 모든 세 장을 골라 다시 센다)
      assert.ok(cards.includes(total / 9));
      assert.equal(why.line, total / 3);
      assert.equal(why.count, bruteTriples(cards, why.line).length);
      assert.ok(why.count < 8);
    }
    // 까닭이 무엇이든 정말 안 된다
    assert.deepEqual(bruteSquare(cards).all, []);
  }
  assert.deepEqual(
    HUB_POOL.no.map((board) => solve(board).why.reason),
    ['center-missing', 'center-part', 'center-part', 'center-missing', 'center-part', 'center-part', 'center-part', 'center-part', 'pairs', 'center-part'],
  );
  assert.equal(solve(hub(2, upTo(5), 13)).why.reason, 'big');
  assert.equal(solve(hub(3, upTo(7), 19)).why.high, 18);
  assert.equal(solve(hub(2, [3, 4, 5, 6, 7], 10)).why.reason, 'small');
  assert.equal(solve(hub(3, [1, 2, 3, 4, 5, 6, 8])).possible, true);
  assert.equal(reasonOf(hub(2, [1, 2, 4, 8, 16])).reason, 'pairs-all');
  assert.equal(solve(hub(2, [1, 2, 4, 8, 16])).possible, false);
  for (const board of HUB_POOL.no) assert.deepEqual(bruteHub(board.arms, board.cards).filter((item) => item.sum === board.target), [], JSON.stringify(board));
  for (const board of HUB_POOL.yes) assert.ok(bruteHub(board.arms, board.cards).some((item) => item.sum === board.target), JSON.stringify(board));
});

test('더 작은 판의 목록: 되는 판과 안 되는 판으로 나뉘고, 줄이나 카드가 원래 판보다 적다', () => {
  const lineCount = (board) => linesOf(board).length;
  const check = (board) => {
    const { yes, no } = smallLists(board);
    for (const item of yes) assert.equal(solve(item).possible, true);
    for (const item of no) assert.equal(solve(item).possible, false);
    for (const item of [...yes, ...no]) {
      assert.equal(checkBoard(item), null, JSON.stringify(item));
      assert.ok(sizeOf(item) < sizeOf(board) || lineCount(item) < lineCount(board), JSON.stringify(item));
    }
    return { yes, no };
  };
  const all = check(grid('all', ONE_TO_NINE));
  assert.deepEqual(all.yes.map((item) => item.lines), ['rowscols', 'center', 'rows']);
  assert.deepEqual(check(grid('rowscols', ONE_TO_NINE)).yes.map((item) => [item.lines, item.w, item.h]), [['rows', 3, 3], ['rows', 2, 3]]);
  assert.deepEqual(check(grid('rows', ONE_TO_NINE)).yes.map((item) => [item.w, item.h]), [[2, 3], [2, 2]]);
  assert.deepEqual(check(grid('rows', upTo(6), 2, 3)).yes.map((item) => [item.w, item.h]), [[2, 2]]);
  assert.deepEqual(check(grid('rows', upTo(4), 2, 2)), { yes: [], no: [] });
  assert.deepEqual(check(hub(2, upTo(5), 9)), { yes: [], no: [] });
  const fromFour = check(hub(4, ONE_TO_NINE, 15));
  assert.deepEqual(fromFour.yes.map((item) => [item.arms, item.target]), [[3, 10], [3, 12], [3, 14], [2, 8], [2, 9], [2, 10]]);
  assert.ok(fromFour.no.every((item) => solve(item).why.reason !== 'search'));
  // 가운데가 1보다 작아야 하는 합은 내지 않는다
  assert.ok(fromFour.no.every((item) => !(solve(item).why.center < 1)));
  const big = check(grid('all', SET_POOL.no[0]));
  assert.deepEqual(big.yes.map((item) => item.lines), ['center']);
  assert.deepEqual(big.no.map((item) => item.lines), ['rowscols', 'rows']);
  assert.deepEqual(smallLists({ shape: 'grid' }), { yes: [], no: [] });
  // 모두 놓아 봐야 아는 안 되는 판은 작은 판으로 내지 않는다(그런 묶음의 가로와 세로 판도 마찬가지).
  // 예전에 모두 놓아 봐야 알았던 묶음은 이제 세 장 묶음이 모자란 까닭(lines)이 보인다
  const hard = [1, 2, 4, 5, 6, 7, 8, 10, 11];
  assert.deepEqual(solve(grid('all', hard)).why, { reason: 'lines', total: 54, line: 18, center: 6, count: 6 });
  for (const cards of [hard, [1, 4, 5, 6, 7, 8, 9, 10, 13], ...SET_POOL.no]) for (const item of smallLists(grid('all', cards)).no) assert.notEqual(solve(item).why.reason, 'search', JSON.stringify(item));
});

/** 아홉 장 가운데 세 장을 비트로 모두 골라(2^9가지) 합이 line인 것(작은 카드부터) */
function bruteTriples(cards, line) {
  const out = [];
  for (let bits = 0; bits < 1 << cards.length; bits++) {
    const chosen = cards.filter((_, index) => (bits >> index) & 1);
    if (chosen.length === 3 && chosen[0] + chosen[1] + chosen[2] === line) out.push(chosen.slice().sort((a, b) => a - b));
  }
  return out.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
}

test('모든 경우 펼쳐 보기(세 장 묶음): 비트로 모두 고른 것과 같다. 1~9의 합 15는 꼭 8가지이고 마법 네모의 여덟 줄이 바로 그것이다', () => {
  const rng = createRng(20261122);
  for (let trial = 0; trial < 200; trial++) {
    const pool = upTo(15);
    const cards = [];
    while (cards.length < 9) cards.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    const line = 6 + Math.floor(rng() * 34);
    assert.deepEqual(triplesOf(cards, line), bruteTriples(cards, line), JSON.stringify([cards, line]));
  }
  assert.equal(SQUARE_LINES, 8);
  assert.deepEqual(triplesOf(ONE_TO_NINE, 15), [[1, 5, 9], [1, 6, 8], [2, 4, 9], [2, 5, 8], [2, 6, 7], [3, 4, 8], [3, 5, 7], [4, 5, 6]]);
  // 마법 네모 하나의 여덟 줄이 그 여덟 묶음이다
  const square = [2, 7, 6, 9, 5, 1, 4, 3, 8];
  const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]].map((cells) => cells.map((cell) => square[cell]).sort((a, b) => a - b));
  assert.deepEqual(lines.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]), triplesOf(ONE_TO_NINE, 15));
});

test('풀이 프로그램이 알려 준 것: 1~15에서 고른 아홉 장 가운데 가운데 카드와 짝이 다 맞는 묶음은, 세 장 묶음이 8가지면 늘 되고 아니면(4가지나 6가지) 안 된다', () => {
  let ok = 0;
  let no = 0;
  const visit = (from, left, chosen) => {
    if (left === 0) {
      const cards = chosen.slice();
      const total = cards.reduce((a, b) => a + b, 0);
      if (total % 9 !== 0) return;
      const center = total / 9;
      const rest = cards.filter((card) => card !== center);
      if (!cards.includes(center) || rest.some((card) => !rest.includes(2 * center - card))) return;
      const count = bruteTriples(cards, total / 3).length;
      const result = solve(grid('all', cards));
      assert.equal(result.possible, count === 8, cards.join(','));
      if (result.possible) ok += 1;
      else {
        no += 1;
        assert.equal(result.why.reason, 'lines', cards.join(','));
        assert.ok([4, 6].includes(count), cards.join(','));
      }
      return;
    }
    for (let card = from; card <= 15 - left + 1; card++) {
      chosen.push(card);
      visit(card + 1, left - 1, chosen);
      chosen.pop();
    }
  };
  visit(1, 9, []);
  assert.deepEqual([ok, no], [23, 54]);
  // 사다리의 두 묶음은 모든 차례를 놓아 보는 방법으로도 안 된다(위 테스트에서 본다)
  for (const cards of [[1, 2, 4, 5, 6, 7, 8, 10, 11], [1, 2, 3, 4, 6, 8, 9, 10, 11]]) assert.ok(SET_POOL.no.some((item) => item.join() === cards.join()));
});
