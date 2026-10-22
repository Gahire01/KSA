import assert from "node:assert/strict";
import { mock, test } from "node:test";
import nodemailer from "nodemailer";
import { sendEmail } from "../lib/email/send";
import { appUrl } from "../lib/app-url";
import { TEXT_FOOTER } from "../lib/email/footer";

test("SMTP delivery preserves message content and safely reports failures", async () => {
  const originalUser = process.env.GMAIL_USER;
  const originalPassword = process.env.GMAIL_APP_PASSWORD;
  const input = { to: "recipient@example.com", subject: "Test", html: "<p>123456</p>", text: "123456" };
  let outcome: "accepted" | "rejected" | "auth" | "timeout" = "accepted";
  const create = mock.method(nodemailer, "createTransport", (options: unknown) => {
    assert.equal((options as { host: string }).host, "smtp.gmail.com");
    assert.equal((options as { port: number }).port, 587);
    assert.equal((options as { secure: boolean }).secure, false);
    assert.equal((options as { requireTLS: boolean }).requireTLS, true);
    assert.deepEqual((options as { auth: unknown }).auth, { user: "sender@example.com", pass: "test-password" });
    return {
      async sendMail(message: Record<string, unknown>) {
        assert.equal(message.from, '"Kigali Safety Academy" <sender@example.com>');
        assert.equal(message.replyTo, "sender@example.com");
        assert.equal(message.to, input.to);
        assert.equal(message.html, input.html);
        assert.equal(message.text, input.text + TEXT_FOOTER);
        if (outcome === "auth" || outcome === "timeout") {
          throw Object.assign(new Error("secret test-password 123456"), {
            code: outcome === "auth" ? "EAUTH" : "ETIMEDOUT",
          });
        }
        return {
          accepted: outcome === "accepted" ? [input.to] : [],
          rejected: outcome === "rejected" ? [input.to] : [],
          messageId: "test-id",
        };
      },
    } as never;
  });
  try {
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
    assert.equal((await sendEmail(input)).ok, false);
    assert.equal(create.mock.callCount(), 0);
    process.env.GMAIL_USER = "sender@example.com";
    process.env.GMAIL_APP_PASSWORD = "test-password";
    assert.deepEqual(await sendEmail(input), { ok: true, id: "test-id" });
    outcome = "rejected";
    assert.equal((await sendEmail(input)).ok, false);
    outcome = "auth";
    assert.deepEqual(await sendEmail(input), { ok: false, reason: "Gmail SMTP authentication failed" });
    outcome = "timeout";
    assert.deepEqual(await sendEmail(input), { ok: false, reason: "Gmail SMTP connection timed out" });
    assert.equal(create.mock.callCount(), 1);
  } finally {
    create.mock.restore();
    if (originalUser === undefined) delete process.env.GMAIL_USER;
    else process.env.GMAIL_USER = originalUser;
    if (originalPassword === undefined) delete process.env.GMAIL_APP_PASSWORD;
    else process.env.GMAIL_APP_PASSWORD = originalPassword;
  }
});

test("links use configured origins and never default to localhost", () => {
  const publicUrl = process.env.NEXT_PUBLIC_APP_URL;
  const serverUrl = process.env.APP_URL;
  try {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.APP_URL;
    assert.equal(appUrl("/verify/token"), "https://ksa-rw.vercel.app/verify/token");
    process.env.APP_URL = "https://server.example/";
    assert.equal(appUrl("/exam/token"), "https://server.example/exam/token");
    process.env.NEXT_PUBLIC_APP_URL = "https://public.example///";
    assert.equal(appUrl("/logo.png"), "https://public.example/logo.png");
  } finally {
    if (publicUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = publicUrl;
    if (serverUrl === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = serverUrl;
  }
});
