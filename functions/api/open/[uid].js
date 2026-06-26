// functions/api/open/[uid].js
import { SUPABASE_URL, SUPABASE_ANON_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } from '../config.js';

// 1x1 Transparent GIF as raw bytes
const PIXEL_BYTES = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00,
  0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02,
  0x4c, 0x01, 0x00, 0x3b
]);

function buildPixelResponse() {
  return new Response(PIXEL_BYTES, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  });
}

const sbHeaders = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json'
};

export async function onRequestGet(context) {
  try {
    const uid = context.params.uid;
    const url = new URL(context.request.url);
    const campaign = url.searchParams.get('c') || 'unknown_campaign';
    const now = new Date().toISOString();

    // لو لا يوجد UID، أرجِع البكسل فوراً دون تسجيل
    if (!uid) {
      return buildPixelResponse();
    }

    // نُغلّف كل عمليات الكتابة داخل waitUntil حتى لا تؤخّر إرجاع الصورة
    context.waitUntil(
      (async () => {
        try {
          // 1. (الحل الجذري) Upsert لـ visitor_profiles
          // إذا كان الزائر جديداً (Cold Lead)، سيتم إنشاء ملف له تلقائياً لتجنب خطأ Foreign Key
          // إذا كان مسجلاً، لن يتأثر (Merge Duplicates).
          await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles`, {
            method: 'POST',
            headers: {
              ...sbHeaders,
              'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify({
              uid: uid,
              first_seen_at: now,
              last_seen_at: now,
              lead_score: 0,
              lead_status: 'cold',
              total_visits: 0,
              total_conversions: 0
            })
          });

          // 2. إدراج حدث email_open في جدول events
          await fetch(`${SUPABASE_URL}/rest/v1/events`, {
            method: 'POST',
            headers: sbHeaders,
            body: JSON.stringify({
              event_uuid: crypto.randomUUID(),
              uid: uid,
              event_type: 'email_open',
              event_value: campaign,
              created_at: now
            })
          });

          // 3. إدارة email_activities يدوياً (GET -> PATCH أو POST)
          const eaRes = await fetch(
            `${SUPABASE_URL}/rest/v1/email_activities?uid=eq.${uid}&campaign_name=eq.${encodeURIComponent(campaign)}&select=open_count`,
            { headers: sbHeaders }
          );
          const eaData = await eaRes.json();
          const exists = Array.isArray(eaData) && eaData.length > 0;
          const currentCount = exists ? (eaData[0].open_count || 0) : 0;

          if (exists) {
            // السجل موجود مسبقاً -> تحديث العداد فقط
            await fetch(
              `${SUPABASE_URL}/rest/v1/email_activities?uid=eq.${uid}&campaign_name=eq.${encodeURIComponent(campaign)}`,
              {
                method: 'PATCH',
                headers: sbHeaders,
                body: JSON.stringify({
                  open_count: currentCount + 1,
                  last_open_at: now
                })
              }
            );
          } else {
            // أول فتح للإيميل -> إدراج سجل جديد مع تضمين first_open_at
            await fetch(`${SUPABASE_URL}/rest/v1/email_activities`, {
              method: 'POST',
              headers: sbHeaders,
              body: JSON.stringify({
                uid: uid,
                campaign_name: campaign,
                open_count: 1,
                first_open_at: now,
                last_open_at: now
              })
            });
          }

          // 4. جلب الإيميل لإرساله في إشعار التليجرام
          const profRes = await fetch(
            `${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}&select=identified_email`,
            { headers: sbHeaders }
          );
          const profData = await profRes.json();
          let email = 'Anonymous (Cold Lead)';
          
          if (Array.isArray(profData) && profData.length > 0 && profData[0].identified_email) {
            email = profData[0].identified_email;
          }

          // 5. إرسال إشعار تليجرام
          const tgMsg = `📧 *Email Opened!*\n\n*Email:* ${email}\n*Campaign:* ${campaign}\n*UID:* ${uid}\n*Time:* ${now}`;
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: TELEGRAM_CHAT_ID,
              text: tgMsg,
              parse_mode: 'Markdown'
            })
          });

        } catch (innerErr) {
          console.error('Email open tracking error:', innerErr);
        }
      })()
    );

    // 6. أرجِع البكسل الشفاف دائماً
    return buildPixelResponse();

  } catch (err) {
    console.error('Open pixel fatal error:', err);
    return buildPixelResponse();
  }
}