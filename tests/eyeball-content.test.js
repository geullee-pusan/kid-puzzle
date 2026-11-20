// 눈대중 대본 점검: 화면에 나오는 글이 약속을 지키는지, "왜 그럴까?" 그림 속의 수와 주장이 풀이 프로그램과 맞는지 본다.
// 가깝고 먼 것을 점수나 비율로 말하지 않는다(넣은 수와 센 수, 찍은 곳과 진짜 자리, 더 덮은 칸 수만), 틀렸다고 하지 않는다,
// 힌트는 두 높이, "왜 그럴까?"는 어림 판에만 있고 알아챈 이야기다(쪽이 섞인 어림 → 막대 → 모두 올리면 → 가린 숫자 → 빼기는 다르다),
// 화면 코드와 틀에 이 형식이 이어져 있는지도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { FIRST_SIDE, LADDER, MAKE_LEVEL, SECOND_SIDE, rungOf } from '../src/core/eyeball-ladder.js';
import { checkBoard, pushesOf, verdict } from '../src/core/eyeball.js';
import { fill, sentenceCount } from '../src/core/text.js';
import { bruteSide } from './helpers/brute-eyeball.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/eyeball.json'));
const html = read('index.html');
const code = read('src/formats/eyeball.js');
const board = read('src/ui/eyeball-board.js');

const VALUES = { k: 41, f: 3, n: 37, no: 2, face: T.units['100'], total: 408 };
/** 그림의 값은 글이 아니다 */
const DATA_KEYS = ['picture', 'blank', 'seed', 'w', 'h', 'op', 'items', 'bars', 'level'];

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
const own = [part('id="eyeball-title"', 'id="make-title"'), part('id="eyeball-count"', 'id="split-count"'), part('id="eyeball-pad"', 'id="split-pad"'), part('id="make-eyeball"', '<script')].map(visibleText).join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const figureBoard = (item) => ({ kind: 'side', op: item.op, items: item.items.map(([n, unit, hide = false]) => ({ n, unit, hide })) });

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 단계 목록이 사다리와 같다', () => {
  assert.equal(T.title, '눈대중');
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.deepEqual(T.levels.map((item) => item.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(T.levels.map((item) => item.name), ['얼룩 넓이 어림하기', '직사각형 두 개로 덮기', '수직선에 찍기', '어림이 클까, 작을까', '덮기, 찍기, 어림 섞어서', '직접 만들기']);
  for (const rung of LADDER) assert.ok(T.home.ask[rung.mode], rung.level);
  for (const entry of T.levels) assert.ok(rungOf(entry.level).mode === 'make' ? entry.picture.blank === true : entry.picture.seed === 1, entry.name);
});

test('가깝고 먼 것을 점수나 비율로 말하지 않는다. 넣은 수와 센 수, 찍은 곳과 진짜 자리, 더 덮은 칸 수만 말한다', () => {
  const said = strings.map(([, text]) => text).join(' ');
  for (const text of [said, own]) {
    assert.doesNotMatch(text, /%|퍼센트|비율|점수|등수|몇 점|\d+점|가까웠|멀었|아깝|거의 맞|정확/);
  }
  assert.equal(fill(T.right.area, { n: 37, k: 41 }), '37칸이라고 했고, 세어 보니 41칸이에요.');
  assert.equal(fill(T.play['line-reveal'], { n: 433, k: 470, f: 37 }), '433 자리에 찍었어요. 470의 진짜 자리는 동그라미예요. 둘 사이는 37만큼이에요.');
  // 넣은 수는 맞고 틀림이 없다: "세어 보기"를 누르면 판이 끝나고, 답은 늘 맞은 것으로 적는다
  assert.match(code, /round\.answers\.push\(\{ t: frame\.stamp\(\), answer: `guess:\$\{round\.guess\}`, correct: true, guess: null \}\);\n[^\n]*\n\s*frame\.finish\('solved'\);/);
  // 찍기도 그렇다
  assert.match(code, /answer: `mark:\$\{target\}:\$\{mark\}`, correct: true/);
  // 판 아래에는 얼룩 칸 수, 덮은 칸 수, 가장 적게 더 덮은 수만 적는다(몇 번 그렸는지 적지 않는다)
  const foot = part('id="eyeball-count"', 'id="split-count"');
  assert.deepEqual([...foot.matchAll(/<strong id="([\w-]+)"/g)].map((match) => match[1]), ['eyeball-blob', 'eyeball-covered', 'eyeball-best']);
  assert.doesNotMatch(visibleText(foot), /번|횟수/);
  for (const line of code.split('\n')) if (/textContent/.test(line)) assert.doesNotMatch(line, /moveCount|undoCount|wrongCount|eraseCount|completions|guess\b/, line.trim());
});

test('틀렸다고 하지 않고 사실만 말한다. 다른 것을 고르면 그 고르기가 깨지는 사실 하나를 말하고 판에 막대를 그린다', () => {
  const said = strings.map(([, text]) => text).join(' ');
  assert.doesNotMatch(said, /틀렸|틀린|아니에요|땡|정답|아쉽|실수|실패|성공|잘했|훌륭|대단|최고|멋져|멋진|완벽|축하|천재|똑똑|굉장/);
  assert.doesNotMatch(own, /틀렸|틀린|아니에요|땡|아쉽|실패|잘했|훌륭|대단|최고|멋/);
  // 고른 것이 맞으면 끝나고, 아니면 판은 그대로다
  assert.match(code, /if \(correct\) \{\s*frame\.finish\('solved'\);\s*return;\s*\}/);
  assert.match(code, /round\.barsShown = true;/);
  // 알 수 없는 판에 커요나 작아요를 고르면 실제 값의 범위를, 정해지는 판에 알 수 없어요를 고르면 정해진다는 사실을
  assert.equal(fill(T.play['side-unknown'], { n: 390, total: 408 }), '□에 들어가는 숫자에 따라 실제 값은 390부터 408까지 될 수 있어요. 어림한 값은 그 사이에 있어요.');
  assert.match(T.play['side-exact'], /^이 판에는 가려진 숫자가 없어서 실제 값이 하나로 정해져요\./);
  // 같은 고르기를 다시 해도 두 번 세지 않는다
  assert.match(code, /if \(!same\) round\.wrongCount \+= 1;/);
  // 고른 것을 단추에 표시하지 않는다
  assert.doesNotMatch(code, /aria-pressed', String\(round\.picks/);
  assert.doesNotMatch(code, /Math\.random/);
});

test('규칙 설명은 세 문장 안이다. 판의 종류마다 있고, 직접 만들기의 안내 글도 세 문장 안이다', () => {
  assert.deepEqual(Object.keys(T.rules).sort(), ['area', 'cover', 'line', 'made', 'side', 'side-hidden']);
  for (const [key, rule] of Object.entries(T.rules)) assert.ok(sentenceCount(fill(rule, VALUES)) <= 3, key);
  // 얼룩의 칸을 어떻게 세는지 규칙이 말한다
  assert.match(T.rules.area, /한가운데가 얼룩 안에 있는 칸만 세요\.$/);
  assert.match(T.rules.cover, /^점이 찍힌 칸이 얼룩의 칸이에요\./);
  assert.match(T.rules['side-hidden'], /□는 가려진 숫자예요\./);
  for (const key of ['side', 'side-hidden']) assert.match(T.rules[key], /큰지, 작은지, 알 수 없는지 골라요\.$/, key);
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 28);
  assert.ok(sentenceCount(guides[19]) <= 3, guides[19]);
  assert.match(guides[19], /^모눈을 눌러 둥근 덩어리를 놓아 얼룩을 만들어요\./);
});

test('힌트는 판의 종류마다 두 개이고, 하나하나가 질문 한 문장이다. 까닭을 말해 버리지 않는다', () => {
  assert.deepEqual(Object.keys(T.hints).sort(), ['area', 'cover', 'line', 'side']);
  for (const [key, list] of Object.entries(T.hints)) {
    assert.equal(list.length, 2, key);
    assert.notEqual(list[0], list[1]);
    for (const hint of list) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
      assert.doesNotMatch(hint, /때문|해야 해요|하면 돼요|늘 /, hint);
    }
  }
  assert.match(code, /hints: \(round\) => T\.hints\[round\.mode\],/);
});

test('글의 빈칸({이름})은 정해진 이름만 쓰고, 채울 값이 모자라지 않는다', () => {
  const allowed = new Set(['k', 'f', 'n', 'no', 'total', 'level', 'tag', 'face']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
    assert.ok(fill(text, VALUES).length > 0, path);
  }
  assert.equal(fill(T.rules.side, { face: T.units['10'] }).split('. ')[0], '수를 가까운 몇십으로 바꿔서 어림했어요');
  assert.equal(fill(T.make.result, { k: 31, n: 5, f: 1, total: 0 }), '얼룩은 31칸이에요. 얼룩이 아닌 칸은 직사각형 하나면 5칸, 둘이면 1칸, 셋이면 0칸까지 줄어요.');
  // 수 뒤의 "이에요/예요"는 수의 끝소리로 고른다
  assert.match(code, /T\.right\[endsClosed\(solution\.low\) \? 'side-fact-closed' : 'side-fact-open'\]/);
});

test('화면 글에 영어 낱말과 보상 낱말이 없고, "~요"로 끝나는 말투다. 한 문장은 60자를 넘지 않는다', () => {
  for (const [path, text] of strings) assert.doesNotMatch(text.replace(/\{[^{}]*\}/g, ''), /[A-Za-z]/, `${path}: ${text}`);
  assert.doesNotMatch(own, /[A-Za-z]/);
  assert.doesNotMatch(own, /별|점수|순위|레벨|연속/);
  const spoken = [
    ...Object.values(T.home.ask),
    T.home.pick,
    ...Object.values(T.rules),
    ...Object.values(T.play),
    ...Object.values(T.hints).flat(),
    ...Object.values(T.right),
    ...Object.values(T.solution),
    ...Object.entries(T.make)
      .filter(([key]) => !['size', 'count'].includes(key))
      .map(([, text]) => text),
    ...T.why.map((slide) => slide.say),
  ];
  for (const text of spoken) for (const sentence of sentences(text)) assert.match(sentence, /요[.?!]?$/, sentence);
  for (const text of Object.values(T.status)) assert.match(text, /요$/, text);
  for (const slide of T.why) for (const item of slide.figures) assert.match(item.note, /요$/, item.note);
  for (const [path, text] of strings) for (const sentence of sentences(text)) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

test('"왜 그럴까?"는 어림 판에만 있는 그림 다섯의 알아챈 이야기다. 그림 속의 수와 주장이 풀이 프로그램과 같다', () => {
  assert.equal(T.why.length, 5);
  assert.match(code, /function whyPages\(round\) \{\n\s*if \(round\.mode !== 'side'\) return null;/);
  for (const slide of T.why) {
    assert.ok(sentenceCount(slide.say) <= 3, slide.say);
    assert.equal(slide.figures.length, 1);
    for (const item of slide.figures) assert.equal(checkBoard(figureBoard(item)), null, item.note);
  }
  const [one, two, three, four, five] = T.why.map((slide) => figureBoard(slide.figures[0]));
  assert.deepEqual(T.why.map((slide) => slide.figures[0].bars), [false, true, true, true, true]);
  // 첫 장과 둘째 장: 198 + 305 + 99. 두 수는 올리고 한 수는 내렸는데 어림한 값이 더 작다(크기로 정해진다)
  assert.deepEqual(one, two);
  const first = verdict(one);
  assert.deepEqual([first.answer, first.by, first.est, first.low], ['smaller', 'sizes', 600, 602]);
  assert.deepEqual(pushesOf(two).map((item) => item.lo), [2, -5, 1]);
  assert.match(T.why[0].say, /^선생님이 198 \+ 305 \+ 99를 200 \+ 300 \+ 100으로 어림하다가 멈췄어요\./);
  assert.match(T.why[1].say, /커진 만큼은 2와 1, 작아진 만큼은 5예요\./);
  // 셋째 장: 4단계 첫 판(198 + 397). 커진 막대만 있다
  assert.deepEqual(three, FIRST_SIDE);
  assert.ok(pushesOf(three).every((item) => item.lo > 0));
  assert.equal(verdict(three).by, 'directions');
  // 넷째 장: 4단계 둘째 판(13□ + 26□). 앞의 수는 30~39 작아지고 뒤의 수는 31~40 커져서 알 수 없다
  assert.deepEqual(four, SECOND_SIDE);
  assert.deepEqual(pushesOf(four).map((item) => [item.lo, item.hi]), [[-39, -30], [31, 40]]);
  assert.equal(bruteSide(four).answer, 'unknown');
  assert.match(T.why[3].say, /앞의 수는 30부터 39만큼 작아지고, 뒤의 수는 31부터 40만큼 커져요\./);
  // 다섯째 장: 빼기. 앞의 수는 내리고 뒤의 수는 올렸는데 둘 다 어림한 값을 작게 만든다(쪽으로 정해진다)
  const last = verdict(five);
  assert.deepEqual([five.op, last.answer, last.by, last.est, last.low], ['-', 'smaller', 'directions', 100, 104]);
  assert.ok(pushesOf(five).every((item) => item.hi < 0));
  // "왜 그럴까?"는 알 수 없는 어림 판을 한 번 끝까지 만난 뒤에 열린다(틀의 기본 문)
  assert.equal(tuningFor('eyeball').whyAfter, undefined);
});

test('직접 만들기: 크기, 덩어리 크기, 직사각형 수를 정하고 모눈을 눌러 덩어리를 놓는다. 선생님은 얼룩 칸을 세고 직사각형 하나·둘·셋으로 가장 적게 덮는 수를 말한다', () => {
  const make = part('id="make-eyeball"', '<script');
  for (const id of ['eyeball-make-count', 'eyeball-make-w', 'eyeball-make-h', 'eyeball-make-w-fewer', 'eyeball-make-w-more', 'eyeball-make-h-fewer', 'eyeball-make-h-more', 'eyeball-make-size', 'eyeball-make-k', 'eyeball-make-clear', 'eyeball-make-board', 'eyeball-make-solve', 'eyeball-make-result', 'eyeball-make-picture', 'eyeball-make-play']) {
    assert.ok(make.includes(`id="${id}"`), id);
  }
  assert.match(make, /id="eyeball-make-solve"[^>]*>선생님, 세어 주세요</);
  assert.match(make, /id="eyeball-make-play"[^>]*>내가 해 볼래요</);
  for (const [r, name] of [[3, '작게'], [5, '보통'], [7, '크게']]) assert.match(make, new RegExp(`data-r="${r}">${name}<`));
  assert.match(make, /data-k="2">두 개</);
  assert.match(make, /data-k="3">세 개</);
  assert.match(T.make.intro, /선생님에게 세어 보라고 할 수 있어요\.$/);
  assert.match(T.make['keep-not-yet'], /볼까요\?$/);
  // 공책에 남기는 판은 얼룩 칸이 두 칸은 있는 덮기 판이다. 가장 좋은 기록은 얼룩이 아닌 칸을 가장 적게 덮은 수
  assert.match(code, /const madeBoard = \(\) => \(draftReady\(\) \? draftBoard\(\) : null\);/);
  assert.match(code, /\n {4}madeBoard,\n/);
  assert.match(code, /bestOf: \(round\) => \(round\.mode !== 'cover' \|\| round\.best === null \? null : \{ value: -round\.best, name: fill\(T\.notebook\.best, \{ k: round\.best \}\) \}\),/);
  assert.equal(fill(T.notebook.best, { k: 2 }), '얼룩이 아닌 칸 2칸');
  assert.equal(MAKE_LEVEL, 6);
});

test('index.html: 이 형식의 카드, 판, 판 아래, 답하는 칸, 직접 만들기가 있다. 틀에 이어져 있다', () => {
  for (const id of ['home-eyeball-sample', 'home-eyeball-ask', 'home-eyeball-play', 'home-eyeball-pick', 'home-eyeball-make', 'home-eyeball-blank', 'eyeball-board', 'eyeball-count', 'eyeball-status', 'eyeball-numbers', 'eyeball-blob', 'eyeball-covered', 'eyeball-best-line', 'eyeball-best', 'eyeball-pad', 'eyeball-area-box', 'eyeball-typed', 'eyeball-keys', 'eyeball-reveal', 'eyeball-cover-box', 'eyeball-stop', 'eyeball-line-box', 'eyeball-target', 'eyeball-here', 'eyeball-side-box', 'eyeball-bigger', 'eyeball-smaller', 'eyeball-unknown', 'make-eyeball']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(part('id="eyeball-title"', '</section>'), /<h2 id="eyeball-title">눈대중<\/h2>/);
  assert.ok(visibleText(part('id="eyeball-title"', '</section>')).includes(T.home.ask.area));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-eyeball-make" class="menu-item"/);
  assert.match(part('id="eyeball-side-box"', '</div>'), /id="eyeball-bigger"[^>]*>커요<[\s\S]*id="eyeball-smaller"[^>]*>작아요<[\s\S]*id="eyeball-unknown"[^>]*>알 수 없어요</);
  assert.match(part('id="eyeball-area-box"', 'id="eyeball-cover-box"'), /id="eyeball-reveal"[^>]*>세어 보기</);
  assert.match(part('id="eyeball-cover-box"', 'id="eyeball-line-box"'), /id="eyeball-stop"[^>]*>여기까지 할래요</);
  assert.match(part('id="eyeball-line-box"', 'id="eyeball-side-box"'), /id="eyeball-here"[^>]*>여기예요</);
  // 카드는 똑같이 섞이게 자르기 다음, 퍼즐 만들기 앞이다
  assert.ok(html.indexOf('id="split-title"') < html.indexOf('id="eyeball-title"'));
  assert.ok(html.indexOf('id="eyeball-title"') < html.indexOf('id="make-title"'));
  // 틀이 형식을 안다(형식 목록에서 똑같이 섞이게 자르기 다음)
  assert.match(read('src/main.js'), /split: createSplit\(frame\), eyeball: createEyeball\(frame\), /);
  assert.match(read('src/check-main.js'), /\['eyeball', '눈대중'\]/);
  // 무르기와 되돌리기는 덮기에만 있다
  assert.match(code, /const other = frame\.round\?\.mode !== 'cover';\s*\$\('undo'\)\.hidden = other;\s*\$\('reset'\)\.hidden = other;/);
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
  assert.doesNotMatch(code, /hintsOpened/);
  // 판을 그리는 조각은 글을 받아 그릴 뿐 적지 않는다. 얼룩은 둥근 덩어리의 테두리를 먼저 굵게 그리고 속을 덧칠해 바깥 둘레만 남긴다
  for (const name of ["'es-blob-edge'", "'es-blob'", "'es-extra'", "'es-dot open'", "'es-pin now'", '`es-true${tone}`', '`es-bar-maybe ${kind}`']) assert.ok(board.includes(name), name);
  const css = read('src/app.css');
  assert.match(css, /\.es-bar-maybe \{[^}]*stroke-dasharray/);
  assert.match(css, /\.es-dot\.open \{[^}]*stroke-width/);
});

/** 끝까지 한 판의 기록 하나 */
function finished(more = {}) {
  return { kind: 'round', id: `r-${more.id ?? 1}`, format: 'eyeball', level: 1, seed: 3, custom: false, mode: 'area', outcome: 'solved', hintsOpened: 0, answers: [{ t: 30, answer: 'guess:30', correct: true, guess: null }], wrongCount: 0, moveCount: 4, seconds: 50, solution: { possible: true }, ...more };
}

test('수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다. "왜 그럴까?"는 알 수 없는 어림 판을 끝까지 만난 뒤에 열린다', () => {
  const tuning = tuningFor('eyeball');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 5);
  assert.equal(tuning.hintCount, 2);
  assert.match(read('src/core/level.js'), /눈대중\(모두 임시\)/);
  assert.deepEqual(recommend([], 'eyeball'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  assert.deepEqual(recommend([finished({ id: 1 }), finished({ id: 2, moveCount: 30 })], 'eyeball'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, wrongCount: 1 })], 'eyeball').offerHarder, false);
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, seconds: 200 })], 'eyeball').offerHarder, false);
  assert.equal(whyUnlocked([finished()], 'eyeball'), false);
  assert.equal(whyUnlocked([finished({ level: 4, mode: 'side', solution: { possible: true, answer: 'bigger' } })], 'eyeball'), false);
  assert.equal(whyUnlocked([finished({ level: 4, mode: 'side', solution: { possible: false, answer: 'unknown' }, answers: [{ answer: 'unknown', correct: true }] })], 'eyeball'), true);
});
