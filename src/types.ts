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
  bobRadius: number;
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
  /** Derived from material physics (Hooke's law + damping ratio). */
  stiffness: number;
  /** Derived from material damping ratio ζ. */
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

export interface PersistentBonus {
  defId: string;
  expiresAt: number;
}

export interface ModifierEffects {
  twistPowerMult?: number;
  pointMult?: number;
  accelerationMult?: number;
  weightMult?: number;
  bobSizeMult?: number;
  ropeLengthMult?: number;
  echoCount?: number;
  /** Fractional speed growth per second while active (0.1 = +10%/s). */
  velocityGrowthPerSec?: number;
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

export type BobSkinPattern = "solid" | "striped" | "starfield" | "crystal" | "band";

export interface BobSkinDef {
  id: string;
  name: string;
  description: string;
  color: string;
  highlight: string;
  stroke: string;
  pattern: BobSkinPattern;
  rarity: Rarity;
  cost: number;
  unlock?: UnlockGate;
}

export type BobShapeKind =
  | "circle"
  | "square"
  | "diamond"
  | "star"
  | "hex"
  | "triangle"
  | "heart"
  | "bolt"
  | "flame"
  | "cog"
  | "cross"
  | "moon"
  | "ring";

export interface BobShapeDef {
  id: string;
  name: string;
  description: string;
  shape: BobShapeKind;
  rarity: Rarity;
  cost: number;
  unlock?: UnlockGate;
}

export type ItemKind = "pendulum" | "attachment" | "site" | "skin" | "shape";

export type TokenKind =
  | "bigger-bob"
  | "giant-bob"
  | "tiny-bob"
  | "velocity-surge"
  | "speed-ramp"
  | "long-rope"
  | "short-rope"
  | "multi-bob"
  | "golden";

export interface TokenDef {
  kind: TokenKind;
  name: string;
  description: string;
  color: string;
  weight: number;
  grantsModifierId?: string;
  isGolden?: boolean;
}

export interface TokenInstance {
  id: string;
  kind: TokenKind;
  position: Vec2;
  radius: number;
  spawnedAt: number;
  expiresAt: number;
  driftPhase: number;
  consumed: boolean;
}
