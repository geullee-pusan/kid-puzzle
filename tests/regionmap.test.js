// 구역 지도 맞히기의 풀이 프로그램 점검: 지도 모두 세기, 대답에 맞는 지도 고르기, 가장 적게 묻기, 선생님이 묻는 차례,
// 칠한 지도 견주기가 다른 방법(tests/helpers/brute-regionmap.js: 칸마다 구역을 모두 골라 보기, 네모 묶음을 모두 골라 보기)과 맞는지 본다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  allRects,
  answerOf,
  cellsOfMasks,
  checkBoard,
  countsIn,
  diagnose,
  fitting,
  mapsOf,
  minQuestions,
  paintOk,
  piecesOf,
  rectOf,
  sizesOf,
  teacherAsks,
} from '../src/core/regionmap.js';
import { createRng, randInt } from '../src/core/rng.js';
import { bruteAnswer, bruteFitting, bruteMaps, bruteMin, bruteRects, joined } from './helpers/brute-regionmap.js';

const drawn = (rows) => {
  const cells = rows.join('').split('').map(Number);
  return { w: rows[0].length, h: rows.length, regions: [...new Set(cells)].sort((a, b) => a - b), cells };
};
const sizesOfCells = (cells, regions) => regions.map((label) => cells.filter((cell) => cell === label).length);
const asBoard = (w, h, regions, cells) => ({ w, h, regions, cells });

test('판의 규격: 크기, 구역은 둘 이상이고 저마다 한 덩이, 이름표는 작은 것부터', () => {
  assert.equal(checkBoard(drawn(['001', '001', '111'])), null);
  assert.equal(checkBoard(drawn(['0022', '0122', '1111'])), null);
  assert.equal(checkBoard(drawn(['010', '000', '000'])), null);
  assert.match(checkBoard(drawn(['101', '000', '000'])), /떨어져/);
  assert.match(checkBoard(drawn(['000', '000', '000'])), /구역의 수/);
  assert.match(checkBoard({ w: 7, h: 2, regions: [0, 1], cells: Array(14).fill(0) }), /크기/);
  assert.match(checkBoard({ w: 2, h: 2, regions: [1, 0], cells: [0, 0, 1, 1] }), /이름표/);
  assert.match(checkBoard({ w: 2, h: 2, regions: [0, 1, 2], cells: [0, 0, 1, 1] }), /빈 구역/);
  assert.equal(checkBoard(null), '판이 없어요');
  assert.equal(piecesOf([0, 1, 1, 0], 2, 2, 0), 2);
  assert.equal(piecesOf([0, 1, 0, -1], 2, 2, 0), 1);
  assert.ok(paintOk(drawn(['01', '01']), [-1, 0, 1, 1]));
  assert.ok(!paintOk(drawn(['01', '01']), [2, 0, 1, 1]));
});

test('네모와 대답: 모든 네모의 수, 두 칸으로 만드는 네모, 칸을 하나하나 센 것과 같은 대답', () => {
  for (const [w, h] of [[3, 3], [4, 4], [6, 6], [5, 3]]) {
    const rects = allRects(w, h);
    assert.equal(rects.length, ((w * (w + 1)) / 2) * ((h * (h + 1)) / 2));
    assert.equal(new Set(rects.map(String)).size, rects.length);
    assert.deepEqual(rects[0], [0, 0, w - 1, h - 1], '판 전체가 맨 앞');
    assert.deepEqual(rects.map(String).sort(), bruteRects(w, h).map(String).sort());
  }
  assert.deepEqual(rectOf(7, 1, 4), [1, 0, 3, 1]);
  assert.deepEqual(rectOf(5, 5, 4), [1, 1, 1, 1]);
  const board = drawn(['000111', '001111', '022113', '222333', '222333', '223333']);
  const rng = createRng(7);
  for (let at = 0; at < 200; at++) {
    const a = randInt(rng, 0, 35);
    const b = randInt(rng, 0, 35);
    const rect = rectOf(a, b, 6);
    assert.deepEqual(answerOf(board, rect), bruteAnswer(board.cells, 6, board.regions, rect));
  }
  assert.deepEqual(countsIn([0, -1, 1, 1], [0, 1], 2, [0, 0, 1, 1]), [1, 2]);
});

test('지도 모두 세기: 칸마다 구역을 모두 골라 본 것과 같다(작은 판의 모든 칸 수 나누기)', () => {
  const key = (list) => list.map((cells) => cells.join('')).sort();
  for (const [w, h, regions] of [[2, 2, [0, 1]], [3, 2, [0, 1]], [3, 3, [0, 1]], [4, 3, [0, 1]], [3, 3, [0, 1, 2]], [3, 3, [0, 2]], [2, 3, [0, 1, 2, 3]]]) {
    const all = bruteMaps(w, h, regions);
    const bySizes = new Map();
    for (const cells of all) {
      const sizes = sizesOfCells(cells, regions).join();
      if (!bySizes.has(sizes)) bySizes.set(sizes, []);
      bySizes.get(sizes).push(cells);
    }
    for (const [sizes, list] of bySizes) {
      const found = mapsOf(w, h, regions, sizes.split(',').map(Number)).map((masks) => cellsOfMasks(masks, regions, w * h));
      assert.deepEqual(key(found), key(list), `${w}×${h} 구역 ${regions} 칸 수 ${sizes}`);
    }
  }
  // 4×4 두 구역: 모두 1254가지, 숲 8칸 바다 8칸은 140가지
  const four = bruteMaps(4, 4, [0, 1]);
  assert.equal(four.length, 1254);
  let total = 0;
  for (let size = 1; size < 16; size++) total += mapsOf(4, 4, [0, 1], [size, 16 - size]).length;
  assert.equal(total, 1254);
  assert.equal(mapsOf(4, 4, [0, 1], [8, 8]).length, four.filter((cells) => cells.filter((cell) => cell === 0).length === 8).length);
  assert.equal(mapsOf(4, 4, [0, 1], [8, 8]).length, 140);
  assert.throws(() => mapsOf(5, 4, [0, 1], [10, 10]));
});

test('대답에 맞는 지도: 무작위 네모 몇 개의 대답과 맞는 지도가 칸마다 골라 본 것과 같다(숨은 지도는 늘 들어 있다)', () => {
  const rng = createRng(11);
  const cases = [
    [3, 3, [0, 1]],
    [4, 3, [0, 1]],
    [3, 3, [0, 1, 2]],
  ];
  for (const [w, h, regions] of cases) {
    const all = bruteMaps(w, h, regions);
    for (let round = 0; round < 12; round++) {
      const cells = all[randInt(rng, 0, all.length - 1)];
      const board = asBoard(w, h, regions, cells);
      const same = all.filter((other) => sizesOfCells(other, regions).join() === sizesOf(board).join());
      const rects = Array.from({ length: randInt(rng, 0, 3) }, () => rectOf(randInt(rng, 0, w * h - 1), randInt(rng, 0, w * h - 1), w));
      const fits = fitting(board, rects.map((rect) => ({ rect }))).map((masks) => cellsOfMasks(masks, regions, w * h).join('')).sort();
      const brute = bruteFitting(board, same, rects).map((list) => list.join('')).sort();
      assert.deepEqual(fits, brute, `${cells.join('')} ${JSON.stringify(rects)}`);
      assert.ok(fits.includes(cells.join('')));
    }
  }
});

test('가장 적게 묻기: 3×3 판의 모든 두 구역 지도와 세 구역 지도 몇 개에서 네모 묶음을 모두 골라 본 수와 같다', () => {
  for (const regions of [[0, 1], [0, 1, 2]]) {
    const all = bruteMaps(3, 3, regions);
    const list = regions.length === 2 ? all : all.filter((_, at) => at % 37 === 0);
    for (const cells of list) {
      const board = asBoard(3, 3, regions, cells);
      const same = all.filter((other) => sizesOfCells(other, regions).join() === sizesOf(board).join());
      const result = minQuestions(board);
      assert.ok(result, cells.join(''));
      assert.equal(result.size, bruteMin(board, same), cells.join(''));
      // 구한 네모들의 대답이면 정말 하나만 남는다
      assert.equal(bruteFitting(board, same, result.rects).length, 1, cells.join(''));
    }
  }
});

test('가장 적게 묻기: 4×4 판에서 구한 네모들이면 하나만 남고, 하나 덜 물으면 늘 둘 이상 남는다(몇 판)', () => {
  const all = bruteMaps(4, 4, [0, 1]);
  const boards = [drawn(['0001', '0011', '0111', '0011']), drawn(['0000', '0001', '1111', '1111']), drawn(['0011', '0011', '0011', '0011']), drawn(['0100', '0110', '0010', '0000'])];
  const expected = [3, 2, 1, null];
  boards.forEach((board, at) => {
    const same = all.filter((cells) => sizesOfCells(cells, [0, 1]).join() === sizesOf(board).join());
    const result = minQuestions(board);
    assert.equal(bruteFitting(board, same, result.rects).length, 1);
    if (expected[at] !== null) assert.equal(result.size, expected[at]);
    // 하나 덜: 네모 묶음을 모두 골라 본다(3개 이하일 때만)
    if (result.size <= 3) assert.equal(bruteMin(board, same, result.size), result.size);
  });
  // 선생님이 묻는 차례: 묻고 나면 하나만 남고, 묻는 수는 가장 적은 수보다 적지 않다
  for (const board of boards) {
    const asks = teacherAsks(board);
    assert.equal(fitting(board, asks.map((rect) => ({ rect }))).length, 1);
    assert.ok(asks.length >= minQuestions(board).size);
    // 하나 덜 물었을 때는 아직 둘 이상 남는다(쓸데없이 묻지 않는다)
    if (asks.length > 0) assert.ok(fitting(board, asks.slice(0, -1).map((rect) => ({ rect }))).length > 1);
  }
  // 세 구역 판도 구한다
  const three = drawn(['0022', '0122', '1111', '1111']);
  const least = minQuestions(three);
  assert.equal(fitting(three, least.rects.map((rect) => ({ rect }))).length, 1);
  // 칸이 16개보다 많은 판은 구하지 않는다
  assert.equal(minQuestions(drawn(['00011', '00111', '02211', '22211', '22221'])), null);
});

test('칠한 지도 견주기: 칠하지 않은 칸, 처음 알려 준 칸 수, 물음의 대답, 떨어진 구역, 모두 맞지만 다른 지도, 같은 지도', () => {
  const board = drawn(['0000', '0001', '1111', '1111']);
  const asked = [{ rect: [0, 0, 3, 0] }, { rect: [3, 0, 3, 3] }];
  assert.deepEqual(diagnose(board, Array(16).fill(-1), asked), { kind: 'blank', n: 16 });
  assert.deepEqual(diagnose(board, Array(16).fill(0), asked), { kind: 'totals', label: 0, painted: 16, total: 7 });
  // 숲 7칸이지만 첫 줄에 바다가 있다: 첫 물음(첫 줄은 숲 4칸)과 맞지 않는다
  const first = drawn(['0001', '0000', '1111', '1111']).cells;
  assert.deepEqual(diagnose(board, first, asked), { kind: 'question', at: 0, label: 0, painted: 3, answer: 4 });
  // 바다 한 칸이 숲 사이에 떨어져 있고 숲도 두 덩이다(칸 수는 맞는다). 처음 걸리는 숲을 말한다
  const apart = drawn(['0010', '0100', '0111', '1111']).cells;
  assert.equal(diagnose(board, apart, []).kind, 'split');
  assert.deepEqual(diagnose(board, apart, []), { kind: 'split', label: 0, pieces: 2 });
  // 물음과 모두 맞지만 숨은 지도와 다르다
  const other = drawn(['0000', '0010', '1111', '1111']).cells;
  assert.equal(diagnose(board, other, [{ rect: [0, 0, 3, 0] }]).kind, 'fits');
  assert.equal(diagnose(board, board.cells.slice(), asked).kind, 'same');
  assert.ok(joined(board.cells, 4, 4, 1));
});
