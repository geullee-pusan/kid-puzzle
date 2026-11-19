// 숨은 규칙 찾기의 판과 규칙, 후보 규칙, 갈라 볼 것 고르기, 선생님이 규칙을 찾는 방법을 확인한다.
// 규칙의 뜻과 후보 규칙의 목록은 tests/helpers/brute-rulehunt.js가 다른 방법으로 다시 적은 것과 견준다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MAX_CHECK,
  MIN_CHECK,
  TOPS,
  TRIPLE_RULES,
  atomics,
  checkBoard,
  classesOf,
  findRule,
  fitting,
  holds,
  indexOf,
  joinRule,
  judgeCheck,
  libraryOf,
  parseRule,
  pickCheck,
  ruleFits,
  smallBoards,
  solve,
  thresholds,
  universeOf,
  whyOpen,
} from '../src/core/rulehunt.js';
import { createRng, randInt } from '../src/core/rng.js';
import { bruteBits, bruteIndex, bruteLibrary, bruteRivals, bruteRuleSet, bruteTriple } from './helpers/brute-rulehunt.js';

const numberBoard = (top, rule, lib = 'two', given = null) => {
  const yes = universeOf({ kind: 'number', top }).filter((x) => holds(rule, x));
  return { kind: 'number', top, rule, given: given ?? [yes[0]], lib };
};
const tripleBoard = (top, rule, given = [[2, 4, 6]]) => ({ kind: 'triple', top, rule, given, lib: 'triple' });

test('경계와 후보 규칙의 목록: 범위마다 크다·작다의 경계가 정해져 있고, 목록은 다른 방법으로 만든 것과 같다', () => {
  assert.deepEqual(thresholds(10), [5]);
  assert.deepEqual(thresholds(20), [5, 10, 15]);
  assert.deepEqual(thresholds(30), [5, 10, 15, 20, 25]);
  assert.deepEqual(thresholds(50), [5, 10, 15, 20, 25, 30, 35, 40, 45]);
  assert.deepEqual(thresholds(100), [10, 20, 30, 40, 50, 60, 70, 80, 90]);
  for (const top of TOPS) {
    assert.deepEqual(libraryOf({ kind: 'number', top, lib: 'one' }), bruteLibrary(top, 'one'));
    const two = libraryOf({ kind: 'number', top, lib: 'two' });
    assert.deepEqual([...two].sort(), [...bruteLibrary(top, 'two')].sort());
    assert.equal(new Set(two).size, two.length, '같은 이름표가 두 번 없다');
    for (const rule of two) assert.ok(ruleFits(rule, 'number', top), rule);
  }
  assert.deepEqual(libraryOf({ kind: 'triple', top: 20, lib: 'triple' }), TRIPLE_RULES);
});

test('규칙의 뜻: 모든 범위의 모든 후보 규칙이 모든 수에서 다른 방법으로 따진 것과 같다', () => {
  for (const top of TOPS) {
    for (const rule of bruteLibrary(top, 'two')) {
      const set = bruteRuleSet(rule, top);
      for (let x = 1; x <= top; x++) assert.equal(holds(rule, x), set.has(x), `${top}: ${rule} ${x}`);
    }
  }
});

test('세 수의 규칙: 1~20의 모든 세 수(8,000개)에서 다른 방법으로 따진 것과 같다', () => {
  for (const rule of TRIPLE_RULES) {
    for (let a = 1; a <= 20; a++) for (let b = 1; b <= 20; b++) for (let c = 1; c <= 20; c++) assert.equal(holds(rule, [a, b, c]), bruteTriple(rule, [a, b, c]), `${rule} ${a},${b},${c}`);
  }
  // 2, 4, 6은 점점 작아지는 세 수만 빼고 모든 세 수의 규칙에 맞는다(처음 받는 세 수로 쓴다)
  assert.deepEqual(TRIPLE_RULES.filter((rule) => !holds(rule, [2, 4, 6])), ['dec']);
});

test('이름표 읽기와 잇기: 같은 성질 둘은 하나로, 앞뒤는 목록의 차례대로. 범위에 없는 경계는 쓸 수 없다', () => {
  assert.equal(joinRule('lt20', 'and', 'even', 50), 'even&lt20');
  assert.equal(joinRule('even', 'and', 'lt20', 50), 'even&lt20');
  assert.equal(joinRule('d5', 'or', 'm3', 50), 'm3|d5');
  assert.equal(joinRule('even', 'or', 'even', 50), 'even');
  assert.equal(joinRule('even', 'one', 'lt20', 50), 'even');
  assert.deepEqual(parseRule('m3|d5'), { op: 'or', a: 'm3', b: 'd5' });
  assert.deepEqual(parseRule('inc'), { op: 'triple', a: 'inc', b: null });
  for (const bad of ['', 'm', 'm03', 'x5', 'even&', 'even&&odd', 'gt', null]) assert.equal(parseRule(bad), null, String(bad));
  assert.equal(ruleFits('gt25', 'number', 20), false);
  assert.equal(ruleFits('gt15', 'number', 20), true);
  assert.equal(ruleFits('m7', 'number', 30), false);
  assert.equal(ruleFits('lt20&even', 'number', 50), false, '차례가 거꾸로인 이름표');
  assert.equal(ruleFits('inc', 'number', 30), false);
  assert.equal(ruleFits('even', 'triple', 20), false);
});

test('가름: 범위에서 돼요인 수가 같은 규칙은 한 묶음이고, 대표는 목록의 맨 앞 규칙이다. 묶음의 수가 다른 방법으로 센 것과 같다', () => {
  for (const top of TOPS) {
    for (const lib of ['one', 'two']) {
      const board = { kind: 'number', top, lib };
      const classes = classesOf(board);
      const order = libraryOf(board);
      const brute = new Set(bruteLibrary(top, lib).map((rule) => bruteBits(board, rule).map(Number).join('')));
      assert.equal(classes.length, brute.size, `${top} ${lib}`);
      assert.equal(classes.flatMap((group) => group.rules).length, order.length);
      for (const group of classes) assert.equal(order.indexOf(group.rule), Math.min(...group.rules.map((rule) => order.indexOf(rule))));
    }
  }
  // 10의 배수와 일의 자리가 0인 수는 같은 묶음이고, 10의 배수가 대표다.
  const group = classesOf({ kind: 'number', top: 30, lib: 'one' }).find((item) => item.rules.includes('d0'));
  assert.deepEqual(group.rules, ['m10', 'd0']);
  assert.equal(classesOf({ kind: 'triple', top: 20, lib: 'triple' }).length, TRIPLE_RULES.length, '세 수의 규칙은 모두 서로 다르다');
  assert.equal(classesOf({ kind: 'triple', top: 10, lib: 'triple' }).length, TRIPLE_RULES.length);
});

test('맞는 후보: 물어본 것과 답이 같은 후보 규칙이 다른 방법으로 따진 것과 같다', () => {
  const rng = createRng(20261119);
  for (let round = 0; round < 60; round++) {
    const top = [20, 30, 50][round % 3];
    const lib = round % 2 === 0 ? 'one' : 'two';
    const rules = bruteLibrary(top, lib).filter((rule) => {
      const size = bruteRuleSet(rule, top).size;
      return size > 0 && size < top;
    });
    // 다른 방법으로 만든 목록의 이름표도 앞뒤가 목록의 차례대로다(그대로 쓸 수 있다).
    const rule = rules[randInt(rng, 0, rules.length - 1)];
    assert.ok(ruleFits(rule, 'number', top), rule);
    const board = numberBoard(top, rule, lib);
    const known = Array.from({ length: randInt(rng, 0, 8) }, () => randInt(rng, 1, top));
    const ours = fitting(board, known);
    const brute = bruteRivals(board, known);
    const bitsOf = (list) => new Set(list.map((item) => (item.bits instanceof Array ? item.bits.map(Number).join('') : item.bits)));
    assert.equal(ours.fit.flatMap((group) => group.rules).length, brute.fit.length, rule);
    assert.deepEqual(bitsOf(ours.rivals), bitsOf(brute.rivals), rule);
    assert.ok(ours.same, '숨은 규칙은 늘 맞는 후보에 든다');
  }
});

/** 갈라 볼 것이 갈라야 할 것을 모두 가르는지 다른 방법으로 본다 */
function assertSeparates(board, known, items) {
  const { rivals, truth } = bruteRivals(board, known);
  for (const { rule, bits } of rivals) {
    assert.ok(
      items.some((item) => bits[bruteIndex(board, item)] !== truth[bruteIndex(board, item)]),
      `${board.rule}: ${rule}가 갈라 볼 것 ${JSON.stringify(items)}에서 숨은 규칙과 같게 가른다`,
    );
  }
}

test('갈라 볼 것: 숨은 규칙과 함께 지금까지의 답에 맞지만 숨은 규칙과는 다른 후보를 모두 가른다(가를 수 있는 것이 있으면 늘)', () => {
  const rng = createRng(7);
  let checked = 0;
  for (const top of [20, 30, 50, 100]) {
    for (const lib of ['one', 'two']) {
      const order = libraryOf({ kind: 'number', top, lib });
      for (let round = 0; round < 25; round++) {
        const rule = order[randInt(rng, 0, order.length - 1)];
        const yes = universeOf({ kind: 'number', top }).filter((x) => holds(rule, x));
        if (yes.length === 0 || yes.length === top) continue;
        const board = numberBoard(top, rule, lib, [yes[randInt(rng, 0, yes.length - 1)]]);
        assert.equal(checkBoard(board), null);
        // 확인만 하는 물음(돼요인 수만)과 아무 수나 섞어서 묻는다.
        const known = [...board.given];
        for (let k = randInt(rng, 0, 6); k > 0; k--) known.push(round % 2 ? yes[randInt(rng, 0, yes.length - 1)] : randInt(rng, 1, top));
        const unique = [...new Set(known)];
        const result = pickCheck(board, unique, 1000 + round);
        assert.ok(result.covered, `${top} ${rule}`);
        assert.ok(result.items.length >= Math.min(MIN_CHECK, top - unique.length) && result.items.length <= MAX_CHECK);
        assert.equal(new Set(result.items).size, result.items.length);
        for (const item of result.items) assert.ok(!unique.includes(item) && item >= 1 && item <= top);
        assertSeparates(board, unique, result.items);
        // 숨은 규칙이 아닌 후보대로 가르면 반드시 하나 이상 어긋난다.
        for (const group of fitting(board, unique).rivals) {
          const picks = result.items.map((item) => (group.bits[indexOf(board, item)] === '1' ? 'yes' : 'no'));
          assert.equal(judgeCheck(board, result.items, picks).correct, false, group.rule);
        }
        // 같은 시드는 같은 것을 낸다.
        assert.deepEqual(pickCheck(board, unique, 1000 + round), result);
        checked += 1;
      }
    }
  }
  assert.ok(checked > 150);
});

test('갈라 볼 것(세 수): 1~20과 1~10의 모든 숨은 규칙에서 다른 후보를 모두 가르고, 되도록 12 이하의 수로 고른다', () => {
  const rng = createRng(11);
  for (const top of [10, 20]) {
    for (const rule of TRIPLE_RULES) {
      const yes = universeOf({ kind: 'triple', top }).filter((item) => holds(rule, item));
      for (let round = 0; round < 3; round++) {
        const board = tripleBoard(top, rule, [yes[randInt(rng, 0, yes.length - 1)]]);
        const known = [...board.given, ...Array.from({ length: round * 2 }, () => yes[randInt(rng, 0, yes.length - 1)])];
        const unique = known.filter((item, at) => known.findIndex((other) => other.join() === item.join()) === at);
        const result = pickCheck(board, unique, 50 + round);
        assert.ok(result.covered, `${top} ${rule}`);
        assert.ok(result.items.length >= MIN_CHECK && result.items.length <= MAX_CHECK);
        assertSeparates(board, unique, result.items);
        assert.ok(result.items.every((item) => item.every((x) => x <= 12)), JSON.stringify(result.items));
        assert.ok(result.items.every((item) => !unique.some((other) => other.join() === item.join())));
      }
    }
  }
});

test('갈라 볼 것: 갈라야 할 후보가 없어도 넷을 내고, 돼요와 안 돼요가 섞이게 한다(모두 돼요로 어림해서는 맞지 않게)', () => {
  // 1~30에서 짝수를 처음 받은 수와 홀수 몇 개로 다 가른 뒤에는 짝수와 다른 후보가 없다.
  const board = numberBoard(30, 'even', 'one', [2, 4, 6]);
  const known = [2, 4, 6, 1, 3, 12, 22, 25, 28, 21, 11, 14];
  assert.equal(fitting(board, known).rivals.length, 0);
  const result = pickCheck(board, known, 3);
  assert.equal(result.items.length, MIN_CHECK);
  const yes = result.items.filter((x) => x % 2 === 0).length;
  assert.ok(yes > 0 && yes < result.items.length, JSON.stringify(result.items));
  // 남은 것이 모자라면 남은 것만 낸다. 다 물었으면 아무것도 내지 않는다.
  const small = numberBoard(10, 'gt5', 'one', [6]);
  assert.deepEqual(pickCheck(small, [1, 2, 3, 4, 5, 6, 7, 8], 1).items, [9, 10]);
  assert.deepEqual(pickCheck(small, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 1).items, []);
});

test('갈라 볼 것의 수: 둘을 이은 모든 규칙에서 처음 받은 돼요가 셋이면 일곱 개 안, 하나뿐이어도 열두 개 안에 다른 후보를 모두 가른다', () => {
  for (const top of [20, 30, 50, 100]) {
    const base = { kind: 'number', top, lib: 'two' };
    let most = { one: 0, three: 0 };
    for (const group of classesOf(base)) {
      const yes = universeOf(base).filter((x) => group.bits[x - 1] === '1');
      if (yes.length === 0 || yes.length === top) continue;
      for (const [key, given] of [
        ['one', yes.slice(0, 1)],
        ['three', yes.slice(0, 3)],
      ]) {
        if (key === 'three' && !/[&|]/.test(group.rule)) continue;
        const result = pickCheck({ ...base, rule: group.rule, given }, given, 1);
        assert.ok(result.covered, `${top}: ${group.rule}`);
        most = { ...most, [key]: Math.max(most[key], result.items.length) };
      }
    }
    assert.ok(most.three <= 7 && most.one <= MAX_CHECK, `${top}: ${JSON.stringify(most)}`);
  }
});

test('맞춰 보기: 숨은 규칙이 다르게 가르는 것의 자리만 알려 준다', () => {
  const board = numberBoard(30, 'even', 'one', [2, 4, 6]);
  assert.deepEqual(judgeCheck(board, [3, 12, 21, 22], ['no', 'yes', 'no', 'yes']), { correct: true, wrong: [] });
  assert.deepEqual(judgeCheck(board, [3, 12, 21, 22], ['no', 'no', 'yes', 'yes']), { correct: false, wrong: [1, 2] });
  assert.deepEqual(judgeCheck(board, [3, 12], [null, 'yes']), { correct: false, wrong: [0] });
});

test('선생님이 찾기: 1~30과 1~50의 모든 후보 규칙(둘을 이은 것까지)을 찾아내고, 묻는 수는 다 다르고 하나 물을 때마다 후보가 준다', () => {
  for (const top of [30, 50]) {
    const base = { kind: 'number', top, lib: 'two' };
    let most = 0;
    let sum = 0;
    let count = 0;
    for (const group of classesOf(base)) {
      const yes = [...group.bits].filter((bit) => bit === '1').length;
      if (yes === 0 || yes === top) continue;
      const result = findRule({ ...base, rule: group.rule, given: [universeOf(base).find((x) => holds(group.rule, x))] });
      assert.equal(result.rule, group.rule, `${top}: ${group.rule}`);
      assert.equal(new Set(result.asks.map((entry) => entry.x)).size, result.asks.length);
      for (const entry of result.asks) assert.equal(entry.yes, holds(group.rule, entry.x));
      const lefts = result.asks.map((entry) => entry.left);
      lefts.forEach((left, at) => assert.ok(at === 0 || left < lefts[at - 1]));
      assert.equal(lefts.at(-1), 1);
      most = Math.max(most, result.asks.length);
      sum += result.asks.length;
      count += 1;
    }
    // 가름은 400~700개쯤이고, 거의 반씩 갈라 가므로 대개 열 번 남짓 묻는다(돼요가 한두 개뿐인 규칙은 오래 걸린다).
    assert.ok(sum / count < 12, `${top}: ${sum / count}`);
    assert.ok(most <= 30, `${top}: ${most}`);
  }
  // 1~100은 몇 개만 본다.
  for (const rule of ['even&lt20', 'm3|d5', 'gt70', 'odd&gt50']) assert.equal(findRule(numberBoard(100, rule)).rule, rule);
  // 다른 이름으로 같은 수를 고르는 규칙은 대표 이름으로 찾는다.
  assert.equal(findRule(numberBoard(30, 'd0')).rule, 'm10');
});

test('판 확인: 범위, 목록, 규칙, 처음 받은 것을 본다', () => {
  assert.equal(checkBoard(numberBoard(30, 'even', 'one', [2, 4, 6])), null);
  assert.equal(checkBoard(tripleBoard(20, 'inc')), null);
  assert.equal(checkBoard({ ...numberBoard(30, 'even', 'one', [2, 4, 6]), top: 40 }), 'top');
  assert.equal(checkBoard(numberBoard(30, 'even&lt20', 'one', [2])), 'lib');
  assert.equal(checkBoard(numberBoard(30, 'gt45', 'one', [46])), 'rule');
  assert.equal(checkBoard(numberBoard(30, 'even', 'one', [3])), 'given-no');
  assert.equal(checkBoard(numberBoard(30, 'even', 'one', [2, 2])), 'given-twice');
  assert.equal(checkBoard(numberBoard(30, 'even', 'one', [])), 'given');
  assert.equal(checkBoard(numberBoard(30, 'even', 'one', [32])), 'given');
  assert.equal(checkBoard(numberBoard(30, 'even&odd', 'two', [2])), 'all-same');
  assert.equal(checkBoard(numberBoard(30, 'even|odd', 'two', [2])), 'all-same');
  assert.equal(checkBoard(tripleBoard(20, 'inc', [[6, 4, 2]])), 'given-no');
  assert.equal(checkBoard(tripleBoard(20, 'inc', [[2, 4, 26]])), 'given');
  assert.equal(checkBoard({ ...tripleBoard(20, 'inc'), lib: 'one' }), 'lib');
  assert.equal(checkBoard(null), 'board');
});

test('풀이: 돼요인 것의 수, 처음 받은 것만으로는 가를 수 없는 다른 후보(가름의 대표)', () => {
  const solution = solve(numberBoard(50, 'even', 'one', [4, 8, 16]));
  assert.equal(solution.yes, 25);
  // 4, 8, 16에 맞는 다른 후보: 4의 배수, 큰 수와 작은 수의 경계들
  assert.ok(solution.rivals.includes('m4'));
  assert.ok(!solution.rivals.includes('even'));
  assert.equal(solution.rivals.length, bruteRivals(numberBoard(50, 'even', 'one', [4, 8, 16]), [4, 8, 16]).rivals.length);
  assert.deepEqual(solve(numberBoard(30, 'm10', 'one', [10])).sameAs, ['d0']);
});

test('더 작은 판: 같은 숨은 규칙을 더 좁은 범위에서. 처음 받은 것은 범위에 드는 것만 남고, 돼요와 안 돼요가 둘 이상씩 있다', () => {
  const list = smallBoards(numberBoard(50, 'gt10', 'one', [15, 25, 35]));
  // 1~20에는 처음 받은 15, 25, 35 가운데 15 하나만 남아서(둘은 남아야 한다) 내지 않는다.
  assert.deepEqual(list.map((board) => board.top), [30]);
  assert.deepEqual(list[0].given, [15, 25]);
  assert.deepEqual(smallBoards(numberBoard(50, 'even', 'one', [4, 8, 16])).map((board) => [board.top, board.given]), [
    [30, [4, 8, 16]],
    [20, [4, 8, 16]],
    [10, [4, 8]],
  ]);
  for (const board of list) assert.equal(checkBoard(board), null);
  // 경계가 범위 밖으로 나가는 규칙은 그 범위로 줄이지 않는다.
  assert.deepEqual(smallBoards(numberBoard(30, 'gt20', 'one', [21, 25, 30])).map((board) => board.top), []);
  assert.deepEqual(smallBoards(numberBoard(30, 'lt10', 'one', [2, 4, 6])).map((board) => board.top), [20]);
  // 세 수 판은 1~10으로 줄인다.
  assert.deepEqual(smallBoards(tripleBoard(20, 'inc')).map((board) => board.top), [10]);
  assert.deepEqual(smallBoards(tripleBoard(10, 'inc')), []);
  assert.deepEqual(smallBoards(tripleBoard(20, 'alldiff', [[5, 10, 15]])), [], '처음 받은 세 수가 범위 밖이면 줄이지 않는다');
});

test('"왜 그럴까?"는 판을 끝까지 하고 갈라 본 것이 한 번 어긋났거나, 판을 둘 끝까지 한 뒤에 열린다', () => {
  const done = (more = {}) => ({ kind: 'round', id: `r${Math.random()}`, format: 'rulehunt', outcome: 'solved', failedChecks: 0, ...more });
  assert.equal(whyOpen([]), false);
  assert.equal(whyOpen([done()]), false);
  assert.equal(whyOpen([done({ failedChecks: 1 })]), true);
  assert.equal(whyOpen([done(), done()]), true);
  assert.equal(whyOpen([done({ outcome: 'left', failedChecks: 2 })]), false);
  assert.equal(whyOpen([done({ side: true, failedChecks: 1 })]), false, '작은 판은 세지 않는다');
  assert.equal(whyOpen([done({ format: 'maze', failedChecks: 1 })]), false);
});

test('범위: 수 판은 1부터 끝 수까지, 세 수 판은 사전 차례. 자리 찾기가 다른 방법과 같다', () => {
  assert.deepEqual(universeOf({ kind: 'number', top: 10 }), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const triples = universeOf({ kind: 'triple', top: 10 });
  assert.equal(triples.length, 1000);
  triples.forEach((item, at) => {
    assert.equal(indexOf({ kind: 'triple', top: 10 }, item), at);
    assert.equal(bruteIndex({ kind: 'triple', top: 10 }, item), at);
  });
  assert.equal(indexOf({ kind: 'number', top: 30 }, 31), -1);
  assert.equal(indexOf({ kind: 'number', top: 30 }, 0), -1);
  assert.equal(indexOf({ kind: 'number', top: 30 }, 2.5), -1);
  assert.equal(indexOf({ kind: 'triple', top: 10 }, [1, 2]), -1);
  assert.equal(indexOf({ kind: 'triple', top: 10 }, [1, 2, 11]), -1);
  assert.equal(atomics(30).length, 27);
});
