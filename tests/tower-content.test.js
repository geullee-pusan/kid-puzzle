// 탑 옮기기 대본 점검: 화면에 나오는 글이 약속을 지키는지, "왜 그럴까?"의 그림과 말이 다른 방법으로 따진 것과 맞는지 본다.
// 한 일과 사실만 말한다(틀렸다고 하지 않는다), 힌트는 두 높이, 규칙은 세 문장 안, 색만으로 알리지 않는다.
// 이진법은 가르치지 않는다: 그 낱말은 "왜 그럴까?"의 한 장에서 아이가 아는 것과 견주어 보는 물음으로만 나온다. 0과 1의 줄도 없다.
// 화면 코드와 틀에 이 형식이 이어져 있는지도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { LADDER, generateBoard } from '../src/core/tower-ladder.js';
import { checkBoard, fewestRows, moveProblem, solve, standardBoard } from '../src/core/tower.js';
import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { fill, sentenceCount } from '../src/core/text.js';
import { bruteReplay, bruteSolve, stacksFrom } from './helpers/brute-tower.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/tower.json'));
const html = read('index.html');
const code = read('src/formats/tower.js');
const board = read('src/ui/tower-board.js');
const css = read('src/app.css');

const VALUES = { k: 16, f: '3', n: 5, no: '첫 ', face: '오른쪽', total: 4 };
/** 그림과 판의 값은 글이 아니다 */
const DATA_KEYS = ['picture', 'blank', 'seed', 'board', 'pos', 'stages', 'steps', 'sizes', 'record', 'width', 'mark', 'target', 'level'];

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
const own = [part('id="tower-title"', 'id="make-title"'), part('id="tower-count"', 'id="domino-count"'), part('id="tower-pad"', 'id="domino-pad"'), part('id="make-tower"', '<script')].map(visibleText).join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const said = strings.map(([, text]) => text).join(' ');

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 단계 목록이 사다리와 같다', () => {
  assert.equal(T.title, '탑 옮기기');
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.deepEqual(T.levels.map((item) => item.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(T.levels.map((item) => item.name), ['탑 옮겨 보기', '가장 적게 옮기기', '표 만들기', '몇 번째에 어느 원판?', '흩어진 탑', '직접 만들기']);
  for (const entry of T.levels.filter((item) => !item.picture.blank)) assert.equal(checkBoard(generateBoard(entry.level, entry.picture.seed).board), null);
  assert.deepEqual(Object.keys(T.home.ask).sort(), ['fewest', 'move', 'spread', 'table', 'which']);
  assert.deepEqual(T.labels.pegs, ['왼쪽', '가운데', '오른쪽']);
});

test('한 일과 사실만 말한다. 판정하는 말, 칭찬 낱말이 없다. 가장 적은 횟수는 끝나기 전에 말하지 않는다', () => {
  assert.doesNotMatch(said, /틀렸|틀린|아니에요|땡|정답|아쉽|실수|실패|성공|잘했|훌륭|대단|최고|멋져|멋진|완벽|축하|천재|똑똑|굉장|맞아요|맞혔/);
  assert.doesNotMatch(own, /틀렸|틀린|아니에요|땡|아쉽|실패|잘했|훌륭|대단|최고|멋/);
  // 더 많이 옮겨 쌓으면 횟수를 말하고 더 적게 옮길 수 있을지 묻는다(가장 적은 횟수는 말하지 않는다)
  assert.equal(fill(T.play.fewer, { k: 9 }), '9번 옮겨서 다 쌓았어요. 더 적게 옮길 수 있을까요?');
  for (const key of ['fewer', 'fewer-up', 'same']) assert.doesNotMatch(T.play[key], /가장 적/);
  assert.match(T.table.more, /더 적게 옮길 수 있을까요\?$/);
  assert.doesNotMatch(T.table.more, /가장 적/);
  assert.match(code, /const fewest = !isRecord\(round\) \|\| k === solution\.fewest;/);
  // 큰 원판을 작은 원판 위에 놓으려 하면: 사실 하나와 할 수 있는 일 하나
  assert.equal(fill(T.play.bigger, { k: 3, n: 1 }), '3번 원판은 1번 원판보다 커서 그 위에 놓을 수 없어요. 빈 기둥이나 더 큰 원판 위에는 놓을 수 있어요.');
  assert.match(code, /if \(problem\.why === 'bigger'\) \{/);
  // 몇 번째 판에서 다른 원판을 고르면: 그 원판은 그때 움직이지 않는다는 사실과 할 수 있는 일
  assert.equal(fill(T.which.not, { k: 16, n: 4 }), '가장 적게 옮길 때 16번째에 4번 원판은 움직이지 않아요. 판에서 따라가 볼 수 있어요.');
  // 짐작은 맞다 틀리다 하지 않는다
  assert.match(code, /answer: `guess:\$\{n\}:\$\{value \?\? 'unknown'\}`, correct: null, guess: 'guess'/);
  // 표 만들기에서 짐작을 적기 전에는 "왜 그럴까?"(셋째 장에 원판 5개와 6개의 횟수가 있다)를 열지 않는다
  assert.match(code, /if \(round\?\.mode === 'table' && !round\.done\) return null;/);
  assert.doesNotMatch(code, /Math\.random/);
  assert.doesNotMatch(board, /Math\.random/);
  // 판 아래에는 옮긴 횟수와(가장 적게 옮기는 판은) 이 판에서 가장 적게 옮긴 횟수만 적는다
  for (const line of code.split('\n')) if (/textContent/.test(line)) assert.doesNotMatch(line, /undoCount|resetCount|retryCount|wrongCount|moveCount|refuseCount|backCount/, line.trim());
});

test('무르기, 처음으로, 다시 해 보기, 원판 수 바꾸기 뒤에는 앞의 말을 덮는 한마디를 한다', () => {
  assert.equal(T.play.undo, '무르기 전 모습으로 돌아왔어요.');
  assert.equal(T.play.reset, '처음 모습으로 돌아왔어요.');
  assert.match(T.play.again, /^처음 모습으로 돌아왔어요\./);
  for (const key of ['undo', 'reset', 'again']) assert.match(code, new RegExp(`frame\\.say\\(T\\.play\\.${key}\\);`));
  assert.match(code, /frame\.say\(fill\(T\.play\.size, \{ n \}\)\);/);
});

test('규칙 설명은 세 문장 안이다. 판의 종류마다 있다. 첫 단계는 "가장 적게"를 걸지 않는다. 직접 만들기의 안내 글도 세 문장 안이다', () => {
  assert.deepEqual(Object.keys(T.rules).sort(), ['fewest', 'move', 'spread', 'table', 'which']);
  for (const [key, rule] of Object.entries(T.rules)) {
    assert.ok(sentenceCount(rule) <= 3, key);
    assert.match(rule, /^맨 위의 원판을 하나씩 다른 기둥으로 옮기고, 큰 원판은 작은 원판 위에 놓을 수 없어요\./, key);
  }
  assert.doesNotMatch(T.rules.move, /가장 적게/);
  assert.match(T.rules.fewest, /가장 적게 옮겨 보세요\.$/);
  assert.match(code, /const ruleKey = \(round\) => \(round\.mode === 'made' \? \(isTower\(round\.board\) \? 'fewest' : 'spread'\) : round\.mode\);/);
  assert.match(code, /ruleLine: \(round\) => T\.rules\[ruleKey\(round\)\],/);
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 41);
  assert.ok(sentenceCount(guides[40]) <= 3, guides[40]);
  assert.match(guides[40], /^원판마다 꽂을 기둥을 골라요\./);
  assert.match(guides[40], /아주 다른 판을 만들 수 있을까요\?$/);
});

test('힌트는 판의 종류마다 두 개이고, 하나하나가 질문 한 문장이다. 힌트 1은 함께 쓰는 목록에서 고른다. 방법을 말해 버리지 않는다', () => {
  assert.deepEqual(Object.keys(T.hints).sort(), ['fewest', 'move', 'spread', 'table', 'which']);
  const common = ['끝에는 어떤 모양이 되어야 하나요?', '끝나기 바로 전에는 어떤 모양일까요?', '더 작은 판이라면 할 수 있을까요?', '전에 해 본 판 가운데 닮은 판이 있었나요?', '규칙 하나가 없다면 어디까지 되나요?', '아직 한 번도 건드리지 않은 곳이 있나요?', '아까와 다른 곳에서 시작하면 어떻게 되나요?'];
  for (const [key, list] of Object.entries(T.hints)) {
    assert.equal(list.length, 2, key);
    assert.notEqual(list[0], list[1]);
    assert.ok(common.includes(list[0]), list[0]);
    for (const hint of list) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
      assert.doesNotMatch(hint, /때문|해야 해요|하면 돼요|\d|두 배|이진|홀수|짝수/, hint);
    }
  }
  assert.match(code, /hints: \(round\) => T\.hints\[ruleKey\(round\)\],/);
});

test('글의 빈칸({이름})은 정해진 이름만 쓰고, 채울 값이 모자라지 않는다. 수 뒤에 조사가 바로 붙지 않는다', () => {
  const allowed = new Set(['k', 'f', 'n', 'no', 'total', 'level', 'tag', 'face']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
    assert.ok(fill(text, VALUES).length > 0, path);
    // "{k}을", "{n}이" 같은 말은 수에 따라 틀린 조사가 된다
    assert.doesNotMatch(text, /\{[kn]\}(을|를|이|가|은|는|와|과|으로|로)[\s.,?!]/, path);
  }
  assert.equal(fill(T.labels.top, { face: '왼쪽 기둥', n: 3, k: 1 }), '왼쪽 기둥, 원판 3개, 맨 위는 1번 원판');
  assert.equal(fill(T.labels.flag, { face: '오른쪽' }), '오른쪽 깃발 기둥');
  assert.equal(fill(T.notebook.best, { k: 7 }), '7번 옮겨 쌓은 탑');
});

test('화면 글에 영어 낱말과 보상 낱말이 없고, "~요"로 끝나는 말투다. 한 문장은 60자를 넘지 않는다', () => {
  for (const [path, text] of strings) assert.doesNotMatch(text.replace(/\{[^{}]*\}/g, ''), /[A-Za-z]/, `${path}: ${text}`);
  assert.doesNotMatch(own, /[A-Za-z]/);
  assert.doesNotMatch(own, /별|점수|순위|레벨|연속/);
  const spoken = [...Object.values(T.home.ask), T.home.pick, ...Object.values(T.rules), ...Object.values(T.play), ...Object.values(T.hints).flat(), ...Object.values(T.right), ...Object.values(T.which), ...['settled', 'more', 'same', 'full', 'ask', 'noted', 'reveal', 'reveal-next'].map((key) => T.table[key]), T.solution.path, T.solution.more, T.solution.which, T.solution.table, ...Object.entries(T.make).filter(([key]) => key !== 'size').map(([, text]) => text), ...T.why.map((slide) => slide.say)];
  for (const text of spoken) for (const sentence of sentences(text)) assert.match(sentence, /요[.?!]$/, sentence);
  for (const text of Object.values(T.status)) assert.match(text, /요$/, text);
  for (const slide of T.why) for (const item of slide.figures) assert.match(item.note, /요$/, item.note);
  for (const [path, text] of strings) for (const sentence of sentences(fill(text, VALUES))) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

test('이진법은 가르치지 않는다: 그 낱말은 "왜 그럴까?" 넷째 장의 견주어 보는 물음에만 있고, 0과 1의 줄이나 바꾸기가 없다', () => {
  const where = strings.filter(([, text]) => /이진|2진|진법|진수/.test(text)).map(([path]) => path);
  assert.deepEqual(where, ['why[3].say']);
  assert.match(T.why[3].say, /이진법으로 수를 셀 때와 견주어 볼까요\?$/);
  assert.doesNotMatch(said + own, /[01]{3,}|바꾸|자릿값|변환/);
  assert.doesNotMatch(visibleText(html), /이진/);
});

test('"왜 그럴까?": 가장 큰 원판이 움직이는 순간 → 두 배 하고 1 더하기(이름) → 표 → 옮긴 원판의 차례 → 흩어진 탑에서는 그대로 나오지 않는다', () => {
  assert.equal(T.why.length, 5);
  for (const slide of T.why) assert.ok(sentenceCount(slide.say) <= 3, slide.say);
  const [one, two, three, four, five] = T.why.map((slide) => slide.figures[0]);
  const tower = standardBoard(4, 2);
  const other = bruteSolve(tower.start, 2);
  const after = (count) => bruteReplay(tower.start, other.path.slice(0, count));
  // 첫 장: 가장 큰 원판이 움직이기 바로 전의 모습(가장 적게 옮기는 길의 7번째 뒤). 4번 원판은 왼쪽에서 오른쪽으로 옮길 수 있다
  assert.deepEqual(stacksFrom(one.pos), after(7));
  assert.equal(moveProblem(one.pos, 0, 2), null);
  assert.match(one.note, /^4번 원판이 오른쪽으로 가려면 나머지 셋이 가운데에/);
  // 둘째 장: 처음, 7번 뒤, 8번 뒤, 15번 뒤. 단계마다 옮긴 횟수 7, 1, 7(다른 방법으로 다시 잰다). 이름은 여기서 처음 말한다
  assert.deepEqual(two.stages.map(stacksFrom), [after(0), after(7), after(8), after(15)]);
  assert.deepEqual(two.steps, [7 - 0, 8 - 7, 15 - 8]);
  // 7번은 원판 3개짜리 탑을 옮기는 가장 적은 횟수다(왼쪽에서 가운데로, 가운데에서 오른쪽으로)
  assert.equal(bruteSolve([0, 0, 0], 1).fewest, 7);
  assert.equal(bruteSolve([1, 1, 1], 2).fewest, 7);
  assert.match(T.why[1].say, /7번, 1번, 7번을 더하면 15번이에요\./);
  assert.match(T.why[1].say, /두 배 하고 1 더하기라고 불러요\.$/);
  assert.doesNotMatch(T.why[0].say, /두 배/);
  for (const [path, text] of strings) if (!path.startsWith('why') && !path.startsWith('_')) assert.doesNotMatch(text, /두 배/, path);
  // 셋째 장: 원판 1~7개의 표(그 자리에서 풀이 프로그램이 채운다). 하나 늘 때마다 두 배 하고 1을 더한 수다
  assert.deepEqual(three.sizes, [1, 2, 3, 4, 5, 6, 7]);
  const rows = fewestRows(three.sizes);
  for (const row of rows) if (row.n <= 6) assert.equal(row.fewest, bruteSolve(new Array(row.n).fill(0), 2).fewest);
  for (let index = 1; index < rows.length; index++) assert.equal(rows[index].fewest, 2 * rows[index - 1].fewest + 1);
  assert.equal(three.note, `원판 7개는 ${rows.at(-1).fewest}번이에요`);
  assert.match(code, /fewestRows\(sizes\)/);
  // 넷째 장: 원판 4개를 가장 적게 옮길 때의 차례(넷씩 끊어서). 가장 큰 원판은 8번째에 한 번만 움직인다
  assert.equal(four.record, 4);
  assert.equal(four.width, 4);
  assert.equal(four.mark, 8);
  assert.deepEqual(solve(tower).discs, other.discs);
  assert.deepEqual(other.discs.flatMap((disc, index) => (disc === 4 ? [index + 1] : [])), [8]);
  assert.match(T.why[3].say, /한가운데인 8번째에 한 번만 움직여요\./);
  // 다섯째 장: 흩어진 원판 4개는 5번에 다 쌓인다(15번이 아니다). 까닭은 말하지 않고 묻는다
  assert.equal(bruteSolve(five.board.start, five.board.target).fewest, 5);
  assert.equal(five.board.start[3], five.board.target);
  assert.match(T.why[4].say, /원판이 4개인데 5번에 다 쌓여요\./);
  assert.match(T.why[4].say, /\?$/);
});

test('풀이와 직접 만들기: 가장 적은 횟수와 길을 여덟 번씩 나눠 그린다. 직접 만들기는 선생님이 누를 때마다 한 번씩 옮긴다', () => {
  assert.equal(fill(T.solution.path, { k: 7 }), '가장 적게 옮기면 7번이에요. 차례대로 보여 줄게요.');
  assert.match(code, /const PER_PAGE = 8;/);
  assert.match(code, /const worst = result\.fewest === worstOf\(board\.n, board\.target\)\.worst;/);
  const make = part('id="make-tower"', '<script');
  for (const id of ['tower-make-fewer', 'tower-make-n', 'tower-make-more', 'tower-make-target', 'tower-make-discs', 'tower-make-clear', 'tower-make-board', 'tower-make-solve', 'tower-make-result', 'tower-make-step', 'tower-make-back', 'tower-make-play']) assert.ok(make.includes(`id="${id}"`), id);
  assert.match(make, /id="tower-make-solve"[^>]*>선생님, 가장 적게 몇 번이에요\?</);
  assert.match(make, /id="tower-make-step"[^>]*>선생님, 한 번 옮겨 주세요</);
  assert.match(make, /id="tower-make-play"[^>]*>내가 해 볼래요</);
  assert.deepEqual([...make.matchAll(/data-peg="(\d)"/g)].map((match) => match[1]), ['0', '1', '2']);
  // 직접 만들기는 원판 7개까지
  assert.match(code, /\$\('tower-make-more'\)\.disabled = n >= MAKE_MAX;/);
  assert.match(code, /mode: custom \? 'made' : rungOf\(level\)\.mode;|const mode = custom \? 'made' : rungOf\(level\)\.mode;/);
  assert.match(code, /const madeBoard = \(\) => \(draft && checkBoard\(draft\) === null && !isDone\(draft\.start, draft\.target\) \? copyBoard\(draft\) : null\);/);
  assert.match(code, /\n {4}madeBoard,\n/);
  assert.match(code, /bestOf: \(round\) => \(!isRecord\(round\) \|\| round\.best === null \? null : \{ value: -round\.best, name: fill\(T\.notebook\.best, \{ k: round\.best \}\) \}\),/);
});

test('index.html: 이 형식의 카드, 판, 판 아래, 답하는 칸, 직접 만들기가 있다. 틀에 이어져 있다', () => {
  for (const id of ['home-tower-sample', 'home-tower-ask', 'home-tower-play', 'home-tower-pick', 'home-tower-make', 'home-tower-blank', 'tower-board', 'tower-count', 'tower-status', 'tower-moves', 'tower-best-line', 'tower-best', 'tower-pad', 'tower-help', 'tower-sizes', 'tower-guess-box', 'tower-keys', 'tower-guess-note', 'tower-guess-skip', 'tower-which-box', 'tower-which-choices', 'tower-record-box', 'tower-again', 'tower-stop', 'make-tower']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(part('id="tower-title"', '</section>'), /<h2 id="tower-title">탑 옮기기<\/h2>/);
  assert.ok(visibleText(part('id="tower-title"', '</section>')).includes(T.home.ask.move));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-tower-make" class="menu-item"/);
  const pad = part('id="tower-pad"', 'id="domino-pad"');
  assert.match(visibleText(pad), /기둥을 누르면 맨 위의 원판을 들어 올리고, 다른 기둥을 누르면 그 기둥에 내려놓아요\./);
  assert.match(pad, /id="tower-again"[^>]*>처음 모습으로 다시 해 볼래요</);
  assert.match(pad, /id="tower-stop"[^>]*>여기까지 할래요</);
  assert.match(pad, /id="tower-guess-skip"[^>]*>모르겠어요</);
  assert.doesNotMatch(pad, /불가능해요/);
  // 카드는 블랙홀 다음, 퍼즐 만들기 앞이다
  assert.ok(html.indexOf('id="blackhole-title"') < html.indexOf('id="tower-title"'));
  assert.ok(html.indexOf('id="tower-title"') < html.indexOf('id="make-title"'));
  // 틀이 형식을 안다(형식 목록의 맨 뒤, 블랙홀 다음)
  assert.match(read('src/main.js'), /blackhole: createBlackhole\(frame\), tower: createTower\(frame\) \};/);
  assert.match(read('src/check-main.js'), /\['tower', '탑 옮기기'\]/);
  assert.match(read('src/core/smaller.js'), /blackhole: smallerBlackhole, tower: smallerTower \};/);
  assert.match(code, /smaller: \(round, turn\) => smallerTower\(\{ mode: round\.mode, board: round\.board \}, turn\),/);
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
  // 무르기와 되돌리기가 있다. 원판 일곱 개 탑은 위아래로 커서 규칙 글은 왼쪽 칸에 둔다
  assert.match(code, /\$\('undo'\)\.hidden = false;\s*\$\('reset'\)\.hidden = false;/);
  assert.match(code, /ruleAside: true,/);
  // 판을 그리는 조각은 글을 적지 않는다. 타이머가 없다(움직임은 CSS가 한다). 끌어서 옮기기를 받는다
  assert.doesNotMatch(board + code, /setInterval|setTimeout|requestAnimationFrame/);
  for (const name of ['pointerdown', 'pointerup', 'setPointerCapture', 'elementFromPoint', "'landing'", "'held'", "'tw-size'", 'flagNode']) assert.ok(board.includes(name), name);
});

test('화면: 내려앉는 움직임은 0.4초 안이고 움직임을 줄이는 설정에서는 없다. 기둥 칸이 누르는 자리라서 44픽셀보다 크다. 크기는 너비와 적힌 수로 보인다', () => {
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const [, seconds] = plain.match(/\.tw-disc\.landing \{[^}]*animation: tw-land ([\d.]+)s/);
  assert.ok(Number(seconds) <= 0.4);
  assert.match(plain, /@media \(prefers-reduced-motion: reduce\) \{\s*\.tw-disc\.landing \{\s*animation: none;/);
  // 원판 그림은 누름을 받지 않는다(기둥 단추가 받는다)
  assert.match(plain, /\n\.tw-disc \{[^}]*pointer-events: none;/);
  const peg = plain.match(/\n\.tw-peg \{([^}]*)\}/)[1];
  assert.match(peg, /min-width: 44px;/);
  assert.match(peg, /min-height: 44px;/);
  // 1180×820 화면에서 판 칸은 가로 500픽셀쯤이라 기둥 칸 셋이 저마다 150픽셀쯤이다. 원판 일곱 개여도 기둥 칸의 높이는 원판 수만큼 늘지 않는다(누르는 자리는 기둥 칸 전체다)
  assert.match(plain, /\.tw-pegs \{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(board, /disc\.append\(el\('span', 'tw-size', String\(size\)\)\);/);
  // 깃발 기둥은 깃발 그림과 점선 테두리, 아래의 굵은 이름으로도 보인다
  assert.match(plain, /\.tw-peg\.target \{\s*border: 2px dashed/);
});

/** 끝까지 한 판의 기록 하나 */
function finished(more = {}) {
  return { kind: 'round', id: `r-${more.id ?? 1}`, format: 'tower', level: 1, seed: 1, custom: false, mode: 'move', outcome: 'solved', hintsOpened: 0, answers: [{ t: 10, answer: 'done:1', correct: true, guess: null }], wrongCount: 0, moveCount: 1, seconds: 20, solution: { possible: true, fewest: 1 }, ...more };
}

test('수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다. "왜 그럴까?"는 판을 한 번 끝까지 한 뒤에 열린다', () => {
  const tuning = tuningFor('tower');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 5);
  assert.equal(tuning.hintCount, 2);
  assert.equal(tuning.whyAfter, 'finished');
  assert.equal(tuning.fastWin, undefined);
  assert.match(read('src/core/level.js'), /탑 옮기기\(모두 임시\)/);
  assert.deepEqual(recommend([], 'tower'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  assert.deepEqual(recommend([finished({ id: 1 }), finished({ id: 2 })], 'tower'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  // 가장 적게 옮기는 판: 처음 다 쌓은 것이 가장 적은 횟수가 아니면 "한 번에"가 아니다
  assert.equal(recommend([finished({ id: 1, level: 2 }), finished({ id: 2, level: 2, wrongCount: 1 })], 'tower').offerHarder, false);
  assert.equal(whyUnlocked([], 'tower'), false);
  assert.equal(whyUnlocked([finished()], 'tower'), true);
  assert.equal(whyUnlocked([finished({ side: true })], 'tower'), false);
  assert.match(code, /round\.wrongCount \+= 1;/);
  assert.match(code, /moveCount: round\.moveCount,/);
});
