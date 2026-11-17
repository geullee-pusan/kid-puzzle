// 숫자 추리의 규칙과 풀이 프로그램 점검.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MODES,
  allCodes,
  checkBoard,
  checkCode,
  checkDigits,
  checkRows,
  diagnoseReply,
  diagnoseTable,
  filterCodes,
  firstMismatch,
  fits,
  fitsAll,
  isLean,
  judge,
  nextGuess,
  playComputer,
  solveTable,
  trailOf,
} from '../src/core/code.js';

const SIX = '123456';
const TEN = '0123456789';

/**
 * 두 수를 매기는 다른 방법. 풀이 프로그램은 추측의 숫자를 하나씩 암호에서 찾는다.
 * 여기서는 두 글자열의 숫자를 한데 모아 서로 다른 숫자의 수를 세고(겹친 만큼 줄어든다),
 * 자리는 같은 자리의 글자를 짝지어 센다.
 */
function judgeOtherWay(guess, secret) {
  const hit = guess.length + secret.length - new Set(guess + secret).size;
  const place = [...guess].filter((ch, index) => ch === secret[index]).length;
  return { hit, place };
}

test('두 수 매기기: 손으로 따진 보기와 같다', () => {
  assert.deepEqual(judge('123', '123'), { hit: 3, place: 3 });
  assert.deepEqual(judge('123', '456'), { hit: 0, place: 0 });
  assert.deepEqual(judge('123', '312'), { hit: 3, place: 0 });
  assert.deepEqual(judge('123', '145'), { hit: 1, place: 1 });
  assert.deepEqual(judge('514', '416'), { hit: 2, place: 1 });
  assert.deepEqual(judge('0479', '9470'), { hit: 4, place: 2 });
  assert.deepEqual(judge('012', '601'), { hit: 2, place: 0 });
});

test('두 수 매기기: 다른 방법으로 센 것과 모든 짝에서 같다(1~6 세 자리, 0~9 세 자리, 0~9 네 자리의 일부)', () => {
  for (const [length, digits, step] of [
    [3, SIX, 1],
    [3, TEN, 1],
    [4, TEN, 37],
  ]) {
    const codes = allCodes(length, digits);
    let checked = 0;
    for (let a = 0; a < codes.length; a += step) {
      for (let b = 0; b < codes.length; b += step) {
        const result = judge(codes[a], codes[b]);
        assert.deepEqual(result, judgeOtherWay(codes[a], codes[b]), `${codes[a]} / ${codes[b]}`);
        // 자리도 맞는 것은 들어 있는 것 가운데서 센다. 하나만 자리가 틀릴 수는 없다.
        assert.ok(result.place <= result.hit);
        assert.ok(!(result.hit === length && result.place === length - 1));
        checked += 1;
      }
    }
    assert.ok(checked >= 120 * 120);
  }
});

test('두 수 매기기: 추측과 암호를 바꿔도 같고, 자리까지 다 맞는 것은 같은 암호뿐이다', () => {
  const codes = allCodes(3, TEN);
  for (let a = 0; a < codes.length; a += 7) {
    for (let b = 0; b < codes.length; b += 5) {
      assert.deepEqual(judge(codes[a], codes[b]), judge(codes[b], codes[a]));
      assert.equal(judge(codes[a], codes[b]).place === 3, codes[a] === codes[b]);
    }
  }
});

test('후보 모두 만들기: 1~6에서 셋은 120개, 0~9에서 셋은 720개, 넷은 5040개', () => {
  for (const [length, digits, count] of [
    [3, SIX, 120],
    [3, TEN, 720],
    [4, TEN, 5040],
    [3, '12345', 60],
  ]) {
    const codes = allCodes(length, digits);
    assert.equal(codes.length, count);
    assert.equal(new Set(codes).size, count, '겹치는 암호가 없다');
    for (const code of codes) assert.equal(checkCode(code, length, digits), null, code);
    assert.deepEqual(codes, codes.slice().sort(), '작은 것부터 늘어선다');
  }
  assert.equal(allCodes(3, SIX)[0], '123');
  assert.equal(allCodes(3, SIX).at(-1), '654');
});

test('암호와 숫자 묶음 점검: 길이, 쓸 수 없는 숫자, 같은 숫자 두 번', () => {
  assert.equal(checkCode('123', 3, SIX), null);
  assert.equal(checkCode('12', 3, SIX), 'length');
  assert.equal(checkCode('1234', 3, SIX), 'length');
  assert.equal(checkCode('127', 3, SIX), 'digit');
  assert.equal(checkCode('12a', 3, TEN), 'digit');
  assert.equal(checkCode('121', 3, SIX), 'repeat');
  assert.equal(checkCode(123, 3, SIX), 'length');
  assert.equal(checkDigits(SIX), null);
  assert.equal(checkDigits('1123'), 'digits');
  assert.equal(checkDigits('12'), 'digits');
  assert.equal(checkDigits('12x4'), 'digits');
});

test('답과 맞는 후보 걸러 내기: 하나씩 따져 본 것과 같고, 진짜 암호는 늘 남는다', () => {
  const codes = allCodes(3, TEN);
  const secret = '601';
  const rows = ['012', '370', '106'].map((guess) => ({ guess, ...judge(guess, secret) }));
  let left = codes;
  rows.forEach((row, index) => {
    left = filterCodes(left, [row]);
    const byHand = codes.filter((code) => rows.slice(0, index + 1).every((item) => judgeOtherWay(item.guess, code).hit === item.hit && judgeOtherWay(item.guess, code).place === item.place));
    assert.deepEqual(left, byHand);
    assert.ok(left.includes(secret));
  });
  assert.deepEqual(trailOf(3, TEN, rows), { start: 720, counts: [63, 19, 1], left: ['601'] });
  assert.ok(fits(secret, rows[0]));
  assert.ok(fitsAll(secret, rows));
  assert.ok(!fits('345', rows[0]));
  // 줄이 없으면 모든 후보가 남는다.
  assert.equal(filterCodes(codes, []).length, 720);
});

test('남은 후보 수는 줄을 더할수록 늘지 않는다', () => {
  const codes = allCodes(3, TEN);
  for (let at = 0; at < codes.length; at += 41) {
    const secret = codes[at];
    const rows = [codes[(at * 7 + 3) % 720], codes[(at * 11 + 5) % 720], codes[(at * 13 + 17) % 720]].map((guess) => ({ guess, ...judge(guess, secret) }));
    const { start, counts, left } = trailOf(3, TEN, rows);
    assert.equal(start, 720);
    let before = start;
    for (const count of counts) {
      assert.ok(count <= before && count >= 1);
      before = count;
    }
    assert.ok(left.includes(secret));
  }
});

test('표 풀기: 모든 후보를 따져 맞는 암호의 수를 센다(없다, 하나뿐이다, 여러 개다)', () => {
  const one = [
    { guess: '123', hit: 0, place: 0 },
    { guess: '456', hit: 3, place: 1 },
    { guess: '465', hit: 3, place: 3 },
  ];
  assert.deepEqual(solveTable(3, SIX, one), { count: 1, secret: '465', start: 120, trail: [6, 3, 1] });
  const many = one.slice(0, 2);
  assert.equal(solveTable(3, SIX, many).count, 3);
  assert.equal(solveTable(3, SIX, many).secret, null);
  // 서로 어긋나는 줄: 1, 2, 3이 하나도 없다면서 1이 들어 있다고 한다.
  const none = [
    { guess: '123', hit: 0, place: 0 },
    { guess: '145', hit: 3, place: 3 },
  ];
  assert.equal(solveTable(3, SIX, none).count, 0);
  // 있을 수 없는 답(셋 다 들어 있는데 둘만 자리가 맞다)도 맞는 암호가 없다.
  assert.equal(solveTable(3, SIX, [{ guess: '123', hit: 3, place: 2 }]).count, 0);
  assert.equal(solveTable(3, SIX, []).count, 120);
});

test('군더더기 줄: 빼도 답이 하나로 남는 줄이 있으면 알아본다', () => {
  const lean = [
    { guess: '123', hit: 1, place: 0 },
    { guess: '324', hit: 1, place: 0 },
    { guess: '416', hit: 1, place: 0 },
    { guess: '241', hit: 0, place: 0 },
  ];
  assert.deepEqual(solveTable(3, SIX, lean), { count: 1, secret: '635', start: 120, trail: [36, 12, 4, 1] });
  assert.equal(isLean(3, SIX, lean), true);
  // 어느 줄을 빼도 답이 여럿이 된다(하나씩 빼서 세어 본다).
  lean.forEach((_, skip) => assert.ok(solveTable(3, SIX, lean.filter((__, index) => index !== skip)).count > 1, `${skip + 1}번째 줄`));
  assert.equal(isLean(3, SIX, [...lean, { guess: '652', hit: 2, place: 1 }]), false, '더 넣은 줄은 군더더기다');
  assert.equal(solveTable(3, SIX, [...lean, { guess: '652', hit: 2, place: 1 }]).secret, '635');
  assert.equal(isLean(3, SIX, lean.slice(0, 3)), false, '답이 여럿인 표');
});

test('어긋나는 첫 줄을 찾는다', () => {
  const rows = [
    { guess: '123', hit: 0, place: 0 },
    { guess: '456', hit: 3, place: 1 },
    { guess: '546', hit: 3, place: 0 },
  ];
  assert.equal(firstMismatch('465', rows), -1);
  assert.equal(firstMismatch('145', rows), 0);
  assert.equal(firstMismatch('456', rows), 1);
  assert.equal(firstMismatch('546', rows), 2);
  // 이 표는 답이 둘이다(465와 654). 둘 다 어긋나는 줄이 없다.
  assert.equal(firstMismatch('654', rows), -1);
  assert.equal(solveTable(3, SIX, rows).count, 2);
  assert.deepEqual(diagnoseTable('465', rows), { correct: true, guess: null, row: null });
  assert.deepEqual(diagnoseTable('456', rows), { correct: false, guess: 'table-row', row: 1 });
  assert.deepEqual(diagnoseTable('546', rows), { correct: false, guess: 'table-row', row: 2 });
});

test('컴퓨터의 다음 추측: 남은 후보 가운데서만 고르고, 같은 (판 번호, 차례)는 늘 같은 것을 고른다', () => {
  const codes = allCodes(3, TEN);
  for (let seed = 1; seed <= 30; seed++) {
    for (let turn = 0; turn < 4; turn++) {
      const guess = nextGuess(codes, seed, turn);
      assert.ok(codes.includes(guess));
      assert.equal(nextGuess(codes, seed, turn), guess);
    }
  }
  assert.equal(nextGuess(['465'], 9, 3), '465');
  assert.equal(nextGuess([], 1, 0), null);
  const firsts = new Set(Array.from({ length: 30 }, (_, index) => nextGuess(codes, index + 1, 0)));
  assert.ok(firsts.size >= 20, '판 번호가 다르면 첫 추측도 여러 가지다');
});

test('컴퓨터가 혼자 맞히기: 추측은 늘 앞의 답들과 모두 맞고, 남은 후보 수는 줄기만 하고, 끝내 암호를 맞힌다', () => {
  const codes = allCodes(3, TEN);
  for (let at = 0; at < codes.length; at += 9) {
    const secret = codes[at];
    const rows = playComputer(secret, TEN, 4);
    assert.equal(rows.at(-1).guess, secret);
    assert.equal(rows.at(-1).left, 1);
    let before = 720;
    rows.forEach((row, index) => {
      assert.deepEqual({ hit: row.hit, place: row.place }, judge(row.guess, secret));
      assert.ok(fitsAll(row.guess, rows.slice(0, index)), `${secret}: ${index + 1}번째 추측이 앞의 답과 맞지 않아요`);
      // 후보가 하나만 남은 뒤에 그 하나를 내는 마지막 추측만 빼고, 추측마다 후보가 줄어든다.
      assert.ok(row.left < before || (before === 1 && row.guess === secret), `${secret}: 후보가 줄지 않았어요`);
      before = row.left;
    });
    assert.equal(new Set(rows.map((row) => row.guess)).size, rows.length, '같은 추측을 두 번 내지 않는다');
  }
});

test('컴퓨터가 세 자리 암호 720개를 모두 맞히는 데 걸리는 추측 횟수의 분포', () => {
  const codes = allCodes(3, TEN);
  const distribution = (seed) => {
    const counts = {};
    let total = 0;
    for (const secret of codes) {
      const turns = playComputer(secret, TEN, seed).length;
      counts[turns] = (counts[turns] ?? 0) + 1;
      total += turns;
    }
    return { counts, mean: total / codes.length, most: Math.max(...Object.keys(counts).map(Number)) };
  };
  // 1번 판의 분포(세어 본 값). 평균 5.22번, 가장 많이 걸린 것이 8번이다.
  const first = distribution(1);
  assert.deepEqual(first.counts, { 1: 1, 2: 8, 3: 41, 4: 130, 5: 243, 6: 214, 7: 65, 8: 18 });
  assert.equal(first.most, 8);
  assert.ok(Math.abs(first.mean - 5.22) < 0.01, String(first.mean));
  // 다른 판 번호에서도 비슷하다: 모든 암호를 9번 안에 맞히고, 평균은 5번과 5.5번 사이다.
  for (let seed = 2; seed <= 6; seed++) {
    const { counts, mean, most } = distribution(seed);
    assert.equal(Object.values(counts).reduce((sum, count) => sum + count, 0), 720);
    assert.ok(most <= 9, `${seed}번 판: 가장 많이 걸린 것이 ${most}번`);
    assert.ok(mean > 5 && mean < 5.5, `${seed}번 판: 평균 ${mean}`);
    assert.equal(counts[1], 1, '첫 추측이 암호인 것은 하나뿐이다');
  }
  // 1~6 세 자리(120개)는 5번 안에 모두 맞힌다.
  const small = {};
  for (const secret of allCodes(3, SIX)) {
    const turns = playComputer(secret, SIX, 1).length;
    small[turns] = (small[turns] ?? 0) + 1;
  }
  assert.deepEqual(small, { 1: 1, 2: 8, 3: 33, 4: 63, 5: 15 });
});

test('표의 줄과 판 점검', () => {
  assert.equal(checkRows([{ guess: '123', hit: 1, place: 0 }], 3, SIX), null);
  assert.equal(checkRows([], 3, SIX), null);
  assert.equal(checkRows(null, 3, SIX), 'rows');
  assert.equal(checkRows([null], 3, SIX), 'rows');
  assert.equal(checkRows([{ guess: '128', hit: 1, place: 0 }], 3, SIX), 'guess');
  assert.equal(checkRows([{ guess: '123', hit: 4, place: 0 }], 3, SIX), 'reply');
  assert.equal(checkRows([{ guess: '123', hit: 1, place: -1 }], 3, SIX), 'reply');
  assert.equal(checkRows([{ guess: '123', hit: 1.5, place: 0 }], 3, SIX), 'reply');

  assert.deepEqual(MODES, ['guess', 'table', 'referee']);
  assert.equal(checkBoard({ mode: 'guess', length: 3, digits: SIX, secret: '465' }), null);
  assert.equal(checkBoard({ mode: 'guess', length: 3, digits: SIX, secret: '467' }), 'digit');
  assert.equal(checkBoard({ mode: 'guess', length: 3, digits: SIX }), 'length');
  assert.equal(checkBoard({ mode: 'table', length: 3, digits: SIX, rows: [{ guess: '123', hit: 1, place: 0 }] }), null);
  assert.equal(checkBoard({ mode: 'table', length: 3, digits: SIX, rows: [] }), 'rows');
  assert.equal(checkBoard({ mode: 'referee', length: 3, digits: TEN }), null);
  assert.equal(checkBoard({ mode: 'other', length: 3, digits: TEN }), 'mode');
  assert.equal(checkBoard({ mode: 'referee', length: 5, digits: TEN }), 'length');
  assert.equal(checkBoard({ mode: 'referee', length: 3, digits: '11' }), 'digits');
  assert.equal(checkBoard(null), 'board');
});

test('오답 짐작: 역할 바꾸기에서 넣은 두 수. 처음에는 견줘 보자고 하고, 또 어긋나면 한쪽만 짚는다', () => {
  // 암호 352, 추측 325: 들어 있는 숫자 3개, 자리도 맞는 것 1개
  assert.deepEqual(judge('325', '352'), { hit: 3, place: 1 });
  assert.deepEqual(diagnoseReply('325', '352', { hit: 3, place: 1 }), { correct: true, guess: null });
  assert.deepEqual(diagnoseReply('325', '352', { hit: 3, place: 1 }, 2), { correct: true, guess: null });
  assert.deepEqual(diagnoseReply('325', '352', { hit: 2, place: 1 }), { correct: false, guess: 'referee-reply' });
  assert.deepEqual(diagnoseReply('325', '352', { hit: 3, place: 3 }), { correct: false, guess: 'referee-reply' });
  assert.deepEqual(diagnoseReply('325', '352', { hit: 2, place: 1 }, 1), { correct: false, guess: 'referee-hit' });
  assert.deepEqual(diagnoseReply('325', '352', { hit: 3, place: 0 }, 1), { correct: false, guess: 'referee-place' });
  // 둘 다 어긋나면 먼저 들어 있는 숫자의 수를 짚는다(한 번에 하나만).
  assert.deepEqual(diagnoseReply('325', '352', { hit: 1, place: 0 }, 3), { correct: false, guess: 'referee-hit' });
});
