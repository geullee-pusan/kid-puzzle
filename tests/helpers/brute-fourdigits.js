// 숫자 넷으로 수 만들기를 풀이 프로그램과 다른 방법으로 다시 따진다(테스트에서만 쓴다).
// 풀이 프로그램은 카드 두 장씩 합치는 차례를 따라간다. 여기서는 숫자를 늘어놓는 모든 차례와 괄호를 치는 모든 모양, 셈 기호를 모두 넣은
// 식을 글로 적고(예: "((1+2)*(3/4))"), 그 글을 따로 만든 분수 계산기(BigInt)로 읽어서 셈한다.
// 셈하는 동안 0보다 작은 수가 나오거나 0으로 나누는 식은 버린다(앱의 규칙). 중간에 분수가 나왔는지도 적는다.

const OPS = ['+', '-', '*', '/'];

/** 숫자들을 늘어놓는 서로 다른 차례 */
function permutations(list) {
  if (list.length <= 1) return [list.slice()];
  const seen = new Set();
  const out = [];
  list.forEach((item, index) => {
    if (seen.has(item)) return;
    seen.add(item);
    for (const rest of permutations(list.filter((_, at) => at !== index))) out.push([item, ...rest]);
  });
  return out;
}

/** 수들을 이 차례 그대로 두고 괄호를 친 모든 식의 글(셈 기호를 모두 넣는다) */
function expressions(items) {
  if (items.length === 1) return [String(items[0])];
  const out = [];
  for (let cut = 1; cut < items.length; cut++) {
    const lefts = expressions(items.slice(0, cut));
    const rights = expressions(items.slice(cut));
    for (const left of lefts) for (const right of rights) for (const op of OPS) out.push(`(${left}${op}${right})`);
  }
  return out;
}

// ---- 분수 계산기: BigInt 분자와 분모 ----
const gcd = (a, b) => {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y) [x, y] = [y, x % y];
  return x;
};
const norm = (n, d) => {
  if (d < 0n) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1n;
  return { n: n / g, d: d / g };
};

/**
 * 괄호를 친 식의 글을 읽어 셈한다.
 * @param {string} text
 * @param {{negative?: boolean}} options negative가 참이면 0보다 작은 수가 나와도 버리지 않는다
 * @returns {{n: bigint, d: bigint, plain: boolean}|null} plain: 중간에 나온 수가 모두 자연수(또는 0)였는가. 버린 식은 null
 */
export function evaluate(text, { negative = false } = {}) {
  let at = 0;
  let plain = true;
  const read = () => {
    if (text[at] === '(') {
      at += 1;
      const left = read();
      const op = text[at];
      at += 1;
      const right = read();
      if (text[at] !== ')') throw new Error(`괄호가 맞지 않아요: ${text}`);
      at += 1;
      if (left === null || right === null) return null;
      let value;
      if (op === '+') value = norm(left.n * right.d + right.n * left.d, left.d * right.d);
      else if (op === '-') value = norm(left.n * right.d - right.n * left.d, left.d * right.d);
      else if (op === '*') value = norm(left.n * right.n, left.d * right.d);
      else {
        if (right.n === 0n) return null;
        value = norm(left.n * right.d, left.d * right.n);
      }
      if (!negative && value.n < 0n) return null;
      return value;
    }
    const digit = text[at];
    at += 1;
    return { n: BigInt(digit), d: 1n };
  };
  // 중간 값(맨 바깥을 뺀 모든 괄호)이 자연수였는지는 따로 본다: 괄호마다 다시 읽는다
  const value = read();
  if (value === null) return null;
  const inner = [];
  for (let start = 1; start < text.length; start++) {
    if (text[start] !== '(') continue;
    let depth = 0;
    for (let end = start; end < text.length; end++) {
      if (text[end] === '(') depth += 1;
      if (text[end] === ')') depth -= 1;
      if (depth === 0) {
        inner.push(text.slice(start, end + 1));
        break;
      }
    }
  }
  for (const part of inner) {
    const sub = evaluate(part, { negative });
    if (sub === null || sub.d !== 1n) plain = false;
  }
  return { ...value, plain };
}

/**
 * 숫자들로 만들 수 있는 1부터 top까지의 자연수.
 * @returns {{all: Set<number>, plain: Set<number>}} all은 어떻게든 나오는 수, plain은 중간에 분수를 거치지 않고 나오는 수
 */
export function bruteReach(digits, top = 99, options = {}) {
  const all = new Set();
  const plain = new Set();
  for (const order of permutations(digits)) {
    for (const text of expressions(order)) {
      const value = evaluate(text, options);
      if (value === null || value.d !== 1n || value.n < 1n || value.n > BigInt(top)) continue;
      const n = Number(value.n);
      all.add(n);
      if (value.plain) plain.add(n);
    }
  }
  return { all, plain };
}

/** 1부터 차례로 만들다 처음 막히는 수 */
export function bruteMissing(digits) {
  const { all } = bruteReach(digits, 200);
  let n = 1;
  while (all.has(n)) n += 1;
  return n;
}

/**
 * 카드 n장을 하나로 합치는 서로 다른 차례의 수를 늘어놓아 센다.
 * 고른 두 카드의 순서까지 모두 늘어놓고(n(n−1)가지 × 셈 넷), 더하기와 곱하기는 두 카드의 순서를 가리지 않게 글을 맞춘 뒤 다른 것만 센다.
 */
export function bruteOrderCount(n) {
  const keys = new Set();
  const walk = (cards, trail) => {
    if (cards.length === 1) {
      keys.add(trail.join('|'));
      return;
    }
    for (let i = 0; i < cards.length; i++) {
      for (let j = 0; j < cards.length; j++) {
        if (i === j) continue;
        for (const op of OPS) {
          const [a, b] = (op === '+' || op === '*') && cards[j] < cards[i] ? [cards[j], cards[i]] : [cards[i], cards[j]];
          const made = `(${a}${op}${b})`;
          walk([...cards.filter((_, at) => at !== i && at !== j), made], [...trail, made]);
        }
      }
    }
  };
  walk(Array.from({ length: n }, (_, index) => `c${index}`), []);
  return keys.size;
}

/**
 * 숫자들을 하나로 합치는 서로 다른 차례(bruteOrderCount와 같은 셈) 가운데 마지막 카드가 n인 것의 수.
 * 카드에 이름표를 붙여 차례를 가리고, 값은 BigInt 분수로 따로 셈한다. 0보다 작아지거나 0으로 나누는 차례는 세지 않는다.
 */
export function bruteWays(digits, n) {
  const keys = new Set();
  const walk = (cards, trail) => {
    if (cards.length === 1) {
      const [{ value }] = cards;
      if (value.d === 1n && value.n === BigInt(n)) keys.add(trail.join('|'));
      return;
    }
    for (let i = 0; i < cards.length; i++) {
      for (let j = 0; j < cards.length; j++) {
        if (i === j) continue;
        for (const op of OPS) {
          const [a, b] = (op === '+' || op === '*') && cards[j].tag < cards[i].tag ? [cards[j], cards[i]] : [cards[i], cards[j]];
          const text = `(${a.tag}${op}${b.tag})`;
          let next;
          if (op === '+') next = norm(a.value.n * b.value.d + b.value.n * a.value.d, a.value.d * b.value.d);
          else if (op === '-') next = norm(a.value.n * b.value.d - b.value.n * a.value.d, a.value.d * b.value.d);
          else if (op === '*') next = norm(a.value.n * b.value.n, a.value.d * b.value.d);
          else next = b.value.n === 0n ? null : norm(a.value.n * b.value.d, a.value.d * b.value.n);
          if (next === null || next.n < 0n) continue;
          walk([...cards.filter((_, at) => at !== i && at !== j), { tag: text, value: next }], [...trail, text]);
        }
      }
    }
  };
  walk(
    digits.map((digit, index) => ({ tag: `c${index}`, value: { n: BigInt(digit), d: 1n } })),
    [],
  );
  return keys.size;
}
