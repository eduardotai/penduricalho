export type Vec2 = { x: number; y: number };

export type Rarity = "common" | "rare" | "epic" | "legendary";

export interface Stats {
  totalMomentum: number;
  totalSwings: number;
  totalHits: number;
  bestCombo: number;
}

export type StatKey = keyof Stats;

export interface UnlockGate {
  stat: StatKey;
  gte: number;
}

export interface PendulumDef {
  id: string;
  name: string;
  description: string;
  weight: number;
  bobCount: number;
  bobSpacing: number;
  maxAngularVelocity: number;
  basePointMultiplier: number;
  rarity: Rarity;
  cost: number;
  unlock?: UnlockGate;
}

export type AttachmentType = "rope" | "rod" | "chain" | "elastic";

export interface AttachmentBonuses {
  momentumMult?: number;
  twistPowerBonus?: number;
  velocityBonus?: number;
}

export interface AttachmentDef {
  id: string;
  name: string;
  description: string;
  type: AttachmentType;
  length: number;
  stiffness: number;
  damping: number;
  bonuses: AttachmentBonuses;
  cost: number;
  unlock?: UnlockGate;
}

export interface SiteDef {
  id: string;
  name: string;
  description: string;
  gravity: number;
  ambient?: Vec2;
  hitZoneCount: number;
  hitZoneRadius: [number, number];
  background: string;
  cost: number;
  unlock?: UnlockGate;
}

export interface HitZone {
  id: string;
  position: Vec2;
  radius: number;
  basePoints: number;
  multiplier: number;
  modifierChance: number;
}

export interface ActiveModifier {
  defId: string;
  expiresAt: number;
}

export interface ModifierEffects {
  twistPowerMult?: number;
  pointMult?: number;
  accelerationMult?: number;
  weightMult?: number;
}

export interface ModifierDef {
  id: string;
  name: string;
  description: string;
  color: string;
  durationMs: number;
  effects: ModifierEffects;
}

export interface ManeuverDef {
  id: string;
  name: string;
  bonus: number;
  description: string;
}

export type ItemKind = "pendulum" | "attachment" | "site";
