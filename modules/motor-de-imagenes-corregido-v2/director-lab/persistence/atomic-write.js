'use strict';

const fs = require('fs');

function atomicWriteFileSync(target, contents, encoding = 'utf8') {
  const temp = `${target}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temp, contents, encoding);
  fs.renameSync(temp, target);
}

module.exports = { atomicWriteFileSync };
