// 핀에 실 감기 대본 점검: 화면에 나오는 글이 약속을 지키는지, "왜 그럴까?"의 그림과 말이 다른 방법으로 센 것과 맞는지 본다.
// 한 일과 사실만 말한다(짐작을 맞다 틀리다 하지 않는다), 힌트는 두 높이, 규칙은 세 문장 안, 색만으로 알리지 않는다, 식을 외우게 하지 않는다.
// 화면 코드와 틀에 이 형식이 이어져 있는지도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { LADDER, generateBoard } from '../src/core/pins-ladder.js';
import { MAX_PINS, MIN_PINS, checkBoard, countOf } from '../src/core/pins.js';
import { fill, sentenceCount } from '../src/core/text.js';
import { gcd, groupsOf, onlyOneAndItself, returnAfter, walkTurns } from './helpers/brute-pins.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/pins.json'));
const html = read('index.html');
const code = read('src/formats/pins.js');
const board = read('src/ui/pins-board.js');
const css = read('src/app.css');

const VALUES = { k: 12, f: 3, n: 16, no: '첫 ', face: '', total: 9 };
/** 그림과 판의 값은 글이 아니다 */
const DATA_KEYS = ['picture', 'blank', 'seed', 'level', 'n', 'k', 'show', 'path'];

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
const own = [part('id="pins-title"', 'id="net-title"'), part('id="pins-numbers"', 'id="net-loop"'), part('id="pins-count"', 'id="net-count"'), part('id="pins-pad"', 'id="net-pad"'), part('id="make-pins"', 'id="make-net"')].map(visibleText).join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const said = strings.map(([, text]) => text).join(' ');

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 단계 목록이 사다리와 같다', () => {
  assert.equal(T.title, '핀에 실 감기');
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.deepEqual(T.levels.map((item) => item.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(T.levels.map((item) => item.name), ['감아 보기', '짐작하고 감기', '표 만들기', '한 가닥으로 다 감기', '핀 12개와 13개', '직접 만들기']);
  for (const entry of T.levels.filter((item) => !item.picture.blank)) assert.equal(checkBoard(generateBoard(entry.level, entry.picture.seed).board), null);
  assert.deepEqual(Object.keys(T.home.ask).sort(), ['guess', 'one', 'predict', 'table', 'wind']);
  assert.deepEqual(Object.keys(T.hints).sort(), ['guess', 'made', 'one', 'predict', 'table', 'wind']);
});

test('한 일과 사실만 말한다. 판정하는 말, 칭찬 낱말이 없다. 짐작은 기록만 하고 맞다 틀리다 하지 않는다', () => {
  assert.doesNotMatch(said, /틀렸|틀린|아니에요|땡|정답|아쉽|실수|실패|성공|잘했|훌륭|대단|최고|멋져|멋진|완벽|축하|천재|똑똑|굉장|맞아요|맞혔|맞았|빗나/);
  assert.doesNotMatch(own, /틀렸|틀린|아니에요|땡|아쉽|실패|잘했|훌륭|대단|최고|멋/);
  // 짐작은 "처음에는 …라고 짐작했어요"로 사실만 말한다
  assert.equal(fill(T.right['guess-was'], { n: 3 }), '처음에는 3가닥이라고 짐작했어요.');
  assert.match(code, /if \(round\.mode === 'guess' && round\.guess !== null\) parts\.push\(fill\(T\.right\['guess-was'\], \{ n: round\.guess \}\)\);/);
  assert.match(code, /guessMatched: /);
  for (const line of code.split('\n')) if (/textContent|frame\.say|parts\.push/.test(line)) assert.doesNotMatch(line, /guessMatched/, line.trim());
  // 한 가닥으로 다 감기의 다른 답에는 무엇이 다른지 사실 하나와 할 수 있는 일을 말한다
  assert.equal(fill(T.play['one-extra'], { k: 3, n: 3 }), '고른 칸 수 가운데 3칸은 실이 3가닥 필요해요. 판에서 감아 볼 수 있어요.');
  assert.equal(fill(T.play['one-missing'], { n: 2 }), '고른 칸 수는 모두 한 가닥이에요. 한 가닥으로 다 감기는 칸 수가 2개 더 있어요.');
  assert.match(code, /round\.wrongCount \+= 1;/);
  // 끝나는 곳: 모두 감았을 때(감아 보기, 짐작하고 감기, 직접 만든 판), 표가 다 찼거나 여러 가닥을 찾았을 때, 고른 것이 꼭 같을 때
  assert.equal([...code.matchAll(/frame\.finish\(/g)].length, 3);
  assert.match(code, /const over = \(round\.mode === 'table' && all\) \|\| \(round\.mode === 'predict' && \(count > 1 \|\| all\)\);/);
  assert.doesNotMatch(code + board, /Math\.random|setInterval|requestAnimationFrame/);
  // 판 아래에는 칸 수, 가닥 수, 실이 지나간 핀 수만 적는다. 누른 수나 무른 수는 적지 않는다
  for (const line of code.split('\n')) if (/textContent/.test(line)) assert.doesNotMatch(line, /moveCount|autoCount|offCount|undoCount|resetCount|wrongCount|skipCount|numbersCount/, line.trim());
  const foot = part('id="pins-count"', 'id="net-count"');
  assert.equal([...foot.matchAll(/<strong/g)].length, 4);
  assert.match(visibleText(foot), /실\s+0\s+가닥/);
  assert.match(visibleText(foot), /실이 지나간 핀\s+0\s+개 \/\s+6\s+개/);
});

test('식과 어려운 낱말을 쓰지 않는다. 가장 큰 공약수, 소수 같은 이름 대신 판에서 센 것을 말한다. 수학의 이름은 "왜 그럴까?"의 마지막 장에만 있다', () => {
  const banned = /공약수|공배수|소수|약수|배수|최대|최소|공식|나머지|원리|법칙|별/;
  // 마지막 장(이름을 붙이는 장)만 "공약수"와 "최대"(최대공약수)를 쓸 수 있다. 다른 낱말은 그 장에서도 막는다
  const last = `why[${T.why.length - 1}]`;
  for (const [path, text] of strings) {
    if (path.startsWith(last)) assert.doesNotMatch(text.replace(/최대공약수|가장 큰 공약수/g, ''), banned, `${path}: ${text}`);
    else assert.doesNotMatch(text, banned, `${path}: ${text}`);
  }
  assert.doesNotMatch(own, banned);
  assert.doesNotMatch(visibleText(html), /공약수/);
  const named = strings.filter(([, text]) => /공약수/.test(text)).map(([path]) => path);
  assert.ok(named.length > 0 && named.every((path) => path.startsWith(last)), named.join(', '));
  assert.match(T.why.at(-1).say, /수학에서는 이 수를 가장 큰 공약수, 최대공약수라고 불러요\./);
  // 생각의 이름은 "왜 그럴까?"에서만 처음 말한다
  for (const [path, text] of strings) if (!path.startsWith('why[2]')) assert.doesNotMatch(text, /돌아오는 때 세기/, path);
  assert.match(T.why[2].say, /돌아오는 때 세기라고 불러요\.$/);
});

test('무르기와 처음으로 뒤에는 앞의 말을 덮는 한마디를 한다. 감기 단추는 0.4초보다 짧게 한 마디씩 감고, 움직임을 줄이는 설정이면 한 번에 감는다', () => {
  assert.equal(T.play.undo, '무르기 전 모습으로 돌아왔어요.');
  assert.equal(T.play.reset, '처음 모습으로 돌아왔어요.');
  assert.match(code, /frame\.say\(T\.play\.undo\);/);
  assert.match(code, /frame\.say\(T\.play\.reset\);/);
  const ms = Number(code.match(/const STEP_MS = (\d+);/)[1]);
  assert.ok(ms > 0 && ms <= 400, `${ms}`);
  assert.match(code, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
  assert.match(code, /if \(still\(\)\) \{/);
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const [, seconds] = plain.match(/\.pins-fresh \{[^}]*animation: pins-fresh ([\d.]+)s/);
  assert.ok(Number(seconds) <= 0.4);
  assert.match(plain, /@media \(prefers-reduced-motion: reduce\) \{\s*\.pins-fresh \{\s*animation: none;/);
});

test('규칙 설명은 세 문장 안이다. 판의 종류마다 있다. 직접 만들기의 안내 글도 세 문장 안이다', () => {
  for (const [mode, ask] of Object.entries(T.asks)) {
    const rule = mode === 'table' || mode === 'one' || mode === 'predict' ? T.rules.free : fill(T.rules.wind, { k: 3 });
    assert.ok(sentenceCount(`${rule} ${fill(ask, { n: 13 })}`) <= 3, mode);
  }
  assert.equal(fill(T.rules.wind, { k: 2 }), '실은 핀에서 시계 방향으로 2칸 앞의 핀으로 가요. 처음 핀으로 돌아오면 한 가닥이 끝나고, 실이 없는 핀에서 새 실을 매요.');
  assert.match(code, /return `\$\{free\(round\) \? T\.rules\.free : fill\(T\.rules\.wind, \{ k: round\.k \}\)\} \$\{ask\}`;/);
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 56);
  assert.ok(sentenceCount(guides[36]) <= 3, guides[36]);
  assert.match(guides[36], /^핀 수와 칸 수를 정하면 선생님이 실을 끝까지 감아 줘요\./);
  // "실이 꼭 다섯 가닥 필요한 판"은 만들 수 있다(핀 10개 5칸씩, 핀 15개 5칸씩과 10칸씩)
  assert.match(guides[36], /실이 꼭 다섯 가닥 필요한 판을 몇 가지나 만들 수 있을까요\?$/);
  const fives = [];
  for (let n = MIN_PINS; n <= MAX_PINS; n++) for (let k = 1; k < n; k++) if (groupsOf(n, k).length === 5) fives.push(`${n}:${k}`);
  assert.deepEqual(fives, ['10:5', '15:5', '15:10']);
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
      assert.doesNotMatch(hint, /때문|해야 해요|하면 돼요|늘 |\d|나누어떨어|가장 큰/, hint);
    }
  }
  // 첫 판에 더 작은 판이 없는 판의 힌트 1은 "더 작은 판"이 아니다(감아 보기, 짐작하고 감기의 첫 판)
  for (const key of ['wind', 'guess', 'made']) assert.doesNotMatch(T.hints[key][0], /더 작은 판/);
  assert.match(code, /hints: \(round\) => T\.hints\[round\.mode\],/);
});

test('글의 빈칸({이름})은 정해진 이름만 쓰고, 채울 값이 모자라지 않는다', () => {
  const allowed = new Set(['k', 'f', 'n', 'no', 'total', 'level', 'tag', 'face']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
    assert.ok(fill(text, VALUES).length > 0, path);
  }
  assert.equal(fill(T.labels.used, { no: '첫 ' }), '첫 번째 가닥이 지나갔어요');
  assert.equal(fill(T.status.off, { n: 4, k: 3 }), '누른 핀은 4칸 앞이에요. 실은 3칸 앞으로 가요');
  assert.equal(fill(T.right['predict-many'], { n: 15, k: 3, f: 3 }), '핀 15개는 3칸씩 감으면 실 3가닥이 필요했어요.');
});

test('화면 글에 영어 낱말과 보상 낱말이 없고, "~요"로 끝나는 말투다. 한 문장은 60자를 넘지 않는다', () => {
  for (const [path, text] of strings) assert.doesNotMatch(text.replace(/\{[^{}]*\}/g, ''), /[A-Za-z]/, `${path}: ${text}`);
  assert.doesNotMatch(own, /[A-Za-z]/);
  assert.doesNotMatch(own, /점수|순위|레벨|연속/);
  const short = ['skip', 'threads', 'pinsOf', 'labels', 'title', 'levels', 'tool'];
  const spoken = strings.filter(([path]) => !short.some((key) => path === key || path.startsWith(`${key}.`) || path.startsWith(`${key}[`)) && !path.startsWith('status') && !path.endsWith('note'));
  for (const [path, text] of spoken) for (const sentence of sentences(text)) assert.match(sentence, /요[.?!]$/, `${path}: ${sentence}`);
  for (const text of Object.values(T.status)) assert.match(text, /요$/, text);
  for (const slide of T.why) for (const item of slide.figures) assert.match(item.note, /요$/, item.note);
  assert.match(T.solution.note, /요$/);
  for (const [path, text] of strings) for (const sentence of sentences(fill(text, VALUES))) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

test('"왜 그럴까?": 4칸씩은 핀 3개만 지나 4가닥 → 몇 번 가야 돌아오는지 → 핀 13개는 늘 한 가닥(이름) → 번갈아 감으면 이야기가 맞지 않는 판 → 수학의 이름(최대공약수)(다른 방법으로 다시 센다)', () => {
  assert.equal(T.why.length, 5);
  for (const slide of T.why) assert.ok(sentenceCount(slide.say) <= 3, slide.say);
  const [first, second, third, fourth, fifth] = T.why;
  // 첫 장: 핀 12개 4칸씩. 한 가닥은 핀 3개, 모두 4가닥
  assert.deepEqual(first.figures.map((item) => [item.n, item.k, item.show]), [[12, 4, 1], [12, 4, 4]]);
  assert.equal(returnAfter(12, 4), 3);
  assert.equal(groupsOf(12, 4).length, 4);
  assert.match(first.say, /핀 3개만 지났어요\./);
  assert.match(first.say, /어, 실이 4가닥이나 필요했어요\.$/);
  assert.equal(first.figures[1].note, `모두 ${gcd(12, 4)}가닥이에요`);
  // 둘째 장: 4칸씩은 3번(12칸), 5칸씩은 12번(60칸) 가야 처음 핀에 온다
  assert.equal(4 * returnAfter(12, 4), 12);
  assert.equal(5 * returnAfter(12, 5), 60);
  assert.match(second.say, /60칸에서야 처음 핀에 와요\./);
  assert.deepEqual(second.figures.map((item) => item.note), [`${returnAfter(12, 4)}번 가면 돌아와요`, `${returnAfter(12, 5)}번 가야 돌아와요`]);
  // 셋째 장: 핀 13개는 1칸부터 12칸까지 어느 칸 수로도 13번을 가야 돌아온다(한 가닥). 핀 12개 6칸씩은 6가닥
  for (let k = 1; k < 13; k++) assert.equal(returnAfter(13, k), 13, `${k}칸`);
  assert.ok(onlyOneAndItself(13));
  assert.equal(groupsOf(12, 6).length, 6);
  assert.equal(groupsOf(13, 6).length, 1);
  assert.deepEqual(third.figures.map((item) => [item.n, item.k, item.show]), [[12, 6, 6], [13, 6, 1]]);
  // 넷째 장: 2칸과 3칸을 번갈아 감으면 핀 5개를 지나 돌아온다. 12는 5개씩 똑같이 나눌 수 없다
  assert.deepEqual(fourth.figures[0].path, walkTurns(12, [2, 3]));
  assert.equal(fourth.figures[0].path.length, 5);
  assert.notEqual(12 % 5, 0);
  assert.match(fourth.say, /핀 5개를 지나 맨 위로 돌아왔어요\./);
  // 다섯째 장(마지막, 수학의 이름): 같은 칸 수로 감으면 가닥 수는 핀 수와 칸 수를 함께 나누어떨어지게 하는 가장 큰 수다.
  // 판의 규격 안의 모든 핀 수와 칸 수에서, 큰 수부터 하나씩 나누어 본 수가 풀이 프로그램의 가닥 수, 묶음 세기와 같다
  const bothDivide = (n, k) => {
    for (let d = Math.min(n, k); d >= 1; d--) if (n % d === 0 && k % d === 0) return d;
    return 1;
  };
  for (let n = MIN_PINS; n <= MAX_PINS; n++) {
    for (let k = 1; k < n; k++) {
      assert.equal(countOf(n, k).count, bothDivide(n, k), `${n}개 ${k}칸`);
      assert.equal(groupsOf(n, k).length, bothDivide(n, k), `${n}개 ${k}칸`);
    }
  }
  assert.match(fifth.say, /^같은 칸 수로 감으면, 실의 가닥 수는 핀 수와 칸 수를 함께 나누어떨어지게 하는 가장 큰 수예요\./);
  assert.match(fifth.say, /핀 12개와 4칸의 최대공약수는 4라서 실이 4가닥이에요\.$/);
  assert.equal(bothDivide(12, 4), 4);
  assert.deepEqual(fifth.figures.map((item) => [item.n, item.k, item.show]), [[12, 4, 4], [15, 6, 3]]);
  for (const item of fifth.figures) {
    // 그림은 가닥을 모두 그린다. 그 수가 그림 아래에 적은 최대공약수다
    assert.equal(item.show, countOf(item.n, item.k).count, item.note);
    assert.equal(item.show, bothDivide(item.n, item.k), item.note);
    assert.match(item.note, new RegExp(`^${item.n}와 ${item.k}의 최대공약수는 ${item.show}(예요|이에요)$`), item.note);
  }
  // 그림의 핀 수와 칸 수는 판의 규격 안이다
  for (const slide of T.why) for (const item of slide.figures) assert.equal(checkBoard({ n: item.n, k: item.k ?? null }), null);
  assert.match(code, /if \(item\.path\) return \{ n: item\.n, threads: \[\{ pins: item\.path, closed: true \}\] \};/);
});

test('풀이와 직접 만들기: 칸 수가 정해진 판은 끝까지 감은 모습, 칸 수를 고르는 판은 칸 수마다 끝까지 감은 모습을 보인다', () => {
  assert.equal(fill(T.solution.wound, { n: 4, k: 3 }), '실 4가닥이 필요해요. 한 가닥마다 핀 3개를 지나요.');
  assert.equal(fill(T.make.result, { n: 2, k: 5 }), '실 2가닥이 필요해요. 한 가닥마다 핀 5개를 지나요.');
  assert.match(code, /made = \{ line: fill\(T\.make\.result, \{ n: result\.count, k: result\.per \}\) \};/);
  // 판을 바꾸면 앞의 대답이 맞지 않으니 말로 덮는다
  assert.match(code, /if \(said\) frame\.talkers\.make\.say\(T\.make\.changed\);/);
  const make = part('id="make-pins"', 'id="make-net"');
  for (const id of ['pins-make-n-fewer', 'pins-make-n', 'pins-make-n-more', 'pins-make-k-fewer', 'pins-make-k', 'pins-make-k-more', 'pins-make-board', 'pins-make-solve', 'pins-make-result', 'pins-make-play']) assert.ok(make.includes(`id="${id}"`), id);
  assert.match(make, /id="pins-make-solve"[^>]*>선생님, 감아 보세요</);
  assert.match(make, /id="pins-make-play"[^>]*>내가 해 볼래요</);
  assert.match(code, /mode: custom \? 'made' : rungOf\(level\)\.mode,/);
  assert.match(code, /\n {4}madeBoard,\n/);
  assert.doesNotMatch(code, /bestOf/);
});

test('index.html: 이 형식의 카드, 판, 판 아래, 오른쪽 칸, 도구, 직접 만들기가 있다. 틀에 이어져 있다', () => {
  for (const id of ['home-pins-sample', 'home-pins-ask', 'home-pins-play', 'home-pins-pick', 'home-pins-make', 'home-pins-blank', 'pins-board', 'pins-count', 'pins-status', 'pins-skip', 'pins-threads', 'pins-used', 'pins-total', 'pins-pad', 'pins-guess-line', 'pins-guess-box', 'pins-guesses', 'pins-predict-box', 'pins-predict-one', 'pins-predict-many', 'pins-skip-box', 'pins-skip-fewer', 'pins-skip-now', 'pins-skip-more', 'pins-wind-box', 'pins-wind', 'pins-table-box', 'pins-table-body', 'pins-one-box', 'pins-one-chips', 'pins-one-done', 'pins-numbers', 'make-pins']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(part('id="pins-title"', '</section>'), /<h2 id="pins-title">핀에 실 감기<\/h2>/);
  assert.ok(visibleText(part('id="pins-title"', '</section>')).includes(T.home.ask.wind));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-pins-make" class="menu-item"/);
  const pad = part('id="pins-pad"', 'id="net-pad"');
  // 짐작 단추는 1가닥부터 8가닥까지(핀 16개를 8칸씩 감으면 8가닥이다)
  assert.deepEqual([...pad.matchAll(/data-guess="(\d)">(\d)가닥</g)].map((match) => [Number(match[1]), Number(match[2])]), Array.from({ length: 8 }, (_, index) => [index + 1, index + 1]));
  assert.match(pad, /id="pins-wind"[^>]*>감기</);
  assert.match(pad, /id="pins-one-done"[^>]*>다 골랐어요</);
  assert.match(part('id="pins-numbers"', 'id="net-loop"'), /aria-pressed="false" hidden>핀마다 칸 수 적기</);
  assert.equal(T.tool.off, '핀마다 칸 수 적기');
  // 카드는 여우와 토끼 다음, 퍼즐 만들기 앞이다
  assert.ok(html.indexOf('id="foxrabbit-title"') < html.indexOf('id="pins-title"'));
  assert.ok(html.indexOf('id="pins-title"') < html.indexOf('id="make-title"'));
  // 틀이 형식을 안다(여우와 토끼 다음)
  assert.match(read('src/main.js'), /foxrabbit: createFoxrabbit\(frame\), pins: createPins\(frame\), /);
  assert.match(read('src/check-main.js'), /\['pins', '핀에 실 감기'\]/);
  assert.match(read('src/core/smaller.js'), /foxrabbit: smallerFoxrabbit, pins: smallerPins, /);
  assert.match(code, /smaller: \(round, turn\) => smallerPins\(\{ mode: round\.mode, board: round\.board \}, turn\),/);
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
  // 무르기와 되돌리기가 있다. 판이 둥글어 규칙 글은 왼쪽 칸에 둔다
  assert.match(code, /\$\('undo'\)\.hidden = false;\s*\$\('reset'\)\.hidden = false;/);
  assert.match(code, /ruleAside: true,/);
  // 도구를 처음 켜면 힌트 하나로 센다
  assert.match(code, /hintsOpened: round\.hintsOpened \+ \(round\.numbersShown \? 1 : 0\),/);
});

test('화면: 핀 16개 판에서도 핀을 누르는 자리가 44픽셀보다 크다. 가닥은 색만이 아니라 선의 모양과 핀 안의 차례 수로도 갈린다', () => {
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const size = Number(board.match(/const SIZE = (\d+);/)[1]);
  const radius = Number(board.match(/const RADIUS = (\d+);/)[1]);
  const reach = Number(board.match(/const REACH = (\d+);/)[1]);
  // 판 칸은 1180×820 화면에서 높이 430픽셀쯤이다(규칙 글이 왼쪽 칸에 있다). 380픽셀로 잡아도
  const px = 380 / size;
  const apart = 2 * radius * Math.sin(Math.PI / MAX_PINS);
  // 이웃한 두 핀 사이(누르면 가까운 핀이 눌린다)와 누르는 자리의 지름
  assert.ok(apart * px >= 44, `핀 사이 ${apart * px}`);
  assert.ok(Math.min(2 * reach, apart) * px >= 44, `누르는 자리 ${Math.min(2 * reach, apart) * px}`);
  assert.ok(radius + reach <= size / 2, '누르는 자리가 그림 밖으로 나가지 않는다');
  // 가닥 여덟의 선 모양: 첫 가닥은 실선, 나머지는 저마다 다른 점선
  const dashes = Array.from({ length: 8 }, (_, index) => plain.match(new RegExp(`\\.pins-thread\\.s${index} \\.pins-line \\{([^}]*)\\}`))?.[1].match(/stroke-dasharray:\s*([^;]+);/)?.[1] ?? 'solid');
  assert.equal(dashes[0], 'solid');
  assert.equal(new Set(dashes).size, 8, dashes.join(' | '));
  assert.match(board, /'pins-mark'/);
  assert.match(board, /mark\.textContent = String\(index \+ 1\);/);
  assert.match(plain, /\.pins-last \{[^}]*stroke-dasharray/);
  // 판 아래와 오른쪽 칸의 단추들
  assert.match(plain, /\.pins-guesses \{[^}]*grid-template-columns: repeat\(4, 1fr\)/);
});

/** 끝까지 한 판의 기록 하나 */
function finished(more = {}) {
  return { kind: 'round', id: `r-${more.id ?? 1}`, format: 'pins', level: 1, seed: 1, custom: false, mode: 'wind', outcome: 'solved', hintsOpened: 0, answers: [{ t: 10, answer: 'wound', correct: true, guess: null }], wrongCount: 0, moveCount: 8, seconds: 30, solution: { possible: true, count: 2, per: 3 }, ...more };
}

test('수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다. "왜 그럴까?"는 판을 한 번 끝까지 한 뒤에 열린다', () => {
  const tuning = tuningFor('pins');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 5);
  assert.equal(tuning.hintCount, 2);
  assert.equal(tuning.whyAfter, 'finished');
  assert.equal(tuning.fastWin, undefined);
  assert.equal(tuning.fastSolo, undefined);
  assert.match(read('src/core/level.js'), /핀에 실 감기\(모두 임시\)/);
  assert.deepEqual(recommend([], 'pins'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  assert.deepEqual(recommend([finished({ id: 1 }), finished({ id: 2 })], 'pins'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  // 한 가닥으로 다 감기에서 다른 답을 냈으면 "한 번에"가 아니다
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, wrongCount: 1 })], 'pins').offerHarder, false);
  assert.equal(whyUnlocked([], 'pins'), false);
  assert.equal(whyUnlocked([finished()], 'pins'), true);
  assert.equal(whyUnlocked([{ ...finished(), side: true }], 'pins'), false);
  assert.equal(whyUnlocked([{ ...finished(), outcome: 'left' }], 'pins'), false);
});
