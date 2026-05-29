const fs = require('fs');
const path = require('path');

const rulehubRoot = 'C:\\Users\\Achyudhan\\OneDrive - University of Pittsburgh\\Desktop\\Achyudhan\\School\\PhD\\Research\\BioNetGen\\RuleHub';
const publishedDir = path.join(rulehubRoot, 'Published');

const BLACKLIST = new Set([
  'generate_network', 'simulate', 'simulate_ode', 'simulate_ssa', 'simulate_nf', 'writexml', 
  'setoption', 'exclude_reactants', 'include_reactants', 'species', 'molecules', 'time', 
  'counter', 'trash', 'null', 'setparameter', 'resetconcentrations', 'tmax', 't', 
  'version', 'source', 'origin', 'published', 'literature', 'tofit', 'ground', 'exact', 
  'fit', 'best_fit', 'bnf', 'bnf1', 'pybnf', 'pybng', 'validation', 'showcase', 'tutorial', 
  'test-case', 'other', 'signaling', 'immunology', 'cancer', 'metabolism', 'cell-cycle', 
  'developmental', 'physics', 'cs', 'ecology', 'synbio'
]);

async function listMetadataFiles(dir) {
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    const promises = entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return listMetadataFiles(fullPath);
      } else if (entry.isFile() && entry.name === 'metadata.yaml') {
        return [fullPath];
      }
      return [];
    });
    const results = await Promise.all(promises);
    return results.flat();
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

function parseMetadataYaml(content) {
  const lines = content.split('\n');
  const metadata = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (match) {
      const key = match[1];
      let val = match[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
      metadata[key] = val;
    }
  }
  return metadata;
}

async function main() {
  const metadataFiles = await listMetadataFiles(publishedDir);
  let count = 0;

  for (const metaFile of metadataFiles) {
    const relPath = path.relative(publishedDir, path.dirname(metaFile)).replace(/\\/g, '/');

    // Skip PyBioNetGen internal files
    if (relPath.startsWith('PyBioNetGen')) {
      continue;
    }

    let content = await fs.promises.readFile(metaFile, 'utf8');
    let meta = parseMetadataYaml(content);

    // 1. Rename McMillan_immunology_2021 to McMillan_TNF_2021
    if (meta.id === 'McMillan_immunology_2021') {
      content = content.replace(/^id:\s*(["']?)McMillan_immunology_2021\1\s*$/m, 'id: "McMillan_TNF_2021"');
      meta.id = 'McMillan_TNF_2021';
    }

    // 2. Rename ZAP_immunology_2021 to ZAP70_immunology_2021
    if (meta.id === 'ZAP_immunology_2021') {
      content = content.replace(/^id:\s*(["']?)ZAP_immunology_2021\1\s*$/m, 'id: "ZAP70_immunology_2021"');
      meta.id = 'ZAP70_immunology_2021';
    }

    // 3. Parse and clean up tags
    const tagsMatch = content.match(/^tags:\s*\[(.*?)\]\s*$/m);
    if (tagsMatch) {
      const rawTags = tagsMatch[1].split(',')
        .map(t => t.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);

      let cleanTags = [];
      for (const tag of rawTags) {
        const lowerTag = tag.toLowerCase();

        // Filter blacklisted words
        if (BLACKLIST.has(lowerTag)) continue;

        // Filter length <= 2 (except common ones if necessary, but generally raw variables are short)
        if (lowerTag.length <= 2) continue;

        // Filter raw variables and parameter names: e.g. starts with letter, has digit, not a 4-digit year
        if (/^[a-zA-Z]+.*\d+.*$/.test(tag) && !/^\d{4}$/.test(tag)) {
          continue;
        }

        // Filter other raw variable patterns like grb2_total__free
        if (lowerTag.includes('_') || lowerTag.includes('__')) {
          // Only keep if it is a well-known biological concept containing underscore (like cell_cycle)
          const okTags = ['cell_cycle', 'signal_transduction', 'gene_expression', 'feed_forward', 'feedback_loop'];
          if (!okTags.includes(lowerTag)) {
            continue;
          }
        }

        cleanTags.push(lowerTag);
      }

      // 4. Add clean biological tags based on author, category, description, and year
      // Extract year
      const yearMatch = relPath.match(/\d{4}/);
      if (yearMatch) {
        cleanTags.push(yearMatch[0]);
      }

      // Extract author
      const authorMatch = relPath.match(/^([A-Za-z]+)/);
      if (authorMatch && authorMatch[1].toLowerCase() !== 'rulebased' && authorMatch[1].toLowerCase() !== 'vaxandvariants') {
        cleanTags.push(authorMatch[1].toLowerCase());
      }

      // Add category/subject terms from description
      const desc = (meta.description || '').toLowerCase();
      if (desc.includes('tnf')) cleanTags.push('tnf');
      if (desc.includes('egfr') || desc.includes('egf')) cleanTags.push('egfr');
      if (desc.includes('tcr') || desc.includes('t cell')) cleanTags.push('tcr');
      if (desc.includes('bcr') || desc.includes('b cell')) cleanTags.push('bcr');
      if (desc.includes('fceri') || desc.includes('ige')) cleanTags.push('fceri');
      if (desc.includes('camkii')) cleanTags.push('camkii');
      if (desc.includes('circadian') || desc.includes('clock')) cleanTags.push('circadian');
      if (desc.includes('signaling') || desc.includes('cascade')) cleanTags.push('signaling');
      if (desc.includes('transport') || desc.includes('import')) cleanTags.push('transport');
      if (desc.includes('oscillation') || desc.includes('oscillator')) cleanTags.push('oscillations');

      // Deduplicate and sort
      const finalTags = Array.from(new Set(cleanTags)).sort();

      // Replace the tags line in-place
      const tagsString = finalTags.map(t => `"${t}"`).join(', ');
      const updatedContent = content.replace(/^tags:\s*\[(.*?)\]\s*$/m, `tags: [${tagsString}]`);

      if (content !== updatedContent) {
        await fs.promises.writeFile(metaFile, updatedContent, 'utf8');
        console.log(`Curated tags in ${metaFile} -> [${tagsString}]`);
        count++;
      }
    }
  }

  // 5. Update our ID_MAP in normalize-published-ids.js to map McMillan2021 to McMillan_TNF_2021
  const normalizerPath = path.join(rulehubRoot, 'scripts', 'migration', 'normalize-published-ids.js');
  try {
    let normalizerContent = await fs.promises.readFile(normalizerPath, 'utf8');
    normalizerContent = normalizerContent.replace(
      /"McMillan2021": "McMillan_immunology_2021"/,
      '"McMillan2021": "McMillan_TNF_2021"'
    ).replace(
      /"ModelZAP": "ZAP_immunology_2021"/,
      '"ModelZAP": "ZAP70_immunology_2021"'
    );
    await fs.promises.writeFile(normalizerPath, normalizerContent, 'utf8');
    console.log('Updated normalize-published-ids.js map values.');
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  console.log(`\nSuccessfully curated tags in ${count} Published metadata files!`);
}

main().catch(console.error);
