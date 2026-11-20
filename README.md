# Maintenance Union — اتحاد الصيانة - إربد

Copyright © 2026 **Eng. Mohammad Twait**. All rights reserved.

**Owner:** Eng. Mohammad Twait · **Phone:** 0790000000 · **Email:** owner@example.com

This is the portable **v1 deployment handoff**, using Next.js, PostgreSQL on Supabase and private Supabase Storage. All database access runs on the server. No platform-specific hosting runtime, hosted-site account or model API is required.

ابدأ من [دليل التنصيب العربي](README_AR.md). Start with the [English deployment guide](README_EN.md).

| Resource                                    | Purpose                                                                                 |
| ------------------------------------------- | --------------------------------------------------------------------------------------- |
| `sql/01-install.sql`                        | Fresh database schema, constraints, RLS, runtime grants and booking locks; no demo data |
| `sql/02-storage.sql`                        | Private logo bucket with a 2 MiB PNG limit                                              |
| `.env.example`                              | Environment names; contains no real credentials                                         |
| `docs/PROJECT_AR.md` / `docs/PROJECT_EN.md` | Architecture, roles, behavior and maintenance                                           |
| `docs/VALIDATION.md`                        | Verified scope and remaining deployment acceptance checks                               |
| `docs/OPERATIONS.md`                        | Backup, restore, recovery and incident handling                                         |
| `NOTICE.md`                                 | Application ownership and retained third-party rights                                   |

```sh
npm ci
npm test
npm run lint
npm run typecheck
npm run build
```

For a real local PostgreSQL test server, follow `README_EN.md` → testing. The browser checks have a separate command. Do not point tests at production.

The source archive is **not a backup of an existing live database or its uploaded logos**. Installation creates a new empty system. Existing data migration is a separate, explicitly planned operation. No default accounts or shared passwords are installed.

Security is layered and must be maintained. A successful test run is evidence for the tested scenarios, not a guarantee of zero defects or immunity from every attack. Verify the final hosting, secrets, storage and restore process before opening real bookings.
