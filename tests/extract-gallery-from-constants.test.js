const { test } = require('node:test');
const assert = require('node:assert');
const {
  parseArgs,
  parseSetFromString,
  extractAllModelIds,
  extractCategoryMappings,
  main
} = require('../scripts/migration/extract-gallery-from-constants');

test('parseArgs parses arguments correctly', (t) => {
  const args = ['--input', 'foo.ts', '--output', 'bar.json'];
  const result = parseArgs(args);
  assert.deepStrictEqual(result, { constantsPath: 'foo.ts', output: 'bar.json' });
});

test('parseArgs handles missing output argument and falls back to default', (t) => {
  const args = ['--input', 'foo.ts'];
  const result = parseArgs(args);
  assert.deepStrictEqual(result, { constantsPath: 'foo.ts', output: 'gallery-assignments.json' });
});

test('parseArgs exits with error if missing --input argument', (t) => {
  const originalError = console.error;
  const originalExit = process.exit;

  let exitCode = null;
  let errorMessage = '';

  console.error = (msg) => {
    errorMessage = msg;
  };
  process.exit = (code) => {
    exitCode = code;
  };

  const args = ['--output', 'bar.json'];
  parseArgs(args);

  assert.strictEqual(exitCode, 1);
  assert.ok(errorMessage.includes('Usage: node extract-gallery-from-constants.js --input <path-to-constants.ts> [--output gallery-assignments.json]'));

  console.error = originalError;
  process.exit = originalExit;
});

test('parseSetFromString parses a simple Set correctly', (t) => {
  const content = `
export const BNG2_COMPATIBLE_MODELS = new Set([
  'model-1',
  'model-2',
  'model-3',
]);
  `;
  const result = parseSetFromString(content, 'BNG2_COMPATIBLE_MODELS');
  assert.strictEqual(result.size, 3);
  assert.ok(result.has('model-1'));
  assert.ok(result.has('model-2'));
  assert.ok(result.has('model-3'));
});

test('parseSetFromString returns an empty Set if not found', (t) => {
  const content = `
export const OTHER_SET = new Set([
  'model-1',
]);
  `;
  const result = parseSetFromString(content, 'BNG2_COMPATIBLE_MODELS');
  assert.strictEqual(result.size, 0);
});

test('extractAllModelIds extracts model IDs from source arrays', (t) => {
  const content = `
const TUTORIALS: Example[] = [
  {
    id: 'tutorial-1',
    name: 'Tutorial 1',
  },
  {
    id: "tutorial-2",
    name: 'Tutorial 2',
  }
];

const TEST_MODELS: Example[] = [
  {
    id: 'test-1',
  }
];
  `;
  const result = extractAllModelIds(content);
  assert.strictEqual(result.size, 3);
  assert.ok(result.has('tutorial-1'));
  assert.ok(result.has('tutorial-2'));
  assert.ok(result.has('test-1'));
});

test('extractAllModelIds returns empty Set if no arrays found', (t) => {
  const content = `
const OTHER_ARRAY: Example[] = [
  {
    id: 'other-1',
  }
];
  `;
  const result = extractAllModelIds(content);
  assert.strictEqual(result.size, 0);
});

test('extractCategoryMappings extracts standard mappings', (t) => {
  const content = `
    const cancerModels = CANCER_MODELS.filter(m => ['cancer-1', 'cancer-2'].includes(m.id));
    const immunologyModels = IMMUNOLOGY_MODELS.filter(m => ['immuno-1'].includes(m.id));
  `;
  const result = extractCategoryMappings(content);
  assert.deepStrictEqual(result, {
    'cancer-1': 'cancer',
    'cancer-2': 'cancer',
    'immuno-1': 'immunology',
  });
});

test('extractCategoryMappings extracts tutorials', (t) => {
  const content = `
const TUTORIALS: Example[] = [
  { id: 'tutorial-1' },
  { id: "tutorial-2" },
];
  `;
  const result = extractCategoryMappings(content);
  assert.deepStrictEqual(result, {
    'tutorial-1': ['tutorials'],
    'tutorial-2': ['tutorials'],
  });
});

test('extractCategoryMappings extracts native tutorials', (t) => {
  const content = `
const native = NATIVE_TUTORIALS.filter(m => ["native-1", "native-2"].includes(m.id));
  `;
  const result = extractCategoryMappings(content);
  assert.deepStrictEqual(result, {
    'native-1': ['native-tutorials'],
    'native-2': ['native-tutorials'],
  });
});
