// 수열 길 퍼즐의 규칙과 풀이 프로그램. 순수 함수만 둔다(화면, 시계, 저장소를 모른다).
//
// 판: 가로 w칸, 세로 h칸. 칸마다 수가 적혀 있거나(values[칸] = 수) 비어 있다(null). 칸 번호는 왼쪽 위가 0이고 오른쪽으로, 그다음 아래 줄로 센다.
// 길: 이웃한 칸(변을 맞댄 칸)을 차례로 지나는 칸 번호들. 한 칸을 두 번 지나지 않는다.
// 약속:
//   - 길은 수가 적힌 칸에서 시작해 수가 적힌 칸에서 끝난다.
//   - 한 길은 수를 셋 이상 지난다. 지나는 차례대로 읽은 수는 같은 크기로 커지거나(또는 같은 크기로 작아진다). 뛰는 크기는 0이 아니다.
//   - 길은 서로 겹치지 않는다. 판의 모든 칸이 어느 한 길에 들어간다(빈칸도 길이 지나간다).
// 길에는 앞뒤가 없다. 3, 5, 7로 읽은 길은 7, 5, 3으로 읽어도 같은 길이다.
//
// 풀이 프로그램(countSolutions)은 판을 길들로 나누는 방법을 모두 센다(정한 수에 닿으면 멈춘다). 사다리는 방법이 꼭 하나인 판만 쓴다.
// 세는 방법: 아직 길이 지나지 않은 칸 가운데 맨 앞(위 줄부터, 왼쪽부터)의 칸을 고른다. 그 칸의 위와 왼쪽은 이미 다른 길이 지나갔으므로,
// 그 칸의 길은 오른쪽이나 아래로만 이어진다. 그래서 그 칸은 길의 끝(오른쪽이나 아래로 하나)이거나, 오른쪽과 아래를 잇는 꺾인 곳이다.
// 한 길을 다 만든 뒤 다음 맨 앞 칸으로 간다. 같은 나누기를 두 번 세지 않는다.
// 가지치기: 이웃이 모자란 칸(빈칸은 길이 지나가려면 이웃 둘, 수 칸은 하나가 있어야 한다), 수가 셋보다 적은 갇힌 곳, 다음에 와야 할 수가 남아 있지 않은 길.

export const MIN_SIZE = 3;
export const MAX_SIZE = 8;
export const MAX_VALUE = 99;

/** 이웃한 칸들(위, 오른쪽, 아래, 왼쪽 차례) */
export function neighbours(board, cell) {
  const { w, h } = board;
  const x = cell % w;
  const y = Math.floor(cell / w);
  const list = [];
  if (y > 0) list.push(cell - w);
  if (x < w - 1) list.push(cell + 1);
  if (y < h - 1) list.push(cell + w);
  if (x > 0) list.push(cell - 1);
  return list;
}

export const xyOf = (board, cell) => [cell % board.w, Math.floor(cell / board.w)];

export function adjacent(board, a, b) {
  const [ax, ay] = xyOf(board, a);
  const [bx, by] = xyOf(board, b);
  return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
}

/** 판이 쓸 수 있는 값인가. 쓸 수 있으면 null, 아니면 까닭(개발자용 글) */
export function checkBoard(board) {
  if (!board || typeof board !== 'object') return 'board';
  const { w, h, values } = board;
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < MIN_SIZE || h < MIN_SIZE || w > MAX_SIZE || h > MAX_SIZE) return 'size';
  if (!Array.isArray(values) || values.length !== w * h) return 'values';
  for (const value of values) {
    if (value === null) continue;
    if (!Number.isInteger(value) || value < 0 || value > MAX_VALUE) return 'value';
  }
  return null;
}

export function copyBoard(board) {
  return { w: board.w, h: board.h, values: board.values.slice() };
}

export function sameBoard(a, b) {
  return a.w === b.w && a.h === b.h && a.values.every((value, index) => value === b.values[index]);
}

/** 수가 적힌 칸의 수 */
export const numberCount = (board) => board.values.filter((value) => value !== null).length;

/** 길이 지나는 수들(지나는 차례대로) */
export const numbersOn = (board, path) => path.map((cell) => board.values[cell]).filter((value) => value !== null);

/**
 * 길 하나가 약속에 맞는지 따진다(판의 다른 길은 보지 않는다).
 * 수의 차례가 어긋난 것(zero, turn, jumps)을 먼저 본다. 그런 길은 더 늘려도 약속에 맞지 않는다.
 * @returns {{ok: boolean, why: string|null, numbers: number[], step: number|null, jumps: number[]}}
 *   why: 'zero'(같은 수가 이어진다) | 'turn'(커지다가 작아지거나 작아지다가 커진다) | 'jumps'(뛰는 크기가 다르다)
 *        | 'end'(수가 없는 칸에서 시작하거나 끝난다) | 'few'(수가 셋보다 적다) | null(맞다)
 *   step: 맞는 길이면 지나는 차례대로의 뛰는 값(음수면 작아진다), jumps: 이웃한 두 수의 차(차례대로, 뒤의 수 − 앞의 수)
 */
export function judgePath(board, path) {
  const numbers = numbersOn(board, path);
  const jumps = numbers.slice(1).map((value, index) => value - numbers[index]);
  const result = (why) => ({ ok: why === null, why, numbers, step: why === null ? jumps[0] : null, jumps });
  if (jumps.some((jump) => jump === 0)) return result('zero');
  if (jumps.some((jump) => Math.sign(jump) !== Math.sign(jumps[0]))) return result('turn');
  if (jumps.some((jump) => jump !== jumps[0])) return result('jumps');
  if (path.length === 0 || board.values[path[0]] === null || board.values[path.at(-1)] === null) return result('end');
  if (numbers.length < 3) return result('few');
  return result(null);
}

/** 수의 차례가 어긋난 길인가(더 늘려도 약속에 맞을 수 없다) */
export const brokenWhy = (why) => why === 'zero' || why === 'turn' || why === 'jumps';

/** 길 하나의 모양이 맞는가: 판 안의 칸, 이웃한 칸끼리, 같은 칸을 두 번 지나지 않는다(한 칸짜리도 된다) */
export function pathShapeOk(board, path) {
  if (!Array.isArray(path) || path.length === 0) return false;
  const n = board.w * board.h;
  if (!path.every((cell) => Number.isInteger(cell) && cell >= 0 && cell < n)) return false;
  if (new Set(path).size !== path.length) return false;
  return path.every((cell, index) => index === 0 || adjacent(board, path[index - 1], cell));
}

/** 길들이 함께 놓일 수 있는가: 길마다 모양이 맞고, 서로 겹치지 않는다. 길은 두 칸 이상이다 */
export function pathsOk(board, paths) {
  if (!Array.isArray(paths)) return false;
  const seen = new Set();
  for (const path of paths) {
    if (!pathShapeOk(board, path) || path.length < 2) return false;
    for (const cell of path) {
      if (seen.has(cell)) return false;
      seen.add(cell);
    }
  }
  return true;
}

/** 길이 지나지 않은 칸들 */
export function freeCells(board, paths) {
  const used = new Set(paths.flat());
  return Array.from({ length: board.w * board.h }, (_, cell) => cell).filter((cell) => !used.has(cell));
}

/** 다 했는가: 모든 칸을 길이 지나고, 길마다 약속에 맞는다 */
export function isDone(board, paths) {
  return pathsOk(board, paths) && freeCells(board, paths).length === 0 && paths.every((path) => judgePath(board, path).ok);
}

/** 길을 앞뒤 없이 비교하려고 한 가지 꼴로 바꾼다(첫 칸이 끝 칸보다 작게) */
export const normalPath = (path) => (path[0] <= path.at(-1) ? path.slice() : path.slice().reverse());

/** 길 묶음을 앞뒤와 차례 없이 비교하는 글자 */
export function pathsKey(paths) {
  return paths
    .map(normalPath)
    .map((path) => path.join('-'))
    .sort()
    .join('|');
}

/**
 * 판을 길들로 나누는 방법을 센다.
 * @param {object} board
 * @param {{limit?: number, budget?: number}} options limit: 이만큼 찾으면 멈춘다. budget: 따져 보는 걸음의 위 끝(넘으면 멈춘다)
 * @returns {{count: number, complete: boolean, paths: number[][]|null, second: number[][]|null, nodes: number}}
 *   count: 찾은 방법의 수, complete: 모든 방법을 끝까지 따졌는가(limit나 budget에 닿아 멈췄으면 false),
 *   paths: 처음 찾은 방법(없으면 null), second: 두 번째로 찾은 방법(없으면 null), nodes: 따져 본 걸음의 수
 */
export function countSolutions(board, { limit = 2, budget = Infinity } = {}) {
  const { w, h, values } = board;
  const n = w * h;
  const near = Array.from({ length: n }, (_, cell) => neighbours(board, cell));
  const used = new Uint8Array(n); // 1이면 길이 지나간 칸(지금 만드는 길도)
  const byValue = new Map();
  values.forEach((value, cell) => {
    if (value === null) return;
    if (!byValue.has(value)) byValue.set(value, []);
    byValue.get(value).push(cell);
  });
  const done = [];
  let found = 0;
  let first = null;
  let second = null;
  let nodes = 0;
  let stopped = false;
  // 지금 만드는 길에서 아직 이어질 수 있는 칸: 늘이는 머리, 그리고 꺾인 곳에서 시작했으면 아직 다른 갈래를 내지 않은 그 칸
  let headOpen = -1;
  let cornerOpen = -1;

  const hasFree = (value) => (byValue.get(value) ?? []).some((cell) => used[cell] === 0);
  const open = (cell) => cell === headOpen || cell === cornerOpen;

  /** 길이 지나간 칸 둘레의 빈 칸들이 아직 길에 들어갈 수 있는가(빈칸은 이웃 둘, 수 칸은 이웃 하나가 있어야 한다) */
  function aroundOk(cell) {
    for (const other of near[cell]) {
      if (used[other] !== 0) continue;
      let room = 0;
      for (const next of near[other]) if (used[next] === 0 || open(next)) room += 1;
      if (room < (values[other] === null ? 2 : 1)) return false;
    }
    return true;
  }

  /** 길이 지나지 않은 칸들이 이어진 덩어리마다 수가 셋 이상 있는가 */
  function partsOk() {
    const seen = new Uint8Array(n);
    for (let cell = 0; cell < n; cell++) {
      if (used[cell] !== 0 || seen[cell]) continue;
      let numbers = 0;
      const stack = [cell];
      seen[cell] = 1;
      while (stack.length > 0) {
        const at = stack.pop();
        if (values[at] !== null) numbers += 1;
        for (const other of near[at]) {
          if (used[other] === 0 && !seen[other]) {
            seen[other] = 1;
            stack.push(other);
          }
        }
      }
      if (numbers < 3) return false;
    }
    return true;
  }

  /**
   * 머리(cells의 마지막 칸)에서 길을 한 칸씩 늘린다. 수 칸에 닿을 때마다 거기서 길을 닫아 본다(close). 닫지 않고 더 늘려도 본다.
   * seq: 늘이는 쪽으로 읽은 수들, step: 그 쪽으로 읽은 뛰는 값(수가 둘보다 적으면 null), only: 첫 걸음을 이 칸으로만(-1이면 아무 이웃)
   */
  function grow(cells, seq, step, close, only = -1) {
    const head = cells.at(-1);
    for (const next of only >= 0 ? [only] : near[head]) {
      if (stopped) return;
      if (used[next] !== 0) continue;
      const value = values[next];
      let nextSeq = seq;
      let nextStep = step;
      if (value !== null) {
        if (seq.length > 0) {
          const jump = value - seq.at(-1);
          if (jump === 0 || (step !== null && jump !== step)) continue;
          nextStep = jump;
        }
        nextSeq = [...seq, value];
      } else if (step !== null && !hasFree(seq.at(-1) + step)) continue;
      nodes += 1;
      if (nodes > budget) {
        stopped = true;
        return;
      }
      used[next] = 1;
      cells.push(next);
      headOpen = next;
      if (aroundOk(next) && aroundOk(head)) {
        if (value !== null) {
          // 여기서 닫으면 머리는 더 이어지지 않는다
          headOpen = -1;
          if (aroundOk(next)) close(cells, nextSeq, nextStep);
          headOpen = next;
        }
        if (!stopped) grow(cells, nextSeq, nextStep, close);
      }
      cells.pop();
      headOpen = head;
      used[next] = 0;
    }
  }

  /** 다 만든 길 하나를 놓고 다음 맨 앞 칸으로 간다 */
  function place(path) {
    const saved = [headOpen, cornerOpen];
    headOpen = -1;
    cornerOpen = -1;
    done.push(path);
    search();
    done.pop();
    [headOpen, cornerOpen] = saved;
  }

  function search() {
    if (stopped) return;
    let cell = 0;
    while (cell < n && used[cell] !== 0) cell += 1;
    if (cell === n) {
      found += 1;
      if (found === 1) first = done.map((path) => path.slice());
      else if (found === 2) second = done.map((path) => path.slice());
      if (found >= limit) stopped = true;
      return;
    }
    if (!partsOk()) return;
    const right = cell % w < w - 1 && used[cell + 1] === 0 ? cell + 1 : -1;
    const down = cell + w < n && used[cell + w] === 0 ? cell + w : -1;
    const value = values[cell];
    used[cell] = 1;
    // 그 칸이 길의 끝이다(수 칸만): 오른쪽이나 아래로 나간다
    if (value !== null) {
      for (const next of [right, down]) {
        if (next < 0 || stopped) continue;
        headOpen = cell;
        cornerOpen = -1;
        grow([cell], [value], null, (cells, seq) => {
          if (seq.length >= 3) place(cells.slice());
        }, next);
      }
    }
    // 그 칸에서 길이 꺾인다: 오른쪽 갈래를 먼저 수 칸까지 만들고, 그다음 아래 갈래를 만든다
    if (right >= 0 && down >= 0 && !stopped) {
      headOpen = cell;
      cornerOpen = cell;
      grow([cell], value === null ? [] : [value], null, (arm, seq) => {
        // 길 전체를 첫 갈래의 끝에서부터 읽으면 seq를 거꾸로 읽은 것이 앞에 온다
        const back = seq.slice().reverse();
        const step = back.length >= 2 ? back.at(-1) - back.at(-2) : null;
        const armCells = arm.slice().reverse();
        const saved = [headOpen, cornerOpen];
        headOpen = cell;
        cornerOpen = -1;
        if (used[down] === 0 && aroundOk(arm.at(-1))) {
          grow([cell], back, step, (cells, all) => {
            if (all.length >= 3) place([...armCells, ...cells.slice(1)]);
          }, down);
        }
        [headOpen, cornerOpen] = saved;
      }, right);
    }
    used[cell] = 0;
    headOpen = -1;
    cornerOpen = -1;
  }

  search();
  return { count: found, complete: !stopped, paths: first, second, nodes };
}
