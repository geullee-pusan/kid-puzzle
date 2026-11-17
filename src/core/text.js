// 대본의 문장 틀에 값을 채운다. 순수 함수다.

/**
 * '{k}번이에요' 같은 틀의 {이름} 자리에 값을 넣는다. 값이 없으면 오류를 낸다(빈칸이 화면에 나가지 않게).
 * @param {string} template
 * @param {Record<string, string|number>} values
 */
export function fill(template, values = {}) {
  return template.replace(/\{([^{}]+)\}/g, (_, key) => {
    if (!(key in values)) throw new Error(`대본의 빈칸을 채울 값이 없어요: {${key}}`);
    return String(values[key]);
  });
}

/** 문장 수를 센다(마침표, 물음표, 느낌표로 끝나는 덩어리) */
export function sentenceCount(text) {
  return text.split(/[.?!]+/).filter((part) => part.trim().length > 0).length;
}

/**
 * 수를 소리 내어 읽었을 때 받침으로 끝나는가. 수 뒤에 붙는 말("15예요", "16이에요")을 고를 때 쓴다.
 * 2(이), 4(사), 5(오), 9(구)로 끝나는 수만 받침이 없다. 0으로 끝나는 수(십, 백, 영)는 받침이 있다.
 */
export function endsClosed(number) {
  return ![2, 4, 5, 9].includes(Math.abs(Math.trunc(number)) % 10);
}
