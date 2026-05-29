const fs = require('fs');

function parseArgs(argv) {
  let constantsPath = '';
  let output = 'gallery-assignments.json';

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--input' && argv[i + 1]) {
      constantsPath = argv[i + 1];
      i++;
    } else if (argv[i] === '--output' && argv[i + 1]) {
      output = argv[i + 1];
      i++;
    }
  }

  if (!constantsPath) {
    console.error('Usage: node extract-gallery-from-constants.js --input <path-to-constants.ts> [--output gallery-assignments.json]');
    process.exit(1);
  }

  return { constantsPath, output };
}

function parseSetFromString(content, setName) {
  const searchStr = `export const ${setName} = new Set([`;
  const startIdx = content.indexOf(searchStr);
  if (startIdx === -1) return new Set();
  
  const arrayStart = startIdx + searchStr.length;
  let depth = 1;
  let arrayEnd = arrayStart;
  
  for (let i = arrayStart; i < content.length; i++) {
    if (content[i] === '[') depth++;
    if (content[i] === ']') {
      depth--;
      if (depth === 0) {
        arrayEnd = i;
        break;
      }
    }
  }
  
  const arrayContent = content.substring(arrayStart, arrayEnd);
  const items = arrayContent.split(',')
    .map(s => s.trim().replace(/^'|'$/g, ''))
    .filter(s => s);
  
  return new Set(items);
}

function extractAllModelIds(content) {
  const sourceArrays = [
    'TEST_MODELS',
    'NATIVE_TUTORIALS',
    'COMPLEX_MODELS',
    'IMMUNE_SIGNALING',
    'GROWTH_FACTOR_SIGNALING',
    'CELL_REGULATION',
    'ORDYAN_2020',
    'INTERNAL_VALIDATION_MODELS',
    'TUTORIALS',
  ];
  
  const modelIds = new Set();
  
  for (const arrayName of sourceArrays) {
    const searchStr = `const ${arrayName}: Example[] = [`;
    const startIdx = content.indexOf(searchStr);
    if (startIdx === -1) continue;
    
    const arrayStart = startIdx + searchStr.length;
    let depth = 1;
    let arrayEnd = arrayStart;
    
    for (let i = arrayStart; i < content.length; i++) {
      if (content[i] === '[') depth++;
      if (content[i] === ']') {
        depth--;
        if (depth === 0) {
          arrayEnd = i;
          break;
        }
      }
    }
    
    const block = content.substring(arrayStart, arrayEnd);
    const idPattern = /id:\s*['"]([^'"]+)['"]/g;
    let match;
    while ((match = idPattern.exec(block)) !== null) {
      modelIds.add(match[1]);
    }
  }
  
  return modelIds;
}

function extractCategoryMappings(content) {
  const modelIdToCategory = {};
  
  const simpleCategories = [
    { prefix: 'CANCER_MODELS', category: 'cancer' },
    { prefix: 'IMMUNOLOGY_MODELS', category: 'immunology' },
    { prefix: 'NEUROSCIENCE_MODELS', category: 'neuroscience' },
    { prefix: 'CELL_CYCLE_MODELS', category: 'cell-cycle' },
    { prefix: 'METABOLISM_MODELS', category: 'metabolism' },
    { prefix: 'DEVELOPMENTAL_MODELS', category: 'developmental' },
    { prefix: 'ECOLOGY_MODELS', category: 'ecology' },
    { prefix: 'PHYSICS_MODELS', category: 'physics' },
    { prefix: 'COMPUTER_SCIENCE_MODELS', category: 'cs' },
    { prefix: 'ML_SIGNAL_MODELS', category: 'ml-signal' },
    { prefix: 'SYNBIO_MODELS', category: 'synbio' },
  ];
  
  for (const { prefix, category } of simpleCategories) {
    const regex = new RegExp(`${prefix}\\.filter\\(m => \\[\([^\\]]+\)\\]\\.includes\\(m\\.id\\)\\)`);
    const match = content.match(regex);
    if (match) {
      const ids = match[1].match(/["']([^"']+)["']/g) || [];
      ids.forEach(id => modelIdToCategory[id.replace(/['"]/g, '')] = category);
    }
  }
  
  const tutorials = content.match(/const TUTORIALS: Example\[\] = \[([\s\S]*?)\];/);
  if (tutorials) {
    const ids = tutorials[1].match(/id:\s*["']([^"']+)["']/g) || [];
    ids.forEach(m => {
      const id = m.match(/id:\s*["']([^"']+)["']/)[1];
      if (!modelIdToCategory[id]) modelIdToCategory[id] = [];
      if (!modelIdToCategory[id].includes('tutorials')) {
        if (Array.isArray(modelIdToCategory[id])) modelIdToCategory[id].push('tutorials');
        else modelIdToCategory[id] = ['tutorials'];
      }
    });
  }
  
  const native = content.match(/NATIVE_TUTORIALS\.filter\(m => \["([^\]]+)"\]/);
  if (native) {
    const ids = native[1].split(',').map(s => s.trim().replace(/["']/g, ''));
    ids.forEach(id => {
      if (!modelIdToCategory[id]) modelIdToCategory[id] = [];
      if (!modelIdToCategory[id].includes('native-tutorials')) {
        if (Array.isArray(modelIdToCategory[id])) modelIdToCategory[id].push('native-tutorials');
        else modelIdToCategory[id] = ['native-tutorials'];
      }
    });
  }
  
  return modelIdToCategory;
}

function main(argv = process.argv.slice(2)) {
  const { constantsPath, output } = parseArgs(argv);
  
  console.log(`Reading ${constantsPath}...`);
  const content = fs.readFileSync(constantsPath, 'utf8');
  
  const bng2Compatible = parseSetFromString(content, 'BNG2_COMPATIBLE_MODELS');
  const bng2Excluded = parseSetFromString(content, 'BNG2_EXCLUDED_MODELS');
  const nfsimModels = parseSetFromString(content, 'NFSIM_MODELS');
  
  console.log(`Found BNG2_COMPATIBLE: ${bng2Compatible.size}`);
  console.log(`Found BNG2_EXCLUDED: ${bng2Excluded.size}`);
  console.log(`Found NFSIM_MODELS: ${nfsimModels.size}`);
  
  const modelIds = extractAllModelIds(content);
  console.log(`Found ${modelIds.size} total model IDs`);
  
  const categoryMappings = extractCategoryMappings(content);
  console.log(`Found ${Object.keys(categoryMappings).length} category mappings`);
  
  const assignments = {};
  
  for (const id of modelIds) {
    let categories = categoryMappings[id];
    if (!categories) categories = [];
    else if (!Array.isArray(categories)) categories = [categories];
    
    if (categories.length === 0) {
      categories = ['test-models'];
    }
    
    assignments[id] = {
      gallery_categories: categories,
      bng2_compatible: bng2Compatible.has(id),
      nfsim_compatible: nfsimModels.has(id),
      excluded: bng2Excluded.has(id),
    };
  }
  
  for (const id of bng2Compatible) {
    if (!assignments[id]) {
      assignments[id] = {
        gallery_categories: [],
        bng2_compatible: true,
        nfsim_compatible: nfsimModels.has(id),
        excluded: bng2Excluded.has(id),
      };
    }
  }
  
  fs.writeFileSync(output, JSON.stringify(assignments, null, 2));
  console.log(`\nExtracted ${Object.keys(assignments).length} model assignments to ${output}`);
  
  const withGallery = Object.values(assignments).filter(a => a.gallery_categories.length > 0).length;
  const bng2CompatibleCount = Object.values(assignments).filter(a => a.bng2_compatible).length;
  const nfsimCount = Object.values(assignments).filter(a => a.nfsim_compatible).length;
  console.log(`  With gallery categories: ${withGallery}`);
  console.log(`  BNG2 compatible: ${bng2CompatibleCount}`);
  console.log(`  NFsim compatible: ${nfsimCount}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  parseArgs,
  parseSetFromString,
  extractAllModelIds,
  extractCategoryMappings,
  main
};