// 민들레와 바람의 규칙과 풀이 프로그램 점검.
// 판의 규칙(꽃 심기, 바람, 끝나는 때), 풀이 프로그램이 다른 방법(tests/helpers/brute-dandelion.js)과 같은 답을 내는지,
// 선생님이 이길 수 있을 때 이기게 두는지, 혼자 덮기의 가장 적은 꽃 수, 작은 판, "왜 그럴까?"가 열리는 때를 본다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DIR_SETS,
  LIMITS,
  WHY_AFTER,
  checkBoard,
  lostStreak,
  movesOf,
  pickMove,
  randomKidWinRate,
  rayCells,
  replay,
  slipsOf,
  smallBoards,
  solve,
  solveCover,
  teacherMove,
  whyOpen,
  winnerAt,
  winningMoves,
} from '../src/core/dandelion.js';
import { createRng } from '../src/core/rng.js';
import { bruteCover, bruteGame, bruteReplay } from './helpers/brute-dandelion.js';

const game = (w, h, dirs = 4) => ({ kind: 'game', w, h, dirs });
const cover = (w, h, order, dirs = order.length) => ({ kind: 'cover', w, h, dirs, order });
const P = (cell) => ({ plant: cell });
const W = (dir) => ({ wind: dir });

/** 모든 판(규격 안의 크기와 방향의 수) */
function allGames() {
  const boards = [];
  for (const dirs of [4, 8]) {
    const max = dirs === 8 ? LIMITS.eightMax : LIMITS.max;
    for (let h = LIMITS.min; h <= max; h++) for (let w = LIMITS.min; w <= max; w++) boards.push(game(w, h, dirs));
  }
  return boards;
}

/** 넷의 모든 차례(혼자 덮기의 바람 차례) */
function orders(list) {
  if (list.length <= 1) return [list];
  return list.flatMap((item, index) => orders([...list.slice(0, index), ...list.slice(index + 1)]).map((rest) => [item, ...rest]));
}

test('판의 값: 정해진 크기와 방향의 수만 받는다', () => {
  assert.equal(checkBoard(game(3, 3)), null);
  assert.equal(checkBoard(game(5, 5)), null);
  assert.equal(checkBoard(game(4, 4, 8)), null);
  assert.equal(checkBoard(game(5, 4, 8)), 'size', '여덟 방향은 4칸까지');
  assert.equal(checkBoard(game(1, 3)), 'size');
  assert.equal(checkBoard(game(6, 3)), 'size');
  assert.equal(checkBoard(game(3, 3, 6)), 'dirs');
  assert.equal(checkBoard({ kind: 'other', w: 3, h: 3, dirs: 4 }), 'kind');
  assert.equal(checkBoard(null), 'board');
  assert.equal(checkBoard(cover(3, 3, [1, 2, 3, 0])), null);
  assert.equal(checkBoard(cover(3, 3, [1, 2, 3, 3], 4)), 'order', '방향마다 한 번씩');
  assert.equal(checkBoard(cover(3, 3, [1, 2, 3], 4)), 'order');
  assert.deepEqual(DIR_SETS[4], [0, 1, 2, 3]);
  assert.equal(DIR_SETS[8].length, 8);
});

test('씨앗은 꽃에서 그 방향으로 판 끝까지 날아간다. 꽃과 씨앗이 있는 칸도 지나가고, 씨앗은 다시 날지 않는다', () => {
  const board = game(4, 3);
  // 칸 5(둘째 줄 둘째 칸)에서 오른쪽은 6, 7, 위는 1, 오른쪽 아래는 10이다.
  assert.deepEqual(rayCells(board, 5, 1), [6, 7]);
  assert.deepEqual(rayCells(board, 5, 0), [1]);
  assert.deepEqual(rayCells(board, 5, 5), [10]);
  assert.deepEqual(rayCells(board, 0, 3), [], '왼쪽 끝 칸에서 왼쪽으로는 날아갈 칸이 없다');
  // 꽃 둘: 칸 4와 칸 6. 오른쪽으로 불면 4에서 5, 6(꽃), 7까지, 6에서 7까지 덮인다.
  const now = replay(board, [P(4), W(0), P(6), W(1)]);
  assert.equal(now.ok, true);
  assert.deepEqual(now.flowers, [4, 6]);
  assert.deepEqual(now.seeds, [0, 5, 7]);
  assert.equal(now.empty, 12 - 5);
  assert.deepEqual(now.fresh, { wind: 1, cells: [5, 7] });
  // 위로 분 바람은 둘째 꽃이 심기기 전이었다(칸 2는 덮이지 않았다). 씨앗(칸 5)은 날지 않는다.
  assert.ok(!now.seeds.includes(2));
  assert.equal(now.next, 'flower');
});

test('게임: 꽃이 먼저, 번갈아 둔다. 빈칸에만 심고, 한 번 분 방향은 다시 못 분다', () => {
  const board = game(3, 3);
  assert.equal(replay(board, []).next, 'flower');
  assert.equal(replay(board, [W(1)]).ok, false, '바람이 먼저 불 수 없다');
  assert.equal(replay(board, [P(4), P(5)]).ok, false, '꽃 쪽이 두 번 잇달아 심을 수 없다');
  assert.equal(replay(board, [P(4), W(1), P(5)]).ok, false, '씨앗이 있는 칸에는 심지 못한다');
  assert.equal(replay(board, [P(4), W(1), P(4)]).ok, false, '꽃이 있는 칸에는 심지 못한다');
  assert.equal(replay(board, [P(4), W(1), P(0), W(1)]).ok, false, '같은 방향은 한 번만');
  assert.equal(replay(board, [P(4), W(5)]).ok, false, '네 방향 판에 대각선 바람은 없다');
  assert.equal(replay(game(3, 3, 8), [P(4), W(5)]).ok, true);
  // 둘 수 있는 수: 꽃은 빈칸마다, 바람은 아직 안 분 방향마다
  assert.equal(movesOf(board, []).length, 9);
  assert.deepEqual(movesOf(board, [P(4)]), [W(0), W(1), W(2), W(3)]);
  assert.deepEqual(movesOf(board, [P(4), W(1)]).map((move) => move.plant), [0, 1, 2, 3, 6, 7, 8]);
});

test('게임이 끝나는 때: 판이 다 덮이면 그 자리에서 꽃이 이기고, 방향을 다 쓴 뒤에 빈칸이 남으면 바람이 이긴다', () => {
  // 2×2: 꽃을 심어서 마지막 빈칸이 덮여도 끝난다(바람이 불지 않는다).
  const small = game(2, 2);
  const done = replay(small, [P(0), W(0), P(3), W(3), P(1)]);
  assert.equal(done.ok, true);
  assert.equal(done.over, true);
  assert.equal(done.winner, 'flower');
  assert.equal(done.next, null);
  assert.equal(replay(small, [P(0), W(0), P(3), W(3), P(1), W(1)]).ok, false, '끝난 뒤에는 둘 수 없다');
  // 3×3에서 윗줄부터 차례로 심으면(바람은 이기는 쪽으로) 빈칸이 남는다.
  const lost = replay(game(3, 3), [P(0), W(0), P(1), W(1), P(3), W(2), P(5), W(3)]);
  assert.equal(lost.ok, true);
  assert.equal(lost.over, true);
  assert.equal(lost.winner, 'wind');
  assert.ok(lost.empty > 0);
  // 바람으로 다 덮여도 끝난다.
  const blown = replay(game(2, 2), [P(0), W(1), P(3), W(3)]);
  assert.equal(blown.winner, 'flower');
  assert.equal(blown.empty, 0);
});

test('혼자 덮기: 바람은 정해진 차례로만 불고, 바람 앞마다 꽃은 하나까지 심는다. 안 심고 불어도 된다', () => {
  const board = cover(3, 3, [1, 2, 3, 0]);
  assert.equal(replay(board, [W(2)]).ok, false, '차례가 아닌 바람');
  assert.equal(replay(board, [W(1), W(2)]).ok, true, '심지 않고 불어도 된다');
  assert.equal(replay(board, [P(0), P(4)]).ok, false, '바람 앞에 꽃 둘');
  assert.equal(replay(board, [P(0)]).planted, true);
  assert.equal(replay(board, [P(0), W(1)]).planted, false);
  assert.deepEqual(movesOf(board, [P(0)]), [W(1)]);
  assert.equal(movesOf(board, []).length, 10, '빈칸 아홉과 바람');
  // 다 덮이면 꽃이, 바람이 다 불었는데 빈칸이 남으면 바람이 이긴 것으로 적는다.
  const done = replay(board, [P(0), W(1), P(4), W(2), P(8), W(3), W(0)]);
  assert.equal(done.winner, 'flower');
  assert.deepEqual(done.flowers, [0, 4, 8]);
  const short = replay(board, [P(4), W(1), W(2), W(3), W(0)]);
  assert.equal(short.winner, 'wind');
  assert.equal(short.empty, 4, '가운데 꽃 하나는 열십자만 덮는다');
});

test('풀이 프로그램은 모든 판에서 다른 방법(글자 판, 따로 적은 규칙)과 같은 쪽이 이긴다고 한다', () => {
  for (const board of allGames()) {
    // 다른 방법은 느려서 칸이 16개 이하인 판만 견준다.
    if (board.w * board.h > 16) continue;
    const brute = bruteGame(board.w, board.h, DIR_SETS[board.dirs]).winner;
    assert.equal(solve(board).winner, brute, `${board.w}×${board.h}, ${board.dirs}방향`);
  }
  // 바람이 이기는 가장 작은 판도 다른 방법으로 다시 구한다.
  assert.equal(bruteGame(5, 3, DIR_SETS[4]).winner, 'wind');
  assert.equal(bruteGame(3, 5, DIR_SETS[4]).winner, 'wind');
});

test('잘 두면 이기는 쪽(풀이 프로그램이 모두 따진 것): 네 방향은 한 변이 5칸이고 다른 변이 3칸 이상이면 바람, 나머지는 꽃. 여덟 방향은 4×4까지 늘 꽃', () => {
  for (const board of allGames()) {
    const started = Date.now();
    const { winner, positions } = solve(board);
    const wind = board.dirs === 4 && Math.max(board.w, board.h) === 5 && Math.min(board.w, board.h) >= 3;
    assert.equal(winner, wind ? 'wind' : 'flower', `${board.w}×${board.h}, ${board.dirs}방향`);
    assert.ok(positions > 0);
    // 태블릿에서도 바로 끝나는 크기다(이 컴퓨터에서 한 판에 1초 안).
    assert.ok(Date.now() - started < 1000, `${board.w}×${board.h}, ${board.dirs}방향: ${Date.now() - started}ms`);
  }
  // 정해 둔 몇 판의 따져 본 자리의 수(같은 판이면 늘 같다)
  assert.equal(solve(game(3, 3)).positions, solve(game(3, 3)).positions);
  assert.ok(solve(game(5, 5)).positions > 100000, '5×5는 자리가 10만 개가 넘는다');
});

test('꽃이 이기는 판에서는 첫 꽃을 어디에 심어도 이기는 수다(진 판은 둘째 꽃부터의 수 때문이다)', () => {
  for (const board of allGames()) {
    if (solve(board).winner !== 'flower') continue;
    assert.equal(winningMoves(board, []).length, board.w * board.h, `${board.w}×${board.h}, ${board.dirs}방향`);
  }
  // 바람이 이기는 판에서는 첫 꽃이 어디든 진다.
  assert.deepEqual(winningMoves(game(5, 4), []), []);
});

test('이기는 수의 목록: 둔 뒤에도 그쪽이 이기는 수가 빠짐없이 들어 있다(다른 방법으로 확인)', () => {
  const rng = createRng(7);
  for (const board of [game(3, 3), game(4, 3), game(3, 3, 8), game(4, 4)]) {
    const dirs = DIR_SETS[board.dirs];
    const memo = new Map();
    for (let round = 0; round < 25; round++) {
      // 아무렇게나 몇 수를 둔 자리에서 견준다.
      let trail = [];
      const steps = Math.floor(rng() * 6);
      for (let step = 0; step < steps; step++) {
        const moves = movesOf(board, trail);
        if (moves.length === 0) break;
        trail = [...trail, moves[Math.floor(rng() * moves.length)]];
      }
      const now = replay(board, trail);
      if (now.over) continue;
      const brute = bruteReplay(board.w, board.h, dirs, trail);
      const solver = bruteGame(board.w, board.h, dirs, undefined, undefined, memo);
      const expect = movesOf(board, trail).filter((move) => {
        const next = bruteReplay(board.w, board.h, dirs, [...trail, move]);
        const win = next.winner ?? (next.next === 'flower' ? solver.flowerTurn(next.grid, next.left) : solver.windTurn(next.grid, next.left));
        return win === brute.next;
      });
      assert.deepEqual(winningMoves(board, trail), expect, JSON.stringify(trail));
      const who = brute.next === 'flower' ? solver.flowerTurn(brute.grid, brute.left) : solver.windTurn(brute.grid, brute.left);
      assert.equal(winnerAt(board, trail), who);
    }
  }
});

test('선생님이 두는 법: 이길 수 있는 자리에서는 이기는 수를, 질 자리에서는 둘 수 있는 수 가운데 하나를 둔다. 같은 값이면 늘 같은 수다', () => {
  const board = game(4, 4);
  // 4×4는 꽃이 이긴다. 선생님이 꽃이면 첫 수부터 이기는 수다.
  for (let seed = 1; seed <= 20; seed++) {
    const move = pickMove(board, [], createRng(seed));
    assert.equal(winnerAt(board, [move]), 'flower');
  }
  // 5×3은 바람이 이긴다. 선생님이 바람이면 늘 이기는 쪽으로 분다.
  const wide = game(5, 3);
  const move = pickMove(wide, [P(7)], createRng(3));
  assert.equal(winnerAt(wide, [P(7), move]), 'wind');
  // 지는 자리에서도 둘 수 있는 수를 둔다.
  assert.ok(movesOf(wide, []).some((item) => JSON.stringify(item) === JSON.stringify(pickMove(wide, [], createRng(1)))));
  // 같은 (단계, 판 번호, 아이의 쪽, 둔 수들)이면 같은 수, 끝난 판에서는 null
  const options = { level: 1, seed: 3, role: 'flower' };
  assert.deepEqual(teacherMove(board, [P(5)], options), teacherMove(board, [P(5)], options));
  assert.equal(teacherMove(game(2, 2), [P(0), W(0), P(1), W(1), P(2), W(2), P(3)], options), null);
});

test('이기는 쪽에서 이기는 수만 두면 상대가 어떻게 두어도 이긴다(시드 난수로 여러 번)', () => {
  for (const board of [game(3, 3), game(4, 4), game(5, 3), game(5, 4), game(4, 4, 8), game(3, 3, 8)]) {
    const side = solve(board).winner;
    const rng = createRng(board.w * 100 + board.h * 10 + board.dirs);
    for (let round = 0; round < 20; round++) {
      let trail = [];
      for (;;) {
        const now = replay(board, trail);
        if (now.over) {
          assert.equal(now.winner, side, `${board.w}×${board.h}`);
          break;
        }
        const move = now.next === side ? pickMove(board, trail, rng) : movesOf(board, trail)[Math.floor(rng() * movesOf(board, trail).length)];
        trail = [...trail, move];
      }
    }
  }
});

test('잘못 둔 곳: 아이가 이기는 자리에서 지는 자리로 보낸 수만 센다', () => {
  // 3×3에서 꽃(아이)이 윗줄부터 차례로 심으면 어딘가에서 지는 자리로 넘어간다(첫 수는 어디든 이기는 수다).
  const board = game(3, 3);
  const trail = [P(0), W(0), P(1), W(1), P(3), W(2), P(5), W(3)];
  assert.equal(replay(board, trail).winner, 'wind');
  const slips = slipsOf(board, trail, 'flower');
  assert.ok(slips.length >= 1);
  for (const at of slips) assert.equal(at % 2, 1, '꽃이 둔 수(홀수 번째)만 센다');
  // 바람(아이)으로 서면 그 판의 꽃 수는 세지 않는다.
  for (const at of slipsOf(board, trail, 'wind')) assert.equal(at % 2, 0);
  assert.deepEqual(slipsOf(board, [], 'flower'), []);
});

test('아무렇게나 두었을 때 아이가 이기는 비율(모든 경우를 따진 값): 3×3 꽃은 열에 다섯쯤, 4×4 꽃은 거의 진다', () => {
  const three = randomKidWinRate(game(3, 3), 'flower');
  assert.ok(three > 0.5 && three < 0.65, String(three));
  assert.equal(randomKidWinRate(game(2, 2), 'flower'), 1, '2×2는 어떻게 심어도 다 덮인다');
  const four = randomKidWinRate(game(4, 4), 'flower');
  assert.ok(four < 0.05, String(four));
  const wide = randomKidWinRate(game(5, 3), 'wind');
  assert.ok(wide > 0.2 && wide < 0.45, String(wide));
  // 시드 난수로 여러 번 두어 본 값과 가깝다(3×3).
  const rng = createRng(11);
  let wins = 0;
  const games = 400;
  for (let round = 0; round < games; round++) {
    let trail = [];
    for (;;) {
      const now = replay(game(3, 3), trail);
      if (now.over) {
        if (now.winner === 'flower') wins += 1;
        break;
      }
      const moves = movesOf(game(3, 3), trail);
      trail = [...trail, now.next === 'flower' ? moves[Math.floor(rng() * moves.length)] : pickMove(game(3, 3), trail, rng)];
    }
  }
  assert.ok(Math.abs(wins / games - three) < 0.08, `${wins / games} / ${three}`);
});

test('혼자 덮기의 가장 적은 꽃 수는, 아무 때나 심거나 건너뛰는 다른 탐색과 같다(3×3, 4×3의 모든 바람 차례와 사다리의 판)', () => {
  for (const [w, h] of [[3, 3], [4, 3], [3, 4], [2, 3]]) {
    for (const order of orders([0, 1, 2, 3])) {
      const board = cover(w, h, order);
      const solved = solveCover(board);
      assert.equal(solved.best, bruteCover(w, h, order), `${w}×${h} ${order.join('')}`);
      assert.equal(solved.possible, solved.best !== null);
      if (!solved.possible) continue;
      // 풀이가 내놓는 방법을 실제로 두면 다 덮인다.
      const trail = [];
      order.forEach((dir, index) => {
        if (index < solved.plan.length) trail.push(P(solved.plan[index]));
        trail.push(W(dir));
      });
      const kept = [];
      for (const move of trail) {
        if (replay(board, kept).over) break;
        kept.push(move);
      }
      assert.equal(replay(board, kept).winner, 'flower');
      assert.equal(replay(board, kept).flowers.length, solved.best);
    }
  }
  // 정해 둔 판들
  assert.equal(solveCover(cover(4, 4, [1, 2, 3, 0])).best, 4);
  assert.equal(bruteCover(4, 4, [1, 2, 3, 0]), 4);
  assert.equal(solveCover(cover(5, 3, [0, 1, 2, 3])).best, 3);
  assert.equal(bruteCover(5, 3, [0, 1, 2, 3]), 3);
  assert.equal(solveCover(cover(5, 3, [1, 3, 2, 0])).possible, false, '이 차례로는 5×3을 덮을 수 없다');
  assert.equal(bruteCover(5, 3, [1, 3, 2, 0]), null);
  assert.equal(solveCover(cover(4, 4, [1, 5, 2, 6, 3, 7, 0, 4])).best, 2);
  assert.equal(solveCover(cover(3, 3, [1, 5, 2, 6, 3, 7, 0, 4])).best, 1, '여덟 방향 3×3은 가운데 한 송이');
});

test('작은 판: 같은 방향 수의, 칸이 더 적은 판. 게임은 이기는 쪽이 같고, 혼자 덮기는 덮을 수 있다', () => {
  const list = smallBoards(game(4, 4));
  assert.ok(list.length > 0);
  for (const small of list) {
    assert.equal(checkBoard(small), null);
    assert.ok(small.w * small.h < 16 && small.w <= 4 && small.h <= 4);
    assert.equal(solve(small).winner, 'flower');
  }
  // 칸이 많은 것부터
  const sizes = list.map((item) => item.w * item.h);
  assert.deepEqual(sizes, sizes.slice().sort((a, b) => b - a));
  // 5×4(바람)는 5×3만, 5×3과 3×5(바람이 이기는 가장 작은 판)는 없다.
  assert.deepEqual(smallBoards(game(5, 4)).map((item) => `${item.w}×${item.h}`), ['5×3']);
  assert.deepEqual(smallBoards(game(5, 3)), []);
  assert.deepEqual(smallBoards(game(2, 2)), []);
  for (const small of smallBoards(cover(4, 4, [1, 2, 3, 0]))) {
    const solved = solveCover(small);
    assert.ok(solved.possible && solved.best >= 2);
    assert.deepEqual(small.order, [1, 2, 3, 0]);
  }
});

/** 끝까지 둔 게임의 기록 하나 */
const finished = (more = {}) => ({ kind: 'round', format: 'dandelion', id: `r-${Math.random()}`, mode: 'game', outcome: 'solved', winner: 'kid', ...more });

test('"왜 그럴까?"는 게임을 두 판 끝까지 둔 뒤에 열린다(임시). 연달아 진 판은 맨 뒤에서부터 센다', () => {
  assert.equal(WHY_AFTER, 2);
  assert.equal(whyOpen([]), false);
  assert.equal(whyOpen([finished()]), false);
  assert.equal(whyOpen([finished(), finished({ winner: 'teacher' })]), true);
  // 작은 판, 혼자 덮기, 그만둔 판, 다른 형식은 세지 않는다.
  assert.equal(whyOpen([finished(), finished({ side: true })]), false);
  assert.equal(whyOpen([finished(), finished({ mode: 'cover', winner: undefined })]), false);
  assert.equal(whyOpen([finished(), finished({ outcome: 'left', winner: null })]), false);
  assert.equal(whyOpen([finished(), finished({ format: 'duel' })]), false);
  assert.equal(lostStreak([finished(), finished({ winner: 'teacher' }), finished({ winner: 'teacher' })]), 2);
  assert.equal(lostStreak([finished({ winner: 'teacher' }), finished()]), 0);
  assert.equal(lostStreak([finished({ winner: 'teacher' }), finished({ outcome: 'left', winner: null })]), 1, '그만둔 판은 건너뛴다');
});
