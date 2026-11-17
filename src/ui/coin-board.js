// 동전 판을 그린다. 한 줄 또는 고리. 누를 수 있는 판과 그림으로만 보여 주는 판을 같은 모양으로 그린다.
// 색만으로 앞뒤를 전하지 않는다. 동전마다 글자(앞, 뒤)를 함께 쓴다. 글자는 대본에서 받는다.

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** 고리에서 i번째 동전의 자리(판 크기에 대한 백분율)와 동전 크기 */
function ringPlace(index, n) {
  const angle = (index / n) * 2 * Math.PI - Math.PI / 2; // 맨 위에서 시작해 시계 방향으로 돈다
  const radius = 38;
  const size = Math.min(22, 2 * radius * Math.sin(Math.PI / n) - 3);
  return { left: 50 + radius * Math.cos(angle), top: 50 + radius * Math.sin(angle), size };
}

/**
 * 동전들을 그린다.
 * @param {HTMLElement} root 그릴 자리(안의 것을 모두 바꾼다)
 * @param {object} view
 *   coins     1(앞면)과 0(뒷면)의 배열
 *   shape     'line' | 'ring'
 *   faces     { heads, tails } 동전에 쓸 글자
 *   label     (번호, 앞면인가) → 읽어 줄 이름(누를 수 있는 판에서만)
 *   onTap     (번호) → 눌렀을 때. 없으면 그림으로만 그린다
 *   selected  고른 동전 번호들
 *   open      지금 고를 수 있는 동전 번호들(null이면 모두)
 *   flipped   방금 뒤집힌 동전 번호들(뒤집히는 움직임을 보여 준다)
 *   mark      눈에 띄게 할 동전 번호들(그림용)
 *   labels    동전마다 붙일 글자(그림용, 예: "가나다가나다")
 *   small     작은 그림으로 그린다
 */
export function drawCoins(root, view) {
  const { coins, shape = 'line', faces, label, onTap, selected = [], open = null, flipped = [], mark = [], labels = '', small = false } = view;
  const n = coins.length;
  root.className = `coins ${shape}${small ? ' small' : ''}${labels ? ' tagged' : ''}`;
  root.style.setProperty('--n', String(n));
  const tags = [...labels];
  const nodes = coins.map((coin, index) => {
    const node = el(onTap ? 'button' : 'div', `coin ${coin ? 'heads' : 'tails'}`);
    node.append(el('span', 'coin-face', coin ? faces.heads : faces.tails));
    if (tags[index]) node.append(el('span', 'coin-tag', tags[index]));
    if (selected.includes(index)) node.classList.add('selected');
    if (flipped.includes(index)) node.classList.add('flipped');
    if (mark.includes(index)) node.classList.add('marked');
    if (shape === 'ring') {
      const place = ringPlace(index, n);
      node.style.left = `${place.left}%`;
      node.style.top = `${place.top}%`;
      node.style.width = `${place.size}%`;
    }
    if (onTap) {
      node.type = 'button';
      if (label) node.setAttribute('aria-label', label(index, Boolean(coin)));
      node.setAttribute('aria-pressed', String(selected.includes(index)));
      const blocked = open !== null && !open.includes(index) && !selected.includes(index);
      if (blocked) {
        node.classList.add('blocked');
        node.disabled = true;
      }
      node.addEventListener('click', () => onTap(index));
    }
    return node;
  });
  root.replaceChildren(...nodes);
}

/**
 * 동전 판 여러 개를 화살표로 이어서 그린다(풀이와 "왜 그럴까?"의 그림).
 * @param {{steps: number[][], shape?: string, labels?: string, mark?: number[], note?: string, captions?: string[]}} strip
 */
export function drawStrip(strip, faces) {
  const box = el('div', 'strip');
  const row = el('div', 'strip-row');
  strip.steps.forEach((coins, index) => {
    if (index > 0) row.append(el('span', 'strip-arrow', '→'));
    const cell = el('div', 'strip-cell');
    const picture = el('div');
    // 바뀐 동전을 눈에 띄게 한다: 앞 그림에서는 곧 뒤집을 동전, 뒤 그림에서는 방금 뒤집힌 동전
    const marks = strip.marks?.[index] ?? strip.mark ?? [];
    drawCoins(picture, { coins, shape: strip.shape ?? 'line', faces, labels: strip.labels ?? '', mark: marks, small: true });
    cell.append(picture);
    if (strip.captions?.[index]) cell.append(el('span', 'strip-caption', strip.captions[index]));
    row.append(cell);
  });
  box.append(row);
  if (strip.note) box.append(el('p', 'strip-note', strip.note));
  return box;
}
