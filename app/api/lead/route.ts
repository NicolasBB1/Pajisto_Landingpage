import { NextResponse, type NextRequest } from "next/server";
import type { LeadApiResponse } from "@/lib/lead";
import { getCloseConfig, getLeadMode } from "@/lib/server/config";
import { createIdempotencyStore, createRateLimiter } from "@/lib/server/guards";
import { handleLead } from "@/lib/server/handle-lead";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Höchstens 5 gültige Anfragen je 10 Minuten und IP – großzügig genug für
// echte Besucher (auch mehrere Personen hinter einem Firmenanschluss).
const rateLimiter = createRateLimiter(5, 10 * 60 * 1000);
const idempotency = createIdempotencyStore<LeadApiResponse & { ok: true }>(15 * 60 * 1000);

function clientKey(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return NextResponse.json<LeadApiResponse>({ ok: false, error: "bad_request" }, { status: 415 });
  }

  // Formular-Posts von fremden Seiten ablehnen.
  const origin = req.headers.get("origin");
  if (origin) {
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      /* ungültiger Origin-Header */
    }
    if (originHost !== req.headers.get("host")) {
      return NextResponse.json<LeadApiResponse>({ ok: false, error: "bad_request" }, { status: 403 });
    }
  }

  const raw = await req.text();
  const { status, body } = await handleLead(raw, clientKey(req), {
    mode: getLeadMode(),
    close: getCloseConfig(),
    rateLimiter,
    idempotency,
  });
  return NextResponse.json<LeadApiResponse>(body, { status, headers: { "Cache-Control": "no-store" } });
}
