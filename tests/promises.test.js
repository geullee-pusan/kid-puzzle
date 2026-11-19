// 앱 전체에서 지키기로 한 것을 글자로 검사한다.
// - 보상 낱말(점수, 별, 순위, 연속 출석, 레벨, 배지, 등급 …)과 채점 표시가 화면 글에 없다.
// - 화면에 나오는 글은 대본과 index.html에만 있다.
// - localStorage는 한 파일에서만, 늘 try/catch 안에서 쓴다.
// - 서비스 워커는 바깥 주소(기록 전송)를 가로채지 않는다.
// (주산 앱 JUSAN의 no-banned.test.js 방식을 따랐다.)
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir) {
  const found = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) found.push(...walk(path));
    else if (['.js', '.json', '.css', '.html', '.webmanifest'].includes(extname(path))) found.push(path);
  }
  return found;
}

const files = [...walk(resolve(ROOT, 'src')), ...walk(resolve(ROOT, 'public')), resolve(ROOT, 'index.html'), resolve(ROOT, 'check.html')];
const sources = files.map((path) => ({ path: relative(ROOT, path).replace(/\\/g, '/'), text: readFileSync(path, 'utf8') }));
const source = (path) => sources.find((item) => item.path === path).text;

/** 주석을 지운다. 주소(https://…)의 // 는 주석이 아니므로 남긴다. */
function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/.*$/gm, '');
}

// 낱말이 다른 말의 일부로 들어가는 경우는 미리 지우고 본다(예: "단계별"의 별).
const HARMLESS = /단계별|규칙별|형식별|자리별|종류별|특별|구별|개별|별로|우선순위|연속한/g;
const BANNED = [
  [/점수|득점|만점/, '점수'],
  [/별/, '별'],
  [/순위|랭킹|리더보드|등수/, '순위'],
  [/연속|출석/, '연속 출석'],
  [/레벨/, '레벨'],
  [/배지|뱃지|훈장|메달|트로피/, '배지'],
  [/등급|급수/, '등급'],
  [/진도|달성률|퍼센트/, '진도율'],
  [/오늘의 할 일|하루 분량|목표량|숙제/, '하루 분량'],
  [/꾸미기|아이템|코인 상점|보상|경험치|포인트/, '보상'],
  [/정답률|성적|통계/, '성적 표시'],
  [/제한 시간|남은 시간|초 남|빨리빨리|서둘러/, '재촉'],
  [/[△✗✕❌⭐★☆🏆🥇]/u, '채점·보상 표시'],
  [/\b(score|star|streak|badge|rank|leaderboard|level-up|reward|xp)\b/i, '보상(영어)'],
];

function findBanned(text) {
  const hits = [];
  text.split('\n').forEach((line, index) => {
    const clean = line.replace(HARMLESS, '');
    for (const [pattern, name] of BANNED) {
      if (pattern.test(clean)) hits.push(`${name} → ${index + 1}줄: ${line.trim().slice(0, 80)}`);
    }
  });
  return hits;
}

// 아이 화면을 그리는 코드: 틀, 처음 만남, 형식마다 하나씩, 판을 그리는 조각들
const SCREEN_CODE = [
  'src/main.js',
  'src/meet.js',
  'src/notebook.js',
  'src/formats/coins.js',
  'src/formats/trace.js',
  'src/formats/code.js',
  'src/formats/swap.js',
  'src/formats/tile.js',
  'src/formats/duel.js',
  'src/formats/tax.js',
  'src/formats/logic.js',
  'src/formats/block.js',
  'src/formats/river.js',
  'src/formats/cups.js',
  'src/formats/dandelion.js',
  'src/formats/maze.js',
  'src/formats/rulehunt.js',
  'src/formats/untangle.js',
  'src/formats/lamps.js',
  'src/formats/rooms.js',
  'src/ui/coin-board.js',
  'src/ui/trace-board.js',
  'src/ui/code-board.js',
  'src/ui/swap-board.js',
  'src/ui/tile-board.js',
  'src/ui/duel-board.js',
  'src/ui/tax-board.js',
  'src/ui/logic-board.js',
  'src/ui/block-board.js',
  'src/ui/river-board.js',
  'src/ui/cups-board.js',
  'src/ui/dandelion-board.js',
  'src/ui/maze-board.js',
  'src/ui/rulehunt-board.js',
  'src/ui/untangle-board.js',
  'src/ui/lamps-board.js',
  'src/ui/rooms-board.js',
];
// 대본: 형식마다 하나씩
const SCRIPTS = ['src/content/coins.json', 'src/content/trace.json', 'src/content/code.json', 'src/content/swap.json', 'src/content/tile.json', 'src/content/duel.json', 'src/content/tax.json', 'src/content/logic.json', 'src/content/block.json', 'src/content/river.json', 'src/content/cups.json', 'src/content/dandelion.json', 'src/content/maze.json', 'src/content/rulehunt.json', 'src/content/untangle.json', 'src/content/lamps.json', 'src/content/rooms.json'];

test('검사 목록에 모든 형식의 코드와 대본이 들어 있다', () => {
  for (const { path } of sources) {
    if (path.startsWith('src/formats/')) assert.ok(SCREEN_CODE.includes(path), `${path}가 화면 코드 목록에 없어요`);
    if (path.startsWith('src/content/') && !path.includes('teacher')) assert.ok(SCRIPTS.includes(path), `${path}가 대본 목록에 없어요`);
  }
  for (const path of [...SCREEN_CODE, ...SCRIPTS]) assert.ok(sources.some((item) => item.path === path), `${path}가 없어요`);
});

test('검사기가 보상 낱말을 찾아낸다', () => {
  assert.equal(findBanned('별을 3개 모았어요').length, 1);
  assert.equal(findBanned('점수: 10').length, 1);
  assert.equal(findBanned('단계별로 특별한 판').length, 0);
  assert.equal(findBanned('다음 레벨').length, 1);
});

test('아이 화면의 글과 대본에 보상 낱말, 채점 표시, 재촉하는 말이 없다', () => {
  // 대본, 아이 화면, 설치 정보는 주석까지 통째로 본다.
  const whole = [...SCRIPTS, 'src/content/teacher.json', 'src/content/teacher-look.json', 'index.html', 'public/manifest.webmanifest'];
  const problems = [];
  for (const path of whole) for (const hit of findBanned(source(path))) problems.push(`${path} ${hit}`);
  // 아이 화면을 그리는 코드는 주석을 빼고 본다(주석에는 "점수를 두지 않는다" 같은 설명이 있다).
  for (const { path, text } of sources) {
    if (!path.startsWith('src/') || !path.endsWith('.js')) continue;
    if (path === 'src/check-main.js' || path.startsWith('src/core/')) continue;
    for (const hit of findBanned(stripComments(text))) problems.push(`${path} ${hit}`);
  }
  assert.deepEqual(problems, []);
});

test('아이 화면을 그리는 코드에는 글을 적지 않는다(글은 대본과 index.html에만 있다)', () => {
  for (const path of [...SCREEN_CODE, 'src/ui/talker.js', 'src/ui/teacher-view.js', 'src/ui/speech.js', 'src/ui/offline.js', 'src/ui/storage.js']) {
    const code = stripComments(source(path));
    const hangul = code.match(/[가-힣][^'"`\n]*/);
    assert.equal(hangul, null, `${path}: ${hangul?.[0]}`);
  }
});

test('화면에 시간을 보여 주지 않고, 스스로 넘어가는 것이 없다', () => {
  for (const path of [...SCREEN_CODE, 'src/ui/talker.js']) {
    const code = stripComments(source(path));
    assert.doesNotMatch(code, /setInterval\s*\(/, `${path}: setInterval`);
  }
  // 걸린 시간(elapsed, stamp, seconds)은 기록에만 들어가고 화면 글자로 쓰이지 않는다.
  for (const path of SCREEN_CODE) {
    for (const line of stripComments(source(path)).split('\n')) {
      if (/textContent|append\(|replaceChildren/.test(line)) assert.doesNotMatch(line, /elapsed|stamp\(|seconds/, `${path}: ${line.trim()}`);
    }
  }
});

test('localStorage는 src/ui/storage.js에서만 쓰고, 늘 try 안에서 쓴다', () => {
  const users = sources.filter((item) => /\blocalStorage\b/.test(stripComments(item.text))).map((item) => item.path);
  assert.deepEqual(users, ['src/ui/storage.js']);
  const lines = source('src/ui/storage.js').split('\n');
  let uses = 0;
  lines.forEach((line, index) => {
    if (!/\blocalStorage\b/.test(line) || /^\s*(\/\/|\*)/.test(line)) return;
    uses += 1;
    const before = lines.slice(Math.max(0, index - 6), index).join('\n');
    assert.match(before, /try\s*{/, `${index + 1}줄이 try 안에 있지 않아요: ${line.trim()}`);
  });
  assert.ok(uses >= 3);
  for (const { path, text } of sources) assert.doesNotMatch(stripComments(text), /\b(sessionStorage|indexedDB)\b/, path);
});

test('네트워크는 기록 전송(sync.js)과 판 번호 읽기(build.json)에만 쓴다', () => {
  for (const { path, text } of sources) {
    if (!path.endsWith('.js')) continue;
    const code = stripComments(text);
    for (const [, target] of code.matchAll(/\bfetch\s*\(\s*([^,)]+)/g)) {
      if (path === 'src/ui/sync.js') assert.match(target, /api\.github\.com/, `${path}: ${target}`);
      else if (path === 'public/sw.js') assert.equal(target.trim(), 'request', `${path}: ${target}`);
      else assert.equal(target.trim(), "'./build.json'", `${path}: ${target}`);
    }
    assert.doesNotMatch(code, /XMLHttpRequest|WebSocket|EventSource|sendBeacon/, path);
  }
  assert.doesNotMatch(source('index.html'), /(href|src)\s*=\s*["']https?:/i);
  assert.doesNotMatch(source('check.html'), /(href|src)\s*=\s*["']https?:/i);
});

test('서비스 워커: 교차 출처 격리 머리말을 붙이지 않고, 바깥 주소와 PUT은 가로채지 않는다', () => {
  const sw = stripComments(source('public/sw.js'));
  assert.doesNotMatch(sw, /Cross-Origin|require-corp/);
  assert.match(sw, /request\.method !== 'GET'\)\s*return/);
  assert.match(sw, /new URL\(request\.url\)\.origin !== self\.location\.origin\)\s*return/);
  assert.match(sw, /startsWith\(self\.registration\.scope\)\)\s*return/);
  // 빌드가 채울 자리가 그대로 있다.
  assert.ok(source('public/sw.js').includes("'/*VERSION*/dev'"));
  assert.ok(source('public/sw.js').includes('/*FILES*/[]'));
});

test('설치 정보(manifest): 이름, 시작 주소, 아이콘', () => {
  const manifest = JSON.parse(source('public/manifest.webmanifest'));
  assert.equal(manifest.name, '퍼즐 연구소');
  assert.equal(manifest.short_name, '연구소');
  assert.equal(manifest.lang, 'ko');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.id, './');
  assert.equal(manifest.display, 'standalone');
  for (const icon of manifest.icons) {
    const png = readFileSync(resolve(ROOT, 'public', icon.src));
    assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], icon.src);
    const size = Number(icon.sizes.split('x')[0]);
    assert.equal(png.readUInt32BE(16), size, `${icon.src}의 가로`);
    assert.equal(png.readUInt32BE(20), size, `${icon.src}의 세로`);
  }
});

test('선생님 모습은 정해진 값 그대로다(크기와 색)', () => {
  const look = JSON.parse(source('src/content/teacher-look.json'));
  delete look._설명;
  assert.deepEqual(look, {
    body: [19, 19, 6],
    head: [10, 20, 10],
    arm: [7.5, 19, 3],
    leg: [9.5, 16.15, 6],
    eye: [1, 4, 1],
    eyeX: 2.5,
    mouthBar: [3, 2, 1],
    mouthCorner: [1, 2, 1],
    mouthCornerX: 2,
    eyeMouthGap: 8,
    colors: { body: '#0D69AC', head: '#F5CD30', arm: '#F5CD30', leg: '#A4BD47', eye: '#1B1B1B', mouth: '#1B1B1B' },
  });
});

test('단추와 글자 크기: 단추는 48px 이상, 아이 화면의 글자는 18px 이상', () => {
  const css = source('src/app.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({ selector: match[1].trim(), body: match[2] }));
  for (const { selector, body } of blocks) {
    const font = body.match(/font-size:\s*(\d+)px/);
    // 판 번호(#build)는 부모가 보는 작은 글씨다.
    if (font && selector !== '#build') assert.ok(Number(font[1]) >= 18, `${selector}: 글자 ${font[1]}px`);
    const height = body.match(/min-height:\s*(\d+)px/);
    if (height && /\.btn|\.level|\.key/.test(selector)) assert.ok(Number(height[1]) >= 48, `${selector}: 높이 ${height[1]}px`);
  }
  const base = blocks.find((block) => block.selector === '.btn').body;
  assert.match(base, /min-height:\s*48px/);
  assert.match(blocks.find((block) => block.selector === '.btn.huge').body, /min-height:\s*(6[4-9]|[7-9]\d)px/);
  assert.match(blocks.find((block) => block.selector === '.btn.big').body, /min-height:\s*(6[4-9]|[7-9]\d)px/);
  assert.match(css, /body\s*\{[^}]*font:\s*18px/);
});

test('저장소에 개인 정보를 적지 않는다(이름, 학원, 학년)', () => {
  const texts = [...sources, { path: 'README.md', text: readFileSync(resolve(ROOT, 'README.md'), 'utf8') }, { path: 'package.json', text: readFileSync(resolve(ROOT, 'package.json'), 'utf8') }];
  for (const { path, text } of texts) {
    assert.doesNotMatch(text, /학원|영재원|\d학년|초등 ?\d|만 ?\d+세|\d+살/, path);
    assert.doesNotMatch(text, /@[\w-]+\.(com|net|kr)/, path);
  }
});
