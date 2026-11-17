// 기록. 판 하나가 기록 하나다. 요약이 아니라 누른 순서까지 원본을 남긴다(나중에 다시 분석할 수 있게).
// - 모든 기록은 기기에 쌓아 둔다(수준 맞추기가 이 목록에서 다시 계산한다).
// - 인증키가 저장되어 있으면 비공개 저장소로 올린다. 판이 끝나거나 그만둘 때 올리고,
//   오프라인이거나 실패하면 "아직 못 보낸 것"에 남겨 두었다가 다음에 다시 올린다.
// - 설정이 없으면 조용히 건너뛴다. 화면에 오류를 띄우지 않는다. 올리지 못해도 퍼즐은 그대로 된다.
// 기록은 아이를 평가하는 데 쓰지 않는다. 퍼즐을 고치는 데 쓴다. 화면에는 통계를 보여 주지 않는다.
import { load, remove, save } from './storage.js';
import { loadSync, logPath, putFile } from './sync.js';

const RECORDS = 'records'; // 기기에 쌓아 둔 모든 기록
const PENDING = 'pending'; // 아직 못 보낸 기록
const CURRENT = 'current'; // 하던 판(다시 오면 그대로 이어서 한다)
const DRAFT = 'draft'; // 직접 만들기에서 만들던 판

/** 기기에 쌓아 두는 기록 수의 위 끝(임시). 넘으면 오래된 것부터 버린다. */
const MAX_RECORDS = 400;
const MAX_PENDING = 400;

const session = `s-${Date.now().toString(36)}`;
let build = 'dev';

const asList = (value) => (Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : []);
let records = asList(load(RECORDS, []));
let pending = asList(load(PENDING, []));

export function setBuild(version) {
  build = version;
}

export const sessionId = () => session;

/** 겹치지 않는 기록 번호 */
export function newId(prefix = 'r') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** 같은 번호(id)의 기록이 있으면 바꿔 넣고, 없으면 맨 뒤에 붙인다. */
function upsert(list, record) {
  const at = list.findIndex((item) => item.id === record.id);
  if (at >= 0) list[at] = record;
  else list.push(record);
}

/**
 * 기록 하나를 남긴다. 같은 판을 다시 남기면(나갔다가 돌아와 풀었을 때, 끝난 뒤 고른 것이 생겼을 때) 뒤의 것이 앞의 것을 바꾼다.
 * 모든 기록에 앱 판 번호, 세션, 고친 횟수(rev)가 붙는다.
 */
export function saveRecord(record) {
  const before = records.find((item) => item.id === record.id);
  const stamped = { ...record, app: build, session, rev: (before?.rev ?? 0) + 1 };
  upsert(records, stamped);
  upsert(pending, stamped);
  if (records.length > MAX_RECORDS) records = records.slice(-MAX_RECORDS);
  if (pending.length > MAX_PENDING) pending = pending.slice(-MAX_PENDING);
  save(RECORDS, records);
  save(PENDING, pending);
  return stamped;
}

/** 기기에 쌓아 둔 모든 기록(오래된 것부터). 복사본을 준다. */
export const allRecords = () => records.slice();
export const recordCount = () => records.length;
export const pendingCount = () => pending.length;

/** 기기의 기록을 모두 지운다(점검 화면에서만 쓴다). 하던 판은 그대로 둔다. */
export function clearRecords() {
  records = [];
  pending = [];
  save(RECORDS, records);
  save(PENDING, pending);
}

let sending = false;

/**
 * 아직 못 보낸 기록을 하나씩 올린다. 기록 하나가 파일 하나다(logs/2026-11/20261118T101500Z-ab12.json).
 * 인증키가 없으면 아무 일도 하지 않는다. 하나라도 실패하면 거기서 멈추고 나머지는 다음에 다시 올린다.
 * @returns {Promise<{ok: boolean, sent: number, skipped?: boolean, status?: number, detail?: string}>}
 */
export async function flush() {
  const settings = loadSync();
  if (!settings.repo || !settings.token) return { ok: false, sent: 0, skipped: true };
  if (sending) return { ok: false, sent: 0, skipped: true };
  sending = true;
  let sent = 0;
  try {
    while (pending.length > 0) {
      const record = pending[0];
      const ended = new Date(record.endedAt ?? Date.now());
      const when = Number.isNaN(ended.getTime()) ? new Date() : ended;
      const result = await putFile(settings, logPath('logs', when), `${JSON.stringify(record, null, 2)}\n`, '퍼즐 기록');
      if (!result.ok) return { ok: false, sent, status: result.status, detail: result.detail };
      // 올리는 사이에 같은 판이 고쳐졌으면(rev가 달라졌으면) 고친 것을 남겨 두어 다시 올린다.
      pending = pending.filter((item) => !(item.id === record.id && item.rev === record.rev));
      save(PENDING, pending);
      sent += 1;
    }
    return { ok: true, sent };
  } finally {
    sending = false;
  }
}

// ---- 하던 판 ----

export function saveCurrent(state) {
  return save(CURRENT, state);
}

export function loadCurrent() {
  const state = load(CURRENT, null);
  return state && typeof state === 'object' ? state : null;
}

export function clearCurrent() {
  remove(CURRENT);
}

// ---- 직접 만들기에서 만들던 판. 형식마다 하나씩 둔다(동전 뒤집기는 예전부터 쓰던 자리를 그대로 쓴다). ----

const draftKey = (format) => (format === 'coins' ? DRAFT : `${DRAFT}-${format}`);

export function saveDraft(draft, format = 'coins') {
  return save(draftKey(format), draft);
}

export function loadDraft(format = 'coins') {
  const draft = load(draftKey(format), null);
  return draft && typeof draft === 'object' ? draft : null;
}

// ---- 설정(선생님 목소리, 처음 만남을 보았는지, 연구소에 와 본 적이 있는지) ----

export function loadPrefs() {
  const prefs = load('prefs', null);
  return { sound: prefs?.sound !== false, visited: prefs?.visited === true, met: prefs?.met === true };
}

export function savePrefs(prefs) {
  return save('prefs', prefs);
}
