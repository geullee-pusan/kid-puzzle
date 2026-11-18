// 대본 점검: 화면에 나오는 글이 약속을 지키는지, 설명 그림이 규칙에 맞는지 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { RULES, headCount, isMove, solve } from '../src/core/coins.js';
import { LADDER } from '../src/core/ladder.js';
import { TUNING } from '../src/core/level.js';
import { fill, sentenceCount } from '../src/core/text.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const T = JSON.parse(readFileSync(resolve(ROOT, 'src/content/coins.json'), 'utf8'));
const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');

const RULE_KEYS = ['any2', 'any3', 'adj3-line', 'adj3-ring'];
const GUESS_KEYS = ['number-on-impossible', 'impossible-on-possible', 'impossible-no-try', 'too-many', 'too-few'];
const toCoins = (text) => [...text].map((ch) => Number(ch));

/** 대본의 모든 글(값)을 길과 함께 모은다. 화면에 나오지 않는 것(그림의 동전 글자, 그림의 모양, 설명)은 뺀다. */
function allStrings(value, path = '') {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((item, index) => allStrings(item, `${path}[${index}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .filter(([key]) => key !== 'steps' && key !== 'shape' && !key.startsWith('_'))
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

test('대본을 읽을 수 있고, 글이 비어 있지 않다', () => {
  assert.ok(strings.length > 60);
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
});

test('단계 목록이 사다리와 같다', () => {
  assert.deepEqual(T.levels.map((entry) => entry.level), LADDER.map((rung) => rung.level));
  for (const rung of LADDER) assert.ok(T.tags[rung.tag], `${rung.level}단계의 표시`);
  assert.deepEqual(Object.values(T.tags), ['기본', '응용', '도전']);
});

test('규칙 설명은 세 문장을 넘지 않는다', () => {
  for (const key of RULE_KEYS) {
    assert.ok(T.rules[key], key);
    assert.ok(sentenceCount(T.rules[key]) <= 3, `${key}: ${T.rules[key]}`);
  }
  // 직접 만들기 화면의 안내 글도 같다.
  const makeGuide = html.match(/<p class="rule">([^<]+)<\/p>/)[1];
  assert.ok(sentenceCount(makeGuide) <= 3, makeGuide);
});

test('모든 단계의 판에 규칙 설명과 힌트가 있다', () => {
  for (const rung of LADDER.filter((item) => item.rule)) {
    const key = rung.rule === 'adj3' ? `adj3-${rung.shape}` : rung.rule;
    assert.ok(T.rules[key], `${rung.level}단계의 규칙 설명`);
    assert.ok(T.hints[key], `${rung.level}단계의 힌트`);
  }
});

test('힌트는 규칙마다 두 개이고, 하나하나가 질문 한 문장이다', () => {
  for (const key of RULE_KEYS) {
    const hints = T.hints[key];
    assert.equal(hints.length, TUNING.hintCount, key);
    for (const hint of hints) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.ok(hint.endsWith('?'), hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
    }
    assert.equal(new Set(hints).size, hints.length, `${key}: 같은 힌트가 두 번 있어요`);
  }
});

test('틀린 답에 하는 말은 짐작이라고 밝힌다("~것 같아요")', () => {
  assert.deepEqual(Object.keys(T.guess).sort(), [...GUESS_KEYS].sort());
  for (const key of GUESS_KEYS) {
    assert.match(T.guess[key], /것 같아요/, key);
    assert.doesNotMatch(T.guess[key], /틀렸|아니에요|땡/, key);
    assert.ok(fill(T.guess[key], { k: 3 }).length > 0);
  }
});

test('맞혔을 때 하는 말은 한 일을 말하고, 칭찬 낱말을 쓰지 않는다', () => {
  const praise = /최고|잘했|대단|훌륭|멋져|멋진|천재|똑똑|완벽|짱|굉장/;
  for (const [path, text] of strings) assert.doesNotMatch(text, praise, `${path}: ${text}`);
  assert.doesNotMatch(screenText, praise);
  for (const key of ['impossible-tried', 'impossible-untried', 'min-played', 'min-known', 'min-zero', 'after-retry', 'why-invite']) assert.ok(T.right[key], key);
  assert.ok(fill(T.right['min-played'], { k: 3 }).includes('3번'));
  assert.ok(fill(T.right['impossible-tried'], { f: 7 }).includes('7번'));
  // 처음부터 모두 뒷면인 판은 "0번보다 적게는 할 수 없어요"라고 하지 않는다. 빈칸 없이 사실만 말한다.
  assert.equal(T.right['min-zero'], '맞아요. 이 판은 벌써 모두 뒷면이라서 뒤집을 것이 없어요.');
  // 답을 바꿨다는 사실만 말한다. 처음 답을 틀렸다고 판정하거나 "다시 해 보고"라고 지어내지 않는다.
  assert.equal(T.right['after-retry'], '처음 답을 바꿔서 찾아냈어요.');
});

test('동전의 0번 답: 처음부터 모두 뒷면인 판에서만 0을 낼 수 있다', () => {
  // 다른 판에서 0을 내면 "0번 만에 되는지 해 볼까요?" 같은 말이 된다. 숫자판의 0은 그런 판에서 맨 앞에 놓이지 않는다.
  const code = readFileSync(resolve(ROOT, 'src/formats/coins.js'), 'utf8');
  assert.match(code, /const zeroAllowed = \(round\) => headCount\(round\.board\.coins\) === 0;/);
  assert.match(code, /else if \(key === '0' && zeroBlocked\(\)\) return;/);
  assert.match(code, /const zeroBlocked = \(\) => typed === '' && !\(frame\.round && zeroAllowed\(frame\.round\)\);/);
  // 0으로 끝나는 10은 낼 수 있다(동전 10개 고리 하나는 가장 적게 10번이다).
  assert.equal(solve({ n: 10, shape: 'ring', rule: 'adj3', coins: Array(10).fill(1) }).min, 10);
  assert.equal(solve({ n: 4, shape: 'line', rule: 'any2', coins: [0, 0, 0, 0] }).min, 0);
});

test('"왜 그럴까?": 설명이 안 되는 까닭을 말하지 않는 판(동전 3개, 아무 세 개, 앞뒤가 섞인 판)에서는 열지 않는다', () => {
  // 아무 세 개에서 안 되는 판은 동전 3개짜리의 섞인 판뿐이다. 설명은 뒤집는 횟수의 홀짝만 말한다.
  for (let n = 3; n <= 7; n++) {
    for (let mask = 0; mask < 1 << n; mask++) {
      const coins = Array.from({ length: n }, (_, index) => (mask >> index) & 1);
      const impossible = !solve({ n, shape: 'line', rule: 'any3', coins }).possible;
      assert.equal(impossible, n === 3 && mask !== 0 && mask !== 7, `${n}개 ${coins.join('')}`);
    }
  }
  const code = readFileSync(resolve(ROOT, 'src/formats/coins.js'), 'utf8');
  assert.match(code, /const WHY_TELLS_IMPOSSIBLE = \{ any2: true, any3: false, 'adj3-line': true, 'adj3-ring': true \};/);
  assert.match(code, /if \(!WHY_TELLS_IMPOSSIBLE\[key\] && !solve\(round\.board\)\.possible\) return null;/);
  // 고리 설명은 가·나·다가 딱 맞는 고리(3, 6, 9개)를 모두 말한다.
  assert.match(T.why['adj3-ring'][2].say, /3개나 9개인 고리/);
  assert.match(T.why['adj3-ring'][3].say, /동전 수가 3, 6, 9가 아닌 고리/);
  for (const n of [4, 5, 7, 8, 10]) {
    for (let mask = 0; mask < 1 << n; mask++) {
      const coins = Array.from({ length: n }, (_, index) => (mask >> index) & 1);
      assert.ok(solve({ n, shape: 'ring', rule: 'adj3', coins }).possible, `${n}개 고리 ${coins.join('')}`);
    }
  }
});

test('글의 빈칸({이름})은 정해진 이름만 쓴다', () => {
  const allowed = new Set(['k', 'f', 'n', 'no', 'total', 'level', 'tag', 'face']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
  }
  assert.throws(() => fill('{k}번', {}));
  assert.equal(fill('{k}번보다 {k}번', { k: 2 }), '2번보다 2번');
});

test('화면 글에 영어 낱말이 없다(대본과 index.html)', () => {
  for (const [path, text] of strings) {
    const plain = text.replace(/\{[^{}]*\}/g, '');
    assert.doesNotMatch(plain, /[A-Za-z]/, `${path}: ${text}`);
  }
  assert.doesNotMatch(screenText, /[A-Za-z]/, screenText.match(/[^\s]*[A-Za-z][^\s]*/)?.[0]);
});

test('화면 글은 "~요"로 끝나는 말투다(대본의 문장)', () => {
  const spoken = [
    ...Object.values(T.meet),
    ...Object.values(T.home),
    ...Object.values(T.rules),
    ...Object.values(T.guess),
    ...Object.values(T.right),
    T.play.resume,
    T.leave.ask,
    T.solution.possible,
    T.solution.impossible,
    T.solution.zero,
    T.after.harder,
    T.after['harder-make'],
    T.make.intro,
    T.make.possible,
    T.make.impossible,
    T.make.zero,
    ...RULE_KEYS.flatMap((key) => T.why[key].map((slide) => slide.say)),
  ];
  for (const text of spoken) {
    for (const sentence of text.split(/(?<=[.?!])\s+/)) assert.match(sentence, /요[.?!]$/, sentence);
  }
});

test('사실과 다른 말이 없다: 처음 만남의 다섯 개, 두 개씩 뒤집을 때 앞면 수, 같은 규칙의 한 이름', () => {
  // "동전 하나 더 놓기"를 누르면 다섯 개를 모두 앞면으로 새로 놓는다.
  assert.match(T.meet.five, /모두 앞면으로 다시 놓았어요\./);
  // 두 개를 뒤집으면 앞면 수가 그대로일 때도 있다(바로 앞 장).
  assert.doesNotMatch(T.why.any2[1].say, /2개씩만/);
  assert.match(T.why.any2[1].say, /2개 늘거나, 2개 줄거나, 그대로예요/);
  assert.match(T.why.any2[0].strips[2].note, /그대로/);
  // 같은 규칙은 "나란히 붙은 세 개" 하나로 부른다.
  for (const [path, text] of strings) assert.doesNotMatch(text, /이웃한/, `${path}: ${text}`);
  // 목소리로 "다가", "다 다음"이 '모두'로 들리지 않게 자리를 붙여 말한다.
  for (const key of ['adj3-line', 'adj3-ring']) for (const slide of T.why[key]) assert.doesNotMatch(slide.say, /다가 |다 다음/, slide.say);
  // 만들기 화면에는 "선생님, 풀어 보세요" 단추가 있다.
  assert.match(html, /id="make-solve"[^>]*>선생님, 풀어 보세요</);
  assert.match(T.make.intro, /선생님에게 풀어 보라고 할 수도 있어요\.$/);
  // 읽어 주는 동전 이름: 첫째 동전은 "첫 번째"
  assert.equal(T.coinLabel, '{no}번째 동전, {face}면');
  for (const path of ['src/formats/coins.js', 'src/meet.js']) {
    assert.match(readFileSync(resolve(ROOT, path), 'utf8'), /fill\(T\.coinLabel, \{ no: ordinal\(index \+ 1\)/, path);
  }
});

test('"왜 그럴까?" 설명은 규칙마다 그림 서너 장이다', () => {
  for (const key of RULE_KEYS) {
    const slides = T.why[key];
    assert.ok(slides.length >= 3 && slides.length <= 4, `${key}: ${slides.length}장`);
    for (const slide of slides) {
      assert.ok(slide.say.length > 0);
      assert.ok(slide.strips.length >= 1, `${key}: 그림이 없는 장`);
    }
  }
});

test('설명 그림 속의 뒤집기는 모두 그 규칙에 맞는 뒤집기다', () => {
  for (const key of RULE_KEYS) {
    const rule = key.startsWith('adj3') ? 'adj3' : key;
    for (const slide of T.why[key]) {
      for (const strip of slide.strips) {
        const shape = strip.shape ?? 'line';
        if (key === 'adj3-ring') assert.equal(shape, 'ring');
        for (const step of strip.steps) assert.match(step, /^[01]+$/);
        if (strip.labels) assert.equal([...strip.labels].length, strip.steps[0].length, `${key}: 붙인 글자 수`);
        for (let index = 1; index < strip.steps.length; index++) {
          const before = toCoins(strip.steps[index - 1]);
          const after = toCoins(strip.steps[index]);
          assert.equal(before.length, after.length);
          const changed = before.map((coin, at) => (coin !== after[at] ? at : -1)).filter((at) => at >= 0);
          assert.equal(changed.length, RULES[rule].count, `${key}: ${strip.steps[index - 1]} → ${strip.steps[index]}`);
          assert.ok(isMove({ n: before.length, shape, rule, coins: before }, changed), `${key}: ${strip.steps[index - 1]} → ${strip.steps[index]}`);
          if (strip.mark && strip.steps.length === 2) assert.deepEqual(strip.mark, changed, `${key}: 눈에 띄게 한 동전`);
        }
      }
    }
  }
});

test('설명 그림에 적은 앞면의 수가 그림과 맞는다', () => {
  // "앞면이 3개, 1개, 1개예요"처럼 차례로 적은 수
  const any2 = T.why.any2[1].strips[0];
  assert.deepEqual(any2.steps.map((step) => headCount(toCoins(step))), [3, 1, 1]);
  assert.match(any2.note, /3개, 1개, 1개/);
  const any3 = T.why.any3[1].strips[0];
  assert.deepEqual(any3.steps.map((step) => headCount(toCoins(step))), [4, 1, 2]);
  assert.match(any3.note, /4개, 1개, 2개/);
  // "앞면이 가 2개, 나 0개, 다 1개예요"처럼 자리별로 적은 수
  for (const key of ['adj3-line', 'adj3-ring']) {
    for (const slide of T.why[key]) {
      for (const strip of slide.strips) {
        const counted = strip.note?.match(/가 (\d)개, 나 (\d)개, 다 (\d)개/);
        if (!counted) continue;
        const coins = toCoins(strip.steps[0]);
        const byLabel = { 가: 0, 나: 0, 다: 0 };
        [...strip.labels].forEach((label, index) => {
          byLabel[label] += coins[index];
        });
        assert.deepEqual([byLabel.가, byLabel.나, byLabel.다], counted.slice(1).map(Number), `${key}: ${strip.note}`);
      }
    }
  }
});

test('설명에서 "안 되는 판"의 보기로 든 판은 풀이 프로그램으로도 안 되는 판이다', () => {
  assert.equal(solve({ n: 5, shape: 'line', rule: 'any2', coins: toCoins('11100') }).possible, false);
  assert.equal(solve({ n: 6, shape: 'line', rule: 'adj3', coins: toCoins('100000') }).possible, false);
  assert.equal(solve({ n: 6, shape: 'ring', rule: 'adj3', coins: toCoins('100000') }).possible, false);
});

test('index.html: 답 넣기에 숫자판과 "불가능해요" 단추가 있고, 끝난 뒤 고를 것 네 가지와 느낌 표시 세 가지가 있다', () => {
  for (let digit = 0; digit <= 9; digit++) assert.ok(html.includes(`data-key="${digit}"`), `숫자 ${digit}`);
  assert.match(html, /id="impossible"[^>]*>불가능해요</);
  for (const label of ['같은 단계 새 판', '더 어려운 판', '직접 만들기', '그만하기']) assert.ok(screenText.includes(label), label);
  for (const label of ['쉬웠어요', '딱 좋았어요', '어려웠어요']) assert.ok(screenText.includes(label), label);
  for (const label of ['처음으로 되돌리기', '한 번 무르기', '막혔어요', '왜 그럴까?', '풀이 볼래요?', '이어서 하기']) assert.ok(screenText.includes(label), label);
});

test('처음 만남: 네 개짜리 판은 되고 다섯 개짜리 판은 안 된다(풀이 프로그램으로 확인)', () => {
  // 처음 만남의 코드는 src/meet.js에 있다.
  const main = readFileSync(resolve(ROOT, 'src/meet.js'), 'utf8');
  const meet = main.match(/const MEET = \{ rule: '(\w+)', shape: '(\w+)', first: (\d+), second: (\d+), cannotAfter: (\d+), oddAfter: (\d+) \}/);
  assert.ok(meet, 'MEET 값을 읽지 못했어요');
  const [, rule, shape, first, second, cannotAfter] = meet;
  const allHeads = (n) => ({ n, shape, rule, coins: Array(n).fill(1) });
  const easy = solve(allHeads(Number(first)));
  assert.equal(easy.possible, true);
  assert.equal(easy.min, 2);
  assert.equal(solve(allHeads(Number(second))).possible, false);
  // "안 되는 것 같아요"는 해 본 뒤에야 나온다.
  assert.ok(Number(cannotAfter) >= 1);
  for (const key of ['start', 'flipped', 'fourDone', 'five', 'odd', 'reveal']) assert.ok(T.meet[key], key);
  // 까닭은 말해 주지 않는다. 묻기만 한다.
  assert.match(T.meet.reveal, /왜 그럴까요\?/);
  assert.doesNotMatch(Object.values(T.meet).join(' '), /홀수|짝수/);
  assert.ok(sentenceCount(T.meet.reveal) <= 4);
});

test('처음 화면: 단계마다 그림이 있고, 테두리를 친 동전들은 그 단계의 규칙에 맞는 한 번의 뒤집기다', () => {
  for (const rung of LADDER) {
    const picture = T.levels.find((entry) => entry.level === rung.level).picture;
    assert.ok(picture, `${rung.level}단계의 그림`);
    assert.match(picture.coins, /^[01]+$/);
    if (!rung.rule) {
      assert.equal(picture.blank, true);
      continue;
    }
    const shape = picture.shape ?? 'line';
    assert.equal(shape, rung.shape, `${rung.level}단계의 모양`);
    const coins = toCoins(picture.coins);
    assert.ok(isMove({ n: coins.length, shape, rule: rung.rule, coins }, picture.mark), `${rung.level}단계의 테두리`);
    if (rung.start === 'all-heads') assert.equal(headCount(coins), coins.length, `${rung.level}단계는 모두 앞면`);
    else assert.ok(headCount(coins) > 0 && headCount(coins) < coins.length, `${rung.level}단계는 섞인 판`);
  }
  assert.equal(T.blank, '?');
});

test('index.html: 처음 만남과 처음 화면의 단추가 있다', () => {
  for (const label of ['건너뛰기', '동전 하나 더 놓기', '안 되는 것 같아요', '연구소로 들어가기', '해 보기', '판 고르기', '만들기', '하던 판', '처음 만남 다시 보기']) {
    assert.ok(screenText.includes(label), label);
  }
  for (const id of ['meet', 'home', 'home-sample', 'home-blank', 'resume-board', 'picker', 'levels', 'meet-board']) assert.ok(html.includes(`id="${id}"`), id);
});
