// 숫자 넷으로 수 만들기 대본 점검: 화면에 나오는 글이 약속을 지키는지, "왜 그럴까?"의 그림과 말이 다른 방법으로 센 것과 맞는지 본다.
// 한 일과 사실만 말한다(틀렸다고 하지 않는다), 힌트는 두 높이, 규칙은 세 문장 안, 색만으로 알리지 않는다, 이름("식", "괄호", 곱하기와 나누기를 먼저 하는 약속)은 "왜 그럴까?"에서만.
// 화면 코드와 틀에 이 형식이 이어져 있는지도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { LADDER, generateBoard } from '../src/core/fourdigits-ladder.js';
import { checkBoard, entryOf, exprText, orderCount, replaySteps, valueKey } from '../src/core/fourdigits.js';
import { fill, sentenceCount } from '../src/core/text.js';
import { bruteOrderCount, bruteReach } from './helpers/brute-fourdigits.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/fourdigits.json'));
const html = read('index.html');
const code = read('src/formats/fourdigits.js');
const board = read('src/ui/fourdigits-board.js');
const css = read('src/app.css');

const VALUES = { k: 3, f: 2, n: 5, no: '첫 ', face: '말', total: 9 };
const MODES = ['three', 'four', 'run', 'same', 'fraction', 'made'];
/** 그림과 판의 값은 글이 아니다 */
const DATA_KEYS = ['picture', 'blank', 'seed', 'digits', 'steps', 'strip', 'top', 'level', 'faces'];

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
const own = [part('id="fourdigits-title"', 'id="yesno-title"'), part('id="fourdigits-board"', 'id="yesno-board"'), part('id="fourdigits-count"', 'id="yesno-count"'), part('id="fourdigits-pad"', 'id="yesno-pad"'), part('id="make-fourdigits"', 'id="make-yesno"')].map(visibleText).join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const said = strings.map(([, text]) => text).join(' ');
const faces = T.faces;

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 단계 목록이 사다리와 같다', () => {
  assert.equal(T.title, '숫자 넷으로 수 만들기');
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.deepEqual(T.levels.map((item) => item.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(T.levels.map((item) => item.name), ['숫자 셋으로', '숫자 넷으로', '1부터 차례로', '네 개의 같은 숫자', '까다로운 목표 수', '직접 만들기']);
  for (const entry of T.levels.filter((item) => !item.picture.blank)) assert.equal(checkBoard(generateBoard(entry.level, entry.picture.seed).board), null);
  assert.deepEqual(Object.keys(T.home.ask).sort(), ['four', 'fraction', 'run', 'same', 'three']);
  assert.deepEqual(Object.keys(T.hints).sort(), [...MODES].sort());
  assert.deepEqual(Object.keys(T.rules).sort(), [...MODES].sort());
  assert.deepEqual(T.faces, { '+': '+', '-': '−', '*': '×', '/': '÷' });
  assert.deepEqual(Object.keys(T.labels.op), ['+', '-', '*', '/']);
});

test('한 일과 사실만 말한다. 판정하는 말, 칭찬 낱말이 없다. 틀린 답을 받는 단추가 없다', () => {
  assert.doesNotMatch(said, /틀렸|틀린|아니에요|땡|정답|아쉽|실수|실패|성공|잘했|훌륭|대단|최고|멋져|멋진|완벽|축하|천재|똑똑|굉장|맞아요|맞혔/);
  assert.doesNotMatch(own, /틀렸|틀린|아니에요|땡|아쉽|실패|잘했|훌륭|대단|최고|멋|불가능해요/);
  // 끝나는 곳은 셋뿐이다: 목표 수를 모두 만들었을 때, 1부터 처음 막히는 수 앞까지 이었을 때, "여기까지 할래요"
  assert.equal([...code.matchAll(/frame\.finish\(/g)].length, 3);
  assert.match(code, /if \(board\.targets\.every\(\(target\) => madeNumbers\(round\)\.includes\(target\)\)\) \{\s*flash = null;\s*frame\.finish\('solved'\);/);
  assert.match(code, /if \(runOf\(madeNumbers\(round\)\) === solution\.best\) \{\s*flash = null;\s*frame\.finish\('solved'\);/);
  assert.doesNotMatch(code + board, /Math\.random/);
  // 판 아래에는 할 일이나 사실 한 줄과 남은 카드의 수만 적는다. 무른 수나 누른 수는 적지 않는다
  for (const line of code.split('\n')) if (/textContent/.test(line)) assert.doesNotMatch(line, /undoCount|resetCount|wrongCount|combineCount|refuseCount|endCount/, line.trim());
  // 셈할 수 없는 합치기(작은 수에서 큰 수 빼기, 0으로 나누기)는 그 사실만 적고 고른 것은 그대로 둔다
  assert.match(code, /const reason = refusal\(cards\[picked\]\.value, op, cards\[at\]\.value\);\s*if \(reason\) \{/);
  assert.equal(T.status.minus, '작은 수에서 큰 수는 빼지 않아요');
});

test('1부터 차례로: 열린 수 둘, 기록은 1부터 몇까지 차례로 만들었는가. 끝까지 이으면 "더 이어 갈 수 없어요"를 사실로 말한다', () => {
  assert.equal(fill(T.right.run, { k: 28 }), '1부터 28까지 차례로 만들었어요.');
  assert.equal(fill(T.right['run-none'], { f: 3888, n: 29 }), '선생님이 합치는 차례 3888가지를 모두 해 보았는데, 29에는 한 번도 닿지 않았어요.');
  assert.equal(T.right['run-end'], '그래서 1부터는 이보다 더 이어 갈 수 없어요.');
  // 그만두었을 때는 다음 수도 만들 수 있다는 사실만 말한다(처음 막히는 수 앞이라 늘 사실이다)
  assert.equal(fill(T.right['run-more'], { n: 7 }), '7도 이 숫자들로 만들 수 있는 수예요.');
  assert.match(code, /return \[run === 0 \? T\.right\['stopped-none'\] : fill\(T\.right\.run, \{ k: run \}\), fill\(T\.right\['run-more'\], \{ n: run \+ 1 \}\)\];/);
  // 열린 판 둘: 띠는 아직 만들지 않은 가장 작은 수 둘을 점선으로 연다
  assert.match(code, /open: round\.done \? \[\] : open,/);
  assert.match(part('id="fourdigits-pad"', 'id="yesno-pad"'), /점선 칸 둘이 지금 열린 수예요\./);
  assert.match(part('id="fourdigits-pad"', 'id="yesno-pad"'), /id="fourdigits-stop"[^>]*>여기까지 할래요</);
  assert.match(part('id="fourdigits-pad"', 'id="yesno-pad"'), /1부터 <strong id="fourdigits-run">0<\/strong>까지 차례로 만들었어요/);
  // 가장 좋은 기록은 공책에 저절로 남는다(값은 이은 끝 수 그대로)
  assert.equal(fill(T.notebook.best, { k: 9 }), '1부터 9까지 차례로 만든 판');
  assert.match(code, /return run === 0 \? null : \{ value: run, name: fill\(T\.notebook\.best, \{ k: run \}\) \};/);
  // "여기까지 할래요"로 끝내면 수준 맞추기에서 "한 번에"가 아니다
  assert.match(code, /round\.stopped = true;\s*\/\/[^\n]*\n\s*round\.wrongCount \+= 1;/);
});

test('무르기와 처음으로 뒤에는 앞의 말을 덮는 한마디를 한다', () => {
  assert.equal(T.play.undo, '무르기 전 모습으로 돌아왔어요.');
  assert.equal(T.play.reset, '처음 모습으로 돌아왔어요.');
  assert.match(code, /frame\.note\('undo'\);[\s\S]*?frame\.say\(T\.play\.undo\);/);
  assert.match(code, /frame\.note\('reset'\);[\s\S]*?frame\.say\(T\.play\.reset\);/);
});

test('규칙 설명은 세 문장 안이다. 직접 만들기의 안내 글도 세 문장 안이다', () => {
  for (const [key, rule] of Object.entries(T.rules)) {
    assert.ok(sentenceCount(rule) <= 3, key);
    assert.match(rule, /^카드 하나, 셈 기호, 다른 카드를 차례로 누르면 두 카드가 셈한 값의 카드 한 장으로 합쳐져요\. 카드가 한 장 남을 때까지 합쳐요\./, key);
    assert.match(rule, /모두 써서 .+ 수 있을까요\?$/, key);
  }
  for (const key of ['run', 'same', 'made']) assert.match(T.rules[key], /1부터 차례로 어디까지/);
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 50);
  const mine = guides[48];
  assert.ok(sentenceCount(mine) <= 3, mine);
  assert.match(mine, /^숫자 카드 넷을 골라요\./);
  assert.match(mine, /1부터 가장 멀리 가는 숫자 넷을 찾을 수 있을까요\?$/);
});

test('힌트는 판의 종류마다 두 개이고, 하나하나가 질문 한 문장이다. 힌트 1은 함께 쓰는 목록에서 고른다. 이름과 요령은 힌트에 없다', () => {
  const common = ['끝에는 어떤 모양이 되어야 하나요?', '끝나기 바로 전에는 어떤 모양일까요?', '더 작은 판이라면 할 수 있을까요?', '전에 해 본 판 가운데 닮은 판이 있었나요?', '규칙 하나가 없다면 어디까지 되나요?', '아직 한 번도 건드리지 않은 곳이 있나요?', '아까와 다른 곳에서 시작하면 어떻게 되나요?'];
  for (const [key, list] of Object.entries(T.hints)) {
    assert.equal(list.length, 2, key);
    assert.notEqual(list[0], list[1]);
    assert.ok(common.includes(list[0]), list[0]);
    for (const hint of list) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
      assert.doesNotMatch(hint, /괄호|식이라|약속|분수|\d|[+−×÷]/, hint);
    }
  }
  assert.match(code, /hints: \(round\) => T\.hints\[ruleKey\(round\)\],/);
  assert.match(code, /ruleLine: \(round\) => T\.rules\[ruleKey\(round\)\],/);
});

test('글의 빈칸({이름})은 정해진 이름만 쓰고, 채울 값이 모자라지 않는다', () => {
  const allowed = new Set(['k', 'f', 'n', 'no', 'total', 'level', 'tag', 'face']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
    assert.ok(fill(text, VALUES).length > 0, path);
  }
  // 수 뒤에는 받침과 상관없는 말만 붙인다
  for (const [path, text] of strings) assert.doesNotMatch(text, /\{(k|n|f|total|no)\}(이|가(?!지)|은|는|을|를|과|와|으로|로)/, path);
  assert.equal(fill(T.labels.fraction, { n: 4, k: 3 }), '4분의 3');
  assert.equal(fill(T.status['strip-made'], { n: 7 }), '7, 띠에 적었어요');
  // 판 아래의 한 줄은 한 줄에 들어간다(판 칸의 가로 480픽셀쯤, 18픽셀 글자로 스무 자 안쪽)
  for (const [key, text] of Object.entries(T.status)) assert.ok([...fill(text, { n: 48, k: 60 })].length <= 20, key);
});

test('화면 글에 영어 낱말과 보상 낱말이 없고, "~요"로 끝나는 말투다. 한 문장은 60자를 넘지 않는다', () => {
  for (const [path, text] of strings) assert.doesNotMatch(text.replace(/\{[^{}]*\}/g, ''), /[A-Za-z]/, `${path}: ${text}`);
  assert.doesNotMatch(own, /[A-Za-z]/);
  assert.doesNotMatch(own, /별|점수|순위|레벨|연속|시간|초/);
  const spoken = [...Object.values(T.home.ask), T.home.pick, ...Object.values(T.rules), ...Object.values(T.play), ...Object.values(T.hints).flat(), ...Object.values(T.right), ...['target', 'fraction', 'run'].map((key) => T.solution[key]), ...['intro', 'result', 'none', 'fraction-some', 'fraction-none', 'farthest', 'changed', 'keep-not-yet'].map((key) => T.make[key]), ...T.why.map((slide) => slide.say)];
  for (const text of spoken) for (const sentence of sentences(text)) assert.match(sentence, /요[.?!]$/, sentence);
  for (const text of Object.values(T.status)) assert.match(text, /요$/, text);
  for (const text of [T.solution.start, T.solution.step, T.solution.way, T.solution.strip, T.make.picture]) assert.match(text, /요$/, text);
  for (const slide of T.why) for (const item of slide.figures) assert.match(item.note, /요$/, item.note);
  for (const [path, text] of strings) for (const sentence of sentences(fill(text, VALUES))) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

test('이름("식", "괄호")과 곱하기·나누기를 먼저 하는 약속은 "왜 그럴까?"의 마지막 장에서만 말한다', () => {
  for (const [path, text] of strings) {
    if (path.startsWith('why[4]')) continue;
    assert.doesNotMatch(text, /괄호|식이라고|약속/, `${path}: ${text}`);
  }
  assert.doesNotMatch(own, /괄호|약속/);
  assert.match(T.why[4].say, /식이라고 해요\./);
  assert.match(T.why[4].say, /괄호라고 불러요\./);
  assert.match(T.why[4].say, /먼저 하기로 약속하면/);
  // 화면의 카드는 약속 없이 읽을 수 있게 먼저 합친 두 카드마다 괄호로 묶는다
  assert.match(board, /export const cardText = \(tree, faces\) => exprText\(tree, faces, \{ full: true \}\);/);
  // 3888을 세는 까닭(두 장 고르기와 셈 여섯 가지)은 "왜 그럴까?"에서만 말한다
  for (const [path, text] of strings) if (!path.startsWith('why')) assert.doesNotMatch(text, /6가지|두 장을 고르는/, path);
});

test('"왜 그럴까?": 그림의 카드, 값, 띠, 세는 수가 말과 맞고, 다른 방법으로 따져도 같다', () => {
  assert.equal(T.why.length, 5);
  for (const slide of T.why) assert.ok(sentenceCount(slide.say) <= 3, slide.say);
  const cardsOf = (item) => {
    const replayed = replaySteps(item.digits, item.steps);
    assert.ok(replayed.ok, item.steps.join(' '));
    return replayed.cards;
  };
  const brute1234 = bruteReach([1, 2, 3, 4], 40);
  // 첫 장: 1, 2, 3, 4로 28과 30. 29는 없다
  const [first28, first30] = T.why[0].figures.map(cardsOf);
  assert.deepEqual(first28.map((card) => card.value), [[28, 1]]);
  assert.deepEqual(first30.map((card) => card.value), [[30, 1]]);
  assert.equal(T.why[0].figures[0].note, '28이 나왔어요');
  assert.equal(T.why[0].figures[1].note, '30이 나왔어요');
  for (let n = 1; n <= 28; n++) assert.ok(brute1234.all.has(n), `${n}`);
  assert.ok(!brute1234.all.has(29) && brute1234.all.has(30));
  // 둘째 장: 카드 넷 → 셋 → 둘 → 하나, 고르는 두 장은 6, 3, 1가지, 셈은 6가지. 모두 3888가지(늘어놓아 다시 센다)
  const second = T.why[1].figures;
  assert.deepEqual(second.map((item) => cardsOf(item).length), [4, 3, 2, 1]);
  assert.deepEqual(second.slice(1).map((item) => Number(item.note.match(/두 장 (\d)가지/)[1])), [6, 3, 1]);
  for (const item of second.slice(1)) assert.match(item.note, /셈 6가지예요$/);
  assert.equal(6 * 6 * 3 * 6 * 1 * 6, 3888);
  assert.equal(bruteOrderCount(4), 3888);
  assert.equal(orderCount(4), 3888);
  assert.match(T.why[1].say, /모두 3888가지예요\.$/);
  // 셋째 장: 1부터 40까지의 띠에서 만들 수 없는 수는 9개(29, 31, 33, 34, 35, 37, 38, 39, 40)
  const strip = T.why[2].figures[0];
  assert.deepEqual(strip.strip, [1, 2, 3, 4]);
  const none = Array.from({ length: strip.top }, (_, index) => index + 1).filter((n) => !brute1234.all.has(n));
  assert.deepEqual(none, [29, 31, 33, 34, 35, 37, 38, 39, 40]);
  assert.equal(strip.note, `1부터 ${strip.top}까지에서 굵은 테두리는 ${none.length}개예요`);
  // 넷째 장: 1, 3, 4, 6으로 3÷4 → 1−3/4 → 6÷1/4 = 24. 3888가지 가운데 이 차례 하나뿐이고 분수를 거쳐야만 나온다
  const fourth = T.why[3].figures.map(cardsOf);
  assert.deepEqual(fourth.map((cards) => cards.map((card) => valueKey(card.value))), [['1/1', '3/4', '6/1'], ['1/4', '6/1'], ['24/1']]);
  assert.equal(entryOf([1, 3, 4, 6], 24).ways, 1);
  const brute1346 = bruteReach([1, 3, 4, 6], 30);
  assert.ok(brute1346.all.has(24) && !brute1346.plain.has(24));
  assert.match(T.why[3].figures[2].note, /^3888가지 가운데 24는 이 차례 하나뿐이에요$/);
  // 다섯째 장: 카드에 적힌 식과 약속으로 줄인 식이 말과 같다
  const named = cardsOf(T.why[4].figures[0])[0].tree;
  assert.ok(T.why[4].say.includes(exprText(named, faces, { full: true })));
  assert.ok(T.why[4].say.includes(exprText(named, faces)));
  assert.equal(T.why[4].figures[1].note, `${exprText(cardsOf(T.why[4].figures[1])[0].tree, faces, { full: true })}이에요`);
  // "왜 그럴까?"는 틀의 기본 문(1부터 차례로 하는 판을 한 번 끝까지 한 뒤)에 열린다
  assert.equal(tuningFor('fourdigits').whyAfter, undefined);
});

test('끝났을 때와 풀이, 직접 만들기의 말: 차례의 수와 분수를 거쳐야만 나온다는 것은 풀이 프로그램이 센 그대로다', () => {
  assert.equal(fill(T.right.ways, { f: 3888, k: 4 }), '선생님이 합치는 차례 3888가지를 모두 해 보니, 이 목표 수가 나오는 것은 4가지예요.');
  assert.equal(fill(T.right['ways-one'], { f: 3888 }), '선생님이 합치는 차례 3888가지를 모두 해 보니, 이 목표 수가 나오는 것은 하나뿐이에요.');
  assert.match(code, /if \(entry\.plain === 0\) parts\.push\(T\.right\.fraction\);/);
  assert.equal(fill(T.make.result, { k: 28, n: 29 }), '1부터 28까지 차례로 만들 수 있어요. 29에는 아무리 해도 닿지 않아요.');
  assert.equal(fill(T.make['fraction-some'], { f: 2 }), '그 가운데 2개는 분수를 거쳐야만 나와요.');
  assert.match(T.make.farthest, /495가지 가운데 1부터 가장 멀리/);
  assert.match(code, /if \(best === FARTHEST\.best\) line = `\$\{line\} \$\{T\.make\.farthest\}`;/);
  assert.equal(fill(T.solution.run, { k: 9, n: 10 }), '1부터 9까지 수마다 한 가지 식이에요. 10에는 어떤 차례로도 닿지 않아요.');
  const make = part('id="make-fourdigits"', 'id="make-yesno"');
  for (const id of ['fourdigits-make-board', 'fourdigits-make-solve', 'fourdigits-make-result', 'fourdigits-make-play', 'fourdigits-make-picture', ...[0, 1, 2, 3].flatMap((at) => [`fourdigits-make-fewer-${at}`, `fourdigits-make-d${at}`, `fourdigits-make-more-${at}`])]) assert.ok(make.includes(`id="${id}"`), id);
  assert.match(make, /id="fourdigits-make-solve"[^>]*>선생님, 풀어 보세요</);
  assert.match(make, /id="fourdigits-make-play"[^>]*>내가 해 볼래요</);
  assert.match(code, /mode: custom \? 'made' : rungOf\(level\)\.mode,/);
  assert.match(code, /\n {4}madeBoard,\n/);
});

test('index.html: 이 형식의 카드, 판, 판 아래, 오른쪽 칸, 직접 만들기가 있다. 틀에 이어져 있다', () => {
  for (const id of ['home-fourdigits-sample', 'home-fourdigits-ask', 'home-fourdigits-play', 'home-fourdigits-pick', 'home-fourdigits-make', 'home-fourdigits-blank', 'fourdigits-board', 'fourdigits-count', 'fourdigits-status', 'fourdigits-left', 'fourdigits-pad', 'fourdigits-target-box', 'fourdigits-targets', 'fourdigits-run-box', 'fourdigits-run', 'fourdigits-list', 'fourdigits-stop', 'make-fourdigits']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(part('id="fourdigits-title"', '</section>'), /<h2 id="fourdigits-title">숫자 넷으로 수 만들기<\/h2>/);
  assert.ok(visibleText(part('id="fourdigits-title"', '</section>')).includes(T.home.ask.three));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-fourdigits-make" class="menu-item"/);
  assert.match(part('id="fourdigits-count"', 'id="yesno-count"'), />남은 카드 <strong id="fourdigits-left">/);
  // 셈 기호의 이름(더하기, 곱하기 같은 말)은 화면 파일에 적지 않고 대본에서 받는다
  assert.doesNotMatch(own, /더하기|빼기|곱하기|나누기/);
  // 카드는 번호 말 제자리 찾기 다음, 퍼즐 만들기 앞이다
  assert.ok(html.indexOf('id="slide-title"') < html.indexOf('id="fourdigits-title"'));
  assert.ok(html.indexOf('id="fourdigits-title"') < html.indexOf('id="make-title"'));
  // 틀이 형식을 안다(번호 말 제자리 찾기 다음)
  assert.match(read('src/main.js'), /slide: createSlide\(frame\), fourdigits: createFourdigits\(frame\), /);
  assert.match(read('src/check-main.js'), /\['fourdigits', '숫자 넷으로 수 만들기'\]/);
  assert.match(read('src/core/smaller.js'), /slide: smallerSlide, fourdigits: smallerFourdigits, /);
  assert.match(code, /smaller: \(round, turn\) => smallerFourdigits\(\{ mode: round\.mode, board: round\.board \}, turn\),/);
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
  assert.match(code, /\$\('undo'\)\.hidden = false;\s*\$\('reset'\)\.hidden = false;/);
  // 시계와 스스로 넘어가는 것이 없다
  assert.doesNotMatch(board + code, /setInterval|setTimeout|requestAnimationFrame/);
});

test('화면: 카드와 기호 단추는 44픽셀보다 크고, 고른 카드와 기호, 만든 칸, 열린 칸, 만들 수 없는 칸은 색만이 아니라 모양으로도 보인다', () => {
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const block = (selector) => plain.match(new RegExp(`\\n${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`))[1];
  assert.match(block('.nf-card'), /min-width: 96px;/);
  assert.match(block('.nf-card'), /min-height: 104px;/);
  // 판 칸(가로 480픽셀쯤)에 카드 넷이 한 줄에 들어간다
  assert.ok(4 * 96 + 3 * 12 <= 480);
  assert.match(block('.nf-op'), /width: 64px;\s*height: 64px;/);
  // 띠의 칸은 누르는 칸이 아니다. 가로 44픽셀, 세로 36픽셀이라 여섯 줄(60까지)도 카드와 기호와 함께 판 칸에 들어간다
  assert.match(block('.nf-cell'), /min-height: 36px;/);
  assert.match(code, /ruleAside: true,/);
  assert.match(block('.nf-strip'), /minmax\(0, 44px\)/);
  assert.ok(10 * 44 + 9 * 4 <= 480);
  // 고른 카드: 굵은 점선 테두리와 들린 모습. 고른 기호: 굵은 테두리와 빗금. 만든 칸: 가는 테두리와 점, 열린 칸: 굵은 점선, 만들 수 없는 칸: 굵은 테두리와 빗금
  assert.match(block('.nf-card.picked'), /border: 5px dashed/);
  assert.match(block('.nf-card.picked'), /transform: translateY\(-10px\);/);
  assert.match(block('.nf-op.picked'), /border-width: 6px;[\s\S]*repeating-linear-gradient/);
  assert.match(block('.nf-cell.made'), /border: 2px solid/);
  assert.ok(board.includes("if (kind === 'made') cell.append(el('span', 'nf-dot'));"));
  assert.match(block('.nf-cell.open'), /border: 4px dashed/);
  assert.match(block('.nf-cell.none'), /border: 4px solid[\s\S]*repeating-linear-gradient/);
  assert.match(block('.nf-target'), /border: 3px dashed/);
  assert.match(block('.nf-target.made'), /border: 4px solid/);
  assert.match(board, /aria-pressed/);
});

/** 끝까지 한 판의 기록 하나 */
function finished(more = {}) {
  return { kind: 'round', id: `r-${more.id ?? 1}`, format: 'fourdigits', level: 1, seed: 1, custom: false, mode: 'three', outcome: 'solved', hintsOpened: 0, answers: [{ t: 10, answer: 'made:10', correct: true, guess: null }], wrongCount: 0, combineCount: 2, seconds: 30, solution: { possible: true, orders: 108 }, ...more };
}

test('수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다. "왜 그럴까?"는 1부터 차례로 하는 판을 한 번 끝까지 한 뒤에 열린다', () => {
  const tuning = tuningFor('fourdigits');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 5);
  assert.equal(tuning.hintCount, 2);
  assert.equal(tuning.whyAfter, undefined);
  assert.equal(tuning.fastWin, undefined);
  assert.equal(tuning.fastSolo, undefined);
  assert.match(read('src/core/level.js'), /숫자 넷으로 수 만들기\(모두 임시\)/);
  assert.deepEqual(recommend([], 'fourdigits'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  assert.deepEqual(recommend([finished({ id: 1 }), finished({ id: 2 })], 'fourdigits'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  // 1부터 차례로 하는 판을 "여기까지 할래요"로 끝내면 "한 번에"가 아니다
  const run = (more) => finished({ level: 3, mode: 'run', solution: { possible: false, orders: 3888, best: 10, missing: 11 }, ...more });
  assert.equal(recommend([run({ id: 1 }), run({ id: 2, wrongCount: 1, stopped: true })], 'fourdigits').offerHarder, false);
  assert.equal(whyUnlocked([finished()], 'fourdigits'), false);
  assert.equal(whyUnlocked([run({ id: 3 })], 'fourdigits'), true);
  assert.equal(whyUnlocked([{ ...run({ id: 3 }), side: true }], 'fourdigits'), false);
  assert.match(code, /solution: \{ possible: solution\.possible, orders: solution\.orders,/);
});
