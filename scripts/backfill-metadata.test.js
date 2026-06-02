const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseBngl, generateMetadata, formatYaml, formatYamlValue, inferCategory, inferOrigin, extractMetadataFromComments, processActionLine } = require('./backfill-metadata.js');

test('backfill-metadata.js', async (t) => {
  let tmpDir;

  t.beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bionetgen-backfill-test-'));
  });

  t.afterEach(() => {
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  await t.test('parseBngl - parses metadata and tags correctly', async () => {
    const bnglContent = `
# name: Test Model
# doi: 10.1234/test
# description: This is a description of the model.
# Some other comment

begin model
begin parameters
  k1 1.0
end parameters

begin molecule types
  A(b)
end molecule types

begin seed species
  A(b) 100
end seed species

begin observables
  Molecules A_obs A()
end observables

begin functions
  func() 1.0
end functions

begin compartments
  cell  3  1.0
end compartments

begin reaction rules
  A(b) -> null k1
end reaction rules
end model

begin actions
  generate_network({overwrite=>1})
  simulate({method=>"ode", t_end=>10, n_steps=>10})
end actions
`;
    const filePath = path.join(tmpDir, 'test.bngl');
    fs.writeFileSync(filePath, bnglContent);

    const result = await parseBngl(filePath);

    assert.strictEqual(result.name, 'Test Model');
    assert.strictEqual(result.doi, '10.1234/test');
    assert.strictEqual(result.description, 'This is a description of the model.'); // because the parser sets description to the first non-assignment comment
    assert.strictEqual(result.uses_compartments, true);
    assert.strictEqual(result.uses_functions, true);
    assert.strictEqual(result.uses_energy, false);
    assert.deepStrictEqual(result.simulation_methods, ['ode']);
    assert.strictEqual(result.nfsim_compatible, false);
    assert.strictEqual(result.bng2_compatible, true);

    // tags are roughly extracted using `/^(\w+)\s+/`, for instance "Molecules" or "k1" will be captured if there's no `=>` or `=`
    assert.ok(result.tags.includes('k1'));
    assert.ok(result.tags.includes('molecules'));
  });

  await t.test('parseBngl - handles missing actions, implies nfsim_compatible without generate_network', async () => {
    const bnglContent = `
begin model
begin parameters
end parameters
end model
`;
    const filePath = path.join(tmpDir, 'test-no-actions.bngl');
    fs.writeFileSync(filePath, bnglContent);

    const result = await parseBngl(filePath);

    // If there are no actions, it assumes 'ode' by default if length is 0
    // and if there's no generate_network, it marks nfsim_compatible as true
    assert.deepStrictEqual(result.simulation_methods, ['ode']);
    assert.strictEqual(result.nfsim_compatible, true);
  });

  await t.test('parseBngl - extracts various simulation methods from actions', async () => {
    const bnglContent = `
begin model
end model
begin actions
  simulate({method=>"nf"})
  simulate({method=>"ssa"})
  simulate({method=>"pla"})
  simulate({method=>"hybrid"})
end actions
`;
    const filePath = path.join(tmpDir, 'test-methods.bngl');
    fs.writeFileSync(filePath, bnglContent);

    const result = await parseBngl(filePath);

    assert.ok(result.simulation_methods.includes('nf'));
    assert.ok(result.simulation_methods.includes('ssa'));
    assert.ok(result.simulation_methods.includes('pla'));
    assert.ok(result.simulation_methods.includes('hybrid'));
    assert.strictEqual(result.nfsim_compatible, true); // Since method=>"nf" is present
  });

  await t.test('parseBngl - infers energy / Phi usage', async () => {
    const bnglContent = `
begin model
begin reaction rules
  # uses energy
  A() -> B()  Arrhenius(Phi)
end reaction rules
end model
`;
    const filePath = path.join(tmpDir, 'test-energy.bngl');
    fs.writeFileSync(filePath, bnglContent);

    const result = await parseBngl(filePath);
    assert.strictEqual(result.uses_energy, true);
  });
  await t.test('generateMetadata - structures metadata with generated id, category, origin, and compatibility', async () => {
    // create fake paths inside tmpDir to test path inferencing
    // structure: <tmpDir>/Published/Test_Paper/test_model.bngl
    const publishedDir = path.join(tmpDir, 'Published', 'Test_Paper');
    fs.mkdirSync(publishedDir, { recursive: true });

    const filePath = path.join(publishedDir, 'test_model.bngl');
    fs.writeFileSync(filePath, 'begin model\nend model');

    // Simulate parsed output from parseBngl
    const parsed = {
      name: 'Parsed Name',
      description: 'Parsed Description',
      tags: ['tag1'],
      uses_compartments: true,
      uses_energy: false,
      uses_functions: false,
      simulation_methods: ['ode'],
      nfsim_compatible: false,
      bng2_compatible: true
    };

    const cwdOrig = process.cwd();
    process.chdir(tmpDir); // set cwd to tmpDir to test relative path inferencing
    try {
      const result = generateMetadata(filePath, parsed);

      // Verify category inference
      // Because the path includes "Test", `inferCategory` matches "test" and returns "validation"
      assert.strictEqual(result.category, 'validation');

      // Verify origin inference inside `source`
      // `inferOrigin` looks for paths starting with 'published'
      assert.strictEqual(result.source.origin, 'published');

      // Verify id generation
      assert.strictEqual(result.id, 'Test_Paper_test_model');

      // Verify basic fields
      assert.strictEqual(result.name, 'Parsed Name');
      assert.strictEqual(result.description, 'Parsed Description');
      assert.deepStrictEqual(result.tags, ['tag1']);

      // Verify nested properties (compatibility)
      assert.deepStrictEqual(result.compatibility, {
        bng2_compatible: true,
        nfsim_compatible: false,
        simulation_methods: ['ode'],
        uses_compartments: true,
        uses_energy: false,
        uses_functions: false
      });

    } finally {
      process.chdir(cwdOrig);
    }
  });

  await t.test('inferCategory - returns appropriate category based on directory path', () => {
    // We pass absolute paths as inferCategory uses path.relative(process.cwd(), dirPath).
    // The easiest way is to append paths to the current cwd.
    const cwd = process.cwd();

    // immunology
    assert.strictEqual(inferCategory(path.join(cwd, 'foo', 'immune', 'bar')), 'immunology');
    assert.strictEqual(inferCategory(path.join(cwd, 'tcr_model')), 'immunology');
    assert.strictEqual(inferCategory(path.join(cwd, 'bcr')), 'immunology');
    assert.strictEqual(inferCategory(path.join(cwd, 'fceri_pathway')), 'immunology');
    assert.strictEqual(inferCategory(path.join(cwd, 'cytokine_network')), 'immunology');
    assert.strictEqual(inferCategory(path.join(cwd, 'innate')), 'immunology');

    // signaling
    assert.strictEqual(inferCategory(path.join(cwd, 'foo', 'egfr', 'bar')), 'signaling');
    assert.strictEqual(inferCategory(path.join(cwd, 'mapk')), 'signaling');
    assert.strictEqual(inferCategory(path.join(cwd, 'ras')), 'signaling');
    assert.strictEqual(inferCategory(path.join(cwd, 'tumor_model')), 'signaling');
    assert.strictEqual(inferCategory(path.join(cwd, 'cancer_cells')), 'signaling');
    assert.strictEqual(inferCategory(path.join(cwd, 'signaling_pathway')), 'signaling');

    // epidemiology
    assert.strictEqual(inferCategory(path.join(cwd, 'sir_model')), 'epidemiology');
    assert.strictEqual(inferCategory(path.join(cwd, 'covid19')), 'epidemiology');
    assert.strictEqual(inferCategory(path.join(cwd, 'epidem')), 'epidemiology');

    // cell-cycle
    assert.strictEqual(inferCategory(path.join(cwd, 'cell_cycle_model')), 'cell-cycle');

    // metabolism
    assert.strictEqual(inferCategory(path.join(cwd, 'metabolomics')), 'metabolism');

    // neuroscience
    assert.strictEqual(inferCategory(path.join(cwd, 'neural_net')), 'neuroscience');
    assert.strictEqual(inferCategory(path.join(cwd, 'neuron_model')), 'neuroscience');
    assert.strictEqual(inferCategory(path.join(cwd, 'brain_sim')), 'neuroscience');

    // ecology
    assert.strictEqual(inferCategory(path.join(cwd, 'ecology_study')), 'ecology');
    assert.strictEqual(inferCategory(path.join(cwd, 'population_dynamics')), 'ecology');

    // tutorial
    assert.strictEqual(inferCategory(path.join(cwd, 'tutorial_1')), 'tutorial');

    // validation
    assert.strictEqual(inferCategory(path.join(cwd, 'test_case')), 'validation');

    // other
    assert.strictEqual(inferCategory(path.join(cwd, 'unknown_model')), 'other');
    assert.strictEqual(inferCategory(path.join(cwd, 'random', 'dir')), 'other');
  });

  await t.test('inferOrigin - infers origin based on path', async (st) => {
    const cwd = process.cwd();

    await st.test('infers published for Published directory', () => {
      assert.strictEqual(inferOrigin(path.join(cwd, 'Published', 'Model1')), 'published');
      assert.strictEqual(inferOrigin(path.join(cwd, 'PUBLISHED', 'Model1')), 'published');
    });

    await st.test('infers ai-generated for Examples with AI prefix', () => {
      assert.strictEqual(inferOrigin(path.join(cwd, 'Examples', 'AI-Generated-Model')), 'ai-generated');
      assert.strictEqual(inferOrigin(path.join(cwd, 'Examples', 'aigenerated-Model')), 'ai-generated');
      assert.strictEqual(inferOrigin(path.join(cwd, 'EXAMPLES', 'ai-generated-Model')), 'ai-generated');
    });

    await st.test('infers ai-generated for Examples without AI prefix (fallback)', () => {
      assert.strictEqual(inferOrigin(path.join(cwd, 'Examples', 'Some-Model')), 'ai-generated');
    });

    await st.test('infers tutorial for Tutorials directory', () => {
      assert.strictEqual(inferOrigin(path.join(cwd, 'Tutorials', 'Basic')), 'tutorial');
      assert.strictEqual(inferOrigin(path.join(cwd, 'TUTORIALS', 'Basic')), 'tutorial');
    });

    await st.test('infers contributed when path contains contributed', () => {
      assert.strictEqual(inferOrigin(path.join(cwd, 'SomeDir', 'Contributed-Model')), 'contributed');
      assert.strictEqual(inferOrigin(path.join(cwd, 'SomeDir', 'CONTRIBUTED-Model')), 'contributed');
    });

    await st.test('infers test-case for unknown paths', () => {
      assert.strictEqual(inferOrigin(path.join(cwd, 'Unknown', 'Dir')), 'test-case');
    });
  });
});

test('formatYaml', async (t) => {
  await t.test('skips undefined and null values', async () => {
    const obj = { a: 1, b: undefined, c: null, d: 'four' };
    assert.strictEqual(formatYaml(obj), 'a: 1\nd: four\n');
  });

  await t.test('formats empty arrays', async () => {
    const obj = { a: [] };
    assert.strictEqual(formatYaml(obj), 'a: []\n');
    assert.strictEqual(formatYaml(obj, 1), '  a: []\n');
  });

  await t.test('formats arrays of primitives', async () => {
    const obj = { a: [1, 2, 3], b: ['one', 'two'], c: [true, false] };
    const expected = 'a: [1, 2, 3]\nb: ["one", "two"]\nc: [true, false]\n';
    assert.strictEqual(formatYaml(obj), expected);
  });

  await t.test('formats arrays of objects', async () => {
    const obj = { a: [{ x: 1 }, { y: 2 }] };
    const expected = 'a:\n  - x: 1\n  - y: 2\n';
    assert.strictEqual(formatYaml(obj), expected);
    const expectedIndented = '  a:\n    - x: 1\n    - y: 2\n';
    assert.strictEqual(formatYaml(obj, 1), expectedIndented);
  });

  await t.test('formats mixed arrays', async () => {
    const obj = { a: [1, { x: 1 }] };
    const expected = 'a:\n  - 1\n  - x: 1\n';
    assert.strictEqual(formatYaml(obj), expected);
  });

  await t.test('formats nested objects', async () => {
    const obj = { a: { b: 1, c: { d: 2 } } };
    const expected = 'a:\n  b: 1\n  c:\n    d: 2\n';
    assert.strictEqual(formatYaml(obj), expected);
  });

  await t.test('formats basic properties', async () => {
    const obj = { a: 1, b: true, c: 'string' };
    const expected = 'a: 1\nb: true\nc: string\n';
    assert.strictEqual(formatYaml(obj), expected);
  });
});

test('formatYamlValue', async (t) => {
  await t.test('formats strings correctly', async () => {
    assert.strictEqual(formatYamlValue('hello'), 'hello\n');
    assert.strictEqual(formatYamlValue('world', 2), 'world\n');
  });

  await t.test('formats numbers correctly', () => {
    assert.strictEqual(formatYamlValue(42), '42\n');
    assert.strictEqual(formatYamlValue(3.14), '3.14\n');
  });

  await t.test('formats booleans correctly', () => {
    assert.strictEqual(formatYamlValue(true), 'true\n');
    assert.strictEqual(formatYamlValue(false), 'false\n');
  });

  await t.test('formats flat objects correctly', () => {
    const obj = { a: 1, b: 'two' };
    assert.strictEqual(formatYamlValue(obj), 'a: 1\nb: two\n');
    assert.strictEqual(formatYamlValue(obj, 1), 'a: 1\n  b: two\n');
  });

  await t.test('formats nested objects correctly', () => {
    const obj = { a: 1, b: { c: 'two' } };
    assert.strictEqual(formatYamlValue(obj), 'a: 1\n\nb:\nc: two\n\n');
    assert.strictEqual(formatYamlValue(obj, 1), 'a: 1\n  \n  b:\nc: two\n\n');
  });

  await t.test('formats arrays correctly', () => {
    assert.strictEqual(formatYamlValue([1, 2]), '0: 1\n1: 2\n');
  });

  await t.test('handles undefined correctly', () => {
    assert.strictEqual(formatYamlValue(undefined), 'undefined\n');
  });

  await t.test('handles null correctly', () => {
    assert.strictEqual(formatYamlValue(null), 'null\n');
  });
});

test('extractMetadataFromComments', async (t) => {
  await t.test('does nothing if headerComments is empty', () => {
    const metadata = { name: '', description: '', doi: '', tags: new Set() };
    extractMetadataFromComments([], metadata);
    assert.deepStrictEqual(metadata, { name: '', description: '', doi: '', tags: new Set() });
  });

  await t.test('extracts model name correctly and overwrites', () => {
    const metadata = { name: 'Existing Name', description: '', doi: '', tags: new Set() };
    extractMetadataFromComments(['name: Test Model Name'], metadata);
    assert.strictEqual(metadata.name, 'Test Model Name');
  });

  await t.test('extracts DOI correctly and overwrites', () => {
    const metadata = { name: '', description: '', doi: 'old.doi', tags: new Set() };
    extractMetadataFromComments(['doi: 10.1234/test.doi'], metadata);
    assert.strictEqual(metadata.doi, '10.1234/test.doi');
  });

  await t.test('extracts description and does not overwrite existing description', () => {
    const metadata = { name: '', description: 'Existing Description', doi: '', tags: new Set() };
    extractMetadataFromComments(['description: New Description'], metadata);
    assert.strictEqual(metadata.description, 'Existing Description');

    const metadata2 = { name: '', description: '', doi: '', tags: new Set() };
    extractMetadataFromComments(['description: First Description', 'description: Second Description'], metadata2);
    assert.strictEqual(metadata2.description, 'First Description');
  });

  await t.test('extracts tags correctly and trims them', () => {
    const metadata = { name: '', description: '', doi: '', tags: new Set(['existing-tag']) };
    extractMetadataFromComments(['tags: tag1, tag2 , tag3'], metadata);
    assert.deepStrictEqual(metadata.tags, new Set(['existing-tag', 'tag1', 'tag2', 'tag3']));
  });

  await t.test('ignores invalid or unhandled keys', () => {
    const metadata = { name: 'Init', description: 'Init', doi: 'Init', tags: new Set() };
    extractMetadataFromComments(['invalid-key: some value', 'unhandled: value'], metadata);
    assert.strictEqual(metadata.name, 'Init');
    assert.strictEqual(metadata.description, 'Init');
    assert.strictEqual(metadata.doi, 'Init');
    assert.deepStrictEqual(metadata.tags, new Set());
  });

  await t.test('ignores comments not matching regex', () => {
    const metadata = { name: '', description: '', doi: '', tags: new Set() };
    extractMetadataFromComments(['just some regular comment', 'no colon here', 'name : bad format'], metadata);
    assert.strictEqual(metadata.name, '');
    assert.strictEqual(metadata.description, '');
    assert.strictEqual(metadata.doi, '');
    assert.deepStrictEqual(metadata.tags, new Set());
  });

  await t.test('extracts everything together', () => {
    const metadata = { name: '', description: '', doi: '', tags: new Set() };
    const comments = [
      'name: Full Model',
      'doi: 10.9999/full',
      'description: A description of the full model',
      'tags: t1, t2',
      'ignored: this is ignored',
      'just some text'
    ];
    extractMetadataFromComments(comments, metadata);
    assert.strictEqual(metadata.name, 'Full Model');
    assert.strictEqual(metadata.doi, '10.9999/full');
    assert.strictEqual(metadata.description, 'A description of the full model');
    assert.deepStrictEqual(metadata.tags, new Set(['t1', 't2']));
  });

  await t.test('processActionLine', async (st) => {
    await st.test('parses method correctly with quotes and sets nfsim_compatible for nf', () => {
      const metadata = { simulation_methods: [], nfsim_compatible: false };
      processActionLine('simulate({method=>"nf",t_end=>10})', metadata);
      assert.deepStrictEqual(metadata.simulation_methods, ['nf']);
      assert.strictEqual(metadata.nfsim_compatible, true);
    });

    await st.test('parses method with spaces around the operator', () => {
      const metadata = { simulation_methods: [], nfsim_compatible: false };
      processActionLine('simulate({method => "ode", t_end=>10})', metadata);
      assert.deepStrictEqual(metadata.simulation_methods, ['ode']);
      assert.strictEqual(metadata.nfsim_compatible, false);
    });

    await st.test('parses method without quotes', () => {
      const metadata = { simulation_methods: [], nfsim_compatible: false };
      processActionLine('simulate({method=>ode, t_end=>10})', metadata);
      assert.deepStrictEqual(metadata.simulation_methods, ['ode']);
      assert.strictEqual(metadata.nfsim_compatible, false);
    });

    await st.test('parses method with single quotes', () => {
      const metadata = { simulation_methods: [], nfsim_compatible: false };
      processActionLine("simulate({method=>'ssa', t_end=>10})", metadata);
      assert.deepStrictEqual(metadata.simulation_methods, ['ssa']);
      assert.strictEqual(metadata.nfsim_compatible, false);
    });

    await st.test('ignores lines without simulate', () => {
      const metadata = { simulation_methods: [], nfsim_compatible: false };
      processActionLine('generate_network({overwrite=>1})', metadata);
      assert.deepStrictEqual(metadata.simulation_methods, []);
      assert.strictEqual(metadata.nfsim_compatible, false);
    });

    await st.test('ignores simulate lines without method', () => {
      const metadata = { simulation_methods: [], nfsim_compatible: false };
      processActionLine('simulate({t_end=>10, n_steps=>100})', metadata);
      assert.deepStrictEqual(metadata.simulation_methods, []);
      assert.strictEqual(metadata.nfsim_compatible, false);
    });
  });
});
