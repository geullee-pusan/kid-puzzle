// 질문으로 맞히기의 판과 풀이 프로그램: 컴퓨터의 대답, 따라가기, 가장 적은 질문 수, 반씩 나눠 보기, 미리 정하기.
// 풀이 프로그램이 아는 사실(후보 n개를 질문 k번으로 언제나 하나로 좁힐 수 있는가)은 후보의 모든 묶음과 모든 물음을 해 보는 다른 방법으로 다시 따진다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MAX_N,
  aheadSets,
  answerAhead,
  answerOf,
  canPin,
  canPrepare,
  checkBoard,
  evenSplit,
  fewestAhead,
  fewestFor,
  groupsOf,
  halving,
  halvingAsks,
  keepAfter,
  replay,
  rowKinds,
  setsOk,
  solve,
  tieYes,
} from '../src/core/yesno.js';
import { bruteVsGreedy, bruteWin, brutePrepare, twoTimes } from './helpers/brute-yesno.js';

const board = (n, q = null, tie = 3, kind = 'ask') => ({ kind, n, q, tie });

test('판의 규격: 종류, 숨길 수의 끝(2~32), 질문 수(1~6, 하나씩 묻는 판은 정하지 않아도 된다), 시드', () => {
  assert.equal(checkBoard(board(8, 3)), null);
  assert.equal(checkBoard(board(8, null)), null);
  assert.equal(checkBoard(board(32, 6, 0, 'ahead')), null);
  assert.notEqual(checkBoard(board(8, null, 0, 'ahead')), null);
  assert.notEqual(checkBoard(board(1, 3)), null);
  assert.notEqual(checkBoard(board(33, 3)), null);
  assert.notEqual(checkBoard(board(8, 0)), null);
  assert.notEqual(checkBoard(board(8, 7)), null);
  assert.notEqual(checkBoard({ ...board(8, 3), tie: -1 }), null);
  assert.notEqual(checkBoard({ ...board(8, 3), kind: 'guess' }), null);
  assert.notEqual(checkBoard(null), null);
});

test('컴퓨터의 대답: 후보가 많이 남는 쪽으로 답하고, 같으면 시드로 정한다(같은 물음에는 늘 같은 대답)', () => {
  const alive = [1, 2, 3, 4, 5, 6, 7, 8];
  assert.equal(answerOf(alive, [1], 0, 0), 'no');
  assert.equal(answerOf(alive, [1, 2, 3, 4, 5], 0, 0), 'yes');
  assert.equal(answerOf(alive, alive, 0, 0), 'yes');
  // 같을 때: 시드와 차례로 정한다. 시드마다 예와 아니요가 고루 나온다
  const ties = Array.from({ length: 200 }, (_, tie) => answerOf(alive, [1, 2, 3, 4], tie, 0));
  for (let tie = 0; tie < 200; tie++) assert.equal(ties[tie], tieYes(tie, 0) ? 'yes' : 'no');
  const yes = ties.filter((answer) => answer === 'yes').length;
  assert.ok(yes > 60 && yes < 140, `${yes}`);
  // 고른 수 밖의 후보만 센다(이미 빠진 수는 고른 것이어도 세지 않는다)
  assert.equal(answerOf([5, 6, 7], [1, 2, 3, 5], 0, 0), 'no');
  assert.deepEqual(keepAfter([5, 6, 7], [5], 'no'), [6, 7]);
  assert.deepEqual(keepAfter([5, 6, 7], [5], 'yes'), [5]);
});

test('따라가기: 대답이 컴퓨터의 대답과 다르거나, 빠진 수를 고르거나, 하나 남은 뒤에 물으면 쓸 수 없다', () => {
  const b = board(8, 3, 7);
  const asked = [];
  let alive = [1, 2, 3, 4, 5, 6, 7, 8];
  for (const set of [[1, 2, 3, 4], [5, 6], [7]]) {
    const answer = answerOf(alive, set, b.tie, asked.length);
    asked.push({ set, answer });
    alive = keepAfter(alive, set, answer);
  }
  const result = replay(b, asked);
  assert.equal(result.ok, true);
  assert.deepEqual(result.lefts, [4, 2, 1]);
  assert.equal(result.alive.length, 1);
  assert.equal(replay(b, [{ set: [1, 2, 3, 4], answer: asked[0].answer === 'yes' ? 'no' : 'yes' }]).ok, false);
  assert.equal(replay(b, [...asked, { set: result.alive, answer: 'yes' }]).ok, false);
  assert.equal(replay(b, [asked[0], { set: [1], answer: 'no' }]).ok, false, '빠진 수');
  assert.equal(replay(b, [{ set: [], answer: 'no' }]).ok, false, '빈 물음');
  assert.equal(replay(b, [{ set: [2, 1], answer: answerOf(alive, [1, 2], 7, 0) }]).ok, false, '차례가 어긋난 수');
});

test('가장 적은 질문 수: 후보의 모든 묶음과 모든 물음을 해 보는 다른 방법과 같다(후보 9개, 질문 4번까지)', () => {
  for (let n = 1; n <= 9; n++) {
    for (let k = 0; k <= 4; k++) {
      const brute = bruteWin(n, k);
      assert.equal(canPin(n, k), brute, `후보 ${n}개, 질문 ${k}번`);
      // 2를 k번 곱한 수 이하이면 된다(테스트가 따로 센다)
      assert.equal(brute, n <= twoTimes(k), `후보 ${n}개, 질문 ${k}번`);
    }
  }
  // 1부터 64까지: 가장 적은 질문 수는 2를 그만큼 곱한 수가 후보 수 이상이 되는 가장 작은 수
  for (let n = 1; n <= 2 * MAX_N; n++) {
    let k = 0;
    while (twoTimes(k) < n) k += 1;
    assert.equal(fewestFor(n), k, `후보 ${n}개`);
  }
  assert.deepEqual([2, 3, 4, 5, 8, 9, 16, 17, 32].map(fewestFor), [1, 2, 2, 3, 3, 4, 4, 5, 5]);
});

test('많은 쪽을 남기는 컴퓨터는 가장 불리한 상대와 같다: 언제나 맞힐 수 없는 판에서는 끝까지 숨는다(후보 8개, 질문 4번까지)', () => {
  for (let n = 1; n <= 8; n++) {
    for (let k = 0; k <= 4; k++) assert.equal(bruteVsGreedy(n, k), bruteWin(n, k), `후보 ${n}개, 질문 ${k}번`);
  }
});

test('반씩 나눠 보기: 한 번 물을 때 가장 고르게 갈라도 남는 많은 쪽, 질문마다의 띠', () => {
  for (let m = 2; m <= 40; m++) {
    let best = m;
    for (let a = 0; a <= m; a++) best = Math.min(best, Math.max(a, m - a));
    assert.equal(evenSplit(m), best, `${m}`);
  }
  assert.deepEqual(halving(9, 3), [9, 5, 3, 2]);
  assert.deepEqual(halving(8, 3), [8, 4, 2, 1]);
  assert.deepEqual(halving(20, 4), [20, 10, 5, 3, 2]);
  // 띠의 끝이 1 이하인 것과 언제나 맞힐 수 있는 것은 같다
  for (let m = 1; m <= 40; m++) for (let k = 0; k <= 6; k++) assert.equal(halving(m, k)[k] <= 1, canPin(m, k), `${m}, ${k}`);
});

test('반씩 묻는 차례(풀이): 시드가 무엇이든 가장 적은 질문 수로 하나가 남는다', () => {
  for (let n = 2; n <= MAX_N; n++) {
    for (const tie of [0, 1, 7, 42, 99]) {
      const steps = halvingAsks(board(n, null, tie));
      assert.equal(steps.length, fewestFor(n), `${n}, ${tie}`);
      assert.equal(steps.at(-1).alive.length, 1);
      // 따라가기와 맞는다
      assert.equal(replay(board(n, null, tie), steps).ok, true);
    }
  }
});

test('미리 정하기: 질문 q개로 생기는 줄의 가짓수, 모두 가를 수 있는지는 모든 질문 묶음을 해 보는 다른 방법과 같다', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(rowKinds), [1, 2, 4, 8, 16, 32, 64]);
  for (let n = 1; n <= 6; n++) {
    for (let q = 1; q <= 3; q++) {
      if (n > 5 && q === 3) continue;
      assert.equal(canPrepare(n, q), brutePrepare(n, q), `${n}, ${q}`);
    }
  }
  for (let n = 2; n <= MAX_N; n++) {
    const q = fewestAhead(n);
    assert.equal(q, fewestFor(n), `${n}`);
    // 풀이의 질문들은 수마다 줄이 모두 다르다
    const sets = aheadSets(n, q);
    assert.equal(groupsOf(n, sets).length, n, `${n}`);
    assert.equal(setsOk({ kind: 'ahead', n, q, tie: 0 }, sets), true);
    const told = answerAhead({ kind: 'ahead', n, q, tie: 5 }, sets);
    assert.equal(told.alive.length, 1);
  }
  // 1부터 8까지의 풀이 질문: 2, 4, 6, 8 / 3, 4, 7, 8 / 5, 6, 7, 8
  assert.deepEqual(aheadSets(8, 3), [[2, 4, 6, 8], [3, 4, 7, 8], [5, 6, 7, 8]]);
});

test('미리 정하기의 대답: 줄이 같은 수가 가장 많은 묶음을 남긴다. 같은 질문에는 늘 같은 대답이다', () => {
  const b = { kind: 'ahead', n: 8, q: 3, tie: 1 };
  const sets = [[1, 2, 3, 4], [1, 2, 5, 6], []];
  const told = answerAhead(b, sets);
  assert.equal(told.alive.length, 2);
  assert.deepEqual(answerAhead(b, sets), told);
  assert.equal(told.answers.length, 3);
  assert.equal(told.answers[2], 'no');
  for (const x of told.alive) for (const [at, set] of sets.entries()) assert.equal(set.includes(x), told.answers[at] === 'yes');
  // 아무것도 넣지 않으면 모두 남는다
  assert.equal(answerAhead(b, [[], [], []]).alive.length, 8);
  // 한 묶음이 가장 크면 그것을 고른다
  assert.deepEqual(answerAhead(b, [[1], [2], [3]]).alive, [4, 5, 6, 7, 8]);
});

test('풀이: 되는 판, 안 되는 판, 질문 수를 정하지 않은 판', () => {
  assert.deepEqual(solve(board(8, 3)), { possible: true, fewest: 3, chain: [8, 4, 2, 1] });
  assert.deepEqual(solve(board(9, 3)), { possible: false, fewest: 4, chain: [9, 5, 3, 2] });
  assert.deepEqual(solve(board(3, 1)), { possible: false, fewest: 2, chain: [3, 2] });
  assert.deepEqual(solve(board(6, null)), { possible: true, fewest: 3, chain: [6, 3, 2, 1] });
  assert.deepEqual(solve({ kind: 'ahead', n: 16, q: 4, tie: 0 }), { possible: true, fewest: 4, chain: [16, 8, 4, 2, 1] });
  assert.equal(solve({ kind: 'ahead', n: 9, q: 3, tie: 0 }).possible, false);
});
