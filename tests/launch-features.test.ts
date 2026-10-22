import assert from "node:assert/strict";
import { test } from "node:test";
import { canIssueManualCertificate, manualCertificateSchema } from "../lib/certificates/manual-policy";
import { certificateEmail, examLinkEmail, loginOtpEmail, otpCodeOnlyEmail, registrationConfirmationEmail } from "../lib/email/templates";
import { hashPassword, verifyPassword } from "../lib/auth/password";

test("manual issuance allows only active allowlisted administrators", () => {
  for (const email of ["gahiredev01@gmail.com", "kigalisafetyacademy@gmail.com", "niyofredsoni@gmail.com"]) {
    assert.equal(canIssueManualCertificate({ email, role: "ADMIN", isActive: true }), true);
    assert.equal(canIssueManualCertificate({ email, role: "OWNER", isActive: true }), true);
    assert.equal(canIssueManualCertificate({ email, role: "TRAINER", isActive: true }), false);
    assert.equal(canIssueManualCertificate({ email, role: "ADMIN", isActive: false }), false);
  }
  assert.equal(canIssueManualCertificate({ email: "duwimbabazi19@gmail.com", role: "OWNER" }), false);
  assert.equal(canIssueManualCertificate(null), false);
  assert.equal(canIssueManualCertificate({ email: "other@example.com", role: "ADMIN" }), false);
});

test("manual issuance requires password, course and a real, nonfuture issue date", () => {
  const valid = { traineeName: "Test Trainee", courseId: "course-one", issuedOn: "2026-01-10", password: "test-password" };
  assert.equal(manualCertificateSchema.safeParse(valid).success, true);
  for (const changed of [{ password: "" }, { traineeName: " " }, { courseId: "" }, { issuedOn: "2026-02-30" }, { issuedOn: "2099-01-01" }]) {
    assert.equal(manualCertificateSchema.safeParse({ ...valid, ...changed }).success, false);
  }
});

test("admin password reauthentication verifies Argon2 and rejects an incorrect password", async () => {
  const hash = await hashPassword("test-password-only");
  assert.match(hash, /^\$argon2id\$/);
  assert.equal(await verifyPassword(hash, "test-password-only"), true);
  assert.equal(await verifyPassword(hash, "incorrect"), false);
});

test("code emails keep all six digits contiguous for copying and avoid staff app links", () => {
  const exam = { traineeName: "Test", courseName: "Safety", examUrl: "https://ksa-rw.vercel.app/exam/test", otp: "123456", expiryMin: 30 };
  const messages = [examLinkEmail(exam), otpCodeOnlyEmail(exam), loginOtpEmail({ code: "123456", expiryMinutes: 10, recipientEmail: "test@example.com" })];
  for (const message of messages) {
    assert.match(message.html, />123456<\//);
    assert.match(message.html, /font-size:32px/);
    assert.match(message.html, /user-select:all/);
    assert.doesNotMatch(message.html, />1 2 3 4 5 6<\//);
    assert.doesNotMatch(message.html, /href=["'][^"']*\/(login|dashboard)/);
  }
  const registration = registrationConfirmationEmail({ firstName: "Test", courseName: "Safety", traineeCode: "T1", registeredOn: new Date("2026-01-10") });
  assert.doesNotMatch(registration.html, /href=["'][^"']*\/(login|dashboard)/);
  assert.match(examLinkEmail(exam).html, /Start exam/);
  const certificate = certificateEmail({ traineeName: "Test", courseName: "Safety", studentNumber: 457, verifyUrl: "https://ksa-rw.vercel.app/verify/test", issuedAt: new Date("2026-01-10") });
  assert.equal(certificate.subject, "Your Kigali Safety Academy Certificate");
  assert.match(certificate.text, /PDF certificate is attached/);
});
