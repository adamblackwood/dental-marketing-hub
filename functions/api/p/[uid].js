// functions/p/[uid].js
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

          // 2. Atomic Upsert لـ email_activities (القيد الفريد موجود مسبقاً وسيتم التحديث بنجاح)
          const eaRes = await fetch(`${SUPABASE_URL}/rest/v1/email_activities?uid=eq.${uid}&campaign_name=eq.${encodeURIComponent(campaign)}&select=open_count,last_open_at,entered_site`, { headers: sbHeaders });
          const eaData = await eaRes.json();
          const currentCount = (eaData && eaData.length > 0) ? (eaData[0].open_count || 0) : 0;
          const lastOpen = (eaData && eaData.length > 0) ? eaData[0].last_open_at : now;

          await fetch(`${SUPABASE_URL}/rest/v1/email_activities?on_conflict=uid,campaign_name`, {
            method: 'POST',
            headers: { ...sbHeaders, 'Prefer': 'resolution=merge-duplicates' },
            body: JSON.stringify({
              uid: uid,
              campaign_name: campaign,
              open_count: currentCount,
              entered_site: true,
              last_open_at: lastOpen
            })
          });

          // 3. منع تكرار حدث email_click
          const evCheckRes = await fetch(`${SUPABASE_URL}/rest/v1/events?uid=eq.${uid}&event_type=eq.email_click&event_value=eq.${encodeURIComponent(campaign)}&select=event_id`, { headers: sbHeaders });
          const evCheckData = await evCheckRes.json();

          if (!evCheckData || evCheckData.length === 0) {
            await fetch(`${SUPABASE_URL}/rest/v1/events`, {
              method: 'POST',
              headers: sbHeaders,
              body: JSON.stringify({
                event_uuid: crypto.randomUUID(), uid, event_type: 'email_click',
                event_value: campaign, created_at: now
              })
            });
          }

        } catch (innerErr) {
          console.error('Click tracking error:', innerErr);
        }
      })()
    );

    // التوجيه للموقع مع إضافة Cache-Control لمنع المتصفح من حفظ التوجيه
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `https://dental-marketing-hub.pages.dev/?identified=${uid}`,
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    });

  } catch (err) {
    return new Response('Error', { status: 500 });
  }
}