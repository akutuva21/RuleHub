const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { buildEntry, parseMetadataYaml, parseArgs } = require('./generate-manifest.js');

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

test('parseArgs', async (t) => {
  const defaultRoot = path.resolve(__dirname, '..');

  await t.test('uses default root and output when no args provided', () => {
    const result = parseArgs([]);
    assert.strictEqual(result.root, defaultRoot);
    assert.strictEqual(result.output, path.join(defaultRoot, 'manifest.json'));
  });

  await t.test('parses --root argument', () => {
    const customRoot = path.resolve('/custom/root');
    const result = parseArgs(['--root', '/custom/root']);
    assert.strictEqual(result.root, customRoot);
    assert.strictEqual(result.output, path.join(customRoot, 'manifest.json'));
  });

  await t.test('parses --output argument', () => {
    const customOutput = path.resolve('/custom/output.json');
    const result = parseArgs(['--output', '/custom/output.json']);
    assert.strictEqual(result.root, defaultRoot);
    assert.strictEqual(result.output, customOutput);
  });

  await t.test('parses both --root and --output arguments', () => {
    const customRoot = path.resolve('/custom/root');
    const customOutput = path.resolve('/custom/output.json');
    const result = parseArgs(['--root', '/custom/root', '--output', '/custom/output.json']);
    assert.strictEqual(result.root, customRoot);
    assert.strictEqual(result.output, customOutput);
  });

  await t.test('ignores flags missing a subsequent value', () => {
    const result1 = parseArgs(['--root']);
    assert.strictEqual(result1.root, defaultRoot);
    assert.strictEqual(result1.output, path.join(defaultRoot, 'manifest.json'));

    const result2 = parseArgs(['--output']);
    assert.strictEqual(result2.root, defaultRoot);
    assert.strictEqual(result2.output, path.join(defaultRoot, 'manifest.json'));

  });
});
