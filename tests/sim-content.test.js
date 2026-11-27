// 세모 피하기 대본 점검: 화면에 나오는 글이 약속을 지키는지, 그림 속의 판과 주장이 풀이 프로그램과 맞는지 본다.
// 이기고 진 횟수를 세어 보여 주지 않는다, 끝났을 때는 어떤 세모가 생겼고 누가 이겼는지를 사실로만 말한다, 힌트는 두 높이,
// "왜 그럴까?"는 알아챈 이야기, 화면을 그리는 코드와 틀에 이 형식이 이어져 있는지도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { LADDER, MAKE_LEVEL, rungOf } from '../src/core/sim-ladder.js';
import { checkBoard, lineOf, paintState, solvePaint } from '../src/core/sim.js';
import { TUNING, recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { fill, ordinal, sentenceCount } from '../src/core/text.js';
import { triangleCount } from './helpers/brute-sim.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/sim.json'));
const html = read('index.html');
const code = read('src/formats/sim.js');

const VALUES = { k: 3, n: 2, no: '첫 ', face: '빨강' };

/** 대본의 모든 글(값)을 길과 함께 모은다. 설명(_로 시작하는 것)과 그림의 값(점의 수, 선, 고리)은 뺀다. */
function allStrings(value, path = '') {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((item, index) => allStrings(item, `${path}[${index}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .filter(([key]) => !key.startsWith('_') && !['n', 'kind', 'red', 'blue', 'gone', 'ring', 'blank'].includes(key))
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
const own = [part('id="sim-title"', 'id="matches-title"'), part('id="sim-count"', 'id="matches-count"'), part('id="sim-pad"', 'id="matches-pad"'), part('id="sim-swap"', '</section>'), part('id="make-sim"', 'id="make-matches"')]
  .map(visibleText)
  .join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const figures = T.why.flatMap((slide) => slide.figures);

/** 그림의 값(두 점씩 적은 선)을 판으로 */
function boardOf(item) {
  const lines = (pairs = []) => pairs.map(([a, b]) => lineOf(item.n, a, b)).sort((x, y) => x - y);
  return { kind: item.kind ?? 'paint', n: item.n, gone: lines(item.gone), red: lines(item.red), blue: lines(item.blue) };
}

/** 그림 속 선을 점 사이의 표로(세모 세기에 쓴다) */
function tableOf(item) {
  const colors = Array.from({ length: item.n }, () => Array(item.n).fill(0));
  for (const [key, value] of [['red', 1], ['blue', 2]]) {
    for (const [a, b] of item[key] ?? []) {
      colors[a][b] = value;
      colors[b][a] = value;
    }
  }
  return colors;
}

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 단계 목록이 사다리와 같다', () => {
  assert.equal(T.title, '세모 피하기');
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.deepEqual(T.levels.map((item) => item.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(T.levels.map((item) => item.name), ['다섯 점에서 두기', '세모 없이 다 칠하기', '먼저 둘까 나중에 둘까', '잘 두는 선생님', '여섯 점을 다 칠하기', '직접 만들기']);
  assert.deepEqual(T.colors, { red: '빨강', blue: '파랑' });
});

test('규칙 설명은 세 문장 안이고, 색과 선의 모양·지는 때를 말한다. 칠하기는 안 된다고 답할 수 있다고 말한다. 직접 만들기의 안내 글도 세 문장 안이다', () => {
  assert.deepEqual(Object.keys(T.rules), ['game', 'paint', 'paint-gone']);
  for (const text of Object.values(T.rules)) assert.ok(sentenceCount(text) <= 3, text);
  assert.match(T.rules.game, /내 선은 빨간 실선, 선생님 선은 파란 점선이에요\./);
  assert.match(T.rules.game, /점 세 개를 모두 자기 색 선으로 이은 세모를 만든 쪽이 져요\.$/);
  for (const key of ['paint', 'paint-gone']) {
    assert.match(T.rules[key], /점 세 개를 한 색 선으로 모두 이은 세모는 없어야 해요\./);
    assert.match(T.rules[key], /안 된다고 답해요\.$/);
  }
  assert.match(T.rules['paint-gone'], /^가위표가 있는 두 점 사이에는 선이 없어요\./);
  assert.match(code, /ruleLine: \(round\) => T\.rules\[round\.mode === 'game' \? 'game' : round\.board\.gone\.length > 0 \? 'paint-gone' : 'paint'\],/);
  // 선이 가운데에서 엇갈린 곳은 세모가 아니라고 판 옆에 적어 둔다.
  assert.match(visibleText(part('id="sim-pad"', 'id="matches-pad"')), /선이 가운데에서 엇갈린 곳은 점이 아니라서 세모가 되지 않아요\./);
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 54);
  assert.ok(sentenceCount(guides[31]) <= 3, guides[31]);
  assert.match(guides[31], /^두 점을 차례로 누를 때마다 그 선이 빨강, 파랑, 없음으로 바뀌어요\./);
  // 이 물음의 답(그런 판이 있다)은 tests/sim.test.js가 다른 방법으로 찾는다.
  assert.match(guides[31], /다섯 점에서 먼저 긋는 쪽이 이기는 판도 만들 수 있을까요\?$/);
});

test('이 형식의 답: 고르는 판은 먼저 그을지 고른다. 1단계는 아이가 먼저 긋는다. 칠하기는 "세모 없이는 안 돼요"로 답한다', () => {
  const order = part('id="sim-order"', 'id="sim-order-line"');
  assert.match(order, /<h2>먼저 그을까요\?<\/h2>/);
  assert.match(order, /id="sim-first"[^>]*>먼저 그을래요</);
  assert.match(order, /id="sim-second"[^>]*>나중에 그을래요</);
  assert.equal(T.orders.second, '선생님이 먼저 그어요');
  // 고른 것이 지지 않는 자리였는지는 기록에만 남고 화면에 알리지 않는다.
  assert.match(code, /const correct = seatOutcome\(solution, order\) !== 'lose';/);
  // 자리를 바꾸면 차례를 바꾼다(아이는 늘 빨강).
  assert.match(code, /const next = \{ order: round\.order === 'first' \? 'second' : 'first', rematchOf: round\.id \};/);
  assert.match(part('id="sim-paint-box"', 'id="matches-pad"'), /id="sim-impossible"[^>]*>세모 없이는 안 돼요</);
  assert.match(part('id="sim-paint-box"', 'id="matches-pad"'), /id="sim-pen-red"[^>]*aria-pressed="true">빨간 실선</);
  assert.match(part('id="sim-paint-box"', 'id="matches-pad"'), /id="sim-pen-blue"[^>]*aria-pressed="false">파란 점선</);
  assert.match(T.right['after-press'], /‘세모 없이는 안 돼요’/);
  // 되는 판에 "세모 없이는 안 돼요"를 누르면 틀렸다고 하지 않고 사실과 할 수 있는 일을 말한다.
  assert.equal(T.play['possible-press'], '이 판은 세모 없이 다 칠하는 방법이 있어요. 더 칠해 볼 수 있어요.');
});

test('판이 끝나면 어떤 세모가 생겼고 누가 이겼는지(또는 비겼는지)를 사실로 말한다. 축하하거나 깎아내리지 않고, 몇 번 이기고 졌는지 세지 않는다', () => {
  assert.equal(T.right.kid, '파란 세모가 생겼어요. 이번 판은 내가 이겼어요.');
  assert.equal(T.right.teacher, '빨간 세모가 생겼어요. 이번 판은 선생님이 이겼어요.');
  assert.equal(T.right.draw, '세모 없이 모든 선을 그었어요. 이번 판은 비겼어요.');
  for (const text of [T.right.kid, T.right.teacher, T.right.draw, T.play['tri-red'], T.play['tri-blue'], T.play.full]) assert.doesNotMatch(text, /잘했|훌륭|대단|멋져|아쉽|틀렸|실패|조심/);
  const all = [...strings.map(([, text]) => text), own].join(' ');
  assert.doesNotMatch(all, /\d+번 이겼|\d+번 졌|이긴 횟수|진 횟수|몇 번째 판/);
  assert.match(code, /else if \(round\.winner === 'teacher' && lostStreak\(records\) >= SWAP_INVITE_AFTER\) parts\.push\(T\.right\['swap-invite'\]\);/);
  // "그러면 이건?": 다섯 점에서 비기거나 다 칠했으면 여섯 점을 묻는다.
  assert.equal(T.right['six-game'], '점이 여섯이면 비길 수 있을까요?');
  assert.equal(T.right['six-paint'], '점이 여섯이면 세모 없이 다 칠할 수 있을까요?');
  assert.equal(fill(T.right.painted, { n: 10 }), '한 색 세모 없이 선 10개를 모두 칠했어요.');
  assert.equal(fill(T.right['impossible-tried'], { n: 7 }), '맞아요. 이 판은 어떻게 칠해도 한 색 세모가 생겨요. 선을 7번 칠해 보고 알아냈어요.');
  // 판 아래의 수는 그은 선과 남은 선뿐이다.
  assert.equal([...part('id="sim-count"', 'id="matches-count"').matchAll(/<strong/g)].length, 2);
});

test('선을 긋는 법: 두 점을 차례로 누르거나 끈다. 벌써 이어진 두 점, 없는 선, 처음부터 칠해 둔 선은 그 사실을 판 아래에 적는다', () => {
  assert.match(visibleText(part('id="sim-turn-box"', 'id="sim-paint-box"')), /두 점을 차례로 누르거나 한 점에서 다른 점으로 끌면 빨간 선이 그어져요\./);
  assert.equal(T.status.taken, '두 점은 벌써 이어져 있어요');
  assert.equal(T.status.gone, '그 두 점 사이에는 선이 없어요');
  assert.equal(T.status.given, '처음부터 칠해 둔 선은 바꿀 수 없어요');
  assert.match(code, /flash = T\.status\.taken;/);
  assert.match(code, /flash = board\.gone\.includes\(line\) \? T\.status\.gone : T\.status\.given;/);
  assert.equal(fill(T.pointLabel, { no: ordinal(1) }), '첫 번째 점');
  // 판은 pointer 이벤트로 끌기와 누르기를 받는다.
  const board = read('src/ui/sim-board.js');
  assert.match(board, /addEventListener\('pointerdown'/);
  assert.match(board, /addEventListener\('pointermove'/);
  assert.match(board, /view\.onPair\?\.\(\[press\.from, end\]\)/);
  // 색만으로 알리지 않는다: 파란 선은 점선이다.
  assert.match(read('src/app.css'), /\.sim-line\.blue \{[^}]*stroke-dasharray/);
});

test('무르기와 처음으로 뒤에는 앞의 말을 짧은 사실로 덮는다. 칠하기에서 세모가 생기거나 없어지면 그 사실만 말한다', () => {
  assert.equal(T.play.undo, '한 번 물렀어요.');
  assert.equal(T.play.reset, '처음 모습으로 돌아왔어요.');
  assert.match(code, /frame\.say\(T\.play\.undo\);/);
  assert.match(code, /frame\.say\(T\.play\.reset\);/);
  assert.match(code, /else if \(before\.triangles\.length > 0 && after\.triangles\.length === 0\) frame\.say\(T\.play\['tri-gone'\]\);/);
  // 무르기와 처음으로는 칠하기 판에만 있다.
  assert.match(code, /\$\('undo'\)\.hidden = !isPaint\(round\);/);
});

test('힌트는 단계마다 두 개이고, 하나하나가 질문 한 문장이다. 힌트 1은 함께 쓰는 목록에서 고른다. 까닭은 힌트에 없다', () => {
  assert.deepEqual(Object.keys(T.hints).sort(), ['choose', 'five', 'paint', 'six']);
  for (const [key, list] of Object.entries(T.hints)) {
    assert.equal(list.length, 2, key);
    for (const hint of list) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /요\?$/, hint);
      assert.doesNotMatch(hint, /셋은 같은 색|적어도 세|한 점에서 보기/);
    }
  }
  const shared = ['끝에는 어떤 모양이 되어야 하나요?', '끝나기 바로 전에는 어떤 모양일까요?', '더 작은 판이라면 할 수 있을까요?', '더 작은 판이라면 누가 이길까요?'];
  for (const [key, list] of Object.entries(T.hints)) assert.ok(shared.includes(list[0]), `${key}: ${list[0]}`);
  for (const rung of LADDER) assert.ok(T.hints[rung.hint], rung.level);
  assert.match(code, /hints: \(round\) => T\.hints\[round\.custom \? 'choose' : rungOf\(round\.level\)\.hint\],/);
});

test('글의 빈칸({이름})은 정해진 이름만 쓰고, 채울 값이 모자라지 않는다', () => {
  const allowed = new Set(['k', 'f', 'n', 'no', 'total', 'level', 'tag', 'face']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
    assert.ok(fill(text, VALUES).length > 0, path);
  }
  assert.equal(fill(T.status.pen, { face: T.pens.blue }), '파란 점선으로 칠할 차례예요');
  assert.deepEqual(T.pens, { red: '빨간 실선', blue: '파란 점선' });
  assert.equal(fill(T.status.triangles, { n: 2 }), '한 색 세모가 2개 있어요');
  assert.equal(fill(T.replay.teacher, { no: ordinal(2) }), '2번째 수예요. 선생님이 파란 선을 그었어요.');
});

test('화면 글에 영어 낱말이 없고, "~요"로 끝나는 말투다. 한 문장은 60자를 넘지 않는다. 쓰지 않는 낱말이 없다', () => {
  for (const [path, text] of strings) assert.doesNotMatch(text.replace(/\{[^{}]*\}/g, ''), /[A-Za-z]/, `${path}: ${text}`);
  assert.doesNotMatch(own, /[A-Za-z]/);
  assert.doesNotMatch([own, ...strings.map(([, text]) => text)].join(' '), /별|점수|순위|레벨|연속|잘했|틀렸/);
  const spoken = [
    ...Object.values(T.home.ask),
    T.home.pick,
    ...Object.values(T.rules),
    ...Object.values(T.play),
    ...Object.values(T.hints).flat(),
    ...Object.values(T.right),
    T.solution.draw,
    T.solution.first,
    T.solution.second,
    T.solution.painted,
    T.solution.given,
    T.solution.many,
    T.make.intro,
    T.make.lead,
    ...Object.values(T.make.starts),
    T.make.triangle,
    T.make.full,
    T.make['keep-not-yet'],
    ...Object.entries(T.replay)
      .filter(([key]) => key !== 'title' && !key.startsWith('note-'))
      .map(([, text]) => text),
    ...T.why.map((slide) => slide.say),
  ];
  for (const text of spoken) for (const sentence of sentences(text)) assert.match(sentence, /요[.?!]$/, sentence);
  for (const text of [...Object.values(T.status), ...Object.values(T.turn), ...Object.values(T.orders)]) assert.match(text, /요$/, text);
  for (const item of figures) assert.match(item.note, /요$/, item.note);
  for (const [path, text] of strings) for (const sentence of sentences(text)) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

test('생각의 이름("한 점에서 보기")은 "왜 그럴까?"에서만, 까닭을 다 본 뒤에 처음 말한다', () => {
  const name = /한 점에서 보기/;
  const outside = strings.filter(([path]) => !path.startsWith('why')).map(([, text]) => text);
  for (const text of outside) assert.doesNotMatch(text, name);
  assert.doesNotMatch(visibleText(html), name);
  for (const slide of T.why.slice(0, 3)) assert.doesNotMatch(slide.say, name);
  assert.match(T.why[3].say, /^선생님은 이것을 한 점에서 보기라고 불러요\./);
});

test('"왜 그럴까?"는 그림 네 장의 알아챈 이야기다. 그림 속의 선과 세모는 풀이 프로그램이 따진 것과 같다', () => {
  assert.equal(T.why.length, 4);
  assert.match(T.why[0].say, /^선생님이 여섯 점의 선을 혼자 다 칠해 보았어요\./);
  for (const item of figures) {
    const board = boardOf(item);
    // 그림의 선은 판에 있는 선이고 겹치지 않는다.
    assert.ok([...board.red, ...board.blue].every((line) => line >= 0), item.note);
    assert.equal(new Set([...board.red, ...board.blue]).size, board.red.length + board.blue.length, item.note);
  }
  // 첫 장: 여섯 점의 선 열다섯을 다 칠했고, 한 색 세모가 있다(두 개. 여섯 점은 다 칠하면 늘 둘 이상이다).
  const [full] = T.why[0].figures;
  assert.equal(full.red.length + full.blue.length, 15);
  assert.equal(triangleCount(tableOf(full)), 2);
  assert.equal(solvePaint({ kind: 'paint', n: 6, gone: [], red: [], blue: [] }).possible, false);
  // 둘째 장: 고리를 두른 점에서 나가는 선 다섯, 빨강 셋과 파랑 둘이다.
  const [spoke] = T.why[1].figures;
  assert.deepEqual(spoke.ring, [0]);
  assert.deepEqual([spoke.red.length, spoke.blue.length], [3, 2]);
  for (const [a] of [...spoke.red, ...spoke.blue]) assert.equal(a, 0);
  // 셋째 장: 빨간 선 셋의 끝 세 점(고리) 사이에 빨간 선이 하나 있으면 빨간 세모, 셋 다 파랑이면 파란 세모다.
  const ends = spoke.red.map(([, b]) => b);
  const [oneRed, allBlue] = T.why[2].figures;
  for (const item of [oneRed, allBlue]) assert.deepEqual(item.ring, ends);
  const stateOf = (item) => paintState(boardOf(item), []);
  assert.deepEqual(stateOf(oneRed).triangles.map((item) => item.color), ['red']);
  assert.deepEqual(stateOf(allBlue).triangles, [{ points: ends, color: 'blue' }]);
  // 넷째 장: 다섯 점은 한 점에서 선이 넷이라 둘씩 나눌 수 있고, 세모 없이 다 칠한 그림이다.
  const [five] = T.why[3].figures;
  const fiveState = stateOf(five);
  assert.equal(fiveState.left, 0);
  assert.deepEqual(fiveState.triangles, []);
  for (let point = 0; point < 5; point++) {
    const reds = five.red.filter(([a, b]) => a === point || b === point).length;
    assert.equal(reds, 2);
  }
  // 점이 여섯인 판을 한 번 끝까지 한 뒤에 열린다(src/core/sim.js의 whyOpen).
  assert.match(code, /if \(!whyOpen\(frame\.records\(\)\)\) return null;/);
});

test('판 고르기의 그림: 단계마다 그 단계의 점 수이고, 그림 속에 한 색 세모가 없다', () => {
  for (const entry of T.levels) {
    const rung = rungOf(entry.level);
    if (rung.mode === 'make') {
      assert.equal(entry.picture.blank, true);
      continue;
    }
    assert.equal(entry.picture.n, rung.n, entry.name);
    assert.equal(entry.picture.kind, rung.mode, entry.name);
    assert.equal(checkBoard(boardOf(entry.picture)), null, entry.name);
  }
});

test('풀이와 직접 만들기의 글: 게임은 둘 다 잘 두면 어떻게 끝나는지, 칠하기는 한 가지 칠하기와 가짓수, 안 되는 판은 볼 수 있는 까닭을 말한다', () => {
  assert.equal(T.solution.second, '이 판은 둘 다 잘 두면 나중에 긋는 쪽이 이겨요.');
  assert.equal(fill(T.solution.painted, { n: 12 }), '이렇게 칠하면 한 색 세모가 없어요. 이런 방법이 모두 12가지예요.');
  assert.match(T.solution.given, /^이 점에서 같은 색 선이 셋 나가요\./);
  assert.match(T.solution.many, /^이 점에서 나가는 선 다섯 가운데 셋은 같은 색이에요\./);
  assert.deepEqual(Object.keys(T.make.starts).sort(), ['blue-blue', 'blue-draw', 'blue-red', 'red-blue', 'red-draw', 'red-red']);
  const make = part('id="make-sim"', 'id="make-matches"');
  for (const id of ['sim-make-fewer', 'sim-make-n', 'sim-make-more', 'sim-make-lines', 'sim-make-clear', 'sim-make-board', 'sim-make-solve', 'sim-make-result', 'sim-make-play']) assert.ok(make.includes(`id="${id}"`), id);
  assert.match(make, /id="sim-make-solve"[^>]*>선생님, 어떻게 끝나요\?</);
  assert.match(make, /id="sim-make-clear"[^>]*>선 모두 지우기</);
  assert.match(code, /const result = solveGame\(board\);/);
  assert.match(code, /\n {4}madeBoard,\n/);
  // 한 색 세모가 없고 그을 선이 남아 있어야 두어 보고 공책에 남길 수 있다.
  assert.match(code, /return checkBoard\(draft\) === null \? copyBoard\(draft\) : null;/);
});

test('index.html: 이 형식의 카드, 판, 판 아래, 답하는 칸, 끝난 뒤의 단추, 직접 만들기가 있다. 틀에 이어져 있다', () => {
  for (const id of ['home-sim-sample', 'home-sim-ask', 'home-sim-play', 'home-sim-pick', 'home-sim-make', 'home-sim-blank', 'sim-board', 'sim-count', 'sim-status', 'sim-drawn', 'sim-left', 'sim-pad', 'sim-game-box', 'sim-paint-box', 'sim-turn-box', 'sim-turn', 'sim-swap', 'sim-replay', 'make-sim']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(part('id="sim-title"', '</section>'), /<h2 id="sim-title">세모 피하기<\/h2>/);
  assert.ok(visibleText(part('id="sim-title"', '</section>')).includes(T.home.ask.five));
  // 카드는 곱 단서 퍼즐 다음, 퍼즐 만들기 앞이다.
  assert.ok(html.indexOf('id="product-title"') < html.indexOf('id="sim-title"'));
  assert.ok(html.indexOf('id="sim-title"') < html.indexOf('id="make-title"'));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-sim-make" class="menu-item"/);
  assert.match(part('id="after"', '</section>'), /id="sim-swap"[^>]*hidden>자리를 바꿔서 다시 두기</);
  assert.match(part('id="after"', '</section>'), /id="sim-replay"[^>]*hidden>방금 판 다시 보기</);
  assert.match(code, /\$\(lost \? 'after-same' : 'after-make'\)\.before\(\$\('sim-swap'\), \$\('sim-replay'\)\);/);
  // 틀이 형식을 안다(곱 단서 퍼즐 다음)
  assert.match(read('src/main.js'), /product: createProduct\(frame\), sim: createSim\(frame\), /);
  assert.match(read('src/check-main.js'), /\['sim', '세모 피하기'\]/);
  assert.match(read('src/core/smaller.js'), /product: smallerProduct, sim: smallerSim, /);
  assert.match(code, /smaller: \(round, turn\) => smallerSim\(\{ mode: round\.mode, board: round\.board \}, turn\),/);
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
  // 게임과 칠하기라 가장 좋은 기록은 없다.
  assert.doesNotMatch(code, /bestOf/);
});

/** 끝까지 둔 게임의 기록 하나 */
function played(more = {}) {
  return {
    kind: 'round',
    id: `r-${Math.random()}`,
    format: 'sim',
    level: 3,
    seed: 2,
    custom: false,
    mode: 'game',
    board: { kind: 'game', n: 6, gone: [], red: [], blue: [] },
    outcome: 'solved',
    hintsOpened: 0,
    answers: [{ t: 3, answer: 'second', correct: true, guess: null }],
    order: 'second',
    chose: true,
    assigned: false,
    choseWinner: true,
    winner: 'kid',
    rematch: false,
    moveCount: 6,
    seconds: 80,
    ...more,
  };
}

/** 끝낸 칠하기 판의 기록 하나 */
function painted(more = {}) {
  return {
    kind: 'round',
    id: `r-${Math.random()}`,
    format: 'sim',
    level: 2,
    seed: 2,
    custom: false,
    mode: 'paint',
    board: { kind: 'paint', n: 5, gone: [], red: [], blue: [] },
    outcome: 'solved',
    hintsOpened: 0,
    answers: [{ t: 30, answer: 'painted', correct: true, guess: null }],
    wrongCount: 0,
    placeCount: 12,
    seconds: 90,
    ...more,
  };
}

test('세모 피하기의 수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다', () => {
  const tuning = tuningFor('sim');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 5);
  assert.equal(tuning.hintCount, 2);
  assert.equal(tuning.fastWin, true);
  assert.equal(tuning.fastSolo, true);
  assert.equal(tuning.whyAfter, 'finished');
  assert.ok(TUNING.formats.sim);
  assert.match(read('src/core/level.js'), /세모 피하기\(모두 임시\)/);
  assert.deepEqual(recommend([], 'sim'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
});

test('"한 번에 빠르게": 게임은 지지 않는 자리에 서서 이긴 판, 칠하기는 틀린 답 없이 예상 시간보다 빨리 끝낸 판이다', () => {
  assert.equal(recommend([played(), played()], 'sim').offerHarder, true);
  const assigned = (more = {}) => played({ level: 1, chose: false, assigned: true, board: { kind: 'game', n: 5, gone: [], red: [], blue: [] }, ...more });
  assert.deepEqual(recommend([assigned(), assigned()], 'sim'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  assert.equal(recommend([played(), played({ winner: 'teacher' })], 'sim').offerHarder, false);
  assert.equal(recommend([played(), played({ winner: 'draw' })], 'sim').offerHarder, false);
  assert.equal(recommend([played(), played({ choseWinner: false })], 'sim').offerHarder, false);
  assert.equal(recommend([played(), played({ hintsOpened: 1 })], 'sim').offerHarder, false);
  // 칠하기 판: 게임의 잣대가 아니라 틀린 답과 걸린 시간으로 본다.
  assert.equal(recommend([painted(), painted()], 'sim').offerHarder, true);
  assert.equal(recommend([painted(), painted({ wrongCount: 1 })], 'sim').offerHarder, false);
  assert.equal(recommend([painted(), painted({ seconds: 500 })], 'sim').offerHarder, false);
  // 끝까지 두고 진 게임은 그만둔 판이 아니라서 내려가지 않는다.
  assert.equal(recommend([played({ winner: 'teacher' }), played({ winner: 'teacher' })], 'sim').level, 3);
  // 민들레와 바람(fastSolo가 없다)은 그대로다: 혼자 덮기 판은 다시 해 보기로 본다.
  assert.equal(tuningFor('dandelion').fastSolo, undefined);
});

test('틀의 "왜 그럴까?" 문: 이 형식의 판을 한 번 끝까지 하면 막지 않는다(점이 여섯인 판을 끝낸 뒤에 여는 것은 이 형식이 본다)', () => {
  assert.equal(whyUnlocked([], 'sim'), false);
  assert.equal(whyUnlocked([played({ outcome: 'left', winner: null })], 'sim'), false);
  assert.equal(whyUnlocked([played({ winner: 'teacher' })], 'sim'), true);
  assert.equal(MAKE_LEVEL, 6);
});
