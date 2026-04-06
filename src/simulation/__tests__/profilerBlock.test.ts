import { describe, expect, it } from "vitest";
import { ProfilerBlock } from "@/src/simulation/blocks/profilerBlock";

describe("Profiler Block (P13-3)", () => {
  it("initializes with zero metrics", () => {
    const result = ProfilerBlock.step({
      tick: 0,
      timeMs: 0,
      stepTimeMs: 100,
      nodeId: "prof1",
      params: {},
      inputs: {},
      previousState: null,
      registry: {},
      globalSignals: {},
    });
    
    expect(result.outputs.tickCount).toBe(0);
    expect(result.outputs.tickDuration).toBe(0);
    expect(result.outputs.stepRate).toBe(0);
  });

  it("tracks tick count and calculates metrics after ticks", () => {
    // First tick initializes
    const r1 = ProfilerBlock.step({
      tick: 0,
      timeMs: 0,
      stepTimeMs: 100,
      nodeId: "prof1",
      params: {},
      inputs: { trigger: true },
      previousState: null,
      registry: {},
      globalSignals: {},
    });
    
    expect(r1.nextState.startTime).not.toBeNull();
    
    // Second tick generates metrics
    const r2 = ProfilerBlock.step({
      tick: 1,
      timeMs: 100,
      stepTimeMs: 100,
      nodeId: "prof1",
      params: {},
      inputs: {},
      previousState: r1.nextState,
      registry: {},
      globalSignals: {},
    });
    
    expect(r2.outputs.tickCount).toBeGreaterThanOrEqual(0);
    expect(r2.nextState.tickCount).toBe(1);
    expect(typeof r2.outputs.stepRate).toBe("number");
  });

  it("calculates average and max tick durations correctly", () => {
    const state1 = {
      tickCount: 5,
      lastTickDurationMs: 10,
      averageTickDurationMs: 12,
      maxTickDurationMs: 20,
      totalTimeMs: 60,
      startTime: performance.now() - 15,
    };
    
    const result = ProfilerBlock.step({
      tick: 6,
      timeMs: 600,
      stepTimeMs: 100,
      nodeId: "prof1",
      params: {},
      inputs: {},
      previousState: state1,
      registry: {},
      globalSignals: {},
    });
    
    expect(result.outputs.avgTickDuration).toBeGreaterThan(0);
    expect(result.outputs.maxTickDuration).toBeGreaterThanOrEqual(state1.maxTickDurationMs);
  });
});
