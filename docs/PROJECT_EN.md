# Project documentation — Maintenance Union / Irbid

**Eng. Mohammad Twait** · **0790000000** · **owner@example.com**

## Purpose and scope

The system coordinates furniture maintenance bookings across multiple showrooms. Customers select a showroom by name/logo, followed by its services, execution location and available appointments. Each showroom has its own team, services, schedule and capacity within a shared database. The global owner controls all showrooms; managers are scoped to their showroom; employees operate only on assigned tasks.

This portable handoff uses Next.js on Node/Vercel, Supabase PostgreSQL and private Supabase Storage. It seeds no demo accounts or showrooms and contains no real secrets or previous live customer data. Follow `README_EN.md` or `README_AR.md` for installation.

## Code organization

| Path                       | Responsibility                                                                               |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| `app/customer-booking.tsx` | Customer workflow, showroom selection, bilingual copy and client validation                  |
| `app/portal/`              | Role-aware shared interface; booking, account, MFA, form and operations components           |
| `app/api/`                 | HTTP boundaries, bounded request parsing, authentication/origin checks and responses         |
| `lib/database.ts`          | Bounded PostgreSQL pool, verified TLS, parameter binding and transactions                    |
| `lib/auth.ts`              | Password hashing, comparison, sessions and cookies                                           |
| `lib/security-store.ts`    | Persistent attempt budgets, audit entries and transient cleanup                              |
| `lib/validation.ts`        | Names, phones, dates, times and JSON limits                                                  |
| `lib/union/`               | Showroom, service, schedule, booking, account and MFA domain operations                      |
| `lib/logo-storage.ts`      | Server-only private object access, including new secret API-key handling                     |
| `sql/`                     | Schema, constraints, RLS, grants, locks, indexes and bucket installation                     |
| `scripts/`                 | Owner bootstrap, secret generation and deployment checks                                     |
| `tests/`                   | Installer permission tests, PNG/key handling, real PostgreSQL flows and local browser checks |

SQL values are bound parameters. Dynamic filter clauses are selected from fixed source-controlled fragments. A showroom and its initial manager are created in one transaction. Password plaintext is never stored in application tables.

## Roles and interface

| Role         | Permitted operations                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------ |
| Customer     | Published services, public contact information and availability for active showrooms; submit a booking |
| Employee     | Own assigned task details/location; start and report completion; account security                      |
| Manager      | Showroom bookings, services, capacity, employee creation/management and completion approval            |
| Global owner | All showrooms, identity/logo edits, activation, managers/employees, bookings and audit visibility      |

Only the global owner creates manager accounts. A self password change belongs to account security. Actions against another account require both scope permission and the actor's current password. Read-only accounts mask customer data and reject mutations on the server; none are seeded automatically.

Showroom creation is separate from profile/editing. Disable is red and enable is green. Contact and manager login numbers differ at creation. Home bookings request a useful home address/location; shop bookings use the showroom address on the server. The selected showroom remains visible throughout booking and in employee task details.

## Booking flow and capacity

Normal progression is `confirmed` → `assigned` → `in_progress` → `pending_admin_approval` → `completed`. Administrative cancellation moves eligible requests to `cancelled`. `rejected` is also represented in the data model. There is no arbitrary public status setter.

Availability derives from working days, hours, duration, team count and daily quota. Displaying an available time does not reserve it. PostgreSQL locks the showroom row during insertion, revalidates its schedule/service/capacity and rejects overlaps. This serializes reservations across application instances. Employee assignment locks the employee row and checks active employment, showroom membership, overlaps and employee daily capacity.

Cancellation releases capacity. Team reduction cannot undercut future reserved team numbers. Schedule editing does not silently move existing bookings; their original appointments remain for administrative follow-up. Showroom suspension blocks new reservations and preserves existing work.

The client keeps a random submission key for a pending attempt. Repeating that key with identical booking data returns the original reference after a lost response. Changing the data creates a new key. This does not promise recovery after browser data loss or a new browsing session.

Deleting an employee returns tasks that have not started to the assignment queue. In-progress tasks remain in the handover queue so a manager can transfer them with a reason, preserving status and notes. Completion requires a note of at least five characters before managerial approval.

## Synchronization and performance

Reservation correctness is enforced at database write time. A portal reloads after its mutations and polls every **15 seconds** while visible, with an explicit refresh control. Other portals may wait until their next poll; this release does not implement WebSocket push.

Bookings use pages of 50 rows and date/status/employee/search filters; owners can also filter by showroom. Indexes cover showroom/date, employee/date, sessions and rate-limit expiry. Each application instance has a pool of four connections. Use transaction pooling for serverless deployment and monitor total concurrency. No unlimited-user throughput claim or production load benchmark is made.

## Security model

- Protected APIs validate session, role and showroom scope. Hidden controls and private distribution of `/admin` are interface choices, not authorization.
- RLS is enabled for all application tables. `union_app` is a trusted backend role with backend policies; per-user tenant isolation is enforced by the API. Anonymous/browser roles have no access to the private schema.
- PBKDF2-HMAC-SHA256 uses **600,000** iterations, per-password random salt and stable server-side pepper. Random 256-bit sessions are stored as hashes, with HttpOnly/SameSite=Strict cookies, Secure on HTTPS and 12-hour expiry.
- `auth_version` invalidates stale sessions even if a physical stale row remains briefly. Password changes, disable/delete and all-device logout revoke prior sessions. Three incorrect current-password guesses pause account verification for 15 minutes.
- MFA is required for the global owner when `APP_ENV=production` and cannot be disabled through the production portal. Enroll first in controlled staging setup.
- TOTP secrets are AES-GCM encrypted with account-bound associated data. Time steps cannot be replayed; recovery codes are hashed and consumed once.
- Persistent login budgets cover account and source IP; booking budgets cover phone and source IP. JSON/PNG streams are size-bounded. Source-IP protection requires a trusted forwarding proxy. Provider WAF/DDoS defenses remain necessary.
- CSP, nosniff, framing denial and browser permission headers are included. Next.js inline bootstrap requires an inline allowance in this release; a nonce-based policy is a possible later improvement that needs full testing. CSP is not a replacement for authorization or XSS prevention.
- Logo input is normalized locally and independently decoded/re-encoded on the server, validating CRC, dimensions and size. Objects remain private; the public logo API only retrieves objects linked to a registered showroom.
- Database audit triggers run within account/booking mutations; application audit adds actor attribution. The runtime role cannot edit/delete audit entries.
- Application tables are not exposed through the Data API, and browser code receives no database/storage credentials. A leaked storage secret has broad provider privileges and requires immediate rotation/investigation.

## Search and operations

Set the canonical `APP_ORIGIN` and `APP_ENV=production` at build time for the real domain. Sitemap contains only the customer root; internal portals and APIs send noindex. Customer pages do not link to internal login portals, and the showroom directory does not list the owner. Search-engine behavior or historical URL removal cannot be guaranteed.

This release has no payment processing, SMS or customer phone OTP verification. WhatsApp/telephone contact happens only when users choose the external link. A submitted phone is not proven to belong to the customer; CAPTCHA or phone verification can be added if abuse warrants the cost and privacy review.

The stated 12-month review of closed customer records is an **owner-operated manual procedure**, not an implemented automatic erasure job. Retain only required data and verify identity for correction/deletion requests. Backup and recovery procedures are in `OPERATIONS.md`.

## Useful future work

Prioritize periodic restore drills, API/error monitoring, abuse-triggered CAPTCHA and realistic load tests after installation. Later options include audited rescheduling, approved notifications, finer management roles and private tenant push updates. Payment/SMS services or separate databases per showroom should follow a concrete operational need, budget and new tests.

Application-specific source and documentation rights are reserved to Eng. Mohammad Twait; third-party resources retain their licenses (`NOTICE.md`).
