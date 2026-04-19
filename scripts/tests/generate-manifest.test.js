const { test } = require('node:test');
const assert = require('node:assert');
const { setNested } = require('../generate-manifest.js');

test('setNested', async (t) => {
  await t.test('sets normal nested value', () => {
    const target = {};
    setNested(target, ['a', 'b', 'c'], 42);
    assert.deepStrictEqual(target, { a: { b: { c: 42 } } });
  });

  await t.test('sets value where intermediate keys already exist', () => {
    const target = { a: { d: 10 } };
    setNested(target, ['a', 'b', 'c'], 42);
    assert.deepStrictEqual(target, { a: { d: 10, b: { c: 42 } } });
  });

  await t.test('overrides a non-object intermediate key', () => {
    const target = { a: 10 };
    setNested(target, ['a', 'b', 'c'], 42);
    assert.deepStrictEqual(target, { a: { b: { c: 42 } } });
  });

  await t.test('overrides an array intermediate key', () => {
    const target = { a: [1, 2, 3] };
    setNested(target, ['a', 'b', 'c'], 42);
    assert.deepStrictEqual(target, { a: { b: { c: 42 } } });
  });

  await t.test('prevents prototype pollution - __proto__', () => {
    const target = {};
    setNested(target, ['__proto__', 'polluted'], true);
    assert.strictEqual({}.polluted, undefined);
  });

  await t.test('prevents prototype pollution - constructor', () => {
    const target = {};
    setNested(target, ['constructor', 'prototype', 'polluted'], true);
    assert.strictEqual({}.polluted, undefined);
  });

  await t.test('prevents prototype pollution - prototype', () => {
    const target = {};
    setNested(target, ['prototype', 'polluted'], true);
    assert.strictEqual({}.polluted, undefined);
  });
});
