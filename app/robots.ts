// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  const origin = process.env.APP_ORIGIN || "http://localhost:3000";
  return process.env.APP_ENV === "production"
    ? {
        rules: { userAgent: "*", allow: "/", disallow: ["/api/"] },
        sitemap: origin + "/sitemap.xml",
      }
    : { rules: { userAgent: "*", disallow: "/" } };
}
