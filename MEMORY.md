# MEMORY.md - Long-term Context

## Current Focus
- **Project: web-simulink**
 - High-fidelity, mobile-reactive block-diagram simulation platform.
 - Phase 13 (Advanced Control & External I/O) in progress.
 - Core features: MQTT/WebSocket Bridge (P13-1), Neural Network Blocks (P13-2), Profiler (P13-3), and Real-time Collaborative Sync (P13-4) implemented and verified as of 2026-04-06.
 - State: Finalizing P13 verification (P13-5) and ready for deployment.

## Decisions & Lessons
- **Session Locking**: Ensure sub-agents are spawned in isolated sessions to prevent lock conflicts.
- **Tooling**: Use `Vitest` for deterministic simulation tests.
- **Design**: Industrial palette (orange sources, blue sinks). Compact, icon-only blocks for complex models.
- **I/O Blocks**: New purple color (#a855f7) designated for external I/O blocks (distinct from signal flow colors).
- **Collaboration Protocol (P13-4)**: Uses a lightweight WebSocket broadcast to sync React Flow node/edge changes and simulation timing. Implements Last Write Wins (LWW) conflict resolution by flagging remote updates to prevent broadcast loops.

## Human Preferences
- **Kelvin**: Speaks Mandarin fluently. Prefers high-density documentation and deterministic execution.
- **Vibe**: Direct, resourceful, friend-like but professional.
