const fs = require('fs');

function listModelFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.bngl'))
    .map((entry) => entry.name)
    .sort();
}

module.exports = {
  listModelFiles
};
