const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { spawnSync } = require('child_process');

test('generate-gallery.js handles file read/parse errors', async (t) => {
  let tmpDir;

  t.beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gallery-test-'));
  });

  t.afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  await t.test('skips malformed yaml and continues execution', () => {
    const pubDir = path.join(tmpDir, 'Published');
    fs.mkdirSync(pubDir);

    // Model 1: valid
    const model1Dir = path.join(pubDir, 'model1');
    fs.mkdirSync(model1Dir);
    fs.writeFileSync(path.join(model1Dir, 'metadata.yaml'), 'id: model1\ntags:\n  - published\ncollection: true\n');

    // Model 2: malformed yaml
    const model2Dir = path.join(pubDir, 'model2');
    fs.mkdirSync(model2Dir);
    fs.writeFileSync(path.join(model2Dir, 'metadata.yaml'), 'id: model2\ncollection:\n  - : invalid yaml: \n');

    // Model 3: valid
    const model3Dir = path.join(pubDir, 'model3');
    fs.mkdirSync(model3Dir);
    fs.writeFileSync(path.join(model3Dir, 'metadata.yaml'), 'id: model3\ntags:\n  - published\ncollection: true\n');

    const outputJsonPath = path.join(tmpDir, 'gallery.json');

    const res = spawnSync(process.execPath, [
      path.join(__dirname, 'generate-gallery.js'),
      '--root', tmpDir,
      '--output', outputJsonPath
    ], { encoding: 'utf8' });

    assert.strictEqual(res.status, 0);

    const gallery = JSON.parse(fs.readFileSync(outputJsonPath, 'utf8'));
    assert.deepStrictEqual(Object.keys(gallery.assignments).sort(), ['model1', 'model3']);
  });
});
