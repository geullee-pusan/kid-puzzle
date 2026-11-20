// 공정한 게임일까의 다른 셈: 동전과 주사위의 모든 경우를 글자로 적어 하나씩 센다(src/core/fair.js와 다른 길).
// 동전은 'H'(앞면)와 'T'(뒷면), 주사위는 '1'~'6'의 글자다. 두 개면 왼쪽이 첫 글자다.

/** 던지는 것마다 모든 경우의 글자 */
export function outcomeStrings(device) {
  if (device === 'coin2') return ['HH', 'HT', 'TH', 'TT'];
  if (device === 'coin3') {
    const list = [];
    for (const x of 'HT') for (const y of 'HT') for (const z of 'HT') list.push(x + y + z);
    return list;
  }
  if (device === 'die1') return ['1', '2', '3', '4', '5', '6'];
  const list = [];
  for (let x = 1; x <= 6; x++) for (let y = 1; y <= 6; y++) list.push(`${x}${y}`);
  return list;
}

/** 글자 하나의 경우에서 보는 값 */
export function bruteValue(measure, text) {
  const x = Number(text[0]);
  const y = Number(text[1]);
  switch (measure) {
    case 'same':
      return new Set(text).size === 1 ? 'same' : 'differ';
    case 'heads':
      return text.split('').filter((ch) => ch === 'H').length;
    case 'face':
      return x;
    case 'sum':
      return x + y;
    case 'sumParity':
      return (x + y) & 1 ? 'odd' : 'even';
    case 'prodParity':
      return x & 1 && y & 1 ? 'odd' : 'even';
    case 'diff':
      return x > y ? x - y : y - x;
    case 'max':
      return x > y ? x : y;
    default:
      throw new Error(measure);
  }
}

/** 모든 경우를 하나씩 세어 다람쥐(a)와 고슴도치(b)가 몇 가지씩인지 */
export function bruteCount(rule) {
  let a = 0;
  let b = 0;
  for (const text of outcomeStrings(rule.device)) {
    if (rule.a.includes(bruteValue(rule.measure, text))) a += 1;
    else b += 1;
  }
  return { a, b, total: a + b, verdict: a === b ? 'fair' : a > b ? 'a' : 'b' };
}

/** 순서만 바뀐 경우를 한 가지로 센 수(글자를 늘어놓아 같은 것은 하나로) */
export function bruteUnordered(rule) {
  const seen = new Set();
  let a = 0;
  let b = 0;
  for (const text of outcomeStrings(rule.device)) {
    const key = text.split('').sort().join('');
    if (seen.has(key)) continue;
    seen.add(key);
    if (rule.a.includes(bruteValue(rule.measure, text))) a += 1;
    else b += 1;
  }
  return { a, b, verdict: a === b ? 'fair' : a > b ? 'a' : 'b' };
}

/** 값 하나를 다른 쪽으로 옮겨 공정해지는 값들(모든 값을 하나씩 옮겨 본다) */
export function bruteFixes(rule, values) {
  return values.filter((value) => {
    const a = rule.a.includes(value) ? rule.a.filter((item) => item !== value) : [...rule.a, value];
    return bruteCount({ ...rule, a }).verdict === 'fair';
  });
}
