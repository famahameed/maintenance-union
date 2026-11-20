// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
import { getDatabase, runtimeEnv, sha256Hex } from "./security-store";

export type StaffRole = "admin" | "manager" | "employee";

export type SessionUser = {
  id: string;
  name: string;
  phone: string;
  role: StaffRole;
  showroom_id: string;
  auth_version: number;
  read_only?: number;
};

const COOKIE_NAME = "union_session";
// PBKDF2-HMAC-SHA256, unique salt and server-side pepper (new installations).
const PASSWORD_ITERATIONS = 600_000;

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(normalized);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function randomToken(bytes = 32): string {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return base64Url(data);
}

export async function hashPassword(
  password: string,
  salt = randomToken(18),
): Promise<{ hash: string; salt: string }> {
  const secret = runtimeEnv().AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("authentication is not configured");
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`${password}:${secret}`),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: new Uint8Array(fromBase64Url(salt)).buffer,
      iterations: PASSWORD_ITERATIONS,
    },
    material,
    256,
  );
  return { hash: base64Url(new Uint8Array(bits)), salt };
}

export async function verifyPassword(
  password: string,
  salt: string,
  expected: string,
): Promise<boolean> {
  const { hash } = await hashPassword(password, salt);
  if (hash.length !== expected.length) return false;
  let diff = 0;
  for (let index = 0; index < hash.length; index += 1)
    diff |= hash.charCodeAt(index) ^ expected.charCodeAt(index);
  return diff === 0;
}

function cookieValue(request: Request): string | null {
  const cookie = request.headers.get("cookie") ?? "";
  for (const item of cookie.split(";")) {
    const [name, ...rest] = item.trim().split("=");
    if (name === COOKIE_NAME) {
      try {
        return decodeURIComponent(rest.join("="));
      } catch {
        return null;
      }
    }
  }
  return null;
}

export async function createSession(
  staffId: string,
  authVersion: number,
): Promise<{ token: string; expiresAt: string }> {
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
  const inserted = await getDatabase()
    .prepare(
      "INSERT INTO union_private.sessions (token_hash, staff_id, expires_at,auth_version) SELECT ?,id,?,auth_version FROM union_private.staff WHERE id=? AND active=1 AND deleted_at IS NULL AND auth_version=?",
    )
    .bind(tokenHash, expiresAt, staffId, authVersion)
    .run();
  if (!inserted.meta.changes) throw new Error("account changed during sign-in");
  return { token, expiresAt };
}

export function sessionCookie(token: string, secure = true): string {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; ${secure ? "Secure; " : ""}SameSite=Strict; Max-Age=43200`;
}

export function clearSessionCookie(secure = true): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; ${secure ? "Secure; " : ""}SameSite=Strict; Max-Age=0`;
}

export async function destroySession(request: Request): Promise<void> {
  const token = cookieValue(request);
  if (!token) return;
  await getDatabase()
    .prepare("DELETE FROM union_private.sessions WHERE token_hash = ?")
    .bind(await sha256Hex(token))
    .run();
}

export async function getSessionUser(
  request: Request,
  allowed?: StaffRole[],
): Promise<SessionUser | null> {
  const token = cookieValue(request);
  if (!token) return null;
  const row = await getDatabase()
    .prepare(
      `
    SELECT staff.id, staff.name, staff.phone, staff.role, staff.showroom_id, staff.auth_version, staff.read_only
    FROM union_private.sessions
    JOIN union_private.staff ON staff.id = sessions.staff_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > CURRENT_TIMESTAMP AND staff.active = 1 AND staff.deleted_at IS NULL AND sessions.auth_version = staff.auth_version
    AND (staff.role <> 'admin' OR ?=0 OR EXISTS(SELECT 1 FROM union_private.account_mfa WHERE staff_id=staff.id AND enabled=1))
    LIMIT 1
  `,
    )
    .bind(await sha256Hex(token), process.env.APP_ENV === "production" ? 1 : 0)
    .first<SessionUser>();
  if (!row || (allowed && !allowed.includes(row.role))) return null;
  return row;
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") !== "cross-site";
  try {
    const expected = process.env.APP_ORIGIN || new URL(request.url).origin;
    return new URL(origin).origin === new URL(expected).origin;
  } catch {
    return false;
  }
}
