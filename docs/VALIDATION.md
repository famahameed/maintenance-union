# Release validation — تقرير التحقق

Release: **v1.0.0 portable deployment handoff** · Reviewed: **2026-10-05**.

Owner: **Eng. Mohammad Twait** · **0790000000** · **owner@example.com**.

## العربية

هذه نتائج تشغيل فعلي في بيئة اختبار محلية، وليست شهادة اختراق مستقلة أو ضمان أمان وخلو من الأخطاء بنسبة 100%. لم تُنشأ أو تُربط لهذه الحزمة مشاريع Supabase أو Vercel فعلية أو دومين إنتاج. الموقع القديم ليس نشرًا لهذه النسخة المحمولة.

| الفحص                      | النتيجة ونطاقها                                                                                                                                                                              |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`             | نجح دون أخطاء أو تحذيرات من ESLint                                                                                                                                                           |
| `npm run typecheck`        | نجح فحص TypeScript                                                                                                                                                                           |
| `npm test`                 | نجحت 3 اختبارات للمخطط والصلاحيات ومفاتيح التخزين والتحقق من PNG                                                                                                                             |
| `npm run test:integration` | نجحت 17 نتيجة اختبار، تشمل الاختبار الرئيسي و16 حالة فرعية، على PostgreSQL حقيقي محلي                                                                                                        |
| الحجز المتزامن             | 20 طلبًا متزامنًا لموعد بسعة 2: حجزان ناجحان و18 رفض تعارض، دون تجاوز السعة                                                                                                                  |
| الصلاحيات والحسابات        | اختُبر عزل معرضين، الحساب للقراءة فقط، إسناد الموظفين، إنشاء الحسابات وتعطيلها وحذفها، تأكيد كلمة المرور القديمة وقفل التخمين بعد 3 محاولات وإلغاء الجلسات                                   |
| التحقق بخطوتين             | اختُبر الإعداد والتفعيل، إلزام الإدارة العامة به في الإنتاج، منع تعطيله هناك، ورفض إعادة استعمال رمز الاسترداد تحت التزامن                                                                   |
| إعادة محاولة الحجز         | استُخدم المفتاح نفسه دون إنشاء حجز مكرر؛ بيانات مختلفة بالمفتاح نفسه تُرفض                                                                                                                   |
| `npm run build`            | نجح بناء Next.js 16.3.8 للإنتاج                                                                                                                                                              |
| `npm run test:ui`          | فحص Chromium على عرضي 1440 و390 بكسل: واجهة العميل، صفحات الدخول، لوحة الإدارة، ملف المعرض وتعديله ورفع الشعار؛ لا تجاوز عرض أو أخطاء صفحة JavaScript في السيناريوهات المختبرة               |
| فصل البوابات               | صفحة العميل دون روابط الإدارة أو الموظفين؛ البوابات الخاصة ترسل `noindex`؛ API المحمي يرفض الطلب غير المسجل                                                                                  |
| TLS                        | عمل خادم Next في وضع الإنتاج مع PostgreSQL واتصال TLS يتحقق من شهادة الاختبار؛ لم يُعطّل التحقق للاتصال                                                                                      |
| الشعارات                   | نجح رفع PNG من الواجهة وقراءته عبر API مع خدمة HTTPS محلية تحاكي التخزين الخاص؛ اختُبرت ترويسة المفتاح السري الحديث                                                                          |
| النسخ والاستعادة           | نجح `npm run backup`، ثم `pg_restore` إلى قاعدة اختبار منفصلة، وإعادة منح صلاحيات الدور والتحقق من الجداول الثمانية وحساب المالك؛ نجح `npm run restore:logos` لشعار واحد مع التحقق من البصمة |
| تبعيات npm                 | أبلغ `npm audit` عن 0 ثغرات معروفة في جميع تبعيات هذا القفل وقت الفحص؛ النتيجة لا تغطي ثغرات غير معروفة أو إعداد الاستضافة                                                                   |

قاعدة التكامل كانت معزولة وبلا بيانات عميل حقيقية. استُخدم PostgreSQL 18.4 محليًا؛ يجب تثبيت إصدار أدوات PostgreSQL المناسب للخادم المستهدف عند النسخ والاستعادة. فحص واجهة الإنتاج استخدم `APP_ENV=staging` حتى لا تُفهرس التجربة؛ سياسات حساب المالك الخاصة بالإنتاج اختُبرت داخل اختبارات التكامل.

لم تُختبر في حسابات سحابية حقيقية: DNS وشهادة الدومين، مسبح الاتصالات المدار، أسرار Vercel، إعدادات حساب Supabase وبucket الفعلي، مراقبة التكلفة، WAF، النسخ والاستعادة من تلك الخدمات. لم يُجر اختبار حمل ممتد أو اختبار اختراق مستقل. سعة الحجز تُحسم داخل قاعدة البيانات فور الطلب؛ تحديث الشاشات الأخرى استطلاع كل 15 ثانية أثناء ظهور الصفحة، وليس بثًا لحظيًا عبر WebSocket.

### قبول فريق النشر قبل فتح الحجوزات

1. اتبع `README_AR.md` على مشروع فارغ، ولا تنفّذ SQL التثبيت فوق بيانات قائمة.
2. أنشئ أسرارًا جديدة، فعّل TLS والتحقق من الشهادة، استخدم دور `union_app` المحدود، ولا تنشر اتصال إدارة قاعدة البيانات أو كلمة مرور التهيئة في Vercel.
3. أنشئ المالك في بيئة محمية مؤقتة، فعّل التحقق بخطوتين، وأغلق CLI واحذف سره، ثم أعد النشر بإعدادات الإنتاج والدومين النهائي.
4. نفّذ `npm run check:env` و`npm run check:deployment` مع إعدادات المشروع الحقيقي من جهاز الفريق المحمي.
5. جرّب حجزين متزامنين، عزل معرضين، تحميل الشعار، تغيير كلمة المرور وإخراج الجلسات، وتعطيل المعرض وحساباته. لا توجّه اختبارات التكامل المحلية إلى الإنتاج.
6. نفّذ النسخ والاستعادة إلى مشروع staging منفصل مع الشعارات ونسخة `AUTH_SECRET` الأصلية المحفوظة مشفرة، وافحص الحسابات والحجوزات بعدها.
7. تحقق من أن sitemap يتضمن العميل فقط، وأن البوابات الخاصة تحمل `noindex`، ومن عدم وجود أسرار في ملفات المتصفح. التخفي عن محركات البحث ليس حاجز صلاحيات؛ طلبات البيانات تُحمى على الخادم.
8. اضبط حماية حسابات الاستضافة، تنبيهات التكلفة، السجلات والنسخ الدورية وفق `docs/OPERATIONS.md`.

هذه حزمة المصدر والمخطط، وليست نسخة من بيانات الموقع السابق أو شعاراته. لا توجد حسابات أو كلمات مرور تجريبية مزروعة في التثبيت.

## English

These are executed local checks, not an independent penetration-testing certificate or a promise of 100% security or zero defects. No live Supabase/Vercel project or production domain has been linked to this archive. The previous hosted site is not a deployment of this portable release.

| Check              | Result and scope                                                                                                                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Lint / TypeScript  | Passed without ESLint errors or warnings; TypeScript passed                                                                                                                                                                                      |
| Unit/schema tests  | 3 passed: private schema, runtime/anonymous access, Storage key headers and PNG validation/re-encoding                                                                                                                                           |
| Integration        | 17 passing test results: parent plus 16 subtests, against a fresh real local PostgreSQL database                                                                                                                                                 |
| Booking contention | 20 concurrent requests into capacity 2 produced 2 successful reservations and 18 conflicts                                                                                                                                                       |
| Authorization      | Two-showroom isolation, read-only masking/write denial, employee allocation, account creation/disable/delete, password confirmation, three-attempt verification lockout and global session revocation exercised                                  |
| MFA                | Enrollment/enabling, production owner requirement and disable prohibition, and concurrent one-use recovery codes exercised                                                                                                                       |
| Retry safety       | Identical submission retries return the existing receipt; changed data with the same key is rejected                                                                                                                                             |
| Production build   | Next.js 16.3.8 build passed                                                                                                                                                                                                                      |
| Browser            | Chromium desktop 1440px and mobile 390px: customer flow, private login pages, admin showroom profile/edit, PNG upload and retrieval; no horizontal overflow or JavaScript page errors in exercised paths                                         |
| Portal separation  | No internal portal links on the customer page; private pages send noindex; unauthenticated protected API request rejected                                                                                                                        |
| TLS                | Production-mode Next server communicated with local PostgreSQL using verified TLS and a test CA                                                                                                                                                  |
| Backup/restore     | The backup command exported a custom database dump and one linked logo. pg_restore restored a separate database; eight tables, owner account and restored grants were checked. The logo restore command validated and uploaded the exported logo |
| Dependency audit   | npm audit reported 0 known vulnerabilities for all locked dependencies at review time; this is not a hosting or unknown-vulnerability assessment                                                                                                 |

Local PostgreSQL was 18.4, with matching client tools. Integration fixtures contained no real customer data. The production-server GUI check used APP_ENV=staging; production owner MFA policies were exercised in integration tests. Private Storage used a local HTTPS contract mock, not a real managed Supabase bucket.

Not exercised against a live cloud account: domain/DNS/HTTPS provisioning, managed connection pooling, cloud secrets and account permissions, the actual Storage bucket, WAF, cost limits, or provider backup/restore. No extended load test or independent penetration test was performed. Database reservations serialize immediately; visible dashboards poll every 15 seconds rather than using instant push.

### Deployment acceptance

Follow README_EN.md on a fresh project; provision new secrets and the restricted union_app runtime role with verified TLS. Bootstrap the owner in a protected staging environment, enroll MFA, seal the CLI, remove its secret, and redeploy with production settings. Run check:env and check:deployment against the chosen environment. Manually verify real Storage, simultaneous reservations, cross-showroom access denial, password/session revocation and suspension. Perform a full database/logo restore drill into an independent staging project with the separately encrypted original AUTH_SECRET. Confirm customer-only sitemap and private noindex headers, protected hosting accounts, monitoring and recurring backups before accepting real bookings.

The archive contains application source and fresh-install SQL, not the previous live database or uploaded objects. No demo accounts or shared passwords are installed. Follow OPERATIONS.md for ongoing patching, rotation, recovery and backup duties.
