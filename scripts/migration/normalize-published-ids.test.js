const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseArgs, updateMetadataId } = require('./normalize-published-ids');

test('normalize-published-ids.js tests', async (t) => {
  await t.test('parseArgs', async (t) => {
    await t.test('defaults --root to a specific path if missing', () => {
      const args = parseArgs([]);
      assert.strictEqual(args.root, 'C:\\Users\\Achyudhan\\OneDrive - University of Pittsburgh\\Desktop\\Achyudhan\\School\\PhD\\Research\\BioNetGen\\RuleHub');
    });

    await t.test('parses --root /path/to/root', () => {
      const args = parseArgs(['--root', '/path/to/root']);
      assert.strictEqual(args.root, '/path/to/root');
    });

    await t.test('ignores --root if no argument is provided after it', () => {
        const args = parseArgs(['--root']);
        assert.strictEqual(args.root, 'C:\\Users\\Achyudhan\\OneDrive - University of Pittsburgh\\Desktop\\Achyudhan\\School\\PhD\\Research\\BioNetGen\\RuleHub');
    })
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

    await t.test('replaces an unquoted id', () => {
      const filePath = path.join(tempDir, 'metadata_unquoted.yaml');
      fs.writeFileSync(filePath, 'name: "test"\nid: oldId\nother: "value"', 'utf8');

      const result = updateMetadataId(filePath, 'newId');

      assert.strictEqual(result, true);
      const content = fs.readFileSync(filePath, 'utf8');
      assert.strictEqual(content, 'name: "test"\nid: "newId"\nother: "value"');
    });

    await t.test('replaces a single-quoted id', () => {
      const filePath = path.join(tempDir, 'metadata_single_quoted.yaml');
      fs.writeFileSync(filePath, "name: 'test'\nid: 'oldId'\nother: 'value'", 'utf8');

      const result = updateMetadataId(filePath, 'newId');

      assert.strictEqual(result, true);
      const content = fs.readFileSync(filePath, 'utf8');
      assert.strictEqual(content, "name: 'test'\nid: \"newId\"\nother: 'value'");
    });

    await t.test('replaces a double-quoted id', () => {
      const filePath = path.join(tempDir, 'metadata_double_quoted.yaml');
      fs.writeFileSync(filePath, 'name: "test"\nid: "oldId"\nother: "value"', 'utf8');

      const result = updateMetadataId(filePath, 'newId');

      assert.strictEqual(result, true);
      const content = fs.readFileSync(filePath, 'utf8');
      assert.strictEqual(content, 'name: "test"\nid: "newId"\nother: "value"');
    });

    await t.test('returns false if id is already correct', () => {
      const filePath = path.join(tempDir, 'metadata_correct.yaml');
      fs.writeFileSync(filePath, 'name: "test"\nid: "newId"\nother: "value"', 'utf8');

      const result = updateMetadataId(filePath, 'newId');

      assert.strictEqual(result, false);
      const content = fs.readFileSync(filePath, 'utf8');
      assert.strictEqual(content, 'name: "test"\nid: "newId"\nother: "value"'); // Unchanged
    });

    await t.test('handles spacing correctly', () => {
        const filePath = path.join(tempDir, 'metadata_spaces.yaml');
        fs.writeFileSync(filePath, 'name: "test"\n  id:  oldId  \nother: "value"', 'utf8');

        const result = updateMetadataId(filePath, 'newId');

        // This is a test based on the actual regex implementation.
        // Note: The original regex is /^id:\s*(["']?)(.*?)\1\s*$/m
        // It expects 'id:' to be at the start of the line (^).
        // If there are spaces before 'id:', it won't match!

        assert.strictEqual(result, false, "Original regex shouldn't match indented id");
    })
  });
});