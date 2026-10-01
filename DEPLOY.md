# نشر إيجار (Neon + Render)

## المستودع
https://github.com/Mohha92ttc/ijar-platform

## Render Blueprint
افتح: https://render.com/deploy?repo=https://github.com/Mohha92ttc/ijar-platform

### متغيرات البيئة (املأها يدوياً)
انسخ `DATABASE_URL` من ملف `.env` المحلي (سطر Neon) أو من لوحة Neon → Connection string (pooled).

| المفتاح | القيمة |
|---------|--------|
| `DATABASE_URL` | من Neon (pooled) |
| `NODE_ENV` | `production` |
| `DB_SSL` | `true` |
| `DB_SKIP_CREATE` | `true` |
| `JWT_SECRET` | نص عشوائي ≥32 حرف (أو Generate) |
| `ALLOWED_ORIGINS` | بعد أول نشر: `https://اسم-خدمتك.onrender.com` |
| `APP_URL` | نفس رابط Render |

### بعد النشر
1. افتح الرابط
2. دخول أدمن: `admin@ijar.iq` / `admin123` ثم غيّر الباسورد
3. حدّث `ALLOWED_ORIGINS` و `APP_URL` إذا لزم وأعد Deploy
