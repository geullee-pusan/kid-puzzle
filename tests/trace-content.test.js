// 한붓그리기 대본 점검: 화면에 나오는 글이 약속을 지키는지, 그림 속 보기가 풀이 프로그램과 맞는지 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { TUNING, tuningFor } from '../src/core/level.js';
import { fill, sentenceCount } from '../src/core/text.js';
import { LADDER, MAKE_LEVEL } from '../src/core/trace-ladder.js';
import { applyEdit, checkFigure, degreesOf, isTidy, solve, walk } from '../src/core/trace.js';
import { bruteStarts } from './helpers/brute.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const T = JSON.parse(readFileSync(resolve(ROOT, 'src/content/trace.json'), 'utf8'));
const C = JSON.parse(readFileSync(resolve(ROOT, 'src/content/coins.json'), 'utf8'));
const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');

const MODES = ['draw', 'judge', 'start', 'fix'];
const GUESS_KEYS = [
  'impossible-no-try',
  'impossible-untried-start',
  'impossible-other-route',
  'judge-no-on-possible',
  'judge-yes-on-impossible',
  'start-wrong',
  'fix-split',
  'fix-still-impossible',
];

/** 대본의 모든 글(값)을 길과 함께 모은다. 설명(_로 시작하는 것)은 뺀다. 그림의 점과 선은 수라서 들어오지 않는다. */
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

test('대본을 읽을 수 있고, 글이 비어 있지 않다', () => {
  assert.ok(strings.length > 60);
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.equal(T.title, '한붓그리기');
});

test('단계 목록이 사다리와 같고, 표시는 기본·응용·도전이다', () => {
  assert.deepEqual(T.levels.map((entry) => entry.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(LADDER.map((rung) => C.tags[rung.tag]), ['기본', '응용', '응용', '도전', '도전']);
  assert.equal(T.levels.at(-1).level, MAKE_LEVEL);
  assert.equal(T.levels.at(-1).name, '직접 만들기');
});

test('판의 종류마다 규칙 설명이 있고, 세 문장을 넘지 않는다', () => {
  assert.deepEqual(Object.keys(T.rules).sort(), [...MODES].sort());
  for (const mode of MODES) assert.ok(sentenceCount(T.rules[mode]) <= 3, `${mode}: ${T.rules[mode]}`);
  // 직접 만들기 화면의 안내 글도 같다. 안 되는 그림을 만들어 보라고 권한다.
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 6, '직접 만들기 안내 글은 형식마다 하나');
  for (const guide of guides) assert.ok(sentenceCount(guide) <= 3, guide);
  assert.match(guides[1], /점이 여섯 개인데 안 되는 그림도 만들 수 있을까요\?/);
});

test('힌트는 판의 종류마다 두 개이고, 하나하나가 질문 한 문장이다', () => {
  assert.deepEqual(Object.keys(T.hints).sort(), [...MODES].sort());
  for (const mode of MODES) {
    const hints = T.hints[mode];
    assert.equal(hints.length, tuningFor('trace').hintCount, mode);
    assert.equal(hints.length, 2, mode);
    for (const hint of hints) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
    }
    assert.equal(new Set(hints).size, hints.length, `${mode}: 같은 힌트가 두 번 있어요`);
  }
  assert.ok(screenText.includes('점마다 선의 수 보기'));
  assert.match(html, /id="trace-degrees"[^>]*>점마다 선의 수 보기</);
});

test('틀린 답에 하는 말은 경우마다 하나씩 있고, 짐작이라고 밝힌다("~것 같아요")', () => {
  assert.deepEqual(Object.keys(T.guess).sort(), [...GUESS_KEYS].sort());
  for (const key of GUESS_KEYS) {
    assert.match(T.guess[key], /것 같아요/, key);
    assert.doesNotMatch(T.guess[key], /틀렸|아니에요|땡/, key);
    // 빈말로 돌려 말하지 않는다. 판에서 해 볼 것을 권한다.
    assert.doesNotMatch(T.guess[key], /좀 더 생각|다시 생각|잘 생각/, key);
    assert.match(T.guess[key], /까요\?$/, key);
  }
  assert.match(T.guess['impossible-untried-start'], /시작/);
  assert.match(T.guess['judge-no-on-possible'], /직접 그어/);
  assert.match(T.guess['judge-yes-on-impossible'], /직접 그어/);
  assert.match(T.guess['start-wrong'], /어디서 막히는지/);
});

test('까닭은 "왜 그럴까?"에서만 말한다: 다른 글에는 홀수, 짝수, 선이 모인 수의 규칙이 나오지 않는다', () => {
  const reason = /홀수|짝수|홀짝|짝을|들어온|들어오|나가는|나간/;
  for (const [path, text] of strings) {
    if (path.startsWith('why')) continue;
    assert.doesNotMatch(text, reason, `${path}: ${text}`);
  }
  assert.doesNotMatch(screenText, /홀수|짝수|홀짝/);
  // 막혔을 때는 사실만 말한다.
  assert.match(T.stuck, /막혔어요/);
  assert.match(T.stuck, /무르/);
  assert.doesNotMatch(T.stuck, /것 같아요|왜/);
  // 생각의 이름은 "왜 그럴까?" 안에서 처음 나온다.
  assert.match(T.why.map((slide) => slide.say).join(' '), /홀수/);
  assert.match(T.why.map((slide) => slide.say).join(' '), /짝수/);
});

test('맞혔을 때 하는 말은 한 일을 말하고, 칭찬 낱말을 쓰지 않는다', () => {
  const praise = /최고|잘했|대단|훌륭|멋져|멋진|천재|똑똑|완벽|짱|굉장/;
  for (const [path, text] of strings) assert.doesNotMatch(text, praise, `${path}: ${text}`);
  const keys = ['traced-clean', 'traced-back', 'impossible-tried', 'impossible-some', 'impossible-untried', 'judge-yes', 'judge-no', 'no-stroke', 'check-invite', 'start-right', 'fix-add', 'fix-remove', 'fix-traced', 'after-retry', 'why-invite'];
  assert.deepEqual(Object.keys(T.right).sort(), [...keys].sort());
  assert.ok(fill(T.right['traced-back'], { u: 3, m: 7 }).includes('3번'));
  assert.ok(fill(T.right['traced-back'], { u: 3, m: 7 }).includes('7개'));
  assert.ok(fill(T.right['traced-clean'], { m: 7 }).includes('무르지 않고'));
  assert.ok(fill(T.right['impossible-tried'], { s: 4 }).includes('4번 막혀'));
  assert.match(T.right['no-stroke'], /긋지 않고/);
});

test('글의 빈칸({이름})은 정해진 이름만 쓴다', () => {
  const allowed = new Set(['no', 'a', 'b', 'n', 'm', 'u', 's']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
  }
});

test('화면 글에 영어 낱말이 없다', () => {
  for (const [path, text] of strings) {
    const plain = text.replace(/\{[^{}]*\}/g, '');
    assert.doesNotMatch(plain, /[A-Za-z]/, `${path}: ${text}`);
  }
});

test('화면 글은 "~요"로 끝나는 말투다(대본의 문장)', () => {
  const spoken = [
    ...Object.values(T.home.ask),
    T.home.pick,
    ...Object.values(T.rules),
    ...Object.values(T.play),
    T.stuck,
    ...Object.values(T.blocked),
    ...Object.values(T.pad),
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
  for (const text of [...Object.values(T.status), ...T.why.flatMap((slide) => slide.figures.map((item) => item.note))]) {
    for (const sentence of sentences(text)) assert.match(sentence, /요[.?!]?$/, sentence);
  }
});

test('한 문장에 한 가지 뜻: 문장이 너무 길지 않다(60자 이하)', () => {
  for (const [path, text] of strings) {
    for (const sentence of sentences(text)) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
  }
});

test('판 고르기의 그림: 단계마다 그 단계에서 하는 일에 맞는 그림이다(풀이 프로그램으로 확인)', () => {
  for (const rung of LADDER) {
    const picture = T.levels.find((entry) => entry.level === rung.level).picture;
    assert.ok(picture, `${rung.level}단계의 그림`);
    if (rung.mode === 'make') {
      assert.equal(picture.blank, true);
      continue;
    }
    assert.equal(checkFigure(picture), null, `${rung.level}단계`);
    assert.ok(isTidy(picture), `${rung.level}단계`);
  }
  const picture = (level) => T.levels.find((entry) => entry.level === level).picture;
  // 1단계: 되는 그림을 긋는 중이고, 그 길로 끝까지 갈 수 있다.
  const drawing = walk(picture(1), picture(1).path);
  assert.ok(drawing.ok && !drawing.complete && !drawing.stuck);
  assert.ok(solve(picture(1)).starts.includes(picture(1).path[0]));
  // 2단계: 조금 큰 그림(점 6개 이상)
  assert.ok(picture(2).points.length >= 6);
  // 3단계: 시작할 수 있는 점이 꼭 둘인 그림. 그림에서 골라 둔 점은 답이 아니다(답을 알려 주지 않는다).
  assert.equal(solve(picture(3)).starts.length, 2);
  assert.deepEqual(bruteStarts(picture(3)), solve(picture(3)).starts);
  for (const point of picture(3).picked) assert.ok(!solve(picture(3)).starts.includes(point));
  // 4단계: 안 되는 그림이고, 그림에서 뺀 선을 빼면 되는 그림이 된다.
  assert.equal(solve(picture(4)).possible, false);
  const fixed = applyEdit(picture(4), { type: 'remove', edge: picture(4).gone });
  assert.equal(solve(fixed).possible, true);
  assert.ok(bruteStarts(fixed).length > 0);
});

test('"왜 그럴까?"는 그림 서너 장이고, 어떻게 알아챘는지의 이야기로 들려준다', () => {
  assert.ok(T.why.length >= 3 && T.why.length <= 4, `${T.why.length}장`);
  for (const slide of T.why) {
    assert.ok(slide.say.length > 0);
    assert.ok(slide.figures.length >= 1 && slide.figures.length <= 2);
    assert.ok(sentenceCount(slide.say) <= 3, slide.say);
  }
  // 이야기: 막혀 보고, 살펴봤더니 …
  assert.match(T.why[0].say, /막혀 봤어요/);
  assert.match(T.why[0].say, /살펴봤어요/);
  assert.match(T.why.at(-1).say, /다시 봤더니/);
  // 줄거리: 지나가는 점은 짝수 → 홀수인 점은 시작이나 끝 → 없거나 둘이면 되고 → 넷이면 안 된다
  assert.match(T.why[1].say, /짝수/);
  assert.match(T.why[1].say, /시작하는 점이거나 끝나는 점/);
  assert.match(T.why[2].say, /둘이면/);
  assert.match(T.why[2].say, /하나도 없으면/);
  assert.match(T.why[3].say, /넷/);
});

test('"왜 그럴까?" 그림 속의 보기는 풀이 프로그램으로도, 다 해 보는 탐색으로도 맞다', () => {
  let checked = 0;
  for (const slide of T.why) {
    for (const item of slide.figures) {
      const where = item.note;
      assert.equal(checkFigure(item), null, where);
      assert.ok(isTidy(item), where);
      const result = solve(item);
      const brute = bruteStarts(item);
      assert.equal(result.possible, brute.length > 0, where);
      if (item.degrees) assert.deepEqual(degreesOf(item), item.degrees, where);
      if (item.odd) assert.deepEqual(result.odd, item.odd, where);
      if (item.possible !== undefined) assert.equal(result.possible, item.possible, where);
      if (item.path) {
        // 그림에 적은 차례는 끝까지 가는 길이다.
        const state = walk(item, item.path);
        assert.ok(state.ok && state.complete, where);
        assert.ok(brute.includes(item.path[0]), where);
        // 홀수 개 모인 점이 둘이면 그 두 점에서 시작하고 끝난다.
        if (result.odd.length === 2) assert.deepEqual([item.path[0], item.path.at(-1)].sort(), result.odd, where);
      }
      if (item.through !== undefined) {
        // "가운데 점을 2번 지나갔어요": 길의 처음과 끝이 아닌 자리에 그 점이 그만큼 나온다.
        const inside = item.path.slice(1, -1).filter((point) => point === item.through).length;
        assert.equal(inside, item.passes, where);
        assert.equal(degreesOf(item)[item.through], 2 * item.passes, where);
        assert.ok(item.note.includes(`${item.passes}번`) && item.note.includes(`${item.passes}개`), where);
      }
      checked += 1;
    }
  }
  assert.ok(checked >= 4);
  // 글에 적은 수가 그림과 맞는다.
  const two = T.why[1].figures[0];
  assert.match(two.note, /3개 모인 점이 둘/);
  assert.equal(two.degrees.filter((degree) => degree === 3).length, 2);
  const none = T.why[2].figures[1];
  assert.match(none.note, /홀수 개 모인 점이 없어요/);
  assert.deepEqual(solve(none).starts, [0, 1, 2, 3, 4], '어디서 시작해도 된다');
  const four = T.why[3].figures[0];
  assert.match(four.note, /3개 모인 점이 넷/);
  assert.equal(four.degrees.filter((degree) => degree === 3).length, 4);
  assert.deepEqual(bruteStarts(four), [], '어디서 시작해도 막힌다');
});

test('index.html: 한붓그리기의 카드, 답하는 단추, 직접 만들기가 있다', () => {
  for (const id of [
    'home-trace-sample',
    'home-trace-ask',
    'home-trace-play',
    'home-trace-pick',
    'home-trace-make',
    'home-trace-blank',
    'trace-board',
    'trace-pad',
    'trace-draw',
    'trace-judge',
    'trace-start',
    'trace-fix',
    'trace-make-board',
    'make-coins',
    'make-trace',
  ]) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(html, /id="trace-impossible"[^>]*>불가능해요</);
  assert.match(html, /id="trace-yes"[^>]*>돼요</);
  assert.match(html, /id="trace-no"[^>]*>안 돼요</);
  assert.match(html, /id="trace-make-solve"[^>]*>선생님, 풀어 보세요</);
  assert.match(html, /id="trace-make-play"[^>]*>내가 해 볼래요</);
  for (const label of ['한붓그리기', '이 점에서 시작할래요', '다 고쳤어요', '고친 것 되돌리기', '선 모두 지우기']) assert.ok(screenText.includes(label), label);
  // 처음 화면의 물음은 대본에 있는 것과 같은 글로 시작한다.
  assert.ok(screenText.includes(T.home.ask.draw));
  // 처음 화면의 카드는 여섯이다: 동전 뒤집기, 한붓그리기, 숫자 추리, 자리 바꾸기, 조각 덮기, 퍼즐 만들기
  assert.equal([...html.matchAll(/class="panel door[ "]/g)].length, 7);
});

test('한붓그리기의 수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다', () => {
  const tuning = tuningFor('trace');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.topLevel, 4);
  for (const rung of LADDER.filter((item) => item.mode !== 'make')) assert.ok(tuning.expectedSeconds[rung.level] > 0, `${rung.level}단계의 예상 시간`);
  // 동전 뒤집기의 값은 그대로다.
  assert.equal(tuningFor('coins').startLevel, TUNING.startLevel);
  assert.equal(tuningFor('coins').topLevel, 5);
});
