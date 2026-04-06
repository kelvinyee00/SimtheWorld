# MEMORY.md - Long-term Context

## Current Focus
- **Project: web-simulink**
 - High-fidelity, mobile-reactive block-diagram simulation platform.
 - Phase 13 (Advanced Control & External I/O) complete as of 2026-04-06.
 - Core features: MQTT/WebSocket Bridge (P13-1), Neural Network Blocks (P13-2), Profiler (P13-3), Real-time Collaborative Sync (P13-4), and Final Verification (P13-5) integrated and verified.
- Phase 14 (Engineering Excellence & Intelligent Inference) initiated as of 2026-04-06. 
 - Focus: Transitioning to industrial-grade architecture via Headless Execution (P14-2) and a Vectorized Math Core (P14-1).
 - Goals: Standalone CLI driver, ONNX block integration (P14-3), and CI validation framework (P14-4).

## Decisions & Lessons
- **Math Architecture**: Moving from `number[][]` to a dedicated linear algebra library/typed-array wrapper (P14-1) to support high-performance inference.
- **Project North Star**: Headless, pure Node.js execution to prove architecture portability beyond the DOM.

- **Session Locking**: Ensure sub-agents are spawned in isolated sessions to prevent lock conflicts.
- **Tooling**: Use `Vitest` for deterministic simulation tests.
- **Design**: Industrial palette (orange sources, blue sinks). Compact, icon-only blocks for complex models.
- **I/O Blocks**: New purple color (#a855f7) designated for external I/O blocks (distinct from signal flow colors).
- **Collaboration Protocol (P13-4)**: Uses a lightweight WebSocket broadcast to sync React Flow node/edge changes and simulation timing. Implements Last Write Wins (LWW) conflict resolution by flagging remote updates to prevent broadcast loops.

## Human Preferences
- **Kelvin**: Speaks Mandarin fluently. Prefers high-density documentation and deterministic execution.
- **Vibe**: Direct, resourceful, friend-like but professional.
