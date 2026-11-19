// 주사위 미로와 길 세기의 사다리와 판 내기 점검.
// 단계마다의 판, 같은 번호는 같은 판, 판마다 풀이 프로그램의 결과가 붙어 있는지, 맨 처음 판,
// 표시한 출구와 막힌 갈림길이 단계의 조건에 맞는지(다른 방법으로 다시 센다), 작은 판, 다음 판 번호를 본다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf } from '../src/core/maze-ladder.js';
import { checkBoard, countPaths, exitCell, exitCounts, rowCol, solve } from '../src/core/maze.js';
import { bruteCounts, choose } from './helpers/brute-maze.js';

const SEEDS = Array.from({ length: 60 }, (_, index) => index + 1);

test('사다리: 여섯 단계이고 맨 위는 직접 만들기다. 실험 → 출구까지의 길 → 칸마다의 길 → 막힌 갈림길 → 짝수 칸 칠하기 → 직접 만들기', () => {
  assert.equal(LADDER.length, 6);
  assert.deepEqual(LADDER.map((rung) => rung.level), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(LADDER.map((rung) => rung.tag), ['basic', 'basic', 'applied', 'applied', 'challenge', 'challenge']);
  assert.deepEqual(LADDER.map((rung) => rung.mode), ['busy', 'count', 'count', 'count', 'even', 'make']);
  assert.deepEqual(LADDER.map((rung) => rung.hint), ['busy', 'exit', 'fill', 'blocked', 'even', 'exits']);
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  assert.throws(() => rungOf(7));
  assert.throws(() => generateBoard(MAKE_LEVEL, 1));
});

test('같은 (단계, 판 번호)는 늘 같은 판이다. 판마다 풀이 프로그램으로 푼 결과가 붙어 있다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of SEEDS) {
      const made = generateBoard(level, seed);
      assert.deepEqual(generateBoard(level, seed), made);
      assert.equal(checkBoard(made.board), null, `${level}단계 ${seed}번`);
      assert.deepEqual(made.solution, solve(made.board));
      assert.equal(made.board.kind, rungOf(level).mode);
    }
  }
});

test('맨 처음 판: 실험은 2줄(출구 셋), 출구까지의 길은 2줄의 가운데 출구(두 가지)다', () => {
  assert.deepEqual(generateBoard(1, 1).board, { kind: 'busy', rows: 2, blocked: [], target: null, ask: null });
  const first = generateBoard(2, 1);
  assert.deepEqual(first.board, { kind: 'count', rows: 2, blocked: [], target: 1, ask: 'target' });
  assert.equal(first.solution.answer, 2);
  assert.equal(generateBoard(5, 1).board.rows, 4);
});

test('1단계(실험): 막힌 갈림길이 없는 2~6줄 판. 출구가 다섯 개인 판(4줄)이 가장 자주 나온다', () => {
  const rows = SEEDS.map((seed) => generateBoard(1, seed).board.rows);
  for (const value of rows) assert.ok(value >= 2 && value <= 6);
  assert.ok(SEEDS.every((seed) => generateBoard(1, seed).board.blocked.length === 0));
  const four = rows.filter((value) => value === 4).length;
  for (const other of [3, 5, 6]) assert.ok(four > rows.filter((value) => value === other).length, `${other}줄`);
});

test('2단계: 막힌 갈림길 없이, 양 끝이 아닌 출구 하나를 표시한다. 답은 파스칼 세모의 수다', () => {
  for (const seed of SEEDS) {
    const { board, solution } = generateBoard(2, seed);
    assert.equal(board.blocked.length, 0);
    assert.ok(board.target >= 1 && board.target <= board.rows - 1, `${seed}번`);
    assert.equal(solution.answer, choose(board.rows, board.target));
    assert.ok(solution.answer >= 2);
  }
  // 처음 열 판 안에 답이 서로 다른 판이 넷 넘게 나온다.
  assert.ok(new Set(SEEDS.slice(0, 10).map((seed) => generateBoard(2, seed).solution.answer)).size >= 4);
});

test('3단계: 맨 위를 뺀 모든 칸을 연다(3, 4줄)', () => {
  for (const seed of SEEDS) {
    const { board, solution } = generateBoard(3, seed);
    assert.ok([3, 4].includes(board.rows));
    assert.equal(board.ask, 'all');
    assert.equal(solution.asked.length, ((board.rows + 1) * (board.rows + 2)) / 2 - 1);
  }
});

test('4단계: 갈림길 하나나 둘이 막혀 있고, 표시한 출구는 길이 둘 이상이며 막혀서 길의 수가 바뀐 출구다. 돌마다 그 출구의 길의 수를 바꾼다(다른 방법으로 다시 센다)', () => {
  let changedFew = 0;
  for (const seed of SEEDS) {
    const { board, solution } = generateBoard(4, seed);
    assert.ok([4, 5].includes(board.rows));
    assert.ok(board.blocked.length >= 1 && board.blocked.length <= 2);
    const stones = board.blocked.map((cell) => [rowCol(cell).r, rowCol(cell).i]);
    const brute = bruteCounts(board.rows, stones);
    assert.equal(solution.answer, brute.get(`${board.rows},${board.target}`));
    assert.ok(solution.answer >= 2);
    assert.notEqual(solution.answer, choose(board.rows, board.target));
    for (const cell of board.blocked) {
      const without = countPaths({ ...board, blocked: board.blocked.filter((item) => item !== cell) });
      assert.notEqual(without[exitCell(board.rows, board.target)], solution.answer, `${seed}번: 돌 ${cell}`);
    }
    if (solution.answer < choose(board.rows, board.target) / 2) changedFew += 1;
  }
  assert.ok(changedFew > 0);
  // 막은 자리와 표시한 출구가 판 번호마다 달라진다.
  assert.ok(new Set(SEEDS.map((seed) => JSON.stringify(generateBoard(4, seed).board))).size > 30);
});

test('5단계(짝수 칸 칠하기): 4~8줄, 막힌 갈림길이 없다', () => {
  const rows = new Set();
  for (const seed of SEEDS) {
    const { board, solution } = generateBoard(5, seed);
    rows.add(board.rows);
    assert.equal(board.blocked.length, 0);
    assert.ok(solution.evens.length >= 4);
  }
  assert.deepEqual([...rows].sort(), [4, 5, 6, 7, 8]);
});

test('작은 판부터: 단계마다 작은 판이 정해져 있고, 그 단계의 조건에 맞는다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    const { board } = generateBoard(level, 3, { small: true });
    assert.equal(board.rows, rungOf(level).small, `${level}단계`);
    assert.equal(checkBoard(board), null);
    assert.equal(board.kind, rungOf(level).mode);
  }
  const blocked = generateBoard(4, 1, { small: true }).board;
  assert.ok(blocked.blocked.length > 0);
  assert.notEqual(exitCounts(blocked)[blocked.target], choose(blocked.rows, blocked.target));
});

test('"새 판"은 방금 한 판과 다른 판이다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of SEEDS.slice(0, 20)) {
      const next = nextSeed(level, seed);
      assert.ok(next > seed);
      assert.notDeepEqual(generateBoard(level, next).board, generateBoard(level, seed).board, `${level}단계 ${seed}번`);
    }
  }
});
