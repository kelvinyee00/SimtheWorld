import { StateMachineBlock } from "@/src/simulation/blocks/stateMachineBlock";

describe("StateMachineBlock scaffold", () => {
  it("emits initial state and null default output when no transition fires", () => {
    const initialized = StateMachineBlock.initialize?.({
      initialState: "idle",
      states: ["idle", "active"],
      transitions: [],
    });

    const result = StateMachineBlock.step({
      tick: 0,
      timeMs: 0,
      stepTimeMs: 100,
      nodeId: "sm1",
      params: {
        initialState: "idle",
        states: ["idle", "active"],
        transitions: [],
      },
      inputs: {},
      previousState: initialized,
      registry: {},
      globalSignals: {},
    });

    expect(result.outputs.state).toBe("idle");
    expect(result.outputs.default).toBeNull();
  });

  it("fires first matching transition by list order", () => {
    const result = StateMachineBlock.step({
      tick: 0,
      timeMs: 0,
      stepTimeMs: 100,
      nodeId: "sm1",
      params: {
        initialState: "idle",
        states: ["idle", "a", "b"],
        transitions: [
          { from: "idle", to: "a", guardExpr: "true", output: 1 },
          { from: "idle", to: "b", guardExpr: "true", output: 2 },
        ],
      },
      inputs: {},
      previousState: {
        state: "idle",
        memory: {},
        stateEnteredTimeMs: 0,
        previousInputs: {},
        lastEvents: [],
      },
      registry: {},
      globalSignals: {},
    });

    expect(result.outputs.state).toBe("a");
    expect(result.outputs.default).toBe(1);
  });

  it("evaluates guard expressions against inputs context", () => {
    const result = StateMachineBlock.step({
      tick: 0,
      timeMs: 0,
      stepTimeMs: 100,
      nodeId: "sm1",
      params: {
        initialState: "idle",
        states: ["idle", "active"],
        transitions: [{ from: "idle", to: "active", guardExpr: "inputs.in > 3", output: true }],
      },
      inputs: { in: 4 },
      previousState: {
        state: "idle",
        memory: {},
        stateEnteredTimeMs: 0,
        previousInputs: {},
        lastEvents: [],
      },
      registry: {},
      globalSignals: {},
    });

    expect(result.outputs.state).toBe("active");
    expect(result.outputs.default).toBe(true);
  });

  it("applies action expression object to node-local memory deterministically", () => {
    const result = StateMachineBlock.step({
      tick: 2,
      timeMs: 200,
      stepTimeMs: 100,
      nodeId: "sm1",
      params: {
        initialState: "idle",
        states: ["idle", "active"],
        transitions: [
          {
            from: "idle",
            to: "active",
            guardExpr: "true",
            actionExpr: "{ count: (memory.count || 0) + 1, seenTick: tick }",
          },
        ],
      },
      inputs: {},
      previousState: {
        state: "idle",
        memory: { count: 1 },
        stateEnteredTimeMs: 0,
        previousInputs: {},
        lastEvents: [],
      },
      registry: {},
      globalSignals: {},
    });

    const nextState = result.nextState as {
      state: string;
      memory: Record<string, unknown>;
      stateEnteredTimeMs: number;
    };
    expect(nextState.state).toBe("active");
    expect(nextState.memory).toEqual({
      count: 2,
      seenTick: 2,
    });
    expect(nextState.stateEnteredTimeMs).toBe(200);
  });

  it("rejects unsafe function-call guards and keeps current state", () => {
    const result = StateMachineBlock.step({
      tick: 0,
      timeMs: 0,
      stepTimeMs: 100,
      nodeId: "sm1",
      params: {
        initialState: "idle",
        states: ["idle", "active"],
        transitions: [
          {
            from: "idle",
            to: "active",
            guardExpr: "inputs.in.constructor()",
            output: true,
          },
        ],
      },
      inputs: { in: true },
      previousState: {
        state: "idle",
        memory: {},
        stateEnteredTimeMs: 0,
        previousInputs: {},
        lastEvents: [],
      },
      registry: {},
      globalSignals: {},
    });

    expect(result.outputs.state).toBe("idle");
    expect(result.outputs.default).toBeNull();
  });

  it("blocks prototype pollution keys in action patches", () => {
    const result = StateMachineBlock.step({
      tick: 1,
      timeMs: 100,
      stepTimeMs: 100,
      nodeId: "sm1",
      params: {
        initialState: "idle",
        states: ["idle", "active"],
        transitions: [
          {
            from: "idle",
            to: "active",
            guardExpr: "true",
            actionExpr: '{ "__proto__": { poisoned: true }, count: (memory.count || 0) + 1 }',
          },
        ],
      },
      inputs: {},
      previousState: {
        state: "idle",
        memory: {},
        stateEnteredTimeMs: 0,
        previousInputs: {},
        lastEvents: [],
      },
      registry: {},
      globalSignals: {},
    });

    const nextState = result.nextState as { state: string; memory: Record<string, unknown> };
    expect(nextState.memory.count).toBe(1);
    expect(Object.prototype.hasOwnProperty.call(nextState.memory, "__proto__")).toBe(false);
    expect(({} as Record<string, unknown>).poisoned).toBeUndefined();
  });

  it("supports temporal transition gating via afterMs", () => {
    const params = {
      initialState: "idle",
      states: ["idle", "active"],
      transitions: [
        {
          from: "idle",
          to: "active",
          afterMs: 200,
          output: 99,
        },
      ],
    };

    const beforeWindow = StateMachineBlock.step({
      tick: 1,
      timeMs: 100,
      stepTimeMs: 100,
      nodeId: "sm1",
      params,
      inputs: {},
      previousState: {
        state: "idle",
        memory: {},
        stateEnteredTimeMs: 0,
        previousInputs: {},
        lastEvents: [],
      },
      registry: {},
      globalSignals: {},
    });

    expect(beforeWindow.outputs.state).toBe("idle");
    expect(beforeWindow.outputs.default).toBeNull();

    const atWindow = StateMachineBlock.step({
      tick: 2,
      timeMs: 200,
      stepTimeMs: 100,
      nodeId: "sm1",
      params,
      inputs: {},
      previousState: beforeWindow.nextState,
      registry: {},
      globalSignals: {},
    });

    expect(atWindow.outputs.state).toBe("active");
    expect(atWindow.outputs.default).toBe(99);
  });

  it("supports deterministic rising-edge event transitions", () => {
    const params = {
      initialState: "idle",
      states: ["idle", "active"],
      transitions: [
        {
          from: "idle",
          to: "active",
          event: "rising" as const,
          eventInput: "in",
          output: true,
        },
      ],
    };

    const result = StateMachineBlock.step({
      tick: 1,
      timeMs: 100,
      stepTimeMs: 100,
      nodeId: "sm1",
      params,
      inputs: { in: true },
      previousState: {
        state: "idle",
        memory: {},
        stateEnteredTimeMs: 0,
        previousInputs: { in: false },
        lastEvents: [],
      },
      registry: {},
      globalSignals: {},
    });

    expect(result.outputs.state).toBe("active");
    expect(result.outputs.default).toBe(true);
  });

  it("builds deterministic edge-event queue sorted by input handle", () => {
    const result = StateMachineBlock.step({
      tick: 1,
      timeMs: 100,
      stepTimeMs: 100,
      nodeId: "sm1",
      params: {
        initialState: "idle",
        states: ["idle"],
        transitions: [],
      },
      inputs: { b: true, a: true },
      previousState: {
        state: "idle",
        memory: {},
        stateEnteredTimeMs: 0,
        previousInputs: { b: false, a: false },
        lastEvents: [],
      },
      registry: {},
      globalSignals: {},
    });

    const nextState = result.nextState as {
      lastEvents: Array<{ input: string; type: string; sequence: number }>;
    };

    const compactEvents = nextState.lastEvents.map((event) => ({
      input: event.input,
      type: event.type,
      sequence: event.sequence,
    }));

    expect(compactEvents).toEqual([
      { input: "a", type: "rising", sequence: 0 },
      { input: "b", type: "rising", sequence: 1 },
    ]);
  });
});
