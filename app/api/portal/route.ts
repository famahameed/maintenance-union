// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
import {
  getSessionUser,
  sameOrigin,
  clearSessionCookie,
} from "../../../lib/auth";
import { readJson, cleanText } from "../../../lib/validation";
import { readShowroomPayload } from "../../../lib/union/logos";
import { audit, enforceRateLimit } from "../../../lib/security-store";
import { mfaAction } from "../../../lib/union/mfa";
import { ApiError, errorResponse } from "../../../lib/union/access";
import { portalData } from "../../../lib/union/portal-data";
import { showroomAction } from "../../../lib/union/showrooms";
import { staffAction } from "../../../lib/union/staff";
import { serviceAction } from "../../../lib/union/services";
import { bookingAction } from "../../../lib/union/bookings";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) throw new ApiError(401, "سجل الدخول للمتابعة");
    return Response.json(await portalData(user, new URL(request.url)), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) throw new ApiError(403, "مصدر الطلب غير صالح");
    const user = await getSessionUser(request);
    if (!user) throw new ApiError(401, "سجل الدخول للمتابعة");
    const p = request.headers
        .get("content-type")
        ?.startsWith("multipart/form-data")
        ? await readShowroomPayload(request)
        : await readJson<Record<string, unknown>>(request, 24576),
      action = cleanText(p.action, 60);
    if (user.read_only)
      throw new ApiError(
        403,
        "هذا حساب عرض تجريبي للقراءة فقط؛ لا يمكن تعديل البيانات أو الحسابات",
      );
    let result;
    if (["mfa_setup", "mfa_enable", "mfa_disable"].includes(action)) {
      if (
        !(await enforceRateLimit(
          request,
          "mfa-settings",
          user.id,
          5,
          300,
          true,
        ))
      )
        throw new ApiError(429, "حاول مجددًا بعد خمس دقائق");
      result = await mfaAction(user, p);
    } else if (
      [
        "create_showroom",
        "update_showroom",
        "toggle_showroom",
        "save_settings",
      ].includes(action)
    )
      result = await showroomAction(user, p);
    else if (
      [
        "create_staff",
        "create_employee",
        "toggle_staff",
        "toggle_employee",
        "reset_password",
        "change_password",
        "revoke_sessions",
        "logout_all_self",
        "delete_staff",
      ].includes(action)
    )
      result = await staffAction(user, p);
    else if (["add_request_type", "toggle_request_type"].includes(action))
      result = await serviceAction(user, p);
    else if (
      [
        "assign_booking",
        "handover_booking",
        "cancel_booking",
        "approve_booking",
        "employee_start",
        "employee_complete",
      ].includes(action)
    )
      result = await bookingAction(user, p);
    else throw new ApiError(400, "إجراء غير معروف");
    try {
      await audit(
        user.id,
        action,
        "union",
        cleanText(p.bookingId || p.showroomId || p.staffId || p.typeId, 80),
        { showroomId: p.showroomId || user.showroom_id },
      );
    } catch (e) {
      console.error("Audit failed", e);
    }
    return Response.json(result, {
      headers: {
        "Cache-Control": "no-store",
        ...("signedOut" in result && result.signedOut
          ? {
              "Set-Cookie": clearSessionCookie(
                process.env.APP_ORIGIN?.startsWith("https://") ||
                  new URL(request.url).protocol === "https:",
              ),
            }
          : {}),
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
