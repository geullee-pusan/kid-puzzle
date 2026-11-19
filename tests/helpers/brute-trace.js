// 한붓그리기의 5~7단계를 풀이 프로그램과 견줄 때 쓰는 다른 방법들.
// 선이 모인 수(홀짝)를 보지 않는다. 그은 선의 묶음을 하나하나 따라가며 다 해 본다.

/**
 * 펜을 떼고 다시 대며 모든 선을 한 번씩 긋는 가장 적은 획의 수.
 * 자리 = (그은 선의 묶음, 펜이 있는 점 또는 뗀 상태). 선을 따라가거나 펜을 떼면 획의 수가 그대로이고,
 * 펜을 다시 대면 한 획이 는다. 획의 수가 같은 자리를 한 층으로 모아 층마다 다 돌아본다.
 * 같은 두 점 사이의 선(다리)도 따로따로 센다.
 */
export function bruteMinStrokes(figure) {
  const total = figure.edges.length;
  const full = 2 ** total - 1;
  const n = figure.points.length;
  const seen = new Set();
  let layer = [[0, n]]; // 펜을 뗀 상태는 n
  for (let strokes = 0; layer.length > 0; strokes++) {
    const stack = layer;
    const next = [];
    while (stack.length > 0) {
      const [mask, at] = stack.pop();
      const key = mask * (n + 1) + at;
      if (seen.has(key)) continue;
      seen.add(key);
      if (mask === full) return strokes;
      if (at === n) {
        // 펜을 댄다: 아직 긋지 않은 선이 있는 점에만
        for (let point = 0; point < n; point++) {
          if (figure.edges.some(([a, b], index) => (a === point || b === point) && Math.floor(mask / 2 ** index) % 2 === 0)) next.push([mask, point]);
        }
        continue;
      }
      stack.push([mask, n]);
      figure.edges.forEach(([a, b], index) => {
        if (Math.floor(mask / 2 ** index) % 2 === 1 || (a !== at && b !== at)) return;
        stack.push([mask + 2 ** index, a === at ? b : a]);
      });
    }
    layer = next;
  }
  return null;
}
