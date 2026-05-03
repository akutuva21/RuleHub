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
  let depth = 0;
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
    let depth = 0;
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
  const mappings = {};
  
  const categoryPatterns = [
    { pattern: /CANCER_MODELS.*?egfr-signaling-pathway.*?glioblastoma.*?hif1a.*?hypoxia.*?vegf.*?dna-damage.*?checkpoint.*?ras-gef.*?p38.*?mapk-signaling-cascade/s, category: 'cancer' },
    { pattern: /IMMUNOLOGY_MODELS.*?bcr-signaling.*?cd40.*?complement.*?immune-synapse/s, category: 'immunology' },
    { pattern: /NEUROSCIENCE_MODELS.*?ampk-signaling.*?calcineurin.*?calcium.*?mtor.*?neurotransmitter.*?synaptic/s, category: 'neuroscience' },
    { pattern: /CELL_CYCLE_MODELS.*?apoptosis.*?caspase.*?cell-cycle.*?dr5.*?e2f.*?tnf.*?p53.*?clock-bmal1/s, category: 'cell-cycle' },
    { pattern: /METABOLISM_MODELS.*?allosteric.*?auto-activation.*?autophagy.*?glycolysis.*?insulin.*?lac-operon/s, category: 'metabolism' },
    { pattern: /DEVELOPMENTAL_MODELS.*?hedgehog.*?myogenic.*?notch.*?rankl.*?sonic-hedgehog.*?wnt.*?fgf.*?smad.*?retinoic.*?bmp/s, category: 'developmental' },
    { pattern: /ECOLOGY_MODELS.*?eco_/s, category: 'ecology' },
    { pattern: /PHYSICS_MODELS.*?ph_/s, category: 'physics' },
    { pattern: /COMPUTER_SCIENCE_MODELS.*?cs_/s, category: 'cs' },
    { pattern: /ML_SIGNAL_MODELS.*?ml_|sp_/s, category: 'ml-signal' },
    { pattern: /SYNBIO_MODELS.*?synbio/s, category: 'synbio' },
  ];
  
  const modelIdToCategory = {};
  
  const cancertest = content.match(/CANCER_MODELS\.filter\(m => \[([^\]]+)\]\.includes\(m\.id\)\)/);
  if (cancertest) {
    const ids = cancertest[1].match(/["']([^"']+)["']/g) || [];
    ids.forEach(id => modelIdToCategory[id.replace(/['"]/g, '')] = 'cancer');
  }
  
  const immunetest = content.match(/IMMUNOLOGY_MODELS\.filter\(m => \[([^\]]+)\]\.includes\(m\.id\)\)/);
  if (immunetest) {
    const ids = immunetest[1].match(/["']([^"']+)["']/g) || [];
    ids.forEach(id => modelIdToCategory[id.replace(/['"]/g, '')] = 'immunology');
  }
  
  const neuroscience = content.match(/NEUROSCIENCE_MODELS\.filter\(m => \[([^\]]+)\]\.includes\(m\.id\)\)/);
  if (neuroscience) {
    const ids = neuroscience[1].match(/["']([^"']+)["']/g) || [];
    ids.forEach(id => modelIdToCategory[id.replace(/['"]/g, '')] = 'neuroscience');
  }
  
  const cellcycle = content.match(/CELL_CYCLE_MODELS\.filter\(m => \[([^\]]+)\]\.includes\(m\.id\)\)/);
  if (cellcycle) {
    const ids = cellcycle[1].match(/["']([^"']+)["']/g) || [];
    ids.forEach(id => modelIdToCategory[id.replace(/['"]/g, '')] = 'cell-cycle');
  }
  
  const metabolism = content.match(/METABOLISM_MODELS\.filter\(m => \[([^\]]+)\]\.includes\(m\.id\)\)/);
  if (metabolism) {
    const ids = metabolism[1].match(/["']([^"']+)["']/g) || [];
    ids.forEach(id => modelIdToCategory[id.replace(/['"]/g, '')] = 'metabolism');
  }
  
  const developmental = content.match(/DEVELOPMENTAL_MODELS\.filter\(m => \[([^\]]+)\]\.includes\(m\.id\)\)/);
  if (developmental) {
    const ids = developmental[1].match(/["']([^"']+)["']/g) || [];
    ids.forEach(id => modelIdToCategory[id.replace(/['"]/g, '')] = 'developmental');
  }
  
  const ecology = content.match(/ECOLOGY_MODELS\.filter\(m => \[([^\]]+)\]\.includes\(m\.id\)\)/);
  if (ecology) {
    const ids = ecology[1].match(/["']([^"']+)["']/g) || [];
    ids.forEach(id => modelIdToCategory[id.replace(/['"]/g, '')] = 'ecology');
  }
  
  const physics = content.match(/PHYSICS_MODELS\.filter\(m => \[([^\]]+)\]\.includes\(m\.id\)\)/);
  if (physics) {
    const ids = physics[1].match(/["']([^"']+)["']/g) || [];
    ids.forEach(id => modelIdToCategory[id.replace(/['"]/g, '')] = 'physics');
  }
  
  const cs = content.match(/COMPUTER_SCIENCE_MODELS\.filter\(m => \[([^\]]+)\]\.includes\(m\.id\)\)/);
  if (cs) {
    const ids = cs[1].match(/["']([^"']+)["']/g) || [];
    ids.forEach(id => modelIdToCategory[id.replace(/['"]/g, '')] = 'cs');
  }
  
  const ml = content.match(/ML_SIGNAL_MODELS\.filter\(m => \[([^\]]+)\]\.includes\(m\.id\)\)/);
  if (ml) {
    const ids = ml[1].match(/["']([^"']+)["']/g) || [];
    ids.forEach(id => modelIdToCategory[id.replace(/['"]/g, '')] = 'ml-signal');
  }
  
  const synbio = content.match(/SYNBIO_MODELS\.filter\(m => \[([^\]]+)\]\.includes\(m\.id\)\)/);
  if (synbio) {
    const ids = synbio[1].match(/["']([^"']+)["']/g) || [];
    ids.forEach(id => modelIdToCategory[id.replace(/['"]/g, '')] = 'synbio');
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
  
  const native = content.match(/NATIVE_TUTORIALS\.filter\(m => \["([^"]+)"\]/);
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

function main() {
  const { constantsPath, output } = parseArgs(process.argv.slice(2));
  
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

main();