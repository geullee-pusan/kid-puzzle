// 자리 바꾸기 대본 점검: 화면에 나오는 글이 약속을 지키는지, 그림 속의 수가 풀이 프로그램과 맞는지 본다.
// 이 형식부터 새로 지키는 것(첫 단계는 실패할 수 없다, 힌트는 두 높이, 막혔을 때는 본 것 하나와 할 수 있는 일 하나,
// "왜 그럴까?"는 알아챈 이야기, 몇몇 판에는 까닭을 붙이지 않는다)도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { TUNING, recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { LADDER, MAKE_LEVEL, OLD_MAKE_LEVEL, generateBoard, rungOf } from '../src/core/swap-ladder.js';
import { MAX_FROGS, SKIPS, allWays, checkBoard, deadEnds, isDone, isStuck, movesOf, replay, solve, stuckKind } from '../src/core/swap.js';
import { fill, ordinal, sentenceCount } from '../src/core/text.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/swap.json'));
const C = JSON.parse(read('src/content/coins.json'));
const html = read('index.html');
const css = read('src/app.css');

const MODES = ['frogs', 'fewest', 'pairs', 'carry', 'threes'];
const GUESS_KEYS = ['impossible-no-try', 'impossible-same-first', 'impossible-other-way'];
const STUCK_KEYS = ['plain', 'pair-again', 'same', 'same-start', 'pairs', 'pairs-same', 'pairs-same-start', 'threes'];
const RIGHT_KEYS = [
  'swapped-clean',
  'swapped-back',
  'swapped-reset',
  'resets',
  'fewest',
  'fewest-after',
  'stopped',
  'paired-clean',
  'paired-back',
  'impossible-tried',
  'impossible-some',
  'impossible-untried',
  'carry-fewest',
  'carry-stopped',
  'piled-clean',
  'piled-back',
  'impossible-threes-tried',
  'impossible-threes-some',
  'impossible-threes-untried',
  'after-retry',
  'why-invite',
];

/** 대본의 모든 글(값)을 길과 함께 모은다. 설명(_로 시작하는 것)은 뺀다. */
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
const part = (from, to) => html.slice(html.indexOf(from), html.indexOf(to, html.indexOf(from)));
const frogs = (left, right) => ({ kind: 'frogs', left, right });

test('대본을 읽을 수 있고, 글이 비어 있지 않다', () => {
  assert.ok(strings.length > 70);
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.equal(T.title, '자리 바꾸기');
});

test('단계 목록이 사다리와 같고, 표시는 기본·응용·응용·도전·응용·도전·도전이다', () => {
  assert.deepEqual(T.levels.map((entry) => entry.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(LADDER.map((rung) => C.tags[rung.tag]), ['기본', '응용', '응용', '도전', '응용', '도전', '도전']);
  assert.equal(T.levels[4].name, '둘씩 묶어 옮기기');
  assert.equal(T.levels[5].name, '셋씩 쌓기');
  assert.equal(T.levels.at(-1).level, MAKE_LEVEL);
  assert.equal(T.levels.at(-1).name, '직접 만들기');
  assert.match(T.levels[2].name, /무르지 않고/);
  // 짝 짓기 판의 이름은 하나다: 만들기 화면의 단추와 같은 "돌 짝 짓기"
  assert.equal(T.levels[3].name, '돌 짝 짓기');
  assert.match(html, /data-kind="pairs">돌 짝 짓기</);
  for (const [path, text] of strings) assert.doesNotMatch(text, /건너뛰어 짝/, path);
});

test('판의 종류마다 규칙 설명이 있고, 세 문장을 넘지 않는다', () => {
  assert.deepEqual(Object.keys(T.rules).sort(), [...MODES].sort());
  for (const mode of MODES) assert.ok(sentenceCount(fill(T.rules[mode], { k: 2 })) <= 3, `${mode}: ${T.rules[mode]}`);
  // 개구리: 보는 쪽으로만, 한 칸 또는 다른 쪽 동물 한 마리를 뛰어넘어 빈칸으로, 통째로 맞바꾸기
  assert.match(T.rules.frogs, /보는 쪽으로만/);
  assert.match(T.rules.frogs, /바로 앞의 다른 쪽 동물 한 마리는 뛰어넘어 빈칸으로 갈 수 있어요/);
  assert.match(T.rules.frogs, /통째로 맞바꿔/);
  // 짝 짓기: 건너뛰는 수, 짝은 건너뛸 때 두 개로 센다, 짝은 더 움직이지 못한다
  assert.match(fill(T.rules.pairs, { k: 2 }), /돌 2개를 건너뛰고, 혼자 있는 돌 위에 얹어요/);
  assert.match(T.rules.pairs, /짝이 된 돌은 건너뛸 때 두 개로 세고/);
  assert.match(T.rules.pairs, /더 움직이지 못해요/);
  // 직접 만들기 화면의 안내 글도 같다. 안 되는 판을 만들어 보라고 권한다.
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 52, '직접 만들기 안내 글은 형식마다 하나');
  assert.ok(sentenceCount(guides[3]) <= 3, guides[3]);
  assert.match(guides[3], /안 되는 판도 만들 수 있을까요\?/);
  // 선생님의 만들기 안내: 만들기 화면에 "선생님, 풀어 보세요" 단추가 있으므로 그 말로 끝난다.
  assert.equal(T.make.intro, '판의 종류를 고르고 수를 정해요. 다 정하면 선생님에게 풀어 보라고 할 수도 있어요.');
  assert.match(html, /id="swap-make-solve"[^>]*>선생님, 풀어 보세요</);
});

test('놀이 말의 이름: "말"과 "무리"를 쓰지 않고, 개구리나 두꺼비(같은 쪽 동물, 다른 쪽 동물)와 돌이라고 한다', () => {
  for (const [path, text] of strings) assert.doesNotMatch(text, /(?<![가-힣])말([이을들은도]|부터)|(?<!아)무리|마릿수/, `${path}: ${text}`);
  for (const key of ['plain', 'pair-again', 'same']) assert.match(T.stuck[key], /다른 개구리나 두꺼비를 움직여 볼 수 있어요\.$/, key);
  assert.match(T.stuck['same-start'], /다른 개구리나 두꺼비부터 움직여 볼 수 있어요\.$/);
  assert.equal(T.status.stuck, '더 갈 수 있는 동물이 없어요');
});

test('형식의 첫 단계는 횟수를 묻지 않는다: "가장 적게"는 3단계에서만 건다', () => {
  const counting = /횟수|가장 적|몇 번|줄일|[}\d]번에/;
  assert.doesNotMatch(T.rules.frogs, counting);
  assert.doesNotMatch(T.home.ask.frogs, counting);
  for (const hint of T.hints.frogs) assert.doesNotMatch(hint, counting, hint);
  for (const key of ['plain', 'pair-again', 'same', 'same-start']) assert.doesNotMatch(T.stuck[key], counting, key);
  // 판 화면의 개구리 칸에도 횟수를 묻는 글이 없다(판 아래의 움직인 횟수는 사실로만 적는다).
  assert.doesNotMatch(visibleText(part('id="swap-frogs"', 'id="swap-fewest"')), counting);
  assert.match(html, /id="swap-count"[^>]*>움직인 횟수 <strong id="swap-moves">0<\/strong>번</);
  // 3단계: 가장 적은 횟수로. 무른 움직임도 센다고 미리 말한다.
  // 끝까지 가는 길은 어느 것이나 횟수가 같다. 그래서 이 단계는 "무르지 않고"가 곧 "가장 적은 횟수"다.
  // 그것은 "왜 그럴까?" 첫 장에서 알아채는 것이라 규칙에서 미리 말하지 않는다. 몇 번에 되는지만 묻는다.
  assert.match(T.rules.fewest, /한 번도 무르지 않고/);
  assert.doesNotMatch(T.rules.fewest, /가장 적은 횟수|가장 적게|그러면/);
  assert.match(T.rules.fewest, /물렀던 움직임도 횟수에 들어가요/);
  assert.match(T.rules.fewest, /몇 번에 맞바꿀 수 있을까요\?$/);
  assert.match(T.home.ask.fewest, /한 번도 무르지 않고/);
  assert.deepEqual(LADDER.filter((rung) => rung.mode === 'fewest').map((rung) => rung.level), [3]);
  assert.deepEqual(LADDER.slice(0, 2).map((rung) => rung.mode), ['frogs', 'frogs']);
});

test('더 좋은 답이 남아 있을 때는 틀렸다고 하지 않고 "더 줄일 수 있을까요?"라고 묻는다', () => {
  assert.equal(fill(T.play.more, { m: 9 }), '9번에 맞바꿨어요. 더 줄일 수 있을까요?');
  assert.doesNotMatch(T.play.more, /틀렸|아니에요|땡|아쉽|것 같아요/);
  assert.equal(fill(T.right.fewest, { m: 8 }), '한 번도 무르지 않고 8번에 맞바꿨어요. 이보다 적게는 할 수 없어요.');
  assert.ok(fill(T.right.stopped, { m: 9 }).includes('9번에 맞바꾸고'));
  // 다시 해도 되고 그만해도 된다.
  assert.match(html, /id="swap-again"[^>]*>처음부터 다시 해 볼래요</);
  assert.match(html, /id="swap-stop"[^>]*>여기까지 할래요</);
  assert.match(html, /id="swap-best-line"[^>]*>지금까지 가장 적게 /);
});

test('힌트는 판의 종류마다 두 개이고, 하나하나가 질문 한 문장이다', () => {
  assert.deepEqual(Object.keys(T.hints).sort(), [...MODES].sort());
  for (const mode of MODES) {
    const hints = T.hints[mode];
    assert.equal(hints.length, tuningFor('swap').hintCount, mode);
    assert.equal(hints.length, 2, mode);
    for (const hint of hints) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
    }
    assert.equal(new Set(hints).size, hints.length, `${mode}: 같은 힌트가 두 번 있어요`);
  }
});

test('힌트는 두 높이다: 첫째는 무엇을 해 볼지만, 둘째는 어디를 볼지까지만 묻는다. 무엇이 보이는지는 말하지 않는다', () => {
  for (const mode of MODES) {
    const [first, second] = T.hints[mode];
    // 첫째: 어느 판에서나 쓸 수 있는 일반 질문이다. 이 형식의 사물 이름이 들어 있지 않다.
    assert.doesNotMatch(first, /개구리|두꺼비|동물|돌|말|무리/, first);
    // 둘째: 볼 곳(동물들, 움직임, 돌)을 가리킨다.
    assert.match(second, /동물들|움직임|돌/, second);
    // 답을 말해 버리지 않는다: 본 것, 까닭, 요령이 들어 있지 않다.
    for (const hint of [first, second]) {
      assert.doesNotMatch(hint, /같은 무리|같은 쪽|번갈아|곱하기|더하기|뛰어넘기는|때문이에요|해야 해요|하면 돼요/, hint);
    }
  }
  assert.match(T.hints.frogs[0], /막히기 바로 전/);
  assert.match(T.hints.fewest[0], /더 작은 판/);
  assert.match(T.hints.pairs[0], /끝나기 바로 전/);
});

test('막혔을 때 하는 말은 본 것 하나와 할 수 있는 일 하나다. 까닭을 풀어 주지 않는다', () => {
  assert.deepEqual(Object.keys(T.stuck).sort(), [...STUCK_KEYS].sort());
  for (const key of STUCK_KEYS) {
    const line = fill(T.stuck[key], { s: 2 });
    const [fact, next, ...rest] = sentences(line);
    assert.equal(rest.length, 0, `${key}: 두 문장이어야 해요`);
    assert.match(fact, /(없어요|막혔어요)\.$/, `${key}: ${fact}`);
    assert.match(next, /볼 수 있어요\.$/, `${key}: ${next}`);
    assert.doesNotMatch(line, /왜냐|때문|그래서|니까|해야|틀렸|안 돼요/, key);
  }
  // 같은 꼴로 거듭 막히면 그 사실을 알려 준다. 본 것만 말한다.
  assert.match(T.stuck['pair-again'], /^이번에도 같은 쪽 동물 둘이 붙은 뒤에 막혔어요\./);
  for (const key of ['same', 'same-start', 'pairs-same', 'pairs-same-start']) assert.match(T.stuck[key], /^아까와 똑같은 모양에서 막혔어요\./, key);
  // 더 멀리 물러서 보라는 말: "두 번 무른 뒤"(형식 코드의 SAME_BACK과 같은 수)
  for (const key of ['same', 'pairs-same']) assert.match(T.stuck[key], /두 번 무른 뒤 다른 /, key);
  assert.match(read('src/formats/swap.js'), /const SAME_BACK = 2;/);
  assert.equal(fill(T.stuck.pairs, { s: 4 }).split('.')[0], '혼자 있는 돌이 4개 남았는데 얹을 자리가 없어요');
  // "같은 쪽 동물 둘이 붙은 뒤에"는 본 것이다: 막힌 모습은 어느 것이나 그렇다(풀이 프로그램으로 확인).
  for (let left = 1; left <= MAX_FROGS; left++) {
    for (let right = 1; right <= MAX_FROGS; right++) {
      for (const cells of deadEnds(frogs(left, right))) assert.equal(stuckKind(cells), 'pair', cells);
    }
  }
  // 판 아래에 적는 짧은 글
  for (const key of ['stuck', 'swapped', 'blocked', 'edge', 'backward', 'pairs-stuck', 'paired', 'no-landing', 'is-pair', 'far', 'gathered', 'piled', 'is-pile', 'carry-pick', 'carry-two']) {
    assert.match(T.status[key], /요$/, key);
    assert.ok([...T.status[key]].length <= 20, key);
  }
});

test('틀린 "불가능해요"에 하는 말은 짐작이라고 밝히고, 판에서 해 보게 한다', () => {
  assert.deepEqual(Object.keys(T.guess).sort(), [...GUESS_KEYS].sort());
  for (const key of GUESS_KEYS) {
    assert.match(T.guess[key], /것 같아요/, key);
    assert.doesNotMatch(T.guess[key], /틀렸|아니에요|땡/, key);
    assert.doesNotMatch(T.guess[key], /좀 더 생각|다시 생각|잘 생각/, key);
    assert.match(T.guess[key], /볼까요\?$/, key);
    assert.equal(sentenceCount(T.guess[key]), 2, key);
  }
  assert.match(html, /id="swap-impossible"[^>]*>불가능해요</);
});

test('맞혔을 때 하는 말은 한 일을 말하고, 칭찬 낱말을 쓰지 않는다', () => {
  const praise = /최고|잘했|대단|훌륭|멋져|멋진|천재|똑똑|완벽|짱|굉장/;
  for (const [path, text] of strings) assert.doesNotMatch(text, praise, `${path}: ${text}`);
  assert.deepEqual(Object.keys(T.right).sort(), [...RIGHT_KEYS].sort());
  // 몇 번 움직였는지, 몇 번 물렀는지를 그대로 말한다.
  assert.equal(fill(T.right['swapped-clean'], { m: 8 }), '자리를 맞바꿨어요. 한 번도 무르지 않고 8번 움직였어요.');
  assert.equal(fill(T.right['swapped-back'], { m: 14, u: 3 }), '자리를 맞바꿨어요. 모두 14번 움직이고 3번 물렀어요.');
  assert.equal(fill(T.right.resets, { r: 2 }), '처음으로 2번 되돌렸어요.');
  // 무르기와 처음으로 되돌리기를 합쳐 센 횟수(짝 짓기)는 "무르거나 되돌리고"라고 말한다.
  assert.equal(fill(T.right['paired-back'], { n: 8, u: 3 }), '3번 무르거나 되돌리고 다시 해서 돌 8개를 모두 짝 지었어요.');
  assert.match(read('src/formats/swap.js'), /const back = round\.undoCount \+ round\.resetCount;/);
  // 처음 고른 답("불가능해요")을 바꿔서 찾았을 때: 형식마다 같은 말
  assert.equal(T.right['after-retry'], '처음 답을 바꿔서 찾아냈어요.');
  // "맞아요"는 답 단추("불가능해요")를 눌러 맞혔을 때만 한다.
  for (const key of RIGHT_KEYS) assert.equal(/^맞아요/.test(T.right[key]), key.startsWith('impossible-'), key);
  assert.ok(fill(T.right['fewest-after'], { first: 11 }).includes('11번'));
  assert.ok(fill(T.right['paired-clean'], { n: 8, m: 4 }).includes('돌 8개') && fill(T.right['paired-clean'], { n: 8, m: 4 }).includes('4번 얹었어요'));
  assert.ok(fill(T.right['impossible-tried'], { s: 3 }).includes('3번 막혀 보고'));
});

test('글의 빈칸({이름})은 정해진 이름만 쓴다', () => {
  const allowed = new Set(['no', 'what', 'k', 's', 'm', 'u', 'r', 'n', 'first', 'a', 'b']);
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
    ...Object.values(T.stuck),
    ...Object.values(T.play),
    ...MODES.flatMap((mode) => T.hints[mode]),
    ...Object.values(T.guess),
    ...Object.values(T.right),
    T.solution.frogs,
    T.solution.pairs,
    T.solution.impossible,
    T.solution.carry,
    T.solution.threes,
    T.solution['threes-impossible'],
    T.make.intro,
    T.make.frogs,
    T.make.pairs,
    T.make.impossible,
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

test('까닭과 생각의 이름은 "왜 그럴까?"에서만 말한다', () => {
  const name = /나눠 세기/;
  const reason = /곱하기|곱한|더하기|더한 수|더한 것|지나치|두 칸을 가요/;
  for (const [path, text] of strings) {
    if (path.startsWith('why')) continue;
    assert.doesNotMatch(text, name, `${path}: ${text}`);
    assert.doesNotMatch(text, reason, `${path}: ${text}`);
  }
  assert.doesNotMatch(screenText, name);
  // 다른 형식의 이름(손가락 더하기)은 까닭이 아니다
  assert.doesNotMatch(screenText.replaceAll('손가락 더하기', ''), reason);
  assert.match(T.why.map((slide) => slide.say).join(' '), name);
  // 이름은 맨 마지막 장에서 처음 꺼낸다(뜻밖의 결과 → 그림 → 이름).
  for (const slide of T.why.slice(0, -1)) assert.doesNotMatch(slide.say, name);
  assert.match(T.why.at(-1).say, name);
});

test('"왜 그럴까?"는 그림 서너 장이고, 설명이 아니라 어떻게 알아챘는지의 이야기다', () => {
  assert.ok(T.why.length >= 3 && T.why.length <= 4, `${T.why.length}장`);
  for (const slide of T.why) {
    assert.ok(slide.say.length > 0);
    assert.ok(sentenceCount(slide.say) <= 3, slide.say);
    assert.ok(slide.figures.length + (slide.table ? 1 : 0) >= 1, '그림이 없는 장');
    assert.ok(slide.figures.length <= 2);
  }
  // 줄거리: 선생님도 막혔다 → 끝까지 간 판을 되돌려 보며 세어 봤다(뜻밖의 결과: 늘 같았다)
  //        → 뛰어넘기는 곱만큼 → 한 칸 가기는 합만큼 → 그래서 이보다 적게는 안 된다
  assert.match(T.why[0].say, /^선생님도 여러 번 막혔어요/);
  assert.match(T.why[0].say, /되돌려 보며 움직인 횟수를 세어 봤어요/);
  assert.match(T.why[0].say, /늘 같았어요/);
  // 짝마다 "꼭 한 번" 지나치고 그때 한 번 뛰어넘는다(뒤로 못 가므로). 그래서 뛰어넘기는 곱만큼이다.
  assert.match(T.why[1].say, /개구리 한 마리와 두꺼비 한 마리는 꼭 한 번 서로 지나치고, 그때 한 번 뛰어넘어요/);
  assert.doesNotMatch(T.why[1].say, /한 번은/);
  assert.match(T.why[1].say, /개구리 수 곱하기 두꺼비 수/);
  assert.match(T.why[2].say, /가야 하는 칸을 더해 봤어요/);
  assert.match(T.why[2].say, /개구리 수 더하기 두꺼비 수/);
  assert.match(T.why[3].say, /횟수는 뛰어넘기 수와 한 칸 가기 수를 더한 것이에요/);
  assert.match(T.why[3].say, /이보다 적게는 안 돼요/);
  // 이야기 속 선생님이 먼저 "여기서 막혔어요"를 보인다: 첫 장의 첫 그림이 막힌 판이다.
  assert.match(T.why[0].figures[0].note, /^여기서 막혔어요/);
  // 이야기의 말투: 겪은 일로 말한다("~봤어요").
  for (const slide of T.why.slice(0, 3)) assert.match(slide.say, /봤어요/, slide.say);
});

test('"왜 그럴까?" 그림 속의 판과 수는 풀이 프로그램이 따진 것과 같다', () => {
  let checked = 0;
  for (const slide of T.why) {
    for (const item of slide.figures) {
      const board = frogs(item.left, item.right);
      const where = item.note;
      assert.equal(checkBoard(board), null, where);
      const played = replay(board, item.trail);
      assert.equal(played.ok, true, where);
      const ways = allWays(board);
      // 막힌 판이라고 한 그림은 정말 막힌 판이다.
      if (item.stuck) assert.equal(isStuck(board, played.cells), true, where);
      // 끝까지 간 판이라고 한 그림은 정말 끝난 판이고, 적은 횟수는 길의 길이이자 끝까지 가는 모든 길의 길이다.
      if (item.moves !== undefined) {
        assert.equal(isDone(board, played.cells), true, where);
        assert.equal(item.trail.length, item.moves, where);
        assert.deepEqual(ways.lengths, [item.moves], where);
        assert.ok(item.note.includes(`${item.moves}번`), where);
      }
      // 뛰어넘기의 수는 곱이고, 끝까지 가는 모든 길에서 그렇다.
      if (item.jumps !== undefined) {
        assert.equal(item.jumps, item.left * item.right, where);
        assert.deepEqual(ways.jumps, [item.jumps], where);
        assert.ok(item.note.includes(`${item.jumps}번`), where);
      }
      // 화살표로 보인 움직임은 뛰어넘기다.
      if (item.arrow) {
        const before = replay(board, item.trail.slice(0, -1));
        const [from, to] = item.trail.at(-1);
        assert.equal(movesOf(board, before.cells).find((move) => move.from === from && move.to === to).jump, true, where);
        assert.equal(before.cells[from], 'L', '두꺼비가 뛰어넘었다고 적었다');
        assert.match(item.note, /^두꺼비가 개구리를 뛰어넘었어요/);
      }
      // 가야 하는 칸: 개구리는 (두꺼비 수 + 1)칸씩, 두꺼비는 (개구리 수 + 1)칸씩. 뛰어넘기가 두 칸씩이고 남은 것이 한 칸 가기다.
      if (item.travel !== undefined) {
        assert.equal(item.travel, item.left * (item.right + 1) + item.right * (item.left + 1), where);
        assert.equal(item.steps, item.travel - 2 * item.jumps, where);
        assert.equal(item.steps, item.left + item.right, where);
        assert.equal(solve(board).min, item.jumps + item.steps, where);
        for (const number of [item.travel, 2 * item.jumps, item.steps]) assert.ok(item.note.includes(`${number}칸`), `${where}: ${number}칸`);
        assert.ok(item.note.includes(`${item.right + 1}칸씩`), where);
      }
      checked += 1;
    }
    for (const row of slide.table ?? []) {
      const board = frogs(row.left, row.right);
      const where = `${row.left}마리와 ${row.right}마리`;
      const ways = allWays(board);
      assert.equal(row.jumps, row.left * row.right, where);
      assert.equal(row.steps, row.left + row.right, where);
      assert.equal(row.moves, row.jumps + row.steps, where);
      assert.equal(solve(board).min, row.moves, where);
      assert.deepEqual(ways.lengths, [row.moves], where);
      assert.deepEqual(ways.jumps, [row.jumps], where);
      checked += 1;
    }
  }
  assert.equal(checked, 8);
  // 표에 적는 글
  assert.equal(fill(T.table.row, { a: 3, b: 2 }), '개구리 3, 두꺼비 2');
  assert.equal(fill(T.table.times, { n: 11 }), '11번');
  assert.deepEqual(Object.keys(T.table.heads), ['board', 'jumps', 'steps', 'moves']);
});

test('"왜 그럴까?"의 주장: 1~5마리의 모든 짝에서 가장 적은 횟수는 곱 + 합이고, 가장 짧은 풀이마다 뛰어넘기가 곱만큼이다', () => {
  for (let left = 1; left <= MAX_FROGS; left++) {
    for (let right = 1; right <= MAX_FROGS; right++) {
      const board = frogs(left, right);
      const where = `${left}마리와 ${right}마리`;
      assert.equal(solve(board).min, left * right + left + right, where);
      const ways = allWays(board);
      assert.ok(ways.ways >= 1, where);
      assert.deepEqual(ways.jumps, [left * right], where);
      assert.deepEqual(ways.lengths, [left * right + left + right], where);
    }
  }
});

test('돌 짝 짓기에는 "왜 그럴까?"를 붙이지 않는다(일부러 까닭을 남겨 둔 판)', () => {
  assert.match(T._설명, /일부러 까닭을 남겨 둔 판/);
  // 설명의 그림은 모두 개구리 판이다. 돌이나 짝을 말하는 장이 없다.
  for (const slide of T.why) {
    for (const item of slide.figures) assert.ok(Number.isInteger(item.left) && Number.isInteger(item.right) && item.n === undefined);
    assert.doesNotMatch(slide.say, /돌을|돌이|돌 |짝/);
  }
  // 짝 짓기를 맞혔을 때는 "왜 그럴까?"를 권하지 않는다. 권하는 말은 가장 적은 횟수의 것 하나뿐이다.
  // 바로 앞의 말("이보다 적게는 할 수 없어요")과 "이보다"가 겹치지 않게 한다.
  assert.match(T.right['why-invite'], /왜 더 적게는 안 되는지/);
  assert.match(T.right.fewest, /이보다 적게는 할 수 없어요\.$/);
  assert.doesNotMatch(T.right['why-invite'], /이보다/);
  for (const key of RIGHT_KEYS.filter((item) => item !== 'why-invite')) assert.doesNotMatch(T.right[key], /왜 그럴까/, key);
});

test('판 고르기의 그림: 단계마다 그 단계의 판이고, 그림 속의 움직임은 규칙에 맞다', () => {
  for (const rung of LADDER) {
    const picture = T.levels.find((entry) => entry.level === rung.level).picture;
    if (rung.mode === 'make') {
      assert.equal(picture.blank, true);
      continue;
    }
    let board = frogs(picture.left, picture.right);
    if (rung.mode === 'pairs') board = { kind: 'pairs', n: picture.n, skip: picture.skip };
    if (rung.mode === 'threes') board = { kind: 'pairs', n: picture.n, skip: picture.skip, group: picture.group };
    if (rung.mode === 'carry') board = { kind: 'carry', n: picture.carry };
    assert.equal(checkBoard(board), null, `${rung.level}단계`);
    assert.equal(replay(board, picture.trail ?? []).ok, true, `${rung.level}단계의 그림`);
    // 그 단계에서 실제로 나오는 판이다.
    const made = rung.boards.map((_, index) => JSON.stringify(generateBoard(rung.level, index + 1).board));
    assert.ok(made.includes(JSON.stringify(board)), `${rung.level}단계`);
  }
  // 칸과 말의 이름(읽어 주는 글)
  assert.equal(fill(T.cellLabel, { no: ordinal(2), what: T.pieces.toad }), '2번째 칸, 두꺼비');
  assert.equal(fill(T.cellLabel, { no: ordinal(1), what: T.pieces.frog }), '첫 번째 칸, 개구리');
  assert.match(read('src/formats/swap.js'), /fill\(T\.cellLabel, \{ no: ordinal\(index \+ 1\), what: /);
  assert.deepEqual(Object.keys(T.pieces), ['frog', 'toad', 'empty', 'single', 'pair', 'gone', 'two', 'three', 'black', 'white']);
});

test('풀이와 직접 만들기의 글: 가장 적은 횟수와 되는지를 알려 준다', () => {
  assert.equal(fill(T.solution.frogs, { k: 15 }), '가장 적게 15번이에요. 한 가지 방법을 보여 줄게요.');
  assert.equal(fill(T.solution.pairs, { k: 4 }), '4번 얹으면 모두 짝이 돼요. 한 가지 방법을 보여 줄게요.');
  assert.equal(fill(T.solution.stepLabel, { no: 3 }), '3번');
  assert.equal(fill(T.make.frogs, { k: 35 }), '이 판은 자리를 맞바꿀 수 있어요. 가장 적게 35번이에요.');
  assert.equal(fill(T.make.pairs, { k: 6 }), '이 판은 모두 짝 지을 수 있어요. 6번 얹으면 돼요.');
  assert.match(T.make.impossible, /아무리 해도/);
  assert.equal(fill(T.make.animals, { n: 5 }), '5마리');
  assert.equal(fill(T.make.stones, { n: 12 }), '12개');
});

test('index.html: 자리 바꾸기의 카드, 판, 답하는 칸, 직접 만들기가 있다', () => {
  for (const id of [
    'home-swap-sample',
    'home-swap-ask',
    'home-swap-play',
    'home-swap-pick',
    'home-swap-make',
    'home-swap-blank',
    'swap-board',
    'swap-status',
    'swap-count',
    'swap-moves',
    'swap-left-count',
    'swap-left',
    'swap-pad',
    'swap-frogs',
    'swap-fewest',
    'swap-pairs',
    'swap-best',
    'make-swap',
    'swap-make-kinds',
    'swap-make-frogs',
    'swap-make-pairs',
    'swap-make-left',
    'swap-make-right',
    'swap-make-n',
    'swap-make-skips',
    'swap-make-board',
    'swap-make-result',
  ]) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.ok(html.includes('id="swap-carry"') && html.includes('id="swap-record"'));
  for (const side of ['left', 'right', 'n']) for (const way of ['fewer', 'more']) assert.ok(html.includes(`id="swap-make-${side}-${way}"`), `${side}-${way}`);
  for (const skip of SKIPS) assert.ok(html.includes(`data-skip="${skip}"`), `건너뛰는 수 ${skip}`);
  for (const kind of ['frogs', 'pairs']) assert.ok(html.includes(`data-kind="${kind}"`), kind);
  assert.match(html, /id="swap-make-solve"[^>]*>선생님, 풀어 보세요</);
  assert.match(html, /id="swap-make-play"[^>]*>내가 해 볼래요</);
  for (const label of ['자리 바꾸기', '움직인 횟수', '혼자 있는 돌', '개구리 수', '두꺼비 수', '돌의 수', '건너뛰는 수']) assert.ok(screenText.includes(label), label);
  // 처음 화면의 물음은 대본에 있는 것과 같은 글로 시작한다.
  assert.ok(screenText.includes(T.home.ask.frogs));
});

test('처음 화면: 하던 판 띠가 카드들 위에 있고, 퍼즐 만들기는 맨 뒤에 있고 단추 하나로 목록을 연다', () => {
  const at = (text) => {
    const index = html.indexOf(text);
    assert.ok(index >= 0, text);
    return index;
  };
  // 하던 판 → 카드들 → "만들기" 목록 → 판 고르기
  assert.ok(at('id="resume"') < at('id="doors"'));
  assert.ok(at('id="doors"') < at('id="make-menu"'));
  assert.ok(at('id="make-menu"') < at('id="picker"'));
  // 카드의 차례: 형식들, 맨 뒤에 퍼즐 만들기
  const titles = ['coins-title', 'trace-title', 'code-title', 'swap-title', 'tile-title', 'duel-title', 'tax-title', 'logic-title', 'block-title', 'river-title', 'cups-title', 'dandelion-title', 'maze-title', 'rulehunt-title', 'untangle-title', 'lamps-title', 'rooms-title', 'machine-title', 'split-title', 'eyeball-title', 'cutpaste-title', 'fold-title', 'domino-title', 'pieces-title', 'magic-title', 'apart-title', 'keymaze-title', 'cipher-title', 'seqpath-title', 'pancake-title', 'product-title', 'sim-title', 'matches-title', 'fair-title', 'rowflip-title', 'foxrabbit-title', 'pins-title', 'net-title', 'regionmap-title', 'blackhole-title', 'tower-title', 'racetrack-title', 'discpair-title', 'make-title'].map((id) => at(`id="${id}"`));
  assert.deepEqual(titles, [...titles].sort((a, b) => a - b));
  const cards = part('id="doors"', 'id="make-menu"');
  assert.equal([...cards.matchAll(/class="panel door[ "]/g)].length, 53);
  // 형식의 카드마다 "해 보기"와 "판 고르기"가 하나씩 있다.
  assert.equal([...cards.matchAll(/>해 보기</g)].length, 52);
  assert.equal([...cards.matchAll(/>판 고르기</g)].length, 52);
  // 퍼즐 만들기 카드에는 단추가 "만들기" 하나뿐이다. 형식마다의 단추는 목록 안에 있다.
  const makeCard = part('id="make-title"', 'id="make-menu"');
  assert.deepEqual([...makeCard.matchAll(/<button id="([^"]+)"/g)].map((match) => match[1]), ['home-make-open']);
  assert.match(makeCard, /id="home-make-open"[^>]*>만들기</);
  const menu = part('id="make-menu"', 'id="picker"');
  assert.deepEqual([...menu.matchAll(/<button id="([^"]+)" class="menu-item"/g)].map((match) => match[1]), ['home-make', 'home-trace-make', 'home-code-make', 'home-swap-make', 'home-tile-make', 'home-duel-make', 'home-tax-make', 'home-logic-make', 'home-block-make', 'home-river-make', 'home-cups-make', 'home-dandelion-make', 'home-maze-make', 'home-rulehunt-make', 'home-untangle-make', 'home-lamps-make', 'home-rooms-make', 'home-machine-make', 'home-split-make', 'home-eyeball-make', 'home-cutpaste-make', 'home-fold-make', 'home-domino-make', 'home-pieces-make', 'home-magic-make', 'home-apart-make', 'home-keymaze-make', 'home-cipher-make', 'home-seqpath-make', 'home-pancake-make', 'home-product-make', 'home-sim-make', 'home-matches-make', 'home-fair-make', 'home-rowflip-make', 'home-foxrabbit-make', 'home-pins-make', 'home-net-make', 'home-regionmap-make', 'home-blackhole-make', 'home-tower-make', 'home-racetrack-make', 'home-discpair-make', 'home-tilings-make', 'home-fingers-make', 'home-signs-make', 'home-views-make', 'home-slide-make', 'home-fourdigits-make', 'home-yesno-make', 'home-degree-make', 'home-nopay-make']);
  assert.match(menu, /id="make-menu-close"[^>]*>닫기</);
  for (const name of ['동전 뒤집기', '한붓그리기', '숫자 추리', '자리 바꾸기', '조각 덮기', '누가 이길까', '약수 세금', '참말 섬', '조각 못 들어가게 막기', '강 건너기', '컵 뒤집기와 세 색 무리', '민들레와 바람', '주사위 미로와 길 세기', '숨은 규칙 찾기', '엉킨 그림 풀기', '켜고 끄기와 숫자 마술', '방 한 번씩 돌기', '규칙 기계와 규칙이 깨지는 판', '똑같이 섞이게 자르기', '눈대중', '자르고 붙이기', '접히는 모양 가리기', '도미노 가로세로', '조각 가짓수 찾기', '마법 네모와 겹친 칸', '닿지 않게 놓기와 구역 긋기', '열쇠 미로', '암호 놀이', '수열 길 퍼즐', '팬케이크 뒤집기', '곱 단서 퍼즐', '세모 피하기', '성냥개비', '공정한 게임일까', '줄 뒤집기 판', '여우와 토끼', '핀에 실 감기', '그물 끊기', '구역 지도 맞히기', '블랙홀', '탑 옮기기', '모눈 자동차 경주', '원판 둘씩 옮기기', '도미노 깔기 모두 찾기', '손가락 더하기', '부호 넣어 수 만들기', '세 방향에서 본 그림', '번호 말 제자리 찾기', '숫자 넷으로 수 만들기', '질문으로 맞히기', '조건 맞춰 잇기', '낼 수 없는 금액']) assert.ok(visibleText(menu).includes(name), name);
});

test('처음 화면의 배치: 카드는 한 줄에 여러 장이 놓이고, 넘치면 카드 칸만 굴러간다', () => {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const doors = clean.match(/\n\.doors \{([^}]*)\}/)[1];
  assert.match(doors, /display:\s*grid/);
  assert.match(doors, /grid-template-columns:\s*repeat\(auto-fill,\s*minmax\((\d+)px,\s*1fr\)\)/);
  assert.match(doors, /overflow:\s*auto/);
  assert.match(doors, /min-height:\s*0/);
  // 가로 1280px(안쪽 1256px)에서 한 줄에 서너 장이 들어간다.
  const [, width] = doors.match(/minmax\((\d+)px/);
  const [, gap] = doors.match(/gap:\s*(\d+)px/);
  const perRow = Math.floor((1256 + Number(gap)) / (Number(width) + Number(gap)));
  assert.ok(perRow >= 3 && perRow <= 4, `한 줄에 ${perRow}장`);
  // 줄의 높이: 높이 800px에서 하던 판 띠가 있어도 두 줄이 들어가는 높이까지 줄어든다.
  const [, low, high] = doors.match(/grid-auto-rows:\s*minmax\((\d+)px,\s*(\d+)px\)/);
  assert.ok(2 * Number(low) + Number(gap) <= 426, `줄의 가장 낮은 높이 ${low}px`);
  assert.ok(Number(high) >= Number(low));
  // 좁은 화면에서는 카드 칸이 굴러가지 않고 화면 전체가 굴러간다.
  const narrow = clean.slice(clean.indexOf('@media (max-width: 980px)'));
  assert.match(narrow, /\.doors \{[^}]*overflow:\s*visible/);
});

// ---- 수준 맞추기 ----
let nextId = 0;
function swap(overrides = {}) {
  nextId += 1;
  return {
    kind: 'round',
    id: `w${nextId}`,
    format: 'swap',
    level: 1,
    seed: nextId,
    custom: false,
    mode: 'frogs',
    outcome: 'solved',
    hintsOpened: 0,
    answers: [{ t: 20, answer: 'swapped', correct: true, guess: null }],
    moveCount: 5,
    wrongCount: 0,
    fewest: false,
    seconds: 20,
    solution: { possible: true, min: 5 },
    ...overrides,
  };
}

test('자리 바꾸기의 수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다', () => {
  const tuning = tuningFor('swap');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 6);
  assert.equal(tuning.hintCount, 2);
  assert.equal(tuning.whyAfter, 'fewest');
  for (const rung of LADDER.filter((item) => item.mode !== 'make')) assert.ok(tuning.expectedSeconds[rung.level] > 0, `${rung.level}단계의 예상 시간`);
  assert.deepEqual(recommend([], 'swap'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  // 시작 단계의 첫 판은 실패할 수 없는 판이다.
  assert.deepEqual(generateBoard(recommend([], 'swap').level, 1).board, { kind: 'frogs', left: 1, right: 1 });
  assert.equal(rungOf(tuning.startLevel).mode, 'frogs');
  // 임시값이라고 적어 두었다.
  assert.match(read('src/core/level.js'), /자리 바꾸기\(모두 임시\)/);
  // 다른 형식의 값은 그대로다.
  assert.equal(tuningFor('coins').startLevel, TUNING.startLevel);
  assert.equal(tuningFor('trace').startLevel, 1);
  assert.equal(tuningFor('code').startLevel, 2);
  assert.equal(tuningFor('coins').whyAfter, undefined);
});

test('개구리 판은 무르기 없이 끝낸 판을 "한 번에"로 본다', () => {
  const clean = () => swap();
  assert.deepEqual(recommend([clean(), clean()], 'swap'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  assert.equal(recommend([clean()], 'swap').offerHarder, false, '한 판으로는 권하지 않는다');
  assert.equal(recommend([clean(), swap({ wrongCount: 1 })], 'swap').offerHarder, false, '무르거나 되돌렸으면 권하지 않는다');
  assert.equal(recommend([clean(), swap({ hintsOpened: 1 })], 'swap').offerHarder, false, '힌트를 열었으면 권하지 않는다');
  assert.equal(recommend([clean(), swap({ seconds: tuningFor('swap').expectedSeconds[1] })], 'swap').offerHarder, false, '예상 시간보다 오래 걸렸으면 권하지 않는다');
  // 3단계: 가장 적은 횟수로 끝낸 판도 무르기 없이 해야 "한 번에"다(무르면 횟수가 늘어 첫 답이 가장 적은 횟수가 아니다).
  const fewest = (overrides = {}) => swap({ level: 3, mode: 'fewest', fewest: true, answers: [{ t: 60, answer: 'swapped:8', correct: true, guess: null }], seconds: 60, ...overrides });
  assert.deepEqual(recommend([fewest(), fewest()], 'swap'), { level: 3, small: false, offerHarder: true, harderLevel: 4, reason: 'fast' });
  assert.equal(recommend([fewest(), fewest({ wrongCount: 2 })], 'swap').offerHarder, false);
  // 4단계(짝 짓기)는 첫 답으로 맞혔는지를 본다. 맨 위 단계에서는 직접 만들기를 가리킨다.
  const pairs = (overrides = {}) => swap({ level: 4, mode: 'pairs', wrongCount: null, answers: [{ t: 90, answer: 'paired', correct: true, guess: null }], seconds: 90, ...overrides });
  assert.deepEqual(recommend([pairs(), pairs()], 'swap'), { level: 4, small: false, offerHarder: true, harderLevel: 5, reason: 'fast' });
  const retried = pairs({ answers: [{ t: 30, answer: 'impossible', correct: false, guess: 'impossible-no-try' }, { t: 90, answer: 'paired', correct: true, guess: null }] });
  assert.equal(recommend([pairs(), retried], 'swap').offerHarder, false);
});

test('그만두기가 이어지면 조용히 한 단계 아래를 먼저 보여 준다. 맨 아래에서는 가장 작은 판이다', () => {
  const quit = (level) => swap({ level, outcome: 'left', answers: [], moveCount: 6, wrongCount: 2 });
  assert.deepEqual(recommend([quit(3), quit(3)], 'swap'), { level: 2, small: false, offerHarder: false, harderLevel: null, reason: 'quit' });
  assert.deepEqual(recommend([quit(1), quit(1)], 'swap'), { level: 1, small: true, offerHarder: false, harderLevel: null, reason: 'quit' });
  assert.equal(recommend([quit(2)], 'swap').reason, 'steady');
  // 힌트를 다 열고도 못 풀었으면 한 판으로도 내려간다.
  assert.equal(recommend([swap({ level: 4, mode: 'pairs', outcome: 'left', answers: [], moveCount: 3, hintsOpened: 2 })], 'swap').level, 3);
  // 들여다보기만 한 판(말을 움직이지도, 답하지도, 힌트를 열지도 않았다)은 세지 않는다. 직접 만든 판도 세지 않는다.
  const peek = () => swap({ level: 2, outcome: 'left', answers: [], moveCount: 0 });
  assert.equal(recommend([peek(), peek()], 'swap').reason, 'start');
  const custom = () => swap({ level: 5, custom: true, outcome: 'left', answers: [], moveCount: 4 });
  assert.equal(recommend([custom(), custom()], 'swap').reason, 'start');
  // 다른 형식의 기록은 영향을 주지 않는다.
  for (const format of ['coins', 'trace', 'code']) assert.equal(recommend([quit(3), quit(3)], format).reason, 'start');
});

test('"왜 그럴까?"는 가장 적은 횟수로 한 판을 끝낸 뒤에 열린다', () => {
  assert.equal(whyUnlocked([], 'swap'), false);
  assert.equal(whyUnlocked([swap(), swap({ level: 2 })], 'swap'), false, '맞바꾸기만 한 판');
  assert.equal(whyUnlocked([swap({ level: 3, mode: 'fewest', fewest: false })], 'swap'), false, '더 많이 움직이고 그만한 판');
  assert.equal(whyUnlocked([swap({ level: 4, mode: 'pairs', solution: { possible: false, min: null } })], 'swap'), false, '안 되는 짝 짓기 판');
  assert.equal(whyUnlocked([swap({ level: 3, mode: 'fewest', fewest: true, outcome: 'left' })], 'swap'), false, '끝내지 않은 판');
  assert.equal(whyUnlocked([swap({ level: 3, mode: 'fewest', fewest: true })], 'swap'), true);
  // 다른 형식은 그대로다.
  assert.equal(whyUnlocked([swap({ level: 3, fewest: true })], 'coins'), false);
  assert.equal(whyUnlocked([{ ...swap(), format: 'code' }], 'code'), true);
  assert.equal(whyUnlocked([{ ...swap(), format: 'trace', solution: { possible: false } }], 'trace'), true);
  assert.equal(whyUnlocked([{ ...swap(), format: 'trace' }], 'trace'), false);
});

test('둘씩 묶어 옮기기: 더 많이 옮겼으면 몇 번이었는지 말하고 "더 적게 할 수 있을까요?"라고 묻는다. 가장 좋은 기록은 공책에 남긴다', () => {
  const code = read('src/formats/swap.js');
  assert.equal(fill(T.play['carry-more'], { m: 6 }), '6번 옮겨서 모았어요. 더 적게 할 수 있을까요?');
  assert.equal(fill(T.right['carry-fewest'], { m: 4 }), '4번 옮겨서 같은 색끼리 모았어요. 이보다 적게는 할 수 없어요.');
  assert.equal(fill(T.notebook.best, { k: 5 }), '가장 적게 옮긴 횟수 5번');
  assert.ok(code.includes("bestOf: (round) => (round.mode !== 'carry' || round.best === null ? null :"));
  // 규칙에서 횟수를 묻지 않는다(짝 수만큼이라는 것은 아이가 찾는다).
  assert.doesNotMatch(T.rules.carry, /횟수|가장 적|몇 번|번에/);
  assert.doesNotMatch(T.home.ask.carry, /횟수|가장 적|몇 번|번에/);
  // 횟수는 지금 길의 길이다(무른 것은 빠진다).
  assert.ok(code.includes('const movesNow = (round) => (isCarry(round.board) ? round.trail.length : round.count);'));
  // 셋씩 쌓기의 글
  assert.equal(fill(T.rules.threes, { k: 3 }).split('. ')[0], '돌 하나를 집어 돌 3개를 건너뛰고, 셋이 안 된 돌 더미 위에 얹어요');
  assert.equal(fill(T.solution.threes, { k: 8 }), '8번 얹으면 모두 셋씩 쌓여요. 한 가지 방법을 보여 줄게요.');
});

test('직접 만들기는 7단계다. 예전 번호(5단계)로 적어 둔 직접 만든 판도 하던 판으로 받고, 만들어 낸 판은 단계의 판의 종류와 맞아야 받는다', () => {
  const code = read('src/formats/swap.js');
  assert.equal(OLD_MAKE_LEVEL, 5);
  assert.equal(MAKE_LEVEL, 7);
  assert.ok(code.includes("if (saved.custom === true) return [MAKE_LEVEL, OLD_MAKE_LEVEL].includes(saved.level) && ['frogs', 'pairs'].includes(saved.mode) && saved.board.group === undefined;"));
  assert.ok(code.includes('saved.level <= TOP_LEVEL && rungOf(saved.level).mode === saved.mode;'));
  assert.equal(rungOf(OLD_MAKE_LEVEL).mode, 'carry');
  // 직접 만든 판의 기록(예전 번호)은 수준 맞추기에서 세지 않는다.
  const custom = () => swap({ level: OLD_MAKE_LEVEL, custom: true, outcome: 'left', answers: [], moveCount: 4 });
  assert.equal(recommend([custom(), custom()], 'swap').reason, 'start');
});
