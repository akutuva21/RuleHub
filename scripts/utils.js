const fs = require('fs');
const path = require('path');

function listModelFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
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

function setNested(target, parts, value) {
  const pathParts = Array.isArray(parts) ? parts : parts.split('.');
  const blockedKeys = new Set(['__proto__', 'constructor', 'prototype']);
  if (pathParts.some((part) => blockedKeys.has(part))) return;

  let cursor = target;
  for (let index = 0; index < pathParts.length - 1; index += 1) {
    const part = pathParts[index];
    if (!cursor[part] || typeof cursor[part] !== 'object' || Array.isArray(cursor[part])) {
      cursor[part] = {};
    }
    cursor = cursor[part];
  }
  cursor[pathParts[pathParts.length - 1]] = value;
}

function parseMetadataYaml(content) {
  const result = {};
  const stack = [];

  for (const rawLine of content.split(/\r?\n/)) {
    if (!rawLine.trim() || rawLine.trim().startsWith('#')) continue;

    const indent = rawLine.match(/^\s*/)[0].length;
    const trimmed = rawLine.trim();

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
    const pathParts = [...stack.map((entry) => entry.key), key];
    const dottedPath = pathParts.join('.');

    if (!rawValue.trim()) {
      stack.push({ key, indent });
      if (dottedPath === 'tags') {
        result.tags = Array.isArray(result.tags) ? result.tags : [];
      }
      continue;
    }

    setNested(result, pathParts, parseScalar(rawValue));
  }

  return result;
}

function listMetadataFiles(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listMetadataFiles(fullPath, results);
    } else if (entry.isFile() && entry.name === 'metadata.yaml') {
      results.push(fullPath);
    }
  }
  return results;
}

module.exports = {
  listModelFiles,
  parseScalar,
  setNested,
  parseMetadataYaml,
  listMetadataFiles
};
