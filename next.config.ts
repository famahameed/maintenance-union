import type { NextConfig } from "next";

if (process.env.APP_ENV === "production") {
  for (const name of [
    "APP_ORIGIN",
    "DATABASE_URL",
    "AUTH_SECRET",
    "SUPABASE_URL",
    "SUPABASE_STORAGE_SECRET",
  ])
    if (!process.env[name])
      throw new Error(name + " is required in production");
  if (
    !process.env.APP_ORIGIN?.startsWith("https://") ||
    (process.env.AUTH_SECRET || "").length < 32
  )
    throw new Error(
      "Production requires a canonical HTTPS origin and a strong authentication secret",
    );
}

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self)",
  },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  // Next's inline bootstrap needs unsafe-inline; script-src still excludes third-party origins.
  {
    key: "Content-Security-Policy",
    value:
      "default-src 'self'; script-src 'self' 'unsafe-inline'" +
      (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "") +
      "; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  },
];
const nextConfig: NextConfig = {
  poweredByHeader: false,
  agentRules: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      ...[
        "/admin/:path*",
        "/showroom/:path*",
        "/team/:path*",
        "/portals/:path*",
        "/privacy/:path*",
        "/api/:path*",
      ].map((source) => ({
        source,
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      })),
    ];
  },
};
export default nextConfig;
