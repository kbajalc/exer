import uuidr = require('uuid');

export function uuid() {
  return uuidr();
}

export function password() {
  let u = uuid() + uuid();
  u = u.split('-').join('');
  let b = new Buffer(u, 'hex').toString('base64');
  b = b.split('+').join('').split('/').join('');
  const p = b.substr(0, 4) + '-' + b.substr(4, 4) + '-' + b.substr(8, 4) + '-' + b.substr(12, 4);
  return p;
}
