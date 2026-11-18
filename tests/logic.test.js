// 참말 섬의 규칙과 풀이 프로그램: 말이 참인지, 남는 배정, 군더더기 말, 쳐 보기와 따라가 보기, 질문의 쓸모, 오답 짐작.
// 풀이 프로그램이 낸 답은 따로 적은 풀이(tests/helpers/brute-logic.js)로 다시 구해 견준다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SAY_TYPES, sayPool } from '../src/core/logic-ladder.js';
import {
  allWorlds,
  blankGuess,
  boxAnswers,
  checkBoard,
  diagnose,
  expectedPresses,
  follow,
  guessFits,
  isLean,
  judgeQuestion,
  questionWorlds,
  replyOf,
  sayTruth,
  solve,
  spareSays,
  worldsOf,
} from '../src/core/logic.js';
import { createRng, randInt } from '../src/core/rng.js';
import { bruteAnswer, bruteBoxes, bruteReply, bruteUseful, bruteWorlds } from './helpers/brute-logic.js';

const T = true;
const L = false;
const folk = (n, says, ask = 'kinds') => ({ kind: 'folk', people: Array.from({ length: n }, (_, index) => index), says, ask });
const say = (by, s) => ({ by, s });

test('말이 참인가: 틀마다 뜻대로 따진다', () => {
  const world = { kinds: [T, L, L], road: 'left' };
  assert.equal(sayTruth(say(0, { t: 'me', k: true }), world), true);
  assert.equal(sayTruth(say(1, { t: 'me', k: false }), world), true);
  assert.equal(sayTruth(say(0, { t: 'is', who: 1, k: false }), world), true);
  assert.equal(sayTruth(say(0, { t: 'same', a: 1, b: 2 }), world), true);
  assert.equal(sayTruth(say(0, { t: 'diff', a: 0, b: 1 }), world), true);
  assert.equal(sayTruth(say(0, { t: 'all', k: false }), world), false);
  assert.equal(sayTruth(say(0, { t: 'liars', n: 2 }), world), true);
  assert.equal(sayTruth(say(0, { t: 'some' }), world), true);
  assert.equal(sayTruth(say(0, { t: 'some' }), { kinds: [T, T, T], road: null }), false);
  // "이거나"는 둘 다여도 참이다.
  assert.equal(sayTruth(say(0, { t: 'or', a: 1, ak: false, b: 2, bk: false }), world), true);
  assert.equal(sayTruth(say(0, { t: 'or', a: 0, ak: false, b: 1, bk: true }), world), false);
  assert.equal(sayTruth(say(0, { t: 'road', side: 'left' }), world), true);
  assert.equal(allWorlds(3).length, 8);
  assert.equal(allWorlds(2, true).length, 8);
  assert.deepEqual(allWorlds(2)[0].kinds, [T, T], '첫째 배정은 모두 참말쟁이');
});

test('잘 알려진 판: 누구도 "나는 거짓말쟁이예요"라고 못 한다. "우리는 모두 거짓말쟁이예요"는 말한 주민이 거짓말쟁이다', () => {
  assert.equal(solve(folk(2, [say(0, { t: 'me', k: false })])).possible, false);
  assert.equal(worldsOf(folk(1, [say(0, { t: 'me', k: false })])).length, 0);
  // "나는 참말쟁이예요"는 누구나 할 수 있다(아무것도 알려 주지 않는다).
  assert.equal(worldsOf(folk(2, [say(0, { t: 'me', k: true })])).length, 4);
  const all = solve(folk(2, [say(0, { t: 'all', k: false })]));
  assert.deepEqual([all.possible, all.answer], [true, 'LT']);
  // 적어도 한 명은 거짓말쟁이: 말한 주민은 참말쟁이이고 다른 주민은 거짓말쟁이다.
  assert.equal(solve(folk(2, [say(0, { t: 'some' })])).answer, 'TL');
  // "B는 참말쟁이예요" / "A는 거짓말쟁이예요"는 둘 다 할 수 없다.
  assert.equal(solve(folk(2, [say(0, { t: 'is', who: 1, k: true }), say(1, { t: 'is', who: 0, k: false })])).possible, false);
  // 몰라도 정해진다: "길은 오른쪽" + "A와 나는 같은 쪽" → A는 참말쟁이, B는 모른다, 길은 오른쪽
  const road = { kind: 'road', people: [0, 1, 2], says: [say(0, { t: 'road', side: 'right' }), say(1, { t: 'same', a: 0, b: 1 })], ask: 'road' };
  const solved = solve(road);
  assert.deepEqual([solved.possible, solved.answer, solved.worlds], [true, 'right', 4]);
  assert.ok(isLean(road));
});

test('풀이 프로그램은 따로 적은 풀이와 같은 답을 낸다(주민 둘의 말 두 개 모두, 주민 셋의 말을 뽑은 판 3천 개)', () => {
  let checked = 0;
  const compare = (board) => {
    const solved = solve(board);
    const brute = bruteAnswer(board);
    assert.equal(solved.worlds === 0 ? 0 : worldsOf(board).length, bruteWorlds(board).length, JSON.stringify(board));
    if (brute === null) assert.equal(solved.possible, false);
    else if (brute === undefined) assert.equal(solved.possible, null);
    else assert.equal(solved.answer, brute);
    checked += 1;
  };
  const pairs = sayPool(2, [...SAY_TYPES.small, 'or']);
  for (let i = 0; i < pairs.length; i++) for (let j = i; j < pairs.length; j++) for (const ask of ['kinds', 'count']) compare(folk(2, i === j ? [pairs[i]] : [pairs[i], pairs[j]], ask));
  const pool = sayPool(3, SAY_TYPES.road);
  const rng = createRng(7);
  for (let round = 0; round < 3000; round++) {
    const says = Array.from({ length: randInt(rng, 1, 5) }, () => pool[randInt(rng, 0, pool.length - 1)]);
    const road = says.some((item) => item.s.t === 'road');
    compare(road ? { kind: 'road', people: [0, 1, 2], says, ask: 'road' } : folk(3, says, rng() < 0.5 ? 'kinds' : 'count'));
  }
  assert.ok(checked > 3000);
});

test('상자: 보물이 있을 수 있는 상자를 따로 적은 풀이와 견준다', () => {
  const labels = (box, n) => [{ t: 'here' }, { t: 'not-here' }, ...Array.from({ length: n }, (_, other) => [{ t: 'in', box: other }, { t: 'not-in', box: other }]).flat().filter((label) => label.box !== box), { t: 'in-or', a: 0, b: 1 }, { t: 'in-or', a: 1, b: 2 }];
  let checked = 0;
  for (const a of labels(0, 3)) {
    for (const b of labels(1, 3)) {
      for (const c of labels(2, 3)) {
        for (const rule of [{ of: 'true', n: 1 }, { of: 'false', n: 1 }, { of: 'true', n: 2 }]) {
          const board = { kind: 'box', labels: [a, b, c], rule, ask: 'box' };
          assert.equal(checkBoard(board), null);
          assert.deepEqual(boxAnswers(board), bruteBoxes(board));
          checked += 1;
        }
      }
    }
  }
  assert.ok(checked > 1000);
});

test('군더더기 말: 빼도 답이 그대로인 말을 찾는다. "나는 참말쟁이예요"는 따로 센다', () => {
  // A: "우리는 모두 거짓말쟁이예요"만으로 정해진다. B의 말은 군더더기다.
  const board = folk(2, [say(0, { t: 'all', k: false }), say(1, { t: 'is', who: 0, k: false })]);
  assert.equal(solve(board).possible, true);
  assert.deepEqual(spareSays(board), [1]);
  assert.equal(isLean(folk(2, [say(0, { t: 'all', k: false })])), true, '하나뿐인 말은 늘 꼭 필요하다');
  // 남는 배정이 없는 판: 하나를 빼면 배정이 생겨야 군더더기가 없다.
  const none = folk(2, [say(0, { t: 'is', who: 1, k: true }), say(1, { t: 'is', who: 0, k: false })]);
  assert.equal(isLean(none), true);
  assert.equal(isLean(folk(2, [...none.says, say(0, { t: 'all', k: true })])), false);
  // 쓸모없는 말은 군더더기로 세지 않는다(판마다 많아야 하나 넣는다).
  assert.equal(isLean(folk(2, [say(0, { t: 'all', k: false }), say(1, { t: 'me', k: true })])), true);
  assert.deepEqual(spareSays(folk(2, [say(0, { t: 'all', k: false }), say(1, { t: 'me', k: true })]), { keepUseless: false }), [1]);
});

test('따라가 보기: 쳐 본 대로 말이 참인지 거짓인지, 말한 주민과 맞지 않는지를 구한다. 모르는 자리가 있으면 정해지는 것만 적는다', () => {
  const board = folk(2, [say(0, { t: 'all', k: false })]);
  const blank = blankGuess(board);
  assert.deepEqual(follow(board, blank).says, [{ truth: null, clash: false }]);
  // 하마를 참말쟁이라고 치면 그 말은 거짓이 되고, 맞지 않는다.
  assert.deepEqual(follow(board, { ...blank, kinds: [T, null] }).says, [{ truth: false, clash: true }]);
  // 거짓말쟁이라고 쳐도 다른 주민을 모르면 아직 모른다.
  assert.deepEqual(follow(board, { ...blank, kinds: [L, null] }).says, [{ truth: null, clash: false }]);
  assert.equal(follow(board, { ...blank, kinds: [L, T] }).done, true);
  assert.equal(guessFits(board, { ...blank, kinds: [L, T] }), true);
  assert.equal(guessFits(board, { ...blank, kinds: [L, L] }), false);
  // 상자: 참인 글의 수와 조건
  const box = { kind: 'box', labels: [{ t: 'here' }, { t: 'not-here' }, { t: 'not-in', box: 0 }], rule: { of: 'true', n: 1 }, ask: 'box' };
  assert.deepEqual(follow(box, { ...blankGuess(box), box: 0 }), { truths: [true, true, false], count: 2, fits: false, done: false });
  assert.equal(follow(box, { ...blankGuess(box), box: 1 }).fits, true);
  // 질문: 주민과 길을 모르면 "당신은 참말쟁이인가요?"만 대답이 정해진다(늘 "예").
  const ask = { kind: 'question', people: [0], questions: [{ q: 'me' }, { q: 'road', side: 'left' }, { q: 'kin', side: 'left' }], ask: 'question' };
  assert.deepEqual(follow(ask, blankGuess(ask)).replies, [true, null, null]);
  assert.deepEqual(follow(ask, { ...blankGuess(ask), road: 'left' }).replies, [true, null, true]);
});

test('질문의 쓸모: 대답만 듣고 길이 정해지면 쓸모 있다. 따로 적은 식과 견준다', () => {
  const all = [
    { q: 'road', side: 'left' },
    { q: 'road', side: 'right' },
    { q: 'me' },
    { q: 'fact', yes: true },
    { q: 'fact', yes: false },
    { q: 'kin', side: 'left' },
    { q: 'kin', side: 'right' },
    { q: 'would', side: 'left' },
    { q: 'would', side: 'right' },
  ];
  for (const question of all) {
    for (const world of questionWorlds()) assert.equal(replyOf(question, world), bruteReply(question, world.kinds[0], world.road === 'left'), JSON.stringify([question, world]));
    assert.equal(judgeQuestion(question).useful, bruteUseful(question), JSON.stringify(question));
  }
  assert.deepEqual(
    all.map((question) => judgeQuestion(question).useful),
    [false, false, false, false, false, true, true, true, true],
  );
  // 쓸모없는 질문에는 같은 대답이 나오는데 길이 다른 두 경우가 있다.
  const { clash } = judgeQuestion({ q: 'road', side: 'left' });
  assert.notEqual(clash.worlds[0].road, clash.worlds[1].road);
  assert.equal(judgeQuestion({ q: 'me' }).clash.reply, true);
});

test('쳐 보기를 아무렇게나 누를 때의 횟수: 모든 경우를 따진 값이 뽑아 본 값과 맞는다', () => {
  const boards = [folk(2, [say(0, { t: 'all', k: false })]), folk(3, [say(1, { t: 'some' }), say(0, { t: 'same', a: 1, b: 2 })]), { kind: 'box', labels: [{ t: 'here' }, { t: 'not-here' }, { t: 'not-in', box: 0 }], rule: { of: 'true', n: 1 }, ask: 'box' }];
  for (const board of boards) {
    const exact = expectedPresses(board);
    const rng = createRng(11);
    let total = 0;
    const runs = 20000;
    for (let run = 0; run < runs; run++) {
      const guess = blankGuess(board);
      let presses = 0;
      while (!guessFits(board, guess)) {
        presses += 1;
        if (board.kind === 'box') {
          const at = randInt(rng, 0, board.labels.length - 1);
          guess.box = guess.box === at ? null : at;
        } else {
          const at = randInt(rng, 0, guess.kinds.length - 1);
          guess.kinds[at] = guess.kinds[at] === null ? true : guess.kinds[at] === true ? false : null;
        }
      }
      total += presses;
    }
    assert.ok(Math.abs(total / runs - exact) < exact * 0.05, `${JSON.stringify(board)}: ${exact} / ${total / runs}`);
  }
  assert.equal(expectedPresses(folk(2, [say(0, { t: 'me', k: false })])), null, '맞는 배정이 없으면 닿을 수 없다');
});

test('오답 짐작: 낸 배정에서 맞지 않게 되는 첫 말을 짚는다. "누구도 할 수 없어요"를 잘못 누르면 맞는 경우가 남아 있다고 한다', () => {
  const board = folk(2, [say(1, { t: 'is', who: 0, k: false }), say(0, { t: 'all', k: false })]);
  assert.equal(solve(board).answer, 'LT');
  const right = diagnose(board, { type: 'kinds', kinds: [L, T] });
  assert.deepEqual([right.correct, right.guess], [true, null]);
  // 둘 다 참말쟁이라고 답하면: 첫째 말(B: "A는 거짓말쟁이예요")이 거짓이 되어 B와 맞지 않는다.
  const wrong = diagnose(board, { type: 'kinds', kinds: [T, T] });
  assert.deepEqual([wrong.correct, wrong.guess, wrong.say], [false, 'kinds-clash', 0]);
  // 둘 다 거짓말쟁이라고 답하면: 첫째 말은 참이 되어 B와 맞지 않는다.
  assert.equal(diagnose(board, { type: 'kinds', kinds: [L, L] }).say, 0);
  // A만 참말쟁이라고 답하면: 첫째 말은 거짓(B와 맞음), 둘째 말이 A와 맞지 않는다.
  assert.equal(diagnose(board, { type: 'kinds', kinds: [T, L] }).say, 1);
  assert.equal(diagnose(board, { type: 'none' }).guess, 'none-on-possible');
  // 남는 배정이 없는 판: "누구도 할 수 없어요"가 답이고, 배정으로 답하면 맞지 않는 말을 짚는다.
  const none = folk(2, [say(0, { t: 'is', who: 1, k: true }), say(1, { t: 'is', who: 0, k: false })]);
  assert.equal(diagnose(none, { type: 'none' }).correct, true);
  assert.equal(diagnose(none, { type: 'kinds', kinds: [T, T] }).say, 1);
  // 몇 명: 지금 쳐 본 것이 그 수이면 맞지 않는 말을 짚고, 아니면 짚지 않는다.
  // "B와 C는 다른 쪽" + "적어도 한 명은 거짓말쟁이": A가 무엇이든 거짓말쟁이는 한 명이다(A는 참말쟁이, B와 C 가운데 하나).
  const count = folk(3, [say(0, { t: 'diff', a: 1, b: 2 }), say(0, { t: 'some' })], 'count');
  const solved = solve(count);
  assert.deepEqual([solved.possible, solved.answer, solved.worlds], [true, 1, 2]);
  assert.equal(diagnose(count, { type: 'count', n: 1 }).correct, true);
  assert.deepEqual([diagnose(count, { type: 'count', n: 2 }).guess, diagnose(count, { type: 'count', n: 2 }).say], ['count-clash', null]);
  // 지금 쳐 본 것(A 거짓말쟁이, B 거짓말쟁이, C 참말쟁이)이 그 수(두 명)이면, 그 가정에서 맞지 않는 첫 말을 짚는다.
  const pointed = diagnose(count, { type: 'count', n: 2 }, { kinds: [L, L, T], road: null, box: null });
  assert.deepEqual([pointed.guess, pointed.say], ['count-clash', 0]);
  // 상자: 그 상자면 참인 글이 몇 개인지
  const box = { kind: 'box', labels: [{ t: 'here' }, { t: 'not-here' }, { t: 'not-in', box: 0 }], rule: { of: 'true', n: 1 }, ask: 'box' };
  assert.deepEqual([diagnose(box, { type: 'box', at: 0 }).count, diagnose(box, { type: 'box', at: 2 }).count, diagnose(box, { type: 'box', at: 1 }).correct], [2, 2, true]);
  // 질문: 쓸모없는 질문이면 길이 달라도 같이 나오는 대답
  const ask = { kind: 'question', people: [0], questions: [{ q: 'me' }, { q: 'would', side: 'left' }], ask: 'question' };
  assert.deepEqual([diagnose(ask, { type: 'question', at: 0 }).reply, diagnose(ask, { type: 'question', at: 1 }).correct], [true, true]);
});

test('판 검사: 꼴이 맞지 않는 판을 걸러 낸다', () => {
  assert.equal(checkBoard(folk(2, [say(0, { t: 'all', k: false })])), null);
  assert.notEqual(checkBoard(folk(2, [])), null);
  assert.notEqual(checkBoard(folk(2, [say(0, { t: 'is', who: 0, k: true })])), null, '자기를 가리키는 말은 "나는"으로 한다');
  assert.notEqual(checkBoard(folk(2, [say(2, { t: 'some' })])), null);
  assert.notEqual(checkBoard({ ...folk(2, [say(0, { t: 'road', side: 'left' })]) }), null, '주민 판에는 길이 없다');
  assert.notEqual(checkBoard({ kind: 'folk', people: [0, 0], says: [say(0, { t: 'some' })], ask: 'kinds' }), null, '같은 동물이 둘');
  assert.notEqual(checkBoard({ kind: 'box', labels: [{ t: 'in', box: 0 }, { t: 'here' }, { t: 'here' }], rule: { of: 'true', n: 1 }, ask: 'box' }), null);
  assert.notEqual(checkBoard(null), null);
});
