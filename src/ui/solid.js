// 입체 틀: 펼친 모양을 접고, 주사위를 쌓고, 손가락으로 끌어 돌린다. CSS 3D 변환으로 그린다(면마다 div 하나).
// 펼친 모양: 뿌리 칸 하나를 판 한가운데에 두고, 접히는 이음매마다 경첩(div)을 두 칸이 맞닿은 변에 단다.
//   경첩은 앞 칸의 안에 들어 있어서, 앞 칸이 접히면 뒤의 칸들도 함께 따라간다. 경첩을 90도씩 돌리면 칸이 화면 안쪽으로 접힌다.
//   그래서 접은 뒤에도 칸의 그림이 있는 쪽이 바깥을 본다. 접은 정육면체의 한가운데가 돌리는 가운데다.
// 주사위: 면 여섯을 상자 꼴로 붙인 것을 아래부터 쌓는다. 떼어 놓으면 사이가 벌어진다.
// 쌓기나무: 모눈 위에 한 칸짜리 정육면체를 쌓은 것. 밖으로 드러난 면만 그린다(맞닿은 면은 겹쳐 깜박이지 않게 그리지 않는다).
//   면은 방향마다 이름(위, 앞, 뒤, 옆)을 붙여 색의 밝기를 달리하고, 모든 면에 테두리를 둔다. 바닥에는 모눈 판을 깐다.
//   부르는 쪽이 바라보는 각(turn)을 건네면 그 각으로 돌아간다(앞, 옆, 위에서 보기).
// 판을 끌면(누른 채 움직이면) 돌아간다. 조금만 움직이고 떼면 누른 것이다(누른 면을 알려 준다).
// 글자는 받지 않는다. 면 위의 그림과 주사위 눈은 부르는 쪽이 그린다(paint). 읽어 주는 이름(label)도 부르는 쪽이 준다.
// 겹쳐 그린 판이 납작해지지 않게, 입체로 쌓는 것(세계, 면, 경첩)에는 overflow, opacity, filter를 쓰지 않는다.

const TAP_PX = 8; // 이보다 덜 움직였으면 끈 것이 아니라 누른 것이다
const TURN = 0.55; // 1픽셀 끌 때 도는 각(도)
const TILT = [-24, 32]; // 접은 뒤에 보는 각(위아래, 옆)
const STEP_S = 0.42; // 경첩 하나가 접히기 시작하는 사이(초)
/** 경첩마다 접힌 각: 오른쪽 칸은 오른쪽 변을 축으로, 위 칸은 위 변을 축으로 화면 안쪽으로 접힌다 */
const FOLDED = { E: 'rotateY(90deg)', W: 'rotateY(-90deg)', N: 'rotateX(90deg)', S: 'rotateX(-90deg)' };

const scenes = new WeakMap();

function div(className) {
  const node = document.createElement('div');
  node.className = className;
  return node;
}

/** 그릴 자리에 무대(원근이 있는 칸)와 세계(돌아가는 것)를 만든다. 끄는 동안에도 무대가 바뀌지 않게 한 번만 만든다 */
function sceneOf(root, key) {
  let scene = scenes.get(root);
  if (scene && scene.el.parentNode === root && scene.key === key) return { scene, fresh: false };
  const el = div('sd-scene');
  const world = div('sd-world');
  el.append(world);
  scene = { el, world, key, ax: 0, ay: 0, drag: null, view: null, faces: [], hinges: [], folded: null, apart: null, user: false };
  scenes.set(root, scene);
  listen(scene);
  root.replaceChildren(el);
  return { scene, fresh: true };
}

/** 칸 하나의 크기 --u의 위 끝(화면 픽셀). CSS의 .sd-world와 같은 값이다 */
const U_MAX = 130;

function place(scene) {
  const { world } = scene;
  const net = scene.view?.kind === 'net';
  const flat = net && !scene.folded;
  const [tx, ty] = flat ? scene.shift : [0, 0];
  // 접은 정육면체는 펼친 모양보다 작은 자리를 쓴다. 무대에 맞게 키워 보인다(무대가 화면에 놓여 있을 때만 잴 수 있다)
  let grow = 1;
  const width = scene.el.clientWidth;
  const height = scene.el.clientHeight;
  if (net && !flat && width > 0 && height > 0) {
    const unit = Math.min(width / scene.cols, height / scene.rows, U_MAX);
    grow = Math.max(1, Math.min(Math.min(width, height) / 2.5, U_MAX) / unit);
  }
  world.style.transform = `scale(${grow.toFixed(3)}) rotateX(${scene.ax}deg) rotateY(${scene.ay}deg) translate(calc(${tx} * var(--u)), calc(${ty} * var(--u)))`;
}

/** 끌어 돌리기와 누르기 */
function listen(scene) {
  const { el } = scene;
  el.addEventListener('pointerdown', (event) => {
    const view = scene.view;
    if (!view || scene.drag) return;
    if (!view.live && !view.onFace) return;
    scene.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, ax: scene.ax, ay: scene.ay, moved: false, face: event.target.closest?.('[data-face]')?.dataset.face ?? null };
    if (view.live) {
      event.preventDefault();
      try {
        el.setPointerCapture(event.pointerId);
      } catch {
        // 붙잡지 못해도 끄는 것은 그대로 된다.
      }
    }
  });
  el.addEventListener('pointermove', (event) => {
    const drag = scene.drag;
    if (!drag || drag.id !== event.pointerId || !scene.view?.live) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) <= TAP_PX) return;
    if (!drag.moved) {
      drag.moved = true;
      scene.world.classList.add('dragging');
    }
    scene.ay = drag.ay + dx * TURN;
    const clamp = scene.view.kind === 'stack' ? 90 : 85;
    scene.ax = Math.max(-clamp, Math.min(clamp, drag.ax - dy * TURN));
    scene.user = true;
    place(scene);
  });
  const release = (event, cancel) => {
    const drag = scene.drag;
    if (!drag || drag.id !== event.pointerId) return;
    scene.drag = null;
    scene.world.classList.remove('dragging');
    const view = scene.view;
    if (!view || cancel) return;
    if (drag.moved) view.onSpin?.();
    else if (drag.face !== null && view.onFace) view.onFace(Number(drag.face));
  };
  el.addEventListener('pointerup', (event) => release(event, false));
  el.addEventListener('pointercancel', (event) => release(event, true));
  // 글자판: 면에 들어가 들이기나 빈칸으로 누른다
  el.addEventListener('keydown', (event) => {
    const face = event.target.closest?.('[data-face]');
    if (!face || !scene.view?.onFace || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    scene.view.onFace(Number(face.dataset.face));
  });
}

/** 다음 그리기까지 움직임 없이 바로 그 모습으로 둔다(처음 그릴 때, 작은 그림) */
function settle(scene) {
  scene.el.classList.add('still');
  void scene.el.offsetWidth;
  requestAnimationFrame(() => scene.el.classList.remove('still'));
}

// ---- 펼친 모양 ----

const boxOf = (cells) => {
  const xs = cells.map((cell) => cell[0]);
  const ys = cells.map((cell) => cell[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs) + 1, h: Math.max(...ys) - Math.min(...ys) + 1 };
};

/**
 * 펼친 모양을 그리고, 접거나 편다.
 * @param {HTMLElement} root
 * @param {object} view
 *   cells      칸들 [x, y]
 *   tree       { parent, dir, order, root } (src/core/fold.js의 foldNet)
 *   folded     접었는가. 바뀌면 경첩이 차례로 움직인다(animate가 거짓이면 바로)
 *   paint      (skin, at) 면 위에 그림을 그린다(처음 만들 때 한 번)
 *   classes    (at) 칸마다 덧붙일 이름(그릴 때마다)
 *   labels     (at) 칸마다 읽어 주는 이름. 있으면 칸을 글자판으로 고를 수 있다
 *   onFace     (at) 칸을 눌렀다
 *   onSpin     () 끌어 돌렸다
 *   live       끌어 돌릴 수 있는가
 *   paintKey   그림이 바뀌었는지 가리는 글자(바뀌면 새로 만든다)
 *   tilt       접은 뒤에 보는 각 [위아래, 옆](정하지 않으면 TILT)
 *   label      무대를 읽어 주는 이름
 */
export function drawSolidNet(root, view) {
  const key = `net:${JSON.stringify(view.cells)}:${JSON.stringify(view.tree.parent)}:${view.paintKey ?? ''}`;
  const { scene, fresh } = sceneOf(root, key);
  scene.view = { kind: 'net', ...view };
  if (fresh) buildNet(scene, view, boxOf(view.cells));
  scene.el.classList.toggle('live', Boolean(view.live));
  scene.el.classList.toggle('small', Boolean(view.small));
  if (view.label) scene.el.setAttribute('aria-label', view.label);
  // 칸마다 이름 붙이기
  scene.faces.forEach((face, at) => {
    face.skin.className = `sd-skin ${view.classes ? view.classes(at) : ''}`;
    if (view.labels) {
      face.skin.setAttribute('aria-label', view.labels(at));
      face.skin.setAttribute('role', 'button');
      face.skin.tabIndex = 0;
    }
  });
  const folded = Boolean(view.folded);
  if (fresh) {
    // 처음 그릴 때는 펼친 모습으로 둔다. 접힌 판이면 바로 접고, foldIn이면 판이 화면에 놓인 뒤에 접히는 움직임을 보인다
    scene.folded = null;
    applyFold(scene, false, false);
    if (folded && view.foldIn) {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (scene.view?.folded && scene.folded === false) applyFold(scene, true, true);
        }),
      );
    } else if (folded) applyFold(scene, true, false);
    return;
  }
  if (scene.folded === folded) return;
  applyFold(scene, folded, view.animate !== false);
}

/** 경첩을 접거나 편다(animate면 차례로 움직인다) */
function applyFold(scene, folded, animate) {
  const { tree, tilt } = scene.view;
  const order = tree.order.filter((at) => at !== tree.root);
  order.forEach((at, step) => {
    const hinge = scene.hinges[at];
    const delay = folded ? step * STEP_S : (order.length - 1 - step) * STEP_S * 0.6;
    hinge.style.transitionDelay = animate ? `${delay}s` : '0s';
    hinge.style.transform = folded ? FOLDED[tree.dir[at]] : 'none';
  });
  scene.folded = folded;
  // 접으면 비스듬히 보이게 돌리고, 펴면 바로 앞에서 보이게 되돌린다(아이가 돌려 둔 각은 접혀 있는 동안 둔다)
  if (folded && !scene.user) [scene.ax, scene.ay] = tilt ?? TILT;
  if (!folded) {
    [scene.ax, scene.ay] = [0, 0];
    scene.user = false;
  }
  scene.world.style.transitionDelay = animate && !folded ? `${order.length * STEP_S * 0.6}s` : '0s';
  place(scene);
  if (!animate) settle(scene);
}

function buildNet(scene, view, box) {
  const { cells, tree } = view;
  const { world } = scene;
  // 칸 하나의 크기: 펼친 모양과 접은 정육면체가 모두 들어가게(둘레에 여유를 둔다)
  scene.cols = Math.max(box.w, 2.6) + 0.7;
  scene.rows = Math.max(box.h, 2.6) + 0.7;
  world.style.setProperty('--cols', String(scene.cols));
  world.style.setProperty('--rows', String(scene.rows));
  const rootCell = cells[tree.root];
  scene.shift = [rootCell[0] - (box.x0 + (box.w - 1) / 2), rootCell[1] - (box.y0 + (box.h - 1) / 2)];
  scene.faces = [];
  scene.hinges = [];
  const make = (at) => {
    const face = div('sd-face');
    const skin = div('sd-skin');
    skin.dataset.face = String(at);
    view.paint?.(skin, at);
    face.append(skin);
    scene.faces[at] = { face, skin };
    for (const child of tree.order) {
      if (tree.parent[child] !== at) continue;
      const hinge = div(`sd-hinge to-${tree.dir[child]}`);
      hinge.append(make(child));
      scene.hinges[child] = hinge;
      face.append(hinge);
    }
    return face;
  };
  const top = make(tree.root);
  top.classList.add('sd-root');
  world.replaceChildren(top);
}

// ---- 주사위 ----

/** 주사위 한 개의 면 자리(바닥, 위, 뒤, 앞, 오른쪽, 왼쪽)마다 놓는 모습 */
const DIE_FACES = ['rotateX(-90deg)', 'rotateX(90deg)', 'rotateY(180deg)', 'none', 'rotateY(90deg)', 'rotateY(-90deg)'];

/**
 * 쌓은 주사위를 그린다(아래 주사위부터).
 * @param {HTMLElement} root
 * @param {object} view
 *   dice     주사위마다 [바닥, 위, 뒤, 앞, 오른쪽, 왼쪽]의 눈
 *   paint    (skin, value) 면에 눈을 그린다
 *   classes  (die, face) 면마다 덧붙일 이름
 *   apart    떼어 놓았는가
 *   live, onSpin, label, tilt  펼친 모양과 같다
 */
export function drawSolidDice(root, view) {
  const key = `dice:${JSON.stringify(view.dice)}`;
  const { scene, fresh } = sceneOf(root, key);
  scene.view = { kind: 'dice', ...view };
  const count = view.dice.length;
  if (fresh) {
    const { world } = scene;
    world.style.setProperty('--cols', '3.2');
    world.style.setProperty('--rows', String((count - 1) * 1.45 + 2.2));
    world.style.setProperty('--count', String(count));
    const floor = div('sd-floor');
    const dice = view.dice.map((values, at) => {
      const die = div('sd-die');
      die.style.setProperty('--at', String(at));
      values.forEach((value, face) => {
        const skin = div('sd-skin sd-die-face');
        skin.style.transform = `${DIE_FACES[face] === 'none' ? '' : DIE_FACES[face]} translateZ(calc(var(--u) / 2))`;
        view.paint?.(skin, value);
        die.append(skin);
      });
      return die;
    });
    world.replaceChildren(floor, ...dice);
    scene.dice = dice;
    [scene.ax, scene.ay] = view.tilt ?? [-28, 34];
  }
  scene.el.classList.toggle('live', Boolean(view.live));
  scene.el.classList.toggle('small', Boolean(view.small));
  scene.el.classList.toggle('apart', Boolean(view.apart));
  if (view.label) scene.el.setAttribute('aria-label', view.label);
  scene.dice.forEach((die, at) => {
    [...die.children].forEach((skin, face) => {
      skin.className = `sd-skin sd-die-face ${view.classes ? view.classes(at, face) : ''}`;
    });
  });
  place(scene);
  if (fresh) settle(scene);
}

// ---- 쌓기나무 ----

/** 쌓기를 처음 그릴 때 보는 각(위아래, 옆): 위와 앞과 오른쪽 옆이 보인다 */
export const STACK_TILT = [-28, -34];
/** 면 자리(바닥, 위, 뒤, 앞, 오른쪽, 왼쪽)마다 이웃 칸의 방향 [가로, 앞뒤(뒤가 +), 높이]과 이름 */
const CUBE_SIDES = [
  [0, 0, -1],
  [0, 0, 1],
  [0, 1, 0],
  [0, -1, 0],
  [1, 0, 0],
  [-1, 0, 0],
];
const CUBE_NAMES = ['sd-cube-bottom', 'sd-cube-top', 'sd-cube-back', 'sd-cube-front', 'sd-cube-right', 'sd-cube-left'];

/**
 * 쌓기나무를 그린다. 쌓은 것이 바뀌어도 무대와 돌린 각은 그대로 두고 쌓기나무만 다시 놓는다.
 * @param {HTMLElement} root
 * @param {object} view
 *   w, d       가로 칸 수, 앞뒤 칸 수
 *   heights    칸마다 쌓은 수(앞 줄부터, 줄마다 왼쪽부터)
 *   levels     무대의 크기와 가운데를 정하는 높이(판에서 쌓을 수 있는 높이. 쌓는 동안 무대가 커졌다 작아졌다 하지 않게)
 *   paintFloor (plate) 바닥 판 앞에 붙는 띠에 그린다(처음 만들 때 한 번)
 *   turn       { id, angle: [위아래, 옆] } id가 바뀌면 그 각으로 돌아간다
 *   tilt       처음 그릴 때 보는 각(정하지 않으면 STACK_TILT)
 *   live, onSpin, label, small  펼친 모양과 같다
 */
export function drawSolidStack(root, view) {
  const { scene, fresh } = sceneOf(root, 'stack');
  scene.view = { kind: 'stack', ...view };
  const { w, d, heights } = view;
  const levels = Math.max(1, view.levels ?? Math.max(...heights));
  const key = `${w}:${d}:${levels}:${heights.join('')}`;
  if (fresh || scene.stackKey !== key) {
    buildStack(scene, view, levels, fresh || scene.stackBase !== `${w}:${d}:${levels}`);
    scene.stackKey = key;
  }
  if (fresh) {
    [scene.ax, scene.ay] = view.tilt ?? STACK_TILT;
    scene.turnId = view.turn?.id ?? null;
  } else if (view.turn && view.turn.id !== scene.turnId) {
    scene.turnId = view.turn.id;
    [scene.ax, scene.ay] = view.turn.angle;
  }
  scene.el.classList.add('stack');
  scene.el.classList.toggle('live', Boolean(view.live));
  scene.el.classList.toggle('small', Boolean(view.small));
  if (view.label) scene.el.setAttribute('aria-label', view.label);
  place(scene);
  if (fresh) settle(scene);
}

/** 바닥 판(모눈)과 드러난 면을 놓는다. base가 참이면(처음이거나 판의 크기가 바뀌었으면) 바닥 판도 새로 만든다 */
function buildStack(scene, view, levels, base) {
  const { w, d, heights } = view;
  const { world } = scene;
  // 끌어 돌려도 모두 들어가게: 대각선의 길이와 높이 가운데 긴 쪽에 여유를 둔다
  const reach = Math.max(Math.hypot(w, d), levels) + 0.8;
  world.style.setProperty('--cols', String(reach));
  world.style.setProperty('--rows', String(reach));
  if (base) {
    const floor = div('sd-stack-floor');
    floor.style.setProperty('--w', String(w));
    floor.style.setProperty('--d', String(d));
    floor.style.setProperty('--levels', String(levels));
    for (let at = 0; at < w * d; at++) floor.append(div('sd-floor-cell'));
    const plate = div('sd-floor-plate');
    plate.style.setProperty('--w', String(w));
    plate.style.setProperty('--d', String(d));
    plate.style.setProperty('--levels', String(levels));
    view.paintFloor?.(plate);
    scene.floor = [floor, plate];
    scene.stackBase = `${w}:${d}:${levels}`;
  }
  const height = (x, y) => (x < 0 || y < 0 || x >= w || y >= d ? 0 : heights[y * w + x]);
  const faces = [];
  for (let y = 0; y < d; y++) {
    for (let x = 0; x < w; x++) {
      for (let z = 0; z < heights[y * w + x]; z++) {
        CUBE_SIDES.forEach(([dx, dy, dz], side) => {
          // 바닥 판에 닿은 아랫면과 다른 쌓기나무에 맞닿은 면은 그리지 않는다
          if (dz < 0 && z === 0) return;
          const nz = z + dz;
          if (nz >= 0 && nz < height(x + dx, y + dy)) return;
          const face = div(`sd-skin sd-cube ${CUBE_NAMES[side]}`);
          const cx = x - (w - 1) / 2;
          const cy = levels / 2 - z - 0.5;
          const cz = (d - 1) / 2 - y;
          face.style.transform = `translate3d(calc(${cx} * var(--u)), calc(${cy} * var(--u)), calc(${cz} * var(--u))) ${DIE_FACES[side] === 'none' ? '' : DIE_FACES[side]} translateZ(calc(var(--u) / 2))`;
          faces.push(face);
        });
      }
    }
  }
  world.replaceChildren(...scene.floor, ...faces);
}
