// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
import {
  clearSessionCookie,
  destroySession,
  sameOrigin,
} from "../../../../lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "invalid origin" }, { status: 403 });
  await destroySession(request);
  return Response.json(
    { ok: true },
    {
      headers: {
        "Set-Cookie": clearSessionCookie(
          process.env.APP_ORIGIN?.startsWith("https://") ||
            new URL(request.url).protocol === "https:",
        ),
        "Cache-Control": "no-store",
      },
    },
  );
}
