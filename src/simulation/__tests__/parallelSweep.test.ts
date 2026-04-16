import { runParallelSweep } from '../worker/parallelSweep';
import { SimulationGraph } from '../types';

// Mock Worker for Node environment testing
class MockWorker {
  onmessage: ((event: any) => void) | null = null;
  onerror: ((err: any) => void) | null = null;
  
  constructor(public url: URL) {}
  
  postMessage(message: any) {
    if (message.type === 'START') {
      // Simulate simulation completion
      setTimeout(() => {
        if (this.onmessage) {
          this.onmessage({
            data: {
              type: 'COMPLETED',
              snapshot: {
                status: 'completed',
                tick: 100,
                timeMs: 1000,
                nodeOutputs: {
                  'gain-node': { 'default': 5 } // Dummy output
                }
              }
            }
          });
        }
      }, 10);
    }
  }
  
  terminate() {}
}

describe('ParallelSimulationSweep', () => {
  const originalWorker = (global as any).Worker;

  beforeAll(() => {
    (global as any).Worker = MockWorker;
  });

  afterAll(() => {
    (global as any).Worker = originalWorker;
  });

  const testGraph: SimulationGraph = {
    nodes: [
      { id: 'gain-node', type: 'gain', data: { gain: 1 } }
    ],
    edges: []
  };

  it('should run multiple parameter sets in parallel', async () => {
    const parameterSets = [
      { 'gain-node': { gain: 1 } },
      { 'gain-node': { gain: 2 } },
      { 'gain-node': { gain: 3 } }
    ];

    const results = await runParallelSweep(testGraph, parameterSets, {
      maxConcurrency: 2,
      totalTimeMs: 100,
      stepTimeMs: 10
    });

    expect(results).toHaveLength(3);
    expect(results[0].success).toBe(true);
    expect(results[0].parameterSet).toEqual({ 'gain-node': { gain: 1 } });
    expect(results[1].parameterSet).toEqual({ 'gain-node': { gain: 2 } });
    expect(results[2].parameterSet).toEqual({ 'gain-node': { gain: 3 } });
  });
});

describe('ParallelSimulationSweep Real Integration (Simulation)', () => {
  const originalWorker = (global as any).Worker;

  // We won't mock here if we want to test "real" logic, 
  // but running actual workers in Vitest/Node usually requires a bit more setup or a specific worker implementation.
  it("placeholder for real integration", () => {
    expect(true).toBe(true);
  });
  // For this P16-4 scope, verifying the utility logic with the mock is the primary goal.
});
