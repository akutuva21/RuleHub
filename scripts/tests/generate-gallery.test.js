const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { main } = require('../generate-gallery.js');

test('generate-gallery main function', async (t) => {
  let tmpDir;

  t.beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gallery-test-'));
  });

  t.afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  await t.test('continues processing if a metadata.yaml is unreadable and warns', async () => {
    const publishedDir = path.join(tmpDir, 'Published');
    fs.mkdirSync(path.join(publishedDir, 'ModelA'), { recursive: true });
    fs.mkdirSync(path.join(publishedDir, 'ModelB'), { recursive: true });

    // Provide default categories
    fs.writeFileSync(path.join(tmpDir, 'gallery-categories.yaml'), `
categories:
  - id: goodcat
    name: "Good Category"
`);

    // ModelA: Valid
    fs.writeFileSync(path.join(publishedDir, 'ModelA', 'metadata.yaml'), `
id: modelA
playground:
  gallery_category: goodcat
`);
    fs.writeFileSync(path.join(publishedDir, 'ModelA', 'modelA.bngl'), `begin model\\nend model`);

    // ModelB: Unreadable
    const badPath = path.join(publishedDir, 'ModelB', 'metadata.yaml');
    fs.writeFileSync(badPath, `id: modelB\\nplayground:\\n  gallery_category: goodcat`);
    fs.writeFileSync(path.join(publishedDir, 'ModelB', 'modelB.bngl'), `begin model\\nend model`);

    // Make unreadable
    fs.chmodSync(badPath, 0o000);

    const outPath = path.join(tmpDir, 'gallery.json');

    // Capture console.warn
    const originalWarn = console.warn;
    const warnings = [];
    console.warn = (msg) => warnings.push(msg);

    // Capture console.log to avoid spam
    const originalLog = console.log;
    console.log = () => {};

    try {
      await main(['--root', tmpDir, '--output', outPath]);
    } finally {
      console.warn = originalWarn;
      console.log = originalLog;
      // Restore permissions so rmSync can delete it
      try {
        fs.chmodSync(badPath, 0o666);
      } catch (e) {
        // ignore
      }
    }

    assert.ok(warnings.some(msg => msg.includes('Failed to process') && msg.includes(badPath)), 'Should log a warning for unreadable metadata');

    const result = JSON.parse(fs.readFileSync(outPath, 'utf8'));

    assert.strictEqual(typeof result.assignments, 'object');
    assert.ok('modelA' in result.assignments, 'Valid modelA should be processed');
    assert.strictEqual(result.assignments['modelB'], undefined, 'Unreadable modelB should not be processed');
  });
});
