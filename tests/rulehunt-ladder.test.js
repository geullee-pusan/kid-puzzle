// 숨은 규칙 찾기의 사다리와 판 내기를 확인한다: 단계마다의 판, 같은 번호는 같은 판, 처음 받은 돼요,
// 2단계의 "떠오르는 생각이 너무 좁거나 넓은" 판, 3단계의 "두 가지를 이은" 규칙, 4단계의 세 수 판,
// 그리고 아이가 확인만 하는 물음을 해도 갈라 보기가 다른 후보를 다 가르는지.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { GIVEN_COUNT, LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf } from '../src/core/rulehunt-ladder.js';
import { MIN_CHECK, atomics, checkBoard, classesOf, fitting, holds, pickCheck, signatureOf, universeOf } from '../src/core/rulehunt.js';
import { createRng, randInt } from '../src/core/rng.js';
import { bruteRuleSet } from './helpers/brute-rulehunt.js';

const SEEDS = Array.from({ length: 60 }, (_, index) => index + 1);

test('사다리: 다섯 단계, 표시는 기본·응용·응용·도전·도전, 맨 위는 직접 만들기', () => {
  assert.deepEqual(
    LADDER.map((rung) => [rung.level, rung.tag, rung.mode]),
    [
      [1, 'basic', 'number'],
      [2, 'applied', 'number'],
      [3, 'applied', 'number'],
      [4, 'challenge', 'triple'],
      [5, 'challenge', 'make'],
    ],
  );
  assert.equal(TOP_LEVEL, 4);
  assert.equal(MAKE_LEVEL, 5);
  assert.throws(() => rungOf(9));
  assert.throws(() => generateBoard(MAKE_LEVEL, 1));
  // 1단계는 1~30, 2·3단계는 1~50, 4단계는 1~20의 세 수. 작은 판은 한 단 좁다.
  assert.deepEqual(LADDER.slice(0, 4).map((rung) => [rung.top, rung.small, rung.lib]), [
    [30, 20, 'one'],
    [50, 30, 'one'],
    [50, 30, 'two'],
    [20, 10, 'triple'],
  ]);
});

test('같은 번호는 늘 같은 판이고, 낸 판은 모두 쓸 수 있는 판이다. 처음 받은 것은 숨은 규칙으로 돼요다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const small of [false, true]) {
      for (const seed of SEEDS) {
        const made = generateBoard(level, seed, { small });
        assert.deepEqual(generateBoard(level, seed, { small }), made);
        assert.equal(checkBoard(made.board), null, `${level} ${seed} ${small}`);
        assert.equal(made.board.top, small ? rungOf(level).small : rungOf(level).top);
        for (const item of made.board.given) assert.ok(holds(made.board.rule, item));
        if (made.board.kind === 'number' && !small) assert.equal(made.board.given.length, GIVEN_COUNT);
        // 다른 방법으로 따져도 처음 받은 수는 돼요다.
        if (made.board.kind === 'number') for (const x of made.board.given) assert.ok(bruteRuleSet(made.board.rule, made.board.top).has(x));
      }
    }
  }
});

test('1단계: 맨 처음 판은 2, 4, 6을 받는 짝수. 그다음은 성질 하나짜리 규칙이 돌고, 돼요와 안 돼요가 셋 이상씩 있다', () => {
  assert.deepEqual(generateBoard(1, 1).board, { kind: 'number', top: 30, rule: 'even', given: [2, 4, 6], lib: 'one' });
  const rules = new Set();
  for (const seed of SEEDS) {
    const { board } = generateBoard(1, seed);
    rules.add(board.rule);
    assert.ok(atomics(30).includes(board.rule));
    const yes = universeOf(board).filter((x) => holds(board.rule, x)).length;
    assert.ok(yes >= 3 && board.top - yes >= 3, board.rule);
  }
  assert.equal(rules.size, 10);
});

test('2단계: 처음 받은 수로 떠오르는 생각이 숨은 규칙보다 좁거나 넓다. 그 생각대로 확인만 하는 물음으로는 둘이 갈리지 않는다', () => {
  const seen = new Set();
  for (const seed of SEEDS.slice(0, 8)) {
    const { board } = generateBoard(2, seed);
    seen.add(`${board.rule}:${board.given.join(',')}`);
    const truth = new Set(universeOf(board).filter((x) => holds(board.rule, x)));
    const { rivals } = fitting(board, board.given);
    // 숨은 규칙의 돼요를 모두 품거나(넓은 생각) 숨은 규칙의 돼요 안에 드는(좁은 생각) 다른 후보가 있다.
    const nested = rivals.filter((group) => {
      const yes = universeOf(board).filter((x) => group.bits[x - 1] === '1');
      return yes.every((x) => truth.has(x)) || [...truth].every((x) => yes.includes(x));
    });
    assert.ok(nested.length >= 1, board.rule);
    // 좁은 생각대로 "돼요일 것 같은 수"만 다 물어도, 그 생각과 숨은 규칙이 모두 맞는 채로 남는 판이 있다.
    for (const group of nested) {
      const asks = universeOf(board).filter((x) => group.bits[x - 1] === '1');
      if (!asks.every((x) => truth.has(x))) continue;
      const after = fitting(board, [...board.given, ...asks]);
      assert.ok(after.fit.some((item) => item.bits === group.bits) && after.same, `${board.rule}: ${group.rule}`);
    }
  }
  assert.equal(seen.size, 8, '여덟 가지 판이 돈다');
  // 대표적인 판: 4, 8, 16인데 짝수. 4의 배수를 다 물어도(모두 돼요) 짝수와 4의 배수가 함께 맞는다.
  const first = generateBoard(2, 1).board;
  assert.deepEqual([first.rule, first.given], ['even', [4, 8, 16]]);
  const m4 = universeOf(first).filter((x) => x % 4 === 0);
  assert.deepEqual(
    fitting(first, [...first.given, ...m4]).fit.map((group) => group.rule),
    ['even', 'm4'],
  );
});

test('3단계: 두 가지를 이은 규칙이고, 그 범위(1~50, 작은 판 1~30)에서 성질 하나짜리 규칙과 같지 않다', () => {
  for (const small of [false, true]) {
    for (const seed of SEEDS.slice(0, 16)) {
      const { board } = generateBoard(3, seed, { small });
      assert.match(board.rule, /[&|]/);
      const plain = new Set(atomics(board.top).map((rule) => signatureOf({ ...board, lib: 'one' }, rule)));
      assert.ok(!plain.has(signatureOf(board, board.rule)), `${board.top}: ${board.rule}`);
      const yes = universeOf(board).filter((x) => holds(board.rule, x)).length;
      assert.ok(yes >= 3 && board.top - yes >= 3, board.rule);
    }
  }
});

test('4단계: 세 수 판. 숨은 규칙은 다른 세 수의 규칙과 범위에서 다르고, 처음 받은 세 수에는 다른 규칙도 여럿 맞는다', () => {
  assert.deepEqual(generateBoard(4, 1).board, { kind: 'triple', top: 20, rule: 'inc', given: [[2, 4, 6]], lib: 'triple' });
  for (const seed of SEEDS.slice(0, 12)) {
    for (const small of [false, true]) {
      const { board } = generateBoard(4, seed, { small });
      assert.equal(board.kind, 'triple');
      const groups = classesOf(board);
      assert.equal(groups.find((group) => group.rules.includes(board.rule)).rules.length, 1);
      assert.ok(fitting(board, board.given).rivals.length >= 4, `${board.rule} ${JSON.stringify(board.given)}`);
    }
  }
  // 2, 4, 6에는 점점 커지는 세 수 말고도 아홉 가지 규칙이 맞는다(점점 작아지는 세 수만 빼고).
  assert.equal(fitting(generateBoard(4, 1).board, [[2, 4, 6]]).rivals.length, 9);
  // 2씩 커지는 세 수만 다 물어도(모두 돼요) 여섯 규칙이 남는다.
  const board = generateBoard(4, 1).board;
  const plus2 = Array.from({ length: 16 }, (_, index) => [index + 1, index + 3, index + 5]);
  assert.deepEqual(
    fitting(board, [...board.given, ...plus2]).fit.map((group) => group.rule),
    ['inc', 'plus2', 'step', 'alldiff', 'lastbig', 'firstsmall'],
  );
});

test('확인만 하는 물음과 아무렇게나 한 물음 뒤에도, 갈라 보기는 다른 후보를 모두 가르고 사다리의 판에서는 늘 넷이다', () => {
  const rng = createRng(4);
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of SEEDS.slice(0, 20)) {
      const { board } = generateBoard(level, seed);
      const all = universeOf(board);
      const yes = all.filter((item) => holds(board.rule, item));
      let known = [...board.given];
      for (let turn = 0; turn < 4; turn++) {
        // 돼요인 것만 묻거나(확인만), 아무것이나 묻는다.
        for (let k = randInt(rng, 0, 3); k > 0; k--) {
          const pool = turn % 2 === 0 ? yes : all;
          const item = pool[randInt(rng, 0, pool.length - 1)];
          if (!known.some((other) => JSON.stringify(other) === JSON.stringify(item))) known.push(item);
        }
        const result = pickCheck(board, known, seed * 7 + turn);
        assert.ok(result.covered, `${level} ${seed}`);
        assert.equal(result.items.length, MIN_CHECK, `${level} ${seed} ${JSON.stringify(result.items)}`);
        known = [...known, ...result.items];
      }
    }
  }
});

test('다음 판 번호는 방금 한 판과 다른 판이 나오는 번호다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of SEEDS.slice(0, 20)) {
      const next = nextSeed(level, seed);
      assert.ok(next > seed);
      assert.notDeepEqual(generateBoard(level, next).board, generateBoard(level, seed).board);
    }
  }
});
