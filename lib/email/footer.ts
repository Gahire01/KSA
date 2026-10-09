import { ACADEMY } from "@/lib/academy/constants";

/**
 * On every mail: where replies go, the academy's postal address (an explicit marker while
 * the owner has not supplied it, never an invented one) and why the person got it.
 * Kept apart from the templates so the sender can use it without importing them.
 */
export const COMMON_FOOTER = `Reply to this email to reach the academy. ${ACADEMY.address}<br />You received this because you registered with Kigali Safety Academy.`;

/** The same footer for the plain-text part. */
export const TEXT_FOOTER = [
  "",
  "--",
  "Reply to this email to reach the academy.",
  ACADEMY.address,
  "You received this because you registered with Kigali Safety Academy.",
].join("\n");
