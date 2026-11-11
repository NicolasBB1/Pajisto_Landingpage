/**
 * Zuordnung der Funnel-Variante für den A/B-Test (kurz / ausführlich).
 *
 * Die Zuordnung lebt nur im Arbeitsspeicher des Seitenaufrufs – kein Cookie,
 * kein Storage, daher ohne Einwilligung zulässig. Für stabile Gruppen je
 * Besucher die Variante über die Anzeigen-URL festlegen (?fv=kurz bzw.
 * ?fv=ausfuehrlich).
 */
import { isFunnelVariant, type FunnelVariant } from "./funnel";
import { FUNNEL_VARIANT_MODE } from "./public-config";

let current: FunnelVariant = FUNNEL_VARIANT_MODE === "ausfuehrlich" ? "ausfuehrlich" : "kurz";
let resolved = false;
const listeners = new Set<() => void>();

export function pickVariant(search: string, mode: typeof FUNNEL_VARIANT_MODE, random: () => number = Math.random): FunnelVariant {
  const forced = new URLSearchParams(search).get("fv");
  if (isFunnelVariant(forced)) return forced;
  if (mode === "split") return random() < 0.5 ? "kurz" : "ausfuehrlich";
  return mode;
}

/** Einmal je Seitenaufruf im Browser aufrufen. */
export function resolveFunnelVariant(): void {
  if (resolved || typeof window === "undefined") return;
  resolved = true;
  const next = pickVariant(window.location.search, FUNNEL_VARIANT_MODE);
  if (next !== current) {
    current = next;
    listeners.forEach((l) => l());
  }
}

export const getFunnelVariant = (): FunnelVariant => current;
export const getServerFunnelVariant = (): FunnelVariant => (FUNNEL_VARIANT_MODE === "ausfuehrlich" ? "ausfuehrlich" : "kurz");
export function subscribeFunnelVariant(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
