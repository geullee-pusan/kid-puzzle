// 조각 덮기 대본 점검: 화면에 나오는 글이 약속을 지키는지, 그림 속의 판과 수가 풀이 프로그램과 맞는지 본다.
// 첫 단계는 덮기만 하면 된다, 힌트는 두 높이, 막혔을 때는 본 것 하나와 할 수 있는 일 하나,
// "왜 그럴까?"는 알아챈 이야기, ㄱ자 세 칸에는 까닭을 붙이지 않는다는 것도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { TUNING, recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { fill, ordinal, sentenceCount } from '../src/core/text.js';
import { LADDER, MAKE_LEVEL, generateBoard, possibleHoles, rungOf } from '../src/core/tile-ladder.js';
import { MAX_SIZE, MIN_SIZE, PATTERNS, PIECE_IDS, checkBoard, colorCounts, colorOf, deadCells, isStuck, placementsOf, replay, shapeOf, solve, whyOpen, xyOf } from '../src/core/tile.js';
import { loopOf } from './helpers/brute-tile.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/tile.json'));
const C = JSON.parse(read('src/content/coins.json'));
const html = read('index.html');

const RULE_KEYS = ['cover', 'domino', 'bar', 'ell'];
const GUESS_KEYS = ['impossible-no-try', 'impossible-other-start'];
const STUCK_KEYS = ['plain', 'same', 'same-start'];
const STATUS_KEYS = ['stuck', 'done', 'more-1', 'more-2', 'few', 'shape-bar', 'shape-ell', 'cannot'];
const RIGHT_KEYS = ['covered-clean', 'covered-back', 'covered-stuck', 'impossible-tried', 'impossible-some', 'impossible-untried', 'ell-no-reason', 'after-retry', 'why-invite'];
const WHY_PIECES = ['domino', 'bar'];

/** 대본의 모든 글(값)을 길과 함께 모은다. 설명(_로 시작하는 것)과 그림의 값(조각, 무늬의 이름)은 뺀다. */
function allStrings(value, path = '') {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((item, index) => allStrings(item, `${path}[${index}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .filter(([key]) => !key.startsWith('_') && key !== 'piece' && !(key === 'pattern' && typeof value[key] === 'string'))
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
const screenText = visibleText(html);
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const part = (from, to) => html.slice(html.indexOf(from), html.indexOf(to, html.indexOf(from)));
const place = (cells) => ({ op: 'place', cells });
const slides = WHY_PIECES.flatMap((piece) => T.why[piece]);
const figures = slides.flatMap((slide) => slide.figures);

test('대본을 읽을 수 있고, 글이 비어 있지 않다', () => {
  assert.ok(strings.length > 70);
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.equal(T.title, '조각 덮기');
  assert.deepEqual(Object.keys(T.pieces), PIECE_IDS);
  assert.deepEqual(Object.values(T.pieces), ['도미노', '일자 세 칸', 'ㄱ자 세 칸']);
});

test('단계 목록이 사다리와 같고, 표시는 기본·응용·응용·도전·도전이다', () => {
  assert.deepEqual(T.levels.map((entry) => entry.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(LADDER.map((rung) => C.tags[rung.tag]), ['기본', '응용', '응용', '도전', '도전']);
  assert.equal(T.levels.at(-1).level, MAKE_LEVEL);
  assert.equal(T.levels.at(-1).name, '직접 만들기');
  assert.match(T.levels[0].name, /도미노/);
  assert.match(T.levels[2].name, /ㄱ자/);
  assert.match(T.levels[3].name, /일자/);
});

test('규칙 설명은 세 문장을 넘지 않고, 조각이 어떤 칸을 덮는지 말한다', () => {
  assert.deepEqual(Object.keys(T.rules).sort(), [...RULE_KEYS].sort());
  for (const key of RULE_KEYS) assert.ok(sentenceCount(T.rules[key]) <= 3, `${key}: ${T.rules[key]}`);
  assert.match(T.rules.cover, /이웃한 두 칸을 덮는 조각/);
  assert.match(T.rules.bar, /한 줄로 나란한 세 칸/);
  assert.match(T.rules.ell, /ㄱ자로 꺾인 세 칸/);
  for (const key of ['cover', 'domino', 'bar', 'ell']) assert.match(T.rules[key], /빈칸을 모두 덮/, key);
  // 조각은 얼마든지 쓸 수 있고 돌려 놓아도 된다는 것, 놓고 들어내는 방법은 답하는 칸에 늘 적혀 있다.
  const pad = visibleText(part('id="tile-pad"', 'id="code-pad"'));
  assert.match(pad, /조각은 얼마든지 쓸 수 있고, 돌려 놓아도 돼요\./);
  assert.match(pad, /칸을 따라 그으면 조각이 놓여요\. 칸을 하나씩 눌러도 돼요\. 놓인 조각을 누르면 빠져요\./);
  // 직접 만들기 화면의 안내 글도 같다. 안 되는 판을 만들어 보라고 권한다.
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 17, '직접 만들기 안내 글은 형식마다 하나');
  assert.ok(sentenceCount(guides[4]) <= 3, guides[4]);
  assert.match(guides[4], /덮을 수 없는 판도 만들 수 있을까요\?/);
});

test('형식의 첫 단계는 덮기만 하면 된다: 늘 되는 판이고, "불가능해요"도 횟수도 묻지 않는다', () => {
  assert.equal(rungOf(1).mode, 'cover');
  assert.equal(tuningFor('tile').startLevel, 1);
  assert.doesNotMatch(T.rules.cover, /불가능|안 되는 판|가장 적|몇 개로/);
  assert.doesNotMatch(T.home.ask.cover, /안 되|불가능/);
  // 1단계의 답하는 칸에는 단추가 없다. "불가능해요"는 되는 판과 안 되는 판이 섞이는 단계에만 있다.
  assert.doesNotMatch(part('id="tile-cover"', 'id="tile-either"'), /<button/);
  assert.match(part('id="tile-either"', 'id="code-pad"'), /id="tile-impossible"[^>]*>불가능해요</);
  for (const key of ['domino', 'bar', 'ell']) assert.match(T.rules[key], /안 되는 판 같으면 ‘불가능해요’ 단추를 눌러요\.$/, key);
  // 판 아래에는 남은 빈칸의 수를 사실로만 적는다.
  assert.match(html, /남은 빈칸 <strong id="tile-left">0<\/strong>칸/);
  for (let seed = 1; seed <= 40; seed++) assert.equal(generateBoard(1, seed).solution.possible, true);
});

test('힌트는 조각마다 두 개이고, 하나하나가 질문 한 문장이다', () => {
  assert.deepEqual(Object.keys(T.hints), PIECE_IDS);
  for (const piece of PIECE_IDS) {
    const hints = T.hints[piece];
    assert.equal(hints.length, tuningFor('tile').hintCount, piece);
    assert.equal(hints.length, 2, piece);
    for (const hint of hints) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
    }
    assert.equal(new Set(hints).size, hints.length, `${piece}: 같은 힌트가 두 번 있어요`);
  }
});

test('힌트는 두 높이다: 첫째는 무엇을 해 볼지만, 둘째는 어디를 볼지까지만 묻는다. 까닭을 말해 버리지 않는다', () => {
  for (const piece of PIECE_IDS) {
    const [first, second] = T.hints[piece];
    // 첫째: 어느 판에서나 쓸 수 있는 일반 질문이다. 판의 어느 곳도 가리키지 않는다.
    assert.doesNotMatch(first, /구석|가장자리|빠진 칸|가운데|둘레/, first);
    // 둘째: 볼 곳(구석 칸, 빠진 칸의 옆이나 둘레)을 가리킨다.
    assert.match(second, /구석 칸|빠진 칸/, second);
    // 답을 말해 버리지 않는다: 무늬, 색, 세어 보라는 말, 요령이 들어 있지 않다.
    for (const hint of [first, second]) {
      assert.doesNotMatch(hint, /무늬|색|세어|바둑판|줄무늬|짝수|홀수|넷으로|때문이에요|해야 해요|하면 돼요/, hint);
    }
  }
  assert.match(T.hints.domino[0], /더 작은 판이라면/);
  assert.match(T.hints.bar[0], /아직 한 번도 덮어 보지 않은 칸/);
  assert.match(T.hints.ell[0], /끝나기 바로 전/);
});

test('판에 무늬 입히기는 힌트 칸에 있는 도구다. 무엇을 알려 주는지는 말하지 않는다', () => {
  // 단추는 힌트 칸(왼쪽)에 있고, 그 아래에 색마다 남은 빈칸의 수를 적는 자리가 있다.
  const side = part('<section class="side" aria-label="힌트">', '</section>');
  assert.match(side, /id="tile-pattern"[^>]*>판에 무늬 입히기</);
  assert.match(side, /id="tile-colors"/);
  // 누를 때마다 무늬 없음 → 바둑판 무늬 → 비스듬한 줄무늬로 바뀐다.
  assert.deepEqual(Object.keys(T.pattern.button), PATTERNS);
  assert.equal(T.pattern.button.none, '판에 무늬 입히기');
  assert.match(T.pattern.button.checker, /바둑판 무늬/);
  assert.match(T.pattern.button.stripe, /비스듬한 줄무늬/);
  // '대각'은 3학년이 모르는 말이라 쓰지 않는다.
  for (const [path, text] of strings) assert.doesNotMatch(text, /대각/, `${path}: ${text}`);
  assert.doesNotMatch(screenText, /대각/);
  // 색마다 모양이 따로 있다(색만으로 가리지 않는다).
  assert.deepEqual(Object.values(T.pattern.marks), ['동그라미', '세모', '네모']);
  assert.equal(fill(T.pattern.count, { n: 7 }), '7칸');
  assert.equal(fill(T.pattern.left, { mark: '세모', n: 5 }), '세모 칸이 5칸 남았어요');
  // 무늬가 무엇을 알려 주는지, 언제 쓰면 좋은지는 "왜 그럴까?" 밖의 어디에도 적혀 있지 않다.
  const tells = /무늬를 입히면|무늬를 입혀 보|무늬를 켜|색을 세|색마다/;
  for (const [path, text] of strings) if (!path.startsWith('why')) assert.doesNotMatch(text, tells, `${path}: ${text}`);
  assert.doesNotMatch(screenText, tells);
  // 화면 코드: 처음 누를 때 힌트 하나를 연 것으로 적는다.
  const code = read('src/formats/tile.js');
  assert.match(code, /hintsOpened: round\.hintsOpened \+ \(round\.patternShown \? 1 : 0\)/);
  assert.match(code, /frame\.note\('pattern', \{ pattern: round\.pattern \}\)/);
});

test('막혔을 때 하는 말은 본 것 하나와 할 수 있는 일 하나다. 까닭(무늬)을 말하지 않는다', () => {
  assert.deepEqual(Object.keys(T.stuck).sort(), [...STUCK_KEYS].sort());
  for (const key of STUCK_KEYS) {
    const line = fill(T.stuck[key], { n: 2 });
    const [fact, next, ...rest] = sentences(line);
    assert.equal(rest.length, 0, `${key}: 두 문장이어야 해요`);
    assert.match(fact, /(남았어요|막혔어요)\.$/, `${key}: ${fact}`);
    assert.match(next, /볼 수 있어요\.$/, `${key}: ${next}`);
    assert.doesNotMatch(line, /왜냐|때문|그래서|니까|해야|틀렸|안 돼요|무늬|색/, key);
  }
  assert.equal(fill(T.stuck.plain, { n: 2 }), '조각이 들어갈 수 없는 빈칸이 2칸 남았어요. 남은 빈칸 옆의 조각 하나를 빼고 다르게 놓아 볼 수 있어요.');
  for (const key of ['same', 'same-start']) assert.match(T.stuck[key], /^아까와 똑같이 놓고 막혔어요\./, key);
  // 놓인 조각을 거두는 일은 '빼기'로 부른다('들어내기'라고 하지 않는다).
  for (const [path, text] of strings) assert.doesNotMatch(text, /들어내|들어냈/, `${path}: ${text}`);
  // 판 아래에 적는 짧은 글
  assert.deepEqual(Object.keys(T.status).sort(), [...STATUS_KEYS].sort());
  for (const key of STATUS_KEYS) {
    assert.match(T.status[key], /요$/, key);
    assert.ok([...T.status[key]].length <= 20, key);
    assert.doesNotMatch(T.status[key], /틀렸|무늬|색/, key);
  }
});

test('틀린 "불가능해요"에 하는 말은 짐작이라고 밝히고, 판에서 해 보게 한다', () => {
  assert.deepEqual(Object.keys(T.guess).sort(), [...GUESS_KEYS].sort());
  for (const key of GUESS_KEYS) {
    assert.match(T.guess[key], /것 같아요/, key);
    assert.doesNotMatch(T.guess[key], /틀렸|아니에요|땡/, key);
    assert.doesNotMatch(T.guess[key], /좀 더 생각|다시 생각|잘 생각/, key);
    assert.match(T.guess[key], /볼까요\?$/, key);
    assert.equal(sentenceCount(T.guess[key]), 2, key);
  }
  // 한 번도 안 놓아 봤으면 놓아 보자고, 놓아 봤으면 다른 자리부터 놓아 보자고 한다.
  assert.match(T.guess['impossible-no-try'], /조각을 하나 놓아 볼까요\?$/);
  assert.match(T.guess['impossible-other-start'], /다른 자리부터 놓아 볼까요\?$/);
});

test('풀이 프로그램이 끝까지 따져 보지 못한 판에서는 그렇다고 사실대로 말한다', () => {
  assert.match(T.make.unknown, /^선생님도 끝까지 따져 보지 못했어요\./);
  assert.match(T.play.unknown, /선생님도 끝까지 따져 보지 못했어요\. 그래서 맞는지 알려 줄 수 없어요\.$/);
  assert.match(T.solution.unknown, /선생님도 끝까지 따져 보지 못했어요\.$/);
  // 된다고도 안 된다고도 하지 않는다.
  for (const line of [T.make.unknown, T.play.unknown, T.solution.unknown]) assert.doesNotMatch(line, /덮을 수 없어요|덮을 수 있어요|맞아요/, line);
});

test('맞혔을 때 하는 말은 한 일을 말하고, 칭찬 낱말을 쓰지 않는다', () => {
  const praise = /최고|잘했|대단|훌륭|멋져|멋진|천재|똑똑|완벽|짱|굉장/;
  for (const [path, text] of strings) assert.doesNotMatch(text, praise, `${path}: ${text}`);
  assert.deepEqual(Object.keys(T.right).sort(), [...RIGHT_KEYS].sort());
  // 조각 몇 개로 덮었는지, 놓았던 조각을 몇 번 뺐는지, 몇 번 막힌 끝에 알아냈는지를 그대로 말한다.
  assert.equal(fill(T.right['covered-clean'], { n: 7 }), '조각 7개로 빈틈없이 덮었어요. 놓았던 조각을 한 번도 빼지 않았어요.');
  assert.equal(fill(T.right['covered-back'], { n: 7, u: 3 }), '조각 7개로 빈틈없이 덮었어요. 놓았던 조각을 3번 빼고 다시 놓았어요.');
  // 막힌 횟수는 덧붙이는 말이라 "덮었어요"를 되풀이하지 않는다.
  assert.equal(fill(T.right['covered-stuck'], { s: 2 }), '중간에 2번 막혔어요.');
  assert.ok(fill(T.right['impossible-tried'], { s: 4 }).includes('4번 막힌 끝에 알아냈어요'));
  // "맞아요"는 답 단추("불가능해요")를 눌러 맞혔을 때만 쓴다. 다 덮어서 끝난 말에는 없다.
  for (const key of ['impossible-tried', 'impossible-some', 'impossible-untried']) assert.match(T.right[key], /^맞아요\. /, key);
  for (const key of RIGHT_KEYS.filter((item) => !item.startsWith('impossible-'))) assert.doesNotMatch(T.right[key], /맞아요/, key);
  // 답을 바꿔서 맞힌 판의 말은 형식 사이에 같은 한 문장이다.
  assert.equal(T.right['after-retry'], '처음 답을 바꿔서 찾아냈어요.');
  assert.match(T.right['impossible-untried'], /한 번도 놓지 않고 알아냈어요/);
});

test('글의 빈칸({이름})은 정해진 이름만 쓴다', () => {
  const allowed = new Set(['row', 'col', 'what', 'n', 'u', 's', 'k', 'mark']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
  }
  // 차례는 "첫 번째", "2번째"로 읽는다('1째'라고 하지 않는다).
  assert.equal(fill(T.cellLabel, { row: ordinal(2), col: ordinal(3), what: T.cells.hole }), '2번째 줄 3번째 칸, 빠진 칸');
  assert.equal(fill(T.cellLabel, { row: ordinal(1), col: ordinal(1), what: T.cells.empty }), '첫 번째 줄 첫 번째 칸, 빈칸');
  assert.match(read('src/formats/tile.js'), /fill\(T\.cellLabel, \{ row: ordinal\(y \+ 1\), col: ordinal\(x \+ 1\), what \}\)/);
  assert.deepEqual(Object.keys(T.cells), ['empty', 'hole', 'covered']);
});

test('화면 글에 영어 낱말이 없다', () => {
  for (const [path, text] of strings) {
    const plain = text.replace(/\{[^{}]*\}/g, '');
    assert.doesNotMatch(plain, /[A-Za-z]/, `${path}: ${text}`);
  }
  assert.doesNotMatch(screenText, /[A-Za-z]/);
});

test('화면 글은 "~요"로 끝나는 말투다(대본의 문장)', () => {
  const spoken = [
    ...Object.values(T.home.ask),
    T.home.pick,
    ...Object.values(T.rules),
    ...Object.values(T.stuck),
    ...Object.values(T.play),
    ...PIECE_IDS.flatMap((piece) => T.hints[piece]),
    ...Object.values(T.guess),
    ...Object.values(T.right),
    ...Object.values(T.solution),
    T.make.intro,
    T.make.possible,
    T.make.impossible,
    T.make.unknown,
    ...slides.map((slide) => slide.say),
  ];
  for (const text of spoken) for (const sentence of sentences(text)) assert.match(sentence, /요[.?!]$/, sentence);
  // 마침표 없이 쓰는 짧은 글도 "~요"로 끝난다.
  for (const item of figures) assert.match(item.note, /요$/, item.note);
  assert.match(T.pattern.left, /요$/);
});

test('한 문장에 한 가지 뜻: 문장이 너무 길지 않다(60자 이하)', () => {
  for (const [path, text] of strings) {
    for (const sentence of sentences(text)) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
  }
});

test('까닭과 생각의 이름은 "왜 그럴까?"에서만 말한다', () => {
  const name = /색칠해서 세기/;
  const reason = /색이 다른|같은 색|두 색|세 색|색마다|한 색|짝수|홀수|색을 하나씩/;
  for (const [path, text] of strings) {
    if (path.startsWith('why')) continue;
    assert.doesNotMatch(text, name, `${path}: ${text}`);
    assert.doesNotMatch(text, reason, `${path}: ${text}`);
  }
  assert.doesNotMatch(screenText, name);
  // 컵 뒤집기와 세 색 무리는 형식의 이름에 "세 색"이 들어 있다(조각 덮기의 까닭이 아니다).
  assert.doesNotMatch(screenText.replace(/컵 뒤집기와 세 색 무리|세 색 무리/g, ''), reason);
  // 두 이야기 모두 같은 이름으로 끝맺는다(같은 생각을 판을 바꿔 다시 쓴다).
  for (const piece of WHY_PIECES) assert.match(T.why[piece].map((slide) => slide.say).join(' '), name, piece);
  // 이름은 까닭을 다 본 뒤에 처음 꺼낸다(뜻밖의 결과 → 그림 → 이름).
  for (const slide of T.why.domino.slice(0, 2)) assert.doesNotMatch(slide.say, name);
  assert.match(T.why.domino[2].say, /선생님은 이것을 색칠해서 세기라고 불러요\.$/);
  for (const slide of T.why.bar.slice(0, 3)) assert.doesNotMatch(slide.say, name);
  assert.match(T.why.bar[3].say, /이것도 색칠해서 세기예요\.$/);
});

test('"왜 그럴까?"는 그림 서너 장이고, 설명이 아니라 어떻게 알아챘는지의 이야기다', () => {
  assert.deepEqual(Object.keys(T.why), WHY_PIECES);
  for (const piece of WHY_PIECES) {
    const story = T.why[piece];
    assert.ok(story.length >= 3 && story.length <= 4, `${piece}: ${story.length}장`);
    for (const slide of story) {
      assert.ok(slide.say.length > 0);
      assert.ok(sentenceCount(slide.say) <= 3, slide.say);
      assert.ok(slide.figures.length >= 1 && slide.figures.length <= 2, '그림은 한두 개');
      for (const item of slide.figures) assert.equal(item.piece, piece);
    }
    // 이야기 속 선생님이 먼저 "여기서 막혔어요"를 보인다: 첫 장의 첫 그림이 막힌 판이다.
    // 그림 속 판은 지금 판이 아니라서 "이 판에서"라고 하지 않는다.
    assert.match(story[0].say, /선생님도 여러 번 막혔어요|선생님도 이런 판에서 여러 번 막혔어요/);
    assert.doesNotMatch(story[0].say, /이 판에서/);
    assert.match(story[0].figures[0].note, /^여기서 막혔어요/);
    assert.equal(story[0].figures[0].stuck, true);
    // 이야기의 말투: 겪은 일로 말한다("~봤어요").
    for (const slide of story) assert.match(slide.say, /봤어요/, slide.say);
  }
  // 도미노: 여러 번 막혔다 → 바둑판 무늬를 입혀 봤다 → 도미노 하나는 색이 다른 두 칸을 덮는다
  //        → 빠진 두 칸이 같은 색이면 안 된다 → 색이 다른 두 칸을 빼면 늘 된다(판을 한 바퀴 도는 길)
  assert.match(T.why.domino[0].say, /그래도 늘 빈칸이 남았어요/);
  assert.match(T.why.domino[1].say, /^그래서 판에 바둑판 무늬를 입혀 봤어요/);
  assert.match(T.why.domino[1].say, /어디에 놓아도 색이 다른 두 칸을 덮었어요/);
  assert.match(T.why.domino[2].say, /빠진 두 칸이 같은 색이면 한 색이 두 칸 더 많아서 다 덮을 수 없어요/);
  assert.match(T.why.domino[3].say, /색이 다른 두 칸을 빼면 어떨까요\?/);
  assert.match(T.why.domino[3].say, /판을 한 바퀴 도는 길을 그리고/);
  assert.match(T.why.domino[3].say, /두 도막이 모두 짝수 칸이라서 길을 따라 놓으면 늘 덮여요/);
  // 일자 세 칸: 바둑판 무늬로는 안 갈렸다 → 세 색 비스듬한 줄무늬 → 일자 조각은 세 색을 하나씩 덮는다
  //            → 빠진 칸이 한 칸 많은 색이어야 한다 → 반대쪽으로 비스듬히 한 번 더 입히면 더 줄어든다
  assert.match(T.why.bar[0].say, /바둑판 무늬를 입혀 봤어요\. 그런데 이번에는 까닭이 보이지 않았어요/);
  assert.match(T.why.bar[1].say, /^그래서 세 가지 색으로 비스듬한 줄무늬를 입혀 봤어요/);
  assert.match(T.why.bar[1].say, /눕혀도 세워도 세 색을 하나씩 덮었어요/);
  assert.match(T.why.bar[2].say, /한 색만 한 칸 더 많았어요/);
  assert.match(T.why.bar[2].say, /빠진 칸이 그 색이어야/);
  assert.match(T.why.bar[3].say, /반대쪽으로 비스듬히 한 번 더 입혀 봤어요/);
  assert.match(T.why.bar[3].say, /두 무늬에서 모두 한 칸 많은 색이었던 칸은 네 구석뿐이었어요/);
});

test('"왜 그럴까?" 그림 속의 판, 조각, 수는 풀이 프로그램이 따진 것과 같다', () => {
  let checked = 0;
  for (const item of figures) {
    const where = item.note;
    assert.equal(checkBoard(item), null, where);
    const placed = item.placed ?? [];
    const played = replay(item, placed.map(place));
    assert.equal(played.ok, true, `${where}: 놓을 수 없는 조각`);
    // 막힌 판이라고 한 그림은 정말 막힌 판이고, 적은 빈칸의 수가 맞다. 그 판은 풀이 프로그램으로도 안 되는 판이다.
    if (item.stuck) {
      assert.equal(isStuck(item, placed), true, where);
      assert.equal(played.left, item.left, where);
      assert.equal(deadCells(item, placed).length, item.left, where);
      assert.ok(item.note.includes(`${item.left}칸`), where);
      assert.equal(solve(item, { filters: false }).possible, false, where);
    }
    // "어디에 놓아도 색을 하나씩 덮는다"는 그림: 그려 둔 조각마다 무늬의 모든 색이 하나씩 들어 있다.
    if (item.eachColor) {
      assert.ok(placed.length >= 2, where);
      const colors = item.pattern === 'checker' ? [0, 1] : [0, 1, 2];
      for (const cells of placed) assert.deepEqual(cells.map((cell) => colorOf(item.pattern, ...xyOf(item, cell))).sort(), colors, where);
      // 누운 조각과 선 조각이 하나씩 있다.
      const lying = placed.filter((cells) => cells[1] - cells[0] === 1).length;
      assert.ok(lying >= 1 && lying < placed.length, where);
    }
    // 색마다 적은 칸의 수
    if (item.counts) {
      assert.deepEqual(colorCounts(item, item.pattern, placed), item.counts, where);
      // 글에 적은 칸의 수는 그림 아래에 적히는 수 가운데 하나다.
      for (const [, count] of item.note.matchAll(/(\d+)칸/g)) assert.ok(item.counts.includes(Number(count)), `${where}: ${count}칸`);
    }
    // 한 바퀴 도는 한 줄 길: 모든 칸을 한 번씩 지나 처음으로 돌아오고, 빠진 두 칸에서 끊으면 적어 둔 길이의 두 도막이 된다.
    if (item.loop) {
      assert.deepEqual(item.loop, loopOf(item.w, item.h), where);
      assert.equal(new Set(item.loop).size, item.w * item.h, where);
      item.loop.forEach((cell, index) => assert.equal(shapeOf(item, [cell, item.loop[(index + 1) % item.loop.length]]), 'domino', where));
      const [i, j] = item.holes.map((hole) => item.loop.indexOf(hole)).sort((a, b) => a - b);
      const first = item.loop.slice(i + 1, j);
      const second = [...item.loop.slice(j + 1), ...item.loop.slice(0, i)];
      assert.deepEqual([first.length, second.length].sort((a, b) => a - b), item.arcs, where);
      for (const length of item.arcs) {
        assert.equal(length % 2, 0, where);
        assert.ok(item.note.includes(`${length}칸`), where);
      }
      // 빠진 두 칸은 색이 다르고, 그려 둔 조각은 길을 따라 차례로 두 칸씩 놓은 것이며, 판을 다 덮는다.
      assert.notEqual(colorOf('checker', ...xyOf(item, item.holes[0])), colorOf('checker', ...xyOf(item, item.holes[1])), where);
      const along = [];
      for (const arc of [first, second]) for (let k = 0; k < arc.length; k += 2) along.push([arc[k], arc[k + 1]].sort((a, b) => a - b).join('-'));
      assert.deepEqual(placed.map((cells) => cells.join('-')).sort(), along.sort(), where);
      assert.equal(played.left, 0, where);
    }
    checked += 1;
  }
  assert.equal(checked, 9);

  // 도미노 3장: 빠진 두 칸이 같은 색이고, 그래서 남은 칸의 수가 색마다 두 칸 차이 난다.
  const counted = T.why.domino[2].figures[0];
  assert.equal(colorOf('checker', ...xyOf(counted, counted.holes[0])), colorOf('checker', ...xyOf(counted, counted.holes[1])));
  assert.equal(Math.abs(counted.counts[0] - counted.counts[1]), 2);
  assert.match(counted.note, /남은 칸은 6칸과 8칸이에요$/);
  assert.equal(solve(counted).possible, false);

  // 일자 1장의 둘째 그림: 바둑판 무늬에서는 조각마다 두 색을 덮는 칸 수가 다르다(그래서 까닭이 보이지 않는다).
  const plain = T.why.bar[0].figures[1];
  assert.equal(plain.pattern, 'checker');
  const mixes = new Set(plain.placed.map((cells) => cells.filter((cell) => colorOf('checker', ...xyOf(plain, cell)) === 0).length));
  assert.equal(mixes.size, 2);
  assert.equal(plain.note, '조각마다 두 색을 덮는 칸 수가 달라요');

  // 일자 3장: 둥글게 표시한 칸은 비스듬한 줄무늬에서 한 칸 많은 색의 칸 모두다.
  const striped = T.why.bar[2].figures[0];
  const cells = [...Array(striped.w * striped.h).keys()];
  const most = (pattern) => striped.counts.indexOf(Math.max(...colorCounts(striped, pattern)));
  assert.deepEqual(striped.rings, cells.filter((cell) => colorOf('stripe', ...xyOf(striped, cell)) === most('stripe')));
  assert.match(striped.note, /^칸은 6칸, 5칸, 5칸이에요\. 한 칸 많은 색의 칸들을 둥글게 표시했어요$/);
  // 일자 4장: 두 무늬에서 모두 한 칸 많은 색인 칸은 네 구석이고, 풀이 프로그램이 모든 자리를 따져 구한 되는 자리와 꼭 같다.
  const both = T.why.bar[3].figures[0];
  assert.equal(both.pattern, 'back');
  const corners = cells.filter((cell) => colorOf('stripe', ...xyOf(both, cell)) === most('stripe') && colorOf('back', ...xyOf(both, cell)) === most('back'));
  assert.deepEqual(both.rings, corners);
  assert.deepEqual(both.rings, [0, 3, 12, 15]);
  assert.deepEqual(both.rings, possibleHoles('bar', 4, 4));
  assert.ok(both.rings.length < striped.rings.length, '한 번 더 입히면 되는 자리가 줄어든다');
});

test('"왜 그럴까?"의 주장: 도미노는 어디에 놓아도 두 색을, 일자 세 칸은 어디에 놓아도 세 색을 하나씩 덮는다', () => {
  for (let w = MIN_SIZE; w <= MAX_SIZE; w++) {
    for (let h = MIN_SIZE; h <= MAX_SIZE; h++) {
      const shell = (piece) => ({ w, h, piece, holes: [] });
      for (const cells of placementsOf(shell('domino'))) {
        assert.deepEqual(cells.map((cell) => colorOf('checker', ...xyOf(shell('domino'), cell))).sort(), [0, 1]);
      }
      for (const pattern of ['stripe', 'back']) {
        for (const cells of placementsOf(shell('bar'))) {
          assert.deepEqual(cells.map((cell) => colorOf(pattern, ...xyOf(shell('bar'), cell))).sort(), [0, 1, 2]);
        }
      }
    }
  }
  // "색이 다른 두 칸을 빼면 늘 된다"와 "빠진 칸이 남는 색이어야 한다"는 tests/tile.test.js에서 모든 판을 따져 확인한다.
});

test('ㄱ자 세 칸에는 "왜 그럴까?"를 붙이지 않는다(일부러 까닭을 남겨 둔 판). 안 되는 판을 맞혔을 때 사실대로 한 번 말한다', () => {
  assert.match(T._설명, /일부러 까닭을 남겨 둔 판/);
  assert.equal(T.why.ell, undefined);
  for (const item of figures) assert.notEqual(item.piece, 'ell');
  for (const slide of slides) assert.doesNotMatch(slide.say, /ㄱ자/);
  // 무늬가 까닭을 보여 주는 도구라는 것을 드러내지 않고, 선생님이 어떻게 알았는지만 말한다.
  assert.equal(T.right['ell-no-reason'], '이 판은 선생님도 모든 경우를 하나하나 따져서 알았어요.');
  assert.doesNotMatch(T.right['ell-no-reason'], /무늬|까닭/);
  // 그 말은 사실이다: 3단계의 안 되는 판은 풀이 프로그램이 빠른 걸러내기가 아니라 모든 경우를 따져서 가린다.
  let seen = 0;
  for (let seed = 1; seed <= 120; seed++) {
    const made = generateBoard(3, seed);
    if (made.solution.possible) continue;
    assert.equal(made.solution.reason, 'search', `3단계 ${seed}번`);
    seen += 1;
  }
  assert.ok(seen > 20);
  // 화면 코드: 만들어 낸 ㄱ자 판에서, 모든 경우를 따져 안 된다고 한 판을 처음 맞혔을 때만 말한다.
  const code = read('src/formats/tile.js');
  assert.match(code, /round\.custom \|\| round\.board\.piece !== 'ell' \|\| solution\.reason !== 'search'/);
  // "왜 그럴까?"를 권하는 말은 하나뿐이고, 다른 맞혔을 때의 말에는 없다.
  assert.match(T.right['why-invite'], /왜 안 되는지 궁금하면 왜 그럴까 단추를 눌러 보세요/);
  for (const key of RIGHT_KEYS.filter((item) => item !== 'why-invite')) assert.doesNotMatch(T.right[key], /왜 그럴까/, key);
});

test('판 고르기의 그림: 단계마다 그 단계의 판이고, 그림 속의 조각은 규칙에 맞게 놓여 있다', () => {
  for (const rung of LADDER) {
    const picture = T.levels.find((entry) => entry.level === rung.level).picture;
    if (rung.mode === 'make') {
      assert.equal(picture.blank, true);
      continue;
    }
    assert.equal(checkBoard(picture), null, `${rung.level}단계`);
    assert.equal(picture.piece, rung.piece, `${rung.level}단계`);
    assert.equal(picture.holes.length, rung.holes, `${rung.level}단계`);
    assert.ok(rung.sizes.some(([w, h]) => w === picture.w && h === picture.h), `${rung.level}단계`);
    assert.ok(picture.placed.length >= 1, `${rung.level}단계`);
    assert.equal(replay(picture, picture.placed.map(place)).ok, true, `${rung.level}단계의 그림`);
  }
  // 1단계의 그림은 되는 판이다.
  assert.equal(solve(T.levels[0].picture).possible, true);
});

test('풀이와 직접 만들기의 글: 되는지와 조각의 수를 알려 준다', () => {
  assert.equal(fill(T.solution.possible, { k: 7 }), '조각 7개로 덮을 수 있어요. 한 가지 방법을 보여 줄게요.');
  assert.match(T.solution.impossible, /아무리 해도 다 덮을 수 없어요/);
  assert.equal(fill(T.make.possible, { k: 21 }), '이 판은 다 덮을 수 있어요. 조각 21개가 들어가요.');
  assert.match(T.make.impossible, /아무리 해도/);
  assert.equal(fill(T.make.size, { n: 8 }), '8칸');
  // 만들기 안내의 끝은 형식 사이에 같은 꼴이다("선생님, 풀어 보세요" 단추가 있다).
  assert.match(T.make.intro, /다 만들면 선생님에게 풀어 보라고 할 수도 있어요\.$/);
  assert.match(html, /id="tile-make-solve"[^>]*>선생님, 풀어 보세요</);
});

test('index.html: 조각 덮기의 카드, 판, 답하는 칸, 직접 만들기가 있다', () => {
  for (const id of [
    'home-tile-sample',
    'home-tile-ask',
    'home-tile-play',
    'home-tile-pick',
    'home-tile-make',
    'home-tile-blank',
    'tile-board',
    'tile-status',
    'tile-count',
    'tile-left',
    'tile-pattern',
    'tile-colors',
    'tile-pad',
    'tile-piece',
    'tile-piece-name',
    'tile-cover',
    'tile-either',
    'tile-impossible',
    'make-tile',
    'tile-make-pieces',
    'tile-make-w',
    'tile-make-h',
    'tile-make-clear',
    'tile-make-board',
    'tile-make-result',
  ]) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  for (const side of ['w', 'h']) for (const way of ['fewer', 'more']) assert.ok(html.includes(`id="tile-make-${side}-${way}"`), `${side}-${way}`);
  for (const piece of PIECE_IDS) assert.ok(html.includes(`data-piece="${piece}"`), piece);
  assert.match(html, /id="tile-make-solve"[^>]*>선생님, 풀어 보세요</);
  assert.match(html, /id="tile-make-play"[^>]*>내가 해 볼래요</);
  for (const label of ['조각 덮기', '남은 빈칸', '이 판의 조각', '도미노', '일자 세 칸', 'ㄱ자 세 칸', '가로', '세로', '뺀 칸 모두 되돌리기']) assert.ok(screenText.includes(label), label);
  // 처음 화면의 물음은 대본에 있는 것과 같은 글로 시작한다.
  assert.ok(screenText.includes(T.home.ask.cover));
  // 카드는 "퍼즐 만들기" 앞에 있고, "만들기" 목록에도 있다.
  assert.ok(html.indexOf('id="tile-title"') < html.indexOf('id="make-title"'));
  assert.ok(html.indexOf('id="swap-title"') < html.indexOf('id="tile-title"'));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-tile-make" class="menu-item"/);
});

// ---- 수준 맞추기 ----
let nextId = 0;
function tile(overrides = {}) {
  nextId += 1;
  return {
    kind: 'round',
    id: `t${nextId}`,
    format: 'tile',
    level: 1,
    seed: nextId,
    custom: false,
    mode: 'cover',
    board: { w: 4, h: 4, piece: 'domino', holes: [10, 11] },
    outcome: 'solved',
    hintsOpened: 0,
    answers: [{ t: 40, answer: 'covered', correct: true, guess: null }],
    placeCount: 7,
    seconds: 40,
    solution: { possible: true, reason: 'tiled', pieces: 7 },
    ...overrides,
  };
}

test('조각 덮기의 수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다', () => {
  const tuning = tuningFor('tile');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 4);
  assert.equal(tuning.hintCount, 2);
  assert.equal(tuning.whyAfter, undefined);
  for (const rung of LADDER.filter((item) => item.mode !== 'make')) assert.ok(tuning.expectedSeconds[rung.level] > 0, `${rung.level}단계의 예상 시간`);
  assert.deepEqual(recommend([], 'tile'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  // 시작 단계의 첫 판은 늘 되는 가장 작은 판이다.
  const first = generateBoard(recommend([], 'tile').level, 1);
  assert.equal(first.solution.possible, true);
  assert.deepEqual([first.board.w, first.board.h, first.board.piece], [4, 4, 'domino']);
  // 임시값이라고 적어 두었다.
  assert.match(read('src/core/level.js'), /조각 덮기\(모두 임시\)/);
  // 다른 형식의 값은 그대로다.
  assert.equal(tuningFor('coins').startLevel, TUNING.startLevel);
  assert.equal(tuningFor('trace').startLevel, 1);
  assert.equal(tuningFor('code').startLevel, 2);
  assert.equal(tuningFor('swap').startLevel, 1);
  assert.equal(tuningFor('swap').whyAfter, 'fewest');
});

test('힌트 없이 첫 답으로 빠르게 맞힌 판이 이어지면 더 어려운 판을 권한다. 무늬를 입혀 본 판은 힌트를 연 판이다', () => {
  const clean = () => tile();
  assert.deepEqual(recommend([clean(), clean()], 'tile'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  assert.equal(recommend([clean()], 'tile').offerHarder, false, '한 판으로는 권하지 않는다');
  assert.equal(recommend([clean(), tile({ hintsOpened: 1, patternShown: true })], 'tile').offerHarder, false, '무늬를 입혀 본 판');
  assert.equal(recommend([clean(), tile({ seconds: tuningFor('tile').expectedSeconds[1] })], 'tile').offerHarder, false, '예상 시간보다 오래 걸린 판');
  const retried = tile({ level: 2, mode: 'either', answers: [{ t: 20, answer: 'impossible', correct: false, guess: 'impossible-no-try' }, { t: 60, answer: 'covered', correct: true, guess: null }], seconds: 60 });
  assert.equal(recommend([tile({ level: 2, mode: 'either' }), retried], 'tile').offerHarder, false, '처음 답이 달랐던 판');
  // 맨 위 단계에서는 직접 만들기를 가리킨다.
  const top = () => tile({ level: 4, mode: 'either', board: { w: 4, h: 4, piece: 'bar', holes: [5] }, answers: [{ t: 90, answer: 'impossible', correct: true, guess: null }], seconds: 90, solution: { possible: false, reason: 'color', pieces: null } });
  assert.deepEqual(recommend([top(), top()], 'tile'), { level: 4, small: false, offerHarder: true, harderLevel: 5, reason: 'fast' });
});

test('그만두기가 이어지면 조용히 한 단계 아래를 먼저 보여 준다. 맨 아래에서는 더 작은 판이다', () => {
  const quit = (level) => tile({ level, outcome: 'left', answers: [], placeCount: 5 });
  assert.deepEqual(recommend([quit(3), quit(3)], 'tile'), { level: 2, small: false, offerHarder: false, harderLevel: null, reason: 'quit' });
  assert.deepEqual(recommend([quit(1), quit(1)], 'tile'), { level: 1, small: true, offerHarder: false, harderLevel: null, reason: 'quit' });
  assert.equal(recommend([quit(2)], 'tile').reason, 'steady');
  // 힌트를 다 열고도 못 풀었으면 한 판으로도 내려간다.
  assert.equal(recommend([tile({ level: 4, outcome: 'left', answers: [], placeCount: 3, hintsOpened: 2 })], 'tile').level, 3);
  // 들여다보기만 한 판(조각을 놓지도, 답하지도, 힌트를 열지도 않았다)은 세지 않는다. 직접 만든 판도 세지 않는다.
  const peek = () => tile({ level: 2, outcome: 'left', answers: [], placeCount: 0 });
  assert.equal(recommend([peek(), peek()], 'tile').reason, 'start');
  const custom = () => tile({ level: 5, custom: true, outcome: 'left', answers: [], placeCount: 4 });
  assert.equal(recommend([custom(), custom()], 'tile').reason, 'start');
  // 조각을 놓아 본 판은 손댄 판이다.
  assert.equal(recommend([tile({ level: 2, outcome: 'left', answers: [], placeCount: 1 })], 'tile').level, 2);
  // 다른 형식의 기록은 영향을 주지 않고, 조각 덮기의 기록도 다른 형식에 영향을 주지 않는다.
  for (const format of ['coins', 'trace', 'code', 'swap']) assert.equal(recommend([quit(3), quit(3)], format).reason, 'start');
});

test('"왜 그럴까?"는 그 조각의 안 되는 판을 한 번 끝까지 만난 뒤에 열린다', () => {
  const impossible = (piece, overrides = {}) => tile({ level: piece === 'domino' ? 2 : piece === 'ell' ? 3 : 4, mode: 'either', board: { w: 4, h: 4, piece, holes: [5] }, solution: { possible: false, reason: 'color', pieces: null }, ...overrides });
  // 틀의 문: 이 형식의 안 되는 판을 한 번 끝까지 만났는가
  assert.equal(whyUnlocked([], 'tile'), false);
  assert.equal(whyUnlocked([tile(), tile({ level: 2 })], 'tile'), false, '되는 판만 한 판');
  assert.equal(whyUnlocked([impossible('domino', { outcome: 'left' })], 'tile'), false, '끝내지 않은 판');
  assert.equal(whyUnlocked([impossible('domino')], 'tile'), true);
  // 조각마다의 문(이 형식이 따로 본다)
  assert.equal(whyOpen([impossible('domino')], 'domino'), true);
  assert.equal(whyOpen([impossible('domino')], 'bar'), false);
  assert.equal(whyOpen([impossible('ell')], 'domino'), false, 'ㄱ자의 안 되는 판을 만났다고 도미노의 까닭이 열리지 않는다');
  assert.equal(whyOpen([impossible('ell')], 'ell'), false);
  assert.equal(whyOpen([impossible('bar')], 'bar'), true);
  // 다른 형식은 그대로다.
  assert.equal(whyUnlocked([impossible('domino')], 'coins'), false);
  assert.equal(whyUnlocked([impossible('domino')], 'swap'), false);
});
