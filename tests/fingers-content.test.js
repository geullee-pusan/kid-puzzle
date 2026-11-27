// 손가락 더하기 대본 점검: 화면에 나오는 글이 약속을 지키는지, "왜 그럴까?"의 그림과 말이 풀이 프로그램과 다른 방법으로 따라간 것과 맞는지 본다.
// 한 일과 사실만 말한다(틀렸다고 하지 않는다), 힌트는 두 높이, 규칙은 세 문장 안, 시계 대신 친 횟수를 보인다.
// 수학의 이름("5로 나눈 나머지")은 다시 도는 판을 끝까지 둔 뒤 "왜 그럴까?"의 마지막 장에서만 말한다.
// 화면 코드와 틀에 이 형식이 이어져 있는지도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { LADDER } from '../src/core/fingers-ladder.js';
import { LIMITS, checkBoard, moveValues, replay, solve, stateValue } from '../src/core/fingers.js';
import { fill, sentenceCount } from '../src/core/text.js';
import { bruteValue } from './helpers/brute-fingers.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/fingers.json'));
const html = read('index.html');
const code = read('src/formats/fingers.js');
const board = read('src/ui/fingers-board.js');
const css = read('src/app.css');

const VALUES = { k: 3, n: 5, no: '첫 ' };
/** 그림과 판의 값은 글이 아니다 */
const DATA_KEYS = ['picture', 'blank', 'board', 'trail', 'rings', 'level', 'wrap'];

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
const own = [part('id="fingers-title"', 'id="signs-title"'), part('id="fingers-count"', 'id="signs-count"'), part('id="fingers-pad"', 'id="signs-pad"'), part('id="fingers-swap"', 'id="fair-reason-box"'), part('id="make-fingers"', 'id="make-signs"')].map(visibleText).join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const said = strings.map(([, text]) => text).join(' ');

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 단계 목록이 사다리와 같다. 판 고르기의 그림은 규칙대로 친 판이다', () => {
  assert.equal(T.title, '손가락 더하기');
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.deepEqual(T.levels.map((item) => item.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(T.levels.map((item) => item.name), ['손가락 더하기', '선생님이 잘 치는 판', '몇 번만 남은 판', '다섯에서 다시 도는 판', '먼저 칠까, 나중에 칠까?', '직접 만들기']);
  for (const entry of T.levels.filter((item) => !item.picture.blank)) {
    assert.equal(checkBoard(entry.picture.board), null, entry.name);
    const now = replay(entry.picture.board, entry.picture.trail, entry.picture.board.first ?? 'kid');
    assert.deepEqual([now.ok, now.over], [true, false], entry.name);
  }
  // 그림의 규칙은 그 단계의 판과 같다(4단계만 다시 도는 판, 5단계는 여섯이 되면 빠지는 판도 있다)
  assert.equal(T.levels[3].picture.board.wrap, true);
  assert.ok(T.levels.filter((item) => item.level !== 4 && !item.picture.blank).every((item) => item.picture.board.wrap === false));
  assert.deepEqual(Object.keys(T.home.ask).sort(), ['choose', 'fair', 'first', 'left', 'wrap']);
  assert.deepEqual(Object.keys(T.hints).sort(), ['choose', 'fair', 'first', 'left', 'made', 'wrap']);
  for (const rung of LADDER) assert.ok(T.hints[rung.hint], rung.hint);
});

test('규칙은 세 문장 안이고, 치면 친 손가락 수만큼 늘어나는 것, 빠지는 때, 두 손이 다 빠지면 지는 것을 말한다. 다시 도는 규칙은 같은 모습이면 비기는 것도 말한다', () => {
  for (const rule of ['basic', 'wrap']) {
    const text = fill(T.rules[rule], { n: 5 });
    assert.ok(sentenceCount(text) <= 3, text);
    assert.match(text, /^내 손 하나로 선생님 손 하나를 치면, 그 손에 내 손가락 수만큼 손가락이 늘어요\./);
  }
  assert.match(fill(T.rules.basic, { n: 5 }), /손가락이 5개가 되거나 넘으면 그 손은 빠져요\. 두 손이 다 빠지면 져요\.$/);
  assert.match(fill(T.rules.wrap, { n: 5 }), /꼭 5개가 되면 그 손은 빠지고, 넘으면 넘은 만큼만 남아요\. 두 손이 다 빠지면 지고, 같은 모습이 다시 나오면 비겨요\.$/);
  // 규칙 글의 빠지는 수는 판에서 온다
  assert.match(code, /ruleLine: \(round\) => fill\(T\.rules\[ruleOf\(round\.board\)\], \{ n: round\.board\.limit \}\),/);
  // 직접 만들기의 안내 글도 세 문장 안이다(형식마다 하나, 이 형식이 맨 뒤). 나중에 치는 쪽이 이기는 판을 만들어 보라고 권한다
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 51);
  const mine = guides[44];
  assert.ok(sentenceCount(mine) <= 3, mine);
  assert.match(mine, /^빠지는 수와 규칙을 정하고, 손을 눌러 손가락을 펴요\./);
  assert.match(mine, /나중에 치는 쪽이 이기는 판을 만들 수 있을까요\?$/);
});

test('시계가 아니라 친 횟수를 보인다. 점수, 별, 연달아 이긴 수가 없다', () => {
  const foot = visibleText(part('id="fingers-count"', 'id="signs-count"'));
  assert.match(foot, /친 횟수\s+0\s+번/);
  assert.match(code, /\$\('fingers-taps'\)\.textContent = String\(now\.moves\.length\);/);
  assert.doesNotMatch(code + board, /setInterval|requestAnimationFrame|Date\.now|performance\.now/);
  for (const line of code.split('\n')) if (/textContent/.test(line)) assert.doesNotMatch(line, /refuseCount|replayCount|lostStreak|finishedCount/, line.trim());
  assert.doesNotMatch(own, /별|점수|순위|레벨|연속|시간|초/);
  const counting = /\{[a-z]+\}번 (이겼|졌)|몇 번 (이겼|졌)|판째|연달아|이긴 판|진 판|승|패/;
  for (const [path, text] of strings) assert.doesNotMatch(text, counting, path);
});

test('한 일과 사실만 말한다. 판정하는 말, 칭찬 낱말, 꾸미는 말이 없다. 고르기가 맞았는지는 말하지 않는다', () => {
  assert.doesNotMatch(said, /틀렸|틀린|아니에요|땡|정답|아쉽|아깝|실수|실패|성공|잘했|훌륭|대단|최고|멋져|멋진|완벽|축하|천재|똑똑|굉장|맞아요|맞혔|만세|야호|우와/);
  assert.doesNotMatch(own, /틀렸|틀린|아니에요|땡|아쉽|실패|잘했|훌륭|대단|최고|멋/);
  assert.deepEqual([T.right.kid, T.right.teacher, T.right.draw], ['선생님의 두 손이 다 빠졌어요. 이번 판은 내가 이겼어요.', '내 두 손이 다 빠졌어요. 이번 판은 선생님이 이겼어요.', '같은 모습이 다시 나왔어요. 이번 판은 비겼어요.']);
  // 이긴 판도 진 판도 비긴 판도 끝까지 둔 판으로 똑같이 끝낸다
  assert.equal([...code.matchAll(/frame\.finish\(/g)].length, 1);
  assert.match(code, /round\.winner = after\.winner;/);
  assert.doesNotMatch(code + board, /Math\.random|confetti|firework|celebrat/i);
  assert.match(code, /correct: 잘 치면 지지 않는 자리를 골랐는가\. 화면에서는 알리지 않는다/);
  // 덧붙이는 말은 하나만 한다
  assert.match(code, /if \(finishedCount\(records\) === WHY_AFTER\) parts\.push\(T\.right\['why-invite'\]\);\n(\s*\/\/[^\n]*\n)*\s*else if \(could\) parts\.push\(T\.right\[`could-\$\{seat\}`\]\);/);
  // 칠 수 없는 손을 누르면 까닭 하나를 판 아래에 적는다(치지 않는다)
  assert.deepEqual([T.status['mine-out'], T.status['theirs-out'], T.status['mine-first']], ['빠진 손으로는 칠 수 없어요', '빠진 손은 칠 수 없어요', '먼저 칠 내 손을 하나 골라요']);
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
      assert.doesNotMatch(hint, /때문|해야 해요|하면 돼요|늘 |\d|나머지|먼저 치는 쪽이|나중에 치는 쪽이/, hint);
    }
  }
  // 직접 만든 판의 힌트 1은 "더 작은 판"이 아니다
  assert.doesNotMatch(T.hints.made[0], /더 작은 판/);
  assert.match(code, /hints: \(round\) => T\.hints\[round\.custom \? 'made' : rungOf\(round\.level\)\.hint\],/);
});

test('글의 빈칸({이름})은 정해진 이름만 쓰고, 화면 글에 영어 낱말이 없고, "~요"로 끝나는 말투다. 한 문장은 60자를 넘지 않는다', () => {
  const allowed = new Set(['k', 'f', 'n', 'no', 'total', 'level', 'tag', 'face']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
    assert.doesNotMatch(text.replace(/\{[^{}]*\}/g, ''), /[A-Za-z]/, `${path}: ${text}`);
  }
  assert.doesNotMatch(own, /[A-Za-z]/);
  assert.equal(fill(T.handLabel.kid[1], { k: 3 }), '내 오른손, 손가락 3개');
  const spoken = [...Object.values(T.home.ask), T.home.pick, ...Object.values(T.rules), ...Object.values(T.play), ...Object.values(T.hints).flat(), ...Object.values(T.right), ...allStrings(T.hit).map(([, text]) => text), ...allStrings(T.solution).filter(([path]) => !path.startsWith('note')).map(([, text]) => text), T.make.intro, T.make.placing, T.make.changed, T.make['keep-not-yet'], ...Object.values(T.make.check), ...T.why.map((slide) => slide.say), T.replay.start, T.replay.turn, T.replay.repeat, T.replay['repeat-start'], T.replay.last];
  for (const text of spoken) for (const sentence of sentences(fill(text, VALUES))) assert.match(sentence, /요[.?!]$/, sentence);
  for (const group of [T.status, T.firsts, T.turn, T.limitLine]) for (const text of Object.values(group)) assert.match(text, /요$/, text);
  for (const slide of T.why) for (const item of slide.figures) assert.match(item.note, /요$/, item.note);
  for (const [path, text] of strings) for (const sentence of sentences(fill(text, VALUES))) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

/** 그림 하나를 따라간 끝 */
const endOf = (item) => replay(item.board, item.trail, item.board.first);
/** 그 그림에서 칠 차례인 쪽의 값(풀이 프로그램)과 다른 방법으로 구한 값 */
function valuesOf(item) {
  const now = endOf(item);
  const mine = now.next === 'kid' ? now.kid : now.teacher;
  const theirs = now.next === 'kid' ? now.teacher : now.kid;
  const board = { ...item.board, kid: now.next === 'kid' ? mine : theirs, teacher: now.next === 'kid' ? theirs : mine };
  return { next: now.next, mine: stateValue(item.board.limit, item.board.wrap, mine, theirs), brute: bruteValue(board, now.next) };
}

test('"왜 그럴까?" 1장: 다섯 판은 둘 다 잘 치면 먼저 치는 쪽이 진다. 첫 수는 어디를 쳐도 둘인 손이 하나 생긴다', () => {
  assert.equal(T.why.length, 6);
  for (const slide of T.why) assert.ok(sentenceCount(slide.say) <= 3, slide.say);
  const [first, after] = T.why[0].figures;
  assert.deepEqual(valuesOf(first).mine.outcome, 'lose');
  assert.deepEqual(valuesOf(first).brute.outcome, 'lose');
  assert.match(T.why[0].say, /둘 다 잘 치면 먼저 치는 쪽이 졌어요\./);
  // 네 가지 첫 수가 모두 같은 모습(1과 2)이 된다
  const shapes = moveValues(first.board, []).map((item) => [...replay(first.board, [item.move]).teacher].sort().join(''));
  assert.deepEqual([...new Set(shapes)], ['12']);
  assert.deepEqual([...endOf(after).teacher].sort(), [1, 2]);
});

test('"왜 그럴까?" 2장: 손이 하나만 남은 이 모습에서는 어디를 쳐도 선생님 손이 셋이 되고, 그 셋에 맞아 내 손이 빠진다', () => {
  const [before, hit, end] = T.why[1].figures;
  assert.deepEqual([before.board.kid, before.board.teacher], [[0, 2], [1, 1]]);
  const values = moveValues(before.board, []);
  assert.ok(values.every((item) => item.outcome === 'lose' && item.plies === 2));
  for (const item of values) assert.ok(replay(before.board, [item.move]).teacher.includes(3));
  assert.ok(endOf(hit).teacher.includes(3));
  const last = endOf(end);
  assert.deepEqual([last.over, last.winner, last.moves.at(-1).power], [true, 'teacher', 3]);
});

test('"왜 그럴까?" 3장: 두 번째 사람이 손가락 하나인 손으로 치면 먼저 친 사람이 어떻게 쳐도 지는 모습이 되고, 둘인 손으로 치면 반대다', () => {
  const [one, two] = T.why[2].figures;
  for (const item of [one, two]) assert.equal(item.board.first, 'teacher');
  const a = valuesOf(one);
  const b = valuesOf(two);
  assert.deepEqual([a.next, a.mine.outcome, a.brute.outcome], ['teacher', 'lose', 'lose']);
  assert.deepEqual([b.next, b.mine.outcome, b.brute.outcome], ['teacher', 'win', 'win']);
  // 고리를 두른 손이 친 손이고, 그 손의 손가락이 하나, 둘이다
  for (const [item, power] of [[one, 1], [two, 2]]) {
    const move = endOf(item).moves.at(-1);
    assert.deepEqual([move.side, move.power], ['kid', power]);
    assert.deepEqual(item.rings, [{ side: 'kid', index: move.from }]);
  }
});

test('"왜 그럴까?" 4장: 넷이 되면 빠지는 판과 여섯이 되면 빠지는 판은 먼저 치는 쪽이 이긴다(까닭이 그대로는 통하지 않는 판)', () => {
  const limits = T.why[3].figures.map((item) => item.board.limit);
  assert.deepEqual(limits, [4, 6]);
  for (const item of T.why[3].figures) {
    const value = valuesOf(item);
    assert.deepEqual([value.next, value.mine.outcome, value.brute.outcome], ['kid', 'win', 'win']);
  }
  assert.match(T.why[3].say, /어디서 봤지요\?$/);
});

test('"왜 그럴까?" 5~6장(다시 도는 판을 끝까지 둔 뒤에만): 둘 다 잘 치면 끝나지 않는다. 넘은 만큼 남는 덧셈의 이름(5로 나눈 나머지)은 마지막 장에서만 말한다', () => {
  assert.deepEqual(T.why.map((slide) => slide.wrap === true), [false, false, false, false, true, true]);
  assert.equal(solve({ limit: 5, wrap: true, kid: [1, 1], teacher: [1, 1], first: 'kid' }).kid, 'draw');
  assert.match(T.why[4].say, /둘 다 잘 치면 끝나지 않고 같은 모습이 다시 나와요\./);
  const [, three] = T.why[4].figures;
  assert.deepEqual([endOf(three).moves.at(-1).before, endOf(three).moves.at(-1).power, endOf(three).moves.at(-1).after], [4, 3, 2]);
  const [eight, five] = T.why[5].figures;
  assert.deepEqual([endOf(eight).moves.at(-1).before + endOf(eight).moves.at(-1).power, endOf(eight).moves.at(-1).after], [8, 3]);
  assert.deepEqual([endOf(five).moves.at(-1).before + endOf(five).moves.at(-1).power, endOf(five).moves.at(-1).after], [5, 0]);
  assert.equal(7 % 5, 2);
  assert.match(T.why[5].say, /5로 나눈 나머지라고 불러요\. 7을 5로 나누면 나머지가 2예요\./);
  // 이름은 마지막 장에만 있다(규칙, 힌트, 판, 다른 장에는 없다)
  for (const [path, text] of strings) if (path !== 'why[5].say') assert.doesNotMatch(text, /나머지|나누면|나눈/, path);
  assert.doesNotMatch(visibleText(html), /나머지/);
  assert.match(code, /\.filter\(\(slide\) => !slide\.wrap \|\| wrap\)/);
});

test('풀이와 직접 만들기: 먼저 치는 쪽부터 둘 다 잘 치면 어떻게 끝나는지와 치는 횟수를 말한다', () => {
  assert.equal(T.solution['kid-win'], '내가 먼저 치면, 둘 다 잘 칠 때 내가 이겨요.');
  assert.equal(fill(T.solution.taps, { k: 8 }), '모두 8번 치면 끝나요.');
  assert.match(code, /const line = endLine\(board\.first, result\.value, result\.taps\[board\.first\]\);/);
  const make = part('id="make-fingers"', 'id="make-signs"');
  for (const id of ['fingers-make-limit-fewer', 'fingers-make-limit', 'fingers-make-limit-more', 'fingers-make-rule-basic', 'fingers-make-rule-wrap', 'fingers-make-first-kid', 'fingers-make-first-teacher', 'fingers-make-board', 'fingers-make-placing', 'fingers-make-solve', 'fingers-make-result', 'fingers-make-play']) {
    assert.ok(make.includes(`id="${id}"`), id);
  }
  assert.match(make, /id="fingers-make-solve"[^>]*>선생님, 누가 이길까요\?</);
  assert.match(make, /id="fingers-make-play"[^>]*>내가 해 볼래요</);
  assert.match(code, /\n {4}madeBoard,\n/);
  assert.deepEqual(LIMITS, { min: 3, max: 6 });
});

test('index.html: 이 형식의 카드, 판, 판 아래, 오른쪽 칸, 끝난 뒤의 단추, 직접 만들기가 있다. 틀에 이어져 있다', () => {
  for (const id of ['home-fingers-sample', 'home-fingers-ask', 'home-fingers-play', 'home-fingers-pick', 'home-fingers-make', 'home-fingers-blank', 'fingers-board', 'fingers-count', 'fingers-status', 'fingers-taps', 'fingers-pad', 'fingers-limit-line', 'fingers-first-line', 'fingers-order', 'fingers-first', 'fingers-second', 'fingers-turn-box', 'fingers-turn', 'fingers-swap', 'fingers-replay', 'make-fingers']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(part('id="fingers-title"', '</section>'), /<h2 id="fingers-title">손가락 더하기<\/h2>/);
  assert.ok(visibleText(part('id="fingers-title"', '</section>')).includes(T.home.ask.first));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-fingers-make" class="menu-item"/);
  const pad = part('id="fingers-pad"', 'id="signs-pad"');
  assert.match(pad, /id="fingers-first"[^>]*>먼저 칠래요</);
  assert.match(pad, /id="fingers-second"[^>]*>나중에 칠래요</);
  // 카드는 도미노 깔기 모두 찾기 다음, 퍼즐 만들기 앞이다
  assert.ok(html.indexOf('id="tilings-title"') < html.indexOf('id="fingers-title"'));
  assert.ok(html.indexOf('id="fingers-title"') < html.indexOf('id="make-title"'));
  // 틀이 형식을 안다(도미노 깔기 모두 찾기 다음)
  assert.match(read('src/main.js'), /tilings: createTilings\(frame\), fingers: createFingers\(frame\), /);
  assert.match(read('src/check-main.js'), /\['fingers', '손가락 더하기'\]/);
  assert.match(read('src/core/smaller.js'), /tilings: smallerTilings, fingers: smallerFingers, /);
  assert.match(code, /smaller: \(round, turn\) => smallerFingers\(\{ mode: round\.mode, board: round\.board \}, turn\),/);
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
  // 무르기와 되돌리기가 없다(선생님과 치는 게임). 규칙 글은 왼쪽 칸에 둔다
  assert.match(code, /\$\('undo'\)\.hidden = true;\s*\$\('reset'\)\.hidden = true;/);
  assert.match(code, /ruleAside: true,/);
});

test('화면: 손 하나의 누르는 자리는 1180×820에서 44픽셀보다 크다. 내 손, 선생님 손, 빠진 손은 색만이 아니라 모양으로도 보인다. 움직임은 짧고 줄일 수 있다', () => {
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const width = Number(board.match(/export const WIDTH = (\d+);/)[1]);
  const height = Number(board.match(/export const HEIGHT = (\d+);/)[1]);
  const handW = Number(board.match(/export const HAND_W = (\d+);/)[1]);
  const handH = Number(board.match(/export const HAND_H = (\d+);/)[1]);
  // 판 칸은 1180×820 화면에서 높이 430픽셀쯤, 너비 340픽셀쯤이다(규칙 글이 왼쪽 칸에 있다). 높이 380픽셀, 너비 300픽셀로 잡아도
  const scale = Math.min(380 / height, 300 / width);
  assert.ok(handW * scale >= 44 && handH * scale >= 44, `손 ${handW * scale}×${handH * scale}`);
  // 선생님 손은 점선과 줄무늬 소매, 빠진 손은 회색 점선 주먹이고 "빠짐"을 적는다
  assert.match(plain, /\.fg-teacher \.fg-finger,\s*\.fg-teacher \.fg-palm \{[^}]*stroke-dasharray/);
  assert.match(board, /'fg-stripe'/);
  assert.match(plain, /\.fg-out \.fg-finger,[^{]*\{[^}]*stroke-dasharray/);
  assert.match(board, /word\.textContent = names\.out;/);
  // 맞은 손이 흔들리는 움직임은 0.6초보다 짧고, 움직임을 줄이는 설정이면 없다
  const [, seconds] = plain.match(/\.fg-bump \{[^}]*animation: fg-bump ([\d.]+)s/);
  assert.ok(Number(seconds) <= 0.6);
  assert.match(plain, /@media \(prefers-reduced-motion: reduce\) \{\s*\.fg-bump \{\s*animation: none;/);
  // 그림과 표시는 누르는 것을 가로막지 않는다. 손을 글자판으로도 누를 수 있다
  assert.match(plain, /\.fg-hand,\s*\.fg-count,[^{]*\{\s*pointer-events: none;/);
  assert.match(board, /group\.setAttribute\('role', 'button'\);/);
});

/** 끝까지 둔 게임의 기록 하나 */
function finished(more = {}) {
  return { kind: 'round', id: `r-${more.id ?? 1}`, format: 'fingers', level: 1, seed: 1, custom: false, mode: 'game', outcome: 'solved', hintsOpened: 0, answers: [], moveCount: 4, seconds: 60, chose: false, assigned: true, choseWinner: true, winner: 'kid', rematch: false, solution: { possible: true }, ...more };
}

test('수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다. 지지 않는 자리에서 이긴 판이 "한 번에 빠르게"다. "왜 그럴까?"는 게임을 두 판 끝까지 둔 뒤에 열린다', () => {
  const tuning = tuningFor('fingers');
  assert.deepEqual([tuning.startLevel, tuning.bottomLevel, tuning.topLevel, tuning.hintCount, tuning.fastWin, tuning.whyAfter], [1, 1, 5, 2, true, 'finished']);
  assert.match(read('src/core/level.js'), /손가락 더하기\(모두 임시\)/);
  assert.deepEqual(recommend([], 'fingers'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  assert.deepEqual(recommend([finished({ id: 1 }), finished({ id: 2 })], 'fingers'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  for (const more of [{ winner: 'draw' }, { choseWinner: false }, { rematch: true }, { hintsOpened: 1 }]) assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, ...more })], 'fingers').offerHarder, false, JSON.stringify(more));
  assert.equal(whyUnlocked([finished()], 'fingers'), true);
  assert.match(code, /if \(!whyOpen\(records\)\) return null;/);
  assert.match(code, /choseWinner: seat === null \? null : seat !== 'lose',/);
});
