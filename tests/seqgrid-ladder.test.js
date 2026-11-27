// 가로세로 수열 퍼즐의 사다리: 단계마다 판이 잣대에 맞는지, 답이 하나뿐인지(다른 방법으로 다시 센다), 한 칸씩 차례로 정해지는지,
// 같은 번호는 같은 판인지, 더 작은 판이 같은 걸음의 더 작은 판인지 본다. 판 번호는 단계마다 몇 개만 본다(테스트가 빨리 끝나게).
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LADDER, MAKE_LEVEL, TOP_LEVEL, blackSpots, digBoard, generateBoard, measure, nextSeed, randomSolution, rungOf, smallBoards } from '../src/core/seqgrid-ladder.js';
import { blanksOf, checkBoard, judgeLine, linesOf, stepSolve } from '../src/core/seqgrid.js';
import { smallerSeqgrid } from '../src/core/smaller.js';
import { createRng } from '../src/core/rng.js';
import { bruteFilledOk, bruteSearch } from './helpers/brute-seqgrid.js';

const SEEDS = { 1: 12, 2: 12, 3: 10, 4: 8, 5: 6 };

/** 판 하나를 다른 방법으로 따진다: 1부터 60까지로 답이 하나뿐이고, 그 답이 차례 풀이의 답과 같다 */
function checkUnique(board, where) {
  const chain = stepSolve(board);
  assert.equal(chain.solved, true, where);
  const brute = bruteSearch(board, 60, 2);
  assert.equal(brute.count, 1, where);
  assert.deepEqual(brute.answers[0], chain.cells, where);
  assert.ok(bruteFilledOk(board, chain.cells), where);
  return chain;
}

test('사다리: 단계 여섯, 맨 위는 직접 만들기. 표시는 기본, 기본, 응용, 응용, 도전, 도전', () => {
  assert.deepEqual(
    LADDER.map((rung) => rung.level),
    [1, 2, 3, 4, 5, 6],
  );
  assert.deepEqual(
    LADDER.map((rung) => rung.tag),
    ['basic', 'basic', 'applied', 'applied', 'challenge', 'challenge'],
  );
  assert.deepEqual(
    LADDER.map((rung) => rung.mode),
    ['three', 'ends', 'black', 'cross', 'five', 'make'],
  );
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  assert.throws(() => generateBoard(6, 1));
  assert.throws(() => generateBoard(1, 0));
  assert.throws(() => rungOf(9));
});

test('단계마다 판이 잣대에 맞고, 답이 하나뿐이고(1부터 60까지 다른 방법으로 센다), 한 칸씩 차례로 정해진다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    const rung = rungOf(level);
    const { n, black, top, gap, blanks } = rung.spec;
    for (let seed = 1; seed <= SEEDS[level]; seed++) {
      const where = `${level}단계 ${seed}번`;
      const made = generateBoard(level, seed);
      const { board } = made;
      assert.equal(checkBoard(board), null, where);
      assert.deepEqual(made.solution, { possible: true, count: 1 });
      assert.equal(board.n, n, where);
      assert.ok(board.black.length >= black[0] && board.black.length <= black[1], where);
      // 검은 칸은 가로줄도 세로줄도 겹치지 않는다(줄마다 칸이 셋 이상)
      for (const line of linesOf(board.n, board.black)) assert.ok(line.cells.length >= n - 1, where);
      const open = blanksOf(board).length;
      assert.ok(open >= blanks[0] && open <= blanks[1], `${where}: 빈칸 ${open}`);
      const chain = checkUnique(board, where);
      // 수는 1부터 top까지, 줄마다 간격은 gap 이하
      for (const value of chain.cells) if (value !== null) assert.ok(value >= 1 && value <= top, where);
      for (const line of linesOf(board.n, board.black)) {
        const judged = judgeLine(line.cells.map((cell) => chain.cells[cell]));
        assert.ok(judged.gaps[0] <= gap, where);
      }
      const m = measure(board, chain.cells, chain.steps);
      if (level === 1) assert.ok(m.middle >= 1, where);
      if (level === 1 && seed === 1) assert.equal(m.middle, m.blanks, '첫 판은 빈칸의 수가 두 줄 모두에서 크기로 가운데다');
      if (level === 2) assert.ok(m.edges >= 2 && m.edgeInCenter, where);
      if (level === 3) assert.ok(m.single >= 1, where);
      if (level === 4) assert.ok(m.firstBy === 'both' && m.joint >= 3, where);
      if (level === 5) assert.ok(m.joint >= 3 && m.deep >= 1 && m.wide <= 2, where);
      // 5×5 판이 아니면 칸마다 두 줄 가운데 하나는 빈칸이 그 칸 하나뿐일 때 정해진다
      if (level < 5) assert.equal(m.wide, 0, where);
    }
  }
});

test('같은 번호는 늘 같은 판이다. 다음 판 번호는 같은 판을 건너뛴다. 수준 맞추기의 작은 판은 1단계의 가운데 수 판이다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    assert.deepEqual(generateBoard(level, 3), generateBoard(level, 3));
    const next = nextSeed(level, 1);
    assert.ok(next >= 2);
    assert.notDeepEqual(generateBoard(level, next).board, generateBoard(level, 1).board);
  }
  const small = generateBoard(1, 4, { small: true });
  assert.equal(small.small, true);
  const chain = checkUnique(small.board, '작은 판');
  const m = measure(small.board, chain.cells, chain.steps);
  assert.equal(m.middle, m.blanks);
  assert.equal(generateBoard(3, 1, { small: true }).small, false);
  // 첫 판: 13 _ 9 / _ 7 17 / 11 15 _
  assert.deepEqual(generateBoard(1, 1).board, { n: 3, black: [], givens: [13, null, 9, null, 7, 17, 11, 15, null] });
});

test('더 작은 판: 5×5는 4×4, 4×4는 3×3, 빈칸이 셋 이상인 3×3은 빈칸 둘인 3×3. 모두 답이 하나뿐이다. 빈칸이 둘 이하인 3×3에는 없다', () => {
  const cases = [
    [5, 1, 4],
    [4, 2, 3],
    [3, 1, 3],
    [2, 1, 3],
  ];
  for (const [level, seed, size] of cases) {
    const { board } = generateBoard(level, seed);
    const origin = { mode: rungOf(level).mode, board };
    const list = smallBoards(origin);
    assert.equal(list.yes.length, 2, `${level}단계`);
    assert.deepEqual(list.no, []);
    for (const small of list.yes) {
      assert.equal(small.n, size);
      checkUnique(small, `${level}단계의 작은 판`);
      if (board.n === 3) assert.equal(blanksOf(small).length, 2);
      if (level === 5) assert.equal(stepSolve(small).steps[0].by, 'both');
    }
    assert.notDeepEqual(list.yes[0], list.yes[1]);
    // 틀이 쓰는 것: 차례마다 번갈아, 같은 판에는 같은 작은 판
    assert.deepEqual(smallerSeqgrid(origin, 0), { board: list.yes[0] });
    assert.deepEqual(smallerSeqgrid(origin, 1), { board: list.yes[1] });
    assert.deepEqual(smallerSeqgrid(origin, 2), smallerSeqgrid(origin, 0));
  }
  // 2단계의 작은 판은 가장 작거나 큰 수가 빈칸이다
  const ends = smallBoards({ mode: 'ends', board: generateBoard(2, 1).board }).yes;
  for (const small of ends) {
    const chain = stepSolve(small);
    assert.ok(measure(small, chain.cells, chain.steps).edges >= 1);
  }
  const two = { n: 3, black: [], givens: [13, null, 9, null, 7, 17, 11, 15, 13] };
  assert.equal(smallerSeqgrid({ mode: 'three', board: two }, 0), null);
  assert.equal(smallerSeqgrid({ mode: 'three', board: null }, 0), null);
});

test('풀이 프로그램이 알려 준 것: 칸마다 빈칸이 하나뿐인 줄로 정해지는 판은 빈칸이 2n − 1개를 넘지 않는다', () => {
  // 빈칸을 가로줄과 세로줄을 잇는 선으로 보면, 한 칸씩 떼어 낼 수 있는 모양은 고리가 없어서 선이 (줄의 수 − 1)개를 넘지 못한다
  const rng = createRng(31);
  for (const n of [3, 4, 5]) {
    let most = 0;
    for (let trial = 0; trial < 12; trial++) {
      const black = blackSpots(rng, n, 0);
      const solution = randomSolution(rng, n, black, 40, 8);
      const board = digBoard(rng, n, black, solution, 99, 0);
      most = Math.max(most, blanksOf(board).length);
      assert.ok(blanksOf(board).length <= 2 * n - 1, `${n}×${n}`);
    }
    assert.ok(most >= 2 * n - 2, `${n}×${n}에서 가장 많이 뚫은 판 ${most}`);
  }
});
