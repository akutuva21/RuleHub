const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { parseArgs, updateMetadataFile } = require('../apply-gallery-assignments.js');

test('parseArgs', async (t) => {
  await t.test('uses default values', () => {
    const args = parseArgs([]);
    assert.strictEqual(args.input, 'gallery-assignments.json');
    assert.strictEqual(args.root, path.resolve(__dirname, '..', '..'));
    assert.strictEqual(args.dryRun, false);
  });

  await t.test('parses --input', () => {
    const args = parseArgs(['--input', 'custom.json']);
    assert.strictEqual(args.input, 'custom.json');
  });

  await t.test('parses --root', () => {
    const args = parseArgs(['--root', '/custom/root']);
    assert.strictEqual(args.root, '/custom/root');
  });

  await t.test('parses --dry-run', () => {
    const args = parseArgs(['--dry-run']);
    assert.strictEqual(args.dryRun, true);
  });

  await t.test('parses multiple arguments', () => {
    const args = parseArgs(['--input', 'custom.json', '--dry-run', '--root', '/custom/root']);
    assert.strictEqual(args.input, 'custom.json');
    assert.strictEqual(args.root, '/custom/root');
    assert.strictEqual(args.dryRun, true);
  });
});

test('updateMetadataFile', async (t) => {
  let tmpDir;

  t.beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bionetgen-test-'));
  });

  t.afterEach(() => {
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  await t.test('updates gallery_categories, playground visible flag', () => {
    const modelDir = path.join(tmpDir, 'model1');
    fs.mkdirSync(modelDir);
    const metadataPath = path.join(modelDir, 'metadata.yaml');

    const initialContent = `id: "model1"
gallery_categories: []
playground:
  some_other_key: true`;

    fs.writeFileSync(metadataPath, initialContent);

    const assignments = {
      model1: {
        gallery_categories: ["cat1", "cat2"]
      }
    };

    const updated = updateMetadataFile(metadataPath, assignments, false);

    assert.strictEqual(updated, true);
    const newContent = fs.readFileSync(metadataPath, 'utf8');

    assert.ok(newContent.includes('gallery_categories: ["cat1","cat2"]'));
    assert.ok(newContent.includes('playground:\n  visible: true'));
  });

  await t.test('updates single gallery_category to gallery_categories', () => {
    const modelDir = path.join(tmpDir, 'model2');
    fs.mkdirSync(modelDir);
    const metadataPath = path.join(modelDir, 'metadata.yaml');

    const initialContent = `id: "model2"
gallery_category: "old_cat"`;

    fs.writeFileSync(metadataPath, initialContent);

    const assignments = {
      model2: {
        gallery_categories: ["cat1", "cat2"]
      }
    };

    const updated = updateMetadataFile(metadataPath, assignments, false);

    assert.strictEqual(updated, true);
    const newContent = fs.readFileSync(metadataPath, 'utf8');

    assert.ok(newContent.includes('gallery_categories: ["cat1","cat2"]'));
    assert.ok(!newContent.includes('gallery_category: "old_cat"'));
  });

  await t.test('updates compatibility flags', () => {
    const modelDir = path.join(tmpDir, 'model3');
    fs.mkdirSync(modelDir);
    const metadataPath = path.join(modelDir, 'metadata.yaml');

    const initialContent = `id: "model3"
bng2_compatible: false
nfsim_compatible: false
excluded: false`;

    fs.writeFileSync(metadataPath, initialContent);

    const assignments = {
      model3: {
        bng2_compatible: true,
        nfsim_compatible: true,
        excluded: true
      }
    };

    const updated = updateMetadataFile(metadataPath, assignments, false);

    assert.strictEqual(updated, true);
    const newContent = fs.readFileSync(metadataPath, 'utf8');

    assert.ok(newContent.includes('bng2_compatible: true'));
    assert.ok(newContent.includes('nfsim_compatible: true'));
    assert.ok(newContent.includes('excluded: true'));
  });

  await t.test('does not modify if dryRun is true', () => {
    const modelDir = path.join(tmpDir, 'model4');
    fs.mkdirSync(modelDir);
    const metadataPath = path.join(modelDir, 'metadata.yaml');

    const initialContent = `id: "model4"
bng2_compatible: false`;

    fs.writeFileSync(metadataPath, initialContent);

    const assignments = {
      model4: {
        bng2_compatible: true
      }
    };

    const updated = updateMetadataFile(metadataPath, assignments, true); // dryRun = true

    assert.strictEqual(updated, true); // It should still report that it *would* update

    const newContent = fs.readFileSync(metadataPath, 'utf8');
    assert.strictEqual(newContent, initialContent); // File shouldn't be changed
  });

  await t.test('does not update if model id not found', () => {
    const modelDir = path.join(tmpDir, 'model5');
    fs.mkdirSync(modelDir);
    const metadataPath = path.join(modelDir, 'metadata.yaml');

    const initialContent = `id: "other_model"
bng2_compatible: false`;

    fs.writeFileSync(metadataPath, initialContent);

    const assignments = {
      model5: {
        bng2_compatible: true
      }
    };

    const updated = updateMetadataFile(metadataPath, assignments, false);

    assert.strictEqual(updated, false);
  });
});
