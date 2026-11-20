// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
import { getDatabase } from "../security-store";
import { SessionUser } from "../auth";
import { cleanText, toInteger } from "../validation";
import { ApiError, requireShowroom } from "./access";
export async function serviceAction(
  user: SessionUser,
  p: Record<string, unknown>,
) {
  if (user.role === "employee") throw new ApiError(403, "غير مسموح");
  const db = getDatabase();
  if (p.action === "add_request_type") {
    const s = await requireShowroom(user, p.showroomId),
      name = cleanText(p.nameAr, 100),
      en = cleanText(p.nameEn, 100);
    if (name.length < 3 || en.length < 3)
      throw new ApiError(400, "أدخل اسم الخدمة بالعربية والإنجليزية");
    const r = await db
      .prepare(
        "INSERT INTO union_private.request_types (showroom_id,name_ar,name_en,published,sort_order) VALUES (?,?,?,1,100) RETURNING id",
      )
      .bind(s.id, name, en)
      .run();
    return { ok: true, id: r.meta.last_row_id };
  }
  if (typeof p.published !== "boolean")
    throw new ApiError(400, "حالة نشر الخدمة غير صالحة");
  const id = toInteger(p.typeId, 1, 1000000);
  const target = await db
    .prepare("SELECT showroom_id FROM union_private.request_types WHERE id = ?")
    .bind(id)
    .first<{ showroom_id: string }>();
  if (!target) throw new ApiError(404, "الخدمة غير موجودة");
  await requireShowroom(user, target.showroom_id);
  await db
    .prepare(
      "UPDATE union_private.request_types SET published = ? WHERE id = ?",
    )
    .bind(p.published ? 1 : 0, id)
    .run();
  return { ok: true };
}
