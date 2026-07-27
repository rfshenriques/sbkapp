import { create } from 'zustand';

interface FreebetFlyState {
  active: boolean;
  fromCents: number;
  toCents: number;
  /** DOM id of the header freebets-balance element the icons fly to and RollingBalance replaces while active - see BalancePills' freebetsTargetId prop. */
  targetId: string;
  trigger: (options: { fromCents: number; toCents: number; targetId: string }) => void;
  /** Called by FreebetFlyOverlay once every icon has finished arriving. */
  finish: () => void;
}

/** Drives the "Get my freebets" flourish: FreebetFlyOverlay renders the flying icons, BalancePills swaps in a RollingBalance for the targeted instance while active. */
export const useFreebetFlyStore = create<FreebetFlyState>((set) => ({
  active: false,
  fromCents: 0,
  toCents: 0,
  targetId: '',
  trigger: ({ fromCents, toCents, targetId }) => set({ active: true, fromCents, toCents, targetId }),
  finish: () => set({ active: false }),
}));
