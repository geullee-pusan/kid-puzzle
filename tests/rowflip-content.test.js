// 줄 뒤집기 판 대본 점검: 화면에 나오는 글이 약속을 지키는지, "왜 그럴까?"의 그림과 말이 다른 방법으로 센 것과 맞는지 본다.
// 한 일과 사실만 말한다(틀렸다고 하지 않는다), 힌트는 두 높이, 규칙은 세 문장 안, 색만으로 알리지 않는다, 0과 1의 줄을 보이지 않는다.
// 화면 코드와 틀에 이 형식이 이어져 있는지도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { LADDER, generateBoard } from '../src/core/rowflip-ladder.js';
import { MAX_SIDE, checkBoard } from '../src/core/rowflip.js';
import { fill, sentenceCount } from '../src/core/text.js';
import { bruteLines } from './helpers/brute-rowflip.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/rowflip.json'));
const html = read('index.html');
const code = read('src/formats/rowflip.js');
const board = read('src/ui/rowflip-board.js');
const css = read('src/app.css');

const VALUES = { k: 2, f: 3, n: 5, no: '첫 ', face: '검은 칸', total: 9 };
/** 그림과 판의 값은 글이 아니다 */
const DATA_KEYS = ['picture', 'blank', 'seed', 'rows', 'band', 'rect', 'level'];

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
const own = [part('id="rowflip-title"', 'id="foxrabbit-title"'), part('id="rowflip-pick"', 'id="foxrabbit-color"'), part('id="rowflip-count"', 'id="foxrabbit-count"'), part('id="rowflip-pad"', 'id="foxrabbit-pad"'), part('id="make-rowflip"', 'id="make-foxrabbit"')].map(visibleText).join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const said = strings.map(([, text]) => text).join(' ');

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 단계 목록이 사다리와 같다', () => {
  assert.equal(T.title, '줄 뒤집기 판');
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.deepEqual(T.levels.map((item) => item.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(T.levels.map((item) => item.name), ['작은 판', '3×3 판', '모서리 하나', '네 모서리', '큰 판의 한 구석', '직접 만들기']);
  for (const entry of T.levels.filter((item) => !item.picture.blank)) assert.equal(checkBoard(generateBoard(entry.level, entry.picture.seed).board), null);
  // 처음 화면의 물음은 판의 종류마다 있다
  assert.deepEqual(Object.keys(T.home.ask).sort(), ['block', 'corner', 'corners', 'grid', 'small']);
  assert.deepEqual(Object.keys(T.hints).sort(), ['block', 'corner', 'corners', 'grid', 'made', 'small']);
});

test('한 일과 사실만 말한다. 판정하는 말, 칭찬 낱말이 없다. 되는 판의 "불가능해요"에는 되는 판이라는 사실만 말한다', () => {
  assert.doesNotMatch(said, /틀렸|틀린|아니에요|땡|정답|아쉽|실수|실패|성공|잘했|훌륭|대단|최고|멋져|멋진|완벽|축하|천재|똑똑|굉장|맞아요|맞혔/);
  assert.doesNotMatch(own, /틀렸|틀린|아니에요|땡|아쉽|실패|잘했|훌륭|대단|최고|멋/);
  assert.match(T.play['possible-press'], /^이 판은 모두 흰 칸으로 만들 수 있어요\./);
  assert.match(T.play['possible-press-untried'], /^이 판은 모두 흰 칸으로 만들 수 있어요\./);
  assert.match(code, /frame\.say\(round\.moveCount === 0 \? T\.play\['possible-press-untried'\] : T\.play\['possible-press'\]\);/);
  // 되는 판은 모두 흰 칸이 되어야 끝난다. "불가능해요"로는 안 되는 판만 끝난다
  assert.match(code, /const correct = solution\.possible === false;/);
  assert.match(code, /if \(correct\) \{\s*frame\.finish\('solved'\);\s*return;\s*\}/);
  assert.match(code, /if \(isWhite\(after\)\) \{/);
  assert.equal([...code.matchAll(/frame\.finish\(/g)].length, 2);
  assert.doesNotMatch(code, /Math\.random/);
  assert.doesNotMatch(board, /Math\.random/);
  // 판 아래에는 뒤집은 횟수, 검은 칸의 수, 표시한 네 칸의 검은 칸 수만 적는다. 무른 수나 해 본 수는 적지 않는다
  for (const line of code.split('\n')) if (/textContent/.test(line)) assert.doesNotMatch(line, /undoCount|resetCount|loopCount|wrongCount|moveCount|impossibleCount|pickCount/, line.trim());
  assert.equal([...part('id="rowflip-count"', 'id="foxrabbit-count"').matchAll(/<strong/g)].length, 3);
  assert.match(visibleText(part('id="rowflip-count"', 'id="foxrabbit-count"')), /뒤집은 횟수\s+0\s+번/);
});

test('0과 1의 줄과 이진법을 보이지 않는다', () => {
  const banned = /이진|2진|진법|진수|비트|0과 1|[01]{4,}/;
  for (const [path, text] of strings) assert.doesNotMatch(text, banned, path);
  assert.doesNotMatch(own, banned);
  // 그림 판도 '#'와 '.'으로 적는다
  for (const slide of T.why) for (const item of slide.figures) for (const row of item.rows) assert.match(row, /^[#.]+$/);
});

test('무르기와 처음으로 뒤에는 앞의 말을 덮는 한마디를 한다', () => {
  assert.equal(T.play.undo, '무르기 전 모습으로 돌아왔어요.');
  assert.equal(T.play.reset, '처음 모습으로 돌아왔어요.');
  assert.match(code, /frame\.say\(T\.play\.undo\);/);
  assert.match(code, /frame\.say\(T\.play\.reset\);/);
  // 지나온 모습으로 돌아온 말은 한 판에 한 번만 한다
  assert.match(code, /if \(again && !round\.loopSaid\) \{\s*round\.loopSaid = true;\s*frame\.say\(T\.play\.loop\);/);
});

test('규칙 설명은 세 문장 안이다. 직접 만들기의 안내 글도 세 문장 안이다', () => {
  for (const ask of Object.values(T.asks)) assert.ok(sentenceCount(`${T.rules.flip} ${ask}`) <= 3);
  assert.equal(`${T.rules.flip} ${T.asks.maybe}`, '줄 끝의 화살표 단추를 누르면 그 줄이 통째로 뒤집혀요. 검은 칸은 흰 칸이, 흰 칸은 검은 칸이 돼요. 모두 흰 칸으로 만들 수 있을까요?');
  assert.match(code, /ruleLine: \(round\) => `\$\{T\.rules\.flip\} \$\{T\.asks\[hasImpossible\(round\) \? 'maybe' : 'grid'\]\}`,/);
  // 2단계(모두 되는 판)에는 "불가능해요" 단추가 없다
  assert.match(code, /const hasImpossible = \(round\) => round\.mode !== 'grid';/);
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 36);
  assert.ok(sentenceCount(guides[34]) <= 3, guides[34]);
  assert.match(guides[34], /^칸을 누르면 검은 칸이 되고, 다시 누르면 흰 칸이 돼요\./);
  assert.match(guides[34], /네 모서리가 모두 흰 칸인데도 안 되는 판을 만들 수 있을까요\?$/);
});

test('힌트는 판의 종류마다 두 개이고, 하나하나가 질문 한 문장이다. 힌트 1은 함께 쓰는 목록에서 고른다. 까닭은 힌트에 없다', () => {
  const common = ['끝에는 어떤 모양이 되어야 하나요?', '끝나기 바로 전에는 어떤 모양일까요?', '더 작은 판이라면 할 수 있을까요?', '전에 해 본 판 가운데 닮은 판이 있었나요?', '아까와 다른 곳에서 시작하면 어떻게 되나요?', '아직 한 번도 건드리지 않은 곳이 있나요?'];
  for (const [key, list] of Object.entries(T.hints)) {
    assert.equal(list.length, 2, key);
    assert.notEqual(list[0], list[1]);
    assert.ok(common.includes(list[0]), list[0]);
    for (const hint of list) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
      assert.doesNotMatch(hint, /때문|해야 해요|하면 돼요|늘 |\d|홀수|짝수|바뀌지 않는 것/, hint);
    }
  }
  // 2×2 판(더 작은 판이 없다)이 나오는 판의 힌트 1은 "더 작은 판"이 아니다
  for (const key of ['small', 'made']) assert.doesNotMatch(T.hints[key][0], /더 작은 판/);
  assert.match(code, /hints: \(round\) => T\.hints\[round\.mode\],/);
});

test('글의 빈칸({이름})은 정해진 이름만 쓰고, 채울 값이 모자라지 않는다', () => {
  const allowed = new Set(['k', 'f', 'n', 'no', 'total', 'level', 'tag', 'face']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
    assert.ok(fill(text, VALUES).length > 0, path);
  }
  assert.equal(fill(T.labels.cell, { no: '첫 ', k: 2, face: T.faces.black }), '위에서 첫 번째 줄, 왼쪽에서 2번째 칸, 검은 칸');
  assert.equal(fill(T.labels.row, { no: 3 }), '위에서 3번째 가로줄 뒤집기');
  assert.equal(fill(T.labels.col, { no: '첫 ' }), '왼쪽에서 첫 번째 세로줄 뒤집기');
  assert.equal(fill(T.right['done-back'], { k: 4, n: 2 }), '모두 흰 칸이 됐어요. 줄을 4번 뒤집었고, 2번 무르거나 되돌렸어요.');
  assert.equal(fill(T.right.reason, { n: 3 }), '테두리를 그린 네 칸에는 검은 칸이 3개예요.');
});

test('화면 글에 영어 낱말과 보상 낱말이 없고, "~요"로 끝나는 말투다. 한 문장은 60자를 넘지 않는다', () => {
  for (const [path, text] of strings) assert.doesNotMatch(text.replace(/\{[^{}]*\}/g, ''), /[A-Za-z]/, `${path}: ${text}`);
  assert.doesNotMatch(own, /[A-Za-z]/);
  assert.doesNotMatch(own, /별|점수|순위|레벨|연속/);
  const spoken = [...Object.values(T.home.ask), T.home.pick, T.rules.flip, ...Object.values(T.asks), ...Object.values(T.play), ...Object.values(T.hints).flat(), ...Object.values(T.right), T.solution.possible, T.solution.impossible, ...Object.entries(T.make).filter(([key]) => !['size', 'picture-possible', 'picture-impossible'].includes(key)).map(([, text]) => text), ...T.why.map((slide) => slide.say)];
  for (const text of spoken) for (const sentence of sentences(text)) assert.match(sentence, /요[.?!]$/, sentence);
  for (const text of Object.values(T.status)) assert.match(text, /요$/, text);
  for (const text of [T.make['picture-possible'], T.make['picture-impossible'], T.solution['reason-note']]) assert.match(text, /요$/, text);
  for (const slide of T.why) for (const item of slide.figures) assert.match(item.note, /요$/, item.note);
  for (const [path, text] of strings) for (const sentence of sentences(fill(text, VALUES))) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

/** 그림 판을 줄마다의 글로 들고 줄 하나를 뒤집는다(풀이 프로그램과 따로) */
function flipRows(rows, band) {
  const at = Number(band.slice(1));
  const swap = (ch) => (ch === '#' ? '.' : '#');
  if (band[0] === 'r') return rows.map((row, r) => (r === at ? [...row].map(swap).join('') : row));
  return rows.map((row) => [...row].map((ch, c) => (c === at ? swap(ch) : ch)).join(''));
}
const blackIn = (rows) => rows.join('').split('#').length - 1;
const rectBlack = (rows, [r1, c1, r2, c2]) => [rows[r1][c1], rows[r1][c2], rows[r2][c1], rows[r2][c2]].filter((ch) => ch === '#').length;
const cellsOf = (rows) => rows.flatMap((row) => [...row].map((ch) => Number(ch === '#')));

test('"왜 그럴까?": 검은 칸 수를 적어 가다 홀수가 그대로인 것을 알아챈다 → 한 줄에 두 칸(이름) → 큰 판의 2×2 네 칸 → 네 모서리가 짝수인데도 안 되는 판(다시 뒤집고 세어 본다)', () => {
  assert.equal(T.why.length, 4);
  for (const slide of T.why) assert.ok(sentenceCount(slide.say) <= 3, slide.say);
  const [first, second, third, fourth] = T.why;
  // 첫 장: 앞 그림에서 표시한 줄을 뒤집은 것이 다음 그림이고, 검은 칸의 수가 말과 그림 글에 적힌 대로다
  const counts = first.figures.map((item) => blackIn(item.rows));
  assert.deepEqual(counts, [1, 1, 3, 3, 1]);
  first.figures.slice(1).forEach((item, index) => assert.deepEqual(flipRows(first.figures[index].rows, item.band), item.rows));
  first.figures.forEach((item, index) => assert.match(item.note, new RegExp(`${counts[index]}개예요$`)));
  assert.match(first.say, /1개, 1개, 3개, 3개, 1개였어요\./);
  assert.match(first.say, /어, 홀수인 것은 계속 그대로네요\.$/);
  assert.equal(bruteLines(2, 2, cellsOf(first.figures[0].rows)).possible, false);
  // 둘째 장: 표시한 줄을 뒤집으면 2개 줄고, 2개 늘고, 그대로다. 이름은 여기서 처음 말한다
  const changes = second.figures.map((item) => blackIn(flipRows(item.rows, item.band)) - blackIn(item.rows));
  assert.deepEqual(changes, [-2, 2, 0]);
  assert.deepEqual(second.figures.map((item) => item.note), ['이 줄을 뒤집으면 2개 줄어요', '이 줄을 뒤집으면 2개 늘어요', '이 줄을 뒤집으면 그대로예요']);
  assert.match(second.say, /바뀌지 않는 것이라고 불러요\.$/);
  for (const [path, text] of strings) if (!path.startsWith('why[1]')) assert.doesNotMatch(text, /바뀌지 않는 것/, path);
  // 셋째 장: 큰 판의 2×2 네 칸. 표시한 줄을 뒤집은 것이 다음 그림이고, 네 칸의 검은 칸은 1, 1, 3개
  third.figures.slice(1).forEach((item, index) => assert.deepEqual(flipRows(third.figures[index].rows, item.band), item.rows));
  assert.deepEqual(third.figures.map((item) => rectBlack(item.rows, item.rect)), [1, 1, 3]);
  third.figures.forEach((item) => assert.match(item.note, new RegExp(`네 칸에 ${rectBlack(item.rows, item.rect)}개예요$`)));
  // 넷째 장: 같은 판. 네 모서리는 0개(짝수)인데 붙어 있는 네 칸 하나는 3개라 안 된다. 2×2 네 칸이 모두 짝수이면 늘 된다(풀이 프로그램 테스트가 4×4까지 모두 확인)
  assert.deepEqual(fourth.figures[0].rows, fourth.figures[1].rows);
  const rows = fourth.figures[0].rows;
  assert.deepEqual(fourth.figures[0].rect, [0, 0, rows.length - 1, rows[0].length - 1]);
  assert.equal(rectBlack(rows, fourth.figures[0].rect), 0);
  assert.equal(rectBlack(rows, fourth.figures[1].rect), 3);
  assert.deepEqual([fourth.figures[1].rect[2] - fourth.figures[1].rect[0], fourth.figures[1].rect[3] - fourth.figures[1].rect[1]], [1, 1]);
  assert.equal(bruteLines(4, 4, cellsOf(rows)).possible, false);
  assert.match(fourth.say, /네 모서리에 검은 칸이 짝수 개인데도 안 되는 판이 있었어요\./);
  assert.match(fourth.say, /붙어 있는 네 칸이 모두 짝수인 판은 직접 해 보면 늘 모두 흰 칸이 됐어요\.$/);
  assert.match(code, /return \{ \.\.\.board, marks, band: item\.band \?\? null \};/);
});

test('풀이와 직접 만들기: 되는 판은 가장 적게 뒤집는 차례, 안 되는 판은 까닭이 되는 네 칸을 보인다', () => {
  assert.equal(fill(T.solution.possible, { k: 3 }), '가장 적게 3번 뒤집으면 모두 흰 칸이 돼요. 한 가지 방법을 보여 줄게요.');
  assert.equal(fill(T.make.possible, { k: 2 }), '이 판은 모두 흰 칸으로 만들 수 있어요. 가장 적게 2번 뒤집으면 돼요.');
  assert.equal(fill(T.make.impossible, { n: 1 }), '이 판은 아무리 해도 모두 흰 칸이 될 수 없어요. 테두리를 그린 네 칸에 검은 칸이 1개예요.');
  assert.match(code, /made = \{ line, node: boardCard\(\{ \.\.\.board, lineMarks: result\.moves \}, T\.make\['picture-possible'\]\), marks: \[\] \};/);
  // 모두 흰 판은 해 보거나 공책에 남길 것이 없다
  assert.match(code, /if \(!draft \|\| isWhite\(draft\.cells\)\) return null;/);
  const make = part('id="make-rowflip"', 'id="make-foxrabbit"');
  for (const id of ['rowflip-make-w-fewer', 'rowflip-make-w', 'rowflip-make-w-more', 'rowflip-make-h-fewer', 'rowflip-make-h', 'rowflip-make-h-more', 'rowflip-make-clear', 'rowflip-make-board', 'rowflip-make-solve', 'rowflip-make-result', 'rowflip-make-play', 'rowflip-make-picture']) {
    assert.ok(make.includes(`id="${id}"`), id);
  }
  assert.match(make, /id="rowflip-make-solve"[^>]*>선생님, 풀어 보세요</);
  assert.match(make, /id="rowflip-make-play"[^>]*>내가 해 볼래요</);
  assert.match(code, /mode: custom \? 'made' : rungOf\(level\)\.mode,/);
  assert.match(code, /\n {4}madeBoard,\n/);
  assert.doesNotMatch(code, /bestOf/);
  assert.equal(MAX_SIDE, 5);
});

test('index.html: 이 형식의 카드, 판, 판 아래, 오른쪽 칸, 도구, 직접 만들기가 있다. 틀에 이어져 있다', () => {
  for (const id of ['home-rowflip-sample', 'home-rowflip-ask', 'home-rowflip-play', 'home-rowflip-pick', 'home-rowflip-make', 'home-rowflip-blank', 'rowflip-board', 'rowflip-count', 'rowflip-status', 'rowflip-flips', 'rowflip-black', 'rowflip-marked-line', 'rowflip-marked', 'rowflip-pad', 'rowflip-tool-box', 'rowflip-maybe', 'rowflip-impossible', 'rowflip-pick', 'make-rowflip']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(part('id="rowflip-title"', '</section>'), /<h2 id="rowflip-title">줄 뒤집기 판<\/h2>/);
  assert.ok(visibleText(part('id="rowflip-title"', '</section>')).includes(T.home.ask.small));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-rowflip-make" class="menu-item"/);
  assert.match(part('id="rowflip-pad"', 'id="foxrabbit-pad"'), /id="rowflip-impossible"[^>]*>불가능해요</);
  assert.match(part('id="rowflip-pick"', 'id="foxrabbit-color"'), /aria-pressed="false" hidden>네 칸 골라 보기</);
  assert.equal(T.tool.off, '네 칸 골라 보기');
  // 카드는 공정한 게임일까 다음, 퍼즐 만들기 앞이다
  assert.ok(html.indexOf('id="fair-title"') < html.indexOf('id="rowflip-title"'));
  assert.ok(html.indexOf('id="rowflip-title"') < html.indexOf('id="make-title"'));
  // 틀이 형식을 안다(공정한 게임일까 다음)
  assert.match(read('src/main.js'), /fair: createFair\(frame\), rowflip: createRowflip\(frame\), /);
  assert.match(read('src/check-main.js'), /\['rowflip', '줄 뒤집기 판'\]/);
  assert.match(read('src/core/smaller.js'), /fair: smallerFair, rowflip: smallerRowflip, /);
  assert.match(code, /smaller: \(round, turn\) => smallerRowflip\(\{ mode: round\.mode, board: round\.board \}, turn\),/);
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
  // 무르기와 되돌리기가 있다. 판이 정사각형에 가까워 규칙 글은 왼쪽 칸에 둔다
  assert.match(code, /\$\('undo'\)\.hidden = false;\s*\$\('reset'\)\.hidden = false;/);
  assert.match(code, /ruleAside: true,/);
  // 타이머가 없다(뒤집는 움직임은 css가 맡는다)
  assert.doesNotMatch(board + code, /setInterval|setTimeout|requestAnimationFrame/);
  // 도구를 처음 켜면 힌트 하나로 센다
  assert.match(code, /hintsOpened: round\.hintsOpened \+ \(round\.pickShown \? 1 : 0\),/);
});

test('화면: 뒤집기 단추와 칸이 44픽셀보다 크다. 검은 칸, 표시한 네 칸, 고른 칸, 뒤집은 줄은 색만이 아니라 모양으로도 보인다. 움직임은 0.4초 안이고 줄이는 설정을 따른다', () => {
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const unit = Number(board.match(/const UNIT = (\d+);/)[1]);
  const lane = Number(board.match(/const LANE = (\d+);/)[1]);
  const edge = Number(board.match(/const EDGE = (\d+);/)[1]);
  const radius = Number(board.match(/\{ cx, cy, r: (\d+) \}, 'rf-line-btn'/)[1]);
  // 판 칸은 1180×820 화면에서 높이 430픽셀쯤이다(규칙 글이 왼쪽 칸에 있다). 380픽셀로 잡아도 가장 큰 5×5 판(단추 자리 포함)에서
  const px = 380 / (MAX_SIDE * unit + lane + 2 * edge);
  assert.ok(2 * radius * px >= 44, `단추 ${2 * radius * px}`);
  assert.ok(unit * px >= 44, `칸 ${unit * px}`);
  // 단추는 줄 하나의 폭만큼 넓게 눌린다
  assert.match(board, /'rf-line-hit'/);
  // 검은 칸에는 흰 동그라미, 표시한 네 칸과 고른 칸과 뒤집은 줄은 점선
  assert.match(board, /'rf-dot'/);
  assert.match(plain, /\.rf-mark \{[^}]*stroke-dasharray/);
  assert.match(plain, /\.rf-pick \{[^}]*stroke-dasharray/);
  assert.match(plain, /\.rf-band \{[^}]*stroke-dasharray/);
  const [, seconds] = plain.match(/\.rf-turn \{[^}]*animation: rf-turn ([\d.]+)s/);
  assert.ok(Number(seconds) <= 0.4);
  assert.match(plain, /@media \(prefers-reduced-motion: reduce\) \{\s*\.rf-turn \{\s*animation: none;/);
  assert.match(visibleText(part('id="rowflip-pad"', 'id="foxrabbit-pad"')), /검은 칸에는 흰 동그라미가 찍혀 있어요\./);
});

/** 끝까지 한 판의 기록 하나 */
function finished(more = {}) {
  return { kind: 'round', id: `r-${more.id ?? 1}`, format: 'rowflip', level: 1, seed: 1, custom: false, mode: 'small', outcome: 'solved', hintsOpened: 0, answers: [{ t: 10, answer: 'done', correct: true, guess: null }], wrongCount: 0, moveCount: 1, seconds: 30, solution: { possible: true, min: 1, witness: null }, ...more };
}

test('수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다. "왜 그럴까?"는 안 되는 판을 한 번 끝까지 만난 뒤에 열린다', () => {
  const tuning = tuningFor('rowflip');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 5);
  assert.equal(tuning.hintCount, 2);
  assert.equal(tuning.whyAfter, undefined);
  assert.equal(tuning.fastWin, undefined);
  assert.match(read('src/core/level.js'), /줄 뒤집기 판\(모두 임시\)/);
  assert.deepEqual(recommend([], 'rowflip'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  assert.deepEqual(recommend([finished({ id: 1 }), finished({ id: 2 })], 'rowflip'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  // 되는 판에 "불가능해요"를 눌렀으면 "한 번에"가 아니다
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, wrongCount: 1 })], 'rowflip').offerHarder, false);
  assert.equal(whyUnlocked([finished()], 'rowflip'), false);
  const met = finished({ id: 3, seed: 2, answers: [{ t: 10, answer: 'impossible', correct: true, guess: null }], solution: { possible: false, min: null, witness: { r1: 0, c1: 0, r2: 1, c2: 1, kind: 'corners' } } });
  assert.equal(whyUnlocked([met], 'rowflip'), true);
  assert.equal(whyUnlocked([{ ...met, side: true }], 'rowflip'), false);
  assert.match(code, /round\.wrongCount \+= 1;/);
  assert.match(code, /solution: \{ possible: solution\.possible, min: solution\.min, witness: solution\.witness \},/);
});
