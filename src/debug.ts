import tty = require('tty');
import util = require('util');
import { InspectOptions } from 'util';

export interface Debug {
  (namespace?: string, enable?: boolean): Debugger;
  enable: (namespaces?: string) => void;
  disable: () => void;
  enabled: (namespaces: string) => boolean;
  coerce: (val: any) => any;

  names: RegExp[];
  skips: RegExp[];
  formatters: Formatters;
}

export interface Formatters {
  [formatter: string]: (v: any) => string;
}

export interface Debugger {
  (formatter: any, ...args: any[]): void;

  enabled: boolean;
  useColors: boolean;
  color: number;
  diff: string | number;
  log: (...args: any[]) => void;
  fatal: (...args: any[]) => void;
  error: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  debug: (...args: any[]) => void;
  trace: (...args: any[]) => void;
  time: (...args: any[]) => [number, number];
  end: (...args: any[]) => [number, number];
  timeEnd: (...args: any[]) => [number, number];
  namespace: string;
  extend: (namespace: string, delimiter?: string) => Debugger;
}

interface DebugOptions extends InspectOptions {
  hideDate: boolean;
  useConsole: boolean;
  alwaysDiff: boolean;
}

export enum DebugLevel {
  ALL = 0,
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5,
  OFF = 6,
}

/**
 * Create a debugger with the given `namespace`.
 *
 * @param {String} namespace
 * @return {Function}
 * @api public
 */
// tslint:disable-next-line:function-name
export function Debug(namespace?: string, enable?: boolean): Debugger {
  // tslint:disable-next-line:no-parameter-reassignment
  namespace = namespace || 'debug';

  function debug(this: Function, ...args: any[]): any {
    // Disabled?
    if (!debug.enabled) return;

    const self = debug;

    let hrt = process.hrtime();
    const curr = hrt;
    self.diff = Debug.millis(process.hrtime(debug.prev || curr));
    self.prev = debug.prev;
    self.curr = curr;
    debug.prev = curr;

    // TODO: Move to functions
    let timer = '';
    let stack = '';
    if (this === Debug.trace) {
      stack = new Error().stack.replace('Error', 'Trace').split('\n').filter((t, i) => i !== 1).join('\n');
    } else if (this === Debug.time) {
      const label = args.shift();
      if (!label) {
        Debug.times[hrt.join(':')] = hrt;
        return hrt;
      } else {
        if (Debug.times[label]) Debug.log(`Warning: Label '${label}' already exists for Debug.time()`);
        Debug.times[label] = hrt;
      }
      timer = `(${label}: start)`;
    } else if (this === Debug.timeEnd || this === Debug.end) {
      const first = args.shift();
      const label = Array.isArray(first) ? first.join(':') : first || 'default';
      const start = Debug.times[label];
      if (!start) Debug.log(`Warning: No such label '${label}' for Debug.timeEnd()`);
      hrt = process.hrtime(start);
      const dif = Debug.humanize(Debug.millis(hrt));
      delete Debug.times[label];
      timer = Array.isArray(first) ? `(${dif})` : `(${label}: ${dif})`;
    }
    if (timer && args.length === 0) {
      args.push(timer);
      timer = '';
    } else if (timer && args.length) {
      timer += ' ';
    }

    args[0] = args.length ? Debug.coerce(args[0]) : '';
    if (typeof args[0] !== 'string') {
      // Anything else let's inspect with %O
      args.unshift('%O');
    }

    // Apply any `formatters` transformations
    let index = 0;
    args[0] = args[0].replace(/%([a-zA-Z%])/g, (match: any, format: any) => {
      // If we encounter an escaped % then don't increase the array index
      if (match === '%%') return match;
      index++;
      const formatter: any = Debug.formatters[format];
      if (typeof formatter === 'function') {
        const val = args[index];
        // tslint:disable-next-line:no-parameter-reassignment
        match = formatter.call(self, val); // Now we need to remove `args[index]` since it's inlined in the `format`
        args.splice(index, 1);
        index--;
      }
      return match;
    }); // Apply env-specific formatting (colors, etc.)

    Debug.formatArgs.call(self, this, timer, stack, args);
    const logFn = this || Debug.log;
    logFn.apply(self, args);

    return hrt;
  }

  debug.prev = process.hrtime();
  debug.namespace = namespace;
  debug.enabled = Debug.enabled(namespace) || enable;
  debug.useColors = Debug.useColors();
  debug.color = Debug.selectColor(namespace);
  debug.destroy = destroy;
  debug.extend = extend;

  debug.diff = undefined as number | string;
  debug.prev = undefined as [number, number];
  debug.curr = undefined as [number, number];

  debug.log = debug.bind(Debug.log);
  debug.fatal = debug.bind(Debug.fatal);
  debug.error = debug.bind(Debug.error);
  debug.info = debug.bind(Debug.info);
  debug.warn = debug.bind(Debug.warn);
  debug.debug = debug.bind(Debug.debug);
  debug.trace = debug.bind(Debug.trace);
  debug.time = debug.bind(Debug.time);
  debug.end = debug.bind(Debug.end);
  debug.timeEnd = debug.bind(Debug.timeEnd);

  if (typeof Debug.init === 'function') Debug.init(debug);

  Debug.instances.push(debug);
  return debug;
}

/**
 * Adds ANSI color escape codes if enabled.
 *
 * @api public
 */
Debug.formatArgs = function formatArgs(this: Debugger, fun: any, timer: string, trace: string, args: any[]): void {
  const useColors = this.useColors;

  // TODO: Color code per level (fun.color)
  let z = fun && fun.name || '';
  if (z === 'timeEnd') z = 'time';
  if (z === 'detail') z = 'debug';

  let level = z.toUpperCase();
  if (this.useColors) {
    z = (Debug as any)[`${z}Icon`];
    level = z ? (z + ' ') : level;
  }
  if (level) level += ' ';

  const name = `[${this.namespace}]`;
  const msg = trace ? trace.replace('Trace:', args[0] !== '' ? 'Trace: ' + args[0] : 'Trace:') : args[0];
  if (useColors) {
    const c = this.color;
    const colorCode = "\x1B[3" + (c < 8 ? c : '8;5;' + c);
    const prefix = "".concat(colorCode, ";1m").concat(name, " \x1B[0m");

    args[0] = level + prefix + timer + msg.split('\n').join('\n' + level + prefix);
    args.push(colorCode + 'm+' + Debug.humanize(this.diff) + "\x1B[0m");
  } else {
    args[0] = getDate() + level + name + ' ' + timer + (args.length ? msg : '')
      + (Debug.alwaysDiff() ? ' +' + Debug.humanize(this.diff) : '');
  }
  // return util.format.call(util, ...args);
};

// Debug.debug = Debug;
// Debug.default = Debug;
// Debug.humanize = require('ms');
Debug.humanize = (ms: any) => `${ms} ms`;

Debug.times = {} as Record<string, [number, number]>;

/**
* Active `debug` instances.
*/
Debug.instances = [] as Debugger[];

/**
* The currently active debug mode names, and names to skip.
*/
Debug.names = [] as RegExp[];
Debug.skips = [] as RegExp[];

/**
* Map of special "%n" handling functions, for the debug "format" argument.
*
* Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
*/
Debug.formatters = { o, O } as Formatters;

Debug.colors = [6, 2, 3, 4, 5, 1];
try {
  const fullColors = [
    20, 21, 26, 27, 32, 33, 38, 39, 40, 41, 42, 43, 44, 45, 56, 57, 62,
    63, 68, 69, 74, 75, 76, 77, 78, 79, 80, 81, 92, 93, 98, 99, 112, 113,
    128, 129, 134, 135, 148, 149, 160, 161, 162, 163, 164, 165, 166, 167,
    168, 169, 170, 171, 172, 173, 178, 179, 184, 185, 196, 197, 198, 199,
    200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 214, 215, 220, 221
  ];
  // Optional dependency (as in, doesn't need to be installed, NOT like optionalDependencies in package.json)
  // eslint-disable-next-line import/no-extraneous-dependencies
  const supportsColor = require('supports-color');
  if (supportsColor && (supportsColor.stderr || supportsColor).level >= 2) {
    Object.assign(Debug.colors, fullColors);
  }
} catch (error) {
  // Swallow - we only care if `supports-color` is available; it doesn't have to be.
}

/**
 * Build up the default `inspectOpts` object from the environment variables.
 *
 *   $ DEBUG_COLORS=no DEBUG_DEPTH=10 DEBUG_SHOW_HIDDEN=enabled node script.js
 */
// tslint:disable:align
Debug.inspectOpts = Object.keys(process.env)
  .filter(key => /^debug_/i.test(key))
  .reduce((obj, key) => {
    // Camel-case
    // Coerce string value into JS value
    const prop = key.substring(6).toLowerCase().replace(/_([a-z])/g, (_, k) => k.toUpperCase());
    let val: any = process.env[key];
    if (/^(yes|on|true|enabled)$/i.test(val)) {
      val = true;
    } else if (/^(no|off|false|disabled)$/i.test(val)) {
      val = false;
    } else if (val === 'null') {
      val = null;
    } else {
      val = Number(val);
    }
    obj[prop] = val;
    return obj;
  }, {} as any) as DebugOptions;

/**
 * Init logic for `debug` instances.
 *
 * Create a new `inspectOpts` object in case `useColors` is set
 * differently for a particular `debug` instance.
 */
Debug.init = function init(debug: any) {
  debug.inspectOpts = { ...Debug.inspectOpts };
};

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */
Debug.load = function load(): string {
  return process.env.DEBUG;
};

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */
Debug.save = function save(namespaces: string): void {
  if (namespaces) {
    process.env.DEBUG = namespaces;
  } else {
    // If you set a process.env field to null or undefined, it gets cast to the
    // string 'null' or 'undefined'. Just delete instead.
    delete process.env.DEBUG;
  }
};

/**
 * Is stdout a TTY? Colored output is enabled when `true`.
 */
Debug.useColors = function useColors() {
  return 'colors' in Debug.inspectOpts
    ? Boolean(Debug.inspectOpts.colors)
    : tty.isatty((process.stderr as any).fd);
};

/**
 * Is console instead of stdout/err used as output.
 */
Debug.useConsole = function useConsole() {
  return 'useConsole' in Debug.inspectOpts
    ? Boolean(Debug.inspectOpts.useConsole)
    : true;
};

Debug.alwaysDiff = function alwaysDiff() {
  return 'alwaysDiff' in Debug.inspectOpts
    ? Boolean(Debug.inspectOpts.alwaysDiff)
    : false;
};

/**
* Selects a color for a debug namespace
* @param {String} namespace The namespace string for the for the debug instance to be colored
* @return {Number|String} An ANSI color code for the given namespace
* @api private
*/
Debug.selectColor = function selectColor(namespace: string): any {
  let hash = 0;
  for (let i = 0; i < namespace.length; i++) {
    hash = (hash << 5) - hash + namespace.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Debug.colors[Math.abs(hash) % Debug.colors.length];
};

/**
* Enables a debug mode by namespaces. This can include modes
* separated by a colon and wildcards.
*
* @param {String} namespaces
* @api public
*/
Debug.enable = function enable(namespaces?: string) {
  // tslint:disable-next-line:no-parameter-reassignment
  namespaces = namespaces === undefined ? '*' : namespaces;
  Debug.save(namespaces);
  Debug.names = [];
  Debug.skips = [];
  let i;
  const split = (typeof namespaces === 'string' ? namespaces : '').split(/[\s,]+/);
  const len = split.length;
  for (i = 0; i < len; i++) {
    if (!split[i]) {
      // ignore empty strings
      continue;
    }
    // tslint:disable-next-line:no-parameter-reassignment
    namespaces = split[i].replace(/\*/g, '.*?');
    if (namespaces[0] === '-') {
      Debug.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
    } else {
      Debug.names.push(new RegExp('^' + namespaces + '$'));
    }
  }
  for (i = 0; i < Debug.instances.length; i++) {
    const instance = Debug.instances[i];
    instance.enabled = Debug.enabled(instance.namespace);
  }
};

/**
* Disable debug output.
*
* @api public
*/
Debug.disable = function disable(): void {
  Debug.enable('');
};

/**
* Returns true if the given mode name is enabled, false otherwise.
*
* @param {String} name
* @return {Boolean}
* @api public
*/
Debug.enabled = function enabled(name: string) {
  if (name[name.length - 1] === '*') return true;
  for (let i = 0; i < Debug.skips.length; i++) {
    const item = Debug.skips[i];
    if (item instanceof RegExp && item.test(name)) return false;
  }
  for (let i = 0; i < Debug.names.length; i++) {
    const item = Debug.names[i];
    if (item instanceof RegExp && item.test(name)) return true;
  }
  return false;
};

/**
* Coerce `val`.
*
* @param {Mixed} val
* @return {Mixed}
* @api private
*/
Debug.coerce = function coerce(val: any) {
  if (val instanceof Error) {
    return val.stack || val.message;
  }
  return val;
};

Debug.level = DebugLevel.DEBUG;

Debug.isBellow = function isBellow(ofLevel: DebugLevel) {
  return Debug.level > ofLevel;
};

Debug.setLevel = function setLevel(toLevel: DebugLevel): void {
  if (toLevel == null || toLevel === undefined) {
    Debug.level = DebugLevel.OFF;
  } else {
    Debug.level = (DebugLevel[toLevel as any] || DebugLevel.INFO) as any;
  }
};

Debug.logIcon = '';
Debug.fatalIcon = '🛑';
Debug.errorIcon = '❗';
Debug.infoIcon = 'ℹ️';
Debug.warnIcon = '⚠️';
Debug.debugIcon = '🔹';
Debug.traceIcon = '🔸';
Debug.timeIcon = '⏱️';
Debug.endIcon = '⏱️';
Debug.timeEndIcon = '⏱️';

/**
 * Invokes `util.format()` with the specified arguments and writes to stderr.
 */
Debug.log = function log(...args: any[]) {
  Debug.useConsole() ? console.log(...args) : process.stdout.write(util.format.call(util, ...args) + '\n');
};

Debug.fatal = function fatal(...args: any[]) {
  Debug.useConsole() ? console.error(...args) : process.stderr.write(util.format.call(util, ...args) + '\n');
};

Debug.error = function error(...args: any[]) {
  Debug.useConsole() ? console.error(...args) : process.stderr.write(util.format.call(util, ...args) + '\n');
};

Debug.info = function info(...args: any[]) {
  Debug.useConsole() ? console.info(...args) : process.stdout.write(util.format.call(util, ...args) + '\n');
};

Debug.warn = function warn(...args: any[]) {
  Debug.useConsole() ? console.warn(...args) : process.stdout.write(util.format.call(util, ...args) + '\n');
};

Debug.debug = function detail(...args: any[]) {
  Debug.useConsole() ? console.debug(...args) : process.stdout.write(util.format.call(util, ...args) + '\n');
};

Debug.trace = function trace(...args: any[]) {
  Debug.useConsole() ? console.info(...args) : process.stdout.write(util.format.call(util, ...args) + '\n');
};

Debug.time = function time(...args: any[]): [number, number] {
  Debug.useConsole() ? console.info(...args) : process.stdout.write(util.format.call(util, ...args) + '\n');
  return void null;
};

Debug.end = function end(...args: any[]) {
  Debug.useConsole() ? console.info(...args) : process.stdout.write(util.format.call(util, ...args) + '\n');
};

Debug.timeEnd = function timeEnd(...args: any[]) {
  Debug.useConsole() ? console.info(...args) : process.stdout.write(util.format.call(util, ...args) + '\n');
};

Debug.millis = function millis(span: [number, number], offset?: number): string {
  const ms = (span[0] * 1000) + Math.floor(span[1] / 1000000) - (offset || 0);
  const ns = Math.floor((span[1] % 1000000) / 1000) / 1000;
  return `${ms}${ns.toFixed(3).substring(1)}`;
};

Debug.enable(Debug.load());

/**
 * Map %o to `util.inspect()`, all on a single line.
 */
// tslint:disable-next-line:function-name
function o(this: any, v: any) {
  this.inspectOpts.colors = this.useColors;
  return util.inspect(v, this.inspectOpts).replace(/\s*\n\s*/g, ' ');
}

/**
 * Map %O to `util.inspect()`, allowing multiple lines if needed.
 */
// tslint:disable-next-line:function-name
function O(this: any, v: any) {
  this.inspectOpts.colors = this.useColors;
  return util.inspect(v, this.inspectOpts);
}

function getDate() {
  if (Debug.inspectOpts.hideDate) return '';
  return new Date().toISOString() + ' ';
}

function destroy(this: any) {
  const index = Debug.instances.indexOf(this);
  if (index !== -1) {
    Debug.instances.splice(index, 1);
    return true;
  }
  return false;
}

function extend(this: any, namespace: string, delimiter: string) {
  return Debug(this.namespace + (typeof delimiter === 'undefined' ? ':' : delimiter) + namespace);
}

export { Debug as debug };
export default Debug;
