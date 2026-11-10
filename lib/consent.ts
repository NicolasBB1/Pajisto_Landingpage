/**
 * Einwilligungsstatus für nicht notwendige Tracking-Technologien.
 *
 * Gespeichert wird ausschließlich die Entscheidung selbst (localStorage,
 * technisch notwendig, um nicht bei jedem Aufruf erneut zu fragen). Ohne
 * Entscheidung gilt "keine Einwilligung". Ob Banner-Text und Speicherdauer
 * rechtlich ausreichen, muss vor dem Livegang geprüft werden
 * (siehe LAUNCH_CHECKLIST.md).
 */
export type Consent = "granted" | "denied" | "unset";

const KEY = "pajisto_consent_v1";
const listeners = new Set<() => void>();
let memory: Consent | null = null;

function read(): Consent {
  if (memory) return memory;
  if (typeof window === "undefined") return "unset";
  try {
    const raw = window.localStorage.getItem(KEY);
    const value = raw ? (JSON.parse(raw) as { value?: unknown }).value : undefined;
    memory = value === "granted" || value === "denied" ? value : "unset";
  } catch {
    memory = "unset";
  }
  return memory;
}

export function getConsent(): Consent {
  return read();
}

export function getServerConsent(): Consent {
  return "unset";
}

export function setConsent(value: Consent): void {
  memory = value;
  try {
    if (value === "unset") window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, JSON.stringify({ value, at: new Date().toISOString() }));
  } catch {
    /* Speicher nicht verfügbar: Entscheidung gilt für diesen Seitenaufruf. */
  }
  listeners.forEach((l) => l());
}

export function subscribeConsent(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
