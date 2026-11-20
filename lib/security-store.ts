// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
import { getDatabase } from "./database";
export { getDatabase } from "./database";
export function runtimeEnv() {
  return {
    AUTH_SECRET: process.env.AUTH_SECRET,
    ADMIN_CLI_SECRET: process.env.ADMIN_CLI_SECRET,
  };
}

export async function audit(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId = "",
  details: Record<string, unknown> = {},
): Promise<void> {
  await getDatabase()
    .prepare(
      "INSERT INTO union_private.audit_log (actor_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(
      actorId,
      action,
      entityType,
      entityId,
      JSON.stringify(details).slice(0, 2000),
    )
    .run();
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function enforceRateLimit(
  request: Request,
  scope: string,
  discriminator: string,
  limit: number,
  windowSeconds: number,
  accountWide = false,
): Promise<boolean> {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  const key = await sha256Hex(
    `${scope}:${accountWide ? "account" : ip}:${discriminator}`,
  );
  const now = Date.now();
  const resetAt = new Date(now + windowSeconds * 1000).toISOString();
  const result = await getDatabase()
    .prepare(
      `
    INSERT INTO union_private.rate_limits (key, count, reset_at) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET
      count = CASE WHEN rate_limits.reset_at <= CURRENT_TIMESTAMP THEN 1 ELSE rate_limits.count + 1 END,
      reset_at = CASE WHEN rate_limits.reset_at <= CURRENT_TIMESTAMP THEN excluded.reset_at ELSE rate_limits.reset_at END
    RETURNING count, reset_at
  `,
    )
    .bind(key, resetAt)
    .first<{ count: number; reset_at: string }>();
  return Boolean(result && result.count <= limit);
}

export async function cleanupTransientData(): Promise<void> {
  const db = getDatabase();
  await db.batch([
    db.prepare(
      "DELETE FROM union_private.sessions WHERE expires_at <= CURRENT_TIMESTAMP",
    ),
    db.prepare(
      "DELETE FROM union_private.rate_limits WHERE reset_at <= (CURRENT_TIMESTAMP - INTERVAL '1 day')",
    ),
  ]);
}
