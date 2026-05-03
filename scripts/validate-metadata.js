const fs = require('fs');
const path = require('path');
const { listModelFiles, parseScalar, parseMetadataYaml } = require('./utils');

const SEARCH_ROOTS = ['Published', 'Examples', 'Tutorials'];
const CATEGORY_VALUES = new Set([
  'signaling',
  'regulation',
  'metabolism',
  'gene-expression',
  'epidemiology',
  'immunology',
  'tutorial',
  'validation',
  'showcase',
  'synthetic-biology',
  'ecology',
  'physics',
  'computer-science',
  'other',
  'compartments',
  'energy',
  'feature-demos',
  'nfsim',
  'processes',
  'wacky',
  'cs',
  'biology',
  'genetics',
  'ml',
  'signal-processing',
  'mechanistic-modeling',
  'biophysics',
]);
const ORIGIN_VALUES = new Set([
  'published',
  'contributed',
  'ai-generated',
  'ported-from-sbml',
  'tutorial',
  'test-case',
]);
const DIFFICULTY_VALUES = new Set(['beginner', 'intermediate', 'advanced']);
const COLLECTION_TYPE_VALUES = new Set([
  'parameter-fit-variants',
  'sensitivity-analysis',
  'geographic-variants',
  'patient-specific',
]);
const SIMULATION_METHOD_VALUES = new Set(['ode', 'ssa', 'nf']);

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
    if (!rawLine.trim() || rawLine.trim().startsWith('#')) continue;

    const indent = rawLine.match(/^\s*/)[0].length;
    const trimmed = rawLine.trim();

    if (trimmed.startsWith('- ')) {
      const currentPath = stack.length > 0 ? stack[stack.length - 1].path : '';
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
    const dottedPath = stack.length > 0 ? stack[stack.length - 1].path + '.' + key : key;

    if (!rawValue.trim()) {
      stack.push({ key, indent, path: dottedPath });
      if (dottedPath === 'tags') {
        result.tags = Array.isArray(result.tags) ? result.tags : [];
      }
      continue;
    }

    setNested(result, dottedPath, parseScalar(rawValue));
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

function normalizeModelKey(value) {
  return String(value || '')
    .replace(/\.bngl$/i, '')
    .replace(/[^a-z0-9]+/gi, '')
    .toLowerCase();
}

function expectString(errors, value, label, filePath) {
  if (typeof value !== 'string' || !value.trim()) {
    errors.push(`${filePath}: missing or invalid ${label}`);
  }
}

function expectBoolean(errors, value, label, filePath) {
  if (typeof value !== 'boolean') {
    errors.push(`${filePath}: missing or invalid ${label}`);
  }
}

function expectEnum(errors, value, allowed, label, filePath) {
  if (typeof value !== 'string' || !allowed.has(value)) {
    errors.push(`${filePath}: invalid ${label} (${JSON.stringify(value)})`);
  }
}

function expectArray(errors, value, label, filePath) {
  if (!Array.isArray(value)) {
    errors.push(`${filePath}: missing or invalid ${label}`);
  }
}

function validateMetadataFile(metadataFile, errors) {
  const metadata = parseMetadataYaml(fs.readFileSync(metadataFile, 'utf8'));
  const modelDir = path.dirname(metadataFile);
  const modelFiles = listModelFiles(modelDir);
  const readmePath = path.join(modelDir, 'README.md');

  if (!fs.existsSync(readmePath)) {
    errors.push(`${metadataFile}: missing README.md`);
  }
  if (modelFiles.length === 0) {
    errors.push(`${metadataFile}: no .bngl files found alongside metadata.yaml`);
  }

  expectString(errors, metadata.id, 'id', metadataFile);
  expectString(errors, metadata.name, 'name', metadataFile);
  expectString(errors, metadata.description, 'description', metadataFile);
  expectArray(errors, metadata.tags, 'tags', metadataFile);
  expectEnum(errors, metadata.category, CATEGORY_VALUES, 'category', metadataFile);

  if (!metadata.compatibility || typeof metadata.compatibility !== 'object') {
    errors.push(`${metadataFile}: missing compatibility section`);
  } else {
    expectBoolean(errors, metadata.compatibility.bng2_compatible, 'compatibility.bng2_compatible', metadataFile);
    expectBoolean(errors, metadata.compatibility.uses_compartments, 'compatibility.uses_compartments', metadataFile);
    expectBoolean(errors, metadata.compatibility.uses_energy, 'compatibility.uses_energy', metadataFile);
    expectBoolean(errors, metadata.compatibility.uses_functions, 'compatibility.uses_functions', metadataFile);
    expectBoolean(errors, metadata.compatibility.nfsim_compatible, 'compatibility.nfsim_compatible', metadataFile);
    expectArray(errors, metadata.compatibility.simulation_methods, 'compatibility.simulation_methods', metadataFile);
    if (Array.isArray(metadata.compatibility.simulation_methods)) {
      for (const method of metadata.compatibility.simulation_methods) {
        if (!SIMULATION_METHOD_VALUES.has(method)) {
          errors.push(`${metadataFile}: invalid simulation method ${JSON.stringify(method)}`);
        }
      }
    }
  }

  if (!metadata.source || typeof metadata.source !== 'object') {
    errors.push(`${metadataFile}: missing source section`);
  } else {
    expectEnum(errors, metadata.source.origin, ORIGIN_VALUES, 'source.origin', metadataFile);
    expectString(errors, metadata.source.original_repository, 'source.original_repository', metadataFile);
  }

  if (!metadata.playground || typeof metadata.playground !== 'object') {
    errors.push(`${metadataFile}: missing playground section`);
  } else {
    expectBoolean(errors, metadata.playground.visible, 'playground.visible', metadataFile);
    expectString(errors, metadata.playground.gallery_category, 'playground.gallery_category', metadataFile);
    expectBoolean(errors, metadata.playground.featured, 'playground.featured', metadataFile);
    expectEnum(errors, metadata.playground.difficulty, DIFFICULTY_VALUES, 'playground.difficulty', metadataFile);
  }

  if (metadata.collection) {
    expectEnum(errors, metadata.collection.type, COLLECTION_TYPE_VALUES, 'collection.type', metadataFile);
    expectString(errors, metadata.collection.parent_model, 'collection.parent_model', metadataFile);
    expectString(errors, metadata.collection.variant_key, 'collection.variant_key', metadataFile);
    if (!Number.isInteger(metadata.collection.count) || metadata.collection.count < 1) {
      errors.push(`${metadataFile}: invalid collection.count (${JSON.stringify(metadata.collection.count)})`);
    }
    if (Number.isInteger(metadata.collection.count) && metadata.collection.count !== modelFiles.length) {
      errors.push(`${metadataFile}: collection.count=${metadata.collection.count} but found ${modelFiles.length} model files`);
    }
  } else if (modelFiles.length > 1) {
    const primaryKeys = [
      metadata.id,
      metadata.source && metadata.source.source_path ? path.basename(metadata.source.source_path) : '',
      path.basename(modelDir),
    ].map(normalizeModelKey).filter(Boolean);
    const hasPrimaryModel = modelFiles.some((fileName) => primaryKeys.includes(normalizeModelKey(fileName)));
    if (!hasPrimaryModel) {
      errors.push(`${metadataFile}: multiple .bngl files require either a collection section or a primary model file matching the metadata id`);
    }
  }
}

function main() {
  const root = path.resolve(__dirname, '..');
  const metadataFiles = SEARCH_ROOTS.flatMap((searchRoot) => listMetadataFiles(path.join(root, searchRoot)));
  const errors = [];

  for (const metadataFile of metadataFiles) {
    validateMetadataFile(metadataFile, errors);
  }

  if (errors.length > 0) {
    console.error(`Metadata validation failed with ${errors.length} issue(s):`);
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(`Validated ${metadataFiles.length} metadata files.`);
}

if (require.main === module) {
  main();
}

module.exports = {
  parseScalar,
  setNested,
  validateMetadataFile,
  parseMetadataYaml,
  normalizeModelKey,
  listMetadataFiles,
  setNested,
};
