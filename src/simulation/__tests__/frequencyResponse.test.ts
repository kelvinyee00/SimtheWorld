import { createInitialSnapshot, stepSimulation } from "@/src/simulation/engine";
import { DEFAULT_BLOCK_REGISTRY } from "@/src/simulation/registry";
import { SimulationGraph, SimulationRuntimeSnapshot, SimulationBlockDefinition, BlockStepContext, BlockRegistry } from "@/src/simulation/types";

// Simple block to generate a sine wave for testing
const SINE_SOURCE_BLOCK_TYPE = "sineSource";
const SineSourceBlock: SimulationBlockDefinition = {
  type: SINE_SOURCE_BLOCK_TYPE,
  step: (ctx: BlockStepContext) => {
    const freq = (ctx.params.frequency as number) || 1.0;
    const t = ctx.timeMs / 1000.0;
    return {
      outputs: { default: Math.sin(2 * Math.PI * freq * t) },
    };
  },
};

// Block representing a Gain + Delay system
// y(t) = G * u(t - delay)
const SYSTEM_BLOCK_TYPE = "system";
interface SystemState {
  buffer: number[];
}
const SystemBlock: SimulationBlockDefinition = {
  type: SYSTEM_BLOCK_TYPE,
  initialize: () => ({ buffer: [] }),
  step: (ctx: BlockStepContext) => {
    const gain = (ctx.params.gain as number) || 1.0;
    const delayMs = (ctx.params.delayMs as number) || 0;
    const stepTimeMs = ctx.stepTimeMs;
    const delayTicks = Math.round(delayMs / stepTimeMs);
    
    const state = (ctx.previousState as SystemState) || { buffer: [] };
    const u = (ctx.inputs.default as number) || 0;
    
    const newBuffer = [...state.buffer, u];
    let y = 0;
    if (newBuffer.length > delayTicks) {
      y = (newBuffer.shift() || 0) * gain;
    } else {
      y = 0;
    }
    
    return {
      outputs: { default: y },
      nextState: { buffer: newBuffer },
    };
  },
};

// Create a local registry including the mock blocks
const TEST_REGISTRY: BlockRegistry = {
  ...DEFAULT_BLOCK_REGISTRY,
  [SINE_SOURCE_BLOCK_TYPE]: SineSourceBlock,
  [SYSTEM_BLOCK_TYPE]: SystemBlock,
};

function runTicks(params: {
  graph: SimulationGraph;
  ticks: number;
  stepTimeMs?: number;
  simulationTimeMs?: number;
}): SimulationRuntimeSnapshot {
  const { graph, ticks, stepTimeMs = 1, simulationTimeMs = 100_000 } = params;

  let snapshot = createInitialSnapshot({
    simulationTimeMs,
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

describe("FrequencyResponseSinkBlock", () => {
  it("estimates magnitude and phase for a Gain + Delay system", () => {
    const frequency = 10; // Hz
    const gain = 2.5;
    const delayMs = 5; // 5ms delay -> Phase = -360 * 10 * 0.005 = -18 degrees
    const stepTimeMs = 1;
    const windowSize = 500; // 0.5s of data

    const graph: SimulationGraph = {
      nodes: [
        { id: "src", type: SINE_SOURCE_BLOCK_TYPE, data: { frequency } },
        { id: "sys", type: SYSTEM_BLOCK_TYPE, data: { gain, delayMs } },
        { id: "sink", type: "frequencyResponseSink", data: { frequency, windowSize } },
      ],
      edges: [
        { id: "src->sys", source: "src", target: "sys" },
        { id: "src->sink_u", source: "src", target: "sink", targetHandle: "u" },
        { id: "sys->sink_y", source: "sys", target: "sink", targetHandle: "y" },
      ],
    };

    // Run for 1 second (1000 ticks at 1ms)
    const snapshot = runTicks({ graph, ticks: 1000, stepTimeMs });
    
    const mag = snapshot.nodeOutputs.sink?.magnitude as number;
    const phase = snapshot.nodeOutputs.sink?.phase as number;

    // Expected phase: -360 * 10 * 0.005 = -18
    expect(mag).toBeCloseTo(gain, 1);
    expect(phase).toBeCloseTo(-18, 1);
  });
});
