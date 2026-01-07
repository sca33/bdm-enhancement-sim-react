# BDM Enhancement Simulator

A web-based simulator for Black Desert Mobile awakening enhancement system with Monte Carlo strategy analysis.

## Features

- **Enhancement Simulation**: Simulate awakening enhancements from +0 to +X with realistic success rates
- **Anvil Pity System**: Tracks the Ancient Anvil pity counter for guaranteed success
- **Restoration Scrolls**: Configurable restoration scroll usage with 50% success rate
- **Advice of Valks**: Support for +10%, +50%, +100% Valks with multiplicative bonuses
- **Hepta/Okta Paths**: Alternative enhancement paths using Exquisite Black Crystals
- **Monte Carlo Strategy Analysis**: Find optimal restoration and Hepta/Okta strategies
- **Simulation History**: Auto-saved runs with compression, pin protection, and restore capability
- **Resource Tracking**: Track crystals, scrolls, silver, and time spent

## Enhancement Rates

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

## Tech Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS v4
- Zustand (state management)
- Radix UI (components)
- LZ-string (compression)

## Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test

# Lint
pnpm lint
```

## Project Structure

```
├── apps/web/              # React frontend
│   └── src/
│       ├── components/    # UI components
│       ├── hooks/         # Zustand store
│       ├── pages/         # Page components
│       └── lib/           # Utilities
└── packages/simulator/    # Core simulation engine
    └── src/
        ├── simulator.ts   # AwakeningEngine class
        ├── types.ts       # TypeScript interfaces
        └── config.ts      # Game constants
```

## License

MIT License - see [LICENSE](LICENSE) file for details.
