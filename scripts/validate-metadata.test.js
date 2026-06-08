const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { parseMetadataYaml, listMetadataFiles, setNested, expectString, expectBoolean, normalizeModelKey, validateMetadataFile } = require('./validate-metadata.js');

test('setNested', async (t) => {
  await t.test('sets a single property', () => {
    const obj = {};
    setNested(obj, 'a', 1);
    assert.deepEqual(obj, { a: 1 });
  });

  await t.test('sets a nested property', () => {
    const obj = {};
    setNested(obj, 'a.b.c', 2);
    assert.deepEqual(obj, { a: { b: { c: 2 } } });
  });

  await t.test('adds to an existing object structure', () => {
    const obj = { a: { x: 1 } };
    setNested(obj, 'a.y', 2);
    assert.deepEqual(obj, { a: { x: 1, y: 2 } });
  });

  await t.test('overrides non-object intermediates', () => {
    const obj = { a: 1 };
    setNested(obj, 'a.b', 2);
    assert.deepEqual(obj, { a: { b: 2 } });
  });

  await t.test('blocks prototype pollution (__proto__)', () => {
    const obj = {};
    setNested(obj, '__proto__.polluted', true);
    assert.strictEqual({}.polluted, undefined);
    assert.deepEqual(obj, {});
  });

  await t.test('blocks prototype pollution (constructor)', () => {
    const obj = {};
    setNested(obj, 'constructor.prototype.polluted', true);
    assert.strictEqual({}.polluted, undefined);
    assert.deepEqual(obj, {});
  });

  await t.test('blocks prototype pollution (prototype)', () => {
    const obj = {};
    setNested(obj, 'prototype.polluted', true);
    assert.strictEqual({}.polluted, undefined);
    assert.deepEqual(obj, {});
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
    assert.deepEqual(result, {
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
    assert.deepEqual(result, {
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
    assert.deepEqual(result, {
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
    assert.deepEqual(result, {
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
    assert.deepEqual(result, {
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
    assert.deepEqual(result, {
      id: 'empty-tags',
      tags: []
    });
  });

  await t.test('ignores invalid lines without colons', () => {
    const yaml = `
id: my-model
this line has no colon and should be ignored
name: valid
    `;
    const result = parseMetadataYaml(yaml);
    assert.deepEqual(result, { id: 'my-model', name: 'valid' });
  });

  await t.test('handles windows CR LF line endings', () => {
    const yaml = "id: windows\r\nname: test\r\n";
    const result = parseMetadataYaml(yaml);
    assert.deepEqual(result, { id: 'windows', name: 'test' });
  });

  await t.test('handles un-indenting multiple levels at once', () => {
    const yaml = `
a:
  b:
    c:
      d: 1
e: 2
    `;
    const result = parseMetadataYaml(yaml);
    assert.deepEqual(result, { a: { b: { c: { d: 1 } } }, e: 2 });
  });

  await t.test('blocks prototype pollution keys', () => {
    const yaml = `
__proto__:
  polluted: true
constructor:
  polluted: true
prototype:
  polluted: true
normal: safe
    `;
    const result = parseMetadataYaml(yaml);
    assert.deepEqual(result, { normal: 'safe' });
  });

  await t.test('ignores list items not under tags', () => {
    const yaml = `
id: my-model
not_tags:
  - item1
  - item2
tags:
  - tag1
    `;
    const result = parseMetadataYaml(yaml);
    assert.deepEqual(result, { id: 'my-model', tags: ['tag1'] });
  });

  await t.test('parses various scalar types correctly', () => {
    const yaml = `
boolTrue: true
boolFalse: false
nullVal: null
posInt: 42
negInt: -42
inlineArray: [a, b, "c", d]
quotedStr: "hello"
normalStr: world
    `;
    const result = parseMetadataYaml(yaml);
    assert.deepEqual(result, {
      boolTrue: true,
      boolFalse: false,
      nullVal: null,
      posInt: 42,
      negInt: -42,
      inlineArray: ['a', 'b', 'c', 'd'],
      quotedStr: 'hello',
      normalStr: 'world'
    });
  });

  await t.test('does not pollute prototype when deeply nesting', () => {
    const yaml = `
a:
  __proto__:
    polluted: true
  constructor:
    polluted: true
  prototype:
    polluted: true
  safe: true
    `;
    const result = parseMetadataYaml(yaml);
    assert.deepEqual(result, { a: { safe: true } });
  });

  await t.test('handles creating nested object when parent is primitive or array', () => {
    const yaml = `
a: 1
a:
  b: 2
c:
  - item
c:
  d: 3
    `;
    const result = parseMetadataYaml(yaml);
    // Since 'a' was primitive, setNested overwrites it with {} then adds 'b: 2'
    assert.deepEqual(result, { a: { b: 2 }, c: { d: 3 } });
  });

  await t.test('handles existing tags logic', () => {
    const yaml = `
tags:
  - one
  - two
    `;
    const result = parseMetadataYaml(yaml);
    assert.deepEqual(result, { tags: ['one', 'two'] });
  });
});

test('expectString', async (t) => {
  await t.test('appends error if value is not a string', () => {
    const errors = [];
    expectString(errors, 123, 'label', 'file.txt');
    assert.deepStrictEqual(errors, ['file.txt: missing or invalid label']);
  });

  await t.test('appends error if value is null', () => {
    const errors = [];
    expectString(errors, null, 'label', 'file.txt');
    assert.deepStrictEqual(errors, ['file.txt: missing or invalid label']);
  });

  await t.test('appends error if string is empty', () => {
    const errors = [];
    expectString(errors, '', 'label', 'file.txt');
    assert.deepStrictEqual(errors, ['file.txt: missing or invalid label']);
  });

  await t.test('appends error if string is only whitespace', () => {
    const errors = [];
    expectString(errors, '   \n  ', 'label', 'file.txt');
    assert.deepStrictEqual(errors, ['file.txt: missing or invalid label']);
  });

  await t.test('does not append error for valid string', () => {
    const errors = [];
    expectString(errors, 'valid string', 'label', 'file.txt');
    assert.deepStrictEqual(errors, []);
  });
});

test('expectBoolean', async (t) => {
  await t.test('appends error if value is not a boolean (number)', () => {
    const errors = [];
    expectBoolean(errors, 123, 'label', 'file.txt');
    assert.deepStrictEqual(errors, ['file.txt: missing or invalid label']);
  });

  await t.test('appends error if value is not a boolean (string)', () => {
    const errors = [];
    expectBoolean(errors, 'true', 'label', 'file.txt');
    assert.deepStrictEqual(errors, ['file.txt: missing or invalid label']);
  });

  await t.test('appends error if value is null', () => {
    const errors = [];
    expectBoolean(errors, null, 'label', 'file.txt');
    assert.deepStrictEqual(errors, ['file.txt: missing or invalid label']);
  });

  await t.test('appends error if value is undefined', () => {
    const errors = [];
    expectBoolean(errors, undefined, 'label', 'file.txt');
    assert.deepStrictEqual(errors, ['file.txt: missing or invalid label']);
  });

  await t.test('does not append error for valid boolean true', () => {
    const errors = [];
    expectBoolean(errors, true, 'label', 'file.txt');
    assert.deepStrictEqual(errors, []);
  });

  await t.test('does not append error for valid boolean false', () => {
    const errors = [];
    expectBoolean(errors, false, 'label', 'file.txt');
    assert.deepStrictEqual(errors, []);
  });
});

test('listMetadataFiles', async (t) => {
  await t.test('returns empty array for non-existent directory', async () => {
    const nonExistentPath = '/path/that/does/not/exist/for/sure/12345';
    const result = await listMetadataFiles(nonExistentPath);
    assert.deepStrictEqual(result, []);
  });
});

test('normalizeModelKey', async (t) => {
  await t.test('handles falsy values', () => {
    assert.strictEqual(normalizeModelKey(null), '');
    assert.strictEqual(normalizeModelKey(undefined), '');
    assert.strictEqual(normalizeModelKey(''), '');
    assert.strictEqual(normalizeModelKey(0), '');
    assert.strictEqual(normalizeModelKey(false), '');
    assert.strictEqual(normalizeModelKey(NaN), '');
  });

  await t.test('handles non-string values', () => {
    assert.strictEqual(normalizeModelKey(123), '123');
    assert.strictEqual(normalizeModelKey(true), 'true');
    assert.strictEqual(normalizeModelKey([1, 2]), '1-2');
    assert.strictEqual(normalizeModelKey({}), 'object-object');
  });

  await t.test('handles strings with only non-alphanumeric characters', () => {
    assert.strictEqual(normalizeModelKey('!!!'), '');
    assert.strictEqual(normalizeModelKey('---'), '');
    assert.strictEqual(normalizeModelKey('   '), '');
  });

  await t.test('handles single character strings', () => {
    assert.strictEqual(normalizeModelKey('a'), 'a');
    assert.strictEqual(normalizeModelKey('1'), '1');
    assert.strictEqual(normalizeModelKey('-'), '');
    assert.strictEqual(normalizeModelKey('_'), '');
  });

  await t.test('handles standard strings', () => {
    assert.strictEqual(normalizeModelKey('model'), 'model');
    assert.strictEqual(normalizeModelKey('simplemodel'), 'simplemodel');
  });

  await t.test('replaces non-alphanumeric characters with hyphens', () => {
    assert.strictEqual(normalizeModelKey('model_1-2!3'), 'model-1-2-3');
    assert.strictEqual(normalizeModelKey('some model name'), 'some-model-name');
    assert.strictEqual(normalizeModelKey('a.b,c:d;e/f'), 'a-b-c-d-e-f');
  });

  await t.test('trims leading and trailing hyphens', () => {
    assert.strictEqual(normalizeModelKey('__model__'), 'model');
    assert.strictEqual(normalizeModelKey('--model--'), 'model');
    assert.strictEqual(normalizeModelKey('  model  '), 'model');
    assert.strictEqual(normalizeModelKey('!, model.,!'), 'model');
  });

  await t.test('converts to lowercase', () => {
    assert.strictEqual(normalizeModelKey('Model1'), 'model1');
    assert.strictEqual(normalizeModelKey('SOME_MODEL'), 'some-model');
    assert.strictEqual(normalizeModelKey('MiXeD'), 'mixed');
  });
});

test('listMetadataFiles', async (t) => {
  await t.test('returns empty array for non-existent directory', async () => {
    const nonExistentPath = '/path/that/does/not/exist/for/sure/12345';
    const result = await listMetadataFiles(nonExistentPath);
    assert.deepStrictEqual(result, []);
  });
});

test('listMetadataFiles', async (t) => {
  await t.test('returns empty array for non-existent directory', async () => {
    const nonExistentPath = '/path/that/does/not/exist/for/sure/12345';
    const result = await listMetadataFiles(nonExistentPath);
    assert.deepStrictEqual(result, []);
  });
});

test('setNested', async (t) => {
  await t.test('sets single-level property', () => {
    const obj = {};
    setNested(obj, 'a', 1);
    assert.deepEqual(obj, { a: 1 });
  });

  await t.test('sets multi-level property', () => {
    const obj = {};
    setNested(obj, 'a.b.c', 123);
    assert.deepEqual(obj, { a: { b: { c: 123 } } });
  });

  await t.test('overrides primitive value with object', () => {
    const obj = { a: 'hello' };
    setNested(obj, 'a.b.c', 123);
    assert.deepEqual(obj, { a: { b: { c: 123 } } });
  });

  await t.test('overrides array value with object', () => {
    const obj = { a: [1, 2, 3] };
    setNested(obj, 'a.b.c', 123);
    assert.deepEqual(obj, { a: { b: { c: 123 } } });
  });

  await t.test('prevents __proto__ pollution', () => {
    const obj = {};
    setNested(obj, '__proto__.polluted', 'yes');
    assert.strictEqual({}.polluted, undefined);
    assert.deepEqual(obj, {});
  });

  await t.test('prevents constructor pollution', () => {
    const obj = {};
    setNested(obj, 'constructor.prototype.polluted', 'yes');
    assert.strictEqual({}.polluted, undefined);
    assert.deepEqual(obj, {});
  });

  await t.test('prevents prototype pollution', () => {
    const obj = {};
    setNested(obj, 'prototype.polluted', 'yes');
    assert.strictEqual({}.polluted, undefined);
    assert.deepEqual(obj, {});
  });
});

test('listMetadataFiles', async (t) => {
  await t.test('returns empty array for non-existent directory', async () => {
    const nonExistentPath = '/path/that/does/not/exist/for/sure/12345';
    const result = await listMetadataFiles(nonExistentPath);
    assert.deepStrictEqual(result, []);
  });
});

test('listMetadataFiles', async (t) => {
  await t.test('returns empty array for non-existent directory', async () => {
    const nonExistentPath = '/path/that/does/not/exist/for/sure/12345';
    const result = await listMetadataFiles(nonExistentPath);
    assert.deepStrictEqual(result, []);
  });
});

test('listMetadataFiles', async (t) => {
  await t.test('returns empty array for non-existent directory', async () => {
    const nonExistentPath = '/path/that/does/not/exist/for/sure/12345';
    const result = await listMetadataFiles(nonExistentPath);
    assert.deepStrictEqual(result, []);
  });
});

test('listMetadataFiles', async (t) => {
  await t.test('returns empty array for non-existent directory', async () => {
    const nonExistentPath = '/path/that/does/not/exist/for/sure/12345';
    const result = await listMetadataFiles(nonExistentPath);
    assert.deepStrictEqual(result, []);
  });
});

test('listMetadataFiles', async (t) => {
  await t.test('returns empty array for non-existent directory', async () => {
    const nonExistentPath = '/path/that/does/not/exist/for/sure/12345';
    const result = await listMetadataFiles(nonExistentPath);
    assert.deepStrictEqual(result, []);
  });
});

test('listMetadataFiles', async (t) => {
  await t.test('returns empty array for non-existent directory', async () => {
    const nonExistentPath = '/path/that/does/not/exist/for/sure/12345';
    const result = await listMetadataFiles(nonExistentPath);
    assert.deepStrictEqual(result, []);
  });
});

test('validateMetadataFile', async (t) => {
  let tempDir;

  t.beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-metadata-test-'));
  });

  t.afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const validYaml = `
id: my-model
name: My Model
description: Valid model
tags: [tag1]
category: physics
compatibility:
  bng2_compatible: true
  uses_compartments: false
  uses_energy: false
  uses_functions: false
  nfsim_compatible: false
source:
  origin: published
playground:
  visible: true
  featured: false
  difficulty: beginner
  `;

  await t.test('validates a correct metadata file', async () => {
    const metadataFile = path.join(tempDir, 'metadata.yaml');
    fs.writeFileSync(metadataFile, validYaml);
    fs.writeFileSync(path.join(tempDir, 'README.md'), '# My Model');
    fs.writeFileSync(path.join(tempDir, 'model.bngl'), 'begin model');

    const errors = [];
    await validateMetadataFile(metadataFile, errors);
    assert.deepStrictEqual(errors, []);
  });

  await t.test('reports missing README.md', async () => {
    const metadataFile = path.join(tempDir, 'metadata.yaml');
    fs.writeFileSync(metadataFile, validYaml);
    fs.writeFileSync(path.join(tempDir, 'model.bngl'), 'begin model');

    const errors = [];
    await validateMetadataFile(metadataFile, errors);
    assert.strictEqual(errors.length, 1);
    assert.match(errors[0], /missing README\.md/);
  });

  await t.test('reports missing .bngl files', async () => {
    const metadataFile = path.join(tempDir, 'metadata.yaml');
    fs.writeFileSync(metadataFile, validYaml);
    fs.writeFileSync(path.join(tempDir, 'README.md'), '# My Model');

    const errors = [];
    await validateMetadataFile(metadataFile, errors);
    assert.strictEqual(errors.length, 1);
    assert.match(errors[0], /no \.bngl files found/);
  });

  await t.test('reports invalid category', async () => {
    const invalidCategoryYaml = validYaml.replace('category: physics', 'category: not-a-real-category');
    const metadataFile = path.join(tempDir, 'metadata.yaml');
    fs.writeFileSync(metadataFile, invalidCategoryYaml);
    fs.writeFileSync(path.join(tempDir, 'README.md'), '# My Model');
    fs.writeFileSync(path.join(tempDir, 'model.bngl'), 'begin model');

    const errors = [];
    await validateMetadataFile(metadataFile, errors);
    assert.strictEqual(errors.length, 1);
    assert.match(errors[0], /invalid category/);
  });

  await t.test('reports missing compatibility section', async () => {
    const noCompatibilityYaml = validYaml.replace(/compatibility:[\s\S]*?source:/, 'source:');
    const metadataFile = path.join(tempDir, 'metadata.yaml');
    fs.writeFileSync(metadataFile, noCompatibilityYaml);
    fs.writeFileSync(path.join(tempDir, 'README.md'), '# My Model');
    fs.writeFileSync(path.join(tempDir, 'model.bngl'), 'begin model');

    const errors = [];
    await validateMetadataFile(metadataFile, errors);
    assert.ok(errors.some(e => e.includes('missing compatibility section')));
  });

  await t.test('reports invalid playground section', async () => {
    const invalidPlaygroundYaml = validYaml.replace('playground:\n  visible: true', 'playground:\n  visible: "yes"');
    const metadataFile = path.join(tempDir, 'metadata.yaml');
    fs.writeFileSync(metadataFile, invalidPlaygroundYaml);
    fs.writeFileSync(path.join(tempDir, 'README.md'), '# My Model');
    fs.writeFileSync(path.join(tempDir, 'model.bngl'), 'begin model');

    const errors = [];
    await validateMetadataFile(metadataFile, errors);
    assert.ok(errors.some(e => e.includes('missing or invalid playground.visible')));
  });

  await t.test('reports missing source section', async () => {
    const noSourceYaml = validYaml.replace(/source:[\s\S]*?playground:/, 'playground:');
    const metadataFile = path.join(tempDir, 'metadata.yaml');
    fs.writeFileSync(metadataFile, noSourceYaml);
    fs.writeFileSync(path.join(tempDir, 'README.md'), '# My Model');
    fs.writeFileSync(path.join(tempDir, 'model.bngl'), 'begin model');

    const errors = [];
    await validateMetadataFile(metadataFile, errors);
    assert.ok(errors.some(e => e.includes('missing source section')));
  });

  await t.test('reports collection errors', async () => {
    const collectionYaml = validYaml + '\ncollection:\n  type: parameter-fit-variants\n  count: 2\n';
    const metadataFile = path.join(tempDir, 'metadata.yaml');
    fs.writeFileSync(metadataFile, collectionYaml);
    fs.writeFileSync(path.join(tempDir, 'README.md'), '# My Model');
    fs.writeFileSync(path.join(tempDir, 'model.bngl'), 'begin model');

    const errors = [];
    await validateMetadataFile(metadataFile, errors);
    assert.ok(errors.some(e => e.includes('but found 1 model files')));
  });
});
