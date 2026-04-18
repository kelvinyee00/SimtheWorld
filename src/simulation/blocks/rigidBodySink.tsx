"use client";

import { useRef, useState, useEffect } from "react";
import * as THREE from "three";
import { RigidBodySinkState } from "./rigidBodySinkBlock";
import { ImmersiveCanvas, ImmersiveCanvasHandle } from "@/src/components/immersive/ImmersiveCanvas";
import { useSimulationRuntimeStore } from "@/src/store/simulationRuntimeStore";

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

export function RigidBodySinkModal({ open, onClose, state }: { open: boolean, onClose: () => void, state: RigidBodySinkState }) {
  const parsed = state || { position: [0, 0, 0], rotation: [0, 0, 0, 1] };
  const meshRef = useRef<THREE.Group | null>(null);
  const canvasRef = useRef<ImmersiveCanvasHandle>(null);
  const [arSupported, setArSupported] = useState(false);
  const timeMs = useSimulationRuntimeStore(s => s.runtime.timeMs);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'xr' in navigator) {
      (navigator as any).xr.isSessionSupported('immersive-ar').then((supported: boolean) => {
        setArSupported(supported);
      });
    }
  }, []);

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
          <div className="flex items-center gap-4">
            {arSupported && (
              <span className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded uppercase tracking-wider">
                AR Ready
              </span>
            )}
            <button onClick={onClose} aria-label="Close modal" className="rounded-full p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600">✕</button>
          </div>
        </header>
        <main className="flex-1 bg-slate-900 relative overflow-hidden">
          <ImmersiveCanvas 
            ref={canvasRef}
            onInitialize={handleInitialize} 
            onUpdate={handleUpdate} 
            simulationTime={timeMs / 1000}
          />
        </main>
        <footer className="border-t border-slate-200 px-8 py-4 bg-white flex justify-between items-center text-xs text-slate-500">
           <div className="flex gap-6">
             <span>Position: [{parsed.position.map(v => v.toFixed(2)).join(", ")}]</span>
             <span>Quaternion: [{parsed.rotation.map(v => v.toFixed(2)).join(", ")}]</span>
           </div>
           <div className="flex gap-2">
             {arSupported && (
               <button 
                 onClick={() => canvasRef.current?.enterAR()}
                 className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
               >
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                 </svg>
                 Enter AR
               </button>
             )}
           </div>
        </footer>
      </div>
    </div>
  );
}
