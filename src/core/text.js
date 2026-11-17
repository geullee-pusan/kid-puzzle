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
