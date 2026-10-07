"use client";

import * as React from "react";

/**
 * Allows one open tab per exam.
 *
 * A tab that opens an exam announces itself on a BroadcastChannel. If a tab
 * that already holds the exam hears it, that tab answers "owner" and the newcomer
 * blocks itself. The tab that was first keeps the exam, so a trainee who opens a
 * second tab loses the second one, not their progress. Two tabs opened in the
 * same instant are settled by (opened-at, tab id), lowest wins.
 *
 * This is a deterrent for one browser, not a server guarantee: the server
 * already refuses a second redemption of the link, and its timer is authoritative.
 * Where BroadcastChannel does not exist the tab is simply treated as the owner.
 */

export type SingleTabState = "checking" | "owner" | "blocked";

type Message =
  | { type: "hello"; key: string; tabId: string; openedAt: number }
  | { type: "owner"; key: string; tabId: string; openedAt: number };

const CHANNEL = "ksa-exam";
/** How long a new tab waits for an existing owner to answer. */
const CLAIM_WAIT_MS = 400;

export function useSingleTab(key: string, enabled: boolean): SingleTabState {
  const [state, setState] = React.useState<SingleTabState>("checking");

  React.useEffect(() => {
    if (!enabled) return;
    if (typeof BroadcastChannel === "undefined") {
      setState("owner");
      return;
    }

    const tabId = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const openedAt = Date.now();
    const channel = new BroadcastChannel(CHANNEL);
    let current: SingleTabState = "checking";

    const set = (next: SingleTabState) => {
      current = next;
      setState(next);
    };

    channel.onmessage = (event: MessageEvent<Message>) => {
      const msg = event.data;
      if (!msg || msg.key !== key || msg.tabId === tabId) return;

      if (msg.type === "owner" && current === "checking") {
        set("blocked");
        return;
      }

      if (msg.type === "hello") {
        if (current === "owner") {
          channel.postMessage({ type: "owner", key, tabId, openedAt } satisfies Message);
          return;
        }
        /* Both still checking: the later tab yields. */
        if (
          current === "checking" &&
          (msg.openedAt < openedAt || (msg.openedAt === openedAt && msg.tabId < tabId))
        ) {
          set("blocked");
        }
      }
    };

    channel.postMessage({ type: "hello", key, tabId, openedAt } satisfies Message);

    const timer = window.setTimeout(() => {
      if (current === "checking") set("owner");
    }, CLAIM_WAIT_MS);

    return () => {
      window.clearTimeout(timer);
      channel.close();
    };
  }, [key, enabled]);

  return state;
}
