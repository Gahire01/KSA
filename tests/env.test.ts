import assert from "node:assert/strict";
import { test } from "node:test";
import { assertEnv } from "../lib/env";

test("production startup accepts Gmail without the retired provider and still validates core secrets", () => {
  const original = { ...process.env };
  try {
    Object.assign(process.env, { NODE_ENV: "production" });
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
    process.env.SESSION_SECRET = "x".repeat(32);
    process.env.GMAIL_USER = "academy@example.com";
    process.env.GMAIL_APP_PASSWORD = "test-app-password";
    process.env.APP_URL = "https://ksa-rw.vercel.app";
    for (const key of ["RESEND_API_KEY", "EMAIL_FROM", "NEXT_PUBLIC_APP_URL", "CRON_SECRET", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_WHATSAPP_FROM"]) {
      delete process.env[key];
    }
    assert.equal(assertEnv()?.GMAIL_USER, "academy@example.com");
    process.env.SESSION_SECRET = "short";
    assert.throws(() => assertEnv(), /SESSION_SECRET must be at least 32 characters/);
    process.env.SESSION_SECRET = "x".repeat(32);
    delete process.env.DATABASE_URL;
    assert.throws(() => assertEnv(), /DATABASE_URL/);
  } finally {
    for (const key of Object.keys(process.env)) {
      if (!(key in original)) delete process.env[key];
    }
    Object.assign(process.env, original);
  }
});
