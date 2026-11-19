// 켜고 끄기와 숫자 마술의 사다리와 판 내기: 단계마다 판 번호 1~100(작은 판도)이 규격에 맞고, 답이 하나씩 켜 본 것과 같은지 본다.
// "더 작은 판"이 같은 종류의 더 작은 판인지, 같은 판과 차례에는 같은 판이 나오는지도 본다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf, smallBoards } from '../src/core/lamps-ladder.js';
import { SECRET_COUNT, cardsWith, checkBoard, reachOf, readCards, stripTop, sumOf } from '../src/core/lamps.js';
import { smallerLamps } from '../src/core/smaller.js';
import { bruteBestNext, bruteCards, bruteFirstMissing, bruteWays } from './helpers/brute-lamps.js';

const SEEDS = Array.from({ length: 100 }, (_, index) => index + 1);

/** 단계마다 판 번호 1~100, 보통 판과 작은 판 */
function eachBoard(visit) {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const small of [false, true]) {
      for (const seed of SEEDS) {
        const made = generateBoard(level, seed, { small });
        visit(made, rungOf(level), `${level}단계 ${seed}번${small ? ' 작은 판' : ''}`);
      }
    }
  }
}

test('사다리: 여섯 단계(맨 위는 직접 만들기), 기본·응용·도전 표시', () => {
  assert.deepEqual(LADDER.map((rung) => rung.level), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(LADDER.map((rung) => rung.mode), ['targets', 'reach', 'next', 'cards', 'magic', 'make']);
  assert.deepEqual(LADDER.map((rung) => rung.tag), ['basic', 'basic', 'applied', 'applied', 'challenge', 'challenge']);
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  assert.throws(() => generateBoard(MAKE_LEVEL, 1));
  assert.throws(() => rungOf(7));
});

test('첫 판: 1, 2, 4짜리 불로 3, 5, 7을 만든다(실패할 수 없다). 2~4단계의 첫 판은 1, 2, 4, 8이다', () => {
  assert.deepEqual(generateBoard(1, 1).board, { kind: 'targets', lamps: [1, 2, 4], targets: [3, 5, 7] });
  assert.deepEqual(generateBoard(2, 1).board, { kind: 'reach', lamps: [1, 2, 4, 8] });
  assert.deepEqual(generateBoard(3, 1).board, { kind: 'next', lamps: [1, 2, 4, 8] });
  assert.deepEqual(generateBoard(4, 1).board.lamps, [1, 2, 4, 8]);
  assert.deepEqual(generateBoard(5, 1).board, { kind: 'magic', digits: 3 });
  assert.deepEqual(generateBoard(5, 1, { small: true }).board, { kind: 'magic', digits: 2 });
});

test('모든 판이 규격에 맞고, 같은 번호는 늘 같은 판이다', () => {
  eachBoard((made, rung, where) => {
    assert.equal(checkBoard(made.board), null, where);
    assert.equal(made.board.kind, rung.mode, where);
    assert.deepEqual(generateBoard(made.level, made.seed, { small: made.small }).board, made.board, where);
  });
});

test('적힌 수 판: 적힌 수는 모두 만들 수 있고, 불 하나만 켜서 되는 수는 없다. 가장 큰 불이 있어야 되는 수와 없어도 되는 수가 섞인다', () => {
  const sets = new Set();
  eachBoard(({ board, seed, small }, rung, where) => {
    if (board.kind !== 'targets') return;
    sets.add(board.lamps.join());
    const ways = bruteWays(board.lamps);
    const biggest = board.lamps.at(-1);
    assert.equal(board.targets.length, seed === 1 && !small ? 3 : small ? 3 : 4, where);
    assert.deepEqual(board.targets, board.targets.slice().sort((a, b) => a - b), where);
    for (const n of board.targets) {
      assert.ok(ways.has(n), `${where}: ${n}`);
      assert.ok(!board.lamps.includes(n), `${where}: ${n}은 불 하나`);
    }
    assert.ok(board.targets.some((n) => n > biggest) && board.targets.some((n) => n < biggest), where);
  });
  // 1, 2, 4, 8 그리고 셋에 한 번은 16짜리 불까지(큰 수), 작은 판은 1, 2, 4
  assert.deepEqual([...sets].sort(), ['1,2,4', '1,2,4,8', '1,2,4,8,16']);
});

test('어디까지 판: 처음으로 못 만드는 수가 줄 안에 있다. 두 배씩인 불과 아닌 불이 함께 돈다', () => {
  const firsts = new Map();
  eachBoard(({ board }, rung, where) => {
    if (board.kind !== 'reach') return;
    const first = bruteFirstMissing(board.lamps);
    assert.ok(first <= stripTop(board), where);
    firsts.set(board.lamps.join(), first);
  });
  // 처음으로 못 만드는 수가 불의 합 + 1인 불(빈 곳 없음)과 그 앞에 빈 곳이 있는 불이 모두 있다
  assert.equal(firsts.get('1,2,4,8'), 16);
  assert.equal(firsts.get('1,2,4,9'), 8);
  assert.equal(firsts.get('1,3,5,7'), 2);
  assert.equal(firsts.get('1,2,3,6'), 13);
  assert.equal(firsts.get('1,2,4,8,16'), 32);
  const kinds = [...firsts].map(([lamps, first]) => first === sumOf(lamps.split(',').map(Number)) + 1);
  assert.ok(kinds.includes(true) && kinds.includes(false));
});

test('불 하나 더 달기 판: 빈 곳 없는 불이고, 가장 멀리 가는 불은 하나뿐이며 줄 안에서 끝난다', () => {
  const seen = new Map();
  eachBoard(({ board, solution }, rung, where) => {
    if (board.kind !== 'next') return;
    const total = sumOf(board.lamps);
    assert.equal(reachOf(board.lamps), total, where);
    const brute = bruteBestNext(board.lamps, stripTop(board) + 5);
    assert.deepEqual(brute.values, [solution.best], where);
    assert.equal(brute.reach, solution.bestReach, where);
    assert.ok(solution.bestReach < stripTop(board), where);
    seen.set(board.lamps.join(), [solution.best, solution.bestReach]);
  });
  assert.deepEqual(seen.get('1,2,4,8'), [16, 31]);
  assert.deepEqual(seen.get('1,2,4'), [8, 15]);
  assert.deepEqual(seen.get('1,2,3,6'), [13, 25]);
  assert.deepEqual(seen.get('1,2,3'), [7, 13]);
  assert.deepEqual(seen.get('1,2,4,7'), [15, 29]);
  assert.deepEqual(seen.get('1,2,4,8,16'), [32, 63]);
  assert.deepEqual(seen.get('1,2'), [4, 7]);
});

test('카드 판: 카드 넷(1~15)과 다섯(1~31), 작은 판은 셋(1~7). 선생님의 수는 서로 다르고 카드의 맨 앞 수가 아니다. 모든 수를 카드로 맞힐 수 있다', () => {
  const counts = new Set();
  eachBoard(({ board }, rung, where) => {
    if (board.kind !== 'cards') return;
    counts.add(board.lamps.length);
    assert.equal(board.secrets.length, SECRET_COUNT, where);
    assert.equal(new Set(board.secrets).size, SECRET_COUNT, where);
    const cards = bruteCards(board.lamps);
    assert.ok(cards, where);
    for (const n of board.secrets) {
      assert.ok(n >= 1 && n <= sumOf(board.lamps) && !board.lamps.includes(n), `${where}: ${n}`);
      const has = cards.map((list, at) => (list.includes(n) ? at : -1)).filter((at) => at >= 0);
      assert.deepEqual(cardsWith(board.lamps, n), has, `${where}: ${n}`);
      assert.equal(readCards(board.lamps, has), n, `${where}: ${n}`);
    }
  });
  assert.deepEqual([...counts].sort(), [3, 4, 5]);
});

test('다음 판 번호는 방금 한 판과 다른 판이다(숫자 마술은 판이 늘 같아서 번호만 하나 는다)', () => {
  for (let level = 1; level <= 4; level++) {
    for (const seed of [1, 2, 3, 7]) {
      const next = nextSeed(level, seed);
      assert.ok(next > seed);
      assert.notDeepEqual(generateBoard(level, next).board, generateBoard(level, seed).board, `${level}단계 ${seed}번`);
    }
  }
  assert.equal(nextSeed(5, 4), 5);
});

test('"더 작은 판으로": 같은 종류에서 불(카드)이 하나 적은 판, 세 자리 마술은 두 자리. 가장 작은 판에는 없다', () => {
  let some = 0;
  eachBoard(({ board }, rung, where) => {
    const list = smallBoards(board);
    for (let turn = 0; turn < 4; turn++) {
      const small = smallerLamps({ mode: board.kind, board }, turn);
      if (list.length === 0) {
        assert.equal(small, null, where);
        continue;
      }
      some += turn === 0 ? 1 : 0;
      assert.deepEqual(small.board, list[turn % list.length], where);
      assert.deepEqual(smallerLamps({ mode: board.kind, board }, turn), small, `${where}: 같은 판과 차례에는 같은 작은 판`);
      assert.equal(checkBoard(small.board), null, where);
      assert.equal(small.board.kind, board.kind, where);
      if (board.kind === 'magic') assert.ok(small.board.digits < board.digits, where);
      else {
        assert.ok(small.board.lamps.length < board.lamps.length, where);
        assert.deepEqual(small.board.lamps, board.lamps.slice(0, small.board.lamps.length), `${where}: 가장 큰 불부터 뺀다`);
      }
      if (board.kind === 'targets') {
        assert.ok(small.board.targets.length >= 1 && small.board.targets.length <= 3, where);
        const ways = bruteWays(small.board.lamps);
        for (const n of small.board.targets) assert.ok(ways.has(n) && !small.board.lamps.includes(n), `${where}: ${n}`);
      }
      if (board.kind === 'next') assert.equal(reachOf(small.board.lamps), sumOf(small.board.lamps), where);
    }
  });
  assert.ok(some > 500, String(some));
  // 가장 작은 판: 첫 판(1, 2, 4로 3, 5, 7), 카드 석 장, 두 자리 마술, 불 둘
  assert.equal(smallerLamps({ board: generateBoard(1, 1).board }), null);
  assert.equal(smallerLamps({ board: { kind: 'cards', lamps: [1, 2, 4], secrets: [3] } }), null);
  assert.equal(smallerLamps({ board: { kind: 'magic', digits: 2 } }), null);
  assert.equal(smallerLamps({ board: { kind: 'reach', lamps: [1, 2] } }), null);
  assert.equal(smallerLamps({ board: null }), null);
  assert.deepEqual(smallerLamps({ board: { kind: 'reach', lamps: [1, 2, 4, 8] } }, 1).board, { kind: 'reach', lamps: [1, 2] });
});
