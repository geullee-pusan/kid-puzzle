// 엉킨 그림 풀기 대본 점검: 화면에 나오는 글이 약속을 지키는지, 그림 속의 겹친 곳과 주장이 다시 센 것과 맞는지 본다.
// 풀 수 있는 그림에 "불가능해요"를 눌러도 틀렸다고 하지 않는다, 몇 번 옮겼는지 판 아래에 적지 않는다, 힌트는 두 높이,
// "왜 그럴까?"는 알아챈 이야기, 생각의 이름은 넷째 장에서 처음, 화면 코드와 틀에 이 형식이 이어져 있는지도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { fill, sentenceCount } from '../src/core/text.js';
import { LADDER, MAKE_LEVEL, NAMED, rungOf } from '../src/core/untangle-ladder.js';
import { checkBoard, isPlanar } from '../src/core/untangle.js';
import { bentCrossings } from '../src/ui/untangle-board.js';
import { problemsBrute } from './helpers/brute-untangle.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/untangle.json'));
const html = read('index.html');
const code = read('src/formats/untangle.js');

const VALUES = { k: 3, f: '가', n: 4, no: 2, face: T.solution.faces.k5, total: 12 };

/** 대본의 모든 글(값)을 길과 함께 모은다. 설명(_로 시작하는 것)과 그림의 값은 뺀다. */
function allStrings(value, path = '') {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((item, index) => allStrings(item, `${path}[${index}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .filter(([key]) => !key.startsWith('_') && !['points', 'edges', 'roles', 'loop', 'off', 'bends', 'crossings', 'picture'].includes(key))
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
  part('id="untangle-title"', 'id="make-title"'),
  part('id="untangle-loop"', 'id="code-left"'),
  part('id="untangle-board"', 'id="swap-board"'),
  part('id="untangle-count"', 'id="swap-count"'),
  part('id="untangle-pad"', 'id="swap-pad"'),
  part('id="make-untangle"', '<script'),
]
  .map(visibleText)
  .join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const figures = T.why.flatMap((slide) => slide.figures);

/** 그림 속 엇갈린 곳의 수: 굽은 선이 있으면 잘게 나눈 꺾은선으로, 없으면 정수로 센다 */
function crossingsOf(item) {
  const off = item.off ?? [];
  if (item.bends) return bentCrossings(item.points, item.edges, item.bends, off).length;
  const brute = problemsBrute(item.points, item.edges, off);
  assert.equal(brute.touches, 0, item.note);
  return brute.crossings;
}

/** 고리(굵은 선)를 따라 점의 차례를 구한다 */
function loopOrder(item) {
  const edges = item.loop.map((index) => item.edges[index]);
  const order = [edges[0][0]];
  let prev = -1;
  for (;;) {
    const at = order[order.length - 1];
    const next = edges.flatMap(([a, b]) => (a === at ? [b] : b === at ? [a] : [])).find((w) => w !== prev && (order.length < 2 || w !== order[order.length - 2]));
    if (next === order[0] || next === undefined) break;
    prev = at;
    order.push(next);
  }
  return order;
}

/** 고리의 차례에서 두 길(지름선)의 끝이 번갈아 놓이는가(같은 쪽에 그으면 엇갈린다) */
function alternate(order, [a, b], [c, d]) {
  const at = (v) => order.indexOf(v);
  const inside = (x) => {
    const [lo, hi] = [Math.min(at(a), at(b)), Math.max(at(a), at(b))];
    return at(x) > lo && at(x) < hi;
  };
  if (new Set([a, b, c, d]).size < 4) return false;
  return inside(c) !== inside(d);
}

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 단계 목록이 사다리와 같다', () => {
  assert.equal(T.title, '엉킨 그림 풀기');
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.deepEqual(T.levels.map((item) => item.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(T.levels.map((item) => item.name), ['작은 엉킨 그림', '큰 엉킨 그림', '안 풀리는 그림도 섞여요', '집과 우물, 마을과 길', '가장 적게 빼고 풀기', '직접 만들기']);
});

test('규칙 설명은 세 문장 안이고, 점을 끌어 옮기는 것과 겹치지 않게 하는 것을 말한다. 직접 만들기의 안내 글도 세 문장 안이다', () => {
  assert.deepEqual(Object.keys(T.rules).sort(), ['houses', 'houses-bridge', 'made', 'mix', 'record', 'towns', 'towns-bridge', 'untangle']);
  for (const [key, rule] of Object.entries(T.rules)) {
    assert.ok(sentenceCount(rule) <= 3, rule);
    if (key !== 'record') assert.match(rule, /끌어 옮겨서|겹쳐도 돼요/, key);
  }
  // 풀 수 없는 그림이 섞이는 판의 규칙만 "불가능해요"를 말한다.
  for (const key of ['mix', 'houses', 'towns', 'made']) assert.match(T.rules[key], /‘불가능해요’를 눌러요\.$/, key);
  for (const key of ['untangle', 'record', 'houses-bridge', 'towns-bridge']) assert.doesNotMatch(T.rules[key], /불가능해요/, key);
  // 같은 그림을 점과 선, 집과 우물, 마을과 길로 부른다.
  assert.match(T.rules.houses, /^집과 우물은 점이고, 길은 선이에요\./);
  assert.match(T.rules.towns, /^마을은 점이고, 마을 사이의 길은 선이에요\./);
  assert.match(T.rules['houses-bridge'], /다리를 하나 놓을 수 있어서 한 곳은 겹쳐도 돼요\./);
  // 형식이 판의 종류(이야기 판은 옷과 다리)로 규칙 글을 고른다.
  assert.match(code, /return round\.board\.bridges > 0 \? `\$\{kind\}-bridge` : kind;/);
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 28);
  assert.ok(sentenceCount(guides[14]) <= 3, guides[14]);
  assert.match(guides[14], /아무리 옮겨도 안 풀리는 그림도 만들 수 있을까요\?$/);
});

test('풀 수 있는 그림에 "불가능해요"를 눌러도 틀렸다고 하지 않는다. 풀 수 있다는 사실과 할 수 있는 일만 말하고 판은 이어진다', () => {
  const said = [...Object.values(T.play), ...Object.values(T.right), ...Object.values(T.status), ...Object.values(T.make)].filter((text) => typeof text === 'string').join(' ');
  assert.doesNotMatch(said, /틀렸|틀린|아니에요|땡|정답|아쉽|실수|실패|성공|잘했|훌륭|대단|최고|멋져|완벽|축하/);
  assert.equal(T.play['possible-press'], '이 그림은 겹친 곳 없이 풀 수 있어요. 더 옮겨 볼 수 있어요.');
  assert.equal(fill(T.play['possible-press-fewest'], { n: 1 }), '이 그림은 겹친 곳 없이 풀 수 있어요. 지금까지 겹친 곳이 가장 적었을 때는 1군데였어요.');
  // 풀 수 있는 그림에 누른 "불가능해요"는 판을 끝내지 않는다(기록에는 남는다).
  assert.match(code, /const correct = kind === 'untangled' \|\| !solution\.possible;/);
  assert.match(code, /if \(correct\) \{\s*frame\.finish\('solved'\);\s*return;\s*\}/);
  assert.match(code, /round\.impossibleCount \+= 1;/);
  // 다 풀리면 판이 저절로 끝난다(다리 판은 엇갈린 곳이 다리 수 이하면).
  assert.match(code, /\} else if \(untangled\(round\.points, round\.board\.edges, round\.board\.bridges\)\) \{\s*submit\('untangled'\);/);
  // 가장 적게 빼기: 더 줄일 수 있으면 "더 적게 빼고도 풀 수 있을까요?"라고 묻는다.
  assert.match(T.play['record-done'], /더 적게 빼고도 풀 수 있을까요\?$/);
  assert.doesNotMatch(code, /Math\.random/);
});

test('판 아래에는 겹친 곳의 수만 적는다(몇 번 옮겼는지는 적지 않는다). 가장 적게 빼기 판에는 뺀 선과 이 판에서 가장 적게 뺀 수', () => {
  const foot = part('id="untangle-count"', 'id="swap-count"');
  assert.deepEqual([...foot.matchAll(/<strong id="([\w-]+)"/g)].map((match) => match[1]), ['untangle-left', 'untangle-off', 'untangle-best']);
  assert.match(visibleText(foot), /겹친 곳\s+0\s+군데/);
  assert.doesNotMatch(visibleText(foot), /옮긴|번 /);
  for (const line of code.split('\n')) if (/textContent/.test(line)) assert.doesNotMatch(line, /moveCount|undoCount|impossibleCount/, line.trim());
  // 겹친 곳에는 모양(고리)으로 표시한다. 색만으로 알리지 않는다.
  const board = read('src/ui/untangle-board.js');
  assert.match(board, /'tangle-cross'/);
  assert.match(board, /'tangle-cross touch'/);
});

test('힌트는 판의 종류마다 두 개이고, 하나하나가 질문 한 문장이다. 까닭(고리의 안과 밖)은 힌트에서 말하지 않는다', () => {
  assert.deepEqual(Object.keys(T.hints).sort(), ['mix', 'record', 'story', 'untangle']);
  for (const rung of LADDER.filter((item) => item.mode !== 'make')) assert.ok(T.hints[rung.mode], rung.level);
  for (const [key, list] of Object.entries(T.hints)) {
    assert.equal(list.length, 2, key);
    assert.notEqual(list[0], list[1]);
    for (const hint of list) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
      assert.doesNotMatch(hint, /안쪽|바깥쪽|안팎/, hint);
    }
  }
  // 직접 만든 그림은 섞인 판(풀 수 없는 그림도 있다)으로 연다.
  assert.match(code, /mode: custom \? 'mix' : rungOf\(level\)\.mode,/);
});

test('글의 빈칸({이름})은 정해진 이름만 쓰고, 채울 값이 모자라지 않는다', () => {
  const allowed = new Set(['k', 'f', 'n', 'no', 'total', 'level', 'tag', 'face']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
    assert.ok(fill(text, VALUES).length > 0, path);
  }
  assert.equal(fill(T.edgeLabel, { no: 1, n: 3 }), '1번과 3번을 잇는 선');
  assert.equal(fill(T.roleLabel.well, { no: 4 }), '4번 우물');
  assert.equal(fill(T.solution.impossible, { face: T.solution.faces.k33 }), '이 그림은 어떻게 옮겨도 겹친 곳이 남아요. 두 겹 고리를 두른 점들은 굵은 선을 따라 집 셋과 우물 셋을 모두 잇는 그림처럼 이어져 있어요.');
});

test('화면 글에 영어 낱말과 보상 낱말이 없고, "~요"로 끝나는 말투다. 한 문장은 60자를 넘지 않는다', () => {
  for (const [path, text] of strings) assert.doesNotMatch(text.replace(/\{[^{}]*\}/g, ''), /[A-Za-z]/, `${path}: ${text}`);
  assert.doesNotMatch(own, /[A-Za-z]/);
  // 다른 형식의 검사가 처음 화면 파일 전체에서 보는 낱말도 쓰지 않는다.
  assert.doesNotMatch(own, /것 같아요|부족|모자라|다시 생각|너무 많|지난번|홀수|짝수|건너뛰|별/);
  const spoken = [
    ...Object.values(T.home.ask),
    T.home.pick,
    ...Object.values(T.rules),
    ...Object.values(T.play),
    ...Object.values(T.hints).flat(),
    ...Object.values(T.right),
    T.solution.possible,
    T.solution.bridge,
    T.solution.impossible,
    T.solution.record,
    T.make.intro,
    T.make.planar,
    T.make.flat,
    T.make.impossible,
    T.make.full,
    T.make['keep-not-yet'],
    ...T.why.map((slide) => slide.say),
  ];
  for (const text of spoken) for (const sentence of sentences(text)) assert.match(sentence, /요[.?!]$/, sentence);
  for (const text of [...Object.values(T.status), ...Object.values(T.tool)]) assert.match(text, /(요|기)$/, text);
  for (const item of figures) assert.match(item.note, /요$/, item.note);
  for (const [path, text] of strings) for (const sentence of sentences(text)) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

test('생각의 이름("안팎 나누기")은 "왜 그럴까?"의 넷째 장에서 처음 말한다. 까닭은 "왜 그럴까?"에서만 말한다', () => {
  const name = /안팎 나누기/;
  for (const [path, text] of strings.filter(([path]) => !path.startsWith('why'))) {
    assert.doesNotMatch(text, name, path);
    assert.doesNotMatch(text, /안쪽|바깥쪽/, path);
  }
  assert.doesNotMatch(visibleText(html), name);
  assert.doesNotMatch(T.why.slice(0, 3).map((slide) => slide.say).join(' '), name);
  assert.match(T.why[3].say, /^선생님은 이렇게 따지는 것을 안팎 나누기라고 불러요\./);
});

test('"왜 그럴까?"는 그림 서너 장의 알아챈 이야기다. 그림 속의 겹친 곳의 수와 주장은 다시 센 것과 같다', () => {
  assert.equal(T.why.length, 4);
  for (const slide of T.why) {
    assert.ok(sentenceCount(slide.say) <= 3, slide.say);
    assert.ok(slide.figures.length >= 1 && slide.figures.length <= 2);
    for (const item of slide.figures) {
      assert.equal(checkBoard({ points: item.points, edges: item.edges, roles: item.roles ?? null, bridges: 0 }), null, item.note);
      assert.equal(crossingsOf(item), item.crossings, item.note);
      // 집과 우물은 집과 우물끼리만 잇는다
      if (item.roles) for (const [a, b] of item.edges) assert.notEqual(item.roles[a], item.roles[b], item.note);
    }
  }
  const k33 = (item) => item.points.length === 6 && item.edges.length === 9 && item.roles.filter((role) => role === 'house').length === 3;
  // 첫 장: 집 셋과 우물 셋을 모두 이은 그림을 두 가지로 옮겨도 겹친 곳이 하나씩 남았다.
  for (const item of T.why[0].figures) {
    assert.ok(k33(item));
    assert.equal(item.crossings, 1);
  }
  assert.notDeepEqual(T.why[0].figures[0].points, T.why[0].figures[1].points);
  // 둘째 장: 굵은 고리는 집과 우물을 번갈아 여섯 점을 모두 지나고, 점선(남은 길) 셋은 모두 고리의 마주 보는 두 점을 잇는다.
  const ring = T.why[1].figures[0];
  assert.ok(k33(ring));
  const order = loopOrder(ring);
  assert.equal(order.length, 6);
  order.forEach((v, at) => assert.notEqual(ring.roles[v], ring.roles[order[(at + 1) % 6]]));
  const chords = ring.off.map((index) => ring.edges[index]);
  assert.equal(chords.length, 3);
  for (const [a, b] of chords) assert.equal(Math.abs(order.indexOf(a) - order.indexOf(b)), 3);
  // 셋째 장: 남은 길 셋은 어느 둘이든 끝이 고리 위에서 번갈아 놓인다(같은 쪽에 그으면 엇갈린다). 쪽은 둘, 길은 셋.
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) assert.ok(alternate(order, chords[i], chords[j]));
  const [inside, outside] = T.why[2].figures;
  assert.equal(inside.crossings, 1);
  assert.equal(outside.crossings, 1);
  assert.equal(Object.keys(inside.bends ?? {}).length, 0, '안쪽의 길은 곧게');
  assert.equal(Object.keys(outside.bends).length, 2, '바깥쪽의 두 길은 굽혀서');
  // 넷째 장: 길이 하나 없으면(집 셋과 우물 셋에서 하나 뺀 그림) 안과 밖에 하나씩 그어 겹친 곳이 없다. 풀이 프로그램도 풀 수 있다고 한다.
  const less = T.why[3].figures[0];
  assert.equal(less.edges.length, 8);
  assert.equal(less.crossings, 0);
  assert.equal(isPlanar(6, less.edges), true);
  assert.equal(isPlanar(6, NAMED.k33.edges), false);
  // 점 다섯을 모두 잇는 그림: 고리 다섯, 남은 선 다섯. 남은 선끼리 엇갈리는 짝은 다섯이고 고리처럼 이어져서, 한 쪽에 겹치지 않게 들어가는 것은 둘까지다.
  const k5 = T.why[3].figures[1];
  assert.equal(k5.edges.length, 10);
  const order5 = loopOrder(k5);
  assert.equal(order5.length, 5);
  const rest = k5.off.map((index) => k5.edges[index]);
  assert.equal(rest.length, 5);
  const fits = (group) => group.every((x, at) => group.slice(at + 1).every((y) => !alternate(order5, x, y)));
  const subsets = (list) => list.reduce((all, item) => [...all, ...all.map((group) => [...group, item])], [[]]);
  assert.equal(Math.max(...subsets(rest).filter(fits).map((group) => group.length)), 2);
  assert.match(T.why[3].say, /안팎에 둘씩만 들어가서 하나가 남아요\.$/);
  // "왜 그럴까?"는 풀 수 없는 그림을 한 번 끝까지 만난 뒤에 열린다(틀의 기본 문).
  assert.equal(tuningFor('untangle').whyAfter, undefined);
});

test('판 고르기의 그림: 단계마다 그 단계의 판과 같은 꼴이다', () => {
  for (const entry of T.levels) {
    const rung = rungOf(entry.level);
    const picture = entry.picture;
    if (rung.mode === 'make') {
      assert.equal(picture.blank, true);
      continue;
    }
    assert.equal(checkBoard({ points: picture.points, edges: picture.edges, roles: picture.roles ?? null, bridges: 0 }), null, entry.name);
    const brute = problemsBrute(picture.points, picture.edges, picture.off ?? []);
    if (rung.mode === 'record') assert.equal(brute.count, 0, '하나를 빼면 겹친 곳이 없다');
    else assert.ok(brute.crossings >= 1, entry.name);
    if (rung.mode === 'story') assert.ok(picture.roles.includes('house') && picture.roles.includes('well'));
  }
  assert.equal(T.levels[2].picture.edges.length, 10, '섞인 판의 그림은 점 다섯을 모두 잇는 그림');
  assert.equal(checkBoard({ ...T.blank, roles: null, bridges: 0 }, { allowEmpty: true }), null);
});

test('직접 만들기: 점을 놓고 이어서 만들면 선생님이 풀 수 있는지 알려 주고, 풀 수 있으면 푼 모습을 그린다', () => {
  const make = part('id="make-untangle"', '<script');
  for (const id of ['untangle-make-count', 'untangle-make-tools', 'untangle-make-clear', 'untangle-make-board', 'untangle-make-solve', 'untangle-make-result', 'untangle-make-picture', 'untangle-make-play']) {
    assert.ok(make.includes(`id="${id}"`), id);
  }
  assert.match(make, /id="untangle-make-solve"[^>]*>선생님, 풀어 보세요</);
  assert.match(make, /id="untangle-make-play"[^>]*>내가 해 볼래요</);
  assert.match(make, /data-tool="draw">놓고 잇기</);
  assert.match(make, /data-tool="erase">점 빼기</);
  assert.match(T.make.intro, /선생님에게 풀어 보라고 할 수도 있어요\.$/);
  assert.match(T.make['keep-not-yet'], /볼까요\?$/);
  // 해 보는 판과 공책에 남기는 판은 만든 그림을 엉키게 놓은 것이다.
  assert.match(code, /const madeBoard = \(\) => \(draft && draft\.edges\.length > 0 \? tangleMade\(draft\.points, draft\.edges\) : null\);/);
  assert.match(code, /\n {4}madeBoard,\n/);
  assert.equal(MAKE_LEVEL, 6);
});

test('index.html: 이 형식의 카드, 판, 판 아래, 도구, 답하는 칸, 직접 만들기가 있다. 틀에 이어져 있다', () => {
  for (const id of [
    'home-untangle-sample',
    'home-untangle-ask',
    'home-untangle-play',
    'home-untangle-pick',
    'home-untangle-make',
    'home-untangle-blank',
    'untangle-board',
    'untangle-count',
    'untangle-status',
    'untangle-left',
    'untangle-loop',
    'untangle-pad',
    'untangle-maybe',
    'untangle-impossible',
    'untangle-bridge-note',
    'untangle-record',
    'untangle-again',
    'untangle-stop',
    'make-untangle',
  ]) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(part('id="untangle-title"', '</section>'), /<h2 id="untangle-title">엉킨 그림 풀기<\/h2>/);
  assert.ok(visibleText(part('id="untangle-title"', '</section>')).includes(T.home.ask.untangle));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-untangle-make" class="menu-item"/);
  assert.match(part('id="untangle-maybe"', 'id="untangle-record"'), /id="untangle-impossible"[^>]*>불가능해요</);
  assert.match(part('id="untangle-loop"', 'id="code-left"'), /id="untangle-loop"[^>]*hidden>고리 하나 보기</);
  assert.equal(T.tool.off, '고리 하나 보기');
  // 틀이 형식을 안다(형식 목록에서 숨은 규칙 찾기 다음).
  assert.match(read('src/main.js'), /rulehunt: createRulehunt\(frame\), untangle: createUntangle\(frame\), /);
  assert.match(read('src/check-main.js'), /\['untangle', '엉킨 그림 풀기'\]/);
  // 켜질 때 앞의 형식이 감춰 둔 무르기와 되돌리기를 보이게 한다(뒤의 켜고 끄기와 숫자 마술이 켜질 때 다시 감춘다).
  assert.match(code, /if \(on\) \{\s*\/\/[^\n]*\n\s*\$\('undo'\)\.hidden = false;\s*\$\('reset'\)\.hidden = false;/);
  // 지난 기록은 틀이 건네주는 것으로 본다. 점은 손가락으로 끈다(pointer 이벤트).
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
  assert.match(read('src/ui/untangle-board.js'), /addEventListener\('pointermove'/);
});

/** 끝까지 한 판의 기록 하나 */
function finished(more = {}) {
  return { kind: 'round', id: `r-${more.id ?? 1}`, format: 'untangle', level: 1, seed: 2, custom: false, mode: 'untangle', outcome: 'solved', hintsOpened: 0, answers: [{ t: 30, answer: 'untangled', correct: true, guess: null }], wrongCount: 0, moveCount: 12, seconds: 50, solution: { possible: true }, ...more };
}

test('수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다. 몇 번 옮겼는지는 보지 않는다', () => {
  const tuning = tuningFor('untangle');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 5);
  assert.equal(tuning.hintCount, 2);
  assert.match(read('src/core/level.js'), /엉킨 그림 풀기\(모두 임시\)/);
  assert.deepEqual(recommend([], 'untangle'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  assert.deepEqual(recommend([finished({ id: 1 }), finished({ id: 2, moveCount: 80 })], 'untangle'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, wrongCount: 1 })], 'untangle').offerHarder, false);
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, seconds: 200 })], 'untangle').offerHarder, false);
  assert.deepEqual(recommend([finished({ id: 1, outcome: 'left' }), finished({ id: 2, outcome: 'left' })], 'untangle'), { level: 1, small: true, offerHarder: false, harderLevel: null, reason: 'quit' });
});

test('틀의 "왜 그럴까?" 문: 이 형식의 풀 수 없는 그림을 한 번 끝까지 만난 뒤에 열린다', () => {
  assert.equal(whyUnlocked([], 'untangle'), false);
  assert.equal(whyUnlocked([finished()], 'untangle'), false, '풀 수 있는 그림만 풀었다');
  assert.equal(whyUnlocked([finished({ level: 3, solution: { possible: false }, answers: [{ answer: 'impossible', correct: true }] })], 'untangle'), true);
  assert.equal(whyUnlocked([finished({ level: 3, solution: { possible: false }, outcome: 'left' })], 'untangle'), false);
  // 기록의 풀이에 풀 수 있는지가 들어간다(가장 적게 빼기는 늘 끝낼 수 있는 판이다).
  assert.match(code, /const answer = \{ possible: solution\.possible, planar: solution\.planar, kind: solution\.core\?\.kind \?\? null \};/);
});
