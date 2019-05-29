import { Debug } from '../src';

Debug.inspectOpts.colors = false;
Debug.inspectOpts.hideDate = true;
Debug.inspectOpts.alwaysDiff = true;

Debug.setLevel('WARN');
const log = Debug('test');

log('Hello world...');
log.time('test');
log.info('Info');
log.warn('Warn');
log.error('Error');
log.debug('Debug');
log.trace('Here');
log.fatal('Fatal');
log.end('test');
