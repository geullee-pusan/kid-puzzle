// 마법 네모와 겹친 칸 대본 점검: 화면에 나오는 글이 약속을 지키는지, "왜 그럴까?"의 그림과 말 속의 수가 풀이 프로그램과 맞는지 본다.
// 한 일과 사실만 말한다(틀렸다고 하지 않는다), 수 뒤에 붙는 말은 받침으로 고른다, 힌트는 두 높이, 규칙은 세 문장 안,
// 화면 코드와 틀에 이 형식이 이어져 있는지도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { HUB_POOL, LADDER, SET_POOL, generateBoard } from '../src/core/magic-ladder.js';
import { centerOf, hubSums, isDone, lineSums, linesOf, passCounts, solve } from '../src/core/magic.js';
import { endsClosed, fill, sentenceCount } from '../src/core/text.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/magic.json'));
const html = read('index.html');
const code = read('src/formats/magic.js');
const board = read('src/ui/magic-board.js');

const VALUES = { k: 15, f: '두', n: 3, no: '세', face: '5 카드', total: 8 };
/** 그림의 값은 글이 아니다 */
const DATA_KEYS = ['picture', 'blank', 'seed', 'arms', 'target', 'cells', 'lines', 'dots', 'level', 'times'];

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
const own = [part('id="magic-title"', 'id="apart-title"'), part('id="magic-dots"', 'id="apart-near"'), part('id="magic-count"', 'id="apart-count"'), part('id="magic-pad"', 'id="apart-pad"'), part('id="make-magic"', 'id="make-apart"')].map(visibleText).join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const said = strings.map(([, text]) => text).join(' ');
const ONE_TO_NINE = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const square = (lines) => ({ shape: 'grid', w: 3, h: 3, lines, cards: ONE_TO_NINE, target: null });
const hub = (arms, target) => ({ shape: 'hub', arms, cards: Array.from({ length: 1 + 2 * arms }, (_, index) => index + 1), target });

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 단계 목록이 사다리와 같다', () => {
  assert.equal(T.title, '마법 네모와 겹친 칸');
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.deepEqual(T.levels.map((item) => item.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(T.levels.map((item) => item.name), ['가로 줄만 같게', '가로와 세로를 같게', '비스듬한 줄까지 마법 네모', '다른 수 카드로', '겹친 칸이 있는 줄', '직접 만들기']);
  for (const rung of LADDER) assert.ok(T.home.ask[String(rung.level)], rung.level);
  for (const entry of T.levels) assert.ok(entry.picture.blank === true || Number.isInteger(entry.picture.seed), entry.name);
  // 판 고르기의 5단계 그림은 줄 셋이 만나는 판이다
  assert.equal(generateBoard(5, T.levels[4].picture.seed).board.arms, 3);
  assert.deepEqual(T.times, { 1: '한', 2: '두', 3: '세', 4: '네' });
});

test('한 일과 사실만 말한다. 판정하는 말과 칭찬 낱말이 없다', () => {
  assert.doesNotMatch(said, /틀렸|틀린|아니에요|땡|정답|아쉽|실수|실패|성공|잘했|훌륭|대단|최고|멋져|멋진|완벽|축하|천재|똑똑|굉장|맞아요|맞혔/);
  assert.doesNotMatch(own, /틀렸|틀린|아니에요|땡|아쉽|실패|잘했|훌륭|대단|최고|멋/);
  // 줄 이름은 "비스듬한 줄"이라고 한다("대각선"도 쓸 수 있는 말이지만 이 형식은 처음 쓴 이름을 그대로 쓴다)
  assert.match(T.rules.all, /비스듬한 줄 여덟 줄/);
  assert.equal(fill(T.play.unequal, { total: 8, n: 5 }), '카드를 모두 놓았어요. 줄 8개 가운데 합이 같은 줄은 5개예요.');
  assert.equal(fill(T.play.off, { total: 3, k: 11, n: 2 }), '카드를 모두 놓았어요. 줄 3개 가운데 합이 11인 줄은 2개예요.');
  assert.equal(T.play['possible-press'], '이 판은 되는 방법이 있어요. 판에서 조금 더 해 볼 수 있어요.');
  // 다 맞으면 끝나고, 되는 판의 "불가능해요"는 판을 끝내지 않는다
  assert.match(code, /if \(isDone\(board, placed\)\) \{[\s\S]*?frame\.finish\('solved'\);\s*return;\s*\}/);
  assert.match(code, /if \(correct\) \{\s*frame\.finish\('solved'\);\s*return;\s*\}\s*\/\/ 되는 판이다\. 틀렸다고 하지 않고 사실만 말한다/);
  assert.doesNotMatch(code, /Math\.random/);
  assert.doesNotMatch(board, /Math\.random/);
  // 판 아래와 오른쪽 칸에는 할 일과 맞출 합만 적는다(몇 번 놓았는지, 몇 번 다 놓아 봤는지 적지 않는다)
  for (const line of code.split('\n')) if (/textContent/.test(line)) assert.doesNotMatch(line, /moveCount|dragCount|tapCount|fullCount|undoCount|resetCount|tries\.length/, line.trim());
});

test('수 뒤에 붙는 말은 받침으로 고른다: -closed는 이에요·이어야, -open은 예요·여야', () => {
  const groups = [T.right, T.solution, T.reason, T.make];
  let pairs = 0;
  for (const group of groups) {
    for (const [name, text] of Object.entries(group)) {
      const match = name.match(/^(.*)-(closed|open)$/);
      if (!match) continue;
      const other = group[`${match[1]}-${match[2] === 'closed' ? 'open' : 'closed'}`];
      assert.ok(other, `${name}의 짝`);
      if (match[2] === 'closed') {
        pairs += 1;
        assert.match(text, /\}(이에요|이어야)/, name);
        assert.equal(text.replace(/\}이에요/g, '}예요').replace(/\}이어야/g, '}여야'), other, name);
      }
    }
  }
  assert.ok(pairs >= 10, `짝 ${pairs}`);
  // 15(십오), 12(십이)는 받침이 없고 13(십삼), 60(육십)은 있다
  assert.deepEqual([15, 12, 13, 60].map(endsClosed), [false, false, true, true]);
  // 코드는 수마다 받침을 보고 고른다
  assert.match(code, /const pick = \(group, key, number\) => group\[`\$\{key\}-\$\{endsClosed\(number\) \? 'closed' : 'open'\}`\];/);
});

test('규칙 설명은 세 문장 안이다. 안 되는 판이 섞이는 판만 "불가능해요"를 말한다. 직접 만들기의 안내 글도 세 문장 안이다', () => {
  assert.deepEqual(Object.keys(T.rules).sort(), ['all', 'center', 'hub', 'hub-free', 'maybe', 'rows', 'rowscols']);
  for (const [key, rule] of Object.entries(T.rules)) {
    if (key === 'maybe') continue;
    assert.ok(sentenceCount(`${fill(rule, VALUES)} ${T.rules.maybe}`) <= 3, key);
    assert.doesNotMatch(rule, /불가능/, key);
  }
  assert.match(T.rules.maybe, /‘불가능해요’/);
  assert.match(code, /return hasImpossible\(round\) \? `\$\{line\} \$\{T\.rules\.maybe\}` : line;/);
  assert.match(code, /mode: custom \|\| rungOf\(level\)\.pool \? 'mixed' : 'sure',/);
  assert.equal(fill(T.rules.hub, { n: 3, k: 12 }), '줄 3개가 가운데 칸 하나에서 만나요. 줄마다 합을 12에 맞춰요.');
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 41);
  assert.ok(sentenceCount(guides[24]) <= 3, guides[24]);
  assert.match(guides[24], /^판 모양을 고르고, 수를 눌러 카드를 골라요\./);
  assert.match(guides[24], /어떤 합으로도 안 되는 카드도 고를 수 있을까요\?$/);
});

test('힌트는 판의 종류마다 두 개이고, 하나하나가 질문 한 문장이다. 답을 말해 버리지 않는다', () => {
  assert.deepEqual(Object.keys(T.hints).sort(), ['all', 'center', 'hub', 'rows', 'rowscols', 'sets']);
  for (const [key, list] of Object.entries(T.hints)) {
    assert.equal(list.length, 2, key);
    assert.notEqual(list[0], list[1]);
    for (const hint of list) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
      assert.doesNotMatch(hint, /때문|해야 해요|하면 돼요|늘 |\d/, hint);
    }
  }
  // 기획의 물음: 가운데를 지나는 줄은 몇 개일까요?
  assert.equal(T.hints.all[1], '가운데 칸을 지나는 줄은 몇 개일까요?');
  assert.equal(T.hints.hub[1], '가운데 카드는 줄의 합에 몇 번 세어지나요?');
  assert.match(code, /hints: \(round\) => T\.hints\[kindOf\(round\.board\)\],/);
});

test('글의 빈칸({이름})은 정해진 이름만 쓰고, 채울 값이 모자라지 않는다', () => {
  const allowed = new Set(['k', 'f', 'n', 'no', 'total', 'level', 'tag', 'face']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
    assert.ok(fill(text, VALUES).length > 0, path);
  }
  assert.equal(fill(T.reason['hub-count'], { n: 3, no: '세' }), '줄 3개를 모두 더하면 가운데 카드는 세 번, 다른 카드는 한 번씩 세어져요.');
  assert.equal(fill(T.reason['hub-extra-open'], { f: '두', k: 5 }), '그래서 가운데 카드를 두 번 더 센 몫이 5여야 해요.');
  assert.equal(fill(T.labels.cell, { no: '첫 ', face: '빈칸' }), '첫 번째 칸, 빈칸');
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
    ...Object.values(T.reason),
    ...Object.entries(T.make)
      .filter(([key]) => !key.startsWith('line-'))
      .map(([, text]) => text),
    ...T.why.grid.map((slide) => slide.say),
    ...T.why.hub.map((slide) => slide.say),
  ];
  for (const text of spoken) for (const sentence of sentences(text)) assert.match(sentence, /요[.?!]?$/, sentence);
  for (const text of Object.values(T.status)) assert.match(text, /요$/, text);
  for (const slide of [...T.why.grid, ...T.why.hub]) for (const item of slide.figures) assert.match(item.note, /요$/, item.note);
  for (const key of ['line-closed', 'line-open']) assert.match(T.make[key], /요$/);
  for (const [path, text] of strings) for (const sentence of sentences(fill(text, VALUES))) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

/** "왜 그럴까?" 그림의 판 */
const figureBoard = (item) => (item.arms ? hub(item.arms, item.target ?? null) : square(item.lines));
const sumsOf = (item) => lineSums(figureBoard(item), item.cells).map((line) => line.sum);

test('"왜 그럴까?"(네모): 가운데 1에서 막힘 → 가운데를 지나는 네 줄 → 네 번 세니 가운데는 5 → 가로 줄만이면 아무 수나', () => {
  const story = T.why.grid;
  assert.equal(story.length, 4);
  for (const slide of story) assert.ok(sentenceCount(slide.say) <= 3, slide.say);
  const [one, two, three, four] = story.map((slide) => slide.figures);
  // 첫 장: 가운데가 1인 네모는 여덟 줄이 같지 않다. 1~9의 마법 네모는 가운데가 5뿐이다
  assert.equal(one[0].cells[centerOf(figureBoard(one[0]))], 1);
  assert.equal(isDone(figureBoard(one[0]), one[0].cells), false);
  assert.match(story[0].say, /가운데에 1을 놓았더니/);
  assert.deepEqual(solve(square('all')).sums.map((item) => item.centers), [[5]]);
  // 둘째 장: 가운데 네 줄은 아홉 칸을 모두 지나고, 가운데 칸만 네 번 센다
  assert.equal(two[0].lines, 'center');
  assert.equal(two[0].dots, true);
  assert.deepEqual(passCounts(figureBoard(two[0])), [1, 1, 1, 1, 4, 1, 1, 1, 1]);
  assert.match(story[1].say, /가운데 카드만 네 번 세어져요\.$/);
  // 셋째 장의 수: 1~9의 합 45, 가로 줄마다 15, 네 줄 60, 60 − 45 = 15 = 가운데 × 3, 가운데 5
  const total = ONE_TO_NINE.reduce((a, b) => a + b, 0);
  const line = total / 3;
  const center = (4 * line - total) / 3;
  assert.deepEqual([total, line, 4 * line, 4 * line - total, center], [45, 15, 60, 15, 5]);
  for (const number of [total, line, 4 * line, center]) assert.match(story[2].say, new RegExp(`${number}(이|예|보다|이고|이니|가)`), String(number));
  assert.ok(isDone(figureBoard(three[0]), three[0].cells));
  assert.equal(three[0].cells[4], 5);
  // 넷째 장: 가로 줄만 맞춘 판은 가운데가 1이어도 된다(첫 장과 같은 카드)
  assert.equal(four[0].lines, 'rows');
  assert.ok(isDone(figureBoard(four[0]), four[0].cells));
  assert.deepEqual(four[0].cells, one[0].cells);
  assert.deepEqual(sumsOf(four[0]), [15, 15, 15]);
  assert.match(four[0].note, /15예요$/);
  assert.equal(solve(square('rows')).sums[0].centers.length, 9);
});

test('"왜 그럴까?"(겹친 칸): 11을 만들려다 막힘 → 가운데는 세 번 → 28과 33, 두 번 더한 5 → 10, 12, 14는 된다', () => {
  const story = T.why.hub;
  assert.equal(story.length, 4);
  for (const slide of story) assert.ok(sentenceCount(slide.say) <= 3, slide.say);
  const [one, two, three, four] = story.map((slide) => slide.figures);
  // 첫 장: 두 줄은 11, 한 줄은 12
  assert.deepEqual(sumsOf(one[0]).slice().sort((a, b) => a - b), [11, 11, 12]);
  assert.equal(one[0].note, '두 줄은 11, 한 줄은 12예요');
  assert.equal(solve(hub(3, 11)).possible, false);
  // 둘째 장: 가운데 칸은 세 번, 바깥 칸은 한 번
  assert.deepEqual(passCounts(figureBoard(two[0])), [3, 1, 1, 1, 1, 1, 1]);
  // 셋째 장의 수: 1~7의 합 28, 세 줄 33, 가운데를 두 번 더 센 몫 5(정수인 가운데가 없다)
  const total = 28;
  assert.equal([1, 2, 3, 4, 5, 6, 7].reduce((a, b) => a + b, 0), total);
  assert.equal(3 * 11, 33);
  assert.equal(33 - total, 5);
  assert.notEqual(5 % 2, 0);
  for (const number of [28, 33, 5]) assert.match(story[2].say, new RegExp(`${number}(이|예|이라|여야|가)`), String(number));
  assert.equal(solve(hub(3, 11)).why.reason, 'center-part');
  assert.deepEqual(three[0].cells, one[0].cells);
  // 넷째 장: 되는 합은 10, 12, 14이고 가운데는 1, 4, 7이다. 그림마다 그 합으로 다 맞았다
  const fast = hubSums(3, [1, 2, 3, 4, 5, 6, 7]).filter((item) => item.possible);
  assert.deepEqual(fast.map((item) => [item.line, item.center]), [[10, 1], [12, 4], [14, 7]]);
  assert.match(story[3].say, /줄마다 10, 12, 14는 돼요\. 가운데에 1, 4, 7을 놓고/);
  assert.deepEqual(four.map((item) => item.target), [10, 12, 14]);
  for (const item of four) {
    assert.ok(isDone(figureBoard(item), item.cells), item.note);
    assert.equal(item.cells[0], fast.find((entry) => entry.line === item.target).center);
    assert.equal(item.note, fill(T.make[`line-${endsClosed(item.target) ? 'closed' : 'open'}`], { k: item.target }));
  }
  // 이야기는 판의 모양에 따라 고른다. 판을 한 번 끝까지 한 뒤에 열린다
  assert.match(code, /const story = round\.board\.shape === 'hub' \? T\.why\.hub : T\.why\.grid;/);
  assert.equal(tuningFor('magic').whyAfter, 'finished');
});

test('안 되는 판의 까닭마다 말이 있다(사다리의 안 되는 판, 직접 만들기의 판)', () => {
  const reasons = new Set([...SET_POOL.no.map((cards) => solve({ shape: 'grid', w: 3, h: 3, lines: 'all', cards, target: null }).why.reason), ...HUB_POOL.no.map((item) => solve(item).why.reason), 'big', 'small', 'pairs-all', 'search']);
  const used = { big: ['big-closed', 'big-rest', 'hub-big-closed'], split: ['total-closed', 'split'], 'center-part': ['line-closed', 'center-part', 'hub-count', 'hub-extra-closed', 'hub-part'], 'center-missing': ['center-need-closed', 'center-missing'], pairs: ['pairs-closed', 'lonely'], search: ['search'], small: ['hub-small-closed'], 'pairs-all': ['pairs-all'] };
  for (const reason of reasons) for (const key of used[reason]) assert.ok(T.reason[key], `${reason}: ${key}`);
  for (const reason of reasons) assert.match(code, new RegExp(`why\\.reason === '${reason}'`), reason);
});

test('직접 만들기: 판 모양과 카드를 고르면 선생님이 어떤 합이 되는지 알려 주고, 공책에 남기거나 해 볼 수 있다', () => {
  const make = part('id="make-magic"', 'id="make-apart"');
  for (const id of ['magic-make-shapes', 'magic-make-count', 'magic-make-run', 'magic-make-clear', 'magic-make-shape', 'magic-make-board', 'magic-make-solve', 'magic-make-result', 'magic-make-picture', 'magic-make-play']) assert.ok(make.includes(`id="${id}"`), id);
  assert.match(make, /id="magic-make-solve"[^>]*>선생님, 어떤 합이 돼요\?</);
  assert.match(make, /id="magic-make-play"[^>]*>내가 해 볼래요</);
  assert.deepEqual([...make.matchAll(/data-figure="(\w+)"/g)].map((match) => match[1]), ['square', 'arms2', 'arms3', 'arms4']);
  assert.match(T.make.intro, /선생님에게 어떤 합이 되는지 물어볼 수 있어요\.$/);
  assert.equal(fill(T.make.need, { n: 7, k: 5 }), '카드를 7장 골라요. 지금은 5장이에요.');
  assert.equal(fill(T.make.square, { k: 18, total: 8 }), '줄마다 합이 18인 마법 네모가 돼요. 놓는 방법은 돌리고 뒤집은 것까지 8가지예요.');
  // 겹친 칸 판은 되는 합과 그때의 가운데 카드를 차례로 말한다(합마다 가운데 카드는 하나다)
  assert.equal(fill(T.make['sums-open'], { face: '10, 12, 14' }), '되는 합은 10, 12, 14예요.');
  assert.equal(fill(T.make['centers-closed'], { face: '1, 4, 7' }), '그때 가운데 카드는 차례로 1, 4, 7이에요.');
  assert.match(code, /const centers = result\.sums\.map\(\(item\) => item\.centers\[0\]\);/);
  for (const arms of [2, 3, 4]) for (const item of solve(hub(arms, null)).sums) assert.equal(item.centers.length, 1);
  // 만든 판은 안 될 수도 있는 판이고, 카드 수가 맞을 때만 공책에 남기거나 해 볼 수 있다
  assert.match(code, /const madeBoard = \(\) => draftBoard\(\);/);
  assert.match(code, /\n {4}madeBoard,\n/);
  assert.match(code, /if \(!draft \|\| draft\.cards\.length !== needOf\(draft\.figure\)\) return null;/);
  // 공책에서 가장 좋은 기록을 남기는 형식이 아니다
  assert.doesNotMatch(code, /bestOf/);
});

test('index.html: 이 형식의 카드, 판, 판 아래, 도구, 답하는 칸, 직접 만들기가 있다. 틀에 이어져 있다', () => {
  for (const id of ['home-magic-sample', 'home-magic-ask', 'home-magic-play', 'home-magic-pick', 'home-magic-make', 'home-magic-blank', 'magic-board', 'magic-count', 'magic-status', 'magic-dots', 'magic-pad', 'magic-target', 'magic-maybe', 'magic-impossible', 'make-magic']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(part('id="magic-title"', '</section>'), /<h2 id="magic-title">마법 네모와 겹친 칸<\/h2>/);
  assert.ok(visibleText(part('id="magic-title"', '</section>')).includes(T.home.ask['1']));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-magic-make" class="menu-item"/);
  assert.match(part('id="magic-pad"', 'id="domino-pad"'), /id="magic-impossible"[^>]*>불가능해요</);
  assert.match(part('id="magic-dots"', 'id="why"'), /aria-pressed="false" hidden>몇 번 세어지는지 보기</);
  // 카드는 조각 가짓수 찾기 다음, 닿지 않게 놓기와 구역 긋기 앞이다
  assert.ok(html.indexOf('id="pieces-title"') < html.indexOf('id="magic-title"'));
  assert.ok(html.indexOf('id="magic-title"') < html.indexOf('id="apart-title"'));
  // 틀이 형식을 안다(조각 가짓수 찾기 다음)
  assert.match(read('src/main.js'), /pieces: createPieces\(frame\), magic: createMagic\(frame\), /);
  assert.match(read('src/check-main.js'), /\['magic', '마법 네모와 겹친 칸'\]/);
  assert.match(read('src/core/smaller.js'), /pieces: smallerPieces, magic: smallerMagic, /);
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
  // 판이 넓어서 규칙 글은 왼쪽 칸 맨 위에 둔다. 무르기와 되돌리기가 있다
  assert.match(code, /ruleAside: true,/);
  assert.match(code, /\$\('undo'\)\.hidden = false;\s*\$\('reset'\)\.hidden = false;/);
  // 도구를 켜 본 판은 힌트 하나를 연 것으로 센다
  assert.match(code, /hintsOpened: round\.hintsOpened \+ \(round\.dotsShown \? 1 : 0\),/);
  // 판을 그리는 조각은 글을 받아 그릴 뿐 적지 않는다. 타이머가 없다. 끄는 것과 누르는 것을 모두 받는다
  assert.doesNotMatch(board, /setInterval|setTimeout/);
  for (const name of ['pointerdown', 'pointermove', 'pointerup', 'keydown', "'mg-ring'", "'mg-dot'", "'mg-ghost'", "'mg-over'"]) assert.ok(board.includes(name), name);
  const css = read('src/app.css');
  assert.match(css, /\.mg-spot \{[^}]*stroke-dasharray/);
  assert.match(css, /\.mg-sum\.same rect \{[^}]*stroke-width: 9/);
  assert.match(css, /\.mg-board\.live \.mg-svg \{[^}]*touch-action: none/);
  // 칸 하나는 화면에서 100px을 넘지 않는다
  assert.match(css, /\.mg-svg \{[^}]*max-width: calc\(var\(--w\) \* 100px\)/);
});

/** 끝까지 한 판의 기록 하나 */
function finished(more = {}) {
  return { kind: 'round', id: `r-${more.id ?? 1}`, format: 'magic', level: 1, seed: 1, custom: false, mode: 'sure', outcome: 'solved', hintsOpened: 0, answers: [{ t: 10, answer: 'place:1', correct: true, guess: null }], wrongCount: 0, moveCount: 20, seconds: 120, solution: { possible: true, count: 2592 }, ...more };
}

test('수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다. 되는 판에 "불가능해요"를 누른 판은 "한 번에"가 아니다', () => {
  const tuning = tuningFor('magic');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 5);
  assert.equal(tuning.hintCount, 2);
  assert.match(read('src/core/level.js'), /마법 네모와 겹친 칸\(모두 임시\)/);
  assert.deepEqual(recommend([], 'magic'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  assert.deepEqual(recommend([finished({ id: 1 }), finished({ id: 2 })], 'magic'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, wrongCount: 1 })], 'magic').offerHarder, false);
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, seconds: 400 })], 'magic').offerHarder, false);
  // "왜 그럴까?"는 판을 한 번 끝까지 한 뒤에 열린다
  assert.equal(whyUnlocked([], 'magic'), false);
  assert.equal(whyUnlocked([finished()], 'magic'), true);
  assert.equal(whyUnlocked([finished({ outcome: null })], 'magic'), false);
  // 줄의 수: 3×3의 줄 모음
  assert.deepEqual(['rows', 'rowscols', 'all', 'center'].map((lines) => linesOf(square(lines)).length), [3, 6, 8, 4]);
});
