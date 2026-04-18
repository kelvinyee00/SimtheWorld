"use client";

import { useRef } from "react";
import * as THREE from "three";
import { SimulationBlockDefinition } from "@/src/simulation/types";
import { ImmersiveCanvas } from "@/src/components/immersive/ImmersiveCanvas";
import { useSimulationRuntimeStore } from "@/src/store/simulationRuntimeStore";

export const RIGID_BODY_3D_BLOCK_TYPE = "rigid-body-3d" as const;

export interface RigidBody3DState {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number }; // Euler angles in radians
}

export const RigidBody3DBlock: SimulationBlockDefinition = {
  type: RIGID_BODY_3D_BLOCK_TYPE,
  inputPortTypes: { 
    px: "number", py: "number", pz: "number",
    rx: "number", ry: "number", rz: "number" 
  },
  outputPortTypes: {},
  initialize: () => ({
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
  } satisfies RigidBody3DState),
  step: ({ inputs }) => {
    return {
      outputs: {},
      nextState: {
        position: {
          x: typeof inputs.px === "number" ? inputs.px : 0,
          y: typeof inputs.py === "number" ? inputs.py : 0,
          z: typeof inputs.pz === "number" ? inputs.pz : 0,
        },
        rotation: {
          x: typeof inputs.rx === "number" ? inputs.rx : 0,
          y: typeof inputs.ry === "number" ? inputs.ry : 0,
          z: typeof inputs.rz === "number" ? inputs.rz : 0,
        },
      } satisfies RigidBody3DState,
    };
  },
};

export function RigidBody3DView({ state, className }: { state: unknown, className?: string }) {
  const parsed = (state as RigidBody3DState) || { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } };

  return (
    <div className={className ?? "rounded-md border border-indigo-200 bg-indigo-50/70 px-3 py-2"}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-600 mb-1">
        Rigid Body 3D
      </p>
      <div className="text-[10px] text-slate-600 font-mono">
        <div className="flex justify-between">
          <span>POS:</span>
          <span>{parsed.position.x.toFixed(2)}, {parsed.position.y.toFixed(2)}, {parsed.position.z.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>ROT:</span>
          <span>{parsed.rotation.x.toFixed(2)}, {parsed.rotation.y.toFixed(2)}, {parsed.rotation.z.toFixed(2)}</span>
        </div>
      </div>
      <p className="mt-1 text-[10px] text-slate-500 italic text-center">Double-click for 3D View</p>
    </div>
  );
}

export function RigidBody3DModal({ open, onClose, state }: { open: boolean, onClose: () => void, state: unknown }) {
  const parsed = (state as RigidBody3DState) || { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } };
  const meshRef = useRef<THREE.Mesh | null>(null);
  const timeMs = useSimulationRuntimeStore(s => s.runtime.timeMs);

  const handleInitialize = (scene: THREE.Scene) => {
    // Add a simple box representing the rigid body
    const geometry = new THREE.BoxGeometry(1, 0.5, 2);
    const material = new THREE.MeshPhongMaterial({ color: 0x4f46e5 });
    const mesh = new THREE.Mesh(geometry, material);
    
    // Add axes helper attached to the mesh
    const axesHelper = new THREE.AxesHelper(2);
    mesh.add(axesHelper);
    
    scene.add(mesh);
    meshRef.current = mesh;

    // Add lighting since we're using MeshPhongMaterial
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0xffffff, 1);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);
  };

  const handleUpdate = () => {
    if (meshRef.current) {
      meshRef.current.position.set(parsed.position.x, parsed.position.y, parsed.position.z);
      meshRef.current.rotation.set(parsed.rotation.x, parsed.rotation.y, parsed.rotation.z);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4" onClick={onClose}>
      <div className="flex h-[600px] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-slate-200 px-8 py-5 bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Rigid Body Visualizer</h2>
            <p className="text-xs text-slate-500">Real-time 6-DOF orientation and position tracking</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600">✕</button>
        </header>
        <main className="flex-1 bg-black relative overflow-hidden">
          <ImmersiveCanvas 
            onInitialize={handleInitialize} 
            onUpdate={handleUpdate} 
            simulationTime={timeMs / 1000}
          />
        </main>
        <footer className="border-t border-slate-200 px-8 py-4 bg-white flex justify-between items-center text-xs text-slate-500">
           <span>Position: [{parsed.position.x.toFixed(2)}, {parsed.position.y.toFixed(2)}, {parsed.position.z.toFixed(2)}]</span>
           <span>Press ESC to close</span>
        </footer>
      </div>
    </div>
  );
}
