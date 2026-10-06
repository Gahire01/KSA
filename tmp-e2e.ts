/**
 * End-to-end smoke test against a running server.
 *
 * Exercises the full Phase 1 flow with a real session cookie:
 *   health -> login -> TOTP enrol -> TOTP verify -> course CRUD -> trainee CRUD
 *
 * Run with: npx tsx tmp-e2e.ts [baseUrl]
 */
import { generate } from "otplib";
import { readFileSync } from "node:fs";

import { hashSecret } from "@/lib/auth/password";

const BASE = process.argv[2] ?? "http://127.0.0.1:3000";

const PERIOD_SECONDS = 30;

/**
 * The server rejects a TOTP it has already seen (replay protection), so the test
 * cannot reuse a counter. Each call hands back a code for a time step strictly
 * greater than every code generated before, waiting for the tick if needed.
 */
let highestStepUsed = 0;

async function freshTotp(secret: string): Promise<string> {
  for (;;) {
    const step = Math.floor(Date.now() / 1000 / PERIOD_SECONDS);

    if (step > highestStepUsed) {
      highestStepUsed = step;
      return generate({ secret });
    }

    await new Promise((r) => setTimeout(r, (step + 1 - highestStepUsed) * PERIOD_SECONDS * 1000 + 250));
  }
}

/** otplib v13 has no `authenticator.parseKey`, so read the secret off the URI. */
function secretFromOtpAuthUrl(uri: string): string {
  const secret = new URL(uri).searchParams.get("secret");
  if (!secret) throw new Error(`No secret in otpauth URI: ${uri.slice(0, 60)}…`);
  return secret;
}

/**
 * Two independent cookie jars. `owner` is the staff browser; `trainee` is an
 * anonymous visitor holding only the exam cookie the server issued. Keeping them
 * apart is the whole point of the exam flow: the paper must work with no staff
 * session anywhere.
 */
const jars: Record<string, string> = { owner: "", trainee: "", anon: "", device: "" };
let failures = 0;
let checks = 0;

function check(label: string, ok: boolean, detail = "") {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` :: ${detail}` : ""}`);
}

/**
 * This harness is throwaway: it exists only to prove the running server behaves,
 * and it is deleted once Phase 1 is verified. Every check walks the response
 * shape dynamically, so the bodies are deliberately untyped here rather than
 * duplicating the API contract inside the test that verifies it.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = Record<string, any>;

async function call(
  method: string,
  path: string,
  body?: unknown,
  jar: "owner" | "trainee" | "anon" = "owner",
): Promise<{ status: number; json: Json; headers: Headers }> {
  const cookies = [
    ...(jar !== "anon" && jars[jar] ? [jars[jar]] : []),
    ...(jar === "owner" && jars.device ? [jars.device] : []),
  ];
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookies.length ? { Cookie: cookies.join("; ") } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });

  for (const c of res.headers.getSetCookie?.() ?? []) {
    const pair = c.split(";")[0];
    /* Only the jar this request was made with may absorb the returned session.
     * Otherwise a redeem-as-anon would silently replace the owner's cookie and
     * every later owner assertion would be running as somebody else. */
    if (pair.startsWith("ksa_session=")) {
      if (jar === "owner") jars.owner = pair;
    } else if (pair.startsWith("ksa_device=")) {
      if (jar === "owner") jars.device = pair;
    } else if (pair.startsWith("exam_session_")) {
      if (jar === "trainee") jars.trainee = pair;
    }
  }

  const text = await res.text();
  let json: Json;
  try {
    json = JSON.parse(text) as Json;
  } catch {
    json = { raw: text.slice(0, 120) };
  }
  return { status: res.status, json, headers: res.headers };
}

/*
 * Direct database probes. Some guarantees are only observable in the schema —
 * "the stored OTP is argon2id, not plaintext" has no HTTP response to assert.
 * Reuses the app's configured client so the driver adapter and `.env.local`
 * loading stay in one place.
 */
import { prisma } from "@/lib/db";

async function dbOne<T = Json>(sql: string): Promise<T | null> {
  const rows = await prisma.$queryRawUnsafe<Json[]>(sql);
  return (rows[0] as T) ?? null;
}

async function dbCount(sql: string): Promise<number> {
  const row = await dbOne<{ n: number }>(sql);
  return Number(row?.n ?? 0);
}

/**
 * The emailed code exists only inside the email, so the harness cannot read it
 * back. Instead it re-hashes a code it chose and swaps it in, which still drives
 * the route's real argon2id verification path with a real hash. That the emailed
 * body carries that same code is asserted separately, by checking the send route
 * derives both the hash and the email from one variable.
 */
async function setKnownOtp(attemptId: string, code: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    'UPDATE "ExamAttempt" SET "otpHash" = $1 WHERE id = $2',
    await hashSecret(code),
    attemptId,
  );
}

/** The TOTP secret captured in section 7, needed again after a re-login. */
let PERSIST_SECRET = "";

const PASSWORD = process.env.SEED_OWNER_PASSWORD ?? "ChangeMe123!";

/** Unique per run so a re-run never collides with the previous run's rows. */
const RUN = Date.now().toString(36).toUpperCase().slice(-5);

/** Every row this run inserts into Notification is older than this, so cleanup
 * can delete exactly what the run produced and nothing else. */
const RUN_STARTED_AT = new Date();

/**
 * The harness enrols a fresh TOTP secret on every run, because section 15 burns
 * the owner's rate-limit buckets and the previous run left TOTP enabled. Clearing
 * it here keeps the suite self-contained and re-runnable against a live database.
 *
 * Prior fixtures are removed too. Without this, each run leaves another trainee
 * and course behind, and the exam recipient eventually collides on its own email.
 */
async function resetFixtures() {
  const owner = await prisma.user.findFirst({ where: { email: "gahiredev01@gmail.com" } });
  if (!owner) throw new Error("Owner account gahiredev01@gmail.com not found — run the seed first.");

  const staleCourses = await prisma.course.findMany({
    where: { code: { startsWith: "E2E" } },
    select: { id: true },
  });
  const staleIds = staleCourses.map((c) => c.id);

  const [trainees, attempts, certs] = await Promise.all([
    prisma.trainee.deleteMany({
      where: { OR: [{ email: { endsWith: "@example.com" } }, { email: owner.email }] },
    }),
    prisma.examAttempt.deleteMany({ where: { courseId: { in: staleIds } } }),
    prisma.certificate.deleteMany({ where: { courseId: { in: staleIds } } }),
  ]);

  if (staleIds.length > 0) {
    await prisma.question.deleteMany({ where: { courseId: { in: staleIds } } });
    await prisma.course.deleteMany({ where: { id: { in: staleIds } } });
  }

  await prisma.$transaction([
    prisma.recoveryCode.deleteMany({ where: { userId: owner.id } }),
    prisma.user.update({
      where: { id: owner.id },
      data: { totpSecret: null, totpEnabled: false, totpCounter: 0 },
    }),
  ]);

  console.log(
    `fixtures reset: ${trainees.count} trainees, ${attempts.count} attempts, ` +
    `${certs.count} certificates, ${staleIds.length} courses`,
  );
}

async function main() {
  console.log(`\nTarget: ${BASE}  (run ${RUN})\n`);

  await resetFixtures();

  /* 1. health ------------------------------------------------------------ */
  const health = await call("GET", "/api/health");
  check("health returns ok/db", health.json?.ok === true && health.json?.db === "ok",
    JSON.stringify(health.json));

  /* 2. protected routes reject anonymous callers -------------------------- */
  const anon = await call("GET", "/api/courses");
  check("anonymous /api/courses is 401", anon.status === 401, `got ${anon.status}`);

  const anonTrainees = await call("GET", "/api/trainees");
  check("anonymous /api/trainees is 401", anonTrainees.status === 401, `got ${anonTrainees.status}`);

  /* Every other gated route must also refuse an anonymous caller.
   *
   * `/api/auth/me` and `/api/auth/logout` are deliberately not in this list: the
   * first is a hydration endpoint that reports `user: null` at 200 by design, and
   * the second is an idempotent sign-out. Gating them would break the client. */
  const protectedRoutes: Array<[string, string]> = [
    ["GET", "/api/categories"],
    ["GET", "/api/courses/e2e-1"],
    ["GET", "/api/trainees/e2e-1"],
    ["PATCH", "/api/courses/e2e-1"],
    ["PATCH", "/api/trainees/e2e-1"],
    ["DELETE", "/api/courses/e2e-1"],
    ["POST", "/api/auth/mfa/setup"],
    ["POST", "/api/auth/mfa/confirm"],
    ["POST", "/api/auth/mfa/verify"],
  ];

  const leaked: string[] = [];
  for (const [method, path] of protectedRoutes) {
    const res = await call(method, path, method === "GET" ? undefined : { code: "000000" });
    if (res.status === 200 || res.status === 201) leaked.push(`${method} ${path} -> ${res.status}`);
  }
  check(`all ${protectedRoutes.length} gated routes refuse anonymous callers`, leaked.length === 0,
    leaked.join(", "));

  /* `/api/auth/me` is a hydration endpoint, so 200 with a null user is correct —
   * but it must still not describe anybody. */
  const anonMe = await call("GET", "/api/auth/me");
  check("/api/auth/me answers 200 with no user when signed out",
    anonMe.status === 200 && anonMe.json?.data?.user === null && !anonMe.json?.data?.mfaPassed,
    JSON.stringify(anonMe.json?.data));

  /* Signing out when already signed out must be a harmless no-op. */
  const anonLogout = await call("POST", "/api/auth/logout");
  check("/api/auth/logout is idempotent for an anonymous caller", anonLogout.status === 200,
    `got ${anonLogout.status}`);

  /* 3. server-rendered page guard ---------------------------------------- */
  /* In dev, Next streams the root layout before the nested guard runs, so the
   * redirect arrives as a 200 carrying an inline NEXT_REDIRECT rather than a 307.
   * What matters is that no authenticated data rides along with it. */
  const page = await fetch(`${BASE}/dashboard`, { redirect: "manual" });
  const loc = page.headers.get("location") ?? "";
  const html = await page.text();
  const isRedirect = page.status === 307 || page.status === 302
    ? loc.includes("/login")
    : page.status === 200 && html.includes("NEXT_REDIRECT");
  check("/dashboard is gated when signed out", isRedirect,
    `${page.status} ${loc || (html.includes("NEXT_REDIRECT") ? "NEXT_REDIRECT in body" : "no redirect")}`);
  check("the gated /dashboard response leaks no session identity",
    !/gahiredev01|ksa_session=[A-Za-z0-9_-]{10,}/.test(html),
    "clean");

  /* 4. bad password is rejected ------------------------------------------ */
  const bad = await call("POST", "/api/auth/login", {
    email: "gahiredev01@gmail.com",
    password: "definitely-not-the-password",
  });
  check("wrong password is 401", bad.status === 401, `got ${bad.status}`);

  /* An unknown address must be indistinguishable from a wrong password, so the
   * route cannot be used to enumerate which emails have accounts. Uses its own
   * rate-limit bucket, so it does not eat the real account's budget. */
  const ghost = await call("POST", "/api/auth/login", {
    email: "nobody-here@example.com",
    password: "definitely-not-the-password",
  });
  check("unknown email gives the same 401 message as a wrong password",
    ghost.status === bad.status && ghost.json?.error === bad.json?.error,
    `unknown=${ghost.json?.error}`);

  /* 5. real password issues a session ------------------------------------ */
  const login = await call("POST", "/api/auth/login", {
    email: "gahiredev01@gmail.com",
    password: PASSWORD,
  });
  check("owner login succeeds", login.status === 200, JSON.stringify(login.json));
  check("login reports mfa-setup first", login.json?.data?.nextStep === "mfa-setup",
    login.json?.data?.nextStep);
  check("session cookie was set", jars.owner.startsWith("ksa_session="));

  /* The cookie is the only credential, so it must be unreadable from script and
   * pinned to this origin; HTTPS-only in production. */
  const sessionCookie = (login.headers.getSetCookie?.() ?? [])
    .find((c) => c.startsWith("ksa_session=")) ?? "";
  check("session cookie is HttpOnly", /HttpOnly/i.test(sessionCookie));
  check("session cookie is SameSite=Lax", /SameSite=Lax/i.test(sessionCookie));
  check("session cookie sets a bounded Max-Age", /Max-Age=\d{4,}/.test(sessionCookie),
    sessionCookie.split(";")[2] ?? "no Max-Age");

  /* No credential material may travel back to the browser. */
  const loginBody = JSON.stringify(login.json);
  check("login response leaks no password hash or TOTP secret",
    !/passwordHash|totpSecret|argon2id|postgresql:\/\//.test(loginBody));

  /* Success must not spend the failure budget. The per-account limit is 5, so if
   * check-and-increment ran before the password was even tested, the sixth
   * correct sign-in would 429 — which behind one office NAT means the fifth
   * colleague locks the building out. */
  const successes: number[] = [];
  for (let i = 0; i < 7; i += 1) {
    const again = await call("POST", "/api/auth/login", {
      email: "gahiredev01@gmail.com",
      password: PASSWORD,
    });
    successes.push(again.status);
  }
  check("repeated correct sign-ins are never rate limited",
    successes.every((s) => s === 200), successes.join(","));
  check("the owner session still works after those sign-ins",
    (await call("GET", "/api/auth/me")).json?.data?.user?.role === "OWNER");

  /* Failures still spend: one wrong password after that run must not slip past. */
  const wrongAfter = await call("POST", "/api/auth/login", {
    email: "gahiredev01@gmail.com",
    password: "definitely-not-the-password",
  });
  check("a wrong password is still rejected", wrongAfter.status === 401,
    `got ${wrongAfter.status}`);

  /* Security headers apply to page responses too, not just the API. */
  const loginPage = await fetch(`${BASE}/login`, { redirect: "manual" });
  const h = (name: string) => loginPage.headers.get(name) ?? "";
  check("HSTS header present", /max-age=\d+/.test(h("strict-transport-security")),
    h("strict-transport-security") || "missing");
  check("X-Content-Type-Options: nosniff", h("x-content-type-options") === "nosniff",
    h("x-content-type-options") || "missing");
  check("X-Frame-Options: DENY", h("x-frame-options") === "DENY", h("x-frame-options") || "missing");
  check("Referrer-Policy present", h("referrer-policy").length > 0, h("referrer-policy") || "missing");
  check("Permissions-Policy present", h("permissions-policy").length > 0, h("permissions-policy") || "missing");
  check("Content-Security-Policy present", h("content-security-policy").includes("default-src"),
    h("content-security-policy").slice(0, 60) || "missing");
  /* Failures carry a correlation id so a user can quote it and the operator can
   * find the full server-side log line behind it. */
  const requestId = bad.headers.get("x-request-id") ?? "";
  check("failures carry an X-Request-Id", requestId.length > 0, requestId || "missing");
  check("failure body exposes the same id and no stack trace",
    bad.json?.ok === false && typeof bad.json?.error === "string" &&
    bad.json?.requestId === requestId &&
    !/at\s+\w+\s+\(|node_modules|prisma/i.test(JSON.stringify(bad.json)),
    JSON.stringify(bad.json));

  /* 6. session alone does not unlock data -------------------------------- */
  const preMfa = await call("GET", "/api/courses");
  check("courses blocked before MFA (403)", preMfa.status === 403, `got ${preMfa.status}`);

  /* 7. enrol the authenticator ------------------------------------------- */
  const setup = await call("POST", "/api/auth/mfa/setup");
  check("mfa/setup returns a secret + QR", setup.status === 200 &&
    typeof setup.json?.data?.otpauthUrl === "string" &&
    typeof setup.json?.data?.qrDataUrl === "string",
    `status ${setup.status}`);
  check("QR is a data: image", String(setup.json?.data?.qrDataUrl ?? "").startsWith("data:image/"));

  const secret = secretFromOtpAuthUrl(setup.json.data.otpauthUrl);
  PERSIST_SECRET = secret;

  const confirm = await call("POST", "/api/auth/mfa/confirm", {
    code: await freshTotp(secret),
  });
  check("mfa/confirm enables TOTP", confirm.status === 200, JSON.stringify(confirm.json));
  const codes: string[] = confirm.json?.data?.recoveryCodes ?? [];
  check("confirm returns 10 recovery codes", codes.length === 10, `got ${codes.length}`);

  /* 8. confirm granted a fully unlocked session -------------------------- */
  const postMfa = await call("GET", "/api/courses");
  check("courses readable after MFA", postMfa.status === 200, `got ${postMfa.status}`);

  const seeded = postMfa.json?.data?.items ?? [];
  check("seeded courses are present", seeded.length >= 8, `got ${seeded.length}`);
  check("seeded course carries enrolledCount",
    typeof seeded[0]?._count?.trainees === "number");
  check("seeded course carries category name",
    typeof seeded[0]?.category?.name === "string", seeded[0]?.category?.name);

  /* 9. categories ------------------------------------------------------- */
  const cats = await call("GET", "/api/categories");
  check("categories returns 6", (cats.json?.data?.length ?? 0) === 6,
    `got ${cats.json?.data?.length}`);

  /* 10. course CRUD ----------------------------------------------------- */
  const madeCourse = await call("POST", "/api/courses", {
    code: `E2E${RUN}`,
    name: "End To End Safety Course",
    categoryId: cats.json.data[0].id,
    description: "Created by the automated smoke test to prove writes persist.",
    topics: ["Smoke", "Testing"],
    durationValue: 2,
    durationUnit: "DAY",
    priceRwf: 99000,
    passMarkPct: 60,
    maxAttempts: 3,
    validityMonths: 12,
    examDurationMin: 30,
    trainerId: "trainer-e2e-1",
    isActive: true,
  });
  check("course created", madeCourse.status === 201, JSON.stringify(madeCourse.json));
  const courseId: string = madeCourse.json?.data?.id;
  check("trainerId round-trips", madeCourse.json?.data?.trainerId === "trainer-e2e-1",
    madeCourse.json?.data?.trainerId);

  const dupCode = await call("POST", "/api/courses", {
    code: `E2E${RUN}`,
    name: "Duplicate Code Attempt",
    categoryId: cats.json.data[0].id,
    description: "This should be rejected because the course code is taken.",
    durationValue: 1,
    durationUnit: "DAY",
    priceRwf: 1000,
  });
  check("duplicate course code is 409", dupCode.status === 409, `got ${dupCode.status}`);

  const patched = await call("PATCH", `/api/courses/${courseId}`, { priceRwf: 111000, isActive: false });
  check("course updated", patched.status === 200 &&
    patched.json?.data?.priceRwf === 111000 &&
    patched.json?.data?.isActive === false,
    JSON.stringify(patched.json?.data));

  /* 11. trainee CRUD ---------------------------------------------------- */
  const madeTrainee = await call("POST", "/api/trainees", {
    fullName: "Aline Umutoni",
    email: `aline.umutoni.${RUN.toLowerCase()}@example.com`,
    phone: "+250788123456",
    countryCode: "rwanda",
    categoryId: cats.json.data[0].id,
    courseId,
    amountPaidRwf: 50000,
    notes: "Created by the automated smoke test.",
  });
  check("trainee created", madeTrainee.status === 201, JSON.stringify(madeTrainee.json));
  const traineeId: string = madeTrainee.json?.data?.id;
  check("traineeNo allocated", /^KSA-\d{4}$/.test(madeTrainee.json?.data?.traineeNo ?? ""),
    madeTrainee.json?.data?.traineeNo);
  check("countryCode normalised to Title Case",
    madeTrainee.json?.data?.countryCode === "Rwanda", madeTrainee.json?.data?.countryCode);
  check("course relation included",
    madeTrainee.json?.data?.course?.id === courseId);

  const dupEmail = await call("POST", "/api/trainees", {
    fullName: "Aline Again",
    email: `aline.umutoni.${RUN.toLowerCase()}@example.com`,
    phone: "+250788999999",
    countryCode: "Rwanda",
    categoryId: cats.json.data[0].id,
  });
  check("duplicate trainee email is 409", dupEmail.status === 409, `got ${dupEmail.status}`);

  const list = await call("GET", "/api/trainees?pageSize=10");
  check("trainee list returns the new row",
    (list.json?.data?.items ?? []).some((t: Json) => t.id === traineeId),
    `total ${list.json?.data?.total}`);
  check("list row includes course name for the UI",
    (list.json?.data?.items ?? [])[0]?.course?.name === "End To End Safety Course");

  /* multi-value filters (the roster uses multi-selects) */
  const filtered = await call(
    "GET",
    `/api/trainees?status=${"ACTIVE,PENDING"}&categoryId=${cats.json.data[0].id}&pageSize=10`,
  );
  check("CSV multi-value filters accepted", filtered.status === 200, `got ${filtered.status}`);

  const searched = await call("GET", "/api/trainees?search=Umutoni");
  check("search by name works", searched.status === 200 && (searched.json?.data?.total ?? 0) >= 1,
    `total ${searched.json?.data?.total}`);

  const byNo = await call("GET", `/api/trainees?search=${madeTrainee.json.data.traineeNo}`);
  check("search by traineeNo works", (byNo.json?.data?.total ?? 0) === 1,
    `total ${byNo.json?.data?.total}`);
  const updatedTrainee = await call("PATCH", `/api/trainees/${traineeId}`, {
    amountPaidRwf: 111000,
    status: "ACTIVE",
    notes: "Fully paid after the smoke test.",
  });
  check("trainee updated",
    updatedTrainee.status === 200 &&
    updatedTrainee.json?.data?.amountPaidRwf === 111000 &&
    updatedTrainee.json?.data?.status === "ACTIVE",
    JSON.stringify(updatedTrainee.json?.data));

  /* 12. validation rejects junk ----------------------------------------- */
  const junk = await call("POST", "/api/trainees", {
    fullName: "x",
    email: "not-an-email",
    phone: "abc",
    countryCode: "R",
    categoryId: "nope",
  });
  check("invalid trainee payload is 422", junk.status === 422, `got ${junk.status}`);

  /* An oversized pageSize must be refused, not silently clamped, so a caller
   * cannot believe it has the whole table. */
  const tooBig = await call("GET", "/api/trainees?pageSize=500");
  check("pageSize above the cap is 422", tooBig.status === 422, `got ${tooBig.status}`);

  const unknownId = await call("GET", "/api/trainees/does-not-exist");
  check("unknown trainee is 404", unknownId.status === 404, `got ${unknownId.status}`);

  /* 13. recovery code is single use ------------------------------------- */
  const me = await call("GET", "/api/auth/me");
  check("/api/auth/me resolves the session",
    me.status === 200 && me.json?.data?.user?.email === "gahiredev01@gmail.com",
    JSON.stringify(me.json?.data?.user));

  await call("POST", "/api/auth/logout");
  const recoveryLogin = await call("POST", "/api/auth/login", {
    email: "gahiredev01@gmail.com",
    password: PASSWORD,
  });
  check("second login now asks for verify",
    recoveryLogin.json?.data?.nextStep === "mfa-verify",
    recoveryLogin.json?.data?.nextStep);

  const recoveryUse = await call("POST", "/api/auth/mfa/verify", { code: codes[0] });
  check("recovery code signs in", recoveryUse.status === 200, JSON.stringify(recoveryUse.json));
  check("recovery login is flagged via=recovery",
    recoveryUse.json?.data?.via === "recovery", recoveryUse.json?.data?.via);

  await call("POST", "/api/auth/logout");
  const relogin = await call("POST", "/api/auth/login", {
    email: "gahiredev01@gmail.com",
    password: PASSWORD,
  });
  const reuse = await call("POST", "/api/auth/mfa/verify", { code: codes[0] });
  check("the same recovery code cannot be reused", reuse.status === 401, `got ${reuse.status}`);

  const totp = await call("POST", "/api/auth/mfa/verify", { code: await freshTotp(secret) });
  check("TOTP still works after a recovery login", totp.status === 200,
    JSON.stringify(totp.json));
  void relogin;

  /* 14. a TOTP code is single use ---------------------------------------- */
  /* Same code, second session, second attempt: the stored counter must refuse it
   * even though the 30-second window has not moved on.
   *
   * Each probe needs its own *pending* session. Once a session has mfaPassed, the
   * route short-circuits at the top and never reaches the counter or the limiter,
   * so reusing the session that already verified would silently pass everything. */
  const replaySecret = secret;
  const replayCode = await freshTotp(replaySecret);

  await call("POST", "/api/auth/logout");
  await call("POST", "/api/auth/login", {
    email: "gahiredev01@gmail.com",
    password: PASSWORD,
  });
  const firstUse = await call("POST", "/api/auth/mfa/verify", { code: replayCode });
  check("fresh TOTP accepted", firstUse.status === 200 &&
    firstUse.json?.data?.via === "totp",
    JSON.stringify(firstUse.json?.data));

  await call("POST", "/api/auth/logout");
  const replayLogin = await call("POST", "/api/auth/login", {
    email: "gahiredev01@gmail.com",
    password: PASSWORD,
  });
  check("replay probe reached the MFA step",
    replayLogin.json?.data?.nextStep === "mfa-verify", replayLogin.json?.data?.nextStep);

  const replayed = await call("POST", "/api/auth/mfa/verify", { code: replayCode });
  check("the same TOTP code cannot be replayed", replayed.status === 401,
    `got ${replayed.status}`);

  /* 15. MFA guessing is rate limited per session -------------------------- */
  /* Five guesses are allowed; the sixth must come back 429 with a Retry-After
   * so the client knows when to come back. Runs last because it burns the
   * session's bucket. The session is still pending here, so the limiter is
   * actually reached. */
  check("the probe session is still pending MFA",
    (await call("GET", "/api/courses")).status === 403,
    "courses blocked before MFA");

  let limited: { status: number; retryAfter: string | null } | null = null;
  for (let i = 0; i < 7 && !limited; i += 1) {
    const guess = await call("POST", "/api/auth/mfa/verify", { code: "000000" });
    if (guess.status === 429) {
      limited = { status: guess.status, retryAfter: guess.headers.get("retry-after") };
    }
  }
  check("MFA brute force is rate limited with 429", limited?.status === 429,
    `got ${limited?.status}`);
  check("429 carries Retry-After", Number(limited?.retryAfter ?? 0) > 0,
    `Retry-After: ${limited?.retryAfter}`);

  const stillLimited = await call("POST", "/api/auth/mfa/verify", { code: "000000" });
  check("the limit holds on the next attempt", stillLimited.status === 429,
    `got ${stillLimited.status}`);

  /* 14. persistence markers for the restart test ------------------------ */
  console.log(`\nPERSIST_COURSE_ID=${courseId}`);
  console.log(`PERSIST_TRAINEE_ID=${traineeId}`);
  console.log(`PERSIST_SECRET=${secret}`);

  await runExamSuite({ courseId, traineeId, categoryId: cats.json.data[0].id });

  console.log(`\n${checks - failures}/${checks} checks passed.`);
  if (failures > 0) {
    console.log(`${failures} FAILURES`);
    process.exit(1);
  }
}

/**
 * The exam-link OTP flow, and everything hanging off it.
 *
 * The trainee's browser is a *separate* cookie jar from the owner's, which is the
 * point: an exam must be completable with no staff session at all.
 */
async function runExamSuite(seed: { courseId: string; traineeId: string; categoryId: string }) {
  /* A clean sign-in: the MFA bucket was burned by section 15. */
  await call("POST", "/api/auth/logout");
  const ownerLogin = await call("POST", "/api/auth/login", {
    email: "gahiredev01@gmail.com",
    password: PASSWORD,
  });
  check("owner re-login reaches MFA step", ownerLogin.json?.data?.nextStep === "mfa-verify",
    ownerLogin.json?.data?.nextStep);
  const totp2 = await call("POST", "/api/auth/mfa/verify", { code: await freshTotp(PERSIST_SECRET) });
  check("owner session restored for the exam suite", totp2.status === 200,
    JSON.stringify(totp2.json?.data?.nextStep));

  /* Build a course with a known answer key: 4 questions, 2 with the answer "A". */
  const questionTexts = [
    "Which extinguisher suits a Class B fire?",
    "What does a blue helmet denote on site?",
    "How often should a scaffold be inspected?",
    "What is the first action on discovering a fire?",
  ];

  for (let i = 0; i < questionTexts.length; i += 1) {
    const created = await call("POST", "/api/questions", {
      courseId: seed.courseId,
      text: questionTexts[i],
      options: [
        { text: `Correct answer for Q${i + 1}`, isCorrect: true },
        { text: `Distractor A for Q${i + 1}`, isCorrect: false },
        { text: `Distractor B for Q${i + 1}`, isCorrect: false },
      ],
    });
    check(`question ${i + 1} created`, created.status === 201, JSON.stringify(created.json).slice(0, 160));
  }

  const bank = await call("GET", `/api/questions?courseId=${seed.courseId}`);
  const bankItems = bank.json?.data?.items ?? [];
  check("question bank returns 4 questions for the course", bankItems.length === 4,
    `got ${bankItems.length}`);
  check("staff view exposes isCorrect so a paper can be set",
    bankItems[0]?.options?.some((o: Json) => o.isCorrect === true));

  const badQuestion = await call("POST", "/api/questions", {
    courseId: seed.courseId,
    text: "Two right answers is invalid",
    options: [
      { text: "A", isCorrect: true },
      { text: "B", isCorrect: true },
    ],
  });
  check("a question with two correct options is rejected", badQuestion.status === 422,
    `got ${badQuestion.status}`);

  /* ── send ───────────────────────────────────────────────────────────── */
  const noTrainees = await call("POST", `/api/exams/${seed.courseId}/send`, { traineeIds: [] });
  check("sending to an empty selection is 422", noTrainees.status === 422, `got ${noTrainees.status}`);

  /* An anonymous caller must be refused, so this uses the untouched jar. */
  const anonSend = await call("POST", `/api/exams/${seed.courseId}/send`,
    { traineeIds: [seed.traineeId] }, "anon");
  check("an anonymous caller cannot send an exam", anonSend.status === 401,
    `got ${anonSend.status}`);

  /* Section 10 deactivated the course to prove the flag round-trips; exams may
   * only be sent for an active course, so switch it back on first. */
  const reactivated = await call("PATCH", `/api/courses/${seed.courseId}`, { isActive: true });
  check("course reactivated before sending", reactivated.status === 200 &&
    reactivated.json?.data?.isActive === true,
    `got ${reactivated.status}`);

  /* The CRUD trainee was created on example.com, which Resend refuses as a
   * recipient domain (422). Resend's sandbox sender only accepts the account
   * owner's exact address — not plus-addressed variants — so the recipient is the
   * owner's own inbox for this run. */
  const deliverTo = "gahiredev01@gmail.com";
  const reMailed = await call("PATCH", `/api/trainees/${seed.traineeId}`, { email: deliverTo });
  check("trainee email switched to a deliverable address",
    reMailed.status === 200 && reMailed.json?.data?.email === deliverTo,
    `got ${reMailed.status} ${reMailed.json?.data?.email ?? reMailed.json?.error}`);

  const sent = await call("POST", `/api/exams/${seed.courseId}/send`, {
    traineeIds: [seed.traineeId],
  });

  /* If the mail transport refused the send there is no link to follow, so stop
   * here rather than cascading empty-token failures through the rest of the suite. */
  if (sent.json?.data?.summary?.sent !== 1) {
    check("exam link delivered", false,
      JSON.stringify(sent.json?.data?.failed ?? sent.json));
    console.log("\nExam suite aborted: no link was delivered, so there is nothing to follow.");
    return;
  }
  check("exam send accepted", sent.status === 201, JSON.stringify(sent.json).slice(0, 220));
  check("send reports one recipient", sent.json?.data?.summary?.sent === 1,
    JSON.stringify(sent.json?.data?.summary));

  const attemptRow = await dbOne<{ id: string; otpHash: string; otpAttempts: number; status: string }>(
    'SELECT id, "otpHash", "otpAttempts", status FROM "ExamAttempt" ORDER BY "createdAt" DESC LIMIT 1',
  );
  check("attempt row exists with an otpHash", Boolean(attemptRow?.otpHash),
    `status ${attemptRow?.status}`);
  check("otpHash is argon2id, never plaintext",
    (attemptRow?.otpHash ?? "").startsWith("$argon2id$"),
    (attemptRow?.otpHash ?? "").slice(0, 24));
  check("otpAttempts starts at 0", attemptRow?.otpAttempts === 0,
    `got ${attemptRow?.otpAttempts}`);
  check("attempt starts PENDING (OTP not yet entered)", attemptRow?.status === "PENDING",
    `got ${attemptRow?.status}`);

  /* ── the trainee's side: a fresh, unauthenticated cookie jar ─────────── */
  const traineeUrl: string = sent.json?.data?.sent?.[0]?.url ?? "";
  check("send returns the exam URL for manual delivery", traineeUrl.includes("/exam/"),
    traineeUrl.slice(0, 40) + "…");

  const token = traineeUrl.split("/exam/")[1] ?? "";
  check("exam token is 32 bytes base64url (43 chars)", /^[A-Za-z0-9_-]{43}$/.test(token),
    `len ${token.length}`);

  jars.trainee = "";
  const verifyWrong = await call("POST", `/api/exams/attempts/${token}/verify-otp`, { code: "000000" }, "trainee");
  check("wrong OTP is 401", verifyWrong.status === 401, `got ${verifyWrong.status}`);
  check("wrong OTP gives the generic message only",
    verifyWrong.json?.error === "Invalid or expired code" &&
    !JSON.stringify(verifyWrong.json).includes("otpHash"),
    verifyWrong.json?.error);

  const noAttemptRow = await dbOne<{ otpAttempts: number }>(
    `SELECT "otpAttempts" FROM "ExamAttempt" WHERE id = '${attemptRow?.id}'`,
  );
  check("a wrong code increments otpAttempts", noAttemptRow?.otpAttempts === 1,
    `got ${noAttemptRow?.otpAttempts}`);

  const nextBeforeOtp = await call("GET", `/api/exams/attempts/${token}/next`, undefined, "trainee");
  check("the paper is unreachable before the OTP is entered", nextBeforeOtp.status === 401,
    `got ${nextBeforeOtp.status}`);

  /* The OTP the route hashed and the OTP it emailed must be one and the same
   * value, or the trainee receives a code the server will reject. This is the one
   * guarantee the harness cannot read back out of the database, so it is asserted
   * against the send route's source: exactly one `generateOtp()` call, used for
   * both the hash and the email. */
  const sendSource = readFileSync("app/api/exams/[courseId]/send/route.ts", "utf8");
  const otpGenerations = sendSource.match(/generateOtp\(\)/g) ?? [];
  check("send route generates the OTP exactly once", otpGenerations.length === 1,
    `found ${otpGenerations.length}`);
  check("send route hashes and emails that same otp variable",
    /const otp = generateOtp\(\)/.test(sendSource) &&
    /const otpHash = await hashSecret\(otp\)/.test(sendSource) &&
    /examLinkEmail\(\{[\s\S]{0,400}?\n\s+otp,/.test(sendSource),
    "one generateOtp() -> hashSecret(otp) + otp in the template");
  check("send route never logs the plain code",
    !/console\.(log|info|warn|error)\([^)]*\botp\b/i.test(sendSource),
    "clean");

  /* Swap in a code the harness knows, keeping the real argon2id hash format, so
   * verification exercises the genuine compare path. */
  const otp = "314159";
  await setKnownOtp(attemptRow?.id ?? "", otp);

  const verified = await call("POST", `/api/exams/attempts/${token}/verify-otp`, { code: otp }, "trainee");
  check("correct OTP returns 200", verified.status === 200,
    JSON.stringify(verified.json).slice(0, 220));
  check("verify response carries the manifest",
    Array.isArray(verified.json?.data?.manifest?.questionIds),
    JSON.stringify(verified.json?.data?.manifest?.questionIds));
  check("verify response has duration, course and trainee names",
    typeof verified.json?.data?.examDurationMin === "number" &&
    typeof verified.json?.data?.courseName === "string" &&
    typeof verified.json?.data?.traineeName === "string");
  check("manifest holds 4 questions", verified.json?.data?.manifest?.questionIds?.length === 4,
    String(verified.json?.data?.manifest?.questionIds?.length));
  check("verify response leaks neither otpHash nor isCorrect nor tokenHash",
    !/otpHash|isCorrect|tokenHash|"correct"/.test(JSON.stringify(verified.json)),
    "clean");

  /* Manifest shuffle must actually differ per attempt. */
  /* The frozen manifest must carry every option id per question. */
  const optionsForQ0 = verified.json?.data?.manifest?.questions?.[0]?.optionIds ?? [];
  check("manifest options are all present per question",
    optionsForQ0.length === 3, `len ${optionsForQ0.length}`);

  /* The OTP is single use. */
  const replayOtp = await call("POST", `/api/exams/attempts/${token}/verify-otp`, { code: otp }, "trainee");
  check("the same OTP cannot be replayed", replayOtp.status >= 400, `got ${replayOtp.status}`);
  const otpCleared = await dbOne<{ otpHash: string }>(
    `SELECT "otpHash" FROM "ExamAttempt" WHERE id = '${attemptRow?.id}'`,
  );
  check("otpHash is cleared once the code is spent", (otpCleared?.otpHash ?? "") === "",
    JSON.stringify(otpCleared?.otpHash));

  /* ── the paper ───────────────────────────────────────────────────────── */
  const paper = await call("GET", `/api/exams/attempts/${token}/next`, undefined, "trainee");
  check("the paper loads once the OTP is verified", paper.status === 200,
    `got ${paper.status}`);
  check("paper has 4 questions", paper.json?.data?.questions?.length === 4,
    String(paper.json?.data?.questions?.length));
  check("paper leaks no isCorrect anywhere",
    !/isCorrect/.test(JSON.stringify(paper.json)),
    "clean");
  check("paper carries a server-authoritative secondsLeft",
    typeof paper.json?.data?.secondsLeft === "number" && paper.json.data.secondsLeft > 0,
    String(paper.json?.data?.secondsLeft));

  const questions = paper.json?.data?.questions ?? [];
  const answerKey = new Map<string, string>();
  for (const q of bankItems) {
    const right = q.options.find((o: Json) => o.isCorrect === true);
    if (right) answerKey.set(q.text as string, right.id as string);
  }

  /* ── autosave ────────────────────────────────────────────────────────── */
  for (const q of questions) {
    const first = q.options[0];
    const saved = await call("POST", `/api/exams/attempts/${token}/answer`, {
      questionId: q.id,
      optionId: first.id,
    }, "trainee");
    if (saved.status !== 200) {
      check(`autosave for ${q.id}`, false, `got ${saved.status}`);
      break;
    }
  }
  const savedRows = await dbCount(`SELECT COUNT(*)::int AS n FROM "ExamAnswer" WHERE "attemptId" = '${attemptRow?.id}'`);
  check("every answer autosaved", savedRows === 4, `saved ${savedRows}`);

  const foreignQuestion = await call("POST", `/api/exams/attempts/${token}/answer`, {
    questionId: "not-a-real-question",
    optionId: "also-not-real",
  }, "trainee");
  check("autosave rejects a question outside the manifest", foreignQuestion.status === 422,
    `got ${foreignQuestion.status}`);

  /* ── submit: answer everything correctly so a certificate is issued ──── */
  for (const q of questions) {
    const correctId = answerKey.get(q.text as string);
    if (!correctId) continue;
    await call("POST", `/api/exams/attempts/${token}/answer`, {
      questionId: q.id,
      optionId: correctId,
    }, "trainee");
  }

  const submitted = await call("POST", `/api/exams/attempts/${token}/submit`, { blurCount: 0 }, "trainee");
  check("submit returns 200", submitted.status === 200, JSON.stringify(submitted.json).slice(0, 240));
  check("score is computed at 100%", submitted.json?.data?.scorePct === 100,
    String(submitted.json?.data?.scorePct));
  check("status is PASSED", submitted.json?.data?.status === "PASSED",
    submitted.json?.data?.status);
  check("certificate issued on a pass", Boolean(submitted.json?.data?.certificate?.id),
    JSON.stringify(submitted.json?.data?.certificate));
  check("student number is numeric and >= the 263 default",
    typeof submitted.json?.data?.certificate?.studentNumber === "number" &&
    submitted.json.data.certificate.studentNumber >= 263,
    String(submitted.json?.data?.certificate?.studentNumber));
  check("submit response leaks no isCorrect",
    !/isCorrect/.test(JSON.stringify(submitted.json)),
    "clean");

  /* ── reuse of a submitted token is refused ───────────────────────────── */
  const reuse = await call("POST", `/api/exams/attempts/${token}/verify-otp`, { code: "123456" }, "trainee");
  check("a submitted token cannot be re-verified", reuse.status === 401, `got ${reuse.status}`);

  /* Submitting clears the exam cookie, so the paper now refuses with the same
   * "enter the code" answer as any other unverified visitor. That is the desired
   * behaviour: the finished state is not disclosed to someone holding only a link. */
  const reuseNext = await call("GET", `/api/exams/attempts/${token}/next`, undefined, "trainee");
  check("a submitted token cannot reopen the paper",
    reuseNext.status === 401 || reuseNext.status === 410,
    `got ${reuseNext.status}`);

  const reuseSubmit = await call("POST", `/api/exams/attempts/${token}/submit`, {}, "trainee");
  check("a second submit reports the recorded result instead of regrading",
    reuseSubmit.status === 200 && reuseSubmit.json?.data?.alreadySubmitted === true,
    `got ${reuseSubmit.status}`);

  /* ── certificate and public verification ─────────────────────────────── */
  const certId: string = submitted.json?.data?.certificate?.id;
  const certList = await call("GET", "/api/certificates");
  check("certificate appears in the staff register",
    (certList.json?.data?.items ?? []).some((c: Json) => c.id === certId),
    `total ${certList.json?.data?.total}`);

  const verifyToken: string = submitted.json?.data?.certificate?.verificationToken;
  const verifyOk = await call("GET", `/api/verify/${verifyToken}`);
  check("public verification succeeds with no session",
    verifyOk.status === 200 && ["VALID", "EXPIRING"].includes(verifyOk.json?.data?.status),
    JSON.stringify(verifyOk.json).slice(0, 200));
  check("verification reports the trainee and course",
    typeof verifyOk.json?.data?.traineeName === "string" &&
    typeof verifyOk.json?.data?.courseName === "string",
    `${verifyOk.json?.data?.traineeName} / ${verifyOk.json?.data?.courseName}`);
  check("public verification leaks no email address",
    !/@/.test(JSON.stringify(verifyOk.json)),
    "clean");
  check("verification exposes a numeric student number",
    typeof verifyOk.json?.data?.studentNumber === "number",
    String(verifyOk.json?.data?.studentNumber));

  const anonVerifyOk = await call("GET", `/api/verify/${verifyToken}`);
  check("verification needs no auth cookie", anonVerifyOk.status === 200, `got ${anonVerifyOk.status}`);

  const bogusVerify = await call("GET", "/api/verify/definitely-not-a-real-token");
  check("a bogus verification token is 404, not a 500", bogusVerify.status === 404,
    `got ${bogusVerify.status}`);

  /* Revoke is owner-only and flips the public status. */
  const revokeAsStaff = await call("POST", `/api/certificates/${certId}/revoke`, {
    reason: "Testing the revoke path from the owner session.",
  });
  check("owner can revoke a certificate", revokeAsStaff.status === 200,
    JSON.stringify(revokeAsStaff.json).slice(0, 160));

  const verifyRevoked = await call("GET", `/api/verify/${verifyToken}`);
  check("verification reports revoked after revocation",
    verifyRevoked.json?.data?.status === "REVOKED", verifyRevoked.json?.data?.status);
  check("verification includes the revocation reason",
    typeof verifyRevoked.json?.data?.revokedReason === "string",
    verifyRevoked.json?.data?.revokedReason);

  /* ── PDF download ────────────────────────────────────────────────────── */
  const pdf = await fetch(`${BASE}/api/certificates/${certId}/pdf`, {
    headers: { Cookie: [jars.owner, jars.device].filter(Boolean).join("; ") },
  });
  check("certificate PDF downloads", pdf.status === 200, `got ${pdf.status}`);
  check("PDF is served as an attachment",
    (pdf.headers.get("content-disposition") ?? "").includes("attachment"),
    pdf.headers.get("content-disposition") ?? "missing");
  check("PDF is a real PDF", (pdf.headers.get("content-type") ?? "").includes("pdf"),
    pdf.headers.get("content-type") ?? "missing");
  const pdfBytes = new Uint8Array(await pdf.arrayBuffer());
  check("PDF body starts with %PDF", String.fromCharCode(...pdfBytes.slice(0, 4)) === "%PDF",
    `${pdfBytes.byteLength} bytes`);

  /* ── Step 4: access links, referral codes, device cap ─────────────────── */
  const stamped = `e2e${Date.now().toString(36)}`;

  const anonList = await call("GET", "/api/access-links", undefined, "anon");
  check("an anonymous caller cannot list access links", anonList.status === 401,
    `got ${anonList.status}`);

  const minted = await call("POST", "/api/access-links", {
    role: "ADMIN",
    label: `E2E ${stamped}`,
    singleUse: true,
    expiresInDays: 7,
  });
  check("owner can mint an access link", minted.status === 201,
    JSON.stringify(minted.json).slice(0, 160));
  const linkToken: string = minted.json?.data?.token ?? "";
  check("the minted token is 32 bytes base64url (43 chars)",
    /^[A-Za-z0-9_-]{43}$/.test(linkToken), `len ${linkToken.length}`);
  check("the mint response is not cacheable",
    (minted.headers.get("cache-control") ?? "").includes("no-store"),
    minted.headers.get("cache-control") ?? "missing");

  /* The owner-link boundary: role is enum-constrained so OWNER is simply not
   * accepted, rather than accepted and quietly downgraded. */
  const ownerLink = await call("POST", "/api/access-links", { role: "OWNER" });
  check("an owner link cannot be minted from the API", ownerLink.status === 422,
    `got ${ownerLink.status}`);

  const trainerNoTrainer = await call("POST", "/api/access-links", { role: "TRAINER" });
  check("a trainer link without a trainer is 422", trainerNoTrainer.status === 422,
    `got ${trainerNoTrainer.status}`);

  const listAfter = await call("GET", "/api/access-links");
  check("the link list carries no recoverable token",
    !JSON.stringify(listAfter.json).includes(linkToken), "token absent");
  check("the link list shows a referral code",
    typeof listAfter.json?.data?.items?.[0]?.referralCode === "string",
    listAfter.json?.data?.items?.[0]?.referralCode);

  /* Redeem creates a real account. */
  const newEmail = `trainer-${stamped}@example.test`;
  const redeem = await call("POST", "/api/access-links/redeem", {
    token: linkToken,
    fullName: `E2E Trainer ${stamped}`,
    email: newEmail,
    password: "correct-horse-battery-staple-42",
  }, "anon");
  check("a valid link redeems into an account", redeem.status === 201,
    JSON.stringify(redeem.json).slice(0, 160));
  check("the new session is forced through MFA enrolment",
    redeem.json?.data?.nextStep === "mfa-setup", redeem.json?.data?.nextStep);

  /* Single-use is a compare-and-set, so the second attempt must fail. */
  const replay = await call("POST", "/api/access-links/redeem", {
    token: linkToken,
    fullName: `E2E Second ${stamped}`,
    email: `second-${stamped}@example.test`,
    password: "correct-horse-battery-staple-42",
  }, "anon");
  check("a single-use link cannot be redeemed twice", replay.status === 410,
    `got ${replay.status}`);
  check("a spent link gives the same message as an unknown one",
    JSON.stringify(replay.json?.error) === JSON.stringify(
      (await call("POST", "/api/access-links/redeem", {
        token: "x".repeat(43),
        fullName: "Nobody At All",
        email: `nobody-${stamped}@example.test`,
        password: "correct-horse-battery-staple-42",
      }, "anon")).json?.error),
    replay.json?.error);

  /* An existing account must not be overwritable through a link. */
  const reuseOwner = await call("POST", "/api/access-links/redeem", {
    token: linkToken,
    fullName: "Owner Takeover",
    email: "gahiredev01@gmail.com",
    password: "correct-horse-battery-staple-42",
  }, "anon");
  check("an existing account cannot be overwritten via a link",
    reuseOwner.status === 410 || reuseOwner.status === 409, `got ${reuseOwner.status}`);

  /* An invited admin must be able to sign in again with their password — a link
   * that works once and strands the account would not be access control. */
  const inviteeRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: newEmail,
      password: "correct-horse-battery-staple-42",
    }),
  });
  const inviteeJson = (await inviteeRes.json()) as Json;
  check("an invited admin can sign in with their password", inviteeRes.status === 200,
    `got ${inviteeRes.status}`);
  check("the invited admin is still pushed through MFA",
    inviteeJson?.data?.nextStep === "mfa-setup", inviteeJson?.data?.nextStep);
  check("the invited admin is not an owner",
    inviteeJson?.data?.role === "ADMIN", inviteeJson?.data?.role);

  /* A password alone must still read nothing: the session it produces has not
   * passed a second factor, so guard() refuses it. */
  const inviteeCookies = (inviteeRes.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0]);
  const inviteeData = await fetch(`${BASE}/api/courses`, {
    headers: { Cookie: inviteeCookies.join("; ") },
  });
  check("password-only sessions are refused by data routes",
    inviteeData.status === 403, `got ${inviteeData.status}`);

  /* Device cap. The owner already has a device from login, so this exercises the
   * eviction path rather than the happy path. */
  const devices = await call("GET", "/api/devices");
  check("the owner can list their own devices", devices.status === 200,
    `got ${devices.status}`);
  check("the device cap is five", devices.json?.data?.maxDevices === 5,
    String(devices.json?.data?.maxDevices));
  check("no device hash is exposed",
    !JSON.stringify(devices.json).includes("deviceHash"), "clean");
  check("the current device is identified",
    devices.json?.data?.items?.some((d: Json) => d.current === true), "marked current");
  check("the owner cannot revoke the device in use",
    (await call("POST", `/api/devices/${devices.json?.data?.items?.find((d: Json) => d.current)?.id}/revoke`, {}))
      .status === 422, "self-revoke refused");

  /* Referral codes: attribution only, and the use cap is enforced atomically. */
  const referral = await call("POST", "/api/referral-codes", { role: "ADMIN", maxUses: 2 });
  check("owner can mint a referral code", referral.status === 201,
    JSON.stringify(referral.json).slice(0, 120));
  const referralCode: string = referral.json?.data?.code ?? "";
  check("a referral code avoids look-alike characters",
    /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(referralCode), referralCode);
  check("a referral code cannot list access links", (await call("GET", "/api/access-links", undefined, "anon")).status === 401);

  /* Revoking a link cascades to what it created. */
  const secondLink = await call("POST", "/api/access-links", {
    role: "ADMIN", label: `E2E cascade ${stamped}`, singleUse: true, expiresInDays: 7,
  });
  const cascadeEmail = `cascade-${stamped}@example.test`;
  const cascadeRedeem = await call("POST", "/api/access-links/redeem", {
    token: secondLink.json?.data?.token,
    fullName: `E2E Cascade ${stamped}`,
    email: cascadeEmail,
    password: "correct-horse-battery-staple-42",
  }, "anon");
  check("a second link redeems", cascadeRedeem.status === 201, `got ${cascadeRedeem.status}`);

  const revokeLink = await call("POST", `/api/access-links/${secondLink.json?.data?.id}/revoke`);
  check("owner can revoke an access link", revokeLink.status === 200,
    JSON.stringify(revokeLink.json).slice(0, 160));
  check("revoking kills the sessions the link created",
    revokeLink.json?.data?.sessionsKilled >= 1, String(revokeLink.json?.data?.sessionsKilled));

  const afterRevoke = await call("POST", "/api/access-links/redeem", {
    token: secondLink.json?.data?.token,
    fullName: "Too Late",
    email: `late-${stamped}@example.test`,
    password: "correct-horse-battery-staple-42",
  }, "anon");
  check("a revoked link cannot be redeemed", afterRevoke.status === 410,
    `got ${afterRevoke.status}`);

  /* ── notifications: list, mark-read, scoping, and the live stream ─────── */

  const noteList = await call("GET", "/api/notifications");
  check("the owner can list notifications", noteList.status === 200,
    `got ${noteList.status}`);
  check("the notification list carries an unread count",
    typeof noteList.json?.data?.unread === "number",
    JSON.stringify(noteList.json?.data).slice(0, 120));

  /* The exam send above ran emit("exam.sent"), so a real row must be there. */
  const sentNote = (noteList.json?.data?.items as Json[] | undefined)?.find(
    (n) => n.type === "exam.sent",
  );
  check("sending an exam persisted an exam.sent notification", Boolean(sentNote),
    sentNote ? String(sentNote.id) : "none found");

  /* A row belonging to somebody else must never surface in this list. */
  const noteOwner = await prisma.user.findUnique({
    where: { email: "gahiredev01@gmail.com" },
    select: { id: true },
  });
  const otherUser = await prisma.user.findFirst({
    where: { id: { not: noteOwner!.id } },
    select: { id: true, email: true },
  });
  let foreignNoteId = "";
  if (otherUser) {
    const foreign = await prisma.notification.create({
      data: { userId: otherUser.id, type: "system", title: "Foreign note", body: "not yours" },
      select: { id: true },
    });
    foreignNoteId = foreign.id;
    const ids = ((noteList.json?.data?.items as Json[] | undefined) ?? []).map((n) => n.id);
    check("another user's notification is not in this list", !ids.includes(foreignNoteId),
      `${otherUser.email}`);
  }

  /* Marking read is scoped by userId, so a guessed foreign id matches nothing
   * and leaves the other account untouched. */
  if (foreignNoteId) {
    const foreignAttempt = await call("POST", "/api/notifications", { id: foreignNoteId });
    check("marking a foreign notification read touches nothing",
      foreignAttempt.status === 200 && foreignAttempt.json?.data?.updated === 0,
      JSON.stringify(foreignAttempt.json?.data));
    const stillUnread = await prisma.notification.findUnique({
      where: { id: foreignNoteId },
      select: { readAt: true },
    });
    check("the other user's notification is still unread", stillUnread?.readAt === null,
      String(stillUnread?.readAt));
    await prisma.notification.deleteMany({ where: { id: foreignNoteId } });
  }

  if (sentNote) {
    const markOne = await call("POST", "/api/notifications", { id: sentNote.id });
    check("marking one notification read reports the update",
      markOne.status === 200 && markOne.json?.data?.updated === 1,
      JSON.stringify(markOne.json?.data));
  }

  const markAll = await call("POST", "/api/notifications", { all: true });
  check("marking everything read reports the update", markAll.status === 200,
    `got ${markAll.status}`);
  check("no notification is left unread", markAll.json?.data?.unread === 0,
    String(markAll.json?.data?.unread));

  const anonNotes = await call("GET", "/api/notifications", undefined, "anon");
  check("an anonymous caller cannot list notifications", anonNotes.status === 401,
    `got ${anonNotes.status}`);

  /* The stream must be an authenticated SSE response, not an HTML shell — the
   * browser only recognises it as a stream if the content type is exact. */
  const sseControl = new AbortController();
  const sseRes = await fetch(`${BASE}/api/notifications/stream`, {
    headers: { Cookie: [jars.owner, jars.device].filter(Boolean).join("; ") },
    signal: sseControl.signal,
  }).catch(() => null);
  check("the notification stream answers with text/event-stream",
    sseRes?.status === 200 &&
      (sseRes.headers.get("content-type") ?? "").startsWith("text/event-stream"),
    sseRes ? `${sseRes.status} ${sseRes.headers.get("content-type")}` : "no response");
  sseControl.abort();

  const sseAnon = await fetch(`${BASE}/api/notifications/stream`, {
    headers: {}, signal: AbortSignal.timeout(3000),
  }).catch(() => null);
  check("the notification stream refuses anonymous callers",
    sseAnon?.status === 401, sseAnon ? `got ${sseAnon.status}` : "no response");
  sseAnon?.body?.cancel().catch(() => {});

  /* Regression guards for the two authorisation bugs found while building this:
   * `notification.read` and `device.self` are self-scoped, so a TRAINER must be
   * allowed them with no course resource attached. */
  const { authorize } = await import("@/lib/auth/authorize");
  const trainerSubject = { id: "probe", role: "TRAINER" as const, isActive: true };
  check("a trainer may read their own notifications",
    authorize(trainerSubject, "notification.read").ok,
    JSON.stringify(authorize(trainerSubject, "notification.read")));
  check("a trainer may manage their own devices",
    authorize(trainerSubject, "device.self").ok,
    JSON.stringify(authorize(trainerSubject, "device.self")));
  check("a trainer still needs a resource for course-scoped work",
    !authorize(trainerSubject, "trainee.read").ok, "resource still required");

  /* Clean up the accounts these checks created. */
  await prisma.user.deleteMany({
    where: { email: { in: [newEmail, cascadeEmail] } },
  });
  await prisma.accessLink.deleteMany({ where: { label: { startsWith: "E2E" } } });
  await prisma.referralCode.deleteMany({ where: { code: referralCode } });
  /* Notification rows this run emitted, so a re-run starts from a known count. */
  await prisma.notification.deleteMany({ where: { createdAt: { gte: RUN_STARTED_AT } } });

  /* ── the device binding, proven last because it ends this session ────── */

  /* A copied session cookie with no device cookie beside it must resolve to no
   * session, without destroying the real one. */
  const copied = await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: jars.owner } });
  const copiedJson = (await copied.json()) as Json;
  check("a session cookie without its device cookie resolves to no session",
    copiedJson?.data?.user === null, JSON.stringify(copiedJson?.data).slice(0, 80));

  const stillThere = await fetch(`${BASE}/api/auth/me`, {
    headers: { Cookie: [jars.owner, jars.device].filter(Boolean).join("; ") },
  });
  const stillJson = (await stillThere.json()) as Json;
  check("the refused request did not destroy the real session",
    stillJson?.data?.user?.role === "OWNER", JSON.stringify(stillJson?.data).slice(0, 80));

  /* Revoking the device must finish the sessions it created — otherwise the cap
   * would revoke rows while the cookies behind them kept working. */
  const ownerUser = await prisma.user.findUnique({
    where: { email: "gahiredev01@gmail.com" },
    select: { id: true },
  });
  const liveDevice = await prisma.deviceSession.findFirst({
    where: { userId: ownerUser?.id, revokedAt: null },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true },
  });
  check("the owner has a live device row", Boolean(liveDevice), liveDevice?.id ?? "none");

  const sessionsBefore = await prisma.session.count({ where: { userId: ownerUser!.id } });

  if (liveDevice) {
    await prisma.deviceSession.update({
      where: { id: liveDevice.id },
      data: { revokedAt: new Date() },
    });

    const afterDeviceRevoke = await call("GET", "/api/auth/me");
    const afterJson = afterDeviceRevoke.json?.data;
    check("revoking a device ends its sessions",
      afterJson?.user === null, JSON.stringify(afterJson).slice(0, 80));

    const sessionsAfter = await prisma.session.count({ where: { userId: ownerUser!.id } });
    check("the revoked device's session row was cleaned up", sessionsAfter < sessionsBefore,
      `${sessionsBefore} -> ${sessionsAfter}`);

    /* Leave the fixture usable for whoever runs this next. */
    await prisma.deviceSession.update({
      where: { id: liveDevice.id },
      data: { revokedAt: null },
    });
    await prisma.session.deleteMany({ where: { userId: ownerUser!.id } });
  }
}

main()
  .catch((error) => {
    console.error("Smoke test crashed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
