// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
import { getDatabase } from "../../../../lib/security-store";
import { logoBucket } from "../../../../lib/union/logos";
import { errorResponse } from "../../../../lib/union/access";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const key = new URL(request.url).pathname.split("/").pop() || "";
    if (!/^[0-9a-f-]{36}$/.test(key))
      return new Response(null, { status: 404 });
    const linked = await getDatabase()
      .prepare(
        "SELECT id FROM union_private.showrooms WHERE logo_url = ? LIMIT 1",
      )
      .bind("/api/logos/" + key)
      .first();
    if (!linked) return new Response(null, { status: 404 });
    const object = await logoBucket().get("showroom-logos/" + key);
    if (!object) return new Response(null, { status: 404 });
    return new Response(object.body, {
      headers: {
        "Content-Type":
          object.httpMetadata?.contentType || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
