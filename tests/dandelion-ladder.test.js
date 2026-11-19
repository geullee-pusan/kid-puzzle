// 민들레와 바람의 사다리와 판 내기 점검.
// 단계마다의 판, 같은 번호는 같은 판, 판마다 풀이 프로그램의 결과가 붙어 있는지, 단계가 아이에게 정해 준 쪽이 맞는 판인지,
// 혼자 덮기의 가장 적은 꽃 수가 다른 방법과 같은지, 맨 처음 판은 실패할 수 없는지를 본다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LADDER, MAKE_LEVEL, TOP_LEVEL, boardOf, generateBoard, nextSeed, rungOf } from '../src/core/dandelion-ladder.js';
import { checkBoard, movesOf, pickMove, replay, solve, solveCover } from '../src/core/dandelion.js';
import { createRng } from '../src/core/rng.js';
import { bruteCover } from './helpers/brute-dandelion.js';

const SEEDS = Array.from({ length: 30 }, (_, index) => index + 1);

test('사다리: 여섯 단계이고 맨 위는 직접 만들기다. 꽃 → 바람 → 고르기 → 여덟 방향이 섞인 고르기 → 혼자 덮기 → 직접 만들기', () => {
  assert.equal(LADDER.length, 6);
  assert.deepEqual(LADDER.map((rung) => rung.level), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(LADDER.map((rung) => rung.tag), ['basic', 'applied', 'applied', 'challenge', 'applied', 'challenge']);
  assert.deepEqual(LADDER.map((rung) => rung.mode), ['game', 'game', 'game', 'game', 'cover', 'make']);
  assert.deepEqual(LADDER.map((rung) => rung.role), ['flower', 'wind', 'choose', 'choose', null, 'choose']);
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  assert.throws(() => rungOf(7));
  assert.throws(() => generateBoard(MAKE_LEVEL, 1));
});

test('같은 (단계, 판 번호)는 늘 같은 판이다. 판마다 풀이 프로그램으로 푼 결과가 붙어 있다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of SEEDS) {
      const made = generateBoard(level, seed);
      assert.deepEqual(generateBoard(level, seed), made);
      assert.equal(checkBoard(made.board), null, `${level}단계 ${seed}번`);
      if (made.board.kind === 'game') assert.equal(made.solution.winner, solve(made.board).winner);
      else assert.equal(made.solution.best, solveCover(made.board).best);
    }
  }
});

test('형식의 맨 첫 판은 실패할 수 없다: 2×2이고 아이가 꽃이다. 어떻게 심어도, 바람이 어떻게 불어도 다 덮인다', () => {
  const first = generateBoard(1, 1).board;
  assert.deepEqual(first, { kind: 'game', w: 2, h: 2, dirs: 4 });
  // 모든 차례를 따진다.
  let games = 0;
  const walk = (trail) => {
    const now = replay(first, trail);
    if (now.over) {
      assert.equal(now.winner, 'flower', JSON.stringify(trail));
      games += 1;
      return;
    }
    for (const move of movesOf(first, trail)) walk([...trail, move]);
  };
  walk([]);
  assert.ok(games > 100);
});

test('1단계(아이가 꽃): 잘 두면 꽃이 이기는 판만 나온다. 3×3이 가장 자주 나온다', () => {
  const boards = SEEDS.slice(1).map((seed) => generateBoard(1, seed).board);
  for (const board of boards) {
    assert.equal(board.dirs, 4);
    assert.equal(solve(board).winner, 'flower', `${board.w}×${board.h}`);
  }
  const count = boards.filter((board) => board.w === 3 && board.h === 3).length;
  assert.ok(count >= boards.length / 4);
  assert.equal(rungOf(1).boards.length, 8);
});

test('2단계(아이가 바람): 잘 두면 바람이 이기는 판만 나온다(가로나 세로가 5칸인 네 방향 판)', () => {
  for (const seed of SEEDS) {
    const { board, solution } = generateBoard(2, seed);
    assert.equal(solution.winner, 'wind', `${board.w}×${board.h}`);
    assert.equal(Math.max(board.w, board.h), 5);
    assert.equal(board.dirs, 4);
  }
});

test('3, 4단계(고르기): 꽃이 이기는 판과 바람이 이기는 판이 섞이고, 처음 여섯 판 안에 둘 다 나온다. 4단계에는 여덟 방향 판이 있다', () => {
  for (const level of [3, 4]) {
    const winners = SEEDS.map((seed) => generateBoard(level, seed).solution.winner);
    assert.ok(winners.slice(0, 6).includes('flower') && winners.slice(0, 6).includes('wind'), `${level}단계`);
    const wind = winners.filter((winner) => winner === 'wind').length;
    assert.ok(wind >= winners.length / 4 && wind <= (winners.length * 3) / 4, `${level}단계: 바람 ${wind}`);
  }
  assert.ok(SEEDS.every((seed) => generateBoard(3, seed).board.dirs === 4));
  const eight = SEEDS.map((seed) => generateBoard(4, seed).board).filter((board) => board.dirs === 8);
  assert.ok(eight.length > 0);
  for (const board of eight) assert.equal(solve(board).winner, 'flower', '여덟 방향은 4×4까지 늘 꽃이 이긴다');
});

test('차례에서 이웃한 두 판은 늘 다르다(맨 끝과 맨 처음도)', () => {
  for (const rung of LADDER.filter((item) => item.boards)) {
    const list = rung.boards.map((entry) => JSON.stringify(entry));
    list.forEach((entry, index) => assert.notEqual(entry, list[(index + 1) % list.length], `${rung.level}단계 ${index}`));
  }
});

test('5단계(혼자 덮기): 모든 판을 덮을 수 있고, 가장 적은 꽃 수는 다른 방법(아무 때나 심거나 건너뛰기)과 같다', () => {
  const found = rungOf(5).boards.map((entry) => {
    const board = boardOf(entry, 'cover');
    const solved = solveCover(board);
    assert.equal(solved.possible, true);
    // 한 송이로 끝나는 판은 넣지 않는다.
    assert.ok(solved.best >= 2);
    assert.equal(solved.best, bruteCover(board.w, board.h, board.order), JSON.stringify(entry));
    return `${board.w}×${board.h}/${board.dirs}:${solved.best}`;
  });
  assert.deepEqual(found, ['3×3/4:3', '4×3/4:3', '4×4/4:4', '5×3/4:3', '4×3/4:4', '4×4/8:2', '5×4/4:4']);
  // 같은 4×3이라도 바람의 차례에 따라 3송이와 4송이로 갈린다.
  assert.notEqual(rungOf(5).boards[1][3].join(''), rungOf(5).boards[4][3].join(''));
});

test('작은 판부터: 단계마다 작은 판이 정해져 있고, 그 단계의 조건에 맞는다', () => {
  assert.deepEqual(generateBoard(1, 5, { small: true }).board, { kind: 'game', w: 3, h: 2, dirs: 4 });
  assert.equal(generateBoard(1, 5, { small: true }).solution.winner, 'flower');
  assert.equal(generateBoard(2, 5, { small: true }).solution.winner, 'wind');
  assert.equal(generateBoard(5, 5, { small: true }).solution.best, 3);
});

test('"새 판"은 방금 한 판과 다른 판이다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of SEEDS) {
      const next = nextSeed(level, seed);
      assert.ok(next > seed);
      assert.notDeepEqual(generateBoard(level, next).board, generateBoard(level, seed).board, `${level}단계 ${seed}번`);
    }
  }
});

test('만들어 낸 판을 실제로 두어 본다: 이기는 쪽에서 이기는 수만 두면 이기고, 지는 쪽은 아무렇게나 두어도 진다', () => {
  for (let level = 1; level <= 4; level++) {
    for (const seed of SEEDS.slice(0, 10)) {
      const { board, solution } = generateBoard(level, seed);
      const rng = createRng(level * 1000 + seed);
      let trail = [];
      for (;;) {
        const now = replay(board, trail);
        if (now.over) {
          assert.equal(now.winner, solution.winner, `${level}단계 ${seed}번`);
          break;
        }
        const moves = movesOf(board, trail);
        trail = [...trail, now.next === solution.winner ? pickMove(board, trail, rng) : moves[Math.floor(rng() * moves.length)]];
      }
    }
  }
});
