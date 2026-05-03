const fs = require('fs');
const path = require('path');
const { listModelFiles, listModelFilesAsync, parseScalar, parseMetadataYaml } = require('./utils');

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

async function main() {
  const { root, output } = parseArgs(process.argv.slice(2));
  const metadataFiles = SEARCH_ROOTS.flatMap(searchRoot => listMetadataFiles(path.join(root, searchRoot)));

  const entryPromises = metadataFiles.map(async (metadataFile) => {
    const content = await fs.promises.readFile(metadataFile, 'utf8');
    const metadata = parseMetadataYaml(content);
    const modelFiles = await listModelFilesAsync(path.dirname(metadataFile));

    if (modelFiles.length === 0) return [];

    const isCollection = modelFiles.length > 1 || Boolean(metadata.collection);
    return modelFiles.map(modelFile =>
      buildEntry(root, metadata, metadataFile, modelFile, isCollection)
    );
  });

  const manifestEntries = (await Promise.all(entryPromises)).flat();

  manifestEntries.sort((left, right) => left.id.localeCompare(right.id));
  await fs.promises.writeFile(output, JSON.stringify(manifestEntries, null, 2));
  console.log(`Generated ${manifestEntries.length} manifest entries at ${output}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  buildEntry,
  parseMetadataYaml,
};
