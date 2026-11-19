// 참말 섬의 사다리와 판 만들어 내기: 단계마다 판 번호 1~200의 판이 약속(좋은 판)을 지키는지 본다.
// 단계별 판의 분포와 쳐 보기 횟수도 여기서 재어 README와 견준다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ANIMALS, checkBoard, dayWorld, expectedPresses, isLean, judgeQuestion, labelTruths, spareSays, uselessCount, worldsOf } from '../src/core/logic.js';
import {
  COUNT_SHARE,
  LADDER,
  LIE_RUNS,
  MAKE_LEVEL,
  NONE_SHARE,
  OLD_MAKE_LEVEL,
  QUESTIONS,
  TOP_LEVEL,
  boxBoards,
  generateBoard,
  nextSeed,
  oneDayBoards,
  pairBoards,
  rungOf,
  someBoards,
} from '../src/core/logic-ladder.js';
import { bruteAnswer, bruteBoxes, bruteDays, bruteUsefulAt, bruteWorlds } from './helpers/brute-logic.js';

const SEEDS = Array.from({ length: 200 }, (_, index) => index + 1);
const boardsOf = (level) => SEEDS.map((seed) => generateBoard(level, seed));
const allKnights = (kinds) => kinds.every(Boolean);
const speakers = (board) => new Set(board.says.map((say) => say.by)).size;

test('사다리: 단계 일곱과 직접 만들기. 1~4단계는 그대로이고, 5~7단계("적어도 한 명", 요일 섬, 질문 고르기)는 직접 만들기 앞에 더했다', () => {
  assert.deepEqual(
    LADDER.map((rung) => [rung.level, rung.tag, rung.mode]),
    [
      [1, 'basic', 'pair'],
      [2, 'basic', 'box'],
      [3, 'applied', 'folk'],
      [4, 'challenge', 'road'],
      [5, 'applied', 'some'],
      [6, 'challenge', 'day'],
      [7, 'challenge', 'ask'],
      [8, 'challenge', 'make'],
    ],
  );
  assert.deepEqual([TOP_LEVEL, MAKE_LEVEL, OLD_MAKE_LEVEL], [7, 8, 5]);
  // 따라가 보기는 1단계에서만 처음부터 켜져 있다.
  assert.deepEqual(LADDER.filter((rung) => rung.follow).map((rung) => rung.level), [1]);
  assert.throws(() => generateBoard(MAKE_LEVEL, 1));
  assert.throws(() => generateBoard(9, 1));
  assert.throws(() => rungOf(9));
});

test('같은 판 번호는 늘 같은 판이고, 다음 판 번호는 다른 판을 낸다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of [1, 2, 7, 50]) {
      assert.deepEqual(generateBoard(level, seed), generateBoard(level, seed), `${level}단계 ${seed}번`);
      const next = nextSeed(level, seed);
      assert.ok(next > seed);
      assert.notDeepEqual(generateBoard(level, next).board, generateBoard(level, seed).board, `${level}단계 ${seed}번`);
    }
  }
});

test('모든 판: 꼴이 맞고, 풀이 프로그램이 따로 적은 풀이와 같은 답을 낸다. 동물은 서로 다르다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const { board, solution } of boardsOf(level)) {
      const where = `${level}단계 ${JSON.stringify(board)}`;
      assert.equal(checkBoard(board), null, where);
      if (board.people) assert.ok(board.people.every((animal) => animal >= 0 && animal < ANIMALS), where);
      assert.equal(board.kind === 'question', level === 7, where);
      assert.equal(board.kind === 'day', level === 6, where);
      if (board.kind === 'box') assert.deepEqual(bruteBoxes(board), [solution.answer], where);
      else if (board.kind === 'day') assert.deepEqual(bruteDays(board), [solution.answer], where);
      else if (board.kind === 'question') assert.deepEqual(bruteUsefulAt(board), solution.answer, where);
      else {
        const brute = bruteAnswer(board);
        assert.equal(solution.possible === false ? null : solution.answer, brute, where);
      }
    }
  }
});

test('1단계: 주민 둘, 말 한두 개. 누가 무엇인지 하나로 정해지고, 군더더기와 쓸모없는 말이 없고, "모두 참말쟁이"가 답인 판은 없다. 맨 첫 판은 가장 쉬운 판이다', () => {
  for (const { board, solution } of boardsOf(1)) {
    assert.equal(board.people.length, 2);
    assert.ok(board.says.length >= 1 && board.says.length <= 2);
    assert.equal(solution.possible, true);
    assert.equal(solution.worlds, 1);
    assert.equal(allKnights(solution.kinds), false);
    assert.equal(isLean(board), true);
    assert.equal(uselessCount(board.says), 0);
  }
  const first = generateBoard(1, 1).board;
  assert.equal(first.says.length, 1);
  assert.deepEqual(first.says[0].s, { t: 'all', k: false }, '맨 첫 판: "우리는 모두 거짓말쟁이예요"');
  const pool = pairBoards();
  assert.ok(pool.length >= 15, `1단계의 판 ${pool.length}가지`);
  assert.equal(expectedPresses(first), Math.min(...pool.map((item) => item.presses)));
  // 작은 판부터(수준 맞추기): 말 하나뿐인 판
  assert.equal(generateBoard(1, 5, { small: true }).board.says.length, 1);
});

test('2단계: 상자 셋. 보물이 든 상자가 하나로 정해지고, 늘 참이거나 늘 거짓인 글이 없다. 보물이 첫째 상자인 판은 드물다', () => {
  let first = 0;
  for (const { board, solution } of boardsOf(2)) {
    assert.equal(board.labels.length, 3);
    assert.equal(solution.possible, true);
    assert.ok(['true-1', 'false-1'].includes(`${board.rule.of}-${board.rule.n}`));
    for (let box = 0; box < 3; box++) {
      const truths = [0, 1, 2].map((at) => labelTruths(board, at)[box]);
      assert.ok(truths.includes(true) && truths.includes(false), `${JSON.stringify(board)}: ${box}번째 글은 늘 같다`);
    }
    if (solution.answer === 0) first += 1;
  }
  assert.ok(first > 10 && first < 70, `첫째 상자가 답인 판 ${first}/200`);
  assert.ok(boxBoards(3).length > 100);
});

test('3단계: 주민 셋. "이렇게 말할 수는 없어요" 판이 다섯에 하나쯤, "몇 명" 판이 섞인다. 모든 판에 군더더기 말이 없다', () => {
  const tally = { none: 0, count: 0, kinds: 0, useless: 0 };
  for (const { board, solution } of boardsOf(3)) {
    const where = JSON.stringify(board);
    assert.equal(board.people.length, 3);
    assert.ok(board.says.length >= 2 && board.says.length <= 5, where);
    assert.ok(speakers(board) >= 2, `${where}: 말한 주민이 둘 이상`);
    assert.equal(spareSays(board).length, 0, where);
    assert.ok(uselessCount(board.says) <= 1, where);
    tally.useless += uselessCount(board.says);
    if (solution.possible === false) {
      tally.none += 1;
      assert.equal(worldsOf(board).length, 0);
      assert.equal(uselessCount(board.says), 0);
    } else if (board.ask === 'count') {
      tally.count += 1;
      assert.ok(solution.worlds >= 2, `${where}: 몇 명인지만 정해지는 판`);
    } else {
      tally.kinds += 1;
      assert.equal(solution.worlds, 1, where);
      assert.equal(allKnights(solution.kinds), false, where);
    }
    assert.ok(board.says.every((say) => !(say.s.t === 'me' && !say.s.k)), '"나는 거짓말쟁이예요"는 판으로 내지 않는다');
  }
  assert.ok(Math.abs(tally.none / 200 - NONE_SHARE) < 0.08, `말할 수 없는 판 ${tally.none}/200`);
  assert.ok(Math.abs(tally.count / (200 - tally.none) - COUNT_SHARE) < 0.1, `몇 명 ${tally.count}`);
  assert.ok(tally.useless > 10 && tally.useless < 50, `쓸모없는 말 ${tally.useless}`);
});

test('4단계: 주민 셋과 갈림길. 누가 무엇인지는 다 안 정해져도 길은 하나로 정해진다. 길을 말한 주민이 있고 군더더기 말이 없다', () => {
  for (const { board, solution } of boardsOf(4)) {
    const where = JSON.stringify(board);
    assert.equal(board.kind, 'road');
    assert.equal(solution.possible, true, where);
    assert.ok(['left', 'right'].includes(solution.answer), where);
    assert.ok(solution.worlds >= 2, `${where}: 누가 무엇인지까지 정해지는 판`);
    assert.ok(board.says.some((say) => say.s.t === 'road'), where);
    assert.equal(spareSays(board).length, 0, where);
    assert.ok(uselessCount(board.says) <= 1, where);
  }
});

test('5단계: 주민 둘과 "적어도 한 명", "이거나". 누가 무엇인지 하나로 정해지고(모든 배정을 따로 따져 하나뿐), 군더더기 말이 없다. 맨 첫 판은 말 하나뿐이다', () => {
  let one = 0;
  for (const { board, solution } of boardsOf(5)) {
    const where = JSON.stringify(board);
    assert.equal(board.kind, 'folk', where);
    assert.equal(board.people.length, 2, where);
    assert.ok(board.says.length >= 1 && board.says.length <= 2, where);
    assert.ok(board.says.some((say) => say.s.t === 'some' || say.s.t === 'or'), `${where}: "적어도 한 명"이나 "이거나"가 없다`);
    // 배정 넷을 따로 따져도 들어맞는 배정은 하나뿐이다.
    assert.equal(bruteWorlds(board).length, 1, where);
    assert.deepEqual([solution.possible, solution.worlds], [true, 1], where);
    assert.equal(allKnights(solution.kinds), false, where);
    assert.equal(isLean(board), true, where);
    assert.equal(uselessCount(board.says), 0, where);
    if (board.says.length === 1) one += 1;
  }
  assert.ok(one > 20 && one < 90, `말 하나뿐인 판 ${one}/200`);
  assert.equal(generateBoard(5, 1).board.says.length, 1);
  // 판이 적어서 모두 만들어 둔다: 말 하나 4가지, 말 둘 10가지(README와 같다). 1단계의 판과 겹치지 않는다.
  const pool = someBoards();
  assert.deepEqual([pool.filter((item) => item.says.length === 1).length, pool.filter((item) => item.says.length === 2).length], [4, 10]);
  const pairs = new Set(pairBoards().map((item) => JSON.stringify(item.says)));
  assert.ok(pool.every((item) => !pairs.has(JSON.stringify(item.says))));
});

test('6단계: 요일 섬. 주민 둘, 서로 다른 거짓말 요일(이어진 이틀~나흘). 오늘이 무슨 요일인지 하나로 정해지고(이레를 따로 따져 하나뿐), 군더더기 말이 없고, 둘 다 말한다', () => {
  const days = Array(7).fill(0);
  let named = 0;
  for (const { board, solution } of boardsOf(6)) {
    const where = JSON.stringify(board);
    assert.equal(board.people.length, 2, where);
    assert.notDeepEqual(board.lies[0], board.lies[1], where);
    for (const run of board.lies) assert.ok(LIE_RUNS.some((item) => JSON.stringify(item) === JSON.stringify(run)), where);
    assert.ok(board.says.length >= 2 && board.says.length <= 3, where);
    assert.equal(new Set(board.says.map((say) => say.by)).size, 2, `${where}: 둘 다 말한다`);
    assert.ok(board.says.filter((say) => say.s.t === 'dayname').length <= 1, where);
    assert.deepEqual(bruteDays(board), [solution.answer], where);
    assert.equal(solution.worlds, 1, where);
    assert.equal(spareSays(board).length, 0, where);
    days[solution.answer] += 1;
    if (board.says.some((say) => say.s.t === 'dayname')) named += 1;
  }
  // 답인 요일은 고루 나온다.
  assert.ok(days.every((count) => count >= 10), days.join());
  assert.ok(named > 15 && named < 70, `요일 이름을 말하는 판 ${named}/200`);
  // 더 작은 판(주민 하나)의 판은 어느 거짓말 요일에도 있다.
  for (const run of LIE_RUNS) {
    const boards = oneDayBoards(run);
    assert.ok(boards.length >= 20, `${run}: ${boards.length}`);
    for (const says of boards) assert.equal(bruteDays({ kind: 'day', people: [0], lies: [run], says, ask: 'day' }).length, 1);
  }
});

test('7단계: 질문 고르기. 질문 넷 가운데 쓸모 있는 질문은 하나뿐이고, 그것은 "제가 ‘○ 길이 마을로 가나요?’라고 물으면" 꼴이다. 길을 바로 묻는 질문이 늘 섞여 있다', () => {
  const at = Array(4).fill(0);
  for (const { board, solution } of boardsOf(7)) {
    const where = JSON.stringify(board);
    assert.equal(board.people.length, 1, where);
    assert.equal(board.questions.length, 4, where);
    assert.equal(new Set(board.questions.map((question) => JSON.stringify(question))).size, 4, `${where}: 같은 질문이 둘`);
    // 따로 적은 식으로 따져도 쓸모 있는 질문은 하나다.
    assert.deepEqual(bruteUsefulAt(board), solution.answer, where);
    assert.equal(solution.answer.length, 1, where);
    const useful = board.questions[solution.answer[0]];
    assert.ok(useful.q === 'would' && useful.inner.q === 'road', where);
    assert.ok(board.questions.some((question) => question.q === 'road'), `${where}: 길을 바로 묻는 질문이 없다`);
    assert.ok(board.questions.some((question) => question.q === 'would' && question.inner.q !== 'road'), `${where}: 되묻지만 길을 묻지 않는 질문이 없다`);
    assert.ok(board.questions.every((question) => question.q !== 'kin'), where);
    at[solution.answer[0]] += 1;
  }
  assert.ok(at.every((count) => count >= 25), `쓸모 있는 질문의 자리 ${at.join()}`);
  assert.ok(QUESTIONS.useful.every((question) => judgeQuestion(question).useful));
  assert.ok([...QUESTIONS.plainRoad, ...QUESTIONS.wouldOther, ...QUESTIONS.other].every((question) => !judgeQuestion(question).useful));
});

test('요일 판의 배정은 오늘의 요일로 주민의 종류가 정해진다', () => {
  const board = generateBoard(6, 1).board;
  const world = dayWorld(board, generateBoard(6, 1).solution.answer);
  assert.deepEqual(world.kinds, board.lies.map((run) => !run.includes(world.day)));
  assert.deepEqual(worldsOf(board), [world]);
  assert.equal(checkBoard(board), null);
});

test('판 하나를 만드는 데 오래 걸리지 않는다(가장 오래 걸린 판도 50ms 안쪽)', () => {
  let slowest = 0;
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of SEEDS.slice(0, 100)) {
      const start = performance.now();
      generateBoard(level, seed + 1000);
      slowest = Math.max(slowest, performance.now() - start);
    }
  }
  assert.ok(slowest < 50, `${slowest.toFixed(1)}ms`);
});

test('쳐 보기를 아무렇게나 누를 때 맞는 배정에 닿기까지의 횟수(단계별)', () => {
  const summary = {};
  for (const level of [1, 2, 3, 4]) {
    const values = boardsOf(level)
      .map(({ board }) => expectedPresses(board))
      .filter((value) => value !== null)
      .sort((a, b) => a - b);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    summary[level] = { mean: Number(mean.toFixed(1)), low: Number(values[0].toFixed(1)), mid: Number(values[Math.floor(values.length / 2)].toFixed(1)), high: Number(values.at(-1).toFixed(1)) };
  }
  // 주민이 많을수록, 길이 있을수록 아무렇게나 눌러서는 닿기 어렵다.
  assert.ok(summary[1].mean < summary[3].mean && summary[3].mean < summary[4].mean, JSON.stringify(summary));
  assert.ok(summary[1].low >= 8, '1단계도 한두 번 눌러서 닿는 판은 없다');
  assert.equal(summary[2].mean, 3);
});
