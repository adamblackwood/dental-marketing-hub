// functions/api/p/[uid].js
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

export async function onRequestGet(context) {
  try {
    const uid = context.params.uid;
    if (!uid) return new Response('No UID', { status: 400 });

    const url = new URL(context.request.url);
    const campaign = url.searchParams.get('c') || 'unknown_campaign';
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

          // 2. إدارة email_activities بناءً على UID والحملة (لضمان نفس السجل)
          const eaCheckRes = await fetch(`${SUPABASE_URL}/rest/v1/email_activities?uid=eq.${uid}&campaign_name=eq.${encodeURIComponent(campaign)}&select=uid`, { headers: sbHeaders });
          const eaCheckData = await eaCheckRes.json();

          if (eaCheckData && eaCheckData.length > 0) {
            // السجل موجود (فتح الإيميل أولاً ثم نقر) -> تحديث entered_site = true
            await fetch(`${SUPABASE_URL}/rest/v1/email_activities?uid=eq.${uid}&campaign_name=eq.${encodeURIComponent(campaign)}`, {
              method: 'PATCH',
              headers: sbHeaders,
              body: JSON.stringify({ entered_site: true })
            });
          } else {
            // السجل غير موجود (نقر مباشر دون فتح مسبق) -> إنشاء سجل جديد بالحملة الصحيحة
            await fetch(`${SUPABASE_URL}/rest/v1/email_activities`, {
              method: 'POST',
              headers: sbHeaders,
              body: JSON.stringify({
                uid,
                campaign_name: campaign,
                open_count: 0,
                entered_site: true,
                last_open_at: now
              })
            });
          }

          // 3. منع تكرار حدث email_click (Zero-Bloat Rule)
          const evCheckRes = await fetch(`${SUPABASE_URL}/rest/v1/events?uid=eq.${uid}&event_type=eq.email_click&event_value=eq.${encodeURIComponent(campaign)}&select=event_id`, { headers: sbHeaders });
          const evCheckData = await evCheckRes.json();

          if (!evCheckData || evCheckData.length === 0) {
            await fetch(`${SUPABASE_URL}/rest/v1/events`, {
              method: 'POST',
              headers: sbHeaders,
              body: JSON.stringify({
                event_uuid: crypto.randomUUID(),
                uid: uid,
                event_type: 'email_click',
                event_value: campaign, // ربط النقر بالحملة
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