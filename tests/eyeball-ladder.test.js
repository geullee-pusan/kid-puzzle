// 눈대중의 사다리 점검: 단계마다 판 번호 1~100(작은 판도)이 그 단계의 조건에 맞고, 다른 방법으로 다시 풀어도 같은지,
// 알 수 없는 어림 판의 비율, 맨 처음 판들, "더 작은 판"(칸이 적은 얼룩, 짧은 선과 수 하나, 수가 둘이거나 작은 어림)을 본다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SMALLER, smallerEyeball } from '../src/core/smaller.js';
import { FIRST_LINE, FIRST_SIDE, HARD_LINES, LADDER, LINES, MAKE_LEVEL, SECOND_SIDE, SHORT_LINES, TOP_LEVEL, UNKNOWN_RATE, generateBoard, kindOf, nextSeed, rungOf, smallBoards, targetChoices } from '../src/core/eyeball-ladder.js';
import { bestCover, blobCells, checkBoard, solve, verdict } from '../src/core/eyeball.js';
import { bruteCells, bruteCoverAll, bruteCoverLast, bruteSide } from './helpers/brute-eyeball.js';

const SEEDS = Array.from({ length: 100 }, (_, index) => index + 1);
const specOf = (level, kind) => {
  const rung = rungOf(level);
  return rung.mode === 'mixed' ? rung[kind] : rung;
};

test('사다리: 여섯 단계, 맨 위는 직접 만들기, 단계마다 기본·응용·도전 표시', () => {
  assert.deepEqual(LADDER.map((rung) => rung.level), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(LADDER.map((rung) => rung.mode), ['area', 'cover', 'line', 'side', 'mixed', 'make']);
  assert.deepEqual(LADDER.map((rung) => rung.tag), ['basic', 'basic', 'applied', 'applied', 'challenge', 'challenge']);
  assert.equal(TOP_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 6);
  assert.equal(UNKNOWN_RATE, 1 / 3);
  assert.throws(() => generateBoard(6, 1));
  assert.throws(() => rungOf(9));
  // 5단계는 판 번호마다 덮기, 선, 어림이 번갈아 나온다
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((seed) => kindOf(5, seed)), ['cover', 'line', 'side', 'cover', 'line', 'side']);
  assert.deepEqual([1, 2, 3].map((level) => kindOf(level, 7)), ['area', 'cover', 'line']);
  // 선의 틀마다 찍을 수의 후보가 넉넉하다
  for (const line of [...LINES, ...SHORT_LINES]) assert.ok(targetChoices(line).length >= 4, `${line.from}~${line.to}`);
  for (const line of HARD_LINES) assert.ok(targetChoices(line, { hard: true }).length >= 20, `${line.from}~${line.to}`);
});

test('얼룩과 덮기: 모든 판(단계마다 1~100번, 작은 판도)이 그 단계의 크기와 칸 수에 맞고, 덮기의 가장 좋은 답이 다른 방법과 같다', () => {
  let checked = 0;
  for (const level of [1, 2, 5]) {
    for (const small of [false, true]) {
      for (const seed of SEEDS) {
        if (kindOf(level, seed) !== 'area' && kindOf(level, seed) !== 'cover') continue;
        const { board, solution } = generateBoard(level, seed, { small });
        const where = `${level}단계 ${seed}번${small ? ' 작은 판' : ''}`;
        const spec = specOf(level, board.kind);
        assert.equal(checkBoard(board), null, where);
        assert.deepEqual(generateBoard(level, seed, { small }).board, board, `${where}: 같은 번호는 같은 판`);
        assert.ok((small ? spec.small : spec.sizes).some(([w, h]) => w === board.w && h === board.h), where);
        const cells = bruteCells(board);
        assert.deepEqual(solution.cells, cells, where);
        const [low, high] = small ? spec.smallArea : spec.area;
        assert.ok(cells.length >= low && cells.length <= high, `${where}: 얼룩 ${cells.length}칸`);
        // 둥근 덩어리는 모두 판 안에 있다(얼룩이 판 끝에 잘리지 않는다)
        for (const [x, y, r] of board.circles) assert.ok(2 * x - r >= 1 && 2 * x + r <= 2 * board.w - 1 && 2 * y - r >= 1 && 2 * y + r <= 2 * board.h - 1, where);
        if (board.kind !== 'cover') continue;
        assert.equal(board.k, spec.k, where);
        // 다른 방법: 직사각형 k − 1개를 모두 골라 보고 마지막은 남은 칸을 꼭 감싸게(셋을 모두 고르는 것과 같은지는 작은 판에서 확인한다)
        if (seed <= (level === 5 ? 40 : 100)) {
          assert.equal(solution.best, bruteCoverLast(board, board.k, cells), where);
          checked += 1;
        }
        if (small) continue;
        // 꼭 맞게는 덮을 수 없고, 직사각형 하나로 덮을 때보다 셋 이상 가깝게(셋이면 둘로 덮을 때보다 둘 이상 가깝게) 덮을 수 있다
        assert.ok(solution.best >= 1, `${where}: 가장 적게 ${solution.best}칸`);
        assert.ok(bestCover(board, 1).extra - solution.best >= 3, where);
        if (board.k === 3) assert.ok(bestCover(board, 2).extra - solution.best >= 2, where);
      }
    }
  }
  assert.ok(checked > 120, `다른 방법으로 다시 푼 덮기 판 ${checked}개`);
  // 작은 덮기 판 몇 개는 셋을 모두 고르는 방법으로도 다시 푼다
  for (const seed of [1, 2, 3, 4, 5]) {
    const { board, solution } = generateBoard(2, seed, { small: true });
    assert.equal(solution.best, bruteCoverAll(board, 2), `2단계 ${seed}번 작은 판`);
  }
});

test('수직선: 모든 판이 틀 하나에서 나오고, 찍을 수가 끝에서 떨어져 있고 서로 떨어져 있다. 반이나 4분의 1 자리가 아니다', () => {
  for (const level of [3, 5]) {
    for (const small of [false, true]) {
      for (const seed of SEEDS) {
        if (kindOf(level, seed) !== 'line') continue;
        const { board } = generateBoard(level, seed, { small });
        const where = `${level}단계 ${seed}번${small ? ' 작은 판' : ''}`;
        const spec = specOf(level, 'line');
        assert.equal(checkBoard(board), null, where);
        const lines = small ? spec.small : spec.lines;
        assert.ok(lines.some((line) => line.from === board.from && line.to === board.to && line.step === board.step && JSON.stringify(line.ticks) === JSON.stringify(board.ticks)), where);
        assert.equal(board.targets.length, small ? 1 : spec.count, where);
        const range = board.to - board.from;
        for (const value of board.targets) {
          const at = value - board.from;
          assert.ok(at * 100 >= range * 6 && (range - at) * 100 >= range * 6, `${where}: ${value}`);
          assert.notEqual((at * 4) % range, 0, `${where}: ${value}는 반이나 4분의 1 자리`);
          if (level === 5 && !small) assert.notEqual((at * 10) % range, 0, `${where}: ${value}는 10분의 1 자리`);
        }
        for (const a of board.targets) for (const b of board.targets) if (a !== b) assert.ok(Math.abs(a - b) * 100 > range * 15, where);
        assert.deepEqual(generateBoard(level, seed, { small }).board, board);
      }
    }
  }
  assert.deepEqual(generateBoard(3, 1).board, FIRST_LINE);
});

test('어림: 모든 판이 가린 숫자를 모두 넣어 본 것과 같은 답이고, 같아지는 판과 같아질 수 있는 판은 없다. 알 수 없는 판은 셋에 하나쯤이다', () => {
  for (const level of [4, 5]) {
    for (const small of [false, true]) {
      let unknown = 0;
      let sides = 0;
      const ways = new Set();
      for (const seed of SEEDS) {
        if (kindOf(level, seed) !== 'side') continue;
        const { board, solution } = generateBoard(level, seed, { small });
        const where = `${level}단계 ${seed}번${small ? ' 작은 판' : ''}`;
        const spec = specOf(level, 'side');
        assert.equal(checkBoard(board), null, where);
        assert.ok(spec.ops.includes(board.op), where);
        const count = board.items.length;
        if (board.op === '+') assert.ok(count >= (small ? spec.small : spec.counts)[0] && count <= (small ? spec.small : spec.counts)[1], where);
        const brute = bruteSide(board);
        assert.equal(brute.consistent, true, where);
        assert.equal(solution.answer, brute.answer, where);
        assert.notEqual(solution.answer, 'same', where);
        assert.equal(verdict(board).touch, false, where);
        assert.equal(solution.by === 'directions', brute.directions, where);
        // 정해지는 판은 어림한 값과 실제 값이 2 넘게 다르다
        if (solution.answer !== 'unknown') assert.ok(Math.min(Math.abs(solution.est - solution.low), Math.abs(solution.est - solution.high)) >= 2, where);
        else assert.ok(board.items.some((item) => item.hide), where);
        // 곱하기에는 가린 수가 없다
        if (board.op === '×') assert.ok(board.items.every((item) => !item.hide), where);
        unknown += solution.answer === 'unknown' ? 1 : 0;
        sides += 1;
        ways.add(`${solution.answer}:${solution.by}`);
      }
      if (level === 4) {
        assert.ok(unknown >= 20 && unknown <= 45, `${level}단계${small ? ' 작은 판' : ''}: 알 수 없는 판 ${unknown}개`);
        for (const way of ['bigger:directions', 'smaller:directions', 'bigger:sizes', 'smaller:sizes', 'unknown:unknown']) assert.ok(ways.has(way), `${level}단계: ${way}`);
      } else assert.ok(unknown >= 3 && unknown <= sides / 2, `5단계: 어림 판 ${sides}개 가운데 알 수 없는 판 ${unknown}개`);
    }
  }
});

test('맨 처음 판들: 3단계 첫 판은 0~100의 40과 85, 4단계 첫 판은 모두 올린 판, 둘째 판은 아주 쉬운 알 수 없는 판이다', () => {
  assert.deepEqual(generateBoard(3, 1).board, FIRST_LINE);
  assert.deepEqual(generateBoard(4, 1).board, FIRST_SIDE);
  assert.deepEqual(generateBoard(4, 2).board, SECOND_SIDE);
  const first = solve(FIRST_SIDE);
  assert.deepEqual([first.answer, first.by, first.est, first.low], ['bigger', 'directions', 600, 595]);
  const second = solve(SECOND_SIDE);
  assert.deepEqual([second.answer, second.low, second.high, second.est], ['unknown', 390, 408, 400]);
  assert.equal(second.possible, false);
  // 1단계와 2단계의 첫 판은 만들어 낸 판이다(얼룩과 덮기에는 실패할 수 없다)
  assert.equal(generateBoard(1, 1).board.kind, 'area');
  assert.equal(generateBoard(2, 1).board.kind, 'cover');
  assert.equal(generateBoard(5, 1).board.k, 3);
});

test('다음 판 번호는 방금 한 판과 다른 판을 낸다', () => {
  for (const rung of LADDER.filter((item) => item.mode !== 'make')) {
    for (const seed of [1, 2, 3, 10]) {
      const next = nextSeed(rung.level, seed);
      assert.ok(next > seed);
      assert.notDeepEqual(generateBoard(rung.level, next).board, generateBoard(rung.level, seed).board);
    }
  }
});

test('더 작은 판: 얼룩은 칸이 4분의 3 이하, 선은 수 하나의 짧은 선, 어림은 수가 둘이거나 작은 수. 알 수 없는 어림에서는 정해지는 판부터 번갈아', () => {
  assert.equal(SMALLER.eyeball, smallerEyeball);
  let none = 0;
  for (const rung of LADDER.filter((item) => item.mode !== 'make')) {
    for (const seed of SEEDS.slice(0, 30)) {
      const { board, solution } = generateBoard(rung.level, seed);
      const origin = { mode: board.kind, board };
      const lists = smallBoards(origin);
      const where = `${rung.level}단계 ${seed}번`;
      for (const [kind, list] of Object.entries(lists)) {
        for (const small of list) {
          assert.equal(checkBoard(small), null, where);
          assert.equal(small.kind, board.kind, where);
          const result = solve(small);
          assert.equal(result.possible, kind === 'yes', `${where} ${kind}`);
          if (board.kind === 'area' || board.kind === 'cover') {
            assert.ok(small.w <= board.w && small.h <= board.h && small.w * small.h * 4 <= board.w * board.h * 3, where);
            assert.ok(blobCells(small).length < blobCells(board).length, where);
            if (board.kind === 'cover') assert.equal(small.k, board.k, where);
          }
          if (board.kind === 'line') {
            assert.equal(small.targets.length, 1, where);
            assert.ok(small.ticks.length === 1 && small.to - small.from <= 100, where);
          }
          if (board.kind === 'side') {
            assert.equal(small.op, board.op, where);
            assert.equal(small.items.length, 2, where);
            const size = (b) => b.items.reduce((sum, item) => sum + String(item.n).length, 0);
            assert.ok(board.items.length === 3 || size(small) < size(board), `${where}: 수가 셋이 아니면 자릿수가 준다`);
          }
        }
      }
      if (board.kind !== 'side') assert.equal(lists.no.length, 0, where);
      const turns = [0, 1, 2, 3].map((turn) => smallerEyeball(origin, turn));
      if (turns[0] === null) {
        none += 1;
        continue;
      }
      // 첫 작은 판은 늘 정해지는 판이다
      assert.equal(solve(turns[0].board).possible, true, where);
      if (solution.possible) for (const item of turns) assert.equal(solve(item.board).possible, true, where);
      else if (lists.yes.length > 0 && lists.no.length > 0) assert.equal(solve(turns[1].board).possible, false, where);
      assert.deepEqual(smallerEyeball(origin, 2), turns[2], `${where}: 같은 판, 같은 차례에는 같은 작은 판`);
    }
  }
  assert.ok(none < 10, `작은 판이 없는 판 ${none}개`);
  // 이미 가장 작은 선(찍을 수 하나, 0~10)에는 더 작은 판이 없다
  assert.equal(smallerEyeball({ mode: 'line', board: { kind: 'line', from: 0, to: 10, step: 1, ticks: [5], targets: [3] } }), null);
  assert.equal(smallerEyeball({ mode: 'area', board: { kind: 'area', w: 4, h: 3, circles: [[2, 1, 3]] } }), null);
  assert.equal(smallerEyeball({ mode: 'area', board: null }), null);
});
