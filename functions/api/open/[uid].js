// functions/api/open/[uid].js
import { SUPABASE_URL, SUPABASE_ANON_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } from '../config.js';

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

    if (!uid) return buildPixelResponse();

    context.waitUntil(
      (async () => {
        try {
          // 1. Upsert لملف الزائر
          const profCheckRes = await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}&select=identified_email`, { headers: sbHeaders });
          const profCheckData = await profCheckRes.json();
          let email = 'Unknown';

          if (profCheckData && profCheckData.length > 0) {
            email = profCheckData[0].identified_email || 'Unknown';
            await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles?uid=eq.${uid}`, {
              method: 'PATCH',
              headers: sbHeaders,
              body: JSON.stringify({ last_seen_at: now })
            });
          } else {
            await fetch(`${SUPABASE_URL}/rest/v1/visitor_profiles`, {
              method: 'POST',
              headers: sbHeaders,
              body: JSON.stringify({
                uid, is_identified: false, lead_status: 'cold', lead_score: 0,
                total_visits: 0, total_conversions: 0, first_seen_at: now, last_seen_at: now
              })
            });
          }

          // 2. منع تكرار حدث email_open
          const evCheckRes = await fetch(`${SUPABASE_URL}/rest/v1/events?uid=eq.${uid}&event_type=eq.email_open&event_value=eq.${encodeURIComponent(campaign)}&select=event_id`, { headers: sbHeaders });
          const evCheckData = await evCheckRes.json();

          if (!evCheckData || evCheckData.length === 0) {
            await fetch(`${SUPABASE_URL}/rest/v1/events`, {
              method: 'POST',
              headers: sbHeaders,
              body: JSON.stringify({
                event_uuid: crypto.randomUUID(), uid, event_type: 'email_open',
                event_value: campaign, created_at: now
              })
            });
          }

          // 3. Atomic Upsert لـ email_activities (يجب وجود Unique Constraint على uid+campaign_name في Supabase)
          // نقرأ العداد الحالي أولاً إذا كان موجوداً
          const eaRes = await fetch(`${SUPABASE_URL}/rest/v1/email_activities?uid=eq.${uid}&campaign_name=eq.${encodeURIComponent(campaign)}&select=open_count`, { headers: sbHeaders });
          const eaData = await eaRes.json();
          const currentCount = (eaData && eaData.length > 0) ? (eaData[0].open_count || 0) : 0;

          await fetch(`${SUPABASE_URL}/rest/v1/email_activities?on_conflict=uid,campaign_name`, {
            method: 'POST',
            headers: { ...sbHeaders, 'Prefer': 'resolution=merge-duplicates' },
            body: JSON.stringify({
              uid: uid,
              campaign_name: campaign,
              open_count: currentCount + 1,
              entered_site: (eaData && eaData.length > 0) ? eaData[0].entered_site : false,
              last_open_at: now
            })
          });

          // 4. إشعار تليجرام
          const tgMsg = `📧 *Email Opened!*\n\n*Email:* ${email}\n*Campaign:* ${campaign}\n*UID:* ${uid}\n*Time:* ${now}`;
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: tgMsg, parse_mode: 'Markdown' })
          });

        } catch (innerErr) {
          console.error('Email open tracking error:', innerErr);
        }
      })()
    );

    return buildPixelResponse();

  } catch (err) {
    console.error('Open pixel fatal error:', err);
    return buildPixelResponse();
  }
}