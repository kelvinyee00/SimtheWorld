"use client";

import { useState } from "react";
import { SimulationGraph, SimulationRuntimeSnapshot } from "@/src/simulation/types";
import { runParallelSweep, SweepResult } from "@/src/simulation/worker/parallelSweep";

interface SweepManagerProps {
  open: boolean;
  onClose: () => void;
  graph: SimulationGraph;
}

export function SweepManager({ open, onClose, graph }: SweepManagerProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<SweepResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [targetNodeId, setTargetNodeId] = useState("");
  const [targetParam, setTargetParam] = useState("");
  const [paramValues, setParamValues] = useState("1, 2, 3, 4, 5");

  const executeSweep = async () => {
    if (!targetNodeId || !targetParam) {
      setError("Please specify node ID and parameter name.");
      return;
    }

    const values = paramValues.split(",").map(v => v.trim()).filter(v => v !== "").map(v => {
        const n = Number(v);
        return isNaN(n) ? v : n;
    });

    if (values.length === 0) {
      setError("Please provide at least one parameter value.");
      return;
    }

    setIsRunning(true);
    setError(null);
    setResults(null);

    const parameterSets = values.map(val => ({
      [targetNodeId]: { [targetParam]: val }
    }));

    try {
      const sweepResults = await runParallelSweep(graph, parameterSets, {
        totalTimeMs: 1000,
        stepTimeMs: 10
      });
      setResults(sweepResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4" onClick={onClose}>
      <div className="flex w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Parallel Parameter Sweep</h2>
            <p className="text-xs text-slate-500">Run multiple simulations concurrently with varying parameters</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600">✕</button>
        </header>

        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-600 uppercase">Target Node ID</span>
              <input 
                type="text" 
                value={targetNodeId} 
                onChange={e => setTargetNodeId(e.target.value)}
                placeholder="e.g. gain-1"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-600 uppercase">Parameter Name</span>
              <input 
                type="text" 
                value={targetParam} 
                onChange={e => setTargetParam(e.target.value)}
                placeholder="e.g. gain"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-600 uppercase">Parameter Values (comma-separated)</span>
            <input 
              type="text" 
              value={paramValues} 
              onChange={e => setParamValues(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
            />
          </label>

          <div className="flex justify-end pt-2">
            <button
              onClick={executeSweep}
              disabled={isRunning}
              className={`rounded-lg px-6 py-2 text-sm font-bold text-white transition-all ${
                isRunning ? "bg-slate-400" : "bg-indigo-600 hover:bg-indigo-700 shadow-md"
              }`}
            >
              {isRunning ? "Executing Sweep..." : "Run Parallel Sweep"}
            </button>
          </div>

          {error && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-600">
              {error}
            </div>
          )}

          {results && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase">Results</h3>
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2">Parameter Value</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Final State</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {results.map((res, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2 font-mono">{JSON.stringify(res.parameterSet[targetNodeId][targetParam])}</td>
                        <td className="px-4 py-2">
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                            res.success ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                          }`}>
                            {res.success ? "SUCCESS" : "FAILED"}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-slate-500 truncate max-w-[200px]">
                          {res.success ? `Tick ${res.finalSnapshot.tick}` : res.error}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
        <footer className="border-t border-slate-200 px-6 py-3 bg-slate-50 flex justify-end">
          <button onClick={onClose} className="text-sm font-medium text-slate-600 hover:text-slate-800">Close</button>
        </footer>
      </div>
    </div>
  );
}
