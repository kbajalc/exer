import 'reflect-metadata';
import js = require('./js');
import rand = require('./rand');
import text = require('./text');
import time = require('./time');
import file = require('./file');
import misc = require('./misc');

// tslint:disable-next-line:variable-name
export const Utils = {
  ...js,
  ...rand,
  ...text,
  ...time,
  ...file,
  ...misc
};
