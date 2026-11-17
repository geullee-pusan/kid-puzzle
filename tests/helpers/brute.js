// 테스트에서 풀이 프로그램과 견줄 때 쓰는 다른 방법.

/**
 * 다른 방법: 시작점마다, 갈 수 있는 선을 하나씩 다 골라 보며 끝까지 가 본다(되돌아가며 모든 차례를 해 본다).
 * 선이 모인 수나 덩어리를 세지 않는다. 풀이 프로그램과 생각이 다른 방법이다.
 * @returns {number[]} 끝까지 그을 수 있는 시작점들
 */
export function bruteStarts(figure) {
  const total = figure.edges.length;
  const used = Array(total).fill(false);
  const go = (at, left) => {
    if (left === 0) return true;
    for (let index = 0; index < total; index++) {
      if (used[index]) continue;
      const [a, b] = figure.edges[index];
      if (a !== at && b !== at) continue;
      used[index] = true;
      const done = go(a === at ? b : a, left - 1);
      used[index] = false;
      if (done) return true;
    }
    return false;
  };
  const starts = [];
  for (let start = 0; start < figure.points.length; start++) {
    if (total > 0 && figure.edges.some(([a, b]) => a === start || b === start) && go(start, total)) starts.push(start);
  }
  return starts;
}
