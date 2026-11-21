// 조각 가짓수 찾기 대본 점검: 화면에 나오는 글이 약속을 지키는지, "왜 그럴까?" 그림 속의 조각과 말이 풀이 프로그램과 맞는지 본다.
// 한 일과 사실만 말한다(틀렸다고 하지 않는다), 짐작하는 판에서는 끝날 때까지 몇 가지가 남았는지 말하지 않는다, 힌트는 두 높이,
// "왜 그럴까?"는 한 칸 작은 조각에 한 칸씩 빠짐없이 붙여 보는 이야기다(생각나는 대로 만들다 막힘 → 떼면 한 칸 작은 조각 → 거꾸로 붙이기 → 겹치는 것을 지우면 열두 가지),
// 화면 코드와 틀에 이 형식이 이어져 있는지도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { LADDER, MAKE_LEVEL } from '../src/core/pieces-ladder.js';
import { MAX_SIZE, connected, grownShapes, keyOf, piecesOf } from '../src/core/pieces.js';
import { fill, sentenceCount } from '../src/core/text.js';
import { linked, nameOf } from './helpers/brute-pieces.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/pieces.json'));
const html = read('index.html');
const code = read('src/formats/pieces.js');
const board = read('src/ui/pieces-board.js');

const VALUES = { k: 4, f: 1, n: 3, no: '세 칸', face: '다섯 칸', total: 12 };
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
const own = [part('id="pieces-title"', 'id="magic-title"'), part('id="pieces-sort"', 'id="magic-dots"'), part('id="pieces-count"', 'id="magic-count"'), part('id="pieces-pad"', 'id="magic-pad"'), part('id="make-pieces"', 'id="make-magic"')].map(visibleText).join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const said = strings.map(([, text]) => text).join(' ');
/** 그림의 모양(rows: 줄마다 #이 칸, +가 떼거나 붙이는 칸)을 칸들로 */
const cellsOf = (rows, marks = '#+') => rows.flatMap((row, y) => [...row].flatMap((mark, x) => (marks.includes(mark) ? [[x, y]] : [])));

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 단계 목록이 사다리와 같다', () => {
  assert.equal(T.title, '조각 가짓수 찾기');
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.deepEqual(T.levels.map((item) => item.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(T.levels.map((item) => item.name), ['세 칸과 네 칸 조각', '다섯 칸 조각은 몇 가지', '약속을 바꾸면 몇 가지', '가장 긴 줄로 나누어 찾기', '여섯 칸 조각 모두 찾기', '직접 만들기']);
  for (const rung of LADDER) assert.ok(T.home.ask[String(rung.level)], rung.level);
  for (const entry of T.levels) assert.ok(entry.picture.blank === true || Number.isInteger(entry.picture.seed), entry.name);
  // 크기의 말은 판에 나오는 모든 크기에 있다
  for (let n = 2; n <= 6; n++) assert.match(T.sizes[String(n)], /^[가-힣]+ 칸$/);
  // 조각에 글자 이름을 붙이지 않는다(영어 글자 이름이나 글자 모양 이름)
  assert.doesNotMatch(said, /[A-Za-z]자|티자|엘자|일자 조각/);
});

test('한 일과 사실만 말한다. 판정하는 말과 칭찬 낱말이 없다', () => {
  assert.doesNotMatch(said, /틀렸|틀린|아니에요|땡|정답|아쉽|실수|실패|성공|잘했|훌륭|대단|최고|멋져|멋진|완벽|축하|천재|똑똑|굉장|맞아요|맞혔/);
  assert.doesNotMatch(own, /틀렸|틀린|아니에요|땡|아쉽|실패|잘했|훌륭|대단|최고|멋/);
  assert.equal(fill(T.play.flip, { no: '첫 ' }), '첫 번째로 찾은 조각과 같아요. 뒤집으면 겹쳐요.');
  assert.equal(fill(T.play.turn, { no: 3 }), '3번째로 찾은 조각과 같아요. 돌리면 겹쳐요.');
  assert.equal(fill(T.play.same, { no: 2 }), '2번째로 찾은 조각과 같아요. 옮기기만 하면 겹쳐요.');
  assert.equal(fill(T.play['flip-new'], { no: '첫 ', k: 2 }), '뒤집으면 첫 번째로 찾은 조각과 겹쳐요. 이 판에서는 다른 조각으로 쳐요. 지금까지 2가지예요.');
  assert.equal(fill(T.play.apart, {}), '떨어진 칸이 있어요. 칸이 모두 변으로 이어져야 해요.');
  assert.equal(fill(T.play.short, { face: '다섯 칸', k: 3 }), '다섯 칸 조각인데 지금은 3칸이에요.');
  assert.equal(fill(T.play.row, { no: '네 칸', face: '세 칸' }), '이 조각은 가장 긴 줄이 네 칸이에요. 가장 긴 줄이 세 칸인 조각을 찾는 판이에요.');
  // 같은 조각이면 겹쳐 보이고 선반에 놓지 않는다. 다 찾으면 끝난다
  assert.match(code, /if \(match && match\.counted\) \{[\s\S]*?round\.compare = \{ cells, at: match\.at, turn: match\.turn, how: match\.how, counted: true \};[\s\S]*?return;\s*\}/);
  assert.match(code, /if \(round\.found\.length >= solution\.total\) \{\s*frame\.finish\('solved'\);\s*return;\s*\}/);
  assert.doesNotMatch(code, /Math\.random/);
  // 판 아래와 오른쪽 칸에는 할 일과 찾은 수만 적는다(몇 번 올려놓았는지, 같은 조각이 몇 번이었는지 적지 않는다)
  for (const line of code.split('\n')) if (/textContent/.test(line)) assert.doesNotMatch(line, /moveCount|putCount|sameCount|apartCount|shortCount|rowCount|sortCount|replayCount|tries\.length/, line.trim());
});

test('짐작하는 판에서는 끝날 때까지 몇 가지인지 말하지 않는다. 알려 주는 판에서만 모두 몇 가지인지 쓴다', () => {
  // 규칙: 알려 주는 판과 줄을 정한 판만 {total}이 있다
  for (const key of ['guess', 'turn', 'fixed']) assert.doesNotMatch(T.rules[key], /\{total\}|\{n\}|\{k\}/, key);
  for (const key of ['guess', 'turn', 'fixed']) assert.match(T.rules[key], /모두 몇 가지일까요\?/, key);
  for (const key of ['told', 'row']) assert.match(T.rules[key], /모두 \{total\}가지예요\.$/, key);
  // 찾은 조각의 줄: 짐작하는 판은 찾은 수만, 알려 주는 판은 모두 몇 가지인지도
  assert.equal(T.shelf.title, '찾은 조각 {k}가지');
  assert.match(T.shelf.told, /\{n\}/);
  assert.match(code, /round\.board\.tell \? fill\(T\.shelf\.told, \{ k, n: solution\.total \}\) : fill\(T\.shelf\.title, \{ k \}\)/);
  // 찾을 때마다 하는 말에는 찾은 수만 있다. "여기까지 할래요"로 끝낸 말에도 모두 몇 가지인지 없다
  for (const key of ['found', 'turn-new', 'flip-new']) assert.doesNotMatch(T.play[key], /\{n\}|\{total\}/, key);
  assert.equal(fill(T.right.stopped, { face: '다섯 칸', k: 7 }), '다섯 칸 조각을 7가지 찾았어요. 여기까지 했어요.');
  assert.match(code, /if \(round\.stopped\) parts\.push\(fill\(T\.right\.stopped, \{ face, k: round\.found\.length \}\)\);/);
  // 약속을 바꾼 판은 다 찾았을 때만 하나로 친 가짓수를 견주어 말한다
  assert.match(code, /if \(!round\.stopped && board\.rule !== 'free'\) parts\.push\(fill\(T\.right\.free, \{ n: solution\.free \}\)\);/);
  // 짐작한 수는 끝난 뒤에 견주어 말할 뿐 판정하지 않는다
  assert.equal(fill(`${T.right.guess} ${T.right.guessed}`, { face: '다섯 칸', k: 12, n: 10 }), '다섯 칸 조각은 모두 12가지예요. 하나도 빠뜨리지 않고 찾았어요. 처음에는 10가지라고 짐작했어요.');
  assert.equal(fill(T.right.free, { n: 5 }), '돌리고 뒤집어 같은 것을 하나로 치면 5가지예요.');
});

test('규칙 설명은 세 문장 안이다. 판의 종류마다 있고, 직접 만들기의 안내 글도 세 문장 안이다', () => {
  assert.deepEqual(Object.keys(T.rules).sort(), ['fixed', 'guess', 'row', 'told', 'turn']);
  for (const [key, rule] of Object.entries(T.rules)) assert.ok(sentenceCount(fill(rule, VALUES)) <= 3, key);
  assert.match(T.rules.told, /돌리거나 뒤집어 겹치는 것은 같은 조각이에요\./);
  assert.match(T.rules.turn, /뒤집어야 겹치는 것은 다른 조각으로 쳐요\./);
  assert.match(T.rules.fixed, /돌리거나 뒤집어야 겹치는 것은 다른 조각으로 쳐요\./);
  assert.match(T.rules.row, /줄은 가로나 세로로 곧게 이어진 칸이에요\./);
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 42);
  assert.ok(sentenceCount(guides[23]) <= 3, guides[23]);
  assert.match(guides[23], /^칸 수와 같은 조각의 약속을 정해요\./);
  assert.match(guides[23], /약속을 바꾸면 가짓수는 얼마나 달라질까요\?$/);
});

test('힌트는 판의 종류마다 두 개이고, 하나하나가 질문 한 문장이다. 무엇이 빠졌는지 말해 버리지 않는다', () => {
  assert.deepEqual(Object.keys(T.hints).sort(), ['fixed', 'guess', 'row', 'told', 'turn']);
  for (const [key, list] of Object.entries(T.hints)) {
    assert.equal(list.length, 2, key);
    assert.notEqual(list[0], list[1]);
    for (const hint of list) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
      assert.doesNotMatch(hint, /때문|해야 해요|하면 돼요|늘 |\d/, hint);
    }
  }
  // 줄로 묶어 빠진 곳을 찾는 물음은 묻기만 한다
  assert.equal(T.hints.guess[1], '가장 긴 줄이 몇 칸인 묶음에 빠진 조각이 있을까요?');
  assert.match(code, /hints: \(round\) => T\.hints\[kindOf\(round\.board\)\],/);
});

test('글의 빈칸({이름})은 정해진 이름만 쓰고, 채울 값이 모자라지 않는다', () => {
  const allowed = new Set(['k', 'f', 'n', 'no', 'total', 'level', 'tag', 'face']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
    assert.ok(fill(text, VALUES).length > 0, path);
  }
  assert.equal(fill(T.rules.row, { no: '세 칸', face: '다섯 칸', total: 8 }), '가장 긴 줄이 세 칸인 다섯 칸 조각을 모두 찾아요. 줄은 가로나 세로로 곧게 이어진 칸이에요. 모두 8가지예요.');
  assert.equal(fill(T.rules.told, { face: '네 칸', total: 5 }).split('. ')[2], '네 칸 조각은 모두 5가지예요.');
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
    T.guess.ask,
    ...Object.entries(T.make)
      .filter(([key]) => key !== 'size')
      .map(([, text]) => text),
    ...T.why.map((slide) => slide.say),
  ];
  for (const text of spoken) for (const sentence of sentences(text)) assert.match(sentence, /요[.?!]?$/, sentence);
  for (const text of Object.values(T.status)) assert.match(text, /요$/, text);
  for (const slide of T.why) for (const item of slide.figures) assert.match(item.note, /요$/, item.note);
  for (const [path, text] of strings) for (const sentence of sentences(fill(text, VALUES))) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

test('"왜 그럴까?"는 그림 넷의 알아챈 이야기다. 그림 속의 조각과 말이 풀이 프로그램과 같다', () => {
  assert.equal(T.why.length, 4);
  for (const slide of T.why) assert.ok(sentenceCount(slide.say) <= 3, slide.say);
  const [one, two, three, four] = T.why.map((slide) => slide.figures.map((item) => item.rows));
  // 첫 장: 생각나는 대로 만든 다섯 칸 조각 셋(서로 다르다)
  const first = cellsOf(one[0]);
  assert.equal(first.length, 15);
  // 떨어진 덩어리 셋으로 나눈다
  const groups = [];
  for (const cell of first) {
    const near = groups.find((group) => group.some(([x, y]) => Math.abs(x - cell[0]) + Math.abs(y - cell[1]) === 1));
    if (near) near.push(cell);
    else groups.push([cell]);
  }
  assert.equal(groups.length, 3);
  for (const group of groups) assert.ok(group.length === 5 && linked(group));
  assert.equal(new Set(groups.map((group) => nameOf(group))).size, 3);
  // 둘째 장: 다섯 칸 조각에서 점선 칸을 떼면 이어진 네 칸 조각이 남는다. 그리고 어느 다섯 칸 조각이든 그런 칸이 있다
  const whole = cellsOf(two[0]);
  const left = cellsOf(two[0], '#');
  assert.equal(whole.length, 5);
  assert.ok(linked(whole) && left.length === 4 && linked(left));
  assert.match(T.why[1].say, /어느 다섯 칸 조각이든 그런 칸이 있어요\.$/);
  for (const cells of piecesOf(5)) assert.ok(cells.some((cell) => linked(cells.filter((other) => other !== cell))));
  // 셋째 장: 네 칸 한 줄에 붙인 세 모습은 서로 다른 조각이고, 한 줄에 붙여 나오는 조각은 그 셋뿐이다. 네 칸 조각은 다섯 가지이고, 모두에 붙이면 다섯 칸 조각이 모두 나온다
  const line = [[0, 0], [1, 0], [2, 0], [3, 0]];
  for (const rows of three) {
    assert.deepEqual(cellsOf(rows, '#').map(String).sort(), line.map(String).sort());
    assert.equal(cellsOf(rows, '+').length, 1);
  }
  const fromLine = new Set(grownShapes(line).map((cells) => keyOf(cells)));
  assert.deepEqual(new Set(three.map((rows) => keyOf(cellsOf(rows)))), fromLine);
  assert.equal(fromLine.size, 3);
  assert.match(T.why[2].say, /네 칸 조각 다섯 가지/);
  assert.equal(piecesOf(4).length, 5);
  assert.equal(new Set(piecesOf(4).flatMap(grownShapes).map((cells) => keyOf(cells))).size, piecesOf(5).length);
  // 넷째 장: 다른 네 칸 조각에 붙였는데 같은 조각이 나왔다(돌리면 겹친다). 하나로 치면 열두 가지
  const [a, b] = four.map((rows) => cellsOf(rows));
  const [baseA, baseB] = four.map((rows) => cellsOf(rows, '#'));
  assert.equal(nameOf(a), nameOf(b));
  assert.notEqual(nameOf(a, 'fixed'), nameOf(b, 'fixed'));
  assert.notEqual(nameOf(baseA), nameOf(baseB));
  assert.match(T.why[3].say, /열두 가지가 남았어요\.$/);
  assert.equal(piecesOf(5).length, 12);
  // 이야기는 모든 판에 있고, 판을 한 번 끝까지 한 뒤에 열린다
  assert.match(code, /function whyPages\(\) \{\n\s*return T\.why\.map/);
  assert.equal(tuningFor('pieces').whyAfter, 'finished');
  assert.ok(connected(a));
});

test('직접 만들기: 칸 수와 같은 조각의 약속을 정하면 선생님이 세어 모두 그리고, 공책에 남기거나 해 볼 수 있다', () => {
  const make = part('id="make-pieces"', 'id="make-magic"');
  for (const id of ['pieces-make-fewer', 'pieces-make-n', 'pieces-make-more', 'pieces-make-limit', 'pieces-make-rules', 'pieces-make-board', 'pieces-make-solve', 'pieces-make-result', 'pieces-make-play']) assert.ok(make.includes(`id="${id}"`), id);
  assert.match(make, /id="pieces-make-solve"[^>]*>선생님, 몇 가지예요\?</);
  assert.match(make, /id="pieces-make-play"[^>]*>내가 해 볼래요</);
  assert.deepEqual([...make.matchAll(/data-rule="(\w+)"/g)].map((match) => match[1]), ['free', 'turn', 'fixed']);
  assert.match(T.make.intro, /선생님에게 모두 몇 가지인지 물어볼 수 있어요\.$/);
  assert.equal(fill(T.make.limit, { face: '네 칸' }), '이 약속으로는 네 칸 조각까지 정할 수 있어요.');
  assert.deepEqual(MAX_SIZE, { free: 6, turn: 5, fixed: 4 });
  // 만든 판은 먼저 짐작하는 판이다
  assert.match(code, /const madeBoard = \(\) => \(draft \? \{ n: draft\.n, rule: draft\.rule, row: null, tell: false \} : null\);/);
  assert.match(code, /\n {4}madeBoard,\n/);
  assert.match(code, /bestOf: \(round\) => \(round\.found\.length === 0 \? null : \{ value: round\.found\.length, name: fill\(T\.notebook\.best, \{ face: sizeWord\(round\.board\.n\), k: round\.found\.length \}\) \}\),/);
  assert.equal(fill(T.notebook.best, { face: '여섯 칸', k: 20 }), '여섯 칸 조각 20가지');
  assert.equal(MAKE_LEVEL, 6);
});

test('index.html: 이 형식의 카드, 판, 판 아래, 도구, 답하는 칸, 직접 만들기가 있다. 틀에 이어져 있다', () => {
  for (const id of ['home-pieces-sample', 'home-pieces-ask', 'home-pieces-play', 'home-pieces-pick', 'home-pieces-make', 'home-pieces-blank', 'pieces-board', 'pieces-count', 'pieces-status', 'pieces-again', 'pieces-back', 'pieces-sort', 'pieces-pad', 'pieces-guess-box', 'pieces-guess-ask', 'pieces-typed', 'pieces-keys', 'pieces-guess-go', 'pieces-find-box', 'pieces-guess-line', 'pieces-put', 'pieces-clear', 'pieces-shelf-title', 'pieces-shelf', 'pieces-stop', 'make-pieces']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(part('id="pieces-title"', '</section>'), /<h2 id="pieces-title">조각 가짓수 찾기<\/h2>/);
  assert.ok(visibleText(part('id="pieces-title"', '</section>')).includes(T.home.ask['1']));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-pieces-make" class="menu-item"/);
  assert.match(part('id="pieces-find-box"', 'id="domino-pad"'), /id="pieces-put"[^>]*>올려놓기</);
  assert.match(part('id="pieces-find-box"', 'id="domino-pad"'), /id="pieces-stop"[^>]*hidden>여기까지 할래요</);
  assert.match(part('id="pieces-guess-box"', 'id="pieces-find-box"'), /id="pieces-guess-go"[^>]*>이만큼일 것 같아요</);
  assert.match(part('id="pieces-sort"', 'id="why"'), /aria-pressed="false" hidden>가장 긴 줄로 묶어 보기</);
  assert.match(part('id="pieces-count"', 'id="domino-count"'), /id="pieces-back"[^>]*>모눈으로</);
  // 카드는 도미노 가로세로 다음, 마법 네모와 겹친 칸 앞이다
  assert.ok(html.indexOf('id="domino-title"') < html.indexOf('id="pieces-title"'));
  assert.ok(html.indexOf('id="pieces-title"') < html.indexOf('id="magic-title"'));
  // 틀이 형식을 안다(도미노 가로세로 다음)
  assert.match(read('src/main.js'), /domino: createDomino\(frame\), pieces: createPieces\(frame\), /);
  assert.match(read('src/check-main.js'), /\['pieces', '조각 가짓수 찾기'\]/);
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
  assert.doesNotMatch(code, /hintsOpened/);
  // 무르기와 되돌리기는 이 형식에 없다
  assert.match(code, /\$\('undo'\)\.hidden = true;\s*\$\('reset'\)\.hidden = true;/);
  // 판을 그리는 조각은 글을 받아 그릴 뿐 적지 않는다. 겹칠 자리는 점선, 가장 긴 줄은 막대, 찾지 못한 조각은 점선 테두리
  for (const name of ["'pc-target'", "'pc-moving'", "'pc-row'", "'pc-added'", 'missed']) assert.ok(board.includes(name), name);
  const css = read('src/app.css');
  assert.match(css, /\.pc-target rect \{[^}]*stroke-dasharray/);
  assert.match(css, /\.pc-family-item\.missed \{[^}]*dashed/);
  assert.match(css, /\.pc-piece rect\.pc-added \{[^}]*stroke-dasharray/);
  // 모눈의 칸은 화면에서 한 칸이 96px을 넘지 않는다(여섯 칸 판 7×6도 손가락에 맞는 크기다)
  assert.match(css, /\.pc-grid-svg \{[^}]*max-width: calc\(var\(--w\) \* 96px\)/);
  // 겹쳐 보이는 움직임은 화면 코드의 시간 재촉이 아니다(움직임 한 번, 타이머 없음)
  assert.doesNotMatch(board, /setInterval|setTimeout/);
  assert.match(board, /prefers-reduced-motion/);
});

/** 끝까지 한 판의 기록 하나 */
function finished(more = {}) {
  return { kind: 'round', id: `r-${more.id ?? 1}`, format: 'pieces', level: 1, seed: 2, custom: false, mode: 'find', outcome: 'solved', hintsOpened: 0, answers: [{ t: 10, answer: 'piece:1', correct: true, guess: null }], wrongCount: 0, moveCount: 20, seconds: 120, solution: { possible: true, total: 5 }, ...more };
}

test('수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다. "여기까지 할래요"로 끝낸 판은 "한 번에"가 아니다', () => {
  const tuning = tuningFor('pieces');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 5);
  assert.equal(tuning.hintCount, 2);
  assert.match(read('src/core/level.js'), /조각 가짓수 찾기\(모두 임시\)/);
  assert.deepEqual(recommend([], 'pieces'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  assert.deepEqual(recommend([finished({ id: 1 }), finished({ id: 2 })], 'pieces'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  // 찾지 못한 조각을 남기고 끝냈으면(wrongCount가 그 수) 올라가기를 권하지 않는다
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, stopped: true, wrongCount: 3 })], 'pieces').offerHarder, false);
  assert.match(code, /wrongCount: round\.stopped \? missing : 0,/);
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, seconds: 400 })], 'pieces').offerHarder, false);
  // "왜 그럴까?"는 판을 한 번 끝까지 한 뒤에 열린다
  assert.equal(whyUnlocked([], 'pieces'), false);
  assert.equal(whyUnlocked([finished()], 'pieces'), true);
  assert.equal(whyUnlocked([finished({ outcome: null })], 'pieces'), false);
});
