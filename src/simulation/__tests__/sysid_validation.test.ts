import { createInitialSnapshot, stepSimulation } from "@/src/simulation/engine";
import { DEFAULT_BLOCK_REGISTRY } from "@/src/simulation/registry";
import { SimulationGraph, SimulationRuntimeSnapshot, BlockRegistry, SimulationBlockDefinition, BlockStepContext } from "@/src/simulation/types";
import { DISCRETE_TRANSFER_FCN_BLOCK_TYPE } from "../blocks/discreteTransferFcnBlock";
import { RLS_ESTIMATOR_BLOCK_TYPE } from "../blocks/rlsEstimatorBlock";

// MOCK BLOCKS for validation
const RANDOM_BLOCK_TYPE = "random";
const RandomBlock: SimulationBlockDefinition = {
  type: RANDOM_BLOCK_TYPE,
  step: (ctx: BlockStepContext) => {
    const min = (ctx.params.min as number) || 0;
    const max = (ctx.params.max as number) || 1;
    return {
      outputs: { default: min + Math.random() * (max - min) },
    };
  },
};

const SINE_WAVE_BLOCK_TYPE = "sineWave";
const SineWaveBlock: SimulationBlockDefinition = {
  type: SINE_WAVE_BLOCK_TYPE,
  step: (ctx: BlockStepContext) => {
    const freq = (ctx.params.frequency as number) || 1.0;
    const amp = (ctx.params.amplitude as number) || 1.0;
    const t = ctx.timeMs / 1000.0;
    return {
      outputs: { default: amp * Math.sin(2 * Math.PI * freq * t) },
    };
  },
};

const TEST_REGISTRY: BlockRegistry = {
  ...DEFAULT_BLOCK_REGISTRY,
  [RANDOM_BLOCK_TYPE]: RandomBlock,
  [SINE_WAVE_BLOCK_TYPE]: SineWaveBlock,
};

// Helper to run simulation for a given number of ticks
function runTicks(params: {
  graph: SimulationGraph;
  ticks: number;
  stepTimeMs?: number;
}): SimulationRuntimeSnapshot {
  const { graph, ticks, stepTimeMs = 1 } = params;

  let snapshot = createInitialSnapshot({
    simulationTimeMs: ticks * stepTimeMs,
    stepTimeMs,
  });

  for (let index = 0; index < ticks; index += 1) {
    snapshot = stepSimulation({
      graph,
      registry: TEST_REGISTRY,
      snapshot,
    });
  }

  return snapshot;
}

interface Complex {
  re: number;
  im: number;
}

describe("System Identification Validation", () => {
  // 2nd-order Low-Pass Filter
  // H(z) = (b0 + b1*z^-1 + b2*z^-2) / (1 + a1*z^-1 + a2*z^-2)
  // Let's pick a Butterworth-like filter at fs=100Hz, fc=10Hz
  // Example coefficients for a discrete 2nd order LPF
  const numerator = [0.067455, 0.13491, 0.067455];
  const denominator = [1.0, -1.14298, 0.41280];

  describe("RLS Identification", () => {
    // Current RLSEstimatorBlock implementation is restricted to order=1 and phi=[u].
    // This test validates that the block correctly identifies a simple gain (Order 1).
    it("converges to a simple gain (current RLS implementation limit)", () => {
      const stepTimeMs = 10;
      const ticks = 500;
      const gainValue = 3.5;

      const graph: SimulationGraph = {
        nodes: [
          { 
            id: "noise", 
            type: RANDOM_BLOCK_TYPE, 
            data: { min: -1, max: 1 } 
          },
          { 
            id: "plant", 
            type: "gain", 
            data: { gain: gainValue } 
          },
          { 
            id: "rls", 
            type: RLS_ESTIMATOR_BLOCK_TYPE, 
            data: { 
              order: 1,
              forgettingFactor: 0.98,
              initialP: 1000 
            } 
          },
        ],
        edges: [
          { id: "n->p", source: "noise", target: "plant" },
          { id: "n->rls_u", source: "noise", target: "rls", targetHandle: "u" },
          { id: "p->rls_y", source: "plant", target: "rls", targetHandle: "y" },
        ],
      };

      const snapshot = runTicks({ graph, ticks, stepTimeMs });
      const state = snapshot.nodeInternalState.rls as { theta: number[] } | undefined;
      const theta = state?.theta;
      
      expect(theta).toBeDefined();
      if (theta) {
        expect(theta[0]).toBeCloseTo(gainValue, 1);
      }
    });
  });

  describe("Frequency Sweep Validation", () => {
    const testFrequencies = [1, 5, 10, 20]; // Hz
    
    testFrequencies.forEach(freq => {
      it(`accurately identifies magnitude and phase at ${freq}Hz`, () => {
        const stepTimeMs = 2; // 500Hz sampling
        const windowSize = 1000; // 2 seconds window
        const ticks = 1500; // Run long enough to fill window and stabilize

        const graph: SimulationGraph = {
          nodes: [
            { 
              id: "sine", 
              type: SINE_WAVE_BLOCK_TYPE, 
              data: { frequency: freq, amplitude: 1 } 
            },
            { 
              id: "plant", 
              type: DISCRETE_TRANSFER_FCN_BLOCK_TYPE, 
              data: { numerator, denominator } 
            },
            { 
              id: "sink", 
              type: "frequencyResponseSink", 
              data: { frequency: freq, windowSize } 
            },
          ],
          edges: [
            { id: "s->p", source: "sine", target: "plant" },
            { id: "s->sink_u", source: "sine", target: "sink", targetHandle: "u" },
            { id: "p->sink_y", source: "plant", target: "sink", targetHandle: "y" },
          ],
        };

        const snapshot = runTicks({ graph, ticks, stepTimeMs });
        
        const measuredMag = snapshot.nodeOutputs.sink?.magnitude as number;
        const measuredPhase = snapshot.nodeOutputs.sink?.phase as number;

        // Calculate theoretical H(z) at z = exp(j * 2 * pi * f * Ts)
        const Ts = stepTimeMs / 1000;
        const omega = 2 * Math.PI * freq;
        const z_inv: Complex = { 
          re: Math.cos(-omega * Ts), 
          im: Math.sin(-omega * Ts) 
        };
        
        // Simple complex math helpers
        const c_mul = (a: Complex, b: Complex): Complex => ({
          re: a.re * b.re - a.im * b.im,
          im: a.re * b.im + a.im * b.re
        });
        const c_add = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });
        const c_div = (a: Complex, b: Complex): Complex => {
          const den = b.re * b.re + b.im * b.im;
          return {
            re: (a.re * b.re + a.im * b.im) / den,
            im: (a.im * b.re - a.re * b.im) / den
          };
        };

        const z_inv2 = c_mul(z_inv, z_inv);

        // Num = b0 + b1*z^-1 + b2*z^-2
        const numZ = c_add(
          { re: numerator[0], im: 0 },
          c_add(
            c_mul({ re: numerator[1], im: 0 }, z_inv),
            c_mul({ re: numerator[2], im: 0 }, z_inv2)
          )
        );

        // Den = 1 + a1*z^-1 + a2*z^-2
        const denZ = c_add(
          { re: denominator[0], im: 0 },
          c_add(
            c_mul({ re: denominator[1], im: 0 }, z_inv),
            c_mul({ re: denominator[2], im: 0 }, z_inv2)
          )
        );

        const H = c_div(numZ, denZ);
        const theoreticalMag = Math.sqrt(H.re * H.re + H.im * H.im);
        const theoreticalPhase = Math.atan2(H.im, H.re) * (180 / Math.PI);

        expect(measuredMag).toBeCloseTo(theoreticalMag, 1);
        // Phase can be wrapped, but for these frequencies it should be fine
        expect(measuredPhase).toBeCloseTo(theoreticalPhase, 2);
      });
    });
  });
});
