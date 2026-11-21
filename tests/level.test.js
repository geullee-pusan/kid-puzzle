// 수준 맞추기 규칙. 기록 목록 → 다음에 권할 것.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { finishedCount, lostStreak, whyOpen as duelWhyOpen } from '../src/core/duel.js';
import { TUNING, latestById, recommend, tuningFor, whyUnlocked, withoutSide } from '../src/core/level.js';
import { whyOpen as tileWhyOpen } from '../src/core/tile.js';

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

// ---- 형식마다 값을 따로 둔다 ----

/** 한붓그리기 기록 하나. 기본값은 "1단계를 힌트 없이 한 번에 30초 만에 끝까지 그음"이다. */
function trace(overrides = {}) {
  serial += 1;
  return {
    kind: 'round',
    id: `t${serial}`,
    format: 'trace',
    level: 1,
    custom: false,
    solution: { possible: true, starts: [0, 3], path: [0, 1, 3, 0, 2, 3] },
    strokeCount: 5,
    hintsOpened: 0,
    answers: [{ t: 25, answer: 'traced', correct: true, guess: null }],
    seconds: 30,
    outcome: 'solved',
    ...overrides,
  };
}

test('형식마다 값을 따로 둔다: 한붓그리기는 1단계에서 시작하고, 그림을 만들어 내는 단계는 1~7단계다', () => {
  assert.deepEqual(Object.keys(TUNING.formats).sort(), ['block', 'code', 'coins', 'cups', 'dandelion', 'duel', 'logic', 'maze', 'river', 'rulehunt', 'swap', 'tax', 'tile', 'trace', 'untangle', 'lamps', 'rooms', 'machine', 'split', 'eyeball', 'cutpaste', 'fold', 'domino', 'pieces', 'magic', 'apart', 'keymaze', 'cipher', 'seqpath', 'pancake', 'product', 'sim', 'matches', 'fair', 'rowflip', 'foxrabbit', 'pins', 'net', 'regionmap'].sort());
  assert.deepEqual(recommend([], 'trace'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  assert.equal(tuningFor('trace').startLevel, 1);
  assert.equal(tuningFor('trace').bottomLevel, 1);
  assert.equal(tuningFor('trace').topLevel, 7);
  assert.equal(tuningFor('trace').hintCount, 2);
  assert.deepEqual(Object.keys(tuningFor('trace').expectedSeconds), ['1', '2', '3', '4', '5', '6', '7']);
  // 함께 쓰는 값은 그대로 물려받는다.
  assert.equal(tuningFor('trace').fastStreak, TUNING.fastStreak);
  assert.equal(tuningFor('trace').quitStreak, TUNING.quitStreak);
  // 따로 적지 않은 형식은 맨 위의 값을 쓴다.
  assert.equal(tuningFor('coins').startLevel, 2);
  assert.equal(tuningFor('paths').startLevel, TUNING.startLevel);
});

test('한 형식의 기록은 다른 형식의 수준에 영향을 주지 않는다', () => {
  const coins = [round(), round()];
  const traces = [trace({ level: 3, outcome: 'left', hintsOpened: 2, answers: [] })];
  assert.equal(recommend([...coins, ...traces], 'coins').reason, 'fast');
  assert.deepEqual(recommend([...coins, ...traces], 'trace'), { level: 2, small: false, offerHarder: false, harderLevel: null, reason: 'stuck' });
  assert.equal(recommend(coins, 'trace').reason, 'start');
  assert.equal(whyUnlocked([round({ solution: { possible: false, min: null } })], 'trace'), false);
  assert.equal(whyUnlocked([trace({ solution: { possible: false, starts: [], path: [] } })], 'trace'), true);
  assert.equal(whyUnlocked([trace({ solution: { possible: false, starts: [], path: [] } })], 'coins'), false);
});

test('한붓그리기: 연달아 2판을 빠르게 한 번에 맞히면 더 어려운 판을 권하고, 맨 위(7단계)에서는 직접 만들기(8단계)를 권한다', () => {
  assert.deepEqual(recommend([trace(), trace()], 'trace'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  assert.equal(recommend([trace({ level: 4 }), trace({ level: 4 })], 'trace').harderLevel, 5);
  const top = recommend([trace({ level: 7, answers: [{ t: 9, answer: 'twin:left', correct: true, guess: null }], seconds: 20 }), trace({ level: 7, answers: [{ t: 9, answer: 'twin:right', correct: true, guess: null }], seconds: 20 })], 'trace');
  assert.equal(top.offerHarder, true);
  assert.equal(top.harderLevel, 8);
  // 펜 몇 번 떼기: 처음 모두 그은 것이 가장 적게 뗀 것이어야(wrongCount가 0) 한 번에 맞힌 판이다.
  const pen = (wrongCount) => trace({ level: 5, seconds: 60, wrongCount, answers: [{ t: 30, answer: 'lifts:2', correct: wrongCount === 0, guess: null }] });
  assert.equal(recommend([pen(0), pen(0)], 'trace').offerHarder, true);
  assert.equal(recommend([pen(0), pen(1)], 'trace').offerHarder, false);
  // 예상 시간은 형식마다 다르다: 한붓그리기 2단계는 40초 안쪽이어야 "빠르게"다.
  const slow = tuningFor('trace').expectedSeconds[2];
  assert.equal(recommend([trace({ level: 2, seconds: slow - 1 }), trace({ level: 2, seconds: slow })], 'trace').offerHarder, false);
  assert.equal(recommend([trace({ level: 2, seconds: slow - 1 }), trace({ level: 2, seconds: slow - 1 })], 'trace').offerHarder, true);
  // "불가능해요"로 한 번 틀리고 끝까지 그은 판은 한 번에 맞힌 판이 아니다.
  const retried = trace({ answers: [{ t: 5, answer: 'impossible', correct: false, guess: 'impossible-no-try' }, { t: 25, answer: 'traced', correct: true, guess: null }] });
  assert.equal(recommend([trace(), retried], 'trace').offerHarder, false);
});

test('한붓그리기: 맨 아래 단계에서 막히면 작은 그림을 먼저 보여 주고, 직접 만든 그림과 만들기 단계는 보지 않는다', () => {
  const stuck = trace({ outcome: 'left', hintsOpened: 2, answers: [] });
  assert.deepEqual(recommend([stuck], 'trace'), { level: 1, small: true, offerHarder: false, harderLevel: null, reason: 'stuck' });
  // 예전의 직접 만들기 단계(5단계)에서 그은 판도 지금의 5단계(펜 몇 번 떼기)로 세지 않는다. 지금의 8단계도 그렇다.
  const custom = trace({ level: 5, custom: true, outcome: 'left' });
  assert.equal(recommend([custom, custom], 'trace').reason, 'start');
  const made = trace({ level: 8, custom: true, outcome: 'left' });
  assert.equal(recommend([made, made], 'trace').reason, 'start');
});

test('한붓그리기: 선을 긋거나 그림을 고친 판은 손댄 판으로 센다. 들여다보기만 한 판은 세지 않는다', () => {
  const peek = () => trace({ level: 3, outcome: 'left', answers: [], strokeCount: 0, editCount: 0, hintsOpened: 0 });
  assert.equal(recommend([peek(), peek()], 'trace').reason, 'start');
  const drew = () => trace({ level: 3, outcome: 'left', answers: [], strokeCount: 4 });
  assert.equal(recommend([drew(), drew()], 'trace').reason, 'quit');
  const edited = () => trace({ level: 4, outcome: 'left', answers: [], strokeCount: 0, editCount: 1 });
  assert.deepEqual(recommend([edited(), edited()], 'trace'), { level: 3, small: false, offerHarder: false, harderLevel: null, reason: 'quit' });
});

test('작은 판(곁판)의 기록은 세지 않는다: 수준도, 권하기도, "왜 그럴까?"가 열리는 때도 바꾸지 않는다', () => {
  const side = (overrides = {}) => round({ side: true, sideOf: 'r-origin', sideTurn: 0, seed: null, ...overrides });
  // 빼는 함수: side가 true인 기록만 뺀다. 예전 기록(side가 없다)과 다른 종류의 기록은 그대로 둔다.
  const plain = round();
  assert.deepEqual(withoutSide([plain, side(), { kind: 'made' }, null, side({ outcome: 'left' })]), [plain, { kind: 'made' }, null]);
  assert.deepEqual(withoutSide(undefined), []);
  // 작은 판만 있으면 기록이 없는 것과 같다.
  assert.deepEqual(recommend([side(), side(), side()]), recommend([]));
  // 작은 판을 빠르게 연달아 풀어도 더 어려운 판을 권하지 않는다.
  assert.equal(recommend([round(), side(), side()]).offerHarder, false);
  assert.deepEqual(recommend([round(), side(), round()]), recommend([round(), round()]));
  // 작은 판을 그만두거나 힌트를 다 열고 못 풀어도 내려가지 않는다.
  const quitSide = () => side({ level: 4, outcome: 'left', answers: [], flipCount: 3, hintsOpened: 2 });
  assert.deepEqual(recommend([round({ level: 4, seconds: 300 }), quitSide(), quitSide()]), { level: 4, small: false, offerHarder: false, harderLevel: null, reason: 'steady' });
  // 권할 단계는 마지막으로 한 "원래 판"의 단계다.
  assert.equal(recommend([round({ level: 3 }), side({ level: 5 })]).level, 3);
  // 작은 판에서 안 되는 판을 알아냈어도 "왜 그럴까?"는 열리지 않는다.
  const impossible = { solution: { possible: false, min: null }, answers: [{ t: 9, answer: 'impossible', correct: true, guess: null }] };
  assert.equal(whyUnlocked([side(impossible)]), false);
  assert.equal(whyUnlocked([side(impossible), round(impossible)]), true);
  // 형식마다 따로 여는 문도 같다.
  assert.equal(whyUnlocked([side({ format: 'code' })], 'code'), false);
  assert.equal(whyUnlocked([side({ format: 'swap', fewest: true })], 'swap'), false);
  assert.equal(whyUnlocked([side({ format: 'tax', reachedBest: true })], 'tax'), false);
  const duel = (overrides = {}) => round({ format: 'duel', mode: 'one', winner: 'teacher', ...overrides });
  assert.equal(finishedCount([duel(), duel(), duel({ side: true })], 'one'), 2);
  assert.equal(duelWhyOpen([duel(), duel(), duel({ side: true })], 'one'), false);
  assert.equal(duelWhyOpen([duel(), duel(), duel()], 'one'), true);
  assert.equal(lostStreak([duel(), duel({ side: true, winner: 'kid' })]), 1);
  const tile = (overrides = {}) => round({ format: 'tile', board: { w: 4, h: 4, piece: 'domino', holes: [0, 15] }, solution: { possible: false }, ...overrides });
  assert.equal(tileWhyOpen([tile({ side: true })], 'domino'), false);
  assert.equal(tileWhyOpen([tile()], 'domino'), true);
});
