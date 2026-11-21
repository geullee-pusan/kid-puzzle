// "더 작은 판": 형식마다, 사다리의 판(판 번호 1~100)에서 내주는 작은 판이
// 원래 판보다 작고, 규칙이 같고, 풀이 프로그램으로 확인된 판인지 본다.
// 가장 작은 판에서는 없다고 내주는지, 같은 판에서는 늘 같은 작은 판이 나오는지도 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import * as codeLadder from '../src/core/code-ladder.js';
import { allCodes, checkBoard as checkCode, isLean, solveTable } from '../src/core/code.js';
import { bruteMatches, bruteOneLie, bruteSets } from './helpers/brute-code.js';
import { checkBoard as checkCoins, headCount, solve as solveCoins } from '../src/core/coins.js';
import * as duelLadder from '../src/core/duel-ladder.js';
import { checkBoard as checkDuel, gameOf, movesOf, smallBoards, solve as solveDuel, startState } from '../src/core/duel.js';
import * as coinLadder from '../src/core/ladder.js';
import * as logicLadder from '../src/core/logic-ladder.js';
import { boxBoards } from '../src/core/logic-ladder.js';
import { checkBoard as checkLogic, isLean as isLeanLogic, solve as solveLogic } from '../src/core/logic.js';
import { bruteDays, bruteUsefulAt, bruteWorlds } from './helpers/brute-logic.js';
import * as blockLadder from '../src/core/block-ladder.js';
import { allPlacements as blockSpots, checkBoard as checkBlock, solve as solveBlock } from '../src/core/block.js';
import { BLOCK_SHRINK, BRIDGE_COUNTS, COIN_FLOOR, LOGIC_SMALL, SMALLER, SMALL_CARDS, SMALL_CODE, SMALL_LIE_ROWS, TAX_SIZES, TILE_DOWN, TRACE_COUNTS, TWIN_COUNTS, pickByTurn, RIVER_FLOOR, smallBlockBoards, smallRiverBoards, smallerBlock, smallerRiver, smallerCode, smallerCoins, smallerDuel, smallerLogic, smallerSwap, smallerTax, smallerTile, smallerTrace } from '../src/core/smaller.js';
import * as riverLadder from '../src/core/river-ladder.js';
import { castOf as riverCast, checkBoard as checkRiver } from '../src/core/river.js';
import * as swapLadder from '../src/core/swap-ladder.js';
import { checkBoard as checkSwap, solve as solveSwap } from '../src/core/swap.js';
import * as taxLadder from '../src/core/tax-ladder.js';
import { cardsUpTo, checkBoard as checkTax, plainN, solve as solveTax } from '../src/core/tax.js';
import * as tileLadder from '../src/core/tile-ladder.js';
import { checkBoard as checkTile, deadCells, solve as solveTile, solveWall as solveTileWall } from '../src/core/tile.js';
import * as traceLadder from '../src/core/trace-ladder.js';
import { checkFigure, fixesOf, isTidy, sideOf, solve as solveTrace } from '../src/core/trace.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SEEDS = Array.from({ length: 100 }, (_, index) => index + 1);
const TURNS = [0, 1, 2, 3];
const FORMATS = ['coins', 'trace', 'code', 'swap', 'tile', 'duel', 'tax', 'logic', 'block', 'river', 'cups', 'dandelion', 'maze', 'rulehunt', 'untangle', 'lamps', 'rooms', 'machine', 'split', 'eyeball', 'cutpaste', 'fold', 'domino', 'pieces', 'magic', 'apart', 'keymaze', 'cipher', 'seqpath', 'pancake', 'product', 'sim', 'matches', 'fair', 'rowflip', 'foxrabbit', 'pins', 'net', 'regionmap', 'blackhole'];

/** 사다리의 판마다(단계마다 판 번호 1~100) 일을 시킨다. */
function eachBoard(ladder, visit) {
  for (let level = 1; level <= ladder.TOP_LEVEL; level++) {
    for (const seed of SEEDS) visit(ladder.generateBoard(level, seed).board, ladder.rungOf(level), `${level}단계 ${seed}번`);
  }
}

test('형식마다 "더 작은 판"을 내주는 함수가 하나씩 있다. 형식 모듈은 그것을 틀에 내놓는다', () => {
  assert.deepEqual(Object.keys(SMALLER), FORMATS);
  for (const format of FORMATS) {
    const code = readFileSync(resolve(ROOT, `src/formats/${format}.js`), 'utf8');
    assert.match(code, /\n {4}smaller: \(round, turn\) => smaller[A-Z][a-z]+\(\{/, `${format}: smaller`);
    assert.match(code, /\n {4}view[:(]/, `${format}: view`);
  }
});

test('차례 고르기: 되는 판에서는 되는 판만, 안 되는 판에서는 되는 판부터 안 되는 판과 번갈아 낸다', () => {
  const lists = { yes: ['가', '나'], no: ['다', '라', '마'] };
  assert.deepEqual(TURNS.map((turn) => pickByTurn(lists, true, turn)), ['가', '나', '가', '나']);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((turn) => pickByTurn(lists, false, turn)), ['가', '다', '나', '라', '가', '마']);
  // 한쪽이 없으면 다른 쪽만 차례로 낸다. 되는 판에서 왔는데 되는 판이 없으면 내지 않는다.
  assert.deepEqual(TURNS.map((turn) => pickByTurn({ yes: ['가', '나'], no: [] }, false, turn)), ['가', '나', '가', '나']);
  assert.deepEqual(TURNS.map((turn) => pickByTurn({ yes: [], no: ['다'] }, false, turn)), ['다', '다', '다', '다']);
  assert.equal(pickByTurn({ yes: [], no: ['다'] }, true, 0), null);
  assert.equal(pickByTurn({ yes: [], no: [] }, false, 0), null);
});

test('동전 뒤집기: 같은 규칙과 모양, 동전을 둘 줄인 판. 풀이 프로그램으로 되는지 안 되는지를 맞춘다', () => {
  let none = 0;
  eachBoard(coinLadder, (board, rung, where) => {
    const origin = { board };
    const from = solveCoins(board);
    for (const turn of TURNS) {
      const small = smallerCoins(origin, turn);
      if (board.n <= COIN_FLOOR[board.rule]) {
        assert.equal(small, null, `${where}: 가장 작은 판`);
        none += turn === 0 ? 1 : 0;
        continue;
      }
      assert.ok(small, where);
      assert.equal(checkCoins(small.board), null, where);
      assert.deepEqual([small.board.rule, small.board.shape], [board.rule, board.shape], where);
      assert.ok(small.board.n < board.n && small.board.n >= board.n - 3, `${where}: 동전 ${board.n}개 → ${small.board.n}개`);
      assert.ok(headCount(small.board.coins) > 0, `${where}: 이미 다 뒷면인 판`);
      const solved = solveCoins(small.board);
      // 되는 판에서는 되는 판만. 안 되는 판에서는 되는 판부터, 안 되는 판과 번갈아(첫 판으로 답을 알 수 없게)
      assert.equal(solved.possible, from.possible || turn % 2 === 0, `${where} ${turn}번째`);
      // 한 번에 끝나는 판은 피한다(더 줄일 수 없는 크기에서만 낸다).
      if (solved.possible && turn === 0 && small.board.n > COIN_FLOOR[board.rule]) assert.ok(solved.min >= 2, `${where}: 한 번에 끝나는 판`);
      assert.deepEqual(smallerCoins(origin, turn), small, `${where}: 같은 판에서는 같은 작은 판`);
    }
  });
  // 작은 판이 없는 판은 3단계의 동전 네 개짜리(아무 세 개씩)뿐이다.
  assert.ok(none > 0 && none < 60, `없는 판 ${none}개`);
  // 모두 앞면인 판에서 왔으면 모두 앞면인 판부터 낸다.
  assert.deepEqual(smallerCoins({ board: { n: 6, shape: 'line', rule: 'any2', coins: [1, 1, 1, 1, 1, 1] } }, 0).board.coins, [1, 1, 1, 1]);
  // 안 되는 판(모두 앞면 다섯 개)에서는 첫 작은 판이 되는 판이고, 모두 앞면인 안 되는 판은 그다음에 나온다.
  assert.equal(solveCoins(smallerCoins({ board: { n: 5, shape: 'line', rule: 'any2', coins: [1, 1, 1, 1, 1] } }, 0).board).possible, true);
  assert.deepEqual(smallerCoins({ board: { n: 5, shape: 'line', rule: 'any2', coins: [1, 1, 1, 1, 1] } }, 1).board.coins, [1, 1, 1]);
  // 이어서 여는 두 판은 다르다.
  const mixed = { board: { n: 8, shape: 'line', rule: 'any2', coins: [1, 1, 0, 1, 0, 0, 1, 0] } };
  assert.notDeepEqual(smallerCoins(mixed, 0), smallerCoins(mixed, 1));
  // 규격에 맞지 않는 판과 가장 작은 판에는 없다.
  assert.equal(smallerCoins({ board: { n: 3, shape: 'line', rule: 'any2', coins: [1, 1, 0] } }), null);
  assert.equal(smallerCoins({ board: { n: 4, shape: 'ring', rule: 'adj3', coins: [1, 1, 0, 1] } }), null);
  assert.equal(smallerCoins({ board: null }), null);
});

test('한붓그리기: 점이 넷이나 다섯인 그림. 시작점 고르기와 고치기는 같은 물음의 작은 그림이다', () => {
  let none = 0;
  let twinNone = 0;
  eachBoard(traceLadder, (board, rung, where) => {
    const origin = { mode: rung.mode, board };
    const from = solveTrace(board);
    for (const turn of TURNS) {
      const small = smallerTrace(origin, turn);
      if (rung.mode === 'bridge') {
        // 다리 건너기: 섬이 더 적은 다리 판. 되는 판에서는 되는 판만, 안 되는 판에서는 되는 판부터 번갈아(섬이 셋이면 늘 되는 판)
        assert.ok(small, where);
        const figure = small.board;
        assert.equal(figure.multi, true, where);
        assert.equal(checkFigure(figure), null, where);
        assert.ok(BRIDGE_COUNTS.includes(figure.points.length) && figure.points.length < board.points.length, where);
        assert.equal(traceLadder.plainBridges(figure), false, where);
        assert.equal(traceLadder.famousShape(figure), false, where);
        const possible = solveTrace(figure).possible;
        if (from.possible || turn % 2 === 0) assert.equal(possible, true, `${where} ${turn}번째`);
        else if (board.points.length >= 5) assert.equal(possible, false, `${where} ${turn}번째`);
        assert.deepEqual(smallerTrace(origin, turn), small, where);
        continue;
      }
      if (rung.mode === 'twin') {
        // 닮은 두 그림: 한쪽 그림의 점이 다섯인 닮은 두 그림. 원래 그림의 점이 다섯이면 더 작은 판이 없다.
        if (board.split <= TWIN_COUNTS[0]) {
          assert.equal(small, null, where);
          twinNone += turn === 0 ? 1 : 0;
          continue;
        }
        assert.ok(small, where);
        assert.equal(checkFigure(small.board), null, where);
        assert.ok(TWIN_COUNTS.includes(small.board.split), where);
        assert.ok(traceLadder.twinAnswer(small.board) !== null, where);
        for (const side of ['left', 'right']) assert.ok(isTidy(sideOf(small.board, side)), where);
        assert.deepEqual(smallerTrace(origin, turn), small, where);
        continue;
      }
      if (!small) {
        // 점이 넷인 그림이 가장 작다. 고치기는 점이 다섯인 그림이 가장 작다(점이 넷인 안 되는 그림은 만들 수 없다).
        assert.ok(board.points.length <= (rung.mode === 'fix' ? 5 : 4), `${where}: 점 ${board.points.length}개인데 작은 판이 없어요`);
        none += turn === 0 ? 1 : 0;
        continue;
      }
      const figure = small.board;
      assert.equal(checkFigure(figure), null, where);
      assert.ok(TRACE_COUNTS.includes(figure.points.length) && figure.points.length < board.points.length, `${where}: 점 ${board.points.length}개 → ${figure.points.length}개`);
      assert.equal(isTidy(figure), true, `${where}: 선이 점 위를 지나거나 엇갈려요`);
      assert.equal(traceLadder.tooPlain(figure), false, `${where}: 너무 뻔한 그림`);
      const solved = solveTrace(figure);
      if (rung.mode === 'start') assert.ok(solved.possible && solved.starts.length === 2, `${where}: 시작할 수 있는 점이 둘이 아니에요`);
      else if (rung.mode === 'pen') assert.ok(!solved.possible && solved.pieces === 1, `${where}: 한 번에 그을 수 있는 그림이에요`);
      else if (rung.mode === 'fix') assert.ok(!solved.possible && fixesOf(figure).length > 0, `${where}: 한 군데 고쳐서 되는 그림이 아니에요`);
      else if (from.possible || turn % 2 === 1) assert.equal(solved.possible, true, `${where} ${turn}번째`);
      // 안 되는 그림에서는 안 되는 그림부터 낸다. 점이 넷인 그림밖에 낼 수 없을 때만 되는 그림이 나온다.
      else if (board.points.length >= 6) assert.equal(solved.possible, false, `${where} ${turn}번째`);
      assert.deepEqual(smallerTrace(origin, turn), small, `${where}: 같은 판에서는 같은 작은 판`);
    }
  });
  assert.ok(none > 0 && none < 80, `없는 판 ${none}개`);
  // 닮은 두 그림은 한쪽 그림의 점이 다섯인 판(절반쯤)에 더 작은 판이 없다.
  assert.ok(twinNone > SEEDS.length / 4 && twinNone < (SEEDS.length * 3) / 4, `닮은 두 그림에서 없는 판 ${twinNone}개`);
  assert.equal(smallerTrace({ mode: 'draw', board: { points: [[0, 0], [1, 0], [0, 1]], edges: [[0, 1], [1, 2], [0, 2]] } }), null);
  assert.equal(smallerTrace({ mode: 'draw', board: { points: [], edges: [] } }), null);
});

test('숫자 추리: 숫자 1~4로 만든 두 자리 암호. 표는 답이 꼭 하나이고 군더더기 줄이 없다. 카드 맞히기는 카드 1~5 가운데 두 장', () => {
  const { length, digits, rows } = SMALL_CODE;
  assert.deepEqual([length, digits], [2, '1234']);
  assert.deepEqual([SMALL_CARDS, SMALL_LIE_ROWS], ['12345', [3, 4]]);
  const seen = new Set();
  eachBoard(codeLadder, (board, rung, where) => {
    const origin = { mode: rung.mode, board };
    seen.add(board.mode);
    const found = TURNS.map((turn) => {
      const small = smallerCode(origin, turn);
      assert.ok(small, where);
      assert.equal(checkCode(small.board), null, where);
      const smallDigits = board.mode === 'cards' ? SMALL_CARDS : digits;
      assert.deepEqual([small.board.mode, small.board.length, small.board.digits], [board.mode, length, smallDigits], where);
      assert.ok(small.board.length < board.length && small.board.digits.length <= board.digits.length, where);
      if (board.mode === 'guess') assert.ok(allCodes(length, digits).includes(small.board.secret), where);
      // 카드 맞히기: 카드 1~5 가운데 두 장(작은 것부터 이은 묶음)
      if (board.mode === 'cards') assert.ok(bruteSets(2, SMALL_CARDS).includes(small.board.secret), where);
      if (board.mode === 'table' || board.mode === 'place') {
        // 자리만 알려 주는 표의 작은 판도 줄마다 자리가 맞는 것의 수만 적는다.
        for (const row of small.board.rows) assert.deepEqual(Object.keys(row).sort(), board.mode === 'place' ? ['guess', 'place'] : ['guess', 'hit', 'place'], where);
        assert.ok(small.board.rows.length >= rows[0] && small.board.rows.length <= rows[1], `${where}: ${small.board.rows.length}줄`);
        assert.equal(solveTable(length, digits, small.board.rows).count, 1, `${where}: 답이 하나가 아니에요`);
        assert.equal(bruteMatches(length, digits, small.board.rows).length, 1, `${where}: 다른 방법으로 세어도 답이 하나`);
        assert.equal(isLean(length, digits, small.board.rows), true, `${where}: 군더더기 줄`);
      }
      if (board.mode === 'lie') {
        // 한 번 거짓말하는 표의 작은 판: 딱 한 줄만 어긋나는 암호가 꼭 하나이고, 모든 줄과 맞는 암호는 없다(다른 방법으로 센다).
        const one = bruteOneLie(length, digits, small.board.rows);
        assert.equal(one.answers.length, 1, where);
        assert.equal(one.honest, 0, where);
        assert.ok(small.board.rows.length >= SMALL_LIE_ROWS[0] && small.board.rows.length <= SMALL_LIE_ROWS[1], where);
      }
      assert.deepEqual(smallerCode(origin, turn), small, `${where}: 같은 판에서는 같은 작은 판`);
      return small.board;
    });
    // 물어서 알아내는 판: 이어서 여는 작은 판의 암호는 서로 다르다.
    if (board.mode === 'guess' || board.mode === 'cards') assert.equal(new Set(found.map((item) => item.secret)).size, TURNS.length, where);
  });
  assert.deepEqual([...seen].sort(), ['cards', 'guess', 'lie', 'place', 'referee', 'table']);
  // 이미 두 자리인 판(작은 판)에는 더 작은 판이 없다.
  assert.equal(smallerCode({ mode: 'guess', board: { mode: 'guess', length: 2, digits: '1234', secret: '31' } }), null);
  assert.equal(smallerCode({ mode: 'guess', board: { mode: 'guess', length: 3, digits: '123456' } }), null);
});

test('자리 바꾸기: 개구리는 양쪽에서 한 마리씩 줄인 판, 짝 짓기와 묶어 옮기기는 돌을 둘(셋씩 쌓기는 셋) 줄인 판', () => {
  eachBoard(swapLadder, (board, rung, where) => {
    const origin = { mode: rung.mode, board };
    for (const turn of TURNS) {
      const small = smallerSwap(origin, turn);
      if (board.kind === 'frogs') {
        if (board.left === 1 && board.right === 1) {
          assert.equal(small, null, `${where}: 가장 작은 판`);
          continue;
        }
        assert.equal(checkSwap(small.board), null, where);
        const want = [Math.max(1, board.left - 1), Math.max(1, board.right - 1)];
        // 좌우를 뒤집은 판을 번갈아 낸다.
        assert.deepEqual([small.board.left, small.board.right], turn % 2 === 1 ? want.slice().reverse() : want, `${where} ${turn}번째`);
        assert.equal(solveSwap(small.board).possible, true, where);
      } else if (board.kind === 'carry') {
        // 묶어 옮기기: 돌을 둘씩 줄인 판(모두 되는 판). 되는 가장 작은 판(6개)에는 없다.
        if (board.n === 6) {
          assert.equal(small, null, `${where}: 돌 6개`);
          continue;
        }
        const sizes = [];
        for (let n = board.n - 2; n >= 6; n -= 2) sizes.push(n);
        assert.deepEqual(small.board, { kind: 'carry', n: sizes[turn % sizes.length] }, `${where} ${turn}번째`);
        assert.equal(solveSwap(small.board).possible, true, where);
      } else if (board.group === 3) {
        // 셋씩 쌓기: 돌을 셋씩 줄인 판. 12개(되는 가장 작은 판)와 6개에는 없고, 15개는 12개, 안 되는 9개는 안 되는 6개다.
        const want = { 15: 12, 9: 6 }[board.n];
        if (!want) {
          assert.equal(small, null, `${where}: 돌 ${board.n}개`);
          continue;
        }
        assert.deepEqual(small.board, { kind: 'pairs', n: want, skip: board.skip, group: 3 }, where);
        assert.equal(swapLadder.solveOnce(small.board).possible, swapLadder.solveOnce(board).possible, where);
      } else {
        const from = solveSwap(board).possible;
        // 되는 가장 작은 판(8개)과 건너뛸 수 있는 가장 작은 판(4개)에는 없다.
        if (board.n === 8 || board.n === 4) {
          assert.equal(small, null, `${where}: 돌 ${board.n}개`);
          continue;
        }
        assert.equal(checkSwap(small.board), null, where);
        assert.equal(small.board.skip, board.skip, where);
        assert.ok(small.board.n < board.n && small.board.n >= board.skip + 2 && (board.n - small.board.n) % 2 === 0, `${where}: 돌 ${board.n}개 → ${small.board.n}개`);
        assert.equal(solveSwap(small.board).possible, from, `${where}: 되는 판에서는 되는 판, 안 되는 판에서는 안 되는 판`);
      }
      assert.deepEqual(smallerSwap(origin, turn), small, `${where}: 같은 판에서는 같은 작은 판`);
    }
  });
  assert.deepEqual(smallerSwap({ board: { kind: 'frogs', left: 4, right: 4 } }, 0).board, { kind: 'frogs', left: 3, right: 3 });
  assert.deepEqual(smallerSwap({ board: { kind: 'pairs', n: 12, skip: 2 } }, 0).board, { kind: 'pairs', n: 10, skip: 2 });
  assert.deepEqual(smallerSwap({ board: { kind: 'pairs', n: 12, skip: 2 } }, 1).board, { kind: 'pairs', n: 8, skip: 2 });
  // 직접 만든 안 되는 판(돌 11개)에서는 되는 더 작은 판(10개)부터, 안 되는 판(9개)과 번갈아 낸다.
  assert.deepEqual([0, 1].map((turn) => smallerSwap({ board: { kind: 'pairs', n: 11, skip: 2 } }, turn).board.n), [10, 9]);
});

test('조각 덮기: 같은 조각, 한 단 작은 판. 뺀 칸의 수가 같고, 구석을 뺀 판은 구석을 뺀 판이 된다', () => {
  assert.deepEqual(TILE_DOWN, { 8: 5, 7: 4, 6: 4, 5: 4 });
  let none = 0;
  const newer = { pick: 0, four: 0, wall: 0 };
  eachBoard(tileLadder, (board, rung, where) => {
    const origin = { mode: rung.mode, board };
    // 5~7단계(되는 자리 고르기, 네 칸 조각, 금 없는 벽): 빠진 칸이 없는 판의 작은 판
    if (rung.level >= 5) {
      checkNewerTile(origin, rung, where, newer);
      return;
    }
    const from = solveTile(board).possible;
    const smallest = board.w === 4 && board.h === 4 && board.piece !== 'domino';
    for (const turn of TURNS) {
      const small = smallerTile(origin, turn);
      if (smallest) {
        assert.equal(small, null, `${where}: 세 칸 조각은 4×4가 가장 작다`);
        none += turn === 0 ? 1 : 0;
        continue;
      }
      assert.ok(small, where);
      assert.equal(checkTile(small.board), null, where);
      assert.equal(small.board.piece, board.piece, where);
      assert.equal(small.board.holes.length, board.holes.length, where);
      assert.ok(small.board.w <= board.w && small.board.h <= board.h && small.board.w * small.board.h < board.w * board.h, `${where}: ${board.w}×${board.h} → ${small.board.w}×${small.board.h}`);
      const solved = solveTile(small.board).possible;
      // 1단계는 늘 되는 판이다("불가능해요" 단추가 없다). 되는 판에서는 되는 판만 낸다.
      if (from) assert.equal(solved, true, `${where} ${turn}번째`);
      // 안 되는 판에서는 되는 판부터 번갈아. ㄱ자 세 칸은 4×4에 안 되는 판이 없어서 되는 판만 나온다.
      else if (board.piece === 'ell') assert.equal(solved, true, `${where} ${turn}번째`);
      else assert.equal(solved, turn % 2 === 0, `${where} ${turn}번째`);
      // 안 되는 판이라도 처음부터 조각이 들어갈 수 없는 빈칸이 보이는 판은 내지 않는다.
      if (solved === false) assert.deepEqual(deadCells(small.board), [], where);
      assert.deepEqual(smallerTile(origin, turn), small, `${where}: 같은 판에서는 같은 작은 판`);
    }
  });
  assert.ok(none > 0 && none < 80, `없는 판 ${none}개`);
  // 구석을 뺀 판은 구석을 뺀 판으로.
  assert.deepEqual(smallerTile({ board: { w: 8, h: 8, piece: 'ell', holes: [0] } }).board, { w: 5, h: 5, piece: 'ell', holes: [0] });
  assert.deepEqual(smallerTile({ board: { w: 7, h: 7, piece: 'bar', holes: [48] } }).board, { w: 4, h: 4, piece: 'bar', holes: [15] });
  assert.deepEqual(smallerTile({ board: { w: 8, h: 8, piece: 'bar', holes: [18] } }).board, { w: 5, h: 5, piece: 'bar', holes: [12] });
  // 마주 보는 두 구석을 뺀 4×4(안 되는 판) → 첫 작은 판은 되는 판, 그다음은 구석 하나가 빠진 4×3의 안 되는 판
  const corners = { board: { w: 4, h: 4, piece: 'domino', holes: [0, 15] } };
  assert.equal(solveTile(smallerTile(corners, 0).board).possible, true);
  assert.ok(smallerTile(corners, 1).board.holes.some((hole) => [0, 3, 8, 11].includes(hole)));
  assert.deepEqual([smallerTile(corners, 1).board.w, smallerTile(corners, 1).board.h], [4, 3]);
  assert.equal(solveTile(smallerTile(corners, 1).board).possible, false);
  // 가장 작은 판과 뺀 칸이 많은 판(직접 만든 판)에는 없다.
  assert.equal(smallerTile({ board: { w: 4, h: 3, piece: 'domino', holes: [0, 1] } }), null);
  assert.equal(smallerTile({ board: { w: 6, h: 6, piece: 'domino', holes: [0, 1, 2, 3] } }), null);
  // 되는 판에서 왔는데 한 단 작은 크기에 되는 판이 없으면(5×5에서 두 칸을 뺀 도미노 판) 한 단 더 내려간다.
  const big = smallerTile({ board: { w: 8, h: 8, piece: 'domino', holes: [0, 1] } });
  assert.deepEqual([big.board.w, big.board.h, solveTile(big.board).possible], [4, 4, true]);
  // 5~7단계에서도 작은 판을 낸 판이 있다.
  for (const [kind, count] of Object.entries(newer)) assert.ok(count > 0, kind);
  // 되는 자리 고르기: 8×8 → 5×5 → 4×4, 7×7 → 4×4. 4×4에는 없다.
  assert.deepEqual(smallerTile({ mode: 'pick', board: { w: 8, h: 8, piece: 'bar', holes: [] } }).board, { w: 5, h: 5, piece: 'bar', holes: [] });
  assert.deepEqual(smallerTile({ mode: 'pick', board: { w: 7, h: 7, piece: 'bar', holes: [] } }).board, { w: 4, h: 4, piece: 'bar', holes: [] });
  assert.equal(smallerTile({ mode: 'pick', board: { w: 4, h: 4, piece: 'bar', holes: [] } }), null);
  // 금 없는 벽: 6×6(안 되는 판)에서는 되는 판 5×6부터, 그다음은 안 되는 판. 가장 작은 되는 판(5×6, 6×5)에는 없다.
  const six = { mode: 'wall', board: { w: 6, h: 6, piece: 'domino', holes: [] } };
  assert.deepEqual(smallerTile(six, 0).board, { w: 5, h: 6, piece: 'domino', holes: [] });
  assert.equal(solveTileWall(smallerTile(six, 1).board).possible, false);
  assert.equal(smallerTile({ mode: 'wall', board: { w: 5, h: 6, piece: 'domino', holes: [] } }), null);
  // 네 칸 조각: ㅗ자 6×8(안 되는 판)에서는 되는 판 4×4부터
  assert.deepEqual(smallerTile({ mode: 'either', board: { w: 6, h: 8, piece: 'tee', holes: [] } }, 0).board, { w: 4, h: 4, piece: 'tee', holes: [] });
});

/** 5~7단계의 작은 판을 점검한다: 같은 조각, 빠진 칸이 없고, 가로·세로가 크지 않고 칸이 더 적은 판 */
function checkNewerTile(origin, rung, where, newer) {
  const { board } = origin;
  const kind = rung.mode === 'pick' ? 'pick' : rung.mode === 'wall' ? 'wall' : 'four';
  const works = (item) => (kind === 'wall' ? solveTileWall(item).possible : solveTile(item).possible);
  const from = kind === 'pick' ? true : works(board);
  for (const turn of TURNS) {
    const small = smallerTile(origin, turn);
    assert.deepEqual(smallerTile(origin, turn), small, `${where}: 같은 판에서는 같은 작은 판`);
    if (!small) {
      // 없는 것은 가장 작은 판일 때뿐이다: 되는 자리 고르기의 4×4, 금 없는 벽의 가장 작은 되는 판, 네 칸 조각에서 더 작은 되는 판이 없는 판
      if (kind === 'pick') assert.deepEqual([board.w, board.h], [4, 4], where);
      else assert.equal(from, true, `${where}: 안 되는 판에서는 늘 작은 판이 있다`);
      continue;
    }
    if (turn === 0) newer[kind] += 1;
    assert.equal(checkTile(small.board), null, where);
    assert.equal(small.board.piece, board.piece, where);
    assert.deepEqual(small.board.holes, [], where);
    assert.ok(small.board.w <= board.w && small.board.h <= board.h && small.board.w * small.board.h < board.w * board.h, `${where}: ${board.w}×${board.h} → ${small.board.w}×${small.board.h}`);
    if (kind === 'pick') {
      assert.equal(small.board.w, small.board.h, where);
      assert.ok(tileLadder.possibleHoles('bar', small.board.w, small.board.h).length > 0, where);
      continue;
    }
    // 칸 수만으로 갈리는 판은 내지 않는다.
    assert.equal((small.board.w * small.board.h) % (kind === 'wall' ? 2 : 4), 0, where);
    const solved = works(small.board);
    // 되는 판에서는 되는 판만, 안 되는 판에서는 되는 판이 있으면 그것부터 낸다(번개는 되는 판이 없다).
    if (from) assert.equal(solved, true, `${where} ${turn}번째`);
    else if (turn === 0 && board.piece !== 'zig' && !(kind === 'wall' && Math.min(board.w, board.h) <= 4)) assert.equal(solved, true, `${where} 0번째`);
  }
}

test('누가 이길까: 같은 게임의 가장 작은 판들을 작은 것부터 차례로 낸다', () => {
  const total = (board) => (board.kind === 'choco' ? board.w * board.h : 'n' in board ? board.n : board.piles.reduce((sum, count) => sum + count, 0));
  eachBoard(duelLadder, (board, rung, where) => {
    const origin = { board };
    const list = smallBoards(board);
    assert.ok(list.length > 0, where);
    for (const turn of [0, 1, 2, 3, 6, 7]) {
      const small = smallerDuel(origin, turn);
      assert.deepEqual(small.board, list[turn % list.length], where);
      assert.equal(checkDuel(small.board), null, where);
      assert.equal(gameOf(small.board), gameOf(board), where);
      assert.ok(total(small.board) < total(board), where);
      if (board.kind === 'one') assert.equal(small.board.max, board.max, where);
      assert.ok(movesOf(small.board, startState(small.board)).length > 0, `${where}: 둘 수가 없는 판`);
      assert.ok(['first', 'second'].includes(solveDuel(small.board).winner), where);
      assert.deepEqual(smallerDuel(origin, turn), small, where);
    }
  });
  assert.equal(smallerDuel({ board: { kind: 'choco', w: 2, h: 1 } }), null);
  assert.equal(smallerDuel({ board: { kind: 'one', n: 1, max: 2 } }), null);
  assert.equal(smallerDuel({ board: { kind: 'piles', piles: [1, 1] } }), null);
});

test('약수 세금: 카드가 넷에서 여섯 장인 판. 원래 판보다 작을 때만 낸다', () => {
  assert.deepEqual(TAX_SIZES, [6, 4, 5]);
  eachBoard(taxLadder, (board, rung, where) => {
    const origin = { board };
    for (const turn of TURNS) {
      const small = smallerTax(origin, turn);
      assert.ok(small, where);
      assert.equal(checkTax(small.board), null, where);
      const n = plainN(small.board);
      assert.ok(n >= 4 && n <= 6 && n < board.cards.length, `${where}: ${board.cards.length}장 → ${n}장`);
      const solved = solveTax(small.board);
      assert.ok(solved.exact && solved.best > 0, where);
      assert.deepEqual(smallerTax(origin, turn), small, where);
    }
  });
  assert.deepEqual([0, 1, 2, 3].map((turn) => smallerTax({ board: { cards: cardsUpTo(12) } }, turn).board.cards.length), [6, 4, 5, 6]);
  assert.deepEqual([0, 1, 2].map((turn) => smallerTax({ board: { cards: cardsUpTo(6) } }, turn).board.cards.length), [4, 5, 4]);
  assert.equal(smallerTax({ board: { cards: cardsUpTo(4) } }), null);
  // 카드를 골라 놓은 판(직접 만든 판)에는 없다.
  assert.equal(smallerTax({ board: { cards: [2, 3, 4, 6, 8, 9, 12] } }), null);
});

test('참말 섬: 주민 셋은 주민 둘로, 상자 셋은 같은 꼴의 글이 붙은 상자 둘로, 5단계의 말 둘은 말 하나로, 요일 섬은 주민 하나로, 질문 넷은 둘로. 1단계(주민 둘)와 말 하나뿐인 판에는 없다', () => {
  assert.deepEqual(LOGIC_SMALL, { people: 2, boxes: 2, dayPeople: 1, questions: 2 });
  let none = 0;
  const kinds = new Set();
  eachBoard(logicLadder, (board, rung, where) => {
    const origin = { mode: rung.mode, board };
    const from = solveLogic(board);
    for (const turn of TURNS) {
      const small = smallerLogic(origin, turn);
      const smallest = rung.mode === 'pair' || (rung.mode === 'some' && board.says.length === 1);
      if (smallest) {
        assert.equal(small, null, `${where}: 작은 판이 없어야 해요`);
        none += turn === 0 ? 1 : 0;
        continue;
      }
      assert.ok(small, where);
      assert.equal(checkLogic(small.board), null, where);
      assert.equal(small.board.kind, board.kind, where);
      kinds.add(rung.mode);
      const solved = solveLogic(small.board);
      if (board.kind === 'question') {
        // 같은 주민, 원래 판의 질문 둘(쓸모 있는 질문 하나와 쓸모없는 질문 하나). 따로 적은 식으로도 쓸모 있는 질문은 하나다.
        assert.deepEqual(small.board.people, board.people, where);
        assert.equal(small.board.questions.length, 2, where);
        for (const question of small.board.questions) assert.ok(board.questions.some((item) => JSON.stringify(item) === JSON.stringify(question)), where);
        assert.equal(bruteUsefulAt(small.board).length, 1, where);
        assert.deepEqual(solved.answer, bruteUsefulAt(small.board), where);
        assert.deepEqual(smallerLogic({ mode: 'ask', board: small.board }, 0), null, `${where}: 질문 둘보다 작은 판은 없다`);
      } else if (board.kind === 'day') {
        // 같은 동물, 같은 거짓말 요일의 주민 하나. 이레를 따로 따져도 오늘은 하나로 정해진다.
        assert.deepEqual(small.board.people, board.people.slice(0, 1), where);
        assert.deepEqual(small.board.lies, board.lies.slice(0, 1), where);
        assert.deepEqual(bruteDays(small.board), [solved.answer], where);
        assert.equal(isLeanLogic(small.board), true, where);
        assert.equal(smallerLogic({ mode: 'day', board: small.board }, 0), null);
      } else if (rung.mode === 'some') {
        // 같은 주민들의 말 하나뿐인 판
        assert.deepEqual(small.board.people, board.people, where);
        assert.equal(small.board.says.length, 1, where);
        assert.ok(['some', 'or'].includes(small.board.says[0].s.t), where);
        assert.equal(bruteWorlds(small.board).length, 1, where);
        assert.equal(solved.possible, true, where);
      } else if (board.kind === 'box') {
        assert.equal(small.board.labels.length, 2, where);
        assert.equal(solved.possible, true, where);
        // 원래 판의 글과 같은 꼴의 글로 된 판이 있으면 그것부터 낸다.
        const types = new Set(board.labels.map((label) => label.t));
        if (turn === 0 && boxBoards(2).some((item) => item.labels.every((label) => types.has(label.t)))) assert.ok(small.board.labels.every((label) => types.has(label.t)), where);
      } else {
        assert.equal(small.board.people.length, 2, where);
        assert.deepEqual(small.board.people, board.people.slice(0, 2), `${where}: 같은 동물`);
        assert.equal(isLeanLogic(small.board), true, where);
        // 되는 판에서는 되는 판만, 남는 배정이 없는 판에서는 되는 판부터 번갈아. 첫 작은 판은 늘 되는 판이다.
        if (from.possible !== false || turn % 2 === 0) assert.equal(solved.possible, true, `${where} ${turn}번째`);
        else assert.equal(solved.possible, false, `${where} ${turn}번째`);
        if (board.kind === 'road') assert.ok(['left', 'right'].includes(solved.answer), where);
      }
      assert.deepEqual(smallerLogic(origin, turn), small, `${where}: 같은 판에서는 같은 작은 판`);
    }
  });
  assert.ok(none > 0, `없는 판 ${none}개`);
  assert.deepEqual([...kinds].sort(), ['ask', 'box', 'day', 'folk', 'road', 'some']);
  // 이어서 여는 두 판은 다르다.
  const folk = logicLadder.generateBoard(3, 1).board;
  assert.notDeepEqual(smallerLogic({ board: folk }, 0), smallerLogic({ board: folk }, 1));
  const week = logicLadder.generateBoard(6, 1).board;
  assert.notDeepEqual(smallerLogic({ mode: 'day', board: week }, 0), smallerLogic({ mode: 'day', board: week }, 1));
  assert.equal(smallerLogic({ board: null }), null);
});

test('조각 못 들어가게 막기: 같은 조각, 칸 수가 절반 이하인 네모 판. 한 칸만 막으면 끝나는 판은 내지 않는다', () => {
  assert.equal(BLOCK_SHRINK, 1 / 2);
  let none = 0;
  eachBoard(blockLadder, (board, rung, where) => {
    for (const turn of TURNS) {
      const small = smallerBlock({ mode: rung.mode, board }, turn);
      if (!small) {
        none += 1;
        continue;
      }
      assert.equal(checkBlock(small.board), null, where);
      assert.equal(small.board.piece, board.piece, where);
      assert.deepEqual(small.board.holes, [], where);
      assert.ok(small.board.w <= board.w && small.board.h <= board.h, where);
      assert.ok(small.board.w * small.board.h <= (board.w * board.h) / 2, `${where}: ${small.board.w}×${small.board.h}`);
      assert.ok(small.board.w >= small.board.h, `${where}: 가로가 긴 판`);
      const solved = solveBlock(small.board);
      assert.equal(solved.exact, true, where);
      assert.ok(solved.best >= 2, `${where}: 한 칸이면 끝나는 판`);
      assert.deepEqual(smallerBlock({ mode: rung.mode, board }, turn), small, `${where}: 같은 판에서는 같은 작은 판`);
    }
  });
  assert.equal(none, 0, '사다리의 판에는 모두 작은 판이 있다');
  // 첫 작은 판은 그 가운데 가장 큰 판이다. 이어서 여는 두 판은 다르다.
  const tee = blockLadder.generateBoard(4, 6).board;
  assert.deepEqual(smallBlockBoards(tee)[0], { w: 6, h: 3, piece: 'tee', holes: [] });
  assert.notDeepEqual(smallerBlock({ board: tee }, 0), smallerBlock({ board: tee }, 1));
  // 가장 작은 판(3×2 도미노)에는 더 작은 판이 없다. 빠진 칸이 있는 직접 만든 판에서는 빠진 칸 없는 네모 판을 낸다.
  assert.equal(smallerBlock({ board: { w: 3, h: 2, piece: 'domino', holes: [] } }), null);
  const holed = smallerBlock({ board: { w: 6, h: 6, piece: 'bar', holes: [0, 7, 14] } });
  assert.ok(holed && holed.board.holes.length === 0 && blockSpots(holed.board).length > 0);
  // 세로가 긴 판에서는 세로가 긴 작은 판을 낸다.
  assert.ok(smallBlockBoards({ w: 3, h: 6, piece: 'bar', holes: [] }).every((item) => item.h >= item.w));
  assert.equal(smallerBlock({ board: null }), null);
});

test('강 건너기: 같은 종류에서 동물을 줄인 판. 배와 섬은 같고, 되는 판에서는 되는 판만 낸다', () => {
  // 같은 판을 여러 번 풀지 않게 사다리의 적어 두는 풀이를 쓴다(풀이 프로그램 자체는 tests/river.test.js가 다른 방법과 견준다).
  const solveRiver = riverLadder.solveOnce;
  assert.equal(RIVER_FLOOR, 2);
  let none = 0;
  eachBoard(riverLadder, (board, rung, where) => {
    const possible = solveRiver(board).possible;
    for (const turn of TURNS) {
      const small = smallerRiver({ mode: rung.mode, board }, turn);
      if (!small) {
        none += 1;
        continue;
      }
      assert.equal(checkRiver(small.board), null, where);
      assert.equal(small.board.kind, board.kind, where);
      assert.ok(riverCast(small.board).length < riverCast(board).length, `${where}: 동물이 적다`);
      if (board.kind !== 'weight') assert.equal(small.board.seats, board.seats, where);
      if (board.kind === 'pairs') assert.equal(small.board.island, board.island, where);
      if (board.kind === 'pets') assert.ok(small.board.pets.every((pet) => board.pets.includes(pet)), where);
      const solved = solveRiver(small.board);
      if (possible) assert.equal(solved.possible, true, `${where}: 되는 판에서는 되는 판만`);
      if (solved.possible) assert.ok(solved.min >= 2, `${where}: 한 번에 끝나는 판`);
      assert.deepEqual(smallerRiver({ mode: rung.mode, board }, turn), small, `${where}: 같은 판에서는 같은 작은 판`);
    }
  });
  // 가장 작은 판(코끼리 하나와 생쥐 하나, 생쥐 둘, 엄마와 아기 두 쌍)에는 더 작은 판이 없다.
  assert.ok(none > 0);
  assert.equal(smallerRiver({ board: { kind: 'weight', heavy: 1, light: 2 } }), null);
  assert.equal(smallerRiver({ board: { kind: 'pairs', pairs: 2, seats: 2, island: false } }), null);
  // 안 되는 판(둘이 타는 배의 다섯 쌍)에서는 되는 판부터, 안 되는 판과 번갈아 낸다.
  const five = { kind: 'pairs', pairs: 5, seats: 2, island: false };
  assert.deepEqual([0, 1, 2].map((turn) => smallerRiver({ board: five }, turn).board.pairs), [3, 4, 2]);
  assert.deepEqual(smallRiverBoards(five).map((board) => board.pairs), [4, 3, 2]);
  assert.equal(smallerRiver({ board: null }), null);
});

test('작은 판에서 다시 "더 작은 판"을 물으면 대개 없다(틀은 작은 판에서 이 단추를 내지 않는다)', () => {
  // 숫자 추리의 작은 판은 가장 작은 판이다. 다른 형식도 한두 단이면 바닥에 닿는다.
  const chain = (name, origin) => {
    let steps = 0;
    for (let now = origin; now && steps < 12; steps++) {
      const next = SMALLER[name](now, 0);
      now = next ? { ...origin, board: next.board } : null;
    }
    return steps;
  };
  assert.equal(chain('code', { mode: 'guess', board: codeLadder.generateBoard(3, 1).board }), 2);
  assert.ok(chain('coins', { board: coinLadder.generateBoard(5, 3).board }) <= 5);
  assert.ok(chain('swap', { mode: 'frogs', board: { kind: 'frogs', left: 5, right: 5 } }) === 5);
  assert.ok(chain('tile', { mode: 'either', board: { w: 8, h: 8, piece: 'ell', holes: [0] } }) === 3);
  assert.ok(chain('tax', { board: { cards: cardsUpTo(30) } }) <= 3);
  assert.ok(chain('trace', { mode: 'draw', board: traceLadder.generateBoard(2, 1).board }) <= 3);
  assert.ok(chain('duel', { board: { kind: 'piles', piles: [8, 8] } }) <= 3);
  assert.equal(chain('logic', { board: logicLadder.generateBoard(3, 1).board }), 2);
  assert.ok(chain('block', { board: blockLadder.generateBoard(4, 6).board }) <= 3);
  assert.equal(chain('river', { board: riverLadder.generateBoard(5, 3).board }), 4);
});
