import assert from "node:assert/strict";
import { test } from "node:test";
import { canTraineeDownloadCertificate } from "../lib/certificates/trainee-access";

test("certificate downloads require an OTP-proven browser and its own passed, unrevoked sitting", () => {
  const certificate = {
    traineeId: "student-one", courseId: "course-one", revokedAt: null,
    attempt: { traineeId: "student-one", courseId: "course-one", status: "PASSED", tokenHash: "own-token-hash" },
  };
  const allowed = (row: Parameters<typeof canTraineeDownloadCertificate>[0], token = "own-token-hash", proof = true) => canTraineeDownloadCertificate(row, token, proof);
  assert.equal(allowed(certificate), true);
  assert.equal(allowed(certificate, "own-token-hash", false), false);
  assert.equal(allowed(certificate, "another-token-hash"), false);
  assert.equal(allowed(null), false);
  assert.equal(allowed({ ...certificate, attempt: null }), false);
  assert.equal(allowed({ ...certificate, revokedAt: new Date() }), false);
  for (const status of ["STARTED", "FAILED", "SUBMITTED", "VOIDED"]) {
    assert.equal(allowed({ ...certificate, attempt: { ...certificate.attempt, status } }), false);
  }
  assert.equal(allowed({ ...certificate, traineeId: "student-two" }), false);
  assert.equal(allowed({ ...certificate, courseId: "course-two" }), false);
});
