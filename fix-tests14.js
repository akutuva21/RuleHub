const fs = require('fs');
let content = fs.readFileSync('scripts/backfill-metadata.js', 'utf8');

const regex3 = /  const nonParamComments = headerComments\.filter\(c =>\n    !c\.match\(\/\^\[a-zA-Z_\]\\w\*\\s\+changed\\s\+to\/i\)\n  \);\n  if \(nonParamComments\.length > 0 && !metadata\.description\) {\n    metadata\.description = nonParamComments\[0\];\n  }/g;

const replacement3 = `  const nonParamComments = headerComments.filter(c =>
    !c.match(/^[a-zA-Z_]\\w*\\s+changed\\s+to/i) &&
    !c.match(/(?:model|name)[:\\s]+(.+)/i) &&
    !c.match(/(?:doi|DOI)[:\\s]+(10\\.\\S+)/i)
  );
  if (nonParamComments.length > 0 && !metadata.description) {
    metadata.description = nonParamComments[0];
  }`;

content = content.replace(regex3, replacement3);
fs.writeFileSync('scripts/backfill-metadata.js', content);
