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
  /**
   * Active-swing seconds for durability to drain 100%→0% at the reference bob
   * weight. Higher = tougher. Drain scales with bobWeight / REFERENCE_WEIGHT,
   * so a heavy bob wears the rope proportionally faster. Fragile ropes are
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
    durabilitySeconds: 15,
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
    durabilitySeconds: 90,
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
    durabilitySeconds: 24,
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
    durabilitySeconds: 14,
  },
};

const BY_ID: Partial<Record<string, Partial<RopeMaterialProfile>>> = {
  "micro-twine": { segmentSpacing: 22, stiffness: 0.9, damping: 0.03, maxStretchRatio: 1.07, durabilitySeconds: 9 },
  "short-hemp": { segmentSpacing: 24, stiffness: 0.89, damping: 0.028, durabilitySeconds: 11 },
  "compact-rope": { segmentSpacing: 26, stiffness: 0.88, damping: 0.026, durabilitySeconds: 13 },
  "steel-rope": { stiffness: 0.95, damping: 0.018, maxStretchRatio: 1.02, durabilitySeconds: 34 },
  "braided-rope": { stiffness: 0.86, damping: 0.022, maxStretchRatio: 1.05, durabilitySeconds: 17 },
  "tow-rope": { segmentSpacing: 30, nodeMassRatio: 0.06, stiffness: 0.84, damping: 0.024, durabilitySeconds: 20 },
  "titan-cable": { stiffness: 0.94, damping: 0.012, maxStretchRatio: 1.015, durabilitySeconds: 46 },
  "heavy-chain": { nodeMassRatio: 0.22, damping: 0.05, durabilitySeconds: 24 },
  "magnetic-tether": { stiffness: 0.9, damping: 0.008, maxStretchRatio: 1.04, durabilitySeconds: 40 },
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

/** Bob weight that drains a rope in exactly its `durabilitySeconds`. */
export const DURABILITY_REFERENCE_WEIGHT = 2.2;

/**
 * Durability lost per second of live swing, as a 0..1 fraction. A heavier bob
 * wears the rope proportionally faster; tougher materials wear slower.
 */
export function durabilityDrainPerSec(
  profile: RopeMaterialProfile,
  bobWeight: number
): number {
  const seconds = Math.max(0.5, profile.durabilitySeconds);
  return bobWeight / DURABILITY_REFERENCE_WEIGHT / seconds;
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
