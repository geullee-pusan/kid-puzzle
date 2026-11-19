// 주사위 미로와 길 세기의 규칙과 풀이 프로그램 점검.
// 칸 번호, 길의 수가 다른 방법(tests/helpers/brute-maze.js)과 같은지, 위 두 칸의 합, 모든 길 그리기, 길 그려 보기의 한 걸음,
// 주사위가 반반인지(1, 2, 3은 왼쪽, 4, 5, 6은 오른쪽), 손님을 많이 보내면 출구마다 길의 수에 맞게 가는지,
// 자물쇠와 칠하기의 짐작, 작은 판, "왜 그럴까?"가 열리는 때를 본다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  FINISH_GUESTS,
  LIMITS,
  askedCells,
  blockableCells,
  busiestExits,
  cellAt,
  cellCount,
  checkBoard,
  checkLock,
  checkPaint,
  childrenOf,
  countPaths,
  evenCells,
  exitCell,
  exitCounts,
  exitTally,
  lockCells,
  parentsOf,
  pathCell,
  pathsTo,
  replaySends,
  rollDie,
  rowCol,
  sendGuests,
  sideOf,
  smallBoards,
  solve,
  sortPaths,
  stepPath,
  topExits,
  walkGuest,
  whyOpen,
} from '../src/core/maze.js';
import { createRng } from '../src/core/rng.js';
import { bruteCounts, brutePaths, choose, chooseIsOdd } from './helpers/brute-maze.js';

const board = (kind, rows, blocked = [], more = {}) => ({ kind, rows, blocked, target: null, ask: kind === 'count' ? 'all' : null, ...more });
const stonesOf = (cells) => cells.map((cell) => [rowCol(cell).r, rowCol(cell).i]);

/** 막을 수 있는 칸에서 k개까지 고르는 모든 묶음 */
function blockSets(rows, most) {
  const cells = blockableCells(rows);
  const sets = [[]];
  const grow = (start, picked) => {
    if (picked.length === most) return;
    for (let at = start; at < cells.length; at++) {
      const next = [...picked, cells[at]];
      sets.push(next);
      grow(at + 1, next);
    }
  };
  grow(0, []);
  return sets;
}

test('칸 번호: 줄마다 왼쪽부터 센다. 위 칸과 아래 칸, 출구, 막을 수 있는 칸', () => {
  assert.equal(cellCount(4), 15);
  assert.deepEqual([cellAt(0, 0), cellAt(1, 0), cellAt(1, 1), cellAt(2, 0), cellAt(3, 1)], [0, 1, 2, 3, 7]);
  for (let cell = 0; cell < cellCount(LIMITS.maxRows); cell++) {
    const { r, i } = rowCol(cell);
    assert.equal(cellAt(r, i), cell);
    assert.ok(i >= 0 && i <= r);
  }
  assert.deepEqual(childrenOf(4, 4), [7, 8]);
  assert.deepEqual(childrenOf(4, exitCell(4, 2)), []);
  assert.deepEqual(parentsOf(4), [1, 2]);
  assert.deepEqual(parentsOf(3), [1]);
  assert.deepEqual(parentsOf(0), []);
  assert.deepEqual(blockableCells(3), [1, 2, 3, 4, 5]);
  assert.equal(exitCell(4, 0), 10);
});

test('판의 값: 정해진 줄 수와 막을 수 있는 칸만 받는다. 출구로 가는 길이 하나도 없는 판은 받지 않는다', () => {
  assert.equal(checkBoard(board('busy', 4)), null);
  assert.equal(checkBoard(board('busy', 1)), 'rows');
  assert.equal(checkBoard(board('busy', 9)), 'rows');
  assert.equal(checkBoard(board('busy', 4, [0])), 'blocked');
  assert.equal(checkBoard(board('busy', 4, [10])), 'blocked', '출구는 막을 수 없다');
  assert.equal(checkBoard(board('busy', 4, [4, 4])), 'blocked');
  assert.equal(checkBoard(board('busy', 3, [1, 2])), 'closed');
  assert.equal(checkBoard(board('even', 4, [4])), 'blocked');
  assert.equal(checkBoard(board('count', 4, [], { ask: 'target', target: 2 })), null);
  assert.equal(checkBoard(board('count', 4, [], { ask: 'target', target: 5 })), 'target');
  // 막혀서 길이 없는 출구는 표시하지 않는다.
  assert.equal(checkBoard(board('count', 3, [3], { ask: 'target', target: 0 })), 'target');
  assert.equal(checkBoard(board('count', 3, [1, 2], { ask: 'exits' })), 'closed');
  assert.equal(checkBoard(board('count', 3, [], { ask: 'nope' })), 'ask');
  assert.equal(checkBoard({ kind: 'dice', rows: 3, blocked: [], target: null, ask: null }), 'kind');
});

test('풀이 프로그램: 칸마다 오는 길의 수가 다른 방법(모든 길을 하나씩 걸어 보기)과 같다. 막힌 칸은 0이다', () => {
  let boards = 0;
  for (let rows = LIMITS.minRows; rows <= 6; rows++) {
    for (const blocked of blockSets(rows, rows <= 5 ? 2 : 1)) {
      const counts = countPaths(board('busy', rows, blocked));
      const brute = bruteCounts(rows, stonesOf(blocked));
      for (let cell = 0; cell < cellCount(rows); cell++) {
        const { r, i } = rowCol(cell);
        assert.equal(counts[cell], brute.get(`${r},${i}`), `${rows}줄 막힌 칸 ${blocked} 칸 ${cell}`);
      }
      boards += 1;
    }
  }
  // 7, 8줄은 몇 판만(시드 난수로 막을 칸을 고른다)
  const rng = createRng(7);
  for (const rows of [7, 8]) {
    for (let k = 0; k < 6; k++) {
      const cells = blockableCells(rows).filter(() => rng() < 0.15);
      const counts = countPaths(board('busy', rows, cells));
      const brute = bruteCounts(rows, stonesOf(cells));
      for (let cell = 0; cell < cellCount(rows); cell++) assert.equal(counts[cell], brute.get(`${rowCol(cell).r},${rowCol(cell).i}`));
      boards += 1;
    }
  }
  assert.ok(boards > 200, `${boards}판`);
});

test('막힌 칸이 없으면 길의 수는 파스칼 세모의 수이고, 칸마다 바로 위 두 칸의 합이다(막힌 칸은 0으로 센다)', () => {
  for (let rows = LIMITS.minRows; rows <= LIMITS.maxRows; rows++) {
    const counts = countPaths(board('busy', rows));
    for (let cell = 0; cell < cellCount(rows); cell++) {
      const { r, i } = rowCol(cell);
      assert.equal(counts[cell], choose(r, i));
    }
    assert.equal(exitCounts(board('busy', rows)).reduce((sum, value) => sum + value, 0), 2 ** rows, '출구로 가는 길은 모두 2를 줄 수만큼 곱한 수');
  }
  for (const blocked of blockSets(5, 2)) {
    const counts = countPaths(board('busy', 5, blocked));
    for (let cell = 1; cell < cellCount(5); cell++) {
      const sum = parentsOf(cell).reduce((total, parent) => total + counts[parent], 0);
      assert.equal(counts[cell], blocked.includes(cell) ? 0 : sum);
    }
  }
  assert.deepEqual(exitCounts(board('busy', 4)), [1, 4, 6, 4, 1]);
  assert.deepEqual(exitCounts(board('busy', 8)), [1, 8, 28, 56, 70, 56, 28, 8, 1]);
});

test('짝수 칸: 길의 수가 짝수인 칸은 루카스의 정리(이진수로 겹치는 자리)와 같다. 7줄의 출구는 모두 홀수다', () => {
  for (let rows = LIMITS.minRows; rows <= LIMITS.maxRows; rows++) {
    const evens = new Set(evenCells(board('even', rows)));
    for (let cell = 0; cell < cellCount(rows); cell++) {
      const { r, i } = rowCol(cell);
      assert.equal(evens.has(cell), !chooseIsOdd(r, i), `${rows}줄 칸 ${cell}`);
    }
  }
  assert.deepEqual([4, 5, 6, 7, 8].map((rows) => evenCells(board('even', rows)).length), [4, 6, 9, 9, 16]);
  const seven = new Set(evenCells(board('even', 7)));
  for (let k = 0; k <= 7; k++) assert.equal(seven.has(exitCell(7, k)), false);
  // 막힌 칸은 짝수 칸에 넣지 않는다(0이지만 칠할 칸이 아니다).
  assert.ok(!evenCells(board('count', 4, [4])).includes(4));
});

test('모든 길 그리기: 그 칸까지 가는 길이 빠짐없이, 겹치지 않게, 왼쪽이 먼저인 차례로 나온다(다른 방법과 같다)', () => {
  for (let rows = LIMITS.minRows; rows <= 5; rows++) {
    for (const blocked of blockSets(rows, 2)) {
      const b = board('count', rows, blocked);
      const counts = countPaths(b);
      for (let cell = 0; cell < cellCount(rows); cell++) {
        const { r, i } = rowCol(cell);
        const paths = pathsTo(b, cell);
        assert.equal(paths.length, counts[cell]);
        assert.equal(new Set(paths).size, paths.length);
        assert.deepEqual(paths, sortPaths(paths));
        assert.deepEqual(paths.slice().sort(), brutePaths(rows, stonesOf(blocked), r, i).sort());
        for (const path of paths) assert.equal(pathCell(b, path), cell);
      }
    }
  }
  assert.deepEqual(pathsTo(board('count', 4), exitCell(4, 2)), ['LLRR', 'LRLR', 'LRRL', 'RLLR', 'RLRL', 'RRLL']);
  assert.deepEqual(sortPaths(['RL', 'L', 'LR', 'R']), ['L', 'R', 'LR', 'RL']);
});

test('길 그려 보기의 한 걸음: 바로 아래 두 칸이면 길이 늘고, 길 위의 칸이면 거기까지로 줄고, 막힌 칸과 먼 칸은 받지 않는다', () => {
  const b = board('count', 4, [7]);
  assert.deepEqual(stepPath(b, '', 1), { ok: true, path: 'L', back: false, same: false });
  assert.deepEqual(stepPath(b, 'L', 4), { ok: true, path: 'LR', back: false, same: false });
  assert.equal(stepPath(b, 'LR', 7).why, 'blocked');
  assert.equal(stepPath(b, 'LR', 9).why, 'far');
  assert.equal(stepPath(b, 'LR', 5).why, 'far', '건너뛸 수 없다');
  assert.deepEqual(stepPath(b, 'LR', 1), { ok: true, path: 'L', back: true, same: false });
  assert.deepEqual(stepPath(b, 'LR', 4), { ok: true, path: 'LR', back: false, same: true });
  assert.deepEqual(stepPath(b, 'LR', 0), { ok: true, path: '', back: true, same: false });
  assert.equal(pathCell(b, 'LRL'), null, '막힌 칸을 지나는 길은 없다');
  assert.equal(pathCell(b, 'LLLLL'), null, '판 밖');
  assert.equal(pathCell(b, 'LX'), null);
});

test('주사위는 반반이다: 1~6이 고르게 나오고, 1, 2, 3은 왼쪽, 4, 5, 6은 오른쪽이다', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(sideOf), ['L', 'L', 'L', 'R', 'R', 'R']);
  const faces = [0, 0, 0, 0, 0, 0, 0];
  for (const seed of [1, 2, 3]) {
    const rng = createRng(seed);
    for (let k = 0; k < 60000; k++) faces[rollDie(rng)] += 1;
  }
  assert.equal(faces[0], 0);
  for (let face = 1; face <= 6; face++) assert.ok(Math.abs(faces[face] / 180000 - 1 / 6) < 0.005, `${face}: ${faces[face]}`);
  // 손님의 걸음마다 왼쪽과 오른쪽이 반반이고, 주사위 눈과 가는 쪽이 맞는다.
  const rng = createRng(99);
  let rights = 0;
  let steps = 0;
  for (let guest = 0; guest < 20000; guest++) {
    const walk = walkGuest(board('busy', 6), rng);
    walk.rolls.forEach((roll, at) => {
      const before = rowCol(walk.cells[at]);
      const after = rowCol(walk.cells[at + 1]);
      assert.equal(after.r, before.r + 1);
      assert.equal(after.i - before.i, sideOf(roll) === 'R' ? 1 : 0);
      rights += sideOf(roll) === 'R' ? 1 : 0;
      steps += 1;
    });
  }
  assert.ok(Math.abs(rights / steps - 0.5) < 0.01, `${rights}/${steps}`);
});

test('손님을 아주 많이 보내면 출구마다 (길의 수 ÷ 모든 길의 수)만큼 간다. 막힌 갈림길이 있어도 같고, 막힌 데서 멈춘 손님은 출구에 없다', () => {
  for (const b of [board('busy', 4), board('busy', 6), board('count', 4, [4, 8]), board('count', 5, [3])]) {
    const guests = 60000;
    const { ends } = sendGuests(b, guests, 2024);
    assert.equal(ends.reduce((sum, value) => sum + value, 0), guests);
    const counts = countPaths(b);
    const tally = exitTally(b, ends);
    tally.forEach((value, k) => {
      const expected = counts[exitCell(b.rows, k)] / 2 ** b.rows;
      assert.ok(Math.abs(value / guests - expected) < 0.012, `${b.rows}줄 막힌 칸 ${b.blocked} 출구 ${k}: ${value}`);
    });
    // 끝난 곳은 출구나 막힌 칸뿐이다.
    ends.forEach((value, cell) => {
      if (value > 0) assert.ok(rowCol(cell).r === b.rows || b.blocked.includes(cell), `칸 ${cell}`);
    });
  }
});

test('손님 보내기는 시드로 정해진다: 같은 시드는 같은 손님이고, 다시 보내 보면 적어 둔 것과 같다. 한 명이면 걸어간 길이 나온다', () => {
  const b = board('busy', 4);
  assert.deepEqual(sendGuests(b, 100, 5), sendGuests(b, 100, 5));
  assert.notDeepEqual(sendGuests(b, 100, 5).ends, sendGuests(b, 100, 6).ends);
  const sends = [{ n: 1, seed: 11 }, { n: 100, seed: 12 }, { n: 1, seed: 13 }];
  const ends = replaySends(b, sends);
  const each = sends.map((send) => sendGuests(b, send.n, send.seed).ends);
  assert.deepEqual(ends, each[0].map((_, cell) => each.reduce((sum, list) => sum + list[cell], 0)));
  const one = sendGuests(b, 1, 21);
  assert.equal(one.walks.length, 1);
  assert.equal(one.walks[0].rolls.length, 4);
  assert.equal(one.walks[0].cells.length, 5);
  assert.equal(one.ends[one.walks[0].end], 1);
  assert.equal(sendGuests(b, 100, 21).walks.length, 0);
  // 막힌 갈림길에 닿으면 거기서 멈춘다.
  const stopped = board('count', 3, [1]);
  let halted = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const walk = sendGuests(stopped, 1, seed).walks[0];
    if (walk.cells[1] === 1) {
      assert.equal(walk.exit, null);
      assert.equal(walk.end, 1);
      assert.equal(walk.rolls.length, 1);
      halted += 1;
    } else assert.equal(walk.exit !== null, true);
  }
  assert.ok(halted > 5);
  assert.equal(FINISH_GUESTS, 100);
});

test('가장 많이 간 출구: 하나일 때와 여럿일 때. 아무도 안 갔으면 없다', () => {
  assert.deepEqual(topExits([4, 27, 36, 26, 7]), { exits: [2], max: 36 });
  assert.deepEqual(topExits([1, 5, 5, 0]), { exits: [1, 2], max: 5 });
  assert.deepEqual(topExits([0, 0, 0]), { exits: [], max: 0 });
  assert.deepEqual(busiestExits(board('busy', 4)), [2]);
  assert.deepEqual(busiestExits(board('busy', 3)), [1, 2]);
});

test('자물쇠: 맞는 수에서만 열린다. 작으면 "빠뜨린 길", 크면 "두 번 센 길"을 짐작하고, 길이 없는 칸이면 판에서 확인하자고 한다', () => {
  const counts = countPaths(board('count', 4, [4]));
  assert.deepEqual(checkLock(counts, exitCell(4, 2), counts[exitCell(4, 2)]), { correct: true, guess: null });
  assert.deepEqual(checkLock(counts, exitCell(4, 2), 6), { correct: false, guess: 'too-many' });
  assert.deepEqual(checkLock(counts, exitCell(4, 2), 1), { correct: false, guess: 'too-few' });
  assert.equal(counts[exitCell(4, 2)], 2);
  const closed = countPaths(board('count', 3, [3, 4]));
  assert.equal(closed[exitCell(3, 1)], 0);
  assert.deepEqual(checkLock(closed, exitCell(3, 1), 0), { correct: true, guess: null });
  assert.deepEqual(checkLock(closed, exitCell(3, 1), 2), { correct: false, guess: 'none' });
});

test('칠하기: 짝수 칸과 꼭 같아야 맞다. 짝수가 아닌 칸을 칠했으면 그것을 먼저 말하고, 아니면 빠뜨린 칸을 말한다', () => {
  const b = board('even', 4);
  const evens = evenCells(b);
  assert.deepEqual(evens, [4, 11, 12, 13]);
  assert.deepEqual(checkPaint(b, evens).correct, true);
  assert.equal(checkPaint(b, [...evens, 0]).guess, 'odd');
  assert.equal(checkPaint(b, [0]).guess, 'odd');
  assert.equal(checkPaint(b, evens.slice(1)).guess, 'miss');
  assert.deepEqual(checkPaint(b, evens.slice(1)).miss, [4]);
  assert.equal(checkPaint(b, []).guess, 'miss');
});

test('열어야 할 칸과 자물쇠가 있는 칸: 맨 위는 처음부터 열려 있고, 막힌 칸에는 자물쇠가 없다', () => {
  const b = board('count', 4, [4], { ask: 'all' });
  assert.equal(askedCells(b).length, cellCount(4) - 2);
  assert.ok(!askedCells(b).includes(0) && !askedCells(b).includes(4));
  assert.deepEqual(askedCells(board('count', 4, [], { ask: 'target', target: 3 })), [exitCell(4, 3)]);
  assert.deepEqual(askedCells(board('count', 3, [], { ask: 'exits' })), [6, 7, 8, 9]);
  assert.deepEqual(askedCells(board('busy', 3)), []);
  assert.deepEqual(lockCells(b), askedCells(b));
  const solved = solve(board('count', 4, [], { ask: 'target', target: 1 }));
  assert.equal(solved.answer, 4);
  assert.equal(solved.total, 16);
  assert.deepEqual(solved.busiest, [2]);
});

test('작은 판: 같은 종류에서 줄을 줄인 판. 표시한 출구는 길이 둘 이상이고, 막힌 갈림길이 있던 판은 작은 판에서도 길의 수가 바뀐다', () => {
  assert.deepEqual(smallBoards(board('busy', 4)).map((small) => small.rows), [3, 2]);
  assert.deepEqual(smallBoards(board('busy', 2)), []);
  assert.deepEqual(smallBoards(board('even', 5)).map((small) => small.rows), [4, 3]);
  assert.deepEqual(smallBoards(board('even', 3)), []);
  const target = smallBoards(board('count', 5, [], { ask: 'target', target: 2 }));
  assert.deepEqual(target.map((small) => [small.rows, small.target]), [[4, 2], [3, 1], [2, 1]]);
  for (const small of target) assert.ok(solve(small).answer >= 2);
  for (const rows of [4, 5]) {
    for (const blocked of blockSets(rows, 2).filter((set) => set.length > 0)) {
      for (const ask of ['target', 'all']) {
        for (let k = 1; k < rows; k++) {
          const origin = board('count', rows, blocked, { ask, target: ask === 'target' ? k : null });
          if (checkBoard(origin) !== null) continue;
          for (const small of smallBoards(origin)) {
            assert.equal(checkBoard(small), null);
            assert.ok(small.rows < rows);
            assert.ok(small.blocked.length > 0 && small.blocked.every((cell) => blocked.includes(cell)));
            const plain = exitCounts({ ...small, blocked: [] });
            assert.ok(exitCounts(small).some((value, at) => value !== plain[at]), '막힌 갈림길이 길의 수를 바꾼다');
            if (ask === 'target') assert.ok(solve(small).answer >= 2);
          }
          if (ask === 'all') break;
        }
      }
    }
  }
});

test('"왜 그럴까?"는 실험 판과 세는 판(칠하는 판도 된다)을 한 번씩 끝까지 한 뒤에 열린다. 작은 판과 그만둔 판은 세지 않는다', () => {
  const record = (mode, more = {}) => ({ kind: 'round', format: 'maze', mode, outcome: 'solved', ...more });
  assert.equal(whyOpen([]), false);
  assert.equal(whyOpen([record('busy')]), false);
  assert.equal(whyOpen([record('count')]), false);
  assert.equal(whyOpen([record('busy'), record('count')]), true);
  assert.equal(whyOpen([record('busy'), record('even')]), true);
  assert.equal(whyOpen([record('busy'), record('count', { outcome: 'left' })]), false);
  assert.equal(whyOpen([record('busy', { side: true }), record('count')]), false);
  assert.equal(whyOpen([record('busy'), record('count', { format: 'coins' })]), false);
  assert.equal(whyOpen(null), false);
});
