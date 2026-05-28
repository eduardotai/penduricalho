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
  "steel-rope": { stiffness: 0.95, damping: 0.018, maxStretchRatio: 1.02 },
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

export function ropeSegmentCount(length: number, profile: RopeMaterialProfile): number {
  return Math.max(3, Math.min(24, Math.round(length / profile.segmentSpacing)));
}
