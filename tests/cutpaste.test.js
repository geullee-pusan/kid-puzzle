// 자르고 붙이기의 풀이 프로그램 점검: 조각 돌리기와 자르기, 옮기기, 채우기의 수, 잘라 옮겨 네모의 가장 적게 자른 수, 그림자 채우기,
// 가장 적게 잘라 나누기의 가장 적은 조각 수를 다른 방법(tests/helpers/brute-cutpaste.js)으로 다시 풀어 견준다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  PIECES,
  SEVEN,
  TRAY_W,
  SHADOW_H,
  boxOf,
  checkBoard,
  components,
  copyBoard,
  cutCells,
  cutLevels,
  cutPiece,
  fillRegion,
  gcdOf,
  hasHole,
  isRect,
  keepOwners,
  lineShare,
  movePiece,
  noCuts,
  normalize,
  orientations,
  overlapOf,
  packShares,
  rectCells,
  rectDone,
  rotate,
  setArea,
  shadowDone,
  sharePieces,
  shareDone,
  sharesOf,
  shapeKey,
  solve,
  solveMove,
  solveShadow,
  solveShare,
  startPieces,
  toggleCut,
  trayOf,
  turnPiece,
} from '../src/core/cutpaste.js';
import { assemble, fakeShadow, growShape, moveBoard, rows, shadowBoard } from '../src/core/cutpaste-ladder.js';
import { createRng, randInt } from '../src/core/rng.js';
import { bruteFillCount, bruteMoveMin, bruteShareBest } from './helpers/brute-cutpaste.js';

const piece = (cells, color = 0) => ({ cells, type: null, color });

test('조각을 돌린 모습: 네모 하나, ㅗ자 넷, 일자 둘, ㄱ자 넷, 두 칸 둘, 한 칸 하나. 네 번 돌리면 제자리다', () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(PIECES).map(([type, cells]) => [type, orientations(cells).length])),
    { o: 1, t: 4, i: 2, l: 4, d: 2, m: 1 },
  );
  for (const cells of Object.values(PIECES)) {
    let now = normalize(cells);
    for (let turn = 0; turn < 4; turn++) now = rotate(now);
    assert.deepEqual(now, normalize(cells));
  }
  // 일곱 조각은 뒤집어도 돌린 모습과 같다(그래서 뒤집기가 필요 없다)
  for (const cells of Object.values(PIECES)) {
    const width = Math.max(...cells.map((cell) => cell[0]));
    assert.equal(shapeKey(cells.map(([x, y]) => [width - x, y])), shapeKey(cells));
  }
  assert.deepEqual(SEVEN, ['o', 't', 'i', 'l', 'l', 'd', 'm']);
  assert.equal(setArea(SEVEN), 20);
});

test('자르기: 선 하나로 조각을 끝까지 자른다. ㄷ자를 가로로 자르면 세 조각이 되고, 조각은 움직이지 않는다', () => {
  const cup = rows(['#.#', '#.#', '###']);
  const parts = cutCells(cup, { d: 'h', at: 2 });
  assert.equal(parts.length, 3);
  assert.deepEqual(parts.map((cells) => cells.length).sort(), [2, 2, 3]);
  assert.deepEqual(parts.flat().sort(), cup.slice().sort());
  // 선이 조각을 지나지 않으면 자르지 않는다
  assert.equal(cutCells(cup, { d: 'v', at: 0 }), null);
  assert.equal(cutCells(cup, { d: 'h', at: 3 }), null);
  assert.equal(cutCells(cup, { d: 'x', at: 1 }), null);
  // 판 위에서 자르면 첫 덩어리는 색을 잇고, 나머지는 쓰지 않은 색을 받는다
  const next = cutPiece([piece(cup, 0), piece([[5, 5]], 1)], 0, { d: 'v', at: 1 });
  assert.equal(next.length, 3);
  assert.deepEqual(next.map((item) => item.color), [0, 2, 1]);
  assert.equal(cutPiece([piece(cup)], 0, { d: 'v', at: 3 }), null);
  assert.equal(components(rows(['#.#'])).length, 2);
});

test('옮기기와 돌리기: 판 밖으로 나가지 않고, 옮기거나 돌린 조각은 맨 위에 놓인다. 돌릴 때는 가운데를 될 수 있는 대로 그대로 둔다', () => {
  const board = { w: 6, h: 5 };
  const start = [piece([[0, 0], [1, 0], [2, 0]], 0), piece([[4, 4]], 1)];
  const moved = movePiece(board, start, 0, 10, 1);
  assert.deepEqual(moved.at(-1).cells, [[3, 1], [4, 1], [5, 1]]);
  assert.equal(moved[0].color, 1);
  const turned = turnPiece(board, [piece([[1, 2], [2, 2], [3, 2]])], 0);
  assert.deepEqual(turned[0].cells, [[2, 1], [2, 2], [2, 3]]);
  // 네 번 돌리면 제자리(판 끝에 닿지 않은 일자)
  let now = [piece([[1, 2], [2, 2], [3, 2]])];
  for (let turn = 0; turn < 4; turn++) now = turnPiece(board, now, 0);
  assert.deepEqual(now[0].cells, [[1, 2], [2, 2], [3, 2]]);
  // 판 끝에서 돌리면 안으로 밀린다
  const edge = turnPiece(board, [piece([[0, 4], [1, 4], [2, 4]])], 0);
  assert.ok(edge[0].cells.every(([x, y]) => x >= 0 && y >= 0 && x < 6 && y < 5));
  assert.deepEqual(overlapOf([piece([[0, 0], [1, 0]]), piece([[1, 0], [2, 0]])]), [[1, 0]]);
});

test('다 되었는지: 겹치지 않고 빈틈없는 네모, 겹치지 않고 그림자와 꼭 같은 칸', () => {
  assert.equal(rectDone([piece([[0, 0], [1, 0]]), piece([[0, 1], [1, 1]])]), true);
  assert.equal(rectDone([piece([[0, 0], [1, 0]]), piece([[1, 0], [1, 1]])]), false);
  assert.equal(rectDone([piece([[0, 0], [1, 0]]), piece([[1, 1], [2, 1]])]), false);
  const board = { shadow: [[8, 1], [9, 1], [8, 2]] };
  assert.equal(shadowDone(board, [piece([[8, 1], [9, 1]]), piece([[8, 2]])]), true);
  assert.equal(shadowDone(board, [piece([[8, 1], [9, 1]]), piece([[9, 2]])]), false);
  assert.equal(isRect(rectCells(3, 2)), true);
  assert.equal(hasHole(rows(['###', '#.#', '###'])), true);
  assert.equal(hasHole(rows(['###', '#.#', '#.#'])), false);
});

test('채우기의 수가 다른 방법(비트 묶음으로 모든 자리를 미리 만들어 두는 채우기)과 같다', () => {
  const shapes = SEVEN.map((type) => PIECES[type]);
  // 5×4 네모를 일곱 조각으로 채우는 방법(같은 모양의 조각을 바꿔 놓은 것은 하나)
  assert.equal(fillRegion(rectCells(5, 4), shapes, { limit: Infinity }).count, 1756);
  assert.equal(bruteFillCount(rectCells(5, 4), shapes), 1756);
  // 4단계 첫 판(집)은 196가지, 둘레 띠 20칸은 0가지
  const house = rows(['..#..', '.###.', '#####', '.###.', '.###.', '.###.', '.#.#.']);
  assert.equal(fillRegion(house, shapes, { limit: Infinity }).count, 196);
  assert.equal(bruteFillCount(house, shapes), 196);
  const ring = rows(['######', '#....#', '#....#', '#....#', '#....#', '######']);
  assert.equal(ring.length, 20);
  assert.equal(fillRegion(ring, shapes).count, 0);
  assert.equal(bruteFillCount(ring, shapes), 0);
  // 시드 난수 그림자 60개와 그 가짜(칸 하나를 붙이거나 뗌)
  const rng = createRng(20261120);
  for (let at = 0; at < 60; at++) {
    const set = at % 2 === 0 ? SEVEN : SEVEN.slice(0, 3 + (at % 4));
    const cells = assemble(rng, set, at % 3 !== 0);
    const pieces = set.map((type) => PIECES[type]);
    assert.ok(fillRegion(cells, pieces).fill, `그림자 ${at}`);
    assert.ok(bruteFillCount(cells, pieces, 1) > 0, `그림자 ${at}`);
    const fake = fakeShadow(rng, cells);
    if (!fake) continue;
    assert.equal(Math.abs(fake.length - cells.length), 1);
    assert.equal(fillRegion(fake, pieces).count, 0);
    assert.equal(bruteFillCount(fake, pieces), 0);
  }
});

test('채운 모습은 조각마다 그 조각의 모양이고, 겹치지 않고 칸을 꼭 덮는다', () => {
  const house = rows(['..#..', '.###.', '#####', '.###.', '.###.', '.###.', '.#.#.']);
  const { fill } = fillRegion(house, SEVEN.map((type) => PIECES[type]));
  assert.deepEqual(fill.map((item) => item.index).sort(), [0, 1, 2, 3, 4, 5, 6]);
  for (const item of fill) assert.equal(shapeKey(item.cells), shapeKey(PIECES[SEVEN[item.index]]));
  const cells = fill.flatMap((item) => item.cells).map(String);
  assert.equal(new Set(cells).size, 20);
  assert.deepEqual(cells.sort(), house.map(String).sort());
});

test('잘라 옮겨 네모: 비껴 놓인 계단은 한 번, 십자는 한 번으로 안 되고(5칸이라 한 줄 네모뿐) 두 번이면 된다', () => {
  const step = moveBoard(rows(['####..', '..####']), 1);
  const solved = solveMove(step);
  assert.deepEqual([solved.possible, solved.min, solved.area, solved.size], [true, 1, 8, [4, 2]]);
  // 자른 조각들은 처음 도형을 빈틈없이 나누고, 채운 모습은 네모를 꼭 덮는다
  assert.deepEqual(solved.pieces.flat().map(String).sort(), step.cells.map(String).sort());
  assert.equal(new Set(solved.fill.flatMap((item) => item.cells).map(String)).size, 8);
  for (const item of solved.fill) assert.equal(shapeKey(item.cells), shapeKey(solved.pieces[item.index]));
  const plus = moveBoard(rows(['.#.', '###', '.#.']), 1);
  const one = solveMove(plus);
  assert.deepEqual([one.possible, one.reason, one.min], [false, 'line', null]);
  const two = solveMove({ ...plus, cuts: 2 });
  assert.deepEqual([two.possible, two.min, two.size], [true, 2, [5, 1]]);
  // 잘린 모습의 수: 처음 모습, 한 번, 두 번
  assert.deepEqual(cutLevels(plus.cells, 2).map((list) => list.length), [1, 4, 6]);
});

test('잘라 옮겨 네모의 가장 적게 자른 수가 다른 방법(칸마다 조각 번호를 적은 표로 자르기)과 같다: 시드 난수 도형 160개', () => {
  const rng = createRng(1120);
  const seen = { 0: 0, 1: 0, 2: 0, none: 0 };
  for (let at = 0; at < 160; at++) {
    const cuts = at % 2 === 0 ? 1 : 2;
    const cells = growShape(rng, randInt(rng, 4, 10), [5, 4]);
    if (isRect(cells)) continue;
    const board = moveBoard(cells, cuts);
    assert.equal(checkBoard(board), null);
    const result = solveMove(board);
    const brute = bruteMoveMin(board);
    assert.equal(result.min, brute, JSON.stringify(board.cells));
    seen[result.min ?? 'none'] += 1;
    if (!result.possible) assert.ok(['line', 'search'].includes(result.reason));
  }
  assert.ok(seen[1] > 0 && seen[2] > 0 && seen.none > 0, JSON.stringify(seen));
});

test('가짜 그림자: 칸 수가 다르면 까닭은 칸 수(area)이고, 같은데 안 되면 모두 따져 본 것(search)이다', () => {
  const square = shadowBoard(SEVEN, rows(['#####', '#####', '#####', '#####', '#####']));
  assert.equal(checkBoard(square), null);
  assert.deepEqual(solveShadow(square), { possible: false, area: 20, shadowArea: 25, fill: null, reason: 'area' });
  const ring = shadowBoard(SEVEN, rows(['######', '#....#', '#....#', '#....#', '#....#', '######']));
  assert.equal(solveShadow(ring).reason, 'search');
  const house = shadowBoard(SEVEN, rows(['..#..', '.###.', '#####', '.###.', '.###.', '.###.', '.#.#.']));
  assert.equal(solveShadow(house).possible, true);
  // 처음 조각들은 왼쪽 자리 안에 겹치지 않고 놓이고, 그림자는 그 오른쪽에 있다
  const tray = trayOf(SEVEN);
  assert.equal(overlapOf(tray).length, 0);
  assert.ok(tray.every((item) => item.cells.every(([x, y]) => x < TRAY_W && y < SHADOW_H)));
  assert.ok(house.shadow.every(([x]) => x > TRAY_W));
  assert.deepEqual(startPieces(house), tray);
});

test('가장 적게 잘라 나누기: 가장 적은 조각 수가 다른 방법(자르는 자리의 모든 묶음과 주는 모든 방법)과 같다', () => {
  for (let m = 2; m <= 4; m++) {
    for (let n = 2; n <= 5; n++) {
      if (m * (n - 1) > 12) continue;
      assert.equal(solveShare({ kind: 'share', m, n }).best, bruteShareBest(m, n), `${m}, ${n}`);
    }
  }
  // 모든 판(빵 2~5개, 2~6명)에서 가장 적은 조각 수는 m + n − (m과 n의 최대공약수)이고, 한 줄로 이어 끊는 나누기가 그만큼이다
  for (let m = 2; m <= 5; m++) {
    for (let n = 2; n <= 6; n++) {
      const board = { kind: 'share', m, n };
      const result = solveShare(board);
      assert.equal(result.best, m + n - gcdOf(m, n), `${m}, ${n}`);
      assert.equal(sharePieces(board, result.cuts).length, result.best);
      assert.equal(shareDone(board, result.cuts, result.owners), true);
      const line = lineShare(board);
      assert.equal(sharePieces(board, line.cuts).length, result.best);
      assert.equal(shareDone(board, line.cuts, line.owners), true);
    }
  }
});

test('나누기의 조각과 주인: 자르면 조각이 바뀌고, 없어진 조각의 주인은 지운다', () => {
  const board = { kind: 'share', m: 2, n: 3 };
  let cuts = noCuts(board);
  assert.deepEqual(sharePieces(board, cuts).map((item) => item.key), ['0:0-3', '1:0-3']);
  cuts = toggleCut(board, cuts, 0, 2);
  cuts = toggleCut(board, cuts, 1, 1);
  assert.deepEqual(cuts, [[2], [1]]);
  const owners = { '0:0-2': 0, '0:2-3': 1, '1:0-1': 1, '1:1-3': 2 };
  assert.deepEqual(sharesOf(board, cuts, owners), [2, 2, 2]);
  assert.equal(shareDone(board, cuts, owners), true);
  assert.equal(shareDone(board, cuts, { ...owners, '1:1-3': 1 }), false);
  const back = toggleCut(board, cuts, 0, 2);
  assert.deepEqual(keepOwners(board, back, owners), { '1:0-1': 1, '1:1-3': 2 });
  // 판 밖의 자리는 자르지 않는다
  assert.deepEqual(toggleCut(board, cuts, 0, 3), cuts);
  assert.deepEqual(toggleCut(board, cuts, 2, 1), cuts);
  assert.deepEqual(packShares([2, 1, 1, 2], 3, 2).length, 4);
  assert.equal(packShares([3, 3], 3, 2), null);
});

test('판 검사와 베끼기', () => {
  assert.equal(checkBoard(null), '판의 종류가 맞지 않아요');
  assert.equal(checkBoard({ kind: 'share', m: 1, n: 3 }) !== null, true);
  assert.equal(checkBoard({ kind: 'share', m: 5, n: 7 }) !== null, true);
  assert.equal(checkBoard({ kind: 'share', m: 5, n: 6 }), null);
  assert.equal(checkBoard(moveBoard(rows(['##', '##']), 1)), '이미 네모예요');
  assert.equal(checkBoard({ ...moveBoard(rows(['##.', '.##']), 1), cuts: 0 }) !== null, true);
  assert.equal(checkBoard({ kind: 'move', w: 12, h: 7, cells: [[1, 1], [2, 1], [1, 2], [1, 3]], cuts: 1 }), null);
  assert.equal(checkBoard({ kind: 'move', w: 12, h: 7, cells: [[1, 1], [3, 1], [1, 2], [3, 3]], cuts: 1 }), '도형이 이어져 있지 않아요');
  assert.equal(checkBoard({ ...shadowBoard(SEVEN, rows(['##'])), shadow: [[1, 1], [2, 1]] }), '그림자가 조각 자리에 겹쳐요');
  const board = shadowBoard(SEVEN, rows(['###', '###']));
  assert.deepEqual(copyBoard(board), board);
  assert.notEqual(copyBoard(board).shadow, board.shadow);
  assert.deepEqual(boxOf([[2, 3], [4, 1]]), { x: 2, y: 1, w: 3, h: 3 });
  // 판마다의 풀이
  assert.equal(solve({ kind: 'share', m: 2, n: 3 }).best, 4);
  assert.deepEqual(solve({ kind: 'share', m: 2, n: 3 }).line, lineShare({ m: 2, n: 3 }));
});
