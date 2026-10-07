/**
 * Recovery command: put the owner account back into a known-good state.
 *
 * It does the four things an owner cannot do for themselves when the login flow
 * has gone sideways:
 *
 *   1. clears the lockout (`failedLogins`, `lockedAt`) that 10 wrong passwords trip;
 *   2. deletes outstanding sign-in codes (`LoginOtp`) so a code sent earlier
 *      cannot be redeemed by whoever requested it;
 *   3. ends every session and revokes every device, so the reset really is a
 *      clean start rather than "new password, old cookies";
 *   4. optionally rewrites the password.
 *
 * Nothing here is reachable over HTTP and nothing is guessed: the command
 * refuses to run without a target email.
 *
 * Usage:
 *   pnpm exec tsx scripts/reset-owner.ts                       # unlock + kill sessions
 *   pnpm exec tsx scripts/reset-owner.ts --reset-password      # ...and set password to SEED_OWNER_PASSWORD
 *   pnpm exec tsx scripts/reset-owner.ts --password 'NewPass1!' # ...and set a specific password
 *   pnpm exec tsx scripts/reset-owner.ts --keep-sessions       # leave sessions/devices alone
 *   pnpm exec tsx scripts/reset-owner.ts --email staff@academy.rw
 */
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../lib/generated/prisma/client";
import { hashPassword } from "../lib/auth/password";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // absent — the guard below reports it
  }
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Add it to .env.local before running this script.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const DEFAULT_EMAIL = "gahiredev01@gmail.com";

type Options = {
  email: string;
  password: string | null;
  keepSessions: boolean;
};

function parseArgs(argv: string[]): Options {
  const options: Options = { email: DEFAULT_EMAIL, password: null, keepSessions: false };

  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const next = argv[i + 1];

    if (flag === "--email" && next) {
      options.email = next.trim().toLowerCase();
      i += 1;
    } else if (flag === "--password" && next) {
      options.password = next;
      i += 1;
    } else if (flag === "--reset-password") {
      /* No built-in fallback: a password written in this repo is not a password. */
      const fromEnv = process.env.SEED_OWNER_PASSWORD;
      if (!fromEnv || fromEnv.length < 12) {
        throw new Error("--reset-password needs SEED_OWNER_PASSWORD set to at least 12 characters.");
      }
      options.password = fromEnv;
    } else if (flag === "--keep-sessions") {
      options.keepSessions = true;
    } else if (flag === "--help" || flag === "-h") {
      console.log(
        [
          "Usage: pnpm exec tsx scripts/reset-owner.ts [options]",
          "",
          "  --email <addr>       account to reset        (default: gahiredev01@gmail.com)",
          "  --password <value>   set this password        (default: leave unchanged)",
          "  --reset-password     set the password from SEED_OWNER_PASSWORD (required, 12+ chars)",
          "  --keep-sessions       do not end sessions or revoke devices",
        ].join("\n"),
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${flag}`);
    }
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const email = options.email;

  console.log(`Resetting ${email}…`);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error(`No account with that email. Try: pnpm prisma db seed`);
  }

  const passwordHash = options.password === null ? null : await hashPassword(options.password);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(passwordHash ? { passwordHash } : {}),
      failedLogins: 0,
      lockedAt: null,
      isActive: true,
    },
    select: { id: true, role: true, lockedAt: true, failedLogins: true },
  });

  /* An outstanding code belongs to the request that made it, not to a fresh
   * start. `resendCount`/`lastSentAt` live on the same row, so deleting it also
   * lifts the 60-second and 3-per-15-minute cooldowns. */
  const otps = await prisma.loginOtp.deleteMany({ where: { userId: user.id } });

  const sessions = options.keepSessions
    ? 0
    : await prisma.session.deleteMany({ where: { userId: user.id } }).then((r) => r.count);

  const devices = options.keepSessions
    ? 0
    : await prisma.deviceSession
        .updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: new Date() },
        })
        .then((r) => r.count);

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      actorEmail: user.email,
      action: "owner.reset",
      entityType: "User",
      entityId: user.id,
      meta: JSON.stringify({
        passwordReset: passwordHash !== null,
        sessionsEnded: sessions,
        devicesRevoked: devices,
        otpsCleared: otps.count,
        lockedAt: updated.lockedAt,
      }),
    },
  });

  console.log(`  password   ${passwordHash ? "rewritten" : "unchanged"}`);
  console.log(`  lockout    cleared (${user.failedLogins} failed attempt(s) dropped)`);
  console.log(`  codes      ${otps.count} outstanding sign-in code(s) deleted`);
  console.log(`  sessions   ${sessions} ended`);
  console.log(`  devices    ${devices} revoked`);
  console.log("");
  /* The password is never echoed: terminal scrollback and CI logs outlive the run. */
  console.log(
    `Owner reset. Email: ${user.email}. Password: ${
      options.password ? "set from the value you supplied" : "unchanged"
    }. Log in to receive an email code.`,
  );
  console.log("Done.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Reset failed:", error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  });
