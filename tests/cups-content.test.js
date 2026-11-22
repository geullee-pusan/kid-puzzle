// 컵 뒤집기와 세 색 무리 대본 점검: 화면에 나오는 글이 약속을 지키는지, 그림 속의 판과 수가 풀이 프로그램과 맞는지 본다.
// 공통 규격(규칙은 세 문장 안, "가장 적게"는 첫 단계에 걸지 않는다, 힌트는 두 높이, "왜 그럴까?"는 알아챈 이야기, 이름은 까닭 뒤에)과
// 이 묶음만의 약속(바뀌지 않는 값은 안 되는 판만 가려 준다. 되는 판은 실제로 끝내야 통과한다)도 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { LADDER, MAKE_LEVEL, OLD_MAKE_LEVEL, generateBoard, rungOf } from '../src/core/cups-ladder.js';
import { applyMove, checkBoard, checkMove, countsOf, downCount, isDone, remainders, replay, solve, startItems } from '../src/core/cups.js';
import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { fill, sentenceCount } from '../src/core/text.js';
import { bruteColors, bruteCups, bruteMerge } from './helpers/brute-cups.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/cups.json'));
const C = JSON.parse(read('src/content/coins.json'));
const html = read('index.html');
const code = read('src/formats/cups.js');

const KINDS = ['cups', 'colors', 'merge'];
const HINT_KEYS = ['cups', 'fewest', 'colors', 'merge'];
const GUESS_KEYS = ['impossible-no-try', 'impossible-only-down', 'impossible-same-pair', 'impossible-other-way'];
const toItems = (text) => [...text].map(Number);

/** 대본의 모든 글(값)을 길과 함께 모은다. 설명(_로 시작하는 것)과 그림의 판(차례 글자, 수)은 뺀다. */
function allStrings(value, path = '') {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((item, index) => allStrings(item, `${path}[${index}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .filter(([key]) => !key.startsWith('_') && !['steps', 'picture', 'table', 'board', 'cups'].includes(key))
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
const part = (from, to) => html.slice(html.indexOf(from), html.indexOf(to, html.indexOf(from)));
const own = [part('id="cups-title"', 'id="dandelion-title"'), part('id="cups-count"', 'id="trace-count"'), part('id="cups-notes"', 'id="why"'), part('id="cups-pad"', 'id="river-pad"'), part('id="make-cups"', 'id="make-dandelion"')]
  .map(visibleText)
  .join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const ruleOf = (kind, ask) => [fill(T.rules[kind], { k: 2 }), T.asks[ask]].join(' ');

test('대본을 읽을 수 있고, 글이 비어 있지 않다', () => {
  assert.ok(strings.length > 70);
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.equal(T.title, '컵 뒤집기와 세 색 무리');
  assert.deepEqual(T.kinds, { cups: '컵 뒤집기', colors: '세 색 무리', merge: '셋이 하나로' });
  assert.deepEqual(T.colors, ['빨강', '파랑', '노랑']);
});

test('단계 목록이 사다리와 같고, 판 고르기의 그림은 그 단계의 판이다. 테두리는 한 번에 함께 움직이는 것이다', () => {
  assert.deepEqual(T.levels.map((entry) => entry.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(LADDER.map((rung) => C.tags[rung.tag]), ['기본', '응용', '응용', '도전', '도전', '도전', '도전']);
  assert.equal(T.levels.at(-1).level, MAKE_LEVEL);
  assert.equal(T.levels.at(-1).name, '직접 만들기');
  assert.equal(T.levels.at(-1).picture.blank, true);
  for (const rung of LADDER.filter((item) => item.mode !== 'make')) {
    const { picture } = T.levels.find((entry) => entry.level === rung.level);
    let board = { kind: 'colors', counts: picture.counts };
    if (picture.kind === 'cups') board = { kind: 'cups', n: picture.n, k: picture.k, cups: toItems(picture.cups) };
    if (picture.kind === 'merge') board = { kind: 'merge', counts: picture.counts, target: picture.target };
    const where = `${rung.level}단계`;
    assert.equal(checkBoard(board), null, where);
    // 그 단계의 차례에 같은 꼴(컵 수, 한 번에 뒤집는 수, 엎어진 컵 수 / 마릿수 / 마릿수와 남길 색)의 판이 있다.
    const shapes = { cups: () => ['cups', board.n, board.k, downCount(board.cups)], colors: () => ['colors', ...board.counts], merge: () => ['merge', ...board.counts, board.target] };
    const shape = shapes[board.kind]();
    assert.ok(rung.boards.some((entry) => JSON.stringify(entry) === JSON.stringify(shape)), where);
    const items = startItems(board);
    assert.equal(checkMove(board, items, picture.mark), null, `${where}: 테두리`);
  }
  assert.match(T.levels[1].name, /가장 적게/);
  assert.match(T.levels[4].name, /섞어서/);
  assert.match(T.home.pick, /테두리가 있는 것들이 한 번에 함께 움직여요/);
});

test('규칙 설명은 판의 종류마다 있고, 묻는 말까지 세 문장을 넘지 않는다', () => {
  assert.deepEqual(Object.keys(T.rules).sort(), [...KINDS].sort());
  assert.deepEqual(Object.keys(T.asks).sort(), ['colors', 'cups', 'fewest', 'merge']);
  for (const kind of KINDS) for (const ask of Object.keys(T.asks)) assert.ok(sentenceCount(ruleOf(kind, ask)) <= 3, `${kind}, ${ask}`);
  assert.equal(fill(T.rules.cups, { k: 3 }), '엎어진 컵을 모두 바로 세워요. 한 번에 꼭 3개씩 골라서 함께 뒤집어요.');
  assert.match(T.rules.colors, /^색이 다른 방울이 둘이 만나면 둘 다 셋째 색이 돼요\./);
  assert.match(T.rules.colors, /빨강과 파랑이 만나면 둘 다 노랑이 되는 식이에요\./);
  // 형식이 규칙 글과 묻는 말을 이어 붙인다. 가장 적게 뒤집는 판은 묻는 말이 다르다.
  assert.match(code, /const ask = round\.mode === 'fewest' \? T\.asks\.fewest : T\.asks\[board\.kind\];/);
  // 누르는 법은 판 옆에 있다(컵 수는 판마다 다르다).
  assert.equal(fill(T.howto.cups, { k: 2 }), '컵을 2개 고르면 함께 뒤집혀요. 고른 컵을 다시 누르면 빠져요.');
  assert.match(T.howto.colors, /방울이 둘을 차례로 누르면 만나요\./);
  // 직접 만들기 화면의 안내 글도 세 문장 안이다. 안 되는 판을 만들어 보라고 권한다.
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 49);
  assert.ok(sentenceCount(guides[10]) <= 3, guides[10]);
  assert.match(guides[10], /아무리 해도 안 되는 판도 만들 수 있을까요\?$/);
  assert.equal(T.make.intro, '컵이나 방울이로 판을 만들어요. 다 만들면 선생님에게 풀어 보라고 할 수도 있어요.');
  assert.match(html, /id="cups-make-solve"[^>]*>선생님, 풀어 보세요</);
});

test('"가장 적게"는 첫 단계에 걸지 않는다: 2단계에서만 묻는다', () => {
  const counting = /횟수|가장 적|몇 번|줄일|되도록 적게|[}\d]번에/;
  for (const text of [T.rules.cups, T.asks.cups, T.home.ask.cups, ...T.hints.cups]) assert.doesNotMatch(text, counting, text);
  assert.deepEqual(LADDER.filter((rung) => rung.mode === 'fewest').map((rung) => rung.level), [2]);
  assert.match(T.asks.fewest, /되도록 적게/);
  assert.match(T.home.ask.fewest, /몇 번/);
  assert.match(part('id="cups-fewest"', 'id="cups-maybe"'), /<h2>가장 적은 횟수로<\/h2>/);
  // 뒤집은 횟수(만난 횟수)는 판 아래에 사실로만 적는다(무른 것은 빠진다).
  assert.match(html, /<span id="cups-flips-line">뒤집은 횟수 <strong id="cups-flips">0<\/strong>번<\/span>/);
  assert.match(html, /<span id="cups-meets-line" hidden>만난 횟수 <strong id="cups-meets">0<\/strong>번<\/span>/);
  assert.match(code, /\$\(cups \? 'cups-flips' : 'cups-meets'\)\.textContent = String\(round\.trail\.length\);/);
});

test('더 좋은 답이 남아 있을 때는 틀렸다고 하지 않고 "더 줄일 수 있을까요?"라고 묻는다', () => {
  assert.equal(fill(T.play.more, { k: 5 }), '5번 뒤집어서 모두 바로 세웠어요. 더 줄일 수 있을까요?');
  assert.equal(fill(T.right.fewest, { k: 3 }), '3번 뒤집어서 모두 바로 세웠어요. 이보다 적게는 할 수 없어요.');
  assert.equal(fill(T.right['fewest-after'], { n: 5 }), '처음에는 5번이었는데 다시 해서 줄였어요.');
  assert.equal(fill(T.right.stopped, { k: 4 }), '4번 뒤집어서 모두 바로 세우고 여기까지 했어요.');
  const wrong = /틀렸|틀린|아니에요|땡|아쉽|실패|너무 많/;
  for (const [path, text] of strings) assert.doesNotMatch(text, wrong, `${path}: ${text}`);
  assert.doesNotMatch(own, wrong);
  assert.match(html, /id="cups-again"[^>]*>처음부터 다시 해 볼래요</);
  assert.match(html, /id="cups-stop"[^>]*>여기까지 할래요</);
  assert.match(html, /id="cups-best-line"[^>]*>지금까지 가장 적게 <strong id="cups-best"><\/strong>번</);
  assert.match(code, /function stop\(\) \{[\s\S]*?round\.stopped = true;[\s\S]*?frame\.finish\('solved'\);/);
  assert.match(code, /if \(moves === solution\.min\) \{\s*answer\(`done:\$\{moves\}`, true\);\s*frame\.finish\('solved'\);/);
});

test('되는 판은 실제로 끝내야 통과하고, "불가능해요"는 안 되는 판이 섞이는 판에만 있다', () => {
  // 끝났을 때(모두 바로 섬, 모두 한 색)만 'done'으로 끝난다. 숫자로 답하는 칸이 없다.
  assert.match(code, /if \(isDone\(board, after\)\) \{\s*complete\(solution\);/);
  assert.match(code, /if \(round\.mode !== 'fewest'\) \{\s*answer\('done', true\);\s*frame\.finish\('solved'\);/);
  assert.doesNotMatch(part('id="cups-pad"', 'id="river-pad"'), /data-key=/);
  assert.match(html, /id="cups-impossible"[^>]*>불가능해요</);
  assert.match(code, /\$\('cups-maybe'\)\.hidden = round\.mode !== 'maybe';/);
  assert.match(code, /mode: custom \? 'maybe' : rungOf\(level\)\.mode,/);
  // 같은 색을 누르면 만나지 않는다: 판 아래에 짧은 사실, 선생님은 사실 하나와 할 수 있는 일 하나를 한 판에 한 번 말한다.
  const [fact, next, ...rest] = sentences(T.refuse.same);
  assert.equal(rest.length, 0);
  assert.match(fact, /만나지 않아요\.$/);
  assert.match(next, /있어요\.$/);
  for (const text of Object.values(T.status)) {
    assert.match(text, /요$/);
    assert.ok([...text].length <= 20, text);
  }
  assert.match(code, /if \(!round\.sameSaid\) \{\s*round\.sameSaid = true;\s*frame\.say\(T\.refuse\.same\);/);
  // 지나온 모습으로 돌아오면 그 사실을 한 판에 한 번만 말한다.
  assert.match(T.stuck.loop, /^이 모습은 아까도 있었어요\. .*볼 수 있어요\.$/);
  assert.match(code, /if \(!round\.loopSaid\) \{\s*round\.loopSaid = true;\s*frame\.say\(T\.stuck\.loop\);/);
});

test('힌트는 두 개이고 질문 한 문장이다. 첫째는 무엇을 해 볼지만, 둘째는 어디를 볼지까지만 묻는다', () => {
  assert.deepEqual(Object.keys(T.hints).sort(), [...HINT_KEYS].sort());
  for (const key of HINT_KEYS) {
    const [first, second, ...rest] = T.hints[key];
    assert.equal(rest.length, 0, key);
    assert.equal(T.hints[key].length, tuningFor('cups').hintCount);
    for (const hint of [first, second]) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
      // 무엇이 보이는지(까닭)는 말하지 않는다.
      assert.doesNotMatch(hint, /홀수|짝수|홀짝|나머지|그대로|바뀌지 않|3으로/, hint);
    }
    // 첫째: 공통 목록의 일반 질문이다. 이 형식의 사물 이름이 없다.
    assert.doesNotMatch(first, /컵|방울이|색|마릿수|뒤집/, first);
    // 둘째: 볼 곳(엎어진 컵의 수, 색마다의 마릿수)을 가리킨다.
    assert.match(second, /엎어진 컵의 수|색마다의 마릿수/, second);
  }
  // 컵 판의 첫째 힌트는 동전 뒤집기를 떠올리게 한다("어디서 봤지요?").
  assert.equal(T.hints.cups[0], '전에 해 본 판 가운데 닮은 판이 있었나요?');
  assert.match(code, /const hintKey = \(round\) => \(round\.mode === 'fewest' \? 'fewest' : round\.board\.kind\);/);
});

test('틀린 "불가능해요"에 하는 말은 짐작이라고 밝히고, 판에서 해 보게 한다', () => {
  assert.deepEqual(Object.keys(T.guess).sort(), [...GUESS_KEYS].sort());
  for (const key of GUESS_KEYS) {
    assert.match(T.guess[key], /것 같아요/, key);
    assert.doesNotMatch(T.guess[key], /틀렸|아니에요|땡|좀 더 생각|다시 생각|잘 생각/, key);
    assert.match(T.guess[key], /볼까요\?$/, key);
    assert.equal(sentenceCount(T.guess[key]), 2, key);
  }
});

test('맞혔을 때 하는 말은 한 일을 말하고, 칭찬 낱말을 쓰지 않는다', () => {
  const praise = /최고|잘했|대단|훌륭|멋져|멋진|천재|똑똑|완벽|짱|굉장/;
  for (const [path, text] of strings) assert.doesNotMatch(text, praise, `${path}: ${text}`);
  assert.doesNotMatch(own, praise);
  assert.equal(fill(T.right['cups-clean'], { k: 2 }), '모두 바로 세웠어요. 한 번도 무르지 않고 2번 뒤집었어요.');
  assert.equal(fill(T.right['cups-back'], { k: 4, n: 1 }), '모두 바로 세웠어요. 4번 뒤집었고, 1번 무르거나 되돌렸어요.');
  // 방울이: 끝난 색의 이름(빨강, 파랑, 노랑은 모두 받침으로 끝난다)
  for (const name of T.colors) assert.equal(fill(T.right['colors-clean'], { k: 3, face: name }), `모두 ${name}이 됐어요. 한 번도 무르지 않고 3번 만나게 했어요.`);
  assert.ok(fill(T.right['impossible-cups-tried'], { k: 6 }).includes('6번 뒤집어 보고'));
  assert.ok(fill(T.right['impossible-colors-tried'], { k: 2 }).includes('2번 만나게 해 보고'));
  assert.equal(T.right['after-retry'], '처음 답을 바꿔서 찾아냈어요.');
  // "맞아요"는 답 단추("불가능해요")를 눌러 맞혔을 때만 한다.
  for (const [key, text] of Object.entries(T.right)) assert.equal(/^맞아요/.test(text), key.startsWith('impossible-'), key);
  assert.match(T.right['why-invite'], /왜 그럴까 단추를 눌러 보세요\.$/);
});

test('글의 빈칸({이름})은 정해진 이름만 쓰고, 화면 글에 영어 낱말이 없다', () => {
  const allowed = new Set(['k', 'f', 'n', 'no', 'total', 'level', 'tag', 'face']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
    assert.doesNotMatch(text.replace(/\{[^{}]*\}/g, ''), /[A-Za-z]/, `${path}: ${text}`);
  }
  assert.doesNotMatch(visibleText(html), /[A-Za-z]/);
});

test('화면 글은 "~요"로 끝나는 말투이고, 한 문장은 60자를 넘지 않는다', () => {
  const spoken = [
    ...Object.values(T.home.ask),
    T.home.pick,
    ...KINDS.map((kind) => T.rules[kind]),
    ...Object.values(T.asks),
    ...Object.values(T.howto),
    T.refuse.same,
    T.stuck.loop,
    T.stuck.merge,
    T.play.more,
    ...HINT_KEYS.flatMap((key) => T.hints[key]),
    ...Object.values(T.guess),
    ...Object.values(T.right),
    ...['cups-possible', 'cups-impossible', 'colors-possible', 'colors-impossible', 'merge-possible', 'merge-impossible'].map((key) => T.solution[key]),
    ...Object.entries(T.make)
      .filter(([key]) => !['count', 'each', 'folk'].includes(key))
      .map(([, text]) => text),
    ...KINDS.flatMap((kind) => T.why[kind].map((slide) => slide.say)),
  ];
  for (const text of spoken) for (const sentence of sentences(text)) assert.match(sentence, /요[.?!]$/, sentence);
  for (const kind of KINDS) for (const note of T.why[kind].flatMap((slide) => slide.strips.map((strip) => strip.note))) assert.match(note, /요$/, note);
  for (const [path, text] of strings) for (const sentence of sentences(text)) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

test('그림과 이야기는 새로 지었다: 책의 동물(카멜레온 따위)과 문제를 쓰지 않는다', () => {
  const book = /카멜레온|도마뱀|섬에 사는|마법|요정|원숭이/;
  for (const [path, text] of strings) assert.doesNotMatch(text, book, `${path}: ${text}`);
  assert.doesNotMatch(own, book);
  assert.match(T._설명, /새로 그린/);
  // 방울이는 색마다 머리 모양이 달라서 색만으로 가르지 않는다.
  const board = read('src/ui/cups-board.js');
  assert.match(board, /if \(color === 0\) parts\.push\(make\('polygon'/);
  assert.match(board, /if \(color === 1\) parts\.push\(circle\(24, 24, 14/);
  assert.match(board, /if \(color === 2\) parts\.push\(make\('path'/);
  // 엎어진 컵은 그림을 뒤집어 그린다(입구가 아래로).
  assert.match(board, /const body = make\('g', down \? \{ transform: 'rotate\(180 50 55\)' \} : \{\}\);/);
});

test('까닭과 "바뀌지 않는 것"이라는 이름은 "왜 그럴까?"에서만 말한다. 이름은 까닭을 본 뒤에 처음 꺼낸다', () => {
  const name = /바뀌지 않는 것/;
  const reason = /홀수|짝수|홀짝|나머지|그대로네/;
  for (const [path, text] of strings) {
    if (path.startsWith('why') || path.startsWith('table')) continue;
    assert.doesNotMatch(text, name, `${path}: ${text}`);
    assert.doesNotMatch(text, reason, `${path}: ${text}`);
  }
  assert.doesNotMatch(own, name);
  assert.doesNotMatch(own, reason);
  for (const kind of KINDS) {
    const says = T.why[kind].map((slide) => slide.say);
    // 뜻밖의 결과(선생님이 막힌 판) → 적어 보다가 "어, 이건 계속 그대로네" → 까닭과 이름 → 까닭이 그대로는 통하지 않는 곳
    assert.match(says[0], /^선생님도 .*막혔어요\./, kind);
    assert.ok(says.slice(0, 2).some((say) => /계속 그대로네요\./.test(say)), kind);
    for (const say of says.slice(0, 2)) assert.doesNotMatch(say, name, kind);
    assert.match(says[2], /이렇게 아무리 해도 그대로인 것을 바뀌지 않는 것이라고 불러요\.$/, kind);
    // 마지막 장: 바뀌지 않는 값은 안 되는 판만 알려 준다. 되는 판은 직접 해 봐야 안다(이 묶음의 조심할 것).
    assert.match(says[3], /바뀌지 않는 것은 안 되는 판을 알려 줄 뿐이에요\. 되는 판인지는 직접 해 봐야 알아요\.$/, kind);
  }
  // 홀짝을 먼저 봤는데 아니었다("어, 알았다. 아니네요"): 방울이 이야기
  assert.match(T.why.colors[1].say, /홀짝은 만날 때마다 바뀌었지만/);
});

test('"왜 그럴까?"는 판의 종류마다 그림 서너 장이고, 장마다 세 문장 안이다', () => {
  assert.deepEqual(Object.keys(T.why), KINDS);
  for (const kind of KINDS) {
    assert.ok(T.why[kind].length >= 3 && T.why[kind].length <= 4, kind);
    for (const slide of T.why[kind]) {
      assert.ok(sentenceCount(slide.say) <= 3, slide.say);
      assert.ok(slide.strips.length + (slide.table ? 1 : 0) >= 1, '그림이 없는 장');
    }
  }
  // 열리는 때: 그 종류의 안 되는 판을 한 번 끝까지 만난 뒤. 안 되는 판인데 까닭이 그 판을 가려 주지 못하면 열지 않는다.
  assert.match(code, /if \(!whyOpen\(frame\.records\(\), kind\)\) return null;/);
  assert.match(code, /if \(!solveOnce\(round\.board\)\.possible && !invariantRulesOut\(round\.board\)\) return null;/);
  // 컵 이야기는 짝수 개씩 뒤집는 판의 이야기다. 홀수 개씩 뒤집는 판에서는 열지 않는다.
  assert.match(code, /if \(kind === 'cups' && round\.board\.k % 2 === 1\) return null;/);
  for (const slide of T.why.cups) for (const strip of slide.strips) assert.equal(strip.k % 2, 0);
});

test('"왜 그럴까?" 그림 속의 판과 수는 규칙에 맞고, 풀이 프로그램과 다른 방법이 따진 것과 같다', () => {
  // 컵: 그림의 차례는 모두 그 판의 규칙(꼭 k개)에 맞는 뒤집기이고, 적은 엎어진 컵의 수가 그림과 같다.
  for (const slide of T.why.cups) {
    for (const strip of slide.strips) {
      const steps = strip.steps.map(toItems);
      for (let index = 1; index < steps.length; index++) {
        const changed = steps[index].map((cup, at) => (cup !== steps[index - 1][at] ? at : -1)).filter((at) => at >= 0);
        assert.equal(changed.length, strip.k, `${strip.note}: 꼭 ${strip.k}개`);
      }
      const counted = [...strip.note.matchAll(/(\d)개/g)].map((match) => Number(match[1]));
      if (/^엎어진 컵이/.test(strip.note)) assert.deepEqual(counted, steps.map(downCount), strip.note);
      if (steps.length === 2 && !/^엎어진/.test(strip.note)) {
        const change = downCount(steps[1]) - downCount(steps[0]);
        assert.match(strip.note, change < 0 ? /2개 줄어요/ : change > 0 ? /2개 늘어요/ : /그대로예요/, strip.note);
      }
    }
  }
  // 첫 장의 판(컵 셋 가운데 하나가 엎어진 판, 두 개씩)은 안 되는 판이다.
  const first = { kind: 'cups', n: 3, k: 2, cups: toItems(T.why.cups[0].strips[0].steps[0]) };
  assert.equal(downCount(first.cups), 1);
  assert.equal(solve(first).possible, false);
  assert.equal(bruteCups(first).possible, false);
  // 마지막 장의 판(컵 넷을 네 개씩): 엎어진 컵이 짝수 개인데도 안 된다.
  const last = T.why.cups[3].strips[0];
  const four = { kind: 'cups', n: 4, k: last.k, cups: toItems(last.steps[0]) };
  assert.equal(four.k, 4);
  assert.equal(downCount(four.cups) % 2, 0);
  assert.equal(solve(four).possible, false);
  assert.equal(bruteCups(four).possible, false);

  // 방울이: 그림의 차례는 모두 색이 다른 둘의 만남이다.
  for (const slide of T.why.colors) {
    for (const strip of slide.strips) {
      const steps = strip.steps.map(toItems);
      const counts = countsOf(steps[0]);
      const board = { kind: 'colors', counts };
      for (let index = 1; index < steps.length; index++) {
        const changed = steps[index].map((color, at) => (color !== steps[index - 1][at] ? at : -1)).filter((at) => at >= 0);
        assert.equal(checkMove(board, steps[index - 1], changed), null, strip.note);
        assert.deepEqual(applyMove(board, steps[index - 1], changed), steps[index], strip.note);
      }
    }
  }
  // 첫 장: 빨강 둘, 파랑 하나. 마릿수는 2, 1, 0이 자리만 바뀌고, 안 되는 판이다.
  const story = T.why.colors[0].strips[0];
  for (const step of story.steps) assert.deepEqual(countsOf(toItems(step)).slice().sort(), [0, 1, 2]);
  assert.deepEqual(countsOf(toItems(story.steps[0])), [2, 1, 0]);
  assert.equal(solve({ kind: 'colors', counts: [2, 1, 0] }).possible, false);
  assert.equal(bruteColors({ kind: 'colors', counts: [2, 1, 0] }).possible, false);
  const [was, then, now] = story.steps.map((step) => countsOf(toItems(step)).join(', '));
  assert.equal(story.note, `빨강, 파랑, 노랑이 ${was}마리에서 ${then}마리, ${now}마리가 됐어요`);
  // 둘째 장의 표: 빨강 넷, 파랑 둘에서 한 번씩 만난 차례이고, 홀짝은 바뀌지만 세 나머지는 늘 모두 다르다.
  const table = T.why.colors[1].table;
  assert.deepEqual(table[0], [4, 2, 0]);
  for (let index = 1; index < table.length; index++) {
    const diff = table[index].map((count, color) => count - table[index - 1][color]).sort((a, b) => a - b);
    assert.deepEqual(diff, [-1, -1, 2], `${index}번`);
  }
  for (const row of table) assert.equal(new Set(remainders(row)).size, 3, row.join(','));
  assert.ok(table.some((row, index) => index > 0 && row[0] % 2 !== table[index - 1][0] % 2), '홀짝은 바뀐다');
  assert.equal(solve({ kind: 'colors', counts: table[0] }).possible, false);
  assert.equal(fill(T.table.rest, { n: 1, k: 2, f: 0 }), '1, 2, 0');
  // 셋째 장: 모두 한 색이면 두 색이 0마리라서 그 두 나머지가 같다.
  const end = countsOf(toItems(T.why.colors[2].strips[0].steps[0]));
  assert.ok(isDone({ kind: 'colors', counts: end }, toItems(T.why.colors[2].strips[0].steps[0])));
  assert.equal(new Set(remainders(end)).size, 2);
  // 넷째 장: 나머지가 같은 두 색이 있는 판(빨강 넷, 파랑 둘, 노랑 하나)은 가장 적게 4번 만나서 모두 파랑이 된다.
  const solved = T.why.colors[3].strips[0];
  const board = { kind: 'colors', counts: solved.board };
  assert.deepEqual(countsOf(toItems(solved.steps[0])), solved.board);
  assert.equal(solve(board).min, solved.moves);
  assert.equal(bruteColors(board).min, solved.moves);
  assert.equal(replay(board, solve(board).moves).items[0], solved.color);
  assert.ok(solved.note.includes(`${solved.moves}번`) && solved.note.includes(T.colors[solved.color]));
});

test('풀이와 직접 만들기의 글: 가장 적은 횟수와 되는지를 알려 준다', () => {
  assert.equal(fill(T.solution['cups-possible'], { k: 3 }), '가장 적게 3번 뒤집으면 모두 바로 서요. 한 가지 방법을 보여 줄게요.');
  assert.equal(fill(T.solution['colors-possible'], { k: 4 }), '가장 적게 4번 만나면 모두 한 색이 돼요. 한 가지 방법을 보여 줄게요.');
  assert.match(T.solution['cups-impossible'], /아무리 해도/);
  assert.match(T.solution['colors-impossible'], /아무리 해도/);
  assert.equal(fill(T.solution.stepLabel, { no: 2 }), '2번');
  assert.equal(fill(T.make['cups-possible'], { k: 2 }), '이 판은 모두 바로 세울 수 있어요. 가장 적게 2번 뒤집으면 돼요.');
  assert.equal(fill(T.make['colors-possible'], { k: 5 }), '이 판은 모두 한 색이 될 수 있어요. 가장 적게 5번 만나면 돼요.');
  assert.equal(fill(T.make.count, { n: 6 }), '6개');
  assert.equal(fill(T.make.each, { n: 3 }), '3개씩');
  assert.equal(fill(T.make.folk, { n: 2 }), '2마리');
  // 이미 끝난 판(모두 바로 섬, 한 색뿐)은 해 볼 것이 없어서 공책에 남기지도, 해 보지도 않는다.
  assert.match(code, /return isDone\(board, startItems\(board\)\) \? null : board;/);
  assert.match(code, /\$\('cups-make-play'\)\.disabled = done;/);
  assert.ok(T.make['keep-not-yet']);
});

test('index.html: 이 형식의 카드, 판, 판 아래, 도구, 답하는 칸, 직접 만들기가 있다', () => {
  for (const id of [
    'home-cups-sample',
    'home-cups-ask',
    'home-cups-play',
    'home-cups-pick',
    'home-cups-make',
    'home-cups-blank',
    'cups-board',
    'cups-count',
    'cups-status',
    'cups-flips',
    'cups-meets',
    'cups-notes',
    'cups-notes-table',
    'cups-pad',
    'cups-howto',
    'cups-picked',
    'cups-fewest',
    'cups-best',
    'cups-again',
    'cups-stop',
    'cups-maybe',
    'cups-impossible',
    'make-cups',
    'cups-make-kinds',
    'cups-make-cups',
    'cups-make-colors',
    'cups-make-n',
    'cups-make-k',
    'cups-make-all-down',
    'cups-make-all-up',
    'cups-make-board',
    'cups-make-result',
    'cups-make-solve',
    'cups-make-play',
  ]) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  for (const side of ['n', 'k', 'c0', 'c1', 'c2']) for (const way of ['fewer', 'more']) assert.ok(html.includes(`id="cups-make-${side}-${way}"`), `${side}-${way}`);
  for (const kind of ['cups', 'colors']) assert.match(part('id="make-cups"', 'id="make-dandelion"'), new RegExp(`data-kind="${kind}">${T.kinds[kind]}<`), kind);
  assert.match(html, /id="home-cups-ask"[^>]*>엎어진 컵을 모두 바로 세울 수 있을까요\?</);
  assert.equal(T.home.ask.cups, '엎어진 컵을 모두 바로 세울 수 있을까요?');
  // 카드는 강 건너기 뒤, "퍼즐 만들기" 앞에 있고, "만들기" 목록에도 있다.
  assert.ok(html.indexOf('id="river-title"') < html.indexOf('id="cups-title"'));
  assert.ok(html.indexOf('id="cups-title"') < html.indexOf('id="make-title"'));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-cups-make" class="menu-item"/);
  // 도구는 왼쪽 칸의 다른 도구 뒤, "왜 그럴까?" 앞에 있다.
  assert.match(html, /id="cups-notes" class="btn wide" type="button" aria-pressed="false" hidden>세어서 적어 보기</);
  assert.deepEqual(T.tool, { off: '세어서 적어 보기', on: '적은 것 감추기' });
  assert.match(part('id="cups-pad"', 'id="river-pad"'), /안 되는 판 같으면 ‘불가능해요’ 단추를 눌러요\./);
  // 틀이 형식을 안다.
  assert.match(read('src/main.js'), /river: createRiver\(frame\), cups: createCups\(frame\), /);
  assert.match(read('src/check-main.js'), /\['cups', '컵 뒤집기와 세 색 무리'\]/);
});

test('형식 모듈이 틀과 공책에 내놓는 것', () => {
  for (const name of ['begin(', 'solve(round)', 'valid(saved)', 'showParts(on)', 'ruleLine(round)', 'record(round, solution)', 'homeAsk:', 'drawSample(root, board)', 'drawBlank(root)', 'drawResume(root, saved)', 'drawLevelPicture(root, entry)']) {
    assert.ok(code.includes(name), name);
  }
  assert.match(code, /\n {4}madeBoard,\n/);
  // 도구를 켠 판은 힌트 하나를 연 판으로 센다.
  assert.match(code, /hintsOpened: round\.hintsOpened \+ \(round\.notesShown \? 1 : 0\),/);
  // 더 좋은 기록을 공책에 남기는 형식이 아니다(가장 적은 횟수는 판 안에서만 묻는다).
  assert.doesNotMatch(code, /bestOf/);
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
});

// ---- 수준 맞추기 ----
let nextId = 0;
function cups(overrides = {}) {
  nextId += 1;
  return {
    kind: 'round',
    id: `c${nextId}`,
    format: 'cups',
    level: 1,
    seed: nextId,
    custom: false,
    mode: 'maybe',
    outcome: 'solved',
    hintsOpened: 0,
    answers: [{ t: 30, answer: 'done', correct: true, guess: null }],
    moveCount: 2,
    wrongCount: null,
    seconds: 30,
    board: { kind: 'cups', n: 4, k: 2, cups: [1, 1, 1, 1] },
    solution: { possible: true, min: 2 },
    ...overrides,
  };
}

test('수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다', () => {
  const tuning = tuningFor('cups');
  assert.deepEqual([tuning.startLevel, tuning.bottomLevel, tuning.topLevel, tuning.hintCount], [1, 1, 6, 2]);
  for (const rung of LADDER.filter((item) => item.mode !== 'make')) assert.ok(tuning.expectedSeconds[rung.level] > 0, `${rung.level}단계의 예상 시간`);
  assert.equal(tuning.whyAfter, undefined);
  assert.deepEqual(recommend([], 'cups'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  assert.deepEqual(generateBoard(recommend([], 'cups').level, 1).board, { kind: 'cups', n: 4, k: 2, cups: [1, 1, 1, 1] });
  assert.match(read('src/core/level.js'), /컵 뒤집기와 세 색 무리\(모두 임시\)/);
  // 첫 답으로, 힌트 없이, 예상 시간보다 빠르게 두 판을 끝내면 더 어려운 판을 권한다. 도구를 켠 판은 힌트를 연 판이다.
  assert.equal(recommend([cups(), cups()], 'cups').offerHarder, true);
  assert.equal(recommend([cups(), cups({ hintsOpened: 1 })], 'cups').offerHarder, false);
  const retried = cups({ answers: [{ t: 9, answer: 'impossible', correct: false, guess: 'impossible-no-try' }, { t: 40, answer: 'done', correct: true, guess: null }] });
  assert.equal(recommend([cups(), retried], 'cups').offerHarder, false);
  // 가장 적게 뒤집는 판: 처음 끝낸 것이 가장 적은 횟수였으면 "한 번에"다.
  const fewest = (answers) => cups({ level: 2, mode: 'fewest', answers, seconds: 60 });
  assert.equal(recommend([fewest([{ answer: 'done:3', correct: true }]), fewest([{ answer: 'done:4', correct: true }])], 'cups').offerHarder, true);
  assert.equal(recommend([fewest([{ answer: 'done:3', correct: true }]), fewest([{ answer: 'done:5', correct: false }, { answer: 'done:3', correct: true }])], 'cups').offerHarder, false);
  // 그만두기가 이어지면 한 단계 아래를 먼저 보여 준다.
  const quit = (level) => cups({ level, outcome: 'left', answers: [], moveCount: 3 });
  assert.deepEqual(recommend([quit(3), quit(3)], 'cups'), { level: 2, small: false, offerHarder: false, harderLevel: null, reason: 'quit' });
  assert.deepEqual(recommend([quit(1), quit(1)], 'cups'), { level: 1, small: true, offerHarder: false, harderLevel: null, reason: 'quit' });
});

test('"왜 그럴까?"는 이 형식의 안 되는 판을 한 번 끝까지 만난 뒤에 열린다(틀의 문). 이 판에 하는 말로 알려 준다', () => {
  assert.equal(whyUnlocked([], 'cups'), false);
  assert.equal(whyUnlocked([cups(), cups({ level: 3 })], 'cups'), false, '되는 판만 끝낸 기록');
  const impossible = (overrides = {}) => cups({ solution: { possible: false, min: null }, answers: [{ t: 9, answer: 'impossible', correct: true, guess: null }], ...overrides });
  assert.equal(whyUnlocked([impossible({ outcome: 'left' })], 'cups'), false, '끝내지 않은 판');
  assert.equal(whyUnlocked([impossible({ side: true })], 'cups'), false, '작은 판');
  assert.equal(whyUnlocked([impossible()], 'cups'), true);
  assert.equal(whyUnlocked([impossible()], 'river'), false, '다른 형식');
  assert.match(read('src/main.js'), /if \(!solution\.possible && whyAvailable\(\)\) parts\.push\(F\.T\.right\['why-invite'\]\);/);
});

test('셋이 하나로: 묻는 말에 남길 색이 들어가고, 다른 색만 남으면 본 것 하나와 할 수 있는 일 하나를 말한다', () => {
  assert.equal(fill(T.asks.merge, { face: T.colors[2] }), '마지막에 노랑만 남게 할 수 있을까요?');
  assert.ok(code.includes('fill(ask, { face: targetName(board) })'));
  assert.equal(fill(T.stuck.merge, { face: '파랑' }), '파랑만 남아서 더 만날 수 없어요. 한 번 무르고 다르게 해 볼 수 있어요.');
  assert.equal(fill(T.right['merge-clean'], { face: '파랑', k: 2 }), '마지막에 파랑만 남았어요. 한 번도 무르지 않고 2번 만나게 했어요.');
  assert.equal(fill(T.right['impossible-merge-tried'], { face: '노랑', k: 4 }), '맞아요. 이 판은 아무리 해도 노랑만 남게 할 수 없어요. 4번 만나게 해 보고 알아냈어요.');
  assert.equal(fill(T.solution['merge-possible'], { k: 4, face: '빨강' }), '가장 적게 4번 만나면 빨강만 남아요. 한 가지 방법을 보여 줄게요.');
  assert.equal(T.status.over, '더 만날 방울이가 없어요');
  // 같은 방울이 그림을 쓴다(색마다 머리 모양이 다르다).
  assert.ok(code.includes("const art = (kind) => (kind === 'cups' ? 'cups' : 'colors');"));
});

test('셋이 하나로의 "왜 그럴까?": 그림의 차례는 모두 규칙에 맞는 만남이고, 표의 홀짝과 이야기가 풀이 프로그램과 맞다', () => {
  const merge = (counts, target) => ({ kind: 'merge', counts, target });
  for (const slide of T.why.merge) {
    for (const strip of slide.strips) {
      const steps = strip.steps.map(toItems);
      const board = merge(countsOf(steps[0]), 0);
      for (let index = 1; index < steps.length; index++) {
        // 이어진 두 그림 사이에는 색이 다른 둘의 만남 하나가 있다.
        const before = steps[index - 1];
        let found = false;
        for (let a = 0; a < before.length; a++) {
          for (let b = a + 1; b < before.length; b++) {
            if (checkMove(board, before, [a, b]) === null && JSON.stringify(applyMove(board, before, [a, b])) === JSON.stringify(steps[index])) found = true;
          }
        }
        assert.ok(found, strip.note);
      }
    }
  }
  // 첫 장: 빨강 둘, 파랑 하나, 노랑 둘. 두 차례 모두 파랑만 남고, 노랑만 남기는 것은 안 된다.
  for (const strip of T.why.merge[0].strips) {
    assert.deepEqual(countsOf(toItems(strip.steps[0])), [2, 1, 2]);
    assert.ok(toItems(strip.steps.at(-1)).every((color) => color === 1), strip.note);
  }
  assert.equal(solve(merge([2, 1, 2], 2)).possible, false);
  assert.deepEqual(bruteMerge(merge([2, 1, 2], 2)).ends, [1]);
  // 둘째 장의 표: 한 번씩 만난 차례(둘은 하나 줄고 하나는 하나 는다). 세 홀짝이 함께 바뀌고 빨강과 노랑은 늘 홀짝이 같다.
  const table = T.why.merge[1].table;
  assert.deepEqual(table[0], [2, 1, 2]);
  for (let index = 1; index < table.length; index++) {
    const diff = table[index].map((count, color) => count - table[index - 1][color]).sort((a, b) => a - b);
    assert.deepEqual(diff, [-1, -1, 1], `${index}번`);
  }
  for (const row of table) {
    assert.equal(row[0] % 2, row[2] % 2, row.join(','));
    assert.notEqual(row[0] % 2, row[1] % 2, row.join(','));
  }
  assert.deepEqual(table.at(-1), [0, 1, 0]);
  assert.deepEqual([T.table.parity, T.table.odd, T.table.even], ['홀짝', '홀', '짝']);
  // 넷째 장: 한 마리씩인 판은 만나는 둘에 따라 세 색이 다 남는다.
  const last = T.why.merge[3].strips.map((strip) => toItems(strip.steps.at(-1))[0]).sort();
  assert.deepEqual(last, [0, 1, 2]);
  for (const strip of T.why.merge[3].strips) assert.ok(strip.note.includes(T.colors[toItems(strip.steps.at(-1))[0]]), strip.note);
  assert.deepEqual(bruteMerge(merge([1, 1, 1], 0)).ends, [0, 1, 2]);
});

test('직접 만들기는 7단계다. 예전 번호(6단계)로 적어 둔 직접 만든 판도 하던 판으로 받고, 만들어 낸 판은 단계의 판의 종류와 맞아야 받는다', () => {
  assert.deepEqual([MAKE_LEVEL, OLD_MAKE_LEVEL], [7, 6]);
  assert.ok(code.includes("if (saved.custom === true) return [MAKE_LEVEL, OLD_MAKE_LEVEL].includes(saved.level) && saved.mode === 'maybe' && ['cups', 'colors'].includes(saved.board.kind);"));
  assert.ok(code.includes('return rung.mode === saved.mode && rung.boards.some((entry) => entry[0] === saved.board.kind);'));
  assert.equal(rungOf(OLD_MAKE_LEVEL).ask, 'merge');
  // 셋이 하나로는 직접 만들기에 없다.
  assert.doesNotMatch(part('id="make-cups"', 'id="make-dandelion"'), /data-kind="merge"/);
});
