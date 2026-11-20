// 조각 못 들어가게 막기 대본 점검: 화면에 나오는 글이 약속을 지키는지, 그림 속의 판과 수가 풀이 프로그램과 맞는지 본다.
// 이 형식에서 새로 지키는 것도 여기서 본다: 틀린 답이 없다(많이 막은 것은 틀린 것이 아니다),
// 막은 칸의 수는 놀이의 내용이고 다른 것으로 바꿔 보여 주지 않는다, "여기까지 할래요"도 떳떳한 끝이다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { LADDER, MAKE_LEVEL, generateBoard, rungOf } from '../src/core/block-ladder.js';
import { PIECE_IDS, allPlacements, greedyBlock, placementsOf, solve } from '../src/core/block.js';
import { TUNING, recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { pageKey, putPage } from '../src/core/notebook.js';
import { fill, sentenceCount } from '../src/core/text.js';
import { brutePacking } from './helpers/brute-block.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/block.json'));
const C = JSON.parse(read('src/content/coins.json'));
const html = read('index.html');
const css = read('src/app.css').replace(/\/\*[\s\S]*?\*\//g, '');
const code = read('src/formats/block.js');

const HINT_KEYS = ['start', 'more'];
const RIGHT_KEYS = ['best', 'first-try', 'after', 'stopped', 'stopped-tries', 'why-invite'];
const PLAY_KEYS = ['fewer', 'fewer-down', 'unknown'];

/** 대본의 모든 글(값)을 길과 함께 모은다. 설명(_로 시작하는 것)은 뺀다. */
function allStrings(value, path = '') {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((item, index) => allStrings(item, `${path}[${index}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .filter(([key]) => !key.startsWith('_'))
      .flatMap(([key, item]) => allStrings(item, path ? `${path}.${key}` : key));
  }
  return [];
}
const strings = allStrings(T).filter(([path]) => !/\.piece$/.test(path));

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
/** index.html에서 이 형식의 자리: 처음 화면의 카드, 도구 단추, 판 아래, 답하는 칸, 직접 만들기 */
const own = [part('id="block-title"', 'id="make-title"'), part('id="block-spots"', 'id="why"'), part('id="block-count"', 'id="tax-count"'), part('id="block-pad"', 'id="logic-pad"'), part('id="make-block"', '<script')]
  .map(visibleText)
  .join(' ');
const plain = (piece, w, h) => ({ w, h, piece, holes: [] });

test('대본을 읽을 수 있고, 글이 비어 있지 않다', () => {
  assert.ok(strings.length > 50);
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.equal(T.title, '조각 못 들어가게 막기');
  // 조각의 이름은 조각 덮기와 같다(같은 조각은 같은 이름).
  const tile = JSON.parse(read('src/content/tile.json'));
  for (const piece of Object.keys(tile.pieces)) assert.equal(T.pieces[piece], tile.pieces[piece], piece);
  assert.deepEqual(Object.keys(T.pieces), PIECE_IDS);
  assert.equal(new Set(Object.values(T.pieces)).size, PIECE_IDS.length);
});

test('단계 목록이 사다리와 같고, 표시는 기본·응용·응용·도전·도전이다', () => {
  assert.deepEqual(T.levels.map((entry) => entry.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(LADDER.map((rung) => C.tags[rung.tag]), ['기본', '응용', '응용', '도전', '도전']);
  assert.equal(T.levels.at(-1).level, MAKE_LEVEL);
  assert.equal(T.levels.at(-1).name, '직접 만들기');
  // 판 고르기의 그림: 단계에 나오는 조각의 판이다.
  for (const rung of LADDER) {
    const picture = T.levels.find((entry) => entry.level === rung.level).picture;
    if (rung.mode === 'make') assert.equal(picture.blank, true);
    else assert.ok(rung.boards.some(([piece]) => piece === picture.piece), `${rung.level}단계`);
  }
  assert.equal(T.home.ask, '몇 칸을 막으면 될까요?');
});

test('규칙 설명은 세 문장을 넘지 않는다. 첫 단계는 "가장 적게"를 걸지 않고, 그다음부터 건다', () => {
  assert.deepEqual(Object.keys(T.rules), HINT_KEYS);
  for (const key of HINT_KEYS) {
    assert.equal(sentenceCount(T.rules[key]), 3, key);
    assert.match(T.rules[key], /조각이 판 어디에도 들어가지 못하게 칸을 막/, key);
    assert.match(T.rules[key], /돌리거나 뒤집어서/, key);
  }
  assert.doesNotMatch(T.rules.start, /적게/);
  assert.match(T.rules.more, /되도록 적게/);
  // 규칙 글은 단계의 힌트 묶음 이름으로 고른다. 직접 만든 판(5단계)은 "적게"를 거는 글이다.
  assert.match(code, /ruleLine: \(round\) => T\.rules\[rungOf\(round\.level\)\.hint\],/);
  assert.equal(rungOf(MAKE_LEVEL).hint, 'more');
  // 직접 만들기 화면의 안내 글도 세 문장 안쪽이다. 크지만 몇 칸만 막으면 되는 판을 만들어 보라고 권한다.
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 30, '직접 만들기 안내 글은 형식마다 하나');
  assert.ok(sentenceCount(guides[8]) <= 3, guides[8]);
  assert.match(guides[8], /몇 칸만 막으면 되는 판도 만들 수 있을까요\?/);
});

test('막은 칸의 수는 놀이의 내용이다: 다른 것으로 바꿔 부르지 않고, 다른 판이나 다른 날과 견주지 않는다', () => {
  const reward = /점수|득점|만점|점이에요|\d점|등급|순위|기록을 깨|신기록|최고 기록|지난번|어제|다른 판보다|몇 판|판째/;
  for (const [path, text] of strings) assert.doesNotMatch(text, reward, `${path}: ${text}`);
  assert.doesNotMatch(own, reward);
  // 자기 기록은 이 판에서 가장 적게 막은 수 하나만 보여 준다. 몇 번 했는지를 세는 자리는 없다.
  assert.match(html, /id="block-best-line" hidden>이 판에서 가장 적게 막은 것: <strong id="block-best"><\/strong>칸</);
  assert.equal([...part('id="block-count"', 'id="tax-count"').matchAll(/<strong/g)].length, 2);
  assert.equal([...part('id="block-pad"', 'id="logic-pad"').matchAll(/<strong/g)].length, 1, '조각의 이름');
  assert.equal(T.notebook.best, '가장 적게 막은 칸 {k}');
});

test('틀린 답이 없다: 많이 막은 판에서는 사실을 말하고 "더 적게 막을 수 있을까요?"라고 묻는다', () => {
  assert.deepEqual(Object.keys(T.play).sort(), [...PLAY_KEYS].sort());
  assert.equal(fill(T.play.fewer, { k: 6 }), '6칸을 막았더니 조각이 들어갈 자리가 없어요. 더 적게 막을 수 있을까요?');
  assert.match(fill(T.play['fewer-down'], { k: 5 }), /아까보다 적게 막았어요\. 더 적게 막을 수 있을까요\?$/);
  const wrong = /틀렸|틀린|아니에요|땡|아쉽|부족|실패|것 같아요|다시 생각|너무 많/;
  for (const [path, text] of strings) assert.doesNotMatch(text, wrong, `${path}: ${text}`);
  assert.doesNotMatch(own, wrong);
  // 다시 해도 되고 여기까지 해도 된다. "여기까지 할래요"로 끝낸 판도 끝까지 한 판이다.
  assert.match(html, /id="block-again"[^>]*>처음부터 다시 해 볼래요</);
  assert.match(html, /id="block-stop"[^>]*>여기까지 할래요</);
  assert.match(code, /function stop\(\) \{[\s\S]*?round\.stopped = true;[\s\S]*?frame\.finish\('solved'\);/);
  // 가장 적게 막는 수에 닿으면 그렇다고 말하고 판이 끝난다.
  assert.equal(fill(T.right.best, { k: 4 }), '4칸을 막아서 조각이 들어갈 자리를 모두 없앴어요. 이보다 적게 막을 수는 없어요.');
  assert.match(code, /const reached = solution\.exact && state\.count === solution\.best;/);
  // 풀이 프로그램이 끝까지 못 따진 판에서는 가장 적다고 말하지 않고, 못 따졌다고 사실대로 말한다(형식 사이에 같은 꼴).
  assert.match(T.play.unknown, /선생님도 끝까지 따져 보지 못했어요\.$/);
  assert.match(T.make.unknown, /^선생님도 끝까지 따져 보지 못했어요\./);
  assert.match(T.solution.unknown, /^선생님도 끝까지 따져 보지 못했어요\./);
  assert.match(code, /const line = !solution\.exact \? T\.play\.unknown/);
});

test('한 번이 끝나는 때: 조각이 들어갈 자리가 없어졌을 때와, 그 모습에서 쓸데없는 칸을 열어 더 적게 막았을 때. 칸을 더 막는 것은 세지 않는다', () => {
  assert.match(code, /if \(state\.shut && \(round\.lastShut === null \|\| state\.count < round\.lastShut\)\) \{\s*complete\(state\);/);
  assert.match(code, /if \(!state\.shut\) round\.lastShut = null;/);
  assert.match(code, /round\.lastShut = state\.count;/);
  // 무르기와 되돌리기는 한 번이 끝난 것으로 세지 않는다.
  assert.doesNotMatch(code.slice(code.indexOf('function undo()'), code.indexOf('function toggleSpots()')), /complete\(/);
});

test('힌트는 단계 묶음마다 두 개이고, 하나하나가 질문 한 문장이다', () => {
  assert.deepEqual(Object.keys(T.hints).sort(), [...HINT_KEYS].sort());
  for (const rung of LADDER) assert.ok(T.hints[rung.hint], `${rung.level}단계의 힌트`);
  for (const key of HINT_KEYS) {
    const hints = T.hints[key];
    assert.equal(hints.length, tuningFor('block').hintCount, key);
    for (const hint of hints) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
    }
    assert.equal(new Set(hints).size, hints.length);
  }
});

test('힌트는 두 높이다: 첫째는 무엇을 해 볼지만, 둘째는 어디를 볼지까지만 묻는다. 까닭을 말해 버리지 않는다', () => {
  for (const key of HINT_KEYS) {
    const [first, second] = T.hints[key];
    // 첫째: 해 볼 일을 묻는다. 겹치지 않는 자리를 말하지 않는다.
    assert.doesNotMatch(first, /겹치지|자리 세기/, first);
    // 둘째: 볼 곳(칸이나 자리)을 가리킨다.
    assert.match(second, /어느 것인가요\?$|몇 군데인가요\?$/, second);
    for (const hint of [first, second]) assert.doesNotMatch(hint, /가운데를|구석|변의|자리 세기|때문|해야 해요|하면 돼요|적어도|\d/, hint);
  }
  assert.match(T.hints.start[0], /다른 곳부터 막으면/);
  assert.match(T.hints.start[1], /다시 열어도 조각이 들어가지 않는 칸/);
  assert.match(T.hints.more[0], /^더 작은 판이라면/);
  assert.match(T.hints.more[1], /서로 겹치지 않는 자리는 몇 군데/);
});

test('도구 "들어갈 자리 보기"는 힌트 하나를 연 것으로 적고, 남은 자리 하나와 그 수를 보여 준다', () => {
  assert.deepEqual(T.tool, { off: '들어갈 자리 보기', on: '들어갈 자리 그만 보기' });
  assert.match(html, /id="block-spots"[^>]*aria-pressed="false" hidden>들어갈 자리 보기</);
  assert.match(code, /hintsOpened: round\.hintsOpened \+ \(round\.spotsShown \? 1 : 0\)/);
  assert.match(code, /round\.spotsShown = true;/);
  assert.match(code, /ghost: playing && round\.spotsOn \? firstSpot\(board, state\.blocked\) : null,/);
  assert.equal(fill(T.status.left, { n: 12 }), '들어갈 자리가 12군데 남았어요');
  assert.equal(T.status.shut, '조각이 들어갈 자리가 없어요');
});

test('끝났을 때 하는 말은 한 일을 그대로 말하고, 칭찬 낱말을 쓰지 않는다', () => {
  const praise = /최고|잘했|대단|훌륭|멋져|멋진|천재|똑똑|완벽|짱|굉장|축하|성공/;
  for (const [path, text] of strings) assert.doesNotMatch(text, praise, `${path}: ${text}`);
  assert.doesNotMatch(own, praise);
  assert.deepEqual(Object.keys(T.right).sort(), [...RIGHT_KEYS].sort());
  assert.equal(fill(T.right.after, { r: 3 }), '3번 다시 해서 찾아냈어요.');
  assert.equal(fill(T.right.stopped, { k: 7 }), '이 판에서 가장 적게 막은 것은 7칸이에요. 여기까지 했어요.');
  assert.match(code, /if \(retries > 0\) parts\.push\(fill\(T\.right\['stopped-tries'\], \{ r: retries \}\)\);\s*parts\.push\(fill\(T\.right\.stopped, /);
  assert.match(T.right['why-invite'], /왜 그럴까 단추/);
  assert.doesNotMatch(T.right['why-invite'], /겹치|자리|\d/);
});

test('글의 빈칸({이름})은 정해진 이름만 쓴다', () => {
  const allowed = new Set(['n', 'k', 'r', 'row', 'col', 'what']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
  }
});

test('화면 글에 영어 낱말이 없다', () => {
  for (const [path, text] of strings) assert.doesNotMatch(text.replace(/\{[^{}]*\}/g, ''), /[A-Za-z]/, `${path}: ${text}`);
  assert.doesNotMatch(screenText, /[A-Za-z]/);
});

test('화면 글은 "~요"로 끝나는 말투다(대본의 문장)', () => {
  const values = { k: 5, n: 4, r: 2 };
  const spoken = [
    T.home.ask,
    T.home.pick,
    ...Object.values(T.rules),
    ...Object.values(T.play),
    ...HINT_KEYS.flatMap((key) => T.hints[key]),
    ...Object.values(T.right),
    ...Object.values(T.solution),
    T.make.intro,
    T.make.best,
    T.make.unknown,
    T.make.none,
    T.make['keep-not-yet'],
    ...T.why.map((slide) => slide.say),
  ];
  for (const text of spoken) for (const sentence of sentences(fill(text, values))) assert.match(sentence, /요[.?!]$/, sentence);
  for (const text of Object.values(T.status)) assert.match(fill(text, values), /요$/, text);
  for (const text of T.why.flatMap((slide) => slide.figures.map((item) => item.note))) assert.match(text, /요$/, text);
});

test('한 문장에 한 가지 뜻: 문장이 너무 길지 않다(60자 이하)', () => {
  for (const [path, text] of strings) for (const sentence of sentences(text)) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

test('까닭과 생각의 이름은 "왜 그럴까?"에서만 말한다', () => {
  const name = /자리 세기/;
  for (const [path, text] of strings) if (!path.startsWith('why')) assert.doesNotMatch(text, name, `${path}: ${text}`);
  assert.doesNotMatch(screenText, name);
  // 이름은 그림을 본 뒤에 처음 꺼낸다(뜻밖의 결과 → 그림 → 이름). 그 뒤에 그 까닭만으로는 모자라는 판을 하나 보여 준다.
  assert.doesNotMatch(T.why[0].say, name);
  assert.doesNotMatch(T.why[1].say, name);
  assert.match(T.why[2].say, name);
  assert.match(T.why[3].say, /자리 세기로 모자랐어요/);
  for (const [path, text] of strings) assert.doesNotMatch(text, /최적|전략|하한|덮개|집합/, `${path}: ${text}`);
});

test('"왜 그럴까?"는 그림 서너 장이고, 설명이 아니라 어떻게 알아챘는지의 이야기다', () => {
  assert.equal(T.why.length, 4);
  for (const slide of T.why) {
    assert.ok(sentenceCount(slide.say) <= 3, slide.say);
    assert.ok(slide.figures.length >= 1 && slide.figures.length <= 2);
    assert.match(slide.say, /봤어요|았어요|었어요|랐어요/, slide.say);
  }
  assert.match(T.why[0].say, /^선생님도 처음엔 가운데 칸부터 막았어요/);
  assert.equal(tuningFor('block').whyAfter, 'best');
});

test('"왜 그럴까?" 그림 속의 판과 수는 풀이 프로그램과 다른 방법이 따진 것과 같다', () => {
  let checked = 0;
  const numbers = { 네: 4, 다섯: 5, 여덟: 8 };
  for (const slide of T.why) {
    for (const item of slide.figures) {
      const board = plain(item.piece, item.w, item.h);
      const where = item.note;
      const best = solve(board).best;
      if (item.blocked) {
        // 막은 그림: 정말 조각이 들어갈 자리를 모두 없앤다.
        assert.equal(placementsOf(board, item.blocked).length, 0, where);
        if (item.greedy) {
          assert.deepEqual(item.blocked, greedyBlock(board).slice().sort((a, b) => a - b), where);
          assert.ok(item.blocked.length > best, where);
        }
        if (item.best) assert.equal(item.blocked.length, best, where);
      }
      if (item.spots) {
        // 짚은 자리: 정말 조각이 들어갈 자리이고, 서로 겹치지 않고, 그보다 많이 고를 수는 없다.
        const all = allPlacements(board).map((spot) => spot.join());
        for (const spot of item.spots) assert.ok(all.includes(spot.slice().sort((a, b) => a - b).join()), `${where}: ${spot}`);
        assert.equal(new Set(item.spots.flat()).size, item.spots.flat().length, where);
        assert.equal(item.spots.length, brutePacking(board), where);
      }
      // 글에 적은 수는 그림의 수다.
      const [, word] = where.match(/(네|다섯|여덟) (칸|군데)/);
      assert.equal(numbers[word], item.blocked?.length ?? item.spots.length, where);
      checked += 1;
    }
  }
  assert.equal(checked, 5);
  // 3×3 도미노: 가운데부터 막으면 다섯 칸, 겹치지 않는 자리는 네 군데, 가장 적게 막으면 네 칸
  assert.equal(solve(plain('domino', 3, 3)).best, 4);
  assert.equal(brutePacking(plain('domino', 3, 3)), 4);
  // ㄱ자 세 칸 4×4: 겹치지 않는 자리는 다섯 군데뿐인데 여덟 칸을 막아야 한다(자리 세기로는 모자란다).
  assert.equal(brutePacking(plain('ell', 4, 4)), 5);
  assert.equal(solve(plain('ell', 4, 4)).best, 8);
  // 이야기에서 답을 다 보여 주는 판: 형식의 맨 첫 판(3×3 도미노)과, 사다리에 없는 판(4×4 ㄱ자 세 칸)뿐이다.
  assert.deepEqual(generateBoard(1, 1).board, plain('domino', 3, 3));
  const ladder = LADDER.flatMap((rung) => rung.boards ?? []).map((item) => item.join());
  for (const item of T.why.flatMap((slide) => slide.figures)) {
    if (item.piece === 'domino' && item.w === 3 && item.h === 3) continue;
    assert.ok(!ladder.includes([item.piece, item.w, item.h].join()), `${item.piece} ${item.w}×${item.h}`);
  }
});

test('풀이와 직접 만들기의 글: 가장 적게 막는 칸 수와 한 가지 방법을 알려 준다', () => {
  assert.equal(fill(T.solution.say, { k: 8 }), '가장 적게 막으면 8칸이에요. 한 가지 방법을 보여 줄게요.');
  assert.match(T.make.intro, /다 만들면 선생님에게 풀어 보라고 할 수도 있어요\.$/);
  assert.match(html, /id="block-make-solve"[^>]*>선생님, 풀어 보세요</);
  assert.match(html, /id="block-make-play"[^>]*>내가 해 볼래요</);
  assert.equal(fill(T.make.best, { k: 4 }), '가장 적게 막으면 4칸이에요. 판에 그 칸들을 막아 두었어요.');
  // 조각이 처음부터 들어가지 않는 판은 해 볼 수 없다. 그렇다고 알려 주고 해 보는 단추를 끈다. 공책에도 남기지 않는다.
  assert.match(code, /\$\('block-make-play'\)\.disabled = dead;/);
  assert.match(code, /if \(dead\) \$\('block-make-result'\)\.textContent = T\.make\.none;/);
  assert.match(code, /return allPlacements\(board\)\.length === 0 \? null : board;/);
  // 만든 판은 풀이 프로그램이 풀고, 그 결과를 기록에 남긴다.
  assert.match(code, /kind: 'made',/);
  // 조각 고르기 단추는 여덟 조각 모두이고, 이름은 대본의 이름과 같다.
  const make = part('id="make-block"', '<script');
  for (const piece of PIECE_IDS) assert.match(make, new RegExp(`data-piece="${piece}"><span class="block-make-picture"></span>${T.pieces[piece]}</button>`), piece);
});

test('index.html: 이 형식의 카드, 판, 판 아래, 답하는 칸, 도구, 직접 만들기가 있다', () => {
  for (const id of ['home-block-sample', 'home-block-ask', 'home-block-play', 'home-block-pick', 'home-block-make', 'home-block-blank', 'block-board', 'block-count', 'block-status', 'block-now', 'block-best-line', 'block-best', 'block-spots', 'block-pad', 'block-piece', 'block-piece-name', 'block-again', 'block-stop', 'make-block', 'block-make-pieces', 'block-make-w', 'block-make-h', 'block-make-w-fewer', 'block-make-w-more', 'block-make-h-fewer', 'block-make-h-more', 'block-make-clear', 'block-make-board', 'block-make-result']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(html, new RegExp(`id="home-block-ask"[^>]*>${T.home.ask.replace('?', '\\?')}<`));
  // 카드는 참말 섬 뒤, "퍼즐 만들기" 앞에 있고, "만들기" 목록에도 있다.
  assert.ok(html.indexOf('id="logic-title"') < html.indexOf('id="block-title"'));
  assert.ok(html.indexOf('id="block-title"') < html.indexOf('id="make-title"'));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-block-make" class="menu-item"/);
  // 누르는 법이 판 옆에 적혀 있다.
  assert.ok(visibleText(part('id="block-pad"', 'id="logic-pad"')).includes('칸을 누르면 막혀요. 막은 칸을 다시 누르면 열려요.'));
  // 틀이 형식을 안다.
  const frame = read('src/main.js');
  assert.match(frame, /logic: createLogic\(frame\), block: createBlock\(frame\), /);
  assert.match(read('src/check-main.js'), /\['block', '조각 못 들어가게 막기'\]/);
});

test('색만으로 알리지 않는다: 막은 칸은 가위표, 빠진 칸은 점선 테두리, 들어갈 자리는 굵은 점선 둘레', () => {
  const block = (selector) => css.match(new RegExp(`\\n${selector.replace(/[.]/g, '\\.')} \\{([^}]*)\\}`))[1];
  assert.match(block('.block-cross'), /stroke-width:\s*9/);
  assert.match(block('.block-hole'), /stroke-dasharray/);
  assert.match(block('.block-ghost'), /stroke-dasharray/);
  assert.match(block('.block-spot'), /stroke-width:\s*18/);
  assert.doesNotMatch(block('.block-spot'), /dasharray/);
  assert.match(read('src/ui/block-board.js'), /'block-cross'/);
});

// ---- 수준 맞추기와 공책 ----
let nextId = 0;
function block(overrides = {}) {
  nextId += 1;
  return {
    kind: 'round',
    id: `b${nextId}`,
    format: 'block',
    level: 1,
    seed: nextId,
    custom: false,
    mode: 'play',
    outcome: 'solved',
    hintsOpened: 0,
    answers: [{ t: 40, answer: 'blocked:4', correct: true, guess: null }],
    moveCount: 4,
    completions: [4],
    retries: 0,
    best: 4,
    reachedBest: true,
    stopped: false,
    seconds: 40,
    solution: { possible: true, exact: true, best: 4, blocked: [1, 3, 5, 7], spots: 12 },
    ...overrides,
  };
}

test('수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다', () => {
  const tuning = tuningFor('block');
  assert.deepEqual([tuning.startLevel, tuning.bottomLevel, tuning.topLevel, tuning.hintCount, tuning.fastRetries, tuning.whyAfter], [1, 1, 4, 2, 2, 'best']);
  for (const rung of LADDER.filter((item) => item.mode !== 'make')) assert.ok(tuning.expectedSeconds[rung.level] > 0);
  assert.deepEqual(recommend([], 'block'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  assert.equal(rungOf(tuning.startLevel).tag, 'basic');
  assert.match(read('src/core/level.js'), /조각 못 들어가게 막기\(모두 임시\)/);
  assert.equal(tuningFor('coins').startLevel, TUNING.startLevel);
});

test('"한 번에 빠르게"는 다시 해 보기 두 번 안에 가장 적게 막는 수에 닿은 것이다. 걸린 시간은 보지 않는다', () => {
  assert.deepEqual(recommend([block(), block()], 'block'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  assert.equal(recommend([block(), block({ retries: 3, completions: [7, 6, 5, 4] })], 'block').offerHarder, false);
  assert.equal(recommend([block(), block({ hintsOpened: 1 })], 'block').offerHarder, false);
  assert.equal(recommend([block(), block({ seconds: 3000 })], 'block').offerHarder, true);
  // "여기까지 할래요"로 끝낸 판은 그만둔 판이 아니다. 하다가 나간 판이 이어지면 조용히 한 단계 아래를 먼저 보여 준다.
  const stopped = () => block({ level: 2, stopped: true, reachedBest: false, best: 6, retries: 1, completions: [7, 6] });
  assert.equal(recommend([stopped(), stopped(), stopped()], 'block').reason, 'steady');
  const left = (level) => block({ level, outcome: 'left', reachedBest: false, best: null, completions: [], answers: [], moveCount: 3 });
  assert.deepEqual(recommend([left(3), left(3)], 'block'), { level: 2, small: false, offerHarder: false, harderLevel: null, reason: 'quit' });
  assert.deepEqual(recommend([left(1), left(1)], 'block'), { level: 1, small: true, offerHarder: false, harderLevel: null, reason: 'quit' });
  // 다른 형식의 기록은 영향을 주지 않는다.
  assert.equal(recommend([left(3), left(3)], 'tax').reason, 'start');
  assert.match(code, /reachedBest: solution\.exact && round\.best !== null && round\.best === solution\.best,/);
  assert.match(code, /retries: Math\.max\(0, round\.completions\.length - 1\),/);
});

test('"왜 그럴까?"는 이 형식의 만들어 낸 판을 가장 적게 막아 한 번 끝낸 뒤에 열린다', () => {
  assert.equal(whyUnlocked([], 'block'), false);
  assert.equal(whyUnlocked([block({ stopped: true, reachedBest: false })], 'block'), false);
  assert.equal(whyUnlocked([block({ outcome: 'left', reachedBest: false })], 'block'), false);
  assert.equal(whyUnlocked([block({ level: 5, custom: true })], 'block'), false);
  assert.equal(whyUnlocked([block({ side: true })], 'block'), false, '작은 판');
  assert.equal(whyUnlocked([block()], 'block'), true);
  assert.equal(whyUnlocked([block()], 'tax'), false);
});

test('공책의 가장 좋은 기록: 적게 막을수록 좋은 기록이다(값에 마이너스를 붙여 건넨다)', () => {
  assert.match(code, /bestOf: \(round\) => \(round\.best === null \? null : \{ value: -round\.best, name: fill\(T\.notebook\.best, \{ k: round\.best \}\) \}\),/);
  const board = plain('domino', 3, 3);
  const page = (id, best) => ({ id, key: pageKey('best', { format: 'block', board }), kind: 'best', format: 'block', at: '2026-11-19T00:00:00.000Z', name: fill(T.notebook.best, { k: best }), start: { level: 1, seed: 1, small: false, custom: false, board }, snap: { board }, value: -best });
  let { book } = putPage([], page('n-1', 6));
  assert.equal(putPage(book, page('n-2', 7)).changed, false, '더 많이 막았다');
  assert.equal(putPage(book, page('n-3', 6)).changed, false, '같다');
  const fewer = putPage(book, page('n-4', 4));
  assert.equal(fewer.changed, true);
  book = fewer.book;
  assert.equal(book[0].name, '가장 적게 막은 칸 4');
  assert.equal(book.length, 1);
});
