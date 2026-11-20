// 열쇠 미로 대본 점검: 화면에 나오는 글이 약속을 지키는지, "왜 그럴까?"의 그림과 말 속의 수가 풀이 프로그램과 맞는지 본다.
// 한 일과 사실만 말한다(틀렸다고 하지 않는다, 갇힌 것을 미리 알리지 않는다), 가장 적은 걸음은 판이 끝나기 전에 말하지 않는다,
// 힌트는 두 높이, 규칙은 세 문장 안, 색만으로 알리지 않는다. 화면 코드와 틀에 이 형식이 이어져 있는지도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { LADDER, generateBoard } from '../src/core/keymaze-ladder.js';
import { checkBoard, exitRooms, solve } from '../src/core/keymaze.js';
import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { fill, sentenceCount } from '../src/core/text.js';
import { OUT, bruteAlive, bruteBack, bruteReplay, bruteSolve, nextStates, readMaze } from './helpers/brute-keymaze.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/keymaze.json'));
const html = read('index.html');
const code = read('src/formats/keymaze.js');
const board = read('src/ui/keymaze-board.js');
const css = read('src/app.css');

const VALUES = { k: 7, f: '3', n: 2, no: '첫 ', face: '빨간 동그라미', total: 4 };
/** 그림과 판의 값은 글이 아니다 */
const DATA_KEYS = ['picture', 'blank', 'seed', 'board', 'walk', 'marks', 'rings', 'level'];

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
const own = [part('id="keymaze-title"', 'id="cipher-title"'), part('id="keymaze-marks"', 'id="cipher-counts"'), part('id="keymaze-count"', 'id="cipher-count"'), part('id="keymaze-pad"', 'id="cipher-pad"'), part('id="make-keymaze"', 'id="make-cipher"')].map(visibleText).join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const said = strings.map(([, text]) => text).join(' ');

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 단계 목록이 사다리와 같다', () => {
  assert.equal(T.title, '열쇠 미로');
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.deepEqual(T.levels.map((item) => item.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(T.levels.map((item) => item.name), ['한쪽 문', '열쇠와 잠긴 문', '나갈 수 없는 미로도 있어요', '열쇠는 한 번 쓰면 없어져요', '가장 적은 걸음으로', '직접 만들기']);
  for (const entry of T.levels) assert.ok(entry.picture.blank === true || Number.isInteger(entry.picture.seed), entry.name);
  // 판 고르기의 그림: 3단계는 나갈 수 없는 판(2번)을 보여 준다
  assert.equal(generateBoard(3, T.levels[2].picture.seed).solution.possible, false);
  // 처음 화면의 물음은 판의 종류마다 있다
  assert.deepEqual(Object.keys(T.home.ask).sort(), ['fewest', 'keys', 'mixed', 'oneway', 'used']);
  // 색은 셋이고 이름에 모양이 함께 들어 있다(색만으로 알리지 않는다)
  assert.deepEqual(T.faces, ['빨간 동그라미', '파란 세모', '노란 네모']);
});

test('한 일과 사실만 말한다. 판정하는 말, 칭찬 낱말, 갇혔다고 미리 알리는 말이 없다', () => {
  assert.doesNotMatch(said, /틀렸|틀린|아니에요|땡|정답|아쉽|실수|실패|성공|잘했|훌륭|대단|최고|멋져|멋진|완벽|축하|천재|똑똑|굉장|맞아요|맞혔/);
  assert.doesNotMatch(own, /틀렸|틀린|아니에요|땡|아쉽|실패|잘했|훌륭|대단|최고|멋/);
  assert.doesNotMatch(`${said} ${visibleText(html)}`, /대각/);
  // 하는 동안의 말에는 "갇혔어요", "나갈 수 없게 됐어요"가 없다. 더 갈 곳이 아예 없는 방에서만 그 사실을 말한다
  for (const [key, text] of Object.entries(T.play)) assert.doesNotMatch(text, /갇혔|갇혀|(?<!지)나갈 수 없/, key);
  for (const [key, text] of Object.entries(T.status)) assert.doesNotMatch(text, /갇혔|갇혀|(?<!지)나갈 수 없/, key);
  assert.equal(T.play.stuck, '이 방에서는 더 갈 수 있는 곳이 없어요. 한 걸음 무르거나 처음으로 돌아갈 수 있어요.');
  assert.match(code, /if \(moved && movesFrom\(round\.board, state\)\.length === 0\) \{/);
  // 지나갈 수 없는 문이면 걷지 않고 왜 못 지나가는지 사실만 말한다
  assert.equal(T.play.arrow, '이 한쪽 문은 화살표 쪽으로만 지나갈 수 있어요.');
  assert.equal(fill(T.play.lock, { face: '파란 세모' }), '파란 세모 문은 파란 세모 열쇠가 있어야 열려요.');
  assert.equal(fill(T.play['used-up'], { face: '빨간 동그라미' }), '빨간 동그라미 열쇠는 아까 다른 문을 열 때 썼어요.');
  // 나갈 수 있는 판의 "불가능해요"에는 틀렸다고 하지 않고 길이 있다는 사실만 말한다
  assert.equal(T.play['possible-press'], '이 미로에는 나가는 길이 있어요. 다른 길로 걸어 볼 수 있어요.');
  assert.doesNotMatch(code, /Math\.random/);
  assert.doesNotMatch(board, /Math\.random/);
  // 판 아래에는 지나온 문의 수, 가진 열쇠, 이 판에서 가장 적은 걸음만 적는다(몇 번 물렀는지, 몇 번 막혔는지 적지 않는다)
  for (const line of code.split('\n')) if (/textContent/.test(line)) assert.doesNotMatch(line, /undoCount|resetCount|refusedCount|stuckCount|retryCount|wrongCount|completions\.length/, line.trim());
});

test('가장 적은 걸음의 수는 판이 끝나기 전에 말하지 않는다', () => {
  for (const line of code.split('\n')) if (/T\.(play|status)/.test(line)) assert.doesNotMatch(line, /solution\.steps|\.steps\b/, line.trim());
  assert.equal(fill(T.play.fewer, { k: 11 }), '11걸음에 나왔어요. 더 적은 걸음으로 나갈 수 있을까요?');
  assert.match(code, /const fewest = round\.mode !== 'fewest' \|\| k === solution\.steps;/);
  // 가장 적은 걸음은 끝난 뒤(맞혔을 때의 말, 풀이)에만 나온다
  assert.match(T.right.fewest, /이보다 적은 걸음으로는 나갈 수 없어요\.$/);
  assert.match(T.solution.possible, /^가장 적은 걸음은 \{k\}걸음이에요\./);
});

test('규칙 설명은 세 문장 안이다. 판의 종류마다 있다. 직접 만들기의 안내 글도 세 문장 안이다', () => {
  assert.deepEqual(Object.keys(T.rules).sort(), ['fewest', 'keys', 'mixed', 'oneway', 'used']);
  for (const [key, rule] of Object.entries(T.rules)) assert.ok(sentenceCount(rule) <= 3, key);
  // 첫 단계는 "가장 적게"를 걸지 않고 나가 보게 한다(형식의 첫 판은 실패할 수 없다)
  assert.match(T.rules.oneway, /나가는 문으로 나가 보세요\.$/);
  assert.match(T.rules.used, /^열쇠는 잠긴 문을 한 번 열면 없어져요\./);
  assert.match(T.rules.fewest, /가장 적은 걸음으로 나가 보세요\.$/);
  for (const key of ['mixed', 'used']) assert.match(T.rules[key], /나갈 수 없는 미로이면 불가능해요를 눌러요\.$/);
  assert.match(code, /const ruleKey = \(round\) => \(round\.mode === 'made' \? \(round\.board\.keep === 'used' \? 'used' : 'mixed'\) : round\.mode\);/);
  assert.match(code, /ruleLine: \(round\) => T\.rules\[ruleKey\(round\)\],/);
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 32);
  assert.ok(sentenceCount(guides[26]) <= 3, guides[26]);
  assert.match(guides[26], /나갈 수 없는 미로도 만들 수 있을까요\?$/);
  assert.match(T.keepNote.kept, /열쇠를 써도 없어지지 않아요\.$/);
  assert.match(T.keepNote.used, /열쇠가 없어져요\.$/);
});

test('힌트는 판의 종류마다 두 개이고, 하나하나가 질문 한 문장이다. 답을 말해 버리지 않는다', () => {
  assert.deepEqual(Object.keys(T.hints).sort(), ['fewest', 'keys', 'mixed', 'oneway', 'used']);
  for (const [key, list] of Object.entries(T.hints)) {
    assert.equal(list.length, 2, key);
    assert.notEqual(list[0], list[1]);
    for (const hint of list) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
      assert.doesNotMatch(hint, /때문|해야 해요|하면 돼요|늘 |\d|거꾸로 따라가기/, hint);
    }
  }
  // 힌트 1은 무엇을 해 볼지(모든 형식이 함께 쓰는 짧은 목록에서), 힌트 2는 어디를 볼지
  assert.equal(T.hints.oneway[0], '나가기 바로 전에는 어느 방에 있어야 할까요?');
  assert.equal(T.hints.oneway[1], '나가는 문 바로 앞 방에는 어느 문으로 들어갈 수 있을까요?');
  assert.equal(T.hints.used[0], '아까와 다른 차례로 문을 열면 어떻게 되나요?');
  assert.match(code, /hints: \(round\) => T\.hints\[ruleKey\(round\)\],/);
});

test('글의 빈칸({이름})은 정해진 이름만 쓰고, 채울 값이 모자라지 않는다', () => {
  const allowed = new Set(['k', 'f', 'n', 'no', 'total', 'level', 'tag', 'face']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
    assert.ok(fill(text, VALUES).length > 0, path);
  }
  assert.equal(fill(T.labels.cell, { no: '첫 ', f: '3', face: T.labels.here }), '첫 번째 줄 3번째 방, 지금 있는 방');
  assert.equal(fill(T.solution.reasons.twice, { face: '노란 네모', n: 2, k: 1 }), '노란 네모 문을 2개 열어야 나갈 수 있는데, 노란 네모 열쇠는 1개뿐이에요. 열쇠는 한 번 쓰면 없어져요.');
  assert.equal(fill(T.notebook.best, { k: 9 }), '9걸음에 나간 미로');
});

test('화면 글에 영어 낱말과 보상 낱말이 없고, "~요"로 끝나는 말투다. 한 문장은 60자를 넘지 않는다', () => {
  for (const [path, text] of strings) assert.doesNotMatch(text.replace(/\{[^{}]*\}/g, ''), /[A-Za-z]/, `${path}: ${text}`);
  assert.doesNotMatch(own, /[A-Za-z]/);
  assert.doesNotMatch(own, /별|점수|순위|레벨|연속/);
  const spoken = [...Object.values(T.home.ask), T.home.pick, ...Object.values(T.rules), ...Object.values(T.keepNote), ...Object.values(T.play), ...Object.values(T.hints).flat(), ...Object.values(T.right), T.solution.possible, T.solution.impossible, ...Object.values(T.solution.reasons), T.make.intro, T.make.possible, T.make.impossible, T.make.many, ...T.why.map((slide) => slide.say)];
  for (const text of spoken) for (const sentence of sentences(text)) assert.match(sentence, /요[.?!]$/, sentence);
  for (const text of Object.values(T.status)) assert.match(text, /요$/, text);
  for (const slide of T.why) for (const item of slide.figures) assert.match(item.note, /요$/, item.note);
  for (const [path, text] of strings) for (const sentence of sentences(fill(text, VALUES))) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

/** 이 그림의 방들이 나가는 문까지 가는 걸음 수가 1 이하인 방(나가는 문이 있는 방과 그 앞 방)인가: 다른 방법으로 센다 */
function nearExit(figureBoard) {
  const maze = readMaze(figureBoard);
  const rooms = new Set([figureBoard.exit.room]);
  for (let room = 0; room < figureBoard.w * figureBoard.h; room++) {
    for (const other of maze.near(room)) {
      if (other !== figureBoard.exit.room) continue;
      const door = maze.doors.get(`${Math.min(room, other)}-${Math.max(room, other)}`);
      if (door.kind === 'open' || (door.kind === 'one' && door.to === other)) rooms.add(room);
    }
  }
  return [...rooms].sort((a, b) => a - b);
}

test('"왜 그럴까?": 갇힌 이야기 → 나가는 문에서 거꾸로 → 열쇠가 빗금 밖이면 나갈 수 없다(이름) → 한 번 쓰는 열쇠에서는 빗금 안에서도 갇힌다', () => {
  assert.equal(T.why.length, 4);
  for (const slide of T.why) assert.ok(sentenceCount(slide.say) <= 3, slide.say);
  for (const slide of T.why) for (const item of slide.figures) assert.equal(checkBoard(item.board), null, item.note);
  const [one, two, three, four] = T.why.map((slide) => slide.figures);
  // 첫 장: 한쪽 문을 지나 들어간 곳에서는 어떻게 걸어도 나갈 수 없다(다른 방법으로). 판 자체는 나갈 수 있는 판이다
  const trapped = one[0];
  const state = bruteReplay(trapped.board, trapped.walk);
  const { alive, name } = bruteAlive(trapped.board);
  assert.ok(state && !alive.has(name(state)));
  assert.equal(bruteSolve(trapped.board).possible, true);
  for (const room of trapped.rings) assert.equal(bruteBack(trapped.board).includes(room), false);
  // 둘째 장: 나가는 문 앞의 두 방, 그리고 거꾸로 따라가 모은 방(빗금이 없는 방은 첫 장의 두 방)
  assert.deepEqual(two[0].marks, nearExit(two[0].board));
  assert.deepEqual(two[1].marks, bruteBack(two[1].board));
  assert.deepEqual(two[1].marks, exitRooms(two[1].board));
  assert.equal(9 - two[1].marks.length, 2);
  assert.deepEqual([...trapped.rings].sort(), [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((room) => !two[1].marks.includes(room)));
  assert.match(T.why[1].say, /^그래서 나가는 문에서 거꾸로 따라가 봤어요\./);
  // 셋째 장: 열쇠가 빗금 밖에 있는 판은 나갈 수 없다(풀이 프로그램은 trap, 다른 방법으로도 나갈 수 없다)
  const keyed = three[0];
  assert.deepEqual(keyed.marks, bruteBack(keyed.board));
  assert.deepEqual(keyed.rings, keyed.board.keys.map((key) => key.room));
  for (const room of keyed.rings) assert.equal(keyed.marks.includes(room), false);
  assert.equal(bruteSolve(keyed.board).possible, false);
  assert.equal(solve(keyed.board).reason, 'trap');
  assert.match(T.why[2].say, /거꾸로 따라가기라고 불러요\.$/);
  // 넷째 장: 한 번 쓰는 열쇠의 판. 빗금 친 방(모든 방)에 있는데 엉뚱한 문에 열쇠를 써서 나갈 수 없다. 판은 나갈 수 있는 판이다
  const used = four[0];
  assert.equal(used.board.keep, 'used');
  assert.deepEqual(used.marks, bruteBack(used.board));
  const after = bruteReplay(used.board, used.walk);
  const usedAlive = bruteAlive(used.board);
  assert.ok(after && after.open.size === 1 && !usedAlive.alive.has(usedAlive.name(after)));
  assert.ok(used.marks.includes(after.room));
  assert.equal(bruteSolve(used.board).possible, true);
  assert.equal(bruteSolve({ ...used.board, keep: 'kept' }).possible, true);
  // 이름은 "왜 그럴까?"에서만 말한다
  for (const [path, text] of strings) if (!path.startsWith('why')) assert.doesNotMatch(text, /거꾸로 따라가기/, path);
  assert.ok(nextStates(readMaze(used.board), after).every((next) => next.room !== OUT));
});

test('풀이와 직접 만들기: 나갈 수 있으면 가장 적은 걸음과 길, 없으면 까닭(모두 따져 본 판도)', () => {
  assert.equal(fill(T.solution.possible, { k: 9 }), '가장 적은 걸음은 9걸음이에요. 한 가지 길을 보여 줄게요.');
  assert.deepEqual(Object.keys(T.solution.reasons).sort(), ['arrows', 'nokey-far', 'nokey-none', 'search', 'trap', 'twice']);
  assert.match(code, /if \(reason === 'nokey'\) return fill\(lines\[detail\.none \? 'nokey-none' : 'nokey-far'\], \{ face: faceOf\(detail\.color\) \}\);/);
  const make = part('id="make-keymaze"', 'id="make-cipher"');
  for (const id of ['keymaze-make-keep', 'keymaze-make-w-fewer', 'keymaze-make-w', 'keymaze-make-w-more', 'keymaze-make-h-fewer', 'keymaze-make-h', 'keymaze-make-h-more', 'keymaze-make-clear', 'keymaze-make-tools', 'keymaze-make-colors', 'keymaze-make-board', 'keymaze-make-solve', 'keymaze-make-result', 'keymaze-make-play', 'keymaze-make-picture']) assert.ok(make.includes(`id="${id}"`), id);
  assert.match(make, /id="keymaze-make-solve"[^>]*>선생님, 나갈 수 있어요\?</);
  assert.match(make, /id="keymaze-make-play"[^>]*>내가 해 볼래요</);
  assert.deepEqual([...make.matchAll(/data-tool="(\w+)"/g)].map((match) => match[1]), ['door', 'one', 'lock', 'key', 'start', 'exit']);
  assert.deepEqual([...make.matchAll(/data-keep="(\w+)"/g)].map((match) => match[1]), ['kept', 'used']);
  // 색 단추는 색과 모양을 함께 그린 열쇠 그림이고(화면 코드가 그려 넣는다), 읽어 줄 이름에 색과 모양을 함께 적는다
  assert.deepEqual([...make.matchAll(/data-color="\d"[^>]*aria-label="([^"]+)"><\/button>/g)].map((match) => match[1]), T.faces);
  assert.match(code, /for \(const button of \$\('keymaze-make-colors'\)\.querySelectorAll\('button'\)\) button\.prepend\(keyIcon\(Number\(button\.dataset\.color\), ''\)\);/);
  assert.match(T.make.intro, /선생님에게 나갈 수 있는지 물어볼 수 있어요\.$/);
  // 직접 만든 판은 나갈 수 없는 판이 섞이는 판으로 해 본다. 공책: 직접 만든 판과 가장 적은 걸음의 기록(적을수록 좋은 기록)
  assert.match(code, /mode: custom \? 'made' : rungOf\(level\)\.mode,/);
  assert.match(code, /\n {4}madeBoard,\n/);
  assert.match(code, /bestOf: \(round\) => \(round\.mode !== 'fewest' \|\| round\.best === null \? null : \{ value: -round\.best, name: fill\(T\.notebook\.best, \{ k: round\.best \}\) \}\),/);
});

test('index.html: 이 형식의 카드, 판, 판 아래, 도구, 답하는 칸, 직접 만들기가 있다. 틀에 이어져 있다', () => {
  for (const id of ['home-keymaze-sample', 'home-keymaze-ask', 'home-keymaze-play', 'home-keymaze-pick', 'home-keymaze-make', 'home-keymaze-blank', 'keymaze-board', 'keymaze-count', 'keymaze-status', 'keymaze-steps', 'keymaze-held', 'keymaze-best-line', 'keymaze-best', 'keymaze-marks', 'keymaze-pad', 'keymaze-legend-open', 'keymaze-legend-one', 'keymaze-legend-lock', 'keymaze-keep-note', 'keymaze-impossible', 'keymaze-again', 'keymaze-stop', 'make-keymaze']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(part('id="keymaze-title"', '</section>'), /<h2 id="keymaze-title">열쇠 미로<\/h2>/);
  assert.ok(visibleText(part('id="keymaze-title"', '</section>')).includes(T.home.ask.oneway));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-keymaze-make" class="menu-item"/);
  assert.match(part('id="keymaze-marks"', 'id="why"'), /aria-pressed="false" hidden>나갈 수 있는 방 보기</);
  const pad = part('id="keymaze-pad"', 'id="cipher-pad"');
  assert.match(pad, /id="keymaze-impossible"[^>]*>불가능해요</);
  assert.match(pad, /id="keymaze-again"[^>]*>처음부터 다시 걸어 볼래요</);
  assert.match(pad, /id="keymaze-stop"[^>]*>여기까지 할래요</);
  assert.match(visibleText(pad), /한쪽 문: 화살표 쪽으로만 지나가요/);
  // 카드는 닿지 않게 놓기와 구역 긋기 다음, 암호 놀이 앞이다
  assert.ok(html.indexOf('id="apart-title"') < html.indexOf('id="keymaze-title"'));
  assert.ok(html.indexOf('id="keymaze-title"') < html.indexOf('id="cipher-title"'));
  // 틀이 형식을 안다(닿지 않게 놓기와 구역 긋기 다음)
  assert.match(read('src/main.js'), /apart: createApart\(frame\), keymaze: createKeymaze\(frame\), /);
  assert.match(read('src/check-main.js'), /\['keymaze', '열쇠 미로'\]/);
  assert.match(read('src/core/smaller.js'), /apart: smallerApart, keymaze: smallerKeymaze, /);
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
  // 무르기와 되돌리기가 있다. 도구를 켜 본 판은 힌트 하나를 연 것으로 센다. 판이 위아래로 커서 규칙 글은 왼쪽 칸에 둔다
  assert.match(code, /\$\('undo'\)\.hidden = false;\s*\$\('reset'\)\.hidden = false;/);
  assert.match(code, /hintsOpened: round\.hintsOpened \+ \(round\.marksShown \? 1 : 0\),/);
  assert.match(code, /ruleAside: true,/);
  // 판을 그리는 조각은 글을 받아 그릴 뿐 적지 않는다. 타이머가 없다. 누르는 것과 긋는 것, 글자판을 모두 받는다
  assert.doesNotMatch(board, /setInterval|setTimeout/);
  for (const name of ['pointerdown', 'pointermove', 'pointerup', 'keydown', "'km-lock", "'km-key", "'km-arrow'", "'km-mark'", "'km-exit'"]) assert.ok(board.includes(name), name);
  // 색만으로 알리지 않는다: 열쇠와 잠긴 문에는 색마다 모양, 지금 열려 있는 잠긴 문은 점선, 나갈 수 있는 방은 빗금. 걷는 동안 판이 굴러가지 않는다
  assert.match(board, /export const KEY_SHAPES = \['circle', 'triangle', 'square'\];/);
  assert.match(css, /\.km-lock\.open \.km-lock-bar \{[^}]*stroke-dasharray/);
  assert.match(css, /\.km-mark line \{/);
  assert.match(css, /\.km-board\.walking \.km-svg \{[^}]*touch-action: none/);
});

/** 끝까지 한 판의 기록 하나 */
function finished(more = {}) {
  return { kind: 'round', id: `r-${more.id ?? 1}`, format: 'keymaze', level: 1, seed: 1, custom: false, mode: 'oneway', outcome: 'solved', hintsOpened: 0, answers: [{ t: 10, answer: 'out:5', correct: true, guess: null }], wrongCount: 0, moveCount: 5, seconds: 40, solution: { possible: true }, ...more };
}

test('수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다. "왜 그럴까?"는 나갈 수 없는 미로를 한 번 끝까지 만난 뒤에 열린다', () => {
  const tuning = tuningFor('keymaze');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 5);
  assert.equal(tuning.hintCount, 2);
  assert.equal(tuning.whyAfter, undefined);
  assert.match(read('src/core/level.js'), /열쇠 미로\(모두 임시\)/);
  assert.deepEqual(recommend([], 'keymaze'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  // 틀린 답 없이 예상 시간보다 빨리 두 판을 끝내면 더 어려운 판을 권한다
  assert.deepEqual(recommend([finished({ id: 1 }), finished({ id: 2 })], 'keymaze'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, wrongCount: 1 })], 'keymaze').offerHarder, false);
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, seconds: 200 })], 'keymaze').offerHarder, false);
  assert.equal(whyUnlocked([finished()], 'keymaze'), false);
  assert.equal(whyUnlocked([finished({ level: 3, solution: { possible: false }, answers: [{ t: 3, answer: 'impossible', correct: true, guess: null }] })], 'keymaze'), true);
  assert.equal(whyUnlocked([finished({ level: 3, side: true, solution: { possible: false } })], 'keymaze'), false);
  // 기록의 틀린 답: 나갈 수 있는 판의 "불가능해요"와 5단계의 가장 적지 않은 나가기
  assert.match(code, /round\.impossibleCount \+= 1;\s*round\.wrongCount \+= 1;/);
  assert.match(code, /moveCount: round\.stepCount,/);
  assert.match(code, /solution: \{ possible: solution\.possible, steps: solution\.steps, path: solution\.path, reason: solution\.reason \},/);
});
