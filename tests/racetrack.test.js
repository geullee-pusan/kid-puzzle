// 모눈 자동차 경주의 판과 풀이 프로그램: 선과 칸, 결승선, 가장 적은 움직임 수, 깃발 칸을 다른 방법(tests/helpers/brute-racetrack.js)으로 다시 따진다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { generateBoard } from '../src/core/racetrack-ladder.js';
import { ACCELS, accelsOf, cellsTouched, checkBoard, flagCosts, isAccel, isStuck, replay, segmentKind, solve, startState, tryMove } from '../src/core/racetrack.js';
import { bruteCells, bruteFewest, bruteKind, bruteReplay, bruteStuck } from './helpers/brute-racetrack.js';

/** ㄱ자 길(가로 8칸, 세로 6칸, 길의 너비 3칸). "왜 그럴까?"의 판과 같다 */
const ELL = { rows: ['#####...', '#####...', '#####...', '........', '........', '........'], start: [0, 3], finish: { side: 'top', from: 5, to: 7 }, flags: [] };

test('판의 값: 줄, 출발 칸, 결승선(양옆의 변 칸은 벽), 깃발 칸', () => {
  assert.equal(checkBoard(ELL), null);
  assert.equal(checkBoard(null), 'no-board');
  assert.equal(checkBoard({ ...ELL, rows: ['..', '...'] }), 'rows');
  assert.equal(checkBoard({ ...ELL, rows: ['.x', '..'] }), 'rows');
  assert.equal(checkBoard({ ...ELL, start: [0, 0] }), 'start');
  assert.equal(checkBoard({ ...ELL, finish: { side: 'top', from: 4, to: 7 } }), 'finish');
  assert.equal(checkBoard({ ...ELL, finish: { side: 'top', from: 6, to: 7 } }), 'finish-edge');
  assert.equal(checkBoard({ ...ELL, finish: { side: 'middle', from: 5, to: 7 } }), 'finish');
  assert.equal(checkBoard({ ...ELL, flags: [[0, 0]] }), 'flags');
  assert.equal(checkBoard({ ...ELL, flags: [[1, 4], [1, 4]] }), 'flags');
  assert.equal(checkBoard({ ...ELL, flags: [[1, 4]] }), null);
});

test('선과 칸: 닿는 칸과 선의 결과가 다른 방법과 같다(사다리의 판과 손으로 만든 판, 점마다 가로세로 4칸까지의 선)', () => {
  const boards = [ELL, { rows: ['.#', '#.'], start: [0, 0], finish: { side: 'right', from: 1, to: 1 }, flags: [] }];
  for (let level = 1; level <= 5; level++) boards.push(generateBoard(level, 1).board, generateBoard(level, 2).board);
  let checked = 0;
  for (const board of boards) {
    board.rows.forEach((row, y0) =>
      [...row].forEach((ch, x0) => {
        if (ch !== '.') return;
        for (let dy = -4; dy <= 4; dy++) {
          for (let dx = -4; dx <= 4; dx++) {
            const where = `${board.rows.join('/')} (${x0},${y0})+(${dx},${dy})`;
            assert.equal(segmentKind(board, x0, y0, x0 + dx, y0 + dy), bruteKind(board, x0, y0, x0 + dx, y0 + dy), where);
            assert.deepEqual(cellsTouched(board, x0, y0, x0 + dx, y0 + dy).map(String).sort(), bruteCells(board, x0, y0, x0 + dx, y0 + dy).map(String).sort(), where);
            checked += 1;
          }
        }
      }),
    );
  }
  assert.ok(checked > 10000);
});

test('벽에 닿기만 해도 부딪힌 것이다: 두 벽 칸의 모서리 한 점, 결승선의 끝점', () => {
  // 비스듬히 이웃한 두 길 칸: 가운데 모서리는 벽 칸의 모서리이기도 하다
  const pinch = { rows: ['.#', '#.'], start: [0, 0], finish: { side: 'right', from: 1, to: 1 }, flags: [] };
  assert.equal(checkBoard(pinch), null);
  assert.equal(segmentKind(pinch, 0, 0, 1, 1), 'wall');
  // 넓은 길에서는 모서리를 지나도 된다
  const open = { rows: ['...', '...', '...'], start: [0, 0], finish: { side: 'right', from: 0, to: 2 }, flags: [] };
  assert.equal(segmentKind(open, 0, 0, 2, 2), 'move');
  // 결승선(위 변의 1~2열)의 끝점을 지나는 선은 벽이다. 끝점 안쪽을 지나면 결승선을 넘는다
  const gate = { rows: ['#..#', '....', '....'], start: [0, 2], finish: { side: 'top', from: 1, to: 2 }, flags: [] };
  assert.equal(checkBoard(gate), null);
  assert.equal(segmentKind(gate, 0, 1, 1, -2), 'wall');
  assert.equal(segmentKind(gate, 1, 1, 1, -2), 'finish');
  assert.equal(segmentKind(gate, 2, 2, 2, -2), 'finish');
  assert.equal(segmentKind(gate, 2, 2, 3, -2), 'wall');
  // 결승선이 아닌 변으로 나가면 벽이다
  assert.equal(segmentKind(gate, 0, 2, 0, 3), 'wall');
  assert.equal(segmentKind(gate, 0, 2, -1, 2), 'wall');
});

test('움직이기: 지난 움직임에 가로와 세로를 1까지 더한다. 할 수 없는 움직임은 차례에서 빠진다', () => {
  assert.equal(ACCELS.length, 9);
  assert.ok(isAccel([1, -1]) && !isAccel([2, 0]) && !isAccel([0]));
  const run = replay(ELL, [[1, 0], [1, 0], [1, 0]]);
  assert.deepEqual(
    run.states.map((s) => [s.x, s.y, s.vx, s.vy]),
    [
      [0, 3, 0, 0],
      [1, 3, 1, 0],
      [3, 3, 2, 0],
      [6, 3, 3, 0],
    ],
  );
  assert.equal(run.finished, false);
  assert.deepEqual(accelsOf(run.states), [[1, 0], [1, 0], [1, 0]]);
  // 세 번 빨라진 뒤에는 아홉 점 모두 벽이다
  assert.equal(isStuck(ELL, run.states.at(-1)), true);
  assert.equal(bruteStuck(ELL, run.states.at(-1)), true);
  assert.equal(replay(ELL, [[1, 0], [1, 0], [1, 0], [0, 0]]), null);
  assert.equal(replay(ELL, [[2, 0]]), null);
  // 제자리도 한 번의 움직임이다
  assert.deepEqual(replay(ELL, [[0, 0]]).states.at(-1), startState(ELL));
  // 결승선을 넘은 뒤에는 움직이지 않는다
  const path = solve(ELL).path;
  assert.equal(replay(ELL, path).finished, true);
  assert.equal(replay(ELL, [...path, [0, 0]]), null);
});

test('깃발 칸: 선이 깃발 칸에 닿은 뒤에만 결승선을 넘는다', () => {
  const board = { ...ELL, flags: [[0, 5]] };
  const plain = solve(ELL);
  // 깃발 없이 가장 적게 가는 길은 깃발 칸에 닿지 않아서 마지막 움직임을 할 수 없다
  const run = replay(board, plain.path.slice(0, -1));
  const last = plain.path.at(-1);
  assert.equal(tryMove(board, run.states.at(-1), last[0], last[1]).kind, 'flag');
  assert.equal(bruteReplay(board, plain.path), null);
  const flagged = solve(board);
  assert.ok(flagged.fewest > plain.fewest);
  assert.equal(flagged.fewest, bruteFewest(board));
  assert.equal(bruteReplay(board, flagged.path).finished, true);
});

test('가장 적은 움직임 수와 그 길: 사다리의 판(단계마다 판 번호 1~6)에서 다른 방법과 같다', () => {
  for (let level = 1; level <= 5; level++) {
    for (let seed = 1; seed <= 6; seed++) {
      const { board, solution } = generateBoard(level, seed);
      const result = solve(board);
      assert.equal(result.fewest, solution.fewest);
      assert.equal(bruteFewest(board), result.fewest, `${level}-${seed}`);
      const run = bruteReplay(board, result.path);
      assert.ok(run && run.finished && result.path.length === result.fewest, `${level}-${seed}`);
      // 같은 판에는 늘 같은 길
      assert.deepEqual(solve(board).path, result.path);
    }
  }
});

test('그릴 둘레: 갈 수 있는 차에서 결승선을 넘는 점은 모두 둘레 안에 있다(다른 방법으로 차를 모두 돌아본다)', () => {
  for (const level of [1, 3, 5]) {
    const { board } = generateBoard(level, 1);
    const { extent } = solve(board);
    const key = (s) => `${s.x},${s.y},${s.vx},${s.vy},${s.flag}`;
    const seen = new Set();
    let layer = [startState(board)];
    while (layer.length > 0) {
      const next = [];
      for (const s of layer) {
        for (const [ax, ay] of ACCELS) {
          const x = s.x + s.vx + ax;
          const y = s.y + s.vy + ay;
          const kind = bruteKind(board, s.x, s.y, x, y);
          if (kind === 'finish') assert.ok(x >= extent.x0 && x <= extent.x1 && y >= extent.y0 && y <= extent.y1, `${level}: (${x},${y})`);
          if (kind !== 'move') continue;
          const state = { x, y, vx: x - s.x, vy: y - s.y, flag: s.flag };
          if (seen.has(key(state))) continue;
          seen.add(key(state));
          next.push(state);
        }
      }
      layer = next;
    }
  }
});

test('깃발 칸마다의 가장 적은 수(깃발 단계가 판을 고를 때 쓴다)는 깃발을 놓고 다른 방법으로 푼 것과 같다', () => {
  const costs = flagCosts(ELL);
  ELL.rows.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      if (ch !== '.') return;
      assert.equal(costs.get(`${c},${r}`), bruteFewest({ ...ELL, flags: [[c, r]] }), `${c},${r}`);
    }),
  );
});

test('결승선까지 갈 수 없는 판: 풀이 프로그램과 다른 방법 모두 갈 수 없다고 한다', () => {
  const cut = { rows: ['...#..', '...#..', '...#..'], start: [0, 1], finish: { side: 'right', from: 0, to: 2 }, flags: [] };
  assert.equal(checkBoard(cut), null);
  const result = solve(cut);
  assert.equal(result.possible, false);
  assert.equal(result.fewest, null);
  assert.deepEqual(result.path, []);
  assert.equal(bruteFewest(cut), null);
});
