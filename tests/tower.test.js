// 탑 옮기기의 판과 풀이 프로그램: 옮기기의 규칙, 가장 적은 횟수, 가장 적게 옮기는 길이 하나뿐인지, 몇 번째에 어느 원판이 움직이는지를
// 다른 방법(tests/helpers/brute-tower.js: 기둥마다 쌓인 줄로 들고 처음 모습에서 앞으로 너비 우선 탐색, 가장 짧은 길의 가닥 수도 센다)으로 다시 따진다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { checkBoard, fewestFrom, fewestRows, fewestTable, isDone, isTower, moveOf, moveProblem, movedDiscs, onPath, pathFrom, replay, solve, stacksOf, standardBoard, topOf, worstOf } from '../src/core/tower.js';
import { allPositions, bruteReplay, bruteSolve, stacksFrom } from './helpers/brute-tower.js';

test('판의 규격: 원판 1~8개, 원판마다 기둥, 깃발 기둥, 몇 번째 판은 탑에서만 묻는다', () => {
  assert.equal(checkBoard(standardBoard(3, 2)), null);
  assert.equal(checkBoard({ n: 0, start: [], target: 2 }), 'size');
  assert.equal(checkBoard({ n: 9, start: new Array(9).fill(0), target: 2 }), 'size');
  assert.equal(checkBoard({ n: 2, start: [0], target: 2 }), 'start');
  assert.equal(checkBoard({ n: 2, start: [0, 3], target: 2 }), 'start');
  assert.equal(checkBoard({ n: 2, start: [0, 0], target: 5 }), 'target');
  assert.equal(checkBoard({ ...standardBoard(4, 2), ask: 15 }), null);
  assert.equal(checkBoard({ ...standardBoard(4, 2), ask: 16 }), 'ask');
  assert.equal(checkBoard({ n: 3, start: [0, 1, 0], target: 2, ask: 3 }), 'ask-start');
  assert.equal(isTower(standardBoard(3, 1)), true);
  assert.equal(isTower({ n: 3, start: [1, 1, 1], target: 2 }), true);
  assert.equal(isTower({ n: 3, start: [2, 2, 2], target: 2 }), false);
  assert.equal(isTower({ n: 3, start: [0, 1, 0], target: 2 }), false);
});

test('옮기기: 맨 위 원판만 옮기고, 큰 원판은 작은 원판 위에 놓을 수 없다(빈 기둥과 같은 기둥도 옮기지 않는다)', () => {
  const pos = [0, 1, 0]; // 왼쪽에 3번과 1번(1번이 위), 가운데에 2번
  assert.deepEqual(stacksOf(pos), [[3, 1], [2], []]);
  assert.equal(topOf(pos, 0), 1);
  assert.equal(topOf(pos, 2), 0);
  assert.equal(moveProblem(pos, 0, 1), null);
  assert.deepEqual(moveProblem(pos, 1, 0), { why: 'bigger', disc: 2, onto: 1 });
  assert.deepEqual(moveProblem(pos, 2, 0), { why: 'empty' });
  assert.deepEqual(moveProblem(pos, 0, 0), { why: 'same' });
  assert.deepEqual(moveOf(pos, 0, 2), [2, 1, 0]);
  assert.equal(moveOf(pos, 1, 0), null);
  // 모든 모습(원판 4개), 모든 옮기기: 다른 방법의 옮기기와 같다
  for (const start of allPositions(4)) {
    for (let from = 0; from < 3; from++) {
      for (let to = 0; to < 3; to++) {
        const mine = moveOf(start, from, to);
        const other = from === to ? null : bruteReplay(start, [[from, to]]);
        assert.deepEqual(mine === null ? null : stacksFrom(mine), other, `${start} ${from}→${to}`);
      }
    }
  }
  assert.deepEqual(replay(standardBoard(2, 2), [[0, 1], [0, 2], [1, 2]]), [2, 2]);
  assert.equal(replay(standardBoard(2, 2), [[0, 1], [0, 1]]), null);
  assert.deepEqual(movedDiscs(standardBoard(2, 2), [[0, 1], [0, 2], [1, 2]]), [1, 2, 1]);
  assert.ok(isDone([2, 2], 2));
});

test('가장 적은 횟수: 원판 1~8개의 탑은 1, 3, 7, 15, 31, 63, 127, 255번이다(다른 방법으로 앞으로 찾아도 같다)', () => {
  const rows = fewestRows([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(rows.map((row) => row.fewest), [1, 3, 7, 15, 31, 63, 127, 255]);
  for (const { n, fewest } of rows) {
    if (n <= 7) assert.equal(bruteSolve(new Array(n).fill(0), 2).fewest, fewest, `${n}개`);
    // 깃발 기둥이 가운데여도 같다
    assert.equal(fewestFrom(new Array(n).fill(0), 1), fewest);
  }
});

test('모든 모습(원판 1~5개, 깃발 기둥 셋)의 가장 적은 횟수가 다른 방법과 같고, 가장 적게 옮기는 길은 늘 하나뿐이다', () => {
  for (let n = 1; n <= 5; n++) {
    for (const target of [0, 1, 2]) {
      for (const pos of allPositions(n)) {
        const other = bruteSolve(pos, target);
        assert.equal(fewestFrom(pos, target), other.fewest, `${pos}→${target}`);
        assert.equal(other.ways, 1, `${pos}→${target}: 길 ${other.ways}가닥`);
        // 풀이 프로그램의 길은 다른 방법의 길과 같다(하나뿐이므로)
        assert.deepEqual(pathFrom(pos, target), other.path, `${pos}→${target}`);
      }
    }
  }
});

test('원판 n개의 모든 모습 가운데 가장 많이 옮겨야 하는 횟수는 탑과 같은 2를 n번 곱하고 1 뺀 수이고, 그런 모습이 2를 n번 곱한 만큼 있다', () => {
  for (let n = 1; n <= 6; n++) {
    const { worst, count } = worstOf(n, 2);
    assert.equal(worst, 2 ** n - 1);
    assert.equal(count, 2 ** n);
    if (n <= 5) {
      const values = allPositions(n).map((pos) => bruteSolve(pos, 2).fewest);
      assert.equal(Math.max(...values), worst);
      assert.equal(values.filter((value) => value === worst).length, count);
    }
  }
  // 표의 크기: 원판 8개는 3을 8번 곱한 6,561가지 모습
  assert.equal(fewestTable(8, 2).length, 6561);
});

test('몇 번째에 어느 원판: 탑을 가장 적게 옮길 때 움직이는 원판의 차례가 다른 방법의 길과 같다(1, 2, 1, 3, 1, 2, 1, 4, …)', () => {
  for (let n = 1; n <= 7; n++) {
    const board = standardBoard(n, 2);
    const result = solve(board);
    assert.equal(result.fewest, 2 ** n - 1);
    assert.deepEqual(result.discs, bruteSolve(board.start, 2).discs, `${n}개`);
    // 가장 큰 원판은 한가운데에서 한 번만 움직인다
    assert.deepEqual(result.discs.flatMap((disc, index) => (disc === n ? [index + 1] : [])), [2 ** (n - 1)]);
    // k번째에 움직이는 원판 = k를 2로 나누어떨어지는 만큼 나눈 횟수 + 1(README의 "풀이 프로그램이 알려 준 것")
    result.discs.forEach((disc, index) => {
      let k = index + 1;
      let halves = 0;
      while (k % 2 === 0) {
        k /= 2;
        halves += 1;
      }
      assert.equal(disc, halves + 1, `${n}개 ${index + 1}번째`);
    });
  }
  assert.deepEqual(solve(standardBoard(4, 2)).discs, [1, 2, 1, 3, 1, 2, 1, 4, 1, 2, 1, 3, 1, 2, 1]);
  const asked = solve({ ...standardBoard(5, 2), ask: 16 });
  assert.equal(asked.answer, 5);
  assert.equal(solve({ ...standardBoard(6, 2), ask: 40 }).answer, 4);
});

test('가장 적게 옮기는 길을 따라왔는가: 길과 같은 차례이면 참, 한 번이라도 다르면 거짓', () => {
  const board = standardBoard(3, 2);
  const { path } = solve(board);
  assert.equal(onPath(board, []), true);
  assert.equal(onPath(board, path.slice(0, 4)), true);
  assert.equal(onPath(board, [[0, 1]]), false);
  assert.equal(onPath(board, [...path, [2, 1]]), false);
});

test('흩어진 탑: 가장 큰 원판이 이미 깃발 기둥에 있으면 탑보다 훨씬 적게 옮긴다(원판 4개, 5번)', () => {
  const board = { n: 4, start: [0, 1, 0, 2], target: 2 };
  const result = solve(board);
  assert.equal(result.fewest, 5);
  assert.equal(bruteSolve(board.start, 2).fewest, 5);
  assert.deepEqual(result.discs, [1, 3, 1, 2, 1]);
  assert.ok(isDone(replay(board, result.path), 2));
});
