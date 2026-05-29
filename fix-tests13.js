const fs = require('fs');
let content = fs.readFileSync('scripts/backfill-metadata.js', 'utf8');

const regex2 = /const doiMatch = comment\.match\(\/\(\?:doi\|DOI\)\[:\\s\]\+\(10\\\.\[\\S\]\+\)\/i\);\n    if \(doiMatch\) {\n      metadata\.doi = doiMatch\[1\]\.trim\(\);\n    }/g;

const replacement2 = `const doiMatch = comment.match(/(?:doi|DOI)[:\\s]+(10\\.\\S+)/i);
    if (doiMatch) {
      metadata.doi = doiMatch[1].trim();
      continue;
    }`;

content = content.replace(regex2, replacement2);

// Now change the way we handle nonParamComments
// Actually, earlier the code was:
// const nonParamComments = headerComments.filter(c => ... )
// But since we just added 'continue;' in the name/doi match, those lines are still in headerComments, but if they matched they didn't continue out of the loop for nonParamComments! Wait, they ARE still in headerComments.
// Ah! The issue is that headerComments is an array, we're iterating over it, but the filter is done on the WHOLE array afterwards.
// The loop only sets metadata.name and metadata.doi. Then the nonParamComments filter is applied to the original headerComments array!
