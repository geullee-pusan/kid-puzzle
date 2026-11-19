// 점검 화면(부모·개발용). 아이에게 보여 줄 화면이 아니다.
// 기록 전송 설정, 지금 보내 보기, 저장된 기록 보기·지우기, 서비스 워커와 오프라인 상태를 본다.
import './check.css';
import { recommend, whyUnlocked } from './core/level.js';
import * as log from './ui/log.js';
import { offlineStatus, setupOffline } from './ui/offline.js';
import { available } from './ui/storage.js';
import { loadSync, logPath, putFile, saveSync } from './ui/sync.js';

const $ = (id) => document.getElementById(id);

function facts(list, rows) {
  const nodes = [];
  for (const [name, value] of rows) {
    const dt = document.createElement('dt');
    dt.textContent = name;
    const dd = document.createElement('dd');
    dd.textContent = String(value);
    nodes.push(dt, dd);
  }
  list.replaceChildren(...nodes);
}

const yes = (value) => (value ? '예' : '아니요');
const failText = (result) => `보내지 못했어요 (${result.status || '연결 안 됨'}) ${result.detail ?? ''}`;

function drawCounts() {
  facts($('counts'), [
    ['기기에 저장된 기록', `${log.recordCount()}개`],
    ['아직 못 보낸 기록', `${log.pendingCount()}개`],
    ['하던 판', yes(log.loadCurrent())],
    ['기기 저장소를 쓸 수 있음', yes(available())],
  ]);
  // 수준 맞추기는 형식마다 따로 계산한다.
  const rows = [];
  for (const [format, name] of [
    ['coins', '동전 뒤집기'],
    ['trace', '한붓그리기'],
    ['code', '숫자 추리'],
    ['swap', '자리 바꾸기'],
    ['tile', '조각 덮기'],
    ['duel', '누가 이길까'],
    ['tax', '약수 세금'],
    ['logic', '참말 섬'],
    ['block', '조각 못 들어가게 막기'],
    ['river', '강 건너기'],
    ['cups', '컵 뒤집기와 세 색 무리'],
    ['dandelion', '민들레와 바람'],
    ['maze', '주사위 미로와 길 세기'],
    ['rulehunt', '숨은 규칙 찾기'],
    ['untangle', '엉킨 그림 풀기'],
    ['lamps', '켜고 끄기와 숫자 마술'],
    ['rooms', '방 한 번씩 돌기'],
    ['machine', '규칙 기계와 규칙이 깨지는 판'],
    ['split', '똑같이 섞이게 자르기'],
    ['eyeball', '눈대중'],
  ]) {
    const advice = recommend(log.allRecords(), format);
    rows.push(
      [`${name}: 먼저 보여 줄 단계`, `${advice.level}단계${advice.small ? ' (작은 판)' : ''}`],
      [`${name}: 더 어려운 판 권하기`, advice.offerHarder ? `예 (${advice.harderLevel}단계)` : '아니요'],
      [`${name}: 까닭`, advice.reason],
      [`${name}: "왜 그럴까?" 열림`, yes(whyUnlocked(log.allRecords(), format))],
    );
  }
  facts($('advice'), rows);
}

async function drawOffline(mode) {
  const status = await offlineStatus();
  facts($('offline'), [
    ['서비스 워커', mode === 'dev' ? '개발 서버에서는 쓰지 않음' : mode === 'ready' ? '켜짐' : mode === 'unsupported' ? '이 브라우저는 지원하지 않음' : '켜지 못함'],
    ['등록됨', yes(status.registered)],
    ['이 화면을 맡고 있음', yes(status.controlled)],
    ['새 판이 기다리는 중', yes(status.waiting)],
    ['받아 둔 파일', `${status.files}개 (묶음 ${status.caches}개)`],
    ['지금 연결', status.online ? '온라인' : '오프라인'],
    ['홈 화면에서 연 앱인가', yes(matchMedia('(display-mode: standalone)').matches)],
  ]);
}

async function main() {
  const mode = await setupOffline();
  let build = null;
  if (mode !== 'dev') {
    try {
      build = await (await fetch('./build.json', { cache: 'no-store' })).json();
    } catch {
      build = null;
    }
  }
  log.setBuild(build ? build.version : mode);
  $('build').textContent = build ? `판 ${build.version} (${build.builtAt})` : mode === 'dev' ? '개발 서버' : '';

  // ---- 기록 보내기 설정 ----
  const sync = loadSync();
  const keyNote = () => (sync.token ? '저장된 키가 있어요 (바꾸려면 새로 입력)' : '');
  $('repo').value = sync.repo;
  $('token').placeholder = keyNote();
  const currentSync = () => ({ repo: $('repo').value, token: $('token').value || sync.token });

  $('syncform').addEventListener('submit', (event) => {
    event.preventDefault();
    const next = currentSync();
    const saved = saveSync(next);
    sync.repo = next.repo.trim();
    sync.token = next.token.trim();
    $('token').value = '';
    $('token').placeholder = keyNote();
    $('syncstatus').textContent = saved ? '이 기기에 저장했어요.' : '저장하지 못했어요.';
  });

  $('synctest').addEventListener('click', async () => {
    $('syncstatus').textContent = '보내는 중…';
    const body = { kind: 'sync-test', at: new Date().toISOString(), app: build ? build.version : mode };
    const result = await putFile(currentSync(), logPath('sync-test'), `${JSON.stringify(body, null, 2)}\n`, '기록 전송 시험');
    $('syncstatus').textContent = result.ok ? `보냈어요: ${result.detail}` : failText(result);
  });

  // ---- 기록 ----
  const status = $('recordstatus');
  $('flush').addEventListener('click', async () => {
    status.textContent = '보내는 중…';
    const result = await log.flush();
    if (result.skipped) status.textContent = '저장소와 인증키를 먼저 저장해 주세요.';
    else status.textContent = result.ok ? `${result.sent}개 보냈어요.` : `${result.sent}개 보낸 뒤 멈췄어요. ${failText(result)}`;
    drawCounts();
  });

  const dumpText = () => JSON.stringify({ records: log.allRecords(), current: log.loadCurrent() }, null, 2);
  $('export').addEventListener('click', () => {
    $('dump').hidden = false;
    $('dump').textContent = dumpText();
    status.textContent = `기록 ${log.recordCount()}개를 아래에 보여 줘요.`;
  });
  $('copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(dumpText());
      status.textContent = '복사했어요.';
    } catch {
      $('dump').hidden = false;
      $('dump').textContent = dumpText();
      const range = document.createRange();
      range.selectNodeContents($('dump'));
      getSelection().removeAllRanges();
      getSelection().addRange(range);
      status.textContent = '아래 글을 골라 두었어요. 복사해 주세요.';
    }
  });

  // 지우기는 한 번 더 눌러야 된다(실수로 누르는 것을 막는다).
  let armed = false;
  $('clear').addEventListener('click', () => {
    if (!armed) {
      armed = true;
      $('clear').textContent = '정말 지울까요? 한 번 더 누르면 지워요';
      setTimeout(() => {
        armed = false;
        $('clear').textContent = '기록 지우기';
      }, 5000);
      return;
    }
    armed = false;
    log.clearRecords();
    $('clear').textContent = '기록 지우기';
    $('dump').hidden = true;
    status.textContent = '기기의 기록을 지웠어요. 이미 저장소로 보낸 기록은 그대로 있어요.';
    drawCounts();
  });

  $('recheck').addEventListener('click', () => {
    drawCounts();
    drawOffline(mode);
  });
  addEventListener('online', () => drawOffline(mode));
  addEventListener('offline', () => drawOffline(mode));

  drawCounts();
  await drawOffline(mode);
}

main();
