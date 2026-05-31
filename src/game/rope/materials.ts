import type { AttachmentDef, AttachmentType } from "../../types";

export interface RopeMaterialProfile {
  segmentSpacing: number;
  nodeRadius: number;
  nodeMassRatio: number;
  stiffness: number;
  damping: number;
  maxStretchRatio: number;
  nonlinearGain: number;
  frictionAir: number;
  loadRating: number;
  /**
   * Active-swing seconds for durability to drain 100%->0% at the material's
   * load rating. Higher = tougher. Drain scales with bobWeight / loadRating,
   * so stronger ropes carry heavy bobs longer. Fragile ropes are
   * tuned below a typical self-stall time so they reliably snap mid-run;
   * tough ropes outlast the swing and only snap on long / golden-extended runs.
   */
  durabilitySeconds: number;
}

const BASE: Record<AttachmentType, RopeMaterialProfile> = {
  rope: {
    segmentSpacing: 28,
    nodeRadius: 3.5,
    nodeMassRatio: 0.04,
    stiffness: 0.88,
    damping: 0.025,
    maxStretchRatio: 1.06,
    nonlinearGain: 0,
    frictionAir: 0.012,
    loadRating: 2.2,
    durabilitySeconds: 14,
  },
  rod: {
    segmentSpacing: 100,
    nodeRadius: 4,
    nodeMassRatio: 0.12,
    stiffness: 1,
    damping: 0.004,
    maxStretchRatio: 1.002,
    nonlinearGain: 0,
    frictionAir: 0.004,
    loadRating: 8,
    durabilitySeconds: 70,
  },
  chain: {
    segmentSpacing: 36,
    nodeRadius: 5,
    nodeMassRatio: 0.14,
    stiffness: 0.82,
    damping: 0.04,
    maxStretchRatio: 1.02,
    nonlinearGain: 0,
    frictionAir: 0.018,
    loadRating: 6,
    durabilitySeconds: 22,
  },
  elastic: {
    segmentSpacing: 22,
    nodeRadius: 3,
    nodeMassRatio: 0.03,
    stiffness: 0.58,
    damping: 0.05,
    maxStretchRatio: 1.35,
    nonlinearGain: 2.4,
    frictionAir: 0.01,
    loadRating: 3,
    durabilitySeconds: 13,
  },
};

// durabilitySeconds and loadRating form the material ladder. The three cheap
// short ropes (micro/short/compact) are intentionally fragile snap-finale
// sidegrades; the real power ladder climbs so late-game ropes can carry
// late-game bobs for longer live swings.
const BY_ID: Partial<Record<string, Partial<RopeMaterialProfile>>> = {
  "micro-twine": { segmentSpacing: 22, stiffness: 0.9, damping: 0.03, maxStretchRatio: 1.07, loadRating: 1.2, durabilitySeconds: 7 },
  "short-hemp": { segmentSpacing: 24, stiffness: 0.89, damping: 0.028, loadRating: 1.6, durabilitySeconds: 9 },
  "compact-rope": { segmentSpacing: 26, stiffness: 0.88, damping: 0.026, loadRating: 2, durabilitySeconds: 11 },
  // hemp-rope (the default) intentionally has no override → base rope: 14.
  "steel-rope": { stiffness: 0.95, damping: 0.018, maxStretchRatio: 1.02, loadRating: 4.5, durabilitySeconds: 18 },
  "braided-rope": { stiffness: 0.86, damping: 0.022, maxStretchRatio: 1.05, loadRating: 5, durabilitySeconds: 20 },
  "tow-rope": { segmentSpacing: 30, nodeMassRatio: 0.06, stiffness: 0.84, damping: 0.024, loadRating: 6, durabilitySeconds: 24 },
  "titan-cable": { stiffness: 0.94, damping: 0.012, maxStretchRatio: 1.015, loadRating: 9, durabilitySeconds: 32 },
  "magnetic-tether": { stiffness: 0.9, damping: 0.008, maxStretchRatio: 1.04, loadRating: 10, durabilitySeconds: 38 },
  "heavy-chain": { nodeMassRatio: 0.22, damping: 0.05, loadRating: 7.5, durabilitySeconds: 22 },
  // --- behavior ropes (see data/attachments.ts) ---
  // flux: a mid-tier base — its drain is then churned up and down by the Random
  // Rope behavior, so the effective lifespan swings around this number.
  "flux-cord": { stiffness: 0.88, damping: 0.024, maxStretchRatio: 1.1, loadRating: 3.5, durabilitySeconds: 15 },
  // metronome (Pendulum Line): rigid rod — no rope segments; length oscillation is
  // driven by the metronome behavior, not stretchy links.
  "pendulum-line": {
    segmentSpacing: 9999,
    stiffness: 1,
    damping: 0.004,
    maxStretchRatio: 1.001,
    loadRating: 5,
    durabilitySeconds: 17,
  },
  // belt (legacy): conveyor payout/stress system (retired for the modern Mechanic Belt).
  "mechanic-belt": { segmentSpacing: 18, stiffness: 0.93, damping: 0.03, maxStretchRatio: 1.05, loadRating: 3, durabilitySeconds: 8 },
  // bulwark: stout, low-stretch weave — the hardening "wall" wants a stiff line.
  "bulwark-weave": { segmentSpacing: 30, stiffness: 0.9, damping: 0.022, maxStretchRatio: 1.03, loadRating: 6, durabilitySeconds: 20 },
};

export function resolveRopeMaterial(attachment: AttachmentDef): RopeMaterialProfile {
  const base = { ...BASE[attachment.type] };
  const patch = BY_ID[attachment.id];
  const merged = patch ? { ...base, ...patch } : base;
  return {
    ...merged,
    stiffness: attachment.stiffness ?? merged.stiffness,
    damping: attachment.damping ?? merged.damping,
  };
}

/** Starter bob weight kept for compatibility with older tuning docs. */
export const DURABILITY_REFERENCE_WEIGHT = 2.2;

/**
 * Durability lost per second of live swing, as a 0..1 fraction. A heavier bob
 * wears the rope proportionally faster relative to the material's load rating.
 */
export function durabilityDrainPerSec(
  profile: RopeMaterialProfile,
  bobWeight: number
): number {
  const seconds = Math.max(0.5, profile.durabilitySeconds);
  const ratedWeight = Math.max(0.1, profile.loadRating);
  return Math.max(0.1, bobWeight) / ratedWeight / seconds;
}

export function ropeSegmentCount(
  length: number,
  profile: RopeMaterialProfile,
  extraLinks: number = 0
): number {
  const base = Math.round(length / profile.segmentSpacing);
  // Twin/triple rigs get extra nodes so whip travels through each chain link.
  const linkBonus = extraLinks > 0 ? extraLinks * 3 : 0;
  const maxSegs = extraLinks > 0 ? 36 : 24;
  return Math.max(3, Math.min(maxSegs, base + linkBonus));
}
