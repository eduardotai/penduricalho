import { useEffect, useRef } from "react";
import { FormattedNumber } from "./FormattedNumber";
import { useGameStore } from "../state/store";
import { playGameSound, playUiClick } from "../audio/soundMap";
import { THEMES, type ThemeDef } from "../data/themes";
import { RENDER_THEMES } from "../game/themes";
import { SITE_MAP, STARTER_SITE_ID } from "../data/sites";
import { withAlpha } from "../game/bobRenderUtils";
import { useLang, useT } from "../i18n";
import { Check, Minus } from "lucide-react";

/** Shop tab: buy and equip visual themes with Momentum. */
export default function ThemeShop() {
  const t = useT();
  const lang = useLang();
  const momentum = useGameStore((s) => s.momentum);
  const ownedThemes = useGameStore((s) => s.ownedThemes);
  const themeId = useGameStore((s) => s.themeId);
  const buyTheme = useGameStore((s) => s.buyTheme);
  const equipTheme = useGameStore((s) => s.equipTheme);

  return (
    <div className="flex flex-col gap-3" data-testid="theme-shop">
      <p className="text-xs leading-relaxed text-slate-400">{t.customize.themesIntro}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {THEMES.map((theme) => {
          const owned = ownedThemes.includes(theme.id);
          const equipped = theme.id === themeId;
          const canAfford = momentum >= theme.cost;
          return (
            <div
              key={theme.id}
              data-theme-card={theme.id}
              className={`card flex flex-col overflow-hidden ${equipped ? "card-lit" : ""}`}
            >
              <ThemePreview theme={theme} />
              <div className="flex flex-1 flex-col gap-2 p-3">
                <div className="flex gap-1" aria-hidden>
                  {theme.swatch.map((c) => (
                    <span key={c} className="h-2 w-6 rounded-sm ring-1 ring-black/40" style={{ background: c }} />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-sm font-bold uppercase tracking-wide text-slate-50">{theme.name[lang]}</h3>
                  {equipped && (
                    <span className="tag text-brand-300">
                      {t.customize.equipped}
                    </span>
                  )}
                </div>
                <p className="flex-1 text-xs text-slate-400">{theme.description[lang]}</p>
                <div className="flex items-center justify-between gap-2">
                  {owned ? (
                    <span className="text-slate-500" aria-hidden>
                      {theme.cost === 0 ? <Minus size={14} /> : <Check size={14} strokeWidth={2.5} className="text-emerald-400" />}
                    </span>
                  ) : (
                    <FormattedNumber value={theme.cost} className="font-mono text-sm font-bold text-brand-300" />
                  )}
                  {owned ? (
                    equipped ? (
                      <span className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-brand-300">
                        <span className="led led-on" aria-hidden />
                        {t.customize.inUse}
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          playUiClick();
                          equipTheme(theme.id);
                          playGameSound("ui-equip");
                        }}
                        className="key min-h-[44px] px-4 text-xs"
                      >
                        {t.customize.equip}
                      </button>
                    )
                  ) : (
                    <button
                      onClick={() => {
                        playUiClick();
                        const ok = buyTheme(theme.id);
                        playGameSound(ok ? "ui-buy" : "ui-error");
                        if (ok) equipTheme(theme.id);
                      }}
                      disabled={!canAfford}
                      className={`key ${canAfford ? "key-primary" : ""} min-h-[44px] px-4 text-xs`}
                    >
                      {t.customize.buy}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const PREVIEW_W = 320;
const PREVIEW_H = 120;

/** Small canvas rendered with the theme's own art: backdrop, pivot, three circles. */
function ThemePreview({ theme }: { theme: ThemeDef }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const art = RENDER_THEMES[theme.id];
    if (!canvas || !art) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = PREVIEW_W * dpr;
    canvas.height = PREVIEW_H * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const site = SITE_MAP.get(STARTER_SITE_ID)!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    art.drawBackdrop(ctx, PREVIEW_W, PREVIEW_H, site, { panX: 0, panY: 0, scale: 1, now: 4000 });
    // Pivot at half scale near the top.
    ctx.save();
    ctx.translate(PREVIEW_W * 0.22, 34);
    ctx.scale(0.5, 0.5);
    art.drawPivot(ctx, { x: 0, y: 0 }, 4000);
    ctx.restore();
    // Rope + three circles in rising tiers.
    ctx.strokeStyle = withAlpha("#e2d6c0", 0.6);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(PREVIEW_W * 0.22, 34);
    ctx.lineTo(PREVIEW_W * 0.32, 96);
    ctx.stroke();
    const spots = [
      { x: 0.52, y: 0.62, r: 17, tier: 1 },
      { x: 0.71, y: 0.4, r: 20, tier: 3 },
      { x: 0.89, y: 0.66, r: 15, tier: 4 },
    ];
    for (const s of spots) {
      const tier = art.zone.tiers[Math.min(art.zone.tiers.length - 1, s.tier)];
      const x = PREVIEW_W * s.x;
      const y = PREVIEW_H * s.y;
      const args = { x, y, r: s.r, tier, flash: false, pulse: 0.5, phase: s.x * 6, now: 4000 };
      const glow = ctx.createRadialGradient(x, y, s.r * 0.35, x, y, s.r * 1.5);
      glow.addColorStop(0, withAlpha(tier.glow, 0.25));
      glow.addColorStop(1, withAlpha(tier.glow, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, s.r * 1.5, 0, Math.PI * 2);
      ctx.fill();
      const body = ctx.createRadialGradient(x - s.r * 0.32, y - s.r * 0.32, s.r * 0.12, x, y, s.r);
      body.addColorStop(0, tier.core);
      body.addColorStop(0.4, tier.glow);
      body.addColorStop(1, tier.fill);
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(x, y, s.r, 0, Math.PI * 2);
      ctx.fill();
      art.zone.rim(ctx, args);
      ctx.stroke();
      art.zone.decorate?.(ctx, args);
    }
  }, [theme.id]);
  return (
    <canvas
      ref={ref}
      aria-hidden
      className="block h-auto w-full bg-slate-950"
      style={{ aspectRatio: `${PREVIEW_W} / ${PREVIEW_H}` }}
    />
  );
}
