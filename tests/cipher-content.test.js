// 암호 놀이 대본 점검: 화면에 나오는 글이 약속을 지키는지, "왜 그럴까?"의 그림과 말 속의 수가 풀이 프로그램과 맞는지 본다.
// 한 일과 사실만 말한다(틀렸다고 하지 않는다), 힌트는 질문 한 문장씩 둘, 규칙은 세 문장 안, 다른 나라 글자를 쓰지 않는다.
// 다른 수 체계의 이름과 0과 1의 줄은 대본, 첫 화면 파일, 사다리의 판 어디에도 없다.
// 암호 편지는 앱 안에만 있다(보내는 길이 없다). 화면 코드와 틀에 이 형식이 이어져 있는지도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { LADDER, makeLadder, looksLikeBits } from '../src/core/cipher-ladder.js';
import { LETTERS, cipherOf, keyCount, shiftText } from '../src/core/cipher.js';
import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { fill, sentenceCount } from '../src/core/text.js';
import { bruteConsonantCounts, bruteShift } from './helpers/brute-cipher.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/cipher.json'));
const html = read('index.html');
const code = read('src/formats/cipher.js');
const board = read('src/ui/cipher-board.js');
const css = read('src/app.css');
const readme = read('README.md');

const VALUES = { k: 7, f: 'ㄹ', n: 2, no: '첫 ', face: 'ㅂ', total: 14 };
/** 그림과 판의 값, 판의 글(messages)은 따로 본다 */
const DATA_KEYS = ['picture', 'blank', 'seed', 'level', 'ring', 'turn', 'arrow', 'counts', 'messages'];

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
const messages = Object.values(T.messages).flat();

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
const own = [part('id="cipher-title"', 'id="seqpath-title"'), part('id="cipher-counts"', 'id="product-pairs"'), part('id="cipher-count"', 'id="seqpath-count"'), part('id="cipher-pad"', 'id="seqpath-pad"'), part('id="make-cipher"', 'id="make-seqpath"')].map(visibleText).join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const said = strings.map(([, text]) => text).join(' ');
const readmePart = readme.slice(readme.indexOf('암호 놀이'));

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 단계 목록이 사다리와 같다', () => {
  assert.equal(T.title, '암호 놀이');
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.deepEqual(T.levels.map((item) => item.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(T.levels.map((item) => item.name), ['미는 암호 풀기', '열쇠 찾기', '글자를 수로', '달아난 숫자', '자주 나오는 글자', '암호 편지 만들기']);
  for (const entry of T.levels) assert.ok(entry.picture.blank === true || Number.isInteger(entry.picture.seed), entry.name);
  // 판 고르기의 그림: 3단계는 더한 표(2번)를 보여 준다
  assert.notEqual(makeLadder(T.messages).generateBoard(3, T.levels[2].picture.seed).board.keys.c, 0);
  assert.deepEqual(Object.keys(T.home.ask).sort(), ['decode', 'findkey', 'freq', 'sum', 'table']);
});

test('다른 수 체계의 이름과 0과 1의 줄이 대본, 판의 글, 첫 화면 파일, 사다리의 판, 설명서 어디에도 없다', () => {
  const banned = /이진|2진|진법|진수|비트|0과 1|[01]{4,}/;
  for (const [path, text] of strings) assert.doesNotMatch(text, banned, path);
  for (const text of messages) assert.doesNotMatch(text, banned, text);
  assert.doesNotMatch(own, banned);
  assert.doesNotMatch(readmePart.slice(0, readmePart.indexOf('\n## ', 10) > 0 ? readmePart.indexOf('\n## ', 10) : undefined), /이진|2진|진법|진수|비트/);
  // 사다리의 판(단계마다 100개)과 작은 판에도 0과 1로만 된 세 자리 이상의 줄이 없다
  const ladder = makeLadder(T.messages);
  for (let level = 1; level <= 5; level++) {
    for (let seed = 1; seed <= 100; seed++) {
      const { board: made } = ladder.generateBoard(level, seed);
      const lines = made.kind === 'sum' ? made.rows : made.kind === 'digits' ? [made.plain, cipherOf(made)] : [];
      for (const line of lines) assert.equal(looksLikeBits(line), false, `${level}단계 ${seed}번: ${line}`);
    }
  }
  assert.equal(looksLikeBits('1010'), true);
  assert.equal(looksLikeBits('1047'), false);
  // 화면 코드도 0과 1의 줄을 그리지 않는다
  assert.doesNotMatch(code + board, /toString\(2\)|padStart\(8/);
});

test('글자는 한글 자모와 숫자만 쓴다: 대본과 이 형식의 화면 글에 다른 나라 글자가 없다', () => {
  for (const [path, text] of strings) assert.doesNotMatch(text.replace(/\{[^{}]*\}/g, ''), /[A-Za-z]/, `${path}: ${text}`);
  for (const text of messages) assert.doesNotMatch(text, /[A-Za-z]/, text);
  assert.doesNotMatch(own, /[A-Za-z]/);
  // 글자판의 단추는 자모표와 같은 차례의 자모 스물넷이다
  const keys = [...part('id="cipher-make-keys"', 'id="cipher-make-solve"').matchAll(/data-token="([cv]\d+)">([^<]+)</g)].map((match) => [match[1], match[2]]);
  assert.deepEqual(keys, [...LETTERS.c.map((letter, index) => [`c${index}`, letter]), ...LETTERS.v.map((letter, index) => [`v${index}`, letter])]);
});

test('한 일과 사실만 말한다. 판정하는 말, 칭찬 낱말, 보상 낱말이 없다', () => {
  assert.doesNotMatch(said, /틀렸|틀린|아니에요|땡|정답|아쉽|실수|실패|성공|잘했|훌륭|대단|최고|멋져|멋진|완벽|축하|천재|똑똑|굉장|맞아요|맞혔/);
  assert.doesNotMatch(own, /틀렸|틀린|아니에요|땡|아쉽|실패|잘했|훌륭|대단|최고|멋/);
  assert.doesNotMatch(`${said} ${own} ${messages.join(' ')}`, /별|점수|순위|레벨|연속|대각/);
  // 다른 글자를 누르면: 그 글자를 열쇠만큼 밀면 무엇이 되는지만 말한다
  assert.equal(fill(T.play.wrong, { f: 'ㄱ', k: 3, face: 'ㄹ' }), 'ㄱ 글자를 앞으로 3칸 밀면 ㄹ 글자가 돼요.');
  assert.equal(fill(T.play['wrap-c'], { f: 'ㅎ', k: 3, face: 'ㄷ' }), 'ㅎ 다음은 다시 ㄱ이라서, ㅎ 글자를 3칸 밀면 ㄷ 글자가 돼요.');
  assert.equal(fill(T.play.table, { f: 'ㄱ', n: 1 }), 'ㄱ 글자는 글자표에서 1번이에요.');
  // 다른 열쇠에서 "이 열쇠예요": 바퀴를 놓는 방법의 수와 읽어 본 수만 말한다
  assert.equal(fill(T.play.tried, { total: 14, n: 1 }), '바퀴를 놓는 방법은 14가지예요. 지금까지 그 가운데 1가지를 읽어 봤어요.');
  // 다 채운 셈이 맞지 않으면 채운 대로 계산한 값만 말한다(받침에 맞는 말)
  assert.equal(fill(T.play['sum-add'], { n: 1048 }), '채운 대로 위의 두 수를 더하면 1048이에요.');
  assert.equal(fill(T.play['sum-add-open'], { n: 1045 }), '채운 대로 위의 두 수를 더하면 1045예요.');
  assert.match(code, /name = `\$\{board\.op === 'add' \? 'sum-add' : 'sum-sub'\}\$\{endsClosed\(value\) \? '' : '-open'\}`;/);
  // 판 아래에는 몇 번 눌렀는지 적지 않는다
  for (const line of code.split('\n')) if (/textContent/.test(line)) assert.doesNotMatch(line, /wrongCount|pickCount|turnCount|pressCount|checkCount|undoCount/, line.trim());
});

test('규칙 설명은 세 문장 안이다. 판의 종류마다 있다. 직접 만들기의 안내 글도 세 문장 안이다', () => {
  assert.deepEqual(Object.keys(T.rules).sort(), ['added', 'decode', 'digits', 'findkey', 'freq', 'made', 'sum-add', 'sum-sub', 'table']);
  for (const [key, rule] of Object.entries(T.rules)) assert.ok(sentenceCount(rule) <= 3, key);
  assert.match(T.rules.decode, /^암호는 원래 글의 자음을 열쇠만큼 앞으로 민 글이에요\./);
  assert.match(T.rules.added, /14를 넘으면 14를 빼서 앞으로 돌아가요\./);
  assert.match(code, /ruleLine: \(round\) => T\.rules\[keyOf\(round\)\],/);
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 35);
  assert.ok(sentenceCount(guides[27]) <= 3, guides[27]);
  assert.match(guides[27], /자주 나오는 글자로는 열쇠를 찾을 수 없는 편지도 쓸 수 있을까요\?$/);
});

test('힌트는 판의 종류마다 두 개이고, 하나하나가 질문 한 문장이다', () => {
  assert.deepEqual(Object.keys(T.hints).sort(), Object.keys(T.rules).sort());
  for (const [key, list] of Object.entries(T.hints)) {
    assert.equal(list.length, 2, key);
    assert.notEqual(list[0], list[1]);
    for (const hint of list) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
      assert.doesNotMatch(hint, /때문|해야 해요|하면 돼요|나머지/, hint);
    }
  }
  assert.match(code, /hints: \(round\) => T\.hints\[keyOf\(round\)\],/);
});

test('글의 빈칸({이름})은 정해진 이름만 쓰고, 채울 값이 모자라지 않는다', () => {
  const allowed = new Set(['k', 'f', 'n', 'no', 'total', 'level', 'tag', 'face']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
    assert.ok(fill(text, VALUES).length > 0, path);
  }
  assert.equal(fill(T.labels.box, { no: '첫 ', f: '3' }), '첫 번째 줄 3번째 자리의 네모');
  assert.equal(fill(T.keyLine.freq, { total: 140 }), '열쇠를 몰라요. 두 바퀴를 놓는 방법은 140가지예요');
});

test('화면 글은 "~요"로 끝나는 말투다. 한 문장은 60자를 넘지 않는다', () => {
  const spoken = [...Object.values(T.home.ask), T.home.pick, ...Object.values(T.rules), ...Object.values(T.play), ...Object.values(T.hints).flat(), ...Object.values(T.right), ...Object.entries(T.solution).filter(([key]) => key !== 'note').map(([, text]) => text), ...Object.entries(T.make).filter(([key]) => key !== 'size').map(([, text]) => text), ...T.why.map((slide) => slide.say)];
  for (const text of spoken) for (const sentence of sentences(text)) assert.match(sentence, /요[.?!]$/, sentence);
  for (const text of [...Object.values(T.status), ...Object.values(T.keyLine), T.solution.note]) assert.match(text, /요$/, text);
  for (const slide of T.why) for (const item of slide.figures) assert.match(item.note, /요$/, item.note);
  for (const [path, text] of strings) for (const sentence of sentences(fill(text, VALUES))) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
  // 판 아래 한 줄은 바퀴 크기가 바뀌지 않게 짧다(한 줄에 들어간다)
  for (const text of Object.values(T.status)) assert.ok([...fill(text, { ...VALUES, n: 1048, total: 140 })].length <= 26, text);
});

test('판의 글: 새로 지은 짧은 글이고, 사람이나 학교, 집안 이야기가 없다. 우리말 문장은 "~요"로 끝난다', () => {
  assert.ok(T.messages.short.length >= 20 && T.messages.words.length >= 15 && T.messages.table.length >= 12 && T.messages.letters.length >= 12);
  for (const text of messages) assert.doesNotMatch(text, /학교|학원|선생|엄마|아빠|형|누나|동생|할머니|할아버지|친구네|씨\b/, text);
  for (const text of [...T.messages.short, ...T.messages.words, ...T.messages.letters, ...T.messages.tricky]) for (const sentence of sentences(text)) assert.match(sentence, /요\.?$/, sentence);
  // 같은 글이 두 번 없다
  assert.equal(new Set(messages).size, messages.length);
});

test('"왜 그럴까?": ㅎ 다음은 ㄱ → 14칸은 0칸, 15칸은 1칸(나머지) → 모음까지 140가지 → 긴 편지에서는 ㅇ이 가장 많다', () => {
  assert.equal(T.why.length, 4);
  for (const slide of T.why) assert.ok(sentenceCount(slide.say) <= 3, slide.say);
  const [one, two, three, four] = T.why;
  // 첫 장: 바퀴를 한 칸 돌리면 ㅎ과 나란한 안쪽 글자는 ㄱ이다(ㅎ을 한 칸 밀면 ㄱ)
  assert.deepEqual(one.figures.map((item) => [item.ring, item.turn, item.arrow]), [['c', 1, 13]]);
  assert.equal(bruteShift('하', { c: 1 }), '가');
  assert.equal(LETTERS.c[(13 + 1) % 14], 'ㄱ');
  // 둘째 장: 14칸은 0칸과, 15칸은 1칸과 같다. 15를 14로 나눈 나머지는 1
  for (const text of T.messages.words) {
    assert.equal(shiftText(text, { c: 14 }), text);
    assert.equal(shiftText(text, { c: 15 }), shiftText(text, { c: 1 }));
  }
  assert.equal(15 % 14, 1);
  assert.match(two.say, /15칸은 15를 14로 나눈 나머지인 1칸과 같아요\./);
  assert.match(two.say, /열쇠는 0칸부터 13칸까지 14가지뿐이에요\.$/);
  // 셋째 장: 14 × 10 = 140
  assert.equal(keyCount(['c', 'v']), 140);
  assert.match(three.say, /14 곱하기 10, 140가지예요\.$/);
  assert.deepEqual(three.figures.map((item) => item.ring), ['c', 'v']);
  // 넷째 장: 첫 세 문장 글은 ㅇ이 가장 많고, 짧은 글은 ㄱ이 더 많다(다른 방법으로 센다)
  assert.deepEqual(four.figures.map((item) => item.counts), ['letters', 'tricky']);
  const long = bruteConsonantCounts(T.messages.letters[0]);
  assert.ok(Object.entries(long).every(([letter, count]) => letter === 'ㅇ' || count < long['ㅇ']));
  const short = bruteConsonantCounts(T.messages.tricky[0]);
  assert.ok(short['ㄱ'] > short['ㅇ']);
  assert.match(code, /if \(item\.counts\) return cipherCard\(countBars\(letterCounts\(T\.messages\[item\.counts\]\[0\]\)\.c\), item\.note\);/);
  // 이 형식에는 안 되는 판이 없다. 판을 한 번 끝까지 한 뒤에 "왜 그럴까?"가 열린다
  assert.equal(tuningFor('cipher').whyAfter, 'finished');
});

test('직접 만들기(암호 편지): 글자판으로 쓰고 열쇠를 정한다. 선생님은 바퀴를 놓는 방법의 수와 자주 나오는 글자로 열쇠가 나오는지 말한다. 편지는 앱 안(공책)에만 남는다', () => {
  const make = part('id="make-cipher"', 'id="make-seqpath"');
  for (const id of ['cipher-make-c-fewer', 'cipher-make-c', 'cipher-make-c-more', 'cipher-make-v-fewer', 'cipher-make-v', 'cipher-make-v-more', 'cipher-make-clear', 'cipher-make-board', 'cipher-make-keys', 'cipher-make-solve', 'cipher-make-result', 'cipher-make-play', 'cipher-make-picture']) assert.ok(make.includes(`id="${id}"`), id);
  assert.match(make, /id="cipher-make-solve"[^>]*>선생님, 열쇠를 찾을 수 있어요\?</);
  assert.match(make, /id="cipher-make-play"[^>]*>내가 풀어 볼래요</);
  assert.match(make, /data-token="space">띄어쓰기</);
  assert.match(make, /data-token="erase">지우기</);
  assert.equal(fill(T.make['count-cv'], { total: 140 }), '자음과 모음을 함께 밀었으니 두 바퀴를 놓는 방법은 140가지예요.');
  assert.equal(T.make['top-right'], '그 글자를 ㅇ 자리에 맞추면 맞는 열쇠가 나와요.');
  // 보내는 길이 없다: 메일, 주소, 네트워크를 쓰지 않는다. 공책에 남기기는 틀의 단추가 한다
  assert.doesNotMatch(`${code}${board}`, /mailto|fetch\(|navigator\.share|XMLHttpRequest/);
  assert.doesNotMatch(visibleText(make), /보내|메일|전송/);
  assert.match(code, /\n {4}madeBoard,\n/);
  assert.match(code, /mode: custom \? 'made' : rungOf\(level\)\.mode,/);
});

test('index.html: 이 형식의 카드, 판, 판 아래, 도구, 답하는 칸, 직접 만들기가 있다. 틀에 이어져 있다', () => {
  for (const id of ['home-cipher-sample', 'home-cipher-ask', 'home-cipher-play', 'home-cipher-pick', 'home-cipher-make', 'home-cipher-blank', 'cipher-board', 'cipher-count', 'cipher-status', 'cipher-counts', 'cipher-pad', 'cipher-tap-box', 'cipher-find-box', 'cipher-sum-box', 'cipher-this', 'cipher-keys', 'make-cipher']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(part('id="cipher-title"', '</section>'), /<h2 id="cipher-title">암호 놀이<\/h2>/);
  assert.ok(visibleText(part('id="cipher-title"', '</section>')).includes(T.home.ask.decode));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-cipher-make" class="menu-item"/);
  assert.match(part('id="cipher-counts"', 'id="product-pairs"'), /aria-pressed="false" hidden>글자 세어 보기</);
  assert.match(part('id="cipher-pad"', 'id="seqpath-pad"'), /id="cipher-this"[^>]*>이 열쇠예요</);
  assert.deepEqual([...part('id="cipher-keys"', 'id="seqpath-pad"').matchAll(/data-n="(\w+)"/g)].map((match) => match[1]), ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'erase']);
  // 카드는 열쇠 미로 다음, 수열 길 퍼즐 앞이다
  assert.ok(html.indexOf('id="keymaze-title"') < html.indexOf('id="cipher-title"'));
  assert.ok(html.indexOf('id="cipher-title"') < html.indexOf('id="seqpath-title"'));
  // 틀이 형식을 안다(열쇠 미로 다음)
  assert.match(read('src/main.js'), /keymaze: createKeymaze\(frame\), cipher: createCipher\(frame\), /);
  assert.match(read('src/check-main.js'), /\['cipher', '암호 놀이'\]/);
  assert.match(read('src/core/smaller.js'), /keymaze: smallerKeymaze, cipher: smallerCipher, /);
  assert.match(code, /smaller: \(round, turn\) => smallerCipher\(\{ mode: round\.mode, board: round\.board, book: T\.messages \}, turn\),/);
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
  assert.doesNotMatch(code + board, /Math\.random|setInterval|setTimeout/);
  // 바퀴는 끌거나 누른다. 끄는 동안 판이 굴러가지 않는다. 규칙 글은 왼쪽 칸에 두고 바퀴를 크게 그린다
  for (const name of ['pointerdown', 'pointermove', 'pointerup', 'keydown']) assert.ok(board.includes(name), name);
  assert.match(css, /\.cp-wheel\.live \.cp-wheel-svg \{[^}]*touch-action: none/);
  assert.match(code, /ruleAside: true,/);
  // 무르기와 되돌리기는 푸는 판과 달아난 숫자에만 있다. 글자 세기를 켠 판은 힌트 하나를 연 것으로 센다
  assert.match(code, /\$\('undo'\)\.hidden = !edits;/);
  assert.match(code, /hintsOpened: round\.hintsOpened \+ \(round\.countsShown \? 1 : 0\),/);
  // 고른 풀 글자, 다르게 누른 글자는 색만으로 알리지 않는다(굵은 테두리, 점선 동그라미)
  assert.match(css, /\.cp-chip\[aria-pressed='true'\] \{[^}]*border-width: 4px/);
  assert.match(css, /\.cp-refused \{[^}]*stroke-dasharray/);
});

/** 끝까지 한 판의 기록 하나 */
function finished(more = {}) {
  return { kind: 'round', id: `r-${more.id ?? 1}`, format: 'cipher', level: 1, seed: 1, custom: false, mode: 'decode', outcome: 'solved', hintsOpened: 0, answers: [{ t: 10, answer: 'decoded', correct: true, guess: null }], wrongCount: 0, moveCount: 8, seconds: 60, solution: { possible: true }, ...more };
}

test('수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다. "왜 그럴까?"는 판을 한 번 끝까지 한 뒤에 열린다', () => {
  const tuning = tuningFor('cipher');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 5);
  assert.equal(tuning.hintCount, 2);
  assert.match(read('src/core/level.js'), /암호 놀이\(모두 임시\)/);
  assert.deepEqual(recommend([], 'cipher'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  assert.deepEqual(recommend([finished({ id: 1 }), finished({ id: 2 })], 'cipher'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, wrongCount: 1 })], 'cipher').offerHarder, false);
  assert.equal(whyUnlocked([], 'cipher'), false);
  assert.equal(whyUnlocked([finished()], 'cipher'), true);
  assert.equal(whyUnlocked([finished({ side: true })], 'cipher'), false);
  assert.match(code, /moveCount: round\.pickCount \+ round\.turnCount \+ round\.entryCount \+ round\.pressCount,/);
});

test('설명서(README)에 이 형식이 있다', () => {
  assert.ok(readme.includes('### 암호 놀이'));
  assert.ok(readme.includes('**암호 놀이**'));
  assert.ok(readme.includes('src/formats/cipher.js'));
});
