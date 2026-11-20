// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  return process.env.APP_ENV === "production"
    ? [
        {
          url: process.env.APP_ORIGIN || "http://localhost:3000",
          changeFrequency: "weekly",
          priority: 1,
        },
      ]
    : [];
}
