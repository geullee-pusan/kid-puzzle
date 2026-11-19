// 규칙 기계와 규칙이 깨지는 판의 풀이 프로그램을 다른 방법으로 견준다.
// 블록마다의 계산, 줄과 되풀이, 아주 먼 칸, 넣은 수 찾기, 계속 작아지는 줄의 가장 긴 것, 원 위의 점을 이은 조각의 수, 차림표가 깨지는 곳.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  CIRCLE_ANGLES,
  CIRCLE_MAX,
  OPS,
  applyMachine,
  applyStep,
  cellAt,
  checkBoard,
  checkMachine,
  circleCountByLines,
  circlePoints,
  circleRegions,
  crossingsOn,
  cycleOf,
  factorPair,
  fallingBest,
  fallingLength,
  familyOf,
  firstBreak,
  preimagesOf,
  recipeOf,
  reverseOf,
  runRow,
  solve,
  traceOf,
  twoDivisors,
  whyOpen,
} from '../src/core/machine.js';
import { MACHINES } from '../src/core/machine-ladder.js';
import { bruteCycle, bruteFalling, bruteRow, bruteStep, eulerRegions, sampledRegions, sieve } from './helpers/brute-machine.js';

const one = (...steps) => ({ kind: 'one', steps });
const PAIR = { kind: 'pair' };

test('블록마다의 계산이 다른 방법(10으로 나눈 나머지, 더하기를 되풀이한 곱하기)과 같다', () => {
  for (const op of OPS) {
    const ks = op === 'add' ? [1, 7, 99] : op === 'mul' ? [2, 3, 9] : [undefined];
    for (const k of ks) {
      const step = k === undefined ? { op } : { op, k };
      for (let n = 0; n <= 3000; n++) assert.equal(applyStep(step, n), bruteStep(step, n), `${op} ${k} ${n}`);
    }
  }
  // 뒤집으면 0으로 시작하는 0은 읽지 않는다
  assert.equal(reverseOf(120), 21);
  assert.equal(reverseOf(7), 7);
  // 기계 속: 블록마다 한 뒤의 수
  assert.deepEqual(traceOf(MACHINES.revAdd, 13), [13, 31, 32]);
  assert.equal(applyMachine(MACHINES.squares, 23), 13);
});

test('줄과 되풀이: 여러 기계, 처음 칸 1~99(두 수 기계는 짝)에서 되풀이가 시작하는 칸과 칸 수가 아주 길게 돌린 줄과 같다', () => {
  const machines = [MACHINES.revAdd, MACHINES.squares, MACHINES.double, MACHINES.seven, MACHINES.product, one({ op: 'dsum' }, { op: 'add', k: 7 }), one({ op: 'mul', k: 3 }, { op: 'last2' }), one({ op: 'rev' }, { op: 'mul', k: 2 }, { op: 'last2' })];
  for (const machine of machines) {
    for (let n = 1; n <= 99; n++) {
      const cycle = cycleOf(machine, [n]);
      const brute = bruteCycle(machine, [n]);
      assert.deepEqual(cycle, { mu: brute.mu, lambda: brute.lambda }, `${JSON.stringify(machine.steps)} ${n}`);
      assert.deepEqual(runRow(machine, [n], 60), brute.cells.slice(0, 60));
    }
  }
  for (let a = 1; a <= 40; a++) {
    for (let b = 1; b <= 40; b++) {
      const brute = bruteCycle(PAIR, [a, b]);
      assert.deepEqual(cycleOf(PAIR, [a, b]), { mu: brute.mu, lambda: brute.lambda }, `${a}, ${b}`);
    }
  }
  // 뒤집고 1 더하기는 어디서 시작하든 2, 3, …, 10을 되풀이한다(칸 수 9). 자리 숫자를 같은 숫자끼리 곱해 더하기는 1이거나 8칸짜리 고리
  for (let n = 1; n <= 99; n++) assert.equal(cycleOf(MACHINES.revAdd, [n]).lambda, 9, String(n));
  for (let n = 1; n <= 999; n++) assert.ok([1, 8].includes(cycleOf(MACHINES.squares, [n]).lambda), String(n));
  // 두 수 기계는 늘 x, x, 0이 되풀이된다
  for (let a = 1; a <= 30; a++) for (let b = 1; b <= 30; b++) assert.equal(cycleOf(PAIR, [a, b]).lambda, 3);
  // 2를 곱하기만 하는 기계는 커지기만 해서 되풀이를 못 찾는다
  assert.equal(cycleOf(one({ op: 'mul', k: 2 }), [1]), null);
});

test('먼 칸: 75번째, 100번째, 300번째 칸이 그 칸까지 직접 돌린 줄과 같다', () => {
  for (const machine of [MACHINES.revAdd, MACHINES.squares, MACHINES.seven]) {
    for (let n = 10; n <= 99; n += 7) {
      const row = bruteRow(machine, [n], 300);
      for (const at of [1, 20, 50, 75, 100, 300]) assert.equal(cellAt(machine, [n], at), row[at - 1], `${n} ${at}`);
    }
  }
  for (const start of [[16, 9], [40, 7], [13, 5]]) {
    const row = bruteRow(PAIR, start, 300);
    for (const at of [1, 2, 50, 75, 100, 300]) assert.equal(cellAt(PAIR, start, at), row[at - 1]);
  }
  assert.equal(cellAt(MACHINES.revAdd, [57], 75), 5);
});

test('넣은 수 찾기: 1~99에서 나온 수가 되는 수를 하나씩 넣어 본 것과 같다', () => {
  for (const machine of [MACHINES.revAdd, MACHINES.squares, MACHINES.product, MACHINES.times3plus1]) {
    for (let target = 0; target <= 200; target++) {
      const brute = [];
      for (let n = 1; n <= 99; n++) if (machine.steps.reduce((value, step) => bruteStep(step, value), n) === target) brute.push(n);
      assert.deepEqual(preimagesOf(machine, target, 1, 99), brute);
    }
  }
  // 뒤집고 1 더하기: 끝이 0인 수(10 이상)에 1을 더한 수는 나오지 않는다(뒤집은 수는 0으로 끝나지 않는다)
  assert.deepEqual(preimagesOf(MACHINES.revAdd, 21), []);
  assert.deepEqual(preimagesOf(MACHINES.revAdd, 4), [3, 30]);
  assert.deepEqual(preimagesOf(MACHINES.squares, 50), [17, 55, 71]);
});

test('계속 작아지는 줄: 가장 긴 것과 그 처음 칸이 모든 처음 칸을 돌려 본 것과 같다', () => {
  const brute = (machine, limit) => {
    let best = 0;
    const starts = [];
    for (let a = 1; a <= limit; a++) {
      for (let b = 1; b <= (machine.kind === 'pair' ? limit : 1); b++) {
        const start = machine.kind === 'pair' ? [a, b] : [a];
        const length = bruteFalling(machine, start);
        if (length > best) starts.length = 0;
        if (length >= best) {
          best = length;
          starts.push(start);
        }
      }
    }
    return { best, starts };
  };
  for (const [machine, limit, best] of [
    [PAIR, 99, 10],
    [PAIR, 50, 8],
    [PAIR, 30, 7],
    [PAIR, 20, 6],
    [MACHINES.product, 999, 6],
    [MACHINES.product, 99, 5],
    [MACHINES.product, 30, 3],
  ]) {
    const found = fallingBest(machine, limit);
    assert.deepEqual(found, brute(machine, limit), `${machine.kind} ${limit}`);
    assert.equal(found.best, best, `${machine.kind} ${limit}`);
  }
  // 99까지에서 가장 긴 두 수의 줄은 89, 55 하나뿐(앞의 두 수를 더해 가는 수)
  assert.deepEqual(fallingBest(PAIR, 99).starts, [[89, 55]]);
  assert.deepEqual(fallingBest(MACHINES.product, 99).starts, [[77]]);
  assert.deepEqual(fallingBest(MACHINES.product, 999).starts.map(([n]) => n), [679, 688, 697, 769, 796, 868, 886, 967, 976]);
  assert.equal(fallingLength(PAIR, [55, 89]), 1);
});

test('원 위의 점: 조각의 수가 1, 2, 4, 8, 16, 31, 57이고, 세 가지 방법(자른 조각, 꼭짓점·변·면, 잘게 나눈 점)이 같다', () => {
  const expected = [1, 2, 4, 8, 16, 31, 57];
  for (let count = 1; count <= CIRCLE_MAX; count++) {
    const regions = circleRegions(count);
    assert.equal(regions.length, expected[count - 1], `점 ${count}개`);
    assert.equal(circleCountByLines(count), expected[count - 1]);
    const euler = eulerRegions(circlePoints(count));
    assert.equal(euler.regions, expected[count - 1]);
    // 세 선이 한 곳에서 만나지 않는다(엇갈린 곳이 서로 떨어져 있다)
    assert.equal(euler.crossings, count < 4 ? 0 : (count * (count - 1) * (count - 2) * (count - 3)) / 24);
    if (euler.crossings > 1) assert.ok(euler.closest > 0.005, `점 ${count}개: 엇갈린 곳 사이 ${euler.closest}`);
    if (count <= 6) assert.equal(sampledRegions(circlePoints(count)), expected[count - 1], `점 ${count}개(잘게 나눈 점)`);
    // 조각마다 key가 다르고, 넓이를 모두 더하면 원(둘레를 나눈 다각형)이 된다
    assert.equal(new Set(regions.map((region) => region.key)).size, regions.length);
    const total = regions.reduce((sum, region) => sum + region.area, 0);
    assert.ok(Math.abs(total - Math.PI) < 0.01, `넓이 ${total}`);
  }
  // 점의 자리는 원 둘레를 도는 차례로 적혀 있다
  for (const angles of Object.values(CIRCLE_ANGLES)) assert.deepEqual(angles, angles.slice().sort((a, b) => a - b));
  // 정육각형처럼 고르게 놓으면 세 대각선이 가운데서 만나 30개다(그래서 고르지 않게 놓았다)
  const hexagon = Array.from({ length: 6 }, (_, at) => [Math.cos((at * Math.PI) / 3), Math.sin((at * Math.PI) / 3)]);
  assert.ok(eulerRegions(hexagon).closest < 1e-6);
  // 누르는 판(점 4, 5, 6개)의 가장 작은 조각도 손가락으로 누를 만하다(원 넓이의 0.7% 넘게)
  for (const count of [4, 5, 6]) assert.ok(Math.min(...circleRegions(count).map((region) => region.area)) > 0.007 * Math.PI, `점 ${count}개`);
  // "왜 그럴까?"의 선: 점 여섯의 맞은편 선은 다른 선과 네 군데에서 엇갈린다
  assert.equal(crossingsOn(6, [0, 3]).length, 4);
});

test('차림표: 41을 더하면 0~39는 모두 약수가 둘뿐이고 40에서 처음 깨진다(41 × 41). 17은 16, 11은 10에서', () => {
  const prime = sieve(20000);
  for (const [add, at] of [[41, 40], [17, 16], [11, 10], [5, 4]]) {
    assert.equal(firstBreak(add), at, String(add));
    for (let n = 0; n < at; n++) assert.ok(prime[recipeOf(add, n)], `${add}: ${n}`);
    assert.ok(!prime[recipeOf(add, at)]);
    assert.deepEqual(factorPair(recipeOf(add, at)), [add, add]);
  }
  assert.equal(recipeOf(41, 40), 1681);
  assert.deepEqual(factorPair(recipeOf(41, 41)), [41, 43]);
  for (let m = 0; m <= 20000; m++) assert.equal(twoDivisors(m), prime[m], String(m));
});

test('판 검사와 풀이', () => {
  assert.equal(checkMachine(one({ op: 'add', k: 0 })), '블록의 수가 맞지 않아요');
  assert.equal(checkMachine(one({ op: 'mul', k: 10 })), '블록의 수가 맞지 않아요');
  assert.equal(checkMachine(one({ op: 'rev', k: 2 })), '블록의 수가 맞지 않아요');
  assert.equal(checkMachine(one()), '블록의 수가 맞지 않아요');
  assert.equal(checkMachine(one({ op: 'rev' }, { op: 'rev' }, { op: 'rev' }, { op: 'rev' })), '블록의 수가 맞지 않아요');
  assert.equal(checkMachine({ kind: 'pair' }), null);
  assert.notEqual(checkBoard({ kind: 'far', machine: MACHINES.revAdd, start: [13], target: 75, cap: 20 }), null, '되풀이가 스무 칸 안에 다 보이지 않는다');
  assert.equal(checkBoard({ kind: 'far', machine: MACHINES.revAdd, start: [57], target: 75, cap: 20 }), null);
  assert.notEqual(checkBoard({ kind: 'prime', add: 41, upTo: 39 }), null);
  assert.notEqual(checkBoard({ kind: 'circle', counts: [4, 6], guess: 7 }), null);
  assert.notEqual(checkBoard({ kind: 'box', machine: MACHINES.revAdd, shown: [3, 12], asks: [12], limit: 99 }), null);
  assert.deepEqual(solve({ kind: 'fill', machine: MACHINES.revAdd, start: [13], count: 4 }).cells, [13, 32, 24, 43, 35]);
  assert.deepEqual(solve({ kind: 'circle', counts: [4, 5], guess: 6 }).table, { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16, 6: 31 });
  assert.equal(solve({ kind: 'record', machine: PAIR, limit: 99 }).best, 10);
});

test('"왜 그럴까?"는 묶음(되풀이, 작아지는 줄, 깨지는 판)마다 그 묶음의 판을 끝까지 한 뒤에 열린다', () => {
  assert.equal(familyOf('fill'), 'repeat');
  assert.equal(familyOf('far'), 'repeat');
  assert.equal(familyOf('box'), 'repeat');
  assert.equal(familyOf('record'), 'record');
  assert.equal(familyOf('circle'), 'break');
  assert.equal(familyOf('prime'), 'break');
  const done = (mode, outcome = 'solved') => ({ kind: 'round', format: 'machine', mode, outcome });
  assert.equal(whyOpen([done('fill')], 'repeat'), true);
  assert.equal(whyOpen([done('fill')], 'break'), false);
  assert.equal(whyOpen([done('circle', 'left')], 'break'), false);
  assert.equal(whyOpen([done('prime', 'solution')], 'break'), true);
  assert.equal(whyOpen([{ ...done('fill'), format: 'lamps' }], 'repeat'), false);
});
