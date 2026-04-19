const { test } = require('node:test');
const assert = require('node:assert');
const { parseScalar } = require('../utils.js');

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
