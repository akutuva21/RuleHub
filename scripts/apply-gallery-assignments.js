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

function findAllMetadataFiles(dir, results = []) {
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findAllMetadataFiles(fullPath, results);
    } else if (entry.name === 'metadata.yaml') {
      results.push(fullPath);
    }
  }
  return results;
}

function updateMetadataFile(filePath, assignments, dryRun) {
  let content = fs.readFileSync(filePath, 'utf8');
  const dir = path.dirname(filePath);
  const modelDirName = path.basename(dir);
  
  let updated = false;
  let newContent = content;
  
  for (const [modelId, data] of Object.entries(assignments)) {
    const idPattern = new RegExp(`^id:\\s*["']?${modelId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']?\\s*$`, 'm');
    
    if (idPattern.test(content)) {
      console.log(`  Found model ${modelId} in ${filePath}`);
      
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
    fs.writeFileSync(filePath, newContent);
  }
  
  return updated;
}

function main() {
  const { input, root, dryRun } = parseArgs(process.argv.slice(2));
  
  console.log(`Reading ${input}...`);
  const assignments = JSON.parse(fs.readFileSync(input, 'utf8'));
  console.log(`Loaded ${Object.keys(assignments).length} assignments`);
  
  const SEARCH_ROOTS = ['Published', 'Examples', 'Tutorials'];
  const metadataFiles = SEARCH_ROOTS.flatMap(searchRoot => 
    findAllMetadataFiles(path.join(root, searchRoot))
  );
  
  console.log(`Found ${metadataFiles.length} metadata.yaml files`);
  
  let updated = 0;
  for (const filePath of metadataFiles) {
    if (updateMetadataFile(filePath, assignments, dryRun)) {
      updated++;
    }
  }
  
  console.log(`\n${dryRun ? 'Would update' : 'Updated'} ${updated} files`);
}

if (require.main === module) {
  main();
}

module.exports = { updateMetadataFile, parseArgs, findAllMetadataFiles };