#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { runHeadlessEngine } from './engine-driver';
import { SimulationGraph } from '../simulation/types';

function printHelp() {
  console.log(`
Usage: web-simulink-run [options]

Options:
  --model <path>      Path to the .json model file (required)
  --ticks <number>    Number of ticks to run (default: 100)
  --step <ms>         Step time in milliseconds (default: 10)
  --out <path>        Path to save final state JSON
  --help              Show this help message
`);
}

async function main() {
  const args = process.argv.slice(2);
  let modelPath = '';
  let ticks = 100;
  let stepTimeMs = 10;
  let outPath = '';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--model') {
      modelPath = args[++i];
    } else if (arg === '--ticks') {
      ticks = parseInt(args[++i], 10);
    } else if (arg === '--step') {
      stepTimeMs = parseInt(args[++i], 10);
    } else if (arg === '--out') {
      outPath = args[++i];
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

  const finalState = await runHeadlessEngine({
    graph,
    ticks,
    stepTimeMs,
    onTick: (t) => {
      if (t % 10 === 0) console.log(`  - Tick ${t}`);
    }
  });

  if (outPath) {
    fs.writeFileSync(outPath, JSON.stringify(finalState, null, 2));
    console.log('Final state written to ' + outPath);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
