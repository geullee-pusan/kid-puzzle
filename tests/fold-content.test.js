// 접히는 모양 가리기 대본 점검: 화면에 나오는 글이 약속을 지키는지, "왜 그럴까?" 그림 속의 모양과 말이 풀이 프로그램과 맞는지 본다.
// 고른 것과 접어 본 것만 말한다(틀렸다고 하지 않는다), 힌트는 두 높이, "왜 그럴까?"는 모양 하나와 여럿 고르기 판에만 있고 알아챈 이야기다
// (여섯 칸 한 줄 → 네 칸 한 줄이 한 바퀴 감싼다 → 같은 쪽의 두 칸은 겹친다 → 네 칸 한 줄이 없어도 되는 모양),
// 화면 코드와 틀에 이 형식이 이어져 있는지, 입체 틀이 납작해지지 않게 쓰였는지도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { LADDER, MAKE_LEVEL, rungOf } from '../src/core/fold-ladder.js';
import { PICTURES, foldResult, hasRowOfFour, isCubeNet } from '../src/core/fold.js';
import { fill, sentenceCount } from '../src/core/text.js';
import { clashGroups3d, isNet3d } from './helpers/brute-fold.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/fold.json'));
const html = read('index.html');
const code = read('src/formats/fold.js');
const board = read('src/ui/fold-board.js');
const solid = read('src/ui/solid.js');

const VALUES = { k: 4, f: 1, n: 3, no: 5, face: T.pictures.heart, total: 11 };
/** 그림의 값은 글이 아니다 */
const DATA_KEYS = ['picture', 'blank', 'seed', 'w', 'h', 'rows', 'level'];

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

function visibleText(source) {
  const labels = [...source.matchAll(/aria-label="([^"]*)"/g)].map((match) => match[1]);
  const body = source
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  return [...labels, body].join(' ');
}
const part = (from, to) => {
  const at = html.lastIndexOf('<', html.indexOf(from));
  return html.slice(at, html.lastIndexOf('<', html.indexOf(to, html.indexOf(from))));
};
const own = [part('id="fold-title"', 'id="domino-title"'), part('id="fold-count"', 'id="cutpaste-count"'), part('id="fold-pad"', 'id="cutpaste-pad"'), part('id="make-fold"', 'id="make-domino"')].map(visibleText).join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const said = strings.map(([, text]) => text).join(' ');
const cellsOf = (rows) => rows.flatMap((row, y) => [...row].flatMap((mark, x) => (mark === '#' ? [[x, y]] : [])));

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 단계 목록이 사다리와 같다', () => {
  assert.equal(T.title, '접히는 모양 가리기');
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.deepEqual(T.levels.map((item) => item.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(T.levels.map((item) => item.name), ['모양 하나 접어 보기', '주사위의 숨은 면', '되는 모양 모두 고르기', '접고 나면 어디로', '열한 가지 모두 찾기', '직접 만들기']);
  for (const rung of LADDER) assert.ok(T.home.ask[rung.mode], rung.level);
  for (const entry of T.levels) assert.ok(rungOf(entry.level).mode === 'make' ? entry.picture.blank === true : entry.picture.seed === 1, entry.name);
  // 그림마다 이름이 있다(글자가 아닌 모양과 색)
  assert.deepEqual(Object.keys(T.pictures).sort(), PICTURES.slice().sort());
});

test('틀렸다고 하지 않고 고른 것과 접어 본 것만 말한다. 판정하는 말과 칭찬 낱말이 없다', () => {
  assert.doesNotMatch(said, /틀렸|틀린|아니에요|땡|정답|아쉽|실수|실패|성공|잘했|훌륭|대단|최고|멋져|멋진|완벽|축하|천재|똑똑|굉장|맞아요/);
  assert.doesNotMatch(own, /틀렸|틀린|아니에요|땡|아쉽|실패|잘했|훌륭|대단|최고|멋/);
  assert.equal(fill(`${T.right['said-no']} ${T.right.clash}`, { n: 1 }), '안 돼요라고 했어요. 접어 보니 빗금 친 두 칸이 같은 면에 겹쳐요. 그래서 빈 면이 1개 생겨요.');
  assert.equal(fill(T.right.many, { n: 3, k: 4 }), '3개를 골랐어요. 접어 보니 정육면체가 되는 것은 4개예요.');
  // 모양 하나: 고르면 접어 보이고 판이 끝난다(답은 기록에 맞고 틀림으로 적는다)
  assert.match(code, /round\.folded = true;\s*round\.foldCount \+= 1;\s*frame\.finish\('solved'\);/);
  // 맞은편과 주사위: 맞으면 끝나고, 아니면 사실 하나를 말하고 판은 그대로다. 같은 것을 다시 골라도 두 번 세지 않는다
  assert.match(code, /if \(correct\) \{\s*frame\.finish\('solved'\);\s*return;\s*\}/);
  assert.equal([...code.matchAll(/if \(!same\) round\.wrongCount \+= 1;/g)].length, 2);
  assert.equal(fill(T.play['opposite-near'], { face: T.pictures.moon }), '반달 그림은 접으면 표시한 칸 바로 옆에 와요. 돌려 보거나 펼쳐서 다른 칸을 골라 볼까요?');
  assert.equal(fill(T.play['dice-apart'], { no: 5 }), '주사위를 떼어 놓았어요. 안 보이던 면 5개에 고리를 둘렀어요. 그 눈을 모두 더하면 몇 개일까요?');
  assert.doesNotMatch(code, /Math\.random/);
  // 판 아래에는 할 일 한 줄만 적는다(몇 번 접고 돌렸는지 적지 않는다)
  const foot = part('id="fold-count"', 'id="cutpaste-count"');
  assert.doesNotMatch(visibleText(foot), /번|횟수/);
  for (const line of code.split('\n')) if (/textContent/.test(line)) assert.doesNotMatch(line, /moveCount|foldCount|spinCount|apartCount|wrongCount|tries\.length/, line.trim());
});

test('규칙 설명은 세 문장 안이다. 판의 종류마다 있고, 직접 만들기의 안내 글도 세 문장 안이다', () => {
  assert.deepEqual(Object.keys(T.rules).sort(), ['all', 'all-fixed', 'box', 'dice', 'dice-one', 'fold', 'made', 'many', 'opposite']);
  for (const [key, rule] of Object.entries(T.rules)) assert.ok(sentenceCount(fill(rule, VALUES)) <= 3, key);
  // 주사위의 약속(마주 보는 두 면의 합이 7)은 규칙에서 말한다
  for (const key of ['dice', 'dice-one']) assert.match(T.rules[key], /마주 보는 두 면의 눈을 더하면 7개예요\./);
  assert.match(T.rules.all, /돌리거나 뒤집어 같은 모양은 하나로 세요\.$/);
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 42);
  assert.ok(sentenceCount(guides[21]) <= 3, guides[21]);
  assert.match(guides[21], /^칸을 눌러 정사각형 여섯 칸을 이어 붙여요\./);
  assert.match(guides[21], /안 되는 모양도 만들 수 있을까요\?$/);
});

test('힌트는 판의 종류마다 두 개이고, 하나하나가 질문 한 문장이다. 까닭을 말해 버리지 않는다', () => {
  assert.deepEqual(Object.keys(T.hints).sort(), ['all', 'dice', 'fold', 'many', 'opposite']);
  for (const [key, list] of Object.entries(T.hints)) {
    assert.equal(list.length, 2, key);
    assert.notEqual(list[0], list[1]);
    for (const hint of list) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
      assert.doesNotMatch(hint, /때문|해야 해요|하면 돼요|늘 |7/, hint);
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
  assert.equal(sentences(fill(T.rules.opposite, { face: T.pictures.circle }))[1], '접으면 동그라미 그림의 맞은편에는 어느 칸이 올까요?');
  assert.equal(fill(T.play['all-flip'], { no: '첫 ' }), '첫 번째로 찾은 모양과 같아요. 뒤집으면 겹쳐요.');
  assert.equal(fill(T.solution.dice, { no: 5, k: 20, n: 3, f: 1 }), '안 보이는 면은 5개이고, 눈은 모두 20개예요. 주사위마다 바닥과 위를 더하면 7개라, 7개씩 3번 더하고 맨 위 면의 눈 1개를 빼도 돼요.');
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
    ...Object.values(T.ask),
    ...Object.values(T.cardNotes),
    ...Object.entries(T.make)
      .filter(([key]) => key !== 'count')
      .map(([, text]) => text),
    ...T.why.map((slide) => slide.say),
  ];
  for (const text of spoken) for (const sentence of sentences(text)) assert.match(sentence, /요[.?!]?$/, sentence);
  for (const text of Object.values(T.status)) assert.match(text, /요$/, text);
  for (const slide of T.why) for (const item of slide.figures) assert.match(item.note, /요$/, item.note);
  for (const [path, text] of strings) for (const sentence of sentences(text)) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

test('"왜 그럴까?"는 모양 하나와 여럿 고르기 판에만 있는 그림 넷의 알아챈 이야기다. 그림 속의 모양과 말이 풀이 프로그램과 같다', () => {
  assert.equal(T.why.length, 4);
  assert.match(code, /function whyPages\(round\) \{\n\s*if \(round\.mode !== 'fold' && round\.mode !== 'many'\) return null;/);
  for (const slide of T.why) assert.ok(sentenceCount(slide.say) <= 3, slide.say);
  const [one, two, three, four] = T.why.map((slide) => slide.figures.map((item) => cellsOf(item.rows)));
  // 첫 장: 여섯 칸 한 줄. 다섯째 칸은 첫째 칸과, 여섯째 칸은 둘째 칸과 겹친다
  assert.deepEqual(clashGroups3d(one[0]), [[0, 4], [1, 5]]);
  assert.match(T.why[0].say, /다섯째 칸은 첫째 칸과, 여섯째 칸은 둘째 칸과 겹쳐요\.$/);
  // 둘째 장: 십자 모양은 된다. 남은 두 칸이 줄의 위와 아래에 있다
  assert.ok(isCubeNet(two[0]) && isNet3d(two[0]) && hasRowOfFour(two[0]));
  // 셋째 장: 두 칸이 줄의 같은 쪽(위)에 붙으면 그 둘이 겹친다
  assert.equal(isNet3d(three[0]), false);
  const top = three[0].map((cell, index) => (cell[1] === 0 ? index : -1)).filter((index) => index >= 0);
  assert.deepEqual(clashGroups3d(three[0]), [top]);
  assert.deepEqual(foldResult(three[0]).clashes.map((group) => group.slice().sort()), [top]);
  // 넷째 장: 네 칸 한 줄이 없어도 되는 모양 둘(세 칸 두 줄, 두 칸 계단)
  assert.equal(four.length, 2);
  for (const cells of four) assert.ok(isNet3d(cells) && !hasRowOfFour(cells));
  // "왜 그럴까?"는 정육면체가 안 되는 모양을 한 번 끝까지 만난 뒤에 열린다(틀의 기본 문)
  assert.equal(tuningFor('fold').whyAfter, undefined);
});

test('직접 만들기: 모눈을 눌러 여섯 칸을 놓으면 선생님이 접어 보이고, 공책에 남기거나 해 볼 수 있다', () => {
  const make = part('id="make-fold"', '<script');
  for (const id of ['fold-make-count', 'fold-make-clear', 'fold-make-board', 'fold-make-solve', 'fold-make-result', 'fold-make-picture', 'fold-make-play']) assert.ok(make.includes(`id="${id}"`), id);
  assert.match(make, /id="fold-make-solve"[^>]*>선생님, 접어 주세요</);
  assert.match(make, /id="fold-make-play"[^>]*>내가 해 볼래요</);
  assert.match(T.make.intro, /선생님에게 접어 보라고 할 수 있어요\.$/);
  assert.match(T.make['keep-not-yet'], /볼까요\?$/);
  assert.match(code, /const madeBoard = \(\) => \(draft && readyToFold\(draft\.cells\) \? \{ kind: 'fold', cells: normalize\(draft\.cells\) \} : null\);/);
  assert.match(code, /\n {4}madeBoard,\n/);
  assert.match(code, /bestOf: \(round\) => \(round\.mode !== 'all' \|\| round\.found\.length === 0 \? null : \{ value: round\.found\.length, name: fill\(T\.notebook\.best, \{ k: round\.found\.length \}\) \}\),/);
  assert.equal(fill(T.notebook.best, { k: 7 }), '정육면체가 되는 모양 7가지');
  assert.equal(MAKE_LEVEL, 6);
});

test('index.html: 이 형식의 카드, 판, 판 아래, 답하는 칸, 직접 만들기가 있다. 틀에 이어져 있다', () => {
  for (const id of ['home-fold-sample', 'home-fold-ask', 'home-fold-play', 'home-fold-pick', 'home-fold-make', 'home-fold-blank', 'fold-board', 'fold-count', 'fold-status', 'fold-flip', 'fold-pad', 'fold-fold-box', 'fold-ask', 'fold-yes', 'fold-no', 'fold-many-box', 'fold-many-go', 'fold-opposite-box', 'fold-dice-box', 'fold-typed', 'fold-keys', 'fold-dice-go', 'fold-all-box', 'fold-all-go', 'fold-clear', 'fold-shelf-title', 'fold-shelf', 'fold-stop', 'make-fold']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(part('id="fold-title"', '</section>'), /<h2 id="fold-title">접히는 모양 가리기<\/h2>/);
  assert.ok(visibleText(part('id="fold-title"', '</section>')).includes(T.home.ask.fold));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-fold-make" class="menu-item"/);
  assert.match(part('id="fold-fold-box"', 'id="fold-many-box"'), /id="fold-yes"[^>]*>돼요<[\s\S]*id="fold-no"[^>]*>안 돼요</);
  assert.match(part('id="fold-dice-box"', 'id="fold-all-box"'), /id="fold-dice-go"[^>]*>이 수예요</);
  assert.match(part('id="fold-all-box"', 'id="cutpaste-pad"'), /id="fold-stop"[^>]*hidden>여기까지 할래요</);
  // 카드는 자르고 붙이기 다음, 퍼즐 만들기 앞이다
  assert.ok(html.indexOf('id="cutpaste-title"') < html.indexOf('id="fold-title"'));
  assert.ok(html.indexOf('id="fold-title"') < html.indexOf('id="make-title"'));
  // 틀이 형식을 안다(형식 목록의 맨 뒤, 자르고 붙이기 다음)
  assert.match(read('src/main.js'), /cutpaste: createCutpaste\(frame\), fold: createFold\(frame\), /);
  assert.match(read('src/check-main.js'), /\['fold', '접히는 모양 가리기'\]/);
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
  assert.doesNotMatch(code, /hintsOpened/);
  // 무르기와 되돌리기는 이 형식에 없다
  assert.match(code, /\$\('undo'\)\.hidden = true;\s*\$\('reset'\)\.hidden = true;/);
  // 판을 그리는 조각은 글을 받아 그릴 뿐 적지 않는다. 겹치는 칸은 빗금, 표시한 칸은 점선 테두리, 안 보이던 면은 고리
  for (const name of ["'fd-ring'", "'fd-hidden'", "'fd-pip'", "'fd-lock'"]) assert.ok(board.includes(name), name);
  for (const name of ["'fd-clash'", "'fd-mark'", "'fd-picked'"]) assert.ok(code.includes(name), name);
  const css = read('src/app.css');
  assert.match(css, /\.sd-skin\.fd-clash \{[^}]*repeating-linear-gradient/);
  assert.match(css, /\.sd-skin\.fd-mark \{[^}]*dashed/);
  assert.match(css, /\.fd-ring \{[^}]*stroke-dasharray/);
});

test('입체 틀: 끌면 돌아가고, 입체로 쌓는 것에는 납작하게 만드는 속성을 쓰지 않는다. 판을 누르는 것은 손가락에 맞는 크기다', () => {
  assert.match(solid, /addEventListener\('pointerdown'/);
  assert.match(solid, /addEventListener\('pointermove'/);
  assert.match(solid, /setPointerCapture/);
  const css = read('src/app.css').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const selector of ['.sd-world', '.sd-face', '.sd-hinge', '.sd-die', '.sd-root']) {
    const block = css.match(new RegExp(`\\n${selector.replace('.', '\\.')} \\{([^}]*)\\}`))[1];
    assert.doesNotMatch(block, /overflow|opacity|filter|clip-path/, selector);
    if (selector !== '.sd-root') assert.match(block, /transform-style: preserve-3d/, selector);
  }
  // 끌 수 있는 무대는 화면을 굴리지 않는다
  assert.match(css, /\.sd-scene\.live \{[^}]*touch-action: none/);
  // 모눈의 칸은 화면에서 한 칸이 96px을 넘지 않게 그리고, 판(가로 6칸)이 좁아도 손가락에 맞는 크기다(테스트 화면에서 한 칸 65px)
  assert.match(css, /\.fd-grid-svg \{[^}]*max-width: calc\(var\(--w\) \* 96px\)/);
  // 화면 코드에 시간 재촉이 없다(움직임은 CSS의 전환으로만)
  assert.doesNotMatch(solid, /setInterval|setTimeout/);
});

/** 끝까지 한 판의 기록 하나 */
function finished(more = {}) {
  return { kind: 'round', id: `r-${more.id ?? 1}`, format: 'fold', level: 1, seed: 3, custom: false, mode: 'fold', outcome: 'solved', hintsOpened: 0, answers: [{ t: 10, answer: 'yes', correct: true, guess: null }], wrongCount: 0, moveCount: 1, seconds: 20, solution: { possible: true }, ...more };
}

test('수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다. "왜 그럴까?"는 안 되는 모양을 끝까지 만난 뒤에 열린다', () => {
  const tuning = tuningFor('fold');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 5);
  assert.equal(tuning.hintCount, 2);
  assert.match(read('src/core/level.js'), /접히는 모양 가리기\(모두 임시\)/);
  assert.deepEqual(recommend([], 'fold'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  assert.deepEqual(recommend([finished({ id: 1 }), finished({ id: 2 })], 'fold'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, wrongCount: 1 })], 'fold').offerHarder, false);
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, seconds: 100 })], 'fold').offerHarder, false);
  assert.equal(whyUnlocked([finished()], 'fold'), false);
  assert.equal(whyUnlocked([finished({ solution: { possible: false }, answers: [{ answer: 'no', correct: true }] })], 'fold'), true);
});
