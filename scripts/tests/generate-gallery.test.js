const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { main } = require('../generate-gallery.js');

test('generate-gallery main function JSON parsing errors', async (t) => {
  let tmpDir;
  let originalConsoleLog;
  let originalConsoleWarn;
  let outputData;

  t.beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gallery-test-'));
    originalConsoleLog = console.log;
    originalConsoleWarn = console.warn;
    outputData = '';

    // Silence console
    console.log = () => {};
    console.warn = () => {};
  });

  t.afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
  });

  await t.test('handles malformed existing gallery.json gracefully', async () => {
    // Create a dummy metadata.yaml so it does some work (optional, but good for completeness)
    const publishedDir = path.join(tmpDir, 'Published', 'TestModel');
    fs.mkdirSync(publishedDir, { recursive: true });
    fs.writeFileSync(path.join(publishedDir, 'metadata.yaml'), 'id: test-model\ntags:\n  - published\n');
    fs.writeFileSync(path.join(publishedDir, 'model.bngl'), '');

    // Setup an invalid gallery.json
    const outputJson = path.join(tmpDir, 'gallery.json');
    const outputGeneratedJson = path.join(tmpDir, 'gallery.generated.json');

    // Write malformed JSON
    fs.writeFileSync(outputJson, '{ "version": 1, "generated": "2023-01-01T00:00:00.000Z", malformed }');

    // Run the main function
    await main(['--root', tmpDir, '--output', outputGeneratedJson]);

    // Check that it successfully generated the file despite the bad JSON
    assert.ok(fs.existsSync(outputGeneratedJson), 'Generated file should exist');

    const generated = JSON.parse(fs.readFileSync(outputGeneratedJson, 'utf8'));
    assert.strictEqual(generated.version, 1);

    // The date should be newly generated, NOT the one from the malformed JSON
    assert.notStrictEqual(generated.generated, '2023-01-01T00:00:00.000Z');
    assert.ok(new Date(generated.generated).getTime() > 0, 'Should have a valid ISO date string');
  });
});
