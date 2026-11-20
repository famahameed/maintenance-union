// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
import { publicShowroom, availableSlots } from "../../../lib/union/schedule";
import { errorResponse } from "../../../lib/union/access";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const q = new URL(request.url).searchParams;
    const showroom = await publicShowroom(q.get("showroomId") || "");
    return Response.json(
      await availableSlots(showroom, q.get("date") || "", q.get("mode") || ""),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
