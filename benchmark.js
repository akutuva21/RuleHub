const fs = require('fs');
const { parseBngl } = require('./scripts/backfill-metadata.js');

// Create a large fake bngl file for testing
const fakeLines = [];
fakeLines.push('begin model');
for (let i = 0; i < 50000; i++) {
  fakeLines.push(`molecule${i} 0`);
}
fakeLines.push('end model');

fs.writeFileSync('benchmark.bngl', fakeLines.join('\n'));

console.time('parseBngl');
parseBngl('benchmark.bngl');
console.timeEnd('parseBngl');

fs.unlinkSync('benchmark.bngl');
