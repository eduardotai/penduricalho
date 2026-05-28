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
  },
};

const BY_ID: Partial<Record<string, Partial<RopeMaterialProfile>>> = {
  "micro-twine": { segmentSpacing: 22, stiffness: 0.9, damping: 0.03, maxStretchRatio: 1.07 },
  "short-hemp": { segmentSpacing: 24, stiffness: 0.89, damping: 0.028 },
  "compact-rope": { segmentSpacing: 26, stiffness: 0.88, damping: 0.026 },
  "steel-rope": { stiffness: 0.95, damping: 0.018, maxStretchRatio: 1.02 },
  "braided-rope": { stiffness: 0.86, damping: 0.022, maxStretchRatio: 1.05 },
  "tow-rope": { segmentSpacing: 30, nodeMassRatio: 0.06, stiffness: 0.84, damping: 0.024 },
  "titan-cable": { stiffness: 0.94, damping: 0.012, maxStretchRatio: 1.015 },
  "heavy-chain": { nodeMassRatio: 0.22, damping: 0.05 },
  "magnetic-tether": { stiffness: 0.9, damping: 0.008, maxStretchRatio: 1.04 },
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
