// 똑같이 섞이게 자르기 대본 점검: 화면에 나오는 글이 약속을 지키는지, 그림 속의 판과 선과 수와 주장이 풀이 프로그램과 맞는지 본다.
// 비, 비율이라는 말을 쓰지 않는다, 되는 판에 "불가능해요"를 눌러도 틀렸다고 하지 않는다, 몇 번 잘랐는지 판 아래에 적지 않는다, 힌트는 두 높이,
// "왜 그럴까?"는 알아챈 이야기(두 조각을 맞추니 셋째도 맞았다 → 빼고 남은 것 → 첫 선 → 묶음이 넉넉해도 안 되는 판),
// 화면 코드와 틀에 이 형식이 이어져 있는지도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { LADDER, MAKE_LEVEL, generateBoard, rungOf } from '../src/core/split-ladder.js';
import { applyCuts, checkBoard, cutDone, evenLines, mixOf, pieceCounts, solve } from '../src/core/split.js';
import { fill, sentenceCount } from '../src/core/text.js';
import { bruteSolve } from './helpers/brute-split.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/split.json'));
const html = read('index.html');
const code = read('src/formats/split.js');
const board = read('src/ui/split-board.js');

const VALUES = { k: 1, f: 2, n: 2, no: 3, face: T.edgeState.cut, total: 4 };
/** 그림의 값은 글이 아니다 */
const DATA_KEYS = ['rows', 'parts', 'cuts', 'lines', 'hide', 'picture', 'blank', 'w', 'h', 'grey', 'd', 'at', 'i'];

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
const own = [part('id="split-title"', 'id="make-title"'), part('id="split-board"', 'class="board-foot"'), part('id="split-count"', 'id="rooms-count"'), part('id="split-pad"', 'id="rooms-pad"'), part('id="make-split"', '<script')]
  .map(visibleText)
  .join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const figures = T.why.flatMap((slide) => slide.figures);
const boardOf = (item) => {
  const w = item.rows[0].length;
  const grey = [];
  item.rows.forEach((row, y) => [...row].forEach((ch, x) => ch === '#' && grey.push(y * w + x)));
  return { w, h: item.rows.length, grey, parts: item.parts };
};

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 단계 목록이 사다리와 같다', () => {
  assert.equal(T.title, '똑같이 섞이게 자르기');
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.deepEqual(T.levels.map((item) => item.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(T.levels.map((item) => item.name), ['반반 섞인 판', '회색 한 칸에 흰 칸 여럿', '안 되는 판도 섞여요', '자르는 방법 모두 찾기', '선 세 개로 네 조각', '직접 만들기']);
  for (const rung of LADDER) assert.ok(T.home.ask[rung.mode], rung.level);
});

test('비, 비율이라는 말을 쓰지 않고 "회색 몇 칸에 흰 칸 몇 칸씩"으로 말한다', () => {
  for (const [path, text] of strings) assert.doesNotMatch(text, /비율|(^|[\s(])비(가|를|는|와|로|가 |\s|$)|분수|약분|최대공약수|공약수/, `${path}: ${text}`);
  assert.doesNotMatch(own, /비율|분수|약분|공약수/);
  for (const key of ['cut', 'mix', 'count', 'four', 'made']) assert.match(T.rules[key], /판 전체는 회색 \{k\}칸에 흰 칸 \{n\}칸씩 섞여 있어요\./, key);
  assert.equal(fill(T.rules.cut, { k: 1, n: 2 }).split('. ')[0], '판 전체는 회색 1칸에 흰 칸 2칸씩 섞여 있어요');
  // 형식이 한 묶음의 수(판 전체를 가장 큰 공약수로 나눈 수)로 채운다
  assert.match(code, /return \{ k: mix\.unitGrey, n: mix\.unitWhite \};/);
});

test('규칙 설명은 세 문장 안이다. 안 되는 판이 섞이는 판만 "불가능해요"를 말한다. 직접 만들기의 안내 글도 세 문장 안이다', () => {
  assert.deepEqual(Object.keys(T.rules).sort(), ['count', 'cut', 'four', 'made', 'mix']);
  for (const [key, rule] of Object.entries(T.rules)) assert.ok(sentenceCount(fill(rule, VALUES)) <= 3, key);
  for (const key of ['mix', 'four', 'made']) assert.match(T.rules[key], /‘불가능해요’를 눌러요\.$/, key);
  for (const key of ['cut', 'count']) assert.doesNotMatch(T.rules[key], /불가능해요/, key);
  assert.match(T.rules.count, /방법이 \{total\}가지 있어요\. 모두 찾아보세요\.$/);
  assert.match(T.rules.four, /선 세 개로/);
  assert.match(code, /const ruleKey = \(round\) => \(round\.custom \? 'made' : round\.mode\);/);
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 32);
  assert.ok(sentenceCount(guides[18]) <= 3, guides[18]);
  assert.match(guides[18], /아무리 잘라도 안 되는 판도 만들 수 있을까요\?$/);
});

test('틀렸다고 하지 않고 사실만 말한다. 되는 판의 "불가능해요"에는 방법이 있다는 사실만, 다르게 섞인 조각에는 그 조각의 수와 판 전체의 꼴만', () => {
  const said = strings.map(([, text]) => text).join(' ');
  assert.doesNotMatch(said, /틀렸|틀린|아니에요|땡|정답|아쉽|실수|실패|성공|잘했|훌륭|대단|최고|멋져|멋진|완벽|축하|천재|똑똑|굉장/);
  assert.doesNotMatch(own, /틀렸|틀린|아니에요|땡|아쉽|실패|잘했|훌륭|대단|최고|멋/);
  assert.equal(T.play['possible-press'], '이 판에는 조각마다 똑같이 섞이게 자르는 방법이 있어요. 더 잘라 볼 수 있어요.');
  assert.equal(fill(T.play.uneven, { k: 5, n: 4, f: 1, total: 1 }), '점선을 두른 조각은 회색 5칸, 흰 칸 4칸이에요. 판 전체의 회색 1칸에 흰 칸 1칸씩과 견주어 볼까요?');
  assert.match(T.play['uneven-same'], /^아까와 같은 자르기예요\./);
  // 되는 판에 누른 "불가능해요"는 판을 끝내지 않는다(기록에는 남는다). 조각이 모두 똑같이 섞이면 판이 저절로 끝난다.
  assert.match(code, /const correct = solution\.possible === false;/);
  assert.match(code, /if \(correct\) \{\s*frame\.finish\('solved'\);\s*return;\s*\}/);
  assert.match(code, /round\.impossibleCount \+= 1;/);
  assert.match(code, /if \(even && round\.mode !== 'count'\) \{\n[^\n]*round\.answers\.push[^\n]*\n[^\n]*\n\s*frame\.finish\('solved'\);/);
  // 같은 자르기를 다시 해도 틀린 답으로 두 번 세지 않는다
  assert.match(code, /const fresh = !round\.tries\.includes\(key\);/);
  assert.doesNotMatch(code, /Math\.random/);
});

test('판 아래에는 더 그을 선의 수와 판 전체의 회색 수, 흰 칸 수만 적는다(몇 번 잘랐는지는 적지 않는다). 색만으로 알리지 않는다', () => {
  const foot = part('id="split-count"', 'id="rooms-count"');
  assert.deepEqual([...foot.matchAll(/<strong id="([\w-]+)"/g)].map((match) => match[1]), ['split-grey', 'split-white']);
  assert.match(visibleText(foot), /판 전체: 회색\s+0\s+칸, 흰 칸\s+0\s+칸/);
  assert.doesNotMatch(visibleText(foot), /번|횟수/);
  for (const [path, text] of strings.filter(([key]) => key.startsWith('status.'))) assert.doesNotMatch(text, /번/, path);
  for (const line of code.split('\n')) if (/textContent/.test(line)) assert.doesNotMatch(line, /strokeCount|cutCount|eraseCount|undoCount|wrongCount|impossibleCount|tries/, line.trim());
  // 회색 칸은 빗금, 조각의 수 옆에는 빗금 친 네모와 빈 네모, 다르게 섞인 조각은 점선, 짚는 선은 굵은 점선
  for (const name of ["'sp-hatch'", "'sp-swatch-hatch'", "'sp-uneven'", "'sp-line'", "'sp-cut'"]) assert.ok(board.includes(name), name);
  const css = read('src/app.css');
  assert.match(css, /\.sp-uneven \{[^}]*stroke-dasharray/);
  assert.match(css, /\.sp-line \{[^}]*stroke-dasharray/);
  // 판을 그리는 조각은 수와 물음표만 그린다(글은 대본에)
  assert.match(board, /addEventListener\('pointermove'/);
});

test('힌트는 판의 종류마다 두 개이고, 하나하나가 질문 한 문장이다. 까닭을 말해 버리지 않는다', () => {
  assert.deepEqual(Object.keys(T.hints).sort(), ['count', 'cut', 'four', 'mix']);
  for (const rung of LADDER.filter((item) => item.mode !== 'make')) assert.ok(T.hints[rung.mode], rung.level);
  for (const [key, list] of Object.entries(T.hints)) {
    assert.equal(list.length, 2, key);
    assert.notEqual(list[0], list[1]);
    for (const hint of list) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
      assert.doesNotMatch(hint, /때문|안 돼요|해야 해요|하면 돼요|묶음|저절로/, hint);
    }
  }
  // 힌트 2는 볼 곳(끝에서 끝까지 자르는 첫 선)을 가리킨다
  for (const key of ['mix', 'count', 'four']) assert.match(T.hints[key][1], /끝에서 끝까지/, key);
  assert.match(code, /hints: \(round\) => T\.hints\[round\.mode\],/);
  assert.match(code, /mode: custom \? \(start\.parts === 4 \? 'four' : 'mix'\) : rungOf\(level\)\.mode,/);
});

test('글의 빈칸({이름})은 정해진 이름만 쓰고, 채울 값이 모자라지 않는다', () => {
  const allowed = new Set(['k', 'f', 'n', 'no', 'total', 'level', 'tag', 'face']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
    assert.ok(fill(text, VALUES).length > 0, path);
  }
  assert.equal(fill(T.edgeLabel.v, { no: 3, n: '첫 ', face: T.edgeState.open }), '왼쪽에서 3번째 세로 선, 위에서 첫 번째 칸 옆, 자르지 않은 선');
  assert.equal(fill(T.solution.reasons.groups, { k: 7, n: 11, no: 1, total: 3 }), '회색 7칸과 흰 칸 11칸이 한 묶음이에요. 판 전체에 묶음이 1개뿐이라 조각 3개에 하나씩 줄 수 없어요.');
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
    T.solution.possible,
    T.solution.count,
    T.solution.impossible,
    T.solution.more,
    ...Object.values(T.solution.reasons),
    ...Object.entries(T.make)
      .filter(([key]) => !['size', 'count'].includes(key))
      .map(([, text]) => text),
    ...T.why.map((slide) => slide.say),
  ];
  for (const text of spoken) for (const sentence of sentences(text)) assert.match(sentence, /요[.?!]?$/, sentence);
  for (const text of Object.values(T.status)) assert.match(text, /요$|개$/, text);
  for (const item of figures) assert.match(item.note, /요$/, item.note);
  for (const [path, text] of strings) for (const sentence of sentences(text)) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

test('까닭(묶음, 끝에서 끝까지의 첫 선)은 "왜 그럴까?", 풀이, 직접 만들기, 힌트에서만 말한다', () => {
  for (const [path, text] of strings) {
    if (/^(why|solution|make|hints)/.test(path)) continue;
    assert.doesNotMatch(text, /묶음|첫 선|저절로/, `${path}: ${text}`);
  }
  assert.deepEqual(Object.keys(T.solution.reasons).sort(), ['edge', 'groups', 'search']);
});

test('"왜 그럴까?"는 그림 넷의 알아챈 이야기다. 그림 속의 판, 선, 수, 주장이 풀이 프로그램과 같다', () => {
  assert.equal(T.why.length, 4);
  for (const slide of T.why) {
    assert.ok(sentenceCount(slide.say) <= 3, slide.say);
    assert.equal(slide.figures.length, 1);
    for (const item of slide.figures) assert.equal(checkBoard(boardOf(item)), null, item.note);
  }
  const [one, two, three, four] = T.why.map((slide) => slide.figures[0]);
  // 첫 장과 둘째 장: 선 두 개로 자른 세 조각이 모두 똑같이 섞였다. 첫 장은 셋째 조각(위에서 아래로, 왼쪽에서 오른쪽으로 센 차례)의 수를 가린다
  for (const item of [one, two]) {
    const b = boardOf(item);
    const { pieces } = applyCuts(b, item.cuts);
    assert.equal(pieces.length, 3);
    assert.equal(cutDone(b, pieces), true);
  }
  assert.deepEqual(one.hide, [2]);
  assert.deepEqual(one.rows, two.rows);
  assert.deepEqual(one.cuts, two.cuts);
  // 둘째 장의 빼기: 판 전체 8과 16, 두 조각 4와 8, 1과 2, 남은 조각 3과 6
  const b = boardOf(two);
  const counts = pieceCounts(b, applyCuts(b, two.cuts).pieces).map((item) => item.counts);
  assert.deepEqual(counts, [
    [4, 8],
    [1, 2],
    [3, 6],
  ]);
  assert.deepEqual([mixOf(b).grey, mixOf(b).white], [8, 16]);
  assert.match(T.why[1].say, /회색은 8칸에서 4칸과 1칸을 빼면 3칸, 흰 칸은 16칸에서 8칸과 2칸을 빼면 6칸이에요\./);
  assert.match(T.why[1].say, /회색 1칸에 흰 칸 2칸씩이에요\.$/);
  // 셋째 장: 점선은 두 쪽을 똑같이 나누는 끝에서 끝까지의 선 모두이고, 셋이다
  assert.deepEqual(three.lines, evenLines(boardOf(three)));
  assert.equal(three.lines.length, 3);
  assert.match(T.why[2].say, /점선 셋이에요\.$/);
  // 넷째 장: 묶음이 6개인데 끝에서 끝까지의 선이 하나도 두 쪽을 똑같이 나누지 못해 안 되는 판
  const last = boardOf(four);
  const result = solve(last);
  assert.equal(result.reason, 'edge');
  assert.equal(mixOf(last).groups, 6);
  assert.deepEqual([mixOf(last).unitGrey, mixOf(last).unitWhite], [1, 2]);
  assert.equal(bruteSolve(last).length, 0);
  assert.deepEqual(four.lines, []);
  assert.match(T.why[3].say, /묶음이 6개나 있어요\./);
  // "왜 그럴까?"는 안 되는 판을 한 번 끝까지 만난 뒤에 열린다(틀의 기본 문)
  assert.equal(tuningFor('split').whyAfter, undefined);
});

test('판 고르기의 그림: 단계마다 그 단계의 판이고, 자른 선이 그 단계의 답이다', () => {
  for (const entry of T.levels) {
    const rung = rungOf(entry.level);
    const picture = entry.picture;
    if (rung.mode === 'make') {
      assert.equal(picture.blank, true);
      continue;
    }
    const b = boardOf(picture);
    assert.equal(checkBoard(b), null, entry.name);
    assert.equal(b.parts, rung.parts, entry.name);
    if (picture.cuts.length > 0) assert.equal(cutDone(b, applyCuts(b, picture.cuts).pieces), true, entry.name);
    const result = solve(b);
    if (rung.mode === 'mix') assert.equal(result.reason, 'groups');
    else assert.equal(result.possible, true, entry.name);
  }
  // 1단계는 첫 판, 3단계는 둘째 판(회색이 2칸뿐), 4단계와 5단계는 첫 판의 그림이다
  const same = (level, seed, index) => assert.deepEqual(boardOf(T.levels[index].picture), generateBoard(level, seed).board);
  same(1, 1, 0);
  same(3, 2, 2);
  same(4, 1, 3);
  same(5, 1, 4);
  assert.equal(checkBoard(T.blank, { open: true }), null);
});

test('직접 만들기: 크기와 조각 수를 정하고 칸을 눌러 칠한다. 선생님은 되는 자르기를 모두 세어 몇 가지를 그리거나, 안 되는 까닭을 말한다', () => {
  const make = part('id="make-split"', '<script');
  for (const id of ['split-make-count', 'split-make-w', 'split-make-h', 'split-make-w-fewer', 'split-make-w-more', 'split-make-h-fewer', 'split-make-h-more', 'split-make-parts', 'split-make-clear', 'split-make-board', 'split-make-solve', 'split-make-result', 'split-make-picture', 'split-make-play']) {
    assert.ok(make.includes(`id="${id}"`), id);
  }
  assert.match(make, /id="split-make-solve"[^>]*>선생님, 잘라 주세요</);
  assert.match(make, /id="split-make-play"[^>]*>내가 해 볼래요</);
  assert.match(make, /data-parts="3">세 조각</);
  assert.match(make, /data-parts="4">네 조각</);
  assert.match(T.make.intro, /선생님에게 잘라 보라고 할 수 있어요\.$/);
  assert.match(T.make['keep-not-yet'], /볼까요\?$/);
  assert.match(code, /line = `\$\{T\.make\.impossible\} \$\{reasonLine\(board, result\)\}`;/);
  // 공책에 남기는 판은 회색 칸과 흰 칸이 모두 있는 판이다
  assert.match(code, /const madeBoard = \(\) => \(draftReady\(\) \? draftBoard\(\) : null\);/);
  assert.match(code, /\n {4}madeBoard,\n/);
  assert.equal(MAKE_LEVEL, 6);
});

test('index.html: 이 형식의 카드, 판, 판 아래, 답하는 칸, 직접 만들기가 있다. 틀에 이어져 있다', () => {
  for (const id of ['home-split-sample', 'home-split-ask', 'home-split-play', 'home-split-pick', 'home-split-make', 'home-split-blank', 'split-board', 'split-count', 'split-status', 'split-grey', 'split-white', 'split-pad', 'split-maybe', 'split-impossible', 'split-found-box', 'split-found', 'split-found-none', 'make-split']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(part('id="split-title"', '</section>'), /<h2 id="split-title">똑같이 섞이게 자르기<\/h2>/);
  assert.ok(visibleText(part('id="split-title"', '</section>')).includes(T.home.ask.cut));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-split-make" class="menu-item"/);
  assert.match(part('id="split-maybe"', 'id="split-found-box"'), /id="split-impossible"[^>]*>불가능해요</);
  // 카드는 규칙 기계 다음, 퍼즐 만들기 앞이다
  assert.ok(html.indexOf('id="machine-title"') < html.indexOf('id="split-title"'));
  assert.ok(html.indexOf('id="split-title"') < html.indexOf('id="make-title"'));
  // 틀이 형식을 안다(형식 목록에서 규칙 기계 다음)
  assert.match(read('src/main.js'), /machine: createMachine\(frame\), split: createSplit\(frame\), /);
  assert.match(read('src/check-main.js'), /\['split', '똑같이 섞이게 자르기'\]/);
  // 켜질 때 앞의 형식(규칙 기계 등)이 감춰 둔 무르기와 되돌리기를 보이게 한다. 규칙 글은 왼쪽 칸 맨 위에 둔다
  assert.match(code, /if \(on\) \{\s*\/\/[^\n]*\n\s*\$\('undo'\)\.hidden = false;\s*\$\('reset'\)\.hidden = false;/);
  assert.match(code, /ruleAside: true,/);
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
  assert.doesNotMatch(code, /hintsOpened/);
});

/** 끝까지 한 판의 기록 하나 */
function finished(more = {}) {
  return { kind: 'round', id: `r-${more.id ?? 1}`, format: 'split', level: 1, seed: 3, custom: false, mode: 'cut', outcome: 'solved', hintsOpened: 0, answers: [{ t: 30, answer: 'cut:x', correct: true, guess: null }], wrongCount: 0, strokeCount: 4, seconds: 50, solution: { possible: true }, ...more };
}

test('수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다. 몇 번 긋고 지웠는지는 보지 않는다', () => {
  const tuning = tuningFor('split');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 5);
  assert.equal(tuning.hintCount, 2);
  assert.match(read('src/core/level.js'), /똑같이 섞이게 자르기\(모두 임시\)/);
  assert.deepEqual(recommend([], 'split'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  assert.deepEqual(recommend([finished({ id: 1 }), finished({ id: 2, strokeCount: 30 })], 'split'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, wrongCount: 1 })], 'split').offerHarder, false);
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, seconds: 200 })], 'split').offerHarder, false);
  assert.equal(whyUnlocked([finished()], 'split'), false);
  assert.equal(whyUnlocked([finished({ level: 3, mode: 'mix', solution: { possible: false }, answers: [{ answer: 'impossible', correct: true }] })], 'split'), true);
});
