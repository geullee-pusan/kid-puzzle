// 성냥개비의 판을 그린다: 모눈의 점, 변마다 놓인 성냥(굵은 막대와 머리), 빈 자리, 성냥이 처음 있던 자리, 찾은 정사각형의 테두리.
// 누를 수 있는 판과 보기만 하는 그림(처음 화면, 공책, 판 고르기, 풀이, "왜 그럴까?")을 같은 모양으로 그린다.
// 색만으로 알리지 않는다.
//   성냥      나무색 막대와 둥근 머리(테두리가 짙다)
//   빈 자리   가는 회색 점선(옮기기 판과 만들기 판에서만)
//   처음 자리 성냥이 처음 있던 빈 자리는 성냥 모양의 점선 테두리
//   옮겨 온 성냥  막대 둘레에 넓은 금빛 점선 띠
//   고른 성냥 막대 둘레에 굵은 고리(짧은 점선)
//   정사각형  크기마다 선의 모양이 다르다: 한 변이 성냥 1개는 실선, 2개는 긴 점선, 3개는 짧은 점선, 4개는 긴 점선과 점을 번갈아
//   경우 표시 "모든 경우 펼쳐 보기"에서 성냥 자리마다 그 성냥 하나만 뺐을 때 남는 정사각형 수(흰 동그라미에 굵은 수).
//             아직 해 보지 않은 경우는 수 없이 점선 동그라미다
// 누르는 자리는 변마다 마름모 하나다(변의 두 끝과 양옆 칸의 가운데를 잇는다). 마름모끼리 겹치지 않고 빈틈없이 판을 덮는다.
// 글자(읽어 주는 이름)는 형식(src/formats/matches.js)이 대본에서 채워 건넨다. 이 파일에는 글을 적지 않는다.
import { edgeCount, edgeEnds } from '../core/matches.js';

const NS = 'http://www.w3.org/2000/svg';
/** 칸 한 변의 길이(그림 안의 길이) */
export const UNIT = 100;
/** 판 둘레의 여백(칸 한 변에 대한 몫). 가장자리 변의 마름모가 그림 안에 들어가게 반 칸을 둔다 */
export const PAD = 0.5;
const STICK = 15; // 막대의 굵기
const INSET = 13; // 막대 끝과 모눈의 점 사이
const HEAD = 11; // 머리의 반지름
const CASE_R = 17; // 경우 표시 동그라미의 반지름(막대 길이의 반쯤이라 성냥이 보인다)
/** 정사각형의 테두리를 칸 안쪽으로 들이는 거리(크기마다). 큰 것일수록 바깥에 그려 겹쳐도 보이게 한다 */
const OUTLINE_INSET = [22, 15, 8, 3];

function make(tag, attrs = {}, className = '') {
  const node = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  if (className) node.setAttribute('class', className);
  return node;
}

/** 변 하나의 자리(그림 안). 두 끝과 가로인지 */
function spot(w, h, edge) {
  const end = edgeEnds(w, h, edge);
  return { horizontal: end.horizontal, x1: end.x1 * UNIT, y1: end.y1 * UNIT, x2: end.x2 * UNIT, y2: end.y2 * UNIT };
}

/** 변을 따라 놓인 막대 모양의 네모(안쪽으로 inset만큼 들이고 굵기는 thick) */
function stickRect(at, inset, thick, className, extra = {}) {
  const length = UNIT - 2 * inset;
  const attrs = at.horizontal
    ? { x: at.x1 + inset, y: at.y1 - thick / 2, width: length, height: thick }
    : { x: at.x1 - thick / 2, y: at.y1 + inset, width: thick, height: length };
  return make('rect', { ...attrs, rx: thick / 2, ...extra }, className);
}

/** 성냥 하나: 막대와 머리(왼쪽 끝이나 위쪽 끝) */
function match(at) {
  const group = make('g', {}, 'mt-match');
  group.append(stickRect(at, INSET, STICK, 'mt-stick'));
  const head = at.horizontal ? { cx: at.x1 + INSET + HEAD - 2, cy: at.y1 } : { cx: at.x1, cy: at.y1 + INSET + HEAD - 2 };
  group.append(make('circle', { ...head, r: HEAD }, 'mt-head'));
  return group;
}

/** 변의 누르는 자리: 변의 두 끝과 양옆 칸의 가운데를 잇는 마름모 */
function rhombus(at) {
  const half = UNIT / 2;
  const points = at.horizontal
    ? [
        [at.x1, at.y1],
        [at.x1 + half, at.y1 - half],
        [at.x2, at.y2],
        [at.x1 + half, at.y1 + half],
      ]
    : [
        [at.x1, at.y1],
        [at.x1 + half, at.y1 + half],
        [at.x2, at.y2],
        [at.x1 - half, at.y1 + half],
      ];
  return points.map((point) => point.join(',')).join(' ');
}

/**
 * 판의 그림(SVG).
 * @param {object} view
 *   w, h      모눈의 가로, 세로 칸 수
 *   on        지금 놓인 성냥(변 번호)
 *   origin    처음 놓인 성냥(처음 자리를 그릴 때 쓴다. 없으면 on)
 *   kind      'remove' | 'move' | 'make'. 빈 자리는 move와 make에서만 그린다
 *   pick      고른 성냥의 변(없으면 null)
 *   outline   테두리를 그릴 정사각형들(squaresIn의 값. 없으면 null)
 *   onEdge    (변 번호) → 눌렀을 때. 없으면 누를 수 없다
 *   tappable  (변 번호, 모습) → 누를 수 있는가(없으면 모두)
 *   labels    { board, edge(변 번호, 모습) } 읽어 줄 이름
 *   cases     경우 표시: [{ edge, squares }] squares는 그 성냥 하나만 뺐을 때 남는 정사각형 수, 아직 해 보지 않았으면 null
 */
export function boardSvg(view) {
  const { w, h, on, kind, pick = null, outline = null, onEdge, tappable, labels, cases = null } = view;
  const origin = view.origin ?? on;
  const now = new Set(on);
  const start = new Set(origin);
  const pad = PAD * UNIT;
  const svg = make('svg', { viewBox: `${-pad} ${-pad} ${w * UNIT + 2 * pad} ${h * UNIT + 2 * pad}` }, 'mt-svg');
  if (labels?.board) {
    svg.setAttribute('role', 'group');
    svg.setAttribute('aria-label', labels.board);
  } else svg.setAttribute('aria-hidden', 'true');
  const total = edgeCount(w, h);
  const stateOf = (edge) => {
    if (now.has(edge)) return edge === pick ? 'picked' : kind === 'move' && !start.has(edge) ? 'moved' : 'match';
    if (start.has(edge) && kind !== 'make') return kind === 'remove' ? 'gone' : 'start';
    return 'empty';
  };

  // 바닥: 빈 자리(옮기기와 만들기), 처음 자리
  for (let edge = 0; edge < total; edge++) {
    const at = spot(w, h, edge);
    const state = stateOf(edge);
    if (state === 'empty' && kind !== 'remove') svg.append(make('line', { x1: at.x1 + INSET, y1: at.y1 + (at.horizontal ? 0 : INSET), x2: at.x2 - (at.horizontal ? INSET : 0), y2: at.y2 - (at.horizontal ? 0 : INSET) }, 'mt-slot'));
    if (state === 'gone' || state === 'start') svg.append(stickRect(at, INSET, STICK, 'mt-ghost'));
  }
  // 모눈의 점
  for (let y = 0; y <= h; y++) for (let x = 0; x <= w; x++) svg.append(make('circle', { cx: x * UNIT, cy: y * UNIT, r: 5 }, 'mt-dot'));
  // 찾은 정사각형의 테두리(성냥 아래에 그린다)
  for (const square of outline ?? []) {
    const inset = OUTLINE_INSET[Math.min(square.size, OUTLINE_INSET.length) - 1];
    svg.append(
      make('rect', { x: square.c * UNIT + inset, y: square.r * UNIT + inset, width: square.size * UNIT - 2 * inset, height: square.size * UNIT - 2 * inset, rx: 6 }, `mt-square size-${Math.min(square.size, 4)}`),
    );
  }
  // 성냥과 그 둘레의 표시
  for (const edge of on) {
    const at = spot(w, h, edge);
    const state = stateOf(edge);
    if (state === 'moved') svg.append(stickRect(at, INSET - 6, STICK + 16, 'mt-moved'));
    svg.append(match(at));
    if (state === 'picked') svg.append(stickRect(at, INSET - 8, STICK + 18, 'mt-pick'));
  }
  // 경우 표시: 성냥 자리의 가운데에 동그라미(해 본 경우는 남는 정사각형 수)
  for (const item of cases ?? []) {
    const at = spot(w, h, item.edge);
    const cx = (at.x1 + at.x2) / 2;
    const cy = (at.y1 + at.y2) / 2;
    const tried = Number.isInteger(item.squares);
    const group = make('g', {}, tried ? 'mt-case tried' : 'mt-case');
    group.append(make('circle', { cx, cy, r: CASE_R }, 'mt-case-ring'));
    if (tried) {
      const text = make('text', { x: cx, y: cy, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, 'mt-case-n');
      text.textContent = String(item.squares);
      group.append(text);
    }
    svg.append(group);
  }
  // 누르는 자리
  if (onEdge) {
    for (let edge = 0; edge < total; edge++) {
      const state = stateOf(edge);
      if (tappable && !tappable(edge, state)) continue;
      const hit = make('polygon', { points: rhombus(spot(w, h, edge)), tabindex: 0, role: 'button' }, 'mt-hit');
      hit.dataset.edge = String(edge);
      if (labels?.edge) hit.setAttribute('aria-label', labels.edge(edge, state));
      hit.addEventListener('click', () => onEdge(edge));
      hit.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onEdge(edge);
      });
      svg.append(hit);
    }
  }
  return svg;
}

/** 누를 수 있는 판을 그린다. 그리기 전에 글자판으로 판 안의 변에 와 있었으면 같은 변으로 다시 옮긴다(손가락으로 누른 것은 옮기지 않는다) */
export function drawBoard(root, view) {
  const active = document.activeElement;
  const focused = root.contains(active) && active.matches?.(':focus-visible') ? active.dataset?.edge : undefined;
  root.className = `mt-board${view.onEdge ? ' live' : ''}`;
  root.replaceChildren(boardSvg(view));
  if (focused !== undefined) root.querySelector(`[data-edge="${focused}"]`)?.focus?.();
}

/** 작은 그림(처음 화면, 공책, 판 고르기, 만들기 목록) */
export function drawMini(root, view) {
  root.className = 'mt-board small';
  root.replaceChildren(boardSvg(view));
}

/**
 * 그림 카드: 판 하나와 그 아래 한 줄(풀이, "왜 그럴까?", 직접 만들기의 선생님 그림)
 * @param {object} view boardSvg의 값
 * @param {string} note
 * @param {{big?: boolean}} options big: 종이에 그림이 하나뿐일 때 크게 그린다
 */
export function boardCard(view, note = '', { big = false } = {}) {
  const box = document.createElement('div');
  box.className = big ? 'mt-card big' : 'mt-card';
  const holder = document.createElement('div');
  holder.className = 'mt-board small';
  holder.append(boardSvg(view));
  box.append(holder);
  if (note) {
    const line = document.createElement('p');
    line.className = 'strip-note';
    line.textContent = note;
    box.append(line);
  }
  return box;
}

/** 크기마다의 선 모양 보기(도구의 목록 앞에 붙는 짧은 선 그림) */
export function sizeSample(size) {
  const svg = make('svg', { viewBox: '0 0 80 20', 'aria-hidden': 'true' }, 'mt-size-sample');
  svg.append(make('line', { x1: 4, y1: 10, x2: 76, y2: 10 }, `mt-square size-${Math.min(size, 4)}`));
  return svg;
}
