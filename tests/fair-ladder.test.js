// 공정한 게임일까의 사다리 점검: 판 번호 1~30마다 판이 쓸 수 있고, 누가 유리한지를 다른 셈으로 다시 세고,
// 컴퓨터의 첫 1,000번이 그 판정과 맞는지(다른 던지기로), 아이의 열 번이 판 번호대로 헷갈리거나 판정대로 보이는지 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { LADDER, MAKE_LEVEL, RULES, TOP_LEVEL, generateBoard, lookFor, lopsided, nextSeed, rungOf, smallBoards } from '../src/core/fair-ladder.js';
import { AGREE, DEVICES, MANY, PLAYS, checkBoard, outcomesOf, valuesOf } from '../src/core/fair.js';
import { createRng, randInt } from '../src/core/rng.js';
import { smallerFair } from '../src/core/smaller.js';
import { bruteCount, bruteFixes, bruteValue } from './helpers/brute-fair.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const T = JSON.parse(readFileSync(resolve(ROOT, 'src/content/fair.json'), 'utf8'));
const SEEDS = Array.from({ length: 30 }, (_, index) => index + 1);
const RUNGS = LADDER.filter((rung) => rung.mode !== 'make');

/** 다른 던지기: 같은 시드 난수로 글자 하나의 경우를 차례로 뽑아, 다람쥐가 가져간 수를 센다 */
function bruteTally(rule, seed, n) {
  const rng = createRng(seed);
  const { kind, count } = DEVICES[rule.device];
  let a = 0;
  for (let at = 0; at < n; at++) {
    const text = Array.from({ length: count }, () => (kind === 'coin' ? (randInt(rng, 0, 1) === 1 ? 'H' : 'T') : String(randInt(rng, 1, 6)))).join('');
    if (rule.a.includes(bruteValue(rule.measure, text))) a += 1;
  }
  return { a, b: n - a };
}

test('사다리: 다섯 단계와 직접 만들기. 규칙마다 대본에 글이 있다', () => {
  assert.deepEqual(
    LADDER.map((rung) => [rung.level, rung.tag, rung.mode]),
    [
      [1, 'basic', 'judge'],
      [2, 'basic', 'judge'],
      [3, 'applied', 'judge'],
      [4, 'applied', 'judge'],
      [5, 'challenge', 'fix'],
      [6, 'challenge', 'make'],
    ],
  );
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  assert.throws(() => rungOf(9));
  assert.throws(() => generateBoard(6, 1));
  assert.deepEqual(Object.keys(T.games).sort(), Object.keys(RULES).sort());
  // 1단계는 동전, 2단계는 주사위 하나, 3단계는 두 주사위의 합, 4단계는 곱·차·큰 눈
  const devices = (level) => new Set(rungOf(level).names.map((name) => RULES[name].device));
  assert.deepEqual([...devices(1)].sort(), ['coin2', 'coin3']);
  assert.deepEqual([...devices(2)], ['die1']);
  assert.ok(rungOf(3).names.every((name) => ['sum', 'sumParity'].includes(RULES[name].measure)));
  assert.ok(rungOf(4).names.every((name) => ['prodParity', 'diff', 'max'].includes(RULES[name].measure)));
});

test('규칙 모음: 공정하거나, 한쪽이 경우의 9분의 1 넘게 많다(1,000번이면 드러난다). 공정한지 고르는 단계마다 공정한 규칙이 셋에 하나쯤 있다', () => {
  for (const [name, rule] of Object.entries(RULES)) {
    const { a, b, total } = bruteCount(rule);
    assert.ok(a === b || Math.abs(a - b) * 9 >= total, `${name}: ${a} 대 ${b}`);
    assert.equal(lopsided(rule), Math.abs(a - b) * 2 > total, name);
  }
  for (const rung of RUNGS.filter((item) => item.mode === 'judge')) {
    const fair = rung.names.filter((name) => bruteCount(RULES[name]).verdict === 'fair').length;
    assert.ok(fair >= 2 && fair * 2 <= rung.names.length, `${rung.level}단계: 공정한 규칙 ${fair}/${rung.names.length}`);
    // 다람쥐가 유리한 것과 고슴도치가 유리한 것이 모두 있다(1단계와 2단계는 한쪽만 있어도 된다)
    const sides = new Set(rung.names.map((name) => bruteCount(RULES[name]).verdict));
    assert.ok(sides.has('fair') && (sides.has('a') || sides.has('b')), String(rung.level));
  }
  // 고칠 규칙: 공정하지 않고, 한 군데만 바꿔서 공정해지는 곳이 있다(5단계는 한 곳뿐이다)
  for (const name of Object.keys(RULES).filter((item) => item.startsWith('fix-'))) {
    const rule = RULES[name];
    assert.notEqual(bruteCount(rule).verdict, 'fair', name);
    const fixes = bruteFixes(rule, valuesOf(rule.device, rule.measure));
    assert.ok(fixes.length >= 1, name);
    if (rungOf(5).names.includes(name)) assert.equal(fixes.length, 1, name);
  }
});

test('판 번호 1~30: 쓸 수 있는 판이고, 컴퓨터의 첫 1,000번이 모든 경우를 센 판정과 맞고, 열 번은 판 번호대로 보인다', () => {
  for (const rung of RUNGS) {
    let misled = 0;
    for (const seed of SEEDS) {
      const { board } = generateBoard(rung.level, seed);
      const label = `${rung.level}단계 ${seed}번 ${board.name}`;
      assert.equal(checkBoard(board), null, label);
      assert.equal(board.mode, rung.mode, label);
      assert.ok(rung.names.includes(board.name), label);
      assert.deepEqual(board.rule.a, RULES[board.name].a.slice().sort((x, y) => (typeof x === 'number' ? x - y : 0)), label);
      const { verdict } = bruteCount(board.rule);
      // 컴퓨터의 첫 1,000번: 공정하면 차가 40 이하, 아니면 유리한 쪽이 40 넘게 많다
      const many = bruteTally(board.rule, board.many, MANY);
      if (verdict === 'fair') assert.ok(Math.abs(many.a - many.b) <= AGREE, `${label}: ${many.a} 대 ${many.b}`);
      else {
        const [win, lose] = verdict === 'a' ? [many.a, many.b] : [many.b, many.a];
        assert.ok(win - lose > AGREE, `${label}: ${many.a} 대 ${many.b}`);
      }
      // 아이의 열 번
      if (rung.mode !== 'judge') continue;
      const ten = bruteTally(board.rule, board.throws, PLAYS);
      const gap = ten.a - ten.b;
      const look = lookFor(board.rule, seed);
      if (look === 'mislead') {
        misled += 1;
        if (verdict === 'fair') assert.ok(Math.abs(gap) >= 4, `${label}: ${ten.a} 대 ${ten.b}`);
        else assert.ok(verdict === 'a' ? gap <= 0 : gap >= 0, `${label}: ${ten.a} 대 ${ten.b}`);
      } else if (verdict === 'fair') assert.ok(Math.abs(gap) <= 2, `${label}: ${ten.a} 대 ${ten.b}`);
      else assert.ok(verdict === 'a' ? gap > 0 : gap < 0, `${label}: ${ten.a} 대 ${ten.b}`);
    }
    // 열 번이 헷갈리게 나오는 판이 단계마다 있다
    if (rung.mode === 'judge') assert.ok(misled >= 5, `${rung.level}단계: ${misled}`);
  }
});

test('1번 판: 1단계는 동전 둘의 "두 면이 같으면 다람쥐"(공정한 게임)이고 열 번이 판정대로 보인다. 같은 번호는 늘 같은 판이다', () => {
  const { board } = generateBoard(1, 1);
  assert.equal(board.name, 'coin2-same');
  assert.equal(bruteCount(board.rule).verdict, 'fair');
  assert.equal(lookFor(board.rule, 1), 'honest');
  assert.deepEqual(generateBoard(1, 1), generateBoard(1, 1));
  assert.deepEqual(generateBoard(3, 7, { small: true }).board, generateBoard(3, 7).board);
  assert.deepEqual(generateBoard(1, 9, { small: true }).board, board);
  for (const rung of RUNGS) {
    for (const seed of [1, 5, 9, 14]) {
      const next = nextSeed(rung.level, seed);
      assert.ok(next > seed);
      assert.notEqual(generateBoard(rung.level, next).board.name, generateBoard(rung.level, seed).board.name);
    }
    // 첫 바퀴는 적힌 차례다
    assert.deepEqual(
      rung.names.map((_, index) => generateBoard(rung.level, index + 1).board.name),
      rung.names,
    );
  }
});

test('더 작은 판: 경우가 더 적은 던지는 것의 같은 종류 판이고, 동전 둘의 판에는 없다', () => {
  for (const rung of RUNGS) {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const { board } = generateBoard(rung.level, seed);
      const { yes } = smallBoards({ mode: board.mode, board });
      const cases = outcomesOf(board.rule.device).length;
      if (board.rule.device === 'coin2') assert.equal(yes.length, 0);
      for (const small of yes) {
        assert.equal(checkBoard(small), null);
        assert.equal(small.mode, board.mode);
        assert.ok(outcomesOf(small.rule.device).length < cases, `${board.name} → ${small.name}`);
      }
      const first = smallerFair({ mode: board.mode, board }, 0);
      if (yes.length === 0) assert.equal(first, null);
      else {
        assert.deepEqual(first.board, yes[0]);
        assert.deepEqual(smallerFair({ mode: board.mode, board }, 1).board, yes[1 % yes.length]);
      }
    }
  }
  // 주사위 둘의 판에는 공정한 작은 판과 공정하지 않은 작은 판이 함께 있다
  const { yes } = smallBoards({ mode: 'judge', board: generateBoard(3, 1).board });
  assert.deepEqual(new Set(yes.map((small) => bruteCount(small.rule).verdict === 'fair')).size, 2);
});
