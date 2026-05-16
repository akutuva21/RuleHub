const fs = require('fs');
const path = require('path');
const { listModelFiles, parseScalar, parseMetadataYaml, setNested } = require('./utils');

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
  if (!value) return '';
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
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

async function validateMetadataFile(metadataFile, errors) {
  const metadata = parseMetadataYaml(await fs.promises.readFile(metadataFile, 'utf8'));
  const modelDir = path.dirname(metadataFile);
  const modelFiles = listModelFiles(modelDir);
  const readmePath = path.join(modelDir, 'README.md');

  if (!fs.existsSync(readmePath) && !modelDir.includes('bnf1')) {
    // Only warn about missing README for non-generated subdirectories
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
    if (metadata.compatibility.simulation_methods && !Array.isArray(metadata.compatibility.simulation_methods)) {
      errors.push(`${metadataFile}: invalid compatibility.simulation_methods (must be an array)`);
    }
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
    if (metadata.source.original_repository && typeof metadata.source.original_repository !== 'string') {
      errors.push(`${metadataFile}: invalid source.original_repository`);
    }
  }

  if (!metadata.playground || typeof metadata.playground !== 'object') {
    errors.push(`${metadataFile}: missing playground section`);
  } else {
    expectBoolean(errors, metadata.playground.visible, 'playground.visible', metadataFile);
    if (metadata.playground.gallery_categories && !Array.isArray(metadata.playground.gallery_categories)) {
      errors.push(`${metadataFile}: invalid playground.gallery_categories (must be an array)`);
    }
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
  }
}

async function main() {
  const root = path.resolve(__dirname, '..');
  const metadataFiles = SEARCH_ROOTS.flatMap((searchRoot) => listMetadataFiles(path.join(root, searchRoot)));
  const errors = [];

  await Promise.all(metadataFiles.map((metadataFile) => validateMetadataFile(metadataFile, errors)));

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
  expectString,
};
