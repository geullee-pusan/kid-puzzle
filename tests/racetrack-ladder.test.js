// 모눈 자동차 경주의 사다리와 판 내기, 더 작은 판: 단계마다 길의 꼴, 가장 적은 움직임 수의 범위, 화면에 그릴 둘레,
// 깃발 칸이 돌아가게 하는지를 보고, 가장 적은 수는 다른 방법(tests/helpers/brute-racetrack.js)으로 다시 따진다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LADDER, MAKE_LEVEL, TOP_LEVEL, VIEW_H, VIEW_W, fitsView, generateBoard, nextSeed, recordMode, rungOf, shapeBoard, smallBoards, transform } from '../src/core/racetrack-ladder.js';
import { checkBoard, sameBoard, solve } from '../src/core/racetrack.js';
import { createRng } from '../src/core/rng.js';
import { smallerRacetrack } from '../src/core/smaller.js';
import { bruteFewest } from './helpers/brute-racetrack.js';

const SEEDS = Array.from({ length: 30 }, (_, index) => index + 1);

test('사다리: 여섯 단계, 표시는 기본·기본·응용·응용·도전·도전, 맨 위는 직접 만들기', () => {
  assert.deepEqual(LADDER.map((rung) => rung.level), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(LADDER.map((rung) => rung.tag), ['basic', 'basic', 'applied', 'applied', 'challenge', 'challenge']);
  assert.deepEqual(LADDER.map((rung) => rung.mode), ['straight', 'corner', 'fewest', 'flag', 'big', 'make']);
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  assert.throws(() => generateBoard(6, 1));
  assert.throws(() => generateBoard(1, 0));
  assert.throws(() => rungOf(9));
  assert.deepEqual(['straight', 'corner', 'fewest', 'flag', 'big', 'made'].map(recordMode), [false, false, true, true, true, true]);
  // 1180×820 화면의 판 칸(가로 476픽셀, 세로 432픽셀쯤)에서 한 칸이 44픽셀보다 크다
  assert.ok(476 / (VIEW_W + 0.24) >= 44 && 432 / (VIEW_H + 0.24) >= 44);
});

test('돌리고 뒤집기: 여덟 가지 모두 맞는 판이고 가장 적은 수가 같다', () => {
  const base = shapeBoard('ell', createRng(5));
  const fewest = solve(base).fewest;
  for (let turn = 0; turn < 8; turn++) {
    const board = transform(base, turn);
    assert.equal(checkBoard(board), null, `${turn}`);
    assert.equal(solve(board).fewest, fewest, `${turn}`);
  }
  assert.deepEqual(transform(transform(base, 2), 2), base);
});

test('판 번호 1~30: 같은 번호는 같은 판이고 단계의 잣대에 맞다. 화면에 그릴 둘레가 가로 10칸, 세로 9칸 안이다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    const rung = rungOf(level);
    for (const seed of SEEDS) {
      const where = `${level}-${seed}`;
      const { board, solution } = generateBoard(level, seed);
      assert.deepEqual(generateBoard(level, seed).board, board, where);
      assert.equal(checkBoard(board), null, where);
      const result = solve(board);
      assert.equal(result.fewest, solution.fewest, where);
      assert.ok(fitsView(result.extent), where);
      assert.ok(solution.fewest >= rung.least && solution.fewest <= rung.most, `${where}: ${solution.fewest}`);
      if (rung.mode === 'straight') assert.ok(board.rows.every((row) => !row.includes('#')), where);
      else assert.ok(result.stuck > 0, `${where}: 아홉 점 모두 막히는 자리가 있다`);
      if (rung.mode === 'flag') {
        assert.equal(board.flags.length, 1, where);
        assert.ok(solution.fewest > solve({ ...board, flags: [] }).fewest, `${where}: 깃발 칸에 들르면 더 걸린다`);
      } else assert.deepEqual(board.flags, [], where);
      if (seed <= 3) assert.equal(bruteFewest(board), solution.fewest, where);
    }
  }
});

test('첫 판들: 곧은 길은 세 번이면 넘는다. 수준 맞추기의 작은 판은 짧은 곧은 길이다', () => {
  for (const seed of [1, 2, 3]) assert.equal(generateBoard(1, seed).solution.fewest, 3);
  const small = generateBoard(1, 9, { small: true });
  assert.equal(small.small, true);
  assert.ok(small.board.rows.every((row) => !row.includes('#')));
  assert.ok(small.solution.fewest <= 3);
  assert.equal(generateBoard(2, 9, { small: true }).small, false);
});

test('다음 판 번호는 방금 한 판과 같은 판을 건너뛴다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of SEEDS.slice(0, 8)) {
      const next = nextSeed(level, seed);
      assert.ok(next > seed);
      assert.equal(sameBoard(generateBoard(level, next).board, generateBoard(level, seed).board), false, `${level}: ${seed}→${next}`);
    }
  }
  assert.equal(nextSeed(MAKE_LEVEL, 4), 5);
});

test('더 작은 판: 같은 종류로 가장 적은 수가 적고(2 이상) 화면에 들어간다. 곧은 길에는 더 작은 판이 없다', () => {
  for (const seed of SEEDS.slice(0, 6)) {
    assert.deepEqual(smallBoards({ mode: 'straight', board: generateBoard(1, seed).board }), []);
    assert.equal(smallerRacetrack({ mode: 'straight', board: generateBoard(1, seed).board }, 0), null);
    for (const level of [2, 3, 4, 5]) {
      const { board, solution } = generateBoard(level, seed);
      const mode = rungOf(level).mode;
      const list = smallBoards({ mode, board });
      assert.ok(list.length >= 1, `${level}-${seed}`);
      for (const small of list) {
        assert.equal(checkBoard(small), null);
        const result = solve(small);
        assert.ok(result.fewest >= 2 && result.fewest < solution.fewest, `${level}-${seed}: ${result.fewest}`);
        assert.ok(fitsView(result.extent));
        assert.equal(small.flags.length, mode === 'flag' ? 1 : 0);
        if (mode === 'flag') assert.ok(result.fewest > solve({ ...small, flags: [] }).fewest);
      }
      // 틀이 쓰는 함수: 같은 판에서는 차례마다 같은 판
      assert.deepEqual(smallerRacetrack({ mode, board }, 1), smallerRacetrack({ mode, board }, 1));
      assert.deepEqual(smallerRacetrack({ mode, board }, 0).board, list[0]);
    }
  }
  // 직접 만든 판은 가장 적게 가기의 작은 판을 낸다
  const made = generateBoard(3, 1).board;
  assert.ok(smallBoards({ mode: 'made', board: made }).length >= 1);
  assert.equal(smallerRacetrack({ mode: 'made', board: null }, 0), null);
});
