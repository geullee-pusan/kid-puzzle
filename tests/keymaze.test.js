// 열쇠 미로의 판과 풀이 프로그램을 확인한다.
// 걷기의 약속(벽, 한쪽 문, 잠긴 문, 열쇠 줍기, 계속 가지는 열쇠와 한 번 쓰면 없어지는 열쇠)을 하나씩 보고,
// 가장 적은 걸음과 나갈 수 있는지를 다른 방법(tests/helpers/brute-keymaze.js)으로 다시 구해 견준다:
// 2×2의 모든 판(문 네 자리마다 벽·열린 문·한쪽 문 둘·잠긴 문, 나가는 문 셋, 열쇠, 두 약속) 30,000개와, 시드 난수로 만든 3×3~4×4의 판 600개.
// 나갈 수 없는 판의 까닭(arrows, nokey, trap, twice)은 다른 방법으로 그 까닭이 정말 성립하는지 확인한다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { randomBoard } from '../src/core/keymaze-ladder.js';
import { checkBoard, copyBoard, doorOpen, exitRooms, explore, decode, heldOf, initialState, keyClosure, measure, movesFrom, orderMatters, reachFrom, reasonOf, replay, solve, tryStep, walkRate } from '../src/core/keymaze.js';
import { createRng, seedFrom } from '../src/core/rng.js';
import { OUT, bruteAlive, bruteBack, bruteDoorsNeeded, bruteReach, bruteReplay, bruteSolve, bruteWalks } from './helpers/brute-keymaze.js';

const openDoors = (w, h) => {
  const doors = [];
  for (let room = 0; room < w * h; room++) {
    if (room % w < w - 1) doors.push({ a: room, b: room + 1, kind: 'open' });
    if (room + w < w * h) doors.push({ a: room, b: room + w, kind: 'open' });
  }
  return doors;
};
const maze = (more) => copyBoard({ w: 3, h: 3, start: 0, exit: { room: 8, side: 'e', color: null }, doors: openDoors(3, 3), keys: [], keep: 'kept', ...more });

test('판 검사: 크기, 처음 방, 나가는 문(가장자리), 문 자리, 열쇠는 한 방에 하나, 잠긴 문과 열쇠는 여섯 개까지', () => {
  assert.equal(checkBoard(maze({})), null);
  assert.notEqual(checkBoard(maze({ w: 1 })), null);
  assert.notEqual(checkBoard(maze({ w: 6, h: 3 })), null);
  assert.notEqual(checkBoard(maze({ start: 9 })), null);
  // 나가는 문은 판의 가장자리에만(가운데 방의 변은 안 된다)
  assert.notEqual(checkBoard(maze({ exit: { room: 4, side: 'e', color: null } })), null);
  assert.equal(checkBoard(maze({ exit: { room: 1, side: 'n', color: 2 } })), null);
  assert.notEqual(checkBoard(maze({ exit: { room: 1, side: 'n', color: 3 } })), null);
  // 이웃하지 않은 방 사이, 같은 자리에 둘, 한쪽 문의 방향이 두 방이 아닌 것
  assert.notEqual(checkBoard(maze({ doors: [{ a: 0, b: 4, kind: 'open' }] })), null);
  assert.notEqual(checkBoard(maze({ doors: [{ a: 0, b: 1, kind: 'open' }, { a: 0, b: 1, kind: 'one', to: 1 }] })), null);
  assert.notEqual(checkBoard(maze({ doors: [{ a: 0, b: 1, kind: 'one', to: 2 }] })), null);
  assert.notEqual(checkBoard(maze({ keys: [{ room: 1, color: 0 }, { room: 1, color: 1 }] })), null);
  const many = Array.from({ length: 7 }, (_, room) => ({ room: room + 1, color: 0 }));
  assert.notEqual(checkBoard(maze({ keys: many.slice(0, 7) })), null);
  assert.equal(checkBoard(maze({ keys: many.slice(0, 6) })), null);
  // 베끼면 문은 a, b 차례로 늘어선다
  assert.deepEqual(copyBoard(maze({ doors: [{ a: 3, b: 4, kind: 'open' }, { a: 0, b: 1, kind: 'lock', color: 1 }] })).doors, [
    { a: 0, b: 1, kind: 'lock', color: 1 },
    { a: 3, b: 4, kind: 'open' },
  ]);
});

test('걷기: 이웃한 방만, 벽은 못 지나가고, 한쪽 문은 화살표 쪽으로만, 나가는 문은 그 방에서만', () => {
  const board = maze({ doors: [{ a: 0, b: 1, kind: 'one', to: 1 }, { a: 1, b: 2, kind: 'open' }, { a: 2, b: 5, kind: 'open' }, { a: 5, b: 8, kind: 'open' }] });
  const start = initialState(board);
  assert.deepEqual(tryStep(board, start, 4), { ok: false, why: 'far' });
  assert.deepEqual(tryStep(board, start, 3), { ok: false, why: 'wall' });
  const one = tryStep(board, start, 1);
  assert.equal(one.ok, true);
  assert.deepEqual(tryStep(board, one.state, 0), { ok: false, why: 'arrow', door: 0 });
  // 나가는 문이 있는 방에서만 판 밖(9)으로 나간다
  assert.equal(tryStep(board, one.state, 9).ok, false);
  const end = replay(board, [0, 1, 2, 5, 8, 9]);
  assert.equal(end.room, 9);
  assert.deepEqual(movesFrom(board, end), []);
  assert.equal(replay(board, [0, 3]), null);
  assert.equal(replay(board, [1, 2]), null);
  assert.deepEqual(solve(board), { possible: true, steps: 5, path: [0, 1, 2, 5, 8, 9], reason: null, detail: null, states: 6 });
});

test('열쇠: 방에 들어가면 줍는다. 계속 가지는 열쇠는 몇 번이든, 한 번 쓰는 열쇠는 문 하나를 열면 없어지고 그 문은 늘 열려 있다', () => {
  const doors = [
    { a: 0, b: 1, kind: 'open' },
    { a: 1, b: 2, kind: 'lock', color: 0 },
    { a: 0, b: 3, kind: 'lock', color: 0 },
    { a: 2, b: 5, kind: 'open' },
    { a: 5, b: 8, kind: 'open' },
  ];
  for (const keep of ['kept', 'used']) {
    const board = maze({ doors, keys: [{ room: 1, color: 0 }], keep });
    const start = initialState(board);
    assert.deepEqual(tryStep(board, start, 3), { ok: false, why: 'lock', door: 1, color: 0 });
    const got = tryStep(board, start, 1);
    assert.deepEqual(got.picked, [0]);
    assert.equal(heldOf(board, got.state, 0), 1);
    assert.equal(doorOpen(board, got.state, 2), keep === 'kept');
    const through = tryStep(board, got.state, 2);
    assert.equal(through.ok, true);
    assert.equal(through.opened, keep === 'used');
    assert.equal(heldOf(board, through.state, 0), keep === 'kept' ? 1 : 0);
    // 연 문은 거꾸로도 지나간다. 계속 가지는 열쇠는 다른 문도 연다, 한 번 쓰는 열쇠는 이미 썼다
    const back = tryStep(board, through.state, 1);
    assert.equal(back.ok, true);
    const home = tryStep(board, back.state, 0).state;
    assert.equal(tryStep(board, home, 3).ok, keep === 'kept');
  }
  // 처음 방의 열쇠는 처음부터 가지고 있다
  const ready = maze({ doors, keys: [{ room: 0, color: 0 }] });
  assert.equal(heldOf(ready, initialState(ready), 0), 1);
  // 나가는 문도 잠길 수 있다
  const locked = maze({ exit: { room: 8, side: 'e', color: 1 }, keys: [{ room: 4, color: 1 }] });
  assert.equal(solve(locked).steps, 5);
  assert.deepEqual(solve(locked).path.slice(0, 1), [0]);
  assert.ok(solve(locked).path.includes(4));
});

/** 2×2의 모든 판: 문 네 자리마다 다섯 가지, 나가는 문 셋, 잠기거나 열린 나가는 문, 열쇠 없음 또는 한 방, 두 약속 */
function allSmall() {
  const spots = [[0, 1], [0, 2], [1, 3], [2, 3]];
  const kinds = (a, b) => [null, { a, b, kind: 'open' }, { a, b, kind: 'one', to: a }, { a, b, kind: 'one', to: b }, { a, b, kind: 'lock', color: 0 }];
  const exits = [{ room: 1, side: 'e' }, { room: 2, side: 's' }, { room: 3, side: 'e' }];
  const boards = [];
  for (let code = 0; code < 5 ** 4; code++) {
    const doors = spots.map(([a, b], index) => kinds(a, b)[Math.floor(code / 5 ** index) % 5]).filter(Boolean);
    for (const exit of exits) {
      for (const color of [null, 0]) {
        for (const keyRoom of [null, 1, 2, 3]) {
          for (const keep of ['kept', 'used']) {
            boards.push({ w: 2, h: 2, start: 0, exit: { ...exit, color }, doors, keys: keyRoom === null ? [] : [{ room: keyRoom, color: 0 }], keep });
          }
        }
      }
    }
  }
  return boards;
}

/** 시드 난수로 만든 3×3~4×4의 판(사다리의 판 만들기를 쓰되 잣대는 보지 않는다) */
function randomBoards(count) {
  const rng = createRng(seedFrom('keymaze-test', count));
  const specs = [
    { sizes: [[3, 3], [4, 3]], ones: [1, 5], locks: [1, 3], colors: 2, extra: 0.4, exitLock: 0.3, keep: 'kept' },
    { sizes: [[3, 3], [3, 4], [4, 4]], ones: [0, 4], locks: [2, 4], colors: 2, extra: 0.4, exitLock: 0.4, keep: 'used' },
    { sizes: [[4, 4]], ones: [2, 6], locks: [1, 3], colors: 3, extra: 0.3, exitLock: 0.3, keep: 'kept' },
  ];
  return Array.from({ length: count }, (_, index) => randomBoard(rng, specs[index % specs.length]));
}

/** 까닭이 정말 성립하는지 다른 방법으로 본다 */
function reasonHolds(board, { reason, detail }) {
  const all = [0, 1, 2];
  if (reason === 'arrows') return !bruteReach(board, all).has(OUT);
  // 가져올 수 있는 열쇠의 색(되풀이해서 모은다)
  let colors = [];
  for (let grew = true; grew; ) {
    const rooms = bruteReach(board, colors);
    const next = [...new Set(board.keys.filter((key) => rooms.has(key.room)).map((key) => key.color))].sort();
    grew = next.length !== colors.length;
    colors = next;
  }
  const reach = bruteReach(board, colors);
  if (reason === 'nokey') return !reach.has(OUT) && !colors.includes(detail.color) && bruteReach(board, all).has(OUT);
  if (reason === 'trap') {
    if (!reach.has(OUT) || bruteReach(board, colors.filter((item) => item !== detail.color)).has(OUT)) return false;
    const back = new Set(bruteBack(board, colors));
    const keyRooms = board.keys.filter((key) => key.color === detail.color && reach.has(key.room)).map((key) => key.room);
    return keyRooms.length > 0 && keyRooms.every((room) => !back.has(room)) && JSON.stringify(keyRooms.sort((a, b) => a - b)) === JSON.stringify(detail.keyRooms.slice().sort((a, b) => a - b));
  }
  if (reason === 'twice') {
    const have = board.keys.filter((key) => key.color === detail.color).length;
    return board.keep === 'used' && have === detail.have && bruteDoorsNeeded(board, detail.color, colors) === detail.need && detail.need > have;
  }
  return reason === 'search';
}

test('2×2의 모든 판 30,000개: 나갈 수 있는지와 가장 적은 걸음이 다른 방법과 같고, 나갈 수 없는 까닭이 정말 성립한다', () => {
  const boards = allSmall();
  assert.equal(boards.length, 30000);
  const counts = { kept: {}, used: {} };
  for (const board of boards) {
    assert.equal(checkBoard(board), null);
    const mine = solve(board);
    const other = bruteSolve(board);
    assert.equal(mine.possible, other.possible, JSON.stringify(board));
    assert.equal(mine.steps, other.steps, JSON.stringify(board));
    assert.equal(mine.states, other.states, JSON.stringify(board));
    if (mine.possible) {
      counts[board.keep].possible = (counts[board.keep].possible ?? 0) + 1;
      // 풀이의 길을 다른 방법으로 걸어 보면 나간다
      assert.equal(bruteReplay(board, mine.path)?.room, OUT);
      assert.equal(mine.path.length - 1, mine.steps);
      continue;
    }
    counts[board.keep][mine.reason] = (counts[board.keep][mine.reason] ?? 0) + 1;
    assert.ok(reasonHolds(board, mine), `${mine.reason}: ${JSON.stringify(board)}`);
  }
  // 풀이 프로그램이 알려 준 것: 2×2에서는 모든 걸음을 따져 봐야 아는 판(search)이 없다. 열쇠를 한 번 쓰는 약속은 나갈 수 있는 판 318개를
  // 열쇠가 모자란 판(twice)으로 바꾼다(열쇠 방에서 나오는 문과 나가는 문이 같은 색인 판 등)
  assert.deepEqual(counts, {
    kept: { arrows: 5184, possible: 4820, nokey: 4692, trap: 304 },
    used: { arrows: 5184, possible: 4502, nokey: 4692, trap: 304, twice: 318 },
  });
});

test('시드 난수로 만든 3×3~4×4의 판 600개: 다른 방법과 같고, 까닭이 정말 성립한다. 작은 판은 모든 걸음의 차례를 걸어 보는 방법과도 같다', () => {
  const boards = randomBoards(600);
  const reasons = {};
  for (const board of boards) {
    assert.equal(checkBoard(board), null);
    const mine = solve(board);
    const other = bruteSolve(board);
    assert.deepEqual([mine.possible, mine.steps, mine.states], [other.possible, other.steps, other.states], JSON.stringify(board));
    if (mine.possible) assert.equal(bruteReplay(board, mine.path)?.room, OUT);
    else {
      reasons[mine.reason] = (reasons[mine.reason] ?? 0) + 1;
      assert.ok(reasonHolds(board, mine), `${mine.reason}: ${JSON.stringify(board)}`);
    }
    // 방이 아홉 개인 판은 걸음의 차례를 모두 걸어 봐도(14걸음까지) 같다
    if (board.w * board.h === 9) assert.equal(bruteWalks(board, 14), mine.possible && mine.steps <= 14 ? mine.steps : null, JSON.stringify(board));
  }
  // 열쇠를 한 번 쓰는 판에서는 열쇠 수보다 많은 문을 지나야 하는 판(twice)도, 모두 따져야 아는 판(search)도 나온다
  for (const reason of ['arrows', 'nokey', 'trap', 'twice', 'search']) assert.ok(reasons[reason] > 0, `${reason}: ${JSON.stringify(reasons)}`);
});

test('나갈 수 있는 모습과 갇히는 곳: 거꾸로 따라간 것이 되풀이해서 모은 것과 같다', () => {
  for (const board of [...randomBoards(150), ...allSmall().filter((_, index) => index % 37 === 0)]) {
    const mine = explore(board);
    const other = bruteAlive(board);
    assert.equal(mine.codes.length, other.all.size);
    const names = new Set(
      mine.codes
        .filter((code) => mine.alive.has(code))
        .map((code) => {
          const state = decode(mine.maze, code);
          const keys = board.keys.map((_, index) => index).filter((index) => Math.floor(state.keys / 2 ** index) % 2 === 1);
          const lockSpots = [];
          board.doors.forEach((door) => {
            if (door.kind === 'lock') lockSpots.push(`${door.a}-${door.b}`);
          });
          if (board.exit.color !== null) lockSpots.push('out');
          const open = lockSpots.filter((_, bit) => Math.floor(state.open / 2 ** bit) % 2 === 1);
          return `${state.room === board.w * board.h ? 'out' : state.room}|${keys.join(',')}|${open.sort().join(',')}`;
        }),
    );
    assert.deepEqual([...names].sort(), [...other.alive].sort());
    // 갇히는 곳의 수는 나갈 수 없는 모습의 수다(판 밖에 나온 모습은 늘 나갈 수 있는 모습이다)
    assert.equal(measure(board).doomed, other.all.size - other.alive.size);
  }
});

test('나갈 수 있는 방(거꾸로 따라가기)과 갈 수 있는 방: 되풀이해서 모은 것과 같다', () => {
  for (const board of randomBoards(200)) {
    for (const colors of [[], [0], [1], [0, 1], [0, 1, 2]]) {
      assert.deepEqual(exitRooms(board, new Set(colors)), bruteBack(board, colors));
      assert.deepEqual([...reachFrom(board, board.start, new Set(colors))].map((room) => (room === board.w * board.h ? OUT : room)).sort(), [...bruteReach(board, colors)].sort());
    }
    // 가져올 수 있는 열쇠의 색은 실제로 걸어서 주울 수 있는 색을 모두 담는다
    const closure = keyClosure(board);
    const { all } = bruteAlive(board);
    for (const [, state] of all) for (const index of state.keys) assert.ok(closure.colors.has(board.keys[index].color));
  }
});

test('열쇠를 쓰는 차례가 중요한 판: 한 번 쓰는 약속에서 갇히는 모습이 계속 가지는 약속에서는 나갈 수 있는 모습이다', () => {
  // 빨간 열쇠 하나, 빨간 문 둘(하나는 막다른 방으로)
  const board = maze({
    keep: 'used',
    keys: [{ room: 1, color: 0 }],
    doors: [
      { a: 0, b: 1, kind: 'open' },
      { a: 1, b: 2, kind: 'open' },
      { a: 1, b: 4, kind: 'lock', color: 0 },
      { a: 2, b: 5, kind: 'open' },
      { a: 5, b: 8, kind: 'lock', color: 0 },
    ],
  });
  assert.equal(orderMatters(board), true);
  assert.equal(orderMatters({ ...board, keep: 'kept' }), false);
  assert.equal(solve(board).steps, 5);
  // 빨간 문 둘을 지나야 하는데 빨간 열쇠가 하나면 나갈 수 없다(twice)
  const twice = maze({ keep: 'used', keys: [{ room: 1, color: 0 }], doors: [{ a: 0, b: 1, kind: 'open' }, { a: 1, b: 2, kind: 'lock', color: 0 }, { a: 2, b: 5, kind: 'lock', color: 0 }, { a: 5, b: 8, kind: 'open' }] });
  assert.deepEqual(reasonOf(twice), { reason: 'twice', detail: { color: 0, need: 2, have: 1 } });
  assert.equal(solve({ ...twice, keep: 'kept' }).possible, true);
});

test('아무렇게나 걷기: 같은 시드에는 같은 결과, 나간 걸음은 가장 적은 걸음 이상', () => {
  for (const board of randomBoards(30)) {
    const a = walkRate(board, createRng(7));
    const b = walkRate(board, createRng(7));
    assert.deepEqual(a, b);
    const { possible, steps } = solve(board);
    if (!possible) assert.equal(a.rate, 0);
    for (const length of a.lengths) assert.ok(length >= steps);
  }
});
