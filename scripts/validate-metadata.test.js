const test = require('node:test');
const assert = require('node:assert');
const { parseMetadataYaml, parseScalar, listMetadataFiles } = require('./validate-metadata.js');

test('parseScalar', async (t) => {
  await t.test('parses booleans', () => {
    assert.strictEqual(parseScalar('true'), true);
    assert.strictEqual(parseScalar('false'), false);
    assert.strictEqual(parseScalar(' true '), true);
  });

  await t.test('parses null', () => {
    assert.strictEqual(parseScalar('null'), null);
  });

  await t.test('parses integers', () => {
    assert.strictEqual(parseScalar('42'), 42);
    assert.strictEqual(parseScalar('-42'), -42);
    assert.strictEqual(parseScalar('0'), 0);
  });

  await t.test('parses arrays', () => {
    assert.deepStrictEqual(parseScalar('[]'), []);
    assert.deepStrictEqual(parseScalar(' [ ] '), []);
    assert.deepStrictEqual(parseScalar('[a, b, c]'), ['a', 'b', 'c']);
    assert.deepStrictEqual(parseScalar('["a", "b", "c"]'), ['a', 'b', 'c']);
  });

  await t.test('parses strings', () => {
    assert.strictEqual(parseScalar('"hello"'), 'hello');
    assert.strictEqual(parseScalar('hello'), 'hello');
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

  await t.test('ignores invalid lines without colons', () => {
    const yaml = `
id: my-model
this line has no colon and should be ignored
name: valid
    `;
    const result = parseMetadataYaml(yaml);
    assert.deepStrictEqual(result, { id: 'my-model', name: 'valid' });
  });

  await t.test('handles windows CR LF line endings', () => {
    const yaml = "id: windows\r\nname: test\r\n";
    const result = parseMetadataYaml(yaml);
    assert.deepStrictEqual(result, { id: 'windows', name: 'test' });
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
    assert.deepStrictEqual(result, { a: { b: { c: { d: 1 } } }, e: 2 });
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
    assert.deepStrictEqual(result, { normal: 'safe' });
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
    assert.deepStrictEqual(result, { id: 'my-model', tags: ['tag1'] });
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
    assert.deepStrictEqual(result, {
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
    assert.deepStrictEqual(result, { a: { safe: true } });
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
    assert.deepStrictEqual(result, { a: { b: 2 }, c: { d: 3 } });
  });

  await t.test('handles existing tags logic', () => {
    const yaml = `
tags:
  - one
  - two
    `;
    const result = parseMetadataYaml(yaml);
    assert.deepStrictEqual(result, { tags: ['one', 'two'] });
  });
});

test('listMetadataFiles', async (t) => {
  await t.test('returns empty array for non-existent directory', () => {
    const nonExistentPath = '/path/that/does/not/exist/for/sure/12345';
    const result = listMetadataFiles(nonExistentPath);
    assert.deepStrictEqual(result, []);
  });
});

test('listMetadataFiles', async (t) => {
  await t.test('returns empty array for non-existent directory', () => {
    const nonExistentPath = '/path/that/does/not/exist/for/sure/12345';
    const result = listMetadataFiles(nonExistentPath);
    assert.deepStrictEqual(result, []);
  });
});
