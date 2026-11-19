// 참말 섬의 풀이 프로그램을 따로 적은 것(테스트에서 견주는 데만 쓴다).
// src/core/logic.js와 다른 방법으로 적었다: 배정을 비트 묶음(거짓말쟁이인 주민의 비트가 1)으로 두고,
// 말마다 "참인 배정의 묶음"을 먼저 모두 구한 다음, 말한 주민의 비트와 견준다.

/** 주민 n명, 길이 있으면 길 비트 하나를 더한 배정의 수 */
const sizeOf = (n, road) => 1 << (n + (road ? 1 : 0));
const liar = (mask, who) => (mask >> who) & 1;
const roadIsLeft = (mask, n) => ((mask >> n) & 1) === 0;
const popcount = (mask, n) => {
  let count = 0;
  for (let at = 0; at < n; at++) count += liar(mask, at);
  return count;
};

/** 말이 참인 배정들의 표(배정 번호마다 true/false) */
function truthTable(say, n, road) {
  const { s, by } = say;
  return Array.from({ length: sizeOf(n, road) }, (_, mask) => {
    const knight = (who) => liar(mask, who) === 0;
    if (s.t === 'me') return knight(by) === s.k;
    if (s.t === 'is') return knight(s.who) === s.k;
    if (s.t === 'same') return liar(mask, s.a) === liar(mask, s.b);
    if (s.t === 'diff') return liar(mask, s.a) !== liar(mask, s.b);
    if (s.t === 'all') return s.k ? popcount(mask, n) === 0 : popcount(mask, n) === n;
    if (s.t === 'liars') return popcount(mask, n) === s.n;
    if (s.t === 'some') return popcount(mask, n) > 0;
    if (s.t === 'or') return !(knight(s.a) !== s.ak && knight(s.b) !== s.bk);
    if (s.t === 'road') return roadIsLeft(mask, n) === (s.side === 'left');
    throw new Error(s.t);
  });
}

/** 모든 말이 맞는 배정들(비트 묶음) */
export function bruteWorlds(board) {
  const n = board.people.length;
  const road = board.kind === 'road';
  const tables = board.says.map((say) => truthTable(say, n, road));
  const fitting = [];
  for (let mask = 0; mask < sizeOf(n, road); mask++) {
    if (board.says.every((say, index) => tables[index][mask] === (liar(mask, say.by) === 0))) fitting.push(mask);
  }
  return fitting;
}

/** 묻는 것의 값: 정해지면 그 값, 여럿이면 undefined, 배정이 없으면 null */
export function bruteAnswer(board) {
  const worlds = bruteWorlds(board);
  if (worlds.length === 0) return null;
  const n = board.people.length;
  const valueOf = (mask) =>
    board.ask === 'road' ? (roadIsLeft(mask, n) ? 'left' : 'right') : board.ask === 'count' ? popcount(mask, n) : Array.from({ length: n }, (_, at) => (liar(mask, at) ? 'L' : 'T')).join('');
  const values = new Set(worlds.map(valueOf));
  return values.size === 1 ? [...values][0] : undefined;
}

/** 상자 판: 보물이 있을 수 있는 상자들(글마다 참인지를 문장 그대로 따진다) */
export function bruteBoxes(board) {
  const n = board.labels.length;
  const answers = [];
  for (let at = 0; at < n; at++) {
    let trueCount = 0;
    board.labels.forEach((label, box) => {
      const inBoxes = label.t === 'here' ? [box] : label.t === 'in' ? [label.box] : label.t === 'in-or' ? [label.a, label.b] : null;
      const outBoxes = label.t === 'not-here' ? [box] : label.t === 'not-in' ? [label.box] : null;
      const truth = inBoxes ? inBoxes.includes(at) : !outBoxes.includes(at);
      if (truth) trueCount += 1;
    });
    const want = board.rule.of === 'true' ? board.rule.n : n - board.rule.n;
    if (trueCount === want) answers.push(at);
  }
  return answers;
}

/**
 * 질문 판: 질문의 대답을 따로 적은 식으로 구한다(되묻는 질문을 풀어 쓴 꼴).
 *   길을 묻는 질문: 참말쟁이는 사실대로, 거짓말쟁이는 반대로
 *   "하마는 참말쟁이인가요?": 누구나 "예"
 *   누구나 아는 사실: 참말쟁이는 사실대로, 거짓말쟁이는 반대로
 *   "제가 ‘…’라고 물으면 ‘예’라고 대답할 건가요?": 거짓말쟁이는 거짓말을 두 번 겹친다. 그래서
 *     안이 길을 묻는 질문이면 누구나 길을 사실대로, 안이 "참말쟁이인가요?"면 참말쟁이만 "예",
 *     안이 누구나 아는 사실이면 누구나 그 사실대로 대답한다
 */
export function bruteReply(question, knight, left) {
  const roadFact = (question.side === 'left') === left;
  if (question.q === 'road') return knight ? roadFact : !roadFact;
  if (question.q === 'me') return true;
  if (question.q === 'fact') return knight ? question.yes : !question.yes;
  if (question.q === 'would') {
    const inner = question.inner;
    if (inner.q === 'road') return (inner.side === 'left') === left;
    if (inner.q === 'me') return knight;
    if (inner.q === 'fact') return inner.yes;
  }
  throw new Error(question.q);
}

/** 질문 판: 쓸모 있는 질문의 번호들(질문마다 bruteUseful) */
export const bruteUsefulAt = (board) => board.questions.map((question, at) => (bruteUseful(question) ? at : -1)).filter((at) => at >= 0);

/**
 * 요일 판: 오늘일 수 있는 요일들. src/core/logic.js와 따로 적었다.
 * 요일을 하나씩 오늘이라고 놓고, 말마다 그 말이 가리키는 날(어제, 내일)을 먼저 구한 다음,
 * 말한 주민이 오늘 거짓말하는 날이면 말이 거짓이어야 하고, 아니면 참이어야 한다.
 */
export function bruteDays(board) {
  const answers = [];
  const lying = (who, day) => board.lies[who].indexOf(day) !== -1;
  for (let today = 0; today < 7; today++) {
    const yesterday = today === 0 ? 6 : today - 1;
    const tomorrow = today === 6 ? 0 : today + 1;
    const ok = board.says.every(({ by, s }) => {
      const when = s.off === -1 ? yesterday : s.off === 1 ? tomorrow : today;
      const truth = s.t === 'lieday' ? lying(s.who, when) === s.lie : when === s.day;
      return lying(by, today) ? !truth : truth;
    });
    if (ok) answers.push(today);
  }
  return answers;
}

/** 질문이 쓸모 있는가: "예"를 듣는 경우들과 "아니요"를 듣는 경우들이 길로 깔끔하게 갈린다 */
export function bruteUseful(question) {
  const heard = { true: new Set(), false: new Set() };
  for (const knight of [true, false]) for (const left of [true, false]) heard[bruteReply(question, knight, left)].add(left);
  return heard.true.size <= 1 && heard.false.size <= 1;
}
