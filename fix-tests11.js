const fs = require('fs');
let content = fs.readFileSync('scripts/backfill-metadata.test.js', 'utf8');
content = content.replace(/assert\.strictEqual\(metadata\.description, 'model: Full Model'\);/g, "assert.strictEqual(metadata.description, 'A description of the full model');");
fs.writeFileSync('scripts/backfill-metadata.test.js', content);
