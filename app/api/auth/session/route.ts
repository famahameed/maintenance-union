// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
import { getSessionUser } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  return Response.json(
    { user },
    { status: user ? 200 : 401, headers: { "Cache-Control": "no-store" } },
  );
}
