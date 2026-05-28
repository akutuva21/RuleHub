const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { validateMetadataFile, expectString } = require('../scripts/validate-metadata');

async function withTempDir(testFn) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-metadata-test-'));
  try {
    await testFn(tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

test('validateMetadataFile is imported correctly', () => {
  assert.strictEqual(typeof validateMetadataFile, 'function');
});

const VALID_METADATA_YAML = `
id: "test-model"
name: "Test Model"
description: "A test model"
tags:
  - test
  - mock
category: "other"
compatibility:
  bng2_compatible: true
  uses_compartments: false
  uses_energy: false
  uses_functions: true
  nfsim_compatible: false
  simulation_methods: [ode, ssa]
source:
  origin: "published"
  original_repository: "https://github.com/example/repo"
playground:
  visible: true
  gallery_category: "Test"
  featured: false
  difficulty: "beginner"
`;

test('valid metadata file passes validation without errors', async () => {
  await withTempDir(async (tempDir) => {
    const metadataFile = path.join(tempDir, 'metadata.yaml');
    fs.writeFileSync(metadataFile, VALID_METADATA_YAML);
    fs.writeFileSync(path.join(tempDir, 'README.md'), '# Test Model');
    fs.writeFileSync(path.join(tempDir, 'testmodel.bngl'), 'begin model\nend model');

    const errors = [];
    await validateMetadataFile(metadataFile, errors);

    assert.deepStrictEqual(errors, []);
  });
});

test('invalid enum values for expectEnum fields add errors', async () => {
  await withTempDir(async (tempDir) => {
    const metadataFile = path.join(tempDir, 'metadata.yaml');

    // Test with wrong types (e.g. number, boolean, null instead of string)
    const invalidTypeYaml = `
id: "test-model"
name: "Test Model"
description: "A test model"
tags: []
category: 123
compatibility:
  bng2_compatible: true
  uses_compartments: false
  uses_energy: false
  uses_functions: true
  nfsim_compatible: false
  simulation_methods: [ode]
source:
  origin: true
  original_repository: "repo"
playground:
  visible: true
  gallery_category: "Test"
  featured: false
  difficulty: null
collection:
  type: 456
  parent_model: "test-model"
  variant_key: "test"
  count: 2
`;
    fs.writeFileSync(metadataFile, invalidTypeYaml);
    fs.writeFileSync(path.join(tempDir, 'README.md'), '# Test Model');
    fs.writeFileSync(path.join(tempDir, 'model1.bngl'), '');
    fs.writeFileSync(path.join(tempDir, 'model2.bngl'), '');

    let errors = [];
    await validateMetadataFile(metadataFile, errors);

    assert.ok(errors.some(e => e.includes('invalid category (123)')), 'Should report invalid category type');
    assert.ok(errors.some(e => e.includes('invalid source.origin (true)')), 'Should report invalid origin type');
    assert.ok(errors.some(e => e.includes('invalid playground.difficulty (null)')), 'Should report invalid difficulty type');
    assert.ok(errors.some(e => e.includes('invalid collection.type (456)')), 'Should report invalid collection type');

    // Test with string values not in the allowed sets
    const invalidStringYaml = `
id: "test-model"
name: "Test Model"
description: "A test model"
tags: []
category: "not-a-real-category"
compatibility:
  bng2_compatible: true
  uses_compartments: false
  uses_energy: false
  uses_functions: true
  nfsim_compatible: false
  simulation_methods: [ode]
source:
  origin: "fake-origin"
  original_repository: "repo"
playground:
  visible: true
  gallery_category: "Test"
  featured: false
  difficulty: "extremely-hard"
collection:
  type: "unknown-collection-type"
  parent_model: "test-model"
  variant_key: "test"
  count: 2
`;
    fs.writeFileSync(metadataFile, invalidStringYaml);

    errors = [];
    await validateMetadataFile(metadataFile, errors);

    assert.ok(errors.some(e => e.includes('invalid category ("not-a-real-category")')), 'Should report invalid category string');
    assert.ok(errors.some(e => e.includes('invalid source.origin ("fake-origin")')), 'Should report invalid origin string');
    assert.ok(errors.some(e => e.includes('invalid playground.difficulty ("extremely-hard")')), 'Should report invalid difficulty string');
    assert.ok(errors.some(e => e.includes('invalid collection.type ("unknown-collection-type")')), 'Should report invalid collection type string');
  });
});

test('missing README.md adds error', async () => {
  await withTempDir(async (tempDir) => {
    const metadataFile = path.join(tempDir, 'metadata.yaml');
    fs.writeFileSync(metadataFile, VALID_METADATA_YAML);
    fs.writeFileSync(path.join(tempDir, 'testmodel.bngl'), 'begin model\nend model');

    const errors = [];
    await validateMetadataFile(metadataFile, errors);

    assert.strictEqual(errors.length, 1);
    assert.match(errors[0], /missing README\.md/);
  });
});

test('missing .bngl file adds error', async () => {
  await withTempDir(async (tempDir) => {
    const metadataFile = path.join(tempDir, 'metadata.yaml');
    fs.writeFileSync(metadataFile, VALID_METADATA_YAML);
    fs.writeFileSync(path.join(tempDir, 'README.md'), '# Test Model');

    const errors = [];
    await validateMetadataFile(metadataFile, errors);

    assert.strictEqual(errors.length, 1);
    assert.match(errors[0], /no \.bngl files found alongside metadata\.yaml/);
  });
});

test('invalid metadata structure adds errors', async () => {
  await withTempDir(async (tempDir) => {
    const metadataFile = path.join(tempDir, 'metadata.yaml');
    const invalidYaml = `
id: "test-model"
# missing name and description
category: "invalid-category"
# missing source, playground, and compatibility
`;
    fs.writeFileSync(metadataFile, invalidYaml);
    fs.writeFileSync(path.join(tempDir, 'README.md'), '# Test Model');
    fs.writeFileSync(path.join(tempDir, 'testmodel.bngl'), 'begin model\nend model');

    const errors = [];
    await validateMetadataFile(metadataFile, errors);

    assert.ok(errors.length > 0);
    assert.ok(errors.some(e => e.includes('missing or invalid name')));
    assert.ok(errors.some(e => e.includes('missing or invalid description')));
    assert.ok(errors.some(e => e.includes('invalid category ("invalid-category")')));
    assert.ok(errors.some(e => e.includes('missing compatibility section')));
    assert.ok(errors.some(e => e.includes('missing source section')));
    assert.ok(errors.some(e => e.includes('missing playground section')));
  });
});

test('multiple models without collection adds error if no primary model', async () => {
  await withTempDir(async (tempDir) => {
    const metadataFile = path.join(tempDir, 'metadata.yaml');
    fs.writeFileSync(metadataFile, VALID_METADATA_YAML); // id: "test-model"
    fs.writeFileSync(path.join(tempDir, 'README.md'), '# Test Model');
    // none of these match "test-model"
    fs.writeFileSync(path.join(tempDir, 'othermodel1.bngl'), 'begin model\nend model');
    fs.writeFileSync(path.join(tempDir, 'othermodel2.bngl'), 'begin model\nend model');

    const errors = [];
    await validateMetadataFile(metadataFile, errors);

    assert.strictEqual(errors.length, 1);
    assert.match(errors[0], /multiple \.bngl files require either a collection section or a primary model file/);
  });
});

test('multiple models with collection valid count', async () => {
  await withTempDir(async (tempDir) => {
    const metadataFile = path.join(tempDir, 'metadata.yaml');
    const collectionYaml = VALID_METADATA_YAML + `
collection:
  type: "parameter-fit-variants"
  parent_model: "test-model"
  variant_key: "test"
  count: 2
`;
    fs.writeFileSync(metadataFile, collectionYaml);
    fs.writeFileSync(path.join(tempDir, 'README.md'), '# Test Model');
    fs.writeFileSync(path.join(tempDir, 'model1.bngl'), '');
    fs.writeFileSync(path.join(tempDir, 'model2.bngl'), '');

    const errors = [];
    await validateMetadataFile(metadataFile, errors);

    assert.deepStrictEqual(errors, []);
  });
});


test('expectString correctly validates string values', () => {
  const label = 'test_label';
  const filePath = 'test.yaml';

  // Happy paths
  let errors = [];
  expectString(errors, 'valid string', label, filePath);
  assert.deepStrictEqual(errors, [], 'Should not add error for valid string');

  errors = [];
  expectString(errors, '  valid string with spaces  ', label, filePath);
  assert.deepStrictEqual(errors, [], 'Should not add error for valid string with spaces');

  // Edge cases - Empty or whitespace only
  errors = [];
  expectString(errors, '', label, filePath);
  assert.strictEqual(errors.length, 1, 'Should add error for empty string');
  assert.match(errors[0], /test\.yaml: missing or invalid test_label/);

  errors = [];
  expectString(errors, '   ', label, filePath);
  assert.strictEqual(errors.length, 1, 'Should add error for whitespace-only string');
  assert.match(errors[0], /test\.yaml: missing or invalid test_label/);

  // Invalid types
  const invalidInputs = [null, undefined, 123, true, false, {}, []];
  for (const input of invalidInputs) {
    errors = [];
    expectString(errors, input, label, filePath);
    assert.strictEqual(errors.length, 1, `Should add error for ${typeof input} input`);
    assert.match(errors[0], /test\.yaml: missing or invalid test_label/);
  }
});
