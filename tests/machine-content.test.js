// 규칙 기계와 규칙이 깨지는 판 대본 점검: 화면에 나오는 글이 약속을 지키는지, 그림 속의 줄과 조각의 수와 주장이 풀이 프로그램과 맞는지 본다.
// 문자로 쓴 식과 공식을 쓰지 않는다, 틀렸다고 하지 않는다, 몇 번 넣었는지 보여 주지 않는다, 힌트는 두 높이, "왜 그럴까?"는 알아챈 이야기,
// 화면 코드와 틀에 이 형식이 이어져 있는지도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { LADDER, MACHINES, MAKE_LEVEL, rungOf } from '../src/core/machine-ladder.js';
import { K_RANGE, circleRegions, crossingsOn, factorPair, fallingLength, preimagesOf, recipeOf, runRow } from '../src/core/machine.js';
import { endsClosed, fill, sentenceCount } from '../src/core/text.js';
import { bruteFalling, bruteRow, bruteStep, sieve } from './helpers/brute-machine.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/machine.json'));
const html = read('index.html');
const code = read('src/formats/machine.js');
const board = read('src/ui/machine-board.js');

const VALUES = { k: 12, f: '가', n: 3, no: 2, face: '수', total: 15 };
/** 그림의 값(기계, 처음 칸, 칸 수 …)은 글이 아니다 */
const DATA_KEYS = ['machine', 'start', 'count', 'filled', 'found', 'target', 'limit', 'cap', 'shown', 'ring', 'fall', 'type', 'kind', 'top', 'chord', 'add', 'from', 'to'];

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
/** from이 든 꼬리표의 처음(<)부터 to가 든 꼬리표의 앞까지 */
const part = (from, to) => {
  const at = html.lastIndexOf('<', html.indexOf(from));
  return html.slice(at, html.lastIndexOf('<', html.indexOf(to, html.indexOf(from))));
};
const own = [part('id="machine-title"', 'id="make-title"'), part('id="machine-board"', 'id="rulehunt-board"'), part('id="machine-count"', 'id="coins-count"'), part('id="machine-pad"', 'id="maze-pad"'), part('id="make-machine"', '<script')]
  .map(visibleText)
  .join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const slides = Object.values(T.why).flat();
const figures = slides.flatMap((slide) => slide.figures);
const bruteApply = (machine, n) => machine.steps.reduce((value, step) => bruteStep(step, value), n);

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 단계 목록이 사다리와 같다', () => {
  assert.equal(T.title, '규칙 기계와 규칙이 깨지는 판');
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.deepEqual(T.levels.map((item) => item.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(T.levels.map((item) => item.name), ['몇 칸 채우기', '넣은 수와 나온 수', '먼 칸 맞히기', '계속 작아지는 줄', '규칙이 깨지는 판', '직접 만들기']);
  for (const rung of LADDER.filter((item) => item.modes[0] !== 'make')) assert.ok(T.home.ask[rung.hint], rung.level);
});

test('문자로 쓴 식, 공식, 용어를 쓰지 않는다. 같은 숫자끼리 곱하는 것을 다른 이름으로 부르지 않는다', () => {
  const banned = /제곱|공식|수열|등차|등비|n번째|소수|피보나치|항등|변수/;
  for (const [path, text] of strings) {
    assert.doesNotMatch(text, banned, `${path}: ${text}`);
    // 수 대신 글자를 쓴 식이 없다(빈칸 이름은 빼고 본다)
    assert.doesNotMatch(text.replace(/\{[^{}]*\}/g, ''), /[A-Za-z]/, `${path}: ${text}`);
  }
  assert.doesNotMatch(own, banned);
  // 블록의 말: 앞의 블록은 "~하고", 마지막 블록은 "~해요"
  for (const [key, block] of Object.entries(T.blocks)) {
    assert.match(block.and, /고$/, key);
    assert.match(block.end, /요$/, key);
  }
  for (const op of Object.keys(T.makeOps)) assert.ok(T.blocks[op] || T.blocks[`${op}-closed`], op);
  // 수를 받는 블록은 받침에 따라 고른다
  for (const op of Object.keys(K_RANGE)) assert.ok(T.blocks[`${op}-closed`] && T.blocks[`${op}-open`], op);
  assert.equal(fill(T.rules.fill, { f: '자리를 뒤집고 1을 더해요' }).split('. ')[0], '기계에 수를 넣으면 자리를 뒤집고 1을 더해요');
  assert.match(code, /const machineWords = \(machine\) => machine\.steps\.map\(\(step, at\) => stepWord\(step, at === machine\.steps\.length - 1 \? 'end' : 'and'\)\)\.join\(' '\);/);
});

test('규칙 설명은 세 문장 안이다. 판의 종류마다 있고, 직접 만들기의 안내 글도 세 문장 안이다', () => {
  for (const [key, rule] of Object.entries(T.rules)) assert.ok(sentenceCount(fill(rule, { ...VALUES, f: '자리를 뒤집고 1을 더해요' })) <= 3, key);
  assert.match(T.rules['back-closed'], /하나도 없을 수도 있어요\.$/);
  assert.match(T.rules.far, /\{no\}번째 칸에는 어떤 수가 있을까요\?$/);
  assert.match(T.rules['record-pair'], /처음부터 계속 작아지기만 하는 칸을 가장 길게 만들어 보세요\.$/);
  assert.match(T.rules.circle, /점이 늘면 조각은 몇 개가 될까요\?$/);
  assert.match(T.rules['prime-closed'], /^차림표: 수에 그 수를 곱하고, 그 수를 더하고, \{k\}을 더해요\./);
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 19);
  assert.ok(sentenceCount(guides[17]) <= 3, guides[17]);
  assert.match(guides[17], /아무리 돌려도 되풀이되지 않는 기계도 만들 수 있을까요\?$/);
});

test('수 뒤에 붙는 말(은/는, 을/를, 이/가, 과/와, 이에요/예요)은 읽는 소리의 받침으로 고른다', () => {
  assert.match(code, /const pick = \(group, key, number\) => group\[`\$\{key\}-\$\{endsClosed\(number\) \? 'closed' : 'open'\}`\];/);
  for (const group of [T.rules, T.blocks, T.entry, T.status, T.play, T.right, T.solution]) {
    for (const key of Object.keys(group)) {
      const match = key.match(/^(.*)-(closed|open)$/);
      if (match) assert.ok(group[`${match[1]}-${match[2] === 'closed' ? 'open' : 'closed'}`], key);
    }
  }
  const say = (group, key, k, more = {}) => fill(group[`${key}-${endsClosed(k) ? 'closed' : 'open'}`], { k, ...more });
  assert.equal(say(T.play, 'fill-wrong', 23), '23은 이 칸의 수와 다른 것 같아요. 다시 계산해 볼까요?');
  assert.equal(say(T.play, 'fill-wrong', 32), '32는 이 칸의 수와 다른 것 같아요. 다시 계산해 볼까요?');
  assert.equal(say(T.play, 'box-wrong', 9), '선생님이 몰래 넣어 보니 9와 다른 수가 나왔어요.');
  assert.equal(say(T.play, 'box-wrong', 13), '선생님이 몰래 넣어 보니 13과 다른 수가 나왔어요.');
  assert.equal(fill(T.blocks['add-closed'].and, { k: 1 }), '1을 더하고');
  assert.equal(fill(T.blocks['mul-open'].end, { k: 2 }), '2를 곱해요');
  assert.equal(fill(T.play['peek-open'], { n: 24 }), '기계 속을 보면 나온 수는 24예요. 칸에 적어 두었어요.');
  assert.equal(fill(T.play['prime-split-closed'], { k: 41, f: 41 }), '나온 수는 41 × 41이에요. 약수가 1과 자기 자신 말고도 있어요.');
  for (const item of figures) {
    for (const [, number, tail] of item.note.matchAll(/(\d+)(이에요|예요)/g)) assert.equal(tail === '이에요', endsClosed(Number(number)), item.note);
  }
});

test('틀렸다고 하지 않고 사실만 말한다. 칭찬 낱말, 보상 낱말이 없다. 더 좋은 답이 남은 줄에서는 더 길게 만들 수 있을지 묻는다', () => {
  const said = strings.map(([, text]) => text).join(' ');
  assert.doesNotMatch(said, /틀렸|틀린|아니에요|땡|아쉽|실패|실수|잘했|훌륭|대단|최고|멋져|멋진|천재|똑똑|완벽|굉장|축하|성공|점수|기록을 깨|신기록/);
  assert.doesNotMatch(own, /틀렸|틀린|아니에요|땡|아쉽|실패|잘했|훌륭|대단|최고|멋/);
  assert.equal(fill(T.play['record-run'], { n: 3 }), '처음부터 3칸이 계속 작아졌어요. 더 길게 만들 수 있을까요?');
  assert.match(T.play['back-more-closed'], /더 있어요\. 다른 수도 넣어 볼까요\?$/);
  // 다른 칸의 수를 넣으면: 다른 것 같다는 짐작과 할 일 하나. 기계의 가운데까지만 한 수면 그 사실
  assert.match(T.play['fill-partial-closed'], /남은 일이 있어요\.$/);
  // 먼 칸이 다르면: 사실 하나와 볼 곳 하나
  assert.match(T.play['far-wrong-closed'], /같은 수가 다시 나온 칸이 있나요\?$/);
});

test('몇 번 넣었는지, 몇 번 돌렸는지는 판에 적지 않는다(기록에만 남긴다). 가장 긴 줄은 판 아래에 보이고 공책에 남는다', () => {
  const foot = part('id="machine-count"', 'id="coins-count"');
  assert.doesNotMatch(visibleText(foot), /번|횟수/);
  for (const [path, text] of strings.filter(([key]) => key.startsWith('status.'))) assert.doesNotMatch(text, /\{n\}번(?!째)|번 넣|번 돌/, path);
  assert.match(code, /moveCount: round\.moveCount,/);
  assert.match(code, /runs: round\.runs,/);
  for (const line of code.split('\n')) if (/textContent/.test(line)) assert.doesNotMatch(line, /moveCount|wrongCount|claims|helped|markCount/, line.trim());
  assert.equal(fill(T.notebook.best, { f: '89, 55', n: 10 }), '89, 55에서 시작해 10칸');
  assert.match(code, /bestOf: \(round\) => \(round\.mode !== 'record' \|\| round\.best === null \? null : \{ value: round\.best\.length,/);
});

test('힌트는 판의 종류마다 두 개이고, 하나하나가 질문 한 문장이다', () => {
  assert.deepEqual(Object.keys(T.hints).sort(), ['back', 'box', 'circle', 'far', 'fill', 'prime', 'record', 'record-pair']);
  for (const [key, list] of Object.entries(T.hints)) {
    assert.equal(list.length, 2, key);
    assert.notEqual(list[0], list[1]);
    for (const hint of list) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
    }
  }
  assert.match(code, /const hintKey = \(round\) => \(round\.mode === 'record' && isPair\(round\) \? 'record-pair' : round\.mode\);/);
});

test('글의 빈칸({이름})은 정해진 이름만 쓰고, 채울 값이 모자라지 않는다', () => {
  const allowed = new Set(['k', 'f', 'n', 'no', 'total', 'level', 'tag', 'face']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
    assert.ok(fill(text, VALUES).length > 0, path);
  }
});

test('화면 글에 영어 낱말이 없고, "~요"로 끝나는 말투다. 한 문장은 60자를 넘지 않는다', () => {
  assert.doesNotMatch(own, /[A-Za-z]/);
  const spoken = [
    ...Object.values(T.home.ask),
    T.home.pick,
    ...Object.values(T.rules).map((text) => fill(text, { ...VALUES, f: '자리를 뒤집고 1을 더해요' })),
    ...Object.values(T.play),
    ...Object.values(T.hints).flat(),
    ...Object.values(T.right),
    ...Object.entries(T.solution).filter(([key]) => !key.includes('note')).map(([, text]) => text),
    ...Object.entries(T.make).filter(([key]) => key !== 'count').map(([, text]) => text),
    ...slides.map((slide) => slide.say),
  ];
  for (const text of spoken) for (const sentence of sentences(text)) assert.match(sentence, /요[.?!]$/, sentence);
  for (const text of [...Object.values(T.cellState), ...Object.values(T.regionState), ...Object.values(T.gridState), ...Object.values(T.rowState).filter((item) => /요$/.test(item))]) assert.match(text, /요$|\{[kn]\}$/, text);
  for (const item of figures) assert.match(item.note, /요$/, item.note);
  for (const [path, text] of strings) for (const sentence of sentences(text)) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

/** 그림 속 기계의 이름 → 기계 */
const machineOf = (name) => MACHINES[name];

test('"왜 그럴까?"(되풀이): 줄과 표시한 칸, 243, 커지기만 하는 기계가 풀이 프로그램으로 다시 구한 것과 같다', () => {
  const story = T.why.repeat;
  assert.equal(story.length, 4);
  for (const slide of story) assert.ok(sentenceCount(slide.say) <= 3, slide.say);
  // 줄 그림: 표시한 칸은 같은 수끼리다
  for (const item of story.flatMap((slide) => slide.figures)) {
    const cells = bruteRow(machineOf(item.machine), item.start, item.count);
    assert.deepEqual(runRow(machineOf(item.machine), item.start, item.count), cells);
    if (item.ring.length === 2) assert.equal(cells[item.ring[0]], cells[item.ring[1]], item.note);
  }
  // 첫 장: 2에서 4, 16, 37, 58, 89, 145, 42, 20을 지나 다시 4. 7에서는 1이 되고 1만 나온다
  assert.deepEqual(bruteRow(MACHINES.squares, [2], 10), [2, 4, 16, 37, 58, 89, 145, 42, 20, 4]);
  assert.match(story[0].say, /2에서 시작하니 4, 16, 37, 58, 89, 145, 42, 20을 지나 다시 4가 나왔어요\./);
  assert.deepEqual(bruteRow(MACHINES.squares, [7], 7).slice(-2), [1, 1]);
  // 둘째 장: 세 자리까지의 수를 넣으면 243보다 커지지 않고, 999는 243
  let biggest = 0;
  for (let n = 1; n <= 999; n++) biggest = Math.max(biggest, bruteApply(MACHINES.squares, n));
  assert.equal(biggest, 243);
  assert.equal(bruteApply(MACHINES.squares, 999), 243);
  // 셋째 장: 57에서 10이 다시 나오고 10 다음은 늘 2
  assert.deepEqual(story[2].figures[0].ring, [7, 16]);
  assert.equal(bruteRow(MACHINES.revAdd, [57], 18)[17], 2);
  // 넷째 장(까닭이 그대로는 통하지 않는 기계): 2를 곱하는 기계는 1에서 커지기만 한다
  const doubling = bruteRow(MACHINES.times2, [1], 30);
  for (let at = 1; at < doubling.length; at++) assert.ok(doubling[at] > doubling[at - 1]);
});

test('"왜 그럴까?"(작아지는 줄): 끝에서부터 거꾸로 만들면 앞의 두 수를 더해 가고, 99까지는 89, 55가 가장 길다', () => {
  const story = T.why.record;
  assert.equal(story.length, 4);
  for (const slide of story) assert.ok(sentenceCount(slide.say) <= 3, slide.say);
  for (const item of story.flatMap((slide) => slide.figures)) {
    const length = bruteFalling(machineOf(item.machine), item.start);
    assert.equal(fallingLength(machineOf(item.machine), item.start), length);
    assert.match(item.note, new RegExp(`${length}칸`), item.note);
  }
  assert.deepEqual(bruteRow(MACHINES.pair, [99, 50], 5), [99, 50, 49, 1, 48]);
  assert.match(story[0].say, /49, 1까지 작아지다가 바로 48로 커졌어요\./);
  // 뒤의 두 수를 더해 가면 3, 5, 8, …, 89, 그다음은 144
  const back = [1, 2];
  while (back.at(-1) < 100) back.push(back.at(-1) + back.at(-2));
  assert.deepEqual(back, [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144]);
  assert.match(story[2].say, /3, 5, 8, 13, 21, 34, 55, 89, 그다음은 144라서 99를 넘어요\./);
  // 넷째 장: 6이 나오는 두 자리 수는 16, 23, 32, 61
  assert.deepEqual(preimagesOf(MACHINES.product, 6, 10, 99), [16, 23, 32, 61]);
});

test('"왜 그럴까?"(깨지는 판): 조각 31과 57, 새 선이 엇갈린 곳과 늘어나는 조각, 차림표의 1681 = 41 × 41', () => {
  const story = T.why.break;
  assert.equal(story.length, 4);
  for (const slide of story) assert.ok(sentenceCount(slide.say) <= 3, slide.say);
  for (const item of story.flatMap((slide) => slide.figures)) {
    if (item.type === 'circle') {
      if (item.chord) {
        const crossings = crossingsOn(item.count, item.chord).length;
        assert.equal(item.note, `엇갈린 곳 ${crossings}군데, 조각 ${crossings + 1}개가 늘어요`);
      } else assert.equal(item.note, `조각 ${circleRegions(item.count).length}개예요`);
    }
    if (item.type === 'table') {
      const counts = Array.from({ length: item.top }, (_, at) => circleRegions(at + 1).length);
      assert.ok(item.note.includes(counts.at(-1)), item.note);
    }
    if (item.type === 'grid') {
      const prime = sieve(5000);
      for (let n = item.from; n <= item.to; n++) assert.equal(prime[recipeOf(item.add, n)], n !== 40, String(n));
    }
  }
  assert.match(story[0].say, /하나씩 세어 보니 31개였어요\.$/);
  assert.match(story[2].say, /^점이 7개면 조각은 57개예요\./);
  assert.deepEqual(factorPair(recipeOf(41, 40)), [41, 41]);
  assert.match(story[3].say, /1681은 41 × 41이에요\./);
  // 원 그림의 조각 수가 하나씩 센 것과 같다(그림이 바뀌어도 이야기가 맞게)
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map((count) => circleRegions(count).length), [1, 2, 4, 8, 16, 31, 57]);
});

test('판 고르기의 그림: 단계마다 그 단계의 판이고, 채운 칸과 찾은 수가 맞는다', () => {
  for (const entry of T.levels) {
    const rung = rungOf(entry.level);
    const { picture } = entry;
    if (rung.modes[0] === 'make') {
      assert.equal(picture.blank, true);
      continue;
    }
    assert.ok(rung.modes.includes(picture.kind), entry.name);
    if (picture.filled) assert.deepEqual(picture.filled, bruteRow(machineOf(picture.machine), picture.start, picture.start.length + picture.filled.length).slice(picture.start.length));
    if (picture.found) for (const n of picture.found) assert.equal(bruteApply(machineOf(picture.machine), n), picture.target);
  }
});

test('직접 만들기: 블록으로 기계를 만들고 처음 칸을 넣으면 선생님이 돌려 보고 되풀이를 알려 준다', () => {
  const make = part('id="make-machine"', '<script');
  for (const id of ['machine-make-tabs', 'machine-make-blocks-box', 'machine-make-count', 'machine-make-ops', 'machine-make-fewer', 'machine-make-k', 'machine-make-more', 'machine-make-clear', 'machine-make-pair-note', 'machine-make-board', 'machine-make-typed', 'machine-make-keys', 'machine-make-slot-a', 'machine-make-slot-b', 'machine-make-solve', 'machine-make-result', 'machine-make-play']) {
    assert.ok(make.includes(`id="${id}"`), id);
  }
  assert.match(make, /id="machine-make-solve"[^>]*>선생님, 돌려 주세요</);
  assert.match(make, /id="machine-make-play"[^>]*>내가 해 볼래요</);
  // 블록 단추의 이름은 대본에서 채운다(화면 글에 "더하기"가 두 군데 따로 있지 않게)
  assert.deepEqual([...make.matchAll(/data-op="(\w+)"><\/button>/g)].map((match) => match[1]), ['rev', 'add', 'mul', 'dsum', 'dsq', 'dprod', 'last2', 'addrev']);
  assert.equal(fill(T.make.repeat, { f: '첫 ', n: 8 }), '첫 번째 칸부터 8칸마다 같은 수가 되풀이돼요.');
  assert.match(T.make['keep-not-yet'], /볼까요\?$/);
  assert.match(code, /\n {4}madeBoard,\n/);
});

test('index.html: 이 형식의 카드, 판, 판 아래, 답하는 칸, 직접 만들기가 있다. 틀에 이어져 있다', () => {
  for (const id of ['home-machine-sample', 'home-machine-ask', 'home-machine-play', 'home-machine-pick', 'home-machine-make', 'home-machine-blank', 'machine-board', 'machine-count', 'machine-status', 'machine-best-line', 'machine-best', 'machine-pad', 'machine-entry-box', 'machine-entry-title', 'machine-typed-line', 'machine-typed', 'machine-pair-line', 'machine-slot-a', 'machine-slot-b', 'machine-keys', 'machine-put', 'machine-try', 'machine-guess', 'machine-run', 'machine-note', 'machine-box-note', 'machine-peek', 'machine-found-box', 'machine-all', 'machine-step', 'machine-count-box', 'machine-clear', 'machine-ask-box', 'machine-always', 'machine-sometimes', 'machine-computer', 'make-machine']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(part('id="machine-title"', '</section>'), /<h2 id="machine-title">규칙 기계와 규칙이 깨지는 판<\/h2>/);
  assert.ok(visibleText(part('id="machine-title"', '</section>')).includes(T.home.ask.fill));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-machine-make" class="menu-item"/);
  assert.equal([...part('id="machine-keys"', 'id="machine-put"').matchAll(/data-n="(\w+)"/g)].map((match) => match[1]).join(), '1,2,3,4,5,6,7,8,9,0,erase');
  // 틀이 형식을 안다(형식 목록에서 방 한 번씩 돌기 다음)
  assert.match(read('src/main.js'), /rooms: createRooms\(frame\), machine: createMachine\(frame\), /);
  assert.match(read('src/check-main.js'), /\['machine', '규칙 기계와 규칙이 깨지는 판'\]/);
  // 무르기와 되돌리기를 쓰지 않아서, 켜질 때 앞의 형식(방 한 번씩 돌기)이 보이게 해 둔 것을 감춘다
  assert.match(code, /if \(on\) \{\s*\/\/[^\n]*\n\s*\$\('undo'\)\.hidden = true;\s*\$\('reset'\)\.hidden = true;/);
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
  assert.doesNotMatch(code, /Math\.random/);
  // 원의 조각은 누를 수 있고 읽어 주는 이름이 있다. 컴퓨터가 넣어 본 칸은 누르기 전에는 약수가 둘뿐인지 읽어 주지 않는다
  assert.match(board, /piece\.setAttribute\('aria-label', view\.label\(region\)\);/);
  assert.match(code, /const label = found \|\| checked \? fill\(T\.gridState/);
});

/** 끝까지 한 판의 기록 하나 */
function finished(more = {}) {
  return { kind: 'round', id: `r-${Math.random()}`, format: 'machine', level: 1, seed: 2, custom: false, mode: 'fill', outcome: 'solved', hintsOpened: 0, answers: [{ t: 30, answer: 'cell2:32', correct: true, guess: null }], wrongCount: 0, moveCount: 4, seconds: 40, ...more };
}

test('수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다', () => {
  const tuning = tuningFor('machine');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 5);
  assert.equal(tuning.hintCount, 2);
  assert.equal(tuning.whyAfter, 'finished');
  assert.match(read('src/core/level.js'), /규칙 기계와 규칙이 깨지는 판\(모두 임시\)/);
  assert.deepEqual(recommend([], 'machine'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  assert.deepEqual(recommend([finished(), finished()], 'machine'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  assert.equal(recommend([finished(), finished({ wrongCount: 1 })], 'machine').offerHarder, false);
  assert.equal(whyUnlocked([], 'machine'), false);
  assert.equal(whyUnlocked([finished()], 'machine'), true);
  assert.equal(MAKE_LEVEL, 6);
});
