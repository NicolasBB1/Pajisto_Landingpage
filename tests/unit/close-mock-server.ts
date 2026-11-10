import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export interface RecordedRequest {
  method: string;
  path: string;
  auth: string | undefined;
  body: any;
}

export type MockReply = { status: number; body?: unknown; headers?: Record<string, string> };
export type MockHandler = (req: RecordedRequest, index: number) => MockReply;

/** Lokaler HTTP-Server, der die Close-API für Tests nachstellt. */
export async function startCloseMock(handler: MockHandler) {
  const requests: RecordedRequest[] = [];
  const read = (req: IncomingMessage) =>
    new Promise<string>((resolve) => {
      let data = "";
      req.on("data", (c) => (data += c));
      req.on("end", () => resolve(data));
    });

  const server: Server = createServer(async (req, res) => {
    const raw = await read(req);
    const recorded: RecordedRequest = {
      method: req.method ?? "",
      path: req.url ?? "",
      auth: req.headers.authorization,
      body: raw ? JSON.parse(raw) : undefined,
    };
    requests.push(recorded);
    const reply = handler(recorded, requests.length - 1);
    res.writeHead(reply.status, { "Content-Type": "application/json", ...reply.headers });
    res.end(JSON.stringify(reply.body ?? {}));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}/api/v1`,
    requests,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/** Standardverhalten: keine Treffer in der Suche, Lead/Notiz werden angelegt. */
export function defaultHandler(over: Partial<Record<string, MockReply>> = {}): MockHandler {
  return (req) => {
    if (req.path === "/api/v1/data/search/") {
      const isEmail = JSON.stringify(req.body).includes("contact_email");
      return over[isEmail ? "searchEmail" : "searchCompany"] ?? { status: 200, body: { data: [], cursor: null } };
    }
    if (req.path === "/api/v1/lead/") return over.lead ?? { status: 200, body: { id: "lead_new123" } };
    if (req.path === "/api/v1/activity/note/") return over.note ?? { status: 200, body: { id: "acti_note1" } };
    return { status: 404 };
  };
}
