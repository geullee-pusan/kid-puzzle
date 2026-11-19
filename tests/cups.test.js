// 컵 뒤집기와 세 색 무리의 판, 규칙, 풀이 프로그램 점검.
// 풀이 프로그램은 다른 방법(tests/helpers/brute-cups.js)과 견준다: 규격 안의 컵 판은 모두, 방울이 판은 마릿수가 8 이하인 판을 모두.
// 이 형식이 기대는 사실(바뀌지 않는 값, 그 값이 맞으면 되는 판인지)도 여기서 모든 경우를 따져 확인한다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  RANGES,
  applyMove,
  checkBoard,
  checkMove,
  colorsOf,
  countsOf,
  diagnoseImpossible,
  downCount,
  invariantRulesOut,
  isDone,
  remainders,
  remaindersApart,
  replay,
  solve,
  startItems,
  thirdColor,
  whyOpen,
} from '../src/core/cups.js';
import { bruteColors, bruteCups } from './helpers/brute-cups.js';

const cupsBoard = (n, k, mask) => ({ kind: 'cups', n, k, cups: Array.from({ length: n }, (_, index) => (mask >> index) & 1) });

/** 마릿수가 total 이하인 모든 방울이 판(한 색이 6마리까지) */
function colorBoards(total) {
  const boards = [];
  for (let red = 0; red <= RANGES.count[1]; red++) {
    for (let blue = 0; blue <= RANGES.count[1]; blue++) {
      for (let yellow = 0; yellow <= RANGES.count[1]; yellow++) {
        const sum = red + blue + yellow;
        if (sum >= RANGES.total[0] && sum <= total) boards.push({ kind: 'colors', counts: [red, blue, yellow] });
      }
    }
  }
  return boards;
}

test('판의 규격: 컵 3~10개, 한 번에 1개부터 컵 수까지. 방울이는 한 색 0~6마리, 모두 2마리 이상', () => {
  assert.equal(checkBoard({ kind: 'cups', n: 4, k: 2, cups: [1, 1, 0, 0] }), null);
  assert.equal(checkBoard({ kind: 'cups', n: 4, k: 4, cups: [1, 1, 0, 0] }), null);
  assert.equal(checkBoard({ kind: 'cups', n: 2, k: 2, cups: [1, 1] }), 'bad-count');
  assert.equal(checkBoard({ kind: 'cups', n: 11, k: 2, cups: Array(11).fill(1) }), 'bad-count');
  assert.equal(checkBoard({ kind: 'cups', n: 4, k: 5, cups: [1, 1, 0, 0] }), 'bad-k');
  assert.equal(checkBoard({ kind: 'cups', n: 4, k: 0, cups: [1, 1, 0, 0] }), 'bad-k');
  assert.equal(checkBoard({ kind: 'cups', n: 4, k: 2, cups: [1, 1, 0] }), 'bad-cups');
  assert.equal(checkBoard({ kind: 'cups', n: 4, k: 2, cups: [1, 2, 0, 0] }), 'bad-cups');
  assert.equal(checkBoard({ kind: 'colors', counts: [2, 1, 0] }), null);
  assert.equal(checkBoard({ kind: 'colors', counts: [6, 6, 6] }), null);
  assert.equal(checkBoard({ kind: 'colors', counts: [7, 0, 0] }), 'bad-counts');
  assert.equal(checkBoard({ kind: 'colors', counts: [1, 0, 0] }), 'bad-total');
  assert.equal(checkBoard({ kind: 'colors', counts: [1, 1] }), 'bad-counts');
  assert.equal(checkBoard({ kind: 'dice' }), 'bad-kind');
  assert.equal(checkBoard(null), 'no-board');
  assert.throws(() => solve({ kind: 'colors', counts: [9, 0, 0] }));
});

test('움직임: 컵은 꼭 k개를 뒤집고, 방울이는 색이 다른 둘이 만나 둘 다 나머지 한 색이 된다', () => {
  const cups = { kind: 'cups', n: 4, k: 2, cups: [1, 0, 0, 1] };
  assert.equal(checkMove(cups, cups.cups, [0, 1]), null);
  assert.equal(checkMove(cups, cups.cups, [0]), 'size');
  assert.equal(checkMove(cups, cups.cups, [0, 1, 2]), 'size');
  assert.equal(checkMove(cups, cups.cups, [0, 0]), 'bad');
  assert.equal(checkMove(cups, cups.cups, [0, 4]), 'bad');
  assert.deepEqual(applyMove(cups, cups.cups, [0, 1]), [0, 1, 0, 1]);
  assert.deepEqual(cups.cups, [1, 0, 0, 1], '원래 배열은 그대로');
  const folk = { kind: 'colors', counts: [2, 1, 0] };
  const items = startItems(folk);
  assert.deepEqual(items, [0, 0, 1]);
  assert.equal(checkMove(folk, items, [0, 1]), 'same');
  assert.equal(checkMove(folk, items, [1, 2]), null);
  assert.deepEqual(applyMove(folk, items, [1, 2]), [0, 2, 2]);
  assert.deepEqual([thirdColor(0, 1), thirdColor(0, 2), thirdColor(1, 2)], [2, 1, 0]);
  assert.deepEqual(countsOf([0, 2, 2, 1]), [1, 1, 2]);
  assert.deepEqual(colorsOf([1, 0, 2]), [0, 2, 2]);
  assert.equal(downCount([1, 0, 1]), 2);
  // 끝난 모습: 컵은 모두 바로 섬, 방울이는 모두 한 색
  assert.equal(isDone(cups, [0, 0, 0, 0]), true);
  assert.equal(isDone(cups, [0, 1, 0, 0]), false);
  assert.equal(isDone(folk, [2, 2, 2]), true);
  assert.equal(isDone(folk, [2, 2, 1]), false);
  // 길 따라가기: 규칙에 맞지 않거나 번호가 차례대로가 아니면 ok가 거짓이다.
  assert.deepEqual(replay(cups, [[0, 3]]), { ok: true, items: [0, 0, 0, 0] });
  assert.equal(replay(cups, [[3, 0]]).ok, false);
  assert.equal(replay(cups, [[0]]).ok, false);
  assert.equal(replay(folk, [[0, 1]]).ok, false);
  assert.deepEqual(replay(folk, [[1, 2], [0, 1]]), { ok: true, items: [1, 1, 2] });
  assert.equal(replay(folk, 'x').ok, false);
});

test('풀이 프로그램을 다른 방법과 견준다: 컵 3~8개의 모든 판(한 번에 뒤집는 수마다), 9~10개는 엎어진 컵 수마다', () => {
  let boards = 0;
  const check = (board) => {
    const solved = solve(board);
    const brute = bruteCups(board);
    const where = `${board.cups.join('')} k${board.k}`;
    assert.deepEqual([solved.possible, solved.min], [brute.possible, brute.min], where);
    if (solved.possible) {
      assert.equal(solved.moves.length, solved.min, where);
      const played = replay(board, solved.moves);
      assert.ok(played.ok && isDone(board, played.items), where);
    } else assert.deepEqual(solved.moves, [], where);
    boards += 1;
  };
  for (let n = 3; n <= 8; n++) for (let k = 1; k <= n; k++) for (let mask = 0; mask < 1 << n; mask++) check(cupsBoard(n, k, mask));
  for (const n of [9, 10]) for (let k = 1; k <= n; k++) for (let down = 0; down <= n; down++) check(cupsBoard(n, k, (1 << down) - 1));
  assert.ok(boards > 2000);
});

test('컵의 바뀌지 않는 것: 짝수 개씩 뒤집으면 엎어진 컵 수의 홀짝이 그대로다. 그 값이 맞아도 모두 한 번에 뒤집는 판은 안 된다', () => {
  for (let n = 3; n <= 10; n++) {
    for (let k = 1; k <= n; k++) {
      for (let down = 0; down <= n; down++) {
        const board = cupsBoard(n, k, (1 << down) - 1);
        const { possible } = solve(board);
        const where = `컵 ${n}개, ${k}개씩, 엎어진 컵 ${down}개`;
        if (k === n) assert.equal(possible, down === 0 || down === n, where);
        else if (k % 2 === 0) assert.equal(possible, down % 2 === 0, where);
        else assert.equal(possible, true, `${where}: 홀수 개씩이고 컵이 더 많으면 늘 된다`);
        // "왜 그럴까?"의 까닭이 안 되는 판을 가려 주는 것은 짝수 개씩 뒤집는 홀수 판뿐이다. 가려 주면 늘 안 되는 판이다.
        if (invariantRulesOut(board)) assert.equal(possible, false, where);
      }
    }
  }
  // 한 번 뒤집을 때 엎어진 컵 수는 k에서 2씩 작아지는 수만큼 바뀐다(짝수 k면 늘 짝수만큼).
  for (let mask = 0; mask < 1 << 6; mask++) {
    const board = cupsBoard(6, 4, mask);
    for (let pick = 0; pick < 1 << 6; pick++) {
      const move = [0, 1, 2, 3, 4, 5].filter((index) => (pick >> index) & 1);
      if (move.length !== 4) continue;
      assert.equal(Math.abs(downCount(applyMove(board, board.cups, move)) - downCount(board.cups)) % 2, 0);
    }
  }
  // 같은 컵이라도 한 번에 뒤집는 수에 따라 갈린다: 일곱 컵 가운데 셋이 엎어진 판은 두 개씩은 안 되고, 세 개씩은 한 번이다.
  assert.equal(solve(cupsBoard(7, 2, 0b111)).possible, false);
  assert.equal(solve(cupsBoard(7, 3, 0b111)).min, 1);
  assert.equal(solve(cupsBoard(7, 3, 0b1111)).min, 2);
});

test('풀이 프로그램을 다른 방법과 견준다: 방울이가 8마리 이하인 모든 판(방울이마다의 색으로 모두 따진 것)', () => {
  const boards = colorBoards(8);
  assert.equal(boards.length, 149);
  for (const board of boards) {
    const solved = solve(board);
    const brute = bruteColors(board);
    const where = board.counts.join(',');
    assert.deepEqual([solved.possible, solved.min], [brute.possible, brute.min], where);
    if (solved.possible) {
      assert.equal(solved.moves.length, solved.min, where);
      const played = replay(board, solved.moves);
      assert.ok(played.ok && isDone(board, played.items), where);
    }
  }
});

test('방울이의 바뀌지 않는 것: 만날 때마다 세 나머지가 모두 함께 하나씩 줄고(0 다음은 2), 규격 안의 모든 판에서 나머지가 같은 두 색이 있으면 실제로 된다', () => {
  for (const board of colorBoards(RANGES.total[1])) {
    const { counts } = board;
    const oneColor = counts.filter((count) => count > 0).length <= 1;
    const where = counts.join(',');
    assert.equal(solve(board).possible, oneColor || !remaindersApart(counts), where);
    assert.equal(invariantRulesOut(board), remaindersApart(counts), where);
    for (const [a, b] of [
      [0, 1],
      [0, 2],
      [1, 2],
    ]) {
      if (counts[a] === 0 || counts[b] === 0) continue;
      const after = counts.slice();
      after[a] -= 1;
      after[b] -= 1;
      after[thirdColor(a, b)] += 2;
      assert.deepEqual(remainders(after), remainders(counts).map((rest) => (rest + 2) % 3), where);
    }
  }
  assert.deepEqual(remainders([4, 2, 0]), [1, 2, 0]);
  assert.equal(remaindersApart([1, 2, 0]), true);
  assert.equal(remaindersApart([4, 1, 0]), false);
});

test('"불가능해요"의 판정과 짐작', () => {
  const yes = { possible: true };
  const cups = { kind: 'cups', n: 4, k: 2, cups: [1, 1, 0, 0] };
  const folk = { kind: 'colors', counts: [2, 2, 0] };
  assert.deepEqual(diagnoseImpossible({ possible: false }, cups, {}), { correct: true, guess: null });
  assert.equal(diagnoseImpossible(yes, cups, { moves: 0 }).guess, 'impossible-no-try');
  assert.equal(diagnoseImpossible(yes, cups, { moves: 3, upPicked: false }).guess, 'impossible-only-down');
  assert.equal(diagnoseImpossible(yes, cups, { moves: 3, upPicked: true }).guess, 'impossible-other-way');
  assert.equal(diagnoseImpossible(yes, folk, { moves: 2, pairs: ['0-1'] }).guess, 'impossible-same-pair');
  assert.equal(diagnoseImpossible(yes, folk, { moves: 2, pairs: ['0-1', '1-2'] }).guess, 'impossible-other-way');
});

test('"왜 그럴까?"는 판의 종류마다 따로, 그 종류의 안 되는 판을 한 번 끝까지 만난 뒤에 열린다', () => {
  const record = (overrides) => ({ kind: 'round', id: 'r1', format: 'cups', outcome: 'solved', board: { kind: 'cups' }, solution: { possible: false }, ...overrides });
  assert.equal(whyOpen([], 'cups'), false);
  assert.equal(whyOpen([record()], 'cups'), true);
  assert.equal(whyOpen([record()], 'colors'), false, '다른 종류');
  assert.equal(whyOpen([record({ outcome: 'solution' })], 'cups'), true, '풀이를 본 판');
  assert.equal(whyOpen([record({ outcome: 'left' })], 'cups'), false, '끝내지 않은 판');
  assert.equal(whyOpen([record({ side: true })], 'cups'), false, '작은 판');
  assert.equal(whyOpen([record({ solution: { possible: true } })], 'cups'), false, '되는 판');
  assert.equal(whyOpen([record({ format: 'coins' })], 'cups'), false, '다른 형식');
  assert.equal(whyOpen([record(), record({ outcome: 'left' })], 'cups'), false, '같은 판의 맨 뒤 기록');
  assert.equal(whyOpen([record({ board: { kind: 'colors' } })], 'colors'), true);
});
