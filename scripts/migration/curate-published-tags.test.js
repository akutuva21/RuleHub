const assert = require('assert');
const test = require('node:test');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { parseArgs, listMetadataFiles, parseMetadataYaml, main } = require('./curate-published-tags.js');

test('parseArgs', async (t) => {
    await t.test('uses default root when no args provided', () => {
        const args = parseArgs([]);
        assert.strictEqual(args.root, path.resolve(__dirname, '../../'));
    });

    await t.test('parses --root argument', () => {
        const args = parseArgs(['--root', '/custom/root']);
        assert.strictEqual(args.root, '/custom/root');
    });

    await t.test('ignores other arguments', () => {
        const args = parseArgs(['--other', 'value', '--root', '/custom/root']);
        assert.strictEqual(args.root, '/custom/root');
    });
});

test('parseMetadataYaml', async (t) => {
    await t.test('parses simple key-value pairs', () => {
        const yaml = `
id: "test_model"
title: "Test Model"
`;
        const result = parseMetadataYaml(yaml);
        assert.deepEqual(result, { id: 'test_model', title: 'Test Model' });
    });

    await t.test('handles single quotes', () => {
        const yaml = `
id: 'test_model'
`;
        const result = parseMetadataYaml(yaml);
        assert.deepEqual(result, { id: 'test_model' });
    });

    await t.test('handles unquoted values', () => {
        const yaml = `
year: 2021
`;
        const result = parseMetadataYaml(yaml);
        assert.deepEqual(result, { year: '2021' });
    });

    await t.test('ignores comments and empty lines', () => {
        const yaml = `
# This is a comment

id: "test"
# Another comment
`;
        const result = parseMetadataYaml(yaml);
        assert.deepEqual(result, { id: 'test' });
    });

    await t.test('handles malformed lines without colons', () => {
        const yaml = `
id: "test"
malformed line here
title: "Test Model"
`;
        const result = parseMetadataYaml(yaml);
        assert.deepEqual(result, { id: 'test', title: 'Test Model' });
    });

    await t.test('ignores lines with invalid keys', () => {
        const yaml = `
invalid key: "value"
id: "test"
`;
        const result = parseMetadataYaml(yaml);
        assert.deepEqual(result, { id: 'test' });
    });

    await t.test('handles multiple colons in the value part', () => {
        const yaml = `
url: "https://example.com/test:123"
description: 'A description: with colon'
`;
        const result = parseMetadataYaml(yaml);
        assert.deepEqual(result, { url: 'https://example.com/test:123', description: 'A description: with colon' });
    });

    await t.test('handles arrays parsed as strings', () => {
        const yaml = `
tags: ["one", "two"]
categories: ['a', 'b']
`;
        const result = parseMetadataYaml(yaml);
        assert.deepEqual(result, { tags: '["one", "two"]', categories: "['a', 'b']" });
    });

    await t.test('preserves internal quotes', () => {
        const yaml = `
title: "Model's Title"
desc: 'He said "Hello"'
mixed: "\\'value\\'"
`;
        const result = parseMetadataYaml(yaml);
        assert.deepEqual(result, { title: "Model's Title", desc: 'He said "Hello"', mixed: "\\'value\\'" });
    });
});

test('listMetadataFiles', async (t) => {
    await t.test('returns empty array for non-existent directory', async () => {
        const results = await listMetadataFiles('/non/existent/dir');
        assert.deepEqual(results, []);
    });

    await t.test('finds metadata.yaml files in directory tree', async () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
        try {
            const dir1 = path.join(tempDir, 'dir1');
            const dir2 = path.join(tempDir, 'dir2');
            fs.mkdirSync(dir1);
            fs.mkdirSync(dir2);

            fs.writeFileSync(path.join(dir1, 'metadata.yaml'), 'id: test1');
            fs.writeFileSync(path.join(dir2, 'metadata.yaml'), 'id: test2');
            fs.writeFileSync(path.join(dir1, 'other.txt'), 'not a metadata file');

            const results = await listMetadataFiles(tempDir);
            assert.strictEqual(results.length, 2);
            assert.ok(results.includes(path.join(dir1, 'metadata.yaml')));
            assert.ok(results.includes(path.join(dir2, 'metadata.yaml')));
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });
});

test('main functionality', async (t) => {
    await t.test('curates tags correctly', async () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-curate-'));
        try {
            // Setup directory structure
            const publishedDir = path.join(tempDir, 'Published');
            const modelDir = path.join(publishedDir, 'ModelAuthor2021');
            fs.mkdirSync(publishedDir);
            fs.mkdirSync(modelDir, { recursive: true });

            // Create a metadata file
            const metadataContent = `
id: "test_model"
description: "Model with tnf and egfr signaling."
tags: ["generate_network", "my_var_123", "goodtag", "tnf", "cell_cycle"]
`;
            const metaFile = path.join(modelDir, 'metadata.yaml');
            fs.writeFileSync(metaFile, metadataContent);

            // Run main
            const originalConsoleLog = console.log;
            console.log = () => {}; // Silence output
            try {
                await main(['--root', tempDir]);
            } finally {
                console.log = originalConsoleLog;
            }

            // Verify updated content
            const updatedContent = fs.readFileSync(metaFile, 'utf8');
            const meta = parseMetadataYaml(updatedContent);

            // Expected tags logic:
            // 1. "generate_network" is blacklisted -> removed
            // 2. "my_var_123" is variable-like -> removed
            // 3. "goodtag" is kept (cleanTags)
            // 4. "tnf" is kept and duplicated (from desc) -> deduplicated
            // 5. "cell_cycle" is kept
            // 6. Year "2021" is extracted from path "ModelAuthor2021"
            // 7. Author "modelauthor" is extracted from path
            // 8. "egfr" added from description
            // 9. "signaling" added from description

            const expectedTagsMatch = updatedContent.match(/^tags:\s*\[(.*?)\]\s*$/m);
            assert.ok(expectedTagsMatch, 'Tags line should exist');

            const expectedTags = [
                '2021',
                'cell_cycle',
                'egfr',
                'goodtag',
                'modelauthor',
                'signaling',
                'tnf'
            ].map(t => '"' + t + '"').join(', ');

            assert.strictEqual(expectedTagsMatch[1], expectedTags);

        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    await t.test('updates specific model IDs', async () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-rename-'));
        try {
            // Setup directory structure
            const publishedDir = path.join(tempDir, 'Published');
            const modelDir1 = path.join(publishedDir, 'McMillan2021');
            const modelDir2 = path.join(publishedDir, 'ZAP2021');
            fs.mkdirSync(publishedDir);
            fs.mkdirSync(modelDir1, { recursive: true });
            fs.mkdirSync(modelDir2, { recursive: true });

            // Create a metadata file
            const meta1 = path.join(modelDir1, 'metadata.yaml');
            fs.writeFileSync(meta1, 'id: "McMillan_immunology_2021"\ntags: ["test"]');

            const meta2 = path.join(modelDir2, 'metadata.yaml');
            fs.writeFileSync(meta2, 'id: "ZAP_immunology_2021"\ntags: ["test"]');

            // Also mock normalizer script to test that logic
            const scriptsDir = path.join(tempDir, 'scripts', 'migration');
            fs.mkdirSync(scriptsDir, { recursive: true });
            const normalizerPath = path.join(scriptsDir, 'normalize-published-ids.js');
            fs.writeFileSync(normalizerPath, 'const map = { "McMillan2021": "McMillan_immunology_2021", "ModelZAP": "ZAP_immunology_2021" };');

            // Run main
            const originalConsoleLog = console.log;
            console.log = () => {}; // Silence output
            try {
                await main(['--root', tempDir]);
            } finally {
                console.log = originalConsoleLog;
            }

            // Verify updated content
            const updated1 = fs.readFileSync(meta1, 'utf8');
            assert.match(updated1, /id: "McMillan_TNF_2021"/);

            const updated2 = fs.readFileSync(meta2, 'utf8');
            assert.match(updated2, /id: "ZAP70_immunology_2021"/);

            const updatedNormalizer = fs.readFileSync(normalizerPath, 'utf8');
            assert.match(updatedNormalizer, /"McMillan2021": "McMillan_TNF_2021"/);
            assert.match(updatedNormalizer, /"ModelZAP": "ZAP70_immunology_2021"/);

        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });
});
