// 지우고 쓰기 예언을 다른 방법으로 따진다: 칠판의 수를 놓인 차례 그대로 두고, 지울 두 자리를 모두 골라 보며 끝까지 지운다.
// 풀이 프로그램(src/core/erase.js)은 수를 작은 것부터 늘어놓은 묶음으로 적어 두고 따지지만, 여기서는 아무것도 적어 두지 않고 모든 차례를 하나하나 해 본다.

/** 규칙대로 새로 쓰는 수(풀이 프로그램의 것을 쓰지 않고 따로 적는다) */
export function bruteWrite(rule, a, b) {
  if (rule === 'same') return a === b ? 0 : 1;
  if (rule === 'less') return a + b - 1;
  return a > b ? a - b : b - a;
}

/** 끝에 남을 수 있는 수를 모두(작은 것부터). 수가 일곱 개까지인 칠판에 쓴다 */
export function bruteFinals(rule, nums) {
  const out = new Set();
  const walk = (list) => {
    if (list.length === 1) {
      out.add(list[0]);
      return;
    }
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        // 새 수는 둘째 자리에 쓴다(어느 두 수를 지웠는지만 끝에 남는 수를 바꾼다)
        const next = list.slice();
        next[j] = bruteWrite(rule, list[i], list[j]);
        next.splice(i, 1);
        walk(next);
      }
    }
  };
  if (nums.length > 7) throw new Error('수가 너무 많아요');
  walk(nums.slice());
  return [...out].sort((a, b) => a - b);
}

/** 시드로 정한 차례 하나로 끝까지 지운 수(큰 칠판에서 끝에 남는 수가 차례와 상관없는지 볼 때 쓴다) */
export function playRandom(rule, nums, seed) {
  let state = seed >>> 0;
  const next = () => {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    return state / 4294967296;
  };
  const list = nums.slice();
  while (list.length > 1) {
    const i = Math.floor(next() * list.length);
    let j = Math.floor(next() * (list.length - 1));
    if (j >= i) j += 1;
    list[j] = bruteWrite(rule, list[i], list[j]);
    list.splice(i, 1);
  }
  return list[0];
}
