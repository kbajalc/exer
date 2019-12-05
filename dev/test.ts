import { Log } from '../src';

Log.inspectOpts.colors = true;
// Debug.inspectOpts.hideDate = true;
// Debug.inspectOpts.systemd = true;
// Debug.inspectOpts.alwaysDiff = true;

Log.setLevel('ALL');
const log = Log.get('test');

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
log.timeEnd('test');

log.info('Json: %j', process.env);
