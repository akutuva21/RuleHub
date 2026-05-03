const fs = require('fs');
let content = fs.readFileSync('scripts/generate-manifest.test.js', 'utf8');

// fix imports
content = content.replace(/<<<<<<< Updated upstream\nconst { buildEntry, parseMetadataYaml } = require\('\.\/generate-manifest\.js'\);\n=======\nconst { buildEntry, parseArgs } = require\('\.\/generate-manifest\.js'\);\n>>>>>>> Stashed changes/, "const { buildEntry, parseMetadataYaml, parseArgs } = require('./generate-manifest.js');");

// fix test sections
content = content.replace(/<<<<<<< Updated upstream/g, "");
content = content.replace(/=======/g, "");
content = content.replace(/>>>>>>> Stashed changes/g, "");

fs.writeFileSync('scripts/generate-manifest.test.js', content);
