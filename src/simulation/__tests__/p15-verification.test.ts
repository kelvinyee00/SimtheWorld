import { describe, it, expect } from "vitest";
import { GPS_BLOCK_TYPE } from "../blocks/gpsBlock";
import { ACCELEROMETER_BLOCK_TYPE } from "../blocks/accelerometerBlock";
import { ORIENTATION_BLOCK_TYPE } from "../blocks/orientationBlock";
import { DEFAULT_BLOCK_REGISTRY } from "../registry";

describe("P15 Final Verification", () => {
  it("should have sensor blocks registered", () => {
    expect(DEFAULT_BLOCK_REGISTRY[GPS_BLOCK_TYPE]).toBeDefined();
    expect(DEFAULT_BLOCK_REGISTRY[ACCELEROMETER_BLOCK_TYPE]).toBeDefined();
    expect(DEFAULT_BLOCK_REGISTRY[ORIENTATION_BLOCK_TYPE]).toBeDefined();
  });

  it("should have correct output types for GPS", () => {
    const gps = DEFAULT_BLOCK_REGISTRY[GPS_BLOCK_TYPE];
    expect(gps.outputPortTypes).toEqual({
      lat: "number",
      lon: "number",
      alt: "number",
      speed: "number",
    });
  });

  it("should have correct output types for Accelerometer", () => {
    const acc = DEFAULT_BLOCK_REGISTRY[ACCELEROMETER_BLOCK_TYPE];
    expect(acc.outputPortTypes).toEqual({
      x: "number",
      y: "number",
      z: "number",
    });
  });

  it("should have correct output types for Orientation", () => {
    const orient = DEFAULT_BLOCK_REGISTRY[ORIENTATION_BLOCK_TYPE];
    expect(orient.outputPortTypes).toEqual({
      alpha: "number",
      beta: "number",
      gamma: "number",
    });
  });
});
