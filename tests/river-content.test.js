// 강 건너기 대본 점검: 화면에 나오는 글이 약속을 지키는지, 그림 속의 판과 수가 풀이 프로그램과 맞는지 본다.
// 공통 규격(규칙은 세 문장 안, 첫 단계는 횟수를 묻지 않는다, 힌트는 두 높이, 배가 못 떠날 때는 사실 하나와 할 수 있는 일 하나,
// "왜 그럴까?"는 알아챈 이야기, 이름은 맨 끝에서, 몇몇 판에는 까닭을 붙이지 않는다)과 이 형식만의 약속(책의 이야기를 쓰지 않는다)도 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { recommend, tuningFor, whyUnlocked } from '../src/core/level.js';
import { LADDER, MAKE_LEVEL, generateBoard, rungOf } from '../src/core/river-ladder.js';
import { ANIMALS, FIGHTS, PETS, castOf, checkBoard, checkMove, isDone, movesOf, replay, solve, startState, stateKey } from '../src/core/river.js';
import { fill, sentenceCount } from '../src/core/text.js';
import { bruteRiver } from './helpers/brute-river.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const T = JSON.parse(read('src/content/river.json'));
const C = JSON.parse(read('src/content/coins.json'));
const html = read('index.html');
const code = read('src/formats/river.js');

const MODES = ['maybe', 'fewest', 'cross'];
const STORIES = ['weight', 'pets', 'pairs', 'island'];
const HINT_KEYS = ['weight', 'pets', 'fewest', 'pairs', 'island'];
const GUESS_KEYS = ['impossible-no-try', 'impossible-same-first', 'impossible-other-way'];
const RIGHT_KEYS = ['crossed-clean', 'crossed-back', 'fewest', 'fewest-after', 'stopped', 'impossible-tried', 'impossible-refused', 'impossible-untried', 'after-retry', 'why-invite'];
const REFUSE_KEYS = ['empty', 'seats', 'rower', 'heavy', 'far'];

/** 대본의 모든 글(값)을 길과 함께 모은다. 설명(_로 시작하는 것)과 그림의 판(동물 이름 글자)은 뺀다. */
function allStrings(value, path = '') {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((item, index) => allStrings(item, `${path}[${index}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .filter(([key]) => !key.startsWith('_') && key !== 'board' && key !== 'trail' && key !== 'picture')
      .flatMap(([key, item]) => allStrings(item, path ? `${path}.${key}` : key));
  }
  return [];
}
const strings = allStrings(T);

/** index.html에서 화면에 보이는 글만 뽑는다(꼬리표, 주석, 스크립트를 뺀다). aria-label도 읽어 주는 글이라 넣는다. */
function visibleText(source) {
  const labels = [...source.matchAll(/aria-label="([^"]*)"/g)].map((match) => match[1]);
  const body = source
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  return [...labels, body].join(' ');
}
const part = (from, to) => html.slice(html.indexOf(from), html.indexOf(to, html.indexOf(from)));
const own = [part('id="river-title"', 'id="cups-title"'), part('id="river-count"', 'id="block-count"'), part('id="river-pad"', 'id="block-pad"'), part('id="make-river"', 'id="make-cups"')].map(visibleText).join(' ');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);
const ruleOf = (story, mode) => [fill(T.rules[story], { k: 2 }), T.asks[mode]].join(' ');

test('대본을 읽을 수 있고, 글이 비어 있지 않다', () => {
  assert.ok(strings.length > 80);
  for (const [path, text] of strings) assert.ok(text.trim().length > 0, path);
  assert.equal(T.title, '강 건너기');
});

test('단계 목록이 사다리와 같고, 표시는 기본·응용·응용·도전·도전·도전이다', () => {
  assert.deepEqual(T.levels.map((entry) => entry.level), LADDER.map((rung) => rung.level));
  assert.deepEqual(LADDER.map((rung) => C.tags[rung.tag]), ['기본', '응용', '응용', '도전', '도전', '도전']);
  assert.equal(T.levels.at(-1).level, MAKE_LEVEL);
  assert.equal(T.levels.at(-1).name, '직접 만들기');
  assert.equal(T.levels.at(-1).picture.blank, true);
  // 판 고르기의 그림은 그 단계에서 실제로 나오는 판이다.
  for (const rung of LADDER.filter((item) => item.mode !== 'make')) {
    const picture = T.levels.find((entry) => entry.level === rung.level).picture;
    assert.equal(checkBoard(picture), null, `${rung.level}단계`);
    const made = rung.boards.map((_, index) => JSON.stringify(generateBoard(rung.level, index + 1).board));
    assert.ok(made.includes(JSON.stringify(picture)), `${rung.level}단계`);
  }
  assert.match(T.levels[2].name, /가장 적게/);
  assert.match(T.levels[4].name, /섬/);
});

test('규칙 설명은 판의 종류마다 있고, 묻는 말까지 세 문장을 넘지 않는다', () => {
  assert.deepEqual(Object.keys(T.rules).sort(), [...STORIES].sort());
  assert.deepEqual(Object.keys(T.asks).sort(), [...MODES].sort());
  for (const story of STORIES) for (const mode of MODES) assert.ok(sentenceCount(ruleOf(story, mode)) <= 3, `${story}, ${mode}`);
  // 코끼리와 생쥐: 태우고 보내기, 배의 무게, 아무도 안 타면 떠나지 않는다(누군가는 배를 타고 돌아와야 한다)
  assert.match(T.rules.weight, /동물을 눌러 배에 태우고 배를 보내요\./);
  assert.match(T.rules.weight, /생쥐 둘이나 코끼리 하나만/);
  assert.match(T.rules.weight, /아무도 안 타면 떠나지 않아요/);
  // 할머니와 동물들: 할머니만 노를 젓는다, 함께 두면 안 되는 짝은 판 옆에 그림으로 보인다
  assert.match(T.rules.pets, /할머니만 노를 저을 수 있고/);
  assert.match(T.rules.pets, /그림의 짝/);
  assert.match(fill(T.rules.pets, { k: 1 }), /할머니와 동물 1마리까지/);
  // 엄마와 아기: 낯을 가리는 아기, 배 위도 같다. 섬이 있는 판은 섬에 내려도 된다
  for (const story of ['pairs', 'island']) assert.match(T.rules[story], /^아기는 자기 엄마가 없는 곳에서 다른 엄마와 함께 있지 않아요\./, story);
  assert.match(T.rules.pairs, /배 위에서도 마찬가지예요/);
  assert.match(T.rules.island, /가운데 섬에 내려도 돼요/);
  // 형식이 규칙 글과 묻는 말을 이어 붙인다. 할머니 판의 수는 할머니를 뺀 동물의 수다.
  assert.match(code, /return \[fill\(T\.rules\[storyOf\(board\)\], \{ k \}\), T\.asks\[round\.mode\]\]\.join\(' '\);/);
  assert.match(code, /const k = board\.kind === 'pets' \? board\.seats - 1 :/);
  // 직접 만들기 화면의 안내 글도 세 문장 안이다. 안 되는 판을 만들어 보라고 권한다.
  const guides = [...html.matchAll(/<p class="rule">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.equal(guides.length, 22);
  assert.ok(sentenceCount(guides[9]) <= 3, guides[9]);
  assert.match(guides[9], /아무리 해도 모두 건널 수 없는 판도 만들 수 있을까요\?$/);
  assert.equal(T.make.intro, '판의 종류를 고르고 수를 정해요. 다 정하면 선생님에게 풀어 보라고 할 수도 있어요.');
  assert.match(html, /id="river-make-solve"[^>]*>선생님, 풀어 보세요</);
});

test('형식의 첫 단계는 횟수를 묻지 않는다: "가장 적게"는 3단계에서만 건다', () => {
  const counting = /횟수|가장 적|몇 번|줄일|되도록 적게|[}\d]번에/;
  for (const text of [T.rules.weight, T.asks.maybe, T.asks.cross, T.home.ask.weight, ...T.hints.weight]) assert.doesNotMatch(text, counting, text);
  assert.deepEqual(LADDER.filter((rung) => rung.mode === 'fewest').map((rung) => rung.level), [3]);
  assert.equal(rungOf(1).mode, 'maybe');
  assert.match(T.asks.fewest, /되도록 적게/);
  assert.match(T.home.ask.fewest, /몇 번/);
  assert.match(part('id="river-fewest"', 'id="river-maybe"'), /<h2>가장 적은 횟수로<\/h2>/);
  // 배를 보낸 횟수는 판 아래에 사실로만 적는다(무른 것은 빠진다).
  assert.match(html, /id="river-count"[\s\S]*?<span>배를 보낸 횟수 <strong id="river-moves">0<\/strong>번<\/span>/);
  assert.match(code, /\$\('river-moves'\)\.textContent = String\(round\.trail\.length\);/);
});

test('더 좋은 답이 남아 있을 때는 틀렸다고 하지 않고 "더 줄일 수 있을까요?"라고 묻는다', () => {
  assert.equal(fill(T.play.more, { k: 7 }), '배를 7번 보내서 모두 건넜어요. 더 줄일 수 있을까요?');
  assert.equal(fill(T.right.fewest, { k: 5 }), '배를 5번 보내서 모두 건넜어요. 이보다 적게는 할 수 없어요.');
  assert.equal(fill(T.right['fewest-after'], { n: 9 }), '처음에는 9번이었는데 다시 해서 줄였어요.');
  assert.equal(fill(T.right.stopped, { k: 13 }), '배를 13번 보내서 모두 건너고 여기까지 했어요.');
  const wrong = /틀렸|틀린|아니에요|땡|아쉽|실패|너무 많/;
  for (const [path, text] of strings) assert.doesNotMatch(text, wrong, `${path}: ${text}`);
  assert.doesNotMatch(own, wrong);
  assert.match(html, /id="river-again"[^>]*>처음부터 다시 해 볼래요</);
  assert.match(html, /id="river-stop"[^>]*>여기까지 할래요</);
  assert.match(html, /id="river-best-line"[^>]*>지금까지 가장 적게 <strong id="river-best"><\/strong>번</);
  assert.match(code, /function stop\(\) \{[\s\S]*?round\.stopped = true;[\s\S]*?frame\.finish\('solved'\);/);
  // 가장 적은 횟수에 닿으면 끝나고, 아니면 판을 그대로 둔다.
  assert.match(code, /if \(moves === solution\.min\) \{\s*answer\(`crossed:\$\{moves\}`, true\);\s*frame\.finish\('solved'\);/);
});

test('힌트는 두 개이고 질문 한 문장이다. 첫째는 무엇을 해 볼지만, 둘째는 어디를 볼지까지만 묻는다', () => {
  assert.deepEqual(Object.keys(T.hints).sort(), [...HINT_KEYS].sort());
  for (const key of HINT_KEYS) {
    const [first, second, ...rest] = T.hints[key];
    assert.equal(rest.length, 0, key);
    assert.equal(T.hints[key].length, tuningFor('river').hintCount);
    for (const hint of [first, second]) {
      assert.equal(sentenceCount(hint), 1, hint);
      assert.match(hint, /(나요|까요|가요)\?$/, hint);
      // 답을 말해 버리지 않는다: 까닭이나 요령이 들어 있지 않다.
      assert.doesNotMatch(hint, /먼저 보내|먼저 정하|때문이에요|해야 해요|하면 돼요|돌아올 동물을/, hint);
    }
    // 첫째: 어느 판에서나 쓸 수 있는 일반 질문이다(공통 목록의 질문). 이 형식의 사물 이름이 없다.
    assert.doesNotMatch(first, /코끼리|생쥐|할머니|강아지|고양이|병아리|생선|엄마|아기|배|섬/, first);
    // 둘째: 볼 곳을 가리킨다.
    assert.match(second, /코끼리|할머니|배|엄마|섬/, second);
    assert.notEqual(first, second);
  }
  assert.match(code, /hints: \(round\) => T\.hints\[round\.mode === 'fewest' \? 'fewest' : storyOf\(round\.board\)\],/);
});

test('배가 못 떠날 때: 판 아래에 짧은 사실, 선생님은 사실 하나와 할 수 있는 일 하나를 말한다', () => {
  assert.deepEqual(Object.keys(T.refuse).sort(), [...REFUSE_KEYS].sort());
  for (const key of REFUSE_KEYS) {
    const [fact, next, ...rest] = sentences(T.refuse[key]);
    assert.equal(rest.length, 0, key);
    assert.match(fact, /요\.$/, key);
    assert.match(next, /있어요\.$/, key);
    assert.doesNotMatch(T.refuse[key], /틀렸|안 돼요|왜냐|때문/, key);
  }
  for (const key of [...REFUSE_KEYS, 'clash', 'crossed']) {
    assert.match(T.status[key], /요$/, key);
    assert.ok([...T.status[key]].length <= 20, key);
  }
  // 함께 두면 안 되는 짝마다 말이 있다. 할머니는 늘 배에 타므로(혼자 노를 젓는다) 할머니 판에서는 남는 곳에서만 그런 일이 생긴다.
  assert.deepEqual(Object.keys(T.clash.pets).sort(), FIGHTS.map(([a, b]) => `${a}-${b}`).sort());
  for (const [kind, text] of Object.entries(T.clash.pets)) {
    assert.match(text, /^배가 떠나면 할머니가 없는 곳에 /, kind);
    assert.ok(sentenceCount(text) <= 2, kind);
  }
  assert.deepEqual(Object.keys(T.clash.baby).sort(), ['boat', 'land', 'stay']);
  for (const text of Object.values(T.clash.baby)) {
    assert.equal(sentenceCount(text), 1, text);
    assert.match(text, /아기가 자기 엄마 없이 다른 엄마와 함께 있게 돼요\.$/);
  }
  const wheres = new Set();
  for (let mask = 1; mask < 1 << PETS.length; mask++) {
    for (const seats of [2, 3]) {
      const board = { kind: 'pets', pets: PETS.filter((_, index) => mask & (1 << index)), seats };
      // 갈 수 있는 모든 모습에서, 할머니를 태운 모든 묶음을 보내 본다.
      const seen = new Set();
      const stack = [startState(board)];
      while (stack.length > 0) {
        const state = stack.pop();
        if (seen.has(stateKey(state))) continue;
        seen.add(stateKey(state));
        const here = state.at.flatMap((place, id) => (place === state.boat ? [id] : []));
        for (const id of here) {
          const check = checkMove(board, state, [...new Set([0, id])], 1 - state.boat);
          if (check?.reason === 'clash') wheres.add(check.where);
        }
        for (const move of movesOf(board, state)) stack.push({ at: state.at.map((place, id) => (move.who.includes(id) ? move.to : place)), boat: move.to });
      }
    }
  }
  assert.deepEqual([...wheres], ['stay']);
  // 판에서 보여 준다: 함께 있으면 안 되는 동물에 고리, 그 일이 생기는 곳(배 위면 배)에 테두리
  assert.match(code, /mark = \{ who: check\.who, place: check\.where === 'boat' \? null : check\.place, boat: check\.where === 'boat' \};/);
  const css = read('src/app.css');
  assert.match(css, /\.rv-ring \{[^}]*stroke-dasharray/);
  assert.match(css, /\.rv-land\.marked,\s*\.rv-hull\.marked \{[^}]*stroke-dasharray/);
});

test('지나온 모습으로 돌아오면 그 사실을 한 판에 한 번만 말한다', () => {
  const [fact, next, ...rest] = sentences(T.stuck.loop);
  assert.equal(rest.length, 0);
  assert.match(fact, /^이 모습은 아까도 있었어요\.$/);
  assert.match(next, /볼 수 있어요\.$/);
  assert.match(code, /if \(!round\.loopSaid\) \{\s*round\.loopSaid = true;\s*frame\.say\(T\.stuck\.loop\);/);
  for (const text of Object.values(T.stuck)) assert.doesNotMatch(text, /막혔(지요|군요|나요|네요|죠|구나)/);
});

test('틀린 "불가능해요"에 하는 말은 짐작이라고 밝히고, 판에서 해 보게 한다', () => {
  assert.deepEqual(Object.keys(T.guess).sort(), [...GUESS_KEYS].sort());
  for (const key of GUESS_KEYS) {
    assert.match(T.guess[key], /것 같아요/, key);
    assert.doesNotMatch(T.guess[key], /틀렸|아니에요|땡|좀 더 생각|다시 생각|잘 생각/, key);
    assert.match(T.guess[key], /볼까요\?$/, key);
    assert.equal(sentenceCount(T.guess[key]), 2, key);
  }
  assert.match(html, /id="river-impossible"[^>]*>불가능해요</);
  // "불가능해요"는 안 되는 판이 섞이는 판(1, 2, 4단계와 직접 만든 판)에만 있다.
  assert.match(code, /\$\('river-maybe'\)\.hidden = round\.mode !== 'maybe';/);
  assert.match(code, /mode: custom \? 'maybe' : rungOf\(level\)\.mode,/);
});

test('맞혔을 때 하는 말은 한 일을 말하고, 칭찬 낱말을 쓰지 않는다', () => {
  const praise = /최고|잘했|대단|훌륭|멋져|멋진|천재|똑똑|완벽|짱|굉장/;
  for (const [path, text] of strings) assert.doesNotMatch(text, praise, `${path}: ${text}`);
  assert.doesNotMatch(own, praise);
  assert.deepEqual(Object.keys(T.right).sort(), [...RIGHT_KEYS].sort());
  assert.equal(fill(T.right['crossed-clean'], { k: 5 }), '모두 오른쪽 강가로 건넜어요. 한 번도 무르지 않고 배를 5번 보냈어요.');
  assert.equal(fill(T.right['crossed-back'], { k: 9, n: 2 }), '모두 오른쪽 강가로 건넜어요. 배를 9번 보냈고, 2번 무르거나 되돌렸어요.');
  assert.ok(fill(T.right['impossible-tried'], { k: 4 }).includes('배를 4번 보내 보고'));
  assert.equal(T.right['after-retry'], '처음 답을 바꿔서 찾아냈어요.');
  // "맞아요"는 답 단추("불가능해요")를 눌러 맞혔을 때만 한다.
  for (const key of RIGHT_KEYS) assert.equal(/^맞아요/.test(T.right[key]), key.startsWith('impossible-'), key);
  assert.match(T.right['why-invite'], /왜 그럴까 단추를 눌러 보세요\.$/);
});

test('글의 빈칸({이름})은 정해진 이름만 쓰고, 화면 글에 영어 낱말이 없다', () => {
  const allowed = new Set(['k', 'f', 'n', 'no', 'total', 'level', 'tag', 'face']);
  for (const [path, text] of strings) {
    for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) assert.ok(allowed.has(name), `${path}: {${name}}`);
    assert.doesNotMatch(text.replace(/\{[^{}]*\}/g, ''), /[A-Za-z]/, `${path}: ${text}`);
  }
  assert.doesNotMatch(visibleText(html), /[A-Za-z]/);
});

test('화면 글은 "~요"로 끝나는 말투이고, 한 문장은 60자를 넘지 않는다', () => {
  const spoken = [
    ...Object.values(T.home.ask),
    T.home.pick,
    ...STORIES.map((story) => T.rules[story]),
    ...Object.values(T.asks),
    ...Object.values(T.refuse),
    ...Object.values(T.clash.pets),
    ...Object.values(T.clash.baby),
    T.stuck.loop,
    T.play.more,
    ...HINT_KEYS.flatMap((key) => T.hints[key]),
    ...Object.values(T.guess),
    ...Object.values(T.right),
    T.solution.possible,
    T.solution.impossible,
    T.make.intro,
    T.make.possible,
    T.make.impossible,
    ...T.why.map((slide) => slide.say),
  ];
  for (const text of spoken) for (const sentence of sentences(text)) assert.match(sentence, /요[.?!]$/, sentence);
  for (const text of T.why.flatMap((slide) => slide.figures.map((item) => item.note))) assert.match(text, /요$/, text);
  for (const [path, text] of strings) for (const sentence of sentences(text)) assert.ok([...sentence].length <= 60, `${path}: ${sentence}`);
});

test('이야기는 새로 지었다: 책의 옛 이야기(질투하는 남편들, 늑대와 염소와 양배추 같은 것)를 쓰지 않는다', () => {
  const book = /남편|아내|부인|질투|선교사|식인|늑대|염소|양배추|여우|거위|군인|병사|농부|사공/;
  for (const [path, text] of strings) assert.doesNotMatch(text, book, `${path}: ${text}`);
  assert.doesNotMatch(own, book);
  assert.doesNotMatch(T._설명, /남편|질투|늑대|염소|양배추/);
  assert.match(T._설명, /새로 지었다/);
  // 동물의 이름: 그림마다 이름이 있다(읽어 주는 글)
  for (const kind of ['elephant', 'mouse', 'grandma', ...PETS]) assert.ok(T.names[kind], kind);
  for (const animal of ANIMALS) {
    assert.equal(T.names.mother[animal], `엄마 ${T.names.baby[animal].replace('아기 ', '')}`, animal);
    assert.match(T.names.baby[animal], /^아기 /);
  }
  assert.deepEqual(Object.keys(T.places), ['left', 'island', 'right', 'boat']);
});

test('까닭과 생각의 이름은 "왜 그럴까?"에서만, 이름은 맨 마지막 장에서 처음 말한다', () => {
  const name = /돌아올 동물 먼저 정하기/;
  const reason = /먼저 보내 두|네 번 오갔|기다리다가|기다릴 수/;
  for (const [path, text] of strings) {
    if (path.startsWith('why')) continue;
    assert.doesNotMatch(text, name, `${path}: ${text}`);
    assert.doesNotMatch(text, reason, `${path}: ${text}`);
  }
  assert.doesNotMatch(own, name);
  for (const slide of T.why.slice(0, -1)) assert.doesNotMatch(slide.say, name);
  assert.match(T.why.at(-1).say, name);
});

test('"왜 그럴까?"는 그림 서너 장이고, 선생님이 막혔던 데서 시작하는 이야기다. 마지막 장은 까닭이 그대로는 통하지 않는 판을 남겨 둔다', () => {
  assert.ok(T.why.length >= 3 && T.why.length <= 4);
  for (const slide of T.why) {
    assert.ok(sentenceCount(slide.say) <= 3, slide.say);
    assert.ok(slide.figures.length + (slide.table ? 1 : 0) >= 1, '그림이 없는 장');
    assert.ok(slide.figures.length <= 2);
  }
  assert.match(T.why[0].say, /^선생님도 코끼리 하나와 생쥐 하나에서 막혔어요\./);
  assert.match(T.why[1].say, /^그래서 /);
  assert.match(T.why[2].say, /^세어 보니 /);
  // 마지막 장: 네 쌍과 둘이 타는 배는 왜 안 되는지 말하지 않고 묻는다(일부러 까닭을 남겨 둔 판).
  assert.match(T.why.at(-1).say, /왜 안 될까요\?$/);
  assert.match(T._설명, /일부러 까닭을 남겨 두었다/);
});

test('"왜 그럴까?" 그림 속의 판과 수는 풀이 프로그램과 다른 방법이 따진 것과 같다', () => {
  let checked = 0;
  for (const slide of T.why) {
    for (const item of slide.figures) {
      const { board } = item;
      const where = item.note;
      assert.equal(checkBoard(board), null, where);
      const played = replay(board, item.trail);
      assert.equal(played.ok, true, where);
      const far = played.state.at.flatMap((place, id) => (place === 1 ? [id] : []));
      // "건너편에는 ○○뿐이에요": 건너편에 그 동물 하나뿐이고 배도 거기 있다(배를 가지고 돌아올 동물이 그 하나뿐이다).
      if (item.alone !== undefined) {
        assert.deepEqual(far, [item.alone], where);
        assert.equal(played.state.boat, 1, where);
        assert.ok(item.note.includes(T.names[castOf(board)[item.alone].kind]), where);
      }
      // "생쥐 하나가 기다리고 있어요": 코끼리가 건너왔고, 건너편에 생쥐가 함께 있다.
      if (item.waiting !== undefined) {
        assert.equal(castOf(board)[item.waiting].kind, 'mouse', where);
        assert.ok(far.includes(item.waiting) && far.some((id) => castOf(board)[id].kind === 'elephant'), where);
        assert.equal(played.state.boat, 1, where);
      }
      // "기다리던 생쥐가 배를 가지고 돌아왔어요": 그 생쥐가 왼쪽에 있고 배도 왼쪽에 있으며, 코끼리는 건너편에 남았다.
      if (item.back !== undefined) {
        assert.equal(played.state.at[item.back], 0, where);
        assert.equal(played.state.boat, 0, where);
        assert.deepEqual(far.map((id) => castOf(board)[id].kind), ['elephant'], where);
      }
      if (item.impossible) {
        assert.equal(solve(board).possible, false, where);
        assert.equal(bruteRiver(board).possible, false, where);
      }
      if (item.moves !== undefined) {
        assert.equal(solve(board).min, item.moves, where);
        assert.equal(bruteRiver(board).min, item.moves, where);
        assert.ok(item.note.includes(`${item.moves}번`), where);
      }
      checked += 1;
    }
    for (const row of slide.table ?? []) {
      const board = { kind: 'weight', heavy: row.heavy, light: row.light };
      assert.equal(solve(board).min, row.moves, JSON.stringify(row));
      assert.equal(bruteRiver(board).min, row.moves, JSON.stringify(row));
      // "코끼리 하나가 건널 때마다 배가 네 번"이고, 끝에 생쥐 둘이 한 번 더 건넌다.
      assert.equal(row.moves, 4 * row.heavy + 1, JSON.stringify(row));
      checked += 1;
    }
  }
  assert.equal(checked, 9);
  // 둘째 장의 차례는 가장 적게 건너는 길의 앞부분이다(코끼리 하나와 생쥐 둘은 5번).
  const steps = T.why[1].figures.at(-1).trail;
  const board = T.why[1].figures.at(-1).board;
  const finish = [...steps, { who: [1, 2], to: 1 }];
  assert.equal(isDone(board, replay(board, finish).state), true);
  assert.equal(finish.length, solve(board).min);
  assert.equal(fill(T.table.row, { n: 2, k: 2 }), '코끼리 2, 생쥐 2');
  assert.equal(fill(T.table.times, { k: 9 }), '9번');
});

test('풀이와 직접 만들기의 글: 배를 가장 적게 보내는 횟수와 되는지를 알려 준다', () => {
  assert.equal(fill(T.solution.possible, { k: 11 }), '배를 가장 적게 11번 보내면 모두 건너요. 한 가지 방법을 보여 줄게요.');
  assert.match(T.solution.impossible, /아무리 해도/);
  assert.equal(fill(T.solution.stepLabel, { no: 3 }), '3번');
  assert.equal(fill(T.make.possible, { k: 16 }), '이 판은 모두 건널 수 있어요. 배를 가장 적게 16번 보내면 돼요.');
  assert.equal(T.make.impossible, '이 판은 아무리 해도 모두 건널 수 없어요.');
  assert.equal(fill(T.make.count, { n: 3 }), '3마리');
  assert.equal(fill(T.make.pairs, { n: 4 }), '4쌍');
  assert.equal(fill(T.make.seats, { n: 2 }), '2자리');
});

test('index.html: 이 형식의 카드, 판, 판 아래, 답하는 칸, 직접 만들기가 있다', () => {
  for (const id of [
    'home-river-sample',
    'home-river-ask',
    'home-river-play',
    'home-river-pick',
    'home-river-make',
    'home-river-blank',
    'river-board',
    'river-count',
    'river-status',
    'river-moves',
    'river-pad',
    'river-go-left',
    'river-go-island',
    'river-go-right',
    'river-legend',
    'river-fights',
    'river-fewest',
    'river-best-line',
    'river-best',
    'river-again',
    'river-stop',
    'river-maybe',
    'river-impossible',
    'make-river',
    'river-make-kinds',
    'river-make-weight',
    'river-make-pets',
    'river-make-pairs',
    'river-make-boat',
    'river-make-pet-list',
    'river-make-island',
    'river-make-board',
    'river-make-legend',
    'river-make-fights',
    'river-make-result',
    'river-make-solve',
    'river-make-play',
  ]) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  for (const side of ['heavy', 'light', 'pairs', 'seats']) for (const way of ['fewer', 'more']) assert.ok(html.includes(`id="river-make-${side}-${way}"`), `${side}-${way}`);
  for (const kind of ['weight', 'pets', 'pairs']) assert.ok(part('id="make-river"', '<script').includes(`data-kind="${kind}"`), kind);
  for (const pet of PETS) assert.match(html, new RegExp(`data-pet="${pet}" aria-pressed="false">${T.names[pet]}<`), pet);
  assert.match(html, /id="home-river-ask"[^>]*>모두 강을 건널 수 있을까요\?</);
  assert.equal(T.home.ask.weight, '모두 강을 건널 수 있을까요?');
  // 카드는 조각 못 들어가게 막기 뒤, "퍼즐 만들기" 앞에 있고, "만들기" 목록에도 있다.
  assert.ok(html.indexOf('id="block-title"') < html.indexOf('id="river-title"'));
  assert.ok(html.indexOf('id="river-title"') < html.indexOf('id="make-title"'));
  assert.match(part('id="make-menu"', 'id="picker"'), /id="home-river-make" class="menu-item"/);
  // 누르는 법과 배를 보내는 단추가 판 옆에 있다.
  const pad = visibleText(part('id="river-pad"', 'id="block-pad"'));
  assert.ok(pad.includes('동물을 누르면 배에 타요. 탄 동물을 누르면 내려요.'));
  for (const label of ['← 왼쪽 강가로 보내기', '섬으로 보내기', '오른쪽 강가로 보내기 →', '할머니가 없으면 함께 두면 안 돼요']) assert.ok(pad.includes(label), label);
  // 틀이 형식을 안다.
  assert.match(read('src/main.js'), /block: createBlock\(frame\), river: createRiver\(frame\), /);
  assert.match(read('src/check-main.js'), /\['river', '강 건너기'\]/);
});

test('형식 모듈이 틀과 공책에 내놓는 것', () => {
  for (const name of ['begin(', 'solve(round)', 'valid(saved)', 'showParts(on)', 'ruleLine(round)', 'record(round, solution)', 'homeAsk(level)', 'drawSample(root, board)', 'drawBlank(root)', 'drawResume(root, saved)', 'drawLevelPicture(root, entry)']) {
    assert.ok(code.includes(name), name);
  }
  assert.match(code, /\n {4}madeBoard,\n/);
  assert.match(code, /const madeBoard = \(\) => draftBoard\(\);/);
  // 더 좋은 기록을 공책에 남기는 형식이 아니다(가장 적은 횟수는 판 안에서만 묻는다).
  assert.doesNotMatch(code, /bestOf/);
  assert.doesNotMatch(code, /log\.allRecords\(\)/);
});

// ---- 수준 맞추기 ----
let nextId = 0;
function river(overrides = {}) {
  nextId += 1;
  return {
    kind: 'round',
    id: `v${nextId}`,
    format: 'river',
    level: 1,
    seed: nextId,
    custom: false,
    mode: 'maybe',
    outcome: 'solved',
    hintsOpened: 0,
    answers: [{ t: 40, answer: 'crossed', correct: true, guess: null }],
    moveCount: 5,
    wrongCount: null,
    seconds: 40,
    solution: { possible: true, min: 5 },
    ...overrides,
  };
}

test('강 건너기의 수준 맞추기 값은 임시값이고, 처음 보여 줄 단계는 1단계다', () => {
  const tuning = tuningFor('river');
  assert.deepEqual([tuning.startLevel, tuning.bottomLevel, tuning.topLevel, tuning.hintCount], [1, 1, 5, 2]);
  for (const rung of LADDER.filter((item) => item.mode !== 'make')) assert.ok(tuning.expectedSeconds[rung.level] > 0, `${rung.level}단계의 예상 시간`);
  assert.equal(tuning.whyAfter, undefined);
  assert.deepEqual(recommend([], 'river'), { level: 1, small: false, offerHarder: false, harderLevel: null, reason: 'start' });
  assert.deepEqual(generateBoard(recommend([], 'river').level, 1).board, { kind: 'weight', heavy: 1, light: 2 });
  assert.match(read('src/core/level.js'), /강 건너기\(모두 임시\)/);
  // 첫 답으로, 힌트 없이, 예상 시간보다 빠르게 두 판을 맞히면 더 어려운 판을 권한다.
  assert.equal(recommend([river(), river()], 'river').offerHarder, true);
  assert.equal(recommend([river(), river({ hintsOpened: 1 })], 'river').offerHarder, false);
  const retried = river({ answers: [{ t: 9, answer: 'impossible', correct: false, guess: 'impossible-no-try' }, { t: 60, answer: 'crossed', correct: true, guess: null }] });
  assert.equal(recommend([river(), retried], 'river').offerHarder, false);
  // 가장 적은 횟수를 묻는 판: 처음 건넌 것이 가장 적은 횟수였으면 "한 번에"다.
  const fewest = (answers) => river({ level: 3, mode: 'fewest', answers, seconds: 100 });
  assert.equal(recommend([fewest([{ answer: 'crossed:5', correct: true }]), fewest([{ answer: 'crossed:11', correct: true }])], 'river').offerHarder, true);
  assert.equal(recommend([fewest([{ answer: 'crossed:5', correct: true }]), fewest([{ answer: 'crossed:13', correct: false }, { answer: 'crossed:11', correct: true }])], 'river').offerHarder, false);
  // 그만두기가 이어지면 한 단계 아래를 먼저 보여 준다.
  const quit = (level) => river({ level, outcome: 'left', answers: [], moveCount: 4 });
  assert.deepEqual(recommend([quit(3), quit(3)], 'river'), { level: 2, small: false, offerHarder: false, harderLevel: null, reason: 'quit' });
  assert.deepEqual(recommend([quit(1), quit(1)], 'river'), { level: 1, small: true, offerHarder: false, harderLevel: null, reason: 'quit' });
});

test('"왜 그럴까?"는 이 형식의 안 되는 판을 한 번 끝까지 만난 뒤에 열린다', () => {
  assert.equal(whyUnlocked([], 'river'), false);
  assert.equal(whyUnlocked([river(), river({ level: 2 })], 'river'), false, '되는 판만 건넌 기록');
  const impossible = (overrides = {}) => river({ solution: { possible: false, min: null }, answers: [{ t: 9, answer: 'impossible', correct: true, guess: null }], ...overrides });
  assert.equal(whyUnlocked([impossible({ outcome: 'left' })], 'river'), false, '끝내지 않은 판');
  assert.equal(whyUnlocked([impossible({ side: true })], 'river'), false, '작은 판');
  assert.equal(whyUnlocked([impossible()], 'river'), true);
  assert.equal(whyUnlocked([impossible({ outcome: 'solution' })], 'river'), true, '풀이를 본 판');
  assert.equal(whyUnlocked([impossible()], 'swap'), false, '다른 형식');
  // 이 판이 안 되는 판이면 끝났을 때 틀이 "왜 그럴까?"를 알려 준다(대본의 why-invite).
  assert.match(read('src/main.js'), /if \(!solution\.possible && whyAvailable\(\)\) parts\.push\(F\.T\.right\['why-invite'\]\);/);
});
