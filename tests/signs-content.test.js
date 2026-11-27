// 부호 넣어 수 만들기 대본 점검: 화면에 나오는 글이 약속을 지키는지, "왜 그럴까?"의 그림과 말이 다른 방법으로 따진 것과 맞는지 본다.
// 한 일과 사실만 말한다(틀렸다고 하지 않는다), 힌트는 두 높이, 규칙은 세 문장 안, 색만으로 알리지 않는다.
// 화면 코드와 틀에 이 형식이 이어져 있는지도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { LADDER, generateBoard } from '../src/core/signs-ladder.js';
import { checkBoard, evaluate } from '../src/core/signs.js';
import { fill, sentenceCount } from '../src/core/text.js';
import { bruteRow, hopOf } from './helpers/brute-signs.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/signs.json'));
const html = read('index.html');
const code = read('src/formats/signs.js');
const board = read('src/ui/signs-board.js');
const css = read('src/app.css');

const VALUES = { k: 2, f: 3, n: 5, no: '첫 ', face: '−3', total: 15 };
/** 그림과 판의 값은 글이 아니다 */
const DATA_KEYS = ['picture', 'blank', 'seed', 'numbers', 'signs', 'hop', 'dirs', 'level'];

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
const own = [part('id="signs-title"', 'id="views-title"'), part('id="signs-plus"', 'id="views-turns"'), part('id="signs-count"', 'id="views-count"'), part('id="signs-pad"', 'id="views-pad"'), part('id="make-signs"', 'id="make-views"')].map(visibleText).join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const said = strings.map(([, text]) => text).join(' ');

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 단계 목록이 사다리와 같다', () => {
  assert.equal(T.title, '부호 넣어 수 만들기');
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.deepEqual(T.levels.map((item) => item.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(T.levels.map((item) => item.name), ['5부터 1까지', '7부터 1까지', '만들 수 없는 수 모두 찾기', '제자리로 오는 메뚜기', '만들 수 없는 가장 큰 수', '직접 만들기']);
  for (const entry of T.levels.filter((item) => !item.picture.blank)) assert.equal(checkBoard(generateBoard(entry.level, entry.picture.seed).board), null);
  assert.deepEqual(Object.keys(T.home.ask).sort(), ['all', 'five', 'hop', 'largest', 'seven']);
  assert.deepEqual(Object.keys(T.hints).sort(), ['all', 'five', 'hop', 'largest', 'made', 'seven']);
});

test('한 일과 사실만 말한다. 판정하는 말, 칭찬 낱말이 없다. 되는 판의 "불가능해요"에는 되는 판이라는 사실만 말한다', () => {
  assert.doesNotMatch(said, /틀렸|틀린|아니에요|땡|정답|아쉽|실수|실패|성공|잘했|훌륭|대단|최고|멋져|멋진|완벽|축하|천재|똑똑|굉장|맞아요|맞혔/);
  assert.doesNotMatch(own, /틀렸|틀린|아니에요|땡|아쉽|실패|잘했|훌륭|대단|최고|멋/);
  assert.match(T.play['possible-press'], /^이 판은 목표 수를 만들 수 있어요\./);
  assert.match(T.play['hop-press'], /^이 판은 메뚜기가 닿을 곳에 설 수 있어요\./);
  // 되는 판은 목표 수가 나와야(닿을 곳에 서야) 끝난다. "불가능해요"로는 안 되는 판만 끝난다
  assert.match(code, /const correct = solution\.possible === false;\s*const guess = correct \? null : 'impossible-on-possible';/);
  assert.match(code, /if \(round\.board\.kind === 'row' && value === round\.board\.target\) \{/);
  assert.match(code, /if \(dirs\.length === board\.n && at === board\.target\) \{/);
  assert.equal([...code.matchAll(/frame\.finish\(/g)].length, 5);
  assert.doesNotMatch(code + board, /Math\.random/);
  // 모두 찾기에서 맞지 않게 고르면 수 하나만 짚는다: 고른 수 가운데 만들 수 있는 수가 먼저, 없으면 고르지 않은 만들 수 없는 수
  assert.match(code, /if \(extra\.length > 0\) \{\s*pointed = extra\[0\];/);
  assert.equal(fill(T.play.extra, { n: 8 }), '8도 만들 수 있는 수예요. 위의 줄에서 만들어 볼 수 있어요.');
  assert.equal(fill(T.play['extra-seen'], { n: 8 }), '아까 위의 줄에서 8에 닿은 적이 있어요. 띠에서 다시 살펴볼까요?');
  assert.equal(fill(T.play.missed, { n: 9 }), '고르지 않은 수 가운데 9도 만들 수 없어요. 띠에서 다시 살펴볼까요?');
  // 자물쇠에 넣은 수가 다르면 그 수에 대한 사실(너무 크다, 모두 +일 때의 수다, 만들 수 있다, 더 큰 안 되는 수가 있다)만 말한다
  assert.match(code, /const guess = correct \? null : value > total \? 'over' : value === total \? 'top' : reach\.has\(value\) \? 'can' : 'lower';/);
  for (const key of ['over', 'top', 'can', 'lower']) assert.match(T.play[key], /^넣은 수는 /);
  // 판 아래에는 지금 나온 수(지금 자리와 뛴 횟수), 고른 수, 도구의 수만 적는다. 무른 수나 해 본 수는 적지 않는다
  for (const line of code.split('\n')) if (/textContent/.test(line)) assert.doesNotMatch(line, /undoCount|resetCount|wrongCount|moveCount|impossibleCount|toolCount|submitCount|tryCount|landCount/, line.trim());
});

test('무르기와 처음으로 뒤에는 앞의 말을 덮는 한마디를 한다. 띠에서 짚은 수도 지운다', () => {
  assert.equal(T.play.undo, '무르기 전 모습으로 돌아왔어요.');
  assert.equal(T.play.reset, '처음 모습으로 돌아왔어요.');
  assert.match(code, /pointed = null;\s*frame\.note\('undo'\);[\s\S]*?frame\.say\(T\.play\.undo\);/);
  assert.match(code, /pointed = null;\s*frame\.note\('reset'\);[\s\S]*?frame\.say\(T\.play\.reset\);/);
});

test('규칙 설명은 세 문장 안이다. 맨 앞의 수에는 부호가 없다고 말한다. 직접 만들기의 안내 글도 세 문장 안이다', () => {
  const rules = [
    `${fill(T.rules.row, { n: 5 })} ${T.asks.row}`,
    `${fill(T.rules.row, { n: 4 })} ${fill(T.asks.all, { k: 12 })}`,
    `${fill(T.rules.row, { n: 10 })} ${T.asks.largest}`,
    `${fill(T.rules.hop, { n: 5 })} ${T.asks['hop-zero']}`,
    `${fill(T.rules.hop, { n: 4 })} ${fill(T.asks.hop, { face: '−2' })}`,
  ];
  for (const rule of rules) assert.ok(sentenceCount(rule) <= 3, rule);
  assert.equal(rules[0], '5부터 1까지 차례로 쓰고 사이에 +나 −를 넣어요. 맨 앞의 5에는 부호가 없어서 늘 +예요. 목표 수를 만들 수 있을까요?');
  assert.match(T.asks.largest, /^모두 \+일 때보다 작은 수 가운데/);
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 51);
  const mine = guides[45];
  assert.ok(sentenceCount(mine) <= 3, mine);
  assert.match(mine, /^맨 앞의 수와 목표 수를 정해요\./);
  assert.match(mine, /안 되는 목표 수를 찾을 수 있을까요\?$/);
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
      assert.doesNotMatch(hint, /때문|해야 해요|하면 돼요|늘 |\d|홀수|짝수|홀짝|두 배|바뀌지 않는 것|그대로/, hint);
    }
  }
  // 1단계에는 더 작은 판이 없는 판(3, 2, 1)이 있어서 힌트 1이 "더 작은 판"이 아니다
  assert.doesNotMatch(T.hints.five[0], /더 작은 판/);
  assert.match(code, /hints: \(round\) => T\.hints\[round\.mode\],/);
});

test('글의 빈칸({이름})은 정해진 이름만 쓰고, 채울 값이 모자라지 않는다', () => {
  const allowed = new Set(['k', 'f', 'n', 'no', 'total', 'level', 'tag', 'face']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
    assert.ok(fill(text, VALUES).length > 0, path);
  }
  assert.equal(fill(T.labels.slot, { n: 4, face: '−' }), '4 앞의 부호, 지금 −');
  assert.equal(fill(T.status.minus, { n: 4, k: 8 }), '4 앞을 −로 바꾸니 8만큼 작아졌어요');
  assert.equal(fill(T.status.left, { n: 3, k: 6 }), '3칸을 왼쪽으로 뛰니 오른쪽으로 뛸 때보다 6칸 덜 갔어요');
  assert.equal(fill(T.right['reason-parity'], { k: 15 }), '처음 줄은 모두 +인 15에서 시작했어요.');
  assert.equal(fill(T.make.big, { k: 15 }), '이 판은 목표 수를 만들 수 없어요. 모두 +로 해도 15까지만 닿아서 목표 수가 더 커요.');
  // 수 뒤에는 '에', '도', '만큼', '까지', '보다'처럼 받침과 상관없는 말만 붙인다
  for (const [path, text] of strings) assert.doesNotMatch(text, /\{(k|n|f|total|face)\}(이|가(?!지)|은|는|을|를|과|와|으로|로)/, path);
});

test('화면 글에 영어 낱말과 보상 낱말이 없고, "~요"로 끝나는 말투다. 한 문장은 60자를 넘지 않는다', () => {
  for (const [path, text] of strings) assert.doesNotMatch(text.replace(/\{[^{}]*\}/g, ''), /[A-Za-z]/, `${path}: ${text}`);
  assert.doesNotMatch(own, /[A-Za-z]/);
  assert.doesNotMatch(own, /별|점수|순위|레벨|연속/);
  const spoken = [...Object.values(T.home.ask), T.home.pick, ...Object.values(T.rules), ...Object.values(T.asks), ...Object.values(T.play), ...Object.values(T.hints).flat(), ...Object.values(T.right), T.lock.opened, ...['row', 'row-one', 'row-parity', 'row-big', 'hop', 'hop-one', 'hop-parity', 'hop-big', 'all', 'largest'].map((key) => T.solution[key]), ...['intro', 'possible', 'parity', 'big', 'start-is', 'changed', 'keep-not-yet'].map((key) => T.make[key]), ...T.why.map((slide) => slide.say)];
  for (const text of spoken) for (const sentence of sentences(text)) assert.match(sentence, /요[.?!]$/, sentence);
  for (const text of Object.values(T.status)) assert.match(text, /요$/, text);
  for (const text of [T.make.picture, T.solution.way, T.solution['hop-way'], T.solution.start, T.solution.strip, T.solution['all-plus'], T.solution['one-minus']]) assert.match(text, /요$/, text);
  for (const slide of T.why) for (const item of slide.figures) assert.match(item.note, /요$/, item.note);
  for (const [path, text] of strings) for (const sentence of sentences(fill(text, VALUES))) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

test('까닭과 이름("홀수", "짝수", "바뀌지 않는 것")은 "왜 그럴까?"에서만 말한다. 판이 끝난 뒤의 풀이 보기는 홀짝을 말해도 된다. 첫 화면 파일에는 없다', () => {
  for (const [path, text] of strings) {
    if (path.startsWith('why') || path.startsWith('solution')) continue;
    assert.doesNotMatch(text, /홀수|짝수|홀짝|바뀌지 않는 것/, `${path}: ${text}`);
  }
  assert.doesNotMatch(own, /홀수|짝수|홀짝|바뀌지 않는 것|나머지/);
  // 이름은 이야기의 넷째 장에서 처음 꺼낸다(뜻밖의 결과 → 그림 → 이름 → 그대로 통하지 않는 판)
  for (const slide of T.why.slice(0, 3)) assert.doesNotMatch(slide.say, /홀수|짝수|바뀌지 않는 것/);
  assert.match(T.why[3].say, /홀수.*짝수.*바뀌지 않는 것이라고 불러요\.$/);
});

test('"왜 그럴까?": 그림의 수가 말과 맞고, 나오지 않는다고 한 수는 다른 방법으로 따져도 나오지 않는다', () => {
  assert.equal(T.why.length, 5);
  for (const slide of T.why) assert.ok(sentenceCount(slide.say) <= 3, slide.say);
  const value = (item) => evaluate(item.numbers, [...item.signs]);
  const [first, second, third, fourth, fifth] = T.why;
  // 첫 장: 5, 4, 3, 2, 1로 나온 수가 15, 13, 9, 7이고, 8도 10도 12도 이 줄로는 아무리 해도 나오지 않는다
  assert.deepEqual(first.figures.map(value), [15, 13, 9, 7]);
  first.figures.forEach((item) => assert.match(item.note, new RegExp(`${value(item)}`)));
  assert.match(first.say, /15, 13, 9, 7이었어요\./);
  const five = bruteRow([5, 4, 3, 2, 1]);
  for (const missing of [8, 10, 12]) assert.equal(five.has(missing), false);
  // 둘째 장: 3 앞을 바꾸면 6만큼, 1 앞을 바꾸면 2만큼 작아진다
  assert.deepEqual(second.figures.map(value), [15, 9, 13]);
  assert.match(second.figures[1].note, /^3 앞을 바꾸니 6만큼 작아졌어요$/);
  assert.match(second.figures[2].note, /^1 앞을 바꾸니 2만큼 작아졌어요$/);
  // 셋째 장: 메뚜기 1칸~5칸. 모두 오른쪽이면 15, 4칸을 왼쪽으로 뛰면 8칸 덜 가서 7, 0에는 닿지 않고 바로 옆(−1)에서 멈춘다
  const hop = (item) => item.dirs.reduce((sum, dir, index) => sum + dir * (index + 1), 0);
  assert.ok(third.figures.every((item) => item.hop === 5 && item.dirs.length === 5));
  assert.deepEqual(third.figures.map(hop), [15, 7, -1]);
  assert.equal(hopOf(5).has(0), false);
  // 넷째 장: 4, 3, 2, 1은 모두 +일 때 10이라 나오는 수가 10, 8, 4처럼 모두 짝수다
  assert.deepEqual(fourth.figures.map(value), [10, 8, 4]);
  for (const result of bruteRow([4, 3, 2, 1]).keys()) assert.equal(Math.abs(result) % 2, 0);
  // 다섯째 장: 1, 2, 3, 4, 5 차례로 쓰면(1 앞에는 부호가 없다) 13은 홀수인데도 나오지 않는다. 2 앞을 바꾸면 11
  assert.deepEqual(fifth.figures.map(value), [15, 11]);
  const up = bruteRow([1, 2, 3, 4, 5]);
  assert.equal(up.has(13), false);
  assert.equal(up.has(11), true);
  assert.match(fifth.say, /13은 홀수인데도 만들 수 없어요\./);
  assert.match(code, /if \(item\.hop\) return lineCard\(\{ n: item\.hop, target: 0, dirs: item\.dirs \}, item\.note\);/);
});

test('풀이와 직접 만들기: 되면 방법의 수와 한 가지 방법, 안 되면 크기나 처음 줄의 수를 말한다', () => {
  assert.equal(fill(T.make.possible, { k: 2 }), '이 판은 목표 수를 만들 수 있어요. 방법은 모두 2가지이고, 그 가운데 하나를 보여 줄게요.');
  assert.equal(fill(T.make.parity, { k: 15 }), '이 판은 목표 수를 만들 수 없어요. 줄은 모두 +인 15에서 시작하고, 부호를 바꿀 때마다 그 수의 두 배만큼 바뀌어요.');
  assert.match(code, /else made = \{ line: fill\(T\.make\[result\.reason === 'big' \? 'big' : 'parity'\], \{ k: total \}\), node: null \};/);
  // 모두 +인 처음 줄이 벌써 목표 수이면 해 볼 것이 없다
  assert.match(code, /if \(!draft \|\| checkBoard\(draft\) !== null \|\| draft\.target === totalOf\(draft\.n\)\) return null;/);
  // 따져 준 뒤에 판을 고치면 앞의 판에 한 말을 덮는다
  assert.match(code, /if \(said\) frame\.talkers\.make\.say\(T\.make\.changed\);/);
  const make = part('id="make-signs"', 'id="make-views"');
  for (const id of ['signs-make-n-fewer', 'signs-make-n', 'signs-make-n-more', 'signs-make-target-fewer', 'signs-make-target', 'signs-make-target-more', 'signs-make-board', 'signs-make-goal', 'signs-make-solve', 'signs-make-result', 'signs-make-play', 'signs-make-picture']) {
    assert.ok(make.includes(`id="${id}"`), id);
  }
  assert.match(make, /id="signs-make-solve"[^>]*>선생님, 풀어 보세요</);
  assert.match(make, /id="signs-make-play"[^>]*>내가 해 볼래요</);
  assert.match(code, /mode: custom \? 'made' : rungOf\(level\)\.mode,/);
  assert.match(code, /\n {4}madeBoard,\n/);
  assert.doesNotMatch(code, /bestOf/);
});

test('index.html: 이 형식의 카드, 판, 판 아래, 오른쪽 칸, 도구, 직접 만들기가 있다. 틀에 이어져 있다', () => {
  for (const id of ['home-signs-sample', 'home-signs-ask', 'home-signs-play', 'home-signs-pick', 'home-signs-make', 'home-signs-blank', 'signs-board', 'signs-count', 'signs-status', 'signs-value', 'signs-pos', 'signs-jumps', 'signs-marked', 'signs-tool-line', 'signs-total', 'signs-pad', 'signs-target', 'signs-submit', 'signs-left', 'signs-right', 'signs-jump', 'signs-lock', 'signs-keys', 'signs-open', 'signs-maybe', 'signs-impossible', 'signs-plus', 'make-signs']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(part('id="signs-title"', '</section>'), /<h2 id="signs-title">부호 넣어 수 만들기<\/h2>/);
  assert.ok(visibleText(part('id="signs-title"', '</section>')).includes(T.home.ask.five));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-signs-make" class="menu-item"/);
  assert.match(part('id="signs-pad"', 'id="views-pad"'), /id="signs-impossible"[^>]*>불가능해요</);
  assert.match(part('id="signs-pad"', 'id="views-pad"'), /id="signs-submit"[^>]*>다 골랐어요</);
  assert.match(part('id="signs-plus"', 'id="views-turns"'), /aria-pressed="false" hidden>모두 \+일 때 보기</);
  assert.equal(T.tool.off, '모두 +일 때 보기');
  // 메뚜기 판에서는 같은 도구를 다른 이름으로 부른다(부호가 아니라 뛰는 쪽이다)
  assert.equal(T.tool['off-hop'], '모두 오른쪽일 때 보기');
  // 카드는 손가락 더하기 다음, 퍼즐 만들기 앞이다
  assert.ok(html.indexOf('id="fingers-title"') < html.indexOf('id="signs-title"'));
  assert.ok(html.indexOf('id="signs-title"') < html.indexOf('id="make-title"'));
  // 틀이 형식을 안다(손가락 더하기 다음)
  assert.match(read('src/main.js'), /fingers: createFingers\(frame\), signs: createSigns\(frame\), /);
  assert.match(read('src/check-main.js'), /\['signs', '부호 넣어 수 만들기'\]/);
  assert.match(read('src/core/smaller.js'), /fingers: smallerFingers, signs: smallerSigns, /);
  assert.match(code, /smaller: \(round, turn\) => smallerSigns\(\{ mode: round\.mode, board: round\.board \}, turn\),/);
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
  assert.match(code, /\$\('undo'\)\.hidden = false;\s*\$\('reset'\)\.hidden = false;/);
  // 타이머와 움직이는 그림이 없다
  assert.doesNotMatch(board + code, /setInterval|setTimeout|requestAnimationFrame/);
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(plain.slice(plain.indexOf('.sg-board {'), plain.indexOf('.board-area > #views-board')), /animation|transition/);
  // 도구를 처음 켜면 힌트 하나로 센다
  assert.match(code, /hintsOpened: round\.hintsOpened \+ \(round\.toolShown \? 1 : 0\),/);
});

test('화면: 누르는 자리(부호 칸, 띠의 칸, 뛰는 단추)가 44픽셀보다 크다. − 부호, 고른 수, 나온 수, 왼쪽 뜀은 색만이 아니라 모양으로도 보인다', () => {
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const block = (selector) => plain.match(new RegExp(`\\n${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`))[1];
  assert.match(block('.sg-slot'), /width: 52px;/);
  assert.match(block('.sg-slot'), /min-height: 64px;/);
  assert.match(block('.sg-cell'), /min-height: 56px;/);
  // 띠는 한 줄에 여덟 칸이고, 판 칸의 가로가 1180×820 화면에서 476픽셀쯤이라 한 칸이 가로 54픽셀쯤이다
  assert.match(board, /export const STRIP_COLS = 8;/);
  assert.ok((476 - 7 * 6) / 8 >= 44);
  assert.match(block('.sg-strip'), /grid-template-columns: repeat\(var\(--cols\), minmax\(0, 60px\)\);/);
  // 줄은 덩이(부호 칸과 수)째로 넘어가서, 가장 긴 줄(10부터 1까지)도 부호 칸이 줄어들지 않는다
  assert.match(block('.sg-row'), /flex-wrap: wrap;/);
  assert.match(block('.sg-slot.minus'), /border: 4px solid/);
  assert.match(block('.sg-cell.marked'), /border: 4px solid/);
  assert.match(block('.sg-cell.pointed'), /outline: 4px dashed/);
  assert.match(block('.sg-hop.left'), /stroke-dasharray/);
  assert.match(board, /cell\.append\(el\('span', 'sg-dot'\)\)/);
  assert.match(block('.sg-hop-keys'), /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
});

/** 끝까지 한 판의 기록 하나 */
function finished(more = {}) {
  return { kind: 'round', id: `r-${more.id ?? 1}`, format: 'signs', level: 1, seed: 1, custom: false, mode: 'five', outcome: 'solved', hintsOpened: 0, answers: [{ t: 10, answer: 'done', correct: true, guess: null }], wrongCount: 0, moveCount: 1, seconds: 30, solution: { possible: true, total: 10, ways: 1, reason: null }, ...more };
}

test('수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다. "왜 그럴까?"는 안 되는 판을 한 번 끝까지 만난 뒤에 열린다', () => {
  const tuning = tuningFor('signs');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 5);
  assert.equal(tuning.hintCount, 2);
  assert.equal(tuning.whyAfter, undefined);
  assert.equal(tuning.fastWin, undefined);
  assert.equal(tuning.fastSolo, undefined);
  assert.match(read('src/core/level.js'), /부호 넣어 수 만들기\(모두 임시\)/);
  assert.deepEqual(recommend([], 'signs'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  assert.deepEqual(recommend([finished({ id: 1 }), finished({ id: 2 })], 'signs'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  // 되는 판에 "불가능해요"를 눌렀으면 "한 번에"가 아니다
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, wrongCount: 1 })], 'signs').offerHarder, false);
  assert.equal(whyUnlocked([finished()], 'signs'), false);
  const met = finished({ id: 3, seed: 3, answers: [{ t: 10, answer: 'impossible', correct: true, guess: null }], solution: { possible: false, total: 6, ways: 0, reason: 'parity' } });
  assert.equal(whyUnlocked([met], 'signs'), true);
  assert.equal(whyUnlocked([{ ...met, side: true }], 'signs'), false);
  // 모두 찾기와 가장 큰 수의 판도 안 되는 판으로 적는다(끝까지 하면 "왜 그럴까?"가 열린다)
  assert.match(read('src/core/signs.js'), /return \{ possible: false, total, impossible:/);
  assert.match(code, /round\.wrongCount \+= 1;/);
  assert.match(code, /solution: \{ possible: solution\.possible, total: solution\.total,/);
});
