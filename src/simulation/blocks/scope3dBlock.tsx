"use client";

import { useEffect, useRef, useState } from "react";
import { SimulationBlockDefinition } from "@/src/simulation/types";

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rotation, setRotation] = useState(0);
  const parsed = (state as Scope3DState) || { samples: [] };

  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => setRotation(r => r + 0.02), 50);
    return () => clearInterval(interval);
  }, [open]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !open) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (parsed.samples.length < 2) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const scale = 50;

    const project = (p: Point3D) => {
      // Rotation around Z axis
      const rx = p.x * Math.cos(rotation) - p.y * Math.sin(rotation);
      const ry = p.x * Math.sin(rotation) + p.y * Math.cos(rotation);
      
      return {
        px: centerX + (rx - ry) * scale,
        py: centerY + (rx + ry) * 0.5 * scale - p.z * scale,
      };
    };

    ctx.beginPath();
    ctx.strokeStyle = "#0284c7";
    ctx.lineWidth = 2;

    const first = project(parsed.samples[0]);
    ctx.moveTo(first.px, first.py);

    parsed.samples.forEach((p) => {
      const { px, py } = project(p);
      ctx.lineTo(px, py);
    });
    ctx.stroke();
  }, [open, parsed.samples, rotation]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4" onClick={onClose}>
      <div className="flex h-[600px] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-slate-200 px-8 py-5 bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-800">3D Trajectory Viewer</h2>
            <p className="text-xs text-slate-500">Auto-rotating projection of (X, Y, Z) signal triplet</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600">✕</button>
        </header>
        <main className="flex-1 bg-slate-50 relative overflow-hidden">
          <canvas ref={canvasRef} width={800} height={500} className="w-full h-full" />
        </main>
        <footer className="border-t border-slate-200 px-8 py-4 bg-white flex justify-between items-center text-xs text-slate-500">
           <span>Samples: {parsed.samples.length}</span>
           <span>Press ESC to close</span>
        </footer>
      </div>
    </div>
  );
}
