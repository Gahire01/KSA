import { EventEmitter } from "node:events";

/**
 * In-process SSE broadcaster.
 *
 * Single-instance by design for launch: a Map from userId to the open response
 * controllers. Scaling to more than one instance needs a shared bus (Redis
 * pub/sub or Postgres LISTEN/NOTIFY) so a notification written on instance A
 * reaches a stream held by instance B — noted in HANDOFF.md as post-launch work.
 */

const bus = new EventEmitter();

/** One listener per open stream; the default cap of 10 is far too low. */
bus.setMaxListeners(0);

export type NotificationEvent = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

const channel = (userId: string) => `user:${userId}`;

/** Fan a stored notification out to every open stream for that user. */
export function publish(userId: string, event: NotificationEvent): void {
  bus.emit(channel(userId), event);
}

/** Subscribe an open SSE stream. Returns the unsubscribe function. */
export function subscribe(
  userId: string,
  handler: (event: NotificationEvent) => void,
): () => void {
  const name = channel(userId);
  bus.on(name, handler);
  return () => {
    bus.off(name, handler);
  };
}