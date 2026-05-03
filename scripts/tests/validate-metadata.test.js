const { test } = require('node:test');
const assert = require('node:assert');
const { parseScalar, normalizeModelKey } = require('../validate-metadata.js');

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
  await t.test('removes .bngl extension case-insensitively', () => {
    assert.strictEqual(normalizeModelKey('model.bngl'), 'model');
    assert.strictEqual(normalizeModelKey('Model.BNGL'), 'model');
    assert.strictEqual(normalizeModelKey('model.bngl.bngl'), 'modelbngl');
  });

  await t.test('removes non-alphanumeric characters', () => {
    assert.strictEqual(normalizeModelKey('my-model-123'), 'mymodel123');
    assert.strictEqual(normalizeModelKey('model_name!@#'), 'modelname');
    assert.strictEqual(normalizeModelKey('Some Model Name'), 'somemodelname');
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
