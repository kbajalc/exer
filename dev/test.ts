import { Debug } from '../src';

Debug.inspectOpts.colors = true;
Debug.inspectOpts.hideDate = false;
Debug.inspectOpts.alwaysDiff = true;

const g = Debug('test');

g('Hello world...');
g.time('test');
g.info('Info');
g.error('Error');
g.debug('Debug');
g.trace('Here');
g.fatal('Fatal');
g.end('test');
