// 눈대중의 풀이 프로그램 점검: 얼룩의 칸, 덮기의 가장 좋은 답, 수직선의 자리, 어림이 큰지 작은지 알 수 없는지.
// 모두 다른 방법(tests/helpers/brute-eyeball.js)으로 다시 구해 견준다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createRng, randInt } from '../src/core/rng.js';
import { MAX_RADIUS, bestCover, blobCells, checkBoard, checkSide, coverKey, coverOf, estOf, fracOf, insideCircle, pushesOf, rectBetween, revealTicks, snapValue, solve, tightRects, trueRange, verdict } from '../src/core/eyeball.js';
import { allRects, bruteCells, bruteCoverAll, bruteCoverLast, bruteSide } from './helpers/brute-eyeball.js';

/** 시드 난수로 둥근 덩어리 몇 개를 아무 데나 놓은 얼룩 판(판 밖으로 나가도 된다) */
function randomBlob(rng, w, h, count = randInt(rng, 1, 4)) {
  const circles = Array.from({ length: count }, () => [randInt(rng, 0, w), randInt(rng, 0, h), randInt(rng, 1, 7)]);
  return { kind: 'cover', w, h, circles, k: 2 };
}

test('칸의 한가운데는 원의 둘레에 꼭 놓이는 일이 없다(가운데가 격자점이고 반지름이 반 칸 단위의 정수이면)', () => {
  for (let r = 1; r <= MAX_RADIUS; r++) {
    for (let dx = -30; dx <= 30; dx++) {
      for (let dy = -30; dy <= 30; dy++) {
        const sx = 2 * dx + 1;
        const sy = 2 * dy + 1;
        assert.notEqual(sx * sx + sy * sy, r * r, `${r} ${dx} ${dy}`);
      }
    }
  }
  // 칸 (0, 0)의 한가운데는 격자점 (0, 0)에서 반 칸 단위로 (1, 1), 거리의 제곱 2
  assert.equal(insideCircle([0, 0, 2], 0, 0), true);
  assert.equal(insideCircle([0, 0, 1], 0, 0), false);
});

test('얼룩의 칸이 실수로 거리를 잰 다른 방법과 같다(시드 난수 얼룩 2,000개)', () => {
  const rng = createRng(11201);
  for (let round = 0; round < 2000; round++) {
    const board = randomBlob(rng, randInt(rng, 4, 10), randInt(rng, 3, 8));
    assert.deepEqual(blobCells(board), bruteCells(board), JSON.stringify(board));
  }
});

test('꼭 감싸는 직사각형: 안의 얼룩 칸을 꼭 감싸는 직사각형이 바로 그 직사각형인 것들이다', () => {
  const rng = createRng(11202);
  for (let round = 0; round < 60; round++) {
    const board = randomBlob(rng, randInt(rng, 4, 7), randInt(rng, 3, 5));
    const cells = blobCells(board);
    const expected = [];
    for (const { rect } of allRects(board.w, board.h)) {
      const inside = cells.filter((cell) => cell % board.w >= rect.x && cell % board.w < rect.x + rect.w && Math.floor(cell / board.w) >= rect.y && Math.floor(cell / board.w) < rect.y + rect.h);
      if (inside.length === 0) continue;
      const xs = inside.map((cell) => cell % board.w);
      const ys = inside.map((cell) => Math.floor(cell / board.w));
      if (Math.min(...xs) === rect.x && Math.max(...xs) === rect.x + rect.w - 1 && Math.min(...ys) === rect.y && Math.max(...ys) === rect.y + rect.h - 1) expected.push(rect);
    }
    const key = (list) => list.map((rect) => `${rect.x},${rect.y},${rect.w},${rect.h}`).sort();
    assert.deepEqual(key(tightRects(board, cells)), key(expected));
  }
});

test('덮은 모습: 덮은 칸, 덮지 않은 얼룩 칸, 얼룩이 아닌데 덮은 칸을 칸마다 센 것과 같다', () => {
  const rng = createRng(11203);
  for (let round = 0; round < 300; round++) {
    const board = randomBlob(rng, randInt(rng, 4, 10), randInt(rng, 3, 8));
    const cells = new Set(blobCells(board));
    const rects = Array.from({ length: randInt(rng, 0, 3) }, () => rectBetween(board, randInt(rng, 0, board.w * board.h - 1), randInt(rng, 0, board.w * board.h - 1)));
    const covered = new Set();
    for (const rect of rects) for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) covered.add(y * board.w + x);
    const result = coverOf(board, rects);
    assert.equal(result.size, covered.size);
    assert.equal(result.missing, [...cells].filter((cell) => !covered.has(cell)).length);
    assert.equal(result.extra, [...covered].filter((cell) => !cells.has(cell)).length);
    assert.deepEqual(result.covered, [...covered].sort((a, b) => a - b));
  }
  // 덮기의 이름은 직사각형의 차례와 겹친 것을 따지지 않는다
  const a = { x: 0, y: 0, w: 2, h: 1 };
  const b = { x: 1, y: 1, w: 1, h: 2 };
  assert.equal(coverKey([a, b]), coverKey([b, a, a]));
});

test('덮기의 가장 좋은 답이 모든 직사각형의 모든 묶음(셋까지)을 따진 것과 같다(작은 판 120개)', () => {
  const rng = createRng(11204);
  for (let round = 0; round < 120; round++) {
    const [w, h] = [[4, 3], [5, 3], [4, 4], [5, 4], [6, 4]][round % 5];
    const board = randomBlob(rng, w, h, randInt(rng, 1, 3));
    const cells = blobCells(board);
    if (cells.length === 0) continue;
    for (const k of [1, 2, 3]) {
      const mine = bestCover(board, k, cells);
      assert.equal(mine.extra, bruteCoverAll(board, k, cells), `${JSON.stringify(board)} ${k}개`);
      // 내놓은 덮기가 정말 얼룩을 다 덮고, 말한 만큼만 더 덮는다
      assert.ok(mine.rects.length <= k);
      const cover = coverOf(board, mine.rects, cells);
      assert.equal(cover.missing, 0);
      assert.equal(cover.extra, mine.extra);
      // 마지막 하나를 남은 칸을 꼭 감싸는 직사각형으로 두어도 같다(큰 판의 다른 방법이 기대는 것)
      assert.equal(bruteCoverLast(board, k, cells), mine.extra);
    }
  }
});

test('덮기의 가장 좋은 답은 직사각형이 많을수록 줄거나 같고, 하나일 때는 얼룩을 꼭 감싸는 직사각형이다', () => {
  const rng = createRng(11205);
  for (let round = 0; round < 200; round++) {
    const board = randomBlob(rng, randInt(rng, 5, 10), randInt(rng, 4, 8));
    const cells = blobCells(board);
    if (cells.length === 0) continue;
    const [one, two, three] = [1, 2, 3].map((k) => bestCover(board, k, cells).extra);
    assert.ok(one >= two && two >= three);
    const xs = cells.map((cell) => cell % board.w);
    const ys = cells.map((cell) => Math.floor(cell / board.w));
    assert.equal(one, (Math.max(...xs) - Math.min(...xs) + 1) * (Math.max(...ys) - Math.min(...ys) + 1) - cells.length);
  }
});

test('수직선: 누른 자리를 가장 가까운 수로 맞추고, 수의 자리는 왼쪽 끝 0에서 오른쪽 끝 1까지다', () => {
  const line = { kind: 'line', from: 300, to: 700, step: 10, ticks: [], targets: [470] };
  assert.equal(checkBoard(line), null);
  assert.equal(fracOf(line, 300), 0);
  assert.equal(fracOf(line, 700), 1);
  assert.equal(fracOf(line, 470), 0.425);
  assert.equal(snapValue(line, 0.425), 470);
  assert.equal(snapValue(line, 0.43), 470);
  assert.equal(snapValue(line, -1), 300);
  assert.equal(snapValue(line, 2), 700);
  assert.deepEqual(revealTicks(line), [300, 340, 380, 420, 460, 500, 540, 580, 620, 660, 700]);
  // 다른 방법: 선 위의 모든 수 가운데 가장 가까운 것(같으면 큰 쪽)
  for (let index = 0; index <= 400; index++) {
    const frac = index / 400;
    const values = Array.from({ length: 41 }, (_, at) => 300 + at * 10);
    const near = values.reduce((best, value) => (Math.abs(fracOf(line, value) - frac) <= Math.abs(fracOf(line, best) - frac) + 1e-12 ? value : best));
    assert.equal(snapValue(line, frac), near, String(frac));
  }
  assert.notEqual(checkBoard({ ...line, targets: [475] }), null);
  assert.notEqual(checkBoard({ ...line, targets: [470, 470] }), null);
  assert.notEqual(checkBoard({ ...line, to: 705 }), null);
});

/** 시드 난수 어림 판(쓸 수 있는 판만) */
function randomSide(rng) {
  for (;;) {
    const op = ['+', '-', '×'][randInt(rng, 0, 2)];
    const count = op === '+' ? randInt(rng, 2, 3) : 2;
    const items = Array.from({ length: count }, () => {
      if (op === '×') return { n: randInt(rng, 2, 99), unit: [1, 10][randInt(rng, 0, 1)], hide: false };
      const hide = rng() < 0.5;
      return hide ? { n: randInt(rng, 10, 99) * 10, unit: 100, hide } : { n: randInt(rng, 10, 999), unit: [10, 100][randInt(rng, 0, 1)], hide };
    });
    const board = { kind: 'side', op, items };
    if (checkSide(board) === null) return board;
  }
}

test('어림: 큰지 작은지 알 수 없는지가 가린 숫자를 모두 넣어 본 것과 같다(시드 난수 판 3,000개)', () => {
  const rng = createRng(11206);
  const seen = { bigger: 0, smaller: 0, unknown: 0, same: 0, directions: 0, sizes: 0 };
  for (let round = 0; round < 3000; round++) {
    const board = randomSide(rng);
    const brute = bruteSide(board);
    const result = verdict(board);
    const where = JSON.stringify(board);
    assert.equal(brute.consistent, true, where);
    assert.equal(result.est, brute.est, where);
    assert.deepEqual([result.low, result.high], [Math.min(...brute.values), Math.max(...brute.values)], where);
    assert.equal(result.answer, brute.answer, where);
    // 수마다 미는 쪽이 모두 같으면 쪽만 보아도 정해진다. 그러면 답도 늘 정해진다
    assert.equal(result.by === 'directions', brute.directions, where);
    if (brute.directions) assert.ok(result.answer === 'bigger' || result.answer === 'smaller', where);
    if (result.by === 'sizes') assert.ok(result.answer === 'bigger' || result.answer === 'smaller', where);
    if (result.answer === 'unknown') assert.ok(board.items.some((item) => item.hide), `가린 숫자가 없으면 늘 정해진다: ${where}`);
    // 막대의 몫을 모두 더하면 어림한 값 − 실제 값의 범위가 된다
    const pushes = pushesOf(board);
    const low = pushes.reduce((sum, item) => sum + item.lo, 0);
    const high = pushes.reduce((sum, item) => sum + item.hi, 0);
    assert.deepEqual([low, high], [result.est - result.high, result.est - result.low], where);
    // 알 수 없는 판의 풀이는 안 되는 판처럼 적는다
    assert.equal(solve(board).possible, result.answer !== 'unknown');
    seen[result.answer] += 1;
    seen[result.by] = (seen[result.by] ?? 0) + 1;
  }
  for (const key of ['bigger', 'smaller', 'unknown', 'directions', 'sizes']) assert.ok(seen[key] > 50, `${key} ${seen[key]}`);
});

test('어림: 쪽만으로 정해지는 것, 크기로 정해지는 것, 알 수 없는 것의 보기', () => {
  const side = (op, ...items) => ({ kind: 'side', op, items: items.map(([n, unit, hide = false]) => ({ n, unit, hide })) });
  // 198 + 397 → 200 + 400: 모두 올렸다
  assert.deepEqual(pick(verdict(side('+', [198, 100], [397, 100]))), { answer: 'bigger', by: 'directions', est: 600, low: 595, high: 595 });
  // 198 + 305 + 99 → 200 + 300 + 100: 2와 1을 올리고 5를 내렸다
  assert.deepEqual(pick(verdict(side('+', [198, 100], [305, 100], [99, 100]))), { answer: 'smaller', by: 'sizes', est: 600, low: 602, high: 602 });
  // 49 × 21 → 50 × 20: 앞의 수를 올리면 21만큼, 뒤의 수를 내리면 50만큼
  assert.deepEqual(pick(verdict(side('×', [49, 10], [21, 10]))), { answer: 'smaller', by: 'sizes', est: 1000, low: 1029, high: 1029 });
  assert.deepEqual(pushesOf(side('×', [49, 10], [21, 10])).map((item) => item.lo), [21, -50]);
  // 302 − 198 → 300 − 200: 앞의 수는 내리고 뒤의 수는 올렸는데, 둘 다 어림한 값을 작게 만든다
  assert.deepEqual(pick(verdict(side('-', [302, 100], [198, 100]))), { answer: 'smaller', by: 'directions', est: 100, low: 104, high: 104 });
  // 13□ + 26□ → 100 + 300: 30~39 내리고 31~40 올렸다
  assert.deepEqual(pick(verdict(side('+', [130, 100, true], [260, 100, true]))), { answer: 'unknown', by: 'unknown', est: 400, low: 390, high: 408 });
  // 19□ + 32□ → 200 + 300: 1~10 올리고 20~29 내렸다
  assert.deepEqual(pick(verdict(side('+', [190, 100, true], [320, 100, true]))), { answer: 'smaller', by: 'sizes', est: 500, low: 510, high: 528 });
  // 19□ + 31□ → 200 + 300: 같아질 수도 있다(판으로 내지 않는다)
  assert.equal(verdict(side('+', [190, 100, true], [310, 100, true])).touch, true);
  // 198 + 302: 늘 같다
  assert.equal(verdict(side('+', [198, 100], [302, 100])).answer, 'same');
  assert.deepEqual(trueRange(side('-', [130, 100, true], [260, 100, true])), [130 - 269, 139 - 260]);
  assert.equal(estOf({ n: 150, unit: 100, hide: true }), 200);
  // 쓸 수 없는 판: 가린 수가 한 수로 어림되지 않거나(10□을 몇십으로), 어림한 수가 범위 안이거나(30□ → 300), 곱하기에 가린 수
  assert.notEqual(checkSide(side('+', [100, 10, true], [200, 100])), null);
  assert.notEqual(checkSide(side('+', [300, 100, true], [200, 100])), null);
  assert.notEqual(checkSide(side('×', [40, 10, true], [21, 10])), null);
  assert.notEqual(checkSide(side('-', [198, 100], [302, 100])), null);
  assert.notEqual(checkSide(side('-', [198, 100], [302, 100], [5, 1])), null);
});

const pick = ({ answer, by, est, low, high }) => ({ answer, by, est, low, high });
