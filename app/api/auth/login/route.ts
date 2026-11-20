// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
import {
  audit,
  cleanupTransientData,
  enforceRateLimit,
  getDatabase,
  sha256Hex,
} from "../../../../lib/security-store";
import {
  createSession,
  sessionCookie,
  sameOrigin,
  verifyPassword,
} from "../../../../lib/auth";
import { normalizeJordanPhone, readJson } from "../../../../lib/validation";

export const dynamic = "force-dynamic";
import { mfaEnabled, verifyMfa } from "../../../../lib/union/mfa";

type LoginPayload = {
  phone?: unknown;
  password?: unknown;
  expectedRole?: unknown;
  code?: unknown;
};

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request))
      return Response.json({ error: "invalid origin" }, { status: 403 });
    const payload = await readJson<LoginPayload>(request, 4096);
    const phone = normalizeJordanPhone(payload.phone);
    const password =
      typeof payload.password === "string" && payload.password.length <= 200
        ? payload.password
        : "";
    const expectedRole =
      payload.expectedRole === "admin" ||
      payload.expectedRole === "manager" ||
      payload.expectedRole === "employee"
        ? payload.expectedRole
        : null;
    if (!phone || password.length < 9 || !expectedRole) {
      return Response.json({ error: "invalid credentials" }, { status: 401 });
    }
    const ipAllowed = await enforceRateLimit(request, "login", "all", 30, 900);
    const accountAllowed = await enforceRateLimit(
      request,
      "login-account",
      phone,
      10,
      900,
      true,
    );
    if (
      !ipAllowed ||
      !accountAllowed ||
      !(await enforceRateLimit(request, "login", phone, 5, 900))
    ) {
      if (!accountAllowed)
        await audit(
          null,
          "login_throttled",
          "security",
          await sha256Hex(phone),
        );
      return Response.json(
        { error: "too many attempts" },
        { status: 429, headers: { "Retry-After": "900" } },
      );
    }
    await cleanupTransientData();
    const row = await getDatabase()
      .prepare(
        `
      SELECT id, name, phone, role, password_hash, password_salt, auth_version
      FROM union_private.staff WHERE phone = ? AND active = 1 AND deleted_at IS NULL LIMIT 1
    `,
      )
      .bind(phone)
      .first<{
        id: string;
        name: string;
        phone: string;
        role: "admin" | "manager" | "employee";
        password_hash: string;
        password_salt: string;
        auth_version: number;
      }>();
    // Equal password-work for absent accounts or a mismatched portal reduces enumeration timing.
    const validPassword = await verifyPassword(
      password,
      row?.password_salt || "AAAAAAAAAAAAAAAAAAAAAAAA",
      row?.password_hash || "A".repeat(43),
    );
    if (!row || row.role !== expectedRole || !validPassword) {
      await audit(null, "login_failed", "security", await sha256Hex(phone));
      return Response.json({ error: "invalid credentials" }, { status: 401 });
    }
    const secondFactor = await mfaEnabled(row.id);
    if (
      row.role === "admin" &&
      process.env.APP_ENV === "production" &&
      !secondFactor
    )
      return Response.json(
        {
          error:
            "التحقق بخطوتين مطلوب للإدارة العامة. أكمل إعداد الحماية في بيئة التنصيب المحكومة.",
        },
        { status: 401 },
      );
    if (secondFactor) {
      if (!(await verifyMfa(row.id, payload.code))) {
        await audit(row.id, "mfa_failed", "security", row.id);
        return Response.json(
          {
            error:
              "أدخل رمز تطبيق المصادقة أو رمز استرداد صالح؛ لا يمكن إعادة استخدام الرمز نفسه",
          },
          { status: 401 },
        );
      }
    }
    const session = await createSession(row.id, row.auth_version);
    await audit(row.id, "login", "staff", row.id);
    return Response.json(
      {
        user: { id: row.id, name: row.name, phone: row.phone, role: row.role },
      },
      {
        headers: {
          "Set-Cookie": sessionCookie(
            session.token,
            process.env.APP_ORIGIN?.startsWith("https://") ||
              new URL(request.url).protocol === "https:",
          ),
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return Response.json({ error: "login unavailable" }, { status: 503 });
  }
}
