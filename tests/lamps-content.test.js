// 켜고 끄기와 숫자 마술 대본 점검: 화면에 나오는 글이 약속을 지키는지, 그림 속의 불과 수와 주장이 풀이 프로그램과 맞는지 본다.
// 불은 그냥 수가 적힌 불이다(다른 수 체계의 이름이나 0과 1의 줄을 쓰지 않는다), 틀렸다고 하지 않는다, 몇 번 눌렀는지 보여 주지 않는다,
// 힌트는 두 높이, "왜 그럴까?"는 알아챈 이야기, 화면 코드와 틀에 이 형식이 이어져 있는지도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { LADDER, MAKE_LEVEL, rungOf } from '../src/core/lamps-ladder.js';
import { PREDICTION, cardNumbers, cardsWith, firstMissing, litSum, magicSteps, missingOf, reachOf, waysOf } from '../src/core/lamps.js';
import { endsClosed, fill, sentenceCount } from '../src/core/text.js';
import { bruteMagic, bruteWays, columnAdd, columnSubtract } from './helpers/brute-lamps.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/lamps.json'));
const html = read('index.html');
const code = read('src/formats/lamps.js');
const board = read('src/ui/lamps-board.js');

const VALUES = { k: 12, f: '가', n: 3, no: 2, face: '수', total: 15 };
/** 그림의 값(불, 켠 불, 적힌 수 …)은 글이 아니다 */
const DATA_KEYS = ['lamps', 'lit', 'targets', 'made', 'picked', 'show', 'rows', 'sums', 'type', 'op', 'kind'];

/** 대본의 모든 글(값)을 길과 함께 모은다. 설명(_로 시작하는 것)과 그림의 값은 뺀다. */
function allStrings(value, path = '') {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((item, index) => allStrings(item, `${path}[${index}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .filter(([key]) => !key.startsWith('_') && !DATA_KEYS.includes(key))
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
/** from이 든 꼬리표의 처음(<)부터 to가 든 꼬리표의 앞까지 */
const part = (from, to) => {
  const at = html.lastIndexOf('<', html.indexOf(from));
  return html.slice(at, html.lastIndexOf('<', html.indexOf(to, html.indexOf(from))));
};
const own = [part('id="lamps-title"', 'id="make-title"'), part('id="lamps-board"', 'id="rulehunt-board"'), part('id="lamps-count"', 'id="logic-foot"'), part('id="lamps-pad"', 'id="maze-pad"'), part('id="make-lamps"', '<script')]
  .map(visibleText)
  .join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const slides = Object.values(T.why).flat();
const figures = slides.flatMap((slide) => slide.figures);

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 단계 목록이 사다리와 같다', () => {
  assert.equal(T.title, '켜고 끄기와 숫자 마술');
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.deepEqual(T.levels.map((item) => item.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(T.levels.map((item) => item.name), ['켜서 만들기', '어디까지 될까', '불 하나 더 달기', '마음 읽기 카드', '숫자 마술', '직접 만들기']);
});

test('불은 그냥 수가 적힌 불이다: 다른 수 체계의 이름, 바꾸기 연습, 0과 1의 줄이 화면 글 어디에도 없다', () => {
  const banned = /이진|2진|진법|진수|변환|바꾸는 연습|비트/;
  for (const [path, text] of strings) {
    assert.doesNotMatch(text, banned, `${path}: ${text}`);
    assert.doesNotMatch(text, /\b[01]{3,}\b/, `${path}: ${text}`);
  }
  assert.doesNotMatch(own, banned);
  assert.doesNotMatch(own, /\b[01]{3,}\b/);
  // 화면 코드도 0과 1의 줄을 그리지 않는다(불은 켜짐과 꺼짐을 모양으로 그린다)
  assert.doesNotMatch(board, /toString\(2\)|padStart\([^)]*'0'\)/);
  assert.doesNotMatch(code, /toString\(2\)/);
  // 큰 수는 "2를 열 번 곱한 수"처럼 풀어 쓴다. 거듭제곱 기호를 쓰지 않는다
  assert.match(T.why.lamps[2].say, /2를 열 번 곱한 수보다 하나 작은 수예요\./);
  for (const [path, text] of strings) assert.doesNotMatch(text, /\^|²|제곱|거듭/, path);
});

test('규칙 설명은 세 문장 안이다. 판의 종류마다 있고, 직접 만들기의 안내 글도 세 문장 안이다', () => {
  assert.deepEqual(Object.keys(T.rules).sort(), ['cards-child', 'cards-teacher', 'magic', 'next', 'reach', 'targets']);
  for (const [key, rule] of Object.entries(T.rules)) assert.ok(sentenceCount(fill(rule, { ...VALUES, f: '세' })) <= 3, key);
  assert.match(T.rules.targets, /불을 누르면 켜지고, 다시 누르면 꺼져요\./);
  assert.match(T.rules.reach, /‘못 만들어요’를 눌러요\.$/);
  assert.match(T.rules.next, /가장 멀리까지 만들 수 있을까요\?/);
  assert.match(T.rules.magic, /맨 앞 숫자와 맨 끝 숫자는 둘 이상 달라야 해요\./);
  assert.ok(fill(T.rules.magic, { f: T.digitWords[3] }).startsWith('세 자리 수를 하나 골라요.'));
  // 형식이 판의 종류(직접 만든 판은 어디까지)로 규칙 글과 힌트를 고른다.
  assert.match(code, /const hintKey = \(round\) => \(round\.custom \? 'reach' : round\.mode\);/);
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 50);
  assert.ok(sentenceCount(guides[15]) <= 3, guides[15]);
  assert.match(guides[15], /두 배씩이 아닌 불로도 빈 곳 없이 멀리 갈 수 있을까요\?$/);
});

test('수 뒤에 붙는 말(은/는, 을/를, 이에요/예요)은 읽는 소리의 받침으로 고른다', () => {
  assert.match(code, /const pick = \(group, key, number\) => group\[`\$\{key\}-\$\{endsClosed\(number\) \? 'closed' : 'open'\}`\];/);
  // -closed와 -open은 늘 짝으로 있다
  for (const group of [T.status, T.play, T.right, T.solution, T.make]) {
    for (const key of Object.keys(group)) {
      const match = key.match(/^(.*)-(closed|open)$/);
      if (match) assert.ok(group[`${match[1]}-${match[2] === 'closed' ? 'open' : 'closed'}`], key);
    }
  }
  const say = (group, key, k, more = {}) => fill(group[`${key}-${endsClosed(k) ? 'closed' : 'open'}`], { k, ...more });
  assert.equal(say(T.play, 'made', 3), '3을 만들었어요.');
  assert.equal(say(T.play, 'made', 5), '5를 만들었어요.');
  assert.equal(say(T.play, 'can', 9), '9는 만들 수 있어요. 불을 켜서 확인해 볼까요?');
  assert.equal(fill(T.right['reach-closed'], { k: 15, n: 16 }), '1부터 15까지는 모두 만들 수 있고, 16은 처음으로 만들 수 없는 수예요.');
  assert.ok(endsClosed(16));
  assert.equal(say(T.play, 'trick-guess', 13), '고른 수는 13이지요?');
  assert.equal(say(T.play, 'trick-guess', 12), '고른 수는 12지요?');
  assert.equal(say(T.play, 'guess-right', 14), '맞아요. 선생님이 고른 수는 14였어요.');
  assert.equal(say(T.play, 'guess-also', 15, { f: '가' }), '15는 카드 가에도 적혀 있어요.');
  // 마술의 끝 말은 늘 나오는 수(1089, 99) 뒤에만 붙고, 둘 다 받침이 없어서 '가', '예요'만 있다
  for (const value of Object.values(PREDICTION)) assert.equal(endsClosed(value), false, String(value));
  assert.equal(fill(T.right.magic, { k: 1089 }), '쪽지에는 1089가 적혀 있었어요. 계산해서 나온 수도 1089예요.');
  assert.equal(fill(T.make['magic-count'], { f: '세', total: 900, k: 1089, n: 640 }), '세 자리 수 900개 가운데 1089가 되는 수는 640개예요.');
  // 그림 아래 글의 수 뒤에 붙은 말도 받침과 맞는다(이에요 ↔ 받침, 예요 ↔ 받침 없음)
  for (const item of figures) {
    for (const [, number, tail] of item.note.matchAll(/(\d+)(이에요|예요)/g)) assert.equal(tail === '이에요', endsClosed(Number(number)), item.note);
  }
});

test('틀렸다고 하지 않고 사실만 말한다. 칭찬 낱말, 보상 낱말이 없다', () => {
  const said = strings.map(([, text]) => text).join(' ');
  assert.doesNotMatch(said, /틀렸|틀린|아니에요|땡|아쉽|실패|실수|잘했|훌륭|대단|최고|멋져|멋진|천재|똑똑|완벽|굉장|축하|성공|점수|기록을 깨|신기록/);
  assert.doesNotMatch(own, /틀렸|틀린|아니에요|땡|아쉽|실패|잘했|훌륭|대단|최고|멋/);
  // 못 만드는 수가 아니었으면: 그 수는 만들 수 있다는 사실과 판에서 확인해 볼 일 하나
  assert.equal(fill(T.play['can-open'], { k: 9 }), '9는 만들 수 있어요. 불을 켜서 확인해 볼까요?');
  // 다른 수를 넣었으면: 그 수가 어느 카드에 더 있거나 없다는 사실 하나
  assert.match(T.play['guess-missing-closed'], /^\{k\}은 카드 \{f\}에 없어요\.$/);
  // 계산이 다르면: 다시 볼 자리 하나만
  assert.equal(fill(T.play['calc-wrong'], { f: T.columns[1] }), '십의 자리를 다시 계산해 볼까요?');
  assert.deepEqual(T.columns, ['일의', '십의', '백의', '천의']);
});

test('몇 번 켰는지, 몇 번 달아 보았는지는 판에 적지 않는다(기록에만 남긴다)', () => {
  const foot = part('id="lamps-count"', 'id="logic-foot"');
  assert.doesNotMatch(visibleText(foot), /번|횟수/);
  for (const [path, text] of strings.filter(([key]) => key.startsWith('status.'))) assert.doesNotMatch(text, /\{n\}번|번 켰|번 달/, path);
  assert.match(code, /toggles: round\.toggles,/);
  assert.match(code, /tries: round\.tries,/);
  // 가장 멀리 간 불은 기록 깨기처럼 판 아래에 보인다(가장 좋은 기록은 공책에 저절로 남는다)
  assert.equal(fill(T.notebook.best, { k: 16, n: 31 }), '16짜리 불로 1부터 31까지');
  assert.match(code, /bestOf: \(round\) => \(round\.mode !== 'next' \|\| round\.best === null \? null : \{ value: round\.best\.reach,/);
});

test('힌트는 판마다 두 개이고, 하나하나가 질문 한 문장이다', () => {
  assert.deepEqual(Object.keys(T.hints).sort(), ['cards', 'magic', 'next', 'reach', 'targets']);
  for (const rung of LADDER.filter((item) => item.mode !== 'make')) assert.ok(T.hints[rung.hint], rung.level);
  for (const [key, list] of Object.entries(T.hints)) {
    assert.equal(list.length, 2, key);
    assert.notEqual(list[0], list[1]);
    for (const hint of list) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
    }
  }
});

test('글의 빈칸({이름})은 정해진 이름만 쓰고, 채울 값이 모자라지 않는다', () => {
  const allowed = new Set(['k', 'f', 'n', 'no', 'total', 'level', 'tag', 'face']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
    assert.ok(fill(text, VALUES).length > 0, path);
  }
});

test('화면 글에 영어 낱말이 없고, "~요"로 끝나는 말투다. 한 문장은 60자를 넘지 않는다', () => {
  for (const [path, text] of strings) assert.doesNotMatch(text.replace(/\{[^{}]*\}/g, ''), /[A-Za-z]/, `${path}: ${text}`);
  assert.doesNotMatch(own, /[A-Za-z]/);
  const spoken = [
    ...Object.values(T.home.ask),
    T.home.pick,
    ...Object.values(T.rules),
    ...Object.values(T.play),
    ...Object.values(T.hints).flat(),
    ...Object.values(T.right),
    ...Object.entries(T.solution).filter(([key]) => !key.endsWith('note') && key !== 'magic-example' && !key.startsWith('target-note')).map(([, text]) => text),
    ...Object.entries(T.make).filter(([key]) => key !== 'count').map(([, text]) => text),
    ...slides.map((slide) => slide.say),
  ];
  for (const text of spoken) for (const sentence of sentences(text)) assert.match(sentence, /요[.?!]$/, sentence);
  for (const text of [...strings.filter(([path]) => path.startsWith('status.')).map(([, text]) => text), ...Object.values(T.cellState), ...Object.values(T.targetState), ...Object.values(T.lampState), T.solution['reach-note'], T.solution['target-note-closed'], T.solution['target-note-open'], T.noteSealed]) {
    assert.match(text, /요??$/, text);
  }
  for (const item of figures) assert.match(item.note, /요$/, item.note);
  for (const [path, text] of strings) for (const sentence of sentences(text)) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

test('"왜 그럴까?"(불): 불을 달 때마다 두 배보다 하나 더 멀리 간다. 그림 속의 합과 주장은 풀이 프로그램으로 다시 구한 것과 같다', () => {
  const story = T.why.lamps;
  assert.equal(story.length, 4);
  for (const slide of story) assert.ok(sentenceCount(slide.say) <= 3, slide.say);
  // 불 그림: 그림 아래 글의 마지막 수는 켠 불의 합이다
  for (const item of figures.filter((figure) => figure.type === 'lamps')) {
    const numbers = [...item.note.matchAll(/\d+/g)].map(Number);
    assert.equal(numbers.at(-1), litSum(item.lamps, item.lit), item.note);
  }
  // 첫 장: 1, 2, 4로 7까지 빈 곳이 없고 8은 못 만든다
  assert.equal(reachOf([1, 2, 4]), 7);
  assert.equal(firstMissing(story[0].figures[1].lamps), 8);
  assert.equal(story[0].figures[1].top, 8);
  // 둘째 장: 8을 켜 두고 1~7을 더 켜면 9~15
  for (let n = 1; n <= 7; n++) assert.ok(bruteWays([1, 2, 4, 8]).has(8 + n));
  assert.match(story[1].say, /9부터 15까지 만들어져요\.$/);
  // 셋째 장: 15까지 빈 곳이 없고, 열 개면 1023까지(2를 열 번 곱한 수보다 하나 작다)
  assert.equal(reachOf(story[2].figures[0].lamps), 15);
  assert.equal(reachOf(story[2].figures[1].lamps), 1023);
  assert.equal(story[2].figures[1].lamps.length, 10);
  // 넷째 장: 까닭이 그대로는 통하지 않는 불. 1, 2, 3, 6은 두 배씩이 아닌데도 12까지 빈 곳이 없고, 3은 두 가지로 만든다
  assert.equal(reachOf([1, 2, 3, 6]), 12);
  assert.equal(waysOf([1, 2, 3, 6])[3], 2);
  assert.match(story[3].say, /12까지 빈 곳이 없어요\./);
});

test('"왜 그럴까?"(카드): 카드마다 불 하나이고, 맨 앞의 수만 더한다. 그림 속의 카드와 표시는 풀이 프로그램과 같다', () => {
  const story = T.why.cards;
  assert.equal(story.length, 4);
  for (const slide of story) assert.ok(sentenceCount(slide.say) <= 3, slide.say);
  const lamps = [1, 2, 4, 8];
  // 첫 장: 13이 적힌 카드는 가, 다, 라이고 맨 앞의 수는 1, 4, 8이다
  assert.deepEqual(cardsWith(lamps, 13), [0, 2, 3]);
  assert.deepEqual(story[0].figures[0].picked, [0, 2, 3]);
  assert.match(story[0].say, /카드는 가, 다, 라였고, 맨 앞의 수 1, 4, 8을 더했을 뿐이에요\.$/);
  // 카드 그림: 동그라미를 친 수는 누른(표시한) 카드에 모두 있고, 다른 카드에는 없다
  for (const item of figures.filter((figure) => figure.type === 'cards')) {
    const shown = item.show ?? item.lamps.map((_, at) => at);
    for (const at of shown) assert.equal(cardNumbers(item.lamps, at).includes(item.mark), item.picked.length === 0 ? true : item.picked.includes(at), item.note);
  }
  // 셋째 장: 1, 2, 4, 8로는 1~15 어느 수든 방법이 한 가지
  const ways = waysOf(lamps);
  for (let n = 1; n <= 15; n++) assert.equal(ways[n], 1);
  // 넷째 장: 1, 2, 3, 6으로는 3이 두 가지라 카드에 적을 곳이 정해지지 않는다
  assert.equal(waysOf([1, 2, 3, 6])[3], 2);
});

test('"왜 그럴까?"(마술): 뺀 수의 가운데는 9, 맨 앞과 맨 끝은 더하면 9, 더하면 자리마다 9, 18, 9. 숫자가 하나만 다르면 198', () => {
  const story = T.why.magic;
  assert.equal(story.length, 4);
  for (const slide of story) assert.ok(sentenceCount(slide.say) <= 3, slide.say);
  // 첫 장: 742, 513, 961 모두 1089
  for (const n of [742, 513, 961]) assert.equal(bruteMagic(n).sum, 1089, String(n));
  assert.match(story[0].say, /742도, 513도, 961도 모두 1089가 나와서/);
  for (const item of figures.filter((figure) => figure.type === 'chain')) assert.equal(magicSteps(item.n).sum, bruteMagic(item.n).sum);
  // 세로셈 그림: 글자로 세로셈한 것과 같다. 둘째 장의 글은 맨 앞과 맨 끝 숫자를 짚는다
  for (const item of figures.filter((figure) => figure.type === 'column')) {
    const [top, bottom] = item.rows;
    if (item.op === '-') {
      const diff = columnSubtract(top, bottom);
      assert.equal(diff, top - bottom);
      assert.equal(bottom, Number(String(top).split('').reverse().join('')), '뒤집은 수를 뺀다');
      const text = String(diff);
      assert.equal(text[1], '9');
      assert.equal(Number(text[0]) + Number(text[2]), 9);
      assert.match(item.note, new RegExp(`^${text[0]}[와과] ${text[2]}[을를] 더하면 9예요$`), item.note);
    } else {
      assert.deepEqual(columnAdd(top, bottom).sums, item.sums);
      assert.equal(columnAdd(top, bottom).sum, 1089);
    }
  }
  // 넷째 장: 433 → 99 → 198
  assert.deepEqual([bruteMagic(433).diff, bruteMagic(433).sum], [99, 198]);
  assert.equal(story[3].figures[0].n, 433);
  // 이야기는 마술을 끝까지 한 뒤에만 열린다(묶음마다 따로)
  assert.match(code, /if \(!whyOpen\(frame\.records\(\), family\)\) return null;/);
});

test('판 고르기의 그림: 단계마다 그 단계의 판이고, 켠 불과 만든 수가 맞는다', () => {
  for (const entry of T.levels) {
    const rung = rungOf(entry.level);
    const { picture } = entry;
    if (rung.mode === 'make') {
      assert.equal(picture.blank, true);
      continue;
    }
    assert.equal(picture.kind, rung.mode, entry.name);
    if (picture.lit) {
      const sum = litSum(picture.lamps, picture.lit);
      if (picture.lit.length > 0) assert.ok(picture.made.includes(sum), `${entry.name}: ${sum}`);
      const ways = bruteWays(picture.lamps);
      for (const n of picture.made) assert.ok(ways.has(n), `${entry.name}: ${n}`);
    }
    if (picture.targets) for (const n of picture.made) assert.ok(picture.targets.includes(n));
  }
});

test('직접 만들기: 불을 골라 달면 선생님이 1부터 어디까지 되는지, 못 만드는 수와 두 가지 이상으로 만드는 수를 알려 준다. 숫자 마술도 해 본다', () => {
  const make = part('id="make-lamps"', '<script');
  for (const id of ['lamps-make-tabs', 'lamps-make-lamps-box', 'lamps-make-count', 'lamps-make-fewer', 'lamps-make-value', 'lamps-make-more', 'lamps-make-add', 'lamps-make-clear', 'lamps-make-magic-box', 'lamps-make-typed', 'lamps-make-keys', 'lamps-make-board', 'lamps-make-solve', 'lamps-make-result', 'lamps-make-play']) {
    assert.ok(make.includes(`id="${id}"`), id);
  }
  assert.match(make, /id="lamps-make-solve"[^>]*>선생님, 알려 주세요</);
  assert.match(make, /id="lamps-make-play"[^>]*>내가 해 볼래요</);
  assert.equal(fill(T.make.reach, { k: 12 }), '1부터 12까지는 빈 곳 없이 만들어요.');
  assert.equal(fill(T.make.missing, { total: 16, n: 2 }), '1부터 16까지에서 만들 수 없는 수는 2개예요.');
  assert.deepEqual(missingOf([1, 3, 5, 7]), [2, 14]);
  assert.match(T.make['keep-not-yet'], /볼까요\?$/);
  assert.match(code, /\n {4}madeBoard,\n/);
  // 숫자 마술은 차(맨 앞과 맨 끝 숫자)마다 모든 수가 같은 수가 된다(tests/lamps.test.js가 모든 수로 확인한다)
  assert.equal(fill(T.make['magic-gap-closed'], { n: 1, f: '세', k: 198 }), '맨 앞과 맨 끝 숫자가 1만큼 다른 세 자리 수는 모두 198이 돼요.');
  assert.equal(fill(T.make['magic-same'], { f: '두' }), '맨 앞과 맨 끝 숫자가 같은 두 자리 수는 모두 0이 돼요.');
});

test('index.html: 이 형식의 카드, 판, 판 아래, 답하는 칸, 직접 만들기가 있다. 틀에 이어져 있다', () => {
  for (const id of ['home-lamps-sample', 'home-lamps-ask', 'home-lamps-play', 'home-lamps-pick', 'home-lamps-make', 'home-lamps-blank', 'lamps-board', 'lamps-count', 'lamps-status', 'lamps-best-line', 'lamps-best', 'lamps-pad', 'lamps-switch-box', 'lamps-off', 'lamps-claim-box', 'lamps-cannot', 'lamps-trick-box', 'lamps-picked', 'lamps-confirm-box', 'lamps-yes', 'lamps-no', 'lamps-entry-box', 'lamps-entry-title', 'lamps-typed-line', 'lamps-typed', 'lamps-keys', 'lamps-try', 'lamps-guess', 'lamps-choose', 'lamps-calc', 'lamps-help', 'lamps-open', 'make-lamps']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(part('id="lamps-title"', '</section>'), /<h2 id="lamps-title">켜고 끄기와 숫자 마술<\/h2>/);
  assert.ok(visibleText(part('id="lamps-title"', '</section>')).includes(T.home.ask.targets));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-lamps-make" class="menu-item"/);
  assert.match(part('id="lamps-claim-box"', 'id="lamps-trick-box"'), /id="lamps-cannot"[^>]*>못 만들어요</);
  assert.match(part('id="lamps-confirm-box"', 'id="lamps-entry-box"'), /id="lamps-yes"[^>]*>맞아요</);
  assert.match(part('id="lamps-confirm-box"', 'id="lamps-entry-box"'), /id="lamps-no"[^>]*>다른 수예요</);
  assert.equal([...part('id="lamps-keys"', 'id="lamps-try"').matchAll(/data-n="(\w+)"/g)].map((match) => match[1]).join(), '1,2,3,4,5,6,7,8,9,0,erase');
  // 틀이 형식을 안다(형식 목록에서 엉킨 그림 풀기 다음).
  assert.match(read('src/main.js'), /untangle: createUntangle\(frame\), lamps: createLamps\(frame\), /);
  assert.match(read('src/check-main.js'), /\['lamps', '켜고 끄기와 숫자 마술'\]/);
  // 무르기와 되돌리기를 쓰지 않아서, 켜질 때 앞의 형식(엉킨 그림 풀기)이 보이게 해 둔 것을 감춘다(뒤의 방 한 번씩 돌기가 켜질 때 다시 보이게 한다).
  assert.match(code, /if \(on\) \{\s*\/\/[^\n]*\n\s*\$\('undo'\)\.hidden = true;\s*\$\('reset'\)\.hidden = true;/);
  // 지난 기록은 틀이 건네주는 것(작은 판을 뺀 기록)으로 본다. 무작위 값은 쓰지 않는다.
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
  assert.doesNotMatch(code, /Math\.random/);
  // 불과 수의 줄, 카드는 단추라서 누를 수 있고 읽어 주는 이름이 있다
  assert.match(board, /lamp\.setAttribute\('aria-pressed', String\(lit\.has\(at\)\)\);/);
  assert.match(board, /cell\.setAttribute\('aria-label', view\.label\(n\)\);/);
});

/** 끝까지 한 판의 기록 하나 */
function finished(more = {}) {
  return { kind: 'round', id: `r-${Math.random()}`, format: 'lamps', level: 1, seed: 2, custom: false, mode: 'targets', outcome: 'solved', hintsOpened: 0, answers: [{ t: 30, answer: 'made:3/5/7', correct: true, guess: null }], wrongCount: 0, moveCount: 9, seconds: 40, ...more };
}

test('수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다. 몇 번 켰는지는 보지 않는다', () => {
  const tuning = tuningFor('lamps');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 5);
  assert.equal(tuning.hintCount, 2);
  assert.equal(tuning.whyAfter, 'finished');
  assert.match(read('src/core/level.js'), /켜고 끄기와 숫자 마술\(모두 임시\)/);
  assert.deepEqual(recommend([], 'lamps'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  assert.deepEqual(recommend([finished(), finished({ moveCount: 60 })], 'lamps'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  assert.equal(recommend([finished(), finished({ wrongCount: 1 })], 'lamps').offerHarder, false);
  assert.deepEqual(recommend([finished({ outcome: 'left' }), finished({ outcome: 'left' })], 'lamps'), { level: 1, small: true, offerHarder: false, harderLevel: null, reason: 'quit' });
  assert.equal(whyUnlocked([], 'lamps'), false);
  assert.equal(whyUnlocked([finished()], 'lamps'), true);
  assert.equal(MAKE_LEVEL, 6);
});
