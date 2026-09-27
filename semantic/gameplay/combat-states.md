# TENNE Gameplay Semantics: Combat States

> [!IMPORTANT]
> In accordance with Task T-000 boundaries, detailed combat formulas and transition criteria are not invented by agents. Missing canonical definitions are formally tracked as Semantic Gaps awaiting human domain specification.

## GS-001: WAITING
* **Domain**: Gameplay
* **Status**: Approved (Metadata Stub)
* **Tags**: `combat`, `state-machine`, `waiting`
* **Semantic Gap**: `GAP-GS-001`
  * *Status*: Pending Canonical Specification
  * *Details*: Idle stance, squad readiness transition, and cover orientation logic require human specification prior to gameplay implementation.

## GS-002: FIRING
* **Domain**: Gameplay
* **Status**: Approved (Metadata Stub)
* **Tags**: `combat`, `state-machine`, `firing`, `ammo`
* **Semantic Gap**: `GAP-GS-002`
  * *Status*: Pending Canonical Specification
  * *Details*: Rate of fire, projectile vs. hitscan resolution, recoil timing, and ammo consumption specs require human specification.

## GS-003: RELOADING
* **Domain**: Gameplay
* **Status**: Approved (Metadata Stub)
* **Tags**: `combat`, `state-machine`, `reload`, `stun`
* **Semantic Gap**: `GAP-GS-003`
  * *Status*: Pending Canonical Specification
  * *Details*: Reload duration, manual vs. automatic trigger conditions, and interruption rules upon stun require human specification.

## GS-004: Ammo Exhaustion
* **Domain**: Gameplay
* **Status**: Approved (Metadata Stub)
* **Tags**: `combat`, `ammo`, `reload`
* **Semantic Gap**: `GAP-GS-004`
  * *Status*: Pending Canonical Specification
  * *Details*: Behavior upon zero magazine ammo (auto-reload vs. empty trigger lockout) requires human specification.

## GS-005: STUNNED
* **Domain**: Gameplay
* **Status**: Approved (Metadata Stub)
* **Tags**: `combat`, `state-machine`, `stun`
* **Semantic Gap**: `GAP-GS-005`
  * *Status*: Pending Canonical Specification
  * *Details*: Stun durations, crowd-control recovery transitions, and interaction with ongoing actions require human specification.
