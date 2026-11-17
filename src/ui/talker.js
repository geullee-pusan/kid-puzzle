// 선생님이 말하게 한다: 자막을 쓰고, 목소리로 읽고, 입을 움직인다.
// 선생님이 하는 말은 늘 자막으로도 보여 준다. 목소리가 안 나는 기기에서도 자막은 나온다.
// 말이 끝나기를 기다리게 하지 않는다. 아이는 말하는 중에도 무엇이든 누를 수 있다.
import { speak, stopSpeaking } from './speech.js';

/**
 * @param {{teacher: object, caption: HTMLElement, voice: {pitch: number, rate: number}}} parts
 */
export function createTalker({ teacher, caption, voice }) {
  let turn = 0;
  let typing = 0;
  let last = '';

  /** 자막을 두 글자씩 써 나간다 */
  function typeText(text) {
    const my = ++typing;
    const chars = [...text];
    let shown = 0;
    const step = () => {
      if (my !== typing) return;
      shown = Math.min(chars.length, shown + 2);
      caption.textContent = chars.slice(0, shown).join('');
      if (shown < chars.length) setTimeout(step, 28);
    };
    step();
  }

  /** 한마디 한다. 그사이 다른 말이 시작되면 앞의 말은 끊긴다. */
  async function say(text, pose = 'talk') {
    const my = ++turn;
    last = text;
    typeText(text);
    teacher.pose(pose);
    let started = false;
    const begin = () => {
      if (started || my !== turn) return;
      started = true;
      teacher.talking(true);
    };
    const early = setTimeout(begin, 300); // 소리가 늦게 시작해도 입은 곧 움직인다
    await speak(text, voice, { onStart: begin });
    clearTimeout(early);
    if (my !== turn) return;
    teacher.talking(false);
    teacher.pose('idle');
    typing++;
    caption.textContent = text;
  }

  /** 하던 말을 끊는다. 자막은 끝까지 채워 둔다. */
  function hush() {
    turn++;
    typing++;
    stopSpeaking();
    teacher.talking(false);
    teacher.pose('idle');
    caption.textContent = last;
  }

  return { say, hush };
}
