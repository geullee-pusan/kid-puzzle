// 마법 네모와 겹친 칸의 사다리와 판 내기 점검: 같은 번호는 같은 판, 늘 되는 단계와 안 되는 판이 섞이는 단계, 첫 안 되는 판, 작은 판.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { HUB_POOL, LADDER, MAKE_LEVEL, NO_SHARE, SET_POOL, TOP_LEVEL, generateBoard, nextSeed, rungOf } from '../src/core/magic-ladder.js';
import { checkBoard, linesOf, sizeOf, solve } from '../src/core/magic.js';
import { smallerMagic } from '../src/core/smaller.js';
import { bruteHub, bruteSquare } from './helpers/brute-magic.js';

const SEEDS = Array.from({ length: 300 }, (_, index) => index + 1);
const key = (board) => JSON.stringify(board);

test('사다리는 여섯 단계이고, 맨 위는 직접 만들기다', () => {
  assert.deepEqual(
    LADDER.map((rung) => [rung.level, rung.tag, rung.mode, rung.kind ?? null]),
    [
      [1, 'basic', 'place', 'rows'],
      [2, 'basic', 'place', 'rowscols'],
      [3, 'applied', 'place', 'all'],
      [4, 'applied', 'place', 'sets'],
      [5, 'applied', 'place', 'hub'],
      [6, 'challenge', 'make', null],
    ],
  );
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  assert.throws(() => rungOf(7));
  assert.throws(() => generateBoard(6, 1));
  assert.throws(() => generateBoard(1, 0));
});

test('같은 번호는 늘 같은 판이고, 모든 판이 규격에 맞으며 풀이 프로그램이 답을 안다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of SEEDS.slice(0, 60)) {
      const made = generateBoard(level, seed);
      assert.deepEqual(generateBoard(level, seed), made, `${level}단계 ${seed}번`);
      assert.equal(checkBoard(made.board), null);
      assert.deepEqual(made.solution, solve(made.board));
      assert.deepEqual(made.board.cards, made.board.cards.slice().sort((a, b) => a - b));
    }
  }
});

test('1~3단계는 늘 되는 판이고 3×3에 1~9(또는 2~10)다. 3단계는 1~9의 마법 네모 하나다', () => {
  for (const level of [1, 2, 3]) {
    const lines = rungOf(level).kind;
    for (const seed of SEEDS.slice(0, 20)) {
      const { board, solution } = generateBoard(level, seed);
      assert.equal(solution.possible, true);
      assert.equal(board.lines, lines);
      assert.deepEqual([board.w, board.h], [3, 3]);
      assert.ok([1, 2].includes(board.cards[0]) && board.cards.at(-1) - board.cards[0] === 8);
    }
  }
  assert.deepEqual(generateBoard(1, 1).board.cards, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(generateBoard(1, 2).board.cards, [2, 3, 4, 5, 6, 7, 8, 9, 10]);
  for (const seed of [1, 2, 3, 9]) assert.deepEqual(generateBoard(3, seed).board, { shape: 'grid', w: 3, h: 3, lines: 'all', cards: [1, 2, 3, 4, 5, 6, 7, 8, 9], target: null });
});

test('4, 5단계: 첫 판은 되는 판, 둘째는 아주 쉬운 안 되는 판(큰 카드, 너무 큰 합), 그 뒤로 셋에 하나쯤 안 되는 판', () => {
  const four = [1, 2, 3].map((seed) => generateBoard(4, seed));
  assert.deepEqual(four.map((item) => item.solution.possible), [true, false, true]);
  assert.equal(four[1].solution.why.reason, 'big');
  assert.equal(four[1].board.cards.at(-1), 20);
  const five = [1, 2, 3].map((seed) => generateBoard(5, seed));
  assert.deepEqual(five.map((item) => item.solution.possible), [true, false, true]);
  assert.equal(five[1].solution.why.reason, 'big');
  assert.deepEqual(five.map((item) => [item.board.arms, item.board.target]), [[2, 9], [2, 13], [3, 12]]);
  for (const level of [4, 5]) {
    const no = SEEDS.filter((seed) => !generateBoard(level, seed).solution.possible).length;
    const share = no / SEEDS.length;
    assert.ok(share > 0.22 && share < 0.45, `${level}단계 안 되는 판 ${(share * 100).toFixed(1)}%`);
    // 판 묶음의 판이 고루 나온다
    const seen = new Set(SEEDS.map((seed) => key(generateBoard(level, seed).board)));
    const pool = level === 4 ? SET_POOL.yes.length + SET_POOL.no.length : HUB_POOL.yes.length + HUB_POOL.no.length;
    assert.ok(seen.size >= pool, `${level}단계 판 ${seen.size}가지`);
  }
  assert.ok(NO_SHARE > 0.3 && NO_SHARE < 0.35);
});

test('판 묶음의 되는 판과 안 되는 판이 모든 차례를 다 놓아 본 것과 같다', () => {
  for (const cards of SET_POOL.yes) assert.equal(bruteSquare(cards).all.length, 1, cards.join(','));
  for (const cards of SET_POOL.no) assert.equal(bruteSquare(cards).all.length, 0, cards.join(','));
  for (const board of HUB_POOL.yes) assert.ok(bruteHub(board.arms, board.cards).some((item) => item.sum === board.target), key(board));
  for (const board of HUB_POOL.no) assert.ok(!bruteHub(board.arms, board.cards).some((item) => item.sum === board.target), key(board));
  // 되는 겹친 칸 판은 가운데를 두고 합이 같은 짝이 보이는 판이다(카드가 이어진 수이거나 하나 빠진 수)
  for (const board of HUB_POOL.yes) assert.ok(board.cards.at(-1) - board.cards[0] <= board.cards.length, key(board));
});

test('다음 판 번호는 다른 판을 낸다(판이 하나뿐인 3단계는 그다음 번호)', () => {
  for (const level of [1, 2, 4, 5]) {
    for (const seed of SEEDS.slice(0, 40)) {
      const next = nextSeed(level, seed);
      assert.ok(next > seed);
      assert.notDeepEqual(generateBoard(level, next).board, generateBoard(level, seed).board, `${level}단계 ${seed}번`);
    }
  }
  assert.equal(nextSeed(3, 4), 5);
});

test('작은 판(small): 줄이나 카드가 적은 되는 판이다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of SEEDS.slice(0, 20)) {
      const plain = generateBoard(level, seed).board;
      const small = generateBoard(level, seed, { small: true });
      if (key(small.board) === key(plain)) continue;
      assert.equal(small.solution.possible, true, `${level}단계 ${seed}번`);
      assert.ok(sizeOf(small.board) < sizeOf(plain) || linesOf(small.board).length < linesOf(plain).length);
    }
  }
  assert.deepEqual(generateBoard(1, 1, { small: true }).board, { shape: 'grid', w: 2, h: 3, lines: 'rows', cards: [1, 2, 3, 4, 5, 6], target: null });
  assert.equal(generateBoard(3, 1, { small: true }).board.lines, 'rowscols');
  // 줄 둘이 만나는 판에는 작은 판이 없어 그대로다
  assert.deepEqual(generateBoard(5, 1, { small: true }).board, generateBoard(5, 1).board);
});

test('"더 작은 판으로": 되는 판에서는 되는 판만, 안 되는 판에서는 되는 판부터 번갈아. 줄이나 카드가 적다', () => {
  let none = 0;
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of SEEDS.slice(0, 60)) {
      const { board, solution } = generateBoard(level, seed);
      const origin = { mode: 'place', board };
      for (const turn of [0, 1, 2, 3]) {
        const small = smallerMagic(origin, turn);
        if (!small) {
          none += turn === 0 ? 1 : 0;
          // 작은 판이 없는 판: 줄 둘이 만나는 판
          assert.equal(board.arms, 2, `${level}단계 ${seed}번`);
          continue;
        }
        const where = `${level}단계 ${seed}번 ${turn}번째`;
        assert.equal(checkBoard(small.board), null, where);
        assert.ok(sizeOf(small.board) < sizeOf(board) || linesOf(small.board).length < linesOf(board).length, where);
        const possible = solve(small.board).possible;
        if (solution.possible || turn === 0) assert.equal(possible, true, where);
        assert.deepEqual(smallerMagic(origin, turn), small, where);
      }
    }
  }
  assert.ok(none > 0 && none < 80, `작은 판이 없는 판 ${none}개`);
  // 안 되는 판(큰 카드 20)에서: 가운데 네 줄(되는 판) → 가로와 세로(안 되는 판) → 가운데 네 줄 → 가로 줄만(안 되는 판)
  const big = { board: generateBoard(4, 2).board };
  assert.deepEqual([0, 1, 2, 3].map((turn) => smallerMagic(big, turn).board.lines), ['center', 'rowscols', 'center', 'rows']);
  assert.equal(smallerMagic({ board: null }), null);
  assert.equal(smallerMagic({ board: { shape: 'grid', w: 2, h: 2, lines: 'rows', cards: [1, 2, 3, 4], target: null } }), null);
});
