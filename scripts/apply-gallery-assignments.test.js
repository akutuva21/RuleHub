const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { parseArgs } = require('./apply-gallery-assignments');

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
  // input should remain default because argv[i + 1] is undefined
  assert.strictEqual(args.input, 'gallery-assignments.json');
});

test('parseArgs ignoring missing value for --root', () => {
  const args = parseArgs(['--root']);
  // root should remain default because argv[i + 1] is undefined
  assert.strictEqual(args.root, path.resolve(__dirname, '..'));
});

test('parseArgs ignoring unrecognized arguments', () => {
  const args = parseArgs(['--unknown', 'value', '--input', 'test.json']);
  assert.strictEqual(args.input, 'test.json');
});
