// 도미노 가로세로의 규칙과 풀이 프로그램 점검.
// 판의 규칙(세로와 가로, 겹치지 않기, 놓을 곳이 없으면 진다), 풀이 프로그램이 다른 방법(tests/helpers/brute-domino.js)과 같은 답을 내는지,
// 선생님이 이길 수 있을 때 이기게 두는지, 한쪽만 놓을 수 있는 자리, 작은 판, "왜 그럴까?"가 열리는 때를 본다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  LIMITS,
  SMALL_SHELF,
  WHY_AFTER,
  checkBoard,
  cropBoard,
  firstSideOf,
  isSafeMove,
  lostStreak,
  movesOf,
  pickMove,
  placementsOf,
  playable,
  randomKidWinRate,
  replay,
  safeOf,
  safeSpots,
  seatWins,
  slipsOf,
  smallBoards,
  solve,
  teacherMove,
  whyOpen,
  winnerAt,
  winningMoves,
  winningSeats,
} from '../src/core/domino.js';
import { createRng, randInt } from '../src/core/rng.js';
import { bruteOutcome, bruteWinningFirst, gridOf, memoWins, onlyCells } from './helpers/brute-domino.js';

const board = (w, h, holes = []) => ({ w, h, holes });
const M = (a, b) => ({ cells: [a, b] });
const letter = { vert: 'V', horz: 'H' };

/** 칸 묶음 모두(작은 것부터) */
function subsets(n, most) {
  const found = [[]];
  const grow = (start, acc) => {
    for (let cell = start; cell < n; cell++) {
      const next = [...acc, cell];
      found.push(next);
      if (next.length < most) grow(cell + 1, next);
    }
  };
  if (most > 0) grow(0, []);
  return found;
}

/** 가로와 세로를 바꾼 판(대각선으로 뒤집기) */
function transpose(b) {
  const holes = b.holes.map((cell) => (cell % b.w) * b.h + Math.floor(cell / b.w)).sort((x, y) => x - y);
  return { w: b.h, h: b.w, holes };
}
/** 좌우로 뒤집은 판 */
function mirror(b) {
  const holes = b.holes.map((cell) => Math.floor(cell / b.w) * b.w + (b.w - 1 - (cell % b.w))).sort((x, y) => x - y);
  return { w: b.w, h: b.h, holes };
}

test('판의 값: 가로와 세로 2~5칸, 구멍은 판 안의 칸을 작은 것부터 한 번씩', () => {
  assert.equal(checkBoard(board(3, 3)), null);
  assert.equal(checkBoard(board(5, 5, [0, 24])), null);
  assert.equal(checkBoard(board(2, 2)), null);
  assert.equal(checkBoard(board(6, 3)), 'size');
  assert.equal(checkBoard(board(1, 3)), 'size');
  assert.equal(checkBoard(board(3, 3, [4, 4])), 'holes');
  assert.equal(checkBoard(board(3, 3, [5, 4])), 'holes');
  assert.equal(checkBoard(board(3, 3, [9])), 'holes');
  assert.equal(checkBoard({ w: 3, h: 3 }), 'holes');
  assert.equal(checkBoard(null), 'board');
  assert.deepEqual(LIMITS, { min: 2, max: 5 });
  // 두 쪽 모두 처음에 놓을 곳이 있어야 두어 볼 수 있는 판이다.
  assert.equal(playable(board(3, 3)), true);
  assert.equal(playable(board(3, 2, [3, 4, 5])), false, '세로가 놓을 곳이 없다');
  assert.equal(playable(board(2, 3, [1, 3, 5])), false, '가로가 놓을 곳이 없다');
});

test('놓을 수 있는 자리: 세로는 위아래로, 가로는 옆으로 이어진 빈칸 둘. 구멍은 건너뛰지 않는다', () => {
  assert.deepEqual(placementsOf(board(2, 2), 'vert'), [[0, 2], [1, 3]]);
  assert.deepEqual(placementsOf(board(2, 2), 'horz'), [[0, 1], [2, 3]]);
  assert.deepEqual(placementsOf(board(3, 2, [1]), 'horz'), [[4, 5], [3, 4]].sort((a, b) => a[0] - b[0]));
  assert.deepEqual(placementsOf(board(3, 2, [1]), 'vert'), [[0, 3], [2, 5]]);
  // 줄 끝에서 다음 줄로 넘어가는 자리는 없다.
  assert.ok(!placementsOf(board(3, 3), 'horz').some(([a, b]) => a === 2 && b === 3));
});

test('두기: 먼저 두는 쪽부터 번갈아 둔다. 방향이 다르거나 겹치는 수는 둘 수 없다. 놓을 곳이 없는 쪽이 진다', () => {
  const b = board(3, 3);
  const now = replay(b, [M(0, 3), M(7, 8)], 'vert');
  assert.equal(now.ok, true);
  assert.deepEqual(now.placed, [{ cells: [0, 3], side: 'vert' }, { cells: [7, 8], side: 'horz' }]);
  assert.equal(now.next, 'vert');
  assert.equal(now.empty, 5);
  // 세로가 놓은 뒤 가로가 가운데를 막으면 세로는 놓을 곳이 없다.
  assert.equal(replay(b, [M(0, 3), M(4, 5)], 'vert').winner, 'horz');
  // 세로 차례에 가로로 놓을 수 없다.
  assert.equal(replay(b, [M(0, 1)], 'vert').ok, false);
  // 겹칠 수 없다.
  assert.equal(replay(b, [M(0, 3), M(3, 4)], 'vert').ok, false);
  // 구멍에 놓을 수 없다.
  assert.equal(replay(board(3, 3, [4]), [M(1, 4)], 'vert').ok, false);
  // 줄을 넘는 가로 자리는 없다.
  assert.equal(replay(b, [M(2, 3)], 'horz').ok, false);
  // 2×2에서 세로가 먼저 한 줄을 놓으면 가로는 놓을 곳이 없다.
  const end = replay(board(2, 2), [M(0, 2)], 'vert');
  assert.deepEqual([end.over, end.winner, end.loser, end.next], [true, 'vert', 'horz', null]);
  // 끝난 뒤에는 더 둘 수 없다.
  assert.equal(replay(board(2, 2), [M(0, 2), M(1, 3)], 'vert').ok, false);
  assert.deepEqual(movesOf(board(2, 2), [M(0, 2)], 'vert'), []);
  assert.equal(movesOf(b, [], 'horz').length, 6);
  // 처음부터 놓을 곳이 없으면 그 자리에서 끝난다.
  assert.equal(replay(board(3, 2, [3, 4, 5]), [], 'vert').winner, 'horz');
});

test('풀이 프로그램은 칸이 16개 이하인 모든 네모 판과 구멍 난 3×3·4×3·3×4·4×4에서, 모두 따지는 다른 방법과 같은 쪽이 이긴다고 한다', () => {
  const boards = [];
  for (let h = 2; h <= 5; h++) for (let w = 2; w <= 5; w++) if (w * h <= 16) boards.push(board(w, h));
  for (const holes of subsets(9, 9)) boards.push(board(3, 3, holes));
  for (const holes of subsets(12, 3)) boards.push(board(4, 3, holes), board(3, 4, holes));
  for (const holes of subsets(16, 2)) boards.push(board(4, 4, holes));
  for (const b of boards) {
    const { vert, horz } = solve(b);
    assert.deepEqual({ vert, horz }, bruteOutcome(b), JSON.stringify(b));
  }
  assert.ok(boards.length > 1000);
});

test('이기는 첫 수의 목록이 모두 따지는 다른 방법과 같다', () => {
  for (const b of [board(3, 3), board(3, 2), board(4, 4), board(3, 4), board(4, 4, [0, 15]), board(5, 2, [2, 4, 7, 9]), board(5, 3, [3, 8, 13, 14])]) {
    for (const first of ['vert', 'horz']) {
      const mine = winningMoves(b, [], first).map((move) => move.cells.join('.')).sort();
      const other = bruteWinningFirst(b, letter[first]).map((cells) => cells.join('.')).sort();
      assert.deepEqual(mine, other, `${JSON.stringify(b)} ${first}`);
    }
  }
});

test('5×5까지 모든 네모 판의 승패(풀이 프로그램이 따진 것)는 글자 판을 적어 두며 따진 다른 방법과 같다', () => {
  // 첫 글자는 세로가 먼저 둘 때, 둘째 글자는 가로가 먼저 둘 때 이기는 쪽(V 세로, H 가로)
  const table = {
    '2x2': 'VH', '3x2': 'VH', '4x2': 'HH', '5x2': 'VV',
    '2x3': 'VH', '3x3': 'VH', '4x3': 'HH', '5x3': 'HH',
    '2x4': 'VV', '3x4': 'VV', '4x4': 'VH', '5x4': 'VV',
    '2x5': 'HH', '3x5': 'VV', '4x5': 'HH', '5x5': 'HV',
  };
  for (let h = 2; h <= 5; h++) {
    for (let w = 2; w <= 5; w++) {
      const b = board(w, h);
      const s = solve(b);
      const found = `${letter[s.vert]}${letter[s.horz]}`;
      assert.equal(found, table[`${w}x${h}`], `${w}×${h}`);
      const other = bruteOutcome(b, memoWins);
      assert.deepEqual({ vert: s.vert, horz: s.horz }, other, `${w}×${h}`);
    }
  }
  // 5×5는 나중에 두는 쪽이 이긴다. 4×4, 3×3, 2×2는 먼저 두는 쪽이 이긴다.
  assert.equal(solve(board(5, 5)).kind, 'second');
  for (const n of [2, 3, 4]) assert.equal(solve(board(n, n)).kind, 'first');
});

test('판을 대각선으로 뒤집으면 세로와 가로가 바뀌고, 좌우로 뒤집으면 그대로다(구멍 난 판도)', () => {
  const swap = { vert: 'horz', horz: 'vert' };
  const rng = createRng(7);
  for (let index = 0; index < 60; index++) {
    const w = randInt(rng, 2, 5);
    const h = randInt(rng, 2, 5);
    const holes = [...new Set(Array.from({ length: randInt(rng, 0, 3) }, () => randInt(rng, 0, w * h - 1)))].sort((a, b) => a - b);
    const b = board(w, h, holes);
    const s = solve(b);
    const t = solve(transpose(b));
    assert.deepEqual([t.horz, t.vert], [swap[s.vert], swap[s.horz]], JSON.stringify(b));
    const m = solve(mirror(b));
    assert.deepEqual([m.vert, m.horz], [s.vert, s.horz], JSON.stringify(b));
  }
});

test('5×5도 바로 풀린다: 두 처음 자리를 따지는 데 적어 둔 자리가 20만 개 안쪽이다', () => {
  const s = solve(board(5, 5));
  assert.ok(s.positions > 100000 && s.positions < 200000, String(s.positions));
  const started = performance.now();
  for (const holes of [[12], [0, 24], [6, 18]]) solve(board(5, 5, holes));
  assert.ok(performance.now() - started < 3000);
});

test('이기는 자리: 판마다 아이가 이기는 (쪽, 먼저 둘지)는 꼭 둘이고, 그 자리를 선생님과 바꾸면(쪽도 차례도 바꾸면) 지는 자리다', () => {
  for (const b of [board(3, 3), board(5, 5), board(3, 4), board(4, 3), board(4, 4, [0, 15])]) {
    const s = solve(b);
    const seats = winningSeats(s);
    assert.equal(seats.length, 2);
    const swapped = seats.map((seat) => ({ role: otherSide(seat.role), order: seat.order === 'first' ? 'second' : 'first' }));
    for (const seat of swapped) assert.equal(seatWins(s, seat.role, seat.order), false);
    for (const seat of seats) assert.equal(winnerAt(b, [], firstSideOf(seat.role, seat.order)), seat.role);
    assert.equal(seatWins(s, 'vert', 'first'), s.vert === 'vert');
  }
  // 꼴의 이름
  assert.equal(solve(board(3, 4)).kind, 'vert');
  assert.equal(solve(board(4, 3)).kind, 'horz');
  assert.equal(solve(board(4, 4, [0, 15])).kind, 'second');
});

test('선생님이 두는 법: 이길 수 있는 자리에서는 이기는 수를 둔다. 같은 값이면 늘 같은 수다', () => {
  const b = board(4, 4);
  // 세로가 먼저 두면 세로가 이긴다. 선생님이 세로로 먼저 두면 이기는 수다.
  for (let seed = 1; seed <= 20; seed++) {
    const move = teacherMove(b, [], { level: 3, seed, role: 'horz', first: 'vert' });
    assert.equal(winnerAt(b, [move], 'vert'), 'vert', `${seed}번`);
    assert.deepEqual(teacherMove(b, [], { level: 3, seed, role: 'horz', first: 'vert' }), move);
  }
  // 질 자리에서는 아이의 이기는 대답이 가장 적게 남는 수를 둔다.
  const p = board(5, 5);
  const rng = createRng(3);
  const move = pickMove(p, [], 'vert', rng);
  const left = winningMoves(p, [move], 'vert').length;
  for (const other of movesOf(p, [], 'vert')) assert.ok(winningMoves(p, [other], 'vert').length >= left);
  assert.ok(left >= 1);
  assert.equal(teacherMove(board(2, 2), [M(0, 2)], { first: 'vert' }), null, '끝난 판');
});

test('이기는 쪽에서 이기는 수만 두면 상대가 어떻게 두어도 이긴다(시드 난수로 여러 번)', () => {
  for (const [b, first] of [[board(4, 4), 'vert'], [board(5, 5), 'horz'], [board(4, 4, [0, 15]), 'horz'], [board(3, 4), 'horz']]) {
    const winner = winnerAt(b, [], first);
    for (let seed = 1; seed <= 6; seed++) {
      const rng = createRng(seed);
      const trail = [];
      for (;;) {
        const now = replay(b, trail, first);
        if (now.over) {
          assert.equal(now.winner, winner, JSON.stringify(b));
          break;
        }
        const list = now.next === winner ? winningMoves(b, trail, first) : movesOf(b, trail, first);
        trail.push(list[randInt(rng, 0, list.length - 1)]);
      }
    }
  }
});

test('잘못 둔 곳: 아이가 이기는 자리에서 지는 자리로 보낸 수만 센다', () => {
  const b = board(3, 3);
  // 세로가 먼저 두는 3×3에서 가운데 줄이 아닌 첫 수는 지는 수다.
  const winning = winningMoves(b, [], 'vert').map((move) => move.cells.join('.')).sort();
  assert.deepEqual(winning, ['1.4', '4.7']);
  assert.deepEqual(slipsOf(b, [M(0, 3)], 'vert', 'vert'), [1]);
  assert.deepEqual(slipsOf(b, [M(1, 4)], 'vert', 'vert'), []);
  // 선생님 쪽의 수는 세지 않는다.
  assert.deepEqual(slipsOf(b, [M(1, 4), M(0, 3)], 'vert', 'vert'), []);
});

test('한쪽만 놓을 수 있는 자리: 두 칸 모두 상대 방향으로 덮일 수 없는 자리. 겹치지 않게 골라서 센다', () => {
  // 5×2에 2×2 방과 세로 한 줄의 틈: 세로만 놓을 수 있는 자리가 하나다.
  const pocket = board(5, 2, [2, 4, 7, 9]);
  assert.deepEqual(safeOf(pocket, [], 'vert'), { vert: [[3, 8]], horz: [] });
  // 세로로 셋이 이어진 틈은 칸이 셋이어도 한 번만 놓을 수 있다.
  const three = board(3, 3, [0, 2, 3, 5, 6, 8]);
  assert.deepEqual(safeOf(three, [], 'vert').vert, [[1, 4]]);
  // 글자 판에서 칸마다 센 "그 쪽만 덮을 수 있는 칸"으로, 줄마다 이어진 칸 수의 절반(버림)을 더한 것과 같다.
  const rng = createRng(11);
  for (let index = 0; index < 200; index++) {
    const w = randInt(rng, 2, 5);
    const h = randInt(rng, 2, 5);
    const holes = [...new Set(Array.from({ length: randInt(rng, 0, 8) }, () => randInt(rng, 0, w * h - 1)))].sort((x, y) => x - y);
    const rows = gridOf(board(w, h, holes));
    let filledMask = 0;
    for (const cell of holes) filledMask |= 1 << cell;
    for (const [side, who] of [['vert', 'V'], ['horz', 'H']]) {
      const only = new Set(onlyCells(rows, who));
      let expected = 0;
      // 세로는 열마다 위에서 아래로, 가로는 행마다 왼쪽에서 오른쪽으로 이어진 칸을 센다.
      const lines = side === 'vert' ? Array.from({ length: w }, (_, x) => Array.from({ length: h }, (__, y) => y * w + x)) : Array.from({ length: h }, (_, y) => Array.from({ length: w }, (__, x) => y * w + x));
      for (const line of lines) {
        let run = 0;
        for (const cell of [...line, -1]) {
          if (cell >= 0 && only.has(cell)) run += 1;
          else {
            expected += Math.floor(run / 2);
            run = 0;
          }
        }
      }
      const spots = safeSpots(board(w, h, holes), filledMask >>> 0, side);
      assert.equal(spots.length, expected, `${w}×${h} ${holes} ${side}`);
      for (const spot of spots) {
        assert.ok(spot.every((cell) => only.has(cell)));
        assert.ok(isSafeMove(board(w, h, holes), filledMask >>> 0, side, spot));
        assert.ok(placementsOf(board(w, h, holes), side).some((cells) => cells.join() === spot.join()));
      }
    }
  }
});

test('한쪽만 놓을 수 있는 자리는 끝까지 그 쪽의 것이다: 상대가 무엇을 두어도 줄지 않는다', () => {
  const rng = createRng(5);
  for (const b of [board(5, 3, [3, 8, 13, 14]), board(5, 4, [3, 8, 10, 11, 13, 14, 17]), board(4, 4, [5, 6, 9]), board(5, 5)]) {
    for (let round = 0; round < 10; round++) {
      const first = round % 2 === 0 ? 'vert' : 'horz';
      const trail = [];
      for (;;) {
        const now = replay(b, trail, first);
        if (now.over) break;
        const mover = now.next;
        const keeper = otherSide(mover);
        const before = safeSpots(b, now.filled, keeper);
        const list = movesOf(b, trail, first);
        trail.push(list[randInt(rng, 0, list.length - 1)]);
        const after = replay(b, trail, first);
        const kept = safeSpots(b, after.filled, keeper);
        assert.ok(kept.length >= before.length, JSON.stringify({ b, trail }));
        // 전에 그 쪽만 덮을 수 있던 칸은 지금도 비어 있고 그 쪽만 덮을 수 있다.
        for (const spot of before) assert.ok(isSafeMove(b, after.filled, keeper, spot) && spot.every((cell) => ((after.filled >>> cell) & 1) === 0));
      }
    }
  }
});

function otherSide(side) {
  return side === 'vert' ? 'horz' : 'vert';
}

test('아무렇게나 두었을 때(선생님은 잘 둔다) 아이가 이기는 비율: 2×3 세로는 늘, 3×3은 셋에 하나, 4×4는 거의 진다', () => {
  assert.equal(randomKidWinRate(board(2, 3), 'vert', 'vert'), 1);
  assert.ok(Math.abs(randomKidWinRate(board(3, 3), 'vert', 'vert') - 1 / 3) < 1e-9);
  assert.ok(randomKidWinRate(board(4, 4), 'vert', 'vert') < 0.05);
  // 지는 자리에 서면 아무리 해도 진다.
  assert.equal(randomKidWinRate(board(3, 3), 'horz', 'vert'), 0);
});

test('작은 판: 빈칸이 더 적고, 잘 두면 이기는 꼴이 같은 판. 원래 판에서 잘라 낸 판이 먼저다', () => {
  const kinds = new Set(SMALL_SHELF.map(([w, h, holes]) => solve(board(w, h, holes)).kind));
  assert.deepEqual([...kinds].sort(), ['first', 'horz', 'second', 'vert']);
  for (const b of [board(5, 5), board(4, 4), board(5, 4), board(4, 4, [0, 15]), board(5, 3, [3, 8, 13, 14]), board(3, 4)]) {
    const kind = solve(b).kind;
    const free = b.w * b.h - b.holes.length;
    const list = smallBoards(b);
    assert.ok(list.length > 0, JSON.stringify(b));
    for (const small of list) {
      assert.equal(checkBoard(small), null);
      assert.equal(solve(small).kind, kind, JSON.stringify(small));
      assert.ok(small.w * small.h - small.holes.length < free);
      assert.ok(placementsOf(small, 'vert').length >= 2 && placementsOf(small, 'horz').length >= 2);
    }
    assert.deepEqual(smallBoards(b), list, '같은 판에는 같은 목록');
  }
  // 잘라 낸 판은 원래 판의 구멍을 그대로 갖는다.
  assert.deepEqual(cropBoard(board(5, 3, [3, 8, 13, 14]), 1, 0, 4, 2), { w: 4, h: 2, holes: [2, 6] });
  // 가장 작은 판에는 작은 판이 없다.
  assert.deepEqual(smallBoards(board(2, 2)), []);
});

test('"왜 그럴까?"는 게임을 두 판 끝까지 둔 뒤에 열린다(임시). 연달아 진 판은 맨 뒤에서부터 센다', () => {
  const game = (winner, more = {}) => ({ kind: 'round', id: `r-${Math.random()}`, format: 'domino', outcome: 'solved', winner, ...more });
  assert.equal(WHY_AFTER, 2);
  assert.equal(whyOpen([]), false);
  assert.equal(whyOpen([game('kid')]), false);
  assert.equal(whyOpen([game('kid'), game('teacher')]), true);
  // 작은 판(곁판)과 그만둔 판, 다른 형식은 세지 않는다.
  assert.equal(whyOpen([game('kid'), game('kid', { side: true })]), false);
  assert.equal(whyOpen([game('kid'), game(null, { outcome: 'left' })]), false);
  assert.equal(whyOpen([game('kid'), game('kid', { format: 'dandelion' })]), false);
  assert.equal(lostStreak([game('teacher'), game('kid'), game('teacher'), game('teacher')]), 2);
  assert.equal(lostStreak([game('teacher'), game('kid')]), 0);
});
