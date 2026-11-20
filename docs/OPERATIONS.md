# التشغيل والنسخ والاستعادة / Operations and recovery

**Eng. Mohammad Twait · 0790000000 · owner@example.com**

## عربي: ما الذي يجب حفظه؟

احفظ المصدر المضغوط، وقاعدة بيانات `union_private` الفعلية، وملفات شعارات Storage، ونسخة **مشفرة مستقلة** من `AUTH_SECRET` وإعدادات الخدمات لدى المالك. قاعدة البيانات تتضمن بيانات شخصية وتجزيئات كلمات المرور والجلسات ومفاتيح MFA المشفرة؛ لا ترسلها مع حزمة المصدر العادية. نسخ Supabase للداتا بيز لا تغني عن حفظ كائنات Storage. النسخ ليست مكتملة حتى ينجح اختبار استعادتها.

### إنشاء نسخة بيانات

1. اختر وقت صيانة، وأوقف الكتابة على النظام أثناء النسخة للحصول على تطابق قاعدة البيانات والشعارات. يمكن وضع بوابة الصيانة عند الاستضافة؛ إيقاف المعارض وحده لا يوقف عمليات الحسابات أو تحديث المهام.
2. جهّز أدوات PostgreSQL client (`pg_dump` و`pg_restore`) بإصدار major مطابق أو متوافق مع إصدار الخادم. استخدم اتصال **Direct أو Session pooler** للإدارة، لا Transaction pooler أثناء التصدير.
3. في ملف `.env` محلي خاص ضع مؤقتًا `ADMIN_DATABASE_URL`، وCA إن لزم، وإعدادات Supabase Storage. لا تُدخل اتصال الإدارة في Vercel أو الكود. نفّذ `npm run backup`.
4. ينتج مجلد `backups/<time>` فيه `database.dump` و`logos/` و`manifest.json` بملخص الملفات وSHA-256. السكربت لا يطبع كلمات المرور ولا يحفظ `AUTH_SECRET` داخله. إذا فشل أي شعار أو pg_dump، فالنسخة غير مكتملة ولا تعتبرها ناجحة.
5. احفظ `AUTH_SECRET` الموافق لهذه النسخة في مدير كلمات مرور/حفظ أسرار مشفر منفصل. احذف بيانات الإدارة المؤقتة من بيئة التشغيل اليومي. شفّر مجلد النسخة قبل نسخه خارج الجهاز، وحدد صلاحيات الوصول ومدد الاحتفاظ، ثم أعد فتح النظام بعد اكتمال النسخة.

السكربت يصدر الشعارات المرتبطة حاليًا بالمعارض. لا يصدر كائنات قديمة غير مرتبطة. قاعدة البيانات والكائنات ليسا transaction موزعًا واحدًا؛ لذلك وقف الكتابة خلال النسخ خطوة لازمة للحصول على لقطة متطابقة. حتى مع النسخ المدارة، اختبر استعادة الملفات والأسرار أيضًا.

### الاستعادة في مشروع مستقل

1. أنشئ مشروع Supabase تجريبيًا **جديدًا وفارغًا**. لا تطبق التنصيب `01-install.sql` قبل استعادة dump كامل؛ الـ dump يحتوي مخططه بالفعل.
2. تحقق من checksums في `manifest.json` ومن مصدر النسخة. يمكن أن يحتوي SQL dump وظائف وDDL؛ لا تستعد نسخة مجهولة المصدر.
3. قبل `pg_restore` أنشئ الدور الذي تشير إليه سياسات RLS في SQL Editor:

```sql
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='union_app') THEN
    CREATE ROLE union_app NOLOGIN NOINHERIT;
  END IF;
END $$;
```

4. جهّز اتصال الإدارة عبر متغيرات PostgreSQL الآمنة على جهازك: `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`, `PGPASSWORD`, `PGSSLMODE=verify-full` و`PGSSLROOTCERT` إذا احتاج المزود CA. احتفظ بكلمة المرور خارج arguments ولا تنشر هذه المتغيرات. ثم:

```sh
pg_restore --exit-on-error --no-owner --no-privileges --dbname=postgres --schema=union_private /path/to/database.dump
```

5. شغّل `sql/03-restore-grants.sql` لتطبيق صلاحيات الدور المحدود مجددًا؛ `--no-privileges` تعني أنها لم تُستعد تلقائيًا. عيّن كلمة مرور جديدة للدور كما في README. لا تستعد قيمة اعتماديات بيئة قديمة عشوائيًا.
6. أنشئ bucket خاصًا من `sql/02-storage.sql`. ضع إعدادات مشروع الاستعادة الجديد و`APP_ENV=staging` في `.env` المحلي، ثم نفّذ `npm run restore:logos -- /path/to/backup-folder`. السكربت يتحقق من خصوصية bucket وSHA-256 وحجم الملفات، ويرفع الشعار بصيغة PNG إلى المفتاح الصحيح `showroom-logos/<UUID>` دون امتداد. لا تربطه ببيئة production.
7. استخدم `AUTH_SECRET` الأصلي من الحفظ المشفر؛ سر جديد لا يطابق كلمات المرور ومفاتيح MFA القديمة. غيّر بقية مفاتيح الخدمة/الاتصال بما يناسب المشروع الجديد. اترك `APP_ENV=staging` ولا تسمح بفهرسة أو وصول عام لتجربة الاستعادة.
8. أبطل جلسات النسخة السابقة من اتصال إدارة موثوق:

```sql
BEGIN;
DELETE FROM union_private.sessions;
UPDATE union_private.staff SET auth_version=auth_version+1;
COMMIT;
```

9. نفّذ `npm run check:deployment` وفحصًا كاملًا للحجز والشعار والمصادقة والصلاحيات. سجل الزمن والنتيجة. لا تغيّر DNS أو تفتح البيانات الحقيقية إلا بعد نجاح قبول البيئة المستعادة. لا تحذف المصدر القديم فورًا؛ احتفظ بمرجع rollback مشفر ومحدد المدة.

الخطوات تخص نسخ PostgreSQL **لهذا الإصدار**. بيانات النسخة السابقة على SQLite/D1 وتجزئاتها القديمة لا تُستورد باعتبارها PostgreSQL من خلال هذا الإجراء؛ تحتاج خطة تحويل وتعيين كلمات مرور واختبارات مستقلة.

### استعادة حساب الإدارة

إذا نسيت كلمة المرور وتملك رموز MFA، أعِد تفعيل `ADMIN_CLI_ENABLED=true` **مؤقتًا** مع `ADMIN_CLI_SECRET` جديد في الاستضافة. على جهاز المالك ضع العنوان والرقم وكلمة المرور الجديدة (16 محرفًا حسب السياسة) والمفتاح في `.env` المحلي، ثم `npm run admin:password`. العملية لا تمسح MFA؛ الدخول يحتاج رمزًا صالحًا. أقفل CLI مجددًا واحذف المفتاح وأعد النشر فورًا.

إذا فُقد الهاتف وكل رموز الاسترداد، فالإجراء محصور بمسؤول قاعدة البيانات بعد التحقق من ملكية الحساب: حوّل الموقع مؤقتًا إلى `APP_ENV=staging` خلف حماية وصول محكومة، واحذف صف MFA **للأدمن المحدد فقط** وأبطل جلساته وارفع auth_version، ثم أعد تهيئة MFA وحفظ الرموز وأعد `APP_ENV=production` والنشر قبل فتح التشغيل. لا تنفذ حذفًا عامًا لجدول MFA. مراجعة سجل التدقيق وإثبات الملكية مسؤولية التشغيل. فقدان `AUTH_SECRET` له آثار أوسع وقد يحتاج إعادة تعيين كلمات المرور وإعداد MFA لكل الحسابات.

### التسرب والحوادث والصيانة

عند الاشتباه بتسرب: أوقف الوصول المتأثر، دوّر كلمة DB أو مفتاح Storage حسب مصدر التسرب، أنهِ الجلسات، راجع سجل التدقيق وسجلات الاستضافة، أصلح السبب واختبر قبل الفتح. لا تدور `AUTH_SECRET` كإجراء عشوائي لأنه مرتبط بكلمات المرور والمصادقة المشفرة. احتفظ بالأدلة اللازمة للتحقيق دون نسخ بيانات شخصية غير لازمة.

قبل كل إصدار: اختبارات، build، مراجعة اعتماديات، نسخة قابلة للاستعادة وخطة rollback. عدّل المخطط بترحيلات إصدار محفوظة، لا بإعادة تشغيل installer أو patch عشوائي. راقب أخطاء API، زمن الاستجابة، حصص DB/Storage والاتصالات. مراجعة بيانات الطلبات المغلقة بعد 12 شهرًا إجراء يدوي لدى المالك؛ وثّق القرار والتحقق من الهوية ولا تحذف السجل المالي/المتعلق بنزاع دون متطلبات تشغيل واضحة.

## English: complete backup scope

Preserve source, the live `union_private` database, linked Storage logo objects and a **separate encrypted copy** of `AUTH_SECRET` plus provider configuration under the owner's control. Database dumps contain personal data, password hashes, sessions and encrypted MFA secrets; never distribute them as ordinary source code. Managed database backups do not replace object backups. A backup is proven useful only after a restore drill.

### Export

1. Use a maintenance window and stop **all writes** through the hosting layer. Suspending showrooms alone does not stop account/task mutations.
2. Install compatible PostgreSQL `pg_dump`/`pg_restore` client tools. Use an administrative **Direct or Session pooler** connection for export.
3. Temporarily set local `ADMIN_DATABASE_URL`, required CA and server Storage settings in a private `.env`. Never deploy the administrative database connection. Run `npm run backup`.
4. The timestamped `backups/` folder contains `database.dump`, currently linked logos and a SHA-256 manifest. The script does not print passwords or include `AUTH_SECRET`. Any export failure means the bundle is incomplete.
5. Store the matching `AUTH_SECRET` separately in encrypted secret storage. Remove temporary admin connection settings, encrypt the backup before off-site transfer, restrict access/retention and reopen writes after successful completion.

Only currently linked logos are exported. Database and object retrieval are not one distributed transaction, so write suspension is required for a consistent snapshot. Test the complete recovery even when provider backups are enabled.

### Restore

1. Create a **new empty staging Supabase project**. Do not run `01-install.sql` before a full dump restore: the dump reconstructs its schema.
2. Validate the manifest checksums and provenance. A database dump can contain executable DDL/functions; never restore an untrusted dump.
3. Create the `union_app NOLOGIN NOINHERIT` role before restoring policies, using the SQL block above.
4. Set local `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`, `PGPASSWORD`, `PGSSLMODE=verify-full` and the required `PGSSLROOTCERT`; keep passwords out of command arguments. Use the `pg_restore --exit-on-error --no-owner --no-privileges --dbname=postgres --schema=union_private /path/to/database.dump` command above.
5. Run `sql/03-restore-grants.sql`; privileges were intentionally excluded from the dump. Provision a fresh runtime role password following the README.
6. Install the private bucket with `02-storage.sql`. Configure the new restore project's credentials and `APP_ENV=staging` in local `.env`, then run `npm run restore:logos -- /path/to/backup-folder`. The script checks the private bucket, file SHA-256 and size, then uploads PNG content to the exact `showroom-logos/<UUID>` key without an extension. Never target production.
7. Restore the original `AUTH_SECRET` from encrypted storage. A new secret does not match stored password/MFA material. Configure new provider credentials, keep staging noindex and restrict the restore environment.
8. Revoke restored sessions using the transaction above: delete sessions and increment every account's auth_version.
9. Run `check:deployment` and full booking/logo/authentication/scope acceptance. Record results before changing DNS or opening real data. Keep a restricted, time-bounded rollback backup.

This procedure applies to PostgreSQL backups **from this release**. Old SQLite/D1 data and earlier password hashes require a separate transformation/reset plan.

### Owner access recovery

With valid MFA recovery codes, temporarily re-enable the CLI using a fresh authorization secret. Privately supply owner origin/phone/new policy-compliant password/secret in local `.env` and run `npm run admin:password`. It revokes previous sessions but does not remove MFA. Immediately reseal the endpoint, remove the secret and redeploy.

If the phone and all MFA recovery codes are lost, only a verified database operator should remove the **specific owner's** MFA row in temporarily controlled `APP_ENV=staging`, revoke its sessions, increment its auth_version and then re-enroll MFA, restore `APP_ENV=production` and redeploy before reopening. Do not delete MFA rows globally. Preserve an audit trail and verify account ownership. Losing `AUTH_SECRET` may require password resets and MFA re-enrollment for every affected account.

### Incidents and maintenance

For suspected credential leakage, restrict affected access, rotate the leaked database/storage credential, revoke sessions, review application/provider logs, fix the cause and retest. Do not rotate the password/MFA encryption secret casually. Preserve necessary evidence without unnecessary personal-data copies.

Before each release: tests, build, dependency review, proven backup and rollback plan. Use versioned schema migrations for future changes, not reinstalling the initial schema. Monitor API errors/latency, connection counts and service quotas. The 12-month closed-record review is an owner-operated procedure; document identity verification and necessary retention decisions.
