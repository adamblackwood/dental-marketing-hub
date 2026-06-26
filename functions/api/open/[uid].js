// functions/api/open/[uid].js
import { SUPABASE_URL, SUPABASE_ANON_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } from '../config.js';

// صورة GIF شفافة 1x1 بيكسل (Base64 صحيح ومُختبر)
const TRANSPARENT_GIF_BASE64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

function buildPixelResponse() {
  const gifBuffer = Uint8Array.from(atob(TRANSPARENT_GIF_BASE64), c => c.charCodeAt(0));
  return new Response(gifBuffer, {
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

    // لو لا يوجد UID، أرجِع البكسل فوراً دون تسجيل (لا تُظهر خطأ في البريد)
    if (!uid) {
      return buildPixelResponse();
    }

    // نُغلّف كل عمليات الكتابة داخل waitUntil حتى لا تؤخّر إرجاع الصورة
    context.waitUntil(
      (async () => {
        try {
          // 1. التأكد من وجود ملف الزائر (Upsert منطقي عبر GET -> PATCH أو POST)
          // هذا يمنع أخطاء الـ Foreign Key عند إدراج الأحداث للعملاء الباردين
          const profCheckRes = await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}&select=identified_email`, { headers: sbHeaders });
          const profCheckData = await profCheckRes.json();
          
          let email = 'Unknown';

          if (profCheckData && profCheckData.length > 0) {
            // الزائر موجود مسبقاً -> تحديث last_seen_at فقط
            email = profCheckData[0].identified_email || 'Unknown';
            await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}`, {
              method: 'PATCH',
              headers: sbHeaders,
              body: JSON.stringify({ last_seen_at: now })
            });
          } else {
            // زائر جديد (Cold Lead) -> إنشاء ملف جديد لمنع خطأ FK
            await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles`, {
              method: 'POST',
              headers: sbHeaders,
              body: JSON.stringify({
                uid,
                is_identified: false,
                lead_status: 'cold',
                lead_score: 0,
                total_visits: 0,
                total_conversions: 0,
                first_seen_at: now,
                last_seen_at: now
              })
            });
          }

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

          // 3. إدارة email_activities عبر (GET -> PATCH أو POST) لتجنب أخطاء القيود
          const eaRes = await fetch(
            `${SUPABASE_URL}/rest/v1/email_activities?uid=eq.${uid}&campaign_name=eq.${encodeURIComponent(campaign)}&select=open_count`,
            { headers: sbHeaders }
          );
          const eaData = await eaRes.json();

          if (eaData && eaData.length > 0) {
            // السجل موجود -> PATCH لزيادة العداد
            const currentCount = eaData[0].open_count || 0;
            await fetch(`${SUPABASE_URL}/rest/v1/email_activities?uid=eq.${uid}&campaign_name=eq.${encodeURIComponent(campaign)}`, {
              method: 'PATCH',
              headers: sbHeaders,
              body: JSON.stringify({
                open_count: currentCount + 1,
                last_open_at: now
              })
            });
          } else {
            // السجل غير موجود -> POST لإنشاء سجل جديد
            await fetch(`${SUPABASE_URL}/rest/v1/email_activities`, {
              method: 'POST',
              headers: sbHeaders,
              body: JSON.stringify({
                uid: uid,
                campaign_name: campaign,
                open_count: 1,
                last_open_at: now
              })
            });
          }

          // 4. إرسال إشعار تليجرام
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
          // أخطاء الكتابة لا يجب أن تؤثر على إرجاع الصورة — نتجاهلها بصمت هنا
          console.error('Email open tracking error:', innerErr);
        }
      })()
    );

    // 5. أرجِع البكسل الشفاف دائماً (حتى أثناء استمرار عمليات الكتابة في الخلفية)
    return buildPixelResponse();

  } catch (err) {
    // أي خطأ خارجي: أرجِع البكسل أيضاً حتى لا يظهر خطأ في عميل البريد
    console.error('Open pixel fatal error:', err);
    return buildPixelResponse();
  }
}