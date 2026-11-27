// 지우고 쓰기 예언 대본 점검: 화면에 나오는 글이 약속을 지키는지, "왜 그럴까?"와 선생님 쪽지의 말이 다른 방법으로 따진 것과 맞는지 본다.
// 한 일과 사실만 말한다(내 쪽지가 달라도 틀렸다고 하지 않는다), 힌트는 두 높이, 규칙은 세 문장 안, 색만으로 알리지 않는다,
// 수학의 이름(불변량)과 "바뀌지 않는"이라는 말은 "왜 그럴까?"의 마지막 장에서만. 화면 코드와 틀에 이 형식이 이어져 있는지도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { LADDER, generateBoard } from '../src/core/erase-ladder.js';
import { STORY, checkBoard, combine, leftTrail, replay } from '../src/core/erase.js';
import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { endsClosed, fill, sentenceCount } from '../src/core/text.js';
import { bruteFinals } from './helpers/brute-erase.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/erase.json'));
const html = read('index.html');
const code = read('src/formats/erase.js');
const board = read('src/ui/erase-board.js');
const css = read('src/app.css').replace(/\/\*[\s\S]*?\*\//g, '');

const VALUES = { k: 17, f: 4, n: 5, no: '첫 ', face: '홀수', total: 21 };
/** 그림과 판의 값은 글이 아니다 */
const DATA_KEYS = ['picture', 'blank', 'seed', 'level'];

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
const pad = part('id="erase-pad"', '접히는 모양 가리기: 판의 종류마다');
const own = [part('id="erase-title"', 'id="make-title"'), part('id="erase-sum"', 'id="why"'), part('id="erase-count"', '접히는 모양 가리기: 할 일 한 줄'), pad, part('id="make-erase"', '<script')].map(visibleText).join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const said = strings.map(([, text]) => text).join(' ');
const end = (number) => (endsClosed(number) ? 'c' : 'o');
const NAME_KEYS = ['why.same-name', 'why.less-name', 'why.diff-name'];

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 단계 목록이 사다리와 같다', () => {
  assert.equal(T.title, '지우고 쓰기 예언');
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.deepEqual(
    T.levels.map((item) => item.level),
    LADDER.map((rung) => rung.level),
  );
  assert.deepEqual(
    T.levels.map((item) => item.name),
    ['같으면 0, 다르면 1', '합에서 1 빼기', '홀수일까 짝수일까', '0을 남길 수 있을까', '긴 칠판', '직접 만들기'],
  );
  for (const entry of T.levels.filter((item) => !item.picture.blank)) assert.equal(checkBoard(generateBoard(entry.level, entry.picture.seed).board), null);
  // 4단계의 그림은 처음 만나는 안 되는 판(1, 2, 4)이 아니라 0을 남길 수 있는 첫 판이면 답을 미리 보여 주지 않는다. 둘 다 아니고 그림일 뿐이다
  assert.deepEqual(Object.keys(T.home.ask).sort(), ['less', 'long', 'parity', 'same', 'zero']);
  assert.deepEqual(Object.keys(T.ruleNames), ['same', 'less', 'diff']);
});

test('한 일과 사실만 말한다. 내 쪽지가 선생님 쪽지와 달라도 두 쪽지에 적힌 것만 말한다', () => {
  assert.doesNotMatch(said, /틀렸|틀린|아니에요|땡|정답|아쉽|실수|실패|성공|잘했|훌륭|대단|최고|멋져|멋진|완벽|축하|천재|똑똑|굉장|맞아요|맞혔|아깝/);
  assert.doesNotMatch(own, /틀렸|틀린|아니에요|땡|아쉽|실패|잘했|훌륭|대단|최고|멋/);
  // 끝에 남은 수, 선생님 쪽지, 내 쪽지: 받침에 맞는 말
  assert.equal(fill(T.play[`end-${end(8)}`], { k: 8 }), '끝에 8이 남았어요.');
  assert.equal(fill(T.play[`end-${end(2)}`], { k: 2 }), '끝에 2가 남았어요.');
  assert.equal(fill(T.play[`end-${end(0)}`], { k: 0 }), '끝에 0이 남았어요.');
  assert.equal(fill(T.play[`note-${end(46)}`], { k: 46 }), '선생님 쪽지에는 46이 적혀 있어요.');
  assert.equal(fill(T.play[`kid-${end(7)}`], { k: 7 }), '내 쪽지에는 7을 적었어요.');
  assert.equal(fill(T.play[`kid-${end(5)}`], { k: 5 }), '내 쪽지에는 5를 적었어요.');
  assert.equal(fill(T.play['note-face'], { face: T.parity.odd }), '선생님 쪽지에는 홀수라고 적혀 있어요.');
  assert.equal(fill(T.right[`two-${end(3)}`], { k: 1, n: 3 }), '첫 번째에는 1, 두 번째에는 3이 남았어요.');
  assert.equal(fill(T.status[`typing-${end(12)}`], { k: 12 }), '12를 적으려면 적기를 눌러요');
  assert.match(code, /const byEnd = \(group, key, number\) => group\[`\$\{key\}-\$\{end\(number\)\}`\];/);
  for (const [path] of strings.filter(([key]) => /-c$/.test(key))) {
    const twin = path.replace(/-c$/, '-o');
    assert.ok(strings.some(([key]) => key === twin), twin);
  }
  // 내 쪽지는 기록에만 견준다. 다르면 wrongCount에 남기고 말은 두 쪽지에 적힌 것만 한다
  assert.match(code, /if \(!correct\) round\.wrongCount \+= 1;\s*lines\.push\(kidLine\(round\)\);/);
  assert.equal(T.right['kid-match'], '내 쪽지와 선생님 쪽지에 같은 것이 적혀 있어요.');
  assert.doesNotMatch(code, /Math\.random/);
  assert.doesNotMatch(board, /Math\.random/);
  // 판 아래에는 칠판의 수의 개수와 지운 횟수, 합만 적는다. 무르거나 되돌린 수는 적지 않는다
  for (const line of code.split('\n')) if (/textContent/.test(line)) assert.doesNotMatch(line, /undoCount|resetCount|againCount|endCount|wrongCount|impossibleCount|moveCount/, line.trim());
});

test('무르기, 처음으로, 한 번 더 지우기 뒤에는 앞의 말을 덮는 한마디를 한다. 다 지워서 쪽지를 연 것은 무를 수 없다', () => {
  assert.equal(T.play.undo, '무르기 전 모습으로 돌아왔어요.');
  assert.equal(T.play.reset, '처음 칠판으로 돌아왔어요.');
  assert.match(T.play.restart, /^처음 칠판으로 돌아왔어요\./);
  assert.match(code, /frame\.say\(T\.play\.undo\);/);
  assert.match(code, /frame\.say\(T\.play\.reset\);/);
  assert.match(code, /frame\.say\(T\.play\.restart\);/);
  assert.match(code, /if \(round\.done \|\| round\.trail\.length === 0 \|\| \(askOf\(round\) !== 'zero' && ended\(round\)\)\) return;/);
  // 0이 아닌 수가 남으면 그 수와 할 수 있는 일을 말한다
  assert.equal(T.play['try-more'], '무르거나 처음으로 돌아가 다른 차례로 지워 볼 수 있어요.');
});

test('규칙 설명은 묻는 것까지 세 문장 안이다. 규칙마다, 묻는 것마다 있다. 직접 만들기의 안내 글도 세 문장 안이다', () => {
  assert.deepEqual(Object.keys(T.rules), ['same', 'less', 'diff']);
  assert.deepEqual(Object.keys(T.asks), ['watch', 'number', 'parity', 'zero']);
  for (const rule of Object.values(T.rules)) {
    assert.match(rule, /^칠판의 수 두 개를 지우고 새 수 하나를 써요\. /);
    assert.match(rule, /수가 하나 남을 때까지 해요\.$/);
    for (const ask of Object.values(T.asks)) assert.ok(sentenceCount(`${rule} ${ask}`) <= 3, `${rule} ${ask}`);
  }
  assert.match(code, /ruleLine: \(round\) => `\$\{T\.rules\[round\.board\.rule\]\} \$\{T\.asks\[askOf\(round\)\]\}`,/);
  // 규칙 글에는 까닭(합, 홀짝이 그대로)을 적지 않는다
  for (const rule of Object.values(T.rules)) assert.doesNotMatch(rule, /그대로|바뀌지|늘 |홀수|짝수/);
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 55);
  const mine = guides[54];
  assert.ok(sentenceCount(mine) <= 3, mine);
  assert.match(mine, /^숫자를 누르고 올리기를 누르면 칠판에 수가 적히고, 칠판의 수를 누르면 빠져요\./);
  assert.match(mine, /선생님도 끝에 남을 수를 하나로 맞힐 수 없는 칠판이 있을까요\?$/);
});

test('힌트는 판의 종류마다 두 개이고, 하나하나가 질문 한 문장이다. 힌트 1은 함께 쓰는 목록에서 고른다. 까닭이나 이름을 말해 버리지 않는다', () => {
  assert.deepEqual(Object.keys(T.hints).sort(), ['less', 'long', 'made', 'parity', 'same', 'zero']);
  const common = ['끝에는 어떤 모양이 되어야 하나요?', '끝나기 바로 전에는 어떤 모양일까요?', '더 작은 판이라면 할 수 있을까요?', '전에 해 본 판 가운데 닮은 판이 있었나요?', '규칙 하나가 없다면 어디까지 되나요?', '아직 한 번도 건드리지 않은 곳이 있나요?', '아까와 다른 곳에서 시작하면 어떻게 되나요?'];
  for (const [key, list] of Object.entries(T.hints)) {
    assert.equal(list.length, 2, key);
    assert.notEqual(list[0], list[1]);
    assert.ok(common.includes(list[0]), list[0]);
    for (const hint of list) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
      assert.doesNotMatch(hint, /때문|해야 해요|하면 돼요|그대로|바뀌지|홀수|짝수|불변/, hint);
    }
  }
  assert.match(code, /hints: \(round\) => T\.hints\[round\.mode\],/);
});

test('글의 빈칸({이름})은 정해진 이름만 쓰고, 채울 값이 모자라지 않는다. 다른 것은 다른 이름으로 읽는다', () => {
  const allowed = new Set(['k', 'f', 'n', 'no', 'total', 'level', 'tag', 'face']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
    assert.ok(fill(text, VALUES).length > 0, path);
  }
  assert.equal(fill(T.labels.chip, { no: '첫 ', k: 5 }), '첫 번째 수 5');
  // 선생님 쪽지와 내 쪽지, 접힌 쪽지와 연 쪽지, 고른 수와 방금 쓴 수는 다른 이름으로 읽는다
  assert.notEqual(T.note.teacher, T.note.kid);
  assert.notEqual(T.labels['teacher-shut'], fill(T.labels['teacher-open'], { face: '8' }));
  assert.notEqual(fill(T.labels.picked, { face: '' }), fill(T.labels.fresh, { face: '' }));
});

test('화면 글에 영어 낱말과 보상 낱말이 없고, "~요"로 끝나는 말투다. 한 문장은 60자를 넘지 않는다', () => {
  for (const [path, text] of strings) assert.doesNotMatch(text.replace(/\{[^{}]*\}/g, ''), /[A-Za-z]/, `${path}: ${text}`);
  assert.doesNotMatch(own, /[A-Za-z]/);
  assert.doesNotMatch(own, /별|점수|순위|레벨|연속|빨리/);
  assert.doesNotMatch(said, /점수|순위|레벨|연속|빨리|서둘/);
  const notes = ['note', 'parity', 'tool', 'ruleNames', 'labels', 'status', 'solution.start', 'solution.step', 'solution.sum', 'why.start', 'why.step', 'title', 'levels'];
  const spoken = strings.filter(([path]) => !notes.some((key) => path === key || path.startsWith(`${key}.`) || path.startsWith(`${key}[`)) && !/^why\.(case|sum|left)-/.test(path) && !/^make\.picture/.test(path));
  for (const [path, text] of spoken) for (const sentence of sentences(fill(text, VALUES))) assert.match(sentence, /요[.?!]$/, `${path}: ${sentence}`);
  for (const text of Object.values(T.status)) assert.match(fill(text, VALUES), /요$/, text);
  for (const [path, text] of strings.filter(([key]) => /^why\.(case|sum|left)-/.test(key) || /^make\.picture/.test(key))) assert.match(fill(text, VALUES), /요$/, path);
  for (const [path, text] of strings) for (const sentence of sentences(fill(text, VALUES))) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

test('수학의 이름(불변량)과 "바뀌지 않는"이라는 말은 "왜 그럴까?"의 마지막 장에서만 말한다. 식과 공식은 어디에도 없다', () => {
  const before = strings.filter(([path]) => !NAME_KEYS.includes(path)).map(([, text]) => text).join(' ');
  assert.doesNotMatch(before, /불변|바뀌지 않|공식/);
  for (const key of NAME_KEYS) {
    const text = T.why[key.slice(4)];
    assert.match(text, /수학에서는 불변량이라고 불러요\.$/, key);
    assert.doesNotMatch(text, /[=+×÷]|공식/, key);
  }
  assert.doesNotMatch(visibleText(html), /불변|바뀌지 않는 수/);
  // 마지막 장은 마지막 차례다
  assert.match(code, /say: T\.why\[`\$\{rule\}-name`\],/);
  // 까닭(합이 어떻게 바뀌는지)은 "왜 그럴까?"와 풀이에서만 말한다
  const reason = /합이 2 줄|꼭 1만|두 배만큼|홀짝은 그대로/;
  for (const [path, text] of strings) if (!path.startsWith('why.') && !path.startsWith('solution.')) assert.doesNotMatch(text, reason, `${path}: ${text}`);
});

test('"왜 그럴까?": 지울 때마다 적은 합 → 한 번 지울 때 합이 어떻게 바뀌는지 → 끝에 남는 수 → 통하지 않는 칠판과 이름. 그림의 수는 다른 방법으로 다시 따진다', () => {
  for (const [key, text] of Object.entries(T.why)) assert.ok(sentenceCount(text) <= 3, key);
  // 정해 둔 작은 칠판(수가 여섯을 넘는 칠판에서 쓴다): 앞의 두 수부터 지우면 합이 차례로 이렇다
  const sums = (story) => replay(story, leftTrail(story)).sums;
  assert.deepEqual(sums(STORY.same), [3, 3, 1, 1, 1]);
  assert.deepEqual(sums(STORY.less), [14, 13, 12, 11]);
  assert.deepEqual(sums(STORY.diff), [13, 11, 5, 1]);
  assert.deepEqual(bruteFinals('same', STORY.same.nums), [1]);
  assert.deepEqual(bruteFinals('less', STORY.less.nums), [11]);
  assert.deepEqual(bruteFinals('diff', STORY.diff.nums), [1, 3, 5]);
  // 둘째 장(같으면 0 다르면 1): 1과 1은 0을 써서 합이 2 줄고, 0과 0은 0, 0과 1은 1을 써서 그대로다
  assert.deepEqual([combine('same', 1, 1), combine('same', 0, 0), combine('same', 0, 1)], [0, 0, 1]);
  assert.equal(T.why['case-two'], '0을 써서 합이 2 줄어요');
  // 둘째 장(차): 합은 작은 수의 두 배만큼 준다. 이야기의 칠판에서 모두 따진다
  for (let a = 0; a <= 9; a++) for (let b = 0; b <= 9; b++) assert.equal(a + b - combine('diff', a, b), 2 * Math.min(a, b));
  for (let a = 1; a <= 9; a++) for (let b = 1; b <= 9; b++) assert.equal(a + b - combine('less', a, b), 1);
  assert.match(code, /fill\(T\.why\['case-diff'\], \{ n: 2 \* Math\.min\(a, b\) \}\)/);
  // 셋째 장(합에서 1 빼기): 수가 n개면 n - 1번 지워서 처음 합보다 n - 1만큼 작은 수가 남는다
  assert.equal(fill(T.why[`less-end-${end(11)}`], { n: 4, f: 3, total: 14, k: 11 }), '수가 4개면 하나가 남을 때까지 3번 지워요. 그래서 끝에는 처음 합 14보다 3만큼 작은 11이 남아요. 지우는 차례는 상관없어요.');
  assert.match(code, /fill\(byEnd\(T\.why, 'less-end', final\), \{ n: board\.nums\.length, f: board\.nums\.length - 1, total: start, k: final \}\)/);
  // 넷째 장: 같으면 0 다르면 1에 2와 4를 지우면 1을 써서 합이 6에서 1이 된다(홀짝이 바뀐다)
  assert.equal(combine('same', 2, 4), 1);
  assert.match(T.why['same-name'], /^그런데 2와 4처럼 0과 1이 아닌 수를 지우면 1을 써서 합이 6에서 1이 돼요\./);
  // 넷째 장(합에서 1 빼기): 차를 쓰면 1, 2, 3에서 1과 2를 먼저 지우면 2, 1과 3을 먼저 지우면 0이 남는다
  assert.deepEqual(bruteFinals('diff', [combine('diff', 1, 2), 3]), [2]);
  assert.deepEqual(bruteFinals('diff', [combine('diff', 1, 3), 2]), [0]);
  assert.deepEqual(bruteFinals('diff', [1, 2, 3]), [0, 2]);
  // 넷째 장(차): 2와 4만 있는 칠판은 합이 짝수인데 2만 남는다
  assert.deepEqual(bruteFinals('diff', [2, 4]), [2]);
  assert.match(T.why['diff-name'], /^그런데 2와 4만 있는 칠판은 합이 짝수인데도 2가 남아서 0을 남길 수 없어요\./);
  // 셋째 장(차): 합이 짝수인 칠판은 몇이 남을지 차례에 따라 다르다고만 말한다(0을 남길 수 있다고 하지 않는다)
  assert.doesNotMatch(T.why['diff-end-even'], /0을 남길 수 있/);
  // 아이의 칠판(수가 여섯까지)으로 이야기하고, 더 크면 정해 둔 작은 칠판으로 한다
  assert.match(code, /if \(board\.nums\.length > STORY_MAX\) return \{ board: copyBoard\(STORY\[board\.rule\]\), trail: leftTrail\(STORY\[board\.rule\]\) \};/);
  assert.match(code, /const trail = round\.ends\[0\]\?\.trail \?\? \(ended\(round\) \? round\.trail : \(frame\.solution\?\.order \?\? leftTrail\(board\)\)\);/);
});

test('풀이와 직접 만들기: 끝에 남는 수(또는 남길 수 있는 수)와 0을 남길 수 있는지를 말한다. 합이 짝수인데 남길 수 없으면 모든 차례를 해 보았다고 말한다', () => {
  assert.equal(fill(T.solution[`fixed-${end(8)}`], { k: 8 }), '어떤 차례로 지워도 끝에 8이 남아요. 한 가지 차례를 보여 줄게요.');
  assert.equal(fill(T.solution[`finals-${end(5)}`], { k: '1, 3, 5', face: '홀수' }), '이 칠판에서 끝에 남길 수 있는 수는 1, 3, 5예요. 모두 홀수예요.');
  assert.match(T.solution.impossible, /처음 합이 \{n\}인데, 두 수를 지우고 차를 써도 합이 홀수인지 짝수인지는 그대로예요\.$/);
  assert.equal(T.make['zero-tried'], '합은 짝수지만, 선생님이 모든 차례를 해 보니 0은 남길 수 없어요.');
  assert.match(code, /lines\.push\(result\.zero \? T\.make\['zero-yes'\] : result\.parity === 1 \? T\.make\['zero-odd'\] : T\.make\['zero-tried'\]\);/);
  // 차를 쓰는 칠판은 수가 여덟 개까지만 만든다(남길 수 있는 수를 모두 따진다)
  assert.match(code, /if \(board\.rule === 'diff' && board\.nums\.length > SEARCH_CHIPS\) return fill\(T\.make\['diff-many'\], \{ n: SEARCH_CHIPS \}\);/);
  assert.match(code, /export const MAKE_MAX = 12;/);
  const make = part('id="make-erase"', '<script');
  for (const id of ['erase-make-rule', 'erase-make-shown', 'erase-make-keys', 'erase-make-clear', 'erase-make-board', 'erase-make-solve', 'erase-make-result', 'erase-make-play', 'erase-make-picture']) assert.ok(make.includes(`id="${id}"`), id);
  assert.match(make, /id="erase-make-solve"[^>]*>선생님, 맞혀 보세요</);
  assert.match(make, /id="erase-make-play"[^>]*>내가 해 볼래요</);
  assert.deepEqual([...make.matchAll(/data-rule="(\w+)"/g)].map((match) => match[1]), ['same', 'less', 'diff']);
  // 규칙의 이름은 대본에서 채운다(카드의 글자가 index.html에 없다)
  assert.match(code, /button\.textContent = T\.ruleNames\[button\.dataset\.rule\];/);
  assert.match(code, /mode: custom \? 'made' : rungOf\(level\)\.mode,/);
  assert.match(code, /\n {4}madeBoard,\n/);
  assert.doesNotMatch(code, /bestOf/);
});

test('index.html: 이 형식의 카드, 판, 판 아래, 도구, 답하는 칸, 직접 만들기가 있다. 틀에 이어져 있다', () => {
  for (const id of ['home-erase-sample', 'home-erase-ask', 'home-erase-play', 'home-erase-pick', 'home-erase-make', 'home-erase-blank', 'erase-board', 'erase-count', 'erase-status', 'erase-left', 'erase-moves', 'erase-sum-line', 'erase-sums', 'erase-sum', 'erase-pad', 'erase-how', 'erase-write', 'erase-shown', 'erase-keys', 'erase-pick', 'erase-odd', 'erase-even', 'erase-maybe', 'erase-impossible', 'erase-open', 'erase-again', 'make-erase']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(part('id="erase-title"', '</section>'), /<h2 id="erase-title">지우고 쓰기 예언<\/h2>/);
  assert.ok(visibleText(part('id="erase-title"', '</section>')).includes(T.home.ask.same));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-erase-make" class="menu-item"/);
  assert.deepEqual(
    [...pad.matchAll(/data-key="(\w+)"/g)].map((match) => match[1]),
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'erase', '0', 'enter'],
  );
  assert.match(pad, /data-key="enter">적기</);
  assert.match(pad, /id="erase-impossible"[^>]*>불가능해요</);
  assert.match(pad, /id="erase-open"[^>]*>선생님 쪽지 열기</);
  assert.match(pad, /id="erase-again"[^>]*>다른 차례로 한 번 더 지우기</);
  // 홀수와 짝수 단추의 글은 대본에서 채운다(다른 형식의 화면 글 검사가 index.html의 홀수, 짝수를 막는다)
  assert.match(pad, /<button id="erase-odd" class="btn huge" type="button"><\/button>/);
  assert.doesNotMatch(visibleText(html), /홀수|짝수/);
  assert.match(code, /\$\('erase-odd'\)\.textContent = T\.parity\.odd;/);
  assert.match(part('id="erase-sum"', 'id="why"'), /id="erase-sum" class="btn wide" type="button" aria-pressed="false" hidden>합 보기</);
  // 카드는 가로세로 수열 퍼즐 다음, 퍼즐 만들기 앞이다
  assert.ok(html.indexOf('id="seqgrid-title"') < html.indexOf('id="erase-title"'));
  assert.ok(html.indexOf('id="erase-title"') < html.indexOf('id="make-title"'));
  // 틀이 형식을 안다(형식 목록의 맨 뒤, 가로세로 수열 퍼즐 다음)
  assert.match(read('src/main.js'), /seqgrid: createSeqgrid\(frame\), erase: createErase\(frame\) \};/);
  assert.match(read('src/check-main.js'), /\['erase', '지우고 쓰기 예언'\]/);
  assert.match(read('src/core/smaller.js'), /seqgrid: smallerSeqgrid, erase: smallerErase \};/);
  assert.match(code, /smaller: \(round, turn\) => smallerErase\(\{ mode: round\.mode, board: round\.board \}, turn\),/);
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
  assert.match(code, /\$\('undo'\)\.hidden = false;\s*\$\('reset'\)\.hidden = false;/);
  assert.match(code, /ruleAside: true,/);
  assert.doesNotMatch(board + code, /setInterval|setTimeout|requestAnimationFrame/);
});

test('도구 "합 보기": 처음 켜면 힌트 하나로 세고, 끝난 판에서는 누를 수 없다. 무엇이 그대로인지는 말하지 않는다', () => {
  assert.deepEqual(T.tool, { off: '합 보기', on: '합 감추기' });
  assert.match(code, /if \(round\.sumOn\) \{\s*round\.sumShown = true;\s*round\.sumCount \+= 1;\s*\}/);
  assert.match(code, /hintsOpened: round\.hintsOpened \+ \(round\.sumShown \? 1 : 0\),/);
  assert.match(code, /\$\('erase-sum'\)\.disabled = round\.done;/);
  assert.match(code, /\$\('erase-sums'\)\.textContent = state\.sums\.join\(' → '\);/);
});

test('화면: 수 카드와 숫자판 단추는 44픽셀보다 작아지지 않는다. 고른 수, 방금 쓴 수, 접힌 쪽지는 색만이 아니라 테두리와 무늬로도 보인다', () => {
  assert.match(css, /\n\.er-chip \{[^}]*min-width: 44px;[^}]*min-height: 44px;/);
  // 카드 한 변: 판 칸에 맞추되 104픽셀을 넘지 않는다. 1180×820 화면의 판 칸(높이 448픽셀 남짓, 쪽지 칸과 칠판 테두리 156픽셀)에서
  // 수가 스무 개면 다섯 줄에 넷씩이라 한 변이 60픽셀쯤이다
  const [, top, side, rows] = css.match(/\.er-chalk \{\s*--c: min\((\d+)px, calc\(\(100cqw - 76px - \(var\(--cols\) - 1\) \* 12px\) \/ var\(--cols\)\), calc\(\(100cqh - (\d+)px - \(var\(--rows\) - 1\) \* (\d+)px\) \/ var\(--rows\)\)\);/);
  assert.equal(Number(top), 104);
  assert.ok((448 - Number(side) - 3 * Number(rows)) / 4 >= 44);
  assert.match(css, /\.er-keys \.key \{\s*min-height: 52px;/);
  assert.match(css, /\.er-chip\.picked \{[^}]*border: 7px solid/);
  assert.match(css, /\.er-chip\.fresh \{[^}]*outline: 4px dashed/);
  assert.match(css, /\.er-note\.shut \{\s*background: repeating-linear-gradient/);
  assert.match(css, /\.er-note\.kid\.empty \{\s*border-style: dashed;/);
  for (const name of ["'er-chip'", "'picked'", "'fresh'", "'er-art-mark'", "'er-art-corner'", "'er-art-ring'"]) assert.ok(board.includes(name), name);
});

/** 끝까지 한 판의 기록 하나 */
function finished(more = {}) {
  return { kind: 'round', id: `r-${more.id ?? 1}`, format: 'erase', level: 1, seed: 1, custom: false, mode: 'same', outcome: 'solved', hintsOpened: 0, answers: [{ t: 10, answer: 'end:1', correct: true, guess: null }], wrongCount: 0, moveCount: 8, seconds: 60, solution: { possible: true, final: 1 }, ...more };
}

test('수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다. "왜 그럴까?"는 판을 한 번 끝까지 한 뒤에 열린다', () => {
  const tuning = tuningFor('erase');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 5);
  assert.equal(tuning.hintCount, 2);
  assert.equal(tuning.whyAfter, 'finished');
  assert.equal(tuning.fastWin, undefined);
  assert.equal(tuning.fastSolo, undefined);
  assert.match(read('src/core/level.js'), /지우고 쓰기 예언\(모두 임시\)/);
  assert.deepEqual(recommend([], 'erase'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  assert.deepEqual(recommend([finished({ id: 1 }), finished({ id: 2 })], 'erase'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  // 내 쪽지가 선생님 쪽지와 다르면 "한 번에"가 아니다
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, wrongCount: 1 })], 'erase').offerHarder, false);
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, seconds: 300 })], 'erase').offerHarder, false);
  assert.equal(whyUnlocked([], 'erase'), false);
  assert.equal(whyUnlocked([finished()], 'erase'), true);
  assert.equal(whyUnlocked([finished({ side: true })], 'erase'), false);
  assert.match(code, /wrongCount: round\.wrongCount,/);
  assert.match(code, /solution: \{ possible: solution\.possible, final: solution\.final, finals: solution\.finals, parity: solution\.parity, zero: solution\.zero, sum: solution\.sum \},/);
});
