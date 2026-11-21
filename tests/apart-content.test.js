// 닿지 않게 놓기와 구역 긋기 대본 점검: 화면에 나오는 글이 약속을 지키는지, "왜 그럴까?"의 그림과 말 속의 수가 풀이 프로그램과 맞는지 본다.
// 한 일과 사실만 말한다(틀렸다고 하지 않는다), 가장 많이 놓는 수는 판이 끝나기 전에 말하지 않는다, 힌트는 두 높이, 규칙은 세 문장 안,
// 화면 코드와 틀에 이 형식이 이어져 있는지도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { LADDER, generateBoard } from '../src/core/apart-ladder.js';
import { freeCells, marblesOk, partitionOf, solve } from '../src/core/apart.js';
import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { fill, sentenceCount } from '../src/core/text.js';
import { allTouch, apart, bruteCover, bruteMost, cellsIn, searchMost } from './helpers/brute-apart.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/apart.json'));
const html = read('index.html');
const code = read('src/formats/apart.js');
const board = read('src/ui/apart-board.js');

const VALUES = { k: 9, f: '3', n: 4, no: '첫 ', face: '빈칸', total: 64 };
/** 그림의 값은 글이 아니다 */
const DATA_KEYS = ['picture', 'blank', 'seed', 'w', 'h', 'touch', 'marbles', 'regions', 'near', 'holes', 'level'];

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
const own = [part('id="apart-title"', 'id="keymaze-title"'), part('id="apart-near"', 'id="keymaze-marks"'), part('id="apart-count"', 'id="keymaze-count"'), part('id="apart-pad"', 'id="keymaze-pad"'), part('id="make-apart"', 'id="make-keymaze"')].map(visibleText).join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const said = strings.map(([, text]) => text).join(' ');

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 단계 목록이 사다리와 같다', () => {
  assert.equal(T.title, '닿지 않게 놓기와 구역 긋기');
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.deepEqual(T.levels.map((item) => item.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(T.levels.map((item) => item.name), ['변만 닿지 않게', '꼭짓점도 닿지 않게', '큰 판과 모양 판', '구역마다 하나씩', '구역을 그어 보이기', '직접 만들기']);
  for (const entry of T.levels) assert.ok(entry.picture.blank === true || Number.isInteger(entry.picture.seed), entry.name);
  // 판 고르기의 그림: 4단계는 구역이 그어진 판, 3단계는 모양 판
  assert.ok(Array.isArray(generateBoard(4, T.levels[3].picture.seed).board.regions));
  assert.ok(generateBoard(3, T.levels[2].picture.seed).board.holes.length > 0);
  // 1~3단계의 그림은 구슬 하나와 그 구슬과 닿는 칸(닿는 약속이 보이게), 5단계는 그어 둔 구역 하나다
  assert.deepEqual(T.levels.slice(0, 3).map((item) => item.picture.marble), [4, 4, 12]);
  for (const item of T.levels.slice(0, 3)) assert.equal(generateBoard(item.level, item.picture.seed).board.holes.includes(item.picture.marble), false);
  const five = generateBoard(5, T.levels[4].picture.seed).board;
  assert.ok(partitionOf(five, T.levels[4].picture.regions).bad.length === 0);
});

test('한 일과 사실만 말한다. 판정하는 말, 칭찬 낱말, 어려운 말(비둘기집)이 없다', () => {
  assert.doesNotMatch(said, /틀렸|틀린|아니에요|땡|정답|아쉽|실수|실패|성공|잘했|훌륭|대단|최고|멋져|멋진|완벽|축하|천재|똑똑|굉장|맞아요|맞혔/);
  assert.doesNotMatch(own, /틀렸|틀린|아니에요|땡|아쉽|실패|잘했|훌륭|대단|최고|멋/);
  assert.doesNotMatch(said, /비둘기/);
  assert.doesNotMatch(visibleText(html), /비둘기/);
  // 체스의 말과 이름을 쓰지 않는다. 놓는 것은 구슬이다
  assert.doesNotMatch(`${said} ${own}`, /체스|킹|퀸|나이트|비숍|룩|임금/);
  assert.match(T.rules.king, /구슬끼리 변도 꼭짓점도 닿으면 안 돼요\./);
  assert.match(T.rules.side, /구슬끼리 변이 닿으면 안 돼요\./);
  // 닿는 칸에 놓으려 하면 놓지 않고 사실만 말한다. 더 놓을 자리가 없으면 놓은 수를 말하고 더 많이 놓을 수 있을지 묻는다
  assert.equal(T.play.touch, '그 칸에 놓으면 구슬끼리 닿아요. 동그라미를 친 구슬과 닿아요.');
  assert.equal(fill(T.play.more, { k: 4 }), '구슬 4개를 놓았더니 더 놓을 자리가 없어요. 더 많이 놓을 수 있을까요?');
  assert.match(code, /const hit = conflictsOf\(round\.board, round\.marbles, cell\);\s*if \(hit\.length > 0\) \{\s*\/\/ 놓지 않는다\./);
  assert.match(code, /if \(reached && round\.mode !== 'prove'\) \{\s*frame\.finish\('solved'\);\s*return;\s*\}/);
  assert.doesNotMatch(code, /Math\.random/);
  assert.doesNotMatch(board, /Math\.random/);
  // 판 아래에는 놓은 수, 이 판에서 가장 많이 놓은 수, 구역 수만 적는다(몇 번 다시 했는지, 몇 번 눌렀는지 적지 않는다)
  for (const line of code.split('\n')) if (/textContent/.test(line)) assert.doesNotMatch(line, /moveCount|refusedCount|completions|retryCount|undoCount|resetCount|tries\.length/, line.trim());
});

test('가장 많이 놓는 수는 판이 끝나기 전에 말하지 않는다(구역을 그어 둔 판은 구역 수가 보인다)', () => {
  // 하는 동안의 말(play)과 판 아래의 글(status)에는 풀이 프로그램의 수를 넣지 않는다
  for (const line of code.split('\n')) if (/T\.(play|status)/.test(line)) assert.doesNotMatch(line, /solution\.(best|cover)|\.best\b(?!\s*===)/, line.trim());
  // 가장 많이 놓은 수에 닿았을 때(구역을 긋는 판)만 "이보다 많이 놓을 수 없다는 것"을 묻는다. 그때의 k는 놓은 수다
  assert.match(code, /if \(reached\) \{\s*frame\.say\(fill\(T\.play\['prove-best'\], \{ k \}\)\);/);
  assert.match(T.play['prove-best'], /구역으로 보일 수 있을까요\?$/);
});

test('규칙 설명은 세 문장 안이다. 판의 종류마다 있다. 직접 만들기의 안내 글도 세 문장 안이다', () => {
  assert.deepEqual(Object.keys(T.rules).sort(), ['king', 'prove', 'shown', 'side']);
  for (const [key, rule] of Object.entries(T.rules)) assert.ok(sentenceCount(rule) <= 3, key);
  // 첫 단계는 "가장 많이"를 걸지 않고 몇 개까지 되는지 묻는다(형식의 첫 판은 실패할 수 없다)
  assert.match(T.rules.side, /몇 개까지 놓을 수 있을까요\?$/);
  assert.match(T.rules.prove, /구역마다 구슬이 하나씩 있으면 끝나요\.$/);
  assert.match(code, /const ruleKey = \(round\) => \(round\.mode === 'place' \? round\.board\.touch : round\.mode\);/);
  assert.match(code, /ruleLine: \(round\) => T\.rules\[ruleKey\(round\)\],/);
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 41);
  assert.ok(sentenceCount(guides[25]) <= 3, guides[25]);
  assert.match(guides[25], /^칸을 누르면 판에서 빠지고, 다시 누르면 돌아와요\./);
  assert.match(guides[25], /구역으로는 가장 많이 놓는 수를 보일 수 없는 판도 만들 수 있을까요\?$/);
  // 오른쪽 칸의 닿는 칸 그림의 말
  assert.match(T.touchNote.side, /변이 닿아요\.$/);
  assert.match(T.touchNote.king, /변이나 꼭짓점이 닿아요\.$/);
});

test('힌트는 판의 종류마다 두 개이고, 하나하나가 질문 한 문장이다. 답을 말해 버리지 않는다', () => {
  assert.deepEqual(Object.keys(T.hints).sort(), ['king', 'prove', 'shown', 'side']);
  for (const [key, list] of Object.entries(T.hints)) {
    assert.equal(list.length, 2, key);
    assert.notEqual(list[0], list[1]);
    for (const hint of list) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
      assert.doesNotMatch(hint, /때문|해야 해요|하면 돼요|늘 |\d|천장/, hint);
    }
  }
  // 힌트 1은 무엇을 해 볼지(모든 형식이 함께 쓰는 짧은 목록에서), 힌트 2는 어디를 볼지
  assert.equal(T.hints.side[0], '아까와 다른 곳에서 시작하면 어떻게 되나요?');
  assert.equal(T.hints.king[0], '더 작은 판이라면 몇 개까지 놓을 수 있을까요?');
  assert.equal(T.hints.shown[0], '끝에는 구역마다 구슬이 몇 개씩 있어야 할까요?');
  assert.match(code, /hints: \(round\) => T\.hints\[ruleKey\(round\)\],/);
});

test('글의 빈칸({이름})은 정해진 이름만 쓰고, 채울 값이 모자라지 않는다', () => {
  const allowed = new Set(['k', 'f', 'n', 'no', 'total', 'level', 'tag', 'face']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
    assert.ok(fill(text, VALUES).length > 0, path);
  }
  assert.equal(fill(T.labels.cell, { no: '첫 ', f: '3', face: '빈칸' }), '첫 번째 줄 3번째 칸, 빈칸');
  assert.equal(fill(T.right.shown, { k: 6 }), '구슬 6개를 구역마다 하나씩 놓았어요. 구역이 6개라서 6개보다 많이 놓을 수 없어요.');
  assert.equal(fill(T.right.proved, { k: 4 }), '구역 4개에 구슬을 하나씩 놓았어요. 구역이 4개라서 4개보다 많이 놓을 수 없어요.');
  assert.equal(fill(T.notebook.best, { k: 9 }), '가장 많이 놓은 구슬 9개');
});

test('화면 글에 영어 낱말과 보상 낱말이 없고, "~요"로 끝나는 말투다. 한 문장은 60자를 넘지 않는다', () => {
  for (const [path, text] of strings) assert.doesNotMatch(text.replace(/\{[^{}]*\}/g, ''), /[A-Za-z]/, `${path}: ${text}`);
  assert.doesNotMatch(own, /[A-Za-z]/);
  assert.doesNotMatch(own, /별|점수|순위|레벨|연속/);
  const spoken = [T.home.ask, T.home.pick, ...Object.values(T.rules), ...Object.values(T.touchNote), ...Object.values(T.play), ...Object.values(T.hints).flat(), ...Object.values(T.right), T.solution.say, T.solution.gap, T.make.intro, T.make.best, T.make.gap, ...T.why.map((slide) => slide.say)];
  for (const text of spoken) for (const sentence of sentences(text)) assert.match(sentence, /요[.?!]$/, sentence);
  for (const text of Object.values(T.status)) assert.match(text, /요$/, text);
  for (const slide of T.why) for (const item of slide.figures) assert.match(item.note, /요$/, item.note);
  for (const key of ['placed', 'regions']) assert.match(T.solution[key], /요$/);
  for (const [path, text] of strings) for (const sentence of sentences(fill(text, VALUES))) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

/** 다른 방법으로 구한 가장 많이 놓는 수(작은 판은 모두 골라 보고, 큰 판은 가지를 치며) */
const mostOf = (b) => (cellsIn(b).length <= 22 ? bruteMost(b).best : searchMost(b));
/** "왜 그럴까?" 그림의 판 */
const figureBoard = (item) => ({ w: item.w, h: item.h, holes: item.holes ?? [], touch: item.touch, regions: null });

test('"왜 그럴까?": 가운데에 놓아 막힘 → 네 구역 → 구역 수가 천장(큰 판도) → 변만이면 네 칸 구역에 둘이 들어간다', () => {
  assert.equal(T.why.length, 4);
  for (const slide of T.why) assert.ok(sentenceCount(slide.say) <= 3, slide.say);
  const [one, two, three, four] = T.why.map((slide) => slide.figures);
  for (const slide of T.why) {
    for (const item of slide.figures) {
      const b = figureBoard(item);
      if (item.marbles) assert.ok(apart(b, item.marbles) && marblesOk(b, item.marbles), item.note);
      if (item.regions) {
        const state = partitionOf(b, item.regions);
        assert.ok(state.ok && state.missing.length === 0, item.note);
      }
    }
  }
  // 첫 장: 3×3에서 가운데에 놓으면 더 놓을 자리가 없고, 구석 넷은 가장 많이 놓은 것이다(다른 방법으로도 넷)
  assert.deepEqual(one[0].marbles, [4]);
  assert.deepEqual(freeCells(figureBoard(one[0]), [4]), []);
  assert.equal(one[1].marbles.length, mostOf(figureBoard(one[1])));
  assert.match(T.why[0].say, /가운데 칸에 구슬을 놓았어요/);
  // 둘째 장: 네 구역, 구역마다 칸이 서로 다 닿는다. 다섯 개는 안 된다
  assert.equal(two[0].regions.length, 4);
  for (const region of two[0].regions) assert.ok(allTouch(figureBoard(two[0]), region));
  assert.match(T.why[1].say, /^다섯 개는 정말 안 될까요\?/);
  // 셋째 장: 구역 수와 구슬 수가 같다(3×3은 4, 5×5는 9). 그림의 구역은 가장 적은 구역이다(다른 방법으로도)
  for (const item of three) {
    const b = figureBoard(item);
    assert.ok(partitionOf(b, item.regions).complete, item.note);
    assert.equal(item.regions.length, item.marbles.length, item.note);
    assert.equal(item.regions.length, mostOf(b), item.note);
    assert.equal(bruteCover(b), item.regions.length, item.note);
    assert.equal(item.note, `구역 ${item.regions.length}개, 구슬 ${item.marbles.length}개예요`);
  }
  assert.match(T.why[2].say, /구역 천장이라고 불러요\.$/);
  // 넷째 장: 변만 닿지 않으면 되는 판에서 네 칸 구역에는 구슬이 둘 들어가고(점선 둘레), 두 칸 구역 8개와 구슬 8개
  const square = figureBoard(four[0]);
  assert.equal(four[0].touch, 'side');
  assert.deepEqual(partitionOf(square, four[0].regions).bad, [0]);
  assert.equal(four[0].marbles.length, 2);
  const side = figureBoard(four[1]);
  assert.ok(partitionOf(side, four[1].regions).complete);
  assert.equal(four[1].regions.length, mostOf(side));
  assert.equal(four[1].marbles.length, 8);
  assert.match(T.why[3].say, /여덟 개였어요\.$/);
  // 이야기와 이름은 "왜 그럴까?"에서만 말한다
  for (const [path, text] of strings) if (!path.startsWith('why')) assert.doesNotMatch(text, /천장/, path);
});

test('풀이와 직접 만들기: 가장 많이 놓는 수와 한 가지 방법, 구역으로 보일 수 있으면 그 구역, 아니면 그 사실', () => {
  assert.equal(fill(T.solution.say, { k: 9, n: 9 }), '가장 많이 놓으면 9개예요. 한 가지 방법과, 구역 9개로 나눈 판을 보여 줄게요.');
  assert.match(fill(T.solution.gap, { k: 3, n: 4 }), /이 판은 구역을 아무리 나눠도 4개보다 적어지지 않아요\.$/);
  assert.match(code, /const say = fill\(solution\.closes \? T\.solution\.say : T\.solution\.gap, \{ k: solution\.best, n: solution\.cover \}\);/);
  assert.equal(fill(T.make.best, { k: 8, n: 8, total: 7 }), '가장 많이 놓으면 8개예요. 놓는 방법은 7가지예요. 구역 8개로 나누면 더 놓을 수 없는 것이 보여요.');
  const make = part('id="make-apart"', 'id="make-keymaze"');
  for (const id of ['apart-make-touch', 'apart-make-w-fewer', 'apart-make-w', 'apart-make-w-more', 'apart-make-h-fewer', 'apart-make-h', 'apart-make-h-more', 'apart-make-clear', 'apart-make-board', 'apart-make-solve', 'apart-make-result', 'apart-make-play', 'apart-make-picture']) assert.ok(make.includes(`id="${id}"`), id);
  assert.match(make, /id="apart-make-solve"[^>]*>선생님, 몇 개까지 돼요\?</);
  assert.match(make, /id="apart-make-play"[^>]*>내가 해 볼래요</);
  assert.deepEqual([...make.matchAll(/data-touch="(\w+)"/g)].map((match) => match[1]), ['side', 'king']);
  assert.match(T.make.intro, /선생님에게 몇 개까지 되는지 물어볼 수 있어요\.$/);
  // 직접 만들기의 판은 7칸까지다(칸 하나가 44픽셀보다 작아지지 않게)
  assert.match(code, /const MAKE_MAX = 7;/);
  assert.ok(code.includes("$('apart-make-w-more').disabled = draft.w >= MAKE_MAX;"));
  assert.ok(code.includes("$('apart-make-h-more').disabled = draft.h >= MAKE_MAX;"));
  // 직접 만든 판은 구슬만 놓는 판으로 해 본다
  assert.match(code, /mode: custom \? 'place' : rungOf\(level\)\.mode,/);
  // 공책: 직접 만든 판과 가장 많이 놓은 기록(많을수록 좋은 기록)
  assert.match(code, /\n {4}madeBoard,\n/);
  assert.match(code, /bestOf: \(round\) => \(round\.best === null \? null : \{ value: round\.best, name: fill\(T\.notebook\.best, \{ k: round\.best \}\) \}\),/);
});

test('index.html: 이 형식의 카드, 판, 판 아래, 도구, 답하는 칸, 직접 만들기가 있다. 틀에 이어져 있다', () => {
  for (const id of ['home-apart-sample', 'home-apart-ask', 'home-apart-play', 'home-apart-pick', 'home-apart-make', 'home-apart-blank', 'apart-board', 'apart-count', 'apart-status', 'apart-now', 'apart-best-line', 'apart-best', 'apart-regions-line', 'apart-regions', 'apart-near', 'apart-pad', 'apart-touch-picture', 'apart-touch-note', 'apart-pens', 'apart-pen-note', 'apart-again', 'apart-stop', 'make-apart']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(part('id="apart-title"', '</section>'), /<h2 id="apart-title">닿지 않게 놓기와 구역 긋기<\/h2>/);
  assert.ok(visibleText(part('id="apart-title"', '</section>')).includes(T.home.ask));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-apart-make" class="menu-item"/);
  assert.match(part('id="apart-near"', 'id="why"'), /aria-pressed="false" hidden>닿는 칸 보기</);
  assert.deepEqual([...part('id="apart-pens"', 'id="apart-pen-note"').matchAll(/data-pen="(\w+)"[^>]*>([^<]+)</g)].map((match) => [match[1], match[2]]), [
    ['marble', '구슬 놓기'],
    ['region', '구역 긋기'],
  ]);
  assert.match(part('id="apart-pad"', 'id="domino-pad"'), /id="apart-again"[^>]*>처음부터 다시 해 볼래요</);
  assert.match(part('id="apart-pad"', 'id="domino-pad"'), /id="apart-stop"[^>]*>여기까지 할래요</);
  // 카드는 마법 네모와 겹친 칸 다음, 열쇠 미로 앞이다
  assert.ok(html.indexOf('id="magic-title"') < html.indexOf('id="apart-title"'));
  assert.ok(html.indexOf('id="apart-title"') < html.indexOf('id="keymaze-title"'));
  // 틀이 형식을 안다(마법 네모와 겹친 칸 다음)
  assert.match(read('src/main.js'), /magic: createMagic\(frame\), apart: createApart\(frame\), /);
  assert.match(read('src/check-main.js'), /\['apart', '닿지 않게 놓기와 구역 긋기'\]/);
  assert.match(read('src/core/smaller.js'), /magic: smallerMagic, apart: smallerApart, /);
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
  // 무르기와 되돌리기가 있다. 도구를 켜 본 판은 힌트 하나를 연 것으로 센다
  assert.match(code, /\$\('undo'\)\.hidden = false;\s*\$\('reset'\)\.hidden = false;/);
  assert.match(code, /hintsOpened: round\.hintsOpened \+ \(round\.nearShown \? 1 : 0\),/);
  // 판을 그리는 조각은 글을 받아 그릴 뿐 적지 않는다. 타이머가 없다. 누르는 것과 긋는 것을 모두 받는다
  assert.doesNotMatch(board, /setInterval|setTimeout/);
  for (const name of ['pointerdown', 'pointermove', 'pointerup', 'keydown', "'ap-marble'", "'ap-hit'", "'ap-live'", "'ap-near'"]) assert.ok(board.includes(name), name);
  const css = read('src/app.css');
  // 색만으로 알리지 않는다: 구슬이 둘 들어가는 구역은 점선 둘레, 닿는 칸은 빗금, 구역을 긋는 동안 판이 굴러가지 않는다
  assert.match(css, /\.ap-region\.bad \{[^}]*stroke-dasharray/);
  assert.match(css, /\.ap-ghost \{[^}]*stroke-dasharray/);
  assert.match(css, /\.ap-board\.drawing \.ap-svg \{[^}]*touch-action: none/);
});

/** 끝까지 한 판의 기록 하나 */
function finished(more = {}) {
  return { kind: 'round', id: `r-${more.id ?? 1}`, format: 'apart', level: 1, seed: 1, custom: false, mode: 'place', outcome: 'solved', hintsOpened: 0, answers: [{ t: 10, answer: 'marbles:5', correct: true, guess: null }], reachedBest: true, retries: 0, moveCount: 5, seconds: 60, ...more };
}

test('수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다. 다시 해 보기 두 번 안에 가장 많이 놓으면 "한 번에"다', () => {
  const tuning = tuningFor('apart');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 5);
  assert.equal(tuning.hintCount, 2);
  assert.equal(tuning.fastRetries, 2);
  assert.match(read('src/core/level.js'), /닿지 않게 놓기와 구역 긋기\(모두 임시\)/);
  assert.deepEqual(recommend([], 'apart'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  assert.deepEqual(recommend([finished({ id: 1 }), finished({ id: 2, retries: 2 })], 'apart'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, retries: 3 })], 'apart').offerHarder, false);
  // "여기까지 할래요"로 끝낸 판은 가장 많이 놓은 판이 아니다
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, reachedBest: false, stopped: true })], 'apart').offerHarder, false);
  assert.match(code, /reachedBest: round\.stopped !== true && \(round\.mode === 'prove' \? round\.closed === true : round\.best !== null && round\.best === solution\.best\),/);
  // "왜 그럴까?"는 만들어 낸 판을 가장 많이 놓아 한 번 끝낸 뒤에 열린다
  assert.equal(tuning.whyAfter, 'best');
  assert.equal(whyUnlocked([], 'apart'), false);
  assert.equal(whyUnlocked([finished()], 'apart'), true);
  assert.equal(whyUnlocked([finished({ reachedBest: false })], 'apart'), false);
  assert.equal(whyUnlocked([finished({ custom: true })], 'apart'), false);
  // 사다리의 첫 판은 변만 닿지 않으면 되는 3×3이다(가장 많이 놓으면 다섯)
  assert.equal(solve(generateBoard(1, 1).board).best, 5);
});
