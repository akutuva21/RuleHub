const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { updateMetadataFile, parseArgs } = require('./apply-gallery-assignments.js');

test('updateMetadataFile', async (t) => {
  let tmpDir;

  t.beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'update-metadata-test-'));
  });

  t.afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  await t.test('returns false and does not modify file if model ID is not found', () => {
    const filePath = path.join(tmpDir, 'metadata.yaml');
    fs.writeFileSync(filePath, 'id: "model-2"\n');

    const result = updateMetadataFile(filePath, { 'model-1': { bng2_compatible: true } }, false);

    assert.strictEqual(result, false);
    assert.strictEqual(fs.readFileSync(filePath, 'utf8'), 'id: "model-2"\n');
  });

  await t.test('updates gallery_categories from empty array', () => {
    const filePath = path.join(tmpDir, 'metadata.yaml');
    fs.writeFileSync(filePath, 'id: "model-1"\ngallery_categories: []\n');

    const result = updateMetadataFile(filePath, { 'model-1': { gallery_categories: ["cat1", "cat2"] } }, false);

    assert.strictEqual(result, true);
    assert.strictEqual(fs.readFileSync(filePath, 'utf8'), 'id: "model-1"\ngallery_categories: ["cat1","cat2"]\n');
  });

  await t.test('updates gallery_category string to gallery_categories array', () => {
    const filePath = path.join(tmpDir, 'metadata.yaml');
    fs.writeFileSync(filePath, 'id: "model-1"\ngallery_category: "some_cat"\n');

    const result = updateMetadataFile(filePath, { 'model-1': { gallery_categories: ["cat1"] } }, false);

    assert.strictEqual(result, true);
    assert.strictEqual(fs.readFileSync(filePath, 'utf8'), 'id: "model-1"\ngallery_categories: ["cat1"]\n');
  });

  await t.test('adds visible: true under playground if gallery_categories updated', () => {
    const filePath = path.join(tmpDir, 'metadata.yaml');
    fs.writeFileSync(filePath, 'id: "model-1"\ngallery_category: "some_cat"\nplayground:\n');

    const result = updateMetadataFile(filePath, { 'model-1': { gallery_categories: ["cat1"] } }, false);

    assert.strictEqual(result, true);
    assert.strictEqual(fs.readFileSync(filePath, 'utf8'), 'id: "model-1"\ngallery_categories: ["cat1"]\nplayground:\n  visible: true');
  });

  await t.test('updates bng2_compatible from false to true', () => {
    const filePath = path.join(tmpDir, 'metadata.yaml');
    fs.writeFileSync(filePath, 'id: "model-1"\nbng2_compatible: false\n');

    const result = updateMetadataFile(filePath, { 'model-1': { bng2_compatible: true } }, false);

    assert.strictEqual(result, true);
    assert.strictEqual(fs.readFileSync(filePath, 'utf8'), 'id: "model-1"\nbng2_compatible: true\n');
  });

  await t.test('updates nfsim_compatible from false to true', () => {
    const filePath = path.join(tmpDir, 'metadata.yaml');
    fs.writeFileSync(filePath, 'id: "model-1"\nnfsim_compatible: false\n');

    const result = updateMetadataFile(filePath, { 'model-1': { nfsim_compatible: true } }, false);

    assert.strictEqual(result, true);
    assert.strictEqual(fs.readFileSync(filePath, 'utf8'), 'id: "model-1"\nnfsim_compatible: true\n');
  });

  await t.test('updates excluded from false to true', () => {
    const filePath = path.join(tmpDir, 'metadata.yaml');
    fs.writeFileSync(filePath, 'id: "model-1"\nexcluded: false\n');

    const result = updateMetadataFile(filePath, { 'model-1': { excluded: true } }, false);

    assert.strictEqual(result, true);
    assert.strictEqual(fs.readFileSync(filePath, 'utf8'), 'id: "model-1"\nexcluded: true\n');
  });

  await t.test('returns true but does not modify file if dryRun is true', () => {
    const filePath = path.join(tmpDir, 'metadata.yaml');
    fs.writeFileSync(filePath, 'id: "model-1"\nbng2_compatible: false\n');

    const result = updateMetadataFile(filePath, { 'model-1': { bng2_compatible: true } }, true);

    assert.strictEqual(result, true);
    assert.strictEqual(fs.readFileSync(filePath, 'utf8'), 'id: "model-1"\nbng2_compatible: false\n');
  });
});

test('parseArgs default values', () => {
  const args = parseArgs([]);
  assert.strictEqual(args.input, 'gallery-assignments.json');
  assert.strictEqual(args.root, path.resolve(__dirname, '..'));
  assert.strictEqual(args.dryRun, false);
});

test('parseArgs with --input', () => {
  const args = parseArgs(['--input', 'custom-input.json']);
  assert.strictEqual(args.input, 'custom-input.json');
  assert.strictEqual(args.root, path.resolve(__dirname, '..'));
  assert.strictEqual(args.dryRun, false);
});

test('parseArgs with --root', () => {
  const args = parseArgs(['--root', '/custom/root']);
  assert.strictEqual(args.input, 'gallery-assignments.json');
  assert.strictEqual(args.root, '/custom/root');
  assert.strictEqual(args.dryRun, false);
});

test('parseArgs with --dry-run', () => {
  const args = parseArgs(['--dry-run']);
  assert.strictEqual(args.input, 'gallery-assignments.json');
  assert.strictEqual(args.root, path.resolve(__dirname, '..'));
  assert.strictEqual(args.dryRun, true);
});

test('parseArgs with all arguments', () => {
  const args = parseArgs(['--dry-run', '--root', '/tmp/root', '--input', 'test.json']);
  assert.strictEqual(args.input, 'test.json');
  assert.strictEqual(args.root, '/tmp/root');
  assert.strictEqual(args.dryRun, true);
});

test('parseArgs ignoring missing value for --input', () => {
  const args = parseArgs(['--input']);
  assert.strictEqual(args.input, 'gallery-assignments.json');
});

test('parseArgs ignoring missing value for --root', () => {
  const args = parseArgs(['--root']);
  assert.strictEqual(args.root, path.resolve(__dirname, '..'));
});

test('parseArgs ignoring unrecognized arguments', () => {
  const args = parseArgs(['--unknown', 'value', '--input', 'test.json']);
  assert.strictEqual(args.input, 'test.json');
});
