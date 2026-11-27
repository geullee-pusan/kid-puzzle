// 지우고 쓰기 예언의 사다리와 판 내기, 더 작은 판: 단계마다 규칙과 수의 개수, 0을 남길 수 있는 판과 없는 판의 차례,
// 안 되는 판의 까닭(합이 홀수)을 아이가 볼 수 있는지 본다. 끝에 남길 수 있는 수는 모든 차례를 해 보는 다른 방법(tests/helpers/brute-erase.js)으로 다시 따진다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LADDER, LONG_RULES, MAKE_LEVEL, RULE_OF, SMALL_FLOOR, TOP_LEVEL, generateBoard, impossibleAt, longRule, nextSeed, rungOf, smallBoards, solveOnce } from '../src/core/erase-ladder.js';
import { boardKey, checkBoard, sumOf } from '../src/core/erase.js';
import { smallerErase } from '../src/core/smaller.js';
import { bruteFinals, playRandom } from './helpers/brute-erase.js';

const SEEDS = Array.from({ length: 60 }, (_, index) => index + 1);

test('사다리: 여섯 단계, 표시는 기본·기본·응용·응용·도전·도전, 맨 위는 직접 만들기', () => {
  assert.deepEqual(LADDER.map((rung) => rung.level), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(LADDER.map((rung) => rung.tag), ['basic', 'basic', 'applied', 'applied', 'challenge', 'challenge']);
  assert.deepEqual(LADDER.map((rung) => rung.mode), ['same', 'less', 'parity', 'zero', 'long', 'make']);
  assert.deepEqual(RULE_OF, { same: 'same', less: 'less', parity: 'diff', zero: 'diff' });
  assert.deepEqual(LONG_RULES, ['less', 'same', 'diff']);
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  assert.throws(() => generateBoard(6, 1));
  assert.throws(() => generateBoard(1, 0));
  assert.throws(() => rungOf(9));
});

test('처음 판들: 1단계는 1이 셋(1이 남는다), 2단계는 3, 5, 2(8이 남는다), 4단계 첫 판은 0을 남기기 쉽고 둘째 판은 처음 만나는 쉬운 안 되는 판이다', () => {
  assert.deepEqual(generateBoard(1, 1).board, { rule: 'same', nums: [1, 0, 1, 1, 0] });
  assert.deepEqual(bruteFinals('same', [1, 0, 1, 1, 0]), [1]);
  assert.deepEqual(generateBoard(2, 1).board, { rule: 'less', nums: [3, 5, 2] });
  assert.deepEqual(bruteFinals('less', [3, 5, 2]), [8]);
  assert.deepEqual(generateBoard(3, 1).board, { rule: 'diff', nums: [4, 1, 5, 3] });
  assert.deepEqual(bruteFinals('diff', [4, 1, 5, 3]), [1, 3, 5]);
  // 2, 3, 5: 세 가지 첫 지우기 가운데 둘이 0을 남긴다
  assert.deepEqual(generateBoard(4, 1).board, { rule: 'diff', nums: [2, 3, 5] });
  assert.deepEqual(bruteFinals('diff', [3, 5]), [2]);
  assert.deepEqual(bruteFinals('diff', [1, 5]), [4]);
  assert.deepEqual([bruteFinals('diff', [3, 3]), bruteFinals('diff', [2, 2])], [[0], [0]]);
  // 1, 2, 4: 세 가지 차례를 모두 해 보면 늘 홀수(1이나 3)가 남는다
  assert.deepEqual(generateBoard(4, 2).board, { rule: 'diff', nums: [1, 2, 4] });
  assert.deepEqual(bruteFinals('diff', [1, 2, 4]), [1, 3]);
  assert.deepEqual(generateBoard(5, 1).board, { rule: 'less', nums: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] });
  assert.equal(solveOnce(generateBoard(5, 1).board).final, 46);
  // 수준 맞추기의 작은 판은 1단계 첫 판이다
  assert.deepEqual(generateBoard(1, 7, { small: true }).board, generateBoard(1, 1).board);
});

test('판 번호 1~60: 같은 번호는 같은 판, 규격에 맞고 단계의 규칙과 수의 개수다. 끝에 남는 수와 남길 수 있는 수는 다른 방법으로 구한 것과 같다', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    const rung = rungOf(level);
    for (const seed of SEEDS) {
      const { board } = generateBoard(level, seed);
      const where = `${level}단계 ${seed}번 ${boardKey(board)}`;
      assert.equal(checkBoard(board), null, where);
      assert.deepEqual(generateBoard(level, seed).board, board, where);
      const found = solveOnce(board);
      const count = board.nums.length;
      if (rung.mode === 'long') {
        assert.equal(board.rule, longRule(seed), where);
        assert.ok(count >= 10 && count <= 20, where);
        if (board.rule !== 'same') assert.ok(board.nums.every((value) => value >= 1 && value <= 10), where);
        // 끝에 남는 수는 세 자리를 넘지 않는다(내 쪽지에 적는 숫자는 셋까지)
        if (found.final !== null) assert.ok(found.final <= 999, where);
        // 아무 차례로 지워도 같은 수(같으면 0 다르면 1, 합에서 1 빼기)나 같은 홀짝(차)이 남는다
        for (let turn = 1; turn <= 3; turn++) {
          const left = playRandom(board.rule, board.nums, seed * 7 + turn);
          if (found.final !== null) assert.equal(left, found.final, where);
          else assert.equal(left % 2, found.parity, where);
        }
        continue;
      }
      assert.equal(board.rule, RULE_OF[rung.mode], where);
      assert.ok(count >= rung.counts[0] && count <= rung.counts[1], where);
      const finals = bruteFinals(board.rule, board.nums);
      assert.deepEqual(found.finals, finals, where);
      if (rung.mode === 'same') assert.ok(board.nums.includes(0) && board.nums.includes(1), where);
      // 홀수일까 짝수일까: 남길 수 있는 수가 둘 이상이다(두 번 지우면 다른 수가 남을 수도 있다)
      if (rung.mode === 'parity') assert.ok(finals.length >= 2, where);
      if (rung.mode === 'zero') {
        if (impossibleAt(rung, seed)) {
          // 안 되는 판은 모두 합이 홀수다(합 보기로 보인다)
          assert.equal(sumOf(board.nums) % 2, 1, where);
          assert.ok(!finals.includes(0), where);
          assert.equal(found.zero, false, where);
        } else {
          // 되는 판은 0도, 0이 아닌 수도 남길 수 있다(아무렇게나 지우면 0이 안 남을 수도 있다)
          assert.ok(finals.includes(0) && finals.length >= 2, where);
          assert.equal(found.zero, true, where);
        }
      }
    }
  }
});

test('0을 남길 수 있을까: 안 되는 판은 여섯 판에 둘이고 연달아 나오지 않는다. 합이 짝수인데 0을 남길 수 없는 판은 사다리에 없다', () => {
  const rung = rungOf(4);
  const flags = SEEDS.map((seed) => impossibleAt(rung, seed));
  assert.equal(flags.filter(Boolean).length, 20);
  for (let index = 1; index < flags.length; index++) assert.ok(!(flags[index] && flags[index - 1]), `${index}번과 ${index + 1}번`);
  for (const seed of SEEDS) {
    const { board } = generateBoard(4, seed);
    if (sumOf(board.nums) % 2 === 0) assert.ok(bruteFinals('diff', board.nums).includes(0), `${seed}번`);
  }
  for (let level = 1; level <= TOP_LEVEL; level++) if (level !== 4) assert.ok(SEEDS.every((seed) => !impossibleAt(rungOf(level), seed)));
});

test('다음 판 번호: 방금 한 판과 같은 판이 나오는 번호는 건너뛴다', () => {
  // 1단계 2번 판은 1번 판과 같다
  assert.deepEqual(generateBoard(1, 2).board, generateBoard(1, 1).board);
  assert.equal(nextSeed(1, 1), 3);
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (const seed of SEEDS.slice(0, 20)) {
      const next = nextSeed(level, seed);
      assert.ok(next > seed);
      assert.notDeepEqual(generateBoard(level, next).board, generateBoard(level, seed).board);
    }
  }
});

test('더 작은 판: 같은 규칙과 같은 물음이고 수가 적다. 0을 남길 수 없는 판에서는 남길 수 있는 판부터 남길 수 없는 판과 번갈아 낸다', () => {
  let none = 0;
  for (let level = 1; level <= TOP_LEVEL; level++) {
    const rung = rungOf(level);
    for (const seed of SEEDS.slice(0, 30)) {
      const { board } = generateBoard(level, seed);
      const origin = { mode: rung.mode, board };
      const possible = rung.mode !== 'zero' || solveOnce(board).zero === true;
      for (let turn = 0; turn < 4; turn++) {
        const small = smallerErase(origin, turn);
        const where = `${level}단계 ${seed}번 ${turn}번째`;
        if (board.nums.length <= SMALL_FLOOR) {
          assert.equal(small, null, where);
          none += turn === 0 ? 1 : 0;
          continue;
        }
        assert.ok(small, where);
        assert.deepEqual(smallerErase(origin, turn), small, where);
        const { board: little } = small;
        assert.equal(checkBoard(little), null, where);
        assert.equal(little.rule, board.rule, where);
        assert.ok(little.nums.length < board.nums.length && little.nums.length >= SMALL_FLOOR, where);
        if (board.nums.length >= 8) assert.ok([5, 6].includes(little.nums.length), where);
        const finals = bruteFinals(little.rule, little.nums);
        if (rung.mode === 'same') assert.ok(little.nums.includes(0) && little.nums.includes(1), where);
        if (rung.mode === 'parity') assert.ok(finals.length >= 2, where);
        if (rung.mode === 'zero') {
          // 되는 판에서는 되는 판만. 안 되는 판에서는 되는 판부터, 합이 홀수인 판과 번갈아
          const wantYes = possible || turn % 2 === 0;
          if (wantYes) assert.ok(finals.includes(0) && finals.length >= 2, where);
          else assert.equal(sumOf(little.nums) % 2, 1, where);
        }
      }
    }
  }
  assert.ok(none > 0);
  // 같은 판에서 이어서 여는 두 판은 다르다
  const origin = { mode: 'less', board: generateBoard(2, 3).board };
  if (origin.board.nums.length > SMALL_FLOOR) assert.notDeepEqual(smallerErase(origin, 0), smallerErase(origin, 1));
  // 직접 만든 큰 칠판에도 작은 판이 있다
  const made = smallBoards({ mode: 'made', board: { rule: 'diff', nums: [4, 9, 2, 7, 7, 1, 3, 8] } });
  assert.ok(made.yes.length >= 1 && made.yes.every((item) => item.rule === 'diff' && [5, 6].includes(item.nums.length)));
  assert.equal(smallerErase({ mode: 'same', board: null }), null);
  assert.equal(smallerErase({ mode: 'same', board: { rule: 'same', nums: [1, 2] } }), null);
});
