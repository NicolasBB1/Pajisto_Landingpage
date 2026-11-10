/**
 * Schutzmechanismen des Lead-Endpunkts: Rate-Limit und Idempotenz.
 *
 * Beide arbeiten im Arbeitsspeicher der jeweiligen Serverinstanz. Das fängt
 * Doppelklicks, schnelle Wiederholungen und einfache Bots zuverlässig ab,
 * ist auf Serverless-Plattformen aber kein harter, instanzübergreifender
 * Schutz. Zweite Verteidigungslinie gegen doppelte Leads ist die
 * E-Mail-Suche im Close-Adapter. Details: docs/CLOSE_INTEGRATION.md.
 */

export interface RateLimiter {
  /** true = Anfrage erlaubt (und gezählt). */
  take(key: string, now?: number): boolean;
}

export function createRateLimiter(limit: number, windowMs: number, maxKeys = 5000): RateLimiter {
  const hits = new Map<string, number[]>();
  return {
    take(key, now = Date.now()) {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.delete(key);
      hits.set(key, recent);
      if (hits.size > maxKeys) {
        const oldest = hits.keys().next().value;
        if (oldest !== undefined) hits.delete(oldest);
      }
      return true;
    },
  };
}

export interface IdempotencyStore<T> {
  /**
   * Führt `work` pro Schlüssel höchstens einmal aus. Parallele und spätere
   * Aufrufe mit demselben Schlüssel erhalten dasselbe Ergebnis. Schlägt
   * `work` fehl, wird der Schlüssel freigegeben, damit ein erneuter Versuch
   * möglich ist.
   */
  run(key: string, work: () => Promise<T>): Promise<T>;
}

export function createIdempotencyStore<T>(ttlMs: number, maxKeys = 2000): IdempotencyStore<T> {
  const entries = new Map<string, { at: number; promise: Promise<T> }>();
  return {
    run(key, work) {
      const now = Date.now();
      for (const [k, e] of entries) {
        if (now - e.at > ttlMs) entries.delete(k);
        else break;
      }
      const existing = entries.get(key);
      if (existing) return existing.promise;
      const promise = work();
      entries.set(key, { at: now, promise });
      promise.catch(() => {
        if (entries.get(key)?.promise === promise) entries.delete(key);
      });
      if (entries.size > maxKeys) {
        const oldest = entries.keys().next().value;
        if (oldest !== undefined) entries.delete(oldest);
      }
      return promise;
    },
  };
}
