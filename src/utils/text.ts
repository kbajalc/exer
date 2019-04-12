const notBase64 = /[^A-Z0-9+\/=\n\r]/i;

export function isUUID(str: string): boolean {
  if (!str) return false;
  return !!str.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
}

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

export function wildcardMatch(rule: string, value: string) {
  return new RegExp('^' + rule.split('*').join('.*') + '$').test(value);
}

/**
 * Converts string into camelCase.
 *
 * @see http://stackoverflow.com/questions/2970525/converting-any-string-into-camel-case
 */
export function camelCase(str: string, firstCapital: boolean = false): string {
  return str.replace(/^([A-Z])|[\s-_](\w)/g, (match, p1, p2, offset) => {
    if (firstCapital && offset === 0) return p1;
    if (p2) return p2.toUpperCase();
    return p1.toLowerCase();
  });
}

/**
 * Converts string into snake_case.
 *
 * @see https://regex101.com/r/QeSm2I/1
 */
export function snakeCase(str: string, upper?: boolean) {
  const val = str.replace(/(?:([a-z])([A-Z]))|(?:((?!^)[A-Z])([a-z]))/g, '$1_$3$2$4');
  return upper ? val.toUpperCase() : val.toLowerCase();
}

/**
 * Converts string into kebab-case.
 *
 * @see https://regex101.com/r/mrU9L0/1
 */
export function kebapCase(str: string, upper?: boolean) {
  const val = str.replace(/(?:([a-z])([A-Z]))|(?:((?!^)[A-Z])([a-z]))/g, '$1-$3$2$4');
  return upper ? val.toUpperCase() : val.toLowerCase();
}

/**
 * Converts string into title-case.
 *
 * @see http://stackoverflow.com/questions/196972/convert-string-to-title-case-with-javascript
 */
export function titleCase(str: string): string {
  return str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
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
