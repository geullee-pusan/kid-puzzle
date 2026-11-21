// 여우와 토끼 대본 점검: 화면에 나오는 글이 약속을 지키는지, "왜 그럴까?"의 그림과 말이 다른 방법으로 따라간 것과 맞는지 본다.
// 한 일과 사실만 말한다(틀렸다고 하지 않는다), 힌트는 두 높이, 규칙은 세 문장 안이고 "반드시 한 칸"을 말한다, 시계 대신 여우가 움직인 횟수를 보인다.
// 화면 코드와 틀에 이 형식이 이어져 있는지도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { LADDER } from '../src/core/foxrabbit-ladder.js';
import { LIMITS, checkBoard, colorOf, gapOf, limitOf, replay, solve } from '../src/core/foxrabbit.js';
import { fill, sentenceCount } from '../src/core/text.js';
import { bruteReplay } from './helpers/brute-foxrabbit.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/foxrabbit.json'));
const html = read('index.html');
const code = read('src/formats/foxrabbit.js');
const board = read('src/ui/foxrabbit-board.js');
const css = read('src/app.css');

const VALUES = { k: 3, n: 5, no: '첫 ', face: '여우' };
/** 그림과 판의 값은 글이 아니다 */
const DATA_KEYS = ['picture', 'blank', 'board', 'trail', 'colorOn', 'stay', 'level'];

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
const own = [part('id="foxrabbit-title"', 'id="pins-title"'), part('id="foxrabbit-color"', 'id="pins-numbers"'), part('id="foxrabbit-count"', 'id="pins-count"'), part('id="foxrabbit-pad"', 'id="pins-pad"'), part('id="make-foxrabbit"', 'id="make-pins"')].map(visibleText).join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const said = strings.map(([, text]) => text).join(' ');

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 단계 목록이 사다리와 같다', () => {
  assert.equal(T.title, '여우와 토끼');
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.deepEqual(T.levels.map((item) => item.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(T.levels.map((item) => item.name), ['토끼가 되어 놀기', '먼저 갈까, 나중에 갈까?', '큰 판에서 고르기', '여우가 되어 놀기', '누가 이길지 맞히기', '직접 만들기']);
  for (const entry of T.levels.filter((item) => !item.picture.blank)) {
    assert.equal(checkBoard(entry.picture.board), null);
    assert.equal(replay(entry.picture.board, entry.picture.trail, entry.picture.board.first ?? 'fox').ok, true, entry.name);
  }
  // 처음 화면의 물음과 힌트는 판의 종류마다 있다
  assert.deepEqual(Object.keys(T.home.ask).sort(), ['big', 'choose', 'fox', 'predict', 'rabbit']);
  assert.deepEqual(Object.keys(T.hints).sort(), ['big', 'choose', 'fox', 'made', 'predict', 'rabbit']);
  for (const rung of LADDER) assert.ok(T.hints[rung.hint], rung.hint);
});

test('규칙은 세 문장 안이고, 반드시 한 칸 움직이고 제자리에 있을 수 없다는 것, 토끼는 여우 칸에 못 들어간다는 것, 여우가 움직일 수 있는 횟수를 말한다', () => {
  const rule = fill(T.rules.game, { n: 5 });
  assert.ok(sentenceCount(rule) <= 3);
  assert.match(rule, /반드시 한 칸씩 움직여요\./);
  assert.match(rule, /제자리에 있을 수 없고/);
  assert.match(rule, /토끼는 여우가 있는 칸에 못 들어가요\./);
  assert.match(rule, /여우가 5번 움직일 때까지 안 잡히면 토끼가 이겨요\.$/);
  assert.match(code, /ruleLine: \(round\) => fill\(T\.rules\.game, \{ n: limitOf\(round\.board\) \}\),/);
  // 판을 하는 동안에도 제자리에 있을 수 없다고 적어 둔다
  assert.match(visibleText(part('id="foxrabbit-pad"', 'id="pins-pad"')), /제자리에 있을 수는 없어요\./);
  assert.equal(T.status.stay, '제자리에 있을 수 없어요. 꼭 한 칸 움직여요');
  // 직접 만들기의 안내 글도 세 문장 안이다
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 38);
  assert.ok(sentenceCount(guides[35]) <= 3, guides[35]);
  assert.match(guides[35], /^칸을 누르면 고른 동물이 그 칸으로 가요\./);
});

test('시계가 아니라 여우가 움직인 횟수를 보인다("여우가 움직인 횟수 2 / 5"). 점수, 별, 연달아 이긴 수가 없다', () => {
  const foot = visibleText(part('id="foxrabbit-count"', 'id="pins-count"'));
  assert.match(foot, /여우가 움직인 횟수\s+0\s+\/\s+5/);
  assert.equal([...part('id="foxrabbit-count"', 'id="pins-count"').matchAll(/<strong/g)].length, 2);
  assert.match(code, /\$\('foxrabbit-moves'\)\.textContent = String\(now\.foxMoves\);/);
  assert.match(code, /\$\('foxrabbit-limit'\)\.textContent = String\(now\.limit\);/);
  assert.doesNotMatch(code + board, /setInterval|requestAnimationFrame|Date\.now|performance\.now/);
  // 판 아래와 오른쪽 칸에는 갈 수 없는 칸을 누른 수, 다시 본 수, 연달아 진 수를 적지 않는다
  for (const line of code.split('\n')) if (/textContent/.test(line)) assert.doesNotMatch(line, /refuseCount|replayCount|colorCount|lostStreak|finishedCount/, line.trim());
  assert.doesNotMatch(own, /별|점수|순위|레벨|연속|시간|초/);
  const counting = /\{[a-z]+\}번 (이겼|졌)|몇 번 (이겼|졌)|판째|연달아|이긴 판|진 판|승|패/;
  for (const [path, text] of strings) assert.doesNotMatch(text, counting, path);
});

test('한 일과 사실만 말한다. 판정하는 말, 칭찬 낱말, 꾸미는 말이 없다. 짐작이 맞았는지는 말하지 않는다', () => {
  assert.doesNotMatch(said, /틀렸|틀린|아니에요|땡|정답|아쉽|아깝|실수|실패|성공|잘했|훌륭|대단|최고|멋져|멋진|완벽|축하|천재|똑똑|굉장|맞아요|맞혔|만세|야호/);
  assert.doesNotMatch(own, /틀렸|틀린|아니에요|땡|아쉽|실패|잘했|훌륭|대단|최고|멋/);
  assert.equal(fill(T.right['rabbit-kid'], { n: 5 }), '여우가 5번 움직이는 동안 토끼가 끝까지 안 잡혔어요. 토끼가 된 내가 이겼어요.');
  assert.equal(fill(T.right['fox-teacher'], { k: 4 }), '여우가 4번 움직여 토끼를 잡았어요. 이번 판은 여우가 된 선생님이 이겼어요.');
  assert.equal(fill(T.right.limit, { n: 5 }), '이 판에서 여우는 아무리 잘 쫓아도 5번 안에 못 잡으면 끝내 못 잡아요.');
  assert.equal(T.right['guess-fox'], '처음에는 여우가 이긴다고 짐작했어요.');
  // 이긴 판도 진 판도 끝까지 둔 판으로 똑같이 끝낸다
  assert.equal([...code.matchAll(/frame\.finish\(/g)].length, 1);
  assert.match(code, /round\.winner = after\.winner === round\.role \? 'kid' : 'teacher';/);
  assert.doesNotMatch(code + board, /Math\.random|confetti|firework|celebrat/i);
  // 고르기의 맞고 틀림은 기록에만 남긴다(화면에 알리지 않는다)
  assert.match(code, /correct: 잘 하면 이기는 쪽을 골랐는가\. 화면에서는 알리지 않는다/);
  // 덧붙이는 말은 하나만 한다
  assert.match(code, /if \(finishedCount\(records\) === WHY_AFTER\) parts\.push\(T\.right\['why-invite'\]\);\n\s*\/\/[^\n]*\n\s*else if \(round\.guess !== null\)/);
});

test('"아무리 잘 쫓아도 정한 횟수 안에 못 잡으면 끝내 못 잡는다"와 "가장 빨리 다가가면 몇 번 만에 잡는다"는 풀이 프로그램의 사실이다', () => {
  // 가장 오래 버티는 토끼도 (가로 + 세로 - 3)번이면 잡힌다(풀이 프로그램 테스트가 3×3~6×6의 모든 자리에서 본다). 정한 횟수가 그 값이다
  for (let w = LIMITS.min; w <= LIMITS.max; w++) for (let h = LIMITS.min; h <= LIMITS.max; h++) assert.equal(limitOf({ w, h }), w + h - 3);
  assert.match(code, /else if \(could\) parts\.push\(fill\(T\.right\['fox-could'\], \{ k: stepsOf\(solution, round\.first\) \}\)\);/);
  assert.match(code, /const could = round\.role === 'fox' && round\.winner === 'teacher' && seatWins\(solution, 'fox', round\.first\);/);
  assert.match(code, /else if \(winnerAnimal === 'rabbit'\) parts\.push\(fill\(T\.right\.limit, \{ n: limit \}\)\);/);
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
      assert.doesNotMatch(hint, /때문|해야 해요|하면 돼요|늘 |\d|홀수|짝수|같은 색이면|다른 색이면|차례마다 색 보기/, hint);
    }
  }
  // 3×3 판이 나올 수 있는 판(1단계와 직접 만든 판)의 힌트 1은 "더 작은 판"이 아니다
  for (const key of ['rabbit', 'made']) assert.doesNotMatch(T.hints[key][0], /더 작은 판/);
  assert.match(code, /hints: \(round\) => T\.hints\[round\.custom \? 'made' : rungOf\(round\.level\)\.hint\],/);
});

test('글의 빈칸({이름})은 정해진 이름만 쓰고, 화면 글에 영어 낱말이 없고, "~요"로 끝나는 말투다. 한 문장은 60자를 넘지 않는다', () => {
  const allowed = new Set(['k', 'f', 'n', 'no', 'total', 'level', 'tag', 'face']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
    assert.doesNotMatch(text.replace(/\{[^{}]*\}/g, ''), /[A-Za-z]/, `${path}: ${text}`);
  }
  assert.doesNotMatch(own, /[A-Za-z]/);
  assert.equal(fill(T.cellLabel, { no: '첫 ', n: 2 }), '위에서 첫 번째 줄, 왼쪽에서 2번째 칸');
  assert.equal(fill(T.replay.kid, { no: 3, face: T.animals.rabbit }), '3번째 수예요. 내가 토끼를 옮겼어요.');
  const spoken = [...Object.values(T.home.ask), T.home.pick, T.rules.game, ...Object.values(T.play), ...Object.values(T.hints).flat(), ...Object.values(T.right), T.solution.fox, T.solution.rabbit, T.make.intro, T.make.fox, T.make.rabbit, T.make.placing, ...T.why.map((slide) => slide.say), T.replay['start-fox'], T.replay.kid, T.replay.last, ...Object.values(T.howto)];
  for (const text of spoken) for (const sentence of sentences(text)) assert.match(sentence, /요[.?!]$/, sentence);
  for (const group of [T.status, T.roles, T.firsts, T.guesses, T.turn]) for (const text of Object.values(group)) assert.match(text, /요$/, text);
  for (const slide of T.why) for (const item of slide.figures) assert.match(item.note, /요$/, item.note);
  for (const [path, text] of strings) for (const sentence of sentences(fill(text, VALUES))) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

const at = (item, upto = item.trail.length) => bruteReplay(item.board, item.trail.slice(0, upto), item.board.first);
const colorName = (w, cell) => T.tool.colors[colorOf(w, cell)];

test('"왜 그럴까?" 1장: 같은 색 칸에서 여우 차례로 시작한 판. 바로 옆까지 다가가도 다섯 번 안에 못 잡았다(규칙대로 따라가 본다)', () => {
  assert.equal(T.why.length, 4);
  for (const slide of T.why) assert.ok(sentenceCount(slide.say) <= 3, slide.say);
  const [start, near, end] = T.why[0].figures;
  assert.deepEqual(start.trail, []);
  assert.equal(solve(start.board).winner, 'rabbit');
  for (const item of T.why[0].figures) assert.ok(replay(item.board, item.trail, item.board.first).ok);
  // 둘째 그림: 여우가 방금 움직여 토끼 바로 옆에 있다
  const nearNow = at(near);
  assert.equal(gapOf(near.board.w, nearNow.fox[1] * near.board.w + nearNow.fox[0], nearNow.rabbit[1] * near.board.w + nearNow.rabbit[0]), 1);
  assert.equal(near.trail.length % 2, 1);
  // 셋째 그림: 다음 수에 토끼가 비켜났고, 여우가 다섯 번 움직여 끝났다(토끼가 이겼다)
  assert.ok(end.trail.join(',').startsWith(near.trail.join(',')));
  const endNow = at(end);
  assert.deepEqual([endNow.ok, endNow.winner, endNow.foxMoves], [true, 'rabbit', 5]);
  const after = at(end, near.trail.length + 1);
  assert.ok(Math.abs(after.fox[0] - after.rabbit[0]) + Math.abs(after.fox[1] - after.rabbit[1]) > 1);
  assert.match(T.why[0].say, /다섯 번을 다 움직여도 못 잡았어요\.$/);
});

test('"왜 그럴까?" 2장: 두 색을 칠하면 여우 차례마다 둘이 같은 색이다(그림 글의 색 이름이 칸의 색과 같다)', () => {
  for (const item of T.why[1].figures) {
    assert.equal(item.colorOn, true);
    assert.equal(item.trail.length % 2, 0, '여우 차례');
    const now = replay(item.board, item.trail, item.board.first);
    assert.equal(now.ok, true);
    assert.equal(now.next, 'fox');
    assert.equal(colorOf(item.board.w, now.fox), colorOf(item.board.w, now.rabbit));
    assert.equal(item.note, `둘 다 ${colorName(item.board.w, now.fox)}이에요`);
  }
  assert.match(T.why[1].say, /한 칸 움직이면 늘 다른 색 칸으로 가요\./);
});

test('"왜 그럴까?" 3장: 같은 색이면 못 잡고 다른 색이면 잡는다(풀이 프로그램). 생각의 이름은 여기서 처음 말한다', () => {
  const [same, other] = T.why[2].figures;
  assert.equal(colorOf(same.board.w, same.board.fox), colorOf(same.board.w, same.board.rabbit));
  assert.notEqual(colorOf(other.board.w, other.board.fox), colorOf(other.board.w, other.board.rabbit));
  assert.deepEqual([same.board.first, other.board.first], ['fox', 'fox']);
  assert.equal(solve(same.board).winner, 'rabbit');
  assert.equal(solve(other.board).winner, 'fox');
  assert.ok(solve(other.board).foxFirst <= limitOf(other.board));
  assert.match(T.why[2].say, /선생님은 이것을 차례마다 색 보기라고 불러요\.$/);
  for (const [path, text] of strings) if (!path.startsWith('why[2]')) assert.doesNotMatch(text, /차례마다 색 보기/, path);
});

test('"왜 그럴까?" 4장: 까닭이 그대로는 통하지 않는 판. 토끼가 제자리에 있어도 되면 같은 색에서 시작해도 여우가 잡는다', () => {
  const [start, rest, caught] = T.why[3].figures;
  assert.equal(start.trail.length, 0);
  assert.equal(colorOf(start.board.w, start.board.fox), colorOf(start.board.w, start.board.rabbit));
  // 둘째 그림: 여우가 한 칸 오고 토끼는 그대로(쉬었다). 다시 여우 차례인데 다른 색이다
  assert.equal(rest.trail.at(-1), start.board.rabbit);
  assert.equal(rest.stay, true);
  const restNow = bruteReplay(rest.board, rest.trail, rest.board.first, { rabbitStay: true });
  assert.equal(restNow.ok, true);
  const w = rest.board.w;
  assert.notEqual(colorOf(w, restNow.fox[1] * w + restNow.fox[0]), colorOf(w, restNow.rabbit[1] * w + restNow.rabbit[0]));
  // 셋째 그림: 여우가 잡는다. 원래 규칙으로는 둘 수 없는 수다(토끼는 쉴 수 없다)
  const end = bruteReplay(caught.board, caught.trail, caught.board.first, { rabbitStay: true });
  assert.deepEqual([end.ok, end.winner], [true, 'fox']);
  assert.equal(replay(caught.board, caught.trail, caught.board.first).ok, false);
  assert.match(T.why[3].say, /^이렇게 칸에 두 색을 칠해 보는 것을 어디서 봤지요\?/);
  // 그림은 규칙을 따지지 않는 따라가기로 그린다
  assert.match(code, /const now = walk\(board, item\.trail \?\? \[\], board\.first \?\? 'fox'\);/);
});

test('풀이와 직접 만들기: 먼저 움직이는 쪽마다 누가 이기는지와 여우가 몇 번 만에 잡는지 말한다', () => {
  assert.equal(fill(T.solution.fox, { face: '토끼', k: 5 }), '토끼가 먼저 움직이면, 둘 다 잘 할 때 여우가 5번 만에 토끼를 잡아요.');
  assert.equal(fill(T.make.fox, { k: 4 }), '둘 다 잘 하면 여우가 이겨요. 토끼가 가장 오래 버텨도 여우가 4번 만에 잡아요.');
  assert.equal(T.make.rabbit, '둘 다 잘 하면 토끼가 이겨요. 여우가 아무리 잘 쫓아도 토끼를 잡을 수 없어요.');
  assert.match(code, /const line = fill\(T\.make\[result\.winner\], \{ k: stepsOf\(result, board\.first\) \}\);/);
  const make = part('id="make-foxrabbit"', 'id="make-pins"');
  for (const id of ['foxrabbit-make-w-fewer', 'foxrabbit-make-w', 'foxrabbit-make-w-more', 'foxrabbit-make-h-fewer', 'foxrabbit-make-h', 'foxrabbit-make-h-more', 'foxrabbit-make-place-fox', 'foxrabbit-make-place-rabbit', 'foxrabbit-make-first-fox', 'foxrabbit-make-first-rabbit', 'foxrabbit-make-board', 'foxrabbit-make-placing', 'foxrabbit-make-solve', 'foxrabbit-make-result', 'foxrabbit-make-play']) {
    assert.ok(make.includes(`id="${id}"`), id);
  }
  assert.match(make, /id="foxrabbit-make-solve"[^>]*>선생님, 누가 이길까요\?</);
  assert.match(make, /id="foxrabbit-make-play"[^>]*>내가 해 볼래요</);
  assert.match(code, /\n {4}madeBoard,\n/);
  assert.doesNotMatch(code, /bestOf/);
  assert.deepEqual(LIMITS, { min: 3, max: 5 });
});

test('index.html: 이 형식의 카드, 판, 판 아래, 오른쪽 칸, 도구, 끝난 뒤의 단추, 직접 만들기가 있다. 틀에 이어져 있다', () => {
  for (const id of ['home-foxrabbit-sample', 'home-foxrabbit-ask', 'home-foxrabbit-play', 'home-foxrabbit-pick', 'home-foxrabbit-make', 'home-foxrabbit-blank', 'foxrabbit-board', 'foxrabbit-count', 'foxrabbit-status', 'foxrabbit-moves', 'foxrabbit-limit', 'foxrabbit-pad', 'foxrabbit-predict', 'foxrabbit-guess-fox', 'foxrabbit-guess-rabbit', 'foxrabbit-guess-line', 'foxrabbit-pick-role', 'foxrabbit-be-fox', 'foxrabbit-be-rabbit', 'foxrabbit-role', 'foxrabbit-order', 'foxrabbit-first', 'foxrabbit-second', 'foxrabbit-first-line', 'foxrabbit-turn-box', 'foxrabbit-turn', 'foxrabbit-howto', 'foxrabbit-color', 'foxrabbit-swap', 'foxrabbit-replay', 'make-foxrabbit']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(part('id="foxrabbit-title"', '</section>'), /<h2 id="foxrabbit-title">여우와 토끼<\/h2>/);
  assert.ok(visibleText(part('id="foxrabbit-title"', '</section>')).includes(T.home.ask.rabbit));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-foxrabbit-make" class="menu-item"/);
  const pad = part('id="foxrabbit-pad"', 'id="pins-pad"');
  assert.match(pad, /id="foxrabbit-first"[^>]*>먼저 갈래요</);
  assert.match(pad, /id="foxrabbit-second"[^>]*>나중에 갈래요</);
  assert.match(pad, /id="foxrabbit-guess-fox"[^>]*>여우가 이겨요</);
  assert.match(pad, /id="foxrabbit-guess-rabbit"[^>]*>토끼가 이겨요</);
  assert.match(part('id="foxrabbit-color"', 'id="pins-numbers"'), /aria-pressed="false" hidden>색 켜기</);
  assert.equal(T.tool.off, '색 켜기');
  // 카드는 줄 뒤집기 판 다음, 퍼즐 만들기 앞이다
  assert.ok(html.indexOf('id="rowflip-title"') < html.indexOf('id="foxrabbit-title"'));
  assert.ok(html.indexOf('id="foxrabbit-title"') < html.indexOf('id="make-title"'));
  // 틀이 형식을 안다(줄 뒤집기 판 다음)
  assert.match(read('src/main.js'), /rowflip: createRowflip\(frame\), foxrabbit: createFoxrabbit\(frame\), /);
  assert.match(read('src/check-main.js'), /\['foxrabbit', '여우와 토끼'\]/);
  assert.match(read('src/core/smaller.js'), /rowflip: smallerRowflip, foxrabbit: smallerFoxrabbit, /);
  assert.match(code, /smaller: \(round, turn\) => smallerFoxrabbit\(\{ mode: round\.mode, board: round\.board \}, turn\),/);
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
  // 무르기와 되돌리기가 없다(선생님과 두는 게임). 판이 정사각형에 가까워 규칙 글은 왼쪽 칸에 둔다
  assert.match(code, /\$\('undo'\)\.hidden = true;\s*\$\('reset'\)\.hidden = true;/);
  assert.match(code, /ruleAside: true,/);
  // 도구를 처음 켜면 힌트 하나로 센다
  assert.match(code, /hintsOpened: round\.hintsOpened \+ \(round\.colorShown \? 1 : 0\),/);
});

test('화면: 칸은 1180×820에서 가장 큰 5×5 판에도 44픽셀보다 크다. 여우와 토끼, 갈 수 있는 칸, 두 색은 색만이 아니라 모양으로도 보인다', () => {
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const unit = Number(board.match(/const UNIT = (\d+);/)[1]);
  const edge = Number(board.match(/const EDGE = (\d+);/)[1]);
  // 판 칸은 1180×820 화면에서 높이 430픽셀쯤이다(규칙 글이 왼쪽 칸에 있다). 380픽셀로 잡아도
  const px = 380 / (LIMITS.max * unit + 2 * edge);
  assert.ok(unit * px >= 44, `칸 ${unit * px}`);
  // 여우는 세모(뾰족한 귀와 얼굴), 토끼는 동그라미와 긴 타원(귀)
  assert.match(board, /'fxr-fox-ear'/);
  assert.match(board, /make\('ellipse', \{ cx: -11, cy: -22, rx: 8, ry: 22 \}, 'fxr-rabbit-ear'\)/);
  // 갈 수 있는 칸은 점선 동그라미, 방금 움직인 길은 점선, 두 색은 구석의 동그라미와 네모
  assert.match(plain, /\.fxr-target \{[^}]*stroke-dasharray/);
  assert.match(plain, /\.fxr-step \{[^}]*stroke-dasharray/);
  assert.match(board, /colorAt\(w, cell\) === 0\) return make\('circle'/);
  assert.deepEqual(T.tool.colors, ['동그라미 칸', '네모 칸']);
  // 판의 그림과 표시는 누르는 것을 가로막지 않는다
  assert.match(plain, /\.fxr-animal,\s*\.fxr-target,[^{]*\{\s*pointer-events: none;/);
  // 칸을 글자판으로도 누를 수 있고, 화살표로 옮길 수 있다
  assert.match(board, /group\.setAttribute\('role', 'button'\);/);
  assert.match(code, /const ARROWS = \{ ArrowUp: \[0, -1\], ArrowDown: \[0, 1\], ArrowLeft: \[-1, 0\], ArrowRight: \[1, 0\] \};/);
});

/** 끝까지 둔 게임의 기록 하나 */
function finished(more = {}) {
  return { kind: 'round', id: `r-${more.id ?? 1}`, format: 'foxrabbit', level: 1, seed: 1, custom: false, mode: 'rabbit', outcome: 'solved', hintsOpened: 0, answers: [], moveCount: 5, seconds: 60, chose: false, assigned: true, choseWinner: true, winner: 'kid', rematch: false, solution: { possible: true }, ...more };
}

test('수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다. 이기는 자리에 서서 이긴 판이 "한 번에 빠르게"다. "왜 그럴까?"는 게임을 두 판 끝까지 둔 뒤에 열린다', () => {
  const tuning = tuningFor('foxrabbit');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 5);
  assert.equal(tuning.hintCount, 2);
  assert.equal(tuning.fastWin, true);
  assert.equal(tuning.whyAfter, 'finished');
  assert.match(read('src/core/level.js'), /여우와 토끼\(모두 임시\)/);
  assert.deepEqual(recommend([], 'foxrabbit'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  assert.deepEqual(recommend([finished({ id: 1 }), finished({ id: 2 })], 'foxrabbit'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  // 잡히는 판(이기는 자리가 아니다), 자리를 바꿔 다시 둔 판, 힌트를 연 판은 "한 번에 빠르게"가 아니다
  for (const more of [{ choseWinner: false, winner: 'teacher' }, { rematch: true }, { hintsOpened: 1 }]) assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, ...more })], 'foxrabbit').offerHarder, false, JSON.stringify(more));
  assert.equal(whyUnlocked([finished()], 'foxrabbit'), true);
  // 이 형식은 따로 게임을 두 판 끝까지 둔 뒤에 연다
  assert.match(code, /if \(!whyOpen\(frame\.records\(\)\)\) return null;/);
});
