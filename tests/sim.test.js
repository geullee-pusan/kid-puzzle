// 세모 피하기의 규칙과 풀이 프로그램을 다른 방법(tests/helpers/brute-sim.js: 점 사이의 표, 세 점 훑기, 글자로 적어 두는 탐색과
// 가지치기 없이 모두 칠해 보기)으로 다시 따져 견준다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  FAIR_LEFT,
  bestMoves,
  checkBoard,
  colorsOf,
  dropPoint,
  emptyBoard,
  endsOf,
  finishedCount,
  lineCount,
  lineOf,
  lostStreak,
  marksOk,
  moveValues,
  movesOf,
  outcomeAt,
  paintState,
  paintings,
  pickMove,
  reasonOf,
  replay,
  safeLines,
  seatOutcome,
  slipsOf,
  smallBoards,
  solveGame,
  solvePaint,
  tableOf,
  teacherMove,
  trianglesIn,
  whyOpen,
} from '../src/core/sim.js';
import { createRng } from '../src/core/rng.js';
import { bruteOutcome, brutePaintCount, bruteValue, hasTriangle, tableFrom, triangleCount } from './helpers/brute-sim.js';

const pairsToLines = (n, pairs) => pairs.map(([a, b]) => lineOf(n, a, b)).sort((x, y) => x - y);

/** 판 위에서 둔 수들을 이어 붙여 놓은 판(그어 둔 선이 있는 게임 판) */
function boardAfter(n, trail, first) {
  const now = replay(emptyBoard('game', n), trail, first);
  const lines = (mask) => Array.from({ length: lineCount(n) }, (_, line) => line).filter((line) => (mask >> line) & 1);
  return { board: { kind: 'game', n, gone: [], red: lines(now.red), blue: lines(now.blue) }, next: now.next, over: now.over };
}

/** 시드 난수로 자기 세모를 피하며 아무렇게나 둔 수들 */
function randomTrail(n, first, steps, rng) {
  const trail = [];
  for (let step = 0; step < steps; step++) {
    const now = replay(emptyBoard('game', n), trail, first);
    if (now.over) break;
    const safe = safeLines(emptyBoard('game', n), now.red, now.blue, now.next);
    const list = safe.length > 0 ? safe : movesOf(emptyBoard('game', n), trail, first);
    trail.push(list[Math.floor(rng() * list.length)]);
    if (replay(emptyBoard('game', n), trail, first).over) {
      trail.pop();
      break;
    }
  }
  return trail;
}

test('점과 선: 점이 n개면 선은 n(n-1)/2개, 세모는 점 세 개를 고르는 가짓수만큼이다', () => {
  for (const [n, lines, triangles] of [[4, 6, 4], [5, 10, 10], [6, 15, 20]]) {
    assert.equal(lineCount(n), lines);
    assert.equal(tableOf(n).lines.length, lines);
    assert.equal(tableOf(n).triangles.length, triangles);
    for (let line = 0; line < lines; line++) {
      const [a, b] = endsOf(n, line);
      assert.ok(a < b);
      assert.equal(lineOf(n, a, b), line);
      assert.equal(lineOf(n, b, a), line);
    }
  }
  assert.equal(lineOf(5, 2, 2), -1);
  assert.equal(lineOf(5, 0, 5), -1);
  assert.deepEqual(trianglesIn(5, (1 << lineOf(5, 0, 1)) | (1 << lineOf(5, 0, 2)) | (1 << lineOf(5, 1, 2))), [[0, 1, 2]]);
});

test('판으로 쓸 수 있는 값: 점 넷~여섯, 선 목록은 작은 것부터 겹치지 않게, 처음부터 한 색 세모가 없고 그을 선이 남아 있다', () => {
  assert.equal(checkBoard(emptyBoard('game', 5)), null);
  assert.equal(checkBoard(emptyBoard('paint', 6)), null);
  assert.equal(checkBoard(emptyBoard('game', 3)), 'size');
  assert.equal(checkBoard(emptyBoard('game', 7)), 'size');
  assert.equal(checkBoard({ ...emptyBoard('game', 5), kind: 'other' }), 'kind');
  assert.equal(checkBoard({ ...emptyBoard('game', 5), red: [3, 1] }), 'lines');
  assert.equal(checkBoard({ ...emptyBoard('game', 5), red: [1], blue: [1] }), 'lines');
  assert.equal(checkBoard({ ...emptyBoard('game', 5), red: [10] }), 'lines');
  assert.equal(checkBoard({ ...emptyBoard('game', 5), gone: [1] }), 'gone');
  assert.equal(checkBoard({ ...emptyBoard('paint', 5), gone: [1] }), null);
  assert.equal(checkBoard({ ...emptyBoard('game', 5), red: pairsToLines(5, [[0, 1], [0, 2], [1, 2]]) }), 'triangle');
  const pentagon = pairsToLines(5, [[0, 1], [1, 2], [2, 3], [3, 4], [0, 4]]);
  const star = pairsToLines(5, [[0, 2], [0, 3], [1, 3], [1, 4], [2, 4]]);
  assert.equal(checkBoard({ ...emptyBoard('game', 5), red: pentagon, blue: star }), 'full');
  assert.equal(checkBoard(null), 'board');
});

test('두기: 번갈아 긋고, 자기 세모를 만든 쪽이 지고, 세모 없이 다 그으면 비긴다. 둘 수 없는 수는 거기서 멈춘다', () => {
  const board = emptyBoard('game', 5);
  const l = (a, b) => lineOf(5, a, b);
  // 빨강이 0-1, 0-2를 긋고 마지막에 1-2를 그으면 빨간 세모(0, 1, 2)로 진다.
  const trail = [l(0, 1), l(3, 4), l(0, 2), l(2, 4), l(1, 2)];
  const now = replay(board, trail, 'red');
  assert.equal(now.ok, true);
  assert.equal(now.over, true);
  assert.equal(now.loser, 'red');
  assert.equal(now.winner, 'blue');
  assert.deepEqual(now.triangle, [0, 1, 2]);
  assert.deepEqual(now.placed.map((item) => item.color), ['red', 'blue', 'red', 'blue', 'red']);
  // 끝난 뒤의 수, 이미 그은 선, 판 밖의 선은 둘 수 없다.
  assert.equal(replay(board, [...trail, l(1, 3)], 'red').ok, false);
  assert.equal(replay(board, [l(0, 1), l(0, 1)], 'red').ok, false);
  assert.equal(replay(board, [99], 'red').ok, false);
  // 판 가운데에서 엇갈리는 두 선(0-2와 1-3)은 세모를 만들지 않는다.
  assert.equal(replay(board, [l(0, 2), l(3, 4), l(1, 3)], 'red').over, false);
  // 다섯 점: 빨강은 둘레 다섯 선, 파랑은 안쪽 다섯 선이면 세모 없이 다 그어 비긴다.
  const pentagon = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 4]].map(([a, b]) => l(a, b));
  const star = [[0, 2], [0, 3], [1, 3], [1, 4], [2, 4]].map(([a, b]) => l(a, b));
  const full = pentagon.flatMap((line, index) => [line, star[index]]);
  const drawn = replay(board, full, 'red');
  assert.equal(drawn.over, true);
  assert.equal(drawn.draw, true);
  assert.equal(drawn.winner, null);
  assert.equal(drawn.left, 0);
  // 그을 선이 자기 세모를 만드는 선뿐이어도 그어야 한다(지나가기는 없다).
  assert.ok(movesOf(board, [], 'red').length === 10);
});

test('풀이 프로그램: 빈 판에서 둘 다 잘 두면 넷과 다섯은 비기고, 여섯은 나중에 긋는 쪽이 이긴다(다른 방법으로 다시 따진다)', () => {
  const facts = { 4: 'draw', 5: 'draw' };
  for (const n of [4, 5, 6]) {
    const solved = solveGame(emptyBoard('game', n));
    const brute = bruteOutcome(emptyBoard('game', n), 'red', new Map());
    assert.equal(solved.red, brute, `${n}점`);
    // 빈 판은 빨강과 파랑이 맞바꾸어도 같은 판이라, 다른 방법으로는 넷과 다섯만 파랑이 먼저일 때도 따진다(여섯은 무거워서 한 번만).
    if (n < 6) assert.equal(solveGame(emptyBoard('game', n)).blue, bruteOutcome(emptyBoard('game', n), 'blue', new Map()), `${n}점`);
    else assert.equal(solved.blue, 'red');
    if (n < 6) assert.equal(solved.red, facts[n]);
  }
  assert.deepEqual(solveGame(emptyBoard('game', 6)), { possible: true, red: 'blue', blue: 'red', positions: solveGame(emptyBoard('game', 6)).positions });
  // 여섯 점의 첫 수 열다섯은 모두 지는 수다(모두 같은 꼴이다).
  assert.deepEqual(moveValues(emptyBoard('game', 6), [], 'red').map((item) => item.value), Array(15).fill(-1));
  // 처음 자리를 따지는 데 적어 둔 자리는 20만 개 안쪽이다.
  assert.ok(solveGame(emptyBoard('game', 6)).positions < 200000, String(solveGame(emptyBoard('game', 6)).positions));
  assert.equal(seatOutcome(solveGame(emptyBoard('game', 6)), 'second'), 'win');
  assert.equal(seatOutcome(solveGame(emptyBoard('game', 6)), 'first'), 'lose');
  assert.equal(seatOutcome(solveGame(emptyBoard('game', 5)), 'first'), 'draw');
});

test('풀이 프로그램: 넷과 다섯 점의 모든 자리, 여섯 점의 둔 수가 여섯 이상인 자리 150개에서 다른 방법과 같다', () => {
  // 넷: 처음부터 갈 수 있는 모든 자리
  const seen = new Set();
  const walk = (trail, first) => {
    const key = `${first}:${trail.join('.')}`;
    if (seen.has(key)) return;
    seen.add(key);
    const { board, next, over } = boardAfter(4, trail, first);
    if (!over) assert.equal(outcomeAt(emptyBoard('game', 4), trail, first), bruteOutcome(board, next), key);
    for (const line of movesOf(emptyBoard('game', 4), trail, first)) walk([...trail, line], first);
  };
  walk([], 'red');
  assert.ok(seen.size > 1000);
  // 다섯: 시드 난수로 고른 자리 300개와 그 자리의 수마다의 값
  const rng = createRng(7);
  const memo = new Map();
  for (let index = 0; index < 300; index++) {
    const first = index % 2 === 0 ? 'red' : 'blue';
    const trail = randomTrail(5, first, Math.floor(rng() * 9), rng);
    const { board, next } = boardAfter(5, trail, first);
    assert.equal(outcomeAt(emptyBoard('game', 5), trail, first), bruteOutcome(board, next, memo));
    const colors = tableFrom(board);
    const mover = next === 'red' ? 1 : 2;
    for (const { line, value } of moveValues(emptyBoard('game', 5), trail, first)) {
      const [a, b] = endsOf(5, line);
      colors[a][b] = mover;
      colors[b][a] = mover;
      const brute = hasTriangle(colors, mover) ? -1 : -bruteValue(colors, 3 - mover, memo);
      colors[a][b] = 0;
      colors[b][a] = 0;
      assert.equal(value, brute);
    }
  }
  // 여섯: 둔 수가 여섯 이상인 자리(적어 두지 않는 탐색으로도 빨리 끝난다)
  for (let index = 0; index < 150; index++) {
    const first = index % 2 === 0 ? 'red' : 'blue';
    const trail = randomTrail(6, first, 6 + Math.floor(rng() * 6), rng);
    if (trail.length < 6) continue;
    const { board, next } = boardAfter(6, trail, first);
    assert.equal(outcomeAt(emptyBoard('game', 6), trail, first), bruteOutcome(board, next));
  }
});

test('그어 둔 선이 있는 판(직접 만든 판)도 다른 방법과 같다', () => {
  const rng = createRng(11);
  for (let index = 0; index < 36; index++) {
    const n = 4 + (index % 3);
    const trail = randomTrail(n, 'red', 2 + Math.floor(rng() * 6), rng);
    const { board } = boardAfter(n, trail, 'red');
    if (checkBoard(board) !== null) continue;
    const solved = solveGame(board);
    assert.equal(solved.red, bruteOutcome(board, 'red', new Map()), JSON.stringify(board));
    assert.equal(solved.blue, bruteOutcome(board, 'blue', new Map()), JSON.stringify(board));
  }
});

/** 다섯 점에서 그어 둔 선 넷 이하로 빨강이 먼저 그으면 빨강이 이기는 판을 찾는다(풀이 프로그램으로 찾고 다른 방법으로 다시 따진다) */
function findFirstWins() {
  for (let mask = 0; mask < 3 ** 10; mask++) {
    const red = [];
    const blue = [];
    let rest = mask;
    for (let line = 0; line < 10; line++) {
      const digit = rest % 3;
      rest = Math.floor(rest / 3);
      if (digit === 1) red.push(line);
      if (digit === 2) blue.push(line);
    }
    if (red.length + blue.length > 4) continue;
    const board = { kind: 'game', n: 5, gone: [], red, blue };
    if (checkBoard(board) !== null || outcomeAt(board, [], 'red') !== 'red') continue;
    return bruteOutcome(board, 'red', new Map()) === 'red' ? board : null;
  }
  return null;
}

test('직접 만들기의 물음: 다섯 점에서 먼저 긋는 쪽이 이기는 판이 있다', () => {
  const board = findFirstWins();
  assert.ok(board);
  assert.equal(solveGame(board).red, 'red');
});

test('선생님이 두는 법: best는 이길 수 있으면 이기는 수, 아니면 비기는 수를 둔다. easy는 자기 세모가 바로 생기는 수를 피한다', () => {
  const rng = createRng(3);
  for (let index = 0; index < 120; index++) {
    const n = index % 2 === 0 ? 5 : 6;
    const first = index % 3 === 0 ? 'blue' : 'red';
    const trail = randomTrail(n, first, 4 + Math.floor(rng() * 8), rng);
    const board = emptyBoard('game', n);
    const now = replay(board, trail, first);
    if (now.over) continue;
    const values = moveValues(board, trail, first);
    const top = Math.max(...values.map((item) => item.value));
    const best = pickMove(board, trail, first, createRng(index), 'best');
    const value = values.find((item) => item.line === best).value;
    if (top > -1) assert.equal(value, top, '잘 두면 가장 좋은 끝으로 가는 수');
    else {
      // 질 자리: 자기 세모가 바로 생기지 않는 수가 있으면 그 가운데서 고른다.
      const safe = safeLines(board, now.red, now.blue, now.next);
      if (safe.length > 0) assert.ok(safe.includes(best));
    }
    assert.deepEqual(bestMoves(board, trail, first).sort(), values.filter((item) => item.value === top).map((item) => item.line).sort());
    const easy = pickMove(board, trail, first, createRng(index), 'easy');
    const safe = safeLines(board, now.red, now.blue, now.next);
    if (safe.length > 0) assert.ok(safe.includes(easy));
    // fair는 남은 선이 FAIR_LEFT개보다 많으면 easy와 같고, 그 이하면 best와 같다.
    const fair = pickMove(board, trail, first, createRng(index), 'fair');
    assert.equal(fair, now.left > FAIR_LEFT ? easy : best);
  }
  // 같은 판, 같은 수들이면 늘 같은 수를 둔다.
  const options = { level: 3, seed: 4, first: 'red', teacher: 'fair' };
  assert.equal(teacherMove(emptyBoard('game', 6), [0], options), teacherMove(emptyBoard('game', 6), [0], options));
  assert.equal(teacherMove(emptyBoard('game', 6), [], { ...options, first: 'blue' }) !== null, true);
});

test('잘 두는 선생님(best)은 다섯 점에서 지지 않고, 여섯 점에서 먼저 긋는 아이에게 지지 않는다(아이의 모든 수를 따진다)', () => {
  // 아이가 어떤 수를 두든, 선생님이 앱에서 두는 대로(시드 난수까지 그대로) 두면 아이가 이기는 끝은 없다.
  const check = (n, first, trail, depthLimit) => {
    const board = emptyBoard('game', n);
    const now = replay(board, trail, first);
    if (now.over) {
      assert.notEqual(now.winner, 'red', `${n}점 ${trail.join('.')}`);
      return;
    }
    if (now.next === 'blue') {
      check(n, first, [...trail, teacherMove(board, trail, { level: 4, seed: 1, first, teacher: 'best' })], depthLimit);
      return;
    }
    // 아이 차례: 지금 자리가 아이가 이기는 자리가 아님을 확인하고, 깊이가 남으면 모든 수를 따라간다.
    assert.notEqual(outcomeAt(board, trail, first), 'red');
    if (trail.length >= depthLimit) return;
    for (const line of movesOf(board, trail, first)) check(n, first, [...trail, line], depthLimit);
  };
  check(5, 'red', [], 10);
  check(6, 'red', [], 4);
});

test('아이가 잘 두면 갈 수 있던 끝보다 나쁜 자리로 보낸 수를 찾는다', () => {
  const board = emptyBoard('game', 5);
  const l = (a, b) => lineOf(5, a, b);
  // 빨강이 0-1, 0-2를 그은 뒤 1-2를 그으면 바로 진다(그 앞까지는 비기는 자리였다).
  const trail = [l(0, 1), l(3, 4), l(0, 2), l(2, 4), l(1, 2)];
  const slips = slipsOf(board, trail, 'red');
  assert.ok(slips.includes(5));
  for (const turn of slips) assert.equal(turn % 2, 1, '아이(빨강, 먼저)의 수만');
  assert.deepEqual(slipsOf(board, [], 'red'), []);
});

test('칠하기: 넷은 18가지, 다섯은 12가지, 여섯은 0가지, 선 하나가 없는 여섯은 12가지(가지치기 없이 모두 칠해 본 수와 같다)', () => {
  const six = emptyBoard('paint', 6);
  const facts = [
    [emptyBoard('paint', 4), 18],
    [emptyBoard('paint', 5), 12],
    [six, 0],
    [{ ...six, gone: [lineOf(6, 0, 1)] }, 12],
    [{ ...six, gone: [lineOf(6, 0, 3)] }, 12],
  ];
  for (const [board, count] of facts) {
    assert.equal(solvePaint(board).count, count, JSON.stringify(board));
    assert.equal(brutePaintCount(board), count, JSON.stringify(board));
    assert.equal(solvePaint(board).possible, count > 0);
    assert.equal(paintings(board, 100).length, count);
  }
  // 다섯 점의 세모 없는 칠하기는 모두 한 점마다 빨강 둘, 파랑 둘이다(둘레와 안쪽의 두 다섯 모서리 고리).
  for (const colors of paintings(emptyBoard('paint', 5))) {
    for (let point = 0; point < 5; point++) {
      const lines = [0, 1, 2, 3, 4].filter((other) => other !== point).map((other) => colors[lineOf(5, point, other)]);
      assert.deepEqual(lines.slice().sort(), [1, 1, 2, 2]);
    }
  }
  // 여섯 점을 두 색으로 다 칠하면 한 색 세모가 늘 둘 이상이다(32,768가지를 모두 칠해 본다).
  let least = Infinity;
  const pairs = tableOf(6).lines;
  for (let mask = 0; mask < 1 << 15; mask++) {
    const colors = Array.from({ length: 6 }, () => Array(6).fill(0));
    pairs.forEach(([a, b], line) => {
      colors[a][b] = (mask >> line) & 1 ? 1 : 2;
      colors[b][a] = colors[a][b];
    });
    least = Math.min(least, triangleCount(colors));
  }
  assert.equal(least, 2);
});

test('안 되는 까닭(아이가 볼 수 있는 것): 한 점에서 같은 색 선 셋, 또는 한 점에서 나가는 선 다섯. 까닭이 있으면 늘 안 되는 판이다', () => {
  assert.equal(reasonOf(emptyBoard('paint', 6)).kind, 'many');
  assert.equal(reasonOf(emptyBoard('paint', 5)), null);
  assert.equal(reasonOf({ ...emptyBoard('paint', 6), gone: [lineOf(6, 0, 1)] }), null);
  const given = { ...emptyBoard('paint', 5), red: pairsToLines(5, [[0, 1], [0, 2], [0, 3]]) };
  assert.deepEqual(reasonOf(given), { kind: 'given', point: 0, ends: [1, 2, 3], color: 'red' });
  assert.equal(solvePaint(given).possible, false);
  assert.equal(brutePaintCount(given), 0);
  // 세 점 사이의 선이 하나 없으면 까닭이 아니다.
  const broken = { ...emptyBoard('paint', 6), gone: [lineOf(6, 1, 2)], red: pairsToLines(6, [[0, 1], [0, 2], [0, 3]]) };
  assert.notEqual(reasonOf(broken)?.kind, 'given');
  // 다섯 점과 넷 점에서 처음부터 칠해 둔 선이 넷 이하인 판을 모두 따진다: 까닭이 있으면 안 되는 판이다.
  for (const n of [4, 5]) {
    const count = lineCount(n);
    for (let mask = 0; mask < 3 ** count; mask++) {
      const red = [];
      const blue = [];
      let rest = mask;
      for (let line = 0; line < count; line++) {
        const digit = rest % 3;
        rest = Math.floor(rest / 3);
        if (digit === 1) red.push(line);
        if (digit === 2) blue.push(line);
      }
      if (red.length + blue.length > 4) continue;
      const board = { kind: 'paint', n, gone: [], red, blue };
      if (checkBoard(board) !== null) continue;
      const brute = brutePaintCount(board);
      assert.equal(solvePaint(board).count, brute);
      if (reasonOf(board)) assert.equal(brute, 0, JSON.stringify(board));
    }
  }
});

test('칠한 모습: 처음부터 칠해 둔 선과 아이가 칠한 선을 합치고, 한 색 세모와 남은 선을 센다', () => {
  const board = { ...emptyBoard('paint', 5), red: [lineOf(5, 0, 1)] };
  const marks = Array(10).fill(0);
  marks[lineOf(5, 0, 2)] = 1;
  marks[lineOf(5, 1, 2)] = 1;
  const state = paintState(board, marks);
  assert.deepEqual(state.triangles, [{ points: [0, 1, 2], color: 'red' }]);
  assert.equal(state.left, 7);
  assert.equal(state.painted, 2);
  assert.equal(state.done, false);
  assert.equal(colorsOf(board, marks)[lineOf(5, 0, 1)], 1);
  assert.equal(marksOk(board, marks), true);
  const bad = marks.slice();
  bad[lineOf(5, 0, 1)] = 2;
  assert.equal(marksOk(board, bad), false, '처음부터 칠해 둔 선에는 칠하지 않는다');
  assert.equal(marksOk(board, [1, 2]), false);
  // 세모 없이 다 칠하면 끝난다.
  const example = solvePaint(emptyBoard('paint', 5)).example;
  assert.equal(paintState(emptyBoard('paint', 5), example).done, true);
});

test('작은 판: 점 하나를 뺀 판. 게임은 점이 하나, 둘 적은 판(넷까지), 칠하기는 되는 판과 까닭이 있는 안 되는 판으로 나눈다', () => {
  const dropped = dropPoint({ ...emptyBoard('paint', 5), red: pairsToLines(5, [[0, 1], [3, 4]]), blue: pairsToLines(5, [[1, 4]]) }, 2);
  assert.deepEqual(dropped, { kind: 'paint', n: 4, gone: [], red: pairsToLines(4, [[0, 1], [2, 3]]), blue: pairsToLines(4, [[1, 3]]) });
  assert.deepEqual(smallBoards(emptyBoard('game', 6)).yes.map((board) => board.n), [5, 4]);
  assert.deepEqual(smallBoards(emptyBoard('game', 4)), { yes: [], no: [] });
  assert.deepEqual(smallBoards(emptyBoard('paint', 6)), { yes: [emptyBoard('paint', 5)], no: [] });
  const closed = { ...emptyBoard('paint', 5), red: pairsToLines(5, [[0, 1], [0, 2], [0, 3]]) };
  const { yes, no } = smallBoards(closed);
  assert.ok(no.length >= 1 && yes.length >= 1);
  for (const board of no) assert.ok(reasonOf(board), JSON.stringify(board));
  for (const board of yes) assert.ok(brutePaintCount(board) > 0);
});

test('지난 기록: "왜 그럴까?"는 점이 여섯인 판을 한 번 끝까지 한 뒤에 열린다. 연달아 진 게임을 센다', () => {
  const record = (more) => ({ kind: 'round', format: 'sim', id: `r${Math.random()}`, side: false, outcome: 'solved', board: emptyBoard('game', 5), winner: 'kid', ...more });
  assert.equal(whyOpen([]), false);
  assert.equal(whyOpen([record({})]), false);
  assert.equal(whyOpen([record({ board: emptyBoard('game', 6) })]), true);
  assert.equal(whyOpen([record({ board: emptyBoard('paint', 6), winner: undefined })]), true);
  assert.equal(whyOpen([record({ board: emptyBoard('game', 6), side: true })]), false);
  assert.equal(whyOpen([record({ board: emptyBoard('game', 6), outcome: 'left' })]), false);
  assert.equal(finishedCount([record({}), record({ winner: 'draw' }), record({ winner: undefined })]), 2);
  assert.equal(lostStreak([record({}), record({ winner: 'teacher' }), record({ winner: 'teacher' })]), 2);
  assert.equal(lostStreak([record({ winner: 'teacher' }), record({ winner: 'draw' })]), 0);
});
