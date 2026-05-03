const test = require('node:test');
const assert = require('node:assert');
const { parseMetadataYaml, listMetadataFiles } = require('./validate-metadata.js');

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
    assert.deepStrictEqual(JSON.parse(JSON.stringify(result)), {
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
    assert.deepStrictEqual(JSON.parse(JSON.stringify(result)), {
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
    assert.deepStrictEqual(JSON.parse(JSON.stringify(result)), {
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
    assert.deepStrictEqual(JSON.parse(JSON.stringify(result)), {
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
    assert.deepStrictEqual(JSON.parse(JSON.stringify(result)), {
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
    assert.deepStrictEqual(JSON.parse(JSON.stringify(result)), {
      id: 'empty-tags',
      tags: []
    });
  });
});

test('listMetadataFiles', async (t) => {
  await t.test('returns empty array for non-existent directory', () => {
    const nonExistentPath = '/path/that/does/not/exist/for/sure/12345';
    const result = listMetadataFiles(nonExistentPath);
    assert.deepStrictEqual(result, []);
  });
});
