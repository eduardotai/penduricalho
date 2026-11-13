/**
 * The redesign's single icon vocabulary. Every UI icon is a Lucide line icon
 * (ISC licence, https://lucide.dev) drawn at one stroke weight, plus a few
 * hand-drawn SVGs for things Lucide has no word for (the pendulum mark).
 *
 * Data files still carry their legacy emoji `icon` strings (save- and
 * content-compatible); the UI maps ids to icons here instead, falling back to
 * a neutral glyph for unknown ids.
 */
import type { ComponentType, SVGProps } from "react";
import {
  Activity,
  Atom,
  Award,
  Battery,
  BatteryCharging,
  ChartColumn,
  Circle,
  CircleDot,
  CircleHelp,
  Clock,
  Cog,
  Coins,
  Crown,
  Factory,
  Flame,
  FlaskConical,
  Gauge,
  Gem,
  Hand,
  Hourglass,
  Infinity as InfinityIcon,
  Key,
  Layers,
  Medal,
  MousePointerClick,
  Orbit,
  Package,
  Plane,
  Repeat,
  Rocket,
  Scale,
  Sparkles,
  Star,
  Sunrise,
  Ticket,
  TrendingUp,
  Trophy,
  Waves,
  Wind,
  Zap,
  type LucideProps,
  Sparkle,
  Radio,
  CircleDashed,
  Disc3,
  Link2,
  Footprints,
  Magnet,
} from "lucide-react";

export type IconComponent = ComponentType<LucideProps>;

/** Stroke weight shared by every icon in the UI. */
export const ICON_STROKE = 1.75;

/** Hand-drawn pendulum mark: pivot bar, rope and bob with a motion arc. */
export function PendulumGlyph({ size = 24, strokeWidth = ICON_STROKE, ...rest }: SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      <path d="M6 3h12" />
      <path d="M12 3l3.6 11.2" />
      <circle cx="16.4" cy="17" r="3" fill="currentColor" fillOpacity="0.25" />
      <path d="M5.5 15.5a8.5 8.5 0 0 0 4 4.6" strokeDasharray="1.5 2.2" />
    </svg>
  );
}

export const ACHIEVEMENT_ICONS: Record<string, IconComponent> = {
  "first-arc": Sunrise,
  "gaining-momentum": TrendingUp,
  "arc-welder": Flame,
  "perpetual-swing": InfinityIcon,
  "gravity-tyrant": Orbit,
  "event-horizon-momentum": CircleDot,
  "big-bang-bob": Sparkles,
  "hot-streak": Flame,
  "combo-king": Crown,
  "unbreakable-rhythm": Activity,
  hyperswing: Zap,
  "zen-pendulum": Waves,
  "first-gleam": Sparkles,
  "token-hoarder": Coins,
  "golden-age": Trophy,
  "lucky-lode": Star,
  "maiden-flight": Plane,
  "veteran-swinger": Medal,
  "endless-arc": Repeat,
  "kit-builder": Package,
  "full-workshop": Factory,
  "legendary-finder": Gem,
  "behavior-pioneer": FlaskConical,
  "token-spender": Ticket,
  "black-hole-diver": Circle,
  "first-snap": Zap,
  "arc-reactor": Atom,
  "first-pump": MousePointerClick,
  "factory-floor": Factory,
  "passive-tycoon": ChartColumn,
  "surge-rider": Zap,
  "zen-master": Waves,
  "momentum-singularity": Orbit,
  "neutron-star": Sparkle,
  "pulsar-bob": Radio,
  "event-horizon-bob": CircleDashed,
  "singularity-bob": Disc3,
  "perfect-match": Link2,
  "set-collector": Layers,
  moonwalker: Footprints,
  "storm-chaser": Magnet,
};

export const GENERATOR_ICONS: Record<string, IconComponent> = {
  "wind-up-key": Key,
  counterweight: Scale,
  escapement: Cog,
  flywheel: Gauge,
  clockwork: Clock,
  "torsion-spring": Wind,
  "gravity-well": CircleDot,
  "perpetual-arc": InfinityIcon,
};

export const CLICK_UPGRADE_ICONS: Record<string, IconComponent> = {
  "reinforced-finger": Hand,
  "grip-tape": Layers,
  "double-tap": MousePointerClick,
  "arc-resonance": Waves,
  "momentum-condenser": BatteryCharging,
};

export const GLOBAL_UPGRADE_ICONS: Record<string, IconComponent> = {
  "global-x2": Rocket,
  "global-x3": Cog,
};

export type IconKind = "achievement" | "generator" | "clickUpgrade" | "globalUpgrade";

const TABLES: Record<IconKind, Record<string, IconComponent>> = {
  achievement: ACHIEVEMENT_ICONS,
  generator: GENERATOR_ICONS,
  clickUpgrade: CLICK_UPGRADE_ICONS,
  globalUpgrade: GLOBAL_UPGRADE_ICONS,
};

const FALLBACK: Record<IconKind, IconComponent> = {
  achievement: Award,
  generator: Battery,
  clickUpgrade: Hourglass,
  globalUpgrade: CircleHelp,
};

/** Icon for a content id; never throws (unknown ids get a neutral glyph). */
export function iconFor(kind: IconKind, id: string | undefined | null): IconComponent {
  return (id && TABLES[kind][id]) || FALLBACK[kind];
}

/** Renders the icon for a content id at the shared stroke weight. */
export function ContentIcon({ kind, id, size = 20, className }: { kind: IconKind; id: string | undefined | null; size?: number; className?: string }) {
  const I = iconFor(kind, id);
  return <I size={size} strokeWidth={ICON_STROKE} className={className} aria-hidden />;
}
