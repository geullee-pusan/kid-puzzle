// 여우와 토끼의 규칙과 풀이 프로그램 테스트.
// 풀이 프로그램(끝에서부터 한 겹씩 넓히는 표)이 낸 값을 다른 방법(남은 횟수를 줄이며 앞으로 따지는 탐색, tests/helpers/brute-foxrabbit.js)과 견준다.
// 색 이야기(여우 차례에 다른 색이면 여우가 잡고, 같은 색이면 못 잡는다)와 여우가 움직일 수 있는 횟수(가로 + 세로 - 3)가 모든 자리에서 맞는지 본다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  catchIn,
  checkBoard,
  colorOf,
  finishedCount,
  gapOf,
  limitOf,
  lostStreak,
  movesOf,
  neighbors,
  pickMove,
  replay,
  sameColor,
  seatWins,
  slipsOf,
  smallBoards,
  solve,
  teacherMove,
  walk,
  whyOpen,
  winnerAt,
} from '../src/core/foxrabbit.js';
import { createRng } from '../src/core/rng.js';
import { bruteReplay, makeBrute, pairOf } from './helpers/brute-foxrabbit.js';

const SIZES = [];
for (let w = 3; w <= 5; w++) for (let h = 3; h <= 5; h++) SIZES.push([w, h]);

/** 그 크기의 모든 자리(여우와 토끼가 다른 칸) */
function* placesOf(w, h) {
  for (let fox = 0; fox < w * h; fox++) for (let rabbit = 0; rabbit < w * h; rabbit++) if (fox !== rabbit) yield [fox, rabbit];
}

test('판의 값: 크기는 3~5칸, 여우와 토끼는 판 안의 다른 칸, 먼저 움직이는 쪽은 여우·토끼·고르기(null)', () => {
  assert.equal(checkBoard({ w: 4, h: 4, fox: 0, rabbit: 15, first: 'fox' }), null);
  assert.equal(checkBoard({ w: 4, h: 4, fox: 0, rabbit: 15, first: null }), null);
  assert.equal(checkBoard({ w: 2, h: 4, fox: 0, rabbit: 7, first: 'fox' }), 'size');
  assert.equal(checkBoard({ w: 6, h: 4, fox: 0, rabbit: 7, first: 'fox' }), 'size');
  assert.equal(checkBoard({ w: 4, h: 4, fox: 3, rabbit: 3, first: 'fox' }), 'animals');
  assert.equal(checkBoard({ w: 4, h: 4, fox: 0, rabbit: 16, first: 'fox' }), 'animals');
  assert.equal(checkBoard({ w: 4, h: 4, fox: 0, rabbit: 5, first: 'cat' }), 'first');
  assert.equal(limitOf({ w: 4, h: 4 }), 5);
  assert.equal(limitOf({ w: 4, h: 5 }), 6);
  assert.equal(limitOf({ w: 5, h: 5 }), 7);
  assert.equal(limitOf({ w: 3, h: 3 }), 3);
});

test('규칙: 반드시 이웃한 칸으로 한 칸, 제자리는 안 되고, 토끼는 여우 칸에 못 들어간다. 여우가 들어가면 잡고, 여우가 정한 횟수를 다 움직이면 토끼가 이긴다', () => {
  const board = { w: 4, h: 4, fox: 0, rabbit: 5, first: 'fox' };
  assert.deepEqual(movesOf(board, [], 'fox').sort((a, b) => a - b), [1, 4]);
  // 제자리, 대각선, 두 칸은 둘 수 없다
  for (const cell of [0, 5, 2, 8]) assert.equal(replay(board, [cell], 'fox').ok, false, `여우가 ${cell}로`);
  // 여우가 1로 가면 토끼(5)는 1에 못 가고 4, 6, 9로 간다
  assert.deepEqual(movesOf(board, [1], 'fox').sort((a, b) => a - b), [4, 6, 9]);
  assert.equal(replay(board, [1, 1], 'fox').ok, false);
  assert.equal(replay(board, [1, 5], 'fox').ok, false);
  // 여우가 토끼 칸에 들어가면 잡는다(구석에 몰린 토끼)
  const catchMove = replay({ w: 4, h: 4, fox: 0, rabbit: 3, first: 'fox' }, [1, 2, 2], 'fox');
  assert.equal(catchMove.ok, true);
  assert.equal(catchMove.over, true);
  assert.equal(catchMove.winner, 'fox');
  assert.equal(catchMove.foxMoves, 2);
  assert.equal(replay({ w: 4, h: 4, fox: 0, rabbit: 1, first: 'fox' }, [1], 'fox').winner, 'fox');
  assert.equal(catchMove.fox, catchMove.rabbit);
  // 여우가 다섯 번 움직이는 동안 못 잡으면 다섯 번째에 바로 끝난다(토끼가 이긴다). 끝난 뒤에는 더 둘 수 없다
  const safe = { w: 4, h: 4, fox: 0, rabbit: 10, first: 'fox' };
  const trail = [1, 11, 2, 15, 6, 14, 10, 13, 9];
  const over = replay(safe, trail, 'fox');
  assert.deepEqual([over.ok, over.over, over.winner, over.foxMoves, over.next], [true, true, 'rabbit', 5, null]);
  assert.equal(replay(safe, [...trail, 12], 'fox').ok, false);
  assert.deepEqual(movesOf(safe, trail, 'fox'), []);
  // 다른 방법으로 따라가 본 것과 같다
  const brute = bruteReplay(safe, trail, 'fox');
  assert.deepEqual([brute.ok, brute.winner, brute.foxMoves], [true, 'rabbit', 5]);
});

test('규칙: 3×3 이상의 판에서는 토끼가 움직일 곳이 늘 있다', () => {
  for (const [w, h] of SIZES) {
    for (const [fox, rabbit] of placesOf(w, h)) assert.ok(neighbors(w, h, rabbit).filter((cell) => cell !== fox).length >= 1, `${w}x${h} ${fox} ${rabbit}`);
  }
});

test('풀이 프로그램: 3×3~5×5의 모든 자리와 차례에서, 여우가 몇 번 만에 잡는지가 다른 방법(앞으로 따지는 탐색)과 같다', () => {
  for (const [w, h] of SIZES) {
    const brute = makeBrute(w, h);
    // 정한 횟수보다 넉넉히 더 따져도(가로 + 세로 + 3번) 더 늦게 잡는 자리는 없다
    const far = w + h + 3;
    for (const [fox, rabbit] of placesOf(w, h)) {
      for (const turn of ['fox', 'rabbit']) {
        assert.equal(catchIn(w, h, fox, rabbit, turn), brute.steps(pairOf(w, fox), pairOf(w, rabbit), turn, far), `${w}x${h} 여우 ${fox} 토끼 ${rabbit} ${turn}`);
      }
    }
  }
});

test('색 이야기: 3×3~6×6의 모든 자리에서, 여우 차례에 다른 색 칸이면 여우가 잡고 같은 색 칸이면 끝내 못 잡는다. 가장 오래 버텨도 (가로 + 세로 - 3)번이면 잡는다', () => {
  for (let w = 3; w <= 6; w++) {
    for (let h = 3; h <= 6; h++) {
      let longest = 0;
      for (const [fox, rabbit] of placesOf(w, h)) {
        const same = sameColor(w, fox, rabbit);
        const foxTurn = catchIn(w, h, fox, rabbit, 'fox');
        const rabbitTurn = catchIn(w, h, fox, rabbit, 'rabbit');
        assert.equal(foxTurn !== null, !same, `${w}x${h} ${fox} ${rabbit} 여우 차례`);
        // 토끼 차례면 토끼가 움직인 뒤 여우 차례가 되므로 반대다
        assert.equal(rabbitTurn !== null, same, `${w}x${h} ${fox} ${rabbit} 토끼 차례`);
        longest = Math.max(longest, foxTurn ?? 0, rabbitTurn ?? 0);
      }
      assert.equal(longest, w + h - 3, `${w}x${h}`);
    }
  }
});

test('같은 색이면 토끼가 아무렇게나 움직여도 못 잡는다: 여우 차례에 같은 색인 자리에서 여우의 어느 수도 토끼 칸이 아니고, 둘이 한 번씩 움직이면 다시 같은 색이다', () => {
  for (const [w, h] of SIZES) {
    for (const [fox, rabbit] of placesOf(w, h)) {
      if (!sameColor(w, fox, rabbit)) continue;
      for (const nextFox of neighbors(w, h, fox)) {
        assert.notEqual(nextFox, rabbit);
        for (const nextRabbit of neighbors(w, h, rabbit).filter((cell) => cell !== nextFox)) assert.ok(sameColor(w, nextFox, nextRabbit));
      }
    }
  }
  // 색은 바둑판처럼 번갈아 칠한다. 한 칸 움직이면 늘 다른 색이 된다
  for (const [w, h] of SIZES) for (let cell = 0; cell < w * h; cell++) for (const next of neighbors(w, h, cell)) assert.notEqual(colorOf(w, cell), colorOf(w, next));
});

test('"반드시 한 칸 움직인다"가 빠지면 색 이야기가 깨진다: 토끼가 쉴 수 있으면 4×4에서 여우는 처음부터 바로 옆인 자리(480가지 가운데 48가지)만 잡고, 여우가 쉴 수 있으면 늘 잡는다', () => {
  const w = 4;
  const h = 4;
  const limit = 30;
  const rabbitRests = makeBrute(w, h, { rabbitStay: true });
  const foxRests = makeBrute(w, h, { foxStay: true });
  let rabbitWins = 0;
  let foxWins = 0;
  let total = 0;
  for (const [fox, rabbit] of placesOf(w, h)) {
    for (const turn of ['fox', 'rabbit']) {
      total += 1;
      const near = turn === 'fox' && gapOf(w, fox, rabbit) === 1;
      const caught = rabbitRests.steps(pairOf(w, fox), pairOf(w, rabbit), turn, limit) !== null;
      assert.equal(caught, near, `${fox} ${rabbit} ${turn}`);
      if (caught) rabbitWins += 1;
      if (foxRests.steps(pairOf(w, fox), pairOf(w, rabbit), turn, limit) !== null) foxWins += 1;
    }
  }
  assert.deepEqual([rabbitWins, foxWins, total], [48, 480, 480]);
});

test('판 풀기: 여우가 먼저일 때와 토끼가 먼저일 때의 이기는 쪽과 잡는 횟수. 먼저 움직이는 쪽이 정해진 판은 그때 이기는 쪽', () => {
  const same = solve({ w: 4, h: 4, fox: 0, rabbit: 15, first: 'fox' });
  assert.deepEqual(same, { same: true, limit: 5, foxFirst: null, rabbitFirst: 5, fox: 'rabbit', rabbit: 'fox', winner: 'rabbit' });
  const other = solve({ w: 4, h: 4, fox: 0, rabbit: 6, first: null });
  assert.equal(other.same, false);
  assert.equal(other.fox, 'fox');
  assert.equal(other.rabbit, 'rabbit');
  assert.equal(other.winner, null);
  assert.equal(seatWins(other, 'rabbit', 'rabbit'), true);
  assert.equal(seatWins(other, 'rabbit', 'fox'), false);
  assert.equal(seatWins(other, 'fox', 'fox'), true);
});

/** 토끼의 모든 수를 해 보면서 컴퓨터 여우가 둔다: 여우가 정한 횟수 안에 늘 잡는가 */
function foxAlwaysCatches(board, trail, first, rng) {
  const now = replay(board, trail, first);
  if (now.over) return now.winner === 'fox';
  if (now.next === 'fox') return foxAlwaysCatches(board, [...trail, pickMove(board, trail, first, rng)], first, rng);
  return movesOf(board, trail, first).every((cell) => foxAlwaysCatches(board, [...trail, cell], first, rng));
}

test('컴퓨터 여우: 잡을 수 있는 자리면 토끼가 어떻게 움직여도 정한 횟수 안에 잡는다(3×3, 4×4, 4×5의 모든 처음 자리)', () => {
  for (const [w, h] of [[3, 3], [4, 4], [4, 5]]) {
    for (const [fox, rabbit] of placesOf(w, h)) {
      for (const first of ['fox', 'rabbit']) {
        const board = { w, h, fox, rabbit, first };
        if (solve(board).winner !== 'fox') continue;
        assert.ok(foxAlwaysCatches(board, [], first, createRng(7)), `${w}x${h} ${fox} ${rabbit} ${first}`);
      }
    }
  }
});

test('컴퓨터 토끼: 질 자리에서는 가장 오래 버틴다(잘 쫓는 여우가 꼭 풀이 프로그램의 횟수만큼 움직여야 잡는다). 이길 자리에서는 잡히지 않는다', () => {
  for (const [w, h] of [[4, 4], [5, 5]]) {
    const n = w * h;
    for (const [fox, rabbit] of placesOf(w, h)) {
      for (const first of ['fox', 'rabbit']) {
        const board = { w, h, fox, rabbit, first };
        const result = solve(board);
        const rng = createRng(fox * n + rabbit);
        let trail = [];
        for (let guard = 0; guard < 40; guard++) {
          const now = replay(board, trail, first);
          if (now.over) break;
          let cell;
          if (now.next === 'rabbit') cell = pickMove(board, trail, first, rng);
          else {
            // 잘 쫓는 여우: 가장 빨리 잡는 칸(없으면 첫 이웃)
            const near = neighbors(w, h, now.fox);
            const score = (to) => (to === now.rabbit ? 1 : (catchIn(w, h, to, now.rabbit, 'rabbit') ?? 99) + 1);
            cell = near.reduce((best, to) => (score(to) < score(best) ? to : best), near[0]);
          }
          trail = [...trail, cell];
        }
        const end = replay(board, trail, first);
        assert.equal(end.over, true);
        if (result.winner === 'fox') assert.equal(end.foxMoves, first === 'fox' ? result.foxFirst : result.rabbitFirst, `${w}x${h} ${fox} ${rabbit} ${first}`);
        else assert.equal(end.winner, 'rabbit');
      }
    }
  }
});

test('컴퓨터 여우는 못 잡는 자리에서도 쫓아간다: 늘 토끼와의 거리가 가장 짧아지는 칸으로 간다', () => {
  const board = { w: 5, h: 5, fox: 0, rabbit: 24, first: 'fox' };
  const rng = createRng(3);
  let trail = [];
  for (let guard = 0; guard < 30; guard++) {
    const now = replay(board, trail, 'fox');
    if (now.over) break;
    const cell = pickMove(board, trail, 'fox', rng);
    if (now.next === 'fox') {
      const best = Math.min(...neighbors(5, 5, now.fox).map((to) => gapOf(5, to, now.rabbit)));
      assert.equal(gapOf(5, cell, now.rabbit), best);
    }
    trail = [...trail, cell];
  }
  const end = replay(board, trail, 'fox');
  assert.deepEqual([end.over, end.winner, end.foxMoves], [true, 'rabbit', 7]);
});

test('토끼와 더 많이 떨어진 쪽(가로나 세로)으로 다가가면, 잡는 자리에서는 토끼가 어떻게 움직여도 정한 횟수 안에 잡는다(4×4~5×5의 모든 자리)', () => {
  for (const [w, h] of [[4, 4], [4, 5], [5, 4], [5, 5]]) {
    const memo = new Map();
    const catches = (fox, rabbit, left) => {
      if (left <= 0) return false;
      const key = `${fox}|${rabbit}|${left}`;
      if (memo.has(key)) return memo.get(key);
      const [fx, fy] = pairOf(w, fox);
      const [rx, ry] = pairOf(w, rabbit);
      const dx = Math.abs(fx - rx);
      const dy = Math.abs(fy - ry);
      const closer = neighbors(w, h, fox).filter((cell) => gapOf(w, cell, rabbit) < gapOf(w, fox, rabbit));
      const along = dx === dy ? closer : closer.filter((cell) => (Math.floor(cell / w) === fy) === dx > dy);
      const result = along.every((cell) => cell === rabbit || neighbors(w, h, rabbit).filter((to) => to !== cell).every((to) => catches(cell, to, left - 1)));
      memo.set(key, result);
      return result;
    };
    for (const [fox, rabbit] of placesOf(w, h)) if (!sameColor(w, fox, rabbit)) assert.ok(catches(fox, rabbit, w + h - 3), `${w}x${h} ${fox} ${rabbit}`);
  }
});

test('선생님의 수는 (단계, 판 번호, 아이의 동물, 먼저 움직이는 쪽, 둔 수들)로 정해진다', () => {
  const board = { w: 4, h: 4, fox: 0, rabbit: 15, first: 'fox' };
  const one = teacherMove(board, [], { level: 1, seed: 1, role: 'rabbit', first: 'fox' });
  assert.equal(teacherMove(board, [], { level: 1, seed: 1, role: 'rabbit', first: 'fox' }), one);
  assert.ok([1, 4].includes(one));
  // 판 번호가 다르면 다른 수를 둘 수도 있지만, 늘 둘 수 있는 수다
  for (let seed = 1; seed <= 20; seed++) assert.ok(movesOf(board, [1], 'fox').includes(teacherMove(board, [1], { level: 1, seed, role: 'fox', first: 'fox' })));
  // 끝난 판에는 수가 없다
  assert.equal(teacherMove({ w: 4, h: 4, fox: 0, rabbit: 10, first: 'fox' }, [1, 11, 2, 15, 6, 14, 10, 13, 9], { first: 'fox' }), null);
});

test('아이가 이기는 자리에서 지는 자리로 보낸 수: 토끼는 없고, 여우는 돌아가서 횟수가 모자라게 된 수', () => {
  const safe = { w: 4, h: 4, fox: 0, rabbit: 10, first: 'fox' };
  assert.deepEqual(slipsOf(safe, [1, 11, 2, 15, 6, 14, 10, 13, 9], 'fox', 'rabbit'), []);
  // 4×4에서 여우(0)가 토끼(6, 다른 색)를 쫓는다. 5번이면 잡을 수 있는데 처음에 멀어지는 쪽은 없으니, 같은 자리를 오가면 횟수가 모자란다
  const board = { w: 4, h: 4, fox: 0, rabbit: 6, first: 'fox' };
  assert.equal(winnerAt(board, [], 'fox'), 'fox');
  const wander = [1, 7, 0];
  const slips = slipsOf(board, wander, 'fox', 'fox');
  assert.equal(slips.length, 1);
  assert.equal(winnerAt(board, wander.slice(0, slips[0]), 'fox'), 'rabbit');
});

test('그림에 쓰는 따라가기: 규칙을 따지지 않고 둔 수를 그대로 따라간다(제자리도)', () => {
  const board = { w: 4, h: 4, fox: 0, rabbit: 5, first: 'fox' };
  assert.deepEqual(walk(board, [1, 5, 5], 'fox'), { fox: 5, rabbit: 5, last: { animal: 'fox', from: 1, to: 5 } });
  assert.equal(replay(board, [1, 5, 5], 'fox').ok, false);
  assert.equal(bruteReplay(board, [1, 5, 5], 'fox', { rabbitStay: true }).winner, 'fox');
});

test('작은 판: 칸이 더 적고, 둘이 같은 색인지와 먼저 움직이는 쪽이 같아서 잘 하면 이기는 쪽이 같다. 첫 수에 끝나지 않는다. 3×3에는 없다', () => {
  const boards = [];
  for (const [w, h] of [[4, 4], [4, 5], [5, 4], [5, 5]]) {
    for (const [fox, rabbit] of placesOf(w, h)) if ((fox * 7 + rabbit) % 11 === 0) for (const first of ['fox', 'rabbit', null]) boards.push({ w, h, fox, rabbit, first });
  }
  for (const board of boards) {
    const list = smallBoards(board);
    assert.ok(list.length > 0, JSON.stringify(board));
    const result = solve(board);
    for (const small of list) {
      assert.equal(checkBoard(small), null);
      assert.ok(small.w * small.h < board.w * board.h);
      assert.equal(small.first, board.first);
      assert.equal(sameColor(small.w, small.fox, small.rabbit), result.same);
      const smallResult = solve(small);
      assert.equal(smallResult.fox, result.fox);
      assert.equal(smallResult.rabbit, result.rabbit);
      for (const first of board.first ? [board.first] : ['fox', 'rabbit']) assert.notEqual(first === 'fox' ? smallResult.foxFirst : smallResult.rabbitFirst, 1);
    }
  }
  assert.deepEqual(smallBoards({ w: 3, h: 3, fox: 0, rabbit: 8, first: 'fox' }), []);
  // 잘라 낸 판이 먼저다: 4×4의 구석 둘은 3×4·4×3에 함께 들어가지 않으니 정해 둔 3×3 판이 나온다
  const corner = smallBoards({ w: 4, h: 4, fox: 0, rabbit: 15, first: 'fox' });
  assert.deepEqual(corner[0], { w: 3, h: 3, fox: 0, rabbit: 8, first: 'fox' });
  const inner = smallBoards({ w: 4, h: 4, fox: 5, rabbit: 10, first: 'fox' });
  assert.deepEqual([inner[0].w * inner[0].h], [12]);
});

function game(more = {}) {
  return { kind: 'round', id: `r-${more.id ?? 1}`, format: 'foxrabbit', outcome: 'solved', side: false, winner: 'kid', ...more };
}

test('지난 기록: 끝까지 둔 게임을 두 판 하면 "왜 그럴까?"가 열린다. 연달아 진 수는 맨 뒤에서부터 센다', () => {
  assert.equal(whyOpen([game()]), false);
  assert.equal(whyOpen([game(), game({ id: 2, winner: 'teacher' })]), true);
  // 작은 판, 다른 형식, 끝나지 않은 판은 세지 않는다
  assert.equal(finishedCount([game(), game({ id: 2, side: true }), game({ id: 3, format: 'domino' }), game({ id: 4, outcome: 'left', winner: null })]), 1);
  assert.equal(lostStreak([game(), game({ id: 2, winner: 'teacher' }), game({ id: 3, winner: 'teacher' })]), 2);
  assert.equal(lostStreak([game({ winner: 'teacher' }), game({ id: 2 })]), 0);
});
