// 눈금이 가장 적은 자 대본 점검: 화면에 나오는 글이 약속을 지키는지, 선생님이 하는 말과 "왜 그럴까?"의 수가 풀이 프로그램과
// 다른 방법(tests/helpers/brute-ruler.js)으로 따진 것과 맞는지 본다. 한 일과 사실만 말한다(틀렸다고 하지 않는다), 힌트는 두 높이,
// 규칙은 세 문장 안, 색만으로 알리지 않는다, 이름(골롬 자)과 짝의 수의 식은 "왜 그럴까?"의 마지막 장에서만. 화면 코드와 틀에 이어져 있는지도 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { LADDER, generateBoard } from '../src/core/ruler-ladder.js';
import { pairCount, placements, solveLength } from '../src/core/ruler.js';
import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { endsClosed, fill, sentenceCount } from '../src/core/text.js';
import { bruteCounts, bruteDistinct, bruteFewest, bruteGolomb, bruteRulers } from './helpers/brute-ruler.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/ruler.json'));
const html = read('index.html');
const code = read('src/formats/ruler.js');
const board = read('src/ui/ruler-board.js');
const css = read('src/app.css').replace(/\/\*[\s\S]*?\*\//g, '');

const VALUES = { k: 5, f: 4, n: 11, no: '첫 ', face: '', total: 10 };
/** 그림과 판의 값은 글이 아니다 */
const DATA_KEYS = ['picture', 'blank', 'seed', 'level', 'figures'];

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
const pad = part('id="ruler-pad"', '접히는 모양 가리기: 판의 종류마다');
const own = [part('id="ruler-title"', 'id="make-title"'), part('id="ruler-counts"', 'id="why"'), part('id="ruler-count"', '접히는 모양 가리기: 할 일 한 줄'), pad, part('id="make-ruler"', '<script')].map(visibleText).join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const said = strings.map(([, text]) => text).join(' ');
const LAST_WHY = `why[${T.why.length - 1}].say`;

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 단계 목록이 사다리와 같다', () => {
  assert.equal(T.title, '눈금이 가장 적은 자');
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.deepEqual(
    T.levels.map((item) => item.level),
    LADDER.map((rung) => rung.level),
  );
  assert.deepEqual(
    T.levels.map((item) => item.name),
    ['모든 길이 재기', '가장 적은 눈금', '긴 자', '하나씩 길어지는 자', '같은 길이를 두 번 재지 않는 자', '직접 만들기'],
  );
  for (const entry of T.levels.filter((item) => !item.picture.blank)) assert.ok(generateBoard(entry.level, entry.picture.seed).board);
  assert.deepEqual(Object.keys(T.home.ask).sort(), ['chain', 'fewest', 'first', 'golomb', 'long']);
});

test('한 일과 사실만 말한다. 더 좋은 자가 있을 때만 "더 적은 눈금으로도 될까요?"라고 묻는다. 점수나 등급이 없다', () => {
  assert.doesNotMatch(said, /틀렸|틀린|아니에요|땡|정답|아쉽|실수|실패|성공|잘했|훌륭|대단|최고|멋져|멋진|완벽|축하|천재|똑똑|굉장|맞아요|맞혔|아깝/);
  assert.doesNotMatch(own, /틀렸|틀린|아니에요|땡|아쉽|실패|잘했|훌륭|대단|최고|멋/);
  assert.doesNotMatch(said + own, /점수|순위|레벨|연속|빨리|서둘|등급|별/);
  // 다 되었지만 가장 좋은 기록이 아니면(풀이 프로그램이 더 좋은 자를 안다) 기록만 말하고 묻는다. 가장 좋은 기록이면 끝난다
  assert.match(code, /const reached = !isRecord\(round\) \|\| mine === best;/);
  assert.match(code, /if \(!reached\) \{[\s\S]*?round\.wrongCount \+= 1;[\s\S]*?frame\.say\(recordLine\(board, mine, previous\)\);/);
  assert.match(T.play.fewer, /더 적은 눈금으로도 될까요\?$/);
  assert.match(T.play.shorter, /더 짧은 자로도 될까요\?$/);
  // 모든 판의 가장 좋은 기록을 풀이 프로그램이 알아서 "더 좋은 답이 있는지 몰라요"라고 말할 일이 없다
  assert.doesNotMatch(said, /몰라요/);
  assert.equal(fill(T.play.fewer, { k: 7, n: 11 }), '눈금 7개로 1부터 11까지 모두 잴 수 있어요. 더 적은 눈금으로도 될까요?');
  assert.equal(fill(T.right.first, { k: 4, n: 6 }), '눈금 4개로 1부터 6까지 모두 잴 수 있어요.');
  assert.equal(T.right.fewest, '이보다 적은 눈금으로는 안 돼요.');
  // 받침에 맞는 말: 짚은 두 눈금
  assert.equal(fill(T.status[`pair-${endsClosed(3) ? 'c' : 'o'}`], { k: 1, f: 4, n: 3 }), '1부터 4까지가 길이 3이에요');
  assert.equal(fill(T.status[`pair-${endsClosed(2) ? 'c' : 'o'}`], { k: 4, f: 6, n: 2 }), '4부터 6까지가 길이 2예요');
  for (const [path] of strings.filter(([key]) => /-c$/.test(key))) assert.ok(strings.some(([key]) => key === path.replace(/-c$/, '-o')), path);
  assert.doesNotMatch(code, /Math\.random/);
  assert.doesNotMatch(board, /Math\.random/);
  // 판 아래에는 찍은 눈금의 수, 잴 수 있는 길이의 수, 자의 길이, 짝의 수만 적는다. 무르거나 되돌린 수는 적지 않는다
  for (const line of code.split('\n')) if (/textContent/.test(line)) assert.doesNotMatch(line, /undoCount|resetCount|wrongCount|refuseCount|tapCount|switchCount/, line.trim());
});

test('무르기와 처음으로 뒤에는 앞의 말을 덮는 한마디를 한다. 다 만든 자는 무를 수 없다', () => {
  assert.equal(T.play.undo, '무르기 전 모습으로 돌아왔어요.');
  assert.equal(T.play.reset, '처음 자로 돌아왔어요.');
  assert.match(code, /frame\.say\(T\.play\.undo\);/);
  assert.match(code, /frame\.say\(T\.play\.reset\);/);
  assert.match(code, /if \(round\.done \|\| item\.done \|\| item\.history\.length === 0\) return;/);
  assert.match(code, /if \(round\.done \|\| item\.done \|\| sameMarks\(item\.marks, fixed\)\) return;/);
});

test('규칙 설명은 세 문장 안이다. 판의 꼴마다 있다. 직접 만들기의 안내 글도 세 문장 안이다', () => {
  assert.deepEqual(Object.keys(T.rules), ['first', 'fewest', 'chain', 'golomb']);
  for (const [key, rule] of Object.entries(T.rules)) {
    assert.ok(sentenceCount(fill(rule, VALUES)) <= 3, key);
    assert.match(rule, /^자의 자리를 누르면 눈금이 찍혀요\. /);
    // 규칙 글에는 까닭(짝의 수)을 적지 않는다
    assert.doesNotMatch(rule, /짝|골롬/);
  }
  assert.match(code, /if \(key === 'golomb'\) return fill\(T\.rules\.golomb, \{ k: round\.board\.count \}\);/);
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 56);
  const mine = guides[55];
  assert.ok(sentenceCount(mine) <= 3, mine);
  assert.match(mine, /^자의 길이를 골라요\./);
  assert.match(mine, /길이가 1 길어질 때마다 눈금도 꼭 하나 더 있어야 할까요\?$/);
});

test('힌트는 판의 종류마다 두 개이고, 하나하나가 질문 한 문장이다. 힌트 1은 함께 쓰는 목록에서 고른다. 까닭이나 이름을 말해 버리지 않는다', () => {
  assert.deepEqual(Object.keys(T.hints).sort(), ['chain', 'fewest', 'first', 'golomb', 'long', 'made']);
  const common = ['끝에는 어떤 모양이 되어야 하나요?', '끝나기 바로 전에는 어떤 모양일까요?', '더 작은 판이라면 할 수 있을까요?', '전에 해 본 판 가운데 닮은 판이 있었나요?', '규칙 하나가 없다면 어디까지 되나요?', '아직 한 번도 건드리지 않은 곳이 있나요?', '아까와 다른 곳에서 시작하면 어떻게 되나요?'];
  for (const [key, list] of Object.entries(T.hints)) {
    assert.equal(list.length, 2, key);
    assert.notEqual(list[0], list[1]);
    assert.ok(common.includes(list[0]), list[0]);
    for (const hint of list) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
      assert.doesNotMatch(hint, /때문|해야 해요|하면 돼요|짝|골롬|6가지|모자라/, hint);
    }
  }
  assert.match(code, /hints: \(round\) => T\.hints\[round\.mode\],/);
});

test('글의 빈칸({이름})은 정해진 이름만 쓰고, 채울 값이 모자라지 않는다. 다른 것은 다른 이름으로 읽는다', () => {
  const allowed = new Set(['k', 'f', 'n', 'no', 'total', 'level', 'tag', 'face']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
    assert.ok(fill(text, VALUES).length > 0, path);
  }
  // 찍은 눈금, 처음부터 있는 눈금, 빈 자리는 다른 이름으로 읽는다. 열린 자, 닫힌 자, 다 만든 자도 그렇다
  const names = ['position', 'position-marked', 'position-fixed'].map((key) => fill(T.labels[key], { n: 3 }));
  assert.equal(new Set(names).size, 3);
  const tabs = ['tab-done-label', 'tab-open-label', 'tab-locked-label'].map((key) => fill(T.labels[key], { n: 7, k: 5 }));
  assert.equal(new Set(tabs).size, 3);
  assert.notEqual(T.tool.on, T.tool.off);
});

test('화면 글에 영어 낱말이 없고, "~요"로 끝나는 말투다. 한 문장은 60자를 넘지 않는다', () => {
  for (const [path, text] of strings) assert.doesNotMatch(text.replace(/\{[^{}]*\}/g, ''), /[A-Za-z]/, `${path}: ${text}`);
  assert.doesNotMatch(own, /[A-Za-z]/);
  const notes = ['title', 'levels', 'labels', 'tool', 'status', 'solution.note', 'solution.note-chain', 'make.length', 'make.picture', 'best', 'notebook', 'whyNotes'];
  const spoken = strings.filter(([path]) => !notes.some((key) => path === key || path.startsWith(`${key}.`) || path.startsWith(`${key}[`)));
  for (const [path, text] of spoken) for (const sentence of sentences(fill(text, VALUES))) assert.match(sentence, /요[.?!]$/, `${path}: ${sentence}`);
  for (const text of Object.values(T.status)) assert.match(fill(text, VALUES), /요$/, text);
  for (const [path, text] of strings) for (const sentence of sentences(fill(text, VALUES))) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

test('이름(골롬 자)과 짝의 수의 식은 "왜 그럴까?"의 마지막 장에서만 말한다', () => {
  const before = strings.filter(([path]) => path !== LAST_WHY).map(([, text]) => text).join(' ');
  assert.doesNotMatch(before, /골롬|×|÷|공식/);
  assert.match(T.why.at(-1).say, /길이를 한 번씩만 재는 자를 골롬 자라 하고, 짝은 눈금 수 × \(눈금 수 − 1\) ÷ 2개예요\.$/);
  assert.doesNotMatch(visibleText(html), /골롬/);
  // 짝을 세는 까닭은 "왜 그럴까?"와 직접 만들기에서만 말한다
  for (const [path, text] of strings) if (!path.startsWith('why') && !path.startsWith('make.')) assert.doesNotMatch(text, /짝이|짝을|짝은/, `${path}: ${text}`);
  for (const [key, slide] of T.why.entries()) assert.ok(sentenceCount(slide.say) <= 3, `why[${key}]`);
  assert.equal(T.why.length, 4);
});

test('"왜 그럴까?"의 수: 0, 1, 4, 6은 1부터 6까지 꼭 한 번씩, 짝은 6개, 표의 짝의 수, 길이 10인 자의 84가지. 다른 방법으로 다시 따진다', () => {
  // 첫 장: 길이 6인 자, 눈금 4개
  const story = T.why[0].figures[0].ruler;
  assert.deepEqual(story, [0, 1, 4, 6]);
  assert.deepEqual([...bruteCounts(story).entries()].sort((a, b) => a[0] - b[0]), [1, 2, 3, 4, 5, 6].map((d) => [d, 1]));
  assert.equal(bruteFewest(6).fewest, 4);
  // 둘째 장: 짝 여섯 개(길이가 모두 다르다)
  assert.deepEqual(T.why[1].figures[0].pairs, story);
  assert.equal(pairCount(4), 6);
  // 셋째 장: 눈금 3~7개의 짝의 수와, 길이 7인 자에 눈금 5개가 있어야 한다는 것
  assert.deepEqual(T.why[2].figures[0].table, [3, 4, 5, 6, 7]);
  assert.deepEqual([3, 4, 5, 6, 7].map(pairCount), [3, 6, 10, 15, 21]);
  assert.equal(bruteFewest(7).fewest, 5);
  assert.match(T.why[2].say, /길이 7인 자는 눈금이 5개는 있어야 해요\./);
  // 넷째 장: 길이 10인 자는 눈금 5개(짝 10개)로 안 된다. 84가지가 모두 어떤 길이를 두 번 잰다
  assert.match(T.why[3].say, /^그런데 길이 10인 자는 눈금 5개면 짝이 10개인데도 안 돼요\. 선생님이 84가지를 모두 놓아 보니 늘 어떤 길이를 두 번 재요\./);
  assert.equal(placements(10, 5), 84);
  assert.ok(bruteRulers(10, 5).every((marks) => !bruteDistinct(marks)));
  assert.equal(bruteFewest(10).fewest, 6);
  const [ten, tenCounts, eleven] = T.why[3].figures;
  assert.deepEqual(ten.ruler, [0, 1, 4, 8, 10]);
  assert.deepEqual(tenCounts.lengths, ten.ruler);
  const counts = bruteCounts(ten.ruler);
  assert.equal(counts.get(4), 2);
  assert.equal(counts.has(5), false);
  assert.equal(T.whyNotes['ten-times'], '4를 두 번 재고 5는 못 재요');
  assert.deepEqual(eleven.ruler, [0, 1, 4, 9, 11]);
  assert.equal(bruteDistinct(eleven.ruler), true);
  assert.equal(bruteGolomb(5).shortest, 11);
  // 그림의 글은 그림마다 이름으로 고른다
  for (const slide of T.why) for (const figure of slide.figures) if (figure.note) assert.ok(T.whyNotes[figure.note], figure.note);
});

test('끝났을 때와 풀이, 직접 만들기의 말: 가장 적은 수와 그런 자의 수는 풀이 프로그램이 센다. 짝이 모자라지 않는데 안 되면 모든 경우를 해 보았다고 말한다', () => {
  assert.match(code, /if \(info\.best > info\.bound\) parts\.push\(fill\(T\.right\.tried, \{ f: info\.best - 1 \}\)\);/);
  assert.match(code, /if \(info\.best > info\.bound\) parts\.push\(fill\(T\.right\['golomb-tried'\], \{ f: info\.best - 1 \}\)\);/);
  assert.match(code, /lines\.push\(fill\(T\.make\[pairCount\(less\) < L \? 'reason-pairs' : 'reason-tried'\], \{ f: less, total: pairCount\(less\) \}\)\);/);
  // 직접 만들기에서 길이 10은 "모든 경우", 길이 11은 "짝이 모자라요"
  const reason = (L) => (pairCount(solveLength(L).fewest - 1) < L ? 'pairs' : 'tried');
  assert.equal(reason(10), 'tried');
  assert.equal(reason(11), 'pairs');
  assert.equal(fill(T.make['reason-pairs'], { f: 5, total: 10 }), '눈금 5개로는 두 눈금의 짝이 10개뿐이라 모자라요.');
  // 꼭 한 번씩 재는 자(길이 3, 6)에서만 그 말을 한다
  assert.match(code, /const once = \(k\) => \(pairCount\(k\) === L \? \[fill\(T\.right\.once, \{ n: L \}\)\] : \[\]\);/);
  assert.equal(fill(T.solution.count, { f: 19 }), '그런 자는 뒤집은 것을 하나로 세면 19가지예요.');
  assert.equal(T.solution.one, '그런 자는 뒤집은 것을 하나로 세면 한 가지뿐이에요.');
  const make = part('id="make-ruler"', '<script');
  for (const id of ['ruler-make-fewer', 'ruler-make-n', 'ruler-make-more', 'ruler-make-board', 'ruler-make-solve', 'ruler-make-result', 'ruler-make-play', 'ruler-make-picture']) assert.ok(make.includes(`id="${id}"`), id);
  assert.match(make, /id="ruler-make-solve"[^>]*>선생님, 알려 주세요</);
  assert.match(make, /id="ruler-make-play"[^>]*>내가 해 볼래요</);
  assert.match(code, /mode: custom \? 'made' : rungOf\(level\)\.mode,/);
  assert.match(code, /\n {4}madeBoard,\n/);
  // 가장 좋은 기록은 공책에 저절로 남는다(값이 클수록 좋은 기록: 눈금 수와 자의 길이는 빼서 적는다)
  assert.match(code, /value: -item\.best/);
  assert.match(code, /if \(!isRecord\(round\)\) return null;/);
});

test('index.html: 이 형식의 카드, 판, 판 아래, 도구, 답하는 칸, 직접 만들기가 있다. 틀에 이어져 있다', () => {
  for (const id of ['home-ruler-sample', 'home-ruler-ask', 'home-ruler-play', 'home-ruler-pick', 'home-ruler-make', 'home-ruler-blank', 'ruler-board', 'ruler-tabs', 'ruler-ruler', 'ruler-lengths', 'ruler-count', 'ruler-status', 'ruler-marks', 'ruler-measured-line', 'ruler-measured', 'ruler-span-line', 'ruler-span', 'ruler-pairs-line', 'ruler-pairs', 'ruler-counts', 'ruler-pad', 'ruler-best-box', 'ruler-best', 'ruler-best-picture', 'ruler-stop', 'make-ruler']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(part('id="ruler-title"', '</section>'), /<h2 id="ruler-title">눈금이 가장 적은 자<\/h2>/);
  assert.ok(visibleText(part('id="ruler-title"', '</section>')).includes(T.home.ask.first));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-ruler-make" class="menu-item"/);
  assert.match(pad, /id="ruler-stop"[^>]*>여기까지 할래요</);
  assert.match(part('id="ruler-counts"', 'id="why"'), /id="ruler-counts" class="btn wide" type="button" aria-pressed="false" hidden>재는 횟수 보기</);
  // 카드는 지우고 쓰기 예언 다음, 퍼즐 만들기 앞이다
  assert.ok(html.indexOf('id="erase-title"') < html.indexOf('id="ruler-title"'));
  assert.ok(html.indexOf('id="ruler-title"') < html.indexOf('id="make-title"'));
  // 틀이 형식을 안다(형식 목록의 맨 뒤, 지우고 쓰기 예언 다음)
  assert.match(read('src/main.js'), /erase: createErase\(frame\), ruler: createRuler\(frame\) \};/);
  assert.match(read('src/check-main.js'), /\['ruler', '눈금이 가장 적은 자'\]/);
  assert.match(read('src/core/smaller.js'), /erase: smallerErase, ruler: smallerRuler \};/);
  assert.match(code, /smaller: \(round, turn\) => smallerRuler\(\{ mode: round\.mode, board: round\.board \}, turn\),/);
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
  assert.match(code, /\$\('undo'\)\.hidden = false;\s*\$\('reset'\)\.hidden = false;/);
  assert.match(code, /ruleAside: true,/);
  assert.doesNotMatch(board + code, /setInterval|setTimeout|requestAnimationFrame/);
});

test('도구 "재는 횟수 보기": 처음 켜면 힌트 하나로 세고, 끝난 판에서는 누를 수 없다. 답은 말하지 않는다', () => {
  assert.deepEqual(T.tool, { off: '재는 횟수 보기', on: '재는 횟수 감추기' });
  assert.match(code, /if \(round\.countOn\) \{\s*round\.countShown = true;\s*round\.countCount \+= 1;\s*\}/);
  assert.match(code, /hintsOpened: round\.hintsOpened \+ \(round\.countShown \? 1 : 0\),/);
  assert.match(code, /\$\('ruler-counts'\)\.disabled = round\.done;/);
  assert.match(code, /\$\('ruler-pairs'\)\.textContent = String\(pairCount\(item\.marks\.length\)\);/);
});

test('화면: 자리와 길이 칸과 이름표는 44픽셀보다 작아지지 않는다. 찍은 눈금, 처음 눈금, 짚은 눈금, 두 번 재는 길이는 색만이 아니라 모양과 무늬로도 보인다', () => {
  assert.match(css, /\n\.rl-pos \{[^}]*min-width: 44px;[^}]*min-height: 44px;/);
  assert.match(css, /\n\.rl-len \{[^}]*min-width: 44px;[^}]*min-height: 44px;/);
  assert.match(css, /\n\.rl-tab \{[^}]*min-width: 76px;[^}]*min-height: 56px;/);
  assert.match(css, /\.rl-ruler \{\s*--w: min\(68px, calc\(\(100cqw - 24px\) \/ var\(--per\)\)\);/);
  assert.match(css, /\.rl-pos\.marked::before \{/);
  assert.match(css, /\.rl-pos\.fixed \{\s*background: repeating-linear-gradient/);
  assert.match(css, /\.rl-pos\.ringed \{\s*outline: 5px dashed/);
  assert.match(css, /\.rl-len\.twice \{\s*border: 6px double/);
  assert.match(css, /\n\.rl-len \{[^}]*border: 3px dashed/);
  assert.match(css, /\.rl-tab\.open \{\s*border-style: dashed;/);
  assert.match(css, /\.rl-tab\.current \{\s*border: 6px solid/);
  for (const name of ["'marked'", "'fixed'", "'ringed'", "'lit'", "'twice'", "'picked'", 'rl-art-notch', 'rl-art-ring']) assert.ok(board.includes(name), name);
});

/** 끝까지 한 판의 기록 하나 */
function finished(more = {}) {
  return { kind: 'round', id: `r-${more.id ?? 1}`, format: 'ruler', level: 1, seed: 1, custom: false, mode: 'first', outcome: 'solved', hintsOpened: 0, answers: [{ t: 10, answer: 'done:0:4', correct: true, guess: null }], wrongCount: 0, tapCount: 3, seconds: 40, solution: { possible: true, best: [4] }, ...more };
}

test('수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다. "왜 그럴까?"는 판을 한 번 끝까지 한 뒤에 열린다', () => {
  const tuning = tuningFor('ruler');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 5);
  assert.equal(tuning.hintCount, 2);
  assert.equal(tuning.whyAfter, 'finished');
  assert.equal(tuning.fastWin, undefined);
  assert.equal(tuning.fastSolo, undefined);
  assert.match(read('src/core/level.js'), /눈금이 가장 적은 자\(모두 임시\)/);
  assert.deepEqual(recommend([], 'ruler'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  assert.deepEqual(recommend([finished({ id: 1 }), finished({ id: 2 })], 'ruler'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  // 처음 다 된 자가 가장 좋은 기록이 아니면 "한 번에"가 아니다
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, wrongCount: 1 })], 'ruler').offerHarder, false);
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, seconds: 300 })], 'ruler').offerHarder, false);
  assert.equal(whyUnlocked([], 'ruler'), false);
  assert.equal(whyUnlocked([finished()], 'ruler'), true);
  assert.equal(whyUnlocked([finished({ side: true })], 'ruler'), false);
  assert.match(code, /wrongCount: round\.wrongCount,/);
});
