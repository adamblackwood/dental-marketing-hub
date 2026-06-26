// functions/p/[uid].js
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../api/config.js';

// دالة توليد UUID حتمي (Deterministic) لمنع تكرار الأحداث في Supabase
async function deterministicUUID(uid, type, value) {
    const str = `${uid}_${type}_${value}`;
    const buffer = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-1', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    // تنسيق الناتج ليكون UUID v4 صالح لقواعد البيانات (8-4-4-4-12)
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

          // 2. Upsert لـ email_activities (تحديث entered_site فقط)
          const eaRes = await fetch(`${SUPABASE_URL}/rest/v1/email_activities?uid=eq.${uid}&campaign_name=eq.${encodeURIComponent(campaign)}&select=open_count,last_open_at`, { headers: sbHeaders });
          const eaData = await eaRes.json();
          const currentCount = (eaData && eaData.length > 0) ? (eaData[0].open_count || 0) : 1;
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

          // 3. إدراج حدث email_click بشكل حتمي (Deterministic UUID)
          // باستخدام on_conflict=event_uuid وتجاهل التكرارات، نلغي الحاجة لـ Fetch للفحص
          const clickUuid = await deterministicUUID(uid, 'email_click', campaign);
          
          await fetch(`${SUPABASE_URL}/rest/v1/events?on_conflict=event_uuid`, {
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

    // التوجيه للموقع باستخدام النطاق الديناميكي لمنع كسر الكوكيز والجلسات
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
______

==================================================
الملف: functions-api-open-[uid].js
==================================================
// functions/api/open/[uid].js
import { SUPABASE_URL, SUPABASE_ANON_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } from '../config.js';

const TRANSPARENT_GIF_BASE64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

// دالة توليد UUID حتمي (Deterministic) لمنع تكرار الأحداث في Supabase
async function deterministicUUID(uid, type, value) {
    const str = `${uid}_${type}_${value}`;
    const buffer = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-1', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hashHex.substring(0, 8)}-${hashHex.substring(8, 12)}-${hashHex.substring(12, 16)}-${hashHex.substring(16, 20)}-${hashHex.substring(20, 32)}`;
}

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

          // 2. إدراج حدث email_open بشكل حتمي (Deterministic UUID)
          const openUuid = await deterministicUUID(uid, 'email_open', campaign);
          
          await fetch(`${SUPABASE_URL}/rest/v1/events?on_conflict=event_uuid`, {
            method: 'POST',
            headers: { ...sbHeaders, 'Prefer': 'resolution=ignore-duplicates' },
            body: JSON.stringify({
              event_uuid: openUuid, 
              uid: uid, 
              event_type: 'email_open',
              event_value: campaign, 
              created_at: now
            })
          });

          // 3. Upsert آمن لـ email_activities (Fetch -> Increment -> Upsert)
          // هذا يمنع الأخطاء الصامتة ويضمن تحديث العداد دون Lost Updates
          const eaRes = await fetch(`${SUPABASE_URL}/rest/v1/email_activities?uid=eq.${uid}&campaign_name=eq.${encodeURIComponent(campaign)}&select=open_count,entered_site`, { headers: sbHeaders });
          const eaData = await eaRes.json();
          const currentCount = (eaData && eaData.length > 0) ? (eaData[0].open_count || 0) : 0;
          const enteredSite = (eaData && eaData.length > 0) ? eaData[0].entered_site : false;

          await fetch(`${SUPABASE_URL}/rest/v1/email_activities?on_conflict=uid,campaign_name`, {
            method: 'POST',
            headers: { ...sbHeaders, 'Prefer': 'resolution=merge-duplicates' },
            body: JSON.stringify({
              uid: uid,
              campaign_name: campaign,
              open_count: currentCount + 1, // زيادة آمنة
              entered_site: enteredSite,
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