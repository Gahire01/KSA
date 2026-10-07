"use client";

import * as React from "react";

import { CHANNEL_NAME, runSingleTab, type SingleTabState, type TabChannel } from "@/lib/exams/single-tab";

export type { SingleTabState };

/**
 * Allows one open tab per exam. The first tab keeps the exam; a second tab in
 * the same browser blocks itself. See lib/exams/single-tab.ts for the protocol.
 *
 * This is a deterrent for one browser, not a server guarantee: the server
 * already refuses a second redemption of the link, and its timer is
 * authoritative. Where BroadcastChannel does not exist the tab is treated as
 * the owner.
 */
export function useSingleTab(key: string, enabled: boolean): SingleTabState {
  const [state, setState] = React.useState<SingleTabState>("checking");

  React.useEffect(() => {
    if (!enabled) return;
    if (typeof BroadcastChannel === "undefined") {
      setState("owner");
      return;
    }
    return runSingleTab(() => new BroadcastChannel(CHANNEL_NAME) as unknown as TabChannel, key, setState);
  }, [key, enabled]);

  return state;
}
