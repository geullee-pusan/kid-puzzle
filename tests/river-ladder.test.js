// 강 건너기의 사다리와 판 내기 점검. 낸 판은 풀이 프로그램과 다른 방법으로 다시 확인하고,
// 공통 규격(첫 판은 실패할 수 없다, 처음 만나는 안 되는 판은 쉽다, 안 되는 판은 셋에 하나쯤, 연달아 나오지 않는다)을 본다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LADDER, MAKE_LEVEL, SMALL_BOARD, TOP_LEVEL, boardOf, generateBoard, nextSeed, rungOf, solveOnce } from '../src/core/river-ladder.js';
import { checkBoard, isDone, movesOf, reachable, replay, solve, startState } from '../src/core/river.js';
import { bruteRiver } from './helpers/brute-river.js';

const playing = LADDER.filter((rung) => rung.mode !== 'make');
const madeAll = (level) => rungOf(level).boards.map((_, index) => generateBoard(level, index + 1));

test('사다리: 여섯 단계이고 표시는 기본·응용·응용·도전·도전·도전, 맨 위는 직접 만들기', () => {
  assert.deepEqual(LADDER.map((rung) => rung.level), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(LADDER.map((rung) => rung.tag), ['basic', 'applied', 'applied', 'challenge', 'challenge', 'challenge']);
  assert.deepEqual(LADDER.map((rung) => rung.mode), ['maybe', 'maybe', 'fewest', 'maybe', 'cross', 'make']);
  // 기획 문서의 차례: 무거운 하나와 가벼운 둘 → 함께 두면 안 되는 셋 → 짝끼리만 있을 수 있는 세 쌍 → 네 쌍과 셋이 타는 배 → 가운데 섬
  assert.deepEqual(LADDER.map((rung) => rung.story), ['weight', 'pets', 'pairs', 'pairs', 'island', null]);
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  assert.throws(() => rungOf(7));
  assert.throws(() => generateBoard(MAKE_LEVEL, 1));
});

test('단계마다 정해 둔 판: 이야기의 차례대로', () => {
  const at = (level) => madeAll(level).map((item) => item.board);
  // 1단계의 첫 판은 코끼리 하나와 생쥐 둘이다.
  assert.deepEqual(at(1)[0], { kind: 'weight', heavy: 1, light: 2 });
  // 2단계의 첫 판은 강아지, 고양이, 생선이고 배에는 할머니와 하나가 탄다.
  assert.deepEqual(at(2)[0], { kind: 'pets', pets: ['dog', 'cat', 'fish'], seats: 2 });
  // 3단계에는 둘이 타는 배의 세 쌍이 있다. 4단계의 첫 판은 네 쌍과 셋이 타는 배다. 5단계는 섬이 있는 강이다.
  assert.ok(at(3).some((board) => board.pairs === 3 && board.seats === 2 && !board.island));
  assert.deepEqual(at(4)[0], { kind: 'pairs', pairs: 4, seats: 3, island: false });
  for (const board of at(5)) assert.deepEqual([board.island, board.seats], [true, 2]);
  assert.ok(at(5).some((board) => board.pairs === 4));
  assert.deepEqual(boardOf('island', [4, 2]), { kind: 'pairs', pairs: 4, seats: 2, island: true });
});

test('같은 번호는 늘 같은 판이고, 판마다 풀이 프로그램의 결과가 붙어 있다. 다른 방법으로 다시 구해도 같다', () => {
  for (const rung of playing) {
    for (let seed = 1; seed <= 2 * rung.boards.length; seed++) {
      const made = generateBoard(rung.level, seed);
      const where = `${rung.level}단계 ${seed}번`;
      assert.deepEqual(made, generateBoard(rung.level, seed), where);
      assert.deepEqual([made.level, made.seed, made.small], [rung.level, seed, false], where);
      assert.equal(checkBoard(made.board), null, where);
      const solved = solve(made.board);
      assert.deepEqual(made.solution, { possible: solved.possible, min: solved.min, moves: solved.moves }, where);
      const brute = bruteRiver(made.board);
      assert.deepEqual([made.solution.possible, made.solution.min], [brute.possible, brute.min], where);
      if (made.solution.possible) {
        const played = replay(made.board, made.solution.moves);
        assert.ok(played.ok && isDone(made.board, played.state), where);
      }
    }
  }
  // 한 번 푼 판은 적어 둔다(같은 판은 같은 결과).
  assert.equal(solveOnce({ kind: 'weight', heavy: 1, light: 2 }), solveOnce({ kind: 'weight', heavy: 1, light: 2 }));
});

test('"새 판"은 늘 다른 판이고, 다 돌면 다시 처음부터 돈다', () => {
  for (const rung of playing) {
    const count = rung.boards.length;
    assert.ok(count >= 2);
    for (let seed = 1; seed <= 3 * count; seed++) {
      const next = nextSeed(rung.level, seed);
      assert.equal(next, seed + 1);
      assert.notDeepEqual(generateBoard(rung.level, next).board, generateBoard(rung.level, seed).board, `${rung.level}단계 ${seed}번 다음`);
      assert.deepEqual(generateBoard(rung.level, seed + count).board, generateBoard(rung.level, seed).board, `${rung.level}단계 ${seed}번`);
    }
  }
  assert.throws(() => nextSeed(9, 1));
});

test('형식의 첫 판은 실패할 수 없다: 되는 판이고, 어디로 가도 처음 모습으로 되돌아올 수 있다', () => {
  const first = generateBoard(1, 1);
  assert.deepEqual(first.board, { kind: 'weight', heavy: 1, light: 2 });
  assert.equal(first.solution.possible, true);
  assert.equal(first.solution.min, 5);
  // 갈 수 있는 모든 모습에서 할 수 있는 움직임이 있다(막히는 모습이 없다).
  const seen = new Set();
  const stack = [startState(first.board)];
  while (stack.length > 0) {
    const state = stack.pop();
    const key = JSON.stringify(state);
    if (seen.has(key)) continue;
    seen.add(key);
    const moves = movesOf(first.board, state);
    if (!isDone(first.board, state)) assert.ok(moves.length > 0, key);
    for (const move of moves) stack.push({ at: state.at.map((place, id) => (move.who.includes(id) ? move.to : place)), boat: move.to });
  }
  assert.equal(seen.size, reachable(first.board));
  // 수준 맞추기가 "작은 판부터"라고 하면 맨 아래 단계에서는 늘 그 판을 낸다. 다른 단계에서는 그대로다.
  assert.deepEqual(SMALL_BOARD, [1, 2]);
  for (const seed of [1, 2, 3, 7]) {
    assert.deepEqual(generateBoard(1, seed, { small: true }).board, first.board);
    assert.equal(generateBoard(1, seed, { small: true }).small, true);
    assert.deepEqual(generateBoard(2, seed, { small: true }).board, generateBoard(2, seed).board);
  }
});

test('안 되는 판이 섞이는 단계(1, 2, 4단계): 셋에 하나이고, 연달아 나오지 않고, 처음 만나는 판은 되는 판이다', () => {
  for (const level of [1, 2, 4]) {
    const made = madeAll(level);
    const impossible = made.filter((item) => !item.solution.possible);
    assert.equal(impossible.length * 3, made.length, `${level}단계`);
    assert.equal(made[0].solution.possible, true, `${level}단계: 처음 만나는 판은 되는 판`);
    made.forEach((item, index) => {
      const next = made[(index + 1) % made.length];
      assert.ok(item.solution.possible || next.solution.possible, `${level}단계 ${index + 1}번`);
    });
  }
  // 1단계의 안 되는 판: 생쥐가 하나뿐인 판. 맨 처음 만나는 안 되는 판(셋째 판)은 동물이 둘뿐인 가장 작은 판이다.
  assert.deepEqual(madeAll(1).map((item) => item.solution.possible), [true, true, false, true, false, true]);
  assert.deepEqual(madeAll(1)[2].board, { kind: 'weight', heavy: 1, light: 1 });
  assert.equal(reachable(madeAll(1)[2].board), 3);
  // 2단계의 안 되는 판: 어느 동물을 태워도 남는 둘이 싸우는 판. 배가 한 번도 떠나지 못한다.
  for (const item of madeAll(2).filter((entry) => !entry.solution.possible)) assert.equal(reachable(item.board), 1, JSON.stringify(item.board));
  // 4단계의 안 되는 판: 둘이 타는 배의 네 쌍과 다섯 쌍
  assert.deepEqual(
    madeAll(4)
      .filter((item) => !item.solution.possible)
      .map((item) => [item.board.pairs, item.board.seats]),
    [[4, 2], [5, 2]],
  );
});

test('가장 적게(3단계)와 섬(5단계)의 판은 모두 되는 판이다. 가장 적은 횟수', () => {
  const mins = (level) => madeAll(level).map((item) => item.solution.min);
  assert.deepEqual(mins(1), [5, 9, null, 7, null, 11]);
  assert.deepEqual(mins(2), [7, 7, null, 5, 5, null]);
  assert.deepEqual(mins(3), [5, 11, 5, 11]);
  assert.deepEqual(mins(4), [9, null, 11, 5, null, 7]);
  assert.deepEqual(mins(5), [11, 16, 21]);
  // 섬이 있는 네 쌍과 다섯 쌍은 섬이 없으면 안 되는 판이다.
  for (const item of madeAll(5).filter((entry) => entry.board.pairs >= 4)) assert.equal(solve({ ...item.board, island: false }).possible, false);
});
