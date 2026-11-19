// 조각 못 들어가게 막기의 규칙과 풀이 프로그램 점검.
// 풀이 프로그램의 결과는 다른 방법들과 견준다: 조각의 모양은 손으로 그린 것과 견주고,
// 가장 적게 막는 수는 작은 판에서 막을 칸의 묶음을 하나하나 다 해 보고(칸 20개 이하), 큰 판에서는 위 줄부터 한 줄씩 정해 가며 센다.
// 책에 실린 값은 쓰지 않는다. 아래에 적은 수는 모두 이 풀이 프로그램으로 구하고 다른 방법으로 다시 구한 것이다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MAX_SIZE,
  MIN_SIZE,
  PIECES,
  PIECE_IDS,
  SOLVE_LIMIT,
  allPlacements,
  checkBoard,
  greedyBlock,
  orientationsOf,
  placementsOf,
  replay,
  solve,
  spareCells,
} from '../src/core/block.js';
import { createRng, randInt } from '../src/core/rng.js';
import { DRAWN, bruteBlock, bruteSpots, disjointSpots, rowBlock } from './helpers/brute-block.js';

const plain = (piece, w, h) => ({ w, h, piece, holes: [] });
const blocksAll = (board, blocked) => placementsOf(board, blocked).length === 0;
const key = (spots) => spots.map((spot) => spot.join(',')).sort().join(' ');

/**
 * 정사각형 판(3×3부터 6×6까지)에서 가장 적게 막는 칸 수. 풀이 프로그램으로 구해 적어 둔 값이고, 아래 테스트가 다른 방법으로 다시 구해 견준다.
 * 일자 네 칸은 3×3에 들어가지 않는다(0).
 */
const SQUARES = {
  domino: [4, 8, 12, 18],
  bar: [3, 5, 8, 12],
  ell: [3, 8, 10, 18],
  square: [1, 4, 4, 9],
  long: [0, 4, 6, 8],
  tee: [1, 4, 7, 10],
  bend: [3, 5, 8, 12],
  zig: [1, 4, 4, 9],
};

test('조각: 여덟 가지. 돌리고 뒤집은 모양은 손으로 그린 것과 같다', () => {
  assert.deepEqual(PIECE_IDS, ['domino', 'bar', 'ell', 'square', 'long', 'tee', 'bend', 'zig']);
  assert.deepEqual(Object.keys(PIECES), PIECE_IDS);
  assert.deepEqual([MIN_SIZE, MAX_SIZE], [2, 8]);
  // 모양의 수: 도미노 2, 일자 세 칸 2, ㄱ자 세 칸 4, 네모 1, 일자 네 칸 2, ㅗ자 4, ㄱ자 네 칸 8, 번개 4
  assert.deepEqual(PIECE_IDS.map((piece) => orientationsOf(piece).length), [2, 2, 4, 1, 2, 4, 8, 4]);
  for (const piece of PIECE_IDS) {
    const drawn = DRAWN[piece].map((picture) => {
      const cells = [];
      picture.split('/').forEach((row, y) => [...row].forEach((mark, x) => mark === '#' && cells.push([x, y])));
      return cells.sort((p, q) => p[1] - q[1] || p[0] - q[0]).join(' ');
    });
    assert.deepEqual(orientationsOf(piece).map((cells) => cells.join(' ')).sort(), drawn.sort(), piece);
    for (const shape of orientationsOf(piece)) assert.equal(shape.length, PIECES[piece], piece);
  }
});

test('조각이 들어갈 자리: 손으로 그린 모양으로 찾은 것과 같다(빠진 칸이 있는 판도)', () => {
  const rng = createRng(20261119);
  for (const piece of PIECE_IDS) {
    for (let w = MIN_SIZE; w <= 6; w++) {
      for (let h = MIN_SIZE; h <= 6; h++) {
        const board = plain(piece, w, h);
        assert.equal(key(allPlacements(board)), key(bruteSpots(board)), `${piece} ${w}×${h}`);
        const holes = [...new Set(Array.from({ length: randInt(rng, 1, 4) }, () => randInt(rng, 0, w * h - 1)))].sort((a, b) => a - b);
        if (holes.length >= w * h) continue;
        const holed = { ...board, holes };
        assert.equal(key(allPlacements(holed)), key(bruteSpots(holed)), `${piece} ${w}×${h} 빠진 칸 ${holes}`);
      }
    }
  }
  // 3×3 판의 도미노 자리는 12군데다(가로 6, 세로 6).
  assert.equal(allPlacements(plain('domino', 3, 3)).length, 12);
  // 자리는 칸 번호 차례로 줄 서 있다: 맨 앞은 맨 위 왼쪽의 자리다.
  assert.deepEqual(allPlacements(plain('domino', 3, 3))[0], [0, 1]);
});

test('판 확인: 크기는 2~8칸, 조각은 여덟 가운데 하나, 빠진 칸은 작은 것부터', () => {
  assert.equal(checkBoard(plain('domino', 3, 3)), null);
  assert.equal(checkBoard(plain('zig', 8, 8)), null);
  assert.equal(checkBoard({ w: 3, h: 3, piece: 'tee', holes: [0, 4] }), null);
  assert.equal(checkBoard(plain('domino', 1, 3)), 'bad-size');
  assert.equal(checkBoard(plain('domino', 9, 3)), 'bad-size');
  assert.equal(checkBoard(plain('star', 3, 3)), 'bad-piece');
  assert.equal(checkBoard({ w: 3, h: 3, piece: 'bar', holes: [4, 2] }), 'bad-holes');
  assert.equal(checkBoard({ w: 3, h: 3, piece: 'bar', holes: [9] }), 'bad-holes');
  assert.equal(checkBoard({ w: 2, h: 2, piece: 'bar', holes: [0, 1, 2, 3] }), 'no-cells');
  assert.equal(checkBoard({ w: 3, h: 3, piece: 'bar' }), 'bad-holes');
  assert.equal(checkBoard(null), 'no-board');
});

test('누른 차례를 따라간다: 누르면 막히고 다시 누르면 열린다. 빠진 칸이나 판 밖은 누를 수 없다', () => {
  const board = plain('domino', 3, 3);
  assert.deepEqual(replay(board, []), { ok: true, blocked: [], count: 0, left: 12, shut: false });
  assert.deepEqual(replay(board, [4]).left, 8);
  assert.deepEqual(replay(board, [4, 4]), { ok: true, blocked: [], count: 0, left: 12, shut: false });
  const best = replay(board, [7, 1, 3, 5]);
  assert.deepEqual(best, { ok: true, blocked: [1, 3, 5, 7], count: 4, left: 0, shut: true });
  assert.equal(replay(board, [9]).ok, false);
  assert.equal(replay(board, [-1]).ok, false);
  assert.equal(replay(board, [1.5]).ok, false);
  assert.equal(replay(board, 'x').ok, false);
  assert.equal(replay({ ...board, holes: [4] }, [4]).ok, false, '빠진 칸');
  // 맞는 데까지만 간다.
  assert.deepEqual(replay(board, [1, 9, 3]).blocked, [1]);
  // 쓸데없는 칸: 다시 열어도 조각이 들어갈 자리가 생기지 않는 막은 칸
  assert.deepEqual(spareCells(board, [0, 1, 3, 5, 7]), [0]);
  assert.deepEqual(spareCells(board, [1, 3, 5, 7]), []);
});

test('"자리가 가장 많이 지나는 칸부터 막기"는 3×3 도미노에서 가운데와 네 구석, 다섯 칸을 막는다', () => {
  assert.deepEqual(greedyBlock(plain('domino', 3, 3)), [4, 0, 2, 6, 8]);
  assert.ok(blocksAll(plain('domino', 3, 3), greedyBlock(plain('domino', 3, 3))));
  // 어떤 판에서도 그렇게 막으면 조각이 들어갈 자리가 없어진다.
  for (const piece of PIECE_IDS) for (const n of [3, 4, 5]) assert.ok(blocksAll(plain(piece, n, n), greedyBlock(plain(piece, n, n))), `${piece} ${n}`);
});

test('풀이 프로그램과 다른 방법(막을 칸의 묶음을 적은 것부터 다 해 보기)이 같다: 칸이 20개 이하인 모든 네모 판과 빠진 칸이 있는 판', (t) => {
  let boards = 0;
  for (const piece of PIECE_IDS) {
    for (let w = MIN_SIZE; w <= 6; w++) {
      for (let h = MIN_SIZE; h <= 6; h++) {
        if (w * h > 20) continue;
        const board = plain(piece, w, h);
        const solved = solve(board);
        const brute = bruteBlock(board);
        assert.equal(solved.exact, true, `${piece} ${w}×${h}`);
        assert.equal(solved.best, brute.best, `${piece} ${w}×${h}`);
        assert.equal(solved.blocked.length, solved.best);
        assert.ok(blocksAll(board, solved.blocked), `${piece} ${w}×${h}: 막은 칸이 다 막지 못해요`);
        boards += 1;
      }
    }
  }
  const rng = createRng(1119);
  for (let round = 0; round < 120; round++) {
    const piece = PIECE_IDS[randInt(rng, 0, PIECE_IDS.length - 1)];
    const w = randInt(rng, 2, 5);
    const h = randInt(rng, 2, Math.min(5, Math.floor(20 / w)));
    const holes = [...new Set(Array.from({ length: randInt(rng, 0, 4) }, () => randInt(rng, 0, w * h - 1)))].sort((a, b) => a - b);
    if (holes.length >= w * h) continue;
    const board = { w, h, piece, holes };
    const solved = solve(board);
    assert.equal(solved.best, bruteBlock(board).best, JSON.stringify(board));
    assert.ok(blocksAll(board, solved.blocked) && solved.blocked.every((cell) => !holes.includes(cell)), JSON.stringify(board));
    boards += 1;
  }
  t.diagnostic(`견준 판 ${boards}개`);
});

test('풀이 프로그램과 다른 방법(위 줄부터 한 줄씩 정해 가며 세기)이 같다: 6×6까지의 네모 판과 빠진 칸이 있는 판', () => {
  for (const piece of PIECE_IDS) {
    for (let w = MIN_SIZE; w <= 6; w++) {
      for (let h = MIN_SIZE; h <= 6; h++) {
        if (w * h <= 20) continue;
        // 일자 네 칸은 키가 4라서 가로 6칸이면 따질 것이 너무 많다. 그런 판은 가로와 세로를 바꿔 센다(같은 판을 돌린 것이다).
        if (piece === 'long' && w === 6 && h === 6) continue;
        const board = plain(piece, w, h);
        const counted = piece === 'long' && w === 6 ? rowBlock(plain(piece, h, w)) : rowBlock(board);
        const solved = solve(board);
        assert.equal(solved.exact, true, `${piece} ${w}×${h}`);
        assert.equal(solved.best, counted, `${piece} ${w}×${h}`);
        assert.ok(blocksAll(board, solved.blocked), `${piece} ${w}×${h}`);
      }
    }
  }
  const rng = createRng(611);
  for (let round = 0; round < 40; round++) {
    const piece = PIECE_IDS[randInt(rng, 0, PIECE_IDS.length - 1)];
    const w = randInt(rng, 4, 5);
    const h = randInt(rng, 4, 6);
    const holes = [...new Set(Array.from({ length: randInt(rng, 1, 5) }, () => randInt(rng, 0, w * h - 1)))].sort((a, b) => a - b);
    const board = { w, h, piece, holes };
    assert.equal(solve(board).best, rowBlock(board), JSON.stringify(board));
  }
});

test('정사각형 판에서 가장 적게 막는 칸 수(3×3~6×6)', (t) => {
  const lines = [];
  for (const piece of PIECE_IDS) {
    const found = [3, 4, 5, 6].map((n) => solve(plain(piece, n, n)).best);
    assert.deepEqual(found, SQUARES[piece], piece);
    lines.push(`${piece}: ${found.join(', ')}`);
  }
  // 6×6의 일자 네 칸은 다른 방법으로 따로 확인한다: 서로 겹치지 않는 자리 여덟 군데(그러니 여덟 칸보다 적게는 안 된다)와 여덟 칸으로 막는 방법.
  const long = plain('long', 6, 6);
  const spots = disjointSpots(long, 8);
  assert.ok(spots, '겹치지 않는 자리 여덟 군데');
  assert.equal(new Set(spots.flat()).size, 32);
  const solved = solve(long);
  assert.equal(solved.best, 8);
  assert.ok(blocksAll(long, solved.blocked));
  t.diagnostic(`n이 3, 4, 5, 6일 때\n${lines.join('\n')}`);
});

test('도미노는 늘 칸의 절반쯤을 막아야 한다(바둑판의 한 색). 네모 네 칸은 두 칸 걸러 하나씩이면 된다', () => {
  for (let w = MIN_SIZE; w <= 7; w++) {
    for (let h = MIN_SIZE; h <= 7; h++) {
      assert.equal(solve(plain('domino', w, h)).best, Math.floor((w * h) / 2), `${w}×${h}`);
      assert.equal(solve(plain('square', w, h)).best, Math.floor(w / 2) * Math.floor(h / 2), `${w}×${h}`);
    }
  }
});

test('풀이 프로그램은 7×7까지의 모든 판을 끝까지 따진다. 같은 판은 늘 같은 답이다', (t) => {
  let most = { nodes: 0 };
  for (const piece of PIECE_IDS) {
    for (let w = MIN_SIZE; w <= 7; w++) {
      for (let h = MIN_SIZE; h <= 7; h++) {
        const board = plain(piece, w, h);
        const solved = solve(board);
        assert.equal(solved.exact, true, `${piece} ${w}×${h}`);
        assert.ok(blocksAll(board, solved.blocked), `${piece} ${w}×${h}`);
        if (solved.nodes > most.nodes) most = { ...solved, piece, w, h };
      }
    }
  }
  assert.deepEqual(solve(plain('tee', 6, 6)), solve(plain('tee', 6, 6)));
  t.diagnostic(`가장 많이 따진 판: ${most.piece} ${most.w}×${most.h}, ${most.nodes}갈래(위 끝 ${SOLVE_LIMIT})`);
});

test('끝까지 못 따지면 사실대로 알린다: exact가 false이고, 내놓는 막기는 실제로 다 막는다', (t) => {
  const board = plain('ell', 6, 6);
  const cut = solve(board, { limit: 10 });
  assert.equal(cut.exact, false);
  assert.ok(blocksAll(board, cut.blocked));
  assert.equal(cut.blocked.length, cut.best);
  assert.ok(cut.best >= SQUARES.ell[3]);
  // 직접 만들 수 있는 가장 큰 판 가운데 위 끝 안에서 끝까지 못 따지는 판이 있다. 시간은 위 끝 덕에 짧다.
  const unknown = [];
  for (const piece of PIECE_IDS) {
    const before = performance.now();
    const solved = solve(plain(piece, 8, 8));
    const spent = performance.now() - before;
    assert.ok(spent < 1500, `${piece} 8×8: ${spent}ms`);
    assert.ok(blocksAll(plain(piece, 8, 8), solved.blocked), piece);
    if (!solved.exact) unknown.push(`${piece}(찾은 것 ${solved.best}칸)`);
  }
  assert.ok(unknown.length > 0);
  t.diagnostic(`8×8에서 끝까지 못 따지는 조각: ${unknown.join(', ')}`);
  // 조각이 처음부터 들어가지 않는 판: 막을 칸이 없다.
  assert.deepEqual(solve(plain('long', 3, 3)), { exact: true, best: 0, blocked: [], spots: 0, nodes: 0 });
});
