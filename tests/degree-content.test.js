// 조건 맞춰 잇기 대본 점검: 화면에 나오는 글이 약속을 지키는지, "왜 그럴까?"의 그림과 말이 다른 방법으로 따진 것과 맞는지 본다.
// 한 일과 사실만 말한다(틀렸다고 하지 않는다), 힌트는 두 높이, 규칙은 세 문장 안, 색만으로 알리지 않는다,
// 이름("차수", "악수 정리")은 "왜 그럴까?"의 끝 장에서만. 화면 코드와 틀에 이 형식이 이어져 있는지도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { LADDER, generateBoard } from '../src/core/degree-ladder.js';
import { DOT, DOT_HIT, LINE_HIT, RING, caseTree, checkBoard, degreesOf, linesOk, oddPoints, solve, sumOf } from '../src/core/degree.js';
import { fill, sentenceCount } from '../src/core/text.js';
import { bruteOk } from './helpers/brute-degree.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/degree.json'));
const html = read('index.html');
const code = read('src/formats/degree.js');
const board = read('src/ui/degree-board.js');
const css = read('src/app.css');

const VALUES = { k: 3, f: '가', n: 5, no: '첫 ', face: '나' };
const MODES = ['three', 'mixed', 'parity', 'big', 'search', 'made'];
/** 그림과 판의 값은 글이 아니다 */
const DATA_KEYS = ['picture', 'blank', 'seed', 'level', 'need', 'lines', 'ends', 'odd', 'stuck', 'names'];

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
const pad = part('id="degree-pad"', 'id="domino-pad"');
const own = [part('id="degree-title"', 'id="make-title"'), part('id="degree-count"', 'id="fold-count"'), part('id="degree-ends-tool"', 'id="why"'), pad, part('id="make-degree"', '<script')].map(visibleText).join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const said = strings.map(([, text]) => text).join(' ');

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 단계 목록이 사다리와 같다', () => {
  assert.equal(T.title, '조건 맞춰 잇기');
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.deepEqual(T.levels.map((item) => item.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(T.levels.map((item) => item.name), ['모두 셋씩', '점마다 다른 수', '될까요, 안 될까요?', '큰 수가 있는 판', '모든 경우 따져 보기', '직접 만들기']);
  for (const entry of T.levels.filter((item) => !item.picture.blank)) assert.equal(checkBoard(generateBoard(entry.level, entry.picture.seed).board), null);
  assert.deepEqual(Object.keys(T.home.ask).sort(), ['big', 'mixed', 'parity', 'search', 'three']);
  assert.deepEqual(Object.keys(T.hints).sort(), [...MODES].sort());
  assert.deepEqual(Object.keys(T.rules).sort(), ['each', 'three']);
  // 점의 이름은 여덟(점이 가장 많은 판)
  assert.deepEqual(T.names, ['가', '나', '다', '라', '마', '바', '사', '아']);
});

test('한 일과 사실만 말한다. 판정하는 말, 칭찬 낱말이 없다. 되는 판의 "불가능해요"는 이을 수 있는 판이라는 사실만 말한다', () => {
  assert.doesNotMatch(said, /틀렸|틀린|아니에요|땡|정답|아쉽|실수|실패|성공|잘했|훌륭|대단|최고|멋져|멋진|완벽|축하|천재|똑똑|굉장|맞아요|맞혔|못 맞|졌어요|이겼/);
  assert.doesNotMatch(own, /틀렸|틀린|아니에요|땡|아쉽|실패|잘했|훌륭|대단|최고|멋/);
  assert.doesNotMatch(code + board, /Math\.random/);
  // 끝나는 곳은 둘뿐이다: 모든 점이 수만큼 이어졌을 때, 안 되는 판에 "불가능해요"를 눌렀을 때
  assert.equal([...code.matchAll(/frame\.finish\(/g)].length, 2);
  assert.match(code, /if \(state\.done\) \{[\s\S]*?frame\.finish\('solved'\);/);
  assert.match(code, /const correct = solution\.possible === false;/);
  assert.equal(T.play['possible-press'], '이 판은 모든 점을 수만큼 이을 수 있어요. 선을 그어 볼 수 있어요.');
  // 판 아래에는 할 일이나 사실 한 줄과 그은 선, 수만큼 이은 점의 수만 적는다. 무른 수나 누른 수는 적지 않는다
  for (const line of code.split('\n')) if (/textContent/.test(line)) assert.doesNotMatch(line, /undoCount|resetCount|wrongCount|moveCount|impossibleCount|overCount/, line.trim());
  // 수보다 많이 이어도 막지 않는다(판 아래에 사실만 적는다)
  assert.equal(fill(T.status.over, { f: '가' }), '가 점은 선이 수보다 많아요');
});

test('안 되는 까닭은 풀이 프로그램이 구한 것만 말한다', () => {
  assert.match(code, /if \(solution\.reason === 'odd'\) return fill\(group\['reason-odd'\], \{ n: solution\.sum \}\);/);
  assert.match(code, /return fill\(group\['reason-big'\], \{ f: nameOf\(at\), k: need\[at\], n: partnersOf\(need, at\) \}\);/);
  assert.match(code, /if \(solution\.leaves === 1\) return group\['reason-search-one'\];/);
  assert.equal(fill(T.right['reason-odd'], { n: 15 }), '점마다의 수를 모두 더하면 15, 홀수예요.');
  assert.equal(fill(T.right['reason-big'], { f: '가', k: 4, n: 3 }), '가 점은 선이 4개 있어야 하는데 이을 수 있는 다른 점은 3개뿐이에요.');
  // 그 말들이 사실이다(사다리의 처음 만나는 안 되는 판)
  const five = solve(generateBoard(1, 2).board);
  assert.deepEqual([five.reason, five.sum], ['odd', 15]);
  const big = solve(generateBoard(4, 2).board);
  assert.deepEqual([big.reason, big.big], ['big', [0]]);
  const search = solve(generateBoard(5, 2).board);
  assert.deepEqual([search.reason, search.leaves], ['search', 1]);
  assert.equal(bruteOk(generateBoard(5, 2).board.need), false);
  // 직접 만들기의 말도 같은 풀이에서
  assert.match(code, /else if \(result\.reason === 'odd'\) line = fill\(T\.make\.odd, \{ n: result\.sum \}\);/);
});

test('무르기와 처음으로 뒤에는 앞의 말을 덮는 한마디를 한다', () => {
  assert.equal(T.play.undo, '무르기 전 모습으로 돌아왔어요.');
  assert.equal(T.play.reset, '처음 모습으로 돌아왔어요.');
  assert.match(code, /frame\.note\('undo'\);[\s\S]*?frame\.say\(T\.play\.undo\);/);
  assert.match(code, /frame\.note\('reset'\);[\s\S]*?frame\.say\(T\.play\.reset\);/);
});

test('규칙 설명은 세 문장 안이고, 선은 두 점 사이에 하나뿐이고 제자리로 돌아오는 선이 없다는 것을 말한다. 직접 만들기의 안내 글도 세 문장 안이다', () => {
  for (const [key, rule] of Object.entries(T.rules)) {
    assert.ok(sentenceCount(rule) <= 3, key);
    assert.match(rule, /^두 점을 차례로 누르면 선이 생기고, 선을 누르면 없어져요\./, key);
    assert.match(rule, /두 점 사이에는 선을 하나만 긋고, 제자리로 돌아오는 선은 없어요\./, key);
    assert.match(rule, /\?$/, key);
  }
  assert.match(T.rules.three, /세 개씩/);
  assert.match(code, /ruleLine: \(round\) => T\.rules\[ruleKey\(round\)\],/);
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 51);
  const mine = guides[50];
  assert.ok(sentenceCount(mine) <= 3, mine);
  assert.match(mine, /^점을 눌러 고르고 그 점의 수를 정해요\./);
  assert.match(mine, /모든 경우를 따져 봐야만 알 수 있는 판을 만들 수 있을까요\?$/);
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
      assert.doesNotMatch(hint, /홀수|짝수|두 배|2배|차수|악수|\d/, hint);
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
  // 수 뒤에는 받침과 상관없는 말만 붙인다
  for (const [path, text] of strings) assert.doesNotMatch(text, /\{(k|n|total|no)\}(이|가(?!지)|은|는|을|를|과|와|으로|로|예요|이에요)/, path);
  assert.equal(fill(T.labels.line, { f: fill(T.words.pair, { f: '가', face: '다' }) }), '가 점과 다 점 사이의 선, 누르면 없어져요');
  // 판 아래의 한 줄은 한 줄에 들어간다(스무 자 안쪽)
  for (const [key, text] of Object.entries(T.status)) assert.ok([...fill(text, { f: '가' })].length <= 20, key);
});

test('화면 글에 영어 낱말과 보상 낱말이 없고, "~요"로 끝나는 말투다. 한 문장은 60자를 넘지 않는다', () => {
  for (const [path, text] of strings) assert.doesNotMatch(text.replace(/\{[^{}]*\}/g, ''), /[A-Za-z]/, `${path}: ${text}`);
  assert.doesNotMatch(own, /[A-Za-z]/);
  assert.doesNotMatch(own, /별|점수|순위|레벨|연속|시간|초 /);
  const spoken = [...Object.values(T.home.ask), T.home.pick, ...Object.values(T.rules), ...Object.values(T.play), ...Object.values(T.hints).flat(), ...Object.values(T.right), ...Object.values(T.cases).filter((text) => text.endsWith('.')), ...['possible', 'odd', 'big', 'search', 'search-one', 'search-many', 'more'].map((key) => T.solution[key]), ...['intro', 'can', 'odd', 'big', 'search', 'search-count', 'changed', 'keep-not-yet'].map((key) => T.make[key]), ...T.why.map((slide) => slide.say)];
  for (const text of spoken) for (const sentence of sentences(text)) assert.match(sentence, /요[.?!]$/, sentence);
  for (const text of Object.values(T.status)) assert.match(text, /요$/, text);
  for (const key of ['note-possible', 'note-odd', 'note-big', 'start', 'step', 'stuck', 'stuck-zero']) assert.match(T.solution[key], /요$/, key);
  assert.match(T.cases.note, /요$/);
  for (const slide of T.why) for (const item of slide.figures) assert.match(item.note, /요$/, item.note);
  for (const [path, text] of strings) for (const sentence of sentences(fill(text, VALUES))) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

test('이름("차수", "악수 정리")은 "왜 그럴까?"의 끝 장에서만 말한다. 규칙 글, 힌트, 판에는 없다', () => {
  const last = `why[${T.why.length - 1}]`;
  for (const [path, text] of strings) {
    if (path.startsWith(last)) continue;
    assert.doesNotMatch(text, /차수|악수|정리|그래프/, `${path}: ${text}`);
  }
  assert.doesNotMatch(own, /차수|악수|정리|홀수|짝수/);
  assert.match(T.why.at(-1).say, /그 점의 차수라고 불러요\./);
  assert.match(T.why.at(-1).say, /악수 정리라고 해요\./);
});

test('"왜 그럴까?": 그림의 선, 끝의 수, 홀수인 점, 막힌 점이 말과 맞고, 다른 방법으로 따져도 같다', () => {
  assert.equal(T.why.length, 6);
  for (const slide of T.why) {
    assert.ok(sentenceCount(slide.say) <= 3, slide.say);
    assert.ok(slide.figures.length >= 1 && slide.figures.length <= 3);
    for (const item of slide.figures) {
      assert.equal(checkBoard({ need: item.need }), null);
      assert.ok(linesOk(item.need.length, item.lines), item.note);
      // 그림의 선은 어느 점에서도 수를 넘지 않는다
      degreesOf(item.need.length, item.lines).forEach((value, at) => assert.ok(value <= item.need[at], item.note));
    }
  }
  const ends = (item) => 2 * item.lines.length;
  // 첫 장: 넷이 모두 셋씩, 선 6개, 끝 12개, 수를 더해도 12
  const [k4] = T.why[0].figures;
  assert.equal(k4.lines.length, 6);
  assert.equal(ends(k4), sumOf(k4.need));
  assert.equal(k4.note, `선 ${k4.lines.length}개, 끝 ${ends(k4)}개예요`);
  // 둘째 장: 선을 하나씩 더할 때 끝은 2, 4, 6
  T.why[1].figures.forEach((item, at) => {
    assert.equal(item.lines.length, at + 1);
    assert.equal(item.note, `선 ${at + 1}개, 끝 ${ends(item)}개예요`);
  });
  // 셋째 장: 다섯이 모두 셋씩이면 15, 그린 그림은 선 7개(한 점이 모자라다). 안 되는 판이다(다른 방법으로)
  const [five] = T.why[2].figures;
  assert.equal(sumOf(five.need), 15);
  assert.equal(five.note, `선 ${five.lines.length}개, 끝 ${ends(five)}개예요`);
  assert.deepEqual(degreesOf(5, five.lines).filter((value, at) => value < five.need[at]).length, 1);
  assert.equal(bruteOk(five.need), false);
  // 넷째 장: 홀수인 점의 수. 앞의 두 그림은 다 이은 판, 셋째는 안 되는 판
  const [a, b, c] = T.why[3].figures;
  for (const item of [a, b, c]) assert.equal(item.note, `홀수인 점 ${oddPoints(item.need).length}개예요`);
  for (const item of [a, b]) assert.deepEqual(degreesOf(item.need.length, item.lines), item.need);
  assert.equal(bruteOk(c.need), false);
  // 다섯째 장: 3, 1, 3, 1은 더하면 8인데 안 된다. 가 점이 셋과 모두 이으면 다 점이 막힌다(경우의 나무와 같다)
  const [start, stuck] = T.why[4].figures;
  assert.deepEqual(start.need, [3, 1, 3, 1]);
  assert.equal(sumOf(start.need), 8);
  assert.equal(bruteOk(start.need), false);
  const [leaf] = caseTree(start.need).leaves;
  assert.equal(caseTree(start.need).leaves.length, 1);
  assert.deepEqual(stuck.lines, leaf.lines);
  assert.equal(stuck.stuck, leaf.stuck.point);
  assert.equal(stuck.note, fill(T.solution['stuck-zero'], { f: T.names[leaf.stuck.point], k: leaf.stuck.left }));
  // 끝 장: 차수를 더하면 선 수의 2배
  const [named] = T.why[5].figures;
  assert.deepEqual(degreesOf(4, named.lines), named.need);
  assert.equal(named.note, `차수를 더하면 ${sumOf(named.need)}, 선 ${named.lines.length}개의 2배예요`);
  // "왜 그럴까?"는 틀의 기본 문(안 되는 판을 한 번 끝까지 만난 뒤)에 열린다
  assert.equal(tuningFor('degree').whyAfter, undefined);
});

test('끝났을 때와 풀이, 직접 만들기의 말', () => {
  assert.equal(fill(T.right.done, { n: 6 }), '모든 점을 수만큼 이었어요. 그은 선은 6개예요.');
  assert.equal(fill(T.cases.ways, { f: '가', k: 3, n: 1 }), '가 점은 선 3개를 더 이어야 해요. 잇는 방법은 1가지예요.');
  assert.equal(fill(T.solution.stuck, { f: '다', k: 2, n: 1 }), '다 점은 선 2개가 더 있어야 하는데 이을 점이 1개예요');
  const make = part('id="make-degree"', '<script');
  for (const id of ['degree-make-fewer', 'degree-make-n', 'degree-make-more', 'degree-make-which', 'degree-make-less', 'degree-make-k', 'degree-make-plus', 'degree-make-board', 'degree-make-solve', 'degree-make-result', 'degree-make-play']) assert.ok(make.includes(`id="${id}"`), id);
  assert.match(make, /id="degree-make-solve"[^>]*>선생님, 풀어 보세요</);
  assert.match(make, /id="degree-make-play"[^>]*>내가 해 볼래요</);
  assert.match(code, /const mode = custom \? 'made' : rungOf\(level\)\.mode;/);
  assert.match(code, /\n {4}madeBoard,\n/);
});

test('index.html: 이 형식의 카드, 판, 판 아래, 오른쪽 칸, 도구, 직접 만들기가 있다. 틀에 이어져 있다', () => {
  for (const id of ['home-degree-sample', 'home-degree-ask', 'home-degree-play', 'home-degree-pick', 'home-degree-make', 'home-degree-blank', 'degree-board', 'degree-count', 'degree-status', 'degree-lines', 'degree-full', 'degree-points', 'degree-ends-line', 'degree-ends', 'degree-sum', 'degree-pad', 'degree-cases-box', 'degree-cases-list', 'degree-maybe', 'degree-impossible', 'degree-ends-tool', 'degree-cases-tool', 'make-degree']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(part('id="degree-title"', '</section>'), /<h2 id="degree-title">조건 맞춰 잇기<\/h2>/);
  assert.ok(visibleText(part('id="degree-title"', '</section>')).includes(T.home.ask.three));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-degree-make" class="menu-item"/);
  assert.match(pad, /id="degree-impossible"[^>]*>불가능해요</);
  assert.match(part('id="degree-count"', 'id="fold-count"'), />그은 선 <strong id="degree-lines">/);
  // 도구는 왼쪽 칸의 "왜 그럴까?" 바로 위에 있다
  const side = part('<section class="side" aria-label="힌트">', '</section>');
  assert.ok(side.indexOf('id="yesno-halves"') < side.indexOf('id="degree-ends-tool"'));
  assert.ok(side.indexOf('id="degree-cases-tool"') < side.indexOf('id="why"'));
  // 카드는 질문으로 맞히기 다음, 퍼즐 만들기 앞이다
  assert.ok(html.indexOf('id="yesno-title"') < html.indexOf('id="degree-title"'));
  assert.ok(html.indexOf('id="degree-title"') < html.indexOf('id="make-title"'));
  // 틀이 형식을 안다(형식 목록의 맨 뒤, 질문으로 맞히기 다음)
  assert.match(read('src/main.js'), /yesno: createYesno\(frame\), degree: createDegree\(frame\) \};/);
  assert.match(read('src/check-main.js'), /\['degree', '조건 맞춰 잇기'\]/);
  assert.match(read('src/core/smaller.js'), /yesno: smallerYesno, degree: smallerDegree \};/);
  assert.match(code, /smaller: \(round, turn\) => smallerDegree\(\{ mode: round\.mode, board: round\.board \}, turn\),/);
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
  assert.match(code, /\$\('undo'\)\.hidden = false;\s*\$\('reset'\)\.hidden = false;/);
  // 시계와 스스로 넘어가는 것이 없다
  assert.doesNotMatch(board + code, /setInterval|setTimeout|requestAnimationFrame/);
  // 두 도구는 처음 켤 때 힌트 하나로 센다
  assert.match(code, /hintsOpened: round\.hintsOpened \+ \(round\.endsShown \? 1 : 0\) \+ \(round\.casesShown \? 1 : 0\),/);
});

test('화면: 점과 선은 넓게 눌린다(가장 큰 판에서도 44픽셀보다 크다). 수만큼 이은 점, 넘친 점, 고른 점, 막힌 점은 색만이 아니라 모양으로도 보인다', () => {
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const block = (selector) => plain.match(new RegExp(`\\n${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`))[1];
  // 그림은 가로세로 2×(RING+72)이고 판 칸(1180×820 화면에서 세로 400픽셀쯤, 선 끝 세기를 켜도)에 맞춰 줄어든다
  const half = RING + 72;
  assert.match(board, /const HALF = RING \+ 72;/);
  const scale = 400 / (2 * half);
  // 점(지름 2×DOT)과 누르는 자리(지름 2×DOT_HIT), 선의 누르는 너비(2×LINE_HIT)
  assert.ok(2 * DOT * scale >= 44, `점 ${2 * DOT * scale}`);
  assert.ok(2 * DOT_HIT * scale >= 44);
  assert.ok(2 * LINE_HIT * scale >= 44, `선 ${2 * LINE_HIT * scale}`);
  // 점이 여덟일 때 이웃한 두 점의 누르는 자리가 겹치지 않는다
  assert.ok(2 * RING * Math.sin(Math.PI / 8) > 2 * DOT_HIT);
  assert.match(code, /ruleAside: true,/);
  assert.match(block('.dg-dot.over'), /stroke-dasharray/);
  assert.match(block('.dg-picked'), /stroke-dasharray/);
  assert.match(block('.dg-stuck'), /stroke-dasharray/);
  assert.match(block('.dg-line.fresh'), /stroke-dasharray/);
  assert.match(block('.dg-full-ring'), /stroke-width: 5;/);
  // 수만큼 이은 점은 바깥 고리 한 겹, 수보다 많은 선은 빈 네모
  assert.match(board, /if \(full && !small\) nodes\.push\(make\('circle', \{ cx: x, cy: y, r: DOT \+ 6 \}, 'dg-full-ring'\)\);/);
  assert.match(board, /else nodes\.push\(make\('rect', [^\n]*'dg-pip extra'\)\);/);
});

/** 끝까지 한 판의 기록 하나 */
function finished(more = {}) {
  return { kind: 'round', id: `r-${more.id ?? 1}`, format: 'degree', level: 1, seed: 1, custom: false, mode: 'three', outcome: 'solved', hintsOpened: 0, answers: [{ t: 10, answer: 'lines:0-1', correct: true, guess: null }], wrongCount: 0, moveCount: 6, seconds: 40, solution: { possible: true, reason: null, sum: 12, leaves: null }, ...more };
}

test('수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다. "왜 그럴까?"는 안 되는 판을 한 번 끝까지 만난 뒤에 열린다', () => {
  const tuning = tuningFor('degree');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 5);
  assert.equal(tuning.hintCount, 2);
  assert.equal(tuning.whyAfter, undefined);
  assert.equal(tuning.fastWin, undefined);
  assert.equal(tuning.fastSolo, undefined);
  assert.match(read('src/core/level.js'), /조건 맞춰 잇기\(모두 임시\)/);
  assert.deepEqual(recommend([], 'degree'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  assert.deepEqual(recommend([finished({ id: 1 }), finished({ id: 2 })], 'degree'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  // 되는 판에 "불가능해요"를 누른 판은 "한 번에"가 아니다
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, wrongCount: 1 })], 'degree').offerHarder, false);
  const impossible = finished({ id: 3, seed: 2, answers: [{ t: 9, answer: 'impossible', correct: true, guess: null }], solution: { possible: false, reason: 'odd', sum: 15, leaves: null } });
  assert.equal(whyUnlocked([finished()], 'degree'), false);
  assert.equal(whyUnlocked([impossible], 'degree'), true);
  assert.equal(whyUnlocked([{ ...impossible, side: true }], 'degree'), false);
  assert.match(code, /solution: \{ possible: solution\.possible, reason: solution\.reason, sum: solution\.sum, leaves: solution\.leaves \},/);
});
