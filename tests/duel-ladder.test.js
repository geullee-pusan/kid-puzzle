// 누가 이길까의 사다리와 판 내기.
// 판 번호마다 판이 정해지는지, 판마다 붙은 "이기는 쪽"이 풀이 프로그램과 다른 탐색 모두와 맞는지,
// 먼저 두는 쪽이 이기는 판과 나중에 두는 쪽이 이기는 판이 단계마다 어떤 비율로 섞이는지를 본다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LADDER, MAKE_LEVEL, SECOND_RATE, TOP_LEVEL, generateBoard, nextSeed, opensFixed, rungOf } from '../src/core/duel-ladder.js';
import { applyMove, boardKey, checkBoard, gameOf, isOver, movesOf, randomKidWinRate, solve, startState, teacherMove, turnOf, winnerOf } from '../src/core/duel.js';
import { createRng, randInt } from '../src/core/rng.js';
import { bruteLengths, bruteWin, fromBoard } from './helpers/brute-duel.js';

const SEEDS = 400;
const boards = (level, count = SEEDS) => Array.from({ length: count }, (_, index) => generateBoard(level, index + 1));
const firstRate = (level) => boards(level).filter((made) => made.solution.first).length / SEEDS;

test('사다리: 다섯 단계이고 맨 위는 직접 만들기다. 표시는 기본·응용·응용·도전·도전이다', () => {
  assert.deepEqual(LADDER.map((rung) => rung.level), [1, 2, 3, 4, 5]);
  assert.deepEqual(LADDER.map((rung) => rung.game), ['choco', 'one', 'two', 'three', 'make']);
  assert.deepEqual(LADDER.map((rung) => rung.tag), ['basic', 'applied', 'applied', 'challenge', 'challenge']);
  assert.equal(TOP_LEVEL, 4);
  assert.equal(MAKE_LEVEL, 5);
  assert.equal(rungOf(3).game, 'two');
  assert.throws(() => rungOf(6));
  assert.throws(() => generateBoard(MAKE_LEVEL, 1));
});

test('같은 (단계, 판 번호)는 늘 같은 판이다. 판마다 풀이 프로그램으로 푼 결과가 붙어 있다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (let seed = 1; seed <= 60; seed++) {
      const made = generateBoard(level, seed);
      assert.deepEqual(generateBoard(level, seed), made, `${level}단계 ${seed}번`);
      assert.equal(checkBoard(made.board), null, `${level}단계 ${seed}번`);
      assert.equal(gameOf(made.board), rungOf(level).game, `${level}단계 ${seed}번`);
      assert.deepEqual(made.solution, solve(made.board), `${level}단계 ${seed}번`);
      assert.equal(made.solution.winner, made.solution.first ? 'first' : 'second');
      // 다른 탐색(규칙을 따로 적고, 자리를 묶지 않는다)으로 다시 풀어도 같다.
      const { kind, max, state } = fromBoard(made.board);
      assert.equal(made.solution.first, bruteWin(kind, max, state), `${level}단계 ${seed}번(다른 탐색)`);
      assert.equal(made.level, level);
      assert.equal(made.seed, seed);
    }
  }
});

test('1단계: 초콜릿 쪼개기의 작은 판 다섯 가지. 어느 쪽이 이기는지는 칸의 수의 홀짝에 달렸다', () => {
  const sizes = new Set(boards(1, 40).map((made) => [made.board.w, made.board.h].sort().join('×')));
  assert.deepEqual([...sizes].sort(), ['2×2', '2×3', '2×4', '3×3', '3×4']);
  for (const made of boards(1, 40)) {
    const cells = made.board.w * made.board.h;
    assert.equal(made.solution.first, cells % 2 === 0, boardKey(made.board));
    // 어떻게 쪼개도 (칸의 수 − 1)번에 끝난다(모든 차례를 따진다).
    assert.deepEqual([...bruteLengths('choco', Infinity, [[made.board.w, made.board.h]])], [cells - 1], boardKey(made.board));
  }
  // 차례는 열 판이고, 이웃한 두 판은 늘 다르다(맨 끝과 맨 처음도 다르다).
  const cycle = rungOf(1).boards;
  assert.equal(cycle.length, 10);
  cycle.forEach((entry, index) => assert.notDeepEqual(entry, cycle[(index + 1) % cycle.length]));
  assert.deepEqual(generateBoard(1, 11).board, generateBoard(1, 1).board);
  // 3×3만 나중에 두는 쪽이 이긴다. 열 판 가운데 세 판이다.
  assert.equal(firstRate(1), 0.7);
  assert.deepEqual(boards(1, 10).map((made) => made.solution.first), [true, true, false, true, true, true, false, true, true, false]);
});

test('형식의 맨 첫 판은 실패할 수 없다: 2×2이고, 고르기 없이 아이가 먼저 두면 어떻게 두어도 아이가 마지막 조각을 쪼갠다', () => {
  assert.equal(opensFixed(1, 1), true);
  assert.equal(opensFixed(1, 2), false);
  assert.equal(opensFixed(2, 1), false);
  const first = generateBoard(1, 1);
  assert.deepEqual(first.board, { kind: 'choco', w: 2, h: 2 });
  assert.equal(first.solution.first, true);
  assert.equal(randomKidWinRate(first.board, true), 1);
  // 아이가 둘 수 있는 모든 차례를 따져 본다. 선생님은 앱에서 두는 대로 둔다.
  let plays = 0;
  const walk = (trail, state) => {
    if (isOver(first.board, state)) {
      assert.equal(trail.length, 3);
      assert.equal(winnerOf('kid', trail.length), 'kid');
      plays += 1;
      return;
    }
    const moves = turnOf('kid', trail.length) === 'kid' ? movesOf(first.board, state) : [teacherMove(first.board, trail, { level: 1, seed: 1, first: 'kid' })];
    for (const move of moves) walk([...trail, move], applyMove(first.board, state, move));
  };
  walk([], startState(first.board));
  assert.equal(plays, 2);
  // 수준 맞추기가 "작은 판부터"라고 하면 1단계는 늘 가장 작은 판(2×2)이다.
  for (const seed of [2, 3, 7]) assert.deepEqual(generateBoard(1, seed, { small: true }).board, { kind: 'choco', w: 2, h: 2 });
});

test('2단계: 한 더미. 돌 5~20개, 한 번에 1~2개 또는 1~3개. 먼저 두는 쪽이 이기는 판과 나중에 두는 쪽이 이기는 판이 반반쯤 섞인다', () => {
  const made = boards(2);
  const takes = new Set();
  const counts = new Set();
  for (const { board, solution } of made) {
    assert.equal(board.kind, 'one');
    assert.ok(board.n >= 5 && board.n <= 20, `돌 ${board.n}개`);
    assert.ok(board.max === 2 || board.max === 3, `한 번에 ${board.max}개까지`);
    // 지름길 규칙과 견준다: 나머지가 0이면 나중에 두는 쪽이 이긴다.
    assert.equal(solution.first, board.n % (board.max + 1) !== 0, boardKey(board));
    takes.add(board.max);
    counts.add(board.n);
  }
  assert.deepEqual([...takes].sort(), [2, 3]);
  assert.equal(counts.size, 16, '5개부터 20개까지 모두 나온다');
  assert.equal(SECOND_RATE, 1 / 2);
  const rate = firstRate(2);
  assert.ok(rate > 0.42 && rate < 0.58, `먼저 두는 쪽이 이기는 판 ${rate}`);
});

test('3단계: 두 더미. 더미마다 2~8개. 같은 두 더미(나중이 이긴다)와 다른 두 더미(먼저가 이긴다)가 섞인다', () => {
  const made = boards(3);
  for (const { board, solution } of made) {
    assert.equal(board.kind, 'piles');
    assert.equal(board.piles.length, 2);
    for (const count of board.piles) assert.ok(count >= 2 && count <= 8, `더미에 ${count}개`);
    assert.equal(solution.first, board.piles[0] !== board.piles[1], boardKey(board));
  }
  // 같은 두 더미는 일곱 가지(2개부터 8개까지)가 모두 나온다.
  assert.equal(new Set(made.filter((item) => !item.solution.first).map((item) => item.board.piles[0])).size, 7);
  const rate = firstRate(3);
  assert.ok(rate > 0.42 && rate < 0.58, `먼저 두는 쪽이 이기는 판 ${rate}`);
});

test('4단계: 세 더미. 더미마다 1~7개. 나중에 두는 쪽이 이기는 판이 반쯤 되게 일부러 맞춘다', () => {
  const made = boards(4);
  for (const { board, solution } of made) {
    assert.equal(board.kind, 'piles');
    assert.equal(board.piles.length, 3);
    for (const count of board.piles) assert.ok(count >= 1 && count <= 7, `더미에 ${count}개`);
    const [a, b, c] = board.piles;
    assert.equal(solution.first, (a ^ b ^ c) !== 0, boardKey(board));
  }
  const rate = firstRate(4);
  assert.ok(rate > 0.42 && rate < 0.58, `먼저 두는 쪽이 이기는 판 ${rate}`);
  // 일부러 맞추지 않으면 나중에 두는 쪽이 이기는 판은 343가지 가운데 42가지뿐이다(여덟에 하나쯤).
  assert.ok(42 / 343 < 0.13);
});

test('단계마다 처음 여섯 판 안에 두 가지 판(먼저가 이기는 판, 나중이 이기는 판)이 모두 나온다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    const seen = new Set(boards(level, 6).map((made) => made.solution.first));
    assert.equal(seen.size, 2, `${level}단계`);
  }
});

test('"새 판"은 방금 한 판과 다른 판이다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    let seed = 1;
    for (let step = 0; step < 60; step++) {
      const next = nextSeed(level, seed);
      assert.ok(next > seed);
      assert.notDeepEqual(generateBoard(level, next).board, generateBoard(level, seed).board, `${level}단계 ${seed}번 → ${next}번`);
      seed = next;
    }
  }
  // 작은 판만 내는 동안에는 판이 하나뿐이라 그냥 다음 번호다.
  assert.equal(nextSeed(1, 3, { small: true }), 4);
  assert.throws(() => nextSeed(9, 1));
});

test('아이가 아무렇게나 두었을 때(이기는 쪽을 골랐다고 하고) 이기는 비율: 초콜릿은 늘 이기고, 돌 게임은 드물게 이긴다', () => {
  const mean = (level) => {
    const rates = boards(level, 200).map((made) => randomKidWinRate(made.board, made.solution.first));
    return rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
  };
  assert.equal(mean(1), 1);
  // 돌 게임은 한 번이라도 잘못 두면 선생님이 뒤집는다. 그래서 찍어서는 거의 못 이긴다.
  for (const level of [2, 3, 4]) {
    const rate = mean(level);
    assert.ok(rate > 0.02 && rate < 0.2, `${level}단계 ${rate.toFixed(3)}`);
  }
  // 지는 쪽을 고르면 어느 단계에서나 0이다.
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const made of boards(level, 40)) assert.equal(randomKidWinRate(made.board, !made.solution.first), 0, boardKey(made.board));
  }
});

test('만들어 낸 판을 실제로 두어 본다: 이기는 쪽에서 이기는 수만 두면 이기고, 지는 쪽에서는 아무렇게나 두어도 진다', () => {
  const rng = createRng(5);
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (let seed = 1; seed <= 25; seed++) {
      const { board, solution } = generateBoard(level, seed);
      for (const kidOnWinningSide of [true, false]) {
        const first = solution.first === kidOnWinningSide ? 'kid' : 'teacher';
        const trail = [];
        let state = startState(board);
        while (!isOver(board, state)) {
          let move;
          if (turnOf(first, trail.length) === 'teacher') move = teacherMove(board, trail, { level, seed, first });
          else {
            const moves = movesOf(board, state);
            // 이기는 수: 상대를 지는 자리로 보내는 수(다른 탐색으로 고른다)
            const winning = moves.filter((item) => !bruteWinAfter(board, state, item));
            move = kidOnWinningSide ? winning[0] : moves[randInt(rng, 0, moves.length - 1)];
          }
          state = applyMove(board, state, move);
          trail.push(move);
        }
        assert.equal(winnerOf(first, trail.length), kidOnWinningSide ? 'kid' : 'teacher', `${level}단계 ${seed}번`);
      }
    }
  }
});

/** 이 수를 둔 다음의 자리가 상대에게 이기는 자리인가(다른 탐색으로 따진다) */
function bruteWinAfter(board, state, move) {
  const next = applyMove(board, state, move);
  const { kind, max } = fromBoard(board);
  return bruteWin(kind, max, board.kind === 'choco' ? next.map((piece) => [piece.w, piece.h]) : next);
}
