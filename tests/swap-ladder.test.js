// 자리 바꾸기의 사다리와 판 내기 점검. 낸 판은 풀이 프로그램으로 다시 확인하고,
// "좋은 판"의 기준(가장 뻔한 요령인 아무렇게나 움직이기가 막히는가)을 판마다 잰다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LADDER, MAKE_LEVEL, OLD_MAKE_LEVEL, PAIR_SKIP, PILE_SKIP, TOP_LEVEL, generateBoard, nextSeed, rungOf, solveOnce } from '../src/core/swap-ladder.js';
import { checkBoard, randomFinishRate, replay, isDone, solve } from '../src/core/swap.js';
import { bruteCarry, brutePiles } from './helpers/brute-swap.js';

const playing = LADDER.filter((rung) => rung.mode !== 'make');
const fresh = new Map();
/** 풀이 프로그램을 적어 둔 것 없이 다시 돌린다(같은 판은 한 번만) */
function solvedFresh(board) {
  const key = JSON.stringify(board);
  if (!fresh.has(key)) fresh.set(key, solve(board));
  return fresh.get(key);
}

test('사다리: 일곱 단계이고 표시는 기본·응용·응용·도전·응용·도전·도전, 맨 위는 직접 만들기', () => {
  assert.deepEqual(LADDER.map((rung) => rung.level), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(LADDER.map((rung) => rung.tag), ['basic', 'applied', 'applied', 'challenge', 'applied', 'challenge', 'challenge']);
  assert.deepEqual(LADDER.map((rung) => rung.mode), ['frogs', 'frogs', 'fewest', 'pairs', 'carry', 'threes', 'make']);
  // 1~4단계의 번호는 그대로이고, 직접 만들기는 5단계에서 7단계로 옮겼다(예전 번호는 OLD_MAKE_LEVEL로 받는다).
  assert.deepEqual([TOP_LEVEL, MAKE_LEVEL, OLD_MAKE_LEVEL], [6, 7, 5]);
  assert.equal(PAIR_SKIP, 2);
  assert.equal(PILE_SKIP, 3);
  assert.throws(() => rungOf(8));
  assert.throws(() => generateBoard(MAKE_LEVEL, 1));
});

test('단계마다 정해 둔 판: 1단계는 작은 판, 2단계는 큰 판, 3단계는 2와 2부터 4와 4까지, 4단계는 돌 4~12개', () => {
  const sorted = (level) => rungOf(level).boards.map((entry) => [].concat(entry).join('-')).sort();
  assert.deepEqual(sorted(1), ['1-1', '1-2', '2-1', '2-2']);
  assert.deepEqual(sorted(2), ['2-3', '3-2', '3-3', '3-4', '4-3']);
  assert.deepEqual(sorted(3), ['2-2', '2-3', '3-2', '3-3', '3-4', '4-3', '4-4']);
  assert.deepEqual(sorted(4), ['10', '10', '12', '4', '6', '8']);
  assert.deepEqual(sorted(5), ['10', '12', '14', '6', '8']);
  assert.deepEqual(sorted(6), ['12', '12', '15', '15', '6', '9']);
  // 차례의 맨 앞: 1단계는 1마리와 1마리, 3단계는 2마리와 2마리, 4단계는 되는 판(8개)
  assert.deepEqual(rungOf(1).boards[0], [1, 1]);
  assert.deepEqual(rungOf(2).boards[0], [3, 2]);
  assert.deepEqual(rungOf(3).boards[0], [2, 2]);
  assert.equal(rungOf(4).boards[0], 8);
  // 좌우를 뒤집은 판은 차례의 뒤쪽에 있다(먼저 만나는 판은 왼쪽이 많거나 같은 판이다).
  for (const level of [1, 2, 3]) {
    const boards = rungOf(level).boards;
    const firstMirror = boards.findIndex(([left, right]) => left < right);
    assert.ok(firstMirror > 0, `${level}단계`);
    for (const [left, right] of boards.slice(0, firstMirror)) assert.ok(left >= right, `${level}단계`);
  }
});

test('같은 번호는 늘 같은 판이고, 판마다 풀이 프로그램의 결과가 붙어 있다', () => {
  for (const rung of playing) {
    for (let seed = 1; seed <= 30; seed++) {
      const made = generateBoard(rung.level, seed);
      const where = `${rung.level}단계 ${seed}번`;
      assert.deepEqual(made, generateBoard(rung.level, seed), where);
      assert.deepEqual([made.level, made.seed, made.small], [rung.level, seed, false], where);
      assert.equal(checkBoard(made.board), null, where);
      assert.equal(made.board.kind, { pairs: 'pairs', threes: 'pairs', carry: 'carry' }[rung.mode] ?? 'frogs', where);
      assert.equal(made.board.group, rung.mode === 'threes' ? 3 : undefined, where);
      // 같은 판은 한 번만 다시 푼다(셋씩 쌓기의 돌 15개 판은 모습이 40만 가지쯤이다).
      const solved = solvedFresh(made.board);
      assert.deepEqual(made.solution, { possible: solved.possible, min: solved.min, moves: solved.moves }, where);
      if (made.solution.possible) {
        const played = replay(made.board, made.solution.moves);
        assert.ok(played.ok && isDone(made.board, played.cells), where);
      }
    }
  }
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
    // 한 바퀴를 돌면 정해 둔 판이 모두 나온다.
    const seen = new Set(Array.from({ length: count }, (_, index) => JSON.stringify(generateBoard(rung.level, index + 1).board)));
    assert.equal(seen.size, new Set(rung.boards.map((entry) => JSON.stringify(entry))).size, `${rung.level}단계`);
  }
  assert.throws(() => nextSeed(9, 1));
});

test('1~3단계의 판은 모두 되는 판이고, 가장 적은 횟수는 곱 더하기 합이다', () => {
  for (const level of [1, 2, 3]) {
    for (let seed = 1; seed <= rungOf(level).boards.length; seed++) {
      const { board, solution } = generateBoard(level, seed);
      assert.equal(solution.possible, true);
      assert.equal(solution.min, board.left * board.right + board.left + board.right, `${level}단계 ${seed}번`);
    }
  }
  // 3단계의 가장 적은 횟수: 8번부터 24번까지
  const mins = rungOf(3).boards.map((_, index) => generateBoard(3, index + 1).solution.min);
  assert.deepEqual(mins, [8, 11, 15, 19, 24, 11, 19]);
});

test('형식의 첫 판은 실패할 수 없다: 1단계의 첫 판은 아무렇게나 움직여도 끝까지 간다', () => {
  const first = generateBoard(1, 1);
  assert.deepEqual(first.board, { kind: 'frogs', left: 1, right: 1 });
  assert.equal(randomFinishRate(first.board), 1);
  assert.equal(first.solution.min, 3);
  // 수준 맞추기가 "작은 판부터"라고 하면 맨 아래 단계에서는 늘 그 판을 낸다. 다른 단계에서는 그대로다.
  for (const seed of [1, 2, 3, 7]) {
    assert.deepEqual(generateBoard(1, seed, { small: true }).board, first.board);
    assert.equal(generateBoard(1, seed, { small: true }).small, true);
    assert.deepEqual(generateBoard(2, seed, { small: true }).board, generateBoard(2, seed).board);
  }
});

test('좋은 판: 아무렇게나 움직였을 때 끝까지 가는 비율. 1단계는 높아도 되고, 그 위는 뻔한 요령이 막힌다', () => {
  const rates = (level) => rungOf(level).boards.map((_, index) => randomFinishRate(generateBoard(level, index + 1).board));
  // 세어 본 값. 1단계: 1마리와 1마리 100%, 2와 1(1과 2) 75%, 2와 2 12.5%
  assert.deepEqual(rates(1), [1, 0.75, 0.125, 0.75]);
  // 2단계: 3과 2 약 3.1%, 3과 3 약 0.39%, 4와 3 약 0.049%
  assert.deepEqual(rates(2), [0.03125, 0.00390625, 0.00048828125, 0.03125, 0.00048828125]);
  // 3단계: 2와 2 12.5%부터 4와 4 약 0.003%까지
  assert.deepEqual(rates(3), [0.125, 0.03125, 0.00390625, 0.00048828125, 0.000030517578125, 0.03125, 0.00048828125]);
  for (const level of [2, 3]) for (const rate of rates(level)) assert.ok(rate > 0 && rate <= 0.125, `${level}단계: ${rate}`);
  // 4단계: 되는 판도 아무렇게나 얹으면 거의 막힌다(8개 약 3.3%, 10개 약 0.71%, 12개 약 0.99%). 안 되는 판은 0이다.
  const four = rates(4);
  assert.deepEqual(four.map((rate) => Math.round(rate * 10000) / 10000), [0.0333, 0, 0.0071, 0.0099, 0, 0.0071]);
});

test('4단계: 되는 판과 안 되는 판이 섞인다. 안 되는 판은 셋에 하나이고, 처음 만나는 안 되는 판은 가장 작은 판이다', () => {
  const rung = rungOf(4);
  const made = rung.boards.map((_, index) => generateBoard(4, index + 1));
  for (const { board } of made) assert.deepEqual([board.kind, board.skip], ['pairs', PAIR_SKIP]);
  const impossible = made.filter((item) => !item.solution.possible);
  assert.equal(impossible.length * 3, made.length);
  assert.equal(made[0].solution.possible, true, '처음 만나는 판은 되는 판');
  assert.deepEqual(made.map((item) => item.solution.possible), [true, false, true, true, false, true]);
  assert.equal(impossible[0].board.n, Math.min(...impossible.map((item) => item.board.n)));
  // 되는 판은 돌의 수의 절반만큼 얹으면 끝난다.
  for (const item of made) if (item.solution.possible) assert.equal(item.solution.min, item.board.n / 2);
  // 안 되는 판이 연달아 나오지 않는다(한 바퀴를 돌아 이어지는 곳까지).
  made.forEach((item, index) => {
    const next = made[(index + 1) % made.length];
    assert.ok(item.solution.possible || next.solution.possible, `${index + 1}번`);
  });
});

test('5단계(둘씩 묶어 옮기기): 모두 되는 판이고, 가장 적은 횟수는 돌 8개부터 짝 수만큼, 6개는 4번이다. 다른 방법으로 구해도 같다', () => {
  const made = rungOf(5).boards.map((_, index) => generateBoard(5, index + 1));
  assert.deepEqual(made.map((item) => item.board), [8, 10, 6, 12, 14].map((n) => ({ kind: 'carry', n })));
  assert.deepEqual(made.map((item) => item.solution.min), [4, 5, 4, 6, 7]);
  for (const { board, solution } of made) {
    assert.equal(solution.possible, true);
    assert.equal(bruteCarry(board.n).min, solution.min, `돌 ${board.n}개`);
    if (board.n >= 8) assert.equal(solution.min, board.n / 2, '짝 수만큼');
  }
  // 처음 만나는 두 판(8개, 10개)은 짝 수와 횟수가 맞는 판이다. 6개 판은 셋째에 온다.
  assert.deepEqual(made.slice(0, 2).map((item) => item.solution.min * 2 === item.board.n), [true, true]);
  assert.equal(made[2].board.n, 6);
});

test('6단계(셋씩 쌓기): 셋을 건너뛴다. 안 되는 판은 셋에 하나이고, 연달아 나오지 않고, 처음 만나는 안 되는 판은 가장 작은 판이다', () => {
  const made = rungOf(6).boards.map((_, index) => generateBoard(6, index + 1));
  for (const { board } of made) assert.deepEqual([board.kind, board.skip, board.group], ['pairs', PILE_SKIP, 3]);
  assert.deepEqual(made.map((item) => item.solution.possible), [true, false, true, true, false, true]);
  for (const { board, solution } of made) {
    assert.equal(brutePiles(board.n, board.skip, 3).possible, solution.possible, `돌 ${board.n}개`);
    if (solution.possible) assert.equal(solution.min, (2 * board.n) / 3);
  }
  const impossible = made.filter((item) => !item.solution.possible);
  assert.equal(impossible[0].board.n, Math.min(...impossible.map((item) => item.board.n)));
  made.forEach((item, index) => assert.ok(item.solution.possible || made[(index + 1) % made.length].solution.possible, `${index + 1}번`));
  // 한 번 푼 판은 적어 둔 것을 다시 쓴다.
  assert.equal(solveOnce(made[0].board), solveOnce({ ...made[0].board }));
});
