# TENNE Architecture Semantics

## AS-001: Gameplay and Rendering Separation
* **Domain**: Architecture
* **Status**: Approved
* **Tags**: `architecture`, `domain`, `phaser`, `rendering`
* **Specification**: Core gameplay logic must be completely isolated from the presentation rendering engine (e.g., Phaser, Canvas, WebGL). Gameplay domain logic lives in `src/game/domain/` and never directly imports rendering libraries.

## AS-002: Combat State Ownership
* **Domain**: Architecture
* **Status**: Approved
* **Tags**: `architecture`, `state-machine`, `state`
* **Specification**: Combat state (positions, ammo, health, status effects) is strictly owned and mutated by the deterministic domain state machine. Presentation components only read domain state or dispatch player intent commands.

## AS-003: Rendering Cannot Define Gameplay Truth
* **Domain**: Architecture
* **Status**: Approved
* **Tags**: `architecture`, `rendering`, `gameplay-state`
* **Specification**: Visual animations, framerates, particles, or screen dimensions must never dictate gameplay outcome. If rendering drops frames or freezes, the underlying simulation remains intact and authoritative.

## AS-004: Gameplay Logic Must Be Testable Without Browser
* **Domain**: Architecture
* **Status**: Approved
* **Tags**: `architecture`, `testing`, `domain`
* **Specification**: All domain state machines, damage calculations, and combat transitions must execute headlessly in pure Node.js/Vitest without requiring a browser window, DOM API, or WebGL context.
