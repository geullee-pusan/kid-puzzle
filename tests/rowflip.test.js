// 줄 뒤집기 판의 판과 풀이: 풀이 프로그램이 하는 말(되는지, 가장 적은 횟수, 안 되는 까닭의 네 칸)을 다른 방법으로 다시 따진다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { applyMove, blackCount, blocksOf, boardCorners, boardOfRows, cellsFrom, checkBoard, cornerBlack, cornersOf, isMove, lineCells, oddBlocks, rectFrom, replay, solve, witnessOf } from '../src/core/rowflip.js';
import { allBoards, bruteBfs, bruteLines, oddRects, toRows } from './helpers/brute-rowflip.js';

/** 테스트에서 쓰는 시드 난수(풀이 프로그램과 따로 둔다) */
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** 움직임을 차례로 해서 모두 흰 칸이 되는가(줄마다의 글로 다시 뒤집어 본다) */
function whiteAfter(w, h, cells, moves) {
  let rows = toRows(w, h, cells).map((row) => [...row]);
  for (const move of moves) {
    const at = Number(move.slice(1));
    if (move[0] === 'r') rows[at] = rows[at].map((ch) => (ch === '#' ? '.' : '#'));
    else rows = rows.map((row) => row.map((ch, c) => (c === at ? (ch === '#' ? '.' : '#') : ch)));
  }
  return rows.every((row) => !row.includes('#'));
}

test('판의 규격: 가로와 세로 2~5칸, 칸마다 0이나 1', () => {
  assert.equal(checkBoard({ w: 2, h: 2, cells: [1, 0, 0, 0] }), null);
  assert.equal(checkBoard({ w: 5, h: 5, cells: Array(25).fill(1) }), null);
  assert.notEqual(checkBoard({ w: 1, h: 2, cells: [1, 0] }), null);
  assert.notEqual(checkBoard({ w: 6, h: 2, cells: Array(12).fill(0) }), null);
  assert.notEqual(checkBoard({ w: 2, h: 2, cells: [1, 0, 0] }), null);
  assert.notEqual(checkBoard({ w: 2, h: 2, cells: [1, 0, 0, 2] }), null);
  assert.notEqual(checkBoard(null), null);
});

test('줄 뒤집기: 가로줄과 세로줄의 칸, 판에 없는 줄, 다시 해 보기', () => {
  assert.deepEqual(lineCells(3, 2, 'r1'), [3, 4, 5]);
  assert.deepEqual(lineCells(3, 2, 'c2'), [2, 5]);
  assert.equal(isMove(3, 2, 'r2'), false);
  assert.equal(isMove(3, 2, 'c3'), false);
  assert.equal(isMove(3, 2, 'x0'), false);
  assert.deepEqual(applyMove(2, 2, [1, 0, 0, 0], 'r0'), [0, 1, 0, 0]);
  assert.deepEqual(applyMove(2, 2, [1, 0, 0, 0], 'c0'), [0, 0, 1, 0]);
  const board = { w: 2, h: 2, cells: [1, 0, 0, 0] };
  assert.deepEqual(replay(board, ['r0', 'c0']), { ok: true, cells: [1, 1, 1, 0] });
  assert.equal(replay(board, ['r0', 'r5']).ok, false);
  // 같은 줄을 두 번 뒤집으면 제자리다
  assert.deepEqual(replay(board, ['c1', 'c1']).cells, board.cells);
  assert.equal(blackCount([1, 1, 0, 1]), 3);
  assert.deepEqual(boardOfRows(['#.', '.#', '##']), { w: 2, h: 3, cells: [1, 0, 0, 1, 1, 1] });
  assert.deepEqual(rectFrom(3, 0, 8), { r1: 0, c1: 0, r2: 2, c2: 2 });
  assert.deepEqual(rectFrom(3, 7, 3), { r1: 1, c1: 0, r2: 2, c2: 1 });
  assert.equal(rectFrom(3, 0, 2), null);
  assert.equal(rectFrom(3, 1, 7), null);
  assert.deepEqual(cornersOf(3, { r1: 0, c1: 0, r2: 2, c2: 2 }), [0, 2, 6, 8]);
});

test('되는지와 가장 적은 횟수: 3×3까지의 모든 판과 2×4, 4×2 판에서 너비 우선 찾기와 같다', () => {
  for (const [w, h] of [[2, 2], [2, 3], [3, 2], [3, 3], [2, 4], [4, 2]]) {
    for (const cells of allBoards(w, h)) {
      const board = { w, h, cells };
      const found = solve(board);
      const depth = bruteBfs(w, h, cells);
      assert.equal(found.possible, depth !== null, `${w}×${h} ${toRows(w, h, cells).join('/')}`);
      if (depth !== null) assert.equal(found.min, depth, `${w}×${h} ${toRows(w, h, cells).join('/')}`);
    }
  }
});

test('되는지와 가장 적은 횟수: 3×4, 4×3, 2×5 판 모두와 4×4, 4×5, 5×5의 아무렇게나 만든 판에서 모든 줄 묶음을 해 본 것과 같다. 되는 판은 묶음이 꼭 두 가지다', () => {
  const check = (w, h, cells) => {
    const found = solve({ w, h, cells });
    const brute = bruteLines(w, h, cells);
    const where = `${w}×${h} ${toRows(w, h, cells).join('/')}`;
    assert.equal(found.possible, brute.possible, where);
    if (!brute.possible) return;
    assert.equal(brute.ways, 2, where);
    assert.equal(found.min, brute.min, where);
    assert.equal(found.moves.length, found.min, where);
    assert.ok(whiteAfter(w, h, cells, found.moves), where);
  };
  for (const [w, h] of [[3, 4], [4, 3], [2, 5]]) for (const cells of allBoards(w, h)) check(w, h, cells);
  const rng = lcg(7);
  for (const [w, h] of [[4, 4], [4, 5], [5, 4], [5, 5]]) {
    for (let index = 0; index < 120; index++) {
      // 반은 아무렇게나, 반은 되는 판(줄을 뒤집어 만든 판)에 칸 하나를 바꾸거나 그대로 둔다
      let cells = Array.from({ length: w * h }, () => Number(rng() < 0.5));
      if (index % 2 === 1) {
        cells = cellsFrom(Array.from({ length: h }, () => Number(rng() < 0.5)), Array.from({ length: w }, () => Number(rng() < 0.5)));
        if (index % 4 === 1) cells[Math.floor(rng() * w * h)] ^= 1;
      }
      check(w, h, cells);
    }
  }
});

test('바뀌지 않는 것: 줄 하나를 뒤집으면 어느 네 모서리에서도 0칸이나 2칸만 바뀐다. 되는 판은 홀수인 네 모서리가 없는 판이고, 붙어 있는 2×2 덩이만 보아도 같다(4×4까지의 모든 판)', () => {
  for (const [w, h] of [[2, 2], [3, 3], [4, 4], [3, 5], [5, 3]]) {
    for (const cells of allBoards(w, h)) {
      const board = { w, h, cells };
      const possible = solve(board).possible;
      const odd = oddRects(w, h, cells);
      assert.equal(possible, odd.length === 0);
      assert.equal(possible, oddBlocks(board).length === 0);
    }
  }
  // 네 모서리마다, 줄마다 바뀌는 칸의 수
  for (let r1 = 0; r1 < 4; r1++)
    for (let r2 = r1 + 1; r2 < 4; r2++)
      for (let c1 = 0; c1 < 4; c1++)
        for (let c2 = c1 + 1; c2 < 4; c2++) {
          const corners = new Set(cornersOf(4, { r1, c1, r2, c2 }));
          for (const move of ['r0', 'r1', 'r2', 'r3', 'c0', 'c1', 'c2', 'c3']) {
            const touched = lineCells(4, 4, move).filter((cell) => corners.has(cell)).length;
            assert.ok(touched === 0 || touched === 2, `${move}`);
          }
        }
});

test('안 되는 까닭의 네 칸: 검은 칸이 홀수 개이고, 판의 네 모서리가 홀수이면 그것, 아니면 붙어 있는 2×2 덩이(판의 구석 덩이를 먼저)', () => {
  let corners = 0;
  let blocks = 0;
  let cornerBlocks = 0;
  for (const [w, h] of [[2, 2], [3, 3], [3, 4], [4, 4]]) {
    for (const cells of allBoards(w, h)) {
      const board = { w, h, cells };
      const found = solve(board);
      if (found.possible) {
        assert.equal(found.witness, null);
        assert.equal(witnessOf(board), null);
        continue;
      }
      const { witness } = found;
      assert.equal(cornerBlack(w, cells, witness) % 2, 1);
      const whole = cornerBlack(w, cells, boardCorners(board)) % 2 === 1;
      assert.equal(witness.kind, whole ? 'corners' : 'block');
      if (whole) {
        corners += 1;
        assert.deepEqual([witness.r1, witness.c1, witness.r2, witness.c2], [0, 0, h - 1, w - 1]);
        continue;
      }
      blocks += 1;
      assert.equal(witness.r2 - witness.r1, 1);
      assert.equal(witness.c2 - witness.c1, 1);
      // 판의 네 구석 덩이 가운데 홀수인 것이 있으면 그것을 고른다
      const cornerBlock = blocksOf(w, h)
        .slice(0, 4)
        .find((rect) => cornerBlack(w, cells, rect) % 2 === 1);
      if (cornerBlock) {
        cornerBlocks += 1;
        assert.deepEqual([witness.r1, witness.c1], [cornerBlock.r1, cornerBlock.c1]);
      }
    }
  }
  assert.ok(corners > 0 && blocks > 0 && cornerBlocks > 0 && cornerBlocks < blocks);
  // 판의 네 구석 덩이는 넷이고 서로 다르다(3×3 이상)
  const four = blocksOf(4, 4).slice(0, 4);
  assert.deepEqual(four.map((rect) => [rect.r1, rect.c1]), [[0, 0], [0, 2], [2, 0], [2, 2]]);
});

test('풀이 프로그램이 알려 준 것: 되는 판은 크기마다 2의 (가로 + 세로 - 1)제곱 가지이고, 가장 적은 횟수는 (가로 + 세로)의 반을 넘지 않는다', () => {
  for (const [w, h] of [[2, 2], [2, 3], [3, 3], [3, 4], [4, 4]]) {
    let possible = 0;
    let most = 0;
    for (const cells of allBoards(w, h)) {
      const found = solve({ w, h, cells });
      if (!found.possible) continue;
      possible += 1;
      most = Math.max(most, found.min);
    }
    assert.equal(possible, 2 ** (w + h - 1), `${w}×${h}`);
    assert.equal(most, Math.floor((w + h) / 2), `${w}×${h}`);
  }
  // 2×2 판은 검은 칸이 짝수 개인 여덟 판만 된다. 판의 네 모서리가 짝수인데도 안 되는 가장 작은 판은 3×3 판의 가운데 한 칸만 검은 판이다
  let even2 = 0;
  for (const cells of allBoards(2, 2)) if (solve({ w: 2, h: 2, cells }).possible) even2 += blackCount(cells) % 2 === 0 ? 1 : 100;
  assert.equal(even2, 8);
  const middle = { w: 3, h: 3, cells: [0, 0, 0, 0, 1, 0, 0, 0, 0] };
  assert.equal(solve(middle).possible, false);
  assert.equal(cornerBlack(3, middle.cells, boardCorners(middle)), 0);
  assert.equal(solve(middle).witness.kind, 'block');
});
