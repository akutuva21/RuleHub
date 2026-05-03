const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { listModelFiles } = require('./utils.js');

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

  await t.test('listModelFiles returns only .bngl files in alphabetical order', () => {
    fs.writeFileSync(path.join(tmpDir, 'model2.bngl'), 'content');
    fs.writeFileSync(path.join(tmpDir, 'model1.bngl'), 'content');
    fs.writeFileSync(path.join(tmpDir, 'model3.bngl'), 'content');

    const files = listModelFiles(tmpDir);
    assert.deepStrictEqual(files, ['model1.bngl', 'model2.bngl', 'model3.bngl']);
  });

  await t.test('listModelFiles ignores directories even if named with .bngl extension', () => {
    fs.writeFileSync(path.join(tmpDir, 'model1.bngl'), 'content');
    fs.mkdirSync(path.join(tmpDir, 'dir.bngl'));
    fs.mkdirSync(path.join(tmpDir, 'other-dir'));

    const files = listModelFiles(tmpDir);
    assert.deepStrictEqual(files, ['model1.bngl']);
  });

  await t.test('listModelFiles ignores files with other extensions', () => {
    fs.writeFileSync(path.join(tmpDir, 'model1.bngl'), 'content');
    fs.writeFileSync(path.join(tmpDir, 'data.txt'), 'content');
    fs.writeFileSync(path.join(tmpDir, 'model2.xml'), 'content');

    const files = listModelFiles(tmpDir);
    assert.deepStrictEqual(files, ['model1.bngl']);
  });

  await t.test('listModelFiles returns empty array for empty directory', () => {
    const files = listModelFiles(tmpDir);
    assert.deepStrictEqual(files, []);
  });
});
