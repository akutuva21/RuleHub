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

function setNested(target, parts, value) {
  const blockedKeys = new Set(['__proto__', 'constructor', 'prototype']);
  if (parts.some((part) => blockedKeys.has(part))) return;

  let cursor = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    if (!cursor[part] || typeof cursor[part] !== 'object' || Array.isArray(cursor[part])) {
      cursor[part] = {};
    }
    cursor = cursor[part];
  }
  cursor[parts[parts.length - 1]] = value;
}

module.exports = {
  listModelFiles,
  listModelFilesAsync,
  setNested
};
