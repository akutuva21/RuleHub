const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { listModelFiles } = require('./utils.js');

test('listModelFiles', async (t) => {
  let tmpDir;

  t.beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'utils-test-'));
  });

  t.afterEach(() => {
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  await t.test('returns an empty array for an empty directory', () => {
    const files = listModelFiles(tmpDir);
    assert.deepStrictEqual(files, []);
  });

  await t.test('returns only .bngl files', () => {
    fs.writeFileSync(path.join(tmpDir, 'model.bngl'), 'test');
    fs.writeFileSync(path.join(tmpDir, 'data.txt'), 'test');
    fs.writeFileSync(path.join(tmpDir, 'script.js'), 'test');

    const files = listModelFiles(tmpDir);
    assert.deepStrictEqual(files, ['model.bngl']);
  });

  await t.test('returns sorted .bngl files', () => {
    fs.writeFileSync(path.join(tmpDir, 'c.bngl'), 'test');
    fs.writeFileSync(path.join(tmpDir, 'a.bngl'), 'test');
    fs.writeFileSync(path.join(tmpDir, 'b.bngl'), 'test');

    const files = listModelFiles(tmpDir);
    assert.deepStrictEqual(files, ['a.bngl', 'b.bngl', 'c.bngl']);
  });

  await t.test('ignores directories even if they end in .bngl', () => {
    fs.writeFileSync(path.join(tmpDir, 'file.bngl'), 'test');
    fs.mkdirSync(path.join(tmpDir, 'dir.bngl'));

    const files = listModelFiles(tmpDir);
    assert.deepStrictEqual(files, ['file.bngl']);
  });

  await t.test('throws an error if the directory does not exist', () => {
    assert.throws(() => listModelFiles(path.join(tmpDir, 'non-existent-dir')), {
      code: 'ENOENT'
    });
  });
});
