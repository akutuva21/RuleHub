# RuleHub

RuleHub is the canonical repository for curated BioNetGen and BNGL model content used across the RuleWorld ecosystem.

It now serves two roles:

- a human-browsable archive of published, contributed, tutorial, and validation models
- the machine-readable source of truth for metadata consumed by tools such as BNG Playground

## Repository layout

The repository is organized into a few top-level collections:

- `Published/`: literature-backed and curated research models
- `Contributed/`: contributed model sets, including BNG Playground examples and validation fixtures
- `Tutorials/`: tutorial and teaching-oriented BNGL models
- `PyBioNetGen/`: PyBioNetGen reference, benchmark, and support model collections

Most model directories contain:

- one or more `.bngl` files
- `metadata.yaml`
- `README.md`

Examples:

- `Published/Faeder2003/`
- `Contributed/BNGPlayground_Examples/...`
- `Contributed/BNGPlayground_Validation/...`
- `Tutorials/General/polymer/`
- `Tutorials/NativeTutorials/...`

## Metadata and manifest

RuleHub now includes a repository-wide metadata and discovery layer:

- `metadata-schema.yaml`: schema for per-directory metadata
- `manifest.json`: generated manifest describing discoverable model entries
- `scripts/validate-metadata.js`: local metadata validator
- `scripts/generate-manifest.js`: manifest generator

This metadata is used for:

- model discovery and indexing
- gallery visibility and categorization
- compatibility flags such as `bng2_compatible`
- provenance for published, tutorial, test-case, and AI-generated contributed models

## BNG Playground integration

BNG Playground no longer keeps its own bundled BNGL corpus as the runtime source of truth.

Instead:

- RuleHub hosts the model content and metadata
- BNG Playground resolves models from RuleHub metadata and manifest outputs
- local playground analysis and migration scripts may use a local RuleHub checkout via `RULEHUB_ROOT`

That means updates to model metadata, visibility, provenance, and organization should now happen here in RuleHub.

## Validation workflow

Before opening a pull request that adds or changes model content, run:

```bash
node scripts/validate-metadata.js
node scripts/generate-manifest.js --root . --output manifest.json
```

The repository also includes CI validation in `.github/workflows/validate.yml`.

## Adding models

For model submission and curation rules, see [AddingModels.md](AddingModels.md).

In general, contributors should:

1. place models in the appropriate top-level collection
2. add or update `metadata.yaml`
3. add or update `README.md`
4. describe multi-file collections with a `collection` section when applicable
5. validate metadata and regenerate `manifest.json`

## Notes on migrated content

RuleHub now contains migrated content that previously lived only inside BNG Playground, including:

- BNG Playground example models
- validation fixtures
- tutorial collections
- runtime-only BNGL models that required explicit preservation

Those migrated entries keep provenance in `metadata.yaml`, including source-path history where relevant.

## Quick links

- [AddingModels.md](AddingModels.md)
- [metadata-schema.yaml](metadata-schema.yaml)
- [manifest.json](manifest.json)
- [Published](Published)
- [Contributed](Contributed)
- [Tutorials](Tutorials)
- [PyBioNetGen](PyBioNetGen)
