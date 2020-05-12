import tty = require('tty');
import util = require('util');
import { InspectOptions } from 'util';

// export interface Log {
//   (namespace?: string, enable?: boolean): Logger;
//   get(namespace?: string, enable?: boolean): Logger;
//   enable: (namespaces?: string) => void;
//   disable: () => void;
//   enabled: (namespaces: string) => boolean;
//   coerce: (val: any) => any;

//   names: RegExp[];
//   skips: RegExp[];
//   formatters: Formatters;
// }

export interface Formatters {
  [formatter: string]: (v: any) => string;
}

export interface Logger {
  (formatter: any, ...args: any[]): void;

  enabled: boolean;
  useColors: boolean;
  color: number;
  diff: string | number;
  log: (...args: any[]) => void;
  emerg: (...args: any[]) => void;
  alert: (...args: any[]) => void;
  critical: (...args: any[]) => void;
  fatal: (...args: any[]) => void;
  error: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  notice: (...args: any[]) => void;
  debug: (...args: any[]) => void;
  trace: (...args: any[]) => void;
  time: (...args: any[]) => [number, number];
  end: (...args: any[]) => [number, number];
  timeEnd: (...args: any[]) => [number, number];
  namespace: string;
  extend: (namespace: string, delimiter?: string) => Logger;
}

interface LoggerOptions extends InspectOptions {
  hideDate: boolean;
  hideLevel: boolean;
  useConsole: boolean;
  alwaysDiff: boolean;
  systemd: boolean;
  level: LoggerLevel;
}

export enum LoggerLevel {
  OFF = -1,
  EMERG = 0,
  FATAL = 1,
  ALERT = 1,
  CRITICAL = 2,
  ERROR = 3,
  WARN = 4,
  WARNING = 4,
  NOTICE = 5,
  TIME = 6,
  INFO = 6,
  DEBUG = 7,
  ALL = 8,
  TRACE = 8
}

export type LoggerLevelType =
  'OFF' |
  'EMERG' |
  'FATAL' |
  'ALERT' |
  'CRITICAL' |
  'ERROR' |
  'WARN' |
  'NOTICE' |
  'TIME' |
  'INFO' |
  'DEBUG' |
  'ALL' |
  'TRACE';

/**
 * Create a debugger with the given `namespace`.
 *
 * @param {String} namespace
 * @return {Function}
 * @api public
 */
// tslint:disable-next-line:function-name
export function Log(namespace?: string, enable?: boolean): Logger {
  // tslint:disable-next-line:no-parameter-reassignment
  namespace = namespace || 'logger';

  function logger(this: Function, ...args: any[]): any {
    // Disabled?
    if (!logger.enabled) return;

    const self = logger;

    let hrt = process.hrtime();
    const curr = hrt;
    self.diff = Log.millis(process.hrtime(logger.prev || curr));
    self.prev = logger.prev;
    self.curr = curr;
    logger.prev = curr;

    // TODO: Move to functions
    let timer = '';
    let stack = '';
    if (this === Log.trace) {
      stack = new Error().stack.replace('Error', 'Trace').split('\n').filter((t, i) => i !== 1).join('\n');
    } else if (this === Log.time) {
      const label = args.shift();
      if (!label) {
        return hrt;
      } else {
        if (Log.times[label]) Log.log(`Warning: Label '${label}' already exists for Debug.time()`);
        Log.times[label] = hrt;
      }
      timer = `(${label}: start)`;
    } else if (this === Log.timeEnd || this === Log.end) {
      const first = args.shift();
      let label: string;
      let start: [number, number];
      if (Array.isArray(first) && first.length === 2 && Number.isFinite(first[0]) && Number.isFinite(first[1])) {
        label = first.join(':');
        start = first as [number, number];
      } else {
        label = first && String(first) || 'default';
        start = Log.times[label];
      }
      if (!start) Log.log(`Warning: No such label '${label}' for Debug.timeEnd()`);
      hrt = process.hrtime(start);
      const dif = Log.humanize(Log.millis(hrt));
      delete Log.times[label];
      timer = Array.isArray(first) ? `(${dif})` : `(${label}: ${dif})`;
    }
    if (timer && args.length === 0) {
      args.push(timer);
      timer = '';
    } else if (timer && args.length) {
      timer += ' ';
    }

    args[0] = args.length ? Log.coerce(args[0]) : '';
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
      const formatter: any = Log.formatters[format];
      if (typeof formatter === 'function') {
        const val = args[index];
        // tslint:disable-next-line:no-parameter-reassignment
        match = formatter.call(self, val); // Now we need to remove `args[index]` since it's inlined in the `format`
        args.splice(index, 1);
        index--;
      }
      return match;
    }); // Apply env-specific formatting (colors, etc.)

    Log.formatArgs.call(self, this, timer, stack, args);
    const logFn = (
      this === Log.log ||
      this === Log.emerg ||
      this === Log.alert ||
      this === Log.critical ||
      this === Log.fatal ||
      this === Log.error ||
      this === Log.info ||
      this === Log.warn ||
      this === Log.notice ||
      this === Log.debug ||
      this === Log.trace ||
      this === Log.time ||
      this === Log.end ||
      this === Log.timeEnd
    ) ? this : Log.log;
    logFn.apply(self, args);

    return hrt;
  }

  logger.prev = process.hrtime();
  logger.namespace = namespace;
  logger.enabled = Log.enabled(namespace) || enable;
  logger.useColors = Log.useColors();
  logger.color = Log.selectColor(namespace);
  logger.destroy = destroy;
  logger.extend = extend;

  logger.diff = undefined as number | string;
  logger.prev = undefined as [number, number];
  logger.curr = undefined as [number, number];

  logger.log = logger.bind(Log.log);
  logger.emerg = logger.bind(Log.emerg);
  logger.alert = logger.bind(Log.alert);
  logger.fatal = logger.bind(Log.fatal);
  logger.critical = logger.bind(Log.critical);
  logger.error = logger.bind(Log.error);
  logger.warn = logger.bind(Log.warn);
  logger.notice = logger.bind(Log.notice);
  logger.info = logger.bind(Log.info);
  logger.debug = logger.bind(Log.debug);
  logger.trace = logger.bind(Log.trace);
  logger.time = logger.bind(Log.time);
  logger.end = logger.bind(Log.end);
  logger.timeEnd = logger.bind(Log.timeEnd);

  if (typeof Log.init === 'function') Log.init(logger);

  Log.instances.push(logger);
  return logger;
}

Log.get = function get(namespace: string, enable?: boolean) {
  return Log(namespace, enable === undefined ? true : enable);
};

/**
 * Adds ANSI color escape codes if enabled.
 *
 * @api public
 */
Log.formatArgs = function formatArgs(this: Logger, fun: any, timer: string, trace: string, args: any[]): void {
  const useColors = this.useColors;

  // TODO: Color code per level (fun.color)
  let z = fun && fun.level || '';
  let level = z.toUpperCase();
  const tmp = level;
  level = level === 'END' ? 'TIME' : level;
  if (Log.inspectOpts.systemd) {
    let num: any = LoggerLevel[tmp || 'INFO'];
    if (num === 8) num = 7;
    level = `<${num}>`;
  } else if (this.useColors) {
    z = (Log as any)[`${tmp.toLowerCase()}Icon`];
    level = z ? (z + ' ') : level;
  }
  if (level && !Log.inspectOpts.systemd) level += ' ';

  const name = `[${this.namespace}]`;
  const msg = trace ? trace.replace('Trace:', args[0] !== '' ? 'Trace: ' + args[0] : 'Trace:') : args[0];
  const date = getDate();
  if (Log.inspectOpts.systemd) {
    args[0] = level + date + name + ' ' + timer + (args.length ? msg : '');
    if (Log.alwaysDiff()) args.push('+' + Log.humanize(this.diff));
    let line = util.format.call(util, ...args);
    // line = line.split('\n').join('\n' + level + date + name + ' ');
    // Escape new lines
    line = JSON.stringify(line);
    line = line.substring(1, line.length - 1);
    args[0] = line; args.length = 1;
  } else if (useColors) {
    const c = this.color;
    const colorCode = "\x1B[3" + (c < 8 ? c : '8;5;' + c);
    const prefix = "".concat(colorCode, ";1m").concat(name, " \x1B[0m");
    args[0] = level + prefix + timer + (args.length ? msg : '');
    args.push(colorCode + 'm+' + Log.humanize(this.diff) + "\x1B[0m");
  } else {
    if (Log.inspectOpts.hideLevel) level = '';
    args[0] = date + level + name + ' ' + timer + (args.length ? msg : '');
    if (Log.alwaysDiff()) args.push('+' + Log.humanize(this.diff));
  }
  // return util.format.call(util, ...args);
};

Log.humanize = (ms: any) => `${ms} ms`;

Log.times = {} as Record<string, [number, number]>;

/**
* Active `debug` instances.
*/
Log.instances = [] as Logger[];

/**
* The currently active debug mode names, and names to skip.
*/
Log.names = [] as RegExp[];
Log.skips = [] as RegExp[];

/**
* Map of special "%n" handling functions, for the debug "format" argument.
*
* Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
*/
Log.formatters = { o, O } as Formatters;

Log.colors = [6, 2, 3, 4, 5, 1];
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
    Object.assign(Log.colors, fullColors);
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
Log.inspectOpts = Object.keys(process.env)
  .filter(key => /^(debug_|log_)/i.test(key))
  .reduce((obj, key) => {
    // Camel-case
    // Coerce string value into JS value
    const prop = key.replace(/^(debug_|log_)/i, '').toLowerCase().replace(/_([a-z])/g, (_, k) => k.toUpperCase());
    let val: any = process.env[key];
    // console.log(prop, val);
    if (prop === 'level') {
      val = val in LoggerLevel ? LoggerLevel[val] : LoggerLevel.DEBUG;
    } else if (/^(yes|on|true|enabled)$/i.test(val)) {
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
  }, {} as any) as LoggerOptions;

/**
 * Init logic for `debug` instances.
 *
 * Create a new `inspectOpts` object in case `useColors` is set
 * differently for a particular `debug` instance.
 */
Log.init = function init(debug: any) {
  debug.inspectOpts = { ...Log.inspectOpts };
};

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */
Log.load = function load(): string {
  return process.env.DEBUG;
};

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */
Log.save = function save(namespaces: string): void {
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
Log.useColors = function useColors() {
  return 'colors' in Log.inspectOpts
    ? Boolean(Log.inspectOpts.colors)
    : tty.isatty((process.stderr as any).fd);
};

/**
 * Is console instead of stdout/err used as output.
 */
Log.useConsole = function useConsole() {
  return 'useConsole' in Log.inspectOpts
    ? Boolean(Log.inspectOpts.useConsole)
    : true;
};

Log.alwaysDiff = function alwaysDiff() {
  return 'alwaysDiff' in Log.inspectOpts
    ? Boolean(Log.inspectOpts.alwaysDiff)
    : false;
};

/**
* Selects a color for a debug namespace
* @param {String} namespace The namespace string for the for the debug instance to be colored
* @return {Number|String} An ANSI color code for the given namespace
* @api private
*/
Log.selectColor = function selectColor(namespace: string): any {
  let hash = 0;
  for (let i = 0; i < namespace.length; i++) {
    hash = (hash << 5) - hash + namespace.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Log.colors[Math.abs(hash) % Log.colors.length];
};

/**
* Enables a debug mode by namespaces. This can include modes
* separated by a colon and wildcards.
*
* @param {String} namespaces
* @api public
*/
Log.enable = function enable(namespaces?: string) {
  // tslint:disable-next-line:no-parameter-reassignment
  namespaces = namespaces === undefined ? '*' : namespaces;
  Log.save(namespaces);
  Log.names = [];
  Log.skips = [];
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
      Log.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
    } else {
      Log.names.push(new RegExp('^' + namespaces + '$'));
    }
  }
  for (i = 0; i < Log.instances.length; i++) {
    const instance = Log.instances[i];
    instance.enabled = Log.enabled(instance.namespace);
  }
};

/**
* Disable debug output.
*
* @api public
*/
Log.disable = function disable(): void {
  Log.enable('');
};

/**
* Returns true if the given mode name is enabled, false otherwise.
*
* @param {String} name
* @return {Boolean}
* @api public
*/
Log.enabled = function enabled(name: string) {
  if (name[name.length - 1] === '*') return true;
  for (let i = 0; i < Log.skips.length; i++) {
    const item = Log.skips[i];
    if (item instanceof RegExp && item.test(name)) return false;
  }
  for (let i = 0; i < Log.names.length; i++) {
    const item = Log.names[i];
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
Log.coerce = function coerce(val: any) {
  if (val instanceof Error) {
    return val.stack || val.message;
  }
  return val;
};

Log.level = function level(): LoggerLevel {
  return ('level' in Log.inspectOpts)
    ? Log.inspectOpts.level
    : LoggerLevel.DEBUG;
};

Log.isBellow = function isBellow(ofLevel: LoggerLevel) {
  return ofLevel > Log.level();
};

Log.setLevel = function setLevel(toLevel: LoggerLevel | LoggerLevelType): void {
  if (toLevel == null || toLevel === undefined) {
    Log.inspectOpts.level = LoggerLevel.OFF;
  } else if (typeof toLevel === 'number' && String(toLevel) in LoggerLevel) {
    Log.inspectOpts.level = toLevel;
  } else if (typeof toLevel === 'string' && toLevel in LoggerLevel) {
    Log.inspectOpts.level = LoggerLevel[toLevel as any] as any;
  } else {
    Log.inspectOpts.level = LoggerLevel.INFO;
  }
};

Log.logIcon = '';
Log.emergIcon = '☠️';
Log.alertIcon = '🔥';
Log.criticalIcon = '⛔';
Log.errorIcon = '🔴';
Log.infoIcon = 'ℹ️';
Log.warnIcon = '⚠️';
Log.noticeIcon = '🔔';
Log.debugIcon = '🔷';
Log.traceIcon = '🔶';
Log.timeIcon = '⏳';
Log.endIcon = '⌛';

/**
 * Invokes `util.format()` with the specified arguments and writes to stderr.
 */
export function log(...args: any[]) {
  if (Log.isBellow(LoggerLevel.INFO)) return;
  Log.useConsole() ? console.log(...args) : process.stdout.write(util.format.call(util, ...args) + '\n');
}
log.level = 'INFO';
Log.log = log;

export function emerg(...args: any[]) {
  if (Log.isBellow(LoggerLevel.EMERG)) return;
  Log.useConsole() ? console.error(...args) : process.stderr.write(util.format.call(util, ...args) + '\n');
}
emerg.level = 'EMERG';
Log.emerg = emerg;

export function fatal(...args: any[]) {
  if (Log.isBellow(LoggerLevel.ALERT)) return;
  Log.useConsole() ? console.error(...args) : process.stderr.write(util.format.call(util, ...args) + '\n');
}
fatal.level = 'ALERT';
Log.fatal = fatal;

export function alert(...args: any[]) {
  if (Log.isBellow(LoggerLevel.ALERT)) return;
  Log.useConsole() ? console.error(...args) : process.stderr.write(util.format.call(util, ...args) + '\n');
}
alert.level = 'ALERT';
Log.alert = alert;

export function critical(...args: any[]) {
  if (Log.isBellow(LoggerLevel.CRITICAL)) return;
  Log.useConsole() ? console.error(...args) : process.stderr.write(util.format.call(util, ...args) + '\n');
}
critical.level = 'CRITICAL';
Log.critical = critical;

export function error(...args: any[]) {
  if (Log.isBellow(LoggerLevel.ERROR)) return;
  Log.useConsole() ? console.error(...args) : process.stderr.write(util.format.call(util, ...args) + '\n');
}
error.level = 'ERROR';
Log.error = error;

export function warn(...args: any[]) {
  if (Log.isBellow(LoggerLevel.WARNING)) return;
  Log.useConsole() ? console.warn(...args) : process.stdout.write(util.format.call(util, ...args) + '\n');
}
warn.level = 'WARN';
Log.warn = warn;

export function notice(...args: any[]) {
  if (Log.isBellow(LoggerLevel.NOTICE)) return;
  Log.useConsole() ? console.warn(...args) : process.stdout.write(util.format.call(util, ...args) + '\n');
}
notice.level = 'NOTICE';
Log.notice = notice;

export function info(...args: any[]) {
  if (Log.isBellow(LoggerLevel.INFO)) return;
  Log.useConsole() ? console.info(...args) : process.stdout.write(util.format.call(util, ...args) + '\n');
}
info.level = 'INFO';
Log.info = info;

export function debug(...args: any[]) {
  if (Log.isBellow(LoggerLevel.DEBUG)) return;
  Log.useConsole() ? console.debug(...args) : process.stdout.write(util.format.call(util, ...args) + '\n');
}
debug.level = 'DEBUG';
Log.debug = debug;

export function trace(...args: any[]) {
  if (Log.isBellow(LoggerLevel.TRACE)) return;
  Log.useConsole() ? console.debug(...args) : process.stdout.write(util.format.call(util, ...args) + '\n');
}
trace.level = 'TRACE';
Log.trace = trace;

export function time(...args: any[]): any {
  if (Log.isBellow(LoggerLevel.TIME)) return;
  Log.useConsole() ? console.info(...args) : process.stdout.write(util.format.call(util, ...args) + '\n');
}
time.level = 'TIME';
Log.time = time;

export function end(...args: any[]): any {
  if (Log.isBellow(LoggerLevel.TIME)) return;
  Log.useConsole() ? console.info(...args) : process.stdout.write(util.format.call(util, ...args) + '\n');
}
end.level = 'END';
Log.end = end;

export function timeEnd(...args: any[]): any {
  if (Log.isBellow(LoggerLevel.TIME)) return;
  Log.useConsole() ? console.info(...args) : process.stdout.write(util.format.call(util, ...args) + '\n');
}
timeEnd.level = 'END';
Log.timeEnd = timeEnd;

Log.millis = function millis(span: [number, number], offset?: number): string {
  const ms = (span[0] * 1000) + Math.floor(span[1] / 1000000) - (offset || 0);
  const ns = Math.floor((span[1] % 1000000) / 1000) / 1000;
  return `${ms}${ns.toFixed(3).substring(1)}`;
};

Log.enable(Log.load());

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
  if (Log.inspectOpts.hideDate) return '';
  return new Date().toISOString() + ' ';
}

function destroy(this: any) {
  const index = Log.instances.indexOf(this);
  if (index !== -1) {
    Log.instances.splice(index, 1);
    return true;
  }
  return false;
}

function extend(this: any, namespace: string, delimiter: string) {
  return Log(this.namespace + (typeof delimiter === 'undefined' ? ':' : delimiter) + namespace);
}

export default Log;
