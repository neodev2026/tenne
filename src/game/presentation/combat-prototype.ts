/**
 * TENNE Presentation Layer — Playable Combat Prototype Visual Component & View-Model
 *
 * Rule AS-001: Gameplay and Rendering Separation (Presentation strictly observes snapshot state).
 * Rule AS-002 §§3–4: Prototype-Scoped Application Runtime Session Boundary.
 * Rule AS-003: Rendering Cannot Define Gameplay Truth.
 * Rule AS-004: Gameplay Logic Must Be Testable Without Browser (100% Node-safe to import).
 *
 * T-032 implements the pure view-model projection, headless controller, and tactical DOM stage
 * for the single-character firing & ammo-depletion auto-cover prototype.
 * Presentation owns zero gameplay state; all state flows from `session.getSnapshot()`.
 */

import {
  CharacterPosture,
  WeaponAction,
  type MagazineAmmo,
} from '../domain/index.ts';

// ============================================================================
// Prototype Session Port (AS-002 §§3–4)
// ============================================================================

export interface CombatPrototypeSnapshotInput {
  readonly posture: CharacterPosture;
  readonly weaponAction: WeaponAction;
  readonly magazineAmmo: MagazineAmmo;
  readonly isFiringResolutionAvailable: boolean;
  // Accept the T-030 session until the T-034 extension is wired into /play/.
  readonly isCoverTransitionCompletionAvailable?: boolean;
  readonly isReloadStartAvailable?: boolean;
  readonly isReloadCompletionAvailable?: boolean;
  readonly isExposureStartAvailable?: boolean;
  readonly isExposureCompletionAvailable?: boolean;
}

export interface CombatPrototypeSessionPort {
  getSnapshot(): CombatPrototypeSnapshotInput;
  resolveSingleFiring(): boolean;
  completeCoverTransition?(): boolean;
  startReload?(): boolean;
  completeReload?(): boolean;
  beginExposure?(): boolean;
  completeExposure?(): boolean;
  resetPrototype(): void;
}

// ============================================================================
// Pure View-Model Projection
// ============================================================================

export type CombatPrototypeStagePostureClass =
  | 'stage-exposed'
  | 'stage-transitioning-cover'
  | 'stage-covered'
  | 'stage-transitioning-exposed';

export interface CombatPrototypeViewModel {
  readonly postureLabel: string;
  readonly weaponActionLabel: string;
  readonly magazineAmmoCount: number;
  readonly isFireButtonEnabled: boolean;
  readonly isEnterCoverButtonEnabled: boolean;
  readonly isStartReloadButtonEnabled: boolean;
  readonly isCompleteReloadButtonEnabled: boolean;
  readonly isExposeButtonEnabled: boolean;
  readonly isCompleteExposureButtonEnabled: boolean;
  readonly isDepletedAutoCoverActive: boolean;
  readonly stagePostureClass: CombatPrototypeStagePostureClass;
  readonly statusHeadline: string;
  readonly authorityNote: string;
}

export const PROTOTYPE_AUTHORITY_NOTE =
  'Reload restores the demo ammo to its default. Advance each step with its button.';

function deriveStagePostureClass(posture: CharacterPosture): CombatPrototypeStagePostureClass {
  switch (posture) {
    case CharacterPosture.EXPOSED:
      return 'stage-exposed';
    case CharacterPosture.TRANSITIONING_TO_COVERED:
      return 'stage-transitioning-cover';
    case CharacterPosture.COVERED:
      return 'stage-covered';
    case CharacterPosture.TRANSITIONING_TO_EXPOSED:
      return 'stage-transitioning-exposed';
  }
}

function deriveStatusHeadline(
  snapshot: CombatPrototypeSnapshotInput,
  isDepletedAutoCoverActive: boolean
): string {
  if (isDepletedAutoCoverActive) {
    return 'MAGAZINE DEPLETED — MOVING TO COVER';
  }
  if (
    snapshot.posture === CharacterPosture.EXPOSED &&
    snapshot.weaponAction === WeaponAction.FIRING
  ) {
    return 'EXPOSED — FIRING';
  }
  return `${snapshot.posture} — ${snapshot.weaponAction}`;
}

/**
 * Projects the snapshot into a shallow-frozen view model. Availability comes from the session.
 */
export function deriveCombatPrototypeViewModel(
  snapshot: CombatPrototypeSnapshotInput
): CombatPrototypeViewModel {
  const isDepletedAutoCoverActive =
    snapshot.magazineAmmo === 0 &&
    snapshot.weaponAction === WeaponAction.IDLE &&
    snapshot.posture === CharacterPosture.TRANSITIONING_TO_COVERED;

  const stagePostureClass = deriveStagePostureClass(snapshot.posture);
  const statusHeadline = deriveStatusHeadline(snapshot, isDepletedAutoCoverActive);

  return Object.freeze({
    postureLabel: snapshot.posture,
    weaponActionLabel: snapshot.weaponAction,
    magazineAmmoCount: snapshot.magazineAmmo,
    isFireButtonEnabled: snapshot.isFiringResolutionAvailable,
    isEnterCoverButtonEnabled: snapshot.isCoverTransitionCompletionAvailable ?? false,
    isStartReloadButtonEnabled: snapshot.isReloadStartAvailable ?? false,
    isCompleteReloadButtonEnabled: snapshot.isReloadCompletionAvailable ?? false,
    isExposeButtonEnabled: snapshot.isExposureStartAvailable ?? false,
    isCompleteExposureButtonEnabled: snapshot.isExposureCompletionAvailable ?? false,
    isDepletedAutoCoverActive,
    stagePostureClass,
    statusHeadline,
    authorityNote: PROTOTYPE_AUTHORITY_NOTE,
  });
}

// ============================================================================
// Headless Controller (Snapshot Refresh Rule)
// ============================================================================

export interface CombatPrototypeController {
  getViewModel(): CombatPrototypeViewModel;
  fireRound(): boolean;
  completeCoverTransition(): boolean;
  startReload(): boolean;
  completeReload(): boolean;
  beginExposure(): boolean;
  completeExposure(): boolean;
  resetDemo(): CombatPrototypeViewModel;
}

/**
 * Creates a headless Presentation controller bound to a CombatPrototypeSessionPort.
 *
 * Enforces the Snapshot Refresh Rule:
 * Every command dispatches to the session, immediately rereads `session.getSnapshot()`,
 * derives a fresh CombatPrototypeViewModel, and notifies `onRefresh` if provided.
 */
export function createCombatPrototypeController(
  session: CombatPrototypeSessionPort,
  onRefresh?: (vm: CombatPrototypeViewModel) => void
): CombatPrototypeController {
  function refresh(): CombatPrototypeViewModel {
    const vm = deriveCombatPrototypeViewModel(session.getSnapshot());
    onRefresh?.(vm);
    return vm;
  }

  function dispatch(command: (() => boolean) | undefined): boolean {
    const resolved = command?.call(session) ?? false;
    refresh();
    return resolved;
  }

  return {
    getViewModel(): CombatPrototypeViewModel {
      return deriveCombatPrototypeViewModel(session.getSnapshot());
    },
    fireRound(): boolean {
      return dispatch(session.resolveSingleFiring);
    },
    completeCoverTransition(): boolean {
      return dispatch(session.completeCoverTransition);
    },
    startReload(): boolean {
      return dispatch(session.startReload);
    },
    completeReload(): boolean {
      return dispatch(session.completeReload);
    },
    beginExposure(): boolean {
      return dispatch(session.beginExposure);
    },
    completeExposure(): boolean {
      return dispatch(session.completeExposure);
    },
    resetDemo(): CombatPrototypeViewModel {
      session.resetPrototype();
      return refresh();
    },
  };
}

// ============================================================================
// Visually Coherent Prototype DOM Mount (Browser Only)
// ============================================================================

const WALKTHROUGH_CONTROLS = [
  { id: 'proto-btn-enter-cover', label: 'Enter Cover', command: 'completeCoverTransition', availability: 'isEnterCoverButtonEnabled' },
  { id: 'proto-btn-start-reload', label: 'Start Reload', command: 'startReload', availability: 'isStartReloadButtonEnabled' },
  { id: 'proto-btn-complete-reload', label: 'Complete Reload', command: 'completeReload', availability: 'isCompleteReloadButtonEnabled' },
  { id: 'proto-btn-expose', label: 'Expose', command: 'beginExposure', availability: 'isExposeButtonEnabled' },
  { id: 'proto-btn-complete-exposure', label: 'Complete Exposure', command: 'completeExposure', availability: 'isCompleteExposureButtonEnabled' },
] as const;

export interface CombatPrototypeMountInstance {
  unmount(): void;
  getController(): CombatPrototypeController;
}

/**
 * Mounts the tactical 2D combat prototype viewport into a DOM container element.
 *
 * Uses CSS variables from `src/style.css` with self-contained inline styles and SVG.
 * Owns zero gameplay state; all visual state is derived from `session.getSnapshot()`.
 */
export function mountCombatPrototype(
  container: HTMLElement,
  session: CombatPrototypeSessionPort
): CombatPrototypeMountInstance {
  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'combat-prototype-panel';
  wrapper.style.cssText = [
    'width: 100%',
    'max-width: 860px',
    'padding: 1.25rem 1.5rem',
    'display: flex',
    'flex-direction: column',
    'gap: 1rem',
    'color: var(--text-primary)',
    'font-family: var(--font-sans)',
    'text-align: left',
  ].join(';');

  wrapper.innerHTML = `
    <header style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.65rem;">
      <div>
        <h2 style="font-size: 1.25rem; font-weight: 800; letter-spacing: -0.01em; color: var(--text-primary);">
          TENNE — Combat Prototype
        </h2>
        <p id="proto-status-headline" role="status" style="font-family: var(--font-mono); font-size: 0.82rem; font-weight: 700; margin-top: 0.2rem; color: var(--accent-cyan);"></p>
      </div>
      <span class="badge-tag" style="font-size: 0.7rem;">Playable Prototype</span>
    </header>

    <div id="proto-stage" style="position: relative; width: 100%; height: 220px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); background: radial-gradient(circle at 50% 25%, rgba(56, 189, 248, 0.12), rgba(10, 13, 20, 0.95) 75%); overflow: hidden;">
      <svg id="proto-stage-svg" viewBox="0 0 640 220" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-label="Tactical Combat Stage">
        <!-- Tactical grid floor -->
        <line x1="0" y1="185" x2="640" y2="185" stroke="rgba(148, 163, 184, 0.25)" stroke-width="2" />
        <line x1="80" y1="185" x2="40" y2="220" stroke="rgba(148, 163, 184, 0.12)" stroke-width="1" />
        <line x1="200" y1="185" x2="180" y2="220" stroke="rgba(148, 163, 184, 0.12)" stroke-width="1" />
        <line x1="320" y1="185" x2="320" y2="220" stroke="rgba(148, 163, 184, 0.12)" stroke-width="1" />
        <line x1="440" y1="185" x2="460" y2="220" stroke="rgba(148, 163, 184, 0.12)" stroke-width="1" />
        <line x1="560" y1="185" x2="600" y2="220" stroke="rgba(148, 163, 184, 0.12)" stroke-width="1" />

        <!-- Distant range marker -->
        <rect x="490" y="70" width="52" height="72" rx="4" fill="rgba(244, 63, 94, 0.1)" stroke="rgba(244, 63, 94, 0.35)" stroke-width="1.5" stroke-dasharray="4 3" />
        <circle cx="516" cy="106" r="14" fill="none" stroke="rgba(244, 63, 94, 0.45)" stroke-width="1.5" />
        <circle cx="516" cy="106" r="4" fill="rgba(244, 63, 94, 0.65)" />

        <!-- Character silhouette group (translated smoothly by posture) -->
        <g id="proto-unit-group" style="transition: transform 220ms ease;">
          <!-- Head -->
          <circle cx="190" cy="72" r="14" fill="#38bdf8" stroke="#f8fafc" stroke-width="2" />
          <!-- Torso -->
          <rect x="176" y="90" width="28" height="48" rx="6" fill="#1e293b" stroke="#38bdf8" stroke-width="2" />
          <!-- Legs -->
          <line x1="183" y1="138" x2="180" y2="183" stroke="#94a3b8" stroke-width="5" stroke-linecap="round" />
          <line x1="197" y1="138" x2="202" y2="183" stroke="#94a3b8" stroke-width="5" stroke-linecap="round" />
          <!-- Weapon barrel -->
          <rect x="198" y="98" width="54" height="8" rx="2" fill="#e2e8f0" />
          <!-- Muzzle flash indicator (visible when EXPOSED + FIRING) -->
          <g id="proto-muzzle-flash">
            <polygon points="256,102 276,94 270,102 284,102 270,106 276,112" fill="#f59e0b" />
            <line x1="286" y1="102" x2="480" y2="106" stroke="rgba(245, 158, 11, 0.55)" stroke-width="2" stroke-dasharray="8 6" />
          </g>
        </g>

        <!-- Tactical cover barricade / wall (foreground) -->
        <g id="proto-cover-barricade">
          <rect x="145" y="128" width="118" height="57" rx="4" fill="#121824" stroke="rgba(56, 189, 248, 0.55)" stroke-width="2" />
          <line x1="155" y1="142" x2="253" y2="142" stroke="rgba(56, 189, 248, 0.35)" stroke-width="2" />
          <text x="204" y="164" text-anchor="middle" fill="#94a3b8" font-size="10" font-family="monospace" letter-spacing="1.5">COVER</text>
        </g>
      </svg>

      <!-- Auto-cover callout banner (visible when depleted & moving to cover) -->
      <div id="proto-autocover-banner" style="display: none; position: absolute; top: 0.75rem; right: 0.75rem; background: rgba(245, 158, 11, 0.16); border: 1px solid rgba(245, 158, 11, 0.55); color: var(--accent-amber); padding: 0.35rem 0.75rem; border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: 0.75rem; font-weight: 700; letter-spacing: 0.04em;">
        AUTO-COVER ENGAGED (0 AMMO)
      </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.85rem;">
      <div class="card" style="padding: 0.85rem 1rem;">
        <span style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Character Posture</span>
        <div id="proto-posture-pill" class="code-pill" style="margin-top: 0.4rem; font-size: 0.88rem; font-weight: 700; display: inline-block;"></div>
      </div>

      <div class="card" style="padding: 0.85rem 1rem;">
        <span style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Weapon Action</span>
        <div id="proto-action-pill" class="code-pill" style="margin-top: 0.4rem; font-size: 0.88rem; font-weight: 700; display: inline-block;"></div>
      </div>

      <div class="card" style="padding: 0.85rem 1rem;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Magazine Ammo</span>
          <span id="proto-ammo-count" style="font-family: var(--font-mono); font-size: 1rem; font-weight: 800; color: var(--accent-cyan);"></span>
        </div>
        <div id="proto-ammo-pips" style="display: flex; gap: 0.4rem; margin-top: 0.55rem; align-items: center; min-height: 18px;"></div>
      </div>
    </div>

    <div style="display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap;">
      <button type="button" id="proto-btn-fire" class="btn-primary" style="cursor: pointer; padding: 0.65rem 1.5rem; font-size: 0.95rem; border: none;">
        Fire Round
      </button>
      ${WALKTHROUGH_CONTROLS.map(({ id, label }) => `
        <button type="button" id="${id}" class="btn-secondary" style="padding: 0.65rem 1rem; font-size: 0.9rem;" disabled>
          ${label}
        </button>
      `).join('')}
      <button type="button" id="proto-btn-reset" class="btn-secondary" style="cursor: pointer; padding: 0.65rem 1.25rem; font-size: 0.9rem;">
        Reset Demo
      </button>
    </div>

    <footer style="background: rgba(56, 189, 248, 0.06); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 0.55rem 0.85rem;">
      <p id="proto-authority-note" style="color: var(--text-muted); font-size: 0.76rem; line-height: 1.45;"></p>
    </footer>
  `;

  container.appendChild(wrapper);

  const headlineEl = wrapper.querySelector<HTMLElement>('#proto-status-headline')!;
  const stageEl = wrapper.querySelector<HTMLElement>('#proto-stage')!;
  const unitGroupEl = wrapper.querySelector<SVGGElement>('#proto-unit-group')!;
  const muzzleFlashEl = wrapper.querySelector<SVGGElement>('#proto-muzzle-flash')!;
  const autoCoverBannerEl = wrapper.querySelector<HTMLElement>('#proto-autocover-banner')!;
  const posturePillEl = wrapper.querySelector<HTMLElement>('#proto-posture-pill')!;
  const actionPillEl = wrapper.querySelector<HTMLElement>('#proto-action-pill')!;
  const ammoCountEl = wrapper.querySelector<HTMLElement>('#proto-ammo-count')!;
  const ammoPipsEl = wrapper.querySelector<HTMLElement>('#proto-ammo-pips')!;
  const btnFire = wrapper.querySelector<HTMLButtonElement>('#proto-btn-fire')!;
  const btnReset = wrapper.querySelector<HTMLButtonElement>('#proto-btn-reset')!;
  const authorityNoteEl = wrapper.querySelector<HTMLElement>('#proto-authority-note')!;

  const walkthroughButtons = WALKTHROUGH_CONTROLS.map(({ id, command, availability }) => ({
    button: wrapper.querySelector<HTMLButtonElement>(`#${id}`)!,
    command,
    availability,
  }));

  // Track highest observed ammo count purely for visual pip slot rendering (UI presentation only)
  let maxObservedPips = 3;

  function render(vm: CombatPrototypeViewModel): void {
    headlineEl.textContent = vm.statusHeadline;
    headlineEl.style.color = vm.isDepletedAutoCoverActive
      ? 'var(--accent-amber)'
      : 'var(--accent-cyan)';

    stageEl.className = vm.stagePostureClass;
    posturePillEl.textContent = vm.postureLabel;
    actionPillEl.textContent = vm.weaponActionLabel;
    authorityNoteEl.textContent = vm.authorityNote;

    // Position character silhouette according to posture
    if (vm.stagePostureClass === 'stage-exposed') {
      unitGroupEl.style.transform = 'translate(0px, 0px)';
    } else if (vm.stagePostureClass === 'stage-transitioning-cover') {
      unitGroupEl.style.transform = 'translate(-6px, 34px)';
    } else if (vm.stagePostureClass === 'stage-covered') {
      unitGroupEl.style.transform = 'translate(-10px, 52px)';
    } else {
      unitGroupEl.style.transform = 'translate(-4px, 22px)';
    }

    // Show muzzle flash indicator only while EXPOSED and FIRING
    const showMuzzleFlash =
      vm.stagePostureClass === 'stage-exposed' &&
      vm.weaponActionLabel === WeaponAction.FIRING;
    muzzleFlashEl.style.display = showMuzzleFlash ? 'inline' : 'none';

    // Auto-cover callout banner
    autoCoverBannerEl.style.display = vm.isDepletedAutoCoverActive ? 'block' : 'none';

    // Magazine ammo count & discrete round pips
    if (vm.magazineAmmoCount > maxObservedPips) {
      maxObservedPips = vm.magazineAmmoCount;
    }
    ammoCountEl.textContent = String(vm.magazineAmmoCount);
    ammoCountEl.style.color =
      vm.magazineAmmoCount > 0 ? 'var(--accent-cyan)' : 'var(--accent-amber)';

    ammoPipsEl.innerHTML = '';
    for (let i = 0; i < maxObservedPips; i++) {
      const pip = document.createElement('span');
      const isFilled = i < vm.magazineAmmoCount;
      pip.style.cssText = [
        'display: inline-block',
        'width: 14px',
        'height: 18px',
        'border-radius: 3px',
        isFilled
          ? 'background: var(--accent-cyan); box-shadow: 0 0 8px rgba(56, 189, 248, 0.45); border: 1px solid rgba(255, 255, 255, 0.35)'
          : 'background: rgba(148, 163, 184, 0.12); border: 1px solid var(--border-subtle)',
      ].join(';');
      ammoPipsEl.appendChild(pip);
    }

    // Fire button availability derived strictly from vm.isFireButtonEnabled
    btnFire.disabled = !vm.isFireButtonEnabled;
    btnFire.style.opacity = vm.isFireButtonEnabled ? '1' : '0.4';
    btnFire.style.cursor = vm.isFireButtonEnabled ? 'pointer' : 'not-allowed';

    for (const { button, availability } of walkthroughButtons) {
      button.disabled = !vm[availability];
      button.style.opacity = vm[availability] ? '1' : '0.4';
    }
  }

  const controller = createCombatPrototypeController(session, render);

  const onFireClick = (): void => {
    controller.fireRound();
  };
  const onResetClick = (): void => {
    controller.resetDemo();
  };

  btnFire.addEventListener('click', onFireClick);
  btnReset.addEventListener('click', onResetClick);

  const walkthroughListeners = walkthroughButtons.map(({ button, command }) => {
    const listener = (): void => {
      controller[command]();
    };
    button.addEventListener('click', listener);
    return { button, listener };
  });

  render(controller.getViewModel());

  return {
    unmount(): void {
      btnFire.removeEventListener('click', onFireClick);
      btnReset.removeEventListener('click', onResetClick);
      for (const { button, listener } of walkthroughListeners) {
        button.removeEventListener('click', listener);
      }
      container.innerHTML = '';
    },
    getController(): CombatPrototypeController {
      return controller;
    },
  };
}
