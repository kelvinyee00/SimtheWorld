import { create } from "zustand";
import { persist } from "zustand/middleware";
import { SimulationGraph } from "../simulation/types";

export interface LibrarySubsystem {
  id: string;
  name: string;
  description: string;
  graph: SimulationGraph;
  mask: {
    inputs: string[];
    outputs: string[];
    parameters: Record<string, unknown>;
  };
  createdAt: number;
}

interface SubsystemLibraryStore {
  subsystems: LibrarySubsystem[];
  addSubSystem: (subsystem: Omit<LibrarySubsystem, "createdAt">) => void;
  removeSubSystem: (id: string) => void;
  updateSubSystem: (id: string, updates: Partial<LibrarySubsystem>) => void;
}

export const useSubsystemLibraryStore = create<SubsystemLibraryStore>()(
  persist(
    (set) => ({
      subsystems: [],
      addSubSystem: (subsystem) =>
        set((state) => ({
          subsystems: [
            ...state.subsystems.filter((s) => s.id !== subsystem.id),
            { ...subsystem, createdAt: Date.now() },
          ],
        })),
      removeSubSystem: (id) =>
        set((state) => ({
          subsystems: state.subsystems.filter((s) => s.id !== id),
        })),
      updateSubSystem: (id, updates) =>
        set((state) => ({
          subsystems: state.subsystems.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        })),
    }),
    {
      name: "subsystem-library",
    }
  )
);
