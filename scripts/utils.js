const fs = require('fs');

function listModelFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.bngl'))
    .map((entry) => entry.name)
    .sort();
}

async function listModelFilesAsync(dir) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.bngl'))
    .map((entry) => entry.name)
    .sort();
}

module.exports = {
  listModelFiles,
  listModelFilesAsync
};
