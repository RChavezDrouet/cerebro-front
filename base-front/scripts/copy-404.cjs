const fs = require('fs');
const path = require('path');

const source = path.resolve(__dirname, '../dist/index.html');
const target = path.resolve(__dirname, '../dist/404.html');

if (!fs.existsSync(source)) {
  throw new Error(`Missing build artifact: ${source}`);
}

fs.copyFileSync(source, target);
