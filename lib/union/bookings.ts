// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
import { getDatabase } from "../security-store";
import { ApiError, requireShowroom } from "./access";
import { SessionUser } from "../auth";
import { cleanText } from "../validation";
import type { Booking } from "./types";
export async function assignAutomatically(
  bookingId: string,
  showroomId: string,
) {
  const employees = await getDatabase()
    .prepare(
      `SELECT s.id,COUNT(b.id) AS workload FROM union_private.staff s LEFT JOIN union_private.bookings b ON b.assigned_staff_id = s.id AND b.status NOT IN ('cancelled','rejected','completed') WHERE s.showroom_id = ? AND s.role = 'employee' AND s.active = 1 GROUP BY s.id ORDER BY workload,s.name`,
    )
    .bind(showroomId)
    .all<{ id: string }>();
  for (const employee of employees.results) {
    try {
      const r = await getDatabase()
        .prepare(
          "UPDATE union_private.bookings SET assigned_staff_id = ?,status = 'assigned',updated_at = CURRENT_TIMESTAMP WHERE id = ? AND assigned_staff_id IS NULL AND status = 'confirmed'",
        )
        .bind(employee.id, bookingId)
        .run();
      if (r.meta.changes) return;
    } catch (e) {
      if (!(e instanceof Error) || !e.message.includes("employee capacity"))
        throw e;
    }
  }
}
export async function bookingAction(
  user: SessionUser,
  p: Record<string, unknown>,
) {
  const db = getDatabase(),
    id = cleanText(p.bookingId, 80),
    action = String(p.action);
  if (action === "employee_complete" && cleanText(p.note, 1000).length < 5)
    throw new ApiError(
      400,
      "اكتب ملاحظة تنفيذ واضحة من 5 أحرف على الأقل قبل إنهاء المهمة",
    );
  const booking = await db
    .prepare("SELECT * FROM union_private.bookings WHERE id = ?")
    .bind(id)
    .first<Booking>();
  if (!booking) throw new ApiError(404, "الطلب غير موجود");
  await requireShowroom(user, booking.showroom_id);
  if (user.role === "employee") {
    if (booking.assigned_staff_id !== user.id)
      throw new ApiError(403, "هذه المهمة ليست مسندة لك");
    let result;
    if (action === "employee_start")
      result = await db
        .prepare(
          "UPDATE union_private.bookings SET status = 'in_progress',updated_at = CURRENT_TIMESTAMP WHERE id = ? AND assigned_staff_id = ? AND status = 'assigned'",
        )
        .bind(id, user.id)
        .run();
    else if (action === "employee_complete")
      result = await db
        .prepare(
          "UPDATE union_private.bookings SET status = 'pending_admin_approval',completion_note = right(completion_note || chr(10) || ?, 4000),updated_at = CURRENT_TIMESTAMP WHERE id = ? AND assigned_staff_id = ? AND status = 'in_progress'",
        )
        .bind(cleanText(p.note, 1000), id, user.id)
        .run();
    else throw new ApiError(403, "هذه العملية غير مسموحة للموظف");
    if (!result.meta.changes)
      throw new ApiError(409, "تغيرت حالة الطلب، حدّث القائمة");
    return { ok: true };
  }
  if (action === "assign_booking" || action === "handover_booking") {
    const handover = action === "handover_booking";
    const reason = cleanText(p.note, 500);
    if (handover && reason.length < 5)
      throw new ApiError(
        400,
        "اكتب سبب تسليم المهمة لموظف آخر (5 أحرف على الأقل)",
      );
    try {
      const r = await db
        .prepare(
          handover
            ? "UPDATE union_private.bookings SET assigned_staff_id=?,completion_note=substr(completion_note || chr(10) || ?,1,2000),updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='in_progress'"
            : "UPDATE union_private.bookings SET assigned_staff_id = ?,status = 'assigned',updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status IN ('confirmed','assigned')",
        )
        .bind(
          ...(handover
            ? [cleanText(p.employeeId, 80), "تسليم المهمة: " + reason, id]
            : [cleanText(p.employeeId, 80), id]),
        )
        .run();
      if (!r.meta.changes)
        throw new ApiError(409, "لا يمكن إعادة إسناد طلب بدأ تنفيذه أو أُغلق");
    } catch (e) {
      if (e instanceof Error && e.message.includes("employee capacity"))
        throw new ApiError(
          409,
          "الموظف لا يتبع المعرض، أو لديه موعد متعارض، أو وصل لحده اليومي",
        );
      throw e;
    }
  } else if (action === "approve_booking") {
    const r = await db
      .prepare(
        "UPDATE union_private.bookings SET status = 'completed',updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending_admin_approval'",
      )
      .bind(id)
      .run();
    if (!r.meta.changes)
      throw new ApiError(409, "الطلب ليس بانتظار اعتماد الإنجاز");
  } else if (action === "cancel_booking") {
    const r = await db
      .prepare(
        "UPDATE union_private.bookings SET status='cancelled',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status NOT IN ('completed','cancelled','rejected')",
      )
      .bind(id)
      .run();
    if (!r.meta.changes) throw new ApiError(409, "لا يمكن إلغاء هذا الطلب");
  } else throw new ApiError(400, "إجراء غير معروف");
  return { ok: true };
}
