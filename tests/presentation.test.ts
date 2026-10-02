import { describe, it, expect, vi } from 'vitest';
import {
  derivePostureDemoViewModel,
  createPostureDemoController,
  initializePresentationShell,
  MANDATORY_AUTHORITY_DISCLAIMER,
  MANDATORY_TRANSITION_NOTE,
  type PostureDemoViewModel,
} from '../src/game/presentation/index.ts';
import {
  createPostureDemoSession,
  type PostureDemoSnapshot,
} from '../src/game/application/index.ts';
import {
  CharacterPosture,
  SquadPostureIntent,
  getDomainState,
} from '../src/game/domain/index.ts';

describe('Presentation Layer Node Safety & Environmental Boundaries (AS-001, AS-004)', () => {
  it('executes in pure headless Node without browser globals', () => {
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
  });

  it('safely handles initializePresentationShell in Node environment without throwing', () => {
    // Under Node, typeof document === 'undefined', so it returns false gracefully
    const result = initializePresentationShell('game-container');
    expect(result).toBe(false);
  });

  it('preserves getDomainState().gameplayImplemented === false (Presentation owns zero gameplay authority)', () => {
    const domainState = getDomainState();
    expect(domainState.gameplayImplemented).toBe(false);
  });
});

describe('Pure View Model Projection: derivePostureDemoViewModel (AS-002, AS-003)', () => {
  it('projects all stable and transitional character postures accurately', () => {
    const postures = [
      CharacterPosture.COVERED,
      CharacterPosture.EXPOSED,
      CharacterPosture.TRANSITIONING_TO_COVERED,
      CharacterPosture.TRANSITIONING_TO_EXPOSED,
    ];

    for (const posture of postures) {
      const snapshot: PostureDemoSnapshot = {
        posture,
        squadPostureIntent: SquadPostureIntent.WANT_COVERED,
        applicablePostureTransition: null,
        isTransitionInProgress: false,
        postureFiringPrerequisiteSatisfied: false,
      };

      const vm = derivePostureDemoViewModel(snapshot);
      expect(vm.postureLabel).toBe(posture);
    }
  });

  it('projects squad posture intent accurately and computes active intent flags', () => {
    // WANT_COVERED
    const snapshotCovered: PostureDemoSnapshot = {
      posture: CharacterPosture.COVERED,
      squadPostureIntent: SquadPostureIntent.WANT_COVERED,
      applicablePostureTransition: null,
      isTransitionInProgress: false,
      postureFiringPrerequisiteSatisfied: false,
    };
    const vmCovered = derivePostureDemoViewModel(snapshotCovered);
    expect(vmCovered.squadIntentLabel).toBe(SquadPostureIntent.WANT_COVERED);
    expect(vmCovered.isWantCoverActive).toBe(true);
    expect(vmCovered.isWantExposedActive).toBe(false);

    // WANT_EXPOSED
    const snapshotExposed: PostureDemoSnapshot = {
      posture: CharacterPosture.COVERED,
      squadPostureIntent: SquadPostureIntent.WANT_EXPOSED,
      applicablePostureTransition: CharacterPosture.TRANSITIONING_TO_EXPOSED,
      isTransitionInProgress: false,
      postureFiringPrerequisiteSatisfied: false,
    };
    const vmExposed = derivePostureDemoViewModel(snapshotExposed);
    expect(vmExposed.squadIntentLabel).toBe(SquadPostureIntent.WANT_EXPOSED);
    expect(vmExposed.isWantCoverActive).toBe(false);
    expect(vmExposed.isWantExposedActive).toBe(true);
  });

  it('maps applicable transition accurately and formats null as NONE', () => {
    // Null transition -> 'NONE'
    const snapshotNone: PostureDemoSnapshot = {
      posture: CharacterPosture.COVERED,
      squadPostureIntent: SquadPostureIntent.WANT_COVERED,
      applicablePostureTransition: null,
      isTransitionInProgress: false,
      postureFiringPrerequisiteSatisfied: false,
    };
    expect(derivePostureDemoViewModel(snapshotNone).applicableTransitionLabel).toBe('NONE');

    // TRANSITIONING_TO_EXPOSED
    const snapshotToExposed: PostureDemoSnapshot = {
      posture: CharacterPosture.COVERED,
      squadPostureIntent: SquadPostureIntent.WANT_EXPOSED,
      applicablePostureTransition: CharacterPosture.TRANSITIONING_TO_EXPOSED,
      isTransitionInProgress: false,
      postureFiringPrerequisiteSatisfied: false,
    };
    expect(derivePostureDemoViewModel(snapshotToExposed).applicableTransitionLabel).toBe(
      CharacterPosture.TRANSITIONING_TO_EXPOSED
    );

    // TRANSITIONING_TO_COVERED
    const snapshotToCovered: PostureDemoSnapshot = {
      posture: CharacterPosture.EXPOSED,
      squadPostureIntent: SquadPostureIntent.WANT_COVERED,
      applicablePostureTransition: CharacterPosture.TRANSITIONING_TO_COVERED,
      isTransitionInProgress: false,
      postureFiringPrerequisiteSatisfied: true,
    };
    expect(derivePostureDemoViewModel(snapshotToCovered).applicableTransitionLabel).toBe(
      CharacterPosture.TRANSITIONING_TO_COVERED
    );
  });

  it('maps posture firing prerequisite strictly to SATISFIED or NOT SATISFIED', () => {
    const snapshotSatisfied: PostureDemoSnapshot = {
      posture: CharacterPosture.EXPOSED,
      squadPostureIntent: SquadPostureIntent.WANT_EXPOSED,
      applicablePostureTransition: null,
      isTransitionInProgress: false,
      postureFiringPrerequisiteSatisfied: true,
    };
    const vmSatisfied = derivePostureDemoViewModel(snapshotSatisfied);
    expect(vmSatisfied.postureFiringPrerequisiteLabel).toBe('SATISFIED');
    expect(vmSatisfied.isPostureFiringPrerequisiteSatisfied).toBe(true);

    const snapshotNotSatisfied: PostureDemoSnapshot = {
      posture: CharacterPosture.COVERED,
      squadPostureIntent: SquadPostureIntent.WANT_COVERED,
      applicablePostureTransition: null,
      isTransitionInProgress: false,
      postureFiringPrerequisiteSatisfied: false,
    };
    const vmNotSatisfied = derivePostureDemoViewModel(snapshotNotSatisfied);
    expect(vmNotSatisfied.postureFiringPrerequisiteLabel).toBe('NOT SATISFIED');
    expect(vmNotSatisfied.isPostureFiringPrerequisiteSatisfied).toBe(false);
  });

  it('derives button availability strictly from snapshot facts', () => {
    // Begin enabled iff applicablePostureTransition !== null
    const snapshotBeginEnabled: PostureDemoSnapshot = {
      posture: CharacterPosture.COVERED,
      squadPostureIntent: SquadPostureIntent.WANT_EXPOSED,
      applicablePostureTransition: CharacterPosture.TRANSITIONING_TO_EXPOSED,
      isTransitionInProgress: false,
      postureFiringPrerequisiteSatisfied: false,
    };
    expect(derivePostureDemoViewModel(snapshotBeginEnabled).isBeginTransitionEnabled).toBe(true);

    const snapshotBeginDisabled: PostureDemoSnapshot = {
      posture: CharacterPosture.COVERED,
      squadPostureIntent: SquadPostureIntent.WANT_COVERED,
      applicablePostureTransition: null,
      isTransitionInProgress: false,
      postureFiringPrerequisiteSatisfied: false,
    };
    expect(derivePostureDemoViewModel(snapshotBeginDisabled).isBeginTransitionEnabled).toBe(false);

    // Complete enabled iff isTransitionInProgress === true
    const snapshotCompleteEnabled: PostureDemoSnapshot = {
      posture: CharacterPosture.TRANSITIONING_TO_EXPOSED,
      squadPostureIntent: SquadPostureIntent.WANT_EXPOSED,
      applicablePostureTransition: null,
      isTransitionInProgress: true,
      postureFiringPrerequisiteSatisfied: false,
    };
    expect(derivePostureDemoViewModel(snapshotCompleteEnabled).isCompleteTransitionEnabled).toBe(true);

    const snapshotCompleteDisabled: PostureDemoSnapshot = {
      posture: CharacterPosture.EXPOSED,
      squadPostureIntent: SquadPostureIntent.WANT_EXPOSED,
      applicablePostureTransition: null,
      isTransitionInProgress: false,
      postureFiringPrerequisiteSatisfied: true,
    };
    expect(derivePostureDemoViewModel(snapshotCompleteDisabled).isCompleteTransitionEnabled).toBe(false);
  });

  it('enforces mandatory authority disclaimers and avoids global firing/actionability claims', () => {
    const session = createPostureDemoSession();
    const vm = derivePostureDemoViewModel(session.getSnapshot());

    expect(vm.authorityDisclaimer).toBe(MANDATORY_AUTHORITY_DISCLAIMER);
    expect(vm.authorityDisclaimer).toContain(
      'Posture check only — this does not mean global firing permission.'
    );

    expect(vm.manualTransitionNote).toBe(MANDATORY_TRANSITION_NOTE);
    expect(vm.manualTransitionNote).toContain(
      'Manual transition controls are demo controls. No transition duration is currently modeled.'
    );

    // Forbidden vocabulary assertions
    const vmString = JSON.stringify(vm);
    expect(vmString).not.toContain('Ready to Fire');
    expect(vmString).not.toContain('Combat Ready');
    expect(vmString).not.toContain('Globally Actionable');
    expect(vmString).not.toContain('canFire');
  });
});

describe('Presentation Controller & Action Dispatch Flow (Snapshot Refresh Rule)', () => {
  it('executes Snapshot Refresh Rule: every controller command refreshes snapshot and derives view model inline', () => {
    const session = createPostureDemoSession(CharacterPosture.COVERED, SquadPostureIntent.WANT_COVERED);
    const getSnapshotSpy = vi.spyOn(session, 'getSnapshot');
    const refreshedViewModels: PostureDemoViewModel[] = [];

    const controller = createPostureDemoController(session, (vm) => {
      refreshedViewModels.push(vm);
    });

    expect(getSnapshotSpy).toHaveBeenCalledTimes(0);
    expect(refreshedViewModels).toHaveLength(0);

    // 1. wantExposed command path: rereads snapshot inline, derives view model, calls listener
    const returnedVmExposed = controller.wantExposed();
    expect(getSnapshotSpy).toHaveBeenCalledTimes(1);
    expect(refreshedViewModels).toHaveLength(1);
    expect(refreshedViewModels[0].squadIntentLabel).toBe(SquadPostureIntent.WANT_EXPOSED);
    expect(refreshedViewModels[0].isBeginTransitionEnabled).toBe(true);
    expect(returnedVmExposed).toBe(refreshedViewModels[0]);

    // 2. beginTransition command path: preserves boolean outcome AND rereads snapshot inline
    const beginOutcome = controller.beginTransition();
    expect(beginOutcome).toBe(true);
    expect(getSnapshotSpy).toHaveBeenCalledTimes(2);
    expect(refreshedViewModels).toHaveLength(2);
    expect(refreshedViewModels[1].postureLabel).toBe(CharacterPosture.TRANSITIONING_TO_EXPOSED);
    expect(refreshedViewModels[1].isCompleteTransitionEnabled).toBe(true);

    // 3. completeTransition command path: preserves boolean outcome AND rereads snapshot inline
    const completeOutcome = controller.completeTransition();
    expect(completeOutcome).toBe(true);
    expect(getSnapshotSpy).toHaveBeenCalledTimes(3);
    expect(refreshedViewModels).toHaveLength(3);
    expect(refreshedViewModels[2].postureLabel).toBe(CharacterPosture.EXPOSED);
    expect(refreshedViewModels[2].postureFiringPrerequisiteLabel).toBe('SATISFIED');

    // 4. wantCover command path: rereads snapshot inline, derives view model, calls listener
    const returnedVmCover = controller.wantCover();
    expect(getSnapshotSpy).toHaveBeenCalledTimes(4);
    expect(refreshedViewModels).toHaveLength(4);
    expect(refreshedViewModels[3].squadIntentLabel).toBe(SquadPostureIntent.WANT_COVERED);
    expect(refreshedViewModels[3].applicableTransitionLabel).toBe(CharacterPosture.TRANSITIONING_TO_COVERED);
    expect(returnedVmCover).toBe(refreshedViewModels[3]);
  });

  it('preserves Application boolean outcome semantics on invalid transitions while refreshing view model', () => {
    const session = createPostureDemoSession(CharacterPosture.COVERED, SquadPostureIntent.WANT_COVERED);
    let latestVm: PostureDemoViewModel | null = null;
    const controller = createPostureDemoController(session, (vm) => {
      latestVm = vm;
    });

    // beginTransition when no transition is applicable returns false
    const beginResult = controller.beginTransition();
    expect(beginResult).toBe(false);
    expect(latestVm?.postureLabel).toBe(CharacterPosture.COVERED);
    expect(latestVm?.isBeginTransitionEnabled).toBe(false);

    // completeTransition when already in stable posture returns false
    const completeResult = controller.completeTransition();
    expect(completeResult).toBe(false);
    expect(latestVm?.postureLabel).toBe(CharacterPosture.COVERED);
    expect(latestVm?.isCompleteTransitionEnabled).toBe(false);
  });
});

describe('Full Walkthrough Progression: Forward and Reverse Sequences', () => {
  it('executes full forward sequence: COVERED -> EXPOSED driving UI solely via command path', () => {
    const session = createPostureDemoSession(CharacterPosture.COVERED, SquadPostureIntent.WANT_COVERED);
    let currentVm: PostureDemoViewModel = derivePostureDemoViewModel(session.getSnapshot());

    const controller = createPostureDemoController(session, (vm) => {
      currentVm = vm;
    });

    // Step 0: Initial State
    expect(currentVm.postureLabel).toBe(CharacterPosture.COVERED);
    expect(currentVm.squadIntentLabel).toBe(SquadPostureIntent.WANT_COVERED);
    expect(currentVm.applicableTransitionLabel).toBe('NONE');
    expect(currentVm.isTransitionInProgress).toBe(false);
    expect(currentVm.postureFiringPrerequisiteLabel).toBe('NOT SATISFIED');
    expect(currentVm.isBeginTransitionEnabled).toBe(false);
    expect(currentVm.isCompleteTransitionEnabled).toBe(false);

    // Step 1: Want Exposed (command directly updates currentVm via command path)
    controller.wantExposed();
    expect(currentVm.postureLabel).toBe(CharacterPosture.COVERED);
    expect(currentVm.squadIntentLabel).toBe(SquadPostureIntent.WANT_EXPOSED);
    expect(currentVm.applicableTransitionLabel).toBe(CharacterPosture.TRANSITIONING_TO_EXPOSED);
    expect(currentVm.isTransitionInProgress).toBe(false);
    expect(currentVm.postureFiringPrerequisiteLabel).toBe('NOT SATISFIED');
    expect(currentVm.isBeginTransitionEnabled).toBe(true);
    expect(currentVm.isCompleteTransitionEnabled).toBe(false);

    // Step 2: Begin Transition
    expect(controller.beginTransition()).toBe(true);
    expect(currentVm.postureLabel).toBe(CharacterPosture.TRANSITIONING_TO_EXPOSED);
    expect(currentVm.squadIntentLabel).toBe(SquadPostureIntent.WANT_EXPOSED);
    expect(currentVm.applicableTransitionLabel).toBe('NONE');
    expect(currentVm.isTransitionInProgress).toBe(true);
    expect(currentVm.postureFiringPrerequisiteLabel).toBe('NOT SATISFIED');
    expect(currentVm.isBeginTransitionEnabled).toBe(false);
    expect(currentVm.isCompleteTransitionEnabled).toBe(true);

    // Step 3: Complete Transition
    expect(controller.completeTransition()).toBe(true);
    expect(currentVm.postureLabel).toBe(CharacterPosture.EXPOSED);
    expect(currentVm.squadIntentLabel).toBe(SquadPostureIntent.WANT_EXPOSED);
    expect(currentVm.applicableTransitionLabel).toBe('NONE');
    expect(currentVm.isTransitionInProgress).toBe(false);
    expect(currentVm.postureFiringPrerequisiteLabel).toBe('SATISFIED');
    expect(currentVm.isBeginTransitionEnabled).toBe(false);
    expect(currentVm.isCompleteTransitionEnabled).toBe(false);
  });

  it('executes full reverse sequence: EXPOSED -> COVERED driving UI solely via command path', () => {
    const session = createPostureDemoSession(CharacterPosture.EXPOSED, SquadPostureIntent.WANT_EXPOSED);
    let currentVm: PostureDemoViewModel = derivePostureDemoViewModel(session.getSnapshot());

    const controller = createPostureDemoController(session, (vm) => {
      currentVm = vm;
    });

    // Step 0: Starting Exposed
    expect(currentVm.postureLabel).toBe(CharacterPosture.EXPOSED);
    expect(currentVm.squadIntentLabel).toBe(SquadPostureIntent.WANT_EXPOSED);
    expect(currentVm.applicableTransitionLabel).toBe('NONE');
    expect(currentVm.isTransitionInProgress).toBe(false);
    expect(currentVm.postureFiringPrerequisiteLabel).toBe('SATISFIED');
    expect(currentVm.isBeginTransitionEnabled).toBe(false);
    expect(currentVm.isCompleteTransitionEnabled).toBe(false);

    // Step 1: Want Cover
    controller.wantCover();
    expect(currentVm.postureLabel).toBe(CharacterPosture.EXPOSED);
    expect(currentVm.squadIntentLabel).toBe(SquadPostureIntent.WANT_COVERED);
    expect(currentVm.applicableTransitionLabel).toBe(CharacterPosture.TRANSITIONING_TO_COVERED);
    expect(currentVm.isTransitionInProgress).toBe(false);
    expect(currentVm.postureFiringPrerequisiteLabel).toBe('SATISFIED');
    expect(currentVm.isBeginTransitionEnabled).toBe(true);
    expect(currentVm.isCompleteTransitionEnabled).toBe(false);

    // Step 2: Begin Transition
    expect(controller.beginTransition()).toBe(true);
    expect(currentVm.postureLabel).toBe(CharacterPosture.TRANSITIONING_TO_COVERED);
    expect(currentVm.squadIntentLabel).toBe(SquadPostureIntent.WANT_COVERED);
    expect(currentVm.applicableTransitionLabel).toBe('NONE');
    expect(currentVm.isTransitionInProgress).toBe(true);
    expect(currentVm.postureFiringPrerequisiteLabel).toBe('NOT SATISFIED');
    expect(currentVm.isBeginTransitionEnabled).toBe(false);
    expect(currentVm.isCompleteTransitionEnabled).toBe(true);

    // Step 3: Complete Transition
    expect(controller.completeTransition()).toBe(true);
    expect(currentVm.postureLabel).toBe(CharacterPosture.COVERED);
    expect(currentVm.squadIntentLabel).toBe(SquadPostureIntent.WANT_COVERED);
    expect(currentVm.applicableTransitionLabel).toBe('NONE');
    expect(currentVm.isTransitionInProgress).toBe(false);
    expect(currentVm.postureFiringPrerequisiteLabel).toBe('NOT SATISFIED');
    expect(currentVm.isBeginTransitionEnabled).toBe(false);
    expect(currentVm.isCompleteTransitionEnabled).toBe(false);
  });

  it('preserves transition atomicity and prevents auto-chaining across mid-transition intent updates', () => {
    // Start COVERED, intent WANT_EXPOSED, and begin transition
    const session = createPostureDemoSession(CharacterPosture.COVERED, SquadPostureIntent.WANT_EXPOSED);
    let currentVm: PostureDemoViewModel = derivePostureDemoViewModel(session.getSnapshot());

    const controller = createPostureDemoController(session, (vm) => {
      currentVm = vm;
    });

    controller.beginTransition();
    expect(currentVm.postureLabel).toBe(CharacterPosture.TRANSITIONING_TO_EXPOSED);

    // User changes intent mid-transition to WANT_COVERED
    controller.wantCover();

    // Posture remains TRANSITIONING_TO_EXPOSED (atomic, not cancelled or reversed)
    expect(currentVm.postureLabel).toBe(CharacterPosture.TRANSITIONING_TO_EXPOSED);
    expect(currentVm.squadIntentLabel).toBe(SquadPostureIntent.WANT_COVERED);
    expect(currentVm.isTransitionInProgress).toBe(true);
    expect(currentVm.isBeginTransitionEnabled).toBe(false);
    expect(currentVm.isCompleteTransitionEnabled).toBe(true);

    // Complete transition: arrives at destination posture EXPOSED
    expect(controller.completeTransition()).toBe(true);

    // Destination is EXPOSED, not automatically chained to TRANSITIONING_TO_COVERED
    expect(currentVm.postureLabel).toBe(CharacterPosture.EXPOSED);
    expect(currentVm.squadIntentLabel).toBe(SquadPostureIntent.WANT_COVERED);
    expect(currentVm.isTransitionInProgress).toBe(false);
    expect(currentVm.applicableTransitionLabel).toBe(CharacterPosture.TRANSITIONING_TO_COVERED);
    expect(currentVm.isBeginTransitionEnabled).toBe(true); // Now enabled for explicit next click
    expect(currentVm.isCompleteTransitionEnabled).toBe(false);

    // Subsequent transition requires explicit user command
    expect(controller.beginTransition()).toBe(true);
    expect(currentVm.postureLabel).toBe(CharacterPosture.TRANSITIONING_TO_COVERED);
    expect(currentVm.isTransitionInProgress).toBe(true);
  });
});
