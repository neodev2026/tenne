# TENNE

> **Deterministic Browser Combat & Controlled Software-Agent Autonomy**

[한국어 (Korean)](./README.ko.md) | [Deutsch (German)](./README.de.md)

TENNE is an open-source, zero-install browser squad combat game inspired by the structural mechanics of cover-based squad shooters. It is developed as an experiment in controlled software-agent autonomy with strict human trust boundaries.

## Architecture & Surfaces
- **`/` (Portal)**: High-level mission overview, current status, and entry navigation.
- **`/play/`**: Browser game client mount point with decoupled deterministic domain logic.
- **`/journey/`**: Interactive Agent Journey dashboard (React + TypeScript) displaying append-only historical audit facts.

## Verification & Quickstart
```bash
# Install dependencies
npm ci

# Run deterministic verification suite
npm run verify

# Launch local development server
npm run dev
```

## Documentation
- [GOAL.md](./GOAL.md): Canonical Product and Engineering Goals.
- [PROJECT_STATE.md](./PROJECT_STATE.md): Human-Trusted State on `main`.
- [docs/en/ARCHITECTURE.md](./docs/en/ARCHITECTURE.md): System architecture and decoupled domain design.
- [docs/en/AGENT_OPERATING_MODEL.md](./docs/en/AGENT_OPERATING_MODEL.md): Agent roles, autonomy windows, and operating contract.
