// 방 한 번씩 돌기의 풀이 프로그램을 확인한다.
// 가지치기 없이 모든 길을 걸어 보는 다른 방법(tests/helpers/brute-rooms.js)으로 작은 집의 모든 처음 방과 끝 방의 짝을 다시 풀어 견준다:
// 3×3, 3×4, 4×3, 4×4와 정원이 있는 집(시드 난수로 고른 정원 자리), 수가 적힌 집. 되는지, 길의 수, 찾은 길이 규칙에 맞는지를 본다.
// 안 되는 까닭(색, 문이 하나뿐인 방, 지나면 나뉘는 방, 나뉜 집)이 정말 그런지, 되는 집은 그 어느 것에도 걸리지 않는지(까닭이 틀린 말이 아닌지)도 본다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createRng, randInt } from '../src/core/rng.js';
import {
  alternates,
  canFinish,
  checkBoard,
  checkHouse,
  colorCheck,
  colorOf,
  countPaths,
  doorsOf,
  partsOf,
  pathDone,
  pathOk,
  pathStuck,
  roomsOf,
  shapeCheck,
  solve,
  solveHouse,
  wrongNumbers,
} from '../src/core/rooms.js';
import { bruteEnds, brutePaths, bruteValid } from './helpers/brute-rooms.js';

const house = (w, h, walls, start, end, numbers = []) => ({ kind: 'house', w, h, walls, start, end, numbers });

/** 정원이 walls인 w×h 집의 모든 처음 방과 끝 방의 짝을 두 방법으로 풀어 견준다. 짝마다 (집, 길의 수)를 돌려준다 */
function compareAll(w, h, walls, where) {
  const rooms = roomsOf({ w, h, walls });
  const seen = [];
  for (const start of rooms) {
    const ends = bruteEnds(w, h, walls, start);
    for (const end of rooms) {
      if (end === start) continue;
      const board = house(w, h, walls, start, end);
      const ways = ends.get(end) ?? 0;
      const solution = solveHouse(board);
      const at = `${where} ${start}→${end}`;
      assert.equal(solution.possible, ways > 0, at);
      assert.equal(countPaths(board), ways, at);
      if (solution.possible) assert.equal(bruteValid(board, solution.path), true, at);
      seen.push({ board, ways, solution });
    }
  }
  return seen;
}

/** 칸 하나를 뺀 집이 몇 덩어리인지(풀이 프로그램과 따로 센다) */
function piecesWithout(board, gone) {
  const open = new Set(roomsOf(board).filter((cell) => cell !== gone));
  const pieces = [];
  const left = new Set(open);
  while (left.size > 0) {
    const first = left.values().next().value;
    const stack = [first];
    const piece = new Set([first]);
    left.delete(first);
    while (stack.length > 0) {
      const at = stack.pop();
      for (const next of doorsOf(board, at)) {
        if (!left.has(next)) continue;
        left.delete(next);
        piece.add(next);
        stack.push(next);
      }
    }
    pieces.push(piece);
  }
  return pieces;
}

/** 까닭이 정말 그런지 따로 확인한다. 되는 집은 어느 까닭에도 걸리지 않아야 한다(걸리면 까닭이 틀린 말이다) */
function checkReason({ board, ways, solution }, at) {
  const color = colorCheck(board);
  // 색: 두 색의 방 수와 처음 방, 끝 방의 색을 직접 센다
  const counts = [0, 0];
  for (const cell of roomsOf(board)) counts[colorOf(board, cell)] += 1;
  const n = counts[0] + counts[1];
  const first = colorOf(board, board.start);
  const need = [Math.ceil(n / 2), Math.floor(n / 2)];
  const colorFine = counts[first] === need[0] && counts[1 - first] === need[1] && colorOf(board, board.end) === (n % 2 === 1 ? first : 1 - first);
  assert.equal(color.ok, colorFine, at);
  const shape = shapeCheck(board);
  if (ways > 0) {
    assert.equal(colorFine, true, `${at}: 되는 집인데 색이 맞지 않다고 해요`);
    assert.equal(shape, null, `${at}: 되는 집인데 생김새가 안 된다고 해요`);
    return;
  }
  const { reason, detail } = solution;
  if (reason === 'split') assert.ok(piecesWithout(board, -1).length > 1, at);
  else if (reason === 'color') assert.equal(colorFine, false, at);
  else {
    assert.equal(colorFine, true, `${at}: 색이 맞지 않으면 색이 까닭이에요`);
    if (reason === 'deadend') {
      for (const cell of detail.cells) {
        assert.ok(cell !== board.start && cell !== board.end, at);
        assert.ok(doorsOf(board, cell).length <= 1, at);
      }
    } else if (reason === 'cut') {
      const pieces = piecesWithout(board, detail.cell);
      assert.equal(pieces.length, detail.parts, at);
      if (detail.role === 'room') {
        const side = (cell) => pieces.findIndex((piece) => piece.has(cell));
        assert.ok(pieces.length >= 3 || side(board.start) === side(board.end), at);
      } else {
        assert.equal(detail.cell, detail.role === 'start' ? board.start : board.end, at);
        assert.ok(pieces.length >= 2, at);
      }
    } else {
      assert.equal(reason, 'search', at);
      assert.equal(shape, null, at);
    }
  }
}

test('정원 없는 3×3, 3×4, 4×3, 4×4, 3×5: 모든 처음 방과 끝 방의 짝이 모두 걸어 본 것과 같다(되는지, 길의 수, 찾은 길)', () => {
  const tally = {};
  for (const [w, h] of [[3, 3], [3, 4], [4, 3], [4, 4], [3, 5], [5, 3]]) {
    const all = compareAll(w, h, [], `${w}×${h}`);
    for (const item of all) checkReason(item, `${w}×${h} ${item.board.start}→${item.board.end}`);
    tally[`${w}x${h}`] = all.filter((item) => item.ways > 0).length / 2;
  }
  // 짝(처음과 끝을 바꾼 것은 하나로)의 수: 3×3은 36쌍 가운데 10쌍, 4×3은 66쌍 가운데 29쌍, 4×4는 120쌍 가운데 64쌍이 된다.
  assert.deepEqual(tally, { '3x3': 10, '3x4': 29, '4x3': 29, '4x4': 64, '3x5': 28, '5x3': 28 });
});

test('4×4와 3×3, 5×5에서는 색이 맞는 짝이 모두 되고, 4×3에서만 색이 맞는데도 안 되는 짝이 일곱 쌍 있다(모든 길을 따져야 안다)', () => {
  const colorOkButNo = (w, h) => {
    const list = [];
    for (let start = 0; start < w * h; start++) {
      for (let end = start + 1; end < w * h; end++) {
        const board = house(w, h, [], start, end);
        const solution = solveHouse(board);
        if (colorCheck(board).ok && !solution.possible) list.push([start, end, solution.reason]);
      }
    }
    return list;
  };
  assert.deepEqual(colorOkButNo(4, 4), []);
  assert.deepEqual(colorOkButNo(3, 3), []);
  assert.deepEqual(colorOkButNo(5, 5), []);
  assert.deepEqual(colorOkButNo(6, 6), []);
  const three = colorOkButNo(4, 3);
  assert.equal(three.length, 7);
  for (const [, , reason] of three) assert.equal(reason, 'search');
  // 4×4에서 맨 위 왼쪽과 맨 아래 오른쪽은 안 되고(같은 색), 이웃한 두 구석은 길이 8가지다.
  assert.equal(countPaths(house(4, 4, [], 0, 15)), 0);
  assert.equal(countPaths(house(4, 4, [], 0, 3)), 8);
  assert.equal(countPaths(house(4, 4, [], 0, 12)), 8);
  assert.equal(countPaths(house(5, 5, [], 0, 24)), 104);
});

test('모든 방을 지나는 길의 수(처음과 끝을 바꾼 것은 하나로): 3×3은 20, 4×4는 276, 5×5는 4324(알려진 값과 같다)', () => {
  const total = (w, h) => {
    let sum = 0;
    for (let start = 0; start < w * h; start++) for (let end = start + 1; end < w * h; end++) sum += countPaths(house(w, h, [], start, end));
    return sum;
  };
  assert.equal(total(3, 3), 20);
  assert.equal(total(4, 4), 276);
  assert.equal(total(5, 5), 4324);
  // 다른 방법으로도 3×3과 4×4를 센다(처음 방마다 모두 걸어 본 길의 끝을 센다)
  const brute = (w, h) => {
    let sum = 0;
    for (let start = 0; start < w * h; start++) for (const [end, ways] of bruteEnds(w, h, [], start)) if (end !== start) sum += ways;
    return sum / 2;
  };
  assert.equal(brute(3, 3), 20);
  assert.equal(brute(4, 4), 276);
});

test('정원이 있는 집: 시드 난수로 고른 정원 자리(3×3~4×4, 정원 1~4칸)마다 모든 짝이 걸어 본 것과 같고, 까닭이 맞다', () => {
  const rng = createRng(20261119);
  const reasons = {};
  let boards = 0;
  for (let round = 0; round < 60; round++) {
    const [w, h] = [[3, 3], [4, 3], [3, 4], [4, 4], [5, 3]][round % 5];
    const count = randInt(rng, 1, Math.min(4, w * h - 5));
    const walls = [];
    while (walls.length < count) {
      const cell = randInt(rng, 0, w * h - 1);
      if (!walls.includes(cell)) walls.push(cell);
    }
    walls.sort((a, b) => a - b);
    const all = compareAll(w, h, walls, `${w}×${h} 정원 ${walls.join(',')}`);
    for (const item of all) {
      checkReason(item, `${w}×${h} 정원 ${walls.join(',')} ${item.board.start}→${item.board.end}`);
      const key = item.ways > 0 ? 'possible' : item.solution.reason;
      reasons[key] = (reasons[key] ?? 0) + 1;
      boards += 1;
    }
  }
  assert.ok(boards > 3000, `${boards}`);
  // 까닭마다 여러 번 나온다(나뉜 집, 색, 문이 하나뿐인 방, 지나면 나뉘는 방)
  for (const key of ['possible', 'split', 'color', 'deadend', 'cut']) assert.ok((reasons[key] ?? 0) > 20, `${key}: ${JSON.stringify(reasons)}`);
});

test('수가 적힌 집: 적힌 차례를 지키는 길의 수가 모두 걸어 본 것과 같다', () => {
  const rng = createRng(7);
  for (let round = 0; round < 80; round++) {
    const [w, h] = [[4, 3], [4, 4], [3, 4]][round % 3];
    const start = randInt(rng, 0, w * h - 1);
    // 끝 방을 고른 뒤 그 끝까지의 길 하나에서 몇 방을 적는다
    const ends = [...bruteEnds(w, h, [], start).keys()];
    if (ends.length === 0) continue;
    const end = ends[randInt(rng, 0, ends.length - 1)];
    const paths = brutePaths(house(w, h, [], start, end));
    assert.ok(paths.length > 0);
    const path = paths[randInt(rng, 0, paths.length - 1)];
    const orders = [];
    for (let order = 2; order < path.length; order++) if (rng() < 0.2) orders.push(order);
    const board = house(w, h, [], start, end, [[start, 1], ...orders.map((order) => [path[order - 1], order]), [end, path.length]]);
    assert.equal(checkHouse(board), null);
    const ways = brutePaths(board).length;
    assert.ok(ways >= 1);
    assert.equal(countPaths(board), ways, `${w}×${h} ${JSON.stringify(board.numbers)}`);
    const solution = solveHouse(board);
    assert.equal(solution.possible, true);
    assert.equal(bruteValid(board, solution.path), true);
  }
  // 적힌 차례가 맞지 않는 집은 안 된다(모든 길을 따져서 안다)
  const wrong = house(4, 4, [], 0, 3, [[0, 1], [5, 2], [3, 16]]);
  assert.equal(brutePaths(wrong).length, 0);
  assert.equal(solveHouse(wrong).possible, false);
});

test('큰 집(5×5, 6×5, 6×6)도 빨리 푼다. 찾은 길은 규칙에 맞고, 안 되는 짝은 모두 색 때문이다', () => {
  for (const [w, h] of [[5, 5], [6, 5], [6, 6]]) {
    for (let start = 0; start < w * h; start += 3) {
      for (let end = 1; end < w * h; end += 4) {
        if (start === end) continue;
        const board = house(w, h, [], start, end);
        const solution = solveHouse(board);
        assert.notEqual(solution.possible, null);
        if (solution.possible) assert.equal(bruteValid(board, solution.path), true);
        else assert.equal(solution.reason, 'color');
        assert.ok(solution.steps < 5000, `${w}×${h} ${start}→${end}: ${solution.steps}`);
      }
    }
  }
});

test('까닭의 차례: 나뉜 집 → 색 → 문이 하나뿐인 방 → 지나면 나뉘는 방 → 모두 따져 봄', () => {
  // 정원 때문에 나뉜 집
  assert.equal(solveHouse(house(3, 3, [1, 4, 7], 0, 2)).reason, 'split');
  // 색: 같은 색(방 16개), 적은 쪽 색(방 9개), 수의 차이(정원 둘이 같은 색)
  assert.equal(solveHouse(house(4, 4, [], 0, 15)).detail.detail, 'same');
  assert.equal(solveHouse(house(3, 3, [], 1, 3)).detail.detail, 'minor');
  assert.equal(solveHouse(house(4, 4, [1, 3], 0, 2)).detail.detail, 'count');
  // 문이 하나뿐인 방(맨 위 왼쪽 방은 오른쪽이 정원이라 아래로만 문이 있다)
  const dead = solveHouse(house(4, 4, [1], 5, 15));
  assert.equal(dead.reason, 'deadend');
  assert.deepEqual(dead.detail.cells, [0]);
  // 그 방을 끝 방으로 하면 된다
  assert.equal(solveHouse(house(4, 4, [1], 5, 0)).possible, true);
  // 지나면 나뉘는 방: 1번 방을 빼면 위 오른쪽 두 방(2, 3)이 떨어져 나가는데, 처음 방과 끝 방이 모두 그쪽에 있다
  const cut = solveHouse(house(4, 4, [6, 7], 2, 3));
  assert.equal(cut.reason, 'cut');
  assert.deepEqual([cut.detail.cell, cut.detail.role, cut.detail.parts, cut.detail.same], [1, 'room', 2, true]);
  // 처음 방을 빼면 나뉘는 집, 끝 방을 빼면 나뉘는 집
  assert.equal(solveHouse(house(4, 4, [0, 11], 14, 15)).detail.role, 'start');
  assert.equal(solveHouse(house(4, 4, [0, 11], 15, 14)).detail.role, 'end');
  // 모두 따져 봐야 아는 집(4×3에서 색이 맞는데 안 되는 짝)
  assert.equal(solveHouse(house(4, 3, [], 1, 7)).reason, 'search');
});

test('길 검사: 규칙에 맞는 길, 다 된 길, 막힌 길, 적힌 차례와 다른 방, 이어서 끝까지 갈 수 있는가', () => {
  const board = house(4, 4, [], 0, 12);
  assert.equal(pathOk(board, [0, 1, 2]), true);
  assert.equal(pathOk(board, [1, 2]), false, '처음 방에서 시작한다');
  assert.equal(pathOk(board, [0, 2]), false, '옆방으로만 간다');
  assert.equal(pathOk(board, [0, 1, 0]), false, '같은 방을 두 번 지나지 않는다');
  const snake = [0, 1, 2, 3, 7, 6, 5, 4, 8, 9, 10, 11, 15, 14, 13, 12];
  assert.equal(pathDone(board, snake), true);
  assert.equal(pathDone(board, snake.slice(0, -1)), false);
  assert.equal(pathStuck(board, [0, 1, 5, 4]), false, '4번 방에서 8번 방으로 갈 수 있다');
  assert.equal(pathStuck(board, [0, 1, 2, 3, 7, 6, 5, 9, 8, 4]), true, '4번 방의 이웃(0, 5, 8)은 모두 지나왔다');
  assert.equal(pathStuck(board, [0, 4, 8, 12]), true, '끝 방에 왔는데 남은 방이 있다');
  assert.equal(canFinish(board, [0, 1, 2, 3]), true);
  assert.equal(canFinish(board, [0, 4, 5, 1]), true);
  assert.equal(canFinish(board, [0, 1, 2, 3, 7, 6, 5, 9, 8, 4]), false);
  assert.equal(canFinish(board, [0, 1, 2, 6, 5, 4, 8, 12]), false);
  const numbered = house(4, 4, [], 0, 12, [[0, 1], [5, 7], [12, 16]]);
  assert.deepEqual(wrongNumbers(numbered, [0, 1, 5]), [5]);
  assert.deepEqual(wrongNumbers(numbered, snake), []);
  assert.equal(pathDone(numbered, snake), true);
  assert.equal(alternates(board, snake), true);
});

test('어떤 길이든 한 칸 갈 때마다 색이 바뀐다: 홀수 번째 방은 처음 방의 색, 짝수 번째 방은 다른 색', () => {
  for (const [w, h] of [[4, 4], [5, 4], [5, 5]]) {
    for (let start = 0; start < w * h; start += 2) {
      const all = brutePaths(house(w, h, [], start, (start + 1) % (w * h)), 30);
      for (const path of all) assert.equal(alternates({ w, h, walls: [] }, path), true);
    }
  }
});

test('판의 규격: 크기, 정원, 처음 방과 끝 방, 적힌 차례. 가려 내기 판은 집 둘~넷', () => {
  assert.equal(checkBoard(house(4, 4, [], 0, 12)), null);
  assert.equal(checkBoard(house(2, 4, [], 0, 1)), 'size');
  assert.equal(checkBoard(house(7, 4, [], 0, 1)), 'size');
  assert.equal(checkBoard(house(4, 4, [0], 0, 12)), 'start');
  assert.equal(checkBoard(house(4, 4, [], 0, 0)), 'end');
  assert.equal(checkBoard(house(4, 4, [3, 3], 0, 12)), 'walls');
  assert.equal(checkBoard(house(4, 4, [], 0, 12, [[5, 1]])), 'numbers');
  assert.equal(checkBoard(house(4, 4, [], 0, 12, [[0, 1], [12, 16], [5, 3]])), null);
  assert.equal(checkHouse({ ...house(4, 4, [], null, null) }, { open: true }), null);
  assert.equal(checkBoard({ kind: 'judge', houses: [house(3, 3, [], 0, 8), house(3, 3, [], 0, 1)] }), null);
  assert.equal(checkBoard({ kind: 'judge', houses: [house(3, 3, [], 0, 8)] }), 'houses');
  assert.equal(checkBoard({ kind: 'other' }), 'kind');
  const judge = solve({ kind: 'judge', houses: [house(3, 3, [], 0, 8), house(3, 3, [], 0, 1), house(3, 3, [], 0, 2)] });
  assert.deepEqual(judge.impossible, [1]);
  assert.equal(judge.possible, false);
  // 나뉜 덩어리 세기
  assert.equal(partsOf({ w: 3, h: 3, walls: [1, 4, 7] }).length, 2);
});
