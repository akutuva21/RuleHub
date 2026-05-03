const fs = require('fs');
const path = require('path');
const { parseMetadataYaml } = require('./utils');

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

function loadGalleryCategories(root) {
  const categoriesFile = path.join(root, 'gallery-categories.yaml');
  if (!fs.existsSync(categoriesFile)) {
    console.warn('Warning: gallery-categories.yaml not found, using defaults');
    return { categories: [] };
  }

  const content = fs.readFileSync(categoriesFile, 'utf8');
  return parseYamlSimple(content);
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

function extractModelId(metadataFile, metadata) {
  const modelDir = path.dirname(metadataFile);
  const bnglFiles = fs.readdirSync(modelDir, { withFileTypes: true })
    .filter(e => e.isFile() && e.name.endsWith('.bngl'))
    .map(e => e.name);

  const isCollection = Boolean(metadata.collection);

  if (isCollection) {
    return metadata.id;
  }

  if (bnglFiles.length >= 1) {
    return metadata.id || path.basename(bnglFiles[0], '.bngl');
  }

  return null;
}

async function main() {
  const { root, output } = parseArgs(process.argv.slice(2));

  console.log('Loading gallery categories...');
  const galleryConfig = loadGalleryCategories(root);
  const categoryIds = new Set(galleryConfig.categories.map(c => c.id));

  console.log('Scanning for metadata files...');
  const metadataFiles = SEARCH_ROOTS.flatMap(searchRoot => 
    listMetadataFiles(path.join(root, searchRoot))
  );

  const assignments = {};
  const sortOverrides = {};
  const publishedModelIds = new Set();

  for (const metadataFile of metadataFiles) {
    try {
      const content = fs.readFileSync(metadataFile, 'utf8');
      const metadata = parseMetadataYaml(content);

      const modelId = extractModelId(metadataFile, metadata);
      if (!modelId) continue;

      const tags = Array.isArray(metadata.tags) ? metadata.tags : [];
      if (tags.includes('published') || metadata.source?.origin === 'published') {
        publishedModelIds.add(modelId);
      }

      const galleryCategories = metadata.playground?.gallery_categories 
        || (metadata.playground?.gallery_category 
            ? [metadata.playground.gallery_category] 
            : []);
      if (galleryCategories.length > 0) {
        const validCategories = galleryCategories.filter(cat => categoryIds.has(cat));
        if (validCategories.length > 0) {
          assignments[modelId] = validCategories;
        }
      }

      const sortPriority = metadata.playground?.sort_priority;
      if (sortPriority !== undefined && sortPriority !== null) {
        sortOverrides[modelId] = sortPriority;
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

  let existingGenerated = null;
  if (fs.existsSync(output)) {
    try {
      const existing = JSON.parse(fs.readFileSync(output, 'utf8'));
      existingGenerated = existing.generated || null;
    } catch (e) {}
  }

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
  parseArgs,
  loadGalleryCategories,
  extractModelId,
};