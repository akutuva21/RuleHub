const fs = require('fs');
const path = require('path');

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

async function findAllMetadataFiles(dir) {
  let results = [];
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    const promises = entries.map(async entry => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const subResults = await findAllMetadataFiles(fullPath);
        results.push(...subResults);
      } else if (entry.name === 'metadata.yaml') {
        results.push(fullPath);
      }
    });
    await Promise.all(promises);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
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
        const galleryMatch = content.match(/gallery_categories:\s*(\[\]|["\'][^"\']*["\'])/);
        if (galleryMatch) {
          if (galleryMatch) {
            newContent = newContent.replace(/gallery_categories:\s*\[\]/, `gallery_categories: ${catsStr}`);
            updated = true;
          }
        }
        
        const galleryCatMatch = content.match(/gallery_category:\s*["']([^"\']+)["\']/);
        if (galleryCatMatch && !content.includes('gallery_categories:')) {
          newContent = newContent.replace(/gallery_category:\s*["'][^"\']+["\']/, `gallery_categories: ${catsStr}`);
          updated = true;
        }
        
        const visibleMatch = content.match(/playground:\s*$/m);
        if (visibleMatch && !content.includes('visible:')) {
          newContent = newContent.replace(/playground:\s*$/m, `playground:\n  visible: true`);
          updated = true;
        }
      }
      
      if (data.bng2_compatible !== undefined) {
        const bng2Match = content.match(/bng2_compatible:\s*(true|false)/);
        if (bng2Match && bng2Match[1] === 'false' && data.bng2_compatible) {
          newContent = newContent.replace(/bng2_compatible:\s*false/, 'bng2_compatible: true');
          updated = true;
        }
      }
      
      if (data.nfsim_compatible !== undefined) {
        const nfMatch = content.match(/nfsim_compatible:\s*(true|false)/);
        if (nfMatch && nfMatch[1] === 'false' && data.nfsim_compatible) {
          newContent = newContent.replace(/nfsim_compatible:\s*false/, 'nfsim_compatible: true');
          updated = true;
        }
      }
      
      if (data.excluded !== undefined) {
        const excludedMatch = content.match(/excluded:\s*(true|false)/);
        if (excludedMatch && excludedMatch[1] === 'false' && data.excluded) {
          newContent = newContent.replace(/excluded:\s*false/, 'excluded: true');
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
  
  const assignments = JSON.parse(await fs.promises.readFile(input, 'utf8'));
  console.log(`Loaded ${Object.keys(assignments).length} assignments`);
  
  const compiledAssignments = Object.entries(assignments).map(([modelId, data]) => ({
    modelId, data,
    idPattern: new RegExp(`^id:\\s*["']?${modelId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']?\\s*$`, 'm')
  }));

  const SEARCH_ROOTS = ['Published', 'Examples', 'Tutorials'];
  const metadataFileArrays = await Promise.all(
    SEARCH_ROOTS.map(searchRoot => findAllMetadataFiles(path.join(root, searchRoot)))
  );
  const metadataFiles = metadataFileArrays.flat();
  
  const updatePromises = metadataFiles.map(filePath =>
    updateMetadataFile(filePath, assignments, compiledAssignments, dryRun)
  );

  const results = await Promise.all(updatePromises);
  const updated = results.filter(Boolean).length;
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
