// 암호 놀이를 풀이 프로그램(src/core/cipher.js)과 다른 방법으로 다시 따지는 도우미.
// 글자 나누기: 유니코드 정규화(NFD)로 첫소리·가운데 소리·받침의 조합용 자모를 얻고, 아래에 글자로 적어 둔 표로 바퀴의 글자를 찾는다(번호 셈을 쓰지 않는다).
// 글자 모으기: 조합용 자모를 이어 붙이고 정규화(NFC)로 한 글자를 만든다.
// 달아난 숫자: 가린 자리에 들어갈 숫자를 글자로 모두 넣어 보고 셈을 글자 그대로 다시 한다.

/** 바퀴의 글자(글자로 적은 표) */
export const CONSONANTS = 'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ';
export const VOWELS = 'ㅏㅑㅓㅕㅗㅛㅜㅠㅡㅣ';
/** 조합용 첫소리 열아홉, 가운데 소리 스물하나, 받침 스물일곱(정규화가 내는 글자 차례대로)과 그 호환 자모 */
const LEADS = 'ᄀᄁᄂᄃᄄᄅᄆᄇᄈᄉᄊᄋᄌᄍᄎᄏᄐᄑᄒ';
const LEAD_JAMO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const MIDS = 'ᅡᅢᅣᅤᅥᅦᅧᅨᅩᅪᅫᅬᅭᅮᅯᅰᅱᅲᅳᅴᅵ';
const MID_JAMO = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const TAILS = 'ᆨᆩᆪᆫᆬᆭᆮᆯᆰᆱᆲᆳᆴᆵᆶᆷᆸᆹᆺᆻᆼᆽᆾᆿᇀᇁᇂ';
const TAIL_JAMO = 'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ';

/**
 * 한 글자를 정규화로 나눈다.
 * @returns {{lead: string, mid: string, tail: string|null} | null} 호환 자모. 한글 글자가 아니면 null
 */
export function bruteSplit(ch) {
  const parts = [...ch.normalize('NFD')];
  if (parts.length < 2 || parts.length > 3) return null;
  const lead = LEADS.indexOf(parts[0]);
  const mid = MIDS.indexOf(parts[1]);
  const tail = parts.length === 3 ? TAILS.indexOf(parts[2]) : -2;
  if (lead < 0 || mid < 0 || tail === -1) return null;
  return { lead: LEAD_JAMO[lead], mid: MID_JAMO[mid], tail: tail === -2 ? null : TAIL_JAMO[tail] };
}

/** 쌍자음, 겹받침, 두 소리가 섞인 모음이 없는 글자인가 */
export function bruteBasic(ch) {
  const split = bruteSplit(ch);
  if (!split) return false;
  return CONSONANTS.includes(split.lead) && VOWELS.includes(split.mid) && (split.tail === null || CONSONANTS.includes(split.tail));
}

/** 호환 자모 셋으로 한 글자를 만든다(정규화) */
export function bruteJoin(lead, mid, tail = null) {
  const text = LEADS[LEAD_JAMO.indexOf(lead)] + MIDS[MID_JAMO.indexOf(mid)] + (tail ? TAILS[TAIL_JAMO.indexOf(tail)] : '');
  return text.normalize('NFC');
}

const ring = (letters, letter, by) => letters[(((letters.indexOf(letter) + by) % letters.length) + letters.length) % letters.length];

/** 글을 민다: 자음은 c칸, 모음은 v칸, 숫자는 d칸(바퀴를 글자로 적은 표에서 찾아 옮긴다) */
export function bruteShift(text, { c = 0, v = 0, d = 0 } = {}) {
  return [...text]
    .map((ch) => {
      if ('0123456789'.includes(ch)) return ring('0123456789', ch, d);
      const split = bruteSplit(ch);
      if (!split) return ch;
      return bruteJoin(ring(CONSONANTS, split.lead, c), ring(VOWELS, split.mid, v), split.tail ? ring(CONSONANTS, split.tail, c) : null);
    })
    .join('');
}

/** 글의 자음(첫소리와 받침)을 센다: 자음 글자마다의 수 */
export function bruteConsonantCounts(text) {
  const counts = Object.fromEntries([...CONSONANTS].map((letter) => [letter, 0]));
  for (const ch of text) {
    const split = bruteSplit(ch);
    if (!split) continue;
    counts[split.lead] += 1;
    if (split.tail) counts[split.tail] += 1;
  }
  return counts;
}

/** ㅇ이 다른 어떤 자음보다 많은가 */
export function bruteFrequencyWorks(text) {
  const counts = bruteConsonantCounts(text);
  return Object.entries(counts).every(([letter, count]) => letter === 'ㅇ' || count < counts['ㅇ']);
}

/**
 * 달아난 숫자: 가린 자리마다 0~9를 글자로 넣어 보고 맞는 채우기를 모두 모은다.
 * @returns {string[]} 맞는 채우기(가린 자리 차례로 숫자를 이은 글)
 */
export function bruteSum(board) {
  const found = [];
  const h = board.hidden.length;
  const fill = (index, digits) => {
    if (index === h) {
      const rows = board.rows.map((row) => [...row]);
      board.hidden.forEach(([line, at], spot) => {
        rows[line][at] = digits[spot];
      });
      const texts = rows.map((row) => row.join(''));
      if (texts.some((text) => text.length > 1 && text.startsWith('0'))) return;
      const [a, b, r] = texts.map((text) => BigInt(text));
      if ((board.op === 'add' ? a + b : a - b) === r) found.push(digits.join(''));
      return;
    }
    for (const digit of '0123456789') fill(index + 1, [...digits, digit]);
  };
  fill(0, []);
  return found;
}

/** 세로셈의 자리마다 받아올림: 일의 자리부터 자리끼리 더해 본다(글자 그대로) */
export function bruteCarries(op, rows) {
  const width = Math.max(...rows.map((row) => row.length));
  const [a, b] = rows.map((row) => row.padStart(width, '0'));
  const carries = [];
  let carry = 0;
  for (let at = width - 1; at >= 0; at--) {
    const value = op === 'add' ? Number(a[at]) + Number(b[at]) + carry : Number(a[at]) - Number(b[at]) - carry;
    carry = op === 'add' ? (value > 9 ? 1 : 0) : value < 0 ? 1 : 0;
    carries.push(carry);
  }
  return carries;
}
