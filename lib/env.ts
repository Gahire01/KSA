import { z } from "zod";

/**
 * Typed, validated view of the server environment.
 *
 * `assertEnv()` is called once at server start (instrumentation.ts). In
 * production a missing or malformed required variable stops the server with a
 * readable message instead of failing later on the first request that needs it.
 * Outside production it only warns, so a bare local checkout still boots.
 *
 * Optional integrations (Twilio WhatsApp) are validated as a group: either all
 * three values are present or none are.
 */
const base = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required"),
  EMAIL_FROM: z.string().min(3, "EMAIL_FROM is required"),
  APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  CRON_SECRET: z.string().min(16).optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),
});

const schema = base
  .refine((e) => e.APP_URL || e.NEXT_PUBLIC_APP_URL, {
    message: "Set APP_URL or NEXT_PUBLIC_APP_URL (used for exam links and the email logo)",
    path: ["APP_URL"],
  })
  .refine(
    (e) => {
      const set = [e.TWILIO_ACCOUNT_SID, e.TWILIO_AUTH_TOKEN, e.TWILIO_WHATSAPP_FROM].filter(Boolean).length;
      return set === 0 || set === 3;
    },
    {
      message: "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_WHATSAPP_FROM must be set together",
      path: ["TWILIO_ACCOUNT_SID"],
    },
  );

export type ServerEnv = z.infer<typeof base>;

/** Treat empty strings as unset so `FOO=` in a dashboard behaves like a missing key. */
function readEnv(): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const key of Object.keys(base.shape)) {
    const v = process.env[key];
    out[key] = v === undefined || v.trim() === "" ? undefined : v;
  }
  return out;
}

export function assertEnv(): ServerEnv | null {
  const parsed = schema.safeParse(readEnv());
  if (parsed.success) return parsed.data;

  const lines = parsed.error.issues.map((i) => `  - ${i.path.join(".") || "env"}: ${i.message}`);
  const message = `Invalid server environment:\n${lines.join("\n")}`;
  if (process.env.NODE_ENV === "production") throw new Error(message);
  console.warn(message);
  return null;
}
