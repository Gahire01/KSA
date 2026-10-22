import assert from "node:assert/strict";
import { test } from "node:test";

import { examStartedEmail, examSubmittedEmail, formatKigaliTime } from "../lib/email/templates";
import { EXAM_QUESTION_COUNT, buildExamManifest } from "../lib/exams/manifest";
import { templateFilenameFor, templateGeometry } from "../lib/certificates/template-layout";

const bank = Array.from({ length: 30 }, (_, i) => ({
  id: `q${i}`,
  options: ["a", "b", "c", "d"].map((o) => ({ id: `q${i}${o}` })),
}));

test("an exam serves exactly 15 of the 30 questions, each with every option shuffled", () => {
  const manifest = buildExamManifest("course", bank, "token-one");
  assert.equal(EXAM_QUESTION_COUNT, 15);
  assert.equal(manifest.questionIds.length, 15);
  assert.equal(new Set(manifest.questionIds).size, 15);
  assert.deepEqual(manifest.questionIds, manifest.questions.map((q) => q.questionId));
  for (const q of manifest.questions) {
    assert.deepEqual([...q.optionIds].sort(), [`${q.questionId}a`, `${q.questionId}b`, `${q.questionId}c`, `${q.questionId}d`]);
  }
});

test("different tokens get different subsets, and one token always gets the same paper", () => {
  const subsets = new Set<string>();
  for (let i = 0; i < 20; i += 1) {
    subsets.add([...buildExamManifest("course", bank, `token-${i}`).questionIds].sort().join(","));
  }
  assert.ok(subsets.size > 10, `expected varied subsets, got ${subsets.size}`);
  assert.deepEqual(buildExamManifest("course", bank, "same"), buildExamManifest("course", bank, "same"));
});

test("a bank smaller than the slice is served whole", () => {
  assert.equal(buildExamManifest("course", bank.slice(0, 9), "token").questionIds.length, 9);
});

test("owner exam alerts carry name, course, score, result and Rwanda time, and no links", () => {
  /* 12:35 UTC is 14:35 in Kigali (CAT, UTC+2). */
  const at = new Date("2026-10-22T12:35:00Z");
  assert.equal(formatKigaliTime(at), "22 Oct 2026, 14:35 CAT");

  const started = examStartedEmail({ traineeName: "Umukundwa Evelyne", courseName: "First Aid", startedAt: at });
  const passed = examSubmittedEmail({ traineeName: "Umukundwa Evelyne", courseName: "First Aid", scorePct: 80, passed: true, submittedAt: at });
  const failed = examSubmittedEmail({ traineeName: "Umukundwa Evelyne", courseName: "First Aid", scorePct: 40, passed: false, submittedAt: at });

  for (const mail of [started, passed, failed]) {
    assert.match(mail.html, /Umukundwa Evelyne/);
    assert.match(mail.html, /First Aid/);
    assert.match(mail.html, /14:35 CAT/);
    assert.match(mail.text, /14:35 CAT/);
    assert.doesNotMatch(mail.html, /<a /i);
  }
  assert.match(passed.html, /80%/);
  assert.match(passed.html, />Passed</);
  assert.match(failed.html, />Not passed</);
});

test("the preview reads the same template and positions the PDF stamp uses", () => {
  assert.equal(templateFilenameFor("FIRE-FIGHTING", "anything"), "Fire Fighting.pdf");
  assert.equal(templateFilenameFor("X", "First Aid Basics"), "First Aid.pdf");
  assert.equal(templateFilenameFor("X", "Forklift Operation"), null);

  const g = templateGeometry(842.16, 612);
  assert.equal(g.fields.length, 3);
  assert.ok(Math.abs(g.signature.lineY - 612 * 0.17) < 1e-9);
});
