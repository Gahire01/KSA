import { redirect } from "next/navigation";

/**
 * /login/mfa/setup — retired with /login/mfa.
 *
 * TOTP enrolment used to be the first stop after a password sign-in. The flow is
 * email OTP now, so there is nothing to enrol and this address sends the visitor
 * back to /login. `User.totpSecret` and `User.totpEnabled` are kept for a future
 * return of the feature; the enrolment endpoints under /api/auth/mfa still exist.
 */
export default function MfaSetupPage() {
  redirect("/login");
}
