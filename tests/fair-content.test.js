// 공정한 게임일까 대본 점검: 화면에 나오는 글이 약속을 지키는지, 규칙의 글이 규칙과 같은지(글을 읽어 값을 다시 뽑는다),
// "왜 그럴까?"의 그림과 수가 다른 방법으로 센 것과 맞는지 본다. 화면 코드와 틀에 이 형식이 이어져 있는지도 여기서 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { RULES, LADDER, generateBoard } from '../src/core/fair-ladder.js';
import { CHOICES, MANY, MEASURES, PLAYS, checkBoard, valuesOf } from '../src/core/fair.js';
import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { createRng, randInt } from '../src/core/rng.js';
import { fill, sentenceCount } from '../src/core/text.js';
import { bruteCount, outcomeStrings, bruteValue } from './helpers/brute-fair.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/fair.json'));
const html = read('index.html');
const code = read('src/formats/fair.js');
const board = read('src/ui/fair-board.js');
const css = read('src/app.css');

const VALUES = { k: 18, f: '다람쥐', n: 18, no: '첫 ', face: '공정해요', total: 36 };
/** 그림과 판의 값은 글이 아니다 */
const DATA_KEYS = ['picture', 'blank', 'seed', 'level', 'kind', 'device', 'measure', 'a'];

function allStrings(value, path = '') {
  if (typeof value === 'string') return [[path, value]];
  if (typeof value === 'number') return [];
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
  const labels = [...source.matchAll(/(?:aria-label|placeholder)="([^"]*)"/g)].map((match) => match[1]);
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
const own = [
  part('id="fair-title"', 'id="rowflip-title"'),
  part('id="fair-table"', 'id="rowflip-pick"'),
  part('id="fair-count"', 'id="rowflip-count"'),
  part('id="fair-pad"', 'id="rowflip-pad"'),
  part('id="fair-reason-box"', '</section>'),
  part('id="make-fair"', 'id="make-rowflip"'),
]
  .map(visibleText)
  .join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const said = strings.map(([, text]) => text).join(' ');

test('대본을 읽을 수 있고, 글이 비어 있지 않다. 단계 목록이 사다리와 같다', () => {
  assert.equal(T.title, '공정한 게임일까');
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.deepEqual(T.levels.map((item) => item.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(T.levels.map((item) => item.name), ['동전 던지기', '주사위 하나', '두 주사위의 합', '곱과 차와 큰 눈', '규칙 고치기', '직접 만들기']);
  for (const entry of T.levels.filter((item) => !item.picture.blank)) assert.equal(checkBoard(generateBoard(entry.level, entry.picture.seed).board), null);
  assert.deepEqual(Object.keys(T.home.ask).sort(), ['coins', 'dice', 'die', 'fix']);
  assert.deepEqual(Object.keys(T.choices), CHOICES);
  // 오른쪽 칸의 단추 글은 대본의 고르기와 같다(짐작과 답 모두)
  for (const box of ['fair-guesses', 'fair-answers']) {
    const buttons = [...part(`id="${box}"`, '</div>').matchAll(/data-choice="([^"]+)">([^<]+)</g)].map((match) => [match[1], match[2]]);
    assert.deepEqual(buttons, Object.entries(T.choices), box);
  }
  // 보는 것마다 칸 위의 이름과 만들기의 단추 글이 있다
  for (const measures of Object.values(MEASURES)) for (const measure of measures) assert.ok(T.measures[measure] && T.make.measures[measure], measure);
});

/** 규칙의 글을 읽어 다람쥐가 가져가는 값을 다시 뽑는다(글이 규칙과 같은지) */
function valuesFromText(rule, text) {
  const [lead, clause] = text.split('. ');
  assert.equal(`${lead}.`, T.devices[rule.device], text);
  const head = clause.slice(0, clause.indexOf('다람쥐가'));
  const domain = valuesOf(rule.device, rule.measure);
  const coins = {
    '두 면이 같으면': ['same'],
    '세 면이 모두 같으면': ['same'],
    '둘 다 앞면이면': [2],
    '셋 다 앞면이면': [3],
    '앞면이 하나라도 있으면': [1, 2],
    '앞면이 둘 이상이면': [2, 3],
    '앞면이 딱 하나면': [1],
  };
  if (rule.device.startsWith('coin')) return coins[head.trim()];
  if (/짝수/.test(head)) return rule.measure === 'face' ? [2, 4, 6] : ['even'];
  if (/홀수/.test(head)) return rule.measure === 'face' ? [1, 3, 5] : ['odd'];
  let match = head.match(/(\d+)부터 (\d+)까지/);
  if (match) return domain.filter((value) => value >= Number(match[1]) && value <= Number(match[2]));
  match = head.match(/(\d+) 이상/);
  if (match) return domain.filter((value) => value >= Number(match[1]));
  match = head.match(/(\d+) 이하/);
  if (match) return domain.filter((value) => value <= Number(match[1]));
  match = head.match(/([\d, ]+) 가운데 하나/);
  if (match) return match[1].split(', ').map(Number);
  match = head.match(/(\d+)이?나 (\d+)/);
  if (match) return [Number(match[1]), Number(match[2])];
  match = head.match(/(\d+)/);
  return [Number(match[1])];
}

test('규칙의 글: 두 문장이고, 글을 읽어 뽑은 값이 규칙과 같다. 아니면 고슴도치가 가져간다고 말한다', () => {
  for (const [name, rule] of Object.entries(RULES)) {
    const text = T.games[name];
    assert.equal(sentenceCount(text), 2, name);
    assert.deepEqual(valuesFromText(rule, text), rule.a, `${name}: ${text}`);
    assert.match(text, /다람쥐가, (아니면|다르면|없으면|홀수면|짝수면|홀수가 나오면|4 이상이 나오면|1이나 2가 나오면) 고슴도치가 가져가요\.$/, name);
    // 공정한지 묻는 판은 세 문장, 고치는 판도 세 문장이다
    assert.ok(sentenceCount(`${text} ${T.rules.judge}`) <= 3);
    assert.ok(sentenceCount(`${text} ${T.rules.fix}`) <= 3);
  }
  // 직접 만든 판의 규칙 글: 던질 것 한 문장과 칸을 보라는 한 문장, 그리고 물음
  for (const lead of Object.values(T.devices)) assert.ok(sentenceCount(`${lead} ${T.rules.custom} ${T.rules.judge}`) <= 3);
  assert.match(code, /const game = board\.name && T\.games\[board\.name\] \? T\.games\[board\.name\] : `\$\{T\.devices\[board\.rule\.device\]\} \$\{T\.rules\.custom\}`;/);
  // 차와 큰 눈은 판 옆에 뜻을 적는다
  assert.match(T.notes.max, /두 눈이 같으면 그 눈을 큰 눈으로 봐요\./);
  assert.match(T.notes.diff, /두 눈이 같으면 0이에요\./);
});

test('사실만 말한다. 판정하는 말, 칭찬 낱말, 돈과 내기와 점수의 말이 없다. 처음 짐작은 맞다 틀리다 하지 않는다', () => {
  assert.doesNotMatch(said, /틀렸|틀린|아니에요|땡|정답|아쉽|실수|실패|성공|잘했|훌륭|대단|최고|멋져|멋진|완벽|축하|천재|똑똑|굉장|맞아요|맞혔/);
  assert.doesNotMatch(own, /틀렸|틀린|아니에요|땡|아쉽|실패|잘했|훌륭|대단|최고|멋/);
  assert.doesNotMatch(`${said} ${own}`, /돈|내기|걸어|걸고|판돈|상금|점수|득점|이겼|이기면|이긴|진 쪽|점을/);
  // 짐작은 적어 두기만 한다
  assert.equal(T.play.guessed, '짐작을 적어 두었어요. 던지기를 눌러 열 번까지 해 볼 수 있어요.');
  assert.match(code, /round\.guess = choice;[\s\S]*?frame\.say\(T\.play\.guessed\);/);
  // 판정과 다른 답에는 짐작("것 같아요") 하나와 사실, 할 수 있는 일을 말한다
  for (const key of ['guess-unordered', 'guess-few-a', 'guess-few-b', 'guess-few-even']) assert.match(T.play[key], /것 같아요\.$/, key);
  assert.equal(fill(T.play['wrong-many'], { total: '1,000', k: 504, n: 496 }), '컴퓨터가 1,000번 던졌을 때는 다람쥐 504번, 고슴도치 496번이었어요. 모든 경우를 세어 볼 수도 있어요.');
  assert.match(code, /if \(rule\.device !== 'die1' && unorderedCount\(rule\)\.verdict === choice\) return 'unordered';/);
  // 판 아래에는 던진 수와 둘이 가져간 수만 적는다(틀린 수, 답한 수는 적지 않는다)
  for (const line of code.split('\n')) if (/textContent/.test(line)) assert.doesNotMatch(line, /wrongCount|tries|submitCount|changeCount|manyCount|tableCount|moveCount/, line.trim());
  assert.equal([...part('id="fair-count"', 'id="rowflip-count"').matchAll(/<strong/g)].length, 3);
  assert.doesNotMatch(code + board, /Math\.random|setInterval/);
});

test('답은 모든 경우를 센 수로 말한다("36가지 가운데 18가지"). 1,000번 던진 수는 사실로만 말한다', () => {
  assert.equal(fill(T.right.fair, { total: 36, k: 18 }), '모든 경우 36가지 가운데 다람쥐와 고슴도치가 18가지씩 가져가서 공정해요.');
  assert.equal(fill(T.right.b, { total: 36, k: 6, n: 30 }), '모든 경우 36가지 가운데 다람쥐가 6가지, 고슴도치가 30가지를 가져가서 고슴도치가 유리해요.');
  assert.equal(fill(T.table.count, { total: 4, k: 2, n: 2 }), '모든 경우 4가지 가운데 다람쥐 2가지, 고슴도치 2가지예요.');
  assert.equal(fill(T.right.misled, { k: 7, n: 3 }), '열 번 던졌을 때는 다람쥐 7번, 고슴도치 3번이었어요.');
  // 끝나는 때는 고른 답이 모든 경우를 센 판정과 같을 때뿐이다(컴퓨터가 던진 수로 정하지 않는다)
  assert.match(code, /const result = countCases\(round\.board\.rule\);\s*const correct = result\.verdict === choice;/);
  assert.match(code, /const correct = result\.verdict === 'fair';/);
  assert.equal([...code.matchAll(/frame\.finish\('solved'\)/g)].length, 2);
  assert.match(code, /if \(round\.played === PLAYS && lookOf\(tally, result\.verdict\) === 'mislead'\) parts\.push/);
  // 큰 수는 쉼표를 찍는다
  assert.match(code, /const big = \(value\) => String\(value\)\.replace\(\/\\B\(\?=\(\\d\{3\}\)\+\(\?!\\d\)\)\/g, ','\);/);
  assert.equal(String(12000).replace(/\B(?=(\d{3})+(?!\d))/g, ','), '12,000');
  assert.equal(T.buttons['many-first'], `컴퓨터가 ${MANY.toLocaleString('en-US')}번 던져 보기`);
  assert.match(part('id="fair-many-box"', 'id="fair-answer-box"'), />컴퓨터가 1,000번 던져 보기</);
  assert.equal(PLAYS, 10);
});

test('규칙 설명과 힌트: 규칙은 세 문장 안, 힌트는 종류마다 두 개이고 질문 한 문장, 힌트 1은 함께 쓰는 목록에서 고른다', () => {
  const shared = ['끝에는 어떤 모양이 되어야 하나요?', '끝나기 바로 전에는 어떤 모양일까요?', '더 작은 판이라면 할 수 있을까요?', '전에 해 본 판 가운데 닮은 판이 있었나요?', '규칙 하나가 없다면 어디까지 되나요?', '아직 한 번도 건드리지 않은 곳이 있나요?', '아까와 다른 곳에서 시작하면 어떻게 되나요?'];
  assert.deepEqual(Object.keys(T.hints).sort(), ['coins', 'dice', 'die', 'fix']);
  for (const [key, list] of Object.entries(T.hints)) {
    assert.equal(list.length, 2, key);
    assert.ok(shared.includes(list[0]), list[0]);
    for (const hint of list) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
      assert.doesNotMatch(hint, /때문|해야 해요|하면 돼요|고르게 나오는 칸|\d/, hint);
    }
  }
  // 동전 둘의 판(더 작은 판이 없다)의 힌트 1은 "더 작은 판"이 아니다
  assert.notEqual(T.hints.coins[0], '더 작은 판이라면 할 수 있을까요?');
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 36);
  assert.ok(sentenceCount(guides[33]) <= 3, guides[33]);
  assert.match(guides[33], /주사위 둘로 공정한 규칙을 몇 가지나 만들 수 있을까요\?$/);
});

test('글의 빈칸({이름})은 정해진 이름만 쓰고, 채울 값이 모자라지 않는다. 영어 낱말과 보상 낱말이 없고 "~요"로 끝난다. 한 문장은 60자를 넘지 않는다', () => {
  const allowed = new Set(['k', 'f', 'n', 'no', 'total', 'level', 'tag', 'face']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
    assert.ok(fill(text, VALUES).length > 0, path);
  }
  for (const [path, text] of strings) assert.doesNotMatch(text.replace(/\{[^{}]*\}/g, ''), /[A-Za-z]/, `${path}: ${text}`);
  assert.doesNotMatch(own, /[A-Za-z]/);
  assert.doesNotMatch(own, /별|점수|순위|레벨|연속/);
  const spoken = [...Object.values(T.home.ask), T.home.pick, ...Object.values(T.games), ...Object.values(T.devices), ...Object.values(T.rules), ...Object.values(T.play), ...Object.values(T.hints).flat(), ...Object.values(T.right), T.solution.judge, T.solution.fix, ...Object.values(T.notes), ...Object.values(T.table), T.make.intro, T.make.fair, T.make.a, T.make.b, T.make['one-side'], T.make['keep-not-yet'], ...T.why.map((slide) => slide.say)];
  for (const text of spoken) for (const sentence of sentences(text)) assert.match(sentence, /요[.?!]$/, sentence);
  for (const text of Object.values(T.status)) assert.match(text, /요$/, text);
  for (const text of [T.solution.note, T.solution['note-fix'], T.reason.placeholder]) assert.match(text, /요$/, text);
  for (const slide of T.why) for (const item of slide.figures) assert.match(item.note, /요$/, item.note);
  for (const [path, text] of strings) for (const sentence of sentences(fill(text, VALUES))) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

/** 다른 셈의 합 막대: 같은 시드 난수로 주사위 둘을 n번 던져 합마다 센다 */
function bruteSums(n, seed) {
  const rng = createRng(seed);
  const sums = new Map();
  for (let at = 0; at < n; at++) {
    const sum = randInt(rng, 1, 6) + randInt(rng, 1, 6);
    sums.set(sum, (sums.get(sum) ?? 0) + 1);
  }
  return sums;
}

test('"왜 그럴까?": 합이 고르게 나오지 않는다(1,000번) → 36칸의 표 → 고르게 나오는 칸으로 세기(이름) → 가장 잘 나오는 합이라도', () => {
  assert.equal(T.why.length, 4);
  for (const slide of T.why) assert.ok(sentenceCount(slide.say) <= 3, slide.say);
  const [first, second, third, fourth] = T.why;
  // 첫 장: 컴퓨터가 1,000번 던진 합. 7과 12의 수는 같은 시드로 다시 던져 센다
  const bars = first.figures[0];
  assert.equal(bars.kind, 'bars');
  assert.equal(bars.n, 1000);
  const sums = bruteSums(bars.n, bars.seed);
  assert.match(first.say, new RegExp(`7은 ${sums.get(7)}번, 12는 ${sums.get(12)}번 나왔어요\\.$`));
  assert.ok(sums.get(7) === Math.max(...sums.values()));
  // 둘째 장: 36칸 가운데 합이 7인 칸 6, 12인 칸 1
  const cells = (sum) => outcomeStrings('die2').filter((text) => bruteValue('sum', text) === sum).length;
  assert.equal(outcomeStrings('die2').length, 36);
  assert.equal(cells(7), 6);
  assert.equal(cells(12), 1);
  assert.match(second.say, /36칸 가운데 합이 7인 칸은 6칸이고, 12인 칸은 1칸뿐이에요\./);
  assert.deepEqual(second.figures.map((item) => item.a), [[7], [12]]);
  // 셋째 장: 이름은 여기서 처음 말한다. 동전 둘 4칸, 주사위 둘 36칸
  assert.match(third.say, /고르게 나오는 칸으로 세기라고 불러요\./);
  assert.equal(outcomeStrings(third.figures[0].device).length, 4);
  assert.match(third.figures[0].note, /4칸/);
  assert.match(third.figures[1].note, /36칸/);
  for (const [path, text] of strings) if (!path.startsWith('why[2]') && !path.startsWith('_')) assert.doesNotMatch(text, /고르게 나오는 칸으로 세기/, path);
  // 넷째 장: 합이 7이면 다람쥐가 가져가는 게임은 6 대 30
  const seven = bruteCount({ device: 'die2', measure: 'sum', a: [7] });
  assert.deepEqual([seven.a, seven.b], [6, 30]);
  assert.match(fourth.say, /7인 칸은 6칸이고 아닌 칸은 30칸이거든요\.$/);
  assert.equal(fourth.figures[0].note, '6칸과 30칸이에요');
});

test('index.html: 이 형식의 카드, 판, 판 아래, 오른쪽 칸, 도구, 끝난 뒤의 까닭 칸, 직접 만들기가 있다. 틀에 이어져 있다', () => {
  for (const id of ['home-fair-sample', 'home-fair-ask', 'home-fair-play', 'home-fair-pick', 'home-fair-make', 'home-fair-blank', 'fair-board', 'fair-count', 'fair-status', 'fair-numbers', 'fair-played', 'fair-a', 'fair-b', 'fair-pad', 'fair-note', 'fair-guess-box', 'fair-guesses', 'fair-guessed', 'fair-throw-box', 'fair-throw', 'fair-many-box', 'fair-many', 'fair-answer-box', 'fair-answers', 'fair-fix-box', 'fair-submit', 'fair-table', 'fair-reason-box', 'fair-reason', 'make-fair', 'fair-make-devices', 'fair-make-measures', 'fair-make-board', 'fair-make-solve', 'fair-make-result', 'fair-make-play']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(part('id="fair-title"', '</section>'), /<h2 id="fair-title">공정한 게임일까<\/h2>/);
  assert.ok(visibleText(part('id="fair-title"', '</section>')).includes(T.home.ask.coins));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-fair-make" class="menu-item"/);
  assert.match(part('id="fair-table"', 'id="rowflip-pick"'), /aria-pressed="false" hidden>모든 경우 세어 보기</);
  assert.match(part('id="fair-reason-box"', '</section>'), /<textarea id="fair-reason" rows="2" maxlength="200" placeholder="안 써도 돼요"><\/textarea>/);
  assert.match(part('id="make-fair"', 'id="make-rowflip"'), /id="fair-make-solve"[^>]*>선생님, 누가 유리해요\?</);
  assert.match(part('id="make-fair"', 'id="make-rowflip"'), /id="fair-make-play"[^>]*>내가 해 볼래요</);
  // 카드는 성냥개비 다음, 퍼즐 만들기 앞이다
  assert.ok(html.indexOf('id="matches-title"') < html.indexOf('id="fair-title"'));
  assert.ok(html.indexOf('id="fair-title"') < html.indexOf('id="make-title"'));
  // 틀이 형식을 안다(성냥개비 다음)
  assert.match(read('src/main.js'), /matches: createMatches\(frame\), fair: createFair\(frame\), /);
  assert.match(read('src/check-main.js'), /\['fair', '공정한 게임일까'\]/);
  assert.match(read('src/core/smaller.js'), /matches: smallerMatches, fair: smallerFair, /);
  assert.match(code, /smaller: \(round, turn\) => smallerFair\(\{ mode: round\.mode, board: round\.board \}, turn\),/);
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
  // 무르기와 되돌리기는 쓰지 않는다. 판이 위아래로 길어 규칙 글은 왼쪽 칸에 둔다
  assert.match(code, /\$\('undo'\)\.hidden = true;\s*\$\('reset'\)\.hidden = true;/);
  assert.match(code, /ruleAside: true,/);
  // 표는 이 형식의 중심 도구라 힌트로 세지 않는다(기록에는 남긴다)
  assert.doesNotMatch(code, /hintsOpened:/);
  assert.match(code, /tableShown: round\.tableShown,/);
  // 까닭 칸은 도전 판을 스스로 끝낸 뒤에만 보이고, 적은 것은 기록에 남는다
  assert.match(code, /const reason = round\.done && round\.outcome === 'solved' && !round\.side && rungOf\(round\.level\)\?\.tag === 'challenge' && !round\.custom;/);
  assert.match(code, /reason: round\.reason,/);
  assert.match(T.right.reason, /적을 수 있어요\.$/);
});

test('화면: 누르는 칸과 단추가 44픽셀보다 크다. 다람쥐와 고슴도치, 왼쪽과 오른쪽, 바꾼 칸은 색만이 아니라 모양으로도 보인다. 던지는 움직임은 짧고 줄일 수 있다', () => {
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const chip = plain.match(/\n\.fr-chip \{([^}]*)\}/)[1];
  assert.ok(Number(chip.match(/min-width: (\d+)px/)[1]) >= 44);
  assert.ok(Number(chip.match(/min-height: (\d+)px/)[1]) >= 44);
  assert.match(plain, /\.fr-make-pair \.btn \{[^}]*min-height: 52px;/);
  // 다람쥐는 동그라미, 고슴도치는 세모. 고슴도치의 칸은 빗금
  assert.match(board, /if \(owner === 'a'\) svg\.append\(svgOf\('circle'/);
  assert.match(board, /else svg\.append\(svgOf\('polygon'/);
  assert.match(plain, /\.own-b\.fr-chip,\s*\.own-b\.fr-cell \{\s*background: repeating-linear-gradient/);
  // 오른쪽 동전은 점선 테두리, 오른쪽 주사위는 다른 바탕이고 표의 설명이 가로줄과 세로줄을 말한다
  assert.match(plain, /\.fr-coin\.right \.fr-coin-body \{\s*stroke-dasharray/);
  assert.match(T.table.die2, /가로줄은 왼쪽 주사위, 세로줄은 오른쪽 주사위예요\./);
  // 바꾼 칸은 금빛 점선 테두리
  assert.match(plain, /\.fr-chip\.changed,\s*\.fr-cell\.changed \{\s*outline: 4px dashed/);
  // 던질 때만 0.4초 흔들리고, 움직임을 줄이는 설정이면 흔들리지 않는다
  assert.match(plain, /\.fr-stage\.rolling \.fr-faces > svg \{\s*animation: fr-roll 0\.4s/);
  assert.match(plain, /@media \(prefers-reduced-motion: reduce\) \{\s*\.fr-stage\.rolling \.fr-faces > svg \{\s*animation: none;/);
  assert.match(code, /rolling = true;/);
  // 판을 그리는 조각은 글을 적지 않는다(이름과 글자는 대본에서 건넨다)
  assert.doesNotMatch(board.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''), /[가-힣]/);
});

/** 끝까지 한 판의 기록 하나 */
function finished(more = {}) {
  return { kind: 'round', id: `r-${more.id ?? 1}`, format: 'fair', level: 1, seed: 1, custom: false, mode: 'judge', outcome: 'solved', hintsOpened: 0, answers: [{ t: 10, answer: 'fair', correct: true, guess: null }], wrongCount: 0, moveCount: 3, seconds: 60, solution: { possible: true, total: 4, a: 2, b: 2, verdict: 'fair' }, ...more };
}

test('수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다. "왜 그럴까?"는 판을 한 번 끝까지 한 뒤에 열린다', () => {
  const tuning = tuningFor('fair');
  assert.equal(tuning.startLevel, 1);
  assert.equal(tuning.bottomLevel, 1);
  assert.equal(tuning.topLevel, 5);
  assert.equal(tuning.hintCount, 2);
  assert.equal(tuning.whyAfter, 'finished');
  assert.equal(tuning.fastWin, undefined);
  assert.match(read('src/core/level.js'), /공정한 게임일까\(모두 임시\)/);
  assert.deepEqual(recommend([], 'fair'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  assert.deepEqual(recommend([finished({ id: 1 }), finished({ id: 2 })], 'fair'), { level: 1, small: false, offerHarder: true, harderLevel: 2, reason: 'fast' });
  // 첫 답이 판정과 다르면 "한 번에"가 아니다
  assert.equal(recommend([finished({ id: 1 }), finished({ id: 2, wrongCount: 1 })], 'fair').offerHarder, false);
  assert.equal(whyUnlocked([], 'fair'), false);
  assert.equal(whyUnlocked([finished()], 'fair'), true);
  assert.equal(whyUnlocked([finished({ side: true })], 'fair'), false);
  assert.match(code, /round\.wrongCount \+= 1;/);
});
