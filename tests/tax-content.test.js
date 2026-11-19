// 약수 세금 대본 점검: 화면에 나오는 글이 약속을 지키는지, 그림 속의 차례와 합이 풀이 프로그램과 맞는지 본다.
// 이 형식에서 새로 지키는 것도 여기서 본다: 틀린 답이 없다(덜 가진 판은 틀린 판이 아니다),
// 가진 수의 합은 놀이의 내용이고 다른 것으로 바꿔 보여 주지 않는다, "여기까지 할래요"도 떳떳한 끝이다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { TUNING, recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { LADDER, MAKE_LEVEL, generateBoard, rungOf } from '../src/core/tax-ladder.js';
import { MAX_CARD, MIN_N, cardsUpTo, greedyLargest, properDivisors, replay, solve, takeable, taxOf } from '../src/core/tax.js';
import { endsClosed, fill, sentenceCount } from '../src/core/text.js';
import { columnsFor } from '../src/ui/tax-board.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/tax.json'));
const C = JSON.parse(read('src/content/coins.json'));
const html = read('index.html');
const css = read('src/app.css').replace(/\/\*[\s\S]*?\*\//g, '');
const code = read('src/formats/tax.js');

const HINT_KEYS = ['start', 'more'];
const RIGHT_KEYS = ['best', 'first-try', 'after', 'stopped', 'stopped-tries', 'why-invite'];
const STATUS_KEYS = ['preview', 'took', 'shut', 'ended'];
const PLAY_KEYS = ['more', 'more-up', 'unknown'];

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
/** index.html에서 이 형식의 자리: 처음 화면의 카드, 도구 단추, 판 아래, 답하는 칸, 직접 만들기 */
const own = [part('id="tax-title"', 'id="make-title"'), part('id="tax-costs"', 'id="why"'), part('id="tax-count"', 'id="duel-count"'), part('id="tax-pad"', 'id="duel-pad"'), part('id="make-tax"', '<script')]
  .map(visibleText)
  .join(' ');
const be = (number) => T.be[endsClosed(number) ? 'closed' : 'open'];
const facts = (sum, tax) => ({ sum, sumBe: be(sum), tax, taxBe: be(tax) });
const board = (n) => ({ cards: cardsUpTo(n) });

test('대본을 읽을 수 있고, 글이 비어 있지 않다', () => {
  assert.ok(strings.length > 50);
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.equal(T.title, '약수 세금');
});

test('단계 목록이 사다리와 같고, 표시는 기본·응용·응용·도전·도전이다', () => {
  assert.deepEqual(T.levels.map((entry) => entry.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(LADDER.map((rung) => C.tags[rung.tag]), ['기본', '응용', '응용', '도전', '도전']);
  assert.equal(T.levels.at(-1).level, MAKE_LEVEL);
  assert.equal(T.levels.at(-1).name, '직접 만들기');
  // 단계의 이름에 적은 카드의 수는 그 단계에서 나오는 가장 작은 판과 가장 큰 판이다.
  for (const rung of LADDER.filter((item) => item.mode !== 'make')) {
    const name = T.levels.find((entry) => entry.level === rung.level).name;
    assert.equal(name, `카드 ${Math.min(...rung.boards)}장부터 ${Math.max(...rung.boards)}장까지`, `${rung.level}단계`);
  }
});

test('규칙 설명은 세 문장을 넘지 않고, "약수"라는 말을 보기 하나로 풀어 준다', () => {
  assert.deepEqual(Object.keys(T.rules), ['play']);
  assert.equal(sentenceCount(T.rules.play), 3, T.rules.play);
  // 가진 카드는 세금으로 나가지 않는다: 나가는 것은 그 수의 "다른" 약수다.
  assert.match(T.rules.play, /판에 남은 그 수의 다른 약수가 모두 세금으로 나가요/);
  assert.match(T.rules.play, /가진 수의 합을 가장 크게/);
  // 보기로 든 카드를 가지면 나가는 카드는 정말 그 수의 (자기 자신을 뺀) 약수 모두다. 가진 수 자신은 들어 있지 않다.
  const [, number, list] = T.rules.play.match(/(\d+)을 가지면 ([\d, ]+)이 나가요/);
  assert.deepEqual(list.split(', ').map(Number), properDivisors(Number(number)));
  assert.ok(!list.split(', ').map(Number).includes(Number(number)));
  assert.equal(Number(number), 6);
  // 처음 판(1부터 6까지)에서 정말 그렇게 나간다.
  assert.deepEqual(replay(board(6), [6]).paid[0], list.split(', ').map(Number));
  // 직접 만들기 화면의 안내 글도 세 문장 안쪽이다. 가질 수 있는 카드가 없는 판을 만들어 보라고 권한다.
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 20, '직접 만들기 안내 글은 형식마다 하나');
  assert.ok(sentenceCount(guides[6]) <= 3, guides[6]);
  assert.match(guides[6], /가질 수 있는 카드가 하나도 없는 판도 만들 수 있을까요\?/);
  // 판이 보여 주는 나머지 규칙: 가질 수 없는 카드를 누르면 왜 못 가지는지 한 줄이 나온다.
  assert.equal(T.status.shut, '세금으로 낼 약수가 남아 있지 않아요');
});

test('가진 수의 합은 놀이의 내용이다: 다른 것으로 바꿔 부르지 않고, 다른 판이나 다른 날과 견주지 않는다', () => {
  const reward = /점수|득점|만점|점이에요|\d점|등급|순위|기록을 깨|신기록|최고 기록|지난번|어제|다른 판보다|몇 판|판째/;
  for (const [path, text] of strings) assert.doesNotMatch(text, reward, `${path}: ${text}`);
  assert.doesNotMatch(own, reward);
  // 부르는 이름은 "가진 수의 합"과 "세금"이다.
  assert.match(T.play.more, /^가진 수의 합은 /);
  assert.match(T.play.more, /세금은 /);
  assert.deepEqual(T.names, { held: '가진 카드', gone: '세금으로 나간 카드' });
  assert.equal(fill(T.sum, { n: 15 }), '합 15');
  // 자기 기록은 이 판에서 가장 많이 가진 합 하나만 보여 준다. 몇 번 했는지를 세는 자리는 없다.
  assert.match(html, /id="tax-best-line" hidden>이 판에서 가장 많이 가진 합: <strong id="tax-best"><\/strong>/);
  assert.equal([...part('id="tax-count"', 'id="duel-count"').matchAll(/<strong/g)].length, 1);
  assert.equal([...part('id="tax-pad"', 'id="duel-pad"').matchAll(/<strong/g)].length, 0);
});

test('틀린 답이 없다: 덜 가진 판에서는 사실을 말하고 "더 많이 가질 수 있을까요?"라고 묻는다', () => {
  assert.deepEqual(Object.keys(T.play).sort(), [...PLAY_KEYS].sort());
  assert.equal(fill(T.play.more, facts(27, 28)), '가진 수의 합은 27이에요. 세금은 28이에요. 더 많이 가질 수 있을까요?');
  assert.equal(fill(T.play.more, facts(9, 12)), '가진 수의 합은 9예요. 세금은 12예요. 더 많이 가질 수 있을까요?');
  assert.match(fill(T.play['more-up'], facts(10, 11)), /아까보다 많이 가졌어요\. 더 많이 가질 수 있을까요\?$/);
  const wrong = /틀렸|틀린|아니에요|땡|아쉽|모자라|부족|실패|것 같아요|다시 생각/;
  for (const [path, text] of strings) assert.doesNotMatch(text, wrong, `${path}: ${text}`);
  assert.doesNotMatch(own, wrong);
  // 다시 해도 되고 여기까지 해도 된다. "여기까지 할래요"로 끝낸 판도 끝까지 한 판이다.
  assert.match(html, /id="tax-again"[^>]*>처음부터 다시 해 볼래요</);
  assert.match(html, /id="tax-stop"[^>]*>여기까지 할래요</);
  assert.match(code, /function stop\(\) \{[\s\S]*?round\.stopped = true;[\s\S]*?frame\.finish\('solved'\);/);
  // 가장 큰 합에 닿으면 그렇다고 말하고 판이 끝난다.
  assert.equal(fill(T.right.best, facts(15, 6)), '가진 수의 합은 15예요. 세금은 6이에요. 이보다 많이 가질 수는 없어요.');
  assert.match(code, /const reached = solution\.exact && state\.sum === solution\.best;/);
  // 풀이 프로그램이 끝까지 못 따진 판에서는 가장 큰 합이라고 말하지 않고, 못 따졌다고 사실대로 말한다.
  // 이 말은 형식 사이에 같은 꼴("끝까지 따져 보지 못했어요")이다.
  assert.match(T.play.unknown, /선생님도 끝까지 따져 보지 못했어요\.$/);
  assert.match(T.make.unknown, /^선생님도 끝까지 따져 보지 못했어요\./);
  assert.match(T.solution.unknown, /^선생님도 끝까지 따져 보지 못했어요\./);
  for (const [path, text] of strings) assert.doesNotMatch(text, /못 따졌/, `${path}: ${text}`);
});

test('수 뒤에 붙는 말은 수를 읽은 소리에 맞춘다', () => {
  assert.deepEqual(T.be, { open: '예요', closed: '이에요' });
  assert.equal(`${15}${be(15)}`, '15예요');
  assert.equal(`${40}${be(40)}`, '40이에요');
  assert.equal(`${301}${be(301)}`, '301이에요');
  assert.equal(`${124}${be(124)}`, '124예요');
  // 대본에 수를 바로 적은 곳도 같다.
  for (const [path, text] of strings) {
    for (const [, number, tail] of text.matchAll(/(\d+)(이에요|예요)/g)) assert.equal(tail, be(Number(number)), `${path}: ${text}`);
  }
});

test('힌트는 단계 묶음마다 두 개이고, 하나하나가 질문 한 문장이다', () => {
  assert.deepEqual(Object.keys(T.hints).sort(), [...HINT_KEYS].sort());
  for (const rung of LADDER) assert.ok(T.hints[rung.hint], `${rung.level}단계의 힌트`);
  for (const key of HINT_KEYS) {
    const hints = T.hints[key];
    assert.equal(hints.length, tuningFor('tax').hintCount, key);
    assert.equal(hints.length, 2, key);
    for (const hint of hints) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
    }
    assert.equal(new Set(hints).size, hints.length, `${key}: 같은 힌트가 두 번 있어요`);
  }
});

test('힌트는 두 높이다: 첫째는 무엇을 해 볼지만, 둘째는 어디를 볼지까지만 묻는다. 까닭을 말해 버리지 않는다', () => {
  for (const key of HINT_KEYS) {
    const [first, second] = T.hints[key];
    // 첫째: 해 볼 일을 묻는다. 세금이나 약수를 말하지 않는다.
    assert.doesNotMatch(first, /세금|약수/, first);
    // 둘째: 볼 곳(카드)을 가리킨다.
    assert.match(second, /카드는 어느 것/, second);
    // 답을 말해 버리지 않는다: 어느 카드부터인지, 왜 그런지가 들어 있지 않다.
    for (const hint of [first, second]) {
      assert.doesNotMatch(hint, /큰 카드|가장 큰|작은 카드|소수|1만|1은|먼저 가지|나중에 가지|때문|해야 해요|하면 돼요|\d/, hint);
    }
  }
  assert.match(T.hints.start[0], /맨 처음 카드를 다른 것으로/);
  assert.match(T.hints.start[1], /세금을 한 장만 내고/);
  assert.match(T.hints.more[0], /^카드가 더 적은 판이라면/);
  assert.match(T.hints.more[1], /끝났을 때 판에 남아 있던 카드/);
});

test('도구 "카드마다 낼 세금 보기"는 힌트 하나를 연 것으로 적는다', () => {
  assert.deepEqual(T.tool, { off: '카드마다 낼 세금 보기', on: '낼 세금 그만 보기' });
  assert.match(html, /id="tax-costs"[^>]*aria-pressed="false" hidden>카드마다 낼 세금 보기</);
  assert.match(code, /hintsOpened: round\.hintsOpened \+ \(round\.costsShown \? 1 : 0\)/);
  assert.match(code, /round\.costsShown = true;/);
  // 적는 것은 지금 가질 수 있는 카드마다의, 세금으로 나갈 수의 합이다.
  assert.match(code, /state\.open\.map\(\(card\) => \[card, total\(taxOf\(state\.remaining, card\)\)\]\)/);
  assert.equal(fill(T.costLabel, { k: 12, what: T.cards.open, c: 16 }), '12, 가질 수 있는 카드, 낼 세금 16');
});

test('끝났을 때 하는 말은 한 일을 그대로 말하고, 칭찬 낱말을 쓰지 않는다', () => {
  const praise = /최고|잘했|대단|훌륭|멋져|멋진|천재|똑똑|완벽|짱|굉장|축하|성공/;
  for (const [path, text] of strings) assert.doesNotMatch(text, praise, `${path}: ${text}`);
  assert.doesNotMatch(own, praise);
  assert.deepEqual(Object.keys(T.right).sort(), [...RIGHT_KEYS].sort());
  // 가진 수의 합, 세금, 몇 번 다시 해 봤는지
  assert.equal(T.right['first-try'], '다시 해 보지 않고 찾아냈어요.');
  assert.equal(fill(T.right.after, { r: 3 }), '3번 다시 해서 찾아냈어요.');
  assert.equal(fill(T.right.stopped, facts(27, 28)), '이 판에서 가장 많이 가진 합은 27이에요. 그때 세금은 28이에요. 여기까지 했어요.');
  assert.equal(fill(T.right['stopped-tries'], { r: 2 }), '2번 다시 해 봤어요.');
  // "여기까지 했어요"가 맨 끝에 온다: 몇 번 다시 해 봤는지를 먼저 말한다.
  assert.match(code, /if \(retries > 0\) parts\.push\(fill\(T\.right\['stopped-tries'\], \{ r: retries \}\)\);\s*parts\.push\(fill\(T\.right\.stopped, /);
  assert.match(T.right.stopped, /여기까지 했어요\.$/);
  // "왜 그럴까?"를 권하는 말의 주어는 "선생님이"다.
  assert.equal(T.right['why-invite'], '선생님이 어떻게 찾았는지 궁금하면 왜 그럴까 단추를 눌러 보세요.');
  // "왜 그럴까?"를 권하는 말은 까닭을 미리 말하지 않는다.
  assert.match(T.right['why-invite'], /왜 그럴까 단추/);
  assert.doesNotMatch(T.right['why-invite'], /큰 카드|세금|\d/);
});

test('글의 빈칸({이름})은 정해진 이름만 쓴다', () => {
  const allowed = new Set(['n', 'k', 'what', 'c', 'list', 'sum', 'sumBe', 'tax', 'taxBe', 'r', 'be', 'no', 'order']);
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
  const values = { ...facts(27, 28), k: 12, be: be(12), list: '1, 2, 3', r: 2, order: '5, 4, 6' };
  const spoken = [
    T.home.ask,
    T.home.pick,
    T.rules.play,
    ...Object.values(T.play),
    ...HINT_KEYS.flatMap((key) => T.hints[key]),
    ...Object.values(T.right),
    T.solution.say,
    T.solution.unknown,
    T.solution.none,
    T.make.intro,
    T.make.best,
    T.make.none,
    T.make.unknown,
    ...T.why.map((slide) => slide.say),
  ];
  for (const text of spoken) for (const sentence of sentences(fill(text, values))) assert.match(sentence, /요[.?!]$/, sentence);
  // 마침표 없이 쓰는 짧은 글도 "~요"로 끝난다.
  for (const key of STATUS_KEYS) assert.match(fill(T.status[key], values), /요$/, key);
  for (const text of T.why.flatMap((slide) => slide.figures.map((item) => item.note))) assert.match(text, /요$/, text);
});

test('한 문장에 한 가지 뜻: 문장이 너무 길지 않다(60자 이하)', () => {
  for (const [path, text] of strings) {
    for (const sentence of sentences(text)) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
  }
});

test('판 아래의 한 줄 글: 무엇이 세금으로 나갈지, 왜 못 가지는지', () => {
  assert.deepEqual(Object.keys(T.status).sort(), [...STATUS_KEYS].sort());
  assert.equal(fill(T.status.preview, { k: 12, list: '1, 2, 3, 4, 6' }), '12 카드를 가지면 1, 2, 3, 4, 6 카드가 세금으로 나가요');
  assert.equal(fill(T.status.took, { k: 5, list: '1' }), '5 카드를 가졌어요. 1 카드가 세금으로 나갔어요');
  assert.equal(T.status.ended, '더 가질 수 있는 카드가 없어요');
  // 가장 긴 글(30을 고를 때)도 한 줄에 들어갈 만하다.
  const longest = fill(T.status.preview, { k: 30, list: properDivisors(30).join(', ') });
  assert.ok([...longest].length <= 46, longest);
  // 카드를 읽어 주는 이름
  assert.deepEqual(Object.keys(T.cards), ['open', 'shut', 'pick', 'due', 'left']);
  assert.equal(fill(T.cardLabel, { k: 7, what: T.cards.shut }), '7, 가질 수 없는 카드');
});

test('까닭과 생각의 이름은 "왜 그럴까?"에서만 말한다', () => {
  const name = /내다보기/;
  const reason = /큰 카드부터|가장 큰 카드|1만 내고|조금만 내고|늘 가장 좋지는|한꺼번에/;
  for (const [path, text] of strings) {
    if (path.startsWith('why')) continue;
    assert.doesNotMatch(text, name, `${path}: ${text}`);
    assert.doesNotMatch(text, reason, `${path}: ${text}`);
  }
  assert.doesNotMatch(screenText, name);
  assert.doesNotMatch(own, reason);
  // 이름은 맨 마지막 장에서 처음 꺼낸다(뜻밖의 결과 → 그림 → 이름).
  for (const slide of T.why.slice(0, -1)) assert.doesNotMatch(slide.say, name);
  assert.match(T.why.at(-1).say, name);
  // 어려운 낱말("소수")은 어디에도 쓰지 않는다.
  for (const [path, text] of strings) assert.doesNotMatch(text, /소수|배수|최적|전략|탐욕/, `${path}: ${text}`);
});

test('"왜 그럴까?"는 그림 서너 장이고, 설명이 아니라 어떻게 알아챘는지의 이야기다', () => {
  assert.ok(T.why.length >= 3 && T.why.length <= 4, `${T.why.length}장`);
  for (const slide of T.why) {
    assert.ok(slide.say.length > 0);
    assert.ok(sentenceCount(slide.say) <= 3, slide.say);
    assert.ok(slide.figures.length >= 1 && slide.figures.length <= 2, '그림은 한두 장');
  }
  // 줄거리: 선생님도 처음엔 가장 큰 카드부터 가졌다(뜻밖의 결과: 세금이 한꺼번에 나가고 가질 수 없는 카드가 남았다)
  //        → 1을 눈여겨봤다 → 세금을 조금만 내고 가질 수 있는 큰 카드를 찾았다 → 큰 것부터가 늘 가장 좋지는 않았다
  assert.match(T.why[0].say, /^선생님도 처음엔 가장 큰 카드부터 가졌어요/);
  assert.match(T.why[0].say, /한꺼번에 세금으로 나갔어요/);
  assert.match(T.why[0].say, /가질 수 없었어요/);
  assert.match(T.why[1].say, /1은 어느 카드를 가져도 맨 처음에 세금으로 나가요/);
  assert.match(T.why[1].say, /1만 내고 가질 수 있는 가장 큰 카드/);
  assert.match(T.why[2].say, /세금을 조금만 내고 가질 수 있는 큰 카드/);
  assert.match(T.why[3].say, /^큰 카드부터 가지는 것이 늘 가장 좋지는 않았어요/);
  for (const [path, text] of strings) assert.doesNotMatch(text, /갖는|갖고|갖지/, `${path}: ${text}`);
  // 이야기의 말투: 겪은 일로 말한다.
  for (const slide of T.why) assert.match(slide.say, /봤어요|았어요|었어요/, slide.say);
  // "왜 그럴까?"가 열리는 때: 이 형식의 판을 가장 큰 합으로 한 번 끝낸 뒤
  assert.equal(tuningFor('tax').whyAfter, 'best');
});

test('"왜 그럴까?" 그림 속의 차례와 합은 풀이 프로그램이 따진 것과 같다', () => {
  let checked = 0;
  for (const slide of T.why) {
    for (const item of slide.figures) {
      const where = item.note;
      const played = replay(board(item.n), item.taken);
      assert.equal(played.ok, true, where);
      assert.equal(played.sum, item.sum, where);
      // 하던 가운데의 그림은 그때까지 나간 세금을, 끝난 그림은 남은 카드까지 더한 세금을 적는다.
      assert.equal(played.tax, item.tax, where);
      const best = solve(board(item.n)).best;
      // "가장 큰 카드부터 가졌다"는 그림: 정말 그 차례이고, 끝난 판이고, 가장 큰 합보다 적다.
      if (item.largest) {
        assert.deepEqual(item.taken, greedyLargest(board(item.n)).order, where);
        assert.equal(played.ended, true, where);
        assert.ok(item.sum < best, `${where}: 가장 큰 합 ${best}`);
        assert.ok(played.left.length >= 2, `${where}: 가질 수 없게 된 카드가 남는다`);
      }
      // "이보다 많이 가질 수는 없다"는 그림: 풀이 프로그램의 가장 큰 합과 같다.
      if (item.best) {
        assert.equal(played.ended, true, where);
        assert.equal(item.sum, best, where);
      }
      // "세금은 1뿐"이라는 그림: 그 카드의 세금은 1뿐이고, 그런 카드 가운데 가장 크다.
      if (item.onlyOne) {
        const [card] = item.taken;
        const cards = cardsUpTo(item.n);
        assert.deepEqual(played.paid, [[1]], where);
        assert.equal(Math.max(...takeable(cards).filter((other) => taxOf(cards, other).join() === '1')), card, where);
        assert.ok(item.note.startsWith(`${card}를 가졌어요`), where);
      }
      for (const number of [item.sum, ...(item.onlyOne ? [] : [item.tax])]) if (item.n === 6) assert.ok(item.note.includes(String(number)), `${where}: ${number}`);
      checked += 1;
    }
  }
  assert.equal(checked, 5);
  // 첫 장의 말: 6을 가지면 1, 2, 3이 나가고 4와 5는 가질 수 없다.
  const first = replay(board(6), [6]);
  assert.deepEqual([first.paid[0], first.left, first.open], [[1, 2, 3], [4, 5], []]);
  // 셋째 장의 말: 5를 가진 뒤 4는 2만 내면 되고, 그 뒤 6은 3만 내면 된다.
  assert.deepEqual(taxOf(replay(board(6), [5]).remaining, 4), [2]);
  assert.deepEqual(taxOf(replay(board(6), [5, 4]).remaining, 6), [3]);
  // 맨 끝 장의 두 그림은 같은 판이고, 큰 카드부터 가질 때의 합과 가장 큰 합이 실제로 다르다. 그 수가 글에 적혀 있다.
  const [largest, best] = T.why.at(-1).figures;
  assert.equal(largest.n, best.n);
  assert.equal(greedyLargest(board(largest.n)).sum, largest.sum);
  assert.equal(solve(board(best.n)).best, best.sum);
  assert.ok(largest.sum < best.sum);
  assert.ok(largest.note.includes(`카드 ${largest.n}장`) && largest.note.includes(`합은 ${largest.sum}`));
  assert.ok(best.note.includes(`합은 ${best.sum}`));
  // 이야기에서 차례를 다 보여 주는 판: 형식의 맨 첫 판(6장)과, 사다리에 없는 판(9장)뿐이다.
  const ladder = LADDER.flatMap((rung) => rung.boards ?? []);
  assert.equal(generateBoard(1, 1).board.cards.length, 6);
  for (const item of T.why.flatMap((slide) => slide.figures)) assert.ok(item.n === 6 || !ladder.includes(item.n), `${item.n}장`);
});

test('판 고르기의 그림: 단계마다 그 단계의 첫 판이다', () => {
  for (const rung of LADDER) {
    const picture = T.levels.find((entry) => entry.level === rung.level).picture;
    if (rung.mode === 'make') assert.equal(picture.blank, true);
    else assert.equal(picture.n, rung.boards[0], `${rung.level}단계`);
  }
  assert.equal(T.home.ask, '얼마나 많이 가질 수 있을까요?');
});

test('풀이와 직접 만들기의 글: 가장 많이 가질 수 있는 합과 한 가지 방법을 알려 준다', () => {
  assert.equal(fill(T.solution.say, { k: 40, be: be(40) }), '가장 많이 가질 수 있는 합은 40이에요. 한 가지 방법을 보여 줄게요.');
  assert.match(T.solution.unknown, /그 방법을 보여 줄게요\.$/);
  // 만들기 안내의 끝은 형식 사이에 같은 꼴이다("선생님, 풀어 보세요" 단추가 있다).
  assert.match(T.make.intro, /다 정하면 선생님에게 풀어 보라고 할 수도 있어요\.$/);
  assert.match(html, /id="tax-make-solve"[^>]*>선생님, 풀어 보세요</);
  assert.equal(fill(T.solution.stepLabel, { no: 3 }), '3번');
  assert.equal(fill(T.make.best, { k: 15, be: be(15), order: '5, 4, 6' }), '가장 많이 가질 수 있는 합은 15예요. 5, 4, 6 차례로 가지면 돼요.');
  assert.equal(T.make.none, '이 판에는 가질 수 있는 카드가 없어요.');
  assert.equal(fill(T.make.upTo, { n: 30 }), '30까지');
  assert.equal(fill(T.make.on, { k: 7 }), '7, 놓인 카드');
  assert.equal(fill(T.make.off, { k: 7 }), '7, 뺀 카드');
  // 가질 수 있는 카드가 하나도 없는 판은 해 볼 수 없다. 그렇다고 알려 주고 해 보는 단추를 끈다.
  assert.match(code, /\$\('tax-make-play'\)\.disabled = dead;/);
  assert.match(code, /if \(dead\) \$\('tax-make-result'\)\.textContent = T\.make\.none;/);
  // 만든 판은 풀이 프로그램이 풀고, 그 결과를 기록에 남긴다.
  assert.match(code, /kind: 'made',/);
  assert.match(code, /solution: \{ possible: true, exact: result\.exact, best: result\.best, order: result\.order, total: result\.total \},/);
  // 정할 수 있는 수는 2부터 30까지다.
  assert.deepEqual([MIN_N, MAX_CARD], [2, 30]);
});

test('index.html: 약수 세금의 카드, 판, 답하는 칸, 도구, 직접 만들기가 있다', () => {
  for (const id of [
    'home-tax-sample',
    'home-tax-ask',
    'home-tax-play',
    'home-tax-pick',
    'home-tax-make',
    'home-tax-blank',
    'tax-board',
    'tax-count',
    'tax-best-line',
    'tax-best',
    'tax-costs',
    'tax-pad',
    'tax-take',
    'tax-again',
    'tax-stop',
    'make-tax',
    'tax-make-n',
    'tax-make-fewer',
    'tax-make-more',
    'tax-make-clear',
    'tax-make-board',
    'tax-make-result',
  ]) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(html, /id="tax-take"[^>]*disabled>가질래요</);
  assert.match(html, /id="tax-make-solve"[^>]*>선생님, 풀어 보세요</);
  assert.match(html, /id="tax-make-play"[^>]*>내가 해 볼래요</);
  for (const label of ['약수 세금', '카드를 가져요', '가질래요', '처음부터 다시 해 볼래요', '여기까지 할래요', '카드마다 낼 세금 보기', '뺀 카드 모두 다시 놓기']) assert.ok(screenText.includes(label), label);
  // 처음 화면의 물음은 대본에 있는 것과 같다.
  assert.match(html, new RegExp(`id="home-tax-ask"[^>]*>${T.home.ask.replace('?', '\\?')}<`));
  // 카드는 "퍼즐 만들기" 앞, 누가 이길까 뒤에 있고, "만들기" 목록에도 있다.
  assert.ok(html.indexOf('id="duel-title"') < html.indexOf('id="tax-title"'));
  assert.ok(html.indexOf('id="tax-title"') < html.indexOf('id="make-title"'));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-tax-make" class="menu-item"/);
  // 미리 보기: 누르면 고르고, 한 번 더 누르면 가진다. 판을 보이는 글에 그렇게 적혀 있다.
  assert.ok(visibleText(part('id="tax-pad"', 'id="duel-pad"')).includes('한 번 더 누르면 가져요'));
  assert.match(code, /if \(pick === card\) \{\s*take\(card\);/);
});

test('처음 화면: 카드 스물한 장이 가로 1280px에서 넉 장씩 여섯 줄로 놓이고, 셋째 줄이 있다는 것이 보인다', () => {
  const cards = part('id="doors"', 'id="make-menu"');
  assert.equal([...cards.matchAll(/class="panel door[ "]/g)].length, 21);
  const doors = css.match(/\n\.doors \{([^}]*)\}/)[1];
  const [, width] = doors.match(/grid-template-columns:\s*repeat\(auto-fill,\s*minmax\((\d+)px,\s*1fr\)\)/);
  const [, gap] = doors.match(/gap:\s*(\d+)px/);
  const [, low] = doors.match(/grid-auto-rows:\s*minmax\((\d+)px,\s*\d+px\)/);
  const perRow = Math.floor((1256 + Number(gap)) / (Number(width) + Number(gap)));
  assert.equal(perRow, 4);
  assert.equal(Math.ceil(21 / perRow), 6);
  // 높이 800px에서 하던 판 띠가 있어도(카드 칸의 높이 426px) 두 줄이 굴리지 않고 들어가고, 셋째 줄의 제목(40px)이 보인다.
  assert.ok(2 * Number(low) + Number(gap) <= 426);
  assert.ok(2 * Number(low) + 2 * Number(gap) + 40 <= 426);
});

test('카드는 30장일 때도 손가락으로 누를 만한 크기다(52px 이상)', () => {
  const block = (selector) => css.match(new RegExp(`\\n${selector.replace(/[.]/g, '\\.')} \\{([^}]*)\\}`))[1];
  const card = block('.tax-card,\n.tax-slot');
  const [, minHeight] = card.match(/min-height:\s*(\d+)px/);
  assert.ok(Number(minHeight) >= 52, `카드의 가장 낮은 높이 ${minHeight}px`);
  const grid = block('.tax-grid');
  const [, gap] = grid.match(/gap:\s*(\d+)px/);
  const [, widest] = grid.match(/minmax\(0,\s*(\d+)px\)/);
  // 한 줄에 놓는 카드: 여섯 장까지는 한 줄, 스무 장까지는 두 줄, 그보다 많으면 세 줄. 한 줄에 열 장을 넘지 않는다.
  assert.deepEqual([6, 8, 10, 12, 16, 20, 21, 24, 25, 30].map(columnsFor), [6, 4, 5, 6, 8, 10, 7, 8, 9, 10]);
  for (let count = 1; count <= MAX_CARD; count++) assert.ok(columnsFor(count) <= 10 && Math.ceil(count / columnsFor(count)) <= 3, `${count}장`);
  // 가로 1280px에서 판이 놓이는 칸의 안쪽 너비: 1280 - 양쪽 칸(260 + 350) - 틈과 둘레(12 × 4) - 칸 안의 둘레(14 × 2) - 판 둘레(2 × 2)
  const inner = 1280 - 260 - 350 - 48 - 28 - 4;
  const columns = columnsFor(30);
  const width = Math.min(Number(widest), (inner - (columns - 1) * Number(gap)) / columns);
  assert.ok(width >= 52, `30장일 때 카드의 너비 ${width}px`);
  // 좁은 화면에서는 한 줄에 들어가는 만큼만 놓아서 52px보다 작아지지 않는다.
  assert.match(css, /@media \(max-width: 700px\) \{\s*\.tax-board:not\(\.small\) \.tax-grid \{\s*grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(52px,/);
});

test('색만으로 알리지 않는다: 고른 카드와 세금으로 나갈 카드는 테두리와 작은 표시가 다르다', () => {
  const block = (selector) => css.match(new RegExp(`\\n${selector.replace(/[.:]/g, '\\$&')} \\{([^}]*)\\}`))[1];
  assert.match(block('.tax-card.pick'), /box-shadow:/);
  assert.match(block('.tax-card.pick::after'), /border-radius:\s*50%/);
  assert.match(block('.tax-card.due,\n.tax-card.left'), /border:\s*3px dashed/);
  assert.match(block('.tax-card.due::after,\n.tax-card.left::after'), /border-top:\s*10px solid/);
  assert.match(block('.tax-card.shut'), /border:\s*2px dotted/);
  assert.match(block('.tax-chip.held'), /border:\s*2px solid/);
  assert.match(block('.tax-chip.gone'), /border:\s*2px dashed/);
});

// ---- 수준 맞추기 ----
let nextId = 0;
function tax(overrides = {}) {
  nextId += 1;
  return {
    kind: 'round',
    id: `x${nextId}`,
    format: 'tax',
    level: 1,
    seed: nextId,
    custom: false,
    mode: 'play',
    outcome: 'solved',
    hintsOpened: 0,
    answers: [{ t: 40, answer: 'sum:15', correct: true, guess: null }],
    moveCount: 3,
    completions: [15],
    retries: 0,
    best: 15,
    reachedBest: true,
    stopped: false,
    seconds: 40,
    solution: { possible: true, exact: true, best: 15, order: [5, 4, 6], total: 21 },
    ...overrides,
  };
}

test('약수 세금의 수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다', () => {
  const tuning = tuningFor('tax');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 4);
  assert.equal(tuning.hintCount, 2);
  assert.equal(tuning.fastRetries, 2);
  assert.equal(tuning.whyAfter, 'best');
  for (const rung of LADDER.filter((item) => item.mode !== 'make')) assert.ok(tuning.expectedSeconds[rung.level] > 0, `${rung.level}단계의 예상 시간`);
  assert.deepEqual(recommend([], 'tax'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  // 시작 단계의 첫 판은 가장 작은 판(6장)이다.
  assert.deepEqual(generateBoard(recommend([], 'tax').level, 1).board, { cards: [1, 2, 3, 4, 5, 6] });
  assert.equal(rungOf(tuning.startLevel).tag, 'basic');
  // 임시값이라고 적어 두었다.
  assert.match(read('src/core/level.js'), /약수 세금\(모두 임시\)/);
  // 다른 형식의 값은 그대로다.
  assert.equal(tuningFor('coins').startLevel, TUNING.startLevel);
  assert.equal(tuningFor('swap').whyAfter, 'fewest');
  assert.equal(tuningFor('duel').fastWin, true);
  for (const format of ['coins', 'trace', 'code', 'swap', 'tile', 'duel']) assert.equal(tuningFor(format).fastRetries, undefined, format);
});

test('"한 번에 빠르게"는 다시 해 보기 두 번 안에 가장 큰 합에 닿은 것이다. 걸린 시간은 보지 않는다', () => {
  const clean = (overrides = {}) => tax(overrides);
  assert.deepEqual(recommend([clean(), clean()], 'tax'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  assert.equal(recommend([clean()], 'tax').offerHarder, false, '한 판으로는 권하지 않는다');
  assert.equal(recommend([clean(), clean({ retries: 2, completions: [6, 11, 15] })], 'tax').offerHarder, true, '두 번 다시 해 보고 닿았다');
  assert.equal(recommend([clean(), clean({ retries: 3, completions: [6, 9, 11, 15] })], 'tax').offerHarder, false, '세 번 다시 해 봤다');
  assert.equal(recommend([clean(), clean({ hintsOpened: 1 })], 'tax').offerHarder, false, '힌트나 도구를 썼다');
  assert.equal(recommend([clean(), clean({ seconds: 3000 })], 'tax').offerHarder, true, '오래 걸려도 된다');
  assert.equal(recommend([clean(), clean({ level: 2 })], 'tax').offerHarder, false, '같은 단계여야 한다');
  // 맨 위 단계에서는 직접 만들기를 가리킨다.
  assert.deepEqual(recommend([clean({ level: 4 }), clean({ level: 4 })], 'tax'), { level: 4, small: false, offerHarder: true, harderLevel: 5, reason: 'fast' });
});

test('"여기까지 할래요"로 끝낸 판은 그만둔 판이 아니다. 하다가 나간 판만 그만둔 판이다', () => {
  const stopped = (level = 2) => tax({ level, stopped: true, reachedBest: false, best: 40, retries: 1, completions: [22, 40], answers: [{ t: 30, answer: 'sum:22', correct: false, guess: 'less-than-best' }] });
  // 가장 큰 합에 닿지 못하고 여기까지 한 판이 이어져도 내려가지 않는다. 더 어려운 판을 권하지도 않는다.
  assert.deepEqual(recommend([stopped(), stopped(), stopped()], 'tax'), { level: 2, small: false, offerHarder: false, harderLevel: null, reason: 'steady' });
  // 하다가 나간 판이 이어지면 조용히 한 단계 아래를 먼저 보여 준다. 맨 아래에서는 가장 작은 판이다.
  const left = (level) => tax({ level, outcome: 'left', reachedBest: false, best: null, completions: [], answers: [], moveCount: 2 });
  assert.deepEqual(recommend([left(3), left(3)], 'tax'), { level: 2, small: false, offerHarder: false, harderLevel: null, reason: 'quit' });
  assert.deepEqual(recommend([left(1), left(1)], 'tax'), { level: 1, small: true, offerHarder: false, harderLevel: null, reason: 'quit' });
  assert.equal(recommend([left(2)], 'tax').reason, 'steady');
  assert.equal(recommend([left(2), stopped()], 'tax').reason, 'steady');
  // 힌트를 다 열고도 나갔으면 한 판으로도 내려간다.
  assert.equal(recommend([left(3), tax({ level: 3, outcome: 'left', reachedBest: false, answers: [], moveCount: 2, hintsOpened: 2 })], 'tax').level, 2);
  // 들여다보기만 한 판(카드를 가지지도, 힌트를 열지도 않았다)은 세지 않는다. 직접 만든 판도 세지 않는다.
  const peek = () => tax({ level: 2, outcome: 'left', reachedBest: false, answers: [], moveCount: 0 });
  assert.equal(recommend([peek(), peek()], 'tax').reason, 'start');
  const custom = () => tax({ level: 5, custom: true, outcome: 'left', answers: [], moveCount: 4 });
  assert.equal(recommend([custom(), custom()], 'tax').reason, 'start');
  // 다른 형식의 기록은 영향을 주지 않는다.
  for (const format of ['coins', 'trace', 'code', 'swap', 'tile', 'duel']) assert.equal(recommend([left(3), left(3)], format).reason, 'start');
  // 기록에 그렇게 남긴다.
  assert.match(code, /reachedBest: solution\.exact && round\.best !== null && round\.best === solution\.best,/);
  assert.match(code, /retries: Math\.max\(0, round\.completions\.length - 1\),/);
});

test('"왜 그럴까?"는 이 형식의 만들어 낸 판을 가장 큰 합으로 한 번 끝낸 뒤에 열린다', () => {
  assert.equal(whyUnlocked([], 'tax'), false);
  assert.equal(whyUnlocked([tax({ stopped: true, reachedBest: false })], 'tax'), false, '여기까지 한 판');
  assert.equal(whyUnlocked([tax({ outcome: 'left', reachedBest: false })], 'tax'), false, '하다가 나간 판');
  assert.equal(whyUnlocked([tax({ level: 5, custom: true })], 'tax'), false, '직접 만든 판');
  assert.equal(whyUnlocked([tax()], 'tax'), true);
  assert.equal(whyUnlocked([tax({ retries: 5 })], 'tax'), true, '여러 번 다시 해 보고 닿아도 열린다');
  // 다른 형식은 그대로다.
  assert.equal(whyUnlocked([tax()], 'coins'), false);
  assert.equal(whyUnlocked([tax()], 'swap'), false);
  assert.equal(whyUnlocked([{ ...tax(), format: 'swap', fewest: true }], 'swap'), true);
  assert.equal(whyUnlocked([{ ...tax(), format: 'code' }], 'code'), true);
  assert.equal(whyUnlocked([{ ...tax(), format: 'trace' }], 'trace'), false);
});
