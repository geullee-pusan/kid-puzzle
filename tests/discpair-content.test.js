// 원판 둘씩 옮기기 대본 점검: 화면에 나오는 글이 약속을 지키는지, "왜 그럴까?"의 그림과 말이 다른 방법으로 따진 것과 맞는지 본다.
// 한 일과 사실만 말한다(틀렸다고 하지 않는다), 힌트는 두 높이, 규칙은 세 문장 안, 색만으로 알리지 않는다.
// 화면 코드와 틀에 이 형식이 이어져 있는지도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { LADDER, generateBoard } from '../src/core/discpair-ladder.js';
import { MAX_CELLS, MAX_TOTAL, checkBoard } from '../src/core/discpair.js';
import { fill, sentenceCount } from '../src/core/text.js';
import { bruteMin, walk } from './helpers/brute-discpair.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/discpair.json'));
const html = read('index.html');
const code = read('src/formats/discpair.js');
const board = read('src/ui/discpair-board.js');
const css = read('src/app.css');

const VALUES = { k: 2, f: 3, n: 5, no: '첫 ', face: '동그라미 칸', total: 9 };
/** 그림과 판의 값은 글이 아니다 */
const DATA_KEYS = ['picture', 'blank', 'seed', 'piles', 'arrows', 'colorOn', 'ring', 'level', 'n'];

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
const own = [part('id="discpair-title"', 'id="tilings-title"'), part('id="discpair-color"', 'id="signs-plus"'), part('id="discpair-count"', 'id="tilings-count"'), part('id="discpair-pad"', 'id="tilings-pad"'), part('id="make-discpair"', 'id="make-tilings"')].map(visibleText).join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const said = strings.map(([, text]) => text).join(' ');
const circleOf = (piles) => piles.filter((_, cell) => cell % 2 === 0).reduce((sum, value) => sum + value, 0);

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 단계 목록이 사다리와 같다', () => {
  assert.equal(T.title, '원판 둘씩 옮기기');
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.deepEqual(T.levels.map((item) => item.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(T.levels.map((item) => item.name), ['모아 보기', '네 칸 고리', '여섯 칸 고리', '칸 수가 다른 고리', '큰 고리', '직접 만들기']);
  for (const entry of T.levels.filter((item) => !item.picture.blank)) assert.equal(checkBoard(generateBoard(entry.level, entry.picture.seed).board), null);
  assert.deepEqual(Object.keys(T.home.ask).sort(), ['big', 'four', 'gather', 'odd', 'six']);
  assert.deepEqual(Object.keys(T.hints).sort(), ['big', 'four', 'gather', 'made', 'odd', 'six']);
});

test('한 일과 사실만 말한다. 판정하는 말, 칭찬 낱말이 없다. 되는 판의 "불가능해요"에는 되는 판이라는 사실만 말한다', () => {
  assert.doesNotMatch(said, /틀렸|틀린|아니에요|땡|정답|아쉽|실수|실패|성공|잘했|훌륭|대단|최고|멋져|멋진|완벽|축하|천재|똑똑|굉장|맞아요|맞혔/);
  assert.doesNotMatch(own, /틀렸|틀린|아니에요|땡|아쉽|실패|잘했|훌륭|대단|최고|멋/);
  assert.match(T.play['possible-press'], /^이 판은 원판을 모두 한 칸에 모을 수 있어요\./);
  assert.match(T.play['possible-press-untried'], /^이 판은 원판을 모두 한 칸에 모을 수 있어요\./);
  assert.match(code, /frame\.say\(round\.moveCount === 0 \? T\.play\['possible-press-untried'\] : T\.play\['possible-press'\]\);/);
  // 되는 판은 모두 모여야 끝난다. "불가능해요"로는 안 되는 판만 끝난다. 한 번(원판 둘)을 끝냈을 때만 모였는지 본다
  assert.match(code, /const correct = solution\.possible === false;/);
  assert.match(code, /if \(correct\) \{\s*frame\.finish\('solved'\);\s*return;\s*\}/);
  assert.match(code, /if \(after\.pending\) \{[\s\S]*?return;\s*\}\s*round\.moveCount \+= 1;\s*if \(isGathered\(after\.piles\)\) \{/);
  assert.equal([...code.matchAll(/frame\.finish\(/g)].length, 2);
  assert.doesNotMatch(code + board, /Math\.random/);
  // 판 아래에는 옮긴 횟수와(색을 켜면) 모양마다의 원판 수만 적는다. 무른 수나 해 본 수는 적지 않는다
  for (const line of code.split('\n')) if (/textContent/.test(line)) assert.doesNotMatch(line, /undoCount|resetCount|loopCount|wrongCount|moveCount|impossibleCount|colorCount/, line.trim());
  const foot = part('id="discpair-count"', 'id="tilings-count"');
  assert.equal([...foot.matchAll(/<strong/g)].length, 3);
  assert.match(visibleText(foot), /옮긴 횟수\s+0\s+번/);
  assert.match(visibleText(foot), /동그라미 칸의 원판\s+0\s+개, 네모 칸의 원판\s+0\s+개/);
});

test('무르기와 처음으로 뒤에는 앞의 말을 덮는 한마디를 한다. 무르기는 첫째 걸음만 했으면 그 걸음을, 아니면 한 번을 무른다', () => {
  assert.equal(T.play.undo, '무르기 전 모습으로 돌아왔어요.');
  assert.equal(T.play.reset, '처음 모습으로 돌아왔어요.');
  assert.match(code, /frame\.say\(T\.play\.undo\);/);
  assert.match(code, /frame\.say\(T\.play\.reset\);/);
  assert.match(code, /const back = round\.trail\.length % 2 === 1 \? 1 : 2;/);
  // 지나온 모습으로 돌아온 말은 한 판에 한 번만 한다
  assert.match(code, /if \(again && !round\.loopSaid\) \{\s*round\.loopSaid = true;\s*frame\.say\(T\.play\.loop\);/);
});

test('규칙 설명은 세 문장 안이다. 두 원판을 같은 칸에서 골라도 되고 저마다 어느 쪽으로 가도 된다고 말한다. 직접 만들기의 안내 글도 세 문장 안이다', () => {
  for (const ask of Object.values(T.asks)) assert.ok(sentenceCount(`${T.rules.move} ${ask}`) <= 3);
  assert.equal(`${T.rules.move} ${T.asks.maybe}`, '원판 두 개를 골라 하나씩 옆 칸으로 옮기면 한 번이에요. 두 원판은 같은 칸에서 골라도 되고, 저마다 어느 쪽으로 가도 돼요. 원판을 모두 한 칸에 모을 수 있을까요?');
  assert.match(code, /ruleLine: \(round\) => `\$\{T\.rules\.move\} \$\{T\.asks\[hasImpossible\(round\) \? 'maybe' : 'gather'\]\}`,/);
  // 1단계(모두 되는 판)에는 "불가능해요" 단추가 없다
  assert.match(code, /const hasImpossible = \(round\) => round\.mode !== 'gather';/);
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 52);
  const mine = guides[42];
  assert.ok(sentenceCount(mine) <= 3, mine);
  assert.match(mine, /^칸을 눌러 원판을 놓거나 빼요\./);
  assert.match(mine, /가장 많이 옮겨야 모이는 판을 만들 수 있을까요\?$/);
  assert.equal(MAX_TOTAL, 10);
  assert.match(mine, /열 개까지/);
});

test('힌트는 판의 종류마다 두 개이고, 하나하나가 질문 한 문장이다. 힌트 1은 함께 쓰는 목록에서 고른다. 까닭은 힌트에 없다', () => {
  const common = ['끝에는 어떤 모양이 되어야 하나요?', '끝나기 바로 전에는 어떤 모양일까요?', '더 작은 판이라면 할 수 있을까요?', '전에 해 본 판 가운데 닮은 판이 있었나요?', '아까와 다른 곳에서 시작하면 어떻게 되나요?', '아직 한 번도 건드리지 않은 곳이 있나요?'];
  for (const [key, list] of Object.entries(T.hints)) {
    assert.equal(list.length, 2, key);
    assert.notEqual(list[0], list[1]);
    assert.ok(common.includes(list[0]), list[0]);
    for (const hint of list) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
      assert.doesNotMatch(hint, /때문|해야 해요|하면 돼요|늘 |\d|홀수|짝수|홀짝|바뀌지 않는 것|그대로/, hint);
    }
  }
  // 네 칸에 원판 둘인 판(더 작은 판이 없다)이 나오는 판의 힌트 1은 "더 작은 판"이 아니다
  for (const key of ['gather', 'four', 'made']) assert.doesNotMatch(T.hints[key][0], /더 작은 판/);
  assert.match(code, /hints: \(round\) => T\.hints\[round\.mode\],/);
});

test('글의 빈칸({이름})은 정해진 이름만 쓰고, 채울 값이 모자라지 않는다', () => {
  const allowed = new Set(['k', 'f', 'n', 'no', 'total', 'level', 'tag', 'face']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
    assert.ok(fill(text, VALUES).length > 0, path);
  }
  assert.equal(fill(T.labels.cell, { no: '첫 ', n: 2 }), '맨 위에서 시계 방향으로 첫 번째 칸, 원판 2개');
  assert.equal(fill(T.labels.board, { n: 6 }), '칸이 6개인 고리');
  assert.equal(fill(T.right['done-back'], { k: 4, n: 2 }), '원판을 모두 한 칸에 모았어요. 4번 옮겼고, 2번 무르거나 되돌렸어요.');
  assert.equal(fill(T.right.reason, { n: 3 }), '색을 켜면 동그라미 칸에 원판이 3개예요.');
  assert.equal(fill(T.make.full, { n: MAX_TOTAL }), '원판은 모두 10개까지 놓을 수 있어요.');
});

test('화면 글에 영어 낱말과 보상 낱말이 없고, "~요"로 끝나는 말투다. 한 문장은 60자를 넘지 않는다', () => {
  for (const [path, text] of strings) assert.doesNotMatch(text.replace(/\{[^{}]*\}/g, ''), /[A-Za-z]/, `${path}: ${text}`);
  assert.doesNotMatch(own, /[A-Za-z]/);
  assert.doesNotMatch(own, /별|점수|순위|레벨|연속/);
  const spoken = [...Object.values(T.home.ask), T.home.pick, T.rules.move, ...Object.values(T.asks), ...Object.values(T.play), ...Object.values(T.hints).flat(), ...Object.values(T.right), T.solution.possible, T.solution.impossible, ...Object.entries(T.make).filter(([key]) => !['size', 'picture-possible', 'picture-impossible'].includes(key)).map(([, text]) => text), ...T.why.map((slide) => slide.say)];
  for (const text of spoken) for (const sentence of sentences(text)) assert.match(sentence, /요[.?!]$/, sentence);
  for (const text of Object.values(T.status)) assert.match(text, /요$/, text);
  for (const text of [T.make['picture-possible'], T.make['picture-impossible'], T.solution['reason-note']]) assert.match(text, /요$/, text);
  for (const slide of T.why) for (const item of slide.figures) assert.match(item.note, /요$/, item.note);
  for (const [path, text] of strings) for (const sentence of sentences(fill(text, VALUES))) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

test('"왜 그럴까?": 동그라미 칸을 세어 가다 홀수가 그대로인 것을 알아챈다 → 한 원판은 늘 다른 모양 칸으로(이름) → 모은 모습은 짝수 → 다섯 칸 고리에서는 통하지 않는다(원판마다 다시 옮기고 세어 본다)', () => {
  assert.equal(T.why.length, 4);
  for (const slide of T.why) assert.ok(sentenceCount(slide.say) <= 3, slide.say);
  const [first, second, third, fourth] = T.why;
  // 첫 장: 그림마다 화살표대로 옮긴 것이 다음 그림이고, 동그라미 칸의 원판 수가 말과 그림 글에 적힌 대로다
  first.figures.slice(1).forEach((item, index) => assert.deepEqual(walk(6, first.figures[index].piles, first.figures[index].arrows), item.piles));
  const counts = first.figures.map((item) => circleOf(item.piles));
  assert.deepEqual(counts, [3, 3, 1, 3]);
  first.figures.forEach((item, index) => assert.match(item.note, new RegExp(`${counts[index]}개예요$`)));
  assert.match(first.say, /3개, 3개, 1개, 3개였어요\./);
  assert.match(first.say, /어, 홀수인 것은 계속 그대로네요\.$/);
  assert.equal(bruteMin(6, first.figures[0].piles), null);
  for (const item of T.why.flatMap((slide) => slide.figures)) assert.equal(item.colorOn, true);
  // 둘째 장: 화살표대로 옮기면 2개 줄고, 2개 늘고, 그대로다. 이름은 여기서 처음 말한다
  const changes = second.figures.map((item) => circleOf(walk(6, item.piles, item.arrows)) - circleOf(item.piles));
  assert.deepEqual(changes, [-2, 2, 0]);
  assert.deepEqual(second.figures.map((item) => item.note), ['이렇게 옮기면 2개 줄어요', '이렇게 옮기면 2개 늘어요', '이렇게 옮기면 그대로예요']);
  assert.match(second.say, /바뀌지 않는 것이라고 불러요\.$/);
  for (const [path, text] of strings) if (!path.startsWith('why[1]')) assert.doesNotMatch(text, /바뀌지 않는 것/, path);
  // 셋째 장: 여섯 개를 한 칸에 모으면 동그라미 칸에 6개나 0개. 되는 판인지는 이 수로 알 수 없다고 짚는다
  assert.deepEqual(third.figures.map((item) => circleOf(item.piles)), [3, 6, 0]);
  third.figures.slice(1).forEach((item) => assert.equal(item.piles.filter((value) => value > 0).length, 1));
  assert.match(third.say, /짝수인 판이 되는지는 이 수로는 알 수 없어서, 선생님이 직접 모아 봤어요\.$/);
  // 넷째 장: 다섯 칸 고리. 0번 칸과 4번 칸이 둘 다 동그라미 칸이라, 그 사이를 지나면 1개만 바뀐다. 짝수 칸 고리라면 안 되는 모습(원판 2개, 동그라미 칸 1개)인데 모인다
  const ring = fourth.figures;
  assert.ok(ring.every((item) => item.n === 5));
  ring.slice(1).forEach((item, index) => assert.deepEqual(walk(5, ring[index].piles, ring[index].arrows), item.piles));
  assert.deepEqual(ring.map((item) => circleOf(item.piles)), [1, 2, 0]);
  assert.ok(ring[0].arrows.some(([from, to]) => (from === 0 && to === 4) || (from === 4 && to === 0)));
  assert.equal(ring.at(-1).piles.filter((value) => value > 0).length, 1);
  assert.equal(bruteMin(5, ring[0].piles), ring.length - 1);
  assert.match(fourth.say, /칸이 홀수 개인 고리는 늘 모을 수 있었어요\.$/);
  assert.match(code, /ringCard\(\{ n: item\.n, piles: item\.piles, colorOn: item\.colorOn === true, arrows: item\.arrows \?\? \[\] \}, item\.note/);
});

test('풀이와 직접 만들기: 되는 판은 가장 적게 옮기는 차례, 안 되는 판은 색을 켠 판과 동그라미 칸의 원판 수를 보인다', () => {
  assert.equal(fill(T.solution.possible, { k: 3 }), '가장 적게 3번 옮기면 원판이 모두 한 칸에 모여요. 한 가지 방법을 보여 줄게요.');
  assert.equal(fill(T.make.possible, { k: 2 }), '이 판은 원판을 모두 한 칸에 모을 수 있어요. 가장 적게 2번 옮기면 돼요.');
  assert.equal(fill(T.make.impossible, { n: 3 }), '이 판은 아무리 해도 한 칸에 모을 수 없어요. 색을 켜면 동그라미 칸에 원판이 3개예요.');
  // 원판이 둘보다 적거나 이미 모인 판은 해 보거나 공책에 남길 것이 없다
  assert.match(code, /if \(!draft \|\| checkBoard\(draft\) !== null \|\| isGathered\(draft\.piles\)\) return null;/);
  assert.match(code, /if \(totalOf\(piles\) >= MAX_TOTAL\) \{/);
  // 따져 준 뒤에 판을 고치면 앞의 판에 한 말을 덮는다
  assert.match(code, /if \(said\) frame\.talkers\.make\.say\(T\.make\.changed\);/);
  const make = part('id="make-discpair"', 'id="make-tilings"');
  for (const id of ['discpair-make-fewer', 'discpair-make-n', 'discpair-make-more', 'discpair-make-tool', 'discpair-make-clear', 'discpair-make-board', 'discpair-make-solve', 'discpair-make-result', 'discpair-make-play', 'discpair-make-picture']) {
    assert.ok(make.includes(`id="${id}"`), id);
  }
  assert.deepEqual([...make.matchAll(/data-tool="(\w+)"/g)].map((match) => match[1]), ['add', 'remove']);
  assert.match(make, /id="discpair-make-solve"[^>]*>선생님, 풀어 보세요</);
  assert.match(make, /id="discpair-make-play"[^>]*>내가 해 볼래요</);
  assert.match(code, /mode: custom \? 'made' : rungOf\(level\)\.mode,/);
  assert.match(code, /\n {4}madeBoard,\n/);
  assert.doesNotMatch(code, /bestOf/);
  assert.equal(MAX_CELLS, 8);
});

test('index.html: 이 형식의 카드, 판, 판 아래, 오른쪽 칸, 도구, 직접 만들기가 있다. 틀에 이어져 있다', () => {
  for (const id of ['home-discpair-sample', 'home-discpair-ask', 'home-discpair-play', 'home-discpair-pick', 'home-discpair-make', 'home-discpair-blank', 'discpair-board', 'discpair-count', 'discpair-status', 'discpair-moves', 'discpair-shapes-line', 'discpair-circle', 'discpair-square', 'discpair-pad', 'discpair-maybe', 'discpair-impossible', 'discpair-color', 'make-discpair']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(part('id="discpair-title"', '</section>'), /<h2 id="discpair-title">원판 둘씩 옮기기<\/h2>/);
  assert.ok(visibleText(part('id="discpair-title"', '</section>')).includes(T.home.ask.gather));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-discpair-make" class="menu-item"/);
  assert.match(part('id="discpair-pad"', 'id="tilings-pad"'), /id="discpair-impossible"[^>]*>불가능해요</);
  assert.match(part('id="discpair-color"', 'id="signs-plus"'), /aria-pressed="false" hidden>색 켜기</);
  assert.equal(T.tool.off, '색 켜기');
  // 카드는 모눈 자동차 경주 다음, 퍼즐 만들기 앞이다
  assert.ok(html.indexOf('id="racetrack-title"') < html.indexOf('id="discpair-title"'));
  assert.ok(html.indexOf('id="discpair-title"') < html.indexOf('id="make-title"'));
  // 틀이 형식을 안다(모눈 자동차 경주 다음)
  assert.match(read('src/main.js'), /racetrack: createRacetrack\(frame\), discpair: createDiscpair\(frame\), /);
  assert.match(read('src/check-main.js'), /\['discpair', '원판 둘씩 옮기기'\]/);
  assert.match(read('src/core/smaller.js'), /racetrack: smallerRacetrack, discpair: smallerDiscpair, /);
  assert.match(code, /smaller: \(round, turn\) => smallerDiscpair\(\{ mode: round\.mode, board: round\.board \}, turn\),/);
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
  // 무르기와 되돌리기가 있다. 판이 둥글어 규칙 글은 왼쪽 칸에 둔다
  assert.match(code, /\$\('undo'\)\.hidden = false;\s*\$\('reset'\)\.hidden = false;/);
  assert.match(code, /ruleAside: true,/);
  // 타이머와 움직이는 그림이 없다
  assert.doesNotMatch(board + code, /setInterval|setTimeout|requestAnimationFrame/);
  // 도구를 처음 켜면 힌트 하나로 센다
  assert.match(code, /hintsOpened: round\.hintsOpened \+ \(round\.colorShown \? 1 : 0\),/);
});

test('화면: 칸(누르는 자리)이 가장 큰 고리에서도 44픽셀보다 크다. 두 색 칸, 든 원판, 갈 수 있는 칸, 막 옮긴 원판은 색만이 아니라 모양으로도 보인다', async () => {
  const { cellSize } = await import('../src/ui/discpair-board.js');
  const size = Number(board.match(/const SIZE = (\d+);/)[1]);
  // 판은 1180×820 화면에서 한 변 430픽셀쯤이다(규칙 글이 왼쪽 칸에 있다). 380픽셀로 잡아도 가장 많은 8칸 고리에서
  const px = 380 / size;
  for (let n = 4; n <= MAX_CELLS; n++) assert.ok(cellSize(n) * px >= 44, `${n}칸: ${cellSize(n) * px}`);
  // 칸이 겹치지 않는다: 옆 칸의 가운데 사이가 칸 한 변보다 길다
  const radius = Number(board.match(/const RADIUS = (\d+);/)[1]);
  for (let n = 4; n <= MAX_CELLS; n++) assert.ok(2 * radius * Math.sin(Math.PI / n) > cellSize(n), `${n}칸`);
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
  // 두 색 칸에는 동그라미와 네모, 든 칸은 굵은 테두리, 갈 수 있는 칸과 막 옮긴 원판은 점선, 원판 수는 글자로도 적는다
  assert.match(board, /shape === 'circle' \? make\('circle'/);
  assert.match(plain, /\.dp-target \{[^}]*stroke-dasharray/);
  assert.match(plain, /\.dp-disc\.fresh \.dp-disc-top,[^{]*\{[^}]*stroke-dasharray/);
  assert.match(plain, /\.dp-ring \{[^}]*stroke-dasharray/);
  assert.match(board, /'dp-count'/);
  assert.match(visibleText(part('id="discpair-pad"', 'id="tilings-pad"')), /방금 옮긴 원판에는 점선이 둘려 있어서 이번에는 다시 옮길 수 없어요\./);
});

/** 끝까지 한 판의 기록 하나 */
function finished(more = {}) {
  return { kind: 'round', id: `r-${more.id ?? 1}`, format: 'discpair', level: 1, seed: 1, custom: false, mode: 'gather', outcome: 'solved', hintsOpened: 0, answers: [{ t: 10, answer: 'done', correct: true, guess: null }], wrongCount: 0, moveCount: 1, seconds: 30, solution: { possible: true, min: 1, circle: 2, square: 0 }, ...more };
}

test('수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다. "왜 그럴까?"는 안 되는 판을 한 번 끝까지 만난 뒤에 열린다', () => {
  const tuning = tuningFor('discpair');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 5);
  assert.equal(tuning.hintCount, 2);
  assert.equal(tuning.whyAfter, undefined);
  assert.equal(tuning.fastWin, undefined);
  assert.equal(tuning.fastSolo, undefined);
  assert.match(read('src/core/level.js'), /원판 둘씩 옮기기\(모두 임시\)/);
  assert.deepEqual(recommend([], 'discpair'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  assert.deepEqual(recommend([finished({ id: 1 }), finished({ id: 2 })], 'discpair'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  // 되는 판에 "불가능해요"를 눌렀으면 "한 번에"가 아니다
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, wrongCount: 1 })], 'discpair').offerHarder, false);
  assert.equal(whyUnlocked([finished()], 'discpair'), false);
  const met = finished({ id: 3, level: 2, seed: 2, mode: 'four', answers: [{ t: 10, answer: 'impossible', correct: true, guess: null }], solution: { possible: false, min: null, circle: 1, square: 1 } });
  assert.equal(whyUnlocked([met], 'discpair'), true);
  assert.equal(whyUnlocked([{ ...met, side: true }], 'discpair'), false);
  assert.match(code, /round\.wrongCount \+= 1;/);
  assert.match(code, /solution: \{ possible: solution\.possible, min: solution\.min, circle: solution\.circle, square: solution\.square \},/);
});
