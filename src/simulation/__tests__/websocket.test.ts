import { WebSocketBlock } from "@/src/simulation/blocks/websocketBlock";

describe("WebSocket Bridge Block (P13-1)", () => {
  it("emits lastReceived value in sub mode", () => {
    const result = WebSocketBlock.step({
      tick: 1,
      timeMs: 100,
      stepTimeMs: 100,
      nodeId: "ws1",
      params: { mode: "sub" },
      inputs: {},
      previousState: { lastReceived: 42 },
      registry: {},
      globalSignals: {},
    });

    expect(result.outputs.default).toBe(42);
    expect(result.outputs.out).toBe(42);
  });

  it("mirrors input to output in pub mode", () => {
    const result = WebSocketBlock.step({
      tick: 1,
      timeMs: 100,
      stepTimeMs: 100,
      nodeId: "ws1",
      params: { mode: "pub" },
      inputs: { default: 123 },
      previousState: { lastReceived: null },
      registry: {},
      globalSignals: {},
    });

    expect(result.outputs.default).toBe(123);
  });
});
