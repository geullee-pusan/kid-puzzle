// 도미노 가로세로의 풀이 프로그램을 다른 방법으로 다시 구해 견주는 데 쓴다.
// 규칙을 여기에 따로 적었다(src/core/domino.js의 함수를 쓰지 않는다).
// 판을 글자 줄의 배열로 다룬다: '.' 빈칸, '#' 구멍, 'V' 세로 도미노, 'H' 가로 도미노.
// bruteWins는 적어 두지도, 이기는 수를 찾았다고 멈추지도 않고 모든 수를 끝까지 따진다(느리지만 틀릴 곳이 적다). 칸이 12개쯤인 판까지 쓴다.
// memoWins는 더 큰 판(5×5까지)을 위해 글자 판을 이름으로 적어 둔다. 그래도 수를 찾는 법과 끝나는 때는 bruteWins와 같은 글자 규칙이다.

/** { w, h, holes }를 글자 줄로 */
export function gridOf(board) {
  const rows = [];
  for (let y = 0; y < board.h; y++) {
    let row = '';
    for (let x = 0; x < board.w; x++) row += board.holes.includes(y * board.w + x) ? '#' : '.';
    rows.push(row);
  }
  return rows;
}

/** 그 쪽('V' 세로, 'H' 가로)이 놓을 수 있는 자리마다 놓은 뒤의 글자 판 */
export function placements(rows, who) {
  const found = [];
  const h = rows.length;
  const w = rows[0].length;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (rows[y][x] !== '.') continue;
      if (who === 'V' && y + 1 < h && rows[y + 1][x] === '.') {
        const next = rows.slice();
        next[y] = next[y].slice(0, x) + 'V' + next[y].slice(x + 1);
        next[y + 1] = next[y + 1].slice(0, x) + 'V' + next[y + 1].slice(x + 1);
        found.push({ rows: next, cells: [y * w + x, (y + 1) * w + x] });
      }
      if (who === 'H' && x + 1 < w && rows[y][x + 1] === '.') {
        const next = rows.slice();
        next[y] = next[y].slice(0, x) + 'HH' + next[y].slice(x + 2);
        found.push({ rows: next, cells: [y * w + x, y * w + x + 1] });
      }
    }
  }
  return found;
}

const other = (who) => (who === 'V' ? 'H' : 'V');

/** 적어 두지 않고 모두 따진다: who가 둘 차례일 때 who가 이기는가 */
export function bruteWins(rows, who) {
  const options = placements(rows, who);
  // 놓을 곳이 없으면 진다. 있으면 모든 수의 결과를 다 구한 뒤에 하나라도 상대가 지는 수가 있는지 본다.
  const results = options.map((option) => bruteWins(option.rows, other(who)));
  return results.some((result) => result === false);
}

/** 글자 판을 이름으로 적어 두며 따진다(큰 판용). 규칙은 bruteWins와 같다 */
export function memoWins(rows, who, memo = new Map()) {
  const key = `${who}:${rows.join('/').replace(/[VH]/g, 'x')}`;
  if (memo.has(key)) return memo.get(key);
  let result = false;
  for (const option of placements(rows, who)) {
    if (!memoWins(option.rows, other(who), memo)) {
      result = true;
      break;
    }
  }
  memo.set(key, result);
  return result;
}

/** 판의 꼴: 세로가 먼저 둘 때와 가로가 먼저 둘 때 이기는 쪽 */
export function bruteOutcome(board, wins = bruteWins) {
  const rows = gridOf(board);
  return { vert: wins(rows, 'V') ? 'vert' : 'horz', horz: wins(rows, 'H') ? 'horz' : 'vert' };
}

/** 둘 차례인 쪽(who)의 이기는 첫 수들(칸 번호 짝) */
export function bruteWinningFirst(board, who, wins = bruteWins) {
  return placements(gridOf(board), who)
    .filter((option) => !wins(option.rows, other(who)))
    .map((option) => option.cells);
}

/** 글자 판을 칸마다 하나씩 보며 "그 쪽만 놓을 수 있는 칸"을 센다: 칸의 양옆(가로 쪽은 위아래)이 빈칸이 아닌 빈칸 */
export function onlyCells(rows, who) {
  const h = rows.length;
  const w = rows[0].length;
  const free = (x, y) => x >= 0 && y >= 0 && x < w && y < h && rows[y][x] === '.';
  const cells = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!free(x, y)) continue;
      const blocked = who === 'V' ? !free(x - 1, y) && !free(x + 1, y) : !free(x, y - 1) && !free(x, y + 1);
      if (blocked) cells.push(y * w + x);
    }
  }
  return cells;
}
