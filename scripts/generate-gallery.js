const fs = require('fs');
const path = require('path');
const { parseMetadataYaml , safeJoin} = require('./utils');

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

  if (!output) {
    output = path.join(root, 'gallery.json');
  }

  return { root, output };
}

async function listMetadataFiles(dir) {
  let entries;
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }

  const results = await Promise.all(entries.map(async (entry) => {
    const fullPath = safeJoin(dir, entry.name);
    if (entry.isDirectory()) {
      return listMetadataFiles(fullPath);
    } else if (entry.isFile() && entry.name === 'metadata.yaml') {
      return [fullPath];
    }
    return [];
  }));

  return results.flat();
}

async function loadGalleryCategories(root) {
  const categoriesFile = path.join(root, 'gallery-categories.yaml');
  try {
    const content = await fs.promises.readFile(categoriesFile, 'utf8');
    return parseYamlSimple(content);
  } catch (err) {
    console.warn('Warning: gallery-categories.yaml not found, using defaults');
    return { categories: [] };
  }
}

function parseYamlSimple(content) {
  const result = { categories: [] };
  const lines = content.split('\n');
  
  let inCategories = false;
  let currentCategory = null;

  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed === 'categories:') {
      inCategories = true;
      continue;
    }

    if (!inCategories) continue;

    if (trimmed.startsWith('- id:')) {
      if (currentCategory) {
        result.categories.push(currentCategory);
      }
      currentCategory = {
        id: trimmed.replace('- id:', '').trim(),
        name: '',
        description: '',
        sortOrder: 0,
      };
    }

    if (currentCategory) {
      if (trimmed.startsWith('name:')) {
        currentCategory.name = trimmed.replace('name:', '').trim().replace(/^["']|["']$/g, '');
      }
      if (trimmed.startsWith('description:')) {
        currentCategory.description = trimmed.replace('description:', '').trim().replace(/^["']|["']$/g, '');
      }
      if (trimmed.startsWith('sortOrder:')) {
        currentCategory.sortOrder = parseInt(trimmed.replace('sortOrder:', '').trim(), 10) || 0;
      }
    }
  }

  if (currentCategory) {
    result.categories.push(currentCategory);
  }

  return result;
}

async function extractModelIds(metadataFile, metadata) {
  const modelDir = path.dirname(metadataFile);
  let entries;
  try {
    entries = await fs.promises.readdir(modelDir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') {
      entries = [];
    } else {
      throw err;
    }
  }

  const bnglFiles = entries
    .filter(e => e.isFile() && e.name.endsWith('.bngl'))
    .map(e => e.name)
    .sort();

  const isCollection = Boolean(metadata.collection);

  if (isCollection) {
    return [metadata.id || (bnglFiles.length >= 1 ? path.basename(bnglFiles[0], '.bngl') : null)].filter(Boolean);
  }

  if (bnglFiles.length === 1) {
    return [metadata.id || path.basename(bnglFiles[0], '.bngl')].filter(Boolean);
  }

  if (bnglFiles.length > 1) {
    return bnglFiles.map(file => path.basename(file, '.bngl'));
  }

  return [];
}

function determineFallbackCategories(metadata, root, metadataFile) {
  const relPath = path.relative(root, metadataFile).replace(/\\/g, '/');
  if (metadata.source?.origin === 'test-case' || metadata.category === 'validation' || relPath.includes('tests/')) {
    return ['test-models'];
  } else if (metadata.source?.origin === 'tutorial' || relPath.startsWith('Tutorials/') || relPath.includes('/Tutorials/')) {
    if (relPath.startsWith('Tutorials/NativeTutorials/') || relPath.includes('/NativeTutorials/')) {
      return ['native-tutorials'];
    } else {
      return ['tutorials'];
    }
  } else if (metadata.source?.origin === 'published' || relPath.startsWith('Published/') || relPath.includes('/Published/')) {
    return ['published-models'];
  } else {
    return ['test-models'];
  }
}

async function main(argv = process.argv.slice(2)) {
  const { root, output } = parseArgs(argv);

  console.log('Loading gallery categories...');
  const galleryConfig = await loadGalleryCategories(root);
  const categoryIds = new Set(galleryConfig.categories.map(c => c.id));

  console.log('Scanning for metadata files...');
  const results = await Promise.all(
    SEARCH_ROOTS.map(searchRoot => listMetadataFiles(path.join(root, searchRoot)))
  );
  const metadataFiles = results.flat();

  const assignments = {};
  const sortOverrides = {};
  const publishedModelIds = new Set();

  for (const metadataFile of metadataFiles) {
    try {
      const content = await fs.promises.readFile(metadataFile, 'utf8');
      const metadata = parseMetadataYaml(content);

      const modelIds = await extractModelIds(metadataFile, metadata);
      if (modelIds.length === 0) continue;

      const tags = Array.isArray(metadata.tags) ? metadata.tags : [];
      if (tags.includes('published') || metadata.source?.origin === 'published') {
        for (const modelId of modelIds) {
          publishedModelIds.add(modelId);
        }
      }

      let galleryCategories = metadata.playground?.gallery_categories 
        || (metadata.playground?.gallery_category 
            ? [metadata.playground.gallery_category] 
            : []);
      
      // Filter out invalid categories first so they trigger the fallback logic
      galleryCategories = galleryCategories.filter(cat => categoryIds.has(cat));

      if (galleryCategories.length === 0) {
        galleryCategories = determineFallbackCategories(metadata, root, metadataFile);
      }

      if (galleryCategories.length > 0) {
        for (const modelId of modelIds) {
          assignments[modelId] = galleryCategories;
        }
      }

      const sortPriority = metadata.playground?.sort_priority;
      if (sortPriority !== undefined && sortPriority !== null) {
        for (const modelId of modelIds) {
          sortOverrides[modelId] = sortPriority;
        }
      }
    } catch (err) {
      console.warn(`Warning: Failed to process ${metadataFile}: ${err.message}`);
    }
  }

  for (const modelId of publishedModelIds) {
    if (assignments[modelId]) {
      if (!assignments[modelId].includes('published-models')) {
        assignments[modelId].push('published-models');
      }
    } else {
      assignments[modelId] = ['published-models'];
    }
  }

  const finalCategories = galleryConfig.categories.map(cat => ({
    id: cat.id,
    name: cat.name,
    description: cat.description,
    sortOrder: cat.sortOrder,
  }));

  const sortedAssignments = {};
  const sortedModelIds = Object.keys(assignments).sort();
  for (const modelId of sortedModelIds) {
    sortedAssignments[modelId] = assignments[modelId].slice().sort();
  }

  const outputBase = output.replace('.generated.json', '.json');
  let existingGenerated = null;
  try {
    const existing = JSON.parse(await fs.promises.readFile(outputBase, 'utf8'));
    existingGenerated = existing.generated || null;
  } catch (e) {}

  const gallery = {
    version: 1,
    generated: existingGenerated || new Date().toISOString(),
    categories: finalCategories,
    assignments: sortedAssignments,
    sortOverrides,
  };

  await fs.promises.writeFile(output, JSON.stringify(gallery, null, 2));
  console.log(`Generated gallery.json at ${output}`);
  console.log(`  Categories: ${finalCategories.length}`);
  console.log(`  Model assignments: ${Object.keys(assignments).length}`);
  console.log(`  Sort overrides: ${Object.keys(sortOverrides).length}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  main,
  parseArgs,
  loadGalleryCategories,
  extractModelIds,
  parseYamlSimple,
  determineFallbackCategories,
};