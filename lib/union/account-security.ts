// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
import { getDatabase, sha256Hex } from "../security-store";
import { verifyPassword, type SessionUser } from "../auth";
import { ApiError } from "./access";
import { validManagerPassword, MANAGER_PASSWORD_HINT } from "./password";

export function confirmedPassword(p: Record<string, unknown>): string {
  const password = typeof p.password === "string" ? p.password : "";
  if (!validManagerPassword(password))
    throw new ApiError(400, MANAGER_PASSWORD_HINT);
  if (password !== p.confirmPassword)
    throw new ApiError(400, "كلمة المرور الجديدة وتأكيدها غير متطابقين");
  return password;
}

// A shared, account-based budget persists across devices, sessions and IPs.
// Reserve before hashing so concurrent requests cannot exceed three guesses.
export async function verifyActorPassword(user: SessionUser, value: unknown) {
  const password = typeof value === "string" ? value : "";
  if (!password || password.length > 200)
    throw new ApiError(400, "أدخل كلمة مرور حسابك الحالي لتأكيد هويتك");
  const db = getDatabase();
  const key = await sha256Hex("account-verification:" + user.id);
  const reservation = await db
    .prepare(
      `
    INSERT INTO union_private.rate_limits (key,count,reset_at) VALUES (?,1,(CURRENT_TIMESTAMP + INTERVAL '15 minutes'))
    ON CONFLICT(key) DO UPDATE SET
      count = CASE WHEN rate_limits.reset_at <= CURRENT_TIMESTAMP THEN 1 ELSE rate_limits.count+1 END,
      reset_at = CASE WHEN rate_limits.reset_at <= CURRENT_TIMESTAMP THEN (CURRENT_TIMESTAMP + INTERVAL '15 minutes') ELSE rate_limits.reset_at END
    WHERE rate_limits.reset_at <= CURRENT_TIMESTAMP OR rate_limits.count < 3
    RETURNING count,reset_at
  `,
    )
    .bind(key)
    .first<{ count: number; reset_at: string }>();
  if (!reservation)
    throw new ApiError(
      429,
      "استُنفدت المحاولات الثلاث. انتظر 15 دقيقة من آخر محاولة خاطئة ثم حاول مجددًا",
    );
  const account = await db
    .prepare(
      "SELECT password_hash,password_salt FROM union_private.staff WHERE id=? AND active=1 AND deleted_at IS NULL AND auth_version=?",
    )
    .bind(user.id, user.auth_version)
    .first<{ password_hash: string; password_salt: string }>();
  if (!account) throw new ApiError(401, "انتهت الجلسة، سجل الدخول مجددًا");
  const correct = await verifyPassword(
    password,
    account.password_salt,
    account.password_hash,
  );
  if (!correct) {
    if (reservation.count === 3) {
      await db
        .prepare(
          "UPDATE union_private.rate_limits SET reset_at=(CURRENT_TIMESTAMP + INTERVAL '15 minutes') WHERE key=? AND count=3",
        )
        .bind(key)
        .run();
      throw new ApiError(
        429,
        "كلمة المرور غير صحيحة. استُنفدت المحاولات الثلاث؛ حاول بعد 15 دقيقة",
      );
    }
    throw new ApiError(
      400,
      `كلمة المرور غير صحيحة. المحاولات المتبقية: ${3 - reservation.count}`,
    );
  }
  // Do not erase attempts reserved concurrently after this successful check.
  await db
    .prepare(
      "DELETE FROM union_private.rate_limits WHERE key=? AND count=? AND reset_at=?",
    )
    .bind(key, reservation.count, reservation.reset_at)
    .run();
}
