const { parseMetadataYaml } = require('./scripts/utils.js');

const yaml = `
id: "example"
name: "Example Model"
description: "A large example metadata file for benchmarking."
tags:
  - signaling
  - metabolism
category: signaling
compatibility:
  bng2_compatible: true
  uses_compartments: false
  uses_energy: true
  uses_functions: false
  nfsim_compatible: true
  simulation_methods:
    - ode
    - ssa
source:
  origin: published
  original_repository: "http://example.com"
playground:
  visible: true
  featured: false
  difficulty: beginner
  gallery_categories:
    - example
collection:
  type: parameter-fit-variants
  parent_model: "parent"
  variant_key: "variant"
  count: 5
`;

// Duplicate the content multiple times to simulate a large file or many files
const largeYaml = yaml.repeat(1000);

const start = process.hrtime.bigint();
for (let i = 0; i < 100; i++) {
    parseMetadataYaml(largeYaml);
}
const end = process.hrtime.bigint();
const durationNs = end - start;
const durationMs = Number(durationNs) / 1e6;

console.log(`Duration: ${durationMs.toFixed(2)} ms`);
