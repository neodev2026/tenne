# TENNE Semantic Layer Overview

## 1. Purpose of the Semantic Layer
The Semantic Layer codifies domain definitions, gameplay rules, architectural boundaries, and engineering conventions in structured files under `semantic/`. It ensures that critical project meanings do not live only in ephemeral prompts.

## 2. Rule Domains
- **Product (`PS-*`)**: Identity, browser playability, zero-install requirements.
- **Gameplay (`GS-*`)**: Combat state machines, ammo handling, reload, stun, and skills.
- **Architecture (`AS-*`)**: Engine decoupling, headless testability, and rendering boundaries.
- **Engineering (`EC-*`)**: Strict typing, naming conventions, and single source of truth.

## 3. Semantic Gap Policy (G-052)
When an agent encounters undefined gameplay formulas or domain behaviors, it must never invent them. It must register a **Semantic Gap** and request human decision.
