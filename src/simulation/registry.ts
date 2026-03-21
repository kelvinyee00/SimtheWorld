import { CounterBlock, COUNTER_BLOCK_TYPE } from "@/src/simulation/blocks/counterBlock";
import { DisplayBlock, DISPLAY_BLOCK_TYPE } from "@/src/simulation/blocks/displayBlock";
import { ScopeBlock, SCOPE_BLOCK_TYPE } from "@/src/simulation/blocks/scopeBlock";
import { GainBlock, GAIN_BLOCK_TYPE } from "@/src/simulation/blocks/gainBlock";
import { SumBlock, SUM_BLOCK_TYPE } from "@/src/simulation/blocks/sumBlock";
import { ProductBlock, PRODUCT_BLOCK_TYPE } from "@/src/simulation/blocks/productBlock";
import { ToFileBlock, TO_FILE_BLOCK_TYPE } from "@/src/simulation/blocks/toFileBlock";
import { IntegratorBlock, INTEGRATOR_BLOCK_TYPE } from "@/src/simulation/blocks/integratorBlock";
import { UnitDelayBlock, UNIT_DELAY_BLOCK_TYPE } from "@/src/simulation/blocks/unitDelayBlock";
import { CompareBlock, COMPARE_BLOCK_TYPE } from "@/src/simulation/blocks/compareBlock";
import { SwitchBlock, SWITCH_BLOCK_TYPE } from "@/src/simulation/blocks/switchBlock";
import { InportBlock, INPORT_BLOCK_TYPE } from "@/src/simulation/blocks/inportBlock";
import { OutportBlock, OUTPORT_BLOCK_TYPE } from "@/src/simulation/blocks/outportBlock";
import { SubsystemBlock, SUBSYSTEM_BLOCK_TYPE } from "@/src/simulation/blocks/subsystemBlock";
import { BlockRegistry, SimulationBlockDefinition } from "@/src/simulation/types";

/**
 * Block registry utilities.
 *
 * Purpose:
 * - Centralize block registration and lookup.
 * - Keep construction deterministic and explicit for reproducible runtimes.
 * - Enforce duplicate-type protection during startup wiring.
 */

/**
 * Minimal default registry used by P0 runtime.
 */
export const DEFAULT_BLOCK_REGISTRY: BlockRegistry = {
  [COUNTER_BLOCK_TYPE]: CounterBlock,
  [DISPLAY_BLOCK_TYPE]: DisplayBlock,
  [SCOPE_BLOCK_TYPE]: ScopeBlock,
  [GAIN_BLOCK_TYPE]: GainBlock,
  [SUM_BLOCK_TYPE]: SumBlock,
  [PRODUCT_BLOCK_TYPE]: ProductBlock,
  [TO_FILE_BLOCK_TYPE]: ToFileBlock,
  [INTEGRATOR_BLOCK_TYPE]: IntegratorBlock,
  [UNIT_DELAY_BLOCK_TYPE]: UnitDelayBlock,
  [COMPARE_BLOCK_TYPE]: CompareBlock,
  [SWITCH_BLOCK_TYPE]: SwitchBlock,
  [INPORT_BLOCK_TYPE]: InportBlock,
  [OUTPORT_BLOCK_TYPE]: OutportBlock,
  [SUBSYSTEM_BLOCK_TYPE]: SubsystemBlock,
};

/**
 * Create a safe registry from a list of definitions.
 * Throws on duplicate `type` to prevent accidental override.
 */
export function createBlockRegistry(
  definitions: SimulationBlockDefinition[]
): BlockRegistry {
  const registry: BlockRegistry = {};

  for (const definition of definitions) {
    if (registry[definition.type]) {
      throw new Error(`Duplicate block registration for type '${definition.type}'.`);
    }
    registry[definition.type] = definition;
  }

  return registry;
}

/**
 * Retrieve a block definition from a registry.
 */
export function getBlockDefinition(
  registry: BlockRegistry,
  type: string
): SimulationBlockDefinition | undefined {
  return registry[type];
}
