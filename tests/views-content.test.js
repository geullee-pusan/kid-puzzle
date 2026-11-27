// 세 방향에서 본 그림 대본 점검: 화면에 나오는 글이 약속을 지키는지, "왜 그럴까?"의 그림과 말이 다른 방법으로 따진 것과 맞는지 본다.
// 한 일과 사실만 말한다(틀렸다고 하지 않는다), 힌트는 두 높이, 규칙은 세 문장 안, 색만으로 알리지 않는다.
// 화면 코드와 틀에 이 형식이 이어져 있는지도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { LADDER, generateBoard } from '../src/core/views-ladder.js';
import { checkBoard, countStacks, tallest } from '../src/core/views.js';
import { fill, sentenceCount } from '../src/core/text.js';
import { countByExclusion, fewestByLevels, look, mostByCells } from './helpers/brute-views.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/views.json'));
const html = read('index.html');
const code = read('src/formats/views.js');
const board = read('src/ui/views-board.js');
const solid = read('src/ui/solid.js');
const css = read('src/app.css');

const VALUES = { k: 12, f: 3, n: 4, no: '첫 ', face: '오른쪽 옆', total: 16 };
/** 그림과 판의 값은 글이 아니다 */
const DATA_KEYS = ['picture', 'blank', 'seed', 'heights', 'show', 'w', 'd', 'level'];

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
const own = [part('id="views-title"', 'id="slide-title"'), part('id="views-turns"', 'id="slide-tool"'), part('id="views-board"', 'id="slide-board"'), part('id="views-count"', 'id="slide-count"'), part('id="views-pad"', 'id="slide-pad"'), part('id="make-views"', 'id="make-slide"')].map(visibleText).join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const said = strings.map(([, text]) => text).join(' ');

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 단계 목록이 사다리와 같다', () => {
  assert.equal(T.title, '세 방향에서 본 그림');
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.deepEqual(T.levels.map((item) => item.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(T.levels.map((item) => item.name), ['보이는 그림 고르기', '쌓아서 맞추기', '위에서 본 그림 맞히기', '가장 적게, 가장 많이', '세 그림 모두 맞추기', '직접 만들기']);
  for (const entry of T.levels.filter((item) => !item.picture.blank)) assert.equal(checkBoard(generateBoard(entry.level, entry.picture.seed).board), null);
  assert.deepEqual(Object.keys(T.home.ask).sort(), ['build', 'range', 'see', 'three', 'top']);
  assert.deepEqual(Object.keys(T.hints).sort(), ['build', 'made', 'range', 'see', 'three', 'top']);
  assert.deepEqual(Object.keys(T.rules).sort(), ['build', 'made', 'range', 'see', 'three', 'top']);
});

test('한 일과 사실만 말한다. 판정하는 말, 칭찬 낱말이 없다. 다른 보기를 고르면 그 보기가 무엇인지(안 되는 까닭)만 말한다', () => {
  assert.doesNotMatch(said, /틀렸|틀린|아니에요|땡|정답|아쉽|실수|실패|성공|잘했|훌륭|대단|최고|멋져|멋진|완벽|축하|천재|똑똑|굉장|맞아요|맞혔/);
  assert.doesNotMatch(own, /틀렸|틀린|아니에요|땡|아쉽|실패|잘했|훌륭|대단|최고|멋/);
  for (const key of ['see-back', 'see-left', 'see-side', 'see-front', 'see-near', 'see-cell-full', 'see-cell-empty', 'see-other']) assert.match(T.play[key], /^고른 그림은 /, key);
  assert.equal(fill(T.play['see-near'], { no: '2', k: 3 }), '고른 그림은 왼쪽에서 2번째 줄이 3층이에요. 판에서 그 줄을 세어 볼까요?');
  assert.equal(fill(T.play['top-empty-front'], { no: '첫 ', k: 2 }), '고른 그림에는 왼쪽에서 첫 번째 줄에 칸이 하나도 없어요. 앞에서 보면 그 줄에 2층까지 보여요.');
  assert.equal(fill(T.play['top-short-side'], { no: '3', k: 3, n: 2 }), '옆에서 보면 앞에서 3번째 줄이 3층이에요. 고른 그림에서 그 줄의 칸들은 앞에서 보면 가장 높아도 2층이에요.');
  // 까닭의 종류(빈 줄, 모자라는 높이, 보이지 않는 줄)와 방향(앞, 옆)마다 한 줄씩 있다
  for (const kind of ['empty', 'short', 'seen']) for (const axis of ['front', 'side']) assert.ok(T.play[`top-${kind}-${axis}`], `${kind}-${axis}`);
  // 되는 보기를 고르거나 그림과 똑같아져야 끝난다. 다른 보기는 다시 누를 수 없게 두고 사실만 말한다
  assert.match(code, /const correct = at === solution\.answer;/);
  assert.match(code, /round\.tried = \[\.\.\.round\.tried, at\];\s*round\.wrongCount \+= 1;/);
  assert.match(code, /\} else if \(round\.mode !== 'top' && matches\(board, heights\)\) \{/);
  assert.match(code, /if \(round\.few === solution\.fewest && round\.many === solution\.most\) \{\s*frame\.finish\('solved'\);/);
  assert.equal([...code.matchAll(/frame\.finish\(/g)].length, 4);
  assert.doesNotMatch(code + board, /Math\.random/);
  // 판 아래에는 할 일이나 사실 한 줄과 쌓기나무의 수만 적는다. 무른 수나 골라 본 수는 적지 않는다
  for (const line of code.split('\n')) if (/textContent/.test(line)) assert.doesNotMatch(line, /undoCount|resetCount|wrongCount|moveCount|turnCount|spinCount/, line.trim());
});

test('가장 적게, 가장 많이: 틀렸다고 하지 않고 "더 줄일 수 있을까요?"처럼 묻는다. 끝에 닿으면 그 사실을 말한다', () => {
  assert.equal(T.play['ask-fewer'], '더 줄일 수 있을까요?');
  assert.equal(T.play['best-few'], '이보다 적게는 안 돼요.');
  assert.equal(T.play['best-many'], '이보다 많이는 안 돼요.');
  assert.equal(fill(T.play.match, { k: 5 }), '쌓기나무 5개로 두 그림과 똑같아졌어요.');
  // 가장 적은(많은) 수에 닿았다는 말은 풀이 프로그램이 낸 수와 같을 때만 한다
  assert.match(code, /if \(fewer && cubes === solution\.fewest\) \{\s*parts\.push\(T\.play\['best-few'\]\);/);
  assert.match(code, /\} else if \(more && cubes === solution\.most\) \{\s*parts\.push\(T\.play\['best-many'\]\);/);
  // 두 기록은 오른쪽 칸에 보인다. "여기까지 할래요"로 끝내도 된다
  assert.match(part('id="views-pad"', 'id="slide-pad"'), /id="views-stop"[^>]*>여기까지 할래요</);
  assert.equal(fill(T.notebook.best, { k: 3, n: 5 }), '가장 적게 3개, 가장 많이 5개');
  assert.match(code, /bestOf: \(round\) => \(round\.mode !== 'range' \|\| round\.few === null \|\| round\.many === null \? null :/);
});

test('무르기와 처음으로 뒤에는 앞의 말을 덮는 한마디를 한다', () => {
  assert.equal(T.play.undo, '무르기 전 모습으로 돌아왔어요.');
  assert.equal(T.play.reset, '처음 모습으로 돌아왔어요.');
  assert.match(code, /frame\.note\('undo'\);[\s\S]*?frame\.say\(T\.play\.undo\);/);
  assert.match(code, /frame\.note\('reset'\);[\s\S]*?frame\.say\(T\.play\.reset\);/);
  // 쌓은 것이 바뀌면 직접 만들기에서 선생님이 그린 그림을 지우고 바뀌었다는 사실만 말한다
  assert.match(code, /if \(said\) frame\.talkers\.make\.say\(T\.make\.changed\);/);
});

test('규칙 설명은 세 문장 안이다. 직접 만들기의 안내 글도 세 문장 안이다', () => {
  for (const [key, rule] of Object.entries(T.rules)) assert.ok(sentenceCount(fill(rule, VALUES)) <= 3, key);
  assert.equal(fill(T.rules.see, { face: '앞' }), '쌓기나무를 쌓았어요. 끌거나 아래 단추를 누르면 돌아가요. 앞에서 본 그림은 어느 것일까요?');
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 50);
  const mine = guides[46];
  assert.ok(sentenceCount(mine) <= 3, mine);
  assert.match(mine, /^칸을 눌러 쌓기나무를 쌓아요\./);
  // 오른쪽 옆에서 본 그림과 위에서 본 그림의 방향(어느 쪽이 앞인지)을 오른쪽 칸에 적어 둔다
  assert.match(part('id="views-pad"', 'id="slide-pad"'), /옆 그림은 왼쪽이 앞 줄, 위 그림은 아래쪽이 앞 줄이에요\./);
});

test('힌트는 판의 종류마다 두 개이고, 하나하나가 질문 한 문장이다. 힌트 1은 함께 쓰는 목록에서 고른다. 까닭은 힌트에 없다', () => {
  const common = ['끝에는 어떤 모양이 되어야 하나요?', '끝나기 바로 전에는 어떤 모양일까요?', '더 작은 판이라면 할 수 있을까요?', '전에 해 본 판 가운데 닮은 판이 있었나요?', '규칙 하나가 없다면 어디까지 되나요?', '아직 한 번도 건드리지 않은 곳이 있나요?', '아까와 다른 곳에서 시작하면 어떻게 되나요?'];
  for (const [key, list] of Object.entries(T.hints)) {
    assert.equal(list.length, 2, key);
    assert.notEqual(list[0], list[1]);
    assert.ok(common.includes(list[0]), list[0]);
    for (const hint of list) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
      assert.doesNotMatch(hint, /때문|해야 해요|하면 돼요|낮은 쪽|함께 맡|\d/, hint);
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
  // 수와 차례 뒤에는 받침과 상관없는 말('층', '개', '가지', '번째', '칸', '까지')만 붙인다
  for (const [path, text] of strings) assert.doesNotMatch(text, /\{(k|n|f|total|no)\}(이|가(?!지)|은|는|을|를|과|와|으로|로)/, path);
  assert.equal(fill(T.labels.cell, { no: '첫 ', n: '2', k: 3 }), '앞에서 첫 번째 줄 왼쪽에서 2번째 칸, 쌓기나무 3개');
});

test('화면 글에 영어 낱말과 보상 낱말이 없고, "~요"로 끝나는 말투다. 한 문장은 60자를 넘지 않는다', () => {
  for (const [path, text] of strings) assert.doesNotMatch(text.replace(/\{[^{}]*\}/g, ''), /[A-Za-z]/, `${path}: ${text}`);
  assert.doesNotMatch(own, /[A-Za-z]/);
  assert.doesNotMatch(own, /별|점수|순위|레벨|연속/);
  const spoken = [...Object.values(T.home.ask), T.home.pick, ...Object.values(T.rules), ...Object.values(T.play), ...Object.values(T.hints).flat(), ...Object.values(T.right), ...['see', 'build', 'build-one', 'top', 'range', 'three', 'three-one'].map((key) => T.solution[key]), ...['intro', 'one', 'many', 'need', 'changed', 'keep-not-yet'].map((key) => T.make[key]), ...T.why.map((slide) => slide.say), T.pad.ask];
  for (const text of spoken) for (const sentence of sentences(text)) assert.match(sentence, /요[.?!]$/, sentence);
  for (const text of Object.values(T.status)) assert.match(text, /요$/, text);
  for (const text of [T.solution.count, T.solution.answer, T.solution.shown]) assert.match(text, /요$/, text);
  for (const slide of T.why) for (const item of slide.figures) assert.match(item.note, /요$/, item.note);
  for (const [path, text] of strings) for (const sentence of sentences(fill(text, VALUES))) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

test('가장 많이 쌓는 법(낮은 쪽)과 가장 적게 쌓는 법(한 칸이 두 줄을 함께 맡는다)은 "왜 그럴까?"에서만 말한다', () => {
  for (const [path, text] of strings) {
    if (path.startsWith('why')) continue;
    assert.doesNotMatch(text, /낮은 쪽|함께 맡/, `${path}: ${text}`);
  }
  assert.doesNotMatch(own, /낮은 쪽|함께 맡/);
  // 이야기의 순서: 뜻밖의 결과(같은 그림인데 6개와 11개) → 가장 많이 → 가장 적게 → 그대로 통하지 않는 판(세 그림을 다 주어도 하나로 정해지지 않는다)
  assert.match(T.why[0].say, /6개, 한 번은 11개였어요\./);
  assert.match(T.why[1].say, /낮은 쪽이에요\./);
  assert.match(T.why[2].say, /함께 맡아요\./);
  assert.match(T.why[3].say, /하나로 정해지지 않을 때가 있어요\./);
});

test('"왜 그럴까?": 그림의 수가 말과 맞고, 다른 방법으로 따져도 같다', () => {
  assert.equal(T.why.length, 4);
  for (const slide of T.why) assert.ok(sentenceCount(slide.say) <= 3, slide.say);
  const sum = (list) => list.reduce((total, value) => total + value, 0);
  const [first, second, third, fourth] = T.why;
  // 첫 장: 앞과 옆이 같은 두 쌓기, 6개와 11개. 이 두 그림으로 가장 적게는 6개, 가장 많이는 11개다
  const [few, many] = first.figures;
  const a = look(few.w, few.d, few.heights);
  const b = look(many.w, many.d, many.heights);
  assert.deepEqual([a.front, a.side], [b.front, b.side]);
  assert.deepEqual([sum(few.heights), sum(many.heights)], [6, 11]);
  const counted = countStacks(few.w, few.d, a.front, a.side);
  assert.deepEqual([counted.fewest, counted.most], [6, 11]);
  assert.deepEqual([fewestByLevels(a.front, a.side), mostByCells(a.front, a.side)], [6, 11]);
  for (const item of first.figures) assert.equal(item.note, `쌓기나무 ${sum(item.heights)}개예요`);
  // 둘째 장: 가장 많이 쌓은 것의 칸마다의 수는 두 줄 높이 가운데 낮은 쪽이다
  const numbers = second.figures.find((item) => item.show === 'numbers');
  assert.deepEqual(numbers.heights, tallest(numbers.w, numbers.d, a.front, a.side));
  assert.deepEqual(numbers.heights, many.heights);
  assert.deepEqual(second.figures.map((item) => item.show), ['front', 'side', 'numbers']);
  // 셋째 장: 가장 적게 쌓은 것. 3층 줄 둘과 2층 줄 둘이 한 칸씩에서 만난다
  const fewest = third.figures.find((item) => item.show === 'numbers');
  assert.deepEqual(fewest.heights, few.heights);
  assert.equal(fewest.heights[0], 3);
  assert.deepEqual([a.front[0], a.side[0]], [3, 3]);
  assert.equal(fewest.heights[5], 2);
  assert.deepEqual([a.front[2], a.side[1]], [2, 2]);
  // 넷째 장: 세 그림이 모두 같은 두 쌓기. 이 세 그림이 되는 쌓기는 모두 7가지다
  const [one, two] = fourth.figures;
  const c = look(one.w, one.d, one.heights);
  assert.deepEqual(c, look(two.w, two.d, two.heights));
  assert.notDeepEqual(one.heights, two.heights);
  assert.equal(countByExclusion(one.w, one.d, c.front, c.side, c.plan), 7);
  assert.equal(countStacks(one.w, one.d, c.front, c.side, c.plan).count, 7);
  assert.match(fourth.say, /모두 7가지예요\.$/);
  // "왜 그럴까?"는 가장 적게, 가장 많이의 판을 한 번 끝까지 한 뒤에 열린다
  assert.match(code, /if \(!frame\.records\(\)\.some\(isRangeDone\)\) return null;/);
});

test('끝났을 때와 직접 만들기의 말: 같은 그림이 되는 쌓기가 몇 가지인지 사실로 말한다', () => {
  assert.equal(fill(T.right['three-many'], { k: 5 }), '세 그림이 이렇게 되는 쌓기는 모두 5가지예요.');
  assert.equal(T.right['three-one'], '세 그림이 이렇게 되는 쌓기는 이것 하나뿐이에요.');
  assert.equal(fill(T.right['range-truth'], { f: 3, total: 5 }), '이 두 그림은 가장 적게 3개, 가장 많이 5개로 쌓을 수 있어요.');
  assert.equal(fill(T.make.many, { k: 2 }), '세 방향에서 본 그림이에요. 이 세 그림이 되는 쌓기가 이것 말고도 2가지 더 있어요.');
  assert.match(code, /const line = counted\.count === 1 \? T\.make\.one : fill\(T\.make\.many, \{ k: counted\.count - 1 \}\);/);
  const make = part('id="make-views"', 'id="make-slide"');
  for (const id of ['views-make-w-fewer', 'views-make-w', 'views-make-w-more', 'views-make-d-fewer', 'views-make-d', 'views-make-d-more', 'views-make-add', 'views-make-remove', 'views-make-stage', 'views-make-grid', 'views-make-solve', 'views-make-result', 'views-make-picture', 'views-make-play']) {
    assert.ok(make.includes(`id="${id}"`), id);
  }
  assert.match(make, /id="views-make-solve"[^>]*>선생님, 그려 보세요</);
  assert.match(make, /id="views-make-play"[^>]*>내가 해 볼래요</);
  assert.match(code, /mode: custom \? 'made' : rungOf\(level\)\.mode,/);
  assert.match(code, /\n {4}madeBoard,\n/);
});

test('index.html: 이 형식의 카드, 판, 판 아래, 오른쪽 칸, 돌리는 단추, 직접 만들기가 있다. 틀에 이어져 있다', () => {
  for (const id of ['home-views-sample', 'home-views-ask', 'home-views-play', 'home-views-pick', 'home-views-make', 'home-views-blank', 'views-board', 'views-stage', 'views-grid', 'views-count', 'views-status', 'views-cubes', 'views-turns', 'views-turn-front', 'views-turn-side', 'views-turn-top', 'views-turn-tilt', 'views-pad', 'views-ask', 'views-options', 'views-compare', 'views-add', 'views-remove', 'views-top-options', 'views-few', 'views-many', 'views-stop', 'make-views']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(part('id="views-title"', '</section>'), /<h2 id="views-title">세 방향에서 본 그림<\/h2>/);
  assert.ok(visibleText(part('id="views-title"', '</section>')).includes(T.home.ask.see));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-views-make" class="menu-item"/);
  // 카드는 부호 넣어 수 만들기 다음, 퍼즐 만들기 앞이다
  assert.ok(html.indexOf('id="signs-title"') < html.indexOf('id="views-title"'));
  assert.ok(html.indexOf('id="views-title"') < html.indexOf('id="make-title"'));
  // 틀이 형식을 안다(부호 넣어 수 만들기 다음)
  assert.match(read('src/main.js'), /signs: createSigns\(frame\), views: createViews\(frame\), /);
  assert.match(read('src/check-main.js'), /\['views', '세 방향에서 본 그림'\]/);
  assert.match(read('src/core/smaller.js'), /signs: smallerSigns, views: smallerViews, /);
  assert.match(code, /smaller: \(round, turn\) => smallerViews\(\{ mode: round\.mode, board: round\.board \}, turn\),/);
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
  assert.match(code, /\$\('undo'\)\.hidden = false;\s*\$\('reset'\)\.hidden = false;/);
  // 시계와 스스로 넘어가는 것이 없다. 돌아가는 움직임은 단추를 눌렀을 때만 있고, 움직임을 줄이는 설정에서는 없다
  assert.doesNotMatch(board + code, /setInterval|setTimeout|requestAnimationFrame/);
  assert.doesNotMatch(solid, /setInterval|setTimeout/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.sd-scene\.stack \.sd-world \{\s*transition: none;/);
  assert.match(code, /ruleAside: true,/);
});

test('화면: 누르는 자리(쌓는 판의 칸, 보기, 돌리는 단추)가 44픽셀보다 크다. 쌓기나무와 그림은 색만이 아니라 테두리와 모양으로도 보인다', () => {
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const block = (selector) => plain.match(new RegExp(`\\n${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`))[1];
  assert.match(block('.vw-cell'), /min-width: 48px;/);
  assert.match(block('.vw-cell'), /min-height: 48px;/);
  assert.match(block('.vw-grid'), /grid-template-columns: repeat\(var\(--w\), var\(--cell, 56px\)\);/);
  assert.match(board, /grid\.style\.setProperty\('--cell', view\.w >= 4 \? '48px' : '56px'\);/);
  assert.match(block('.vw-option'), /min-height: 100px;/);
  // 가장 큰 판(4×4)의 쌓는 판은 가로 48×4 + 4×3 = 204픽셀이라, 1180×820 화면에서 가로 476픽셀쯤인 판 칸에 쌓기나무(가로 260픽셀쯤)와 나란히 들어간다
  assert.ok(48 * 4 + 4 * 3 <= 476 - 260);
  // 쌓기나무: 면마다 테두리, 방향마다 다른 밝기. 쌓은 칸은 굵은 실선과 수, 빈칸은 점선. 골라 본 보기는 점선과 빗금, 짚은 줄은 굵은 점선
  assert.match(block('.sd-skin.sd-cube'), /border: 2px solid/);
  assert.notEqual(block('.sd-skin.sd-cube-top'), block('.sd-skin.sd-cube-front'));
  assert.match(block('.vw-cell'), /border: 2px dashed/);
  assert.match(block('.vw-cell.on'), /border: 4px solid/);
  assert.match(board, /cell\.textContent = value > 0 \? String\(value\) : '';/);
  assert.match(block('.vw-option.tried'), /dashed/);
  assert.match(block('.vw-option.tried'), /repeating-linear-gradient/);
  assert.match(block('.vw-mark'), /stroke-dasharray/);
  assert.match(block('.vw-view .vw-off'), /stroke-dasharray/);
  assert.match(block('.vw-option.answer'), /border: 6px solid/);
  // 맞닿은 면은 그리지 않는다(겹친 면이 깜박이지 않게)
  assert.match(solid, /if \(nz >= 0 && nz < height\(x \+ dx, y \+ dy\)\) return;/);
});

/** 끝까지 한 판의 기록 하나 */
function finished(more = {}) {
  return { kind: 'round', id: `r-${more.id ?? 1}`, format: 'views', level: 1, seed: 1, custom: false, mode: 'see', outcome: 'solved', hintsOpened: 0, answers: [{ t: 10, answer: 'pick:2', correct: true, guess: null }], wrongCount: 0, moveCount: 0, seconds: 30, solution: { possible: true, answer: 2, count: null, fewest: null, most: null }, ...more };
}

test('수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다', () => {
  const tuning = tuningFor('views');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 5);
  assert.equal(tuning.hintCount, 2);
  assert.equal(tuning.whyAfter, 'finished');
  assert.equal(tuning.fastWin, undefined);
  assert.equal(tuning.fastSolo, undefined);
  assert.match(read('src/core/level.js'), /세 방향에서 본 그림\(모두 임시\)/);
  assert.deepEqual(recommend([], 'views'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  assert.deepEqual(recommend([finished({ id: 1 }), finished({ id: 2 })], 'views'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  // 다른 보기를 골랐으면 "한 번에"가 아니다
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, wrongCount: 1 })], 'views').offerHarder, false);
  // 틀은 판을 한 번 끝까지 한 뒤에 막지 않고, 이 형식이 따로 가장 적게·가장 많이의 판을 본다
  assert.equal(whyUnlocked([], 'views'), false);
  assert.equal(whyUnlocked([finished()], 'views'), true);
  // 두 끝에 닿지 않고 그만둔 가장 적게·가장 많이의 판은 "한 번에"가 아니다
  assert.match(code, /round\.stopped = true;[\s\S]*?round\.wrongCount \+= 1;/);
});
