/**
 * TENNE Presentation Layer (Thin Interactive Posture Presentation Adapter)
 *
 * Rule AS-001: Presentation strictly observes domain state.
 * Rule AS-002: Combat State Ownership (Presentation owns zero gameplay state; observes snapshot and dispatches user intent).
 * Rule AS-003: Rendering Cannot Define Gameplay Truth.
 * Rule AS-004: Gameplay Logic Must Be Testable Without Browser.
 *
 * T-016 implements the first interactive visual demo on /play/.
 * Preserves Human-Trusted getDomainState().gameplayImplemented === false.
 */

import {
  createPostureDemoSession,
  type PostureDemoSession,
  type PostureDemoSnapshot,
} from '../application/index.ts';
import {
  SquadPostureIntent,
} from '../domain/index.ts';

// ============================================================================
// Presentation View Model Projection (Pure)
// ============================================================================

export interface PostureDemoViewModel {
  /**
   * Display string for character posture (e.g. 'COVERED', 'EXPOSED', 'TRANSITIONING_TO_COVERED', 'TRANSITIONING_TO_EXPOSED').
   */
  readonly postureLabel: string;

  /**
   * Display string for squad posture intent (e.g. 'WANT_COVERED', 'WANT_EXPOSED').
   */
  readonly squadIntentLabel: string;

  /**
   * Display string for applicable transition (e.g. 'TRANSITIONING_TO_COVERED', 'TRANSITIONING_TO_EXPOSED', or 'NONE').
   */
  readonly applicableTransitionLabel: string;

  /**
   * Flag indicating whether an intent-driven posture transition is currently underway.
   */
  readonly isTransitionInProgress: boolean;

  /**
   * Display string for posture firing prerequisite (strictly 'SATISFIED' or 'NOT SATISFIED').
   */
  readonly postureFiringPrerequisiteLabel: 'SATISFIED' | 'NOT SATISFIED';

  /**
   * Boolean indicating if posture firing prerequisite is satisfied.
   */
  readonly isPostureFiringPrerequisiteSatisfied: boolean;

  /**
   * UI-only flag indicating whether Want Cover is the active squad posture intent.
   */
  readonly isWantCoverActive: boolean;

  /**
   * UI-only flag indicating whether Want Exposed is the active squad posture intent.
   */
  readonly isWantExposedActive: boolean;

  /**
   * UI-only flag: Begin Transition button is enabled iff snapshot.applicablePostureTransition !== null.
   */
  readonly isBeginTransitionEnabled: boolean;

  /**
   * UI-only flag: Complete Transition button is enabled iff snapshot.isTransitionInProgress === true.
   */
  readonly isCompleteTransitionEnabled: boolean;

  /**
   * Mandatory authority disclaimer ensuring posture check is not mistaken for global firing permission.
   */
  readonly authorityDisclaimer: string;

  /**
   * Mandatory authority disclaimer clarifying manual transition controls are demo controls with no simulated duration.
   */
  readonly manualTransitionNote: string;
}

export const MANDATORY_AUTHORITY_DISCLAIMER =
  'Posture check only — this does not mean global firing permission.';

export const MANDATORY_TRANSITION_NOTE =
  'Manual transition controls are demo controls. No transition duration is currently modeled.';

/**
 * Derives a pure presentation view model from an Application PostureDemoSnapshot.
 *
 * Implements strictly formatting, UI button availability derivation, and authority wording.
 * Presentation invents zero gameplay rules and never recomputes Domain transition applicability.
 */
export function derivePostureDemoViewModel(snapshot: PostureDemoSnapshot): PostureDemoViewModel {
  const postureLabel = snapshot.posture;
  const squadIntentLabel = snapshot.squadPostureIntent;
  const applicableTransitionLabel = snapshot.applicablePostureTransition ?? 'NONE';
  const isTransitionInProgress = snapshot.isTransitionInProgress;
  const isPostureFiringPrerequisiteSatisfied = snapshot.postureFiringPrerequisiteSatisfied;
  const postureFiringPrerequisiteLabel: 'SATISFIED' | 'NOT SATISFIED' = isPostureFiringPrerequisiteSatisfied
    ? 'SATISFIED'
    : 'NOT SATISFIED';

  const isWantCoverActive = snapshot.squadPostureIntent === SquadPostureIntent.WANT_COVERED;
  const isWantExposedActive = snapshot.squadPostureIntent === SquadPostureIntent.WANT_EXPOSED;

  // Button availability derived strictly from snapshot facts
  const isBeginTransitionEnabled = snapshot.applicablePostureTransition !== null;
  const isCompleteTransitionEnabled = snapshot.isTransitionInProgress;

  return Object.freeze({
    postureLabel,
    squadIntentLabel,
    applicableTransitionLabel,
    isTransitionInProgress,
    postureFiringPrerequisiteLabel,
    isPostureFiringPrerequisiteSatisfied,
    isWantCoverActive,
    isWantExposedActive,
    isBeginTransitionEnabled,
    isCompleteTransitionEnabled,
    authorityDisclaimer: MANDATORY_AUTHORITY_DISCLAIMER,
    manualTransitionNote: MANDATORY_TRANSITION_NOTE,
  });
}

// ============================================================================
// Presentation Controller
// ============================================================================

export interface PostureDemoController {
  getViewModel(): PostureDemoViewModel;
  wantCover(): PostureDemoViewModel;
  wantExposed(): PostureDemoViewModel;
  beginTransition(): boolean;
  completeTransition(): boolean;
}

/**
 * Creates a Presentation controller dispatching user intent actions to the Application PostureDemoSession.
 *
 * Enforces the Snapshot Refresh Rule:
 * Every presentation command dispatches to the session, immediately rereads getSnapshot(),
 * derives a fresh PostureDemoViewModel, and notifies any registered onRefresh listener.
 * The controller owns zero gameplay state.
 */
export function createPostureDemoController(
  session: PostureDemoSession,
  onRefresh?: (viewModel: PostureDemoViewModel) => void
): PostureDemoController {
  return {
    getViewModel(): PostureDemoViewModel {
      return derivePostureDemoViewModel(session.getSnapshot());
    },
    wantCover(): PostureDemoViewModel {
      session.setSquadPostureIntent(SquadPostureIntent.WANT_COVERED);
      const vm = derivePostureDemoViewModel(session.getSnapshot());
      onRefresh?.(vm);
      return vm;
    },
    wantExposed(): PostureDemoViewModel {
      session.setSquadPostureIntent(SquadPostureIntent.WANT_EXPOSED);
      const vm = derivePostureDemoViewModel(session.getSnapshot());
      onRefresh?.(vm);
      return vm;
    },
    beginTransition(): boolean {
      const outcome = session.beginTransition();
      const vm = derivePostureDemoViewModel(session.getSnapshot());
      onRefresh?.(vm);
      return outcome;
    },
    completeTransition(): boolean {
      const outcome = session.completeTransition();
      const vm = derivePostureDemoViewModel(session.getSnapshot());
      onRefresh?.(vm);
      return outcome;
    },
  };
}

// ============================================================================
// Thin DOM Mount (Browser Only)
// ============================================================================

export interface PostureDemoMountInstance {
  unmount: () => void;
  getController: () => PostureDemoController;
}

/**
 * Mounts the thin interactive Posture Demo inside a DOM container element.
 *
 * Deliberately thin DOM wiring using existing styles and CSS variables from src/style.css.
 * Presentation owns only DOM elements and event listeners; all state changes flow through the Application session.
 */
export function mountPostureDemo(
  container: HTMLElement,
  session?: PostureDemoSession
): PostureDemoMountInstance {
  const activeSession = session ?? createPostureDemoSession();

  // Clear existing placeholder content
  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'posture-demo-panel';
  wrapper.style.cssText = [
    'width: 100%',
    'max-width: 800px',
    'padding: 1.5rem',
    'display: flex',
    'flex-direction: column',
    'gap: 1.25rem',
    'color: var(--text-primary)',
    'font-family: var(--font-sans)',
  ].join(';');

  wrapper.innerHTML = `
    <header style="border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.75rem; text-align: left;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h2 style="font-size: 1.35rem; font-weight: 700; color: var(--text-primary); letter-spacing: -0.01em;">
          TENNE — Posture Demo
        </h2>
        <span class="badge-tag" style="font-size: 0.7rem;">Interactive Demo</span>
      </div>
      <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 0.25rem;">
        Application-layer state coordination rendered via thin presentation adapter.
      </p>
    </header>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem;">
      <div class="card" style="padding: 1rem;">
        <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Character Posture</span>
        <div id="demo-posture-val" class="code-pill" style="margin-top: 0.5rem; font-size: 0.95rem; font-weight: bold; display: inline-block;"></div>
      </div>
      <div class="card" style="padding: 1rem;">
        <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Squad Posture Intent</span>
        <div id="demo-intent-val" class="code-pill" style="margin-top: 0.5rem; font-size: 0.95rem; font-weight: bold; display: inline-block;"></div>
      </div>
      <div class="card" style="padding: 1rem;">
        <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Applicable Transition</span>
        <div id="demo-applicable-val" class="code-pill" style="margin-top: 0.5rem; font-size: 0.95rem; font-weight: bold; display: inline-block;"></div>
      </div>
      <div class="card" style="padding: 1rem;">
        <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Posture Firing Prerequisite</span>
        <div id="demo-firing-val" style="margin-top: 0.5rem; font-size: 0.95rem; font-weight: bold;"></div>
      </div>
    </div>

    <div style="background: rgba(56, 189, 248, 0.08); border: 1px solid var(--border-accent); border-radius: var(--radius-sm); padding: 0.65rem 1rem; font-size: 0.82rem; color: var(--accent-cyan); text-align: left;">
      <span id="demo-authority-disclaimer"></span>
    </div>

    <div style="display: flex; flex-direction: column; gap: 0.75rem; text-align: left;">
      <div>
        <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em;">Squad Intent Controls:</span>
        <div style="display: flex; gap: 0.75rem; margin-top: 0.4rem;">
          <button type="button" id="btn-want-cover" class="btn-secondary" style="cursor: pointer; padding: 0.5rem 1.25rem; font-size: 0.9rem;">
            Want Cover
          </button>
          <button type="button" id="btn-want-exposed" class="btn-secondary" style="cursor: pointer; padding: 0.5rem 1.25rem; font-size: 0.9rem;">
            Want Exposed
          </button>
        </div>
      </div>

      <div>
        <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em;">Manual Transition Controls (Demo Controls):</span>
        <div style="display: flex; gap: 0.75rem; margin-top: 0.4rem;">
          <button type="button" id="btn-begin-transition" class="btn-primary" style="cursor: pointer; padding: 0.5rem 1.25rem; font-size: 0.9rem;">
            Begin Transition
          </button>
          <button type="button" id="btn-complete-transition" class="btn-primary" style="cursor: pointer; padding: 0.5rem 1.25rem; font-size: 0.9rem;">
            Complete Transition
          </button>
        </div>
      </div>
    </div>

    <footer style="margin-top: 0.5rem; text-align: left;">
      <p id="demo-transition-note" style="color: var(--text-muted); font-size: 0.78rem; font-style: italic;"></p>
    </footer>
  `;

  container.appendChild(wrapper);

  // Element handles
  const postureValEl = wrapper.querySelector<HTMLElement>('#demo-posture-val')!;
  const intentValEl = wrapper.querySelector<HTMLElement>('#demo-intent-val')!;
  const applicableValEl = wrapper.querySelector<HTMLElement>('#demo-applicable-val')!;
  const firingValEl = wrapper.querySelector<HTMLElement>('#demo-firing-val')!;
  const disclaimerEl = wrapper.querySelector<HTMLElement>('#demo-authority-disclaimer')!;
  const transitionNoteEl = wrapper.querySelector<HTMLElement>('#demo-transition-note')!;

  const btnWantCover = wrapper.querySelector<HTMLButtonElement>('#btn-want-cover')!;
  const btnWantExposed = wrapper.querySelector<HTMLButtonElement>('#btn-want-exposed')!;
  const btnBeginTransition = wrapper.querySelector<HTMLButtonElement>('#btn-begin-transition')!;
  const btnCompleteTransition = wrapper.querySelector<HTMLButtonElement>('#btn-complete-transition')!;

  function render(vm: PostureDemoViewModel): void {
    postureValEl.textContent = vm.postureLabel;
    intentValEl.textContent = vm.squadIntentLabel;
    applicableValEl.textContent = vm.applicableTransitionLabel;

    firingValEl.textContent = vm.postureFiringPrerequisiteLabel;
    firingValEl.style.color = vm.isPostureFiringPrerequisiteSatisfied
      ? 'var(--accent-emerald)'
      : 'var(--accent-rose)';

    disclaimerEl.textContent = vm.authorityDisclaimer;
    transitionNoteEl.textContent = vm.manualTransitionNote;

    // Active squad intent button highlighting
    if (vm.isWantCoverActive) {
      btnWantCover.style.borderColor = 'var(--accent-cyan)';
      btnWantCover.style.background = 'rgba(56, 189, 248, 0.15)';
    } else {
      btnWantCover.style.borderColor = 'var(--border-subtle)';
      btnWantCover.style.background = 'var(--bg-card)';
    }

    if (vm.isWantExposedActive) {
      btnWantExposed.style.borderColor = 'var(--accent-cyan)';
      btnWantExposed.style.background = 'rgba(56, 189, 248, 0.15)';
    } else {
      btnWantExposed.style.borderColor = 'var(--border-subtle)';
      btnWantExposed.style.background = 'var(--bg-card)';
    }

    // Manual transition button availability
    btnBeginTransition.disabled = !vm.isBeginTransitionEnabled;
    btnBeginTransition.style.opacity = vm.isBeginTransitionEnabled ? '1' : '0.4';
    btnBeginTransition.style.cursor = vm.isBeginTransitionEnabled ? 'pointer' : 'not-allowed';

    btnCompleteTransition.disabled = !vm.isCompleteTransitionEnabled;
    btnCompleteTransition.style.opacity = vm.isCompleteTransitionEnabled ? '1' : '0.4';
    btnCompleteTransition.style.cursor = vm.isCompleteTransitionEnabled ? 'pointer' : 'not-allowed';
  }

  const controller = createPostureDemoController(activeSession, render);

  btnWantCover.addEventListener('click', () => { controller.wantCover(); });
  btnWantExposed.addEventListener('click', () => { controller.wantExposed(); });
  btnBeginTransition.addEventListener('click', () => { controller.beginTransition(); });
  btnCompleteTransition.addEventListener('click', () => { controller.completeTransition(); });

  // Initial render using pure controller projection
  render(controller.getViewModel());

  return {
    unmount(): void {
      btnWantCover.replaceWith(btnWantCover.cloneNode(true));
      btnWantExposed.replaceWith(btnWantExposed.cloneNode(true));
      btnBeginTransition.replaceWith(btnBeginTransition.cloneNode(true));
      btnCompleteTransition.replaceWith(btnCompleteTransition.cloneNode(true));
      container.innerHTML = '';
    },
    getController(): PostureDemoController {
      return controller;
    },
  };
}

// ============================================================================
// Compatibility & Auto-Mount Boundary
// ============================================================================

/**
 * Initializes and mounts the presentation shell into a container element.
 * Preserves backward compatibility with existing bootstrap signature.
 *
 * @param containerId The DOM element id to mount into.
 * @returns true if mounted successfully; false if container not found.
 */
export function initializePresentationShell(containerId: string): boolean {
  if (typeof document === 'undefined') {
    return false;
  }
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn(`[TENNE Presentation] Mount container #${containerId} not found.`);
    return false;
  }
  mountPostureDemo(container);
  return true;
}

// Auto-initialize when loaded on /play/ in a browser environment
if (typeof document !== 'undefined') {
  initializePresentationShell('game-container');
}
