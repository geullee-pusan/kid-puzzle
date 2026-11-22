// 블랙홀 대본 점검: 화면에 나오는 글이 약속을 지키는지, "왜 그럴까?"의 그림과 말이 다른 방법으로 따라간 것과 맞는지 본다.
// 한 일과 사실만 말한다(틀렸다고 하지 않는다), 힌트는 두 높이, 규칙은 세 문장 안, 시계 대신 남은 빈칸의 수를 보인다.
// 화면 코드와 틀에 이 형식이 이어져 있는지도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { LADDER } from '../src/core/blackhole-ladder.js';
import { EXACT_LEFT, LIMITS, checkBoard, nearOf, replay } from '../src/core/blackhole.js';
import { endsClosed, fill, sentenceCount } from '../src/core/text.js';
import { bruteReplay } from './helpers/brute-blackhole.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/blackhole.json'));
const html = read('index.html');
const code = read('src/formats/blackhole.js');
const board = read('src/ui/blackhole-board.js');
const css = read('src/app.css');

const VALUES = { k: 3, n: 5, no: '첫 ' };
/** 그림과 판의 값은 글이 아니다 */
const DATA_KEYS = ['picture', 'blank', 'board', 'trail', 'rings', 'level'];

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
const own = [part('id="blackhole-title"', 'id="tower-title"'), part('id="blackhole-count"', 'id="tower-count"'), part('id="blackhole-pad"', 'id="tower-pad"'), part('id="make-blackhole"', 'id="make-tower"')].map(visibleText).join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const said = strings.map(([, text]) => text).join(' ');

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 단계 목록이 사다리와 같다. 판 고르기의 그림은 규칙대로 둔 판이다', () => {
  assert.equal(T.title, '블랙홀');
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.deepEqual(T.levels.map((item) => item.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(T.levels.map((item) => item.name), ['작은 판에서 두기', '칸이 9개인 판', '몇 수만 남은 판', '먼저 둘까, 나중에 둘까?', '칸이 15개인 큰 판', '직접 만들기']);
  for (const entry of T.levels.filter((item) => !item.picture.blank)) {
    assert.equal(checkBoard(entry.picture.board), null, entry.name);
    assert.equal(replay(entry.picture.board, entry.picture.trail, entry.picture.board.first ?? 'kid').ok, true, entry.name);
  }
  assert.deepEqual(Object.keys(T.home.ask).sort(), ['big', 'choose', 'left', 'nine', 'small']);
  assert.deepEqual(Object.keys(T.hints).sort(), ['big', 'choose', 'left', 'made', 'nine', 'small']);
  for (const rung of LADDER) assert.ok(T.hints[rung.hint], rung.hint);
});

test('규칙은 세 문장 안이고, 번갈아 1부터 차례로 놓는 것, 마지막 빈칸이 블랙홀이 되어 맞닿은 칸의 수를 빨아들이는 것, 남은 합이 큰 쪽이 이기는 것을 말한다', () => {
  assert.ok(sentenceCount(T.rules.game) <= 3);
  assert.match(T.rules.game, /번갈아 빈칸에 자기 수를 1부터 차례로 놓아요\./);
  assert.match(T.rules.game, /빈칸이 하나 남으면 블랙홀이 되어 맞닿은 칸의 수를 모두 빨아들여요\./);
  assert.match(T.rules.game, /남은 수의 합이 큰 쪽이 이겨요\.$/);
  assert.match(code, /ruleLine: \(\) => T\.rules\.game,/);
  // 직접 만들기의 안내 글도 세 문장 안이다(형식마다 하나, 이 형식이 맨 뒤). 나중에 두는 쪽이 이기는 판을 만들어 보라고 권한다
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 49);
  assert.ok(sentenceCount(guides[39]) <= 3, guides[39]);
  assert.match(guides[39], /^칸을 누르면 고른 것이 놓이거나 치워져요\./);
  assert.match(guides[39], /나중에 두는 쪽이 이기는 판도 만들 수 있을까요\?$/);
});

test('시계가 아니라 남은 빈칸의 수를, 끝나면 남은 합을 보인다. 점수, 별, 연달아 이긴 수가 없다', () => {
  const foot = visibleText(part('id="blackhole-count"', 'id="tower-count"'));
  assert.match(foot, /빈칸\s+5\s+개/);
  assert.match(foot, /남은 합: 나\s+0\s+, 선생님\s+0/);
  assert.match(code, /\$\('blackhole-left'\)\.textContent = String\(now\.empty\.length\);/);
  assert.doesNotMatch(code + board, /setInterval|requestAnimationFrame|Date\.now|performance\.now/);
  for (const line of code.split('\n')) if (/textContent/.test(line)) assert.doesNotMatch(line, /refuseCount|replayCount|lostStreak|finishedCount/, line.trim());
  assert.doesNotMatch(own, /별|점수|순위|레벨|연속|시간|초/);
  const counting = /\{[a-z]+\}번 (이겼|졌)|몇 번 (이겼|졌)|판째|연달아|이긴 판|진 판|승|패/;
  for (const [path, text] of strings) assert.doesNotMatch(text, counting, path);
});

test('한 일과 사실만 말한다. 판정하는 말, 칭찬 낱말, 꾸미는 말이 없다. 고르기가 맞았는지는 말하지 않는다', () => {
  assert.doesNotMatch(said, /틀렸|틀린|아니에요|땡|정답|아쉽|아깝|실수|실패|성공|잘했|훌륭|대단|최고|멋져|멋진|완벽|축하|천재|똑똑|굉장|맞아요|맞혔|만세|야호|우와/);
  assert.doesNotMatch(own, /틀렸|틀린|아니에요|땡|아쉽|실패|잘했|훌륭|대단|최고|멋/);
  // 수 뒤의 말은 수를 읽은 소리에 맞춘다
  assert.equal(fill(T.right.lost[endsClosed(3) ? 'closed' : 'open'], { k: 3, n: 3 }), '블랙홀이 빨아들인 합은 나 3, 선생님 3이에요.');
  assert.equal(fill(T.right.left[endsClosed(2) ? 'closed' : 'open'], { k: 0, n: 2 }), '남은 합은 나 0, 선생님 2예요.');
  assert.match(code, /const tail = \(value\) => \(endsClosed\(value\) \? 'closed' : 'open'\);/);
  assert.deepEqual([T.right.kid, T.right.teacher, T.right.draw], ['이번 판은 내가 이겼어요.', '이번 판은 선생님이 이겼어요.', '이번 판은 비겼어요.']);
  // 이긴 판도 진 판도 비긴 판도 끝까지 둔 판으로 똑같이 끝낸다
  assert.equal([...code.matchAll(/frame\.finish\(/g)].length, 1);
  assert.match(code, /round\.winner = after\.winner;/);
  assert.doesNotMatch(code + board, /Math\.random|confetti|firework|celebrat/i);
  assert.match(code, /correct: 잘 두면 지지 않는 자리를 골랐는가\(모르는 판은 null\)\. 화면에서는 알리지 않는다/);
  // 덧붙이는 말은 하나만 한다. "끝까지 잘 두면 이길 수 있던 자리"는 처음 자리를 끝까지 따진 판에서만 말한다
  assert.match(code, /if \(finishedCount\(records\) === WHY_AFTER\) parts\.push\(T\.right\['why-invite'\]\);\n(\s*\/\/[^\n]*\n)*\s*else if \(could\) parts\.push\(T\.right\[`could-\$\{seat\}`\]\);/);
  assert.match(code, /const could = seat !== null && \(\(seat === 'win' && round\.winner !== 'kid'\) \|\| \(seat === 'draw' && round\.winner === 'teacher'\)\);/);
});

test('힌트는 판의 종류마다 두 개이고, 하나하나가 질문 한 문장이다. 힌트 1은 함께 쓰는 목록에서 고른다. 까닭은 힌트에 없다', () => {
  const common = ['끝에는 어떤 모양이 되어야 하나요?', '끝나기 바로 전에는 어떤 모양일까요?', '더 작은 판이라면 할 수 있을까요?', '더 작은 판이라면 누가 이길까요?', '전에 해 본 판 가운데 닮은 판이 있었나요?', '아까와 다른 곳에서 시작하면 어떻게 되나요?', '아직 한 번도 건드리지 않은 곳이 있나요?'];
  for (const [key, list] of Object.entries(T.hints)) {
    assert.equal(list.length, 2, key);
    assert.notEqual(list[0], list[1]);
    assert.ok(common.includes(list[0]), list[0]);
    for (const hint of list) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
      assert.doesNotMatch(hint, /때문|해야 해요|하면 돼요|늘 |\d|숨겨|남을 칸 내다보기/, hint);
    }
  }
  // 가장 작은 판(1단계)과 직접 만든 판의 힌트 1은 "더 작은 판"이 아니다
  for (const key of ['small', 'made']) assert.doesNotMatch(T.hints[key][0], /더 작은 판/);
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
  const spoken = [...Object.values(T.home.ask), T.home.pick, T.rules.game, ...Object.values(T.play), ...Object.values(T.hints).flat(), ...allStrings(T.right).map(([, text]) => text), ...allStrings(T.solution).filter(([path]) => !path.startsWith('note')).map(([, text]) => text), ...allStrings(T.make).map(([, text]) => text).filter((text) => text !== T.make.rows), ...T.why.map((slide) => slide.say), T.replay.start, T.replay.kid, T.replay.last];
  for (const text of spoken) for (const sentence of sentences(text)) assert.match(sentence, /요[.?!]$/, sentence);
  for (const group of [T.status, T.firsts, T.turn]) for (const text of Object.values(group)) assert.match(text, /요$/, text);
  for (const slide of T.why) for (const item of slide.figures) assert.match(item.note, /요$/, item.note);
  for (const [path, text] of strings) for (const sentence of sentences(fill(text, VALUES))) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

/** 그림 하나를 다른 방법으로 따라간 끝 */
const endOf = (item) => bruteReplay(item.board, item.trail, item.board.first);

test('"왜 그럴까?" 1장: 5칸 판에서 끝까지 둔 판. 두 사람이 놓은 수의 합은 같고, 빨려 들어간 합이 큰 쪽이 졌다', () => {
  assert.equal(T.why.length, 4);
  for (const slide of T.why) assert.ok(sentenceCount(slide.say) <= 3, slide.say);
  const [before, after] = T.why[0].figures;
  const two = replay(before.board, before.trail, 'kid');
  assert.equal(two.empty.length, 2);
  assert.equal(before.note, '빈칸이 둘 남았어요');
  const end = endOf(after);
  assert.equal(end.over, true);
  const sum = (map) => [...map.values()].reduce((a, b) => a + b, 0);
  assert.deepEqual([sum(end.kid), sum(end.teacher)], [3, 3]);
  assert.deepEqual([end.score.kid, end.score.teacher, end.score.lostKid, end.score.lostTeacher], [0, 1, 3, 2]);
  assert.equal(after.note, `내 합 ${end.score.kid}, 선생님 합 ${end.score.teacher}이 남았어요`);
  assert.match(T.why[0].say, /두 사람 모두 1과 2를 놓으니 놓은 수의 합은 3으로 같았어요\./);
});

test('"왜 그럴까?" 2장: 빈칸이 둘 남으면 마지막 수를 놓는 쪽이 블랙홀을 고른다. 한쪽은 선생님이 이기고 다른 쪽은 비긴다', () => {
  const [win, draw] = T.why[1].figures;
  assert.deepEqual(win.trail.slice(0, 3), draw.trail.slice(0, 3));
  const before = replay(win.board, win.trail.slice(0, 3), 'kid');
  assert.equal(before.next, 'teacher');
  assert.deepEqual(before.empty.sort(), [win.trail[3], draw.trail[3]].sort());
  const a = endOf(win).score;
  const b = endOf(draw).score;
  assert.ok(a.teacher > a.kid);
  assert.equal(win.note, '여기에 놓으면 선생님이 이겨요');
  assert.equal(b.teacher, b.kid);
  assert.equal(draw.note, '여기에 놓으면 비겨요');
  // 마지막 수를 놓으면 남은 칸이 블랙홀이다
  assert.equal(a.hole, draw.trail[3]);
  assert.equal(b.hole, win.trail[3]);
});

test('"왜 그럴까?" 3장: 내 2를 둘레가 다 찬 칸에 숨기면 선생님이 어디에 놓아도 내가 이긴다. 생각의 이름은 여기서 처음 말한다', () => {
  const [hidden, ...ends] = T.why[2].figures;
  const now = replay(hidden.board, hidden.trail, 'kid');
  const two = now.kid[1];
  assert.deepEqual(hidden.rings, [two]);
  // 2의 이웃(돌이 아닌 칸)에 빈칸이 없다
  assert.ok(nearOf(hidden.board.rows, two).filter((cell) => !hidden.board.rocks.includes(cell)).every((cell) => !now.empty.includes(cell)));
  assert.equal(now.next, 'teacher');
  assert.deepEqual(ends.map((item) => item.trail.at(-1)).sort(), now.empty.sort());
  for (const item of ends) {
    const score = endOf(item).score;
    assert.ok(score.kid > score.teacher, item.note);
    assert.match(item.note, /내가 이겨요$/);
  }
  assert.match(T.why[2].say, /선생님은 이것을 남을 칸 내다보기라고 불러요\.$/);
  for (const [path, text] of strings) if (!path.startsWith('why[2]')) assert.doesNotMatch(text, /남을 칸 내다보기/, path);
});

test('"왜 그럴까?" 4장: 15칸 판에서 선생님은 빈칸이 9개가 될 때부터 끝까지 모두 따진다(풀이 프로그램의 값과 같다)', () => {
  const [item] = T.why[3].figures;
  const now = replay(item.board, item.trail, item.board.first);
  assert.equal(item.board.rows, 5);
  assert.equal(now.empty.length, EXACT_LEFT);
  assert.equal(item.note, `빈칸이 ${EXACT_LEFT}개 남았어요`);
  assert.match(T.why[3].say, new RegExp(`빈칸이 ${EXACT_LEFT}개가 될 때부터 끝까지 모두 따져 봐요\\.`));
  assert.match(T.why[3].say, /어디서 봤지요\?$/);
});

test('풀이와 직접 만들기: 둘 차례인 쪽부터 둘 다 잘 두면 어떻게 끝나는지와 남은 합의 차를 말한다. 끝까지 따질 수 없는 판은 그렇다고 말한다', () => {
  assert.equal(T.solution['kid-win'], '내 차례부터 둘 다 잘 두면 내가 이겨요.');
  assert.equal(fill(T.solution.margin, { k: 2 }), '남은 합이 2만큼 차이 나요.');
  assert.equal(fill(T.make.big, { n: EXACT_LEFT }), '빈칸이 9개보다 많으면 선생님도 끝까지 다 따져 볼 수 없어요. 수를 몇 개 더 놓아 보세요.');
  assert.match(code, /const line = result\.exact \? endLine\(sideToMove\(board\), result\.value\) : fill\(T\.make\.big, \{ n: EXACT_LEFT \}\);/);
  const make = part('id="make-blackhole"', 'id="make-tower"');
  for (const id of ['blackhole-make-rows-fewer', 'blackhole-make-rows', 'blackhole-make-rows-more', 'blackhole-make-tool-rock', 'blackhole-make-tool-kid', 'blackhole-make-tool-teacher', 'blackhole-make-first-kid', 'blackhole-make-first-teacher', 'blackhole-make-board', 'blackhole-make-placing', 'blackhole-make-solve', 'blackhole-make-result', 'blackhole-make-play']) {
    assert.ok(make.includes(`id="${id}"`), id);
  }
  assert.match(make, /id="blackhole-make-solve"[^>]*>선생님, 누가 이길까요\?</);
  assert.match(make, /id="blackhole-make-play"[^>]*>내가 해 볼래요</);
  assert.deepEqual(Object.keys(T.make.check).sort(), ['full', 'odd', 'turns']);
  // 풀이의 값은 "먼저 둔 쪽"으로 적혀 있다. 미리 놓인 수가 한쪽에 많으면 판이 정한 먼저 둔 쪽 하나만 본다
  assert.ok(code.includes('const firsts = board.kid.length !== board.teacher.length ? [board.first] : round.first ? [round.first, otherSide(round.first)] : SIDES;'));
  assert.match(code, /\n {4}madeBoard,\n/);
  assert.doesNotMatch(code, /bestOf/);
  assert.deepEqual(LIMITS, { min: 3, max: 5 });
});

test('index.html: 이 형식의 카드, 판, 판 아래, 오른쪽 칸, 끝난 뒤의 단추, 직접 만들기가 있다. 틀에 이어져 있다', () => {
  for (const id of ['home-blackhole-sample', 'home-blackhole-ask', 'home-blackhole-play', 'home-blackhole-pick', 'home-blackhole-make', 'home-blackhole-blank', 'blackhole-board', 'blackhole-count', 'blackhole-status', 'blackhole-left', 'blackhole-kid-sum', 'blackhole-teacher-sum', 'blackhole-pad', 'blackhole-first-line', 'blackhole-order', 'blackhole-first', 'blackhole-second', 'blackhole-turn-box', 'blackhole-turn', 'blackhole-kid-next', 'blackhole-teacher-next', 'blackhole-swap', 'blackhole-replay', 'make-blackhole']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(part('id="blackhole-title"', '</section>'), /<h2 id="blackhole-title">블랙홀<\/h2>/);
  assert.ok(visibleText(part('id="blackhole-title"', '</section>')).includes(T.home.ask.small));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-blackhole-make" class="menu-item"/);
  const pad = part('id="blackhole-pad"', 'id="tower-pad"');
  assert.match(pad, /id="blackhole-first"[^>]*>먼저 둘래요</);
  assert.match(pad, /id="blackhole-second"[^>]*>나중에 둘래요</);
  // 카드는 구역 지도 맞히기 다음, 퍼즐 만들기 앞이다
  assert.ok(html.indexOf('id="regionmap-title"') < html.indexOf('id="blackhole-title"'));
  assert.ok(html.indexOf('id="blackhole-title"') < html.indexOf('id="make-title"'));
  // 틀이 형식을 안다(형식 목록의 맨 뒤, 구역 지도 맞히기 다음)
  assert.match(read('src/main.js'), /regionmap: createRegionmap\(frame\), blackhole: createBlackhole\(frame\), /);
  assert.match(read('src/check-main.js'), /\['blackhole', '블랙홀'\]/);
  assert.match(read('src/core/smaller.js'), /regionmap: smallerRegionmap, blackhole: smallerBlackhole, /);
  assert.match(code, /smaller: \(round, turn\) => smallerBlackhole\(\{ mode: round\.mode, board: round\.board \}, turn\),/);
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
  // 무르기와 되돌리기가 없다(선생님과 두는 게임). 규칙 글은 왼쪽 칸에 둔다
  assert.match(code, /\$\('undo'\)\.hidden = true;\s*\$\('reset'\)\.hidden = true;/);
  assert.match(code, /ruleAside: true,/);
});

test('화면: 칸은 1180×820에서 가장 큰 15칸 판에도 44픽셀보다 크다. 내 수, 선생님 수, 돌, 블랙홀은 색만이 아니라 모양으로도 보인다. 움직임은 짧고 줄일 수 있다', () => {
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const unit = Number(board.match(/const UNIT = (\d+);/)[1]);
  const radius = Number(board.match(/const RADIUS = (\d+);/)[1]);
  const edge = Number(board.match(/const EDGE = (\d+);/)[1]);
  // 판 칸은 1180×820 화면에서 높이 430픽셀쯤이다(규칙 글이 왼쪽 칸에 있다). 380픽셀로 잡아도
  const height = unit + (LIMITS.max - 1) * unit * 0.866 + 2 * edge;
  const px = 380 / height;
  assert.ok(2 * radius * px >= 44, `동그라미 ${2 * radius * px}`);
  // 내 수는 동그라미, 선생님 수는 점선 네모, 돌은 점 박힌 동그라미, 블랙홀은 소용돌이
  assert.match(board, /make\('circle', \{ cx, cy, r: RADIUS - 6 \}, 'bh-kid'\)/);
  assert.match(board, /make\('rect', \{[^}]*\}, 'bh-teacher'\)/);
  assert.match(plain, /\.bh-teacher \{[^}]*stroke-dasharray/);
  assert.match(board, /'bh-rock-dot'/);
  assert.match(board, /'bh-swirl'/);
  assert.match(plain, /\.bh-gone-ring \{[^}]*stroke-dasharray/);
  // 빨려 들어가는 움직임은 0.6초보다 짧고, 움직임을 줄이는 설정이면 없다
  const [, seconds] = plain.match(/\.bh-swallow \{\s*animation: bh-swallow ([\d.]+)s/);
  assert.ok(Number(seconds) <= 0.6);
  assert.match(plain, /@media \(prefers-reduced-motion: reduce\) \{\s*\.bh-swallow \{\s*animation: none;/);
  // 판의 그림과 표시는 누르는 것을 가로막지 않는다. 칸을 글자판으로도 누를 수 있다
  assert.match(plain, /\.bh-piece,\s*\.bh-rock-group,[^{]*\{\s*pointer-events: none;/);
  assert.match(board, /group\.setAttribute\('role', 'button'\);/);
});

/** 끝까지 둔 게임의 기록 하나 */
function finished(more = {}) {
  return { kind: 'round', id: `r-${more.id ?? 1}`, format: 'blackhole', level: 1, seed: 1, custom: false, mode: 'game', outcome: 'solved', hintsOpened: 0, answers: [], moveCount: 2, seconds: 60, chose: false, assigned: true, choseWinner: true, winner: 'kid', rematch: false, solution: { possible: true }, ...more };
}

test('수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다. 지지 않는 자리에서 이긴 판이 "한 번에 빠르게"다. "왜 그럴까?"는 게임을 두 판 끝까지 둔 뒤에 열린다', () => {
  const tuning = tuningFor('blackhole');
  assert.deepEqual([tuning.startLevel, tuning.bottomLevel, tuning.topLevel, tuning.hintCount, tuning.fastWin, tuning.whyAfter], [1, 1, 5, 2, true, 'finished']);
  assert.match(read('src/core/level.js'), /블랙홀\(모두 임시\)/);
  assert.deepEqual(recommend([], 'blackhole'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  assert.deepEqual(recommend([finished({ id: 1 }), finished({ id: 2 })], 'blackhole'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  // 비긴 판, 모르는 자리(큰 판), 자리를 바꿔 다시 둔 판, 힌트를 연 판은 "한 번에 빠르게"가 아니다
  for (const more of [{ winner: 'draw' }, { choseWinner: null }, { rematch: true }, { hintsOpened: 1 }]) assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, ...more })], 'blackhole').offerHarder, false, JSON.stringify(more));
  assert.equal(whyUnlocked([finished()], 'blackhole'), true);
  assert.match(code, /if \(!whyOpen\(frame\.records\(\)\)\) return null;/);
  // 큰 판은 처음 자리를 모르므로 지지 않는 자리였는지 적지 않는다
  assert.match(code, /choseWinner: seat === null \? null : seat !== 'lose',/);
});
