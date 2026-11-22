// 모눈 자동차 경주 대본 점검: 화면에 나오는 글이 약속을 지키는지, "왜 그럴까?"의 그림과 말이 다른 방법으로 따진 것과 맞는지 본다.
// 한 일과 사실만 말한다(틀렸다고 하지 않는다), 힌트는 두 높이, 규칙은 세 문장 안, 시계와 서두르게 하는 말이 없다, 색만으로 알리지 않는다.
// 화면 코드와 틀에 이 형식이 이어져 있는지도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { LADDER, generateBoard } from '../src/core/racetrack-ladder.js';
import { checkBoard } from '../src/core/racetrack.js';
import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { fill, sentenceCount } from '../src/core/text.js';
import { bruteFewest, bruteReplay, bruteStuck } from './helpers/brute-racetrack.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/racetrack.json'));
const html = read('index.html');
const code = read('src/formats/racetrack.js');
const board = read('src/ui/racetrack-board.js');
const css = read('src/app.css');

const VALUES = { k: 7, f: '3', n: 2, no: '첫 ', face: '오른쪽 2칸, 위 1칸', total: 4 };
/** 그림과 판의 값은 글이 아니다 */
const DATA_KEYS = ['picture', 'blank', 'seed', 'board', 'moves', 'level'];

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
const own = [part('id="racetrack-title"', 'id="discpair-title"'), part('id="racetrack-count"', 'id="discpair-count"'), part('id="racetrack-pad"', 'id="discpair-pad"'), part('id="make-racetrack"', 'id="make-discpair"')].map(visibleText).join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const said = strings.map(([, text]) => text).join(' ');
const MODES = ['straight', 'corner', 'fewest', 'flag', 'big'];

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 단계 목록이 사다리와 같다', () => {
  assert.equal(T.title, '모눈 자동차 경주');
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.deepEqual(T.levels.map((item) => item.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(T.levels.map((item) => item.name), ['곧은 길', '모퉁이 하나', '가장 적게 가기', '깃발 들르기', '구불구불한 길', '직접 만들기']);
  for (const entry of T.levels) assert.ok(entry.picture.blank === true || Number.isInteger(entry.picture.seed), entry.name);
  for (const entry of T.levels.filter((item) => !item.picture.blank)) assert.equal(checkBoard(generateBoard(entry.level, entry.picture.seed).board), null);
  assert.deepEqual(Object.keys(T.home.ask).sort(), [...MODES].sort());
});

test('한 일과 사실만 말한다. 판정하는 말, 칭찬 낱말, 서두르게 하는 말이 없다. 가장 적은 수는 끝나기 전에 말하지 않는다', () => {
  assert.doesNotMatch(said, /틀렸|틀린|아니에요|땡|정답|아쉽|실수|실패|성공|잘했|훌륭|대단|최고|멋져|멋진|완벽|축하|천재|똑똑|굉장|맞아요|맞혔/);
  assert.doesNotMatch(own, /틀렸|틀린|아니에요|땡|아쉽|실패|잘했|훌륭|대단|최고|멋/);
  // 경주는 이름뿐이다: 시간, 빨리, 이기고 지는 말이 없다
  assert.doesNotMatch(said + own, /빨리|얼른|서둘|초 안에|시간|몇 초|이겼|졌어요|일등|꼴찌/);
  assert.doesNotMatch(code + board, /setInterval|setTimeout|requestAnimationFrame|performance\.now|Date\.now/);
  // 더 많이 움직여 넘으면 횟수를 말하고 더 적은 수로 갈 수 있을지 묻는다(가장 적은 수는 말하지 않는다)
  assert.equal(fill(T.play.fewer, { k: 8 }), '8번 움직여서 결승선을 넘었어요. 더 적은 수로 갈 수 있을까요?');
  assert.match(T.play['fewer-up'], /더 적은 수로 갈 수 있을까요\?$/);
  for (const key of ['fewer', 'fewer-up', 'same']) assert.doesNotMatch(T.play[key], /가장 적/);
  assert.match(code, /if \(before !== null && k === before\) frame\.say\(fill\(T\.play\.same, \{ k \}\)\);/);
  assert.match(code, /const fewest = !isRecord\(round\) \|\| k === solution\.fewest;/);
  // 벽에 닿는 점: 가지 않고 사실 하나와 할 수 있는 일 하나. 아홉 점 모두 막히면 무르기를 말한다
  assert.equal(T.play.wall, '그 점으로 가면 선이 벽에 닿아요. 다른 점을 골라 볼 수 있어요.');
  assert.match(T.play.stuck, /^아홉 점 모두 선이 벽에 닿아요\. 무르고/);
  assert.match(T.play.flag, /^깃발 칸에 닿기 전에는 결승선을 넘을 수 없어요\./);
  assert.match(code, /frame\.say\(stuck \? T\.play\.stuck : T\.play\[result\.kind\]\);/);
  // 판 아래에는 움직인 횟수, 지난 움직임, (가장 적게 가는 판은) 이 판에서 가장 적게 움직인 수만 적는다. 무른 수, 부딪힌 수는 적지 않는다
  for (const line of code.split('\n')) if (/textContent/.test(line)) assert.doesNotMatch(line, /undoCount|resetCount|retryCount|wrongCount|refuseCount|stuckCount|moveCount/, line.trim());
});

test('무르기, 처음으로, 다시 해 보기 뒤에는 앞의 말을 덮는 한마디를 하고, 벽에 닿은 점선도 지운다', () => {
  assert.equal(T.play.undo, '무르기 전 모습으로 돌아왔어요.');
  assert.equal(T.play.reset, '출발 칸으로 돌아왔어요.');
  assert.match(T.play.again, /^출발 칸으로 돌아왔어요\./);
  for (const name of ['undo', 'reset', 'again']) {
    const body = code.slice(code.indexOf(`function ${name}()`), code.indexOf(`frame.say(T.play.${name});`));
    assert.match(body, /flash = null;\s*blocked = null;\s*refused = false;/, name);
  }
  // 가지 못한 까닭(벽, 깃발, 막힌 자리)을 말한 뒤 차가 움직이면 그 말을 사실 한 줄로 덮는다
  assert.equal(T.play.moved, '차가 그 점으로 갔어요.');
  assert.match(code, /let said = wasRefused \? T\.play\.moved : null;/);
});

test('규칙 설명은 세 문장 안이다. 판의 종류마다 있다. 첫 두 단계는 "가장 적게"를 걸지 않는다. 직접 만들기의 안내 글도 세 문장 안이다', () => {
  assert.deepEqual(Object.keys(T.rules).sort(), [...MODES].sort());
  for (const [key, rule] of Object.entries(T.rules)) {
    assert.ok(sentenceCount(rule) <= 3, key);
    assert.match(rule, /^차는 지난번 움직임에서 가로와 세로를 1칸까지만 바꿀 수 있어요\./, key);
    assert.match(rule, /벽에 닿으면/, key);
  }
  assert.doesNotMatch(T.rules.straight + T.rules.corner, /가장 적게/);
  for (const key of ['fewest', 'flag', 'big']) assert.match(T.rules[key], /가장 적게/);
  assert.match(T.rules.flag, /깃발 칸에 닿은 뒤에만 결승선을 넘을 수 있어요\./);
  assert.match(code, /const ruleKey = \(round\) => \(round\.mode === 'made' \? \(round\.board\.flags\.length > 0 \? 'flag' : 'fewest'\) : round\.mode\);/);
  assert.match(code, /ruleLine: \(round\) => T\.rules\[ruleKey\(round\)\],/);
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 43);
  assert.ok(sentenceCount(guides[41]) <= 3, guides[41]);
  assert.match(guides[41], /^칸을 눌러 길을 그리고 출발 칸과 결승선을 정해요\./);
  assert.match(guides[41], /여러 번 걸리는 길을 만들 수 있을까요\?$/);
  // 닿기만 해도 부딪힌 것이라는 약속은 오른쪽 칸에 적혀 있다
  assert.match(visibleText(part('id="racetrack-pad"', 'id="discpair-pad"')), /벽에 닿기만 해도 그 점으로는 갈 수 없어요\./);
});

test('힌트는 판의 종류마다 두 개이고, 하나하나가 질문 한 문장이다. 힌트 1은 함께 쓰는 목록에서 고른다', () => {
  assert.deepEqual(Object.keys(T.hints).sort(), [...MODES].sort());
  const common = ['끝에는 어떤 모양이 되어야 하나요?', '끝나기 바로 전에는 어떤 모양일까요?', '더 작은 판이라면 할 수 있을까요?', '전에 해 본 판 가운데 닮은 판이 있었나요?', '규칙 하나가 없다면 어디까지 되나요?', '아직 한 번도 건드리지 않은 곳이 있나요?', '아까와 다른 곳에서 시작하면 어떻게 되나요?'];
  for (const [key, list] of Object.entries(T.hints)) {
    assert.equal(list.length, 2, key);
    assert.notEqual(list[0], list[1]);
    assert.ok(common.includes(list[0]), list[0]);
    for (const hint of list) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
      assert.doesNotMatch(hint, /때문|해야 해요|하면 돼요|늘 |\d|조금씩만|넓게/, hint);
    }
  }
  assert.match(code, /hints: \(round\) => T\.hints\[ruleKey\(round\)\],/);
});

test('글의 빈칸({이름})은 정해진 이름만 쓰고, 채울 값이 모자라지 않는다', () => {
  const allowed = new Set(['k', 'f', 'n', 'no', 'total', 'level', 'tag', 'face']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
    assert.ok(fill(text, VALUES).length > 0, path);
  }
  assert.equal(fill(T.labels.pick, { face: `${fill(T.labels.right, { k: 2 })}, ${fill(T.labels.up, { k: 1 })}` }), '이번 움직임: 오른쪽 2칸, 위 1칸');
  assert.equal(fill(T.labels.cell, { no: '첫 ', n: '3', face: T.labels.road }), '위에서 첫 번째 줄, 왼쪽에서 3번째 칸, 길 칸');
  assert.equal(fill(T.notebook.best, { k: 6 }), '6번 움직여 결승선을 넘은 판');
});

test('화면 글에 영어 낱말과 보상 낱말이 없고, "~요"로 끝나는 말투다. 한 문장은 60자를 넘지 않는다', () => {
  for (const [path, text] of strings) assert.doesNotMatch(text.replace(/\{[^{}]*\}/g, ''), /[A-Za-z]/, `${path}: ${text}`);
  assert.doesNotMatch(own, /[A-Za-z]/);
  assert.doesNotMatch(own + said, /별|점수|순위|레벨|연속/);
  const spoken = [...Object.values(T.home.ask), T.home.pick, ...Object.values(T.rules), ...Object.values(T.play), ...Object.values(T.hints).flat(), ...Object.values(T.right), T.solution.path, ...Object.entries(T.make).filter(([key]) => key !== 'size').map(([, text]) => text), ...T.why.map((slide) => slide.say)];
  for (const text of spoken) for (const sentence of sentences(text)) assert.match(sentence, /요[.?!]$/, sentence);
  for (const text of Object.values(T.status)) assert.match(text, /요$/, text);
  for (const slide of T.why) for (const item of slide.figures) assert.match(item.note, /요$/, item.note);
  for (const [path, text] of strings) for (const sentence of sentences(fill(text, VALUES))) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

test('"왜 그럴까?": 계속 빨라지다 막힌 자리 → 속도는 조금씩만 바뀐다(이름) → 안쪽 벽에 붙어 가는 길과 넓게 도는 길', () => {
  assert.equal(T.why.length, 3);
  for (const slide of T.why) assert.ok(sentenceCount(slide.say) <= 3, slide.say);
  for (const slide of T.why) for (const item of slide.figures) assert.equal(checkBoard(item.board), null);
  const [one, two, three] = T.why.map((slide) => slide.figures);
  // 첫 장: 세 번 빨라져서(한 번에 3칸) 모퉁이 앞에 오면 아홉 점 모두 벽에 닿는다
  const stuck = bruteReplay(one[0].board, one[0].moves);
  assert.equal(one[0].moves.length, 3);
  assert.equal(stuck.finished, false);
  assert.equal(stuck.last.vx, 3);
  assert.equal(bruteStuck(one[0].board, stuck.last), true);
  // 그 앞의 자리(한 번에 2칸)에서는 막히지 않는다
  const before = bruteReplay(one[0].board, one[0].moves.slice(0, 2));
  assert.equal(bruteStuck(one[0].board, before.last), false);
  assert.match(T.why[0].say, /세 번 만에 모퉁이 앞에 왔는데, 아홉 점 모두 선이 벽에 닿았어요\./);
  // 둘째 장: 한 번에 1칸, 2칸, 3칸으로 빨라졌다가 2칸, 1칸, 0칸으로 멈춘다. 멈추는 동안 3칸을 더 간다
  const run = bruteReplay(two[0].board, two[0].moves);
  const xs = run.points.map(([x]) => x);
  const speeds = xs.slice(1).map((x, index) => x - xs[index]);
  assert.deepEqual(speeds, [1, 2, 3, 2, 1, 0]);
  assert.equal(xs.at(-1) - xs[3], 3);
  assert.equal(run.finished, false);
  // 한 번에 3칸씩 가던 차는 두 번 만에 멈출 수 없다(움직임을 모두 해 본다)
  for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) assert.notEqual(3 + a + b, 0);
  assert.match(T.why[1].say, /세 번 더 움직여야 하고, 그동안 3칸을 더 가요\./);
  assert.match(T.why[1].say, /'속도는 조금씩만 바뀐다'라고 불러요\.$/);
  for (const [path, text] of strings) if (!path.startsWith('why')) assert.doesNotMatch(text, /조금씩만 바뀐다/, path);
  // 셋째 장: 안쪽 벽을 따라 한 줄(안쪽 줄과 안쪽 열)로만 가면 가장 적게 7번, 넓게 쓰면 5번(다른 방법으로 다시 구한다)
  const ell = three[0].board;
  assert.deepEqual(three[1].board, ell);
  assert.deepEqual(one[0].board, ell);
  const [innerRow, innerCol] = [3, 5];
  const lane = {
    ...ell,
    rows: ell.rows.map((row, y) => [...row].map((_, x) => ((y === innerRow && x <= innerCol) || (x === innerCol && y <= innerRow) ? '.' : '#')).join('')),
    finish: { side: 'top', from: innerCol, to: innerCol },
  };
  assert.equal(checkBoard(lane), null);
  assert.equal(bruteFewest(lane), 7);
  const hug = bruteReplay(ell, three[0].moves);
  assert.ok(hug.finished && three[0].moves.length === 7);
  for (const [x, y] of hug.points.slice(0, -1)) assert.ok(y === innerRow || x === innerCol, `${x},${y}`);
  assert.equal(bruteReplay(lane, three[0].moves).finished, true);
  assert.equal(bruteFewest(ell), 5);
  const wide = bruteReplay(ell, three[1].moves);
  assert.ok(wide.finished && three[1].moves.length === 5);
  // 넓게 도는 길은 안쪽 줄과 안쪽 열 밖의 점을 지난다
  assert.ok(wide.points.slice(1, -1).some(([x, y]) => y !== innerRow && x !== innerCol));
  assert.match(T.why[2].say, /한 줄로만 가면 7번이 걸려요\. 풀이 프로그램이 찾은 길은 넓게 돌아서 5번이에요\.$/);
  assert.match(three[0].note, /7번이에요$/);
  assert.match(three[1].note, /5번이에요$/);
});

test('풀이와 직접 만들기: 가장 적은 수와 한 가지 길을 그려 보인다. 갈 수 없는 판은 모든 길을 따져 보았다고 말한다', () => {
  assert.equal(fill(T.solution.path, { k: 5 }), '가장 적게 움직이면 5번이에요. 한 가지 길을 보여 줄게요.');
  assert.match(T.make.none, /^선생님이 갈 수 있는 길을 모두 따져 봤어요\./);
  assert.match(code, /if \(!result\.possible\) line = T\.make\.none;/);
  const make = part('id="make-racetrack"', 'id="make-discpair"');
  for (const id of ['racetrack-make-w-fewer', 'racetrack-make-w', 'racetrack-make-w-more', 'racetrack-make-h-fewer', 'racetrack-make-h', 'racetrack-make-h-more', 'racetrack-make-tool', 'racetrack-make-clear', 'racetrack-make-board', 'racetrack-make-solve', 'racetrack-make-result', 'racetrack-make-play']) assert.ok(make.includes(`id="${id}"`), id);
  assert.match(make, /id="racetrack-make-solve"[^>]*>선생님, 가장 적게 몇 번이에요\?</);
  assert.match(make, /id="racetrack-make-play"[^>]*>내가 해 볼래요</);
  assert.deepEqual([...make.matchAll(/data-tool="(\w+)"/g)].map((match) => match[1]), ['road', 'start', 'finish', 'flag']);
  assert.match(T.make.intro, /가장 적게 몇 번인지 물어볼 수 있어요\.$/);
  // 직접 만든 판: 결승선까지 갈 수 있고 화면에 다 그릴 수 있는 판만 해 보거나 남긴다
  assert.match(code, /mode: custom \? 'made' : rungOf\(level\)\.mode,/);
  assert.match(code, /return result\.possible && fitsView\(result\.extent\) \? copyBoard\(board\) : null;/);
  assert.match(code, /\n {4}madeBoard,\n/);
  assert.match(code, /bestOf: \(round\) => \(!isRecord\(round\) \|\| round\.best === null \? null : \{ value: -round\.best, name: fill\(T\.notebook\.best, \{ k: round\.best \}\) \}\),/);
});

test('index.html: 이 형식의 카드, 판, 판 아래, 오른쪽 칸, 직접 만들기가 있다. 틀에 이어져 있다', () => {
  for (const id of ['home-racetrack-sample', 'home-racetrack-ask', 'home-racetrack-play', 'home-racetrack-pick', 'home-racetrack-make', 'home-racetrack-blank', 'racetrack-board', 'racetrack-count', 'racetrack-status', 'racetrack-moves', 'racetrack-speed', 'racetrack-best-line', 'racetrack-best', 'racetrack-pad', 'racetrack-flag-note', 'racetrack-again', 'racetrack-stop', 'make-racetrack']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(part('id="racetrack-title"', '</section>'), /<h2 id="racetrack-title">모눈 자동차 경주<\/h2>/);
  assert.ok(visibleText(part('id="racetrack-title"', '</section>')).includes(T.home.ask.straight));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-racetrack-make" class="menu-item"/);
  const pad = part('id="racetrack-pad"', 'id="discpair-pad"');
  assert.match(pad, /id="racetrack-again"[^>]*>출발 칸에서 다시 해 볼래요</);
  assert.match(pad, /id="racetrack-stop"[^>]*>여기까지 할래요</);
  assert.doesNotMatch(pad, /불가능해요/);
  // 카드는 탑 옮기기 다음, 퍼즐 만들기 앞이다
  assert.ok(html.indexOf('id="tower-title"') < html.indexOf('id="racetrack-title"'));
  assert.ok(html.indexOf('id="racetrack-title"') < html.indexOf('id="make-title"'));
  // 틀이 형식을 안다(형식 목록의 맨 뒤, 탑 옮기기 다음)
  assert.match(read('src/main.js'), /tower: createTower\(frame\), racetrack: createRacetrack\(frame\), /);
  assert.match(read('src/check-main.js'), /\['racetrack', '모눈 자동차 경주'\]/);
  assert.match(read('src/core/smaller.js'), /tower: smallerTower, racetrack: smallerRacetrack, /);
  assert.match(code, /smaller: \(round, turn\) => smallerRacetrack\(\{ mode: round\.mode, board: round\.board \}, turn\),/);
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
  // 무르기와 되돌리기가 있다. 판이 위아래로도 커서 규칙 글은 왼쪽 칸에 둔다
  assert.match(code, /\$\('undo'\)\.hidden = false;\s*\$\('reset'\)\.hidden = false;/);
  assert.match(code, /ruleAside: true,/);
  // 아홉 점은 누를 수 있는 단추(글자판으로도 누른다)이고, 칸 하나만 한 누르는 자리가 있다
  for (const name of ["role: 'button'", 'tabindex: 0', "'rt-pick-area'", 'width: U, height: U', "'keydown'"]) assert.ok(board.includes(name), name);
});

test('화면: 벽은 빗금, 결승선은 체크 무늬 선, 깃발 칸은 점선 테두리(닿은 뒤 실선), 가지 못한 선은 점선이다. 움직이는 그림이 없다', () => {
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(plain, /\.rt-wall-hatch \{[^}]*stroke-width/);
  assert.match(plain, /\.rt-finish \{[^}]*stroke-dasharray/);
  assert.match(plain, /\.rt-flag \{[^}]*stroke-dasharray/);
  assert.match(plain, /\.rt-flag\.done \{\s*stroke-dasharray: none;/);
  assert.match(plain, /\.rt-blocked \{[^}]*stroke-dasharray/);
  assert.doesNotMatch(plain.slice(plain.indexOf('.rt-board.live')), /animation|transition/);
  // 직접 만들기의 칸도 44픽셀보다 크다(가로 9칸, 세로 8칸까지. 판 칸이 가로 476픽셀, 세로 432픽셀쯤)
  assert.match(code, /MAKE_W/);
  assert.ok(476 / 9 >= 44 && 432 / 8 >= 44);
});

/** 끝까지 한 판의 기록 하나 */
function finished(more = {}) {
  return { kind: 'round', id: `r-${more.id ?? 1}`, format: 'racetrack', level: 1, seed: 1, custom: false, mode: 'straight', outcome: 'solved', hintsOpened: 0, answers: [{ t: 10, answer: 'done:3', correct: true, guess: null }], wrongCount: 0, moveCount: 3, seconds: 30, solution: { possible: true, fewest: 3 }, ...more };
}

test('수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다. "왜 그럴까?"는 판을 한 번 끝까지 한 뒤에 열린다', () => {
  const tuning = tuningFor('racetrack');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 5);
  assert.equal(tuning.hintCount, 2);
  assert.equal(tuning.whyAfter, 'finished');
  assert.equal(tuning.fastWin, undefined);
  assert.equal(tuning.fastSolo, undefined);
  assert.match(read('src/core/level.js'), /모눈 자동차 경주\(모두 임시\)/);
  assert.deepEqual(recommend([], 'racetrack'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  assert.deepEqual(recommend([finished({ id: 1 }), finished({ id: 2 })], 'racetrack'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  // 가장 적게 가는 판: 처음 넘은 것이 가장 적은 수가 아니면 "한 번에"가 아니다
  assert.equal(recommend([finished({ id: 1, level: 3 }), finished({ id: 2, level: 3, wrongCount: 1 })], 'racetrack').offerHarder, false);
  assert.equal(whyUnlocked([], 'racetrack'), false);
  assert.equal(whyUnlocked([finished()], 'racetrack'), true);
  assert.equal(whyUnlocked([finished({ side: true })], 'racetrack'), false);
  assert.match(code, /round\.wrongCount \+= 1;/);
  assert.match(code, /solution: \{ possible: true, fewest: solution\.fewest, path: solution\.path \},/);
});
