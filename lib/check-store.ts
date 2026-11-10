/**
 * Kleiner Zustandsspeicher, über den der Forderungscheck sein Ergebnis an das
 * Kontaktformular übergibt (beide sind getrennte Client-Komponenten).
 */
import type { CheckContext } from "./lead";

export interface CheckHandoff {
  check: CheckContext;
  summary: string;
}

let current: CheckHandoff | null = null;
const listeners = new Set<() => void>();

export function getCheckHandoff(): CheckHandoff | null {
  return current;
}
export function getServerCheckHandoff(): CheckHandoff | null {
  return null;
}
export function setCheckHandoff(next: CheckHandoff | null): void {
  current = next;
  listeners.forEach((l) => l());
}
export function subscribeCheckHandoff(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
