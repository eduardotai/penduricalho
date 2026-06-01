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

/**
 * Special gameplay behaviors a bob can carry. Most bobs have none (they're
 * pure stat lines); a bob with a `behavior` gets special-cased at a handful of
 * hook points in the game loop (snap finale, durability drain, zone scoring,
 * echo bobs, per-frame steering). One behavior per bob.
 *   "hunter"  — Ravager: freed bobs home onto live multiplier circles after a
 *               snap, devouring as many as they can (the "Pac-Man").
 *   "piercer" — Arrow: periodic straight-line dash that spears through a row
 *               of circles instead of only clipping along the arc.
 *   "hydra"   — Mutant: permanently grows an extra scoring echo "head" on each
 *               combo milestone, snowballing coverage across a run.
 *   "nitro"   — Glass cannon: huge points/reach but the rope drains far faster,
 *               so it snaps early — built around the snap finale.
 *   "magnet"  — Lodestone: passively drags nearby circles (and loose tokens)
 *               toward the bob's swing arc.
 *   "frenzy"  — Berserker: swing speed and bob size scale up with the live
 *               combo, then snap back to baseline when the combo drops.
 *   "teleport"— TP: blinks to random spots; the rope reels it back to within
 *               its reach, so shorter ropes yank it back harder than long ones.
 *   "rocket"  — Rocket: no launch kick — it builds speed under continuous
 *               thrust (stacking hard with Speed Ramp), and its rope only wears
 *               while the bob is flung out at the very limit of its reach.
 *   "splitter"— Breakable: every circle it hits sheds a free-flying piece that
 *               also scores; as it loses mass it shrinks, shortens, and speeds up.
 *   "chaos"   — Random: every stat (size, weight, speed, reach) churns through
 *               the run, bounded by the lightest/heaviest values in the roster.
 */
export type BobBehaviorKind =
  | "hunter"
  | "piercer"
  | "hydra"
  | "nitro"
  | "magnet"
  | "frenzy"
  | "teleport"
  | "rocket"
  | "splitter"
  | "chaos";

export interface BobBehavior {
  kind: BobBehaviorKind;
  // --- hunter (Ravager) ---
  /** Steering acceleration toward the nearest live zone (world units / step²). */
  chaseAccel?: number;
  /** Speed each devoured circle tops the chase back up to (world units / step). */
  chaseMaxSpeed?: number;
  /** Stop homing after this many eats… */
  satiationEats?: number;
  /** …or after this long since the snap, whichever comes first (ms). */
  satiationMs?: number;
  // --- piercer (Arrow) ---
  /** Time between straight-line dashes while swinging (ms). */
  dashIntervalMs?: number;
  /** Dash burst speed along the heading (world units / step). */
  dashSpeed?: number;
  // --- hydra (Mutant) ---
  /** Combo hits between each new "head". */
  milestoneHits?: number;
  /** Heads gained per milestone. */
  echoPerMilestone?: number;
  /** Cap on self-grown heads for one run. */
  maxBonusEchoes?: number;
  // --- nitro (Glass cannon) ---
  /** Multiplier on rope durability drain (>1 = snaps sooner). */
  durabilityDrainMult?: number;
  // --- magnet (Lodestone) ---
  /** Radius within which circles/tokens are pulled toward the bob (world units). */
  pullRadius?: number;
  /** Per-frame pull strength on circles (fraction of the gap closed per second). */
  pullStrength?: number;
  /** Per-frame pull strength on loose tokens. */
  tokenPullStrength?: number;
  // --- frenzy (Berserker) ---
  /** Fractional swing-speed gain per combo stack. */
  comboSpeedPerStack?: number;
  /** Fractional bob-size gain per combo stack. */
  comboSizePerStack?: number;
  /** Combo stacks past which scaling is capped. */
  maxComboStacks?: number;
  // --- teleport (TP) ---
  /** Time between random blinks while swinging (ms). */
  teleportIntervalMs?: number;
  /** Tangential speed handed to the bob right after a blink (world units / step). */
  teleportSpeed?: number;
  // --- rocket (Rocket) ---
  /** Thrust added to the bob's speed per second (world units / step per sec). */
  rocketAccel?: number;
  /** Hard cap on the bob's speed under thrust (world units / step). */
  rocketMaxSpeed?: number;
  /** Time from launch to full thrust (ms). */
  rocketRampMs?: number;
  /** Extra thrust multiplier applied while a Speed Ramp is active. */
  rampSynergy?: number;
  /** Durability only drains past this fraction of full reach (rope at its limit). */
  limitDrainFraction?: number;
  // --- splitter (Breakable) ---
  /** Launch speed of a shed piece (world units / step). */
  shedSpeed?: number;
  /** Pieces the bob can lose in one run. */
  maxShards?: number;
  /** Size + reach reduction per piece lost (fraction). */
  shrinkPerShard?: number;
  /** Angular-cap gain per piece lost (fraction). */
  speedupPerShard?: number;
  /** Weight reduction per piece lost (fraction). */
  weightDropPerShard?: number;
  /** Shed-piece radius relative to the bob's current radius. */
  shardRadiusFraction?: number;
  // --- chaos (Random) ---
  /** How often fresh random stat targets are rolled (ms). */
  chaosRerollMs?: number;
  /** Per-second blend rate toward the current random targets. */
  chaosLerpRate?: number;
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
  /** Optional special gameplay behavior. Most bobs omit this. */
  behavior?: BobBehavior;
}

export type AttachmentType = "rope" | "rod" | "chain" | "elastic";

export interface AttachmentBonuses {
  momentumMult?: number;
  twistPowerBonus?: number;
  velocityBonus?: number;
}

/**
 * Special gameplay behaviors a rope (attachment) can carry — the rope analog of
 * BobBehavior. Most attachments have none (they're pure stat/material lines); an
 * attachment with a `behavior` is special-cased at a handful of hook points in
 * the game loop (durability/battery drain, repair pickup, per-frame rope shaping
 * and steering). One behavior per rope.
 *   "flux"      — Random Rope: every stat (effective length + durability drain
 *                 speed) churns through the run, mirroring the Chaos bob.
 *   "metronome" — Pendulum Rope: a rigid pivot→bob rod (not a segmented rope) whose
 *                 length oscillates sinusoidally, pumping a classic pendulum swing.
 *   "belt"      — Mechanic Rope: a real conveyor — while the run lasts it feeds
 *                 rope off the anchor, stretching the line until stress snaps it.
 *                 Repair drops reel slack back in. The shortest rope in the game;
 *                 while strung the bob rides a random tunnel path (re-rolled each
 *                 run and on every spent token) with an initial kick and conveyor
 *                 carry along the route instead of pivot-spin steering.
 *   "bulwark"   — Wall Rope: every half-second it hardens a random stretch from
 *                 the anchor toward the bob into a rigid "wall"; it can't pick up
 *                 repair drops, but when the bob whips hard enough to break the
 *                 wall, that hardened stretch is repaired (re-softened) and the
 *                 cycle begins again.
 */
export type RopeBehaviorKind = "flux" | "metronome" | "belt" | "bulwark";

export interface RopeBehavior {
  kind: RopeBehaviorKind;
  // --- flux (Random Rope) ---
  /** How often fresh random length / drain targets are rolled (ms). */
  fluxRerollMs?: number;
  /** Per-second blend rate toward the current random targets. */
  fluxLerpRate?: number;
  // --- metronome (Pendulum Rope) ---
  /** Full in→out→in length-oscillation period (ms). */
  swingPeriodMs?: number;
  /** Length oscillation amplitude as a ± fraction of base length. */
  swingDepth?: number;
  // --- belt (Mechanic Rope) ---
  /** Base rope length paid out per second (fraction of nominal length). */
  beltPayoutRate?: number;
  /** Slack reeled in per repair drop (0..1 fraction of current overhang). */
  beltReelFraction?: number;
  /** Base conveyor speed along the tunnel (world units / sec). */
  beltConveyorSpeed?: number;
  /** How hard the bob is pulled back onto the tunnel centerline (0..1 / step). */
  beltTrackAccel?: number;
  /** Lookahead along the path as a fraction of total tunnel length. */
  beltLookahead?: number;
  /** Initial launch kick along the tunnel tangent (world units / step). */
  beltKickSpeed?: number;
  /** Corridor half-width for hard wall containment on the conveyor tunnel (world units). */
  beltCorridorWidth?: number;
  /** Waypoints in the randomly generated tunnel route. */
  beltWaypointCount?: number;
  // --- bulwark (Wall Rope) ---
  /** How often the wall re-hardens over a fresh random stretch (ms). */
  wallIntervalMs?: number;
  /** Tip swing speed that "breaks" the wall (world units / step). */
  wallBreakSpeed?: number;
  /** Time a broken wall stays down before it can re-harden (ms). */
  wallRepairMs?: number;
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
  /** Optional special gameplay behavior. Most attachments omit this. */
  behavior?: RopeBehavior;
}

/**
 * Boundary-wall behavior for the freed bobs after a rope snap. A strung
 * pendulum never reaches the walls, so this only matters during the snap
 * finale.
 *   "none"      — no walls; freed bobs fly off into the void and the run ends
 *                 once they all leave the field.
 *   "solid"     — indestructible walls; freed bobs bounce around until settled.
 *   "breakable" — walls shatter when slammed hard enough, kicking the bob with
 *                 an extra impulse; once enough break the bobs can escape.
 */
export type WallMode = "none" | "solid" | "breakable";

export interface SiteDef {
  id: string;
  name: string;
  description: string;
  gravity: number;
  ambient?: Vec2;
  hitZoneCount: number;
  hitZoneRadius: [number, number];
  background: string;
  /** Defaults to "none" when omitted. */
  walls?: WallMode;
  /**
   * Scales the boundary-wall cage relative to the playfield (1 = field-sized).
   * Larger values give freed bobs a roomier arena to ricochet around in.
   * Defaults to 1 when omitted.
   */
  cageScale?: number;
  /**
   * Per-map multiplier on breakable-wall durability (1 = the weight-derived
   * baseline). Lower values make this map's walls shatter in fewer hits.
   * Defaults to 1 when omitted; ignored on non-breakable sites.
   */
  wallDurabilityMult?: number;
  /**
   * In-field obstacle layout. Omitted/"box" = the ordinary rectangular cage.
   * "rings" = concentric circular ring walls centered on the pivot (the Layers
   * map): the bob threads through their gaps and multiplier circles spawn
   * across the whole field, including inside the innermost ring.
   */
  wallShape?: "box" | "rings";
  /** Number of concentric rings when `wallShape` is "rings". Defaults to 4. */
  ringCount?: number;
  /**
   * When true, a per-run black hole spawns at a random off-center spot and pulls
   * every bob toward its core (the Black Hole map). Feeding the bob into the
   * core lets the player launch again. Multiplier spawning is unaffected.
   */
  blackHole?: boolean;
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
  | "multi-bob"
  | "repair"
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
