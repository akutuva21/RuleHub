const fs = require('fs');

let content = fs.readFileSync('scripts/backfill-metadata.js', 'utf8');

const regex = /const nameMatch = comment.match\(\/\(\?:model\|name\)\[:\\s\]\+\(\.\+\)\/i\);\n    if \(nameMatch && !metadata\.name\) {\n      metadata\.name = nameMatch\[1\]\.trim\(\);\n    }/g;

const replacement = `const nameMatch = comment.match(/(?:model|name)[:\\s]+(.+)/i);
    if (nameMatch && !metadata.name) {
      metadata.name = nameMatch[1].trim();
      continue;
    }`;

content = content.replace(regex, replacement);

const regex2 = /const doiMatch = comment\.match\(\/\(\?:doi\|DOI\)\[:\\s\]\+\(10\\\.\[\\S\]\+\)\/i\);\n    if \(doiMatch\) {\n      metadata\.doi = doiMatch\[1\]\.trim\(\);\n    }/g;

const replacement2 = `const doiMatch = comment.match(/(?:doi|DOI)[:\\s]+(10\\.\\S+)/i);
    if (doiMatch) {
      metadata.doi = doiMatch[1].trim();
      continue;
    }`;

content = content.replace(regex2, replacement2);

fs.writeFileSync('scripts/backfill-metadata.js', content);
