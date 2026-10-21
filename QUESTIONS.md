# Open questions for the owner

Nothing here blocked the build. Each item says what was done in the meantime.

1. **The First Aid course has no questions.** The client sent one file ("FIRE FIGHTING") holding 15 fire
   questions and 15 first-aid questions, and the brief said to seed both under Fire Fighting. So `FIRE` has
   30 and `FIRST` has none, which means a First Aid exam cannot be sent yet.
   *Question:* should the 15 first-aid questions also be copied into `FIRST` (or moved there)? Until you
   answer, `FIRST` stays empty and the dashboard flags it ("has no exam questions yet").

2. **Academy details are unfilled.** `lib/academy/constants.ts` still holds "TO BE FILLED BY OWNER" for the
   postal address, phone, email and registration number. They show that marker on receipts, emails and the
   public footer rather than an invented value. Send the real ones and they go in one file.

3. **Reply-To address.** Emails use `GMAIL_USER` for both sender and replies (kigalisafetyacademy@gmail.com).

4. **Gmail SMTP.** Configure `GMAIL_USER` and `GMAIL_APP_PASSWORD` in development and Vercel.
   The transport uses smtp.gmail.com on port 465 with TLS.

5. **Tab-leave when an attempt is left.** The second time a trainee leaves the exam window, that attempt is
   marked FAILED whatever the score, and, if they still have an attempt left, attempt 2 is issued as usual.
   The enrolment is marked FAILED only when attempts run out. *Question:* is that what you want, or should a
   tab-leave failure end the enrolment at once?

6. **Revoked certificates.** The printed sheet and PDF no longer say "Revoked" (per the brief). A revoked
   certificate's PDF therefore looks the same as a valid one; revocation shows on the public verify page and
   in the register. *Question:* do you want the PDF download blocked for revoked certificates?

7. **Re-draw the signature.** The signature pad now draws a thicker stroke (3-4px when printed). The signature
   already locked in the database was drawn with the old thin pen, so draw and lock it again under
   Settings > Certificate signature to get the heavier line.

8. **Rigger category.** The Rigger course was filed under a new category, "Rigging & Lifting". Rename it if the
   academy uses a different grouping.

9. **Prices for trainees enrolled before the tiers.** Payment status now treats the cheapest package as "paid in
   full" (someone who paid Basic has bought Basic). *Question:* is that the rule you want, or should "paid in
   full" mean the Standard price?

10. **FIX 2 — 401 on /api/dashboard.** Already correct in code: `credentials: "include"` is set globally in
    `lib/api/client.ts`, and `guard()` reads the right session cookie. The 401 only happens when there is no
    active session (user not logged in). If it persists after login, check for a port mismatch or cookie-blocking.
    No code change needed.

11. **FIX 3 — 500 on /api/auth/login.** Already handled: the route wraps the OTP email in try/catch and returns
    a user-facing error if Gmail SMTP is unavailable or rejects the send.
    **Env requirement:** set `GMAIL_USER` and `GMAIL_APP_PASSWORD` in `.env.local`.

12. **FIX 7 — Export already built.** ExportMenu + `/api/reports/[type]` route + Excel (ExcelJS) and PDF
    (@react-pdf/renderer) generators all exist and are wired to `/trainees`, `/payments`, `/certificates`,
    `/exams`, and `/audit-log`. No code change needed.

13. **"Image copied" toast — not found.** Grepped every `.tsx`/`.ts` file for `Image copied`,
    `navigator.clipboard.write` (image blob), and `contextmenu` handlers in `components/certificate/*`.
    No image-copy code exists anywhere. The only clipboard usage is `CopyButton.tsx` which copies
    text (verification links). The `onContextMenu` in `CertificateSheet.tsx` just prevents right-click
    with no toast. If the user saw an "Image copied" toast, it was likely from a browser extension
    or Chrome's built-in long-press behavior on mobile, not from KSA code.
