import { describe, it, expect, vi } from 'vitest';
import { CharacterPosture, WeaponAction } from '../src/game/domain/index.ts';
import {
  deriveCombatPrototypeViewModel,
  createCombatPrototypeController,
  type CombatPrototypeSnapshotInput,
  type CombatPrototypeSessionPort,
  type CombatPrototypeViewModel,
} from '../src/game/presentation/combat-prototype.ts';

function createMockSession(initialAmmo = 3): {
  session: CombatPrototypeSessionPort;
  spies: {
    getSnapshot: ReturnType<typeof vi.fn>;
    resolveSingleFiring: ReturnType<typeof vi.fn>;
    resetPrototype: ReturnType<typeof vi.fn>;
  };
} {
  let state: CombatPrototypeSnapshotInput = {
    posture: CharacterPosture.EXPOSED,
    weaponAction: WeaponAction.FIRING,
    magazineAmmo: initialAmmo,
    isFiringResolutionAvailable: initialAmmo > 0,
  };

  const getSnapshot = vi.fn((): CombatPrototypeSnapshotInput => Object.freeze({ ...state }));

  const resolveSingleFiring = vi.fn((): boolean => {
    if (!state.isFiringResolutionAvailable || state.magazineAmmo <= 0) {
      return false;
    }
    const nextAmmo = state.magazineAmmo - 1;
    if (nextAmmo === 0) {
      state = {
        posture: CharacterPosture.TRANSITIONING_TO_COVERED,
        weaponAction: WeaponAction.IDLE,
        magazineAmmo: 0,
        isFiringResolutionAvailable: false,
      };
    } else {
      state = {
        posture: CharacterPosture.EXPOSED,
        weaponAction: WeaponAction.FIRING,
        magazineAmmo: nextAmmo,
        isFiringResolutionAvailable: true,
      };
    }
    return true;
  });

  const resetPrototype = vi.fn((): void => {
    state = {
      posture: CharacterPosture.EXPOSED,
      weaponAction: WeaponAction.FIRING,
      magazineAmmo: initialAmmo,
      isFiringResolutionAvailable: initialAmmo > 0,
    };
  });

  return {
    session: {
      getSnapshot,
      resolveSingleFiring,
      resetPrototype,
    },
    spies: {
      getSnapshot,
      resolveSingleFiring,
      resetPrototype,
    },
  };
}

describe('T-032: Combat Prototype Presentation View-Model & Controller', () => {
  describe('deriveCombatPrototypeViewModel', () => {
    it('projects EXPOSED + FIRING + ammo > 0 into active firing view-model', () => {
      const snapshot: CombatPrototypeSnapshotInput = {
        posture: CharacterPosture.EXPOSED,
        weaponAction: WeaponAction.FIRING,
        magazineAmmo: 3,
        isFiringResolutionAvailable: true,
      };

      const vm = deriveCombatPrototypeViewModel(snapshot);

      expect(Object.isFrozen(vm)).toBe(true);
      expect(vm.postureLabel).toBe(CharacterPosture.EXPOSED);
      expect(vm.weaponActionLabel).toBe(WeaponAction.FIRING);
      expect(vm.magazineAmmoCount).toBe(3);
      expect(vm.isFireButtonEnabled).toBe(true);
      expect(vm.isDepletedAutoCoverActive).toBe(false);
      expect(vm.stagePostureClass).toBe('stage-exposed');
      expect(vm.statusHeadline).toBe('EXPOSED — FIRING');
      expect(vm.authorityNote.length).toBeGreaterThan(0);
    });

    it('projects TRANSITIONING_TO_COVERED + IDLE + ammo === 0 into depleted auto-cover view-model', () => {
      const snapshot: CombatPrototypeSnapshotInput = {
        posture: CharacterPosture.TRANSITIONING_TO_COVERED,
        weaponAction: WeaponAction.IDLE,
        magazineAmmo: 0,
        isFiringResolutionAvailable: false,
      };

      const vm = deriveCombatPrototypeViewModel(snapshot);

      expect(Object.isFrozen(vm)).toBe(true);
      expect(vm.postureLabel).toBe(CharacterPosture.TRANSITIONING_TO_COVERED);
      expect(vm.weaponActionLabel).toBe(WeaponAction.IDLE);
      expect(vm.magazineAmmoCount).toBe(0);
      expect(vm.isFireButtonEnabled).toBe(false);
      expect(vm.isDepletedAutoCoverActive).toBe(true);
      expect(vm.stagePostureClass).toBe('stage-transitioning-cover');
      expect(vm.statusHeadline).toBe('MAGAZINE DEPLETED — MOVING TO COVER');
    });

    it('maps COVERED and TRANSITIONING_TO_EXPOSED to their respective stage posture classes', () => {
      const coveredVm = deriveCombatPrototypeViewModel({
        posture: CharacterPosture.COVERED,
        weaponAction: WeaponAction.IDLE,
        magazineAmmo: 0,
        isFiringResolutionAvailable: false,
      });
      expect(coveredVm.stagePostureClass).toBe('stage-covered');
      expect(coveredVm.isDepletedAutoCoverActive).toBe(false);

      const transExposedVm = deriveCombatPrototypeViewModel({
        posture: CharacterPosture.TRANSITIONING_TO_EXPOSED,
        weaponAction: WeaponAction.IDLE,
        magazineAmmo: 2,
        isFiringResolutionAvailable: false,
      });
      expect(transExposedVm.stagePostureClass).toBe('stage-transitioning-exposed');
      expect(transExposedVm.isDepletedAutoCoverActive).toBe(false);
    });
  });

  describe('createCombatPrototypeController (Snapshot Refresh Rule)', () => {
    it('rereads snapshot and notifies onRefresh on every fireRound() and resetDemo() call', () => {
      const { session, spies } = createMockSession(3);
      const refreshed: CombatPrototypeViewModel[] = [];
      const controller = createCombatPrototypeController(session, (vm) => {
        refreshed.push(vm);
      });

      const initial = controller.getViewModel();
      expect(initial.magazineAmmoCount).toBe(3);
      expect(initial.isFireButtonEnabled).toBe(true);

      // Fire rounds 3 -> 2 -> 1 -> 0
      expect(controller.fireRound()).toBe(true);
      expect(refreshed[refreshed.length - 1]?.magazineAmmoCount).toBe(2);
      expect(refreshed[refreshed.length - 1]?.isDepletedAutoCoverActive).toBe(false);

      expect(controller.fireRound()).toBe(true);
      expect(refreshed[refreshed.length - 1]?.magazineAmmoCount).toBe(1);
      expect(refreshed[refreshed.length - 1]?.isDepletedAutoCoverActive).toBe(false);

      expect(controller.fireRound()).toBe(true);
      const depletedVm = refreshed[refreshed.length - 1]!;
      expect(depletedVm.magazineAmmoCount).toBe(0);
      expect(depletedVm.postureLabel).toBe(CharacterPosture.TRANSITIONING_TO_COVERED);
      expect(depletedVm.weaponActionLabel).toBe(WeaponAction.IDLE);
      expect(depletedVm.isFireButtonEnabled).toBe(false);
      expect(depletedVm.isDepletedAutoCoverActive).toBe(true);

      // Subsequent fireRound returns false and still refreshes from snapshot
      expect(controller.fireRound()).toBe(false);
      expect(refreshed).toHaveLength(4);
      expect(spies.resolveSingleFiring).toHaveBeenCalledTimes(4);

      // Reset restores initial state and notifies onRefresh
      const resetVm = controller.resetDemo();
      expect(spies.resetPrototype).toHaveBeenCalledTimes(1);
      expect(resetVm.magazineAmmoCount).toBe(3);
      expect(resetVm.postureLabel).toBe(CharacterPosture.EXPOSED);
      expect(resetVm.weaponActionLabel).toBe(WeaponAction.FIRING);
      expect(resetVm.isFireButtonEnabled).toBe(true);
      expect(resetVm.isDepletedAutoCoverActive).toBe(false);
      expect(refreshed).toHaveLength(5);
      expect(spies.getSnapshot).toHaveBeenCalledTimes(6); // 1 initial + 4 fire + 1 reset
    });
  });

  describe('Authority Vocabulary & Node-Safety', () => {
    it('omits forbidden vocabulary (canFire, Ready to Fire) from view-model text', () => {
      const activeVm = deriveCombatPrototypeViewModel({
        posture: CharacterPosture.EXPOSED,
        weaponAction: WeaponAction.FIRING,
        magazineAmmo: 3,
        isFiringResolutionAvailable: true,
      });
      const depletedVm = deriveCombatPrototypeViewModel({
        posture: CharacterPosture.TRANSITIONING_TO_COVERED,
        weaponAction: WeaponAction.IDLE,
        magazineAmmo: 0,
        isFiringResolutionAvailable: false,
      });

      const allText = [
        activeVm.postureLabel,
        activeVm.weaponActionLabel,
        activeVm.statusHeadline,
        activeVm.authorityNote,
        depletedVm.postureLabel,
        depletedVm.weaponActionLabel,
        depletedVm.statusHeadline,
        depletedVm.authorityNote,
      ].join(' | ');

      expect(allText).not.toContain('canFire');
      expect(allText).not.toContain('Ready to Fire');
    });

    it('is 100% Node-safe to import without a browser document', () => {
      expect(typeof document).toBe('undefined');
    });
  });
});
