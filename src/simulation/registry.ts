import { RLSEstimatorBlock, RLS_ESTIMATOR_BLOCK_TYPE } from "@/src/simulation/blocks/rlsEstimatorBlock";
import { OrientationBlock, ORIENTATION_BLOCK_TYPE } from "@/src/simulation/blocks/orientationBlock";
import { GpsBlock, GPS_BLOCK_TYPE } from "@/src/simulation/blocks/gpsBlock";
import { AccelerometerBlock, ACCELEROMETER_BLOCK_TYPE } from "@/src/simulation/blocks/accelerometerBlock";
import { SumBlock, SUM_BLOCK_TYPE, TensorSumBlock } from "@/src/simulation/blocks/sumBlock";
import { GainBlock, GAIN_BLOCK_TYPE, TensorGainBlock } from "@/src/simulation/blocks/gainBlock";
import { ProductBlock, PRODUCT_BLOCK_TYPE, TensorProductBlock } from "@/src/simulation/blocks/productBlock";
import { CounterBlock, COUNTER_BLOCK_TYPE } from "@/src/simulation/blocks/counterBlock";
import { DisplayBlock, DISPLAY_BLOCK_TYPE } from "@/src/simulation/blocks/displayBlock";
import { ScopeBlock, SCOPE_BLOCK_TYPE } from "@/src/simulation/blocks/scopeBlock";
import { ToFileBlock, TO_FILE_BLOCK_TYPE } from "@/src/simulation/blocks/toFileBlock";
import { IntegratorBlock, INTEGRATOR_BLOCK_TYPE } from "@/src/simulation/blocks/integratorBlock";
import { UnitDelayBlock, UNIT_DELAY_BLOCK_TYPE } from "@/src/simulation/blocks/unitDelayBlock";
import { CompareBlock, COMPARE_BLOCK_TYPE } from "@/src/simulation/blocks/compareBlock";
import { SwitchBlock, SWITCH_BLOCK_TYPE } from "@/src/simulation/blocks/switchBlock";
import { InportBlock, INPORT_BLOCK_TYPE } from "@/src/simulation/blocks/inportBlock";
import { OutportBlock, OUTPORT_BLOCK_TYPE } from "@/src/simulation/blocks/outportBlock";
import { SubsystemBlock, SUBSYSTEM_BLOCK_TYPE } from "@/src/simulation/blocks/subsystemBlock";
import { MuxBlock, MUX_BLOCK_TYPE } from "@/src/simulation/blocks/muxBlock";
import { DemuxBlock, DEMUX_BLOCK_TYPE } from "@/src/simulation/blocks/demuxBlock";
import { PidBlock, PID_BLOCK_TYPE } from "@/src/simulation/blocks/pidBlock";
import { DiscreteTransferFcnBlock, DISCRETE_TRANSFER_FCN_BLOCK_TYPE } from "@/src/simulation/blocks/discreteTransferFcnBlock";
import { LeadLagBlock, LEAD_LAG_BLOCK_TYPE } from "@/src/simulation/blocks/leadLagBlock";
import { GotoBlock, GOTO_BLOCK_TYPE } from "@/src/simulation/blocks/gotoBlock";
import { StateMachineBlock, STATE_MACHINE_BLOCK_TYPE } from "@/src/simulation/blocks/stateMachineBlock";
import { FromBlock, FROM_BLOCK_TYPE } from "@/src/simulation/blocks/fromBlock";
import { Lut1DBlock, LUT_1D_BLOCK_TYPE, Lut2DBlock, LUT_2D_BLOCK_TYPE } from "@/src/simulation/blocks/lutBlock";
import { SpectrumAnalyzerBlock, SPECTRUM_ANALYZER_BLOCK_TYPE } from "@/src/simulation/blocks/spectrumAnalyzerBlock";
import { Scope3DBlock, SCOPE_3D_BLOCK_TYPE } from "@/src/simulation/blocks/scope3dBlock";
import { LampBlock, LAMP_BLOCK_TYPE } from "@/src/simulation/blocks/lampBlock";
import { KnobBlock, KNOB_BLOCK_TYPE } from "@/src/simulation/blocks/knobBlock";
import { SliderBlock, SLIDER_BLOCK_TYPE } from "@/src/simulation/blocks/sliderBlock";
import { TruthTableBlock, TRUTH_TABLE_BLOCK_TYPE } from "@/src/simulation/blocks/truthTableBlock";
import { GaugeBlock, GAUGE_BLOCK_TYPE } from "@/src/simulation/blocks/gaugeBlock";
import { MatrixProductBlock, MATRIX_PRODUCT_BLOCK_TYPE } from "@/src/simulation/blocks/matrixProductBlock";
import { HeatmapBlock, HEATMAP_BLOCK_TYPE } from "@/src/simulation/blocks/heatmapBlock";
import { PythonBlock, PYTHON_BLOCK_TYPE } from "@/src/simulation/blocks/pythonBlock";
import { NnDenseBlock, NN_DENSE_BLOCK_TYPE, NnActivationBlock, NN_ACTIVATION_BLOCK_TYPE } from "@/src/simulation/blocks/nnBlocks";
import { ProfilerBlock, PROFILER_BLOCK_TYPE } from "@/src/simulation/blocks/profilerBlock";
import { BLEBlock, BLE_BLOCK_TYPE } from "@/src/simulation/blocks/bleBlock";
import { HeartRateBlock, HEART_RATE_BLOCK_TYPE, BatteryLevelBlock, BATTERY_LEVEL_BLOCK_TYPE } from "@/src/simulation/blocks/specializedBleBlocks";
import { WebSocketSendBlock, WEBSOCKET_SEND_BLOCK_TYPE, WebSocketReceiveBlock, WEBSOCKET_RECEIVE_BLOCK_TYPE } from "@/src/simulation/blocks/webSocketBlocks";
import { FrequencyResponseSinkBlock } from "@/src/simulation/blocks/frequencyResponseSink";
import { BlockRegistry, SimulationBlockDefinition } from "@/src/simulation/types";

export const DEFAULT_BLOCK_REGISTRY: BlockRegistry = {
  [GPS_BLOCK_TYPE]: GpsBlock,
  [ACCELEROMETER_BLOCK_TYPE]: AccelerometerBlock,
  [ORIENTATION_BLOCK_TYPE]: OrientationBlock,
  [COUNTER_BLOCK_TYPE]: CounterBlock,
  [DISPLAY_BLOCK_TYPE]: DisplayBlock,
  [SCOPE_BLOCK_TYPE]: ScopeBlock,
  [GAIN_BLOCK_TYPE]: GainBlock,
  [SUM_BLOCK_TYPE]: SumBlock,
  [PRODUCT_BLOCK_TYPE]: ProductBlock,
  ["tensorSum"]: TensorSumBlock,
  ["tensorGain"]: TensorGainBlock,
  ["tensorProduct"]: TensorProductBlock,
  [TO_FILE_BLOCK_TYPE]: ToFileBlock,
  [INTEGRATOR_BLOCK_TYPE]: IntegratorBlock,
  [UNIT_DELAY_BLOCK_TYPE]: UnitDelayBlock,
  [COMPARE_BLOCK_TYPE]: CompareBlock,
  [SWITCH_BLOCK_TYPE]: SwitchBlock,
  [INPORT_BLOCK_TYPE]: InportBlock,
  [OUTPORT_BLOCK_TYPE]: OutportBlock,
  [SUBSYSTEM_BLOCK_TYPE]: SubsystemBlock,
  [MUX_BLOCK_TYPE]: MuxBlock,
  [DEMUX_BLOCK_TYPE]: DemuxBlock,
  [PID_BLOCK_TYPE]: PidBlock,
  [DISCRETE_TRANSFER_FCN_BLOCK_TYPE]: DiscreteTransferFcnBlock,
  [LEAD_LAG_BLOCK_TYPE]: LeadLagBlock,
  [GOTO_BLOCK_TYPE]: GotoBlock,
  [FROM_BLOCK_TYPE]: FromBlock,
  [LUT_1D_BLOCK_TYPE]: Lut1DBlock,
  [LUT_2D_BLOCK_TYPE]: Lut2DBlock,
  [STATE_MACHINE_BLOCK_TYPE]: StateMachineBlock,
  [TRUTH_TABLE_BLOCK_TYPE]: TruthTableBlock,
  [GAUGE_BLOCK_TYPE]: GaugeBlock,
  [LAMP_BLOCK_TYPE]: LampBlock,
  [SPECTRUM_ANALYZER_BLOCK_TYPE]: SpectrumAnalyzerBlock,
  [SCOPE_3D_BLOCK_TYPE]: Scope3DBlock,
  [KNOB_BLOCK_TYPE]: KnobBlock,
  [SLIDER_BLOCK_TYPE]: SliderBlock,
  [MATRIX_PRODUCT_BLOCK_TYPE]: MatrixProductBlock,
  [HEATMAP_BLOCK_TYPE]: HeatmapBlock,
  [PYTHON_BLOCK_TYPE]: PythonBlock,
  [NN_DENSE_BLOCK_TYPE]: NnDenseBlock,
  [NN_ACTIVATION_BLOCK_TYPE]: NnActivationBlock,
  [PROFILER_BLOCK_TYPE]: ProfilerBlock,
  [BLE_BLOCK_TYPE]: BLEBlock,
  [HEART_RATE_BLOCK_TYPE]: HeartRateBlock,
  [BATTERY_LEVEL_BLOCK_TYPE]: BatteryLevelBlock,
  [WEBSOCKET_SEND_BLOCK_TYPE]: WebSocketSendBlock,
  [WEBSOCKET_RECEIVE_BLOCK_TYPE]: WebSocketReceiveBlock,
  [RLS_ESTIMATOR_BLOCK_TYPE]: RLSEstimatorBlock,
  ["frequencyResponseSink"]: FrequencyResponseSinkBlock,
};

export function createBlockRegistry(definitions: SimulationBlockDefinition[]): BlockRegistry {
  const registry: BlockRegistry = {};
  for (const definition of definitions) {
    if (registry[definition.type]) {
      throw new Error(`Duplicate block registration for type '%s'.`);
    }
    registry[definition.type] = definition;
  }
  return registry;
}

export function getBlockDefinition(registry: BlockRegistry, type: string): SimulationBlockDefinition | undefined {
  return registry[type];
}

let runtimeRegistry: BlockRegistry = { ...DEFAULT_BLOCK_REGISTRY };

export function registerBlockType(definition: SimulationBlockDefinition): void {
  runtimeRegistry = { ...runtimeRegistry, [definition.type]: definition };
}

export function getRuntimeRegistry(): BlockRegistry {
  return runtimeRegistry;
}
