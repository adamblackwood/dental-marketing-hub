// functions/api/p/[uid].js
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

export async function onRequestGet(context) {
  try {
    const uid = context.params.uid;
    if (!uid) return new Response('No UID', { status: 400 });

    const now = new Date().toISOString();
    const sbHeaders = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    };

    // تنفيذ عمليات قاعدة البيانات في الخلفية
    context.waitUntil(
      (async () => {
        try {
          // 1. التأكد من وجود ملف الزائر (Upsert منطقي)
          const profCheckRes = await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}&select=uid`, { headers: sbHeaders });
          const profCheckData = await profCheckRes.json();
          
          if (!profCheckData || profCheckData.length === 0) {
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

          // 2. إدارة email_activities (Upsert منطقي لتحديث entered_site)
          const eaCheckRes = await fetch(`${SUPABASE_URL}/rest/v1/email_activities?uid=eq.${uid}&select=uid`, { headers: sbHeaders });
          const eaCheckData = await eaCheckRes.json();

          if (eaCheckData && eaCheckData.length > 0) {
            // السجل موجود -> تحديث entered_site = true
            await fetch(`${SUPABASE_URL}/rest/v1/email_activities?uid=eq.${uid}`, {
              method: 'PATCH',
              headers: sbHeaders,
              body: JSON.stringify({ entered_site: true })
            });
          } else {
            // السجل غير موجود (نقر مباشر دون فتح مسبق) -> إنشاء سجل جديد
            await fetch(`${SUPABASE_URL}/rest/v1/email_activities`, {
              method: 'POST',
              headers: sbHeaders,
              body: JSON.stringify({
                uid,
                campaign_name: 'unknown_click',
                open_count: 0,
                entered_site: true,
                last_open_at: now
              })
            });
          }

          // 3. إدراج حدث email_click (مرة واحدة) لربط النقر في لوحة التحكم 360° View
          const evCheckRes = await fetch(`${SUPABASE_URL}/rest/v1/events?uid=eq.${uid}&event_type=eq.email_click&select=event_id`, { headers: sbHeaders });
          const evCheckData = await evCheckRes.json();

          if (!evCheckData || evCheckData.length === 0) {
            await fetch(`${SUPABASE_URL}/rest/v1/events`, {
              method: 'POST',
              headers: sbHeaders,
              body: JSON.stringify({
                event_uuid: crypto.randomUUID(),
                uid: uid,
                event_type: 'email_click',
                event_value: 'Cold Email Link',
                created_at: now
              })
            });
          }

        } catch (innerErr) {
          console.error('Click tracking error:', innerErr);
        }
      })()
    );

    // Redirect to homepage with identified UID
    return Response.redirect(`/?identified=${uid}`, 302);

  } catch (err) {
    return new Response('Error', { status: 500 });
  }
}