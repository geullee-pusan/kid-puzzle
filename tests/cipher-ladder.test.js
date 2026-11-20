// 암호 놀이의 사다리: 단계마다 판 100개씩이 잣대에 맞는지 다른 방법(tests/helpers/brute-cipher.js)으로 본다.
// 같은 번호는 늘 같은 판, 다음 판 번호는 다른 판, 작은 판은 같은 종류의 더 작은 판.
// 자주 나오는 글자가 열쇠를 알려 주는 비율도 여기서 센다(커리큘럼 문서에 적은 수).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { FIRST_KEY, LADDER, MAKE_LEVEL, SMALL_TEXT, TOP_LEVEL, digitSeed, makeLadder, plainTableSeed, rungOf, smallBoards, subSeed } from '../src/core/cipher-ladder.js';
import { carryCells, checkBoard, cipherOf, sameBoard, sizeOf } from '../src/core/cipher.js';
import { SMALLER, smallerCipher } from '../src/core/smaller.js';
import { CONSONANTS, bruteCarries, bruteConsonantCounts, bruteFrequencyWorks, bruteShift, bruteSplit, bruteSum } from './helpers/brute-cipher.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const T = JSON.parse(readFileSync(resolve(ROOT, 'src/content/cipher.json'), 'utf8'));
const ladder = makeLadder(T.messages);
const SEEDS = Array.from({ length: 100 }, (_, index) => index + 1);
const boardsOf = (level) => SEEDS.map((seed) => ({ seed, board: ladder.generateBoard(level, seed).board }));

/** 원래 글의 자음 가운데 열쇠만큼 밀면 ㅎ을 지나는 것이 있는가(글자로 적은 표로 센다) */
function bruteWraps(plain, c) {
  for (const ch of plain) {
    const split = bruteSplit(ch);
    if (!split) continue;
    for (const letter of [split.lead, split.tail]) if (letter && CONSONANTS.indexOf(letter) + c >= 14) return true;
  }
  return false;
}

test('사다리: 다섯 단계와 직접 만들기, 기본·응용·도전', () => {
  assert.deepEqual(
    LADDER.map((rung) => [rung.level, rung.tag, rung.mode]),
    [
      [1, 'basic', 'decode'],
      [2, 'basic', 'findkey'],
      [3, 'applied', 'table'],
      [4, 'applied', 'sum'],
      [5, 'challenge', 'freq'],
      [6, 'challenge', 'make'],
    ],
  );
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  assert.equal(ladder.TOP_LEVEL, 5);
  assert.throws(() => rungOf(7));
  assert.throws(() => ladder.generateBoard(MAKE_LEVEL, 1));
  assert.throws(() => makeLadder({}).generateBoard(1, 1));
});

test('1단계 미는 암호 풀기: 셋에 하나는 자물쇠 번호, 나머지는 자음만 2~11칸 민 짧은 글. 모두 끝 칸을 지나 처음으로 돌아가는 글자가 있다', () => {
  for (const { seed, board } of boardsOf(1)) {
    assert.equal(checkBoard(board), null);
    if (digitSeed(seed)) {
      assert.equal(board.kind, 'digits');
      assert.equal(board.plain.length, 4);
      assert.ok([...board.plain].some((ch) => Number(ch) + board.keys.d >= 10), `${seed}번`);
      assert.equal(cipherOf(board), bruteShift(board.plain, { d: board.keys.d }));
      continue;
    }
    assert.equal(board.kind, 'text');
    assert.ok(T.messages.short.includes(board.plain));
    assert.equal(board.keys.v, 0);
    assert.ok(board.keys.c >= 2 && board.keys.c <= 11);
    assert.ok(bruteWraps(board.plain, board.keys.c), `${seed}번`);
    assert.equal(cipherOf(board), bruteShift(board.plain, { c: board.keys.c }));
  }
  // 첫 판은 대본 맨 앞의 글을 열쇠 3칸으로(ㅎ이 ㄷ이 된다)
  assert.deepEqual(ladder.generateBoard(1, 1).board, { kind: 'text', plain: T.messages.short[0], keys: { c: FIRST_KEY, v: 0 } });
  assert.equal(cipherOf(ladder.generateBoard(1, 1).board), '다아라 쿷커쿄');
  // 작은 판부터: 다섯 글자 이하의 글, 세 자리 번호
  for (const seed of SEEDS.slice(0, 30)) {
    const { board, small } = ladder.generateBoard(1, seed, { small: true });
    assert.equal(small, true);
    if (board.kind === 'digits') assert.equal(board.plain.length, 3);
    else assert.ok(sizeOf(board) <= SMALL_TEXT);
  }
});

test('2단계 열쇠 찾기: 자음만 2~12칸 민 글. 14가지 가운데 열쇠 하나만 원래 글이 된다', () => {
  const plains = new Set();
  for (const { board } of boardsOf(2)) {
    assert.equal(checkBoard(board), null);
    assert.ok(T.messages.words.includes(board.plain));
    plains.add(board.plain);
    assert.equal(board.keys.v, 0);
    assert.ok(board.keys.c >= 2 && board.keys.c <= 12);
    const cipher = cipherOf(board);
    const reads = Array.from({ length: 14 }, (_, turn) => bruteShift(cipher, { c: -turn }));
    assert.deepEqual(reads.map((text, turn) => (text === board.plain ? turn : -1)).filter((turn) => turn >= 0), [board.keys.c]);
  }
  // 글 묶음을 돌아가며 다 쓴다
  assert.equal(plains.size, T.messages.words.length);
});

test('3단계 글자를 수로: 셋에 하나는 더하지 않은 표, 나머지는 자음의 수에 2~12를 더해 14를 넘는 수가 있다', () => {
  for (const { seed, board } of boardsOf(3)) {
    assert.equal(checkBoard(board), null);
    assert.equal(board.show, 'numbers');
    assert.ok(T.messages.table.includes(board.plain));
    if (plainTableSeed(seed)) {
      assert.equal(board.keys.c, 0);
      continue;
    }
    assert.ok(board.keys.c >= 2 && board.keys.c <= 12);
    // 표의 수(ㄱ 1 … ㅎ 14)에 열쇠를 더하면 14를 넘는 자음이 있다
    let over = false;
    for (const ch of board.plain) {
      const split = bruteSplit(ch);
      if (!split) continue;
      for (const letter of [split.lead, split.tail]) if (letter && CONSONANTS.indexOf(letter) + 1 + board.keys.c > 14) over = true;
    }
    assert.ok(over, `${seed}번`);
  }
});

test('4단계 달아난 숫자: 세 자리 덧셈과 뺄셈(셋에 하나), 가린 자리 서넛, 채우는 방법은 하나뿐이고 받아올림을 따져야 하는 자리가 있다', () => {
  const counts = { add: 0, sub: 0 };
  for (const { seed, board } of boardsOf(4)) {
    assert.equal(checkBoard(board), null);
    assert.equal(board.op, subSeed(seed) ? 'sub' : 'add');
    counts[board.op] += 1;
    assert.equal(board.rows[0].length, 3);
    assert.ok(board.hidden.length >= 3 && board.hidden.length <= 4);
    if (seed === 1) assert.equal(board.hidden.length, 3);
    // 모든 채우기를 글자로 넣어 보면 맞는 것이 하나뿐이다
    assert.equal(bruteSum(board).length, 1, `${seed}번`);
    // 받아올림(받아내림)이 있고, 그것을 따져야 채울 수 있는 가린 자리가 있다
    assert.ok(bruteCarries(board.op, board.rows).some((carry) => carry > 0));
    assert.ok(carryCells(board) > 0);
    // 한 줄을 통째로 가리지 않는다
    for (let line = 0; line < 3; line++) assert.ok(board.hidden.filter(([row]) => row === line).length < board.rows[line].length);
  }
  assert.deepEqual(counts, { add: 67, sub: 33 });
});

test('5단계 자주 나오는 글자: 세 문장 글의 자음과 모음을 함께 민다. 원래 글에서 ㅇ이 가장 많아서, 가장 많이 나온 암호 자음을 ㅇ에 맞추면 자음 열쇠가 나온다', () => {
  for (const { board } of boardsOf(5)) {
    assert.equal(checkBoard(board), null);
    assert.ok(T.messages.letters.includes(board.plain));
    assert.ok(board.keys.c >= 1 && board.keys.v >= 1);
    assert.ok(bruteFrequencyWorks(board.plain));
    const counts = bruteConsonantCounts(cipherOf(board));
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    assert.ok(top[0][1] > top[1][1]);
    assert.equal((CONSONANTS.indexOf(top[0][0]) - CONSONANTS.indexOf('ㅇ') + 14) % 14, board.keys.c);
  }
});

test('자주 나오는 글자는 긴 글에서만 믿을 만하다: 묶음마다 ㅇ이 다른 어떤 자음보다 많은 글의 수', () => {
  const rate = Object.fromEntries(Object.entries(T.messages).map(([name, list]) => [name, [list.filter(bruteFrequencyWorks).length, list.length]]));
  // 짧은 글(5~9글자) 22개 가운데 11개, 낱말 몇 개짜리(7~12글자) 18개 가운데 8개, 글자표의 낱말(2~5글자) 15개 가운데 3개,
  // 세 문장 글(32~45글자) 14개는 모두(이 단계에 쓰려고 고른 글이다), "왜 그럴까?"의 짧은 글은 ㄱ이 더 많다
  assert.deepEqual(rate, { short: [11, 22], words: [8, 18], table: [3, 15], letters: [14, 14], tricky: [0, 1] });
  const tricky = bruteConsonantCounts(T.messages.tricky[0]);
  assert.ok(tricky['ㄱ'] > tricky['ㅇ']);
});

test('같은 번호는 늘 같은 판이고, 다음 판 번호는 다른 판이다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of SEEDS.slice(0, 20)) {
      assert.deepEqual(ladder.generateBoard(level, seed), ladder.generateBoard(level, seed));
      const next = ladder.nextSeed(level, seed);
      assert.ok(next > seed);
      assert.equal(sameBoard(ladder.generateBoard(level, next).board, ladder.generateBoard(level, seed).board), false);
    }
  }
  assert.equal(ladder.nextSeed(MAKE_LEVEL, 3), 4);
});

test('더 작은 판: 같은 종류(같은 열쇠, 같은 셈)의 더 작은 판. 가장 작은 판에는 없다', () => {
  assert.equal(SMALLER.cipher, smallerCipher);
  const modes = { 1: 'decode', 2: 'findkey', 3: 'table', 4: 'sum', 5: 'freq' };
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const { board } of boardsOf(level).slice(0, 40)) {
      const origin = { mode: modes[level], board, book: T.messages };
      const lists = smallBoards(origin, T.messages);
      assert.deepEqual(lists.no, []);
      for (const small of lists.yes) {
        assert.equal(checkBoard(small), null);
        assert.equal(small.kind, board.kind);
        if (board.kind === 'sum') {
          assert.equal(small.op, board.op);
          assert.equal(small.rows[0].length, 2);
          assert.equal(bruteSum(small).length, 1);
          assert.ok(carryCells(small) > 0);
        } else if (board.kind === 'digits') {
          assert.equal(small.keys.d, board.keys.d);
          assert.ok(small.plain.length < board.plain.length);
        } else {
          assert.ok(sizeOf(small) < sizeOf(board), `${small.plain} < ${board.plain}`);
          if (level === 1 || level === 3) assert.deepEqual(small.keys, board.keys);
          if (level === 3) assert.equal(small.show, 'numbers');
          if (level === 5) assert.ok(bruteFrequencyWorks(small.plain));
        }
      }
      // 같은 판, 같은 차례에는 늘 같은 작은 판
      assert.deepEqual(smallerCipher(origin, 1), smallerCipher(origin, 1));
    }
  }
  // 가장 짧은 글, 세 자리 번호, 두 자리 세로셈에는 작은 판이 없다
  const shortest = T.messages.short.reduce((a, b) => (sizeOf({ kind: 'text', plain: a }) <= sizeOf({ kind: 'text', plain: b }) ? a : b));
  assert.equal(smallerCipher({ mode: 'decode', board: { kind: 'text', plain: shortest, keys: { c: 3, v: 0 } }, book: T.messages }, 0), null);
  assert.equal(smallerCipher({ mode: 'decode', board: { kind: 'digits', plain: '123', keys: { d: 3 } }, book: T.messages }, 0), null);
  assert.equal(smallerCipher({ mode: 'sum', board: { kind: 'sum', op: 'add', rows: ['19', '69', '88'], hidden: [[1, 0], [2, 1]] }, book: T.messages }, 0), null);
  // 직접 만든 판(모음도 민 편지)도 같은 열쇠의 더 짧은 글
  const made = smallerCipher({ mode: 'made', board: { kind: 'text', plain: '오늘 바람이 불어요', keys: { c: 3, v: 4 } }, book: T.messages }, 0);
  assert.deepEqual(made.board.keys, { c: 3, v: 4 });
});
