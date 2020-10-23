import assert = require('assert');
import { Log } from '../src';

Log.inspectOpts.colors = false;
Log.inspectOpts.hideDate = true;
Log.inspectOpts.hideLevel = true;
// Debug.inspectOpts.systemd = true;
// Debug.inspectOpts.alwaysDiff = true;

Log.setLevel('ALL');
const log = Log.get('test');
const log2 = Log.get('test');

assert(log === log2);

log('Hello world...');

log.emerg('Emerg');
log.alert('Alert');
log.fatal('Fatal');
log.critical('Critical');
log.error('Error');
log.warn('Warn');
log.notice('Notice');
log.info('Info');
log.debug('Debug');
log.error('Prefix', new Error('Test'));

log.trace('Here');
log.time('test');
const res = log.timeEnd('test');
assert(res);

log.info('Json: %j', process.env);
