import {
  parseModelDocument,
  serializeModelV2,
} from "../modelPersistence";

describe("modelPersistence", () => {
  const sampleModel = {
    nodes: [
      {
        id: "node-1",
        type: "counter",
        position: { x: 10, y: 20 },
        data: { start: 0, step: 1, mode: "inc" },
      },
    ],
    edges: [
      {
        id: "edge-1",
        source: "node-1",
        target: "node-2",
        type: "straight",
      },
    ],
    timing: {
      simulationTimeMs: 5000,
      stepTimeMs: 50,
    },
  };

  it("serializes and parses a v2 model document correctly", () => {
    const serialized = serializeModelV2(sampleModel);
    const parsed = parseModelDocument(serialized);

    expect(parsed.schemaVersion).toBe(2);
    expect(parsed.nodes).toHaveLength(1);
    expect(parsed.nodes[0].id).toBe("node-1");
    expect(parsed.edges).toHaveLength(1);
    expect(parsed.timing.simulationTimeMs).toBe(5000);
    expect(parsed.metadata.app).toBe("web-simulink");
  });

  it("migrates a v1 model document to v2", () => {
    const v1Model = {
      nodes: sampleModel.nodes,
      edges: sampleModel.edges,
      simulationTimeMs: 2000,
      stepTimeMs: 100,
    };

    const serializedV1 = JSON.stringify(v1Model);
    const parsed = parseModelDocument(serializedV1);

    expect(parsed.schemaVersion).toBe(2);
    expect(parsed.timing.simulationTimeMs).toBe(2000);
    expect(parsed.nodes).toEqual(sampleModel.nodes);
    expect(parsed.metadata.app).toBe("web-simulink");
    expect(parsed.metadata.savedAtMs).toBeDefined();
  });

  it("throws for malformed json", () => {
    expect(() => parseModelDocument("not-json")).toThrow();
  });

  it("throws for invalid schema", () => {
    const invalid = JSON.stringify({ version: "wrong", data: {} });
    expect(() => parseModelDocument(invalid)).toThrow(/invalid model document/i);
  });
});
