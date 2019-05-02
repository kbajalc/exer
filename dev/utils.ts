import * as Lo from 'lodash';
import * as Utils from '../src/utils';

const combo = { ...Lo, ...Utils };

const override = Object.keys(Lo).filter(k => (Lo as any)[k] !== (combo as any)[k]);
console.log(override);

console.log(Utils.titleCase('test meNow-dsws'));
console.log(Lo.kebabCase('kdas kei Rjf '));
