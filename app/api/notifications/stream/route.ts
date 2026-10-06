import type { NextRequest } from "next/server";

import { guard } from "@/lib/api/guard";
import { subscribe } from "@/lib/notifications/broadcaster";

/**
 * GET /api/notifications/stream — Server-Sent Events for this session's user.
 *
 * EventSource cannot set a request header, but it is same-origin, so the session
 * and device cookies travel with it and the normal `guard()` applies unchanged —
 * no separate unauthenticated channel into the notification bus.
 *
 * Three things this route has to get right:
 *
 *  - **Cleanup.** Every open stream holds a listener on the in-process bus. If a
 *    disconnect did not unsubscribe, a reconnect loop would leak one listener per
 *    attempt until the process hit the EventEmitter warning and kept growing. The
 *    `cancel()` on the stream and `request.signal` both run the same teardown.
 *  - **Heartbeat.** Proxies and load balancers drop an idle connection. A comment
 *    frame every 25s keeps it alive and lets the client detect a dead pipe rather
 *    than sitting on a socket that will never deliver anything.
 *  - **No buffering.** `Cache-Control: no-cache, no-transform` plus
 *    `X-Accel-Buffering: no` stop nginx-style proxies accumulating events and
 *    delivering them in a burst long after they happened.
 */
export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 25_000;

export async function GET(request: NextRequest) {
  const gate = await guard("notification.read");
  if (!gate.ok) return gate.response;

  const userId = gate.session.user.id;
  const encoder = new TextEncoder();

  let closed = false;
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const teardown = () => {
    if (closed) return;
    closed = true;
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = null;
    unsubscribe?.();
    unsubscribe = null;
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          /* The client went away between the abort and the write. */
          teardown();
        }
      };

      /* Tells EventSource how long to wait before reconnecting after a drop. */
      write("retry: 3000\n\n");
      /* A named open event so the client can tell "authenticated and listening"
       * apart from "connected but rejected". */
      write(`event: open\ndata: ${JSON.stringify({ userId })}\n\n`);

      unsubscribe = subscribe(userId, (event) => {
        write(`event: notification\ndata: ${JSON.stringify(event)}\n\n`);
      });

      heartbeat = setInterval(() => write(`: ping\n\n`), HEARTBEAT_MS);

      request.signal.addEventListener("abort", () => {
        teardown();
        try {
          controller.close();
        } catch {
          /* Already closed by the transport. */
        }
      });
    },
    cancel() {
      teardown();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
