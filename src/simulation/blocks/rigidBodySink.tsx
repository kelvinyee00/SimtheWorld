"use client";

import { useRef } from "react";
import * as THREE from "three";
import { RigidBodySinkState } from "./rigidBodySinkBlock";
import { ImmersiveCanvas } from "@/src/components/immersive/ImmersiveCanvas";

export function RigidBodySinkView({ state, className }: { state: unknown, className?: string }) {
  const parsed = (state as RigidBodySinkState) || { position: [0, 0, 0], rotation: [0, 0, 0, 1] };

  return (
    <div className={className ?? "rounded-md border border-indigo-200 bg-indigo-50/70 px-3 py-2"}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-600 mb-1">
        Rigid Body Sink
      </p>
      <div className="text-[10px] text-slate-600 font-mono">
        <div className="flex justify-between">
          <span>POS:</span>
          <span>{parsed.position.map(v => v.toFixed(2)).join(", ")}</span>
        </div>
        <div className="flex justify-between">
          <span>ROT:</span>
          <span>{parsed.rotation.map(v => v.toFixed(2)).join(", ")}</span>
        </div>
      </div>
      <p className="mt-1 text-[10px] text-slate-500 italic text-center">Double-click for 3D View</p>
    </div>
  );
}

export function RigidBodySinkModal({ open, onClose, state }: { open: boolean, onClose: () => void, state: unknown }) {
  const parsed = (state as RigidBodySinkState) || { position: [0, 0, 0], rotation: [0, 0, 0, 1] };
  const meshRef = useRef<THREE.Group | null>(null);

  const handleInitialize = (scene: THREE.Scene) => {
    const group = new THREE.Group();
    
    // Body (Fuselage)
    const bodyGeo = new THREE.BoxGeometry(0.5, 0.2, 1);
    const bodyMat = new THREE.MeshPhongMaterial({ color: 0x4f46e5 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);

    // Wings
    const wingGeo = new THREE.BoxGeometry(2, 0.05, 0.3);
    const wing = new THREE.Mesh(wingGeo, bodyMat);
    wing.position.set(0, 0, 0.1);
    group.add(wing);

    // Vertical Stabilizer
    const tailGeo = new THREE.BoxGeometry(0.05, 0.4, 0.3);
    const tail = new THREE.Mesh(tailGeo, bodyMat);
    tail.position.set(0, 0.2, -0.4);
    group.add(tail);
    
    // Axes helper
    const axesHelper = new THREE.AxesHelper(1);
    group.add(axesHelper);
    
    scene.add(group);
    meshRef.current = group;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    scene.add(directionalLight);

    // Grid helper
    const gridHelper = new THREE.GridHelper(20, 20);
    scene.add(gridHelper);
  };

  const handleUpdate = () => {
    if (meshRef.current) {
      meshRef.current.position.set(parsed.position[0], parsed.position[1], parsed.position[2]);
      const [x, y, z, w] = parsed.rotation;
      meshRef.current.quaternion.set(x, y, z, w);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4" onClick={onClose}>
      <div className="flex h-[600px] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-slate-200 px-8 py-5 bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Rigid Body Visualizer</h2>
            <p className="text-xs text-slate-500">Quaternion-based 3D transform tracking</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600">✕</button>
        </header>
        <main className="flex-1 bg-slate-900 relative overflow-hidden">
          <ImmersiveCanvas 
            onInitialize={handleInitialize} 
            onUpdate={handleUpdate} 
          />
        </main>
        <footer className="border-t border-slate-200 px-8 py-4 bg-white flex justify-between items-center text-xs text-slate-500">
           <span>Position: [{parsed.position.map(v => v.toFixed(2)).join(", ")}]</span>
           <span>Quaternion: [{parsed.rotation.map(v => v.toFixed(2)).join(", ")}]</span>
        </footer>
      </div>
    </div>
  );
}
