// 도미노 가로세로의 사다리 점검: 단계마다 나오는 판이 그 단계의 조건에 맞는지, 판의 풀이가 다른 방법과 같은지 본다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, givenRole, nextSeed, rungOf } from '../src/core/domino-ladder.js';
import { firstSideOf, isSafeMove, movesOf, playable, randomKidWinRate, replay, safeOf, seatWins, solve, winningMoves } from '../src/core/domino.js';
import { bruteOutcome, memoWins } from './helpers/brute-domino.js';

const SEEDS = Array.from({ length: 40 }, (_, index) => index + 1);
const key = (board) => JSON.stringify(board);

/** 판의 빈칸이 몇 덩어리로 나뉘어 있는가 */
function pieces(board) {
  const free = new Set(Array.from({ length: board.w * board.h }, (_, cell) => cell).filter((cell) => !board.holes.includes(cell)));
  let count = 0;
  while (free.size > 0) {
    count += 1;
    const stack = [free.values().next().value];
    free.delete(stack[0]);
    while (stack.length > 0) {
      const cell = stack.pop();
      const x = cell % board.w;
      const y = Math.floor(cell / board.w);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        const next = ny * board.w + nx;
        if (nx >= 0 && ny >= 0 && nx < board.w && ny < board.h && free.has(next)) {
          free.delete(next);
          stack.push(next);
        }
      }
    }
  }
  return count;
}

/** 대각선으로 뒤집은 판 */
function transpose(b) {
  return { w: b.h, h: b.w, holes: b.holes.map((cell) => (cell % b.w) * b.h + Math.floor(cell / b.w)).sort((x, y) => x - y) };
}

test('사다리: 여섯 단계이고 맨 위는 직접 만들기다. 세로 → 나만 놓을 수 있는 자리 → 고르기 → 방이 나뉜 판 → 큰 판 → 직접 만들기', () => {
  assert.deepEqual(LADDER.map((rung) => rung.level), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(LADDER.map((rung) => rung.tag), ['basic', 'basic', 'applied', 'applied', 'challenge', 'challenge']);
  assert.deepEqual(LADDER.map((rung) => rung.hint), ['vert', 'safe', 'choose', 'rooms', 'choose', 'choose']);
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  assert.equal(rungOf(MAKE_LEVEL).mode, 'make');
  assert.throws(() => generateBoard(MAKE_LEVEL, 1));
  assert.throws(() => rungOf(9));
});

test('같은 (단계, 판 번호)는 늘 같은 판이다. 판마다 풀이가 붙어 있고, 두 쪽 모두 처음에 놓을 곳이 있다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of SEEDS) {
      const made = generateBoard(level, seed);
      assert.deepEqual(generateBoard(level, seed), made);
      assert.equal(playable(made.board), true, `${level}단계 ${seed}번`);
      const { vert, horz, kind } = solve(made.board);
      assert.deepEqual([made.solution.vert, made.solution.horz, made.solution.kind], [vert, horz, kind]);
    }
  }
});

test('사다리의 모든 판의 승패는 다른 방법(글자 판)으로 다시 구한 것과 같다', () => {
  const seen = new Map();
  for (let level = 1; level <= TOP_LEVEL; level++) for (const entry of [...rungOf(level).boards, rungOf(level).small, rungOf(level).first].filter(Boolean)) seen.set(key({ w: entry[0], h: entry[1], holes: entry[2] }), { w: entry[0], h: entry[1], holes: entry[2] });
  for (const board of seen.values()) {
    const { vert, horz } = solve(board);
    assert.deepEqual({ vert, horz }, bruteOutcome(board, memoWins), key(board));
  }
  assert.ok(seen.size >= 40);
});

test('형식의 맨 첫 판은 실패할 수 없다: 2×3이고 아이가 세로로 먼저 둔다. 어디에 놓아도 세로가 이긴다', () => {
  const made = generateBoard(1, 1);
  assert.deepEqual(made.board, { w: 2, h: 3, holes: [] });
  assert.equal(made.role, 'vert');
  assert.equal(made.order, 'first');
  assert.equal(randomKidWinRate(made.board, 'vert', 'vert'), 1);
});

test('1단계(아이가 세로, 먼저): 세로가 먼저 두면 세로가 이기는 판만 나오고, 맨 첫 판 말고는 지는 첫 수가 있다', () => {
  for (const seed of SEEDS) {
    const { board, role, order, solution } = generateBoard(1, seed);
    assert.equal(role, 'vert');
    assert.equal(order, 'first');
    assert.equal(solution.vert, 'vert');
    if (seed === 1) continue;
    const all = movesOf(board, [], 'vert').length;
    const good = winningMoves(board, [], 'vert').length;
    const rate = randomKidWinRate(board, 'vert', 'vert');
    // 3×4만 모든 첫 수가 이기는 수지만, 그 뒤에 지는 수가 있다.
    assert.ok(good < all || rate < 1, `${seed}번 ${key(board)}`);
    assert.ok(rate > 0.1 && rate < 0.75, `${seed}번 ${rate}`);
  }
});

test('2단계(나만 놓을 수 있는 자리): 아이가 먼저 두면 이기고, 아이만 놓을 수 있는 자리에 첫 도미노를 놓으면 진다', () => {
  const rung = rungOf(2);
  assert.ok(rung.boards.length >= 6);
  rung.boards.forEach((entry, index) => {
    const board = { w: entry[0], h: entry[1], holes: entry[2] };
    const role = entry[3];
    assert.equal(role, index % 2 === 0 ? 'vert' : 'horz', '세로와 가로가 번갈아');
    // 가로 판은 바로 앞의 세로 판을 대각선으로 뒤집은 판이다.
    if (role === 'horz') {
      const before = rung.boards[index - 1];
      assert.deepEqual(board, transpose({ w: before[0], h: before[1], holes: before[2] }));
    }
    const solution = solve(board);
    assert.equal(seatWins(solution, role, 'first'), true, key(board));
    const now = replay(board, [], role);
    const spots = safeOf(board, [], role)[role];
    assert.ok(spots.length >= 1, `${key(board)}: 아이만 놓을 자리`);
    const winning = winningMoves(board, [], role);
    assert.ok(winning.length >= 1);
    for (const move of winning) assert.equal(isSafeMove(board, now.filled, role, move.cells), false, `${key(board)}: 이기는 첫 수가 아이만의 자리`);
    for (const move of movesOf(board, [], role)) {
      if (isSafeMove(board, now.filled, role, move.cells)) assert.ok(!winning.some((item) => item.cells.join() === move.cells.join()));
    }
    assert.ok(winning.length < movesOf(board, [], role).length);
  });
  // 판 번호로 낸 판에는 판의 쪽이 붙어 나온다.
  for (const seed of SEEDS) {
    const made = generateBoard(2, seed);
    assert.equal(made.role, givenRole(2, made.board));
    assert.ok(['vert', 'horz'].includes(made.role));
    assert.equal(made.order, 'first');
  }
});

test('3~5단계(고르기): 쪽과 차례를 고른다. 먼저, 나중, 늘 세로, 늘 가로가 이기는 판이 섞이고 처음 여섯 판 안에 셋 이상이 나온다', () => {
  for (const level of [3, 4, 5]) {
    const kinds = new Set();
    const early = new Set();
    for (const seed of SEEDS) {
      const made = generateBoard(level, seed);
      assert.equal(made.role, null);
      assert.equal(made.order, null);
      kinds.add(made.solution.kind);
      if (seed <= 6) early.add(made.solution.kind);
    }
    assert.ok(kinds.size >= 3, `${level}단계: ${[...kinds]}`);
    assert.ok(early.size >= 3, `${level}단계 처음 여섯 판: ${[...early]}`);
  }
  // 3단계에는 나중에 두는 쪽이 이기는 구멍 난 4×4가 있고, 5단계에는 5×5가 있다.
  assert.ok(rungOf(3).boards.some(([w, h, holes]) => w === 4 && h === 4 && holes.length === 2 && solve({ w, h, holes }).kind === 'second'));
  assert.ok(rungOf(5).boards.some(([w, h, holes]) => w === 5 && h === 5 && holes.length === 0));
});

test('4단계(방이 나뉜 판): 판이 구멍으로 세 덩어리 이상으로 나뉘어 있다. 3단계 판은 한 덩어리다', () => {
  for (const [w, h, holes] of [...rungOf(4).boards, rungOf(4).small]) assert.ok(pieces({ w, h, holes }) >= 3, key({ w, h, holes }));
  for (const [w, h, holes] of rungOf(3).boards) assert.equal(pieces({ w, h, holes }), 1);
});

test('차례에서 이웃한 두 판은 늘 다르다(맨 끝과 맨 처음도). "새 판"은 방금 한 판과 다르다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    const list = rungOf(level).boards;
    list.forEach((entry, index) => assert.notDeepEqual(entry, list[(index + 1) % list.length], `${level}단계 ${index}`));
    for (const seed of SEEDS.slice(0, 12)) {
      const next = nextSeed(level, seed);
      assert.notDeepEqual(generateBoard(level, next).board, generateBoard(level, seed).board);
    }
  }
});

test('작은 판부터: 단계마다 작은 판이 정해져 있고, 그 단계의 조건에 맞는다', () => {
  const one = generateBoard(1, 5, { small: true });
  assert.deepEqual(one.board, { w: 3, h: 2, holes: [] });
  assert.equal(seatWins(one.solution, 'vert', 'first'), true);
  const two = generateBoard(2, 5, { small: true });
  assert.equal(two.role, 'vert');
  assert.equal(seatWins(two.solution, 'vert', 'first'), true);
  for (const level of [3, 4, 5]) assert.equal(generateBoard(level, 1, { small: true }).role, null);
});

test('만들어 낸 판을 실제로 두어 본다: 이기는 자리에서 이기는 수만 두면 이긴다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of [1, 2, 3, 4, 5]) {
      const { board, solution } = generateBoard(level, seed);
      for (const role of ['vert', 'horz']) {
        for (const order of ['first', 'second']) {
          if (!seatWins(solution, role, order)) continue;
          const first = firstSideOf(role, order);
          const trail = [];
          for (;;) {
            const now = replay(board, trail, first);
            if (now.over) {
              assert.equal(now.winner, role, `${level}단계 ${seed}번`);
              break;
            }
            const list = now.next === role ? winningMoves(board, trail, first) : movesOf(board, trail, first);
            trail.push(list[trail.length % list.length]);
          }
        }
      }
    }
  }
});
