// 낼 수 없는 금액 대본 점검: 화면에 나오는 글이 약속을 지키는지, "왜 그럴까?"의 그림과 말이 다른 방법으로 따진 것과 맞는지 본다.
// 한 일과 사실만 말한다(틀렸다고 하지 않는다), 힌트는 두 높이, 규칙은 세 문장 안, 색만으로 알리지 않는다,
// 이름(최대공약수)과 식은 "왜 그럴까?"의 끝 장에서만. 화면 코드와 틀에 이 형식이 이어져 있는지도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { LADDER, generateBoard } from '../src/core/nopay-ladder.js';
import { checkBoard } from '../src/core/nopay.js';
import { fill, sentenceCount } from '../src/core/text.js';
import { bruteCanPay, bruteGcd, bruteUnpayable } from './helpers/brute-nopay.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/nopay.json'));
const html = read('index.html');
const code = read('src/formats/nopay.js');
const board = read('src/ui/nopay-board.js');
const css = read('src/app.css');

const VALUES = { k: 3, f: 2, n: 5, no: '첫 ', face: '3원, 5원' };
const MODES = ['first', 'more', 'from', 'end', 'three', 'made'];
/** 그림과 판의 값은 글이 아니다 */
const DATA_KEYS = ['picture', 'blank', 'seed', 'level', 'coins', 'top', 'rows', 'marks', 'run', 'table', 'formula'];

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
const pad = part('id="nopay-pad"', 'id="pig-pad"');
const own = [part('id="nopay-title"', 'id="pig-title"'), part('id="nopay-board"', 'id="pig-board"'), part('id="nopay-count"', 'id="pig-count"'), part('id="nopay-rows"', 'id="pig-faces"'), pad, part('id="make-nopay"', 'id="make-pig"')].map(visibleText).join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const said = strings.map(([, text]) => text).join(' ');
const lastWhy = `why[${T.why.length - 1}]`;

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 단계 목록이 사다리와 같다', () => {
  assert.equal(T.title, '낼 수 없는 금액');
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.deepEqual(T.levels.map((item) => item.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(T.levels.map((item) => item.name), ['작은 동전 두 가지', '더 큰 동전 두 가지', '어디부터 모두 될까요?', '끝이 있을까요?', '동전 세 가지', '직접 만들기']);
  for (const entry of T.levels.filter((item) => !item.picture.blank)) assert.equal(checkBoard(generateBoard(entry.level, entry.picture.seed).board), null);
  // 판 고르기의 그림은 끝이 있는 판이다(4단계 그림이 끝이 없는 판을 미리 보이지 않는다)
  for (const entry of T.levels.filter((item) => !item.picture.blank)) assert.equal(bruteGcd(generateBoard(entry.level, entry.picture.seed).board.coins), 1);
  assert.deepEqual(Object.keys(T.home.ask).sort(), ['end', 'first', 'from', 'more', 'three']);
  assert.deepEqual(Object.keys(T.hints).sort(), [...MODES].sort());
  assert.deepEqual(Object.keys(T.rules).sort(), ['all', 'from']);
});

test('한 일과 사실만 말한다. 판정하는 말, 칭찬 낱말이 없다. 끝이 있는 판의 "끝이 없어요"는 끝이 있다는 사실만 말한다', () => {
  assert.doesNotMatch(said, /틀렸|틀린|아니에요|땡|정답|아쉽|실수|실패|성공|잘했|훌륭|대단|최고|멋져|멋진|완벽|축하|천재|똑똑|굉장|맞아요|맞혔|못 맞|졌어요|이겼/);
  assert.doesNotMatch(own, /틀렸|틀린|아니에요|땡|아쉽|실패|잘했|훌륭|대단|최고|멋/);
  assert.doesNotMatch(code + board, /Math\.random/);
  // 끝나는 곳은 셋뿐이다: 고른 금액이 꼭 같을 때, 자물쇠가 열릴 때, 끝이 없는 판에 "끝이 없어요"를 눌렀을 때
  assert.equal([...code.matchAll(/frame\.finish\(/g)].length, 3);
  assert.match(code, /const correct = extra\.length === 0 && missed\.length === 0;/);
  assert.match(code, /const correct = solution\.possible && value === solution\.from;/);
  assert.match(code, /const correct = solution\.possible === false;/);
  assert.equal(T.play['has-end'], '이 동전들로는 어느 금액부터는 모두 낼 수 있어요. 동전을 담아 더 큰 금액도 만들어 볼 수 있어요.');
  // 빠뜨린 금액은 짚지 않고 수만 말한다(답을 대신 고르지 않는다)
  assert.match(code, /line = fill\(T\.play\.missed, \{ n: missed\.length \}\);/);
  // 판 아래와 오른쪽 칸에는 할 일이나 사실 한 줄과 고른 금액의 수만 적는다. 무른 수나 누른 수는 적지 않는다
  for (const line of code.split('\n')) if (/textContent/.test(line)) assert.doesNotMatch(line, /undoCount|resetCount|wrongCount|moveCount|tryCount|submitCount|endCount/, line.trim());
  // 동전은 아이가 담는다: 칠하는 것은 담은 동전의 합뿐이다
  assert.match(code, /step\(round, 'p', /);
  assert.equal([...code.matchAll(/step\(round, 'p'/g)].length, 1);
});

test('자물쇠의 말과 모두 찾기의 말은 풀이 프로그램이 구한 사실이다', () => {
  assert.match(code, /line = fill\(T\.play\['endless-lock'\], \{ n: value, k: nextUnpayable\(coins, value\) \}\);/);
  assert.match(code, /guess = canPay\(coins, value\) \? 'later' : 'unpayable';/);
  assert.equal(fill(T.play.unpayable, { n: 11 }), '11원은 낼 수 없는 금액이에요.');
  assert.equal(fill(T.play['endless-lock'], { n: 10, k: 11 }), '10원보다 큰 11원도 낼 수 없어요.');
  assert.equal(fill(T.play.extra, { n: 8 }), '8원은 낼 수 있는 금액이에요. 동전을 담아 만들어 볼 수 있어요.');
  assert.equal(fill(T.right['endless-reason'], { f: 2 }), '동전마다 2원짜리 몇 개로 바꿀 수 있어요. 그래서 2원씩 묶이지 않는 금액은 아무리 커도 낼 수 없어요.');
  // 그 말들이 사실이다(처음 만나는 끝이 없는 판: 2원과 4원)
  const endless = generateBoard(4, 2).board;
  assert.equal(bruteGcd(endless.coins), 2);
  for (let amount = 1; amount <= 60; amount++) assert.equal(bruteCanPay(endless.coins, amount), amount % 2 === 0);
});

test('무르기와 처음으로 뒤에는 앞의 말을 덮는 한마디를 한다', () => {
  assert.equal(T.play.undo, '무르기 전 모습으로 돌아왔어요.');
  assert.equal(T.play.reset, '처음 모습으로 돌아왔어요.');
  assert.match(code, /frame\.note\('undo'\);[\s\S]*?frame\.say\(T\.play\.undo\);/);
  assert.match(code, /frame\.note\('reset'\);[\s\S]*?frame\.say\(T\.play\.reset\);/);
});

test('규칙 설명은 세 문장 안이고, 동전을 몇 개든 쓸 수 있다는 것과 칠하는 법을 말한다. 직접 만들기의 안내 글도 세 문장 안이다', () => {
  for (const [key, rule] of Object.entries(T.rules)) {
    const text = fill(rule, { face: '3원, 5원' });
    assert.ok(sentenceCount(text) <= 3, key);
    assert.match(text, /^3원, 5원 동전만 있고, 몇 개든 쓸 수 있어요\. 동전을 담아 만든 금액은 ‘○원 낼 수 있어요’로 띠에 칠해요\./, key);
  }
  assert.match(T.rules.all, /낼 수 없는 금액을 모두 골라요\.$/);
  assert.match(T.rules.from, /어느 금액부터는 모두 낼 수 있을까요\?$/);
  assert.match(code, /ruleLine: \(round\) => fill\(T\.rules\[isAll\(round\) \? 'all' : 'from'\], \{ face: faceOf\(round\.board\.coins\) \}\),/);
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 53);
  const mine = guides[51];
  assert.ok(sentenceCount(mine) <= 3, mine);
  assert.match(mine, /^동전 두세 가지의 값을 정해요\./);
  assert.match(mine, /낼 수 없는 금액이 아주 많은 동전을 만들 수 있을까요\?$/);
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
      assert.doesNotMatch(hint, /공약수|배수|약수|짝수|홀수|묶|끝이 없|\d/, hint);
    }
  }
  assert.match(code, /hints: \(round\) => T\.hints\[round\.mode\],/);
});

test('글의 빈칸({이름})은 정해진 이름만 쓰고, 채울 값이 모자라지 않는다. 수 뒤에는 받침과 상관없는 말만 붙인다', () => {
  const allowed = new Set(['k', 'f', 'n', 'no', 'total', 'level', 'tag', 'face']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
    assert.ok(fill(text, VALUES).length > 0, path);
    assert.doesNotMatch(text, /\{(k|n|f|total|no)\}(이|가(?!지)|은|는|을|를|과|와|으로|로|예요|이에요)/, path);
  }
  // 판 아래의 한 줄은 한 줄에 들어간다(스무 자 안쪽)
  for (const [key, text] of Object.entries(T.status)) assert.ok([...fill(text, { n: 40 })].length <= 20, key);
  assert.equal(fill(T.words.pay, { n: 11 }), '11원 낼 수 있어요');
});

test('화면 글에 영어 낱말과 보상 낱말이 없고, "~요"로 끝나는 말투다. 한 문장은 60자를 넘지 않는다', () => {
  for (const [path, text] of strings) assert.doesNotMatch(text.replace(/\{[^{}]*\}/g, ''), /[A-Za-z]/, `${path}: ${text}`);
  assert.doesNotMatch(own, /[A-Za-z]/);
  assert.doesNotMatch(own, /별|점수|순위|레벨|연속|시간|초 /);
  const spoken = [...Object.values(T.home.ask), T.home.pick, ...Object.values(T.rules), ...Object.values(T.play), ...Object.values(T.hints).flat(), ...Object.values(T.right), ...['all', 'from', 'none', 'endless'].map((key) => T.solution[key]), ...['intro', 'largest', 'none', 'endless', 'changed', 'keep-not-yet'].map((key) => T.make[key]), ...T.why.map((slide) => slide.say)];
  for (const text of spoken) for (const sentence of sentences(fill(text, VALUES))) assert.match(sentence, /요[.?!]$/, sentence);
  for (const text of Object.values(T.status)) assert.match(text, /요$/, text);
  for (const key of ['strip', 'rows', 'run']) assert.match(T.solution[key], /요$/, key);
  for (const slide of T.why) for (const item of slide.figures) assert.match(item.note, /요$/, item.note);
  for (const [path, text] of strings) for (const sentence of sentences(fill(text, VALUES))) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

test('이름(최대공약수)과 식은 "왜 그럴까?"의 끝 장에서만 말한다. 규칙 글, 힌트, 판, 앞의 장에는 없다', () => {
  for (const [path, text] of strings) {
    if (path.startsWith(lastWhy)) continue;
    assert.doesNotMatch(text, /공약수|배수|약수|최대|공식|홀수|짝수|[×÷]/, `${path}: ${text}`);
  }
  // 식의 칸("식")은 끝 장의 표에만 쓴다
  assert.equal(T.why.filter((slide) => slide.figures.some((item) => item.formula)).length, 1);
  assert.ok(T.why.at(-1).figures.some((item) => item.formula));
  assert.doesNotMatch(own, /공약수|배수|약수|최대|홀수|짝수|[×÷]/);
  assert.match(T.why.at(-1).say, /핀에 실 감기에서 본 최대공약수예요\./);
  assert.match(T.why.at(-1).say, /큰 동전×작은 동전−큰 동전−작은 동전이에요\./);
  // 식은 이 화면 코드에서도 끝 장의 표(formula)에서만 만든다
  const lines = code.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((line) => !line.trim().startsWith('//'));
  assert.deepEqual(lines.filter((line) => /×/.test(line)).map((line) => line.trim()), ['cells.push(formula ? `${b}×${a}−${b}−${a}` : String(end.count));']);
});

test('"왜 그럴까?": 그림의 낼 수 없는 금액, 잇달아 낸 금액, 끝까지 빈 가로줄, 표의 수가 말과 맞고, 다른 방법으로 따져도 같다', () => {
  assert.equal(T.why.length, 6);
  for (const slide of T.why) {
    assert.ok(sentenceCount(slide.say) <= 3, slide.say);
    assert.ok(slide.figures.length >= 1 && slide.figures.length <= 2);
    for (const item of slide.figures.filter((figure) => figure.coins)) assert.equal(checkBoard({ kind: 'end', coins: item.coins, top: item.top }), null, item.note);
  }
  /** 줄로 나눠 놓았을 때 칠할 칸이 하나도 없는 가로줄(1부터) */
  const emptyRows = ({ coins, top }) => Array.from({ length: coins[0] }, (_, row) => row + 1).filter((first) => {
    for (let amount = first; amount <= top; amount += coins[0]) if (bruteCanPay(coins, amount)) return false;
    return true;
  });
  // 첫 장: 3원과 5원으로는 1, 2, 4, 7원
  const [first] = T.why[0].figures;
  assert.deepEqual(bruteUnpayable(first.coins, first.top), [1, 2, 4, 7]);
  assert.match(T.why[0].say, /1원, 2원, 4원, 7원은 아무리 해도 낼 수 없었어요\. 어, 8원부터는/);
  assert.equal(first.note, `낼 수 없는 금액이 ${bruteUnpayable(first.coins, first.top).length}개예요`);
  // 둘째 장: 8, 9, 10원은 낼 수 있고 가로줄마다 하나씩, 11, 12, 13원은 거기에 3원 하나
  const [second] = T.why[1].figures;
  assert.ok(second.rows);
  assert.ok(second.run.every((amount) => bruteCanPay(second.coins, amount) && bruteCanPay(second.coins, amount + 3)));
  assert.deepEqual(second.run.map((amount) => (amount - 1) % 3).sort(), [0, 1, 2]);
  // 셋째 장: 4원과 6원은 첫째와 셋째 가로줄, 3원과 6원은 첫째와 둘째 가로줄이 끝까지 빈다
  const [four, three] = T.why[2].figures;
  assert.deepEqual(emptyRows(four), [1, 3]);
  assert.deepEqual(emptyRows(three), [1, 2]);
  assert.deepEqual([bruteGcd(four.coins), bruteGcd(three.coins)], [2, 3]);
  // 넷째 장: 6, 10, 15원은 둘씩은 모두 함께 묶이는데(2, 3, 5) 셋이면 29원이 끝이다. 30원부터 여섯 개가 잇달아 된다
  const [six] = T.why[3].figures;
  assert.deepEqual([[6, 10], [6, 15], [10, 15]].map(bruteGcd), [2, 3, 5]);
  assert.equal(bruteGcd(six.coins), 1);
  assert.equal(bruteUnpayable(six.coins, 60).at(-1), 29);
  assert.ok(six.run.every((amount) => bruteCanPay(six.coins, amount)));
  assert.deepEqual(six.run, [30, 31, 32, 33, 34, 35]);
  assert.deepEqual(emptyRows(six), []);
  // 다섯째 장과 끝 장의 표: 함께 묶이지 않는 두 동전이고, 표에 적는 수(풀이 프로그램)는 다른 방법으로 센 것과 같다. 식으로 구해도 같다
  for (const slide of T.why.slice(4)) {
    for (const [a, b] of slide.figures[0].table) {
      assert.equal(bruteGcd([a, b]), 1);
      const missing = bruteUnpayable([a, b], a * b);
      assert.equal(missing.at(-1), b * a - b - a);
      assert.equal(missing.length, ((b - 1) * (a - 1)) / 2);
    }
  }
  // 끝 장의 보기: 3원과 5원이면 7원, 4개
  assert.match(T.why[5].say, /5×3−5−3 = 7이고, 낼 수 없는 금액의 수는 \(5−1\)×\(3−1\)÷2 = 4개예요\./);
  assert.match(code, /cells\.push\(formula \? `\$\{b\}×\$\{a\}−\$\{b\}−\$\{a\}` : String\(end\.count\)\);/);
  // "왜 그럴까?"는 틀의 기본 문(끝이 없는 판을 한 번 끝까지 만난 뒤)에 열린다
  assert.equal(tuningFor('nopay').whyAfter, undefined);
});

test('끝났을 때와 풀이, 직접 만들기의 말', () => {
  assert.equal(fill(T.right.all, { k: 4 }), '낼 수 없는 금액 4개를 모두 골랐어요.');
  assert.equal(fill(T.right.lock, { n: 8 }), '자물쇠가 열렸어요. 8원부터는 모두 낼 수 있어요.');
  assert.equal(fill(T.make.largest, { k: 7, n: 4 }), '낼 수 없는 가장 큰 금액은 7원이에요. 낼 수 없는 금액은 모두 4개예요.');
  const make = part('id="make-nopay"', 'id="make-pig"');
  for (const id of ['nopay-make-fewer', 'nopay-make-n', 'nopay-make-more', 'nopay-make-c0', 'nopay-make-c1', 'nopay-make-c2', 'nopay-make-row2', 'nopay-make-board', 'nopay-make-solve', 'nopay-make-result', 'nopay-make-play', 'nopay-make-picture']) assert.ok(make.includes(`id="${id}"`), id);
  assert.match(make, /id="nopay-make-solve"[^>]*>선생님, 풀어 보세요</);
  assert.match(make, /id="nopay-make-play"[^>]*>내가 해 볼래요</);
  assert.match(code, /mode: custom \? 'made' : rungOf\(level\)\.mode,/);
  assert.match(code, /\n {4}madeBoard,\n/);
  // 직접 만들기의 말은 풀이 프로그램이 구한 끝에서
  assert.match(code, /if \(end\.gcd > 1\) line = fill\(T\.make\.endless, \{ f: end\.gcd \}\);/);
  assert.match(code, /else line = fill\(T\.make\.largest, \{ k: end\.largest, n: end\.count \}\);/);
});

test('index.html: 이 형식의 카드, 판, 판 아래, 오른쪽 칸, 도구, 직접 만들기가 있다. 틀에 이어져 있다', () => {
  for (const id of ['home-nopay-sample', 'home-nopay-ask', 'home-nopay-play', 'home-nopay-pick', 'home-nopay-make', 'home-nopay-blank', 'nopay-board', 'nopay-coins', 'nopay-tray', 'nopay-pay', 'nopay-strip', 'nopay-count', 'nopay-status', 'nopay-pad', 'nopay-all-box', 'nopay-marked', 'nopay-submit', 'nopay-lock-box', 'nopay-lock', 'nopay-ask', 'nopay-typed', 'nopay-keys', 'nopay-open', 'nopay-maybe', 'nopay-endless', 'nopay-rows', 'make-nopay']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(part('id="nopay-title"', '</section>'), /<h2 id="nopay-title">낼 수 없는 금액<\/h2>/);
  assert.ok(visibleText(part('id="nopay-title"', '</section>')).includes(T.home.ask.first));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-nopay-make" class="menu-item"/);
  assert.match(pad, /id="nopay-endless"[^>]*>끝이 없어요</);
  assert.match(pad, /id="nopay-submit"[^>]*>다 골랐어요</);
  // 도구는 왼쪽 칸의 "왜 그럴까?" 바로 위에 있다
  const side = part('<section class="side" aria-label="힌트">', '</section>');
  assert.ok(side.indexOf('id="degree-cases-tool"') < side.indexOf('id="nopay-rows"'));
  assert.ok(side.indexOf('id="nopay-rows"') < side.indexOf('id="why"'));
  // 카드는 조건 맞춰 잇기 다음, 퍼즐 만들기 앞이다
  assert.ok(html.indexOf('id="degree-title"') < html.indexOf('id="nopay-title"'));
  assert.ok(html.indexOf('id="nopay-title"') < html.indexOf('id="make-title"'));
  // 틀이 형식을 안다(조건 맞춰 잇기 다음)
  assert.match(read('src/main.js'), /degree: createDegree\(frame\), nopay: createNopay\(frame\), /);
  assert.match(read('src/check-main.js'), /\['nopay', '낼 수 없는 금액'\]/);
  assert.match(read('src/core/smaller.js'), /degree: smallerDegree, nopay: smallerNopay, /);
  assert.match(code, /smaller: \(round, turn\) => smallerNopay\(\{ mode: round\.mode, board: round\.board \}, turn\),/);
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
  assert.match(code, /\$\('undo'\)\.hidden = false;\s*\$\('reset'\)\.hidden = false;/);
  // 시계와 스스로 넘어가는 것이 없다
  assert.doesNotMatch(board + code, /setInterval|setTimeout|requestAnimationFrame/);
  // 도구는 처음 켤 때 힌트 하나로 센다
  assert.match(code, /hintsOpened: round\.hintsOpened \+ \(round\.rowsShown \? 1 : 0\),/);
});

test('화면: 띠의 칸은 가장 긴 띠에서도 44픽셀보다 크게 눌린다. 칠한 금액, 고른 금액, 짚은 금액은 색만이 아니라 모양으로도 보인다', () => {
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const block = (selector) => plain.match(new RegExp(`\\n${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`))[1];
  // 판 칸의 가로는 1180×820 화면에서 461픽셀쯤이다(왼쪽 260, 오른쪽 350, 틈과 안쪽 여백을 뺀 것). 한 줄은 여덟 칸이 넘지 않는다
  assert.match(board, /export const STRIP_COLS = 8;/);
  const gap = Number(block('.np-strip').match(/gap: (\d+)px/)[1]);
  assert.ok((461 - 7 * gap) / 8 >= 44);
  assert.ok(Number(block('.np-cell').match(/min-height: (\d+)px/)[1]) >= 44);
  // 줄로 나눠 놓아도 한 줄은 여덟 칸이 넘지 않는다(띠 끝은 가장 작은 동전 × 8 안)
  for (const rung of LADDER.filter((item) => item.mode !== 'make')) {
    for (let seed = 1; seed <= 30; seed++) {
      const { coins, top } = generateBoard(rung.level, seed).board;
      assert.ok(Math.ceil(top / coins[0]) <= 8 && top <= 40);
    }
  }
  // 동전과 담은 동전도 넓게 눌린다
  assert.match(block('.np-coin'), /width: 72px;/);
  assert.ok(Number(block('.np-chip').match(/min-height: (\d+)px/)[1]) >= 44);
  // 칠한 금액은 동전 고리, 고른 금액은 굵은 테두리와 빗금, 짚은 금액은 점선 고리
  assert.match(block('.np-cell.paid::before'), /border-radius: 50%;/);
  assert.match(block('.np-cell.marked'), /border: 4px solid/);
  assert.match(block('.np-cell.marked'), /repeating-linear-gradient/);
  assert.match(block('.np-cell.pointed'), /dashed/);
  assert.match(code, /ruleAside: true,/);
});

/** 끝까지 한 판의 기록 하나 */
function finished(more = {}) {
  return { kind: 'round', id: `r-${more.id ?? 1}`, format: 'nopay', level: 1, seed: 1, custom: false, mode: 'first', outcome: 'solved', hintsOpened: 0, answers: [{ t: 10, answer: 'marks:1,2,4,7', correct: true, guess: null }], wrongCount: 0, moveCount: 6, seconds: 40, solution: { possible: true, gcd: 1, largest: 7, from: 8, count: 4, unpayable: [1, 2, 4, 7] }, ...more };
}

test('수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다. "왜 그럴까?"는 끝이 없는 판을 한 번 끝까지 만난 뒤에 열린다', () => {
  const tuning = tuningFor('nopay');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 5);
  assert.equal(tuning.hintCount, 2);
  assert.equal(tuning.whyAfter, undefined);
  assert.equal(tuning.fastWin, undefined);
  assert.equal(tuning.fastSolo, undefined);
  assert.match(read('src/core/level.js'), /낼 수 없는 금액\(모두 임시\)/);
  assert.deepEqual(recommend([], 'nopay'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  assert.deepEqual(recommend([finished({ id: 1 }), finished({ id: 2 })], 'nopay'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  // 맞지 않게 "다 골랐어요"를 누른 판은 "한 번에"가 아니다
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, wrongCount: 1 })], 'nopay').offerHarder, false);
  const endless = finished({ id: 3, level: 4, seed: 2, mode: 'end', answers: [{ t: 9, answer: 'endless', correct: true, guess: null }], solution: { possible: false, gcd: 2, largest: null, from: null, count: null, unpayable: [1, 3, 5] } });
  assert.equal(whyUnlocked([finished()], 'nopay'), false);
  assert.equal(whyUnlocked([endless], 'nopay'), true);
  assert.equal(whyUnlocked([{ ...endless, side: true }], 'nopay'), false);
  assert.match(code, /solution: \{ possible: solution\.possible, gcd: solution\.gcd, largest: solution\.largest, from: solution\.from, count: solution\.count, unpayable: solution\.unpayable \},/);
});
