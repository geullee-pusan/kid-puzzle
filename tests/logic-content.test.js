// 참말 섬 대본 점검: 화면에 나오는 글이 약속을 지키는지, "왜 그럴까?" 그림 속 판의 답과 주장이 풀이 프로그램과 맞는지 본다.
// 이 형식에서 새로 지키는 것도 여기서 본다: 거짓말쟁이는 놀이 규칙일 뿐 나쁜 주민이 아니다, 주민은 동물이다,
// "적어도 한 명"과 "이거나"는 판에서 뜻을 정해 준다, 말의 틀도 대본에 있다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { LADDER, QUESTIONS, SAY_TYPES, generateBoard, sayPool } from '../src/core/logic-ladder.js';
import { ANIMALS, blankGuess, follow, solve } from '../src/core/logic.js';
import { fill, sentenceCount } from '../src/core/text.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/logic.json'));
const C = JSON.parse(read('src/content/coins.json'));
const html = read('index.html');
const code = read('src/formats/logic.js');

function allStrings(value, path = '') {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((item, index) => allStrings(item, `${path}[${index}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .filter(([key]) => !key.startsWith('_'))
      .flatMap(([key, item]) => allStrings(item, path ? `${path}.${key}` : key));
  }
  return [];
}
const strings = allStrings(T);

function visibleText(source) {
  const labels = [...source.matchAll(/aria-label="([^"]*)"/g)].map((match) => match[1]);
  const body = source
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  return [...labels, body].join(' ');
}
const screenText = visibleText(html);
const part = (from, to) => html.slice(html.indexOf(from), html.indexOf(to, html.indexOf(from)));
const own = [part('id="logic-title"', 'id="make-title"'), part('id="logic-follow"', 'id="why"'), part('id="logic-pad"', 'id="pad"'), part('id="make-logic"', '<script')].map(visibleText).join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
/** 받침이 없는 낱말인가(뒤에 "는", "와"가 맞게 붙는다) */
const open = (word) => (word.charCodeAt(word.length - 1) - 0xac00) % 28 === 0;

/** 말 하나의 틀의 열쇠(src/formats/logic.js와 같은 규칙) */
function sayKey(say) {
  const { s, by } = say;
  if (s.t === 'me') return s.k ? 'me-true' : 'me-false';
  if (s.t === 'is') return s.k ? 'is-true' : 'is-false';
  if (s.t === 'same' || s.t === 'diff') return s.a === by || s.b === by ? `${s.t}-me` : s.t;
  if (s.t === 'all') return s.k ? 'all-true' : 'all-false';
  if (s.t === 'or') return s.a === by ? 'or-me-a' : s.b === by ? 'or-me-b' : 'or';
  if (s.t === 'road') return `road-${s.side}`;
  return s.t;
}
const values = { text: '우리는 모두 거짓말쟁이예요', a: '토끼', b: '다람쥐', n: '두', ak: '참말쟁이', bk: '거짓말쟁이', side: '왼쪽', name: '토끼', reply: '예', k: 3, kind: '참말쟁이', list: '토끼는 참말쟁이', what: '모름', no: '첫째' };

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 이름은 "참말 섬"이다', () => {
  assert.ok(strings.length > 100);
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.equal(T.title, '참말 섬');
  assert.match(html, /<h2 id="logic-title">참말 섬<\/h2>/);
});

test('단계 목록이 사다리와 같고, 표시는 기본·기본·응용·응용·도전·도전이다', () => {
  assert.deepEqual(T.levels.map((entry) => entry.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(LADDER.map((rung) => C.tags[rung.tag]), ['기본', '기본', '응용', '응용', '도전', '도전']);
  assert.equal(T.levels.at(-1).name, '직접 만들기');
  assert.equal(T.levels.at(-1).picture.blank, true);
  for (const rung of LADDER.filter((item) => item.mode !== 'make')) assert.ok(T.home.ask[rung.mode], `${rung.level}단계의 물음`);
});

test('주민은 동물이다. 이름은 받침이 없는 낱말이고 서로 다르다. 사람 이름이 없다', () => {
  assert.equal(T.animals.length, ANIMALS);
  const names = T.animals.map((animal) => animal.name);
  assert.equal(new Set(names).size, names.length);
  for (const name of names) assert.ok(open(name), `${name}: 받침이 있어요`);
  for (const animal of T.animals) assert.ok(animal.face.length > 0, animal.name);
  // 사람을 가리키는 말이 없다(동물뿐이다).
  for (const [path, text] of strings) assert.doesNotMatch(text, /사람|아저씨|아줌마|왕자|공주|씨는/, `${path}: ${text}`);
});

test('거짓말쟁이는 놀이 규칙일 뿐이다: 첫 규칙 글에서 풀어 주고, 나쁘게 그리는 말이 없다', () => {
  assert.match(T.rules.pair, /거짓말쟁이가 늘 반대로 말하는 것은 이 섬의 놀이 규칙이에요/);
  for (const key of ['folk', 'count', 'road']) assert.match(T.rules[key], /놀이 규칙/, key);
  const bad = /나쁜|나빠|못된|속이|속여|사기|도둑|벌을|혼나|미워|싫어|거짓말은 나쁜/;
  for (const [path, text] of strings) assert.doesNotMatch(text, bad, `${path}: ${text}`);
  assert.doesNotMatch(own, bad);
});

test('규칙 설명은 세 문장을 넘지 않고, 묻는 것으로 끝난다', () => {
  assert.deepEqual(Object.keys(T.rules).sort(), ['ask', 'box', 'count', 'folk', 'pair', 'road']);
  for (const [key, text] of Object.entries(T.rules)) {
    assert.ok(sentenceCount(text) <= 3, `${key}: ${text}`);
    assert.match(text, /까요\?$/, key);
  }
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 8, '직접 만들기 안내 글은 형식마다 하나');
  assert.ok(sentenceCount(guides[7]) <= 3, guides[7]);
  assert.match(guides[7], /이 섬의 누구도 할 수 없는 말도 만들어 볼 수 있어요\./);
});

test('말의 틀은 대본에 있다: 판에 나올 수 있는 말마다 틀이 있고, 끼울 값만 바꾼다', () => {
  const keys = new Set();
  for (const types of Object.values(SAY_TYPES)) for (const n of [2, 3]) for (const say of sayPool(n, types)) keys.add(sayKey(say));
  for (const k of [true, false]) keys.add(sayKey({ by: 0, s: { t: 'me', k } }));
  for (const key of keys) assert.ok(T.says[key], `틀이 없어요: ${key}`);
  assert.deepEqual([...keys].sort(), Object.keys(T.says).sort());
  assert.equal(fill(T.says['is-false'], values), '토끼는 거짓말쟁이예요.');
  assert.equal(fill(T.says['same-me'], values), '토끼와 나는 같은 쪽이에요.');
  assert.equal(fill(T.says.liars, values), '우리 가운데 거짓말쟁이는 꼭 두 명이에요.');
  assert.equal(fill(T.says.or, values), '토끼는 참말쟁이이거나 다람쥐는 거짓말쟁이예요.');
  assert.equal(T.says['me-true'], '나는 참말쟁이예요.');
  assert.equal(T.says['me-false'], '나는 거짓말쟁이예요.');
  assert.deepEqual(T.counts, { 1: '한', 2: '두', 3: '세' });
  // 상자의 글과 조건, 질문
  for (const key of ['here', 'not-here', 'in', 'not-in', 'in-or']) assert.ok(T.labels[key], key);
  assert.equal(fill(T.labels['in-or'], values), '보물은 토끼 상자나 다람쥐 상자에 있어요.'.replace('토끼', '토끼').replace('다람쥐', '다람쥐'));
  assert.deepEqual(Object.keys(T.boxRules).sort(), ['false-1', 'false-2', 'true-1', 'true-2']);
  for (const question of [...QUESTIONS.useful, ...QUESTIONS.useless, { q: 'fact', yes: false }]) {
    const key = question.q === 'fact' ? `fact-${question.yes ? 'yes' : 'no'}` : question.q;
    assert.ok(Array.isArray(T.questions[key]), key);
  }
});

test('뜻을 약속으로 정한다: "적어도 한 명"은 "한 명이거나 더 많이", "이거나"는 "둘 다여도 돼요"', () => {
  assert.match(T.notes.some, /‘적어도 한 명’은 한 명이거나 더 많이/);
  assert.match(T.notes.or, /‘이거나’는 둘 다여도 돼요/);
  assert.match(T.notes.same, /둘 다 참말쟁이이거나, 둘 다 거짓말쟁이/);
  // 판에 그 낱말이 나올 때만 판 위에 적는다(화면 코드).
  assert.match(code, /\['same', 'diff', 'some', 'or'\]\.filter\(\(type\) => types\.has\(type\)\)\.map\(\(type\) => T\.notes\[type\]\)/);
});

test('질문은 짧게: 길면 두 줄로 나누고, 한 줄은 40자를 넘지 않는다', () => {
  for (const [key, lines] of Object.entries(T.questions)) {
    assert.ok(lines.length >= 1 && lines.length <= 2, key);
    for (const line of lines) assert.ok([...fill(line, { side: '오른쪽' })].length <= 40, `${key}: ${line}`);
  }
  assert.equal(T.questions.kin.length, 2);
  assert.equal(T.questions.would.length, 2);
});

test('힌트는 판의 종류마다 두 개이고, 하나하나가 질문 한 문장이다. 까닭을 말해 버리지 않는다', () => {
  assert.deepEqual(Object.keys(T.hints).sort(), ['ask', 'box', 'count', 'folk', 'pair', 'road']);
  for (const [key, hints] of Object.entries(T.hints)) {
    assert.equal(hints.length, tuningFor('logic').hintCount, key);
    assert.equal(new Set(hints).size, 2, key);
    for (const hint of hints) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
      assert.doesNotMatch(hint, /할 수 없|못 해|못 하|때문|쳐 보고 따라가기|그러니|반대로 말하니|두 번 뒤집/, hint);
    }
  }
  assert.match(T.hints.pair[0], /한 주민을 참말쟁이라고 쳐 보면/);
  assert.match(T.hints.box[0], /보물이 첫째 상자에 있다고 쳐 보면 참인 글은 몇 개/);
});

test('틀린 답에 하는 말은 짐작이라고 밝힌다("~것 같아요"). 짚은 말을 판에서 따라가 보게 한다', () => {
  assert.deepEqual(Object.keys(T.guess).sort(), ['box-count', 'box-zero', 'count-clash', 'count-clash-zero', 'kinds-clash', 'none-on-possible', 'question-useless', 'road-clash']);
  for (const [key, text] of Object.entries(T.guess)) {
    assert.match(text, /것 같아요/, key);
    assert.doesNotMatch(text, /틀렸|틀린|아니에요|땡|잘못/, key);
  }
  assert.equal(fill(T.guess['kinds-clash'], values), '토끼의 말과 맞지 않는 것 같아요. 그 말을 쳐 보기로 따라가 볼까요?');
  assert.equal(T.guess['none-on-possible'], '모든 말이 맞는 경우가 남아 있는 것 같아요. 한 주민씩 쳐 볼까요?');
  assert.equal(fill(T.guess['box-count'], { n: 2 }), '보물이 그 상자에 있으면 참인 글이 2개가 되는 것 같아요.');
  // 화면 코드: 틀린 답은 세지만 보여 주지 않고, 짚은 말을 판에서 눈에 띄게 한다.
  assert.match(code, /round\.flag = result\.say;/);
  assert.match(code, /flagged: flag === index,/);
});

test('맞혔을 때 하는 말은 한 일을 그대로 말한다(쳐 보기를 몇 번 바꿨는지). 따라가 보기를 켰는지는 말하지 않고, 칭찬 낱말이 없다', () => {
  const praise = /최고|잘했|대단|훌륭|멋져|멋진|천재|똑똑|완벽|짱|굉장|축하|성공/;
  for (const text of Object.values(T.right)) assert.doesNotMatch(text, /^맞아요|정답/, text);
  for (const [path, text] of strings) assert.doesNotMatch(text, praise, `${path}: ${text}`);
  assert.doesNotMatch(own, praise);
  assert.equal(fill(T.right.presses, { n: 5 }), '쳐 보기를 5번 바꿔 보고 알아냈어요.');
  assert.equal(T.right['no-presses'], '쳐 보기 없이 알아냈어요.');
  for (const text of Object.values(T.right)) assert.doesNotMatch(text, /켜|힌트/, text);
  assert.equal(fill(T.right.kinds, { list: [fill(T.right.kind, { name: '하마', kind: '거짓말쟁이' }), fill(T.right.kind, { name: '코알라', kind: '참말쟁이' })].join(T.right.join) }), '하마는 거짓말쟁이, 코알라는 참말쟁이예요.');
  assert.doesNotMatch(code, /followShown[^\n]*T\.right/);
});

test('따라가 보기: 1단계에서만 처음부터 켜져 있고, 그 밖의 판에서 처음 켜면 힌트 하나를 연 것으로 적는다', () => {
  assert.deepEqual(T.tool, { off: '따라가 보기 켜기', on: '따라가 보기 끄기' });
  assert.match(html, /<button id="logic-follow" class="btn wide" type="button" aria-pressed="false" hidden>따라가 보기 켜기<\/button>/);
  assert.match(code, /const followDefault = mode === 'pair' && rungOf\(level\)\.follow === true;/);
  assert.match(code, /if \(round\.follow && !round\.followDefault\) round\.followShown = true;/);
  assert.match(code, /hintsOpened: round\.hintsOpened \+ \(round\.followShown \? 1 : 0\),/);
  assert.equal(T.follow['clash-liar'], '거짓말쟁이라고 쳤는데 참인 말을 했어요');
  assert.equal(T.follow['clash-knight'], '참말쟁이라고 쳤는데 거짓인 말을 했어요');
});

test('글의 빈칸({이름})은 정해진 이름만 쓴다', () => {
  const allowed = new Set(Object.keys(values));
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
  }
});

test('화면 글에 영어 낱말이 없다', () => {
  // 그림 속 판의 자료(board, claim)는 화면에 나오는 글이 아니다.
  for (const [path, text] of strings) if (!/\.(board|claim)\./.test(path)) assert.doesNotMatch(text.replace(/\{[^{}]*\}/g, ''), /[A-Za-z]/, `${path}: ${text}`);
  assert.doesNotMatch(screenText, /[A-Za-z]/);
});

test('화면 글은 "~요"로 끝나는 말투이고, 문장이 너무 길지 않다', () => {
  const spoken = [
    ...Object.values(T.rules),
    ...Object.values(T.hints).flat(),
    ...Object.values(T.guess),
    T.right.kinds,
    T.right.none,
    T.right.count,
    T.right.road,
    T.right.box,
    T.right.question,
    T.right.presses,
    T.right['no-presses'],
    T.right['after-retry'],
    T.right['why-invite'],
    T.solution.kinds,
    T.solution.none,
    T.solution.count,
    T.solution.road,
    T.solution.box,
    T.solution.ask,
    T.play['follow-on'],
    T.make.intro,
    T.make.pick,
    T.make.none,
    T.make.one,
    T.make.many,
    ...Object.values(T.says),
    ...Object.values(T.labels),
    ...Object.values(T.boxRules),
    ...Object.values(T.notes),
    ...T.why.map((slide) => slide.say),
  ];
  for (const text of spoken) for (const sentence of sentences(fill(text, values))) assert.match(sentence, /요[.?!]$/, sentence);
  for (const text of [...Object.values(T.status), ...T.why.flatMap((slide) => slide.figures.map((item) => item.note))]) assert.match(fill(text, { n: 2 }), /요$/, text);
  for (const [path, text] of strings) for (const sentence of sentences(text)) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

test('까닭과 생각의 이름("쳐 보고 따라가기")은 "왜 그럴까?"에서만 말한다. 이름은 이야기의 맨 끝에서 처음 꺼낸다', () => {
  const name = /쳐 보고 따라가기/;
  for (const [path, text] of strings) if (!path.startsWith('why')) assert.doesNotMatch(text, name, `${path}: ${text}`);
  assert.doesNotMatch(screenText, name);
  for (const slide of T.why.slice(0, -1)) assert.doesNotMatch(slide.say, name);
  assert.match(T.why.at(-1).say, name);
  // "누구도 ‘나는 거짓말쟁이예요’라고 못 한다"는 까닭은 "왜 그럴까?"에서만 말한다.
  for (const [path, text] of strings) if (!path.startsWith('why')) assert.doesNotMatch(text, /참말쟁이는 거짓말을 못|거짓말쟁이는 참말을 못/, path);
});

test('"왜 그럴까?"는 그림 서너 장의 이야기다: 믿어 봤다 → 쳐 보고 따라가니 안 맞았다 → 그러니 거짓말쟁이다 → 누구도 "나는 거짓말쟁이예요"를 못 한다 → 상자도 같다', () => {
  assert.ok(T.why.length >= 3 && T.why.length <= 4, `${T.why.length}장`);
  for (const slide of T.why) {
    assert.ok(sentenceCount(slide.say) <= 3, slide.say);
    assert.ok(slide.figures.length >= 1 && slide.figures.length <= 2);
    assert.match(slide.say, /봤어요|았어요|었어요|했어요/, slide.say);
  }
  assert.match(T.why[0].say, /^선생님도 처음엔 말을 하나씩 믿어 봤어요/);
  assert.match(T.why[0].say, /참말쟁이라고 쳐 보고 따라가 봤어요/);
  assert.match(T.why[1].say, /^말이 맞지 않았어요\. 그러니 토끼는 거짓말쟁이예요/);
  assert.match(T.why[2].say, /누구도 ‘나는 거짓말쟁이예요’라고 말할 수 없었어요/);
  assert.match(T.why[2].say, /참말쟁이는 거짓말을 못 하고, 거짓말쟁이는 참말을 못 하니까요/);
  assert.match(T.why[3].say, /^상자도/);
  // 열리는 때: 이 형식의 판을 세 판 끝낸 뒤(임시)
  assert.equal(tuningFor('logic').whyAfter, 'rounds');
  assert.equal(tuningFor('logic').whyRounds, 3);
});

test('"왜 그럴까?" 그림 속 판의 답과 주장은 풀이 프로그램이 따진 것과 같다', () => {
  let checked = 0;
  for (const slide of T.why) {
    for (const item of slide.figures) {
      const { board, claim } = item;
      const where = item.note;
      if (board.kind === 'box') {
        const followed = follow(board, { ...blankGuess(board), box: item.box });
        assert.equal(followed.count, claim.count, where);
        assert.equal(followed.fits, claim.fits, where);
        assert.ok(where.includes(`참인 글이 ${claim.count}개`), where);
        if (claim.only) assert.equal(solve(board).answer, item.box, where);
      } else {
        const guess = { kinds: item.guess, road: null, box: null };
        const followed = follow(board, guess);
        const clashes = followed.says.map((entry, index) => (entry.clash ? index : -1)).filter((index) => index >= 0);
        assert.deepEqual(clashes, claim.clash, where);
        if (claim.only) assert.equal(solve(board).answer, item.guess.map((kind) => (kind ? 'T' : 'L')).join(''), where);
        if (claim.none) assert.equal(solve(board).possible, false, where);
      }
      checked += 1;
    }
  }
  assert.equal(checked, 6);
  // 이야기의 첫 판(토끼: "우리는 모두 거짓말쟁이예요")은 1단계의 맨 첫 판과 같은 꼴이다("지난번 그 판").
  assert.deepEqual(generateBoard(1, 1).board.says.map((say) => say.s), T.why[0].figures[0].board.says.map((say) => say.s));
  assert.equal(T.animals[0].name, '토끼');
  assert.equal(T.animals[1].name, '다람쥐');
});

test('수준 맞추기: 1단계에서 시작한다. "왜 그럴까?"는 이 형식의 판을 세 판 끝낸 뒤에 열린다(작은 판과 나간 판은 세지 않는다)', () => {
  assert.deepEqual(recommend([], 'logic'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  const round = (id, more = {}) => ({ kind: 'round', id, format: 'logic', level: 1, custom: false, outcome: 'solved', answers: [{}], moveCount: 3, ...more });
  assert.equal(whyUnlocked([round('a'), round('b')], 'logic'), false);
  assert.equal(whyUnlocked([round('a'), round('b'), round('c')], 'logic'), true);
  assert.equal(whyUnlocked([round('a'), round('b'), round('c', { side: true })], 'logic'), false);
  assert.equal(whyUnlocked([round('a'), round('b'), round('c', { outcome: 'left' })], 'logic'), false);
  assert.equal(whyUnlocked([round('a'), round('b'), round('c', { outcome: 'solution' })], 'logic'), true);
  // 같은 판이 두 번 적혀도 한 판이다.
  assert.equal(whyUnlocked([round('a'), round('a'), round('b')], 'logic'), false);
  // 다른 형식의 판은 세지 않는다.
  assert.equal(whyUnlocked([round('a'), round('b'), round('c', { format: 'tax' })], 'logic'), false);
  // 한 번에 빠르게: 첫 답으로(wrongCount 0), 힌트 없이, 예상 시간보다 빠르게
  const fast = (id) => round(id, { wrongCount: 0, hintsOpened: 0, seconds: 20 });
  assert.equal(recommend([fast('x'), fast('y')], 'logic').offerHarder, true);
  assert.equal(recommend([fast('x'), { ...fast('y'), wrongCount: 1 }], 'logic').offerHarder, false);
  assert.equal(recommend([fast('x'), { ...fast('y'), hintsOpened: 1 }], 'logic').offerHarder, false);
});

test('index.html: 참말 섬의 카드, 판, 답하는 칸, 도구, 직접 만들기가 있다', () => {
  for (const id of ['home-logic-sample', 'home-logic-ask', 'home-logic-play', 'home-logic-pick', 'home-logic-make', 'home-logic-blank', 'logic-board', 'logic-foot', 'logic-status', 'logic-follow', 'logic-pad', 'logic-kinds', 'logic-kind-rows', 'logic-many', 'logic-count-picks', 'logic-roads', 'logic-road-picks', 'logic-boxes', 'logic-box-picks', 'logic-asks', 'logic-ask-picks', 'logic-copy', 'logic-submit', 'logic-none', 'make-logic', 'logic-make-people', 'logic-make-by', 'logic-make-count', 'logic-make-undo', 'logic-make-clear', 'logic-make-board', 'logic-make-solve', 'logic-make-play', 'logic-make-result', 'logic-make-kinds', 'logic-make-who', 'logic-make-opt', 'logic-make-preview', 'logic-make-add']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(html, /id="logic-none"[^>]*>이런 말은 누구도 할 수 없어요</);
  assert.match(html, /id="logic-copy"[^>]*>쳐 본 대로 고르기</);
  assert.match(html, /id="logic-make-solve"[^>]*>선생님, 풀어 보세요</);
  assert.match(html, /id="logic-make-play"[^>]*>내가 해 볼래요</);
  // 카드는 약수 세금 뒤, "퍼즐 만들기" 앞에 있고, "만들기" 목록에도 있다.
  assert.ok(html.indexOf('id="tax-title"') < html.indexOf('id="logic-title"'));
  assert.ok(html.indexOf('id="logic-title"') < html.indexOf('id="make-title"'));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-logic-make" class="menu-item"/);
  assert.match(html, new RegExp(`id="home-logic-ask"[^>]*>${T.home.ask.pair.replace('?', '\\?')}<`));
  // 직접 만들기의 판 결과: 없다 / 하나다 / 여럿이다
  assert.equal(T.make.none, '이런 말은 이 섬의 누구도 할 수 없어요.');
  assert.equal(fill(T.make.many, { k: 3 }), '누가 누구인지 3가지로 될 수 있어요. 말을 더 붙여 볼까요?');
  assert.match(code, /const line = worlds\.length === 0 \? T\.make\.none : worlds\.length === 1 \? T\.make\.one : fill\(T\.make\.many, \{ k: worlds\.length \}\);/);
  assert.match(code, /kind: 'made',/);
});
