// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
import {
  audit,
  enforceRateLimit,
  getDatabase,
  runtimeEnv,
  sha256Hex,
} from "../../../../lib/security-store";
import { hashPassword } from "../../../../lib/auth";
import { validManagerPassword } from "../../../../lib/union/password";
import {
  cleanText,
  normalizeJordanPhone,
  readJson,
} from "../../../../lib/validation";

export const dynamic = "force-dynamic";

type AdminPayload = {
  action?: unknown;
  name?: unknown;
  phone?: unknown;
  password?: unknown;
};

async function secureEqual(left: string, right: string): Promise<boolean> {
  const [leftHash, rightHash] = await Promise.all([
    sha256Hex(left),
    sha256Hex(right),
  ]);
  let difference = 0;
  for (let index = 0; index < leftHash.length; index += 1) {
    difference |= leftHash.charCodeAt(index) ^ rightHash.charCodeAt(index);
  }
  return difference === 0;
}

export async function POST(request: Request) {
  try {
    if (process.env.ADMIN_CLI_ENABLED !== "true")
      return Response.json({ error: "not found" }, { status: 404 });
    if (!(await enforceRateLimit(request, "admin-cli", "terminal", 10, 3600))) {
      return Response.json(
        { error: "too many requests" },
        { status: 429, headers: { "Retry-After": "3600" } },
      );
    }

    const authorization = request.headers.get("authorization") ?? "";
    const suppliedSecret = authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";
    const configuredSecret = runtimeEnv().ADMIN_CLI_SECRET ?? "";
    if (
      !configuredSecret ||
      configuredSecret.length < 32 ||
      !(await secureEqual(suppliedSecret, configuredSecret))
    ) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }

    const payload = await readJson<AdminPayload>(request, 8192);
    const action = cleanText(payload.action, 30);
    const phone = normalizeJordanPhone(payload.phone);
    const password =
      typeof payload.password === "string"
        ? cleanText(payload.password, 200)
        : "";
    if (!phone || !validManagerPassword(password)) {
      return Response.json({ error: "invalid admin details" }, { status: 400 });
    }

    const db = getDatabase();
    const passwordData = await hashPassword(password);

    if (action === "create") {
      // Bootstrap is permitted only before the first admin exists. Recovery must
      // never erase a live administrator or its history.
      const existing = await db
        .prepare(
          "SELECT id FROM union_private.staff WHERE role = 'admin' LIMIT 1",
        )
        .first();
      if (existing)
        return Response.json(
          { error: "admin already initialized" },
          { status: 409 },
        );
      const name = cleanText(payload.name, 80);
      if (name.length < 3)
        return Response.json({ error: "invalid admin name" }, { status: 400 });
      const id = crypto.randomUUID();
      await db.batch([
        db
          .prepare(
            "INSERT INTO union_private.staff (id, name, phone, password_hash, password_salt, role, active) VALUES (?, ?, ?, ?, ?, 'admin', 1)",
          )
          .bind(id, name, phone, passwordData.hash, passwordData.salt),
      ]);
      await audit(id, "admin_created_from_terminal", "staff", id);
      return Response.json({ ok: true });
    }

    if (action === "password") {
      const result = await db
        .prepare(
          `
        UPDATE union_private.staff SET password_hash = ?, password_salt = ?, active = 1, auth_version = auth_version + 1
        WHERE phone = ? AND role = 'admin'
      `,
        )
        .bind(passwordData.hash, passwordData.salt, phone)
        .run();
      if (!result.meta.changes)
        return Response.json({ error: "admin not found" }, { status: 404 });
      await db
        .prepare(
          "DELETE FROM union_private.sessions WHERE staff_id IN (SELECT id FROM union_private.staff WHERE phone = ? AND role = 'admin')",
        )
        .bind(phone)
        .run();
      await audit(null, "admin_password_changed_from_terminal", "staff", phone);
      return Response.json({ ok: true });
    }

    return Response.json({ error: "unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Admin account operation failed", error);
    const message = error instanceof Error ? error.message : "";
    if (message.includes("request too large"))
      return Response.json({ error: message }, { status: 413 });
    return Response.json(
      { error: "admin operation unavailable" },
      { status: 503 },
    );
  }
}
