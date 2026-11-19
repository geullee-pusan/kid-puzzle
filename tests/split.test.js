// 똑같이 섞이게 자르기의 풀이 프로그램 점검: 자르는 모든 방법, 씨앗으로 자르기, 섞인 꼴 견주기, 안 되는 까닭.
// 자르는 방법은 칸 채우기로 판을 네모 조각으로 나누는 다른 방법(tests/helpers/brute-split.js)과 견준다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createRng, randInt } from '../src/core/rng.js';
import { MAX_SIZE, MIN_SIZE, allLayouts, applyCuts, checkBoard, countIn, cutDone, evenLines, gcd, layoutKey, mixOf, onCut, pieceCounts, sameMix, seedOk, seedsFor, solve } from '../src/core/split.js';
import { bruteCount, brutePartitions, bruteSolve } from './helpers/brute-split.js';

const keyOf = (pieces) => layoutKey(pieces);
const choose2 = (n) => (n * (n - 1)) / 2;

/** 회색 칸 count개를 시드 난수로 칠한 판 */
function randomBoard(rng, w, h, count, parts) {
  const cells = Array.from({ length: w * h }, (_, cell) => cell);
  for (let index = cells.length - 1; index > 0; index--) {
    const other = randInt(rng, 0, index);
    [cells[index], cells[other]] = [cells[other], cells[index]];
  }
  return { w, h, grey: cells.slice(0, count).sort((a, b) => a - b), parts };
}

test('자르는 모든 방법이 칸 채우기로 센 네모 나누기와 같다(가로·세로 2~6의 모든 판, 8×4·8×6·8×8의 세 조각과 네 조각)', () => {
  const sizes = [];
  for (let w = MIN_SIZE; w <= 6; w++) for (let h = MIN_SIZE; h <= 6; h++) sizes.push([w, h]);
  sizes.push([8, 4], [8, 6], [8, 8]);
  for (const [w, h] of sizes) {
    for (const parts of [3, 4]) {
      const mine = allLayouts(w, h, parts).map(keyOf).sort();
      assert.equal(new Set(mine).size, mine.length, `${w}×${h} ${parts}: 같은 자르기가 두 번 있어요`);
      assert.deepEqual(mine, brutePartitions(w, h, parts).sort(), `${w}×${h} ${parts}조각`);
    }
  }
});

test('세 조각으로 자르는 방법의 수: 나란한 두 선과, 끝에서 끝까지 한 선 뒤에 한쪽을 가로지르는 선', () => {
  for (let w = MIN_SIZE; w <= MAX_SIZE; w++) {
    for (let h = MIN_SIZE; h <= MAX_SIZE; h++) {
      assert.equal(allLayouts(w, h, 3).length, choose2(w - 1) + choose2(h - 1) + 4 * (w - 1) * (h - 1), `${w}×${h}`);
    }
  }
  assert.deepEqual([[6, 3], [6, 4], [8, 6]].map(([w, h]) => allLayouts(w, h, 3).length), [51, 73, 171]);
  assert.deepEqual([[6, 4], [6, 6], [8, 6], [8, 8]].map(([w, h]) => allLayouts(w, h, 4).length), [521, 1145, 2005, 3353]);
});

test('풀이 프로그램이 찾은 되는 자르기가 칸을 하나씩 센 다른 방법과 같다(시드 난수 판 900개)', () => {
  const rng = createRng(20261120);
  const sizes = [[4, 3], [6, 3], [6, 4], [4, 4], [5, 4], [6, 6], [8, 4]];
  for (let round = 0; round < 900; round++) {
    const [w, h] = sizes[round % sizes.length];
    const parts = round % 3 === 0 ? 4 : 3;
    const area = w * h;
    // 반쯤은 묶음이 넉넉한 판(같은 꼴이 자주 나온다), 반쯤은 아무 수
    const count = round % 2 === 0 ? [area / 2, area / 3, area / 4].filter(Number.isInteger)[round % 3] ?? Math.floor(area / 2) : randInt(rng, 1, area - 1);
    const board = randomBoard(rng, w, h, count, parts);
    const result = solve(board);
    const brute = bruteSolve(board);
    assert.deepEqual(result.layouts.map(keyOf).sort(), brute, JSON.stringify(board));
    assert.equal(result.possible, brute.length > 0);
    assert.equal(result.count, brute.length);
    for (const pieces of result.layouts) for (const rect of pieces) assert.deepEqual(countIn(board, rect), bruteCount(board, [rect.x, rect.y, rect.w, rect.h]));
  }
});

test('두 조각이 판 전체와 똑같이 섞이면 셋째 조각도 똑같이 섞인다(모든 세 조각 자르기, 시드 난수 판 200개)', () => {
  const rng = createRng(7);
  for (let round = 0; round < 200; round++) {
    const board = randomBoard(rng, 6, 4, [6, 8, 12][round % 3], 3);
    const mix = mixOf(board);
    for (const pieces of allLayouts(6, 4, 3)) {
      const even = pieces.map((rect) => sameMix(mix, countIn(board, rect)));
      if (even.filter(Boolean).length >= 2) assert.deepEqual(even, [true, true, true]);
    }
  }
});

test('안 되는 까닭: 묶음이 조각 수보다 적으면 늘 안 되고, 되는 판에는 두 쪽을 똑같이 나누는 끝에서 끝까지의 선이 꼭 있다', () => {
  const rng = createRng(99);
  const seen = { groups: 0, edge: 0, search: 0, possible: 0 };
  for (let round = 0; round < 1500; round++) {
    const [w, h] = [[6, 3], [6, 4], [4, 4], [6, 6]][round % 4];
    const parts = round % 5 === 0 ? 4 : 3;
    const board = randomBoard(rng, w, h, randInt(rng, 1, w * h - 1), parts);
    const result = solve(board);
    const mix = mixOf(board);
    assert.equal(mix.groups, gcd(mix.grey, mix.white));
    if (mix.groups < parts) assert.equal(result.possible, false);
    if (result.possible) {
      assert.ok(result.lines.length > 0, JSON.stringify(board));
      // 되는 자르기마다 첫 선(끝에서 끝까지)은 짚은 선 가운데 하나다
      for (const pieces of result.layouts) {
        const first = seedsFor(pieces)[0];
        assert.ok(result.lines.some((line) => line.d === first.d && line.at === first.at));
      }
    }
    // 짚은 선은 칸을 세어 다시 구한 것과 같다
    const [G, W] = bruteCount(board, [0, 0, w, h]);
    const lines = [];
    for (let at = 1; at < w; at++) {
      const [g, white] = bruteCount(board, [0, 0, at, h]);
      if (g * W === white * G) lines.push({ d: 'v', at });
    }
    for (let at = 1; at < h; at++) {
      const [g, white] = bruteCount(board, [0, 0, w, at]);
      if (g * W === white * G) lines.push({ d: 'h', at });
    }
    assert.deepEqual(evenLines(board), lines);
    seen[result.possible ? 'possible' : result.reason] += 1;
    if (!result.possible) {
      const want = mix.groups < parts ? 'groups' : lines.length === 0 ? 'edge' : 'search';
      assert.equal(result.reason, want);
    } else assert.equal(result.reason, null);
  }
  for (const key of Object.keys(seen)) assert.ok(seen[key] > 0, `${key}인 판이 하나도 없었어요`);
});

test('씨앗으로 자르기: 선 k개는 조각 k + 1개를 만들고, 조각들은 판을 빈틈없이 한 번씩 덮는다', () => {
  const board = { w: 6, h: 4, grey: [0, 5, 9, 14, 19, 22], parts: 4 };
  const rng = createRng(5);
  for (let round = 0; round < 300; round++) {
    const seeds = [];
    for (let k = 0; k < 4; k++) {
      const d = rng() < 0.5 ? 'v' : 'h';
      seeds.push(d === 'v' ? { d, at: randInt(rng, 1, 5), i: randInt(rng, 0, 3) } : { d, at: randInt(rng, 1, 3), i: randInt(rng, 0, 5) });
    }
    const { pieces, cuts, seeds: used } = applyCuts(board, seeds);
    assert.equal(pieces.length, used.length + 1);
    assert.equal(cuts.length, used.length);
    const cover = new Array(24).fill(0);
    for (const rect of pieces) for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) cover[y * 6 + x] += 1;
    assert.ok(cover.every((value) => value === 1));
    // 쓰인 씨앗만 다시 놓아도 같은 조각이다
    assert.equal(keyOf(applyCuts(board, used).pieces), keyOf(pieces));
    // 자른 선 위의 금은 자른 선으로 알아본다
    for (const cut of cuts) assert.ok(onCut(cuts, cut.seed));
  }
  // 먼저 자른 선에 닿으면 멈추고, 그 선을 지우면 끝까지 이어진다
  const t = applyCuts(board, [{ d: 'v', at: 3, i: 0 }, { d: 'h', at: 2, i: 5 }]);
  assert.deepEqual(t.cuts.map(({ x1, y1, x2, y2 }) => [x1, y1, x2, y2]), [[3, 0, 3, 4], [3, 2, 6, 2]]);
  assert.deepEqual(applyCuts(board, [{ d: 'h', at: 2, i: 5 }]).cuts.map(({ x1, y1, x2, y2 }) => [x1, y1, x2, y2]), [[0, 2, 6, 2]]);
  // 이미 자른 금 위의 씨앗과 판 밖의 씨앗은 아무 일도 하지 않는다
  assert.equal(applyCuts(board, [{ d: 'v', at: 3, i: 0 }, { d: 'v', at: 3, i: 2 }]).pieces.length, 2);
  assert.equal(seedOk(board, { d: 'v', at: 6, i: 0 }), false);
  assert.equal(seedOk(board, { d: 'h', at: 0, i: 0 }), false);
  assert.equal(applyCuts(board, [{ d: 'v', at: 9, i: 0 }]).pieces.length, 1);
});

test('자르기마다 씨앗을 거꾸로 찾아 다시 자르면 같은 조각이 된다', () => {
  for (const [w, h, parts] of [[6, 3, 3], [4, 4, 3], [6, 4, 4], [5, 5, 4]]) {
    const board = { w, h, grey: [0], parts };
    for (const pieces of allLayouts(w, h, parts)) {
      const seeds = seedsFor(pieces);
      assert.equal(seeds.length, parts - 1);
      assert.equal(keyOf(applyCuts(board, seeds).pieces), keyOf(pieces));
    }
  }
});

test('판 점검과 조각 수 세기', () => {
  assert.equal(checkBoard({ w: 6, h: 3, grey: [0, 4], parts: 3 }), null);
  assert.notEqual(checkBoard({ w: 6, h: 3, grey: [], parts: 3 }), null);
  assert.equal(checkBoard({ w: 6, h: 3, grey: [], parts: 3 }, { open: true }), null);
  assert.notEqual(checkBoard({ w: 1, h: 3, grey: [0], parts: 3 }), null);
  assert.notEqual(checkBoard({ w: 9, h: 3, grey: [0], parts: 3 }), null);
  assert.notEqual(checkBoard({ w: 6, h: 3, grey: [4, 0], parts: 3 }), null);
  assert.notEqual(checkBoard({ w: 6, h: 3, grey: [0, 18], parts: 3 }), null);
  assert.notEqual(checkBoard({ w: 6, h: 3, grey: [0], parts: 5 }), null);
  assert.notEqual(checkBoard(null), null);
  const board = { w: 6, h: 3, grey: [0, 1, 3, 4, 8, 12, 14, 16, 17], parts: 3 };
  const strips = applyCuts(board, [{ d: 'v', at: 2, i: 0 }, { d: 'v', at: 4, i: 0 }]).pieces;
  assert.deepEqual(pieceCounts(board, strips).map((item) => item.counts), [[3, 3], [3, 3], [3, 3]]);
  assert.equal(cutDone(board, strips), true);
  assert.equal(cutDone(board, strips.slice(0, 2)), false);
  assert.deepEqual(mixOf(board), { grey: 9, white: 9, groups: 9, unitGrey: 1, unitWhite: 1 });
  assert.equal(sameMix({ grey: 8, white: 16 }, [3, 6]), true);
  assert.equal(sameMix({ grey: 8, white: 16 }, [3, 5]), false);
  assert.equal(sameMix({ grey: 8, white: 16 }, [0, 0]), false);
});
