// 참말 섬의 규칙과 풀이 프로그램. 순수 함수만 둔다.
// 섬의 주민은 늘 참말만 하는 참말쟁이와 늘 거짓말만 하는 거짓말쟁이, 두 가지다. 겉으로는 구별되지 않는다.
// ("늘 거짓말"은 이 놀이의 규칙이다. 나쁜 주민이라는 뜻이 아니다.)
//
// 판은 다섯 가지다(board.kind).
//   folk      주민들(people)과 그들이 한 말(says). 묻는 것(ask)은 누가 무엇인지('kinds') 또는 거짓말쟁이가 몇 명인지('count')
//   road      주민들과 숨은 갈림길. 왼쪽 길과 오른쪽 길 가운데 하나만 마을로 간다. 묻는 것은 마을로 가는 길('road')
//   box       상자들과 상자마다 붙은 글(labels), 판 위의 조건 한 줄(rule). 보물은 상자 하나에만 있다. 묻는 것은 보물이 든 상자('box')
//   day       요일 섬. 주민마다 거짓말하는 요일(lies)이 정해져 있다. 그 요일에는 늘 거짓말만, 다른 요일에는 늘 참말만 한다.
//             묻는 것은 오늘이 무슨 요일인지('day'). 주민의 종류는 오늘의 요일로 정해진다(따로 고르지 않는다)
//   question  갈림길의 주민 하나(종류 모름)와 질문 후보들(questions). 묻는 것은 한 번 물어 길을 알 수 있는 질문('question')
//
// 주민(people)은 동물 번호의 목록이다(이름과 모습은 대본에 있다). 말은 정해 둔 틀(t)에 주민 번호와 수를 끼운 것이다.
//   { by: 말한 주민, s: 말 }
//   말 s:  { t: 'me', k }              나는 참말쟁이예요(k가 true) / 나는 거짓말쟁이예요(k가 false)
//          { t: 'is', who, k }         ○○는 참말쟁이예요 / 거짓말쟁이예요
//          { t: 'same', a, b }         ○○와 △△는 같은 종류예요(둘 가운데 하나가 말한 주민이면 "○○와 나는")
//          { t: 'diff', a, b }         ○○와 △△는 다른 종류예요
//          { t: 'all', k }             우리는 모두 참말쟁이예요 / 거짓말쟁이예요
//          { t: 'liars', n }           우리 가운데 거짓말쟁이는 딱 n명이에요
//          { t: 'some' }               우리 가운데 적어도 한 명은 거짓말쟁이예요(한 명이거나 더 많이)
//          { t: 'or', a, ak, b, bk }   a가 (ak)이거나 b가 (bk)예요(둘 다여도 된다). ak와 bk가 같으면 "a와 b 가운데 적어도 한 명은 (ak)예요"로 말한다
//          { t: 'road', side }         마을로 가는 길은 왼쪽이에요 / 오른쪽이에요
//   "우리"는 판의 주민 모두다.
// 요일 섬의 말(요일 판에만 나온다. 요일은 0이 월요일, 6이 일요일이고, 일요일 다음은 월요일이다):
//          { t: 'lieday', who, off, lie }  어제는(off가 -1) / 내일은(off가 1) who가 거짓말하는 날(lie가 true) / 참말하는 날(false)이에요
//          { t: 'dayname', off, day }      어제는(-1) / 오늘은(0) / 내일은(1) day요일이에요
// 상자의 글(labels[i]는 i번째 상자에 붙은 글):
//          { t: 'here' }  { t: 'not-here' }  { t: 'in', box }  { t: 'not-in', box }  { t: 'in-or', a, b }
//   조건 rule: { of: 'true' | 'false', n }  참인(거짓인) 글이 꼭 n개
// 질문(질문 판. 묻는 상대는 그 판의 주민 하나다. 화면에서는 이름으로 부른다):
//          { q: 'road', side }    왼쪽 길이 마을로 가나요?
//          { q: 'me' }            (주민 이름)는 참말쟁이인가요?
//          { q: 'fact', yes }     누구나 아는 사실을 묻는다(yes가 true면 답이 "예"인 사실)
//          { q: 'would', inner }  제가 "(inner)"라고 물으면, (주민 이름)는 "예"라고 대답할 건가요? inner는 위의 세 질문 가운데 하나다
//   2026-11 화면 글 점검에서 "당신 같은 주민에게 물으면"(두 갈래로 읽힌다)은 뺐고, 되묻는 질문은 "제가 …라고 물으면" 한 꼴만 둔다.
//
// 배정(world): { kinds: [참말쟁이면 true, 거짓말쟁이면 false, ...], road: 'left' | 'right' | null }
//   요일 판의 배정에는 오늘(day)과 거짓말하는 요일(lies)이 더 있고, kinds는 오늘 그 주민이 참말하는 날인지다.
// 풀이 프로그램은 가능한 배정을 모두 따져, 참말쟁이의 말은 참이고 거짓말쟁이의 말은 거짓인 배정만 남긴다.
// 묻는 것이 남은 배정에서 모두 같으면 판이 선다. 남은 배정이 없으면 "이렇게 말할 수는 없어요" 판이다.

export const SIDES = ['left', 'right'];
/** 판의 주민 수의 아래 끝과 위 끝 */
export const MIN_PEOPLE = 2;
export const MAX_PEOPLE = 3;
/** 동물의 수(대본의 동물 목록과 같아야 한다. 테스트가 확인한다) */
export const ANIMALS = 12;
/** 상자 판의 상자 수 */
export const MIN_BOXES = 2;
export const MAX_BOXES = 3;
/** 한 판의 말의 수의 위 끝(직접 만들기도 같다) */
export const MAX_SAYS = 6;
/** 한 주의 요일 수. 0이 월요일이다 */
export const DAYS = 7;

const SAY_TYPES = ['me', 'is', 'same', 'diff', 'all', 'liars', 'some', 'or', 'road'];
const DAY_SAY_TYPES = ['lieday', 'dayname'];
const LABEL_TYPES = ['here', 'not-here', 'in', 'not-in', 'in-or'];
const QUESTION_TYPES = ['road', 'me', 'fact', 'would'];
/** 되묻는 질문(would) 안에 넣을 수 있는 질문 */
const INNER_TYPES = ['road', 'me', 'fact'];

const isBool = (value) => value === true || value === false;
const isIndex = (value, size) => Number.isInteger(value) && value >= 0 && value < size;

// ---- 말이 참인가 ----

/** 거짓말쟁이의 수 */
export const liarCount = (kinds) => kinds.filter((kind) => !kind).length;

/** 요일을 off만큼 옮긴다(일요일 다음은 월요일) */
export const shiftDay = (day, off) => (((day + off) % DAYS) + DAYS) % DAYS;

/**
 * 배정 하나에서 말 하나가 참인가.
 * @param {{by: number, s: object}} say
 * @param {{kinds: boolean[], road: string|null}} world
 */
export function sayTruth(say, world) {
  const { s, by } = say;
  const { kinds } = world;
  switch (s.t) {
    case 'me':
      return kinds[by] === s.k;
    case 'is':
      return kinds[s.who] === s.k;
    case 'same':
      return kinds[s.a] === kinds[s.b];
    case 'diff':
      return kinds[s.a] !== kinds[s.b];
    case 'all':
      return kinds.every((kind) => kind === s.k);
    case 'liars':
      return liarCount(kinds) === s.n;
    case 'some':
      return liarCount(kinds) >= 1;
    case 'or':
      return kinds[s.a] === s.ak || kinds[s.b] === s.bk;
    case 'road':
      return world.road === s.side;
    case 'lieday':
      return world.lies[s.who].includes(shiftDay(world.day, s.off)) === s.lie;
    case 'dayname':
      return shiftDay(world.day, s.off) === s.day;
    default:
      throw new Error(`없는 말의 틀이에요: ${s.t}`);
  }
}

/** 말을 한 주민의 종류와 말이 맞는가(참말쟁이는 참인 말, 거짓말쟁이는 거짓인 말) */
export const sayFits = (say, world) => sayTruth(say, world) === world.kinds[say.by];

/** 길이 말에 들어 있는가 */
export const usesRoad = (says) => says.some((say) => say.s.t === 'road');

// ---- 말의 틀 고르기: 대본(says, labels, notes)의 열쇠와 끼울 값. 글은 대본에만 있다 ----
// 열쇠를 고르는 일만 한다. 뜻(sayTruth, labelTruth)은 바꾸지 않는다(테스트가 네 가지 참·거짓 조합마다 문장의 뜻과 견준다).

/**
 * 말 하나를 대본의 어느 틀로 말할지.
 * @returns {[string, {a?: number, b?: number, n?: number, ak?: boolean, bk?: boolean}]} 틀의 열쇠, 끼울 값(a, b는 주민 번호)
 */
export function sayTemplate(say) {
  const { s, by } = say;
  switch (s.t) {
    case 'me':
      return [s.k ? 'me-true' : 'me-false', {}];
    case 'is':
      return [s.k ? 'is-true' : 'is-false', { a: s.who }];
    case 'same':
    case 'diff':
      if (s.a === by || s.b === by) return [`${s.t}-me`, { a: s.a === by ? s.b : s.a }];
      return [s.t, { a: s.a, b: s.b }];
    case 'all':
      return [s.k ? 'all-true' : 'all-false', {}];
    case 'liars':
      return ['liars', { n: s.n }];
    case 'some':
      return ['some', {}];
    case 'or': {
      // 두 쪽의 종류가 같으면 "a와 b 가운데 적어도 한 명은 (ak)예요", 다르면 "a가 (ak)이거나, b가 (bk)예요".
      // 말한 주민이 들어 있으면 "나"를 앞에 둔다("이거나"는 앞뒤를 바꿔도 뜻이 같다).
      const other = s.a === by ? s.b : s.b === by ? s.a : null;
      if (s.ak === s.bk) {
        const kind = s.ak ? 'true' : 'false';
        return other === null ? [`or-${kind}`, { a: s.a, b: s.b }] : [`or-${kind}-me`, { a: other }];
      }
      if (other === null) return ['or', { a: s.a, ak: s.ak, b: s.b, bk: s.bk }];
      const mine = s.a === by ? s.ak : s.bk;
      return ['or-me', { ak: mine, b: other, bk: s.a === by ? s.bk : s.ak }];
    }
    case 'lieday': {
      // "어제는 내가 거짓말하는 날이었어요" / "내일은 너구리가 참말하는 날이에요"
      const key = `lie-${s.off < 0 ? 'yday' : 'tmrw'}-${s.lie ? 'lie' : 'truth'}`;
      return s.who === by ? [`${key}-me`, {}] : [key, { a: s.who }];
    }
    case 'dayname':
      return [`day-${s.off < 0 ? 'yday' : s.off > 0 ? 'tmrw' : 'today'}`, { day: s.day }];
    default:
      return [`road-${s.side}`, {}];
  }
}

/**
 * 질문을 대본의 어느 틀로 적을지. 되묻는 질문은 안에 든 질문의 틀을 함께 돌려준다.
 * @returns {[string, {side?: string, inner?: [string, object]}]}
 */
export function questionTemplate(question) {
  if (question.q === 'would') return ['would', { inner: questionTemplate(question.inner) }];
  if (question.q === 'fact') return [question.yes ? 'fact-yes' : 'fact-no', {}];
  if (question.q === 'road') return ['road', { side: question.side }];
  return [question.q, {}];
}

/**
 * 상자의 글을 대본의 어느 틀로 적을지. 글이 붙은 상자 자기를 가리키면 "이 상자"로 적는다.
 * @param {object} label
 * @param {number} box 글이 붙은 상자
 * @returns {[string, {a?: number, b?: number}]} 틀의 열쇠, 끼울 상자 번호
 */
export function labelTemplate(label, box) {
  if (label.t === 'in-or') {
    if (label.a === box || label.b === box) return ['in-or-here', { a: label.a === box ? label.b : label.a }];
    return ['in-or', { a: label.a, b: label.b }];
  }
  if (label.t === 'in' || label.t === 'not-in') return [label.t, { a: label.box }];
  return [label.t, {}];
}

/**
 * 판 위에 적는 약속(대본 notes의 열쇠): 그 판의 말에 들어 있는 낱말의 뜻. "우리"는 말하지 않는 주민이 있는 판에서만 적는다.
 * 요일 판은 "어제"나 "내일"이 나오면 한 주가 돈다는 것(월요일의 어제는 일요일)을 적는다.
 */
export function noteKeys(board) {
  if (!board.says) return [];
  if (board.kind === 'day') return board.says.some((say) => say.s.t === 'lieday' || say.s.off !== 0) ? ['week'] : [];
  const keys = new Set(board.says.map((say) => sayTemplate(say)[0]));
  const has = (...names) => names.some((name) => keys.has(name));
  const silent = board.people.some((_, index) => !board.says.some((say) => say.by === index));
  return [
    has('same', 'same-me') && 'same',
    has('diff', 'diff-me') && 'diff',
    has('some', 'or-true', 'or-false', 'or-true-me', 'or-false-me') && 'some',
    has('or', 'or-me') && 'or',
    silent && has('all-true', 'all-false', 'liars', 'some') && 'we',
  ].filter(Boolean);
}

// ---- 배정 모두 ----

/** 주민 n명의 배정 모두. 길이 있는 판이면 길(왼쪽, 오른쪽)마다 따로 센다. 첫째 배정은 "모두 참말쟁이"다. */
export function allWorlds(n, withRoad = false) {
  const worlds = [];
  for (let mask = 0; mask < 1 << n; mask++) {
    const kinds = Array.from({ length: n }, (_, index) => (mask & (1 << index)) === 0);
    if (withRoad) for (const road of SIDES) worlds.push({ kinds, road });
    else worlds.push({ kinds, road: null });
  }
  return worlds;
}

/** 모든 말이 맞는 배정 */
export function fittingWorlds(people, says, withRoad = false) {
  return allWorlds(people, withRoad).filter((world) => says.every((say) => sayFits(say, world)));
}

const roadBoard = (board) => board.kind === 'road';
const dayBoard = (board) => board.kind === 'day';

/** 요일 판에서 오늘이 day일 때의 배정. 주민은 거짓말하는 요일이 아니면 참말쟁이처럼 말한다. */
export function dayWorld(board, day) {
  return { kinds: board.lies.map((days) => !days.includes(day)), road: null, day, lies: board.lies };
}

/** 요일 판의 배정 모두(월요일부터 일요일까지) */
export const dayWorlds = (board) => Array.from({ length: DAYS }, (_, day) => dayWorld(board, day));

/** 판에서 남는 배정(주민 판, 갈림길 판, 요일 판) */
export function worldsOf(board) {
  if (dayBoard(board)) return dayWorlds(board).filter((world) => board.says.every((say) => sayFits(say, world)));
  return fittingWorlds(board.people.length, board.says, roadBoard(board));
}

/** 남은 배정에서 묻는 것의 값. 모두 같으면 그 값, 다르면 undefined, 배정이 없으면 null */
export function askedValue(ask, worlds) {
  if (worlds.length === 0) return null;
  const valueOf = (world) => (ask === 'road' ? world.road : ask === 'day' ? world.day : ask === 'count' ? liarCount(world.kinds) : world.kinds.map((kind) => (kind ? 'T' : 'L')).join(''));
  const first = valueOf(worlds[0]);
  return worlds.every((world) => valueOf(world) === first) ? first : undefined;
}

// ---- 상자 ----

/** 보물이 at번째 상자에 있을 때, box번째 상자의 글 label이 참인가 */
export function labelTruth(label, box, at) {
  switch (label.t) {
    case 'here':
      return at === box;
    case 'not-here':
      return at !== box;
    case 'in':
      return at === label.box;
    case 'not-in':
      return at !== label.box;
    case 'in-or':
      return at === label.a || at === label.b;
    default:
      throw new Error(`없는 글의 틀이에요: ${label.t}`);
  }
}

/** 보물이 at번째 상자에 있을 때 글마다 참인가 */
export const labelTruths = (board, at) => board.labels.map((label, box) => labelTruth(label, box, at));

/** 참인 글의 수가 조건과 맞는가 */
export function ruleFits(rule, truths) {
  const count = truths.filter((truth) => truth === (rule.of === 'true')).length;
  return count === rule.n;
}

/** 조건과 맞는 상자들 */
export const boxAnswers = (board) => board.labels.map((_, at) => at).filter((at) => ruleFits(board.rule, labelTruths(board, at)));

// ---- 질문 ----
// 7단계(질문 고르기). 2026-11 화면 글 점검에서 한 번 뺐다가, 되묻는 질문을 '제가 ‘…’라고 물으면, 하마는 ‘예’라고 대답할 건가요?' 한 꼴로만 두고 다시 넣었다.

/** 질문의 속뜻이 그 배정에서 참인가(대답하는 주민이 어떤 종류인지와 상관없이) */
function questionFact(question, world) {
  switch (question.q) {
    case 'road':
      return world.road === question.side;
    case 'me':
      return world.kinds[0];
    case 'fact':
      return question.yes;
    case 'would':
      // 이 주민이 안에 든 질문에 "예"라고 하는가
      return replyOf(question.inner, world);
    default:
      throw new Error(`없는 질문의 틀이에요: ${question.q}`);
  }
}

/** 갈림길의 주민(kinds[0])이 질문에 하는 대답. "예"면 true. 참말쟁이는 속뜻대로, 거짓말쟁이는 반대로 대답한다. */
export function replyOf(question, world) {
  const fact = questionFact(question, world);
  return world.kinds[0] ? fact : !fact;
}

/** 질문 판의 배정 모두: 주민 하나의 종류 × 길 */
export const questionWorlds = () => allWorlds(1, true);

/**
 * 질문이 쓸모 있는가. 배정마다 대답을 구해, 대답이 같은 배정끼리 길이 늘 같으면 쓸모 있다(대답만 듣고 길이 하나로 정해진다).
 * @returns {{useful: boolean, replies: boolean[], clash: null|{reply: boolean, worlds: object[]}}}
 *   clash: 쓸모없으면, 같은 대답이 나오는데 길이 다른 두 배정
 */
export function judgeQuestion(question) {
  const worlds = questionWorlds();
  const replies = worlds.map((world) => replyOf(question, world));
  for (let i = 0; i < worlds.length; i++) {
    for (let j = i + 1; j < worlds.length; j++) {
      if (replies[i] === replies[j] && worlds[i].road !== worlds[j].road) return { useful: false, replies, clash: { reply: replies[i], worlds: [worlds[i], worlds[j]] } };
    }
  }
  return { useful: true, replies, clash: null };
}

// ---- 판 검사 ----

function checkSay(say, people, days = false) {
  if (!say || typeof say !== 'object' || !isIndex(say.by, people) || !say.s || typeof say.s !== 'object') return '말의 꼴이 맞지 않아요';
  const { s } = say;
  // 요일 판에는 요일 섬의 말만, 다른 판에는 요일 섬의 말이 없다.
  if (!(days ? DAY_SAY_TYPES : SAY_TYPES).includes(s.t)) return '없는 말의 틀이에요';
  switch (s.t) {
    case 'me':
    case 'all':
      return isBool(s.k) ? null : '참말쟁이인지 거짓말쟁이인지가 없어요';
    case 'is':
      return isIndex(s.who, people) && s.who !== say.by && isBool(s.k) ? null : '가리키는 주민이 맞지 않아요';
    case 'same':
    case 'diff':
      return isIndex(s.a, people) && isIndex(s.b, people) && s.a < s.b ? null : '두 주민이 맞지 않아요';
    case 'liars':
      return Number.isInteger(s.n) && s.n >= 1 && s.n <= people ? null : '거짓말쟁이의 수가 맞지 않아요';
    case 'some':
      return null;
    case 'or':
      return isIndex(s.a, people) && isIndex(s.b, people) && s.a !== s.b && isBool(s.ak) && isBool(s.bk) ? null : '두 주민이 맞지 않아요';
    case 'road':
      return SIDES.includes(s.side) ? null : '길이 맞지 않아요';
    case 'lieday':
      return isIndex(s.who, people) && (s.off === -1 || s.off === 1) && isBool(s.lie) ? null : '요일 말이 맞지 않아요';
    case 'dayname':
      return [-1, 0, 1].includes(s.off) && isIndex(s.day, DAYS) ? null : '요일 말이 맞지 않아요';
    default:
      return '없는 말의 틀이에요';
  }
}

/** 거짓말하는 요일: 주민마다 하루 이상, 모든 요일은 아니다. 작은 수부터 적는다. */
const checkLies = (lies, people) =>
  Array.isArray(lies) &&
  lies.length === people &&
  lies.every((days) => Array.isArray(days) && days.length >= 1 && days.length < DAYS && days.every((day, at) => isIndex(day, DAYS) && (at === 0 || day > days[at - 1])));

function checkLabel(label, box, boxes) {
  if (!label || typeof label !== 'object' || !LABEL_TYPES.includes(label.t)) return '없는 글의 틀이에요';
  if (label.t === 'in' || label.t === 'not-in') return isIndex(label.box, boxes) && label.box !== box ? null : '가리키는 상자가 맞지 않아요';
  if (label.t === 'in-or') return isIndex(label.a, boxes) && isIndex(label.b, boxes) && label.a < label.b ? null : '가리키는 상자가 맞지 않아요';
  return null;
}

function checkQuestion(question, inner = false) {
  if (!question || typeof question !== 'object' || !(inner ? INNER_TYPES : QUESTION_TYPES).includes(question.q)) return '없는 질문의 틀이에요';
  if (question.q === 'would') return checkQuestion(question.inner, true);
  if (question.q === 'road') return SIDES.includes(question.side) ? null : '길이 맞지 않아요';
  if (question.q === 'fact') return isBool(question.yes) ? null : '사실이 맞지 않아요';
  return null;
}

const checkPeople = (people) =>
  Array.isArray(people) && people.length >= 1 && people.length <= MAX_PEOPLE && people.every((animal) => isIndex(animal, ANIMALS)) && new Set(people).size === people.length;

/**
 * 판이 이 형식의 판으로 쓸 수 있는 값인가. 문제가 없으면 null, 있으면 까닭(개발용 글).
 * 묻는 것이 정해지는지는 보지 않는다(직접 만든 판에는 답이 여럿인 판도 있다).
 */
export function checkBoard(board) {
  if (!board || typeof board !== 'object') return '판이 없어요';
  if (board.kind === 'folk' || board.kind === 'road') {
    if (!checkPeople(board.people) || board.people.length < MIN_PEOPLE) return '주민이 맞지 않아요';
    if (!Array.isArray(board.says) || board.says.length === 0 || board.says.length > MAX_SAYS) return '말의 수가 맞지 않아요';
    for (const say of board.says) {
      const problem = checkSay(say, board.people.length);
      if (problem) return problem;
    }
    if (board.kind === 'folk' && (usesRoad(board.says) || !['kinds', 'count'].includes(board.ask))) return '주민 판의 꼴이 맞지 않아요';
    if (board.kind === 'road' && (!usesRoad(board.says) || board.ask !== 'road')) return '갈림길 판의 꼴이 맞지 않아요';
    return null;
  }
  if (board.kind === 'day') {
    if (!checkPeople(board.people) || !checkLies(board.lies, board.people.length) || board.ask !== 'day') return '요일 판의 꼴이 맞지 않아요';
    if (!Array.isArray(board.says) || board.says.length === 0 || board.says.length > MAX_SAYS) return '말의 수가 맞지 않아요';
    for (const say of board.says) {
      const problem = checkSay(say, board.people.length, true);
      if (problem) return problem;
    }
    return null;
  }
  if (board.kind === 'box') {
    const boxes = board.labels?.length;
    if (!Array.isArray(board.labels) || boxes < MIN_BOXES || boxes > MAX_BOXES || board.ask !== 'box') return '상자의 수가 맞지 않아요';
    for (const [box, label] of board.labels.entries()) {
      const problem = checkLabel(label, box, boxes);
      if (problem) return problem;
    }
    const rule = board.rule;
    if (!rule || !['true', 'false'].includes(rule.of) || !Number.isInteger(rule.n) || rule.n < 1 || rule.n > boxes) return '조건이 맞지 않아요';
    return null;
  }
  if (board.kind === 'question') {
    if (!checkPeople(board.people) || board.people.length !== 1 || board.ask !== 'question') return '주민이 맞지 않아요';
    if (!Array.isArray(board.questions) || board.questions.length < 2 || board.questions.length > 6) return '질문의 수가 맞지 않아요';
    for (const question of board.questions) {
      const problem = checkQuestion(question);
      if (problem) return problem;
    }
    return null;
  }
  return '없는 판의 종류예요';
}

// ---- 풀이 ----

/**
 * 판을 푼다.
 * @returns {object}
 *   possible  묻는 것이 정해지는 판이면 true, 남는 배정이 없는 판이면 false, 정해지지 않으면(직접 만든 판) null
 *   worlds    남는 배정의 수(주민 판, 갈림길 판. 요일 판은 들어맞는 요일의 수), 조건과 맞는 상자의 수(상자 판), 쓸모 있는 질문의 수(질문 판)
 *   answer    묻는 것의 값: kinds는 'TL' 꼴(T는 참말쟁이), count는 수, road는 'left'|'right', box는 상자 번호, day는 요일 번호(0이 월요일),
 *             question은 쓸모 있는 질문의 번호들. 정해지지 않으면 null
 *   kinds     하나로 정해진 배정이면 그 배정(참말쟁이면 true). 아니면 null
 */
export function solve(board) {
  if (board.kind === 'box') {
    const answers = boxAnswers(board);
    return { possible: answers.length === 1 ? true : null, worlds: answers.length, answer: answers.length === 1 ? answers[0] : null, kinds: null };
  }
  if (board.kind === 'question') {
    const useful = board.questions.map((question, at) => (judgeQuestion(question).useful ? at : -1)).filter((at) => at >= 0);
    return { possible: useful.length > 0 ? true : null, worlds: useful.length, answer: useful.length > 0 ? useful : null, kinds: null };
  }
  const worlds = worldsOf(board);
  const value = askedValue(board.ask, worlds);
  const kinds = worlds.length === 1 ? worlds[0].kinds : null;
  if (value === null) return { possible: false, worlds: 0, answer: null, kinds: null };
  if (value === undefined) return { possible: null, worlds: worlds.length, answer: null, kinds };
  return { possible: true, worlds: worlds.length, answer: value, kinds };
}

/** 말 하나하나가 꼭 필요한가: 그 말을 빼면 묻는 것이 정해지지 않게 되는가(남는 배정이 없는 판이면, 빼면 배정이 생기는가). 쓸모없는 말 "나는 참말쟁이예요"는 따로 센다. */
export function spareSays(board, { keepUseless = true } = {}) {
  const base = solve(board);
  const spare = [];
  board.says.forEach((say, index) => {
    if (keepUseless && say.s.t === 'me' && say.s.k) return;
    const without = { ...board, says: board.says.filter((_, at) => at !== index) };
    // 말이 하나도 남지 않으면 아무것도 정해지지 않고, 배정은 모두 남는다. 그래서 하나뿐인 말은 늘 꼭 필요한 말이다.
    if (without.says.length === 0) return;
    const after = solve(without);
    // 남는 배정이 없는 판: 빼도 여전히 배정이 없으면 군더더기다. 정해지는 판: 빼도 같은 값으로 정해지면 군더더기다.
    if (base.possible === false ? after.possible === false : after.possible === true) spare.push(index);
  });
  return spare;
}

/** 군더더기 말이 없는 판인가 */
export const isLean = (board) => spareSays(board).length === 0;

/** 쓸모없는 말("나는 참말쟁이예요")의 수 */
export const uselessCount = (says) => says.filter((say) => say.s.t === 'me' && say.s.k).length;

// ---- 쳐 보기: 아이가 판에 적어 둔 가정 ----
// 가정(guess): { kinds: [true|false|null, ...], road: 'left'|'right'|null, box: 상자 번호|null, day: 요일 번호|null }. null은 "모름".
// 요일 판은 요일(day)만 쳐 본다. 주민의 종류는 쳐 본 요일로 정해진다(kinds는 늘 모름으로 둔다).

/** 빈 가정 */
export function blankGuess(board) {
  const people = board.kind === 'box' ? 0 : board.people.length;
  return { kinds: Array.from({ length: people }, () => null), road: null, box: null, day: null };
}

/** 쳐 본 요일(없으면 null). 예전에 적어 둔 가정에는 day가 없다. */
const guessDay = (guess) => (Number.isInteger(guess.day) ? guess.day : null);

/** 가정을 채워 만들 수 있는 배정 모두(모르는 자리를 모두 채워 본다) */
function completions(guess, withRoad) {
  const unknown = guess.kinds.map((kind, index) => (kind === null ? index : -1)).filter((index) => index >= 0);
  const roads = withRoad ? (guess.road === null ? SIDES : [guess.road]) : [null];
  const worlds = [];
  for (let mask = 0; mask < 1 << unknown.length; mask++) {
    const kinds = guess.kinds.slice();
    unknown.forEach((index, bit) => {
      kinds[index] = (mask & (1 << bit)) === 0;
    });
    for (const road of roads) worlds.push({ kinds, road });
  }
  return worlds;
}

/** 모르는 자리를 어떻게 채워도 값이 같으면 그 값, 다르면 null */
function settled(values) {
  return values.every((value) => value === values[0]) ? values[0] : null;
}

/**
 * 가정을 따라가 본다.
 * 주민 판, 갈림길 판: 말마다 { truth: 참이면 true, 거짓이면 false, 아직 모르면 null, clash: 말한 주민의 쳐 본 종류와 맞지 않으면 true }
 *   done: 가정이 다 채워졌고 모든 말이 맞으면 true
 * 상자 판: { truths: 글마다 참인가(상자를 고르지 않았으면 null), count: 참인 글의 수, fits: 조건과 맞는가 }
 * 질문 판: { replies: 질문마다 대답(예면 true, 모르면 null) }
 */
export function follow(board, guess) {
  if (board.kind === 'box') {
    if (guess.box === null) return { truths: board.labels.map(() => null), count: null, fits: null, done: false };
    const truths = labelTruths(board, guess.box);
    const fits = ruleFits(board.rule, truths);
    return { truths, count: truths.filter(Boolean).length, fits, done: fits };
  }
  if (board.kind === 'question') {
    const worlds = completions(guess, true);
    return { replies: board.questions.map((question) => settled(worlds.map((world) => replyOf(question, world)))), done: false };
  }
  if (dayBoard(board)) {
    // 요일을 모르면 이레를 모두 따져 본다. 주민의 종류는 쳐 본 요일로 정해진다.
    const day = guessDay(guess);
    const worlds = day === null ? dayWorlds(board) : [dayWorld(board, day)];
    const says = board.says.map((say) => {
      const truth = settled(worlds.map((world) => sayTruth(say, world)));
      const kind = day === null ? null : worlds[0].kinds[say.by];
      return { truth, clash: truth !== null && kind !== null && truth !== kind };
    });
    return { says, done: day !== null && says.every((item) => !item.clash) };
  }
  const withRoad = roadBoard(board);
  const worlds = completions(guess, withRoad);
  const says = board.says.map((say) => {
    const truth = settled(worlds.map((world) => sayTruth(say, world)));
    const kind = guess.kinds[say.by];
    return { truth, clash: truth !== null && kind !== null && truth !== kind };
  });
  const full = guess.kinds.every((kind) => kind !== null) && (!withRoad || guess.road !== null);
  return { says, done: full && says.every((item) => !item.clash) };
}

/** 가정이 다 채워졌는가 */
export function guessFull(board, guess) {
  if (board.kind === 'box') return guess.box !== null;
  if (dayBoard(board)) return guessDay(guess) !== null;
  return guess.kinds.every((kind) => kind !== null) && (!(roadBoard(board) || board.kind === 'question') || guess.road !== null);
}

/** 가정이 맞는 배정인가(다 채워졌고 모든 말이 맞는다) */
export function guessFits(board, guess) {
  if (!guessFull(board, guess)) return false;
  if (board.kind === 'box') return ruleFits(board.rule, labelTruths(board, guess.box));
  if (board.kind === 'question') return true;
  if (dayBoard(board)) {
    const world = dayWorld(board, guessDay(guess));
    return board.says.every((say) => sayFits(say, world));
  }
  return board.says.every((say) => sayFits(say, guess));
}

// ---- 쳐 보기 단추를 아무렇게나 누를 때 ----

/**
 * 쳐 보기 단추를 아무렇게나 누를 때, 맞는 배정에 닿기까지 누르는 횟수의 기댓값(판이 좋은지 재는 잣대).
 * 아이는 모두 "모름"에서 시작해, 누를 수 있는 단추(주민마다 하나, 갈림길 판은 길 단추 하나, 상자 판은 상자마다 하나) 가운데 하나를 고르게 골라 누른다.
 * 주민 단추는 모름 → 참말쟁이 → 거짓말쟁이 → 모름, 길 단추는 모름 → 왼쪽 → 오른쪽 → 모름으로 돈다.
 * 상자 단추는 그 상자를 고르고, 이미 고른 상자를 다시 누르면 고른 것을 지운다. 요일 판의 요일 단추(일곱)도 상자 단추와 같다.
 * 맞는 배정이 없는 판이면 null. 뽑아 본 값이 아니라 모든 경우를 따져 구한 값이다(같은 식을 거듭 풀어 수렴시킨다).
 */
export function expectedPresses(board) {
  if (board.kind === 'question') return null;
  if (board.kind === 'box' || dayBoard(board)) {
    const n = dayBoard(board) ? DAYS : board.labels.length;
    const answers = new Set(dayBoard(board) ? worldsOf(board).map((world) => world.day) : boxAnswers(board));
    if (answers.size === 0) return null;
    // 상태: 고른 상자(없으면 n)
    const value = Array(n + 1).fill(0);
    for (let round = 0; round < 10000; round++) {
      let moved = 0;
      for (let state = 0; state <= n; state++) {
        if (answers.has(state)) continue;
        let sum = 0;
        for (let box = 0; box < n; box++) sum += value[box === state ? n : box];
        const next = 1 + sum / n;
        moved = Math.max(moved, Math.abs(next - value[state]));
        value[state] = next;
      }
      if (moved < 1e-10) break;
    }
    return value[n];
  }
  const people = board.people.length;
  const withRoad = roadBoard(board);
  const slots = people + (withRoad ? 1 : 0);
  const size = 3 ** slots;
  const decode = (code) => {
    const digits = [];
    for (let at = 0; at < slots; at++) {
      digits.push(code % 3);
      code = Math.floor(code / 3);
    }
    return digits;
  };
  const encode = (digits) => digits.reduce((sum, digit, at) => sum + digit * 3 ** at, 0);
  // 0은 모름, 1은 참말쟁이(왼쪽), 2는 거짓말쟁이(오른쪽)
  const fits = (digits) => {
    if (digits.some((digit) => digit === 0)) return false;
    const world = { kinds: digits.slice(0, people).map((digit) => digit === 1), road: withRoad ? (digits[people] === 1 ? 'left' : 'right') : null };
    return board.says.every((say) => sayFits(say, world));
  };
  const goal = Array.from({ length: size }, (_, code) => fits(decode(code)));
  if (!goal.some(Boolean)) return null;
  const nextOf = Array.from({ length: size }, (_, code) => {
    const digits = decode(code);
    return digits.map((_, at) => {
      const turned = digits.slice();
      turned[at] = (turned[at] + 1) % 3;
      return encode(turned);
    });
  });
  const value = Array(size).fill(0);
  for (let round = 0; round < 20000; round++) {
    let moved = 0;
    for (let code = 0; code < size; code++) {
      if (goal[code]) continue;
      const next = 1 + nextOf[code].reduce((sum, other) => sum + value[other], 0) / slots;
      moved = Math.max(moved, Math.abs(next - value[code]));
      value[code] = next;
    }
    if (moved < 1e-9) break;
  }
  return value[0];
}

// ---- 오답 짐작 ----

/**
 * 아이가 낸 답을 판에 비춰 본다. 판정하지 않고 무엇을 놓쳤을지 짐작하는 데 쓴다.
 * @param {object} board
 * @param {object} answer  { type: 'kinds', kinds } | { type: 'none' } | { type: 'count', n } | { type: 'road', side } | { type: 'box', at } | { type: 'question', at } | { type: 'day', day }
 * @param {object} guess   지금 판에 적어 둔 가정(짚을 말을 찾을 때 쓴다)
 * @returns {{correct: boolean, guess: string|null, say: number|null, count: number|null, reply: boolean|null}}
 *   guess  짐작의 종류: 'kinds-clash'(그 배정에서 맞지 않는 말이 있다. say가 그 첫 말), 'none-on-possible'(맞는 배정이 남아 있다),
 *          'count-clash'(그 수의 거짓말쟁이로는 맞지 않는다. 지금 가정이 그 수이면 say가 맞지 않는 첫 말),
 *          'road-clash'(그 길로는 맞지 않는다. 지금 가정이 그 길이면 say), 'box-count'(그 상자면 참인 글이 count개다),
 *          'question-useless'(같은 대답이 길이 달라도 나온다. reply가 그 대답), 'day-clash'(그 요일이면 어긋나는 말이 있다. say가 그 첫 말)
 */
export function diagnose(board, answer, guess = blankGuess(board)) {
  const solved = solve(board);
  const result = (correct, kind = null, more = {}) => ({ correct, guess: correct ? null : kind, say: null, count: null, reply: null, ...more });
  const firstClash = (world) => {
    const index = board.says.findIndex((say) => !sayFits(say, world));
    return index >= 0 ? index : null;
  };
  if (board.kind === 'box') {
    if (answer.type !== 'box') return result(false, 'box-count');
    const truths = labelTruths(board, answer.at);
    return result(answer.at === solved.answer, 'box-count', { count: truths.filter(Boolean).length });
  }
  if (board.kind === 'question') {
    const judged = judgeQuestion(board.questions[answer.at]);
    return result(judged.useful, 'question-useless', { reply: judged.clash?.reply ?? null });
  }
  if (dayBoard(board)) {
    const ok = solved.possible === true && solved.answer === answer.day;
    return result(ok, 'day-clash', { say: ok ? null : firstClash(dayWorld(board, answer.day)) });
  }
  if (answer.type === 'none') return result(solved.possible === false, 'none-on-possible');
  if (answer.type === 'kinds') {
    const world = { kinds: answer.kinds, road: guess.road };
    const ok = solved.possible === true && board.ask === 'kinds' && answer.kinds.map((kind) => (kind ? 'T' : 'L')).join('') === solved.answer;
    return result(ok, 'kinds-clash', { say: ok ? null : firstClash(world) });
  }
  // 수나 길로 답했다: 지금 가정이 다 채워졌고 그 답과 같으면, 그 가정에서 맞지 않는 첫 말을 짚는다.
  const full = guessFull(board, guess);
  if (answer.type === 'count') {
    const ok = solved.possible === true && solved.answer === answer.n;
    const same = full && liarCount(guess.kinds) === answer.n;
    return result(ok, 'count-clash', { say: !ok && same ? firstClash(guess) : null });
  }
  if (answer.type === 'road') {
    const ok = solved.possible === true && solved.answer === answer.side;
    // 길은 쳐 본 길이 그 답과 같으면, 다 채우지 않은 가정에서도 이미 맞지 않는 말이 있으면 그 첫 말을 짚는다.
    const clashes = guess.road === answer.side ? follow(board, guess).says.findIndex((item) => item.clash) : -1;
    return result(ok, 'road-clash', { say: !ok && clashes >= 0 ? clashes : null });
  }
  throw new Error(`없는 답의 꼴이에요: ${answer.type}`);
}
