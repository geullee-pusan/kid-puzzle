// 숫자 추리의 사다리와 판 만들어 내기 점검. 만들어 낸 표는 모든 후보를 따져 답이 꼭 하나인지 다시 확인한다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LADDER, MAKE_DIGITS, MAKE_LENGTH, MAKE_LEVEL, MAKE_MAX_ROWS, OLD_MAKE_LEVEL, TOP_LEVEL, generateBoard, makeLie, nextSeed, rungOf } from '../src/core/code-ladder.js';
import { allCodes, allSets, checkBoard, checkCode, checkSet, filterCodes, isLean, judge, solveLie, solveTable, trailOf, universe } from '../src/core/code.js';
import { createRng } from '../src/core/rng.js';
import { bruteCodes, bruteMatches, bruteOneLie, bruteScore, bruteSetMatches, bruteSets } from './helpers/brute-code.js';

const SIX = '123456';
const TEN = '0123456789';

test('사다리: 아홉 단계이고 표시는 기본·응용·응용·도전·도전·응용·응용·도전·도전, 맨 위는 직접 만들기', () => {
  assert.deepEqual(LADDER.map((rung) => rung.level), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(LADDER.map((rung) => rung.tag), ['basic', 'applied', 'applied', 'challenge', 'challenge', 'applied', 'applied', 'challenge', 'challenge']);
  assert.deepEqual(LADDER.map((rung) => rung.mode), ['guess', 'guess', 'guess', 'table', 'referee', 'place', 'cards', 'lie', 'make']);
  // 1~5단계의 번호는 그대로이고, 직접 만들기는 6단계에서 9단계로 옮겼다(예전 번호는 OLD_MAKE_LEVEL로 받는다).
  assert.deepEqual([TOP_LEVEL, MAKE_LEVEL, OLD_MAKE_LEVEL], [8, 9, 6]);
  // 6단계: 1~6의 세 자리 표 3~5줄, 7단계: 카드 1~9 가운데 세 장, 8단계: 1~6의 세 자리 표 4~5줄
  assert.deepEqual([rungOf(6).length, rungOf(6).digits, rungOf(6).rows], [3, SIX, [3, 5]]);
  assert.deepEqual([rungOf(7).length, rungOf(7).digits], [3, '123456789']);
  assert.deepEqual([rungOf(8).length, rungOf(8).digits, rungOf(8).rows], [3, SIX, [4, 5]]);
  // 1단계는 세 자리에 1~6, 2단계는 세 자리에 0~9, 3단계는 네 자리에 0~9, 5단계는 세 자리
  assert.deepEqual([rungOf(1).length, rungOf(1).digits], [3, SIX]);
  assert.deepEqual([rungOf(2).length, rungOf(2).digits], [3, TEN]);
  assert.deepEqual([rungOf(3).length, rungOf(3).digits], [4, TEN]);
  assert.deepEqual([rungOf(4).length, rungOf(4).rows], [3, [3, 5]]);
  assert.deepEqual([rungOf(5).length, rungOf(5).digits], [3, TEN]);
  assert.throws(() => rungOf(10));
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
  for (const level of [6, 7, 8]) {
    for (const seed of [1, 7, 30]) assert.notDeepEqual(generateBoard(level, nextSeed(level, seed)).board, generateBoard(level, seed).board, `${level}단계 ${seed}번`);
  }
  assert.equal(nextSeed(5, 3), 4);
  const next = nextSeed(1, 3, { small: true });
  assert.notDeepEqual(generateBoard(1, next, { small: true }).board, generateBoard(1, 3, { small: true }).board);
});

test('6단계(자리만 알려 주는 표): 판 번호 1~300의 표가 모두 답이 꼭 하나이고(다른 방법으로 모든 암호를 따짐), 줄마다 자리가 맞는 것의 수만 있고, 군더더기 줄이 없다', () => {
  const rung = rungOf(6);
  const rowCounts = {};
  const secrets = new Set();
  for (let seed = 1; seed <= 300; seed++) {
    const { board, solution } = generateBoard(6, seed);
    const where = `6단계 ${seed}번`;
    assert.equal(checkBoard(board), null, where);
    assert.deepEqual([board.mode, board.length, board.digits], ['place', 3, SIX], where);
    for (const row of board.rows) {
      assert.deepEqual(Object.keys(row).sort(), ['guess', 'place'], `${where}: 자리가 맞는 것의 수만 적는다`);
      assert.ok(row.place < 3, where);
    }
    // 다른 방법: 1~6의 세 자리 암호 120개를 모두 훑어 자리마다 견줘 본다.
    const matching = bruteMatches(3, SIX, board.rows);
    assert.equal(matching.length, 1, where);
    assert.equal(solution.secret, matching[0], where);
    assert.deepEqual(solveTable(3, SIX, board.rows), { count: 1, secret: matching[0], start: 120, trail: solution.trail }, where);
    assert.ok(board.rows.length >= rung.rows[0] && board.rows.length <= rung.rows[1], `${where}: ${board.rows.length}줄`);
    // 어느 줄을 빼도 답이 여럿이 된다.
    for (let skip = 0; skip < board.rows.length; skip++) {
      assert.ok(bruteMatches(3, SIX, board.rows.filter((_, at) => at !== skip)).length > 1, `${where}: ${skip + 1}번째 줄은 빼도 돼요`);
    }
    assert.ok(isLean(3, SIX, board.rows), where);
    rowCounts[board.rows.length] = (rowCounts[board.rows.length] ?? 0) + 1;
    secrets.add(solution.secret);
  }
  // 줄 수의 분포(세어 본 값): 3줄 129판, 4줄 104판, 5줄 67판
  assert.deepEqual(rowCounts, { 3: 129, 4: 104, 5: 67 });
  assert.ok(secrets.size >= 90, `서로 다른 암호 ${secrets.size}개`);
});

test('7단계(카드 세 장 맞히기): 숨긴 것은 카드 1~9 가운데 서로 다른 세 장의 묶음이고, 후보는 84가지다', () => {
  assert.deepEqual(allSets(3, '123456789'), bruteSets(3, '123456789'));
  assert.equal(allSets(3, '123456789').length, 84);
  const secrets = new Set();
  for (let seed = 1; seed <= 300; seed++) {
    const made = generateBoard(7, seed);
    const where = `7단계 ${seed}번`;
    assert.equal(checkBoard(made.board), null, where);
    assert.deepEqual([made.board.mode, made.board.length, made.board.digits], ['cards', 3, '123456789'], where);
    assert.equal(checkSet(made.board.secret, 3, '123456789'), null, where);
    assert.deepEqual(made.solution, { possible: true, secret: made.board.secret, start: 84 }, where);
    secrets.add(made.board.secret);
  }
  assert.ok(secrets.size >= 75, `서로 다른 묶음 ${secrets.size}개`);
});

test('8단계(한 번 거짓말하는 표): 판 번호 1~300의 표가 모두 딱 한 줄만 거짓이 되는 암호가 꼭 하나이고, 모든 줄이 참인 암호는 없다(다른 방법으로 모든 암호와 줄을 따짐)', () => {
  const rung = rungOf(8);
  const rowCounts = {};
  const lies = {};
  const everyCode = bruteCodes(3, SIX);
  for (let seed = 1; seed <= 300; seed++) {
    const { board, solution } = generateBoard(8, seed);
    const where = `8단계 ${seed}번`;
    assert.equal(checkBoard(board), null, where);
    assert.deepEqual([board.mode, board.length, board.digits], ['lie', 3, SIX], where);
    assert.equal(board.secret, undefined, '표에는 암호를 적지 않는다');
    assert.ok(board.rows.length >= rung.rows[0] && board.rows.length <= rung.rows[1], `${where}: ${board.rows.length}줄`);
    // 다른 방법: 줄마다 거짓이라고 쳐 보고 120개 암호를 모두 따진다.
    const brute = bruteOneLie(3, SIX, board.rows);
    assert.equal(brute.answers.length, 1, `${where}: 답이 ${brute.answers.length}개`);
    assert.equal(brute.honest, 0, `${where}: 모든 줄이 참인 암호가 있어요`);
    assert.deepEqual([solution.secret, solution.lie], [brute.answers[0].code, brute.answers[0].lie], where);
    assert.deepEqual(solveLie(3, SIX, board.rows), { count: 1, secret: solution.secret, lie: solution.lie, start: 120, honest: 0 }, where);
    // 그 암호로 매기면 거짓인 줄 하나만 답이 다르다.
    board.rows.forEach((row, index) => {
      const real = bruteScore(row.guess, solution.secret);
      assert.equal(real.hit === row.hit && real.place === row.place, index !== solution.lie, `${where}: ${index + 1}번째 줄`);
      assert.ok(row.place < 3 && row.place <= row.hit, where);
      // 거짓인 줄의 답도 그런 답이 나오는 암호가 있는 답이다(있을 수 없는 답으로 들키지 않는다).
      assert.ok(everyCode.some((code) => bruteScore(row.guess, code).hit === row.hit && bruteScore(row.guess, code).place === row.place), where);
    });
    assert.equal(new Set(board.rows.map((row) => row.guess)).size, board.rows.length, where);
    // 군더더기 줄이 없다: 줄을 하나라도 빼면 답이 하나로 정해지지 않는다.
    for (let skip = 0; skip < board.rows.length; skip++) {
      const without = bruteOneLie(3, SIX, board.rows.filter((_, at) => at !== skip));
      assert.ok(without.answers.length !== 1 || without.honest > 0 || without.answers[0].code !== solution.secret, `${where}: ${skip + 1}번째 줄은 빼도 돼요`);
    }
    rowCounts[board.rows.length] = (rowCounts[board.rows.length] ?? 0) + 1;
    lies[solution.lie] = (lies[solution.lie] ?? 0) + 1;
  }
  // 세어 본 값: 4줄 196판, 5줄 104판. 거짓인 줄은 어느 자리에나 온다(첫째 68, 둘째 79, 셋째 61, 넷째 64, 다섯째 28)
  assert.deepEqual(rowCounts, { 4: 196, 5: 104 });
  assert.deepEqual(lies, { 0: 68, 1: 79, 2: 61, 3: 64, 4: 28 });
});

test('한 번 거짓말하는 표 만들기: 두 자리 판에서도 답이 꼭 하나인 표만 낸다', () => {
  const rng = createRng(7);
  let made = 0;
  for (let attempt = 0; attempt < 200; attempt++) {
    const table = makeLie(rng, 2, '1234', [3, 4]);
    if (!table) continue;
    made += 1;
    const brute = bruteOneLie(2, '1234', table.rows);
    assert.deepEqual(brute.answers, [{ code: table.secret, lie: table.lie }]);
    assert.equal(brute.honest, 0);
  }
  assert.ok(made > 50, `${made}개`);
});

test('카드 맞히기의 후보 걸러 내기: 다른 방법으로 센 것과 모든 숨긴 묶음, 여러 물음에서 같다', () => {
  const sets = bruteSets(3, '123456789');
  const asks = ['123', '145', '678', '259', '369'];
  for (const secret of sets) {
    const rows = asks.map((guess) => ({ guess, hit: [...guess].filter((ch) => secret.includes(ch)).length }));
    for (let upto = 0; upto <= rows.length; upto++) {
      const brute = bruteSetMatches(3, '123456789', rows.slice(0, upto));
      assert.deepEqual(filterCodes(universe('cards', 3, '123456789'), rows.slice(0, upto)), brute, secret);
      assert.equal(trailOf(3, '123456789', rows.slice(0, upto), 'cards').left.length, brute.length, secret);
      assert.ok(brute.includes(secret));
    }
  }
});
