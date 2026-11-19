// 컵 뒤집기와 세 색 무리의 사다리와 판 내기 점검. 낸 판은 풀이 프로그램과 다른 방법으로 다시 확인하고,
// 공통 규격(첫 판은 실패할 수 없다, 처음 만나는 안 되는 판은 쉽다, 안 되는 판은 셋에 하나쯤, 연달아 나오지 않는다)을 본다.
// "더 작은 판으로"의 판도 여기서 본다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LADDER, MAKE_LEVEL, OLD_MAKE_LEVEL, TOP_LEVEL, generateBoard, nextSeed, rungOf, solveOnce } from '../src/core/cups-ladder.js';
import { applyMove, checkBoard, downCount, invariantRulesOut, isDone, replay, solve, startItems } from '../src/core/cups.js';
import { COLORS_FLOOR, SMALLER, smallCupsBoards, smallerCups } from '../src/core/smaller.js';
import { bruteOf } from './helpers/brute-cups.js';

const playing = LADDER.filter((rung) => rung.mode !== 'make');
const madeAll = (level) => rungOf(level).boards.map((_, index) => generateBoard(level, index + 1));
const size = (board) => (board.kind === 'cups' ? board.n : board.counts.reduce((sum, count) => sum + count, 0));

test('사다리: 일곱 단계이고 표시는 기본·응용·응용·도전·도전·도전·도전, 맨 위는 직접 만들기', () => {
  assert.deepEqual(LADDER.map((rung) => rung.level), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(LADDER.map((rung) => rung.tag), ['basic', 'applied', 'applied', 'challenge', 'challenge', 'challenge', 'challenge']);
  assert.deepEqual(LADDER.map((rung) => rung.mode), ['maybe', 'fewest', 'maybe', 'maybe', 'maybe', 'maybe', 'make']);
  // 컵(익숙한 홀짝) → 컵, 가장 적게 → 세 색 무리(홀짝이 아닌 첫 열쇠) → 더 많이 → 섞어서
  assert.deepEqual(
    playing.map((rung) => [...new Set(rung.boards.map((entry) => entry[0]))]),
    [['cups'], ['cups'], ['colors'], ['colors'], ['cups', 'colors'], ['merge']],
  );
  assert.deepEqual(LADDER.map((rung) => rung.ask), ['cups', 'fewest', 'colors', 'colors', 'mixed', 'merge', null]);
  // 1~5단계의 번호는 그대로이고, 직접 만들기는 6단계에서 7단계로 옮겼다(예전 번호는 OLD_MAKE_LEVEL로 받는다).
  assert.deepEqual([TOP_LEVEL, MAKE_LEVEL, OLD_MAKE_LEVEL], [6, 7, 6]);
  assert.throws(() => rungOf(8));
  assert.throws(() => generateBoard(MAKE_LEVEL, 1));
  assert.throws(() => nextSeed(9, 1));
});

test('같은 번호는 늘 같은 판이고, 판마다 풀이 프로그램의 결과가 붙어 있다. 다른 방법으로 다시 구해도 같다', () => {
  for (const rung of playing) {
    for (let seed = 1; seed <= 30; seed++) {
      const made = generateBoard(rung.level, seed);
      const where = `${rung.level}단계 ${seed}번`;
      assert.deepEqual(made, generateBoard(rung.level, seed), where);
      assert.deepEqual([made.level, made.seed, made.small], [rung.level, seed, false], where);
      assert.equal(checkBoard(made.board), null, where);
      // 차례에 적힌 대로: 컵 수, 한 번에 뒤집는 수, 엎어진 컵 수 / 세 색의 마릿수
      const entry = rung.boards[(seed - 1) % rung.boards.length];
      if (entry[0] === 'cups') assert.deepEqual([made.board.n, made.board.k, downCount(made.board.cups)], entry.slice(1), where);
      else if (entry[0] === 'merge') assert.deepEqual([...made.board.counts, made.board.target], entry.slice(1), where);
      else assert.deepEqual(made.board.counts, entry.slice(1), where);
      const solved = solve(made.board);
      assert.deepEqual(made.solution, { possible: solved.possible, min: solved.min, moves: solved.moves }, where);
      const brute = bruteOf(made.board);
      assert.deepEqual([made.solution.possible, made.solution.min], [brute.possible, brute.min], where);
      if (made.solution.possible) {
        const played = replay(made.board, made.solution.moves);
        assert.ok(played.ok && isDone(made.board, played.items), where);
      }
      // 처음부터 끝난 판은 내지 않는다.
      assert.equal(isDone(made.board, startItems(made.board)), false, where);
    }
  }
  assert.equal(solveOnce({ kind: 'colors', counts: [2, 2, 0] }), solveOnce({ kind: 'colors', counts: [2, 2, 0] }));
});

test('"새 판"은 늘 다른 판이다. 차례를 다 돌면 같은 꼴의 판이 다시 나온다', () => {
  for (const rung of playing) {
    const count = rung.boards.length;
    for (let seed = 1; seed <= 3 * count; seed++) {
      const next = nextSeed(rung.level, seed);
      assert.equal(next, seed + 1);
      assert.notDeepEqual(generateBoard(rung.level, next).board, generateBoard(rung.level, seed).board, `${rung.level}단계 ${seed}번 다음`);
      const now = rung.boards[(seed - 1) % count];
      assert.notDeepEqual(rung.boards[seed % count], now, `${rung.level}단계 ${seed}번: 차례의 이웃한 판`);
    }
  }
});

test('형식의 첫 판은 실패할 수 없다: 컵 넷이 모두 엎어진 판(두 개씩). 갈 수 있는 모든 모습에서 끝낼 수 있다', () => {
  const first = generateBoard(1, 1);
  assert.deepEqual(first.board, { kind: 'cups', n: 4, k: 2, cups: [1, 1, 1, 1] });
  assert.deepEqual([first.solution.possible, first.solution.min], [true, 2]);
  // 갈 수 있는 모든 모습(엎어진 컵이 짝수 개인 모든 줄)에서 아직 끝낼 수 있다.
  const seen = new Set();
  const stack = [first.board.cups];
  while (stack.length > 0) {
    const items = stack.pop();
    if (seen.has(items.join(''))) continue;
    seen.add(items.join(''));
    assert.ok(solve({ ...first.board, cups: items }).possible, items.join(''));
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) stack.push(applyMove(first.board, items, [a, b]));
  }
  assert.equal(seen.size, 8);
  // 수준 맞추기가 "작은 판부터"라고 하면 맨 아래 단계에서는 늘 그 판을 낸다. 다른 단계에서는 그대로다.
  for (const seed of [1, 2, 3, 7]) {
    assert.deepEqual(generateBoard(1, seed, { small: true }).board, first.board);
    assert.equal(generateBoard(1, seed, { small: true }).small, true);
    assert.deepEqual(generateBoard(3, seed, { small: true }).board, generateBoard(3, seed).board);
  }
  // 세 색 무리의 첫 판(빨강 둘, 파랑 둘)도 어디로 가도 끝낼 수 있다(나머지가 같은 두 색은 끝까지 같다).
  const folk = generateBoard(3, 1);
  assert.deepEqual(folk.board.counts, [2, 2, 0]);
  const reach = new Set();
  const queue = [folk.board.counts];
  while (queue.length > 0) {
    const counts = queue.pop();
    if (reach.has(counts.join(','))) continue;
    reach.add(counts.join(','));
    assert.ok(solve({ kind: 'colors', counts }).possible, counts.join(','));
    for (const [a, b] of [
      [0, 1],
      [0, 2],
      [1, 2],
    ]) {
      if (counts[a] === 0 || counts[b] === 0) continue;
      const after = counts.slice();
      after[a] -= 1;
      after[b] -= 1;
      after[3 - a - b] += 2;
      queue.push(after);
    }
  }
});

test('안 되는 판이 섞이는 단계(1, 3, 4, 5, 6단계): 셋에 하나이고, 연달아 나오지 않고, 처음 만나는 판은 되는 판이다', () => {
  for (const level of [1, 3, 4, 5, 6]) {
    const made = madeAll(level);
    const impossible = made.filter((item) => !item.solution.possible);
    assert.equal(impossible.length * 3, made.length, `${level}단계`);
    assert.equal(made[0].solution.possible, true, `${level}단계: 처음 만나는 판은 되는 판`);
    made.forEach((item, index) => {
      const next = made[(index + 1) % made.length];
      assert.ok(item.solution.possible || next.solution.possible, `${level}단계 ${index + 1}번`);
      // 사다리의 안 되는 판은 모두 "왜 그럴까?"의 까닭(바뀌지 않는 값)이 가려 주는 판이다.
      if (!item.solution.possible) assert.equal(invariantRulesOut(item.board), true, `${level}단계 ${index + 1}번`);
    });
  }
  // 처음 만나는 안 되는 판(1단계 셋째 판)은 가장 쉬운 판이다: 컵 셋 가운데 하나가 엎어진 판.
  const easy = madeAll(1)[2].board;
  assert.deepEqual([easy.n, easy.k, downCount(easy.cups)], [3, 2, 1]);
  // 세 색 무리의 첫 안 되는 판도 가장 작은 판이다: 빨강 하나, 파랑 둘(갈 수 있는 마릿수가 세 가지뿐).
  assert.deepEqual(madeAll(3)[2].board.counts, [1, 2, 0]);
  assert.equal(bruteOf(madeAll(3)[2].board).reachable > 0, true);
  // 섞어서(5단계): 컵과 방울이가 번갈아 나오고, 안 되는 판도 하나씩이다.
  assert.deepEqual(madeAll(5).map((item) => item.board.kind), ['cups', 'colors', 'cups', 'colors', 'cups', 'colors']);
  assert.deepEqual(madeAll(5).filter((item) => !item.solution.possible).map((item) => item.board.kind), ['cups', 'colors']);
});

test('가장 적게(2단계)의 판은 모두 되는 판이다. 단계마다 가장 적은 횟수', () => {
  const mins = (level) => madeAll(level).map((item) => item.solution.min);
  assert.deepEqual(mins(1), [2, 2, null, 2, null, 3]);
  assert.deepEqual(mins(2), [3, 4, 2, 3]);
  assert.deepEqual(mins(3), [2, 3, null, 3, null, 2]);
  assert.deepEqual(mins(4), [4, 5, null, 5, null, 4]);
  assert.deepEqual(mins(5), [3, 3, null, 4, 2, null]);
  assert.deepEqual(mins(6), [2, null, 4, 4, null, 4]);
  // 2단계: 엎어진 컵이 하나뿐인데 세 번, 넷이 모두 엎어졌는데 네 번이 걸리는 판이 있다(엎어진 컵 수보다 많다).
  const fewest = madeAll(2).map((item) => [downCount(item.board.cups), item.solution.min]);
  assert.ok(fewest.some(([down, min]) => min > down));
  assert.ok(fewest.every(([, min]) => min >= 2));
});

test('"더 작은 판으로": 같은 종류에서 컵이나 방울이를 줄인 판. 컵은 한 번에 뒤집는 수가 같고, 되는 판에서는 되는 판만 낸다', () => {
  assert.equal(SMALLER.cups, smallerCups);
  let none = 0;
  for (const rung of playing) {
    for (let seed = 1; seed <= 12; seed++) {
      const { board } = generateBoard(rung.level, seed);
      const possible = solve(board).possible || rung.mode === 'fewest';
      for (const turn of [0, 1, 2, 3]) {
        const where = `${rung.level}단계 ${seed}번 ${turn}`;
        const small = smallerCups({ mode: rung.mode, board }, turn);
        if (!small) {
          none += 1;
          continue;
        }
        assert.equal(checkBoard(small.board), null, where);
        assert.equal(small.board.kind, board.kind, where);
        assert.ok(size(small.board) < size(board), `${where}: 더 작다`);
        if (board.kind === 'merge') assert.equal(small.board.target, board.target, where);
        if (board.kind === 'cups') {
          assert.equal(small.board.k, board.k, where);
          assert.ok(small.board.n > small.board.k, `${where}: 모두 한 번에 뒤집는 판이 아니다`);
        } else assert.ok(size(small.board) >= COLORS_FLOOR, where);
        const solved = solve(small.board);
        if (possible) assert.equal(solved.possible, true, `${where}: 되는 판에서는 되는 판만`);
        if (solved.possible) assert.ok(solved.min >= 2, `${where}: 한 번에 끝나는 판`);
        assert.equal(isDone(small.board, startItems(small.board)), false, where);
        assert.deepEqual(smallerCups({ mode: rung.mode, board }, turn), small, `${where}: 같은 판에서는 같은 작은 판`);
      }
      // 안 되는 판에서는 첫 작은 판이 되는 판이고, 둘째가 안 되는 판이다.
      // (컵 셋, 방울이 셋인 가장 작은 판에는 작은 판이 없다.)
      if (!possible && size(board) > 3) {
        assert.equal(solve(smallerCups({ mode: rung.mode, board }, 0).board).possible, true, `${rung.level}단계 ${seed}번`);
        assert.equal(solve(smallerCups({ mode: rung.mode, board }, 1).board).possible, false, `${rung.level}단계 ${seed}번`);
      }
    }
  }
  // 가장 작은 판(컵 셋, 방울이 셋)에는 더 작은 판이 없다.
  assert.ok(none > 0);
  assert.equal(smallerCups({ board: { kind: 'cups', n: 3, k: 2, cups: [0, 1, 0] } }), null);
  assert.equal(smallerCups({ board: { kind: 'colors', counts: [1, 2, 0] } }), null);
  assert.equal(smallerCups({ board: { kind: 'cups', n: 4, k: 4, cups: [1, 1, 0, 0] } }), null);
  assert.equal(smallerCups({ board: null }), null);
  // 원래 판에 가까운 것부터: 빨강 넷, 파랑 둘, 노랑 하나의 첫 작은 판은 한 마리 적은 판이다.
  assert.equal(size(smallCupsBoards({ kind: 'colors', counts: [4, 2, 1] })[0]), 6);
});

test('6단계(셋이 하나로): 어떻게 만나도 마지막에 남는 색이 정해진 판만 낸다. 되는 판은 정해진 색이 남길 색이고, 안 되는 판은 다른 색이다', () => {
  const made = madeAll(6);
  for (const { board, solution } of made) {
    const where = board.counts.join(',');
    const brute = bruteOf(board);
    // 다른 방법으로 끝까지 따지면 남을 수 있는 색은 하나뿐이다.
    assert.equal(brute.ends.length, 1, where);
    assert.equal(solution.possible, brute.ends[0] === board.target, where);
    assert.equal(isDone(board, startItems(board)), false, where);
  }
  // 처음 만나는 안 되는 판이 둘째 안 되는 판보다 작다.
  const impossible = made.filter((item) => !item.solution.possible).map((item) => size(item.board));
  assert.ok(impossible[0] < impossible[1]);
  // 판 고르기의 그림과 같은 첫 판: 빨강 둘, 파랑 하나, 노랑 둘에서 파랑을 남긴다(2번이면 된다).
  assert.deepEqual(made[0].board, { kind: 'merge', counts: [2, 1, 2], target: 1 });
});
