const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { main, parseArgs, loadGalleryCategories, extractModelIds, parseYamlSimple } = require('./generate-gallery.js');

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

test('parseArgs', async (t) => {
  await t.test('uses default root and output when no args provided', () => {
    const { root, output } = parseArgs([]);
    assert.strictEqual(root, path.resolve(__dirname, '..'));
    assert.strictEqual(output, path.join(path.resolve(__dirname, '..'), 'gallery.json'));
  });

  await t.test('parses --root argument', () => {
    const { root, output } = parseArgs(['--root', './some/path']);
    assert.strictEqual(root, path.resolve('./some/path'));
    assert.strictEqual(output, path.join(path.resolve('./some/path'), 'gallery.json'));
  });

  await t.test('parses --output argument', () => {
    const { root, output } = parseArgs(['--output', './out.json']);
    assert.strictEqual(root, path.resolve(__dirname, '..'));
    assert.strictEqual(output, path.resolve('./out.json'));
  });

  await t.test('parses both --root and --output arguments', () => {
    const { root, output } = parseArgs(['--root', './myroot', '--output', './myout.json']);
    assert.strictEqual(root, path.resolve('./myroot'));
    assert.strictEqual(output, path.resolve('./myout.json'));
  });
});

test('parseYamlSimple', async (t) => {
  await t.test('returns empty categories if no categories key found', () => {
    const yaml = `some_other_key: value`;
    const result = parseYamlSimple(yaml);
    assert.deepStrictEqual(result, { categories: [] });
  });

  await t.test('parses basic categories', () => {
    const yaml = `
categories:
  - id: cat1
    name: "Category 1"
    description: 'First category'
    sortOrder: 10
  - id: cat2
    name: Category 2
    description: Second category
    sortOrder: 20
`;
    const result = parseYamlSimple(yaml);
    assert.deepStrictEqual(result, {
      categories: [
        { id: 'cat1', name: 'Category 1', description: 'First category', sortOrder: 10 },
        { id: 'cat2', name: 'Category 2', description: 'Second category', sortOrder: 20 },
      ]
    });
  });

  await t.test('handles missing optional fields and uses defaults', () => {
    const yaml = `
categories:
  - id: cat1
    name: "Category 1"
`;
    const result = parseYamlSimple(yaml);
    assert.deepStrictEqual(result, {
      categories: [
        { id: 'cat1', name: 'Category 1', description: '', sortOrder: 0 },
      ]
    });
  });

  await t.test('ignores data outside categories block', () => {
    const yaml = `
other_stuff:
  - foo
categories:
  - id: cat1
    name: Category 1
more_stuff: bar
`;
    const result = parseYamlSimple(yaml);
    assert.deepStrictEqual(result.categories[0].id, 'cat1');
    assert.deepStrictEqual(result.categories[0].name, 'Category 1');
  });
});

test('loadGalleryCategories', async (t) => {
  let tmpDir;

  t.beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gallery-test-'));
  });

  t.afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  await t.test('returns empty categories if gallery-categories.yaml is missing', async () => {
    const originalConsoleWarn = console.warn;
    let warningLogged = false;
    console.warn = (msg) => {
      if (msg.includes('gallery-categories.yaml not found')) warningLogged = true;
    };

    const result = await loadGalleryCategories(tmpDir);
    assert.deepStrictEqual(result, { categories: [] });
    assert.ok(warningLogged, 'Should log a warning');

    console.warn = originalConsoleWarn;
  });

  await t.test('loads and parses existing gallery-categories.yaml', async () => {
    const yaml = `
categories:
  - id: mycat
    name: "My Cat"
    sortOrder: 1
`;
    fs.writeFileSync(path.join(tmpDir, 'gallery-categories.yaml'), yaml);

    const result = await loadGalleryCategories(tmpDir);
    assert.deepStrictEqual(result, {
      categories: [
        { id: 'mycat', name: 'My Cat', description: '', sortOrder: 1 }
      ]
    });
  });

  await t.test('handles generic file read errors and falls back to defaults', async () => {
    const originalConsoleWarn = console.warn;
    const originalReadFile = fs.promises.readFile;
    let warningLogged = false;

    console.warn = (msg) => {
      if (msg.includes('gallery-categories.yaml not found')) warningLogged = true;
    };

    fs.promises.readFile = async () => {
      throw new Error('Generic file read error');
    };

    try {
      const result = await loadGalleryCategories(tmpDir);
      assert.deepStrictEqual(result, { categories: [] });
      assert.ok(warningLogged, 'Should log a warning');
    } finally {
      console.warn = originalConsoleWarn;
      fs.promises.readFile = originalReadFile;
    }
  });
});

test('extractModelIds', async (t) => {
  let tmpDir;

  t.beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gallery-test-id-'));
  });

  t.afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  await t.test('returns metadata id if is collection', () => {
    const metadataPath = path.join(tmpDir, 'metadata.yaml');
    fs.writeFileSync(metadataPath, '');
    const result = extractModelIds(metadataPath, { id: 'coll_1', collection: true });
    assert.strictEqual(result, 'coll_1');
  });

  await t.test('returns metadata id if it exists and bngl files are present', () => {
    const metadataPath = path.join(tmpDir, 'metadata.yaml');
    fs.writeFileSync(metadataPath, '');
    fs.writeFileSync(path.join(tmpDir, 'model.bngl'), '');

    const result = extractModelIds(metadataPath, { id: 'meta_id' });
    assert.strictEqual(result, 'meta_id');
  });

  await t.test('returns filename of bngl if no metadata id is present', () => {
    const metadataPath = path.join(tmpDir, 'metadata.yaml');
    fs.writeFileSync(metadataPath, '');
    fs.writeFileSync(path.join(tmpDir, 'my_model.bngl'), '');

    const result = extractModelIds(metadataPath, {});
    assert.strictEqual(result, 'my_model');
  });

  await t.test('returns null if no bngl files are present (and not a collection)', () => {
    const metadataPath = path.join(tmpDir, 'metadata.yaml');
    fs.writeFileSync(metadataPath, '');
    const result = extractModelIds(metadataPath, { id: 'meta_id' });
    assert.strictEqual(result, null);
  });
});
