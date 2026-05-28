const fs = require('fs');
const path = require('path');

const SEARCH_ROOTS = ['Published', 'Examples', 'Tutorials'];
const DEFAULT_IGNORE_DIRS = ['fitting', 'BioNetFit_files', 'output_*', 'fit_*', '__pycache__', 'pybnf_files'];

function parseArgs(argv) {
  let root = path.resolve(__dirname, '..');
  let dryRun = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--root' && argv[index + 1]) {
      root = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--dry-run') {
      dryRun = true;
    }
  }

  return { root, dryRun };
}

async function findBnglFiles(dir, ignoreDirs = DEFAULT_IGNORE_DIRS) {
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    
    const promises = entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (ignoreDirs.some(ignored => {
          if (ignored.includes('*')) {
            return entry.name.startsWith(ignored.replace('*', ''));
          }
          return entry.name === ignored;
        })) {
          return [];
        }
        return findBnglFiles(fullPath, ignoreDirs);
      } else if (entry.isFile() && entry.name.endsWith('.bngl')) {
        return [fullPath];
      }
      return [];
    });

    const results = await Promise.all(promises);
    return results.flat();
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
      return [];
    }
    throw error;
  }
}

function extractMetadataFromComments(headerComments, metadata) {
  if (headerComments.length === 0) return;

  for (const comment of headerComments) {
    const nameMatch = comment.match(/(?:model|name)[:\s]+(.+)/i);
    if (nameMatch && !metadata.name) {
      metadata.name = nameMatch[1].trim();
    }

    const doiMatch = comment.match(/(?:doi|DOI)[:\s]+(10\.\S+)/i);
    if (doiMatch) {
      metadata.doi = doiMatch[1].trim();
    }
  }

  const nonParamComments = headerComments.filter(c =>
    !c.match(/^[a-zA-Z_]\w*\s+changed\s+to/i)
  );
  if (nonParamComments.length > 0 && !metadata.description) {
    metadata.description = nonParamComments[0];
  }
}

function processActionLine(trimmed, metadata) {
  const nfMatch = trimmed.match(/method\s*=>\s*["']?nf["']?/);
  const odeMatch = trimmed.match(/method\s*=>\s*["']?ode["']?/);
  const ssaMatch = trimmed.match(/method\s*=>\s*["']?ssa["']?/);
  const plaMatch = trimmed.match(/method\s*=>\s*["']?pla["']?/);
  const hybridMatch = trimmed.match(/method\s*=>\s*["']?hybrid["']?/);

  if (nfMatch) {
    metadata.simulation_methods.push('nf');
    metadata.nfsim_compatible = true;
  }
  if (odeMatch) metadata.simulation_methods.push('ode');
  if (ssaMatch) metadata.simulation_methods.push('ssa');
  if (plaMatch) metadata.simulation_methods.push('pla');
  if (hybridMatch) metadata.simulation_methods.push('hybrid');
}

function processModelLine(trimmed, metadata, state) {
  if (trimmed === 'begin compartments') {
    state.inCompartments = true;
    metadata.uses_compartments = true;
    return;
  }
  if (trimmed === 'end compartments') {
    state.inCompartments = false;
    return;
  }

  if (trimmed === 'begin functions') {
    state.inFunctions = true;
    metadata.uses_functions = true;
    return;
  }
  if (trimmed === 'end functions') {
    state.inFunctions = false;
    return;
  }

  if (trimmed.startsWith('begin molecule types')) {
    return;
  }
  if (trimmed.startsWith('end molecule types')) {
    return;
  }

  if (!state.inCompartments && !state.inFunctions && trimmed && !trimmed.startsWith('begin') && !trimmed.startsWith('end')) {
    const match = trimmed.match(/^(\w+)\s+/);
    if (match && !trimmed.includes('=>') && !trimmed.includes('=')) {
      const moleculeName = match[1].toLowerCase();
      if (!metadata.tags.includes(moleculeName)) {
        metadata.tags.push(moleculeName);
      }
    }
  }

  if (trimmed.includes('energy') || trimmed.includes('Phi')) {
    metadata.uses_energy = true;
  }
}

function parseBngl(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  const metadata = {
    tags: [],
    uses_compartments: false,
    uses_energy: false,
    uses_functions: false,
    simulation_methods: [],
    nfsim_compatible: false,
    bng2_compatible: true,
    description: '',
    name: ''
  };

  const state = {
    inModel: false,
    inActions: false,
    inCompartments: false,
    inFunctions: false,
  };
  let headerComments = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('#') && !state.inModel && !state.inActions) {
      headerComments.push(trimmed.slice(1).trim());
      continue;
    }

    if (trimmed === 'begin model') {
      state.inModel = true;
      continue;
    }
    if (trimmed === 'end model') {
      state.inModel = false;
      continue;
    }
    if (trimmed === 'begin actions') {
      state.inActions = true;
      continue;
    }
    if (trimmed === 'end actions') {
      state.inActions = false;
      continue;
    }

    if (state.inModel) {
      processModelLine(trimmed, metadata, state);
    }

    if (state.inActions) {
      processActionLine(trimmed, metadata);
    }
  }

  extractMetadataFromComments(headerComments, metadata);

  if (metadata.simulation_methods.length === 0) {
    const hasGenerateNetwork = content.includes('generate_network');
    if (!hasGenerateNetwork) {
      metadata.nfsim_compatible = true;
    }
  }

  if (metadata.simulation_methods.length === 0) {
    metadata.simulation_methods = ['ode'];
  }

  metadata.simulation_methods = [...new Set(metadata.simulation_methods)];

  return metadata;
}

function inferCategory(dirPath) {
  const relativePath = path.relative(process.cwd(), dirPath);
  const lowerPath = relativePath.toLowerCase();

  if (lowerPath.includes('immune') || lowerPath.includes('tcr') || lowerPath.includes('bcr') || 
      lowerPath.includes('fceri') || lowerPath.includes('cytokine') || lowerPath.includes('innate')) {
    return 'immunology';
  }
  if (lowerPath.includes('egfr') || lowerPath.includes('mapk') || lowerPath.includes('ras') || 
      lowerPath.includes('tumor') || lowerPath.includes('cancer') || lowerPath.includes('signaling')) {
    return 'signaling';
  }
  if (lowerPath.includes('sir') || lowerPath.includes('covid') || lowerPath.includes('epidem')) {
    return 'epidemiology';
  }
  if (lowerPath.includes('cell') && lowerPath.includes('cycle')) {
    return 'cell-cycle';
  }
  if (lowerPath.includes('metabol')) {
    return 'metabolism';
  }
  if (lowerPath.includes('neural') || lowerPath.includes('neuron') || lowerPath.includes('brain')) {
    return 'neuroscience';
  }
  if (lowerPath.includes('ecolog') || lowerPath.includes('population')) {
    return 'ecology';
  }
  if (lowerPath.includes('tutorial')) {
    return 'tutorial';
  }
  if (lowerPath.includes('test')) {
    return 'validation';
  }
  
  return 'other';
}

function inferOrigin(dirPath) {
  const relativePath = path.relative(process.cwd(), dirPath);
  const lowerPath = relativePath.toLowerCase();

  if (lowerPath.startsWith('published')) {
    return 'published';
  }
  if (lowerPath.startsWith('examples')) {
    if (lowerPath.includes('ai-') || lowerPath.includes('aigenerated')) {
      return 'ai-generated';
    }
    return 'ai-generated';
  }
  if (lowerPath.startsWith('tutorials')) {
    return 'tutorial';
  }
  if (lowerPath.includes('contributed')) {
    return 'contributed';
  }

  return 'test-case';
}

function generateId(dir, baseName, dirName) {
  const relativePath = path.relative(process.cwd(), dir);
  const pathParts = relativePath.split(path.sep).filter(p => p && p !== 'Published' && p !== 'Examples' && p !== 'Tutorials');
  return pathParts.length > 0
    ? [...pathParts, baseName].join('_').replace(/\s+/g, '_').replace(/-/g, '_')
    : `${dirName}_${baseName}`.replace(/\s+/g, '_').replace(/-/g, '_');
}

function generateMetadata(bnglFile, parsed) {
  const dir = path.dirname(bnglFile);
  const baseName = path.basename(bnglFile, '.bngl');
  const dirName = path.basename(dir);
  
  const id = generateId(dir, baseName, dirName);
  const name = parsed.name || dirName.replace(/_/g, ' ');
  const description = parsed.description || `BNGL model: ${baseName}`;
  const category = inferCategory(dir);
  const origin = inferOrigin(dir);

  const metadata = {
    id,
    name,
    description,
    tags: parsed.tags.length > 0 ? parsed.tags : [category],
    category,
    compatibility: {
      bng2_compatible: parsed.bng2_compatible,
      nfsim_compatible: parsed.nfsim_compatible,
      simulation_methods: parsed.simulation_methods,
      uses_compartments: parsed.uses_compartments,
      uses_energy: parsed.uses_energy,
      uses_functions: parsed.uses_functions,
    },
    source: {
      origin,
    },
    playground: {
      visible: false,
      gallery_categories: [],
      featured: false,
      difficulty: 'intermediate',
    },
  };

  if (parsed.doi) {
    metadata.citation = {
      doi: parsed.doi,
    };
  }

  return metadata;
}

function formatYaml(obj, indent = 0) {
  const spaces = '  '.repeat(indent);
  let result = '';

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;

    if (Array.isArray(value)) {
      if (value.length === 0) {
        result += `${spaces}${key}: []\n`;
      } else if (value.every(v => typeof v !== 'object')) {
        const items = value.map(v => typeof v === 'string' ? `"${v}"` : v);
        result += `${spaces}${key}: [${items.join(', ')}]\n`;
      } else {
        result += `${spaces}${key}:\n`;
        for (const item of value) {
          if (typeof item === 'object') {
            result += `${spaces}  - ${formatYamlValue(item, indent + 2)}`;
          } else {
            result += `${spaces}  - ${item}\n`;
          }
        }
      }
    } else if (typeof value === 'object') {
      result += `${spaces}${key}:\n${formatYaml(value, indent + 1)}`;
    } else if (typeof value === 'boolean') {
      result += `${spaces}${key}: ${value}\n`;
    } else if (typeof value === 'number') {
      result += `${spaces}${key}: ${value}\n`;
    } else {
      result += `${spaces}${key}: ${value}\n`;
    }
  }

  return result;
}

function formatYamlValue(value, indent = 0) {
  if (typeof value === 'object') {
    const spaces = '  '.repeat(indent);
    let result = '';
    const entries = Object.entries(value);
    for (let i = 0; i < entries.length; i++) {
      const [k, v] = entries[i];
      if (typeof v === 'object') {
        result += `\n${spaces}${k}:\n${formatYamlValue(v, indent + 1)}`;
      } else {
        result += `${k}: ${v}${i < entries.length - 1 ? '\n' + spaces : ''}`;
      }
    }
    return result + '\n';
  }
  return String(value) + '\n';
}

async function main() {
  const { root, dryRun } = parseArgs(process.argv.slice(2));

  console.info(`Scanning for .bngl files without metadata.yaml in ${root}...`);
  console.info(`Dry run: ${dryRun}\n`);

  const searchPromises = SEARCH_ROOTS.map(searchRoot =>
    findBnglFiles(path.join(root, searchRoot))
  );
  const bnglFilesArrays = await Promise.all(searchPromises);
  const bnglFiles = bnglFilesArrays.flat();

  console.info(`Found ${bnglFiles.length} .bngl files\n`);

  let created = 0;
  let skipped = 0;

  for (const bnglFile of bnglFiles) {
    const dir = path.dirname(bnglFile);
    const metadataPath = path.join(dir, 'metadata.yaml');

    if (fs.existsSync(metadataPath)) {
      skipped++;
      continue;
    }

    console.info(`Processing: ${bnglFile}`);

    const parsed = parseBngl(bnglFile);
    const metadata = generateMetadata(bnglFile, parsed);

    const yamlContent = formatYaml(metadata);

    if (dryRun) {
      console.info(`  [DRY RUN] Would create: ${metadataPath}`);
      console.info(yamlContent);
    } else {
      fs.writeFileSync(metadataPath, yamlContent);
      console.info(`  Created: ${metadataPath}`);
    }

    created++;
  }

  console.info(`\nSummary:`);
  console.info(`  Total .bngl files: ${bnglFiles.length}`);
  console.info(`  Skipped (has metadata): ${skipped}`);
  console.info(`  Created: ${created}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  parseBngl,
  generateMetadata,
  findBnglFiles,
  formatYaml,
};