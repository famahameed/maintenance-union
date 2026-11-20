// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
import { getDatabase } from "../security-store";
import type { SessionUser } from "../auth";
import type { Showroom } from "./types";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function requireAdmin(user: SessionUser) {
  if (user.role !== "admin")
    throw new ApiError(403, "هذه العملية متاحة للإدارة العامة فقط");
}
export async function requireShowroom(
  user: SessionUser,
  id: unknown,
): Promise<Showroom> {
  const selected = typeof id === "string" ? id : "";
  const showroomId = user.role === "admin" ? selected : user.showroom_id;
  if (user.role !== "admin" && selected && selected !== user.showroom_id)
    throw new ApiError(403, "لا تملك صلاحية الوصول لهذا المعرض");
  if (!showroomId) throw new ApiError(400, "اختر المعرض أولًا");
  const row = await getDatabase()
    .prepare("SELECT * FROM union_private.showrooms WHERE id = ?")
    .bind(showroomId)
    .first<Showroom>();
  if (!row) throw new ApiError(404, "المعرض غير موجود");
  return row;
}
export function errorResponse(error: unknown) {
  if (error instanceof ApiError)
    return Response.json(
      { error: error.message },
      {
        status: error.status,
        headers: error.status === 429 ? { "Retry-After": "900" } : undefined,
      },
    );
  const message = error instanceof Error ? error.message : "";
  if (message.includes("reserved team capacity"))
    return Response.json(
      { error: "لا يمكن تقليل عدد الفرق مع وجود حجوزات مستقبلية عليها" },
      { status: 409 },
    );
  if (message.includes("request too large"))
    return Response.json(
      { error: "حجم الطلب أكبر من المسموح" },
      { status: 413 },
    );
  if (error instanceof SyntaxError || message === "invalid content type")
    return Response.json({ error: "طلب غير صالح" }, { status: 400 });
  console.error("Union operation failed", error);
  return Response.json(
    { error: "تعذرت العملية، حاول مرة أخرى" },
    { status: 503 },
  );
}
