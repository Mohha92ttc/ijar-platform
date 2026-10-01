# تشغيل واستضافة إيجار (Ops) — هدف 100/100

## المتطلبات
- Node.js 20+
- PostgreSQL 14+
- `pg_dump` في PATH للنسخ الاحتياطي
- متغيرات البيئة في `.env` (انظر `.env.example`)

## أمان الإنتاج (إلزامي — يفشل الإقلاع بدونها)
1. `NODE_ENV=production`
2. `JWT_SECRET` عشوائي ≥ 32 حرفاً
3. `ALLOWED_ORIGINS` بالنطاقات الفعلية فقط
4. `SMTP_HOST` + `SMTP_USER` + `SMTP_PASS` (بريد حقيقي)
5. `ENABLE_MOCK_AUTH` غير مفعّل
6. Helmet CSP تلقائي في production
7. جلسة `httpOnly` cookie: `ijar_token`

## فحص الجاهزية
```bash
# كأدمن بعد تسجيل الدخول
GET /api/admin/readiness
# يعيد { ready, score, checks[] }
```

## الملفات / Object Storage
- افتراضي: قرص محلي `/uploads` (مناسب لعقدة واحدة + volume)
- إنتاج متعدد العقد: عيّن S3 المتوافق (AWS / Cloudflare R2 / MinIO):

```
S3_BUCKET=ijar-proofs
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_REGION=auto
S3_ENDPOINT=https://xxx.r2.cloudflarestorage.com   # اختياري
S3_PUBLIC_BASE_URL=https://cdn.example.com           # اختياري
S3_PREFIX=proofs
```

## Stripe
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```
- Webhook URL: `POST /api/payments/stripe/webhook`
- حدث: `checkout.session.completed` → موافقة تلقائية على دفعة الحجز
- بدون Stripe: التحويل البنكي اليدوي كامل

## النسخ الاحتياطي (مجدول)
```bash
npm run backup
# أو يومياً عبر cron:
# 0 3 * * * cd /app && npm run backup >> /var/log/ijar-backup.log 2>&1
```
- يحفظ `backups/ijar_*.dump` + لقطة `uploads_*`
- الاحتفاظ: `BACKUP_KEEP_DAYS` (افتراضي 14)

استعادة:
```bash
pg_restore -h $DB_HOST -U $DB_USER -d $DB_NAME --clean backups/ijar_YYYY-MM-DD.dump
```

## المراقبة
- `/api/health` — للـ load balancer
- `/api/admin/readiness` — جاهزية إنتاج مفصّلة (أدمن فقط)
- stdout → journald / Cloud Logging

## التشغيل
```bash
npm install
npm run build
NODE_ENV=production npm run dev   # أو سكربت start الخاص بك
```

## العمولة
من إعدادات الأدمن: `commission_rate` (مثال `0.10` = 10%)
