// 수준 맞추기 규칙. 기록 목록 → 다음에 권할 것.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { TUNING, latestById, recommend, whyUnlocked } from '../src/core/level.js';

let serial = 0;
/** 기록 하나를 만든다. 기본값은 "2단계를 힌트 없이 한 번에 30초 만에 맞힘"이다. */
function round(overrides = {}) {
  serial += 1;
  return {
    kind: 'round',
    id: `r${serial}`,
    format: 'coins',
    level: 2,
    custom: false,
    solution: { possible: true, min: 2 },
    flipCount: 2,
    hintsOpened: 0,
    answers: [{ t: 20, answer: 2, correct: true, guess: null }],
    seconds: 30,
    outcome: 'solved',
    ...overrides,
  };
}
const wrong = { t: 10, answer: 5, correct: false, guess: 'too-many' };
const right = { t: 20, answer: 2, correct: true, guess: null };

test('기록이 없으면 처음 보여 줄 단계(임시: 2단계)를 권한다', () => {
  assert.equal(TUNING.startLevel, 2);
  assert.deepEqual(recommend([]), { level: 2, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  assert.equal(recommend(undefined).reason, 'start');
  assert.equal(recommend([null, 'x', { kind: 'made' }]).reason, 'start');
});

test('한 판만 빠르게 맞혔으면 그대로 둔다', () => {
  assert.deepEqual(recommend([round()]), { level: 2, small: false, offerHarder: false, harderLevel: null, reason: 'steady' });
});

test('같은 단계를 연달아 2판, 힌트 없이 한 번에 빠르게 맞히면 더 어려운 판을 권한다', () => {
  const result = recommend([round(), round()]);
  assert.deepEqual(result, { level: 2, small: false, offerHarder: true, harderLevel: 3, reason: 'fast' });
});

test('권하기만 한다: 보여 줄 단계는 그대로다', () => {
  assert.equal(recommend([round({ level: 4, seconds: 60 }), round({ level: 4, seconds: 60 })]).level, 4);
});

test('맨 위 단계에서 권하는 더 어려운 판은 직접 만들기(6단계)다', () => {
  const result = recommend([round({ level: 5, seconds: 100 }), round({ level: 5, seconds: 100 })]);
  assert.equal(result.offerHarder, true);
  assert.equal(result.harderLevel, 6);
});

test('힌트를 열었거나, 한 번 틀렸거나, 느렸거나, 단계가 달랐으면 권하지 않는다', () => {
  assert.equal(recommend([round(), round({ hintsOpened: 1 })]).offerHarder, false);
  assert.equal(recommend([round(), round({ answers: [wrong, right] })]).offerHarder, false);
  assert.equal(recommend([round(), round({ seconds: TUNING.expectedSeconds[2] })]).offerHarder, false);
  assert.equal(recommend([round({ level: 1 }), round({ level: 2 })]).offerHarder, false);
  assert.equal(recommend([round(), round({ seconds: undefined })]).offerHarder, false);
});

test('한두 번 틀리거나 힌트 하나로 풀면 그대로 둔다', () => {
  const result = recommend([round({ answers: [wrong, wrong, right], hintsOpened: 1, seconds: 200 })]);
  assert.deepEqual(result, { level: 2, small: false, offerHarder: false, harderLevel: null, reason: 'steady' });
});

test('힌트를 다 열고도 못 풀면 다음에는 한 단계 아래를 먼저 보여 준다', () => {
  const stuck = round({ level: 3, outcome: 'left', hintsOpened: 2, answers: [wrong] });
  assert.deepEqual(recommend([round(), stuck]), { level: 2, small: false, offerHarder: false, harderLevel: null, reason: 'stuck' });
  const sawSolution = round({ level: 4, outcome: 'solution', hintsOpened: 2, answers: [] });
  assert.equal(recommend([sawSolution]).level, 3);
});

test('힌트를 다 열었어도 풀었으면 내려가지 않는다', () => {
  assert.equal(recommend([round({ hintsOpened: 2, seconds: 300 })]).reason, 'steady');
});

test('연달아 2판 그만두면 다음에는 한 단계 아래를 먼저 보여 준다', () => {
  const quit = () => round({ level: 4, outcome: 'left', answers: [], flipCount: 3 });
  assert.equal(recommend([quit()]).reason, 'steady');
  assert.deepEqual(recommend([quit(), quit()]), { level: 3, small: false, offerHarder: false, harderLevel: null, reason: 'quit' });
  // 사이에 푼 판이 있으면 연달아가 아니다.
  assert.equal(recommend([quit(), round({ level: 4, seconds: 500 }), quit()]).reason, 'steady');
});

test('맨 아래 단계에서는 더 내려가지 않고 동전 수가 적은 판을 먼저 보여 준다', () => {
  const stuck = round({ level: 1, outcome: 'left', hintsOpened: 2 });
  assert.deepEqual(recommend([stuck]), { level: 1, small: true, offerHarder: false, harderLevel: null, reason: 'stuck' });
});

test('들여다보기만 하고 나간 판은 세지 않는다', () => {
  const peek = () => round({ level: 5, outcome: 'left', answers: [], flipCount: 0, hintsOpened: 0 });
  assert.equal(recommend([peek(), peek()]).reason, 'start');
  assert.deepEqual(recommend([round(), round(), peek(), peek()]).reason, 'fast');
});

test('직접 만든 판과 다른 형식의 기록은 보지 않는다', () => {
  const custom = round({ level: 6, custom: true, outcome: 'left', flipCount: 4 });
  const other = round({ format: 'paths', outcome: 'left', flipCount: 4 });
  const made = { kind: 'made', id: 'm1', format: 'coins' };
  assert.equal(recommend([custom, custom, other, other, made]).reason, 'start');
});

test('같은 판의 기록이 두 번 남았으면 뒤의 것으로 본다(나갔다가 돌아와서 푼 판)', () => {
  const left = round({ id: 'same', outcome: 'left', hintsOpened: 2, answers: [wrong] });
  const done = { ...left, outcome: 'solved', answers: [wrong, right] };
  assert.equal(latestById([left, done]).length, 1);
  assert.equal(recommend([left]).reason, 'stuck');
  assert.equal(recommend([left, done]).reason, 'steady');
});

test('기록에서 언제든 다시 계산할 수 있다: 같은 기록이면 같은 결과이고, 기록을 바꾸지 않는다', () => {
  const records = [round(), round({ level: 3, outcome: 'left', hintsOpened: 2 }), round()];
  const copy = JSON.parse(JSON.stringify(records));
  assert.deepEqual(recommend(records), recommend(copy));
  assert.deepEqual(records, copy);
});

test('임시값을 바꿔 넣을 수 있다', () => {
  const tuning = { ...TUNING, fastStreak: 3, startLevel: 1 };
  assert.equal(recommend([], 'coins', tuning).level, 1);
  assert.equal(recommend([round(), round()], 'coins', tuning).offerHarder, false);
  assert.equal(recommend([round(), round(), round()], 'coins', tuning).offerHarder, true);
});

test('"왜 그럴까?"는 안 되는 판을 한 번 이상 끝까지 만난 뒤에 열린다', () => {
  const impossible = { possible: false, min: null };
  assert.equal(whyUnlocked([]), false);
  assert.equal(whyUnlocked(undefined), false);
  assert.equal(whyUnlocked([round()]), false);
  assert.equal(whyUnlocked([round({ solution: impossible, outcome: 'left' })]), false);
  assert.equal(whyUnlocked([round({ solution: impossible, outcome: 'solved' })]), true);
  assert.equal(whyUnlocked([round({ solution: impossible, outcome: 'solution' })]), true);
  assert.equal(whyUnlocked([round({ solution: impossible, format: 'paths' })]), false);
  assert.equal(whyUnlocked([round({ solution: impossible, level: 6, custom: true })]), true);
});
