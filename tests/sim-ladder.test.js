// 세모 피하기의 사다리: 단계마다 판의 종류와 크기, 선생님이 두는 법, 같은 번호는 늘 같은 판인지,
// 칠하기 판의 되는 판과 안 되는 판(셋에 하나, 아이가 볼 수 있는 까닭), 작은 판을 본다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LADDER, MAKE_LEVEL, PAINT_CYCLE, TOP_LEVEL, generateBoard, nextSeed, rungOf, teacherOf } from '../src/core/sim-ladder.js';
import { checkBoard, emptyBoard, endsOf, freeCount, reasonOf, solvePaint } from '../src/core/sim.js';
import { smallerSim } from '../src/core/smaller.js';
import { brutePaintCount } from './helpers/brute-sim.js';

const SEEDS = Array.from({ length: 60 }, (_, index) => index + 1);

test('사다리: 여섯 단계이고 표시는 기본·기본·응용·도전·도전·도전, 맨 위는 직접 만들기', () => {
  assert.deepEqual(LADDER.map((rung) => rung.level), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(LADDER.map((rung) => rung.tag), ['basic', 'basic', 'applied', 'challenge', 'challenge', 'challenge']);
  assert.deepEqual(LADDER.map((rung) => rung.mode), ['game', 'paint', 'game', 'game', 'paint', 'make']);
  assert.deepEqual(LADDER.map((rung) => rung.n ?? null), [5, 5, 6, 6, 6, null]);
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  // 선생님: 1단계는 자기 세모만 피하고, 3단계는 남은 선이 적어지면 잘 두고, 4단계와 직접 만든 판은 늘 잘 둔다.
  assert.deepEqual([1, 3, 4].map((level) => teacherOf(level, false)), ['easy', 'fair', 'best']);
  assert.equal(teacherOf(1, true), 'best');
  // 먼저 그을지: 1단계는 아이가 먼저, 3·4단계는 두기 전에 고른다.
  assert.equal(rungOf(1).order, 'first');
  assert.equal(rungOf(3).order, 'choose');
  assert.equal(rungOf(4).order, 'choose');
  assert.throws(() => rungOf(7));
  assert.throws(() => generateBoard(MAKE_LEVEL, 1));
});

test('같은 번호는 늘 같은 판이고, 낸 판은 쓸 수 있는 판이다. 게임 판은 그 단계의 점 수의 빈 판이다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    const rung = rungOf(level);
    for (const seed of SEEDS) {
      const made = generateBoard(level, seed);
      assert.deepEqual(generateBoard(level, seed), made, `${level}단계 ${seed}번`);
      assert.equal(checkBoard(made.board), null);
      assert.equal(made.board.kind, rung.mode);
      assert.equal(made.board.n, rung.n);
      if (rung.mode === 'game') assert.deepEqual(made.board, emptyBoard('game', rung.n));
    }
    // 수준 맞추기의 작은 판: 점이 하나 적은 빈 판
    assert.deepEqual(generateBoard(level, 1, { small: true }).board, emptyBoard(rung.mode, rung.small));
    assert.equal(rung.small, rung.n - 1);
  }
});

test('칠하기 판: 첫 판은 빈 판이고, 그다음은 되는 판·안 되는 판·되는 판의 차례다. 풀이는 모두 칠해 본 수와 같다', () => {
  assert.deepEqual(PAINT_CYCLE, ['open', 'closed', 'open']);
  for (const level of [2, 5]) {
    const n = rungOf(level).n;
    assert.deepEqual(generateBoard(level, 1).board, emptyBoard('paint', n));
    let closed = 0;
    for (const seed of SEEDS) {
      const { board, solution } = generateBoard(level, seed);
      const count = brutePaintCount(board);
      assert.equal(solution.count, count, `${level}단계 ${seed}번`);
      assert.equal(solution.possible, count > 0);
      // 안 되는 판에는 늘 아이가 볼 수 있는 까닭이 있고, 되는 판에는 없다.
      if (solution.possible) assert.equal(reasonOf(board), null);
      else assert.ok(solution.reason, `${level}단계 ${seed}번: 까닭이 없는 안 되는 판`);
      if (seed > 1) {
        const kind = PAINT_CYCLE[(seed - 2) % 3];
        assert.equal(solution.possible, kind === 'open', `${level}단계 ${seed}번`);
      }
      if (!solution.possible) closed += 1;
      // 칠할 선이 여섯 이상 남아 있다(한두 번에 끝나는 판이 아니다).
      assert.ok(freeCount(board) >= 6, `${level}단계 ${seed}번: 칠할 선 ${freeCount(board)}개`);
    }
    // 안 되는 판은 셋에 하나쯤이다(5단계는 첫 판이 안 되는 판이라 하나 많다).
    assert.ok(closed >= 19 && closed <= 21, `${level}단계: 안 되는 판 ${closed}개`);
  }
});

test('다섯 점 칠하기의 안 되는 판은 한 점에서 같은 색 선 셋이다. 여섯 점의 되는 판은 이웃한 두 점 사이의 선 하나가 없다', () => {
  for (const seed of SEEDS) {
    const five = generateBoard(2, seed);
    if (!five.solution.possible) {
      assert.equal(five.solution.reason.kind, 'given');
      assert.ok(five.board.red.length + five.board.blue.length <= 4);
    }
    const six = generateBoard(5, seed);
    if (six.solution.possible) {
      assert.equal(six.board.gone.length, 1);
      const [a, b] = endsOf(6, six.board.gone[0]);
      assert.ok(b - a === 1 || (a === 0 && b === 5), `5단계 ${seed}번: 이웃한 두 점`);
    } else if (six.board.gone.length > 0) assert.equal(six.solution.reason.kind, 'given');
    else assert.ok(['many', 'given'].includes(six.solution.reason.kind));
  }
  // 5단계의 안 되는 판에는 선이 다 있는 여섯 점과 선 하나가 없는 판이 모두 나온다.
  const closed = SEEDS.map((seed) => generateBoard(5, seed)).filter((made) => !made.solution.possible);
  assert.ok(closed.some((made) => made.board.gone.length === 0) && closed.some((made) => made.board.gone.length === 1));
});

test('다음 판 번호: 방금 한 판과 똑같은 판은 건너뛴다(게임 판은 늘 같은 빈 판이라 다음 번호다)', () => {
  assert.equal(nextSeed(1, 3), 4);
  for (const seed of SEEDS.slice(0, 20)) {
    const next = nextSeed(2, seed);
    assert.ok(next > seed);
    assert.notDeepEqual(generateBoard(2, next).board, generateBoard(2, seed).board);
  }
});

test('"더 작은 판으로": 게임은 점이 하나 적은 빈 판, 칠하기는 점 하나를 뺀 판(되는 판이면 되는 판만, 안 되는 판이면 되는 판부터 번갈아)', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of SEEDS.slice(0, 30)) {
      const { board, solution } = generateBoard(level, seed);
      const origin = { mode: board.kind, board };
      for (const turn of [0, 1, 2, 3]) {
        const small = smallerSim(origin, turn);
        assert.ok(small, `${level}단계 ${seed}번 ${turn}`);
        assert.equal(checkBoard(small.board), null);
        assert.equal(small.board.kind, board.kind);
        assert.ok(small.board.n < board.n);
        assert.deepEqual(smallerSim(origin, turn), small, '같은 판, 같은 차례에는 같은 작은 판');
        if (board.kind === 'game') {
          assert.deepEqual(small.board, emptyBoard('game', board.n - 1 - (turn % (board.n - 4))));
          continue;
        }
        assert.equal(small.board.n, board.n - 1);
        const possible = brutePaintCount(small.board) > 0;
        if (solution.possible || turn % 2 === 0) assert.equal(possible, true, `${level}단계 ${seed}번 ${turn}`);
        if (!possible) assert.ok(reasonOf(small.board), '작은 판의 안 되는 판에도 볼 수 있는 까닭이 있다');
        assert.ok(solvePaint(small.board).count === brutePaintCount(small.board));
      }
    }
  }
  assert.equal(smallerSim({ board: emptyBoard('game', 4) }, 0), null);
  assert.equal(smallerSim({ board: emptyBoard('paint', 4) }, 0), null);
  assert.equal(smallerSim({ board: null }, 0), null);
});
