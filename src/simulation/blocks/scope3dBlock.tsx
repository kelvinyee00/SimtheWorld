"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";
import { SimulationBlockDefinition } from "@/src/simulation/types";
import { ImmersiveCanvas } from "@/src/components/immersive/ImmersiveCanvas";

export const SCOPE_3D_BLOCK_TYPE = "scope-3d" as const;

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface Scope3DState {
  samples: Point3D[];
}

export const Scope3DBlock: SimulationBlockDefinition = {
  type: SCOPE_3D_BLOCK_TYPE,
  inputPortTypes: { x: "number", y: "number", z: "number" },
  outputPortTypes: {},
  initialize: () => ({
    samples: [],
  } satisfies Scope3DState),
  step: ({ params, inputs, previousState }) => {
    const maxPoints = typeof params.maxPoints === "number" ? params.maxPoints : 500;
    const state = (previousState as Scope3DState) || { samples: [] };
    
    const x = typeof inputs.x === "number" ? inputs.x : 0;
    const y = typeof inputs.y === "number" ? inputs.y : 0;
    const z = typeof inputs.z === "number" ? inputs.z : 0;
    
    const nextSamples = [...state.samples, { x, y, z }].slice(-maxPoints);
    
    return {
      outputs: {},
      nextState: {
        samples: nextSamples,
      } satisfies Scope3DState,
    };
  },
};

export function Scope3DView({ state, className }: { state: unknown, className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const parsed = (state as Scope3DState) || { samples: [] };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (parsed.samples.length < 2) return;

    // Simple isometric projection
    const project = (p: Point3D) => {
      const scale = 20;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      return {
        px: centerX + (p.x - p.y) * 0.8 * scale,
        py: centerY + (p.x + p.y) * 0.4 * scale - p.z * scale,
      };
    };

    ctx.beginPath();
    ctx.strokeStyle = "#0284c7";
    ctx.lineWidth = 1.5;

    const first = project(parsed.samples[0]);
    ctx.moveTo(first.px, first.py);

    parsed.samples.forEach((p) => {
      const projected = project(p);
      ctx.lineTo(projected.px, projected.py);
    });
    ctx.stroke();
  }, [parsed.samples]);

  return (
    <div className={className ?? "rounded-md border border-sky-200 bg-sky-50/70 px-3 py-2"}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-600 mb-1">
        3D Trajectory
      </p>
      <canvas ref={canvasRef} width={180} height={80} className="w-full h-20" />
      <p className="mt-1 text-[10px] text-slate-500 italic text-center">Double-click for 3D View</p>
    </div>
  );
}

export function Scope3DModal({ open, onClose, state }: { open: boolean, onClose: () => void, state: unknown }) {
  const parsed = (state as Scope3DState) || { samples: [] };
  const lineRef = useRef<THREE.Line | null>(null);

  // Memoize positions calculation
  const positions = useMemo(() => {
    const arr = new Float32Array(parsed.samples.length * 3);
    parsed.samples.forEach((p, i) => {
      arr[i * 3] = p.x;
      arr[i * 3 + 1] = p.y;
      arr[i * 3 + 2] = p.z;
    });
    return arr;
  }, [parsed.samples]);

  const handleInitialize = (scene: THREE.Scene) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({ color: 0x0284c7, linewidth: 2 });
    const line = new THREE.Line(geometry, material);
    scene.add(line);
    lineRef.current = line;
  };

  const handleUpdate = (scene: THREE.Scene, camera: THREE.PerspectiveCamera, clock: THREE.Clock) => {
    if (lineRef.current) {
      // Update geometry if positions changed
      lineRef.current.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      lineRef.current.geometry.attributes.position.needsUpdate = true;
      
      // Auto-rotation
      const time = clock.getElapsedTime();
      scene.rotation.y = time * 0.2;
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4" onClick={onClose}>
      <div className="flex h-[600px] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-slate-200 px-8 py-5 bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Immersive 3D Viewer</h2>
            <p className="text-xs text-slate-500">Real-time WebGL visualization with WebXR support</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600">✕</button>
        </header>
        <main className="flex-1 bg-black relative overflow-hidden">
          <ImmersiveCanvas 
            onInitialize={handleInitialize} 
            onUpdate={handleUpdate} 
          />
        </main>
        <footer className="border-t border-slate-200 px-8 py-4 bg-white flex justify-between items-center text-xs text-slate-500">
           <span>Samples: {parsed.samples.length}</span>
           <span>Press ESC to close</span>
        </footer>
      </div>
    </div>
  );
}
