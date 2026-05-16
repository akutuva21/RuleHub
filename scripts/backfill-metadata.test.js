const assert = require('assert');
const test = require('node:test');
const { formatYamlValue } = require('./backfill-metadata');

test('formatYamlValue', async (t) => {
  await t.test('formats strings correctly', () => {
    assert.strictEqual(formatYamlValue('hello'), 'hello\n');
    assert.strictEqual(formatYamlValue('world', 2), 'world\n');
  });

  await t.test('formats numbers correctly', () => {
    assert.strictEqual(formatYamlValue(42), '42\n');
    assert.strictEqual(formatYamlValue(3.14), '3.14\n');
  });

  await t.test('formats booleans correctly', () => {
    assert.strictEqual(formatYamlValue(true), 'true\n');
    assert.strictEqual(formatYamlValue(false), 'false\n');
  });

  await t.test('formats flat objects correctly', () => {
    const obj = { a: 1, b: 'two' };
    assert.strictEqual(formatYamlValue(obj), 'a: 1\nb: two\n');
    assert.strictEqual(formatYamlValue(obj, 1), 'a: 1\n  b: two\n');
  });

  await t.test('formats nested objects correctly', () => {
    const obj = { a: 1, b: { c: 'two' } };
    assert.strictEqual(formatYamlValue(obj), 'a: 1\n\nb:\nc: two\n\n');
    assert.strictEqual(formatYamlValue(obj, 1), 'a: 1\n  \n  b:\nc: two\n\n');
  });

  await t.test('formats arrays correctly', () => {
    // Current behavior treats array as object with indices as keys
    assert.strictEqual(formatYamlValue([1, 2]), '0: 1\n1: 2\n');
  });

  await t.test('handles undefined correctly', () => {
    assert.strictEqual(formatYamlValue(undefined), 'undefined\n');
  });

  await t.test('handles null correctly', () => {
    assert.strictEqual(formatYamlValue(null), 'null\n');
  });
});
