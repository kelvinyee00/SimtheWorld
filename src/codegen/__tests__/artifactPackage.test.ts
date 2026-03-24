import { buildCodegenArtifactPackage, serializeCodegenArtifactPackage } from "@/src/codegen/artifactPackage";
import { COUNTER_BLOCK_TYPE } from "@/src/simulation/blocks/counterBlock";
import { DISPLAY_BLOCK_TYPE } from "@/src/simulation/blocks/displayBlock";
import { GAIN_BLOCK_TYPE } from "@/src/simulation/blocks/gainBlock";
import { SimulationGraph } from "@/src/simulation/types";

describe("Codegen artifact package", () => {
  it("creates deterministic manifest checksums for identical graph inputs", () => {
    const graph: SimulationGraph = {
      nodes: [
        { id: "counter", type: COUNTER_BLOCK_TYPE, data: { start: 1, step: 1 } },
        { id: "gain", type: GAIN_BLOCK_TYPE, data: { gain: 2 } },
      ],
      edges: [{ id: "counter->gain", source: "counter", target: "gain", targetHandle: "in" }],
    };

    const first = buildCodegenArtifactPackage({ modelName: "artifact_model", graph });
    const second = buildCodegenArtifactPackage({ modelName: "artifact_model", graph });

    expect(first.manifest).toEqual(second.manifest);
    expect(first.metadata).toEqual(second.metadata);
    expect(first.files.map((file) => file.path)).toEqual([
      "artifact_model.h",
      "artifact_model.c",
      "artifact_model.ir.json",
    ]);
  });

  it("tracks unsupported block metadata and serializes package envelope", () => {
    const graph: SimulationGraph = {
      nodes: [
        { id: "counter", type: COUNTER_BLOCK_TYPE, data: { start: 0, step: 1 } },
        { id: "display", type: DISPLAY_BLOCK_TYPE, data: {} },
      ],
      edges: [{ id: "counter->display", source: "counter", target: "display" }],
    };

    const pkg = buildCodegenArtifactPackage({ modelName: "artifact_with_unsupported", graph });
    const serialized = serializeCodegenArtifactPackage(pkg);

    expect(pkg.metadata.unsupportedBlockTypes).toEqual([DISPLAY_BLOCK_TYPE]);
    expect(pkg.manifest.entries.length).toBe(3);
    expect(pkg.manifest.packageChecksum).toMatch(/^[0-9a-f]{8}$/);
    expect(serialized).toContain("artifact_with_unsupported");
    expect(serialized).toContain("unsupportedBlockTypes");
  });
});
