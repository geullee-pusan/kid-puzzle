// 닿지 않게 놓기와 구역 긋기를 풀이 프로그램과 다르게 따지는 방법들(테스트에서만 쓴다).
// - 닿는가: 칸 번호를 (가로, 세로)로 바꿔 거리로 따진다
// - 가장 많이 놓기(작은 판): 판의 칸 묶음을 모두 골라 서로 닿지 않는 것 가운데 가장 큰 것과 그 수를 센다
// - 가장 많이 놓기(큰 판): 칸을 차례로 넣거나 빼며 따지고, 줄마다 놓을 수 있는 수의 합으로 가지를 친다
// - 가장 적은 구역: 서로 다 닿는 칸 묶음을 모두 늘어놓은 뒤, 아직 구역에 들지 않은 칸 가운데 이웃 묶음이 가장 적은 칸부터 덮어 가며 찾는다

/** 판에 있는 칸들 */
export function cellsIn(board) {
  const holes = new Set(board.holes);
  return Array.from({ length: board.w * board.h }, (_, cell) => cell).filter((cell) => !holes.has(cell));
}

/** 두 칸이 닿는가(거리로) */
export function near(board, a, b) {
  if (a === b) return false;
  const dx = Math.abs((a % board.w) - (b % board.w));
  const dy = Math.abs(Math.floor(a / board.w) - Math.floor(b / board.w));
  return board.touch === 'side' ? dx + dy === 1 : Math.max(dx, dy) === 1;
}

/** 칸 묶음 안에 닿는 두 칸이 없는가 */
export function apart(board, cells) {
  for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) if (near(board, cells[i], cells[j])) return false;
  return true;
}

/** 칸 묶음 안의 모든 두 칸이 닿는가 */
export function allTouch(board, cells) {
  for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) if (!near(board, cells[i], cells[j])) return false;
  return true;
}

/** 모든 칸 묶음을 골라 본다(칸이 22개 이하인 판만). 가장 많이 놓는 수와 그 방법의 수 */
export function bruteMost(board) {
  const cells = cellsIn(board);
  if (cells.length > 22) throw new Error('판이 너무 커요');
  // 닿는 칸들을 비트로
  const clash = cells.map((a) => cells.reduce((bits, b, index) => (near(board, a, b) ? bits | (1 << index) : bits), 0));
  let best = 0;
  let ways = 0;
  for (let mask = 0; mask < 1 << cells.length; mask++) {
    let ok = true;
    let size = 0;
    for (let index = 0; index < cells.length && ok; index++) {
      if (!(mask & (1 << index))) continue;
      size += 1;
      if (mask & clash[index]) ok = false;
    }
    if (!ok) continue;
    if (size > best) {
      best = size;
      ways = 1;
    } else if (size === best) ways += 1;
  }
  return { best, ways };
}

/** 칸을 차례로 넣거나 빼며 따지는 가장 많이 놓기(큰 판). 남은 칸으로 줄마다 놓을 수 있는 수의 합이 지금까지보다 크지 않으면 가지를 친다 */
export function searchMost(board) {
  const cells = cellsIn(board);
  let best = 0;
  const taken = [];
  const blocked = new Map();
  const bound = (from) => {
    // from 칸부터 아직 막히지 않은 칸을 줄마다 이어진 덩어리로 묶어 (길이 + 1) ÷ 2를 더한다
    let total = 0;
    let run = 0;
    let lastRow = -1;
    let lastX = -2;
    for (let index = from; index < cells.length; index++) {
      const cell = cells[index];
      if ((blocked.get(cell) ?? 0) > 0) continue;
      const row = Math.floor(cell / board.w);
      const x = cell % board.w;
      if (row !== lastRow || x !== lastX + 1) {
        total += Math.ceil(run / 2);
        run = 0;
      }
      run += 1;
      lastRow = row;
      lastX = x;
    }
    return total + Math.ceil(run / 2);
  };
  const walk = (index) => {
    if (taken.length > best) best = taken.length;
    if (index >= cells.length) return;
    if (taken.length + bound(index) <= best) return;
    const cell = cells[index];
    if ((blocked.get(cell) ?? 0) === 0) {
      taken.push(cell);
      const touched = cells.filter((other) => near(board, cell, other));
      for (const other of touched) blocked.set(other, (blocked.get(other) ?? 0) + 1);
      walk(index + 1);
      for (const other of touched) blocked.set(other, blocked.get(other) - 1);
      taken.pop();
    }
    walk(index + 1);
  };
  walk(0);
  return best;
}

/** 서로 다 닿는 칸 묶음들(칸 하나부터 넷까지) */
export function allGroups(board) {
  const cells = cellsIn(board);
  const groups = [];
  const grow = (start, group) => {
    groups.push(group.slice());
    if (group.length === 4) return;
    for (let index = start; index < cells.length; index++) {
      const cell = cells[index];
      if (group.every((other) => near(board, cell, other))) {
        group.push(cell);
        grow(index + 1, group);
        group.pop();
      }
    }
  };
  cells.forEach((cell, index) => grow(index + 1, [cell]));
  return groups;
}

/** 가장 적은 구역의 수: 이웃 묶음이 가장 적은 칸부터 덮어 가며 찾는다(가장 많이 놓는 수보다 적을 수는 없으니 그 수부터 하나씩 늘려 본다) */
export function bruteCover(board, least = 1) {
  const cells = cellsIn(board);
  const groups = allGroups(board);
  const byCell = new Map(cells.map((cell) => [cell, groups.filter((group) => group.includes(cell))]));
  const covered = new Set();
  const fits = (limit) => {
    const open = cells.filter((cell) => !covered.has(cell));
    if (open.length === 0) return true;
    if (limit === 0) return false;
    // 아직 덮이지 않은 칸 가운데 쓸 수 있는 묶음이 가장 적은 칸
    let pick = null;
    let options = null;
    for (const cell of open) {
      const usable = byCell.get(cell).filter((group) => group.every((other) => !covered.has(other)));
      if (!options || usable.length < options.length) {
        pick = cell;
        options = usable;
      }
    }
    if (pick === null) return true;
    // 큰 묶음부터
    for (const group of options.slice().sort((a, b) => b.length - a.length)) {
      for (const cell of group) covered.add(cell);
      const done = fits(limit - 1);
      for (const cell of group) covered.delete(cell);
      if (done) return true;
    }
    return false;
  };
  for (let limit = Math.max(least, 1); limit <= cells.length; limit++) if (fits(limit)) return limit;
  return cells.length;
}

/** 판을 그림 글자로(실패한 판을 알아보기 쉽게) */
export function picture(board) {
  const rows = [];
  for (let y = 0; y < board.h; y++) {
    let row = '';
    for (let x = 0; x < board.w; x++) row += board.holes.includes(y * board.w + x) ? '.' : '#';
    rows.push(row);
  }
  return `${rows.join('/')} ${board.touch}`;
}
