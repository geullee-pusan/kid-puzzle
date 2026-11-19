// 민들레와 바람의 풀이 프로그램을 다른 방법으로 다시 구해 견주는 데 쓴다.
// 규칙을 여기에 따로 적었다(src/core/dandelion.js의 규칙 함수를 쓰지 않는다).
// 판을 글자 줄로 다룬다: '.' 빈칸, 'F' 꽃, 's' 씨앗. 비트도, 일찍 심기가 낫다는 지름길도 쓰지 않는다. 느리지만 틀릴 곳이 적다.

/** 방향의 이름과 한 칸 움직임. 차례는 앱의 방향 번호와 같다(0 위, 1 오른쪽, 2 아래, 3 왼쪽, 4 오른쪽 위, 5 오른쪽 아래, 6 왼쪽 아래, 7 왼쪽 위) */
export const WAYS = [
  { name: 'up', dx: 0, dy: -1 },
  { name: 'right', dx: 1, dy: 0 },
  { name: 'down', dx: 0, dy: 1 },
  { name: 'left', dx: -1, dy: 0 },
  { name: 'up-right', dx: 1, dy: -1 },
  { name: 'down-right', dx: 1, dy: 1 },
  { name: 'down-left', dx: -1, dy: 1 },
  { name: 'up-left', dx: -1, dy: -1 },
];

const emptyGrid = (w, h) => '.'.repeat(w * h);

/** 바람이 불었을 때: 꽃마다 그 방향으로 판 끝까지 걸어가며 꽃이 아닌 칸을 씨앗으로 바꾼다 */
export function blow(grid, w, h, dir) {
  const cells = [...grid];
  const { dx, dy } = WAYS[dir];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (grid[y * w + x] !== 'F') continue;
      for (let nx = x + dx, ny = y + dy; nx >= 0 && ny >= 0 && nx < w && ny < h; nx += dx, ny += dy) {
        if (cells[ny * w + nx] === '.') cells[ny * w + nx] = 's';
      }
    }
  }
  return cells.join('');
}

const plant = (grid, cell) => grid.slice(0, cell) + 'F' + grid.slice(cell + 1);
const full = (grid) => !grid.includes('.');

/**
 * 게임: 둘 다 잘 두면 어느 쪽이 이기는가. 자리마다 다시 따지지 않게 글자로 적어 둔다.
 * @param {number[]} dirs 쓸 수 있는 방향 번호들
 * @param {string} grid 지금 판(꽃이 심을 차례)
 * @param {number[]} left 아직 안 분 방향들
 */
export function bruteGame(w, h, dirs, grid = emptyGrid(w, h), left = dirs.slice(), memo = new Map()) {
  const flowerTurn = (now, rest) => {
    if (full(now)) return 'flower';
    if (rest.length === 0) return 'wind';
    const key = `f|${now}|${rest.join(',')}`;
    if (memo.has(key)) return memo.get(key);
    let result = 'wind';
    for (let cell = 0; cell < now.length; cell++) {
      if (now[cell] !== '.') continue;
      if (windTurn(plant(now, cell), rest) === 'flower') {
        result = 'flower';
        break;
      }
    }
    memo.set(key, result);
    return result;
  };
  const windTurn = (now, rest) => {
    if (full(now)) return 'flower';
    const key = `w|${now}|${rest.join(',')}`;
    if (memo.has(key)) return memo.get(key);
    let result = 'flower';
    for (const dir of rest) {
      if (flowerTurn(blow(now, w, h, dir), rest.filter((item) => item !== dir)) === 'wind') {
        result = 'wind';
        break;
      }
    }
    memo.set(key, result);
    return result;
  };
  return { flowerTurn, windTurn, winner: flowerTurn(grid, left) };
}

/**
 * 게임의 둔 수들(앱의 꼴 { plant } / { wind })을 글자 판으로 다시 둔다. 둘 수 없는 수를 만나면 null.
 * @returns {{grid: string, left: number[], next: 'flower'|'wind'|null, winner: 'flower'|'wind'|null}|null}
 */
export function bruteReplay(w, h, dirs, trail) {
  let grid = emptyGrid(w, h);
  let left = dirs.slice();
  for (let index = 0; index < trail.length; index++) {
    if (full(grid) || left.length === 0) return null;
    const move = trail[index];
    if (index % 2 === 0) {
      if (!('plant' in move) || grid[move.plant] !== '.') return null;
      grid = plant(grid, move.plant);
    } else {
      if (!('wind' in move) || !left.includes(move.wind)) return null;
      grid = blow(grid, w, h, move.wind);
      left = left.filter((item) => item !== move.wind);
    }
  }
  const winner = full(grid) ? 'flower' : left.length === 0 ? 'wind' : null;
  return { grid, left, next: winner ? null : trail.length % 2 === 0 ? 'flower' : 'wind', winner };
}

/**
 * 혼자 덮기: 바람 앞마다 꽃을 심거나 심지 않는 모든 길을 따져, 판을 다 덮는 가장 적은 꽃의 수. 못 덮으면 null.
 * (앱은 "일찍 심는 쪽이 늘 낫다"를 써서 처음 k번에만 심어 보지만, 여기서는 아무 때나 심거나 건너뛴다.)
 */
export function bruteCover(w, h, order) {
  const memo = new Map();
  const best = (grid, round) => {
    if (full(grid)) return 0;
    if (round === order.length) return Infinity;
    const key = `${grid}|${round}`;
    if (memo.has(key)) return memo.get(key);
    // 심지 않고 분다.
    let value = best(blow(grid, w, h, order[round]), round + 1);
    for (let cell = 0; cell < grid.length; cell++) {
      if (grid[cell] !== '.') continue;
      const planted = plant(grid, cell);
      value = Math.min(value, 1 + (full(planted) ? 0 : best(blow(planted, w, h, order[round]), round + 1)));
    }
    memo.set(key, value);
    return value;
  };
  const value = best(emptyGrid(w, h), 0);
  return Number.isFinite(value) ? value : null;
}
