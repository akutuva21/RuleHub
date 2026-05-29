const fs = require('fs');

let content = fs.readFileSync('scripts/backfill-metadata.test.js', 'utf8');

content = content.replace(/assert\.strictEqual\(result\.description, 'name: Test Model'\); \/\/ because the parser sets description to the first comment/g, "assert.strictEqual(result.description, 'This is a description of the model.'); // because the parser sets description to the first non-assignment comment");

fs.writeFileSync('scripts/backfill-metadata.test.js', content);
