# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BDM Enhancement Simulator - A TypeScript/React web app for simulating Black Desert Mobile awakening enhancement system with Monte Carlo strategy analysis.

## Build & Development Commands

```bash
# From project root
pnpm install          # Install dependencies
pnpm dev              # Start dev server (http://localhost:5173)
pnpm build            # Build all packages
pnpm test             # Run tests
pnpm lint             # Run biome linter
pnpm format           # Format code with biome
pnpm check            # Lint + format in one command

# Run single test file
cd packages/simulator && pnpm vitest run src/simulator.test.ts

# Run tests in watch mode
cd packages/simulator && pnpm test:watch
```

## Architecture

### Monorepo Structure

```
├── packages/simulator/     # Framework-agnostic simulation engine (@bdm-sim/simulator)
│   └── src/
│       ├── simulator.ts    # AwakeningEngine class (core logic)
│       ├── types.ts        # TypeScript interfaces
│       └── config.ts       # Enhancement rates, thresholds, formulas
└── apps/web/               # React 19 + Vite frontend (@bdm-sim/web)
    └── src/
        ├── pages/          # Page components (home, awakening-config, simulation, strategy-finder)
        ├── components/     # UI components (Radix-based)
        ├── hooks/use-store.ts  # Zustand state management
        └── workers/        # Web Workers for offloading computation
```

### Key Architectural Patterns

1. **Simulator Library** (`@bdm-sim/simulator`): Pure TypeScript, no React dependencies. Contains `AwakeningEngine` class with seeded RNG (Mulberry32) for reproducible simulations. Provides both `runFullSimulation()` for UI playback and `runFast()`/`runFastWithLimits()` for high-performance Monte Carlo.

2. **State Management**: Zustand store (`use-store.ts`) handles simulation state with a ring buffer for step history (O(1) writes). Persists configuration to localStorage with schema versioning.

3. **Web Workers**: Strategy analysis runs in `strategy.worker.ts` to avoid blocking the UI. Uses typed arrays (`Float64Array`, `Uint32Array`) for performance in Monte Carlo simulations.

4. **UI Components**: Built on Radix UI primitives with Tailwind CSS v4. Component variants use `class-variance-authority`.

## Code Style

Configured via `biome.json`:
- Tab indentation
- Single quotes
- No semicolons (except when needed)
- 100 char line width
- Import organization enabled

## Enhancement System Reference

| Level | Success Rate | Anvil Pity |
|-------|-------------|------------|
| I     | 70%         | -          |
| II    | 60%         | -          |
| III   | 40%         | 2          |
| IV    | 20%         | 3          |
| V     | 10%         | 5          |
| VI    | 7%          | 8          |
| VII   | 5%          | 10         |
| VIII  | 3%          | 17         |
| IX    | 1%          | 50         |
| X     | 0.5%        | 100        |

Hepta/Okta paths use 6% success rate with 17 pity and Exquisite Black Crystals.
