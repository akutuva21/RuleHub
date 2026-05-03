const fs = require('fs');
const path = require('path');
const { listModelFiles, listModelFilesAsync, setNested } = require('./utils');

const SEARCH_ROOTS = ['Published', 'Examples', 'Tutorials'];

function parseArgs(argv) {
  let root = path.resolve(__dirname, '..');
  let output = '';

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--root' && argv[index + 1]) {
      root = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--output' && argv[index + 1]) {
      output = path.resolve(argv[index + 1]);
      index += 1;
    }
  }

  return {
    root,
    output: output || path.join(root, 'manifest.json'),
  };
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
    return inner.split(',').map(entry => entry.trim().replace(/^"|"$/g, ''));
  }
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  return value;
}

function parseMetadataYaml(content) {
  const result = {};
  const stack = [];

  for (const rawLine of content.split(/\r?\n/)) {
    if (!rawLine.trim() || rawLine.trim().startsWith('#')) continue;

    const indent = rawLine.match(/^\s*/)[0].length;
    const trimmed = rawLine.trim();

    if (trimmed.startsWith('- ')) {
      const currentPath = stack.map(entry => entry.key).join('.');
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
    const pathParts = [...stack.map(entry => entry.key), key];
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
      continue;
    }
    if (entry.isFile() && entry.name === 'metadata.yaml') {
      results.push(fullPath);
    }
  }

  return results;
}

function buildEntry(root, metadata, metadataFile, modelFile, isCollection) {
  const modelDir = path.dirname(metadataFile);
  const relativeModelPath = path.relative(root, path.join(modelDir, modelFile)).replace(/\\/g, '/');
  const id = isCollection ? path.basename(modelFile, '.bngl') : metadata.id || path.basename(modelFile, '.bngl');

  return {
    id,
    name: isCollection ? `${metadata.name} - ${path.basename(modelFile, '.bngl')}` : metadata.name || id,
    description: metadata.description || '',
    path: relativeModelPath,
    file: modelFile,
    tags: Array.isArray(metadata.tags) ? metadata.tags : [],
    category: metadata.category || 'other',
    bng2_compatible: metadata.compatibility?.bng2_compatible ?? false,
    origin: metadata.source?.origin || 'other',
    visible: metadata.playground?.visible ?? false,
    collectionId: isCollection ? metadata.id || null : null,
  };
}

function main() {
  const { root, output } = parseArgs(process.argv.slice(2));
  const metadataFiles = SEARCH_ROOTS.flatMap(searchRoot => listMetadataFiles(path.join(root, searchRoot)));
  const manifestEntries = [];

  for (const metadataFile of metadataFiles) {
    const metadata = parseMetadataYaml(fs.readFileSync(metadataFile, 'utf8'));
    const modelFiles = listModelFiles(path.dirname(metadataFile));
    if (modelFiles.length === 0) continue;

    const isCollection = modelFiles.length > 1 || Boolean(metadata.collection);
    for (const modelFile of modelFiles) {
      manifestEntries.push(buildEntry(root, metadata, metadataFile, modelFile, isCollection));
    }
  }

  manifestEntries.sort((left, right) => left.id.localeCompare(right.id));
  fs.writeFileSync(output, JSON.stringify(manifestEntries, null, 2));
  console.log(`Generated ${manifestEntries.length} manifest entries at ${output}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  buildEntry,
  parseMetadataYaml,
};
