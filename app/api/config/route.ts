// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
import { getDatabase } from "../../../lib/security-store";
import { publicShowroom } from "../../../lib/union/schedule";
import { errorResponse } from "../../../lib/union/access";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const db = getDatabase();
    const showrooms = await db
      .prepare(
        "SELECT id,name,name_en,logo_url,phone,city,address FROM union_private.showrooms WHERE active = 1 ORDER BY name",
      )
      .all();
    const id = new URL(request.url).searchParams.get("showroomId");
    if (!id)
      return Response.json(
        { showrooms: showrooms.results },
        { headers: { "Cache-Control": "no-store" } },
      );
    const s = await publicShowroom(id);
    const types = await db
      .prepare(
        "SELECT id,name_ar,name_en FROM union_private.request_types WHERE showroom_id = ? AND published = 1 ORDER BY sort_order,id",
      )
      .bind(id)
      .all();
    return Response.json(
      {
        showrooms: showrooms.results,
        showroom: {
          id: s.id,
          name: s.name,
          name_en: s.name_en,
          logo_url: s.logo_url,
          phone: s.phone,
          city: s.city,
          address: s.address,
        },
        business: { phone: s.phone, cityAr: s.city, addressAr: s.address },
        settings: {
          bookingDurationMinute: s.booking_duration_minute,
          homeServiceEnabled: !!s.home_service_enabled,
          shopServiceEnabled: !!s.shop_service_enabled,
          workDays: JSON.parse(s.work_days),
        },
        requestTypes: types.results,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
