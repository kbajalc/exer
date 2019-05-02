import * as Lo from 'lodash';

const notBase64 = /[^A-Z0-9+\/=\n\r]/i;

// const base64 = new RegExp("^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{4})([=]{1,2})?$");

export function isBase64(str: string): boolean {
  let len = str.length;
  const firstPaddingIndex = str.indexOf('=');
  let firstPaddingChar = firstPaddingIndex;
  let firstCorrect = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === '\r' || c === '\n') {
      len--;
      if (i < firstPaddingChar) firstCorrect++;
    }
  }
  if (firstPaddingChar > firstCorrect) firstPaddingChar -= firstCorrect;
  if (!len || len % 4 !== 0 || notBase64.test(str)) {
    return false;
  }
  return firstPaddingChar === -1 ||
    firstPaddingChar === len - 1 ||
    (firstPaddingChar === len - 2 && str[firstPaddingIndex + 1] === '=');
}

export function isUUID(str: string): boolean {
  if (!str) return false;
  return !!str.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
}

export function wildcardMatch(rule: string, value: string) {
  return new RegExp('^' + rule.split('*').join('.*') + '$').test(value);
}

/**
 * Converts string to title case.
 *
 * @param string The string to convert.
 * @return Returns the snake upper cased string.
 */
export function titleCase(str: string): string {
  const val = Lo.camelCase(str);
  if (!val) return val;
  return val.substr(0, 1).toUpperCase() + val.substr(1);
}

/**
 * Converts string to snake upper case.
 *
 * @param string The string to convert.
 * @return Returns the snake upper cased string.
 */
export function snakeUpperCase(str: string) {
  // const val = str.replace(/(?:([a-z])([A-Z]))|(?:((?!^)[A-Z])([a-z]))/g, '$1_$3$2$4');
  const val = Lo.snakeCase(str);
  return val.toUpperCase();
}

/**
 * Converts string to kebab upper case.
 *
 * @param string The string to convert.
 * @return Returns the kebab upper cased string.
 */
export function kebabUpperCase(str: string) {
  return Lo.kebabCase(str).toUpperCase();
}

export function indent(text: string, spaces?: string | number) {
  // tslint:disable-next-line:no-parameter-reassignment
  if (typeof spaces === 'number') spaces = ' '.repeat(spaces);
  const lines = text.split('\n');
  let first = lines[0];
  if (!first.trim().length) first = lines[1] || '';
  const pad = first.substr(0, first.indexOf(first.trim()));
  const res = lines.map(line => line.startsWith(pad) ? line.substring(pad.length) : line)
    .map(line => ((spaces || '') + line).trimRight())
    .join('\n');
  return res;
}

export function literal(obj: any): string {
  let res = '{';
  let i = 0;
  for (const [key, val] of Object.entries(obj)) res += `${(i++) ? ', ' : ' '}${key}: ${JSON.stringify(val)}`;
  res += ' }';
  return res;
}

export function parseMap(map: string, prefix?: string) {
  const res: Record<string, any> = {};
  const parts = map.split(';').map(x => x.trim()).filter(x => x);
  for (const part of parts) {
    let key: string;
    let value: string;
    [key, value] = part.split('=').map(x => x.trim()).filter(x => x);
    res[(prefix || '') + key] = value;
  }
  return res;
}
