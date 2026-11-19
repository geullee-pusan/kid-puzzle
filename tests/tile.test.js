// 조각 덮기의 판, 놓는 규칙, 풀이 프로그램 점검.
// 풀이 프로그램의 결과는 다른 방법(조각 자리의 모든 부분집합 따지기, 덮는 방법의 수 세기)으로 다시 구해 견준다.
// 이 형식이 기대는 사실(한 칸을 뺀 정사각형 판의 되는 자리, 색이 다른 두 칸을 빼면 늘 된다)도 여기서 모든 경우를 따져 확인한다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createRng, randInt } from '../src/core/rng.js';
import {
  FOUR_PIECES,
  MAX_SIZE,
  MIN_SIZE,
  PATTERNS,
  PATTERN_COLORS,
  PIECES,
  PIECE_IDS,
  SOLVE_LIMIT,
  checkBoard,
  colorCounts,
  colorOf,
  deadCells,
  diagnoseImpossible,
  emptyCells,
  faultLines,
  isDone,
  isStuck,
  placeProblem,
  placementsOf,
  quickReject,
  randomFillRate,
  replay,
  shapeOf,
  solve,
  solveWall,
  whyFits,
  whyOpen,
  xyOf,
} from '../src/core/tile.js';
import { FOUR_ORIENTATIONS, allSpots, bruteCount, bruteCover, bruteFillRate, bruteHasFault, bruteSubsets, loopOf } from './helpers/brute-tile.js';

/** 세 칸까지의 조각(처음 만든 세 조각). 네 칸 조각은 아래에서 따로 따진다 */
const THREE = ['domino', 'bar', 'ell'];

const board = (w, h, piece, holes = []) => ({ w, h, piece, holes });
const place = (cells) => ({ op: 'place', cells });
const remove = (cells) => ({ op: 'remove', cells });
const spot = (item, cell) => xyOf(item, cell).join(',');
const checker = (item, cell) => colorOf('checker', ...xyOf(item, cell));

/** 덮는 방법이라고 내놓은 것이 정말 빈칸을 모두, 겹치지 않게 덮는가 */
function assertTiling(item, tiling, where) {
  const played = replay(item, tiling.map(place));
  assert.equal(played.ok, true, `${where}: 놓을 수 없는 조각이 있어요`);
  assert.equal(played.left, 0, `${where}: 빈칸이 남았어요`);
  assert.equal(isDone(item, played.placed), true, where);
}

/** 가로·세로가 max 이하인 판에서 한 칸이나 두 칸을 뺀 모든 판 */
function* smallBoards(max) {
  for (let w = MIN_SIZE; w <= max; w++) {
    for (let h = MIN_SIZE; h <= max; h++) {
      for (let a = 0; a < w * h; a++) {
        yield [w, h, [a]];
        for (let b = a + 1; b < w * h; b++) yield [w, h, [a, b]];
      }
    }
  }
}

test('판의 규격: 크기 3~8, 조각 여덟 가지(네 칸 조각 다섯을 더했다), 빠진 칸은 작은 번호부터 겹치지 않게', () => {
  assert.equal(MIN_SIZE, 3);
  assert.equal(MAX_SIZE, 8);
  assert.deepEqual(PIECE_IDS, ['domino', 'bar', 'ell', 'square', 'long', 'tee', 'bend', 'zig']);
  assert.deepEqual(PIECES, { domino: 2, bar: 3, ell: 3, square: 4, long: 4, tee: 4, bend: 4, zig: 4 });
  assert.deepEqual(FOUR_PIECES, PIECE_IDS.slice(3));
  assert.equal(checkBoard(board(4, 5, 'tee', [])), null);
  assert.equal(checkBoard(board(4, 4, 'domino', [0, 15])), null);
  assert.equal(checkBoard(board(8, 3, 'ell', [])), null);
  assert.equal(checkBoard(null), 'no-board');
  assert.equal(checkBoard(board(2, 4, 'domino')), 'bad-size');
  assert.equal(checkBoard(board(4, 9, 'domino')), 'bad-size');
  assert.equal(checkBoard(board(4, 4, 'circle')), 'bad-piece');
  assert.equal(checkBoard({ w: 4, h: 4, piece: 'bar' }), 'bad-holes');
  assert.equal(checkBoard(board(4, 4, 'bar', [3, 3])), 'bad-holes');
  assert.equal(checkBoard(board(4, 4, 'bar', [5, 2])), 'bad-holes');
  assert.equal(checkBoard(board(4, 4, 'bar', [16])), 'bad-holes');
  assert.equal(checkBoard(board(3, 3, 'bar', [0, 1, 2, 3, 4, 5, 6, 7, 8])), 'no-cells');
});

test('조각의 모양: 이웃한 두 칸은 도미노, 한 줄로 나란한 세 칸은 일자, 두 칸짜리 네모 안의 세 칸은 ㄱ자', () => {
  const item = board(4, 4, 'domino');
  assert.equal(shapeOf(item, [0, 1]), 'domino');
  assert.equal(shapeOf(item, [1, 5]), 'domino');
  assert.equal(shapeOf(item, [3, 4]), null, '줄이 바뀌는 두 칸은 이웃이 아니다');
  assert.equal(shapeOf(item, [0, 5]), null, '대각으로 놓인 두 칸');
  assert.equal(shapeOf(item, [0, 1, 2]), 'bar');
  assert.equal(shapeOf(item, [2, 6, 10]), 'bar');
  assert.equal(shapeOf(item, [2, 3, 4]), null);
  assert.equal(shapeOf(item, [0, 1, 3]), null, '떨어진 칸');
  for (const cells of [[0, 1, 4], [0, 1, 5], [0, 4, 5], [1, 4, 5]]) assert.equal(shapeOf(item, cells), 'ell', cells.join());
  assert.equal(shapeOf(item, [0, 1, 6]), null);
  assert.equal(shapeOf(item, [0, 0]), null);
  assert.equal(shapeOf(item, [0, 16]), null);
  assert.equal(shapeOf(item, [0, 1, 2, 3]), 'long', '한 줄로 나란한 네 칸은 일자 네 칸');
});

test('네 칸 조각의 모양: 돌리고 뒤집은 모양을 모두 같은 조각으로 가린다', () => {
  const item = board(5, 5, 'tee');
  assert.equal(shapeOf(item, [0, 1, 5, 6]), 'square');
  assert.equal(shapeOf(item, [0, 5, 10, 15]), 'long');
  assert.equal(shapeOf(item, [0, 1, 2, 6]), 'tee');
  assert.equal(shapeOf(item, [1, 5, 6, 11]), 'tee');
  assert.equal(shapeOf(item, [0, 5, 10, 11]), 'bend');
  assert.equal(shapeOf(item, [1, 6, 10, 11]), 'bend', '뒤집은 ㄱ자');
  assert.equal(shapeOf(item, [1, 2, 5, 6]), 'zig');
  assert.equal(shapeOf(item, [0, 1, 6, 7]), 'zig', '뒤집은 번개');
  assert.equal(shapeOf(item, [3, 4, 5, 6]), null, '줄이 바뀌는 칸');
  assert.equal(shapeOf(item, [0, 1, 7, 8]), null, '떨어진 칸');
  // 손으로 그린 놓임새(테스트 도우미)마다 같은 조각으로 가린다. 놓임새의 수: 네모 1, 일자 2, ㅗ자 4, ㄱ자 8, 번개 4
  assert.deepEqual(FOUR_ORIENTATIONS, { square: 1, long: 2, tee: 4, bend: 8, zig: 4 });
  for (const piece of FOUR_PIECES) {
    const shell = board(6, 6, piece);
    const spots = allSpots(shell);
    assert.ok(spots.length > 0, piece);
    for (const cells of spots) {
      assert.equal(shapeOf(shell, cells), piece, `${piece} ${cells}`);
      // 칸 수가 맞아도 모양이 다르면 다른 조각의 판에는 놓이지 않는다.
      for (const other of FOUR_PIECES.filter((item2) => item2 !== piece)) assert.equal(placeProblem(board(6, 6, other), [], cells), 'shape', `${piece} → ${other}`);
    }
  }
  assert.equal(placeProblem(board(5, 5, 'tee'), [], [0, 1, 2]), 'few');
});

test('조각 놓기: 놓을 수 없는 까닭을 가린다', () => {
  const item = board(4, 4, 'bar', [5]);
  assert.equal(placeProblem(item, [], [0, 1, 2]), null);
  assert.equal(placeProblem(item, [], [0, 4, 8]), null);
  assert.equal(placeProblem(item, [], [0, 1]), 'few');
  assert.equal(placeProblem(item, [], [0, 1, 2, 3]), 'many');
  assert.equal(placeProblem(item, [], [0, 1, 4]), 'shape');
  assert.equal(placeProblem(item, [], [4, 5, 6]), 'hole');
  assert.equal(placeProblem(item, [[0, 1, 2]], [2, 6, 10]), 'covered');
  assert.equal(placeProblem(item, [], [14, 15, 16]), 'off');
  assert.equal(placeProblem(item, [], [1, 1, 2]), 'off');
  assert.equal(placeProblem(item, [], []), 'off');
  // 도미노는 이웃한 두 칸이면 늘 놓인다. ㄱ자 판에서 한 줄로 그은 세 칸은 모양이 아니다.
  assert.equal(placeProblem(board(4, 4, 'domino'), [], [0, 4]), null);
  assert.equal(placeProblem(board(4, 4, 'ell'), [], [0, 1, 2]), 'shape');
  assert.equal(placeProblem(board(4, 4, 'ell'), [], [1, 4, 5]), null);
});

test('놓을 수 있는 자리의 수: 빈 판에서는 식으로 셀 수 있고, 따로 만든 목록과 같다', () => {
  for (let w = MIN_SIZE; w <= MAX_SIZE; w++) {
    for (let h = MIN_SIZE; h <= MAX_SIZE; h++) {
      assert.equal(placementsOf(board(w, h, 'domino')).length, (w - 1) * h + w * (h - 1), `도미노 ${w}×${h}`);
      assert.equal(placementsOf(board(w, h, 'bar')).length, (w - 2) * h + w * (h - 2), `일자 ${w}×${h}`);
      assert.equal(placementsOf(board(w, h, 'ell')).length, 4 * (w - 1) * (h - 1), `ㄱ자 ${w}×${h}`);
    }
  }
  const key = (list) => list.map((cells) => cells.slice().sort((a, b) => a - b).join('-')).sort().join(' ');
  // 네 칸 조각은 빈 판에서도 손으로 그린 놓임새로 만든 목록과 견준다.
  for (const piece of FOUR_PIECES) {
    for (let w = MIN_SIZE; w <= MAX_SIZE; w++) for (let h = MIN_SIZE; h <= MAX_SIZE; h++) assert.equal(key(placementsOf(board(w, h, piece))), key(allSpots(board(w, h, piece))), `${piece} ${w}×${h}`);
  }
  for (const piece of PIECE_IDS) {
    for (const item of [board(5, 4, piece, [3, 11]), board(6, 6, piece, [0, 14, 35]), board(8, 8, piece, [27])]) {
      const found = placementsOf(item);
      assert.equal(key(found), key(allSpots(item)), `${piece} ${item.w}×${item.h}`);
      for (const cells of found) assert.equal(shapeOf(item, cells), piece);
    }
  }
  // 놓인 조각과 겹치는 자리는 빠진다.
  const item = board(4, 4, 'domino', [0, 15]);
  assert.equal(placementsOf(item).length, 20);
  assert.ok(placementsOf(item, [[1, 2]]).every((cells) => !cells.includes(1) && !cells.includes(2)));
});

test('지나온 길 따라가기: 놓고, 들어내고, 남은 빈칸을 센다', () => {
  const item = board(4, 4, 'domino', [0, 15]);
  assert.deepEqual(replay(item, []), { ok: true, placed: [], left: 14 });
  const trail = [place([1, 2]), place([4, 8]), remove([1, 2]), place([1, 5])];
  assert.deepEqual(replay(item, trail), { ok: true, placed: [[4, 8], [1, 5]], left: 10 });
  // 칸의 차례가 달라도 같은 조각이다.
  assert.deepEqual(replay(item, [place([2, 1]), remove([1, 2])]).placed, []);
  assert.equal(replay(item, [place([1, 2]), place([2, 3])]).ok, false, '겹친다');
  assert.equal(replay(item, [place([0, 1])]).ok, false, '빠진 칸');
  assert.equal(replay(item, [remove([1, 2])]).ok, false, '없는 조각');
  assert.equal(replay(item, [{ op: 'flip', cells: [1, 2] }]).ok, false);
  assert.equal(replay(item, null).ok, false);
  assert.equal(replay(item, [null]).ok, false);
  assert.deepEqual(emptyCells(item, [[1, 2], [3, 7]]), [4, 5, 6, 8, 9, 10, 11, 12, 13, 14]);
});

test('막힘: 빈칸이 남았는데 놓을 자리가 없으면 막힌 것이고, 들어갈 수 없는 빈칸을 짚는다', () => {
  const item = board(4, 4, 'domino', [0, 15]);
  const placed = [[1, 2], [3, 7], [4, 8], [5, 6], [9, 10], [12, 13]];
  assert.equal(isStuck(item, placed), true);
  assert.equal(isDone(item, placed), false);
  assert.deepEqual(deadCells(item, placed), [11, 14]);
  assert.equal(isStuck(item, placed.slice(0, 5)), false);
  assert.deepEqual(deadCells(item, placed.slice(0, 5)), [11], '다른 빈칸에는 아직 놓을 수 있어도, 외딴 빈칸은 들어갈 수 없는 빈칸이다');
  assert.deepEqual(deadCells(item), []);
  // 다 덮은 판은 막힌 판이 아니다.
  const full = solve(board(4, 4, 'domino', [0, 1]));
  assert.equal(isStuck(board(4, 4, 'domino', [0, 1]), full.tiling), false);
  assert.equal(isDone(board(4, 4, 'domino', [0, 1]), full.tiling), true);
});

test('무늬: 바둑판은 두 색, 대각 줄무늬는 세 색. 색마다 남은 빈칸을 센다', () => {
  assert.deepEqual(PATTERNS, ['none', 'checker', 'stripe']);
  assert.deepEqual(PATTERN_COLORS, { none: 1, checker: 2, stripe: 3, back: 3 });
  assert.deepEqual(colorCounts(board(4, 4, 'domino'), 'checker'), [8, 8]);
  assert.deepEqual(colorCounts(board(4, 4, 'domino', [0, 15]), 'checker'), [6, 8]);
  assert.deepEqual(colorCounts(board(4, 4, 'domino', [0, 15]), 'checker', [[1, 2], [4, 8]]), [4, 6]);
  assert.deepEqual(colorCounts(board(4, 4, 'bar'), 'stripe'), [6, 5, 5]);
  assert.deepEqual(colorCounts(board(4, 4, 'bar'), 'back'), [6, 5, 5]);
  assert.deepEqual(colorCounts(board(8, 8, 'bar'), 'stripe'), [21, 22, 21]);
  assert.deepEqual(colorCounts(board(5, 4, 'bar'), 'none'), [20]);
  // 이웃한 칸은 바둑판 무늬에서 색이 다르고, 한 줄로 나란한 세 칸은 대각 줄무늬(양쪽 모두)에서 세 색이 하나씩이다.
  for (const cells of placementsOf(board(8, 8, 'domino'))) {
    assert.deepEqual(cells.map((cell) => checker(board(8, 8, 'domino'), cell)).sort(), [0, 1]);
  }
  for (const pattern of ['stripe', 'back']) {
    for (const cells of placementsOf(board(8, 8, 'bar'))) {
      assert.deepEqual(cells.map((cell) => colorOf(pattern, ...xyOf(board(8, 8, 'bar'), cell))).sort(), [0, 1, 2], `${pattern} ${cells}`);
    }
  }
});

test('풀이 프로그램: 된다고 하면 덮는 방법을 실제로 갖고 있다', () => {
  for (const item of [board(4, 4, 'domino', [0, 1]), board(6, 6, 'domino', [0, 6]), board(4, 4, 'bar', [0]), board(8, 8, 'bar', [18]), board(5, 5, 'ell', [12]), board(8, 8, 'ell', [0]), board(6, 3, 'ell', [])]) {
    const result = solve(item);
    assert.equal(result.possible, true, JSON.stringify(item));
    assert.equal(result.reason, 'tiled');
    assert.equal(result.tiling.length, emptyCells(item).length / PIECES[item.piece]);
    assertTiling(item, result.tiling, JSON.stringify(item));
  }
  // 안 되는 판에는 덮는 방법이 없고, 왜 안 된다고 했는지가 적혀 있다.
  assert.deepEqual(solve(board(4, 4, 'domino', [0])), { possible: false, tiling: null, reason: 'count', steps: 0 });
  assert.equal(solve(board(4, 4, 'domino', [0, 15])).reason, 'color');
  assert.equal(solve(board(4, 4, 'bar', [5])).reason, 'color');
  assert.equal(solve(board(4, 4, 'domino', [1, 4, 10, 15])).reason, 'island', '구석 칸 하나가 외따로 남는다');
  // 3×3은 칸이 아홉 개지만 ㄱ자 세 개로는 덮을 수 없다(칸 수가 맞아도 안 되는 판).
  assert.equal(solve(board(3, 3, 'ell', [])).reason, 'search');
  assert.equal(solve(board(5, 5, 'ell', [1])).reason, 'search');
  assert.equal(solve(board(4, 4, 'domino', [0, 15]), { filters: false }).reason, 'search');
});

test('풀이 프로그램을 다른 방법과 견준다: 가로·세로 5 이하에서 한두 칸을 뺀 모든 판', () => {
  let checked = 0;
  let possible = 0;
  let subsets = 0;
  for (const [w, h, holes] of smallBoards(5)) {
    for (const piece of THREE) {
      const item = board(w, h, piece, holes);
      const where = `${piece} ${w}×${h} [${holes}]`;
      const ways = bruteCount(item);
      const fast = solve(item);
      const full = solve(item, { filters: false });
      assert.equal(fast.possible, ways > 0, where);
      assert.equal(full.possible, ways > 0, `걸러내기 없이: ${where}`);
      // 빠른 걸러내기는 안 되는 판만 거른다.
      if (quickReject(item) !== null) assert.equal(ways, 0, `걸러내기: ${where}`);
      if (fast.possible) assertTiling(item, fast.tiling, where);
      // 칸이 열여섯 개 이하인 판은 조각 자리의 모든 부분집합을 따지는 방법으로도 견준다.
      if (w * h <= 16) {
        assert.equal(bruteSubsets(item), ways > 0, `부분집합: ${where}`);
        subsets += 1;
      }
      checked += 1;
      if (ways > 0) possible += 1;
    }
  }
  assert.equal(checked, 3966);
  assert.equal(subsets, 1731);
  assert.ok(possible > 300 && possible < checked / 2, `되는 판 ${possible}`);
});

// 한 칸을 뺀 정사각형 판의 되는 자리. 책의 값을 믿지 않고 모든 자리를 따져서 얻은 값이다(자리는 "가로,세로", 0부터).
const ONE_HOLE = {
  domino: {
    5: '0,0 2,0 4,0 1,1 3,1 0,2 2,2 4,2 1,3 3,3 0,4 2,4 4,4',
    7: '0,0 2,0 4,0 6,0 1,1 3,1 5,1 0,2 2,2 4,2 6,2 1,3 3,3 5,3 0,4 2,4 4,4 6,4 1,5 3,5 5,5 0,6 2,6 4,6 6,6',
  },
  bar: {
    4: '0,0 3,0 0,3 3,3',
    5: '2,2',
    7: '0,0 3,0 6,0 0,3 3,3 6,3 0,6 3,6 6,6',
    8: '2,2 5,2 2,5 5,5',
  },
  ell: {
    4: 'all',
    5: '0,0 2,0 4,0 0,2 2,2 4,2 0,4 2,4 4,4',
    7: 'all',
    8: 'all',
  },
};

test('한 칸을 뺀 정사각형 판(4, 5, 7, 8): 조각마다 되는 자리를 모든 경우를 따져 구한다', (t) => {
  for (const piece of THREE) {
    for (const n of [4, 5, 7, 8]) {
      // 도미노: 칸이 짝수 개인 판(4, 8)은 한 칸을 빼면 홀수 칸이 남아 따질 것이 없다.
      if (piece === 'domino' && n % 2 === 0) {
        for (let hole = 0; hole < n * n; hole++) assert.equal(solve(board(n, n, piece, [hole])).reason, 'count');
        continue;
      }
      const good = [];
      let steps = 0;
      for (let hole = 0; hole < n * n; hole++) {
        const item = board(n, n, piece, [hole]);
        // 빠른 걸러내기 없이 끝까지 따진 결과가 기준이다.
        const full = solve(item, { filters: false });
        const fast = solve(item);
        assert.notEqual(full.possible, null);
        assert.equal(fast.possible, full.possible, `${piece} ${n}×${n} ${spot(item, hole)}`);
        if (n <= 5) assert.equal(bruteCount(item) > 0, full.possible, `${piece} ${n}×${n} ${spot(item, hole)}`);
        // 일자 세 칸(되는 자리 고르기의 답)은 7×7, 8×8도 빠짐없는 덮기 찾기로 다시 따진다.
        else if (piece === 'bar') assert.equal(bruteCover(item).tiling !== null, full.possible, `${piece} ${n}×${n} ${spot(item, hole)}`);
        if (full.possible) {
          assertTiling(item, full.tiling, `${piece} ${n}×${n} ${spot(item, hole)}`);
          good.push(spot(item, hole));
        }
        steps = Math.max(steps, full.steps);
      }
      const expected = ONE_HOLE[piece][n];
      if (expected === 'all') assert.equal(good.length, n * n, `${piece} ${n}×${n}`);
      else assert.equal(good.join(' '), expected, `${piece} ${n}×${n}`);
      t.diagnostic(`${piece} ${n}×${n}: 되는 자리 ${good.length}/${n * n}${expected === 'all' ? '' : ` → ${good.join(' ')}`} (가장 많이 따진 걸음 ${steps})`);
    }
  }
});

test('일자 세 칸: 되는 자리는 두 대각 줄무늬에서 모두 "한 칸 많은 색"인 칸과 꼭 같다', () => {
  for (const n of [4, 5, 7, 8]) {
    const item = board(n, n, 'bar');
    const surplus = (pattern) => {
      const counts = colorCounts(item, pattern);
      const most = counts.indexOf(Math.max(...counts));
      assert.deepEqual(counts.slice().sort((a, b) => b - a), [counts[most], counts[most] - 1, counts[most] - 1], `${n}×${n} ${pattern}`);
      return most;
    };
    const one = surplus('stripe');
    const two = surplus('back');
    const byColor = [];
    const byOne = [];
    for (let hole = 0; hole < n * n; hole++) {
      const [x, y] = xyOf(item, hole);
      if (colorOf('stripe', x, y) === one) byOne.push(hole);
      if (colorOf('stripe', x, y) === one && colorOf('back', x, y) === two) byColor.push(spot(item, hole));
    }
    assert.equal(byColor.join(' '), ONE_HOLE.bar[n], `${n}×${n}`);
    // 줄무늬 하나만으로는 되는 자리보다 많이 남는다. 반대쪽 대각으로 한 번 더 입혀야 꼭 맞는다.
    assert.ok(byOne.length > byColor.length, `${n}×${n}`);
  }
});

test('ㄱ자 세 칸: 5×5의 안 되는 열여섯 자리는 무늬로 갈리지 않는다', () => {
  const item = board(5, 5, 'ell');
  const good = new Set(ONE_HOLE.ell[5].split(' '));
  const bad = [];
  for (let hole = 0; hole < 25; hole++) if (!good.has(spot(item, hole))) bad.push(hole);
  assert.equal(bad.length, 16);
  // 풀이 프로그램은 이 판들을 걸러내기가 아니라 모든 경우를 따져서 안 된다고 한다.
  for (const hole of bad) {
    assert.equal(quickReject(board(5, 5, 'ell', [hole])), null);
    assert.equal(solve(board(5, 5, 'ell', [hole])).reason, 'search');
  }
  // ㄱ자 조각은 바둑판 무늬에서도 대각 줄무늬에서도 덮는 색이 놓는 자리마다 다르다(어디에 놓아도 같은 색을 덮는 무늬가 아니다).
  for (const pattern of ['checker', 'stripe', 'back']) {
    const kinds = new Set(placementsOf(item).map((cells) => cells.map((cell) => colorOf(pattern, ...xyOf(item, cell))).sort().join('')));
    assert.ok(kinds.size > 1, pattern);
  }
  // 어느 무늬로도 되는 자리와 안 되는 자리가 갈리지 않는다: 같은 색의 칸 가운데 되는 자리도 있고 안 되는 자리도 있다.
  for (const pattern of ['checker', 'stripe', 'back']) {
    const colorAt = (hole) => colorOf(pattern, ...xyOf(item, hole));
    const goodColors = new Set([...Array(25).keys()].filter((hole) => good.has(spot(item, hole))).map(colorAt));
    assert.ok(bad.some((hole) => goodColors.has(colorAt(hole))), pattern);
  }
});

test('도미노: 4×4부터 6×6까지(칸이 짝수 개인 판) 색이 다른 두 칸을 빼면 늘 되고, 색이 같은 두 칸을 빼면 늘 안 된다', (t) => {
  let different = 0;
  let same = 0;
  for (let w = 4; w <= 6; w++) {
    for (let h = 4; h <= 6; h++) {
      if ((w * h) % 2 !== 0) {
        // 5×5는 칸이 홀수 개라서 두 칸을 빼면 어떻게 빼도 안 된다.
        assert.equal(solve(board(w, h, 'domino', [0, 1])).reason, 'count');
        continue;
      }
      for (let a = 0; a < w * h; a++) {
        for (let b = a + 1; b < w * h; b++) {
          const item = board(w, h, 'domino', [a, b]);
          const full = solve(item, { filters: false });
          const differs = checker(item, a) !== checker(item, b);
          assert.equal(full.possible, differs, `${w}×${h} [${a}, ${b}]`);
          assert.equal(solve(item).possible, differs);
          if (differs) {
            assertTiling(item, full.tiling, `${w}×${h} [${a}, ${b}]`);
            different += 1;
          } else same += 1;
        }
      }
    }
  }
  assert.equal(different, 1326);
  assert.equal(same, 1226);
  t.diagnostic(`색이 다른 두 칸을 뺀 판 ${different}개가 모두 되고, 색이 같은 두 칸을 뺀 판 ${same}개가 모두 안 된다(4×4, 4×5, 4×6, 5×4, 5×6, 6×4, 6×5, 6×6)`);
});

test('한 바퀴 도는 한 줄 길: 색이 다른 두 칸에서 끊으면 두 도막이 모두 짝수 칸이고, 길을 따라 도미노를 놓으면 다 덮인다', () => {
  for (let w = 3; w <= 8; w++) {
    for (let h = 3; h <= 8; h++) {
      if ((w * h) % 2 !== 0) {
        assert.throws(() => loopOf(w, h));
        continue;
      }
      const shell = board(w, h, 'domino');
      const loop = loopOf(w, h);
      assert.equal(new Set(loop).size, w * h, `${w}×${h}: 모든 칸을 한 번씩`);
      loop.forEach((cell, index) => assert.equal(shapeOf(shell, [cell, loop[(index + 1) % loop.length]]), 'domino', `${w}×${h}: 이웃한 칸으로 이어진다`));
      for (let i = 0; i < loop.length; i++) {
        for (let j = i + 1; j < loop.length; j++) {
          const arcs = [j - i - 1, loop.length - (j - i) - 1];
          const differs = checker(shell, loop[i]) !== checker(shell, loop[j]);
          assert.equal(arcs.every((length) => length % 2 === 0), differs, `${w}×${h} ${loop[i]}, ${loop[j]}`);
          if (!differs) continue;
          // 두 도막을 따라 차례로 두 칸씩 덮는다.
          const order = [...loop.slice(i + 1, j), ...loop.slice(j + 1), ...loop.slice(0, i)];
          const tiling = [];
          const first = loop.slice(i + 1, j);
          const second = [...loop.slice(j + 1), ...loop.slice(0, i)];
          for (const arc of [first, second]) for (let k = 0; k < arc.length; k += 2) tiling.push([arc[k], arc[k + 1]]);
          assert.equal(order.length, w * h - 2);
          assertTiling(board(w, h, 'domino', [loop[i], loop[j]].sort((a, b) => a - b)), tiling, `${w}×${h} ${loop[i]}, ${loop[j]}`);
        }
      }
    }
  }
});

test('아무렇게나 놓았을 때 끝까지 덮이는 비율: 같은 판은 늘 같은 값이고, 모든 갈림을 따진 값과 가깝다', (t) => {
  const item = board(4, 4, 'domino', [10, 11]);
  assert.equal(randomFillRate(item), randomFillRate(item));
  assert.equal(randomFillRate(item, { trials: 50, seed: 3 }), randomFillRate(item, { trials: 50, seed: 3 }));
  assert.equal(randomFillRate(board(4, 4, 'domino', [0, 15]), { trials: 300 }), 0, '안 되는 판');
  assert.equal(randomFillRate(board(4, 4, 'domino', [0])), 0);
  assert.equal(bruteFillRate(board(3, 3, 'domino', [4])), bruteFillRate(board(3, 3, 'domino', [4])));
  for (const sample of [board(4, 4, 'domino', [10, 11]), board(4, 4, 'domino', [0, 1]), board(4, 3, 'domino', [0, 1]), board(4, 4, 'bar', [0]), board(4, 4, 'ell', [5]), board(5, 4, 'domino', [2, 3])]) {
    const exact = bruteFillRate(sample);
    const tried = randomFillRate(sample, { trials: 4000, seed: 11 });
    assert.ok(Math.abs(exact - tried) < 0.03, `${JSON.stringify(sample)}: ${exact} / ${tried}`);
  }
  // 보고용: 되는 판마다의 비율(작은 판은 모든 갈림을 따진 값, 큰 판은 4000번 해 본 값)
  const percent = (value) => `${(value * 100).toFixed(value < 0.01 ? 2 : 1)}%`;
  const spread = (rates) => {
    const sorted = rates.slice().sort((a, b) => a - b);
    return `가장 낮은 ${percent(sorted[0])}, 가운데 ${percent(sorted[sorted.length >> 1])}, 가장 높은 ${percent(sorted.at(-1))}`;
  };
  for (const [w, h] of [[4, 3], [4, 4], [5, 4]]) {
    const rates = [];
    for (let a = 0; a < w * h; a++) {
      for (let b = a + 1; b < w * h; b++) {
        const sample = board(w, h, 'domino', [a, b]);
        if (checker(sample, a) !== checker(sample, b)) rates.push(bruteFillRate(sample));
      }
    }
    assert.ok(Math.min(...rates) > 0, `${w}×${h}: 되는 판은 아무렇게나 놓아도 덮일 때가 있다`);
    t.diagnostic(`도미노 ${w}×${h}에서 색이 다른 두 칸을 뺀 판 ${rates.length}개: ${spread(rates)}`);
  }
  for (const [n, holes] of [[6, [[0, 1], [0, 6], [14, 15], [0, 29]]]]) {
    t.diagnostic(`도미노 ${n}×${n} 몇 판: ${holes.map((pair) => percent(randomFillRate(board(n, n, 'domino', pair), { trials: 4000 }))).join(', ')}`);
  }
  for (const piece of ['bar', 'ell']) {
    for (const n of [4, 5, 7, 8]) {
      const rates = [];
      for (let hole = 0; hole < n * n; hole++) {
        const sample = board(n, n, piece, [hole]);
        // 뒤집거나 돌려서 같은 자리는 한 번만 잰다.
        const [x, y] = xyOf(sample, hole);
        if (x > y || x > n - 1 - x || y > n - 1 - y) continue;
        if (solve(sample).possible) rates.push(n <= 5 ? bruteFillRate(sample) : randomFillRate(sample, { trials: 4000 }));
      }
      t.diagnostic(`${piece} ${n}×${n}에서 한 칸을 뺀 되는 판(${rates.length}가지 자리): ${spread(rates)}`);
    }
  }
});

test('"불가능해요"의 판정과 짐작', () => {
  assert.deepEqual(diagnoseImpossible({ possible: false }, { places: 0 }), { correct: true, guess: null });
  assert.deepEqual(diagnoseImpossible({ possible: false }, { places: 9 }), { correct: true, guess: null });
  assert.deepEqual(diagnoseImpossible({ possible: true }, { places: 0 }), { correct: false, guess: 'impossible-no-try' });
  assert.deepEqual(diagnoseImpossible({ possible: true }), { correct: false, guess: 'impossible-no-try' });
  assert.deepEqual(diagnoseImpossible({ possible: true }, { places: 4 }), { correct: false, guess: 'impossible-other-start' });
  // 풀이 프로그램도 끝까지 따져 보지 못한 판은 맞다고도 틀리다고도 하지 않는다.
  assert.deepEqual(diagnoseImpossible({ possible: null }, { places: 4 }), { correct: null, guess: 'unknown' });
});

test('걸음 수의 위 끝: 넘으면 "끝까지 따져 보지 못했다"고 하고, 8×8까지의 판은 위 끝에 한참 못 미친다', (t) => {
  // 위 끝을 일부러 낮추면 된다고도 안 된다고도 하지 않는다.
  const hard = board(8, 8, 'ell', []);
  assert.deepEqual(solve(hard, { limit: 50, filters: false }), { possible: null, tiling: null, reason: 'limit', steps: 51 });
  assert.equal(solve(board(8, 8, 'ell', [0]), { limit: 5 }).possible, null);
  assert.equal(solve(hard, { filters: false }).possible, false);

  // 직접 만들기에서 나올 수 있는 판을 많이 뽑아 본다. 빠른 걸러내기를 꺼서 가장 오래 걸리는 쪽으로 잰다.
  const rng = createRng(20261118);
  let worst = { steps: 0 };
  let undecided = 0;
  let slowest = 0;
  const samples = [];
  for (let index = 0; index < 6000; index++) {
    const w = randInt(rng, MIN_SIZE, MAX_SIZE);
    const h = randInt(rng, MIN_SIZE, MAX_SIZE);
    const count = randInt(rng, 0, Math.min(10, w * h - 3));
    const holes = new Set();
    while (holes.size < count) holes.add(randInt(rng, 0, w * h - 1));
    samples.push(board(w, h, THREE[randInt(rng, 0, 2)], [...holes].sort((a, b) => a - b)));
  }
  // 가장 큰 판에서 빠진 칸이 없거나 한두 개인 판도 모두 넣는다.
  for (const piece of THREE) {
    samples.push(board(8, 8, piece, []));
    for (let hole = 0; hole < 64; hole++) samples.push(board(8, 8, piece, [hole]), board(8, 8, piece, [Math.min(hole, 63 - hole), Math.max(hole, 63 - hole)]));
  }
  for (const item of samples) {
    const begin = process.hrtime.bigint();
    const result = solve(item, { filters: false });
    slowest = Math.max(slowest, Number(process.hrtime.bigint() - begin) / 1e6);
    if (result.possible === null) undecided += 1;
    if (result.steps > worst.steps) worst = { steps: result.steps, item };
    assert.equal(solve(item).possible, result.possible, JSON.stringify(item));
  }
  assert.equal(undecided, 0, '끝까지 따져 보지 못한 판');
  assert.ok(worst.steps * 20 < SOLVE_LIMIT, `가장 많이 따진 걸음 ${worst.steps}`);
  t.diagnostic(`판 ${samples.length}개(3×3~8×8)를 걸러내기 없이 풀었다: 끝까지 못 따진 판 0개, 가장 많이 따진 걸음 ${worst.steps}(${JSON.stringify(worst.item)}), 위 끝 ${SOLVE_LIMIT}, 가장 오래 걸린 판 ${slowest.toFixed(1)}ms`);
});

test('"왜 그럴까?"는 조각마다 따로 열린다: 그 조각의 안 되는 판(만들어 낸 판)을 끝까지 만난 뒤', () => {
  const round = (piece, overrides = {}) => ({ kind: 'round', format: 'tile', custom: false, board: board(4, 4, piece, [0, 15]), solution: { possible: false }, outcome: 'solved', ...overrides });
  assert.equal(whyOpen([], 'domino'), false);
  assert.equal(whyOpen(null, 'domino'), false);
  assert.equal(whyOpen([round('domino')], 'domino'), true);
  assert.equal(whyOpen([round('domino', { outcome: 'solution' })], 'domino'), true, '그만두고 풀이를 본 판');
  assert.equal(whyOpen([round('domino')], 'bar'), false, '도미노 판을 만났다고 일자의 까닭이 열리지 않는다');
  assert.equal(whyOpen([round('bar')], 'bar'), true);
  assert.equal(whyOpen([round('domino', { outcome: 'left' })], 'domino'), false, '끝내지 않은 판');
  assert.equal(whyOpen([round('domino', { solution: { possible: true } })], 'domino'), false, '되는 판');
  assert.equal(whyOpen([round('domino', { custom: true })], 'domino'), false, '직접 만든 판');
  assert.equal(whyOpen([round('domino', { format: 'swap' })], 'domino'), false);
  assert.equal(whyOpen([round('domino', { kind: 'made' })], 'domino'), false);
  // ㄱ자 세 칸에는 "왜 그럴까?"가 없다.
  assert.equal(whyOpen([round('ell'), round('domino'), round('bar')], 'ell'), false);
  // 네 칸 조각에도 없다. 금 없는 벽(도미노)의 안 되는 판은 까닭이 바둑판 무늬가 아니라서 도미노의 이야기를 열지 않는다.
  for (const piece of FOUR_PIECES) assert.equal(whyOpen([round(piece)], piece), false, piece);
  assert.equal(whyOpen([round('domino', { mode: 'wall', board: board(6, 6, 'domino') })], 'domino'), false, '금 없는 벽');
  assert.equal(whyOpen([round('domino', { mode: 'either' })], 'domino'), true);
});

test('"왜 그럴까?"의 이야기는 무늬가 까닭인 판에서만 연다: 다른 까닭으로 안 되는 판에 맞지 않는 까닭을 들려주지 않는다', () => {
  // 만들어 낸 안 되는 판(2단계와 4단계)은 모두 무늬가 까닭이다.
  assert.equal(whyFits('domino', solve(board(4, 4, 'domino', [0, 15]))), true);
  assert.equal(whyFits('bar', solve(board(4, 4, 'bar', [5]))), true);
  // 되는 판에서는 이야기로 다시 볼 수 있다.
  assert.equal(whyFits('domino', solve(board(4, 4, 'domino', [0, 1]))), true);
  // 직접 만든 판: 칸 수가 안 맞거나, 외딴 덩어리가 있거나, 모든 경우를 따져서 안 되는 판
  assert.equal(solve(board(3, 3, 'domino')).reason, 'count');
  assert.equal(whyFits('domino', solve(board(3, 3, 'domino'))), false);
  assert.equal(whyFits('domino', solve(board(4, 4, 'domino', [1, 4, 10, 15]))), false);
  assert.equal(solve(board(4, 4, 'bar', [0, 1, 12, 14])).reason, 'search', '색마다 칸 수는 맞는데 안 되는 판');
  assert.equal(whyFits('bar', solve(board(4, 4, 'bar', [0, 1, 12, 14]))), false);
  // 끝까지 따져 보지 못한 판, ㄱ자 판
  assert.equal(whyFits('domino', { possible: null, reason: 'limit' }), false);
  assert.equal(whyFits('ell', solve(board(5, 5, 'ell', [1]))), false);
  assert.equal(whyFits('ell', solve(board(4, 4, 'ell', [0]))), false);
  assert.equal(whyFits('domino', null), false);
  for (const piece of FOUR_PIECES) assert.equal(whyFits(piece, solve(board(4, 5, piece))), false, piece);
});

// ---- 네 칸 조각 한 가지로 덮기(6단계) ----

test('네 칸 조각으로 빠진 칸 없는 네모 판(3×3~8×8) 덮기: 풀이 프로그램과 빠짐없는 덮기 찾기가 같다', (t) => {
  const table = {};
  for (const piece of FOUR_PIECES) {
    const yes = [];
    for (let w = MIN_SIZE; w <= MAX_SIZE; w++) {
      for (let h = MIN_SIZE; h <= MAX_SIZE; h++) {
        const item = board(w, h, piece);
        const where = `${piece} ${w}×${h}`;
        const full = solve(item, { filters: false });
        const brute = bruteCover(item);
        assert.notEqual(full.possible, null, where);
        assert.equal(full.possible, brute.tiling !== null, where);
        assert.equal(solve(item).possible, full.possible, where);
        if (full.possible) {
          assertTiling(item, full.tiling, where);
          assertTiling(item, brute.tiling, `다른 방법: ${where}`);
          yes.push(`${w}×${h}`);
        }
        // 칸이 30개 이하인 판은 덮는 방법의 수도 센다.
        if (w * h <= 30) assert.equal(bruteCount(item) > 0, full.possible, `수 세기: ${where}`);
      }
    }
    table[piece] = yes;
  }
  // 풀이 프로그램이 알려 준 것(가로·세로 3~8): 네모는 두 변이 모두 짝수, 일자는 한 변이 4의 배수, ㅗ자는 두 변이 모두 4의 배수,
  // ㄱ자는 칸 수가 8의 배수, 번개는 어느 판도 안 된다.
  const sides = [3, 4, 5, 6, 7, 8];
  const rule = {
    square: (w, h) => w % 2 === 0 && h % 2 === 0,
    long: (w, h) => w % 4 === 0 || h % 4 === 0,
    tee: (w, h) => w % 4 === 0 && h % 4 === 0,
    bend: (w, h) => (w * h) % 8 === 0,
    zig: () => false,
  };
  for (const piece of FOUR_PIECES) {
    const expected = sides.flatMap((w) => sides.filter((h) => rule[piece](w, h)).map((h) => `${w}×${h}`));
    assert.deepEqual(table[piece], expected, piece);
  }
  // ㅗ자: 조각 수가 4의 배수여야 하지만 그것만으로는 모자란다(6×8은 조각 12개인데 안 된다).
  assert.equal(solve(board(6, 8, 'tee')).possible, false);
  assert.equal(solve(board(6, 8, 'tee')).reason, 'search');
  for (const piece of FOUR_PIECES) t.diagnostic(`${piece}: 되는 판 ${table[piece].join(', ') || '없음'}`);
});

test('네 칸 조각: 빠진 칸이 한 개인 5×5 이하의 판도 덮는 방법의 수와 견준다', () => {
  let checked = 0;
  for (let w = MIN_SIZE; w <= 5; w++) {
    for (let h = MIN_SIZE; h <= 5; h++) {
      for (let hole = 0; hole < w * h; hole++) {
        for (const piece of FOUR_PIECES) {
          const item = board(w, h, piece, [hole]);
          const ways = bruteCount(item);
          assert.equal(solve(item).possible, ways > 0, `${piece} ${w}×${h} [${hole}]`);
          assert.equal(solve(item, { filters: false }).possible, ways > 0, `걸러내기 없이: ${piece} ${w}×${h} [${hole}]`);
          if (ways > 0) assertTiling(item, solve(item).tiling, `${piece} ${w}×${h} [${hole}]`);
          checked += 1;
        }
      }
    }
  }
  assert.equal(checked, 5 * (9 + 12 + 15 + 12 + 16 + 20 + 15 + 20 + 25));
});

// ---- 금 없는 벽(7단계) ----

test('금: 다 덮은 판에서 어느 조각도 가로지르지 않는 곧은 선을 찾는다', () => {
  const item = board(4, 4, 'domino');
  // 눕힌 도미노 여덟 개: 세로 금은 가운데(2번째 칸 뒤)에, 가로 금은 세 줄 사이 모두에 있다.
  const rows = [[0, 1], [2, 3], [4, 5], [6, 7], [8, 9], [10, 11], [12, 13], [14, 15]];
  assert.deepEqual(faultLines(item, rows), [{ dir: 'v', at: 2 }, { dir: 'h', at: 1 }, { dir: 'h', at: 2 }, { dir: 'h', at: 3 }]);
  assert.equal(bruteHasFault(item, rows), true);
  // 5×6의 금 없는 벽(풀이 프로그램이 찾은 것)에는 금이 없다.
  const wall = board(5, 6, 'domino');
  const found = solveWall(wall);
  assert.equal(found.possible, true);
  assertTiling(wall, found.tiling, '5×6');
  assert.deepEqual(faultLines(wall, found.tiling), []);
  assert.equal(bruteHasFault(wall, found.tiling), false);
  // 네 칸 조각도 금을 가로지른다(조각은 한 덩어리라서 금의 양쪽에 이웃한 두 칸이 있다).
  assert.deepEqual(faultLines(board(4, 4, 'tee'), [[0, 1, 2, 5], [3, 6, 7, 11], [4, 8, 9, 12], [10, 13, 14, 15]]), []);
});

test('금 없는 벽: 풀이 프로그램과 빠짐없는 덮기 찾기(다 덮는 방법을 하나씩 만들어 금이 없는 것을 찾는다)가 같다', (t) => {
  const yes = [];
  const counts = [];
  for (let w = MIN_SIZE; w <= MAX_SIZE; w++) {
    for (let h = MIN_SIZE; h <= MAX_SIZE; h++) {
      const item = board(w, h, 'domino');
      const where = `${w}×${h}`;
      const found = solveWall(item);
      assert.notEqual(found.possible, null, where);
      if ((w * h) % 2 !== 0) {
        assert.equal(found.reason, 'count', where);
        continue;
      }
      if (found.possible) {
        assertTiling(item, found.tiling, where);
        assert.deepEqual(faultLines(item, found.tiling), [], where);
        assert.equal(bruteHasFault(item, found.tiling), false, where);
        yes.push(where);
      }
      // 칸이 48개를 넘는 판(8×7, 7×8, 8×8)은 덮는 방법이 너무 많아 빠짐없이 따지는 쪽이 느리다. 되는 판이고, 위에서 찾은 벽을 따로 확인했다.
      if (w * h > 48) continue;
      const brute = bruteCover(item, (tiling) => !bruteHasFault(item, tiling));
      assert.equal(brute.tiling !== null, found.possible, where);
      if (!found.possible) counts.push(`${where} ${brute.covers}가지`);
    }
  }
  // 되는 판: 두 변이 모두 5 이상이고 칸이 짝수 개이며 6×6이 아닌 판. 한 변이 4칸 이하인 판과 6×6은 어떻게 덮어도 금이 생긴다.
  assert.deepEqual(yes, ['5×6', '5×8', '6×5', '6×7', '6×8', '7×6', '7×8', '8×5', '8×6', '8×7', '8×8']);
  assert.equal(solveWall(board(6, 6, 'domino')).reason, 'search');
  t.diagnostic(`금 없이 쌓을 수 있는 판: ${yes.join(', ')}`);
  t.diagnostic(`안 되는 판에서 다 덮는 방법을 모두 따졌다(모두 금이 있다): ${counts.join(', ')}`);
});
