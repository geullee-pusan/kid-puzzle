// 기록을 비공개 GitHub 저장소로 올린다. (같은 아이를 위한 파이썬 학습 앱의 sync.js에서 가져왔다.)
// 인증키(토큰)는 이 기기의 브라우저에만 저장한다. 그 저장소 하나에만 쓸 수 있는 키를 쓴다.
import { load, save } from './storage.js';

const KEY = 'sync';

export function loadSync() {
  const saved = load(KEY, null);
  if (saved && typeof saved.repo === 'string' && typeof saved.token === 'string') return { repo: saved.repo, token: saved.token };
  // 저장된 값이 없거나 깨졌으면 없는 것으로 본다.
  return { repo: '', token: '' };
}

export function saveSync(settings) {
  return save(KEY, { repo: String(settings.repo ?? '').trim(), token: String(settings.token ?? '').trim() });
}

function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/**
 * 겹치지 않는 파일 이름을 만든다(같은 이름을 덮어쓰려면 한 번 더 물어야 해서 번거롭다).
 * 예: logs/2026-11/20261118T101500Z-ab12.json
 */
export function logPath(kind, now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const month = now.toISOString().slice(0, 7);
  const random = Math.random().toString(36).slice(2, 6).padEnd(4, '0');
  return `${kind}/${month}/${stamp}-${random}.json`;
}

/** 파일 하나를 저장소에 새로 만든다. { ok, status, detail }을 돌려준다. */
export async function putFile(settings, path, text, message) {
  const repo = settings.repo.trim();
  const token = settings.token.trim();
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return { ok: false, status: 0, detail: '저장소는 "주인/이름" 꼴로 적어요' };
  if (!token) return { ok: false, status: 0, detail: '인증키가 비어 있어요' };
  try {
    const response = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
      body: JSON.stringify({ message, content: toBase64(text) }),
    });
    if (response.ok) return { ok: true, status: response.status, detail: path };
    let detail = '';
    try {
      detail = (await response.json()).message || '';
    } catch {
      // 본문이 없어도 상태 번호만으로 알린다.
    }
    return { ok: false, status: response.status, detail };
  } catch (error) {
    return { ok: false, status: 0, detail: `연결하지 못했어요 (${error.message})` };
  }
}
