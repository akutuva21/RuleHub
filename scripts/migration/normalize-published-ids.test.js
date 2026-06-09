const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseArgs, listMetadataFiles, updateMetadataId, main } = require('./normalize-published-ids');

test('normalize-published-ids.js tests', async (t) => {
  await t.test('parseArgs', async (t) => {
    await t.test('defaults --root to resolved directory if missing', () => {
      const args = parseArgs([]);
      assert.strictEqual(args.root, path.resolve(__dirname, '../../'));
    });

    await t.test('parses --root /path/to/root', () => {
      const args = parseArgs(['--root', '/path/to/root']);
      assert.strictEqual(args.root, '/path/to/root');
    });

    await t.test('ignores --root if no argument is provided after it', () => {
        const args = parseArgs(['--root']);
        assert.strictEqual(args.root, path.resolve(__dirname, '../../'));
    })
  });

  await t.test('listMetadataFiles', async (t) => {
    let tempDir;

    t.before(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'normalize-ids-list-test-'));
    });

    t.after(() => {
      if (tempDir) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    await t.test('returns empty array for empty directory', async () => {
      const results = await listMetadataFiles(tempDir);
      assert.deepEqual(results, []);
    });

    await t.test('returns empty array if directory does not exist', async () => {
      const results = await listMetadataFiles(path.join(tempDir, 'nonexistent'));
      assert.deepEqual(results, []);
    });

    await t.test('finds metadata.yaml in root directory', async () => {
      const filePath = path.join(tempDir, 'metadata.yaml');
      fs.writeFileSync(filePath, 'id: test', 'utf8');

      const results = await listMetadataFiles(tempDir);
      assert.deepEqual(results, [filePath]);

      fs.unlinkSync(filePath);
    });

    await t.test('finds metadata.yaml recursively and ignores other files', async () => {
      const subDir1 = path.join(tempDir, 'dir1');
      const subDir2 = path.join(subDir1, 'dir2');
      fs.mkdirSync(subDir2, { recursive: true });

      const file1 = path.join(subDir1, 'metadata.yaml');
      const file2 = path.join(subDir2, 'metadata.yaml');
      const file3 = path.join(subDir1, 'other.yaml');

      fs.writeFileSync(file1, 'id: test1', 'utf8');
      fs.writeFileSync(file2, 'id: test2', 'utf8');
      fs.writeFileSync(file3, 'id: test3', 'utf8');

      const results = await listMetadataFiles(tempDir);

      assert.strictEqual(results.length, 2);
      assert.ok(results.includes(file1));
      assert.ok(results.includes(file2));
      assert.ok(!results.includes(file3));

      fs.rmSync(subDir1, { recursive: true, force: true });
    });
  });

  await t.test('updateMetadataId', async (t) => {
    let tempDir;

    t.before(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'normalize-ids-test-'));
    });

    t.after(() => {
      if (tempDir) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    await t.test('replaces an unquoted id', async () => {
      const filePath = path.join(tempDir, 'metadata_unquoted.yaml');
      fs.writeFileSync(filePath, 'name: "test"\nid: oldId\nother: "value"', 'utf8');

      const result = await updateMetadataId(filePath, 'newId');

      assert.strictEqual(result, true);
      const content = fs.readFileSync(filePath, 'utf8');
      assert.strictEqual(content, 'name: "test"\nid: "newId"\nother: "value"');
    });

    await t.test('replaces a single-quoted id', async () => {
      const filePath = path.join(tempDir, 'metadata_single_quoted.yaml');
      fs.writeFileSync(filePath, "name: 'test'\nid: 'oldId'\nother: 'value'", 'utf8');

      const result = await updateMetadataId(filePath, 'newId');

      assert.strictEqual(result, true);
      const content = fs.readFileSync(filePath, 'utf8');
      assert.strictEqual(content, "name: 'test'\nid: \"newId\"\nother: 'value'");
    });

    await t.test('replaces a double-quoted id', async () => {
      const filePath = path.join(tempDir, 'metadata_double_quoted.yaml');
      fs.writeFileSync(filePath, 'name: "test"\nid: "oldId"\nother: "value"', 'utf8');

      const result = await updateMetadataId(filePath, 'newId');

      assert.strictEqual(result, true);
      const content = fs.readFileSync(filePath, 'utf8');
      assert.strictEqual(content, 'name: "test"\nid: "newId"\nother: "value"');
    });

    await t.test('returns false if id is already correct', async () => {
      const filePath = path.join(tempDir, 'metadata_correct.yaml');
      fs.writeFileSync(filePath, 'name: "test"\nid: "newId"\nother: "value"', 'utf8');

      const result = await updateMetadataId(filePath, 'newId');

      assert.strictEqual(result, false);
      const content = fs.readFileSync(filePath, 'utf8');
      assert.strictEqual(content, 'name: "test"\nid: "newId"\nother: "value"'); // Unchanged
    });

    await t.test('handles spacing correctly', async () => {
        const filePath = path.join(tempDir, 'metadata_spaces.yaml');
        fs.writeFileSync(filePath, 'name: "test"\n  id:  oldId  \nother: "value"', 'utf8');

        const result = await updateMetadataId(filePath, 'newId');

        assert.strictEqual(result, false, "Original regex shouldn't match indented id");
    })
  });

  await t.test('main', async (t) => {
    let tempDir;
    const originalConsoleLog = console.log;

    t.before(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'normalize-ids-main-test-'));
      console.log = () => {}; // mock console.log to keep test output clean
    });

    t.after(() => {
      if (tempDir) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      console.log = originalConsoleLog;
    });

    await t.test('updates correctly mapped files and ignores unmapped or PyBioNetGen ones', async () => {
      // Setup mock directory structure: Published/An2009, Published/PyBioNetGen, Published/Unknown
      const pubDir = path.join(tempDir, 'Published');
      const anDir = path.join(pubDir, 'An2009');
      const pybionetgenDir = path.join(pubDir, 'PyBioNetGen/some_subfolder');
      const unknownDir = path.join(pubDir, 'Unknown');

      fs.mkdirSync(anDir, { recursive: true });
      fs.mkdirSync(pybionetgenDir, { recursive: true });
      fs.mkdirSync(unknownDir, { recursive: true });

      const anFile = path.join(anDir, 'metadata.yaml');
      const pybionetgenFile = path.join(pybionetgenDir, 'metadata.yaml');
      const unknownFile = path.join(unknownDir, 'metadata.yaml');

      fs.writeFileSync(anFile, 'name: "An model"\nid: "oldAnId"', 'utf8');
      fs.writeFileSync(pybionetgenFile, 'name: "PyBioNetGen"\nid: "pyId"', 'utf8');
      fs.writeFileSync(unknownFile, 'name: "Unknown"\nid: "unknownId"', 'utf8');

      await main(['--root', tempDir]);

      const anContent = fs.readFileSync(anFile, 'utf8');
      assert.ok(anContent.includes('id: "An_TLR4_2009"'), 'An2009 file should be updated with new ID');

      const pybionetgenContent = fs.readFileSync(pybionetgenFile, 'utf8');
      assert.ok(pybionetgenContent.includes('id: "pyId"'), 'PyBioNetGen file should be ignored');

      const unknownContent = fs.readFileSync(unknownFile, 'utf8');
      assert.ok(unknownContent.includes('id: "unknownId"'), 'Unmapped file should be ignored');
    });
  });
});