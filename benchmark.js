const { main } = require('./scripts/generate-gallery');

async function runBenchmark() {
  console.log("Warming up...");
  await main(['--root', '.']);

  const start = Date.now();
  const iterations = 10;
  for (let i = 0; i < iterations; i++) {
    await main(['--root', '.']);
  }
  const end = Date.now();
  console.log(`Average time per run: ${(end - start) / iterations} ms`);
}

runBenchmark().catch(console.error);
