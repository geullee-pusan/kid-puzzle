// 손가락 더하기 풀이 프로그램 점검: 규칙(치기, 빠지기, 다시 돌기, 같은 모습), 끝에서부터 칠한 표를 다른 방법(왼쪽 오른쪽을 그대로 두고 앞으로 따지기)과 견준다.
// 같은 모습이 다시 나오면 비긴다는 약속을 넣어도 승패가 그대로인지, 선생님이 치는 법, 지난 기록으로 여는 것들을 본다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  LIMITS,
  addTo,
  checkBoard,
  finishedCount,
  lostStreak,
  moveValues,
  movesOf,
  pickMove,
  replay,
  slipsOf,
  solve,
  stateValue,
  tableOf,
  teacherMove,
  valueAt,
  whyOpen,
  wrapPlayed,
} from '../src/core/fingers.js';
import { createRng } from '../src/core/rng.js';
import { bruteReach, bruteTable, bruteValue, bruteWithRepeat } from './helpers/brute-fingers.js';

const start = (limit, wrap, first = 'kid') => ({ limit, wrap, kid: [1, 1], teacher: [1, 1], first });
const RULES = [false, true];

test('치기: 기본 규칙은 빠지는 수가 되거나 넘으면 빠지고, 다시 도는 규칙은 꼭 그 수면 빠지고 넘으면 넘은 만큼 남는다', () => {
  assert.equal(addTo(5, false, 1, 2), 3);
  assert.equal(addTo(5, false, 2, 3), 0);
  assert.equal(addTo(5, false, 3, 4), 0);
  assert.equal(addTo(5, true, 3, 4), 2);
  assert.equal(addTo(5, true, 4, 4), 3);
  assert.equal(addTo(5, true, 2, 3), 0);
  assert.equal(addTo(6, true, 5, 5), 4);
  assert.deepEqual(movesOf([0, 2], [1, 0]), [[1, 0]]);
  assert.deepEqual(movesOf([1, 1], [1, 1]).length, 4);
  // 쓸 수 없는 판
  assert.equal(checkBoard(start(5, false)), null);
  assert.equal(checkBoard({ ...start(5, false), limit: 7 }), 'limit');
  assert.equal(checkBoard({ ...start(5, false), kid: [5, 1] }), 'hands');
  assert.equal(checkBoard({ ...start(5, false), kid: [0, 0] }), 'out');
  assert.equal(checkBoard({ ...start(5, false), wrap: 'yes' }), 'wrap');
  assert.equal(checkBoard({ ...start(5, false), first: 'nobody' }), 'first');
  assert.equal(checkBoard({ ...start(5, false), first: null }), null);
});

test('다시 두기: 차례대로 치고, 두 손이 다 빠지면 끝나고, 같은 모습이 다시 나오면 비긴다. 칠 수 없는 수는 받지 않는다', () => {
  const board = { limit: 5, wrap: false, kid: [0, 2], teacher: [1, 1], first: 'kid' };
  const end = replay(board, [[1, 0], [0, 1]]);
  assert.deepEqual([end.kid, end.teacher, end.over, end.winner, end.next], [[0, 0], [3, 1], true, 'teacher', null]);
  assert.deepEqual(end.moves.map((move) => [move.side, move.power, move.before, move.after]), [['kid', 2, 1, 3], ['teacher', 3, 2, 0]]);
  // 빠진 손으로 치거나 빠진 손을 칠 수 없고, 끝난 뒤에는 칠 수 없다
  assert.equal(replay(board, [[0, 0]]).ok, false);
  assert.equal(replay({ ...board, teacher: [0, 1] }, [[1, 0]]).ok, false);
  assert.equal(replay(board, [[1, 0], [0, 1], [1, 0]]).ok, false);
  assert.equal(replay(board, [[2, 0]]).ok, false);
  // 같은 모습: 다시 도는 판에서 같은 모습(누구 차례인지까지)으로 돌아오는 가장 짧은 길을 찾으면, 그 길의 끝에서 비긴다
  const loop = findLoop({ limit: 5, wrap: true, kid: [1, 2], teacher: [1, 1], first: 'kid' });
  assert.ok(loop, '다시 도는 판에는 같은 모습으로 돌아오는 길이 있다');
  const again = replay(loop.board, loop.trail);
  assert.deepEqual([again.over, again.winner, again.repeat], [true, 'draw', loop.at]);
  // 그 바로 앞까지는 끝나지 않았다
  assert.equal(replay(loop.board, loop.trail.slice(0, -1)).over, false);
});

/** 같은 모습이 다시 나오는 가장 짧은 길 하나(넓이 우선) */
function findLoop(board) {
  const queue = [[]];
  while (queue.length > 0) {
    const trail = queue.shift();
    if (trail.length > 10) return null;
    const now = replay(board, trail);
    if (now.over) {
      if (now.winner === 'draw') return { board, trail, at: now.repeat };
      continue;
    }
    const mine = now.next === 'kid' ? now.kid : now.teacher;
    const theirs = now.next === 'kid' ? now.teacher : now.kid;
    for (const move of movesOf(mine, theirs)) queue.push([...trail, move]);
  }
  return null;
}

test('풀이 프로그램: 빠지는 수 3~6, 두 규칙의 모든 자리에서 다른 방법(왼쪽 오른쪽을 그대로 두고 앞으로 따지기)과 승패와 남은 칠 수가 같다', () => {
  for (let limit = LIMITS.min; limit <= LIMITS.max; limit++) {
    for (const wrap of RULES) {
      let count = 0;
      for (const [key, value] of bruteTable(limit, wrap)) {
        const [a, b, c, d] = [...key].map(Number);
        const mine = stateValue(limit, wrap, [a, b], [c, d]);
        assert.deepEqual(mine, value, `${limit}${wrap} ${key}`);
        count += 1;
      }
      assert.ok(count > 0);
    }
  }
});

test('처음 모습(두 손에 하나씩): 다섯이 되면 빠지는 판은 먼저 치는 쪽이 8번 만에 지고, 넷과 여섯은 먼저 치는 쪽이 이긴다. 다시 도는 다섯과 여섯은 비긴다', () => {
  const expect = {
    '3b': ['win', 5],
    '4b': ['win', 7],
    '5b': ['lose', 8],
    '6b': ['win', 9],
    '3w': ['lose', 6],
    '4w': ['win', 7],
    '5w': ['draw', null],
    '6w': ['draw', null],
  };
  for (const [name, [outcome, plies]] of Object.entries(expect)) {
    const board = start(Number(name[0]), name[1] === 'w');
    const solution = solve(board);
    assert.equal(solution.kid, outcome, name);
    assert.equal(solution.taps.kid, plies, name);
    assert.deepEqual(bruteValue(board), { outcome, plies }, name);
    // 아이가 나중에 치면 반대다(두 사람의 손이 같으니)
    assert.equal(solution.teacher, outcome === 'win' ? 'lose' : outcome === 'lose' ? 'win' : 'draw', name);
  }
  // 첫 수는 어느 손으로 어느 손을 치든 상대에게 1과 2가 남는다(같은 모습)
  const firsts = movesOf([1, 1], [1, 1]).map((move) => replay(start(5, false), [move]).teacher.slice().sort().join(''));
  assert.deepEqual([...new Set(firsts)], ['12']);
});

test('기본 규칙에서는 같은 모습이 다시 나오지 않는다: 칠 때마다 손가락이 늘거나 손이 빠진다. 다섯 판은 아무렇게나 쳐도 5~12번이면 끝난다', () => {
  for (let limit = LIMITS.min; limit <= LIMITS.max; limit++) {
    for (const key of bruteReach(limit, false, [1, 1, 1, 1])) {
      const [a, b, c, d] = [...key].map(Number);
      for (const [from, to] of movesOf([a, b], [c, d])) {
        const after = addTo(limit, false, [c, d][to], [a, b][from]);
        assert.ok(after === 0 || after > [c, d][to]);
      }
    }
  }
  const rng = createRng(7);
  const lengths = new Set();
  for (let game = 0; game < 200; game++) {
    const board = start(5, false);
    const trail = [];
    for (;;) {
      const now = replay(board, trail);
      if (now.over) {
        assert.notEqual(now.winner, 'draw');
        lengths.add(trail.length);
        break;
      }
      const mine = now.next === 'kid' ? now.kid : now.teacher;
      const theirs = now.next === 'kid' ? now.teacher : now.kid;
      const moves = movesOf(mine, theirs);
      trail.push(moves[Math.floor(rng() * moves.length)]);
    }
  }
  assert.ok(Math.min(...lengths) >= 5 && Math.max(...lengths) <= 12, [...lengths].join(','));
});

test('같은 모습이 다시 나오면 비긴다는 약속을 넣어도 승패가 같다: 작은 판은 지나온 모습을 모두 들고 따져 보고, 큰 판은 표의 성질로 본다', () => {
  const sign = { win: 1, draw: 0, lose: -1 };
  // 다시 도는 3, 4: 모든 자리를 지나온 모습까지 들고 끝까지 따진다
  for (const limit of [3, 4]) {
    for (const [key, value] of bruteTable(limit, true)) {
      const state = [...key].map(Number);
      if (state[0] + state[1] === 0) continue;
      assert.equal(bruteWithRepeat(limit, true, state), sign[value.outcome], `${limit} ${key}`);
    }
  }
  // 다시 도는 5: 비기는 자리 가운데 갈 수 있는 자리가 적은 것(30개 이하)도 지나온 모습을 들고 따지면 비긴다
  let checked = 0;
  for (const [key, value] of bruteTable(5, true)) {
    const state = [...key].map(Number);
    if (value.outcome !== 'draw' || bruteReach(5, true, state).size > 30) continue;
    assert.equal(bruteWithRepeat(5, true, state), 0, key);
    checked += 1;
  }
  assert.ok(checked >= 30, String(checked));
  // 표의 성질: 이기는 자리에는 남은 칠 수가 하나 줄어드는(상대가 지는) 수가 있고, 지는 자리의 모든 수는 상대가 이기는 자리로 가며 남은 칠 수가 줄어든다.
  // 비기는 자리에는 비기는 자리로 가는 수가 있고, 상대가 지는 자리로 가는 수는 없다. 그래서 이기는 쪽은 같은 모습을 다시 만나지 않고, 비기는 쪽은 비기는 자리에 머물 수 있다
  for (const limit of [5, 6]) {
    const table = tableOf(limit, true);
    for (const [key, outcome] of table.outcome) {
      const mine = [Number(key[0]), Number(key[1])];
      const theirs = [Number(key[3]), Number(key[4])];
      if (mine[0] + mine[1] === 0) continue;
      const after = movesOf(mine, theirs).map(([from, to]) => {
        const hit = [...theirs];
        hit[to] = addTo(limit, true, theirs[to], mine[from]);
        return stateValue(limit, true, hit, mine);
      });
      const plies = table.plies.get(key);
      if (outcome === 'win') assert.ok(after.some((value) => value.outcome === 'lose' && value.plies === plies - 1), key);
      if (outcome === 'lose') assert.ok(after.every((value) => value.outcome === 'win' && value.plies < plies), key);
    }
    for (let a = 0; a < limit; a++) {
      for (let b = a; b < limit; b++) {
        for (let c = 0; c < limit; c++) {
          for (let d = c; d < limit; d++) {
            if (a + b === 0 || c + d === 0) continue;
            if (stateValue(limit, true, [a, b], [c, d]).outcome !== 'draw') continue;
            const after = movesOf([a, b], [c, d]).map(([from, to]) => {
              const hit = [c, d];
              hit[to] = addTo(limit, true, hit[to], [a, b][from]);
              return hit[0] + hit[1] === 0 ? 'lose' : stateValue(limit, true, hit, [a, b]).outcome;
            });
            assert.ok(after.includes('draw') && !after.includes('lose'), `${limit} ${a}${b}|${c}${d}`);
          }
        }
      }
    }
  }
});

test('칠 수마다의 값과 자리의 값이 맞물린다. 끝난 자리에는 값이 없다', () => {
  const board = { limit: 5, wrap: false, kid: [4, 3], teacher: [1, 3], first: 'kid' };
  const values = moveValues(board, []);
  assert.deepEqual(values.map((item) => [item.move.join(''), item.outcome]), [['00', 'win'], ['01', 'lose'], ['10', 'lose'], ['11', 'lose']]);
  assert.deepEqual(valueAt(board, []), { side: 'kid', outcome: 'win', plies: 3 });
  assert.equal(values[0].plies, 3);
  assert.equal(valueAt(board, [[0, 0], [1, 1], [1, 1]]), null);
  assert.equal(moveValues(board, [[0, 0], [1, 1], [1, 1]]), null);
});

test('선생님: 쉬운 선생님은 바로 끝낼 수 있으면 끝낸다. 보통 선생님은 이길 수 있으면 잘 치고, 아니면 바로 지는 수를 피한다. 잘 치는 선생님은 이기는 자리에서 늘 이긴다', () => {
  const rng = createRng(1);
  // 선생님 차례: 선생님 [4, 0]이 내 [0, 1]을 치면 끝난다
  const end = { limit: 5, wrap: false, kid: [0, 1], teacher: [4, 0], first: 'teacher' };
  for (const kind of ['easy', 'fair', 'best']) assert.deepEqual(pickMove(end, [], 'teacher', rng, kind), [0, 1]);
  // 보통 선생님: 갈 수 있는 모든 자리(다섯 판)에서, 이길 수 있으면 이기는 수를, 아니면 (피할 수 있을 때) 아이가 바로 끝낼 수 있는 수를 피한다
  let seen = 0;
  for (const key of bruteReach(5, false, [1, 1, 1, 1])) {
    const [a, b, c, d] = [...key].map(Number);
    const board = { limit: 5, wrap: false, kid: [c, d], teacher: [a, b], first: 'teacher' };
    if (checkBoard(board) !== null) continue;
    const values = moveValues(board, [], 'teacher');
    const move = pickMove(board, [], 'teacher', createRng(seen), 'fair');
    const picked = values.find((item) => item.move.join('') === move.join(''));
    const quick = (item) => item.outcome === 'lose' && item.plies === 2;
    if (values.some((item) => item.outcome === 'win')) assert.equal(picked.outcome, 'win', key);
    else if (values.some((item) => !quick(item))) assert.ok(!quick(picked), key);
    seen += 1;
  }
  assert.ok(seen > 100);
  // 잘 치는 선생님은 선생님이 이기는 자리(아이가 먼저 치는 다섯 판, 넷 판에서 선생님이 먼저)에서 아무렇게나 치는 아이에게 늘 이긴다
  for (const board of [start(5, false, 'kid'), start(4, false, 'teacher'), start(6, false, 'teacher')]) {
    for (let game = 0; game < 40; game++) {
      const kid = createRng(100 + game);
      const trail = [];
      for (;;) {
        const now = replay(board, trail);
        if (now.over) {
          assert.equal(now.winner, 'teacher', JSON.stringify([board, trail]));
          break;
        }
        if (now.next === 'teacher') trail.push(teacherMove(board, trail, { level: 5, seed: game, first: board.first, teacher: 'best' }));
        else {
          const moves = movesOf(now.kid, now.teacher);
          trail.push(moves[Math.floor(kid() * moves.length)]);
        }
      }
    }
  }
  // 같은 (단계, 판 번호, 친 수들)이면 같은 수를 친다
  const board = start(5, false, 'teacher');
  assert.deepEqual(teacherMove(board, [], { level: 1, seed: 3, first: 'teacher', teacher: 'easy' }), teacherMove(board, [], { level: 1, seed: 3, first: 'teacher', teacher: 'easy' }));
  assert.equal(teacherMove(board, [[0, 0]], { level: 1, seed: 3, first: 'teacher' }), null);
});

test('다시 도는 판: 잘 치는 선생님과 잘 치는 아이가 처음 모습부터 치면 같은 모습이 다시 나와 비긴다', () => {
  const board = start(5, true, 'kid');
  for (let seed = 0; seed < 10; seed++) {
    const kid = createRng(seed);
    const trail = [];
    for (let turn = 0; turn < 200; turn++) {
      const now = replay(board, trail);
      if (now.over) break;
      if (now.next === 'teacher') trail.push(teacherMove(board, trail, { level: 4, seed, first: 'kid', teacher: 'best' }));
      else trail.push(pickMove(board, trail, 'kid', kid, 'best'));
    }
    const end = replay(board, trail);
    assert.deepEqual([end.over, end.winner], [true, 'draw']);
    assert.ok(Number.isInteger(end.repeat));
  }
});

test('아이가 잘 치면 갈 수 있던 끝보다 나쁜 자리로 보낸 수를 찾는다', () => {
  const board = { limit: 5, wrap: false, kid: [4, 3], teacher: [1, 3], first: 'kid' };
  assert.deepEqual(slipsOf(board, [[1, 1]], 'kid'), [1]);
  assert.deepEqual(slipsOf(board, [[0, 0]], 'kid'), []);
  // 이미 지는 자리에서 둔 수는 더 나빠질 것이 없다
  assert.deepEqual(slipsOf(start(5, false, 'kid'), [[0, 0]], 'kid'), []);
});

/** 끝까지 둔 게임의 기록 하나 */
const game = (id, more = {}) => ({ kind: 'round', id: `r-${id}`, format: 'fingers', outcome: 'solved', winner: 'kid', board: start(5, false), ...more });

test('지난 기록: 게임을 두 판 끝까지 두면 "왜 그럴까?"가 열린다. 다시 도는 판을 끝까지 둔 적이 있는지, 맨 뒤에서 연달아 진 수', () => {
  assert.equal(whyOpen([game(1)]), false);
  assert.equal(whyOpen([game(1), game(2, { winner: 'draw' })]), true);
  // 작은 판, 그만둔 판, 다른 형식은 세지 않는다
  assert.equal(finishedCount([game(1, { side: true }), game(2, { outcome: 'solution', winner: null }), game(3, { format: 'blackhole' })]), 0);
  assert.equal(wrapPlayed([game(1)]), false);
  assert.equal(wrapPlayed([game(1, { board: start(5, true) })]), true);
  assert.equal(lostStreak([game(1, { winner: 'teacher' }), game(2), game(3, { winner: 'teacher' }), game(4, { winner: 'teacher' })]), 2);
  assert.equal(lostStreak(null), 0);
});
