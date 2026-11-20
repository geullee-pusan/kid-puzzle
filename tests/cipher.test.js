// 암호 놀이의 풀이 프로그램(src/core/cipher.js)을 다른 방법(tests/helpers/brute-cipher.js)으로 다시 따진다.
// 글자 나누기와 모으기(번호 셈 ↔ 정규화와 글자로 적은 표), 미는 암호, 바퀴를 놓는 방법의 수, 자주 나오는 글자, 글자판으로 쓴 글 모으기, 달아난 숫자.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  LETTERS,
  allTurns,
  carriesOf,
  carryCells,
  cellsOf,
  checkBoard,
  checkText,
  cipherOf,
  composeTokens,
  frequencyGuess,
  frequencyWorks,
  joinSyllable,
  keyCount,
  letterCounts,
  plainOf,
  readWith,
  shiftText,
  solve,
  solveSum,
  splitChar,
  symbolsOf,
  tableNumber,
  tokensOf,
  turnsMatch,
} from '../src/core/cipher.js';
import { createRng, randInt } from '../src/core/rng.js';
import { CONSONANTS, VOWELS, bruteBasic, bruteCarries, bruteConsonantCounts, bruteFrequencyWorks, bruteJoin, bruteShift, bruteSplit, bruteSum } from './helpers/brute-cipher.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const T = JSON.parse(readFileSync(resolve(ROOT, 'src/content/cipher.json'), 'utf8'));
const ALL = Object.values(T.messages).flat();

test('바퀴의 글자: 자음 열넷, 모음 열, 숫자 열이 글자로 적은 표와 같다', () => {
  assert.equal(LETTERS.c.join(''), CONSONANTS);
  assert.equal(LETTERS.v.join(''), VOWELS);
  assert.equal(LETTERS.d.join(''), '0123456789');
  assert.equal(LETTERS.c.length + LETTERS.v.length, 24);
  // 글자표의 수: 자음 1~14, 모음 15~24
  assert.deepEqual(LETTERS.c.map((_, index) => tableNumber('c', index)), Array.from({ length: 14 }, (_, index) => index + 1));
  assert.deepEqual(LETTERS.v.map((_, index) => tableNumber('v', index)), Array.from({ length: 10 }, (_, index) => index + 15));
});

test('글자 나누기: 한글 글자 11,172개를 모두 번호 셈과 정규화로 나누어 견준다', () => {
  let basic = 0;
  for (let code = 0xac00; code <= 0xd7a3; code++) {
    const ch = String.fromCharCode(code);
    const part = splitChar(ch);
    const brute = bruteSplit(ch);
    assert.ok(brute, ch);
    if (!bruteBasic(ch)) {
      assert.equal(part, null, ch);
      continue;
    }
    basic += 1;
    assert.equal(part.type, 'syllable', ch);
    assert.equal(LETTERS.c[part.l], brute.lead, ch);
    assert.equal(LETTERS.v[part.v], brute.mid, ch);
    assert.equal(part.t < 0 ? null : LETTERS.c[part.t], brute.tail, ch);
  }
  // 기본 자음 14 × 기본 모음 10 × (받침 없음 + 기본 자음 받침 14)
  assert.equal(basic, 14 * 10 * 15);
});

test('글자 모으기: 첫소리·가운데 소리·받침의 모든 짝(2,100가지)이 정규화로 모은 글자와 같고, 다시 나누면 그대로다', () => {
  for (let l = 0; l < 14; l++) {
    for (let v = 0; v < 10; v++) {
      for (let t = -1; t < 14; t++) {
        const ch = joinSyllable(l, v, t);
        assert.equal(ch, bruteJoin(CONSONANTS[l], VOWELS[v], t < 0 ? null : CONSONANTS[t]));
        assert.deepEqual(splitChar(ch), { type: 'syllable', l, v, t });
      }
    }
  }
});

test('대본의 모든 글은 기본 자모로만 된 글자이고, 나누었다 모으면 그대로다', () => {
  for (const text of ALL) {
    assert.equal(checkText(text), null, text);
    for (const ch of text) if (!' .,?!'.includes(ch)) assert.ok(bruteBasic(ch), `${text}: ${ch}`);
    const rebuilt = cellsOf(text)
      .map((cell) => (cell.type === 'syllable' ? joinSyllable(cell.parts[0].index, cell.parts[1].index, cell.parts[2]?.index ?? -1) : cell.ch))
      .join('');
    assert.equal(rebuilt, text);
    // 글자판에는 문장 부호가 없다. 부호가 없는 글은 누른 자모 줄로 나누었다 모으면 그대로다
    if (!/[.,?!]/.test(text)) assert.equal(composeTokens(tokensOf(text)).text, text);
  }
  // 쓸 수 없는 글자: 쌍자음, 겹받침, 두 소리가 섞인 모음, 다른 나라 글자
  for (const bad of ['빵', '닭', '해', '와', '있어요', 'abc', '오늘 ', '오늘  밤', '']) assert.notEqual(checkText(bad), null, bad);
});

test('미는 암호: 모든 글과 모든 열쇠(자음 14 × 모음 10)를 표로 미는 방법과 견준다. 거꾸로 밀면 원래 글이다', () => {
  for (const text of ALL) {
    for (let c = 0; c < 14; c++) {
      for (let v = 0; v < 10; v++) {
        const shifted = shiftText(text, { c, v });
        assert.equal(shifted, bruteShift(text, { c, v }), `${text} ${c} ${v}`);
        assert.equal([...shifted].length, [...text].length);
        assert.equal(readWith(shifted, { c, v }), text);
      }
    }
    // 14칸 미는 것은 0칸, 15칸은 1칸, 모음 10칸은 0칸과 같다(끝 칸 다음은 처음이다)
    assert.equal(shiftText(text, { c: 14 }), text);
    assert.equal(shiftText(text, { c: 15 }), shiftText(text, { c: 1 }));
    assert.equal(shiftText(text, { v: 10 }), text);
    assert.equal(shiftText(text, { c: -1 }), shiftText(text, { c: 13 }));
  }
  // 숫자 바퀴: 9 다음은 0
  assert.equal(shiftText('0958', { d: 2 }), '2170');
  assert.equal(shiftText('0958', { d: 2 }), bruteShift('0958', { d: 2 }));
  // 받침도 밀린다: ㅎ을 3칸 밀면 ㄷ
  assert.equal(shiftText('하마가 웃어요', { c: 3 }), '다아라 쿷커쿄');
});

test('바퀴를 놓는 방법의 수: 자음만 14, 모음만 10, 둘 다 140. 놓는 방법마다 암호문이 모두 다르다(다른 방법으로 센다)', () => {
  assert.equal(keyCount(['c']), 14);
  assert.equal(keyCount(['v']), 10);
  assert.equal(keyCount(['c', 'v']), 140);
  assert.equal(allTurns(['c', 'v']).length, 140);
  for (const text of ALL) {
    const consonant = new Set(Array.from({ length: 14 }, (_, c) => bruteShift(text, { c })));
    assert.equal(consonant.size, 14, text);
    const both = new Set();
    for (let c = 0; c < 14; c++) for (let v = 0; v < 10; v++) both.add(bruteShift(text, { c, v }));
    assert.equal(both.size, 140, text);
  }
  // 바퀴를 열쇠만큼 돌렸을 때만 열쇠와 같다
  const board = { kind: 'text', plain: '오늘 바람이 불어요', keys: { c: 7, v: 2 } };
  const matches = allTurns(['c', 'v']).filter((turns) => turnsMatch(board, turns));
  assert.deepEqual(matches, [{ c: 7, v: 2 }]);
  assert.equal(readWith(cipherOf(board), { c: 7, v: 2 }), board.plain);
});

test('풀 글자와 원래 글자: 암호 글자마다 열쇠만큼 거꾸로 민 글자가 원래 글자다', () => {
  for (const [plain, keys] of [['하마가 웃어요', { c: 3, v: 0 }], ['오리 가요', { c: 3, v: 4 }], ['보물', { c: 0, v: 0 }]]) {
    const board = { kind: 'text', plain, keys, ...(keys.c === 0 && keys.v === 0 ? { show: 'numbers' } : {}) };
    const cipher = cipherOf(board);
    const symbols = symbolsOf(board);
    assert.equal(new Set(symbols).size, symbols.length);
    for (const id of symbols) {
      const ring = id[0];
      const index = Number(id.slice(1));
      // 원래 글자를 열쇠만큼 밀면 암호 글자다
      assert.equal(LETTERS[ring][(plainOf(board, id) + keys[ring]) % LETTERS[ring].length], LETTERS[ring][index]);
    }
    // 풀 글자를 모두 풀면 원래 글이 된다
    const decoded = cellsOf(cipher)
      .map((cell) => {
        if (cell.type !== 'syllable') return cell.ch;
        const parts = cell.parts.map((part) => (symbols.includes(`${part.ring}${part.index}`) ? plainOf(board, `${part.ring}${part.index}`) : part.index));
        return joinSyllable(parts[0], parts[1], parts[2] ?? -1);
      })
      .join('');
    assert.equal(decoded, plain);
  }
  // 자음만 민 판은 자음만 풀고, 글자표 판은 자모를 모두 푼다
  assert.ok(symbolsOf({ kind: 'text', plain: '하마가 웃어요', keys: { c: 3, v: 0 } }).every((id) => id[0] === 'c'));
  assert.deepEqual(symbolsOf({ kind: 'text', plain: '보물', keys: { c: 0, v: 0 }, show: 'numbers' }), ['c5', 'v4', 'c4', 'v6', 'c3']);
});

test('자주 나오는 글자: 자음 세기를 정규화로 센 수와 견주고, 가장 많은 자음을 ㅇ 자리에 맞춘 열쇠를 다시 구한다', () => {
  for (const text of ALL) {
    const counts = letterCounts(text).c;
    const brute = bruteConsonantCounts(text);
    assert.deepEqual(counts, [...CONSONANTS].map((letter) => brute[letter]), text);
    assert.equal(frequencyWorks(text), bruteFrequencyWorks(text), text);
    for (let c = 1; c < 14; c++) {
      const guess = frequencyGuess(shiftText(text, { c, v: 3 }));
      if (bruteFrequencyWorks(text)) assert.equal(guess.key, c, `${text} ${c}`);
      else assert.notEqual(guess.key, c, `${text} ${c}`);
    }
  }
});

test('글자판으로 쓴 글 모으기: 시드 난수로 누른 자모 줄 3,000개를 모아 보고, 다 모인 글은 다시 나누면 그 줄이다', () => {
  const rng = createRng(20261120);
  let whole = 0;
  for (let round = 0; round < 3000; round++) {
    const tokens = Array.from({ length: randInt(rng, 1, 12) }, () => {
      const pick = randInt(rng, 0, 9);
      if (pick === 0) return ' ';
      return pick <= 5 ? `c${randInt(rng, 0, 13)}` : `v${randInt(rng, 0, 9)}`;
    });
    const { text, whole: done } = composeTokens(tokens);
    // 모은 글을 정규화로 나눈 자모 줄은 누른 줄과 같다(혼자 남은 자모도 그대로)
    const back = [...text].flatMap((ch) => {
      if (ch === ' ') return [' '];
      const split = bruteSplit(ch);
      if (!split) return [ch];
      return [split.lead, split.mid, ...(split.tail ? [split.tail] : [])];
    });
    const pressed = tokens.map((token) => (token === ' ' ? ' ' : LETTERS[token[0]][Number(token.slice(1))]));
    assert.deepEqual(back, pressed, tokens.join(','));
    if (done) {
      whole += 1;
      assert.deepEqual(tokensOf(text), tokens);
      // 모음 바로 앞의 자음은 늘 첫소리다(혼자 남은 자모가 없다)
      for (const ch of text) assert.ok(ch === ' ' || bruteSplit(ch), ch);
    }
  }
  assert.ok(whole > 100);
});

test('달아난 숫자: 가린 자리를 글자로 모두 넣어 보는 방법과 채우기의 수가 같다. 받아올림도 다른 방법으로 견준다', () => {
  const rng = createRng(7);
  for (let round = 0; round < 300; round++) {
    const op = round % 3 === 0 ? 'sub' : 'add';
    let a = randInt(rng, 10, 999);
    let b = randInt(rng, 10, 999);
    if (op === 'sub' && a < b) [a, b] = [b, a];
    const rows = [String(a), String(b), String(op === 'add' ? a + b : a - b)];
    const spots = [];
    rows.forEach((row, line) => [...row].forEach((_, at) => spots.push([line, at])));
    const hidden = [];
    while (hidden.length < Math.min(3, spots.length)) {
      const spot = spots[randInt(rng, 0, spots.length - 1)];
      if (!hidden.some(([line, at]) => line === spot[0] && at === spot[1])) hidden.push(spot);
    }
    const board = { kind: 'sum', op, rows, hidden };
    assert.equal(checkBoard(board), null);
    const brute = bruteSum(board);
    const core = solveSum(board);
    assert.equal(core.count, brute.length, JSON.stringify(board));
    assert.deepEqual(core.answers.map((digits) => digits.join('')).sort(), brute.slice().sort());
    assert.deepEqual(carriesOf(op, rows), bruteCarries(op, rows));
  }
  // 받아올림을 따져야 채우는 자리: 190 + 857 = 1047에서 일의 자리 0, 백의 자리 8, 천의 자리 1을 가리면 둘(천의 자리, 백의 자리로 받아올림이 들어온다)
  const first = { kind: 'sum', op: 'add', rows: ['190', '857', '1047'], hidden: [[0, 2], [1, 0], [2, 0]] };
  assert.equal(carryCells(first), 2);
  assert.deepEqual(bruteSum(first), ['081']);
  assert.equal(solve(first).count, 1);
});

test('판의 규격: 맞지 않는 판을 가려낸다', () => {
  assert.equal(checkBoard({ kind: 'text', plain: '보물', keys: { c: 3, v: 0 } }), null);
  assert.equal(checkBoard({ kind: 'text', plain: '보물', keys: { c: 0, v: 0 }, show: 'numbers' }), null);
  assert.equal(checkBoard({ kind: 'digits', plain: '0958', keys: { d: 2 } }), null);
  for (const bad of [
    null,
    { kind: 'text', plain: '보물', keys: { c: 0, v: 0 } },
    { kind: 'text', plain: '보물', keys: { c: 14, v: 0 } },
    { kind: 'text', plain: '빵', keys: { c: 1, v: 0 } },
    { kind: 'text', plain: '보물', keys: { c: 1, v: 2 }, show: 'numbers' },
    { kind: 'digits', plain: '09a8', keys: { d: 2 } },
    { kind: 'digits', plain: '0958', keys: { d: 0 } },
    { kind: 'sum', op: 'add', rows: ['12', '34', '47'], hidden: [[0, 0]] },
    { kind: 'sum', op: 'add', rows: ['12', '34', '46'], hidden: [[0, 2]] },
    { kind: 'sum', op: 'mul', rows: ['12', '34', '46'], hidden: [[0, 0]] },
    { kind: 'what' },
  ]) assert.notEqual(checkBoard(bad), null, JSON.stringify(bad));
});
