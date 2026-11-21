// 블랙홀의 규칙과 풀이 프로그램 점검: 이웃 칸, 두기와 블랙홀, 끝까지 따진 값(다른 방법으로 모두 놓아 본 값과 견준다),
// 선생님이 두는 법, 풀이 프로그램이 알려 준 사실, 걸리는 시간, 지난 기록.
import assert from 'node:assert/strict';
import { cpuUsage } from 'node:process';
import { test } from 'node:test';

import {
  EXACT_LEFT,
  FAIR_LEFT,
  WHY_AFTER,
  cellCount,
  checkBoard,
  finishedCount,
  lostStreak,
  moveValues,
  nearOf,
  openCells,
  outcomeOf,
  pickMove,
  replay,
  seatOutcome,
  slipsOf,
  solve,
  teacherMove,
  valueAt,
  whyOpen,
} from '../src/core/blackhole.js';
import { createRng } from '../src/core/rng.js';
import { bruteNear, bruteReplay, bruteValue } from './helpers/brute-blackhole.js';

const B = (rows, rocks, kid = [], teacher = [], first = 'kid') => ({ rows, rocks, kid, teacher, first });

/** n개에서 k개를 고르는 모든 묶음 */
function combos(n, k, start = 0, acc = [], out = []) {
  if (acc.length === k) {
    out.push([...acc]);
    return out;
  }
  for (let i = start; i < n; i++) {
    acc.push(i);
    combos(n, k, i + 1, acc, out);
    acc.pop();
  }
  return out;
}

/** 시드 난수로 끝까지 아무렇게나 둔 수들 */
function randomGame(board, first, seed) {
  const rng = createRng(seed);
  const trail = [];
  for (;;) {
    const now = replay(board, trail, first);
    if (now.over) return trail;
    trail.push(pickMove(board, trail, first, rng, 'easy'));
  }
}

test('이웃 칸: 동그라미가 맞닿은 칸(많아야 여섯)이고, 가운데 사이의 거리로 찾은 것과 같다', () => {
  for (let rows = 3; rows <= 6; rows++) {
    for (let cell = 0; cell < cellCount(rows); cell++) {
      assert.deepEqual([...nearOf(rows, cell)].sort((a, b) => a - b), bruteNear(rows, cell), `${rows}줄 ${cell}`);
      assert.ok(nearOf(rows, cell).length <= 6);
    }
  }
  // 5줄 판의 가운데 줄 가운데 칸(7)은 여섯 칸과, 맨 위 칸은 두 칸과 맞닿는다
  assert.equal(nearOf(5, 7).length, 6);
  assert.deepEqual(nearOf(5, 0).sort(), [1, 2]);
});

test('판으로 쓸 수 있는 값: 돌이 없는 칸이 홀수 개, 미리 놓인 수는 하나까지만 차이, 빈칸이 둘 이상, 먼저 둔 쪽이 맞다', () => {
  assert.equal(checkBoard(B(3, [0])), null);
  assert.equal(checkBoard(B(5, [])), null);
  assert.equal(checkBoard(B(3, [])), 'odd');
  assert.equal(checkBoard(B(4, [0, 1])), 'odd');
  assert.equal(checkBoard(B(6, [0])), 'rows');
  assert.equal(checkBoard(B(4, [0], [1, 2, 3], [4])), 'turns');
  assert.equal(checkBoard(B(3, [0], [1, 2], [3, 4])), 'full');
  assert.equal(checkBoard(B(3, [0], [1], [1])), 'overlap');
  assert.equal(checkBoard(B(3, [0], [1], [], 'teacher')), 'first');
  assert.equal(checkBoard(B(3, [0], [], [1], 'teacher')), null);
  assert.equal(checkBoard(B(3, [0], [], [], null)), null);
  assert.equal(checkBoard(B(3, [2, 0])), 'rocks');
});

test('두기: 두 사람이 번갈아 자기 수를 1부터 놓고, 빈칸이 하나 남으면 그 이웃의 수가 빨려 들어가고 남은 합이 큰 쪽이 이긴다', () => {
  const board = B(3, [0]);
  // 1(나)→3, 1(선생님)→5, 2(나)→2, 2(선생님)→4: 블랙홀은 1, 이웃 2, 3, 4(0은 돌)
  const now = replay(board, [3, 5, 2, 4], 'kid');
  assert.deepEqual([now.ok, now.over, now.hole], [true, true, 1]);
  assert.deepEqual(now.kid, [3, 2]);
  assert.deepEqual(now.teacher, [5, 4]);
  assert.deepEqual(now.swallowed, [2, 3, 4]);
  assert.deepEqual(now.lost, { kid: 3, teacher: 2 });
  assert.deepEqual(now.sums, { kid: 0, teacher: 1 });
  assert.equal(now.winner, 'teacher');
  // 둘 수 없는 수: 돌, 이미 놓인 칸, 판 밖, 끝난 뒤
  assert.equal(replay(board, [0], 'kid').ok, false);
  assert.equal(replay(board, [3, 3], 'kid').ok, false);
  assert.equal(replay(board, [6], 'kid').ok, false);
  assert.equal(replay(board, [3, 5, 2, 4, 1], 'kid').ok, false);
  // 미리 놓인 수가 적은 쪽이 먼저 둔다
  assert.equal(replay(B(3, [0], [1], [], 'kid'), [], 'kid').next, 'teacher');
  assert.equal(replay(B(3, [0], [], [], 'teacher'), [], 'teacher').next, 'teacher');
});

test('아무렇게나 둔 판 300개: 다른 방법으로 따라간 끝과 같고, 두 사람의 수의 합은 늘 같아서 빨려 들어간 합이 큰 쪽이 진다', () => {
  const boards = [B(3, [0]), B(4, [7]), B(4, [0, 6, 9]), B(5, []), B(5, [10, 14]), B(4, [0], [4, 2], [6, 7])];
  let seed = 1;
  for (const board of boards) {
    for (let game = 0; game < 50; game++) {
      const first = game % 2 === 0 ? 'kid' : 'teacher';
      const start = board.kid.length + board.teacher.length > 0 ? board.first : first;
      const trail = randomGame(board, start, seed++);
      const now = replay(board, trail, start);
      const brute = bruteReplay(board, trail, start);
      assert.deepEqual([now.ok, now.over, brute.ok, brute.over], [true, true, true, true]);
      assert.deepEqual([now.hole, now.sums.kid, now.sums.teacher], [brute.score.hole, brute.score.kid, brute.score.teacher]);
      assert.equal(now.sums.kid + now.lost.kid, now.sums.teacher + now.lost.teacher);
      assert.equal(now.sums.kid - now.sums.teacher, now.lost.teacher - now.lost.kid);
    }
  }
});

test('끝까지 따진 값이 모든 차례를 하나하나 놓아 본 값과 같다(5칸과 7칸의 모든 모양, 9칸 몇 판, 수가 놓인 판)', () => {
  for (const [rows, count] of [
    [3, 1],
    [4, 3],
  ]) {
    for (const rocks of combos(cellCount(rows), count)) {
      for (const first of ['kid', 'teacher']) {
        const board = B(rows, rocks, [], [], first);
        assert.equal(valueAt(board, [], first), bruteValue(board, first), `${rows}줄 ${rocks} ${first}`);
      }
    }
  }
  for (const rocks of [[0], [7], [4]]) assert.equal(valueAt(B(4, rocks), [], 'kid'), bruteValue(B(4, rocks)), `9칸 ${rocks}`);
  const given = [B(4, [0], [1, 7], [2, 8, 9], 'teacher'), B(5, [], [2, 7, 4, 1, 3], [14, 0, 5, 10, 11]), B(5, [], [10, 14, 5, 9], [0, 1, 3, 6]), B(5, [], [10, 0, 11, 1], [14, 3, 6, 13, 9], 'teacher')];
  for (const board of given) {
    assert.equal(valueAt(board, [], board.first), bruteValue(board), JSON.stringify(board));
    for (const { cell, value } of moveValues(board, [], board.first)) assert.equal(value, bruteValue({ ...board, [replay(board, [], board.first).next]: [...board[replay(board, [], board.first).next], cell] }), `${JSON.stringify(board)} ${cell}`);
  }
});

test('풀이: 먼저 두는 쪽마다의 값, 끝까지 따질 수 없는 판(빈칸이 9개보다 많은 판)은 값이 없다', () => {
  const nine = solve(B(4, [7], [], [], null));
  assert.deepEqual(nine, { possible: true, exact: true, kid: 1, teacher: -1, value: null });
  assert.equal(seatOutcome(nine, 'kid'), 'win');
  assert.equal(seatOutcome(nine, 'teacher'), 'lose');
  // 미리 놓인 수가 한쪽에 많으면 그 차례 하나만 있다
  const given = solve(B(4, [0], [1, 7], [2, 8, 9], 'teacher'));
  assert.deepEqual([given.kid, given.teacher, given.value], [null, 1, 1]);
  const big = solve(B(5, [], [], [], null));
  assert.deepEqual(big, { possible: true, exact: false, kid: null, teacher: null, value: null });
  assert.equal(seatOutcome(big, 'kid'), null);
  assert.equal(EXACT_LEFT, 9);
  assert.equal(solve(B(5, [], [10, 14, 5], [0, 1, 3])).exact, true);
  assert.equal(solve(B(5, [], [10, 14], [0, 1])).exact, false);
  assert.deepEqual([outcomeOf(2), outcomeOf(0), outcomeOf(-1)], ['win', 'draw', 'lose']);
  assert.ok(Object.is(valueAt(B(3, [0]), []), 0), '-0이 아니다');
});

test('풀이 프로그램이 알려 준 것: 빈 판(5칸, 7칸, 9칸)에서는 먼저 두는 쪽이 지는 판이 없다. 9칸은 돌이 구석이나 가운데면 비기고 변이면 먼저 두는 쪽이 1만큼 이긴다', () => {
  for (const [rows, count] of [
    [3, 1],
    [4, 3],
    [4, 1],
  ]) {
    for (const rocks of combos(cellCount(rows), count)) {
      const value = valueAt(B(rows, rocks), [], 'kid');
      assert.ok(value >= 0, `${rows}줄 ${rocks}: ${value}`);
      if (rows === 3) assert.equal(value, 0, '5칸은 늘 비긴다');
    }
  }
  for (const rock of [0, 6, 9, 4]) assert.equal(valueAt(B(4, [rock]), [], 'kid'), 0, `돌 ${rock}`);
  for (const rock of [1, 2, 3, 5, 7, 8]) assert.equal(valueAt(B(4, [rock]), [], 'kid'), 1, `돌 ${rock}`);
  // 1을 하나씩 놓아 둔 9칸 판 가운데는 나중에 두는 쪽만 이기는 판이 있다(돌 7, 내 1은 6, 선생님 1은 1)
  const later = solve(B(4, [7], [6], [1], null));
  assert.deepEqual([outcomeOf(later.kid), outcomeOf(later.teacher)], ['draw', 'win']);
});

test('선생님: 잘 두는 선생님(best)은 끝까지 따질 수 있으면 늘 가장 좋은 수를 두고, 보통 선생님(fair)은 끝의 세 수만 그렇게 둔다. 아무 칸 선생님(easy)은 빈칸에 놓는다', () => {
  assert.equal(FAIR_LEFT, 4);
  const boards = [B(4, [7], [], [], 'teacher'), B(4, [0], [], [], 'kid'), B(5, [], [10, 14, 5], [0, 1, 3])];
  let seed = 3;
  for (const board of boards) {
    for (let game = 0; game < 6; game++) {
      const rng = createRng(seed++);
      const trail = [];
      for (;;) {
        const now = replay(board, trail, board.first);
        if (now.over) break;
        if (now.next === 'teacher') {
          const values = moveValues(board, trail, board.first);
          const best = Math.min(...values.map((item) => item.value));
          const cell = teacherMove(board, trail, { level: 4, seed: game, first: board.first, teacher: 'best' });
          assert.equal(values.find((item) => item.cell === cell).value, best);
          // 같은 자리에서는 늘 같은 수
          assert.equal(teacherMove(board, trail, { level: 4, seed: game, first: board.first, teacher: 'best' }), cell);
          trail.push(cell);
        } else trail.push(pickMove(board, trail, board.first, rng, 'easy'));
      }
    }
  }
  // 보통 선생님: 빈칸이 넷 이하이면 가장 좋은 수
  const board = B(4, [0], [4, 2], [6, 7], 'kid');
  const trail = [5];
  const now = replay(board, trail, 'kid');
  assert.equal(now.empty.length, FAIR_LEFT);
  const values = moveValues(board, trail, 'kid');
  const cell = teacherMove(board, trail, { first: 'kid', teacher: 'fair' });
  assert.equal(values.find((item) => item.cell === cell).value, Math.min(...values.map((item) => item.value)));
  // 아이 차례에는 선생님이 두지 않는다
  assert.equal(teacherMove(board, [], { first: 'kid' }), null);
  for (let seed2 = 1; seed2 <= 20; seed2++) assert.ok(replay(board, [], 'kid').empty.includes(pickMove(board, [], 'kid', createRng(seed2), 'easy')));
});

test('큰 판(15칸)에서도 선생님은 빈칸이 9개보다 많으면 어림으로, 그 아래에서는 끝까지 따져서 둔다. 걸리는 시간이 짧다', () => {
  const start = cpuUsage();
  const board = B(5, [], [], [], 'teacher');
  const rng = createRng(7);
  const trail = [];
  for (;;) {
    const now = replay(board, trail, 'teacher');
    if (now.over) break;
    trail.push(pickMove(board, trail, 'teacher', rng, now.next === 'teacher' ? 'best' : 'fair'));
  }
  // 9칸 판 하나를 처음부터 끝까지 따지는 것도
  valueAt(B(4, [8], [], [], 'kid'), [], 'kid');
  const used = cpuUsage(start);
  const seconds = (used.user + used.system) / 1e6;
  assert.ok(seconds < 6, `${seconds}초`);
});

test('아이가 이기는(비기는) 자리에서 더 나쁜 자리로 보낸 수를 찾는다', () => {
  // 돌 0, 내 4·2, 선생님 6·7, 내 차례: 5에 놓아야 이긴다(1, 3은 비기고 8, 9는 진다)
  const board = B(4, [0], [4, 2], [6, 7], 'kid');
  const values = Object.fromEntries(moveValues(board, [], 'kid').map((item) => [item.cell, item.value]));
  assert.deepEqual(values, { 1: 0, 3: 0, 5: 1, 8: -2, 9: -2 });
  const good = [5];
  good.push(teacherMove(board, good, { first: 'kid' }));
  assert.deepEqual(slipsOf(board, good, 'kid'), []);
  const bad = [8];
  assert.deepEqual(slipsOf(board, bad, 'kid'), [1]);
});

test('지난 기록: 끝까지 둔 게임이 두 판이면 "왜 그럴까?"가 열리고, 연달아 진 판을 센다(작은 판은 세지 않는다)', () => {
  const game = (id, winner, more = {}) => ({ kind: 'round', id, format: 'blackhole', outcome: 'solved', winner, ...more });
  assert.equal(WHY_AFTER, 2);
  assert.equal(whyOpen([game('a', 'kid')]), false);
  assert.equal(whyOpen([game('a', 'draw'), game('b', 'teacher')]), true);
  assert.equal(whyOpen([game('a', 'kid'), game('b', 'kid', { side: true })]), false);
  assert.equal(finishedCount([game('a', 'kid'), game('a', 'kid'), game('b', 'teacher', { format: 'sim' })]), 1);
  assert.equal(lostStreak([game('a', 'kid'), game('b', 'teacher'), game('c', 'teacher')]), 2);
  assert.equal(lostStreak([game('a', 'teacher'), game('b', 'draw')]), 0);
  assert.equal(openCells(B(3, [0])).length, 5);
});
