/**
 * Single-tab election over a BroadcastChannel. Framework-free so it can be run
 * and tested outside React; lib/hooks/use-single-tab.ts is a thin wrapper.
 *
 * A tab that opens an exam announces itself ("hello"). The earliest tab (by
 * opened-at, then tab id) keeps the exam; later ones block themselves. Because
 * BroadcastChannel never replays a message to a channel opened after it was
 * posted, a tab that is, or is about to be, the owner answers every hello it
 * hears, even while it is still deciding.
 */

export type SingleTabState = "checking" | "owner" | "blocked";

type Message =
  | { type: "hello"; key: string; tabId: string; openedAt: number }
  | { type: "owner"; key: string; tabId: string; openedAt: number };

export const CHANNEL_NAME = "ksa-exam";
/** How long a new tab waits for an existing owner to answer. */
export const CLAIM_WAIT_MS = 400;

export interface TabChannel {
  postMessage(message: unknown): void;
  close(): void;
  onmessage: ((event: { data: unknown }) => void) | null;
}

export function runSingleTab(
  openChannel: () => TabChannel,
  key: string,
  onState: (state: SingleTabState) => void,
  options: { tabId?: string; openedAt?: number; waitMs?: number } = {},
): () => void {
  const tabId = options.tabId ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
  const openedAt = options.openedAt ?? Date.now();
  const channel = openChannel();
  let current: SingleTabState = "checking";

  const set = (next: SingleTabState) => {
    current = next;
    onState(next);
  };

  channel.onmessage = (event) => {
    const msg = event.data as Message | null;
    if (!msg || msg.key !== key || msg.tabId === tabId) return;

    const otherIsEarlier =
      msg.openedAt < openedAt || (msg.openedAt === openedAt && msg.tabId < tabId);

    /* An owner claim only beats this tab if it came from an earlier tab. A claim
     * from a later one (answering a third tab's hello) must not make the true
     * winner block itself, or three tabs opened together could all block. */
    if (msg.type === "owner" && current === "checking" && otherIsEarlier) {
      set("blocked");
      return;
    }

    if (msg.type === "hello" && current !== "blocked") {
      /* Still deciding and the other tab is earlier: it wins, so yield. */
      if (current === "checking" && otherIsEarlier) {
        set("blocked");
        return;
      }
      channel.postMessage({ type: "owner", key, tabId, openedAt } satisfies Message);
    }
  };

  channel.postMessage({ type: "hello", key, tabId, openedAt } satisfies Message);

  const timer = setTimeout(() => {
    if (current === "checking") set("owner");
  }, options.waitMs ?? CLAIM_WAIT_MS);

  return () => {
    clearTimeout(timer);
    channel.close();
  };
}
