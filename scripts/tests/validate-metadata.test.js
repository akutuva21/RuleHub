const { test } = require('node:test');
const assert = require('node:assert');
const { parseScalar, normalizeModelKey, expectArray, expectEnum } = require('../validate-metadata.js');

test('parseScalar', async (t) => {
  await t.test('parses boolean strings', () => {
    assert.strictEqual(parseScalar('true'), true);
    assert.strictEqual(parseScalar('false'), false);
    assert.strictEqual(parseScalar('  true  '), true);
  });

  await t.test('parses null string', () => {
    assert.strictEqual(parseScalar('null'), null);
    assert.strictEqual(parseScalar(' null  '), null);
  });

  await t.test('parses numeric strings', () => {
    assert.strictEqual(parseScalar('42'), 42);
    assert.strictEqual(parseScalar('-10'), -10);
    assert.strictEqual(parseScalar('0'), 0);
    assert.strictEqual(parseScalar('  123  '), 123);
  });

  await t.test('parses array representations', () => {
    assert.deepStrictEqual(parseScalar('[]'), []);
    assert.deepStrictEqual(parseScalar('[a, b]'), ['a', 'b']);
    assert.deepStrictEqual(parseScalar('["a", "b"]'), ['a', 'b']);
    assert.deepStrictEqual(parseScalar(' [ 1 , 2 ] '), ['1', '2']);
  });

  await t.test('parses double-quoted strings', () => {
    assert.strictEqual(parseScalar('"hello"'), 'hello');
    assert.strictEqual(parseScalar(' "world" '), 'world');
  });

  await t.test('falls back to plain strings', () => {
    assert.strictEqual(parseScalar('hello'), 'hello');
    assert.strictEqual(parseScalar('12.34'), '12.34'); // doesn't parse as int
    assert.strictEqual(parseScalar(''), '');
  });
});

test('normalizeModelKey', async (t) => {
  await t.test('replaces non-alphanumeric with hyphens', () => {
    assert.strictEqual(normalizeModelKey('model.bngl'), 'model-bngl');
    assert.strictEqual(normalizeModelKey('Model.BNGL'), 'model-bngl');
    assert.strictEqual(normalizeModelKey('model.bngl.bngl'), 'model-bngl-bngl');
  });

  await t.test('collapses non-alphanumeric sequences into single hyphens', () => {
    assert.strictEqual(normalizeModelKey('my-model-123'), 'my-model-123');
    assert.strictEqual(normalizeModelKey('model_name!@#'), 'model-name');
    assert.strictEqual(normalizeModelKey('Some Model Name'), 'some-model-name');
  });

  await t.test('converts to lowercase', () => {
    assert.strictEqual(normalizeModelKey('CamelCaseModel'), 'camelcasemodel');
    assert.strictEqual(normalizeModelKey('UPPERCASE'), 'uppercase');
  });

  await t.test('handles empty, null, and undefined values', () => {
    assert.strictEqual(normalizeModelKey(''), '');
    assert.strictEqual(normalizeModelKey(null), ''); // null || '' evaluates to '' -> String('') -> ''
    assert.strictEqual(normalizeModelKey(undefined), ''); // undefined || '' evaluates to '' -> String('') -> ''
  });
});

test('expectArray', async (t) => {
  await t.test('does not add error for arrays', () => {
    const errors = [];
    expectArray(errors, [], 'labels', 'path/to/file');
    assert.deepStrictEqual(errors, []);

    expectArray(errors, ['a', 'b'], 'labels', 'path/to/file');
    assert.deepStrictEqual(errors, []);
  });

  await t.test('adds error for non-arrays', () => {
    const errors = [];
    expectArray(errors, 'not an array', 'labels', 'path/to/file');
    assert.deepStrictEqual(errors, ['path/to/file: missing or invalid labels']);

    expectArray(errors, null, 'tags', 'another/file');
    assert.deepStrictEqual(errors, [
      'path/to/file: missing or invalid labels',
      'another/file: missing or invalid tags'
    ]);

    const errors2 = [];
    expectArray(errors2, {}, 'labels', 'path/to/file');
    expectArray(errors2, undefined, 'labels', 'path/to/file');
    assert.deepStrictEqual(errors2, [
      'path/to/file: missing or invalid labels',
      'path/to/file: missing or invalid labels',
    ]);
  });
});

test('expectEnum', async (t) => {
  const allowed = new Set(['apple', 'banana', 'orange']);
  const label = 'fruit';
  const filePath = 'test.yaml';

  await t.test('does not add error for valid value', () => {
    const errors = [];
    expectEnum(errors, 'banana', allowed, label, filePath);
    assert.deepStrictEqual(errors, []);
  });

  await t.test('adds error for invalid string value', () => {
    const errors = [];
    expectEnum(errors, 'grape', allowed, label, filePath);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0], 'test.yaml: invalid fruit ("grape")');
  });

  await t.test('adds error for non-string values', () => {
    const errors = [];
    expectEnum(errors, 123, allowed, label, filePath);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0], 'test.yaml: invalid fruit (123)');
  });

  await t.test('adds error for boolean values', () => {
    const errors = [];
    expectEnum(errors, true, allowed, label, filePath);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0], 'test.yaml: invalid fruit (true)');
  });

  await t.test('adds error for object values', () => {
    const errors = [];
    expectEnum(errors, { name: 'apple' }, allowed, label, filePath);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0], 'test.yaml: invalid fruit ({"name":"apple"})');
  });

  await t.test('adds error for null value', () => {
    const errors = [];
    expectEnum(errors, null, allowed, label, filePath);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0], 'test.yaml: invalid fruit (null)');
  });

  await t.test('adds error for undefined value', () => {
    const errors = [];
    expectEnum(errors, undefined, allowed, label, filePath);
    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0], 'test.yaml: invalid fruit (undefined)');
  });
});
  });
});
