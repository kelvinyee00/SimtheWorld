import { describe, it, expect, vi, beforeEach } from "vitest";
import { BLEBlock, BLEBlockParams } from "@/src/simulation/blocks/bleBlock";
import { HeartRateBlock, BatteryLevelBlock } from "@/src/simulation/blocks/specializedBleBlocks";
import { BLEManager } from "@/src/utils/bleManager";
import { BlockStepContext } from "@/src/simulation/types";

describe("BLE Blocks Integration", () => {
  let bleManager: BLEManager;

  beforeEach(() => {
    vi.resetAllMocks();
    bleManager = BLEManager.getInstance();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (bleManager as any).devices = new Map();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (bleManager as any).deviceObjects = new Map();
  });

  describe("BLEBlock (Generic)", () => {
    it("should latch the latest value from BLEManager", () => {
      const deviceId = "test-device";
      const mockValue = [0, 0, 128, 63]; // 1.0 in Float32 LE

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (bleManager as any).devices.set(deviceId, {
        id: deviceId,
        name: "Mock Device",
        status: "connected",
        lastValue: mockValue,
        lastUpdate: Date.now(),
      });

      const context: BlockStepContext = {
        params: {
          deviceId,
          parsingMode: "float32",
        } as BLEBlockParams,
        previousState: null,
        time: 0,
        dt: 0.1,
        inputs: {},
      };

      const result = BLEBlock.step(context);
      expect(result.outputs.default).toBe(1.0);
      expect(result.outputs.connected).toBe(true);
    });

    it("should handle uint8 parsing", () => {
      const deviceId = "test-device";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (bleManager as any).devices.set(deviceId, {
        id: deviceId,
        status: "connected",
        lastValue: [42],
        lastUpdate: Date.now(),
      });

      const result = BLEBlock.step({
        params: { deviceId, parsingMode: "uint8" },
        previousState: null,
      } as BlockStepContext);

      expect(result.outputs.default).toBe(42);
    });
  });

  describe("HeartRateBlock", () => {
    it("should parse 8-bit Heart Rate Measurement", () => {
      const deviceId = "hr-sensor";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (bleManager as any).devices.set(deviceId, {
        id: deviceId,
        status: "connected",
        lastValue: [0x00, 75],
        lastUpdate: Date.now(),
      });

      const result = HeartRateBlock.step({
        params: { deviceId },
        previousState: null,
      } as BlockStepContext);

      expect(result.outputs.bpm).toBe(75);
    });

    it("should parse 16-bit Heart Rate Measurement", () => {
      const deviceId = "hr-sensor";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (bleManager as any).devices.set(deviceId, {
        id: deviceId,
        status: "connected",
        lastValue: [0x01, 0x04, 0x01],
        lastUpdate: Date.now(),
      });

      const result = HeartRateBlock.step({
        params: { deviceId },
        previousState: null,
      } as BlockStepContext);

      expect(result.outputs.bpm).toBe(260);
    });
  });

  describe("BatteryLevelBlock", () => {
    it("should report battery percentage", () => {
      const deviceId = "battery-sensor";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (bleManager as any).devices.set(deviceId, {
        id: deviceId,
        status: "connected",
        lastValue: [85],
        lastUpdate: Date.now(),
      });

      const result = BatteryLevelBlock.step({
        params: { deviceId },
        previousState: null,
      } as BlockStepContext);

      expect(result.outputs.level).toBe(85);
    });
  });

  describe("BLE Connection States", () => {
    it("should report connected as false when disconnected", () => {
      const deviceId = "test-device";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (bleManager as any).devices.set(deviceId, {
        id: deviceId,
        status: "disconnected",
        lastValue: [1, 2, 3],
        lastUpdate: Date.now(),
      });

      const result = BLEBlock.step({
        params: { deviceId, parsingMode: "raw" },
        previousState: null,
      } as BlockStepContext);

      expect(result.outputs.connected).toBe(false);
    });

    it("should retain last value when device state is missing in manager", () => {
      const prevState = { lastTickValue: 99, connected: true };
      const result = BLEBlock.step({
        params: { deviceId: "missing-id" },
        previousState: prevState,
      } as BlockStepContext);

      expect(result.outputs.default).toBe(99);
      expect(result.outputs.connected).toBe(false);
    });
  });
});
