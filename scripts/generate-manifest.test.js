const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { buildEntry, parseMetadataYaml, listMetadataFiles } = require('./generate-manifest.js');

test('listMetadataFiles', async (t) => {
  let tmpDir;

  t.beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metadata-test-'));
  });

  t.afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  await t.test('returns empty array for non-existent directory', () => {
    const results = listMetadataFiles(path.join(tmpDir, 'non-existent'));
    assert.deepStrictEqual(results, []);
  });

  await t.test('returns empty array when no metadata files exist', () => {
    fs.writeFileSync(path.join(tmpDir, 'somefile.txt'), '');
    const results = listMetadataFiles(tmpDir);
    assert.deepStrictEqual(results, []);
  });

  await t.test('finds metadata.yaml in root directory', () => {
    const yamlPath = path.join(tmpDir, 'metadata.yaml');
    fs.writeFileSync(yamlPath, '');
    const results = listMetadataFiles(tmpDir);
    assert.deepStrictEqual(results, [yamlPath]);
  });

  await t.test('finds metadata.yaml in nested directories', () => {
    const dir1 = path.join(tmpDir, 'dir1');
    const dir2 = path.join(tmpDir, 'dir2');
    fs.mkdirSync(dir1);
    fs.mkdirSync(dir2);

    const yaml1 = path.join(dir1, 'metadata.yaml');
    const yaml2 = path.join(dir2, 'metadata.yaml');

    fs.writeFileSync(yaml1, '');
    fs.writeFileSync(yaml2, '');

    const results = listMetadataFiles(tmpDir);
    assert.strictEqual(results.length, 2);
    assert.ok(results.includes(yaml1));
    assert.ok(results.includes(yaml2));
  });

  await t.test('ignores other files named metadata.yaml if they are directories', () => {
    const fakeYamlDir = path.join(tmpDir, 'metadata.yaml');
    fs.mkdirSync(fakeYamlDir);

    const realYaml = path.join(tmpDir, 'dir1', 'metadata.yaml');
    fs.mkdirSync(path.join(tmpDir, 'dir1'));
    fs.writeFileSync(realYaml, '');

    const results = listMetadataFiles(tmpDir);
    assert.deepStrictEqual(results, [realYaml]);
  });
});

test('buildEntry', async (t) => {
  await t.test('handles a single model with full metadata', () => {
    const root = '/path/to/root';
    const metadataFile = '/path/to/root/Published/ModelA/metadata.yaml';
    const modelFile = 'model_a.bngl';
    const isCollection = false;

    const metadata = {
      id: 'model_a',
      name: 'Model A',
      description: 'A test model',
      tags: ['test', 'model'],
      category: 'validation',
      compatibility: { bng2_compatible: true },
      source: { origin: 'published' },
      playground: { visible: true },
    };

    const entry = buildEntry(root, metadata, metadataFile, modelFile, isCollection);

    assert.strictEqual(entry.id, 'model_a');
    assert.strictEqual(entry.name, 'Model A');
    assert.strictEqual(entry.description, 'A test model');
    // Using string replacement because path.relative varies by platform in tests
    assert.strictEqual(entry.path, 'Published/ModelA/model_a.bngl');
    assert.strictEqual(entry.file, 'model_a.bngl');
    assert.deepStrictEqual(entry.tags, ['test', 'model']);
    assert.strictEqual(entry.category, 'validation');
    assert.strictEqual(entry.bng2_compatible, true);
    assert.strictEqual(entry.origin, 'published');
    assert.strictEqual(entry.visible, true);
    assert.strictEqual(entry.collectionId, null);
  });

  await t.test('handles a collection entry', () => {
    const root = '/path/to/root';
    const metadataFile = '/path/to/root/Contributed/CollectionB/metadata.yaml';
    const modelFile = 'variant_1.bngl';
    const isCollection = true;

    const metadata = {
      id: 'collection_b',
      name: 'Collection B',
      collection: { type: 'parameter-fit-variants' }
    };

    const entry = buildEntry(root, metadata, metadataFile, modelFile, isCollection);

    assert.strictEqual(entry.id, 'variant_1');
    assert.strictEqual(entry.name, 'Collection B - variant_1');
    assert.strictEqual(entry.collectionId, 'collection_b');
  });

  await t.test('handles missing metadata with appropriate fallbacks', () => {
    const root = '/path/to/root';
    const metadataFile = '/path/to/root/Tutorials/ModelC/metadata.yaml';
    const modelFile = 'model_c.bngl';
    const isCollection = false;

    const metadata = {};

    const entry = buildEntry(root, metadata, metadataFile, modelFile, isCollection);

    assert.strictEqual(entry.id, 'model_c');
    assert.strictEqual(entry.name, 'model_c');
    assert.strictEqual(entry.description, '');
    assert.deepStrictEqual(entry.tags, []);
    assert.strictEqual(entry.category, 'other');
    assert.strictEqual(entry.bng2_compatible, false);
    assert.strictEqual(entry.origin, 'other');
    assert.strictEqual(entry.visible, false);
    assert.strictEqual(entry.collectionId, null);
  });

  await t.test('handles partial compatibility and playground metadata', () => {
    const root = '/path/to/root';
    const metadataFile = '/path/to/root/Tutorials/ModelD/metadata.yaml';
    const modelFile = 'model_d.bngl';
    const isCollection = false;

    const metadata = {
        compatibility: {},
        playground: {}
    };

    const entry = buildEntry(root, metadata, metadataFile, modelFile, isCollection);

    assert.strictEqual(entry.bng2_compatible, false);
    assert.strictEqual(entry.visible, false);
  });
});

test('parseMetadataYaml', async (t) => {
  await t.test('parses basic key-value pairs', () => {
    const yaml = `
id: my-model
name: "My Model"
description: A test model
featured: true
count: 42
    `;
    const result = parseMetadataYaml(yaml);
    assert.deepStrictEqual(result, {
      id: 'my-model',
      name: 'My Model',
      description: 'A test model',
      featured: true,
      count: 42
    });
  });

  await t.test('ignores empty lines and comments', () => {
    const yaml = `
# This is a comment
id: model-1

# Another comment

name: test
    `;
    const result = parseMetadataYaml(yaml);
    assert.deepStrictEqual(result, {
      id: 'model-1',
      name: 'test'
    });
  });

  await t.test('parses list arrays (tags)', () => {
    const yaml = `
id: model-tags
tags:
  - biology
  - physics
  - chemistry
    `;
    const result = parseMetadataYaml(yaml);
    assert.deepStrictEqual(result, {
      id: 'model-tags',
      tags: ['biology', 'physics', 'chemistry']
    });
  });

  await t.test('parses nested objects', () => {
    const yaml = `
id: nested-model
compatibility:
  bng2_compatible: true
  simulation_methods: [ode, ssa]
source:
  origin: published
  original_repository: "http://example.com"
    `;
    const result = parseMetadataYaml(yaml);
    assert.deepStrictEqual(result, {
      id: 'nested-model',
      compatibility: {
        bng2_compatible: true,
        simulation_methods: ['ode', 'ssa']
      },
      source: {
        origin: 'published',
        original_repository: 'http://example.com'
      }
    });
  });

  await t.test('parses deeply nested objects', () => {
    const yaml = `
a:
  b:
    c:
      d: value
    `;
    const result = parseMetadataYaml(yaml);
    assert.deepStrictEqual(result, {
      a: {
        b: {
          c: {
            d: 'value'
          }
        }
      }
    });
  });

  await t.test('handles empty tags array', () => {
    const yaml = `
id: empty-tags
tags:
    `;
    const result = parseMetadataYaml(yaml);
    assert.deepStrictEqual(result, {
      id: 'empty-tags',
      tags: []
    });
  });
});
