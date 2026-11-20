// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
import type { Statement } from "../database";
import { getDatabase } from "../security-store";
import { hashPassword, type SessionUser } from "../auth";
import { cleanText, normalizeJordanPhone } from "../validation";
import { ApiError, requireAdmin, requireShowroom } from "./access";
import { confirmedPassword, verifyActorPassword } from "./account-security";

type Target = {
  id: string;
  role: string;
  showroom_id: string;
  auth_version: number;
};
export async function staffAction(
  user: SessionUser,
  p: Record<string, unknown>,
) {
  const db = getDatabase(),
    action = String(p.action);
  const self = action === "change_password" || action === "logout_all_self";
  if (!self && user.role === "employee") throw new ApiError(403, "غير مسموح");
  if (action === "create_staff" || action === "create_employee") {
    const room = await requireShowroom(user, p.showroomId);
    if (p.role && !["employee", "manager"].includes(String(p.role)))
      throw new ApiError(400, "صلاحية غير صالحة");
    const role = p.role === "manager" ? "manager" : "employee";
    if (role === "manager") requireAdmin(user);
    const phone = normalizeJordanPhone(p.phone),
      name = cleanText(p.name, 80),
      password = confirmedPassword(p);
    if (!phone || name.length < 3)
      throw new ApiError(400, "أدخل اسمًا ورقم دخول صحيحين");
    if (role === "manager" && phone === room.phone)
      throw new ApiError(400, "رقم الدخول يجب أن يختلف عن رقم تواصل المعرض");
    await verifyActorPassword(user, p.actorPassword);
    const h = await hashPassword(password),
      id = crypto.randomUUID();
    try {
      await db
        .prepare(
          "INSERT INTO union_private.staff (id,name,phone,password_hash,password_salt,role,showroom_id,read_only) VALUES (?,?,?,?,?,?,?,?)",
        )
        .bind(
          id,
          name,
          phone,
          h.hash,
          h.salt,
          role,
          room.id,
          p.readOnly === true ? 1 : 0,
        )
        .run();
    } catch (e) {
      if (e instanceof Error && "code" in e && e.code === "23505")
        throw new ApiError(409, "رقم الدخول مسجل مسبقًا");
      throw e;
    }
    return { ok: true, id };
  }
  const id = self ? user.id : cleanText(p.employeeId || p.staffId, 80);
  const target = await db
    .prepare(
      "SELECT id,role,showroom_id,auth_version FROM union_private.staff WHERE id=? AND deleted_at IS NULL",
    )
    .bind(id)
    .first<Target>();
  if (!target) throw new ApiError(404, "الحساب غير موجود");
  if (!self) {
    if (id === user.id || target.role === "admin")
      throw new ApiError(403, "استخدم صفحة أمان حسابي لإدارة حسابك");
    await requireShowroom(user, target.showroom_id);
    if (target.role === "manager") requireAdmin(user);
  }
  const changing = action === "change_password" || action === "reset_password";
  const password = changing ? confirmedPassword(p) : "";
  if (action === "change_password" && password === p.currentPassword)
    throw new ApiError(400, "اختر كلمة مرور مختلفة عن القديمة");
  if (action === "delete_staff" && p.confirmDelete !== true)
    throw new ApiError(400, "أكد حذف الحساب أولًا");
  if (
    ["toggle_staff", "toggle_employee"].includes(action) &&
    typeof p.active !== "boolean"
  )
    throw new ApiError(400, "حالة الحساب غير صالحة");
  if (
    ![
      "change_password",
      "reset_password",
      "toggle_staff",
      "toggle_employee",
      "delete_staff",
      "revoke_sessions",
      "logout_all_self",
    ].includes(action)
  )
    throw new ApiError(400, "إجراء غير معروف");
  await verifyActorPassword(user, self ? p.currentPassword : p.actorPassword);
  let statement: Statement;
  if (changing) {
    const h = await hashPassword(password);
    statement = db
      .prepare(
        "UPDATE union_private.staff SET password_hash=?,password_salt=?,auth_version=auth_version+1 WHERE id=? AND auth_version=? AND deleted_at IS NULL",
      )
      .bind(h.hash, h.salt, id, target.auth_version);
  } else if (action === "delete_staff") {
    statement = db
      .prepare(
        "UPDATE union_private.staff SET active=0,deleted_at=CURRENT_TIMESTAMP,auth_version=auth_version+1 WHERE id=? AND auth_version=? AND deleted_at IS NULL",
      )
      .bind(id, target.auth_version);
  } else if (["toggle_staff", "toggle_employee"].includes(action)) {
    statement = db
      .prepare(
        "UPDATE union_private.staff SET active=?,auth_version=auth_version+1 WHERE id=? AND auth_version=? AND deleted_at IS NULL",
      )
      .bind(p.active ? 1 : 0, id, target.auth_version);
  } else {
    statement = db
      .prepare(
        "UPDATE union_private.staff SET auth_version=auth_version+1 WHERE id=? AND auth_version=? AND deleted_at IS NULL",
      )
      .bind(id, target.auth_version);
  }
  const changes = [
    statement,
    db
      .prepare(
        "DELETE FROM union_private.sessions WHERE staff_id=? AND auth_version<> (SELECT auth_version FROM union_private.staff WHERE id=?)",
      )
      .bind(id, id),
  ];
  if (action === "delete_staff")
    changes.push(
      db
        .prepare(
          "UPDATE union_private.bookings SET assigned_staff_id=NULL,status='confirmed',updated_at=CURRENT_TIMESTAMP WHERE assigned_staff_id=? AND status='assigned' AND EXISTS (SELECT 1 FROM union_private.staff WHERE id=? AND deleted_at IS NOT NULL)",
        )
        .bind(id, id),
    );
  const results = await db.batch(changes);
  if (!results[0].meta.changes)
    throw new ApiError(
      409,
      "تغير الحساب أثناء العملية، حدّث الصفحة وحاول مجددًا",
    );
  return { ok: true, signedOut: self };
}
