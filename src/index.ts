import * as lo from 'lodash';
import * as utils from './utils';
// tslint:disable-next-line:variable-name
export const Utils = { ...lo, ...utils };

export { Formatters, Log as debug, Log, Logger as IDebugger, Logger, LoggerLevel, LoggerLevelType } from './logger';
export * from './process';
export * from './timer';
