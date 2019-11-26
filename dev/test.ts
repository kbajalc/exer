import { Debug } from '../src';

Debug.inspectOpts.colors = false;
Debug.inspectOpts.hideDate = true;
Debug.inspectOpts.systemd = true;
Debug.inspectOpts.alwaysDiff = true;

Debug.setLevel('ALL');
const log = Debug('test');

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
log.trace('Here');

log.time('test');
log.timeEnd('test');

log.error('Prefix', new Error('Test'));
