// 손가락 더하기 사다리 점검: 단계마다 판의 종류, 풀이 프로그램으로 확인한 승패(다른 방법으로도 다시 구한다), 판 번호, 더 작은 판.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LADDER, MAKE_LEVEL, SMALL_SHELF, TOP_LEVEL, boardOf, generateBoard, kindOf, nextSeed, rungOf, smallBoards, teacherOf } from '../src/core/fingers-ladder.js';
import { checkBoard, isStart, moveValues, replay, solve } from '../src/core/fingers.js';
import { smallerFingers } from '../src/core/smaller.js';
import { bruteValue } from './helpers/brute-fingers.js';

const entries = (level) => rungOf(level).boards.map(boardOf);
/** 다른 방법으로 구한, 아이가 먼저(또는 나중에) 칠 때 아이에게서 본 끝 */
const flip = { win: 'lose', lose: 'win', draw: 'draw' };
const bruteSeat = (board, first) => (first === 'kid' ? bruteValue(board, 'kid').outcome : flip[bruteValue(board, 'teacher').outcome]);

test('사다리: 1~5단계는 판을 내고 6단계는 직접 만들기다. 판은 모두 쓸 수 있는 판이고 같은 번호는 같은 판이다', () => {
  assert.deepEqual(LADDER.map((rung) => rung.level), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual([TOP_LEVEL, MAKE_LEVEL], [5, 6]);
  assert.deepEqual(LADDER.map((rung) => rung.tag), ['basic', 'basic', 'applied', 'applied', 'challenge', 'challenge']);
  assert.deepEqual(LADDER.map((rung) => rung.teacher), ['easy', 'fair', 'best', 'fair', 'best', 'best']);
  assert.equal(teacherOf(2, false), 'fair');
  assert.equal(teacherOf(1, true), 'best');
  for (let level = 1; level <= TOP_LEVEL; level++) {
    const rung = rungOf(level);
    for (const board of [...entries(level), boardOf(rung.small)]) assert.equal(checkBoard(board), null, `${level}단계 ${JSON.stringify(board)}`);
    for (let seed = 1; seed <= 12; seed++) {
      assert.deepEqual(generateBoard(level, seed), generateBoard(level, seed));
      const next = nextSeed(level, seed);
      assert.ok(next > seed);
      // 판이 여럿인 단계는 방금 한 판과 다른 판이 나온다
      if (rung.boards.length > 1) assert.notDeepEqual(generateBoard(level, next).board, generateBoard(level, seed).board);
    }
  }
  assert.throws(() => generateBoard(MAKE_LEVEL, 1));
});

test('1, 2단계: 다섯이 되면 빠지는 판, 손가락 하나씩에서 선생님이 먼저 친다. 둘 다 잘 치면 아이가 8번 만에 이기는 자리다', () => {
  for (const level of [1, 2]) {
    const [board] = entries(level);
    assert.deepEqual(board, { limit: 5, wrap: false, kid: [1, 1], teacher: [1, 1], first: 'teacher' });
    const solution = solve(board);
    assert.deepEqual([solution.value, solution.taps.teacher], ['win', 8]);
    assert.equal(bruteSeat(board, 'teacher'), 'win');
    // 작은 판(넷이 되면 빠진다)은 아이가 먼저 치고 아이가 이기는 자리다
    const small = boardOf(rungOf(level).small);
    assert.deepEqual([small.limit, small.first, solve(small).value, bruteSeat(small, 'kid')], [4, 'kid', 'win', 'win']);
  }
});

test('3단계 몇 번만 남은 판: 아이 차례로 시작하고, 잘 치면 이긴다. 손을 한 번에 뺄 수 있는 수가 둘인데 이기는 수는 그 가운데 하나뿐이다', () => {
  const boards = entries(3);
  assert.equal(new Set(boards.map((board) => JSON.stringify(board))).size, boards.length);
  for (const board of [...boards, boardOf(rungOf(3).small)]) {
    assert.ok(!isStart(board));
    assert.deepEqual([board.limit, board.wrap, board.first], [5, false, 'kid']);
    const solution = solve(board);
    assert.equal(solution.value, 'win');
    assert.ok([3, 5].includes(solution.taps.kid), JSON.stringify(board));
    assert.deepEqual(bruteValue(board, 'kid'), { outcome: 'win', plies: solution.taps.kid });
    // 칠 수마다 선생님 손이 어떻게 되는지(왼쪽 오른쪽을 가리지 않고) 모아 본다
    const results = new Map();
    for (const item of moveValues(board, [])) {
      const after = replay(board, [item.move]).teacher;
      results.set([...after].sort().join(''), { outcome: item.outcome, knock: after.filter((value) => value === 0).length > board.teacher.filter((value) => value === 0).length });
    }
    const all = [...results.values()];
    assert.equal(all.filter((item) => item.outcome === 'win').length, 1, JSON.stringify(board));
    assert.equal(all.filter((item) => item.knock).length, 2, JSON.stringify(board));
    assert.ok(all.find((item) => item.outcome === 'win').knock);
  }
  assert.ok(entries(3).some((board) => solve(board).taps.kid === 3) && entries(3).some((board) => solve(board).taps.kid === 5));
});

test('4단계 다섯에서 다시 도는 판: 손가락 하나씩에서 아이가 먼저 친다. 둘 다 잘 치면 끝나지 않는다(비긴다). 작은 판(넷)은 아이가 이긴다', () => {
  const [board] = entries(4);
  assert.deepEqual(board, { limit: 5, wrap: true, kid: [1, 1], teacher: [1, 1], first: 'kid' });
  assert.deepEqual([solve(board).value, bruteSeat(board, 'kid')], ['draw', 'draw']);
  const small = boardOf(rungOf(4).small);
  assert.deepEqual([small.limit, small.wrap, solve(small).value], [4, true, 'win']);
});

test('5단계 먼저 칠까 나중에 칠까: 치기 전에 고른다. 빠지는 수가 넷, 다섯, 여섯인 판이 섞이고, 먼저 쳐야 이기는 판과 나중에 쳐야 이기는 판이 넷씩이다', () => {
  const kinds = entries(5).map((board) => {
    assert.equal(board.first, null);
    assert.equal(board.wrap, false);
    const solution = solve(board);
    assert.equal(solution.kid, bruteSeat(board, 'kid'), JSON.stringify(board));
    assert.equal(solution.teacher, bruteSeat(board, 'teacher'), JSON.stringify(board));
    // 한쪽만 이긴다
    assert.deepEqual([solution.kid, solution.teacher].sort(), ['lose', 'win'], JSON.stringify(board));
    return solution.kid === 'win' ? 'first' : 'later';
  });
  assert.deepEqual(kinds, ['later', 'first', 'later', 'first', 'first', 'later', 'first', 'later']);
  assert.deepEqual([...new Set(entries(5).map((board) => board.limit))].sort(), [4, 5, 6]);
  // 첫 판은 손가락 하나씩인 보통 판이다
  assert.deepEqual(entries(5)[0], { limit: 5, wrap: false, kid: [1, 1], teacher: [1, 1], first: null });
});

test('더 작은 판: 손가락 하나씩에서 시작하는 판과 고르는 판은 빠지는 수가 적은 판(아이 자리의 끝이 같게), 몇 번만 남은 판은 더 적게 남은 판이다', () => {
  for (const entry of SMALL_SHELF) {
    const board = boardOf(entry);
    assert.equal(checkBoard(board), null);
    assert.equal(solve(board).value, 'win', JSON.stringify(board));
    assert.equal(moveValues(board, []).filter((item) => item.outcome === 'win').length, 1, JSON.stringify(board));
  }
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const board of [...entries(level), boardOf(rungOf(level).small)]) {
      const list = smallBoards(board);
      for (const small of list) {
        assert.equal(checkBoard(small), null);
        assert.equal(small.wrap, board.wrap);
        if (isStart(board) || board.first === null) {
          assert.ok(isStart(small) && small.limit < board.limit, JSON.stringify([board, small]));
          assert.equal(kindOf(small) === 'choose', kindOf(board) === 'choose');
          if (board.first !== null) {
            const want = solve(board)[board.first];
            const got = solve(small)[small.first];
            assert.ok(got === want || (got === 'win' && !['kid', 'teacher'].some((first) => solve({ ...small, first })[first] === want)), JSON.stringify([board, small]));
          }
        } else {
          // 몇 번만 남은 판: 아이 차례이고 아이가 이기며, 끝까지 남은 칠 수가 더 적다
          assert.equal(small.first, 'kid');
          assert.equal(solve(small).value, 'win');
          assert.ok(solve(small).taps.kid < solve(board).taps.kid);
        }
        assert.deepEqual(smallerFingers({ board }, 0)?.board, list[0]);
      }
      if ((isStart(board) || board.first === null) && board.limit > 3) assert.ok(list.length > 0, JSON.stringify(board));
    }
  }
  // 손가락 하나씩인 다섯 판의 작은 판은 넷, 셋이 되면 빠지는 판이다. 셋 판이 가장 작은데, 먼저 칠 쪽이 정해져 있으면 두 번 더 친 판을 낸다
  assert.deepEqual(smallBoards(entries(1)[0]).map((board) => board.limit), [4, 3]);
  const three = { limit: 3, wrap: false, kid: [1, 1], teacher: [1, 1], first: 'kid' };
  const after = smallBoards(three);
  assert.equal(after.length, 1);
  assert.equal(after[0].first, 'kid');
  assert.equal(solve(after[0]).value, solve(three).value);
  assert.deepEqual(smallBoards({ ...three, first: null }), []);
  // 한 번 치면 끝나는 판은 더 작게 할 수 없다
  assert.deepEqual(smallBoards(boardOf(SMALL_SHELF[3])), []);
  assert.equal(smallerFingers({ board: { limit: 9 } }, 0), null);
});
