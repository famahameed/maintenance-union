// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
/** Local PostgreSQL only. Creates and drops its own temporary database. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { closeDatabase } from "../lib/database";
import {
  hashPassword,
  createSession,
  getSessionUser,
  sessionCookie,
} from "../lib/auth";
import { POST as reserve } from "../app/api/bookings/route";
import { GET as publicConfig } from "../app/api/config/route";
import { GET as portal, POST as change } from "../app/api/portal/route";
import { POST as login } from "../app/api/auth/login/route";
import { POST as bootstrap } from "../app/api/server/admin/route";
import { mfaAction, verifyMfa } from "../lib/union/mfa";
import { saveLogo } from "../lib/union/logos";
const adminUrl = process.env.TEST_ADMIN_DATABASE_URL;
if (
  !adminUrl ||
  !["127.0.0.1", "localhost"].includes(new URL(adminUrl).hostname)
)
  throw new Error(
    "TEST_ADMIN_DATABASE_URL must identify a local disposable PostgreSQL server.",
  );
const name = "union_test_" + crypto.randomUUID().replaceAll("-", "");
const owner = new Client({ connectionString: adminUrl });
const source = new URL(adminUrl);
source.pathname = "/" + name;
process.env.DATABASE_URL = source
  .toString()
  .replace(/\/\/[^@]+@/, "//union_app@");
process.env.DATABASE_TLS = "local-only";
Object.assign(process.env, { NODE_ENV: "test" });
process.env.APP_ORIGIN = "https://test.invalid";
process.env.AUTH_SECRET = crypto.randomUUID() + crypto.randomUUID();
const password = "TestOnly9!Abcdef";
const nextPassword = "OtherKey8!Abcdef";
const day = "2099-01-05";
function request(
  path: string,
  p?: Record<string, unknown>,
  cookie = "",
  origin = "https://test.invalid",
) {
  return new Request("https://test.invalid" + path, {
    method: p ? "POST" : "GET",
    headers: { origin, "content-type": "application/json", cookie },
    ...(p ? { body: JSON.stringify(p) } : {}),
  });
}
const booking = (phone: string, room = "a", start = 600) => ({
  showroomId: room,
  customerName: "محمد أحمد علي",
  phone,
  requestTypeId: room === "a" ? 1 : 2,
  serviceMode: "shop",
  bookingDate: day,
  startMinute: start,
});
const cookies: Record<string, string> = {};
async function actor(id: string) {
  const s = await createSession(id, 0);
  return sessionCookie(s.token).split(";")[0];
}

test("PostgreSQL application security and booking flow", async (t) => {
  await owner.connect();
  await owner.query("CREATE DATABASE " + name);
  const fixture = new Client({ connectionString: source.toString() });
  await fixture.connect();
  try {
    await fixture.query(
      await readFile(new URL("../sql/01-install.sql", import.meta.url), "utf8"),
    );
    await owner.query("ALTER ROLE union_app LOGIN");
    await fixture.query(
      "INSERT INTO union_private.showrooms(id,name,phone,address,teams_count,daily_booking_limit,work_days) VALUES('a','معرض ألف','0780000001','إربد',2,2,'[0,1,2,3,4,5,6]'),('b','معرض باء','0780000002','إربد',2,20,'[0,1,2,3,4,5,6]')",
    );
    await fixture.query(
      "INSERT INTO union_private.request_types(id,showroom_id,name_ar,name_en) VALUES(1,'a','صيانة أثاث','Maintenance'),(2,'b','صيانة أثاث','Maintenance'); SELECT setval('union_private.request_types_id_seq',2)",
    );
    const h = await hashPassword(password);
    for (const [id, role, room, phone] of [
      ["owner", "admin", "", "0790000001"],
      ["ma", "manager", "a", "0790000002"],
      ["mb", "manager", "b", "0790000003"],
      ["ea", "employee", "a", "0790000004"],
      ["eb", "employee", "b", "0790000005"],
    ])
      await fixture.query(
        "INSERT INTO union_private.staff(id,name,phone,role,showroom_id,password_hash,password_salt) VALUES($1,$1,$2,$3,$4,$5,$6)",
        [id, phone, role, room, h.hash, h.salt],
      );
    for (const id of ["owner", "ma", "mb", "ea", "eb"])
      cookies[id] = await actor(id);
    await t.test(
      "Public config contains no staff/login/password/session fields",
      async () => {
        const r = await publicConfig(request("/api/config"));
        assert.equal(r.status, 200);
        const text = JSON.stringify(await r.json());
        for (const key of [
          "password_hash",
          "manager_phones",
          "auth_version",
          "token_hash",
          "079000000",
        ])
          assert.ok(!text.includes(key));
      },
    );
    await t.test(
      "Cross-origin mutations rejected and unauthenticated portal denied",
      async () => {
        assert.equal(
          (
            await reserve(
              request(
                "/api/bookings",
                booking("0770000001"),
                "",
                "https://evil.invalid",
              ),
            )
          ).status,
          403,
        );
        assert.equal((await portal(request("/api/portal"))).status, 401);
      },
    );
    await t.test(
      "20 simultaneous reservations produce exactly two committed bookings",
      async () => {
        const results = await Promise.all(
          Array.from({ length: 20 }, (_, i) =>
            reserve(
              request(
                "/api/bookings",
                booking("077" + String(i).padStart(7, "0")),
              ),
            ),
          ),
        );
        assert.equal(results.filter((r) => r.status === 201).length, 2);
        assert.equal(results.filter((r) => r.status === 409).length, 18);
        const db = await fixture.query(
          "SELECT count(*) AS n,count(distinct slot_index) AS teams FROM union_private.bookings WHERE showroom_id='a'",
        );
        assert.equal(Number(db.rows[0].n), 2);
        assert.equal(Number(db.rows[0].teams), 2);
      },
    );
    const first = (
      await fixture.query(
        "SELECT id FROM union_private.bookings WHERE showroom_id='a' ORDER BY id",
      )
    ).rows[0].id;
    await t.test(
      "Retry after a lost response returns the same reference without a second reservation",
      async () => {
        const p = {
          ...booking("0770000077", "b"),
          requestId: crypto.randomUUID(),
        };
        const first = await reserve(request("/api/bookings", p));
        const one = await first.json();
        assert.equal(first.status, 201);
        const again = await reserve(request("/api/bookings", p));
        assert.equal(again.status, 201);
        assert.equal((await again.json()).reference, one.reference);
        assert.equal(
          Number(
            (
              await fixture.query(
                "SELECT count(*) AS n FROM union_private.bookings WHERE submission_key=$1",
                [p.requestId],
              )
            ).rows[0].n,
          ),
          1,
        );
      },
    );
    await t.test(
      "Tenant scope and employee privileges resist ID substitution",
      async () => {
        assert.equal(
          (
            await portal(
              request("/api/portal?showroomId=b", undefined, cookies.ma),
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await change(
              request(
                "/api/portal",
                { action: "cancel_booking", bookingId: first },
                cookies.mb,
              ),
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await change(
              request(
                "/api/portal",
                { action: "save_settings", showroomId: "a" },
                cookies.ea,
              ),
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await change(
              request(
                "/api/portal",
                {
                  action: "create_staff",
                  role: "manager",
                  showroomId: "a",
                  name: "مدير جديد",
                  phone: "0790000088",
                  password,
                  confirmPassword: password,
                  actorPassword: password,
                },
                cookies.ma,
              ),
            )
          ).status,
          403,
        );
      },
    );
    await t.test(
      "Assign → employee start → completion note → manager approval",
      async () => {
        assert.equal(
          (
            await change(
              request(
                "/api/portal",
                {
                  action: "assign_booking",
                  bookingId: first,
                  employeeId: "ea",
                },
                cookies.ma,
              ),
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await change(
              request(
                "/api/portal",
                { action: "employee_start", bookingId: first },
                cookies.eb,
              ),
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await change(
              request(
                "/api/portal",
                { action: "employee_start", bookingId: first },
                cookies.ea,
              ),
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await change(
              request(
                "/api/portal",
                { action: "employee_complete", bookingId: first, note: "x" },
                cookies.ea,
              ),
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await change(
              request(
                "/api/portal",
                {
                  action: "employee_complete",
                  bookingId: first,
                  note: "تم إصلاح العطل وفحص الأثاث",
                },
                cookies.ea,
              ),
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await change(
              request(
                "/api/portal",
                { action: "approve_booking", bookingId: first },
                cookies.ma,
              ),
            )
          ).status,
          200,
        );
      },
    );
    await t.test(
      "Cancellation releases slot; deactivated showroom blocks reservations",
      async () => {
        const second = (
          await fixture.query(
            "SELECT id FROM union_private.bookings WHERE showroom_id='a' AND id<>$1",
            [first],
          )
        ).rows[0].id;
        assert.equal(
          (
            await change(
              request(
                "/api/portal",
                { action: "cancel_booking", bookingId: second },
                cookies.ma,
              ),
            )
          ).status,
          200,
        );
        assert.equal(
          (await reserve(request("/api/bookings", booking("0770000099"))))
            .status,
          201,
        );
        assert.equal(
          (
            await change(
              request(
                "/api/portal",
                { action: "toggle_showroom", showroomId: "b", active: false },
                cookies.owner,
              ),
            )
          ).status,
          200,
        );
        assert.equal(
          (await reserve(request("/api/bookings", booking("0770000088", "b"))))
            .status,
          404,
        );
        await fixture.query(
          "UPDATE union_private.showrooms SET active=1 WHERE id='b'",
        );
      },
    );
    await t.test(
      "Read-only account masks customer data and blocks writes",
      async () => {
        await fixture.query(
          "UPDATE union_private.staff SET read_only=1 WHERE id='ma'",
        );
        const r = await portal(request("/api/portal", undefined, cookies.ma));
        assert.equal(r.status, 200);
        const data = await r.json();
        assert.ok(
          data.bookings.every((b: { phone: string }) => b.phone === ""),
        );
        assert.equal(
          (
            await change(
              request(
                "/api/portal",
                { action: "cancel_booking", bookingId: first },
                cookies.ma,
              ),
            )
          ).status,
          403,
        );
        await fixture.query(
          "UPDATE union_private.staff SET read_only=0 WHERE id='ma'",
        );
      },
    );
    await t.test(
      "Concurrent assignment of overlapping bookings permits only one task per employee",
      async () => {
        assert.equal(
          (await reserve(request("/api/bookings", booking("0770000044", "b"))))
            .status,
          201,
        );
        const ids = (
          await fixture.query(
            "SELECT id FROM union_private.bookings WHERE showroom_id='b' ORDER BY id",
          )
        ).rows.map((r) => r.id);
        assert.equal(ids.length, 2);
        const results = await Promise.all(
          ids.map((bookingId) =>
            change(
              request(
                "/api/portal",
                { action: "assign_booking", bookingId, employeeId: "eb" },
                cookies.mb,
              ),
            ),
          ),
        );
        assert.equal(results.filter((r) => r.status === 200).length, 1);
        assert.equal(results.filter((r) => r.status === 409).length, 1);
      },
    );
    await t.test(
      "Employee creation is scoped, hashes credentials and rejects a duplicate login number",
      async () => {
        const payload = {
          action: "create_staff",
          role: "employee",
          showroomId: "a",
          name: "موظف اختبار",
          phone: "0790000066",
          password,
          confirmPassword: password,
          actorPassword: password,
        };
        assert.equal(
          (await change(request("/api/portal", payload, cookies.ma))).status,
          200,
        );
        assert.equal(
          (await change(request("/api/portal", payload, cookies.ma))).status,
          409,
        );
      },
    );
    await t.test(
      "Three wrong old passwords lock the account verification budget",
      async () => {
        for (const code of [400, 400, 429])
          assert.equal(
            (
              await change(
                request(
                  "/api/portal",
                  {
                    action: "change_password",
                    currentPassword: "wrong",
                    password: nextPassword,
                    confirmPassword: nextPassword,
                  },
                  cookies.ea,
                ),
              )
            ).status,
            code,
          );
        assert.equal(
          (
            await change(
              request(
                "/api/portal",
                {
                  action: "change_password",
                  currentPassword: password,
                  password: nextPassword,
                  confirmPassword: nextPassword,
                },
                cookies.ea,
              ),
            )
          ).status,
          429,
        );
        await fixture.query("DELETE FROM union_private.rate_limits");
      },
    );
    await t.test(
      "Password mismatch rejected; correct change hashes and revokes every session",
      async () => {
        const other = await actor("ea");
        assert.equal(
          (
            await change(
              request(
                "/api/portal",
                {
                  action: "change_password",
                  currentPassword: password,
                  password: nextPassword,
                  confirmPassword: "no",
                },
                cookies.ea,
              ),
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await change(
              request(
                "/api/portal",
                {
                  action: "change_password",
                  currentPassword: password,
                  password: nextPassword,
                  confirmPassword: nextPassword,
                },
                cookies.ea,
              ),
            )
          ).status,
          200,
        );
        assert.equal(
          await getSessionUser(request("/api/auth/session", undefined, other)),
          null,
        );
        assert.equal(
          await getSessionUser(
            request("/api/auth/session", undefined, cookies.ea),
          ),
          null,
        );
        const db = await fixture.query(
          "SELECT password_hash,auth_version FROM union_private.staff WHERE id='ea'",
        );
        assert.notEqual(db.rows[0].password_hash, nextPassword);
        assert.equal(db.rows[0].auth_version, 1);
        assert.equal(
          (
            await login(
              request("/api/auth/login", {
                phone: "0790000004",
                password,
                expectedRole: "employee",
              }),
            )
          ).status,
          401,
        );
        assert.equal(
          (
            await login(
              request("/api/auth/login", {
                phone: "0790000004",
                password: nextPassword,
                expectedRole: "employee",
              }),
            )
          ).status,
          200,
        );
      },
    );
    await t.test(
      "Owner reset requires actor password; disable/delete/revoke persist",
      async () => {
        assert.equal(
          (
            await change(
              request(
                "/api/portal",
                {
                  action: "reset_password",
                  staffId: "eb",
                  password: nextPassword,
                  confirmPassword: nextPassword,
                  actorPassword: "bad",
                },
                cookies.mb,
              ),
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await change(
              request(
                "/api/portal",
                {
                  action: "reset_password",
                  staffId: "eb",
                  password: nextPassword,
                  confirmPassword: nextPassword,
                  actorPassword: password,
                },
                cookies.mb,
              ),
            )
          ).status,
          200,
        );
        assert.equal(
          await getSessionUser(
            request("/api/auth/session", undefined, cookies.eb),
          ),
          null,
        );
        assert.equal(
          (
            await change(
              request(
                "/api/portal",
                {
                  action: "toggle_staff",
                  staffId: "eb",
                  active: false,
                  actorPassword: password,
                },
                cookies.mb,
              ),
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await change(
              request(
                "/api/portal",
                {
                  action: "delete_staff",
                  staffId: "eb",
                  confirmDelete: true,
                  actorPassword: password,
                },
                cookies.mb,
              ),
            )
          ).status,
          200,
        );
        assert.ok(
          (
            await fixture.query(
              "SELECT deleted_at FROM union_private.staff WHERE id='eb'",
            )
          ).rows[0].deleted_at,
        );
      },
    );
    await t.test(
      "Production owner access requires enrolled MFA and blocks its removal",
      async () => {
        process.env.APP_ENV = "production";
        try {
          assert.equal(
            await getSessionUser(
              request("/api/auth/session", undefined, cookies.owner),
            ),
            null,
          );
          assert.equal(
            (
              await login(
                request("/api/auth/login", {
                  phone: "0790000001",
                  password,
                  expectedRole: "admin",
                }),
              )
            ).status,
            401,
          );
        } finally {
          process.env.APP_ENV = "staging";
        }
      },
    );
    await t.test(
      "MFA setup/enable uses PG upsert and one-use recovery under concurrency",
      async () => {
        const user = (await getSessionUser(
          request("/api/auth/session", undefined, cookies.owner),
        ))!;
        const setup = await mfaAction(user, {
          action: "mfa_setup",
          currentPassword: password,
        });
        assert.ok("secret" in setup);
        // RFC 6238 SHA1 TOTP generated independently by Node HMAC.
        const { createHmac } = await import("node:crypto");
        let bits = "";
        for (const c of setup.secret!)
          bits += "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
            .indexOf(c)
            .toString(2)
            .padStart(5, "0");
        const key = Buffer.from(
          bits.match(/.{8}/g)!.map((x) => parseInt(x, 2)),
        );
        const buffer = Buffer.alloc(8);
        buffer.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
        const h = createHmac("sha1", key).update(buffer).digest();
        const code = ((h.readUInt32BE(h[19] & 15) & 0x7fffffff) % 1000000)
          .toString()
          .padStart(6, "0");
        const enabled = await mfaAction(user, {
          action: "mfa_enable",
          currentPassword: password,
          code,
        });
        assert.ok("recoveryCodes" in enabled);
        process.env.APP_ENV = "production";
        try {
          await assert.rejects(
            mfaAction(user, {
              action: "mfa_disable",
              currentPassword: password,
              code,
            }),
            /إلزامي/,
          );
        } finally {
          process.env.APP_ENV = "staging";
        }
        const results = await Promise.all(
          Array.from({ length: 8 }, () =>
            verifyMfa("owner", enabled.recoveryCodes![0]),
          ),
        );
        assert.equal(results.filter(Boolean).length, 1);
        assert.equal(
          await getSessionUser(
            request("/api/auth/session", undefined, cookies.owner),
          ),
          null,
        );
      },
    );
    await t.test(
      "Malformed/oversized logos rejected before storage and bootstrap sealed by default",
      async () => {
        await assert.rejects(
          saveLogo(new File(["bad"], "fake.png", { type: "image/png" })),
          /PNG/,
        );
        await assert.rejects(
          saveLogo(
            new File([new Uint8Array(2097153)], "big.png", {
              type: "image/png",
            }),
          ),
          /2 ميجابايت/,
        );
        assert.equal(
          (await bootstrap(request("/api/server/admin", { action: "create" })))
            .status,
          404,
        );
      },
    );
  } finally {
    await closeDatabase();
    await fixture.end();
    await owner.query("DROP DATABASE " + name + " WITH(FORCE)");
    await owner.end();
  }
});
