// 조각 덮기의 사다리와 판 만들어 내기 점검. 낸 판은 풀이 프로그램으로 다시 확인하고,
// 단계마다 되는 판과 안 되는 판이 어떻게 섞이는지, 판 하나를 만드는 데 얼마나 걸리는지를 잰다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  BAR_POSSIBLE_RATE,
  CANDIDATES,
  FOUR_FITTING,
  IMPOSSIBLE_RATE,
  LADDER,
  MAKE_LEVEL,
  OLD_MAKE_LEVEL,
  SMALL_SIZES,
  TOP_LEVEL,
  WALL_NO,
  WALL_YES,
  firstImpossibleSeed,
  fourSizes,
  generateBoard,
  nextSeed,
  possibleHoles,
  rungOf,
} from '../src/core/tile-ladder.js';
import { FOUR_PIECES, checkBoard, colorOf, deadCells, faultLines, replay, solve, solveWall, xyOf } from '../src/core/tile.js';
import { bruteCover, bruteFillRate, bruteHasFault } from './helpers/brute-tile.js';

const playing = LADDER.filter((rung) => rung.mode !== 'make');
const SEEDS = 300;
const checker = (board, cell) => colorOf('checker', ...xyOf(board, cell));
const sizeOf = (board) => `${board.w}×${board.h}`;
const inSizes = (sizes, board) => sizes.some(([w, h]) => w === board.w && h === board.h);

test('사다리: 여덟 단계이고 표시는 기본·응용·응용·도전·응용·응용·도전·도전, 맨 위는 직접 만들기', () => {
  assert.deepEqual(LADDER.map((rung) => rung.level), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(LADDER.map((rung) => rung.tag), ['basic', 'applied', 'applied', 'challenge', 'applied', 'applied', 'challenge', 'challenge']);
  assert.deepEqual(LADDER.map((rung) => rung.mode), ['cover', 'either', 'either', 'either', 'pick', 'either', 'wall', 'make']);
  assert.deepEqual(playing.map((rung) => rung.piece), ['domino', 'domino', 'ell', 'bar', 'bar', undefined, 'domino']);
  assert.deepEqual(rungOf(6).pieces, FOUR_PIECES);
  assert.deepEqual(FOUR_FITTING, ['square', 'long', 'tee', 'bend']);
  assert.deepEqual(playing.map((rung) => rung.holes), [2, 2, 1, 1, 0, 0, 0]);
  // 1~4단계의 번호는 그대로이고, 직접 만들기는 5단계에서 8단계로 옮겼다(예전 번호는 OLD_MAKE_LEVEL로 받는다).
  assert.deepEqual([TOP_LEVEL, MAKE_LEVEL, OLD_MAKE_LEVEL], [7, 8, 5]);
  assert.equal(IMPOSSIBLE_RATE, 1 / 3);
  assert.equal(BAR_POSSIBLE_RATE, 1 / 3);
  assert.throws(() => rungOf(9));
  assert.throws(() => generateBoard(MAKE_LEVEL, 1));
});

test('단계마다의 크기: 1단계는 작은 판, 2단계는 4×4부터 6×6까지(5×5는 없다), 3·4단계는 정사각형 4, 5, 7, 8', () => {
  const sizes = (level) => rungOf(level).sizes.map((size) => size.join('×'));
  assert.deepEqual(sizes(1), ['4×4', '5×4', '4×5']);
  assert.deepEqual(sizes(2), ['4×4', '5×4', '4×5', '6×4', '4×6', '6×5', '5×6', '6×6']);
  assert.deepEqual(sizes(3), ['4×4', '5×5', '7×7', '8×8']);
  assert.deepEqual(sizes(4), ['4×4', '5×5', '7×7', '8×8']);
  assert.deepEqual(sizes(5), ['4×4', '5×5', '7×7', '8×8']);
  // 6단계: 가로·세로 4~8칸에서 칸이 4의 배수인 판(칸 수만으로 갈리는 판은 내지 않는다). 7단계: 칸이 짝수인 판
  for (const [w, h] of rungOf(6).sizes) assert.ok(w >= 4 && h >= 4 && (w * h) % 4 === 0, `6단계 ${w}×${h}`);
  for (const [w, h] of rungOf(7).sizes) assert.equal((w * h) % 2, 0, `7단계 ${w}×${h}`);
  assert.deepEqual(rungOf(7).sizes, [...WALL_YES, ...WALL_NO]);
  // 도미노 판은 칸이 짝수 개여야 두 칸을 빼고도 덮을 수 있다.
  for (const level of [1, 2]) for (const [w, h] of rungOf(level).sizes) assert.equal((w * h) % 2, 0, `${level}단계 ${w}×${h}`);
  for (const [w, h] of SMALL_SIZES) assert.ok(w * h < 16 && (w * h) % 2 === 0);
  // 세 칸 조각의 판은 한 칸을 빼고 남은 칸이 3으로 나누어떨어져야 한다.
  for (const level of [3, 4, 5]) for (const [w, h] of rungOf(level).sizes) assert.equal((w * h - 1) % 3, 0, `${level}단계 ${w}×${h}`);
});

test('같은 번호는 늘 같은 판이고, 낸 판은 풀이 프로그램으로 다시 풀어도 같다', () => {
  for (const rung of playing) {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const made = generateBoard(rung.level, seed);
      const where = `${rung.level}단계 ${seed}번`;
      if (seed <= 40) assert.deepEqual(made, generateBoard(rung.level, seed), where);
      assert.deepEqual([made.level, made.seed, made.small], [rung.level, seed, false], where);
      assert.equal(checkBoard(made.board), null, where);
      if (rung.pieces) assert.ok(rung.pieces.includes(made.board.piece), where);
      else assert.equal(made.board.piece, rung.piece, where);
      assert.equal(made.board.holes.length, rung.holes, where);
      assert.ok(inSizes(rung.sizes, made.board), `${where}: ${sizeOf(made.board)}`);
      // 되는 자리 고르기: 늘 된다. 되는 자리는 풀이 프로그램이 구한 것이고, 덮는 방법은 맨 앞 자리를 뺀 판의 것이다.
      if (rung.mode === 'pick') {
        assert.equal(made.solution.possible, true, where);
        assert.deepEqual(made.solution.good, possibleHoles('bar', made.board.w, made.board.h), where);
        const played = replay({ ...made.board, holes: [made.solution.good[0]] }, made.solution.tiling.map((cells) => ({ op: 'place', cells })));
        assert.ok(played.ok && played.left === 0, where);
        continue;
      }
      // 금 없는 벽: 된다고 한 판에는 금이 없는 벽이 붙어 있다.
      if (rung.mode === 'wall') {
        assert.equal(made.solution.possible, solveWall(made.board).possible, where);
        if (made.solution.possible) {
          const played = replay(made.board, made.solution.tiling.map((cells) => ({ op: 'place', cells })));
          assert.ok(played.ok && played.left === 0, where);
          assert.deepEqual(faultLines(made.board, made.solution.tiling), [], where);
        } else assert.equal(made.solution.tiling, null, where);
        continue;
      }
      // 빠른 걸러내기를 끄고 끝까지 따져도 같은 답이 나온다.
      const full = solve(made.board, { filters: false });
      assert.equal(made.solution.possible, full.possible, where);
      assert.notEqual(made.solution.possible, null, where);
      if (made.solution.possible) {
        // 된다고 한 판에는 덮는 방법이 실제로 붙어 있다.
        const played = replay(made.board, made.solution.tiling.map((cells) => ({ op: 'place', cells })));
        assert.ok(played.ok && played.left === 0, where);
      } else assert.equal(made.solution.tiling, null, where);
    }
  }
});

test('1단계: 색이 다른 두 칸을 뺀 작은 판. 늘 되고, 아무렇게나 놓아도 덮이기 쉬운 판을 고른다', (t) => {
  const rates = [];
  const sizes = {};
  for (let seed = 1; seed <= SEEDS; seed++) {
    const made = generateBoard(1, seed);
    const [a, b] = made.board.holes;
    assert.equal(made.solution.possible, true, `${seed}번`);
    assert.notEqual(checker(made.board, a), checker(made.board, b), `${seed}번: 색이 다른 두 칸`);
    assert.ok(made.rate > 0 && made.rate <= 1, `${seed}번`);
    rates.push(made.rate);
    sizes[sizeOf(made.board)] = (sizes[sizeOf(made.board)] ?? 0) + 1;
  }
  // 맨 처음 판은 가장 작은 판(4×4)이다.
  assert.equal(sizeOf(generateBoard(1, 1).board), '4×4');
  const mean = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
  // 후보 가운데 비율이 가장 높은 판을 고르므로, 아무 판이나 뽑을 때의 가운데 값(4×4는 23%, 5×4는 15%)보다 높다.
  assert.ok(mean > 0.25, `평균 ${mean}`);
  assert.equal(CANDIDATES[1], 6);
  // 맨 처음 판의 비율을 모든 갈림을 따져 다시 잰다: 4×4의 가운데 값(22.7%)보다 높다.
  const first = bruteFillRate(generateBoard(1, 1).board);
  assert.ok(first > 0.3, `맨 처음 판 ${first}`);
  rates.sort((x, y) => x - y);
  t.diagnostic(`1단계 판 ${SEEDS}개: 되는 판 ${SEEDS}, 안 되는 판 0. 크기 ${JSON.stringify(sizes)}`);
  t.diagnostic(`  아무렇게나 놓았을 때 덮이는 비율(고를 때 120번 해 본 값): 가장 낮은 ${rates[0].toFixed(2)}, 가운데 ${rates[SEEDS >> 1].toFixed(2)}, 가장 높은 ${rates.at(-1).toFixed(2)}, 평균 ${mean.toFixed(2)}. 맨 처음 판은 모든 갈림을 따져 ${(first * 100).toFixed(1)}%`);
});

test('작은 판부터(수준 맞추기): 1단계에서 더 작은 판을 낸다', (t) => {
  const rates = [];
  for (let seed = 1; seed <= 60; seed++) {
    const made = generateBoard(1, seed, { small: true });
    assert.equal(made.small, true);
    assert.ok(inSizes(SMALL_SIZES, made.board), sizeOf(made.board));
    assert.equal(made.solution.possible, true);
    assert.deepEqual(made, generateBoard(1, seed, { small: true }));
    rates.push(bruteFillRate(made.board));
  }
  const mean = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
  assert.ok(mean > 0.4, `평균 ${mean}`);
  t.diagnostic(`작은 판 60개(4×3, 3×4)의 덮이는 비율(모든 갈림을 따진 값): 가장 낮은 ${Math.min(...rates).toFixed(2)}, 평균 ${mean.toFixed(2)}, 가장 높은 ${Math.max(...rates).toFixed(2)}`);
  // 다른 단계에서는 작은 판을 따로 내지 않는다.
  assert.deepEqual(generateBoard(2, 5, { small: true }).board, generateBoard(2, 5).board);
});

test('2~4단계: 되는 판과 안 되는 판이 섞인다. 맨 처음 판은 되는 판이고, 맨 처음 만나는 안 되는 판은 가장 작은 판이다', (t) => {
  for (const level of [2, 3, 4]) {
    const rung = rungOf(level);
    const sizes = {};
    let possible = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const made = generateBoard(level, seed);
      const key = sizeOf(made.board);
      sizes[key] ??= [0, 0];
      sizes[key][made.solution.possible ? 0 : 1] += 1;
      if (made.solution.possible) possible += 1;
    }
    const impossible = SEEDS - possible;
    // 2·3단계는 안 되는 판이 셋에 하나쯤, 4단계는 되는 판이 셋에 하나쯤이다.
    const third = level === 4 ? possible : impossible;
    assert.ok(third > SEEDS * 0.26 && third < SEEDS * 0.4, `${level}단계: ${third}`);
    t.diagnostic(`${level}단계(${rung.piece}) 판 ${SEEDS}개: 되는 판 ${possible}, 안 되는 판 ${impossible}. 크기마다 [되는 판, 안 되는 판] ${JSON.stringify(sizes)}`);

    // 맨 처음 판은 가장 작은 되는 판이다.
    const first = generateBoard(level, 1);
    assert.equal(first.solution.possible, true, `${level}단계 1번`);
    assert.equal(sizeOf(first.board), '4×4', `${level}단계 1번`);

    // 맨 처음 만나는 안 되는 판
    const at = firstImpossibleSeed(level);
    assert.ok(at > 1 && at < 12, `${level}단계: ${at}번`);
    for (let seed = 1; seed < at; seed++) assert.equal(generateBoard(level, seed).solution.possible, true, `${level}단계 ${seed}번`);
    const hard = generateBoard(level, at);
    assert.equal(hard.solution.possible, false, `${level}단계 ${at}번`);
    if (level === 2) assert.deepEqual(hard.board, { w: 4, h: 4, piece: 'domino', holes: [0, 15] }, '마주 보는 두 구석을 뺀 4×4');
    if (level === 3) assert.equal(sizeOf(hard.board), '5×5', 'ㄱ자의 안 되는 판은 5×5뿐이다');
    if (level === 4) assert.equal(sizeOf(hard.board), '4×4');
  }
  assert.equal(firstImpossibleSeed(1), null);
});

test('5~7단계: 사다리가 낼 수 있는 모든 판의 답을 빠짐없는 덮기 찾기(풀이 프로그램과 다른 방법)로 다시 따진다', (t) => {
  // 5단계: 크기마다 모든 자리를 빼 보고 되는 자리를 다시 구한다.
  for (const [w, h] of rungOf(5).sizes) {
    const good = [];
    for (let hole = 0; hole < w * h; hole++) if (bruteCover({ w, h, piece: 'bar', holes: [hole] }).tiling) good.push(hole);
    assert.deepEqual(good, possibleHoles('bar', w, h), `5단계 ${w}×${h}`);
    t.diagnostic(`5단계 ${w}×${h}: 되는 자리 ${good.length}곳 [${good.join(', ')}]`);
  }
  // 6단계: 다섯 조각마다 모든 크기
  for (const piece of FOUR_PIECES) {
    for (const [w, h] of rungOf(6).sizes) {
      const board = { w, h, piece, holes: [] };
      assert.equal(bruteCover(board).tiling !== null, solve(board).possible, `6단계 ${piece} ${w}×${h}`);
    }
  }
  // 7단계: 되는 판은 금 없는 벽이 있고, 안 되는 판은 다 덮는 모든 방법에 금이 있다.
  for (const [w, h] of [...WALL_YES, ...WALL_NO]) {
    const board = { w, h, piece: 'domino', holes: [] };
    const brute = bruteCover(board, (tiling) => !bruteHasFault(board, tiling));
    assert.equal(brute.tiling !== null, WALL_YES.some(([a, b]) => a === w && b === h), `7단계 ${w}×${h}`);
    assert.equal(brute.tiling !== null, solveWall(board).possible, `7단계 ${w}×${h}`);
  }
  // 낸 판이 모두 이 크기들 가운데 하나다(위의 테스트). 6단계의 크기마다 되는 조각:
  for (const piece of FOUR_PIECES) t.diagnostic(`6단계 ${piece}: 되는 판 ${fourSizes(piece, true).map((size) => size.join('×')).join(', ') || '없음'} / 안 되는 판 ${fourSizes(piece, false).map((size) => size.join('×')).join(', ')}`);
});

test('6·7단계: 되는 판과 안 되는 판이 섞인다. 맨 처음 판은 가장 작은 되는 판이고, 맨 처음 만나는 안 되는 판은 가장 작은 판이다', (t) => {
  for (const level of [6, 7]) {
    const seen = { yes: new Set(), no: new Set() };
    let impossible = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const made = generateBoard(level, seed);
      if (!made.solution.possible) impossible += 1;
      seen[made.solution.possible ? 'yes' : 'no'].add(level === 6 ? made.board.piece : sizeOf(made.board));
      // 칸 수만으로 갈리는 판은 없다(6단계는 칸이 4의 배수, 7단계는 짝수).
      assert.equal((made.board.w * made.board.h) % (level === 6 ? 4 : 2), 0);
    }
    assert.ok(impossible > SEEDS * 0.26 && impossible < SEEDS * 0.4, `${level}단계: ${impossible}`);
    t.diagnostic(`${level}단계 판 ${SEEDS}개: 안 되는 판 ${impossible}. 되는 판 ${[...seen.yes].sort().join(', ')} / 안 되는 판 ${[...seen.no].sort().join(', ')}`);
    const at = firstImpossibleSeed(level);
    assert.ok(at > 1 && at < 12, `${level}단계: ${at}번`);
    for (let seed = 1; seed < at; seed++) assert.equal(generateBoard(level, seed).solution.possible, true, `${level}단계 ${seed}번`);
    const hard = generateBoard(level, at).board;
    if (level === 6) {
      // 번개는 어느 네모 판도 덮지 못한다. 맨 처음 만나는 안 되는 판은 번개 4×4다.
      assert.deepEqual(hard, { w: 4, h: 4, piece: 'zig', holes: [] });
      assert.deepEqual([...seen.yes].sort(), [...FOUR_FITTING].sort());
      assert.deepEqual([...seen.no].sort(), [...FOUR_PIECES].sort());
      assert.deepEqual(sizeOf(generateBoard(6, 1).board), '4×4');
    } else {
      assert.deepEqual(hard, { w: 4, h: 4, piece: 'domino', holes: [] });
      assert.deepEqual(generateBoard(7, 1).board, { w: 5, h: 6, piece: 'domino', holes: [] });
      assert.ok(seen.no.has('6×6'), '6×6도 나온다');
    }
  }
  // 5단계는 늘 되는 판이고 맨 처음 판은 4×4다.
  assert.equal(firstImpossibleSeed(5), null);
  assert.equal(sizeOf(generateBoard(5, 1).board), '4×4');
});

test('2단계: 되는 판은 색이 다른 두 칸을, 안 되는 판은 색이 같은 두 칸을 뺀 판이다. 안 되는 판에 처음부터 외딴 빈칸은 없다', (t) => {
  const rates = [];
  for (let seed = 1; seed <= SEEDS; seed++) {
    const made = generateBoard(2, seed);
    const [a, b] = made.board.holes;
    const where = `${seed}번 ${sizeOf(made.board)} [${a}, ${b}]`;
    assert.equal(checker(made.board, a) !== checker(made.board, b), made.solution.possible, where);
    if (made.solution.possible) {
      assert.ok(made.rate >= 0 && made.rate <= 1, where);
      rates.push(made.rate);
    } else {
      assert.equal(made.rate, null, where);
      assert.equal(made.solution.reason, 'color', where);
      // 해 보지 않아도 알 수 있는 판(처음부터 조각이 들어갈 수 없는 빈칸이 보이는 판)은 내지 않는다.
      assert.deepEqual(deadCells(made.board), [], where);
    }
  }
  assert.equal(CANDIDATES[2], 5);
  rates.sort((x, y) => x - y);
  t.diagnostic(`2단계 되는 판 ${rates.length}개의 덮이는 비율(고를 때 120번 해 본 값): 가장 낮은 ${rates[0].toFixed(2)}, 가운데 ${rates[rates.length >> 1].toFixed(2)}, 가장 높은 ${rates.at(-1).toFixed(2)}`);
});

test('3·4단계: 되는 자리는 풀이 프로그램이 그때그때 구한 것이고, 그 자리에서만 되는 판이 나온다', () => {
  // 풀이 프로그램이 구한 되는 자리의 수
  const counts = (piece) => [4, 5, 7, 8].map((n) => possibleHoles(piece, n, n).length);
  assert.deepEqual(counts('ell'), [16, 9, 49, 64]);
  assert.deepEqual(counts('bar'), [4, 1, 9, 4]);
  assert.deepEqual(possibleHoles('bar', 4, 4), [0, 3, 12, 15]);
  assert.deepEqual(possibleHoles('bar', 5, 5), [12]);
  assert.deepEqual(possibleHoles('bar', 8, 8), [18, 21, 42, 45]);
  assert.deepEqual(possibleHoles('ell', 5, 5), [0, 2, 4, 10, 12, 14, 20, 22, 24]);
  // 돌려준 목록을 고쳐도 다음에 구한 값은 그대로다.
  possibleHoles('bar', 4, 4).push(99);
  assert.deepEqual(possibleHoles('bar', 4, 4), [0, 3, 12, 15]);

  for (const level of [3, 4]) {
    const { piece } = rungOf(level);
    const seen = new Set();
    for (let seed = 1; seed <= SEEDS; seed++) {
      const { board, solution } = generateBoard(level, seed);
      const where = `${level}단계 ${seed}번 ${sizeOf(board)} [${board.holes}]`;
      assert.equal(board.w, board.h, where);
      assert.equal(possibleHoles(piece, board.w, board.h).includes(board.holes[0]), solution.possible, where);
      seen.add(`${sizeOf(board)}${solution.possible ? '되는 판' : '안 되는 판'}`);
    }
    // ㄱ자는 5×5에서만 안 되는 판이 나오고(되는 판도 나온다), 일자는 네 크기 모두에서 되는 판과 안 되는 판이 나온다.
    const expected = level === 3 ? ['4×4되는 판', '5×5되는 판', '5×5안 되는 판', '7×7되는 판', '8×8되는 판'] : ['4×4', '5×5', '7×7', '8×8'].flatMap((size) => [`${size}되는 판`, `${size}안 되는 판`]);
    assert.deepEqual([...seen].sort(), expected.sort(), `${level}단계`);
  }
});

test('"새 판"은 늘 다른 판이다', () => {
  for (const rung of playing) {
    for (let seed = 1; seed <= 80; seed++) {
      const next = nextSeed(rung.level, seed);
      assert.ok(next > seed, `${rung.level}단계 ${seed}번`);
      assert.notDeepEqual(generateBoard(rung.level, next).board, generateBoard(rung.level, seed).board, `${rung.level}단계 ${seed}번`);
    }
  }
  assert.ok(nextSeed(1, 3, { small: true }) > 3);
  assert.throws(() => nextSeed(MAKE_LEVEL, 1));
});

test('판 하나를 만드는 데 걸리는 시간: 0.2초에 한참 못 미친다', (t) => {
  for (const rung of playing) {
    let slowest = 0;
    let total = 0;
    for (let seed = 301; seed <= 500; seed++) {
      const begin = process.hrtime.bigint();
      generateBoard(rung.level, seed);
      const took = Number(process.hrtime.bigint() - begin) / 1e6;
      slowest = Math.max(slowest, took);
      total += took;
    }
    assert.ok(slowest < 200, `${rung.level}단계: ${slowest}ms`);
    t.diagnostic(`${rung.level}단계 판 200개를 만드는 데: 평균 ${(total / 200).toFixed(2)}ms, 가장 오래 걸린 판 ${slowest.toFixed(1)}ms`);
  }
});
