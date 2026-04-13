const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { buildEntry } = require('./generate-manifest.js');

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
