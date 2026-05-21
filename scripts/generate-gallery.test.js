const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { main } = require('./generate-gallery.js');

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

    const model1Dir = path.join(pubDir, 'model1');
    fs.mkdirSync(model1Dir);
    fs.writeFileSync(path.join(model1Dir, 'metadata.yaml'), 'id: model1\ntags:\n  - published\ncollection: true\n');

    const model2Dir = path.join(pubDir, 'model2');
    fs.mkdirSync(model2Dir);
    fs.writeFileSync(path.join(model2Dir, 'metadata.yaml'), 'id: model2\ncollection:\n  - : invalid yaml: \n');

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

test('generate-gallery error path test for JSON.parse', async () => {
    const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'gallery-test-'));
    const output = path.join(tmpdir, 'gallery.generated.json');
    const outputBase = path.join(tmpdir, 'gallery.json');

    fs.writeFileSync(outputBase, '{ invalid: json }');
    fs.writeFileSync(path.join(tmpdir, 'gallery-categories.yaml'), 'categories:\n  - id: test\n    name: test\n');

    const originalLog = console.log;
    const originalWarn = console.warn;
    console.log = () => {};
    console.warn = () => {};

    try {
        await main(['--root', tmpdir, '--output', output]);

        const result = JSON.parse(fs.readFileSync(output, 'utf8'));
        assert.ok(result.generated, 'Should have a generated date');
        assert.deepEqual(result.categories, [{id: 'test', name: 'test', description: '', sortOrder: 0}], 'Should have parsed the dummy category');
        assert.deepEqual(result.assignments, {}, 'Should have empty assignments');
    } finally {
        console.log = originalLog;
        console.warn = originalWarn;
        fs.rmSync(tmpdir, { recursive: true, force: true });
    }
});
