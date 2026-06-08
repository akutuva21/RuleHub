const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { listModelFiles, parseScalar, parseMetadataYaml } = require('./utils.js');

test('utils.js', async (t) => {
  let tmpDir;

  t.beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bionetgen-utils-test-'));
  });

  t.afterEach(() => {
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  await t.test('parseScalar handles booleans, null, and numbers', () => {
    assert.strictEqual(parseScalar('true'), true);
    assert.strictEqual(parseScalar('false'), false);
    assert.strictEqual(parseScalar('null'), null);
    assert.strictEqual(parseScalar('42'), 42);
    assert.strictEqual(parseScalar('-42'), -42);
  });

  await t.test('parseScalar handles quoted strings', () => {
    assert.strictEqual(parseScalar('"hello"'), 'hello');
    assert.strictEqual(parseScalar('"42"'), '42');
    assert.strictEqual(parseScalar('""'), '');
  });

  await t.test('parseScalar handles simple arrays', () => {
    assert.deepStrictEqual(parseScalar('[]'), []);
    assert.deepStrictEqual(parseScalar('[a]'), ['a']);
    assert.deepStrictEqual(parseScalar('[a, b]'), ['a', 'b']);
    assert.deepStrictEqual(parseScalar('["a", "b"]'), ['a', 'b']);
    assert.deepStrictEqual(parseScalar('[1, 2]'), ['1', '2']);
  });

  await t.test('parseScalar handles array string elements with embedded commas (edge cases)', () => {
    assert.deepStrictEqual(parseScalar('["a, b"]'), ['a', 'b']);
    assert.deepStrictEqual(parseScalar('["a", \'b\']'), ['a', "'b'"]);
    assert.deepStrictEqual(parseScalar('[ "a, b" , "c" ]'), ['a', 'b', 'c']);
  });

  await t.test('listModelFiles returns only .bngl files in alphabetical order', async () => {
    fs.writeFileSync(path.join(tmpDir, 'model2.bngl'), 'content');
    fs.writeFileSync(path.join(tmpDir, 'model1.bngl'), 'content');
    fs.writeFileSync(path.join(tmpDir, 'model3.bngl'), 'content');

    const files = await listModelFiles(tmpDir);
    assert.deepStrictEqual(files, ['model1.bngl', 'model2.bngl', 'model3.bngl']);
  });

  await t.test('listModelFiles ignores directories even if named with .bngl extension', async () => {
    fs.writeFileSync(path.join(tmpDir, 'model1.bngl'), 'content');
    fs.mkdirSync(path.join(tmpDir, 'dir.bngl'));
    fs.mkdirSync(path.join(tmpDir, 'other-dir'));

    const files = await listModelFiles(tmpDir);
    assert.deepStrictEqual(files, ['model1.bngl']);
  });

  await t.test('listModelFiles ignores files with other extensions', async () => {
    fs.writeFileSync(path.join(tmpDir, 'model1.bngl'), 'content');
    fs.writeFileSync(path.join(tmpDir, 'data.txt'), 'content');
    fs.writeFileSync(path.join(tmpDir, 'model2.xml'), 'content');

    const files = await listModelFiles(tmpDir);
    assert.deepStrictEqual(files, ['model1.bngl']);
  });

  await t.test('listModelFiles returns empty array for empty directory', async () => {
    const files = await listModelFiles(tmpDir);
    assert.deepStrictEqual(files, []);
  });
});

test('parseScalar', async (t) => {
  await t.test('handles array edge cases', () => {
    assert.deepStrictEqual(parseScalar('[ ]'), []);
    assert.deepStrictEqual(parseScalar('[ a , b ]'), ['a', 'b']);
    assert.deepStrictEqual(parseScalar('[a, , b]'), ['a', '', 'b']);
  });

  await t.test('handles string edge cases', () => {
    assert.strictEqual(parseScalar('   '), '');
    assert.strictEqual(parseScalar('""'), '');
    assert.strictEqual(parseScalar('" "'), ' ');
    assert.strictEqual(parseScalar('"hello'), '"hello');
    assert.strictEqual(parseScalar('hello"'), 'hello"');
  });

  await t.test('handles bracket edge cases', () => {
    assert.strictEqual(parseScalar('[a, b'), '[a, b');
    assert.strictEqual(parseScalar('a, b]'), 'a, b]');
  });

  await t.test('is case sensitive for booleans', () => {
    assert.strictEqual(parseScalar('True'), 'True');
    assert.strictEqual(parseScalar('FALSE'), 'FALSE');
  });

  await t.test('handles number edge cases by parsing as string', () => {
    assert.strictEqual(parseScalar('1.23'), '1.23');
    assert.strictEqual(parseScalar('-1.23'), '-1.23');
    assert.strictEqual(parseScalar('1e5'), '1e5');
  });
});

test('parseMetadataYaml', async (t) => {
  await t.test('parses simple key-value pairs', () => {
    const content = 'name: Test Model\nversion: 1\nvalid: true';
    const result = parseMetadataYaml(content);
    assert.deepEqual(result, { name: 'Test Model', version: 1, valid: true });
  });

  await t.test('handles nested properties via indentation', () => {
    const content = 'parent:\n  child1: value1\n  child2: 42';
    const result = parseMetadataYaml(content);
    assert.deepEqual(result, { parent: { child1: 'value1', child2: 42 } });
  });

  await t.test('handles lists under tags', () => {
    const content = 'tags:\n  - tag1\n  - tag2';
    const result = parseMetadataYaml(content);
    assert.deepEqual(result, { tags: ['tag1', 'tag2'] });
  });

  await t.test('skips empty lines and comments', () => {
    const content = '\n# This is a comment\n\nname: Model\n\n# Another comment\n';
    const result = parseMetadataYaml(content);
    assert.deepEqual(result, { name: 'Model' });
  });

  await t.test('handles CRLF line endings', () => {
    const content = 'name: Model\r\nversion: 1\r\n';
    const result = parseMetadataYaml(content);
    assert.deepEqual(result, { name: 'Model', version: 1 });
  });

  await t.test('pops the stack when indent decreases', () => {
    const content = 'parent1:\n  child1: val1\nparent2:\n  child2: val2';
    const result = parseMetadataYaml(content);
    assert.deepEqual(result, { parent1: { child1: 'val1' }, parent2: { child2: 'val2' } });
  });

  await t.test('handles multiple levels of nesting', () => {
    const content = 'level1:\n  level2:\n    level3: value\n  level2b: valueb\nlevel1b: value1b';
    const result = parseMetadataYaml(content);
    assert.deepEqual(result, {
      level1: {
        level2: { level3: 'value' },
        level2b: 'valueb'
      },
      level1b: 'value1b'
    });
  });
});
