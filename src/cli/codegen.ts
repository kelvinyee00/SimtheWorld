#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { buildCodegenArtifactPackage } from '../codegen/artifactPackage';
import { runSilEquivalence } from '../codegen/silHarness';
import { SimulationGraph } from '../simulation/types';
import { DEFAULT_BLOCK_REGISTRY } from '../simulation/registry';

function printHelp() {
  console.log(`
Usage: web-simulink-codegen [options]

Options:
  --model <path>      Path to the .json model file (required)
  --out <directory>   Output directory for generated artifacts (default: ./generated)
  --sil               Enable SIL (Software-In-the-Loop) validation
  --help              Show this help message
`);
}

async function main() {
  const args = process.argv.slice(2);
  let modelPath = '';
  let outDir = './generated';
  let silMode = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--model') {
      modelPath = args[++i];
    } else if (arg === '--out') {
      outDir = args[++i];
    } else if (arg === '--sil') {
      silMode = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  if (!modelPath) {
    console.error('Error: --model path is required.');
    printHelp();
    process.exit(1);
  }

  if (!fs.existsSync(modelPath)) {
    console.error('Error: Model file not found at ' + modelPath);
    process.exit(1);
  }

  const modelRaw = fs.readFileSync(modelPath, 'utf8');
  let graph: SimulationGraph;
  try {
    graph = JSON.parse(modelRaw);
  } catch (e) {
    console.error('Error: Failed to parse model JSON: ' + e);
    process.exit(1);
  }

  const modelName = path.basename(modelPath, '.json');
  console.log('Generating artifacts for model: ' + modelName);

  const pkg = buildCodegenArtifactPackage({
    modelName,
    graph,
  });

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  for (const file of pkg.files) {
    const filePath = path.join(outDir, file.path);
    fs.writeFileSync(filePath, file.content);
    console.log('  - ' + file.path);
  }

  const manifestPath = path.join(outDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(pkg.manifest, null, 2));
  console.log('  - manifest.json');

  const metadataPath = path.join(outDir, 'metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(pkg.metadata, null, 2));
  console.log('  - metadata.json');

  if (silMode) {
    console.log('Running SIL (Software-In-the-Loop) validation...');
    const silResult = runSilEquivalence({
      modelName,
      graph,
      registry: DEFAULT_BLOCK_REGISTRY,
      ticks: 100,
    });

    const reportPath = path.join(outDir, 'sil_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(silResult.report, null, 2));
    console.log('  - sil_report.json (Pass: ' + silResult.pass + ')');

    if (!silResult.pass) {
      console.warn('WARNING: SIL validation failed. Check sil_report.json for details.');
    }
  }

  console.log('Artifact generation complete. Files written to ' + outDir);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
