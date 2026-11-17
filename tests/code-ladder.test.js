// 숫자 추리의 사다리와 판 만들어 내기 점검. 만들어 낸 표는 모든 후보를 따져 답이 꼭 하나인지 다시 확인한다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LADDER, MAKE_DIGITS, MAKE_LENGTH, MAKE_LEVEL, MAKE_MAX_ROWS, TOP_LEVEL, generateBoard, nextSeed, rungOf } from '../src/core/code-ladder.js';
import { allCodes, checkBoard, checkCode, isLean, judge, solveTable } from '../src/core/code.js';

const SIX = '123456';
const TEN = '0123456789';

test('사다리: 여섯 단계이고 표시는 기본·응용·응용·도전·도전·도전, 맨 위는 직접 만들기', () => {
  assert.deepEqual(LADDER.map((rung) => rung.level), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(LADDER.map((rung) => rung.tag), ['basic', 'applied', 'applied', 'challenge', 'challenge', 'challenge']);
  assert.deepEqual(LADDER.map((rung) => rung.mode), ['guess', 'guess', 'guess', 'table', 'referee', 'make']);
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  // 1단계는 세 자리에 1~6, 2단계는 세 자리에 0~9, 3단계는 네 자리에 0~9, 5단계는 세 자리
  assert.deepEqual([rungOf(1).length, rungOf(1).digits], [3, SIX]);
  assert.deepEqual([rungOf(2).length, rungOf(2).digits], [3, TEN]);
  assert.deepEqual([rungOf(3).length, rungOf(3).digits], [4, TEN]);
  assert.deepEqual([rungOf(4).length, rungOf(4).rows], [3, [3, 5]]);
  assert.deepEqual([rungOf(5).length, rungOf(5).digits], [3, TEN]);
  assert.throws(() => rungOf(7));
  assert.throws(() => generateBoard(MAKE_LEVEL, 1));
  assert.equal(MAKE_LENGTH, 3);
  assert.deepEqual(MAKE_DIGITS, [SIX, TEN]);
  assert.ok(MAKE_MAX_ROWS >= 5);
});

test('같은 번호는 늘 같은 판이다', () => {
  for (const rung of LADDER.filter((item) => item.mode !== 'make')) {
    for (const seed of [1, 2, 17, 300]) {
      assert.deepEqual(generateBoard(rung.level, seed), generateBoard(rung.level, seed), `${rung.level}단계 ${seed}번`);
    }
  }
});

test('1~3단계: 암호는 그 단계의 숫자로 된 서로 다른 숫자이고, 번호마다 여러 가지가 나온다', () => {
  for (const level of [1, 2, 3]) {
    const rung = rungOf(level);
    const secrets = new Set();
    for (let seed = 1; seed <= 200; seed++) {
      const made = generateBoard(level, seed);
      assert.equal(checkBoard(made.board), null);
      assert.equal(made.board.mode, 'guess');
      assert.equal(made.board.length, rung.length);
      assert.equal(made.board.digits, rung.digits);
      assert.equal(checkCode(made.board.secret, rung.length, rung.digits), null);
      assert.deepEqual(made.solution, { possible: true, secret: made.board.secret, start: allCodes(rung.length, rung.digits).length });
      assert.deepEqual([made.level, made.seed, made.small], [level, seed, false]);
      secrets.add(made.board.secret);
    }
    assert.ok(secrets.size >= (level === 1 ? 80 : 150), `${level}단계: 서로 다른 암호 ${secrets.size}개`);
  }
});

test('작은 판: 맨 아래 단계에서만 숫자를 줄인다(1~5). 다른 단계에서는 그대로다', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const small = generateBoard(1, seed, { small: true });
    assert.equal(small.board.digits, '12345');
    assert.equal(checkCode(small.board.secret, 3, '12345'), null);
    assert.equal(small.solution.start, 60);
    assert.equal(small.small, true);
  }
  assert.equal(generateBoard(2, 5, { small: true }).board.digits, TEN);
  assert.deepEqual(generateBoard(4, 5, { small: true }).board, generateBoard(4, 5).board);
});

test('4단계: 판 번호 1~300의 표가 모두 답이 꼭 하나이고, 줄 수는 3~5줄이며, 군더더기 줄이 없다', () => {
  const rung = rungOf(4);
  const codes = allCodes(rung.length, rung.digits);
  const rowCounts = {};
  const secrets = new Set();
  for (let seed = 1; seed <= 300; seed++) {
    const made = generateBoard(4, seed);
    const { board, solution } = made;
    const where = `4단계 ${seed}번`;
    assert.equal(checkBoard(board), null, where);
    assert.equal(board.mode, 'table');
    assert.equal(board.secret, undefined, '표에는 암호를 적지 않는다');
    // 모든 후보를 하나씩 따진다(풀이 프로그램의 걸러 내기를 쓰지 않고 두 수를 다시 매겨서 센다).
    const matching = codes.filter((code) => board.rows.every((row) => judge(row.guess, code).hit === row.hit && judge(row.guess, code).place === row.place));
    assert.equal(matching.length, 1, where);
    assert.equal(solution.secret, matching[0], where);
    assert.equal(solution.count, 1, where);
    assert.deepEqual(solveTable(board.length, board.digits, board.rows), { count: 1, secret: solution.secret, start: 720, trail: solution.trail }, where);
    // 줄 수와 군더더기
    assert.ok(board.rows.length >= 3 && board.rows.length <= 5, `${where}: ${board.rows.length}줄`);
    assert.ok(isLean(board.length, board.digits, board.rows), `${where}: 빼도 되는 줄이 있어요`);
    // 줄을 차례로 따지면 후보가 줄기만 하고 마지막에 하나가 남는다. 표에 암호가 그대로 적힌 줄은 없다.
    let before = 720;
    for (const count of solution.trail) {
      assert.ok(count < before, where);
      before = count;
    }
    assert.equal(solution.trail.at(-1), 1, where);
    for (const row of board.rows) {
      assert.notEqual(row.guess, solution.secret, where);
      assert.ok(row.place < board.length, where);
    }
    assert.equal(new Set(board.rows.map((row) => row.guess)).size, board.rows.length, where);
    rowCounts[board.rows.length] = (rowCounts[board.rows.length] ?? 0) + 1;
    secrets.add(solution.secret);
  }
  // 줄 수의 분포(세어 본 값): 3줄 98판, 4줄 107판, 5줄 95판
  assert.deepEqual(rowCounts, { 3: 98, 4: 107, 5: 95 });
  assert.ok(secrets.size >= 200, `서로 다른 암호 ${secrets.size}개`);
});

test('5단계: 판에는 자릿수와 숫자만 있다(암호는 아이가 정한다)', () => {
  for (const seed of [1, 2, 50]) {
    const made = generateBoard(5, seed);
    assert.deepEqual(made.board, { mode: 'referee', length: 3, digits: TEN });
    assert.deepEqual(made.solution, { possible: true, secret: null, start: 720 });
    assert.equal(checkBoard(made.board), null);
  }
});

test('다음 판 번호: 방금 한 판과 똑같은 판은 건너뛴다', () => {
  for (const level of [1, 2, 3, 4]) {
    for (const seed of [1, 7, 30, 120]) {
      const next = nextSeed(level, seed);
      assert.ok(next > seed);
      assert.notDeepEqual(generateBoard(level, next).board, generateBoard(level, seed).board, `${level}단계 ${seed}번`);
    }
  }
  assert.equal(nextSeed(5, 3), 4);
  const next = nextSeed(1, 3, { small: true });
  assert.notDeepEqual(generateBoard(1, next, { small: true }).board, generateBoard(1, 3, { small: true }).board);
});
