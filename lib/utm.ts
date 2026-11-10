import { UTM_KEYS, type Utm } from "./lead";

/**
 * Liest die fünf UTM-Parameter aus der aufgerufenen URL. Die Werte bleiben
 * nur im Arbeitsspeicher der Seite (kein Cookie, kein Storage) und werden
 * erst mit einer Anfrage übermittelt. Andere URL-Parameter werden ignoriert.
 */
export function readUtm(search: string): Utm {
  const params = new URLSearchParams(search);
  const utm: Utm = {};
  for (const key of UTM_KEYS) {
    const value = params.get(key)?.trim().slice(0, 200);
    if (value) utm[key] = value;
  }
  return utm;
}
