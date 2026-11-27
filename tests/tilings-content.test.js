// 도미노 깔기 모두 찾기 대본 점검: 화면에 나오는 글이 약속을 지키는지, "왜 그럴까?"의 그림과 말이 다른 방법으로 따진 것과 맞는지 본다.
// 한 일과 사실만 말한다(틀렸다고 하지 않는다), 힌트는 두 높이, 규칙은 세 문장 안, 수학의 이름은 "왜 그럴까?"의 마지막 장에서만.
// 화면 코드와 틀에 이 형식이 이어져 있는지도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { LADDER, generateBoard } from '../src/core/tilings-ladder.js';
import { MAX_STEPS, MAX_W, checkBoard, landedOf } from '../src/core/tilings.js';
import { fill, sentenceCount } from '../src/core/text.js';
import { bruteClimbs, bruteCoverings, coverText } from './helpers/brute-tilings.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/tilings.json'));
const html = read('index.html');
const code = read('src/formats/tilings.js');
const board = read('src/ui/tilings-board.js');
const css = read('src/app.css');

const VALUES = { k: 5, f: 2, n: 4, no: '첫 ', face: '2×4 판', total: 9 };
/** 그림과 판의 값은 글이 아니다 */
const DATA_KEYS = ['picture', 'blank', 'seed', 'board', 'placed', 'left', 'numbers', 'climb', 'stairs', 'level', 'head'];

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
const strings = [...allStrings(T), ...T.table.head.map((text, index) => [`table.head[${index}]`, text])];

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
const own = [part('id="tilings-title"', 'id="fingers-title"'), part('id="tilings-count"', 'id="fingers-count"'), part('id="tilings-pad"', 'id="fingers-pad"'), part('id="tilings-all"', 'id="fingers-swap"'), part('id="make-tilings"', 'id="make-fingers"')].map(visibleText).join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const said = strings.map(([, text]) => text).join(' ');
/** 그림의 깔기가 그 판을 빈틈없이 덮는 깔기 가운데 하나인가 */
const isCovering = (h, w, placed) => bruteCoverings(h, w).includes(coverText(placed));

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 단계 목록이 사다리와 같다', () => {
  assert.equal(T.title, '도미노 깔기 모두 찾기');
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.deepEqual(T.levels.map((item) => item.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(T.levels.map((item) => item.name), ['모두 세어 보기', '짐작하고 세기', '표 만들기', '계단 오르기', '세 줄 판', '직접 만들기']);
  for (const entry of T.levels.filter((item) => !item.picture.blank)) assert.equal(checkBoard(generateBoard(entry.level, entry.picture.seed).board), null);
  assert.deepEqual(Object.keys(T.home.ask).sort(), ['count', 'guess', 'stairs', 'table', 'three']);
  assert.deepEqual(Object.keys(T.hints).sort(), ['count', 'guess', 'made', 'stairs', 'table', 'three']);
});

test('한 일과 사실만 말한다. 틀린 수에는 짐작만 말한다(작으면 빠뜨린 것, 크면 두 번 센 것). 짐작은 맞다 다르다 하지 않는다', () => {
  assert.doesNotMatch(said, /틀렸|틀린|아니에요|땡|정답|아쉽|실수|실패|성공|잘했|훌륭|대단|최고|멋져|멋진|완벽|축하|천재|똑똑|굉장|맞아요|맞혔/);
  assert.doesNotMatch(own, /틀렸|틀린|아니에요|땡|아쉽|실패|잘했|훌륭|대단|최고|멋/);
  assert.match(T.play.missed, /^빠뜨린 경우가 있는 것 같아요\.$/);
  assert.match(T.play['missed-empty'], /^빠뜨린 경우가 있는 것 같아요\. /);
  assert.match(T.play.double, /^두 번 센 것이 있는 것 같아요\.$/);
  assert.match(T.play['double-list'], /^두 번 센 것이 있는 것 같아요\. /);
  assert.match(code, /const why = correct \? null : value < truth \? 'missed' : 'double';/);
  assert.match(code, /else if \(why === 'missed'\) frame\.say\(T\.play\[listed === 0 \? 'missed-empty' : 'missed'\]\);/);
  // 맞는 수를 넣어야만 끝난다(표 만들기는 표를 다 채우고 짐작을 적어야 끝난다). 틀린 수는 몇 번이든 다시 넣는다
  assert.equal([...code.matchAll(/frame\.finish\(/g)].length, 2);
  assert.match(code, /if \(!correct\) \{\s*round\.wrongCount \+= 1;/);
  assert.match(code, /if \(!round\.board\.table\) \{\s*frame\.finish\('solved'\);/);
  // 짐작은 기록에만 남긴다(맞았는지 말하지 않는다)
  assert.match(code, /answer: `guess:\$\{size\}:\$\{value \?\? 'unknown'\}`, correct: null, guess: 'guess'/);
  assert.equal(T.right['guess-was'], '처음 짐작은 {n}가지였어요.');
  // 같은 깔기를 또 적으면 몇 번째와 같은지 사실로 말한다
  assert.equal(fill(T.play['same-strip'], { no: 3 }), '이 깔기는 3번째와 같아요.');
  assert.equal(fill(T.play['same-strip'], { no: '첫 ' }), '이 깔기는 첫 번째와 같아요.');
  assert.doesNotMatch(code + board, /Math\.random/);
  // 판 아래에는 칸 수와 놓은 도미노와 빈칸(계단은 계단 칸 수와 오른 계단)만 적는다. 넣어 본 수나 무른 수는 적지 않는다
  for (const line of code.split('\n')) if (/textContent/.test(line)) assert.doesNotMatch(line, /undoCount|resetCount|wrongCount|tryCount|sameCount|recordCount/, line.trim());
});

test('무르기와 처음으로 뒤에는 앞의 말을 덮는 한마디를 한다', () => {
  assert.equal(T.play.undo, '무르기 전 모습으로 돌아왔어요.');
  assert.equal(T.play.reset, '처음 모습으로 돌아왔어요.');
  assert.match(code, /frame\.say\(T\.play\.undo\);/);
  assert.match(code, /frame\.say\(T\.play\.reset\);/);
});

test('규칙 설명은 세 문장 안이다. 뒤집어 같은 모양도 따로 센다고 말한다. 직접 만들기의 안내 글도 세 문장 안이다', () => {
  for (const [key, rule] of Object.entries(T.rules)) assert.ok(sentenceCount(fill(rule, VALUES)) <= 3, key);
  assert.match(T.rules.cover, /뒤집으면 같은 모양이어도 놓인 자리가 다르면 따로 세요\.$/);
  assert.match(T.rules.stairs, /한 칸이나 두 칸씩/);
  assert.equal(fill(T.rules.table, { face: '2×6 판' }), '도미노 한 개는 붙어 있는 두 칸을 덮어요. 2×1 판부터 2×6 판까지 덮는 방법을 세어 표를 채워요. 그다음 더 긴 판을 짐작해요.');
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 51);
  const mine = guides[43];
  assert.ok(sentenceCount(mine) <= 3, mine);
  assert.match(mine, /^줄 수와 칸 수를 정하고, 칸을 눌러 빼거나 되살려요\./);
  // 덮을 수 없는 판이 나오는 세 줄 판에서는 0을 넣으면 된다고 판 옆에 적는다
  assert.match(visibleText(part('id="tilings-pad"', 'id="fingers-pad"')), /덮을 수 없는 판이면 0을 넣어요\./);
  assert.match(code, /\$\('tilings-zero-note'\)\.hidden = !\(locking && !round\.done && round\.board\.h === 3 && !isStairs\(round\.board\)\);/);
});

test('힌트는 판의 종류마다 두 개이고, 하나하나가 질문 한 문장이다. 힌트 1은 함께 쓰는 목록에서 고른다. 까닭과 이름은 힌트에 없다', () => {
  const common = ['끝에는 어떤 모양이 되어야 하나요?', '끝나기 바로 전에는 어떤 모양일까요?', '더 작은 판이라면 할 수 있을까요?', '전에 해 본 판 가운데 닮은 판이 있었나요?', '규칙 하나가 없다면 어디까지 되나요?', '아직 한 번도 건드리지 않은 곳이 있나요?', '아까와 다른 곳에서 시작하면 어떻게 되나요?'];
  for (const [key, list] of Object.entries(T.hints)) {
    assert.equal(list.length, 2, key);
    assert.notEqual(list[0], list[1]);
    assert.ok(common.includes(list[0]), list[0]);
    for (const hint of list) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
      assert.doesNotMatch(hint, /때문|해야 해요|하면 돼요|더하|\d|홀수|짝수|피보나치|수열/, hint);
    }
  }
  // 계단의 힌트와 규칙은 도미노를 말하지 않는다(같은 수라는 것은 아이가 알아챈다). 더 작은 판이 없는 3×1이 나오는 판의 힌트 1은 "더 작은 판"이 아니다
  assert.doesNotMatch([...T.hints.stairs, T.rules.stairs, T.home.ask.stairs].join(' '), /도미노|깔기/);
  assert.doesNotMatch(T.hints.three[0], /더 작은 판/);
  assert.match(code, /hints: \(round\) => T\.hints\[kindOf\(round\)\],/);
});

test('글의 빈칸({이름})은 정해진 이름만 쓰고, 채울 값이 모자라지 않는다', () => {
  const allowed = new Set(['k', 'f', 'n', 'no', 'total', 'level', 'tag', 'face']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
    assert.ok(fill(text, VALUES).length > 0, path);
  }
  assert.equal(fill(T.names.strip, { f: 3, n: 4 }), '3×4 판');
  assert.equal(fill(T.names.stairs, { n: 5 }), '계단 5칸');
  assert.equal(fill(T.labels.cell, { no: '첫 ', n: 2, face: T.labels.empty }), '첫 번째 줄 2번째 칸, 빈칸');
  assert.equal(fill(T.play.recorded, { no: 3, k: 4 }), '3번째 자리에 적었어요. 지금까지 4가지예요.');
  assert.equal(fill(T.right.none, { face: '3×3 판', n: 9 }), '3×3 판은 칸이 9개예요. 도미노는 한 번에 두 칸을 덮어서 이 판은 덮을 수 없어요.');
  assert.equal(fill(T.right['table-reveal'], { face: '2×7 판', k: 21, no: '2×8 판', n: 34 }), '2×7 판은 21가지이고, 2×8 판은 34가지예요.');
});

test('화면 글에 영어 낱말과 보상 낱말이 없고, "~요"로 끝나는 말투다. 한 문장은 60자를 넘지 않는다', () => {
  for (const [path, text] of strings) assert.doesNotMatch(text.replace(/\{[^{}]*\}/g, ''), /[A-Za-z]/, `${path}: ${text}`);
  assert.doesNotMatch(own, /[A-Za-z]/);
  assert.doesNotMatch(own, /별|점수|순위|레벨|연속/);
  const labels = ['names', 'labels', 'record', 'table', 'lock.ask', 'lock.open', 'solution.all-title', 'make.rows', 'make.cols', 'list.strip', 'list.stairs', 'status', 'title', 'levels'];
  for (const [path, text] of strings) {
    if (labels.some((head) => path === head || path.startsWith(`${head}.`) || path.startsWith(`${head}[`)) || /figures\[\d+\]\.note$/.test(path)) continue;
    for (const sentence of sentences(text)) assert.match(sentence, /요[.?!]$/, `${path}: ${sentence}`);
  }
  for (const text of Object.values(T.status)) assert.match(text, /요$/, text);
  for (const slide of T.why) for (const item of slide.figures) assert.match(item.note, /요$/, item.note);
  for (const [path, text] of strings) for (const sentence of sentences(fill(text, VALUES))) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

test('"왜 그럴까?": 맨 왼쪽 끝은 세운 도미노 하나이거나 눕힌 도미노 둘 → 남은 판을 더한다 → 표의 수가 모두 그렇다 → (계단) → 세 줄 판 → 이름. 그림은 다른 방법으로 확인한다', () => {
  assert.equal(T.why.length, 6);
  for (const slide of T.why) assert.ok(sentenceCount(slide.say) <= 3, slide.say);
  const [ends, rest, table, climb, three, name] = T.why;
  // 첫 장: 2×5를 덮는 두 깔기. 하나는 맨 왼쪽 열이 세운 도미노 하나, 하나는 눕힌 도미노 둘
  for (const item of ends.figures) assert.ok(isCovering(item.board.h, item.board.w, item.placed), item.note);
  const w = ends.figures[0].board.w;
  assert.ok(ends.figures[0].placed.some(([a, b]) => a === 0 && b === w));
  assert.ok([[0, 1], [w, w + 1]].every(([a, b]) => ends.figures[1].placed.some((pair) => pair[0] === a && pair[1] === b)));
  // 둘째 장: 그렇게 시작하면 남는 판(2×4, 2×3)의 수를 더한 것이 2×5의 수다
  const counts = rest.figures.map((item) => bruteCoverings(2, item.left).length);
  assert.deepEqual(rest.figures.map((item) => item.left), [w - 1, w - 2]);
  assert.deepEqual(counts, [5, 3]);
  rest.figures.forEach((item, index) => assert.match(item.note, new RegExp(`남은 2×${item.left} 판은 ${counts[index]}가지예요$`)));
  assert.equal(bruteCoverings(2, w).length, counts[0] + counts[1]);
  assert.match(rest.say, /5가지와 3가지예요\. 그래서 2×5 판은 둘을 더한 8가지예요\.$/);
  // 셋째 장: 표의 수(2×1~2×8)가 앞의 두 수를 더한 수다
  const row = table.figures[0].numbers.map((size) => bruteCoverings(2, size).length);
  assert.deepEqual(row, [1, 2, 3, 5, 8, 13, 21, 34]);
  for (let at = 2; at < row.length; at++) assert.equal(row[at], row[at - 1] + row[at - 2]);
  assert.match(table.say, /^어, 표의 수가 모두 이렇게 이어지네요\./);
  assert.match(table.say, /8가지와 5가지를 더한 13가지예요\.$/);
  // 계단의 장: 계단 판을 끝까지 한 뒤에만 보인다. 그림의 깔기를 왼쪽부터 읽으면(세운 것 하나는 한 칸, 눕힌 것 둘은 두 칸) 그림의 오르기다
  assert.equal(climb.stairs, true);
  assert.equal(T.why.filter((slide) => slide.stairs).length, 1);
  const [cover, steps] = climb.figures;
  assert.ok(isCovering(cover.board.h, cover.board.w, cover.placed));
  assert.equal(steps.climb.n, cover.board.w);
  assert.ok(bruteClimbs(steps.climb.n).includes(steps.climb.hops.join('')));
  let x = 0;
  for (const hop of steps.climb.hops) {
    if (hop === 1) assert.ok(cover.placed.some(([a, b]) => a === x && b === x + cover.board.w));
    else assert.ok(cover.placed.some(([a, b]) => a === x && b === x + 1));
    x += hop;
  }
  assert.deepEqual(landedOf(steps.climb.hops), [1, 3, 4]);
  // 계단과 도미노를 함께 말하는 글은 이 장뿐이다
  for (const [path, text] of strings) if (!path.startsWith('why[3]')) assert.ok(!(text.includes('계단') && text.includes('도미노')), path);
  assert.match(code, /\.filter\(\(slide\) => !slide\.stairs \|\| climbed\)/);
  // 세 줄 판의 장: 3×4를 덮는데 가운데 금(2열과 3열 사이)을 넘는 도미노가 있는 깔기, 칸이 9개인 3×3
  const [whole, odd] = three.figures;
  assert.ok(isCovering(3, 4, whole.placed));
  assert.ok(whole.placed.some(([a, b]) => b === a + 1 && a % 4 === 1));
  assert.equal(bruteCoverings(3, 4).length, 11);
  assert.equal(odd.board.h * odd.board.w, 9);
  assert.equal(bruteCoverings(3, 3).length, 0);
  assert.match(odd.note, /칸이 9개예요/);
  // 마지막 장: 이름(피보나치 수). 이름은 이 장에만 있고, 규칙 글과 힌트와 화면에는 없다
  assert.match(name.say, /수학에서는 피보나치 수라고 불러요\./);
  for (const [path, text] of strings) if (!path.startsWith('why[5]')) assert.doesNotMatch(text, /피보나치/, path);
  assert.doesNotMatch(html, /피보나치/);
  assert.doesNotMatch(said + own, /수열|등차/);
  // 열리는 때: 표 만들기 판을 한 번 끝까지 한 뒤
  assert.match(code, /if \(!records\.some\(isTableDone\)\) return null;/);
});

test('전부 보여 줘: 끝난 뒤에만 열리고, 풀이 보기 대신이다. 적어 둔 것은 실선, 적지 않은 것은 점선 테두리다', () => {
  assert.match(part('id="tilings-all"', 'id="fingers-swap"'), /id="tilings-all"[^>]*hidden>전부 보여 줘</);
  assert.equal(T.solution['all-title'], '전부 보여 줘');
  assert.match(code, /const done = round\.done && !round\.side;\s*\$\('tilings-all'\)\.hidden = !done;/);
  assert.match(code, /\$\('after-solution'\)\.hidden = true;/);
  assert.match(code, /if \(!round \|\| !round\.done\) return;\s*round\.allCount \+= 1;/);
  assert.match(code, /mark: marked \? \(mine\.has\(key\) \? 'found' : 'missed'\) : null,/);
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(plain, /\.tl-item\.found \{[^}]*solid/);
  assert.match(plain, /\.tl-item\.missed \{[^}]*dashed/);
  assert.match(plain, /\.tl-item\.same \{[^}]*dashed/);
  assert.match(plain, /\.tl-item\.fresh \{[^}]*solid/);
  assert.equal(fill(T.make.count, { k: 41 }), '이 판을 덮는 방법은 모두 41가지예요. 선생님이 모두 늘어놓았어요.');
  assert.equal(T.make.none, '이 판은 덮는 방법이 없어요. 선생님이 모든 방법을 해 봤어요.');
  assert.match(code, /\n {4}madeBoard,\n/);
});

test('index.html: 이 형식의 카드, 판, 판 아래, 오른쪽 칸, 직접 만들기가 있다. 틀에 이어져 있다', () => {
  for (const id of ['home-tilings-sample', 'home-tilings-ask', 'home-tilings-play', 'home-tilings-pick', 'home-tilings-make', 'home-tilings-blank', 'tilings-board', 'tilings-live', 'tilings-list', 'tilings-list-title', 'tilings-list-empty', 'tilings-count', 'tilings-status', 'tilings-cells', 'tilings-placed', 'tilings-empty', 'tilings-steps', 'tilings-climbed', 'tilings-record', 'tilings-pad', 'tilings-sizes', 'tilings-table-box', 'tilings-lock', 'tilings-ask', 'tilings-typed', 'tilings-keys', 'tilings-open', 'tilings-guess-go', 'tilings-guess-skip', 'tilings-guess-line', 'tilings-all', 'make-tilings', 'tilings-make-board', 'tilings-make-solve', 'tilings-make-play', 'tilings-make-result', 'tilings-make-picture']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(part('id="tilings-title"', '</section>'), /<h2 id="tilings-title">도미노 깔기 모두 찾기<\/h2>/);
  assert.ok(visibleText(part('id="tilings-title"', '</section>')).includes(T.home.ask.count));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-tilings-make" class="menu-item"/);
  assert.match(visibleText(part('id="tilings-pad"', 'id="fingers-pad"')), /맞는 수를 넣으면 자물쇠가 열려요\. 몇 번이든 다시 넣어도 돼요\./);
  assert.deepEqual([...part('id="tilings-sizes"', '</div>').matchAll(/data-size="(\d)"/g)].map((match) => Number(match[1])), [1, 2, 3, 4, 5, 6]);
  // 카드는 원판 둘씩 옮기기 다음, 퍼즐 만들기 앞이다
  assert.ok(html.indexOf('id="discpair-title"') < html.indexOf('id="tilings-title"'));
  assert.ok(html.indexOf('id="tilings-title"') < html.indexOf('id="make-title"'));
  // 틀이 형식을 안다(원판 둘씩 옮기기 다음)
  assert.match(read('src/main.js'), /discpair: createDiscpair\(frame\), tilings: createTilings\(frame\), /);
  assert.match(read('src/check-main.js'), /\['tilings', '도미노 깔기 모두 찾기'\]/);
  assert.match(read('src/core/smaller.js'), /discpair: smallerDiscpair, tilings: smallerTilings, /);
  assert.match(code, /smaller: \(round, turn\) => smallerTilings\(\{ mode: round\.mode, board: round\.board, size: round\.size \}, turn\),/);
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
  assert.match(code, /\$\('undo'\)\.hidden = false;\s*\$\('reset'\)\.hidden = false;/);
  assert.match(code, /ruleAside: true,/);
  // 타이머와 움직이는 그림이 없다
  assert.doesNotMatch(board + code, /setInterval|setTimeout|requestAnimationFrame/);
});

test('화면: 가장 큰 판(2×8, 3×6, 계단 8칸)에서도 누르는 칸이 44픽셀보다 크다. 표시는 색만이 아니라 모양으로도 보인다', () => {
  // 1180×820 화면에서 가운데 칸은 가로 500픽셀쯤이다(왼쪽 칸 260, 오른쪽 칸 350, 틈과 여백). 480픽셀로 잡아도
  const px = 480;
  for (const h of [2, 3]) assert.ok(px / MAX_W[h] >= 44, `${h}줄 ${MAX_W[h]}칸: ${px / MAX_W[h]}`);
  assert.ok(px / (MAX_STEPS + 1) >= 44, `계단 ${MAX_STEPS}칸`);
  // 세로: 띠의 자리는 판 칸 높이의 50%까지(판 칸은 450픽셀쯤). 3줄도 한 줄이 44픽셀보다 크다
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(plain, /#tilings-live \{[^}]*height: min\(calc\(var\(--h, 2\) \* 104px \+ 10px\), 50%\);/);
  assert.ok((450 * 0.5) / 3 >= 44);
  // 계단: 기둥 전체가 누르는 자리다. 오를 수 있는 계단은 점선, 지금 선 계단은 큰 동그라미, 밟은 계단은 점, 걸음은 굽은 선
  assert.match(board, /make\('rect', \{ x: k \* STEP_W, y: -6, width: STEP_W, height: height \+ 12 \}, 'tl-hit'\)/);
  assert.match(plain, /\.tl-target \{[^}]*stroke-dasharray/);
  assert.match(board, /'tl-climber'/);
  assert.match(board, /'tl-mark'/);
  assert.match(board, /'tl-hop'/);
  // 목록의 그림마다 차례의 수를 글자로 적는다
  assert.match(board, /box\.append\(el\('span', 'tl-item-no', String\(no\)\)\);/);
});

/** 끝까지 한 판의 기록 하나 */
function finished(more = {}) {
  return { kind: 'round', id: `r-${more.id ?? 1}`, format: 'tilings', level: 1, seed: 1, custom: false, mode: 'count', outcome: 'solved', hintsOpened: 0, answers: [{ t: 10, answer: 'count:2', correct: true, guess: null }], wrongCount: 0, seconds: 30, board: { shape: 'strip', h: 2, w: 2, holes: [], guess: false, table: false }, solution: { possible: true, count: 2, cells: 4, counts: null }, ...more };
}

test('수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다. "왜 그럴까?"는 표 만들기 판을 끝까지 한 뒤에 열린다', () => {
  const tuning = tuningFor('tilings');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 5);
  assert.equal(tuning.hintCount, 2);
  assert.equal(tuning.whyAfter, 'finished');
  assert.equal(tuning.fastWin, undefined);
  assert.equal(tuning.fastSolo, undefined);
  assert.match(read('src/core/level.js'), /도미노 깔기 모두 찾기\(모두 임시\)/);
  assert.deepEqual(recommend([], 'tilings'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  assert.deepEqual(recommend([finished({ id: 1 }), finished({ id: 2 })], 'tilings'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  // 자물쇠에 다른 수를 넣었으면 "한 번에"가 아니다
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, wrongCount: 1 })], 'tilings').offerHarder, false);
  // 틀은 한 판을 끝까지 하면 막지 않는다. 형식은 표 만들기 판을 끝까지 한 기록이 있어야 연다
  assert.equal(whyUnlocked([], 'tilings'), false);
  assert.equal(whyUnlocked([finished()], 'tilings'), true);
  assert.match(code, /const isTableDone = \(item\) => item\.kind === 'round' && item\.format === FORMAT && item\.mode === 'table' && item\.outcome === 'solved' && item\.side !== true && item\.custom !== true;/);
  assert.match(code, /round\.wrongCount \+= 1;/);
  assert.match(code, /solution: \{ possible: true, count: solution\.count, cells: solution\.cells, counts: solution\.counts \},/);
});
