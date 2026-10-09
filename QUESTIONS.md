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

3. **Reply-To address.** Emails now carry a Reply-To of `EMAIL_REPLY_TO` if set, otherwise the owner account's
   email. *Question:* is the owner's own address the right one, or should replies go to a shared mailbox?

4. **Resend domain.** `EMAIL_FROM` must be on a domain verified in Resend (the brief names `kigalisafety.dev`).
   Until it is verified, mail to addresses other than the Resend account holder's will be refused or land in
   spam. This cannot be checked from the build environment.

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
