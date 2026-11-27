// 수열 길 퍼즐 대본 점검: 화면에 나오는 글이 약속을 지키는지, "왜 그럴까?"의 그림이 풀이 프로그램과 다른 방법으로 맞는지 본다.
// 한 일과 사실만 말한다(틀렸다고 하지 않는다), 힌트는 두 높이, 규칙은 세 문장 안, 색만으로 알리지 않는다.
// 화면 코드와 틀에 이 형식이 이어져 있는지도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { LADDER, generateBoard } from '../src/core/seqpath-ladder.js';
import { checkBoard, countSolutions, isDone, judgePath, neighbours, pathsKey, pathsOk } from '../src/core/seqpath.js';
import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { fill, sentenceCount } from '../src/core/text.js';
import { bruteCount } from './helpers/brute-seqpath.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/seqpath.json'));
const html = read('index.html');
const code = read('src/formats/seqpath.js');
const board = read('src/ui/seqpath-board.js');
const css = read('src/app.css');

const VALUES = { k: 7, f: '3', n: 2, no: '첫 ', face: '3, 5, 8', total: 4 };
/** 그림과 판의 값은 글이 아니다 */
const DATA_KEYS = ['picture', 'blank', 'seed', 'board', 'paths', 'rings', 'level'];

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
const own = [part('id="seqpath-title"', 'id="pancake-title"'), part('id="seqpath-board"', '</div>\n          <div class="board-foot">'), part('id="seqpath-count"', 'id="pancake-count"'), part('id="seqpath-pad"', 'id="pancake-pad"'), part('id="make-seqpath"', 'id="make-pancake"')].map(visibleText).join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const said = strings.map(([, text]) => text).join(' ');

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 단계 목록이 사다리와 같다', () => {
  assert.equal(T.title, '수열 길 퍼즐');
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.deepEqual(T.levels.map((item) => item.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(T.levels.map((item) => item.name), ['4×4 판', '5×5 판', '모든 길이 같은 간격', '6×6 판', '8×8 판', '직접 만들기']);
  for (const entry of T.levels) assert.ok(entry.picture.blank === true || Number.isInteger(entry.picture.seed), entry.name);
  for (const entry of T.levels.filter((item) => !item.picture.blank)) assert.equal(checkBoard(generateBoard(entry.level, entry.picture.seed).board), null);
  // 처음 화면의 물음은 판의 종류마다 있다
  assert.deepEqual(Object.keys(T.home.ask).sort(), ['eight', 'five', 'four', 'same', 'six']);
});

test('한 일과 사실만 말한다. 판정하는 말, 칭찬 낱말, 식과 용어가 없다', () => {
  assert.doesNotMatch(said, /틀렸|틀린|아니에요|땡|정답|아쉽|실수|실패|성공|잘했|훌륭|대단|최고|멋져|멋진|완벽|축하|천재|똑똑|굉장|맞아요|맞혔/);
  assert.doesNotMatch(own, /틀렸|틀린|아니에요|땡|아쉽|실패|잘했|훌륭|대단|최고|멋/);
  // 등차수열의 용어와 식은 쓰지 않는다(형식의 이름에만 "수열"이 있다).
  // 수학의 이름(등차수열, 공차)은 "왜 그럴까?"의 마지막 장에서만 붙인다. 그 장에서도 n번째 항의 식이나 공식은 없다
  const last = `why[${T.why.length - 1}]`;
  const before = strings.filter(([path]) => !path.startsWith(last)).map(([, text]) => text).join(' ');
  assert.doesNotMatch(before.replace(T.title, ''), /수열|등차|공차|항|n번째|공식/);
  assert.doesNotMatch(own.replaceAll(T.title, ''), /수열|등차|공차|공식/);
  for (const [path, text] of strings) if (path.startsWith(last)) assert.doesNotMatch(text, /항|n번째|공식/, path);
  const named = strings.filter(([, text]) => /등차|공차/.test(text)).map(([path]) => path);
  assert.ok(named.length > 0 && named.every((path) => path.startsWith(last)), named.join(', '));
  assert.doesNotMatch(visibleText(html), /등차|공차/);
  // 수의 차례가 어긋난 길에는 그 길이 지나는 수와 뛰는 크기만 말한다
  assert.equal(fill(T.play.jumps, { face: '3, 5, 8', n: 2, k: 3 }), '이 길은 3, 5, 8 차례로 지나요. 뛰는 크기가 2인 곳과 3인 곳이 있어요.');
  assert.equal(fill(T.play.turn, { face: '3, 5, 4' }), '이 길은 3, 5, 4 차례로 지나요. 커지는 곳과 작아지는 곳이 있어요.');
  assert.match(code, /return fill\(T\.play\[judged\.why\], \{ face: judged\.numbers\.join\(', '\), n: sizes\[0\], k: other \}\);/);
  // 사실 하나와 할 수 있는 일 하나
  assert.match(T.play['numbers-used'], /남았어요\. 길 하나를 지우고 다르게 그을 수 있어요\.$/);
  assert.match(T.play.covered, /그 길을 지우고 다시 그을 수 있어요\.$/);
  assert.doesNotMatch(code, /Math\.random/);
  assert.doesNotMatch(board, /Math\.random/);
  // 판 아래에는 그은 길과 남은 칸만 적는다(몇 번 그었는지, 지웠는지, 물렀는지 적지 않는다)
  for (const line of code.split('\n')) if (/textContent/.test(line)) assert.doesNotMatch(line, /strokeCount|eraseCount|undoCount|resetCount|brokenCount|wrongCount|missCount/, line.trim());
});

test('무르기, 처음으로, 지우기 뒤에는 앞의 말을 덮는 한마디를 한다', () => {
  assert.equal(T.play.undo, '무르기 전 모습으로 돌아왔어요.');
  assert.equal(T.play.reset, '길을 모두 지웠어요.');
  assert.equal(T.play.erase, '길 하나를 지웠어요.');
  assert.match(code, /frame\.say\(T\.play\.undo\);/);
  assert.match(code, /frame\.say\(T\.play\.reset\);/);
  assert.match(code, /frame\.say\(T\.play\.erase\);/);
});

test('규칙 설명은 세 문장 안이다. 판의 종류마다 있다. 직접 만들기의 안내 글도 세 문장 안이다', () => {
  assert.deepEqual(Object.keys(T.rules).sort(), ['paths', 'same']);
  for (const [key, rule] of Object.entries(T.rules)) {
    assert.ok(sentenceCount(rule) <= 3, key);
    // 셋 이상, 수에서 시작해 수에서 끝, 겹치지 않고 모든 칸
    assert.match(rule, /수를 셋 이상 지나고, 수에서 시작해 수에서 끝나요\./, key);
    assert.match(rule, /길은 겹치지 않고 모든 칸을 지나야 해요\.$/, key);
  }
  assert.match(code, /const ruleKey = \(round\) => \(round\.mode === 'same' \? 'same' : 'paths'\);/);
  assert.match(code, /ruleLine: \(round\) => T\.rules\[ruleKey\(round\)\],/);
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 56);
  assert.ok(sentenceCount(guides[28]) <= 3, guides[28]);
  assert.match(guides[28], /길을 잇는 방법이 한 가지뿐인 판도 만들 수 있을까요\?$/);
});

test('힌트는 판의 종류마다 두 개이고, 하나하나가 질문 한 문장이다. 답을 말해 버리지 않는다', () => {
  assert.deepEqual(Object.keys(T.hints).sort(), ['paths', 'same']);
  for (const [key, list] of Object.entries(T.hints)) {
    assert.equal(list.length, 2, key);
    assert.notEqual(list[0], list[1]);
    for (const hint of list) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
      assert.doesNotMatch(hint, /때문|해야 해요|하면 돼요|늘 |\d|구석부터 보기|꺾/, hint);
    }
  }
  // 힌트 1은 모든 형식이 함께 쓰는 짧은 목록에서, 힌트 2는 어디를 볼지
  assert.equal(T.hints.paths[0], '아직 한 번도 건드리지 않은 곳이 있나요?');
  assert.equal(T.hints.same[0], '아까와 다른 곳에서 시작하면 어떻게 되나요?');
  assert.match(code, /hints: \(round\) => T\.hints\[ruleKey\(round\)\],/);
});

test('글의 빈칸({이름})은 정해진 이름만 쓰고, 채울 값이 모자라지 않는다', () => {
  const allowed = new Set(['k', 'f', 'n', 'no', 'total', 'level', 'tag', 'face']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
    assert.ok(fill(text, VALUES).length > 0, path);
  }
  assert.equal(fill(T.labels.cell, { no: '첫 ', f: '3', face: fill(T.labels.passed, { face: fill(T.labels.number, { n: 12 }) }) }), '첫 번째 줄 3번째 칸, 수 12, 길이 지나가는 칸');
  assert.equal(fill(T.make.many, { n: 10 }), '길을 잇는 방법이 10가지보다 많아요. 그 가운데 한 가지를 보여 줄게요.');
});

test('화면 글에 영어 낱말과 보상 낱말이 없고, "~요"로 끝나는 말투다. 한 문장은 60자를 넘지 않는다', () => {
  for (const [path, text] of strings) assert.doesNotMatch(text.replace(/\{[^{}]*\}/g, ''), /[A-Za-z]/, `${path}: ${text}`);
  assert.doesNotMatch(own, /[A-Za-z]/);
  assert.doesNotMatch(own, /별|점수|순위|레벨|연속/);
  const spoken = [...Object.values(T.home.ask), T.home.pick, ...Object.values(T.rules), ...Object.values(T.play), ...Object.values(T.hints).flat(), ...Object.values(T.right), ...Object.values(T.solution), ...Object.entries(T.make).filter(([key]) => key !== 'size').map(([, text]) => text), ...T.why.map((slide) => slide.say)];
  for (const text of spoken) for (const sentence of sentences(text)) assert.match(sentence, /요[.?!]$/, sentence);
  for (const text of Object.values(T.status)) assert.match(text, /요$/, text);
  for (const slide of T.why) for (const item of slide.figures) assert.match(item.note, /요$/, item.note);
  for (const [path, text] of strings) for (const sentence of sentences(fill(text, VALUES))) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

/** 구석 칸인가 */
const corner = (item, cell) => neighbours(item, cell).length === 2;

test('"왜 그럴까?": 수만 보고 이어 구석 빈칸이 남은 이야기 → 구석 칸의 옆 칸은 둘 → 구석 빈칸에서 길이 꺾인다(이름) → 수가 적힌 구석은 끝일 수도 꺾일 수도 있다', () => {
  assert.equal(T.why.length, 5);
  for (const slide of T.why) assert.ok(sentenceCount(slide.say) <= 3, slide.say);
  for (const slide of T.why) for (const item of slide.figures) {
    assert.equal(checkBoard(item.board), null, item.note);
    assert.ok(pathsOk(item.board, item.paths) || item.paths.length === 0, item.note);
  }
  const [one, two, three, four, five] = T.why.map((slide) => slide.figures);
  const story = one[0].board;
  // 첫 장~셋째 장은 같은 판이고, 답은 하나다(다른 방법으로 센다)
  for (const item of [two[0], three[0]]) assert.deepEqual(item.board, story);
  const all = bruteCount(story);
  assert.equal(all.count, 1);
  // 첫 장: 1에서 가운데 빈칸을 지나 2, 3으로 간 길(약속에 맞는 길)이고, 짚은 구석 빈칸은 이제 길이 지나갈 수 없다(옆 칸이 모두 그 길에 있다)
  const [tried] = one[0].paths;
  assert.equal(judgePath(story, tried).ok, true);
  assert.deepEqual(judgePath(story, tried).numbers, [1, 2, 3]);
  assert.equal(story.values[tried[1]], null);
  assert.equal(tried[1], 4);
  const [left] = one[0].rings;
  assert.ok(corner(story, left) && story.values[left] === null && !tried.includes(left));
  for (const other of neighbours(story, left)) assert.ok(tried.includes(other));
  // 그 길을 그대로 두고는 끝낼 수 없다
  assert.ok(all.solutions.every((paths) => !paths.some((path) => pathsKey([path]) === pathsKey([tried]))));
  assert.match(T.why[0].say, /^선생님도 처음에는 수만 보고 이었어요\./);
  // 둘째 장: 짚은 칸은 구석 빈칸의 두 옆 칸이다
  assert.deepEqual([...two[0].rings].sort((a, b) => a - b), neighbours(story, left).sort((a, b) => a - b));
  // 셋째 장: 판의 답이고, 구석 빈칸에서 길이 꺾인다(두 옆 칸이 그 칸의 앞뒤에 있다)
  assert.equal(isDone(story, three[0].paths), true);
  assert.equal(pathsKey(three[0].paths), pathsKey(all.solutions[0]));
  const bend = three[0].paths.find((path) => path.includes(left));
  const at = bend.indexOf(left);
  assert.ok(at > 0 && at < bend.length - 1);
  assert.deepEqual([bend[at - 1], bend[at + 1]].sort((a, b) => a - b), neighbours(story, left).sort((a, b) => a - b));
  assert.match(T.why[2].say, /구석부터 보기라고 불러요\.$/);
  // 넷째 장: 수가 적힌 구석. 한 판에서는 길의 끝, 다른 판에서는 꺾이는 곳이다. 두 판 모두 답이 하나이고 그림이 그 답이다
  const roles = four.map((item) => {
    const answer = bruteCount(item.board);
    assert.equal(answer.count, 1, item.note);
    assert.equal(pathsKey(item.paths), pathsKey(answer.solutions[0]), item.note);
    const [cell] = item.rings;
    assert.ok(corner(item.board, cell) && item.board.values[cell] !== null, item.note);
    const path = item.paths.find((one) => one.includes(cell));
    return path[0] === cell || path.at(-1) === cell ? 'end' : 'bend';
  });
  assert.deepEqual(roles, ['end', 'bend']);
  // 다섯째 장(마지막, 수학의 이름): 넷째 장의 첫 판을 다 이은 모습이고(답은 하나), 두 길은 2, 4, 6과 3, 5, 7로 둘 다 2씩 커진다
  const [named] = five;
  assert.deepEqual(named.board, four[0].board);
  assert.equal(isDone(named.board, named.paths), true);
  assert.equal(pathsKey(named.paths), pathsKey(bruteCount(named.board).solutions[0]));
  assert.equal(bruteCount(named.board).count, 1);
  const lines = named.paths.map((path) => judgePath(named.board, path));
  assert.deepEqual(lines.map((line) => line.numbers), [[2, 4, 6], [3, 5, 7]]);
  for (const line of lines) {
    assert.equal(line.ok, true);
    assert.equal(line.step, 2);
    // 뛰는 크기를 따로 다시 잰다: 이웃한 두 수의 차가 모두 2다
    for (let index = 1; index < line.numbers.length; index++) assert.equal(line.numbers[index] - line.numbers[index - 1], 2);
  }
  assert.deepEqual(named.rings, []);
  assert.equal(named.note, '두 길 모두 2씩 커져요');
  assert.match(T.why[4].say, /^한 길의 수처럼 같은 간격으로 커지거나 작아지는 수의 줄을 수학에서는 등차수열이라고 불러요\./);
  assert.match(T.why[4].say, /커지는 줄에서 뛰는 크기는 공차라고 불러요\./);
  assert.ok(T.why[4].say.endsWith(`${lines[0].numbers.join(', ')}과 ${lines[1].numbers.join(', ')}은 둘 다 공차가 ${lines[0].step}인 등차수열이에요.`));
  // 이름은 "왜 그럴까?"에서만 말한다
  for (const [path, text] of strings) if (!path.startsWith('why')) assert.doesNotMatch(text, /구석부터 보기/, path);
  assert.equal(countSolutions(story, { limit: 5 }).count, 1);
});

test('풀이와 직접 만들기: 방법의 수(위 끝까지)와 그 가운데 한 가지, 끝까지 따지지 못하면 그렇다고 말한다', () => {
  assert.equal(T.solution.one, '길을 잇는 방법은 한 가지뿐이에요. 그 길을 보여 줄게요.');
  assert.match(code, /export const MAKE_LIMIT = 10;/);
  assert.match(code, /const result = countSolutions\(board, \{ limit: MAKE_LIMIT \+ 1, budget: MAKE_BUDGET \}\);/);
  assert.match(code, /if \(!result\.complete && !reached\) line = result\.count === 0 \? T\.make\['far-none'\] : fill\(T\.make\.far, \{ n: result\.count \}\);/);
  assert.match(T.make.none, /모든 방법을 따져 보니/);
  const make = part('id="make-seqpath"', 'id="make-pancake"');
  for (const id of ['seqpath-make-w-fewer', 'seqpath-make-w', 'seqpath-make-w-more', 'seqpath-make-h-fewer', 'seqpath-make-h', 'seqpath-make-h-more', 'seqpath-make-clear', 'seqpath-make-board', 'seqpath-make-keys', 'seqpath-make-solve', 'seqpath-make-result', 'seqpath-make-play', 'seqpath-make-picture']) assert.ok(make.includes(`id="${id}"`), id);
  assert.match(make, /id="seqpath-make-solve"[^>]*>선생님, 길을 잇는 방법이 몇 가지예요\?</);
  assert.match(make, /id="seqpath-make-play"[^>]*>내가 해 볼래요</);
  assert.deepEqual([...part('id="seqpath-make-keys"', 'id="seqpath-make-solve"').matchAll(/data-n="(\w+)"/g)].map((match) => match[1]), ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'erase']);
  assert.match(T.make.intro, /길을 잇는 방법이 몇 가지인지 물어볼 수 있어요\.$/);
  // 직접 만든 판: 방법을 하나라도 찾은 판만 해 본다. 공책에 남기는 판은 수가 셋 이상 적힌 판
  assert.match(code, /mode: custom \? 'made' : rungOf\(level\)\.mode,/);
  assert.match(code, /if \(!solutionOf\(board\)\.possible\) \{\s*frame\.talkers\.make\.say\(T\.make\['play-none'\]\);/);
  assert.match(code, /\n {4}madeBoard,\n/);
  assert.doesNotMatch(code, /bestOf/);
});

test('index.html: 이 형식의 카드, 판, 판 아래, 답하는 칸, 직접 만들기가 있다. 틀에 이어져 있다', () => {
  for (const id of ['home-seqpath-sample', 'home-seqpath-ask', 'home-seqpath-play', 'home-seqpath-pick', 'home-seqpath-make', 'home-seqpath-blank', 'seqpath-board', 'seqpath-count', 'seqpath-status', 'seqpath-paths', 'seqpath-left', 'seqpath-pad', 'make-seqpath']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(part('id="seqpath-title"', '</section>'), /<h2 id="seqpath-title">수열 길 퍼즐<\/h2>/);
  assert.ok(visibleText(part('id="seqpath-title"', '</section>')).includes(T.home.ask.four));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-seqpath-make" class="menu-item"/);
  const pad = part('id="seqpath-pad"', 'id="pancake-pad"');
  assert.match(visibleText(pad), /길을 누르기만 하면 그 길이 지워져요\./);
  // 길의 모양 그림: 굵은 줄, 가는 줄, 끊긴 줄(색만으로 알리지 않는다)
  assert.deepEqual([...pad.matchAll(/class="sp-legend-line (\w+)"/g)].map((match) => match[1]), ['ok', 'open', 'broken']);
  assert.doesNotMatch(pad, /불가능해요/);
  // 카드는 암호 놀이 다음, 퍼즐 만들기 앞이다
  assert.ok(html.indexOf('id="cipher-title"') < html.indexOf('id="seqpath-title"'));
  assert.ok(html.indexOf('id="seqpath-title"') < html.indexOf('id="make-title"'));
  // 틀이 형식을 안다(암호 놀이 다음)
  assert.match(read('src/main.js'), /cipher: createCipher\(frame\), seqpath: createSeqpath\(frame\), /);
  assert.match(read('src/check-main.js'), /\['seqpath', '수열 길 퍼즐'\]/);
  assert.match(read('src/core/smaller.js'), /cipher: smallerCipher, seqpath: smallerSeqpath, /);
  assert.match(code, /smaller: \(round, turn\) => smallerSeqpath\(\{ mode: round\.mode, board: round\.board \}, turn\),/);
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
  // 무르기와 되돌리기가 있다. 판이 위아래로 커서 규칙 글은 왼쪽 칸에 둔다
  assert.match(code, /\$\('undo'\)\.hidden = false;\s*\$\('reset'\)\.hidden = false;/);
  assert.match(code, /ruleAside: true,/);
  // 판을 그리는 조각은 글을 적지 않는다. 타이머가 없다. 누르는 것과 긋는 것, 글자판을 모두 받는다
  assert.doesNotMatch(board, /setInterval|setTimeout/);
  for (const name of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'keydown', 'sp-number', "'sp-picked'", "'sp-ring'"]) assert.ok(board.includes(name), name);
  // 색만으로 알리지 않는다: 약속에 맞는 길은 굵은 실선, 덜 그은 길은 가는 실선, 어긋난 길은 점선. 긋는 동안 판이 굴러가지 않는다
  assert.match(css, /\.sp-path\.ok \{[^}]*stroke-width: 24/);
  assert.match(css, /\.sp-path\.open,\n\.sp-path\.live \{[^}]*stroke-width: 10/);
  assert.match(css, /\.sp-path\.broken \{[^}]*stroke-dasharray/);
  assert.match(css, /\.sp-board\.drawing \.sp-svg \{[^}]*touch-action: none/);
});

/** 끝까지 한 판의 기록 하나 */
function finished(more = {}) {
  return { kind: 'round', id: `r-${more.id ?? 1}`, format: 'seqpath', level: 1, seed: 1, custom: false, mode: 'four', outcome: 'solved', hintsOpened: 0, answers: [{ t: 10, answer: 'done', correct: true, guess: null }], wrongCount: 0, moveCount: 5, seconds: 40, solution: { count: 1, complete: true }, ...more };
}

test('수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다. "왜 그럴까?"는 판을 한 번 끝까지 한 뒤에 열린다', () => {
  const tuning = tuningFor('seqpath');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 5);
  assert.equal(tuning.hintCount, 2);
  assert.equal(tuning.whyAfter, 'finished');
  assert.match(read('src/core/level.js'), /수열 길 퍼즐\(모두 임시\)/);
  assert.deepEqual(recommend([], 'seqpath'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  // 어긋난 길 없이 예상 시간보다 빨리 두 판을 끝내면 더 어려운 판을 권한다
  assert.deepEqual(recommend([finished({ id: 1 }), finished({ id: 2 })], 'seqpath'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, wrongCount: 1 })], 'seqpath').offerHarder, false);
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, seconds: 200 })], 'seqpath').offerHarder, false);
  assert.equal(whyUnlocked([], 'seqpath'), false);
  assert.equal(whyUnlocked([finished()], 'seqpath'), true);
  assert.equal(whyUnlocked([finished({ side: true })], 'seqpath'), false);
  // 기록의 틀린 답: 수의 차례가 어긋난 길을 그은 수
  assert.match(code, /round\.brokenCount \+= 1;\s*round\.wrongCount \+= 1;/);
  assert.match(code, /moveCount: round\.strokeCount,/);
  assert.match(code, /solution: \{ count: solution\.count, complete: solution\.complete, paths: solution\.paths \},/);
});
