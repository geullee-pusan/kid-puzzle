// 블랙홀을 풀이 프로그램과 다른 방법으로 다시 푼다(테스트에서 견주려고).
// 칸을 [줄, 자리]로 들고, 이웃은 동그라미 가운데 사이의 거리(지름 하나)로 찾는다. 자리를 줄이지 않고 모든 차례를 하나하나 놓아 본 뒤,
// 끝 모습에서 블랙홀의 이웃을 지우고 합을 바로 더한다.

const SQ3 = Math.sqrt(3) / 2;

/** 판의 칸들: { cell, r, c, x, y }(돌 칸까지). 칸 번호는 위에서부터 줄마다 왼쪽부터 센다 */
export function cellsOf(rows) {
  const cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c <= r; c++) cells.push({ cell: cells.length, r, c, x: c - r / 2, y: r * SQ3 });
  return cells;
}

const nearMemo = new Map();

/** 맞닿은 칸(가운데 사이가 지름 하나): 돌을 따지지 않는다 */
export function bruteNear(rows, cell) {
  const key = `${rows}:${cell}`;
  if (!nearMemo.has(key)) nearMemo.set(key, nearBy(rows, cell));
  return nearMemo.get(key);
}

function nearBy(rows, cell) {
  const cells = cellsOf(rows);
  const me = cells[cell];
  return cells.filter((other) => other.cell !== cell && Math.abs(Math.hypot(other.x - me.x, other.y - me.y) - 1) < 1e-9).map((other) => other.cell).sort((a, b) => a - b);
}

/**
 * 끝난 모습의 점수. kid, teacher는 칸 → 수의 Map이고, 빈칸은 하나다.
 * @returns {{hole, kid, teacher, lostKid, lostTeacher}} kid, teacher는 남은 합
 */
export function bruteScore(rows, rocks, kid, teacher) {
  const total = (rows * (rows + 1)) / 2;
  const holes = [];
  for (let cell = 0; cell < total; cell++) if (!rocks.includes(cell) && !kid.has(cell) && !teacher.has(cell)) holes.push(cell);
  if (holes.length !== 1) throw new Error('빈칸이 하나가 아니에요');
  const near = new Set(bruteNear(rows, holes[0]));
  let left = [0, 0];
  let lost = [0, 0];
  [kid, teacher].forEach((map, side) => {
    for (const [cell, number] of map) {
      if (near.has(cell)) lost[side] += number;
      else left[side] += number;
    }
  });
  return { hole: holes[0], kid: left[0], teacher: left[1], lostKid: lost[0], lostTeacher: lost[1] };
}

/**
 * 판(줄 수, 돌, 미리 놓인 수, 먼저 둔 쪽)과 둔 수들을 따라간다. 둘 수 없는 수를 만나면 ok가 false다.
 * 먼저 둔 쪽: 미리 놓인 수가 많은 쪽이 먼저 둔 쪽이고, 같으면 first다. 다음 차례는 수가 적은 쪽, 같으면 먼저 둔 쪽이다.
 */
export function bruteReplay(board, trail, first = board.first) {
  const kid = new Map(board.kid.map((cell, index) => [cell, index + 1]));
  const teacher = new Map(board.teacher.map((cell, index) => [cell, index + 1]));
  const open = (board.rows * (board.rows + 1)) / 2 - board.rocks.length;
  const per = (open - 1) / 2;
  let ok = true;
  for (const cell of trail) {
    const next = kid.size < teacher.size ? 'kid' : teacher.size < kid.size ? 'teacher' : first;
    const used = board.rocks.includes(cell) || kid.has(cell) || teacher.has(cell) || cell < 0 || cell >= (board.rows * (board.rows + 1)) / 2;
    if (used || (kid.size === per && teacher.size === per)) {
      ok = false;
      break;
    }
    const map = next === 'kid' ? kid : teacher;
    map.set(cell, map.size + 1);
  }
  const over = kid.size === per && teacher.size === per;
  return { ok, over, kid, teacher, score: over ? bruteScore(board.rows, board.rocks, kid, teacher) : null };
}

/**
 * 둘 다 잘 두면 끝에 (내 합 - 선생님 합)이 얼마인가. 모든 차례를 하나하나 놓아 본다(빈칸이 많으면 오래 걸린다).
 */
export function bruteValue(board, first = board.first) {
  const total = (board.rows * (board.rows + 1)) / 2;
  const kid = new Map(board.kid.map((cell, index) => [cell, index + 1]));
  const teacher = new Map(board.teacher.map((cell, index) => [cell, index + 1]));
  const per = (total - board.rocks.length - 1) / 2;
  const empty = [];
  for (let cell = 0; cell < total; cell++) if (!board.rocks.includes(cell) && !kid.has(cell) && !teacher.has(cell)) empty.push(cell);
  function go() {
    if (kid.size === per && teacher.size === per) {
      const score = bruteScore(board.rows, board.rocks, kid, teacher);
      return score.kid - score.teacher;
    }
    const next = kid.size < teacher.size ? 'kid' : teacher.size < kid.size ? 'teacher' : first;
    const map = next === 'kid' ? kid : teacher;
    let best = next === 'kid' ? -Infinity : Infinity;
    for (const cell of empty) {
      if (kid.has(cell) || teacher.has(cell)) continue;
      map.set(cell, map.size + 1);
      const value = go();
      map.delete(cell);
      if (next === 'kid' ? value > best : value < best) best = value;
    }
    return best;
  }
  return go();
}
