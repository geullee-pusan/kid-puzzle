// 수열 길 퍼즐을 풀이 프로그램과 다른 방법으로 다시 따진다(테스트에서만 쓴다).
// 풀이 프로그램은 맨 앞의 빈 칸에서 길을 하나씩 늘려 가며 센다. 여기서는 이웃한 두 칸 사이의 선(변)마다 "길이 지나간다/안 지나간다"를
// 차례로 정해 보고(칸마다 선이 둘을 넘지 않게만 줄인다), 다 정한 뒤에 선들이 이은 덩어리가 모두 약속에 맞는 길인지 본다.

/** 이웃한 두 칸의 짝 모두(위 줄부터, 왼쪽부터) */
export function edgesOf(w, h) {
  const edges = [];
  for (let cell = 0; cell < w * h; cell++) {
    if (cell % w < w - 1) edges.push([cell, cell + 1]);
    if (cell + w < w * h) edges.push([cell, cell + w]);
  }
  return edges;
}

/** 길 하나가 지나는 수가 셋 이상이고, 0이 아닌 같은 차로 이어지는가(앞뒤 어느 쪽으로 읽어도 같다) */
export function bruteFits(numbers) {
  if (numbers.length < 3) return false;
  const step = numbers[1] - numbers[0];
  if (step === 0) return false;
  for (let index = 2; index < numbers.length; index++) if (numbers[index] - numbers[index - 1] !== step) return false;
  return true;
}

/** 고른 선들이 판을 약속에 맞는 길들로 나누는가. 맞으면 길들(칸 번호의 줄), 아니면 null */
export function brutePaths(board, chosen) {
  const { w, h, values } = board;
  const n = w * h;
  const links = Array.from({ length: n }, () => []);
  for (const [a, b] of chosen) {
    links[a].push(b);
    links[b].push(a);
  }
  const seen = new Uint8Array(n);
  const paths = [];
  for (let cell = 0; cell < n; cell++) {
    if (seen[cell]) continue;
    const degree = links[cell].length;
    if (degree === 0 || degree > 2) return null;
    if (degree !== 1) continue;
    // 끝에서부터 따라간다
    const path = [cell];
    seen[cell] = 1;
    let previous = -1;
    let at = cell;
    for (;;) {
      const next = links[at].find((other) => other !== previous);
      if (next === undefined) break;
      if (seen[next]) return null;
      seen[next] = 1;
      path.push(next);
      previous = at;
      at = next;
    }
    if (values[path[0]] === null || values[path.at(-1)] === null) return null;
    if (!bruteFits(path.map((item) => values[item]).filter((value) => value !== null))) return null;
    paths.push(path);
  }
  // 끝이 없는 덩어리(고리)가 남았으면 안 된다
  if (seen.some((value) => value === 0)) return null;
  return paths;
}

/**
 * 판을 길들로 나누는 방법을 모두 센다. limit에 닿으면 멈춘다.
 * @returns {{count: number, solutions: number[][][]}} solutions: 찾은 방법들(limit까지)
 */
export function bruteCount(board, limit = Infinity) {
  const { w, h, values } = board;
  const edges = edgesOf(w, h);
  const degree = new Int8Array(w * h);
  const last = new Int32Array(w * h).fill(-1);
  edges.forEach(([a, b], index) => {
    last[a] = index;
    last[b] = index;
  });
  const chosen = [];
  const solutions = [];
  let count = 0;
  const settled = (cell) => (values[cell] === null ? degree[cell] === 2 : degree[cell] === 1 || degree[cell] === 2);
  function visit(index) {
    if (count >= limit) return;
    if (index === edges.length) {
      const paths = brutePaths(board, chosen);
      if (paths) {
        count += 1;
        solutions.push(paths);
      }
      return;
    }
    const [a, b] = edges[index];
    for (const take of [false, true]) {
      if (take) {
        if (degree[a] >= 2 || degree[b] >= 2) continue;
        degree[a] += 1;
        degree[b] += 1;
        chosen.push(edges[index]);
      }
      // 이 선이 마지막 선인 칸은 선의 수가 맞아야 한다
      if ((last[a] !== index || settled(a)) && (last[b] !== index || settled(b))) visit(index + 1);
      if (take) {
        chosen.pop();
        degree[a] -= 1;
        degree[b] -= 1;
      }
    }
  }
  visit(0);
  return { count, solutions };
}

/**
 * 더 큰 판(8×8까지)을 위한 두 번째 방법. 선을 하나씩 정하는 것은 bruteCount와 같고, 두 가지를 더 본다.
 *   - 선을 이을 때마다 이어진 조각(늘 한 줄이다)의 수가 같은 차로 이어지는지 본다. 고리가 생기는 선은 잇지 않는다.
 *   - 칸의 선을 다 정했을 때 그 칸이 든 조각의 두 끝이 모두 정해졌으면 수가 셋 이상인지 본다.
 * 풀이 프로그램(맨 앞 빈 칸에서 길을 하나씩 늘려 가기)과 따지는 차례가 다르다.
 * @returns {{count: number, solutions: number[][][]}}
 */
export function bruteEdges(board, limit = Infinity) {
  const { w, h, values } = board;
  const n = w * h;
  const edges = edgesOf(w, h);
  const degree = new Int8Array(n);
  const last = new Int32Array(n).fill(-1);
  edges.forEach(([a, b], index) => {
    last[a] = index;
    last[b] = index;
  });
  const parent = Array.from({ length: n }, (_, cell) => cell);
  const line = Array.from({ length: n }, (_, cell) => [cell]); // 뿌리 칸마다 조각의 칸들(차례대로)
  const find = (cell) => {
    while (parent[cell] !== cell) cell = parent[cell];
    return cell;
  };
  const evenSteps = (cells) => {
    const numbers = cells.map((cell) => values[cell]).filter((value) => value !== null);
    if (numbers.length < 2) return true;
    const step = numbers[1] - numbers[0];
    if (step === 0) return false;
    return numbers.every((value, index) => index === 0 || value - numbers[index - 1] === step);
  };
  const solutions = [];
  let count = 0;
  /** 선을 다 정한 칸이 약속에 맞는가 */
  function settledOk(cell, index) {
    if (last[cell] !== index) return true;
    const d = degree[cell];
    if (values[cell] === null ? d !== 2 : d < 1 || d > 2) return false;
    // 이 칸이 든 조각의 두 끝이 모두 선을 다 정한 끝이면 조각이 다 된 것이다
    const cells = line[find(cell)];
    const ends = [cells[0], cells.at(-1)];
    if (cells.length > 1 && ends.every((end) => last[end] <= index && degree[end] === 1)) {
      return cells.filter((item) => values[item] !== null).length >= 3;
    }
    return true;
  }
  function visit(index) {
    if (count >= limit) return;
    if (index === edges.length) {
      count += 1;
      const roots = new Set();
      for (let cell = 0; cell < n; cell++) roots.add(find(cell));
      solutions.push([...roots].map((root) => line[root].slice()));
      return;
    }
    const [a, b] = edges[index];
    // 잇지 않는다
    if (settledOk(a, index) && settledOk(b, index)) visit(index + 1);
    // 잇는다
    if (degree[a] >= 2 || degree[b] >= 2) return;
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    let first = line[ra];
    let second = line[rb];
    if (first.at(-1) !== a) first = first.slice().reverse();
    if (second[0] !== b) second = second.slice().reverse();
    const joined = [...first, ...second];
    if (!evenSteps(joined)) return;
    const [big, small] = line[ra].length >= line[rb].length ? [ra, rb] : [rb, ra];
    const saved = line[big];
    parent[small] = big;
    line[big] = joined;
    degree[a] += 1;
    degree[b] += 1;
    if (settledOk(a, index) && settledOk(b, index)) visit(index + 1);
    degree[a] -= 1;
    degree[b] -= 1;
    line[big] = saved;
    parent[small] = small;
  }
  visit(0);
  return { count, solutions };
}
