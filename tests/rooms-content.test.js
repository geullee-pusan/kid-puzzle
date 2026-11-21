// 방 한 번씩 돌기 대본 점검: 화면에 나오는 글이 약속을 지키는지, 그림 속의 길과 색과 주장이 풀이 프로그램과 맞는지 본다.
// 되는 집에 "불가능해요"를 눌러도 틀렸다고 하지 않는다, 몇 번 그었는지 판 아래에 적지 않는다, 힌트는 두 높이,
// "왜 그럴까?"는 알아챈 이야기(번호를 붙이고 색을 켜 보기 → 색이 맞아도 안 되는 집), 안 되는 까닭의 말은 풀이 프로그램이 가린 까닭과 같다,
// "색 켜기"는 도구라서 힌트로 세지 않는다, 화면 코드와 틀에 이 형식이 이어져 있는지도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { LADDER, MAKE_LEVEL, rungOf } from '../src/core/rooms-ladder.js';
import { alternates, checkBoard, checkHouse, colorCheck, colorOf, countPaths, pathDone, pathOk, shapeCheck, solve, solveHouse } from '../src/core/rooms.js';
import { fill, sentenceCount } from '../src/core/text.js';
import { brutePaths, bruteValid } from './helpers/brute-rooms.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/rooms.json'));
const html = read('index.html');
const code = read('src/formats/rooms.js');
const board = read('src/ui/rooms-board.js');

const VALUES = { k: 9, f: '가', n: 16, no: 2, face: T.colors.names[0], total: 12 };
/** 그림의 값은 글이 아니다 */
const DATA_KEYS = ['w', 'h', 'walls', 'start', 'end', 'numbers', 'path', 'left', 'colorOn', 'steps', 'rings', 'counts', 'picture', 'houses', 'picked'];

/** 대본의 모든 글(값)을 길과 함께 모은다. 설명(_로 시작하는 것)과 그림의 값은 뺀다. */
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
  part('id="rooms-title"', 'id="make-title"'),
  part('id="rooms-color"', 'id="tax-costs"'),
  part('id="rooms-board"', 'id="rulehunt-board"'),
  part('id="rooms-count"', 'id="lamps-count"'),
  part('id="rooms-pad"', 'id="lamps-pad"'),
  part('id="make-rooms"', '<script'),
]
  .map(visibleText)
  .join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const figures = T.why.flatMap((slide) => slide.figures);
const house = (item) => ({ kind: 'house', w: item.w, h: item.h, walls: item.walls, start: item.start, end: item.end, numbers: item.numbers ?? [] });

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 단계 목록이 사다리와 같다', () => {
  assert.equal(T.title, '방 한 번씩 돌기');
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.deepEqual(T.levels.map((item) => item.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(T.levels.map((item) => item.name), ['모든 방 한 번씩', '안 되는 집도 섞여요', '수가 적힌 집', '긋지 않고 가려 내기', '정원이 있는 큰 집', '직접 만들기']);
});

test('규칙 설명은 세 문장 안이고, 모든 방을 한 번씩 지나 끝 방까지 가는 것을 말한다. 직접 만들기의 안내 글도 세 문장 안이다', () => {
  assert.deepEqual(Object.keys(T.rules).sort(), ['big', 'draw', 'judge', 'made', 'mix', 'numbers']);
  for (const [key, rule] of Object.entries(T.rules)) {
    assert.ok(sentenceCount(rule) <= 3, rule);
    assert.match(rule, /모든 방을 한 번씩 지나 끝 방/, key);
  }
  // 안 되는 집이 섞이는 판의 규칙만 "불가능해요"를 말한다.
  for (const key of ['mix', 'big', 'made']) assert.match(T.rules[key], /‘불가능해요’를 눌러요\.$/, key);
  for (const key of ['draw', 'numbers', 'judge']) assert.doesNotMatch(T.rules[key], /불가능해요/, key);
  assert.match(T.rules.big, /정원이라 들어갈 수 없어요/);
  assert.match(T.rules.numbers, /길은 하나뿐이에요\.$/);
  assert.match(T.rules.judge, /긋지 않고/);
  // 형식이 판의 종류(직접 만든 판은 made)로 규칙 글을 고른다.
  assert.match(code, /const ruleKey = \(round\) => \(round\.custom \? 'made' : round\.mode\);/);
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 39);
  assert.ok(sentenceCount(guides[16]) <= 3, guides[16]);
  assert.match(guides[16], /아무리 해도 안 되는 집도 만들 수 있을까요\?$/);
});

test('되는 집에 "불가능해요"를 눌러도 틀렸다고 하지 않는다. 길이 있다는 사실과 할 수 있는 일만 말하고 판은 이어진다', () => {
  const said = [...Object.values(T.play), ...Object.values(T.right), ...Object.values(T.status), ...Object.values(T.make)].filter((text) => typeof text === 'string').join(' ');
  assert.doesNotMatch(said, /틀렸|틀린|아니에요|땡|정답|아쉽|실수|실패|성공|잘했|훌륭|대단|최고|멋져|완벽|축하/);
  assert.equal(T.play['possible-press'], '이 집에는 모든 방을 한 번씩 지나 끝 방에 가는 길이 있어요. 더 그어 볼 수 있어요.');
  assert.equal(fill(T.play['possible-press-most'], { n: 13 }), '이 집에는 모든 방을 지나는 길이 있어요. 지금까지 가장 많이 지난 것은 방 13개였어요.');
  // 되는 집에 누른 "불가능해요"는 판을 끝내지 않는다(기록에는 남는다).
  assert.match(code, /const correct = kind === 'done' \|\| solution\.possible === false;/);
  assert.match(code, /if \(correct\) \{\s*frame\.finish\('solved'\);\s*return;\s*\}/);
  assert.match(code, /round\.impossibleCount \+= 1;/);
  // 다 지나면 판이 저절로 끝난다.
  assert.match(code, /if \(pathDone\(board, next\)\) \{\s*submit\('done'\);/);
  // 가려 내기: 되는 집을 골랐으면 그 집에 길이 있다는 사실 하나, 빠뜨렸으면 그 사실 하나만 말한다.
  assert.equal(fill(T.play['judge-possible'], { no: 3 }), '3번 집에는 모든 방을 한 번씩 지나는 길이 있어요. 다시 골라 볼 수 있어요.');
  assert.match(T.play['judge-missed'], /^고르지 않은 집 가운데에도 안 되는 집이 있어요\./);
  // 막혔을 때: 사실 하나와 할 수 있는 일 하나
  assert.match(T.play.stuck, /^방 \{n\}개가 남았는데 더 갈 방이 없어요\. 지나온 방을 누르면/);
  assert.match(T.play['stuck-same'], /^아까와 같은 길에서 막혔어요\./);
  assert.doesNotMatch(code, /Math\.random/);
});

test('판 아래에는 남은 방의 수만 적는다(몇 번 그었는지는 적지 않는다). 색만으로 알리지 않는다', () => {
  const foot = part('id="rooms-count"', 'id="lamps-count"');
  assert.deepEqual([...foot.matchAll(/<strong id="([\w-]+)"/g)].map((match) => match[1]), ['rooms-left']);
  assert.match(visibleText(foot), /남은 방\s+0\s+개/);
  assert.doesNotMatch(visibleText(foot), /그은|번 /);
  for (const line of code.split('\n')) if (/textContent/.test(line)) assert.doesNotMatch(line, /strokeCount|undoCount|impossibleCount|stepCount/, line.trim());
  // 처음 방은 실선 테두리, 끝 방은 점선 테두리(이름도 적는다), 정원은 풀 무늬, 색을 켜면 구석에 모양, 다른 차례는 점선 고리, 짚는 방은 두 겹 고리
  for (const name of ["'rm-grass'", '`rm-${kind}`', 'rm-word rm-word-', "'rm-wrong'", "'rm-ring'", "'rm-ring inner'", 'markShape(ROOM_MARKS']) assert.ok(board.includes(name), name);
  const css = read('src/app.css');
  assert.match(css, /\.rm-end \{[^}]*stroke-dasharray/);
  assert.match(css, /\.rm-judge-card\.picked \{[^}]*dashed/);
  // 색은 조각 덮기의 바둑판 무늬와 같은 색과 모양이다(어디서 봤지?)
  assert.match(css, /\.rm-floor\.rm-color-0 \{\s*fill: #fff3bf;/);
  assert.match(css, /\.rm-floor\.rm-color-1 \{\s*fill: #a5d8ff;/);
  assert.match(read('src/ui/tile-board.js'), /checker: \['circle', 'square'\]/);
  assert.match(board, /export const ROOM_MARKS = \['circle', 'square'\];/);
  assert.deepEqual(T.colors.names, ['동그라미 방', '네모 방']);
});

test('힌트는 판의 종류마다 두 개이고, 하나하나가 질문 한 문장이다', () => {
  assert.deepEqual(Object.keys(T.hints).sort(), ['big', 'draw', 'judge', 'mix', 'numbers']);
  for (const rung of LADDER.filter((item) => item.mode !== 'make')) assert.ok(T.hints[rung.mode], rung.level);
  for (const [key, list] of Object.entries(T.hints)) {
    assert.equal(list.length, 2, key);
    assert.notEqual(list[0], list[1]);
    for (const hint of list) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
      // 까닭을 말해 버리지 않는다
      assert.doesNotMatch(hint, /때문|안 돼요|해야 해요|하면 돼요|같은 색|다른 색/, hint);
    }
  }
  // 기획 문서의 힌트 예: 지나간 방에 번호를 붙여 보기
  assert.match(T.hints.mix[1], /^지나간 방에 1, 2, 3… 번호를 붙이면 홀수 번째 방은 무슨 색인가요\?$/);
  // 직접 만든 집은 섞인 판(안 되는 집도 있다)의 힌트를 쓴다.
  assert.match(code, /const hintKey = \(round\) => \(round\.custom \? 'mix' : round\.mode\);/);
  assert.match(code, /mode: custom \? 'mix' : rungOf\(level\)\.mode,/);
});

test('글의 빈칸({이름})은 정해진 이름만 쓰고, 채울 값이 모자라지 않는다', () => {
  const allowed = new Set(['k', 'f', 'n', 'no', 'total', 'level', 'tag', 'face']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
    assert.ok(fill(text, VALUES).length > 0, path);
  }
  assert.equal(fill(T.cellLabel, { no: '첫 ', n: 3, face: T.cells.start }), '첫 번째 줄 3번째 칸, 처음 방');
  assert.equal(fill(T.colors.left, { face: T.colors.names[1], n: 4 }), '네모 방이 4개 남았어요');
  assert.equal(fill(T.solution.reasons['color-count'], { face: T.colors.names[0], k: 9, n: 7 }), '색을 켜고 세면 동그라미 방이 9개, 다른 색 방이 7개예요. 한 칸 갈 때마다 색이 바뀌니 두 수가 하나보다 더 차이 나면 안 돼요.');
  assert.equal(fill(T.solution.reasons['color-minor'], { n: 25, face: T.colors.names[0] }), '색을 켜면 한 칸 갈 때마다 색이 바뀌어요. 방이 25개면 처음 방과 끝 방이 모두 동그라미 방이어야 하는데, 그렇지 않아요.');
});

test('화면 글에 영어 낱말과 보상 낱말이 없고, "~요"로 끝나는 말투다. 한 문장은 60자를 넘지 않는다', () => {
  for (const [path, text] of strings) assert.doesNotMatch(text.replace(/\{[^{}]*\}/g, ''), /[A-Za-z]/, `${path}: ${text}`);
  assert.doesNotMatch(own, /[A-Za-z]/);
  // 다른 형식의 검사가 처음 화면 파일 전체에서 보는 낱말도 쓰지 않는다(홀짝과 색의 까닭은 대본에만 있다).
  assert.doesNotMatch(own, /것 같아요|부족|모자라|다시 생각|너무 많|지난번|홀수|짝수|홀짝|건너뛰|별|같은 색|다른 색|두 색|색마다|한 색|색칠해서 세기/);
  const spoken = [
    ...Object.values(T.home.ask),
    T.home.pick,
    ...Object.values(T.rules),
    ...Object.values(T.play),
    ...Object.values(T.hints).flat(),
    ...Object.values(T.right),
    T.solution.possible,
    T.solution.numbers,
    T.solution.impossible,
    ...Object.values(T.solution.reasons),
    T.solution.unknown,
    T.solution.judge,
    ...Object.values(T.solution.marks),
    ...Object.values(T.make).filter((text) => !/^\{n\}칸$|^방 \{n\}개$/.test(text)),
    ...T.why.map((slide) => slide.say),
    T.houseLabel.on,
  ];
  for (const text of spoken) for (const sentence of sentences(text)) assert.match(sentence, /요[.?!]?$/, sentence);
  for (const text of [...Object.values(T.status), T.colors.left]) assert.match(text, /요$/, text);
  for (const item of figures) assert.match(item.note, /요$/, item.note);
  for (const [path, text] of strings) for (const sentence of sentences(text)) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

test('까닭(색 세기, 문이 하나뿐인 방, 지나면 나뉘는 방)은 "왜 그럴까?", 풀이, 직접 만들기에서만 말한다. 끝났을 때 하는 말과 판 위의 말에는 없다', () => {
  const reason = /색이 바뀌|같은 색|다른 색|홀수|짝수|문이 하나뿐|나뉘/;
  for (const [path, text] of strings) {
    if (/^(why|solution|make|hints)/.test(path)) continue;
    assert.doesNotMatch(text, reason, `${path}: ${text}`);
  }
  // 풀이 프로그램이 가린 까닭마다 말이 하나씩 있다
  assert.deepEqual(Object.keys(T.solution.reasons).sort(), ['color-count', 'color-minor', 'color-same', 'cut-end', 'cut-room', 'cut-same', 'cut-start', 'deadend', 'search', 'split']);
  assert.match(code, /if \(reason === 'deadend' \|\| reason === 'split' \|\| reason === 'search'\) return T\.solution\.reasons\[reason\];/);
});

test('"왜 그럴까?"는 그림 넷의 알아챈 이야기다. 그림 속의 길, 번호, 색, 방 수와 주장이 풀이 프로그램과 같다', () => {
  assert.equal(T.why.length, 4);
  for (const slide of T.why) {
    assert.ok(sentenceCount(slide.say) <= 3, slide.say);
    assert.ok(slide.figures.length >= 1 && slide.figures.length <= 2);
    for (const item of slide.figures) {
      assert.equal(checkBoard(house(item)), null, item.note);
      if (item.path) assert.equal(pathOk(house(item), item.path), true, item.note);
      if (item.counts) assert.deepEqual(colorCheck(house(item)).counts, item.counts, item.note);
    }
  }
  // 첫 장: 맨 위 왼쪽에서 맨 아래 오른쪽까지(4×4), 두 가지로 그어도 끝 방에 닿을 때 방 하나가 남았다. 이 집은 안 된다.
  const [a, b] = T.why[0].figures;
  for (const item of [a, b]) {
    assert.deepEqual([item.w, item.h, item.start, item.end], [4, 4, 0, 15]);
    assert.equal(item.path.at(-1), 15);
    assert.equal(16 - item.path.length, item.left);
    assert.equal(item.left, 1);
  }
  assert.notDeepEqual(a.path, b.path);
  assert.equal(solveHouse(house(a)).possible, false);
  assert.equal(brutePaths(house(a)).length, 0);
  // 둘째 장: 같은 길에 번호를 붙이고 색을 켜면 홀수 번째는 처음 방의 색(동그라미), 짝수 번째는 다른 색이다
  const numbered = T.why[1].figures[0];
  assert.deepEqual(numbered.path, a.path);
  assert.equal(numbered.colorOn && numbered.steps, true);
  assert.equal(alternates(house(numbered), numbered.path), true);
  assert.equal(colorOf(house(numbered), numbered.start), 0);
  assert.equal(T.colors.names[0], '동그라미 방');
  assert.match(T.why[1].say, /홀수 번째는 모두 동그라미 방, 짝수 번째는 모두 네모 방이었어요\./);
  // 셋째 장: 방이 16개라 16번째(짝수) 방은 네모여야 하는데, 끝 방은 처음 방과 같은 동그라미. 색을 칠해서 세는 것은 조각 덮기에서 본 것이다.
  const counted = T.why[2].figures[0];
  assert.equal(colorCheck(house(counted)).detail, 'same');
  assert.equal(colorOf(house(counted), counted.end), colorOf(house(counted), counted.start));
  assert.deepEqual(counted.rings, [counted.start, counted.end]);
  assert.match(T.why[2].say, /^방이 16개라 마지막 16번째 방은 네모 방이어야 해요\./);
  assert.match(T.why[2].say, /어디서 봤지요\?$/);
  // 넷째 장: 색을 세면 맞는데 문이 하나뿐인 방이 끝 방이 아니라 안 되는 집, 그 방을 끝 방으로 바꾸면 되는 집
  const [stuck, fixed] = T.why[3].figures;
  assert.equal(colorCheck(house(stuck)).ok, true);
  const result = solveHouse(house(stuck));
  assert.equal(result.reason, 'deadend');
  assert.deepEqual(result.detail.cells, stuck.rings);
  assert.equal(brutePaths(house(stuck)).length, 0);
  assert.deepEqual(fixed.walls, stuck.walls);
  assert.equal(fixed.end, stuck.rings[0]);
  assert.equal(pathDone(house(fixed), fixed.path), true);
  assert.equal(bruteValid(house(fixed), fixed.path), true);
  assert.match(T.why[3].say, /^그런데 색이 맞아도 안 되는 집이 있어요\./);
  // "왜 그럴까?"는 안 되는 집을 한 번 끝까지 만난 뒤에 열린다(틀의 기본 문)
  assert.equal(tuningFor('rooms').whyAfter, undefined);
});

test('판 고르기의 그림: 단계마다 그 단계의 판과 같은 꼴이다', () => {
  for (const entry of T.levels) {
    const rung = rungOf(entry.level);
    const picture = entry.picture;
    if (rung.mode === 'make') {
      assert.equal(picture.blank, true);
      continue;
    }
    if (rung.mode === 'judge') {
      const houses = picture.houses.map(house);
      const result = solve({ kind: 'judge', houses });
      assert.deepEqual(result.impossible, picture.picked);
      continue;
    }
    const one = house(picture);
    assert.equal(checkBoard(one), null, entry.name);
    if (picture.path) assert.equal(pathOk(one, picture.path), true);
    if (rung.mode === 'draw') assert.equal(solveHouse(one).possible, true);
    if (rung.mode === 'mix') assert.equal(solveHouse(one).reason, 'color');
    if (rung.mode === 'numbers') assert.equal(countPaths(one), 1);
    if (rung.mode === 'big') {
      assert.equal(colorCheck(one).ok, true);
      assert.equal(solveHouse(one).reason, 'deadend');
    }
  }
  assert.equal(checkHouse({ kind: 'house', numbers: [], ...T.blank }, { open: true }), null);
});

test('직접 만들기: 크기를 정하고 방을 눌러 처음 방, 끝 방, 정원을 정한다. 선생님은 되는지와 까닭을 알려 주고 길이나 까닭의 그림을 보여 준다', () => {
  const make = part('id="make-rooms"', '<script');
  for (const id of ['rooms-make-tools', 'rooms-make-count', 'rooms-make-w', 'rooms-make-h', 'rooms-make-w-fewer', 'rooms-make-w-more', 'rooms-make-h-fewer', 'rooms-make-h-more', 'rooms-make-clear', 'rooms-make-board', 'rooms-make-solve', 'rooms-make-result', 'rooms-make-picture', 'rooms-make-play']) {
    assert.ok(make.includes(`id="${id}"`), id);
  }
  assert.match(make, /id="rooms-make-solve"[^>]*>선생님, 알려 주세요</);
  assert.match(make, /id="rooms-make-play"[^>]*>내가 해 볼래요</);
  assert.match(make, /data-tool="start">처음 방 정하기</);
  assert.match(make, /data-tool="end">끝 방 정하기</);
  assert.match(make, /data-tool="garden">정원 만들기</);
  assert.match(T.make.intro, /선생님에게 물어볼 수 있어요\.$/);
  assert.match(T.make['keep-not-yet'], /볼까요\?$/);
  // 안 되는 집이면 까닭의 말을 붙인다(풀이와 같은 말).
  assert.match(code, /line = `\$\{T\.make\.impossible\} \$\{reasonLine\(board, result\)\}`;/);
  // 공책에 남기는 판은 처음 방과 끝 방을 정한 집이다.
  assert.match(code, /const madeBoard = \(\) => \(draftReady\(\) \? draftBoard\(\) : null\);/);
  assert.match(code, /\n {4}madeBoard,\n/);
  assert.equal(MAKE_LEVEL, 6);
});

test('index.html: 이 형식의 카드, 판, 판 아래, 도구, 답하는 칸, 직접 만들기가 있다. 틀에 이어져 있다', () => {
  for (const id of ['home-rooms-sample', 'home-rooms-ask', 'home-rooms-play', 'home-rooms-pick', 'home-rooms-make', 'home-rooms-blank', 'rooms-board', 'rooms-count', 'rooms-status', 'rooms-left', 'rooms-left-line', 'rooms-color', 'rooms-colors', 'rooms-pad', 'rooms-draw-box', 'rooms-maybe', 'rooms-impossible', 'rooms-judge-box', 'rooms-judged', 'make-rooms']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(part('id="rooms-title"', '</section>'), /<h2 id="rooms-title">방 한 번씩 돌기<\/h2>/);
  assert.ok(visibleText(part('id="rooms-title"', '</section>')).includes(T.home.ask.draw));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-rooms-make" class="menu-item"/);
  assert.match(part('id="rooms-maybe"', 'id="rooms-judge-box"'), /id="rooms-impossible"[^>]*>불가능해요</);
  assert.match(part('id="rooms-judge-box"', 'id="lamps-pad"'), /id="rooms-judged"[^>]*>다 골랐어요</);
  assert.match(part('id="rooms-color"', 'id="rooms-colors"'), /id="rooms-color"[^>]*hidden>색 켜기</);
  assert.equal(T.tool.off, '색 켜기');
  // 틀이 형식을 안다(형식 목록에서 켜고 끄기와 숫자 마술 다음).
  assert.match(read('src/main.js'), /lamps: createLamps\(frame\), rooms: createRooms\(frame\), /);
  assert.match(read('src/check-main.js'), /\['rooms', '방 한 번씩 돌기'\]/);
  // 켜질 때 앞의 형식(켜고 끄기와 숫자 마술 등)이 감춰 둔 무르기와 되돌리기를 보이게 한다.
  assert.match(code, /if \(on\) \{\s*\/\/[^\n]*\n\s*\$\('undo'\)\.hidden = false;\s*\$\('reset'\)\.hidden = false;/);
  // 지난 기록은 틀이 건네주는 것으로 본다. 방은 손가락으로 따라 긋는다(pointer 이벤트).
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
  assert.match(board, /addEventListener\('pointermove'/);
  // "색 켜기"는 도구다: 힌트로 세지 않는다(기록에 따로 적는다)
  assert.doesNotMatch(code, /hintsOpened/);
  assert.match(code, /colorShown: round\.colorShown,/);
});

/** 끝까지 한 판의 기록 하나 */
function finished(more = {}) {
  return { kind: 'round', id: `r-${more.id ?? 1}`, format: 'rooms', level: 2, seed: 3, custom: false, mode: 'mix', outcome: 'solved', hintsOpened: 0, answers: [{ t: 30, answer: 'done', correct: true, guess: null }], wrongCount: 0, strokeCount: 12, seconds: 50, solution: { possible: true }, ...more };
}

test('수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 2단계다. 몇 번 그었는지는 보지 않는다', () => {
  const tuning = tuningFor('rooms');
  assert.equal(tuning.startLevel, 2);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 5);
  assert.equal(tuning.hintCount, 2);
  assert.match(read('src/core/level.js'), /방 한 번씩 돌기\(모두 임시\)/);
  assert.deepEqual(recommend([], 'rooms'), { level: 2, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  assert.deepEqual(recommend([finished({ id: 1 }), finished({ id: 2, strokeCount: 90 })], 'rooms'), { level: 2, small: false, offerHarder: true, harderLevel: 3, reason: 'fast' });
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, wrongCount: 1 })], 'rooms').offerHarder, false);
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, seconds: 200 })], 'rooms').offerHarder, false);
  assert.deepEqual(recommend([finished({ id: 1, outcome: 'left' }), finished({ id: 2, outcome: 'left' })], 'rooms'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'quit' });
});

test('틀의 "왜 그럴까?" 문: 이 형식의 안 되는 집(가려 내기는 안 되는 집이 섞인 판)을 한 번 끝까지 만난 뒤에 열린다', () => {
  assert.equal(whyUnlocked([], 'rooms'), false);
  assert.equal(whyUnlocked([finished()], 'rooms'), false, '되는 집만 했다');
  assert.equal(whyUnlocked([finished({ solution: { possible: false }, answers: [{ answer: 'impossible', correct: true }] })], 'rooms'), true);
  assert.equal(whyUnlocked([finished({ solution: { possible: false }, outcome: 'left' })], 'rooms'), false);
  assert.equal(whyUnlocked([finished({ level: 4, mode: 'judge', solution: { possible: false, impossible: [1, 2] } })], 'rooms'), true);
  // 가려 내기의 풀이에 "모든 집이 되는가"가 들어간다
  const judge = solve({ kind: 'judge', houses: [{ kind: 'house', w: 3, h: 3, walls: [], start: 0, end: 8, numbers: [] }, { kind: 'house', w: 3, h: 3, walls: [], start: 0, end: 1, numbers: [] }] });
  assert.equal(judge.possible, false);
  assert.match(code, /const answer = judge \? \{ possible: solution\.possible, impossible: solution\.impossible/);
  // 생김새로 안 되는 집도 보이게 쓰인다: 큰 집의 그림
  assert.equal(shapeCheck(house(T.levels[4].picture)).reason, 'deadend');
});
