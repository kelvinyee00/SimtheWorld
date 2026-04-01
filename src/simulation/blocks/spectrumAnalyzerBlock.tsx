"use client";

import { memo, useMemo, useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { SignalValue, SimulationBlockDefinition } from "@/src/simulation/types";

export const SPECTRUM_ANALYZER_BLOCK_TYPE = "spectrum-analyzer" as const;

export interface SpectrumData {
  frequency: number;
  magnitude: number;
}

export interface SpectrumAnalyzerState {
  samples: number[];
  spectrum: SpectrumData[];
}

function computeFFT(samples: number[]): number[] {
  const n = samples.length;
  if (n === 0) return [];
  
  // Real-to-Complex FFT (simplification: only returning magnitude of first half)
  // This is a naive implementation for visualization purposes.
  const magnitudes: number[] = new Array(Math.floor(n / 2)).fill(0);
  
  for (let k = 0; k < n / 2; k++) {
    let re = 0;
    let im = 0;
    for (let t = 0; t < n; t++) {
      const angle = (2 * Math.PI * k * t) / n;
      re += samples[t] * Math.cos(angle);
      im -= samples[t] * Math.sin(angle);
    }
    magnitudes[k] = Math.sqrt(re * re + im * im) / n;
  }
  
  return magnitudes;
}

export const SpectrumAnalyzerBlock: SimulationBlockDefinition = {
  type: SPECTRUM_ANALYZER_BLOCK_TYPE,
  inputPortTypes: { default: "number", in: "number" },
  outputPortTypes: {},
  initialize: () => ({
    samples: [],
    spectrum: [],
  } satisfies SpectrumAnalyzerState),
  step: ({ params, inputs, previousState, stepTimeMs }) => {
    const windowSize = typeof params.windowSize === "number" ? params.windowSize : 128;
    const state = (previousState as SpectrumAnalyzerState) || { samples: [], spectrum: [] };
    
    const raw = inputs.in ?? inputs.default ?? null;
    const value = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
    
    const nextSamples = [...state.samples, value];
    let nextSpectrum = state.spectrum;
    
    if (nextSamples.length >= windowSize) {
      const magnitudes = computeFFT(nextSamples);
      const fs = 1000 / stepTimeMs; // Sampling frequency in Hz
      
      nextSpectrum = magnitudes.map((mag, i) => ({
        frequency: (i * fs) / windowSize,
        magnitude: mag,
      }));
      
      return {
        outputs: {},
        nextState: {
          samples: [], // Reset buffer after computation
          spectrum: nextSpectrum,
        } satisfies SpectrumAnalyzerState,
      };
    }
    
    return {
      outputs: {},
      nextState: {
        ...state,
        samples: nextSamples,
      } satisfies SpectrumAnalyzerState,
    };
  },
};

export function SpectrumAnalyzerView({ state, className }: { state: any, className?: string }) {
  const parsed = (state as SpectrumAnalyzerState) || { spectrum: [] };
  
  return (
    <div className={className ?? "rounded-md border border-sky-200 bg-sky-50/70 px-3 py-2"}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-600">
          Spectrum
        </p>
        <p className="text-[10px] text-slate-500">{parsed.spectrum.length} bins</p>
      </div>
      <div className="h-16 w-full overflow-hidden">
         <ResponsiveContainer width="100%" height="100%">
           <BarChart data={parsed.spectrum.slice(0, 20)}>
             <Bar dataKey="magnitude" fill="#0284c7" isAnimationActive={false} />
           </BarChart>
         </ResponsiveContainer>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">Double-click for details</p>
    </div>
  );
}

export function SpectrumAnalyzerModal({ open, onClose, state }: { open: boolean, onClose: () => void, state: any }) {
  const parsed = (state as SpectrumAnalyzerState) || { spectrum: [] };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="flex h-[500px] w-full max-w-3xl flex-col rounded-xl border border-slate-300 bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">Spectrum Analyzer</h2>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600">✕</button>
        </header>
        <main className="flex-1 p-6">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={parsed.spectrum}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="frequency" label={{ value: 'Hz', position: 'insideBottomRight', offset: -5 }} />
              <YAxis label={{ value: 'Magnitude', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Bar dataKey="magnitude" fill="#0284c7" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </main>
      </div>
    </div>
  );
}
