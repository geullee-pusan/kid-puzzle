// 누가 이길까의 규칙과 풀이 프로그램.
// 풀이 프로그램은 끝에서부터 따진다. 여기서는 그 결과를 지름길 규칙과 견주고,
// 규칙을 따로 적은 다른 탐색(tests/helpers/brute-duel.js)으로 다시 구해 견준다.
// 지름길 규칙을 믿는 것이 아니라, 끝에서부터 따진 결과와 일치하는지를 확인하는 것이다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  GAMES,
  LIMITS,
  NO_WHY,
  SMALL_COUNT,
  WHY_AFTER,
  allPositions,
  applyMove,
  boardKey,
  checkBoard,
  copyBoard,
  finishedCount,
  gameOf,
  isOver,
  isWin,
  lostStreak,
  moveKey,
  movesOf,
  otherOf,
  pickMove,
  randomKidWinRate,
  replay,
  slipsOf,
  smallBoards,
  solve,
  startState,
  takesOf,
  teacherMove,
  turnOf,
  whyOpen,
  winnerOf,
  winningMoves,
} from '../src/core/duel.js';
import { createRng, randInt } from '../src/core/rng.js';
import { allPlays, bruteLengths, bruteWin, fromBoard, fromState } from './helpers/brute-duel.js';

const choco = (w, h) => ({ kind: 'choco', w, h });
const one = (n, max) => ({ kind: 'one', n, max });
const piles = (...counts) => ({ kind: 'piles', piles: counts });
const divisor = (n) => ({ kind: 'divisor', n });
const half = (n) => ({ kind: 'half', n });
const both = (a, b) => ({ kind: 'both', piles: [a, b] });
const brute = (board, state = startState(board)) => {
  const { kind, max } = fromBoard(board);
  return bruteWin(kind, max, fromState(board, state));
};

/** 한 판을 끝까지 둔다. 아이는 kid(자리, 둘 수 있는 수들)로 두고, 선생님은 앱에서 두는 대로 둔다. */
function playOut(board, first, kid, { level = 3, seed = 1 } = {}) {
  const trail = [];
  let state = startState(board);
  while (!isOver(board, state)) {
    const who = turnOf(first, trail.length);
    const move = who === 'kid' ? kid(state, movesOf(board, state)) : teacherMove(board, trail, { level, seed, first });
    state = applyMove(board, state, move);
    assert.notEqual(state, null, '둘 수 없는 수를 두었어요');
    trail.push(move);
  }
  return { trail, winner: winnerOf(first, trail.length) };
}

test('판의 값: 정해진 범위 안의 판만 받는다', () => {
  assert.equal(checkBoard(choco(1, 1)), null);
  assert.equal(checkBoard(choco(5, 5)), null);
  assert.equal(checkBoard(choco(6, 2)), 'size');
  assert.equal(checkBoard(choco(0, 2)), 'size');
  assert.equal(checkBoard(one(1, 1)), null);
  assert.equal(checkBoard(one(25, 4)), null);
  assert.equal(checkBoard(one(26, 2)), 'count');
  assert.equal(checkBoard(one(7, 5)), 'count');
  assert.equal(checkBoard(piles(1, 1)), null);
  assert.equal(checkBoard(piles(9, 9, 9)), null);
  assert.equal(checkBoard(piles(4)), 'piles');
  assert.equal(checkBoard(piles(1, 2, 3, 4)), 'piles');
  assert.equal(checkBoard(piles(0, 3)), 'count');
  assert.equal(checkBoard(piles(10, 3)), 'count');
  assert.equal(checkBoard({ kind: 'chess' }), 'kind');
  assert.equal(checkBoard(null), 'board');
  assert.deepEqual(LIMITS, { choco: { min: 1, max: 5 }, one: { min: 1, max: 25 }, take: { min: 1, max: 4 }, piles: { min: 2, max: 3 }, pile: { min: 1, max: 9 } });
  assert.deepEqual(GAMES, ['choco', 'one', 'two', 'three', 'divisor', 'half', 'both']);
  assert.deepEqual([choco(2, 3), one(7, 2), piles(3, 3), piles(1, 2, 3), divisor(12), half(10), both(3, 5)].map(gameOf), GAMES);
  const board = piles(3, 4);
  const copy = copyBoard(board);
  copy.piles[0] = 9;
  assert.deepEqual(board.piles, [3, 4]);
  // 5~7단계의 판: 돌 1~25개(약수 빼기, 절반까지), 더미 둘에 더미마다 1~9개(두 더미에서 같은 수도)
  for (const kind of ['divisor', 'half']) {
    assert.equal(checkBoard({ kind, n: 1 }), null);
    assert.equal(checkBoard({ kind, n: 25 }), null);
    assert.equal(checkBoard({ kind, n: 26 }), 'count');
    assert.equal(checkBoard({ kind, n: 0 }), 'count');
    assert.equal(checkBoard({ kind, n: 2.5 }), 'count');
    assert.deepEqual(copyBoard({ kind, n: 9, extra: 1 }), { kind, n: 9 });
  }
  assert.equal(checkBoard(both(1, 9)), null);
  assert.equal(checkBoard(both(0, 3)), 'count');
  assert.equal(checkBoard(both(10, 3)), 'count');
  assert.equal(checkBoard({ kind: 'both', piles: [1, 2, 3] }), 'piles');
  const pair = both(3, 4);
  const pairCopy = copyBoard(pair);
  pairCopy.piles[0] = 9;
  assert.deepEqual(pair.piles, [3, 4]);
  assert.deepEqual(pairCopy, { kind: 'both', piles: [9, 4] });
  assert.deepEqual([boardKey(divisor(12)), boardKey(half(10)), boardKey(both(3, 5))], ['divisor-12', 'half-10', 'both-3-5']);
});

test('약수 빼기: 남은 돌의 수의 약수 가운데 그 수보다 작은 것만큼 가져간다. 1개가 남으면 끝이다', () => {
  assert.deepEqual(movesOf(divisor(12), [12]).map((move) => move.take), [1, 2, 3, 4, 6]);
  assert.deepEqual(takesOf(divisor(12), 15), [1, 3, 5]);
  assert.deepEqual(takesOf(divisor(12), 13), [1]);
  assert.deepEqual(takesOf(divisor(12), 1), []);
  assert.deepEqual(applyMove(divisor(12), [12], { pile: 0, take: 4 }), [8]);
  for (const take of [5, 12, 0, 13, 1.5]) assert.equal(applyMove(divisor(12), [12], { pile: 0, take }), null, `${take}개`);
  assert.equal(applyMove(divisor(12), [12], { pile: 'both', take: 1 }), null);
  assert.equal(isOver(divisor(12), [1]), true);
  assert.equal(isOver(divisor(12), [2]), false);
  // 어떻게 두어도 돌은 0개가 되지 않는다(가져가고 남는 수는 늘 1개 이상이다).
  for (let count = 2; count <= LIMITS.one.max; count++) for (const move of movesOf(divisor(25), [count])) assert.ok(applyMove(divisor(25), [count], move)[0] >= 1);
});

test('절반까지: 1개부터 남은 돌의 절반(버림)까지 가져간다. 1개가 남으면 끝이다', () => {
  assert.deepEqual(movesOf(half(10), [10]).map((move) => move.take), [1, 2, 3, 4, 5]);
  assert.deepEqual(takesOf(half(10), 7), [1, 2, 3]);
  assert.deepEqual(takesOf(half(10), 2), [1]);
  assert.deepEqual(takesOf(half(10), 1), []);
  assert.deepEqual(applyMove(half(10), [7], { pile: 0, take: 3 }), [4]);
  assert.equal(applyMove(half(10), [7], { pile: 0, take: 4 }), null);
  assert.equal(isOver(half(10), [1]), true);
  assert.equal(isOver(half(10), [2]), false);
});

test('두 더미에서 같은 수도: 한 더미에서 원하는 만큼, 또는 두 더미에서 같은 수만큼 가져간다', () => {
  const board = both(3, 5);
  const moves = movesOf(board, [3, 5]);
  // 첫째 더미 3가지, 둘째 더미 5가지, 두 더미에서 같은 수만큼 3가지
  assert.equal(moves.length, 11);
  assert.deepEqual(moves.filter((move) => move.pile === 'both').map((move) => move.take), [1, 2, 3]);
  assert.deepEqual(applyMove(board, [3, 5], { pile: 'both', take: 3 }), [0, 2]);
  assert.equal(applyMove(board, [3, 5], { pile: 'both', take: 4 }), null);
  assert.equal(applyMove(board, [3, 5], { pile: 'both', take: 0 }), null);
  assert.deepEqual(applyMove(board, [3, 5], { pile: 1, take: 5 }), [3, 0]);
  // 한 더미가 비면 같은 수만큼 가져가는 수는 없다.
  assert.deepEqual(movesOf(board, [0, 2]), [{ pile: 1, take: 1 }, { pile: 1, take: 2 }]);
  assert.equal(isOver(board, [0, 0]), true);
  // 두 더미에서 같은 수만큼 가져가는 수는 이 게임에만 있다.
  assert.equal(applyMove(piles(3, 5), [3, 5], { pile: 'both', take: 1 }), null);
  assert.equal(moveKey({ pile: 'both', take: 2 }), 'both-2');
});

test('약수 빼기의 지름길 규칙: 홀수 개일 때 차례가 오면 진다. 끝에서부터 따진 결과와 다른 탐색이 같다', () => {
  for (let n = 1; n <= LIMITS.one.max; n++) {
    const board = divisor(n);
    assert.equal(isWin(board, [n]), n % 2 === 0, `${n}개`);
    assert.equal(brute(board), n % 2 === 0, `${n}개(다른 탐색)`);
  }
  for (let count = 1; count <= LIMITS.one.max; count++) {
    const takes = takesOf(divisor(25), count);
    // 홀수에서 가져갈 수 있는 수는 모두 홀수라서, 가져가면 늘 짝수가 남는다.
    if (count % 2 === 1) for (const take of takes) assert.equal((count - take) % 2, 0, `${count}개에서 ${take}개`);
    // 짝수에서는 1개를 가져가면 홀수가 남는다. 이기는 수는 홀수만큼 가져가는 수 모두다.
    else {
      assert.ok(takes.includes(1), `${count}개`);
      assert.deepEqual(winningMoves(divisor(25), [count]).map((move) => move.take), takes.filter((take) => take % 2 === 1), `${count}개`);
    }
  }
  // 25개짜리 판에서 나올 수 있는 자리는 1~25개 모두다.
  assert.equal(allPositions(divisor(25)).size, 25);
});

test('절반까지의 지름길 규칙: 돌의 수에 1을 더하면 2, 4, 8, 16, 32가 될 때(1, 3, 7, 15개) 차례가 오면 진다. 다른 탐색과 같다', () => {
  const losing = [];
  for (let n = 1; n <= LIMITS.one.max; n++) {
    const board = half(n);
    assert.equal(isWin(board, [n]), brute(board), `${n}개(다른 탐색)`);
    if (!isWin(board, [n])) losing.push(n);
  }
  assert.deepEqual(losing, [1, 3, 7, 15]);
  // 지는 수는 앞의 수의 두 배보다 하나 많다. 그 사이의 수에서는 이기는 수가 꼭 하나다(지는 수로 보내기).
  losing.slice(1).forEach((n, index) => assert.equal(n, 2 * losing[index] + 1));
  for (let n = 2; n <= LIMITS.one.max; n++) {
    if (losing.includes(n)) continue;
    const moves = winningMoves(half(n), [n]);
    assert.equal(moves.length, 1, `${n}개`);
    assert.ok(losing.includes(n - moves[0].take), `${n}개`);
  }
});

test('두 더미에서 같은 수도의 지는 자리: 1개와 2개, 3개와 5개, 4개와 7개, 6개와 10개(차례를 바꾼 것도). 다른 탐색과 같다', () => {
  const found = [];
  for (let a = 0; a <= 12; a++) {
    for (let b = 0; b <= 12; b++) {
      const board = both(Math.max(a, 1), Math.max(b, 1));
      const win = isWin(board, [a, b]);
      assert.equal(win, brute(board, [a, b]), `${a}개와 ${b}개`);
      if (!win && a <= b) found.push([a, b]);
    }
  }
  assert.deepEqual(found, [[0, 0], [1, 2], [3, 5], [4, 7], [6, 10]]);
  // 다른 방법으로 다시 만든다: 작은 더미는 앞에서 쓰지 않은 가장 작은 수, 큰 더미는 그보다 (몇째 짝인지)만큼 크다.
  const used = new Set();
  const built = [];
  for (let index = 0; built.length < found.length; index++) {
    let low = 0;
    while (used.has(low)) low += 1;
    built.push([low, low + index]);
    used.add(low).add(low + index);
  }
  assert.deepEqual(built, found);
  // 더미마다 1~9개인 판 81가지 가운데 지는 판은 여섯 가지다.
  let second = 0;
  for (let a = 1; a <= LIMITS.pile.max; a++) for (let b = 1; b <= LIMITS.pile.max; b++) if (!solve(both(a, b)).first) second += 1;
  assert.equal(second, 6);
});

test('초콜릿: 조각 하나를 금을 따라 곧게 둘로 쪼갠다', () => {
  const board = choco(3, 2);
  const start = startState(board);
  assert.deepEqual(start, [{ x: 0, y: 0, w: 3, h: 2 }]);
  // 세로 금 둘, 가로 금 하나
  assert.deepEqual(movesOf(board, start), [{ piece: 0, dir: 'v', at: 1 }, { piece: 0, dir: 'v', at: 2 }, { piece: 0, dir: 'h', at: 1 }]);
  const cut = applyMove(board, start, { piece: 0, dir: 'v', at: 1 });
  assert.deepEqual(cut, [{ x: 0, y: 0, w: 1, h: 2 }, { x: 1, y: 0, w: 2, h: 2 }]);
  // 쪼갠 두 조각은 원래 조각의 자리에 차례로 들어간다.
  const again = applyMove(board, cut, { piece: 1, dir: 'h', at: 1 });
  assert.deepEqual(again, [{ x: 0, y: 0, w: 1, h: 2 }, { x: 1, y: 0, w: 2, h: 1 }, { x: 1, y: 1, w: 2, h: 1 }]);
  // 처음 자리는 그대로다.
  assert.equal(start.length, 1);
  // 없는 조각, 없는 금, 조각의 가장자리는 쪼갤 수 없다.
  for (const move of [{ piece: 2, dir: 'v', at: 1 }, { piece: 0, dir: 'v', at: 3 }, { piece: 0, dir: 'h', at: 2 }, { piece: 0, dir: 'v', at: 0 }, { piece: 0, dir: 'x', at: 1 }, { piece: 0, dir: 'v', at: 1.5 }, null]) {
    assert.equal(applyMove(board, start, move), null, JSON.stringify(move));
  }
  // 쪼개도 칸은 없어지지 않는다. 조각들이 겹치지 않고 판을 꼭 덮는다.
  const rng = createRng(7);
  for (const [w, h] of [[2, 2], [3, 2], [4, 3], [5, 5]]) {
    let state = startState(choco(w, h));
    while (!isOver(choco(w, h), state)) {
      const moves = movesOf(choco(w, h), state);
      state = applyMove(choco(w, h), state, moves[randInt(rng, 0, moves.length - 1)]);
      const seen = new Set();
      for (const piece of state) for (let x = piece.x; x < piece.x + piece.w; x++) for (let y = piece.y; y < piece.y + piece.h; y++) seen.add(`${x},${y}`);
      assert.equal(seen.size, w * h);
      assert.equal(state.reduce((sum, piece) => sum + piece.w * piece.h, 0), w * h);
    }
    // 더 쪼갤 조각이 없으면 끝이다: 모두 한 칸짜리다.
    assert.ok(state.every((piece) => piece.w === 1 && piece.h === 1));
    assert.equal(state.length, w * h);
  }
});

test('돌: 한 더미는 1개부터 정해진 수까지, 여러 더미는 한 더미에서만 원하는 만큼 가져간다', () => {
  assert.deepEqual(movesOf(one(7, 3), [7]), [{ pile: 0, take: 1 }, { pile: 0, take: 2 }, { pile: 0, take: 3 }]);
  assert.deepEqual(movesOf(one(7, 3), [2]), [{ pile: 0, take: 1 }, { pile: 0, take: 2 }]);
  assert.deepEqual(applyMove(one(7, 3), [7], { pile: 0, take: 3 }), [4]);
  assert.equal(applyMove(one(7, 3), [7], { pile: 0, take: 4 }), null, '한 번에 가져갈 수 있는 수를 넘었다');
  assert.equal(applyMove(one(7, 3), [2], { pile: 0, take: 3 }), null, '남은 돌보다 많다');
  assert.equal(applyMove(one(7, 3), [7], { pile: 0, take: 0 }), null);
  assert.equal(applyMove(one(7, 3), [7], { pile: 1, take: 1 }), null);
  assert.equal(movesOf(piles(3, 5), [3, 5]).length, 8);
  assert.deepEqual(applyMove(piles(3, 5), [3, 5], { pile: 1, take: 5 }), [3, 0]);
  assert.equal(applyMove(piles(3, 5), [3, 5], { pile: 0, take: 4 }), null);
  assert.deepEqual(movesOf(piles(3, 5), [0, 0]), []);
  assert.equal(isOver(piles(3, 5), [0, 0]), true);
  assert.equal(isOver(one(4, 2), [0]), true);
  assert.equal(isOver(one(4, 2), [1]), false);
});

test('초콜릿: 작은 판에서 모든 차례를 따져 보면, 어떻게 쪼개도 (칸의 수 − 1)번에 끝난다', () => {
  // 적어 두지 않고 하나하나 센다(차례의 가짓수가 적은 판)
  // 3×2는 세로 금 둘(16가지씩)과 가로 금 하나(24가지)로 시작해서 56가지다.
  // 3×3은 금 넷 가운데 하나로 시작해서(3×1과 3×2가 남는다) 2352가지씩, 모두 9408가지다.
  const counted = { '1x1': 1, '2x1': 1, '3x1': 2, '2x2': 4, '3x2': 56, '4x2': 1712, '3x3': 9408 };
  for (const [name, plays] of Object.entries(counted)) {
    const [w, h] = name.split('x').map(Number);
    const all = allPlays('choco', Infinity, [[w, h]]);
    assert.equal(all.plays, plays, `${name}의 차례의 가짓수`);
    assert.equal(all.shortest, w * h - 1, name);
    assert.equal(all.longest, w * h - 1, name);
  }
  // 큰 판은 같은 자리를 적어 두고 따진다. 5×5까지 모든 판에서 끝나는 횟수는 한 가지뿐이다.
  for (let w = 1; w <= 5; w++) {
    for (let h = 1; h <= 5; h++) {
      assert.deepEqual([...bruteLengths('choco', Infinity, [[w, h]])], [w * h - 1], `${w}×${h}`);
    }
  }
});

test('초콜릿의 지름길 규칙: 칸의 수가 짝수면(쪼개는 횟수가 홀수면) 먼저 두는 쪽이 이긴다. 끝에서부터 따진 결과와 같다', () => {
  let positions = 0;
  for (let w = 1; w <= 5; w++) {
    for (let h = 1; h <= 5; h++) {
      const board = choco(w, h);
      const result = solve(board);
      assert.equal(result.first, (w * h - 1) % 2 === 1, `${w}×${h}`);
      assert.equal(result.winner, result.first ? 'first' : 'second');
      // 판에서 나올 수 있는 모든 자리: 남은 횟수(조각마다 칸의 수 − 1을 더한 것)가 홀수인 자리가 이기는 자리다.
      for (const [key, win] of allPositions(board)) {
        const left = key === '' ? 0 : key.split(',').reduce((sum, code) => sum + Math.floor(Number(code) / 10) * (Number(code) % 10) - 1, 0);
        assert.equal(win, left % 2 === 1, `${w}×${h}의 자리 ${key}`);
        positions += 1;
      }
      // 이기는 자리에서는 어느 수나 이기는 수이고, 지는 자리에서는 이기는 수가 없다(가짜 게임).
      const start = startState(board);
      assert.equal(winningMoves(board, start).length, result.first ? movesOf(board, start).length : 0, `${w}×${h}`);
    }
  }
  assert.ok(positions > 2500, `따져 본 자리 ${positions}개`);
  assert.equal(solve(choco(5, 5)).positions, allPositions(choco(5, 5)).size);
  // 1×1은 처음부터 둘 수가 없다. 먼저 두는 쪽이 진다.
  assert.equal(solve(choco(1, 1)).first, false);
  assert.deepEqual(movesOf(choco(1, 1), startState(choco(1, 1))), []);
});

test('초콜릿: 실제 자리 그대로 따진 다른 탐색과 승패가 같다(4×3까지)', () => {
  for (let w = 1; w <= 4; w++) {
    for (let h = 1; h <= 3; h++) assert.equal(isWin(choco(w, h), startState(choco(w, h))), brute(choco(w, h)), `${w}×${h}`);
  }
  // 두다 만 자리에서도 같다.
  const rng = createRng(11);
  for (let trial = 0; trial < 60; trial++) {
    const board = choco(randInt(rng, 2, 4), randInt(rng, 2, 3));
    let state = startState(board);
    for (let step = randInt(rng, 0, 4); step > 0 && !isOver(board, state); step--) {
      const moves = movesOf(board, state);
      state = applyMove(board, state, moves[randInt(rng, 0, moves.length - 1)]);
    }
    assert.equal(isWin(board, state), brute(board, state), JSON.stringify(state));
  }
});

test('한 더미의 지름길 규칙: 돌의 수를 (한 번에 가져갈 수 있는 수 + 1)로 나눈 나머지가 0이면 둘 차례인 쪽이 진다', () => {
  let checked = 0;
  for (let max = LIMITS.take.min; max <= LIMITS.take.max; max++) {
    for (let n = LIMITS.one.min; n <= LIMITS.one.max; n++) {
      const board = one(n, max);
      const result = solve(board);
      assert.equal(result.first, n % (max + 1) !== 0, `돌 ${n}개, 한 번에 ${max}개까지`);
      assert.equal(result.first, brute(board), `돌 ${n}개, 한 번에 ${max}개까지(다른 탐색)`);
      // 모든 자리: 돌이 0개부터 n개까지
      const all = allPositions(board);
      assert.equal(all.size, n + 1);
      for (const [key, win] of all) assert.equal(win, (key === '' ? 0 : Number(key)) % (max + 1) !== 0);
      // 이기는 수는 꼭 하나다: 나머지만큼 가져간다.
      assert.deepEqual(result.moves, result.first ? [{ pile: 0, take: n % (max + 1) }] : []);
      checked += 1;
    }
  }
  assert.equal(checked, 100);
});

test('두 더미의 지름길 규칙: 두 수가 같으면 둘 차례인 쪽이 진다', () => {
  for (let a = 0; a <= LIMITS.pile.max; a++) {
    for (let b = 0; b <= LIMITS.pile.max; b++) {
      const board = piles(Math.max(a, 1), Math.max(b, 1));
      assert.equal(isWin(board, [a, b]), a !== b, `${a}개와 ${b}개`);
      assert.equal(isWin(board, [a, b]), bruteWin('stones', Infinity, [a, b]), `${a}개와 ${b}개(다른 탐색)`);
    }
  }
  for (let a = 1; a <= LIMITS.pile.max; a++) {
    for (let b = 1; b <= LIMITS.pile.max; b++) {
      const result = solve(piles(a, b));
      assert.equal(result.first, a !== b);
      // 다른 두 더미에서 이기는 수는 하나뿐이다: 많은 더미에서 가져가서 같게 만든다.
      if (a !== b) assert.deepEqual(result.moves, [{ pile: a > b ? 0 : 1, take: Math.abs(a - b) }]);
      else assert.deepEqual(result.moves, []);
    }
  }
  // 9개와 9개에서 나올 수 있는 자리는 55가지다(더미의 차례는 가리지 않는다).
  assert.equal(solve(piles(9, 9)).positions, 55);
});

test('세 더미의 지름길 규칙: 세 수를 이진법으로 적어 자리마다 1의 수가 모두 짝수이면 둘 차례인 쪽이 진다', () => {
  /** 이진법으로 적었을 때 자리마다 1의 수가 모두 짝수인가(비트 연산을 쓰지 않고 자리마다 센다) */
  const allEven = (counts) => {
    const digits = counts.map((count) => count.toString(2).padStart(4, '0'));
    return [0, 1, 2, 3].every((place) => digits.filter((text) => text[place] === '1').length % 2 === 0);
  };
  const memo = new Map();
  let losing = 0;
  for (let a = 0; a <= LIMITS.pile.max; a++) {
    for (let b = 0; b <= LIMITS.pile.max; b++) {
      for (let c = 0; c <= LIMITS.pile.max; c++) {
        const board = piles(Math.max(a, 1), Math.max(b, 1), Math.max(c, 1));
        const win = isWin(board, [a, b, c]);
        assert.equal(win, !allEven([a, b, c]), `${a}, ${b}, ${c}`);
        if (a <= 6 && b <= 6 && c <= 6) assert.equal(win, bruteWin('stones', Infinity, [a, b, c], memo), `${a}, ${b}, ${c}(다른 탐색)`);
        if (!win) losing += 1;
      }
    }
  }
  // 0개부터 9개까지의 세 수 1000가지 가운데 지는 자리는 76가지다.
  assert.equal(losing, 76);
  // 사다리에 나오는 판(더미마다 1~7개) 343가지 가운데 나중에 두는 쪽이 이기는 판은 42가지다.
  let second = 0;
  for (let a = 1; a <= 7; a++) for (let b = 1; b <= 7; b++) for (let c = 1; c <= 7; c++) if (!solve(piles(a, b, c)).first) second += 1;
  assert.equal(second, 42);
  assert.equal(solve(piles(1, 2, 3)).first, false);
  assert.equal(solve(piles(9, 9, 9)).positions, 220);
});

test('이기는 수의 목록: 상대를 지는 자리로 보내는 수가 빠짐없이 들어 있다', () => {
  for (const board of [choco(3, 2), choco(3, 3), one(7, 2), one(9, 3), piles(5, 3), piles(4, 4), piles(1, 2, 3), piles(3, 5, 2), piles(7, 6, 3), divisor(12), divisor(15), half(10), half(15), both(3, 6), both(4, 7), both(9, 9)]) {
    const start = startState(board);
    const moves = movesOf(board, start);
    const winning = winningMoves(board, start);
    const expected = moves.filter((move) => !brute(board, applyMove(board, start, move)));
    assert.deepEqual(winning, expected, boardKey(board));
    assert.equal(winning.length > 0, isWin(board, start), boardKey(board));
    assert.deepEqual(solve(board).moves, winning);
  }
  assert.deepEqual(winningMoves(piles(3, 5, 2), [3, 5, 2]), [{ pile: 1, take: 4 }]);
});

test('차례와 다시 두기', () => {
  assert.equal(turnOf('kid', 0), 'kid');
  assert.equal(turnOf('kid', 1), 'teacher');
  assert.equal(turnOf('teacher', 0), 'teacher');
  assert.equal(turnOf('teacher', 3), 'kid');
  assert.equal(otherOf('kid'), 'teacher');
  // 끝난 판에서 마지막 수를 둔 쪽이 이긴 쪽이다.
  assert.equal(winnerOf('kid', 3), 'kid');
  assert.equal(winnerOf('kid', 4), 'teacher');
  assert.equal(winnerOf('teacher', 3), 'teacher');
  const board = one(4, 2);
  const played = replay(board, [{ pile: 0, take: 1 }, { pile: 0, take: 2 }]);
  assert.deepEqual(played, { ok: true, state: [1], over: false });
  assert.equal(replay(board, [{ pile: 0, take: 2 }, { pile: 0, take: 2 }]).over, true);
  assert.equal(replay(board, [{ pile: 0, take: 3 }]).ok, false);
  assert.equal(replay(board, 'x').ok, false);
  assert.deepEqual(replay(board, []), { ok: true, state: [4], over: false });
  assert.equal(moveKey({ pile: 1, take: 3 }), '1-3');
  assert.equal(moveKey({ piece: 2, dir: 'h', at: 1 }), '2h1');
  assert.equal(boardKey(choco(3, 2)), 'choco-3x2');
  assert.equal(boardKey(one(7, 2)), 'one-7-2');
  assert.equal(boardKey(piles(3, 5, 2)), 'piles-3-5-2');
});

test('선생님이 두는 법: 이길 수 있는 자리에서는 이기는 수를, 질 자리에서는 둘 수 있는 수 가운데 하나를 둔다', () => {
  for (const board of [one(7, 2), one(17, 3), piles(5, 3), piles(2, 7), piles(3, 5, 2), piles(7, 6, 3), choco(3, 2), divisor(18), half(20), both(2, 9)]) {
    const start = startState(board);
    assert.equal(isWin(board, start), true, boardKey(board));
    for (let seed = 1; seed <= 30; seed++) {
      const move = pickMove(board, start, createRng(seed));
      assert.equal(isWin(board, applyMove(board, start, move)), false, `${boardKey(board)}: 이기는 수가 아니에요`);
    }
  }
  // 질 자리에서는 둘 수 있는 수 가운데 시드 난수로 고른다. 여러 가지 수가 나온다.
  for (const board of [one(9, 2), piles(4, 4), piles(1, 2, 3), choco(3, 3), divisor(15), half(15), both(4, 7)]) {
    const start = startState(board);
    assert.equal(isWin(board, start), false, boardKey(board));
    const seen = new Set();
    for (let seed = 1; seed <= 60; seed++) {
      const move = pickMove(board, start, createRng(seed));
      assert.notEqual(applyMove(board, start, move), null);
      seen.add(moveKey(move));
    }
    assert.ok(seen.size > 1, `${boardKey(board)}: 늘 같은 수만 둬요`);
  }
  assert.equal(pickMove(one(3, 2), [0], createRng(1)), null, '더 둘 수 없는 자리');
});

test('선생님의 수는 (단계, 판 번호, 먼저 두는 쪽, 지금까지 둔 수들)로 정해진다. 같은 값이면 늘 같은 수다', () => {
  const board = piles(4, 4, 5);
  const trail = [{ pile: 2, take: 2 }];
  const options = { level: 4, seed: 6, first: 'kid' };
  const move = teacherMove(board, trail, options);
  for (let again = 0; again < 5; again++) assert.deepEqual(teacherMove(board, trail, options), move);
  assert.notEqual(applyMove(board, replay(board, trail).state, move), null);
  // 질 자리(같은 두 더미)에서 판 번호가 달라지면 다른 수도 나온다.
  const seen = new Set();
  for (let seed = 1; seed <= 40; seed++) seen.add(moveKey(teacherMove(piles(6, 6), [], { level: 3, seed, first: 'teacher' })));
  assert.ok(seen.size > 3);
  // 직접 만든 판은 판 번호가 없다. 판의 모습을 시드로 써서 늘 같은 수를 둔다.
  assert.deepEqual(teacherMove(piles(6, 6), [], { first: 'teacher' }), teacherMove(piles(6, 6), [], { first: 'teacher' }));
  // 둘 수 없는 수가 섞인 차례에는 두지 않는다. 더 둘 수 없으면 null이다.
  assert.equal(teacherMove(board, [{ pile: 0, take: 9 }], options), null);
  assert.equal(teacherMove(one(2, 2), [{ pile: 0, take: 2 }], options), null);
});

test('이기는 쪽을 고르고 끝까지 옳게 두면 이기고, 지는 쪽을 고르면 어떻게 두어도 진다', () => {
  const rng = createRng(2026);
  const anyMove = (state, moves) => moves[randInt(rng, 0, moves.length - 1)];
  const boards = [choco(2, 2), choco(3, 3), choco(4, 3), one(5, 2), one(13, 2), one(20, 3), one(18, 3), piles(3, 7), piles(8, 8), piles(2, 1, 1), piles(3, 6, 5), piles(7, 6, 3), divisor(14), divisor(19), half(12), half(15), both(5, 3), both(8, 6)];
  for (const board of boards) {
    const { first } = solve(board);
    const winningSide = first ? 'kid' : 'teacher'; // 아이가 이기는 쪽에 서려면 먼저 둘 쪽
    const best = (state) => winningMoves(board, state)[0];
    for (let seed = 1; seed <= 8; seed++) {
      // 이기는 쪽을 골라 옳게 두면 이긴다.
      assert.equal(playOut(board, winningSide, best, { seed }).winner, 'kid', `${boardKey(board)}: 옳게 두었는데 졌어요`);
      // 지는 쪽을 고르면 아무렇게나 두어도, 그 자리에서 가장 나아 보이는 수를 두어도 진다.
      assert.equal(playOut(board, otherOf(winningSide), anyMove, { seed }).winner, 'teacher', `${boardKey(board)}: 지는 쪽인데 이겼어요`);
    }
  }
});

test('이기는 쪽을 골라 놓고 한 번 잘못 두면 선생님이 뒤집는다(돌 게임). 초콜릿은 잘못 둘 수가 없다', () => {
  const rng = createRng(77);
  for (const board of [one(7, 2), one(13, 2), one(18, 3), piles(3, 7), piles(8, 6), piles(3, 5, 2), piles(7, 6, 3), divisor(20), half(24), both(6, 9)]) {
    const first = solve(board).first ? 'kid' : 'teacher';
    let slipped = false;
    const kid = (state, moves) => {
      const winning = winningMoves(board, state);
      const losing = moves.filter((move) => !winning.some((item) => moveKey(item) === moveKey(move)));
      // 이기는 자리에서 딱 한 번 지는 수를 둔다. 그 뒤로는 가장 나은 수를 둔다.
      if (!slipped && winning.length > 0 && losing.length > 0) {
        slipped = true;
        return losing[randInt(rng, 0, losing.length - 1)];
      }
      return winning[0] ?? moves[0];
    };
    const { trail, winner } = playOut(board, first, kid);
    assert.equal(slipped, true, boardKey(board));
    assert.equal(winner, 'teacher', `${boardKey(board)}: 잘못 두었는데 이겼어요`);
    // 기록에 남기는 "이기는 자리에서 지는 수를 둔 곳"은 그 한 곳이다.
    assert.equal(slipsOf(board, trail, first).length, 1, boardKey(board));
  }
  // 초콜릿은 이기는 자리에서 어느 수를 두어도 이기는 수다. 그래서 잘못 둔 곳이 없다.
  const board = choco(4, 3);
  const { trail, winner } = playOut(board, 'kid', (state, moves) => moves[randInt(rng, 0, moves.length - 1)]);
  assert.equal(winner, 'kid');
  assert.deepEqual(slipsOf(board, trail, 'kid'), []);
});

test('잘못 둔 곳: 아이가 이기는 자리에서 상대를 이기는 자리로 보낸 수만 센다', () => {
  // 5개와 3개: 2개를 가져가 같게 만들어야 한다. 1개를 가져가면(4개와 3개) 선생님이 같게 만든다.
  const board = piles(5, 3);
  const trail = [{ pile: 0, take: 1 }, { pile: 0, take: 1 }, { pile: 1, take: 3 }, { pile: 0, take: 3 }];
  assert.equal(replay(board, trail).over, true);
  assert.deepEqual(slipsOf(board, trail, 'kid'), [1]);
  // 지는 자리에서 둔 수는 잘못 둔 수가 아니다(어떻게 두어도 진다).
  assert.deepEqual(slipsOf(piles(3, 3), [{ pile: 0, take: 1 }, { pile: 1, take: 1 }], 'kid'), []);
  // 선생님의 수는 세지 않는다. 같은 차례를 선생님이 먼저 둔 것으로 보면, 아이의 수(둘째, 넷째)는 모두 이기는 수다.
  assert.deepEqual(slipsOf(board, trail, 'teacher'), []);
  // 나중에 두는 아이가 잘못 둔 곳: 선생님이 4개와 3개를 넘겼는데 같게 만들지 않았다.
  assert.deepEqual(slipsOf(board, [{ pile: 0, take: 1 }, { pile: 1, take: 2 }, { pile: 0, take: 3 }, { pile: 0, take: 1 }, { pile: 1, take: 1 }], 'teacher'), [2]);
  assert.deepEqual(slipsOf(board, [], 'kid'), []);
});

test('아무렇게나 두었을 때 아이가 이기는 비율: 모든 경우를 따진 값이고, 시드 난수로 여러 번 두어 본 값과 가깝다', () => {
  // 손으로 따질 수 있는 판: 돌 2개에서 1개나 2개. 2개를 다 가져가면 이기고(절반), 1개만 가져가면 진다.
  assert.equal(randomKidWinRate(one(2, 2), true), 0.5);
  assert.equal(randomKidWinRate(one(1, 2), true), 1);
  assert.equal(randomKidWinRate(one(1, 2), false), 0);
  // 1개와 1개: 먼저 두면 지고, 나중에 두면 이긴다(둘 수가 하나뿐이다).
  assert.equal(randomKidWinRate(piles(1, 1), true), 0);
  assert.equal(randomKidWinRate(piles(1, 1), false), 1);
  // 초콜릿은 어떻게 두어도 같다: 이기는 쪽이면 늘 이기고 지는 쪽이면 늘 진다.
  for (const [w, h] of [[2, 2], [3, 2], [3, 3], [4, 3], [5, 5]]) {
    const first = solve(choco(w, h)).first;
    assert.equal(randomKidWinRate(choco(w, h), first), 1, `${w}×${h}`);
    assert.equal(randomKidWinRate(choco(w, h), !first), 0, `${w}×${h}`);
  }
  // 지는 쪽에 서면 돌 게임에서도 이길 수 없다.
  for (const board of [one(9, 2), piles(4, 4), piles(1, 2, 3)]) assert.equal(randomKidWinRate(board, true), 0, boardKey(board));
  // 시드 난수로 4000판 두어 본 값과 견준다(선생님은 이기는 수 가운데 하나를 고르게 둔다).
  const rng = createRng(31);
  for (const board of [one(7, 2), one(10, 3), piles(5, 3), piles(3, 5, 2), divisor(12), half(10), both(3, 6)]) {
    const kidFirst = solve(board).first;
    let wins = 0;
    const trials = 4000;
    for (let trial = 0; trial < trials; trial++) {
      let state = startState(board);
      let kidTurn = kidFirst;
      while (!isOver(board, state)) {
        const moves = movesOf(board, state);
        const move = kidTurn ? moves[randInt(rng, 0, moves.length - 1)] : pickMove(board, state, rng);
        state = applyMove(board, state, move);
        kidTurn = !kidTurn;
      }
      if (kidTurn === false) wins += 1; // 마지막 수를 아이가 두었다
    }
    const exact = randomKidWinRate(board, kidFirst);
    assert.ok(exact > 0 && exact < 1, boardKey(board));
    assert.ok(Math.abs(wins / trials - exact) < 0.03, `${boardKey(board)}: 따진 값 ${exact.toFixed(3)}, 두어 본 값 ${(wins / trials).toFixed(3)}`);
  }
});

test('작은 판으로 두어 보기: 같은 게임의 가장 작은 판들을 작은 것부터 낸다. 원래 판보다 작은 판만 낸다', () => {
  const total = (board) => (board.kind === 'choco' ? board.w * board.h : 'n' in board ? board.n : board.piles.reduce((sum, item) => sum + item, 0));
  for (const board of [choco(2, 2), choco(3, 3), choco(4, 3), one(5, 2), one(5, 3), one(20, 3), piles(2, 2), piles(8, 8), piles(1, 1, 1), piles(3, 5, 2), piles(7, 7, 7), divisor(6), divisor(20), half(5), half(24), both(1, 2), both(9, 9)]) {
    const list = smallBoards(board);
    assert.ok(list.length <= SMALL_COUNT, boardKey(board));
    for (const small of list) {
      assert.equal(checkBoard(small), null, boardKey(small));
      assert.equal(gameOf(small), gameOf(board), boardKey(small));
      assert.ok(total(small) < total(board), `${boardKey(small)}는 ${boardKey(board)}보다 작지 않아요`);
      assert.ok(movesOf(small, startState(small)).length > 0, `${boardKey(small)}는 둘 수가 없어요`);
      if (board.kind === 'one') assert.equal(small.max, board.max);
    }
    assert.deepEqual(list.map(total), list.map(total).sort((a, b) => a - b), boardKey(board));
    assert.equal(new Set(list.map(boardKey)).size, list.length, boardKey(board));
  }
  assert.deepEqual(smallBoards(one(20, 2)).map((board) => board.n), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(smallBoards(one(5, 3)).map((board) => board.n), [1, 2, 3, 4]);
  assert.deepEqual(smallBoards(choco(4, 3)).map(boardKey), ['choco-2x1', 'choco-3x1', 'choco-4x1', 'choco-2x2', 'choco-5x1', 'choco-3x2']);
  assert.deepEqual(smallBoards(piles(8, 8)).map((board) => board.piles), [[1, 1], [1, 2], [1, 3], [2, 2], [2, 3], [3, 3]]);
  assert.deepEqual(smallBoards(piles(3, 5, 2)).map((board) => board.piles), [[1, 1, 1], [1, 1, 2], [1, 1, 3], [1, 2, 2], [1, 2, 3], [2, 2, 2]]);
  // 사다리에 나오는 판에서는 작은 판들 가운데 먼저 두는 쪽이 이기는 판과 나중에 두는 쪽이 이기는 판이 모두 있다(두어 보면 다른 것이 보인다).
  for (const board of [choco(3, 2), choco(3, 3), one(5, 2), one(5, 3), one(20, 3), piles(2, 3), piles(8, 8), piles(3, 5, 2), divisor(6), divisor(20), half(5), half(24), both(2, 2), both(9, 9)]) {
    const firsts = new Set(smallBoards(board).map((small) => solve(small).first));
    assert.equal(firsts.size, 2, boardKey(board));
  }
  // 약수 빼기와 절반까지는 2개부터(1개짜리는 처음부터 둘 수가 없다), 두 더미에서 같은 수도는 두 더미의 꼴 그대로 작은 판을 낸다.
  assert.deepEqual(smallBoards(divisor(20)).map((board) => board.n), [2, 3, 4, 5, 6, 7]);
  assert.deepEqual(smallBoards(half(5)).map((board) => board.n), [2, 3, 4]);
  assert.deepEqual(smallBoards(both(9, 9)).map(boardKey), ['both-1-1', 'both-1-2', 'both-1-3', 'both-2-2', 'both-2-3', 'both-3-3']);
  // 가장 작은 판에는 더 작은 판이 없다.
  assert.deepEqual(smallBoards(choco(2, 1)), []);
  assert.deepEqual(smallBoards(one(1, 2)), []);
  assert.deepEqual(smallBoards(piles(1, 1)), []);
  assert.deepEqual(smallBoards(divisor(2)), []);
  assert.deepEqual(smallBoards(both(1, 1)), []);
});

// ---- 기록에서 읽는 것 ----
let nextId = 0;
function duel(overrides = {}) {
  nextId += 1;
  return { kind: 'round', id: `d${nextId}`, format: 'duel', level: 1, seed: nextId, custom: false, mode: 'choco', outcome: 'solved', winner: 'kid', ...overrides };
}

test('"왜 그럴까?"는 그 게임을 세 판 끝까지 둔 뒤에 열린다. 세 더미에는 없다', () => {
  assert.equal(WHY_AFTER, 3);
  assert.equal(whyOpen([], 'choco'), false);
  assert.equal(whyOpen([duel(), duel()], 'choco'), false);
  assert.equal(whyOpen([duel(), duel(), duel()], 'choco'), true);
  // 이긴 판도 진 판도 끝까지 둔 판이다.
  assert.equal(whyOpen([duel({ winner: 'teacher' }), duel(), duel({ winner: 'teacher' })], 'choco'), true);
  // 그만둔 판, 풀이를 보고 끝낸 판은 세지 않는다.
  assert.equal(whyOpen([duel(), duel(), duel({ outcome: 'left', winner: null })], 'choco'), false);
  assert.equal(whyOpen([duel(), duel(), duel({ outcome: 'solution', winner: null })], 'choco'), false);
  // 게임마다 따로 센다.
  const mixed = [duel(), duel(), duel({ mode: 'one' }), duel({ mode: 'two' })];
  assert.equal(whyOpen(mixed, 'choco'), false);
  assert.equal(finishedCount(mixed, 'choco'), 2);
  assert.equal(finishedCount(mixed, 'one'), 1);
  // 같은 판의 기록이 여러 번 남았으면 한 판으로 센다.
  const twice = duel();
  assert.equal(finishedCount([twice, { ...twice, rev: 2 }, { ...twice, rev: 3 }], 'choco'), 1);
  // 세 더미는 일부러 까닭을 남겨 둔 판이다. 몇 판을 두어도 열리지 않는다. 절반까지와 두 더미에서 같은 수도도 그렇다.
  const three = Array.from({ length: 10 }, () => duel({ mode: 'three', level: 4 }));
  assert.equal(finishedCount(three, 'three'), 10);
  assert.equal(whyOpen(three, 'three'), false);
  assert.deepEqual(NO_WHY, ['three', 'half', 'both']);
  for (const mode of ['half', 'both']) assert.equal(whyOpen(Array.from({ length: 5 }, () => duel({ mode })), mode), false, mode);
  // 약수 빼기는 세 판을 끝까지 둔 뒤에 열린다.
  assert.equal(whyOpen([duel({ mode: 'divisor' }), duel({ mode: 'divisor' })], 'divisor'), false);
  assert.equal(whyOpen([duel({ mode: 'divisor' }), duel({ mode: 'divisor' }), duel({ mode: 'divisor', winner: 'teacher' })], 'divisor'), true);
  // 다른 형식의 기록은 세지 않는다. 기록이 깨져 있어도 오류를 내지 않는다.
  assert.equal(whyOpen([duel(), duel(), { ...duel(), format: 'tile' }], 'choco'), false);
  assert.equal(whyOpen(null, 'choco'), false);
  assert.equal(finishedCount([null, 3, 'x'], 'choco'), 0);
});

test('연달아 진 판의 수: 끝까지 둔 판만 보고, 맨 뒤에서부터 센다', () => {
  assert.equal(lostStreak([]), 0);
  assert.equal(lostStreak([duel({ winner: 'teacher' })]), 1);
  assert.equal(lostStreak([duel(), duel({ winner: 'teacher' }), duel({ winner: 'teacher', mode: 'one' })]), 2);
  assert.equal(lostStreak([duel({ winner: 'teacher' }), duel()]), 0);
  // 그만둔 판은 건너뛴다.
  assert.equal(lostStreak([duel({ winner: 'teacher' }), duel({ outcome: 'left', winner: null }), duel({ winner: 'teacher' })]), 2);
  assert.equal(lostStreak(undefined), 0);
});
