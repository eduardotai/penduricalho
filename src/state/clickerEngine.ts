import { useGameStore } from "./store";
import {
  CLICKER_TUNING,
  isArcSurgeActive,
  nextArcSurgeAt,
} from "../game/clickerEconomy";

const TICK_MS = 100;
const AUTO_PUMP_MS = 220;
let earnAcc = 0;
let lastArcCheck = 0;
let nextSurgeAt = 0;
let autoPumpAcc = 0;

function now(): number {
  return Date.now();
}

/**
 * Workshop tick: passive CPS, Arc Surge scheduling, combined idle rate for HUD.
 */
export function startClickerEngine(): () => void {
  const store = useGameStore;
  nextSurgeAt = nextArcSurgeAt(now(), 0);

  const handle = window.setInterval(() => {
    const t = now();
    const s = store.getState();

    // Passive generator income (foreground only — offline uses idleEngine)
    if (!document.hidden && s.cachedTotalCps > 0) {
      earnAcc += s.cachedTotalCps * (TICK_MS / 1000);
      const gain = Math.floor(earnAcc);
      if (gain > 0) {
        earnAcc -= gain;
        store.getState().addMomentum(gain);
      }
    }

    // Arc Surge proc (foreground, not in modals — cheap check)
    if (!document.hidden && t - lastArcCheck >= 1000) {
      lastArcCheck = t;
      if (!isArcSurgeActive(s.arcSurgeUntil, t) && t >= nextSurgeAt) {
        store.getState().startArcSurge(t);
        nextSurgeAt = nextArcSurgeAt(t, t);
      }
    }

    store.getState().decayClickCombo(t);
    store.getState().syncIdleRateFromWorkshop();

    const st = store.getState();
    if (st.autoRun && st.isRunning && !document.hidden) {
      autoPumpAcc += TICK_MS;
      if (autoPumpAcc >= AUTO_PUMP_MS) {
        autoPumpAcc = 0;
        st.cookiePump();
      }
    } else {
      autoPumpAcc = 0;
    }
  }, TICK_MS);

  return () => {
    window.clearInterval(handle);
    earnAcc = 0;
  };
}