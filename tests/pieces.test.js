// 조각 가짓수 찾기의 풀이 점검: 한 칸씩 붙여 가며 세는 풀이 프로그램을 다른 방법(네모 안의 칸 묶음을 모두 골라 보고 글자 판을 돌려 이름 매기기)과 견준다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ANGLES,
  GROUPS,
  MAX_SIZE,
  MAX_TOTAL,
  RULES,
  TURNS,
  checkBoard,
  checkPiece,
  compareWith,
  connected,
  gridOf,
  grownShapes,
  howOf,
  isFlip,
  keyOf,
  longestRow,
  matchTurn,
  normalize,
  piecesOf,
  removableCells,
  representative,
  rowCells,
  rowCounts,
  shapeKey,
  smallBoards,
  solve,
  targetsOf,
  transform,
} from '../src/core/pieces.js';
import { bruteFixed, bruteHow, bruteShapes, linked, longestRun, nameOf } from './helpers/brute-pieces.js';

const COUNTS = { free: [1, 1, 2, 5, 12, 35], turn: [1, 1, 2, 7, 18, 60], fixed: [1, 2, 6, 19, 63, 216] };

test('가짓수: 돌리고 뒤집어 같은 것 1, 1, 2, 5, 12, 35, 돌려야 같은 것 1, 1, 2, 7, 18, 60, 옮겨야 같은 것 1, 2, 6, 19, 63, 216가지다(모두 골라 본 것과 같다)', () => {
  for (const rule of RULES) {
    for (let n = 1; n <= 6; n++) {
      const pieces = piecesOf(n, rule);
      const brute = bruteShapes(n, rule);
      assert.equal(pieces.length, COUNTS[rule][n - 1], `${rule} ${n}`);
      assert.equal(brute.size, COUNTS[rule][n - 1], `${rule} ${n} 다른 방법`);
      // 두 방법의 조각이 서로 같다(이름을 매기는 방법도 다르다)
      assert.deepEqual(new Set(pieces.map((cells) => nameOf(cells, rule))), new Set(brute.keys()), `${rule} ${n}`);
      for (const cells of pieces) {
        assert.equal(cells.length, n);
        assert.ok(connected(cells) && linked(cells));
        assert.deepEqual(representative(cells, rule), cells, '대표 모습으로 둔다');
      }
    }
  }
  // 옮겨서 같은 것만 하나로 친 것은 네모 안의 이어진 묶음의 수와 같다
  for (let n = 1; n <= 6; n++) assert.equal(bruteFixed(n).length, COUNTS.fixed[n - 1]);
});

test('이름: 같다고 치는 움직임으로는 이름이 그대로이고, 이름이 같으면 다른 방법으로도 같은 조각이다', () => {
  for (const n of [4, 5]) {
    const fixed = bruteFixed(n);
    for (const rule of RULES) {
      for (const cells of fixed) {
        for (let index = 0; index < 8; index++) {
          const moved = transform(cells, index);
          assert.equal(keyOf(moved, rule) === keyOf(cells, rule), nameOf(moved, rule) === nameOf(cells, rule), `${rule} ${shapeKey(cells)} ${index}`);
          if (GROUPS[rule].includes(index)) assert.equal(keyOf(moved, rule), keyOf(cells, rule));
        }
      }
      // 옮겨도 이름은 그대로다
      for (const cells of fixed.slice(0, 10)) assert.equal(keyOf(cells.map(([x, y]) => [x + 3, y - 2]), rule), keyOf(cells, rule));
    }
  }
});

test('움직임 여덟: 화면에서 돌려 보이는 각도와 뒤집기가 좌표의 움직임과 같다(세로가 아래로 는다)', () => {
  // CSS의 rotate(a)는 (x, y) → (x cos a − y sin a, x sin a + y cos a), scaleX(−1)은 (x, y) → (−x, y). 뒤집기를 먼저 한다
  const css = (index, [x, y]) => {
    const fx = isFlip(index) ? -x : x;
    const rad = (ANGLES[index] * Math.PI) / 180;
    return [Math.round(fx * Math.cos(rad) - y * Math.sin(rad)), Math.round(fx * Math.sin(rad) + y * Math.cos(rad))];
  };
  for (let index = 0; index < 8; index++) {
    for (const point of [
      [1, 0],
      [0, 1],
      [2, 3],
      [-1, 2],
    ]) {
      assert.deepEqual(TURNS[index](point).map((value) => value + 0), css(index, point).map((value) => value + 0), `${index}`);
    }
  }
  assert.deepEqual(GROUPS.turn, [0, 1, 2, 3]);
  assert.deepEqual(GROUPS.fixed, [0]);
  assert.deepEqual([0, 1, 2, 3, 4].map(howOf), ['same', 'turn', 'turn', 'turn', 'flip']);
});

test('견주기: 새 조각이 찾은 조각과 같은지, 어떻게 겹치는지(옮기기, 돌리기, 뒤집기)가 글자 판으로 따진 것과 같다', () => {
  for (const n of [3, 4]) {
    const fixed = bruteFixed(n);
    for (const a of fixed) {
      for (const b of fixed) {
        const how = bruteHow(a, b);
        const turn = matchTurn(a, b);
        assert.equal(turn >= 0 ? howOf(turn) : null, how, `${shapeKey(a)} → ${shapeKey(b)}`);
        if (turn >= 0) assert.equal(shapeKey(a.map(TURNS[turn])), shapeKey(b), '고른 움직임으로 정말 겹친다');
        for (const rule of RULES) {
          const result = compareWith(a, [b], rule);
          const same = nameOf(a, rule) === nameOf(b, rule);
          if (same) {
            assert.ok(result && result.counted, `${rule}: 같은 조각`);
          } else if (how) {
            // 이 약속으로는 다른 조각이지만 돌리거나 뒤집으면 겹친다
            assert.ok(result && !result.counted, `${rule}: 겹치지만 다른 조각`);
          } else assert.equal(result, null);
          if (result) assert.equal(shapeKey(a.map(TURNS[result.turn])), shapeKey(b));
        }
      }
    }
  }
  // 겹치는 움직임은 쉬운 것부터: 옮기기만 → 돌리기 → 뒤집기
  const ell = [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 2],
  ];
  assert.equal(compareWith(ell.map(([x, y]) => [x + 2, y + 1]), [ell]).how, 'same');
  assert.equal(compareWith(transform(ell, 1), [ell]).how, 'turn');
  assert.equal(compareWith(transform(ell, 4), [ell]).how, 'flip');
  assert.deepEqual(compareWith(transform(ell, 4), [ell], 'turn'), { at: 0, turn: 4, how: 'flip', counted: false });
  assert.equal(compareWith(transform(ell, 1), [ell], 'fixed').counted, false);
  // 찾은 조각이 여럿이면 같은 조각의 차례를 알려 준다
  assert.equal(compareWith(ell, [[[0, 0], [1, 0], [2, 0], [3, 0]], transform(ell, 2)]).at, 1);
});

test('가장 긴 줄: 글자 판의 줄에서 센 것과 같다. 다섯 칸은 줄 2·3·4·5칸이 1·8·2·1가지, 여섯 칸은 1·17·13·3·1가지다', () => {
  for (let n = 1; n <= 6; n++) for (const cells of bruteFixed(n)) assert.equal(longestRow(cells), longestRun(cells), shapeKey(cells));
  assert.deepEqual(rowCounts(4), { 2: 2, 3: 2, 4: 1 });
  assert.deepEqual(rowCounts(5), { 2: 1, 3: 8, 4: 2, 5: 1 });
  assert.deepEqual(rowCounts(6), { 2: 1, 3: 17, 4: 13, 5: 3, 6: 1 });
  assert.deepEqual(rowCounts(4, 'turn'), { 2: 3, 3: 3, 4: 1 });
  // 가장 긴 줄의 칸들은 곧게 이어지고 조각 안에 있다
  for (const cells of piecesOf(6)) {
    const line = rowCells(cells);
    assert.equal(line.length, longestRow(cells));
    const keys = new Set(normalize(cells).map(([x, y]) => `${x},${y}`));
    for (const [x, y] of line) assert.ok(keys.has(`${x},${y}`));
    const across = line.every(([, y]) => y === line[0][1]);
    const down = line.every(([x]) => x === line[0][0]);
    assert.ok(across || down);
  }
});

test('한 칸씩 붙이기: 어느 조각이든 떼어도 이어진 칸이 있고, 한 칸 작은 조각에 한 칸씩 붙이면 모든 조각이 나온다', () => {
  for (let n = 2; n <= 6; n++) {
    for (const cells of piecesOf(n)) {
      const removable = removableCells(cells);
      assert.ok(removable.length >= 2, `${shapeKey(cells)}: 뗄 수 있는 칸`);
      for (const cell of removable) assert.ok(linked(cells.filter((other) => other !== cell)));
    }
    const grown = new Set(piecesOf(n - 1).flatMap((cells) => grownShapes(cells).map((shape) => nameOf(shape))));
    assert.equal(grown.size, COUNTS.free[n - 1], `${n}칸`);
  }
  // 네 칸 다섯 가지에 붙여 만든 모습(옮긴 것만 하나로)은 42개이고, 하나로 치면 열두 가지다
  const placed = piecesOf(4).flatMap(grownShapes);
  assert.equal(placed.length, 42);
  assert.equal(new Set(placed.map((cells) => keyOf(cells))).size, 12);
});

test('판: 약속마다 정할 수 있는 크기(가짓수 35 이하), 풀이, 놓은 칸 살피기', () => {
  assert.deepEqual(MAX_SIZE, { free: 6, turn: 5, fixed: 4 });
  assert.equal(MAX_TOTAL, 35);
  for (const rule of RULES) {
    for (let n = 2; n <= MAX_SIZE[rule]; n++) {
      const board = { n, rule, row: null, tell: false };
      assert.equal(checkBoard(board), null, `${rule} ${n}`);
      const solution = solve(board);
      assert.equal(solution.total, COUNTS[rule][n - 1]);
      assert.equal(solution.free, COUNTS.free[n - 1]);
      assert.equal(new Set(solution.keys).size, solution.total);
    }
    assert.notEqual(checkBoard({ n: MAX_SIZE[rule] + 1, rule, row: null, tell: false }), null);
  }
  assert.notEqual(checkBoard({ n: 1, rule: 'free', row: null, tell: true }), null);
  assert.notEqual(checkBoard({ n: 4, rule: 'free', row: null }), null);
  assert.notEqual(checkBoard({ n: 4, rule: 'odd', row: null, tell: true }), null);
  assert.notEqual(checkBoard({ n: 4, rule: 'free', row: 5, tell: true }), null);
  assert.notEqual(checkBoard({ n: 5, rule: 'free', row: 1, tell: true }), null);
  // 줄이 정해진 판: 가장 긴 줄이 그 칸 수인 조각만
  const row = solve({ n: 5, rule: 'free', row: 3, tell: true });
  assert.equal(row.total, 8);
  assert.ok(row.pieces.every((cells) => longestRow(cells) === 3));
  assert.equal(solve({ n: 6, rule: 'free', row: 4, tell: true }).total, 13);
  // 찾을 조각은 가장 긴 줄이 긴 것부터 놓인다
  const rows = targetsOf({ n: 6, rule: 'free', row: null, tell: true }).map(longestRow);
  assert.deepEqual(rows, rows.slice().sort((a, b) => b - a));
  // 놓은 칸 살피기
  const board = { n: 4, rule: 'free', row: null, tell: true };
  assert.equal(checkPiece([], board), 'empty');
  assert.equal(checkPiece([[0, 0], [1, 0]], board), 'short');
  assert.equal(checkPiece([[0, 0], [1, 0], [3, 0], [4, 0]], board), 'apart');
  assert.equal(checkPiece([[0, 0], [1, 1], [2, 2], [3, 3]], board), 'apart');
  assert.equal(checkPiece([[0, 0], [1, 0], [2, 0], [3, 0]], board), 'ok');
  assert.equal(checkPiece([[0, 0], [1, 0], [2, 0], [3, 0]], { ...board, row: 3 }), 'row');
  // 모눈은 가장 긴 조각(한 줄)이 가로로 들어가고 남는다
  for (let n = 2; n <= 6; n++) {
    const grid = gridOf(n);
    assert.ok(grid.w > n && grid.h >= Math.min(n, 3));
  }
});

test('작은 판: 같은 약속(같은 줄)으로 칸이 하나, 둘 적고, 찾을 조각이 둘 이상이다', () => {
  assert.deepEqual(smallBoards({ n: 6, rule: 'free', row: null, tell: true }), [
    { n: 5, rule: 'free', row: null, tell: true },
    { n: 4, rule: 'free', row: null, tell: true },
  ]);
  assert.deepEqual(smallBoards({ n: 4, rule: 'free', row: null, tell: false }), [{ n: 3, rule: 'free', row: null, tell: false }]);
  assert.deepEqual(smallBoards({ n: 3, rule: 'free', row: null, tell: true }), []);
  assert.deepEqual(smallBoards({ n: 3, rule: 'fixed', row: null, tell: false }), [{ n: 2, rule: 'fixed', row: null, tell: false }]);
  assert.deepEqual(smallBoards({ n: 4, rule: 'turn', row: null, tell: false }), [{ n: 3, rule: 'turn', row: null, tell: false }]);
  assert.deepEqual(smallBoards({ n: 5, rule: 'free', row: 3, tell: true }), [{ n: 4, rule: 'free', row: 3, tell: true }]);
  assert.deepEqual(smallBoards({ n: 6, rule: 'free', row: 5, tell: true }), []);
  assert.deepEqual(smallBoards({ n: 6, rule: 'free', row: 4, tell: true }), [{ n: 5, rule: 'free', row: 4, tell: true }]);
  assert.deepEqual(smallBoards({ n: 9, rule: 'free', row: null, tell: true }), []);
});
