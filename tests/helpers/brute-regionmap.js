// 구역 지도 맞히기를 풀이 프로그램과 다른 방법으로 다시 따지는 도구(테스트에서만 쓴다).
// 칸마다 구역을 모두 골라 보고(구역 수의 칸 수 제곱 가지), 구역마다 칸이 있고 한 덩이로 이어진 것만 지도로 센다.
// 이어졌는지는 칸에서 칸으로 번져 가며 칠해 본다. 대답은 네모 안의 칸을 하나하나 세어 구한다.

/** 칸들 가운데 이 구역의 칸이 모두 한 덩이로 이어져 있는가(가로세로로 맞닿은 칸을 따라 번져 간다) */
export function joined(cells, w, h, label) {
  const spots = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (cells[y * w + x] === label) spots.push([x, y]);
  if (spots.length === 0) return false;
  const seen = new Set([`${spots[0][0]},${spots[0][1]}`]);
  const queue = [spots[0]];
  while (queue.length > 0) {
    const [x, y] = queue.shift();
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || cells[ny * w + nx] !== label || seen.has(`${nx},${ny}`)) continue;
      seen.add(`${nx},${ny}`);
      queue.push([nx, ny]);
    }
  }
  return seen.size === spots.length;
}

/** 크기 w×h, 구역 regions의 지도를 모두(칸마다 구역을 모두 골라 본다). sizes가 있으면 구역마다 칸 수가 그만큼인 것만 */
export function bruteMaps(w, h, regions, sizes = null) {
  const n = w * h;
  const k = regions.length;
  const found = [];
  const digits = Array(n).fill(0);
  for (let code = 0; code < k ** n; code++) {
    let rest = code;
    for (let at = 0; at < n; at++) {
      digits[at] = rest % k;
      rest = Math.floor(rest / k);
    }
    const cells = digits.map((digit) => regions[digit]);
    if (sizes && !regions.every((label, at) => cells.filter((cell) => cell === label).length === sizes[at])) continue;
    if (regions.every((label) => joined(cells, w, h, label))) found.push(cells);
  }
  return found;
}

/** 네모 안에 구역마다 몇 칸인가(칸을 하나하나 센다) */
export function bruteAnswer(cells, w, regions, [x0, y0, x1, y1]) {
  return regions.map((label) => {
    let count = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (cells[y * w + x] === label) count += 1;
    return count;
  });
}

/** 숨은 지도(board)와 네모들의 대답이 모두 같은 지도들(maps 가운데) */
export function bruteFitting(board, maps, rects) {
  const wants = rects.map((rect) => bruteAnswer(board.cells, board.w, board.regions, rect).join());
  return maps.filter((cells) => rects.every((rect, at) => bruteAnswer(cells, board.w, board.regions, rect).join() === wants[at]));
}

/** 판의 모든 네모 */
export function bruteRects(w, h) {
  const list = [];
  for (let x0 = 0; x0 < w; x0++) for (let x1 = x0; x1 < w; x1++) for (let y0 = 0; y0 < h; y0++) for (let y1 = y0; y1 < h; y1++) list.push([x0, y0, x1, y1]);
  return list;
}

/** 네모 몇 개를 물으면 숨은 지도 하나만 남는가: 네모 묶음을 개수가 적은 것부터 모두 골라 본다(작은 판만) */
export function bruteMin(board, maps, most = 4) {
  const rects = bruteRects(board.w, board.h);
  const rivals = maps.filter((cells) => cells.join() !== board.cells.join());
  if (rivals.length === 0) return 0;
  // 지도마다 네모 하나하나의 대답을 미리 적어 둔다
  const sign = (cells) => rects.map((rect) => bruteAnswer(cells, board.w, board.regions, rect).join());
  const mine = sign(board.cells);
  const theirs = rivals.map(sign);
  const pick = [];
  const tryAll = (from, left) => {
    if (left === 0) return theirs.every((answers) => pick.some((r) => answers[r] !== mine[r]));
    for (let r = from; r < rects.length; r++) {
      pick.push(r);
      if (tryAll(r + 1, left - 1)) return true;
      pick.pop();
    }
    return false;
  };
  for (let size = 1; size <= most; size++) if (tryAll(0, size)) return size;
  return null;
}
