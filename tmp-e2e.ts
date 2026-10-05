/**
 * End-to-end smoke test against a running server.
 *
 * Exercises the full Phase 1 flow with a real session cookie:
 *   health -> login -> TOTP enrol -> TOTP verify -> course CRUD -> trainee CRUD
 *
 * Run with: npx tsx tmp-e2e.ts [baseUrl]
 */
import { generate } from "otplib";

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

let cookie = "";
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
): Promise<{ status: number; json: Json; headers: Headers }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });

  const setCookie = res.headers.getSetCookie?.() ?? [];
  for (const c of setCookie) {
    const pair = c.split(";")[0];
    if (pair.startsWith("ksa_session=")) cookie = pair;
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

const PASSWORD = process.env.SEED_OWNER_PASSWORD ?? "ChangeMe123!";

async function main() {
  console.log(`\nTarget: ${BASE}\n`);

  /* 1. health ------------------------------------------------------------ */
  const health = await call("GET", "/api/health");
  check("health returns ok/db", health.json?.ok === true && health.json?.db === "ok",
    JSON.stringify(health.json));

  /* 2. protected routes reject anonymous callers -------------------------- */
  const anon = await call("GET", "/api/courses");
  check("anonymous /api/courses is 401", anon.status === 401, `got ${anon.status}`);

  const anonTrainees = await call("GET", "/api/trainees");
  check("anonymous /api/trainees is 401", anonTrainees.status === 401, `got ${anonTrainees.status}`);

  /* Every other gated route must also refuse an anonymous caller. */
  const protectedRoutes: Array<[string, string]> = [
    ["GET", "/api/auth/me"],
    ["GET", "/api/categories"],
    ["GET", "/api/courses/e2e-1"],
    ["GET", "/api/trainees/e2e-1"],
    ["PATCH", "/api/courses/e2e-1"],
    ["PATCH", "/api/trainees/e2e-1"],
    ["DELETE", "/api/courses/e2e-1"],
    ["POST", "/api/auth/logout"],
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

  /* 3. server-rendered page guard ---------------------------------------- */
  const page = await fetch(`${BASE}/dashboard`, { redirect: "manual" });
  const loc = page.headers.get("location") ?? "";
  check("/dashboard redirects to /login when signed out",
    page.status === 307 || page.status === 302 ? loc.includes("/login") : false,
    `${page.status} -> ${loc || "no redirect"}`);

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
  check("session cookie was set", cookie.startsWith("ksa_session="));

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
  check("8 seeded courses are present", seeded.length === 8, `got ${seeded.length}`);
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
    code: "E2E1",
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
    code: "E2E1",
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
    email: "aline.umutoni@example.com",
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
    email: "aline.umutoni@example.com",
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
  check("search by name works", searched.status === 200 && (searched.json?.data?.total ?? 0) === 1,
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
    me.status === 200 && me.json?.data?.email === "gahiredev01@gmail.com",
    JSON.stringify(me.json?.data));

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
  /* Same code, same session, second attempt: the stored counter must refuse it
   * even though the 30-second window has not moved on. */
  const replaySecret = secret;
  const replayCode = await freshTotp(replaySecret);
  const firstUse = await call("POST", "/api/auth/mfa/verify", { code: replayCode });
  check("fresh TOTP accepted", firstUse.status === 200, JSON.stringify(firstUse.json));

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
   * session's bucket. */
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

  console.log(`\n${checks - failures}/${checks} checks passed.`);
  if (failures > 0) {
    console.log(`${failures} FAILURES`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Smoke test crashed:", error);
  process.exit(1);
});