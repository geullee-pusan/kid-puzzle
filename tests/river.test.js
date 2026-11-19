// 강 건너기의 규칙과 풀이 프로그램 점검.
// 풀이 프로그램이 알려 주는 사실(되는지, 배를 가장 적게 보내는 횟수, 갈 수 있는 모습의 수)을
// 다른 방법(tests/helpers/brute-river.js)으로 다시 구해 견준다. 책에 실린 수는 쓰지 않는다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ANIMALS,
  FIGHTS,
  KINDS,
  PETS,
  RANGES,
  applyMove,
  boatOf,
  castOf,
  checkBoard,
  checkMove,
  clashOf,
  copyBoard,
  diagnoseImpossible,
  farOf,
  isDone,
  movesOf,
  placesOf,
  reachable,
  replay,
  solve,
  startState,
} from '../src/core/river.js';
import { bruteRiver } from './helpers/brute-river.js';

const weight = (heavy, light) => ({ kind: 'weight', heavy, light });
const pets = (list, seats = 2) => ({ kind: 'pets', pets: list, seats });
const pairs = (count, seats = 2, island = false) => ({ kind: 'pairs', pairs: count, seats, island });

/** 규격 안의 모든 판 */
function allBoards() {
  const boards = [];
  for (let heavy = RANGES.heavy[0]; heavy <= RANGES.heavy[1]; heavy++) for (let light = RANGES.light[0]; light <= RANGES.light[1]; light++) boards.push(weight(heavy, light));
  for (let mask = 1; mask < 1 << PETS.length; mask++) {
    for (let seats = RANGES.petSeats[0]; seats <= RANGES.petSeats[1]; seats++) boards.push(pets(PETS.filter((_, index) => mask & (1 << index)), seats));
  }
  for (let count = RANGES.pairs[0]; count <= RANGES.pairs[1]; count++) {
    for (let seats = RANGES.pairSeats[0]; seats <= RANGES.pairSeats[1]; seats++) boards.push(pairs(count, seats));
    boards.push(pairs(count, RANGES.islandSeats, true));
  }
  return boards;
}

test('판의 규격: 세 종류, 수의 범위, 동물의 차례', () => {
  assert.deepEqual(KINDS, ['weight', 'pets', 'pairs']);
  assert.deepEqual(PETS, ['dog', 'cat', 'chick', 'fish']);
  assert.deepEqual(ANIMALS, ['bear', 'rabbit', 'duck', 'pig', 'sheep']);
  assert.deepEqual(RANGES, { heavy: [1, 3], light: [1, 4], petSeats: [2, 3], pairs: [2, 5], pairSeats: [2, 4], islandSeats: 2 });
  assert.equal(checkBoard(weight(1, 2)), null);
  assert.equal(checkBoard(weight(0, 2)), 'bad-count');
  assert.equal(checkBoard(weight(1, 5)), 'bad-count');
  assert.equal(checkBoard(pets(['dog', 'cat', 'fish'])), null);
  assert.equal(checkBoard(pets(['cat', 'dog'])), 'bad-pets', '정해진 차례대로 적는다');
  assert.equal(checkBoard(pets(['dog', 'dog'])), 'bad-pets');
  assert.equal(checkBoard(pets([])), 'bad-pets');
  assert.equal(checkBoard(pets(['dog', 'cow'])), 'bad-pets');
  assert.equal(checkBoard(pets(['dog'], 4)), 'bad-seats');
  assert.equal(checkBoard(pairs(3)), null);
  assert.equal(checkBoard(pairs(1)), 'bad-count');
  assert.equal(checkBoard(pairs(6)), 'bad-count');
  assert.equal(checkBoard(pairs(3, 5)), 'bad-seats');
  assert.equal(checkBoard(pairs(4, 2, true)), null);
  assert.equal(checkBoard(pairs(4, 3, true)), 'bad-seats', '섬이 있는 판의 배는 둘이 탄다');
  assert.equal(checkBoard({ kind: 'pairs', pairs: 3, seats: 2 }), 'bad-island');
  assert.equal(checkBoard({ kind: 'boat' }), 'bad-kind');
  assert.equal(checkBoard(null), 'no-board');
  // 베낀 판은 원래 판과 같고, 원래 판이 바뀌어도 따라 바뀌지 않는다.
  const original = pets(['dog', 'cat']);
  const copied = copyBoard(original);
  assert.deepEqual(copied, original);
  original.pets.push('fish');
  assert.deepEqual(copied.pets, ['dog', 'cat']);
});

test('동물들: 코끼리 다음에 생쥐, 할머니 다음에 동물들, 쌍마다 엄마와 아기', () => {
  assert.deepEqual(castOf(weight(2, 1)).map((member) => [member.kind, member.weight, member.rower]), [['elephant', 2, true], ['elephant', 2, true], ['mouse', 1, true]]);
  assert.deepEqual(castOf(pets(['cat', 'fish'])).map((member) => [member.kind, member.rower]), [['grandma', true], ['cat', false], ['fish', false]]);
  assert.deepEqual(castOf(pairs(2)).map((member) => [member.kind, member.role, member.pair]), [['bear', 'mother', 0], ['bear', 'baby', 0], ['rabbit', 'mother', 1], ['rabbit', 'baby', 1]]);
  assert.equal(placesOf(pairs(3)), 2);
  assert.equal(placesOf(pairs(3, 2, true)), 3);
  assert.equal(farOf(pairs(3, 2, true)), 2);
  assert.deepEqual(boatOf(weight(1, 2)), { seats: 2, limit: 2 });
  assert.deepEqual(boatOf(pairs(4, 3)), { seats: 3, limit: null });
  assert.deepEqual(startState(pairs(2)), { at: [0, 0, 0, 0], boat: 0 });
});

test('함께 있으면 안 되는 동물: 할머니가 없는 곳의 짝, 자기 엄마 없이 다른 엄마와 있는 아기', () => {
  assert.deepEqual(FIGHTS, [['dog', 'cat'], ['cat', 'fish'], ['cat', 'chick'], ['dog', 'chick']]);
  const four = pets(['dog', 'cat', 'chick', 'fish']); // 0 할머니, 1 강아지, 2 고양이, 3 병아리, 4 생선
  assert.deepEqual(clashOf(four, [1, 2]), { kind: 'dog-cat', who: [1, 2] });
  assert.deepEqual(clashOf(four, [2, 4]), { kind: 'cat-fish', who: [2, 4] });
  assert.deepEqual(clashOf(four, [3, 2]), { kind: 'cat-chick', who: [2, 3] });
  assert.deepEqual(clashOf(four, [1, 3]), { kind: 'dog-chick', who: [1, 3] });
  assert.equal(clashOf(four, [1, 4]), null, '강아지와 생선은 괜찮다');
  assert.equal(clashOf(four, [0, 1, 2, 3, 4]), null, '할머니가 있으면 괜찮다');
  const three = pairs(3); // 0 엄마 곰, 1 아기 곰, 2 엄마 토끼, 3 아기 토끼, 4 엄마 오리, 5 아기 오리
  assert.equal(clashOf(three, [1, 3, 5]), null, '아기들끼리는 괜찮다');
  assert.equal(clashOf(three, [0, 1, 2, 3]), null, '자기 엄마가 있으면 괜찮다');
  assert.deepEqual(clashOf(three, [1, 2]), { kind: 'baby', who: [1, 2] });
  assert.deepEqual(clashOf(three, [0, 1, 3]), { kind: 'baby', who: [0, 3] });
  assert.equal(clashOf(weight(3, 4), [0, 1, 2, 3]), null);
});

test('배가 못 떠나는 까닭: 빈 배, 다른 곳의 동물, 자리, 노 젓기, 무게, 함께 있으면 안 되는 동물(배 위, 남는 곳, 닿는 곳)', () => {
  const heavy = weight(1, 2);
  const start = startState(heavy);
  assert.deepEqual(checkMove(heavy, start, [], 1), { reason: 'empty', who: [] });
  assert.deepEqual(checkMove(heavy, start, [0, 1], 1), { reason: 'heavy', who: [0, 1] });
  assert.equal(checkMove(heavy, start, [1, 2], 1), null);
  assert.equal(checkMove(heavy, start, [0], 1), null);
  assert.deepEqual(checkMove(heavy, start, [1], 0), { reason: 'way', who: [] }, '배가 있는 곳으로는 못 보낸다');
  assert.deepEqual(checkMove(heavy, start, [1], 2), { reason: 'way', who: [] });
  assert.deepEqual(checkMove(heavy, { at: [0, 1, 0], boat: 0 }, [1], 1), { reason: 'far', who: [1] });
  const crowd = pairs(3, 2);
  assert.deepEqual(checkMove(crowd, startState(crowd), [0, 1, 2], 1), { reason: 'seats', who: [0, 1, 2] });
  const pet = pets(['dog', 'cat', 'fish']);
  assert.deepEqual(checkMove(pet, startState(pet), [2], 1), { reason: 'rower', who: [2] }, '할머니만 노를 젓는다');
  assert.deepEqual(checkMove(pet, startState(pet), [0, 1], 1), { reason: 'clash', where: 'stay', place: 0, kind: 'cat-fish', who: [2, 3] });
  assert.deepEqual(checkMove(pet, startState(pet), [0], 1), { reason: 'clash', where: 'stay', place: 0, kind: 'dog-cat', who: [1, 2] });
  assert.equal(checkMove(pet, startState(pet), [0, 2], 1), null);
  // 엄마와 아기: 배 위에서, 남는 곳에서, 닿는 곳에서
  assert.deepEqual(checkMove(crowd, startState(crowd), [0, 3], 1), { reason: 'clash', where: 'boat', place: 0, kind: 'baby', who: [0, 3] });
  assert.deepEqual(checkMove(crowd, startState(crowd), [0, 2], 1), { reason: 'clash', where: 'stay', place: 0, kind: 'baby', who: [1, 4] });
  const landing = { at: [0, 0, 0, 0, 1, 1], boat: 0 };
  assert.deepEqual(checkMove(crowd, landing, [3], 1), { reason: 'clash', where: 'land', place: 1, kind: 'baby', who: [3, 4] });
});

test('지금 모습에서 할 수 있는 움직임과 지나온 길 따라가기', () => {
  const board = weight(1, 2);
  assert.deepEqual(movesOf(board, startState(board)), [
    { who: [0], to: 1 },
    { who: [1], to: 1 },
    { who: [1, 2], to: 1 },
    { who: [2], to: 1 },
  ]);
  const trail = [{ who: [1, 2], to: 1 }, { who: [1], to: 0 }];
  assert.deepEqual(replay(board, trail), { ok: true, state: { at: [0, 0, 1], boat: 0 } });
  assert.equal(replay(board, [{ who: [0, 1], to: 1 }]).ok, false, '너무 무거운 움직임');
  assert.equal(replay(board, [{ who: [2, 1], to: 1 }]).ok, false, '번호는 작은 것부터 적는다');
  assert.equal(replay(board, [{ who: [1], to: 0 }]).ok, false);
  assert.equal(replay(board, 'x').ok, false);
  assert.equal(replay(board, [null]).ok, false);
  assert.deepEqual(applyMove(startState(board), { who: [0], to: 1 }), { at: [1, 0, 0], boat: 1 });
  assert.equal(isDone(board, { at: [1, 1, 1], boat: 1 }), true);
  assert.equal(isDone(pairs(2, 2, true), { at: [1, 1, 1, 1], boat: 1 }), false, '섬은 건너편이 아니다');
});

test('풀이 프로그램: 규격 안의 모든 판에서 다른 방법과 같은 답을 낸다. 내놓은 길을 따라가면 모두 건넌다', () => {
  const boards = allBoards();
  assert.equal(boards.length, 12 + 30 + 16);
  for (const board of boards) {
    const where = JSON.stringify(board);
    const solved = solve(board);
    const brute = bruteRiver(board);
    assert.equal(solved.possible, brute.possible, where);
    assert.equal(solved.min, brute.min, where);
    assert.equal(reachable(board), brute.reachable, `${where}: 갈 수 있는 모습`);
    if (solved.possible) {
      const played = replay(board, solved.moves);
      assert.equal(played.ok, true, where);
      assert.equal(isDone(board, played.state), true, where);
      assert.equal(solved.moves.length, solved.min, where);
    } else assert.deepEqual(solved.moves, [], where);
  }
});

test('코끼리와 생쥐: 생쥐가 하나면 안 되고, 둘 이상이면 (코끼리 수 × 4) + (생쥐 수 × 2) − 3번이다', () => {
  for (let heavy = 1; heavy <= 3; heavy++) {
    assert.equal(solve(weight(heavy, 1)).possible, false, `코끼리 ${heavy}, 생쥐 1`);
    for (let light = 2; light <= 4; light++) assert.equal(solve(weight(heavy, light)).min, 4 * heavy + 2 * light - 3, `코끼리 ${heavy}, 생쥐 ${light}`);
  }
  // 코끼리 하나와 생쥐 하나: 갈 수 있는 모습이 셋뿐이다(처음, 코끼리가 건너간 모습, 생쥐가 건너간 모습).
  assert.equal(reachable(weight(1, 1)), 3);
  // 생쥐 둘이면 코끼리가 하나 늘 때마다 네 번씩 는다.
  assert.deepEqual([1, 2, 3].map((heavy) => solve(weight(heavy, 2)).min), [5, 9, 13]);
});

test('할머니와 동물들: 셋이 서로 싸우는 판은 처음부터 배가 못 떠난다. 고양이를 가운데 둔 셋은 일곱 번이다', () => {
  // 강아지, 고양이, 병아리는 어느 둘도 함께 둘 수 없다. 할머니가 누구를 태우든 남는 둘이 싸운다.
  assert.equal(solve(pets(['dog', 'cat', 'chick'])).possible, false);
  assert.equal(reachable(pets(['dog', 'cat', 'chick'])), 1);
  assert.deepEqual(movesOf(pets(['dog', 'cat', 'chick']), startState(pets(['dog', 'cat', 'chick']))), []);
  assert.equal(reachable(pets(['dog', 'cat', 'chick', 'fish'])), 1);
  assert.equal(solve(pets(['dog', 'cat', 'fish'])).min, 7);
  assert.equal(solve(pets(['cat', 'chick', 'fish'])).min, 7);
  assert.equal(solve(pets(['dog', 'chick', 'fish'])).min, 5);
  // 배에 둘을 더 태울 수 있으면 넷도 된다.
  assert.equal(solve(pets(['dog', 'cat', 'chick'], 3)).min, 3);
  assert.equal(solve(pets(['dog', 'cat', 'chick', 'fish'], 3)).min, 5);
});

test('엄마와 아기: 둘이 타는 배로는 세 쌍까지, 셋이 타는 배로는 다섯 쌍까지 건넌다. 섬이 있으면 둘이 타는 배로도 다섯 쌍이 건넌다', () => {
  const table = (seats, island = false) => [2, 3, 4, 5].map((count) => solve(pairs(count, seats, island)).min);
  assert.deepEqual(table(2), [5, 11, null, null]);
  assert.deepEqual(table(3), [3, 5, 9, 11]);
  assert.deepEqual(table(4), [1, 3, 5, 7]);
  assert.deepEqual(table(2, true), [5, 11, 16, 21]);
  // 네 쌍과 둘이 타는 배: 갈 수 있는 모습은 44개뿐이고, 그 안에 모두 건넌 모습이 없다.
  assert.equal(reachable(pairs(4, 2)), 44);
  assert.equal(reachable(pairs(4, 2, true)), 2625);
});

test('섬에 꼭 들러야 하면(이웃한 곳으로만 가면) 횟수가 는다: 네 쌍 16번이 26번이 된다', () => {
  // 앱은 섬에 들르지 않고 건너편으로 바로 가도 되게 했다. 다른 방법으로 두 규칙을 견준다.
  assert.deepEqual([2, 3, 4].map((count) => bruteRiver(pairs(count, 2, true), { adjacent: true }).min), [10, 18, 26]);
  assert.deepEqual([2, 3, 4].map((count) => bruteRiver(pairs(count, 2, true)).min), [5, 11, 16]);
});

test('오답 짐작: 되는 판에 "불가능해요"', () => {
  const can = solve(weight(1, 2));
  const cannot = solve(weight(1, 1));
  assert.deepEqual(diagnoseImpossible(cannot, { moves: 0, firsts: [] }), { correct: true, guess: null });
  assert.deepEqual(diagnoseImpossible(can, { moves: 0, firsts: [] }), { correct: false, guess: 'impossible-no-try' });
  assert.deepEqual(diagnoseImpossible(can), { correct: false, guess: 'impossible-no-try' });
  assert.deepEqual(diagnoseImpossible(can, { moves: 4, firsts: ['0>1'] }), { correct: false, guess: 'impossible-same-first' });
  assert.deepEqual(diagnoseImpossible(can, { moves: 9, firsts: ['0>1', '1+2>1'] }), { correct: false, guess: 'impossible-other-way' });
});
