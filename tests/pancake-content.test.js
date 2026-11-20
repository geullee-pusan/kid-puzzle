// 팬케이크 뒤집기 대본 점검: 화면에 나오는 글이 약속을 지키는지, "왜 그럴까?"의 그림과 말이 다른 방법으로 따진 것과 맞는지 본다.
// 한 일과 사실만 말한다(틀렸다고 하지 않는다), 힌트는 두 높이, 규칙은 세 문장 안, 색만으로 알리지 않는다.
// 화면 코드와 틀에 이 형식이 이어져 있는지도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { LADDER, generateBoard } from '../src/core/pancake-ladder.js';
import { checkBoard, worstTable } from '../src/core/pancake.js';
import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { fill, sentenceCount } from '../src/core/text.js';
import { bruteBiggestFirst, bruteDone, bruteFewest, bruteReplay, permutations } from './helpers/brute-pancake.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/pancake.json'));
const html = read('index.html');
const code = read('src/formats/pancake.js');
const board = read('src/ui/pancake-board.js');
const css = read('src/app.css');

const VALUES = { k: 7, f: '3', n: 2, no: '첫 ', face: ', 탄 면이 위', total: 4 };
/** 그림과 판의 값은 글이 아니다 */
const DATA_KEYS = ['picture', 'blank', 'seed', 'board', 'flips', 'sizes', 'level'];

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
const own = [part('id="pancake-title"', 'id="product-title"'), part('id="pancake-board"', 'id="product-board"'), part('id="pancake-count"', 'id="product-count"'), part('id="pancake-pad"', 'id="product-pad"'), part('id="make-pancake"', 'id="make-product"')].map(visibleText).join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const said = strings.map(([, text]) => text).join(' ');

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 단계 목록이 사다리와 같다', () => {
  assert.equal(T.title, '팬케이크 뒤집기');
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.deepEqual(T.levels.map((item) => item.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(T.levels.map((item) => item.name), ['서너 장 쌓기', '다섯 장 쌓기', '가장 적게 뒤집기', '큰 더미를 가장 적게', '탄 면 팬케이크', '직접 만들기']);
  for (const entry of T.levels) assert.ok(entry.picture.blank === true || Number.isInteger(entry.picture.seed), entry.name);
  for (const entry of T.levels.filter((item) => !item.picture.blank)) assert.equal(checkBoard(generateBoard(entry.level, entry.picture.seed).board), null);
  // 처음 화면의 물음은 판의 종류마다 있다
  assert.deepEqual(Object.keys(T.home.ask).sort(), ['big', 'burnt', 'fewest', 'five', 'small']);
});

test('한 일과 사실만 말한다. 판정하는 말, 칭찬 낱말이 없다. 가장 적은 횟수는 끝나기 전에 말하지 않는다', () => {
  assert.doesNotMatch(said, /틀렸|틀린|아니에요|땡|정답|아쉽|실수|실패|성공|잘했|훌륭|대단|최고|멋져|멋진|완벽|축하|천재|똑똑|굉장|맞아요|맞혔/);
  assert.doesNotMatch(own, /틀렸|틀린|아니에요|땡|아쉽|실패|잘했|훌륭|대단|최고|멋/);
  assert.doesNotMatch(`${said} ${visibleText(html)}`, /대각/);
  // 더 많이 뒤집어 쌓으면 횟수를 말하고 더 적게 뒤집을 수 있을지 묻는다(가장 적은 횟수는 말하지 않는다)
  assert.equal(fill(T.play.fewer, { k: 6 }), '6번 뒤집어서 차례대로 쌓았어요. 더 적게 뒤집을 수 있을까요?');
  assert.match(T.play['fewer-up'], /더 적게 뒤집을 수 있을까요\?$/);
  for (const key of ['fewer', 'fewer-up', 'same']) assert.doesNotMatch(T.play[key], /가장 적/);
  assert.match(code, /if \(before !== null && k === before\) frame\.say\(fill\(T\.play\.same, \{ k \}\)\);/);
  assert.match(code, /const fewest = !isRecord\(round\) \|\| k === solution\.fewest;/);
  // 사실 하나와 할 수 있는 일 하나
  assert.match(T.play.top, /그대로예요\. 뒤집개를 더 아래에 넣어 볼 수 있어요\.$/);
  assert.match(T.play.same, /다른 자리부터 뒤집어 볼 수 있어요\.$/);
  assert.doesNotMatch(code, /Math\.random/);
  assert.doesNotMatch(board, /Math\.random/);
  // 판 아래에는 뒤집은 횟수와(가장 적게 뒤집는 판은) 이 더미에서 가장 적게 뒤집은 횟수만 적는다. 무른 수는 적지 않는다
  for (const line of code.split('\n')) if (/textContent/.test(line)) assert.doesNotMatch(line, /undoCount|resetCount|retryCount|wrongCount|flipCount|topCount|backCount/, line.trim());
});

test('무르기, 처음으로, 다시 해 보기 뒤에는 앞의 말을 덮는 한마디를 한다', () => {
  assert.equal(T.play.undo, '무르기 전 모습으로 돌아왔어요.');
  assert.equal(T.play.reset, '처음 더미로 돌아왔어요.');
  assert.match(T.play.again, /^처음 더미로 돌아왔어요\./);
  assert.match(code, /frame\.say\(T\.play\.undo\);/);
  assert.match(code, /frame\.say\(T\.play\.reset\);/);
  assert.match(code, /frame\.say\(T\.play\.again\);/);
});

test('규칙 설명은 세 문장 안이다. 판의 종류마다 있다. 첫 두 단계는 "가장 적게"를 걸지 않는다. 직접 만들기의 안내 글도 세 문장 안이다', () => {
  assert.deepEqual(Object.keys(T.rules).sort(), ['burnt', 'burnt-fewest', 'fewest', 'sort']);
  for (const [key, rule] of Object.entries(T.rules)) {
    assert.ok(sentenceCount(rule) <= 3, key);
    assert.match(rule, /^팬케이크를 누르면 그 팬케이크부터 맨 위까지 한꺼번에 뒤집혀요\./, key);
  }
  assert.doesNotMatch(T.rules.sort, /가장 적게/);
  assert.doesNotMatch(T.rules.burnt, /가장 적게/);
  assert.match(T.rules.fewest, /가장 적게 뒤집어 보세요\.$/);
  assert.match(T.rules.burnt, /탄 면도 위아래가 바뀌어요\./);
  assert.match(code, /const ruleKey = \(round\) => \(isBurnt\(round\.board\) \? \(isRecord\(round\) \? 'burnt-fewest' : 'burnt'\) : isRecord\(round\) \? 'fewest' : 'sort'\);/);
  assert.match(code, /ruleLine: \(round\) => T\.rules\[ruleKey\(round\)\],/);
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 33);
  assert.ok(sentenceCount(guides[29]) <= 3, guides[29]);
  assert.match(guides[29], /가장 적게 뒤집어도 여러 번 걸리는 더미를 만들 수 있을까요\?$/);
});

test('힌트는 판의 종류마다 두 개이고, 하나하나가 질문 한 문장이다. 방법을 말해 버리지 않는다', () => {
  assert.deepEqual(Object.keys(T.hints).sort(), ['burnt', 'burnt-fewest', 'fewest', 'sort']);
  const common = ['끝에는 어떤 모양이 되어야 하나요?', '끝나기 바로 전에는 어떤 모양일까요?', '더 작은 판이라면 할 수 있을까요?', '아까와 다른 곳에서 시작하면 어떻게 되나요?', '아직 한 번도 건드리지 않은 곳이 있나요?'];
  for (const [key, list] of Object.entries(T.hints)) {
    assert.equal(list.length, 2, key);
    assert.notEqual(list[0], list[1]);
    // 힌트 1은 모든 형식이 함께 쓰는 짧은 목록에서, 힌트 2는 어디를 볼지
    assert.ok(common.includes(list[0]), list[0]);
    for (const hint of list) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
      assert.doesNotMatch(hint, /때문|해야 해요|하면 돼요|늘 |\d|큰 것부터 보내기|통째로/, hint);
    }
  }
  assert.match(code, /hints: \(round\) => T\.hints\[ruleKey\(round\)\],/);
});

test('글의 빈칸({이름})은 정해진 이름만 쓰고, 채울 값이 모자라지 않는다', () => {
  const allowed = new Set(['k', 'f', 'n', 'no', 'total', 'level', 'tag', 'face']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
    assert.ok(fill(text, VALUES).length > 0, path);
  }
  const cake = fill(T.labels.cake, { no: '첫 ', n: 3, face: T.labels.up });
  assert.equal(cake, '위에서 첫 번째, 크기 3 팬케이크, 탄 면이 위');
  assert.equal(fill(T.labels.flip, { face: fill(T.labels.cake, { no: '3', n: 5, face: '' }), k: 3 }), '위에서 3번째, 크기 5 팬케이크. 누르면 위의 3장이 한꺼번에 뒤집혀요');
  assert.equal(fill(T.notebook.best, { k: 4 }), '4번 뒤집어 쌓은 더미');
});

test('화면 글에 영어 낱말과 보상 낱말이 없고, "~요"로 끝나는 말투다. 한 문장은 60자를 넘지 않는다', () => {
  for (const [path, text] of strings) assert.doesNotMatch(text.replace(/\{[^{}]*\}/g, ''), /[A-Za-z]/, `${path}: ${text}`);
  assert.doesNotMatch(own, /[A-Za-z]/);
  assert.doesNotMatch(own, /별|점수|순위|레벨|연속/);
  const spoken = [...Object.values(T.home.ask), T.home.pick, ...Object.values(T.rules), ...Object.values(T.play), ...Object.values(T.hints).flat(), ...Object.values(T.right), T.solution.path, ...Object.entries(T.make).filter(([key]) => key !== 'size').map(([, text]) => text), ...T.why.map((slide) => slide.say)];
  for (const text of spoken) for (const sentence of sentences(text)) assert.match(sentence, /요[.?!]$/, sentence);
  for (const text of Object.values(T.status)) assert.match(text, /요$/, text);
  for (const slide of T.why) for (const item of slide.figures) assert.match(item.note, /요$/, item.note);
  for (const [path, text] of strings) for (const sentence of sentences(fill(text, VALUES))) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

test('"왜 그럴까?": 가장 큰 것만 보기 → 큰 것부터 보내기(이름, 한 장에 많아야 두 번) → 가장 적은 것은 아니다 → 장 수마다의 표', () => {
  assert.equal(T.why.length, 4);
  for (const slide of T.why) assert.ok(sentenceCount(slide.say) <= 3, slide.say);
  const [one, two, three, four] = T.why.map((slide) => slide.figures);
  // 첫 장: 두 번 뒤집어 가장 큰 팬케이크를 맨 아래로 보낸다(맨 위로 올린 다음 통째로)
  const story = one[0].board;
  assert.equal(story.up, null);
  const n = story.stack.length;
  assert.deepEqual(one[0].flips, [story.stack.indexOf(n) + 1, n]);
  assert.equal(bruteReplay(story.stack, null, one[0].flips.slice(0, 1)).stack[0], n);
  assert.equal(bruteReplay(story.stack, null, one[0].flips).stack.at(-1), n);
  // 둘째 장: 같은 더미를 큰 것부터 보내기로 끝까지(테스트가 따로 만든 큰 것부터 보내기와 같다). 이름은 여기서 처음 말한다
  assert.deepEqual(two[0].board, story);
  assert.deepEqual(two[0].flips, bruteBiggestFirst(story.stack));
  assert.ok(bruteDone(bruteReplay(story.stack, null, two[0].flips).stack));
  assert.match(two[0].note, /^네 번/);
  assert.equal(two[0].flips.length, 4);
  assert.match(T.why[1].say, /한 장에 많아야 두 번이에요\./);
  assert.match(T.why[1].say, /큰 것부터 보내기라고 불러요\.$/);
  assert.doesNotMatch(T.why[0].say, /큰 것부터 보내기/);
  // 한 장에 많아야 두 번: 2~7장의 모든 더미에서 큰 것부터 보내기는 장 수의 두 배보다 적게 걸린다
  for (let size = 2; size <= 7; size++) for (const stack of permutations(size)) assert.ok(bruteBiggestFirst(stack).length <= 2 * (size - 1));
  // 셋째 장: 같은 더미를 큰 것부터 보내기로는 다섯 번, 가장 적게는 세 번(다른 방법으로 다시 구한다)
  const other = three[0].board;
  assert.deepEqual(three[1].board, other);
  assert.deepEqual(three[0].flips, bruteBiggestFirst(other.stack));
  assert.equal(three[0].flips.length, 5);
  assert.equal(three[1].flips.length, 3);
  assert.equal(bruteFewest(other.stack).fewest, 3);
  assert.ok(bruteDone(bruteReplay(other.stack, null, three[1].flips).stack));
  assert.match(T.why[2].say, /다섯 번이 걸려요\. 풀이 프로그램은 세 번에 쌓았어요\.$/);
  assert.match(three[0].note, /다섯 번/);
  assert.match(three[1].note, /^세 번/);
  // 넷째 장: 3~7장의 표(그 자리에서 풀이 프로그램이 채운다). 큰 것부터 보내기는 한 장에 두 번씩 늘고, 가장 적은 횟수는 그렇지 않다
  assert.deepEqual(four[0].sizes, [3, 4, 5, 6, 7]);
  const rows = worstTable(four[0].sizes);
  for (const row of rows) {
    const all = permutations(row.n);
    // 7장(5,040가지)은 tests/pancake.test.js가 모든 더미를 다른 방법으로 따진다. 여기서는 6장까지 다시 센다
    if (row.n <= 6) assert.equal(row.fewest, Math.max(...all.map((stack) => bruteFewest(stack).fewest)), `${row.n}장`);
    assert.equal(row.method, Math.max(...all.map((stack) => bruteBiggestFirst(stack).length)), `${row.n}장`);
  }
  const steps = (key) => rows.slice(1).map((row, index) => row[key] - rows[index][key]);
  assert.deepEqual(steps('method'), [2, 2, 2, 2]);
  assert.match(T.why[3].say, /한 장 늘 때마다 두 번씩 늘어요\./);
  assert.deepEqual(steps('fewest'), [1, 1, 2, 1]);
  assert.match(T.why[3].say, /깔끔하게 늘지 않아요\.$/);
  assert.equal(four[0].note, '다섯 장에서 여섯 장이 될 때는 두 번이 늘었어요');
  assert.match(code, /worstTable\(sizes\)/);
  // 이름은 "왜 그럴까?"와 그 표에서만 말한다
  for (const [path, text] of strings) if (!path.startsWith('why') && !path.startsWith('table')) assert.doesNotMatch(text, /큰 것부터 보내기/, path);
});

test('풀이와 직접 만들기: 가장 적은 횟수와 한 가지 방법을 그려 보인다. 장 수마다 가장 많이 걸리는 더미이면 그렇다고 말한다', () => {
  assert.equal(fill(T.solution.path, { k: 3 }), '가장 적게 뒤집으면 3번이에요. 한 가지 방법을 보여 줄게요.');
  assert.match(code, /const worst = result\.fewest === worstOf\(board\.stack\.length, isBurnt\(board\)\)\.worst;/);
  assert.equal(fill(T.make.worst, { n: 6 }), '6장 더미 가운데 가장 많이 뒤집어야 하는 더미예요.');
  const make = part('id="make-pancake"', 'id="make-product"');
  for (const id of ['pancake-make-fewer', 'pancake-make-n', 'pancake-make-more', 'pancake-make-burnt', 'pancake-make-turn', 'pancake-make-clear', 'pancake-make-board', 'pancake-make-solve', 'pancake-make-result', 'pancake-make-play', 'pancake-make-picture']) assert.ok(make.includes(`id="${id}"`), id);
  assert.match(make, /id="pancake-make-solve"[^>]*>선생님, 가장 적게 몇 번이에요\?</);
  assert.match(make, /id="pancake-make-play"[^>]*>내가 해 볼래요</);
  assert.deepEqual([...make.matchAll(/data-burnt="(\w+)"/g)].map((match) => match[1]), ['no', 'yes']);
  assert.match(T.make.intro, /가장 적게 몇 번 뒤집으면 되는지 물어볼 수 있어요\.$/);
  // 직접 만든 판: 다 쌓인 더미는 해 보거나 남기지 않는다. 가장 적게 뒤집는 판처럼 한다
  assert.match(code, /mode: custom \? 'made' : rungOf\(level\)\.mode,/);
  assert.match(code, /const madeBoard = \(\) => \(draft && checkBoard\(draft\) === null && !isDone\(draft\) \? copyBoard\(draft\) : null\);/);
  assert.match(code, /\n {4}madeBoard,\n/);
  // 가장 좋은 기록은 가장 적게 뒤집는 판에서만, 적을수록 좋은 기록이다
  assert.match(code, /bestOf: \(round\) => \(!isRecord\(round\) \|\| round\.best === null \? null : \{ value: -round\.best, name: fill\(T\.notebook\.best, \{ k: round\.best \}\) \}\),/);
});

test('index.html: 이 형식의 카드, 판, 판 아래, 답하는 칸, 직접 만들기가 있다. 틀에 이어져 있다', () => {
  for (const id of ['home-pancake-sample', 'home-pancake-ask', 'home-pancake-play', 'home-pancake-pick', 'home-pancake-make', 'home-pancake-blank', 'pancake-board', 'pancake-count', 'pancake-status', 'pancake-flips', 'pancake-best-line', 'pancake-best', 'pancake-pad', 'pancake-burnt-note', 'pancake-again', 'pancake-stop', 'make-pancake']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(part('id="pancake-title"', '</section>'), /<h2 id="pancake-title">팬케이크 뒤집기<\/h2>/);
  assert.ok(visibleText(part('id="pancake-title"', '</section>')).includes(T.home.ask.small));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-pancake-make" class="menu-item"/);
  const pad = part('id="pancake-pad"', 'id="product-pad"');
  assert.match(visibleText(pad), /누른 팬케이크부터 맨 위까지 한꺼번에 뒤집혀서 차례가 거꾸로 돼요\./);
  assert.match(pad, /id="pancake-again"[^>]*>처음 더미로 다시 해 볼래요</);
  assert.match(pad, /id="pancake-stop"[^>]*>여기까지 할래요</);
  assert.doesNotMatch(pad, /불가능해요/);
  // 카드는 수열 길 퍼즐 다음, 퍼즐 만들기 앞이다
  assert.ok(html.indexOf('id="seqpath-title"') < html.indexOf('id="pancake-title"'));
  assert.ok(html.indexOf('id="pancake-title"') < html.indexOf('id="make-title"'));
  // 틀이 형식을 안다(수열 길 퍼즐 다음)
  assert.match(read('src/main.js'), /seqpath: createSeqpath\(frame\), pancake: createPancake\(frame\), /);
  assert.match(read('src/check-main.js'), /\['pancake', '팬케이크 뒤집기'\]/);
  assert.match(read('src/core/smaller.js'), /seqpath: smallerSeqpath, pancake: smallerPancake, /);
  assert.match(code, /smaller: \(round, turn\) => smallerPancake\(\{ mode: round\.mode, board: round\.board \}, turn\),/);
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
  // 무르기와 되돌리기가 있다. 여덟 장 더미는 위아래로 커서 규칙 글은 왼쪽 칸에 둔다
  assert.match(code, /\$\('undo'\)\.hidden = false;\s*\$\('reset'\)\.hidden = false;/);
  assert.match(code, /ruleAside: true,/);
  // 판을 그리는 조각은 글을 적지 않는다. 타이머가 없다(움직임은 CSS가 한다)
  assert.doesNotMatch(board + code, /setInterval|setTimeout|requestAnimationFrame/);
  for (const name of ['pointerdown', "'turning'", "'cake-burnt'", "'cake-size'", 'aimed', 'spatula']) assert.ok(board.includes(name), name);
});

test('화면: 뒤집는 움직임은 0.6초 안이고 움직임을 줄이는 설정에서는 없다. 여덟 장이어도 한 줄이 44픽셀보다 높다. 탄 면은 색만이 아니라 자리(위나 아래의 띠)로 보인다', () => {
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const [, seconds] = plain.match(/\.cake-row\.turning \.cake \{[^}]*animation: cake-turn ([\d.]+)s/);
  assert.ok(Number(seconds) <= 0.6);
  assert.match(plain, /@media \(prefers-reduced-motion: reduce\) \{\s*\.cake-row\.turning \.cake \{\s*animation: none;/);
  // 팬케이크 그림은 누름을 받지 않는다(움직이는 동안에도 누른 자리의 줄 단추가 받는다)
  assert.match(plain, /\n\.cake \{[^}]*pointer-events: none;/);
  const [, low] = plain.match(/\.cake-row \{[^}]*min-height: (\d+)px/);
  assert.ok(Number(low) >= 44);
  assert.match(plain, /\.cake\.burnt-up \.cake-burnt \{\s*top: 0;/);
  assert.match(plain, /\.cake\.burnt-down \.cake-burnt \{\s*bottom: 0;/);
  assert.match(plain, /\.cake-burnt \{[^}]*repeating-linear-gradient/);
});

/** 끝까지 한 판의 기록 하나 */
function finished(more = {}) {
  return { kind: 'round', id: `r-${more.id ?? 1}`, format: 'pancake', level: 1, seed: 1, custom: false, mode: 'small', outcome: 'solved', hintsOpened: 0, answers: [{ t: 10, answer: 'done:3', correct: true, guess: null }], wrongCount: 0, moveCount: 3, seconds: 40, solution: { possible: true, fewest: 2 }, ...more };
}

test('수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다. "왜 그럴까?"는 판을 한 번 끝까지 한 뒤에 열린다', () => {
  const tuning = tuningFor('pancake');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 5);
  assert.equal(tuning.hintCount, 2);
  assert.equal(tuning.whyAfter, 'finished');
  assert.match(read('src/core/level.js'), /팬케이크 뒤집기\(모두 임시\)/);
  assert.deepEqual(recommend([], 'pancake'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  assert.deepEqual(recommend([finished({ id: 1 }), finished({ id: 2 })], 'pancake'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  // 가장 적게 뒤집는 판: 처음 다 쌓은 것이 가장 적은 횟수가 아니면 "한 번에"가 아니다
  assert.equal(recommend([finished({ id: 1, level: 3 }), finished({ id: 2, level: 3, wrongCount: 1 })], 'pancake').offerHarder, false);
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, seconds: 200 })], 'pancake').offerHarder, false);
  assert.equal(whyUnlocked([], 'pancake'), false);
  assert.equal(whyUnlocked([finished()], 'pancake'), true);
  assert.equal(whyUnlocked([finished({ side: true })], 'pancake'), false);
  assert.match(code, /round\.wrongCount \+= 1;/);
  assert.match(code, /moveCount: round\.flipCount,/);
  assert.match(code, /solution: \{ possible: true, fewest: solution\.fewest, path: solution\.path \},/);
});
