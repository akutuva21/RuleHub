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

function parseScalar(rawValue) {
  const value = rawValue.trim();
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (/^-?\d+$/.test(value)) return Number(value);
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((entry) => entry.trim().replace(/^"|"$/g, ''));
  }
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  return value;
}

function setNested(target, dottedPath, value) {
  const parts = dottedPath.split('.');
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

function parseMetadataYaml(content) {
  const result = {};
  const stack = [];

  for (const rawLine of content.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const indent = rawLine.match(/^\s*/)[0].length;

    if (trimmed.startsWith('- ')) {
      const currentPath = stack.map((entry) => entry.key).join('.');
      const listValue = parseScalar(trimmed.slice(2));
      if (currentPath === 'tags') {
        result.tags = Array.isArray(result.tags) ? result.tags : [];
        result.tags.push(String(listValue));
      }
      continue;
    }

    while (stack.length > 0 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const separator = trimmed.indexOf(':');
    if (separator < 0) continue;

    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1);
    const dottedPath = [...stack.map((entry) => entry.key), key].join('.');

    if (!rawValue.trim()) {
      stack.push({ key, indent });
      if (dottedPath === 'tags') {
        result.tags = Array.isArray(result.tags) ? result.tags : [];
      }
      continue;
    }

    setNested(result, dottedPath, parseScalar(rawValue));
  }

  return result;
}

module.exports = {
  listModelFiles,
  listModelFilesAsync,
  parseScalar,
  setNested,
  parseMetadataYaml,
};
