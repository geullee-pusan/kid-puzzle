// 민들레와 바람 대본 점검: 화면에 나오는 글이 약속을 지키는지, 그림 속의 판과 수와 주장이 풀이 프로그램과 맞는지 본다.
// 이기고 진 횟수를 세어 보여 주지 않는다, 끝났을 때는 누가 이겼는지를 사실로만 말한다, 힌트는 두 높이,
// "왜 그럴까?"는 알아챈 이야기, 화면을 그리는 코드와 틀에 이 형식이 이어져 있는지도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { LADDER, MAKE_LEVEL, TOP_LEVEL, generateBoard, rungOf } from '../src/core/dandelion-ladder.js';
import { replay, solve } from '../src/core/dandelion.js';
import { TUNING, recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { smallerDandelion } from '../src/core/smaller.js';
import { fill, ordinal, sentenceCount } from '../src/core/text.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/dandelion.json'));
const html = read('index.html');
const code = read('src/formats/dandelion.js');

const VALUES = { k: 3, n: 2, no: '첫 ', face: '오른쪽으로' };

/** 대본의 모든 글(값)을 길과 함께 모은다. 설명(_로 시작하는 것)과 그림의 값(판의 꼴, 이기는 쪽의 이름표)은 뺀다. */
function allStrings(value, path = '') {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((item, index) => allStrings(item, `${path}[${index}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .filter(([key]) => !key.startsWith('_') && key !== 'kind' && key !== 'winner' && key !== 'board' && key !== 'trail')
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
const own = [part('id="dandelion-title"', 'id="maze-title"'), part('id="dandelion-count"', 'id="maze-count"'), part('id="dandelion-pad"', 'id="cups-pad"'), part('id="dandelion-swap"', 'id="maze-more"'), part('id="make-dandelion"', 'id="make-maze"')]
  .map(visibleText)
  .join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const figures = T.why.flatMap((slide) => slide.figures);

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 단계 목록이 사다리와 같다', () => {
  assert.equal(T.title, '민들레와 바람');
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.deepEqual(T.levels.map((item) => item.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(T.levels.map((item) => item.name), ['꽃이 되어 두기', '바람이 되어 두기', '고르고 두기', '여덟 방향이 섞인 판', '혼자 덮기', '직접 만들기']);
  assert.equal(T.arrows.length, 8);
  assert.equal(T.ways.length, 8);
});

test('규칙 설명은 세 문장 안이고, 심기·바람·이기는 때를 다 말한다. 직접 만들기의 안내 글도 세 문장 안이다', () => {
  assert.deepEqual(Object.keys(T.rules).sort(), ['cover', 'game']);
  for (const rule of Object.values(T.rules)) assert.ok(sentenceCount(rule) <= 3, rule);
  assert.match(T.rules.game, /빈칸에 꽃을 하나 심으면/);
  assert.match(T.rules.game, /아직 안 분 방향 하나로/);
  assert.match(T.rules.game, /모든 꽃에서 그 방향으로 판 끝까지 씨앗이 날아가요\./);
  assert.match(T.rules.game, /판이 다 덮이면 꽃이 이기고, 방향을 다 쓴 뒤에 빈칸이 남으면 바람이 이겨요\.$/);
  assert.match(T.rules.cover, /정해진 차례로/);
  assert.match(T.rules.cover, /안 심어도 돼요\./);
  assert.match(T.rules.cover, /가장 적게/);
  // 형식이 판의 종류로 규칙 글을 고른다.
  assert.match(code, /ruleLine: \(round\) => T\.rules\[round\.mode\],/);
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 15);
  assert.ok(sentenceCount(guides[11]) <= 3, guides[11]);
  assert.match(guides[11], /바람이 이기는 판도 만들 수 있을까요\?$/);
  // 보기 판: 직접 만들기의 그림과 처음 화면의 그림은 꽃 하나에 바람이 한 번 분 모습이다.
  assert.match(guides[11], /그림은 꽃 하나에 바람이 한 번 분 모습이에요\./);
  assert.match(code, /drawField\(root, \{ \.\.\.viewOf\(board, sampleTrail\(board\)\), small: true \}\);/);
});

test('이 형식의 답: 게임은 "꽃이 될래요 / 바람이 될래요"의 고르기(3, 4단계와 직접 만든 판), 1, 2단계는 단계가 쪽을 정한다', () => {
  const choose = part('id="dandelion-choose"', 'id="dandelion-role"');
  assert.match(choose, /<h2>어느 쪽이 될까요\?<\/h2>/);
  assert.match(choose, /id="dandelion-flower"[^>]*>꽃이 될래요</);
  assert.match(choose, /id="dandelion-wind"[^>]*>바람이 될래요</);
  assert.equal(fill(T.roles.flower, {}), '나는 꽃, 선생님은 바람이에요');
  assert.match(T.play['picked-wind'], /선생님이 먼저 꽃을 심을게요\.$/);
  // 단계가 정해 준 쪽이 아니면 고른다.
  assert.match(code, /const given = mode === 'game' && rung && ROLES\.includes\(rung\.role\) \? rung\.role : null;/);
  // 고른 것이 이기는 쪽이었는지는 기록에만 남고 화면에 알리지 않는다.
  assert.match(code, /const correct = role === solution\.winner;/);
});

test('판이 끝나면 누가 이겼는지를 사실로 말한다. 축하하거나 깎아내리지 않고, 몇 번 이기고 졌는지 세지 않는다', () => {
  for (const key of ['flower-kid', 'flower-teacher', 'wind-kid', 'wind-teacher']) {
    const text = fill(T.right[key], VALUES);
    assert.match(text, key.startsWith('flower') ? /^판이 다 덮였어요\./ : /^빈칸이 2개 남았어요\./, key);
    assert.doesNotMatch(text, /잘했|훌륭|대단|멋져|아쉽|틀렸|실패/, key);
  }
  const all = [...strings.map(([, text]) => text), own].join(' ');
  assert.doesNotMatch(all, /\d+번 이겼|\d+번 졌|이긴 횟수|진 횟수|몇 번째 판/);
  // 연달아 진 수는 자리를 바꿔 보기를 권할 때만 쓰고, 말에 넣지 않는다.
  assert.match(code, /else if \(round\.winner === 'teacher' && lostStreak\(records\) >= SWAP_INVITE_AFTER\) parts\.push\(T\.right\['swap-invite'\]\);/);
  assert.equal(T.right['swap-invite'], '자리를 바꿔서 다시 두어 볼 수도 있어요.');
});

test('선생님이 둔 수는 판 아래의 글과 말로 알린다. 바람의 방향은 낱말로 말한다', () => {
  assert.equal(fill(T.status['teacher-wind'], { face: T.ways[1] }), '선생님이 바람을 오른쪽으로 불었어요');
  assert.equal(fill(T.play['teacher-wind'], { face: T.ways[6] }), '선생님은 바람을 왼쪽 아래로 불었어요.');
  assert.equal(T.status['teacher-plant'], '선생님이 꽃을 심었어요');
  // 바람 단추는 화살표이고, 읽어 주는 이름은 대본의 방향 낱말과 같다.
  const compass = part('id="dandelion-winds"', '</div>');
  const buttons = [...compass.matchAll(/data-dir="(\d)" aria-label="([^"]+)">([^<]+)</g)];
  assert.equal(buttons.length, 8);
  for (const [, dir, label, arrow] of buttons) {
    assert.equal(label, `바람을 ${T.ways[dir]} 불기`);
    assert.equal(arrow, T.arrows[dir]);
  }
  // 칸을 읽어 주는 글
  assert.equal(fill(T.cellLabel, { no: ordinal(1), n: ordinal(3) }), '위에서 첫 번째 줄, 왼쪽에서 3번째 빈칸');
});

test('힌트는 쪽마다 두 개이고, 하나하나가 질문 한 문장이다. 둘째 힌트는 볼 곳만 가리킨다', () => {
  assert.deepEqual(Object.keys(T.hints).sort(), ['choose', 'cover', 'flower', 'wind']);
  for (const [key, list] of Object.entries(T.hints)) {
    assert.equal(list.length, 2, key);
    for (const hint of list) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /요\?$/, hint);
    }
  }
  // 첫째 힌트는 모든 형식이 함께 쓰는 짧은 목록에서 고른다.
  const shared = ['끝에는 어떤 모양이 되어야 하나요?', '끝나기 바로 전에는 어떤 모양일까요?', '더 작은 판이라면 할 수 있을까요?', '끝나기 바로 전에는 어떤 모양이 되어야 하나요?', '더 작은 판이라면 누가 이길까요?'];
  for (const [key, list] of Object.entries(T.hints)) assert.ok(shared.includes(list[0]), `${key}: ${list[0]}`);
  // 까닭(먼저 심은 꽃이 바람을 더 받는다)은 힌트에서 말하지 않는다.
  for (const list of Object.values(T.hints)) for (const hint of list) assert.doesNotMatch(hint, /먼저 심은|힘/);
  // 단계마다 힌트가 있다.
  for (const rung of LADDER) assert.ok(T.hints[rung.hint], rung.level);
});

test('글의 빈칸({이름})은 정해진 이름만 쓰고, 채울 값이 모자라지 않는다', () => {
  const allowed = new Set(['k', 'f', 'n', 'no', 'total', 'level', 'tag', 'face']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
    assert.ok(fill(text, VALUES).length > 0, path);
  }
  assert.equal(fill(T.names.board, { k: 5, n: 3 }), '가로 5칸, 세로 3칸');
  assert.equal(fill(T.notebook.best, { k: 3 }), '꽃 3송이로 덮었어요');
  assert.equal(fill(T.replay['teacher-wind'], { no: ordinal(2), face: T.ways[0] }), '2번째 수예요. 선생님이 바람을 위로 불었어요.');
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
    T.solution.flower,
    T.solution.wind,
    T.solution.cover,
    T.make.intro,
    T.make.flower,
    T.make.wind,
    ...Object.entries(T.replay)
      .filter(([key]) => key !== 'title' && !key.startsWith('note-'))
      .map(([, text]) => text),
    ...T.why.map((slide) => slide.say),
  ];
  for (const text of spoken) for (const sentence of sentences(text)) assert.match(sentence, /요[.?!]$/, sentence);
  for (const text of [...Object.values(T.status), ...Object.values(T.turn), ...Object.values(T.roles), T.notebook.best]) assert.match(text, /요$/, text);
  for (const item of figures) assert.match(item.note, /요$/, item.note);
  for (const [path, text] of strings) for (const sentence of sentences(text)) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

test('생각의 이름("먼저 심은 꽃의 힘")은 "왜 그럴까?"에서만 말한다', () => {
  const name = /먼저 심은 꽃의 힘/;
  const outside = strings.filter(([path]) => !path.startsWith('why')).map(([, text]) => text);
  for (const text of outside) assert.doesNotMatch(text, name);
  assert.doesNotMatch(visibleText(html), name);
  assert.match(T.why[2].say, name);
  // 이름은 그림을 다 본 뒤(셋째 장)에 처음 꺼낸다.
  assert.doesNotMatch(T.why[0].say + T.why[1].say, name);
});

test('"왜 그럴까?"는 그림 서너 장의 알아챈 이야기다. 그림 속의 판과 수와 주장은 풀이 프로그램이 따진 것과 같다', () => {
  assert.equal(T.why.length, 4);
  assert.match(T.why[0].say, /^선생님이 꽃이 되어 4×4 판에서 두다가 졌어요\./);
  for (const item of figures) {
    const now = replay(item.board, item.trail);
    assert.equal(now.ok, true, item.note);
    if (item.winner) assert.equal(now.winner, item.winner, item.note);
    if (item.empty !== undefined) assert.equal(now.empty, item.empty, item.note);
    if (item.flowers !== undefined) assert.equal(now.flowers.length, item.flowers, item.note);
    if (item.reach !== undefined) assert.equal(now.fresh.cells.length, item.reach, item.note);
  }
  // 첫 장: 구석의 첫 꽃에 위로 분 바람은 아무 칸도 덮지 못했다. 끝에는 빈칸이 둘.
  const [corner, lost] = T.why[0].figures;
  assert.deepEqual(corner.trail, [{ plant: 0 }, { wind: 0 }]);
  assert.equal(replay(lost.board, lost.trail).flowers.length, 4, '꽃 넷을 다 심었다');
  // 둘째 장: 꽃마다 받는 바람의 수는 (방향의 수 − 심은 차례 + 1)이다. 첫 꽃은 네 번, 마지막 꽃은 한 번.
  const board = T.why[1].figures[1].board;
  const received = [1, 2, 3, 4].map((order) => 4 - order + 1);
  assert.deepEqual(received, [4, 3, 2, 1]);
  assert.match(T.why[1].say, /첫 꽃은 네 번, 둘째 꽃은 세 번 받아요\./);
  assert.equal(board.dirs, 4);
  // 셋째 장: 앞의 꽃이 있는 줄과 칸 줄을 피해서 다음 꽃을 심었고, 다 덮였다.
  const won = T.why[2].figures[0];
  const flowers = replay(won.board, won.trail).flowers;
  const rows = flowers.map((cell) => Math.floor(cell / won.board.w));
  const cols = flowers.map((cell) => cell % won.board.w);
  assert.equal(new Set(rows).size, flowers.length);
  assert.equal(new Set(cols).size, flowers.length);
  // 넷째 장: 그 까닭이 그대로는 통하지 않는 판(5×3은 바람이 이긴다)과 판마다 이기는 쪽의 표
  for (const row of T.why[3].table) assert.equal(solve({ kind: 'game', w: row.w, h: row.h, dirs: row.dirs }).winner, row.winner, `${row.w}×${row.h}`);
  assert.equal(solve({ kind: 'game', w: 5, h: 3, dirs: 4 }).winner, 'wind');
  // 게임을 두 판 끝까지 둔 뒤에 열린다(src/core/dandelion.js의 whyOpen).
  assert.match(code, /if \(!whyOpen\(frame\.records\(\)\)\) return null;/);
});

test('판 고르기의 그림: 단계마다 그 단계의 판이고, 그림 속의 수는 둘 수 있는 수다', () => {
  for (const entry of T.levels) {
    const rung = rungOf(entry.level);
    if (rung.mode === 'make') {
      assert.equal(entry.picture.blank, true);
      continue;
    }
    const now = replay(entry.picture.board, entry.picture.trail);
    assert.equal(now.ok, true, entry.name);
    assert.equal(entry.picture.board.kind, rung.mode === 'cover' ? 'cover' : 'game');
  }
  assert.equal(T.levels.find((item) => item.level === 4).picture.board.dirs, 8);
});

test('"더 작은 판으로": 사다리의 판마다 같은 방향 수의 작은 판을 낸다(없으면 내지 않는다)', () => {
  for (let level = 1; level <= TOP_LEVEL; level++) {
    for (let seed = 1; seed <= 12; seed++) {
      const { board } = generateBoard(level, seed);
      const small = smallerDandelion({ mode: board.kind === 'cover' ? 'cover' : 'game', board }, 0);
      if (!small) continue;
      assert.ok(small.board.w * small.board.h < board.w * board.h);
      assert.equal(small.board.dirs, board.dirs);
      assert.equal(small.board.kind, board.kind);
      if (board.kind === 'game') assert.equal(solve(small.board).winner, solve(board).winner);
      assert.deepEqual(smallerDandelion({ board }, 0), small, '같은 판, 같은 차례에는 같은 작은 판');
    }
  }
  // 1단계의 3×3에는 작은 판이 있고, 2단계의 5×3(바람이 이기는 가장 작은 판)에는 없다.
  assert.ok(smallerDandelion({ board: { kind: 'game', w: 3, h: 3, dirs: 4 } }, 0));
  assert.equal(smallerDandelion({ board: { kind: 'game', w: 5, h: 3, dirs: 4 } }, 0), null);
  assert.equal(smallerDandelion({ board: null }), null);
});

test('직접 만들기: 가로·세로와 방향의 수를 정하면, 잘 두었을 때 어느 쪽이 이기는지 알려 준다. 여덟 방향은 4칸까지', () => {
  const make = part('id="make-dandelion"', 'id="make-maze"');
  for (const id of ['dandelion-make-w-fewer', 'dandelion-make-w-more', 'dandelion-make-h-fewer', 'dandelion-make-h-more', 'dandelion-make-board', 'dandelion-make-solve', 'dandelion-make-result', 'dandelion-make-play', 'dandelion-make-eight-note']) assert.ok(make.includes(`id="${id}"`), id);
  assert.match(make, /data-dirs="4">네 방향</);
  assert.match(make, /data-dirs="8">여덟 방향</);
  assert.match(make, /id="dandelion-make-solve"[^>]*>선생님, 누가 이길까요\?</);
  assert.match(visibleText(make), /여덟 방향은 가로와 세로가 4칸까지예요\./);
  assert.equal(T.make.flower, T.solution.flower);
  assert.equal(T.make.wind, T.solution.wind);
  // 풀이 프로그램으로 풀고, 공책에 남길 판을 내놓는다.
  assert.match(code, /const result = solve\(board\);/);
  assert.match(code, /\n {4}madeBoard,\n/);
});

test('index.html: 이 형식의 카드, 판, 판 아래, 답하는 칸, 끝난 뒤의 단추, 직접 만들기가 있다. 틀에 이어져 있다', () => {
  for (const id of [
    'home-dandelion-sample',
    'home-dandelion-ask',
    'home-dandelion-play',
    'home-dandelion-pick',
    'home-dandelion-make',
    'home-dandelion-blank',
    'dandelion-board',
    'dandelion-count',
    'dandelion-status',
    'dandelion-flowers',
    'dandelion-empty',
    'dandelion-pad',
    'dandelion-turn-box',
    'dandelion-turn',
    'dandelion-plant-note',
    'dandelion-wind-note',
    'dandelion-cover',
    'dandelion-order',
    'dandelion-blow',
    'dandelion-best',
    'dandelion-again',
    'dandelion-stop',
    'dandelion-swap',
    'dandelion-replay',
    'make-dandelion',
  ]) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(part('id="dandelion-title"', '</section>'), /<h2 id="dandelion-title">민들레와 바람<\/h2>/);
  assert.ok(visibleText(part('id="dandelion-title"', '</section>')).includes(T.home.ask.flower));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-dandelion-make" class="menu-item"/);
  assert.match(part('id="dandelion-cover"', 'id="cups-pad"'), /id="dandelion-blow"[^>]*>바람 불기</);
  assert.match(part('id="after"', '</section>'), /id="dandelion-swap"[^>]*hidden>자리를 바꿔서 다시 두기</);
  assert.match(part('id="after"', '</section>'), /id="dandelion-replay"[^>]*hidden>방금 판 다시 보기</);
  // 진 판 뒤에는 "같은 단계 새 판"보다 위에 놓고 눈에 띄게 한다(누가 이길까와 같다).
  assert.match(code, /\$\(lost \? 'after-same' : 'after-make'\)\.before\(\$\('dandelion-swap'\), \$\('dandelion-replay'\)\);/);
  // 판 아래의 수는 심은 꽃과 남은 빈칸뿐이다(몇 판째, 몇 번 이겼는지는 없다).
  assert.equal([...part('id="dandelion-count"', 'id="maze-count"').matchAll(/<strong/g)].length, 2);
  // 틀이 형식을 안다.
  assert.match(read('src/main.js'), /cups: createCups\(frame\), dandelion: createDandelion\(frame\), /);
  assert.match(read('src/check-main.js'), /\['dandelion', '민들레와 바람'\]/);
  // 지난 기록은 틀이 건네주는 것(작은 판을 뺀 기록)으로 본다.
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
  // 가장 좋은 기록은 혼자 덮기에서만 공책에 남긴다. 적게 심을수록 좋은 기록이다.
  assert.match(code, /bestOf: \(round\) => \(round\.mode !== 'cover' \|\| round\.best === null \? null : \{ value: -round\.best, name: fill\(T\.notebook\.best, \{ k: round\.best \}\) \}\),/);
});

/** 끝까지 둔 게임의 기록 하나 */
function played(more = {}) {
  return {
    kind: 'round',
    id: `r-${Math.random()}`,
    format: 'dandelion',
    level: 3,
    seed: 2,
    custom: false,
    mode: 'game',
    outcome: 'solved',
    hintsOpened: 0,
    answers: [{ t: 3, answer: 'flower', correct: true, guess: null }],
    role: 'flower',
    chose: true,
    assigned: false,
    choseWinner: true,
    winner: 'kid',
    rematch: false,
    moveCount: 4,
    seconds: 80,
    ...more,
  };
}

test('민들레와 바람의 수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다', () => {
  const tuning = tuningFor('dandelion');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 5);
  assert.equal(tuning.hintCount, 2);
  assert.equal(tuning.fastWin, true);
  assert.equal(tuning.fastRetries, 2);
  assert.equal(tuning.whyAfter, 'finished');
  assert.ok(TUNING.formats.dandelion);
  assert.match(read('src/core/level.js'), /민들레와 바람\(모두 임시\)/);
  assert.deepEqual(recommend([], 'dandelion'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
});

test('"한 번에 빠르게": 게임은 이기는 쪽에 서서(골랐거나 단계가 정해 준 쪽) 이긴 판, 혼자 덮기는 다시 해 보기 두 번 안에 가장 적은 꽃 수에 닿은 판이다', () => {
  assert.equal(recommend([played(), played()], 'dandelion').offerHarder, true);
  // 단계가 정해 준 쪽(1, 2단계)도 그쪽이 이기는 쪽이었고 이겼으면 같다.
  const assigned = (more = {}) => played({ level: 1, chose: false, assigned: true, ...more });
  assert.deepEqual(recommend([assigned(), assigned()], 'dandelion'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  // 진 판, 지는 쪽에 선 판, 자리를 바꿔 다시 둔 판, 힌트를 연 판은 아니다.
  assert.equal(recommend([played(), played({ winner: 'teacher' })], 'dandelion').offerHarder, false);
  assert.equal(recommend([played(), played({ choseWinner: false })], 'dandelion').offerHarder, false);
  assert.equal(recommend([played(), played({ chose: false, rematch: true })], 'dandelion').offerHarder, false);
  assert.equal(recommend([played(), played({ hintsOpened: 1 })], 'dandelion').offerHarder, false);
  // 혼자 덮기: 기록에 winner가 없다. 가장 적은 꽃 수에 닿았고, 다시 해 보기가 두 번 안이면 "빠르게"다.
  const cover = (more = {}) => {
    const record = played({ level: 5, mode: 'cover', answers: [{ t: 3, answer: 'flowers:3', correct: true, guess: null }], reachedBest: true, retries: 1, ...more });
    for (const key of ['role', 'chose', 'assigned', 'choseWinner', 'winner']) delete record[key];
    return record;
  };
  assert.deepEqual(recommend([cover(), cover()], 'dandelion'), { level: 5, small: false, offerHarder: true, harderLevel: 6, reason: 'fast' });
  assert.equal(recommend([cover(), cover({ retries: 3 })], 'dandelion').offerHarder, false);
  assert.equal(recommend([cover(), cover({ reachedBest: false })], 'dandelion').offerHarder, false);
  // 끝까지 두고 진 게임은 그만둔 판이 아니라서 내려가지 않는다.
  assert.equal(recommend([played({ winner: 'teacher' }), played({ winner: 'teacher' })], 'dandelion').level, 3);
  // 다른 형식은 그대로다.
  assert.equal(tuningFor('duel').fastRetries, undefined);
  assert.equal(recommend([played(), played()], 'duel').reason, 'start');
});

test('틀의 "왜 그럴까?" 문: 이 형식의 판을 한 번 끝까지 하면 막지 않는다(게임을 두 판 둔 뒤에 여는 것은 이 형식이 본다)', () => {
  assert.equal(whyUnlocked([], 'dandelion'), false);
  assert.equal(whyUnlocked([played({ outcome: 'left', winner: null })], 'dandelion'), false);
  assert.equal(whyUnlocked([played({ winner: 'teacher' })], 'dandelion'), true);
  assert.equal(MAKE_LEVEL, 6);
});
