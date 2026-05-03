const fs = require('fs');
const path = require('path');
const { listModelFilesAsync, parseMetadataYaml } = require('./utils');

const SEARCH_ROOTS = ['Published', 'Examples', 'Tutorials'];
const DEFAULT_IGNORE_DIRS = ['fitting', 'BioNetFit_files', 'output_*', 'fit_*', '__pycache__', 'pybnf_files'];

function parseArgs(argv) {
  let root = path.resolve(__dirname, '..');
  let output = '';
  let slim = false;

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
      continue;
    }
    if (arg === '--slim') {
      slim = true;
    }
  }

  if (!output) {
    output = slim 
      ? path.join(root, 'manifest-slim.json')
      : path.join(root, 'manifest.json');
  }

  return { root, output, slim };
}

function listMetadataFiles(dir, results = []) {
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
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

function getIgnoreDirs(metadata) {
  const auxDirs = metadata?.source?.aux_dirs;
  if (auxDirs && Array.isArray(auxDirs)) {
    return [...DEFAULT_IGNORE_DIRS, ...auxDirs];
  }
  return DEFAULT_IGNORE_DIRS;
}

function isIgnoredDir(dirName, ignoreDirs) {
  return ignoreDirs.some(ignored => {
    if (ignored.includes('*')) {
      return dirName.startsWith(ignored.replace('*', ''));
    }
    return dirName === ignored;
  });
}

async function listModelFilesFiltered(dir, metadata) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  
  return entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.bngl'))
    .map(entry => entry.name)
    .sort();
}

function buildEntry(root, metadata, metadataFile, modelFile, isCollection, slim, modelFiles) {
  const modelDir = path.dirname(metadataFile);
  const relativeModelPath = path.relative(root, path.join(modelDir, modelFile)).replace(/\\/g, '/');
  const id = isCollection 
    ? metadata.id || path.basename(modelFile, '.bngl')
    : (metadata.id && modelFiles.length === 1) 
      ? metadata.id 
      : path.basename(modelFile, '.bngl');

  const compatibility = {
    bng2: metadata.compatibility?.bng2_compatible ?? false,
    nfsim: metadata.compatibility?.nfsim_compatible ?? false,
    excluded: metadata.compatibility?.excluded ?? false,
    methods: metadata.compatibility?.simulation_methods || [],
  };

  const gallery = metadata.playground?.gallery_categories 
    || (metadata.playground?.gallery_category 
        ? [metadata.playground.gallery_category] 
        : []);

  const baseEntry = {
    id,
    name: isCollection ? metadata.name : (metadata.name || id),
    description: metadata.description || '',
    tags: Array.isArray(metadata.tags) ? metadata.tags : [],
    category: metadata.category || 'other',
    origin: metadata.source?.origin || 'other',
    visible: metadata.playground?.visible ?? false,
    compatibility,
    gallery,
  };

  if (!slim) {
    baseEntry.path = relativeModelPath;
    baseEntry.file = modelFile;
  }

  if (isCollection) {
    baseEntry.collectionId = metadata.id || null;
    
    if (!slim && metadata.collection) {
      const modelFiles = fs.readdirSync(modelDir, { withFileTypes: true })
        .filter(e => e.isFile() && e.name.endsWith('.bngl'))
        .map(e => e.name)
        .sort();

      const variants = modelFiles.map(file => ({
        id: path.basename(file, '.bngl'),
        file: file,
      }));

      baseEntry.collection = {
        type: metadata.collection.type || 'parameter-fit-variants',
        count: metadata.collection.count || variants.length,
        variant_key: metadata.collection.variant_key || 'variant',
        variants: variants,
      };
    }
  } else {
    baseEntry.collectionId = null;
  }

  if (!slim) {
    if (metadata.playground?.featured !== undefined) {
      baseEntry.featured = metadata.playground.featured;
    }
    if (metadata.playground?.difficulty) {
      baseEntry.difficulty = metadata.playground.difficulty;
    }
    if (metadata.citation?.doi) {
      baseEntry.citation = { doi: metadata.citation.doi };
    }
  }

  return baseEntry;
}

function isCollectionEntry(metadata, modelFiles) {
  return Boolean(metadata.collection);
}

async function main() {
  const { root, output, slim } = parseArgs(process.argv.slice(2));
  const metadataFiles = SEARCH_ROOTS.flatMap(searchRoot => listMetadataFiles(path.join(root, searchRoot)));

  const entryPromises = metadataFiles.map(async (metadataFile) => {
    const content = await fs.promises.readFile(metadataFile, 'utf8');
    const metadata = parseMetadataYaml(content);
    const modelFiles = await listModelFilesFiltered(path.dirname(metadataFile), metadata);

    if (modelFiles.length === 0) return [];

    const isCollection = isCollectionEntry(metadata, modelFiles);

    if (isCollection) {
      return [buildEntry(root, metadata, metadataFile, modelFiles[0], true, slim, modelFiles)];
    }

    return modelFiles.map(modelFile =>
      buildEntry(root, metadata, metadataFile, modelFile, false, slim, modelFiles)
    );
  });

  const manifestEntries = (await Promise.all(entryPromises)).flat();

  manifestEntries.sort((left, right) => left.id.localeCompare(right.id));
  await fs.promises.writeFile(output, JSON.stringify(manifestEntries, null, 2));
  console.log(`Generated ${manifestEntries.length} manifest entries at ${output}${slim ? ' (slim)' : ''}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  parseArgs,
  buildEntry,
  listMetadataFiles,
  isCollectionEntry,
};