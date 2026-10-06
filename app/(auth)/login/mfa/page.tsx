import { redirect } from "next/navigation";

/**
 * /login/mfa — retired.
 *
 * Sign-in is email OTP now: the code arrives by mail and is redeemed on /login
 * itself, so there is no authenticator step to come back to. The page stays in
 * the tree (and still redirects) because old links, bookmarks and the invite
 * flow all point at it. The TOTP endpoints under /api/auth/mfa are untouched.
 */
export default function MfaPage() {
  redirect("/login");
}
