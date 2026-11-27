// 돼지 주사위의 풀이 점검: 겨루기를 다른 코드로 다시 두고, 한 차례의 기댓값과 한 번 더 굴리기의 모든 경우,
// 두 규칙이 먼저 모을 확률을 다른 방법(tests/helpers/brute-pig.js)으로 다시 구해 견준다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  LIMITS,
  MANY,
  bestStops,
  checkBoard,
  compareFrac,
  dieAt,
  edgeCases,
  edgeTally,
  manyOf,
  manySeed,
  matchTally,
  replay,
  solve,
  stopTally,
  topStops,
  turnOutcomes,
  turnValue,
  winChance,
} from '../src/core/pig.js';
import { createRng, randInt } from '../src/core/rng.js';
import { bruteEdge, bruteEdgeTally, bruteGame, bruteMatchTally, bruteStopTally, bruteTurnValue, bruteWinChance, forwardTurnValue, sameFrac } from './helpers/brute-pig.js';

const PLAY = { kind: 'play', goal: 30, teacher: 10, seed: 12345 };

test('주사위: 같은 시드와 번째는 늘 같은 눈이고, 여섯 눈이 고르게 나온다', () => {
  assert.equal(dieAt(7, 3), dieAt(7, 3));
  const counts = new Array(7).fill(0);
  for (let index = 0; index < 6000; index++) counts[dieAt(99, index)] += 1;
  assert.equal(counts[0], 0);
  for (let face = 1; face <= 6; face++) assert.ok(counts[face] > 850 && counts[face] < 1150, `${face}: ${counts[face]}`);
});

test('겨루기: 아이의 고르기대로 다시 두면 다른 코드로 둔 것과 같다(모은 수, 바구니, 먼저 닿은 쪽)', () => {
  const rng = createRng(4242);
  for (let game = 0; game < 120; game++) {
    const board = { kind: 'play', goal: [20, 30, 50][game % 3], teacher: [10, 15, 20][game % 3], seed: 1000 + game };
    const moves = [];
    let state = replay(board, moves);
    // 바구니가 정해 둔 수에 닿으면 멈추는 아이(판마다 다른 수)
    const mine = 4 + (game % 17);
    for (let step = 0; step < 400 && !state.over; step++) {
      const move = state.basket >= mine || (state.basket > 0 && randInt(rng, 1, 9) === 1) ? 'stop' : 'roll';
      moves.push(move);
      state = replay(board, moves);
    }
    assert.ok(state.ok && state.over, String(game));
    const other = bruteGame(board, moves);
    assert.deepEqual([state.jars.kid, state.jars.teacher, state.winner, state.turns.length], [other.kid, other.teacher, other.winner, other.turns], String(game));
    assert.ok(state.jars[state.winner] >= board.goal);
    assert.ok(state.jars[state.winner === 'kid' ? 'teacher' : 'kid'] < board.goal);
    // 선생님은 말한 규칙대로만 한다: 옮긴 수는 멈추는 수 이상(다 모은 차례는 목표에 닿은 것)
    for (const turn of state.turns.filter((item) => item.who === 'teacher')) {
      if (turn.end === 'stop') assert.ok(turn.got >= board.teacher && turn.got - turn.faces.at(-1) < board.teacher);
      if (turn.end === 'pig') assert.equal(turn.faces.at(-1), 1);
      assert.ok(turn.faces.slice(0, -1).every((face) => face !== 1));
    }
  }
});

test('겨루기: 빈 바구니로는 멈출 수 없고, 1이 나오면 바구니가 비고 선생님 차례가 끝까지 간다. 끝난 뒤에는 둘 수 없다', () => {
  assert.equal(replay(PLAY, ['stop']).ok, false);
  // 1이 셋째 굴림 안에 처음 나오는 판을 찾아 그때까지 굴린다
  const firstPig = (seed) => [0, 1, 2].find((index) => dieAt(seed, index) === 1) ?? null;
  let seed = 1;
  while (firstPig(seed) === null || firstPig(seed) === 0) seed += 1;
  const board = { ...PLAY, seed };
  const first = firstPig(seed);
  const moves = Array.from({ length: first + 1 }, () => 'roll');
  const state = replay(board, moves);
  const kid = state.turns[0];
  assert.deepEqual([kid.who, kid.end, kid.got], ['kid', 'pig', 0]);
  assert.equal(kid.lost, Array.from({ length: first }, (_, index) => dieAt(seed, index)).reduce((sum, face) => sum + face, 0));
  assert.ok(kid.lost > 0);
  assert.equal(state.basket, 0);
  assert.equal(state.turns[1].who, 'teacher');
  assert.deepEqual(state.faces, []);
  // 다 모으면 그 자리에서 끝나고, 그 뒤의 고르기는 둘 수 없다
  const long = [];
  let now = replay(PLAY, long);
  while (!now.over) {
    long.push('roll');
    now = replay(PLAY, long);
  }
  assert.equal(replay(PLAY, [...long, 'roll']).ok, false);
});

test('한 차례의 기댓값: 뒤에서부터 구한 분수가 눈의 줄을 모두 늘어놓은 것, 앞에서부터 밀어 나간 것과 같다', () => {
  for (let stop = 1; stop <= 22; stop++) assert.ok(sameFrac(turnValue(stop), bruteTurnValue(stop)), String(stop));
  for (let stop = 1; stop <= 60; stop++) assert.ok(sameFrac(turnValue(stop), forwardTurnValue(stop)), String(stop));
  assert.deepEqual(turnValue(20), { num: 492303203n, den: 60466176n });
  assert.deepEqual(turnValue(10), { num: 26725n, den: 3888n });
});

test('풀이 프로그램이 알려 준 것: 20개와 21개에서 멈추는 것이 꼭 같게 가장 많이 모으고, 그 앞은 오르기만, 그 뒤는 내리기만 한다', () => {
  const values = Array.from({ length: 60 }, (_, index) => forwardTurnValue(index + 1));
  const best = values.reduce((most, value) => (compareFrac(value, most) > 0 ? value : most));
  const top = values.map((value, index) => index + 1).filter((stop) => sameFrac(values[stop - 1], best));
  assert.deepEqual(top, [20, 21]);
  // 1개와 2개는 같다(어느 쪽이든 한 번 굴리고 멈춘다)
  assert.ok(sameFrac(values[0], values[1]));
  for (let stop = 2; stop < 20; stop++) assert.ok(compareFrac(values[stop], values[stop - 1]) > 0, String(stop));
  for (let stop = 21; stop < 60; stop++) assert.ok(compareFrac(values[stop], values[stop - 1]) < 0, String(stop));
  // 직접 만들기의 범위(2~40개)에서 20개와 21개 말고는 모두 20개보다 적게 모은다
  for (let stop = LIMITS.minStop; stop <= LIMITS.maxStop; stop++) assert.equal(compareFrac(turnValue(stop), turnValue(20)) === 0, stop === 20 || stop === 21, String(stop));
  assert.deepEqual(bestStops([5, 10, 15, 20, 25, 30]), [20]);
  assert.deepEqual(bestStops([18, 20, 21, 24]), [20, 21]);
});

test('한 번 더 굴리기: 모든 경우를 겹친 반복으로 센 것과 같다. 주사위 하나는 20개에서 똑같고, 둘은 18개까지 늘고 19개부터 준다', () => {
  for (const dice of [1, 2]) {
    for (let pot = 1; pot <= 60; pot++) {
      const counted = edgeCases(dice, pot);
      const other = bruteEdge(dice, pot);
      assert.deepEqual([counted.cases, counted.pigCases, counted.gain, counted.lose, counted.verdict], [other.cases, other.pigs, other.gain, other.lose, other.verdict], `${dice} ${pot}`);
    }
  }
  assert.deepEqual([edgeCases(1, 20).gain, edgeCases(1, 20).pigCases], [20, 1]);
  assert.deepEqual([edgeCases(2, 18).gain, edgeCases(2, 18).pigCases, edgeCases(2, 18).cases], [200, 11, 36]);
  const one = Array.from({ length: 60 }, (_, index) => edgeCases(1, index + 1).verdict);
  assert.deepEqual([...new Set(one.slice(0, 19))], ['more']);
  assert.equal(one[19], 'same');
  assert.deepEqual([...new Set(one.slice(20))], ['less']);
  const two = Array.from({ length: 60 }, (_, index) => edgeCases(2, index + 1).verdict);
  assert.deepEqual([...new Set(two.slice(0, 18))], ['more']);
  assert.deepEqual([...new Set(two.slice(18))], ['less']);
});

test('먼저 모을 확률: 두 식을 함께 푼 값이 모든 자리를 되풀이해 고친 값과 같다. 차례의 결과는 확률을 다 더하면 1이다', () => {
  for (const [stops, goal] of [
    [[10, 20], 30],
    [[20, 30], 30],
    [[5, 15], 20],
    [[25, 30], 20],
    [[15, 25], 30],
  ]) {
    assert.ok(Math.abs(winChance(stops, goal) - bruteWinChance(stops, goal)) < 1e-9, `${stops} ${goal}`);
  }
  for (const [score, goal, stop] of [
    [0, 30, 20],
    [25, 30, 20],
    [0, 20, 30],
  ]) {
    const total = [...turnOutcomes(score, goal, stop).values()].reduce((sum, chance) => sum + chance, 0);
    assert.ok(Math.abs(total - 1) < 1e-12);
  }
  // 목표 20개에서 20개와 30개에서 멈추기는 같은 규칙이다(둘 다 한 차례에 다 모으려 한다)
  assert.ok(Math.abs(winChance([20, 30], 20) - 0.5) < 1e-12);
  // 먼저 30개 모으기에서는 30개에서 멈추는 쪽이 20개에서 멈추는 쪽보다 자주 먼저 모은다
  assert.ok(winChance([20, 30], 30) < 0.45);
});

test('컴퓨터가 해 본 수: 같은 시드 난수로 다른 코드가 다시 굴린 것과 같다. 더 많이 해 보기는 시드를 바꿔 더한다', () => {
  const stops = [5, 10, 20, 30];
  const tally = stopTally(stops, 300, 77);
  assert.deepEqual(tally.map((item) => [item.stop, item.total, item.pigs]), bruteStopTally(stops, 300, 77).map((item) => [item.stop, item.total, item.pigs]));
  assert.deepEqual(matchTally([10, 20], 30, 300, 5), bruteMatchTally([10, 20], 30, 300, 5));
  const edge = edgeTally(2, 18, 300, 9);
  assert.deepEqual([edge.pigs, edge.gained, edge.lost], Object.values(bruteEdgeTally(2, 18, 300, 9)));
  const board = { kind: 'match', stops: [10, 20], goal: 30, seed: 31 };
  const two = manyOf(board, 2);
  const first = matchTally(board.stops, board.goal, MANY, manySeed(board, 0));
  const second = matchTally(board.stops, board.goal, MANY, manySeed(board, 1));
  assert.deepEqual(two.wins, [first[0] + second[0], first[1] + second[1]]);
  assert.equal(two.games, 2 * MANY);
  assert.deepEqual(topStops([{ stop: 5, total: 3 }, { stop: 10, total: 7 }, { stop: 20, total: 7 }]), [10, 20]);
});

test('판 점검과 풀이', () => {
  assert.equal(checkBoard(PLAY), null);
  assert.equal(checkBoard({ ...PLAY, goal: 35 }), 'goal');
  assert.equal(checkBoard({ ...PLAY, teacher: 1 }), 'teacher');
  assert.equal(checkBoard({ kind: 'stop', stops: [5, 10, 20], seed: 1 }), null);
  assert.equal(checkBoard({ kind: 'stop', stops: [10, 5, 20], seed: 1 }), 'order');
  assert.equal(checkBoard({ kind: 'stop', stops: [10, 20], seed: 1 }), 'stops');
  assert.equal(checkBoard({ kind: 'match', stops: [20, 10], goal: 30, seed: 1 }), 'stops');
  assert.equal(checkBoard({ kind: 'edge', dice: 3, pot: 10, seed: 1 }), 'dice');
  assert.equal(checkBoard({ kind: 'edge', dice: 1, pot: 1, seed: 1 }), 'pot');
  assert.equal(checkBoard({ kind: 'edge', dice: 1, pot: 10, seed: 1.5 }), 'seed');
  assert.deepEqual(solve({ kind: 'stop', stops: [5, 15, 25], seed: 1 }).best, [25]);
  assert.equal(solve({ kind: 'match', stops: [10, 20], goal: 30, seed: 1 }).favorite, 1);
  assert.equal(solve({ kind: 'edge', dice: 1, pot: 20, seed: 1 }).verdict, 'same');
  assert.equal(solve({ kind: 'edge', dice: 2, pot: 19, seed: 1 }).verdict, 'less');
});
