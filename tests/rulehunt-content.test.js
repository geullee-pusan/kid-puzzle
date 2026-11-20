// 숨은 규칙 찾기 대본 점검: 화면에 나오는 글이 약속을 지키는지, 그림 속의 판과 답과 주장이 규칙과 맞는지 본다.
// 묻는 말에는 돼요와 안 돼요만 답한다, 어긋난 갈라 보기를 틀렸다고 하지 않는다, 몇 번 물었는지 보여 주지 않는다,
// 힌트는 두 높이, "왜 그럴까?"는 알아챈 이야기, 생각의 이름은 셋째 장에서 처음, 화면 코드와 틀에 이 형식이 이어져 있는지도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, rungOf } from '../src/core/rulehunt-ladder.js';
import { TOPS, TRIPLE_RULES, checkBoard, classesOf, fitting, holds, libraryOf, parseAtom, parseRule } from '../src/core/rulehunt.js';
import { smallerRulehunt } from '../src/core/smaller.js';
import { endsClosed, fill, sentenceCount } from '../src/core/text.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/rulehunt.json'));
const html = read('index.html');
const code = read('src/formats/rulehunt.js');

const VALUES = { k: 12, f: '짝수이면서', n: 3, no: 2, face: '짝수', total: 30 };

/** 대본의 모든 글(값)을 길과 함께 모은다. 설명(_로 시작하는 것)과 그림의 값(판, 물어본 것, 표시한 것)은 뺀다. */
function allStrings(value, path = '') {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((item, index) => allStrings(item, `${path}[${index}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .filter(([key]) => !key.startsWith('_') && !['board', 'asked', 'marks'].includes(key))
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
const own = [
  part('id="rulehunt-title"', 'id="make-title"'),
  part('id="rulehunt-board"', 'id="code-board"'),
  part('id="rulehunt-count"', 'id="undo"'),
  part('id="rulehunt-pad"', 'id="dandelion-pad"'),
  part('id="make-rulehunt"', '<script'),
]
  .map(visibleText)
  .join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const figures = T.why.flatMap((slide) => slide.figures);

/** 규칙의 이름표 → 화면에서 부르는 이름(형식의 nameOf와 같게) */
function nameOf(rule) {
  const parsed = parseRule(rule);
  const atom = (id, form) => {
    const { kind, k } = parseAtom(id);
    return fill(T.names[kind][form], { k: k ?? 0 });
  };
  if (parsed.op === 'triple') return T.triples[rule];
  if (parsed.op === 'one') return atom(rule, 'noun');
  return fill(T.joined, { f: atom(parsed.a, parsed.op), face: atom(parsed.b, 'noun') });
}

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 단계 목록이 사다리와 같다', () => {
  assert.equal(T.title, '숨은 규칙 찾기');
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.deepEqual(T.levels.map((item) => item.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(T.levels.map((item) => item.name), ['한 가지 규칙', '처음 떠오른 생각', '두 가지를 이은 규칙', '세 수의 규칙', '직접 만들기']);
});

test('규칙의 이름: 모든 범위의 모든 후보 규칙과 세 수의 규칙에 이름이 있고, 모두 "수"로 끝나며 서로 다르다', () => {
  for (const top of TOPS) {
    const names = libraryOf({ kind: 'number', top, lib: 'two' }).map(nameOf);
    for (const name of names) assert.match(name, /수$/, name);
    assert.equal(new Set(names).size, names.length, `${top}: 같은 이름이 있어요`);
  }
  for (const rule of TRIPLE_RULES) assert.match(T.triples[rule], /수$/, rule);
  assert.deepEqual(Object.keys(T.triples), TRIPLE_RULES);
  assert.equal(nameOf('even&lt20'), '짝수이면서 20보다 작은 수');
  assert.equal(nameOf('m3|d5'), '3의 배수이거나 일의 자리가 5인 수');
  assert.equal(nameOf('gt15'), '15보다 큰 수');
  assert.equal(nameOf('odd&gt30'), '홀수이면서 30보다 큰 수');
  // 형식도 같은 방법으로 이름을 짓는다.
  assert.match(code, /return fill\(T\.joined, \{ f: atomName\(parsed\.a, parsed\.op\), face: atomName\(parsed\.b, 'noun'\) \}\);/);
  // 이름은 "수"로 끝나서 뒤에 '였어요', '예요'가 붙는다.
  assert.equal(fill(T.right.solved, { face: nameOf('even') }), '모두 맞게 갈랐어요. 숨은 규칙은 ‘짝수’였어요.');
  assert.equal(fill(T.solution.rule, { face: nameOf('m5') }), '숨은 규칙은 ‘5의 배수’예요. 돼요인 수를 모두 표시했어요.');
});

test('규칙 설명은 세 문장 안이고, 묻는 법과 "알 것 같아요"를 말한다. 직접 만들기의 안내 글도 세 문장 안이다', () => {
  assert.deepEqual(Object.keys(T.rules).sort(), ['both', 'one', 'trap', 'triple']);
  for (const rung of LADDER.filter((item) => item.mode !== 'make')) assert.ok(T.rules[rung.hint], rung.level);
  for (const rule of Object.values(T.rules)) {
    assert.ok(sentenceCount(rule) <= 3, rule);
    assert.match(rule, /돼요인지/);
    assert.match(rule, /‘알 것 같아요’를 눌러/);
  }
  assert.match(T.rules.triple, /‘물어보기’를 누르면/);
  // 형식이 단계(직접 만든 판은 목록)로 규칙 글과 힌트를 고른다.
  assert.match(code, /const hintKey = \(round\) => \(round\.custom \? \(round\.board\.lib === 'two' \? 'both' : 'one'\) : rungOf\(round\.level\)\.hint\);/);
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 22);
  assert.ok(sentenceCount(guides[13]) <= 3, guides[13]);
  assert.match(guides[13], /선생님이 오래 물어야 찾는 규칙도 만들 수 있을까요\?$/);
});

test('묻는 말에는 돼요와 안 돼요만 답한다. 수 뒤에 붙는 말(은, 는)은 읽는 소리로 고른다', () => {
  const line = (x, yes) => fill(T.play[`${yes ? 'yes' : 'no'}-${endsClosed(Array.isArray(x) ? x.at(-1) : x) ? 'closed' : 'open'}`], { k: Array.isArray(x) ? x.join(T.tripleJoin) : x });
  assert.equal(line(13, true), '13은 돼요.');
  assert.equal(line(12, true), '12는 돼요.');
  assert.equal(line(10, false), '10은 안 돼요.');
  assert.equal(line(25, false), '25는 안 돼요.');
  assert.equal(line([2, 4, 6], true), '2, 4, 6은 돼요.');
  assert.equal(line([1, 3, 5], false), '1, 3, 5는 안 돼요.');
  assert.match(code, /const key = `\$\{yes \? 'yes' : 'no'\}-\$\{endsClosed\(lastOf\(item\)\) \? 'closed' : 'open'\}`;/);
  for (const key of ['yes-closed', 'yes-open', 'no-closed', 'no-open']) {
    assert.equal(T.status[key], T.play[key].replace(/\.$/, ''));
  }
});

test('갈라 보기: 어긋나도 틀렸다고 하지 않는다. 몇 개가 다르게 갈리는지와 판의 표시만 말하고, 더 물어볼 수 있다고 한다', () => {
  const said = [...Object.values(T.play), ...Object.values(T.right), ...Object.values(T.status)].join(' ');
  assert.doesNotMatch(said, /틀렸|틀린|아니에요|땡|정답|아쉽|잘했|훌륭|대단|실수/);
  assert.equal(fill(T.play['check-miss'], { n: 2 }), '2개는 숨은 규칙이 다르게 갈라요. 판에 두 겹 테두리로 표시해 두었어요.');
  assert.equal(T.play['check-more'], '더 물어볼 수도 있어요.');
  // 확인만 한 물음은 사실로만 한 번 말한다(아이가 물어본 것이 둘 이상이고 모두 돼요였을 때, 한 판에 한 번).
  assert.equal(T.play['check-all-yes'], '알 것 같아요를 누르기 전에 물어본 것은 모두 돼요였어요.');
  assert.match(code, /const allYes = own\.length >= 2 && own\.every\(\(entry\) => entry\.yes\);/);
  assert.match(code, /if \(allYes && !round\.allYesSaid\) \{/);
  // 갈라 본 것은 모두 물어본 것이 된다.
  assert.match(code, /round\.asked = \[\.\.\.round\.asked, \.\.\.list\.map\(\(x\) => \(\{ x, yes: holds\(round\.board\.rule, x\), from: 'check', left: null \}\)\)\];/);
  // 갈라 볼 것은 다른 후보를 모두 가르는 것으로, 판 번호와 몇 번째 갈라 보기인지로 정한 시드로 고른다.
  assert.match(code, /pickCheck\(round\.board, items\(round\), seedFrom\(FORMAT, round\.id, round\.checks\.length\)\)/);
  assert.doesNotMatch(code, /Math\.random/);
});

test('몇 번 물었는지, 몇 번 맞혔는지는 화면에 보여 주지 않는다(기록에만 남긴다)', () => {
  const foot = part('id="rulehunt-count"', 'id="undo"');
  assert.equal([...foot.matchAll(/<strong/g)].length, 0);
  assert.doesNotMatch(visibleText(foot), /\d|번|개/);
  for (const [path, text] of strings) assert.doesNotMatch(text, /물어본 수가? \{n\}|\{n\}번 물/, path);
  assert.match(code, /askCount: round\.askCount,/);
  assert.match(code, /askedBeforeCheck: before\.map\(\(entry\) => entry\.x\),/);
});

test('힌트는 판마다 두 개이고, 하나하나가 질문 한 문장이다. 생각의 이름(깨 보기)은 힌트에서 말하지 않는다', () => {
  assert.deepEqual(Object.keys(T.hints).sort(), ['both', 'one', 'trap', 'triple']);
  for (const [key, list] of Object.entries(T.hints)) {
    assert.equal(list.length, 2, key);
    assert.notEqual(list[0], list[1]);
    for (const hint of list) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
      assert.doesNotMatch(hint, /깨/, hint);
    }
  }
});

test('글의 빈칸({이름})은 정해진 이름만 쓰고, 채울 값이 모자라지 않는다', () => {
  const allowed = new Set(['k', 'f', 'n', 'no', 'total', 'level', 'tag', 'face']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
    assert.ok(fill(text, VALUES).length > 0, path);
  }
  assert.equal(fill(T.cellState.yes, { k: 7 }), '7, 돼요');
  assert.equal(fill(T.cellState.no, { k: 7 }), '7, 안 돼요');
});

test('화면 글에 영어 낱말이 없고, "~요"로 끝나는 말투다. 한 문장은 60자를 넘지 않는다', () => {
  for (const [path, text] of strings) assert.doesNotMatch(text.replace(/\{[^{}]*\}/g, ''), /[A-Za-z]/, `${path}: ${text}`);
  assert.doesNotMatch(own, /[A-Za-z]/);
  const spoken = [
    ...Object.values(T.home.ask),
    T.home.pick,
    ...Object.values(T.rules),
    ...Object.values(T.play),
    ...Object.values(T.hints).flat(),
    ...Object.values(T.right),
    T.solution.rule,
    T.solution['rule-triple'],
    T.solution.rivals,
    T.solution['no-rivals'],
    T.make.intro,
    T.make.found,
    T.make['found-same'],
    T.make.empty,
    T.make.full,
    T.make['keep-not-yet'],
    ...T.why.map((slide) => slide.say),
  ];
  for (const text of spoken) for (const sentence of sentences(text)) assert.match(sentence, /요[.?!]$/, sentence);
  for (const text of [...Object.values(T.status), ...Object.values(T.cellState), T.solution['rivals-more'], T.solution.note]) assert.match(text, /요$/, text);
  for (const item of figures) assert.match(item.note, /요$/, item.note);
  for (const [path, text] of strings) for (const sentence of sentences(text)) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

test('생각의 이름("깨 보기")은 "왜 그럴까?"의 셋째 장에서 처음 말한다', () => {
  const name = /깨 보기/;
  for (const [path, text] of strings.filter(([path]) => !path.startsWith('why'))) assert.doesNotMatch(text, name, path);
  assert.doesNotMatch(visibleText(html), name);
  assert.doesNotMatch(T.why[0].say + T.why[1].say, name);
  assert.match(T.why[2].say, /선생님은 이렇게 묻는 것을 깨 보기라고 불러요\.$/);
});

test('"왜 그럴까?"는 그림 서너 장의 알아챈 이야기다. 그림 속의 판, 답, 주장은 규칙으로 다시 구한 것과 같다', () => {
  assert.equal(T.why.length, 4);
  for (const slide of T.why) {
    assert.ok(sentenceCount(slide.say) <= 3, slide.say);
    assert.ok(slide.figures.length >= 1 && slide.figures.length <= 2);
  }
  for (const item of figures) {
    assert.equal(checkBoard(item.board), null, item.note);
    const known = [...item.board.given, ...item.asked];
    for (const mark of item.marks ?? []) assert.ok(known.some((other) => JSON.stringify(other) === JSON.stringify(mark)), item.note);
  }
  const even = T.why[0].figures[0].board;
  assert.equal(even.rule, 'even');
  // 첫 장: 6, 16, 26에는 짝수도, 일의 자리가 6인 수도 맞는다(선생님은 좁은 쪽을 떠올렸다).
  assert.deepEqual(even.given, [6, 16, 26]);
  const fit = fitting(even, even.given).fit.flatMap((group) => group.rules);
  assert.ok(fit.includes('even') && fit.includes('d6'));
  // 둘째 장: 36과 46은 두 생각 모두 돼요라서 갈리지 않았다. 갈라 보니 12는 짝수로는 돼요, 일의 자리가 6인 수로는 안 돼요였다.
  for (const x of [36, 46]) assert.ok(holds('even', x) && holds('d6', x));
  assert.deepEqual(fitting(even, [...even.given, 36, 46]).fit.flatMap((group) => group.rules).filter((rule) => ['even', 'd6'].includes(rule)), ['even', 'd6']);
  assert.ok(holds('even', 12) && !holds('d6', 12));
  assert.deepEqual(T.why[1].figures[0].marks, [12]);
  assert.match(T.why[1].say, /36과 46을 물었더니 둘 다 돼요였어요\./);
  // 셋째 장: 8은 생각(일의 자리가 6)대로라면 안 돼요인데 숨은 규칙으로는 돼요다(생각이 깨진다).
  assert.deepEqual(T.why[2].figures[1].asked, [8]);
  assert.ok(holds('even', 8) && !holds('d6', 8));
  assert.match(T.why[2].figures[0].note, /생각대로라면 돼요인 수예요$/);
  assert.match(T.why[2].figures[1].note, /생각대로라면 안 돼요인 수예요$/);
  // 넷째 장: 까닭이 그대로는 통하지 않는 판. 1, 3, 5는 달라 보여도 2씩 커지는 세 수라서, 숨은 규칙(점점 커지는 세 수)과 같은 답이 나온다.
  const triple = T.why[3].figures[0];
  assert.equal(triple.board.rule, 'inc');
  assert.deepEqual(triple.board.given, [[2, 4, 6]]);
  assert.deepEqual(triple.asked, [[1, 3, 5]]);
  for (const item of [[2, 4, 6], [1, 3, 5]]) assert.ok(holds('plus2', item) && holds('inc', item));
  assert.match(T.why[3].say, /깨 보기가 아니었어요\.$/);
  // 판을 끝까지 하고 갈라 본 것이 한 번 어긋났거나 판을 둘 끝까지 한 뒤에 열린다(src/core/rulehunt.js의 whyOpen).
  assert.match(code, /if \(!whyOpen\(frame\.records\(\)\)\) return null;/);
});

test('판 고르기의 그림: 단계마다 그 단계의 판이고, 물어본 것은 범위 안의 처음 받지 않은 것이다', () => {
  for (const entry of T.levels) {
    const rung = rungOf(entry.level);
    if (rung.mode === 'make') {
      assert.equal(entry.picture.blank, true);
      continue;
    }
    const { board, asked } = entry.picture;
    assert.equal(checkBoard(board), null, entry.name);
    assert.equal(board.kind, rung.mode);
    assert.equal(board.lib, rung.lib);
    assert.equal(board.top, rung.top);
    for (const item of asked) assert.ok(!board.given.some((other) => JSON.stringify(other) === JSON.stringify(item)), entry.name);
  }
});

test('"더 작은 판으로": 사다리의 판마다 같은 숨은 규칙의 더 좁은 범위의 판을 낸다(없으면 내지 않는다)', () => {
  let some = 0;
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (let seed = 1; seed <= 12; seed++) {
      const { board } = generateBoard(level, seed);
      const small = smallerRulehunt({ mode: board.kind, board }, 0);
      if (!small) continue;
      some += 1;
      assert.ok(small.board.top < board.top);
      assert.equal(small.board.rule, board.rule);
      assert.equal(small.board.kind, board.kind);
      assert.equal(checkBoard(small.board), null);
      assert.deepEqual(smallerRulehunt({ board }, 0), small, '같은 판, 같은 차례에는 같은 작은 판');
      // 범위가 좁으면 견주어 볼 후보도 줄거나 같다.
      assert.ok(classesOf(small.board).length <= classesOf(board).length);
    }
  }
  assert.ok(some >= 30, String(some));
  assert.equal(smallerRulehunt({ board: null }), null);
});

test('직접 만들기: 성질 하나나 둘을 이어 규칙을 고르면, 선생님이 아무것도 모르는 데서부터 물어서 찾는다', () => {
  const make = part('id="make-rulehunt"', '<script');
  for (const id of ['rulehunt-make-kind-a', 'rulehunt-make-param-a', 'rulehunt-make-value-a', 'rulehunt-make-join', 'rulehunt-make-second', 'rulehunt-make-kind-b', 'rulehunt-make-value-b', 'rulehunt-make-range', 'rulehunt-make-name', 'rulehunt-make-board', 'rulehunt-make-solve', 'rulehunt-make-result']) {
    assert.ok(make.includes(`id="${id}"`), id);
  }
  assert.match(make, /id="rulehunt-make-solve"[^>]*>선생님, 찾아 보세요</);
  assert.deepEqual(Object.keys(T.make.kinds), ['even', 'odd', 'mult', 'ones', 'gt', 'lt']);
  assert.equal(fill(T.make.found, { n: 8, face: '짝수이면서 20보다 작은 수' }), '수 8개를 물어서 찾았어요. ‘짝수이면서 20보다 작은 수’ 같아요. 칸 위의 작은 수는 물어본 차례예요.');
  assert.match(T.make['keep-not-yet'], /바꿔 볼까요\?$/);
  // 선생님은 아이가 하나를 골랐는지 둘을 이었는지 모르므로 둘을 이은 규칙까지 견주어 본다.
  assert.match(code, /const result = findRule\(\{ \.\.\.made, lib: 'two' \}\);/);
  assert.match(code, /\n {4}madeBoard,\n/);
  assert.match(code, /if \(yes\.length === 0 \|\| yes\.length === draft\.top\) return null;/);
  // "짝수", "홀수"는 다른 형식에서 까닭의 말이라 첫 화면 파일에 적지 않고 대본에서 단추에 넣는다.
  assert.doesNotMatch(visibleText(make), /짝수|홀수/);
  assert.match(code, /button\.textContent = T\.make\.kinds\[button\.dataset\.kind\];/);
});

test('index.html: 이 형식의 카드, 판, 판 아래, 답하는 칸, 직접 만들기가 있다. 틀에 이어져 있다', () => {
  for (const id of [
    'home-rulehunt-sample',
    'home-rulehunt-ask',
    'home-rulehunt-play',
    'home-rulehunt-pick',
    'home-rulehunt-make',
    'home-rulehunt-blank',
    'rulehunt-board',
    'rulehunt-count',
    'rulehunt-status',
    'rulehunt-pad',
    'rulehunt-ask-box',
    'rulehunt-triple',
    'rulehunt-slots',
    'rulehunt-keys',
    'rulehunt-erase',
    'rulehunt-ask',
    'rulehunt-know-box',
    'rulehunt-know',
    'rulehunt-check',
    'rulehunt-check-list',
    'rulehunt-check-done',
    'make-rulehunt',
  ]) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(part('id="rulehunt-title"', '</section>'), /<h2 id="rulehunt-title">숨은 규칙 찾기<\/h2>/);
  assert.ok(visibleText(part('id="rulehunt-title"', '</section>')).includes(T.home.ask.one));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-rulehunt-make" class="menu-item"/);
  assert.match(part('id="rulehunt-know-box"', 'id="rulehunt-check"'), /id="rulehunt-know"[^>]*>알 것 같아요</);
  assert.match(part('id="rulehunt-check"', 'id="dandelion-pad"'), /id="rulehunt-check-done"[^>]*>다 골랐어요</);
  // 세 수의 수 단추는 1부터 20까지(세 수 판의 범위)
  assert.equal([...part('id="rulehunt-keys"', 'id="rulehunt-erase"').matchAll(/data-n="(\d+)"/g)].map((match) => Number(match[1])).join(), Array.from({ length: 20 }, (_, index) => index + 1).join());
  // 틀이 형식을 안다(형식 목록에서 주사위 미로 다음).
  assert.match(read('src/main.js'), /maze: createMaze\(frame\), rulehunt: createRulehunt\(frame\), /);
  assert.match(read('src/check-main.js'), /\['rulehunt', '숨은 규칙 찾기'\]/);
  // 앞의 형식이 보이게 해 둔 무르기와 되돌리기를 켜질 때 감춘다.
  assert.match(code, /if \(on\) \{\s*\/\/[^\n]*\n\s*\$\('undo'\)\.hidden = true;\s*\$\('reset'\)\.hidden = true;/);
  // 지난 기록은 틀이 건네주는 것(작은 판을 뺀 기록)으로 본다.
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
});

/** 끝까지 한 판의 기록 하나 */
function finished(more = {}) {
  return { kind: 'round', id: `r-${Math.random()}`, format: 'rulehunt', level: 1, seed: 2, custom: false, mode: 'number', outcome: 'solved', hintsOpened: 0, answers: [{ t: 30, answer: 'check:1/2/3/4=no/yes/no/yes', correct: true, guess: null }], wrongCount: 0, failedChecks: 0, moveCount: 5, seconds: 90, ...more };
}

test('수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다. 몇 번 물었는지는 보지 않는다', () => {
  const tuning = tuningFor('rulehunt');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 4);
  assert.equal(tuning.hintCount, 2);
  assert.equal(tuning.whyAfter, 'finished');
  assert.match(read('src/core/level.js'), /숨은 규칙 찾기\(모두 임시\)/);
  assert.deepEqual(recommend([], 'rulehunt'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  // 처음 갈라 보기에서 모두 맞게 가르고 빨리 끝낸 판이 이어지면 더 어려운 판을 권한다. 많이 물어도 상관없다.
  assert.deepEqual(recommend([finished(), finished({ moveCount: 40 })], 'rulehunt'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  assert.equal(recommend([finished(), finished({ wrongCount: 1, failedChecks: 1 })], 'rulehunt').offerHarder, false);
  assert.equal(recommend([finished(), finished({ seconds: 400 })], 'rulehunt').offerHarder, false);
  // 연달아 그만두면 맨 아래 단계에서는 작은 판부터 보여 준다.
  assert.deepEqual(recommend([finished({ outcome: 'left' }), finished({ outcome: 'left' })], 'rulehunt'), { level: 1, small: true, offerHarder: false, harderLevel: null, reason: 'quit' });
});

test('틀의 "왜 그럴까?" 문: 이 형식의 판을 한 번 끝까지 하면 막지 않는다(갈라 보기가 어긋났거나 둘 끝낸 뒤에 여는 것은 이 형식이 본다)', () => {
  assert.equal(whyUnlocked([], 'rulehunt'), false);
  assert.equal(whyUnlocked([finished({ outcome: 'left' })], 'rulehunt'), false);
  assert.equal(whyUnlocked([finished()], 'rulehunt'), true);
  assert.equal(MAKE_LEVEL, 5);
});
