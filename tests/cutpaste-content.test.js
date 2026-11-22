// 자르고 붙이기 대본 점검: 화면에 나오는 글이 약속을 지키는지, "왜 그럴까?" 그림 속의 칸 수와 주장이 풀이 프로그램과 맞는지 본다.
// 넓이를 구하는 식은 말하지 않는다(칸 수가 그대로라는 사실만), 틀렸다고 하지 않는다, 힌트는 두 높이,
// "왜 그럴까?"는 나누기 판에는 없고 칸 수 이야기다(한 칸이 빈 그림자 → 세어 보기 → 옮기고 잘라도 그대로 → 칸 수가 같아도 안 되는 그림자),
// 화면 코드와 틀에 이 형식이 이어져 있는지도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { FIRST_MOVE, HOUSE, LADDER, MAKE_LEVEL, moveBoard, rows, rungOf, shadowBoard } from '../src/core/cutpaste-ladder.js';
import { PIECES, SEVEN, fillRegion, setArea, solveMove, solveShadow } from '../src/core/cutpaste.js';
import { fill, sentenceCount } from '../src/core/text.js';
import { bruteFillCount } from './helpers/brute-cutpaste.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/cutpaste.json'));
const html = read('index.html');
const code = read('src/formats/cutpaste.js');
const board = read('src/ui/cutpaste-board.js');

const VALUES = { k: 4, f: 2, n: 3, no: 2, face: T.people[0], total: 20 };
/** 그림의 값은 글이 아니다 */
const DATA_KEYS = ['picture', 'blank', 'seed', 'rows', 'fill', 'tray', 'numbers', 'kind', 'cuts', 'show', 'level', 'm'];

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
const own = [part('id="cutpaste-title"', 'id="fold-title"'), part('id="cutpaste-tally"', 'id="domino-safe"'), part('id="cutpaste-count"', 'id="eyeball-count"'), part('id="cutpaste-pad"', 'id="eyeball-pad"'), part('id="make-cutpaste"', 'id="make-fold"')].map(visibleText).join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const said = strings.map(([, text]) => text).join(' ');

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 단계 목록이 사다리와 같다', () => {
  assert.equal(T.title, '자르고 붙이기');
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.deepEqual(T.levels.map((item) => item.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(T.levels.map((item) => item.name), ['한 번 잘라 네모 만들기', '가장 적게 잘라 나누기', '두 번 잘라 네모 만들기', '가짜 그림자', '나누기, 네모, 그림자 섞어서', '직접 만들기']);
  for (const rung of LADDER) assert.ok(T.home.ask[rung.mode], rung.level);
  for (const entry of T.levels) assert.ok(rungOf(entry.level).mode === 'make' ? entry.picture.blank === true : entry.picture.seed === 1, entry.name);
  // 사람의 이름은 여섯(가장 많은 사람 수)
  assert.deepEqual(T.people, ['가', '나', '다', '라', '마', '바']);
});

test('넓이를 구하는 식을 말하지 않는다. 칸 수가 그대로라는 사실만 말한다', () => {
  for (const text of [said, own]) assert.doesNotMatch(text, /넓이|곱하|곱셈|×|공식|가로 *\d*칸? *(와|과)? *세로|밑변|높이/);
  assert.equal(fill(T.right.move, { n: 8 }), '네모를 만들었어요. 처음 도형도 네모도 8칸이에요.');
  assert.equal(fill(T.right.shadow, { n: 20 }), '그림자를 꼭 채웠어요. 조각도 그림자도 20칸이에요.');
  assert.equal(fill(T.right['impossible-area'], { k: 20, n: 21 }), '맞아요. 조각은 모두 20칸이고 그림자는 21칸이에요.');
  // 판 아래에는 나누기의 조각 수와 가장 적은 조각 수만 적는다(몇 번 옮겼는지 적지 않는다)
  const foot = part('id="cutpaste-count"', 'id="eyeball-count"');
  assert.deepEqual([...foot.matchAll(/<strong id="([\w-]+)"/g)].map((match) => match[1]), ['cutpaste-pieces', 'cutpaste-best']);
  assert.doesNotMatch(visibleText(foot), /번|횟수/);
  for (const line of code.split('\n')) if (/textContent/.test(line)) assert.doesNotMatch(line, /moveCount|turnCount|cutCount|undoCount|wrongCount|giveCount|tickCount|completions/, line.trim());
});

test('틀렸다고 하지 않고 사실만 말한다. 되는 판의 "불가능해요"는 방법이 있다는 사실만 말하고 판이 이어진다', () => {
  assert.doesNotMatch(said, /틀렸|틀린|아니에요|땡|정답|아쉽|실수|실패|성공|잘했|훌륭|대단|최고|멋져|멋진|완벽|축하|천재|똑똑|굉장/);
  assert.doesNotMatch(own, /틀렸|틀린|아니에요|땡|아쉽|실패|잘했|훌륭|대단|최고|멋/);
  assert.match(code, /if \(correct\) \{\s*frame\.finish\('solved'\);\s*return;\s*\}/);
  assert.equal(fill(T.play['possible-move'], { n: 2 }), '선 2개로 잘라 네모를 만드는 방법이 있어요.');
  assert.equal(T.play['possible-shadow'], '이 그림자는 일곱 조각으로 채울 수 있어요.');
  // 나누기: 가장 적지 않으면 더 줄일 수 있을지 묻는다(기록 깨기). 같은 나누기는 두 번 세지 않는다
  assert.match(T.play['share-all'], /더 적게 잘라도 될까요\?$/);
  assert.match(code, /if \(!reached\) round\.wrongCount \+= 1;/);
  assert.match(code, /const fresh = !round\.tries\.includes\(key\);/);
  assert.doesNotMatch(code, /Math\.random/);
});

test('규칙 설명은 세 문장 안이다. 판의 종류마다 있고, 안 되는 판이 섞이는 판만 "불가능해요"를 말한다', () => {
  assert.deepEqual(Object.keys(T.rules).sort(), ['made', 'move', 'move-maybe', 'shadow', 'share']);
  for (const [key, rule] of Object.entries(T.rules)) assert.ok(sentenceCount(fill(rule, VALUES)) <= 3, key);
  assert.doesNotMatch(T.rules.move, /불가능해요/);
  assert.match(T.rules['move-maybe'], /‘불가능해요’를 눌러요\.$/);
  assert.match(T.rules.shadow, /‘불가능해요’를 눌러요\.$/);
  assert.match(code, /const hasImpossible = \(round\) => round\.mode === 'shadow' \|\| \(round\.mode === 'move' && round\.board\.cuts >= 2\);/);
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 47);
  assert.ok(sentenceCount(guides[20]) <= 3, guides[20]);
  assert.match(guides[20], /^빵의 수와 사람의 수를 정해요\./);
});

test('힌트는 판의 종류마다 두 개이고, 하나하나가 질문 한 문장이다. 까닭을 말해 버리지 않는다', () => {
  assert.deepEqual(Object.keys(T.hints).sort(), ['move', 'shadow', 'share']);
  for (const [key, list] of Object.entries(T.hints)) {
    assert.equal(list.length, 2, key);
    assert.notEqual(list[0], list[1]);
    for (const hint of list) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
      assert.doesNotMatch(hint, /때문|해야 해요|하면 돼요|늘 /, hint);
    }
  }
  // 힌트 1은 모든 형식이 함께 쓰는 짧은 목록에서
  assert.equal(T.hints.move[0], '끝에는 어떤 모양이 되어야 하나요?');
  assert.match(code, /hints: \(round\) => T\.hints\[round\.mode\],/);
});

test('글의 빈칸({이름})은 정해진 이름만 쓰고, 채울 값이 모자라지 않는다', () => {
  const allowed = new Set(['k', 'f', 'n', 'no', 'total', 'level', 'tag', 'face']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
    assert.ok(fill(text, VALUES).length > 0, path);
  }
  assert.equal(fill(T.rules.share, { n: 2, no: 3 }), '빵 2개를 3명이 똑같이 나눠 먹어요. 조각 하나는 한 사람만 먹어요. 조각을 가장 적게 만들어 보아요.');
  assert.equal(fill(T.right['share-best'], { k: 4, n: 2, no: 3 }), '조각 4개로 똑같이 나눴어요. 빵 2개를 3명이 나눌 때 이보다 적은 조각으로는 안 돼요.');
  assert.equal(fill(T.make.result, { n: 3, no: 4, k: 6, f: 3 }), '빵 3개를 4명이 나누면 조각 6개가 가장 적어요. 자르는 곳은 3군데예요.');
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
      .filter(([key]) => !['loaves', 'people'].includes(key))
      .map(([, text]) => text),
    ...T.why.map((slide) => slide.say),
  ];
  for (const text of spoken) for (const sentence of sentences(text)) assert.match(sentence, /요[.?!]?$/, sentence);
  for (const text of Object.values(T.status)) assert.match(text, /요$/, text);
  for (const slide of T.why) for (const item of slide.figures) assert.match(item.note, /요$/, item.note);
  for (const [path, text] of strings) for (const sentence of sentences(text)) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

test('"왜 그럴까?"는 나누기 판에는 없는 칸 수 이야기다. 그림 속의 칸 수와 주장이 풀이 프로그램과 같다', () => {
  assert.equal(T.why.length, 4);
  assert.match(code, /function whyPages\(round\) \{\n\s*if \(round\.mode === 'share'\) return null;/);
  for (const slide of T.why) assert.ok(sentenceCount(slide.say) <= 3, slide.say);
  const shapes = SEVEN.map((type) => PIECES[type]);
  // 첫 장: 집에 한 칸을 붙인 그림자(21칸). 집(20칸)을 채우면 꼭 한 칸이 빈다
  const [first] = T.why[0].figures;
  const shadow = rows(first.rows);
  const filled = rows(first.fill);
  assert.deepEqual(first.fill, HOUSE);
  assert.equal(shadow.length, 21);
  assert.equal(filled.length, 20);
  assert.ok(filled.every((cell) => shadow.some((other) => String(other) === String(cell))));
  assert.ok(fillRegion(filled, shapes).fill);
  assert.equal(bruteFillCount(shadow, shapes), 0);
  assert.match(T.why[0].say, /한 칸이 비었어요\./);
  // 둘째 장: 조각마다의 칸 수와 합, 그림자의 칸 수
  const sizes = SEVEN.map((type) => PIECES[type].length).sort((a, b) => b - a);
  assert.ok(T.why[1].say.includes(`${sizes.join(', ')}을 모두 더하면 ${setArea(SEVEN)}칸이에요.`));
  assert.ok(T.why[1].say.includes(`그림자는 ${shadow.length}칸이에요.`));
  assert.deepEqual(rows(T.why[1].figures[0].rows), shadow);
  assert.equal(T.why[1].figures[0].tray, true);
  const fake = solveShadow(shadowBoard(SEVEN, shadow));
  assert.deepEqual([fake.possible, fake.reason, fake.area, fake.shadowArea], [false, 'area', 20, 21]);
  // 셋째 장: 1단계 첫 판(비껴 놓인 계단). 자르기 전에도 옮긴 뒤에도 8칸
  for (const item of T.why[2].figures) {
    assert.deepEqual(moveBoard(rows(item.rows), item.cuts), FIRST_MOVE);
    assert.match(item.note, /8칸이에요$/);
  }
  const step = solveMove(FIRST_MOVE);
  assert.deepEqual([step.area, step.size[0] * step.size[1]], [8, 8]);
  assert.match(T.why[2].say, /바뀌지 않는 것/);
  // 넷째 장: 칸 수가 같아도(20칸) 채울 수 없는 테두리. 까닭이 칸 수만은 아니다
  const ring = rows(T.why[3].figures[0].rows);
  assert.equal(ring.length, 20);
  const solved = solveShadow(shadowBoard(SEVEN, ring));
  assert.deepEqual([solved.possible, solved.reason], [false, 'search']);
  assert.equal(bruteFillCount(ring, shapes), 0);
  assert.match(T.why[3].say, /칸 수가 같아도 안 되는 그림자가 있어요\./);
  // "왜 그럴까?"는 안 되는 판을 한 번 끝까지 만난 뒤에 열린다(틀의 기본 문)
  assert.equal(tuningFor('cutpaste').whyAfter, undefined);
});

test('직접 만들기: 빵의 수와 사람의 수를 정하면 선생님이 가장 적은 조각 수를 말하고 나누는 그림을 그린다', () => {
  const make = part('id="make-cutpaste"', 'id="make-fold"');
  for (const id of ['cutpaste-make-m', 'cutpaste-make-n', 'cutpaste-make-m-fewer', 'cutpaste-make-m-more', 'cutpaste-make-n-fewer', 'cutpaste-make-n-more', 'cutpaste-make-board', 'cutpaste-make-solve', 'cutpaste-make-result', 'cutpaste-make-play']) {
    assert.ok(make.includes(`id="${id}"`), id);
  }
  assert.match(make, /id="cutpaste-make-solve"[^>]*>선생님, 나눠 주세요</);
  assert.match(make, /id="cutpaste-make-play"[^>]*>내가 해 볼래요</);
  assert.match(T.make.intro, /선생님에게 나눠 보라고 할 수 있어요\.$/);
  assert.match(T.make['keep-not-yet'], /볼까요\?$/);
  assert.match(code, /const madeBoard = \(\) => \(draftReady\(\) \? draftBoard\(\) : null\);/);
  assert.match(code, /\n {4}madeBoard,\n/);
  assert.match(code, /bestOf: \(round\) => \(round\.mode !== 'share' \|\| round\.best === null \? null : \{ value: -round\.best, name: fill\(T\.notebook\.best, \{ k: round\.best \}\) \}\),/);
  assert.equal(fill(T.notebook.best, { k: 4 }), '조각 4개');
  assert.equal(MAKE_LEVEL, 6);
});

test('index.html: 이 형식의 카드, 판, 판 아래, 도구, 답하는 칸, 직접 만들기가 있다. 틀에 이어져 있다', () => {
  for (const id of ['home-cutpaste-sample', 'home-cutpaste-ask', 'home-cutpaste-play', 'home-cutpaste-pick', 'home-cutpaste-make', 'home-cutpaste-blank', 'cutpaste-board', 'cutpaste-count', 'cutpaste-status', 'cutpaste-numbers', 'cutpaste-pieces', 'cutpaste-best-line', 'cutpaste-best', 'cutpaste-tally', 'cutpaste-pad', 'cutpaste-move-box', 'cutpaste-tools', 'cutpaste-shadow-box', 'cutpaste-share-box', 'cutpaste-people', 'cutpaste-stop', 'cutpaste-maybe', 'cutpaste-impossible', 'make-cutpaste']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(part('id="cutpaste-title"', '</section>'), /<h2 id="cutpaste-title">자르고 붙이기<\/h2>/);
  assert.ok(visibleText(part('id="cutpaste-title"', '</section>')).includes(T.home.ask.move));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-cutpaste-make" class="menu-item"/);
  assert.match(part('id="cutpaste-tools"', '</div>'), /data-tool="cut"[^>]*>가위로 자르기<[\s\S]*data-tool="move"[^>]*>손으로 옮기기</);
  assert.match(part('id="cutpaste-maybe"', '</div>'), /id="cutpaste-impossible"[^>]*>불가능해요</);
  assert.match(part('id="cutpaste-share-box"', 'id="cutpaste-maybe"'), /id="cutpaste-stop"[^>]*hidden>여기까지 할래요</);
  assert.match(part('id="cutpaste-tally"', 'id="why"'), /aria-pressed="false" hidden>칸 수 적어 보기</);
  // 카드는 눈대중 다음, 퍼즐 만들기 앞이다
  assert.ok(html.indexOf('id="eyeball-title"') < html.indexOf('id="cutpaste-title"'));
  assert.ok(html.indexOf('id="cutpaste-title"') < html.indexOf('id="make-title"'));
  // 틀이 형식을 안다(형식 목록에서 눈대중 다음)
  assert.match(read('src/main.js'), /eyeball: createEyeball\(frame\), cutpaste: createCutpaste\(frame\), /);
  assert.match(read('src/check-main.js'), /\['cutpaste', '자르고 붙이기'\]/);
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
  assert.doesNotMatch(code, /hintsOpened/);
  // 판을 그리는 조각은 글을 받아 그릴 뿐 적지 않는다. 겹친 칸은 빗금, 그림자는 점선 테두리, 자를 선은 점선
  for (const name of ["'cp-overlap-line'", "'cp-shadow-edge'", "'cp-preview'", "'cp-knife'", '`cp-plate${']) assert.ok(board.includes(name), name);
  const css = read('src/app.css');
  assert.match(css, /\.cp-shadow-edge \{[^}]*stroke-dasharray/);
  assert.match(css, /\.cp-plate \{[^}]*stroke-dasharray/);
});

/** 끝까지 한 판의 기록 하나 */
function finished(more = {}) {
  return { kind: 'round', id: `r-${more.id ?? 1}`, format: 'cutpaste', level: 1, seed: 3, custom: false, mode: 'move', outcome: 'solved', hintsOpened: 0, answers: [{ t: 30, answer: 'rect:1', correct: true, guess: null }], wrongCount: 0, moveCount: 4, seconds: 50, solution: { possible: true }, ...more };
}

test('수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다. "왜 그럴까?"는 안 되는 판을 끝까지 만난 뒤에 열린다', () => {
  const tuning = tuningFor('cutpaste');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 5);
  assert.equal(tuning.hintCount, 2);
  assert.match(read('src/core/level.js'), /자르고 붙이기\(모두 임시\)/);
  assert.deepEqual(recommend([], 'cutpaste'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  assert.deepEqual(recommend([finished({ id: 1 }), finished({ id: 2, moveCount: 30 })], 'cutpaste'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, wrongCount: 1 })], 'cutpaste').offerHarder, false);
  assert.equal(whyUnlocked([finished()], 'cutpaste'), false);
  assert.equal(whyUnlocked([finished({ level: 4, mode: 'shadow', solution: { possible: false, reason: 'area' }, answers: [{ answer: 'impossible', correct: true }] })], 'cutpaste'), true);
});
