// 접히는 모양 가리기의 풀이 점검: 정육면체를 굴려 접는 풀이 프로그램을 다른 방법(회전 행렬로 접기, 정육면체를 펼치기, 모눈에서 모두 만들기)과 견준다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DIE,
  KINDS,
  PICTURES,
  checkBoard,
  clashesOf,
  connected,
  cubeNets,
  dieTurns,
  fitsWith,
  foldNet,
  foldResult,
  freeKey,
  hasRowOfFour,
  hiddenFaces,
  isCubeNet,
  isDie,
  normalize,
  oppositeOf,
  polyominoes,
  readyToFold,
  rootOf,
  sameShape,
  solve,
  targetsOf,
  transform,
} from '../src/core/fold.js';
import { clashGroups3d, dieOk, freeName, freeShapes, gridShapes, hiddenSum3d, isBox3d, isNet3d, opposite3d, unfoldedNames } from './helpers/brute-fold.js';

const has2x2 = (cells) => {
  const keys = new Set(cells.map(([x, y]) => `${x},${y}`));
  return cells.some(([x, y]) => keys.has(`${x + 1},${y}`) && keys.has(`${x},${y + 1}`) && keys.has(`${x + 1},${y + 1}`));
};
const sortGroups = (groups) => groups.map((group) => group.slice().sort((a, b) => a - b)).sort((a, b) => a[0] - b[0]);

test('여섯 칸 모양은 35가지, 다섯 칸 모양은 12가지다(모눈에서 모두 만들어 센 것과 같다)', () => {
  const six = polyominoes(6);
  const five = polyominoes(5);
  assert.equal(six.length, 35);
  assert.equal(five.length, 12);
  assert.equal(new Set(six.map(freeKey)).size, 35);
  const bruteSix = freeShapes(6);
  const bruteFive = freeShapes(5);
  assert.equal(bruteSix.size, 35);
  assert.equal(bruteFive.size, 12);
  // 두 방법의 모양이 서로 같다(이름을 매기는 방법도 다르다)
  assert.deepEqual(new Set(six.map(freeName)), new Set(bruteSix.keys()));
  for (const cells of six) assert.ok(connected(cells));
});

test('정육면체가 되는 모양은 열한 가지다. 회전 행렬로 접어 본 것과 모양마다 같고, 정육면체를 펼친 모양들과 꼭 같다', () => {
  const nets = cubeNets();
  assert.equal(nets.length, 11);
  for (const cells of polyominoes(6)) assert.equal(isCubeNet(cells), isNet3d(cells), JSON.stringify(cells));
  // 정육면체의 펼침 나무는 384가지이고, 펼쳐서 겹치는 것은 없다. 펼친 모양은 돌리고 뒤집어 같은 것을 하나로 열한 가지
  const unfolded = unfoldedNames();
  assert.equal(unfolded.trees, 384);
  assert.equal(unfolded.overlaps, 0);
  assert.equal(unfolded.names.size, 11);
  assert.deepEqual(new Set(nets.map(freeName)), unfolded.names);
});

test('어느 칸을 뿌리로 접어도 되고 안 되는 것이 같다. 칸 넷이 네모로 모인 모양은 늘 안 된다', () => {
  for (const cells of [...polyominoes(6), ...polyominoes(5)]) {
    const results = new Set(cells.map((_, root) => foldResult(cells, root).ok));
    assert.equal(results.size, 1, JSON.stringify(cells));
    if (has2x2(cells)) assert.equal(foldResult(cells).ok, false);
    // 돌리거나 뒤집어도 같다
    for (let index = 0; index < 8; index++) assert.equal(foldResult(transform(cells, index)).ok, foldResult(cells).ok);
  }
});

test('겹치는 칸: 칸 넷이 네모로 모이지 않은 모양은 회전 행렬로 접은 것과 겹치는 묶음이 꼭 같다. 안 되는 모양 24가지 가운데 21가지는 한 쌍, 3가지는 두 쌍이 겹친다', () => {
  let one = 0;
  let two = 0;
  for (const cells of polyominoes(6)) {
    const result = foldResult(cells);
    if (!has2x2(cells)) assert.deepEqual(sortGroups(result.clashes), clashGroups3d(cells), JSON.stringify(cells));
    else assert.ok(clashGroups3d(cells).length > 0);
    if (result.ok) continue;
    // 겹치는 묶음은 늘 두 칸씩이다(셋이 겹치는 모양은 없다). 빈 면의 수는 겹치는 쌍의 수와 같다
    assert.ok(result.clashes.every((group) => group.length === 2));
    assert.equal(result.empty, result.clashes.length);
    if (result.clashes.length === 1) one += 1;
    else two += 1;
  }
  assert.deepEqual([one, two], [21, 3]);
  // 여섯 칸 한 줄: 다섯째 칸은 첫째 칸과, 여섯째 칸은 둘째 칸과 겹친다
  const line = [0, 1, 2, 3, 4, 5].map((x) => [x, 0]);
  assert.deepEqual(sortGroups(foldResult(line).clashes), [[0, 4], [1, 5]]);
  assert.deepEqual(clashGroups3d(line), [[0, 4], [1, 5]]);
});

test('다섯 칸 모양 12가지 가운데 8가지가 뚜껑 없는 상자가 된다(회전 행렬로 접은 것과 같다)', () => {
  const five = polyominoes(5);
  const boxes = five.filter((cells) => solve({ kind: 'fold', cells }).possible);
  assert.equal(boxes.length, 8);
  for (const cells of five) assert.equal(solve({ kind: 'fold', cells }).possible, isBox3d(cells));
});

test('네 칸이 한 줄인 모양은 남은 두 칸이 줄의 위와 아래로 갈라져 붙을 때만 정육면체가 된다. 그런 모양이 여섯 가지다', () => {
  const row = [0, 1, 2, 3].map((x) => [x, 1]);
  const seen = new Set();
  for (let a = 0; a < 4; a++) {
    for (let b = 0; b < 4; b++) {
      for (const [ya, yb] of [[0, 0], [0, 2], [2, 2]]) {
        const cells = [...row, [a, ya], [b, yb]];
        if (new Set(cells.map(String)).size !== 6) continue;
        assert.equal(isCubeNet(cells), ya !== yb, JSON.stringify(cells));
        if (ya !== yb) seen.add(freeKey(cells));
      }
    }
  }
  assert.equal(seen.size, 6);
  assert.equal(cubeNets().filter(hasRowOfFour).length, 6);
  // 가장 긴 줄이 세 칸인 것이 넷, 두 칸인 것이 하나
  const longest = (cells) => {
    let best = 1;
    const keys = new Set(cells.map(String));
    for (const [x, y] of cells) {
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        let run = 1;
        while (keys.has(String([x + dx * run, y + dy * run]))) run += 1;
        best = Math.max(best, run);
      }
    }
    return best;
  };
  assert.deepEqual(cubeNets().map(longest).sort(), [2, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4]);
});

test('맞은편 칸은 회전 행렬로 접어 법선이 거꾸로인 칸과 같다(열한 가지 모양, 돌리고 뒤집은 모습, 모든 칸)', () => {
  for (const net of cubeNets()) {
    for (let index = 0; index < 8; index++) {
      const cells = transform(net, index);
      for (let at = 0; at < 6; at++) {
        const answer = oppositeOf(cells, at);
        assert.equal(answer, opposite3d(cells, at));
        assert.equal(oppositeOf(cells, answer), at);
        const board = { kind: 'opposite', cells, pictures: PICTURES.slice(), mark: at };
        const result = solve(board);
        assert.equal(result.answer, answer);
        assert.equal(result.touching.length, 4);
      }
    }
  }
});

test('주사위: 굴려서 놓을 수 있는 모습은 스물넷이고, 모두 마주 보는 두 면의 합이 7이며 1·2·3의 돌림 방향이 같다', () => {
  const turns = dieTurns();
  assert.equal(turns.length, 24);
  assert.equal(new Set(turns.map(String)).size, 24);
  const sign = dieOk(DIE);
  assert.ok(sign);
  for (const die of turns) {
    assert.equal(dieOk(die), sign, String(die));
    assert.ok(isDie(die));
  }
  // 거울에 비친 주사위는 아니다
  assert.equal(isDie([6, 1, 5, 2, 4, 3]), false);
  assert.equal(isDie([6, 1, 5, 2, 3, 3]), false);
});

test('쌓은 주사위의 안 보이는 면: 면의 방향으로 센 것과 같고, 늘 7 × (주사위 수) − (맨 위의 눈)이다', () => {
  const turns = dieTurns();
  for (let count = 1; count <= 3; count++) {
    // 주사위 수마다 여러 모습을 섞어 본다(두 개까지는 모든 묶음)
    const towers = count === 1 ? turns.map((die) => [die]) : count === 2 ? turns.flatMap((a) => turns.map((b) => [a, b])) : turns.map((a, index) => [a, turns[(index * 7) % 24], turns[(index * 11) % 24]]);
    for (const dice of towers) {
      const board = { kind: 'dice', dice };
      assert.equal(checkBoard(board), null);
      const result = solve(board);
      const brute = hiddenSum3d(dice);
      assert.equal(result.sum, brute.sum);
      assert.equal(result.count, brute.count);
      assert.equal(result.count, 2 * count - 1);
      assert.equal(result.sum, 7 * count - dice.at(-1)[1]);
      assert.equal(result.top, dice.at(-1)[1]);
      assert.deepEqual(hiddenFaces(dice).length, result.count);
    }
  }
});

test('모두 찾기: 6×5 모눈에서 찾을 모양은 11가지, 네 칸 한 줄이 놓인 4×3 모눈에서는 6가지다(모눈 안의 모든 여섯 칸 묶음을 접어 본 것과 같다)', () => {
  const big = { kind: 'all', w: 6, h: 5, fixed: [] };
  const row = { kind: 'all', w: 4, h: 3, fixed: [[0, 1], [1, 1], [2, 1], [3, 1]] };
  assert.equal(solve(big).total, 11);
  assert.equal(solve(row).total, 6);
  const bruteBig = new Set(gridShapes(6, 5, 6).filter(isNet3d).map(freeName));
  assert.equal(bruteBig.size, 11);
  assert.deepEqual(new Set(targetsOf(big).map((name) => freeName(JSON.parse(name)))), bruteBig);
  const bruteRow = new Set(gridShapes(4, 3, 6, row.fixed).filter(isNet3d).map(freeName));
  assert.equal(bruteRow.size, 6);
  assert.deepEqual(new Set(targetsOf(row).map((name) => freeName(JSON.parse(name)))), bruteRow);
  // 4×3 모눈에는 세 칸씩 두 줄인 모양만 들어가지 않는다(열 가지)
  assert.equal(targetsOf({ kind: 'all', w: 4, h: 3, fixed: [] }).length, 10);
  assert.equal(new Set(gridShapes(4, 3, 6).filter(isNet3d).map(freeName)).size, 10);
  assert.ok(fitsWith(cubeNets()[0], big));
});

test('같은 모양 가리기: 옮기기만, 돌리기, 뒤집기를 가린다', () => {
  const cross = [[1, 0], [0, 1], [1, 1], [2, 1], [3, 1], [1, 2]];
  assert.equal(sameShape(cross, cross.map(([x, y]) => [x + 2, y + 1])), 'same');
  assert.equal(sameShape(cross, transform(cross, 1)), 'turn');
  // ㄹ자 모양(세 칸 두 줄)은 뒤집어야 겹치는 모습이 있다
  const steps = [[0, 0], [1, 0], [2, 0], [2, 1], [3, 1], [4, 1]];
  assert.equal(sameShape(steps, transform(steps, 4)), 'flip');
  assert.equal(sameShape(steps, cross), null);
  assert.equal(freeKey(steps), freeKey(transform(steps, 6)));
  assert.deepEqual(normalize([[3, 2], [2, 2]]), [[0, 0], [1, 0]]);
});

test('판 규격: 맞지 않는 판을 걸러 낸다', () => {
  assert.deepEqual(KINDS, ['fold', 'many', 'opposite', 'dice', 'all']);
  const cross = [[1, 0], [0, 1], [1, 1], [2, 1], [3, 1], [1, 2]];
  assert.equal(checkBoard({ kind: 'fold', cells: cross }), null);
  assert.notEqual(checkBoard({ kind: 'fold', cells: cross.slice(0, 4) }), null);
  assert.notEqual(checkBoard({ kind: 'fold', cells: [[0, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0]] }), null);
  assert.notEqual(checkBoard({ kind: 'many', shapes: [cross, transform(cross, 1)] }), null, '같은 모양 둘');
  assert.notEqual(checkBoard({ kind: 'opposite', cells: [0, 1, 2, 3, 4, 5].map((x) => [x, 0]), pictures: PICTURES, mark: 0 }), null, '정육면체가 안 되는 모양');
  assert.notEqual(checkBoard({ kind: 'opposite', cells: cross, pictures: PICTURES.slice(0, 5), mark: 0 }), null);
  assert.notEqual(checkBoard({ kind: 'dice', dice: [] }), null);
  assert.notEqual(checkBoard({ kind: 'all', w: 2, h: 2, fixed: [] }), null);
  assert.notEqual(checkBoard({ kind: 'all', w: 6, h: 5, fixed: [[0, 0], [2, 2]] }), null);
  assert.notEqual(checkBoard(null), null);
  assert.throws(() => solve({ kind: 'many', shapes: [] }));
  assert.equal(readyToFold(cross), true);
  assert.equal(readyToFold(cross.slice(0, 5)), false);
  assert.equal(readyToFold([[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [6, 0]]), false);
});

test('접는 나무: 뿌리는 가운데에 가까운 칸이고, 칸마다 접히는 이음매가 하나씩 있다', () => {
  for (const cells of polyominoes(6)) {
    const tree = foldNet(cells);
    assert.equal(tree.root, rootOf(cells));
    assert.equal(tree.order.length, 6);
    assert.equal(tree.parent.filter((parent) => parent === -1).length, 1);
    for (const at of tree.order) {
      if (at === tree.root) continue;
      const [dx, dy] = { E: [1, 0], W: [-1, 0], N: [0, -1], S: [0, 1] }[tree.dir[at]];
      const parent = cells[tree.parent[at]];
      assert.deepEqual(cells[at], [parent[0] + dx, parent[1] + dy]);
    }
    assert.deepEqual(clashesOf(tree.faces), foldResult(cells).clashes);
  }
  // 십자 모양의 뿌리는 가운데 칸
  const cross = [[1, 0], [0, 1], [1, 1], [2, 1], [3, 1], [1, 2]];
  assert.equal(rootOf(cross), 2);
});
