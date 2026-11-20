// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
import { getDatabase, runtimeEnv, sha256Hex } from "../security-store";
import type { SessionUser } from "../auth";
import { verifyActorPassword } from "./account-security";
import { ApiError } from "./access";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32(bytes: Uint8Array) {
  let bits = 0,
    value = 0,
    out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += alphabet[(value >>> bits) & 31];
    }
  }
  if (bits) out += alphabet[(value << (5 - bits)) & 31];
  return out;
}
function decode(value: string) {
  let bits = 0,
    n = 0;
  const bytes: number[] = [];
  for (const c of value) {
    n = (n << 5) | alphabet.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((n >>> bits) & 255);
    }
  }
  return new Uint8Array(bytes);
}
async function encryptionKey() {
  const secret = runtimeEnv().AUTH_SECRET;
  if (!secret) throw new Error("authentication unavailable");
  const key = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode("maintenance-union:mfa:v1:" + secret),
  );
  return crypto.subtle.importKey("raw", key, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}
async function encrypt(value: string, staffId: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(staffId) },
    await encryptionKey(),
    new TextEncoder().encode(value),
  );
  return btoa(String.fromCharCode(...iv, ...new Uint8Array(encrypted)));
}
async function decrypt(value: string, staffId: string) {
  const bytes = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(
    await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: bytes.slice(0, 12),
        additionalData: new TextEncoder().encode(staffId),
      },
      await encryptionKey(),
      bytes.slice(12),
    ),
  );
}
async function counterFor(secret: string, code: string) {
  if (!/^\d{6}$/.test(code)) return null;
  const key = await crypto.subtle.importKey(
    "raw",
    decode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const now = Math.floor(Date.now() / 30000);
  for (const counter of [now, now - 1, now + 1]) {
    const bytes = new Uint8Array(8);
    new DataView(bytes.buffer).setBigUint64(0, BigInt(counter));
    const hash = new Uint8Array(await crypto.subtle.sign("HMAC", key, bytes));
    const offset = hash[19] & 15;
    const expected = (
      (new DataView(hash.buffer).getUint32(offset) & 0x7fffffff) %
      1000000
    )
      .toString()
      .padStart(6, "0");
    let diff = 0;
    for (let i = 0; i < 6; i++)
      diff |= code.charCodeAt(i) ^ expected.charCodeAt(i);
    if (!diff) return counter;
  }
  return null;
}
type Factor = {
  encrypted_secret: string;
  enabled: number;
  last_counter: number;
  recovery_hashes: string;
  pending_until: string;
};
export async function mfaEnabled(id: string) {
  return Boolean(
    await getDatabase()
      .prepare(
        "SELECT staff_id FROM union_private.account_mfa WHERE staff_id=? AND enabled=1",
      )
      .bind(id)
      .first(),
  );
}
/** Consuming a time step or recovery code is atomic, preventing replay across devices. */
export async function verifyMfa(id: string, value: unknown) {
  const factor = await getDatabase()
    .prepare(
      "SELECT * FROM union_private.account_mfa WHERE staff_id=? AND enabled=1",
    )
    .bind(id)
    .first<Factor>();
  if (!factor) return true;
  const code =
    typeof value === "string"
      ? value.trim().replace(/[- ]/g, "").toUpperCase()
      : "";
  if (/^[A-F0-9]{32}$/.test(code)) {
    const hash = await sha256Hex(id + ":" + code);
    const codes = JSON.parse(factor.recovery_hashes) as string[];
    if (!codes.includes(hash)) return false;
    const r = await getDatabase()
      .prepare(
        "UPDATE union_private.account_mfa SET recovery_hashes=? WHERE staff_id=? AND recovery_hashes=? AND enabled=1",
      )
      .bind(
        JSON.stringify(codes.filter((c) => c !== hash)),
        id,
        factor.recovery_hashes,
      )
      .run();
    return !!r.meta.changes;
  }
  const counter = await counterFor(
    await decrypt(factor.encrypted_secret, id),
    code,
  );
  if (counter === null) return false;
  const r = await getDatabase()
    .prepare(
      "UPDATE union_private.account_mfa SET last_counter=? WHERE staff_id=? AND enabled=1 AND encrypted_secret=? AND last_counter<?",
    )
    .bind(counter, id, factor.encrypted_secret, counter)
    .run();
  return !!r.meta.changes;
}
export async function mfaAction(user: SessionUser, p: Record<string, unknown>) {
  if (
    p.action === "mfa_disable" &&
    user.role === "admin" &&
    process.env.APP_ENV === "production"
  )
    throw new ApiError(
      403,
      "التحقق بخطوتين إلزامي للإدارة العامة أثناء التشغيل الفعلي",
    );
  await verifyActorPassword(user, p.currentPassword);
  const db = getDatabase();
  if (p.action === "mfa_setup") {
    if (await mfaEnabled(user.id))
      throw new ApiError(409, "التحقق بخطوتين مفعّل بالفعل");
    const secret = base32(crypto.getRandomValues(new Uint8Array(20)));
    const r = await db
      .prepare(
        `INSERT INTO union_private.account_mfa(staff_id,encrypted_secret,pending_until) VALUES (?,?,(CURRENT_TIMESTAMP + INTERVAL '10 minutes'))
      ON CONFLICT(staff_id) DO UPDATE SET encrypted_secret=excluded.encrypted_secret,pending_until=excluded.pending_until WHERE account_mfa.enabled=0`,
      )
      .bind(user.id, await encrypt(secret, user.id))
      .run();
    if (!r.meta.changes)
      throw new ApiError(409, "تغيرت إعدادات الأمان، حدّث الصفحة");
    return { ok: true, secret };
  }
  if (p.action === "mfa_enable") {
    const row = await db
      .prepare(
        "SELECT * FROM union_private.account_mfa WHERE staff_id=? AND enabled=0 AND pending_until>CURRENT_TIMESTAMP",
      )
      .bind(user.id)
      .first<Factor>();
    if (!row) throw new ApiError(400, "ابدأ إعداد التحقق بخطوتين من جديد");
    const counter = await counterFor(
      await decrypt(row.encrypted_secret, user.id),
      String(p.code || ""),
    );
    if (counter === null) throw new ApiError(400, "رمز التحقق غير صحيح");
    const codes = Array.from({ length: 8 }, () =>
      Array.from(crypto.getRandomValues(new Uint8Array(16)), (n) =>
        n.toString(16).padStart(2, "0"),
      )
        .join("")
        .toUpperCase(),
    );
    const hashes = await Promise.all(
      codes.map((c) => sha256Hex(user.id + ":" + c)),
    );
    const r = await db
      .prepare(
        "UPDATE union_private.account_mfa SET enabled=1,last_counter=?,recovery_hashes=? WHERE staff_id=? AND enabled=0 AND encrypted_secret=? AND pending_until>CURRENT_TIMESTAMP",
      )
      .bind(counter, JSON.stringify(hashes), user.id, row.encrypted_secret)
      .run();
    if (!r.meta.changes)
      throw new ApiError(409, "تغيرت إعدادات الأمان، حاول مجددًا");
    await db.batch([
      db
        .prepare(
          "UPDATE union_private.staff SET auth_version=auth_version+1 WHERE id=?",
        )
        .bind(user.id),
      db
        .prepare("DELETE FROM union_private.sessions WHERE staff_id=?")
        .bind(user.id),
    ]);
    return { ok: true, signedOut: true, recoveryCodes: codes };
  }
  if (p.action === "mfa_disable") {
    if (!(await mfaEnabled(user.id)) || !(await verifyMfa(user.id, p.code)))
      throw new ApiError(400, "رمز التحقق غير صحيح");
    await db.batch([
      db
        .prepare("DELETE FROM union_private.account_mfa WHERE staff_id=?")
        .bind(user.id),
      db
        .prepare(
          "UPDATE union_private.staff SET auth_version=auth_version+1 WHERE id=?",
        )
        .bind(user.id),
      db
        .prepare("DELETE FROM union_private.sessions WHERE staff_id=?")
        .bind(user.id),
    ]);
    return { ok: true, signedOut: true };
  }
  throw new ApiError(400, "إجراء غير معروف");
}
