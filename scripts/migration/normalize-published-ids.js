const fs = require('fs');
const path = require('path');

const rulehubRoot = path.resolve(__dirname, '../../');
const publishedDir = path.join(rulehubRoot, 'Published');

const ID_MAP = {
  "An2009": "An_TLR4_2009",
  "Barua2007": "Barua_EGFR_2007",
  "Barua2009": "Barua_JAK2_2009",
  "Barua2013": "Barua_bcat_2013",
  "BaruaBCR2012": "Barua_BCR_2012",
  "BaruaFceRI2012": "Barua_FceRI_2012",
  "Blinov2006": "Blinov_egfr_2006",
  "Blinovegfr": "Blinov_egfr_2006",
  "Blinovran": "Blinov_ran_2006",
  "Chattaraj2021": "Chattaraj_nephrin_2021",
  "CheemalavaguJAKSTAT": "Cheemalavagu_JAKSTAT_2024",
  "ChylekFceRI2014": "Chylek_FceRI_2014",
  "ChylekTCR2014": "Chylek_TCR_2014",
  "Dembo1978": "Dembo_blbr_1978",
  "Dolan2015": "Dolan_Insulin_2015",
  "Dreisigmeyer2008": "Dreisigmeyer_LacOperon_2008",
  "Dushek2011": "Dushek_TCR_2011",
  "Dushek2014": "Dushek_TCR_2014",
  "Erdem2021": "Erdem_InsR_2021",
  "Faeder2003": "Faeder_FceRI_2003",
  "Gardner2000": "Gardner_Toggle_2000",
  "Goldstein1980": "Goldstein_blbr_1980",
  "Harmon2017": "Harmon_Antigen_2017",
  "Hat2016": "Hat_wip1_2016",
  "Hlavacek1999": "Hlavacek_Steric_1999",
  "Hlavacek2001": "Hlavacek_Proofreading_2001",
  "Hlavacek2018Egg": "Hlavacek_Egg_2018",
  "Hlavacek2018Elephant": "Hlavacek_Elephant_2018",
  "Hlavacek2018Restructuration": "Hlavacek_Restructuration_2018",
  "JaruszewiczBlonska2023": "JaruszewiczBlonska_NFkB_2023",
  "Jung2017": "Jung_CaMKII_2017",
  "Kesseler2013": "Kesseler_CellCycle_2013",
  "Kocieniewski2012": "Kocieniewski_published_2012",
  "Korwek2023": "Korwek_published_2023",
  "Kozer2013": "Kozer_egfr_2013",
  "Kozer2014": "Kozer_egfr_2014",
  "Lang2024": "Lang_CellCycle_2024",
  "Ligon2014": "Ligon_egfr_2014",
  "LinERK2019": "Lin_ERK_2019",
  "LinPrion2019": "Lin_Prion_2019",
  "LinTCR2019": "Lin_TCR_2019",
  "Macken1982": "Macken_physics_1982",
  "Mallela2021": "Mallela_COVID_2021",
  "Mallela2021_Cities": "Mallela_Cities_2021",
  "Mallela2022": "Mallela_COVID_2022",
  "Mallela2022_MSAs": "Mallela_MSAs_2022",
  "Massole2023": "Massole_developmental_2023",
  "McMillan2021": "McMillan_TNF_2021",
  "Mertins2023": "Mertins_cancer_2023",
  "Miller2022_NavajoNation": "Miller_NavajoNation_2022",
  "Miller2025_MEK": "Miller_MEK_2025",
  "Mitra2019/02-egfr": "Mitra_egfr_2019",
  "Mitra2019/05-threestep": "Mitra_threestep_2019",
  "Mitra2019/13-receptor": "Mitra_receptor_2019",
  "Mitra2019/17-egfr-ssa": "Mitra_egfr_ssa_2019",
  "Mitra2019/18-mapk": "Mitra_mapk_2019",
  "Mitra2019/28-mapk": "Mitra_mapk_ensemble_2019",
  "Mitra2019/30-jobs": "Mitra_jobs_2019",
  "Mitra2019Likelihood": "Mitra_likelihood_2019",
  "Mitra2019Rab": "Mitra_Rab_2019",
  "Mitra2019Rab/pybnf_files": "Mitra_Rab_pybnf_2019",
  "ModelZAP": "ZAP70_immunology_2021",
  "Mukhopadhyay2013": "Mukhopadhyay_TCR_2013",
  "Nag2009": "Nag_cancer_2009",
  "Nosbisch2022": "Nosbisch_cancer_2022",
  "Ordyan2020": "Ordyan_CaMKII_2020",
  "Pekalski2013": "Pekalski_published_2013",
  "Posner1995": "Posner_blbr_1995",
  "Posner2004": "Posner_blbr_2004",
  "RulebasedRantransport": "Rule_based_Ran_transport",
  "RulebasedRantransportdraft": "Rule_based_Ran_transport_draft",
  "Rulebasedegfrcompart": "Rule_based_egfr_compart",
  "Rulebasedegfrtutorial": "Faeder_egfr_2009",
  "Salazar-Cavazos2019": "Salazar_Cavazos_egfr_2019",
  "Thomas2016": "Thomas_egfr_2016",
  "vilar2002": "Vilar_Circadian_2002",
  "vilar2002b": "Vilar_Circadian_2002b",
  "vilar2002c": "Vilar_Circadian_2002c",
  "Yang2008": "Yang_tlbr_2008",
  "Zhang2021": "Zhang_developmental_2021",
  "Zhang2023": "Zhang_developmental_2023",
  "VaxAndVariants/NYC": "VaxAndVariants_NYC",
  "VaxAndVariants/Phoenix": "VaxAndVariants_Phoenix"
};

function listMetadataFiles(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listMetadataFiles(fullPath, results);
    } else if (entry.isFile() && entry.name === 'metadata.yaml') {
      results.push(fullPath);
    }
  }
  return results;
}

function updateMetadataId(filePath, newId) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace the id property in yaml
  // Match id: "..." or id: '...' or id: ...
  const updatedContent = content.replace(/^id:\s*(["']?)(.*?)\1\s*$/m, `id: "${newId}"`);
  
  if (content !== updatedContent) {
    fs.writeFileSync(filePath, updatedContent, 'utf8');
    console.log(`Updated ID in ${filePath} to "${newId}"`);
    return true;
  }
  return false;
}

const metadataFiles = listMetadataFiles(publishedDir);
let count = 0;

for (const metaFile of metadataFiles) {
  const relPath = path.relative(publishedDir, path.dirname(metaFile)).replace(/\\/g, '/');
  
  // Skip PyBioNetGen internal files
  if (relPath.startsWith('PyBioNetGen')) {
    continue;
  }
  
  // Find key in mapping
  const newId = ID_MAP[relPath];
  if (newId) {
    if (updateMetadataId(metaFile, newId)) {
      count++;
    }
  } else {
    console.log(`No explicit mapping for ${relPath}, skipped.`);
  }
}

console.log(`\nSuccessfully updated ${count} metadata files in Published/!`);
