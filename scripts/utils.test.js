const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { listModelFiles, parseScalar, safeJoin } = require('./utils.js');

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

test('safeJoin', async (t) => {
  await t.test('joins valid paths safely', () => {
    assert.strictEqual(safeJoin('/var/www', 'html'), path.join('/var/www', 'html'));
    assert.strictEqual(safeJoin('/var/www/', 'html'), path.join('/var/www/', 'html'));
    assert.strictEqual(safeJoin('var/www', 'html/index.js'), path.join('var/www', 'html/index.js'));
    assert.strictEqual(safeJoin('/var/www', '.'), path.join('/var/www', '.'));
    assert.strictEqual(safeJoin('/var/www', ''), path.join('/var/www', ''));
    assert.strictEqual(safeJoin('/var/www', 'a/b/../c'), path.join('/var/www', 'a/b/../c'));
  });

  await t.test('throws on path traversal attempts', () => {
    assert.throws(() => safeJoin('/var/www', '..'), /Path traversal security risk detected/);
    assert.throws(() => safeJoin('/var/www', '../etc/passwd'), /Path traversal security risk detected/);
    assert.throws(() => safeJoin('/var/www', '../../etc/passwd'), /Path traversal security risk detected/);
    assert.throws(() => safeJoin('var/www', '../www2'), /Path traversal security risk detected/);
    assert.throws(() => safeJoin('/var/www', '/../etc/passwd'), /Path traversal security risk detected/);
  });
});
