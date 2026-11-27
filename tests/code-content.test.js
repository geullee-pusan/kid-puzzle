// 숫자 추리 대본 점검: 화면에 나오는 글이 약속을 지키는지, 그림 속의 수가 풀이 프로그램과 맞는지 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { LADDER, MAKE_DIGITS, MAKE_LEVEL, OLD_MAKE_LEVEL, TOP_LEVEL, generateBoard, rungOf } from '../src/core/code-ladder.js';
import { allCodes, checkCode, checkSet, falseRows, filterCodes, judge, trailOf } from '../src/core/code.js';
import { TUNING, recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { fill, ordinal, sentenceCount } from '../src/core/text.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const T = JSON.parse(readFileSync(resolve(ROOT, 'src/content/code.json'), 'utf8'));
const C = JSON.parse(readFileSync(resolve(ROOT, 'src/content/coins.json'), 'utf8'));
const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const source = readFileSync(resolve(ROOT, 'src/formats/code.js'), 'utf8');

const MODES = ['guess', 'table', 'referee', 'place', 'cards', 'lie'];
const GUESS_KEYS = ['table-row', 'referee-reply', 'referee-hit', 'referee-place', 'lie-two', 'lie-none'];
const RIGHT_KEYS = ['guess-found', 'table-first', 'table-tries', 'referee-found', 'referee-trail', 'why-invite', 'cards-found', 'lie-first', 'lie-tries'];
// 화면 글이 아닌 값: 그림의 암호와 숫자 묶음, 카드 묶음
const DATA_KEYS = new Set(['guess', 'secret', 'shown', 'digits', 'list', 'cards']);

/** 대본의 모든 글(값)을 길과 함께 모은다. 설명(_로 시작하는 것)과 그림의 암호·숫자 묶음은 뺀다. */
function allStrings(value, path = '') {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((item, index) => allStrings(item, `${path}[${index}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .filter(([key]) => !key.startsWith('_') && !(DATA_KEYS.has(key) && (path.startsWith('why') || path.startsWith('levels'))))
      .flatMap(([key, item]) => allStrings(item, path ? `${path}.${key}` : key));
  }
  return [];
}
const strings = allStrings(T);

/** index.html에서 화면에 보이는 글만 뽑는다(꼬리표, 주석, 스크립트를 뺀다). aria-label도 읽어 주는 글이라 넣는다. */
function visibleText(source) {
  const labels = [...source.matchAll(/aria-label="([^"]*)"/g)].map((match) => match[1]);
  const body = source
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  return [...labels, body].join(' ');
}
const screenText = visibleText(html);
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const range = { low: 0, high: 9, n: 3 };

test('대본을 읽을 수 있고, 글이 비어 있지 않다', () => {
  assert.ok(strings.length > 60);
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.equal(T.title, '숫자 추리');
});

test('단계 목록이 사다리와 같고, 표시는 기본·응용·응용·도전·도전·응용·응용·도전·도전이다', () => {
  assert.deepEqual(T.levels.map((entry) => entry.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(LADDER.map((rung) => C.tags[rung.tag]), ['기본', '응용', '응용', '도전', '도전', '응용', '응용', '도전', '도전']);
  assert.deepEqual(T.levels.slice(5, 8).map((entry) => entry.name), ['자리만 알려 주는 표', '카드 세 장 맞히기', '한 번 거짓말하는 표']);
  assert.equal(T.levels.at(-1).level, MAKE_LEVEL);
  assert.equal(T.levels.at(-1).name, '직접 만들기');
  // 단계 이름에 적은 자릿수와 숫자가 사다리와 같다.
  assert.match(T.levels[0].name, /세 자리.*1부터 6까지/);
  assert.match(T.levels[1].name, /세 자리.*0부터 9까지/);
  assert.match(T.levels[2].name, /네 자리.*0부터 9까지/);
  assert.deepEqual([rungOf(1).length, rungOf(1).digits], [3, '123456']);
  assert.deepEqual([rungOf(3).length, rungOf(3).digits], [4, '0123456789']);
});

test('판의 종류마다 규칙 설명이 있고, 세 문장을 넘지 않는다', () => {
  assert.deepEqual(Object.keys(T.rules).sort(), [...MODES].sort());
  for (const mode of MODES) {
    const rule = fill(T.rules[mode], range);
    assert.ok(sentenceCount(rule) <= 3, `${mode}: ${rule}`);
    assert.match(rule, mode === 'cards' ? /숫자 카드 0부터 9까지 가운데 3장/ : /숫자 0부터 9까지 가운데 서로 다른 숫자 3개/, mode);
  }
  // 자리만 알려 주는 표: 한 수만 적혀 있다고 말한다. 카드 맞히기: 몇 장인지만 알려 주고 차례는 상관없다고 말한다.
  assert.match(T.rules.place, /자리가 맞는 숫자가 몇 개인지만/);
  assert.match(T.rules.place, /하나뿐/);
  assert.match(T.rules.cards, /몇 장인지만 알려 줄게요/);
  assert.match(T.rules.cards, /차례는 상관없/);
  assert.match(T.rules.cards, /몇 번이든 물어도 돼요/);
  // 한 번 거짓말하는 표: 선생님이 처음에 "딱 하나는 거짓"이라고 말한다.
  assert.match(T.rules.lie, /^이 표의 줄 가운데 딱 하나는 거짓이에요\./);
  assert.match(T.rules.lie, /딱 한 줄만 거짓이 되는 암호는 하나뿐이에요\.$/);
  // 두 수가 무엇인지 말한다. 맞혀야 하는 횟수를 정하지 않는다.
  assert.match(T.rules.guess, /들어 있는 숫자가 몇 개인지/);
  assert.match(T.rules.guess, /자리도 맞는 것이 몇 개인지/);
  assert.match(T.rules.guess, /몇 번이든 내도 돼요/);
  assert.match(T.rules.table, /하나뿐/);
  // 역할 바꾸기: 세어서 알려 줄 두 수가 무엇인지 말한다.
  assert.match(T.rules.referee, /들어 있는 숫자와 자리도 맞는 것을 세어서 알려 주세요\.$/);
  // 직접 만들기 화면의 안내 글도 같다. 답이 하나뿐인 표를 만들어 보라고 권한다.
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 52, '직접 만들기 안내 글은 형식마다 하나');
  assert.ok(sentenceCount(guides[2]) <= 3, guides[2]);
  assert.match(guides[2], /답이 하나뿐인 표를 만들 수 있을까요\?/);
  assert.match(T.make.intro, /답이 하나뿐인 표를 만들 수 있을까요\?/);
  // 한 글에서 '답'을 두 뜻으로 쓰지 않는다. 만들기 화면에 "선생님, 풀어 보세요" 단추가 있으므로 안내 끝에 그 말을 한다.
  assert.match(T.make.intro, /^추측 한 줄과 두 수를 넣어서/);
  assert.match(T.make.intro, /선생님에게 풀어 보라고 할 수도 있어요\.$/);
  assert.match(html, /id="code-make-solve"[^>]*>선생님, 풀어 보세요</);
  // 직접 풀어 보는 단추는 이름에 따옴표를 붙여 가리킨다(선생님이 "내가"라고 말하는 것처럼 들리지 않게).
  assert.match(T.make.one, /‘내가 해 볼래요’ 단추를 누르면/);
});

test('성적을 떠올리게 하는 말이 없다: 몇 번 안에 맞히라고 하지 않고, 기회나 횟수의 끝을 두지 않는다', () => {
  const pressure = /번 안에|안에 맞|몇 번 만에|기회|남은 횟수|횟수가 남|빨리|서둘|기록을 깨|최소|가장 적게/;
  for (const [path, text] of strings) assert.doesNotMatch(text, pressure, `${path}: ${text}`);
  // 처음 화면의 카드와 숫자 추리의 칸에 적은 글도 같다.
  const card = html.slice(html.indexOf('id="code-title"'), html.indexOf('id="make-title"'));
  assert.doesNotMatch(visibleText(card), pressure);
  const pad = html.slice(html.indexOf('id="code-pad"'), html.indexOf('id="leave-ask"'));
  assert.doesNotMatch(visibleText(pad), pressure);
  for (const ask of Object.values(T.home.ask)) assert.doesNotMatch(ask, /번|횟수/, ask);
});

test('힌트는 판의 종류마다 두 개이고, 하나하나가 질문 한 문장이다', () => {
  assert.deepEqual(Object.keys(T.hints).sort(), [...MODES].sort());
  for (const mode of MODES) {
    const hints = T.hints[mode];
    assert.equal(hints.length, tuningFor('code').hintCount, mode);
    assert.equal(hints.length, 2, mode);
    for (const hint of hints) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
    }
    assert.equal(new Set(hints).size, hints.length, `${mode}: 같은 힌트가 두 번 있어요`);
  }
  assert.match(html, /id="code-left"[^>]*>남은 후보 수 보기</);
  assert.match(html, /id="code-memo-open"[^>]*>메모판 쓰기</);
});

test('추측에는 두 수만 알려 준다: 맞다 틀리다를 붙이지 않고 다른 말을 덧붙이지 않는다', () => {
  assert.equal(sentenceCount(T.play.reply), 1);
  assert.equal(fill(T.play.reply, { hit: 2, place: 1 }), '들어 있는 숫자 2개, 자리도 맞는 것 1개예요.');
  assert.doesNotMatch(T.play.reply, /것 같아요|틀렸|아니에요|맞아요|아쉽|다시/);
  // 표의 머리글과 한 줄 글도 글과 수로 알린다.
  assert.deepEqual(T.heads, { no: '번호', guess: '추측', hit: '들어 있는 숫자', place: '자리도 맞는 것', left: '남은 후보' });
  assert.equal(fill(T.rowLine, { hit: 2, place: 1 }), '들어 있는 숫자 2개 · 자리도 맞는 것 1개');
  // 암호일 수 없는 추측을 냈다는 말은 대본 어디에도 없다(기록에만 남긴다).
  for (const [path, text] of strings) {
    if (path.startsWith('why') || path.startsWith('hints')) continue;
    assert.doesNotMatch(text, /헛걸음|쓸모없|소용없|암호일 수 없/, `${path}: ${text}`);
  }
});

test('틀린 답에 하는 말은 경우마다 하나씩 있고, 짐작이라고 밝히고, 판에서 견줘 보게 한다', () => {
  assert.deepEqual(Object.keys(T.guess).sort(), [...GUESS_KEYS].sort());
  for (const key of GUESS_KEYS) {
    assert.match(T.guess[key], /것 같아요/, key);
    assert.doesNotMatch(T.guess[key], /틀렸|아니에요|땡/, key);
    assert.doesNotMatch(T.guess[key], /좀 더 생각|다시 생각|잘 생각/, key);
    assert.match(T.guess[key], /까요\?$/, key);
    assert.equal(sentenceCount(T.guess[key]), 2, key);
  }
  // 표만 보고 알아내기: 어긋나는 줄을 가리킨다.
  assert.equal(fill(T.guess['table-row'], { no: ordinal(2) }), '2번째 줄의 답과 맞지 않는 것 같아요. 그 줄과 나란히 놓고 볼까요?');
  assert.equal(fill(T.guess['table-row'], { no: ordinal(1) }), '첫 번째 줄의 답과 맞지 않는 것 같아요. 그 줄과 나란히 놓고 볼까요?');
  assert.match(source, /fill\(T\.guess\['table-row'\], \{ no: ordinal\(row\) \}\)/);
  // 역할 바꾸기: 처음에는 암호와 추측을 나란히 놓고 하나씩 보자고 하고, 또 어긋나면 두 수 가운데 하나만 짚는다. 틀린 횟수는 말하지 않는다.
  assert.match(T.guess['referee-reply'], /^알려 준 두 수가 맞지 않는 것 같아요\./);
  assert.match(T.guess['referee-reply'], /나란히 놓고 숫자를 하나씩 볼까요\?$/);
  assert.match(T.guess['referee-hit'], /^들어 있는 숫자의 수가 다른 것 같아요\./);
  assert.match(T.guess['referee-place'], /^자리도 맞는 것의 수가 다른 것 같아요\./);
  // '견주다'는 3학년에게 어려운 말이라 쓰지 않는다("나란히 놓고 보기").
  for (const [path, text] of strings) assert.doesNotMatch(text, /견줘|견주/, `${path}: ${text}`);
  for (const key of GUESS_KEYS) assert.doesNotMatch(T.guess[key], /\{(?!no\})/, key);
  assert.ok(T.flag.length > 0);
});

test('어떻게 줄여 가는지는 "왜 그럴까?"에서만 말한다: 생각의 이름은 다른 글에 나오지 않는다', () => {
  const name = /후보 지우기/;
  for (const [path, text] of strings) {
    if (path.startsWith('why')) continue;
    assert.doesNotMatch(text, name, `${path}: ${text}`);
    assert.doesNotMatch(text, /남은 후보 가운데서/, `${path}: ${text}`);
  }
  assert.doesNotMatch(screenText, name);
  assert.match(T.why.map((slide) => slide.say).join(' '), name);
});

test('맞혔을 때 하는 말은 한 일을 말하고, 칭찬 낱말을 쓰지 않는다', () => {
  const praise = /최고|잘했|대단|훌륭|멋져|멋진|천재|똑똑|완벽|짱|굉장/;
  for (const [path, text] of strings) assert.doesNotMatch(text, praise, `${path}: ${text}`);
  assert.deepEqual(Object.keys(T.right).sort(), [...RIGHT_KEYS].sort());
  assert.equal(fill(T.right['guess-found'], { n: ordinal(4) }), '맞아요. 4번째 추측에서 암호를 알아냈어요.');
  assert.equal(fill(T.right['guess-found'], { n: ordinal(1) }), '맞아요. 첫 번째 추측에서 암호를 알아냈어요.');
  assert.ok(fill(T.right['table-tries'], { n: 3 }).includes('3번 넣어 보고'));
  assert.match(T.right['table-first'], /처음 넣은 암호/);
  // "맞아요"와 "맞는"을 되풀이하지 않는다.
  for (const key of ['table-first', 'table-tries']) assert.match(T.right[key], /^맞아요\. 표의 모든 줄과 어긋나지 않는 암호예요\./, key);
  assert.ok(fill(T.right['referee-found'], { n: ordinal(5) }).includes('5번째 추측'));
  assert.equal(fill(T.right['referee-found'], { n: ordinal(1) }), '선생님이 첫 번째 추측에서 암호를 맞혔어요.');
  // 차례("몇 번째")는 ordinal로 채운다. 1이면 "첫 번째"다.
  assert.match(source, /fill\(T\.right\['guess-found'\], \{ n: ordinal\(round\.rows\.length\) \}\)/);
  assert.match(source, /fill\(T\.right\['referee-found'\], \{ n: ordinal\(round\.rows\.length\) \}\)/);
  const [start, ...rest] = [720, 96, 12, 1].map((n) => fill(T.count, { n }));
  assert.equal(fill(T.right['referee-trail'], { start, trail: rest.join(T.trailJoin) }), '후보는 720개에서 96개, 12개, 1개로 차례차례 줄었어요.');
  // 수 뒤에는 늘 "개"가 붙으므로 "로"가 맞다.
  assert.match(T.count, /개$/);
});

test('풀이의 말은 그려지는 것과 맞는다: 줄이 없으면 표를 가리키지 않는다', () => {
  // 역할 바꾸기에서 암호만 정하고 아직 답한 줄이 없으면 표가 그려지지 않는다. 그때는 따로 말한다.
  assert.equal(T.solution['referee-unanswered'], '내 암호예요. 아직 선생님의 추측에 답하지 않았어요.');
  assert.equal(T.solution['referee-none'], '아직 암호를 정하지 않았어요. 그래서 선생님도 아직 추측하지 않았어요.');
  assert.match(T.solution.referee, /이렇게 줄었어요/);
  assert.match(source, /if \(rows\.length > 0\) view\.table = /);
  assert.match(source, /rows\.length > 0 \|\| table \? T\.solution\[round\.mode\] : T\.solution\[NONE_SAY\[round\.mode\]\]/);
  assert.match(source, /const NONE_SAY = \{ guess: 'guess-none', cards: 'cards-none', referee: 'referee-unanswered' \};/);
  // 표를 가리키는 말("표에", "이렇게")은 줄이 없을 때의 말에 없다.
  for (const key of ['guess-none', 'cards-none', 'referee-unanswered', 'referee-none']) assert.doesNotMatch(T.solution[key], /표에|이렇게/, key);
  // 판의 종류마다 풀이의 말이 있다. 한 번 거짓말하는 표의 풀이는 거짓인 줄을 가리킨다.
  for (const mode of MODES) assert.ok(T.solution[mode], mode);
  assert.match(T.solution.lie, /거짓인 줄에 표시/);
  assert.match(source, /if \(round\.mode === 'lie'\) view\.table = lieTable\(rows, solution\.lie\);/);
  assert.equal(T.lieMark, '거짓');
  // 역할 바꾸기를 시작할 때: 아이가 정한 것은 "내 암호"다.
  assert.match(T.play.secretSet, /^내 암호가 정해졌어요\./);
});

test('글의 빈칸({이름})은 정해진 이름만 쓴다', () => {
  const allowed = new Set(['n', 'no', 'hit', 'place', 'left', 'low', 'high', 'k', 'start', 'trail', 'pos', 'digit']);
  // 새 단계의 글도 정해진 이름만 쓴다(카드 맞히기의 답은 hit, 자리만 알려 주는 표의 답은 place).
  assert.equal(fill(T.lines.place.short, { place: 1 }), '자리 1개');
  assert.equal(fill(T.lines.cards.short, { hit: 2 }), '2장');
  assert.equal(fill(T.cardCount, { n: 2 }), '2장');
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
  }
});

test('화면 글에 영어 낱말이 없다', () => {
  for (const [path, text] of strings) {
    const plain = text.replace(/\{[^{}]*\}/g, '');
    assert.doesNotMatch(plain, /[A-Za-z]/, `${path}: ${text}`);
  }
  assert.doesNotMatch(screenText, /[A-Za-z]/);
});

test('화면 글은 "~요"로 끝나는 말투다(대본의 문장)', () => {
  const spoken = [
    ...Object.values(T.home.ask),
    T.home.pick,
    ...Object.values(T.rules),
    ...Object.values(T.play),
    ...MODES.flatMap((mode) => T.hints[mode]),
    ...Object.values(T.guess),
    ...Object.values(T.right),
    ...Object.values(T.solution),
    ...Object.entries(T.make)
      .filter(([key]) => key !== 'count')
      .map(([, text]) => text),
    ...T.why.map((slide) => slide.say),
  ];
  for (const text of spoken) for (const sentence of sentences(text)) assert.match(sentence, /요[.?!]$/, sentence);
  // 마침표 없이 쓰는 짧은 글도 "~요"로 끝난다.
  for (const text of T.why.flatMap((slide) => slide.figures.map((item) => item.note))) assert.match(text, /요$/, text);
});

test('한 문장에 한 가지 뜻: 문장이 너무 길지 않다(60자 이하)', () => {
  for (const [path, text] of strings) {
    for (const sentence of sentences(text)) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
  }
});

test('판 고르기의 그림: 단계마다 그 단계에서 하는 일에 맞는 그림이다(풀이 프로그램으로 확인)', () => {
  const picture = (level) => T.levels.find((entry) => entry.level === level).picture;
  // 1~3단계: 숨은 암호의 칸 수가 자릿수와 같다.
  for (const level of [1, 2, 3]) assert.equal(picture(level).hidden, rungOf(level).length, `${level}단계`);
  // 4단계: 표의 한 줄. 적어 둔 암호로 두 수를 매기면 그 줄의 답이 나온다.
  const sample = picture(4);
  assert.equal(checkCode(sample.row.guess, 3, rungOf(4).digits), null);
  assert.equal(checkCode(sample.secret, 3, rungOf(4).digits), null);
  assert.deepEqual(judge(sample.row.guess, sample.secret), { hit: sample.row.hit, place: sample.row.place });
  // 5단계: 아이가 정한 암호가 보인다. 9단계(직접 만들기): 빈 칸
  assert.equal(checkCode(picture(5).shown, rungOf(5).length, rungOf(5).digits), null);
  assert.equal(picture(MAKE_LEVEL).blank, 3);
  // 6단계: 자리가 맞는 것의 수만 적힌 줄 하나. 적어 둔 암호로 매기면 그 수가 나온다.
  const place = picture(6);
  assert.equal(checkCode(place.row.guess, 3, rungOf(6).digits), null);
  assert.equal(checkCode(place.secret, 3, rungOf(6).digits), null);
  assert.deepEqual(Object.keys(place.row).sort(), ['guess', 'place']);
  assert.equal(judge(place.row.guess, place.secret).place, place.row.place);
  // 7단계: 고른 카드 세 장과 숨은 카드의 수. 적어 둔 숨은 카드로 세면 그 수가 나온다.
  const cards = picture(7);
  assert.equal(checkSet(cards.cards, 3, rungOf(7).digits), null);
  assert.equal(checkSet(cards.secret, 3, rungOf(7).digits), null);
  assert.equal([...cards.cards].filter((ch) => cards.secret.includes(ch)).length, cards.hit);
  // 8단계: 두 줄 가운데 표시한 줄만 거짓이다(적어 둔 암호로 매기면).
  const lie = picture(8);
  for (const row of lie.rows) assert.equal(checkCode(row.guess, 3, rungOf(8).digits), null);
  assert.deepEqual(falseRows(lie.secret, lie.rows), [lie.lie]);
  assert.equal(T.hidden, '?');
  assert.ok(T.positions.length >= 4, '자리의 이름은 네 자리까지 있다');
});

test('"왜 그럴까?"는 그림 서너 장이고, 어떻게 알아챘는지의 이야기로 들려준다', () => {
  assert.ok(T.why.length >= 3 && T.why.length <= 4, `${T.why.length}장`);
  for (const slide of T.why) {
    assert.ok(slide.say.length > 0);
    assert.ok(slide.figures.length >= 1 && slide.figures.length <= 2);
    assert.ok(sentenceCount(slide.say) <= 3, slide.say);
  }
  // 줄거리: 아무 숫자나 냈다 → 다 적어 놓고 지워 봤다 → 하나도 없다는 답이 많이 알려 준다 → 남은 후보 가운데서 고른다
  assert.match(T.why[0].say, /처음에는 아무 숫자나 냈어요/);
  assert.match(T.why[0].say, /모두 적어 봤어요/);
  assert.match(T.why[1].say, /지워 봤더니/);
  assert.match(T.why[2].say, /0개/);
  assert.match(T.why[2].say, /통째로/);
  assert.match(T.why[3].say, /남은 후보 가운데서 골라서 냈어요/);
  // 남은 후보에서 고르는 것이 늘 가장 좋은 수는 아니다. "후보가 또 준다"까지만 말한다.
  assert.match(T.why[3].say, /후보가 또 줄어요/);
  assert.doesNotMatch(T.why[3].say, /헛걸음/);
  // 이야기의 말투: 선생님이 겪은 일로 말한다.
  assert.match(T.why[0].say, /^선생님도/);
});

test('"왜 그럴까?" 그림 속의 수는 풀이 프로그램이 센 것과 같다', () => {
  let checked = 0;
  for (const slide of T.why) {
    for (const item of slide.figures) {
      const where = item.note;
      const codes = allCodes(item.length, item.digits);
      for (const row of item.rows) assert.equal(checkCode(row.guess, item.length, item.digits), null, where);
      const { start, counts, left } = trailOf(item.length, item.digits, item.rows);
      assert.equal(start, item.start, where);
      assert.equal(start, codes.length, where);
      assert.deepEqual(counts, item.left, where);
      // 그림의 표와 맞는 암호가 하나는 있다(있을 수 없는 답을 보기로 들지 않는다).
      assert.ok(left.length >= 1, where);
      // 아래 글에 적은 수(마지막에 남은 후보 수)가 그림과 맞는다.
      const last = item.left.length > 0 ? item.left.at(-1) : item.start;
      assert.ok(item.note.includes(`${last}개`), `${where}: ${last}개`);
      // 늘어놓은 암호는 될 수 있는 암호의 맨 앞 몇 개다.
      if (item.list) assert.deepEqual(item.list, codes.slice(0, item.list.length), where);
      checked += 1;
    }
  }
  assert.equal(checked, 4);
  const [all, erased, none, pick] = T.why.map((slide) => slide.figures[0]);
  // 1장: 될 수 있는 암호 120개
  assert.match(all.note, /숫자 1부터 6까지로 만드는 세 자리 암호는 120개/);
  assert.equal(allCodes(3, '123456').length, 120);
  // 2장: 추측 하나로 120개가 36개로 줄었다
  assert.match(erased.note, /120개 가운데 36개만/);
  assert.equal(filterCodes(allCodes(3, '123456'), erased.rows).length, 36);
  // 3장: "하나도 없다"는 답은 낸 숫자 셋을 통째로 뺀다. 남는 것은 4, 5, 6으로 만든 6개다.
  assert.deepEqual(none.rows, [{ guess: '123', hit: 0, place: 0 }]);
  assert.deepEqual(filterCodes(allCodes(3, '123456'), none.rows), allCodes(3, '456'));
  assert.match(none.note, /4, 5, 6으로 만든 6개/);
  // 같은 추측에 "하나 들어 있다"는 답(2장)보다 "하나도 없다"는 답(3장)이 더 많이 지운다.
  assert.equal(none.rows[0].guess, erased.rows[0].guess);
  assert.ok(none.left[0] < erased.left[0]);
  // 4장: 둘째 추측은 첫 답과 맞는 후보 가운데 하나이고, 암호가 아니어도 후보가 줄었다.
  const afterFirst = filterCodes(allCodes(3, '123456'), pick.rows.slice(0, 1));
  assert.ok(afterFirst.includes(pick.rows[1].guess));
  assert.deepEqual(pick.left, [6, 3]);
  assert.match(pick.note, /남은 6개 가운데 하나를 냈더니 3개로/);
  // 남은 후보 가운데서 낸 추측은 암호가 아니면 적어도 그 추측 하나는 지워진다(모든 암호, 모든 후보에서 확인).
  for (const secret of afterFirst) {
    for (const guess of afterFirst) {
      if (guess === secret) continue;
      const next = filterCodes(afterFirst, [{ guess, ...judge(guess, secret) }]);
      assert.ok(next.length < afterFirst.length && next.includes(secret) && !next.includes(guess));
    }
  }
});

test('index.html: 숫자 추리의 카드, 숫자판, 메모판, 직접 만들기가 있다', () => {
  for (const id of [
    'home-code-sample',
    'home-code-ask',
    'home-code-play',
    'home-code-pick',
    'home-code-make',
    'home-code-blank',
    'code-board',
    'code-table',
    'code-memo',
    'code-memo-rows',
    'code-pad',
    'code-enter',
    'code-slots',
    'code-keys',
    'code-submit',
    'code-reply',
    'code-reply-hit',
    'code-reply-place',
    'make-code',
    'code-make-board',
    'code-make-keys',
  ]) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  // 숫자판: 숫자 열 개와 지우기(두 군데: 판 화면과 직접 만들기)
  for (let digit = 0; digit <= 9; digit++) assert.equal([...html.matchAll(new RegExp(`data-digit="${digit}"`, 'g'))].length, 2, `숫자 ${digit}`);
  assert.equal([...html.matchAll(/data-digit="erase"[^>]*>지우기</g)].length, 2);
  assert.match(html, /id="code-reply-submit"[^>]*>알려 주기</);
  assert.match(html, /id="code-make-add"[^>]*>줄 넣기</);
  assert.match(html, /id="code-make-solve"[^>]*>선생님, 풀어 보세요</);
  assert.match(html, /id="code-make-play"[^>]*>내가 해 볼래요</);
  assert.match(html, /id="code-memo-clear"[^>]*>메모 모두 지우기</);
  for (const label of ['숫자 추리', '메모판', '마지막 줄 지우기', '줄 모두 지우기', '두 수를 알려 주세요']) assert.ok(screenText.includes(label), label);
  for (const digits of MAKE_DIGITS) assert.ok(html.includes(`data-digits="${digits}"`), digits);
  // 처음 화면의 물음은 대본에 있는 것과 같은 글로 시작한다.
  assert.ok(screenText.includes(T.home.ask.guess));
  // 처음 화면의 카드는 여섯이다. 퍼즐 만들기의 "만들기" 목록에는 형식마다 단추가 하나씩 있다.
  assert.equal([...html.matchAll(/class="panel door[ "]/g)].length, 53);
  const make = html.slice(html.indexOf('id="make-title"'), html.indexOf('id="picker"'));
  for (const id of ['home-make', 'home-trace-make', 'home-code-make', 'home-swap-make', 'home-tile-make']) assert.ok(make.includes(`id="${id}"`), id);
  // 대본의 단추 글자
  for (const key of ['guessTitle', 'guessSubmit', 'tableTitle', 'tableSubmit', 'secretTitle', 'secretSubmit', 'cardsTitle', 'cardsSubmit']) assert.ok(T.pad[key], key);
  // 메모판의 안내 글: 카드 맞히기에서는 대본의 글로 바꿔 적는다.
  assert.match(html, /<span id="code-memo-note">그 자리에 오지 않을 것 같은 숫자를 눌러요\. 다시 누르면 돌아와요\.<\/span>/);
  assert.match(T.cardsMemoNote, /^숨은 카드가 아닐 것 같은 카드를 눌러요\./);
});

// ---- 수준 맞추기 ----
let nextId = 0;
function code(overrides = {}) {
  nextId += 1;
  return {
    kind: 'round',
    id: `c${nextId}`,
    format: 'code',
    level: 2,
    seed: nextId,
    custom: false,
    mode: 'guess',
    outcome: 'solved',
    hintsOpened: 0,
    answers: [{ t: 60, answer: '601', correct: true, guess: null }],
    guessCount: 5,
    wrongCount: null,
    seconds: 90,
    solution: { possible: true, secret: '601', start: 720 },
    ...overrides,
  };
}

test('숫자 추리의 수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 2단계다', () => {
  const tuning = tuningFor('code');
  assert.equal(tuning.startLevel, 2);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 8);
  assert.equal(tuning.topLevel, TOP_LEVEL);
  assert.equal(tuning.hintCount, 2);
  for (const rung of LADDER.filter((item) => item.mode !== 'make')) assert.ok(tuning.expectedSeconds[rung.level] > 0, `${rung.level}단계의 예상 시간`);
  // 추측을 내서 알아내는 단계에는 "적은 추측"의 기준이 있다. 단계가 올라가면 기준도 늘어난다.
  assert.deepEqual(Object.keys(tuning.fastGuesses), ['1', '2', '3', '7']);
  assert.ok(tuning.fastGuesses[1] < tuning.fastGuesses[2] && tuning.fastGuesses[2] < tuning.fastGuesses[3]);
  // 물어서 알아내는 판(추측해서 알아내기와 카드 맞히기)에만 있다.
  for (const rung of LADDER) assert.equal(rung.level in tuning.fastGuesses, rung.mode === 'guess' || rung.mode === 'cards', `${rung.level}단계`);
  assert.deepEqual(recommend([], 'code'), { level: 2, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  assert.equal(generateBoard(recommend([], 'code').level, 1).board.mode, 'guess');
  // 다른 형식의 값은 그대로다.
  assert.equal(tuningFor('coins').fastGuesses, undefined);
  assert.equal(tuningFor('trace').fastGuesses, undefined);
  assert.equal(tuningFor('coins').startLevel, TUNING.startLevel);
  assert.equal(tuningFor('trace').startLevel, 1);
});

test('게임 판은 추측 횟수가 적은 것을 "빠르게"로 본다(걸린 시간은 보지 않는다)', () => {
  const few = tuningFor('code').fastGuesses[2];
  const fast = () => code({ guessCount: few, seconds: 9999 });
  assert.deepEqual(recommend([fast(), fast()], 'code'), { level: 2, small: false, offerHarder: true, harderLevel: 3, reason: 'fast' });
  assert.equal(recommend([fast()], 'code').offerHarder, false, '한 판으로는 권하지 않는다');
  assert.equal(recommend([fast(), code({ guessCount: few + 1, seconds: 10 })], 'code').offerHarder, false, '추측이 많으면 빨리 끝내도 권하지 않는다');
  assert.equal(recommend([fast(), code({ guessCount: few, hintsOpened: 1 })], 'code').offerHarder, false, '힌트(남은 후보 수 보기도)를 열었으면 권하지 않는다');
  assert.equal(recommend([fast(), code({ level: 1, guessCount: 2 })], 'code').offerHarder, false, '같은 단계를 연달아 해야 한다');
});

test('표만 보고 알아내기와 역할 바꾸기는 틀린 답 없이, 예상 시간보다 빠르게 끝낸 것을 본다', () => {
  const limit = tuningFor('code').expectedSeconds[4];
  const table = (overrides = {}) => code({ level: 4, mode: 'table', guessCount: 1, wrongCount: 0, seconds: limit - 1, ...overrides });
  assert.deepEqual(recommend([table(), table()], 'code'), { level: 4, small: false, offerHarder: true, harderLevel: 5, reason: 'fast' });
  assert.equal(recommend([table(), table({ wrongCount: 1, guessCount: 2 })], 'code').offerHarder, false);
  assert.equal(recommend([table(), table({ seconds: limit })], 'code').offerHarder, false);
  // 역할 바꾸기는 답을 여러 번 주고받는다. 어긋난 답이 없으면 "한 번에"다. 맨 위 단계에서는 직접 만들기를 가리킨다.
  const referee = (overrides = {}) =>
    code({ level: 5, mode: 'referee', guessCount: 5, wrongCount: 0, seconds: 100, answers: [1, 2, 3, 4, 5].map((t) => ({ t, answer: '1-0', correct: true, guess: null })), ...overrides });
  assert.deepEqual(recommend([referee(), referee()], 'code'), { level: 5, small: false, offerHarder: true, harderLevel: 6, reason: 'fast' });
  assert.equal(recommend([referee(), referee({ wrongCount: 2 })], 'code').offerHarder, false);
  // 6·8단계도 표만 보고 알아내는 판처럼 본다. 맨 위(8단계)에서는 직접 만들기(9단계)를 가리킨다.
  const place = (overrides = {}) => table({ level: 6, mode: 'place', ...overrides });
  assert.deepEqual(recommend([place(), place()], 'code'), { level: 6, small: false, offerHarder: true, harderLevel: 7, reason: 'fast' });
  const lie = (overrides = {}) => table({ level: 8, mode: 'lie', seconds: tuningFor('code').expectedSeconds[8] - 1, ...overrides });
  assert.deepEqual(recommend([lie(), lie()], 'code'), { level: 8, small: false, offerHarder: true, harderLevel: 9, reason: 'fast' });
  assert.equal(recommend([lie(), lie({ wrongCount: 1, guessCount: 2 })], 'code').offerHarder, false);
  // 7단계(카드 맞히기)는 물은 횟수를 본다.
  const few = tuningFor('code').fastGuesses[7];
  const cards = (guessCount) => code({ level: 7, mode: 'cards', guessCount, seconds: 9999 });
  assert.equal(recommend([cards(few), cards(few)], 'code').offerHarder, true);
  assert.equal(recommend([cards(few), cards(few + 1)], 'code').offerHarder, false);
});

test('그만두기가 이어지면 조용히 한 단계 아래를 먼저 보여 준다. 맨 아래에서는 작은 판이다', () => {
  const quit = (level) => code({ level, outcome: 'left', answers: [], guessCount: 3 });
  assert.deepEqual(recommend([quit(3), quit(3)], 'code'), { level: 2, small: false, offerHarder: false, harderLevel: null, reason: 'quit' });
  assert.deepEqual(recommend([quit(1), quit(1)], 'code'), { level: 1, small: true, offerHarder: false, harderLevel: null, reason: 'quit' });
  assert.equal(recommend([quit(3)], 'code').reason, 'steady');
  // 힌트를 다 열고도 못 풀었으면 한 판으로도 내려간다.
  assert.equal(recommend([code({ level: 4, mode: 'table', outcome: 'left', answers: [], guessCount: 0, hintsOpened: 2 })], 'code').level, 3);
  // 들여다보기만 한 판(추측도, 답도, 힌트도 없다)은 세지 않는다. 직접 만든 표도 세지 않는다.
  const peek = () => code({ level: 3, outcome: 'left', answers: [], guessCount: 0 });
  assert.equal(recommend([peek(), peek()], 'code').reason, 'start');
  // 예전의 직접 만들기 단계(6단계)에서 푼 표도 지금의 6단계(자리만 알려 주는 표)로 세지 않는다. 지금의 9단계도 그렇다.
  const custom = (level = OLD_MAKE_LEVEL) => code({ level, custom: true, outcome: 'left', answers: [], guessCount: 2 });
  assert.equal(recommend([custom(), custom()], 'code').reason, 'start');
  assert.equal(recommend([custom(MAKE_LEVEL), custom(MAKE_LEVEL)], 'code').reason, 'start');
  // 다른 형식의 기록은 영향을 주지 않는다.
  assert.equal(recommend([quit(3), quit(3)], 'coins').reason, 'start');
  assert.equal(recommend([quit(3), quit(3)], 'trace').reason, 'start');
});

test('"왜 그럴까?"는 이 형식의 판을 한 번 끝까지 한 뒤에 열린다', () => {
  assert.equal(whyUnlocked([], 'code'), false);
  assert.equal(whyUnlocked([code({ outcome: 'left', answers: [] })], 'code'), false, '나가기만 한 판');
  assert.equal(whyUnlocked([code()], 'code'), true, '맞힌 판');
  assert.equal(whyUnlocked([code({ outcome: 'solution' })], 'code'), true, '그만두고 풀이를 본 판');
  assert.equal(whyUnlocked([{ kind: 'made', id: 'm1', format: 'code' }], 'code'), false);
  // 다른 형식은 그대로: 안 되는 판을 만난 뒤에 열린다.
  assert.equal(whyUnlocked([code()], 'coins'), false);
  assert.equal(whyUnlocked([code()], 'trace'), false);
  assert.equal(whyUnlocked([{ ...code(), format: 'coins' }], 'coins'), false, '되는 판만 한 동전 뒤집기');
  assert.equal(whyUnlocked([{ ...code(), format: 'coins', solution: { possible: false, min: null } }], 'coins'), true);
});

test('새 단계의 말: 카드 맞히기는 몇 장인지만 알려 주고, 한 번 거짓말하는 표는 거짓인 줄을 말한다', () => {
  // 카드 맞히기: 숨은 카드가 몇 장인지만 말하고 다른 말을 덧붙이지 않는다.
  assert.equal(fill(T.play.cards, { hit: 2 }), '고른 카드 가운데 숨은 카드는 2장이에요.');
  assert.equal(sentenceCount(T.play.cards), 1);
  assert.doesNotMatch(T.play.cards, /것 같아요|틀렸|아니에요|맞아요|아쉽|다시/);
  assert.match(source, /frame\.say\(cards \? fill\(T\.play\.cards, \{ hit: row\.hit \}\) : fill\(T\.play\.reply, \{ hit: row\.hit, place: row\.place \}\)\)/);
  assert.equal(fill(T.right['cards-found'], { n: ordinal(5) }), '맞아요. 5번째 물음에서 숨은 카드를 모두 찾았어요.');
  assert.match(source, /fill\(T\.right\['cards-found'\], \{ n: ordinal\(round\.rows\.length\) \}\)/);
  // 한 번 거짓말하는 표: 맞히면 몇 번째 줄이 거짓이었는지 말한다.
  assert.equal(fill(T.right['lie-first'], { no: ordinal(1) }), '맞아요. 이 암호라면 거짓인 줄은 첫 번째 줄 하나뿐이에요. 처음 넣은 암호로 찾았어요.');
  assert.equal(fill(T.right['lie-tries'], { no: ordinal(3), n: 2 }), '맞아요. 이 암호라면 거짓인 줄은 3번째 줄 하나뿐이에요. 2번 넣어 보고 찾았어요.');
  // 틀린 답: 거짓인 줄이 둘이 되면 그 두 줄에 표시하고, 모두 참이 되면 그렇다고만 한다. 몇 번째 줄인지는 표에 표시로 보인다.
  assert.match(T.guess['lie-two'], /^이 암호라면 거짓인 줄이 둘이 되는 것 같아요\./);
  assert.match(T.guess['lie-none'], /^이 암호라면 표의 줄이 모두 참이 되는 것 같아요\./);
  // 머리글: 자리만 알려 주는 표는 한 칸, 카드 맞히기는 고른 카드와 숨은 카드
  assert.deepEqual(T.headsBy, { place: { place: '자리가 맞는 것' }, cards: { guess: '고른 카드', hit: '숨은 카드' } });
  // 카드 맞히기의 메모판은 카드 한 줄이다.
  assert.match(source, /const memoRowsOf = \(board\) => \(board\.mode === 'cards' \? 1 : board\.length\);/);
});

test('하던 판: 단계와 판의 종류가 맞아야 받는다. 예전의 직접 만들기 단계(6단계)에 적어 둔 직접 만든 표도 그대로 받는다', () => {
  assert.match(source, /if \(saved\.custom === true\) return \[MAKE_LEVEL, OLD_MAKE_LEVEL\]\.includes\(saved\.level\) && saved\.mode === 'table';/);
  assert.match(source, /saved\.level <= TOP_LEVEL && rungOf\(saved\.level\)\.mode === saved\.mode/);
  assert.match(source, /saved\.mode !== saved\.board\.mode \|\| !levelOk\(saved\)/);
  assert.equal(OLD_MAKE_LEVEL, 6);
  assert.equal(rungOf(OLD_MAKE_LEVEL).mode, 'place');
  assert.equal(generateBoard(OLD_MAKE_LEVEL, 1).board.mode, 'place');
});
