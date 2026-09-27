# TENNE Architecture Overview

## 1. System Structure
TENNE is architected with strict layer boundaries:
- **`src/game/domain/`**: Pure, deterministic combat domain logic. Zero dependency on browsers, DOM, canvas, or Phaser.
- **`src/game/application/`**: Application use-cases and coordination between input intent and domain transitions.
- **`src/game/presentation/`**: Visual rendering adapters mounting the canvas. Reads domain state without dictating domain truth.
- **`src/journey/`**: Standalone Agent Journey dashboard built with React and TypeScript.
- **`public/generated/journey/`**: Sanitized, read-only public export compiled from `.agent-history/events.jsonl`.

## 2. Multi-Page Surface Routing
Configured via multi-page Vite:
- `/`: Landing Portal (`index.html`)
- `/play/`: Combat Client Mount (`play/index.html`)
- `/journey/`: Agent Journey Viewer (`journey/index.html`)

## 3. Strict Verification Pipeline
Unified execution through `npm run verify` orchestrates:
1. Static typing (`tsc --noEmit`)
2. Linting (`eslint .`)
3. Headless testing (`vitest run`)
4. Guardrail registry auditing (`check-guardrails.mjs`)
5. Public Journey integrity validation (`validate-journey-data.mjs`)
6. Translation parity checks (`verify-translations.mjs`)
7. Multi-page production build (`vite build`)
