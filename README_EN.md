# Deployment guide — Maintenance Union / Irbid

**Owner:** Eng. Mohammad Twait · **0790000000** · **owner@example.com**

This handoff runs the preserved customer, showroom manager, employee and global administration interfaces on **Next.js + Supabase PostgreSQL + private Supabase Storage**, with **Vercel** as the primary hosting path. It has no runtime dependency on the previous hosted-site platform or any model API.

## 1. Prerequisites and local source check

Use a private [GitHub repository](https://github.com/), [Supabase account](https://supabase.com/dashboard), [Vercel account](https://vercel.com/new), a password manager and [Node.js](https://nodejs.org/en/download) 22.13+ from a supported release. Select Node 22 in Vercel. Enable account MFA on the hosting, database and Git providers.

Extract the archive. In the directory containing `package.json`, run:

```sh
npm ci
npm test
npm run lint
npm run typecheck
npm run build
```

Commit the complete source, including the supplied configuration files and `package-lock.json`. Do not commit `.env`, `.env.secrets`, `.next` or `node_modules`; the supplied ignore file excludes secrets and generated files. `npm ci` installs the exact locked dependency tree. A successful source build does not provision your cloud resources.

## 2. Plans and domain ownership

Prices checked **5 October 2026**, in USD; reconfirm before purchase. Additional usage, taxes, extra projects, team seats and domains can increase cost.

| Provider                                                    | Suggested plan                                      | Base price reviewed                                       |
| ----------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------- |
| [Vercel pricing](https://vercel.com/pricing)                | Pro for this commercial client                      | From $20/month per developer seat                         |
| [Supabase pricing](https://supabase.com/pricing)            | Pro for real data and managed database backups      | From $25/month                                            |
| [Cloudflare Registrar](https://www.cloudflare.com/domains/) | Register and manage a domain in the owner's account | Depends on the actual name and TLD; check renewal pricing |

For one developer seat and the basic single project, the two service plans start at approximately **$45/month**, excluding domain, tax and excess usage. [Vercel Hobby](https://vercel.com/docs/plans/hobby) is restricted to personal, non-commercial use. Supabase Free is useful for a limited test environment; do not treat it as the real-data backup plan. A Supabase custom-domain add-on is unnecessary for this application.

Choose a database region close to users and a Vercel function region close to that database. Domain availability is not assumed. Set usage alerts and review spend settings; not every charge is necessarily stopped by a budget threshold.

## 3. Install the PostgreSQL schema

1. Create a **new** Supabase project. Save its database administrator password securely and wait until the project is ready. That password differs from every website account password.
2. Open **SQL Editor → New query**. Paste the complete contents of `sql/01-install.sql` and run it. It creates `union_private`, eight tables, constraints, indexes, runtime grants, RLS and reservation/assignment guards.
3. Run this installer **once on an empty project**. If the schema already exists, verify the selected project before doing anything else. Do not drop a database to resolve a duplicate-schema error. Installation is transactional.
4. In a second query run `sql/02-storage.sql`. In Storage verify `showroom-logos` is **Private**, allows PNG only and has a **2 MiB** maximum file size. Do not add public upload/read policies. Do not modify provider-owned schema structures or migration tables.
5. Do not add `union_private` to Data API exposed schemas. This application connects to PostgreSQL from its server; browsers use the application's API, not the database.

**Firebase choice:** this release supports PostgreSQL through Supabase. Cloud Firestore does not execute the installer SQL. A Firestore implementation requires a different data adapter and separate concurrency/security verification; no unsupported Firebase connection is included.

## 4. Generate secrets and provision the limited runtime role

```sh
node scripts/generate-secrets.mjs
```

This creates a local `.env.secrets` with restrictive permissions, refuses to overwrite an existing file and does not print the values. Open it locally, store its contents in a password manager and keep it out of Git and the source handoff. It contains:

- `AUTH_SECRET`: stable password pepper and MFA encryption input. Preserve it for restore/recovery.
- `ADMIN_CLI_SECRET`: temporary bootstrap/recovery authorization.
- `RUNTIME_DB_PASSWORD`: an independent database connection password.
- `BOOTSTRAP_ADMIN_PASSWORD`: a random **16-character** website password containing upper/lowercase letters, a number and a symbol, matching the agreed password policy.

The SQL installer creates `union_app` with **NOLOGIN**. For the simplest setup, paste the generated runtime password into this statement in SQL Editor:

```sql
ALTER ROLE union_app LOGIN PASSWORD 'PASTE_THE_GENERATED_RUNTIME_PASSWORD_HERE';
```

Do not run the placeholder as a real password. Generated values use URL-safe characters. Do not save the resulting query with its actual password in the repository or screenshots. The runtime must not use the `postgres` administrative role.

Alternatively, the deployment team can temporarily supply `ADMIN_DATABASE_URL` using the **Direct connection or Session pooler**, plus `RUNTIME_DB_PASSWORD`, in local `.env`, then run `npm run db:role`. The script quotes the password with PostgreSQL and verifies TLS. Remove both variables from any deployed environment. Set `DATABASE_CA_PEM` to the provider CA if required.

From Supabase **Connect**, select **Transaction pooler**, usually port **6543**, for serverless hosting. Copy your actual host, port and project reference. Use `union_app.PROJECT_REF` instead of `postgres.PROJECT_REF`, and the runtime role password rather than the website administrator password:

```text
postgresql://union_app.PROJECT_REF:ENCODED_PASSWORD@EXACT_POOLER_HOST:6543/postgres
```

Do not invent a host or region. URL-encode reserved password characters if you choose your own password; the generator produces URL-safe values. Transaction pooling does not support named prepared statements; this adapter uses unnamed parameterized queries. See [Supabase connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres).

## 5. Environment configuration

Copy `.env.example` to local `.env` and fill it privately:

| Variable                   | Value                                                                                  |
| -------------------------- | -------------------------------------------------------------------------------------- |
| `APP_ORIGIN`               | Locally `http://localhost:3000`; deployed exact canonical HTTPS origin with no path    |
| `APP_ENV`                  | `staging` during setup; `production` after acceptance                                  |
| `DATABASE_URL`             | Transaction pooler connection using `union_app`                                        |
| `DATABASE_CA_PEM`          | Provider CA PEM if needed; actual newlines or escaped `\n`                             |
| `AUTH_SECRET`              | Generated stable secret; retain an encrypted recovery copy                             |
| `SUPABASE_URL`             | Project URL, e.g. `https://PROJECT_REF.supabase.co`                                    |
| `SUPABASE_STORAGE_SECRET`  | A server secret key from API Keys; legacy service-role JWT supported for compatibility |
| `SUPABASE_LOGO_BUCKET`     | `showroom-logos`                                                                       |
| `ADMIN_CLI_ENABLED`        | `true` only for controlled bootstrap/recovery, otherwise `false`                       |
| `ADMIN_CLI_SECRET`         | Bootstrap authorization secret                                                         |
| `BOOTSTRAP_ADMIN_NAME`     | `Eng. Mohammad Twait`                                                                  |
| `BOOTSTRAP_ADMIN_PHONE`    | `0790000000`                                                                           |
| `BOOTSTRAP_ADMIN_PASSWORD` | Generated initial website password                                                     |

Never prefix secrets with `NEXT_PUBLIC_`. Storage secret keys bypass provider RLS and must remain server-only; the normal PostgreSQL connection uses the limited role separately. New `sb_secret_` keys are sent only through `apikey`, not as JWT bearer tokens. `DATABASE_TLS=local-only` is restricted to a loopback test database and must remain unset for Supabase/production. Remote certificate verification is never disabled.

For a local app connected to a **staging** database, run `npm run dev` and open [localhost:3000](http://localhost:3000). Do not use real customer data for development.

## 6. Deploy on Vercel

1. Push the source to the owner's private GitHub repository. Limit access and protect the main branch.
2. In Vercel select **Add New → Project → Import Git Repository**.
3. Choose **Next.js**, the root containing `package.json`, Node 22, install command `npm ci`, and build command `npm run build`. Keep the default output directory.
4. Add environment values from the table. Begin with `APP_ENV=staging`. Do **not** upload `BOOTSTRAP_ADMIN_*` values; only the local administrative script needs them. Do not deploy `ADMIN_DATABASE_URL`.
5. Configure `APP_ORIGIN` with the production project URL you will actually use, deploy, and verify the opened hostname matches it. A changing preview URL must not become the real site's canonical origin.
6. Protect previews using the team's available **Deployment Protection** and a separate staging Supabase project. Do not inherit production secrets into arbitrary preview branches.
7. Redeploy when build-time values such as `APP_ORIGIN` or `APP_ENV` change; metadata, robots and the sitemap are generated during the build.

This is not a static-only export. Generic static hosting or a cPanel file upload without a Node server cannot run its API. For a standalone Node host, use `npm ci`, `npm run build`, then `npm start` behind a maintained HTTPS reverse proxy. The proxy must set/replace `Host`, `X-Forwarded-Proto` and `X-Forwarded-For`, reject spoofed client forwarding headers and keep the raw Node/PostgreSQL ports off the public Internet.

## 7. Bootstrap the owner, then seal administrative setup

1. Set the local `.env` `APP_ORIGIN` to the deployed origin and supply the matching CLI secret plus bootstrap account fields. Temporarily enable `ADMIN_CLI_ENABLED=true` in the deployed environment.
2. Run `npm run admin:create`. It only creates the first global administrator; a database unique constraint also prevents concurrent duplicate owners.
3. Privately open `/admin`, sign in, and enable two-factor authentication in **أمان حسابي**. Store recovery codes in the owner's password manager. They are one-use codes, and enabling MFA revokes existing sessions.
4. Set `ADMIN_CLI_ENABLED=false`, remove the CLI secret from the deployed environment when unused, remove local bootstrap credentials from day-to-day configuration and redeploy.
5. The sealed `/api/server/admin` endpoint returns 404. Recovery needs a controlled temporary re-enablement with a fresh secret, followed immediately by resealing; see `docs/OPERATIONS.md`.
6. Configure hosting firewall/rate rules for login and reservation routes. Database-backed application budgets persist across instances; they complement provider DDoS protection.

No `admin2005`, default account or shared password is seeded. Each new showroom and employee should receive a separate strong password.

## 8. Portal addresses

Replace `https://YOUR_DOMAIN` with the real origin:

| Audience                           | URL                            |
| ---------------------------------- | ------------------------------ |
| Customers                          | `https://YOUR_DOMAIN/`         |
| Showroom portal directory          | `https://YOUR_DOMAIN/portals`  |
| Showroom manager                   | `https://YOUR_DOMAIN/showroom` |
| Employee                           | `https://YOUR_DOMAIN/team`     |
| Global owner, private distribution | `https://YOUR_DOMAIN/admin`    |

The customer interface has no links to internal portals. The showroom directory lists manager and employee portals only. Knowing a URL does not grant database access: every protected API checks authentication, role and showroom scope. Login pages remain reachable to request authentication. If the owner also requires network-level restriction of `/admin`, the deployment team should configure an external identity-aware gateway/WAF and test its interaction with the shared protected API and other portal roles.

## 9. Domain, HTTPS and search indexing

Buy the domain in the owner's account. Add it under **Vercel → Project → Settings → Domains**, then copy **the exact DNS records Vercel presents** into the domain provider. Choose a single canonical domain, redirect the other variant to it and wait for HTTPS certificate issuance.

Set `APP_ORIGIN` to that domain and `APP_ENV=production`, then redeploy. Check `/robots.txt` and `/sitemap.xml`. The sitemap lists the customer root only. Internal portals carry `noindex` in HTML and HTTP headers. Submit the sitemap through [Google Search Console](https://search.google.com/search-console/about).

Indexing is neither guaranteed nor immediate. `noindex` is a crawler instruction, not an authorization mechanism. If old portal URLs were already indexed, use Search Console removal and verify crawlers receive the new header.

## 10. Cloud acceptance before real bookings

With final local `.env` matching the deployment, run:

```sh
npm run check:env
npm run check:deployment
```

The latter checks PostgreSQL TLS, the runtime role, table RLS, owner MFA and private bucket settings without printing secrets. Fix failed connectivity checks before opening bookings. Then use a real showroom configuration to verify:

- Logo upload, persisted retrieval after reload, replacement and deletion of the old object.
- Two-device reservation contention, available capacity and a retry after a lost response returning the same reference.
- Tenant boundary enforcement, employee-only assigned tasks, and denial of substituted showroom/account/booking IDs.
- Assignment, execution note, manager approval, disable/delete/revoke-session behavior and authenticated password resets.
- Correct old password, confirmation mismatch, hash persistence, all-device logout and three-guess verification lockout.
- No customer-facing administrative links, desktop/mobile display, both booking languages and slow-network loading animation.
- Database and object export, then a **restore into an independent staging project**. A source archive alone is not a live-data backup.

The installation database starts empty. Perform experiments in a separate project rather than removing test data with arbitrary SQL. Record the final cloud acceptance results. See `docs/VALIDATION.md` for tested scope and `docs/OPERATIONS.md` for recovery.

## 11. Reproduce deeper tests

`npm test` checks installer permissions using embedded PostgreSQL and logo/API-key handling with a mocked storage transport. It does not prove cloud connectivity or multi-connection races by itself.

For real local PostgreSQL, provide `TEST_ADMIN_DATABASE_URL` in the shell environment using a disposable loopback server with `CREATE DATABASE` and test-role administration rights, then run:

```sh
npm run test:integration
```

The runner creates its own temporary database, installs the schema and drops that database afterwards. It rejects remote hosts. Use local PostgreSQL or Docker; never remove the guard or supply a production connection. Configure a dedicated local test administrator and authentication; do not expose its database port beyond loopback.

For browser checks: `npx playwright install chromium` once, start the local application in another terminal, then `npm run test:ui`. `UI_TEST_URL` must be local. Optional `UI_ADMIN_PHONE` and `UI_ADMIN_PASSWORD` expand verification using a **local test account**. Screenshots go to `tests/artifacts` and are excluded from source distribution. Complete the manual booking flow too.

## 12. Troubleshooting

| Symptom                     | Check                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------- |
| PostgreSQL connection fails | Actual Connect host/port, `union_app.PROJECT_REF`, role password and CA; do not disable TLS |
| No showrooms                | New installation is empty; add an active showroom and a published service                   |
| Logo upload fails           | Private bucket exists, server secret is correct, valid image and 2 MiB limit                |
| Save returns 403            | Opened origin matches `APP_ORIGIN`; authenticated role and scope match the portal           |
| 429                         | Wait for the stated cooldown; do not delete production budgets to bypass it                 |
| Search page missing         | Production build mode, canonical URL, sitemap, Search Console and indexing delay            |
| Blank page/500              | Sanitized runtime logs, complete `npm ci`, environment configuration and redeploy           |

Application source/documentation rights are reserved to Eng. Mohammad Twait. Frameworks, packages and external assets retain their own licenses; see `NOTICE.md`.
