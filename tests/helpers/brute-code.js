// 숫자 추리의 풀이 프로그램과 견줄 때 쓰는 다른 방법.
// 풀이 프로그램(src/core/code.js)의 두 수 매기기, 후보 만들기, 걸러 내기를 쓰지 않는다.
// 후보는 숫자의 번호를 세는 수(자릿수만큼의 자리를 가진 수)로 모두 훑고, 두 수는 자리마다 숫자 칸을 세어서 낸다.

/** 쓸 수 있는 숫자로 만드는 서로 다른 숫자의 줄을 모두 만든다(번호를 세어 가며, 같은 숫자가 있는 것은 버린다). */
export function bruteCodes(length, digits) {
  const base = digits.length;
  const found = [];
  for (let number = 0; number < base ** length; number++) {
    const picks = [];
    let rest = number;
    for (let at = 0; at < length; at++) {
      picks.unshift(rest % base);
      rest = Math.floor(rest / base);
    }
    if (new Set(picks).size !== length) continue;
    found.push(picks.map((index) => digits[index]).join(''));
  }
  return found;
}

/** 카드 묶음을 모두 만든다: 숫자마다 넣을지 말지를 고른 것(비트) 가운데 꼭 length장인 것. 숫자는 작은 것부터 잇는다. */
export function bruteSets(length, digits) {
  const found = [];
  for (let mask = 0; mask < 2 ** digits.length; mask++) {
    const cards = [...digits].filter((_, index) => (mask >> index) & 1);
    if (cards.length === length) found.push(cards.join(''));
  }
  return found.sort();
}

/** 숫자 칸 세기: 열 칸짜리 상자에 암호의 숫자를 표시하고 추측의 숫자를 하나씩 찾아본다. */
export function bruteScore(guess, secret) {
  const box = Array(10).fill(false);
  for (const ch of secret) box[Number(ch)] = true;
  let hit = 0;
  let place = 0;
  for (let at = 0; at < guess.length; at++) {
    if (box[Number(guess[at])]) hit += 1;
    if (guess.charCodeAt(at) === secret.charCodeAt(at)) place += 1;
  }
  return { hit, place };
}

/** 줄 하나가 그 암호에서 참인가(줄에 적힌 수만 본다) */
export function bruteTrue(code, row) {
  const score = bruteScore(row.guess, code);
  if ('hit' in row && score.hit !== row.hit) return false;
  if ('place' in row && score.place !== row.place) return false;
  return true;
}

/** 표의 모든 줄이 참인 암호들 */
export function bruteMatches(length, digits, rows) {
  return bruteCodes(length, digits).filter((code) => rows.every((row) => bruteTrue(code, row)));
}

/**
 * 한 번 거짓말하는 표: 거짓인 줄이 꼭 하나인 암호들(그 줄과 함께)과, 모든 줄이 참인 암호의 수.
 * 줄마다 "이 줄이 거짓이다"라고 쳐 보고, 그 줄은 거짓이고 나머지는 모두 참인 암호를 모은다.
 */
export function bruteOneLie(length, digits, rows) {
  const answers = [];
  for (let lie = 0; lie < rows.length; lie++) {
    for (const code of bruteCodes(length, digits)) {
      if (!bruteTrue(code, rows[lie]) && rows.every((row, index) => index === lie || bruteTrue(code, row))) answers.push({ code, lie });
    }
  }
  const honest = bruteMatches(length, digits, rows).length;
  return { answers, honest };
}

/** 카드 맞히기: 지금까지 물은 줄과 모두 맞는 카드 묶음(카드 칸을 세어서) */
export function bruteSetMatches(length, digits, rows) {
  return bruteSets(length, digits).filter((set) => rows.every((row) => [...row.guess].filter((ch) => set.includes(ch)).length === row.hit));
}
