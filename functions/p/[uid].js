// functions/p/[uid].js
// ⚠️ انتبه: المجلد p يجب أن يكون مباشرة داخل functions وليس داخل functions/api
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../api/config.js';

// دالة توليد UUID حتمي لمنع تكرار الأحداث
async function deterministicUUID(uid, type, value) {
    const str = `${uid}_${type}_${value}`;
    const buffer = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-1', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hashHex.substring(0, 8)}-${hashHex.substring(8, 12)}-${hashHex.substring(12, 16)}-${hashHex.substring(16, 20)}-${hashHex.substring(20, 32)}`;
}

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

    context.waitUntil(
      (async () => {
        try {
          // 1. Upsert منطقي لملف الزائر
          const profCheckRes = await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}&select=uid`, { headers: sbHeaders });
          const profCheckData = await profCheckRes.json();
          
          if (!profCheckData || profCheckData.length === 0) {
            await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles`, {
              method: 'POST',
              headers: sbHeaders,
              body: JSON.stringify({
                uid, is_identified: false, lead_status: 'cold', lead_score: 0,
                total_visits: 0, total_conversions: 0, first_seen_at: now, last_seen_at: now
              })
            });
          }

          // 2. Upsert آمن لـ email_activities (Fetch -> PATCH or POST)
          // هذه الطريقة تتجاوز أي مشاكل متعلقة بغياب Unique Constraint في Supabase
          const eaRes = await fetch(`${SUPABASE_URL}/rest/v1/email_activities?uid=eq.${uid}&campaign_name=eq.${encodeURIComponent(campaign)}`, { headers: sbHeaders });
          const eaData = await eaRes.json();

          if (eaData && eaData.length > 0) {
            // السجل موجود مسبقاً، نقوم بتحديثه فقط
            await fetch(`${SUPABASE_URL}/rest/v1/email_activities?uid=eq.${uid}&campaign_name=eq.${encodeURIComponent(campaign)}`, {
              method: 'PATCH',
              headers: sbHeaders,
              body: JSON.stringify({ entered_site: true })
            });
          } else {
            // لا يوجد سجل، نقوم بإنشاء واحد جديد
            await fetch(`${SUPABASE_URL}/rest/v1/email_activities`, {
              method: 'POST',
              headers: sbHeaders,
              body: JSON.stringify({
                uid: uid,
                campaign_name: campaign,
                open_count: 1, // نحسبها فتحة ضمنية لأنه نقر بدون فتح مسجل
                entered_site: true,
                last_open_at: now
              })
            });
          }

          // 3. إدراج حدث email_click بشكل حتمي (Deterministic UUID)
          const clickUuid = await deterministicUUID(uid, 'email_click', campaign);
          
          await fetch(`${SUPABASE_URL}/rest/v1/events`, {
            method: 'POST',
            headers: { ...sbHeaders, 'Prefer': 'resolution=ignore-duplicates' },
            body: JSON.stringify({
              event_uuid: clickUuid, 
              uid: uid, 
              event_type: 'email_click',
              event_value: campaign, 
              created_at: now
            })
          });

        } catch (innerErr) {
          console.error('Click tracking error:', innerErr);
        }
      })()
    );

    // التوجيه للموقع باستخدام النطاق الديناميكي
    const requestUrl = new URL(context.request.url);
    const redirectUrl = `${requestUrl.origin}/?identified=${uid}`;

    return new Response(null, {
      status: 302,
      headers: {
        'Location': redirectUrl,
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    });

  } catch (err) {
    return new Response('Error', { status: 500 });
  }
}