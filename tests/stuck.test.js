// "막혔어요"와 "더 작은 판으로": 일곱 형식이 함께 쓰는 틀의 장치 둘이 약속을 지키는지 본다.
// - 막힌 것은 떳떳한 상태다. 아이가 스스로 누르고, 틀이 먼저 묻지 않고, 몇 번 눌렀는지 보여 주지 않는다.
// - 세 고르기의 글은 대본에 있고, 탓하거나 달래는 말이 없다.
// - 작은 판은 하던 판을 그대로 간직한 채 열리고, 끝내면 원래 판으로 데려온다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { sentenceCount } from '../src/core/text.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const C = JSON.parse(read('src/content/coins.json'));
const html = read('index.html');
const frame = read('src/main.js');
const css = read('src/app.css').replace(/\/\*[\s\S]*?\*\//g, '');
const FORMATS = ['coins', 'trace', 'code', 'swap', 'tile', 'duel', 'tax', 'logic', 'block', 'river', 'cups', 'dandelion', 'maze', 'rulehunt', 'untangle', 'lamps', 'rooms', 'machine', 'split', 'eyeball', 'cutpaste', 'fold', 'domino', 'pieces', 'magic', 'apart', 'keymaze', 'cipher', 'seqpath', 'pancake', 'product', 'sim', 'matches', 'fair', 'rowflip', 'foxrabbit', 'pins', 'net', 'regionmap', 'blackhole', 'tower', 'racetrack', 'discpair', 'tilings', 'fingers', 'signs', 'views'];
const scripts = FORMATS.map((name) => read(`src/content/${name}.json`));
const part = (from, to) => html.slice(html.indexOf(from), html.indexOf(to, html.indexOf(from)));
const side = part('<section class="side" aria-label="힌트">', '</section>');
const sentences = (text) => text.split(/(?<=[.?!])\s+/);

/** 탓하는 말, 달래는 말, 재촉하는 말. 막힌 것은 떳떳한 상태라서 이런 말을 붙이지 않는다. */
const BLAME = /틀렸|틀린|못|잘못|실수|아직도|또 |벌써|어려워|쉬운|괜찮|힘내|걱정|포기|바보|빨리|얼른/;

test('"막혔어요"의 세 고르기는 대본에 있다. "~요"로 끝나는 한 문장이고, 탓하거나 달래는 말이 없다', () => {
  assert.deepEqual(Object.keys(C.stuck.choices), ['rule', 'next', 'why']);
  // 셋째 고르기는 안 되는 판이 없는 형식에서도 맞는 말이어야 한다("왜 안 되는지"는 안 맞다).
  assert.deepEqual(Object.values(C.stuck.choices), ['무엇을 하라는 건지 모르겠어요', '다음에 무엇을 할지 모르겠어요', '어디를 봐야 할지 모르겠어요']);
  assert.doesNotMatch(Object.values(C.stuck.choices).join(' '), /안 되는지/);
  for (const [key, text] of Object.entries(C.stuck.choices)) {
    assert.match(text, /요$/, key);
    assert.equal(sentenceCount(text), 1, key);
    assert.doesNotMatch(text, BLAME, key);
    assert.doesNotMatch(text, /[A-Za-z0-9]/, key);
    // 아이가 하는 말이다("~겠어요"). 선생님이 아이에게 묻는 말이 아니다.
    assert.match(text, /모르겠어요$/, key);
  }
  assert.equal(new Set(Object.values(C.stuck.choices)).size, 3);
  // 검사기가 탓하는 말을 찾아낸다.
  assert.match('또 틀렸어요', BLAME);
  assert.match('아직 못 풀었어요', BLAME);
});

test('index.html: 왼쪽 칸 맨 위에 "막혔어요" 단추가 있고, 그 자리에 세 고르기가 펼쳐진다. 고르지 않고 닫을 수 있다', () => {
  // 예전의 "힌트" 단추는 없다.
  assert.doesNotMatch(html, /id="hint"/);
  assert.match(side, /^<section class="side" aria-label="힌트">\s*(<!--[\s\S]*?-->\s*)?<button id="stuck" class="btn wide" type="button" aria-expanded="false" aria-controls="stuck-menu">막혔어요<\/button>/);
  // 세 고르기는 화면을 덮는 창이 아니라 왼쪽 칸 안에 있고, 처음에는 접혀 있다. 모두 단추라서 글자판으로도 고른다.
  const menu = side.slice(side.indexOf('id="stuck-menu"'), side.indexOf('id="smaller"'));
  assert.match(side, /<div id="stuck-menu" class="stuck-menu" hidden>/);
  const ids = [...menu.matchAll(/<button id="([\w-]+)"/g)].map((match) => match[1]);
  assert.deepEqual(ids, ['stuck-rule', 'stuck-next', 'stuck-why', 'stuck-close']);
  assert.match(menu, /id="stuck-close"[^>]*>닫기</);
  // 고르기의 글은 대본에서 채운다(index.html에는 적지 않는다).
  for (const id of ['stuck-rule', 'stuck-next', 'stuck-why']) assert.match(menu, new RegExp(`<button id="${id}" class="btn wide stuck-choice" type="button"></button>`));
  assert.match(frame, /\$\(`stuck-\$\{choice\}`\)\.textContent = C\.stuck\.choices\[choice\];/);
  // 차례: 막혔어요 → 세 고르기 → 더 작은 판으로 → 열린 힌트 카드 → 형식의 도구 단추 → 왜 그럴까?
  const order = ['id="stuck"', 'id="stuck-menu"', 'id="smaller"', 'id="hints"', 'id="trace-degrees"', 'id="code-left"', 'id="code-memo-open"', 'id="tile-pattern"', 'id="tax-costs"', 'id="block-spots"', 'id="cups-notes"', 'id="why"'];
  const at = order.map((mark) => side.indexOf(mark));
  assert.ok(at.every((value) => value >= 0), order[at.findIndex((value) => value < 0)]);
  assert.deepEqual(at, at.slice().sort((a, b) => a - b));
  // 글이 길어 두 줄이 되어도 된다. 넘치면 왼쪽 칸만 굴러간다.
  assert.match(css, /\.btn\.stuck-choice\s*\{[^}]*white-space:\s*normal/);
  assert.match(css, /\.side,\s*\.answer,\s*\.table\s*\{[^}]*overflow:\s*auto/);
});

test('틀이 먼저 "막혔지요?"라고 묻지 않고, 누른 것을 두고 덧붙이는 말이 없다', () => {
  for (const text of [...scripts, html]) assert.doesNotMatch(text, /막혔(지요|군요|나요|네요|죠|구나)/);
  // "막혔어요"를 누르게 하는 것은 그 단추의 누름뿐이다. 틀이 스스로 펼치지 않는다.
  assert.equal([...frame.matchAll(/toggleStuck\(/g)].length, 4, '정의 하나, 단추 둘(막혔어요, 닫기), 글자판의 Esc 하나');
  assert.match(frame, /\$\('stuck'\)\.addEventListener\('click', \(\) => toggleStuck\(\)\);/);
  assert.match(frame, /\$\('stuck-close'\)\.addEventListener\('click', \(\) => toggleStuck\(false\)\);/);
  assert.doesNotMatch(frame, /setInterval/);
  // 선생님의 말은 고른 것에 맞는 것 하나뿐이다: 규칙 다시 말하기, 또는 그 힌트.
  assert.match(frame, /talkers\.play\.say\(F\.ruleLine\(round\), 'point'\);\s*return;/);
  assert.match(frame, /talkers\.play\.say\(list\[index\], 'point'\);/);
  // 틀의 대본에는 막힌 것을 두고 하는 말(위로, 격려)이 따로 없다.
  assert.deepEqual(Object.keys(C.stuck).filter((key) => !key.startsWith('_')), ['choices']);
});

test('몇 번 눌렀는지는 기록에만 남고 화면에 쓰이지 않는다', () => {
  for (const line of frame.split('\n')) {
    if (/textContent|append\(|replaceChildren|setAttribute/.test(line)) assert.doesNotMatch(line, /helpOf|\.help\b|sideOpened|sideDone|hintsOpened/, line.trim());
  }
  // 기록: 고른 것과 그때의 판 모습을 새 사건(help)으로 남긴다. 형식들이 쓰는 막힘 사건(stuck)과 이름이 겹치지 않는다.
  assert.match(frame, /note\('help', \{ choice, fresh, view: F\.view\(round\) \}\);/);
  assert.doesNotMatch(frame, /note\('stuck'/);
  assert.match(frame, /help: helpOf\(r\),/);
});

test('힌트: 둘째 고르기는 힌트 1을, 셋째 고르기는 힌트 2를 연다. 규칙 다시 보기는 힌트로 세지 않고, 같은 힌트를 다시 골라도 새로 세지 않는다', () => {
  assert.match(frame, /const HELP = \{ rule: null, next: 0, why: 1 \};/);
  assert.match(frame, /const fresh = index !== null && !seen\.includes\(index\);/);
  assert.match(frame, /if \(fresh\) \{\s*round\.hintsSeen = \[\.\.\.seen, index\];\s*round\.hintsOpened = round\.hintsSeen\.length;\s*\}/);
  assert.match(frame, /if \(fresh\) note\('hint', \{ no: index \+ 1 \}\);/);
  // "더 작은 판으로"는 첫째와 둘째 고르기 뒤에 내보인다. 셋째 고르기는 "왜 그럴까?"가 열려 있으면 그 단추를 눈에 띄게 한다.
  assert.match(frame, /if \(choice !== 'why'\) round\.sideOffered = true;/);
  assert.match(frame, /if \(choice === 'why' && !\$\('why'\)\.hidden\) flash\(\$\('why'\)\);/);
  assert.match(frame, /flash\(\$\('rule'\)\);/);
  // 판이 끝난 뒤에는 단추가 꺼진다.
  assert.match(frame, /\$\('stuck'\)\.disabled = round\.done;/);
  // 열린 힌트는 카드로 남는다(힌트 1, 힌트 2).
  assert.equal(C.hintTitle, '힌트 {no}');
});

test('"더 작은 판으로": 작은 판의 글은 대본에 있고, 돌아오면 한 번 묻는다', () => {
  assert.match(side, /id="smaller"[^>]*hidden>더 작은 판으로</);
  assert.equal(C.side.title, '작은 판');
  // "쓰다"는 적다/사용하다 두 뜻으로 들려서 쓰지 않는다. 돌아온 판은 위 띠의 "원래 판으로"와 같은 이름으로 부른다.
  assert.equal(C.side.back, '작은 판에서 알아낸 것이 이 판에도 맞을까요?');
  assert.equal(C.side.early, '원래 판으로 돌아왔어요.');
  for (const key of ['open', 'more', 'back', 'early']) {
    for (const sentence of sentences(C.side[key])) assert.match(sentence, /요[.?]$/, `${key}: ${sentence}`);
    assert.ok(sentenceCount(C.side[key]) <= 2, key);
    assert.doesNotMatch(C.side[key], BLAME, key);
    assert.doesNotMatch(C.side[key], /[A-Za-z]/, key);
    // 수준이 내려간다는 뜻의 말을 하지 않는다. 작은 판은 쉬운 판이 아니라 같은 규칙의 작은 판이다.
    assert.doesNotMatch(C.side[key], /쉬운|쉽게|내려|낮은|아래/, key);
  }
  // 끝까지 한 작은 판이 있으면 묻고, 하다가 돌아왔으면 돌아왔다는 사실만 말한다.
  assert.match(frame, /showPlay\(finished \? C\.side\.back : C\.side\.early\);/);
  // 위 띠: 제목에 작은 판임이 보이고, "나가기" 자리에 "원래 판으로"가 있다.
  const top = part('<section id="play"', '<div class="hello">');
  assert.match(top, /<button id="leave" class="btn small" type="button">← 나가기<\/button>/);
  assert.match(top, /<button id="side-back" class="btn small" type="button" hidden>← 원래 판으로<\/button>/);
  assert.match(frame, /\$\('leave'\)\.hidden = round\.side;\s*\$\('side-back'\)\.hidden = !round\.side;/);
  assert.match(frame, /round\.side\s*\?\s*C\.side\.title/);
  // 작은 판에서는 "더 작은 판으로"를 다시 내지 않는다. 더 작은 판이 없는 판에서도 보이지 않는다.
  assert.match(frame, /\$\('smaller'\)\.hidden = !\(round\.sideOffered && !round\.done && !round\.side && smallerOf\(round\) !== null\);/);
});

test('작은 판을 끝낸 뒤 고르기에는 "원래 판으로 돌아가기"(맨 위)와 "작은 판 하나 더"만 나온다', () => {
  const after = part('id="after"', '</section>');
  assert.match(after, /<button id="after-back" class="btn good huge" type="button" hidden>원래 판으로 돌아가기<\/button>\s*<button id="after-more" class="btn huge" type="button" hidden>작은 판 하나 더<\/button>\s*<button id="after-same"/);
  assert.match(frame, /\$\('after-feel'\)\.hidden = side;\s*\$\('feelings'\)\.hidden = side;/);
  assert.match(frame, /\$\('after-back'\)\.hidden = !side;/);
  assert.match(frame, /\$\('after-same'\)\.hidden = side \|\| round\.custom;/);
  assert.match(frame, /\$\('after-harder'\)\.hidden = side \|\| round\.custom \|\| round\.level >= top;/);
  assert.match(frame, /\$\('after-make'\)\.hidden = side;\s*\$\('after-stop'\)\.hidden = side;/);
  assert.match(frame, /\$\('after-solution'\)\.hidden = side \|\| outcome !== 'solved';/);
  // 작은 판에서는 더 어려운 판을 권하지 않는다.
  assert.match(frame, /round\.offeredHarder = !side && outcome === 'solved'/);
});

test('하던 판은 그대로 간직한다: 작은 판은 기기에 적어 두지 않고, 원래 판은 끝난 것으로도 나간 것으로도 치지 않는다', () => {
  // 작은 판을 하는 동안 기기에 적혀 있는 "하던 판"은 원래 판이다. 앱을 닫았다 열면 원래 판이 이어진다.
  assert.match(frame, /function persist\(\) \{\s*if \(!round \|\| round\.side\) return;/);
  assert.match(frame, /saved\.side !== true &&/);
  // 작은 판을 열 때: 원래 판에 사건을 남기고, 시계를 멈추고, 적어 둔다. 기록(나갔다)은 남기지 않는다.
  const open = frame.slice(frame.indexOf('function openSide()'), frame.indexOf('function startSide('));
  assert.match(open, /note\('side', \{ on: true, turn, board: small\.board \}\);[\s\S]*?stopClock\(\);\s*persist\(\);\s*origin = \{ round, finished: 0 \};/);
  assert.doesNotMatch(open, /saveRecord|'left'|finish\(/);
  // 작은 판의 기록에는 곁판이라는 표시와 원래 판의 번호가 붙는다. 판 번호는 없다.
  assert.match(frame, /\{ side: true, sideOf: parent\.id, sideTurn: turn \}/);
  assert.match(frame, /side: r\.side === true,\s*sideOf: r\.sideOf \?\? null,\s*sideTurn: r\.sideTurn \?\? null,/);
  // 작은 판을 끝내도 하던 판(원래 판)을 지우지 않는다.
  assert.match(frame, /if \(side\) \{[\s\S]*?log\.saveCurrent\(parent\);\s*\} else \{\s*log\.clearCurrent\(\);/);
  // 수준 맞추기와 "왜 그럴까?"와 다음 판 번호는 작은 판의 기록을 빼고 본다.
  assert.match(frame, /const records = \(\) => withoutSide\(log\.allRecords\(\)\);/);
  assert.equal([...frame.matchAll(/log\.allRecords\(\)/g)].length, 1);
  for (const name of ['code', 'swap', 'tile', 'tax', 'logic', 'block', 'river', 'cups', 'dandelion', 'maze', 'rulehunt', 'untangle', 'lamps', 'rooms', 'machine', 'split', 'eyeball', 'cutpaste', 'fold', 'domino', 'pieces', 'magic', 'apart', 'keymaze', 'cipher', 'seqpath', 'pancake', 'product', 'sim', 'matches', 'fair', 'rowflip', 'foxrabbit', 'pins', 'net', 'regionmap', 'blackhole']) assert.doesNotMatch(read(`src/formats/${name}.js`), /log\.allRecords\(\)/, name);
});
