// 방 한 번씩 돌기의 사다리와 판 내기를 확인한다: 단계마다의 판, 같은 번호는 같은 판, 첫 판들,
// 섞이는 단계의 안 되는 판의 비율, 수가 적힌 판의 길이 하나뿐인지(걸어 본 것으로), 가려 내기 판의 집들, 큰 집의 까닭, 그리고 "더 작은 판".
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FIRST_BOARD, IMPOSSIBLE_RATE, LADDER, MAKE_LEVEL, MIX_FIRST, MIX_SECOND, TOP_LEVEL, answerKind, generateBoard, makeHouse, nextSeed, rungOf, smallBoards, smallerSizes } from '../src/core/rooms-ladder.js';
import { checkBoard, colorCheck, countPaths, roomsOf, shapeCheck, solve, solveHouse } from '../src/core/rooms.js';
import { createRng } from '../src/core/rng.js';
import { smallerRooms } from '../src/core/smaller.js';
import { bruteEnds, brutePaths, bruteValid } from './helpers/brute-rooms.js';

const SEEDS = Array.from({ length: 60 }, (_, index) => index + 1);
const area = (board) => board.w * board.h;
/** 설명할 수 있는 까닭 */
const TOLD = ['color', 'deadend', 'cut'];

test('사다리: 여섯 단계, 표시는 기본·응용·응용·도전·도전·도전, 맨 위는 직접 만들기', () => {
  assert.deepEqual(
    LADDER.map((rung) => [rung.level, rung.tag, rung.mode]),
    [
      [1, 'basic', 'draw'],
      [2, 'applied', 'mix'],
      [3, 'applied', 'numbers'],
      [4, 'challenge', 'judge'],
      [5, 'challenge', 'big'],
      [6, 'challenge', 'make'],
    ],
  );
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  assert.equal(IMPOSSIBLE_RATE, 1 / 3);
  assert.throws(() => rungOf(9));
  assert.throws(() => generateBoard(MAKE_LEVEL, 1));
});

test('같은 번호는 늘 같은 판이고, 낸 판은 규격에 맞고, 풀이 프로그램이 끝까지 따진 판이다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const small of [false, true]) {
      for (const seed of SEEDS.slice(0, 30)) {
        const made = generateBoard(level, seed, { small });
        assert.deepEqual(generateBoard(level, seed, { small }).board, made.board);
        const where = `${level}단계 ${seed}번 ${small}`;
        assert.equal(checkBoard(made.board), null, where);
        assert.notEqual(made.solution.possible, null, where);
        const rung = rungOf(level);
        const sizes = (small ? rung.small : rung.sizes).map(([w, h]) => `${w}x${h}`);
        const first = made.board.kind === 'judge' ? made.board.houses[0] : made.board;
        assert.ok(sizes.includes(`${first.w}x${first.h}`), `${where}: ${first.w}x${first.h}`);
      }
    }
  }
});

test('1단계: 4×4의 되는 판만. 첫 판은 맨 위 왼쪽에서 맨 아래 왼쪽까지(길 8가지)', () => {
  assert.deepEqual(generateBoard(1, 1).board, FIRST_BOARD);
  assert.equal(countPaths(FIRST_BOARD), 8);
  const pairs = new Set();
  for (const seed of SEEDS) {
    const { board, solution } = generateBoard(1, seed);
    assert.equal(solution.possible, true);
    assert.deepEqual([board.w, board.h, board.walls.length, board.numbers.length], [4, 4, 0, 0]);
    // 걸어 본 것으로도 된다
    assert.ok((bruteEnds(4, 4, [], board.start).get(board.end) ?? 0) > 0);
    pairs.add(`${board.start}-${board.end}`);
  }
  assert.ok(pairs.size >= 25, `서로 다른 짝 ${pairs.size}개`);
  for (const seed of SEEDS.slice(0, 20)) assert.equal(generateBoard(1, seed, { small: true }).solution.possible, true);
});

test('2단계: 첫 판은 되는 판, 둘째 판은 맨 위 왼쪽에서 맨 아래 오른쪽(아주 쉬운 안 되는 판). 안 되는 판은 셋에 하나쯤이고 모두 색 때문이다', () => {
  assert.deepEqual(generateBoard(2, 1).board, MIX_FIRST);
  assert.deepEqual(generateBoard(2, 2).board, MIX_SECOND);
  assert.equal(generateBoard(2, 1).solution.possible, true);
  assert.equal(generateBoard(2, 2).solution.reason, 'color');
  for (const small of [false, true]) {
    let impossible = 0;
    for (const seed of SEEDS) {
      const { board, solution } = generateBoard(2, seed, { small });
      const ways = bruteEnds(board.w, board.h, [], board.start).get(board.end) ?? 0;
      assert.equal(solution.possible, ways > 0, `${seed}`);
      if (!solution.possible) {
        impossible += 1;
        assert.equal(solution.reason, 'color', `${seed}`);
      }
    }
    assert.ok(impossible >= SEEDS.length * 0.2 && impossible <= SEEDS.length * 0.5, `${small}: 안 되는 판 ${impossible}개`);
  }
});

test('3단계: 수가 몇 개 적힌 집. 적힌 차례대로 가는 길은 꼭 하나다(걸어 본 것으로 센다). 처음 방은 1, 끝 방은 마지막 수', () => {
  for (const small of [false, true]) {
    for (const seed of SEEDS.slice(0, 40)) {
      const { board, solution } = generateBoard(3, seed, { small });
      const where = `${seed}번 ${small}`;
      const n = roomsOf(board).length;
      assert.equal(solution.possible, true, where);
      const all = brutePaths(board, 3);
      assert.equal(all.length, 1, `${where}: 길 ${all.length}가지`);
      assert.deepEqual(all[0], solution.path, where);
      assert.equal(countPaths(board), 1, where);
      assert.deepEqual(board.numbers[0], [board.start, 1], where);
      assert.deepEqual(board.numbers.at(-1), [board.end, n], where);
      // 처음 방과 끝 방 말고도 둘 이상 적혀 있고, 모든 방에 적혀 있지는 않다
      const inner = board.numbers.length - 2;
      assert.ok(inner >= 2 && inner <= n / 2, `${where}: 적힌 수 ${inner}개`);
    }
  }
});

test('4단계: 같은 꼴의 집 셋이나 넷. 처음 방과 끝 방의 짝이 서로 다르고, 안 되는 집은 하나~셋이며 모두 설명할 수 있는 까닭이다', () => {
  const shapeKinds = new Set();
  let withShape = 0;
  for (const small of [false, true]) {
    for (const seed of SEEDS) {
      const { board, solution } = generateBoard(4, seed, { small });
      const where = `${seed}번 ${small}`;
      assert.equal(board.houses.length, small ? 3 : 4, where);
      const [first] = board.houses;
      const pairs = new Set();
      for (const one of board.houses) {
        assert.deepEqual([one.w, one.h, one.walls], [first.w, first.h, first.walls], where);
        pairs.add([Math.min(one.start, one.end), Math.max(one.start, one.end)].join('-'));
      }
      assert.equal(pairs.size, board.houses.length, `${where}: 같은 짝이 두 번`);
      assert.ok(solution.impossible.length >= 1 && solution.impossible.length <= 3, where);
      assert.ok(solution.impossible.length < board.houses.length, `${where}: 되는 집이 하나는 있다`);
      board.houses.forEach((one, index) => {
        const result = solution.houses[index];
        const ways = bruteEnds(one.w, one.h, one.walls, one.start).get(one.end) ?? 0;
        assert.equal(result.possible, ways > 0, where);
        if (!result.possible) assert.ok(TOLD.includes(result.reason), `${where}: ${result.reason}`);
        if (result.reason === 'deadend' || result.reason === 'cut') {
          shapeKinds.add(result.reason);
          withShape += 1;
        }
      });
    }
  }
  assert.deepEqual(generateBoard(4, 1).board.houses.map((one) => [one.w, one.h, one.walls.length]), [[4, 4, 0], [4, 4, 0], [4, 4, 0], [4, 4, 0]]);
  assert.equal(generateBoard(4, 1).solution.impossible.length, 2);
  assert.ok(withShape >= 10, `생김새 때문에 안 되는 집 ${withShape}채`);
});

test('5단계: 5×5, 6×5, 6×6에 정원 1~4칸. 안 되는 판은 셋에 하나쯤이고, 색은 맞는데 생김새 때문에 안 되는 판도 있다. 첫 판은 되는 판, 둘째 판은 생김새', () => {
  const tally = { possible: 0, color: 0, deadend: 0, cut: 0 };
  for (const seed of SEEDS) {
    const { board, solution } = generateBoard(5, seed);
    const where = `${seed}번`;
    assert.ok(board.walls.length >= 1 && board.walls.length <= 4, where);
    const key = solution.possible ? 'possible' : solution.reason;
    assert.ok(key in tally, `${where}: ${key}`);
    tally[key] += 1;
    if (solution.possible) assert.equal(bruteValid(board, solution.path), true, where);
    else if (key === 'color') assert.equal(shapeCheck(board), null, `${where}: 색 판은 생김새가 문제없다`);
    else assert.equal(colorCheck(board).ok, true, `${where}: 생김새 판은 색이 맞는다`);
  }
  assert.equal(generateBoard(5, 1).solution.possible, true);
  assert.ok(['deadend', 'cut'].includes(generateBoard(5, 2).solution.reason));
  const impossible = SEEDS.length - tally.possible;
  assert.ok(impossible >= SEEDS.length * 0.2 && impossible <= SEEDS.length * 0.5, JSON.stringify(tally));
  assert.ok(tally.color >= 5 && tally.deadend + tally.cut >= 5, JSON.stringify(tally));
  // 작은 판부터일 때는 4×4와 5×4
  for (const seed of SEEDS.slice(0, 20)) {
    const { board } = generateBoard(5, seed, { small: true });
    assert.ok(area(board) <= 20);
  }
});

test('다음 판 번호는 방금 한 판과 다른 판이 나오는 번호다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of [1, 2, 5]) {
      const next = nextSeed(level, seed);
      assert.ok(next > seed);
      assert.notDeepEqual(generateBoard(level, next).board, generateBoard(level, seed).board);
    }
  }
});

test('원하는 답의 집 만들기: 되는 집, 색 때문에 안 되는 집(맞지 않는 것까지), 문이 하나뿐인 방, 지나면 나뉘는 방', () => {
  const rng = createRng(3);
  for (const [want, detail] of [['possible', null], ['color', 'same'], ['color', 'minor'], ['color', 'count'], ['deadend', null], ['cut', null]]) {
    for (let k = 0; k < 6; k++) {
      // 칸이 20개라 정원이 하나면 방이 홀수 개(적은 쪽 색), 둘이면 짝수 개(같은 색, 수의 차이)
      const board = makeHouse(rng, { w: 5, h: 4, walls: want === 'possible' ? 0 : detail === 'minor' ? 1 : 2, want, detail });
      assert.ok(board, `${want} ${detail}`);
      assert.deepEqual(answerKind(board), { want, detail }, `${want} ${detail}`);
    }
  }
  assert.deepEqual(smallerSizes(4, 4), [[4, 3], [3, 3]]);
  assert.deepEqual(smallerSizes(3, 3), []);
  assert.deepEqual(smallerSizes(6, 6)[0], [6, 5]);
});

test('"더 작은 판": 원래 판보다 작고, 답의 종류가 같다(되는 집은 되는 집, 안 되는 집은 같은 까닭). 같은 판에서는 늘 같은 판이다', () => {
  let none = 0;
  let checked = 0;
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of SEEDS.slice(0, 25)) {
      const { board } = generateBoard(level, seed);
      const origin = { mode: rungOf(level).mode, board };
      const list = smallBoards(origin);
      if (list.length === 0) {
        none += 1;
        continue;
      }
      for (let turn = 0; turn < 3; turn++) {
        const small = smallerRooms(origin, turn);
        assert.deepEqual(smallerRooms(origin, turn), small);
        assert.deepEqual(small.board, list[turn % list.length]);
      }
      for (const item of list) {
        const where = `${level}단계 ${seed}번`;
        assert.equal(checkBoard(item), null, where);
        checked += 1;
        if (board.kind === 'judge') {
          assert.equal(item.kind, 'judge', where);
          assert.ok(area(item.houses[0]) < area(board.houses[0]), where);
          const result = solve(item);
          assert.ok(result.impossible.length >= 1 && result.impossible.length < item.houses.length, where);
          for (const one of result.houses) if (!one.possible) assert.ok(TOLD.includes(one.reason), where);
          continue;
        }
        assert.ok(area(item) < area(board), `${where}: ${area(board)} → ${area(item)}`);
        if (board.numbers.length > 0) {
          assert.ok(item.numbers.length > 0, where);
          assert.equal(brutePaths(item, 3).length, 1, where);
          continue;
        }
        assert.deepEqual(answerKind(item), answerKind(board), where);
        // 걸어 본 것으로도 답이 같다
        const ways = bruteEnds(item.w, item.h, item.walls, item.start).get(item.end) ?? 0;
        assert.equal(ways > 0, answerKind(board).want === 'possible', where);
      }
    }
  }
  assert.ok(checked > 200, `${checked}`);
  // 작은 판이 없는 것은 3×3 가려 내기뿐이다
  assert.ok(none < 20, `없는 판 ${none}개`);
  assert.equal(smallerRooms({ mode: 'mix', board: null }), null);
  assert.equal(smallerRooms({ mode: 'mix', board: { kind: 'house', w: 3, h: 3, walls: [], start: 0, end: 8, numbers: [] } }), null);
  // 모든 길을 따져야만 아는 집에는 작은 판이 없다
  assert.equal(smallerRooms({ mode: 'mix', board: { kind: 'house', w: 4, h: 3, walls: [], start: 1, end: 7, numbers: [] } }), null);
  assert.equal(solveHouse({ kind: 'house', w: 4, h: 3, walls: [], start: 1, end: 7, numbers: [] }).reason, 'search');
});
