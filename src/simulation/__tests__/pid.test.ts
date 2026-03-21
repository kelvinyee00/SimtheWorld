import { createInitialSnapshot, stepSimulation } from "@/src/simulation/engine";
import { COUNTER_BLOCK_TYPE } from "@/src/simulation/blocks/counterBlock";
import { DISPLAY_BLOCK_TYPE } from "@/src/simulation/blocks/displayBlock";
import { PID_BLOCK_TYPE } from "@/src/simulation/blocks/pidBlock";
import { DEFAULT_BLOCK_REGISTRY } from "@/src/simulation/registry";
import { SimulationGraph, SimulationRuntimeSnapshot } from "@/src/simulation/types";

function runTicks(params: {
  graph: SimulationGraph;
  ticks: number;
  stepTimeMs?: number;
  simulationTimeMs?: number;
}): SimulationRuntimeSnapshot {
  const { graph, ticks, stepTimeMs = 100, simulationTimeMs = 10_000 } = params;

  let snapshot = createInitialSnapshot({
    simulationTimeMs,
    stepTimeMs,
  });

  for (let index = 0; index < ticks; index += 1) {
    snapshot = stepSimulation({
      graph,
      registry: DEFAULT_BLOCK_REGISTRY,
      snapshot,
    });
  }

  return snapshot;
}

describe("PID block", () => {
  it("applies proportional gain on scalar error input", () => {
    const graph: SimulationGraph = {
      nodes: [
        { id: "error", type: COUNTER_BLOCK_TYPE, data: { start: 2, step: 0, mode: "inc" } },
        { id: "pid", type: PID_BLOCK_TYPE, data: { kp: 3, ki: 0, kd: 0, n: 10 } },
        { id: "display", type: DISPLAY_BLOCK_TYPE, data: { label: "Display" } },
      ],
      edges: [
        { id: "error->pid", source: "error", target: "pid", targetHandle: "in" },
        { id: "pid->display", source: "pid", target: "display" },
      ],
    };

    const snapshot = runTicks({ graph, ticks: 1, stepTimeMs: 100 });
    const displayState = snapshot.nodeInternalState.display as { value?: unknown };

    expect(snapshot.nodeOutputs.pid?.default).toBe(6);
    expect(displayState.value).toBe(6);
  });

  it("integrates accumulated error deterministically", () => {
    const graph: SimulationGraph = {
      nodes: [
        { id: "error", type: COUNTER_BLOCK_TYPE, data: { start: 1, step: 0, mode: "inc" } },
        { id: "pid", type: PID_BLOCK_TYPE, data: { kp: 0, ki: 2, kd: 0, n: 10 } },
      ],
      edges: [{ id: "error->pid", source: "error", target: "pid", targetHandle: "in" }],
    };

    const afterTick1 = runTicks({ graph, ticks: 1, stepTimeMs: 100 });
    const afterTick2 = runTicks({ graph, ticks: 2, stepTimeMs: 100 });

    expect(afterTick1.nodeOutputs.pid?.default).toBeCloseTo(0.2, 6);
    expect(afterTick2.nodeOutputs.pid?.default).toBeCloseTo(0.4, 6);
  });

  it("uses derivative filter coefficient N for smoothed derivative response", () => {
    const graph: SimulationGraph = {
      nodes: [
        { id: "error", type: COUNTER_BLOCK_TYPE, data: { start: 0, step: 1, mode: "inc" } },
        { id: "pid", type: PID_BLOCK_TYPE, data: { kp: 0, ki: 0, kd: 1, n: 5 } },
      ],
      edges: [{ id: "error->pid", source: "error", target: "pid", targetHandle: "in" }],
    };

    const afterTick2 = runTicks({ graph, ticks: 3, stepTimeMs: 100 });
    const output = afterTick2.nodeOutputs.pid?.default;

    expect(typeof output).toBe("number");
    expect(output as number).toBeGreaterThan(0);
    expect(output as number).toBeLessThan(10);
  });

  it("clamps output to saturation bounds and prevents positive windup", () => {
    const graph: SimulationGraph = {
      nodes: [
        { id: "error", type: COUNTER_BLOCK_TYPE, data: { start: 10, step: 0, mode: "inc" } },
        {
          id: "pid",
          type: PID_BLOCK_TYPE,
          data: {
            kp: 0,
            ki: 5,
            kd: 0,
            n: 10,
            lowerSaturation: -1,
            upperSaturation: 1,
          },
        },
      ],
      edges: [{ id: "error->pid", source: "error", target: "pid", targetHandle: "in" }],
    };

    const snapshot = runTicks({ graph, ticks: 3, stepTimeMs: 100 });
    const pidState = snapshot.nodeInternalState.pid as { integral?: unknown };

    expect(snapshot.nodeOutputs.pid?.default).toBe(1);
    expect(pidState.integral).toBe(0);
  });

  it("clamps output to lower saturation bound for negative error", () => {
    const graph: SimulationGraph = {
      nodes: [
        { id: "error", type: COUNTER_BLOCK_TYPE, data: { start: -10, step: 0, mode: "inc" } },
        {
          id: "pid",
          type: PID_BLOCK_TYPE,
          data: {
            kp: 0,
            ki: 5,
            kd: 0,
            n: 10,
            lowerSaturation: -1,
            upperSaturation: 1,
          },
        },
      ],
      edges: [{ id: "error->pid", source: "error", target: "pid", targetHandle: "in" }],
    };

    const snapshot = runTicks({ graph, ticks: 3, stepTimeMs: 100 });
    const pidState = snapshot.nodeInternalState.pid as { integral?: unknown };

    expect(snapshot.nodeOutputs.pid?.default).toBe(-1);
    expect(pidState.integral).toBe(0);
  });
});
