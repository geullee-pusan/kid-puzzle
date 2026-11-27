// 돼지 주사위의 사다리와 판 내기, 더 작은 판 점검. 실험의 첫 1,000번이 정확한 셈과 같은 쪽인지는 같은 시드 난수로 다른 코드가 다시 굴려 본다.
// 정확한 셈(가장 많이 모으는 수, 더 자주 먼저 모으는 쪽, 늘어날지 줄어들지)도 다른 방법(tests/helpers/brute-pig.js)으로 다시 구한다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CLEAR, LADDER, MAKE_FIRST, MAKE_LEVEL, MATCH_GOAL, PAIRS, PLAY, POTS_ONE, POTS_TWO, STOP_SETS, TOP_LEVEL, generateBoard, kindOf, madeBoard, nextSeed, rungOf, smallBoards } from '../src/core/pig-ladder.js';
import { MANY, checkBoard, sameBoard } from '../src/core/pig.js';
import { smallerPig } from '../src/core/smaller.js';
import { bruteEdge, bruteEdgeTally, bruteMatchTally, bruteStopTally, bruteWinChance, forwardTurnValue, sameFrac } from './helpers/brute-pig.js';

const SEEDS = Array.from({ length: 24 }, (_, index) => index + 1);
const RUNGS = LADDER.filter((rung) => rung.mode !== 'make');

/** 다른 방법으로 구한 가장 많이 모으는 멈추는 수들 */
function bruteBest(stops) {
  const values = stops.map(forwardTurnValue);
  let best = values[0];
  for (const value of values) if (value.num * best.den > best.num * value.den) best = value;
  return stops.filter((_, index) => sameFrac(values[index], best));
}

/** 판의 첫 1,000번(다른 코드로 다시 굴린 것)이 정확한 셈과 같은 쪽인가 */
function agreesBrute(board) {
  if (board.kind === 'stop') {
    const tally = bruteStopTally(board.stops, MANY, board.seed);
    const max = Math.max(...tally.map((item) => item.total));
    const top = tally.filter((item) => item.total === max).map((item) => item.stop);
    return top.length === 1 && bruteBest(board.stops).includes(top[0]);
  }
  if (board.kind === 'match') {
    const wins = bruteMatchTally(board.stops, board.goal, MANY, board.seed);
    const chance = bruteWinChance(board.stops, board.goal);
    return chance > 0.5 ? wins[0] > wins[1] : wins[1] > wins[0];
  }
  const { verdict } = bruteEdge(board.dice, board.pot);
  if (verdict === 'same') return true;
  const tally = bruteEdgeTally(board.dice, board.pot, MANY, board.seed);
  return verdict === 'more' ? tally.gained > tally.lost : tally.gained < tally.lost;
}

test('사다리: 여섯 단계, 맨 위는 직접 만들기. 단계의 종류와 표시', () => {
  assert.deepEqual(LADDER.map((rung) => rung.mode), ['play', 'stop', 'edge', 'match', 'two', 'make']);
  assert.deepEqual(LADDER.map((rung) => rung.tag), ['basic', 'basic', 'applied', 'applied', 'challenge', 'challenge']);
  assert.deepEqual(RUNGS.map((rung) => kindOf(rung.mode)), ['play', 'stop', 'edge', 'match', 'edge']);
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  assert.throws(() => generateBoard(6, 1));
  assert.throws(() => generateBoard(1, 0));
  assert.throws(() => rungOf(7));
});

test('판 모음: 견줄 멈추는 수마다 셈으로 가장 많이 모으는 수가 하나이고, 바구니에는 늘어나는 판과 줄어드는 판이 모두 있다. 겨룰 두 규칙은 한쪽이 뚜렷이 자주 먼저 모은다', () => {
  assert.deepEqual(PLAY, { goal: 30, teacher: 10 });
  for (const stops of STOP_SETS) {
    assert.equal(checkBoard({ kind: 'stop', stops, seed: 1 }), null, String(stops));
    assert.equal(bruteBest(stops).length, 1, String(stops));
  }
  assert.deepEqual(STOP_SETS.map(bruteBest).map(([best]) => best), [20, 20, 20, 18, 25, 20]);
  // 주사위 하나: 여섯째 판이 똑같은 판(20개)이고, 그 판은 하나뿐이다
  const one = POTS_ONE.map((pot) => bruteEdge(1, pot).verdict);
  assert.deepEqual([one.indexOf('same'), one.filter((verdict) => verdict === 'same').length], [5, 1]);
  assert.ok(one.includes('more') && one.includes('less'));
  // 주사위 둘: 18개와 19개(셈이 갈리는 곳)가 모두 있다
  const two = POTS_TWO.map((pot) => bruteEdge(2, pot).verdict);
  assert.ok(two.includes('more') && two.includes('less') && !two.includes('same'));
  assert.ok(POTS_TWO.includes(18) && POTS_TWO.includes(19));
  // 겨룰 두 규칙: 먼저 모을 확률이 50에서 CLEAR 넘게 떨어져 있다. 둘째 판은 30개가 20개보다 자주 먼저 모으는 판이다
  for (const stops of PAIRS) assert.ok(Math.abs(bruteWinChance(stops, MATCH_GOAL) - 0.5) > CLEAR, String(stops));
  assert.deepEqual(PAIRS[1], [20, 30]);
  assert.ok(bruteWinChance(PAIRS[1], MATCH_GOAL) < 0.5);
});

test('판 번호 1~24: 쓸 수 있는 판이고, 실험의 첫 1,000번은 셈과 같은 쪽이다(다른 코드로 다시 굴려 본다). 다음 판 번호는 같은 판을 건너뛴다', () => {
  for (const rung of RUNGS) {
    for (const seed of SEEDS) {
      const { board } = generateBoard(rung.level, seed);
      const where = `${rung.level}단계 ${seed}번`;
      assert.equal(checkBoard(board), null, where);
      assert.equal(board.kind, kindOf(rung.mode), where);
      if (rung.mode === 'two') assert.equal(board.dice, 2, where);
      if (rung.mode === 'edge') assert.equal(board.dice, 1, where);
      if (board.kind !== 'play') assert.ok(agreesBrute(board), where);
      // 같은 번호는 늘 같은 판이다
      assert.ok(sameBoard(generateBoard(rung.level, seed).board, board), where);
      const next = generateBoard(rung.level, nextSeed(rung.level, seed)).board;
      assert.ok(!sameBoard(next, board), where);
      if (board.kind !== 'play') assert.notDeepEqual({ ...next, seed: 0 }, { ...board, seed: 0 }, where);
    }
  }
  // 첫 바퀴는 적힌 차례다
  assert.deepEqual(generateBoard(2, 1).board.stops, STOP_SETS[0]);
  assert.equal(generateBoard(3, 6).board.pot, 20);
  assert.deepEqual(generateBoard(4, 2).board.stops, [20, 30]);
  assert.equal(generateBoard(5, 4).board.pot, 19);
  // 수준 맞추기의 작은 판: 1단계에서 목표가 20개인 겨루기
  const small = generateBoard(1, 3, { small: true });
  assert.equal(small.small, true);
  assert.equal(small.board.goal, 20);
});

test('더 작은 판: 같은 물음의 더 작거나 쉬운 판. 겨루기는 목표를 줄이고, 실험은 셋으로 줄이고, 바구니는 셈이 크게 갈리는 판이다', () => {
  for (const rung of RUNGS) {
    for (const seed of SEEDS.slice(0, 12)) {
      const { board } = generateBoard(rung.level, seed);
      const where = `${rung.level}단계 ${seed}번`;
      const small = smallBoards(board);
      for (const item of small) assert.equal(checkBoard(item), null, where);
      if (board.kind === 'play') {
        assert.deepEqual(small.map((item) => item.goal), [20, 10], where);
        assert.ok(small.every((item) => item.teacher === board.teacher), where);
      } else if (board.kind === 'stop') {
        assert.equal(small.length, 1, where);
        assert.equal(small[0].stops.length, 3, where);
        assert.ok(small[0].stops.includes(bruteBest(board.stops)[0]), where);
        assert.ok(small[0].stops.every((stop) => board.stops.includes(stop)), where);
        assert.ok(agreesBrute(small[0]), where);
      } else if (board.kind === 'match') {
        // 목표 20개에서도 더 자주 먼저 모으는 쪽이 같을 때만 낸다
        const same = Math.sign(bruteWinChance(board.stops, 20) - 0.5) === Math.sign(bruteWinChance(board.stops, 30) - 0.5) && Math.abs(bruteWinChance(board.stops, 20) - 0.5) > CLEAR;
        assert.equal(small.length, same ? 1 : 0, where);
        if (same) assert.deepEqual([small[0].goal, small[0].stops], [20, board.stops], where);
      } else {
        const verdict = bruteEdge(board.dice, board.pot).verdict;
        if (board.dice === 2) assert.deepEqual([small[0].dice, small[0].pot], [1, board.pot], where);
        const ones = small.filter((item) => item.dice === 1 && item.pot !== board.pot);
        assert.ok(ones.length >= 1, where);
        // 주사위 하나의 쉬운 판은 원래 판과 같은 쪽(20개면 늘어나는 판과 줄어드는 판)
        if (board.dice === 1 && verdict !== 'same') assert.ok(ones.every((item) => bruteEdge(1, item.pot).verdict === verdict), where);
        for (const item of small) assert.ok(agreesBrute(item), where);
      }
      // 틀의 함수는 차례대로 돌려 낸다
      const first = smallerPig({ mode: board.kind, board }, 0);
      if (small.length === 0) assert.equal(first, null, where);
      else assert.ok(sameBoard(first.board, small[0]), where);
    }
  }
  // 바구니 20개(주사위 하나)는 10개와 30개
  assert.deepEqual(smallBoards(generateBoard(3, 6).board).map((item) => item.pot), [10, 30]);
  // 20개와 30개의 겨루기는 목표 20개에서 같은 규칙이라 작은 판이 없다
  assert.deepEqual(smallBoards(generateBoard(4, 2).board), []);
  assert.equal(smallerPig({ board: { kind: 'edge', dice: 3, pot: 10, seed: 1 } }), null);
});

test('직접 만들기: 선생님이 멈추는 수 2~40개와 목표 10~100개(10개씩)의 겨루기 판', () => {
  assert.deepEqual(MAKE_FIRST, { teacher: 10, goal: 50 });
  assert.equal(checkBoard(madeBoard(10, 50)), null);
  assert.equal(madeBoard(1, 50), null);
  assert.equal(madeBoard(41, 50), null);
  assert.equal(madeBoard(10, 55), null);
  assert.equal(madeBoard(10, 110), null);
  assert.ok(sameBoard(madeBoard(20, 30), madeBoard(20, 30)));
  assert.ok(!sameBoard(madeBoard(20, 30), madeBoard(20, 40)));
});
