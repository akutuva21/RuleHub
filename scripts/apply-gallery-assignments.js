const fs = require('fs');
const { safeJoin } = require('./utils');
const path = require('path');

const GALLERY_CATEGORIES_MATCH = /gallery_categories:\s*(\[\]|["\'][^"\']*["\'])/;
const GALLERY_CATEGORIES_EMPTY = /gallery_categories:\s*\[\]/;
const GALLERY_CATEGORY_MATCH = /gallery_category:\s*["']([^"\']+)["\']/;
const GALLERY_CATEGORY_REPLACE = /gallery_category:\s*["'][^"\']+["\']/;
const PLAYGROUND_MATCH = /playground:\s*$/m;
const BNG2_COMPATIBLE_MATCH = /bng2_compatible:\s*(true|false)/;
const BNG2_COMPATIBLE_REPLACE = /bng2_compatible:\s*false/;
const NFSIM_COMPATIBLE_MATCH = /nfsim_compatible:\s*(true|false)/;
const NFSIM_COMPATIBLE_REPLACE = /nfsim_compatible:\s*false/;
const EXCLUDED_MATCH = /excluded:\s*(true|false)/;
const EXCLUDED_REPLACE = /excluded:\s*false/;

function parseArgs(argv) {
  let input = 'gallery-assignments.json';
  let root = path.resolve(__dirname, '..');
  let dryRun = false;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--input' && argv[i + 1]) {
      input = argv[i + 1];
      i++;
    } else if (argv[i] === '--root' && argv[i + 1]) {
      root = argv[i + 1];
      i++;
    } else if (argv[i] === '--dry-run') {
      dryRun = true;
    }
  }

  return { input, root, dryRun };
}

async function findAllMetadataFiles(dir, results = []) {
  let entries;
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return results;
    throw err;
  }
  await Promise.all(entries.map(async (entry) => {
    const fullPath = safeJoin(dir, entry.name);
    if (entry.isDirectory()) {
      await findAllMetadataFiles(fullPath, results);
    } else if (entry.name === 'metadata.yaml') {
      results.push(fullPath);
    }
  }));
  return results;
}


async function updateMetadataFile(filePath, assignments, compiledAssignments, dryRun) {
  let content = await fs.promises.readFile(filePath, 'utf8');
  const dir = path.dirname(filePath);
  const modelDirName = path.basename(dir);
  
  let updated = false;
  let newContent = content;
  
  for (const {modelId, data, idPattern} of compiledAssignments) {
    
    if (idPattern.test(content)) {
      if (data.gallery_categories && data.gallery_categories.length > 0) {
        const catsStr = JSON.stringify(data.gallery_categories);
        const galleryMatch = content.match(GALLERY_CATEGORIES_MATCH);
        if (galleryMatch) {
          newContent = newContent.replace(GALLERY_CATEGORIES_EMPTY, `gallery_categories: ${catsStr}`);
          updated = true;
        }
        
        const galleryCatMatch = content.match(GALLERY_CATEGORY_MATCH);
        if (galleryCatMatch && !content.includes('gallery_categories:')) {
          newContent = newContent.replace(GALLERY_CATEGORY_REPLACE, `gallery_categories: ${catsStr}`);
          updated = true;
        }
        
        const visibleMatch = content.match(PLAYGROUND_MATCH);
        if (visibleMatch && !content.includes('visible:')) {
          newContent = newContent.replace(PLAYGROUND_MATCH, `playground:\n  visible: true`);
          updated = true;
        }
      }
      
      if (data.bng2_compatible !== undefined) {
        const bng2Match = content.match(BNG2_COMPATIBLE_MATCH);
        if (bng2Match && bng2Match[1] === 'false' && data.bng2_compatible) {
          newContent = newContent.replace(BNG2_COMPATIBLE_REPLACE, 'bng2_compatible: true');
          updated = true;
        }
      }
      
      if (data.nfsim_compatible !== undefined) {
        const nfMatch = content.match(NFSIM_COMPATIBLE_MATCH);
        if (nfMatch && nfMatch[1] === 'false' && data.nfsim_compatible) {
          newContent = newContent.replace(NFSIM_COMPATIBLE_REPLACE, 'nfsim_compatible: true');
          updated = true;
        }
      }
      
      if (data.excluded !== undefined) {
        const excludedMatch = content.match(EXCLUDED_MATCH);
        if (excludedMatch && excludedMatch[1] === 'false' && data.excluded) {
          newContent = newContent.replace(EXCLUDED_REPLACE, 'excluded: true');
          updated = true;
        }
      }
      
      break;
    }
  }
  
  if (updated && !dryRun) {
    await fs.promises.writeFile(filePath, newContent);
  }
  
  return updated;
}

async function main(argv = process.argv.slice(2)) {
  const { input, root, dryRun } = parseArgs(argv);
  
  const safeInput = safeJoin(process.cwd(), input);
  const assignments = JSON.parse(await fs.promises.readFile(safeInput, 'utf8'));
  console.log(`Loaded ${Object.keys(assignments).length} assignments`);
  
  const compiledAssignments = [];
  for (const [modelId, data] of Object.entries(assignments)) {
    if (typeof modelId !== 'string' || modelId.length > 100) {
      console.warn(`Skipping invalid modelId: ${modelId}`);
      continue;
    }
    compiledAssignments.push({
      modelId, data,
      idPattern: new RegExp(`^id:\\s*["']?${modelId.replace(/[.*+?^${}()|[\]\\]/g, (match) => '\\' + match)}["']?\\s*$`, 'm')
    });
  }

  const SEARCH_ROOTS = ['Published', 'Examples', 'Tutorials'];
  const metadataFilePromises = SEARCH_ROOTS.map(searchRoot =>
    findAllMetadataFiles(path.join(root, searchRoot))
  );
  const metadataFileArrays = await Promise.all(metadataFilePromises);
  const metadataFiles = metadataFileArrays.flat();
  
  const updatePromises = metadataFiles.map(filePath =>
    updateMetadataFile(filePath, assignments, compiledAssignments, dryRun)
  );

  const results = await Promise.all(updatePromises);
  const updated = results.filter(Boolean).length;
  console.log(`Updated ${updated} metadata files`);
}

if (require.main === module) {
  main().catch(error => {
    console.error("An error occurred:", error);
    process.exit(1);
  });
}

module.exports = {
  parseArgs,
  findAllMetadataFiles,
  updateMetadataFile,
  main,
};
