// 번호 말 제자리 찾기 대본 점검: 화면에 나오는 글이 약속을 지키는지, "왜 그럴까?"의 그림과 말이 다른 방법으로 센 것과 맞는지 본다.
// 한 일과 사실만 말한다(틀렸다고 하지 않는다), 힌트는 두 높이, 규칙은 세 문장 안, 색만으로 알리지 않는다, 이름("뒤바뀐 짝", "고리", "바뀌지 않는 것")은 "왜 그럴까?"에서만.
// 화면 코드와 틀에 이 형식이 이어져 있는지도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { LADDER, generateBoard } from '../src/core/slide-ladder.js';
import { checkBoard, cyclesOf } from '../src/core/slide.js';
import { fill, sentenceCount } from '../src/core/text.js';
import { pairCount, readLine, slideDistances, slidesFrom, swapDistances } from './helpers/brute-slide.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/slide.json'));
const html = read('index.html');
const code = read('src/formats/slide.js');
const board = read('src/ui/slide-board.js');
const css = read('src/app.css');

const VALUES = { k: 3, f: 2, n: 5, no: '첫 ', face: '말', total: 9 };
/** 그림과 판의 값은 글이 아니다 */
const DATA_KEYS = ['picture', 'blank', 'seed', 'rows', 'marks', 'jumper', 'over', 'arrows', 'level'];

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
const own = [part('id="slide-title"', 'id="make-title"'), part('id="slide-tool"', 'id="why"'), part('id="slide-board"', '<div class="board-foot">'), part('id="slide-count"', 'id="fold-count"'), part('id="slide-pad"', 'id="domino-pad"'), part('id="make-slide"', '<script')].map(visibleText).join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const said = strings.map(([, text]) => text).join(' ');

/** 그림 판(rows) → 판 */
function boardOf(rows) {
  const lines = rows.map((row) => row.trim().split(/\s+/));
  const cells = lines.flat().map((mark) => (mark === '_' ? 0 : Number(mark)));
  return { w: lines[0].length, h: lines.length, cells };
}

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 단계 목록이 사다리와 같다', () => {
  assert.equal(T.title, '번호 말 제자리 찾기');
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.deepEqual(T.levels.map((item) => item.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(T.levels.map((item) => item.name), ['맞바꾸기', '가장 적게 맞바꾸기', '밀기 2×3 판', '밀기 3×3 판', '가장 적게 밀기', '직접 만들기']);
  for (const entry of T.levels.filter((item) => !item.picture.blank)) assert.equal(checkBoard(generateBoard(entry.level, entry.picture.seed).board), null);
  assert.deepEqual(Object.keys(T.home.ask).sort(), ['big', 'fewest', 'least', 'small', 'swap']);
  assert.deepEqual(Object.keys(T.hints).sort(), ['big', 'fewest', 'least', 'made-slide', 'made-swap', 'small', 'swap']);
  assert.deepEqual(Object.keys(T.rules).sort(), ['big', 'fewest', 'least', 'made-slide', 'made-swap', 'small', 'swap']);
});

test('한 일과 사실만 말한다. 판정하는 말, 칭찬 낱말이 없다. 되는 판의 "불가능해요"에는 되는 판이라는 사실만 말한다', () => {
  assert.doesNotMatch(said, /틀렸|틀린|아니에요|땡|정답|아쉽|실수|실패|성공|잘했|훌륭|대단|최고|멋져|멋진|완벽|축하|천재|똑똑|굉장|맞아요|맞혔/);
  assert.doesNotMatch(own, /틀렸|틀린|아니에요|땡|아쉽|실패|잘했|훌륭|대단|최고|멋/);
  assert.match(T.play['possible-press'], /^이 판은 모두 제자리로 갈 수 있어요\./);
  assert.match(T.play['possible-press-untried'], /^이 판은 모두 제자리로 갈 수 있어요\./);
  // 되는 판은 실제로 밀어서 놓아야 끝나고, 안 되는 판만 "불가능해요"로 끝난다
  assert.match(code, /const correct = solution\.possible === false;/);
  assert.match(code, /if \(correct\) \{\s*frame\.finish\('solved'\);/);
  assert.match(code, /round\.impossibleCount \+= 1;\s*round\.wrongCount \+= 1;/);
  assert.equal([...code.matchAll(/frame\.finish\(/g)].length, 3);
  assert.doesNotMatch(code + board, /Math\.random/);
  // 판 아래에는 할 일이나 사실 한 줄과 맞바꾼(민) 횟수, 도구를 켜면 큰 수가 앞에 선 짝의 수만 적는다. 무른 수나 누른 수는 적지 않는다
  for (const line of code.split('\n')) if (/textContent/.test(line)) assert.doesNotMatch(line, /undoCount|resetCount|wrongCount|moveCount|farCount|toolCount|retryCount/, line.trim());
});

test('가장 적게 하는 판: 틀렸다고 하지 않고 "더 줄일 수 있을까요?"라고 묻는다. 가장 적은 횟수는 끝나기 전에 말하지 않는다', () => {
  for (const word of ['swap', 'slide']) {
    assert.match(T.play[`fewer-${word}`], /더 줄일 수 있을까요\?$/);
    assert.match(T.play[`fewer-up-${word}`], /아까보다 적은 횟수예요\. 더 줄일 수 있을까요\?$/);
    assert.match(T.right[`fewest-${word}`], /이보다 적게 .+서는 놓을 수 없어요\.$/);
  }
  assert.equal(fill(T.play['fewer-swap'], { k: 4 }), '4번 맞바꿔서 모두 제자리에 놓았어요. 더 줄일 수 있을까요?');
  // 가장 적은 횟수와 같을 때만 끝난다
  assert.match(code, /const fewest = !isRecord\(round\) \|\| k === solution\.fewest;/);
  assert.match(code, /round\.wrongCount \+= 1;\s*frame\.persist\(\);/);
  for (const [path, text] of strings) if (path.startsWith('play') || path.startsWith('status') || path.startsWith('hints')) assert.doesNotMatch(text, /가장 적게 \{k\}/, path);
  assert.match(part('id="slide-pad"', 'id="domino-pad"'), /id="slide-again"[^>]*>처음 판으로 다시 해 볼래요</);
  assert.match(part('id="slide-pad"', 'id="domino-pad"'), /id="slide-stop"[^>]*>여기까지 할래요</);
  assert.equal(fill(T.notebook['best-swap'], { k: 3 }), '3번 맞바꿔 놓은 줄');
  assert.match(code, /bestOf: \(round\) => \(!isRecord\(round\) \|\| round\.best === null \? null :/);
});

test('무르기와 처음으로 뒤에는 앞의 말을 덮는 한마디를 한다', () => {
  assert.equal(T.play.undo, '무르기 전 모습으로 돌아왔어요.');
  assert.equal(T.play.reset, '처음 모습으로 돌아왔어요.');
  assert.match(code, /frame\.note\('undo'\);[\s\S]*?frame\.say\(T\.play\.undo\);/);
  assert.match(code, /frame\.note\('reset'\);[\s\S]*?frame\.say\(T\.play\.reset\);/);
  assert.match(code, /frame\.note\('again'\);[\s\S]*?frame\.say\(T\.play\.again\);/);
});

test('규칙 설명은 세 문장 안이다. 첫 단계는 "가장 적게"를 걸지 않는다. 직접 만들기의 안내 글도 세 문장 안이다', () => {
  for (const [key, rule] of Object.entries(T.rules)) assert.ok(sentenceCount(rule) <= 3, key);
  assert.doesNotMatch(T.rules.swap, /가장 적게/);
  for (const key of ['fewest', 'least', 'made-swap']) assert.match(T.rules[key], /가장 적게 .+ 보세요\.$/);
  for (const key of ['small', 'big', 'made-slide']) assert.match(T.rules[key], /오른쪽 아래 구석/);
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 48);
  const mine = guides[47];
  assert.ok(sentenceCount(mine) <= 3, mine);
  assert.match(mine, /^두 말을 차례로 누르면 자리가 바뀌어요\./);
  assert.match(mine, /제자리로 갈 수 없는 판을 만들 수 있을까요\?$/);
});

test('힌트는 판의 종류마다 두 개이고, 하나하나가 질문 한 문장이다. 힌트 1은 함께 쓰는 목록에서 고른다. 까닭과 이름은 힌트에 없다', () => {
  const common = ['끝에는 어떤 모양이 되어야 하나요?', '끝나기 바로 전에는 어떤 모양일까요?', '더 작은 판이라면 할 수 있을까요?', '전에 해 본 판 가운데 닮은 판이 있었나요?', '규칙 하나가 없다면 어디까지 되나요?', '아직 한 번도 건드리지 않은 곳이 있나요?', '아까와 다른 곳에서 시작하면 어떻게 되나요?'];
  for (const [key, list] of Object.entries(T.hints)) {
    assert.equal(list.length, 2, key);
    assert.notEqual(list[0], list[1]);
    assert.ok(common.includes(list[0]), list[0]);
    for (const hint of list) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
      assert.doesNotMatch(hint, /홀수|짝수|홀짝|뒤바뀐|고리|바뀌지 않는|빼기|\d/, hint);
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
  // 수와 차례 뒤에는 받침과 상관없는 말('번', '개', '칸', '번째')만 붙인다
  for (const [path, text] of strings) assert.doesNotMatch(text, /\{(k|n|f|total|no)\}(이|가|은|는|을|를|과|와|으로|로)/, path);
  assert.equal(fill(T.labels['grid-piece'], { no: '첫 ', k: 2, n: 5 }), '위에서 첫 번째 줄 왼쪽에서 2번째 칸, 5번 말');
  assert.equal(fill(T.labels['row-piece'], { no: '3', n: 1 }), '왼쪽에서 3번째 자리, 1번 말');
});

test('화면 글에 영어 낱말과 보상 낱말이 없고, "~요"로 끝나는 말투다. 한 문장은 60자를 넘지 않는다', () => {
  for (const [path, text] of strings) assert.doesNotMatch(text.replace(/\{[^{}]*\}/g, ''), /[A-Za-z]/, `${path}: ${text}`);
  assert.doesNotMatch(own, /[A-Za-z]/);
  assert.doesNotMatch(own, /별|점수|순위|레벨|연속/);
  const spoken = [...Object.values(T.home.ask), T.home.pick, ...Object.values(T.rules), ...Object.values(T.play), ...Object.values(T.hints).flat(), ...Object.values(T.right), ...['swap', 'slide', 'impossible'].map((key) => T.solution[key]), ...['intro', 'swap', 'slide', 'farthest', 'impossible', 'done', 'keep-not-yet'].map((key) => T.make[key]), ...T.why.map((slide) => slide.say)];
  for (const text of spoken) for (const sentence of sentences(text)) assert.match(sentence, /요[.?!]$/, sentence);
  for (const text of Object.values(T.status)) assert.match(text, /요$/, text);
  for (const text of [T.solution['reason-note'], T.make['picture-swap'], T.make['picture-line']]) assert.match(text, /요$/, text);
  for (const slide of T.why) for (const item of slide.figures) assert.match(item.note, /요$/, item.note);
  for (const [path, text] of strings) for (const sentence of sentences(fill(text, VALUES))) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

test('이름("뒤바뀐 짝", "고리", "바뀌지 않는 것")과 홀짝의 까닭은 "왜 그럴까?"에서만 말한다. 도구는 사실만 보인다', () => {
  for (const [path, text] of strings) {
    if (path.startsWith('why') || path.startsWith('solution.impossible')) continue;
    assert.doesNotMatch(text, /뒤바뀐|고리|바뀌지 않는|홀짝|홀수|짝수/, `${path}: ${text}`);
  }
  assert.doesNotMatch(own, /뒤바뀐|고리|바뀌지 않는|홀짝|홀수|짝수/);
  // 도구의 이름은 하는 일만 말한다
  assert.deepEqual(T.tool, { 'arrows-off': '제자리 화살표 보기', 'arrows-on': '화살표 그만 보기', 'line-off': '한 줄로 읽기', 'line-on': '한 줄 그만 보기' });
  // 처음 켜면 힌트 하나로 센다
  assert.match(code, /hintsOpened: round\.hintsOpened \+ \(round\.toolShown \? 1 : 0\),/);
  // 이야기의 순서: 뜻밖의 결과(늘 홀수) → 옆으로와 위아래로(이름: 뒤바뀐 짝) → 제자리는 0개(이름: 바뀌지 않는 것) → 그대로는 통하지 않는 판 → 맞바꾸기의 고리와 짧은 식
  assert.match(T.why[0].say, /1개, 1개, 3개, 3개, 5개였어요\. 어, 늘 홀수네요\.$/);
  assert.match(T.why[1].say, /뒤바뀐 짝이라고 불러요\.$/);
  assert.match(T.why[2].say, /바뀌지 않는 것이라고 불러요\.$/);
  assert.match(T.why[3].say, /가로가 2칸인 판/);
  assert.match(T.why[4].say, /말의 수 빼기 고리의 수예요\.$/);
});

test('"왜 그럴까?": 그림의 판, 민 말, 건너뛴 수, 짝의 수가 말과 맞고, 다른 방법으로 따져도 같다', () => {
  assert.equal(T.why.length, 5);
  for (const slide of T.why) assert.ok(sentenceCount(slide.say) <= 3, slide.say);
  const views = T.why.map((slide) => slide.figures.map((item) => ({ ...item, board: boardOf(item.rows) })));
  const count = (item) => pairCount(readLine(item.board.cells));
  /** 앞의 판에서 한 번 밀어 뒤의 판이 되는가. 되면 [민 말이 있던 자리, 위아래인가] */
  const slid = (from, to) => slidesFrom(from.board.w, from.board.h, from.board.cells).find(([, after]) => after.join(',') === to.board.cells.join(','));
  /** 그림에 짚은 것(민 말의 새 자리, 건너뛴 수와 건너뛰어진 수)이 앞의 판에서 민 것과 맞는가 */
  function checkStep(from, to) {
    const step = slid(from, to);
    assert.ok(step, to.rows.join('/'));
    const [at, , upDown] = step;
    const hole = from.board.cells.indexOf(0);
    assert.deepEqual(to.marks, [hole], to.rows.join('/'));
    const value = from.board.cells[at];
    if (!upDown) {
      assert.equal(to.jumper, undefined);
      assert.deepEqual(readLine(to.board.cells), readLine(from.board.cells));
      return;
    }
    assert.equal(to.jumper, value);
    const before = readLine(from.board.cells);
    const after = readLine(to.board.cells);
    const [i, j] = [before.indexOf(value), after.indexOf(value)];
    const over = j > i ? after.slice(i, j) : after.slice(j + 1, i + 1);
    assert.deepEqual([...to.over].sort(), [...over].sort());
    assert.equal(over.length, from.board.w - 1);
  }
  // 첫 장: 1과 2만 바뀐 2×3 판에서 네 번 민다. 짝의 수 1, 1, 3, 3, 5
  const first = views[0];
  assert.deepEqual(first.map(count), [1, 1, 3, 3, 5]);
  assert.deepEqual(first[0].board.cells, generateBoard(3, 2).board.cells);
  assert.equal(slideDistances(3, 2).has(first[0].board.cells.join(',')), false);
  for (let index = 1; index < first.length; index++) checkStep(first[index - 1], first[index]);
  first.forEach((item, index) => assert.equal(item.note, index === 0 ? `처음, ${count(item)}개예요` : `${count(item)}개예요`));
  // 둘째 장: 옆으로 민 판(줄이 그대로), 위아래로 민 판 둘(0개에서 2개, 1개에서 1개). 앞의 판은 그 말을 되돌려 민 판이다
  const second = views[1];
  const undo = (item) => {
    const hole = item.board.cells.indexOf(0);
    const cells = item.board.cells.slice();
    cells[hole] = cells[item.marks[0]];
    cells[item.marks[0]] = 0;
    return { ...item, rows: ['앞'], board: { ...item.board, cells } };
  };
  for (const item of second) checkStep(undo(item), item);
  assert.deepEqual(second.map((item) => [count(undo(item)), count(item)]), [[0, 0], [0, 2], [1, 1]]);
  assert.equal(second[1].note, '0개에서 2개가 됐어요');
  assert.equal(second[2].note, '1개에서 1개 그대로예요');
  // 셋째 장: 처음 판은 1개(홀수), 제자리는 0개(짝수)
  assert.deepEqual(views[2].map(count), [1, 0]);
  assert.deepEqual(views[2][1].board.cells, [1, 2, 3, 4, 5, 0]);
  // 넷째 장: 가로 2칸 판에서 위아래로 밀면 한 수만 건너뛴다. 짝의 수가 0개에서 1개
  const fourth = views[3];
  assert.equal(fourth[0].board.w, 2);
  checkStep(fourth[0], fourth[1]);
  assert.deepEqual(fourth.map(count), [0, 1]);
  // 다섯째 장: 맞바꾸기 줄의 고리. 말 5개, 고리 2개 → 맞바꾸니 3개 → 제자리는 5개. 가장 적게 3번(다른 방법으로 다시 센다)
  const fifth = views[4];
  assert.deepEqual(fifth.map((item) => cyclesOf(item.board.cells).length), [2, 3, 5]);
  assert.ok(fifth.every((item) => item.arrows === true));
  assert.equal(swapDistances(5).get(fifth[0].board.cells.join(',')), 5 - 2);
  const [a, b] = fifth[1].marks;
  const swapped = fifth[0].board.cells.slice();
  [swapped[a], swapped[b]] = [swapped[b], swapped[a]];
  assert.deepEqual(swapped, fifth[1].board.cells);
  assert.deepEqual(fifth[0].board.cells, generateBoard(2, 1).board.cells);
  // "왜 그럴까?"는 틀의 기본 문(안 되는 판을 한 번 끝까지 만난 뒤)에 열린다
  assert.equal(tuningFor('slide').whyAfter, undefined);
});

test('풀이와 직접 만들기: 되는 판은 가장 적게 하는 차례, 안 되는 판은 한 줄로 읽은 띠와 짝의 수를 보인다', () => {
  assert.equal(fill(T.solution.impossible, { n: 1 }), '이 판은 아무리 밀어도 모두 제자리로 갈 수 없어요. 한 줄로 읽으면 큰 수가 앞에 선 짝이 1개인데, 밀어도 이 수의 홀짝은 그대로예요.');
  assert.equal(fill(T.make.impossible, { n: 3 }), '이 판은 아무리 밀어도 모두 제자리로 갈 수 없어요. 한 줄로 읽으면 큰 수가 앞에 선 짝이 3개예요.');
  assert.equal(fill(T.make.swap, { k: 3 }), '가장 적게 3번 맞바꾸면 모두 제자리에 가요.');
  // 그 크기에서 가장 많이 밀어야 하는 판이면 그것도 말한다(풀이 프로그램의 표)
  assert.match(code, /const farthest = result\.fewest === farthestOf\(board\.w, board\.h\);/);
  const make = part('id="make-slide"', '<script');
  for (const id of ['slide-make-kind', 'slide-make-size', 'slide-make-fewer', 'slide-make-n', 'slide-make-more', 'slide-make-clear', 'slide-make-board', 'slide-make-solve', 'slide-make-result', 'slide-make-play', 'slide-make-picture']) assert.ok(make.includes(`id="${id}"`), id);
  assert.match(make, /id="slide-make-solve"[^>]*>선생님, 풀어 보세요</);
  assert.match(make, /id="slide-make-play"[^>]*>내가 해 볼래요</);
  assert.match(make, /data-kind="swap"[^>]*>한 줄 맞바꾸기</);
  assert.match(make, /data-kind="small"[^>]*>밀기 2×3 판</);
  assert.match(make, /data-kind="big"[^>]*>밀기 3×3 판</);
  assert.match(code, /mode: custom \? 'made' : rungOf\(level\)\.mode,/);
  assert.match(code, /\n {4}madeBoard,\n/);
});

test('index.html: 이 형식의 카드, 판, 판 아래, 오른쪽 칸, 도구, 직접 만들기가 있다. 틀에 이어져 있다', () => {
  for (const id of ['home-slide-sample', 'home-slide-ask', 'home-slide-play', 'home-slide-pick', 'home-slide-make', 'home-slide-blank', 'slide-board', 'slide-grid', 'slide-line-box', 'slide-line', 'slide-count', 'slide-status', 'slide-swaps', 'slide-slides', 'slide-pairs', 'slide-tool', 'slide-pad', 'slide-goal', 'slide-record-box', 'slide-best', 'slide-again', 'slide-stop', 'slide-impossible', 'make-slide']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(part('id="slide-title"', '</section>'), /<h2 id="slide-title">번호 말 제자리 찾기<\/h2>/);
  assert.ok(visibleText(part('id="slide-title"', '</section>')).includes(T.home.ask.swap));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-slide-make" class="menu-item"/);
  assert.match(part('id="slide-pad"', 'id="domino-pad"'), /id="slide-impossible"[^>]*>불가능해요</);
  // 판 아래의 띠와 짝의 수는 하는 일만 적는다
  assert.match(part('id="slide-board"', '<div class="board-foot">'), />위 줄부터 한 줄로 읽은 수</);
  assert.match(part('id="slide-count"', 'id="fold-count"'), />큰 수가 앞에 선 짝 <strong id="slide-pairs">/);
  // 카드는 세 방향에서 본 그림 다음, 퍼즐 만들기 앞이다
  assert.ok(html.indexOf('id="views-title"') < html.indexOf('id="slide-title"'));
  assert.ok(html.indexOf('id="slide-title"') < html.indexOf('id="make-title"'));
  // 틀이 형식을 안다(형식 목록의 맨 뒤, 세 방향에서 본 그림 다음)
  assert.match(read('src/main.js'), /views: createViews\(frame\), slide: createSlide\(frame\) \};/);
  assert.match(read('src/check-main.js'), /\['slide', '번호 말 제자리 찾기'\]/);
  assert.match(read('src/core/smaller.js'), /views: smallerViews, slide: smallerSlide \};/);
  assert.match(code, /smaller: \(round, turn\) => smallerSlide\(\{ mode: round\.mode, board: round\.board \}, turn\),/);
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
  assert.match(code, /\$\('undo'\)\.hidden = false;\s*\$\('reset'\)\.hidden = false;/);
  assert.match(code, /ruleAside: true,/);
  // 시계와 스스로 넘어가는 것이 없다
  assert.doesNotMatch(board + code, /setInterval|setTimeout|requestAnimationFrame/);
});

test('화면: 말은 44픽셀보다 크고, 고른 말, 빈칸, 화살표의 고리, 건너뛴 수는 색만이 아니라 모양으로도 보인다. 움직임은 0.2초 안이고 줄이는 설정을 따른다', () => {
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const block = (selector) => plain.match(new RegExp(`\\n${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`))[1];
  // 판 칸(가로 476픽셀쯤, 세로 560픽셀쯤)에 3×3 판은 말 한 변이 130픽셀까지, 여덟 말의 줄은 476 / 8 = 59픽셀쯤이다
  assert.match(block('.sl-svg'), /max-width: calc\(var\(--w\) \* 130px\);/);
  assert.ok(476 / 8 >= 44);
  assert.ok(Math.min(476, 520) / 3 >= 44);
  // 고른 말: 굵은 금빛 점선 테두리와 들린 모습. 빈칸: 점선. 짚은 말: 굵은 테두리. 건너뛴 수: 굵은 테두리, 건너뛰어진 수: 점선
  assert.match(block('.sl-pick'), /stroke-dasharray/);
  assert.match(plain, /\.sl-tile\.picked,\n\.sl-hole-group\.picked \{\s*transform: translateY\(-10px\);/);
  assert.match(block('.sl-hole'), /stroke-dasharray/);
  assert.match(block('.sl-chip.jumper'), /border: 5px solid/);
  assert.match(block('.sl-chip.over'), /border: 3px dashed/);
  // 고리마다 선의 모양이 다르다
  const dashes = [1, 2, 3].map((index) => plain.match(new RegExp(`\\.sl-ring-${index} \\.sl-arc,\\n\\.sl-stay\\.sl-ring-${index} \\{([^}]*)\\}`))[1].match(/stroke-dasharray: ([^;]+);/)[1]);
  assert.equal(new Set(dashes).size, 3);
  assert.match(board, /RING_STYLES = 4/);
  // 움직임은 0.2초 안이고, 움직임을 줄이는 설정에서는 없다
  assert.match(block('.sl-moved'), /animation: sl-slide 0\.15s/);
  assert.match(block('.sl-swing'), /animation: sl-swing 0\.2s/);
  assert.match(plain, /@media \(prefers-reduced-motion: reduce\) \{\s*\.sl-moved,\s*\.sl-swing \{\s*animation: none;/);
});

/** 끝까지 한 판의 기록 하나 */
function finished(more = {}) {
  return { kind: 'round', id: `r-${more.id ?? 1}`, format: 'slide', level: 1, seed: 1, custom: false, mode: 'swap', outcome: 'solved', hintsOpened: 0, answers: [{ t: 10, answer: 'done:1', correct: true, guess: null }], wrongCount: 0, moveCount: 1, seconds: 20, solution: { possible: true, fewest: 1, count: 3 }, ...more };
}

test('수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다. "왜 그럴까?"는 안 되는 판을 한 번 끝까지 만난 뒤에 열린다', () => {
  const tuning = tuningFor('slide');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 5);
  assert.equal(tuning.hintCount, 2);
  assert.equal(tuning.whyAfter, undefined);
  assert.equal(tuning.fastWin, undefined);
  assert.equal(tuning.fastSolo, undefined);
  assert.match(read('src/core/level.js'), /번호 말 제자리 찾기\(모두 임시\)/);
  assert.deepEqual(recommend([], 'slide'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  assert.deepEqual(recommend([finished({ id: 1 }), finished({ id: 2 })], 'slide'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  // 되는 판의 "불가능해요"나 가장 적지 않은 다 놓기가 있으면 "한 번에"가 아니다
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, wrongCount: 1 })], 'slide').offerHarder, false);
  assert.equal(whyUnlocked([finished()], 'slide'), false);
  const met = finished({ id: 3, level: 3, seed: 2, mode: 'small', answers: [{ t: 10, answer: 'impossible', correct: true, guess: null }], solution: { possible: false, fewest: null, count: 1 } });
  assert.equal(whyUnlocked([met], 'slide'), true);
  assert.equal(whyUnlocked([{ ...met, side: true }], 'slide'), false);
  assert.match(code, /solution: \{ possible: solution\.possible, fewest: solution\.fewest, count: solution\.count \},/);
});
