// 풀이 프로그램과 오답 짐작. 손으로 확인할 수 있는 사실과 견주고, 다른 방법으로 구한 답과도 견준다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MAX_COINS, applyMove, checkBoard, diagnose, fromMask, headCount, isMove, moveMasks, selectable, solve, toMask } from '../src/core/coins.js';

const board = (rule, shape, coins) => ({ n: coins.length, shape, rule, coins });
const allBoards = function* (rule, shape, n) {
  for (let mask = 0; mask < 1 << n; mask++) yield board(rule, shape, fromMask(mask, n));
};
const popcount = (value) => {
  let count = 0;
  for (let rest = value; rest; rest &= rest - 1) count++;
  return count;
};

/**
 * 풀이 프로그램과 다른 길로 가장 적은 횟수를 구한다.
 * 뒤집기는 순서를 바꿔도 결과가 같고, 같은 묶음을 두 번 뒤집으면 제자리다.
 * 그래서 "어떤 묶음들을 한 번씩 뒤집을지"의 모든 경우를 다 해 보면 된다.
 * @returns {Map<number, number>} 상태 → 가장 적은 횟수(없는 상태는 불가능)
 */
function bySubsets(rule, shape, n) {
  const masks = moveMasks({ n, shape, rule });
  const best = new Map();
  for (let subset = 0; subset < 1 << masks.length; subset++) {
    let state = 0;
    masks.forEach((mask, index) => {
      if ((subset >> index) & 1) state ^= mask;
    });
    const count = popcount(subset);
    if (!best.has(state) || best.get(state) > count) best.set(state, count);
  }
  return best;
}

/** 번호를 3으로 나눈 나머지가 같은 동전끼리 모아, 앞면의 수가 홀수인지 짝수인지 본다 */
function classParities(coins) {
  const parity = [0, 0, 0];
  coins.forEach((coin, index) => {
    parity[index % 3] ^= coin;
  });
  return parity;
}
const sameParity = (coins) => {
  const [a, b, c] = classParities(coins);
  return a === b && b === c;
};

test('판 규격: 틀린 판을 알아본다', () => {
  assert.equal(checkBoard(board('any2', 'line', [1, 0, 1])), null);
  assert.equal(checkBoard(board('swap', 'line', [1, 0, 1])), 'bad-rule');
  assert.equal(checkBoard(board('any2', 'star', [1, 0, 1])), 'bad-shape');
  assert.equal(checkBoard(board('any3', 'line', [1, 0])), 'bad-count');
  assert.equal(checkBoard(board('any2', 'line', Array(MAX_COINS + 1).fill(1))), 'bad-count');
  assert.equal(checkBoard({ n: 3, shape: 'line', rule: 'any2', coins: [1, 0] }), 'bad-coins');
  assert.equal(checkBoard(board('any2', 'line', [1, 2, 0])), 'bad-coins');
  assert.throws(() => solve(board('any2', 'star', [1, 1])));
});

test('동전 배열과 비트 사이를 오간다', () => {
  assert.equal(toMask([1, 0, 1, 1]), 0b1101);
  assert.deepEqual(fromMask(0b1101, 4), [1, 0, 1, 1]);
  assert.equal(headCount([1, 0, 1, 1]), 3);
});

test('뒤집을 수 있는 묶음의 수: 아무 두 개, 아무 세 개, 이웃한 세 개', () => {
  assert.equal(moveMasks({ n: 5, shape: 'line', rule: 'any2' }).length, 10);
  assert.equal(moveMasks({ n: 6, shape: 'line', rule: 'any3' }).length, 20);
  assert.equal(moveMasks({ n: 6, shape: 'line', rule: 'adj3' }).length, 4);
  assert.equal(moveMasks({ n: 6, shape: 'ring', rule: 'adj3' }).length, 6);
  assert.equal(moveMasks({ n: 3, shape: 'ring', rule: 'adj3' }).length, 1); // 세 묶음이 모두 같은 세 개다
});

test('아무 두 개: 앞면이 홀수 개면 안 되고, 짝수 개면 앞면 수의 절반 번이다 (2~10개 모든 판)', () => {
  for (let n = 2; n <= 10; n++) {
    for (const item of allBoards('any2', 'line', n)) {
      const heads = headCount(item.coins);
      const result = solve(item);
      assert.equal(result.possible, heads % 2 === 0, `${item.coins.join('')}`);
      if (result.possible) assert.equal(result.min, heads / 2, `${item.coins.join('')}`);
      else assert.equal(result.min, null);
    }
  }
});

test('아무 두 개: 손으로 확인한 작은 판', () => {
  assert.equal(solve(board('any2', 'line', [1, 1, 1, 1])).min, 2);
  assert.equal(solve(board('any2', 'line', [1, 1, 1, 1, 1])).possible, false);
  assert.equal(solve(board('any2', 'line', [1, 1, 1, 1, 1, 1])).min, 3);
  assert.equal(solve(board('any2', 'line', [1, 0, 1])).min, 1);
  assert.deepEqual(solve(board('any2', 'line', [0, 0, 0])), { possible: true, min: 0, moves: [] });
});

test('아무 세 개: 모두 앞면인 4·5·6·7개의 가장 적은 횟수는 4·3·2·3번이다', () => {
  const mins = [4, 5, 6, 7].map((n) => solve(board('any3', 'line', Array(n).fill(1))).min);
  assert.deepEqual(mins, [4, 3, 2, 3]);
});

test('아무 세 개: 4~10개에서는 안 되는 판이 없고, 가장 적은 횟수의 홀짝은 앞면 수의 홀짝과 같다', () => {
  for (let n = 4; n <= 10; n++) {
    for (const item of allBoards('any3', 'line', n)) {
      const result = solve(item);
      assert.equal(result.possible, true, `${item.coins.join('')}`);
      assert.equal(result.min % 2, headCount(item.coins) % 2, `${item.coins.join('')}`);
    }
  }
});

test('아무 세 개: 동전이 딱 3개면 모두 앞면과 모두 뒷면만 된다', () => {
  for (const item of allBoards('any3', 'line', 3)) {
    const heads = headCount(item.coins);
    assert.equal(solve(item).possible, heads === 0 || heads === 3);
  }
});

test('이웃한 세 개, 한 줄: 가·나·다 자리의 앞면 수의 홀짝이 모두 같을 때만 된다 (3~10개 모든 판)', () => {
  for (let n = 3; n <= 10; n++) {
    let possible = 0;
    for (const item of allBoards('adj3', 'line', n)) {
      const result = solve(item);
      assert.equal(result.possible, sameParity(item.coins), `${item.coins.join('')}`);
      if (result.possible) possible++;
    }
    assert.equal(possible, (1 << n) / 4, `${n}개: 되는 판은 넷에 하나`);
  }
});

test('이웃한 세 개, 고리: 6개와 9개는 홀짝이 같을 때만 되고, 4·5·7·8·10개는 모든 판이 된다', () => {
  for (const n of [6, 9]) {
    for (const item of allBoards('adj3', 'ring', n)) assert.equal(solve(item).possible, sameParity(item.coins), `${item.coins.join('')}`);
  }
  for (const n of [4, 5, 7, 8, 10]) {
    for (const item of allBoards('adj3', 'ring', n)) assert.equal(solve(item).possible, true, `${item.coins.join('')}`);
  }
});

test('다른 방법(묶음의 모든 조합)으로 구한 가장 적은 횟수와 같다', () => {
  const cases = [
    ['any2', 'line', [2, 3, 4, 5]],
    ['any3', 'line', [3, 4, 5]],
    ['adj3', 'line', [3, 4, 5, 6, 7, 8, 9, 10]],
    ['adj3', 'ring', [3, 4, 5, 6, 7, 8, 9, 10]],
  ];
  for (const [rule, shape, counts] of cases) {
    for (const n of counts) {
      const best = bySubsets(rule, shape, n);
      for (const item of allBoards(rule, shape, n)) {
        const result = solve(item);
        const mask = toMask(item.coins);
        assert.equal(result.possible, best.has(mask), `${rule} ${shape} ${item.coins.join('')}`);
        if (result.possible) assert.equal(result.min, best.get(mask), `${rule} ${shape} ${item.coins.join('')}`);
      }
    }
  }
});

test('풀이의 순서를 실제로 따라 하면 모두 뒷면이 되고, 횟수가 가장 적은 횟수와 같다', () => {
  const cases = [
    ['any2', 'line', [4, 7]],
    ['any3', 'line', [4, 5, 7]],
    ['adj3', 'line', [5, 8]],
    ['adj3', 'ring', [5, 6, 9]],
  ];
  for (const [rule, shape, counts] of cases) {
    for (const n of counts) {
      for (const item of allBoards(rule, shape, n)) {
        const result = solve(item);
        if (!result.possible) {
          assert.deepEqual(result.moves, []);
          continue;
        }
        assert.equal(result.moves.length, result.min);
        let coins = item.coins;
        for (const move of result.moves) {
          assert.ok(isMove(item, move), `규칙에 맞지 않는 뒤집기: ${move}`);
          coins = applyMove(coins, move);
        }
        assert.equal(headCount(coins), 0, `${rule} ${shape} ${item.coins.join('')}`);
      }
    }
  }
});

test('같은 판은 늘 같은 풀이를 낸다', () => {
  const item = board('adj3', 'ring', [1, 0, 1, 1, 0, 1, 0]);
  assert.deepEqual(solve(item), solve(item));
});

test('뒤집기: 원래 배열을 바꾸지 않는다', () => {
  const coins = [1, 0, 1];
  assert.deepEqual(applyMove(coins, [0, 1]), [0, 1, 1]);
  assert.deepEqual(coins, [1, 0, 1]);
});

test('규칙에 맞는 뒤집기만 받아들인다', () => {
  const line = board('adj3', 'line', [1, 1, 1, 1, 1]);
  const ring = board('adj3', 'ring', [1, 1, 1, 1, 1]);
  assert.equal(isMove(line, [1, 2, 3]), true);
  assert.equal(isMove(line, [3, 1, 2]), true); // 누른 순서는 상관없다
  assert.equal(isMove(line, [0, 2, 4]), false);
  assert.equal(isMove(line, [3, 4, 0]), false); // 한 줄에서는 끝과 처음이 이웃이 아니다
  assert.equal(isMove(ring, [3, 4, 0]), true);
  assert.equal(isMove(line, [1, 2]), false);
  assert.equal(isMove(line, [1, 1, 2]), false);
  assert.equal(isMove(board('any2', 'line', [1, 1, 1]), [0, 2]), true);
  assert.equal(isMove(board('any2', 'line', [1, 1, 1]), [0, 3]), false);
});

test('고를 수 있는 동전: 이웃 규칙에서는 한 묶음이 될 수 있는 것만 남는다', () => {
  const line = board('adj3', 'line', Array(7).fill(1));
  assert.deepEqual(selectable(line, []), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(selectable(line, [3]), [1, 2, 4, 5]);
  assert.deepEqual(selectable(line, [3, 5]), [4]);
  assert.deepEqual(selectable(line, [3, 4]), [2, 5]);
  assert.deepEqual(selectable(line, [0]), [1, 2]);
  assert.deepEqual(selectable(line, [2, 3, 4]), []);
  const ring = board('adj3', 'ring', Array(7).fill(1));
  assert.deepEqual(selectable(ring, [0]), [1, 2, 5, 6]);
  assert.deepEqual(selectable(ring, [6, 1]), [0]);
  const any = board('any3', 'line', Array(5).fill(1));
  assert.deepEqual(selectable(any, [4]), [0, 1, 2, 3]);
  assert.deepEqual(selectable(any, [4, 0, 2]), []);
});

test('오답 짐작: 네 가지 틀린 답과 맞는 답', () => {
  const possible = { possible: true, min: 3 };
  const impossible = { possible: false, min: null };
  assert.deepEqual(diagnose(possible, { kind: 'number', value: 3 }), { correct: true, guess: null });
  assert.deepEqual(diagnose(impossible, { kind: 'impossible' }), { correct: true, guess: null });
  assert.deepEqual(diagnose(impossible, { kind: 'number', value: 2 }), { correct: false, guess: 'number-on-impossible' });
  assert.deepEqual(diagnose(possible, { kind: 'impossible' }), { correct: false, guess: 'impossible-on-possible' });
  assert.deepEqual(diagnose(possible, { kind: 'number', value: 5 }), { correct: false, guess: 'too-many' });
  assert.deepEqual(diagnose(possible, { kind: 'number', value: 2 }), { correct: false, guess: 'too-few' });
  assert.deepEqual(diagnose(possible, { kind: 'number', value: 0 }), { correct: false, guess: 'too-few' });
  assert.throws(() => diagnose(possible, { kind: 'number', value: -1 }));
  assert.throws(() => diagnose(possible, { kind: 'number', value: 1.5 }));
  assert.throws(() => diagnose(possible, { kind: 'word' }));
});

test('오답 짐작: 풀이 프로그램의 결과를 그대로 넣어도 된다', () => {
  const item = board('any2', 'line', [1, 1, 0, 1, 1, 0]);
  const result = solve(item);
  assert.equal(diagnose(result, { kind: 'number', value: 2 }).correct, true);
  assert.equal(diagnose(result, { kind: 'number', value: 4 }).guess, 'too-many');
});
